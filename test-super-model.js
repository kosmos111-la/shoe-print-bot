// test-super-model.js
const HybridFootprint = require('./modules/footprint/hybrid-footprint');

async function testSuperModel() {
    console.log('🧪 ТЕСТ СОЗДАНИЯ СУПЕР-МОДЕЛИ\n');
   
    // Создать два отпечатка одного следа
    const points1 = [];
    const points2 = [];
   
    // Первый след (25 точек)
    for (let i = 0; i < 25; i++) {
        points1.push({
            x: 100 + Math.random() * 200,
            y: 100 + Math.random() * 150,
            confidence: 0.6 + Math.random() * 0.4
        });
    }
   
    // Второй след (28 точек, немного смещён)
    for (let i = 0; i < 28; i++) {
        // 70% точек те же, 30% новые
        if (i < 20 && points1[i]) {
            points2.push({
                x: points1[i].x + Math.random() * 30 - 15, // Смещение ±15px
                y: points1[i].y + Math.random() * 30 - 15,
                confidence: 0.6 + Math.random() * 0.4
            });
        } else {
            points2.push({
                x: 100 + Math.random() * 200,
                y: 100 + Math.random() * 150,
                confidence: 0.6 + Math.random() * 0.4
            });
        }
    }
   
    console.log(`📊 Тестовые данные:`);
    console.log(`   🟦 Отпечаток 1: ${points1.length} точек`);
    console.log(`   🟥 Отпечаток 2: ${points2.length} точек`);
    console.log(`   🔗 Ожидаемые совпадения: ~20 точек`);
   
    // Создать отпечатки
    const footprint1 = new HybridFootprint({ name: 'Тест 1' });
    const footprint2 = new HybridFootprint({ name: 'Тест 2' });
   
    footprint1.createFromPoints(points1);
    footprint2.createFromPoints(points2);
   
    // Сравнить
    console.log('\n🔍 Сравниваю отпечатки...');
    const comparison = footprint1.compare(footprint2);
    console.log(`📊 Similarity: ${comparison.similarity.toFixed(3)}`);
    console.log(`🤔 Decision: ${comparison.decision}`);
   
    if (comparison.decision === 'same' || comparison.similarity > 0.6) {
        console.log('\n🔄 Выполняю интеллектуальное слияние...');
       
        const mergeResult = footprint1.mergeWithTransformation(footprint2);
       
        if (mergeResult.success) {
            console.log(`\n🎉 СУПЕР-МОДЕЛЬ СОЗДАНА!`);
            console.log(`📊 РЕЗУЛЬТАТЫ:`);
            console.log(`├─ Точки: ${mergeResult.allPoints} (было ${points1.length + points2.length})`);
            console.log(`├─ Сокращение: ${mergeResult.stats.efficiency}`);
            console.log(`├─ Confidence улучшение: ${mergeResult.confidenceImprovement}`);
            console.log(`├─ Слито точек: ${mergeResult.mergedPoints}`);
            console.log(`└─ Новая уверенность: ${Math.round(mergeResult.confidence * 100)}%`);
           
            // Проверим, что PointMerger нашёл совпадения
            if (mergeResult.mergeResult?.matches?.length > 0) {
                console.log(`\n✅ PointMerger нашёл ${mergeResult.mergeResult.matches.length} совпадений!`);
               
                // Показать первые 3 совпадения
                mergeResult.mergeResult.matches.slice(0, 3).forEach((match, i) => {
                    console.log(`   ${i+1}. Расстояние: ${match.distance.toFixed(1)}px, Score: ${match.mergeScore.toFixed(2)}`);
                });
            } else {
                console.log(`\n❌ PointMerger НЕ нашёл совпадений! Нужно увеличить mergeDistance`);
            }
           
            // Сохранить супер-модель
            console.log(`\n💾 Сохраняю супер-модель...`);
            const fs = require('fs');
            const modelData = footprint1.toJSON();
            fs.writeFileSync('./super_model_test.json', JSON.stringify(modelData, null, 2));
            console.log(`✅ Супер-модель сохранена: super_model_test.json`);
           
            // Проверим структуру модели
            console.log(`\n📋 СТРУКТУРА СУПЕР-МОДЕЛИ:`);
            console.log(`├─ Точек в модели: ${footprint1.originalPoints.length}`);
            console.log(`├─ Векторов: ${footprint1.getVectorCount()}`);
            console.log(`├─ Матрица: ${footprint1.getMatrixSizeString()}`);
            console.log(`├─ Трекера: ${footprint1.pointTracker.getStats().totalPoints}`);
            console.log(`└─ Confidence: ${footprint1.stats.confidence.toFixed(3)}`);
           
            return {
                success: true,
                superModelCreated: true,
                pointsBefore: points1.length + points2.length,
                pointsAfter: footprint1.originalPoints.length,
                confidenceImprovement: mergeResult.confidenceImprovement,
                matchesFound: mergeResult.mergeResult?.matches?.length || 0
            };
        }
    }
   
    return { success: false };
}

// Запустить тест
testSuperModel().then(result => {
    console.log('\n' + '='.repeat(60));
    if (result.success) {
        console.log('✅ ТЕСТ ПРОЙДЕН! Супер-модель создана!');
        console.log(`📊 Результаты:`);
        console.log(`   ├─ Сокращение: ${result.pointsBefore} → ${result.pointsAfter} точек`);
        console.log(`   ├─ Найдено совпадений: ${result.matchesFound}`);
        console.log(`   └─ Улучшение confidence: ${result.confidenceImprovement}`);
    } else {
        console.log('❌ ТЕСТ НЕ ПРОЙДЕН');
    }
    console.log('='.repeat(60));
});
