// test-visualization-fix.js
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

console.log('🧪 Тестирование исправления визуализации...\n');

async function testVisualization() {
    try {
        const manager = new SimpleFootprintManager({
            debug: true,
            enableMergeVisualization: true,
            enableTemplateVisualization: true
        });

        console.log('✅ Manager создан\n');

        // Тест 1: Создание первого следа
        console.log('1. Тест первого следа:');
        const mockAnalysis1 = {
            predictions: [
                {
                    class: 'shoe-protector',
                    points: [
                        { x: 100, y: 100 },
                        { x: 200, y: 200 }
                    ],
                    confidence: 0.9
                }
            ]
        };

        const result1 = await manager.addPhotoToSession(
            'test_user_1',
            mockAnalysis1,
            { photoId: 'test_photo_1' }
        );

        console.log(`   Результат 1:`, {
            success: result1.success,
            decision: result1.decision,
            vizPath: result1.vizPath,
            hasVisualization: result1.hasVisualization
        });

        // Тест 2: Создание второго следа (совпадающего)
        console.log('\n2. Тест второго следа:');
        const mockAnalysis2 = {
            predictions: [
                {
                    class: 'shoe-protector',
                    points: [
                        { x: 110, y: 110 },
                        { x: 210, y: 210 }
                    ],
                    confidence: 0.9
                }
            ]
        };

        const result2 = await manager.addPhotoToSession(
            'test_user_1',
            mockAnalysis2,
            { photoId: 'test_photo_2' }
        );

        console.log(`   Результат 2:`, {
            success: result2.success,
            similarity: result2.similarity?.toFixed(3),
            decision: result2.decision,
            vizPath: result2.vizPath,
            hasVisualization: result2.hasVisualization || result2.vizPath
        });

        // Тест 3: Проверка методов
        console.log('\n3. Проверка методов:');
       
        // Проверка compareFootprints
        const footprint1 = { points: [{x: 100, y: 100}, {x: 200, y: 200}] };
        const footprint2 = { points: [{x: 110, y: 110}, {x: 210, y: 210}] };
       
        const comparison = await manager.compareFootprints(footprint1, footprint2);
        console.log(`   compareFootprints:`, {
            similarity: comparison.similarity?.toFixed(3),
            decision: comparison.decision,
            method: comparison.method
        });

        // Проверка visualizeSingleFootprintConfirmations
        const testFootprint = manager.getActiveSession('test_user_1')?.currentFootprint;
        if (testFootprint) {
            const vizResult = await manager.visualizeSingleFootprintConfirmations(
                testFootprint,
                'test_user_1',
                { rotationAngle: 0 }
            );
            console.log(`   visualizeSingleFootprintConfirmations:`, {
                success: vizResult.success,
                path: vizResult.path,
                hasVisualization: !!vizResult.path
            });
        }

        console.log('\n✅ Все тесты завершены!');

    } catch (error) {
        console.error(`❌ Ошибка в тесте: ${error.message}`);
        console.error(error.stack);
    }
}

testVisualization();
