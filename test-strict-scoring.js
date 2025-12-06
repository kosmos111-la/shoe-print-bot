// test-strict-scoring.js
const PointCloudAligner = require('./modules/footprint/point-cloud-aligner');

// Тест на строгость: проверяем, что случайные точки дают низкий score
console.log('🧪 ТЕСТ СТРОГОСТИ СКОРИНГА');
console.log('==========================\n');

const aligner = new PointCloudAligner({
    maxIterations: 50,
    inlierThreshold: 20,
    minInliersRatio: 0.4,
    minInliersAbsolute: 4,
    strictScoring: true
});

// Создаём реалистичный след
const createRealFootprint = () => {
    return [
        { x: 100, y: 100, confidence: 0.9 },
        { x: 150, y: 80, confidence: 0.8 },
        { x: 200, y: 120, confidence: 0.9 },
        { x: 180, y: 180, confidence: 0.7 },
        { x: 120, y: 200, confidence: 0.8 },
        { x: 80, y: 150, confidence: 0.9 },
        { x: 130, y: 140, confidence: 0.6 },
        { x: 170, y: 160, confidence: 0.7 }
    ];
};

// Тест 1: Один и тот же след
console.log('1. 🔄 ОДИН И ТОТ ЖЕ СЛЕД (ожидается высокий score):');
const footprint1 = createRealFootprint();
const footprint2 = footprint1.map(p => ({ ...p }));
const resultSame = aligner.findBestAlignment(footprint1, footprint2);
console.log(`Score: ${resultSame.score.toFixed(3)} (ожидается > 0.8)`);

// Тест 2: Случайные точки
console.log('\n2. 🎲 СЛУЧАЙНЫЕ ТОЧКИ (ожидается низкий score):');
const randomPoints = Array(8).fill().map((_, i) => ({
    x: Math.random() * 300,
    y: Math.random() * 300,
    confidence: 0.5
}));
const resultRandom = aligner.findBestAlignment(footprint1, randomPoints);
console.log(`Score: ${resultRandom.score.toFixed(3)} (ожидается < 0.3)`);
console.log(`Inliers: ${resultRandom.inliers.length}/${Math.min(footprint1.length, randomPoints.length)}`);

// Тест 3: Частичное совпадение (50% точек те же)
console.log('\n3. 🔀 ЧАСТИЧНОЕ СОВПАДЕНИЕ (50% точек):');
const partialMatch = [
    ...footprint1.slice(0, 4), // Первые 4 точки те же
    ...Array(4).fill().map(() => ({ // 4 случайные точки
        x: Math.random() * 300,
        y: Math.random() * 300,
        confidence: 0.5
    }))
];
const resultPartial = aligner.findBestAlignment(footprint1, partialMatch);
console.log(`Score: ${resultPartial.score.toFixed(3)} (ожидается ~0.4-0.6)`);

// Тест 4: Пустые/малоточечные данные
console.log('\n4. ⚠️ МАЛО ТОЧЕК (2 точки):');
const fewPoints = [{ x: 100, y: 100 }, { x: 150, y: 150 }];
const resultFew = aligner.findBestAlignment(footprint1, fewPoints);
console.log(`Score: ${resultFew.score.toFixed(3)} (ожидается низкий)`);

// Статистика
console.log('\n📊 СТАТИСТИКА ТЕСТОВ:');
console.log('===================');
const tests = [
    { name: 'Одинаковые следы', result: resultSame, min: 0.8, max: 1.0 },
    { name: 'Случайные точки', result: resultRandom, min: 0.0, max: 0.3 },
    { name: 'Частичное совпадение', result: resultPartial, min: 0.4, max: 0.6 },
    { name: 'Мало точек', result: resultFew, min: 0.0, max: 0.3 }
];

tests.forEach(test => {
    const score = test.result.score;
    const inRange = score >= test.min && score <= test.max;
    console.log(`${inRange ? '✅' : '❌'} ${test.name}: ${score.toFixed(3)} (допустимо: ${test.min}-${test.max})`);
});

// Диагностика почему случайные точки дают высокий score
if (resultRandom.score > 0.3) {
    console.log('\n🔍 ДИАГНОСТИКА ВЫСОКОГО SCORE НА СЛУЧАЙНЫХ ТОЧКАХ:');
    console.log(`- Inliers: ${resultRandom.inliers.length}`);
    console.log(`- Inlier ratio: ${(resultRandom.inliers.length / Math.min(footprint1.length, randomPoints.length)).toFixed(2)}`);
    if (resultRandom.inliers.length > 0) {
        const avgDist = resultRandom.inliers.reduce((sum, i) => sum + i.distance, 0) / resultRandom.inliers.length;
        console.log(`- Среднее расстояние inliers: ${avgDist.toFixed(1)}px`);
        console.log(`- Порог inlierThreshold: ${aligner.options.inlierThreshold}px`);
    }
   
    // Покажем первые несколько inliers
    if (resultRandom.inliers.length > 0) {
        console.log('\nПримеры inliers (первые 3):');
        resultRandom.inliers.slice(0, 3).forEach((inlier, i) => {
            console.log(`  Inlier ${i}: расстояние = ${inlier.distance.toFixed(1)}px`);
        });
    }
}
