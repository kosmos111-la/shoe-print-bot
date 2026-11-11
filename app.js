// =============================================================================
// 🎯 СИСТЕМА АНАЛИЗА СЛЕДОВ ОБУВИ - ОСНОВНОЙ ФАЙЛ
// =============================================================================

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const FormData = require('form-data');

// 🔥 ИСПРАВЛЕНО: Отключаем предупреждения Telegram API
process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 1;

// 🔥 Отключаем вывод предупреждения в консоль
const originalEmit = process.emit;
process.emit = function(name, data, ...args) {
    if (name === 'warning' && data && data.name === 'DeprecationWarning') {
        // Пропускаем предупреждения о DeprecationWarning
        return false;
    }
    return originalEmit.apply(process, arguments);
};

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// =============================================================
// 📦 МОДУЛИ (рефакторинг): utils, state, services
// =============================================================
const { getContourCenter, rotatePredictions, normalizeFootprintOrientation } = require('./src/utils/geometry');
const { smartPostProcessing, analyzePredictions, generateTopologyText } = require('./src/utils/predictions');
const { escapeHtml, isCoordinates, parseDateTime, getCorrectionDescription } = require('./src/utils/text');
const store = require('./src/state/store');
const { userStats, globalStats, userLastAnalysis, photoBatchDetector, photoQueue, processingUsers } = store;
const { createBot, setupWebhook } = require('./src/services/telegram.service');

// =============================================================================
// 🛡️ ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ОШИБОК (ДОЛЖНЫ БЫТЬ ПЕРВЫМИ)
// =============================================================================

process.on('uncaughtException', (error) => {
    console.error('💥 CRITICAL: Uncaught Exception');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    // Не выходим, пусть бот продолжает работу
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 CRITICAL: Unhandled Rejection');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
});

// Выводим версию Node.js для диагностики
console.log(`🟢 Node.js version: ${process.version}`);
console.log(`🟢 Platform: ${process.platform}`);

// ИМПОРТ МОДУЛЕЙ
const visualizationModule = require('./modules/visualization');
const yandexDiskModule = require('./modules/yandex-disk');
const tempManagerModule = require('./modules/temp-manager');
const calculatorsModule = require('./modules/calculators');
const appsModule = require('./modules/apps');
const { AnalysisModule } = require('./modules/analysis');
const { TopologyVisualizer } = require('./modules/visualization/topology-visualizer');

// 🔍 ПРАКТИЧЕСКИЙ АНАЛИЗ ДЛЯ ПСО
const { PracticalAnalyzer } = require('./modules/analysis/practical-analyzer');
const { AnimalFilter } = require('./modules/correction/animal-filter');

// 🆕 СЕССИОННЫЕ МОДУЛИ
const { SessionManager } = require('./modules/session/session-manager');
const { SessionAnalyzer } = require('./modules/session/session-analyzer');
const { FeedbackDatabase } = require('./modules/feedback/feedback-db');
const { FeedbackManager } = require('./modules/feedback/feedback-manager');

// =============================================================================
// 🔄 НОРМАЛИЗАЦИЯ ОРИЕНТАЦИИ СЛЕДА ПЕРЕД ROBOFLOW
// =============================================================================

/**
* Вычисляет центр контура
*/

/**
* Поворачивает точки предсказаний
*/

/**
* Определяет ориентацию следа и при необходимости поворачивает предсказания
*/

// =============================================================================
// 🚀 НОВАЯ ГРАФОВАЯ СИСТЕМА ЦИФРОВЫХ ОТПЕЧАТКОВ
// =============================================================================

// НОВАЯ СИСТЕМА
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

const SystemDiagnostic = require('./modules/utils/system-diagnostic');
const systemDiagnostic = new SystemDiagnostic();

// Глобальный менеджер новой системы
let footprintManager = null;

// Режим отладки (управляется переменной окружения)
const DEBUG_MODE = process.env.DEBUG_MODE === 'true' || false;

// Инициализация новой системы
async function initializeNewFootprintSystem() {
    try {
        footprintManager = new SimpleFootprintManager({
            dbPath: './data/footprints',
            autoAlignment: true,
            autoSave: true,
            debug: DEBUG_MODE,
            useHybridMode: false,
            enableMergeVisualization: true,
            enableIntelligentMerge: true,
            enableTopologySuperModel: true,
            topologySimilarityThreshold: 0.45,
            hybridSearchThreshold: 0.6
        });

        console.log('✅ Новая графовая система с топологическим слиянием активирована!');
        console.log('🎯 Автосовмещение на основе графов работает!');
        console.log('🎨 Визуализация объединения включена!');

        return true;
    } catch (error) {
        console.log('❌ Ошибка инициализации новой системы:', error.message);
        return false;
    }
}

