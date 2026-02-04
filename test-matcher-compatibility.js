// test-matcher-compatibility.js
const SimpleMatcher = require('./modules/footprint/simple-matcher');

console.log('🧪 Тестирование совместимости SimpleMatcher...\n');

const matcher = new SimpleMatcher({ debug: true });

// Тест 1: Проверка метода match
console.log('1. Тестирование метода match():');
const testPoints1 = [{x: 100, y: 100}, {x: 200, y: 200}];
const testPoints2 = [{x: 110, y: 110}, {x: 210, y: 210}];

const matchResult = matcher.match(testPoints1, testPoints2);
console.log(`   Результат: similarity=${matchResult.similarity.toFixed(3)}`);
console.log(`   matches: ${matchResult.matches?.length || 0}`);
console.log(`   decision: ${matchResult.decision}`);
console.log(`   method: ${matchResult.method}\n`);

// Тест 2: Проверка метода compare
console.log('2. Тестирование метода compare():');
const footprint1 = {
    points: testPoints1,
    id: 'fp1'
};
const footprint2 = {
    points: testPoints2,
    id: 'fp2'
};

const compareResult = matcher.compare(footprint1, footprint2);
console.log(`   Результат: similarity=${compareResult.similarity.toFixed(3)}`);
console.log(`   matches: ${compareResult.matches?.length || 0}`);
console.log(`   decision: ${compareResult.decision}`);
console.log(`   reason: ${compareResult.reason}\n`);

console.log('✅ Тест завершен!');
