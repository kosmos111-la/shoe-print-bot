// test-vector-algorithm.js
// 🧪 ТЕСТ ВЕКТОРНОГО АЛГОРИТМА

const VectorAlgorithm = require('./modules/footprint/clean/vector-algorithm');

// Простая тестовая фигура
function createSquare() {
    return [
        { x: 100, y: 100, originalId: 'A' },
        { x: 200, y: 100, originalId: 'B' },
        { x: 200, y: 200, originalId: 'C' },
        { x: 100, y: 200, originalId: 'D' },
        { x: 150, y: 150, originalId: 'E' }
    ];
}

function rotatePoints(points, degrees, centerX = 150, centerY = 150) {
    const angle = degrees * Math.PI / 180;
    return points.map(p => {
        const dx = p.x - centerX;
        const dy = p.y - centerY;
        return {
            x: centerX + dx * Math.cos(angle) - dy * Math.sin(angle),
            y: centerY + dx * Math.sin(angle) + dy * Math.cos(angle),
            originalId: `${p.originalId}_R${degrees}`
        };
    });
}

function createDifferentShape() {
    return [
        { x: 300, y: 300, originalId: 'X' },
        { x: 350, y: 350, originalId: 'Y' },
        { x: 400, y: 300, originalId: 'Z' },
        { x: 350, y: 250, originalId: 'W' }
    ];
}

async function testVectorAlgorithm() {
    console.log('🧪 ТЕСТ ВЕКТОРНОГО АЛГОРИТМА\n');
   
    const algorithm = new VectorAlgorithm({
        debug: true,
        minSimilarity: 0.6,
        neighborDepth: 2
    });
   
    console.log('1. 📐 ТЕСТ: ПОВОРОТ НА 45°');
    console.log('='.repeat(50));
   
    const square = createSquare();
    const rotated45 = rotatePoints(square, 45);
   
    const result1 = algorithm.comparePoints(square, rotated45, 'Квадрат', 'Квадрат повернутый 45°');
    console.log(`   Результат: ${result1.decision}, схожесть: ${result1.similarity.toFixed(3)}`);
    console.log(`   Ожидается: SAME (инвариантно к повороту)`);
   
    console.log('\n2. 📐 ТЕСТ: ПОВОРОТ НА 90°');
    console.log('='.repeat(50));
   
    const rotated90 = rotatePoints(square, 90);
    const result2 = algorithm.comparePoints(square, rotated90, 'Квадрат', 'Квадрат повернутый 90°');
    console.log(`   Результат: ${result2.decision}, схожесть: ${result2.similarity.toFixed(3)}`);
    console.log(`   Ожидается: SAME (инвариантно к повороту)`);
   
    console.log('\n3. 📐 ТЕСТ: РАЗНЫЕ ФИГУРЫ');
    console.log('='.repeat(50));
   
    const different = createDifferentShape();
    const result3 = algorithm.comparePoints(square, different, 'Квадрат', 'Другая фигура');
    console.log(`   Результат: ${result3.decision}, схожесть: ${result3.similarity.toFixed(3)}`);
    console.log(`   Ожидается: DIFFERENT (разная геометрия)`);
   
    console.log('\n4. 📐 ТЕСТ: ЧАСТИЧНАЯ ФИГУРА');
    console.log('='.repeat(50));
   
    const partial = square.slice(0, 3); // Берем 3 из 5 точек
    const result4 = algorithm.comparePoints(square, partial, 'Квадрат (5 точек)', 'Частичный (3 точки)');
    console.log(`   Результат: ${result4.decision}, схожесть: ${result4.similarity.toFixed(3)}`);
    console.log(`   Ожидается: SAME (большая часть совпадает)`);
   
    console.log('\n📊 ИТОГ:');
    console.log('='.repeat(50));
   
    const tests = [
        { name: 'Поворот 45°', result: result1, expected: 'same' },
        { name: 'Поворот 90°', result: result2, expected: 'same' },
        { name: 'Разные фигуры', result: result3, expected: 'different' },
        { name: 'Частичная фигура', result: result4, expected: 'same' }
    ];
   
    let passed = 0;
    tests.forEach(test => {
        const passedTest = test.result.decision === test.expected;
        if (passedTest) passed++;
       
        console.log(`   ${passedTest ? '✅' : '❌'} ${test.name}: ${test.result.decision} (схожесть: ${test.result.similarity.toFixed(3)})`);
    });
   
    console.log(`\n🎯 Результат: ${passed}/${tests.length} тестов пройдено`);
   
    if (passed === tests.length) {
        console.log('\n✅ ВЕКТОРНЫЙ АЛГОРИТМ РАБОТАЕТ ИДЕАЛЬНО!');
        console.log('   • Инвариантен к повороту');
        console.log('   • Различает разные фигуры');
        console.log('   • Работает с частичными данными');
        console.log('   • Использует геометрические инварианты, а не координаты');
    } else {
        console.log('\n⚠️ ТРЕБУЕТСЯ ДОРАБОТКА');
    }
}

testVectorAlgorithm().catch(console.error);
