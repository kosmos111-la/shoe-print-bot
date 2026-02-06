// test-geometric-fix.js
// 🧪 ТЕСТ ДЛЯ ПРОВЕРКИ ИСПРАВЛЕННОГО АЛГОРИТМА

const GeometricHashAlgorithm = require('./modules/footprint/clean/geometric-hash-algorithm');

function createSimpleTestFigure(offsetX = 0, offsetY = 0) {
    // Простая фигура: квадрат
    return [
        { x: 100 + offsetX, y: 100 + offsetY, originalId: 'A', id: 'A1' },
        { x: 200 + offsetX, y: 100 + offsetY, originalId: 'B', id: 'B1' },
        { x: 200 + offsetX, y: 200 + offsetY, originalId: 'C', id: 'C1' },
        { x: 100 + offsetX, y: 200 + offsetY, originalId: 'D', id: 'D1' }
    ];
}

function createDifferentFigure() {
    // Совсем другая фигура: треугольник
    return [
        { x: 500, y: 500, originalId: 'X', id: 'X1' },
        { x: 600, y: 500, originalId: 'Y', id: 'Y1' },
        { x: 550, y: 600, originalId: 'Z', id: 'Z1' }
    ];
}

async function testFixedAlgorithm() {
    console.log('🧪 ТЕСТ ИСПРАВЛЕННОГО ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА\n');
   
    const algorithm = new GeometricHashAlgorithm({
        debug: true,
        angleTolerance: 15,
        minSimilarity: 0.4
    });
   
    console.log('1. 📐 ТЕСТ 1: ОДИНАКОВЫЕ ФИГУРЫ (должны совпасть)');
    console.log('='.repeat(60));
   
    const figure1 = createSimpleTestFigure();
    const figure2 = createSimpleTestFigure(); // Та же фигура
   
    const result1 = algorithm.comparePoints(figure1, figure2, 'Фигура 1', 'Фигура 1 (копия)');
    console.log(`   Результат: ${result1.decision}, схожесть: ${result1.similarity.toFixed(3)}`);
    console.log(`   Ожидается: SAME (схожесть > 0.6)`);
   
    console.log('\n2. 📐 ТЕСТ 2: ПОВЕРНУТАЯ ФИГУРА (на 90°)');
    console.log('='.repeat(60));
   
    const rotatedFigure = createSimpleTestFigure().map(point => {
        // Поворот на 90 градусов вокруг центра (150,150)
        const centerX = 150, centerY = 150;
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        return {
            ...point,
            x: centerX - dy, // Поворот на 90°
            y: centerY + dx,
            id: `${point.id}_R90`
        };
    });
   
    const result2 = algorithm.comparePoints(figure1, rotatedFigure, 'Фигура 1', 'Фигура 1 (повернутая)');
    console.log(`   Результат: ${result2.decision}, схожесть: ${result2.similarity.toFixed(3)}`);
    console.log(`   Ожидается: SAME (углы треугольников не меняются при повороте)`);
   
    console.log('\n3. 📐 ТЕСТ 3: ЧАСТИЧНАЯ ФИГУРА (3 из 4 точек)');
    console.log('='.repeat(60));
   
    const partialFigure = figure1.slice(0, 3); // Убираем последнюю точку
    const result3 = algorithm.comparePoints(figure1, partialFigure, 'Фигура 1', 'Фигура 1 (частичная)');
    console.log(`   Результат: ${result3.decision}, схожесть: ${result3.similarity.toFixed(3)}`);
    console.log(`   Ожидается: SAME (большинство точек совпадает)`);
   
    console.log('\n4. 📐 ТЕСТ 4: СОВСЕМ ДРУГАЯ ФИГУРА');
    console.log('='.repeat(60));
   
    const differentFigure = createDifferentFigure();
    const result4 = algorithm.comparePoints(figure1, differentFigure, 'Фигура 1', 'Фигура 2 (другая)');
    console.log(`   Результат: ${result4.decision}, схожесть: ${result4.similarity.toFixed(3)}`);
    console.log(`   Ожидается: DIFFERENT (схожесть < 0.6)`);
   
    console.log('\n5. 📐 ТЕСТ 5: МАЛО ТОЧЕК (меньше минимума для треугольников)');
    console.log('='.repeat(60));
   
    const smallFigure = [
        { x: 100, y: 100, originalId: 'P1', id: 'P1' },
        { x: 150, y: 100, originalId: 'P2', id: 'P2' }
    ];
   
    const result5 = algorithm.comparePoints(figure1, smallFigure, 'Фигура 1', 'Фигура 3 (2 точки)');
    console.log(`   Результат: ${result5.decision}, схожесть: ${result5.similarity.toFixed(3)}`);
    console.log(`   Ожидается: DIFFERENT (нельзя построить треугольники)`);
   
    console.log('\n📊 ИТОГИ ТЕСТА:');
    console.log('='.repeat(60));
   
    const tests = [
        { name: 'Одинаковые фигуры', result: result1, expected: 'SAME' },
        { name: 'Повернутая фигура', result: result2, expected: 'SAME' },
        { name: 'Частичная фигура', result: result3, expected: 'SAME' },
        { name: 'Другая фигура', result: result4, expected: 'DIFFERENT' },
        { name: 'Мало точек', result: result5, expected: 'DIFFERENT' }
    ];
   
    let passed = 0;
    tests.forEach((test, idx) => {
        const passedTest = test.result.decision === test.expected;
        if (passedTest) passed++;
       
        console.log(`${idx + 1}. ${test.name}: ${passedTest ? '✅' : '❌'} (${test.result.decision}, схожесть: ${test.result.similarity.toFixed(3)})`);
    });
   
    console.log(`\n🎯 Результат: ${passed}/${tests.length} тестов пройдено`);
    console.log(passed === tests.length ? '✅ АЛГОРИТМ РАБОТАЕТ ПРАВИЛЬНО!' : '⚠️ ТРЕБУЕТСЯ ДОРАБОТКА');
}

testFixedAlgorithm().catch(console.error);
