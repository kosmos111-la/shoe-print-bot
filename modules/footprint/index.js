// modules/footprint/index.js

const SimpleFootprintManager = require('./simple-manager');
const CoordinateSystemConverter = require('./alignment/coordinate-system-converter');
const CoordinateValidator = require('./alignment/coordinate-validator');
const TransformationDebugger = require('./alignment/transformation-debugger');
const ImprovedAligner = require('./alignment/improved-aligner');

module.exports = {
    SimpleFootprintManager,
    CoordinateSystemConverter,
    CoordinateValidator,
    TransformationDebugger,
    ImprovedAligner
};
