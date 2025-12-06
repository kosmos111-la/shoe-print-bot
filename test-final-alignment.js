// test-final-alignment.js - ФИНАЛЬНЫЙ ТЕСТ ДЛЯ PointCloudAligner
const PointCloudAligner = require('./modules/footprint/point-cloud-aligner');

console.log('🎯 ФИНАЛЬНЫЙ ТЕСТ PointCloudAligner (ИСПРАВЛЕННАЯ ВЕРСИЯ)');
console.log('=========================================================\n');

// Создаем реалистичную форму следа
const createRealisticShape = () => {
    const points = [];
    // Форма подошвы обуви (8 точек по кругу с вариациями)
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 80 + Math.random() * 20;
        points.push({
            x: 300 + radius * Math.cos(angle),
            y: 300 + radius * Math.sin(angle),
            confidence: 0.8 + Math.random() * 0.2,
            id: `point_${i}`
        });
    }
    return points;
};

// Функция для создания трансформированной формы
const createTransformedShape = (originalPoints, transform) => {
    const { angle, dx, dy, mirror } = transform;
    const angleRad = angle * Math.PI / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
   
    return originalPoints.map(p => {
        let x = p.x;
        let y = p.y;
       
        // Зеркало относительно центра (x=300)
        if (mirror) {
            x = 600 - x; // Зеркалим относительно x=300
        }
       
        // Поворот относительно центра (300, 300)
        const centeredX = x - 300;
        const centeredY = y - 300;
        const rotatedX = centeredX * cos - centeredY * sin + 300;
        const rotatedY = centeredX * sin + centeredY * cos + 300;
       
        // Смещение
        return {
            x: rotatedX + dx,
            y: rotatedY + dy,
            confidence: p.confidence,
            id: `${p.id}_transformed`
        };
    });
};

// Тестовые сценарии
const tests = [
    {
        name: 'Малый поворот (15°)',
        transform: { angle: 15, dx: 30, dy: -20, mirror: false },
        minScore: 0.7,
        maxAngleError: 5
    },
    {
        name: 'Средний поворот (45°)',
        transform: { angle: 45, dx: 50, dy: 30, mirror: false },
        minScore: 0.65,
        maxAngleError: 8
    },
    {
        name: 'Большой поворот (90°)',
        transform: { angle: 90, dx: 80, dy: -40, mirror: false },
        minScore: 0.6,
        maxAngleError: 10
    },
    {
        name: 'Зеркальный след',
        transform: { angle: 0, dx: 100, dy: 0, mirror: true },
        minScore: 0.65,
        maxAngleError: 5,
        mustBeMirrored: true
    },
    {
        name: 'Зеркальный с поворотом (30°)',
        transform: { angle: 30, dx: 60, dy: 40, mirror: true },
        minScore: 0.6,
        maxAngleError: 10,
        mustBeMirrored: true
    }
];

// Создаем aligner с оптимальными настройками
const aligner = new PointCloudAligner({
    maxIterations: 150,
    inlierThreshold: 25,
    minInliersRatio: 0.5,
    minInliersAbsolute: 3,
    mirrorCheck: true,
    mirrorAdvantageThreshold: 0.1,
    maxRandomScore: 0.3,
    adaptiveInlierThreshold: true
});

const originalShape = createRealisticShape();
console.log(`📊 Оригинальная форма: ${originalShape.length} точек`);
console.log(`🎯 Настройки aligner: maxIterations=${aligner.options.maxIterations}, mirrorCheck=${aligner.options.mirrorCheck}`);

let passed = 0;
const results = [];

