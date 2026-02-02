// modules/footprint/core/coordinate-system/CoordinateValidator.js
/**
* Упрощённый валидатор для новой системы координат
* (Замена старому TransformationValidator)
*/
class CoordinateValidator {
    static validatePoints(points) {
        if (!Array.isArray(points)) {
            return { valid: false, error: 'Points must be an array' };
        }
       
        const validPoints = points.filter(p =>
            p && typeof p.x === 'number' && typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y)
        );
       
        return {
            valid: validPoints.length === points.length,
            total: points.length,
            validCount: validPoints.length,
            invalidCount: points.length - validPoints.length
        };
    }
   
    static validateTransformation(transformation) {
        if (!transformation) {
            return { valid: false, error: 'Transformation is null' };
        }
       
        const required = ['rotationAngle', 'center', 'matrix'];
        const missing = required.filter(field => !(field in transformation));
       
        if (missing.length > 0) {
            return { valid: false, error: `Missing fields: ${missing.join(', ')}` };
        }
       
        // Проверяем матрицу
        if (!Array.isArray(transformation.matrix) || transformation.matrix.length !== 9) {
            return { valid: false, error: 'Matrix must be 9-element array' };
        }
       
        // Проверяем центр
        const center = transformation.center;
        if (!center || typeof center.x !== 'number' || typeof center.y !== 'number') {
            return { valid: false, error: 'Invalid center' };
        }
       
        return { valid: true, transformation };
    }
   
    static compareTransformations(t1, t2, tolerance = 0.1) {
        const result = {
            consistent: true,
            differences: []
        };
       
        // Сравнение углов
        const angleDiff = Math.abs((t1.rotationAngle || 0) - (t2.rotationAngle || 0));
        if (angleDiff > tolerance * 10) { // 10x tolerance для углов
            result.consistent = false;
            result.differences.push(`Rotation: ${angleDiff.toFixed(2)}° difference`);
        }
       
        // Сравнение центров
        const dx = (t1.center?.x || 0) - (t2.center?.x || 0);
        const dy = (t1.center?.y || 0) - (t2.center?.y || 0);
        const centerDist = Math.sqrt(dx * dx + dy * dy);
        if (centerDist > tolerance * 100) { // 100x tolerance для координат
            result.consistent = false;
            result.differences.push(`Center: ${centerDist.toFixed(2)}px distance`);
        }
       
        return result;
    }
}

module.exports = CoordinateValidator;
