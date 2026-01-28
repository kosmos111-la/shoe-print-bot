// test-coordinate-system2.js
const LegacySupport = require('./modules/footprint/legacy-support/coordinate-facade');
const CoordinateSystem = require('./modules/footprint/core/coordinate-system');

console.log('=== ТЕСТ НОВОЙ СИСТЕМЫ КООРДИНАТ ===');

// Тест 1: Создание канонической трансформации
console.log('\n1. Тест канонической трансформации:');
const canonical = CoordinateSystem.createCanonicalTransformation();
console.log('✅ Каноническая трансформация:', canonical);

// Тест 2: Трансформация точек
console.log('\n2. Тест трансформации точек:');
const points = [{x: 100, y: 100}, {x: 200, y: 200}, {x: 300, y: 300}];
const transformed = CoordinateSystem.transformPoints(points);
console.log('✅ Трансформация:', transformed.length, 'точек');

// Тест 3: Legacy поддержка
console.log('\n3. Тест legacy поддержки:');
const legacyManager = new LegacySupport.CoordinateManager();
const legacyResult = legacyManager.getCoordinates(points);
console.log('✅ Legacy manager работает:', legacyResult.count, 'точек');
