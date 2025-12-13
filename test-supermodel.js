const MergeVisualizer = require('./modules/footprint/merge-visualizer');
const SimpleFootprint = require('./modules/footprint/simple-footprint');
const fs = require('fs');
const path = require('path');

async function testSuperModelVisualization() {
    console.log('🧪 Тест визуализации супер-модели...');
   
    // Создаем визуализатор
    const visualizer = new MergeVisualizer({
        outputDir: './test_output',
        debug: true
    });
   
    // Создаем тестовую супер-модель
    const superModel = new SimpleFootprint({
        name: 'Тестовая супер-модель',
        userId: 'test_user'
    });
   
    // Добавляем тестовые узлы
    const SimpleGraph = require('./simple-graph');
    const graph = new SimpleGraph('Тестовый граф');
   
    // Добавляем узлы с разным количеством подтверждений
    graph.addNode({ id: 'n1', x: 100, y: 100, confidence: 0.9, sources: [{photo: 1}, {photo: 2}] });
    graph.addNode({ id: 'n2', x: 200, y: 150, confidence: 0.8, sources: [{photo: 1}] });
    graph.addNode({ id: 'n3', x: 150, y: 200, confidence: 0.5 }); // Без подтверждений
    graph.addNode({ id: 'n4', x: 250, y: 100, confidence: 0.7, sources: [{photo: 1}, {photo: 2}, {photo: 3}] });
   
    // Добавляем ребра
    graph.addEdge('n1', 'n2');
    graph.addEdge('n2', 'n3');
    graph.addEdge('n3', 'n4');
    graph.addEdge('n1', 'n4');
   
    superModel.graph = graph;
   
    // Создаем последнюю модель
    const lastModel = new SimpleFootprint({
        name: 'Последний след',
        userId: 'test_user'
    });
   
    const lastGraph = new SimpleGraph('Последний граф');
    lastGraph.addNode({ id: 'n1', x: 100, y: 100, confidence: 0.9 });
    lastGraph.addNode({ id: 'n4', x: 250, y: 100, confidence: 0.7 });
   
    lastModel.graph = lastGraph;
   
    // Тестируем визуализацию
    const result = await visualizer.visualizeSuperModel(superModel, lastModel, {
        outputPath: './test_output/supermodel_test.png'
    });
   
    if (result.success) {
        console.log('✅ Тест успешен!');
        console.log('📊 Статистика:', result.stats);
        console.log('📁 Файл:', result.path);
       
        // Проверяем существование файла
        if (fs.existsSync(result.path)) {
            console.log('✅ Файл создан успешно!');
        } else {
            console.log('❌ Файл не создан!');
        }
    } else {
        console.log('❌ Тест не удался:', result.error);
    }
}

// Запускаем тест
testSuperModelVisualization().catch(console.error);
