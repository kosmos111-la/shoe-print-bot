// modules/footprint/index.js
// Экспорт всех компонентов системы цифровых отпечатков
const FootprintManager = require('./footprint-manager');
const FootprintDatabase = require('./footprint-database');
const DigitalFootprint = require('./digital-footprint');

module.exports = {
    FootprintManager,
    FootprintDatabase,
    DigitalFootprint,
   
    // Короткие алиасы для удобства
    manager: FootprintManager,
    database: FootprintDatabase,
    footprint: DigitalFootprint
};
