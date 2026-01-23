// modules/footprint/core/coordinate-system-constants.js
// 🎯 ЕДИНЫЕ КОНСТАНТЫ ДЛЯ ВСЕЙ СИСТЕМЫ

class CoordinateSystemConstants {
    static get CENTER() {
        return { x: 500, y: 500 }; // 🔥 ЕДИНЫЙ ЦЕНТР ДЛЯ ВСЕХ
    }

    static get CANONICAL_CENTER() {
        return { x: 500, y: 500 };
    }

    static get TEMPLATE_CENTER() {
        return { x: 500, y: 500 }; // 🔥 ШАБЛОН ТОЖЕ В ЭТОЙ СИСТЕМЕ
    }

    static get BOUNDS() {
        return {
            minX: 0,
            maxX: 1000,
            minY: 0,
            maxY: 1000,
            width: 1000,
            height: 1000
        };
    }

    // 🔥 УНИФИЦИРОВАННАЯ ТРАНСФОРМАЦИЯ
    static get IDENTITY_TRANSFORMATION() {
        return {
            matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            rotationAngle: 0,
            isMirrored: false,
            center: this.CENTER,
            bounds: this.BOUNDS,
            scale: { x: 1, y: 1 },
            translation: { x: 0, y: 0 },
            type: 'canonical_identity',
            source: 'system_constants'
        };
    }

    // 🔥 ДОПОЛНИТЕЛЬНЫЕ КОНСТАНТЫ ДЛЯ ЕДИНОЙ СИСТЕМЫ
    static get SCALE_FACTOR() {
        return 1000;
    }

    static get NORMALIZED_RANGE() {
        return {
            min: 0,
            max: 1000,
            center: 500
        };
    }

    static get TEMPLATE_RANGE() {
        return {
            min: 0,
            max: 1,
            center: 0.5
        };
    }

    // 🔥 КОНВЕРСИЯ МЕЖДУ СИСТЕМАМИ
    static convertToCanonical(point) {
        return {
            x: point.x * this.SCALE_FACTOR,
            y: point.y * this.SCALE_FACTOR
        };
    }

    static convertFromCanonical(point) {
        return {
            x: point.x / this.SCALE_FACTOR,
            y: point.y / this.SCALE_FACTOR
        };
    }

    // 🔥 ВАЛИДАЦИЯ ТОЧЕК
    static isValidPoint(point) {
        return point &&
               typeof point.x === 'number' &&
               typeof point.y === 'number' &&
               !isNaN(point.x) &&
               !isNaN(point.y) &&
               isFinite(point.x) &&
               isFinite(point.y);
    }

    static normalizePoint(point) {
        if (!this.isValidPoint(point)) {
            return { x: this.CENTER.x, y: this.CENTER.y };
        }

        // Ограничиваем точку в пределах системы
        const boundedX = Math.max(this.BOUNDS.minX, Math.min(this.BOUNDS.maxX, point.x));
        const boundedY = Math.max(this.BOUNDS.minY, Math.min(this.BOUNDS.maxY, point.y));

        return {
            x: boundedX,
            y: boundedY,
            originalX: point.x,
            originalY: point.y,
            wasBounded: boundedX !== point.x || boundedY !== point.y
        };
    }

