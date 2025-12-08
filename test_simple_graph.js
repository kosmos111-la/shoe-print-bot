// test_simple_graph.js - быстрый тест
const SimpleGraph = require('./modules/footprint/simple-graph.js');

// 1. Создаём тестовые точки
const testPoints = [
    { x: 100, y: 100, confidence: 0.9 },
    { x: 150, y: 120, confidence: 0.8 },
    { x: 200, y: 100, confidence: 0.7 },
    { x: 180, y: 180, confidence: 0.6 },
    { x: 120, y: 200, confidence: 0.5 }
];

// 2. Создаём граф
console.log('🧪 ТЕСТИРУЮ ПРОСТОЙ ГРАФ...');
const graph = new SimpleGraph('Тестовый след');
graph.buildFromPoints(testPoints);

// 3. Смотрим результат
graph.visualize();

// 4. Получаем инварианты
const invariants = graph.getBasicInvariants();
console.log('\n📊 ИНВАРИАНТЫ ДЛЯ СРАВНЕНИЯ:');
console.log(JSON.stringify(invariants, null, 2));

// 5. Сохраняем и загружаем
const saved = graph.toJSON();
console.log('\n💾 Сохранённый граф:', Object.keys(saved));

const loadedGraph = SimpleGraph.fromJSON(saved);
console.log('✅ Загруженный граф имеет', loadedGraph.nodes.size, 'узлов');
