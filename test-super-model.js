// test-super-model.js (исправленная версия)

const HybridFootprint = require('./modules/footprint/hybrid-footprint');

console.log('🧪 ТЕСТ СОЗДАНИЯ СУПЕР-МОДЕЛИ\n');

// Создать тестовые данные - два похожих отпечатка
const points1 = [];
const points2 = [];

// Первый отпечаток
for (let i = 0; i < 25; i++) {
    points1.push({
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 100,
        confidence: 0.7 + Math.random() * 0.3 // 0.7-1.0
    });
}

// Второй отпечаток - похожий на первый, но с небольшим смещением и шумом
for (let i = 0; i < 28; i++) {
    // 80% точек похожи на первый отпечаток, 20% - новые
    if (i < 22 && i < points1.length) {
        // Похожие точки (с небольшим смещением)
        points2.push({
            x: points1[i].x + Math.random() * 15 - 7.5,
            y: points1[i].y + Math.random() * 15 - 7.5,
            confidence: 0.7 + Math.random() * 0.3
        });
    } else {
        // Новые точки
        points2.push({
            x: 100 + Math.random() * 200,
            y: 100 + Math.random() * 100,
            confidence: 0.6 + Math.random() * 0.4
        });
    }
}

console.log('📊 Тестовые данные:');
console.log(`   🟦 Отпечаток 1: ${points1.length} точек`);
console.log(`   🟥 Отпечаток 2: ${points2.length} точек`);
console.log(`   🔗 Ожидаемые совпадения: ~${Math.min(points1.length, points2.length) - 3} точек`);

// Создать два гибридных отпечатка
const footprint1 = new HybridFootprint({ name: 'Тест 1' });
const footprint2 = new HybridFootprint({ name: 'Тест 2' });

// Инициализировать отпечатки
footprint1.createFromPoints(points1);
footprint2.createFromPoints(points2);

console.log('\n🔍 Сравниваю отпечатки...');
const comparison = footprint1.compare(footprint2);

console.log(`📊 Similarity: ${comparison.similarity.toFixed(3)}`);
console.log(`🤔 Decision: ${comparison.decision}`);

if (comparison.decision === 'different') {
    console.log('❌ Отпечатки слишком разные для создания супер-модели');
    process.exit(1);
}

console.log('\n🔄 Выполняю интеллектуальное слияние...');
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
    mergeResult.mergeResult.pairs.slice(0, 3).forEach((pair, i) => {
        console.log(`   ${i+1}. Расстояние: ${pair.distance.toFixed(1)}px, Score: ${pair.similarityScore.toFixed(2)}`);
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
console.log(`├─ Трекера: ${trackerStats.totalPoints}`);
console.log(`└─ Confidence: ${superFootprint.stats.confidence.toFixed(3)}`);

// УДАЛЕНО: Блок проверки качества с ошибкой
// const qualityCheck = superFootprint.pointTracker.qualityCheck();
// console.log(`├─ Высокодостоверные точки: ${qualityCheck.highConfidencePoints.length}`);
// console.log(`├─ Средний рейтинг: ${qualityCheck.averageRating.toFixed(2)}`);
// console.log(`└─ Консистентность: ${qualityCheck.consistency.toFixed(2)}%`);

// Вместо этого добавим проверку через существующие методы:
console.log('\n🔍 ПРОВЕРКА ТОЧЕК:');
const allPoints = superFootprint.pointTracker.getAllPoints({ minRating: 0.3 });
console.log(`├─ Всего точек в трекере: ${allPoints.length}`);
console.log(`├─ Высокодостоверные (rating > 0.7): ${allPoints.filter(p => p.rating > 0.7).length}`);
console.log(`└─ Средний rating: ${(allPoints.reduce((sum, p) => sum + (p.rating || 0), 0) / allPoints.length).toFixed(2)}`);

// Создать сводку
console.log('\n============================================================');
console.log('✅ ТЕСТ ПРОЙДЕН! Супер-модель создана!');
console.log('📊 Результаты:');
console.log(`   ├─ Сокращение: ${points1.length + points2.length} → ${superFootprint.originalPoints.length} точек`);
console.log(`   ├─ Найдено совпадений: ${mergeResult.mergedPoints}`);
console.log(`   └─ Улучшение confidence: ${mergeResult.metrics.confidenceImprovement}`);
console.log('============================================================\n');

// Дополнительная информация
console.log('📈 МЕТРИКИ СЛИЯНИЯ:');
console.log(`   ├─ Средний confidence до: ${mergeResult.metrics.avgConfidenceBefore}`);
console.log(`   ├─ Средний confidence после: ${mergeResult.metrics.avgConfidenceAfter}`);
console.log(`   ├─ Сокращение точек: ${mergeResult.metrics.pointReduction}`);
console.log(`   └─ Эффективность: ${mergeResult.metrics.efficiency}`);

// Экспорт для визуализации
console.log('\n🎨 ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ:');
const exportData = {
    originalPoints1: points1.length,
    originalPoints2: points2.length,
    mergedPoints: superFootprint.originalPoints.length,
    confidenceImprovement: mergeResult.metrics.confidenceImprovement,
    efficiency: mergeResult.metrics.efficiency,
    transformation: mergeResult.transformation,
    matchPairs: mergeResult.mergeResult.stats.mergedPoints,
    // Добавим статистику по точкам
    pointStats: {
        highConfidence: allPoints.filter(p => p.rating > 0.7).length,
        mediumConfidence: allPoints.filter(p => p.rating > 0.4 && p.rating <= 0.7).length,
        lowConfidence: allPoints.filter(p => p.rating <= 0.4).length,
        averageRating: (allPoints.reduce((sum, p) => sum + (p.rating || 0), 0) / allPoints.length).toFixed(3)
    }
};

fs.writeFileSync(
    'merge_visualization.json',
    JSON.stringify(exportData, null, 2)
);

console.log('✅ Данные для визуализации сохранены: merge_visualization.json');
