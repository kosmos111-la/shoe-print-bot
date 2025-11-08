const config = require('../../config');

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
       
        // Инициализация модулей
        this.modules.yandexDisk = await yandexDisk.initialize(this.config.YANDEX_DISK_TOKEN);
        this.modules.visualization = visualization.initialize();
        this.modules.analysis = analysis.initialize(this.config.ROBOFLOW);
        this.modules.stats = await stats.initialize();
       
        console.log('✅ Все модули инициализированы');
        return this.modules;
    }
}

module.exports = new ModuleManager();
