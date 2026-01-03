// test-fixed-system.js
const SimpleGraph = require('./modules/footprint/simple-graph');
const VectorSuperModelFixed = require('./modules/footprint/vector-super-model-fixed');

async function testFixedSystem() {
    console.log('🧪 ТЕСТИРУЕМ ИСПРАВЛЕННУЮ СИСТЕМУ\n');
   
    // 1. СОЗДАЕМ РЕАЛЬНЫЕ СЛЕДЫ (55 точек)
    console.log('1. Создаю реалистичные следы (55 точек)...');
   
    const graph1 = new SimpleGraph('След 1 (эталон)');
    const graph2 = new SimpleGraph('След 2 (тот же, с небольшим смещением)');
   
    // Точки для эталона (форма стопы)
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
   
    // Тот же след, с небольшим смещением (+10px)
    const points2 = [];
    for (let i = 0; i < 55; i++) {
        const x = points1[i].x + 10 + Math.random() * 5;
        const y = points1[i].y + 5 + Math.random() * 5;
        points2.push({
            x: x,
            y: y,
            confidence: 0.7 + Math.random() * 0.3,
            id: `p2_${i}`
        });
    }
   
    // Строим графы
    graph1.buildFromPoints(points1);
    graph2.buildFromPoints(points2);
   
    console.log(`✅ Графы созданы: ${graph1.nodes.size}, ${graph2.nodes.size} узлов\n`);
   
    // 2. СОЗДАЕМ ИСПРАВЛЕННУЮ МОДЕЛЬ
    console.log('2. Создаю исправленную супер-модель...\n');
   
    const vectorModel = new VectorSuperModelFixed({
        name: 'Исправленная тестовая модель',
        cellSize: 25, // Размер ячейки
        debug: true
    });
   
    console.log('--- ШАГ 1: Добавляю эталонный след ---');
    const result1 = vectorModel.addGraph(graph1, 'graph1_etallon');
    console.log(`✅ Эталон добавлен: ${result1 ? 'ДА' : 'НЕТ'}`);
   
    console.log('\n--- ШАГ 2: Добавляю тот же след (с небольшим смещением) ---');
    const result2 = vectorModel.addGraph(graph2, 'graph2');
    console.log(`✅ Второй след добавлен: ${result2 ? 'ДА' : 'НЕТ'}`);
   
    // 3. ПОКАЗЫВАЕМ СТАТИСТИКУ
    console.log('\n3. Статистика исправленной модели:');
    const modelInfo = vectorModel.getInfo();
   
    console.log(`   Модель: ${modelInfo.name}`);
    console.log(`   Уверенность: ${(modelInfo.stats.confidence * 100).toFixed(1)}%`);
    console.log(`   Графов добавлено: ${modelInfo.stats.totalMerges}`);
   
    if (modelInfo.template) {
        console.log(`   Ячеек шаблона: ${modelInfo.template.cells.total}`);
        console.log(`   Подтвержденных ячеек: ${modelInfo.template.cells.confirmed}`);
        console.log(`   Высоконадёжных: ${modelInfo.template.cells.highConfidence}`);
        console.log(`   Среднее подтверждений: ${modelInfo.template.cells.avgConfirmations}`);
       
        // Ожидаем: подтвержденных ячеек должно быть много!
        const successRate = modelInfo.template.cells.confirmed / modelInfo.template.cells.total;
        console.log(`   📊 УСПЕХ: ${(successRate * 100).toFixed(1)}% ячеек подтверждены`);
    }
   
    // 4. ПОКАЗЫВАЕМ ЯЧЕЙКИ
    console.log('\n4. Пример ячеек шаблона:');
    const templateData = vectorModel.getVisualizationData();
   
    if (templateData.cells && templateData.cells.length > 0) {
        // Сортируем по количеству подтверждений
        const sortedCells = [...templateData.cells].sort((a, b) => b.confirmations - a.confirmations);
       
        console.log(`   Всего ячеек: ${sortedCells.length}`);
       
        // Показываем ячейки с подтверждениями
        const confirmedCells = sortedCells.filter(c => c.confirmations > 1);
        console.log(`   Подтвержденных ячеек (2+ фото): ${confirmedCells.length}`);
       
        // Показываем топ-5 ячеек
        console.log(`   Топ-5 ячеек по подтверждениям:`);
        confirmedCells.slice(0, 5).forEach((cell, index) => {
            console.log(`   ${index + 1}. ${cell.id}: (${cell.x.toFixed(1)}, ${cell.y.toFixed(1)}) - ` +
                      `${cell.confirmations} подтв., уверенность: ${(cell.confidence * 100).toFixed(1)}%`);
        });
       
        if (confirmedCells.length > 5) {
            console.log(`   ... и еще ${confirmedCells.length - 5} ячеек`);
        }
       
        // Показываем ячейки без подтверждений
        const unconfirmedCells = sortedCells.filter(c => c.confirmations === 1);
        console.log(`   Ячеек только с эталоном: ${unconfirmedCells.length}`);
    }
   
    console.log('\n🎉 ИСПРАВЛЕННАЯ СИСТЕМА ГОТОВА!');
    console.log('📁 Теперь можно тестировать на реальных фото с 55 точками.');
}

// Запускаем
testFixedSystem().catch(error => {
    console.error('❌ Ошибка теста:', error);
    console.error(error.stack);
});
