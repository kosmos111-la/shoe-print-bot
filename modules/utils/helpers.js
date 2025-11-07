// modules/utils/helpers.js

/**
* 🛠️ Вспомогательные функции
*/

class Helpers {
    /**
     * Добавляет прозрачность к описанию модели
     */
    static addModelTransparency(caption, detailsCount) {
        let transparency = '';
       
        if (detailsCount > 20) {
            transparency = '🔍 Высокая детализация';
        } else if (detailsCount > 10) {
            transparency = '📊 Средняя детализация';
        } else if (detailsCount > 5) {
            transparency = '📐 Базовая детализация';
        } else {
            transparency = '⚠️ Низкая детализация';
        }
       
        return `${caption}\n\n${transparency}`;
    }

    /**
     * Форматирует дату для отображения
     */
    static formatDate(date) {
        return new Date(date).toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * Генерирует уникальный ID
     */
    static generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Проверяет валидность URL
     */
    static isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    /**
     * Ограничивает длину текста
     */
    static truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    }

    /**
     * Создает задержку
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Безопасно парсит JSON
     */
    static safeJsonParse(str, defaultValue = {}) {
        try {
            return JSON.parse(str);
        } catch (error) {
            console.log('❌ Ошибка парсинга JSON:', error.message);
            return defaultValue;
        }
    }

    /**
     * Форматирует размер файла
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Проверяет поддержку canvas
     */
    static checkCanvasSupport() {
        try {
            const { createCanvas } = require('canvas');
            const canvas = createCanvas(1, 1);
            const ctx = canvas.getContext('2d');
            return !!(ctx && canvas);
        } catch (error) {
            return false;
        }
    }

    /**
     * Валидация изображения
     */
    static validateImage(filePath) {
        const fs = require('fs');
        const path = require('path');
       
        try {
            if (!fs.existsSync(filePath)) {
                return { valid: false, error: 'Файл не существует' };
            }
           
            const stats = fs.statSync(filePath);
            if (stats.size === 0) {
                return { valid: false, error: 'Файл пустой' };
            }
           
            if (stats.size > 10 * 1024 * 1024) { // 10MB
                return { valid: false, error: 'Файл слишком большой' };
            }
           
            const ext = path.extname(filePath).toLowerCase();
            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
           
            if (!validExtensions.includes(ext)) {
                return { valid: false, error: 'Неподдерживаемый формат' };
            }
           
            return { valid: true };
           
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }
}

module.exports = Helpers;
