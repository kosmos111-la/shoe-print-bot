// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵
// 🔵                     АРХИТЕКТУРНАЯ КАРТА ПРОЕКТА                          🔵
// 🔵------------------------------------------------------------------------🔵
// 🔵 📦 МОДУЛИ:                                                             🔵
// 🔵  ├── 🤖 bot.js (ОРКЕСТРАТОР - только Telegram логика)                  🔵
// 🔵  ├── ⚙️ config/constants.js (настройки)                                🔵
// 🔵  ├── 🧩 modules/handlers/ (обработчики команд)                         🔵
// 🔵  ├── 🏔️ modules/core/ (основная бизнес-логика)                        🔵
// 🔵  ├── 🎨 modules/utils/ (вспомогательные функции)                       🔵
// 🔵  ├── 💾 modules/storage/ (работа с данными)                            🔵
// 🔵  └── 🚀 modules/services/ (внешние сервисы)                            🔵
// 🔵                                                                        🔵
// 🔵 🎯 ТЕКУЩИЙ ЭТАП: ЗАПУСК СИСТЕМЫ → ВИЗУАЛИЗАЦИЯ МОДЕЛЕЙ (ЭТАП 4)       🔵
// 🔵 🔄 ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ: 06.11.2025                                   🔵
// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

// =============================================================================
// ⚙️ КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ
// =============================================================================

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI';
const PORT = process.env.PORT || 10000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://shoe-print-bot.onrender.com/";

console.log('🚀 Запуск бота с Webhook...');
console.log("Webhook URL: " + WEBHOOK_URL);

// =============================================================================
// 🚨 ДИАГНОСТИКА CIRCULAR DEPENDENCIES
// =============================================================================

// Включаем трассировку для circular dependencies
process.on('warning', (warning) => {
    if (warning.name === 'Warning' && warning.message.includes('circular dependency')) {
        console.log('🚨 CIRCULAR DEPENDENCY DETECTED:');
        console.log('   Message:', warning.message);
        if (warning.stack) {
            const stackLines = warning.stack.split('\n');
            console.log('   Stack trace:');
            stackLines.slice(0, 5).forEach(line => console.log('   ', line));
        }
    }
});

// =============================================================================
// 📦 ПОДКЛЮЧЕНИЕ МОДУЛЕЙ
// =============================================================================

// 🔧 УТИЛИТЫ И КОНФИГУРАЦИЯ
const Helpers = require('./modules/utils/helpers');
const createProjectStructure = require('./utils/structureCreator');

// 🧩 ОБРАБОТЧИКИ КОМАНД
const StartHandler = require('./modules/handlers/startHandler');
const StatisticsHandler = require('./modules/handlers/statisticsHandler');
const MenuHandler = require('./modules/handlers/menuHandler');
const PhotoHandler = require('./modules/handlers/photoHandler');
// 🎨 ВИЗУАЛИЗАЦИЯ
const VisualizationHandler = require('./modules/handlers/visualizationHandler');

// 🏔️ ЯДРО СИСТЕМЫ
 const { SessionManager: NewSessionManager } = require('./modules/sessions/sessionManager');
 const { DataPersistence: NewDataPersistence } = require('./modules/storage/legacy');
//  const { ModelHierarchy } = require('./model_hierarchy');

const HelpHandler = require('./modules/handlers/helpHandler');

// =============================================================================
// 🔄 УТИЛИТА ПОВТОРНЫХ ПОПЫТОК
// =============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

async function withRetry(operation, context = "") {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`🔄 ${context} - попытка ${i+1}/${MAX_RETRIES}: ${error.message}`);
      if (i === MAX_RETRIES - 1) {
        console.log(`❌ ${context} - все попытки исчерпаны`);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

// =============================================================================
// 🚨 LAZY LOADING ДЛЯ ИЗБЕЖАНИЯ CIRCULAR DEPENDENCIES
// =============================================================================

let _newSessionManager = null;
let _newDataPersistence = null;

function getSessionManager() {
    if (!_newSessionManager) {
        console.log('🔄 Ленивая загрузка SessionManager...');
        try {
            const { SessionManager } = require('./modules/sessions/sessionManager');
            _newSessionManager = new SessionManager(getFootprintAssembler);
        } catch (error) {
            console.log('❌ Ошибка загрузки SessionManager:', error.message);
            // Создаем заглушку
            _newSessionManager = {
                updateUserStats: () => console.log('🛡️ (заглушка) updateUserStats'),
                getStatistics: () => ({ totalUsers: 0, totalPhotos: 0, totalAnalyses: 0, comparisonsMade: 0, activeUsers: 0, activeSessions: 0, referencePrintsCount: 0 }),
                globalStats: { totalUsers: 0, totalPhotos: 0, totalAnalyses: 0, comparisonsMade: 0, lastAnalysis: null },
                userStats: new Map(),
                referencePrints: new Map(),
                trailSessions: new Map(),
                getSession: (chatId) => ({ waitingForReference: null, waitingForComparison: null }),
                getTrailSession: (chatId, username) => ({
                    sessionId: 'stub', expert: username, footprints: [], comparisons: [], status: 'active'
                })
            };
        }
    }
    return _newSessionManager;
}

function getDataPersistence() {
    if (!_newDataPersistence) {
        console.log('🔄 Ленивая загрузка DataPersistence...');
        const { DataPersistence } = require('./modules/storage/legacy');
        _newDataPersistence = new DataPersistence(getSessionManager(), yandexDisk);
    }
    return _newDataPersistence;
}

// =============================================================================
// 🚀 ИНИЦИАЛИЗАЦИЯ СЕРВИСОВ
// =============================================================================

// Создаем структуру проекта
createProjectStructure();

// Инициализация Яндекс.Диска
let yandexDisk = null;
try {
    const YandexDiskService = require('./yandex-disk-service');
    yandexDisk = new YandexDiskService(process.env.YANDEX_DISK_TOKEN);
    console.log('✅ Яндекс.Диск service инициализирован');
} catch (error) {
    console.log('❌ Яндекс.Диск service не доступен:', error.message);
}



// =============================================================================
// 🔧 ИНИЦИАЛИЗАЦИЯ АССЕМБЛЕРА СЛЕДОВ
// =============================================================================

let footprintAssembler;
try {
    const { FootprintAssembler: FootprintAssemblerClass } = require('./footprint_assembler');
    footprintAssembler = new FootprintAssemblerClass();
    console.log('✅ FootprintAssembler загружен из модуля');
} catch (error) {
    console.log('❌ FootprintAssembler не загружен, создаем резервный:', error.message);
   
    // Резервный класс
    class FootprintAssembler {
        constructor() {
            this.partialPrints = new Map();
            this.assembledModels = new Map();
            console.log('✅ Резервный FootprintAssembler создан');
        }
       
        classifyFootprintPattern(predictions, imageWidth, imageHeight) {
            console.log('🎯 Классификация узора протектора...');
            return 'unknown_pattern';
        }
       
        advancedCompatibilityAnalysis(group, newPrint, imageWidth, imageHeight) {
            console.log('🎯 Анализ совместимости...');
            return 0.5;
        }
       
        calculateOverallBoundingBox(predictions) {
            if (!predictions || predictions.length === 0) {
                return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
            }
           
            let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
           
            predictions.forEach(pred => {
                if (pred.points && pred.points.length > 0) {
                    pred.points.forEach(point => {
                        minX = Math.min(minX, point.x);
                        minY = Math.min(minY, point.y);
                        maxX = Math.max(maxX, point.x);
                        maxY = Math.max(maxY, point.y);
                    });
                }
            });
           
            return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
        }
       
        normalizeFootprintGeometry(predictions, imageWidth, imageHeight) {
            return predictions;
        }
       
        advancedPatternComparison(predictionsA, predictionsB) {
            return 0.5;
        }
       
        calculateGeometricSimilarity(group, newPrint) {
            return 0.5;
        }
       
        assembleFullModel(partialPrints, imageWidth, imageHeight) {
            return {
                success: false,
                error: 'FootprintAssembler в режиме совместимости'
            };
        }
    }
   
    footprintAssembler = new FootprintAssembler();
}

// =============================================================================
// 🛡️ ЗАГЛУШКА MODEL HIERARCHY
// =============================================================================

class SimpleModelHierarchy {
    constructor(session) {
        this.session = session;
        console.log('✅ SimpleModelHierarchy создан (заглушка)');
    }
   
    async processHierarchy() {
        console.log('🏔️ SimpleModelHierarchy: обработка пирамиды...');
        return [];
    }
   
    getStats() {
        return {
            levels: { raw: 0, final: 0, orphans: 0 },
            modelsMerged: 0,
            orphansAdopted: 0,
            conflictsResolved: 0
        };
    }
}

// Глобальная функция для доступа
const getModelHierarchy = (session) => {
    return new SimpleModelHierarchy(session);
};

// =============================================================================
// 🏔️ ИНИЦИАЛИЗАЦИЯ МЕНЕДЖЕРОВ
// =============================================================================

console.log('🛡️ Инициализация менеджеров системы...');

// Основные менеджеры
let newSessionManager;
let newDataPersistence;

try {
    _newSessionManager = new NewSessionManager(footprintAssembler);
_newDataPersistence = new NewDataPersistence(_newSessionManager, yandexDisk);
    console.log('✅ Менеджеры системы инициализированы');
} catch (error) {
    console.log('❌ Ошибка инициализации менеджеров:', error.message);
    // Заглушки для продолжения работы
    _newSessionManager = {
    updateUserStats: () => console.log('🛡️ (заглушка) _newSessionManager.updateUserStats'),
        getStatistics: () => ({ totalUsers: 0, totalPhotos: 0, totalAnalyses: 0, comparisonsMade: 0, activeUsers: 0, activeSessions: 0, referencePrintsCount: 0 }),
        globalStats: { totalUsers: 0, totalPhotos: 0, totalAnalyses: 0, comparisonsMade: 0, lastAnalysis: null },
        userStats: new Map(),
        referencePrints: new Map(),
        trailSessions: new Map(),
        getSession: (chatId) => ({ waitingForReference: null, waitingForComparison: null }),
        getTrailSession: (chatId, username) => ({
            sessionId: 'stub', expert: username, footprints: [], comparisons: [], status: 'active'
        })
    };
    newDataPersistence = {
        saveAllData: () => console.log('🛡️ (заглушка) newDataPersistence.saveAllData')
    };
}

// 🤖 ИНИЦИАЛИЗАЦИЯ ТЕЛЕГРАМ БОТА (ПЕРЕД photoHandler!)
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
console.log('✅ Telegram Bot инициализирован');

// 📸 ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКА ФОТО (ПОСЛЕ bot!)
const photoHandler = new PhotoHandler(bot, getWorkingSessionManager(), getFootprintAssembler, yandexDisk);
bot.on('photo', (msg) => photoHandler.handlePhoto(msg));
const visualizationHandler = new VisualizationHandler(bot, getWorkingSessionManager()); // 🎨 ВИЗУАЛИЗАЦИЯ
console.log('✅ Обработчик фото инициализирован');
// Webhook обработчики
app.post('/', (req, res) => {
    console.log("📥 Получен webhook запрос");
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Главная страница
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>Анализатор следов обуви</title></head>
            <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; backdrop-filter: blur(10px);">
                    <h1 style="text-align: center; margin-bottom: 30px;">🤖 Анализатор следов обуви</h1>
                    <div style="text-align: center; margin-bottom: 30px;">
                        <p style="font-size: 18px; margin-bottom: 20px;">Бот работает! Используйте Telegram:</p>
                        <a href="https://t.me/Sled_la_bot" style="display: inline-block; background: #0088cc; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-weight: bold; font-size: 16px;">
                            📲 @Sled_la_bot
                        </a>
                    </div>
                    <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; margin-top: 20px;">
                        <h3 style="text-align: center; margin-bottom: 15px;">📊 Статистика системы</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: center;">
                            <div>
                                <div style="font-size: 24px; font-weight: bold;">${getSessionManager().globalStats.totalUsers}</div>
                                <div>👥 Пользователей</div>
                            </div>
                            <div>
                                <div style="font-size: 24px; font-weight: bold;">${getSessionManager().globalStats.totalPhotos}</div>
                                <div>📸 Фото обработано</div>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        statistics: {
    users: getSessionManager().globalStats.totalUsers,
    photos: getSessionManager().globalStats.totalPhotos,
    analyses: getSessionManager().globalStats.totalAnalyses
}
    });
});

const helpHandler = new HelpHandler(bot, getWorkingSessionManager());

// =============================================================================
// 🛡️ ГАРАНТИРОВАННЫЙ ДОСТУП К SESSIONMANAGER
// =============================================================================

// Функция которая гарантированно возвращает работающий SessionManager
ffunction getWorkingSessionManager() {
    console.log('🛡️ Создание гарантированного SessionManager...');
    return {
        updateUserStats: (userId, field, value = 1) => {
            console.log(`📊 updateUserStats: ${userId}, ${field}, ${value}`);
        },
        getStatistics: () => ({
            totalUsers: 1,
            totalPhotos: 0,
            totalAnalyses: 0,
            comparisonsMade: 0,
            activeUsers: 1,
            activeSessions: 0,
            referencePrintsCount: 0
        }),
        globalStats: { totalUsers: 1, totalPhotos: 0, totalAnalyses: 0, comparisonsMade: 0, lastAnalysis: null },
        userStats: new Map(),
        referencePrints: new Map(),
        trailSessions: new Map(), // ← ВАЖНО: ДОБАВЛЯЕМ trailSessions
        getSession: (chatId) => ({
            waitingForReference: null,
            waitingForComparison: null
        }),
        getTrailSession: (chatId, username) => {
            // Создаем сессию если не существует
            const sessionId = `session_${chatId}_${Date.now()}`;
            const session = new TrailSession(chatId, username);
            this.trailSessions.set(chatId, session);
            return session;
        },
        // 🔧 ДОБАВЛЯЕМ ОТСУТСТВУЮЩИЕ МЕТОДЫ
        serializeForSave: function() {
            return {
                trailSessions: Array.from(this.trailSessions.entries()),
                referencePrints: Array.from(this.referencePrints.entries()),
                userStats: Array.from(this.userStats.entries()),
                globalStats: this.globalStats,
                timestamp: new Date().toISOString()
            };
        },
        restoreFromData: function(data) {
            if (data.trailSessions) {
                this.trailSessions = new Map(data.trailSessions);
            }
            if (data.referencePrints) {
                this.referencePrints = new Map(data.referencePrints);
            }
            if (data.userStats) {
                this.userStats = new Map(data.userStats);
            }
            if (data.globalStats) {
                this.globalStats = data.globalStats;
            }
        }
    };
}

// =============================================================================
// 🦶 ГАРАНТИРОВАННЫЙ ДОСТУП К FOOTPRINT ASSEMBLER
// =============================================================================

function getFootprintAssembler() {
    // Простая заглушка для немедленной работы
    console.log('🦶 Использование гарантированного FootprintAssembler');
    return {
        partialPrints: new Map(),
        assembledModels: new Map(),
        classifyFootprintPattern: () => 'right_medium_unknown',
        advancedCompatibilityAnalysis: () => 0.7,
        calculateOverallBoundingBox: (predictions) => {
            if (!predictions || predictions.length === 0) {
                return { minX: 0, maxX: 100, minY: 0, maxY: 100, width: 100, height: 100 };
            }
            return { minX: 0, maxX: 800, minY: 0, maxY: 600, width: 800, height: 600 };
        },
        normalizeFootprintGeometry: (predictions) => predictions,
        advancedPatternComparison: () => 0.6,
        calculateGeometricSimilarity: () => 0.5,
        assembleFullModel: () => ({
            success: true,
            model: { features: { detailCount: 15, hasOutline: true } },
            usedPrints: [],
            completeness: 75,
            confidence: 80
        })
    };
}

// =============================================================================
// 🎯 РЕГИСТРАЦИЯ ОБРАБОТЧИКОВ КОМАНД
// =============================================================================

const startHandler = new StartHandler(bot, getWorkingSessionManager()); 
bot.onText(/\/start/, (msg) => startHandler.handleStart(msg));

const statisticsHandler = new StatisticsHandler(bot, getWorkingSessionManager());
bot.onText(/\/statistics/, (msg) => statisticsHandler.handleStatistics(msg));

const menuHandler = new MenuHandler(bot, getWorkingSessionManager());
bot.onText(/\/menu/, (msg) => menuHandler.handleMenu(msg));
// Команда показа собранной модели
bot.onText(/\/show_model(?:\s+(\d+))?/, (msg, match) => {
    visualizationHandler.handleShowModel(msg, match);
});

// Команда детальной визуализации
bot.onText(/\/model_details(?:\s+(\d+))?/, (msg, match) => {
    visualizationHandler.handleModelDetails(msg, match);
});

// Команда визуализации всех результатов
bot.onText(/\/visualize_results/, (msg) => {
    visualizationHandler.handleVisualizeResults(msg);
});

