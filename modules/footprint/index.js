// modules/footprint/index.js
const FootprintManager = require('./footprint-manager');
const FootprintDatabase = require('./footprint-database');
const DigitalFootprint = require('./digital-footprint');
const ModelVisualizer = require('./model-visualizer');
const EnhancedModelVisualizer = require('./enhanced-model-visualizer'); // ✅ ДОБАВЬ ЭТО

module.exports = {
    FootprintManager,
    FootprintDatabase,
    DigitalFootprint,
    ModelVisualizer,
    EnhancedModelVisualizer, // ✅ ДОБАВЬ ЭТО
   
    // Короткие алиасы
    manager: FootprintManager,
    database: FootprintDatabase,
    footprint: DigitalFootprint,
    visualizer: ModelVisualizer,
    enhancedVisualizer: EnhancedModelVisualizer // ✅ ДОБАВЬ ЭТО
};
