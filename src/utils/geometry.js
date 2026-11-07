// src/utils/geometry.js
// 🔧 ЧИСТЫЕ ГЕОМЕТРИЧЕСКИЕ ФУНКЦИИ (вынесены из main.js)

/**
 * Возвращает центр контура по точкам
 */
function getContourCenter(points) {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: (Math.min(...ys) + Math.max(...ys)) / 2
    };
}

/**
* Поворачивает точки предсказаний
*/
function rotatePredictions(predictions, angle, centerX, centerY) {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    return predictions.map(pred => {
        if (!pred.points) return pred;
        
        const rotatedPoints = pred.points.map(point => ({
            x: centerX + (point.x - centerX) * cos - (point.y - centerY) * sin,
            y: centerY + (point.x - centerX) * sin + (point.y - centerY) * cos
        }));
        
        return {
            ...pred,
            points: rotatedPoints,
            originalRotation: angle,
            originalConfidence: pred.confidence
        };
    });
}

/**
* Определяет ориентацию следа и при необходимости поворачивает предсказания
*/
function normalizeFootprintOrientation(predictions) {
    // Находим все протекторы
    const protectors = predictions.filter(p => p.class === 'shoe-protector');
    if (protectors.length < 3) {
        return { predictions, rotation: 0 };
    }
    
    // Вычисляем центр масс всех протекторов
    let sumX = 0, sumY = 0;
    for (const p of protectors) {
        const center = getContourCenter(p.points);
        sumX += center.x;
        sumY += center.y;
    }
    const centerX = sumX / protectors.length;
    const centerY = sumY / protectors.length;
    
    // Находим "носок" (точка с минимальной Y) и "пятку" (точка с максимальной Y)
    let minY = Infinity, maxY = -Infinity;
    let toePoint = null, heelPoint = null;
    
    for (const p of protectors) {
        const center = getContourCenter(p.points);
        if (center.y < minY) {
            minY = center.y;
            toePoint = center;
        }
        if (center.y > maxY) {
            maxY = center.y;
            heelPoint = center;
        }
    }
    
    if (!toePoint || !heelPoint) {
        return { predictions, rotation: 0 };
    }
    
    // Вычисляем угол наклона оси след-носок
    const dx = toePoint.x - heelPoint.x;
    const dy = toePoint.y - heelPoint.y;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    // Поворачиваем так, чтобы носок был сверху, пятка снизу
    const targetAngle = -90;
    let rotationNeeded = targetAngle - angle;
    
    while (rotationNeeded > 180) rotationNeeded -= 360;
    while (rotationNeeded < -180) rotationNeeded += 360;
    
    if (Math.abs(rotationNeeded) < 10) {
        return { predictions, rotation: 0 };
    }
    
    const rotatedPredictions = rotatePredictions(predictions, rotationNeeded, centerX, centerY);
    
    console.log(`🔄 Нормализация ориентации: поворот на ${rotationNeeded.toFixed(1)}°`);
    
    return { predictions: rotatedPredictions, rotation: rotationNeeded };
}

module.exports = {
    getContourCenter,
    rotatePredictions,
    normalizeFootprintOrientation
};
