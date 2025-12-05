// test-topology.js
const DigitalFootprint = require('./modules/footprint/digital-footprint');
const TopologyUtils = require('./modules/footprint/topology-utils');

async function runTests() {
    console.log('🧪 === ЗАПУСК ТЕСТОВ ТОПОЛОГИЧЕСКОЙ КОРРЕКЦИИ ===\n');
  
    let passedTests = 0;
    let totalTests = 0;
  
    // 📌 ТЕСТ 1: Создание и нормализация модели
    console.log('📌 ТЕСТ 1: Создание и нормализация модели');
    try {
        const model1 = new DigitalFootprint({
            name: 'Тестовая модель 1',
            userId: 'test_user'
        });
      
        // Добавляем узлы (квадрат 100x100)
        const nodes = [
            {x: 100, y: 100, confidence: 0.9},
            {x: 200, y: 100, confidence: 0.8},
            {x: 200, y: 200, confidence: 0.9},
            {x: 100, y: 200, confidence: 0.8}
        ];
      
        nodes.forEach((node, i) => {
            model1.nodes.set(`node_${i}`, {
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
      
        // Обновляем топологические инварианты
        model1.updateTopologyInvariants();
      
        const topologyInfo = model1.getTopologyInfo();
      
        if (topologyInfo.normalizedNodes === 4) {
            console.log('✅ ТЕСТ 1 ПРОЙДЕН: Модель создана и нормализована');
            passedTests++;
        } else {
            console.log('❌ ТЕСТ 1 ПРОВАЛЕН: Не все узлы нормализованы');
        }
      
        totalTests++;
      
    } catch (error) {
        console.log('❌ ТЕСТ 1 ПРОВАЛЕН с ошибкой:', error.message);
        totalTests++;
    }
  
    // 📌 ТЕСТ 2: Сравнение одинаковых моделей (ИСПРАВЛЕНО!)
    console.log('\n📌 ТЕСТ 2: Сравнение одинаковых моделей');
    try {
        const model1 = new DigitalFootprint({ name: 'Модель А' });
        const model2 = new DigitalFootprint({ name: 'Модель А (копия)' });
      
        // Одинаковые узлы
        const nodes = [
            {x: 50, y: 50}, {x: 150, y: 50},
            {x: 150, y: 150}, {x: 50, y: 150}
        ];
      
        nodes.forEach((pos, i) => {
            const nodeData = {
                id: `node_${i}`,
                center: pos,
                confidence: 0.9,
                size: 15,
                confirmationCount: 1,
                sources: []
            };
          
            model1.nodes.set(`node_${i}`, nodeData);
            model2.nodes.set(`node_${i}`, {...nodeData});
        });
      
        // 🔥 ДОБАВЛЯЕМ РЕБРА В ОБЕ МОДЕЛИ!
        const edges = [
            {from: 'node_0', to: 'node_1', confidence: 0.9},
            {from: 'node_1', to: 'node_2', confidence: 0.9},
            {from: 'node_2', to: 'node_3', confidence: 0.9},
            {from: 'node_3', to: 'node_0', confidence: 0.9}
        ];
        model1.edges = edges;
        model2.edges = edges;
      
        // Обновляем инварианты
        model1.updateTopologyInvariants();
        model2.updateTopologyInvariants();
      
        // Сравниваем
        const comparison = model1.compareEnhanced(model2);
      
        // 🔥 ПОВЫШАЕМ ПОРОГ ДЛЯ УЧЕТА ПОГРЕШНОСТЕЙ
        if (comparison.score > 0.95) { // Было > 0.9
            console.log(`✅ ТЕСТ 2 ПРОЙДЕН: Одинаковые модели дают высокий score: ${(comparison.score * 100).toFixed(1)}%`);
            passedTests++;
        } else {
            console.log(`❌ ТЕСТ 2 ПРОВАЛЕН: Score слишком низкий: ${(comparison.score * 100).toFixed(1)}%`);
            console.log('   Детали:');
            console.log(`   • Топология: ${(comparison.details.topology * 100).toFixed(1)}%`);
            console.log(`   • Граф: ${(comparison.details.graph * 100).toFixed(1)}%`);
            console.log(`   • Геометрия: ${(comparison.details.geometry * 100).toFixed(1)}%`);
        }
      
        totalTests++;
      
    } catch (error) {
        console.log('❌ ТЕСТ 2 ПРОВАЛЕН с ошибкой:', error.message);
        console.log(error.stack);
        totalTests++;
    }
  
    // 📌 ТЕСТ 3: Сравнение с масштабированием
    console.log('\n📌 ТЕСТ 3: Сравнение с масштабированием 2x');
    try {
        const model1 = new DigitalFootprint({ name: 'Оригинал' });
        const model2 = new DigitalFootprint({ name: 'Масштаб 2x' });
      
        // Оригинальные узлы
        const originalNodes = [
            {x: 100, y: 100}, {x: 200, y: 100},
            {x: 200, y: 200}, {x: 100, y: 200}
        ];
      
        // Масштабированные узлы (в 2 раза больше)
        const scaledNodes = originalNodes.map(node => ({
            x: node.x * 2,
            y: node.y * 2
        }));
      
        originalNodes.forEach((pos, i) => {
            model1.nodes.set(`node_${i}`, {
                id: `node_${i}`,
                center: pos,
                confidence: 0.9,
                size: 15,
                confirmationCount: 1,
                sources: []
            });
        });
      
        scaledNodes.forEach((pos, i) => {
            model2.nodes.set(`node_${i}`, {
                id: `node_${i}`,
                center: pos,
                confidence: 0.9,
                size: 15,
                confirmationCount: 1,
                sources: []
            });
        });
      
        // 🔥 ДОБАВЛЯЕМ РЕБРА В ОБЕ МОДЕЛИ
        const edges = [
            {from: 'node_0', to: 'node_1', confidence: 0.9},
            {from: 'node_1', to: 'node_2', confidence: 0.9},
            {from: 'node_2', to: 'node_3', confidence: 0.9},
            {from: 'node_3', to: 'node_0', confidence: 0.9}
        ];
        model1.edges = edges;
        model2.edges = edges;
      
        model1.updateTopologyInvariants();
        model2.updateTopologyInvariants();
      
        const comparison = model1.compareEnhanced(model2);
      
        // Топологическое сравнение должно быть хорошим даже при разном масштабе
        if (comparison.details.topology > 0.9) { // Повышаем порог
            console.log(`✅ ТЕСТ 3 ПРОЙДЕН: Топология устойчива к масштабированию: ${(comparison.details.topology * 100).toFixed(1)}%`);
            passedTests++;
        } else {
            console.log(`❌ ТЕСТ 3 ПРОВАЛЕН: Топология не устойчива к масштабированию: ${(comparison.details.topology * 100).toFixed(1)}%`);
        }
      
        totalTests++;
      
    } catch (error) {
        console.log('❌ ТЕСТ 3 ПРОВАЛЕН с ошибкой:', error.message);
        totalTests++;
    }
  
    // 📌 ТЕСТ 4: Проверка зеркальности
    console.log('\n📌 ТЕСТ 4: Проверка зеркальной симметрии');
    try {
        const model1 = new DigitalFootprint({ name: 'Оригинал' });
        const model2 = new DigitalFootprint({ name: 'Зеркальная копия' });
      
        // Оригинальные узлы
        const nodes = [
            {x: 100, y: 100}, {x: 200, y: 100},
            {x: 200, y: 200}, {x: 100, y: 200}
        ];
      
        // Зеркальные узлы (отражение по X)
        const mirroredNodes = nodes.map(node => ({
            x: 300 - node.x, // Зеркалим относительно x=150
            y: node.y
        }));
      
        nodes.forEach((pos, i) => {
            model1.nodes.set(`node_${i}`, {
                id: `node_${i}`,
                center: pos,
                confidence: 0.9,
                size: 15,
                confirmationCount: 1,
                sources: []
            });
        });
      
        mirroredNodes.forEach((pos, i) => {
            model2.nodes.set(`node_${i}`, {
                id: `node_${i}`,
                center: pos,
                confidence: 0.9,
                size: 15,
                confirmationCount: 1,
                sources: []
            });
        });
      
        // 🔥 ДОБАВЛЯЕМ РЕБРА В ОБЕ МОДЕЛИ
        const edges = [
            {from: 'node_0', to: 'node_1', confidence: 0.9},
            {from: 'node_1', to: 'node_2', confidence: 0.9},
            {from: 'node_2', to: 'node_3', confidence: 0.9},
            {from: 'node_3', to: 'node_0', confidence: 0.9}
        ];
        model1.edges = edges;
        model2.edges = edges;
      
        model1.updateTopologyInvariants();
        model2.updateTopologyInvariants();
      
        const mirrorCheck = model1.checkMirrorSymmetry(model2);
      
        if (mirrorCheck.isMirrored) {
            console.log(`✅ ТЕСТ 4 ПРОЙДЕН: Зеркальность обнаружена (score: ${(mirrorCheck.score * 100).toFixed(1)}%)`);
            passedTests++;
        } else {
            console.log(`❌ ТЕСТ 4 ПРОВАЛЕН: Зеркальность не обнаружена`);
            console.log(`   Расстояния: оригинал=${mirrorCheck.originalDistance.toFixed(2)}, зеркало=${mirrorCheck.mirroredDistance.toFixed(2)}`);
        }
      
        totalTests++;
      
    } catch (error) {
        console.log('❌ ТЕСТ 4 ПРОВАЛЕН с ошибкой:', error.message);
        totalTests++;
    }
  
    // 📌 ТЕСТ 5: Графовые инварианты
    console.log('\n📌 ТЕСТ 5: Графовые инварианты');
    try {
        const model = new DigitalFootprint({ name: 'Тест графа' });
      
        // Создаем полный граф на 4 узлах
        const positions = [
            {x: 100, y: 100}, {x: 200, y: 100},
            {x: 200, y: 200}, {x: 100, y: 200}
        ];
      
        positions.forEach((pos, i) => {
            model.nodes.set(`node_${i}`, {
                id: `node_${i}`,
                center: pos,
                confidence: 0.9,
                size: 15,
                confirmationCount: 1,
                sources: []
            });
        });
      
        // Все возможные связи (полный граф)
        model.edges = [];
        for (let i = 0; i < 4; i++) {
            for (let j = i + 1; j < 4; j++) {
                model.edges.push({
                    from: `node_${i}`,
                    to: `node_${j}`,
                    confidence: 0.9
                });
            }
        }
      
        model.updateTopologyInvariants();
      
        // В полном графе на 4 узлах:
        // - Диаметр = 1 (все узлы соединены напрямую)
        // - Коэффициент кластеризации = 1 (все треугольники существуют)
      
        if (model.topologyInvariants.graphDiameter === 1 &&
            Math.abs(model.topologyInvariants.clusteringCoefficient - 1) < 0.01) {
            console.log('✅ ТЕСТ 5 ПРОЙДЕН: Графовые инварианты вычислены правильно');
            passedTests++;
        } else {
            console.log(`❌ ТЕСТ 5 ПРОВАЛЕН: Диаметр=${model.topologyInvariants.graphDiameter}, ` +
                       `Кластеризация=${model.topologyInvariants.clusteringCoefficient}`);
        }
      
        totalTests++;
      
    } catch (error) {
        console.log('❌ ТЕСТ 5 ПРОВАЛЕН с ошибкой:', error.message);
        totalTests++;
    }
  
    // 📌 ТЕСТ 6: Сериализация и десериализация
    console.log('\n📌 ТЕСТ 6: Сериализация топологических данных');
    try {
        const originalModel = new DigitalFootprint({
            name: 'Модель для сериализации',
            userId: 'test_user'
        });
      
        // Добавляем данные
        for (let i = 0; i < 5; i++) {
            originalModel.nodes.set(`node_${i}`, {
                id: `node_${i}`,
                center: {x: Math.random() * 300, y: Math.random() * 300},
                confidence: 0.7 + Math.random() * 0.3,
                size: 10 + Math.random() * 10,
                confirmationCount: 1,
                sources: []
            });
        }
      
        // 🔥 ДОБАВЛЯЕМ РЕБРА
        originalModel.edges = [
            {from: 'node_0', to: 'node_1', confidence: 0.8},
            {from: 'node_1', to: 'node_2', confidence: 0.8},
            {from: 'node_2', to: 'node_3', confidence: 0.8},
            {from: 'node_3', to: 'node_4', confidence: 0.8}
        ];
      
        originalModel.updateTopologyInvariants();
      
        // Сериализуем
        const json = originalModel.toJSON();
      
        // Десериализуем
        const restoredModel = DigitalFootprint.fromJSON(json);
      
        // Проверяем что топологические данные сохранились
        if (restoredModel.topologyInvariants.normalizedNodes &&
            restoredModel.topologyInvariants.normalizedNodes.size === 5) {
            console.log('✅ ТЕСТ 6 ПРОЙДЕН: Топологические данные сохранились при сериализации');
            passedTests++;
        } else {
            console.log('❌ ТЕСТ 6 ПРОВАЛЕН: Топологические данные потерялись');
            console.log('   Оригинальная модель:', originalModel.topologyInvariants.normalizedNodes?.size);
            console.log('   Восстановленная модель:', restoredModel.topologyInvariants.normalizedNodes?.size);
        }
      
        totalTests++;
      
    } catch (error) {
        console.log('❌ ТЕСТ 6 ПРОВАЛЕН с ошибкой:', error.message);
        totalTests++;
    }
  
    // 📊 ИТОГИ
    console.log('\n📊 === ИТОГИ ТЕСТИРОВАНИЯ ===');
    console.log(`✅ Пройдено: ${passedTests}/${totalTests} тестов`);
    console.log(`📈 Успешность: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
    if (passedTests === totalTests) {
        console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
        console.log('🚀 Система топологической коррекции готова к использованию.');
        return true;
    } else {
        console.log('\n⚠️ НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ');
        console.log('🔧 Требуется отладка перед внедрением.');
        return false;
    }
}

// Запускаем тесты
if (require.main === module) {
    runTests().then(success => {
        if (success) {
            console.log('\n💡 Следующие шаги:');
            console.log('1. Обновить footprint-manager.js');
            console.log('2. Интегрировать в main.js');
            console.log('3. Протестировать на реальных данных');
            process.exit(0);
        } else {
            process.exit(1);
        }
    }).catch(error => {
        console.log('💥 КРИТИЧЕСКАЯ ОШИБКА:', error);
        process.exit(1);
    });
}

module.exports = { runTests };
