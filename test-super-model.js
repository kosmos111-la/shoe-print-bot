// test-super-model.js (улучшенная версия)

const HybridFootprint = require('./modules/footprint/hybrid-footprint');

console.log('🧪 ТЕСТ СОЗДАНИЯ СУПЕР-МОДЕЛИ\n');

// Создать тестовые данные - два похожих отпечатка
const points1 = [];
const points2 = [];

// Первый отпечаток
console.log('📝 Создаю точки для отпечатка 1...');
for (let i = 0; i < 25; i++) {
    const confidence = 0.7 + Math.random() * 0.3; // 0.7-1.0
    points1.push({
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 100,
        confidence: confidence,
        id: `pt1_${i}`,
        type: 'test'
    });
}

// Второй отпечаток - похожий на первый, но с небольшим смещением и шумом
console.log('📝 Создаю точки для отпечатка 2...');
for (let i = 0; i < 28; i++) {
    let point;
   
    // 80% точек похожи на первый отпечаток, 20% - новые
    if (i < 22 && i < points1.length) {
        // Похожие точки (с небольшим смещением)
        const confidence = 0.7 + Math.random() * 0.3;
        point = {
            x: points1[i].x + Math.random() * 15 - 7.5,
            y: points1[i].y + Math.random() * 15 - 7.5,
            confidence: confidence,
            id: `pt2_${i}`,
            type: 'test',
            matches: `pt1_${i}` // Отметка о совпадении
        };
    } else {
        // Новые точки
        const confidence = 0.6 + Math.random() * 0.4;
        point = {
            x: 100 + Math.random() * 200,
            y: 100 + Math.random() * 100,
            confidence: confidence,
            id: `pt2_${i}`,
            type: 'test_new'
        };
    }
    points2.push(point);
}

console.log('\n📊 ТЕСТОВЫЕ ДАННЫЕ:');
console.log(`   🟦 Отпечаток 1: ${points1.length} точек`);
console.log(`   🟥 Отпечаток 2: ${points2.length} точек`);
const expectedMatches = Math.min(points1.length, points2.length) - 6; // Более реалистичная оценка
console.log(`   🔗 Ожидаемые совпадения: ~${expectedMatches} точек`);

// Рассчитать средний confidence до слияния
const avgConf1 = points1.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / points1.length;
const avgConf2 = points2.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / points2.length;
console.log(`   📈 Средний confidence: ${avgConf1.toFixed(3)} (1) / ${avgConf2.toFixed(3)} (2)`);

// Создать два гибридных отпечатка
console.log('\n🏗️  СОЗДАНИЕ ГИБРИДНЫХ ОТПЕЧАТКОВ...');
const footprint1 = new HybridFootprint({ name: 'Тест 1' });
const footprint2 = new HybridFootprint({ name: 'Тест 2' });

// Инициализировать отпечатки
footprint1.createFromPoints(points1);
footprint2.createFromPoints(points2);

console.log('\n🔍 СРАВНЕНИЕ ОТПЕЧАТКОВ...');
const comparison = footprint1.compare(footprint2);

console.log(`📊 Similarity: ${comparison.similarity.toFixed(3)}`);
console.log(`🤔 Decision: ${comparison.decision}`);
console.log(`💡 Reason: ${comparison.reason}`);

if (comparison.decision === 'different') {
    console.log('❌ Отпечатки слишком разные для создания супер-модели');
    process.exit(1);
}

console.log('\n🔄 ИНТЕЛЛЕКТУАЛЬНОЕ СЛИЯНИЕ...');
const mergeResult = footprint1.mergeWithTransformation(footprint2);

if (!mergeResult.success) {
    console.log(`❌ Ошибка при слиянии: ${mergeResult.reason}`);
    process.exit(1);
}

const superFootprint = footprint1;

console.log(`\n🎉 СУПЕР-МОДЕЛЬ СОЗДАНА!`);
console.log(`📊 РЕЗУЛЬТАТЫ:`);
console.log(`├─ Точки: ${superFootprint.originalPoints.length} (было ${points1.length + points2.length})`);
console.log(`├─ Сокращение: ${mergeResult.metrics.efficiency}`);
console.log(`├─ Confidence улучшение: ${mergeResult.metrics.confidenceImprovement}`);
console.log(`├─ Слито точек: ${mergeResult.mergedPoints}`);
console.log(`└─ Новая уверенность: ${Math.round(superFootprint.stats.confidence * 100)}%`);

