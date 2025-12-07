// modules/footprint/index.js - ПОЛНЫЙ ЭКСПОРТ
const DigitalFootprint = require('./digital-footprint');
const FootprintDatabase = require('./footprint-database');
const FootprintManager = require('./footprint-manager');
const ModelVisualizer = require('./model-visualizer');
const EnhancedModelVisualizer = require('./enhanced-model-visualizer');
const TopologyUtils = require('./topology-utils');
const PointCloudAligner = require('./point-cloud-aligner');

module.exports = {
    DigitalFootprint,
    FootprintDatabase,
    FootprintManager,
    ModelVisualizer,
    EnhancedModelVisualizer,
    TopologyUtils,
    PointCloudAligner
};
