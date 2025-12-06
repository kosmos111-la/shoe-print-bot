// test-simple-verification.js
const PointCloudAligner = require('./modules/footprint/point-cloud-aligner');

console.log('🧪 ПРОСТОЙ ТЕСТ ИСПРАВЛЕННОГО АЛГОРИТМА');
console.log('=======================================\n');

const aligner = new PointCloudAligner({
    maxIterations: 50
});

// Тест 1: Идеальное совпадение
console.log('1. 🎯 ИДЕАЛЬНОЕ СОВПАДЕНИЕ:');
const points1 = [
    { x: 0, y: 0, confidence: 0.9 },
    { x: 100, y: 0, confidence: 0.9 },
    { x: 0, y: 100, confidence: 0.9 },
    { x: 100, y: 100, confidence: 0.9 }
];

const points2 = points1.map(p => ({ ...p }));
const result1 = aligner.findBestAlignment(points1, points2);
console.log(`Score: ${result1.score.toFixed(3)} (ожидается > 0.9)`);
console.log(`Inliers: ${result1.inliers.length}/${points1.length}`);

// Тест 2: Случайные точки
console.log('\n2. 🎲 СЛУЧАЙНЫЕ ТОЧКИ:');
const randomPoints = Array(8).fill().map((_, i) => ({
    x: Math.random() * 300,
    y: Math.random() * 300,
    confidence: 0.5
}));
const result2 = aligner.findBestAlignment(points1, randomPoints);
console.log(`Score: ${result2.score.toFixed(3)} (ожидается < 0.3)`);
console.log(`Inliers: ${result2.inliers.length}/${Math.min(points1.length, randomPoints.length)}`);

// Тест 3: Поворот на 45 градусов
console.log('\n3. 🔄 ПОВОРОТ НА 45°:');
const rotatePoints = (points, angleDeg) => {
    const angle = angleDeg * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
   
    return points.map(p => ({
        x: p.x * cos - p.y * sin + 50,
        y: p.x * sin + p.y * cos + 30,
        confidence: p.confidence
    }));
};

const rotated = rotatePoints(points1, 45);
const result3 = aligner.findBestAlignment(points1, rotated);
console.log(`Score: ${result3.score.toFixed(3)} (ожидается > 0.7)`);
if (result3.transform) {
    const detectedAngle = result3.transform.rotation * 180 / Math.PI;
    console.log(`Обнаруженный угол: ${detectedAngle.toFixed(1)}° (ожидается 45°)`);
}

// Итоги
console.log('\n📊 ИТОГИ:');
const tests = [
    { name: 'Идеальное', score: result1.score, min: 0.9 },
    { name: 'Случайные', score: result2.score, max: 0.3 },
    { name: 'Поворот 45°', score: result3.score, min: 0.7 }
];

let passed = 0;
tests.forEach(test => {
    const passedTest =
        (test.min !== undefined && test.score >= test.min) ||
        (test.max !== undefined && test.score <= test.max);
   
    console.log(`${passedTest ? '✅' : '❌'} ${test.name}: ${test.score.toFixed(3)}`);
    if (passedTest) passed++;
});

console.log(`\n🎯 ПРОЙДЕНО: ${passed}/${tests.length}`);
if (passed === tests.length) {
    console.log('✨ АЛГОРИТМ РАБОТАЕТ КОРРЕКТНО!');
}
