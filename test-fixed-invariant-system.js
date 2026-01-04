// test-fixed-invariant-system.js
const SimpleGraph = require('./modules/footprint/simple-graph');
const SimpleGraphMatcher = require('./modules/footprint/simple-matcher');

async function testFixedInvariantSystem() {
    console.log('🧪 ТЕСТ ИСПРАВЛЕННОЙ ИНВАРИАНТНОЙ СИСТЕМЫ\n');

    // Тестируем 4 сценария
    const testCases = [
        {
            name: "1. Одинаковые графы (точное совпадение)",
            points1: [
                {x: 100, y: 100}, {x: 150, y: 120}, {x: 200, y: 110},
                {x: 250, y: 130}, {x: 300, y: 100}
            ],
            points2: [
                {x: 100, y: 100}, {x: 150, y: 120}, {x: 200, y: 110},
                {x: 250, y: 130}, {x: 300, y: 100}
            ],
            expected: "same"
        },
        {
            name: "2. Разный масштаб (2x увеличение)",
            points1: [
                {x: 100, y: 100}, {x: 150, y: 120}, {x: 200, y: 110}
            ],
            points2: [
                {x: 200, y: 200}, {x: 300, y: 240}, {x: 400, y: 220}
            ],
            expected: "same"
        },
        {
            name: "3. Разное положение (сдвиг +200, +150)",
            points1: [
                {x: 100, y: 100}, {x: 150, y: 120}, {x: 200, y: 110}
            ],
            points2: [
                {x: 300, y: 250}, {x: 350, y: 270}, {x: 400, y: 260}
            ],
            expected: "same"
        },
        {
            name: "4. Разная форма (должно быть different)",
            points1: [
                {x: 100, y: 100}, {x: 150, y: 120}, {x: 200, y: 110}
            ],
            points2: [
                {x: 100, y: 300}, {x: 300, y: 100}, {x: 200, y: 400}
            ],
            expected: "different"
        }
    ];

    const matcher = new SimpleGraphMatcher({
        debug: false,
        sameThreshold: 0.7,
        similarThreshold: 0.4
    });

    let passedTests = 0;
    let totalTests = testCases.length;

    for (const testCase of testCases) {
        console.log(`\n${testCase.name}`);
        console.log('-'.repeat(50));

        const graph1 = new SimpleGraph('Тест 1');
        const graph2 = new SimpleGraph('Тест 2');

        const points1 = testCase.points1.map((p, i) => ({
            x: p.x, y: p.y, confidence: 0.8, id: `p1_${i}`
        }));

        const points2 = testCase.points2.map((p, i) => ({
            x: p.x, y: p.y, confidence: 0.8, id: `p2_${i}`
        }));

        graph1.buildFromPoints(points1);
        graph2.buildFromPoints(points2);

        console.log(`   Граф 1: ${points1.length} точек, область: ${getBounds(points1)}`);
        console.log(`   Граф 2: ${points2.length} точек, область: ${getBounds(points2)}`);

        const result = matcher.compareGraphs(graph1, graph2, {
            testCase: testCase.name,
            invariant: true
        });

        console.log(`   📊 Результат: схожесть=${result.similarity.toFixed(3)}, решение=${result.decision}`);
        console.log(`   Ожидалось: ${testCase.expected}`);

        if (result.decision === testCase.expected) {
            console.log(`   ✅ ТЕСТ ПРОЙДЕН`);
            passedTests++;
        } else {
            console.log(`   ❌ ТЕСТ НЕ ПРОЙДЕН`);
            console.log(`   Причина: ${result.reason}`);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 ИТОГ: ${passedTests}/${totalTests} тестов пройдено`);

    if (passedTests === totalTests) {
        console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! ИНВАРИАНТНОСТЬ РАБОТАЕТ!');
        console.log('\n✅ Система распознаёт:');
        console.log('   - Одинаковые следы');
        console.log('   - Следы с разным масштабом');
        console.log('   - Следы в разном положении');
        console.log('   - Разные следы (корректно отличает)');
    } else {
        console.log('⚠️ Некоторые тесты не пройдены');
    }
}

function getBounds(points) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return `${Math.min(...xs)}-${Math.max(...xs)}x${Math.min(...ys)}-${Math.max(...ys)}`;
}

testFixedInvariantSystem().catch(console.error);
