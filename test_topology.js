// test_topology.js
// 🧪 ТЕСТИРОВАНИЕ ТОПОЛОГИЧЕСКОЙ СИСТЕМЫ

const TopologicalAccumulator = require('./modules/footprint/topology/TopologicalAccumulator');

async function testTopologicalSystem() {
    console.log('🧪 ТЕСТ ТОПОЛОГИЧЕСКОЙ СИСТЕМЫ\n');
   
    // 1. Создаем аккумулятор
    const accumulator = new TopologicalAccumulator({
        name: 'Тестовая модель обуви',
        debug: true,
        similarityThreshold: 0.6,
        minMatchesForEnhancement: 3,
        wlIterations: 3
    });
   
    // 2. Создаем тестовые данные (60 точек, как у вас)
    const generateTestPoints = (count, offsetX = 0, offsetY = 0) => {
        const points = [];
        for (let i = 0; i < count; i++) {
            points.push({
                id: `test_pt_${i}`,
                x: Math.random() * 100 + offsetX,
                y: Math.random() * 100 + offsetY,
                confidence: 0.5 + Math.random() * 0.5
            });
        }
        return points;
    };
   
    // 3. Тест 1: Первый след (полный)
    console.log('📸 ТЕСТ 1: Первый след (60 точек)');
    const points1 = generateTestPoints(60, 0, 0);
   
    const result1 = await accumulator.processPoints(points1, {
        source: 'test_photo_1',
        name: 'Первое фото'
    });
   
    console.log(`📊 Результат: ${JSON.stringify(result1, null, 2)}\n`);
   
    // 4. Тест 2: Второй след (частичное совпадение + новые точки)
    console.log('📸 ТЕСТ 2: Второй след (55 совпадений + 5 новых)');
   
    // Берем 55 точек из первого + 5 новых
    const points2 = [
        ...points1.slice(0, 55).map(p => ({...p})), // Те же точки
        ...generateTestPoints(5, 150, 0) // Новые точки
    ];
   
    const result2 = await accumulator.processPoints(points2, {
        source: 'test_photo_2',
        name: 'Второе фото',
        modelId: result1.modelId
    });
   
    console.log(`📊 Результат: ${JSON.stringify(result2, null, 2)}\n`);
   
    // 5. Тест 3: Третий след (еще больше новых точек)
    console.log('📸 ТЕСТ 3: Третий след (50 совпадений + 10 новых)');
   
    const points3 = [
        ...points1.slice(0, 50).map(p => ({...p})),
        ...generateTestPoints(10, 0, 150)
    ];
   
    const result3 = await accumulator.processPoints(points3, {
        source: 'test_photo_3',
        name: 'Третье фото',
        modelId: result1.modelId
    });
   
    console.log(`📊 Результат: ${JSON.stringify(result3, null, 2)}\n`);
   
    // 6. Визуализация финальной модели
    console.log('🔷 ФИНАЛЬНАЯ МОДЕЛЬ:');
    accumulator.visualizeModel(result1.modelId, { showNodes: 10 });
   
    // 7. Статистика системы
    console.log('📈 СТАТИСТИКА СИСТЕМЫ:');
    const stats = accumulator.getStats();
    console.log(JSON.stringify(stats.system, null, 2));
   
    // 8. Экспорт модели
    const exported = accumulator.exportModel(result1.modelId);
    console.log(`\n💾 Модель экспортирована: ${exported.graph.nodes.length} узлов`);
   
    return {
        success: true,
        modelId: result1.modelId,
        totalEnhancements: result2.status === 'enhanced' ? 1 : 0 + (result3.status === 'enhanced' ? 1 : 0),
        finalNodeCount: exported.graph.nodes.length
    };
}

// Запуск теста
testTopologicalSystem().then(result => {
    console.log(`\n✅ ТЕСТ ЗАВЕРШЕН: ${result.success ? 'УСПЕХ' : 'ПРОВАЛ'}`);
    console.log(`   Модель: ${result.modelId}`);
    console.log(`   Улучшений: ${result.totalEnhancements}`);
    console.log(`   Всего узлов: ${result.finalNodeCount}`);
}).catch(error => {
    console.error(`❌ ОШИБКА ТЕСТА: ${error.message}`);
    console.error(error.stack);
});
