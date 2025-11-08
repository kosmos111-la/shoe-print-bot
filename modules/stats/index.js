const StatisticsManager = require('./statistics-manager');

let statsModule = null;

module.exports = {
    async initialize() {
        statsModule = new StatisticsManager();
        await statsModule.loadStats();
       
        console.log('✅ Модуль статистики инициализирован');
        return statsModule;
    },
   
    getModule() {
        return statsModule;
    }
};
