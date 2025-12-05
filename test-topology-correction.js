// test-topology-correction.js
const DigitalFootprint = require('./modules/footprint/digital-footprint');
const TopologyUtils = require('./modules/footprint/topology-utils');

async function testTopologyCorrection() {
    console.log('🧪 ТЕСТИРУЕМ ТОПОЛОГИЧЕСКУЮ КОРРЕКЦИЮ\n');
   
    // Создаем две тестовые модели
    const model1 = new DigitalFootprint({
        name: 'Тестовая модель 1',
        userId: 'test'
    });
   
    const model2 = new DigitalFootprint({
        name: 'Тестовая модель 2',
        userId: 'test'
    });
   
    // Добавляем узлы в модель 1 (квадрат)
    const nodes1 = [
        {x: 100, y: 100, confidence: 0.9},
        {x: 200, y: 100, confidence: 0.8},
        {x: 200, y: 200, confidence: 0.9},
        {x: 100, y: 200, confidence: 0.8}
    ];
   
    // Добавляем узлы в модель 2 (тот же квадрат, но с искажениями)
    const nodes2 = [
        {x: 150, y: 120, confidence: 0.9},  // Смещение + масштаб
        {x: 280, y: 110, confidence: 0.8},  // Увеличен масштаб
        {x: 270, y: 230, confidence: 0.9},
        {x: 140, y: 210, confidence: 0.8}
    ];
   
    // Имитируем добавление анализов
    nodes1.forEach((node, i) => {
        model1.nodes.set(`node_${i}`, {
            id: `node_${i}`,
            center: {x: node.x, y: node.y},
            confidence: node.confidence,
            size: 20,
            confirmationCount: 1,
            sources: []
        });
    });
   
    nodes2.forEach((node, i) => {
        model2.nodes.set(`node_${i}`, {
            id: `node_${i}`,
            center: {x: node.x, y: node.y},
            confidence: node.confidence,
            size: 20,
            confirmationCount: 1,
            sources: []
        });
    });
   
    // Добавляем связи
    model1.edges = [
        {from: 'node_0', to: 'node_1', confidence: 0.9},
        {from: 'node_1', to: 'node_2', confidence: 0.9},
        {from: 'node_2', to: 'node_3', confidence: 0.9},
        {from: 'node_3', to: 'node_0', confidence: 0.9}
    ];
   
    model2.edges = [
        {from: 'node_0', to: 'node_1', confidence: 0.9},
        {from: 'node_1', to: 'node_2', confidence: 0.9},
        {from: 'node_2', to: 'node_3', confidence: 0.9},
        {from: 'node_3', to: 'node_0', confidence: 0.9}
    ];
   
    // Обновляем топологические инварианты
    console.log('🔄 Обновляю инварианты модели 1...');
    model1.updateTopologyInvariants();
   
    console.log('🔄 Обновляю инварианты модели 2...');
    model2.updateTopologyInvariants();
   
    // Сравниваем
    console.log('\n🔍 Сравниваю модели...');
    const comparison = model1.compareEnhanced(model2);
   
    console.log('\n📊 РЕЗУЛЬТАТЫ ТЕСТА:');
    console.log('======================');
    console.log(`Общая оценка: ${Math.round(comparison.score * 100)}%`);
    console.log(`Топология: ${Math.round(comparison.details.topology * 100)}%`);
    console.log(`Граф: ${Math.round(comparison.details.graph * 100)}%`);
    console.log(`Геометрия: ${Math.round(comparison.details.geometry * 100)}%`);
    console.log(`Зеркальность: ${comparison.isMirrored ? 'да' : 'нет'}`);
   
    // Тест зеркальности
    console.log('\n🪞 ТЕСТ ЗЕРКАЛЬНОСТИ:');
    const nodes1Array = Array.from(model1.topologyInvariants.normalizedNodes.values());
    const nodes2Array = Array.from(model2.topologyInvariants.normalizedNodes.values());
    const mirrorCheck = TopologyUtils.checkMirrorSymmetry(nodes1Array, nodes2Array);
    console.log(`Зеркальность: ${mirrorCheck.isMirrored ? 'да' : 'нет'}`);
    console.log(`Оценка: ${Math.round(mirrorCheck.score * 100)}%`);
   
    // Тест PCA
    console.log('\n📐 ТЕСТ PCA:');
    const points = nodes1.map(n => ({x: n.x, y: n.y}));
    const pca = TopologyUtils.calculatePCA(points);
    if (pca) {
        console.log(`Объясненная дисперсия: ${Math.round(pca.explainedVariance * 100)}%`);
        console.log(`Главная ось: [${pca.eigenvectors[0].x.toFixed(3)}, ${pca.eigenvectors[0].y.toFixed(3)}]`);
    }
   
    console.log('\n✅ ТЕСТ ЗАВЕРШЕН\n');
   
    return comparison.score > 0.7;
}

// Запускаем тест
if (require.main === module) {
    testTopologyCorrection().then(success => {
        if (success) {
            console.log('🎉 Тест пройден успешно!');
            console.log('\n💡 Следующие шаги:');
            console.log('1. Обновить footprint-manager.js для использования compareEnhanced');
            console.log('2. Добавить умный поиск в main.js');
            console.log('3. Протестировать на реальных данных');
            process.exit(0);
        } else {
            console.log('⚠️ Тест показал низкую оценку, требуется настройка');
            process.exit(1);
        }
    }).catch(error => {
        console.log('❌ Ошибка теста:', error);
        process.exit(1);
    });
}

module.exports = testTopologyCorrection;
