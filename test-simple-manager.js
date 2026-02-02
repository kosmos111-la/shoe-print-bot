// test-simple-manager.js
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

console.log('=== ТЕСТ SIMPLE-MANAGER С НОВОЙ СИСТЕМОЙ ===\n');

try {
    const manager = new SimpleFootprintManager();
    console.log('✅ SimpleFootprintManager создан');
   
    // Проверяем, что все модули инициализированы
    console.log('\n1. Проверка модулей:');
    const modules = [
        'coordinateSystem', 'coordinateManager', 'sessionManager',
        'visualizationManager', 'geometryUtils', 'simpleMatcher'
    ];
   
    modules.forEach(module => {
        const exists = manager[module] !== undefined;
        console.log(`   ${exists ? '✅' : '❌'} ${module}`);
    });
   
    // Проверяем координатную систему
    console.log('\n2. Проверка координатной системы:');
    const points = [{x: 100, y: 100}, {x: 200, y: 200}];
   
    try {
        const transformed = manager.coordinateSystem.transformPoints(points);
        console.log(`   ✅ Трансформация работает: ${transformed.length} точек`);
       
        const center = manager.coordinateSystem.calculateCenter(points);
        console.log(`   ✅ Центр: (${center.x}, ${center.y})`);
       
        console.log(`   ✅ Константы: центр в (${manager.coordinateSystem.CONSTANTS.CENTER.x}, ${manager.coordinateSystem.CONSTANTS.CENTER.y})`);
    } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
    }
   
    console.log('\n=== ТЕСТ УСПЕШНО ЗАВЕРШЁН ===');
   
} catch (error) {
    console.log(`❌ Критическая ошибка: ${error.message}`);
    console.log(error.stack);
}
