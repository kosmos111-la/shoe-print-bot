# Справочник по модулям

## src/ — код приложения (не ядро)

### src/handlers/
| Файл | Зачем | Главное внутри |
|---|---|---|
| `commands.handler.js` | 50 текстовых команд бота | `registerCommandsHandler(bot, ctx)`; секции: системные, калькуляторы, сессии, trail, модели отпечатков, визуализация, callback, диагностика |
| `photo.handler.js` | обработка фото | `bot.on('photo')`, `processPhotoQueue`, `processSinglePhoto`, `isHorizontalImage`, `rotateImageToVertical` |

Связаны: вызываются из `app.js` через `require(...)(bot, ctx)`; используют `ctx.*` и `src/utils/`, `src/state/`.

### src/services/
| Файл | Зачем | Главное внутри |
|---|---|---|
| `telegram.service.js` | обёртка над Telegram Bot API | `createBot(token)` → `new TelegramBot`; `setupWebhook(bot, token)` — установка вебхука на Render + fallback на polling |

### src/state/
| Файл | Зачем | Главное внутри |
|---|---|---|
| `store.js` | единое состояние бота | `userStats` (Map), `globalStats`, `userLastAnalysis`, `photoBatchDetector`, `photoQueue`, `processingUsers` |

Связаны: импортируются хендлерами напрямую (`const { userStats } = require('../state/store')`).

### src/utils/ — чистые функции (0 зависимостей)
| Файл | Функции |
|---|---|
| `geometry.js` | `getContourCenter`, `rotatePredictions`, `normalizeFootprintOrientation` |
| `predictions.js` | `smartPostProcessing`, `analyzePredictions`, `generateTopologyText` |
| `text.js` | `escapeHtml`, `isCoordinates`, `parseDateTime`, `getCorrectionDescription` |

---

## modules/footprint/ — ЯДРО анализа (НЕ ТРОГАТЬ математику)

### Архитектура ядра (сверху вниз)

```
SimpleFootprintManager (simple-manager.js) — ФАСАД, точка входа из хендлеров
  └── TopologyManager (topology/TopologyManager.js)
        └── TopologicalAccumulator (topology/TopologicalAccumulator.js)
              ├── ModelManager (CRUD моделей)
              ├── GraphProcessor (построение графов, enhance)
              ├── GraphRebuilder (перестроение графа после фото)
              └── GraphHasher (быстрый поиск по хэшу)
```

### Ключевые классы

| Файл | Класс | Роль |
|---|---|---|
| `simple-manager.js` | `SimpleFootprintManager` | Фасад: `addPhotoToSession`, `endSession`, `getPermanentModels`, `getSystemStats`, `createSession`, `getActiveSession`, `printFeatureTable` |
| `topology/TopologyManager.js` | `TopologyManager` | Обёртка сессии + аккумулятор; `processFootprint`, `getDecisionFromResult` (similarity → same/different) |
| `topology/TopologicalAccumulator.js` | `TopologicalAccumulator` | Координатор: `processPoints`, статусы `created/enhanced`, `similarityThreshold` (0.45) |
| `topology/GraphProcessor.js` | `GraphProcessor` | Построение графов (Делоне + KNN), `enhanceModel` |
| `topology/GraphRebuilder.js` | `GraphRebuilder` | Полное перестроение графа модели |
| `topology/ModelManager.js` | `ModelManager` | CRUD моделей, `getUserModelsInfo` |
| `topology/GraphBuilder.js` | `GraphBuilder` | Триангуляция Делоне + нормализация + подсчёт треугольников |
| `topology/KNNGraphBuilder.js` | `KNNGraphBuilder` | KNN-граф для WL-подписей |
| `topology/StructureManager.js`, `StructureBuilder.js`, `Structure.js` | структуры | Связные компоненты треугольников от seed |
| `topology/MorphologyEncoder.js` | `MorphologyEncoder` | Морфология точки (eccentricity, asymmetry, radialProfile, area) |
| `topology/TopologicalFingerprint.js` | `TopologicalFingerprint` | WL-подписи |
| `topology/enhancers/ModelEnhancer.js` | `ModelEnhancer` | Главный orchestrator улучшения модели новым фото (TriangleMatcher → структуры → transform → updateModel) |
| `topology/utils/` | `GeometryUtils`, `GraphUtils`, `RoleClassifier`, `GraphHasher` | Утилиты геометрии/графов/ролей/хэширования |
| `matching/TriangleMatcher.js` | `TriangleMatcher` | Сравнение по 6 признакам треугольника; **возвращает similarity** (доля совпадений) |
| `validation/ValidationModule.js` | `ValidationModule` | RANSAC-подобная фильтрация выбросов + `calculateTransform` (scale/rotation/translation) |

