const SimpleFootprintManager = require('./modules/footprint/simple-manager');

async function testSuperModelIntegration() {
    console.log('🧪 ТЕСТ ИНТЕГРАЦИИ СУПЕР-МОДЕЛИ...\n');
   
    // Создать менеджер
    const manager = new SimpleFootprintManager({
        dbPath: './test_db_super',
        debug: true,
        enableIntelligentMerge: true,
        enableSuperModel: true,
        superModelConfidenceThreshold: 0.7
    });
   
    // Создать тестовые данные (2 модели с 30 точками каждая)
    const userId = 'test_user_123';
   
    // Создать сессию
    const session = manager.createSession(userId, 'Тестовая сессия для супер-модели');
   
    // Создать несколько тестовых моделей
    const testModels = [];
   
    for (let i = 0; i < 3; i++) {
        const footprint = new (require('./modules/footprint/simple-footprint'))({
            name: `Тестовая модель ${i+1}`,
            userId: userId
        });
       
        // Создать тестовые точки
        const points = [];
        for (let j = 0; j < 30; j++) {
            points.push({
                x: 100 + Math.random() * 300,
                y: 100 + Math.random() * 200,
                confidence: 0.7 + Math.random() * 0.3
            });
        }
       
        // Добавить гибридный отпечаток
        const hybrid = new (require('./modules/footprint/hybrid-footprint'))({
            name: `Тестовая гибридная ${i+1}`
        });
        hybrid.createFromPoints(points);
       
        footprint.setHybridFootprint(hybrid);
        footprint.originalPoints = points;
       
        // Сохранить модель
        manager.saveModel(footprint);
        testModels.push(footprint);
       
        console.log(`✅ Создана тестовая модель ${i+1}: ${points.length} точек`);
    }
   
    // Попробовать создать супер-модель
    console.log('\n🌟 ПРОБУЮ СОЗДАТЬ СУПЕР-МОДЕЛЬ...');
   
    const superModelResult = await manager.tryCreateSuperModel(
        session,
        userId,
        null, // без бота для теста
        null
    );
   
    if (superModelResult?.success) {
        console.log('\n🎉 СУПЕР-МОДЕЛЬ УСПЕШНО СОЗДАНА!');
        console.log(`📊 Результаты:`);
        console.log(`   ID: ${superModelResult.superModelId}`);
        console.log(`   Название: ${superModelResult.superModelName}`);
        console.log(`   Моделей объединено: ${superModelResult.mergedModels}`);
        console.log(`   Всего точек: ${superModelResult.totalPoints}`);
        console.log(`   Уверенность: ${superModelResult.confidence}`);
       
        // Проверить файл визуализации
        const fs = require('fs');
        if (fs.existsSync(superModelResult.visualizationPath)) {
            console.log(`   🎨 Визуализация создана: ${superModelResult.visualizationPath}`);
        }
    } else {
        console.log('❌ Не удалось создать супер-модель');
    }
   
    // Очистить тестовую базу
    const fs = require('fs');
    if (fs.existsSync('./test_db_super')) {
        fs.rmSync('./test_db_super', { recursive: true });
        console.log('\n🧹 Тестовая база очищена');
    }
}

// Запустить тест
testSuperModelIntegration().catch(console.error);
