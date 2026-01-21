// quick-check.js
console.log('🔍 Быстрая проверка системы...\n');

// Проверяем основные файлы
const files = [
    'modules/footprint/simple-footprint.js',
    'modules/footprint/simple-manager.js',
    'modules/footprint/rotation-invariance.js',
    'modules/footprint/core/comparison/footprint-comparison-engine.js',
    'modules/footprint/core/comparison/template-coordination.js'
];

files.forEach(file => {
    try {
        require(`./${file}`);
        console.log(`✅ ${file} - ОК`);
    } catch (error) {
        console.log(`❌ ${file} - ${error.message.split('\n')[0]}`);
       
        // Если это синтаксическая ошибка, показываем детали
        if (error.message.includes('Unexpected token')) {
            console.log(`   Тип ошибки: СИНТАКСИС`);
        }
    }
});

console.log('\n🎯 Проверка завершена');
