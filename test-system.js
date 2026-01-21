// test-system.js
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

// Создаем менеджер
const manager = new SimpleFootprintManager({
    debug: true,
    dbPath: './test-data'
});

// Тестовые данные для сравнения
const testAnalysis1 = {
    predictions: [
        { class: 'shoe-protector', confidence: 0.8, points: [{x: 100, y: 100}, {x: 120, y: 120}] },
        { class: 'shoe-protector', confidence: 0.7, points: [{x: 200, y: 150}, {x: 220, y: 170}] },
        { class: 'shoe-protector', confidence: 0.9, points: [{x: 150, y: 200}, {x: 170, y: 220}] }
    ]
};

const testAnalysis2 = {
    predictions: [
        { class: 'shoe-protector', confidence: 0.8, points: [{x: 105, y: 105}, {x: 125, y: 125}] },
        { class: 'shoe-protector', confidence: 0.7, points: [{x: 205, y: 155}, {x: 225, y: 175}] },
        { class: 'shoe-protector', confidence: 0.9, points: [{x: 155, y: 205}, {x: 175, y: 225}] }
    ]
};

// Тестируем
async function test() {
    console.log('\n🎯 ТЕСТ СИСТЕМЫ СРАВНЕНИЯ:');
   
    // Первое фото
    const result1 = await manager.addPhotoToSession('test_user', testAnalysis1, {
        photoId: 'photo_1',
        source: 'test'
    });
   
    console.log('\n✅ Результат 1:', result1.success ? 'Успешно' : 'Ошибка');
   
    // Второе фото (тот же след, немного смещенный)
    const result2 = await manager.addPhotoToSession('test_user', testAnalysis2, {
        photoId: 'photo_2',
        source: 'test'
    });
   
    console.log('\n✅ Результат 2:');
    console.log(`   Сходство: ${(result2.similarity * 100).toFixed(1)}%`);
    console.log(`   Решение: ${result2.decision}`);
    console.log(`   Сообщение: ${result2.message}`);
   
    // Проверяем статистику
    const stats = manager.getSystemStats();
    console.log('\n📊 Статистика системы:');
    console.log(`   Активных сессий: ${stats.activeSessions}`);
    console.log(`   Всего фото: ${stats.totalPhotosProcessed}`);
}

test().catch(console.error);
