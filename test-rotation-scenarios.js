// test-rotation-scenarios.js
async function testRotationScenarios() {
    console.log('🧪 ТЕСТИРОВАНИЕ ПОВЕРНУТЫХ СЛЕДОВ');

    // 1. Загрузить два одинаковых следа
    const footprint1 = await loadFootprint('trace_original.jpg');
    const footprint2 = await loadFootprint('trace_rotated_90.jpg');

    // 2. Проанализировать трансформации
    const TransformationDebugger = require('./alignment/transformation-debugger');
    const debuggerTool = new TransformationDebugger(); // 🔥 ИЗМЕНЕНО
    debuggerTool.analyzeTransformation(footprint1, footprint2); // 🔥 ИЗМЕНЕНО

    // 3. Применить коррекцию
    const manager = new SimpleFootprintManager();
    const result = await manager.compareWithFixedAlignment(footprint1, footprint2);

    // 4. Проверить результат
    console.log(`\n🎯 РЕЗУЛЬТАТ:`);
    console.log(`   Сходство: ${result.similarity.toFixed(3)}`);
    console.log(`   Синие точки в правильной зоне: ${result.correctBlueZone ? '✅' : '❌'}`);
    console.log(`   Ошибка трансформации: ${result.transformationError?.toFixed(1) || '?'}px`);

    return result.similarity > 0.7;
}
