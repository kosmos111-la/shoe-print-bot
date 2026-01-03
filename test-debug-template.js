// test-debug-template.js
const SimpleGraph = require('./modules/footprint/simple-graph');
const TemplateBuilder = require('./modules/footprint/template-builder');

async function testDebugTemplate() {
    console.log('🔍 ТЕСТ С ДЕБАГОМ ШАБЛОНА\n');
   
    // 1. СОЗДАЕМ ПРОСТЫЕ ГРАФЫ
    const graph1 = new SimpleGraph('Простой след 1');
    const graph2 = new SimpleGraph('Простой след 2');
   
    // Всего 10 точек для наглядности
    const points1 = [
        { x: 100, y: 100, confidence: 0.8, id: 'p1_1' },
        { x: 150, y: 120, confidence: 0.7, id: 'p1_2' },
        { x: 200, y: 110, confidence: 0.9, id: 'p1_3' },
        { x: 250, y: 130, confidence: 0.6, id: 'p1_4' },
        { x: 300, y: 100, confidence: 0.8, id: 'p1_5' },
        { x: 350, y: 80, confidence: 0.7, id: 'p1_6' },
        { x: 400, y: 120, confidence: 0.9, id: 'p1_7' },
        { x: 450, y: 110, confidence: 0.6, id: 'p1_8' },
        { x: 500, y: 90, confidence: 0.8, id: 'p1_9' },
        { x: 550, y: 130, confidence: 0.7, id: 'p1_10' }
    ];
   
    // Тот же след, сдвинутый на +15, +10
    const points2 = points1.map((p, i) => ({
        x: p.x + 15,
        y: p.y + 10,
        confidence: p.confidence,
        id: `p2_${i + 1}`
    }));
   
    graph1.buildFromPoints(points1);
    graph2.buildFromPoints(points2);
   
    console.log(`📊 Граф 1: ${graph1.nodes.size} узлов`);
    console.log(`📊 Граф 2: ${graph2.nodes.size} узлов`);
   
    // 2. СОЗДАЕМ TEMPLATE BUILDER С ДЕБАГОМ
    const builder = new TemplateBuilder({
        name: 'Дебаг TemplateBuilder',
        cellSize: 30,
        enablePCA: false,
        debug: true
    });
   
    console.log('\n🎯 ШАГ 1: Устанавливаю эталон');
    builder.setReferenceGraph(graph1, 'graph1_etallon');
   
    console.log('\n🔍 Проверяю центрированные точки эталона:');
    if (builder.referencePoints && builder.referencePoints.length > 0) {
        const center = builder.calculateCenter(builder.referencePoints);
        console.log(`   Центр эталона: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
       
        builder.referencePoints.slice(0, 3).forEach((p, i) => {
            console.log(`   Точка ${i}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
        });
    }
   
    console.log('\n🔍 Проверяю ячейки шаблона:');
    let cellIndex = 0;
    for (const [cellId, cell] of builder.templateCells) {
        if (cellIndex < 3) {
            console.log(`   ${cellId}: (${cell.center.x.toFixed(1)}, ${cell.center.y.toFixed(1)})`);
            cellIndex++;
        }
    }
   
    console.log('\n🔄 ШАГ 2: Добавляю второй граф');
   
    // Сначала проверяем сырые точки второго графа
    const rawPoints = builder.extractPointsFromGraph(graph2);
    console.log(`📊 Сырые точки второго графа:`);
    rawPoints.slice(0, 3).forEach((p, i) => {
        console.log(`   Точка ${i}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
    });
   
    // Тестируем matcher отдельно
    const SimpleGraphMatcher = require('./modules/footprint/simple-matcher');
    const matcher = new SimpleGraphMatcher({ debug: true });
   
    console.log('\n🎯 Тестирую SimpleGraphMatcher:');
    const matchResult = matcher.alignAndCompare(graph1, graph2);
    console.log(`   Найдено совпадающих пар: ${matchResult.matchedPairs?.length || 0}`);
   
    if (matchResult.matchedPairs && matchResult.matchedPairs.length > 0) {
        console.log(`   Примеры совпавших пар:`);
        matchResult.matchedPairs.slice(0, 3).forEach((pair, i) => {
            console.log(`   ${i+1}. ${pair.node1} (${pair.node1Data?.x?.toFixed(1) || '?'},${pair.node1Data?.y?.toFixed(1) || '?'}) ↔ ` +
                      `${pair.node2} (${pair.node2Data?.x?.toFixed(1) || '?'},${pair.node2Data?.y?.toFixed(1) || '?'}) - ${pair.distance?.toFixed(1) || '?'}px`);
        });
    }
   
    // Теперь добавляем граф к шаблону
    console.log('\n📤 Добавляю второй граф к шаблону...');
    const result = builder.addGraph(graph2, 'graph2_debug', { debug: true });
   
    console.log(`\n📊 Результат: ${result ? 'УСПЕХ' : 'ОШИБКА'}`);
   
    // Проверяем статистику
    const builderInfo = builder.getInfo();
    console.log(`\n📈 Статистика:`);
    console.log(`   Ячеек: ${builderInfo.templateCells}`);
    console.log(`   Подтвержденных: ${builderInfo.stats.confirmedCells}`);
    console.log(`   Среднее подтверждений: ${builderInfo.stats.avgConfirmations?.toFixed(2) || '0.00'}`);
   
    // Проверяем конкретные ячейки
    console.log(`\n🔍 Проверяю ячейки после добавления:`);
    cellIndex = 0;
    for (const [cellId, cell] of builder.templateCells) {
        if (cellIndex < 5) {
            console.log(`   ${cellId}: (${cell.center.x.toFixed(1)}, ${cell.center.y.toFixed(1)}) - ` +
                      `${cell.confirmations} подтв., ${cell.confidence?.toFixed(2) || '?'} уверенность`);
            cellIndex++;
        }
    }
   
    // Проверяем количество ячеек с подтверждениями > 1
    let confirmedCells = 0;
    for (const [cellId, cell] of builder.templateCells) {
        if (cell.confirmations > 1) {
            confirmedCells++;
        }
    }
   
    console.log(`\n🎯 ИТОГ: ${confirmedCells}/${builder.templateCells.size} ячеек получили подтверждения`);
   
    if (confirmedCells >= 8) {
        console.log('✅ СИСТЕМА РАБОТАЕТ КОРРЕКТНО!');
    } else {
        console.log('⚠️ ПРОБЛЕМА: большинство ячеек не получили подтверждений');
    }
}

testDebugTemplate().catch(console.error);
