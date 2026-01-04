// test-invariant-system.js
const SimpleGraph = require('./modules/footprint/simple-graph');
const TemplateBuilder = require('./modules/footprint/template-builder');

async function testInvariantSystem() {
    console.log('🧪 ТЕСТ ИНВАРИАНТНОЙ СИСТЕМЫ\n');
   
    // Создаем графы с РАЗНЫМ масштабом и положением
    const graph1 = new SimpleGraph('След 1 (маленький, слева)');
    const graph2 = new SimpleGraph('След 2 (большой, справа)');
   
    // Одинаковая ФОРМА, но разный масштаб и положение
    const shape = [
        {x: 0.0, y: 0.0}, {x: 0.2, y: 0.1}, {x: 0.4, y: -0.1}, {x: 0.6, y: 0.2},
        {x: 0.8, y: 0.0}, {x: 1.0, y: -0.2}, {x: 0.9, y: 0.3}, {x: 0.7, y: -0.3},
        {x: 0.3, y: 0.4}, {x: 0.5, y: -0.4}
    ];
   
    // Граф 1: маленький, слева
    const points1 = shape.map((p, i) => ({
        x: 100 + p.x * 200,   // Масштаб 200, положение 100
        y: 100 + p.y * 200,
        confidence: 0.8,
        id: `p1_${i}`
    }));
   
    // Граф 2: большой, справа (тот же узор, но больше и смещен)
    const points2 = shape.map((p, i) => ({
        x: 500 + p.x * 400,   // Масштаб 400, положение 500
        y: 300 + p.y * 400,
        confidence: 0.8,
        id: `p2_${i}`
    }));
   
    graph1.buildFromPoints(points1);
    graph2.buildFromPoints(points2);
   
    console.log(`📊 Граф 1: ${graph1.nodes.size} узлов, центр: (${getCenter(points1)})`);
    console.log(`📊 Граф 2: ${graph2.nodes.size} узлов, центр: (${getCenter(points2)})`);
    console.log(`📐 Граф 2 в 2 раза больше и смещен относительно графа 1\n`);
   
    // Тестируем матчер на инвариантность
    const SimpleGraphMatcher = require('./modules/footprint/simple-matcher');
    const matcher = new SimpleGraphMatcher({ debug: true });
   
    console.log('🎯 ТЕСТ 1: Сравнение инвариантов (масштаб и положение разные)');
    const result = matcher.compareGraphs(graph1, graph2);
   
    console.log(`📊 Результат: схожесть=${result.similarity.toFixed(3)}, решение=${result.decision}`);
   
    if (result.similarity > 0.7 && result.decision === 'same') {
        console.log('✅ СИСТЕМА ИНВАРИАНТНА! Распознает одинаковые формы независимо от масштаба/положения');
    } else {
        console.log('⚠️ Нужно улучшать инвариантные методы сравнения');
    }
   
    // Тестируем TemplateBuilder с инвариантностью
    console.log('\n🏗️ ТЕСТ 2: TemplateBuilder с инвариантностью');
    const builder = new TemplateBuilder({
        name: 'Инвариантный тест',
        enablePCA: false,
        enableInvariantGrid: true,
        debug: true
    });
   
    builder.setReferenceGraph(graph1, 'graph1_invariant');
    console.log(`✅ Создано ${builder.invariantCells?.size || 0} инвариантных ячеек`);
   
    // Пробуем добавить граф с другим масштабом
    const addResult = builder.addGraph(graph2, 'graph2_invariant');
    console.log(`📊 Результат добавления: ${addResult ? 'УСПЕХ' : 'ОШИБКА'}`);
   
    if (builder.invariantCells) {
        let confirmedCells = 0;
        for (const [cellId, cell] of builder.invariantCells) {
            if (cell.confirmations > 1) confirmedCells++;
        }
       
        console.log(`\n📈 Инвариантные ячейки с подтверждениями: ${confirmedCells}/${builder.invariantCells.size}`);
       
        if (confirmedCells >= builder.invariantCells.size * 0.7) {
            console.log('🎉 ИНВАРИАНТНЫЙ TemplateBuilder РАБОТАЕТ!');
        }
    }
}

function getCenter(points) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return `${(Math.min(...xs) + Math.max(...xs)) / 2}, ${(Math.min(...ys) + Math.max(...ys)) / 2}`;
}

testInvariantSystem().catch(console.error);