### Связи между модулями ядра

```
ModelEnhancer.enhance()
  ├── _compareByTriangles() → TriangleMatcher.findMatches() → { matches, similarity }
  ├── validateAll() → ValidationModule
  ├── StructureManager / StructureBuilder → структуры
  ├── GeometryUtils.applyTransform()
  └── _updateModel() → GraphRebuilder.rebuildModel()
```

`similarity` течёт так: `TriangleMatcher` → `ModelEnhancer` → `TopologicalAccumulator` → `TopologyManager` → `addPhotoToSession` → `photo.handler` → бот.

---

## modules/footprint/ — прочие подсистемы

| Папка/файл | Зачем |
|---|---|
| `analysis/` | `PatternAnalyzer`, `ClusterAnalyzer`, `feature-table` |
| `alignment/` | выравнивание координат (`simple-aligner`, `improved-aligner`, `coordinate-validator`) |
| `core/` | координатная система, логгеры, `coordinate-manager` |
| `visualization/` + `visualizations/` | `model-viz`, `cluster-visualizer`, `topology-visualizer` |
| `simple-graph.js`, `simple-footprint.js`, `simple-matcher.js` | лёгкие версии графа/отпечатка/матчера (используются тестами и командами) |
| `vector-super-model.js` | супер-модель (векторная) |
| `clean/vector-algorithm.js` | единственный выживший из «чистой» системы — используется `simple-matcher.js` |

---

## 🌙 Спящее ядро (14 файлов в topology/, не подключены)

Эти файлы **не импортируются** нигде в живой цепочке (граф зависимостей их не находит), но это **математика**, а не мусор. Они предназначались для расширенной топологической обработки. Не удалять — вопрос подключения решается отдельно.

| Файл | Для чего предназначался (по коду/названию) |
|---|---|
| `AnchorPropagator.js` | распространение якорей от подтверждённых точек |
| `AngularMemory.js` | память углов между точками (реконструкция позиции по углам) |
| `CenterMatcher.js` | иерархический матчер по центру + K-plet + LCS + геометрия с допусками |
| `FeatureExtractor.js` | извлечение признаков точки (роль, зона, степень, WL-бакеты) |
| `GeometricSignature.js` | геометрическая подпись точки (WL + роли + зоны) |
| `GeometryContext.js` | контекст точки в треугольнике (барицентрические координаты, углы) |
| `GeometryMemory.js` | память геометрии точки (соседи, расстояния) |
| `LocalGroupSignature.js` | подпись локальной группы узлов |
| `QuasarNavigation.js` | «навигация» по точкам-маякам (beacons), сравнение по квазар-структурам |
| `RobustWLSignature.js` | устойчивая WL-подпись (устойчивая к шуму) |
| `SubgraphIsomorphism.js` | поиск изоморфных подграфов |
| `TransformCalculator.js` | вычисление трансформации (scale/rotation/translation) |
| `TriangulationMemory.js` | память треугольников (барицентрические координаты, поиск ближайших) |
| `TrustLevel.js` | иерархия доверия к узлам (`TrustLevelManager`) |

**Общий вывод:** это «вторая очередь» ядра — более точные сигнатуры (WL, геометрические подписи) и матчеры (CenterMatcher, SubgraphIsomorphism). Живая цепочка использует упрощённый путь: `GraphBuilder` + `TriangleMatcher` + `StructureManager` + `ModelEnhancer`.

---

## modules/ (прочее)

| Папка | Зачем | Статус |
|---|---|---|
| `modules/analysis/` | Roboflow-клиент, топография, практический анализ | активна |
| `modules/visualization/` | стили визуализации | активна |
| `modules/feedback/` | обратная связь + БД | активна |
| `modules/apps/`, `modules/yandex-disk/`, `modules/temp-manager/`, `modules/utils/` | вспомогательные сервисы | активны |
| `modules/calculators/` | снег/погода/рост/размер обуви | **изолированы, не трогать** |
| `modules/session/` | сессии trail-анализа | **изолированы, не трогать** |
