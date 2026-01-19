# Модульная система анализа следов

## Архитектура

### Основные модули:

1. **SimpleFootprintManager** - основной менеджер
2. **CoordinateSystemConverter** - конвертер систем координат
3. **CoordinateValidator** - валидатор систем координат
4. **TransformationDebugger** - отладчик трансформаций
5. **ImprovedAligner** - улучшенный выравниватель

## Использование

const {
    SimpleFootprintManager,
    CoordinateSystemConverter,
    CoordinateValidator
} = require('./modules/footprint');

// Создание менеджера
const manager = new SimpleFootprintManager({
    dbPath: './data/footprints',
    debug: true
});

// Сравнение с преобразованием координат
const result = await manager.compareWithCoordinateConversion(
    footprint1,
    footprint2
);

// Валидация систем координат
const validator = new CoordinateValidator({ debug: true });
const validation = validator.validateCoordinateSystems(footprint1, footprint2);

// Дебаг трансформаций
const debugger = new TransformationDebugger({ debug: true });
const debugInfo = debugger.analyzeTransformation(footprint1, footprint2);


API

CoordinateSystemConverter

· analyzeCoordinateSystems(footprint1, footprint2) - анализ систем координат
· convertPoints(points, sourceSystem, targetSystem) - преобразование точек
· convertSinglePoint(point, sourceSystem, targetSystem) - преобразование одной точки

CoordinateValidator

· validateCoordinateSystems(footprint1, footprint2) - валидация систем
· getPointsInfo(footprint) - информация о точках следа

TransformationDebugger

· analyzeTransformation(footprint1, footprint2) - анализ трансформаций
· debugSingleTransformation(footprint, name) - дебаг одной трансформации

ImprovedAligner

· alignWithIntelligentMatching(points2, points1, trans2, trans1) - интеллектуальное выравнивание
· estimateTransformWithRANSAC(matches) - оценка трансформации RANSAC



## Структура проекта после рефакторинга:


modules/footprint/
├── simple-manager.js           # Основной менеджер
├── simple-footprint.js         # Класс следа
├── simple-graph.js            # Граф
├── simple-matcher.js          # Сопоставитель
├── alignment/                 # Модули выравнивания
│   ├── coordinate-system-converter.js
│   ├── coordinate-validator.js
│   ├── transformation-debugger.js
│   ├── improved-aligner.js
│   └── simple-aligner.js
├── visualizations/            # Визуализации
│   ├── cluster-visualizer.js
│   └── template-visualizer.js
├── vector-super-model.js      # Векторная модель
└── index.js                   # Экспорт всех модулей
