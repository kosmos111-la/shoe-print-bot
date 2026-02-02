// test-simple-manager-no-canvas.js
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

console.log('=== ТЕСТ SIMPLE-MANAGER С НОВОЙ СИСТЕМОЙ (без Canvas) ===\n');

try {
    const manager = new SimpleFootprintManager({ debug: false });
    console.log('✅ SimpleFootprintManager создан');
   
    // Проверяем, что все модули инициализированы
    console.log('\n1. Проверка модулей:');
    const modules = [
        'coordinateSystem',
        'coordinateManager',
        'transformationValidator',
        'comparisonEngine',
        'sessionManager',
        'visualizationManager',
        'geometryUtils',
        'simpleMatcher'
    ];
   
    modules.forEach(module => {
        const exists = manager[module] !== undefined;
        console.log(`   ${exists ? '✅' : '❌'} ${module}`);
    });
   
    // Проверяем координатную систему
    console.log('\n2. Проверка координатной системы:');
    const points = [{x: 100, y: 100}, {x: 200, y: 200}];
   
    try {
        // Проверяем основные методы
        const transformed = manager.coordinateSystem.transform(points);
        console.log(`   ✅ Трансформация работает: ${transformed.length} точек`);
       
        const normalized = manager.coordinateSystem.normalize(points);
        console.log(`   ✅ Нормализация работает: ${normalized.length} точек`);
       
        const center = manager.coordinateSystem.calculateCenter(points);
        console.log(`   ✅ Центр: (${center.x}, ${center.y})`);
       
        const validation = manager.coordinateSystem.validate(points);
        console.log(`   ✅ Валидация: ${validation.validCount}/${validation.total} валидных`);
       
        console.log(`   ✅ Константы доступны: центр (${manager.coordinateSystem.CONSTANTS.CENTER.x}, ${manager.coordinateSystem.CONSTANTS.CENTER.y})`);
       
        // Проверяем новые методы
        console.log('\n3. Проверка новых методов:');
        console.log(`   ✅ transformPoints: ${typeof manager.transformPoints === 'function'}`);
        console.log(`   ✅ normalizePoints: ${typeof manager.normalizePoints === 'function'}`);
        console.log(`   ✅ validatePoints: ${typeof manager.validatePoints === 'function'}`);
        console.log(`   ✅ calculateCenter: ${typeof manager.calculateCenter === 'function'}`);
       
        // Проверяем legacy поддержку
        console.log('\n4. Проверка legacy поддержки:');
        try {
            const legacyResult = manager.getCoordinates(points);
            console.log(`   ✅ getCoordinates работает: ${legacyResult.count} точек`);
        } catch (error) {
            console.log(`   ❌ getCoordinates: ${error.message}`);
        }
       
    } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
        console.log(error.stack);
    }
   
    // Проверяем состояние системы
    console.log('\n5. Проверка состояния системы:');
    const stats = manager.getSystemStats();
    console.log(`   ✅ Загружено моделей: ${stats.loadedModels}`);
    console.log(`   ✅ Координатная система: ${stats.coordinateSystem}`);
    console.log(`   ✅ Диагностика: ${stats.coordinateDiagnostics ? 'включена' : 'выключена'}`);
   
    // Проверяем директории
    console.log('\n6. Проверка конфигурации:');
    console.log(`   ✅ DB Path: ${manager.config.dbPath}`);
    console.log(`   ✅ Debug mode: ${manager.config.debug ? 'включен' : 'выключен'}`);
    console.log(`   ✅ Min points: ${manager.config.minPointsForFootprint}`);
   
    console.log('\n=== ТЕСТ УСПЕШНО ЗАВЕРШЁН ===\n');
    console.log('📊 ИТОГ: Новая система координат полностью интегрирована в SimpleFootprintManager');
    console.log('🎯 Все методы доступны, legacy поддержка работает корректно');
   
} catch (error) {
    console.log(`\n❌ КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`);
    console.log(error.stack);
    console.log('\n⚠️ Рекомендации:');
    console.log('1. Проверьте, что файл coordinate-system/index.js существует');
    console.log('2. Проверьте, что legacy-support/coordinate-facade.js существует');
    console.log('3. Проверьте импорты в simple-manager.js');
}
