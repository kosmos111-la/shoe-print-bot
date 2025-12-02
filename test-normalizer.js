// test-normalizer.js
const { ImageNormalizer } = require('./normalizer.js');

const normalizer = new ImageNormalizer();
const testPredictions = [...]; // тестовые данные

// Устанавливаем референсные данные (с первого фото)
const referenceData = {
  orientation: 45,
  scale: 100
};

const normalized = normalizer.normalizeToReference(testPredictions, referenceData);
console.log('Нормализовано:', normalized.length, 'предсказаний');
