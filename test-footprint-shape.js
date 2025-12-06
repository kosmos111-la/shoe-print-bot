// test-footprint-shape.js
const PointCloudAligner = require('./modules/footprint/point-cloud-aligner');

// Создаём форму, похожую на след обуви (вид сверху)
// Это будет вытянутая изогнутая форма
const createFootprintShape = (centerX, centerY, length = 200, width = 80) => {
    // След состоит из нескольких ключевых точек:
    // 1. Пятка (задняя часть)
    // 2. Арка (самая узкая часть)
    // 3. Подошва
    // 4. Носок (передняя часть)
   
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

// Оригинальный след
const originalFootprint = createFootprintShape(300, 300, 250, 90);

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

// Создаём варианты:
// 1. Немного повёрнутый след (реалистичный случай)
const rotatedFootprint = rotateAndTranslate(originalFootprint, 15, 50, -30);

// 2. Сильно повёрнутый след (проблемный случай)
const heavilyRotatedFootprint = rotateAndTranslate(originalFootprint, 60, 100, 50);

// 3. Зеркальный след (левый/правый ботинок)
const mirroredFootprint = originalFootprint.map(p => ({
    x: -p.x + 600, // Зеркалим по X и смещаем
    y: p.y + 100,
    confidence: p.confidence,
    id: `${p.id}_mirrored`
}));

console.log('👣 ТЕСТ НА РЕАЛЬНОЙ ФОРМЕ СЛЕДА');
console.log('==============================\n');

console.log('📊 СТАТИСТИКА:');
console.log(`Оригинальный след: ${originalFootprint.length} точек`);
console.log(`Повёрнутый след (15°): ${rotatedFootprint.length} точек`);
console.log(`Сильно повёрнутый след (60°): ${heavilyRotatedFootprint.length} точек`);
console.log(`Зеркальный след: ${mirroredFootprint.length} точек`);

// Функция для визуализации в консоли (простая)
const visualizeInConsole = (points1, points2, title) => {
    console.log(`\n📐 ${title}:`);
   
    // Находим границы
    const allPoints = [...points1, ...points2];
    const xs = allPoints.map(p => p.x);
    const ys = allPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
   
    const width = 60;
    const height = 20;
   
    // Создаём "холст"
    const canvas = Array(height).fill().map(() => Array(width).fill(' '));
   
    // Функция для преобразования координат
    const toCanvasX = (x) => Math.floor((x - minX) / (maxX - minX) * (width - 1));
    const toCanvasY = (y) => Math.floor((y - minY) / (maxY - minY) * (height - 1));
   
    // Рисуем точки первого следа (красные '●')
    points1.forEach(p => {
        const cx = toCanvasX(p.x);
        const cy = toCanvasY(p.y);
        if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
            canvas[cy][cx] = '🔴';
        }
    });
   
    // Рисуем точки второго следа (синие '○')
    points2.forEach(p => {
        const cx = toCanvasX(p.x);
        const cy = toCanvasY(p.y);
        if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
            if (canvas[cy][cx] === '🔴') {
                canvas[cy][cx] = '🟣'; // Перекрытие
            } else {
                canvas[cy][cx] = '🔵';
            }
        }
    });
   
    // Выводим
    console.log('🔴 - оригинал, 🔵 - трансформированный, 🟣 - совпадение');
    canvas.forEach(row => console.log(row.join('')));
};

// Визуализируем в консоли
visualizeInConsole(originalFootprint, rotatedFootprint, "Оригинал vs Поворот 15°");
visualizeInConsole(originalFootprint, heavilyRotatedFootprint, "Оригинал vs Поворот 60°");
visualizeInConsole(originalFootprint, mirroredFootprint, "Оригинал vs Зеркало");

// Тестируем алгоритм
console.log('\n🎯 ТЕСТИРУЕМ АЛГОРИТМ:');
console.log('====================\n');

const aligner = new PointCloudAligner({
    maxIterations: 200,
    inlierThreshold: 25, // Больше для следов
    minInliersRatio: 0.5,
    mirrorCheck: true
});

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
printResult(result3, 0, 300, 100); // Ожидаем зеркало, а не поворот

