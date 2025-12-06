// test-mirror-detection.js - специальный тест для зеркала
const PointCloudAligner = require('./modules/footprint/point-cloud-aligner');

console.log('🎯 СПЕЦИАЛЬНЫЙ ТЕСТ ОПРЕДЕЛЕНИЯ ЗЕРКАЛА');
console.log('=======================================\n');

// Создаем простую форму для теста
const createTestShape = () => {
    return [
        { x: 100, y: 100, confidence: 0.9, id: 'p1' },
        { x: 200, y: 150, confidence: 0.9, id: 'p2' },
        { x: 150, y: 250, confidence: 0.9, id: 'p3' },
        { x: 300, y: 200, confidence: 0.8, id: 'p4' },
        { x: 250, y: 100, confidence: 0.8, id: 'p5' }
    ];
};

const originalShape = createTestShape();

// Тест 1: Тот же след (не зеркало)
console.log('1. 🔄 ТЕСТ: ТОТ ЖЕ СЛЕД (ожидается НЕ зеркало):');
const sameShape = createTestShape();
const aligner1 = new PointCloudAligner({ mirrorCheck: true });
const result1 = aligner1.findBestAlignment(originalShape, sameShape);
console.log(`   Score: ${result1.score.toFixed(3)}, Зеркало: ${result1.mirrored ? 'да' : 'нет'}`);
console.log(`   ✅ Ожидалось: НЕ зеркало`);

// Тест 2: Зеркальный след
console.log('\n2. 🪞 ТЕСТ: ЗЕРКАЛЬНЫЙ СЛЕД (ожидается ЗЕРКАЛО):');
const mirroredShape = originalShape.map(p => ({
    x: 400 - p.x, // Зеркалим относительно x=200
    y: p.y,
    confidence: p.confidence,
    id: `${p.id}_mirrored`
}));
const aligner2 = new PointCloudAligner({ mirrorCheck: true });
const result2 = aligner2.findBestAlignment(originalShape, mirroredShape);
console.log(`   Score: ${result2.score.toFixed(3)}, Зеркало: ${result2.mirrored ? 'да' : 'нет'}`);
console.log(`   ✅ Ожидалось: ЗЕРКАЛО`);

// Тест 3: Зеркальный след с поворотом
console.log('\n3. 🔄🪞 ТЕСТ: ЗЕРКАЛЬНЫЙ С ПОВОРОТОМ 30°:');
const rotateAndMirror = (points, angleDeg) => {
    const angle = angleDeg * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
   
    return points.map(p => {
        // Поворачиваем
        const rotatedX = p.x * cos - p.y * sin;
        const rotatedY = p.x * sin + p.y * cos;
       
        // Зеркалим
        return {
            x: -rotatedX + 500,
            y: rotatedY + 100,
            confidence: p.confidence,
            id: `${p.id}_mirrored_rotated`
        };
    });
};

const mirroredRotatedShape = rotateAndMirror(originalShape, 30);
const aligner3 = new PointCloudAligner({ mirrorCheck: true });
const result3 = aligner3.findBestAlignment(originalShape, mirroredRotatedShape);
console.log(`   Score: ${result3.score.toFixed(3)}, Зеркало: ${result3.mirrored ? 'да' : 'нет'}`);
console.log(`   ✅ Ожидалось: ЗЕРКАЛО`);

// Итоги
console.log('\n📊 ИТОГИ ТЕСТИРОВАНИЯ ЗЕРКАЛА:');
console.log('=============================');

const tests = [
    { name: 'Тот же след', result: result1, expectedMirror: false },
    { name: 'Зеркальный след', result: result2, expectedMirror: true },
    { name: 'Зеркальный с поворотом', result: result3, expectedMirror: true }
];

let passed = 0;
tests.forEach(test => {
    const passedTest = test.result.mirrored === test.expectedMirror;
    console.log(`${passedTest ? '✅' : '❌'} ${test.name}: ${test.result.mirrored ? 'зеркало' : 'не зеркало'} (ожидалось: ${test.expectedMirror ? 'зеркало' : 'не зеркало'})`);
    if (passedTest) passed++;
});

console.log(`\n🎯 ИТОГО: ${passed}/${tests.length} тестов зеркала пройдено`);

if (passed === tests.length) {
    console.log('\n✨✨✨ АЛГОРИТМ ОПРЕДЕЛЕНИЯ ЗЕРКАЛА РАБОТАЕТ! ✨✨✨');
} else {
    console.log('\n⚠️ Нужно доработать алгоритм определения зеркала');
}
