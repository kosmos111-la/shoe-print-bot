// modules/footprint/index.js

const SimpleFootprintManager = require('./simple-manager');
const GeometricAccumulator = require('./accumulator'); // 🔥 ДОБАВЛЯЕМ НОВЫЙ АККУМУЛЯТОР
const PointTracker = require('./point-tracker');
const CoordinateSystemConverter = require('./alignment/coordinate-system-converter');
const CoordinateValidator = require('./alignment/coordinate-validator');
const TransformationDebugger = require('./alignment/transformation-debugger');
const ImprovedAligner = require('./alignment/improved-aligner');

// 🔥 ЭКСПОРТИРУЕМ ВСЕ МОДУЛИ
module.exports = {
    SimpleFootprintManager,
    GeometricAccumulator,     // 🔥 НОВЫЙ АККУМУЛЯТОР
    PointTracker,
    CoordinateSystemConverter,
    CoordinateValidator,
    TransformationDebugger,
    ImprovedAligner
};
