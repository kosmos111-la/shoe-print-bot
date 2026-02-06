// test-clean-system.js
// 🎯 ТЕСТИРУЕМ ЧИСТУЮ СИСТЕМУ

const CleanFootprintManager = require('./modules/footprint/clean/manager');

async function testCleanSystem() {
    console.log('🧪 ТЕСТИРОВАНИЕ ЧИСТОЙ СИСТЕМЫ\n');

    // 1. Создаём менеджер
    const manager = new CleanFootprintManager({
        debug: true,
        similarityThreshold: 0.6 // 60%
    });

    // 2. Создаём тестовые точки (простой треугольник)
    const testPoints1 = [
        { x: 100, y: 100, confidence: 0.9 },
        { x: 200, y: 200, confidence: 0.8 },
        { x: 300, y: 100, confidence: 0.7 },
        { x: 150, y: 300, confidence: 0.6 },
        { x: 250, y: 250, confidence: 0.5 }
    ];

    const testPoints2 = [
        { x: 110, y: 110, confidence: 0.9 }, // Немного сдвинуто (+10)
        { x: 210, y: 210, confidence: 0.8 },
        { x: 310, y: 110, confidence: 0.7 },
        { x: 160, y: 310, confidence: 0.6 },
        { x: 260, y: 260, confidence: 0.5 }
    ];

    const testPointsDifferent = [
        { x: 500, y: 500, confidence: 0.9 },
        { x: 600, y: 600, confidence: 0.8 },
        { x: 700, y: 500, confidence: 0.7 },
        { x: 550, y: 700, confidence: 0.6 }
    ];

    // 3. Добавляем первое фото (создаст отпечаток)
    console.log('📸 ТЕСТ 1: Добавляем первое фото...');
    const result1 = await manager.addPhoto('test_user', testPoints1, {
        id: 'photo_1',
        source: 'test'
    });

    console.log('Результат:', result1);

    // 4. Добавляем второе фото (должно совпасть)
    console.log('\n📸 ТЕСТ 2: Добавляем похожее фото...');
    const result2 = await manager.addPhoto('test_user', testPoints2, {
        id: 'photo_2',
        source: 'test'
    });

    console.log('Результат:', result2);

    // 5. Добавляем третье фото (должно НЕ совпасть)
    console.log('\n📸 ТЕСТ 3: Добавляем ДРУГОЕ фото...');
    const result3 = await manager.addPhoto('test_user', testPointsDifferent, {
        id: 'photo_3',
        source: 'test'
    });

    console.log('Результат:', result3);

    // 6. Получаем статистику
    console.log('\n📊 СТАТИСТИКА СИСТЕМЫ:');
    const stats = manager.getStats();
    console.log(JSON.stringify(stats, null, 2));

    // 7. Получаем отпечаток пользователя
    const footprint = manager.getFootprint('test_user');
    if (footprint) {
        console.log('\n👣 ИНФОРМАЦИЯ ОБ ОТПЕЧАТКЕ:');
        console.log(footprint.getInfo());
       
        console.log('\n📈 ПОДТВЕРЖДЕНИЯ:');
        console.log(`Всего точек: ${footprint.originalPoints.length}`);
        console.log(`Среднее подтверждений: ${footprint.stats.avgConfirmations.toFixed(2)}`);
        console.log(`Всего фото: ${footprint.photos.length}`);
    }

    console.log('\n✅ ТЕСТ ЗАВЕРШЕН');
}

// Запускаем тест
testCleanSystem().catch(console.error);
