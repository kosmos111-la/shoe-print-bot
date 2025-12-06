// test-ultra-strict.js
const UltraStrictAligner = require('./ultra-strict-aligner'); // Сохраните класс выше в отдельный файл

console.log('🧪 ТЕСТ СУПЕР-СТРОГОГО АЛГОРИТМА');
console.log('================================\n');

const aligner = new UltraStrictAligner({
    maxIterations: 100
});

console.log('🔧 Параметры aligner:');
console.log(`- inlierThreshold: ${aligner.options.inlierThreshold}px`);
console.log(`- minInliersRatio: ${aligner.options.minInliersRatio}`);
console.log(`- minInliersAbsolute: ${aligner.options.minInliersAbsolute}`);
console.log(`- confidenceThreshold: ${aligner.options.confidenceThreshold}`);

// Тест 1: Идеальное совпадение
console.log('\n1. 🎯 ИДЕАЛЬНОЕ СОВПАДЕНИЕ:');
const perfectPoints = [
    { x: 0, y: 0, confidence: 0.9 },
    { x: 100, y: 0, confidence: 0.9 },
    { x: 0, y: 100, confidence: 0.9 },
    { x: 100, y: 100, confidence: 0.9 },
    { x: 50, y: 50, confidence: 0.8 }
];

const samePoints = perfectPoints.map(p => ({ ...p }));
const resultPerfect = aligner.findBestAlignment(perfectPoints, samePoints);
console.log(`Score: ${resultPerfect.score.toFixed(3)} (ожидается > 0.9)`);
console.log(`Inliers: ${resultPerfect.inliers.length}/${perfectPoints.length}`);

// Тест 2: Случайные точки с низкой уверенностью
console.log('\n2. 🎲 СЛУЧАЙНЫЕ ТОЧКИ (низкая уверенность):');
const randomLowConfidence = Array(8).fill().map((_, i) => ({
    x: Math.random() * 300,
    y: Math.random() * 300,
    confidence: 0.3 // Низкая уверенность
}));
const resultRandomLow = aligner.findBestAlignment(perfectPoints, randomLowConfidence);
console.log(`Score: ${resultRandomLow.score.toFixed(3)} (ожидается ~0)`);
console.log(`Inliers: ${resultRandomLow.inliers.length}/${Math.min(perfectPoints.length, randomLowConfidence.length)}`);

// Тест 3: Случайные точки с высокой уверенностью
console.log('\n3. 🎲 СЛУЧАЙНЫЕ ТОЧКИ (высокая уверенность):');
const randomHighConfidence = Array(8).fill().map((_, i) => ({
    x: Math.random() * 300,
    y: Math.random() * 300,
    confidence: 0.9 // Высокая уверенность
}));
const resultRandomHigh = aligner.findBestAlignment(perfectPoints, randomHighConfidence);
console.log(`Score: ${resultRandomHigh.score.toFixed(3)} (ожидается < 0.3)`);
console.log(`Inliers: ${resultRandomHigh.inliers.length}/${Math.min(perfectPoints.length, randomHighConfidence.length)}`);

// Тест 4: Частичное совпадение (3 из 5 точек те же)
console.log('\n4. 🔀 ЧАСТИЧНОЕ СОВПАДЕНИЕ (3/5 точек):');
const partialMatch = [
    ...perfectPoints.slice(0, 3), // 3 одинаковые точки
    { x: 200, y: 200, confidence: 0.9 }, // 2 разные точки
    { x: 250, y: 250, confidence: 0.9 }
];
const resultPartial = aligner.findBestAlignment(perfectPoints, partialMatch);
console.log(`Score: ${resultPartial.score.toFixed(3)} (ожидается ~0.4-0.7)`);
console.log(`Inliers: ${resultPartial.inliers.length}/${Math.min(perfectPoints.length, partialMatch.length)}`);

// Тест 5: Поворот на 30 градусов
console.log('\n5. 🔄 ПОВОРОТ НА 30°:');
const rotatePoints = (points, angleDeg, dx = 0, dy = 0) => {
    const angle = angleDeg * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
   
    return points.map(p => ({
        x: p.x * cos - p.y * sin + dx,
        y: p.x * sin + p.y * cos + dy,
        confidence: p.confidence
    }));
};

const rotatedPoints = rotatePoints(perfectPoints, 30, 50, 30);
const resultRotated = aligner.findBestAlignment(perfectPoints, rotatedPoints);
console.log(`Score: ${resultRotated.score.toFixed(3)} (ожидается > 0.8)`);
console.log(`Inliers: ${resultRotated.inliers.length}/${perfectPoints.length}`);
if (resultRotated.transform) {
    const detectedAngle = resultRotated.transform.rotation * 180 / Math.PI;
    console.log(`Обнаруженный угол: ${detectedAngle.toFixed(1)}° (ожидается 30°)`);
}

// Итоговая статистика
console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА:');
const testResults = [
    { name: 'Идеальное', result: resultPerfect, target: '>0.9', passed: resultPerfect.score > 0.9 },
    { name: 'Случайные (низк.)', result: resultRandomLow, target: '~0', passed: resultRandomLow.score < 0.1 },
    { name: 'Случайные (высок.)', result: resultRandomHigh, target: '<0.3', passed: resultRandomHigh.score < 0.3 },
    { name: 'Частичное', result: resultPartial, target: '0.4-0.7', passed: resultPartial.score > 0.4 && resultPartial.score < 0.7 },
    { name: 'Поворот 30°', result: resultRotated, target: '>0.8', passed: resultRotated.score > 0.8 }
];

testResults.forEach(test => {
    console.log(`${test.passed ? '✅' : '❌'} ${test.name}: ${test.result.score.toFixed(3)} ${test.target}`);
});

const passedCount = testResults.filter(t => t.passed).length;
console.log(`\n🎯 ПРОЙДЕНО: ${passedCount}/${testResults.length}`);

if (passedCount === testResults.length) {
    console.log('✨ АЛГОРИТМ ГОТОВ К ИНТЕГРАЦИИ!');
} else {
    console.log('\n🔧 НЕОБХОДИМЫЕ ДОРАБОТКИ:');
    if (resultRandomHigh.score >= 0.3) {
        console.log('- Слишком высокий score на случайных точках');
        console.log('  Решение: увеличить confidenceThreshold или inlierThreshold');
    }
    if (resultPerfect.score < 0.9) {
        console.log('- Слишком низкий score на идеальных данных');
        console.log('  Решение: уменьшить строгость или улучшить matching');
    }
}
