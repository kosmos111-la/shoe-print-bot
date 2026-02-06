// test-fixed-hybrid.js
// 🧪 ТЕСТ ИСПРАВЛЕННОГО ГИБРИДНОГО АЛГОРИТМА

const HybridAlgorithm = require('./modules/footprint/clean/hybrid-algorithm');

// Простая тестовая фигура
function createTestPoints() {
    return [
        { x: 100, y: 100, originalId: 'A' },
        { x: 200, y: 100, originalId: 'B' },
        { x: 200, y: 200, originalId: 'C' },
        { x: 100, y: 200, originalId: 'D' },
        { x: 150, y: 150, originalId: 'E' }
    ];
}

function rotatePoints(points, degrees) {
    const angle = degrees * Math.PI / 180;
    const center = { x: 150, y: 150 };
   
    return points.map(p => {
        const dx = p.x - center.x;
        const dy = p.y - center.y;
        return {
            x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
            y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle),
            originalId: `${p.originalId}_R${degrees}`
        };
    });
}

async function test() {
    console.log('🧪 ТЕСТ ИСПРАВЛЕННОГО АЛГОРИТМА (инвариантного к повороту)\n');
   
    const algorithm = new HybridAlgorithm({
        debug: true,
        minPoints: 3,
        similarityThreshold: 0.6,
        rotationSearchStep: 30
    });
   
    console.log('1. 📐 ТЕСТ: ПОВОРОТ НА 45°');
    console.log('='.repeat(50));
   
    const points1 = createTestPoints();
    const points2 = rotatePoints(points1, 45);
   
    const fp1 = algorithm.createFootprint(points1, 'Оригинал');
    const fp2 = algorithm.createFootprint(points2, 'Повернутый на 45°');
   
    console.log('\n🔍 СРАВНЕНИЕ:');
    const result = algorithm.compareFootprints(fp1, fp2);
   
    console.log(`\n🎯 РЕЗУЛЬТАТ: ${result.decision}, схожесть: ${result.similarity.toFixed(3)}`);
    console.log(`   Ожидается: SAME (инвариантно к повороту)`);
   
    console.log('\n2. 📐 ТЕСТ: ПОВОРОТ НА 90°');
    console.log('='.repeat(50));
   
    const points3 = rotatePoints(points1, 90);
    const fp3 = algorithm.createFootprint(points3, 'Повернутый на 90°');
   
    const result2 = algorithm.compareFootprints(fp1, fp3);
    console.log(`   Результат: ${result2.decision}, схожесть: ${result2.similarity.toFixed(3)}`);
    console.log(`   Ожидается: SAME (инвариантно к повороту)`);
   
    console.log('\n3. 📐 ТЕСТ: РАЗНЫЕ ФИГУРЫ');
    console.log('='.repeat(50));
   
    const differentPoints = [
        { x: 300, y: 300, originalId: 'X' },
        { x: 400, y: 300, originalId: 'Y' },
        { x: 350, y: 400, originalId: 'Z' }
    ];
    const fp4 = algorithm.createFootprint(differentPoints, 'Другая фигура');
   
    const result3 = algorithm.compareFootprints(fp1, fp4);
    console.log(`   Результат: ${result3.decision}, схожесть: ${result3.similarity.toFixed(3)}`);
    console.log(`   Ожидается: DIFFERENT (разная геометрия)`);
   
    console.log('\n📊 ИТОГ:');
    console.log('='.repeat(50));
   
    if (result.decision === 'same' && result2.decision === 'same' && result3.decision === 'different') {
        console.log('✅ АЛГОРИТМ РАБОТАЕТ КОРРЕКТНО!');
        console.log('   • Инвариантен к повороту');
        console.log('   • Различает разные фигуры');
        console.log('   • Автоматически ищет наилучший угол поворота');
    } else {
        console.log('⚠️ ПРОБЛЕМЫ:');
        console.log(`   • Поворот 45°: ${result.decision} (ожидалось: same)`);
        console.log(`   • Поворот 90°: ${result2.decision} (ожидалось: same)`);
        console.log(`   • Разные фигуры: ${result3.decision} (ожидалось: different)`);
    }
}

test().catch(console.error);