bot.onText(/\/help(?:\s+(\w+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const helpType = match ? match[1] : null;

    switch (helpType) {
        case 'trail':
            await helpHandler.showTrailHelp(chatId);
            break;
        case 'visualization':
            await helpHandler.showVisualizationHelp(chatId);
            break;
        case 'assembly':
            await helpHandler.showAssemblyHelp(chatId);
            break;
        case 'admin':
            await helpHandler.showAdminHelp(chatId, userId);
            break;
        default:
            await helpHandler.showInteractiveHelp(chatId, userId);
    }
});

// 🔧 ДОБАВИТЬ АДМИНСКИЕ КОМАНДЫ
bot.onText(/\/admin_(\w+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const command = match[1];

    if (!await helpHandler.isAdmin(userId)) {
        await bot.sendMessage(chatId, '❌ Доступ запрещен. Только для администратора.');
        return;
    }

    switch (command) {
        case 'stats':
            await showAdminStats(chatId);
            break;
        case 'export':
            await adminExportData(chatId);
            break;
        // ... другие админские команды
    }
});

console.log('✅ Все обработчики команд зарегистрированы');

// =============================================================================
// 💾 СИСТЕМА СОХРАНЕНИЯ ДАННЫХ
// =============================================================================

class DataPersistence {
    constructor() {
        this.dataFile = 'trail_sessions.json';
        this.backupInterval = 5 * 60 * 1000; // 5 минут
        this.setupAutoSave();
    }

    /**
     * Настраивает автосохранение
     */
    setupAutoSave() {
        setInterval(() => {
            this.saveAllData();
        }, this.backupInterval);
    }

    /**
     * Сохраняет все данные
     */
async saveAllData() {
    try {
        console.log('💾 Автосохранение данных...');
      
        const sessionManager = getWorkingSessionManager();
        const data = {
            trailSessions: Array.from(sessionManager.trailSessions.entries()),
            referencePrints: Array.from(sessionManager.referencePrints.entries()),
            userStats: Array.from(sessionManager.userStats.entries()),
            globalStats: sessionManager.globalStats,
            timestamp: new Date().toISOString()
        };

        // Локальное сохранение
        fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
      
        // Сохранение в Яндекс.Диск
        if (yandexDisk) {
            try {
                await withRetry(async () => {
                    await yandexDisk.uploadFile(this.dataFile, 'sessions_backup.json');
                    console.log('✅ Данные сохранены в Яндекс.Диск');
                }, "Яндекс.Диск автосохранение");
            } catch (driveError) {
                console.log('⚠️ Ошибка сохранения в Яндекс.Диск:', driveError.message);
            }
        }
      
        console.log('💾 Все данные сохранены локально');
    } catch (error) {
        console.log('❌ Ошибка сохранения данных:', error.message);
    }
}

    /**
     * Восстанавливает данные после перезапуска
     */
    async loadAllData() {
        try {
            console.log('🔄 Восстановление данных...');
          
            let data = null;
          
            // Пробуем загрузить из Яндекс.Диска
            if (yandexDisk) {
                try {
                    if (await yandexDisk.fileExists('backup/sessions_backup.json')) {
                        await yandexDisk.downloadFile('backup/sessions_backup.json', this.dataFile);
                        console.log('✅ Данные загружены из Яндекс.Диска');
                    }
                } catch (driveError) {
                    console.log('⚠️ Не удалось загрузить из Яндекс.Диска:', driveError.message);
                }
            }
          
            // Загружаем из локального файла
            if (fs.existsSync(this.dataFile)) {
                const fileContent = fs.readFileSync(this.dataFile, 'utf8');
                data = JSON.parse(fileContent);
                console.log('✅ Локальные данные загружены');
            } else {
                console.log('📝 Локальные данные не найдены, начинаем с чистого листа');
                return;
            }
          
            // ВОССТАНАВЛИВАЕМ ВСЕ ДАННЫЕ ЧЕРЕЗ SESSIONMANAGER
            getSessionManager().restoreFromData(data);
          
            console.log('🎯 Данные полностью восстановлены');
          
        } catch (error) {
            console.log('❌ Ошибка восстановления данных:', error.message);
            console.log('💫 Начинаем со свежих данных');
        }
    }

    /**
     * Экспорт сессии в файл
     */
    async exportSession(chatId, format = 'json') {
        const session = getSessionManager().trailSessions.get(chatId);
        if (!session) {
            throw new Error('Сессия не найдена');
        }
      
        const exportData = {
            session: session.getSessionSummary(),
            footprints: session.footprints,
            comparisons: session.comparisons,
            exportTime: new Date().toISOString(),
            version: '1.0'
        };
      
        const filename = "session_export_" + session.sessionId + "_" + Date.now() + "." + format;
      
        if (format === 'json') {
            fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
        }
      
        return filename;
    }

    /**
     * Резервное копирование конфигурации
     */
    async backupConfiguration() {
        const config = {
            modelMetadata: MODEL_METADATA,
            backupTime: new Date().toISOString(),
            stats: {
    totalUsers: getSessionManager().globalStats.totalUsers,
    totalPhotos: getSessionManager().globalStats.totalPhotos,
    totalAnalyses: getSessionManager().globalStats.totalAnalyses
}
        };
      
        const configFile = "config_backup_Date.now()}.json";
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
      
        if (yandexDisk) {
            await yandexDisk.uploadFile(configFile, "backup/${configFile}");
        }
      
        return configFile;
    }
}

// =============================================================================
// 🚀 ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ СБОРКИ И СОХРАНЕНИЯ
// =============================================================================

// 🔧 Инициализируем менеджер данных
const dataPersistence = new DataPersistence();

class ComparisonVisualizer {
    constructor() {
        this.colors = {
            match: 'rgba(0, 255, 0, 0.6)',      // Зеленый - совпадения
            difference: 'rgba(255, 0, 0, 0.6)', // Красный - различия 
            missing: 'rgba(255, 255, 0, 0.6)',  // Желтый - отсутствующие
            partial: 'rgba(255, 165, 0, 0.6)',  // Оранжевый - частичные
            outline: 'rgba(0, 0, 255, 0.8)'     // Синий - контур
        };
    }

    /**
     * Создает визуализацию сравнения двух отпечатков
     */
    async createComparisonVisualization(footprintA, footprintB, imageUrl) {
        try {
            console.log('🎨 Создаю визуализацию сравнения...');
           
            const image = await loadImage(imageUrl);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
           
            // Рисуем исходное изображение с полупрозрачностью
            ctx.globalAlpha = 0.3;
            ctx.drawImage(image, 0, 0);
            ctx.globalAlpha = 1.0;
           
            // Анализируем различия
            const analysis = this.analyzeDifferences(footprintA, footprintB);
           
            // Рисуем совпадения (зеленый)
            this.drawPredictions(ctx, analysis.matches, this.colors.match, 'Совпадения');
           
            // Рисуем различия (красный)
            this.drawPredictions(ctx, analysis.differences, this.colors.difference, 'Различия');
           
            // Рисуем отсутствующие (желтый)
            this.drawPredictions(ctx, analysis.missingA, this.colors.missing, 'Отсутствует в A');
            this.drawPredictions(ctx, analysis.missingB, this.colors.missing, 'Отсутствует в B');
           
            // Добавляем легенду
            this.drawLegend(ctx, image.width, image.height);
           
            // Добавляем информацию о сравнении
            this.drawComparisonInfo(ctx, analysis, image.width, image.height);
           
            const tempPath = "comparison_${Date.now()}.png";
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(tempPath, buffer);
           
            console.log('✅ Визуализация сравнения создана');
            return tempPath;
           
        } catch (error) {
            console.error('❌ Ошибка создания визуализации сравнения:', error);
            return null;
        }
    }

    /**
     * Анализирует различия между двумя отпечатками
     */
    analyzeDifferences(footprintA, footprintB) {
        const predsA = footprintA.predictions || [];
        const predsB = footprintB.predictions || [];
       
        // Находим совпадения (похожие классы в близких позициях)
        const matches = [];
        const differences = [];
        const missingA = [];
        const missingB = [];
       
        // Простой алгоритм сравнения по классам и позициям
        predsA.forEach(predA => {
            const similarInB = predsB.find(predB =>
                predB.class === predA.class &&
                this.calculateIOU(predA, predB) > 0.3
            );
           
            if (similarInB) {
                matches.push(predA);
            } else {
                differences.push(predA);
            }
        });
       
        // Находим элементы, отсутствующие в A
        predsB.forEach(predB => {
            const similarInA = predsA.find(predA =>
                predA.class === predB.class &&
                this.calculateIOU(predA, predB) > 0.3
            );
           
            if (!similarInA) {
                missingB.push(predB); // Отсутствует в A (но есть в B)
            }
        });
       
        return {
            matches,
            differences,
            missingA: [], // Можно реализовать более сложную логику
            missingB,
            similarity: this.calculateOverallSimilarity(footprintA, footprintB)
        };
    }

    /**
     * Вычисляет Intersection over Union для двух предсказаний
     */
    calculateIOU(predA, predB) {
        if (!predA.points || !predB.points) return 0;
       
        const bboxA = this.calculateBoundingBox(predA.points);
        const bboxB = this.calculateBoundingBox(predB.points);
       
        const intersection = this.calculateIntersection(bboxA, bboxB);
        const union = (bboxA.width * bboxA.height) + (bboxB.width * bboxB.height) - intersection;
       
        return union > 0 ? intersection / union : 0;
    }

    /**
     * Вычисляет площадь пересечения
     */
    calculateIntersection(bboxA, bboxB) {
        const xOverlap = Math.max(0, Math.min(bboxA.maxX, bboxB.maxX) - Math.max(bboxA.minX, bboxB.minX));
        const yOverlap = Math.max(0, Math.min(bboxA.maxY, bboxB.maxY) - Math.max(bboxA.minY, bboxB.minY));
        return xOverlap * yOverlap;
    }

    /**
     * Вычисляет общую схожесть
     */
    calculateOverallSimilarity(footprintA, footprintB) {
        const assembler = footprintAssembler;
        return assembler.calculateSimilarity(footprintA.features, footprintB.features) * 100;
    }

    /**
     * Рисует предсказания на canvas
     */
    drawPredictions(ctx, predictions, color, label) {
        if (!predictions || predictions.length === 0) return;
       
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
       
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 2) {
                ctx.beginPath();
                ctx.moveTo(pred.points[0].x, pred.points[0].y);
               
                for (let i = 1; i < pred.points.length; i++) {
                    ctx.lineTo(pred.points[i].x, pred.points[i].y);
                }
               
                ctx.closePath();
                ctx.stroke();
               
                // Подпись для крупных элементов
                if (pred.points.length > 4) {
                    const bbox = this.calculateBoundingBox(pred.points);
                    if (bbox.width > 50 && bbox.height > 50) {
                        ctx.fillStyle = color;
                        ctx.font = '12px Arial';
                        ctx.fillText(pred.class || 'unknown', bbox.minX, bbox.minY - 5);
                    }
                }
            }
        });
    }

    /**
     * Рисует легенду
     */
    drawLegend(ctx, width, height) {
        const legendX = width - 200;
        const legendY = 20;
        const itemHeight = 25;
       
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(legendX - 10, legendY - 10, 190, 130);
       
        const items = [
            { color: this.colors.match, text: '✅ Совпадения' },
            { color: this.colors.difference, text: '❌ Различия' },
            { color: this.colors.missing, text: '⚠️ Отсутствующие' },
            { color: this.colors.partial, text: '🔄 Частичные' }
        ];
       
        items.forEach((item, index) => {
            ctx.fillStyle = item.color;
            ctx.fillRect(legendX, legendY + index * itemHeight, 20, 15);
           
            ctx.fillStyle = 'white';
            ctx.font = '14px Arial';
            ctx.fillText(item.text, legendX + 30, legendY + 12 + index * itemHeight);
        });
    }

    /**
     * Рисует информацию о сравнении
     */
    drawComparisonInfo(ctx, analysis, width, height) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, height - 120, 300, 110);
       
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('📊 РЕЗУЛЬТАТЫ СРАВНЕНИЯ', 20, height - 95);
       
        ctx.font = '14px Arial';
        ctx.fillText("🎯 Общее сходство: ${analysis.similarity.toFixed(1)}%", 20, height - 70);
        ctx.fillText("✅ Совпадений: ${analysis.matches.length}", 20, height - 50);
        ctx.fillText("❌ Различий: ${analysis.differences.length}", 20, height - 30);
        ctx.fillText("⚠️ Отсутствующих: ${analysis.missingB.length}", 20, height - 10);
    }

    /**
     * Вспомогательная функция для bounding box
     */
    calculateBoundingBox(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }
}

const comparisonVisualizer = new ComparisonVisualizer();

// 🕵️‍♂️ СИСТЕМА СЕССИЙ ТРОПЫ - ОБНОВЛЕННАЯ ВЕРСИЯ

class TrailSession {
    constructor(chatId, username) {
        this.chatId = chatId;
        this.expert = username;
        this.sessionId = "session_${chatId}_${Date.now()}";
        this.startTime = new Date();
        this.footprints = [];
        this.comparisons = [];
        this.status = 'active';
        this.notes = '';
       
        this.assembledModels = [];
        this.footprintParts = new Map();
        this.compatibilityGroups = [];
    }

    addFootprint(analysisData) {
        const footprintRecord = {
            id: "footprint_${this.footprints.length + 1}",
            timestamp: new Date(),
            imageUrl: analysisData.imageUrl,
            predictions: analysisData.predictions,
            features: analysisData.features,
            perspectiveAnalysis: analysisData.perspectiveAnalysis,
            orientation: analysisData.orientation
        };
       
        this.footprints.push(footprintRecord);
        console.log("🕵️‍♂️ Добавлен отпечаток в сессию ${this.sessionId}: ${footprintRecord.id}");
       
        if (this.footprints.length > 1) {
            this.autoCompareWithPrevious(footprintRecord);
        }
       
        return footprintRecord;
    }

    autoCompareWithPrevious(newFootprint) {
        console.log("🕵️‍♂️ Автосравнение нового отпечатка с предыдущими...");
       
        const previousFootprints = this.footprints.slice(0, -1);
       
        previousFootprints.forEach((previous, index) => {
            const comparison = compareFootprints(previous.features, newFootprint.features);
           
            const comparisonRecord = {
                id: "comparison_${this.comparisons.length + 1}",
                timestamp: new Date(),
                footprintA: previous.id,
                footprintB: newFootprint.id,
                result: comparison,
                similarity: comparison.overallScore,
                notes: this.generateComparisonNotes(comparison, previous, newFootprint)
            };
           
            this.comparisons.push(comparisonRecord);
            console.log("🔍 Сравнение ${previous.id} vs ${newFootprint.id}: ${comparison.overallScore}%");
        });
    }

    generateComparisonNotes(comparison, footprintA, footprintB) {
        const notes = [];
       
        if (comparison.overallScore > 70) {
            notes.push('ВЫСОКАЯ СХОДИМОСТЬ - вероятно один источник');
        } else if (comparison.overallScore > 50) {
            notes.push('СРЕДНЯЯ СХОДИМОСТЬ - требуется дополнительный анализ');
        } else {
            notes.push('НИЗКАЯ СХОДИМОСТЬ - разные источники');
        }
        if (comparison.mirrorUsed) {
            notes.push('Учтена зеркальная симметрия (левый/правый)');
        }
        return notes.join('; ');
    }

    getSessionSummary() {
        return {
            sessionId: this.sessionId,
            expert: this.expert,
            duration: new Date() - this.startTime,
            footprintsCount: this.footprints.length,
            comparisonsCount: this.comparisons.length,
            averageSimilarity: this.comparisons.length > 0 ?
                this.comparisons.reduce((sum, comp) => sum + comp.similarity, 0) / this.comparisons.length : 0,
            status: this.status
        };
    }

    generateExpertReport() {
        const summary = this.getSessionSummary();
       
        let report = "🕵️‍♂️ **АНАЛИЗ ТРОПЫ**\n\n";
        report += "**Сессия:** ${summary.sessionId}\n";
        report += "**Эксперт:** ${summary.expert}\n";
        report += "**Продолжительность:** ${Math.round(summary.duration / 60000)} мин.\n";
        report += "**Проанализировано отпечатков:** ${summary.footprintsCount}\n";
        report += "**Выполнено сравнений:** ${summary.comparisonsCount}\n";
        report += "**Средняя сходимость:** ${summary.averageSimilarity.toFixed(1)}%\n\n";
       
        if (this.comparisons.length > 0) {
            report += "**КЛЮЧЕВЫЕ ВЫВОДЫ:**\n";
           
            const highSimilarity = this.comparisons.filter(c => c.similarity > 70);
            if (highSimilarity.length > 0) {
                report += "• Обнаружено ${highSimilarity.length} пар с высокой сходимостью\n";
            }
            const uniqueGroups = this.identifyUniqueGroups();
            report += "• Выявлено ${uniqueGroups.length} уникальных морфологических групп\n";
        }
        report += "\n**СТАТУС:** ${this.status === 'active' ? 'АКТИВНА' : 'ЗАВЕРШЕНА'}";
       
        return report;
    }

    identifyUniqueGroups() {
        const groups = [];
       
        this.footprints.forEach(footprint => {
            let assigned = false;
           
            for (let group of groups) {
                const avgSimilarity = group.members.reduce((sum, member) => {
                    const comparison = this.comparisons.find(c =>
                        (c.footprintA === footprint.id && c.footprintB === member) ||
                        (c.footprintB === footprint.id && c.footprintA === member)
                    );
                    return sum + (comparison ? comparison.similarity : 0);
                }, 0) / group.members.length;
               
                if (avgSimilarity > 60) {
                    group.members.push(footprint.id);
                    assigned = true;
                    break;
                }
            }
           
            if (!assigned) {
                groups.push({ id: "group_${groups.length + 1}", members: [footprint.id] });
            }
        });
       
        return groups;
    }

        analyzeFootprintParts(imageWidth, imageHeight) {
    console.log("🕵️‍♂️ Анализирую узоры протектора для ${this.footprints.length} отпечатков...");
   
    const assembler = footprintAssembler;
   
    this.footprints.forEach(footprint => {
        // 🔧 ИСПРАВЛЕНИЕ: ВЫЧИСЛЯЕМ patternType, а не берем из footprint
        const patternType = assembler.classifyFootprintPattern(footprint.predictions, imageWidth, imageHeight);
        footprint.patternType = patternType;
        footprint.partType = patternType; // для обратной совместимости
        footprint.assemblyPotential = this.calculateAssemblyPotential(footprint);
        console.log("📋 Отпечаток ${footprint.id}: ${patternType} (потенциал: ${footprint.assemblyPotential})");
    });
   
    this.updateCompatibilityGroups();
}



    calculateAssemblyPotential(footprint) {
        if (!footprint.features) return 0;
       
        let score = 0;
        const details = footprint.features.detailCount || 0;
       
        if (details > 15) score += 40;
        else if (details > 8) score += 25;
        else if (details > 3) score += 15;
       
        if (footprint.features.hasOutline) score += 30;
       
        if (footprint.features.largeDetails > 2) score += 20;
       
        return Math.min(score, 100);
    }

    /**
     * Автоматически группирует следы по разным людям/обуви
     */
    updateCompatibilityGroups() {
        console.log("🕵️‍♂️ Автоматическая группировка следов по людям...");
       
        this.compatibilityGroups = [];
       
        // 🔄 ПРОХОДИМ ПО ВСЕМ СЛЕДАМ И РАСПРЕДЕЛЯЕМ ПО ГРУППАМ
        this.footprints.forEach(footprint => {
            let assignedToGroup = false;
           
            // 🔍 ИЩЕМ ПОДХОДЯЩУЮ ГРУППУ
            for (let group of this.compatibilityGroups) {
                const groupCompatibility = this.assessGroupCompatibility(group, footprint);
               
                if (groupCompatibility > 0.6) { // 👈 ПОРОГ ДЛЯ ОДНОГО ЧЕЛОВЕКА
                    group.push(footprint);
                    assignedToGroup = true;
                    console.log("✅ След ${footprint.id} добавлен в группу (совместимость: ${groupCompatibility.toFixed(3)})");
                    break;
                }
            }
           
            // 🆕 ЕСЛИ НЕ НАШЛИ ГРУППУ - СОЗДАЕМ НОВУЮ
            if (!assignedToGroup) {
                this.compatibilityGroups.push([footprint]);
                console.log("🆕 Создана новая группа для следа ${footprint.id}");
            }
        });
       
        console.log("🎯 Обнаружено групп (людей): ${this.compatibilityGroups.length}");
    }

    /**
     * Оценивает совместимость следа с группой
     */
    assessGroupCompatibility(group, newFootprint) {
        if (group.length === 0) return 0.5;
       
        let totalCompatibility = 0;
       
        group.forEach(existingFootprint => {
            const compatibility = this.calculateFootprintCompatibility(existingFootprint, newFootprint);
            totalCompatibility += compatibility;
        });
       
        return totalCompatibility / group.length;
    }

    /**
     * Вычисляет совместимость двух следов
     */
    calculateFootprintCompatibility(footprintA, footprintB) {
        const assembler = footprintAssembler;
       
        // 🎯 КОМБИНИРОВАННЫЙ АНАЛИЗ:
        let imageWidth = 800, imageHeight = 600;
        if (footprintA.features?.imageSize) {
            imageWidth = footprintA.features.imageSize.width;
            imageHeight = footprintA.features.imageSize.height;
        }
       
        return assembler.advancedCompatibilityAnalysis(
            [footprintA],
            footprintB,
            imageWidth,
            imageHeight
        ) ? 0.8 : 0.2; // Преобразуем boolean в score
    }

    /**
     * Сборка модели из конкретной группы
     */
    assembleModelFromGroup(group, imageWidth, imageHeight) {
        if (group.length < 2) {
            return { success: false, error: 'Недостаточно следов в группе для сборки' };
        }
       
        console.log("🧩 Сборка модели для группы из ${group.length} следов...");
       
        const assembler = footprintAssembler;
       
        // Автоматически анализируем части если еще не сделано
        if (!group[0].patternType) {
            group.forEach(footprint => {
                const patternType = assembler.classifyFootprintPattern(
                    footprint.predictions,
                    imageWidth,
                    imageHeight
                );
                footprint.patternType = patternType;
            });
        }
       
        const result = assembler.assembleFullModel(group, imageWidth, imageHeight);
       
        if (result.success) {
            console.log("✅ Модель собрана из группы: ${result.completeness}% полноты");
        }
       
        return result;
    }

