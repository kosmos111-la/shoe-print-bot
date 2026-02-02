// test-full-coordinate-system.js
const CoordinateSystem = require('./modules/footprint/core/coordinate-system');
const LegacySupport = require('./modules/footprint/legacy-support/coordinate-facade');

console.log('=== ПОЛНЫЙ ТЕСТ НОВОЙ СИСТЕМЫ КООРДИНАТ ===\n');

// Тест 1: Все методы доступны
console.log('1. Проверка доступности методов:');
const methods = [
    'transform', 'normalize', 'validate', 'rotate',
    'centerPoints', 'calculateCenter', 'getBounds'
];

methods.forEach(method => {
    const exists = typeof CoordinateSystem[method] === 'function';
    console.log(`   ${exists ? '✅' : '❌'} ${method}`);
});

// Тест 2: Legacy поддержка
console.log('\n2. Проверка legacy поддержки:');
const legacyManager = new LegacySupport.CoordinateManager();
console.log(`   ✅ Legacy CoordinateManager создан`);

// Тест 3: Трансформация
console.log('\n3. Тест трансформации:');
const points = [{x: 100, y: 100}, {x: 200, y: 200}, {x: 300, y: 300}];
try {
    const transformed = CoordinateSystem.transformPoints(points);
    console.log(`   ✅ Трансформация: ${transformed.length} точек`);
   
    const centered = CoordinateSystem.centerPoints(points);
    console.log(`   ✅ Центрирование: ${centered.length} точек`);
   
    const center = CoordinateSystem.calculateCenter(points);
    console.log(`   ✅ Центр: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
} catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
}

// Тест 4: Константы
console.log('\n4. Проверка констант:');
console.log(`   ✅ Центр: (${CoordinateSystem.CONSTANTS.CENTER.x}, ${CoordinateSystem.CONSTANTS.CENTER.y})`);

console.log('\n=== ТЕСТ ЗАВЕРШЁН ===');
