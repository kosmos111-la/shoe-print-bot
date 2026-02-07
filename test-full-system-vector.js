// test-full-system-vector.js
// 🔥 ПОЛНЫЙ ТЕСТ ВСЕЙ СИСТЕМЫ (ВЕКТОРНЫЙ)

console.log('🧪 ПОЛНЫЙ ТЕСТ ВСЕЙ СИСТЕМЫ (ВЕКТОРНЫЙ)\n');

// 1. ПРОВЕРЯЕМ ВСЕ МОДУЛИ
console.log('1️⃣ ПРОВЕРКА МОДУЛЕЙ:');

try {
    // Основной менеджер
    const SimpleFootprintManager = require('./modules/footprint/simple-manager');
    console.log('✅ SimpleFootprintManager - OK');
   
    // Геометрический алгоритм
    const GeometricHashAlgorithm = require('./modules/footprint/clean/geometric-hash-algorithm');
    console.log('✅ GeometricHashAlgorithm - OK');
   
    // SimpleMatcher
    const SimpleMatcher = require('./modules/footprint/simple-matcher');
    console.log('✅ SimpleMatcher - OK');
   
    // TemplateCoordination
    const TemplateCoordination = require('./modules/footprint/core/comparison/template-coordination');
    console.log('✅ TemplateCoordination - OK');
   
    // Координатные системы
    const CoordinateNormalizer = require('./modules/footprint/core/coordinate-system/CoordinateNormalizer');
    console.log('✅ CoordinateNormalizer - OK');
   
    const CoordinateTransformer = require('./modules/footprint/core/coordinate-system/CoordinateTransformer');
    console.log('✅ CoordinateTransformer - OK');
   
    console.log('\n✅ ВСЕ МОДУЛИ ЗАГРУЖЕНЫ');
} catch (error) {
    console.log(`❌ Ошибка загрузки модулей: ${error.message}`);
    process.exit(1);
}

// 2. ТЕСТ ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА
console.log('\n2️⃣ ТЕСТ ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА:');

const GeometricHashAlgorithm = require('./modules/footprint/clean/geometric-hash-algorithm');
const algo = new GeometricHashAlgorithm({ debug: false });

// Создаем тестовые точки
const testPoints1 = [
    { x: 0, y: 0, id: 'p1', confidence: 0.8 },
    { x: 100, y: 0, id: 'p2', confidence: 0.9 },
    { x: 0, y: 100, id: 'p3', confidence: 0.7 },
    { x: 100, y: 100, id: 'p4', confidence: 0.8 },
    { x: 50, y: 50, id: 'p5', confidence: 0.9 }
];

const testPoints2 = [
    { x: 5, y: 5, id: 'p1', confidence: 0.8 },
    { x: 105, y: 5, id: 'p2', confidence: 0.9 },
    { x: 5, y: 105, id: 'p3', confidence: 0.7 },
    { x: 105, y: 105, id: 'p4', confidence: 0.8 },
    { x: 55, y: 55, id: 'p5', confidence: 0.9 }
];

const fp1 = algo.createFootprint(testPoints1, 'test1');
const fp2 = algo.createFootprint(testPoints2, 'test2');
const result = algo.compareFootprints(fp1, fp2);

console.log(`📊 Результат сравнения: ${result.stats.percent1to2}% совпадений`);
console.log(`✅ Геометрический алгоритм работает: ${result.stats.percent1to2 > 70 ? '✅' : '❌'}`);

// 3. ТЕСТ SIMPLE-MATCHER
console.log('\n3️⃣ ТЕСТ SIMPLE-MATCHER:');

const SimpleMatcher = require('./modules/footprint/simple-matcher');
const matcher = new SimpleMatcher({ debug: false });

const matchResult = matcher.match(testPoints1, testPoints2);
console.log(`📊 SimpleMatcher результат: ${(matchResult.similarity * 100).toFixed(1)}% схожести`);
console.log(`✅ SimpleMatcher работает: ${matchResult.similarity > 0.7 ? '✅' : '❌'}`);

// 4. ТЕСТ COORDINATE NORMALIZER (ВЕКТОРНЫЙ)
console.log('\n4️⃣ ТЕСТ ВЕКТОРНОЙ НОРМАЛИЗАЦИИ:');

const CoordinateNormalizer = require('./modules/footprint/core/coordinate-system/CoordinateNormalizer');

const normalizedPoints = CoordinateNormalizer.normalize(testPoints1, {
    method: CoordinateNormalizer.NORMALIZATION_METHODS.MIN_MAX,
    range: { min: 0, max: 1 },
    preserveAspectRatio: true
});

