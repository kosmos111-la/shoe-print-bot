const fs = require('fs');

class DataPersistence {
    constructor() {
        this.dataFile = 'bot-data.json';
    }
   
    async saveData(data) {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
           
            // Сохранение в Яндекс.Диск через модуль
            const yandexModule = require('../yandex-disk').getModule();
            if (yandexModule) {
                await yandexModule.uploadFile(this.dataFile, 'backup/bot-data.json');
            }
           
            console.log('💾 Данные сохранены');
        } catch (error) {
            console.log('❌ Ошибка сохранения данных:', error.message);
        }
    }
   
    async loadData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                console.log('✅ Данные загружены');
                return data;
            }
        } catch (error) {
            console.log('❌ Ошибка загрузки данных:', error.message);
        }
        return null;
    }
}

module.exports = DataPersistence;