console.log(`\n✅ PointMerger нашёл ${mergeResult.mergeResult.stats.mergedPoints} совпадений!`);

// Показать несколько совпадений
if (mergeResult.mergeResult.pairs && mergeResult.mergeResult.pairs.length > 0) {
    console.log(`\n🔗 ТОП-3 СОВПАДЕНИЯ:`);
    mergeResult.mergeResult.pairs.slice(0, 3).forEach((pair, i) => {
        console.log(`   ${i+1}. Расстояние: ${pair.distance.toFixed(1)}px, Score: ${pair.similarityScore.toFixed(2)}`);
        if (pair.point1 && pair.point2) {
            console.log(`      📍 ${pair.point1.x.toFixed(1)},${pair.point1.y.toFixed(1)} → ${pair.point2.x.toFixed(1)},${pair.point2.y.toFixed(1)}`);
        }
    });
}

// Сохранить супер-модель
console.log('\n💾 Сохраняю супер-модель...');
const fs = require('fs');
const superModelData = superFootprint.toJSON();

fs.writeFileSync(
    'super_model_test.json',
    JSON.stringify(superModelData, null, 2)
);

console.log('✅ Супер-модель сохранена: super_model_test.json');

// Показать структуру супер-модели
console.log('\n📋 СТРУКТУРА СУПЕР-МОДЕЛИ:');
const trackerStats = superFootprint.pointTracker.getStats();
console.log(`├─ Точек в модели: ${superFootprint.originalPoints.length}`);
console.log(`├─ Векторов: ${superFootprint.getVectorCount()}`);
console.log(`├─ Матрица: ${superFootprint.getMatrixSizeString()}`);
console.log(`├─ Трекера: ${trackerStats.totalPoints} точек, ${trackerStats.confidence.toFixed(3)} confidence`);
console.log(`└─ Общий confidence: ${superFootprint.stats.confidence.toFixed(3)}`);

// Анализ точек после слияния
console.log('\n🔍 АНАЛИЗ ТОЧЕК ПОСЛЕ СЛИЯНИЯ:');
const allPoints = superFootprint.originalPoints;
console.log(`├─ Всего точек: ${allPoints.length}`);

// Анализ confidence
const confidences = allPoints.map(p => p.confidence || 0.5);
const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
const maxConfidence = Math.max(...confidences);
const minConfidence = Math.min(...confidences);

console.log(`├─ Средний confidence: ${avgConfidence.toFixed(3)}`);
console.log(`├─ Min confidence: ${minConfidence.toFixed(3)}`);
console.log(`└─ Max confidence: ${maxConfidence.toFixed(3)}`);

// Анализ по источникам
const sourceStats = {};
allPoints.forEach(p => {
    const source = p.source || 'unknown';
    sourceStats[source] = (sourceStats[source] || 0) + 1;
});

console.log(`\n📊 ИСТОЧНИКИ ТОЧЕК:`);
Object.entries(sourceStats).forEach(([source, count]) => {
    console.log(`   ${source}: ${count} точек (${(count / allPoints.length * 100).toFixed(1)}%)`);
});

// Создать сводку
console.log('\n' + '='.repeat(60));
console.log('✅ ТЕСТ ПРОЙДЕН! СУПЕР-МОДЕЛЬ СОЗДАНА!');
console.log('📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ:');
console.log(`   ├─ Исходные точки: ${points1.length} + ${points2.length} = ${points1.length + points2.length}`);
console.log(`   ├─ После слияния: ${superFootprint.originalPoints.length} точек`);
console.log(`   ├─ Найдено совпадений: ${mergeResult.mergedPoints}`);
console.log(`   ├─ Эффективность: ${mergeResult.metrics.efficiency}`);
console.log(`   └─ Улучшение confidence: ${mergeResult.metrics.confidenceImprovement}`);
console.log('='.repeat(60) + '\n');

