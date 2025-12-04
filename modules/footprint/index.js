// modules/footprint/index.js
const DigitalFootprint = require('./digital-footprint');
const FootprintDatabase = require('./footprint-database');
const FootprintManager = require('./footprint-manager');
const ModelVisualizer = require('./model-visualizer');
const EnhancedModelVisualizer = require('./enhanced-model-visualizer');

module.exports = {
    DigitalFootprint,
    FootprintDatabase,
    FootprintManager,
    ModelVisualizer,
    EnhancedModelVisualizer
   
    // Короткие алиасы
   // manager: FootprintManager,
   // database: FootprintDatabase,
  //  footprint: DigitalFootprint,
  //  visualizer: ModelVisualizer,
  //  enhancedVisualizer: EnhancedModelVisualizer // ✅ ДОБАВЬ ЭТО
};
