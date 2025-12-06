// test-fix-verification.js
const PointCloudAligner = require('./modules/footprint/point-cloud-aligner');

// Простейший тест: треугольник
console.log('🧪 ПРОСТЕЙШИЙ ТЕСТ: ТРЕУГОЛЬНИК');
console.log('===============================\n');

// Треугольник
const triangle1 = [
    { x: 0, y: 0, confidence: 1.0 },
    { x: 100, y: 0, confidence: 1.0 },
    { x: 50, y: 100, confidence: 1.0 }
];

// Тот же треугольник, повёрнутый на 30° и смещённый
const angle = 30 * Math.PI / 180;
const triangle2 = triangle1.map(p => {
    const rotatedX = p.x * Math.cos(angle) - p.y * Math.sin(angle) + 50;
    const rotatedY = p.x * Math.sin(angle) + p.y * Math.cos(angle) + 30;
    return {
        x: rotatedX,
        y: rotatedY,
        confidence: 1.0,
        id: `${p.id}_rot`
    };
});

console.log('Треугольник 1:');
triangle1.forEach((p, i) => console.log(`  P${i}: (${p.x}, ${p.y})`));

console.log('\nТреугольник 2 (30°, +50,+30):');
triangle2.forEach((p, i) => console.log(`  P${i}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`));

const aligner = new PointCloudAligner({
    maxIterations: 100,
    inlierThreshold: 5, // Жёсткий порог
    minInliersRatio: 0.8
});

console.log('\n🎯 ЗАПУСК АЛГОРИТМА:');
const result = aligner.findBestAlignment(triangle1, triangle2);

console.log('\n📊 РЕЗУЛЬТАТЫ:');
console.log(`Score: ${result.score.toFixed(4)}`);
console.log(`Угол: ${(result.transform?.rotation * 180 / Math.PI).toFixed(2)}° (ожидается 30°)`);
console.log(`Масштаб: ${result.transform?.scale.toFixed(4)} (ожидается 1.0000)`);
console.log(`Смещение: (${result.transform?.translation?.x?.toFixed(1)}, ${result.transform?.translation?.y?.toFixed(1)})`);
console.log(`Ожидаемое: (50.0, 30.0)`);
console.log(`Зеркало: ${result.mirrored ? 'да' : 'нет'}`);
console.log(`Inliers: ${result.inliers.length}/3`);

// Проверка трансформации
console.log('\n🔍 ПРОВЕРКА ТРАНСФОРМАЦИИ:');
triangle1.forEach((p, i) => {
    const transformed = aligner.transformPoint(p, result.transform, result.mirrored);
    const distance = aligner.calculateDistance(transformed, triangle2[i]);
    console.log(`Точка ${i}: ${distance.toFixed(2)}px`);
});

// Тест с зеркалом
console.log('\n🧪 ТЕСТ ЗЕРКАЛА:');
const mirroredTriangle = triangle1.map(p => ({
    x: -p.x + 200, // Зеркалим и смещаем
    y: p.y + 50,
    confidence: 1.0
}));

const resultMirror = aligner.findBestAlignment(triangle1, mirroredTriangle);
console.log(`Score: ${resultMirror.score.toFixed(4)}`);
console.log(`Зеркало обнаружено: ${resultMirror.mirrored ? '✅' : '❌'}`);
console.log(`Угол: ${(resultMirror.transform?.rotation * 180 / Math.PI).toFixed(2)}° (ожидается ~0°)`);
