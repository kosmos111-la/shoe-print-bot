// =============================================================================
// 🧹 МЕНЕДЖЕР ВРЕМЕННЫХ ФАЙЛОВ - ОСНОВНОЙ КЛАСС
// =============================================================================

const fs = require('fs');
const path = require('path');

class TempFileManager {
    constructor(options = {}) {
        this.tempFiles = new Set();
        this.tempDir = options.tempDir || path.join(process.cwd(), 'temp');
        this.autoCleanup = options.autoCleanup !== false; // true по умолчанию
       
        this.ensureTempDir();
        console.log('🧹 Менеджер временных файлов инициализирован');
    }
   
    /**
     * Создает папку для временных файлов если она не существует
     */
    ensureTempDir() {
        try {
            if (!fs.existsSync(this.tempDir)) {
                fs.mkdirSync(this.tempDir, { recursive: true });
                console.log('✅ Создана папка для временных файлов:', this.tempDir);
            }
        } catch (error) {
            console.log('❌ Не удалось создать папку temp:', error.message);
            throw error;
        }
    }
   
    /**
     * Добавляет файл в отслеживание
     * @param {string} filePath - путь к файлу
     */
    track(filePath) {
        if (filePath && typeof filePath === 'string') {
            this.tempFiles.add(filePath);
            console.log(`📁 Отслеживаем файл: ${path.basename(filePath)}`);
        }
        return this; // для чейнинга
    }
   
    /**
     * Создает новый временный файл с автоматическим отслеживанием
     * @param {string} prefix - префикс имени файла
     * @param {string} extension - расширение файла
     * @returns {string} путь к созданному файлу
     */
    createTempFile(prefix = 'temp', extension = 'png') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const filename = `${prefix}_${timestamp}_${random}.${extension.replace('.', '')}`;
        const filePath = path.join(this.tempDir, filename);
       
        this.track(filePath);
        return filePath;
    }
   
    /**
     * Удаляет конкретный файл
     * @param {string} filePath - путь к файлу
     */
    removeFile(filePath) {
        try {
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                this.tempFiles.delete(filePath);
                console.log(`✅ Удален файл: ${path.basename(filePath)}`);
                return true;
            }
        } catch (error) {
            console.log(`⚠️ Не удалось удалить ${path.basename(filePath)}:`, error.message);
        }
        return false;
    }
   
    /**
     * Очищает ВСЕ временные файлы
     * @returns {number} количество удаленных файлов
     */
    cleanup() {
        let cleanedCount = 0;
        const filesToRemove = [...this.tempFiles];
       
        filesToRemove.forEach(filePath => {
            if (this.removeFile(filePath)) {
                cleanedCount++;
            }
        });
       
        console.log(`🧹 Очистка завершена: ${cleanedCount} файлов удалено`);
        return cleanedCount;
    }
   
    /**
     * Очищает только старые файлы (старше N минут)
     * @param {number} minutes - возраст файлов в минутах
     */
    cleanupOldFiles(minutes = 60) {
        let cleanedCount = 0;
        const cutoffTime = Date.now() - (minutes * 60 * 1000);
       
        this.tempFiles.forEach(filePath => {
            try {
                const stats = fs.statSync(filePath);
                if (stats.mtimeMs < cutoffTime) {
                    if (this.removeFile(filePath)) {
                        cleanedCount++;
                    }
                }
            } catch (error) {
                // Файл уже удален, удаляем из отслеживания
                this.tempFiles.delete(filePath);
            }
        });
       
        console.log(`🧹 Удалено старых файлов: ${cleanedCount} (старше ${minutes} минут)`);
        return cleanedCount;
    }
   
    /**
     * Возвращает статистику по временным файлам
     */
    getStats() {
        let totalSize = 0;
        let existingFiles = 0;
       
        this.tempFiles.forEach(filePath => {
            try {
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    totalSize += stats.size;
                    existingFiles++;
                } else {
                    this.tempFiles.delete(filePath);
                }
            } catch (error) {
                this.tempFiles.delete(filePath);
            }
        });
       
        return {
            totalTracked: this.tempFiles.size,
            existingFiles: existingFiles,
            totalSizeBytes: totalSize,
            totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
            tempDirectory: this.tempDir
        };
    }
   
    /**
     * Показывает текущую статистику в консоли
     */
    printStats() {
        const stats = this.getStats();
        console.log('📊 Статистика временных файлов:');
        console.log(`   📁 Отслеживается файлов: ${stats.totalTracked}`);
        console.log(`   ✅ Существует на диске: ${stats.existingFiles}`);
        console.log(`   💾 Общий размер: ${stats.totalSize}`);
        console.log(`   📂 Папка: ${stats.tempDirectory}`);
    }
}

module.exports = TempFileManager;
