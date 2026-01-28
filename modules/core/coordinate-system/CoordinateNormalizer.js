// modules/core/coordinate-system/CoordinateNormalizer.js
/**
* ВСЕ нормализации из 24 модулей
* Особенно из template-builder.js (108 раз!), simple-footprint.js, simple-matcher.js
*/

class CoordinateNormalizer {
    static DEFAULT_RANGE = { min: 0, max: 1000 };
    static NORMALIZATION_METHODS = {
        MIN_MAX: 'min_max',
        Z_SCORE: 'z_score',
        UNIT: 'unit'
    };

    /**
     * Основной метод нормализации (из template-builder.js и других)
     * @param {Array} points - Массив точек {x, y}
     * @param {Object} options - Опции нормализации
     */
    static normalize(points, options = {}) {
        const defaultOptions = {
            method: this.NORMALIZATION_METHODS.MIN_MAX,
            range: this.DEFAULT_RANGE,
            preserveAspectRatio: true
        };
       
        const opts = { ...defaultOptions, ...options };
       
        console.log(`[CoordinateNormalizer] Нормализация ${points.length} точек методом ${opts.method}`);
       
        // Копируем для безопасности
        const normalized = points.map(p => ({ ...p }));
       
        switch (opts.method) {
            case this.NORMALIZATION_METHODS.MIN_MAX:
                return this._normalizeMinMax(normalized, opts.range, opts.preserveAspectRatio);
               
            case this.NORMALIZATION_METHODS.Z_SCORE:
                return this._normalizeZScore(normalized);
               
            case this.NORMALIZATION_METHODS.UNIT:
                return this._normalizeUnit(normalized);
               
            default:
                console.warn(`Неизвестный метод нормализации: ${opts.method}, использую min_max`);
                return this._normalizeMinMax(normalized, opts.range, opts.preserveAspectRatio);
        }
    }

    /**
     * Min-Max нормализация (из template-builder.js и distance-matrix.js)
     */
    static _normalizeMinMax(points, range, preserveAspectRatio) {
        if (points.length === 0) return points;
       
        // Находим границы
        const bounds = this._getBounds(points);
       
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
        return this.normalize(points, { method: this.NORMALIZATION_METHODS.Z_SCORE });
    }
   
    static normalizeToRange(points, min, max) {
        return this.normalize(points, {
            method: this.NORMALIZATION_METHODS.MIN_MAX,
            range: { min, max }
        });
    }
}

module.exports = CoordinateNormalizer;