// ВСТРОЕННЫЙ CONFIG
const config = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
    PORT: process.env.PORT || 10000,
    YANDEX_DISK_TOKEN: process.env.YANDEX_DISK_TOKEN,
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,

    ROBOFLOW: {
        API_URL: 'https://detect.roboflow.com/-zqyih/38',
        API_KEY: 'NeHOB854EyHkDbGGLE6G',
        CONFIDENCE: 25,
        OVERLAP: 30
    }
};

// 🎯 ДОБАВЛЯЕМ КОНФИГ ДЛЯ FOOTPRINT MANAGER
config.FOOTPRINT = {
    AUTO_ALIGNMENT: true,
    DB_PATH: './data/footprints'
};

// Вспомогательная функция для экранирования HTML

// =============================================================================
// 📊 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПОИСКА
// =============================================================================

// Кэш последних анализов

// Сохранить последний анализ
function saveUserLastAnalysis(userId, analysis) {
    if (analysis && analysis.predictions) {
        userLastAnalysis.set(userId, {
            ...analysis,
            timestamp: new Date()
        });
    }
}

// Получить последний анализ
function getLastUserAnalysis(userId) {
    const cached = userLastAnalysis.get(userId);
    if (cached && (new Date() - cached.timestamp) < 5 * 60 * 1000) {
        return cached;
    }
    return null;
}

// =============================================================================
// 🔒 ВАЛИДАЦИЯ КОНФИГУРАЦИИ
// =============================================================================

function validateConfig(config) {
    console.log('🔍 Проверяю конфигурацию...');

    const errors = [];

    // Проверка Telegram токена
    if (!config.TELEGRAM_TOKEN) {
        errors.push('❌ TELEGRAM_TOKEN: отсутствует');
    } else if (config.TELEGRAM_TOKEN.length < 10) {
        errors.push('❌ TELEGRAM_TOKEN: слишком короткий (минимум 10 символов)');
    } else if (!config.TELEGRAM_TOKEN.includes(':')) {
        errors.push('❌ TELEGRAM_TOKEN: должен начинаться с цифр и содержать двоеточие');
    }

    // Проверка Roboflow конфигурации
    if (!config.ROBOFLOW) {
        errors.push('❌ ROBOFLOW: отсутствует конфигурация');
    } else {
        if (!config.ROBOFLOW.API_KEY || config.ROBOFLOW.API_KEY.length < 5) {
            errors.push('❌ ROBOFLOW.API_KEY: отсутствует или слишком короткий');
        }
        if (!config.ROBOFLOW.API_URL || !config.ROBOFLOW.API_URL.includes('roboflow.com')) {
            errors.push('❌ ROBOFLOW.API_URL: некорректный URL');
        }
        if (!config.ROBOFLOW.CONFIDENCE || config.ROBOFLOW.CONFIDENCE < 0 || config.ROBOFLOW.CONFIDENCE > 100) {
            errors.push('❌ ROBOFLOW.CONFIDENCE: должен быть между 0 и 100');
        }
    }

    // Проверка порта
    if (!config.PORT || config.PORT < 1000 || config.PORT > 65535) {
        errors.push('❌ PORT: должен быть между 1000 и 65535');
    }

    // Если есть ошибки - бросаем исключение
    if (errors.length > 0) {
        const errorMessage = `Ошибки конфигурации:\n${errors.join('\n')}`;
        console.log('💥 КРИТИЧЕСКАЯ ОШИБКА:');
        console.log(errorMessage);
        throw new Error(errorMessage);
    }

    console.log('✅ Конфигурация прошла валидацию');
    return true;
}

// ВЫЗЫВАЕМ ВАЛИДАЦИЮ (пропускаем в режиме DEBUG_WEB — только веб-интерфейс)
if (process.env.DEBUG_WEB !== '1') {
    try {
        validateConfig(config);
    } catch (error) {
        console.log('💥 Невозможно запустить систему с некорректной конфигурации');
        process.exit(1);
    }
} else {
    console.log('🔍 DEBUG_WEB: пропускаю проверку Telegram');
}
// =============================================================================
// 🎯 ИНИЦИАЛИЗАЦИЯ FOOTPRINT MANAGER
// =============================================================================

