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
   
    const normalized = TopologyUtils.normalizeNodes(testNodes);
    console.log('✅ Нормализовано узлов:', normalized.normalized.length);
    console.log('✅ Параметры нормализации:', normalized.normalizationParams);
   
    // Тест calculateGeometricInvariantsForFootprint
    console.log('\n📌 Тест calculateGeometricInvariantsForFootprint:');
    const geometricData = TopologyUtils.calculateGeometricInvariantsForFootprint(
        normalized.normalized,
        {}
    );
    console.log('✅ Bounding box:', geometricData.boundingBox);
    console.log('✅ Shape descriptors:', geometricData.shapeDescriptors);
   
    // Тест compareTopologyForFootprint
    console.log('\n📌 Тест compareTopologyForFootprint:');
    const score = TopologyUtils.compareTopologyForFootprint(
        normalized.normalized,
        normalized.normalized
    );
    console.log('✅ Score сравнения с самим собой:', score.toFixed(3));
   
    console.log('\n🎉 Все новые методы работают!');
   
} catch (error) {
    console.log('❌ Ошибка теста:', error.message);
    console.log(error.stack);
}
