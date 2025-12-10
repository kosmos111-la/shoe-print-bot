// test-cascade.js
const HybridFootprint = require('./modules/footprint/hybrid-footprint');

console.log('🚀 Тестирую каскадную систему...');

// Создать два похожих отпечатка
const points1 = Array.from({length: 30}, (_, i) => ({
    x: 100 + Math.random() * 200,
    y: 100 + Math.random() * 100,
    confidence: 0.7 + Math.random() * 0.3
}));

const points2 = points1.map(p => ({
    x: p.x + Math.random() * 30 - 15, // Немного смещённая версия
    y: p.y + Math.random() * 30 - 15,
    confidence: 0.7 + Math.random() * 0.3
}));

const fp1 = new HybridFootprint({ name: 'Тест A' });
const fp2 = new HybridFootprint({ name: 'Тест B' });

fp1.createFromPoints(points1);
fp2.createFromPoints(points2);

console.log('\n🔍 КАСКАДНОЕ СРАВНЕНИЕ:');
const result = fp1.compare(fp2);

console.log(`📊 Общая схожесть: ${result.similarity.toFixed(3)}`);
console.log(`🤔 Решение: ${result.decision}`);
console.log(`⏱️ Общее время: ${result.timeMs}ms`);

console.log('\n📈 РАСПРЕДЕЛЕНИЕ ПО ШАГАМ:');
result.steps?.forEach((step, i) => {
    const stepTime = i === 0 ? step.time : result.steps[i].time - result.steps[i-1].time;
    console.log(`${i+1}. ${step.step}: ${step.result?.similarity?.toFixed(3) || 'N/A'} (${stepTime}ms)`);
});

console.log('\n🎯 ТОЧНОЕ ОБЪЕДИНЕНИЕ:');
const mergeResult = fp1.mergeWithTransformation(fp2);
if (mergeResult.success) {
    console.log(`✅ Успешно объединено!`);
    console.log(`   📊 Точек высокого доверия: ${mergeResult.highConfidencePoints}`);
    console.log(`   🔄 Трансформация: ${mergeResult.transformation?.type || 'нет'}`);
    console.log(`   💎 Уверенность: ${Math.round(mergeResult.confidence * 100)}%`);
} else {
    console.log(`❌ Не удалось объединить: ${mergeResult.reason}`);
}

// Тест быстрого отсева
console.log('\n🚫 ТЕСТ БЫСТРОГО ОТСЕВА:');

const randomPoints = Array.from({length: 30}, () => ({
    x: Math.random() * 800,
    y: Math.random() * 600,
    confidence: 0.5
}));

const randomFp = new HybridFootprint({ name: 'Случайный след' });
randomFp.createFromPoints(randomPoints);

console.log('Сравниваю совершенно разные следы...');
const quickResult = fp1.compare(randomFp);
console.log(`Решение: ${quickResult.decision}`);
console.log(`Время: ${quickResult.timeMs}ms`);
console.log(`Быстрый отсев: ${quickResult.fastReject ? 'ДА' : 'НЕТ'}`);
