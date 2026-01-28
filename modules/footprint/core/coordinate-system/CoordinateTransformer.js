// modules/footprint/core/coordinate-system/CoordinateTransformer.js
/**
* ВСЕ трансформации координат из 30 модулей
* Консолидированная версия CoordinateDirector и других модулей
*/

class CoordinateTransformer {
    // 🔥 КОНСТАНТЫ ИЗ CoordinateDirector
    static CONSTANTS = {
        CENTER: { x: 500, y: 500 },
        ROTATION_ANGLE: 0,           // 🔥 ВСЕГДА 0°
        SCALE_FACTOR: 1000,
        CANONICAL_THRESHOLD: 0.1,    // Допустимое отклонение от 0°
        FORCE_CORRECTION: true
    };

    /**
     * Основной метод трансформации (из CoordinateDirector.enforceCanonicalSystem)
     * @param {Object} transformation - Трансформация для проверки/исправления
     * @param {string} systemName - Имя системы для логирования
     */
    static enforceCanonical(transformation, systemName = 'unknown') {
        console.log(`[CoordinateTransformer] Проверяю систему "${systemName}"`);

        if (!transformation) {
            console.log(`⚠️ Нет трансформации, создаю каноническую`);
            return this.createCanonicalTransformation();
        }

        const currentAngle = transformation.rotationAngle || 0;
        const isCanonical = this.isCanonical(transformation);

        if (isCanonical) {
            console.log(`✅ Система "${systemName}" уже в канонической системе (${currentAngle.toFixed(1)}°)`);
            return transformation;
        }

        // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ
        console.log(`🚨 НЕКАНОНИЧЕСКАЯ СИСТЕМА: ${currentAngle.toFixed(1)}° (должно быть 0°)`);
        console.log(`🔄 ИСПРАВЛЯЮ: ${systemName} → 0°`);

        return this.correctToCanonical(transformation);
    }

    /**
     * Проверка на каноничность (из CoordinateDirector.isCanonical)
     */
    static isCanonical(transformation) {
        if (!transformation) return false;

        const angle = transformation.rotationAngle || 0;
        const center = transformation.center || { x: 0, y: 0 };

        const angleOk = Math.abs(angle - this.CONSTANTS.ROTATION_ANGLE) < this.CONSTANTS.CANONICAL_THRESHOLD;
        const centerOk = Math.abs(center.x - this.CONSTANTS.CENTER.x) < 10 &&
                        Math.abs(center.y - this.CONSTANTS.CENTER.y) < 10;

        return angleOk && centerOk;
    }

    /**
     * Коррекция к канонической системе (из CoordinateDirector.correctToCanonical)
     */
    static correctToCanonical(transformation) {
        const corrected = {
            // 🔥 КОПИРУЕМ ВСЕ ПОЛЯ
            ...transformation,

            // 🔥 ГАРАНТИРУЕМ КАНОНИЧЕСКИЕ ЗНАЧЕНИЯ
            rotationAngle: this.CONSTANTS.ROTATION_ANGLE,
            center: this.CONSTANTS.CENTER,

            // 🔥 МЕТАДАННЫЕ КОРРЕКЦИИ
            _correctedByDirector: true,
            _originalAngle: transformation.rotationAngle || 0,
            _originalCenter: transformation.center || { x: 0, y: 0 },
            _correctionTimestamp: new Date(),
            _directorVersion: '2.0-consolidated'
        };

        // 🔥 ОБНОВЛЯЕМ МАТРИЦУ ТРАНСФОРМАЦИИ
        if (corrected.matrix && Array.isArray(corrected.matrix)) {
            // Единичная матрица для 0° поворота
            corrected.matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        }

        return corrected;
    }

    /**
     * Создание канонической трансформации (из CoordinateDirector.createCanonicalTransformation)
     */
    static createCanonicalTransformation() {
        return {
            rotationAngle: this.CONSTANTS.ROTATION_ANGLE,
            center: this.CONSTANTS.CENTER,
            matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            type: 'canonical',
            source: 'coordinate_transformer',
            timestamp: new Date(),
            guaranteedZero: true,
            _created: true
        };
    }

