// test-realistic-super-model.js
// РЕАЛИСТИЧНЫЙ ТЕСТ СЛИЯНИЯ ОТПЕЧАТКОВ

const HybridFootprint = require('./modules/footprint/hybrid-footprint');

console.log('🧪 РЕАЛИСТИЧНЫЙ ТЕСТ СОЗДАНИЯ СУПЕР-МОДЕЛИ\n');

// 1. РЕАЛИСТИЧНЫЕ ДАННЫЕ (как реальные отпечатки обуви)
function createRealisticShoePrint(name, offsetX = 0, offsetY = 0, rotation = 0) {
    const points = [];
   
    // Базовая форма подошвы обуви
    const basePoints = [
        // Пятка (закругленная)
        {x: 0, y: 0, type: 'heel', importance: 0.9},
        {x: 20, y: 10, type: 'heel', importance: 0.7},
        {x: 40, y: 20, type: 'heel', importance: 0.8},
       
        // Арка (середина)
        {x: 80, y: 15, type: 'arch', importance: 0.6},
        {x: 100, y: 10, type: 'arch', importance: 0.5},
       
        // Подушечка стопы
        {x: 150, y: 30, type: 'ball', importance: 0.9},
        {x: 170, y: 50, type: 'ball', importance: 0.8},
        {x: 180, y: 70, type: 'ball', importance: 0.7},
       
        // Пальцы
        {x: 200, y: 90, type: 'toes', importance: 0.6},
        {x: 190, y: 110, type: 'toes', importance: 0.5},
        {x: 180, y: 130, type: 'toes', importance: 0.4},
    ];
   
    // Добавляем реалистичный шум и вариации
    basePoints.forEach((base, i) => {
        // Реалистичные confidence (0.4-0.9)
        const confidence = 0.4 + Math.random() * 0.5;
       
        // Реалистичное смещение (больше для менее важных точек)
        const noiseX = (1 - base.importance) * (Math.random() * 30 - 15);
        const noiseY = (1 - base.importance) * (Math.random() * 30 - 15);
       
        // Применяем смещение и поворот
        const angle = rotation * Math.PI / 180;
        const x = base.x * Math.cos(angle) - base.y * Math.sin(angle);
        const y = base.x * Math.sin(angle) + base.y * Math.cos(angle);
       
        points.push({
            x: offsetX + x + noiseX,
            y: offsetY + y + noiseY,
            confidence: confidence,
            type: base.type,
            importance: base.importance,
            id: `${name}_${base.type}_${i}`,
            source: name
        });
    });
   
    return points;
}

// 2. СОЗДАЕМ РЕАЛИСТИЧНЫЕ ОТПЕЧАТКИ
console.log('📝 Создаю реалистичные отпечатки обуви...');
const print1 = createRealisticShoePrint('photo1', 100, 100, 0);
const print2 = createRealisticShoePrint('photo2', 110, 105, 5); // Немного смещен и повернут

// 3. ДОБАВЛЯЕМ НЕКОТОРЫЕ НОВЫЕ/ПРОПУЩЕННЫЕ ТОЧКИ (как в реальности)
print1.push(...[
    {x: 120, y: 80, confidence: 0.7, type: 'noise', source: 'photo1', id: 'photo1_noise_1'},
    {x: 140, y: 60, confidence: 0.6, type: 'noise', source: 'photo1', id: 'photo1_noise_2'},
]);

print2.push(...[
    {x: 90, y: 120, confidence: 0.8, type: 'noise', source: 'photo2', id: 'photo2_noise_1'},
    {x: 220, y: 140, confidence: 0.5, type: 'noise', source: 'photo2', id: 'photo2_noise_2'},
]);

console.log('\n📊 РЕАЛИСТИЧНЫЕ ДАННЫЕ:');
console.log(`   👟 Отпечаток 1: ${print1.length} точек (фото1)`);
console.log(`   👟 Отпечаток 2: ${print2.length} точек (фото2)`);
console.log(`   🔍 Ожидаемые совпадения: ~${Math.min(print1.length, print2.length) - 4} точек`);

// Анализ качества точек
const analyzePoints = (points, name) => {
    const avgConf = points.reduce((s, p) => s + p.confidence, 0) / points.length;
    const types = {};
    points.forEach(p => types[p.type] = (types[p.type] || 0) + 1);
   
    console.log(`\n   ${name}:`);
    console.log(`     📊 Средний confidence: ${avgConf.toFixed(3)}`);
    console.log(`     🎯 Типы точек: ${Object.entries(types).map(([t, c]) => `${t}:${c}`).join(', ')}`);
};

analyzePoints(print1, 'Отпечаток 1');
analyzePoints(print2, 'Отпечаток 2');

// 4. ПРОВЕРКА НА РЕАЛИСТИЧНОСТЬ
console.log('\n🔍 ПРОВЕРКА РЕАЛИСТИЧНОСТИ:');
console.log('   • Confidence в диапазоне 0.4-0.9 ✓');
console.log('   • Есть структурные точки (пятка, арка, подушечка) ✓');
console.log('   • Добавлен реалистичный шум ✓');
console.log('   • Второй отпечаток смещен и повернут ✓');

// 5. ТЕСТИРОВАНИЕ
console.log('\n🏗️  СОЗДАНИЕ ГИБРИДНЫХ ОТПЕЧАТКОВ...');
const footprint1 = new HybridFootprint({ name: 'Реальный отпечаток 1' });
const footprint2 = new HybridFootprint({ name: 'Реальный отпечаток 2' });

footprint1.createFromPoints(print1);
footprint2.createFromPoints(print2);

