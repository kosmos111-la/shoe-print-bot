// =============================================================================
// 🧹 МОДУЛЬ УПРАВЛЕНИЯ ВРЕМЕННЫМИ ФАЙЛАМИ - ЭКСПОРТ
// =============================================================================

const TempFileManager = require('./manager');

/**
* Инициализирует менеджер временных файлов
* @param {Object} options - настройки менеджера
* @returns {TempFileManager} экземпляр менеджера
*/
function initialize(options = {}) {
    try {
        const manager = new TempFileManager(options);
        console.log('✅ Модуль управления временными файлами загружен');
        return manager;
    } catch (error) {
        console.log('❌ Не удалось инициализировать менеджер временных файлов:', error.message);
        throw error;
    }
}

module.exports = {
    initialize,
    TempFileManager // на случай если захотим использовать класс напрямую
};