tests.forEach((test, index) => {
    console.log(`\n${index + 1}. 🔄 ТЕСТ: ${test.name}`);
    console.log('-----------------------------------');
   
    // Создаем трансформированную версию
    const transformedShape = createTransformedShape(originalShape, test.transform);
   
    console.log(`📐 Параметры трансформации:`);
    console.log(`   • Угол: ${test.transform.angle}°`);
    console.log(`   • Смещение: (${test.transform.dx}, ${test.transform.dy})`);
    console.log(`   • Зеркало: ${test.transform.mirror ? 'да' : 'нет'}`);
   
    // Запускаем алгоритм
    console.log('🔍 Запуск алгоритма совмещения...');
    const result = aligner.findBestAlignment(originalShape, transformedShape);
   
    // Проверяем результаты
    const angleError = result.transform ?
        Math.abs(result.transform.rotation * 180 / Math.PI - test.transform.angle) : 180;
   
    // Нормализуем угол ошибки (0-180°)
    const normalizedAngleError = Math.min(angleError, Math.abs(angleError - 360));
   
    const isMirrorCorrect = test.mustBeMirrored ?
        result.mirrored === true : // Для зеркальных тестов должен обнаружить зеркало
        true; // Для обычных тестов не важен результат зеркала
   
    const isAngleGood = normalizedAngleError <= test.maxAngleError;
    const isScoreGood = result.score >= test.minScore;
   
    const passedTest = isMirrorCorrect && isAngleGood && isScoreGood;
   
    // Сохраняем результат
    const testResult = {
        name: test.name,
        passed: passedTest,
        details: {
            score: result.score,
            angleError: normalizedAngleError,
            mirrored: result.mirrored,
            expectedMirror: test.transform.mirror,
            inliers: result.inliers ? result.inliers.length : 0,
            transform: result.transform
        }
    };
   
    results.push(testResult);
   
    console.log(`📊 РЕЗУЛЬТАТ:`);
    console.log(`   • Score: ${result.score.toFixed(3)} ${isScoreGood ? '✅' : '❌'} (мин. ${test.minScore})`);
    console.log(`   • Угол: ${result.transform ? (result.transform.rotation * 180 / Math.PI).toFixed(1) : 'N/A'}°`);
    console.log(`   • Ошибка угла: ${normalizedAngleError.toFixed(1)}° ${isAngleGood ? '✅' : '❌'} (макс. ${test.maxAngleError}°)`);
    console.log(`   • Зеркало: ${result.mirrored ? 'да' : 'нет'} ${isMirrorCorrect ? '✅' : '❌'}`);
    console.log(`   • Inliers: ${result.inliers ? result.inliers.length : 0}/${Math.min(originalShape.length, transformedShape.length)}`);
    console.log(`   • Качество: ${result.quality ? result.quality.message : 'N/A'}`);
   
    if (passedTest) {
        passed++;
        console.log(`   🎯 ТЕСТ ПРОЙДЕН!`);
    } else {
        console.log(`   ⚠️ ТЕСТ НЕ ПРОЙДЕН`);
        if (!isMirrorCorrect) console.log(`     - Проблема с зеркалом`);
        if (!isAngleGood) console.log(`     - Слишком большая ошибка угла`);
        if (!isScoreGood) console.log(`     - Score слишком низкий`);
    }
});

// Дополнительные тесты
console.log('\n📊 ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ:');
console.log('-------------------------');

// Тест на случайные точки
console.log('\n6. 🎲 ТЕСТ: СЛУЧАЙНЫЕ ТОЧКИ');
const randomPoints = Array(10).fill().map((_, i) => ({
    x: Math.random() * 600,
    y: Math.random() * 600,
    confidence: 0.5,
    id: `random_${i}`
}));
const randomResult = aligner.findBestAlignment(originalShape, randomPoints);
console.log(`   Score: ${randomResult.score.toFixed(3)} ${randomResult.score <= 0.3 ? '✅' : '❌'} (макс. 0.3)`);

// Тест на регулярную сетку
console.log('\n7. 🏗️ ТЕСТ: РЕГУЛЯРНАЯ СЕТКА 4x4');
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
const gridResult = aligner.findBestAlignment(originalShape, gridPoints);
console.log(`   Score: ${gridResult.score.toFixed(3)} ${gridResult.score <= 0.3 ? '✅' : '❌'} (макс. 0.3)`);

// Тест на шум
console.log('\n8. 📈 ТЕСТ: УСТОЙЧИВОСТЬ К ШУМУ (±15px)');
const addNoise = (points, noiseLevel = 15) => {
    return points.map(p => ({
        x: p.x + (Math.random() - 0.5) * 2 * noiseLevel,
        y: p.y + (Math.random() - 0.5) * 2 * noiseLevel,
        confidence: p.confidence * 0.9,
        id: `${p.id}_noisy`
    }));
};
const noisyShape = addNoise(createTransformedShape(originalShape, tests[0].transform), 15);
const noiseResult = aligner.findBestAlignment(originalShape, noisyShape);
console.log(`   Score с шумом: ${noiseResult.score.toFixed(3)}`);
console.log(`   Потеря точности: ${((results[0].details.score - noiseResult.score) * 100).toFixed(1)}%`);