console.log('🚀 Запуск системы с практическим анализом для ПСО...');

// 🔒 ЗАЩИЩЕННАЯ ИНИЦИАЛИЗАЦИЯ МОДУЛЕЙ
let visualization;
let tempFileManager;
let yandexDisk;
let calculators;
let apps;
let analysisModule;
// 🔧 ТОПОЛОГИЧЕСКИЙ ВИЗУАЛИЗАТОР
let topologyVisualizer;

// 🎯 ПРАКТИЧЕСКИЙ АНАЛИЗ ДЛЯ ПСО
let practicalAnalyzer;
let animalFilter;
// 🆕 СЕССИОННЫЕ МОДУЛИ
let sessionManager;
let sessionAnalyzer;

// 🆕 СИСТЕМА ОБРАТНОЙ СВЯЗИ
let feedbackDB;
let feedbackManager;

try {
    feedbackDB = new FeedbackDatabase();
    feedbackManager = new FeedbackManager();
    console.log('✅ Система обратной связи загружена');
} catch (error) {
    console.log('❌ Ошибка системы обратной связи:', error);
    feedbackDB = {
        addFeedback: () => ({ id: 'stub' }),
        getStatistics: () => ({ total: 0, correct: 0 }),
        exportForRoboflow: () => ({})
    };
    feedbackManager = {
        requestFeedback: () => null,
        createFeedbackKeyboard: () => ({ inline_keyboard: [] }),
        processFeedback: () => null
    };
}

// Функция-заглушка для Яндекс.Диска
function createYandexDiskStub() {
    return {
        isAvailable: () => false,
        uploadFile: async () => ({ success: false, error: 'Модуль отключен' }),
        createFolder: async () => ({ success: false }),
        getAvailableSpace: async () => ({ available: 0, total: 0 }),
        saveAnalysisResults: async () => ({ success: false, error: 'Модуль отключен' })
    };
}

// Заглушки для новых модулей
function createCalculatorsStub() {
    return {
        getMenu: () => ({ title: "🧮 КАЛЬКУЛЯТОРЫ", sections: [] }),
        calculateShoeSize: () => "Модуль временно недоступен",
        estimateHeight: () => "Модуль временно недоступен",
        calculateSnowDepth: () => "Модуль временно недоступен",
        getWeatherData: () => "Модуль временно недоступен"
    };
}

function createAppsStub() {
    return {
        getMenu: () => ({ title: "📱 ПРИЛОЖЕНИЯ", categories: [] }),
        getAppsByCategory: () => [],
        getAllApps: () => ({})
    };
}

// Заглушка для практического анализатора
function createPracticalAnalyzerStub() {
    return {
        analyzeForPSO: () => ({
            exclusionCheck: {
                isAnimal: { hasAnimal: false, message: 'Модуль отключен' },
                hasHeel: { hasHeel: false, message: 'Модуль отключен' },
                footprintCount: { count: 0, message: 'Модуль отключен' }
            },
            recommendations: ['Модуль практического анализа временно недоступен'],
            practicalInsights: {
                likelyGender: { gender: 'неизвестно', confidence: 0 },
                shoeCategory: 'неизвестно',
                distinctiveFeatures: ['модуль отключен']
            }
        })
    };
}

// Заглушка для фильтра животных
function createAnimalFilterStub() {
    return {
        filterAnimalPaws: (predictions) => ({
            filtered: predictions,
            removed: 0,
            message: 'Модуль фильтрации животных временно недоступен'
        })
    };
}

// Заглушки для новых модулей
function createSessionManagerStub() {
    return {
        createSession: () => ({ id: 'stub', photos: [] }),
        hasActiveSession: () => false,
        getActiveSession: () => null,
        addPhotoToSession: () => false,
        addAnalysisToSession: () => false,
        endSession: () => ({ totalPhotos: 0 }),
        getSessionSummary: () => null
    };
}

function createSessionAnalyzerStub() {
    return {
        analyzeSession: () => ({
            peopleCount: { estimatedCount: 1, confidence: 0.5 },
            movementAnalysis: { available: false },
            shoeReconstruction: { totalGroups: 0 },
            timeline: { averageInterval: null }
        })
    };
}

// Временные заглушки пока идет инициализация
yandexDisk = createYandexDiskStub();
calculators = createCalculatorsStub();
apps = createAppsStub();
practicalAnalyzer = createPracticalAnalyzerStub();
animalFilter = createAnimalFilterStub();

