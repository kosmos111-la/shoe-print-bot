// test-geometric-algorithm-vector.js
// 🔥 ТЕСТ ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА (ТОЛЬКО ВЕКТОРНЫЕ ОПЕРАЦИИ)

console.log('🧪 ТЕСТ ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА (ВЕКТОРНЫЙ)\n');

// 1. ИМПОРТИРУЕМ АЛГОРИТМ
const GeometricHashAlgorithm = require('./modules/footprint/core/comparison/geometric-hash-algorithm');

// 2. СОЗДАЕМ АЛГОРИТМ
const algorithm = new GeometricHashAlgorithm({
    neighborOffsets: [-2, -1, 1, 2],
    angleTolerance: 10,
    minSimilarity: 0.6,
    debug: true,
    useNormalization: true
});

console.log('✅ Алгоритм создан');

// 3. ТЕСТ 1: ИДЕНТИЧНЫЕ ТОЧКИ (ВЕКТОРНЫЕ)
console.log('\n🧪 ТЕСТ 1: Идентичные векторные точки');

const points1 = [
    { x: 0, y: 0, id: 'p1' },
    { x: 100, y: 0, id: 'p2' },
    { x: 0, y: 100, id: 'p3' },
    { x: 100, y: 100, id: 'p4' },
    { x: 50, y: 50, id: 'p5' }
];

const points2 = [
    { x: 0, y: 0, id: 'p1' },
    { x: 100, y: 0, id: 'p2' },
    { x: 0, y: 100, id: 'p3' },
    { x: 100, y: 100, id: 'p4' },
    { x: 50, y: 50, id: 'p5' }
];

const fp1 = algorithm.createFootprint(points1, 'test1_identical');
const fp2 = algorithm.createFootprint(points2, 'test2_identical');
const result1 = algorithm.compareFootprints(fp1, fp2);

console.log(`📊 Результат: ${result1.stats.percent1to2}% совпадений`);
console.log(`✅ Тест 1: ${result1.stats.percent1to2 > 95 ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}`);

// 4. ТЕСТ 2: СМЕЩЁННЫЕ ТОЧКИ (ВЕКТОРНЫЕ)
console.log('\n🧪 ТЕСТ 2: Смещённые векторные точки');

const points3 = [
    { x: 10, y: 10, id: 'p1' },
    { x: 110, y: 10, id: 'p2' },
    { x: 10, y: 110, id: 'p3' },
    { x: 110, y: 110, id: 'p4' },
    { x: 60, y: 60, id: 'p5' }
];

const fp3 = algorithm.createFootprint(points3, 'test3_shifted');
const result2 = algorithm.compareFootprints(fp1, fp3);

console.log(`📊 Результат: ${result2.stats.percent1to2}% совпадений`);
console.log(`✅ Тест 2: ${result2.stats.percent1to2 > 70 ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}`);

// 5. ТЕСТ 3: РАЗНЫЕ ТОЧКИ (ВЕКТОРНЫЕ)
console.log('\n🧪 ТЕСТ 3: Разные векторные точки');

const points4 = [
    { x: 500, y: 500, id: 'p1' },
    { x: 600, y: 500, id: 'p2' },
    { x: 500, y: 600, id: 'p3' },
    { x: 600, y: 600, id: 'p4' },
    { x: 550, y: 550, id: 'p5' }
];

const fp4 = algorithm.createFootprint(points4, 'test4_different');
const result3 = algorithm.compareFootprints(fp1, fp4);

console.log(`📊 Результат: ${result3.stats.percent1to2}% совпадений`);
console.log(`✅ Тест 3: ${result3.stats.percent1to2 < 30 ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}`);

// 6. ТЕСТ 4: МАЛО ТОЧЕК (ВЕКТОРНЫЕ)
console.log('\n🧪 ТЕСТ 4: Мало векторных точек');

const points5 = [
    { x: 0, y: 0, id: 'p1' },
    { x: 100, y: 0, id: 'p2' }
];

const points6 = [
    { x: 0, y: 0, id: 'p1' },
    { x: 100, y: 0, id: 'p2' }
];

const fp5 = algorithm.createFootprint(points5, 'test5_few');
const fp6 = algorithm.createFootprint(points6, 'test6_few');
const result4 = algorithm.compareFootprints(fp5, fp6);

console.log(`📊 Результат: ${result4.stats.percent1to2}% совпадений`);
console.log(`✅ Тест 4: ${result4.stats.percent1to2 > 0 ? 'ПРОЙДЕН' : 'ПРОВАЛЕН'}`);

// 7. ТЕСТ 5: СТАТИСТИКА АЛГОРИТМА
console.log('\n📈 СТАТИСТИКА АЛГОРИТМА:');
const stats = algorithm.getStats();
console.log(`   • Создано отпечатков: ${stats.footprintsCreated}`);
console.log(`   • Выполнено сравнений: ${stats.comparisonsMade}`);
console.log(`   • Найдено совпадений: ${stats.matchesFound}`);

// 8. ВЫВОД
console.log('\n🎯 ИТОГИ ТЕСТИРОВАНИЯ:');
console.log(`   • Тест 1 (идентичные): ${result1.stats.percent1to2 > 95 ? '✅' : '❌'}`);
console.log(`   • Тест 2 (смещённые): ${result2.stats.percent1to2 > 70 ? '✅' : '❌'}`);
console.log(`   • Тест 3 (разные): ${result3.stats.percent1to2 < 30 ? '✅' : '❌'}`);
console.log(`   • Тест 4 (мало точек): ${result4.stats.percent1to2 > 0 ? '✅' : '❌'}`);

const allPassed =
    result1.stats.percent1to2 > 95 &&
    result2.stats.percent1to2 > 70 &&
    result3.stats.percent1to2 < 30 &&
    result4.stats.percent1to2 > 0;

console.log(`\n${allPassed ? '🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ!' : '⚠️ НЕ ВСЕ ТЕСТЫ ПРОЙДЕНЫ'}`);
console.log('🚀 Геометрический алгоритм готов к работе (ВЕКТОРНЫЙ)');
