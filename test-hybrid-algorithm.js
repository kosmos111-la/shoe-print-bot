// test-hybrid-algorithm.js
// 🧪 ТЕСТ ГИБРИДНОГО АЛГОРИТМА

const HybridAlgorithm = require('./modules/footprint/clean/hybrid-algorithm');

function createTestPoints(count = 50) {
    const points = [];
    const radius = 200;
   
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI;
        points.push({
            x: 500 + radius * Math.cos(angle) + (Math.random() - 0.5) * 30,
            y: 500 + radius * Math.sin(angle) + (Math.random() - 0.5) * 30,
            originalId: `pt_${i}`,
            confidence: 0.8
        });
    }
   
    return points;
}

async function testHybridAlgorithm() {
    console.log('🧪 ТЕСТ ГИБРИДНОГО АЛГОРИТМА\n');
   
    const algorithm = new HybridAlgorithm({
        debug: true,
        minPoints: 20,
        similarityThreshold: 0.6,
        fixedNeighbors: [-3, -2, -1, 1, 2, 3]
    });
   
    console.log('1. 📐 ТЕСТ 1: ОДИНАКОВЫЕ ТОЧКИ');
    console.log('='.repeat(60));
   
    const points1 = createTestPoints(60);
    const points2 = JSON.parse(JSON.stringify(points1)); // Копия
   
    // Поворачиваем вторую копию
    const angle = 45 * Math.PI / 180;
    points2.forEach(p => {
        const dx = p.x - 500;
        const dy = p.y - 500;
        p.x = 500 + dx * Math.cos(angle) - dy * Math.sin(angle);
        p.y = 500 + dx * Math.sin(angle) + dy * Math.cos(angle);
        p.originalId = `rotated_${p.originalId}`; // 🔥 Меняем ID!
    });
   
    const fp1 = algorithm.createFootprint(points1, 'След 1');
    const fp2 = algorithm.createFootprint(points2, 'След 2 (повернутый)');
   
    const result1 = algorithm.compareFootprints(fp1, fp2, 'След 1', 'След 2 (повернутый)');
    console.log(`   Результат: ${result1.decision}, схожесть: ${result1.similarity.toFixed(3)}`);
    console.log(`   Ожидается: SAME (геометрия та же, ID разные)`);
   
    console.log('\n2. 📐 ТЕСТ 2: РАЗНЫЕ ТОЧКИ');
    console.log('='.repeat(60));
   
    const differentPoints = createTestPoints(55);
    const fp3 = algorithm.createFootprint(differentPoints, 'Другой след');
   
    const result2 = algorithm.compareFootprints(fp1, fp3, 'След 1', 'Другой след');
    console.log(`   Результат: ${result2.decision}, схожесть: ${result2.similarity.toFixed(3)}`);
    console.log(`   Ожидается: DIFFERENT (разная геометрия)`);
   
    console.log('\n📊 АНАЛИЗ:');
    console.log('='.repeat(60));
   
    console.log('✅ ГИБРИДНЫЙ АЛГОРИТМ СОЧЕТАЕТ:');
    console.log('   • Триангуляцию с фиксированными соседями');
    console.log('   • Локальные дескрипторы для поиска соответствий');
    console.log('   • Инвариантность к повороту и смещению');
    console.log('   • Устойчивость к разным ID точек');
}

testHybridAlgorithm().catch(console.error);