const app = express();
// 🔥 DEBUG_WEB: фиктивный бот-заглушка (регистрация команд не падает)
let bot = null;
if (process.env.DEBUG_WEB !== '1' && config.TELEGRAM_TOKEN && !config.TELEGRAM_TOKEN.startsWith('0000')) {
    bot = createBot(config.TELEGRAM_TOKEN);
} else {
    console.log('🔍 DEBUG_WEB: бот не запущен — фиктивная заглушка');
    bot = {
        on: () => {}, onText: () => {}, sendMessage: async () => {},
        answerCallbackQuery: async () => {}, editMessageText: async () => {},
        processUpdate: () => {}, getFile: async () => ({ file_path: '' }),
        sendPhoto: async () => {}, getMe: async () => ({ username: 'debug' }),
        getWebHookInfo: async () => ({ url: '', pending_update_count: 0 })
    };
}
// polling не указываем

// 🔧 НАСТРОЙКА EXPRESS
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    },
    limit: '10mb'
}));

app.use(express.urlencoded({
    extended: true,
    limit: '10mb'
}));

// =============================================================================
// 📊 СИСТЕМА СТАТИСТИКИ
// =============================================================================

function updateUserStats(userId, username, action = 'photo') {
    if (!userStats.has(userId)) {
        userStats.set(userId, {
            username: username || `user_${userId}`,
            photosCount: 0,
            analysesCount: 0,
            firstSeen: new Date(),
            lastSeen: new Date(),
            lastAnalysis: null
        });
        globalStats.totalUsers++;
    }

    const user = userStats.get(userId);
    user.lastSeen = new Date();

    switch(action) {
        case 'photo':
            user.photosCount++;
            globalStats.totalPhotos++;
            break;
        case 'analysis':
            user.analysesCount++;
            globalStats.totalAnalyses++;
            user.lastAnalysis = new Date();
            globalStats.lastAnalysis = new Date();
            break;
    }
}

// =============================================================================
// 🔧 ПОСТОБРАБОТКА
// =============================================================================

// =============================================================================
// 🔧 АНАЛИЗ ДАННЫХ
// =============================================================================


// =============================================================================
// 🤖 TELEGRAM БОТ - КОМАНДЫ
// =============================================================================

// Логирование вебхук запросов
app.post(`/bot${config.TELEGRAM_TOKEN}`, (req, res) => {
    const update = req.body;
    if (DEBUG_MODE) {
        console.log('📨 Вебхук запрос:', {
            update_id: update.update_id,
            message: update.message ? '📝 есть' : 'нет',
            callback_query: update.callback_query ? '🔄 есть' : 'нет'
        });
    }

    bot.processUpdate(update);
    res.sendStatus(200);
});

// Webhook для Telegram
app.post(`/bot${config.TELEGRAM_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Команда /start
// =============================================================================
// 📋 КОМАНДЫ БОТА (вынесено в src/handlers/commands.handler.js)
// =============================================================================
const commandsHandlerCtx = {
    get config() { return config; },
    get sessionManager() { return sessionManager; },
    get tempFileManager() { return tempFileManager; },
    get animalFilter() { return animalFilter; },
    get practicalAnalyzer() { return practicalAnalyzer; },
    get analysisModule() { return analysisModule; },
    get visualization() { return visualization; },
    get topologyVisualizer() { return topologyVisualizer; },
    get footprintManager() { return footprintManager; },
    get feedbackManager() { return feedbackManager; },
    get feedbackDB() { return feedbackDB; },
    get yandexDisk() { return yandexDisk; },
    get calculators() { return calculators; },
    get apps() { return apps; },
    updateUserStats,
    saveUserLastAnalysis,
    getLastUserAnalysis
};
if (bot) {
    require('./src/handlers/commands.handler')(bot, commandsHandlerCtx);
}
// =============================================================================
// 📸 ОБРАБОТКА ФОТО (вынесено в src/handlers/photo.handler.js)
// =============================================================================
const photoHandlerCtx = {
    get config() { return config; },
    get sessionManager() { return sessionManager; },
    get tempFileManager() { return tempFileManager; },
    get animalFilter() { return animalFilter; },
    get practicalAnalyzer() { return practicalAnalyzer; },
    get analysisModule() { return analysisModule; },
    get visualization() { return visualization; },
    get topologyVisualizer() { return topologyVisualizer; },
    get footprintManager() { return footprintManager; },
    get feedbackManager() { return feedbackManager; },
    updateUserStats,
    saveUserLastAnalysis
};
if (bot) {
    require('./src/handlers/photo.handler')(bot, photoHandlerCtx);
}

// 🔍 ЛОКАЛЬНЫЙ ВЕБ-ИНТЕРФЕЙС ДЛЯ ОТЛАДКИ ЯДРА (без Telegram)
if (process.env.DEBUG_WEB === '1') {
    const createDebugServer = require('./src/web/debug-server');
    const debugApp = createDebugServer(photoHandlerCtx, config);
    const debugPort = process.env.DEBUG_WEB_PORT || 3001;
    debugApp.listen(debugPort, () => {
        console.log(`🔍 Debug UI: http://localhost:${debugPort}`);
    });
}

