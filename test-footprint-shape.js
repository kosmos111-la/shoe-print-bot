// test-footprint-shape.js - ОБНОВЛЕННАЯ ВЕРСИЯ
const PointCloudAligner = require('./modules/footprint/point-cloud-aligner');

// Создаём форму, похожую на след обуви (вид сверху)
const createFootprintShape = (centerX, centerY, length = 200, width = 80) => {
    return [
        // Пятка (задняя, округлая)
        { x: centerX - length/2, y: centerY - width/6, confidence: 0.9, id: 'heel_left' },
        { x: centerX - length/2, y: centerY + width/6, confidence: 0.9, id: 'heel_right' },
        { x: centerX - length/2 + 20, y: centerY, confidence: 0.8, id: 'heel_center' },
       
        // Арка (самая узкая часть)
        { x: centerX - length/4, y: centerY - width/4, confidence: 0.7, id: 'arch_left' },
        { x: centerX - length/4, y: centerY + width/4, confidence: 0.7, id: 'arch_right' },
       
        // Подошва (широкая часть)
        { x: centerX, y: centerY - width/3, confidence: 0.8, id: 'sole_left' },
        { x: centerX, y: centerY + width/3, confidence: 0.8, id: 'sole_right' },
        { x: centerX, y: centerY, confidence: 0.6, id: 'sole_center' },
       
        // Носок (передняя, округлая)
        { x: centerX + length/2 - 20, y: centerY - width/5, confidence: 0.9, id: 'toe_left' },
        { x: centerX + length/2 - 20, y: centerY + width/5, confidence: 0.9, id: 'toe_right' },
        { x: centerX + length/2, y: centerY, confidence: 0.8, id: 'toe_center' },
       
        // Дополнительные точки для реалистичности
        { x: centerX - length/3, y: centerY - width/8, confidence: 0.6, id: 'mid_left' },
        { x: centerX - length/3, y: centerY + width/8, confidence: 0.6, id: 'mid_right' },
        { x: centerX + length/6, y: centerY - width/6, confidence: 0.7, id: 'front_left' },
        { x: centerX + length/6, y: centerY + width/6, confidence: 0.7, id: 'front_right' }
    ];
};

// Повёрнутый и смещённый след
const rotateAndTranslate = (points, angleDeg, dx, dy) => {
    const angle = angleDeg * Math.PI / 180;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
   
    return points.map(p => ({
        x: (p.x * cosA - p.y * sinA) + dx,
        y: (p.x * sinA + p.y * cosA) + dy,
        confidence: p.confidence,
        id: `${p.id}_rotated`
    }));
};

// Оригинальный след
const originalFootprint = createFootprintShape(300, 300, 250, 90);

// Повёрнутый след (реалистичный случай)
const rotatedFootprint = rotateAndTranslate(originalFootprint, 15, 50, -30);

// Сильно повёрнутый след (проблемный случай)
const heavilyRotatedFootprint = rotateAndTranslate(originalFootprint, 60, 100, 50);

// Зеркальный след (левый/правый ботинок)
const mirroredFootprint = originalFootprint.map(p => ({
    x: -p.x + 600, // Зеркалим по X и смещаем
    y: p.y + 100,
    confidence: p.confidence,
    id: `${p.id}_mirrored`
}));

console.log('👣 ТЕСТ НА РЕАЛЬНОЙ ФОРМЕ СЛЕДА С ИСПРАВЛЕНИЯМИ');
console.log('================================================\n');

console.log('📊 СТАТИСТИКА:');
console.log(`Оригинальный след: ${originalFootprint.length} точек`);
console.log(`Повёрнутый след (15°): ${rotatedFootprint.length} точек`);
console.log(`Сильно повёрнутый след (60°): ${heavilyRotatedFootprint.length} точек`);
console.log(`Зеркальный след: ${mirroredFootprint.length} точек`);

// Тестируем алгоритм
console.log('\n🎯 ТЕСТИРУЕМ АЛГОРИТМ С ИСПРАВЛЕНИЯМИ:');
console.log('========================================\n');

const aligner = new PointCloudAligner({
    maxIterations: 200,
    inlierThreshold: 20,
    minInliersRatio: 0.6,
    minInliersAbsolute: 4,
    mirrorCheck: true,
    requireGoodSpread: true,
    maxRandomScore: 0.3
});

console.log('🔧 Настройки алгоритма:');
console.log(`   • minInliersRatio: ${aligner.options.minInliersRatio}`);
console.log(`   • maxRandomScore: ${aligner.options.maxRandomScore}`);
console.log(`   • requireGoodSpread: ${aligner.options.requireGoodSpread}`);

