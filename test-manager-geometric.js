// test-manager-geometric.js
// 🧪 ТЕСТИРУЕМ МЕНЕДЖЕР С ГЕОМЕТРИЧЕСКИМ АЛГОРИТМОМ

const CleanFootprintManager = require('./modules/footprint/clean/manager');

// 🎯 СОЗДАЕМ ТЕСТОВЫЕ ДАННЫЕ КАК В УСПЕШНОМ АЛГОРИТМЕ
function createTestFigure(pointCount, prefix = 'P', offsetX = 0, offsetY = 0) {
    const points = [];
    const a = 100;
    const b = 60;
   
    for (let i = 0; i < pointCount; i++) {
        const t = (i / pointCount) * 2 * Math.PI;
        const x = a * Math.sin(t) + offsetX;
        const y = b * Math.sin(2 * t) + offsetY;
       
        points.push({
            x: x,
            y: y,
            confidence: 0.9,
            id: `${prefix}${i}`,
            originalId: `${prefix}${i}` // 🔥 КЛЮЧЕВОЕ: одинаковые originalId!
        });
    }
   
    return points;
}

async function testManagerWithGeometricAlgorithm() {
    console.log('🧪 ТЕСТИРОВАНИЕ МЕНЕДЖЕРА С ГЕОМЕТРИЧЕСКИМ АЛГОРИТМОМ\n');
   
    // 1. Создаём менеджер
    const manager = new CleanFootprintManager({
        debug: true,
        similarityThreshold: 0.6 // 60%
    });
   
    console.log('1. 📸 ТЕСТ 1: Добавляем первое фото (фигура из 12 точек)');
    console.log('='.repeat(60));
   
    const fullFigure = createTestFigure(12, 'FULL');
    console.log(`   Создано ${fullFigure.length} точек`);
   
    const result1 = await manager.addPhoto('test_user_geometric', fullFigure, {
        id: 'photo_1',
        source: 'test',
        note: 'Полная фигура (12 точек)'
    });
   
    console.log('Результат:', result1);
   
    console.log('\n2. 📸 ТЕСТ 2: Добавляем похожую фигуру (поворот на 30°)');
    console.log('='.repeat(60));
   
    const rotatedFigure = fullFigure.map((point, i) => {
        const angle = 30 * Math.PI / 180;
        const x = point.x * Math.cos(angle) - point.y * Math.sin(angle);
        const y = point.x * Math.sin(angle) + point.y * Math.cos(angle);
       
        return {
            ...point,
            x: x,
            y: y,
            id: `${point.id}_R30`, // ID разные
            originalId: point.originalId // Но originalId одинаковые!
        };
    });
   
    console.log(`   Повернутая фигура: ${rotatedFigure.length} точек`);
    console.log('   ⚠️  ВНИМАНИЕ: ID разные, но originalId одинаковые!');
   
    const result2 = await manager.addPhoto('test_user_geometric', rotatedFigure, {
        id: 'photo_2',
        source: 'test',
        note: 'Повернутая фигура (30°)'
    });
   
    console.log('Результат:', result2);
    console.log('Ожидается: СОВПАДЕНИЕ (фигуры одинаковые, только повернуты)');
   
    console.log('\n3. 📸 ТЕСТ 3: Добавляем частичную фигуру (удалены 3 точки)');
    console.log('='.repeat(60));
   
    const removeIndices = [2, 5, 8];
    const partialFigure = fullFigure
        .filter((_, idx) => !removeIndices.includes(idx))
        .map((point, newIdx) => ({
            ...point,
            index: newIdx,
            id: `PARTIAL_${newIdx}`, // ID разные
            originalId: point.originalId // Но originalId сохраняем!
        }));
   
    console.log(`   Частичная фигура: ${partialFigure.length} точек (удалены индексы: ${removeIndices.join(', ')})`);
   
    const result3 = await manager.addPhoto('test_user_geometric', partialFigure, {
        id: 'photo_3',
        source: 'test',
        note: 'Частичная фигура (9 точек из 12)'
    });
   
    console.log('Результат:', result3);
    console.log('Ожидается: СОВПАДЕНИЕ (75% точек должны совпасть)');
   
    console.log('\n4. 📸 ТЕСТ 4: Добавляем СОВСЕМ ДРУГУЮ фигуру');
    console.log('='.repeat(60));
   
    const differentFigure = createTestFigure(8, 'DIFFERENT', 500, 500);
    console.log(`   Другая фигура: ${differentFigure.length} точек (смещена на 500,500)`);
   
    const result4 = await manager.addPhoto('test_user_geometric', differentFigure, {
        id: 'photo_4',
        source: 'test',
        note: 'Совсем другая фигура'
    });
   
    console.log('Результат:', result4);
    console.log('Ожидается: НОВЫЙ ОТПЕЧАТОК (фигуры разные)');
   
    console.log('\n5. 📊 СТАТИСТИКА СИСТЕМЫ');
    console.log('='.repeat(60));
   
    const stats = manager.getStats();
    console.log(JSON.stringify(stats, null, 2));
   
    console.log('\n6. 👣 ИНФОРМАЦИЯ ОБ ОТПЕЧАТКЕ');
    console.log('='.repeat(60));
   
    const footprint = manager.getFootprint('test_user_geometric');
    if (footprint) {
        const info = footprint.getInfo();
        console.log(`ID: ${info.id}`);
        console.log(`Имя: ${info.name}`);
        console.log(`Точек: ${info.points}`);
        console.log(`Фото: ${info.photos}`);
        console.log(`Среднее подтверждений: ${info.stats.avgConfirmations.toFixed(2)}`);
       
        console.log('\n📈 ИСТОРИЯ ФОТО:');
        footprint.photos.forEach((photo, i) => {
            console.log(`   ${i + 1}. ${photo.id}: ${photo.points} точек, ${photo.matches} совпадений, ${photo.newPoints} новых`);
        });
    }
   
    console.log('\n✅ ТЕСТ ЗАВЕРШЕН');
}

