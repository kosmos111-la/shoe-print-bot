# Архитектура и поток данных

## Слои системы

```
┌─────────────────────────────────────────────────────────┐
│  app.js  (точка входа, ~988 строк)                      │
│  • express + TelegramBot                                │
│  • сборка ctx (dependency injection)                    │
│  • регистрация хендлеров                                │
│  • вебхук + app.listen                                  │
├─────────────────────────────────────────────────────────┤
│  src/handlers/                                          │
│  • commands.handler.js — 50 текстовых команд            │
│  • photo.handler.js — приём фото, очередь, обработка    │
├─────────────────────────────────────────────────────────┤
│  src/services/ + src/state/ + src/utils/                │
│  • telegram.service.js — createBot, setupWebhook        │
│  • store.js — общее состояние (Map'ы, счётчики)         │
│  • utils/ — чистые функции (геометрия, тексты, предикты)│
├─────────────────────────────────────────────────────────┤
│  modules/  (ядро анализа — НЕ ТРОГАТЬ математику)       │
│  • footprint/ — графы, топология, сравнение             │
│  • analysis/, visualization/, feedback/, ...            │
│  • calculators/, session/ — изолированы (отдельный проект)│
└─────────────────────────────────────────────────────────┘
```

## Поток обработки фото

```
Telegram ──► bot.on('photo') (photo.handler.js)
                │
                ▼
         photoBatchDetector (сбор пачки 1с)
                │
                ▼
         processPhotoQueue(userId, chatId)
                │
                ▼
   ┌──── processSinglePhoto(chatId, userId, msg) ────┐
   │ 1. скачивание файла (bot.getFile)                │
   │ 2. поворот горизонтального фото (canvas)         │
   │ 3. Roboflow: axios POST detect.roboflow.com      │
   │    → predictions                                │
   │ 4. smartPostProcessing + analyzePredictions      │
   │ 5. фильтр животных + практический анализ         │
   │ 6. visualization (analysis-viz, topology-viz)    │
   │ 7. footprintManager.addPhotoToSession(...)       │
   │    └── SimpleFootprintManager                    │
   │        └── TopologyManager.processFootprint()    │
   │            └── TopologicalAccumulator            │
   │                ├── GraphProcessor (графы, enhance)│
   │                ├── GraphRebuilder (перестроение) │
   │                └── ModelEnhancer (улучшение)     │
   │ 8. ответ в Telegram (сообщение + визуализация)   │
   └──────────────────────────────────────────────────┘
```

### Ключевой контракт фото → ядро

`main.js:2544` (теперь `photo.handler.js`) вызывает:

```js
const result = await ctx.footprintManager.addPhotoToSession(
    userId,
    { predictions: shoeProtectors },   // отфильтрованные протекторы
    { photoId, localPath, photoQuality, ... },
    bot, chatId
);
// result: { success, similarity, decision, nodesAdded, mergeVisualization, ... }
```

`similarity` и `decision` — результат работы `TriangleMatcher` → `TopologicalAccumulator` → `TopologyManager` (см. MODULES.md).

## Что такое ctx (dependency injection)

`ctx` — объект-контекст, который **app.js** собирает один раз и передаёт в хендлеры. Внутри — **геттеры** на глобальные объекты main.js:

```js
const commandsHandlerCtx = {
    get config() { return config; },
    get sessionManager() { return sessionManager; },
    get footprintManager() { return footprintManager; },
    // ...
    updateUserStats,
    saveUserLastAnalysis
};
require('./src/handlers/commands.handler')(bot, commandsHandlerCtx);
```

**Зачем геттеры, а не прямые значения:** глобальные объекты (`sessionManager`, `visualization`…) инициализируются **после** регистрации хендлеров (в `initializeNewFootprintSystem()`). Геттер читает актуальное значение в момент вызова — колбэк работает с уже инициализированными модулями.

**Как хендлер получает доступ:** хендлер — функция `(bot, ctx) => { ... }`, внутри использует `ctx.footprintManager`, `ctx.sessionManager` и т.д. Это устраняет глобальные переменные и делает зависимости явными.

## Глобальные модули, передаваемые в хендлеры

### commands.handler (17 полей ctx)

| Поле ctx | Что это |
|---|---|
| `config` | конфиг из config.js (токены, порт) |
| `sessionManager` | сессии пользователей (trail-анализ) |
| `tempFileManager` | временные файлы |
| `animalFilter` | фильтрация лап животных |
| `practicalAnalyzer` | практический анализ для ПСО |
| `analysisModule` | комплексный анализ (морфология/топология) |
| `visualization` | стили визуализации |
| `topologyVisualizer` | топологическая визуализация |
| `footprintManager` | **главный фасад** ядра отпечатков |
| `feedbackManager` / `feedbackDB` | обратная связь пользователей |
| `yandexDisk` | загрузка на Яндекс.Диск |
| `calculators` / `apps` | калькуляторы и приложения |
| `updateUserStats`, `saveUserLastAnalysis`, `getLastUserAnalysis` | функции статистики/кэша |

### photo.handler (12 полей ctx)

Тот же набор минус `feedbackDB`, `yandexDisk`, `calculators`, `apps`, `getLastUserAnalysis` (фото их не использует).

## Правила безопасности

1. **НЕ трогать математику**: формулы треугольников, Делоне, WL-подписи, расчёт трансформации в `modules/footprint/`.
2. **НЕ трогать калькуляторы**: `modules/calculators/` и `modules/session/` — отдельный незавершённый проект, только изолированы.
3. При изменении хендлеров — `node --check` и смоук-тест (загрузка app.js с canvas-заглушкой).
