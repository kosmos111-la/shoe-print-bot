// modules/footprint/index.js - ОБНОВЛЁННЫЙ
const DigitalFootprint = require('./digital-footprint');
const FootprintDatabase = require('./footprint-database');
const FootprintManager = require('./footprint-manager');
const ModelVisualizer = require('./model-visualizer');
const EnhancedModelVisualizer = require('./enhanced-model-visualizer');
const TopologyUtils = require('./topology-utils');
const PointCloudAligner = require('./point-cloud-aligner'); // НОВЫЙ ИМПОРТ

module.exports = {
    DigitalFootprint,
    FootprintDatabase,
    FootprintManager,
    ModelVisualizer,
    EnhancedModelVisualizer,
    TopologyUtils,
    PointCloudAligner // НОВЫЙ ЭКСПОРТ
};