// 🧪 ЗАПУСКАЕМ ДОПОЛНИТЕЛЬНЫЙ ТЕСТ СРАВНЕНИЯ
async function runDirectComparisonTest() {
    console.log('\n\n🎯 ДОПОЛНИТЕЛЬНЫЙ ТЕСТ: ПРЯМОЕ СРАВНЕНИЕ');
    console.log('='.repeat(60));
   
    const GeometricHashAlgorithm = require('./modules/footprint/clean/geometric-hash-algorithm');
    const algorithm = new GeometricHashAlgorithm({ debug: true });
   
    // Создаем тестовые фигуры
    const figure1 = createTestFigure(12, 'FIG1');
    const figure2 = createTestFigure(12, 'FIG2', 0, 0); // Та же фигура
    const figure3 = createTestFigure(8, 'FIG3', 500, 500); // Другая фигура
   
    console.log('\n🧪 ТЕСТ 1: ДВЕ ОДИНАКОВЫЕ ФИГУРЫ');
    const result1 = algorithm.comparePoints(figure1, figure2, 'Фигура 1', 'Фигура 2');
    console.log(`   Результат: ${result1.decision}, схожесть: ${result1.similarity.toFixed(3)}`);
    console.log(`   Ожидается: SAME (схожесть ~1.0)`);
   
    console.log('\n🧪 ТЕСТ 2: ОДИНАКОВАЯ И ДРУГАЯ ФИГУРА');
    const result2 = algorithm.comparePoints(figure1, figure3, 'Фигура 1', 'Фигура 3');
    console.log(`   Результат: ${result2.decision}, схожесть: ${result2.similarity.toFixed(3)}`);
    console.log(`   Ожидается: DIFFERENT (схожесть < 0.6)`);
}

// Запускаем тесты
async function main() {
    try {
        await testManagerWithGeometricAlgorithm();
        await runDirectComparisonTest();
    } catch (error) {
        console.error(`\n❌ ОШИБКА: ${error.message}`);
        console.error(error.stack);
    }
}

main();
