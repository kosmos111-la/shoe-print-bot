// test-similarity.js
const { SimilarityEngine } = require('./similarity-engine.js');
const { FootprintModel } = require('./footprint-model.js');

const engine = new SimilarityEngine();
const model = new FootprintModel('test_model');

// Загружаем модель с данными
// ...

// Тестовый фрагмент
const testFragment = [...]; // предсказания с нового фото

const result = engine.quickCheck(testFragment, model);
console.log('Результат быстрой проверки:', result);
