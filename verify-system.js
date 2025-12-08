// verify-system.js
console.log('🔍 ПРОВЕРЯЮ СИСТЕМУ ПЕРЕД ЗАПУСКОМ...\n');

// Проверим структуру папок
const fs = require('fs');
const path = require('path');

console.log('1. ПРОВЕРКА СТРУКТУРЫ ПАПОК:');
const requiredFolders = [
    './data',
    './data/footprints',
    './modules/footprint',
    './temp'
];

requiredFolders.forEach(folder => {
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        console.log(`   📁 Создана папка: ${folder}`);
    } else {
        console.log(`   ✅ Папка существует: ${folder}`);
    }
});

console.log('\n2. ПРОВЕРКА ФАЙЛОВ МОДУЛЕЙ:');
const requiredFiles = [
    './modules/footprint/simple-graph.js',
    './modules/footprint/simple-footprint.js',
    './modules/footprint/simple-matcher.js',
    './modules/footprint/simple-manager.js'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✅ Файл существует: ${file}`);
    } else {
        console.log(`   ❌ Файл отсутствует: ${file}`);
        allFilesExist = false;
    }
});

console.log('\n3. ПРОВЕРКА ЗАГРУЗКИ МОДУЛЕЙ:');
try {
    const SimpleGraph = require('./modules/footprint/simple-graph');
    const SimpleFootprint = require('./modules/footprint/simple-footprint');
    const SimpleGraphMatcher = require('./modules/footprint/simple-matcher');
    const SimpleFootprintManager = require('./modules/footprint/simple-manager');
   
    console.log('   ✅ Все модули загружаются без ошибок');
   
    // Быстрая проверка создания менеджера
    console.log('\n4. ТЕСТИРУЮ СОЗДАНИЕ МЕНЕДЖЕРА:');
    const testManager = new SimpleFootprintManager({
        dbPath: './data/test-verify',
        autoAlignment: true,
        debug: false
    });
   
    console.log('   ✅ Менеджер создан успешно');
    console.log(`   📁 База данных: ${testManager.config.dbPath}`);
    console.log(`   🎯 Автосовмещение: ${testManager.config.autoAlignment ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);
   
    // Очистка
    if (fs.existsSync('./data/test-verify')) {
        fs.rmSync('./data/test-verify', { recursive: true, force: true });
        console.log('\n   🧹 Удалена тестовая папка');
    }
   
    console.log('\n🎉 СИСТЕМА ГОТОВА К РАБОТЕ!');
    console.log('\n🚀 КОМАНДЫ ДЛЯ ТЕСТИРОВАНИЯ:');
    console.log('1. /footprint_start - начать сессию');
    console.log('2. Отправь фото следа обуви');
    console.log('3. /footprint_save "Моя модель" - сохранить');
    console.log('4. /my_footprints - посмотреть модели');
    console.log('5. /footprint_stats - статистика');
   
} catch (error) {
    console.log(`❌ ОШИБКА ПРИ ПРОВЕРКЕ: ${error.message}`);
    console.log(error.stack);
}
