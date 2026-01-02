// test-template-system.js
const SimpleGraph = require('./modules/footprint/simple-graph');
const VectorSuperModel = require('./modules/footprint/vector-super-model');
const TemplateVisualizer = require('./modules/footprint/template-visualizer');

async function testTemplateSystem() {
    console.log('🧪 ТЕСТИРУЕМ СИСТЕМУ ШАБЛОНОВ (упрощенная версия)\n');
   
    // 1. СОЗДАЕМ ТЕСТОВЫЕ ГРАФЫ
    console.log('1. Создаю тестовые графы...');
   
    const graph1 = new SimpleGraph('Тестовый граф 1');
    const graph2 = new SimpleGraph('Тестовый граф 2');
    const graph3 = new SimpleGraph('Тестовый граф 3');
   
    // Добавляем точки в виде "протектора" (форма стопы)
    const points1 = [
        { x: 100, y: 200, confidence: 0.8, id: 'p1' },
        { x: 150, y: 210, confidence: 0.7, id: 'p2' },
        { x: 200, y: 190, confidence: 0.9, id: 'p3' },
        { x: 250, y: 220, confidence: 0.6, id: 'p4' },
        { x: 300, y: 200, confidence: 0.8, id: 'p5' },
        { x: 350, y: 180, confidence: 0.7, id: 'p6' },
        { x: 400, y: 220, confidence: 0.9, id: 'p7' }
    ];
   
    const points2 = [
        { x: 110, y: 195, confidence: 0.9, id: 'p1' },
        { x: 160, y: 205, confidence: 0.8, id: 'p2' },
        { x: 210, y: 185, confidence: 0.7, id: 'p3' },
        { x: 260, y: 215, confidence: 0.9, id: 'p4' },
        { x: 310, y: 195, confidence: 0.8, id: 'p5' },
        { x: 360, y: 175, confidence: 0.7, id: 'p6' }
    ];
   
    const points3 = [
        { x: 95, y: 205, confidence: 0.8, id: 'p1' },
        { x: 145, y: 215, confidence: 0.6, id: 'p2' },
        { x: 195, y: 195, confidence: 0.9, id: 'p3' },
        { x: 245, y: 225, confidence: 0.7, id: 'p4' },
        { x: 295, y: 205, confidence: 0.8, id: 'p5' },
        { x: 345, y: 195, confidence: 0.6, id: 'p6' },
        { x: 395, y: 215, confidence: 0.7, id: 'p7' },
        { x: 445, y: 185, confidence: 0.8, id: 'p8' }
    ];
   
    graph1.buildFromPoints(points1);
    graph2.buildFromPoints(points2);
    graph3.buildFromPoints(points3);
   
    console.log(`✅ Графы созданы: ${graph1.nodes.size}, ${graph2.nodes.size}, ${graph3.nodes.size} узлов`);
   
    // 2. СОЗДАЕМ ШАБЛОННУЮ СУПЕР-МОДЕЛЬ
    console.log('\n2. Создаю шаблонную супер-модель...');
   
    const vectorModel = new VectorSuperModel({
        name: 'Тестовый шаблон протектора',
        minPointsForReference: 3,
        cellSize: 30 // Размер ячейки
    });
   
    // 3. ДОБАВЛЯЕМ ГРАФЫ В ШАБЛОН
    console.log('\n3. Добавляю графы в шаблон...');
   
    console.log('\n   --- ГРАФ 1 (становится эталоном) ---');
    const result1 = vectorModel.addGraph(graph1, 'graph1', { test: true, iteration: 1 });
    console.log(`   ✅ Результат: ${result1 ? 'УСПЕХ' : 'ОШИБКА'}`);
   
    console.log('\n   --- ГРАФ 2 (добавляется к шаблону) ---');
    const result2 = vectorModel.addGraph(graph2, 'graph2', { test: true, iteration: 2 });
    console.log(`   ✅ Результат: ${result2 ? 'УСПЕХ' : 'ОШИБКА'}`);
   
    console.log('\n   --- ГРАФ 3 (добавляется к шаблону) ---');
    const result3 = vectorModel.addGraph(graph3, 'graph3', { test: true, iteration: 3 });
    console.log(`   ✅ Результат: ${result3 ? 'УСПЕХ' : 'ОШИБКА'}`);
   
    // 4. ПОЛУЧАЕМ ИНФОРМАЦИЮ
    console.log('\n4. Информация о шаблонной модели:');
   
    const modelInfo = vectorModel.getInfo();
    console.log(`   ID модели: ${modelInfo.id}`);
    console.log(`   Имя: ${modelInfo.name}`);
    console.log(`   Уверенность: ${(modelInfo.stats.confidence * 100).toFixed(1)}%`);
    console.log(`   Слияний: ${modelInfo.stats.totalMerges}`);
   
    // 5. ПОЛУЧАЕМ СТАТИСТИКУ ШАБЛОНА
    console.log('\n5. Статистика шаблона:');
   
    const templateStats = vectorModel.getTemplateStats();
    if (templateStats) {
        console.log(`   Ячеек шаблона: ${templateStats.cells?.total || 0}`);
        console.log(`   Подтвержденных ячеек: ${templateStats.cells?.confirmed || 0}`);
        console.log(`   Высоконадёжных ячеек: ${templateStats.cells?.highConfidence || 0}`);
        console.log(`   Среднее подтверждений: ${templateStats.cells?.avgConfirmations || '0.00'}`);
        console.log(`   Эталонный граф: ${templateStats.referenceGraphId || 'нет'}`);
       
        // Зоны
        if (templateStats.zones) {
            console.log(`   Зоны протектора:`);
            if (templateStats.zones.heel) {
                console.log(`     Пятка: ${templateStats.zones.heel.cells} ячеек, ${templateStats.zones.heel.confirmations} подтв.`);
            }
            if (templateStats.zones.midfoot) {
                console.log(`     Центр: ${templateStats.zones.midfoot.cells} ячеек, ${templateStats.zones.midfoot.confirmations} подтв.`);
            }
            if (templateStats.zones.forefoot) {
                console.log(`     Носок: ${templateStats.zones.forefoot.cells} ячеек, ${templateStats.zones.forefoot.confirmations} подтв.`);
            }
        }
    } else {
        console.log(`   ❌ Статистика шаблона недоступна`);
    }
   
    // 6. ПОЛУЧАЕМ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
    console.log('\n6. Получаю данные для визуализации...');
   
    const templateData = vectorModel.getVisualizationData();
    console.log(`   ✅ Получено данных: ${templateData.cells?.length || 0} ячеек`);
   
    if (templateData.cells && templateData.cells.length > 0) {
        console.log(`   Пример ячеек:`);
        templateData.cells.slice(0, 3).forEach((cell, i) => {
            console.log(`   ${i+1}. ${cell.id}: (${cell.x.toFixed(1)}, ${cell.y.toFixed(1)}), ` +
                       `${cell.confirmations} подтв., доверие: ${(cell.confidence * 100).toFixed(1)}%`);
        });
       
        if (templateData.cells.length > 3) {
            console.log(`   ... и еще ${templateData.cells.length - 3} ячеек`);
        }
    }
   
    // 7. ВИЗУАЛИЗИРУЕМ
    console.log('\n7. Визуализирую шаблон...');
   
    try {
        const visualizer = new TemplateVisualizer({
            outputDir: './test_output',
            debug: true
        });
       
        const result = await visualizer.visualizeTemplate(templateData, {
            filename: 'test_template.txt'
        });
       
        console.log(`✅ Шаблон визуализирован: ${result.path}`);
       
        // Сохраняем данные шаблона в JSON
        const jsonPath = await visualizer.saveTemplateData(templateData, {
            filename: 'test_template_data.json'
        });
        console.log(`💾 Данные шаблона сохранены: ${jsonPath}`);
       
    } catch (error) {
        console.log(`❌ Ошибка визуализации: ${error.message}`);
        console.error(error.stack);
    }
   
    // 8. ТЕСТИРУЕМ СОХРАНЕНИЕ/ЗАГРУЗКУ
    console.log('\n8. Тестирую сохранение/загрузку...');
   
    try {
        // Сохраняем модель в JSON
        const jsonData = vectorModel.toJSON();
        console.log(`   Данные сохранены (${Object.keys(jsonData).length} полей)`);
       
        // Загружаем модель обратно
        const loadedModel = VectorSuperModel.fromJSON(jsonData);
        console.log(`   Модель загружена: ${loadedModel.name}`);
       
        // Проверяем что данные сохранились
        const loadedInfo = loadedModel.getInfo();
        console.log(`   Проверка: ${loadedInfo.template?.cells?.total || 0} ячеек загружено`);
       
    } catch (error) {
        console.log(`❌ Ошибка сохранения/загрузки: ${error.message}`);
        console.error(error.stack);
    }
   
    // 9. ТЕСТИРУЕМ TEMPLATE BUILDER НАПРЯМУЮ
    console.log('\n9. Тестирую TemplateBuilder напрямую...');
   
    try {
        const TemplateBuilder = require('./modules/footprint/template-builder');
        const builder = new TemplateBuilder({
            name: 'Прямой тест TemplateBuilder',
            cellSize: 25
        });
       
        // Добавляем графы
        builder.setReferenceGraph(graph1, 'ref_graph1');
        console.log(`   ✅ Эталон установлен: ${builder.templateCells.size} ячеек`);
       
        builder.addGraph(graph2, 'graph2');
        console.log(`   ✅ Граф 2 добавлен: ${builder.stats.totalGraphs} графов в шаблоне`);
       
        builder.addGraph(graph3, 'graph3');
        console.log(`   ✅ Граф 3 добавлен: ${builder.stats.totalGraphs} графов в шаблоне`);
       
        // Получаем статистику
        const builderInfo = builder.getInfo();
        console.log(`   📊 Статистика builder: ${builderInfo.templateCells} ячеек, ` +
                   `${builderInfo.stats.confirmedCells} подтвержденных`);
       
    } catch (error) {
        console.log(`❌ Ошибка TemplateBuilder: ${error.message}`);
        console.error(error.stack);
    }
   
    console.log('\n🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!');
    console.log(`📁 Проверьте файлы в папке ./test_output/`);
}

// Запускаем тест
testTemplateSystem().catch(console.error);
