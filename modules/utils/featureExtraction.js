// modules/utils/featureExtraction.js
const { calculateBoundingBox } = require('./geometry');

// =============================================================================
// 📊 УЛУЧШЕННОЕ ИЗВЛЕЧЕНИЕ FEATURES (С ПЛОТНОСТЬЮ)
// =============================================================================

function extractFeatures(predictions) {
    console.log(`📊 Извлекаем улучшенные features из ${predictions.length} предсказаний`);

    const features = {
        detailCount: predictions.length,
        hasOutline: false,
        largeDetails: 0,
        density: 1,  // гарантируем значение по умолчанию
        spatialSpread: 0
    };

    // ЗАЩИТА ОТ ПУСТЫХ ДАННЫХ
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
                x: bbox.minX + bbox.width / 2,  // ИСПРАВЛЕНО: было bbox.x
                y: bbox.minY + bbox.height / 2  // ИСПРАВЛЕНО: было bbox.y
            });
        }
    });

    // Рассчитываем плотность деталей (защита от деления на ноль)
    if (centers.length > 0 && totalArea > 0) {
        features.density = centers.length / (totalArea / 1000); // деталей на 1000px²
    }

    console.log('📊 Улучшенные features:', features);
    return features;
}

module.exports = { extractFeatures };
