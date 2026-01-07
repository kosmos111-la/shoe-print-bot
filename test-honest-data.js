// test-honest-data.js
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

async function testHonestData() {
    console.log('🧪 Тестируем честные данные в продакшене...\n');

    const manager = new SimpleFootprintManager({
        dbPath: './data/footprints',
        debug: true
    });

    // Получаем существующую сессию
    const userId = 699140291; // Из ваших логов
    const session = manager.getActiveSession(userId);

    if (session && session.currentFootprint) {
        const footprint = session.currentFootprint;

        console.log('📊 ИНФОРМАЦИЯ О ТЕКУЩЕМ ОТПЕЧАТКЕ:');
        console.log(`• Имя: ${footprint.name}`);
        console.log(`• ID: ${footprint.id}`);
        console.log(`• Узлов в графе: ${footprint.graph.nodes.size}`);
        console.log(`• Всего фото: ${footprint.metadata.totalPhotos}`);

        // Проверяем PointTracker
        if (footprint.pointTracker) {
            const tracker = footprint.pointTracker;
            console.log('\n🎯 POINT TRACKER СТАТИСТИКА:');
            console.log(`• Всего точек: ${tracker.points.size}`);

            // Считаем подтверждения
            const stats = {
                confirmed2: 0, // 2+ фото
                confirmed1: 0, // 1 фото
                confirmed0: 0  // 0 фото
            };

            for (const [id, point] of tracker.points) {
                const confirmations = point.confirmedCount || 0;
                if (confirmations >= 2) stats.confirmed2++;
                else if (confirmations >= 1) stats.confirmed1++;
                else stats.confirmed0++;
            }

            console.log(`• 2+ подтверждений (красные): ${stats.confirmed2}`);
            console.log(`• 1 подтверждение (синие): ${stats.confirmed1}`);
            console.log(`• 0 подтверждений (серые): ${stats.confirmed0}`);

            // Выводим детальную информацию о 5 точках
            console.log('\n🔍 ПЕРВЫЕ 5 ТОЧЕК:');
            let count = 0;
            for (const [id, point] of tracker.points) {
                if (count >= 5) break;

                console.log(`  Точка ${id}:`);
                console.log(`    • Координаты: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
                console.log(`    • Подтверждений: ${point.confirmedCount || 0}`);
                console.log(`    • Рейтинг: ${point.rating?.toFixed(3) || 'N/A'}`);
                console.log(`    • Кластер: ${point.clusterData ? 'да' : 'нет'}`);
                console.log(`    • История: ${point.history?.length || 0} записей`);
                console.log('');
                count++;
            }
        }

        // Проверяем методы
        console.log('\n🛠️  ДОСТУПНЫЕ МЕТОДЫ:');
        console.log(`• addAnalysisHonest: ${typeof footprint.addAnalysisHonest}`);
        console.log(`• getHonestVisualizationData: ${typeof footprint.getHonestVisualizationData}`);
        console.log(`• getConfirmationStats: ${typeof footprint.getConfirmationStats}`);

        // Получаем честные данные
        if (footprint.getHonestVisualizationData) {
            const honestData = footprint.getHonestVisualizationData();
            console.log('\n📈 ЧЕСТНЫЕ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ:');
            console.log(`• Всего точек: ${honestData.confirmationsInfo.totalPoints}`);
            console.log(`• Красных (2+): ${honestData.confirmationsInfo.confirmed2}`);
            console.log(`• Синих (1): ${honestData.confirmationsInfo.confirmed1}`);
            console.log(`• Серых (0): ${honestData.confirmationsInfo.confirmed0}`);
        }

        // Получаем векторную модель
        const vectorModel = manager.getVectorSuperModel(userId);
        if (vectorModel) {
            console.log('\n🏗️  ВЕКТОРНАЯ СУПЕР-МОДЕЛЬ:');
            const info = vectorModel.getInfo();
            console.log(`• Имя: ${info.name}`);
            console.log(`• Ячеек шаблона: ${info.template?.cells?.total || 0}`);
            console.log(`• Подтвержденных ячеек: ${info.template?.cells?.confirmed || 0}`);
            console.log(`• Среднее подтверждений: ${info.stats?.avgConfirmations?.toFixed(2) || '0.00'}`);
        }

    } else {
        console.log('❌ Нет активной сессии для пользователя', userId);
    }
}

testHonestData().catch(console.error);