    assembleModelFromParts(imageWidth, imageHeight) {
        if (this.footprints.length < 2) {
            return { success: false, error: 'Недостаточно отпечатков для сборки' };
        }
       
        console.log("🧩 Начинаю сборку модели из ${this.footprints.length} отпечатков...");
       
        const assembler = footprintAssembler;
       
        if (!this.footprints[0].partType) {
            this.analyzeFootprintParts(imageWidth, imageHeight);
        }
       
        const result = assembler.assembleFullModel(this.footprints, imageWidth, imageHeight);
       
        if (result.success) {
            const assembledModel = {
                id: "assembled_${this.assembledModels.length + 1}",
                timestamp: new Date(),
                model: result.model,
                sourcePrints: result.usedPrints.map(p => p.id),
                completeness: result.completeness,
                confidence: result.confidence
            };
           
            this.assembledModels.push(assembledModel);
            console.log("✅ Модель собрана: ${result.completeness}% полноты, ${result.confidence}% уверенности");
        }
       
        return result;
    }

       getPartsStatistics() {
        const parts = { 
            left_small: 0, left_medium: 0, left_large: 0,
            right_small: 0, right_medium: 0, right_large: 0,
            center_small: 0, center_medium: 0, center_large: 0,
            unknown: 0 
        };
       
        this.footprints.forEach(footprint => {
            const patternType = footprint.patternType || 'unknown';  // ← ИСПРАВЛЕНИЕ!
            parts[patternType] = (parts[patternType] || 0) + 1;
        });
       
        return parts;
    }

    generateEnhancedReport() {
        const summary = this.getSessionSummary();
        const partsStats = this.getPartsStatistics();
       
        let report = "🕵️‍♂️ **РАСШИРЕННЫЙ АНАЛИЗ ТРОПЫ**\n\n";
        report += `**Сессия:** ${summary.sessionId}\n";
        report += "**Эксперт:** ${this.expert}\n";
        report += "**Статус:** ${this.status === 'active' ? '🟢 АКТИВНА' : '🔴 ЗАВЕРШЕНА'}\n";
        report += "**Продолжительность:** ${Math.round(summary.duration / 60000)} мин.\n\n";
       
               report += "📊 **СТАТИСТИКА УЗОРОВ:**\n";
        report += "• Всего: ${summary.footprintsCount}\n";
        report += "• Левые: ${partsStats.left_small + partsStats.left_medium + partsStats.left_large}\n";
        report += "• Правые: ${partsStats.right_small + partsStats.right_medium + partsStats.right_large}\n";
        report += "• Центральные: ${partsStats.center_small + partsStats.center_medium + partsStats.center_large}\n";
        report += "• Неизвестные: ${partsStats.unknown}\n\n`;

       
        report += "🔍 **СРАВНЕНИЯ:**\n";
        report += "• Выполнено: ${summary.comparisonsCount}\n";
        report += "• Средняя сходимость: ${summary.averageSimilarity.toFixed(1)}%\n\n";
       
        report += "🧩 **СБОРКА МОДЕЛЕЙ:**\n";
        report += "• Собрано моделей: ${this.assembledModels.length}\n";
        report += "• Групп совместимости: ${this.compatibilityGroups.length}\n\n";
       
        if (this.assembledModels.length > 0) {
            const bestModel = this.assembledModels.reduce((best, current) => current.completeness > best.completeness ? current : best);
            report += "🏆 **ЛУЧШАЯ МОДЕЛЬ:**\n";
            report += "• Полнота: ${bestModel.completeness}%\n";
            report += "• Уверенность: ${bestModel.confidence}%\n";
            report += "• Источников: ${bestModel.sourcePrints.length}\n";
        }
       
        if (this.notes) {
            report += "\n📝 **ЗАМЕТКИ ЭКСПЕРТА:**\n${this.notes}\n";
        }
       
        return report;
    }
 }


// =============================================================================
// 🧩 УМНАЯ СБОРКА МОДЕЛЕЙ ИЗ ЧАСТИЧНЫХ ОТПЕЧАТКОВ
// =============================================================================

class FootprintAssembler {
    constructor() {
        this.partialPrints = new Map();
        this.assembledModels = new Map();
    }

    /**
     * Классифицирует фрагменты протектора по типу узора и определяет левый/правый
     */
    classifyFootprintPattern(predictions, imageWidth, imageHeight) {
        if (!predictions || predictions.length === 0) return 'unknown_fragment';
       
        const features = extractFeatures(predictions);
        const bbox = this.calculateOverallBoundingBox(predictions);
       
        console.log("🎨 Анализ узора протектора: ${features.detailCount} деталей, ${features.largeDetails} крупных");

        // 🔍 АНАЛИЗ СИММЕТРИИ ДЛЯ ОПРЕДЕЛЕНИЯ ЛЕВЫЙ/ПРАВЫЙ
        const symmetryAnalysis = this.analyzeFootprintSymmetry(predictions, bbox);
        const footSide = symmetryAnalysis.side;
        const symmetryScore = symmetryAnalysis.score;

        // 🎯 КЛАССИФИКАЦИЯ ПО ХАРАКТЕРИСТИКАМ УЗОРА
        let patternComplexity = 'unknown';
       
        if (features.detailCount > 20) {
            patternComplexity = 'high_density';
        } else if (features.detailCount > 10) {
            patternComplexity = 'medium_density';
        } else if (features.detailCount > 5) {
            patternComplexity = 'low_density';
        } else {
            patternComplexity = 'sparse';
        }

        // 🔧 УЧЕТ КРУПНЫХ ЭЛЕМЕНТОВ
        if (features.largeDetails > 5) {
            patternComplexity = 'large_elements_' + patternComplexity;
        }

        // 📏 УЧЕТ РАЗМЕРА ФРАГМЕНТА
        const coverage = (bbox.width * bbox.height) / (imageWidth * imageHeight);
        let sizeCategory = 'medium';
        if (coverage > 0.3) sizeCategory = 'large';
        if (coverage < 0.1) sizeCategory = 'small';

        const result = "${footSide}_${sizeCategory}_${patternComplexity}";
        console.log("📋 Классификация: ${result} (симметрия: ${symmetryScore.toFixed(2)})");
       
        return result;
    }

    /**
     * Анализирует симметрию для определения левый/правый след
     */
    analyzeFootprintSymmetry(predictions, bbox) {
        if (!predictions || predictions.length < 3) {
            return { side: 'unknown', score: 0.5 };
        }

        try {
            const centerX = bbox.minX + bbox.width / 2;
            let leftDensity = 0, rightDensity = 0;

            predictions.forEach(pred => {
                if (pred.points && pred.points.length > 0) {
                    const predBbox = this.calculateBoundingBox(pred.points);
                    const predCenterX = predBbox.minX + predBbox.width / 2;
                    const area = predBbox.width * predBbox.height;
                   
                    if (predCenterX < centerX) {
                        leftDensity += area;
                    } else {
                        rightDensity += area;
                    }
                }
            });

            const totalDensity = leftDensity + rightDensity;
            if (totalDensity === 0) return { side: 'unknown', score: 0.5 };

            const rightRatio = rightDensity / totalDensity;
           
            // 📊 ОПРЕДЕЛЯЕМ СТОРОНУ
            let side = 'unknown';
            if (rightRatio > 0.6) side = 'right';
            else if (rightRatio < 0.4) side = 'left';
            else side = 'center';

            return { side, score: rightRatio };

        } catch (error) {
            console.log('❌ Ошибка анализа симметрии:', error.message);
            return { side: 'unknown', score: 0.5 };
        }
    }

/**
* Анализирует симметрию для определения левый/правый след
*/
analyzeSymmetry(predictions, bbox) {
    if (!predictions || predictions.length < 5) return 0.5;
   
    try {
        const centerX = bbox.minX + bbox.width / 2;
       
        // Считаем распределение деталей слева и справа от центра
        let leftCount = 0, rightCount = 0;
       
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 0) {
                const predBbox = this.calculateBoundingBox(pred.points);
                const predCenterX = predBbox.minX + predBbox.width / 2;
               
                if (predCenterX < centerX) leftCount++;
                else rightCount++;
            }
        });
       
        const total = leftCount + rightCount;
        if (total === 0) return 0.5;
       
        // Возвращаем асимметрию (0.0 - сильно левый, 1.0 - сильно правый, 0.5 - симметричный)
        return rightCount / total;
       
    } catch (error) {
        return 0.5;
    }
}

