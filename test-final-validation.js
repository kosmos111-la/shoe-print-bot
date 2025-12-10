// test-final-validation.js
const HybridFootprint = require('./modules/footprint/hybrid-footprint');

console.log('🎯 ФИНАЛЬНАЯ ВАЛИДАЦИЯ С ЖЁСТКИМИ КРИТЕРИЯМИ\n');

class FootprintTest {
    constructor(name, pointsGenerator1, pointsGenerator2, expectedDecision) {
        this.name = name;
        this.points1 = pointsGenerator1();
        this.points2 = pointsGenerator2();
        this.expected = expectedDecision;
        this.fp1 = null;
        this.fp2 = null;
        this.result = null;
    }
   
    run() {
        console.log(`🧪 ${this.name}`);
       
        this.fp1 = new HybridFootprint({ name: 'Тест A' });
        this.fp2 = new HybridFootprint({ name: 'Тест B' });
       
        this.fp1.createFromPoints(this.points1);
        this.fp2.createFromPoints(this.points2);
       
        this.result = this.fp1.compare(this.fp2);
       
        const passed = this.result.decision === this.expected;
        const fastRejectOk = this.expected === 'different' ?
            (this.result.fastReject === true) : true;
       
        console.log(`   📊 Similarity: ${this.result.similarity.toFixed(3)}`);
        console.log(`   🤔 Decision: ${this.result.decision} (expected: ${this.expected})`);
        console.log(`   ⏱️ Time: ${this.result.timeMs}ms`);
        console.log(`   🚫 Fast reject: ${this.result.fastReject ? 'YES' : 'NO'}`);
        console.log(`   ✅ ${passed && fastRejectOk ? 'PASS' : 'FAIL'}\n`);
       
        return passed && fastRejectOk;
    }
}

// ТЕСТЫ
const tests = [
    new FootprintTest(
        '1. ИДЕНТИЧНЫЕ СЕТКИ',
        () => {
            const points = [];
            for (let i = 0; i < 30; i++) {
                points.push({
                    x: 100 + (i % 6) * 40,
                    y: 100 + Math.floor(i / 6) * 40,
                    confidence: 0.9
                });
            }
            return points;
        },
        () => {
            const points = [];
            for (let i = 0; i < 30; i++) {
                points.push({
                    x: 105 + (i % 6) * 40 + Math.random() * 10 - 5,
                    y: 105 + Math.floor(i / 6) * 40 + Math.random() * 10 - 5,
                    confidence: 0.9
                });
            }
            return points;
        },
        'same'
    ),
   
    new FootprintTest(
        '2. КРУГ vs ЛИНИЯ',
        () => {
            const points = [];
            for (let i = 0; i < 25; i++) {
                const angle = (i / 25) * Math.PI * 2;
                points.push({
                    x: 150 + 80 * Math.cos(angle),
                    y: 150 + 80 * Math.sin(angle),
                    confidence: 0.9
                });
            }
            return points;
        },
        () => {
            const points = [];
            for (let i = 0; i < 25; i++) {
                points.push({
                    x: 100 + i * 10,
                    y: 150 + Math.random() * 20 - 10,
                    confidence: 0.9
                });
            }
            return points;
        },
        'different'
    ),
   
    new FootprintTest(
        '3. СЛУЧАЙНЫЕ vs СЛУЧАЙНЫЕ',
        () => {
            return Array.from({length: 30}, () => ({
                x: Math.random() * 300,
                y: Math.random() * 300,
                confidence: 0.8
            }));
        },
        () => {
            return Array.from({length: 30}, () => ({
                x: Math.random() * 300,
                y: Math.random() * 300,
                confidence: 0.8
            }));
        },
        'different'
    ),
   
    new FootprintTest(
        '4. МАЛО ТОЧЕК',
        () => {
            return Array.from({length: 30}, () => ({
                x: 100 + (Math.random() * 200),
                y: 100 + (Math.random() * 200),
                confidence: 0.9
            }));
        },
        () => {
            return Array.from({length: 8}, () => ({
                x: Math.random() * 300,
                y: Math.random() * 300,
                confidence: 0.9
            }));
        },
        'different' // Должен fast reject
    ),
   
    new FootprintTest(
        '5. РАЗНЫЕ РАЗМЕРЫ',
        () => {
            const points = [];
            for (let i = 0; i < 20; i++) {
                const angle = (i / 20) * Math.PI * 2;
                points.push({
                    x: 150 + 50 * Math.cos(angle),
                    y: 150 + 50 * Math.sin(angle),
                    confidence: 0.9
                });
            }
            return points;
        },
        () => {
            const points = [];
            for (let i = 0; i < 35; i++) {
                const angle = (i / 35) * Math.PI * 2;
                points.push({
                    x: 150 + 100 * Math.cos(angle),
                    y: 150 + 100 * Math.sin(angle),
                    confidence: 0.9
                });
            }
            return points;
        },
        'similar' // Похожие формы, но разные размеры
    )
];

// ЗАПУСК ТЕСТОВ
console.log('='.repeat(60));
let passed = 0;

tests.forEach((test, index) => {
    if (test.run()) {
        passed++;
    }
    if (index < tests.length - 1) {
        console.log('-'.repeat(60));
    }
});

console.log('='.repeat(60));
console.log(`📈 ИТОГ: ${passed}/${tests.length} тестов пройдено (${Math.round(passed/tests.length*100)}%)`);

// АНАЛИЗ ОШИБОК
if (passed < tests.length) {
    console.log('\n🔍 АНАЛИЗ ОШИБОК:');
    tests.forEach((test, i) => {
        if (test.result && test.result.decision !== test.expected) {
            console.log(`\n❌ Тест ${i+1}: ${test.name}`);
            console.log(`   Ожидалось: ${test.expected}, Получено: ${test.result.decision}`);
           
            if (test.result.details) {
                console.log('   Детали:');
                if (test.result.details.matrix) {
                    console.log(`   - Матрица: ${test.result.details.matrix.similarity.toFixed(3)}`);
                }
                if (test.result.details.vector) {
                    console.log(`   - Векторы: ${test.result.details.vector.similarity.toFixed(3)}`);
                }
                if (test.result.details.bitmask) {
                    console.log(`   - Битовая маска: ${test.result.details.bitmask.distance}`);
                }
            }
        }
    });
}
