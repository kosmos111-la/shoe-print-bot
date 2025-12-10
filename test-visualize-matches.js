// test-visualize-matches.js
const HybridFootprint = require('./modules/footprint/hybrid-footprint');
const fs = require('fs');
const { createCanvas } = require('canvas');

function visualizeComparison(fp1, fp2, result, filename) {
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');
   
    // Фон
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 800, 400);
   
    // Заголовок
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText(`Сравнение: ${fp1.name} vs ${fp2.name}`, 20, 30);
    ctx.fillText(`Similarity: ${result.similarity.toFixed(3)} (${result.decision})`, 20, 55);
   
    // Рисуем точки первого отпечатка (красные)
    ctx.fillStyle = '#ff4757';
    fp1.originalPoints.forEach(point => {
        const x = 50 + point.x * 2;
        const y = 100 + point.y;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
   
    ctx.fillText(fp1.name, 50, 90);
   
    // Рисуем точки второго отпечатка (зелёные)
    ctx.fillStyle = '#2ed573';
    fp2.originalPoints.forEach(point => {
        const x = 450 + point.x * 2;
        const y = 100 + point.y;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
   
    ctx.fillText(fp2.name, 450, 90);
   
    // Сохраняем
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filename, buffer);
    console.log(`💾 Визуализация сохранена: ${filename}`);
}

// Тест с реальными паттернами
console.log('🎨 Визуализирую сравнения...');

// 1. Круг vs Линия
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
            y: startY + (Math.random() * 40 - 20), // Немного шума
            confidence: 0.9
        });
    }
    return points;
}

const circle = new HybridFootprint({ name: 'Круг' });
const line = new HybridFootprint({ name: 'Линия' });

circle.createFromPoints(createCirclePattern(100, 100, 80));
line.createFromPoints(createLinePattern(50, 100, 200));

const result1 = circle.compare(line);
visualizeComparison(circle, line, result1, 'circle_vs_line.png');

// 2. Два случайных
const random1 = new HybridFootprint({ name: 'Случайный 1' });
const random2 = new HybridFootprint({ name: 'Случайный 2' });

const randPoints1 = Array.from({length: 30}, () => ({
    x: Math.random() * 200,
    y: Math.random() * 200,
    confidence: 0.8
}));

const randPoints2 = Array.from({length: 30}, () => ({
    x: Math.random() * 200,
    y: Math.random() * 200,
    confidence: 0.8
}));

random1.createFromPoints(randPoints1);
random2.createFromPoints(randPoints2);

const result2 = random1.compare(random2);
visualizeComparison(random1, random2, result2, 'random1_vs_random2.png');

// 3. Один и тот же след с шумом
const original = new HybridFootprint({ name: 'Оригинал' });
const noisy = new HybridFootprint({ name: 'С шумом' });

const basePoints = Array.from({length: 30}, (_, i) => ({
    x: 50 + (i % 6) * 30,
    y: 50 + Math.floor(i / 6) * 30,
    confidence: 0.9
}));

const noisyPoints = basePoints.map(p => ({
    x: p.x + Math.random() * 20 - 10,
    y: p.y + Math.random() * 20 - 10,
    confidence: 0.9
}));

original.createFromPoints(basePoints);
noisy.createFromPoints(noisyPoints);

const result3 = original.compare(noisy);
visualizeComparison(original, noisy, result3, 'original_vs_noisy.png');
