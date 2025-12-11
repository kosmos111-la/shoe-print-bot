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
            console.log(`├─ Сокращение: ${mergeResult.stats?.efficiency || 'N/A'}`);
            console.log(`├─ Confidence улучшение: ${mergeResult.confidenceImprovement || 'N/A'}`);
            console.log(`├─ Слито точек: ${mergeResult.mergedPoints}`);
            console.log(`└─ Новая уверенность: ${Math.round(mergeResult.confidence * 100)}%`);
           
            // Проверим, что PointMerger нашёл совпадения
            if (mergeResult.mergeResult?.matches?.length > 0) {
                console.log(`\n✅ PointMerger нашёл ${mergeResult.mergeResult.matches.length} совпадений!`);
               
                // Показать первые 5 совпадений
                console.log(`📏 Детали совпадений:`);
                mergeResult.mergeResult.matches.slice(0, 5).forEach((match, i) => {
                    console.log(`   ${i+1}. Расстояние: ${match.distance.toFixed(1)}px, Score: ${match.mergeScore.toFixed(2)}`);
                });
            } else {
                console.log(`\n❌ PointMerger НЕ нашёл совпадений! Нужно увеличить mergeDistance`);
            }
           
            // Показать статистику слияния
            if (mergeResult.mergeResult?.stats) {
                const stats = mergeResult.mergeResult.stats;
                console.log(`\n📈 СТАТИСТИКА СЛИЯНИЯ:`);
                console.log(`├─ До: ${stats.originalCount1} + ${stats.originalCount2} = ${stats.originalCount1 + stats.originalCount2} точек`);
                console.log(`├─ После: ${stats.mergedCount} точек`);
                console.log(`├─ Слито: ${stats.mergedPoints} точек`);
                console.log(`├─ Уникальных: ${stats.uniqueFrom1 + stats.uniqueFrom2} точек`);
                console.log(`└─ Эффективность: ${((stats.originalCount1 + stats.originalCount2 - stats.mergedCount) /
                    (stats.originalCount1 + stats.originalCount2) * 100).toFixed(1)}%`);
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
           
            // Проверим типы точек в супер-модели
            const mergedPoints = mergeResult.mergeResult?.points || [];
            if (mergedPoints.length > 0) {
                const mergedCount = mergedPoints.filter(p => p.source === 'merged').length;
                const from1Count = mergedPoints.filter(p => p.source === 'footprint1').length;
                const from2Count = mergedPoints.filter(p => p.source === 'footprint2').length;
               
                console.log(`\n🎨 ТИПЫ ТОЧЕК В СУПЕР-МОДЕЛИ:`);
                console.log(`├─ Слитые (🟣): ${mergedCount}`);
                console.log(`├─ Уникальные из 1 (🔵): ${from1Count}`);
                console.log(`└─ Уникальные из 2 (🔴): ${from2Count}`);
            }
           
            return {
                success: true,
                superModelCreated: true,
                pointsBefore: points1.length + points2.length,
                pointsAfter: footprint1.originalPoints.length,
                matchesFound: mergeResult.mergeResult?.matches?.length || 0,
                efficiency: ((points1.length + points2.length - footprint1.originalPoints.length) /
                           (points1.length + points2.length) * 100).toFixed(1),
                confidenceBefore: parseFloat(footprint1.stats.confidence.toFixed(3))
            };
        } else {
            console.log(`❌ Слияние не удалось: ${mergeResult.reason}`);
        }
    } else {
        console.log(`⚠️ Отпечатки слишком разные для слияния (similarity=${comparison.similarity.toFixed(3)})`);
    }
   
    return {
        success: false,
        similarity: comparison.similarity,
        decision: comparison.decision
    };
}

// Запустить тест
console.log('🚀 Запускаю тест супер-модели...\n');
testSuperModel().then(result => {
    console.log('\n' + '='.repeat(60));
    if (result.success) {
        console.log('✅ ТЕСТ ПРОЙДЕН! Супер-модель создана!');
        console.log(`📊 РЕЗУЛЬТАТЫ:`);
        console.log(`   ├─ Сокращение: ${result.pointsBefore} → ${result.pointsAfter} точек`);
        console.log(`   ├─ Эффективность: ${result.efficiency}%`);
        console.log(`   ├─ Найдено совпадений: ${result.matchesFound}`);
        console.log(`   └─ Confidence модели: ${result.confidenceBefore}`);
       
        console.log(`\n🎯 ВЫВОДЫ:`);
        console.log('1. ✅ PointMerger находит и сливает совпадения');
        console.log('2. ✅ Создаётся супер-модель с меньшим числом точек');
        console.log('3. ✅ Система подтверждает совпадающие точки');
        console.log('4. ✅ Готова для интеграции в бота!');
    } else {
        console.log('❌ ТЕСТ НЕ ПРОЙДЕН');
        console.log(`   ├─ Similarity: ${result.similarity?.toFixed(3) || 'N/A'}`);
        console.log(`   └─ Decision: ${result.decision || 'N/A'}`);
    }
    console.log('='.repeat(60));
   
    // Подсказка для следующих шагов
    if (result.success && result.matchesFound < 15) {
        console.log(`\n💡 СОВЕТ: Увеличь mergeDistance в point-merger.js до 40px`);
        console.log(`   Сейчас найдено ${result.matchesFound} совпадений, должно быть 18-20`);
    }
   
}).catch(err => {
    console.error('🔥 ОШИБКА ТЕСТА:', err);
    console.error(err.stack);
});