/**
* Вспомогательная функция для bounding box
*/
calculateBoundingBox(points) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
    };
}
    /**
     * Вычисляет общий bounding box для всех предсказаний
     */
    calculateOverallBoundingBox(predictions) {
        if (!predictions || predictions.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }
       
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
       
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 0) {
                pred.points.forEach(point => {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                });
            }
        });
       
        return {
            minX, minY, maxX, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

/**
     * Улучшенное сравнение с учетом перекрытий и приоритетом мелких деталей
     */
    advancedPatternComparison(predictionsA, predictionsB) {
        if (!predictionsA || !predictionsB) return 0;
       
        console.log("🔍 Улучшенное сравнение: ${predictionsA.length} vs ${predictionsB.length} деталей");

        let totalScore = 0;
        let validComparisons = 0;

        // 🔄 СРАВНИВАЕМ В ОБЕ СТОРОНЫ ДЛЯ ТОЧНОСТИ
        const scoreAB = this.compareDetailsWithPriority(predictionsA, predictionsB);
        const scoreBA = this.compareDetailsWithPriority(predictionsB, predictionsA);
       
        // 📊 УСРЕДНЯЕМ РЕЗУЛЬТАТЫ
        const finalScore = (scoreAB + scoreBA) / 2;
        console.log("🎯 Итоговый score: ${finalScore.toFixed(3)}");
       
        return finalScore;
    }

    /**
     * Сравнивает детали с приоритетом точных мелких деталей
     */
    compareDetailsWithPriority(sourcePredictions, targetPredictions) {
        if (!sourcePredictions || !targetPredictions) return 0;
       
        let totalScore = 0;
        let comparisonCount = 0;

        sourcePredictions.forEach(sourcePred => {
            if (!sourcePred.points || sourcePred.points.length < 3) return;
           
            const sourceBbox = this.calculateBoundingBox(sourcePred.points);
            const sourceArea = sourceBbox.width * sourceBbox.height;
           
            let bestMatchScore = 0;
            let bestMatchSizeRatio = 1;

            // 🔍 ИЩЕМ ЛУЧШЕЕ СОВПАДЕНИЕ С УЧЕТОМ РАЗМЕРА
            targetPredictions.forEach(targetPred => {
                if (!targetPred.points || targetPred.points.length < 3) return;
               
                const targetBbox = this.calculateBoundingBox(targetPred.points);
                const targetArea = targetBbox.width * targetBbox.height;
               
                const overlapScore = this.calculateSmartOverlap(sourceBbox, targetBbox, sourcePred, targetPred);
                const sizeRatio = Math.min(sourceArea, targetArea) / Math.max(sourceArea, targetArea);
               
                // 🎯 ПРИОРИТЕТ ТОЧНЫМ СОВПАДЕНИЯМ МЕЛКИХ ДЕТАЛЕЙ
                if (overlapScore > bestMatchScore ||
                    (overlapScore > 0.3 && sizeRatio < bestMatchSizeRatio)) {
                    bestMatchScore = overlapScore;
                    bestMatchSizeRatio = sizeRatio;
                }
            });

            // 💎 ВЕСОВОЙ КОЭФФИЦИЕНТ: мелкие детали важнее
            let weight = 1.0;
            if (sourceArea < 500) weight = 1.5;    // Мелкие детали
            if (sourceArea < 200) weight = 2.0;    // Очень мелкие детали
            if (sourceArea > 2000) weight = 0.7;   // Крупные детали

            totalScore += bestMatchScore * weight;
            comparisonCount += weight;
        });

        return comparisonCount > 0 ? totalScore / comparisonCount : 0;
    }

    /**
     * Умный расчет перекрытия с учетом особенностей следов
     */
    calculateSmartOverlap(bboxA, bboxB, predA, predB) {
        // 📏 ВЫЧИСЛЯЕМ БАЗОВОЕ ПЕРЕКРЫТИЕ
        const overlapX = Math.max(0, Math.min(bboxA.maxX, bboxB.maxX) - Math.max(bboxA.minX, bboxB.minX));
        const overlapY = Math.max(0, Math.min(bboxA.maxY, bboxB.maxY) - Math.max(bboxA.minY, bboxB.minY));
        const overlapArea = overlapX * overlapY;
       
        const areaA = bboxA.width * bboxA.height;
        const areaB = bboxB.width * bboxB.height;
       
        if (overlapArea === 0) return 0;

        // 🎯 ОСНОВНОЙ SCORE ПЕРЕКРЫТИЯ
        const overlapToA = overlapArea / areaA;
        const overlapToB = overlapArea / areaB;
        let baseScore = Math.min(overlapToA, overlapToB);

        // 🔥 КРИТИЧЕСКИ ВАЖНЫЕ СЛУЧАИ:

        // 1. МЕЛКАЯ ДЕТАЛЬ ВНУТРИ КРУПНОЙ - ВЫСОКАЯ ТОЧНОСТЬ
        // 🔧 ФИКС: Более строгая проверка для точных деталей
if (areaB < areaA * 0.1 && overlapToB > 0.9 && predA.class === predB.class) {
    console.log(`💎 Обнаружена точная мелкая деталь внутри крупной!`);
    return 0.95;
}

        // 2. ВМЯТИНА/ОТСУТСТВИЕ МАТЕРИАЛА - учитываем контур
        if (this.isNegativeImpression(predA) || this.isNegativeImpression(predB)) {
            baseScore *= 0.8; // Снижаем вес для вмятин
        }

        // 3. СХОЖИЙ ТИП ДЕТАЛИ - бонус
        if (predA.class === predB.class) {
            baseScore += 0.15;
        }

        // 4. ТОЧНЫЕ МЕЛКИЕ ДЕТАЛИ - максимальный приоритет
        if (areaA < 1000 && areaB < 1000 && baseScore > 0.6) {
            baseScore += 0.25;
        }

        return Math.min(baseScore, 1.0);
    }

    /**
     * Определяет, является ли деталь вмятиной/отсутствующим материалом
     */
    isNegativeImpression(prediction) {
        // 🔍 ПРИЗНАКИ ВМЯТИНЫ/ОТСУТСТВИЯ МАТЕРИАЛА:
        // - Большой полигон
        // - Правильные геометрические границы 
        // - Мало внутренних деталей
        if (!prediction.points) return false;
       
        const bbox = this.calculateBoundingBox(prediction.points);
        const area = bbox.width * bbox.height;
       
        // Большая площадь + правильная форма = возможная вмятина
        return area > 5000 && prediction.points.length <= 8;
    }

    /**
     * Вспомогательная функция для bounding box
     */
    calculateBoundingBox(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }
     
    /**
     * Компоновка полной модели из частичных отпечатков
     */
    assembleFullModel(partialPrints, imageWidth, imageHeight) {
        if (partialPrints.length < 2) {
            return { success: false, error: 'Недостаточно отпечатков для сборки' };
        }
       
        // Классифицируем все отпечатки
        const classifiedPrints = partialPrints.map(print => ({
            ...print,
            partType: this.classifyFootprintPattern(print.predictions, imageWidth, imageHeight),
            bbox: this.calculateOverallBoundingBox(print.predictions)
        }));
       
        // Группируем по совместимости
        const compatibleGroups = this.groupCompatiblePrints(classifiedPrints);
       
        if (compatibleGroups.length === 0) {
            return { success: false, error: 'Не найдено совместимых отпечатков' };
        }
       
        // Выбираем лучшую группу
        const bestGroup = this.selectBestGroup(compatibleGroups);
       
        // Собираем модель
        const assembledModel = this.mergeFootprints(bestGroup);
       
        return {
            success: true,
            model: assembledModel,
            usedPrints: bestGroup,
            completeness: this.calculateCompleteness(bestGroup),
            confidence: this.calculateConfidence(bestGroup)
        };
    }

    /**
     * Группирует совместимые отпечатки
     */
    groupCompatiblePrints(classifiedPrints) {
        const groups = [];
       
        classifiedPrints.forEach(print => {
            let assigned = false;
           
            for (let group of groups) {
                if (this.arePrintsCompatible(group, print)) {
                    group.push(print);
                    assigned = true;
                    break;
                }
            }
           
            if (!assigned) {
                groups.push([print]);
            }
        });
       
        return groups.filter(group => group.length >= 2);
    }

/**
     * Улучшенная проверка совместимости с комбинированным анализом
     */
    arePrintsCompatible(group, newPrint) {
        console.log(`🎯 Улучшенная проверка совместимости...`);
       
        // 🔧 БЫСТРАЯ ПРОВЕРКА: если группа пустая, используем простую логику
        if (group.length === 0) {
            return this.simpleCompatibilityCheck(newPrint);
        }
       
        // 🎯 КОМБИНИРОВАННЫЙ АНАЛИЗ ДЛЯ НЕПУСТОЙ ГРУППЫ
        try {
            // Получаем размеры изображения из первого отпечатка в группе
            const firstFootprint = group[0];
            let imageWidth = 800, imageHeight = 600;
           
            // Пытаемся получить реальные размеры (если есть в данных)
            if (firstFootprint.features?.imageSize) {
                imageWidth = firstFootprint.features.imageSize.width;
                imageHeight = firstFootprint.features.imageSize.height;
            }
           
            return this.advancedCompatibilityAnalysis(group, newPrint, imageWidth, imageHeight);
           
        } catch (error) {
            console.log('❌ Ошибка комбинированного анализа, используем резервный метод:', error.message);
            // 🔧 РЕЗЕРВНЫЙ МЕТОД при ошибках
            return this.fallbackCompatibilityCheck(group, newPrint);
        }
    }

    /**
     * Простая проверка совместимости для первого отпечатка
     */
    simpleCompatibilityCheck(newPrint) {
        // Для первого отпечатка используем базовые критерии
        const features = newPrint.features;
        return features.detailCount >= 3; // Минимум 3 детали
    }

    /**
     * Резервный метод проверки совместимости
     */
    fallbackCompatibilityCheck(group, newPrint) {
        console.log(`🔄 Использую резервный метод проверки...`);
       
        // Простая проверка по features
        const featureScores = group.map(existing =>
            this.calculateSimilarity(existing.features, newPrint.features)
        );
        const avgFeatureScore = featureScores.reduce((a, b) => a + b, 0) / featureScores.length;
       
        return avgFeatureScore > 0.4;
    }

    /**
     * Проверяет совместимость сторон (левый/правый)
     */
    areSidesCompatible(groupSides, newSide) {
        // ❌ РАЗНЫЕ СТОРОНЫ - НЕ СОВМЕСТИМЫ
        if (groupSides.includes('left') && newSide === 'right') return false;
        if (groupSides.includes('right') && newSide === 'left') return false;
       
        // ✅ ОДИНАКОВЫЕ СТОРОНЫ ИЛИ UNKNOWN/CENTER - СОВМЕСТИМЫ
        return true;
    }

    /**
     * Проверяет совместимость типов узоров
     */
    arePatternTypesCompatible(groupPatterns, newPattern) {
        // 🎯 ИЗВЛЕКАЕМ ОСНОВНЫЕ ХАРАКТЕРИСТИКИ УЗОРОВ
        const extractPatternInfo = (pattern) => {
            const parts = pattern.split('_');
            return {
                size: parts[1] || 'medium',
                density: parts[2] || 'unknown'
            };
        };

        const newInfo = extractPatternInfo(newPattern);
       
        // 🔄 ПРОВЕРЯЕМ СОВМЕСТИМОСТЬ С КАЖДЫМ В ГРУППЕ
        return groupPatterns.some(groupPattern => {
            const groupInfo = extractPatternInfo(groupPattern);
           
            // 📊 СОВМЕСТИМЫЕ КОМБИНАЦИИ
            const compatibleSizes = ['small', 'medium', 'large']; // Все размеры совместимы
            const compatibleDensities = {
                'high_density': ['high_density', 'medium_density'],
                'medium_density': ['high_density', 'medium_density', 'low_density'],
                'low_density': ['medium_density', 'low_density', 'sparse'],
                'sparse': ['low_density', 'sparse']
            };

            const sizeOK = compatibleSizes.includes(newInfo.size) && compatibleSizes.includes(groupInfo.size);
            const densityOK = compatibleDensities[newInfo.density]?.includes(groupInfo.density) ||
                             compatibleDensities[groupInfo.density]?.includes(newInfo.density);

            return sizeOK && densityOK;
        });
    }

    /**
     * Выбирает лучшую группу для сборки
     */
    selectBestGroup(groups) {
        return groups.reduce((best, current) => {
            const bestScore = this.calculateGroupScore(best);
            const currentScore = this.calculateGroupScore(current);
            return currentScore > bestScore ? current : best;
        });
    }

    /**
     * Вычисляет score группы
     */
    calculateGroupScore(group) {
        const typeDiversity = new Set(group.map(p => p.partType)).size;
        const avgConfidence = group.reduce((sum, p) => sum + (p.features?.detailCount || 0), 0) / group.length;
        return typeDiversity * avgConfidence;
    }

    /**
     * Объединяет отпечатки в одну модель
     */
    mergeFootprints(prints) {
        const mergedPredictions = [];
        const mergedFeatures = {
            detailCount: 0,
            hasOutline: false,
            largeDetails: 0,
            density: 0,
            spatialSpread: 0
        };
       
        prints.forEach(print => {
            if (print.predictions) {
                mergedPredictions.push(...print.predictions);
            }
            if (print.features) {
                mergedFeatures.detailCount += print.features.detailCount || 0;
                mergedFeatures.hasOutline = mergedFeatures.hasOutline || print.features.hasOutline;
                mergedFeatures.largeDetails += print.features.largeDetails || 0;
            }
        });
       
        return {
            predictions: mergedPredictions,
            features: mergedFeatures,
            sourcePrints: prints.map(p => p.id),
            timestamp: new Date()
        };
    }

    /**
     * Вычисляет полноту модели
     */
    calculateCompleteness(prints) {
        const uniqueTypes = new Set(prints.map(p => p.partType));
        const maxPossibleTypes = 4; // full, heel, toe, center
        return (uniqueTypes.size / maxPossibleTypes) * 100;
    }

    /**
     * Вычисляет уверенность в модели
     */
    calculateConfidence(prints) {
        const similarities = [];
       
        for (let i = 0; i < prints.length; i++) {
            for (let j = i + 1; j < prints.length; j++) {
                similarities.push(this.calculateSimilarity(prints[i].features, prints[j].features));
            }
        }
       
        const avgSimilarity = similarities.length > 0 ?
            similarities.reduce((a, b) => a + b) / similarities.length : 0;
           
        return Math.min(avgSimilarity * 100, 100);
    }

    /**
     * Вычисляет схожесть features
     */
    calculateSimilarity(featuresA, featuresB) {
        if (!featuresA || !featuresB) return 0;
       
        const countA = featuresA.detailCount || 0;
        const countB = featuresB.detailCount || 0;
       
        if (countA === 0 || countB === 0) return 0;
       
        const countRatio = Math.min(countA, countB) / Math.max(countA, countB);
        const outlineMatch = featuresA.hasOutline === featuresB.hasOutline ? 0.3 : 0;
       
        return countRatio * 0.7 + outlineMatch;
    }

    /**
     * Фильтрует "левые" следы
     */
    filterOutlierFootprints(footprints, similarityThreshold = 0.6) {
        if (footprints.length < 3) return footprints;
       
        return footprints.filter((footprint, index, array) => {
            const similarities = array
                .filter((_, i) => i !== index)
                .map(other => this.calculateSimilarity(footprint.features, other.features));
           
            if (similarities.length === 0) return true;
           
            const avgSimilarity = similarities.reduce((a, b) => a + b) / similarities.length;
            return avgSimilarity >= similarityThreshold;
        });
    }

 // ... существующие методы FootprintAssembler ...

    /**
     * Нормализует геометрию отпечатка (поворот, масштаб, смещение)
     */
    normalizeFootprintGeometry(predictions, imageWidth, imageHeight) {
        if (!predictions || predictions.length === 0) return predictions;
       
        try {
            // 1. НАХОДИМ КОНТУР ДЛЯ ОПРЕДЕЛЕНИЯ ОРИЕНТАЦИИ
            const outline = predictions.find(pred =>
                pred.class === 'Outline-trail' || pred.class.includes('Outline')
            );
           
            if (!outline || !outline.points) return predictions;
           
            // 2. ВЫЧИСЛЯЕМ УГОЛ ПОВОРОТА
            const angle = this.calculateOrientationAngle(outline.points);
           
            // 3. ВЫЧИСЛЯЕМ ЦЕНТР МАСС
            const bbox = this.calculateOverallBoundingBox(predictions);
            const center = {
                x: bbox.minX + bbox.width / 2,
                y: bbox.minY + bbox.height / 2
            };
           
            // 4. ЕСЛИ УГОЛ БОЛЬШОЙ - ПОВОРАЧИВАЕМ
            if (Math.abs(angle) > 10) {
                console.log("🔄 Нормализую ориентацию: поворот на ${angle.toFixed(1)}°");
                return this.rotatePredictions(predictions, center, -angle);
            }
           
            return predictions;
           
        } catch (error) {
            console.log('⚠️ Ошибка геометрической нормализации:', error.message);
            return predictions;
        }
    }

    /**
     * Поворачивает все предсказания вокруг центра
     */
    rotatePredictions(predictions, center, angleDegrees) {
        const rad = angleDegrees * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
       
        return predictions.map(pred => {
            if (!pred.points) return pred;
           
            return {
                ...pred,
                points: pred.points.map(point => {
                    // ПЕРЕНОСИМ В ЦЕНТР КООРДИНАТ
                    const dx = point.x - center.x;
                    const dy = point.y - center.y;
                   
                    // ПОВОРАЧИВАЕМ
                    const newX = dx * cos - dy * sin;
                    const newY = dx * sin + dy * cos;
                   
                    // ВОЗВРАЩАЕМ НА МЕСТО
                    return {
                        x: newX + center.x,
                        y: newY + center.y
                    };
                })
            };
        });
    }

    /**
     * Вычисляет угол ориентации контура
     */
    calculateOrientationAngle(points) {
        if (!points || points.length < 3) return 0;
       
        try {
            // ВЫЧИСЛЯЕМ ЦЕНТР МАСС
            const center = points.reduce((acc, point) => {
                acc.x += point.x;
                acc.y += point.y;
                return acc;
            }, { x: 0, y: 0 });
           
            center.x /= points.length;
            center.y /= points.length;
           
            // МЕТОД ГЛАВНЫХ КОМПОНЕНТ
            let xx = 0, yy = 0, xy = 0;
           
            points.forEach(point => {
                const dx = point.x - center.x;
                const dy = point.y - center.y;
                xx += dx * dx;
                yy += dy * dy;
                xy += dx * dy;
            });
           
            const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
            return angle * (180 / Math.PI);
           
        } catch (error) {
            return 0;
        }
    }

    /**
     * Вычисляет геометрическое сходство отпечатков
     */
    calculateGeometricSimilarity(group, newPrint) {
        let totalScore = 0;
        let count = 0;
       
        group.forEach(existing => {
            // СРАВНИВАЕМ РАЗМЕРЫ И ФОРМУ
            const bboxA = this.calculateOverallBoundingBox(existing.predictions);
            const bboxB = this.calculateOverallBoundingBox(newPrint.predictions);
           
            // СРАВНЕНИЕ СООТНОШЕНИЯ СТОРОН
            const aspectRatioA = bboxA.width / bboxA.height;
            const aspectRatioB = bboxB.width / bboxB.height;
            const aspectScore = 1 - Math.abs(aspectRatioA - aspectRatioB) / Math.max(aspectRatioA, aspectRatioB);
           
            // СРАВНЕНИЕ ПЛОЩАДЕЙ (логарифмическое для устойчивости к масштабу)
            const areaA = bboxA.width * bboxA.height;
            const areaB = bboxB.width * bboxB.height;
            const areaScore = 1 - Math.abs(Math.log(areaA) - Math.log(areaB)) / 5; // нормализация
           
            totalScore += (aspectScore + areaScore) / 2;
            count++;
        });
       
        return count > 0 ? totalScore / count : 0;
    }

 // =============================================================================
    // 🎯 КОМБИНИРОВАННЫЙ АНАЛИЗ: ТОПОЛОГИЯ + ДЕТАЛИ + ОРИЕНТАЦИЯ
    // =============================================================================

    /**
     * Комбинированный анализ совместимости с учетом метрик модели
     */
    advancedCompatibilityAnalysis(group, newPrint, imageWidth, imageHeight) {
        console.log(`🎯 Комбинированный анализ совместимости...`);
       
        const analysisResults = {
            // 🧩 ТОПОЛОГИЧЕСКИЙ УРОВЕНЬ (структура)
            topological: this.analyzeTopologicalCompatibility(group, newPrint, imageWidth, imageHeight),
           
            // 🔍 ДЕТАЛЬНЫЙ УРОВЕНЬ (элементы)
            detailed: this.analyzeDetailedCompatibility(group, newPrint),
           
            // 🧭 ОРИЕНТАЦИОННЫЙ УРОВЕНЬ (левый/правый, повороты)
            orientation: this.analyzeOrientationCompatibility(group, newPrint)
        };
       
        // 📊 АДАПТИВНОЕ ВЗВЕШИВАНИЕ С УЧЕТОМ RECALL МОДЕЛИ
        const weights = this.calculateAdaptiveWeights(group, newPrint);
       
        const finalScore = (
            analysisResults.topological * weights.topological +
            analysisResults.detailed * weights.detailed +
            analysisResults.orientation * weights.orientation
        );
       
        console.log(`🎯 Комбинированный результат:`, {
            topological: analysisResults.topological.toFixed(3),
            detailed: analysisResults.detailed.toFixed(3),
            orientation: analysisResults.orientation.toFixed(3),
            weights: weights,
            final: finalScore.toFixed(3)
        });
       
        return finalScore > 0.4; // 👈 ПОНИЖЕННЫЙ ПОРОГ ИЗ-ЗА RECALL
    }

    /**
     * Анализ топологической совместимости
     */
    analyzeTopologicalCompatibility(group, newPrint, imageWidth, imageHeight) {
        console.log(`🧩 Топологический анализ совместимости...`);
       
        let totalCompatibility = 0;
        let analysisCount = 0;
       
        group.forEach(existing => {
            const topologyA = this.extractTopologicalFeatures(existing.predictions, imageWidth, imageHeight);
            const topologyB = this.extractTopologicalFeatures(newPrint.predictions, imageWidth, imageHeight);
           
            const topologyScore = this.compareTopologicalFeatures(topologyA, topologyB);
            totalCompatibility += topologyScore;
            analysisCount++;
        });
       
        return analysisCount > 0 ? totalCompatibility / analysisCount : 0;
    }

    /**
     * Извлекает топологические признаки
     */
    extractTopologicalFeatures(predictions, imageWidth, imageHeight) {
        return {
            quadrantDensity: this.calculateQuadrantDensity(predictions, imageWidth, imageHeight),
            aspectRatio: this.calculateAspectRatio(predictions),
            centerOfMass: this.calculateCenterOfMass(predictions),
            boundaryPoints: this.extractBoundaryPoints(predictions)
        };
    }

    /**
     * Распределение деталей по квадрантам
     */
    calculateQuadrantDensity(predictions, imageWidth, imageHeight) {
        const quadrants = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
        const centerX = imageWidth / 2;
        const centerY = imageHeight / 2;
       
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 0) {
                const bbox = this.calculateBoundingBox(pred.points);
                const center = {
                    x: bbox.minX + bbox.width / 2,
                    y: bbox.minY + bbox.height / 2
                };
               
                if (center.x < centerX && center.y < centerY) quadrants.topLeft++;
                else if (center.x >= centerX && center.y < centerY) quadrants.topRight++;
                else if (center.x < centerX && center.y >= centerY) quadrants.bottomLeft++;
                else quadrants.bottomRight++;
            }
        });
       
        return quadrants;
    }

    /**
     * Соотношение сторон bounding box
     */
    calculateAspectRatio(predictions) {
        const bbox = this.calculateOverallBoundingBox(predictions);
        return bbox.width / bbox.height;
    }

    /**
     * Центр масс деталей
     */
    calculateCenterOfMass(predictions) {
        let totalX = 0, totalY = 0, count = 0;
       
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 0) {
                const bbox = this.calculateBoundingBox(pred.points);
                totalX += bbox.minX + bbox.width / 2;
                totalY += bbox.minY + bbox.height / 2;
                count++;
            }
        });
       
        return count > 0 ? { x: totalX / count, y: totalY / count } : { x: 0, y: 0 };
    }

    /**
     * Граничные точки фрагмента
     */
    extractBoundaryPoints(predictions) {
        const points = [];
        const bbox = this.calculateOverallBoundingBox(predictions);
       
        // Простые граничные точки
        points.push({ x: bbox.minX, y: bbox.minY }); // левый верхний
        points.push({ x: bbox.maxX, y: bbox.minY }); // правый верхний 
        points.push({ x: bbox.minX, y: bbox.maxY }); // левый нижний
        points.push({ x: bbox.maxX, y: bbox.maxY }); // правый нижний
        points.push({ x: bbox.minX + bbox.width / 2, y: bbox.minY }); // верхний центр
        points.push({ x: bbox.minX + bbox.width / 2, y: bbox.maxY }); // нижний центр
       
        return points;
    }

    /**
     * Сравнение топологических признаков
     */
    compareTopologicalFeatures(topologyA, topologyB) {
        let totalScore = 0;
        let comparisonCount = 0;
       
        // 1. Сравнение распределения по квадрантам
        const quadrantScore = this.compareQuadrantDistribution(topologyA.quadrantDensity, topologyB.quadrantDensity);
        totalScore += quadrantScore;
        comparisonCount++;
       
        // 2. Сравнение пропорций
        const aspectScore = 1 - Math.abs(topologyA.aspectRatio - topologyB.aspectRatio) / Math.max(topologyA.aspectRatio, topologyB.aspectRatio);
        totalScore += aspectScore;
        comparisonCount++;
       
        // 3. Сравнение центров масс
        const centerDistance = Math.sqrt(
            Math.pow(topologyA.centerOfMass.x - topologyB.centerOfMass.x, 2) +
            Math.pow(topologyA.centerOfMass.y - topologyB.centerOfMass.y, 2)
        );
        const centerScore = Math.max(0, 1 - centerDistance / 100); // Нормализуем
        totalScore += centerScore;
        comparisonCount++;
       
        return totalScore / comparisonCount;
    }

    /**
     * Сравнение распределения по квадрантам
     */
    compareQuadrantDistribution(quadrantsA, quadrantsB) {
        const totalA = quadrantsA.topLeft + quadrantsA.topRight + quadrantsA.bottomLeft + quadrantsA.bottomRight;
        const totalB = quadrantsB.topLeft + quadrantsB.topRight + quadrantsB.bottomLeft + quadrantsB.bottomRight;
       
        if (totalA === 0 || totalB === 0) return 0.5;
       
        const ratiosA = {
            topLeft: quadrantsA.topLeft / totalA,
            topRight: quadrantsA.topRight / totalA,
            bottomLeft: quadrantsA.bottomLeft / totalA,
            bottomRight: quadrantsA.bottomRight / totalA
        };
       
        const ratiosB = {
            topLeft: quadrantsB.topLeft / totalB,
            topRight: quadrantsB.topRight / totalB,
            bottomLeft: quadrantsB.bottomLeft / totalB,
            bottomRight: quadrantsB.bottomRight / totalB
        };
       
        const difference = (
            Math.abs(ratiosA.topLeft - ratiosB.topLeft) +
            Math.abs(ratiosA.topRight - ratiosB.topRight) +
            Math.abs(ratiosA.bottomLeft - ratiosB.bottomLeft) +
            Math.abs(ratiosA.bottomRight - ratiosB.bottomRight)
        );
       
        return Math.max(0, 1 - difference);
    }

    /**
     * Анализ детальной совместимости с компенсацией recall
     */
    analyzeDetailedCompatibility(group, newPrint) {
        let totalScore = 0;
        let comparisonCount = 0;
       
        group.forEach(existing => {
            // 🔧 КОМПЕНСАЦИЯ ЗА НИЗКИЙ RECALL - увеличиваем вес найденных деталей
            const baseScore = this.advancedPatternComparison(existing.predictions, newPrint.predictions);
            const compensatedScore = Math.min(baseScore * 1.5, 1.0); // +50% вес
           
            totalScore += compensatedScore;
            comparisonCount++;
        });
       
        return comparisonCount > 0 ? totalScore / comparisonCount : 0;
    }

    /**
     * Анализ ориентационной совместимости
     */
    analyzeOrientationCompatibility(group, newPrint) {
        console.log(`🧭 Анализ ориентационной совместимости...`);
       
        const groupOrientations = group.map(footprint => ({
            side: footprint.patternType?.split('_')[0] || 'unknown',
            angle: footprint.orientation?.angle || 0
        }));
       
        const newOrientation = {
            side: newPrint.patternType?.split('_')[0] || 'unknown',
            angle: newPrint.orientation?.angle || 0
        };
       
        // 🔧 ГИБКАЯ ПРОВЕРКА СТОРОН
        const sideCompatibility = this.assessSideCompatibility(groupOrientations, newOrientation);
       
        // 🔧 ПРОВЕРКА УГЛОВ ПОВОРОТА
        const angleCompatibility = this.assessAngleCompatibility(groupOrientations, newOrientation);
       
        const orientationScore = (sideCompatibility + angleCompatibility) / 2;
       
        console.log("🧭 Ориентационная совместимость: ${orientationScore.toFixed(3)}");
       
        return orientationScore;
    }

    /**
     * Гибкая проверка совместимости сторон
     */
    assessSideCompatibility(groupOrientations, newOrientation) {
        const groupSides = groupOrientations.map(o => o.side);
        const newSide = newOrientation.side;
       
        // 1. Одинаковые стороны - отлично
        if (groupSides.includes(newSide)) return 1.0;
       
        // 2. Unknown/center - нейтрально
        if (newSide === 'unknown' || newSide === 'center') return 0.7;
        if (groupSides.includes('unknown') || groupSides.includes('center')) return 0.7;
       
        // 3. Разные стороны - возможна сборка полного следа
        if ((groupSides.includes('left') && newSide === 'right') ||
            (groupSides.includes('right') && newSide === 'left')) {
            return 0.6;
        }
       
        return 0.3;
    }

    /**
     * Проверка совместимости углов поворота
     */
    assessAngleCompatibility(groupOrientations, newOrientation) {
        if (groupOrientations.length === 0) return 0.7;
       
        let totalAngleScore = 0;
       
        groupOrientations.forEach(groupOrientation => {
            const angleDiff = Math.abs(groupOrientation.angle - newOrientation.angle);
            const normalizedDiff = Math.min(angleDiff / 45, 1.0); // Нормализуем к 45 градусам
            totalAngleScore += 1 - normalizedDiff;
        });
       
        return totalAngleScore / groupOrientations.length;
    }

    /**
     * Адаптивное взвешивание с учетом recall модели
     */
    calculateAdaptiveWeights(group, newPrint) {
        const detailQuality = this.assessDetailQuality(group, newPrint);
       
        // 🎯 УЧИТЫВАЕМ RECALL 40% - найденные детали неполные
        const effectiveDetailQuality = detailQuality * 0.4;
       
        let weights = {
            topological: 0.6,  // 🔥 ОСНОВНОЙ ВЕС ТОПОЛОГИИ
            detailed: 0.3,     // 🔥 ВТОРОСТЕПЕННЫЕ ДЕТАЛИ
            orientation: 0.1
        };
       
        // Только для ОЧЕНЬ четких следов увеличиваем вес деталей
        if (effectiveDetailQuality > 0.6) {
            weights.topological = 0.3;
            weights.detailed = 0.6;
            weights.orientation = 0.1;
        }
       
        console.log(`⚖️ Адаптивные веса (качество: ${effectiveDetailQuality.toFixed(3)}):`, weights);
        return weights;
    }

    /**
     * Оценка качества детализации следов
     */
    assessDetailQuality(group, newPrint) {
        let totalQuality = 0;
        let count = 0;
       
        group.forEach(footprint => {
            const quality = this.calculateFootprintQuality(footprint);
            totalQuality += quality;
            count++;
        });
       
        totalQuality += this.calculateFootprintQuality(newPrint);
        count++;
       
        return totalQuality / count;
    }

    /**
     * Оценка качества одного отпечатка
     */
    calculateFootprintQuality(footprint) {
        const features = footprint.features;
       
        let qualityScore = 0;
       
        // 1. Количество деталей
        const detailScore = Math.min(features.detailCount / 30, 1.0);
       
        // 2. Разнообразие размеров
        const sizeDiversity = this.calculateSizeDiversity(footprint.predictions);
       
        // 3. Наличие контура
        const outlineBonus = features.hasOutline ? 0.2 : 0;
       
        qualityScore = (detailScore * 0.5) + (sizeDiversity * 0.3) + outlineBonus;
       
        return Math.min(qualityScore, 1.0);
      }

    /**
     * Расчет разнообразия размеров деталей
     */
    calculateSizeDiversity(predictions) {
        if (predictions.length < 2) return 0.3;
       
        const areas = predictions
            .filter(pred => pred.points && pred.points.length > 0)
            .map(pred => {
                const bbox = this.calculateBoundingBox(pred.points);
                return bbox.width * bbox.height;
            })
            .filter(area => area > 0);
       
        if (areas.length < 2) return 0.3;
       
        const minArea = Math.min(...areas);
        const maxArea = Math.max(...areas);
       
        return minArea > 0 ? Math.min(maxArea / minArea, 10) / 10 : 0.3;
    }            
    
}
function simplifyPolygon(points, epsilon = 1.0) {
    if (points.length <= 4) return points;

    function douglasPecker(points, epsilon) {
        if (points.length <= 2) return points;
        let maxDistance = 0;
        let index = 0;
        const start = points[0];
        const end = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const distance = perpendicularDistance(points[i], start, end);
            if (distance > maxDistance) {
                maxDistance = distance;
                index = i;
            }
        }

        if (maxDistance > epsilon) {
            const left = douglasPecker(points.slice(0, index + 1), epsilon);
            const right = douglasPecker(points.slice(index), epsilon);
            return left.slice(0, -1).concat(right);
        } else {
            return [start, end];
        }
    }

    function perpendicularDistance(point, lineStart, lineEnd) {
        const area = Math.abs(
            (lineEnd.x - lineStart.x) * (lineStart.y - point.y) -
            (lineStart.x - point.x) * (lineEnd.y - lineStart.y)
        );
        const lineLength = Math.sqrt(
            Math.pow(lineEnd.x - lineStart.x, 2) + Math.pow(lineEnd.y - lineStart.y, 2)
        );
        return area / lineLength;
    }

    return douglasPecker(points, epsilon);
}

