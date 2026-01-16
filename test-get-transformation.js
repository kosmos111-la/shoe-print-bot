// test-get-transformation.js - Тест метода getTransformation()
const SimpleFootprint = require('./modules/footprint/simple-footprint');

console.log('🧪 ТЕСТ МЕТОДА getTransformation()\n');

// 1. ТЕСТ: Создаем отпечаток С трансформацией 90°
console.log('1. ТЕСТ: Отпечаток С трансформацией 90°');
const footprintWithTransformation = new SimpleFootprint({
    name: 'Тест_90градусов',
    transformation: {
        rotationAngle: 90,
        isMirrored: false,
        center: { x: 100, y: 100 },
        bounds: { minX: 50, maxX: 150, minY: 50, maxY: 150 },
        type: 'test_90',
        timestamp: new Date()
    }
});

console.log('   - footprint.transformation:', footprintWithTransformation.transformation?.rotationAngle, '°');
console.log('   - getTransformation():', footprintWithTransformation.getTransformation()?.rotationAngle, '°');

// Проверяем равенство
const transRaw = footprintWithTransformation.transformation?.rotationAngle;
const transGet = footprintWithTransformation.getTransformation()?.rotationAngle;
console.log('   - Совпадают?', transRaw === transGet ? '✅ ДА' : '❌ НЕТ');

console.log('\n2. ТЕСТ: Отпечаток БЕЗ начальной трансформации');
const footprintNoTransformation = new SimpleFootprint({
    name: 'Тест_Без_Трансформации'
});

console.log('   - footprint.transformation:', footprintNoTransformation.transformation?.rotationAngle || 'нет');
console.log('   - getTransformation():', footprintNoTransformation.getTransformation()?.rotationAngle || 'нет');

// 3. ТЕСТ: Эмуляция добавления точек (как в реальной системе)
console.log('\n3. ТЕСТ: Эмуляция реального отпечатка с точками');

// Создаем "вертикальный" след (для теста 90°)
const verticalPoints = [];
for (let i = 0; i < 10; i++) {
    verticalPoints.push({
        x: 100 + Math.random() * 10,
        y: 50 + i * 20,
        confidence: 0.8 + Math.random() * 0.2
    });
}

const realFootprint = new SimpleFootprint({
    name: 'Реальный_Вертикальный_След'
});

// Эмулируем PointTracker с точками
realFootprint.pointTracker = {
    points: new Map()
};

verticalPoints.forEach((point, i) => {
    realFootprint.pointTracker.points.set(`pt_${i}`, {
        x: point.x,
        y: point.y,
        rating: point.confidence,
        confidence: point.confidence,
        confirmedCount: 1,
        lastSeen: new Date()
    });
});

console.log('   - Добавлено точек:', realFootprint.pointTracker.points.size);
console.log('   - getTransformation() после добавления точек:');
const realTrans = realFootprint.getTransformation();
console.log('     * rotationAngle:', realTrans?.rotationAngle, '°');
console.log('     * type:', realTrans?.type);
console.log('     * center:', realTrans?.center);

// 4. ТЕСТ: Что происходит при вызове getTransformation() дважды
console.log('\n4. ТЕСТ: Повторный вызов getTransformation()');
const trans1 = realFootprint.getTransformation();
const trans2 = realFootprint.getTransformation();
console.log('   - Первый вызов:', trans1?.rotationAngle, '°');
console.log('   - Второй вызов:', trans2?.rotationAngle, '°');
console.log('   - Это один и тот же объект?', trans1 === trans2 ? '✅ ДА' : '❌ НЕТ');

console.log('\n🎯 ИТОГ ТЕСТА:');
console.log('   - getTransformation() должен всегда возвращать реальный угол поворота');
console.log('   - Если след вертикальный (ширина < высоты), угол должен быть около 90°');
console.log('   - Трансформация должна сохраняться между вызовами');

// Быстрая проверка "вертикальности"
if (realTrans?.rotationAngle && Math.abs(realTrans.rotationAngle - 90) < 30) {
    console.log('✅ УСПЕХ: Система правильно определила угол ~90° для вертикального следа');
} else if (realTrans?.rotationAngle === 0) {
    console.log('❌ ПРОБЛЕМА: Система вернула 0° для вертикального следа');
} else {
    console.log('⚠️ ВНИМАНИЕ: Угол', realTrans?.rotationAngle, '° - проверьте логику');
}
