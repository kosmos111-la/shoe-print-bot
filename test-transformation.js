const SimpleFootprint = require('./simple-footprint');
const RotationInvariance = require('./rotation-invariance');

// 1. Создаем тестовые точки (имитация повернутого следа)
const testPoints = [
    {x: 100, y: 50, confidence: 0.8},   // "вертикальный" след
    {x: 100, y: 150, confidence: 0.7},
    {x: 100, y: 250, confidence: 0.9},
    {x: 120, y: 100, confidence: 0.6},
    {x: 120, y: 200, confidence: 0.8}
];

// 2. Создаем отпечаток
const footprint = new SimpleFootprint({
    name: 'Тест_90градусов',
    transformation: {
        matrix: [
            Math.cos(Math.PI/2), -Math.sin(Math.PI/2), 0,
            Math.sin(Math.PI/2), Math.cos(Math.PI/2), 0,
            0, 0, 1
        ],
        rotationAngle: 90, // 🔥 СРАЗУ УСТАНАВЛИВАЕМ 90°
        isMirrored: false,
        center: {x: 110, y: 150},
        bounds: {minX: 100, maxX: 120, minY: 50, maxY: 250},
        type: 'test_90_degrees'
    }
});

// 3. Проверяем
console.log('🎯 ТЕСТ ТРАНСФОРМАЦИИ:');
console.log('Угол при создании:', footprint.transformation?.rotationAngle);
console.log('Есть трансформация?', !!footprint.transformation);

// 4. Дебаг
footprint.debugTransformation();
