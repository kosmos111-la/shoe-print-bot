// modules/footprint/index.js - ИСПРАВЛЕННЫЙ ЭКСПОРТ
const fs = require('fs');
const path = require('path');

console.log('👣 Загружаю модули системы отпечатков...');

// Функция для безопасной загрузки модулей
function safeRequire(modulePath, moduleName) {
    try {
        const fullPath = path.join(__dirname, modulePath);
        if (fs.existsSync(fullPath) || fs.existsSync(fullPath + '.js')) {
            const module = require(fullPath);
            console.log(`✅ ${moduleName || modulePath} загружен`);
            return module;
        } else {
            console.log(`⚠️ Файл не найден: ${modulePath}`);
            return null;
        }
    } catch (error) {
        console.log(`❌ Ошибка загрузки ${moduleName || modulePath}:`, error.message);
        return null;
    }
}

// Загружаем модули
const DigitalFootprint = safeRequire('./digital-footprint', 'DigitalFootprint');
const FootprintDatabase = safeRequire('./footprint-database', 'FootprintDatabase');
const FootprintManager = safeRequire('./footprint-manager', 'FootprintManager');
const ModelVisualizer = safeRequire('./model-visualizer', 'ModelVisualizer');
const EnhancedModelVisualizer = safeRequire('./enhanced-model-visualizer', 'EnhancedModelVisualizer');
const TopologyUtils = safeRequire('./topology-utils', 'TopologyUtils');
const PointCloudAligner = safeRequire('./point-cloud-aligner', 'PointCloudAligner');

// Проверяем, какие модули загрузились
const loadedModules = {
    DigitalFootprint: !!DigitalFootprint,
    FootprintDatabase: !!FootprintDatabase,
    FootprintManager: !!FootprintManager,
    PointCloudAligner: !!PointCloudAligner,
    TopologyUtils: !!TopologyUtils
};

console.log('📊 Загружено модулей:', Object.values(loadedModules).filter(v => v).length, '/', Object.keys(loadedModules).length);

module.exports = {
    DigitalFootprint: DigitalFootprint || class DigitalFootprintStub {
        constructor() { console.log('⚠️ DigitalFootprint stub используется'); }
    },
    FootprintDatabase: FootprintDatabase || class FootprintDatabaseStub {
        constructor() { console.log('⚠️ FootprintDatabase stub используется'); }
        saveFootprint() { return { success: false, error: 'Модуль не загружен' }; }
        loadFootprint() { return { success: false, error: 'Модуль не загружен' }; }
    },
    FootprintManager: FootprintManager || class FootprintManagerStub {
        constructor() { console.log('⚠️ FootprintManager stub используется'); }
    },
    ModelVisualizer: ModelVisualizer || class ModelVisualizerStub {
        constructor() { console.log('⚠️ ModelVisualizer stub используется'); }
    },
    EnhancedModelVisualizer: EnhancedModelVisualizer || class EnhancedModelVisualizerStub {
        constructor() { console.log('⚠️ EnhancedModelVisualizer stub используется'); }
    },
    TopologyUtils: TopologyUtils || { normalizeNodes: () => ({}) },
    PointCloudAligner: PointCloudAligner || class PointCloudAlignerStub {
        constructor() { console.log('⚠️ PointCloudAligner stub используется'); }
    }
};
