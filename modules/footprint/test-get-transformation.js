const SimpleFootprint = require('./simple-footprint');

// 1. Создаем отпечаток с трансформацией 90°
const footprint = new SimpleFootprint({
    name: 'Тест_90',
    transformation: {
        rotationAngle: 90,
        isMirrored: false,
        center: {x: 100, y: 100},
        bounds: {minX: 50, maxX: 150, minY: 50, maxY: 150},
        type: 'test_90'
    }
});

console.log('🎯 ТЕСТ getTransformation():');
console.log('1. footprint.transformation.rotationAngle:', footprint.transformation?.rotationAngle);
console.log('2. footprint.getTransformation().rotationAngle:', footprint.getTransformation()?.rotationAngle);

// 2. Создаем отпечаток БЕЗ трансформации
const footprint2 = new SimpleFootprint({
    name: 'Тест_Без_Трансформации'
});

// Добавляем точки
const points = [
    {x: 100, y: 50, confidence: 0.8},
    {x: 100, y: 150, confidence: 0.7},
    {x: 100, y: 250, confidence: 0.9}
];

console.log('\n🎯 ТЕСТ БЕЗ начальной трансформации:');
console.log('До добавления точек:');
console.log('  Есть transformation?:', !!footprint2.transformation);
console.log('  getTransformation():', footprint2.getTransformation()?.rotationAngle);

// Имитируем добавление точек
footprint2.pointTracker = {
    points: new Map()
};
points.forEach((point, i) => {
    footprint2.pointTracker.points.set(`pt_${i}`, {
        x: point.x,
        y: point.y,
        confidence: point.confidence
    });
});

console.log('\nПосле добавления точек:');
console.log('  getTransformation():', footprint2.getTransformation()?.rotationAngle);
