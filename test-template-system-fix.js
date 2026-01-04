// test-template-system-fix.js
const SimpleGraph = require('./modules/footprint/simple-graph');
const TemplateBuilder = require('./modules/footprint/template-builder');
const VectorSuperModel = require('./modules/footprint/vector-super-model');

async function testTemplateSystemFix() {
    console.log('🔧 ТЕСТ ШАБЛОННОЙ СИСТЕМЫ С ИСПРАВЛЕНИЯМИ\n');
   
    // 1. Создаем тестовые графы
    const graph1 = new SimpleGraph('Тест 1');
    const graph2 = new SimpleGraph('Тест 2');
   
    // Создаем одинаковые следы (55 точек как в реальном тесте)
    const points1 = createRealisticShoePoints(55, 100, 100);
    const points2 = createRealisticShoePoints(55, 100, 100); // Те же координаты
   
    graph1.buildFromPoints(points1);
    graph2.buildFromPoints(points2);
   
    console.log(`📊 Создано 2 графа по ${points1.length} точек`);
   
    // 2. Создаем TemplateBuilder
    const templateBuilder = new TemplateBuilder({
        name: 'Тестовый шаблон',
        enablePCA: false,
        cellSize: 25,
        debug: true
    });
   
    // 3. Устанавливаем эталонный граф
    const setResult = templateBuilder.setReferenceGraph(graph1, 'graph1');
    console.log(`🎯 Эталон установлен: ${setResult ? 'УСПЕХ' : 'ОШИБКА'}`);
   
    // 4. Добавляем второй граф (должен совпасть)
    const addResult = templateBuilder.addGraph(graph2, 'graph2', {
        test: 'identical_graph'
    });
   
    console.log(`🔄 Второй граф добавлен: ${addResult ? 'УСПЕХ' : 'ОШИБКА'}`);
   
    // 5. Проверяем статистику
    const info = templateBuilder.getInfo();
    console.log(`\n📊 СТАТИСТИКА ШАБЛОНА:`);
    console.log(`   Ячеек: ${info.templateCells}`);
    console.log(`   Подтвержденных: ${info.stats.confirmedCells}`);
    console.log(`   Среднее подтверждений: ${info.stats.avgConfirmations?.toFixed(2) || 0}`);
   
    // 6. Тест VectorSuperModel
    console.log(`\n🏗️ ТЕСТ VECTOR SUPER MODEL:`);
    const vectorModel = new VectorSuperModel({
        name: 'Тестовая модель',
        enablePCA: false,
        cellSize: 25
    });
   
    const add1 = vectorModel.addGraph(graph1, 'graph1');
    const add2 = vectorModel.addGraph(graph2, 'graph2');
   
    console.log(`   Граф 1 добавлен: ${add1}`);
    console.log(`   Граф 2 добавлен: ${add2}`);
   
    const modelInfo = vectorModel.getInfo();
    console.log(`   Уверенность модели: ${(modelInfo.stats.confidence * 100).toFixed(1)}%`);
    console.log(`   Ячеек шаблона: ${modelInfo.template?.cells?.total || 0}`);
   
    // 7. КРИТИЧЕСКАЯ ПРОВЕРКА: одинаковые фото → 50+/55 точек
    const templateData = templateBuilder.getVisualizationData();
    const confirmedCells = templateData.cells.filter(cell => cell.confirmations > 0).length;
   
    console.log(`\n🎯 КРИТИЧЕСКИЙ ТЕСТ: одинаковые фото`);
    console.log(`   Всего ячеек: ${templateData.cells.length}`);
    console.log(`   Подтвержденных ячеек: ${confirmedCells}`);
    console.log(`   Соотношение: ${((confirmedCells / templateData.cells.length) * 100).toFixed(1)}%`);
   
    const target = 50; // Цель: 50+ из 55
    if (confirmedCells >= target) {
        console.log(`   ✅ ТЕСТ ПРОЙДЕН: ${confirmedCells}/${templateData.cells.length} ячеек подтверждено`);
    } else {
        console.log(`   ❌ ТЕСТ НЕ ПРОЙДЕН: только ${confirmedCells}/${templateData.cells.length} ячеек`);
        console.log(`   🔧 Требуется: ${target}+ ячеек`);
    }
   
    return {
        success: confirmedCells >= target,
        confirmedCells,
        totalCells: templateData.cells.length,
        ratio: confirmedCells / templateData.cells.length
    };
}

// Вспомогательная функция
function createRealisticShoePoints(count, offsetX, offsetY) {
    const points = [];
   
    for (let i = 0; i < count; i++) {
        // Реалистичное распределение точек протектора
        const angle = (i / count) * Math.PI * 2;
        const radius = 50 + Math.sin(angle * 3) * 20;
       
        points.push({
            x: offsetX + Math.cos(angle) * radius,
            y: offsetY + Math.sin(angle) * radius * 0.6, // Сжатие по Y для формы стопы
            confidence: 0.8 + Math.random() * 0.2,
            id: `point_${i}`
        });
    }
   
    return points;
}

// Запуск теста
testTemplateSystemFix().then(result => {
    console.log('\n' + '='.repeat(60));
    console.log(`📊 ИТОГОВЫЙ РЕЗУЛЬТАТ:`);
    console.log(`   Успех: ${result.success ? '✅' : '❌'}`);
    console.log(`   Подтверждено: ${result.confirmedCells}/${result.totalCells} ячеек`);
    console.log(`   Соотношение: ${(result.ratio * 100).toFixed(1)}%`);
   
    if (result.success) {
        console.log('\n🎉 ШАБЛОННАЯ СИСТЕМА РАБОТАЕТ КОРРЕКТНО!');
        console.log('   Одинаковые фото правильно сопоставляются!');
    } else {
        console.log('\n🔧 ТРЕБУЮТСЯ ДОПОЛНИТЕЛЬНЫЕ ИСПРАВЛЕНИЯ');
        console.log('   Нужно улучшить сопоставление в template-builder.js');
    }
}).catch(console.error);
