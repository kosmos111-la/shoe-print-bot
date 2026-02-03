// modules/footprint/core/coordinate-system/CoordinateNormalizer.js
/**
* ВСЕ нормализации из 24 модулей
* Особенно из template-builder.js (108 раз!), simple-footprint.js, simple-matcher.js
*/

// 🔥 ИСПРАВЛЕНО: Выносим константы за пределы класса для глобальной доступности
const DEFAULT_RANGE_VALUE = { min: 0, max: 1000 };
const NORMALIZATION_METHODS = {
    MIN_MAX: 'min_max',
    Z_SCORE: 'z_score',
    UNIT: 'unit'
};

class CoordinateNormalizer {
    // 🔥 ИСПРАВЛЕНО: Используем глобальные константы
    static DEFAULT_RANGE = DEFAULT_RANGE_VALUE;
    static NORMALIZATION_METHODS = NORMALIZATION_METHODS;

    /**
     * Основной метод нормализации (из template-builder.js и других)
     * @param {Array} points - Массив точек {x, y}
     * @param {Object} options - Опции нормализации
     */
    static normalize(points, options = {}) {
        // 🔥 ИСПРАВЛЕНО: Безопасное получение всех параметров
        const method = options.method || NORMALIZATION_METHODS.MIN_MAX;
       
        // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Безопасно получаем range
        let range;
        if (options.range && typeof options.range === 'object' &&
            typeof options.range.min !== 'undefined' &&
            typeof options.range.max !== 'undefined') {
            range = options.range;
        } else {
            console.warn('[CoordinateNormalizer] Некорректный или отсутствующий range в options, использую DEFAULT_RANGE');
            range = DEFAULT_RANGE_VALUE;
        }

        const preserveAspectRatio = options.preserveAspectRatio !== false;

        console.log(`[CoordinateNormalizer] Нормализация ${points.length} точек методом ${method}, range: ${range.min}-${range.max}`);

        // Копируем для безопасности
        const normalized = points.map(p => ({ ...p }));

        switch (method) {
            case NORMALIZATION_METHODS.MIN_MAX:
                return this._normalizeMinMax(normalized, range, preserveAspectRatio);

            case NORMALIZATION_METHODS.Z_SCORE:
                return this._normalizeZScore(normalized);

            case NORMALIZATION_METHODS.UNIT:
                return this._normalizeUnit(normalized);

            default:
                console.warn(`Неизвестный метод нормализации: ${method}, использую min_max`);
                return this._normalizeMinMax(normalized, range, preserveAspectRatio);
        }
    }

    /**
     * Min-Max нормализация (из template-builder.js и distance-matrix.js)
     */
    static _normalizeMinMax(points, range, preserveAspectRatio) {
        if (points.length === 0) {
            console.warn('[CoordinateNormalizer] Пустой массив точек для нормализации');
            return points;
        }

        // 🔥 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Убеждаемся, что range валиден
        if (!range || typeof range !== 'object' ||
            typeof range.min === 'undefined' || typeof range.max === 'undefined') {
            console.error('[CoordinateNormalizer] КРИТИЧЕСКАЯ ОШИБКА: Некорректный range в _normalizeMinMax');
            console.error('Range:', range);
            console.error('Использую DEFAULT_RANGE_VALUE');
            range = DEFAULT_RANGE_VALUE;
        }

        // Находим границы
        const bounds = this._getBounds(points);
       
        // Проверяем, что границы не нулевые
        if (bounds.maxX - bounds.minX === 0 || bounds.maxY - bounds.minY === 0) {
            console.warn('[CoordinateNormalizer] Границы точек равны нулю, добавляю небольшие значения для избежания деления на ноль');
            bounds.maxX += 1;
            bounds.maxY += 1;
        }

        // Вычисляем масштабы
        const scaleX = (range.max - range.min) / (bounds.maxX - bounds.minX || 1);
        const scaleY = (range.max - range.min) / (bounds.maxY - bounds.minY || 1);

        // Сохраняем соотношение сторон если нужно
        const scale = preserveAspectRatio ? Math.min(scaleX, scaleY) : {
            x: scaleX,
            y: scaleY
        };

        // Применяем нормализацию
        points.forEach(point => {
            if (preserveAspectRatio) {
                point.x = range.min + (point.x - bounds.minX) * scale;
                point.y = range.min + (point.y - bounds.minY) * scale;
            } else {
                point.x = range.min + (point.x - bounds.minX) * scale.x;
                point.y = range.min + (point.y - bounds.minY) * scale.y;
            }
        });

        // 🔥 ПРОВЕРКА: Убеждаемся, что нормализация прошла успешно
        const checkBounds = this._getBounds(points);
        console.log(`[CoordinateNormalizer] После нормализации: x=${checkBounds.minX.toFixed(1)}-${checkBounds.maxX.toFixed(1)}, y=${checkBounds.minY.toFixed(1)}-${checkBounds.maxY.toFixed(1)}`);

        return points;
    }

    /**
     * Z-Score нормализация (из некоторых модулей сравнения)
     */
    static _normalizeZScore(points) {
        if (points.length === 0) return points;

        // Вычисляем среднее
        const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        // Вычисляем стандартное отклонение
        const stdX = Math.sqrt(
            points.reduce((sum, p) => sum + Math.pow(p.x - meanX, 2), 0) / points.length
        ) || 1;

        const stdY = Math.sqrt(
            points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0) / points.length
        ) || 1;

        // Нормализуем
        points.forEach(point => {
            point.x = (point.x - meanX) / stdX;
            point.y = (point.y - meanY) / stdY;
        });

        return points;
    }

    /**
     * Unit нормализация (к единичному диапазону)
     */
    static _normalizeUnit(points) {
        // Используем фиксированный range для unit нормализации
        return this._normalizeMinMax(points, { min: 0, max: 1 }, true);
    }

    /**
     * Получение границ точек
     */
    static _getBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }

        let minX = points[0].x;
        let maxX = points[0].x;
        let minY = points[0].y;
        let maxY = points[0].y;

        for (let i = 1; i < points.length; i++) {
            const p = points[i];
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }

        return { minX, maxX, minY, maxY };
    }

    /**
     * Алиасы для обратной совместимости (из разных модулей)
     */
    static normalizePoints(points) {
        return this.normalize(points);
    }

    static standardize(points) {
        return this.normalize(points, { method: NORMALIZATION_METHODS.Z_SCORE });
    }

    static normalizeToRange(points, min, max) {
        return this.normalize(points, {
            method: NORMALIZATION_METHODS.MIN_MAX,
            range: { min, max }
        });
    }
}

module.exports = CoordinateNormalizer;