    // 🔥 РАСЧЕТ РАССТОЯНИЙ В СИСТЕМЕ
    static distance(point1, point2) {
        if (!this.isValidPoint(point1) || !this.isValidPoint(point2)) {
            return 0;
        }

        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 🔥 РАСЧЕТ ЦЕНТРА МАССИВА ТОЧЕК
    static calculateCenter(points) {
        if (!Array.isArray(points) || points.length === 0) {
            return this.CENTER;
        }

        let sumX = 0;
        let sumY = 0;
        let validPoints = 0;

        for (const point of points) {
            if (this.isValidPoint(point)) {
                sumX += point.x;
                sumY += point.y;
                validPoints++;
            }
        }

        if (validPoints === 0) {
            return this.CENTER;
        }

        return {
            x: sumX / validPoints,
            y: sumY / validPoints,
            validPoints: validPoints
        };
    }

    // 🔥 ПРЕОБРАЗОВАНИЕ К ЦЕНТРУ СИСТЕМЫ
    static centerPoint(point) {
        if (!this.isValidPoint(point)) {
            return this.CENTER;
        }

        return {
            x: point.x - this.CENTER.x,
            y: point.y - this.CENTER.y,
            centered: true
        };
    }

    // 🔥 ВОССТАНОВЛЕНИЕ ИЗ ЦЕНТРА СИСТЕМЫ
    static uncenterPoint(point) {
        if (!this.isValidPoint(point)) {
            return this.CENTER;
        }

        return {
            x: point.x + this.CENTER.x,
            y: point.y + this.CENTER.y,
            centered: false
        };
    }

    // 🔥 ГЕНЕРАЦИЯ УНИКАЛЬНОГО ID ДЛЯ ТОЧКИ
    static generatePointId(point, prefix = 'point') {
        if (!this.isValidPoint(point)) {
            return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        // Хэш на основе координат для одинаковых точек
        const xHash = Math.round(point.x * 100).toString(36);
        const yHash = Math.round(point.y * 100).toString(36);
        return `${prefix}_${xHash}_${yHash}_${Date.now().toString(36).substr(-6)}`;
    }

    // 🔥 СРАВНЕНИЕ ТОЧЕК С ДОПУСКОМ
    static arePointsEqual(point1, point2, tolerance = 0.1) {
        if (!this.isValidPoint(point1) || !this.isValidPoint(point2)) {
            return false;
        }

        const distance = this.distance(point1, point2);
        return distance <= tolerance;
    }

    // 🔥 ПОЛУЧЕНИЕ ИНФОРМАЦИИ О СИСТЕМЕ
    static getSystemInfo() {
        return {
            name: 'Единая система координат следов',
            version: '1.0',
            center: this.CENTER,
            bounds: this.BOUNDS,
            scaleFactor: this.SCALE_FACTOR,
            canonicalCenter: this.CANONICAL_CENTER,
            templateCenter: this.TEMPLATE_CENTER,
            timestamp: new Date().toISOString()
        };
    }

    // 🔥 ВАЛИДАЦИЯ ТРАНСФОРМАЦИИ
    static validateTransformation(transformation) {
        if (!transformation) {
            return this.IDENTITY_TRANSFORMATION;
        }

        // Проверяем обязательные поля
        const requiredFields = ['matrix', 'rotationAngle', 'center', 'scale'];
        for (const field of requiredFields) {
            if (transformation[field] === undefined) {
                console.log(`⚠️ Трансформация без поля ${field}, использую единичную`);
                return this.IDENTITY_TRANSFORMATION;
            }
        }

        // Проверяем матрицу
        if (!Array.isArray(transformation.matrix) || transformation.matrix.length !== 9) {
            console.log('⚠️ Некорректная матрица трансформации');
            return this.IDENTITY_TRANSFORMATION;
        }

        // Проверяем центр
        if (!this.isValidPoint(transformation.center)) {
            console.log('⚠️ Некорректный центр трансформации');
            transformation.center = this.CENTER;
        }

        return transformation;
    }

    // 🔥 СОЗДАНИЕ ТРАНСФОРМАЦИИ ИЗ ПАРАМЕТРОВ
    static createTransformation(rotationAngle = 0, scale = { x: 1, y: 1 }, translation = { x: 0, y: 0 }) {
        // Угол в радианы
        const angleRad = rotationAngle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        // Матрица трансформации
        const matrix = [
            cosA * scale.x, -sinA * scale.y, translation.x,
            sinA * scale.x, cosA * scale.y, translation.y,
            0, 0, 1
        ];

        return {
            matrix,
            rotationAngle,
            isMirrored: scale.x * scale.y < 0,
            center: this.CENTER,
            bounds: this.BOUNDS,
            scale,
            translation,
            type: 'custom',
            timestamp: new Date()
        };
    }

    // 🔥 ПРИМЕНЕНИЕ ТРАНСФОРМАЦИИ К ТОЧКЕ
    static applyTransformation(point, transformation) {
        if (!this.isValidPoint(point)) {
            return point;
        }

        const validatedTransformation = this.validateTransformation(transformation);
        const [a, b, c, d, e, f] = validatedTransformation.matrix;

        const x = point.x * a + point.y * b + c;
        const y = point.x * d + point.y * e + f;

        return {
            x,
            y,
            transformed: true,
            originalX: point.x,
            originalY: point.y,
            transformationType: validatedTransformation.type
        };
    }

    // 🔥 ОБРАТНАЯ ТРАНСФОРМАЦИЯ
    static invertTransformation(point, transformation) {
        if (!this.isValidPoint(point)) {
            return point;
        }

        const validatedTransformation = this.validateTransformation(transformation);
        const [a, b, c, d, e, f] = validatedTransformation.matrix;

        // Определитель матрицы
        const det = a * e - b * d;
       
        if (Math.abs(det) < 0.0001) {
            console.log('⚠️ Матрица трансформации вырождена, обратное преобразование невозможно');
            return point;
        }

        // Обратная матрица
        const invA = e / det;
        const invB = -b / det;
        const invD = -d / det;
        const invE = a / det;
        const invC = (b * f - c * e) / det;
        const invF = (c * d - a * f) / det;

        const x = point.x * invA + point.y * invB + invC;
        const y = point.x * invD + point.y * invE + invF;

        return {
            x,
            y,
            inverted: true,
            originalX: point.x,
            originalY: point.y,
            transformationType: validatedTransformation.type + '_inverted'
        };
    }
}

module.exports = CoordinateSystemConstants;
