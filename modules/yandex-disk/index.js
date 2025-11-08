const YandexDiskService = require('./yandex-service');

let yandexModule = null;

module.exports = {
    async initialize(token) {
        try {
            if (!token) {
                console.log('❌ Токен Яндекс.Диска не указан');
                return null;
            }
           
            yandexModule = new YandexDiskService(token);
            console.log('✅ Модуль Яндекс.Диска инициализирован');
            return yandexModule;
        } catch (error) {
            console.log('❌ Ошибка инициализации Яндекс.Диска:', error.message);
            return null;
        }
    },
   
    getModule() {
        return yandexModule;
    }
};
