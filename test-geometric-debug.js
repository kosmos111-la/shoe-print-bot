// test-geometric-debug.js
// 🔥 ДИАГНОСТИКА ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА

console.log('🔍 ДИАГНОСТИКА ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА\n');

const GeometricHashAlgorithm = require('./modules/footprint/clean/geometric-hash-algorithm');

const algo = new GeometricHashAlgorithm({
    neighborOffsets: [-2, -1, 1, 2],
    angleTolerance: 10,
    minSimilarity: 0.6,
    debug: true,
    useNormalization: true
});

// ТЕСТ: Почему разные точки дают 100%?
console.log('🧪 ТЕСТ: Почему разные точки дают 100%?\n');

const points1 = [
    { x: 0, y: 0, id: 'p1' },
    { x: 100, y: 0, id: 'p2' },
    { x: 0, y: 100, id: 'p3' },
    { x: 100, y: 100, id: 'p4' },
    { x: 50, y: 50, id: 'p5' }
];

const points2 = [
    { x: 500, y: 500, id: 'p1' },
    { x: 600, y: 500, id: 'p2' },
    { x: 500, y: 600, id: 'p3' },
    { x: 600, y: 600, id: 'p4' },
    { x: 550, y: 550, id: 'p5' }
];

console.log('📐 ТОЧКИ 1 (маленький квадрат):');
points1.forEach(p => console.log(`   (${p.x}, ${p.y})`));

console.log('\n📐 ТОЧКИ 2 (большой квадрат):');
points2.forEach(p => console.log(`   (${p.x}, ${p.y})`));

// Создаем отпечатки с детальной отладкой
console.log('\n🔧 СОЗДАНИЕ ОТПЕЧАТКОВ:');
const fp1 = algo.createFootprint(points1, 'small_square');
const fp2 = algo.createFootprint(points2, 'big_square');

console.log(`\n📊 ДЕСКРИПТОРЫ small_square (${fp1.length}):`);
fp1.forEach((desc, i) => {
    console.log(`   ${i + 1}. Хеш: ${desc.geometricHash?.substring(0, 30)}...`);
    console.log(`      Треугольников: ${desc.triangleCount}`);
});

console.log(`\n📊 ДЕСКРИПТОРЫ big_square (${fp2.length}):`);
fp2.forEach((desc, i) => {
    console.log(`   ${i + 1}. Хеш: ${desc.geometricHash?.substring(0, 30)}...`);
    console.log(`      Треугольников: ${desc.triangleCount}`);
});

// Сравниваем
console.log('\n🔍 СРАВНЕНИЕ:');
const result = algo.compareFootprints(fp1, fp2);

console.log(`\n📈 РЕЗУЛЬТАТ СРАВНЕНИЯ:`);
console.log(`   Совпадение 1→2: ${result.stats.percent1to2}%`);
console.log(`   Совпадение 2→1: ${result.stats.percent2to1}%`);
console.log(`   Средняя схожесть: ${result.stats.avgSimilarity}`);

// 🔥 ВАЖНО: Проверим, что на самом деле сравнивается
console.log('\n🔬 ПОДРОБНЫЙ АНАЛИЗ СОВПАДЕНИЙ:');
if (result.matches && result.matches.length > 0) {
    result.matches.slice(0, 3).forEach((match, i) => {
        console.log(`\n   Совпадение ${i + 1}:`);
        console.log(`      Точка 1: ID=${match.point1.id}, X=${match.point1.x}, Y=${match.point1.y}`);
        console.log(`      Точка 2: ID=${match.point2.id}, X=${match.point2.x}, Y=${match.point2.y}`);
        console.log(`      Сходство: ${match.similarity}`);
        console.log(`      Хеш: ${match.hash?.substring(0, 30)}...`);
    });
}

// 🔥 ПРОВЕРИМ НОРМАЛИЗАЦИЮ
console.log('\n🧪 ТЕСТ НОРМАЛИЗАЦИИ:');

// Посмотрим, нормализует ли алгоритм точки
const normalized1 = algo.normalizePoints ? algo.normalizePoints(points1) : points1;
const normalized2 = algo.normalizePoints ? algo.normalizePoints(points2) : points2;

console.log(`\n📐 ТОЧКИ 1 после нормализации:`);
if (normalized1 !== points1) {
    normalized1.forEach(p => console.log(`   (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`));
} else {
    console.log('   ❌ Нормализация не применяется!');
}

