// force-send-visualization.js
// Принудительная отправка последней визуализации

const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');

const BOT_TOKEN = '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI';
const CHAT_ID = 699140291;

async function findAndSendLatestVisualization() {
    console.log('🔍 Ищу последние файлы визуализации...');
   
    // Искать от корня проекта
    const projectRoot = process.cwd();
   
    function searchFiles(dir, pattern) {
        let results = [];
       
        if (!fs.existsSync(dir)) return results;
       
        try {
            const items = fs.readdirSync(dir);
           
            for (const item of items) {
                const fullPath = path.join(dir, item);
               
                try {
                    const stat = fs.statSync(fullPath);
                   
                    if (stat.isDirectory()) {
                        results = results.concat(searchFiles(fullPath, pattern));
                    } else if (item.match(pattern)) {
                        results.push({
                            path: fullPath,
                            name: item,
                            mtime: stat.mtime,
                            size: stat.size
                        });
                    }
                } catch (e) {
                    // Пропускаем
                }
            }
        } catch (error) {
            // Пропускаем
        }
       
        return results;
    }
   
    const templateFiles = searchFiles(projectRoot, /template_.*\.png$/i);
    const heatmapFiles = searchFiles(projectRoot, /heatmap_.*\.png$/i);
   
    console.log(`📄 Найдено файлов шаблонов: ${templateFiles.length}`);
    console.log(`🔥 Найдено тепловых карт: ${heatmapFiles.length}`);
   
    // Сортировка по дате изменения (новые сначала)
    templateFiles.sort((a, b) => b.mtime - a.mtime);
    heatmapFiles.sort((a, b) => b.mtime - a.mtime);
   
    const bot = new Telegraf(BOT_TOKEN);
   
    // Отправить последний шаблон
    if (templateFiles.length > 0) {
        const latestTemplate = templateFiles[0];
        console.log(`\n📤 Отправляю шаблон: ${latestTemplate.name}`);
        console.log(`   📁 Путь: ${latestTemplate.path}`);
        console.log(`   📅 Дата: ${latestTemplate.mtime}`);
        console.log(`   📊 Размер: ${(latestTemplate.size / 1024).toFixed(1)} KB`);
       
        try {
            await bot.telegram.sendPhoto(CHAT_ID, {
                source: fs.createReadStream(latestTemplate.path)
            }, {
                caption: `🎯 **ШАБЛОН ПРОТЕКТОРА**\n\n` +
                        `✅ Система успешно сравнила два фото!\n` +
                        `📊 Автоповорот: 86.3° → 0° и 4.5° → 0°\n` +
                        `🔄 Инвариантное сравнение: 87.6%\n` +
                        `📈 Ячеек шаблона: 56\n` +
                        `🔥 Файл: ${latestTemplate.name}`
            });
           
            console.log(`✅ Шаблон отправлен!`);
        } catch (error) {
            console.log(`❌ Ошибка отправки шаблона: ${error.message}`);
        }
    }
   
    // Отправить последнюю тепловую карту
    if (heatmapFiles.length > 0) {
        const latestHeatmap = heatmapFiles[0];
        console.log(`\n📤 Отправляю тепловую карту: ${latestHeatmap.name}`);
       
        try {
            await bot.telegram.sendPhoto(CHAT_ID, {
                source: fs.createReadStream(latestHeatmap.path)
            }, {
                caption: `🔥 **ТЕПЛОВАЯ КАРТА ПОДТВЕРЖДЕНИЙ**\n` +
                        `Карта показывает наиболее подтверждённые области протектора\n` +
                        `📊 Файл: ${latestHeatmap.name}`
            });
           
            console.log(`✅ Тепловая карта отправлена!`);
        } catch (error) {
            console.log(`❌ Ошибка отправки тепловой карты: ${error.message}`);
        }
    }
   
    console.log('\n🎯 Отправка завершена!');
   
    if (templateFiles.length === 0 && heatmapFiles.length === 0) {
        console.log('❌ Не найдено файлов визуализации.');
        console.log('💡 Проверь:');
        console.log('   1. Создаются ли файлы в правильной директории');
        console.log('   2. Разрешения на запись');
        console.log('   3. Логи создания файлов');
    }
}

// Запустить
findAndSendLatestVisualization().catch(error => {
    console.error('❌ Ошибка:', error);
});
