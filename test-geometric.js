// test-geometric.js
const SimpleManager = require('./modules/footprint/simple-manager.js');
const manager = new SimpleManager({ debug: true });

// Тестовые точки (БОЛЬШЕ точек!)
const points1 = [
    { x: 100, y: 100, id: 'p1' },
    { x: 200, y: 200, id: 'p2' },
    { x: 300, y: 300, id: 'p3' },
    { x: 150, y: 150, id: 'p4' },
    { x: 250, y: 250, id: 'p5' },
    { x: 120, y: 180, id: 'p6' },
    { x: 180, y: 120, id: 'p7' },
    { x: 220, y: 280, id: 'p8' },
    { x: 280, y: 220, id: 'p9' },
    { x: 130, y: 270, id: 'p10' }
];

const points2 = [
    { x: 105, y: 105, id: 'p1' },
    { x: 205, y: 205, id: 'p2' },
    { x: 305, y: 305, id: 'p3' },
    { x: 155, y: 155, id: 'p4' },
    { x: 255, y: 255, id: 'p5' },
    { x: 125, y: 185, id: 'p6' },
    { x: 185, y: 125, id: 'p7' },
    { x: 225, y: 285, id: 'p8' },
    { x: 285, y: 225, id: 'p9' },
    { x: 135, y: 275, id: 'p10' }
];

async function test() {
    console.log('\n🎯 ТЕСТ ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА\n');
   
    console.log(`📊 Создаю отпечатки из ${points1.length} и ${points2.length} точек`);
   
    // Создаем отпечатки напрямую через алгоритм
    const geo1 = manager.geometricAlgorithm.createFootprint(points1, 'test1');
    const geo2 = manager.geometricAlgorithm.createFootprint(points2, 'test2');
   
    console.log(`✅ Создано отпечатков: ${geo1.length} и ${geo2.length} точек`);
   
    if (geo1.length === 0 || geo2.length === 0) {
        console.log('❌ Ошибка: пустые отпечатки!');
        console.log('Проверьте метод createFootprint в vector-algorithm.js');
        return;
    }
   
    // Сравниваем
    const result = manager.geometricAlgorithm.compareFootprints(geo1, geo2, 'Отпечаток 1', 'Отпечаток 2');
   
    console.log('\n🎯 РЕЗУЛЬТАТ:');
    console.log(`• Схожесть: ${(result.similarity * 100).toFixed(1)}%`);
    console.log(`• Решение: ${result.decision === 'same' ? '✅ ОДНА обувь' : '❌ РАЗНАЯ обувь'}`);
   
    if (result.stats) {
        console.log(`• Совпадения уровня 1: ${result.stats.level1Matches || 0}`);
        console.log(`• Совпадения уровня 2: ${result.stats.level2Matches || 0}`);
        console.log(`• Совпадения уровня 3: ${result.stats.level3Matches || 0}`);
        console.log(`• Всего совпадений: ${result.stats.totalMatches || 0}`);
    }
   
    // Тест через менеджер
    console.log('\n🔍 ТЕСТ ЧЕРЕЗ МЕНЕДЖЕР:');
   
    // Создаем простые отпечатки
    const SimpleFootprint = require('./modules/footprint/simple-footprint');
    const footprint1 = new SimpleFootprint({
        userId: 'test',
        name: 'Тест1'
    });
   
    const footprint2 = new SimpleFootprint({
        userId: 'test',
        name: 'Тест2'
    });
   
    // Добавляем точки
    points1.forEach((p, i) => {
        if (footprint1.pointTracker) {
            footprint1.pointTracker.points.set(p.id, {
                id: p.id,
                x: p.x,
                y: p.y,
                confidence: 0.8,
                confirmedCount: 1
            });
        }
    });
   
    points2.forEach((p, i) => {
        if (footprint2.pointTracker) {
            footprint2.pointTracker.points.set(p.id, {
                id: p.id,
                x: p.x,
                y: p.y,
                confidence: 0.8,
                confirmedCount: 1
            });
        }
    });
   
    console.log(`📊 Отпечатки созданы: ${footprint1.pointTracker?.points.size || 0} и ${footprint2.pointTracker?.points.size || 0} точек`);
   
    // Сравниваем через менеджер
    const managerResult = await manager.compareFootprints(footprint1, footprint2);
   
    console.log(`\n🎯 РЕЗУЛЬТАТ МЕНЕДЖЕРА:`);
    console.log(`• Схожесть: ${(managerResult.similarity * 100).toFixed(1)}%`);
    console.log(`• Решение: ${managerResult.decision === 'same' ? '✅ ОДНА обувь' : '❌ РАЗНАЯ обувь'}`);
    console.log(`• Метод: ${managerResult.method}`);
}

test();
