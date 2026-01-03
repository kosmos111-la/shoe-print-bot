// test-existing-system-fixed.js
const SimpleGraph = require('./modules/footprint/simple-graph');
const TemplateBuilder = require('./modules/footprint/template-builder');
const VectorSuperModel = require('./modules/footprint/vector-super-model');

async function testExistingSystemFixed() {
    console.log('🧪 ТЕСТИРУЕМ ИСПРАВЛЕННУЮ СУЩЕСТВУЮЩУЮ СИСТЕМУ\n');
   
    // 1. СОЗДАЕМ ГРАФЫ (как в реальном тесте)
    const graph1 = new SimpleGraph('Реальный след 1');
    const graph2 = new SimpleGraph('Реальный след 2');
   
    // 55 точек, как в реальном тесте
    const points1 = [];
    for (let i = 0; i < 55; i++) {
        const x = 100 + (i % 11) * 40;
        const y = 200 + Math.floor(i / 11) * 35 + Math.sin(i * 0.3) * 15;
        points1.push({
            x: x,
            y: y,
            confidence: 0.7 + Math.random() * 0.3,
            id: `p1_${i}`
        });
    }
   
    const points2 = points1.map((p, i) => ({
        x: p.x + 10 + Math.random() * 5,
        y: p.y + 5 + Math.random() * 5,
        confidence: p.confidence,
        id: `p2_${i}`
    }));
   
    graph1.buildFromPoints(points1);
    graph2.buildFromPoints(points2);
   
    console.log(`✅ Графы созданы: ${graph1.nodes.size}, ${graph2.nodes.size} узлов\n`);
   
    // 2. ТЕСТИРУЕМ TEMPLATE BUILDER С ИСПРАВЛЕНИЯМИ
    console.log('2. Тестирую исправленный TemplateBuilder...\n');
   
    const builder = new TemplateBuilder({
        name: 'Исправленный TemplateBuilder',
        minPointsForReference: 3,
        cellSize: 25,
        maxAlignmentError: 100,
        enablePCA: false, // 🔥 ОТКЛЮЧАЕМ PCA
        debug: true
    });
   
    console.log('--- ШАГ 1: Устанавливаю эталон ---');
    const refResult = builder.setReferenceGraph(graph1, 'graph1_etallon');
    console.log(`✅ Эталон установлен: ${refResult ? 'ДА' : 'НЕТ'}`);
    console.log(`   Ячеек создано: ${builder.templateCells.size}`);
   
    console.log('\n--- ШАГ 2: Добавляю второй граф ---');
    const addResult2 = builder.addGraph(graph2, 'graph2', { iteration: 2 });
    console.log(`✅ Граф 2 добавлен: ${addResult2 ? 'ДА' : 'НЕТ'}`);
   
    const builderInfo = builder.getInfo();
    console.log(`\n📊 Статистика TemplateBuilder:`);
    console.log(`   Всего ячеек: ${builderInfo.templateCells}`);
    console.log(`   Подтвержденных: ${builderInfo.stats.confirmedCells}`);
    console.log(`   Среднее подтверждений: ${builderInfo.stats.avgConfirmations?.toFixed(2) || '0.00'}`);
   
    // 3. ТЕСТИРУЕМ VECTOR SUPER MODEL С ИСПРАВЛЕНИЯМИ
    console.log('\n3. Тестирую исправленную VectorSuperModel...\n');
   
    const vectorModel = new VectorSuperModel({
        name: 'Тестовая модель с исправлениями',
        minPointsForReference: 3,
        cellSize: 25,
        enablePCA: false // 🔥 ОТКЛЮЧАЕМ PCA
    });
   
    console.log('Добавляю графы в VectorSuperModel:');
   
    const result1 = vectorModel.addGraph(graph1, 'vsm_graph1', { test: 1 });
    console.log(`   Граф 1: ${result1 ? 'добавлен как эталон' : 'ошибка'}`);
   
    const result2 = vectorModel.addGraph(graph2, 'vsm_graph2', { test: 2 });
    console.log(`   Граф 2: ${result2 ? 'добавлен к шаблону' : 'ошибка'}`);
   
    // 4. ПОКАЗЫВАЕМ РЕЗУЛЬТАТ
    console.log('\n4. Итоговая статистика:');
    const modelInfo = vectorModel.getInfo();
   
    console.log(`   Модель: ${modelInfo.name}`);
    console.log(`   Уверенность: ${(modelInfo.stats.confidence * 100).toFixed(1)}%`);
    console.log(`   Графов добавлено: ${modelInfo.stats.totalGraphsAdded}`);
   
    if (modelInfo.template) {
        console.log(`   Ячеек шаблона: ${modelInfo.template.cells.total}`);
        console.log(`   Подтвержденных ячеек: ${modelInfo.template.cells.confirmed}`);
       
        const successRate = (modelInfo.template.cells.confirmed / modelInfo.template.cells.total) * 100;
        console.log(`   📊 УСПЕШНОСТЬ: ${successRate.toFixed(1)}%`);
       
        // ЦЕЛЕВОЙ ПОКАЗАТЕЛЬ:
        if (successRate > 80) {
            console.log('\n🎉 СИСТЕМА РАБОТАЕТ КОРРЕКТНО!');
            console.log('✅ PCA отключен');
            console.log('✅ Используется простой матчер');
            console.log('✅ Простая сетка вместо DBSCAN');
        } else {
            console.log('\n⚠️ Нужны дополнительные исправления');
        }
    }
}

// Запускаем
testExistingSystemFixed().catch(error => {
    console.error('❌ Ошибка теста:', error);
    console.error(error.stack);
});
