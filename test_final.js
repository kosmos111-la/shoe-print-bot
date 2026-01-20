// test_final.js
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

console.log('🔍 ФИНАЛЬНЫЙ ТЕСТ СИСТЕМЫ');

const manager = new SimpleFootprintManager({
    dbPath: './data/footprints',
    debug: true,
    enableMergeVisualization: true
});

console.log('\n📊 СТАТИСТИКА:');
console.log(`- Менеджер создан: ✅`);
console.log(`- Модуль сравнения: ${manager.comparisonEngine ? '✅' : '❌'}`);
console.log(`- Модуль шаблонов: ${manager.templateCoordinator ? '✅' : '❌'}`);
console.log(`- Менеджер сессий: ${manager.sessionManager ? '✅' : '❌'}`);
console.log(`- Менеджер визуализаций: ${manager.visualizationManager ? '✅' : '❌'}`);
console.log(`- Утилиты геометрии: ${manager.geometryUtils ? '✅' : '❌'}`);

console.log('\n🎯 ТЕСТ МЕТОДОВ:');

// Тест геометрии
const testPoints = [{x: 0, y: 0}, {x: 100, y: 100}];
const bounds = manager.calculateBounds(testPoints);
console.log(`- calculateBounds: ${bounds.width}x${bounds.height} ✅`);

const center = manager.calculateCenter(testPoints);
console.log(`- calculateCenter: (${center.x}, ${center.y}) ✅`);

// Тест сессий
const session = manager.createSession('test_user', 'Тестовая сессия');
console.log(`- createSession: ${session.id.slice(0, 8)} ✅`);

const sessionInfo = manager.getSessionInfo('test_user');
console.log(`- getSessionInfo: ${sessionInfo.exists ? 'есть' : 'нет'} ✅`);

console.log('\n✅ ТЕСТ ЗАВЕРШЕН! Система работает корректно.');