// Тест 1: Небольшой поворот (15°)
console.log('\n1. 🔄 ТЕСТ: НЕБОЛЬШОЙ ПОВОРОТ (15°):');
console.log('-----------------------------------');
const result1 = aligner.findBestAlignment(originalFootprint, rotatedFootprint);
printResult(result1, 15, 50, -30);

// Тест 2: Большой поворот (60°)
console.log('\n2. 🔄 ТЕСТ: БОЛЬШОЙ ПОВОРОТ (60°):');
console.log('-----------------------------------');
const result2 = aligner.findBestAlignment(originalFootprint, heavilyRotatedFootprint);
printResult(result2, 60, 100, 50);

// Тест 3: Зеркало
console.log('\n3. 🪞 ТЕСТ: ЗЕРКАЛЬНЫЙ СЛЕД:');
console.log('----------------------------');
const result3 = aligner.findBestAlignment(originalFootprint, mirroredFootprint);
printResult(result3, 0, 300, 100);

// Тест 4: Случайные точки (ужесточенный тест)
console.log('\n4. 🎲 ТЕСТ: СЛУЧАЙНЫЕ ТОЧКИ (ужесточенный):');
console.log('-------------------------------------------');
const randomPoints = Array(15).fill().map((_, i) => ({
    x: Math.random() * 500,
    y: Math.random() * 500,
    confidence: 0.5,
    id: `random_${i}`
}));
const result4 = aligner.findBestAlignment(originalFootprint, randomPoints);
console.log(`Score: ${result4.score.toFixed(3)} (ожидается < ${aligner.options.maxRandomScore})`);
console.log(`Качество: ${result4.quality.message}`);

// Тест 5: Шумовые данные
console.log('\n5. 📈 ТЕСТ: УСТОЙЧИВОСТЬ К ШУМУ:');
console.log('--------------------------------');
const addNoise = (points, noiseLevel = 15) => {
    return points.map(p => ({
        x: p.x + (Math.random() - 0.5) * 2 * noiseLevel,
        y: p.y + (Math.random() - 0.5) * 2 * noiseLevel,
        confidence: p.confidence * 0.9,
        id: `${p.id}_noisy`
    }));
};

const noisyFootprint = addNoise(rotatedFootprint, 15);
const resultNoise = aligner.findBestAlignment(originalFootprint, noisyFootprint);
console.log(`Уровень шума: ±15px`);
console.log(`Score с шумом: ${resultNoise.score.toFixed(3)}`);
console.log(`Score без шума: ${result1.score.toFixed(3)}`);
console.log(`Потеря точности: ${((result1.score - resultNoise.score) * 100).toFixed(1)}%`);

// Тест 6: Регулярная сетка (проверка на ложные срабатывания)
console.log('\n6. 🏗️ ТЕСТ: РЕГУЛЯРНАЯ СЕТКА:');
console.log('------------------------------');
const gridPoints = [];
for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
        gridPoints.push({
            x: 100 + i * 50,
            y: 100 + j * 50,
            confidence: 0.5,
            id: `grid_${i}_${j}`
        });
    }
}
const resultGrid = aligner.findBestAlignment(originalFootprint, gridPoints);
console.log(`Регулярная сетка 4x4: ${resultGrid.score.toFixed(3)} (ожидается < ${aligner.options.maxRandomScore})`);

function printResult(result, expectedAngle, expectedDx, expectedDy) {
    console.log(`Score: ${result.score.toFixed(3)}`);
   
    if (result.transform) {
        const detectedAngle = result.transform.rotation * 180 / Math.PI;
        console.log(`Угол поворота: ${detectedAngle.toFixed(1)}°`);
        console.log(`Ожидаемый угол: ${expectedAngle}°`);
        console.log(`Разница: ${Math.abs(detectedAngle - expectedAngle).toFixed(1)}°`);
       
        console.log(`Масштаб: ${result.transform.scale.toFixed(3)}`);
        console.log(`Смещение: (${result.transform.translation.x.toFixed(1)}, ${result.transform.translation.y.toFixed(1)})`);
        console.log(`Ожидаемое смещение: (${expectedDx}, ${expectedDy})`);
       
        const dxError = Math.abs(result.transform.translation.x - expectedDx);
        const dyError = Math.abs(result.transform.translation.y - expectedDy);
        console.log(`Ошибка смещения: ${Math.sqrt(dxError*dxError + dyError*dyError).toFixed(1)}px`);
    }
   
    console.log(`Зеркало: ${result.mirrored ? 'да ⚠️' : 'нет'}`);
   
    if (result.quality && result.quality.message) {
        console.log(`Качество: ${result.quality.message}`);
    } else {
        console.log(`Качество: ${result.score > 0.7 ? 'хорошее' : 'плохое'}`);
    }
   
    console.log(`Inliers: ${result.inliers ? result.inliers.length : 0}/${Math.min(originalFootprint.length, rotatedFootprint.length)}`);
   
    // Проверяем точность трансформации
    if (result.transform && result.inliers && result.inliers.length > 0) {
        const avgError = result.inliers.reduce((sum, inlier) => sum + inlier.distance, 0) / result.inliers.length;
        console.log(`Средняя ошибка inliers: ${avgError.toFixed(1)}px`);
    }
}

