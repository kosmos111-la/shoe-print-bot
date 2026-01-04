// quick-fix-invariant-test.js
const SimpleGraph = require('./modules/footprint/simple-graph');

// 🔥 БЫСТРОЕ ИСПРАВЛЕНИЕ: Создаем инвариантный матчер
class QuickInvariantMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
    }
   
    // 🔥 ПРОСТОЕ ИНВАРИАНТНОЕ СРАВНЕНИЕ
    compareGraphsInvariant(graph1, graph2) {
        console.log('🔍 ИНВАРИАНТНОЕ сравнение графов...');
       
        // 1. Нормализуем оба графа
        const norm1 = this.normalizeGraphSimple(graph1);
        const norm2 = this.normalizeGraphSimple(graph2);
       
        console.log(`   Нормализовано: ${norm1.nodes.length} и ${norm2.nodes.length} узлов`);
       
        // 2. Простое сравнение нормализованных координат
        let matchCount = 0;
        const threshold = 0.15; // 15% от нормализованного размера
       
        norm1.nodes.forEach(node1 => {
            let bestMatch = null;
            let bestDistance = Infinity;
           
            norm2.nodes.forEach(node2 => {
                const dx = node1.nx - node2.nx;
                const dy = node1.ny - node2.ny;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < bestDistance && distance < threshold) {
                    bestDistance = distance;
                    bestMatch = node2;
                }
            });
           
            if (bestMatch) {
                matchCount++;
                if (this.debug && matchCount <= 3) {
                    console.log(`   ✅ ${node1.id} (${node1.nx.toFixed(2)},${node1.ny.toFixed(2)}) ↔ ` +
                              `${bestMatch.id} (${bestMatch.nx.toFixed(2)},${bestMatch.ny.toFixed(2)})`);
                }
            }
        });
       
        const similarity = Math.min(1, matchCount / Math.min(norm1.nodes.length, norm2.nodes.length));
       
        console.log(`📊 Инвариантное сопоставление: ${matchCount}/${Math.min(norm1.nodes.length, norm2.nodes.length)} точек, схожесть=${similarity.toFixed(3)}`);
       
        return similarity;
    }
   
    // 🔥 ПРОСТАЯ НОРМАЛИЗАЦИЯ
    normalizeGraphSimple(graph) {
        const nodes = Array.from(graph.nodes.values());
       
        if (nodes.length === 0) return { nodes: [] };
       
        const xs = nodes.map(n => n.x);
        const ys = nodes.map(n => n.y);
       
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
       
        const normalizedNodes = nodes.map(node => ({
            ...node,
            nx: (node.x - minX) / width,
            ny: (node.y - minY) / height,
            originalX: node.x,
            originalY: node.y
        }));
       
        return { nodes: normalizedNodes };
    }
}

// 🔥 ТЕСТ ИНВАРИАНТНОСТИ
async function testQuickInvariant() {
    console.log('🧪 БЫСТРЫЙ ТЕСТ ИНВАРИАНТНОСТИ\n');
   
    // Те же графы что и раньше
    const graph1 = new SimpleGraph('След 1 (маленький, слева)');
    const graph2 = new SimpleGraph('След 2 (большой, справа)');
   
    const shape = [
        {x: 0.0, y: 0.0}, {x: 0.2, y: 0.1}, {x: 0.4, y: -0.1}, {x: 0.6, y: 0.2},
        {x: 0.8, y: 0.0}, {x: 1.0, y: -0.2}, {x: 0.9, y: 0.3}, {x: 0.7, y: -0.3},
        {x: 0.3, y: 0.4}, {x: 0.5, y: -0.4}
    ];
   
    const points1 = shape.map((p, i) => ({
        x: 100 + p.x * 200,
        y: 100 + p.y * 200,
        confidence: 0.8,
        id: `p1_${i}`
    }));
   
    const points2 = shape.map((p, i) => ({
        x: 500 + p.x * 400,
        y: 300 + p.y * 400,
        confidence: 0.8,
        id: `p2_${i}`
    }));
   
    graph1.buildFromPoints(points1);
    graph2.buildFromPoints(points2);
   
    console.log(`📊 Граф 1: ${graph1.nodes.size} узлов, область: 100-300x100-260`);
    console.log(`📊 Граф 2: ${graph2.nodes.size} узлов, область: 500-900x300-620`);
    console.log(`📐 Граф 2 в 2 раза больше и смещен\n`);
   
    // Тестируем простой инвариантный матчер
    const matcher = new QuickInvariantMatcher({ debug: true });
   
    console.log('🎯 ТЕСТ: Инвариантное сравнение');
    const similarity = matcher.compareGraphsInvariant(graph1, graph2);
   
    // Также покажем нормализованные координаты
    console.log('\n📐 Нормализованные координаты (первые 3 точки):');
   
    const norm1 = matcher.normalizeGraphSimple(graph1);
    const norm2 = matcher.normalizeGraphSimple(graph2);
   
    console.log('   Граф 1 (нормализованный):');
    norm1.nodes.slice(0, 3).forEach((node, i) => {
        console.log(`     ${node.id}: (${node.nx.toFixed(3)}, ${node.ny.toFixed(3)})`);
    });
   
    console.log('   Граф 2 (нормализованный):');
    norm2.nodes.slice(0, 3).forEach((node, i) => {
        console.log(`     ${node.id}: (${node.nx.toFixed(3)}, ${node.ny.toFixed(3)})`);
    });
   
    // Оценка
    console.log(`\n📊 ИТОГ: Инвариантная схожесть = ${similarity.toFixed(3)}`);
   
    if (similarity > 0.7) {
        console.log('✅ ИНВАРИАНТНОСТЬ РАБОТАЕТ! Система распознает одинаковые формы независимо от масштаба/положения');
    } else if (similarity > 0.4) {
        console.log('⚠️ Частичная инвариантность. Нужно улучшать нормализацию/сравнение');
    } else {
        console.log('❌ ИНВАРИАНТНОСТЬ НЕ РАБОТАЕТ. Проблема в нормализации или сравнении');
    }
   
    // Проверяем вручную: нормализованные координаты должны быть одинаковыми!
    console.log('\n🔍 РУЧНАЯ ПРОВЕРКА:');
    console.log('   Ожидаем: после нормализации одинаковые точки должны иметь одинаковые координаты');
   
    let manualMatches = 0;
    norm1.nodes.forEach(node1 => {
        norm2.nodes.forEach(node2 => {
            const dx = node1.nx - node2.nx;
            const dy = node1.ny - node2.ny;
            if (Math.sqrt(dx * dx + dy * dy) < 0.05) {
                manualMatches++;
                console.log(`   ✅ ${node1.id} ↔ ${node2.id}: (${node1.nx.toFixed(3)},${node1.ny.toFixed(3)}) ≈ (${node2.nx.toFixed(3)},${node2.ny.toFixed(3)})`);
            }
        });
    });
   
    console.log(`\n📊 Ручное сопоставление: ${manualMatches}/${norm1.nodes.length} точек`);
}

// Запускаем
testQuickInvariant().catch(console.error);
