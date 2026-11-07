// src/utils/text.js
// 🔧 ТЕКСТОВЫЕ УТИЛИТЫ (вынесены из main.js)

/**
 * Экранирует HTML-спецсимволы
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Проверяет, является ли текст координатами (формат "число число" или "число,число")
 */
function isCoordinates(text) {
    const coordRegex = /^-?\d+\.?\d*[\s,]+-?\d+\.?\d*$/;
    return coordRegex.test(text);
}

/**
 * Парсит дату из строки (поддерживает ISO и формат "дд.мм.гггг")
 */
function parseDateTime(dateString) {
    try {
        let date = new Date(dateString);
        if (isNaN(date.getTime())) {
            const parts = dateString.split('.');
            if (parts.length === 3) {
                date = new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }
        return isNaN(date.getTime()) ? null : date;
    } catch (error) {
        return null;
    }
}

/**
 * Возвращает описание типа коррекции для callback-кнопок
 */
function getCorrectionDescription(type) {
    const descriptions = {
        'animal': '🐾 След животного',
        'other_shoe': '👞 Другая обувь',
        'bounds': '📏 Неправильные границы',
        'multiple': '👣 Несколько следов',
        'not_footprint': '🚫 Не след вообще',
        'other_class': '🔍 Другой класс',
        'correct': '✅ Правильно'
    };

    return descriptions[type] || type;
}

module.exports = {
    escapeHtml,
    isCoordinates,
    parseDateTime,
    getCorrectionDescription
};
