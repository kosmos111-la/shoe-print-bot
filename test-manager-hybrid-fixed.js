// test-manager-hybrid-fixed.js
// 🧪 ТЕСТ МЕНЕДЖЕРА С ГИБРИДНЫМ АЛГОРИТМОМ (ИСПРАВЛЕННЫЙ)

const CleanFootprintManager = require('./modules/footprint/clean/manager');

// Простой генератор случайных чисел с seed
class SeededRandom {
    constructor(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }
   
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
}

// Генератор реалистичных центров деталей
function generateCenters(count = 70, seed = 1) {
    const centers = [];
    const radius = 200;
    const random = new SeededRandom(seed);
   
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI;
        const variation = 0.3 + random.next() * 0.4;
       
        centers.push({
            x: 500 + radius * variation * Math.cos(angle) + (random.next() - 0.5) * 40,
            y: 500 + radius * variation * Math.sin(angle) + (random.next() - 0.5) * 40,
            confidence: 0.8 + random.next() * 0.2
            // 🔥 НЕ добавляем originalId - как в реальных данных!
        });
    }
   
    return centers;
}

async function testManagerWithHybridAlgorithm() {
    console.log('🧪 ТЕСТ МЕНЕДЖЕРА С ГИБРИДНЫМ АЛГОРИТМОМ\n');
   
    // 1. Создаём менеджер
    const manager = new CleanFootprintManager({
        debug: true,
        similarityThreshold: 0.6,
        minPoints: 20
    });
   
    console.log('1. 📸 ТЕСТ 1: Добавляем первый след (75 точек)');
    console.log('='.repeat(60));
   
    const trace1 = generateCenters(75, 1);
    console.log(`   Сгенерировано ${trace1.length} точек`);
    console.log(`   Пример точки: x=${trace1[0].x.toFixed(1)}, y=${trace1[0].y.toFixed(1)}`);
   
    const result1 = await manager.addPhoto('test_user_hybrid', trace1, {
        id: 'photo_1',
        source: 'robokit',
        note: 'Первый след'
    });
   
    console.log('   Результат:', result1.message);
    console.log('   Ожидается: Создан новый отпечаток');
   
    console.log('\n2. 📸 ТЕСТ 2: Добавляем тот же след (повернутый на 45°)');
    console.log('='.repeat(60));
   
    // Тот же след, но повернутый и с другим порядком точек
    const rotatedTrace = trace1.map((point, i) => {
        const angle = 45 * Math.PI / 180;
        const dx = point.x - 500;
        const dy = point.y - 500;
        const random = new SeededRandom(i + 1000); // Разный seed для шума
       
        return {
            x: 500 + dx * Math.cos(angle) - dy * Math.sin(angle) + (random.next() - 0.5) * 20,
            y: 500 + dx * Math.sin(angle) + dy * Math.cos(angle) + (random.next() - 0.5) * 20,
            confidence: point.confidence
            // 🔥 НЕТ originalId - как в реальных данных!
        };
    });
   
    // Перемешиваем точки
    for (let i = rotatedTrace.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rotatedTrace[i], rotatedTrace[j]] = [rotatedTrace[j], rotatedTrace[i]];
    }
   
    console.log(`   Повернутый след: ${rotatedTrace.length} точек`);
    console.log(`   Порядок точек изменен, ID точек отсутствуют`);
   
    const result2 = await manager.addPhoto('test_user_hybrid', rotatedTrace, {
        id: 'photo_2',
        source: 'robokit',
        note: 'Тот же след, повернутый на 45°'
    });
   
    console.log('   Результат:', result2.message);
    console.log('   Схожесть:', result2.similarity ? `${(result2.similarity * 100).toFixed(1)}%` : 'N/A');
    console.log('   Ожидается: СОВПАДЕНИЕ (геометрия та же, повернутая)');
   
    console.log('\n3. 📸 ТЕСТ 3: Добавляем частичный след (50% точек)');
    console.log('='.repeat(60));
   
    // Берем каждую вторую точку
    const partialTrace = [];
    for (let i = 0; i < trace1.length; i += 2) {
        const point = trace1[i];
        const random = new SeededRandom(i + 2000);
       
        partialTrace.push({
            x: point.x + (random.next() - 0.5) * 30,
            y: point.y + (random.next() - 0.5) * 30,
            confidence: point.confidence
        });
    }
   
    console.log(`   Частичный след: ${partialTrace.length} точек (из ${trace1.length})`);
   
    const result3 = await manager.addPhoto('test_user_hybrid', partialTrace, {
        id: 'photo_3',
        source: 'robokit',
        note: 'Частичный след (50% точек)'
    });
   
    console.log('   Результат:', result3.message);
    console.log('   Схожесть:', result3.similarity ? `${(result3.similarity * 100).toFixed(1)}%` : 'N/A');
    console.log('   Ожидается: СОВПАДЕНИЕ (большая часть точек совпадает)');
   
    console.log('\n4. 📸 ТЕСТ 4: Добавляем совершенно другой след');
    console.log('='.repeat(60));
   
    const differentTrace = generateCenters(80, 999); // Совсем другая seed
    console.log(`   Другой след: ${differentTrace.length} точек`);
    console.log(`   Совсем другая геометрия`);
   
    const result4 = await manager.addPhoto('test_user_hybrid', differentTrace, {
        id: 'photo_4',
        source: 'robokit',
        note: 'Совсем другой след'
    });
   
    console.log('   Результат:', result4.message);
    console.log('   Схожесть:', result4.similarity ? `${(result4.similarity * 100).toFixed(1)}%` : 'N/A');
    console.log('   Ожидается: НОВЫЙ ОТПЕЧАТОК (разная геометрия)');
   
    console.log('\n5. 📊 СТАТИСТИКА И АНАЛИЗ');
    console.log('='.repeat(60));
   
    const footprint = manager.getFootprint('test_user_hybrid');
    if (footprint) {
        console.log(`👣 Активный отпечаток: ${footprint.name}`);
        console.log(`📊 Всего точек: ${footprint.originalPoints.length}`);
        console.log(`📸 Фото в истории: ${footprint.photos.length}`);
        console.log(`🎯 Среднее подтверждений: ${footprint.stats.avgConfirmations.toFixed(2)}`);
       
        console.log('\n📈 ИСТОРИЯ ФОТО:');
        footprint.photos.forEach((photo, i) => {
            console.log(`   ${i + 1}. ${photo.id}: ${photo.points} точек, ${photo.matches} совпадений`);
        });
    }
   
    const stats = manager.getStats();
    console.log(`\n📈 СТАТИСТИКА СИСТЕМЫ:`);
    console.log(`   Всего сравнений: ${stats.totalComparisons}`);
    console.log(`   Успешных сравнений: ${stats.successfulComparisons}`);
    console.log(`   Активных пользователей: ${stats.activeUsers}`);
   
    console.log('\n🎯 ИТОГ ТЕСТА:');
    console.log('='.repeat(60));
   
    const expectedResults = [
        { test: 'Первый след', result: result1, expected: 'new' },
        { test: 'Повернутый след', result: result2, expected: 'match' },
        { test: 'Частичный след', result: result3, expected: 'match' },
        { test: 'Другой след', result: result4, expected: 'new' }
    ];
   
    let passed = 0;
    expectedResults.forEach((item, idx) => {
        const actual = item.result.isNew ? 'new' : 'match';
        const passedTest = actual === item.expected;
        if (passedTest) passed++;
       
        const icon = passedTest ? '✅' : '❌';
        console.log(`${idx + 1}. ${item.test}: ${icon} ${actual} (ожидалось: ${item.expected})`);
    });
   
    console.log(`\n🎯 Результат: ${passed}/${expectedResults.length} тестов пройдено`);
   
    if (passed === expectedResults.length) {
        console.log('✅ МЕНЕДЖЕР С ГИБРИДНЫМ АЛГОРИТМОМ РАБОТАЕТ КОРРЕКТНО!');
    } else {
        console.log('⚠️ ТРЕБУЕТСЯ ДОРАБОТКА');
        console.log('\n🔍 ПРОБЛЕМНЫЕ ТЕСТЫ:');
        expectedResults.forEach((item, idx) => {
            const actual = item.result.isNew ? 'new' : 'match';
            if (actual !== item.expected) {
                console.log(`   ${idx + 1}. ${item.test}: получили ${actual}, ожидали ${item.expected}`);
                console.log(`      Схожесть: ${item.result.similarity ? (item.result.similarity * 100).toFixed(1) + '%' : 'N/A'}`);
            }
        });
    }
}

// Запускаем тест
testManagerWithHybridAlgorithm().catch(console.error);
