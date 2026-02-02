// test-alignment-system.js
const AlignmentSystem = require('./modules/footprint/core/alignment-system');

console.log('=== ТЕСТ СИСТЕМЫ ВЫРАВНИВАНИЯ ===\n');

// Тестовые данные
const referencePoints = [
    {x: 100, y: 100},
    {x: 200, y: 100},
    {x: 150, y: 200}
];

const testPoints = [
    {x: 120, y: 110},
    {x: 220, y: 110},
    {x: 170, y: 210}
];

console.log('1. Простое выравнивание:');
try {
    const aligned = AlignmentSystem.alignPoints(testPoints, referencePoints, { method: 'simple' });
    console.log(`   ✅ Выровнено: ${aligned.length} точек`);
   
    const validation = AlignmentSystem.validateAlignment(aligned, referencePoints, 20);
    console.log(`   ✅ Валидация: ${validation.valid ? 'OK' : 'FAIL'}`);
    if (validation.valid) {
        console.log(`      Средняя ошибка: ${validation.averageError.toFixed(2)}px`);
    }
} catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
}

console.log('\n2. Procrustes выравнивание:');
try {
    const aligned = AlignmentSystem.alignPoints(testPoints, referencePoints, { method: 'procrustes' });
    console.log(`   ✅ Выровнено: ${aligned.length} точек`);
} catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
}

console.log('\n3. Конвертация координат:');
try {
    const converted = AlignmentSystem.convertCoordinates(testPoints, 'old', 'new');
    console.log(`   ✅ Конвертировано: ${converted.length} точек`);
} catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
}

console.log('\n=== ТЕСТ ЗАВЕРШЁН ===');
