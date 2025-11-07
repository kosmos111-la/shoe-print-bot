// modules/utils/perspectiveAnalysis.js

/**
* 📐 Анализ перспективных искажений
*/

const { calculateBoundingBox } = require('./geometry');

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

        // ИЩЕМ КОНТУР ДЛЯ АНАЛИЗА
        const outline = predictions.find(pred =>
            pred.class === 'Outline-trail' || pred.class.includes('Outline')
        );

        if (!outline || !outline.points) {
            analysis.confidence = 'medium';
            analysis.issues.push('контур_не_найден');
            return analysis;
        }

        const points = outline.points;
       
        // 1. АНАЛИЗ СООТНОШЕНИЯ СТОРОН
        const bbox = calculateBoundingBox(points);
        const aspectRatio = bbox.width / bbox.height;
       
        if (aspectRatio < 0.3 || aspectRatio > 3.0) {
            analysis.hasPerspectiveIssues = true;
            analysis.issues.push('неестественное_соотношение_сторон');
            analysis.recommendations.push('снимать под прямым углом к следу');
        }

        // 2. АНАЛИЗ РАЗМЕРА ОТНОСИТЕЛЬНО КАДРА
        const frameRatio = (bbox.width * bbox.height) / (imageWidth * imageHeight);
        if (frameRatio < 0.1) {
            analysis.issues.push('след_слишком_мал');
            analysis.recommendations.push('приблизьте камеру к следу');
        } else if (frameRatio > 0.8) {
            analysis.issues.push('след_занимает_весь_кадр');
            analysis.recommendations.push('немного отдалите камеру');
        }

        console.log(`📐 Результат анализа перспективы:`, {
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

module.exports = {
    analyzePerspectiveDistortion
};
