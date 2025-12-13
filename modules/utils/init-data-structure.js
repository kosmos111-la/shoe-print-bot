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
            // Основные папки
            'footprints/merge_visualizations',
            'footprints/topology_supermodels',
            'temp/merge_visualizations',
            'temp/spring_forces',
            'temp/topology_refinement',
            'temp/debug',
            'user_sessions',
            'models/roboflow_cache',
            'models/embeddings',
            'logs'
        ];

        let created = 0;
        let errors = 0;

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
                errors++;
            }
        });

        // Создать индексные файлы
        this.createIndexFiles();

        console.log(`📊 Итог: создано ${created} папок, ошибок: ${errors}`);
        return { success: errors === 0, created, errors };
    }

    createIndexFiles() {
        // Индекс для footprints
        const footprintsIndex = {
            version: '1.4',
            created: new Date().toISOString(),
            totalModels: 0,
            hybridModels: 0,
            topologySuperModels: 0,
            users: {},
            lastUpdated: new Date().toISOString()
        };

        this.saveJson('footprints/_index.json', footprintsIndex);

        // Индекс для user_sessions
        const sessionsIndex = {
            version: '1.0',
            totalUsers: 0,
            activeSessions: 0,
            users: {}
        };

        this.saveJson('user_sessions/_index.json', sessionsIndex);

        // Создать пустой лог-файл
        this.saveJson('logs/app.log', { startTime: new Date().toISOString(), logs: [] });
    }

    saveJson(relativePath, data) {
        try {
            const fullPath = path.join(this.basePath, relativePath);
            const dir = path.dirname(fullPath);
           
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
           
            fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
            console.log(`   💾 Создан файл: ${relativePath}`);
        } catch (error) {
            console.log(`   ❌ Ошибка создания ${relativePath}: ${error.message}`);
        }
    }

    checkExistingStructure() {
        console.log('🔍 Проверка существующей структуры...');
       
        const requiredFolders = [
            'footprints',
            'footprints/merge_visualizations',
            'footprints/topology_supermodels',
            'temp/merge_visualizations'
        ];

        const missing = [];
        const existing = [];

        requiredFolders.forEach(folder => {
            const fullPath = path.join(this.basePath, folder);
            if (fs.existsSync(fullPath)) {
                existing.push(folder);
            } else {
                missing.push(folder);
            }
        });

        console.log(`📊 Найдено: ${existing.length} папок`);
        console.log(`⚠️ Отсутствует: ${missing.length} папок`);
       
        if (missing.length > 0) {
            console.log('❌ Отсутствующие папки:');
            missing.forEach(folder => console.log(`   - ${folder}`));
        }

        return { existing, missing };
    }
}

module.exports = DataStructureInitializer;
