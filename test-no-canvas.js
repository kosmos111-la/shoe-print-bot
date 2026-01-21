// test-no-canvas.js - Тестирование без Canvas
const path = require('path');

// Отключаем модули визуализации
process.env.TEST_MODE = 'no_canvas';

// Мокаем Canvas
class MockCanvas {
    constructor() {
        this.getContext = () => new MockContext();
    }
}

class MockContext {
    fillRect() {}
    beginPath() {}
    arc() {}
    fill() {}
    stroke() {}
    fillText() {}
    save() {}
    restore() {}
    translate() {}
    rotate() {}
    scale() {}
}

// Подменяем canvas
try {
    require.cache[require.resolve('canvas')] = {
        exports: { createCanvas: () => new MockCanvas() }
    };
} catch (e) {}

// Теперь импортируем наш менеджер
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

async function runTest() {
    console.log('🎯 ТЕСТ СИСТЕМЫ БЕЗ CANVAS\n');
   
    const manager = new SimpleFootprintManager({
        debug: true,
        dbPath: './test-data',
        enableMergeVisualization: false, // 🔥 ОТКЛЮЧАЕМ ВИЗУАЛИЗАЦИЮ
        enableTemplateVisualization: false
    });
   
    // Тестовые данные - СЛЕД 1
    const analysis1 = {
        predictions: [
            {
                class: 'shoe-protector',
                confidence: 0.85,
                points: [
                    {x: 100, y: 100}, {x: 120, y: 100},
                    {x: 120, y: 120}, {x: 100, y: 120}
                ]
            },
            {
                class: 'shoe-protector',
                confidence: 0.78,
                points: [
                    {x: 200, y: 150}, {x: 220, y: 150},
                    {x: 220, y: 170}, {x: 200, y: 170}
                ]
            },
            {
                class: 'shoe-protector',
                confidence: 0.92,
                points: [
                    {x: 150, y: 200}, {x: 170, y: 200},
                    {x: 170, y: 220}, {x: 150, y: 220}
                ]
            }
        ]
    };
   
    // Тестовые данные - СЛЕД 2 (тот же, немного смещен)
    const analysis2 = {
        predictions: [
            {
                class: 'shoe-protector',
                confidence: 0.83,
                points: [
                    {x: 105, y: 105}, {x: 125, y: 105},
                    {x: 125, y: 125}, {x: 105, y: 125}
                ]
            },
            {
                class: 'shoe-protector',
                confidence: 0.76,
                points: [
                    {x: 205, y: 155}, {x: 225, y: 155},
                    {x: 225, y: 175}, {x: 205, y: 175}
                ]
            },
            {
                class: 'shoe-protector',
                confidence: 0.90,
                points: [
                    {x: 155, y: 205}, {x: 175, y: 205},
                    {x: 175, y: 225}, {x: 155, y: 225}
                ]
            }
        ]
    };
   
    // Тестовые данные - ДРУГОЙ СЛЕД
    const analysis3 = {
        predictions: [
            {
                class: 'shoe-protector',
                confidence: 0.88,
                points: [
                    {x: 300, y: 300}, {x: 330, y: 300},
                    {x: 330, y: 330}, {x: 300, y: 330}
                ]
            },
            {
                class: 'shoe-protector',
                confidence: 0.72,
                points: [
                    {x: 400, y: 400}, {x: 430, y: 400},
                    {x: 430, y: 430}, {x: 400, y: 430}
                ]
            }
        ]
    };
   
    console.log('📸 ТЕСТ 1: Первое фото (создание отпечатка)');
    const result1 = await manager.addPhotoToSession('test_user_1', analysis1, {
        photoId: 'test_photo_1',
        source: 'test'
    });
   
    console.log(`✅ Результат: ${result1.success ? 'УСПЕХ' : 'ОШИБКА'}`);
    console.log(`   Точек добавлено: ${result1.nodesAdded || 0}`);
    console.log(`   Решение: ${result1.decision || 'N/A'}`);
    console.log(`   Новая сессия: ${result1.isNewSession ? 'ДА' : 'НЕТ'}`);
   
    console.log('\n📸 ТЕСТ 2: Второе фото (тот же след)');
    const result2 = await manager.addPhotoToSession('test_user_1', analysis2, {
        photoId: 'test_photo_2',
        source: 'test'
    });
   
    console.log(`✅ Результат: ${result2.success ? 'УСПЕХ' : 'ОШИБКА'}`);
    console.log(`   Сходство: ${((result2.similarity || 0) * 100).toFixed(1)}%`);
    console.log(`   Решение: ${result2.decision || 'N/A'}`);
    console.log(`   Точек обновлено: ${result2.pointsUpdated || 0}`);
   
    console.log('\n📸 ТЕСТ 3: Третье фото (другой след)');
    const result3 = await manager.addPhotoToSession('test_user_1', analysis3, {
        photoId: 'test_photo_3',
        source: 'test'
    });
   
    console.log(`✅ Результат: ${result3.success ? 'УСПЕХ' : 'ОШИБКА'}`);
    console.log(`   Сходство: ${((result3.similarity || 0) * 100).toFixed(1)}%`);
    console.log(`   Решение: ${result3.decision || 'N/A'}`);
    console.log(`   Новая модель: ${result3.isNewModel ? 'ДА' : 'НЕТ'}`);
   
    console.log('\n📊 ФИНАЛЬНАЯ СТАТИСТИКА:');
    const stats = manager.getSystemStats();
    console.log(`   Всего пользователей: ${stats.totalUsers}`);
    console.log(`   Всего моделей: ${stats.totalModels}`);
    console.log(`   Обработано фото: ${stats.totalPhotosProcessed}`);
    console.log(`   Активных сессий: ${stats.activeSessions}`);
   
    console.log('\n🎯 ПРОВЕРКА ИСПРАВЛЕНИЙ:');
    console.log(`   [${result2.decision === 'same' ? '✅' : '❌'}] Тест 2: "same" при высокой схожести`);
    console.log(`   [${result3.decision === 'different' ? '✅' : '❌'}] Тест 3: "different" при низкой схожести`);
    console.log(`   [${stats.totalPhotosProcessed === 3 ? '✅' : '❌'}] Все 3 фото обработаны`);
   
    // Проверяем, нет ли 100% при 0 реальных совпадений
    const hasFalse100Percent = result2.similarity === 1.0 && result2.pointsUpdated === 0;
    console.log(`   [${!hasFalse100Percent ? '✅' : '❌'}] Нет ложных 100% совпадений`);
   
    console.log('\n🎉 ТЕСТ ЗАВЕРШЕН!');
}

runTest().catch(error => {
    console.error('❌ Ошибка теста:', error.message);
    console.error(error.stack);
});
