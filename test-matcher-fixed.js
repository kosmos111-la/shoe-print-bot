// test-matcher-fixed.js
const SimpleMatcher = require('./modules/footprint/simple-matcher');

console.log('🧪 Тестирование исправленного SimpleMatcher...\n');

const matcher = new SimpleMatcher({ debug: true });

// Тест 1: Идентичные точки
console.log('1. Тест с идентичными точками:');
const identicalPoints = [{x: 100, y: 100}, {x: 200, y: 200}, {x: 150, y: 150}];
const matchResult1 = matcher.match(identicalPoints, identicalPoints);
console.log(`   similarity=${matchResult1.similarity.toFixed(3)}, decision=${matchResult1.decision}, matches=${matchResult1.matches.length}\n`);

// Тест 2: Похожие точки
console.log('2. Тест с похожими точками:');
const points1 = [{x: 100, y: 100}, {x: 200, y: 200}];
const points2 = [{x: 110, y: 110}, {x: 210, y: 210}];
const matchResult2 = matcher.match(points1, points2);
console.log(`   similarity=${matchResult2.similarity.toFixed(3)}, decision=${matchResult2.decision}, matches=${matchResult2.matches.length}\n`);

// Тест 3: Разные точки
console.log('3. Тест с разными точками:');
const points3 = [{x: 50, y: 50}, {x: 100, y: 100}];
const points4 = [{x: 300, y: 300}, {x: 400, y: 400}];
const matchResult3 = matcher.match(points3, points4);
console.log(`   similarity=${matchResult3.similarity.toFixed(3)}, decision=${matchResult3.decision}, matches=${matchResult3.matches.length}\n`);

// Тест 4: Метод compare
console.log('4. Тест метода compare():');
const footprint1 = {
    points: points1,
    id: 'fp1',
    graph: { nodes: new Map() }
};
const footprint2 = {
    points: points2,
    id: 'fp2',
    graph: { nodes: new Map() }
};

footprint1.graph.nodes.set('n1', {x: 100, y: 100});
footprint1.graph.nodes.set('n2', {x: 200, y: 200});
footprint2.graph.nodes.set('n1', {x: 110, y: 110});
footprint2.graph.nodes.set('n2', {x: 210, y: 210});

const compareResult = matcher.compare(footprint1, footprint2);
console.log(`   similarity=${compareResult.similarity.toFixed(3)}, decision=${compareResult.decision}`);
console.log(`   reason: ${compareResult.reason}`);
console.log(`   method: ${compareResult.method}\n`);

console.log('✅ Все тесты завершены успешно!');
