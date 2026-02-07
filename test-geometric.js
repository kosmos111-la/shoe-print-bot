// test-geometric.js
const SimpleManager = require('./modules/footprint/simple-manager.js');
const manager = new SimpleManager({ debug: true });

// Тестовые точки
const points1 = [
    { x: 100, y: 100, id: 'p1' },
    { x: 200, y: 200, id: 'p2' },
    { x: 300, y: 300, id: 'p3' },
    { x: 150, y: 150, id: 'p4' },
    { x: 250, y: 250, id: 'p5' }
];

const points2 = [
    { x: 105, y: 105, id: 'p1' },
    { x: 205, y: 205, id: 'p2' },
    { x: 305, y: 305, id: 'p3' },
    { x: 155, y: 155, id: 'p4' },
    { x: 255, y: 255, id: 'p5' }
];

async function test() {
    console.log('\n🎯 ТЕСТ ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА\n');
   
    const geo1 = manager.geometricAlgorithm.createFootprint(points1, 'test1');
    const geo2 = manager.geometricAlgorithm.createFootprint(points2, 'test2');
   
    const result = manager.geometricAlgorithm.compareFootprints(geo1, geo2);
   
    console.log('Результат:');
    console.log(`• Совпадение fp1→fp2: ${result.stats.percent1to2}%`);
    console.log(`• Совпадение fp2→fp1: ${result.stats.percent2to1}%`);
    console.log(`• Среднее: ${(result.stats.percent1to2 / 100).toFixed(3)}`);
    console.log(`• Решение: ${(result.stats.percent1to2 / 100) > 0.6 ? '✅ ОДНА обувь' : '❌ РАЗНАЯ обувь'}`);
}

test();
