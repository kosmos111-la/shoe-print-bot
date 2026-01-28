// modules/legacy-support/coordinate-facade.js
/**
* Фасад для постепенной миграции
* Все старые модули будут использовать этот интерфейс
* Это позволит нам рефакторить постепенно
*/

const NewSystem = require('../core/coordinate-system');

// 🔥 ФУНКЦИОНАЛЬНОСТЬ CoordinateDirector
class LegacyCoordinateDirector {
    constructor(manager) {
        this.manager = manager;
        console.log('[LegacyCoordinateDirector] Создан для обратной совместимости');
    }
   
    enforceCanonicalSystem(systemName, transformation) {
        console.log(`[Legacy] enforceCanonicalSystem("${systemName}")`);
        return NewSystem.enforceCanonical(transformation, systemName);
    }
   
    isCanonical(transformation) {
        return NewSystem.isCanonical(transformation);
    }
   
    createCanonicalTransformation() {
        return NewSystem.createCanonicalTransformation();
    }
   
    // Другие методы CoordinateDirector...
    correctToCanonical(transformation) {
        return NewSystem.correctToCanonical(transformation);
    }
   
    validateForComparison(trans1, trans2) {
        console.log('[Legacy] validateForComparison');
       
        const canonical1 = NewSystem.enforceCanonical(trans1, 'comparison_source');
        const canonical2 = NewSystem.enforceCanonical(trans2, 'comparison_target');
       
        const angle1 = canonical1.rotationAngle || 0;
        const angle2 = canonical2.rotationAngle || 0;
        const angleDiff = Math.abs(angle1 - angle2);
       
        const isValid = angleDiff < NewSystem.CONSTANTS.CANONICAL_THRESHOLD;
       
        return {
            valid: isValid,
            transformation1: canonical1,
            transformation2: canonical2,
            wasCorrected: !isValid,
            angleDiff: angleDiff
        };
    }
}

// 🔥 ФУНКЦИОНАЛЬНОСТЬ CoordinateManager
class LegacyCoordinateManager {
    static transform(points) {
        return NewSystem.transformPoints(points);
    }
   
    static normalize(points) {
        return NewSystem.normalizePoints(points);
    }
   
    // Другие методы как в оригинальном CoordinateManager
    static getTransformation() {
        return NewSystem.createCanonicalTransformation();
    }
}

// 🔥 ФУНКЦИОНАЛЬНОСТЬ TransformationValidator
class LegacyTransformationValidator {
    static validate(points) {
        return NewSystem.validate(points);
    }
   
    static normalizePoints(points) {
        return NewSystem.normalizePoints(points);
    }
}

// 🔥 ОСНОВНОЙ ЭКСПОРТ
module.exports = {
    // Старые классы
    CoordinateDirector: LegacyCoordinateDirector,
    CoordinateManager: LegacyCoordinateManager,
    TransformationValidator: LegacyTransformationValidator,
   
    // Старые функции (если были)
    transformPoints: NewSystem.transformPoints,
    normalizePoints: NewSystem.normalizePoints,
    applyTransformation: NewSystem.applyTransformation,
   
    // Константы
    CONSTANTS: NewSystem.CONSTANTS
};