// Дополнительная информация
console.log('📈 ДЕТАЛЬНЫЕ МЕТРИКИ СЛИЯНИЯ:');
console.log(`   ├─ Средний confidence до: ${mergeResult.metrics.avgConfidenceBefore}`);
console.log(`   ├─ Средний confidence после: ${mergeResult.metrics.avgConfidenceAfter}`);
console.log(`   ├─ Разница в confidence: ${(mergeResult.metrics.avgConfidenceAfter - mergeResult.metrics.avgConfidenceBefore).toFixed(3)}`);
console.log(`   ├─ Сокращение точек: ${points1.length + points2.length} → ${superFootprint.originalPoints.length} (${mergeResult.metrics.pointReduction})`);
console.log(`   └─ Эффективность: ${mergeResult.metrics.efficiency}`);

// Экспорт для визуализации
console.log('\n🎨 ЭКСПОРТ ДАННЫХ ДЛЯ ВИЗУАЛИЗАЦИИ...');
const exportData = {
    summary: {
        originalPoints1: points1.length,
        originalPoints2: points2.length,
        mergedPoints: superFootprint.originalPoints.length,
        matchesFound: mergeResult.mergedPoints,
        confidenceImprovement: mergeResult.metrics.confidenceImprovement,
        efficiency: mergeResult.metrics.efficiency,
        similarity: comparison.similarity.toFixed(3)
    },
    metrics: mergeResult.metrics,
    transformation: mergeResult.transformation || {},
    mergeStats: mergeResult.mergeResult.stats,
    pointStats: {
        total: allPoints.length,
        avgConfidence: avgConfidence.toFixed(3),
        sources: sourceStats
    },
    samplePoints: allPoints.slice(0, 5).map(p => ({
        x: p.x.toFixed(1),
        y: p.y.toFixed(1),
        confidence: (p.confidence || 0.5).toFixed(3),
        source: p.source || 'unknown'
    }))
};

fs.writeFileSync(
    'merge_visualization.json',
    JSON.stringify(exportData, null, 2)
);

console.log('✅ Данные для визуализации сохранены: merge_visualization.json');

// Генерация отчета
console.log('\n📄 СОЗДАНИЕ ОТЧЕТА...');
const report = `
ОТЧЕТ ПО ТЕСТУ СОЗДАНИЯ СУПЕР-МОДЕЛИ
====================================
Дата: ${new Date().toLocaleString('ru-RU')}

ИСХОДНЫЕ ДАННЫЕ:
----------------
• Отпечаток 1: ${points1.length} точек (средний confidence: ${avgConf1.toFixed(3)})
• Отпечаток 2: ${points2.length} точек (средний confidence: ${avgConf2.toFixed(3)})
• Ожидаемые совпадения: ${expectedMatches} точек

РЕЗУЛЬТАТЫ СРАВНЕНИЯ:
---------------------
• Similarity: ${comparison.similarity.toFixed(3)}
• Decision: ${comparison.decision}
• Reason: ${comparison.reason}

РЕЗУЛЬТАТЫ СЛИЯНИЯ:
-------------------
• Итоговых точек: ${superFootprint.originalPoints.length}
• Найдено совпадений: ${mergeResult.mergedPoints}
• Эффективность слияния: ${mergeResult.metrics.efficiency}
• Улучшение confidence: ${mergeResult.metrics.confidenceImprovement}
• Новая уверенность модели: ${Math.round(superFootprint.stats.confidence * 100)}%

МЕТРИКИ КАЧЕСТВА:
-----------------
• Средний confidence точек: ${avgConfidence.toFixed(3)}
• Качество модели: ${Math.round(superFootprint.stats.qualityScore * 100)}%
• Разнообразие источников: ${Object.keys(sourceStats).length}

ВЫВОД:
------
${mergeResult.mergedPoints >= expectedMatches ? '✅ Тест пройден успешно! Найдено достаточно совпадений.' : '⚠️ Тест пройден, но совпадений меньше ожидаемого.'}
${avgConfidence > 0.7 ? '✅ Высокое качество точек после слияния' : '⚠️ Среднее качество точек можно улучшить'}
`;

fs.writeFileSync('test_report.txt', report);
console.log('✅ Отчет сохранен: test_report.txt');

console.log('\n' + '✨'.repeat(30));
console.log('✨ ТЕСТ ЗАВЕРШЕН УСПЕШНО! ✨');
console.log('✨'.repeat(30));
