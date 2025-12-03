const config = require('../../config.js'); // Добавь .js
const BotManager = require('./bot-manager');
const DataPersistence = require('./data-persistence');

class ModuleManager {
    constructor() {
        this.config = config;
        this.modules = {};
        this.botManager = new BotManager(this.config.TELEGRAM_TOKEN);
        this.dataPersistence = new DataPersistence();
    }
   
    async initialize() {
        console.log('🔄 Инициализация модулей...');
        console.log('✅ Конфиг загружен');
       
        // Пока заглушки для теста
        this.modules = {
            stats: {
                updateUserStats: () => console.log('📊 Статистика обновлена'),
                getGlobalStats: () => ({ totalUsers: 0, totalPhotos: 0 })
            },
            visualization: {
                createVisualization: () => console.log('🎨 Визуализация создана')
            },
            analysis: {
                analyzeImage: () => console.log('🔍 Анализ изображения')
            }
        };
       
        console.log('✅ Все модули инициализированы');
        return this.modules;
    }
   
    getBotManager() {
        return this.botManager;
    }
   
    getConfig() {
        return this.config;
    }
}

module.exports = new ModuleManager();
