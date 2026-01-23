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
}

module.exports = CoordinateSystemConstants;
