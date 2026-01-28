// modules/footprint/core/coordinate-system/index.js
/**
* Единый фасад для всех операций с координатами
* Заменяет CoordinateDirector, CoordinateManager и другие 30 модулей
*/

const CoordinateTransformer = require('./CoordinateTransformer');
const CoordinateNormalizer = require('./CoordinateNormalizer');

// Для валидации создадим позже
const CoordinateValidator = {
    validate: (points) => {
        console.log('[CoordinateValidator] Валидация точек');
        return Array.isArray(points) && points.length > 0;
    }
};

// 🔥 ОСНОВНОЙ ЭКСПОРТ
module.exports = {
    // === ТРАНСФОРМАЦИИ ===
    // Основные методы
    transform: CoordinateTransformer.transform,
    enforceCanonical: CoordinateTransformer.enforceCanonical,
    isCanonical: CoordinateTransformer.isCanonical,
    createCanonicalTransformation: CoordinateTransformer.createCanonicalTransformation,
   
    // Алиасы для обратной совместимости
    transformPoints: CoordinateTransformer.transformPoints,
    applyTransformation: CoordinateTransformer.applyTransformation,
    correctToCanonical: CoordinateTransformer.correctToCanonical,
   
    // Вращение (из rotation-invariance.js)
    rotate: CoordinateTransformer._rotatePoints,
   
    // === НОРМАЛИЗАЦИЯ ===
    // Основные методы
    normalize: CoordinateNormalizer.normalize,
   
    // Алиасы для обратной совместимости
    normalizePoints: CoordinateNormalizer.normalizePoints,
    standardize: CoordinateNormalizer.standardize,
    normalizeToRange: CoordinateNormalizer.normalizeToRange,
   
    // === ВАЛИДАЦИЯ ===
    validate: CoordinateValidator.validate,
   
    // === КОНСТАНТЫ ===
    CONSTANTS: CoordinateTransformer.CONSTANTS,
   
    // === УТИЛИТЫ ===
    calculateCenter: CoordinateTransformer._calculateCenter,
    getBounds: CoordinateNormalizer._getBounds,
   
    // === КЛАССЫ ДЛЯ ПРЯМОГО ДОСТУПА ===
    Transformer: CoordinateTransformer,
    Normalizer: CoordinateNormalizer,
    Validator: CoordinateValidator
// Новые методы для обратной совместимости
    centerPoints: CoordinateTransformer.centerPoints,
    calculateCenter: CoordinateTransformer.calculateCenter,
    getBounds: CoordinateTransformer.getBounds,
    createCanonicalTransformation: CoordinateTransformer.createCanonicalTransformation,
    isCanonical: CoordinateTransformer.isCanonical,
    applyTransformation: CoordinateTransformer.transform, // алиас
   
    // Константы для обратной совместимости
    CONSTANTS: {
        CENTER: { x: 500, y: 500 },
        CANONICAL_ANGLE: 0,
        DEFAULT_SCALE: 1.0
    }
};
