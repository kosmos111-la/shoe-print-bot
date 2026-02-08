// test-accumulator.js - тестовая точка входа

const GeometricAccumulator = require('./modules/footprint/accumulator');
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

// Тестовые данные
const testPoints1 = [
    { x: 100, y: 100, confidence: 0.9 },
    { x: 200, y: 150, confidence: 0.8 },
    { x: 150, y: 200, confidence: 0.7 },
    { x: 250, y: 250, confidence: 0.6 }, // Уникальная для первого
    { x: 300, y: 300, confidence: 0.5 }
];

const testPoints2 = [
    { x: 100, y: 100, confidence: 0.9 },  // Совпадает
    { x: 200, y: 150, confidence: 0.8 },  // Совпадает
    { x: 150, y: 200, confidence: 0.7 },  // Совпадает
    { x: 400, y: 400, confidence: 0.6 },  // Уникальная для второго
    { x: 500, y: 500, confidence: 0.5 }   // Уникальная для второго
];

// Тест 1: Простой аккумулятор
console.log('\n🧪 ТЕСТ 1: Простой аккумулятор');
const accumulator = new GeometricAccumulator('test_user_1');

// Добавляем первый след
const added1 = accumulator.addPointsDirectly(testPoints1, 'footprint_1');
console.log(`✅ Добавлен след 1: +${added1} новых точек, всего: ${accumulator.geometricPoints.size}`);

// Добавляем второй след
const added2 = accumulator.addPointsDirectly(testPoints2, 'footprint_2');
console.log(`✅ Добавлен след 2: +${added2} новых точек, всего: ${accumulator.geometricPoints.size}`);

// Статистика
const stats = accumulator.getStats();
console.log(`\n📊 СТАТИСТИКА АККУМУЛЯТОРА:`);
console.log(`   Всего уникальных точек: ${stats.totalUniquePoints}`);
console.log(`   🔴 3+ подтверждений: ${stats.byConfirmations['3+']}`);
console.log(`   🟠 2 подтверждения: ${stats.byConfirmations['2']}`);
console.log(`   🔵 1 подтверждение: ${stats.byConfirmations['1']}`);

// Сравнение следов
const comparison = accumulator.compareFootprints('footprint_1', 'footprint_2');
console.log(`\n🔍 СРАВНЕНИЕ СЛЕДОВ:`);
console.log(`   След 1: ${comparison.footprint1.totalPoints} точек`);
console.log(`   След 2: ${comparison.footprint2.totalPoints} точек`);
console.log(`   Общих точек: ${comparison.commonPoints}`);
console.log(`   Схожесть: ${(comparison.similarity * 100).toFixed(1)}%`);
console.log(`   Одна обувь? ${comparison.isSame ? 'ДА ✅' : 'НЕТ ❌'}`);

// Тест 2: Менеджер с аккумулятором
console.log('\n\n🧪 ТЕСТ 2: Менеджер с аккумулятором');
const manager = new SimpleFootprintManager({
    dbPath: './data/test_footprints',
    debug: true,
    enableVisualization: true
});

// Генерируем тестовые данные
manager.generateTestData('test_user_2', 40);

// Получаем информацию
const info = manager.getAccumulatorInfo('test_user_2');
if (info.exists) {
    console.log(`✅ Аккумулятор найден: ${info.totalPoints} точек`);
    console.log(`   Следов: ${info.footprintsCount}`);
}

// Системная статистика
const systemStats = manager.getSystemStats();
console.log(`\n📈 СИСТЕМНАЯ СТАТИСТИКА:`);
console.log(`   Пользователей: ${systemStats.totalUsers}`);
console.log(`   Аккумуляторов: ${systemStats.activeAccumulators}`);
console.log(`   Алгоритм: ${systemStats.algorithm}`);

console.log('\n🎯 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!');
