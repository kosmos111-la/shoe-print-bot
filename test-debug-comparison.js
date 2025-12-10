// test-debug-comparison.js
const HybridFootprint = require('./modules/footprint/hybrid-footprint');

console.log('🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА СРАВНЕНИЯ\n');

// Создаем круг и линию
function createCirclePattern(centerX, centerY, radius, pointsCount = 25) {
    const points = [];
    for (let i = 0; i < pointsCount; i++) {
        const angle = (i / pointsCount) * Math.PI * 2;
        points.push({
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
            confidence: 0.9
        });
    }
    return points;
}

function createLinePattern(startX, startY, length, pointsCount = 25) {
    const points = [];
    for (let i = 0; i < pointsCount; i++) {
        const t = i / (pointsCount - 1);
        points.push({
            x: startX + length * t,
            y: startY,
            confidence: 0.9
        });
    }
    return points;
}

const circlePoints = createCirclePattern(200, 200, 80);
const linePoints = createLinePattern(100, 200, 300);

const circleFootprint = new HybridFootprint({ name: 'Круг' });
const lineFootprint = new HybridFootprint({ name: 'Линия' });

circleFootprint.createFromPoints(circlePoints);
lineFootprint.createFromPoints(linePoints);

console.log('📊 БИТОВЫЕ МАСКИ:');
console.log('Круг:', circleFootprint.bitmask.bitmask.toString(16).slice(0, 16), '...');
console.log('Линия:', lineFootprint.bitmask.bitmask.toString(16).slice(0, 16), '...');

const bitmaskResult = circleFootprint.bitmask.compare(lineFootprint.bitmask);
console.log('\n🎭 СРАВНЕНИЕ БИТОВЫХ МАСОК:');
console.log('Расстояние Хэмминга:', bitmaskResult.distance);
console.log('Схожесть:', bitmaskResult.similarity);
console.log('Решение:', bitmaskResult.decision);

console.log('\n📐 ГЕОМЕТРИЧЕСКИЕ МОМЕНТЫ:');
const circleMoments = circleFootprint.moments.get7Moments();
const lineMoments = lineFootprint.moments.get7Moments();
console.log('Круг (первые 3):', circleMoments.slice(0, 3).map(m => m.toExponential(2)));
console.log('Линия (первые 3):', lineMoments.slice(0, 3).map(m => m.toExponential(2)));

const momentResult = circleFootprint.moments.compare(lineFootprint.moments);
console.log('\n🎯 СРАВНЕНИЕ МОМЕНТОВ:');
console.log('Расстояние:', momentResult.distance);
console.log('Схожесть:', momentResult.similarity);

console.log('\n📊 ВИЗУАЛИЗАЦИЯ БИТОВЫХ МАСОК:');
console.log('Круг:');
circleFootprint.bitmask.visualize();
console.log('\nЛиния:');
lineFootprint.bitmask.visualize();
