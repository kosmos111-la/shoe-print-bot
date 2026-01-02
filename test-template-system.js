// test-template-system.js
const SimpleGraph = require('./modules/footprint/simple-graph');
const VectorSuperModel = require('./modules/footprint/vector-super-model');
const TemplateVisualizer = require('./modules/footprint/template-visualizer');

async function testTemplateSystem() {
    console.log('🧪 ТЕСТИРУЕМ СИСТЕМУ ШАБЛОНОВ\n');
   
    // 1. СОЗДАЕМ ТЕСТОВЫЕ ГРАФЫ
    console.log('1. Создаю тестовые графы...');
   
    const graph1 = new SimpleGraph('Тестовый граф 1');
    const graph2 = new SimpleGraph('Тестовый граф 2');
    const graph3 = new SimpleGraph('Тестовый граф 3');
   
    // Добавляем точки (имитируем протектор)
    const points1 = [
        { x: 100, y: 200, confidence: 0.8 },
        { x: 150, y: 210, confidence: 0.7 },
        { x: 200, y: 190, confidence: 0.9 },
        { x: 250, y: 220, confidence: 0.6 },
        { x: 300, y: 200, confidence: 0.8 }
    ];
   
    const points2 = [
        { x: 110, y: 195, confidence: 0.9 },
        { x: 160, y: 205, confidence: 0.8 },
        { x: 210, y: 185, confidence: 0.7 },
        { x: 260, y: 215, confidence: 0.9 }
    ];
   
    const points3 = [
        { x: 95, y: 205, confidence: 0.8 },
        { x: 145, y: 215, confidence: 0.6 },
        { x: 195, y: 195, confidence: 0.9 },
        { x: 245, y: 225, confidence: 0.7 },
        { x: 295, y: 205, confidence: 0.8 },
        { x: 345, y: 195, confidence: 0.6 }
    ];
   
    graph1.buildFromPoints(points1);
    graph2.buildFromPoints(points2);
    graph3.buildFromPoints(points3);
   
    console.log(`✅ Графы созданы: ${graph1.nodes.size}, ${graph2.nodes.size}, ${graph3.nodes.size} узлов`);
   
    // 2. СОЗДАЕМ ШАБЛОННУЮ СУПЕР-МОДЕЛЬ
    console.log('\n2. Создаю шаблонную супер-модель...');
   
    const vectorModel = new VectorSuperModel({
        name: 'Тестовый шаблон протектора',
        minPointsForReference: 3
    });
   
    // 3. ДОБАВЛЯЕМ ГРАФЫ В ШАБЛОН
    console.log('\n3. Добавляю графы в шаблон...');
   
    vectorModel.addGraph(graph1, 'graph1', { test: true, iteration: 1 });
    console.log(`   ✅ Граф 1 добавлен как эталон`);
   
    vectorModel.addGraph(graph2, 'graph2', { test: true, iteration: 2 });
    console.log(`   ✅ Граф 2 добавлен к шаблону`);
   
    vectorModel.addGraph(graph3, 'graph3', { test: true, iteration: 3 });
    console.log(`   ✅ Граф 3 добавлен к шаблону`);
   
    // 4. ПОЛУЧАЕМ СТАТИСТИКУ
    console.log('\n4. Статистика шаблона:');
   
    const templateStats = vectorModel.getTemplateStats();
    console.log(`   Ячеек шаблона: ${templateStats?.cells?.total || 0}`);
    console.log(`   Подтвержденных ячеек: ${templateStats?.cells?.confirmed || 0}`);
    console.log(`   Среднее подтверждений: ${templateStats?.cells?.avgConfirmations || '0.00'}`);
   
    // 5. ВИЗУАЛИЗИРУЕМ
    console.log('\n5. Визуализирую шаблон...');
   
    const visualizer = new TemplateVisualizer({
        outputDir: './test_output',
        debug: true
    });
   
    const templateData = vectorModel.getVisualizationData();
    const result = await visualizer.visualizeTemplate(templateData, {
        filename: 'test_template.png'
    });
   
    console.log(`✅ Шаблон визуализирован: ${result.path}`);
   
    // 6. СОХРАНЯЕМ И ЗАГРУЖАЕМ
    console.log('\n6. Тестирую сохранение/загрузку...');
   
    const jsonData = vectorModel.toJSON();
    console.log(`   Данные сохранены (${Object.keys(jsonData).length} полей)`);
   
    const loadedModel = VectorSuperModel.fromJSON(jsonData);
    console.log(`   Модель загружена: ${loadedModel.name}`);
   
    console.log('\n🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО УСПЕШНО!');
    console.log(`📁 Проверьте файл: ${result.path}`);
}

// Запускаем тест
testTemplateSystem().catch(console.error);