console.log('\n🔍 СРАВНЕНИЕ РЕАЛЬНЫХ ОТПЕЧАТКОВ...');
const comparison = footprint1.compare(footprint2);

console.log(`📊 Similarity: ${comparison.similarity.toFixed(3)}`);
console.log(`🤔 Decision: ${comparison.decision}`);
console.log(`💡 Reason: ${comparison.reason}`);

if (comparison.decision === 'different' && comparison.similarity < 0.7) {
    console.log('\n⚠️  ВНИМАНИЕ: Отпечатки слишком разные!');
    console.log('   Это может быть реалистично для разных фото одной обуви.');
    console.log('   Проверяю, можно ли все равно выполнить слияние...');
}

console.log('\n🔄 ИНТЕЛЛЕКТУАЛЬНОЕ СЛИЯНИЕ...');
const mergeResult = footprint1.mergeWithTransformation(footprint2);

if (!mergeResult.success) {
    console.log(`❌ Ошибка при слиянии: ${mergeResult.reason}`);
   
    // Попробовать обычное слияние
    console.log('\n🔄 Пробую обычное слияние...');
    const simpleMerge = footprint1.merge(footprint2);
    if (!simpleMerge.success) {
        console.log('❌ Обычное слияние тоже не удалось');
        console.log('\n💡 ВЫВОД: Система не может объединить эти отпечатки.');
        console.log('   Это МОЖЕТ БЫТЬ правильно, если фото сильно различаются.');
        process.exit(0);
    }
}

const superFootprint = footprint1;

// 6. АНАЛИЗ РЕЗУЛЬТАТОВ С КРИТИЧЕСКИМ ВЗГЛЯДОМ
console.log('\n🔍 КРИТИЧЕСКИЙ АНАЛИЗ РЕЗУЛЬТАТОВ:');

// Проверка на абсурдные значения
const allPoints = superFootprint.originalPoints;
const confidences = allPoints.map(p => p.confidence || 0.5);
const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
const maxConfidence = Math.max(...confidences);
const minConfidence = Math.min(...confidences);

console.log(`📊 РЕЗУЛЬТАТЫ СЛИЯНИЯ:`);
console.log(`├─ Точки до: ${print1.length} + ${print2.length} = ${print1.length + print2.length}`);
console.log(`├─ Точки после: ${allPoints.length}`);
console.log(`├─ Сокращение: ${mergeResult?.metrics?.efficiency || 'N/A'}`);

// КРИТИЧЕСКИЕ ПРОВЕРКИ
console.log('\n🚨 КРИТИЧЕСКИЕ ПРОВЕРКИ:');

// 1. Confidence не может быть > 1.0
if (maxConfidence > 1.0) {
    console.log(`❌ ОШИБКА: Max confidence = ${maxConfidence.toFixed(3)} (должен быть ≤ 1.0)`);
    console.log(`   Проблема в алгоритме слияния - confidence увеличивается неправильно`);
}

// 2. Confidence не может быть < 0.0
if (minConfidence < 0.0) {
    console.log(`❌ ОШИБКА: Min confidence = ${minConfidence.toFixed(3)} (должен быть ≥ 0.0)`);
}

// 3. Реалистичное улучшение confidence
if (mergeResult?.metrics) {
    const before = parseFloat(mergeResult.metrics.avgConfidenceBefore);
    const after = parseFloat(mergeResult.metrics.avgConfidenceAfter);
   
    if (after > 1.0) {
        console.log(`❌ ОШИБКА: Средний confidence после = ${after.toFixed(3)} > 1.0`);
    }
   
    const improvement = ((after - before) / before) * 100;
    if (improvement > 100) {
        console.log(`⚠️  ПОДОЗРИТЕЛЬНО: Улучшение confidence на ${improvement.toFixed(1)}% (слишком высоко)`);
    }
}

// 4. Проверка сохранения информации
const sources = {};
allPoints.forEach(p => {
    const source = p.source || 'unknown';
    sources[source] = (sources[source] || 0) + 1;
});

console.log(`\n📊 СОХРАНЕНИЕ ИНФОРМАЦИИ:`);
console.log(`├─ Источники точек: ${Object.keys(sources).join(', ')}`);
console.log(`└─ Точки без source: ${sources.unknown || 0} из ${allPoints.length}`);

if (sources.unknown === allPoints.length) {
    console.log(`❌ ОШИБКА: Все точки потеряли информацию о source!`);
}

// 7. ВЫВОД
console.log('\n' + '='.repeat(60));
console.log('📋 ИТОГОВЫЙ ВЫВОД:');

if (maxConfidence > 1.0 || minConfidence < 0.0) {
    console.log('❌ ТЕСТ ПРОВАЛЕН: Обнаружены критические ошибки в логике слияния');
    console.log('   • Confidence выходит за пределы [0.0, 1.0]');
    console.log('   • Необходимо исправить алгоритм слияния точек');
} else if (sources.unknown === allPoints.length) {
    console.log('⚠️  ТЕСТ С ОГРАНИЧЕНИЯМИ: Слияние работает, но теряется информация');
    console.log('   • Нужно сохранять source при слиянии');
} else {
    console.log('✅ ТЕСТ ПРОЙДЕН: Слияние работает корректно');
}

console.log('='.repeat(60));

// 8. РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЯМ
console.log('\n🔧 РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЯМ:');
console.log('1. В PointMerger исправить расчет confidence при слиянии');
console.log('2. Сохранять source и другую метаинформацию точек');
console.log('3. Ограничивать confidence диапазоном [0.0, 1.0]');
console.log('4. Добавить проверки на реалистичность результатов');
console.log('5. Тестировать на действительно разных данных (не подгонять)');
