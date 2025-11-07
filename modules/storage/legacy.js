// modules/storage/legacy.js
const fs = require('fs');
const path = require('path');

class DataPersistence {
    constructor(sessionManager, yandexDisk = null) {
        this.sessionManager = sessionManager;
        this.yandexDisk = yandexDisk;
        this.dataFile = 'trail_sessions.json';
        this.backupInterval = 5 * 60 * 1000;
        this.setupAutoSave();
    }

    setupAutoSave() {
        setInterval(() => {
            this.saveAllData();
        }, this.backupInterval);
    }

    async saveAllData() {
        try {
            console.log('💾 Автосохранение данных...');
          
            // Все данные теперь берутся из SessionManager
            const data = this.sessionManager.serializeForSave();

            // Локальное сохранение
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
          
            // Сохранение в Яндекс.Диск
            if (this.yandexDisk) {
                try {
                    await this.yandexDisk.uploadFile(this.dataFile, 'sessions_backup.json');
                    console.log('✅ Данные сохранены в Яндекс.Диск');
                } catch (driveError) {
                    console.log('⚠️ Ошибка сохранения в Яндекс.Диск:', driveError.message);
                }
            }
          
            console.log('💾 Все данные сохранены локально');
        } catch (error) {
            console.log('❌ Ошибка сохранения данных:', error.message);
        }
    }

    async loadAllData() {
        try {
            console.log('🔄 Восстановление данных...');
          
            let data = null;
          
            // Пробуем загрузить из Яндекс.Диска
            if (this.yandexDisk) {
                try {
                    if (await this.yandexDisk.fileExists('backup/sessions_backup.json')) {
                        await this.yandexDisk.downloadFile('backup/sessions_backup.json', this.dataFile);
                        console.log('✅ Данные загружены из Яндекс.Диска');
                    }
                } catch (driveError) {
                    console.log('⚠️ Не удалось загрузить из Яндекс.Диска:', driveError.message);
                }
            }
          
            // Загружаем из локального файла
            if (fs.existsSync(this.dataFile)) {
                const fileContent = fs.readFileSync(this.dataFile, 'utf8');
                data = JSON.parse(fileContent);
                console.log('✅ Локальные данные загружены');
            } else {
                console.log('📝 Локальные данные не найдены, начинаем с чистого листа');
                return;
            }
          
            // Восстанавливаем все данные через SessionManager
            this.sessionManager.restoreFromData(data);
          
            console.log('🎯 Данные полностью восстановлены');
          
        } catch (error) {
            console.log('❌ Ошибка восстановления данных:', error.message);
            console.log('💫 Начинаем со свежих данных');
        }
    }

    async exportSession(chatId, format = 'json') {
        const session = this.sessionManager.trailSessions.get(chatId);
        if (!session) {
            throw new Error('Сессия не найдена');
        }
      
        const exportData = {
            session: session.getSessionSummary(),
            footprints: session.footprints,
            comparisons: session.comparisons,
            exportTime: new Date().toISOString(),
            version: '1.0'
        };
      
        const filename = `session_export_${session.sessionId}_${Date.now()}.${format}`;
      
        if (format === 'json') {
            fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
        }
      
        return filename;
    }
}

module.exports = { DataPersistence };