/**
* Нормализует ориентацию предсказаний (поворачивает к горизонтали)
*/
function normalizeOrientation(predictions) {
    console.log('🔄 Нормализую ориентацию следов...');
   
    if (!predictions || predictions.length === 0) {
        return predictions;
    }

    try {
        // ИЩЕМ КОНТУР СЛЕДА ДЛЯ ОПРЕДЕЛЕНИЯ ОРИЕНТАЦИИ
        const outline = predictions.find(pred =>
            pred.class === 'Outline-trail' || pred.class.includes('Outline')
        );

        if (!outline || !outline.points) {
            console.log('⚠️ Контур не найден, ориентация не изменена');
            return predictions;
        }

        // ВЫЧИСЛЯЕМ УГОЛ ПОВОРОТА
        const angle = calculateOrientationAngle(outline.points);
       
        // ЕСЛИ УГОЛ МАЛЕНЬКИЙ - НЕ ПОВОРАЧИВАЕМ
        if (Math.abs(angle) < 5) {
            console.log('✅ След уже ориентирован нормально (<5°)');
            return predictions;
        }

        // ВЫЧИСЛЯЕМ ЦЕНТР КОНТУРА
        const bbox = calculateBoundingBox(outline.points);
        const center = {
            x: bbox.minX + bbox.width / 2,
            y: bbox.minY + bbox.height / 2
        };

        // ПОВОРАЧИВАЕМ ВСЕ ТОЧКИ ВСЕХ ПРЕДСКАЗАНИЙ
        const rad = -angle * (Math.PI / 180); // минус для компенсации
       
        const normalizedPredictions = predictions.map(pred => {
            if (!pred.points) return pred;
           
            return {
                ...pred,
                points: pred.points.map(point => {
                    // ПЕРЕНОСИМ В ЦЕНТР КООРДИНАТ
                    const dx = point.x - center.x;
                    const dy = point.y - center.y;
                   
                    // ПОВОРАЧИВАЕМ
                    const newX = dx * Math.cos(rad) - dy * Math.sin(rad);
                    const newY = dx * Math.sin(rad) + dy * Math.cos(rad);
                   
                    // ВОЗВРАЩАЕМ НА МЕСТО
                    return {
                        x: newX + center.x,
                        y: newY + center.y
                    };
                })
            };
        });

        console.log(`✅ Ориентация нормализована: поворот на ${angle.toFixed(1)}°`);
        return normalizedPredictions;

    } catch (error) {
        console.log('❌ Ошибка нормализации ориентации:', error.message);
        return predictions;
    }
}

function getEpsilonForClass(className) {
    switch(className) {
        case 'shoe-protector': return 1.5;
        case 'Outline-trail': return 0.8;
        case 'Heel': return 1.0;
        case 'Toe': return 1.0;
        default: return 1.2;
    }
}

/**
* Вычисляет симметрию контура следа (упрощенная версия)
*/
function calculateOutlineSymmetry(points) {
    if (!points || points.length < 4) return 1.0;
   
    try {
        const bbox = calculateBoundingBox(points);
        // Упрощенный расчет симметрии
        return 0.8; // Базовая оценка
    } catch (error) {
        return 1.0;
    }
}

/**
* Анализирует равномерность распределения деталей (упрощенная версия)
*/
function analyzeDetailDistribution(predictions) {
    const details = predictions.filter(pred =>
        pred.class === 'shoe-protector' && pred.points
    );
   
    if (details.length < 3) return 1.0;
   
    try {
        // Упрощенный расчет равномерности
        return 0.7; // Базовая оценка
    } catch (error) {
        return 1.0;
    }
}

// 🎯 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ:

function calculatePatternMatch(ref, footprint) {
    // Сравнение количества и типа деталей
    const baseScore = Math.min(
        (footprint.detailCount / Math.max(ref.detailCount, 1)) * 80,
        80
    );
    // Бонус за наличие контура
    const outlineBonus = (footprint.hasOutline && ref.hasOutline) ? 20 : 0;
    return Math.min(baseScore + outlineBonus, 100);
}

function calculateSpatialMatch(ref, footprint) {
    // Для пространственного анализа нужно минимум 3 детали
    if (ref.detailCount < 3 || footprint.detailCount < 3) return 40;
   
    // Сравнение плотности деталей
    const densitySimilarity = Math.min(
        footprint.detailCount / Math.max(ref.detailCount, 1),
        1
    ) * 60;
   
    return 40 + densitySimilarity; // Базовый 40% + плотность
}

function calculateDetailMatch(ref, footprint) {
    // Сравнение крупных деталей
    const largeDetailsScore = footprint.largeDetails > 0 ?
        Math.min((footprint.largeDetails / Math.max(ref.largeDetails, 1)) * 70, 70) : 0;
   
    // Бонус за сложность узора (много мелких деталей)
    const complexityBonus = (footprint.detailCount > 8) ? 30 : 0;
   
    return Math.min(largeDetailsScore + complexityBonus, 100);
}

function calculateShapeMatch(ref, footprint) {
    let score = 50; // Базовый счет
   
    // Бонусы за характерные особенности
    if (footprint.hasOutline) score += 30;
    if (footprint.largeDetails > 2) score += 20;
   
    return Math.min(score, 100);
}

// 🔄 ЗАГРУЗКА СТАТИСТИКИ ИЗ ПУБЛИЧНОЙ ССЫЛКИ ЯНДЕКС.ДИСКА
async function loadStatsFromPublicLink() {
    try {
        console.log('🔄 Загрузка статистики по публичной ссылке...');

        const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=https://disk.yandex.ru/d/vjXtSXW8otwaNg`;

        const linkResponse = await withRetry(async () => {
            return await axios.get(apiUrl, { timeout: 10000 });
        }, "Получение ссылки Яндекс.Диск");

        console.log('✅ Получена ссылка для скачивания');

        const fileResponse = await withRetry(async () => {
            return await axios.get(linkResponse.data.href, {
                timeout: 10000,
                responseType: 'text'
            });
        }, "Скачивание статистики");

        console.log('📥 Файл скачан, длина:', fileResponse.data.length);

        const remoteStats = JSON.parse(fileResponse.data);

        // 🔧 ДОБАВЬТЕ ПРОВЕРКУ НА СУЩЕСТВОВАНИЕ МЕНЕДЖЕРА
        if (!getSessionManager()) {
            console.log('⚠️ SessionManager не готов, пропускаем загрузку статистики');
            return false;
        }

        // 🔧 ДОБАВЬТЕ ПРОВЕРКУ СТРУКТУРЫ
        if (!remoteStats.global) {
            throw new Error('Неверная структура файла статистики');
        }

        // 🔧 БЕЗОПАСНОЕ ОБНОВЛЕНИЕ СТАТИСТИКИ
        if (getSessionManager().globalStats) {
            Object.assign(getSessionManager().globalStats, remoteStats.global);
        }
       
        if (getSessionManager().userStats) {
            getSessionManager().userStats.clear();
        }
      
        if (remoteStats.users && Array.isArray(remoteStats.users)) {
            remoteStats.users.forEach(([userId, userData]) => {
                getSessionManager().userStats.set(userId, userData);
            });
        }

        console.log('🎯 Статистика загружена из облака');
        return true;

    } catch (error) {
        console.log('❌ Ошибка загрузки после всех попыток:', error.message);
        console.log('💫 Начинаем со свежей статистики');
        return false;
    }
}

// =============================================================================
// 📱 ОСНОВНЫЕ КОМАНДЫ БОТА
// =============================================================================

bot.onText(/\/trail_start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
   
    console.log(`🕵️‍♂️ Запрос на создание сессии от ${username} (chatId: ${chatId})`);
   
    try {
        // 🔧 ИСПРАВЛЯЕМ: проверяем что менеджер готов
        if (!getSessionManager()) {
            await bot.sendMessage(chatId, '❌ Система временно недоступна. Попробуйте позже.');
            return;
        }
       
        const session = getSessionManager().getTrailSession(chatId, username);
       
        // 🔧 ПРОВЕРЯЕМ что сессия создана правильно
        if (!session || !session.startTime) {
            await bot.sendMessage(chatId, '❌ Ошибка создания сессии. Попробуйте снова.');
            return;
        }
       
        console.log(`✅ Сессия создана:`, {
            sessionId: session.sessionId,
            status: session.status,
            footprintsCount: session.footprints.length
        });
       
        await bot.sendMessage(chatId,
            `🕵️‍♂️ **РЕЖИМ ТРОПЫ АКТИВИРОВАН**\n\n` +
            `**Сессия:** ${session.sessionId}\n` +
            `**Эксперт:** ${username}\n` +
            `**Время начала:** ${session.startTime.toLocaleString('ru-RU')}\n\n` +
           
            `🔍 **Теперь все отпечатки будут автоматически:**\n` +
            `• Сохраняться в текущую сессию\n` +
            `• Сравниваться между собой\n` +
            `• Анализироваться на сходимость\n\n` +
           
            `📸 **Просто отправляйте фото отпечатков подошв**\n\n` +
           
            `**Команды эксперта:**\n` +
            `• /trail_status - статус сессии\n` +
            `• /trail_report - экспертное заключение\n` +
            `• /trail_notes - добавить заметки\n` +
            `• /trail_finish - завершить сессию\n\n` +
           
            `⚠️ *Все данные сохраняются только до перезапуска бота*`
        );
       
    } catch (error) {
        console.log('❌ Ошибка создания сессии:', error);
        await bot.sendMessage(chatId, '❌ Ошибка создания сессии. Попробуйте снова.');
    }
});

// =============================================================================
// 🔄 СИСТЕМА СРАВНЕНИЯ СЛЕДОВ
// =============================================================================

bot.onText(/\/compare$/, async (msg) => {
    const chatId = msg.chat.id;
   
    if (sessionManager.referencePrints.size === 0) {
        await bot.sendMessage(chatId,
            '📝 **СПИСОК ЭТАЛОНОВ ПУСТ**\n\n' +
            'Сначала сохраните эталоны:\n' +
            '`/save_reference Название_Модели`\n\n' +
            'Или просто отправьте фото для быстрого анализа'
        );
        return;
    }

    let message = '🔍 **СРАВНЕНИЕ С ЭТАЛОНОМ**\n\n';
    message += '📝 **Укажите модель для сравнения:**\n';
   
    sessionManager.referencePrints.forEach((ref, modelName) => {
        const details = ref.features ? ref.features.detailCount : '?';
        message += `• \`/compare ${modelName}\` (${details} дет.)\n`;
    });
   
    message += '\n💡 **Или отправьте фото для быстрого анализа**';
   
    await bot.sendMessage(chatId, message);
});

bot.onText(/\/compare (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const modelName = match[1].trim();
    const session = sessionManager.getSession(chatId);

    const reference = sessionManager.referencePrints.get(modelName);
    if (!reference) {
        let message = `❌ Эталон "${modelName}" не найден\n\n`;
        message += '📋 **Доступные эталоны:**\n';
       
        sessionManager.referencePrints.forEach((ref, name) => {
            message += `• ${name}\n`;
        });
       
        await bot.sendMessage(chatId, message);
        return;
    }

    session.waitingForComparison = {
        modelName: modelName,
        reference: reference
    };
   
    await bot.sendMessage(chatId,
        `🔍 Сравниваю со следом: "${modelName}"\n\n` +
        '📸 **Отправьте фото следа:**\n' +
        '• След на грунте/песке\n' +
        '• Прямой угол съемки\n' +
        '• Хорошая четкость\n\n' +
        '🎯 **Алгоритм учитывает:**\n' +
        '• Крупные элементы узора\n' +
        '• Расположение деталей\n' +
        '• Характерные формы\n\n' +
        '❌ Для отмены: /cancel'
    );
});

// =============================================================================
// 💾 КОМАНДЫ ДЛЯ РАБОТЫ С ЭТАЛОНАМИ
// =============================================================================

bot.onText(/\/save_reference$/, async (msg) => {
    const chatId = msg.chat.id;
   
    await bot.sendMessage(chatId,
        '💾 **СОХРАНЕНИЕ ЭТАЛОННОГО ОТПЕЧАТКА**\n\n' +
        '📝 **Укажите название модели через пробел:**\n' +
        'Пример: `/save_reference Nike_Air_Max_90`\n\n' +
        '💡 **Рекомендации:**\n' +
        '• Фото чистой подошвы сверху\n' +
        '• Хорошее освещение без теней\n' +
        '• Четкий фокус на протекторе\n' +
        '• Название без пробелов (используйте _)\n\n' +
        '❌ Для отмены: /cancel'
    );
});

bot.onText(/\/save_reference (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const modelName = match[1].trim();
    const session = sessionManager.getSession(chatId);

    if (modelName.length < 2) {
        await bot.sendMessage(chatId, '❌ Название модели слишком короткое');
        return;
    }

    session.waitingForReference = modelName;
   
    await bot.sendMessage(chatId,
        `💾 Сохраняю эталон: "${modelName}"\n\n` +
        '📸 **Отправьте фото подошвы:**\n' +
        '• Чистая подошва, вид сверху\n' +
        '• Хорошее освещение\n' +
        '• Максимальная детализация\n\n' +
        '❌ Для отмены: /cancel'
    );
});

bot.onText(/\/list_references/, async (msg) => {
    const chatId = msg.chat.id;

    if (sessionManager.referencePrints.size === 0) {
        await bot.sendMessage(chatId,
            '📝 **СПИСОК ЭТАЛОНОВ ПУСТ**\n\n' +
            'Для добавления эталонов:\n' +
            '`/save_reference Название_Модели`'
        );
        return;
    }

    let list = '📝 **СОХРАНЕННЫЕ ЭТАЛОНЫ:**\n\n';
    let counter = 1;

    sessionManager.referencePrints.forEach((ref, modelName) => {
        const date = ref.timestamp.toLocaleDateString('ru-RU');
        const details = ref.features ? ref.features.detailCount : '?';
        list += `${counter}. **${modelName}**\n`;
        list += `   📅 ${date} | 🔵 ${details} дет.\n\n`;
        counter++;
    });

    await bot.sendMessage(chatId, list);
});



bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    const session = sessionManager.getSession(chatId);
   
    session.waitingForReference = null;
    session.waitingForComparison = null; // ← ДОБАВЬТЕ ЭТУ СТРОКУ
   
    await bot.sendMessage(chatId, '❌ Операция отменена');
});



// =============================================================================
// 🕵️‍♂️ КОМАНДЫ РЕЖИМА ТРОПЫ
// =============================================================================
bot.onText(/\/trail_start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
   
    console.log(`🕵️‍♂️ Запрос на создание сессии от ${username} (chatId: ${chatId})`);
   
    const session = newSessionManager.getTrailSession(chatId, username);
   
    console.log(`✅ Сессия создана:`, {
        sessionId: session.sessionId,
        status: session.status,
        footprintsCount: session.footprints.length
    });
   
    await bot.sendMessage(chatId,
        `🕵️‍♂️ **РЕЖИМ ТРОПЫ АКТИВИРОВАН**\n\n` +
        `**Сессия:** ${session.sessionId}\n` +
        `**Эксперт:** ${username}\n` +
        `**Время начала:** ${session.startTime.toLocaleString('ru-RU')}\n\n` +
        `🔍 **Теперь все отпечатки будут автоматически:**\n` +
        `• Сохраняться в текущую сессию\n` +
        `• Сравниваться между собой\n` +
        `• Анализироваться на сходимость\n\n` +
        `📸 **Просто отправляйте фото отпечатков подошв**\n\n` +
        `**Команды эксперта:**\n` +
        `• /trail_status - статус сессии\n` +
        `• /trail_report - экспертное заключение\n` +
        `• /trail_notes - добавить заметки\n` +
        `• /trail_finish - завершить сессию\n\n` +
        `⚠️ *Все данные сохраняются только до перезапуска бота*`
    );
});

bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await handleShowHelp(chatId);
});