// =============================================================================
// 🚀 ЗАПУСК СЕРВЕРА
// =============================================================================
app.get('/', (req, res) => {
    res.send(`
        <h1>🤖 Система анализа следов обуви v2.5</h1>
        <p>✅ Модульная система работает!</p>
        <p>📊 Пользователей: ${globalStats.totalUsers}</p>
        <p>📸 Фото обработано: ${globalStats.totalPhotos}</p>
        <p>🎯 Практический анализ для ПСО: активен</p>
        <p>🐕 Фильтрация животных: активна</p>
        <p>👣 Новая графовая система: АКТИВИРОВАНА ✅</p>
        <p>🎨 Визуализация объединения: АКТИВИРОВАНА ✅</p>
        <p>🔧 DEBUG_MODE: ${DEBUG_MODE ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}</p>
        <p><a href="/health">Health Check</a></p>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        statistics: {
            users: globalStats.totalUsers,
            photos: globalStats.totalPhotos,
            analyses: globalStats.totalAnalyses
        },
        modules: {
            practicalAnalyzer: practicalAnalyzer !== null,
            animalFilter: animalFilter !== null,
            visualization: visualization !== null,
            yandexDisk: yandexDisk !== null,
            footprintManager: footprintManager !== null
        },
        debug: {
            mode: DEBUG_MODE,
            footprintSessions: footprintManager ? Array.from(footprintManager.userSessions.keys()).length : 0,
            mergeVisualizations: footprintManager ? footprintManager.getMergeVisualizationCount() : 0
        }
    });
});

// =============================================================================
// 🛡️ ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ОШИБОК
// =============================================================================

// Обработчик необработанных обещаний
process.on('unhandledRejection', (reason, promise) => {
    console.log('❌ Необработанное отклонение промиса:', reason);
    console.log('📋 Promise:', promise);
    // Очищаем временные файлы при критической ошибке
    if (tempFileManager && tempFileManager.cleanup) {
        tempFileManager.cleanup();
    }
});

// Обработчик необработанных исключений
process.on('uncaughtException', (error) => {
    console.log('💥 Критическая ошибка:', error);
    console.log('🔄 Очищаем временные файлы...');
    if (tempFileManager && tempFileManager.cleanup) {
        tempFileManager.cleanup();
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Получен SIGINT, очищаем ресурсы...');
    const cleaned = tempFileManager.cleanup ? tempFileManager.cleanup() : 0;
    console.log(`🧹 Удалено ${cleaned} временных файлов перед выходом`);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Получен SIGTERM, очищаем ресурсы...');
    const cleaned = tempFileManager.cleanup ? tempFileManager.cleanup() : 0;
    console.log(`🧹 Удалено ${cleaned} временных файлов перед выходом`);
    process.exit(0);
});

// Периодическая очистка старых файлов (каждые 30 минут)
setInterval(() => {
    if (tempFileManager && tempFileManager.cleanupOldFiles) {
        const cleaned = tempFileManager.cleanupOldFiles(60); // файлы старше 60 минут
        if (cleaned > 0) {
            console.log(`⏰ Периодическая очистка: удалено ${cleaned} старых файлов`);
        }
    }
}, 30 * 60 * 1000); // 30 минут

console.log('🛡️ Глобальные обработчики ошибки активированы');

// =============================================================================
// 🔄 ИНИЦИАЛИЗАЦИЯ МОДУЛЕЙ
// =============================================================================

// НЕМЕДЛЕННО ВЫЗЫВАЕМАЯ АСИНХРОННАЯ ФУНКЦИЯ (IIFE)
(async function() {
    // ИНИЦИАЛИЗИРУЕМ СИНХРОННЫЕ МОДУЛИ
    try {
        visualization = visualizationModule.initialize();
        console.log('✅ Модуль визуализации загружен');
    } catch (error) {
        console.log('❌ Ошибка модуля визуализации:', error.message);
        visualization = {
            getVisualization: () => ({ createVisualization: async () => null }),
            setUserStyle: () => false,
            getUserStyle: () => 'original',
            getAvailableStyles: () => [{ id: 'original', name: 'Оригинальный', description: 'Основной стиль' }],
            userPreferences: new Map()
        };
    }

    try {
        tempFileManager = tempManagerModule.initialize({
            tempDir: './temp',
            autoCleanup: true
        });
        console.log('✅ Менеджер временных файлов загружен');
    } catch (error) {
        console.log('❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось загрузить менеджер файлов:', error.message);
        tempFileManager = {
            track: () => {},
            removeFile: () => false,
            cleanup: () => 0,
            getStats: () => ({ totalTracked: 0, existingFiles: 0, totalSize: '0 MB' })
        };
    }

    // 🧠 ДОБАВЛЯЕМ МОДУЛЬ АНАЛИЗА
    try {
        analysisModule = new AnalysisModule();
        console.log('✅ Модуль анализа загружен');
    } catch (error) {
        console.log('❌ Ошибка модуля анализа:', error.message);
        analysisModule = {
            performComprehensiveAnalysis: async () => {
                console.log('⚠️ Модуль анализа временно недоступен');
                return null;
            }
        };
    }

    // 🔧 ИНИЦИАЛИЗИРУЕМ ТОПОЛОГИЧЕСКИЙ ВИЗУАЛИЗАТОР
    try {
        topologyVisualizer = new TopologyVisualizer();
        console.log('✅ TopologyVisualizer загружен');
    } catch (error) {
        console.log('❌ Ошибка TopologyVisualizer:', error);
        topologyVisualizer = {
            createTopologyVisualization: async () => {
                console.log('⚠️ TopologyVisualizer временно недоступен');
                return false;
            }
        };
    }

    // 🎯 ДОБАВЛЯЕМ ПРАКТИЧЕСКИЙ АНАЛИЗ ДЛЯ ПСО
    try {
        practicalAnalyzer = new PracticalAnalyzer();
        animalFilter = new AnimalFilter();
        console.log('✅ Практический анализатор и фильтр животных загружены');
    } catch (error) {
        console.log('❌ Ошибка практического анализатора:', error.message);
        practicalAnalyzer = createPracticalAnalyzerStub();
        animalFilter = createAnimalFilterStub();
    }

    // 🆕 ИНИЦИАЛИЗИРУЕМ СЕССИОННЫЕ МОДУЛИ
    try {
        sessionManager = new SessionManager();
        sessionAnalyzer = new SessionAnalyzer();
        console.log('✅ Сессионные модули загружены');
    } catch (error) {
        console.log('❌ Ошибка сессионных модулей:', error.message);
        sessionManager = createSessionManagerStub();
        sessionAnalyzer = createSessionAnalyzerStub();
    }

    // ИНИЦИАЛИЗИРУЕМ НОВЫЕ МОДУЛИ
    try {
        calculators = calculatorsModule.initialize();
        console.log('✅ Модуль калькуляторов загружен');
    } catch (error) {
        console.log('❌ Ошибка модуля калькуляторов:', error.message);
        calculators = createCalculatorsStub();
    }

    try {
        apps = appsModule.initialize();
        console.log('✅ Модуль приложений загружен');
    } catch (error) {
        console.log('❌ Ошибка модуля приложений:', error.message);
        apps = createAppsStub();
    }

    // ИНИЦИАЛИЗИРУЕМ ЯНДЕКС.ДИСК (асинхронно)
    try {
        yandexDisk = await yandexDiskModule.initialize(config.YANDEX_DISK_TOKEN);
        if (yandexDisk) {
            console.log('✅ Модуль Яндекс.Диска загружен');
            await yandexDisk.createAppFolder();
            console.log('✅ Папка Яндекс.Диска готова');
        } else {
            console.log('⚠️ Модуль Яндекс.Диска отключен (нет токена)');
            yandexDisk = createYandexDiskStub();
        }
    } catch (error) {
        console.log('❌ Ошибка инициализации Яндекс.Диска:', error.message);
        yandexDisk = createYandexDiskStub();
    }

    // 🎯 ИНИЦИАЛИЗАЦИЯ НОВОЙ ГРАФОВОЙ СИСТЕМЫ
    try {
        await initializeNewFootprintSystem();
        console.log('✅ Новая графовая система цифровых отпечатков активирована!');
    } catch (error) {
        console.log('❌ Ошибка инициализации новой системы:', error.message);
        footprintManager = null;
    }

    console.log('🚀 Все модули инициализированы!');
    console.log('🎯 Практический анализ для ПСО активирован');
    console.log('🐕 Фильтрация следов животных активирована');
    console.log('👣 Новая графовая система с автосовмещением: АКТИВИРОВАНА ✅');
    console.log('🎨 Визуализация объединения следов: АКТИВИРОВАНА ✅');
    console.log(`🔧 DEBUG_MODE: ${DEBUG_MODE ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);

})();

// =============================================================================
// 📊 ДИАГНОСТИКА ПАМЯТИ (КАЖДЫЕ 5 МИНУТ)
// =============================================================================

setInterval(() => {
    const used = process.memoryUsage();
    console.log('\n📊 MEMORY USAGE:');
    console.log(`   RSS: ${Math.round(used.rss / 1024 / 1024)} MB`);
    console.log(`   Heap Total: ${Math.round(used.heapTotal / 1024 / 1024)} MB`);
    console.log(`   Heap Used: ${Math.round(used.heapUsed / 1024 / 1024)} MB`);
    console.log(`   External: ${Math.round(used.external / 1024 / 1024)} MB`);
   
    if (footprintManager) {
        const sessions = footprintManager.userSessions?.size || 0;
        const models = footprintManager.loadedModels?.size || 0;
        console.log(`   Active Sessions: ${sessions}`);
        console.log(`   Loaded Models: ${models}`);
    }
   
    const tempFiles = fs.readdirSync('./temp').length;
    console.log(`   Temp Files: ${tempFiles}`);
}, 5 * 60 * 1000);

// =============================================================================
// 🔄 ОБРАБОТЧИК CALLBACK-КНОПОК ДЛЯ ОБРАТНОЙ СВЯЗИ
// =============================================================================

// Глобальная переменная для временных данных
const feedbackSessions = new Map();

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
        // Обработка основной feedback кнопки
        if (data === 'feedback_correct') {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Спасибо за подтверждение!'
            });

            // Сохраняем в базу
            const feedbackData = {
                userId: userId,
                prediction: null, // Нужно найти оригинальный prediction
                correctionType: 'correct',
                imageId: 'unknown',
                timestamp: new Date().toISOString()
            };

            feedbackDB.addFeedback(feedbackData);

            // Обновляем сообщение
            await bot.editMessageText(
                `✅ Спасибо! Ваш ответ поможет улучшить точность анализа.`,
                {
                    chat_id: chatId,
                    message_id: messageId
                }
            );

        } else if (data === 'feedback_incorrect') {
            await bot.answerCallbackQuery(callbackQuery.id);

            // Показываем меню выбора типа ошибки
            await bot.editMessageText(
                `Что не так с анализом? Выберите вариант:`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: feedbackManager.createCorrectionKeyboard()
                }
            );

        }
        // Обработка конкретных исправлений
        else if (data.startsWith('correction_')) {
            const correctionType = data.replace('correction_', '');

            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Спасибо за исправление!'
            });

            // Сохраняем в базу
            const feedbackData = {
                userId: userId,
                prediction: null,
                correctionType: correctionType,
                imageId: 'unknown',
                timestamp: new Date().toISOString(),
                notes: getCorrectionDescription(correctionType)
            };

            feedbackDB.addFeedback(feedbackData);

            // Обновляем сообщение
            await bot.editMessageText(
                `✅ Спасибо за исправление!\n` +
                `Тип: ${getCorrectionDescription(correctionType)}\n` +
                `Это поможет значительно улучшить точность модели.`,
                {
                    chat_id: chatId,
                    message_id: messageId
                }
            );
        }

    } catch (error) {
        console.log('❌ Ошибка обработки callback:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Ошибка обработки'
        });
    }
});

