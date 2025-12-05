// test-simple2.js
console.log('🧪 Тестируем новые методы TopologyUtils...');

try {
    const TopologyUtils = require('./modules/footprint/topology-utils');
   
    // Тест normalizeNodes
    console.log('\n📌 Тест normalizeNodes:');
    const testNodes = [
        { x: 100, y: 100, confidence: 0.9 },
        { x: 200, y: 100, confidence: 0.8 },
        { x: 200, y: 200, confidence: 0.9 },
        { x: 100, y: 200, confidence: 0.8 }
    ];
