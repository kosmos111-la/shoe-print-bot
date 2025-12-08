// test-matcher-system.js
const SimpleGraph = require('./modules/footprint/simple-graph');
const SimpleGraphMatcher = require('./modules/footprint/simple-matcher');
const { createTestFootprints } = require('./test-realistic-footprint');

console.log('🧪 ТЕСТИРУЮ УМНЫЙ СРАВНИТЕЛЬ ГРАФОВ...\n');

// Создаём тестовые данные
const { points1, points2, points3, points4 } = createTestFootprints();

// Создаём графы
const graphs = [
    new SimpleGraph('Оригинальный след'),
    new SimpleGraph('Повёрнутый на 90°'),
    new SimpleGraph('Увеличенный 1.5x'),
    new SimpleGraph('Другой след (меньше)'),
    new SimpleGraph('Случайный граф для теста')
];

// Строим графы
graphs[0].buildFromPoints(points1);
graphs[1].buildFromPoints(points2);
graphs[2].buildFromPoints(points3);
graphs[3].buildFromPoints(points4);

// Создаём случайный граф (совсем другой)
const randomPoints = Array.from({ length: 30 }, () => ({
    x: Math.random() * 500,
    y: Math.random() * 500,
    confidence: 0.5 + Math.random() * 0.5
}));
graphs[4].buildFromPoints(randomPoints);

// Создаём матчер с детальным логгированием
const matcher = new SimpleGraphMatcher({
    debug: true,
    sameThreshold: 0.7,
    similarThreshold: 0.4,
    enableDetailedMatch: true
});

console.log('\n1. ТЕСТИРУЮ ПОПАРНЫЕ СРАВНЕНИЯ:');
console.log('='.repeat(50));

// Тест 1: Оригинал vs Повёрнутый
console.log('\n🔍 Тест 1: Оригинал vs Повёрнутый на 90°');
const result1 = matcher.compareGraphs(graphs[0], graphs[1], {
    test: 'rotation_90_degrees'
});
console.log(`   Результат: ${result1.decision} (similarity: ${result1.similarity.toFixed(3)})`);
console.log(`   Причина: ${result1.reason}`);

// Тест 2: Оригинал vs Увеличенный
console.log('\n🔍 Тест 2: Оригинал vs Увеличенный 1.5x');
const result2 = matcher.compareGraphs(graphs[0], graphs[2], {
    test: 'scale_1.5x'
});
console.log(`   Результат: ${result2.decision} (similarity: ${result2.similarity.toFixed(3)})`);
console.log(`   Причина: ${result2.reason}`);

// Тест 3: Оригинал vs Другой след
console.log('\n🔍 Тест 3: Оригинал vs Другой след');
const result3 = matcher.compareGraphs(graphs[0], graphs[3], {
    test: 'different_footprint'
});
console.log(`   Результат: ${result3.decision} (similarity: ${result3.similarity.toFixed(3)})`);
console.log(`   Причина: ${result3.reason}`);

// Тест 4: Оригинал vs Случайный
console.log('\n🔍 Тест 4: Оригинал vs Случайный граф');
const result4 = matcher.compareGraphs(graphs[0], graphs[4], {
    test: 'random_graph'
});
console.log(`   Результат: ${result4.decision} (similarity: ${result4.similarity.toFixed(3)})`);
console.log(`   Причина: ${result4.reason}`);

// Тест 5: Проверка isSameShoe
console.log('\n🔍 Тест 5: Быстрая проверка isSameShoe()');
const sameCheck = matcher.isSameShoe(graphs[0], graphs[1]);
console.log(`   Та же обувь? ${sameCheck.isSame ? '✅ ДА' : '❌ НЕТ'}`);
console.log(`   Схожесть: ${sameCheck.similarity.toFixed(3)}`);
console.log(`   Уверенность: ${sameCheck.confidence.toFixed(3)}`);

console.log('\n2. ТЕСТИРУЮ ПОИСК ПОХОЖИХ ГРАФОВ:');
console.log('='.repeat(50));

// Ищем похожие графы для оригинала
const searchResult = matcher.findMostSimilar(graphs[0], graphs, 3);

console.log(`\n🔎 Поиск похожих для "${graphs[0].name}":`);
console.log(`   Всего кандидатов: ${searchResult.totalCompared}`);
console.log(`   Найдено похожих: ${searchResult.bestMatches.length}`);

searchResult.bestMatches.forEach((match, index) => {
    console.log(`   ${index + 1}. "${match.graph.name}":`);
    console.log(`      Схожесть: ${match.similarity.toFixed(3)}`);
    console.log(`      Решение: ${match.decision}`);
    console.log(`      Причина: ${match.reason}`);
});

console.log('\n3. СТАТИСТИКА МАТЧЕРА:');
console.log('='.repeat(50));

const stats = matcher.getStats();
console.log(`   Всего сравнений: ${stats.totalMatches}`);
console.log(`   Средняя схожесть: ${stats.avgSimilarity?.toFixed(3) || 'н/д'}`);
console.log(`   Среднее время: ${stats.avgTimeMs?.toFixed(1) || 'н/д'}мс`);
console.log(`   Решения:`);
console.log(`     • same: ${stats.decisions?.same || 0}`);
console.log(`     • similar: ${stats.decisions?.similar || 0}`);
console.log(`     • different: ${stats.decisions?.different || 0}`);

console.log('\n✅ ТЕСТ СРАВНИТЕЛЯ ГРАФОВ ЗАВЕРШЁН!\n');
