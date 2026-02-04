// test-viz-path-check.js
console.log('🧪 Проверка передачи vizPath в результатах...\n');

// Создаем моковый результат, который возвращает addPhotoToSession
const mockResult = {
    success: true,
    nodesAdded: 58,
    hasMergeVisualization: false,
    mergeMethod: undefined,
    similarity: 0.9793095731765225,
    decision: 'same',
    // 🔥 ВАЖНО: vizPath есть в результатах
    vizPath: 'data/footprints/visualizations/clusters/real_confirmations_699140291_1770202838858.png'
};

console.log('1. Проверка наличия vizPath в результате:');
console.log('   • vizPath exists:', !!mockResult.vizPath);
console.log('   • vizPath:', mockResult.vizPath);
console.log('   • hasVisualization:', mockResult.hasVisualization || !!mockResult.vizPath);

// Типичная ошибка: проверка не на тот ключ
console.log('\n2. Типичные ошибки проверки:');
console.log('   • "visualizationPath" in result:', 'visualizationPath' in mockResult); // false
console.log('   • "imagePath" in result:', 'imagePath' in mockResult); // false
console.log('   • "path" in result:', 'path' in mockResult); // false
console.log('   • "vizPath" in result:', 'vizPath' in mockResult); // true ✅

// Правильная проверка
console.log('\n3. Правильная проверка:');
const hasViz = mockResult.vizPath || mockResult.visualizationPath || mockResult.imagePath || mockResult.path;
console.log('   • Объединенная проверка:', hasViz);

// Проверка существования файла (для реального кода)
console.log('\n4. Проверка существования файла:');
const fs = require('fs');
const pathExists = fs.existsSync(mockResult.vizPath);
console.log('   • Файл существует:', pathExists);

if (!pathExists) {
    console.log('   ⚠️ Файл не найден. Проверьте путь:');
    console.log('     Полный путь:', require('path').resolve(mockResult.vizPath));
   
    // Проверяем директорию
    const dir = require('path').dirname(mockResult.vizPath);
    console.log('     Директория существует:', fs.existsSync(dir));
   
    if (!fs.existsSync(dir)) {
        console.log('     📁 Создаем директорию...');
        fs.mkdirSync(dir, { recursive: true });
    }
}

console.log('\n✅ Тест завершен!');
