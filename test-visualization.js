// test-visualization.js
// Тест отправки визуализации

const fs = require('fs');
const path = require('path');

// 1. Проверить существует ли файл визуализации
const visualizationPath = 'data/footprints/visualizations/templates/template_699140291_1767609817034.png';

if (fs.existsSync(visualizationPath)) {
    console.log(`✅ Файл существует: ${visualizationPath}`);
    const stats = fs.statSync(visualizationPath);
    console.log(`📁 Размер: ${(stats.size / 1024).toFixed(1)} KB`);
   
    // 2. Проверить другие файлы в директории
    const dir = path.dirname(visualizationPath);
    const files = fs.readdirSync(dir);
    console.log(`📂 Файлов в директории: ${files.length}`);
   
    const templateFiles = files.filter(f => f.includes('template_'));
    const heatmapFiles = files.filter(f => f.includes('heatmap_'));
   
    console.log(`🎨 Файлы шаблонов: ${templateFiles.length}`);
    console.log(`🔥 Файлы тепловых карт: ${heatmapFiles.length}`);
   
    if (templateFiles.length > 0) {
        console.log(`📋 Последние 3 шаблона:`);
        templateFiles.slice(-3).forEach(file => {
            const filePath = path.join(dir, file);
            const fileStats = fs.statSync(filePath);
            console.log(`   ${file} (${(fileStats.size / 1024).toFixed(1)} KB)`);
        });
    }
} else {
    console.log(`❌ Файл не найден: ${visualizationPath}`);
   
    // Поиск в родительской директории
    const parentDir = path.join(__dirname, 'data/footprints/visualizations');
    if (fs.existsSync(parentDir)) {
        console.log(`🔍 Поиск в: ${parentDir}`);
       
        function findFiles(dir, pattern) {
            let results = [];
            const items = fs.readdirSync(dir);
           
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
               
                if (stat.isDirectory()) {
                    results = results.concat(findFiles(fullPath, pattern));
                } else if (item.match(pattern)) {
                    results.push(fullPath);
                }
            }
            return results;
        }
       
        const allTemplateFiles = findFiles(parentDir, /template_.*\.png$/i);
        console.log(`🔍 Найдено файлов шаблонов: ${allTemplateFiles.length}`);
       
        if (allTemplateFiles.length > 0) {
            console.log(`📋 Все найденные шаблоны:`);
            allTemplateFiles.forEach(file => {
                const stats = fs.statSync(file);
                console.log(`   ${file.replace(parentDir, '...')} (${(stats.size / 1024).toFixed(1)} KB)`);
            });
        }
    }
}