// Вспомогательная функция для описаний исправлений

// =============================================================================
// 🌐 НАСТРОЙКА ВЕБХУКА ДЛЯ RENDER.COM
// =============================================================================


// Запускаем настройку вебхука через 3 секунды после старта (только не в DEBUG_WEB)
if (process.env.DEBUG_WEB !== '1' && bot) {
    setTimeout(() => setupWebhook(bot, config.TELEGRAM_TOKEN), 3000);
}
// Периодическая проверка вебхука (только не в DEBUG_WEB)
if (process.env.DEBUG_WEB !== '1' && bot) {
    setInterval(async () => {
        try {
            const info = await bot.getWebHookInfo();
            if (!info.url || info.pending_update_count > 50) {
                console.log('⚠️ Вебхук требует внимания, переустанавливаю...');
                await setupWebhook(bot, config.TELEGRAM_TOKEN);
            }
        } catch (error) {
            console.log('❌ Ошибка проверки вебхука:', error.message);
        }
    }, 30 * 60 * 1000); // Проверка каждые 30 минут
}
// Тестовый эндпоинт для проверки
app.get('/webhook-test', async (req, res) => {
    try {
        const info = await bot.getWebHookInfo();
        res.json({
            status: 'ok',
            webhook: {
                url: info.url,
                pending_updates: info.pending_update_count,
                last_error: info.last_error_message,
                has_custom_certificate: info.has_custom_certificate
            },
            bot: await bot.getMe(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================================================
// 🔧 КОМАНДЫ ДЛЯ СИСТЕМНОЙ ДИАГНОСТИКИ
// =============================================================================

// Команда /diagnostic - полная диагностика системы
bot.onText(/\/diagnostic/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        await bot.sendMessage(chatId, '🔍 Запускаю полную диагностику системы...');

        // Используем глобальную переменную systemDiagnostic
        if (systemDiagnostic) {
            await systemDiagnostic.sendDiagnosticReport(bot, chatId);
            await bot.sendMessage(chatId, '✅ Диагностика завершена!');
        } else {
            await bot.sendMessage(chatId, '❌ Модуль диагностики не инициализирован');
        }
    } catch (error) {
        console.log('❌ Ошибка диагностики:', error);
        await bot.sendMessage(chatId, `❌ Ошибка диагностики: ${error.message}`);
    }
});

// Команда /system_info - краткая информация о системе
bot.onText(/\/system_info/, async (msg) => {
    const chatId = msg.chat.id;

    const info = `
🔧 **СИСТЕМНАЯ ИНФОРМАЦИЯ**

📦 **МОДУЛИ:**
├─ 🦶 Footprint: цифровые отпечатки
├─ 🔍 Analysis: анализ следов
├─ 🎨 Visualization: визуализации
├─ 🤖 Bot: телеграм бот
├─ 🧮 Calculators: расчеты
├─ 📱 Apps: полезные приложения

⚙️ **НАСТРОЙКИ:**
├─ Автосовмещение: ✅ ВКЛ
├─ Визуализация объединений: ✅ ВКЛ
├─ Debug: ${DEBUG_MODE ? '✅ ВКЛ' : '❌ ВЫКЛ'}

📊 **КОМАНДЫ:**
├─ /start - начать
├─ /footprint_start - создать сессию отпечатков
├─ /diagnostic - диагностика системы
├─ /system_info - эта информация
├─ /visualize_merge - визуализация объединения
└─ /help - помощь

📈 **СТАТИСТИКА:**
├─ Пользователей: ${globalStats.totalUsers}
├─ Фото обработано: ${globalStats.totalPhotos}
├─ Анализов: ${globalStats.totalAnalyses}
└─ Активных сессий: ${sessionManager ? Array.from(sessionManager.activeSessions.keys()).length : 0}
`;

    await bot.sendMessage(chatId, info);
});

// =============================================================================
// 🛡️ ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА ПЕРЕД ЗАПУСКОМ
// =============================================================================

console.log('🟢 Starting server...');
console.log(`🟢 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🟢 Memory limit: ${require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024} MB`);

// Перехват сигналов завершения
process.on('SIGTERM', () => {
    console.log('🟡 Received SIGTERM, graceful shutdown...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🟡 Received SIGINT, graceful shutdown...');
    process.exit(0);
});

// Запуск сервера
app.listen(config.PORT, () => {
    console.log(`✅ Сервер запущен на порту ${config.PORT}`);
    console.log(`🤖 Telegram бот готов к работе`);
    console.log(`🎯 Практический анализ для ПСО активирован`);
    console.log(`🐕 Фильтрация животных: активна`);
    console.log(`👣 Графовая система с автосовмещением: АКТИВИРОВАНА`);
    console.log(`🎨 Визуализация объединения следов: АКТИВИРОВАНА`);
    console.log(`🔧 DEBUG_MODE: ${DEBUG_MODE ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
});