    /**
     * Общая трансформация точек (из rotation-invariance.js, simple-footprint.js и др.)
     */
static transform(points, options = {}) {
    const defaultOptions = {
        rotateTo: 0,
        centerTo: this.CONSTANTS.CENTER,
        scaleTo: 1.0
    };

    const opts = { ...defaultOptions, ...options };

    console.log(`[CoordinateTransformer] Трансформация ${points.length} точек`);

    // Копируем точки для безопасности
    const transformed = points.map(p => ({ ...p }));

    // 🔥 ИСПРАВЛЕНИЕ: вызываем статические методы через класс, не через this
    // Применяем трансформации
    if (opts.rotateTo !== 0) {
        CoordinateTransformer._rotatePoints(transformed, opts.rotateTo);
    }

    if (opts.centerTo) {
        CoordinateTransformer._centerPoints(transformed, opts.centerTo);
    }

    if (opts.scaleTo !== 1.0) {
        CoordinateTransformer._scalePoints(transformed, opts.scaleTo);
    }

    return transformed;
}

    /**
     * Вращение точек (из rotation-invariance.js)
     */
    static _rotatePoints(points, angleDegrees) {
        const angleRad = angleDegrees * Math.PI / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
       
        points.forEach(point => {
            const x = point.x * cos - point.y * sin;
            const y = point.x * sin + point.y * cos;
            point.x = x;
            point.y = y;
        });
    }

    /**
     * Центрирование точек (из alignment модулей)
     */
    static _centerPoints(points, center) {
        const currentCenter = this._calculateCenter(points);
        const dx = center.x - currentCenter.x;
        const dy = center.y - currentCenter.y;
       
        points.forEach(point => {
            point.x += dx;
            point.y += dy;
        });
    }

    /**
     * Масштабирование точек (из geometry-utils.js)
     */
    static _scalePoints(points, scale) {
        const center = this._calculateCenter(points);
       
        points.forEach(point => {
            point.x = center.x + (point.x - center.x) * scale;
            point.y = center.y + (point.y - center.y) * scale;
        });
    }

    /**
     * Вычисление центра точек
     */
    static _calculateCenter(points) {
        if (points.length === 0) return { x: 0, y: 0 };
       
        const sum = points.reduce((acc, p) => {
            acc.x += p.x;
            acc.y += p.y;
            return acc;
        }, { x: 0, y: 0 });
       
        return {
            x: sum.x / points.length,
            y: sum.y / points.length
        };
    }

    /**
     * Алиасы для обратной совместимости
     */
    static transformPoints(points) {
        return this.transform(points);
    }
   
    static applyTransformation(points, transformation) {
        if (transformation) {
            return this.transform(points, {
                rotateTo: transformation.rotationAngle || 0,
                centerTo: transformation.center || this.CONSTANTS.CENTER,
                scaleTo: transformation.scaleFactor || 1.0
            });
        }
        return points;
    }
 /**
     * Центрирование точек
     */
     static centerPoints(points, options = {}) {
        console.log('[CoordinateTransformer] Центрирование точек');
        if (!points || points.length === 0) return points;
       
        // Находим центр
        const center = this.calculateCenter(points);
       
        // Сдвигаем все точки
        return points.map(p => ({
            ...p,
            x: p.x - center.x,
            y: p.y - center.y
        }));
    }
   
    static calculateCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };
       
        const sum = points.reduce((acc, p) => ({
            x: acc.x + p.x,
            y: acc.y + p.y
        }), { x: 0, y: 0 });
       
        return {
            x: sum.x / points.length,
            y: sum.y / points.length
        };
    }
   
    static getBounds(points) {
        if (!points || points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }
       
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
       
        return { minX, maxX, minY, maxY };
    }
   
    static rotate(points, angle, center = null) {
        console.log(`[CoordinateTransformer] Вращение на ${angle}°`);
        if (!points || points.length === 0) return points;
       
        const rad = angle * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
       
        const c = center || this.calculateCenter(points);
       
        return points.map(p => {
            const dx = p.x - c.x;
            const dy = p.y - c.y;
           
            return {
                ...p,
                x: c.x + dx * cos - dy * sin,
                y: c.y + dx * sin + dy * cos
            };
        });
    }
   
    static createCanonicalTransformation() {
        return {
            rotationAngle: 0,
            center: { x: 500, y: 500 },
            scale: 1.0,
            type: 'canonical',
            timestamp: new Date()
        };
    }
   
    static isCanonical(transformation) {
        if (!transformation) return false;
        return Math.abs(transformation.rotationAngle || 0) < 0.1 &&
               Math.abs((transformation.center?.x || 0) - 500) < 10 &&
               Math.abs((transformation.center?.y || 0) - 500) < 10;
    }
   
    // Статические константы
    static CONSTANTS = {
        CENTER: { x: 500, y: 500 },
        CANONICAL_ANGLE: 0,
        DEFAULT_SCALE: 1.0
    };
}

module.exports = CoordinateTransformer;
