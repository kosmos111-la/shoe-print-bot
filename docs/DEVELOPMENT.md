# Руководство для разработчика

## Запуск проекта локально

### 1. Установка

```bash
npm install
```

> ⚠️ `canvas` — нативная зависимость. На Windows может потребоваться build tools
> (Visual Studio Build Tools) или предварительно собранный бинарь.

### 2. Переменные окружения (файл `.env`)

```env
TELEGRAM_TOKEN=<токен бота от @BotFather>        # ОБЯЗАТЕЛЬНО
PORT=10000                                        # по умолчанию 10000
YANDEX_DISK_TOKEN=<токен Яндекс.Диска>            # опционально
DEBUG_MODE=false                                  # true — включить отладочные логи
```

`config.js` содержит захардкоженные настройки Roboflow (URL/ключ/пороги) и стиль визуализации.

### 3. Запуск

```bash
npm start        # → node app.js
npm run dev      # → nodemon app.js (автоперезапуск)
npm test         # → node test-webhook.js
```

Точка входа — **`app.js`** (не main.js!). В `package.json` уже всё настроено.

### 4. Проверка после изменений

```bash
node --check app.js
node --check src/handlers/commands.handler.js
# и т.д. для каждого изменённого файла
```

---

## Как добавить новую команду

1. Открой `src/handlers/commands.handler.js`.
2. Найди подходящую секцию (системные, калькуляторы, модели, визуализация...) или добавь новую.
3. Добавь обработчик внутри `registerCommandsHandler(bot, ctx) { ... }`:

```js
// Пример: /hello
bot.onText(/\/hello/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        // ctx.* — доступ к глобальным модулям
        const stats = ctx.footprintManager.getSystemStats();
        await bot.sendMessage(chatId, `👋 Привет! Моделей: ${stats.storage?.totalModels || 0}`);
    } catch (error) {
        console.log('❌ Ошибка /hello:', error.message);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});
```

### Как обратиться к ctx

| Хочу | Пишу |
|---|---|
| данные о моделях пользователя | `ctx.footprintManager.getPermanentModels(userId)` |
| статистика системы | `ctx.footprintManager.getSystemStats()` |
| активная сессия | `ctx.footprintManager.getActiveSession(userId)` |
| калькуляторы | `ctx.calculators.getMenu()` |
| стиль визуализации | `ctx.visualization.getUserStyle(userId)` |
| временный файл | `ctx.tempFileManager.createTempFile('x', 'png')` |

### Правила

- Команда — `async (msg, match) => { ... }`, обёрнута в `try/catch`.
- Никогда не читай `match[1]` без проверки (`match && match[1]`), иначе падение при вызове без аргументов.
- Не тяни новые глобалы — расширяй ctx в `app.js` (добавь геттер) и в сигнатуру хендлера.

---

## Как добавить новый тип анализа в ядро

Ядро — `modules/footprint/`. Цепочка обработки фото:

```
photo.handler → SimpleFootprintManager.addPhotoToSession
             → TopologyManager.processFootprint
             → TopologicalAccumulator.processPoints
             → GraphProcessor (построение графов)
             → ModelEnhancer.enhance (сравнение и улучшение)
```

### Варианты добавления

1. **Новый шаг внутри ModelEnhancer.enhance()** (`modules/footprint/topology/enhancers/ModelEnhancer.js`):
   - добавь вычисление, используй существующие `GeometryUtils`, `GraphUtils`
   - верни результат в объекте `return { ... }` (там уже есть `similarity`, `transform`, `matches`)

2. **Новый матчер** рядом с `matching/TriangleMatcher.js`:
   - реализуй класс с методом `findMatches(pointsA, pointsB, delaunayA, delaunayB)`
   - верни `{ matches, similarity, triangles, stats }`
   - вызови из `ModelEnhancer._compareByTriangles()` или отдельного этапа

3. **Новый вспомогательный класс** в `modules/footprint/topology/`:
   - экспортируй класс, подключи в `GraphProcessor` или `TopologicalAccumulator`

### ⚠️ Запрещено

- Менять формулы треугольников/Делоне/WL/transform без явного запроса.
- Трогать `modules/calculators/` и `modules/session/`.
- Удалять «спящее ядро» (см. MODULES.md) — это математика на будущее.

---

## TODO: 6 заглушек «в разработке»

Заглушки стоят в `commands.handler.js` и отвечают: `⚠️ Эта функция находится в разработке и пока недоступна.`

| Команда | Заглушенный метод | Что нужно реализовать в ядре |
|---|---|---|
| `/footprint_save` | `saveSessionAsModel(userId, modelName)` | В `SimpleFootprintManager`: метод сохранения текущей сессии как модели. Рядом есть `saveAsPermanentModel(userId, model, name)` (строка ~907) — можно адаптировать. Должен вернуть `{ success, modelName, modelId, modelStats, sessionInfo }`. |
| `/find_similar_footprints` | `findSimilarModels(tempFootprint, userId, { maxResults })` | В `SimpleFootprintManager`: сравнение переданного отпечатка со всеми `getPermanentModels()` через `compareFootprints`/`comparePhotoToModel`. Вернуть `{ success, similarCount, similarModels }`. |
| `/visualize_compare` | `visualizeComparison(modelId1, modelId2)` | В `SimpleFootprintManager`: загрузить 2 модели по ID, сравнить (`compareFootprints`), отрисовать через `visualization`/`merge-visualizer`, вернуть `{ success, visualization, comparison }`. |
| `/visualize_session` | `visualizeSession(userId)` | В `SimpleFootprintManager`: взять фото из сессии пользователя, построить визуализацию через `getTopologyVisualizationData` / cluster-visualizer, вернуть `{ success, visualization, sessionId }`. |
| `/visualize_merge` | `getLastMergeVisualization(userId)` | В `SimpleFootprintManager`: хранить последнюю визуализацию объединения (сейчас `addPhotoToSession` возвращает `mergeVisualization`, но не кэшируется). Вернуть путь к последнему PNG. |
| `/force_update_confirmations` | `forceUpdateSessionConfirmations(userId)` | В `SimpleFootprintManager`: пересчитать `confirmationCount` всех узлов в активной сессии по фото (метод `updatePointConfirmations` из старой `clean/`-системы как ориентир). Вернуть `{ success, analysesUpdated, nodesUpdated, totalNodes }`. |

### Как чинить заглушку

1. Реализуй метод в `modules/footprint/simple-manager.js` (или вызови существующий аналог).
2. Убери заглушку в `commands.handler.js` (строки с `// ⚠️ Функция в разработке`).
3. Верни вызов: `const result = ctx.footprintManager.<метод>(...)`.
4. `node --check` + тест команды.
