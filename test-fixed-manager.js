// test-fixed-manager.js
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

console.log('=== ИСПРАВЛЕННЫЙ ТЕСТ MANAGER ===\n');

async function runTests() {
    try {
        const manager = new SimpleFootprintManager();
        console.log('✅ Manager создан\n');

        // Тест 1: Проверка констант
        console.log('1. Проверка констант координатной системы:');
        console.log(`   • CENTER: ${JSON.stringify(manager.coordinateSystemConstants.CENTER)}`);
        console.log(`   • BOUNDS: ${JSON.stringify(manager.coordinateSystemConstants.BOUNDS)}`);
        console.log(`   • MIN_MAX: ${JSON.stringify(manager.coordinateSystemConstants.MIN_MAX || 'не определено')}\n`);

        // Тест 2: Нормализация
        console.log('2. Тест нормализации:');
        const testPoints = [
            {x: 100, y: 100, id: 'p1'},
            {x: 200, y: 100, id: 'p2'},
            {x: 150, y: 200, id: 'p3'}
        ];

        const mockFootprint = {
            id: 'test-footprint-1',
            points: testPoints,
            getPoints: function() { return this.points; },
            updatePoints: function(newPoints) { this.points = newPoints; },
            metadata: {}
        };

        try {
            const normalized = await manager.normalizeFootprint(mockFootprint);
            console.log(`   ✅ Нормализация выполнена`);
            console.log(`      Исходных точек: ${testPoints.length}`);
            console.log(`      После нормализации: ${normalized.points.length}`);
            console.log(`      Метаданные: ${normalized.metadata.normalizationInfo ? '✅ сохранены' : '❌ отсутствуют'}\n`);
        } catch (error) {
            console.log(`   ❌ Ошибка нормализации: ${error.message}\n`);
        }

        // Тест 3: Сравнение отпечатков
        console.log('3. Тест сравнения отпечатков:');
        const footprint1 = {
            points: testPoints,
            getPoints: function() { return this.points; }
        };
       
        const footprint2 = {
            points: [
                {x: 110, y: 110, id: 'p1'},
                {x: 210, y: 110, id: 'p2'},
                {x: 160, y: 210, id: 'p3'}
            ],
            getPoints: function() { return this.points; }
        };

        try {
            const comparison = await manager.compareFootprints(footprint1, footprint2);
            console.log(`   ✅ Сравнение выполнено`);
            console.log(`      Схожесть: ${(comparison.similarity * 100).toFixed(1)}%`);
            console.log(`      Схожи: ${comparison.similar ? '✅ ДА' : '❌ НЕТ'}`);
            console.log(`      Метод: ${comparison.method}`);
            console.log(`      Выравнивание: ${comparison.alignmentValid ? '✅ валидно' : '❌ невалидно'}\n`);
        } catch (error) {
            console.log(`   ❌ Ошибка сравнения: ${error.message}\n`);
        }

        // Тест 4: SessionManager
        console.log('4. Тест SessionManager:');
        try {
            const session = manager.createSession('test-user-123', 'Test Session');
            console.log(`   ✅ Сессия создана: ${session.id}`);
            console.log(`      Пользователь: ${session.userId}`);
            console.log(`      Название: ${session.name}`);
           
            const activeSession = manager.getActiveSession('test-user-123');
            console.log(`   ✅ Активная сессия получена: ${activeSession ? '✅' : '❌'}`);
           
            // Проверка saveSessionAsModel
            const saveResult = manager.saveSessionAsModel('test-user-123');
            console.log(`   ✅ Сохранение сессии: ${saveResult.success ? '✅ успешно' : '⚠️ пропущено'}\n`);
        } catch (error) {
            console.log(`   ❌ Ошибка SessionManager: ${error.message}\n`);
        }

        // Тест 5: Извлечение точек
        console.log('5. Тест извлечения точек:');
        const testObjects = [
            { points: [{x: 1, y: 1}, {x: 2, y: 2}] },
            { getPoints: () => [{x: 3, y: 3}, {x: 4, y: 4}] },
            { graph: { nodes: new Map([['n1', {x: 5, y: 5}], ['n2', {x: 6, y: 6}]]) } }
        ];

        testObjects.forEach((obj, i) => {
            const points = manager.extractPointsFromFootprint(obj);
            console.log(`   • Объект ${i+1}: ${points.length} точек`);
        });
        console.log('');

        console.log('=== ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ ===');

    } catch (error) {
        console.log(`❌ Критическая ошибка: ${error.message}`);
        console.log(error.stack);
    }
}

runTests();
