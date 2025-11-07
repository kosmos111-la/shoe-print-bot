// modules/analysis/perspectiveAnalyzer.js

function analyzePerspectiveDistortion(predictions, imageWidth, imageHeight) {
    console.log('📐 Анализирую перспективные искажения...');
  
    const analysis = {
        hasPerspectiveIssues: false,
        confidence: 'high',
        issues: [],
        recommendations: []
    };

    try {
        if (!predictions || predictions.length === 0) {
            analysis.confidence = 'low';
            return analysis;
        }

        // Ищем контур для анализа
        const outline = predictions.find(pred =>
            pred.class === 'Outline-trail' || pred.class.includes('Outline')
        );

        if (!outline || !outline.points) {
            analysis.confidence = 'medium';
            analysis.issues.push('контур_не_найден');
            return analysis;
        }

        const points = outline.points;
      
        // 1. Анализ соотношения сторон
        const bbox = calculateBoundingBox(points);
        const aspectRatio = bbox.width / bbox.height;
      
        if (aspectRatio < 0.3 || aspectRatio > 3.0) {
            analysis.hasPerspectiveIssues = true;
            analysis.issues.push('неестественное_соотношение_сторон');
            analysis.recommendations.push('снимать под прямым углом к следу');
        }

        // 2. Анализ размера относительно кадра
        const frameRatio = (bbox.width * bbox.height) / (imageWidth * imageHeight);
        if (frameRatio < 0.1) {
            analysis.issues.push('след_слишком_мал');
            analysis.recommendations.push('приблизьте камеру к следу');
        } else if (frameRatio > 0.8) {
            analysis.issues.push('след_занимает_весь_кадр');
            analysis.recommendations.push('немного отдалите камеру');
        }

        console.log('📐 Результат анализа перспективы:', {
            issues: analysis.issues.length,
            hasProblems: analysis.hasPerspectiveIssues
        });

        return analysis;

    } catch (error) {
        console.log('❌ Ошибка анализа перспективы:', error.message);
        analysis.confidence = 'low';
        return analysis;
    }
}

function calculateOrientationAngle(points) {
    console.log('🧭 Вычисляю угол ориентации следа...');
  
    if (!points || points.length < 3) {
        console.log('⚠️ Недостаточно точек для вычисления ориентации');
        return 0;
    }

    try {
        // 1. Вычисляем центр масс
        const center = points.reduce((acc, point) => {
            acc.x += point.x;
            acc.y += point.y;
            return acc;
        }, { x: 0, y: 0 });
      
        center.x /= points.length;
        center.y /= points.length;

        // 2. Вычисляем угол через метод главных компонент
        let xx = 0, yy = 0, xy = 0;
      
        points.forEach(point => {
            const dx = point.x - center.x;
            const dy = point.y - center.y;
            xx += dx * dx;
            yy += dy * dy;
            xy += dx * dy;
        });

        // 3. Вычисляем угол наклона
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
      
        // Настраиваем пороги для более точной классификации
        if (Math.abs(angle) < 8) return 'aligned';          // ±8° - нормально
        if (angle > 8 && angle <= 45) return 'rotated_clockwise';
        if (angle < -8 && angle >= -45) return 'rotated_counterclockwise';
        if (Math.abs(angle) > 45) return 'strongly_rotated';
      
        return 'aligned';
      
    } catch (error) {
        return 'unknown';
    }
}

function calculateBoundingBox(points) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
    };
}

module.exports = {
    analyzePerspectiveDistortion,
    calculateOrientationAngle,
    analyzeOrientationType
};
