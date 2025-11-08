const express = require('express');
const modules = require('./modules/core');

class ShoePrintBot {
    constructor() {
        this.app = express();
        this.app.use(express.json());
       
        // Инициализация модулей
        this.modules = modules;
    }
   
    async start() {
        try {
            console.log('🚀 Запуск модульной системы анализа следов...');
           
            // Инициализация всех модулей
            await this.modules.initialize();
           
            // Настройка webhook
            await this.modules.botManager.setupWebhook();
           
            // Запуск сервера
            this.app.listen(this.modules.config.PORT, () => {
                console.log(`✅ Сервер запущен на порту ${this.modules.config.PORT}`);
                console.log('🤖 Бот готов к работе!');
            });
           
        } catch (error) {
            console.error('❌ Ошибка запуска:', error);
            process.exit(1);
        }
    }
}
