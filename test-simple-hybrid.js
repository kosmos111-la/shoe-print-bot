// test-simple-hybrid.js
// 🧪 ПРОСТОЙ ТЕСТ ГИБРИДНОГО АЛГОРИТМА

const CleanFootprintManager = require('./modules/footprint/clean/manager');

// Простая тестовая фигура - квадрат
function createSquare(size = 100, centerX = 500, centerY = 500) {
    return [
        { x: centerX - size, y: centerY - size, confidence: 0.9 },
        { x: centerX + size, y: centerY - size, confidence: 0.9 },
        { x: centerX + size, y: centerY + size, confidence: 0.9 },
        { x: centerX - size, y: centerY + size, confidence: 0.9 },
        // Добавляем дополнительные точки для реалистичности
        { x: centerX, y: centerY - size, confidence: 0.8 },
        { x: centerX + size, y: centerY, confidence: 0.8 },
        { x: centerX, y: centerY + size, confidence: 0.8 },
        { x: centerX - size, y: centerY, confidence: 0.8 }
    ];
}

// Круг (совсем другая фигура)
function createCircle(radius = 100, centerX = 500, centerY = 500, points = 12) {
    const circle = [];
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        circle.push({
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
            confidence: 0.9
        });
    }
    return circle;
}

async function runSimpleTest() {
    console.log('🧪 ПРОСТОЙ ТЕСТ МЕНЕДЖЕРА С ГИБРИДНЫМ АЛГОРИТМОМ\n');
   
    const manager = new CleanFootprintManager({
        debug: true,
        similarityThreshold: 0.6,
        minPoints: 5
    });
   
    console.log('1. 📸 Добавляем квадрат (8 точек)');
    const square1 = createSquare(80);
    const result1 = await manager.addPhoto('test_simple', square1, {
        id: 'square_1',
        source: 'test'
    });
    console.log('   Результат:', result1.message);
    console.log('   Ожидается: новый отпечаток');
   
    console.log('\n2. 📸 Добавляем тот же квадрат, повернутый на 30°');
    const square2 = createSquare(80).map(point => {
        const angle = 30 * Math.PI / 180;
        const dx = point.x - 500;
        const dy = point.y - 500;
        return {
            x: 500 + dx * Math.cos(angle) - dy * Math.sin(angle),
            y: 500 + dx * Math.sin(angle) + dy * Math.cos(angle),
            confidence: point.confidence
        };
    });
    const result2 = await manager.addPhoto('test_simple', square2, {
        id: 'square_2',
        source: 'test'
    });
    console.log('   Результат:', result2.message);
    console.log('   Схожесть:', result2.similarity ? `${(result2.similarity * 100).toFixed(1)}%` : 'N/A');
    console.log('   Ожидается: СОВПАДЕНИЕ (та же фигура, повернутая)');
   
    console.log('\n3. 📸 Добавляем круг (12 точек)');
    const circle = createCircle(90, 500, 500, 12);
    const result3 = await manager.addPhoto('test_simple', circle, {
        id: 'circle_1',
        source: 'test'
    });
    console.log('   Результат:', result3.message);
    console.log('   Схожесть:', result3.similarity ? `${(result3.similarity * 100).toFixed(1)}%` : 'N/A');
    console.log('   Ожидается: НОВЫЙ ОТПЕЧАТОК (другая фигура)');
   
    console.log('\n📊 СТАТИСТИКА:');
    const stats = manager.getStats();
    console.log(`   Всего сравнений: ${stats.totalComparisons}`);
    console.log(`   Успешных сравнений: ${stats.successfulComparisons}`);
   
    const footprint = manager.getFootprint('test_simple');
    if (footprint) {
        console.log(`   Активный отпечаток: ${footprint.originalPoints.length} точек`);
    }
   
    console.log('\n🎯 ВЫВОД:');
    console.log('='.repeat(50));
   
    if (result2.isNew === false && result3.isNew === true) {
        console.log('✅ ГИБРИДНЫЙ АЛГОРИТМ РАБОТАЕТ ПРАВИЛЬНО!');
        console.log('   • Различает одинаковые фигуры (даже повернутые)');
        console.log('   • Различает разные фигуры');
    } else {
        console.log('⚠️ ПРОБЛЕМЫ С АЛГОРИТМОМ:');
        if (result2.isNew !== false) {
            console.log('   • Не нашел совпадение с повернутой фигурой');
        }
        if (result3.isNew !== true) {
            console.log('   • Не различил квадрат и круг');
        }
    }
}

runSimpleTest().catch(console.error);
