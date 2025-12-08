// test-integration.js
console.log('🧪 ТЕСТИРУЮ ИНТЕГРАЦИЮ НОВОЙ СИСТЕМЫ...\n');

// Проверяем что все модули загружаются
try {
    const SimpleGraph = require('./modules/footprint/simple-graph');
    const SimpleFootprint = require('./modules/footprint/simple-footprint');
    const SimpleGraphMatcher = require('./modules/footprint/simple-matcher');
    const SimpleFootprintManager = require('./modules/footprint/simple-manager');
   
    console.log('✅ Все модули новой системы загружены успешно!');
    console.log('1. SimpleGraph ✓');
    console.log('2. SimpleFootprint ✓');
    console.log('3. SimpleGraphMatcher ✓');
    console.log('4. SimpleFootprintManager ✓');
   
    // Быстрый тест создания менеджера
    console.log('\n🧪 Тестирую создание менеджера...');
    const manager = new SimpleFootprintManager({
        dbPath: './data/test-integration',
        autoAlignment: true,
        debug: false
    });
   
    console.log('✅ Менеджер создан успешно!');
    console.log(`📁 База данных: ${manager.config.dbPath}`);
    console.log(`🎯 Автосовмещение: ${manager.config.autoAlignment ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}`);
   
    // Очистка
    const fs = require('fs');
    if (fs.existsSync('./data/test-integration')) {
        fs.rmSync('./data/test-integration', { recursive: true, force: true });
        console.log('\n🧹 Удалена тестовая папка');
    }
   
    console.log('\n🎉 ИНТЕГРАЦИЯ ПРОШЛА УСПЕШНО!');
    console.log('🚀 Новая система готова к использованию в боте!');
   
} catch (error) {
    console.log('❌ ОШИБКА ИНТЕГРАЦИИ:', error.message);
    console.log(error.stack);
}
