// modules/core/coordinate-system/CoordinateNormalizer.js
/**
* ВСЕ нормализации из 24 модулей
*/
class CoordinateNormalizer {
    /**
     * Основной метод нормализации
     * @param {Array} points - Массив точек
     */
    static normalize(points) {
        // TODO: Перенести сюда ВСЮ логику нормализации
        return this._normalizePoints(points);
    }
   
    /**
     * Алиасы для обратной совместимости
     */
    static normalizePoints(points) { return this.normalize(points); }
    static standardize(points) { return this.normalize(points); }
   
    static _normalizePoints(points) {
        // Логика из:
        // - template-builder.js (108 раз!)
        // - simple-footprint.js (60 раз)
        // - simple-matcher.js (49 раз)
        console.log('Normalize called with', points.length, 'points');
        return points;
    }
}
module.exports = CoordinateNormalizer;