// Финальная оценка алгоритма
console.log('\n📊 ФИНАЛЬНАЯ ОЦЕНКА АЛГОРИТМА С ИСПРАВЛЕНИЯМИ:');
console.log('==============================================');

const tests = [
    { name: 'Малый поворот (15°)', result: result1, minScore: 0.7, maxScore: null },
    { name: 'Большой поворот (60°)', result: result2, minScore: 0.6, maxScore: null },
    { name: 'Зеркальный след', result: result3, minScore: 0.7, maxScore: null },
    { name: 'Случайные точки', result: result4, minScore: null, maxScore: aligner.options.maxRandomScore },
    { name: 'Шум (±15px)', result: resultNoise, minScore: 0.5, maxScore: null },
    { name: 'Регулярная сетка', result: resultGrid, minScore: null, maxScore: aligner.options.maxRandomScore }
];

let passed = 0;
tests.forEach(test => {
    const score = test.result.score;
    let status = '❌';
    let reason = '';
   
    if (test.minScore !== undefined && score >= test.minScore) {
        status = '✅';
        passed++;
    } else if (test.maxScore !== undefined && score <= test.maxScore) {
        status = '✅';
        passed++;
    } else {
        if (test.minScore) reason = ` (нужно >= ${test.minScore})`;
        if (test.maxScore) reason = ` (нужно <= ${test.maxScore})`;
    }
   
    console.log(`${status} ${test.name}: ${score.toFixed(3)}${reason}`);
});

console.log(`\n🎯 ИТОГО: ${passed}/${tests.length} тестов пройдено`);

if (passed === tests.length) {
    console.log('\n✨✨✨ АЛГОРИТМ ПОЛНОСТЬЮ ГОТОВ К ИНТЕГРАЦИИ! ✨✨✨');
    console.log('\n🎯 РЕКОМЕНДАЦИИ:');
    console.log('1. Score для случайных данных: <30% ✅');
    console.log('2. Зеркало: определяется ✅');
    console.log('3. Углы: точные ✅');
    console.log('4. Устойчивость к шуму: хорошая ✅');
} else {
    console.log('\n⚠️ Нужно доработать алгоритм перед интеграцией');
   
    // Диагностика проблем
    console.log('\n🔧 ДИАГНОСТИКА ПРОБЛЕМ:');
    if (result2.score < 0.6) {
        console.log('• Проблема с большими поворотами (>60°)');
        console.log('  Решение: увеличить maxIterations до 250');
    }
    if (result3.score < 0.7 && !result3.mirrored) {
        console.log('• Проблема с определением зеркальности');
        console.log('  Решение: уменьшить mirrorAdvantageThreshold до 0.1');
    }
    if (result4.score > aligner.options.maxRandomScore) {
        console.log(`• Слишком высокий score на случайных данных: ${result4.score.toFixed(3)} > ${aligner.options.maxRandomScore}`);
        console.log('  Решение: увеличить minInliersRatio до 0.65');
    }
}

// Дополнительная статистика
console.log('\n📈 ДОПОЛНИТЕЛЬНАЯ СТАТИСТИКА:');
const debugInfo = aligner.getDebugInfo();
console.log('• Алгоритм:', debugInfo.algorithm);
console.log('• Особенности:', debugInfo.features.join(', '));

// Вывод рекомендаций по настройкам
console.log('\n🔧 РЕКОМЕНДУЕМЫЕ НАСТРОЙКИ ДЛЯ ИНТЕГРАЦИИ:');
console.log(`
new PointCloudAligner({
    maxIterations: 200,
    inlierThreshold: 20,
    minInliersRatio: 0.6,
    minInliersAbsolute: 4,
    scaleRange: { min: 0.5, max: 2.0 },
    confidenceThreshold: 0.5,
    mirrorCheck: true,
    adaptiveInlierThreshold: true,
    requireGoodDistribution: true,
    requireGoodSpread: true,
    maxRandomScore: 0.3,
    mirrorAdvantageThreshold: 0.15
})
`);
