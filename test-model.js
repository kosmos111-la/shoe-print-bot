// test-model.js
const { FootprintModel } = require('./footprint-model.js');

const model = new FootprintModel('test_session_1');

// Симулируем добавление 3 фото
for (let i = 1; i <= 3; i++) {
  const mockPredictions = generateMockPredictions(i);
  const stats = model.addPhotograph(mockPredictions, `photo_${i}`);
  console.log(`После фото ${i}:`, stats);
}

console.log('Консенсусная модель:', model.getConsensusModel());
