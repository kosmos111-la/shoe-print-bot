// test-real-patterns.js
const HybridFootprint = require('./modules/footprint/hybrid-footprint');

console.log('🎯 Тестирую на реальных паттернах...');

// ФУНКЦИИ ДЛЯ СОЗДАНИЯ РЕАЛЬНЫХ ПАТТЕРНОВ
function createGridPattern(rows, cols, spacing = 50) {
    const points = [];
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            points.push({
                x: 100 + j * spacing + Math.random() * 10 - 5,
                y: 100 + i * spacing + Math.random() * 10 - 5,
                confidence: 0.8 + Math.random() * 0.2
            });
        }
    }
    return points;
}

function createCirclePattern(centerX, centerY, radius, pointsCount = 30) {
    const points = [];
    for (let i = 0; i < pointsCount; i++) {
        const angle = (i / pointsCount) * Math.PI * 2;
        points.push({
            x: centerX + radius * Math.cos(angle) + Math.random() * 15 - 7.5,
            y: centerY + radius * Math.sin(angle) + Math.random() * 15 - 7.5,
            confidence: 0.8 + Math.random() * 0.2
        });
    }
    return points;
}

function createLinePattern(startX, startY, length, pointsCount = 20) {
    const points = [];
    for (let i = 0; i < pointsCount; i++) {
        const t = i / (pointsCount - 1);
        points.push({
            x: startX + length * t + Math.random() * 20 - 10,
            y: startY + Math.random() * 30 - 15,
            confidence: 0.8 + Math.random() * 0.2
        });
    }
    return points;
}

// ТЕСТ 1: ОДИН И ТОТ ЖЕ СЛЕД (с небольшим смещением)
console.log('\n' + '='.repeat(60));
console.log('🧪 ТЕСТ 1: ОДИН И ТОТ ЖЕ СЛЕД');

const grid1 = createGridPattern(5, 6, 40);
const grid2 = grid1.map(p => ({
    x: p.x + Math.random() * 25 - 12.5,
    y: p.y + Math.random() * 25 - 12.5,
    confidence: p.confidence
}));

const fp1 = new HybridFootprint({ name: 'След 1 (сетка 5x6)' });
const fp2 = new HybridFootprint({ name: 'След 2 (та же сетка)' });

fp1.createFromPoints(grid1);
fp2.createFromPoints(grid2);

const result1 = fp1.compare(fp2);
console.log(`📊 Схожесть: ${result1.similarity.toFixed(3)}`);
console.log(`🤔 Решение: ${result1.decision}`);
console.log(`✅ Ожидалось: SAME (${result1.decision === 'same' ? 'ПРОШЛО' : 'НЕ ПРОШЛО'})`);

// ТЕСТ 2: РАЗНЫЕ ПАТТЕРНЫ
console.log('\n' + '='.repeat(60));
console.log('🧪 ТЕСТ 2: РАЗНЫЕ ПАТТЕРНЫ');

const circle = createCirclePattern(200, 200, 80, 25);
const line = createLinePattern(100, 100, 300, 25);

const fp3 = new HybridFootprint({ name: 'Круглый след' });
const fp4 = new HybridFootprint({ name: 'Линейный след' });

fp3.createFromPoints(circle);
fp4.createFromPoints(line);

const result2 = fp3.compare(fp4);
console.log(`📊 Схожесть: ${result2.similarity.toFixed(3)}`);
console.log(`🤔 Решение: ${result2.decision}`);
console.log(`✅ Ожидалось: DIFFERENT (${result2.decision === 'different' ? 'ПРОШЛО' : 'НЕ ПРОШЛО'})`);

// ТЕСТ 3: ОДИНАКОВЫЕ КРУГИ РАЗНОГО РАЗМЕРА
console.log('\n' + '='.repeat(60));
console.log('🧪 ТЕСТ 3: ОДИНАКОВЫЕ ФОРМЫ РАЗНОГО РАЗМЕРА');

const smallCircle = createCirclePattern(150, 150, 50, 20);
const largeCircle = createCirclePattern(150, 150, 100, 20);

const fp5 = new HybridFootprint({ name: 'Маленький круг' });
const fp6 = new HybridFootprint({ name: 'Большой круг' });

fp5.createFromPoints(smallCircle);
fp6.createFromPoints(largeCircle);

const result3 = fp5.compare(fp6);
console.log(`📊 Схожесть: ${result3.similarity.toFixed(3)}`);
console.log(`🤔 Решение: ${result3.decision}`);
console.log(`✅ Ожидалось: SIMILAR (${result3.decision === 'similar' ? 'ПРОШЛО' : 'НЕ ПРОШЛО'})`);

// ТЕСТ 4: СЛУЧАЙНЫЕ ТОЧКИ (должны быть разными)
console.log('\n' + '='.repeat(60));
console.log('🧪 ТЕСТ 4: СЛУЧАЙНЫЕ ТОЧКИ');

const random1 = Array.from({length: 30}, () => ({
    x: Math.random() * 400,
    y: Math.random() * 400,
    confidence: 0.5 + Math.random() * 0.5
}));

const random2 = Array.from({length: 30}, () => ({
    x: Math.random() * 400,
    y: Math.random() * 400,
    confidence: 0.5 + Math.random() * 0.5
}));

const fp7 = new HybridFootprint({ name: 'Случайный 1' });
const fp8 = new HybridFootprint({ name: 'Случайный 2' });

fp7.createFromPoints(random1);
fp8.createFromPoints(random2);

const result4 = fp7.compare(fp8);
console.log(`📊 Схожесть: ${result4.similarity.toFixed(3)}`);
console.log(`🤔 Решение: ${result4.decision}`);
console.log(`✅ Ожидалось: DIFFERENT (${result4.decision === 'different' ? 'ПРОШЛО' : 'НЕ ПРОШЛО'})`);

// ТЕСТ 5: ПУСТОЙ ОТПЕЧАТОК
console.log('\n' + '='.repeat(60));
console.log('🧪 ТЕСТ 5: МАЛО ТОЧЕК');

const fewPoints = Array.from({length: 5}, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    confidence: 0.8
}));

const fp9 = new HybridFootprint({ name: 'Мало точек' });
fp9.createFromPoints(fewPoints);

const result5 = fp1.compare(fp9);
console.log(`📊 Схожесть: ${result5.similarity.toFixed(3)}`);
console.log(`🤔 Решение: ${result5.decision}`);
console.log(`✅ Ожидалось: fastReject (${result5.fastReject ? 'ПРОШЛО' : 'НЕ ПРОШЛО'})`);

// ИТОГИ
console.log('\n' + '='.repeat(60));
console.log('📈 ИТОГИ ТЕСТИРОВАНИЯ:');

const tests = [
    { name: 'Тот же след', result: result1.decision === 'same' },
    { name: 'Разные паттерны', result: result2.decision === 'different' },
    { name: 'Похожие формы', result: result3.decision === 'similar' },
    { name: 'Случайные точки', result: result4.decision === 'different' },
    { name: 'Быстрый отсев', result: result5.fastReject === true }
];

tests.forEach((test, i) => {
    console.log(`${i+1}. ${test.name}: ${test.result ? '✅ ПРОШЛО' : '❌ НЕ ПРОШЛО'}`);
});

const passed = tests.filter(t => t.result).length;
console.log(`\n🎯 РЕЗУЛЬТАТ: ${passed}/${tests.length} тестов пройдено`);
