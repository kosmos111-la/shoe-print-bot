// test-graph-system.js
const SimpleGraph = require('./modules/footprint/simple-graph');
const { createTestFootprints } = require('./test-realistic-footprint');

console.log('🧪 ТЕСТИРУЮ НОВУЮ ГРАФОВУЮ СИСТЕМУ...\n');

// Создаём тестовые отпечатки
const { points1, points2, points3, points4 } = createTestFootprints();

// Создаём графы
const graph1 = new SimpleGraph('Отпечаток 1 (оригинал)');
graph1.buildFromPoints(points1);

const graph2 = new SimpleGraph('Отпечаток 2 (повёрнут 90°)');
graph2.buildFromPoints(points2);

const graph3 = new SimpleGraph('Отпечаток 3 (увеличен 1.5x)');
graph3.buildFromPoints(points3);

const graph4 = new SimpleGraph('Отпечаток 4 (другой след)');
graph4.buildFromPoints(points4);

// Смотрим инварианты
console.log('\n📊 ИНВАРИАНТЫ ГРАФОВ:');
console.log('1. Оригинал:', graph1.getBasicInvariants().nodeCount, 'узлов');
console.log('2. Повёрнутый:', graph2.getBasicInvariants().nodeCount, 'узлов');
console.log('3. Увеличенный:', graph3.getBasicInvariants().nodeCount, 'узлов');
console.log('4. Другой след:', graph4.getBasicInvariants().nodeCount, 'узлов');

// Сохраняем и загружаем
const saved = graph1.toJSON();
console.log('\n💾 Сохранённый граф имеет ключи:', Object.keys(saved));

// Визуализация
console.log('\n🕸️ ВИЗУАЛИЗАЦИЯ ПЕРВОГО ГРАФА:');
graph1.visualize();

console.log('\n✅ ТЕСТ ЗАВЕРШЁН!');
