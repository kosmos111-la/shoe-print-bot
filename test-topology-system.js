// test-topology-system.js
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

async function testTopologySystem() {
    console.log('🧪 Тестирование топологической системы...');
   
    const manager = new SimpleFootprintManager({
        dbPath: './data/footprints',
        enableTopologySuperModel: true,
        debug: true
    });
   
    // 1. Тест топологического слияния
    console.log('\n1. Тест топологического слияния:');
    await manager.testTopologyMerge();
   
    // 2. Создание структурной супер-модели (если есть данные)
    const users = Array.from(manager.userModels.keys());
    if (users.length > 0) {
        console.log('\n2. Создание структурной супер-модели:');
        const userId = users[0];
        const userModels = manager.getUserModels(userId);
       
        if (userModels.length >= 3) {
            const result = await manager.createStructuralSuperModel(userId);
            console.log('Результат:', result.success ? '✅ Успех' : '❌ Ошибка');
            if (result.success) {
                console.log('   ID:', result.superModelId);
                console.log('   Визуализация:', result.visualization);
            }
        } else {
            console.log('⚠️ У пользователя недостаточно моделей для супер-модели');
        }
    }
   
    // 3. Статистика системы
    console.log('\n3. Статистика системы:');
    const stats = manager.getSystemStats();
    console.log('   Топологических супер-моделей:', stats.storage.topologySuperModels);
    console.log('   Топологических слияний:', stats.performance.topologicalMerges);
}

// Запуск теста
if (require.main === module) {
    testTopologySystem().catch(console.error);
}
