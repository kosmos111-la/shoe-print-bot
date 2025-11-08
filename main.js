const express = require('express');
const modules = require('./modules/core');

class ShoePrintBot {
    constructor() {
        this.app = express();
        this.app.use(express.json());
        this.modules = modules;
    }
   
    async start() {
        try {
            console.log('🚀 Запуск модульной системы...');
            await this.modules.initialize();
           
            this.app.listen(this.modules.config.PORT, () => {
                console.log(`✅ Сервер запущен на порту ${this.modules.config.PORT}`);
            });
        } catch (error) {
            console.error('❌ Ошибка запуска:', error);
        }
    }
}

new ShoePrintBot().start();
