// modules/footprint/core/log-manager.js
// 📊 УМНОЕ УПРАВЛЕНИЕ ЛОГАМИ

class LogManager {
    constructor(manager) {
        this.manager = manager;
       
        // Уровни логирования
        this.LEVELS = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3,
            TRACE: 4
        };
       
        // Конфигурация
        this.config = {
            level: this.LEVELS.INFO, // По умолчанию INFO
            enableColor: true,
            showTimestamp: true,
            maxRepeatedMessages: 3, // Максимум одинаковых сообщений
            suppressionPatterns: [
                /✅ Создана точка pt_\d+ на/,
                /🧮 Вычисляю инварианты для графа/,
                /✅ Инварианты вычислены:/
            ]
        };
       
        // Отслеживание повторяющихся сообщений
        this.messageHistory = new Map();
        this.suppressedCount = 0;
       
        console.log('📊 LogManager создан');
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД ДЛЯ ЛОГИРОВАНИЯ
    log(level, message, ...args) {
        const levelName = Object.keys(this.LEVELS).find(key => this.LEVELS[key] === level);
       
        // Проверяем уровень
        if (level > this.config.level) {
            return; // Не логируем
        }
       
        // Проверяем паттерны подавления
        if (this.shouldSuppress(message)) {
            this.suppressedCount++;
            return;
        }
       
        // Проверяем повторяющиеся сообщения
        if (this.isRepeatedMessage(message, levelName)) {
            return;
        }
       
        // Форматируем сообщение
        let formattedMessage = this.formatMessage(levelName, message);
       
        // Выводим
        switch (level) {
            case this.LEVELS.ERROR:
                console.error(formattedMessage, ...args);
                break;
            case this.LEVELS.WARN:
                console.warn(formattedMessage, ...args);
                break;
            default:
                console.log(formattedMessage, ...args);
        }
    }
   
    // 🔥 УДОБНЫЕ МЕТОДЫ
    error(message, ...args) {
        this.log(this.LEVELS.ERROR, message, ...args);
    }
   
    warn(message, ...args) {
        this.log(this.LEVELS.WARN, message, ...args);
    }
   
    info(message, ...args) {
        this.log(this.LEVELS.INFO, message, ...args);
    }
   
    debug(message, ...args) {
        this.log(this.LEVELS.DEBUG, message, ...args);
    }
   
    trace(message, ...args) {
        this.log(this.LEVELS.TRACE, message, ...args);
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    shouldSuppress(message) {
        return this.config.suppressionPatterns.some(pattern => pattern.test(message));
    }
   
    isRepeatedMessage(message, levelName) {
        const key = `${levelName}:${message}`;
        const now = Date.now();
        const history = this.messageHistory.get(key) || { count: 0, lastTime: 0 };
       
        // Сбрасываем счетчик если прошло больше 5 секунд
        if (now - history.lastTime > 5000) {
            history.count = 0;
        }
       
        history.count++;
        history.lastTime = now;
        this.messageHistory.set(key, history);
       
        // Если сообщение повторяется слишком часто
        if (history.count > this.config.maxRepeatedMessages) {
            return true;
        }
       
        return false;
    }
   
    formatMessage(levelName, message) {
        let formatted = '';
       
        if (this.config.showTimestamp) {
            const time = new Date().toLocaleTimeString('ru-RU', {
                hour12: false,
                fractionalSecondDigits: 3
            });
            formatted += `[${time}] `;
        }
       
        if (this.config.enableColor) {
            const colors = {
                ERROR: '\x1b[31m', // Красный
                WARN: '\x1b[33m',  // Желтый
                INFO: '\x1b[36m',  // Голубой
                DEBUG: '\x1b[90m', // Серый
                TRACE: '\x1b[35m'  // Фиолетовый
            };
            formatted += `${colors[levelName] || ''}[${levelName}] ${message}\x1b[0m`;
        } else {
            formatted += `[${levelName}] ${message}`;
        }
       
        return formatted;
    }
   
    // 🔥 СТАТИСТИКА
    getStats() {
        return {
            suppressedCount: this.suppressedCount,
            messageHistorySize: this.messageHistory.size,
            currentLevel: Object.keys(this.LEVELS).find(key => this.LEVELS[key] === this.config.level)
        };
    }
   
    // 🔥 ИЗМЕНЕНИЕ УРОВНЯ
    setLevel(levelName) {
        const level = this.LEVELS[levelName.toUpperCase()];
        if (level !== undefined) {
            this.config.level = level;
            console.log(`📊 Уровень логирования изменен на: ${levelName}`);
        }
    }
}

module.exports = LogManager;
