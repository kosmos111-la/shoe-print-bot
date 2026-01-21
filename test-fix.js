// Создадим тестовый скрипт test-fix.js:
const SimpleFootprint = require('./modules/footprint/simple-footprint');
const RotationInvariance = require('./modules/footprint/rotation-invariance');

// Создаем тестовый отпечаток
const footprint = new SimpleFootprint({
    name: 'Тестовый след',
    userId: 'test123'
});

// Добавляем тестовые точки
footprint.pointTracker.processNewPoints([
    { x: 100, y: 100, confidence: 0.8 },
    { x: 200, y: 150, confidence: 0.7 },
    { x: 150, y: 200, confidence: 0.9 }
], { photoId: 'test_photo_1' });

// Добавляем трансформацию с углом 45°
footprint.transformation = {
    rotationAngle: 45,
    center: { x: 150, y: 150 },
    matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    type: 'test'
};

// Тестируем метод
console.log('\n🎯 ТЕСТИРУЕМ ИСПРАВЛЕННЫЙ МЕТОД:');
const normalizedPoints = footprint.getPointsInNormalizedSystem();

console.log(`\n📊 Результат:`);
console.log(`   Количество точек: ${normalizedPoints.length}`);
if (normalizedPoints.length > 0) {
    console.log(`   Координаты первой точки: (${normalizedPoints[0].x.toFixed(1)}, ${normalizedPoints[0].y.toFixed(1)})`);
}
