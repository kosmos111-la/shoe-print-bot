// test-final-invariant-system.js
const SimpleGraph = require('./modules/footprint/simple-graph');
const SimpleGraphMatcher = require('./modules/footprint/simple-matcher');

async function testFinalInvariantSystem() {
    console.log('🎯 ФИНАЛЬНЫЙ ТЕСТ ИНВАРИАНТНОЙ СИСТЕМЫ\n');
   
    // Более реалистичные тесты с большим количеством точек
    const testCases = [
        {
            name: "1. Одинаковые следы (реалистичные 15 точек)",
            points1: createShoeShape(15, 100, 100, 200),
            points2: createShoeShape(15, 100, 100, 200),
            expected: "same"
        },
        {
            name: "2. Разный масштаб (в 2 раза больше)",
            points1: createShoeShape(15, 100, 100, 200),
            points2: createShoeShape(15, 200, 200, 400),
            expected: "same"
        },
        {
            name: "3. Разное положение (+300, +200)",
            points1: createShoeShape(15, 100, 100, 200),
            points2: createShoeShape(15, 400, 300, 200),
            expected: "same"
        },
        {
            name: "4. Разные формы (разные узоры)",
            points1: createShoeShape(15, 100, 100, 200),
            points2: createRandomShape(15, 100, 100, 200),
            expected: "different"
        },
        {
            name: "5. Похожие но разные (немного другой узор)",
            points1: createShoeShape(10, 100, 100, 200),
            points2: createSimilarShoeShape(10, 100, 100, 200),
            expected: "similar"
        }
    ];
   
    const matcher = new SimpleGraphMatcher({
        debug: false,
        sameThreshold: 0.7,
        similarThreshold: 0.4,
        minNodeRatio: 0.5
    });
   
    let passedTests = 0;
    let totalTests = testCases.length;
   
    for (const testCase of testCases) {
        console.log(`\n${testCase.name}`);
        console.log('-'.repeat(60));
       
        const graph1 = new SimpleGraph('Тест 1');
        const graph2 = new SimpleGraph('Тест 2');
       
        graph1.buildFromPoints(testCase.points1);
        graph2.buildFromPoints(testCase.points2);
       
        console.log(`   📊 Граф 1: ${testCase.points1.length} точек`);
        console.log(`   📊 Граф 2: ${testCase.points2.length} точек`);
       
        const result = matcher.compareGraphs(graph1, graph2, {
            testCase: testCase.name,
            invariant: true
        });
       
        console.log(`   🎯 Результат: схожесть=${result.similarity.toFixed(3)}, решение=${result.decision}`);
        console.log(`   📍 Ожидалось: ${testCase.expected}`);
       
        if (result.decision === testCase.expected) {
            console.log(`   ✅ ТЕСТ ПРОЙДЕН`);
            passedTests++;
        } else {
            console.log(`   ❌ ТЕСТ НЕ ПРОЙДЕН`);
            console.log(`   💡 Причина: ${result.reason}`);
           
            // Показываем детали если есть
            if (result.details && result.details.basic) {
                const worstMatch = result.details.basic.comparisons
                    .reduce((worst, curr) => curr.score < worst.score ? curr : worst);
                console.log(`   📉 Самый слабый показатель: ${worstMatch.name}=${worstMatch.score.toFixed(3)}`);
            }
        }
    }
   
    console.log('\n' + '='.repeat(60));
    console.log(`📊 ИТОГОВАЯ СТАТИСТИКА: ${passedTests}/${totalTests} тестов пройдено`);
    console.log(`🎯 УСПЕШНОСТЬ: ${(passedTests/totalTests*100).toFixed(1)}%`);
   
    if (passedTests === totalTests) {
        console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! СИСТЕМА ГОТОВА К ПРОИЗВОДСТВУ!');
        console.log('\n✅ ИНВАРИАНТНОСТЬ ПОДТВЕРЖДЕНА:');
        console.log('   - Масштаб не влияет на распознавание');
        console.log('   - Положение не влияет на распознавание');
        console.log('   - Формы корректно сравниваются');
        console.log('   - Разные следы корректно отличаются');
        console.log('   - Похожие следы отмечаются как similar');
    } else if (passedTests >= totalTests * 0.8) {
        console.log('\n⚠️ ХОРОШИЙ РЕЗУЛЬТАТ, НО МОЖНО ЛУЧШЕ');
        console.log(`   ${totalTests - passedTests} тест(ов) требуют доработки`);
    } else {
        console.log('\n🔧 ТРЕБУЮТСЯ ДОПОЛНИТЕЛЬНЫЕ ИСПРАВЛЕНИЯ');
    }
}

// 🔥 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

// Создает форму "стопы"
function createShoeShape(count, offsetX, offsetY, size) {
    const points = [];
    const rows = Math.ceil(count / 5);
   
    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
       
        // Форма стопы: шире в середине, уже по краям
        const widthFactor = 0.3 + Math.sin(col * Math.PI / 4) * 0.7;
        const heightFactor = 0.2 + row * 0.6;
       
        points.push({
            x: offsetX + col * (size / 4) * widthFactor,
            y: offsetY + row * (size / rows) * heightFactor,
            confidence: 0.7 + Math.random() * 0.3,
            id: `p_${i}`
        });
    }
   
    return points;
}

// Создает случайную форму
function createRandomShape(count, offsetX, offsetY, size) {
    const points = [];
   
    for (let i = 0; i < count; i++) {
        points.push({
            x: offsetX + Math.random() * size,
            y: offsetY + Math.random() * size,
            confidence: 0.7 + Math.random() * 0.3,
            id: `random_${i}`
        });
    }
   
    return points;
}

// Создает похожую но немного другую форму стопы
function createSimilarShoeShape(count, offsetX, offsetY, size) {
    const points = [];
    const baseShape = createShoeShape(count, 0, 0, size);
   
    // Немного изменяем форму
    baseShape.forEach((point, i) => {
        points.push({
            x: offsetX + point.x + (Math.random() - 0.5) * size * 0.1,
            y: offsetY + point.y + (Math.random() - 0.5) * size * 0.1,
            confidence: point.confidence,
            id: `similar_${i}`
        });
    });
   
    return points;
}

// Запускаем финальный тест
testFinalInvariantSystem().catch(console.error);
