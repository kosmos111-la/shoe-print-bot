const config = require('../../config');
const BotManager = require('./bot-manager');
const DataPersistence = require('./data-persistence');

// Импорт модулей
const yandexDisk = require('../yandex-disk');
const visualization = require('../visualization');
const analysis = require('../analysis');
const stats = require('../stats');
const commands = require('../commands');

class ModuleManager {
    constructor() {
        this.config = config;
        this.modules = {};
    }
   
    async initialize() {
        console.log('🔄 Инициализация модулей...');
       
        // Инициализация основных модулей
        this.modules.dataPersistence = new DataPersistence();
        this.modules.botManager = new BotManager(this.config.TELEGRAM_TOKEN);
       
        // Инициализация функциональных модулей
        this.modules.yandexDisk = await yandexDisk.initialize(this.config.YANDEX_DISK_TOKEN);
        this.modules.visualization = visualization.initialize();
        this.modules.analysis = analysis.initialize(this.config.ROBoFLOW);
        this.modules.stats = await stats.initialize();
       
        // Настройка команд бота
        await commands.initialize(this.modules);
       
        console.log('✅ Все модули инициализированы');
        return this.modules;
    }
   
    getModule(moduleName) {
        return this.modules[moduleName];
    }
}

module.exports = new ModuleManager();
