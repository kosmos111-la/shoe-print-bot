// test-simple-manager.js
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

const manager = new SimpleFootprintManager({
    debug: true,
    enableMergeVisualization: false // Отключаем визуализацию для теста
});

console.log('✅ SimpleFootprintManager создан');

// Проверяем векторный тест
const testPoints = [
    { x: 0, y: 0, id: 't1' },
    { x: 100, y: 0, id: 't2' },
    { x: 0, y: 100, id: 't3' }
];

const vectorTest = manager.quickVectorTest({ pointTracker: { points: new Map([
    ['t1', { x: 0, y: 0, rating: 0.8, confirmedCount: 1 }],
    ['t2', { x: 100, y: 0, rating: 0.9, confirmedCount: 1 }],
    ['t3', { x: 0, y: 100, rating: 0.7, confirmedCount: 1 }]
]) } });

console.log('Векторный тест:', vectorTest);
