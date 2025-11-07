// modules/utils/comparison.js

/**
* 🎯 Утилиты для сравнения следов
*/

const { calculateBoundingBox } = require('./geometry');

/**
* Сравнивает два отпечатка
*/
function compareFootprints(referenceFeatures, footprintFeatures) {
    console.log('🔍 УЛУЧШЕННОЕ СРАВНЕНИЕ: эталон vs след');
   
    // ЗАЩИТА ОТ NaN - гарантируем числовые значения
    const refDetails = Math.max(referenceFeatures.detailCount || 0, 1);
    const footprintDetails = Math.max(footprintFeatures.detailCount || 0, 1);

    const scores = {
        patternSimilarity: 0,    // Схожесть узора (40%)
        spatialDistribution: 0,  // Пространственное распределение (30%)
        detailMatching: 0,       // Совпадение деталей (20%)
        shapeConsistency: 0,     // Соответствие форм (10%)
        overallScore: 0
    };

    // 1. Схожесть узора (40%) - сравниваем распределение деталей
    const countRatio = Math.min(refDetails, footprintDetails) / Math.max(refDetails, footprintDetails);
    scores.patternSimilarity = Math.round(countRatio * 25);
   
    // Бонус за достаточное количество деталей
    if (refDetails > 10 && footprintDetails > 10) {
        scores.patternSimilarity += 15;
    }
    scores.patternSimilarity = Math.min(scores.patternSimilarity, 40);

    // 2. Пространственное распределение (30%)
    const refDensity = referenceFeatures.density || 1;
    const footprintDensity = footprintFeatures.density || 1;
    const densitySimilarity = 1 - Math.abs(refDensity - footprintDensity) / Math.max(refDensity, footprintDensity);
    scores.spatialDistribution = Math.round(densitySimilarity * 30);

    // 3. Совпадение деталей (20%)
    const commonDetails = Math.min(refDetails, footprintDetails);
    const maxDetails = Math.max(refDetails, footprintDetails);
    scores.detailMatching = Math.round((commonDetails / maxDetails) * 20);

    // 4. Соответствие форм (10%) - базовый score
    scores.shapeConsistency = 8;
    if (referenceFeatures.hasOutline && footprintFeatures.hasOutline) {
        scores.shapeConsistency += 2;
    }

    // ОБЩИЙ СЧЕТ (гарантируем число)
    scores.overallScore = Math.min(
        scores.patternSimilarity + scores.spatialDistribution + scores.detailMatching + scores.shapeConsistency,
        100
    );

    console.log('📊 Улучшенные результаты:', scores);
    return scores;
}

/**
* Зеркальное сравнение (левый/правый)
*/
function compareWithMirror(referenceFeatures, footprintFeatures, footprintPredictions = []) {
    // Обычное сравнение
    const normalScore = compareFootprints(referenceFeatures, footprintFeatures);
   
    // Зеркальное сравнение (для левый/правый)
    const mirroredFeatures = mirrorFootprint(footprintFeatures);
    const mirroredScore = compareFootprints(referenceFeatures, mirroredFeatures);
   
    // Возвращаем лучший результат
    const bestScore = Math.max(normalScore.overallScore, mirroredScore.overallScore);
   
    console.log(`🔄 Сравнение: обычный=${normalScore.overallScore}%, зеркальный=${mirroredScore.overallScore}%`);
   
    return {
        ...normalScore,
        overallScore: bestScore,
        mirrorUsed: bestScore !== normalScore.overallScore
    };
}

/**
* Зеркалирование features
*/
function mirrorFootprint(footprintFeatures) {
    return {
        ...footprintFeatures,
        density: footprintFeatures.density,
        spatialSpread: -footprintFeatures.spatialSpread
    };
}

module.exports = {
    compareFootprints,
    compareWithMirror,
    mirrorFootprint
};
```

1.2 Создаем модуль geometry

Создаем файл: /modules/utils/geometry.js

```javascript
// modules/utils/geometry.js

/**
* 🎯 Геометрические утилиты
*/

/**
* Вычисляет bounding box для точек
*/
function calculateBoundingBox(points) {
    if (!points || points.length === 0) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    }
   
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

/**
* Вычисляет общий bounding box для предсказаний
*/
function calculateOverallBoundingBox(predictions) {
    if (!predictions || predictions.length === 0) {
        return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    }
   
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
   
    predictions.forEach(pred => {
        if (pred.points && pred.points.length > 0) {
            pred.points.forEach(point => {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            });
        }
    });
   
    return {
        minX, minY, maxX, maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}

module.exports = {
    calculateBoundingBox,
    calculateOverallBoundingBox
};
