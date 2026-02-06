// test-topology-algorithm.js
// 🧪 ТЕСТ ТОПОЛОГИЧЕСКОГО АЛГОРИТМА С РЕАЛЬНЫМИ ДАННЫМИ

const TopologyAlgorithm = require('./modules/footprint/clean/topology-algorithm');

// Генератор реалистичных центров деталей (50-90 точек)
function generateCenters(pointCount = 70, patternType = 'ellipse') {
    const centers = [];
   
    if (patternType === 'ellipse') {
        // Эллиптическое расположение (как след)
        const width = 300 + Math.random() * 100;
        const height = 450 + Math.random() * 150;
       
        for (let i = 0; i < pointCount; i++) {
            const angle = (i / pointCount) * 2 * Math.PI;
            const radiusX = width / 2 * (0.6 + 0.4 * Math.sin(angle * 5));
            const radiusY = height / 2 * (0.5 + 0.5 * Math.cos(angle * 3));
           
            centers.push({
                x: 500 + radiusX * Math.cos(angle) + (Math.random() - 0.5) * 20,
                y: 500 + radiusY * Math.sin(angle) + (Math.random() - 0.5) * 20,
                confidence: 0.8 + Math.random() * 0.2
            });
        }
    } else {
        // Случайное распределение (другая форма)
        for (let i = 0; i < pointCount; i++) {
            centers.push({
                x: 300 + Math.random() * 400,
                y: 300 + Math.random() * 400,
                confidence: 0.8 + Math.random() * 0.2
            });
        }
    }
   
    return centers;
}

async function testTopologyAlgorithm() {
    console.log('🧪 ТЕСТ ТОПОЛОГИЧЕСКОГО АЛГОРИТМА\n');
   
    const algorithm = new TopologyAlgorithm({
        debug: true,
        minPoints: 20,
        similarityThreshold: 0.6,
        neighborsCount: 10,
        rotationStep: 10
    });
   
    console.log('1. 📐 ТЕСТ 1: ОДИНАКОВЫЕ ТОПОЛОГИИ (70 точек)');
    console.log('='.repeat(60));
   
    const centers1 = generateCenters(70, 'ellipse');
    const centers2 = JSON.parse(JSON.stringify(centers1)); // Копия
   
    // Добавляем небольшой шум и поворот
    const angle = 30 * Math.PI / 180;
    centers2.forEach((center, i) => {
        const dx = center.x - 500;
        const dy = center.y - 500;
        center.x = 500 + dx * Math.cos(angle) - dy * Math.sin(angle) + (Math.random() - 0.5) * 15;
        center.y = 500 + dx * Math.sin(angle) + dy * Math.cos(angle) + (Math.random() - 0.5) * 15;
    });
   
    const result1 = algorithm.comparePoints(centers1, centers2, 'Топология 1', 'Топология 2 (повернутая)');
    console.log(`   Результат: ${result1.decision}, схожесть: ${result1.similarity.toFixed(3)}`);
    console.log(`   Ожидается: SAME (та же топология, повернутая на 30°)`);
   
    console.log('\n2. 📐 ТЕСТ 2: ЧАСТИЧНАЯ ТОПОЛОГИЯ (70 vs 50 точек)');
    console.log('='.repeat(60));
   
    const partialCenters = centers1.slice(0, 50); // Берем 50 из 70 точек
    const result2 = algorithm.comparePoints(centers1, partialCenters, 'Топология 1 (70 точек)', 'Частичная (50 точек)');
    console.log(`   Результат: ${result2.decision}, схожесть: ${result2.similarity.toFixed(3)}`);
    console.log(`   Ожидается: SAME (большая часть точек совпадает)`);
   
    console.log('\n3. 📐 ТЕСТ 3: СОВСЕМ ДРУГАЯ ТОПОЛОГИЯ');
    console.log('='.repeat(60));
   
    const differentCenters = generateCenters(65, 'random'); // Случайное распределение
    const result3 = algorithm.comparePoints(centers1, differentCenters, 'Эллиптическая', 'Случайная');
    console.log(`   Результат: ${result3.decision}, схожесть: ${result3.similarity.toFixed(3)}`);
    console.log(`   Ожидается: DIFFERENT (разные паттерны распределения)`);
   
    console.log('\n4. 📐 ТЕСТ 4: МАЛО ТОЧЕК (< 20)');
    console.log('='.repeat(60));
   
    const fewCenters = centers1.slice(0, 15);
    const result4 = algorithm.comparePoints(centers1, fewCenters, 'Топология 1 (70 точек)', 'Мало точек (15)');
    console.log(`   Результат: ${result4.decision}, схожесть: ${result4.similarity.toFixed(3)}`);
    console.log(`   Ожидается: DIFFERENT (недостаточно точек для анализа)`);
   
    console.log('\n📊 ИТОГИ ТЕСТА:');
    console.log('='.repeat(60));
   
    const tests = [
        { name: 'Одинаковые топологии', result: result1, expected: 'same' },
        { name: 'Частичная топология', result: result2, expected: 'same' },
        { name: 'Разные топологии', result: result3, expected: 'different' },
        { name: 'Мало точек', result: result4, expected: 'different' }
    ];
   
    let passed = 0;
    tests.forEach((test, idx) => {
        const passedTest = test.result.decision === test.expected;
        if (passedTest) passed++;
       
        const icon = passedTest ? '✅' : '❌';
        console.log(`${idx + 1}. ${test.name}: ${icon} (${test.result.decision}, схожесть: ${test.result.similarity.toFixed(3)})`);
    });
   
    console.log(`\n🎯 Результат: ${passed}/${tests.length} тестов пройдено`);
   
    if (passed === tests.length) {
        console.log('✅ ТОПОЛОГИЧЕСКИЙ АЛГОРИТМ РАБОТАЕТ КОРРЕКТНО!');
       
        // Дополнительная информация
        console.log('\n💡 ХАРАКТЕРИСТИКИ АЛГОРИТМА:');
        console.log('   • Инвариантен к повороту (ищет наилучшее соответствие)');
        console.log('   • Устойчив к шуму (допуск 15px для совпадения точек)');
        console.log('   • Работает с частичными данными (50 из 70 точек)');
        console.log('   • Не зависит от ID точек (сравнивает только геометрию)');
        console.log('   • Оптимизирован для 50-90 точек');
    } else {
        console.log('⚠️ ТРЕБУЕТСЯ ДОРАБОТКА');
    }
}

testTopologyAlgorithm().catch(console.error);
```

🚀 ИНТЕГРАЦИЯ С МЕНЕДЖЕРОМ:

Обновим менеджер для использования нового алгоритма:

```javascript
// В modules/footprint/clean/manager.js заменяем загрузку алгоритма:

// 🔥 ЗАГРУЗИМ ТОПОЛОГИЧЕСКИЙ АЛГОРИТМ
try {
    this.TopologyAlgorithm = require('./topology-algorithm');
    console.log('✅ Топологический алгоритм загружен');
} catch (error) {
    console.log('⚠️ Топологический алгоритм не найден');
    this.TopologyAlgorithm = null;
}

// В методе compareFootprints:
if (this.TopologyAlgorithm) {
    const topologyAlgo = new this.TopologyAlgorithm({
        debug: this.config.debug,
        minPoints: 20,
        similarityThreshold: this.config.similarityThreshold,
        neighborsCount: 8
    });
   
    const result = topologyAlgo.comparePoints(points1, points2);
    similarity = result.similarity;
    method = 'topology';
    console.log(`🎯 Топологический алгоритм: ${(result.similarity * 100).toFixed(1)}% схожести`);
}