// Тест 4: Случайные точки (контрольный тест)
console.log('\n4. 🎲 ТЕСТ: СЛУЧАЙНЫЕ ТОЧКИ (контрольный):');
console.log('-----------------------------------------');
const randomPoints = Array(10).fill().map((_, i) => ({
    x: Math.random() * 500,
    y: Math.random() * 500,
    confidence: 0.5,
    id: `random_${i}`
}));
const result4 = aligner.findBestAlignment(originalFootprint, randomPoints);
console.log(`Score: ${result4.score.toFixed(3)} (ожидается < 0.3)`);
console.log(`Качество: ${result4.quality.message}`);

// Вспомогательная функция для вывода результатов
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
   
    console.log(`Зеркало: ${result.mirrored ? 'да' : 'нет'}`);
    console.log(`Качество: ${result.quality.message}`);
    console.log(`Inliers: ${result.inliers.length}/${Math.min(originalFootprint.length, rotatedFootprint.length)}`);
   
    // Проверяем точность трансформации
    if (result.transform && result.inliers.length > 0) {
        const avgError = result.inliers.reduce((sum, inlier) => sum + inlier.distance, 0) / result.inliers.length;
        console.log(`Средняя ошибка inliers: ${avgError.toFixed(1)}px`);
    }
}

// Дополнительный тест: проверка устойчивости к шуму
console.log('\n5. 📈 ТЕСТ: УСТОЙЧИВОСТЬ К ШУМУ:');
console.log('--------------------------------');
const addNoise = (points, noiseLevel = 10) => {
    return points.map(p => ({
        x: p.x + (Math.random() - 0.5) * 2 * noiseLevel,
        y: p.y + (Math.random() - 0.5) * 2 * noiseLevel,
        confidence: p.confidence * 0.9, // Немного снижаем уверенность
        id: `${p.id}_noisy`
    }));
};

const noisyFootprint = addNoise(rotatedFootprint, 15);
const resultNoise = aligner.findBestAlignment(originalFootprint, noisyFootprint);
console.log(`Уровень шума: ±15px`);
console.log(`Score с шумом: ${resultNoise.score.toFixed(3)}`);
console.log(`Score без шума: ${result1.score.toFixed(3)}`);
console.log(`Потеря точности: ${((result1.score - resultNoise.score) * 100).toFixed(1)}%`);

// Финальная оценка алгоритма
console.log('\n📊 ФИНАЛЬНАЯ ОЦЕНКА АЛГОРИТМА:');
console.log('=============================');

const tests = [
    { name: 'Малый поворот', result: result1, minScore: 0.7 },
    { name: 'Большой поворот', result: result2, minScore: 0.6 },
    { name: 'Зеркало', result: result3, minScore: 0.7 },
    { name: 'Случайные точки', result: result4, maxScore: 0.3 },
    { name: 'Шум', result: resultNoise, minScore: 0.5 }
];

let passed = 0;
tests.forEach(test => {
    const score = test.result.score;
    let status = '❌';
   
    if (test.minScore !== undefined && score >= test.minScore) {
        status = '✅';
        passed++;
    } else if (test.maxScore !== undefined && score <= test.maxScore) {
        status = '✅';
        passed++;
    }
   
    console.log(`${status} ${test.name}: ${score.toFixed(3)} ${test.minScore ? `(min ${test.minScore})` : `(max ${test.maxScore})`}`);
});

console.log(`\n🎯 ИТОГО: ${passed}/${tests.length} тестов пройдено`);

if (passed === tests.length) {
    console.log('✨ АЛГОРИТМ ГОТОВ К ИНТЕГРАЦИИ!');
} else {
    console.log('⚠️ Нужно доработать алгоритм перед интеграцией');
   
    // Диагностика проблем
    console.log('\n🔧 ДИАГНОСТИКА ПРОБЛЕМ:');
    if (result2.score < 0.6) {
        console.log('• Проблема с большими поворотами (>60°)');
        console.log('  Решение: увеличить maxIterations или улучшить выбор начальных точек');
    }
    if (result3.score < 0.7 && !result3.mirrored) {
        console.log('• Проблема с определением зеркальности');
        console.log('  Решение: улучшить алгоритм проверки зеркальности');
    }
    if (result4.score > 0.3) {
        console.log('• Слишком высокий score на случайных данных (ложные срабатывания)');
        console.log('  Решение: увеличить minInliersRatio или улучшить оценку качества');
    }
}
