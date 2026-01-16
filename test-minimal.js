// test-minimal.js
const RotationInvariance = require('./modules/footprint/rotation-invariance');

// Создаем вертикальные точки (имитация повернутого следа)
const verticalPoints = [
    {x: 100, y: 50},
    {x: 100, y: 150},
    {x: 100, y: 250},
    {x: 110, y: 100},
    {x: 110, y: 200}
];

const processor = new RotationInvariance({ debug: true });
const angle = processor.detectRotationAngle(verticalPoints);

console.log('Угол для вертикальных точек:', angle, '°');
console.log('Ожидается около 90°');
