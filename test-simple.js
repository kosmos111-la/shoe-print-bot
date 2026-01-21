// test-simple.js - ТЕСТ БЕЗ ВИЗУАЛИЗАЦИЙ
const path = require('path');

// Создаем мок для merge-visualizer
const mergeVisualizerMock = {
    visualizeClusters: () => Promise.resolve({ path: null, stats: {} }),
    visualizeTwoFootprintComparison: () => Promise.resolve({})
};

// Подменяем merge-visualizer
require.cache[path.join(__dirname, 'modules/footprint/merge-visualizer.js')] = {
    exports: mergeVisualizerMock
};

// Теперь импортируем наш менеджер
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

async function runSimpleTest() {
    console.log('🎯 ПРОСТОЙ ТЕСТ СИСТЕМЫ (без визуализаций)\n');
   
    const manager = new SimpleFootprintManager({
        debug: true,
        dbPath: './test-data-simple',
        enableMergeVisualization: false, // 🔥 ВАЖНО: отключаем визуализацию
        enableTemplateVisualization: false,
        usePointTracker: true
    });
   
    // Тестовые данные - ПРОСТОЙ СЛЕД
    const createSimpleAnalysis = (points) => ({
        predictions: points.map((p, i) => ({
            class: 'shoe-protector',
            confidence: 0.8,
            points: [
                { x: p.x - 10, y: p.y - 10 },
                { x: p.x + 10, y: p.y - 10 },
                { x: p.x + 10, y: p.y + 10 },
                { x: p.x - 10, y: p.y + 10 }
            ]
        }))
    });
   
    // СЛЕД 1: Три точки треугольником
    const analysis1 = createSimpleAnalysis([
        { x: 100, y: 100 },
        { x: 200, y: 150 },
        { x: 150, y: 200 }
    ]);
   
    // СЛЕД 2: Почти те же точки (смещение +5)
    const analysis2 = createSimpleAnalysis([
        { x: 105, y: 105 },
        { x: 205, y: 155 },
        { x: 155, y: 205 }
    ]);
   
    // СЛЕД 3: Совсем другие точки
    const analysis3 = createSimpleAnalysis([
        { x: 300, y: 300 },
        { x: 400, y: 400 },
        { x: 350, y: 450 }
    ]);
   
    console.log('📸 ТЕСТ 1: Первое фото');
    try {
        const result1 = await manager.addPhotoToSession('test_simple', analysis1, {
            photoId: 'simple_1',
            source: 'test'
        });
       
        console.log(`✅ ${result1.success ? 'УСПЕХ' : 'ОШИБКА'}:`);
        console.log(`   Точек: ${result1.nodesAdded || 0}`);
        console.log(`   Сессия: ${result1.isNewSession ? 'новая' : 'существующая'}`);
        console.log(`   Решение: ${result1.decision || '-'}`);
    } catch (error) {
        console.log(`❌ ОШИБКА: ${error.message}`);
    }
   
    console.log('\n📸 ТЕСТ 2: Второе фото (тот же след)');
    try {
        const result2 = await manager.addPhotoToSession('test_simple', analysis2, {
            photoId: 'simple_2',
            source: 'test'
        });
       
        console.log(`✅ ${result2.success ? 'УСПЕХ' : 'ОШИБКА'}:`);
        console.log(`   Сходство: ${((result2.similarity || 0) * 100).toFixed(1)}%`);
        console.log(`   Решение: ${result2.decision || '-'}`);
        console.log(`   Обновлено точек: ${result2.pointsUpdated || 0}`);
       
        // 🔥 ПРОВЕРКА: не должно быть 100% при 0 обновлений
        if (result2.similarity === 1.0 && result2.pointsUpdated === 0) {
            console.log(`⚠️  ВНИМАНИЕ: 100% сходства при 0 обновлений!`);
        }
    } catch (error) {
        console.log(`❌ ОШИБКА: ${error.message}`);
    }
   
    console.log('\n📸 ТЕСТ 3: Третье фото (другой след)');
    try {
        const result3 = await manager.addPhotoToSession('test_simple', analysis3, {
            photoId: 'simple_3',
            source: 'test'
        });
       
        console.log(`✅ ${result3.success ? 'УСПЕХ' : 'ОШИБКА'}:`);
        console.log(`   Сходство: ${((result3.similarity || 0) * 100).toFixed(1)}%`);
        console.log(`   Решение: ${result3.decision || '-'}`);
        console.log(`   Новая модель: ${result3.isNewModel ? 'ДА' : 'НЕТ'}`);
    } catch (error) {
        console.log(`❌ ОШИБКА: ${error.message}`);
    }
   
    console.log('\n📊 ИТОГОВАЯ ПРОВЕРКА:');
   
    // Проверяем статистику
    const stats = manager.getSystemStats();
    console.log(`   Обработано фото: ${stats.totalPhotosProcessed || 0}`);
   
    // Проверяем шаблон
    const templateInfo = manager.getVectorSuperModelInfo('test_simple');
    console.log(`   Шаблон: ${templateInfo.exists ? 'создан' : 'нет'}`);
    if (templateInfo.exists) {
        console.log(`   Ячеек в шаблоне: ${templateInfo.cellsCount}`);
    }
   
    console.log('\n🎉 ТЕСТ ЗАВЕРШЕН!');
}

runSimpleTest().catch(error => {
    console.error('💥 КРИТИЧЕСКАЯ ОШИБКА:', error.message);
    if (error.stack) {
        console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
});