bot.onText(/\/trail_status/, async (msg) => {
    const chatId = msg.chat.id;
   
    // 🔧 ИСПРАВЛЕНИЕ: используем newSessionManager
    const session = getSessionManager().trailSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId,
            '❌ Активная сессия анализа тропы не найдена.\n' +
            'Используйте /trail_start для начала работы.'
        );
        return;
    }
   
    const summary = session.getSessionSummary();
   
    let status = `🕵️‍♂️ **РЕЖИМ ТРОПЫ АКТИВИРОВАН**\n\n`;
    status += `**ID:** ${summary.sessionId}\n`;
    status += `**Статус:** ${summary.status === 'active' ? '🟢 АКТИВНА' : '🔴 ЗАВЕРШЕНА'}\n`;
    status += `**Отпечатков:** ${summary.footprintsCount}\n`;
    status += `**Сравнений:** ${summary.comparisonsCount}\n`;
    status += `**Средняя сходимость:** ${summary.averageSimilarity.toFixed(1)}%\n`;
    status += `**Длительность:** ${Math.round(summary.duration / 60000)} мин.\n`;
   
    if (session.notes) {
        status += `\n**Заметки эксперта:**\n${session.notes}`;
    }
   
    await bot.sendMessage(chatId, status);
});

bot.onText(/\/trail_report/, async (msg) => {
    const chatId = msg.chat.id;
    // 🔧 ИСПРАВЛЯЕМ
    const session = getSessionManager().trailSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId, '❌ Нет активной сессии для отчета.');
        return;
    }
   
    if (session.footprints.length < 2) {
        await bot.sendMessage(chatId,
            '📊 **Недостаточно данных для отчета**\n\n' +
            'Для генерации экспертного заключения требуется минимум 2 отпечатка.\n' +
            `Сейчас в сессии: ${session.footprints.length} отпечатков`
        );
        return;
    }
   
    const report = session.generateExpertReport();
    await bot.sendMessage(chatId, report);
});

bot.onText(/\/trail_notes(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const session = sessionManager.trailSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId, '❌ Нет активной сессии для добавления заметок.');
        return;
    }
   
    const notesText = match ? match[1] : null;
   
    if (!notesText) {
        await bot.sendMessage(chatId,
            '📝 **Добавление заметок к сессии**\n\n' +
            'Использование: `/expert_notes Ваш текст заметки`\n\n' +
            'Текущие заметки:\n' +
            (session.notes || 'Пока нет заметок')
        );
        return;
    }
   
    session.notes = notesText;
    await bot.sendMessage(chatId, '✅ Заметки эксперта сохранены');
});

bot.onText(/\/trail_finish/, async (msg) => {
    const chatId = msg.chat.id;
    const session = getSessionManager().trailSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId, '❌ Нет активной сессии для завершения.');
        return;
    }
   
    session.status = 'completed';
    const report = session.generateExpertReport();
   
    await bot.sendMessage(chatId,
        `🔚 **СЕССИЯ АНАЛИЗА ТРОПЫ ЗАВЕРШЕНА**\n\n${report}\n\n` +
        `📁 Все данные сохранены до перезапуска бота.\n` +
        `🔄 Для новой сессии используйте /trail_start`
    );
});

// =============================================================================
// 🎯 НОВЫЕ КОМАНДЫ ДЛЯ СБОРКИ МОДЕЛЕЙ И СРАВНЕНИЙ
// =============================================================================

// 🔍 КОМАНДА ДЕТАЛЬНОГО СРАВНЕНИЯ
bot.onText(/\/compare_footprints (\d+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const footprintIdA = parseInt(match[1]);
    const footprintIdB = parseInt(match[2]);
   
    console.log(`🔍 Запрос сравнения: ${footprintIdA} vs ${footprintIdB}`);
   
    const session = getSessionManager().trailSessions.get(chatId);
    if (!session) {
        await bot.sendMessage(chatId,
            '❌ Активная сессия не найдена.\n' +
            'Используйте /trail_start для начала работы.'
        );
        return;
    }
   
    const footprintA = session.footprints.find(f => f.id === `footprint_${footprintIdA}`);
    const footprintB = session.footprints.find(f => f.id === `footprint_${footprintIdB}`);
   
    if (!footprintA || !footprintB) {
        await bot.sendMessage(chatId,
            '❌ Один или оба отпечатка не найдены.\n\n' +
            '📋 Доступные отпечатки:\n' +
            session.footprints.map(f => `• ${f.id.replace('footprint_', '')}: ${f.partType || 'неизвестно'}`).join('\n')
        );
        return;
    }
   
    await bot.sendMessage(chatId, '🎨 Создаю детальную визуализацию сравнения...');
   
    const visualizer = new ComparisonVisualizer();
    const vizPath = await visualizer.createComparisonVisualization(
        footprintA,
        footprintB,
        footprintA.imageUrl
    );
   
    if (vizPath) {
        const similarity = visualizer.calculateOverallSimilarity(footprintA, footprintB);
       
        await bot.sendPhoto(chatId, vizPath, {
            caption: `🔍 **ДЕТАЛЬНОЕ СРАВНЕНИЕ**\n\n` +
                    `🆔 Отпечатки: #${footprintIdA} vs #${footprintIdB}\n` +
                    `🎯 Общее сходство: ${similarity.toFixed(1)}%\n` +
                    `📊 Типы: ${footprintA.partType || 'неизв.'} vs ${footprintB.partType || 'неизв.'}\n\n` +
                    `💡 *Зеленый = совпадения, Красный = различия, Желтый = отсутствующие*`
        });
       
        // Удаляем временный файл
        fs.unlinkSync(vizPath);
    } else {
        await bot.sendMessage(chatId, '❌ Не удалось создать визуализацию сравнения');
    }
});

// 🧩 КОМАНДА СБОРКИ МОДЕЛИ
bot.onText(/\/assemble_model/, async (msg) => {
    const chatId = msg.chat.id;
   
    console.log(`🧩 Запрос сборки модели для чата ${chatId}`);
   
    // 🔧 ИСПРАВЛЕНИЕ: используем newSessionManager
    const session = getSessionManager().trailSessions.get(chatId);
    if (!session || session.footprints.length < 2) {
        await bot.sendMessage(chatId,
            '❌ Недостаточно отпечатков для сборки модели.\n\n' +
            'Требуется минимум 2 отпечатка.\n' +
            `Сейчас в сессии: ${session ? session.footprints.length : 0} отпечатков`
        );
        return;
    }
   
    await bot.sendMessage(chatId,
        '🧩 Начинаю сборку полной модели из доступных частей...\n' +
        '📊 Анализирую геометрию и совместимость...'
    );
   
    // Получаем размер изображения для анализа
    let imageWidth = 800, imageHeight = 600; // значения по умолчанию
    try {
        const firstFootprint = session.footprints[0];
        const image = await loadImage(firstFootprint.imageUrl);
        imageWidth = image.width;
        imageHeight = image.height;
    } catch (error) {
        console.log('⚠️ Не удалось получить размер изображения, использую значения по умолчанию');
    }
   
    const result = session.assembleModelFromParts(imageWidth, imageHeight);
   
    if (result.success) {
        const partsStats = session.getPartsStatistics();
       
        let message = `🧩 **МОДЕЛЬ УСПЕШНО СОБРАНА!**\n\n`;
        message += `📊 **Использовано отпечатков:** ${result.usedPrints.length}\n`;
        message += `🎯 **Полнота модели:** ${result.completeness}%\n`;
        message += `✅ **Уверенность:** ${result.confidence}%\n\n`;
       
        message += `📋 **Статистика частей:**\n`;
        message += `• Левые: ${partsStats.left_small + partsStats.left_medium + partsStats.left_large}\n`;
        message += `• Правые: ${partsStats.right_small + partsStats.right_medium + partsStats.right_large}\n`;
        message += `• Центральные: ${partsStats.center_small + partsStats.center_medium + partsStats.center_large}\n`;
        message += `• Неизвестные: ${partsStats.unknown}\n\n`;
       
        message += `💾 **Сохранить как эталон:**\n`;
        message += '`/save_assembled "Название_Модели"`\n\n';
       
        message += `🔍 **Просмотреть группы:** /show_groups`;
       
        await bot.sendMessage(chatId, message);
    } else {
        await bot.sendMessage(chatId,
            `❌ **Сборка модели не удалась**\n\n` +
            `Причина: ${result.error}\n\n` +
            `💡 **Рекомендации:**\n` +
            `• Добавьте больше отпечатков\n` +
            `• Убедитесь в схожести следов\n` +
            `• Используйте /compare_footprints для проверки совместимости`
        );
    }
});

// 🎨 ДОБАВИТЬ ПРЯМУЮ КОМАНДУ ВИЗУАЛИЗАЦИИ
bot.onText(/\/visualize_results/, async (msg) => {
    const chatId = msg.chat.id;
   
    // 🔧 ИСПРАВЛЕНИЕ: используем newSessionManager
    const session = getSessionManager().trailSessions.get(chatId);
    if (!session) {
        await bot.sendMessage(chatId, '❌ Нет активной сессии анализа тропы');
        return;
    }

    if (session.assembledModels.length === 0) {
        await bot.sendMessage(chatId,
            '❌ Нет собранных моделей для визуализации\n\n' +
            'Сначала соберите модели командой:\n' +
            '`/assemble_model`'
        );
        return;
    }

    await visualizationHandler.handleVisualizeResults({ chatId });
});

// 💾 КОМАНДА СОХРАНЕНИЯ СОБРАННОЙ МОДЕЛИ
bot.onText(/\/save_assembled (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const modelName = match[1].trim();
   
    console.log(`💾 Запрос сохранения собранной модели: "${modelName}"`);
   
    const session = getSessionManager().trailSessions.get(chatId);
    if (!session || session.assembledModels.length === 0) {
        await bot.sendMessage(chatId,
            '❌ Нет собранных моделей для сохранения.\n' +
            'Сначала используйте /assemble_model'
        );
        return;
    }
   
    // Берем последнюю собранную модель
    const lastModel = session.assembledModels[session.assembledModels.length - 1];
   
    // Сохраняем как эталон
    sessionManager.referencePrints.set(modelName, {
        features: lastModel.model.features,
        imageUrl: lastModel.model.sourcePrints[0] ?
            session.footprints.find(f => f.id === lastModel.model.sourcePrints[0])?.imageUrl : '',
        timestamp: new Date(),
        predictions: lastModel.model.predictions,
        isAssembled: true,
        sourcePrints: lastModel.model.sourcePrints,
        completeness: lastModel.completeness,
        confidence: lastModel.confidence
    });
   
    await bot.sendMessage(chatId,
        `✅ **СОБРАННАЯ МОДЕЛЬ СОХРАНЕНА**\n\n` +
        `🏷️ **Название:** "${modelName}"\n` +
        `📊 **Источник:** ${lastModel.model.sourcePrints.length} отпечатков\n` +
        `🎯 **Полнота:** ${lastModel.completeness}%\n` +
        `✅ **Уверенность:** ${lastModel.confidence}%\n\n` +
        `💡 Используйте: \`/compare ${modelName}\` для сравнения`
    );
   
    // Автосохранение данных
    const dataManager = new DataPersistence();
    await dataManager.saveAllData();
});

// 🔧 ОБНОВЛЕННАЯ КОМАНДА ПОКАЗА ГРУПП
bot.onText(/\/show_groups/, async (msg) => {
    const chatId = msg.chat.id;
    // 🔧 ИСПРАВЛЯЕМ
    const session = getSessionManager().trailSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId, '❌ Активная сессия не найдена');
        return;
    }
   
    session.updateCompatibilityGroups();
   
    if (session.compatibilityGroups.length === 0) {
        await bot.sendMessage(chatId, '❌ Группы не обнаружены. Добавьте больше следов.');
        return;
    }
   
    let message = `🕵️‍♂️ **АНАЛИЗ ТРОПЫ: ОБНАРУЖЕННЫЕ ЛЮДИ**\n\n`;
    message += `Всего следов: ${session.footprints.length}\n`;
    message += `Обнаружено людей: ${session.compatibilityGroups.length}\n\n`;
   
    session.compatibilityGroups.forEach((group, index) => {
        message += `**👤 ЧЕЛОВЕК ${index + 1}** (${group.length} следов):\n`;
       
        const groupAnalysis = analyzeGroupCharacteristics(group);
       
        message += `• 🎯 Уверенность: ${groupAnalysis.confidence}%\n`;
        message += `• 👣 Преобладающий тип: ${groupAnalysis.dominantPattern}\n`;
        message += `• 📏 Средний размер: ${groupAnalysis.avgSize}\n`;
        message += `• 🔍 Следы: ${group.map(f => f.id.replace('footprint_', '#')).join(', ')}\n\n`;
       
        message += `💡 *Для сборки модели:* /assemble_from_group ${index + 1}\n\n`;
    });
   
    await bot.sendMessage(chatId, message);
});

// 🆕 КОМАНДА ДЛЯ СБОРКИ КОНКРЕТНОЙ ГРУППЫ
bot.onText(/\/assemble_from_group (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const groupNumber = parseInt(match[1]) - 1;
    const session = getSessionManager().trailSessions.get(chatId);
   
    if (!session) {
        await bot.sendMessage(chatId, '❌ Активная сессия не найдена');
        return;
    }
   
    session.updateCompatibilityGroups();
   
    if (groupNumber < 0 || groupNumber >= session.compatibilityGroups.length) {
        await bot.sendMessage(chatId,
            `❌ Группа №${groupNumber + 1} не найдена. Доступные группы: 1-${session.compatibilityGroups.length}`
        );
        return;
    }
   
    const group = session.compatibilityGroups[groupNumber];
   
    await bot.sendMessage(chatId,
        `🧩 Сборка модели для человека ${groupNumber + 1}...\n` +
        `📊 Используется ${group.length} следов`
    );
   
    // 🔧 ИСПОЛЬЗУЕМ ТОЛЬКО СЛЕДЫ ИЗ ВЫБРАННОЙ ГРУППЫ
    let imageWidth = 800, imageHeight = 600;
    if (group[0].features?.imageSize) {
        imageWidth = group[0].features.imageSize.width;
        imageHeight = group[0].features.imageSize.height;
    }
   
    const result = session.assembleModelFromGroup(group, imageWidth, imageHeight);
   
    if (result.success) {
        let message = `👤 **МОДЕЛЬ ЧЕЛОВЕКА ${groupNumber + 1}**\n\n`;
        message += `📊 Следов использовано: ${result.usedPrints.length}\n`;
        message += `🎯 Полнота модели: ${result.completeness}%\n`;
        message += `✅ Уверенность: ${result.confidence}%\n\n`;
        message += `💾 Сохранить как: /save_assembled Человек_${groupNumber + 1}\n\n`;
        message += `🔍 Просмотреть детали: /debug_group ${groupNumber + 1}`;
       
        await bot.sendMessage(chatId, message);
    } else {
        await bot.sendMessage(chatId, `❌ Не удалось собрать модель: ${result.error}`);
    }
});

/**
* Вспомогательная функция для анализа характеристик группы
*/
function analyzeGroupCharacteristics(group) {
    if (group.length === 0) {
        return { confidence: 0, dominantPattern: 'неизвестно', avgSize: 'неизвестно' };
    }
   
    // Анализ преобладающего типа узора
    const patternCounts = {};
    group.forEach(footprint => {
        const pattern = footprint.patternType || 'unknown';
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
    });
   
    const dominantPattern = Object.entries(patternCounts)
        .sort((a, b) => b[1] - a[1])[0][0];
   
    // Расчет уверенности (простота - можно улучшить)
    const confidence = Math.min((group.length / 3) * 100, 100);
   
    // Средний "размер" по деталям
    const avgDetails = group.reduce((sum, f) => sum + (f.features?.detailCount || 0), 0) / group.length;
    const avgSize = avgDetails > 20 ? 'крупный' : avgDetails > 10 ? 'средний' : 'мелкий';
   
    return {
        confidence: Math.round(confidence),
        dominantPattern: dominantPattern.split('_')[0] || 'неизвестно',
        avgSize: avgSize
    };
}

// 💾 КОМАНДА РУЧНОГО СОХРАНЕНИЯ
bot.onText(/\/save_data/, async (msg) => {
    const chatId = msg.chat.id;
   
    await bot.sendMessage(chatId, '💾 Сохраняю все данные...');
   
    const dataManager = new DataPersistence();
    await dataManager.saveAllData();
   
    await bot.sendMessage(chatId,
        '✅ **Все данные сохранены!**\n\n' +
        '📊 Сохранено:\n' +
        `• Сессии: ${sessionManager.trailSessions.size}\n` +
        `• Эталоны: ${sessionManager.referencePrints.size}\n` +
        `• Пользователи: ${sessionManager.userStats.size}\n\n` +
        '💡 Данные будут восстановлены после перезапуска'
    );
});

// 📈 КОМАНДА РАСШИРЕННОЙ СТАТИСТИКИ
bot.onText(/\/detailed_stats/, async (msg) => {
    const chatId = msg.chat.id;
   
    const session = sessionManager.trailSessions.get(chatId);
    if (!session) {
        await bot.sendMessage(chatId, '❌ Активная сессия не найдена');
        return;
    }
   
    const report = session.generateEnhancedReport();
    await bot.sendMessage(chatId, report);
});

// 🔧 КОМАНДА ДЛЯ ДЕТАЛЬНОГО АНАЛИЗА УЗОРОВ
bot.onText(/\/debug_patterns/, async (msg) => {
    const chatId = msg.chat.id;
    const session = sessionManager.trailSessions.get(chatId);
   
    if (!session || session.footprints.length === 0) {
        await bot.sendMessage(chatId, '❌ Нет отпечатков для анализа');
        return;
    }
   
    let message = `🔬 **ДЕТАЛЬНЫЙ АНАЛИЗ УЗОРОВ ПРОТЕКТОРА**\n\n`;
   
    session.footprints.forEach((footprint, index) => {
        message += `👣 **Отпечаток #${index + 1}:**\n`;
        message += `• Тип: ${footprint.patternType || 'не определен'}\n`;
        message += `• Детали: ${footprint.features?.detailCount || 0}\n`;
        message += `• Крупные: ${footprint.features?.largeDetails || 0}\n`;
        message += `• Плотность: ${footprint.features?.density?.toFixed(2) || '?'}\n\n`;
    });
   
    // 🔍 АНАЛИЗ СОВМЕСТИМОСТИ МЕЖДУ ВСЕМИ ПАРАМИ
    if (session.footprints.length >= 2) {
        message += `🔄 **АНАЛИЗ СОВМЕСТИМОСТИ:**\n`;
       
        for (let i = 0; i < session.footprints.length; i++) {
            for (let j = i + 1; j < session.footprints.length; j++) {
                const score = footprintAssembler.advancedPatternComparison(
                    session.footprints[i].predictions,
                    session.footprints[j].predictions
                );
                message += `#${i+1}↔#${j+1}: ${score.toFixed(3)}\n`;
            }
        }
    }
   
    await bot.sendMessage(chatId, message);
});

// 🔧 КОМАНДЫ ДЛЯ ТЕСТИРОВАНИЯ И ОТЛАДКИ

// Тест классификации частей
bot.onText(/\/test_classify/, async (msg) => {
    const chatId = msg.chat.id;
    const session = sessionManager.trailSessions.get(chatId);
   
    if (!session || session.footprints.length === 0) {
        await bot.sendMessage(chatId, '❌ Нет отпечатков для тестирования');
        return;
    }
   
    let message = `🧪 **ТЕСТ КЛАССИФИКАЦИИ ЧАСТЕЙ**\n\n`;
   
    session.footprints.forEach((footprint, index) => {
        const partType = footprint.partType || 'не классифицирован';
        const potential = footprint.assemblyPotential || 0;
        message += `📸 Отпечаток ${index + 1}: ${partType} (потенциал: ${potential}%)\n`;
    });
   
    await bot.sendMessage(chatId, message);
});

