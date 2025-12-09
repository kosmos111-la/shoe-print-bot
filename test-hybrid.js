// test-hybrid.js
const HybridFootprint = require('./modules/footprint/hybrid-footprint');

console.log('🚀 Тестирую гибридную систему...');

// 1. Тест сравнения
HybridFootprint.testComparison();

// 2. Тест производительности
console.log('\n⏱️ ТЕСТ ПРОИЗВОДИТЕЛЬНОСТИ:');

const startTime = Date.now();
const footprints = [];

// Создать 100 отпечатков
for (let i = 0; i < 100; i++) {
    const points = [];
    for (let j = 0; j < 30; j++) {
        points.push({
            x: Math.random() * 800,
            y: Math.random() * 600,
            confidence: 0.5 + Math.random() * 0.5
        });
    }
   
    const fp = new HybridFootprint({ name: `Тест ${i}` });
    fp.createFromPoints(points);
    footprints.push(fp);
}

console.log(`✅ Создано ${footprints.length} отпечатков за ${Date.now() - startTime}мс`);

// 3. Тест быстрого поиска
console.log('\n🔍 ТЕСТ БЫСТРОГО ПОИСКА:');

const queryFootprint = footprints[0];
const searchStart = Date.now();

const results = HybridFootprint.fastSearch(
    queryFootprint.bitmask.bitmask,
    footprints,
    20
);

console.log(`Найдено ${results.length} кандидатов за ${Date.now() - searchStart}мс`);
console.log('Лучшие 5 кандидатов:');
results.slice(0, 5).forEach((r, i) => {
    console.log(`${i+1}. ${r.item.name} (расстояние: ${r.bitmaskDistance})`);
});
