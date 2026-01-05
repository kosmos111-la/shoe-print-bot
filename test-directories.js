// test-directories.js
const fs = require('fs');
const path = require('path');

console.log('🧪 Тест создания директорий...\n');

const testPaths = [
    './data/footprints/visualizations/templates',
    './data/visualizations/templates',
    './data/footprints/visualizations',
    './data/footprints',
    './data'
];

testPaths.forEach(testPath => {
    const resolvedPath = path.resolve(testPath);
    console.log(`📂 Проверяю: ${testPath}`);
    console.log(`   📁 Абсолютный путь: ${resolvedPath}`);
   
    if (fs.existsSync(resolvedPath)) {
        console.log(`   ✅ Директория существует`);
       
        // Посчитать файлы
        try {
            const files = fs.readdirSync(resolvedPath);
            console.log(`   📊 Файлов в директории: ${files.length}`);
            if (files.length > 0) {
                console.log(`   📋 Примеры: ${files.slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''}`);
            }
        } catch (error) {
            console.log(`   ❌ Ошибка чтения: ${error.message}`);
        }
    } else {
        console.log(`   ❌ Директория не существует`);
       
        // Попробовать создать
        try {
            fs.mkdirSync(resolvedPath, { recursive: true });
            console.log(`   🛠️  Директория создана`);
           
            // Создать тестовый файл
            const testFile = path.join(resolvedPath, 'test.txt');
            fs.writeFileSync(testFile, `Тест ${new Date().toISOString()}`);
            console.log(`   📄 Тестовый файл создан: ${testFile}`);
           
            // Удалить тестовый файл
            fs.unlinkSync(testFile);
            console.log(`   🗑️  Тестовый файл удален`);
        } catch (error) {
            console.log(`   ❌ Ошибка создания: ${error.message}`);
        }
    }
    console.log('');
});

// Проверить где сейчас создаются файлы
console.log('🔍 Поиск существующих визуализаций...');
const searchDirs = [
    './data',
    './data/footprints',
    './data/visualizations',
    '.',
    '/tmp'
];

function findPNGFiles(dir, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return [];
   
    let results = [];
   
    if (!fs.existsSync(dir)) return results;
   
    try {
        const items = fs.readdirSync(dir);
       
        for (const item of items) {
            const fullPath = path.join(dir, item);
           
            try {
                const stat = fs.statSync(fullPath);
               
                if (stat.isDirectory()) {
                    results = results.concat(findPNGFiles(fullPath, depth + 1, maxDepth));
                } else if (item.toLowerCase().endsWith('.png')) {
                    results.push({
                        path: fullPath,
                        name: item,
                        size: stat.size,
                        mtime: stat.mtime
                    });
                }
            } catch (e) {
                // Пропускаем ошибки
            }
        }
    } catch (error) {
        // Пропускаем ошибки директорий
    }
   
    return results;
}

const allPNGFiles = [];
searchDirs.forEach(dir => {
    const resolvedDir = path.resolve(dir);
    console.log(`\n🔍 Поиск PNG в: ${resolvedDir}`);
    const files = findPNGFiles(resolvedDir);
    console.log(`   📄 Найдено PNG файлов: ${files.length}`);
   
    files.forEach(file => {
        allPNGFiles.push(file);
        console.log(`   🖼️  ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    });
});

console.log('\n🎯 ИТОГИ:');
console.log(`Найдено всего PNG файлов: ${allPNGFiles.length}`);

// Фильтруем файлы визуализаций
const templateFiles = allPNGFiles.filter(f =>
    f.name.includes('template_') || f.name.includes('heatmap_')
);

if (templateFiles.length > 0) {
    console.log('\n🎨 Найдены файлы визуализаций:');
    templateFiles.sort((a, b) => b.mtime - a.mtime); // Сортировка по дате
   
    templateFiles.forEach((file, i) => {
        const timeAgo = Math.round((Date.now() - file.mtime.getTime()) / 1000);
        console.log(`${i+1}. ${file.name}`);
        console.log(`   📁 ${file.path}`);
        console.log(`   📊 ${(file.size / 1024).toFixed(1)} KB, ${timeAgo} секунд назад`);
    });
} else {
    console.log('\n❌ Файлы визуализаций не найдены');
    console.log('💡 Возможные причины:');
    console.log('   1. Визуализация не создаётся из-за ошибки');
    console.log('   2. Файлы создаются в другой директории');
    console.log('   3. Canvas не работает в текущей среде');
}

// Проверить доступность canvas
console.log('\n🎨 Проверка Canvas...');
try {
    const canvas = require('canvas');
    console.log('✅ Canvas доступен');
   
    // Тест создания изображения
    const { createCanvas } = canvas;
    const testCanvas = createCanvas(100, 100);
    const ctx = testCanvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 100, 100);
   
    console.log('✅ Canvas работает корректно');
} catch (error) {
    console.log(`❌ Canvas не доступен: ${error.message}`);
    console.log('💡 Установите: npm install canvas');
}