console.log(`\n📐 ТОЧКИ 2 после нормализации:`);
if (normalized2 !== points2) {
    normalized2.forEach(p => console.log(`   (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`));
} else {
    console.log('   ❌ Нормализация не применяется!');
}

// 🔥 ПРОВЕРИМ РАССТОЯНИЯ МЕЖДУ ТОЧКАМИ
console.log('\n📏 РАССТОЯНИЯ МЕЖДУ ТОЧКАМИ:');

function calculateDistances(points) {
    const distances = [];
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const dx = points[j].x - points[i].x;
            const dy = points[j].y - points[i].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            distances.push(distance);
        }
    }
    return distances;
}

const dist1 = calculateDistances(points1);
const dist2 = calculateDistances(points2);

console.log(`\n📊 ТОЧКИ 1 - расстояния (${dist1.length}):`);
console.log(`   Мин: ${Math.min(...dist1).toFixed(1)}`);
console.log(`   Макс: ${Math.max(...dist1).toFixed(1)}`);
console.log(`   Сред: ${(dist1.reduce((a, b) => a + b, 0) / dist1.length).toFixed(1)}`);

console.log(`\n📊 ТОЧКИ 2 - расстояния (${dist2.length}):`);
console.log(`   Мин: ${Math.min(...dist2).toFixed(1)}`);
console.log(`   Макс: ${Math.max(...dist2).toFixed(1)}`);
console.log(`   Сред: ${(dist2.reduce((a, b) => a + b, 0) / dist2.length).toFixed(1)}`);

// 🔥 ВЫВОД
console.log('\n🎯 ВЫВОД:');
console.log('==================================');

