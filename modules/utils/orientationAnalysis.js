// modules/utils/orientationAnalysis.js

/**
* 🧭 Анализ ориентации следов
*/

function calculateOrientationAngle(points) {
    console.log('🧭 Вычисляю угол ориентации следа...');
   
    if (!points || points.length < 3) {
        console.log('⚠️ Недостаточно точек для вычисления ориентации');
        return 0;
    }

    try {
        // 1. ВЫЧИСЛЯЕМ ЦЕНТР МАСС
        const center = points.reduce((acc, point) => {
            acc.x += point.x;
            acc.y += point.y;
            return acc;
        }, { x: 0, y: 0 });
       
        center.x /= points.length;
        center.y /= points.length;

        // 2. ВЫЧИСЛЯЕМ УГОЛ ЧЕРЕЗ МЕТОД ГЛАВНЫХ КОМПОНЕНТ
        let xx = 0, yy = 0, xy = 0;
       
        points.forEach(point => {
            const dx = point.x - center.x;
            const dy = point.y - center.y;
            xx += dx * dx;
            yy += dy * dy;
            xy += dx * dy;
        });

        // 3. ВЫЧИСЛЯЕМ УГОЛ НАКЛОНА
        const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
        const degrees = angle * (180 / Math.PI);
       
        console.log(`📐 Вычисленный угол поворота: ${degrees.toFixed(2)}°`);
        return degrees;

    } catch (error) {
        console.log('❌ Ошибка вычисления ориентации:', error.message);
        return 0;
    }
}

function analyzeOrientationType(predictions) {
    if (!predictions || predictions.length === 0) {
        return 'unknown';
    }

    try {
        const outline = predictions.find(pred =>
            pred.class === 'Outline-trail' || pred.class.includes('Outline')
        );

        if (!outline) return 'unknown';

        const angle = calculateOrientationAngle(outline.points);
       
        // 🔧 НАСТРАИВАЕМ ПОРОГИ ДЛЯ БОЛЕЕ ТОЧНОЙ КЛАССИФИКАЦИИ
        if (Math.abs(angle) < 8) return 'aligned';          // ±8° - нормально
        if (angle > 8 && angle <= 45) return 'rotated_clockwise';
        if (angle < -8 && angle >= -45) return 'rotated_counterclockwise';
        if (Math.abs(angle) > 45) return 'strongly_rotated'; // Сильный поворот
       
        return 'aligned';
       
    } catch (error) {
        return 'unknown';
    }
}

module.exports = {
    calculateOrientationAngle,
    analyzeOrientationType
};
