const express = require('express');
const modules = require('./modules/core');

class ShoePrintBot {
    constructor() {
        this.app = express();
        this.app.use(express.json());
    }
   
    async start() {
        try {
            console.log('🚀 Запуск модульной системы...');
           
            // Инициализация модулей
            await modules.initialize();
           
            // Базовая страница
            this.app.get('/', (req, res) => {
                res.send('🤖 Базовый анализатор следов обуви (модульная версия)');
            });
           
            this.app.listen(modules.config.PORT, () => {
                console.log(`✅ Сервер запущен на порту ${modules.config.PORT}`);
            });
           
        } catch (error) {
            console.error('❌ Ошибка запуска:', error);
        }
    }
}

new ShoePrintBot().start();
