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
} else {
    console.log('   ❌ Нет совпадений!');
}

// 🔥 ПРОВЕРИМ НОРМАЛИЗАЦИЮ
console.log('\n🧪 ТЕСТ НОРМАЛИЗАЦИИ:');

// Посмотрим, есть ли метод normalizePoints в алгоритме
console.log('🔍 Проверяем наличие метода normalizePoints:');
console.log(`   algo.normalizePoints exists: ${typeof algo.normalizePoints === 'function' ? '✅' : '❌'}`);

// Если метод есть, проверим его работу
if (typeof algo.normalizePoints === 'function') {
    console.log('\n📊 Применяем нормализацию:');
    const normalized1 = algo.normalizePoints(points1);
    const normalized2 = algo.normalizePoints(points2);
   
    console.log('\n📐 ТОЧКИ 1 после нормализации:');
    normalized1.forEach(p => console.log(`   (${p.x?.toFixed(4) || p.x}, ${p.y?.toFixed(4) || p.y})`));
   
    console.log('\n📐 ТОЧКИ 2 после нормализации:');
    normalized2.forEach(p => console.log(`   (${p.x?.toFixed(4) || p.x}, ${p.y?.toFixed(4) || p.y})`));
} else {
    console.log('   ❌ Метод normalizePoints не найден! Алгоритм не нормализует масштаб.');
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
            distances.push({
                from: points[i].id,
                to: points[j].id,
                distance: distance
            });
        }
    }
    return distances;
}

const dist1 = calculateDistances(points1);
const dist2 = calculateDistances(points2);

console.log(`\n📊 ТОЧКИ 1 - расстояния (${dist1.length}):`);
dist1.slice(0, 3).forEach(d => {
    console.log(`   ${d.from} → ${d.to}: ${d.distance.toFixed(1)}px`);
});

console.log(`\n📊 ТОЧКИ 2 - расстояния (${dist2.length}):`);
dist2.slice(0, 3).forEach(d => {
    console.log(`   ${d.from} → ${d.to}: ${d.distance.toFixed(1)}px`);
});

// Сравним средние расстояния
const avgDist1 = dist1.reduce((sum, d) => sum + d.distance, 0) / dist1.length;
const avgDist2 = dist2.reduce((sum, d) => sum + d.distance, 0) / dist2.length;

console.log(`\n📊 СРЕДНИЕ РАССТОЯНИЯ:`);
console.log(`   Точки 1: ${avgDist1.toFixed(1)}px`);
console.log(`   Точки 2: ${avgDist2.toFixed(1)}px`);
console.log(`   Отношение: ${(avgDist2 / avgDist1).toFixed(2)}x`);

// 🔥 ПРОВЕРИМ УГЛЫ ТРЕУГОЛЬНИКОВ
console.log('\n📐 ТЕСТ УГЛОВ ТРЕУГОЛЬНИКОВ:');

// Создаем треугольник для обеих конфигураций
const triangle1 = algo.createTriangle(points1[0], points1[1], points1[2]);
const triangle2 = algo.createTriangle(points2[0], points2[1], points2[2]);

if (triangle1 && triangle2) {
    console.log('\n🔺 ТРЕУГОЛЬНИК 1 (маленький):');
    console.log(`   Углы: ${triangle1.angles?.map(a => a.toFixed(1)).join(', ')}`);
    console.log(`   Нормализованные: ${triangle1.normalizedAngles?.map(a => a.toFixed(1)).join(', ')}`);
    console.log(`   Округленные: ${triangle1.roundedAngles?.join(', ')}`);
    console.log(`   Хеш: ${triangle1.hash}`);
   
    console.log('\n🔺 ТРЕУГОЛЬНИК 2 (большой):');
    console.log(`   Углы: ${triangle2.angles?.map(a => a.toFixed(1)).join(', ')}`);
    console.log(`   Нормализованные: ${triangle2.normalizedAngles?.map(a => a.toFixed(1)).join(', ')}`);
    console.log(`   Округленные: ${triangle2.roundedAngles?.join(', ')}`);
    console.log(`   Хеш: ${triangle2.hash}`);
   
    console.log(`\n🔍 Хеши совпадают: ${triangle1.hash === triangle2.hash ? '✅ ДА' : '❌ НЕТ'}`);
}

// 🔥 ВЫВОД
console.log('\n🎯 ВЫВОД:');
console.log('==================================');

if (result.stats.percent1to2 === 100) {
    console.log('❌ ПРОБЛЕМА: Алгоритм показывает 100% для РАЗНЫХ точек');
    console.log('\n🔍 ВОЗМОЖНЫЕ ПРИЧИНЫ:');
    console.log('1. ❌ Нормализация масштаба не работает');
    console.log('2. ❌ Хеширование слишком грубое (округление до 5°)');
    console.log('3. ✅ Углы треугольников одинаковые (оба квадрата)');
    console.log('4. ❌ Не учитываются абсолютные размеры');
   
    console.log('\n💡 РЕШЕНИЯ:');
    console.log('1. Добавить нормализацию масштаба');
    console.log('2. Увеличить точность хеширования (hashPrecision: 1 вместо 5)');
    console.log('3. Добавить проверку расстояний в хеш');
    console.log('4. Включить проверку относительных расстояний');
} else {
    console.log('✅ Алгоритм работает корректно');
}

// 🔥 ДОПОЛНИТЕЛЬНЫЙ ТЕСТ: Разные формы
console.log('\n🧪 ДОПОЛНИТЕЛЬНЫЙ ТЕСТ: Разные формы');

const trianglePoints = [
    { x: 0, y: 0, id: 't1' },
    { x: 100, y: 0, id: 't2' },
    { x: 0, y: 100, id: 't3' },
    { x: 33, y: 33, id: 't4' },
    { x: 66, y: 33, id: 't5' }
];

const linePoints = [
    { x: 0, y: 0, id: 'l1' },
    { x: 20, y: 0, id: 'l2' },
    { x: 40, y: 0, id: 'l3' },
    { x: 60, y: 0, id: 'l4' },
    { x: 80, y: 0, id: 'l5' }
];

const fpTriangle = algo.createFootprint(trianglePoints, 'triangle_shape');
const fpLine = algo.createFootprint(linePoints, 'line_shape');
const shapeResult = algo.compareFootprints(fpTriangle, fpLine);

console.log(`\n📊 Результат сравнения разных форм:`);
console.log(`   Треугольник vs Линия: ${shapeResult.stats.percent1to2}% совпадений`);
console.log(`   Правильно: ${shapeResult.stats.percent1to2 < 30 ? '✅' : '❌'}`);

// 🔥 ФИНАЛЬНЫЙ ВЫВОД
console.log('\n🚀 ФИНАЛЬНАЯ ДИАГНОСТИКА:');
console.log('============================');
console.log(`1. Нормализация масштаба: ${typeof algo.normalizePoints === 'function' ? '✅ ЕСТЬ' : '❌ ОТСУТСТВУЕТ'}`);
console.log(`2. Точность хеширования: ${algo.hashPrecision || 5}°`);
console.log(`3. Алгоритм различает формы: ${shapeResult.stats.percent1to2 < 30 ? '✅ ДА' : '❌ НЕТ'}`);
console.log(`4. Основная проблема: ${result.stats.percent1to2 === 100 ? '❌ Не различает размер' : '✅ OK'}`);
