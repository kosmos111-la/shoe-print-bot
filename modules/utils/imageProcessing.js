// modules/utils/imageProcessing.js
const { calculateBoundingBox } = require('./geometry');
const { calculateOrientationAngle, analyzeOrientationType } = require('./orientationAnalysis');

// =============================================================================
// 🧠 УМНАЯ ПОСТОБРАБОТКА + НОРМАЛИЗАЦИЯ
// =============================================================================

function smartPostProcessing(predictions) {
    if (!predictions || predictions.length === 0) return [];
  
    console.log(`🔧 Умная постобработка: ${predictions.length} объектов`);

    const filtered = predictions.filter(pred => {
        if (!pred.points || pred.points.length < 3) return false;
        const bbox = calculateBoundingBox(pred.points);
        const area = bbox.width * bbox.height;
        return area > 100;
    });

    const optimized = filtered.map(pred => {
        if (pred.points.length <= 6) return pred;
        const optimizedPoints = simplifyPolygon(pred.points, getEpsilonForClass(pred.class));
        return {
            ...pred,
            points: optimizedPoints
        };
    });

    console.log(`✅ После постобработки: ${optimized.length} объектов`);
    return optimized;
}

function simplifyPolygon(points, epsilon = 1.0) {
    if (points.length <= 4) return points;

    function douglasPecker(points, epsilon) {
        if (points.length <= 2) return points;
        let maxDistance = 0;
        let index = 0;
        const start = points[0];
        const end = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const distance = perpendicularDistance(points[i], start, end);
            if (distance > maxDistance) {
                maxDistance = distance;
                index = i;
            }
        }

        if (maxDistance > epsilon) {
            const left = douglasPecker(points.slice(0, index + 1), epsilon);
            const right = douglasPecker(points.slice(index), epsilon);
            return left.slice(0, -1).concat(right);
        } else {
            return [start, end];
        }
    }

    function perpendicularDistance(point, lineStart, lineEnd) {
        const area = Math.abs(
            (lineEnd.x - lineStart.x) * (lineStart.y - point.y) -
            (lineStart.x - point.x) * (lineEnd.y - lineStart.y)
        );
        const lineLength = Math.sqrt(
            Math.pow(lineEnd.x - lineStart.x, 2) + Math.pow(lineEnd.y - lineStart.y, 2)
        );
        return area / lineLength;
    }

    return douglasPecker(points, epsilon);
}

function getEpsilonForClass(className) {
    switch(className) {
        case 'shoe-protector': return 1.5;
        case 'Outline-trail': return 0.8;
        case 'Heel': return 1.0;
        case 'Toe': return 1.0;
        default: return 1.2;
    }
}

/**
* Нормализует ориентацию предсказаний (поворачивает к горизонтали)
*/
function normalizeOrientation(predictions) {
    console.log('🔄 Нормализую ориентацию следов...');

    if (!predictions || predictions.length === 0) {
        return predictions;
    }

    try {
        // ИЩЕМ КОНТУР СЛЕДА ДЛЯ ОПРЕДЕЛЕНИЯ ОРИЕНТАЦИИ
        const outline = predictions.find(pred =>
            pred.class === 'Outline-trail' || pred.class.includes('Outline')
        );

        if (!outline || !outline.points) {
            console.log('⚠️ Контур не найден, ориентация не изменена');
            return predictions;
        }

        // ВЫЧИСЛЯЕМ УГОЛ ПОВОРОТА
        const angle = calculateOrientationAngle(outline.points);

        // ЕСЛИ УГОЛ МАЛЕНЬКИЙ - НЕ ПОВОРАЧИВАЕМ
        if (Math.abs(angle) < 5) {
            console.log('✅ След уже ориентирован нормально (<5°)');
            return predictions;
        }

        // ВЫЧИСЛЯЕМ ЦЕНТР КОНТУРА
        const bbox = calculateBoundingBox(outline.points);
        const center = {
            x: bbox.minX + bbox.width / 2,
            y: bbox.minY + bbox.height / 2
        };

        // ПОВОРАЧИВАЕМ ВСЕ ТОЧКИ ВСЕХ ПРЕДСКАЗАНИЙ
        const rad = -angle * (Math.PI / 180); // минус для компенсации

        const normalizedPredictions = predictions.map(pred => {
            if (!pred.points) return pred;

            return {
                ...pred,
                points: pred.points.map(point => {
                    // ПЕРЕНОСИМ В ЦЕНТР КООРДИНАТ
                    const dx = point.x - center.x;
                    const dy = point.y - center.y;

                    // ПОВОРАЧИВАЕМ
                    const newX = dx * Math.cos(rad) - dy * Math.sin(rad);
                    const newY = dx * Math.sin(rad) + dy * Math.cos(rad);

                    // ВОЗВРАЩАЕМ НА МЕСТО
                    return {
                        x: newX + center.x,
                        y: newY + center.y
                    };
                })
            };
        });

        console.log(`✅ Ориентация нормализована: поворот на ${angle.toFixed(1)}°`);
        return normalizedPredictions;

    } catch (error) {
        console.log('❌ Ошибка нормализации ориентации:', error.message);
        return predictions;
    }
}

module.exports = {
    smartPostProcessing,
    normalizeOrientation,
    simplifyPolygon,
    getEpsilonForClass
};
