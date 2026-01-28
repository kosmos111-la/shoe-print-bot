// modules/core/coordinate-system/index.js
const CoordinateTransformer = require('./CoordinateTransformer');
const CoordinateNormalizer = require('./CoordinateNormalizer');
const CoordinateValidator = require('./CoordinateValidator'); // создадим позже

/**
* Единый фасад для всех операций с координатами
*/
module.exports = {
    // Трансформации
    transform: CoordinateTransformer.transform,
    transformPoints: CoordinateTransformer.transformPoints,
    rotate: CoordinateTransformer.rotate,
    scale: CoordinateTransformer.scale,
    translate: CoordinateTransformer.translate,
    align: CoordinateTransformer.align,
   
    // Нормализация
    normalize: CoordinateNormalizer.normalize,
    normalizePoints: CoordinateNormalizer.normalizePoints,
    standardize: CoordinateNormalizer.standardize,
   
    // Валидация (будет позже)
    validate: CoordinateValidator.validate,
   
    // Для удобства
    Transformer: CoordinateTransformer,
    Normalizer: CoordinateNormalizer,
    Validator: CoordinateValidator
};
