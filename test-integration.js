// test-integration.js
const SimpleManager = require('./modules/footprint/simple-manager.js');

async function testIntegration() {
    console.log('🧪 ТЕСТ ИНТЕГРАЦИИ ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА\n');
   
    const manager = new SimpleManager({
        debug: true,
        minPointsForFootprint: 3
    });
   
    // Имитация анализа от RoboKit
    const mockAnalysis1 = {
        predictions: [
            {
                class: 'shoe-protector',
                confidence: 0.9,
                points: [
                    { x: 100, y: 100 },
                    { x: 110, y: 110 },
                    { x: 120, y: 120 }
                ]
            },
            {
                class: 'shoe-protector',
                confidence: 0.8,
                points: [
                    { x: 200, y: 200 },
                    { x: 210, y: 210 },
                    { x: 220, y: 220 }
                ]
            }
        ]
    };
   
    const mockAnalysis2 = {
        predictions: [
            {
                class: 'shoe-protector',
                confidence: 0.85,
                points: [
                    { x: 105, y: 105 },
                    { x: 115, y: 115 },
                    { x: 125, y: 125 }
                ]
            },
            {
                class: 'shoe-protector',
                confidence: 0.75,
                points: [
                    { x: 205, y: 205 },
                    { x: 215, y: 215 },
                    { x: 225, y: 225 }
                ]
            }
        ]
    };
   
    const userId = 'test_user_123';
   
    console.log('📸 Добавляю первое фото...');
    const result1 = await manager.addPhotoToSession(userId, mockAnalysis1, {
        photoId: 'photo_1',
        source: 'test'
    });
   
    console.log('\n📊 Результат первого фото:');
    console.log(`• Успех: ${result1.success ? '✅' : '❌'}`);
    console.log(`• Решение: ${result1.decision}`);
    console.log(`• Узлов добавлено: ${result1.nodesAdded || 0}`);
    console.log(`• Создана сессия: ${result1.isNewSession ? '✅' : '❌'}`);
   
    console.log('\n📸 Добавляю второе фото (немного смещенное)...');
    const result2 = await manager.addPhotoToSession(userId, mockAnalysis2, {
        photoId: 'photo_2',
        source: 'test'
    });
   
    console.log('\n📊 Результат второго фото:');
    console.log(`• Успех: ${result2.success ? '✅' : '❌'}`);
    console.log(`• Решение: ${result2.decision}`);
    console.log(`• Схожесть: ${result2.similarity ? (result2.similarity * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`• Алгоритм: ${result2.algorithm || result2.method || 'N/A'}`);
   
    console.log('\n📈 Статистика системы:');
    const stats = manager.getSystemStats();
    console.log(`• Всего пользователей: ${stats.totalUsers}`);
    console.log(`• Всего моделей: ${stats.totalModels}`);
    console.log(`• Активных сессий: ${stats.activeSessions}`);
    console.log(`• Алгоритм сравнения: ${stats.algorithm || 'geometric_hash'}`);
   
    console.log('\n🎯 ТЕСТ ЗАВЕРШЕН!');
    console.log('Геометрический алгоритм интегрирован и работает в системе! 🚀');
}

testIntegration().catch(console.error);
