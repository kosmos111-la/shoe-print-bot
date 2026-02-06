// test-manager-realistic.js
// 🧪 ТЕСТ С РЕАЛИСТИЧНЫМИ ВЕКТОРНЫМИ ДАННЫМИ

const CleanFootprintManager = require('./modules/footprint/clean/manager');
const RealisticVectorData = require('./test-realistic-vector-data');

async function testWithRealisticData() {
    console.log('🎯 ТЕСТ С РЕАЛИСТИЧНЫМИ ВЕКТОРНЫМИ ДАННЫМИ\n');
    console.log('📌 Входные данные: векторные координаты от системы детекции\n');
   
    // 1. Создаём менеджер
    const manager = new CleanFootprintManager({
        debug: true,
        similarityThreshold: 0.6
    });
   
    console.log('1. 📸 ТЕСТ 1: Первое фото следа');
    console.log('='.repeat(60));
   
    // 🔥 РЕАЛИСТИЧНЫЕ ДАННЫЕ: как от детектора
    const trace1 = RealisticVectorData.createRealisticShoePrint({
        pointCount: 14,
        width: 180,
        height: 320,
        noiseLevel: 2,
        confidence: 0.85
    });
   
    console.log(`   Получено от детектора: ${trace1.length} точек`);
    console.log(`   Координаты: от (${trace1[0].x.toFixed(1)}, ${trace1[0].y.toFixed(1)}) до (${trace1[trace1.length-1].x.toFixed(1)}, ${trace1[trace1.length-1].y.toFixed(1)})`);
   
    const result1 = await manager.addPhoto('user_realistic', trace1, {
        id: 'detection_001',
        source: 'robokit_detector',
        timestamp: new Date().toISOString()
    });
   
    console.log('   Результат:', result1.message);
   
    console.log('\n2. 📸 ТЕСТ 2: То же самое место, другой ракурс (+шум)');
    console.log('='.repeat(60));
   
    // Тот же след, но:
    // 1. Поворот на 15°
    // 2. Добавлен шум
    // 3. Случайный порядок точек (как при детекции)
    let trace2 = RealisticVectorData.rotatePoints(trace1, 15);
    trace2 = RealisticVectorData.addNoise(trace2, 3);
   
    // 🔥 ИМИТАЦИЯ РЕАЛЬНОСТИ: перемешиваем точки (детектор не гарантирует порядок!)
    trace2.sort(() => Math.random() - 0.5);
   
    console.log(`   Точек: ${trace2.length}, поворот: 15°, шум: 3px`);
    console.log(`   ID точек изменились: ${trace1[0].id} → ${trace2[0].id}`);
    console.log(`   Но originalId сохранены для сравнения`);
   
    const result2 = await manager.addPhoto('user_realistic', trace2, {
        id: 'detection_002',
        source: 'robokit_detector',
        timestamp: new Date().toISOString()
    });
   
    console.log('   Результат:', result2.message);
    console.log('   Схожесть:', result2.similarity ? `${(result2.similarity * 100).toFixed(1)}%` : 'N/A');
    console.log('   Ожидается: СОВПАДЕНИЕ (тот же след, немного повернут)');
   
    console.log('\n3. 📸 ТЕСТ 3: Частичный след (не все точки видны)');
    console.log('='.repeat(60));
   
    // Частичный след (25% точек не детектировалось)
    const trace3 = RealisticVectorData.createPartialShoePrint(trace1, 0.25);
   
    console.log(`   Полный след: ${trace1.length} точек`);
    console.log(`   Частичный след: ${trace3.length} точек (пропущено ${trace1.length - trace3.length})`);
   
    const result3 = await manager.addPhoto('user_realistic', trace3, {
        id: 'detection_003',
        source: 'robokit_detector',
        timestamp: new Date().toISOString(),
        note: 'Частичная видимость'
    });
   
    console.log('   Результат:', result3.message);
    console.log('   Схожесть:', result3.similarity ? `${(result3.similarity * 100).toFixed(1)}%` : 'N/A');
    console.log('   Ожидается: СОВПАДЕНИЕ (части того же следа)');
   
    console.log('\n4. 📸 ТЕСТ 4: Совсем другой след');
    console.log('='.repeat(60));
   
    // Другой след (другой размер, форма)
    const differentTrace = RealisticVectorData.createRealisticShoePrint({
        pointCount: 10,
        width: 150,
        height: 280,
        centerX: 800,
        centerY: 800,
        confidence: 0.9
    });
   
    console.log(`   Другой след: ${differentTrace.length} точек`);
    console.log(`   Центр смещен на (${differentTrace[0].x.toFixed(1)}, ${differentTrace[0].y.toFixed(1)})`);
   
    const result4 = await manager.addPhoto('user_realistic', differentTrace, {
        id: 'detection_004',
        source: 'robokit_detector',
        timestamp: new Date().toISOString(),
        note: 'Другой след'
    });
   
    console.log('   Результат:', result4.message);
    console.log('   Ожидается: НОВЫЙ ОТПЕЧАТОК (совсем другой след)');
   
    console.log('\n5. 📊 СТАТИСТИКА И АНАЛИЗ');
    console.log('='.repeat(60));
   
    const footprint = manager.getFootprint('user_realistic');
    if (footprint) {
        console.log(`👣 Отпечаток пользователя: ${footprint.name}`);
        console.log(`📊 Всего точек: ${footprint.originalPoints.length}`);
        console.log(`📸 Фото в истории: ${footprint.photos.length}`);
        console.log(`🎯 Среднее подтверждений: ${footprint.stats.avgConfirmations.toFixed(2)}`);
       
        // Проверяем геометрические дескрипторы
        console.log('\n🔬 ГЕОМЕТРИЧЕСКИЙ АНАЛИЗ:');
        const GeometricAlgorithm = require('./modules/footprint/clean/geometric-hash-algorithm');
        const geoAlgo = new GeometricAlgorithm({ debug: false });
       
        const geoPoints = footprint.getComparisonPoints();
        const geoFootprint = geoAlgo.createFootprint(geoPoints, 'user_footprint');
       
        if (geoFootprint.length > 0) {
            const point = geoFootprint[0];
            console.log(`   Первая точка: ${point.originalId}`);
            console.log(`   Дескриптор: ${point.descriptor.hashes.signature}`);
            console.log(`   Треугольников: ${point.triangles.length}`);
        }
    }
   
    console.log('\n✅ ТЕСТ ЗАВЕРШЕН');
}

// Запускаем
testWithRealisticData().catch(console.error);
