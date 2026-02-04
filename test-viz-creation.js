// test-viz-creation.js
const fs = require('fs');
const path = require('path');

console.log('🧪 Тестирование создания визуализации...\n');

// 1. Проверяем директории
const baseDir = './data/footprints/visualizations';
const clustersDir = path.join(baseDir, 'clusters');

console.log('1. Проверка директорий:');
console.log(`   • Базовая: ${baseDir} - ${fs.existsSync(baseDir) ? '✅' : '❌'}`);
console.log(`   • Clusters: ${clustersDir} - ${fs.existsSync(clustersDir) ? '✅' : '❌'}`);

if (!fs.existsSync(clustersDir)) {
    console.log(`   📁 Создаем директорию ${clustersDir}...`);
    fs.mkdirSync(clustersDir, { recursive: true });
    console.log(`   ✅ Директория создана`);
}

// 2. Создаем тестовый файл
const testFilePath = path.join(clustersDir, 'test_viz.png');
console.log(`\n2. Создание тестового файла: ${testFilePath}`);

// Просто создаем пустой файл для теста
fs.writeFileSync(testFilePath, 'TEST CONTENT');

const fileExists = fs.existsSync(testFilePath);
console.log(`   • Файл создан: ${fileExists ? '✅' : '❌'}`);
console.log(`   • Размер: ${fileExists ? fs.statSync(testFilePath).size : 0} байт`);

// 3. Проверяем пути
console.log(`\n3. Проверка путей:`);
console.log(`   • Относительный путь: data/footprints/visualizations/clusters/test_viz.png`);
console.log(`   • Абсолютный путь: ${path.resolve('data/footprints/visualizations/clusters/test_viz.png')}`);

// 4. Проверяем что сможем прочитать
if (fileExists) {
    try {
        const content = fs.readFileSync(testFilePath, 'utf8');
        console.log(`\n4. Чтение файла: ${content.length} символов`);
        console.log('   ✅ Файл читается успешно');
    } catch (error) {
        console.log(`   ❌ Ошибка чтения: ${error.message}`);
    }
}

// 5. Проверяем метод создания визуализации
console.log(`\n5. Тестирование метода создания визуализации:`);
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

async function testVisualizationManager() {
    try {
        const manager = new SimpleFootprintManager({
            debug: true,
            enableMergeVisualization: true
        });

        console.log('   ✅ Manager создан');
       
        // Проверяем директории
        console.log(`   📁 Проверка директорий manager'а:`);
        console.log(`     • enableMergeVisualization: ${manager.config.enableMergeVisualization}`);
       
        // Проверяем метод
        if (manager.visualizeSingleFootprintConfirmations) {
            console.log(`   🎨 Метод visualizeSingleFootprintConfirmations доступен`);
           
            // Создаем тестовый отпечаток
            const SimpleFootprint = require('./modules/footprint/simple-footprint');
            const testFootprint = new SimpleFootprint({
                userId: 'test_user',
                name: 'Тестовый отпечаток'
            });
           
            // Добавляем тестовые точки
            testFootprint.pointTracker = {
                points: new Map([
                    ['pt1', { x: 100, y: 100, confirmedCount: 1 }],
                    ['pt2', { x: 200, y: 200, confirmedCount: 2 }]
                ])
            };
           
            console.log(`   📊 Тестовый отпечаток создан: ${testFootprint.pointTracker.points.size} точек`);
           
            // Пробуем создать визуализацию
            try {
                const result = await manager.visualizeSingleFootprintConfirmations(
                    testFootprint,
                    'test_user',
                    { rotationAngle: 0 }
                );
               
                console.log(`   🎯 Результат визуализации:`);
                console.log(`     • success: ${result.success}`);
                console.log(`     • path: ${result.path}`);
                console.log(`     • file exists: ${result.path && fs.existsSync(result.path) ? '✅' : '❌'}`);
               
                if (result.path && fs.existsSync(result.path)) {
                    console.log(`     • size: ${fs.statSync(result.path).size} байт`);
                }
               
            } catch (vizError) {
                console.log(`   ❌ Ошибка создания визуализации: ${vizError.message}`);
            }
        } else {
            console.log(`   ❌ Метод visualizeSingleFootprintConfirmations недоступен`);
        }
       
    } catch (error) {
        console.log(`   ❌ Ошибка создания manager: ${error.message}`);
    }
}

// Запускаем тест
testVisualizationManager().then(() => {
    console.log(`\n✅ Тест завершен!`);
   
    // Убираем тестовый файл
    if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
        console.log(`🗑 Тестовый файл удален`);
    }
});