console.log('\n📊 ===== ФИНАЛЬНЫЕ РЕЗУЛЬТАТЫ =====');
console.log(`✅ Основные тесты пройдено: ${passed}/${tests.length}`);

if (randomResult.score <= 0.3) {
    console.log(`✅ Случайные точки: PASS`);
    passed++;
}

if (gridResult.score <= 0.3) {
    console.log(`✅ Регулярная сетка: PASS`);
    passed++;
}

const totalTests = tests.length + 3; // Основные + случайные + сетка + шум
console.log(`\n🎯 ИТОГО: ${passed}/${totalTests} тестов пройдено`);

if (passed >= totalTests - 1) { // Допускаем 1 неудачный тест
    console.log('\n✨✨✨ АЛГОРИТМ ПОЛНОСТЬЮ ГОТОВ К ИНТЕГРАЦИИ! ✨✨✨');
   
    console.log('\n📋 РЕКОМЕНДАЦИИ ДЛЯ ИНТЕГРАЦИИ В DigitalFootprint:');
    console.log(`
    1. Добавить в digital-footprint.js:
   
    const PointCloudAligner = require('./point-cloud-aligner');
   
    // Новый метод для добавления с совмещением
    addAnalysisWithAlignment(analysis, sourceInfo) {
        if (this.nodes.size < 3) {
            return this.addAnalysis(analysis, sourceInfo);
        }
       
        const modelPoints = Array.from(this.nodes.values()).map(node => ({
            x: node.center.x,
            y: node.center.y,
            confidence: node.confidence,
            id: node.id
        }));
       
        const newPoints = // ... преобразовать новые протекторы
       
        const aligner = new PointCloudAligner({
            maxIterations: 150,
            inlierThreshold: 25,
            minInliersRatio: 0.5,
            mirrorCheck: true
        });
       
        const result = aligner.findBestAlignment(modelPoints, newPoints);
       
        if (result.score > 0.6) {
            // Трансформировать и добавить точки
            return this.addTransformedAnalysis(analysis, sourceInfo, result);
        } else {
            return this.addAnalysis(analysis, sourceInfo);
        }
    }
   
    2. Обновить index.js для экспорта PointCloudAligner
   
    3. Использовать в менеджере моделей для автоматического совмещения
    `);
   
    console.log('\n⚙️ ОПТИМАЛЬНЫЕ НАСТРОЙКИ ДЛЯ ПРОДАКШЕНА:');
    console.log(`
    new PointCloudAligner({
        maxIterations: 150,           // Баланс скорости и точности
        inlierThreshold: 25,          // Для следов среднего размера
        minInliersRatio: 0.5,         // 50% совпадения - достаточно
        minInliersAbsolute: 3,        // Минимум 3 точки для надежности
        mirrorCheck: true,            // Включить обнаружение зеркала
        mirrorAdvantageThreshold: 0.1,// 10% преимущество для зеркала
        maxRandomScore: 0.3,          // Отсечка для случайных данных
        adaptiveInlierThreshold: true // Адаптивный порог
    })
    `);
} else {
    console.log(`\n⚠️ Нужно исправить ${totalTests - passed} тестов перед интеграцией`);
   
    // Диагностика проблем
    console.log('\n🔧 ДИАГНОСТИКА ПРОБЛЕМ:');
    results.forEach((test, idx) => {
        if (!test.passed) {
            console.log(`• ${test.name}:`);
            console.log(`  Score: ${test.details.score.toFixed(3)}`);
            console.log(`  Угол: ${test.details.transform ? (test.details.transform.rotation * 180 / Math.PI).toFixed(1) : 'N/A'}°`);
            console.log(`  Зеркало: ${test.details.mirrored} (ожидалось: ${test.details.expectedMirror})`);
        }
    });
}

console.log('\n🔍 ДЕБАГ ИНФОРМАЦИЯ:');
const debugInfo = aligner.getDebugInfo();
console.log(`Алгоритм: ${debugInfo.algorithm}`);
console.log(`Особенности: ${debugInfo.features.join(', ')}`);
