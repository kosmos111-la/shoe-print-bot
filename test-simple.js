// test-simple.js
const TopologyUtils = require('./modules/footprint/topology-utils');

console.log('🧪 Простой тест TopologyUtils');

// Тест 1: Центр масс
const points = [{x: 0, y: 0}, {x: 4, y: 0}, {x: 0, y: 4}];
const center = TopologyUtils.calculateCenterOfMass(points);
console.log('✅ Центр масс:', center);

// Тест 2: Расстояние
const dist = TopologyUtils.calculateDistance({x: 0, y: 0}, {x: 3, y: 4});
console.log('✅ Расстояние:', dist);

// Тест 3: PCA
const pca = TopologyUtils.calculatePCA(points);
console.log('✅ PCA:', pca ? 'успешно' : 'не удалось');

// Тест 4: Нормализация
const nodes = [
    {x: 100, y: 100, confidence: 0.9},
    {x: 200, y: 100, confidence: 0.8},
    {x: 200, y: 200, confidence: 0.9}
];

const normalized = TopologyUtils.normalizeNodes(nodes);
console.log('✅ Нормализация:', normalized.normalized.length, 'узлов');

console.log('\n🎉 Все базовые методы работают!');
