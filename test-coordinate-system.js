// test-coordinate-system.js
const SimpleFootprint = require('./modules/footprint/simple-footprint');

async function testUnifiedCoordinateSystem() {
    console.log('🧪 ТЕСТИРУЮ ЕДИНУЮ СИСТЕМУ КООРДИНАТ\n');

    // Создаем тестовые отпечатки
    const fp1 = new SimpleFootprint({
        name: 'Тестовый отпечаток 1',
        userId: 'test_user'
    });

    const fp2 = new SimpleFootprint({
        name: 'Тестовый отпечаток 2',
        userId: 'test_user'
    });

    // Добавляем тестовые точки в разные системы координат
    const testPoints1 = [
        { x: 100, y: 100, confidence: 0.8 },
        { x: 200, y: 150, confidence: 0.7 },
        { x: 150, y: 200, confidence: 0.9 },
        { x: 250, y: 250, confidence: 0.6 }
    ];

    const testPoints2 = [
        { x: 400, y: 400, confidence: 0.8 },
        { x: 450, y: 450, confidence: 0.7 },
        { x: 500, y: 500, confidence: 0.9 },
        { x: 550, y: 550, confidence: 0.6 }
    ];

    console.log('1. 📊 ПРОВЕРКА КООРДИНАТ ОТПЕЧАТКОВ:');

    // Симулируем добавление точек через анализ
    const mockAnalysis1 = {
        predictions: testPoints1.map((p, i) => ({
            class: 'shoe-protector',
            confidence: p.confidence,
            points: [
                { x: p.x - 10, y: p.y - 10 },
                { x: p.x + 10, y: p.y + 10 }
            ]
        }))
    };

    const mockAnalysis2 = {
        predictions: testPoints2.map((p, i) => ({
            class: 'shoe-protector',
            confidence: p.confidence,
            points: [
                { x: p.x - 10, y: p.y - 10 },
                { x: p.x + 10, y: p.y + 10 }
            ]
        }))
    };

    // Добавляем анализ
    fp1.addAnalysisHonest(mockAnalysis1, { photoId: 'test_photo_1' });
    fp2.addAnalysisHonest(mockAnalysis2, { photoId: 'test_photo_2' });

    // Получаем точки в единой системе
    const points1 = fp1.getPointsForTemplateMatching();
    const points2 = fp2.getPointsForTemplateMatching();

    console.log(`   Отпечаток 1: ${points1.length} точек`);
    console.log(`   Отпечаток 2: ${points2.length} точек`);

    if (points1.length > 0 && points2.length > 0) {
        console.log('\n2. 📐 СРАВНЕНИЕ КООРДИНАТ:');

        const sample1 = points1[0];
        const sample2 = points2[0];

        console.log(`   FP1: (${sample1.x?.toFixed(1)}, ${sample1.y?.toFixed(1)})`);
        console.log(`   FP2: (${sample2.x?.toFixed(1)}, ${sample2.y?.toFixed(1)})`);

        // Проверяем диапазоны
        const xs1 = points1.map(p => p.x);
        const ys1 = points1.map(p => p.y);
        const xs2 = points2.map(p => p.x);
        const ys2 = points2.map(p => p.y);

        console.log('\n3. 📏 ДИАПАЗОНЫ КООРДИНАТ:');
        console.log(`   FP1 X: ${Math.min(...xs1).toFixed(1)}-${Math.max(...xs1).toFixed(1)}`);
        console.log(`   FP1 Y: ${Math.min(...ys1).toFixed(1)}-${Math.max(...ys1).toFixed(1)}`);
        console.log(`   FP2 X: ${Math.min(...xs2).toFixed(1)}-${Math.max(...xs2).toFixed(1)}`);
        console.log(`   FP2 Y: ${Math.min(...ys2).toFixed(1)}-${Math.max(...ys2).toFixed(1)}`);

        console.log('\n4. 🎯 ПРОВЕРКА СИСТЕМЫ КООРДИНАТ:');

        // Все точки должны быть в диапазоне 200-800
        const checkRange = (points, name) => {
            const outOfRange = points.filter(p => p.x < 150 || p.x > 850 || p.y < 150 || p.y > 850);
            console.log(`   ${name}: ${points.length - outOfRange.length}/${points.length} в диапазоне 200-800`);

            if (outOfRange.length > 0) {
                console.log(`   ⚠️  ${outOfRange.length} точек вне диапазона`);
            }
        };

        checkRange(points1, 'FP1');
        checkRange(points2, 'FP2');

        console.log('\n5. 🔍 ТЕСТОВОЕ СРАВНЕНИЕ:');

        // Простое сравнение точек
        let matches = 0;
        const THRESHOLD = 50;

        points1.forEach(p1 => {
            let minDist = Infinity;

            points2.forEach(p2 => {
                const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
                if (dist < minDist) minDist = dist;
            });

            if (minDist < THRESHOLD) matches++;
        });

        const percentage = (matches / points1.length) * 100;
        console.log(`   Совпадений (<${THRESHOLD}px): ${matches}/${points1.length}`);
        console.log(`   Процент: ${percentage.toFixed(1)}%`);

        if (percentage > 60) {
            console.log('   ✅ ХОРОШЕЕ СОВПАДЕНИЕ!');
        } else {
            console.log('   ⚠️  МАЛО СОВПАДЕНИЙ');
        }

        console.log('\n6. 📈 ДИАГНОСТИКА КООРДИНАТ:');
       
        // Проверяем nx/ny
        const validNxNy1 = points1.filter(p => p.nx !== undefined && p.ny !== undefined).length;
        const validNxNy2 = points2.filter(p => p.nx !== undefined && p.ny !== undefined).length;
       
        console.log(`   FP1: ${validNxNy1}/${points1.length} точек имеют nx/ny`);
        console.log(`   FP2: ${validNxNy2}/${points2.length} точек имеют nx/ny`);
       
        if (validNxNy1 > 0 && validNxNy2 > 0) {
            console.log(`   ✅ nx/ny корректно установлены`);
        }
    }

    console.log('\n🎯 ТЕСТ ЗАВЕРШЕН');
}

// Запуск теста
testUnifiedCoordinateSystem().catch(console.error);

module.exports = { testUnifiedCoordinateSystem };
