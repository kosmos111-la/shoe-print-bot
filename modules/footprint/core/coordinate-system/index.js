// modules/footprint/core/coordinate-system/index.js
const CoordinateTransformer = require('./CoordinateTransformer');
const CoordinateNormalizer = require('./CoordinateNormalizer');
const CoordinateValidator = require('./CoordinateValidator'); // новый

module.exports = {
    // Трансформации
    transform: CoordinateTransformer.transform,
    transformPoints: CoordinateTransformer.transformPoints,
    applyTransformation: CoordinateTransformer.applyTransformation,
    rotate: CoordinateTransformer.rotate,
    scale: CoordinateTransformer.scale,
    centerPoints: CoordinateTransformer.centerPoints,
   
    // Нормализация
    normalize: CoordinateNormalizer.normalize,
    normalizePoints: CoordinateNormalizer.normalizePoints,
    standardize: CoordinateNormalizer.standardize,
   
    // Валидация
    validate: CoordinateValidator.validatePoints,
    validateTransformation: CoordinateValidator.validateTransformation,
    compareTransformations: CoordinateValidator.compareTransformations,
   
    // Утилиты
    calculateCenter: CoordinateTransformer.calculateCenter,
    getBounds: CoordinateTransformer.getBounds,
    createCanonicalTransformation: CoordinateTransformer.createCanonicalTransformation,
    isCanonical: CoordinateTransformer.isCanonical,
   
    // Константы
    CONSTANTS: {
        CENTER: { x: 500, y: 500 },
        BOUNDS: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 },
        CANONICAL_ANGLE: 0,
        DEFAULT_SCALE: 1.0
    },
   
    // Классы для прямого доступа
    Transformer: CoordinateTransformer,
    Normalizer: CoordinateNormalizer,
    Validator: CoordinateValidator
};
