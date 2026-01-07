// test-system.js
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

async function testSystem() {
    console.log('🧪 ТЕСТИРОВАНИЕ ИСПРАВЛЕННОЙ СИСТЕМЫ');
    console.log('=' .repeat(50));
   
    const manager = new SimpleFootprintManager({
        debug: true,
        autoAlignment: true,
        enableMergeVisualization: true
    });
   
    // Тест 1: Проверка PointTracker обновления
    console.log('\n1. Тестируем обновление PointTracker...');
   
    const mockAnalysis = {
        predictions: [
            {
                class: 'shoe-protector',
                confidence: 0.85,
                points: [{x: 100, y: 150}, {x: 110, y: 155}]
            },
            {
                class: 'shoe-protector',
                confidence: 0.78,
                points: [{x: 200, y: 250}, {x: 210, y: 255}]
            }
        ]
    };
   
    // Первое фото
    const result1 = await manager.addPhotoToSession(123, mockAnalysis, {
        photoId: 'test1',
        source: 'test'
    });
   
    console.log(`   📊 Результат 1: similarity=${result1.similarity}`);
    console.log(`   📈 PointTracker точек: ${manager.getSessionConfirmationStats(123)?.footprintStats?.confirmedNodes || 0}`);
   
    // Второе фото (немного сдвинутое)
    mockAnalysis.predictions.forEach(p => {
        p.points.forEach(point => {
            point.x += 5;
            point.y += 5;
        });
    });
   
    const result2 = await manager.addPhotoToSession(123, mockAnalysis, {
        photoId: 'test2',
        source: 'test'
    });
   
    console.log(`\n   📊 Результат 2: similarity=${result2.similarity}`);
    console.log(`   📈 PointTracker обновлений: ${result2.trackerResults?.updated || 0}`);
   
    // Тест 2: Проверка similarity
    console.log('\n2. Тестируем возврат similarity...');
    console.log(`   ✅ similarity присутствует: ${typeof result2.similarity === 'number'}`);
    console.log(`   ✅ decision присутствует: ${typeof result2.decision === 'string'}`);
   
    // Тест 3: Статистика системы
    console.log('\n3. Статистика системы...');
    const stats = manager.getSystemStats();
    console.log(`   📊 Активных сессий: ${stats.activeSessions}`);
    console.log(`   🏗️  Векторных моделей: ${stats.vectorModels}`);
    console.log(`   🎨 Визуализаций: ${stats.mergeVisualizations}`);
   
    console.log('\n✅ ТЕСТ ЗАВЕРШЕН');
    console.log('=' .repeat(50));
   
    return {
        success: result2.success && result2.similarity > 0,
        similarity: result2.similarity,
        pointTrackerUpdated: result2.trackerResults?.updated || 0
    };
}

// Запуск теста
testSystem().then(results => {
    console.log('\n🎯 ИТОГ ТЕСТА:');
    console.log(`   Успех: ${results.success ? '✅' : '❌'}`);
    console.log(`   Similarity: ${(results.similarity * 100).toFixed(1)}%`);
    console.log(`   Обновлений PointTracker: ${results.pointTrackerUpdated}`);
   
    if (results.success && results.pointTrackerUpdated > 0) {
        console.log('\n🎉 СИСТЕМА ИСПРАВЛЕНА И ГОТОВА К ПРОДАКШЕНУ!');
    } else {
        console.log('\n⚠️ Требуется дополнительная отладка');
    }
});
