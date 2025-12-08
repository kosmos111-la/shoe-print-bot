// test-manager-system.js
const SimpleFootprintManager = require('./modules/footprint/simple-manager');
const { createTestFootprints } = require('./test-realistic-footprint');

console.log('🧪 ТЕСТИРУЮ МЕНЕДЖЕР СИСТЕМЫ...\n');

// Создаём тестовые данные
const { points1, points2, points3, points4 } = createTestFootprints();

// Создаём мок-анализы
function createMockAnalysis(points) {
    return {
        predictions: points.map((point, index) => ({
            class: 'shoe-protector',
            confidence: point.confidence,
            points: [
                { x: point.x - 5, y: point.y - 5 },
                { x: point.x + 5, y: point.y - 5 },
                { x: point.x + 5, y: point.y + 5 },
                { x: point.x - 5, y: point.y + 5 }
            ]
        }))
    };
}

// Создаём менеджер
const manager = new SimpleFootprintManager({
    dbPath: './data/test-footprints',
    autoAlignment: true,
    autoSave: true,
    debug: true
});

// Тестируем...
async function runTests() {
    console.log('1. СОЗДАНИЕ СЕССИИ И ДОБАВЛЕНИЕ ФОТО:');
    console.log('='.repeat(50));
   
    const userId = 'test_user_123';
   
    // Создать сессию
    const session = manager.createSession(userId, 'Тестовая сессия');
    console.log(`✅ Создана сессия: "${session.name}" (ID: ${session.id})`);
   
    // Добавить первое фото
    console.log('\n📸 Добавляю первое фото...');
    const result1 = await manager.addPhotoToSession(userId, createMockAnalysis(points1), {
        photoId: 'photo1.jpg',
        description: 'Первое фото тестового следа'
    });
   
    console.log(`   Узлов добавлено: ${result1.nodesAdded}`);
    console.log(`   Всего узлов: ${result1.totalNodes}`);
    console.log(`   Автосовмещение: ${result1.alignment ? 'выполнено' : 'не выполнено'}`);
   
    // Добавить второе фото (тот же след, повёрнутый)
    console.log('\n📸 Добавляю второе фото (тот же след, повёрнутый 90°)...');
    const result2 = await manager.addPhotoToSession(userId, createMockAnalysis(points2), {
        photoId: 'photo2.jpg',
        description: 'Второе фото - повёрнутый след'
    });
   
    console.log(`   Узлов добавлено: ${result2.nodesAdded}`);
    console.log(`   Всего узлов: ${result2.totalNodes}`);
   
    if (result2.alignment) {
        console.log(`   Автосовмещение: ${result2.alignment.decision}`);
        console.log(`   Схожесть: ${result2.alignment.similarity}`);
        console.log(`   Результат: ${result2.alignment.success ? '✅ Объединено' : '❌ Не объединено'}`);
    }
   
    // Добавить третье фото (другой след)
    console.log('\n📸 Добавляю третье фото (другой след)...');
    const result3 = await manager.addPhotoToSession(userId, createMockAnalysis(points4), {
        photoId: 'photo3.jpg',
        description: 'Третье фото - другой след'
    });
   
    console.log(`   Узлов добавлено: ${result3.nodesAdded}`);
    console.log(`   Всего узлов: ${result3.totalNodes}`);
   
    if (result3.alignment) {
        console.log(`   Автосовмещение: ${result3.alignment.decision}`);
        console.log(`   Схожесть: ${result3.alignment.similarity}`);
        console.log(`   Причина: ${result3.alignment.reason}`);
    }
   
    console.log('\n2. СОХРАНЕНИЕ СЕССИИ КАК МОДЕЛЬ:');
    console.log('='.repeat(50));
   
    const saveResult = manager.saveSessionAsModel(userId, 'Моя тестовая модель');
   
    if (saveResult.success) {
        console.log(`✅ Модель сохранена!`);
        console.log(`   ID: ${saveResult.modelId}`);
        console.log(`   Имя: ${saveResult.modelName}`);
        console.log(`   Узлов: ${saveResult.modelStats.nodes}`);
        console.log(`   Рёбер: ${saveResult.modelStats.edges}`);
        console.log(`   Уверенность: ${Math.round(saveResult.modelStats.confidence * 100)}%`);
        console.log(`   Фото в сессии: ${saveResult.sessionInfo.photos}`);
    } else {
        console.log(`❌ Ошибка сохранения: ${saveResult.error}`);
    }
   
    console.log('\n3. РАБОТА С МОДЕЛЯМИ:');
    console.log('='.repeat(50));
   
    // Получить модели пользователя
    const userModels = manager.getUserModels(userId);
    console.log(`📚 Моделей у пользователя ${userId}: ${userModels.length}`);
   
    if (userModels.length > 0) {
        const model = userModels[0];
        console.log(`   Модель: ${model.name}`);
        console.log(`   Узлов: ${model.graph.nodes.size}`);
        console.log(`   Рёбер: ${model.graph.edges.size}`);
        console.log(`   Фото: ${model.metadata.totalPhotos}`);
        console.log(`   Создана: ${model.metadata.created.toLocaleString('ru-RU')}`);
       
        // Поиск похожих моделей
        console.log('\n🔎 Ищу похожие модели...');
        const similarResult = manager.findSimilarModels(model, userId, { maxResults: 3 });
       
        if (similarResult.success) {
            console.log(`   Найдено похожих: ${similarResult.similarCount}`);
           
            similarResult.similarModels.forEach((similar, index) => {
                console.log(`   ${index + 1}. "${similar.model.name}":`);
                console.log(`      Схожесть: ${similar.similarity.toFixed(3)}`);
                console.log(`      Решение: ${similar.decision}`);
            });
        }
    }
   
    console.log('\n4. СТАТИСТИКА СИСТЕМЫ:');
    console.log('='.repeat(50));
   
    const stats = manager.getSystemStats();
    console.log(`📊 Статистика системы:`);
    console.log(`   • Запущена: ${stats.system.started}`);
    console.log(`   • Аптайм: ${stats.system.uptime} сек`);
    console.log(`   • Всего моделей: ${stats.storage.totalModels}`);
    console.log(`   • Пользователей: ${stats.storage.totalUsers}`);
    console.log(`   • Активных сессий: ${stats.storage.activeSessions}`);
    console.log(`   • Всего сравнений: ${stats.performance.totalComparisons}`);
    console.log(`   • Успешных автосовмещений: ${stats.performance.successfulAlignments}`);
   
    console.log('\n5. ОЧИСТКА:');
    console.log('='.repeat(50));
   
    // Удалить тестовую папку
    const fs = require('fs');
    const path = require('path');
    const testDbPath = './data/test-footprints';
   
    if (fs.existsSync(testDbPath)) {
        fs.rmSync(testDbPath, { recursive: true, force: true });
        console.log(`🧹 Удалена тестовая папка: ${testDbPath}`);
    }
   
    console.log('\n✅ ТЕСТ МЕНЕДЖЕРА ЗАВЕРШЁН!\n');
}

// Запустить тесты
runTests().catch(console.error);