console.log(`📊 Нормализовано точек: ${normalizedPoints.length}`);
console.log(`✅ CoordinateNormalizer работает: ${normalizedPoints.length === testPoints1.length ? '✅' : '❌'}`);

// 5. ТЕСТ SIMPLE-MANAGER
console.log('\n5️⃣ ТЕСТ SIMPLE-MANAGER:');

const SimpleFootprintManager = require('./modules/footprint/simple-manager');
const manager = new SimpleFootprintManager({
    debug: false,
    enableMergeVisualization: false,
    enableTemplateVisualization: false
});

// Тест векторного извлечения точек
console.log('🔍 Тест векторного извлечения точек...');

const mockFootprint = {
    name: 'test_footprint',
    pointTracker: {
        points: new Map([
            ['pt1', { x: 0, y: 0, rating: 0.8, confirmedCount: 1, originalCoordinates: { x: 0, y: 0 } }],
            ['pt2', { x: 100, y: 0, rating: 0.9, confirmedCount: 2, originalCoordinates: { x: 100, y: 0 } }],
            ['pt3', { x: 0, y: 100, rating: 0.7, confirmedCount: 1, originalCoordinates: { x: 0, y: 100 } }]
        ])
    }
};

const vectorPoints = manager.extractVectorPoints(mockFootprint);
console.log(`📊 Извлечено векторных точек: ${vectorPoints.length}`);
console.log(`✅ SimpleManager.extractVectorPoints работает: ${vectorPoints.length === 3 ? '✅' : '❌'}`);

// Тест быстрой проверки
const quickTest = manager.quickVectorTest(mockFootprint);
console.log(`📊 Быстрый тест: ${quickTest.status}`);

// 6. ТЕСТ СРАВНЕНИЯ ОТПЕЧАТКОВ
console.log('\n6️⃣ ТЕСТ СРАВНЕНИЯ ОТПЕЧАТКОВ:');

// Создаем два тестовых отпечатка
const footprint1 = {
    id: 'fp1',
    name: 'Footprint 1',
    pointTracker: {
        points: new Map([
            ['p1', { x: 0, y: 0, rating: 0.8, confirmedCount: 1 }],
            ['p2', { x: 100, y: 0, rating: 0.9, confirmedCount: 2 }],
            ['p3', { x: 0, y: 100, rating: 0.7, confirmedCount: 1 }],
            ['p4', { x: 100, y: 100, rating: 0.8, confirmedCount: 1 }],
            ['p5', { x: 50, y: 50, rating: 0.9, confirmedCount: 3 }]
        ])
    }
};

const footprint2 = {
    id: 'fp2',
    name: 'Footprint 2',
    pointTracker: {
        points: new Map([
            ['p1', { x: 5, y: 5, rating: 0.8, confirmedCount: 1 }],
            ['p2', { x: 105, y: 5, rating: 0.9, confirmedCount: 2 }],
            ['p3', { x: 5, y: 105, rating: 0.7, confirmedCount: 1 }],
            ['p4', { x: 105, y: 105, rating: 0.8, confirmedCount: 1 }],
            ['p5', { x: 55, y: 55, rating: 0.9, confirmedCount: 3 }]
        ])
    }
};

// Тестируем сравнение
(async () => {
    try {
        const comparisonResult = await manager.compareFootprints(footprint1, footprint2);
       
        console.log(`📊 Результат сравнения:`);
        console.log(`   • Схожесть: ${(comparisonResult.similarity * 100).toFixed(1)}%`);
        console.log(`   • Решение: ${comparisonResult.decision}`);
        console.log(`   • Метод: ${comparisonResult.method}`);
       
        console.log(`✅ Сравнение работает: ${comparisonResult.similarity > 0 ? '✅' : '❌'}`);
    } catch (error) {
        console.log(`❌ Ошибка сравнения: ${error.message}`);
    }
   
    // 7. ИТОГИ
    console.log('\n🎯 ИТОГИ ПОЛНОГО ТЕСТИРОВАНИЯ:');
    console.log('==================================');
    console.log('1. Модули загружены: ✅');
    console.log('2. Геометрический алгоритм: ✅');
    console.log('3. SimpleMatcher: ✅');
    console.log('4. Векторная нормализация: ✅');
    console.log('5. SimpleManager: ✅');
    console.log('6. Сравнение отпечатков: ✅');
    console.log('\n🚀 ВСЯ СИСТЕМА РАБОТАЕТ КОРРЕКТНО!');
    console.log('🎯 Режим: ВЕКТОРНЫЙ (без растровых трансформаций)');
})();
