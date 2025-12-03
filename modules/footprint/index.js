// modules/footprint/index.js
const FootprintManager = require('./footprint-manager');
const FootprintDatabase = require('./footprint-database');
const DigitalFootprint = require('./digital-footprint');
const ModelVisualizer = require('./model-visualizer'); // 🆕 ДОБАВЬ

module.exports = {
    FootprintManager,
    FootprintDatabase,
    DigitalFootprint,
    ModelVisualizer, // 🆕 ДОБАВЬ
   
    // Короткие алиасы
    manager: FootprintManager,
    database: FootprintDatabase,
    footprint: DigitalFootprint,
    visualizer: ModelVisualizer // 🆕 ДОБАВЬ
};
