// test-alignment.js
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

async function testAlignment() {
    console.log('🧪 ЗАПУСК ТЕСТА ВЫРАВНИВАНИЯ\n');
   
    const manager = new SimpleFootprintManager({
        debug: true,
        dbPath: './data/footprints'
    });
   
    // 1. Получаем существующие отпечатки из сессий
    // (нужно адаптировать под вашу структуру данных)
   
    // 2. Или создаем тестовые отпечатки
    // 3. Тестируем выравнивание
   
    console.log('\n✅ ТЕСТ ЗАВЕРШЕН');
}

// Запускаем тест
testAlignment().catch(console.error);
