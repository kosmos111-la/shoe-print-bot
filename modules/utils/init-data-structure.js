// modules/utils/init-data-structure.js
const fs = require('fs');
const path = require('path');

class DataStructureInitializer {
    constructor(basePath = './data') {
        this.basePath = basePath;
    }

    initAllFolders() {
        console.log('📁 Инициализация структуры папок данных...');
       
        const folders = [
            'footprints',
            'footprints/merge_visualizations',
            'footprints/topology_supermodels',
            'temp/merge_visualizations',
            'hybrid-footprints/users',
            'logs'
        ];

        let created = 0;
        folders.forEach(folder => {
            const fullPath = path.join(this.basePath, folder);
            try {
                if (!fs.existsSync(fullPath)) {
                    fs.mkdirSync(fullPath, { recursive: true });
                    created++;
                    console.log(`   ✅ Создано: ${folder}`);
                }
            } catch (error) {
                console.log(`   ❌ Ошибка создания ${folder}: ${error.message}`);
            }
        });

        console.log(`📊 Итог: создано ${created} папок`);
        return { success: true, created };
    }
}

module.exports = DataStructureInitializer;
