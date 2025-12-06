// test-aligner.js
const PointCloudAligner = require('./modules/footprint/point-cloud-aligner');

// Тестовые данные: два набора точек (второй повёрнут на 45°)
const points1 = [
    { x: 100, y: 100, confidence: 0.9 },
    { x: 150, y: 100, confidence: 0.8 },
    { x: 125, y: 150, confidence: 0.7 },
    { x: 175, y: 125, confidence: 0.6 }
];

const points2 = [
    { x: 170, y: 70, confidence: 0.9 },   // Повёрнутая версия точки 1
    { x: 212, y: 106, confidence: 0.8 },  // Повёрнутая версия точки 2
    { x: 141, y: 141, confidence: 0.7 },  // Повёрнутая версия точки 3
    { x: 194, y: 159, confidence: 0.6 }   // Повёрнутая версия точки 4
];

const aligner = new PointCloudAligner();
const result = aligner.findBestAlignment(points1, points2);

console.log('\n🎯 РЕЗУЛЬТАТЫ ТЕСТА:');
console.log('====================');
console.log('Score:', result.score.toFixed(3));
console.log('Угол поворота:', (result.transform?.rotation * 180 / Math.PI).toFixed(1) + '°');
console.log('Масштаб:', result.transform?.scale.toFixed(3));
console.log('Зеркало:', result.mirrored ? 'да' : 'нет');
console.log('Качество:', result.quality.message);
console.log('Inliers:', result.inliers.length);

// Проверим трансформацию
if (result.transform) {
    console.log('\n🔍 ПРОВЕРКА ТРАНСФОРМАЦИИ:');
    points1.forEach((p, i) => {
        const transformed = aligner.transformPoint(p, result.transform, result.mirrored);
        const distance = aligner.calculateDistance(transformed, points2[i]);
        console.log(`Точка ${i}: расстояние = ${distance.toFixed(1)}px`);
    });
}
