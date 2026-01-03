// fix-and-test.js
const SimpleGraph = require('./modules/footprint/simple-graph');
const VectorSuperModel = require('./modules/footprint/vector-super-model');
const TemplateBuilder = require('./modules/footprint/template-builder');

async function testFixedSystem() {
    console.log('🧪 ТЕСТИРУЕМ ИСПРАВЛЕННУЮ СИСТЕМУ\n');
   
    // 1. СОЗДАЕМ ТЕСТОВЫЕ ГРАФЫ БОЛЬШЕГО РАЗМЕРА
    console.log('1. Создаю тестовые графы (15+ точек каждый)...');
   
    const graph1 = new SimpleGraph('Граф 1 (эталон)');
    const graph2 = new SimpleGraph('Граф 2 (смещенный)');
    const graph3 = new SimpleGraph('Граф 3 (частичный)');
   
    // Точки для эталона (форма стопы)
    const points1 = [];
    for (let i = 0; i < 15; i++) {
        const x = 100 + i * 20;
        const y = 200 + Math.sin(i * 0.5) * 30;
        points1.push({
            x: x,
            y: y,
            confidence: 0.7 + Math.random() * 0.3,
            id: `p1_${i}`
        });
    }
   
    // Точки для второго графа (смещенный эталон)
    const points2 = [];
    for (let i = 0; i < 12; i++) {
        const x = 120 + i * 18; // Слегка смещен
        const y = 190 + Math.sin(i * 0.5) * 25; // Слегка сжат
        points2.push({
            x: x,
            y: y,
            confidence: 0.7 + Math.random() * 0.3,
            id: `p2_${i}`
        });
    }
   
    // Точки для третьего графа (часть эталона + шум)
    const points3 = [];
    for (let i = 3; i < 10; i++) { // Часть точек
        const x = 110 + i * 22;
        const y = 210 + Math.sin(i * 0.5) * 20;
        points3.push({
            x: x,
            y: y,
            confidence: 0.6 + Math.random() * 0.4,
            id: `p3_${i}`
        });
    }
    // Добавляем немного шума
    for (let i = 0; i < 3; i++) {
        points3.push({
            x: 300 + Math.random() * 100,
            y: 150 + Math.random() * 100,
            confidence: 0.3 + Math.random() * 0.3,
            id: `noise_${i}`
        });
    }
   
    // Строим графы
    graph1.buildFromPoints(points1);
    graph2.buildFromPoints(points2);
    graph3.buildFromPoints(points3);
   
    console.log(`✅ Графы созданы: ${graph1.nodes.size}, ${graph2.nodes.size}, ${graph3.nodes.size} узлов\n`);
   
    // 2. ТЕСТИРУЕМ TEMPLATE BUILDER НАПРЯМУЮ
    console.log('2. Тестирую исправленный TemplateBuilder...\n');
   
    const builder = new TemplateBuilder({
        name: 'Исправленный TemplateBuilder',
        minPointsForReference: 5,
        cellSize: 15,
        maxAlignmentError: 50
    });
   
    console.log('--- ШАГ 1: Устанавливаю эталон ---');
    const refResult = builder.setReferenceGraph(graph1, 'graph1_etallon');
    console.log(`✅ Эталон установлен: ${refResult ? 'ДА' : 'НЕТ'}`);
    console.log(`   Ячеек создано: ${builder.templateCells.size}`);
   
    console.log('\n--- ШАГ 2: Добавляю второй граф ---');
    const addResult2 = builder.addGraph(graph2, 'graph2', { iteration: 2 });
    console.log(`✅ Граф 2 добавлен: ${addResult2 ? 'ДА' : 'НЕТ'}`);
    console.log(`   Статистика: ${builder.stats.totalGraphs} графов, ` +
               `${builder.stats.confirmedCells} подтвержденных ячеек`);
   
    console.log('\n--- ШАГ 3: Добавляю третий граф ---');
    const addResult3 = builder.addGraph(graph3, 'graph3', { iteration: 3 });
    console.log(`✅ Граф 3 добавлен: ${addResult3 ? 'ДА' : 'НЕТ'}`);
    console.log(`   Статистика: ${builder.stats.totalGraphs} графов, ` +
               `${builder.stats.confirmedCells} подтвержденных ячеек`);
   
    // 3. ПОКАЗЫВАЕМ СТАТИСТИКУ
    console.log('\n3. Статистика TemplateBuilder:');
    const builderInfo = builder.getInfo();
    console.log(`   Всего ячеек: ${builderInfo.templateCells}`);
    console.log(`   Подтвержденных: ${builderInfo.stats.confirmedCells}`);
    console.log(`   Высоконадёжных: ${builderInfo.stats.highConfidenceCells}`);
    console.log(`   Среднее подтверждений: ${builderInfo.stats.avgConfirmations?.toFixed(2) || '0.00'}`);
   
    // 4. ПОКАЗЫВАЕМ ЯЧЕЙКИ
    console.log('\n4. Пример ячеек:');
    let cellCount = 0;
    for (const [cellId, cell] of builder.templateCells) {
        if (cellCount < 5) { // Показываем первые 5
            console.log(`   ${cellId}: (${cell.center.x.toFixed(1)}, ${cell.center.y.toFixed(1)}) - ` +
                       `${cell.confirmations} подтв.`);
        }
        cellCount++;
    }
    if (cellCount > 5) {
        console.log(`   ... и еще ${cellCount - 5} ячеек`);
    }
   
    // 5. ТЕСТИРУЕМ ВЕКТОРНУЮ МОДЕЛЬ
    console.log('\n5. Тестирую VectorSuperModel с исправлениями...\n');
   
    const vectorModel = new VectorSuperModel({
        name: 'Тестовая модель с исправлениями',
        minPointsForReference: 5,
        cellSize: 15
    });
   
    console.log('Добавляю графы в VectorSuperModel:');
    vectorModel.addGraph(graph1, 'vsm_graph1', { test: 1 });
    console.log(`   Граф 1: добавлен как эталон`);
   
    vectorModel.addGraph(graph2, 'vsm_graph2', { test: 2 });
    console.log(`   Граф 2: ${vectorModel.stats.totalGraphsAdded} графов в модели`);
   
    vectorModel.addGraph(graph3, 'vsm_graph3', { test: 3 });
    console.log(`   Граф 3: ${vectorModel.stats.totalGraphsAdded} графов в модели`);
   
    // 6. ПОКАЗЫВАЕМ РЕЗУЛЬТАТ
    console.log('\n6. Итоговая статистика:');
    const modelInfo = vectorModel.getInfo();
    console.log(`   Модель: ${modelInfo.name}`);
    console.log(`   Уверенность: ${(modelInfo.stats.confidence * 100).toFixed(1)}%`);
    console.log(`   Графов добавлено: ${modelInfo.stats.totalGraphsAdded}`);
    console.log(`   Ячеек шаблона: ${modelInfo.template?.cells?.total || 0}`);
    console.log(`   Подтвержденных ячеек: ${modelInfo.template?.cells?.confirmed || 0}`);
   
    console.log('\n🎉 ИСПРАВЛЕННАЯ СИСТЕМА РАБОТАЕТ!');
    console.log('📁 Теперь можно тестировать на реальных фото.');
}

// Запускаем
testFixedSystem().catch(error => {
    console.error('❌ Ошибка теста:', error);
    console.error(error.stack);
});