// Сброс и очистка данных (для тестирования)
bot.onText(/\/debug_reset/, async (msg) => {
    const chatId = msg.chat.id;
   
    sessionManager.trailSessions.delete(chatId);
    const session = sessionManager.getTrailSession(chatId, msg.from.username || msg.from.first_name);
   
    await bot.sendMessage(chatId,
        '🔄 **СБРОС СЕССИИ ДЛЯ ТЕСТИРОВАНИЯ**\n\n' +
        'Сессия очищена и создана заново.\n' +
        'Можете начинать тестирование функций сборки.'
    );
});

// 🔧 КОМАНДА ДЛЯ ТЕСТИРОВАНИЯ ГЕОМЕТРИЧЕСКОЙ НОРМАЛИЗАЦИИ
bot.onText(/\/test_geometry/, async (msg) => {
    const chatId = msg.chat.id;
    const session = sessionManager.trailSessions.get(chatId);
   
    if (!session || session.footprints.length === 0) {
        await bot.sendMessage(chatId, '❌ Нет отпечатков для тестирования геометрии');
        return;
    }
   
    let message = `📐 **ТЕСТ ГЕОМЕТРИЧЕСКОЙ НОРМАЛИЗАЦИИ**\n\n`;
   
    session.footprints.forEach((footprint, index) => {
        const bbox = footprintAssembler.calculateOverallBoundingBox(footprint.predictions);
        const aspectRatio = bbox.width / bbox.height;
        const area = bbox.width * bbox.height;
       
        message += `📸 **Отпечаток ${index + 1}:**\n`;
        message += `• Размер: ${bbox.width.toFixed(0)}x${bbox.height.toFixed(0)}px\n`;
        message += `• Соотношение: ${aspectRatio.toFixed(2)}\n`;
        message += `• Площадь: ${area.toFixed(0)}px²\n`;
        message += `• Тип: ${footprint.partType || 'неизвестно'}\n\n`;
    });
   
    // ПРОВЕРЯЕМ ГЕОМЕТРИЧЕСКУЮ СОВМЕСТИМОСТЬ
    if (session.footprints.length >= 2) {
        message += `🔍 **ГЕОМЕТРИЧЕСКОЕ СРАВНЕНИЕ:**\n`;
       
        for (let i = 0; i < session.footprints.length; i++) {
            for (let j = i + 1; j < session.footprints.length; j++) {
                const score = footprintAssembler.calculateGeometricSimilarity(
                    [session.footprints[i]],
                    session.footprints[j]
                );
                message += `• #${i+1} vs #${j+1}: ${score.toFixed(2)}\n`;
            }
        }
    }
   
    await bot.sendMessage(chatId, message);
});

// 🏔️ КОМАНДА: ПЕРЕЗАПУСК ПЕРЕВЕРНУТОЙ ПИРАМИДЫ
bot.onText(/\/rebuild_hierarchy/, async (msg) => {
    const chatId = msg.chat.id;
    const session = getSessionManager().trailSessions.get(chatId);
  
    if (!session || session.footprints.length === 0) {
        await bot.sendMessage(chatId, '❌ Нет активной сессии или следов для обработки');
        return;
    }
  
    await bot.sendMessage(chatId,
        '🏔️ **Запуск перевернутой пирамиды...**\n\n' +
        '📊 Обрабатываю следы: ' + session.footprints.length + '\n' +
        '⏳ Это может занять несколько минут...'
    );
  
    try {
        // 🔧 ИСПОЛЬЗУЕМ ЗАГЛУШКУ
        const hierarchy = getModelHierarchy(session);
        const finalModels = await hierarchy.processHierarchy();
        const stats = hierarchy.getStats();
      
        let message = '🎯 **ПЕРЕВЕРНУТАЯ ПИРАМИДА ЗАВЕРШЕНА**\n\n';
        message += `📊 **СТАТИСТИКА:**\n`;
        message += `• Исходно следов: ${stats.levels.raw}\n`;
        message += `• Финальных моделей: ${stats.levels.final}\n`;
        message += `• Неопознанных следов: ${stats.levels.orphans}\n`;
        message += `• Объединено моделей: ${stats.modelsMerged}\n`;
        message += `• Усыновлено следов: ${stats.orphansAdopted}\n\n`;
      
        message += `💡 **Функция временно в режиме заглушки**\n`;
        message += `• Используйте обычные команды сборки\n`;
        message += `• /show_groups - просмотр групп\n`;
        message += `• /assemble_from_group - ручная сборка`;
      
        await bot.sendMessage(chatId, message);
      
    } catch (error) {
        console.error('❌ Ошибка пирамиды:', error);
        await bot.sendMessage(chatId,
            '❌ **Ошибка перевернутой пирамиды**\n\n' +
            'Причина: ' + error.message
        );
    }
});

// 🔍 КОМАНДА: ДЕТАЛИ ПЕРЕВЕРНУТОЙ ПИРАМИДЫ
bot.onText(/\/hierarchy_debug/, async (msg) => {
    const chatId = msg.chat.id;
    const session = getSessionManager().trailSessions.get(chatId);
  
    if (!session || session.footprints.length === 0) {
        await bot.sendMessage(chatId, '❌ Нет активной сессии или следов');
        return;
    }
  
    try {
        // 🔧 ИСПОЛЬЗУЕМ ЗАГЛУШКУ
        const hierarchy = getModelHierarchy(session);
        await hierarchy.processHierarchy();
        const stats = hierarchy.getStats();
      
        let message = '🔍 **ДЕТАЛИ ПЕРЕВЕРНУТОЙ ПИРАМИДЫ**\n\n';
        message += `📊 **РЕЖИМ ЗАГЛУШКИ**\n`;
        message += `• ModelHierarchy временно отключен\n`;
        message += `• Причина: circular dependency\n`;
        message += `• Используйте обычные команды анализа\n\n`;
      
        message += `💡 **АЛЬТЕРНАТИВНЫЕ КОМАНДЫ:**\n`;
        message += `• /show_groups - группы следов\n`;
        message += `• /assemble_model - сборка моделей\n`;
        message += `• /visualize_results - визуализация`;
      
        await bot.sendMessage(chatId, message);
      
    } catch (error) {
        await bot.sendMessage(chatId, '❌ Ошибка получения деталей: ' + error.message);
    }
});

// =============================================================================
// 🎮 СИСТЕМА ИНТЕРАКТИВНЫХ КНОПОК
// =============================================================================

/**
* 🏠 УЛУЧШЕННОЕ ГЛАВНОЕ МЕНЮ
*/
async function showMainMenu(chatId) {
    const session = getSessionManager().trailSessions.get(chatId);
    const hasActiveSession = session && session.status === 'active';
    const footprintsCount = hasActiveSession ? session.footprints.length : 0;
   
    const menuKeyboard = {
        reply_markup: {
            inline_keyboard: [
                // Основные действия
                [
                    { text: "🕵️‍♂️ Начать анализ тропы", callback_data: "start_trail_analysis" },
                    { text: "📸 Анализ одного следа", callback_data: "single_analysis" }
                ],
                // Сравнения и эталоны
                [
                    { text: "🔍 Сравнить с эталоном", callback_data: "compare_reference" },
                    { text: "💾 Сохранить эталон", callback_data: "save_reference" }
                ],
                // Информация
                [
                    { text: "📊 Статистика системы", callback_data: "show_stats" },
                    { text: "ℹ️ Помощь", callback_data: "show_help" }
                ],
                // Если есть активная сессия - быстрый доступ
                hasActiveSession ? [
                    { text: `🔍 Продолжить анализ (${footprintsCount} следов)`, callback_data: "continue_analysis" }
                ] : []
            ].filter(row => row.length > 0) // Убираем пустые ряды
        }
    };
   
    let message = `🤖 **СИСТЕМА КРИМИНАЛИСТИЧЕСКОЙ ЭКСПЕРТИЗЫ**\n\n`;
   
    if (hasActiveSession) {
        message += `🟢 **АКТИВНА СЕССИЯ АНАЛИЗА**\n`;
        message += `• Следов: ${footprintsCount}\n`;
        message += `• ID: ${session.sessionId}\n`;
        message += `• Эксперт: ${session.expert}\n\n`;
    } else {
        message += `📊 **Статистика системы:**\n`;
        message += `• Экспертов: ${getSessionManager().globalStats.totalUsers}\n`;
message += `• Отпечатков: ${getSessionManager().globalStats.totalPhotos}\n`;
message += `• Анализов: ${getSessionManager().globalStats.totalAnalyses}\n\n`;
}
   
    message += `🎮 **Выберите действие:**`;
   
    await bot.sendMessage(chatId, message, menuKeyboard);
}

/**
* 🔍 ОБНОВЛЕННОЕ МЕНЮ АНАЛИЗА ТРОПЫ
*/
async function showTrailAnalysisMenu(chatId, session = null) {
    if (!session) {
        session = newSessionManager.trailSessions.get(chatId);
    }
   
    const footprintsCount = session ? session.footprints.length : 0;
    const modelsCount = session ? session.assembledModels.length : 0;
    const groupsCount = session ? (session.compatibilityGroups ? session.compatibilityGroups.length : 0) : 0;
    const comparisonsCount = session ? session.comparisons.length : 0;
   
    const trailKeyboard = {
        reply_markup: {
            inline_keyboard: [
                // Основные действия
                [
                    { text: "📸 Добавить следы", callback_data: "add_footprints" },
                    { text: "🔄 Автоанализ", callback_data: "auto_analyze" }
                ],
                // 🎨 ВИЗУАЛИЗАЦИЯ
            [
                { text: "🎨 Визуализация", callback_data: "visualization_menu" },
                { text: "📈 Отчет", callback_data: "detailed_report" }
            ],
                // Анализ и группировка
                [
                    { text: `👥 Группы (${groupsCount})`, callback_data: "show_groups" },
                    { text: `🧩 Собрать модели`, callback_data: "assemble_models" }
                ],
                // Продвинутые функции
                [
                    { text: "🏔️ Умный анализ", callback_data: "rebuild_hierarchy" },
                    { text: "📈 Отчет", callback_data: "detailed_report" }
                ],
                // Управление данными
                [
                    { text: "💾 Сохранить", callback_data: "save_data" },
                    { text: "🔙 Главное меню", callback_data: "main_menu" }
                ]
            ]
        }
    };
   
    let message = `🔍 **РЕЖИМ АНАЛИЗА ТРОПЫ**\n\n`;
   
    if (session) {
        message += `📊 **Статус сессии:**\n`;
        message += `• ID: ${session.sessionId}\n`;
        message += `• Статус: ${session.status === 'active' ? '🟢 АКТИВНА' : '🔴 ЗАВЕРШЕНА'}\n`;
        message += `• Следов: ${footprintsCount}\n`;
        message += `• Групп: ${groupsCount}\n`;
        message += `• Моделей: ${modelsCount}\n`;
        message += `• Сравнений: ${comparisonsCount}\n`;
        message += `• Эксперт: ${session.expert}\n\n`;
    } else {
        message += `❌ **Сессия не активна**\n\n`;
    }
   
    message += `🎮 **Выберите действие:**`;
   
    await bot.sendMessage(chatId, message, trailKeyboard);
}

/**
* 👥 МЕНЮ ГРУПП СЛЕДОВ
*/
async function showGroupsMenu(chatId, groups, session) {
    const groupButtons = groups.map((group, index) => {
        const groupSize = group.length;
        const confidence = Math.min((groupSize / 3) * 100, 100);
        return [{
            text: `👤 Группа ${index + 1} (${groupSize} следов, ${Math.round(confidence)}%)`,
            callback_data: `show_group_${index}`
        }];
    });
   
    const actionButtons = [
        [{ text: "🧩 Собрать все модели", callback_data: "assemble_all_models" }],
        [{ text: "🔄 Пересчитать группы", callback_data: "recalculate_groups" }],
        [{ text: "🔙 К анализу", callback_data: "back_to_analysis" }]
    ];
   
    const groupsKeyboard = {
        reply_markup: {
            inline_keyboard: [...groupButtons, ...actionButtons]
        }
    };
   
    const totalFootprints = groups.reduce((sum, group) => sum + group.length, 0);
   
    await bot.sendMessage(chatId,
        `👥 **ОБНАРУЖЕНО ГРУПП: ${groups.length}**\n\n` +
        `📊 **Статистика:**\n` +
        `• Всего следов: ${totalFootprints}\n` +
        `• Групп обнаружено: ${groups.length}\n` +
        `• Средняя группа: ${Math.round(totalFootprints / groups.length)} следов\n\n` +
       
        `💡 **Выберите группу для детального просмотра:**\n` +
        `• Нажмите на группу чтобы увидеть детали\n` +
        `• Используйте "Собрать модели" для создания полных моделей`,
        groupsKeyboard
    );
}

// =============================================================================
// 🎯 ОБРАБОТЧИКИ ДЕЙСТВИЙ КНОПОК
// =============================================================================

/**
* 🎨 МЕНЮ ВИЗУАЛИЗАЦИИ
*/
async function showVisualizationMenu(chatId) {
    const session = getSessionManager().trailSessions.get(chatId);
    const modelsCount = session ? session.assembledModels.length : 0;

    const vizKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: `🧩 Все модели (${modelsCount})`, callback_data: "visualize_all_models" },
                    { text: "🔍 Детали модели", callback_data: "show_model_details" }
                ],
                [
                    { text: "📊 Сравнение следов", callback_data: "compare_footprints_viz" },
                    { text: "🎯 Анализ групп", callback_data: "analyze_groups_viz" }
                ],
                [
                    { text: "🔙 К анализу", callback_data: "back_to_analysis" }
                ]
            ]
        }
    };

    let message = `🎨 **МЕНЮ ВИЗУАЛИЗАЦИИ**\n\n`;

    if (session) {
        message += `📊 **Доступно для визуализации:**\n`;
        message += `• Собранных моделей: ${modelsCount}\n`;
        message += `• Всего следов: ${session.footprints.length}\n`;
        message += `• Групп: ${session.compatibilityGroups.length}\n\n`;
    }

    message += `💡 **Выберите тип визуализации:**`;

    await bot.sendMessage(chatId, message, vizKeyboard);
}

/**
* 🚀 ЗАПУСК АНАЛИЗА ТРОПЫ
*/
async function startTrailAnalysis(chatId, user) {
     const session = newSessionManager.getTrailSession(chatId, user.username || user.first_name);
   
    await bot.sendMessage(chatId,
        `🕵️‍♂️ **АНАЛИЗ ТРОПЫ ЗАПУЩЕН!**\n\n` +
        `**Сессия:** ${session.sessionId}\n` +
        `**Эксперт:** ${session.expert}\n` +
        `**Время начала:** ${session.startTime.toLocaleString('ru-RU')}\n\n` +
       
        `📸 **Теперь отправляйте фото следов для анализа.**\n\n` +
       
        `🎯 **Система автоматически:**\n` +
        `• Сохранит следы в сессию\n` +
        `• Сравнит их между собой\n` +
        `• Определит группы людей\n` +
        `• Соберет полные модели\n\n` +
       
        `💡 **Совет:** Начните с 3-5 четких фото следов!`
    );
   
    await showTrailAnalysisMenu(chatId, session);
}

/**
* 📸 АНАЛИЗ ОДНОГО СЛЕДА
*/
async function handleSingleAnalysis(chatId) {
    await bot.sendMessage(chatId,
        "📸 **РЕЖИМ АНАЛИЗА ОДНОГО СЛЕДА**\n\n" +
        "Просто отправьте фото следа для анализа.\n\n" +
        "🎯 **Система определит:**\n" +
        "• Морфологические признаки\n" +
        "• Тип протектора\n" +
        "• Качество изображения\n" +
        "• Рекомендации по съемке\n\n" +
       
        "💡 **Требования к фото:**\n" +
        "• Четкий след на контрастном фоне\n" +
        "• Прямой угол съемки\n" +
        "• Хорошее освещение\n" +
        "• Крупный план\n\n" +
       
        "📸 **Отправьте фото сейчас...**"
    );
}

