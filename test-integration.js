// test-integration.js
const FootprintManager = require('./modules/footprint/footprint-manager');

async function testIntegration() {
    console.log('🧪 Тестируем интеграцию топологической коррекции\n');
   
    try {
        // Инициализируем менеджер
        await FootprintManager.initialize();
        console.log('✅ FootprintManager инициализирован');
       
        // Получаем статистику
        const stats = await FootprintManager.getStats();
        console.log('📊 Статистика базы:', stats);
       
        // Проверяем, что метод существует
        if (typeof FootprintManager.findSimilarWithTopologyCorrection === 'function') {
            console.log('✅ Метод findSimilarWithTopologyCorrection доступен');
        } else {
            console.log('❌ Метод findSimilarWithTopologyCorrection не найден');
            return false;
        }
       
        console.log('\n🎉 Интеграция готова к использованию!');
        console.log('\n💡 Следующие шаги:');
        console.log('1. Добавить команду в main.js');
        console.log('2. Протестировать на реальных данных');
        console.log('3. Настроить коэффициенты под реальные сценарии');
       
        return true;
       
    } catch (error) {
        console.log('❌ Ошибка теста интеграции:', error.message);
        return false;
    }
}

// Запускаем тест
if (require.main === module) {
    testIntegration().then(success => {
        if (success) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    });
}
