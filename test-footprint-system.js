// test-footprint-system.js
const SimpleFootprint = require('./modules/footprint/simple-footprint');
const { createTestFootprints } = require('./test-realistic-footprint');

console.log('🧪 ТЕСТИРУЮ ЦИФРОВЫЕ ОТПЕЧАТКИ...\n');

// Создаём тестовые данные
const { points1, points2, points3, points4 } = createTestFootprints();

// Преобразуем точки в формат анализа
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

// 1. Создаём отпечатки
console.log('1. СОЗДАНИЕ ОТПЕЧАТКОВ:');
const fp1 = new SimpleFootprint({ name: 'Отпечаток №1', userId: 'test_user' });
const fp2 = new SimpleFootprint({ name: 'Отпечаток №2', userId: 'test_user' });
const fp3 = new SimpleFootprint({ name: 'Отпечаток №3', userId: 'test_user' });
const fp4 = new SimpleFootprint({ name: 'Отпечаток №4', userId: 'test_user' });

// 2. Добавляем анализы
console.log('\n2. ДОБАВЛЕНИЕ АНАЛИЗОВ:');
fp1.addAnalysis(createMockAnalysis(points1), { photoId: 'photo1.jpg' });
fp2.addAnalysis(createMockAnalysis(points2), { photoId: 'photo2.jpg' });
fp3.addAnalysis(createMockAnalysis(points3), { photoId: 'photo3.jpg' });
fp4.addAnalysis(createMockAnalysis(points4), { photoId: 'photo4.jpg' });

// 3. Сравниваем отпечатки
console.log('\n3. СРАВНЕНИЕ ОТПЕЧАТКОВ:');
console.log('a) Сравниваем 1 и 2 (один след, повёрнут 90°):');
const comp1 = fp1.compare(fp2);
console.log(`   Результат: ${comp1.similarity} - ${comp1.decision}`);
console.log(`   Причина: ${comp1.reason}`);

console.log('\nb) Сравниваем 1 и 3 (один след, увеличен 1.5x):');
const comp2 = fp1.compare(fp3);
console.log(`   Результат: ${comp2.similarity} - ${comp2.decision}`);
console.log(`   Причина: ${comp2.reason}`);

console.log('\nc) Сравниваем 1 и 4 (разные следы):');
const comp3 = fp1.compare(fp4);
console.log(`   Результат: ${comp3.similarity} - ${comp3.decision}`);
console.log(`   Причина: ${comp3.reason}`);

// 4. Объединяем отпечатки (если это тот же след)
console.log('\n4. ОБЪЕДИНЕНИЕ ОТПЕЧАТКОВ:');
if (comp1.decision === 'same') {
    console.log('Объединяем 1 и 2 (должно сработать):');
    const mergeResult = fp1.merge(fp2);
    console.log(`   Успех: ${mergeResult.success}`);
    console.log(`   Объединено фото: ${mergeResult.mergedPhotos}`);
}

// 5. Сохраняем и загружаем
console.log('\n5. СОХРАНЕНИЕ И ЗАГРУЗКА:');
const saved = fp1.toJSON();
console.log(`   Сохранён отпечаток с ${saved.graph.nodes.length} узлами`);

const loaded = SimpleFootprint.fromJSON(saved);
console.log(`   Загружен отпечаток "${loaded.name}"`);

// 6. Визуализация
console.log('\n6. ВИЗУАЛИЗАЦИЯ РЕЗУЛЬТАТОВ:');
fp1.visualize();

console.log('\n✅ ТЕСТ ЦИФРОВЫХ ОТПЕЧАТКОВ ЗАВЕРШЁН!');
