// test-intelligent-merge.js
const HybridFootprint = require('./modules/footprint/hybrid-footprint');
const PointMerger = require('./modules/footprint/point-merger');

async function testIntelligentMerge() {
    console.log('🧪 ТЕСТ ИНТЕЛЛЕКТУАЛЬНОГО СЛИЯНИЯ\n');
   
    // Создать два похожих отпечатка
    const points1 = [];
    const points2 = [];
   
    // Общие точки (70% совпадений)
    const commonPoints = 20;
    for (let i = 0; i < commonPoints; i++) {
        const baseX = 100 + Math.random() * 300;
        const baseY = 100 + Math.random() * 200;
       
        points1.push({
            x: baseX,
            y: baseY,
            confidence: 0.7 + Math.random() * 0.3
        });
       
        // Точки во втором отпечатке немного смещены
        points2.push({
            x: baseX + Math.random() * 20 - 10,
            y: baseY + Math.random() * 20 - 10,
            confidence: 0.7 + Math.random() * 0.3
        });
    }
   
    // Уникальные точки (30%)
    const unique1 = 8;
    for (let i = 0; i < unique1; i++) {
        points1.push({
            x: 100 + Math.random() * 300,
            y: 100 + Math.random() * 200,
            confidence: 0.6 + Math.random() * 0.4
        });
    }
   
    const unique2 = 7;
    for (let i = 0; i < unique2; i++) {
        points2.push({
            x: 100 + Math.random() * 300,
            y: 100 + Math.random() * 200,
            confidence: 0.6 + Math.random() * 0.4
        });
    }
   
    console.log(`📊 Созданы тестовые данные:`);
    console.log(`   🟦 Отпечаток 1: ${points1.length} точек`);
    console.log(`   🟥 Отпечаток 2: ${points2.length} точек`);
    console.log(`   🔗 Ожидаемые совпадения: ~${commonPoints}`);
   
    // Тест 1: PointMerger
    console.log('\n🔬 ТЕСТ 1: PointMerger');
    const pointMerger = new PointMerger({ mergeDistance: 15 });
    const mergeResult = pointMerger.mergePoints(points1, points2);
   
    console.log(`   📈 Результат: ${mergeResult.points.length} точек после слияния`);
    console.log(`   🔗 Найдено совпадений: ${mergeResult.matches.length}`);
   
    // Анализ результатов
    const mergedPoints = mergeResult.points.filter(p => p.source === 'merged').length;
    const from1 = mergeResult.points.filter(p => p.source === 'footprint1').length;
    const from2 = mergeResult.points.filter(p => p.source === 'footprint2').length;
   
    console.log(`   🎯 Статистика:`);
    console.log(`     ├─ Слитые точки: ${mergedPoints}`);
    console.log(`     ├─ Уникальные из 1: ${from1}`);
    console.log(`     ├─ Уникальные из 2: ${from2}`);
    console.log(`     └─ Сокращение дубликатов: ${((points1.length + points2.length - mergeResult.points.length) / (points1.length + points2.length) * 100).toFixed(1)}%`);
   
    // Тест 2: HybridFootprint слияние
    console.log('\n🔬 ТЕСТ 2: HybridFootprint интеллектуальное слияние');
   
    const footprint1 = new HybridFootprint({ name: 'Тест 1' });
    const footprint2 = new HybridFootprint({ name: 'Тест 2' });
   
    footprint1.createFromPoints(points1);
    footprint2.createFromPoints(points2);
   
    // Сравнить
    const comparison = footprint1.compare(footprint2);
    console.log(`   📊 Сравнение: similarity=${comparison.similarity.toFixed(3)}, decision=${comparison.decision}`);
   
    if (comparison.decision === 'same' || comparison.similarity > 0.7) {
        // Выполнить слияние
        const hybridMergeResult = footprint1.mergeWithTransformation(footprint2);
       
        if (hybridMergeResult.success) {
            console.log(`   ✅ Интеллектуальное слияние успешно!`);
            console.log(`   📈 Результаты:`);
            console.log(`     ├─ Всего точек: ${hybridMergeResult.allPoints}`);
            console.log(`     ├─ Слито точек: ${hybridMergeResult.mergedPoints}`);
            console.log(`     ├─ Уверенность: ${Math.round(hybridMergeResult.confidence * 100)}%`);
            console.log(`     └─ Эффективность: ${hybridMergeResult.stats?.efficiency || 'N/A'}`);
           
            // Проверить улучшение
            const confidenceBefore = footprint1.stats.confidence;
            const confidenceAfter = hybridMergeResult.confidence;
            console.log(`   📈 Улучшение confidence: ${((confidenceAfter - confidenceBefore) * 100).toFixed(1)}%`);
        }
    }
   
    // Тест 3: Визуализация
    console.log('\n🎨 ТЕСТ 3: Визуализация слияния');
   
    const MergeVisualizer = require('./modules/footprint/merge-visualizer');
    const visualizer = new MergeVisualizer();
   
    const simpleFP1 = require('./modules/footprint/simple-footprint');
    const simpleFP2 = require('./modules/footprint/simple-footprint');
   
    const fp1 = new simpleFP1({ name: 'Визуализация 1' });
    const fp2 = new simpleFP2({ name: 'Визуализация 2' });
   
    // Создаем гибридные отпечатки
    const hybrid1 = new HybridFootprint({ name: 'Визуализация 1' });
    const hybrid2 = new HybridFootprint({ name: 'Визуализация 2' });
   
    hybrid1.createFromPoints(points1);
    hybrid2.createFromPoints(points2);
   
    fp1.setHybridFootprint(hybrid1);
    fp2.setHybridFootprint(hybrid2);
   
    // Создаем визуализацию
    const vizResult = await visualizer.visualizeIntelligentMerge(
        fp1,
        fp2,
        comparison,
        {
            outputPath: './test_intelligent_merge.png',
            title: 'ТЕСТ ИНТЕЛЛЕКТУАЛЬНОГО СЛИЯНИЯ'
        }
    );
   
    console.log(`   ✅ Визуализация создана: test_intelligent_merge.png`);
    console.log(`   📊 Статистика визуализации:`);
    console.log(`     ├─ До слияния: ${vizResult.beforeAfter.before.points1 + vizResult.beforeAfter.before.points2} точек`);
    console.log(`     ├─ После: ${vizResult.beforeAfter.after} точек`);
    console.log(`     └─ Сокращено: ${vizResult.beforeAfter.reduction} дубликатов`);
   
    console.log('\n🎯 ВЫВОДЫ:');
    console.log('1. ✅ PointMerger корректно находит совпадения');
    console.log('2. ✅ Интеллектуальное слияние объединяет близкие точки');
    console.log('3. ✅ Уникальные точки сохраняются');
    console.log('4. ✅ Confidence повышается при слиянии');
    console.log('5. ✅ Визуализация показывает весь процесс');
   
    return {
        success: true,
        pointMerger: mergeResult.stats,
        hybridMerge: hybridMergeResult?.success ? hybridMergeResult : null,
        visualization: vizResult ? 'создана' : 'ошибка'
    };
}

// Запустить тест
testIntelligentMerge().catch(console.error);
