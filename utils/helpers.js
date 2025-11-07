
// =============================================================================
// 🛠️ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =============================================================================

const { THRESHOLDS, MESSAGES } = require('../config/constants');

/**
* Класс с универсальными вспомогательными функциями
*/
class Helpers {

   /**
     * Добавляет "прозрачность" к подписи - метаданные анализа
     * @param {string} caption - исходная подпись
     * @param {number} predictionCount - количество предсказаний
     * @returns {string} - обработанная подпись с метаданными
     */
    static addModelTransparency(caption, predictionCount) {
        let transparentCaption = caption;
       
        // Добавляем информацию о процессе анализа
        transparentCaption += `\n\n🔍 Детализация анализа:`;
        transparentCaption += `\n• Обнаружено элементов: ${predictionCount}`;
       
        // Добавляем информацию о "прозрачности" алгоритма
        transparentCaption += `\n• Алгоритмическая прозрачность: открытая модель`;
        transparentCaption += `\n• Уровень детализации: ${predictionCount >= 10 ? 'высокий' : predictionCount >= 5 ? 'средний' : 'базовый'}`;
       
        return transparentCaption;
    }
    /**
     * Задержка выполнения (асинхронная)
     * @param {number} ms - время в миллисекундах
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Генерация уникального ID с префиксом
     * @param {string} prefix - префикс для ID
     * @returns {string} уникальный идентификатор
     */
    static generateId(prefix = '') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
    }

    /**
     * Валидация и очистка предсказаний
     * @param {Array} predictions - массив предсказаний
     * @returns {Array} очищенные предсказания
     */
    static validatePredictions(predictions) {
        if (!predictions || !Array.isArray(predictions)) {
            console.log('⚠️ Предсказания не валидны или пусты');
            return [];
        }

        const validPredictions = predictions.filter(pred => {
            // Проверяем базовую структуру
            if (!pred || typeof pred !== 'object') return false;
           
            // Проверяем наличие точек полигона
            if (!pred.points || !Array.isArray(pred.points) || pred.points.length < 3) {
                return false;
            }
           
            // Проверяем координаты точек
            const validPoints = pred.points.every(point =>
                point &&
                typeof point.x === 'number' &&
                typeof point.y === 'number' &&
                point.x >= 0 &&
                point.y >= 0
            );
           
            return validPoints;
        });

        console.log(`✅ Валидация предсказаний: ${predictions.length} → ${validPredictions.length}`);
        return validPredictions;
    }

    /**
     * Ограничение массива по максимальной длине
     * @param {Array} array - исходный массив
     * @param {number} maxLength - максимальная длина
     * @returns {Array} ограниченный массив
     */
    static limitArray(array, maxLength) {
        if (!array || !Array.isArray(array)) {
            console.log('⚠️ Передан не массив для ограничения');
            return [];
        }
       
        if (array.length <= maxLength) {
            return array;
        }
       
        console.log(`📏 Ограничение массива: ${array.length} → ${maxLength}`);
        return array.slice(0, maxLength);
    }

    /**
     * Расчет bounding box для массива точек
     * @param {Array} points - массив точек {x, y}
     * @returns {Object} bounding box
     */
    static calculateBoundingBox(points) {
        if (!points || points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, area: 0 };
        }

        try {
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
           
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const width = maxX - minX;
            const height = maxY - minY;
            const area = width * height;
           
            return {
                minX, maxX, minY, maxY,
                width, height, area,
                centerX: minX + width / 2,
                centerY: minY + height / 2
            };
        } catch (error) {
            console.error('❌ Ошибка расчета bounding box:', error);
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, area: 0 };
        }
    }

    /**
     * Нормализация числа в заданный диапазон
     * @param {number} value - исходное значение
     * @param {number} min - минимальное значение
     * @param {number} max - максимальное значение
     * @returns {number} нормализованное значение
     */
    static normalize(value, min, max) {
        if (typeof value !== 'number') return min;
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Форматирование даты в русском формате
     * @param {Date} date - объект даты
     * @returns {string} отформатированная дата
     */
    static formatDate(date) {
        if (!(date instanceof Date)) {
            date = new Date();
        }
        return date.toLocaleString('ru-RU');
    }

    /**
     * Структурированное логирование с временной меткой
     * @param {string} message - сообщение для лога
     * @param {any} data - дополнительные данные
     * @param {string} level - уровень лога (info, warn, error)
     */
    static log(message, data = null, level = 'info') {
        const timestamp = new Date().toISOString();
        const emoji = {
            info: '🔵',
            warn: '🟡',
            error: '🔴',
            success: '🟢'
        }[level] || '⚪';

        console.log(`${emoji} [${timestamp}] ${message}`);
       
        if (data !== null) {
            if (typeof data === 'object') {
                console.log('📊 Данные:', JSON.stringify(data, null, 2));
            } else {
                console.log('📊 Данные:', data);
            }
        }
    }

    /**
     * Универсальная обработка ошибок
     * @param {Error} error - объект ошибки
     * @param {string} context - контекст где произошла ошибка
     * @returns {Object} стандартизированный ответ
     */
    static handleError(error, context = '') {
        const errorId = this.generateId('error');
       
        console.error(`❌ ОШИБКА [${errorId}] в ${context}:`, error.message);
       
        if (error.stack) {
            console.error('📋 Stack trace:', error.stack);
        }

        return {
            success: false,
            error: error.message,
            errorId: errorId,
            context: context,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Успешный ответ
     * @param {any} data - данные результата
     * @param {string} message - сообщение об успехе
     * @returns {Object} стандартизированный ответ
     */
    static successResponse(data = null, message = 'Операция выполнена успешно') {
        return {
            success: true,
            message: message,
            data: data,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Проверка наличия активной сессии
     * @param {Object} session - объект сессии
     * @returns {boolean} true если сессия активна
     */
    static isSessionActive(session) {
        return session &&
               session.status === 'active' &&
               session.footprints &&
               Array.isArray(session.footprints);
    }

    /**
     * Расчет процента завершения
     * @param {number} current - текущее значение
     * @param {number} total - общее значение
     * @returns {number} процент завершения
     */
    static calculateProgress(current, total) {
        if (total === 0) return 0;
        return Math.round((current / total) * 100);
    }

    /**
     * Группировка элементов по ключу
     * @param {Array} array - исходный массив
     * @param {Function} keyFn - функция получения ключа
     * @returns {Object} сгруппированные элементы
     */
    static groupBy(array, keyFn) {
        return array.reduce((groups, item) => {
            const key = keyFn(item);
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        }, {});
    }
}

module.exports = Helpers;
