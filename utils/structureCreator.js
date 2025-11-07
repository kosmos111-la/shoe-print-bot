const fs = require('fs');
const path = require('path');

/**
* Создание структуры папок проекта
*/
function createProjectStructure() {
    const folders = [
        'config',
        'modules/sessions',
        'modules/analysis',
        'modules/assembly',
        'modules/visualization',
        'modules/storage',
        'modules/interface',
        'utils',
        'backup',
        'tests/unit',
        'tests/integration'
    ];

    let createdCount = 0;

    folders.forEach(folder => {
        const folderPath = path.join(__dirname, '..', folder);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
            console.log(`✅ Создана папка: ${folder}`);
            createdCount++;
        }
    });

    console.log(`🎯 Структура проекта создана! Создано папок: ${createdCount}`);
   
    // Создаем README файлы в папках
    createReadmeFiles();
   
    return createdCount;
}

/**
* Создание README файлов с описанием папок
*/
function createReadmeFiles() {
    const readmeContent = {
        'modules/sessions': `# 🕵️‍♂️ МОДУЛЬ СЕССИЙ\n\nРабота с сессиями анализа следов:\n- TrailSession - управление сессиями\n- sessionManager - менеджер сессий`,
       
        'modules/analysis': `# 🔍 МОДУЛЬ АНАЛИЗА\n\nАнализ следов и извлечение признаков:\n- footprintAnalyzer - анализ отпечатков\n- featureExtractor - извлечение признаков\n- patternMatcher - сравнение паттернов`,
       
        'modules/assembly': `# 🧩 МОДУЛЬ СБОРКИ\n\nСборка полных моделей из частей:\n- FootprintAssembler - сборка моделей\n- ModelHierarchy - иерархическая система\n- compatibility - проверка совместимости`,
       
        'modules/visualization': `# 🎨 МОДУЛЬ ВИЗУАЛИЗАЦИИ\n\nВизуализация результатов анализа:\n- modelVisualizer - визуализация моделей\n- comparisonVisualizer - сравнения\n- skeletonVisualizer - скелетные карты`,
       
        'modules/storage': `# 💾 МОДУЛЬ ХРАНЕНИЯ\n\nРабота с данными и хранилищами:\n- dataPersistence - сохранение данных\n- yandexDisk - работа с Яндекс.Диск\n- statistics - сбор статистики`,
       
        'modules/interface': `# 🎮 МОДУЛЬ ИНТЕРФЕЙСА\n\nИнтерфейс бота и взаимодействие:\n- commandHandlers - обработчики команд\n- buttonHandlers - обработчики кнопок\n- menuSystem - система меню`,
       
        'utils': `# 🛠️ УТИЛИТЫ\n\nВспомогательные функции:\n- helpers - основные утилиты\n- imageProcessing - обработка изображений\n- geometry - геометрические расчеты`
    };

    Object.entries(readmeContent).forEach(([folder, content]) => {
        const readmePath = path.join(__dirname, '..', folder, 'README.md');
        if (!fs.existsSync(readmePath)) {
            fs.writeFileSync(readmePath, content);
            console.log(`📝 Создан README для: ${folder}`);
        }
    });
}

module.exports = createProjectStructure;
