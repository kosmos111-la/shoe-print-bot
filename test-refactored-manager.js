// test-refactored-manager.js
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

console.log('=== КОМПЛЕКСНЫЙ ТЕСТ ОБНОВЛЁННОГО MANAGER ===\n');

async function runTests() {
    try {
        const manager = new SimpleFootprintManager();
        console.log('✅ Manager создан\n');
       
        // Тест 1: Создание тестовых данных
        console.log('1. Подготовка тестовых данных:');
        const testPoints1 = [
            {x: 100, y: 100, id: 'p1'},
            {x: 200, y: 100, id: 'p2'},
            {x: 150, y: 200, id: 'p3'}
        ];
       
        const testPoints2 = [
            {x: 110, y: 110, id: 'p1'},
            {x: 210, y: 110, id: 'p2'},
            {x: 160, y: 210, id: 'p3'}
        ];
       
        console.log(`   ✅ Тестовые точки созданы (${testPoints1.length} точек)\n`);
       
        // Тест 2: Нормализация
        console.log('2. Тест нормализации:');
        const mockFootprint = {
            id: 'test-footprint-1',
            points: testPoints1,
            getPoints: function() { return this.points; },
            updatePoints: function(newPoints) { this.points = newPoints; },
            metadata: {}
        };
       
        try {
            const normalized = await manager.normalizeFootprint(mockFootprint);
            console.log(`   ✅ Нормализация успешна`);
            console.log(`      Исходных точек: ${testPoints1.length}`);
            console.log(`      После нормализации: ${normalized.points.length}`);
            console.log(`      Метаданные: ${normalized.metadata.normalizationInfo ? 'сохранены' : 'отсутствуют'}\n`);
        } catch (error) {
            console.log(`   ❌ Ошибка нормализации: ${error.message}\n`);
        }
       
        // Тест 3: Сравнение отпечатков
        console.log('3. Тест сравнения отпечатков:');
        const footprint1 = { points: testPoints1 };
        const footprint2 = { points: testPoints2 };
       
        try {
            const comparison = await manager.compareFootprints(footprint1, footprint2);
            console.log(`   ✅ Сравнение выполнено`);
            console.log(`      Схожесть: ${(comparison.similarity * 100).toFixed(1)}%`);
            console.log(`      Схожи: ${comparison.similar ? 'ДА' : 'НЕТ'}`);
            console.log(`      Метод: ${comparison.method}\n`);
        } catch (error) {
            console.log(`   ❌ Ошибка сравнения: ${error.message}\n`);
        }
       
        // Тест 4: Координатная система
        console.log('4. Тест координатной системы:');
        try {
            const transformed = manager.coordinateSystem.transformPoints(testPoints1);
            const center = manager.coordinateSystem.calculateCenter(testPoints1);
            const bounds = manager.coordinateSystem.getBounds(testPoints1);
           
            console.log(`   ✅ Трансформация: ${transformed.length} точек`);
            console.log(`   ✅ Центр: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
            console.log(`   ✅ Границы: ${bounds.minX}-${bounds.maxX}, ${bounds.minY}-${bounds.maxY}\n`);
        } catch (error) {
            console.log(`   ❌ Ошибка координатной системы: ${error.message}\n`);
        }
       
        // Тест 5: Система выравнивания
        console.log('5. Тест системы выравнивания:');
        try {
            const aligned = manager.alignmentSystem.alignPoints(testPoints1, testPoints2);
            console.log(`   ✅ Выравнивание: ${aligned.length} точек`);
           
            const validation = manager.alignmentSystem.validateAlignment(aligned, testPoints2, 15);
            console.log(`   ✅ Валидация: ${validation.valid ? 'УСПЕШНА' : 'ОШИБКА'}`);
            if (validation.valid) {
                console.log(`      Средняя ошибка: ${validation.averageError.toFixed(2)}px\n`);
            }
        } catch (error) {
            console.log(`   ❌ Ошибка выравнивания: ${error.message}\n`);
        }
       
        console.log('=== ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ ===');
       
    } catch (error) {
        console.log(`❌ Критическая ошибка: ${error.message}`);
        console.log(error.stack);
    }
}

runTests();
