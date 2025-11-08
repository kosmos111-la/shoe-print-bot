const BasicCommands = require('./basic-commands');
const PhotoHandler = require('./photo-handler');

module.exports = {
    async initialize(modules) {
        const bot = modules.botManager.getBot();
       
        // Инициализация команд
        BasicCommands.setup(bot, modules);
        PhotoHandler.setup(bot, modules);
       
        console.log('✅ Модуль команд инициализирован');
    }
};
