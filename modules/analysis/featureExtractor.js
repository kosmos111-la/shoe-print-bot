// modules/analysis/featureExtractor.js

function extractFeatures(predictions) {
    console.log(`📊 Извлекаем улучшенные features из ${predictions.length} предсказаний`);
  
    const features = {
        detailCount: predictions.length,
        hasOutline: false,
        largeDetails: 0,
        density: 1,
        spatialSpread: 0,
        patternType: 'unknown'
    };

    // Защита от пустых данных
    if (!predictions || predictions.length === 0) {
        return features;
    }

    let totalArea = 0;
    const centers = [];

    predictions.forEach(pred => {
        if (pred.class && pred.class.includes('Outline')) {
            features.hasOutline = true;
        }

        // Считаем площадь и центры для анализа распределения
        if (pred.points && pred.points.length > 3) {
            const bbox = calculateBoundingBox(pred.points);
            const area = bbox.width * bbox.height;
            totalArea += area;
          
            if (area > 1000) {
                features.largeDetails++;
            }

            // Сохраняем центры для анализа распределения
            centers.push({
                x: bbox.minX + bbox.width / 2,
                y: bbox.minY + bbox.height / 2
            });
        }
    });

    // Рассчитываем плотность деталей
    if (centers.length > 0 && totalArea > 0) {
        features.density = centers.length / (totalArea / 1000); // деталей на 1000px²
    }

    // Рассчитываем пространственное распределение
    if (centers.length > 1) {
        features.spatialSpread = calculateSpatialSpread(centers);
    }

    console.log('📊 Улучшенные features:', features);
    return features;
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

function calculateSpatialSpread(centers) {
    if (centers.length < 2) return 0;
   
    let totalDistance = 0;
    let count = 0;
   
    for (let i = 0; i < centers.length; i++) {
        for (let j = i + 1; j < centers.length; j++) {
            const distance = Math.sqrt(
                Math.pow(centers[i].x - centers[j].x, 2) +
                Math.pow(centers[i].y - centers[j].y, 2)
            );
            totalDistance += distance;
            count++;
        }
    }
   
    return count > 0 ? totalDistance / count : 0;
}

module.exports = { extractFeatures };
