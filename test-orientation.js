// test-orientation.js
const DigitalFootprint = require('./modules/footprint/digital-footprint');
const TopologyUtils = require('./modules/footprint/topology-utils');

async function testDifferentOrientations() {
    console.log('🧪 ТЕСТИРУЕМ РАЗНЫЕ ОРИЕНТАЦИИ ФОТО\n');
   
    // Создаем 4 модели с разными ориентациями
    const orientations = [
        { name: 'Оригинал (горизонтальный)', angle: 0 },
        { name: 'Повернут на 90°', angle: 90 },
        { name: 'Повернут на 180° (перевернут)', angle: 180 },
        { name: 'Повернут на 270°', angle: 270 }
    ];
   
    const models = [];
   
    // Создаем базовые узлы (прямоугольник)
    const baseNodes = [
        {x: 100, y: 50},  // Верхний левый
        {x: 300, y: 50},  // Верхний правый 
        {x: 300, y: 200}, // Нижний правый
        {x: 100, y: 200}  // Нижний левый
    ];
   
    // Создаем модели с разными ориентациями
    for (const orientation of orientations) {
        const model = new DigitalFootprint({
            name: orientation.name,
            userId: 'test'
        });
       
        // Поворачиваем узлы
        const angleRad = (orientation.angle * Math.PI) / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
       
        baseNodes.forEach((pos, i) => {
            // Поворачиваем вокруг центра (200, 125)
            const x = pos.x - 200;
            const y = pos.y - 125;
           
            const rotatedX = x * cos - y * sin;
            const rotatedY = x * sin + y * cos;
           
            model.nodes.set(`node_${i}`, {
                id: `node_${i}`,
                center: {x: rotatedX + 200, y: rotatedY + 125},
                confidence: 0.9,
                size: 15,
                confirmationCount: 1,
                sources: []
            });
        });
       
        // Добавляем связи (квадрат)
        model.edges = [
            {from: 'node_0', to: 'node_1', confidence: 0.9},
            {from: 'node_1', to: 'node_2', confidence: 0.9},
            {from: 'node_2', to: 'node_3', confidence: 0.9},
            {from: 'node_3', to: 'node_0', confidence: 0.9}
        ];
       
        // Обновляем топологические инварианты
        model.updateTopologyInvariants();
        models.push(model);
       
        console.log(`📐 ${orientation.name}:`);
        console.log(`   Угол: ${orientation.angle}°`);
       
        // Выводим PCA информацию
        const normalizedNodes = Array.from(model.topologyInvariants.normalizedNodes.values());
        if (normalizedNodes.length > 0) {
            const pca = TopologyUtils.calculatePCA(normalizedNodes.map(n => ({x: n.x, y: n.y})));
            if (pca) {
                const principalAngle = Math.atan2(pca.eigenvectors[0].y, pca.eigenvectors[0].x) * 180 / Math.PI;
                console.log(`   PCA главная ось: ${principalAngle.toFixed(1)}°`);
                console.log(`   Объясненная дисперсия: ${(pca.explainedVariance * 100).toFixed(1)}%`);
            }
        }
    }
   
    // Сравниваем все модели с оригиналом
    console.log('\n🔍 СРАВНЕНИЕ С ОРИГИНАЛОМ:');
    const originalModel = models[0];
   
    for (let i = 1; i < models.length; i++) {
        const testModel = models[i];
        const comparison = originalModel.compareEnhanced(testModel);
       
        console.log(`\n${testModel.name}:`);
        console.log(`   Общая оценка: ${(comparison.score * 100).toFixed(1)}%`);
        console.log(`   Топология: ${(comparison.details.topology * 100).toFixed(1)}%`);
        console.log(`   Граф: ${(comparison.details.graph * 100).toFixed(1)}%`);
        console.log(`   Геометрия: ${(comparison.details.geometry * 100).toFixed(1)}%`);
        console.log(`   Зеркальность: ${comparison.isMirrored ? 'да' : 'нет'}`);
    }
   
    // Тест зеркального отражения (правый/левый)
    console.log('\n🪞 ТЕСТ ЗЕРКАЛЬНОГО ОТРАЖЕНИЯ:');
    const mirrorModel = new DigitalFootprint({
        name: 'Зеркальная копия',
        userId: 'test'
    });
   
    // Зеркально отражаем оригинал по X
    baseNodes.forEach((pos, i) => {
        mirrorModel.nodes.set(`node_${i}`, {
            id: `node_${i}`,
            center: {x: 400 - pos.x, y: pos.y}, // Зеркало относительно x=200
            confidence: 0.9,
            size: 15,
            confirmationCount: 1,
            sources: []
        });
    });
   
    mirrorModel.edges = originalModel.edges;
    mirrorModel.updateTopologyInvariants();
   
    const mirrorComparison = originalModel.compareEnhanced(mirrorModel);
    console.log(`   Общая оценка: ${(mirrorComparison.score * 100).toFixed(1)}%`);
    console.log(`   Топология: ${(mirrorComparison.details.topology * 100).toFixed(1)}%`);
    console.log(`   Граф: ${(mirrorComparison.details.graph * 100).toFixed(1)}%`);
    console.log(`   Геометрия: ${(mirrorComparison.details.geometry * 100).toFixed(1)}%`);
    console.log(`   Зеркальность: ${mirrorComparison.isMirrored ? 'ДА! ✅' : 'нет'}`);
   
    // Вывод
    console.log('\n📊 ВЫВОДЫ:');
    console.log('1. PCA должен выравнивать главную ось для всех ориентаций');
    console.log('2. Нормализованные узлы должны быть сопоставимы');
    console.log('3. Зеркальные копии должны обнаруживаться');
   
    return models;
}

// Запускаем тест
if (require.main === module) {
    testDifferentOrientations().then(models => {
        console.log('\n✅ Тест завершен');
       
        // Проверяем результаты
        const originalModel = models[0];
        let allPassed = true;
       
        for (let i = 1; i < models.length; i++) {
            const comparison = originalModel.compareEnhanced(models[i]);
            if (comparison.score < 0.7) {
                console.log(`⚠️  Низкая оценка для ${models[i].name}: ${(comparison.score * 100).toFixed(1)}%`);
                allPassed = false;
            }
        }
       
        if (allPassed) {
            console.log('🎉 Все ориентации корректно обрабатываются!');
            process.exit(0);
        } else {
            console.log('🔧 Требуется настройка обработки ориентаций');
            process.exit(1);
        }
    }).catch(error => {
        console.log('❌ Ошибка теста:', error);
        process.exit(1);
    });
}

module.exports = testDifferentOrientations;
