// test-visualization.js
const fs = require('fs');
const path = require('path');

console.log('🔍 Поиск файлов визуализации...');

// Несколько возможных путей
const possiblePaths = [
    'data/footprints/visualizations/templates',
    './data/footprints/visualizations/templates',
    path.join(__dirname, 'data/footprints/visualizations/templates'),
    path.join(process.cwd(), 'data/footprints/visualizations/templates')
];

let foundFiles = [];

for (const basePath of possiblePaths) {
    console.log(`\n📂 Проверяю путь: ${basePath}`);
   
    if (fs.existsSync(basePath)) {
        try {
            const files = fs.readdirSync(basePath);
            console.log(`✅ Директория существует. Файлов: ${files.length}`);
           
            // Ищем файлы шаблонов
            const templateFiles = files.filter(f =>
                f.includes('template_') && f.endsWith('.png')
            );
           
            const heatmapFiles = files.filter(f =>
                f.includes('heatmap_') && f.endsWith('.png')
            );
           
            console.log(`🎨 Файлов шаблонов: ${templateFiles.length}`);
            console.log(`🔥 Файлов тепловых карт: ${heatmapFiles.length}`);
           
            if (templateFiles.length > 0) {
                console.log(`📋 Файлы шаблонов:`);
                templateFiles.forEach(file => {
                    const filePath = path.join(basePath, file);
                    try {
                        const stats = fs.statSync(filePath);
                        console.log(`   📄 ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
                        foundFiles.push({
                            type: 'template',
                            path: filePath,
                            name: file,
                            size: stats.size
                        });
                    } catch (e) {
                        console.log(`   ❌ ${file} (ошибка: ${e.message})`);
                    }
                });
            }
           
            if (heatmapFiles.length > 0) {
                console.log(`📋 Файлы тепловых карт:`);
                heatmapFiles.forEach(file => {
                    const filePath = path.join(basePath, file);
                    try {
                        const stats = fs.statSync(filePath);
                        console.log(`   🔥 ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
                        foundFiles.push({
                            type: 'heatmap',
                            path: filePath,
                            name: file,
                            size: stats.size
                        });
                    } catch (e) {
                        console.log(`   ❌ ${file} (ошибка: ${e.message})`);
                    }
                });
            }
           
        } catch (error) {
            console.log(`❌ Ошибка чтения директории: ${error.message}`);
        }
    } else {
        console.log(`❌ Директория не существует`);
    }
}

// Рекурсивный поиск во всех поддиректориях
console.log('\n🔍 Рекурсивный поиск во всех поддиректориях...');

function searchRecursively(dir, pattern) {
    let results = [];
   
    if (!fs.existsSync(dir)) {
        return results;
    }
   
    try {
        const items = fs.readdirSync(dir);
       
        for (const item of items) {
            const fullPath = path.join(dir, item);
           
            try {
                const stat = fs.statSync(fullPath);
               
                if (stat.isDirectory()) {
                    results = results.concat(searchRecursively(fullPath, pattern));
                } else if (item.match(pattern)) {
                    results.push({
                        path: fullPath,
                        name: item,
                        size: stat.size,
                        directory: dir
                    });
                }
            } catch (e) {
                // Пропускаем ошибки доступа
            }
        }
    } catch (error) {
        // Пропускаем ошибки директорий
    }
   
    return results;
}

// Искать от корня проекта
const projectRoot = process.cwd();
const allTemplateFiles = searchRecursively(projectRoot, /template_.*\.png$/i);
const allHeatmapFiles = searchRecursively(projectRoot, /heatmap_.*\.png$/i);

console.log(`\n🎯 Рекурсивный поиск результатов:`);
console.log(`📄 Всего файлов шаблонов: ${allTemplateFiles.length}`);
console.log(`🔥 Всего тепловых карт: ${allHeatmapFiles.length}`);

if (allTemplateFiles.length > 0) {
    console.log('\n📋 Последние 5 файлов шаблонов:');
    allTemplateFiles.slice(-5).forEach(file => {
        console.log(`   📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        console.log(`     📁 ${file.directory}`);
    });
}

if (allHeatmapFiles.length > 0) {
    console.log('\n📋 Последние 5 тепловых карт:');
    allHeatmapFiles.slice(-5).forEach(file => {
        console.log(`   🔥 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        console.log(`     📁 ${file.directory}`);
    });
}

// Создать тестовый файл для проверки пути
console.log('\n🧪 Тест записи файла...');
const testFilePath = path.join(__dirname, 'test-file.txt');
try {
    fs.writeFileSync(testFilePath, 'Тестовый файл создан: ' + new Date().toISOString());
    console.log(`✅ Тестовый файл создан: ${testFilePath}`);
   
    // Удалить тестовый файл
    fs.unlinkSync(testFilePath);
    console.log(`✅ Тестовый файл удален`);
} catch (error) {
    console.log(`❌ Ошибка создания тестового файла: ${error.message}`);
}

console.log('\n📊 ИТОГ:');
console.log(`Рабочая директория: ${process.cwd()}`);
console.log(`Директория скрипта: ${__dirname}`);
console.log(`Найдено файлов вручную: ${foundFiles.length}`);
console.log(`Найдено файлов рекурсивно: ${allTemplateFiles.length + allHeatmapFiles.length}`);
