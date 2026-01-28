// modules/legacy-support/coordinate-facade.js
const NewSystem = require('../core/coordinate-system');

/**
* Фасад для постепенной миграции
* Все старые модули будут использовать этот интерфейс
*/
module.exports = {
    // Старые названия методов → новые методы
    transformPoints: NewSystem.transformPoints,
    normalizePoints: NewSystem.normalizePoints,
    applyTransformation: NewSystem.transform,
   
    // Старые классы (прокси)
    CoordinateManager: class {
        static transform(points) { return NewSystem.transform(points); }
        static normalize(points) { return NewSystem.normalize(points); }
    },
   
    TransformationValidator: class {
        static validate(points) { return NewSystem.validate(points); }
    }
};