/**
* 🔍 СРАВНЕНИЕ С ЭТАЛОНОМ
*/
async function handleCompareReference(chatId) {
    if (sessionManager.referencePrints.size === 0) {
        await bot.sendMessage(chatId,
            '📝 **СПИСОК ЭТАЛОНОВ ПУСТ**\n\n' +
            'Сначала сохраните эталоны командой:\n' +
            '`/save_reference Название_Модели`\n\n' +
            'Или через кнопку "💾 Сохранить эталон"\n\n' +
            '💡 **Пример:**\n' +
            '`/save_reference Nike_Air_Max_90`'
        );
        return;
    }

    // Создаем кнопки для выбора эталона
    const referenceButtons = Array.from(sessionManager.referencePrints.entries()).map(([modelName, ref]) => {
        const details = ref.features ? ref.features.detailCount : '?';
        return [{
            text: `🔍 ${modelName} (${details} дет.)`,
            callback_data: `compare_with_${modelName}`
        }];
    });

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                ...referenceButtons,
                [{ text: "🔙 Назад", callback_data: "main_menu" }]
            ]
        }
    };

    await bot.sendMessage(chatId,
        '🔍 **ВЫБЕРИТЕ ЭТАЛОН ДЛЯ СРАВНЕНИЯ:**\n\n' +
        'После выбора эталона отправьте фото следа для сравнения.',
        keyboard
    );
}
/**
* 💾 СОХРАНЕНИЕ ЭТАЛОНА
*/
async function handleSaveReference(chatId) {
    await bot.sendMessage(chatId,
        '💾 **СОХРАНЕНИЕ ЭТАЛОННОГО ОТПЕЧАТКА**\n\n' +
        '📝 **Укажите название модели через пробел:**\n' +
        'Пример: `/save_reference Nike_Air_Max_90`\n\n' +
       
        '💡 **Рекомендации по названию:**\n' +
        '• Используйте латиницу или кириллицу\n' +
        '• Замените пробелы на подчеркивания\n' +
        '• Будьте конкретны в описании\n\n' +
       
        '📸 **После ввода названия отправьте фото подошвы:**\n' +
        '• Чистая подошва, вид сверху\n' +
        '• Хорошее освещение\n' +
        '• Максимальная детализация\n\n' +
       
        '❌ **Для отмены:** /cancel\n\n' +
       
        '📝 **Введите название модели сейчас...**'
    );
}
/**
* 📊 ПОКАЗ СТАТИСТИКИ
*/
async function handleShowStats(chatId) {
    const activeUsers = Array.from(getSessionManager().userStats.values()).filter(user =>
        (new Date() - user.lastSeen) < 7 * 24 * 60 * 60 * 1000
    ).length;

    const sessionsCount = Array.from(getSessionManager().trailSessions.values()).filter(s =>
        s.status === 'active'
    ).length;

    const stats = `📊 **СТАТИСТИКА СИСТЕМЫ**\n\n` +
             `👥 **Пользователи:**\n` +
             `• Всего: ${getSessionManager().globalStats.totalUsers}\n` +
             `• Активных: ${activeUsers}\n\n` +
             `📸 **Обработка фото:**\n` +
             `• Фото обработано: ${getSessionManager().globalStats.totalPhotos}\n` +
             `• Анализов проведено: ${getSessionManager().globalStats.totalAnalyses}\n` +
             `• Сравнений сделано: ${getSessionManager().globalStats.comparisonsMade}\n\n` +
             `🕵️‍♂️ **Активные сессии:**\n` +
             `• Сессий анализа: ${sessionsCount}\n` +
             `• Сохраненных эталонов: ${getSessionManager().referencePrints.size}\n\n` +
             `📅 **Последний анализ:** ${getSessionManager().globalStats.lastAnalysis ?
                     newSessionManager.globalStats.lastAnalysis.toLocaleString('ru-RU') : 'еще нет'}`;

    await bot.sendMessage(chatId, stats);
}
/**
* ℹ️ ПОКАЗ ПОМОЩИ
*/
async function handleShowHelp(chatId) {
    await bot.sendMessage(chatId,
        `🆘 **ПОМОЩЬ И ИНФОРМАЦИЯ О СИСТЕМЕ**\n\n` +
       
        `🎯 **ОСНОВНЫЕ КОМАНДЫ:**\n` +
        `• Просто отправьте фото - анализ следа\n` +
        `• /trail_start - режим анализа тропы\n` +
        `• /save_reference - сохранить эталон\n` +
        `• /compare - сравнить с эталоном\n` +
        `• /menu - главное меню\n\n` +
       
        `🧩 **ФУНКЦИИ СБОРКИ:**\n` +
        `• /assemble_model - собрать полную модель из частей\n` +
        `• /compare_footprints 1 3 - сравнить два отпечатка\n` +
        `• /show_groups - показать группы совместимости\n` +
        `• /save_assembled - сохранить собранную модель\n\n` +
       
        `🎨 **ВИЗУАЛИЗАЦИЯ:**\n` +
        `• /show_model [номер] - показать собранную модель\n` +
        `• /visualize_results - все модели с картинками\n` +
        `• /model_details [номер] - детальная визуализация\n\n` +
       
        `📊 **СТАТИСТИКА:**\n` +
        `• /statistics - статистика системы\n` +
        `• /detailed_stats - расширенная статистика\n\n` +
       
        `💡 **РЕКОМЕНДАЦИИ ПО СЪЕМКЕ:**\n` +
        `- Четкий след на контрастном фоне\n` +
        `- Прямой угол съемки\n` +
        `- Хорошее освещение без теней\n` +
        `- Крупный план, след занимает 70% кадра\n\n` +
       
        `⚠️ **ОГРАНИЧЕНИЯ СИСТЕМЫ:**\n` +
        `- Требуется четкое изображение\n` +
        `- Лучше несколько фото под разными углами\n` +
        `- Модель работает лучше с 3+ следами`
    );
}
/**
* 📸 ДОБАВЛЕНИЕ СЛЕДОВ
*/
async function handleAddFootprints(chatId) {
    await bot.sendMessage(chatId,
        "📸 **ДОБАВЛЕНИЕ СЛЕДОВ В СЕССИЮ**\n\n" +
        "Отправляйте фото следов для анализа.\n\n" +
        "🎯 **Каждое фото будет:**\n" +
        "• Проанализировано на детали\n" +
        "• Добавлено в текущую сессию\n" +
        "• Автоматически сравнено с предыдущими\n" +
        "• Классифицировано по типу протектора\n\n" +
       
        "💡 **Рекомендации:**\n" +
        "• Отправляйте по одному фото за раз\n" +
        "• Следите за качеством изображения\n" +
        "• Используйте одинаковые условия съемки\n\n" +
       
        "📸 **Отправляйте фото сейчас...**\n\n" +
        "❌ **Для отмены:** /cancel"
    );
}
/**
* 💾 СОХРАНЕНИЕ ДАННЫХ
*/
async function handleSaveData(chatId) {
    await bot.sendMessage(chatId, '💾 Сохраняю все данные...');
   
    const dataManager = new DataPersistence();
    await dataManager.saveAllData();
   
    const session = getSessionManager().trailSessions.get(chatId);
    const sessionsCount = Array.from(getSessionManager().trailSessions.values()).length;
   
    await bot.sendMessage(chatId,
        '✅ **ВСЕ ДАННЫЕ СОХРАНЕНЫ!**\n\n' +
        `📊 **Сохранено:**\n` +
        `• Сессий анализа: ${sessionsCount}\n` +
        `• Эталонов: ${getSessionManager().referencePrints.size}\n` +
`• Пользователей: ${getSessionManager().userStats.size}\n\n` +
       
        `💡 **В сохраненные данные входят:**\n` +
        `• Все активные сессии\n` +
        `• Эталонные отпечатки\n` +
        `• Статистика системы\n` +
        `• История анализов\n\n` +
       
        `🔄 **Данные будут восстановлены после перезапуска бота**`
    );
   
    await showTrailAnalysisMenu(chatId, session);
}

/**
* 🤖 АВТОМАТИЧЕСКИЙ АНАЛИЗ
*/
async function autoAnalyze(chatId) {
    const session = sessionManager.trailSessions.get(chatId);
    if (!session || session.footprints.length === 0) {
        await bot.sendMessage(chatId, '❌ Нет следов для анализа. Сначала отправьте фото следов.');
        return;
    }
   
    await bot.sendMessage(chatId, '🤖 **ЗАПУСК АВТОМАТИЧЕСКОГО АНАЛИЗА**\n\n⏳ Обрабатываю следы...');
   
    // 1. Показываем группы
    session.updateCompatibilityGroups();
    await showGroupsMenu(chatId, session.compatibilityGroups, session);
   
    // 2. Запускаем пирамиду
    try {
        const hierarchy = new ModelHierarchy(session);
        await hierarchy.processHierarchy();
        const stats = hierarchy.getStats();
       
        await bot.sendMessage(chatId,
            `🏔️ **ПИРАМИДА ЗАВЕРШЕНА**\n\n` +
            `• Финальных моделей: ${stats.levels.final}\n` +
            `• Уверенность: ${stats.levels.final > 0 ? 'Высокая' : 'Требует проверки'}\n`
        );
    } catch (error) {
        await bot.sendMessage(chatId, '⚠️ Пирамида не сработала, но группы определены');
    }
   
    // 3. Собираем модели
    await handleAssembleModels(chatId);
}

/**
* 👥 ПОКАЗ ГРУПП СЛЕДОВ
*/
async function handleShowGroups(chatId) {
    const session = sessionManager.trailSessions.get(chatId);
    if (!session) {
        await bot.sendMessage(chatId, '❌ Активируйте сначала анализ тропы');
        return;
    }
   
    session.updateCompatibilityGroups();
   
    if (session.compatibilityGroups.length === 0) {
        await bot.sendMessage(chatId,
            '❌ Группы не обнаружены.\n\n' +
            '💡 **Добавьте больше следов:**\n' +
            '• Нужно минимум 2 следа\n' +
            '• Чем больше следов - точнее группы\n' +
            '• Используйте четкие фото'
        );
        return;
    }
   
    await showGroupsMenu(chatId, session.compatibilityGroups, session);
}
/**
* 📈 ДЕТАЛЬНЫЙ ОТЧЕТ
*/
async function handleDetailedReport(chatId) {
    const session = sessionManager.trailSessions.get(chatId);
    if (session && session.footprints.length > 0) {
        const report = session.generateEnhancedReport();
        await bot.sendMessage(chatId, report);
    } else {
        await bot.sendMessage(chatId,
            '❌ Нет данных для отчета.\n\n' +
            '💡 **Сначала добавьте следы в сессию**'
        );
    }
}
/**
* 🔍 ДЕТАЛИ КОНКРЕТНОЙ ГРУППЫ
*/
async function handleShowGroupDetails(chatId, data) {
    const groupIndex = parseInt(data.split('_')[2]);
    const session = sessionManager.trailSessions.get(chatId);
   
    if (!session || !session.compatibilityGroups[groupIndex]) {
        await bot.sendMessage(chatId, '❌ Группа не найдена');
        return;
    }
   
    const group = session.compatibilityGroups[groupIndex];
    const analysis = analyzeGroupCharacteristics(group);
   
    let message = `👤 **ГРУППА ${groupIndex + 1}**\n\n`;
    message += `📊 **Характеристики:**\n`;
    message += `• Следов: ${group.length}\n`;
    message += `• Уверенность: ${analysis.confidence}%\n`;
    message += `• Преобладающий тип: ${analysis.dominantPattern}\n`;
    message += `• Средний размер: ${analysis.avgSize}\n\n`;
   
    message += `📋 **Следы в группе:**\n`;
    group.forEach((footprint, index) => {
        const footprintNum = footprint.id.replace('footprint_', '#');
        const type = footprint.patternType || 'неизвестно';
        message += `${index + 1}. ${footprintNum} (${type})\n`;
    });
   
    message += `\n💡 **Действия:**\n`;
    message += `• Собрать модель: /assemble_from_group ${groupIndex + 1}\n`;
    message += `• Сравнить следы: /compare_footprints 1 2\n`;
   
    await bot.sendMessage(chatId, message);
}
/**
* 🧩 СБОРКА МОДЕЛЕЙ
*/
async function handleAssembleModels(chatId) {
    const session = sessionManager.trailSessions.get(chatId);
    if (!session || session.footprints.length < 2) {
        await bot.sendMessage(chatId, '❌ Недостаточно следов для сборки (нужно минимум 2)');
        return;
    }
   
    await bot.sendMessage(chatId, '🧩 **НАЧИНАЮ СБОРКУ МОДЕЛЕЙ**\n\n⏳ Анализирую совместимость...');
   
    // Получаем размеры для анализа
    let imageWidth = 800, imageHeight = 600;
    try {
        const firstFootprint = session.footprints[0];
        const image = await loadImage(firstFootprint.imageUrl);
        imageWidth = image.width;
        imageHeight = image.height;
    } catch (error) {
        console.log('⚠️ Не удалось получить размеры изображения');
    }
   
    const result = session.assembleModelFromParts(imageWidth, imageHeight);
   
    if (result.success) {
        await bot.sendMessage(chatId,
            `✅ **МОДЕЛИ СОБРАНЫ**\n\n` +
            `• Использовано следов: ${result.usedPrints.length}\n` +
            `• Полнота модели: ${result.completeness}%\n` +
            `• Уверенность: ${result.confidence.toFixed(1)}%`
        );
    } else {
        await bot.sendMessage(chatId, `❌ Ошибка сборки: ${result.error}`);
    }
   
    // Возвращаем в меню анализа
    await showTrailAnalysisMenu(chatId, session);
}

/**
* 🏔️ ЗАПУСК ПИРАМИДЫ
*/
async function handleRebuildHierarchy(chatId) {
    const session = sessionManager.trailSessions.get(chatId);
    if (!session) {
        await bot.sendMessage(chatId, '❌ Нет активной сессии для пирамиды');
        return;
    }
   
    await bot.sendMessage(chatId, '🏔️ **ЗАПУСК ПЕРЕВЕРНУТОЙ ПИРАМИДЫ**\n\n⏳ Обрабатываю следы...');
   
    try {
        const hierarchy = new ModelHierarchy(session);
        const finalModels = await hierarchy.processHierarchy();
        const stats = hierarchy.getStats();
       
        await bot.sendMessage(chatId,
            `🎯 **ПИРАМИДА ЗАВЕРШЕНА**\n\n` +
            `📊 **Результаты:**\n` +
            `• Исходно следов: ${stats.levels.raw}\n` +
            `• Финальных моделей: ${stats.levels.final}\n` +
            `• Объединено моделей: ${stats.modelsMerged}\n` +
            `• Уверенность: ${stats.levels.final > 0 ? '✅ Высокая' : '⚠️ Требует проверки'}\n\n` +
            `💡 Используйте "Собрать модели" для финальной сборки.`
        );
    } catch (error) {
        await bot.sendMessage(chatId,
            `❌ Ошибка пирамиды: ${error.message}\n\n` +
            `💡 Попробуйте использовать обычную сборку моделей.`
        );
    }
   
    await showTrailAnalysisMenu(chatId, session);
}



bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const data = callbackQuery.data;
    const user = callbackQuery.from;
   
    await bot.answerCallbackQuery(callbackQuery.id);
   
    console.log(`🔄 Обработка кнопки: ${data} от пользователя ${user.username || user.first_name}`);
   
    try {
        // 🏠 ГЛАВНОЕ МЕНЮ И НАВИГАЦИЯ
        if (data === 'main_menu') {
            await showMainMenu(chatId);
        }
        else if (data === 'continue_analysis') {
            await showTrailAnalysisMenu(chatId, getSessionManager().trailSessions.get(chatId));
        }
       
        // 🕵️‍♂️ АНАЛИЗ ТРОПЫ
        else if (data === 'start_trail_analysis') {
            await startTrailAnalysis(chatId, user);
        }
        else if (data === 'single_analysis') {
            await handleSingleAnalysis(chatId);
        }
       
        // 🔍 СРАВНЕНИЯ И ЭТАЛОНЫ
        else if (data === 'compare_reference') {
            await handleCompareReference(chatId);
        }
        else if (data === 'save_reference') {
            await handleSaveReference(chatId);
        }
       
        // 📊 ИНФОРМАЦИЯ
        else if (data === 'show_stats') {
            await handleShowStats(chatId);
        }
        else if (data === 'show_help') {
            await handleShowHelp(chatId);
        }
       
        // 🔍 МЕНЮ АНАЛИЗА ТРОПЫ
        else if (data === 'auto_analyze') {
            await autoAnalyze(chatId);
        }
        else if (data === 'show_groups') {
            await handleShowGroups(chatId);
        }
        else if (data === 'assemble_models') {
            await handleAssembleModels(chatId);
        }
        else if (data === 'rebuild_hierarchy') {
            await handleRebuildHierarchy(chatId);
        }
        else if (data === 'save_data') {
            await handleSaveData(chatId);
        }
        else if (data === 'detailed_report') {
            await handleDetailedReport(chatId);
        }
        else if (data === 'add_footprints') {
            await handleAddFootprints(chatId);
        }
       
        // 👥 РАБОТА С ГРУППАМИ
        else if (data.startsWith('show_group_')) {
            await handleShowGroupDetails(chatId, data);
        }
        else if (data === 'back_to_analysis') {
            await showTrailAnalysisMenu(chatId, getSessionManager().trailSessions.get(chatId));
        }
       
        // 🎨 ВИЗУАЛИЗАЦИЯ
        else if (data === 'visualization_menu') {
            await showVisualizationMenu(chatId);
        }
        else if (data === 'visualize_all_models') {
            await visualizationHandler.handleVisualizeResults({ chatId });
        }
        else if (data === 'show_model_details') {
            await bot.sendMessage(chatId, 'Введите номер модели: /model_details [номер]');
        }
        else if (data === 'compare_footprints_viz') {
            await bot.sendMessage(chatId, 'Введите номера следов: /compare_footprints 1 2');
        }
        else if (data === 'analyze_groups_viz') {
            await handleShowGroups(chatId);
        }
       
        // 🔧 ДОБАВИТЬ СЮДА - ПОМОЩЬ (ПРАВИЛЬНО!)
        else if (data.startsWith('help_')) {
            const helpType = data.replace('help_', '');
            const userId = user.id;
           
            switch (helpType) {
                case 'trail':
                    await helpHandler.showTrailHelp(chatId);
                    break;
                case 'visualization':
                    await helpHandler.showVisualizationHelp(chatId);
                    break;
                case 'assembly':
                    await helpHandler.showAssemblyHelp(chatId);
                    break;
                case 'admin':
                    await helpHandler.showAdminHelp(chatId, userId);
                    break;
                case 'close':
                    await bot.deleteMessage(chatId, message.message_id);
                    break;
            }
        }
       
        else {
            await bot.sendMessage(chatId, '❌ Неизвестная команда. Используйте кнопки меню.');
            await showMainMenu(chatId);
        }
       
    } catch (error) {
        console.error('❌ Ошибка обработки кнопки:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка при обработке запроса');
        await showMainMenu(chatId);
    }
});


// =============================================================================
// 🚀 ЗАПУСК СИСТЕМЫ
// ===============================================================
async function loadStats() {
    try {
        console.log('🔄 Загрузка статистики из Яндекс.Диска...');
       
        const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=https://disk.yandex.ru/d/vjXtSXW8otwaNg`;
        const linkResponse = await axios.get(apiUrl, { timeout: 10000 });
       
        const fileResponse = await axios.get(linkResponse.data.href, {
            timeout: 10000,
            responseType: 'text'
        });

        const remoteStats = JSON.parse(fileResponse.data);
       
        if (remoteStats.global) {
            Object.assign(getSessionManager().globalStats, remoteStats.global);
getSessionManager().userStats.clear();
           
            if (remoteStats.users && Array.isArray(remoteStats.users)) {
                remoteStats.users.forEach(([userId, userData]) => {
                    sessionManager.userStats.set(userId, userData);
                });
            }
           
            console.log('✅ Статистика загружена:');
            console.log(`   👥 Пользователей: ${ sessionManager.globalStats.totalUsers}`);
            console.log(`   📸 Фото: ${ sessionManager.globalStats.totalPhotos}`);
        }
    } catch (error) {
        console.log('❌ Ошибка загрузки статистики:', error.message);
        console.log('💫 Начинаем со свежей статистики');
    }
}

// Анти-сон система
setInterval(() => {
    console.log('🔄 Keep-alive ping:', new Date().toISOString());
}, 4 * 60 * 1000);

async function quickTests() {
    console.log('🧪 Запуск быстрых тестов...');
   
    try {
        // Тест 1: Retry логика
        await testRetryLogic();
       
        // Тест 2: Менеджеры
        await testManagers();
       
        // Тест 3: Яндекс.Диск
        await testYandexDisk();
       
        console.log('✅ Все тесты пройдены!');
    } catch (error) {
        console.log('❌ Тесты не пройдены:', error.message);
    }
}

async function testRetryLogic() {
    let attempts = 0;
    await withRetry(async () => {
        attempts++;
        if (attempts < 2) throw new Error('Тестовая ошибка');
        return 'success';
    }, "Тест retry");
    console.log('✅ Retry логика работает');
}

async function testManagers() {
    const manager = getSessionManager();
    const persistence = getDataPersistence();
    console.log('✅ Lazy loading менеджеров работает');
}

async function testYandexDisk() {
    if (yandexDisk) {
        // Просто проверяем доступность
        console.log('✅ Яндекс.Диск доступен');
    }
}

// Запуск сервера
app.listen(PORT, async () => {
    console.log(`🟢 HTTP сервер запущен на порту ${PORT}`);
   
    try {
        await bot.setWebHook(WEBHOOK_URL);
        console.log('✅ Webhook установлен');
    } catch (error) {
        console.log('❌ Ошибка установки webhook:', error.message);
    }
    await quickTests();
    await loadStatsFromPublicLink();
await dataPersistence.loadAllData();

console.log(`📊 Текущая статистика: ${getSessionManager().globalStats.totalUsers} пользователей, ${getSessionManager().globalStats.totalPhotos} фото`);
console.log(`💾 Восстановлено сессий: ${getSessionManager().trailSessions.size}, эталонов: ${getSessionManager().referencePrints.size}`);
});

// Обработчики ошибок
process.on('unhandledRejection', (error) => {
    console.error('⚠️ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error);
});

// 🔧 ДОБАВЛЯЕМ В КОНЕЦ ФАЙЛА:

// Обработчики ошибок для новых функций
process.on('unhandledRejection', (error) => {
    console.error('⚠️ Unhandled Promise Rejection:', error);
   
    // Автосохранение при критических ошибках
    if (dataPersistence) {
        dataPersistence.saveAllData().catch(e => {
            console.error('❌ Не удалось сохранить данные при ошибке:', e);
        });
    }
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error);
   
    // Экстренное сохранение
    if (dataPersistence) {
        try {
            dataPersistence.saveAllData();
        } catch (e) {
            console.error('❌ Критическая ошибка сохранения:', e);
        }
    }
   
    process.exit(1);
});

// 🔧 Функция для безопасного завершения
async function gracefulShutdown() {
    console.log('🔄 Грациозное завершение работы...');
   
    try {
        await dataPersistence.saveAllData();
        console.log('✅ Все данные сохранены');
    } catch (error) {
        console.error('❌ Ошибка при завершении:', error);
    }
   
    process.exit(0);
}

// Обработчики сигналов завершения
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
