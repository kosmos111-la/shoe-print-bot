// node test-geometric.js
const SimpleManager = require('./modules/footprint/simple-manager.js');
const manager = new SimpleManager({ debug: false }); // Уменьшим вывод

console.log('🎯 ТЕСТ РАЗНЫХ СЛУЧАЕВ ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА\n');

// Тест 1: Идентичные точки
console.log('🔬 ТЕСТ 1: ИДЕНТИЧНЫЕ ТОЧКИ');
const identicalPoints = [
    { x: 100, y: 100, id: 'p1' },
    { x: 200, y: 200, id: 'p2' },
    { x: 300, y: 300, id: 'p3' },
    { x: 150, y: 150, id: 'p4' },
    { x: 250, y: 250, id: 'p5' }
];

const result1 = manager.geometricAlgorithm.comparePoints(
    identicalPoints,
    identicalPoints,
    'Идентичные 1',
    'Идентичные 2'
);
console.log(`• Схожесть: ${(result1.similarity * 100).toFixed(1)}%`);
console.log(`• Решение: ${result1.decision === 'same' ? '✅ ОДНА обувь' : '❌ РАЗНАЯ обувь'}`);
console.log(`• Совпадений: ${result1.matches?.length || 0}\n`);

// Тест 2: Немного смещенные точки
console.log('🔬 ТЕСТ 2: СМЕЩЕННЫЕ ТОЧКИ (+10px)');
const shiftedPoints = identicalPoints.map(p => ({
    ...p,
    x: p.x + 10,
    y: p.y + 10
}));

const result2 = manager.geometricAlgorithm.comparePoints(
    identicalPoints,
    shiftedPoints,
    'Оригинал',
    'Смещенные'
);
console.log(`• Схожесть: ${(result2.similarity * 100).toFixed(1)}%`);
console.log(`• Решение: ${result2.decision === 'same' ? '✅ ОДНА обувь' : '❌ РАЗНАЯ обувь'}`);
console.log(`• Совпадений: ${result2.matches?.length || 0}\n`);

// Тест 3: Совершенно разные точки
console.log('🔬 ТЕСТ 3: РАЗНЫЕ ТОЧКИ');
const differentPoints = [
    { x: 500, y: 500, id: 'p1' },
    { x: 600, y: 600, id: 'p2' },
    { x: 700, y: 700, id: 'p3' },
    { x: 550, y: 550, id: 'p4' },
    { x: 650, y: 650, id: 'p5' }
];

const result3 = manager.geometricAlgorithm.comparePoints(
    identicalPoints,
    differentPoints,
    'Оригинал',
    'Разные'
);
console.log(`• Схожесть: ${(result3.similarity * 100).toFixed(1)}%`);
console.log(`• Решение: ${result3.decision === 'same' ? '✅ ОДНА обувь' : '❌ РАЗНАЯ обувь'}`);
console.log(`• Совпадений: ${result3.matches?.length || 0}\n`);

// Тест 4: Тест через менеджер с разными точками
console.log('🔬 ТЕСТ 4: ЧЕРЕЗ МЕНЕДЖЕР (разные точки)');
const SimpleFootprint = require('./modules/footprint/simple-footprint');

const footprint1 = new SimpleFootprint({ userId: 'test', name: 'Тест1' });
const footprint2 = new SimpleFootprint({ userId: 'test', name: 'Тест2' });

// Добавляем разные точки
identicalPoints.forEach(p => {
    if (footprint1.pointTracker) {
        footprint1.pointTracker.points.set(p.id, {
            id: p.id,
            x: p.x,
            y: p.y,
            confidence: 0.8,
            confirmedCount: 1
        });
    }
});

differentPoints.forEach(p => {
    if (footprint2.pointTracker) {
        footprint2.pointTracker.points.set(p.id, {
            id: p.id,
            x: p.x,
            y: p.y,
            confidence: 0.8,
            confirmedCount: 1
        });
    }
});

manager.compareFootprints(footprint1, footprint2)
    .then(result => {
        console.log(`• Схожесть: ${(result.similarity * 100).toFixed(1)}%`);
        console.log(`• Решение: ${result.decision === 'same' ? '✅ ОДНА обувь' : '❌ РАЗНАЯ обувь'}`);
        console.log(`• Метод: ${result.method}`);
       
        if (result.stats) {
            console.log(`• Совпадение fp1→fp2: ${result.stats.percent1to2}%`);
            console.log(`• Совпадение fp2→fp1: ${result.stats.percent2to1}%`);
        }
    })
    .catch(err => console.error('Ошибка:', err));

// Тест 5: Проверка порогов
console.log('\n🔬 ТЕСТ 5: ПРОВЕРКА ПОРОГОВ');
console.log('Текущий порог: 60% (0.6)');
console.log('Ожидаемое поведение:');
console.log('- >60% = ОДНА обувь');
console.log('- <60% = РАЗНАЯ обувь');

const testThresholds = [0.2, 0.4, 0.6, 0.8, 1.0];
testThresholds.forEach(threshold => {
    const testPoints = identicalPoints.map((p, i) => ({
        ...p,
        x: p.x + (i * 50 * (1 - threshold)) // Чем меньше схожесть, тем больше смещение
    }));
   
    const result = manager.geometricAlgorithm.comparePoints(
        identicalPoints,
        testPoints,
        'Оригинал',
        `Тест ${(threshold * 100).toFixed(0)}%`
    );
   
    console.log(`\nПорог ${(threshold * 100).toFixed(0)}%:`);
    console.log(`  • Фактическая схожесть: ${(result.similarity * 100).toFixed(1)}%`);
    console.log(`  • Решение: ${result.decision === 'same' ? '✅ ОДНА' : '❌ РАЗНАЯ'}`);
    console.log(`  • Ожидалось: ${threshold >= 0.6 ? '✅ ОДНА' : '❌ РАЗНАЯ'}`);
    console.log(`  • Статус: ${(result.decision === 'same') === (threshold >= 0.6) ? '✅ ПРАВИЛЬНО' : '❌ ОШИБКА'}`);
});
}

test();
