// modules/storage/dataManager.js
const fs = require('fs');
const path = require('path');

/**
* Менеджер данных для работы с файлами и статистикой
*/
class DataManager {
    /**
     * Сохранение данных в файл с созданием директорий
     */
    static saveData(filePath, data, backup = true) {
        try {
            // Создаем директорию если не существует
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Создаем бэкап если файл уже существует
            if (backup && fs.existsSync(filePath)) {
                const backupPath = filePath + '.backup';
                fs.copyFileSync(filePath, backupPath);
            }

            // Сохраняем данные
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`✅ Данные сохранены: ${filePath}`);
            return true;
        } catch (error) {
            console.error(`❌ Ошибка сохранения данных: ${error.message}`);
            return false;
        }
    }

    /**
     * Загрузка данных из файла
     */
    static loadData(filePath, defaultData = null) {
        try {
            if (!fs.existsSync(filePath)) {
                console.log(`⚠️ Файл не существует: ${filePath}`);
                return defaultData;
            }

            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`❌ Ошибка загрузки данных: ${error.message}`);
            return defaultData;
        }
    }

    /**
     * Обновление статистики пользователя
     */
    static updateUserStats(userId, username, actionType) {
        try {
            const statsPath = path.join(__dirname, '../../stats.json');
            let stats = this.loadData(statsPath, { users: {}, global: {} });

            // Инициализируем статистику пользователя
            if (!stats.users[userId]) {
                stats.users[userId] = {
                    username: username,
                    firstSeen: new Date().toISOString(),
                    lastActivity: new Date().toISOString(),
                    analysisCount: 0,
                    sessionsCount: 0,
                    modelsBuilt: 0
                };
            }

            // Обновляем статистику
            stats.users[userId].lastActivity = new Date().toISOString();
            stats.users[userId].username = username; // Обновляем имя

            switch (actionType) {
                case 'analysis':
                    stats.users[userId].analysisCount = (stats.users[userId].analysisCount || 0) + 1;
                    stats.global.totalAnalyses = (stats.global.totalAnalyses || 0) + 1;
                    break;
                case 'session_start':
                    stats.users[userId].sessionsCount = (stats.users[userId].sessionsCount || 0) + 1;
                    stats.global.totalSessions = (stats.global.totalSessions || 0) + 1;
                    break;
                case 'model_built':
                    stats.users[userId].modelsBuilt = (stats.users[userId].modelsBuilt || 0) + 1;
                    stats.global.totalModels = (stats.global.totalModels || 0) + 1;
                    break;
            }

            // Сохраняем обновленную статистику
            this.saveData(statsPath, stats);
            console.log(`📊 Статистика обновлена для пользователя ${username} (${actionType})`);
           
            return true;
        } catch (error) {
            console.error('❌ Ошибка обновления статистики:', error);
            return false;
        }
    }

    /**
     * Получение общей статистики
     */
    static getGlobalStats() {
        const statsPath = path.join(__dirname, '../../stats.json');
        const stats = this.loadData(statsPath, { users: {}, global: {} });
       
        return {
            totalUsers: Object.keys(stats.users).length,
            totalAnalyses: stats.global.totalAnalyses || 0,
            totalSessions: stats.global.totalSessions || 0,
            totalModels: stats.global.totalModels || 0,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Очистка старых данных
     */
    static cleanupOldData(maxAgeHours = 24) {
        // Здесь может быть логика очистки временных файлов
        console.log(`🧹 Очистка данных старше ${maxAgeHours} часов`);
        return true;
    }
}

module.exports = DataManager;