if (result.stats.percent1to2 === 100) {
    console.log('❌ ПРОБЛЕМА: Алгоритм показывает 100% для РАЗНЫХ точек');
    console.log('   Возможные причины:');
    console.log('   1. Нормализация не работает (точки не масштабируются)');
    console.log('   2. Хеширование слишком грубое');
    console.log('   3. Углы треугольников совпадают (похожая форма)');
    console.log('   4. Не учитываются абсолютные расстояния');
} else {
    console.log('✅ Алгоритм работает корректно');
// test-geometric-debug.js
// 🔥 ДИАГНОСТИКА ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА

console.log('🔍 ДИАГНОСТИКА ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА\n');

const GeometricHashAlgorithm = require('./modules/footprint/clean/geometric-hash-algorithm');

const algo = new GeometricHashAlgorithm({
    neighborOffsets: [-2, -1, 1, 2],
    angleTolerance: 10,
    minSimilarity: 0.6,
    debug: true,
    useNormalization: true
});

// ТЕСТ: Почему разные точки дают 100%?
console.log('🧪 ТЕСТ: Почему разные точки дают 100%?\n');

const points1 = [
    { x: 0, y: 0, id: 'p1' },
    { x: 100, y: 0, id: 'p2' },
    { x: 0, y: 100, id: 'p3' },
    { x: 100, y: 100, id: 'p4' },
    { x: 50, y: 50, id: 'p5' }
];

const points2 = [
    { x: 500, y: 500, id: 'p1' },
    { x: 600, y: 500, id: 'p2' },
    { x: 500, y: 600, id: 'p3' },
    { x: 600, y: 600, id: 'p4' },
    { x: 550, y: 550, id: 'p5' }
];

console.log('📐 ТОЧКИ 1 (маленький квадрат):');
points1.forEach(p => console.log(`   (${p.x}, ${p.y})`));

console.log('\n📐 ТОЧКИ 2 (большой квадрат):');
points2.forEach(p => console.log(`   (${p.x}, ${p.y})`));

// Создаем отпечатки с детальной отладкой
console.log('\n🔧 СОЗДАНИЕ ОТПЕЧАТКОВ:');
const fp1 = algo.createFootprint(points1, 'small_square');
const fp2 = algo.createFootprint(points2, 'big_square');

console.log(`\n📊 ДЕСКРИПТОРЫ small_square (${fp1.length}):`);
fp1.forEach((desc, i) => {
    console.log(`   ${i + 1}. Хеш: ${desc.geometricHash?.substring(0, 30)}...`);
    console.log(`      Треугольников: ${desc.triangleCount}`);
});

console.log(`\n📊 ДЕСКРИПТОРЫ big_square (${fp2.length}):`);
fp2.forEach((desc, i) => {
    console.log(`   ${i + 1}. Хеш: ${desc.geometricHash?.substring(0, 30)}...`);
    console.log(`      Треугольников: ${desc.triangleCount}`);
});

// Сравниваем
console.log('\n🔍 СРАВНЕНИЕ:');
const result = algo.compareFootprints(fp1, fp2);

console.log(`\n📈 РЕЗУЛЬТАТ СРАВНЕНИЯ:`);
console.log(`   Совпадение 1→2: ${result.stats.percent1to2}%`);
console.log(`   Совпадение 2→1: ${result.stats.percent2to1}%`);
console.log(`   Средняя схожесть: ${result.stats.avgSimilarity}`);

// 🔥 ВАЖНО: Проверим, что на самом деле сравнивается
console.log('\n🔬 ПОДРОБНЫЙ АНАЛИЗ СОВПАДЕНИЙ:');
if (result.matches && result.matches.length > 0) {
    result.matches.slice(0, 3).forEach((match, i) => {
        console.log(`\n   Совпадение ${i + 1}:`);
        console.log(`      Точка 1: ID=${match.point1.id}, X=${match.point1.x}, Y=${match.point1.y}`);
        console.log(`      Точка 2: ID=${match.point2.id}, X=${match.point2.x}, Y=${match.point2.y}`);
        console.log(`      Сходство: ${match.similarity}`);
        console.log(`      Хеш: ${match.hash?.substring(0, 30)}...`);
    });
}

// 🔥 ПРОВЕРИМ НОРМАЛИЗАЦИЮ
console.log('\n🧪 ТЕСТ НОРМАЛИЗАЦИИ:');

// Посмотрим, нормализует ли алгоритм точки
const normalized1 = algo.normalizePoints ? algo.normalizePoints(points1) : points1;
const normalized2 = algo.normalizePoints ? algo.normalizePoints(points2) : points2;

console.log(`\n📐 ТОЧКИ 1 после нормализации:`);
if (normalized1 !== points1) {
    normalized1.forEach(p => console.log(`   (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`));
} else {
    console.log('   ❌ Нормализация не применяется!');
}

console.log(`\n📐 ТОЧКИ 2 после нормализации:`);
if (normalized2 !== points2) {
    normalized2.forEach(p => console.log(`   (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`));
} else {
    console.log('   ❌ Нормализация не применяется!');
}

// 🔥 ПРОВЕРИМ РАССТОЯНИЯ МЕЖДУ ТОЧКАМИ
console.log('\n📏 РАССТОЯНИЯ МЕЖДУ ТОЧКАМИ:');

function calculateDistances(points) {
    const distances = [];
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const dx = points[j].x - points[i].x;
            const dy = points[j].y - points[i].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            distances.push(distance);
        }
    }
    return distances;
}

const dist1 = calculateDistances(points1);
const dist2 = calculateDistances(points2);

console.log(`\n📊 ТОЧКИ 1 - расстояния (${dist1.length}):`);
console.log(`   Мин: ${Math.min(...dist1).toFixed(1)}`);
console.log(`   Макс: ${Math.max(...dist1).toFixed(1)}`);
console.log(`   Сред: ${(dist1.reduce((a, b) => a + b, 0) / dist1.length).toFixed(1)}`);

console.log(`\n📊 ТОЧКИ 2 - расстояния (${dist2.length}):`);
console.log(`   Мин: ${Math.min(...dist2).toFixed(1)}`);
console.log(`   Макс: ${Math.max(...dist2).toFixed(1)}`);
console.log(`   Сред: ${(dist2.reduce((a, b) => a + b, 0) / dist2.length).toFixed(1)}`);

// 🔥 ВЫВОД
console.log('\n🎯 ВЫВОД:');
console.log('==================================');

if (result.stats.percent1to2 === 100) {
    console.log('❌ ПРОБЛЕМА: Алгоритм показывает 100% для РАЗНЫХ точек');
    console.log('   Возможные причины:');
    console.log('   1. Нормализация не работает (точки не масштабируются)');
    console.log('   2. Хеширование слишком грубое');
    console.log('   3. Углы треугольников совпадают (похожая форма)');
    console.log('   4. Не учитываются абсолютные расстояния');
} else {
    console.log('✅ Алгоритм работает корректно');
}
