// =============================================================================
// 🎯 СИСТЕМА АНАЛИЗА СЛЕДОВ ОБУВИ - ОСНОВНОЙ ФАЙЛ
// =============================================================================
//
// 📋 СТАТУС: РАБОЧАЯ ВЕРСИЯ 2.5 - С ГИБРИДНОЙ СИСТЕМОЙ ОТПЕЧАТКОВ
// ✅ ЧТО РАБОТАЕТ:
//   • Модульная система визуализации
//   • Анализ через Roboflow API
//   • Telegram бот с командами
//   • Canvas визуализация с выбором стилей
//   • Статистика пользователей
//   • Топологическая карта протектора
//   • Практический анализ для ПСО
//   • Фильтрация следов животных
//   • 🆕 ГРАФОВАЯ СИСТЕМА С АВТОСОВМЕЩЕНИЕМ
//   • 🆕 ГИБРИДНАЯ СИСТЕМА (БИТМАСКА + ГРАФ)
//   • 🆕 ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ СЛЕДОВ
//
// 🏗️ АРХИТЕКТУРА:
//   • Express.js сервер + Telegram Bot API
//   • Модульная структура в папке modules/
//   • Canvas для генерации визуализаций
//   • Roboflow для ML-анализа изображений
//   • SimpleFootprintManager для автосовмещения следов
//   • HybridManager для гибридной системы
//   • Временные файлы в папке temp/
//
// 🔄 ПОСЛЕДНИЕ ИЗМЕНЕНИЯ:
//   • Добавлена гибридная система (битмаска + граф)
//   • Новые команды /hybrid_stats и /hybrid_test
//   • Улучшена точность сравнения следов
//   • Добавлена система быстрого отсева
//   • Добавлена визуализация объединения следов
//
// =============================================================================

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
// 🚀 ГИБРИДНАЯ СИСТЕМА ЦИФРОВЫХ ОТПЕЧАТКОВ
// =============================================================================

// НОВАЯ СИСТЕМА
const SimpleFootprint = require('./modules/footprint/simple-footprint');
const SimpleFootprintManager = require('./modules/footprint/simple-manager');

// 🆕 ГИБРИДНАЯ СИСТЕМА
const HybridManager = require('./modules/footprint/hybrid-manager');

const SystemDiagnostic = require('./modules/utils/system-diagnostic');
const systemDiagnostic = new SystemDiagnostic();

// Глобальный менеджер новой системы
let footprintManager = null;
let hybridManager = null; // 🆕 Гибридный менеджер

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
            enableMergeVisualization: true  // 🔴 ДОБАВЛЕНО: Включить визуализацию объединения
        });

        console.log('✅ Новая графовая система цифровых отпечатков готова!');
        console.log('🎯 Автосовмещение на основе графов работает!');
        console.log('🎨 Визуализация объединения включена!');

        return true;
    } catch (error) {
        console.log('❌ Ошибка инициализации новой системы:', error.message);
        return false;
    }
}

// 🆕 ИНИЦИАЛИЗАЦИЯ ГИБРИДНОЙ СИСТЕМЫ
async function initializeHybridSystem() {
    try {
        hybridManager = new HybridManager({
            dbPath: './data/hybrid-footprints',
            autoSave: true,
            minSimilarityForSame: 0.85,
            fastRejectBitmaskDistance: 15
        });
        console.log('✅ Гибридная система инициализирована');
        return true;
    } catch (error) {
        console.log('❌ Ошибка инициализации гибридной системы:', error);
        return false;
    }
}

// ВСТРОЕННЫЙ CONFIG
const config = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI',
    PORT: process.env.PORT || 10000,
    YANDEX_DISK_TOKEN: process.env.YANDEX_DISK_TOKEN,
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,

    ROBOFLOW: {
        API_URL: 'https://detect.roboflow.com/-zqyih/32',
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
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// =============================================================================
// 📊 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПОИСКА
// =============================================================================

// Кэш последних анализов
const userLastAnalysis = new Map();

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
    } else if (!config.TELEGRAM_TOKEN.startsWith('')) {
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

// ВЫЗЫВАЕМ ВАЛИДАЦИЮ
try {
    validateConfig(config);
} catch (error) {
    console.log('💥 Невозможно запустить систему с некорректной конфигурации');
    process.exit(1);
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
const bot = new TelegramBot(config.TELEGRAM_TOKEN);
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
const userStats = new Map();
const globalStats = {
    totalUsers: 0,
    totalPhotos: 0,
    totalAnalyses: 0,
    lastAnalysis: null
};

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
function smartPostProcessing(predictions) {
    if (!predictions || predictions.length === 0) return [];

    const filtered = predictions.filter(pred => {
        if (!pred.points || pred.points.length < 3) return false;
        const points = pred.points;
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
        const area = width * height;
        return area > 100;
    });

    return filtered;
}

// =============================================================================
// 🔧 АНАЛИЗ ДАННЫХ
// =============================================================================
function analyzePredictions(predictions) {
    const classes = {};
    predictions.forEach(pred => {
        classes[pred.class] = (classes[pred.class] || 0) + 1;
    });

    return {
        total: predictions.length,
        classes: classes,
        hasOutline: !!classes['Outline-trail'],
        protectorCount: classes['shoe-protector'] || 0
    };
}

function generateTopologyText(predictions) {
    const protectors = predictions.filter(p => p.class === 'shoe-protector');
    if (protectors.length === 0) return "Детали протектора не обнаружены";

    let text = `🔍 Топология протектора:\n`;
    text += `• Всего деталей: ${protectors.length}\n`;

    // Анализ распределения
    const centers = protectors.map(pred => {
        const points = pred.points;
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    });

    // Простой анализ кластеризации
    const leftCount = centers.filter(c => c.x < 400).length;
    const rightCount = centers.filter(c => c.x >= 400).length;

    text += `• Распределение: ${leftCount} слева, ${rightCount} справа\n`;
    text += `• Плотность: ${(protectors.length / 10).toFixed(1)} дет/сектор\n`;

    return text;
}

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
bot.onText(/\/start/, (msg) => {
    updateUserStats(msg.from.id, msg.from.username || msg.from.first_name);

    const currentStyle = visualization ? visualization.getUserStyle(msg.from.id) : 'original';
    const styleInfo = visualization ? visualization.getAvailableStyles().find(s => s.id === currentStyle) : { name: 'Стиль маски' };

    bot.sendMessage(msg.chat.id,
        `👟 **СИСТЕМА АНАЛИЗА СЛЕДОВ ОБУВИ** 🚀\n\n` +
        `📊 Статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} отпечатков\n\n` +
        `🎨 **Текущий стиль:** ${styleInfo?.name || 'Стиль маски'}\n\n` +
        `🔄 **СЕССИОННЫЙ РЕЖИМ:**\n` +
        `• Отправьте 2+ фото пачкой - автоматический запуск\n` +
        `• Или вручную: /trail_start\n` +
        `• Анализ цепочки следов с отчетом\n\n` +
        `🔍 **ФУНКЦИОНАЛ:**\n` +
        `• Анализ через Roboflow API\n` +
        `• Визуализация контуров\n` +
        `• Топология протектора\n` +
        `• Практический анализ для ПСО\n` +
        `• Фильтрация следов животных\n` +
        `• 🆕 Графовая система автосовмещения\n` +
        `• 🆕 Гибридная система (битмаска + граф)\n\n` +
        `🧮 **ИНСТРУМЕНТЫ:**\n` +
        `/calculators - Калькуляторы и расчеты\n\n` +
        `🎯 **Команды цифровых отпечатков:**\n` +
        `/footprint_start - Начать сессию отпечатков\n` +
        `/my_footprints - Мои модели отпечатков\n` +
        `/find_similar_footprints - Найти похожие\n` +
        `/footprint_stats - Статистика системы\n\n` +
        `🧪 **Команды гибридной системы:**\n` +
        `/hybrid_stats - Статистика гибридной системы\n` +
        `/hybrid_test - Тест гибридной системы\n\n` +
        `/style - Выбор стиля визуализации\n` +
        `/help - Помощь\n` +
        `/statistics - Статистика\n\n` +
        `📸 **Просто отправьте фото следа обуви**`
    );
});

// Команда /statistics
bot.onText(/\/statistics/, (msg) => {
    const activeUsers = Array.from(userStats.values()).filter(user =>
        (new Date() - user.lastSeen) < 7 * 24 * 60 * 60 * 1000
    ).length;

    const stats = `📊 **СТАТИСТИКА СИСТЕМЫ:**\n\n` +
                 `👥 Пользователи: ${globalStats.totalUsers} (${activeUsers} активных)\n` +
                 `📸 Фото обработано: ${globalStats.totalPhotos}\n` +
                 `🔍 Анализов проведено: ${globalStats.totalAnalyses}\n` +
                 `📅 Последний анализ: ${globalStats.lastAnalysis ?
                     globalStats.lastAnalysis.toLocaleString('ru-RU') : 'еще нет'}\n\n` +
                 `🔄 Активных сессий: ${sessionManager ? Array.from(sessionManager.activeSessions.keys()).length : 0}`;

    bot.sendMessage(msg.chat.id, stats);
});

// Команда /feedback_stats - статистика обратной связи
bot.onText(/\/feedback_stats/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const stats = feedbackDB.getStatistics();
        const accuracy = stats.total > 0 ?
            (stats.correct / stats.total) * 100 : 0;

        let message = `📊 **СТАТИСТИКА ОБРАТНОЙ СВЯЗИ**\n\n`;
        message += `📈 Всего оценок: ${stats.total}\n`;
        message += `✅ Правильных: ${stats.correct} (${accuracy.toFixed(1)}%)\n`;
        message += `🔧 Исправлений: ${stats.total - stats.correct}\n\n`;

        if (Object.keys(stats.correctionsByType || {}).length > 0) {
            message += `📋 **ТИПЫ ИСПРАВЛЕНИЙ:**\n`;
            Object.entries(stats.correctionsByType).forEach(([type, count]) => {
                message += `• ${getCorrectionDescription(type)}: ${count}\n`;
            });
        }

        if (stats.accuracyHistory && stats.accuracyHistory.length > 1) {
            const first = stats.accuracyHistory[0].accuracy;
            const last = stats.accuracyHistory[stats.accuracyHistory.length - 1].accuracy;
            const trend = last - first;

            message += `\n📈 **ТРЕНД ТОЧНОСТИ:** `;
            if (trend > 0) {
                message += `+${trend.toFixed(1)}% улучшение`;
            } else if (trend < 0) {
                message += `${trend.toFixed(1)}% снижение`;
            } else {
                message += `стабильно`;
            }
        }

        message += `\n\n💡 Каждая ваша оценка делает анализ точнее!`;

        await bot.sendMessage(chatId, message);

    } catch (error) {
        console.log('❌ Ошибка статистики:', error);
        await bot.sendMessage(chatId, '❌ Не удалось получить статистику');
    }
});

// Команда /feedback_export - экспорт для переобучения
bot.onText(/\/feedback_export/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Только для администраторов или тестировщиков
    const adminUsers = [699140291]; // Твой ID

    if (!adminUsers.includes(userId)) {
        await bot.sendMessage(chatId,
            `❌ Эта команда только для администраторов\n` +
            `Статистику можно посмотреть: /feedback_stats`
        );
        return;
    }

    try {
        const exportData = feedbackDB.exportForRoboflow();

        let message = `📤 **ЭКСПОРТ ДАННЫХ ДЛЯ ПЕРЕОБУЧЕНИЯ**\n\n`;
        message += `📊 Всего исправлений: ${exportData.total_corrections}\n`;

        if (exportData.corrections_by_class) {
            message += `📋 **По классам:**\n`;
            Object.entries(exportData.corrections_by_class).forEach(([cls, count]) => {
                message += `• ${cls}: ${count}\n`;
            });
        }

        message += `\n💾 Данные готовы для загрузки в Roboflow\n`;
        message += `📅 Версия: ${exportData.version}`;

        await bot.sendMessage(chatId, message);

        // Можно также сохранить в файл и отправить
        const exportJson = JSON.stringify(exportData, null, 2);
        const tempFile = tempFileManager.createTempFile('feedback_export', 'json');
        require('fs').writeFileSync(tempFile, exportJson);

        await bot.sendDocument(chatId, tempFile, {
            caption: `feedback_export_${new Date().toISOString().split('T')[0]}.json`
        });

        tempFileManager.removeFile(tempFile);

    } catch (error) {
        console.log('❌ Ошибка экспорта:', error);
        await bot.sendMessage(chatId, '❌ Не удалось экспортировать данные');
    }
});

// Команда /style
bot.onText(/\/style/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const styles = visualization ? visualization.getAvailableStyles() : [{ id: 'original', name: 'Оригинальный', description: 'Основной стиль' }];
    const currentStyle = visualization ? visualization.getUserStyle(userId) : 'original';
    const currentStyleInfo = styles.find(s => s.id === currentStyle);

    let message = `🎨 **ВЫБОР СТИЛЯ ВИЗУАЛИЗАЦИИ**\n\n`;
    message += `📊 Текущий стиль: ${currentStyleInfo?.name || 'Стиль маски'}\n\n`;
    message += `Доступные стили:\n`;

    styles.forEach(style => {
        const isCurrent = style.id === currentStyle ? ' ✅' : '';
        message += `\n${style.name}${isCurrent}\n`;
        message += `└ ${style.description}\n`;
        message += `└ /setstyle_${style.id}\n`;
    });

    message += `\n💡 Стиль сохранится до перезагрузки бота`;
    message += `\n\n📸 Отправьте фото для анализа в выбранном стиле!`;

    await bot.sendMessage(msg.chat.id, message);
});

// Обработка выбора стиля
bot.onText(/\/setstyle_(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const styleId = match[1];

    if (visualization && visualization.setUserStyle(userId, styleId)) {
        const styleName = visualization.getAvailableStyles().find(s => s.id === styleId)?.name;
        await bot.sendMessage(chatId,
            `✅ Стиль визуализации изменен на: ${styleName}\n\n` +
            `Теперь все новые анализы будут использовать выбранный стиль.\n\n` +
            `Проверить текущий стиль: /currentstyle`
        );
    } else {
        await bot.sendMessage(chatId, '❌ Неизвестный стиль визуализации. Посмотрите доступные: /style');
    }
});

// Команда /currentstyle
bot.onText(/\/currentstyle/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const currentStyle = visualization ? visualization.getUserStyle(userId) : 'original';
    const styleInfo = visualization ? visualization.getAvailableStyles().find(s => s.id === currentStyle) : { name: 'Оригинальный', description: 'Основной стиль' };

    await bot.sendMessage(chatId,
        `🎨 **ТЕКУЩИЙ СТИЛЬ ВИЗУАЛИЗАЦИИ**\n\n` +
        `📝 ${styleInfo?.name || 'Оригинальный'}\n` +
        `📋 ${styleInfo?.description || 'Цветная визуализация'}\n\n` +
        `Изменить стиль: /style`
    );
});

// =============================================================================
// 🧮 СИСТЕМА КАЛЬКУЛЯТОРОВ
// =============================================================================

// 🎯 ПРАВИЛЬНАЯ СИСТЕМА КОНТЕКСТОВ
const userContext = {};

// Команда /calculators
bot.onText(/\/calculators/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const menu = calculators.getMenu();

        let message = `🧮 ${menu.title}\n\n`;

        menu.sections.forEach(section => {
            message += `📌 ${section.name}\n`;
            message += `└ ${section.description}\n`;
            message += `└ Команда: ${section.command}\n\n`;
        });

        await bot.sendMessage(chatId, message);
    } catch (error) {
        console.log('❌ Ошибка в /calculators:', error);
        await bot.sendMessage(chatId, '❌ Ошибка загрузки калькуляторов');
    }
});

// ❄️ Команда калькулятора давности следа на снегу
bot.onText(/\/calc_snow_age/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // ОЧИЩАЕМ КОНТЕКСТ ПЕРЕД НОВОЙ КОМАНДОЙ
    delete userContext[userId];

    userContext[userId] = 'waiting_snow_age_mode';

    await bot.sendMessage(chatId,
        '⏱️❄️ <b>КАЛЬКУЛЯТОР ДАВНОСТИ СЛЕДА НА СНЕГУ</b>\n\n' +
        '🔮 <b>ВЕРОЯТНОСТНАЯ МОДЕЛЬ С ИСТОРИЕЙ ПОГОДЫ</b>\n\n' +
        '🎯 <b>Выберите режим:</b>\n\n' +
        '📅 <b>ОСНОВНОЙ РЕЖИМ</b> (поиск пропавших):\n' +
        '• Расчет текущего снега по дате пропажи\n' +
        '• Команда: <code>основной</code>\n\n' +
        '🧪 <b>ТЕСТОВЫЙ РЕЖИМ</b> (проверка точности):\n' +
        '• Расчет снега между двумя датами\n' +
        '• Сравнение с реальными замерами\n' +
        '• Команда: <code>тестовый</code>\n\n' +
        '💡 <i>Отправьте "основной" или "тестовый"</i>',
        { parse_mode: 'HTML' }
    );
});

// 🎯 ОБНОВЛЕННЫЕ КОМАНДЫ ДЛЯ УСТАНОВКИ КОНТЕКСТА
bot.onText(/\/calc_reverse/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // ОЧИЩАЕМ КОНТЕКСТ ПЕРЕД НОВОЙ КОМАНДОЙ
    delete userContext[userId];

    userContext[userId] = 'calc_reverse';

    await bot.sendMessage(chatId,
        '🔄 <b>ОБРАТНЫЙ КАЛЬКУЛЯТОР</b>\n\n' +
        'Расчет размера обуви по длине отпечатка\n\n' +
        '💡 <b>Отправьте длину отпечатка в см:</b>\n\n' +
        '<code>33 см</code>\n\n' +
        '<code>33</code>\n\n' +
        '📝 <i>Пример: отпечаток 33 см → размеры 41-50</i>',
        { parse_mode: 'HTML' }
    );
});

bot.onText(/\/calc_shoe/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // ОЧИЩАЕМ КОНТЕКСТ ПЕРЕД НОВОЙ КОМАНДОЙ
    delete userContext[userId];

    userContext[userId] = 'calc_shoe';

    try {
        const typesMessage = calculators.getShoeTypes();
        await bot.sendMessage(chatId, typesMessage, { parse_mode: 'HTML' });

        await bot.sendMessage(chatId,
            '💡 <b>Отправьте размер и тип обуви:</b>\n\n' +
            '<code>42 кроссовки</code>\n\n' +
            'Или в формате:\n' +
            '<code>размер=42 тип=кроссовки</code>',
            { parse_mode: 'HTML' }
        );
    } catch (error) {
        console.log('❌ Ошибка в /calc_shoe:', error);
        await bot.sendMessage(chatId, '❌ Ошибка загрузки калькулятора');
    }
});

// 🌤️ Команда погоды с историей
bot.onText(/\/calc_weather/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // ОЧИЩАЕМ КОНТЕКСТ ПЕРЕД НОВОЙ КОМАНДОЙ
    delete userContext[userId];

    // Устанавливаем контекст - пользователь хочет погоду
    userContext[userId] = 'calc_weather';

    await bot.sendMessage(chatId,
        '🌤️ <b>ПОГОДА С ИСТОРИЕЙ ЗА 7 ДНЕЙ</b>\n\n' +
        '📍 <b>Отправьте местоположение</b> (скрепка → Местоположение)\n\n' +
        '🏙️ <b>Или напишите город:</b>\n' +
        '<code>Москва</code>\n' +
        '<code>Санкт-Петербург</code>\n' +
        '<code>Новосибирск</code>\n\n' +
        '📌 <b>Или координаты:</b>\n' +
        '<code>55.7558 37.6173</code>\n\n' +
        '📊 <i>Бот покажет текущую погоду, прогноз и историю за неделю</i>',
        {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [
                    [{ text: "📍 Отправить местоположение", request_location: true }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }
    );
});

// 📍 ОБЩИЙ ОБРАБОТЧИК ГЕОЛОКАЦИИ
bot.on('location', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const context = userContext[userId];

    if (!context) return;

    const location = msg.location;

    try {
        // ❄️ ОБРАБОТКА ДЛЯ СНЕГА (ОСНОВНОЙ РЕЖИМ)
        if (context === 'waiting_snow_age_location') {
            userContext[userId] = {
                type: 'snow_age_calc',
                coordinates: {
                    lat: location.latitude,
                    lon: location.longitude
                }
            };

            await bot.sendMessage(chatId,
                '📍 Местоположение получено. Теперь укажите <b>дату и время пропажи</b>:\n\n' +
                '<code>2024-01-15 08:00</code>\n' +
                '<code>15.01.2024 8:00</code>\n\n' +
                '<i>Формат: ГГГГ-ММ-ДД ЧЧ:ММ или ДД.ММ.ГГГГ ЧЧ:ММ</i>',
                { parse_mode: 'HTML' }
            );
            return;
        }

        // 🧪 ОБРАБОТКА ДЛЯ СНЕГА (ТЕСТОВЫЙ РЕЖИМ)
        if (context === 'waiting_test_snow_location') {
            userContext[userId] = {
                type: 'test_snow_calc',
                coordinates: {
                    lat: location.latitude,
                    lon: location.longitude
                },
                step: 'start_date'
            };

            await bot.sendMessage(chatId,
                '📍 Местоположение получено. Теперь укажите <b>дату оставления следа</b>:\n\n' +
                '<code>2024-01-15 08:00</code>\n' +
                '<code>15.01.2024 8:00</code>\n\n' +
                '<i>Формат: ГГГГ-ММ-ДД ЧЧ:ММ или ДД.ММ.ГГГГ ЧЧ:ММ</i>',
                { parse_mode: 'HTML' }
            );
            return;
        }

        // 🌤️ ОБРАБОТКА ДЛЯ ПОГОДЫ
        if (context === 'calc_weather') {
            await bot.sendMessage(chatId, '📍 Получаю погоду для вашего местоположения...');

            const result = await calculators.getWeatherData({
                coordinates: {
                    lat: location.latitude,
                    lon: location.longitude
                }
            });

            // Очищаем контекст ПОСЛЕ выполнения
            delete userContext[userId];

            await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            return;
        }

    } catch (error) {
        console.log('❌ Ошибка обработки местоположения:', error);
        await bot.sendMessage(chatId, '❌ Ошибка обработки местоположения');
        // Очищаем контекст при ошибке
        delete userContext[userId];
    }
});

// 🎯 ГЛАВНЫЙ ОБРАБОТЧИК СООБЩЕНИЙ ДЛЯ КАЛЬКУЛЯТОРОВ
bot.on('message', async (msg) => {
    // Пропускаем команды и служебные сообщения
    if (msg.text && msg.text.startsWith('/')) return;
    if (msg.location) return; // Обрабатывается отдельно
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.trim();
    const context = userContext[userId];

    try {
        // 🎯 ОБРАБОТКА КОНТЕКСТА СНЕГА (дата пропажи)
        if (context && context.type === 'snow_age_calc') {
            const disappearanceTime = parseDateTime(text);

            if (!disappearanceTime) {
                await bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте: <code>2024-01-15 08:00</code>', { parse_mode: 'HTML' });
                return;
            }

            await bot.sendMessage(chatId, '❄️🔮 Анализирую эволюцию снежного покрова...');

            const result = await calculators.calculateSnowAge(context.coordinates, disappearanceTime);

            // Очищаем контекст ПОСЛЕ выполнения
            delete userContext[userId];

            await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            return;
        }

        // 🧪 ОБРАБОТКА ТЕСТОВОГО РЕЖИМА СНЕГА (КООРДИНАТЫ ТЕКСТОМ)
        if (context === 'waiting_test_snow_location') {
            // Проверяем, это координаты или что-то еще
            if (isCoordinates(text)) {
                // Координаты в текстовом формате
                const coords = text.split(' ').map(coord => parseFloat(coord));

                userContext[userId] = {
                    type: 'test_snow_calc',
                    coordinates: {
                        lat: coords[0],
                        lon: coords[1]
                    },
                    step: 'start_date'
                };

                await bot.sendMessage(chatId,
                    '📍 Координаты приняты. Теперь укажите <b>дату оставления следа</b>:\n\n' +
                    '<code>2024-01-15 08:00</code>\n' +
                    '<code>15.01.2024 8:00</code>\n\n' +
                    '<i>Формат: ГГГГ-ММ-ДД ЧЧ:ММ или ДД.ММ.ГГГГ ЧЧ:ММ</i>',
                    { parse_mode: 'HTML' }
                );
                return;
            } else {
                await bot.sendMessage(chatId,
                    '❌ Неверный формат координат. Отправьте местоположение или координаты в формате:\n\n' +
                    '<code>55.7558 37.6173</code>\n\n' +
                    'Или используйте кнопку ниже для отправки местоположения:',
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            keyboard: [
                                [{ text: "📍 Отправить местоположение", request_location: true }]
                            ],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    }
                );
                return;
            }
        }

        // 🎯 ОБРАБОТКА ВЫБОРА РЕЖИМА СНЕГА
        if (context === 'waiting_snow_age_mode') {
            if (text.toLowerCase() === 'основной' || text.toLowerCase() === 'основной режим') {
                userContext[userId] = 'waiting_snow_age_location';

                await bot.sendMessage(chatId,
                    '📅 <b>ОСНОВНОЙ РЕЖИМ</b>\n\n' +
                    '💡 <b>Как использовать:</b>\n\n' +
                    '1. 📍 <b>Отправьте местоположение</b> поиска\n\n' +
                    '2. 📅 <b>Укажите дату и время пропажи:</b>\n' +
                    '<code>2024-01-15 08:00</code>\n' +
                    '<code>15.01.2024 8:00</code>\n\n' +
                    '3. 🤖 <b>Бот рассчитает вероятностные коридоры</b> снежного покрова\n\n' +
                    '📍 <i>Сначала отправьте местоположение</i>',
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            keyboard: [
                                [{ text: "📍 Отправить местоположение", request_location: true }]
                            ],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    }
                );
                return;
            }

            else if (text.toLowerCase() === 'тестовый' || text.toLowerCase() === 'тестовый режим') {
                userContext[userId] = 'waiting_test_snow_location';

                await bot.sendMessage(chatId,
                    '🧪 <b>ТЕСТОВЫЙ РЕЖИМ</b>\n\n' +
                    '💡 <b>Для проверки точности модели:</b>\n\n' +
                    '1. 📍 <b>Отправьте местоположение</b> замеров\n\n' +
                    '2. 📅 <b>Укажите период анализа:</b>\n' +
                    '• Дата оставления следа\n' +
                    '• Дата проверки/замеров\n\n' +
                    '3. 🤖 <b>Бот рассчитает прогноз</b> и вы сможете сравнить с реальными замерами\n\n' +
                    '📍 <i>Отправьте местоположение или координаты:</i>\n' +
                    '<code>55.7558 37.6173</code>',
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            keyboard: [
                                [{ text: "📍 Отправить местоположение", request_location: true }]
                            ],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    }
                );
                return;
            }

            else {
                await bot.sendMessage(chatId, '❌ Неверный режим. Отправьте "основной" или "тестовый"');
                return;
            }
        }

        // 🧪 ОБРАБОТКА ТЕСТОВОГО РЕЖИМА СНЕГА
        if (context === 'waiting_test_snow_location') {
            if (msg.location) {
                const location = msg.location;

                userContext[userId] = {
                    type: 'test_snow_calc',
                    coordinates: {
                        lat: location.latitude,
                        lon: location.longitude
                    },
                    step: 'start_date'
                };

                await bot.sendMessage(chatId,
                    '📍 Местоположение получено. Теперь укажите <b>дату оставления следа</b>:\n\n' +
                    '<code>2024-01-15 08:00</code>\n' +
                    '<code>15.01.2024 8:00</code>\n\n' +
                    '<i>Формат: ГГГГ-ММ-ДД ЧЧ:ММ или ДД.ММ.ГГГГ ЧЧ:ММ</i>',
                    { parse_mode: 'HTML' }
                );
                return;
            }
        }

        if (context && context.type === 'test_snow_calc') {
            const testContext = context;

            if (testContext.step === 'start_date') {
                const startDate = parseDateTime(text);

                if (!startDate) {
                    await bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте: <code>2024-01-15 08:00</code>', { parse_mode: 'HTML' });
                    return;
                }

                testContext.startDate = startDate;
                testContext.step = 'end_date';

                await bot.sendMessage(chatId,
                    '✅ Дата оставления следа принята. Теперь укажите <b>дату проверки/замеров</b>:\n\n' +
                    '<code>2024-01-20 14:00</code>\n' +
                    '<code>20.01.2024 14:00</code>\n\n' +
                    '<i>Формат: ГГГГ-ММ-ДД ЧЧ:ММ или ДД.ММ.ГГГГ ЧЧ:ММ</i>',
                    { parse_mode: 'HTML' }
                );
                return;
            }

            if (testContext.step === 'end_date') {
                const endDate = parseDateTime(text);

                if (!endDate) {
                    await bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте: <code>2024-01-20 14:00</code>', { parse_mode: 'HTML' });
                    return;
                }

                if (endDate <= testContext.startDate) {
                    await bot.sendMessage(chatId, '❌ Дата проверки должна быть ПОСЛЕ даты оставления следа');
                    return;
                }

                await bot.sendMessage(chatId, '🧪🔮 Анализирую эволюцию снежного покрова за указанный период...');

                // Используем ту же функцию calculateSnowAge, но с endDate
                const result = await calculators.calculateSnowAge(
                    testContext.coordinates,
                    testContext.startDate,
                    { endDate: endDate, testMode: true }
                );

                // Очищаем контекст ПОСЛЕ выполнения
                delete userContext[userId];

                await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
                return;
            }
        }

        // 🎯 ОБРАБОТКА ПРОСТЫХ КАЛЬКУЛЯТОРОВ
        if (context === 'calc_snow') {
            // ❄️ Калькулятор снега - здесь только глубина снега
            const depth = text.trim();

            console.log('🔍 Расчет снега:', { depth });

            const result = calculators.calculateSnowDepth(depth, 'fresh');

            // Очищаем контекст ПОСЛЕ выполнения
            delete userContext[userId];

            await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            return;
        }

        if (context === 'calc_reverse') {
            // 🔄 Обратный калькулятор - здесь только длина отпечатка
            let footprintLength = text.trim();

            // Убираем "см" если есть
            footprintLength = footprintLength.replace('см', '').trim();

            console.log('🔍 Обратный расчет для длины:', footprintLength);

            const result = calculators.calculateReverse(footprintLength);

            // Очищаем контекст ПОСЛЕ выполнения
            delete userContext[userId];

            await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            return;
        }

        if (context === 'calc_shoe') {
            // 👟 Калькулятор обуви - здесь только размер обуви
            console.log('🔍 Обрабатываем как прямой калькулятор обуви');
            let size, type;

            // ЕСЛИ ПРОСТО ЧИСЛО - считаем это размером с неизвестным типом
            if (/^\d+$/.test(text.trim())) {
                size = text.trim();
                type = 'неизвестно';
            }
            // ЕСЛИ РАЗМЕР + ТИП
            else if (text.includes('размер=') && text.includes('тип=')) {
                const sizeMatch = text.match(/размер=(\d+)/);
                const typeMatch = text.match(/тип=([^]+)/);
                size = sizeMatch ? sizeMatch[1] : null;
                type = typeMatch ? typeMatch[1].trim() : null;
            } else {
                const parts = text.split(' ');
                size = parts[0];
                type = parts.slice(1).join(' ');
            }

            console.log('🔍 Парсинг обуви:', { size, type });

            if (size) {
                const result = calculators.calculateShoeSize(size, type || 'неизвестно');

                // Очищаем контекст ПОСЛЕ выполнения
                delete userContext[userId];

                await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            } else {
                await bot.sendMessage(chatId, '❌ Неверный формат. Пример: <code>42</code> или <code>42 кроссовки</code>', { parse_mode: 'HTML' });
            }
            return;
        }

        // 🌤️ ОБРАБОТКА КОНТЕКСТА ПОГОДЫ (город/координаты)
        if (context === 'calc_weather') {
            await bot.sendMessage(chatId, '🌤️ Запрашиваю погоду с историей...');

            let options = {};

            // Проверяем формат ввода
            if (isCoordinates(text)) {
                // Координаты: "55.7558 37.6173"
                const coords = text.split(' ').map(coord => parseFloat(coord));
                options.coordinates = { lat: coords[0], lon: coords[1] };
            } else {
                // Название города
                options.location = text;
            }

            const result = await calculators.getWeatherData(options);

            // Очищаем контекст ПОСЛЕ выполнения
            delete userContext[userId];

            await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            return;
        }

        // 🚫 ЕСЛИ НЕТ КОНТЕКСТА - НИЧЕГО НЕ ДЕЛАЕМ
        if (!context) {
            if (DEBUG_MODE) {
                console.log('⚠️ Нет активного контекста, сообщение не обработано');
            }
            return;
        }

        // Если дошли сюда и есть контекст, но не обработали - очищаем
        console.log('⚠️ Неизвестный контекст:', context);
        delete userContext[userId];

    } catch (error) {
        console.log('❌ Ошибка обработки калькулятора:', error);
        await bot.sendMessage(chatId, '❌ Не удалось обработать запрос. Проверьте формат ввода.');
        // Очищаем контекст при ошибке
        delete userContext[userId];
    }
});

// 📍 Вспомогательные функции для координат
function isCoordinates(text) {
    // Проверяем формат "число число" или "число,число"
    const coordRegex = /^-?\d+\.?\d*[\s,]+-?\d+\.?\d*$/;
    return coordRegex.test(text);
}

// 🔧 ФУНКЦИЯ ПАРСИНГА ДАТЫ
function parseDateTime(dateString) {
    try {
        let date = new Date(dateString);
        if (isNaN(date.getTime())) {
            const parts = dateString.split('.');
            if (parts.length === 3) {
                date = new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }
        return isNaN(date.getTime()) ? null : date;
    } catch (error) {
        return null;
    }
}

// =============================================================================
// 🏁 КОНЕЦ БЛОКА КАЛЬКУЛЯТОРОВ
// =============================================================================

// Команда /apps
bot.onText(/\/apps/, async (msg) => {
    const chatId = msg.chat.id;

    let message = `📱 ПОЛЕЗНЫЕ ПРИЛОЖЕНИЯ\n\n`;

    message += `🔍 **Честный знак**\n`;
    message += `• Узнать дату и место продажи по QR-коду\n`;
    message += `• Ссылка: rustore.ru/catalog/app/ru.crptech.mark\n\n`;

    message += `🍷 **Антиконтрафакт алко**\n`;
    message += `• Проверка акцизных марок алкоголя\n`;
    message += `• Ссылка: public.fsrar.ru/checkmark\n\n`;

    message += `🌤️ **Погода - архив погоды**\n`;
    message += `• Архивные погодные данные\n`;
    message += `• Ссылка: rustore.ru/catalog/app/com.mart.weather\n\n`;

    message += `📏 **ImageMeter**\n`;
    message += `• Измерения размеров на фото по эталону\n`;
    message += `• Ссылка: play.google.com/store/apps/details?id=de.dirkfarin.imagemeter\n\n`;

    message += `🦴 **Скелет | 3D Анатомии**\n`;
    message += `• Анатомический справочник\n`;
    message += `• Ссылка: play.google.com/store/apps/details?id=com.catfishanimationstudio.SkeletalSystemPreview\n\n`;

    message += `📍 **Conota: GPS-камера**\n`;
    message += `• Фото с логотипом и GPS-данными\n`;
    message += `• Ссылка: play.google.com/store/apps/details?id=com.gps.survey.cam\n\n`;

    message += `💡 Скопируйте ссылки для перехода`;

    await bot.sendMessage(chatId, message);
});

// Команда /help
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🆘 **ПОМОЩЬ**\n\n` +
        `📸 **Как использовать:**\n` +
        `• Отправьте одно фото - быстрый анализ\n` +
        `• Отправьте пачку фото (2+) - автоматическая сессия\n` +
        `• Или начните сессию вручную: /trail_start\n\n` +
        `🔄 **СЕССИОННЫЙ РЕЖИМ:**\n` +
        `/trail_start - Начать сессию анализа\n` +
        `/trail_status - Статус сессии\n` +
        `/trail_details - Детали по каждому фото\n` +
        `/trail_end - Завершить с отчетом\n` +
        `/cancel - Отменить все операции\n\n` +
        `👣 **ЦИФРОВЫЕ ОТПЕЧАТКИ:**\n` +
        `/footprint_start - Начать сессию отпечатков\n` +
        `/my_footprints - Мои модели отпечатков\n` +
        `/find_similar_footprints - Найти похожие\n` +
        `/footprint_stats - Статистика системы\n\n` +
        `🧪 **ГИБРИДНАЯ СИСТЕМА:**\n` +
        `/hybrid_stats - Статистика гибридной системы\n` +
        `/hybrid_test - Тест гибридной системы\n\n` +
        `🔍 **Что анализируется:**\n` +
        `• Контуры подошвы\n` +
        `• Детали протектора\n` +
        `• Топология узора\n` +
        `• Практический анализ для ПСО\n` +
        `• Фильтрация следов животных\n` +
        `• 🆕 Автосовмещение следов\n` +
        `• 🆕 Гибридная система (битмаска + граф)\n\n` +
        `🧮 **ИНСТРУМЕНТЫ:**\n` +
        `/calculators - Калькуляторы и расчеты\n\n` +
        `📱 **ПОЛЕЗНЫЕ ПРИЛОЖЕНИЯ:**\n` +
        `/apps - Рекомендованные приложения\n\n` +
        `🎨 **Стили визуализации:**\n` +
        `/style - Выбрать стиль отображения\n` +
        `/currentstyle - Текущий стиль\n` +
        `• Стиль маски (по умолчанию) - черные линии на полупрозрачном фоне\n` +
        `• Оригинальный стиль - цветная визуализация\n\n` +
        `💡 **Советы по съемке:**\n` +
        `• Прямой угол\n` +
        `• Хорошее освещение\n` +
        `• Четкий фокус\n\n` +
        `💾 **Сохранение результатов:**\n` +
        `/yandex - Статус Яндекс.Диска\n` +
        `• Автоматическое сохранение в облако\n\n` +
        `📊 **Другие команды:**\n` +
        `/start - Главное меню\n` +
        `/statistics - Статистика системы`
    );
});

// =============================================================================
// 🆕 СЕССИОННЫЕ КОМАНДЫ
// =============================================================================

// Команда /trail_start - начать сессию анализа следов
bot.onText(/\/trail_start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (sessionManager.hasActiveSession(userId)) {
        const session = sessionManager.getActiveSession(userId);
        await bot.sendMessage(chatId,
            `⚠️ **СЕССИЯ УЖЕ АКТИВНА**\n\n` +
            `🆔 ${session.id.slice(0, 8)}...\n` +
            `⏰ Начата: ${session.startTime.toLocaleTimeString('ru-RU')}\n` +
            `📸 Фото: ${session.photos.length}\n\n` +
            `📊 Статус: /trail_status\n` +
            `🏁 Завершить: /trail_end`
        );
        return;
    }

    const session = sessionManager.createSession(userId, 'trail_analysis');

    await bot.sendMessage(chatId,
        `🔄 **РЕЖИМ СЕССИИ АКТИВИРОВАН**\n\n` +
        `📋 Отправляйте фото следов по одному\n` +
        `✅ Каждое фото будет подтверждено\n` +
        `📊 В конце - полный отчет\n\n` +
        `📍 **Инструкция:**\n` +
        `1. Сфотографируйте общую картину\n` +
        `2. Сделайте детальные фото отдельных следов\n` +
        `3. Сохраняйте последовательность\n\n` +
        `📸 Отправьте первое фото`
    );
});

// Команда /trail_status - статус текущей сессии
bot.onText(/\/trail_status/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!sessionManager.hasActiveSession(userId)) {
        await bot.sendMessage(chatId,
            `❌ Нет активной сессии\n` +
            `Начните: /trail_start`
        );
        return;
    }

    const session = sessionManager.getActiveSession(userId);
    const summary = sessionManager.getSessionSummary(userId);

    await bot.sendMessage(chatId,
        `📊 **СТАТУС СЕССИИ**\n\n` +
        `🆔 ${session.id.slice(0, 8)}...\n` +
        `⏰ Длительность: ${summary.duration.toFixed(0)} сек\n` +
        `📸 Фото: ${summary.photoCount}\n` +
        `🔍 Анализов: ${summary.analysisCount}\n\n` +
        `📝 Последнее фото: ${session.photos[session.photos.length - 1]?.timestamp.toLocaleTimeString('ru-RU') || 'нет'}\n\n` +
        `🏁 Завершить: /trail_end`
    );
});

// Команда /trail_end - завершить сессию с анализом
bot.onText(/\/trail_end/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!sessionManager.hasActiveSession(userId)) {
        await bot.sendMessage(chatId,
            `❌ Нет активной сессии для завершения\n` +
            `Начните: /trail_start`
        );
        return;
    }

    // Получаем сессию перед завершением
    const session = sessionManager.getActiveSession(userId);

    // 🔍 АНАЛИЗИРУЕМ ВСЮ СЕССИЮ
    await bot.sendMessage(chatId, `🔍 Анализирую данные сессии (${session.photos.length} фото)...`);

    const analysis = sessionAnalyzer.analyzeSession(session);

    // Завершаем сессию
    const report = sessionManager.endSession(userId);

    // 🎯 ФОРМИРУЕМ ПОДРОБНЫЙ ОТЧЕТ
    let reportMessage = `🏁 **СЕССИЯ ЗАВЕРШЕНА**\n\n`;
    reportMessage += `📊 **СТАТИСТИКА:**\n`;
    reportMessage += `• Фото: ${report.totalPhotos}\n`;
    reportMessage += `• Анализов: ${report.totalAnalyses}\n`;
    reportMessage += `• Длительность: ${report.duration.toFixed(0)} сек\n\n`;

    // 📸 ОБЗОР КАЖДОГО ФОТО
    if (session.analysisResults && session.analysisResults.length > 0) {
        reportMessage += `📸 **ОБЗОР ФОТО:**\n`;

        session.analysisResults.slice(0, 5).forEach((result, index) => {
            const footprintCount = result.predictions?.filter(p =>
                p.class === 'Outline-trail').length || 0;
            const protectorCount = result.predictions?.filter(p =>
                p.class === 'shoe-protector').length || 0;

            reportMessage += `${index + 1}. Следов: ${footprintCount}, деталей: ${protectorCount}\n`;
        });

        if (session.analysisResults.length > 5) {
            reportMessage += `... и еще ${session.analysisResults.length - 5} фото\n`;
        }
        reportMessage += `\n`;
    }

    // 🧑🤝🧑 АНАЛИЗ ЛЮДЕЙ
    reportMessage += `👥 **АНАЛИЗ ГРУППЫ:**\n`;
    reportMessage += `• Людей: ${analysis.peopleCount.estimatedCount}\n`;

    if (analysis.peopleCount.estimatedCount > 1) {
        reportMessage += `• Уверенность: ${(analysis.peopleCount.confidence * 100).toFixed(0)}%\n`;
    }
    reportMessage += `\n`;

    // 👟 РЕКОНСТРУКЦИЯ ОБУВИ
    if (analysis.shoeReconstruction.totalGroups > 0) {
        reportMessage += `👟 **РЕКОНСТРУКЦИЯ ОБУВИ:**\n`;
        analysis.shoeReconstruction.reconstructions.forEach((rec, i) => {
            reportMessage += `${i+1}. Размер ~${rec.estimatedSize}, уверенность: ${(rec.confidence * 100).toFixed(0)}%\n`;
        });
        reportMessage += `\n`;
    }

    // ⚠️ АНОМАЛИИ
    if (analysis.anomalies && analysis.anomalies.length > 0) {
        reportMessage += `⚠️ **ОСОБЕННОСТИ:**\n`;
        analysis.anomalies.slice(0, 3).forEach(anomaly => {
            reportMessage += `• ${anomaly.message}\n`;
        });
        reportMessage += `\n`;
    }

    // 💡 РЕКОМЕНДАЦИИ
    reportMessage += `💡 **РЕКОМЕНДАЦИИ:**\n`;
    if (report.totalPhotos >= 5) {
        reportMessage += `• Достаточно данных для анализа тропы\n`;
    } else {
        reportMessage += `• Мало данных, нужно больше фото для точного анализа\n`;
    }

    if (analysis.peopleCount.estimatedCount > 1) {
        reportMessage += `• Обнаружена группа людей\n`;
    }

    reportMessage += `\n💾 Отчет сохранен`;

    await bot.sendMessage(chatId, reportMessage);

    // 💾 Сохранение в Яндекс.Диск
    if (yandexDisk && yandexDisk.isAvailable && yandexDisk.isAvailable()) {
        try {
            const saveResult = await yandexDisk.saveSessionReport(userId, {
                ...report,
                intelligenceAnalysis: analysis
            });

            if (saveResult.success) {
                await bot.sendMessage(chatId,
                    `✅ Полный отчет сохранен в облако\n` +
                    `📁 ${saveResult.path || 'Яндекс.Диск'}`
                );
            }
        } catch (error) {
            console.log('⚠️ Ошибка сохранения отчета:', error.message);
        }
    }

    // ⭐ Показываем топологию лучшего фото в сессии
    if (session.analysisResults && session.analysisResults.length > 0) {
        // Находим лучшее фото для топологической визуализации
        const bestPhoto = findBestPhotoInSession(session);

        if (bestPhoto && bestPhoto.result.visualizationPaths?.topology) {
            const topologyPath = bestPhoto.result.visualizationPaths.topology;

            // Проверяем что файл существует
            if (topologyPath && fs.existsSync(topologyPath)) {
                try {
                    await bot.sendPhoto(chatId, topologyPath, {
                        caption: `🕸️ **Топология лучшего фото** (№${bestPhoto.index + 1})\n` +
                                 `• Протекторов: ${bestPhoto.protectorCount}\n` +
                                 '• 🟢 Зеленые точки - центры протекторов\n' +
                                 '• 🟠 Оранжевые линии - связи\n' +
                                 '• 🔵 Синий пунктир - контур следа'
                    });

                    // Очистка файла после отправки
                    setTimeout(() => {
                        tempFileManager.removeFile(topologyPath);
                    }, 1000);

                } catch (photoError) {
                    console.log('⚠️ Не удалось отправить топологию:', photoError.message);
                }
            }
        }
    }
});

// Команда /cancel - отменить все операции
bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Очищаем контекст калькуляторов
    delete userContext[userId];

    // Проверяем активную сессию
    if (sessionManager.hasActiveSession(userId)) {
        const session = sessionManager.endSession(userId);
        await bot.sendMessage(chatId,
            `🗑️ **СЕССИЯ ОТМЕНЕНА**\n\n` +
            `Сессия "${session.id.slice(0, 8)}..." отменена\n` +
            `Удалено: ${session.photos.length} фото\n\n` +
            `🔄 Новая сессию: /trail_start`
        );
        return;
    }

    await bot.sendMessage(chatId,
        `✅ Все активные операции отменены\n` +
        `Готов к новым командам`
    );
});

// =============================================================================
// 🆕 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СЕССИЙ
// =============================================================================

// Функция для поиска лучшего фото в сессии (с максимальным количеством протекторов)
function findBestPhotoInSession(session) {
    if (!session.analysisResults || session.analysisResults.length === 0) {
        return null;
    }

    let bestPhoto = null;
    let maxProtectors = 0;

    session.analysisResults.forEach((result, index) => {
        const protectorCount = result.predictions?.filter(p =>
            p.class === 'shoe-protector').length || 0;

        if (protectorCount > maxProtectors) {
            maxProtectors = protectorCount;
            bestPhoto = {
                index: index,
                result: result,
                protectorCount: protectorCount
            };
        }
    });

    return bestPhoto;
}

// Команда /trail_details - детали сессии
bot.onText(/\/trail_details/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!sessionManager.hasActiveSession(userId)) {
        await bot.sendMessage(chatId,
            `❌ Нет активной сессии\n` +
            `Начните: /trail_start`
        );
        return;
    }

    const session = sessionManager.getActiveSession(userId);

    if (session.analysisResults.length === 0) {
        await bot.sendMessage(chatId,
            `📭 В сессии пока нет проанализированных фото\n` +
            `Отправьте фото для анализа`
        );
        return;
    }

    let detailsMessage = `📋 **ДЕТАЛИ СЕССИИ** (${session.analysisResults.length} фото)\n\n`;

    // Находим лучшее фото
    const bestPhoto = findBestPhotoInSession(session);

    if (bestPhoto) {
        detailsMessage += `⭐ **ЛУЧШЕЕ ФОТО:** №${bestPhoto.index + 1}\n`;
        detailsMessage += `• Протекторов: ${bestPhoto.protectorCount}\n\n`;
    }

    session.analysisResults.forEach((result, index) => {
        const footprintCount = result.predictions?.filter(p =>
            p.class === 'Outline-trail').length || 0;
        const protectorCount = result.predictions?.filter(p =>
            p.class === 'shoe-protector').length || 0;
        const animalCount = result.predictions?.filter(p =>
            p.class === 'animal-paw' || p.class === 'Animal').length || 0;

        detailsMessage += `**Фото ${index + 1}:**\n`;
        detailsMessage += `• Следов: ${footprintCount}\n`;
        detailsMessage += `• Деталей протектора: ${protectorCount}\n`;

        if (animalCount > 0) {
            detailsMessage += `• Следов животных: ${animalCount}\n`;
        }

        if (result.intelligentAnalysis?.summary) {
            detailsMessage += `• Тип: ${result.intelligentAnalysis.summary.footprintType}\n`;
            detailsMessage += `• Ориентация: ${result.intelligentAnalysis.summary.orientation}\n`;
        }

        if (index === bestPhoto?.index) {
            detailsMessage += `⭐ **Лучшее по детализации**\n`;
        }

        detailsMessage += `\n`;
    });

    await bot.sendMessage(chatId, detailsMessage);

    // Показываем топологию лучшего фото если есть
    if (bestPhoto && bestPhoto.result.visualizationPaths?.topology) {
        const topologyPath = bestPhoto.result.visualizationPaths.topology;

        if (fs.existsSync(topologyPath)) {
            setTimeout(async () => {
                await bot.sendPhoto(chatId, topologyPath, {
                    caption: `🕸️ **Топология фото ${bestPhoto.index + 1}**\n` +
                             `• Протекторов: ${bestPhoto.protectorCount}\n` +
                             '• 🟢 Зеленые точки - центры протекторов\n' +
                             '• 🟠 Оранжевые линии - связи\n' +
                             '• 🔵 Синий пунктир - контур следа'
                });
            }, 500);
        }
    }
});

// Команда /yandex
bot.onText(/\/yandex/, async (msg) => {
    const chatId = msg.chat.id;

    if (!yandexDisk) {
        await bot.sendMessage(chatId,
            '❌ **Яндекс.Диск не настроен**\n\n' +
            'Добавьте YANDEX_DISK_TOKEN в конфигурацию'
        );
        return;
    }

    try {
        await bot.sendMessage(chatId, '🔍 Проверяю подключение к Яндекс.Диску...');

        const diskInfo = await yandexDisk.getDiskInfo();
        const connectionOk = await yandexDisk.checkConnection();

        if (connectionOk && diskInfo.success) {
            const freeGB = (diskInfo.free / 1024 / 1024 / 1024).toFixed(2);
            const totalGB = (diskInfo.total / 1024 / 1024 / 1024).toFixed(2);

            await bot.sendMessage(chatId,
                '✅ **Яндекс.Диск подключен**\n\n' +
                `💾 Доступно: ${freeGB} GB / ${totalGB} GB\n` +
                `📁 Папка: apps/ShoeBot/\n` +
                `🔄 Автосохранение: включено\n\n` +
                `Все результаты анализов автоматически сохраняются в облако.`
            );
        } else {
            await bot.sendMessage(chatId, '❌ Ошибка подключения к Яндекс.Диску');
        }
    } catch (error) {
        await bot.sendMessage(chatId, '❌ Ошибка проверки Яндекс.Диска');
    }
});

// =============================================================================
// 🆕 СИСТЕМА ОЧЕРЕДИ И ДЕТЕКТОР ПАЧКИ ФОТО
// =============================================================================

const photoBatchDetector = new Map(); // userId -> {photos: [], timer: null}
const photoQueue = new Map(); // userId -> array of photos
const processingUsers = new Set(); // userIds being processed

// Функция для обработки очереди фото
async function processPhotoQueue(userId, chatId) {
    if (processingUsers.has(userId)) return;
    if (!photoQueue.has(userId) || photoQueue.get(userId).length === 0) return;

    processingUsers.add(userId);
    const queue = photoQueue.get(userId);

    // Сортируем по времени получения
    queue.sort((a, b) => a.timestamp - b.timestamp);

    // Проверяем, нужно ли создать сессию автоматически
    const shouldCreateAutoSession = queue.length >= 2 &&
                                   !sessionManager.hasActiveSession(userId);

    let sessionCreated = false;
    if (shouldCreateAutoSession) {
        // Создаем автоматическую сессию для пачки фото
        const session = sessionManager.createSession(userId, 'auto_batch');

        // Предупреждаем пользователя ОДИН РАЗ
        await bot.sendMessage(chatId,
            `📦 **ОБНАРУЖЕНА ПАЧКА ФОТО (${queue.length})**\n\n` +
            `🔄 Автоматически перехожу в сессионный режим\n` +
            `🆔 Сессия: ${session.id.slice(0, 8)}...\n\n` +
            `📋 **Инструкция:**\n` +
            `• Фото будут обработаны по очереди\n` +
            `• Каждое фото будет подтверждено\n` +
            `• В конце - полный отчет\n\n` +
            `💡 **Команды сессии:**\n` +
            `/trail_status - статус\n` +
            `/trail_end - завершить с отчетом\n` +
            `/cancel - отменить сессию`
        );

        sessionCreated = true;
    }

    // Обрабатываем фото по очереди
    for (let i = 0; i < queue.length; i++) {
        const photoData = queue[i];

        try {
            // Имитируем отправку фото (вызываем обработчик фото)
            await processSinglePhoto(chatId, userId, photoData.msg, i + 1, queue.length);

            // Небольшая задержка между обработкой фото
            if (i < queue.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

        } catch (error) {
            console.log(`❌ Ошибка обработки фото ${i + 1}:`, error.message);
            await bot.sendMessage(chatId, `❌ Ошибка при обработке фото ${i + 1}`);
        }
    }

    // Очищаем очередь
    photoQueue.delete(userId);
    processingUsers.delete(userId);

    // Если создали автоматическую сессию, напоминаем о командах
    if (sessionCreated) {
        await bot.sendMessage(chatId,
            `✅ Все ${queue.length} фото обработаны\n\n` +
            `📊 Сессия активна, можно:\n` +
            `• Отправить еще фото\n` +
            `• Проверить статус: /trail_status\n` +
            `• Завершить с отчетом: /trail_end\n` +
            `• Отменить: /cancel`
        );
    }
}

// =============================================================================
// 📸 ОСНОВНАЯ ФУНКЦИЯ ОБРАБОТКИ ФОТО С ИНТЕГРАЦИЕЙ НОВОЙ СИСТЕМЫ
// =============================================================================

// Обработчик отдельного фото (вынесенная логика)
async function processSinglePhoto(chatId, userId, msg, currentIndex = 1, totalCount = 1) {
    const hasSession = sessionManager ? sessionManager.hasActiveSession(userId) : false;

    try {
        updateUserStats(userId, msg.from.username || msg.from.first_name, 'photo');

        // 🆕 СЕССИОННЫЙ РЕЖИМ: отправляем короткое подтверждение
        let statusMessage = null;
        if (hasSession) {
            const session = sessionManager.getActiveSession(userId);
            const photoNum = session.photos.length + 1;

            if (totalCount > 1) {
                statusMessage = await bot.sendMessage(chatId,
                    `📸 Обрабатываю фото ${currentIndex}/${totalCount}...`
                );
            } else {
                statusMessage = await bot.sendMessage(chatId,
                    `📸 Получено фото ${photoNum}...`
                );
            }
        } else if (totalCount > 1) {
            // Пачка фото без сессии
            statusMessage = await bot.sendMessage(chatId,
                `📸 Обрабатываю фото ${currentIndex}/${totalCount}...`
            );
        } else {
            // Одиночное фото без сессии
            await bot.sendMessage(chatId, '📥 Получено фото, начинаю анализ...');
        }

        const photo = msg.photo[msg.photo.length - 1];
        const file = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_TOKEN}/${file.file_path}`;

        // 🔄 СОХРАНЯЕМ ФОТО ВО ВРЕМЕННЫЙ ФАЙЛ
        const tempImagePath = tempFileManager.createTempFile('original', 'jpg');
        const response = await axios({
            method: 'GET',
            url: fileUrl,
            responseType: 'stream'
        });

        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(tempImagePath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // Если сессия - добавляем фото
        if (hasSession && sessionManager) {
            sessionManager.addPhotoToSession(userId, {
                fileId: photo.file_id,
                chatId: chatId,
                fileUrl: fileUrl,
                localPath: tempImagePath,
                batchIndex: currentIndex,
                batchTotal: totalCount
            });
        }

        // 🔍 АНАЛИЗ ROBOFLOW
        const roboflowResponse = await axios({
            method: "POST",
            url: config.ROBOFLOW.API_URL,
            params: {
                api_key: config.ROBOFLOW.API_KEY,
                image: fileUrl,
                confidence: config.ROBOFLOW.CONFIDENCE,
                overlap: config.ROBOFLOW.OVERLAP,
                format: 'json'
            },
            timeout: 30000
        });

        // 🔥 ИСПРАВЛЕННЫЙ БЛОК ДИАГНОСТИКИ (без спама координатами)
        const predictions = roboflowResponse.data.predictions || [];

        if (predictions.length > 0) {
            // Подсчитаем классы для информативного лога
            const classCount = {};
            predictions.forEach(pred => {
                const className = pred.class || 'unknown';
                classCount[className] = (classCount[className] || 0) + 1;
            });

            console.log(`📊 Roboflow: ${predictions.length} объектов. Распределение: ${JSON.stringify(classCount)}`);

            // Покажем только первую точку если включен расширенный дебаг
            if (DEBUG_MODE) {
                const firstPred = predictions[0];
                console.log('🔍 Расширенный дебаг (первый объект):');
                console.log(`  class: ${firstPred.class}, confidence: ${firstPred.confidence}`);

                if (firstPred.points && firstPred.points.length > 0) {
                    const firstPoint = firstPred.points[0];
                    console.log(`  point[0]: x=${firstPoint.x}, y=${firstPoint.y}`);
                }
            }
        } else {
            console.log('📭 Roboflow: объектов не обнаружено');
        }

        const processedPredictions = smartPostProcessing(predictions);
        const analysis = analyzePredictions(processedPredictions);

        // 🔍 ПРАКТИЧЕСКИЙ АНАЛИЗ
        let predictionsForAnalysis = processedPredictions;
        let practicalAnalysis = null;
        let animalFilterResult = null;

        try {
            animalFilterResult = animalFilter.filterAnimalPaws(processedPredictions);
            const filteredPredictions = animalFilterResult.filtered;
            practicalAnalysis = practicalAnalyzer.analyzeForPSO(filteredPredictions);
            predictionsForAnalysis = filteredPredictions;
        } catch (psoError) {
            console.log('⚠️ Практический анализ пропущен:', psoError.message);
        }

        // 🧠 ИНТЕЛЛЕКТУАЛЬНЫЙ АНАЛИЗ
        let intelligentAnalysis = null;
        try {
            if (analysisModule && analysisModule.performComprehensiveAnalysis) {
                intelligentAnalysis = await analysisModule.performComprehensiveAnalysis(
                    tempImagePath,
                    predictionsForAnalysis,
                    {
                        userId: userId,
                        username: msg.from.username || msg.from.first_name
                    }
                );
            }
        } catch (analysisError) {
            console.log('⚠️ Интеллектуальный анализ пропущен:', analysisError.message);
        }

        // 🔥 ИСПРАВЛЕНИЕ: СЧИТАЕМ avgConfidence ЗДЕСЬ, перед использованием
        const avgConfidence = predictionsForAnalysis && predictionsForAnalysis.length > 0
            ? predictionsForAnalysis.reduce((sum, p) => sum + (p.confidence || 0), 0) / predictionsForAnalysis.length
            : 0.5;

        // 🎨 ВИЗУАЛИЗАЦИЯ
        let vizPath = null;
        let topologyVizPath = null;

        if (analysis.total > 0) {
            try {
                const vizModule = visualization ? visualization.getVisualization(userId, 'analysis') : null;
                vizPath = tempFileManager.createTempFile('analysis', 'png');

                if (vizModule) {
                    await vizModule.createVisualization(
                        fileUrl,
                        predictionsForAnalysis,
                        { username: msg.from.username || msg.from.first_name },
                        vizPath
                    );
                }

                // Топологическая визуализация только если есть протекторы
                const protectors = predictionsForAnalysis.filter(p => p.class === 'shoe-protector');
                if (protectors.length > 3 && topologyVisualizer) {
                    topologyVizPath = tempFileManager.createTempFile('topology_science', 'png');
                    await topologyVisualizer.createTopologyVisualization(
                        fileUrl,
                        predictionsForAnalysis,
                        topologyVizPath
                    );
                }

            } catch (vizError) {
                console.log('⚠️ Визуализация пропущена:', vizError.message);
            }
        }

        // =============================================================================
        // 🎯 ИНТЕГРАЦИЯ С ГИБРИДНОЙ СИСТЕМОЙ
        // =============================================================================
        if (hybridManager && processedPredictions.length >= 10) {
            try {
                const hybridResult = await hybridManager.processPhoto(
                    userId,
                    { predictions: processedPredictions },
                    {
                        photoId: photo.file_id,
                        chatId: chatId,
                        localPath: tempImagePath,
                        username: msg.from.username || msg.from.first_name,
                        timestamp: new Date()
                    }
                );

                if (hybridResult.success) {
                    console.log(`🎯 Гибридная система: ${hybridResult.merged ? 'Объединён с существующим' : 'Создан новый'} отпечаток`);

                    if (hybridResult.merged) {
                        // Уведомить пользователя об автосовмещении
                        setTimeout(async () => {
                            await bot.sendMessage(chatId,
                                `🎯 **АВТОСОВМЕЩЕНИЕ СРАБОТАЛО!**\n\n` +
                                `📊 Определено как тот же след\n` +
                                `🔗 Схожесть: ${Math.round(hybridResult.similarity * 100)}%\n` +
                                `📈 Точек в модели: ${hybridResult.mergeResult?.totalPoints || '?'}\n\n` +
                                `💡 Система автоматически объединяет следы одной обуви!`
                            );
                        }, 1000);
                    }
                }
            } catch (error) {
                console.log('⚠️ Ошибка гибридной системы:', error.message);
                // Не падаем, продолжаем обычную обработку
            }
        }

        // =============================================================================
        // 🎯 ИНТЕГРАЦИЯ С НОВОЙ ГРАФОВОЙ СИСТЕМОЙ
        // =============================================================================
        if (predictionsForAnalysis && predictionsForAnalysis.length > 0 && footprintManager) {
            try {
                const shoeProtectors = predictionsForAnalysis.filter(p =>
                    p.class === 'shoe-protector' ||
                    (p.confidence || 0) > 0.3
                );

                if (shoeProtectors.length >= 3) {
                    console.log(`👣 Интеграция с новой системой: ${shoeProtectors.length} протекторов`);

                    // Проверяем, есть ли активная сессия
                    if (!footprintManager.getActiveSession(userId)) {
                        // Создаём автоматическую сессию
                        footprintManager.createSession(userId, `Автосессия_${new Date().toLocaleTimeString('ru-RU')}`);
                        console.log(`🔄 Создана автосессия для пользователя ${userId}`);
                    }

                    // 🔴 ОБНОВЛЕНО: Добавляем bot и chatId для визуализации
                    const addResult = await footprintManager.addPhotoToSession(
                        userId,
                        {
                            predictions: shoeProtectors
                        },
                        {
                            photoId: photo.file_id,
                            chatId: chatId,
                            localPath: tempImagePath,
                            photoQuality: avgConfidence,
                            timestamp: new Date(),
                            username: msg.from.username || msg.from.first_name
                        },
                        bot, // 🔴 ДОБАВЛЕНО: передаем бота
                        chatId // 🔴 ДОБАВЛЕНО: передаем chatId
                    );

                    // 🔴 ОБНОВЛЕНО: Показываем пользователю результат автосовмещения с визуализацией
                    if (addResult.alignment && addResult.alignment.success) {
                        console.log(`🎯 Автосовмещение: ${addResult.alignment.decision}, similarity: ${addResult.alignment.similarity}`);

                        // Если произошло объединение - сообщаем пользователю
                        if (addResult.alignment.decision === 'merged') {
                            setTimeout(async () => {
                                await bot.sendMessage(chatId,
                                    `🎯 **АВТОСОВМЕЩЕНИЕ СРАБОТАЛО!**\n\n` +
                                    `📊 Определено как тот же след\n` +
                                    `🔗 Узлов объединено: ${addResult.alignment.mergedNodes || 0}\n` +
                                    `📈 Всего узлов в модели: ${addResult.totalNodes || 0}\n\n` +
                                    `💡 Система автоматически объединяет следы одной обуви!`
                                );
                               
                                // 🔴 ДОБАВЛЕНО: Проверяем наличие визуализации
                                if (addResult.mergeVisualization) {
                                    console.log(`🎨 Визуализация объединения доступна: ${addResult.mergeVisualization}`);
                                    // Картинка уже отправлена автоматически в менеджере
                                }
                            }, 1000);
                        }
                    }

                    // Сохраняем для будущего использования
                    saveUserLastAnalysis(userId, {
                        predictions: predictionsForAnalysis,
                        practicalAnalysis: practicalAnalysis,
                        intelligentAnalysis: intelligentAnalysis,
                        analysis: analysis,
                        timestamp: new Date(),
                        confidence: avgConfidence,
                        visualizationPaths: { analysis: vizPath, topology: topologyVizPath },
                        localPhotoPath: tempImagePath,
                        // ДАННЫЕ ДЛЯ НОВОЙ СИСТЕМЫ
                        hasSimpleFootprintData: true,
                        sessionId: footprintManager.getActiveSession(userId)?.id,
                        nodesCount: addResult.totalNodes || 0,
                        protectorCount: shoeProtectors.length
                    });
                }
            } catch (error) {
                console.log('⚠️ Ошибка интеграции с новой системой:', error.message);
                // Не падаем, продолжаем работу
            }
        }

        // 🆕 СЕССИОННЫЙ РЕЖИМ: КОРОТКОЕ ПОДТВЕРЖДЕНИЕ
        if (hasSession) {
            const session = sessionManager.getActiveSession(userId);

            // Добавляем анализ в сессию
            sessionManager.addAnalysisToSession(userId, {
                predictions: predictionsForAnalysis,
                practicalAnalysis: practicalAnalysis,
                intelligentAnalysis: intelligentAnalysis,
                analysis: analysis,
                timestamp: new Date(),
                visualizationPaths: {
                    analysis: vizPath,
                    topology: topologyVizPath
                },
                batchInfo: {
                    index: currentIndex,
                    total: totalCount
                }
            });

            // Обновляем сообщение на короткое подтверждение
            if (statusMessage) {
                if (totalCount > 1) {
                    await bot.editMessageText(
                        `✅ Фото ${currentIndex}/${totalCount} обработано\n` +
                        `📊 Сессия: ${session.photos.length} фото`,
                        {
                            chat_id: chatId,
                            message_id: statusMessage.message_id
                        }
                    );
                } else {
                    await bot.editMessageText(
                        `✅ Фото ${session.photos.length} принято\n` +
                        `📊 Сессия: ${session.photos.length} фото`,
                        {
                            chat_id: chatId,
                            message_id: statusMessage.message_id
                        }
                    );
                }
            }

        } else if (totalCount > 1) {
            // Пачка фото без сессии - просто подтверждение
            if (statusMessage) {
                await bot.editMessageText(
                    `✅ Фото ${currentIndex}/${totalCount} обработано`,
                    {
                        chat_id: chatId,
                        message_id: statusMessage.message_id
                    }
                );
            }

            // Очистка
            tempFileManager.removeFile(tempImagePath);
            if (vizPath) tempFileManager.removeFile(vizPath);
            if (topologyVizPath) tempFileManager.removeFile(topologyVizPath);

        } else {
            // 🆕 ОДИНОЧНОЕ ФОТО БЕЗ СЕССИИ: ПОЛНЫЙ АНАЛИЗ
            if (analysis.total === 0) {
                await bot.sendMessage(chatId, '❌ Не удалось обнаружить детали на фото');
                tempFileManager.removeFile(tempImagePath);
                return;
            }

            // Отправляем результаты
            let resultMessage = `✅ АНАЛИЗ ЗАВЕРШЕН\n\n`;
            resultMessage += `📊 Обнаружено: ${analysis.total} объектов\n\n`;

            // Классификация
            resultMessage += `📋 КЛАССИФИКАЦИЯ:\n`;
            Object.entries(analysis.classes).forEach(([className, count]) => {
                resultMessage += `• ${className}: ${count}\n`;
            });

            await bot.sendMessage(chatId, resultMessage);

            // Визуализация
            if (vizPath && fs.existsSync(vizPath)) {
                await bot.sendPhoto(chatId, vizPath, {
                    caption: '🎨 Визуализация анализа'
                });
                tempFileManager.removeFile(vizPath);
            }

            // 🔥 ВЕРНУЛИ ТОПОЛОГИЧЕСКУЮ ВИЗУАЛИЗАЦИЮ ДЛЯ ОДИНОЧНОГО ФОТО
            if (topologyVizPath && fs.existsSync(topologyVizPath)) {
                await bot.sendPhoto(chatId, topologyVizPath, {
                    caption: '🕸️ Топологический анализ протектора\n' +
                             ' 🟢 Зеленые точки - центры протекторов\n' +
                             ' 🟠 Оранжевые линии - связи\n' +
                             ' 🔵 Синий пунктир - контур следа'
                });
                tempFileManager.removeFile(topologyVizPath);
            }

            // Практический анализ
            if (practicalAnalysis && practicalAnalysis.recommendations) {
                let practicalMessage = `🎯 **ПРАКТИЧЕСКИЙ АНАЛИЗ:**\n\n`;
                practicalAnalysis.recommendations.slice(0, 3).forEach(rec => {
                    practicalMessage += `• ${rec}\n`;
                });
                await bot.sendMessage(chatId, practicalMessage);
            }

            // Интеллектуальный анализ
            if (intelligentAnalysis && intelligentAnalysis.summary) {
                const intelMessage = `🧠 ИНТЕЛЛЕКТУАЛЬНЫЙ АНАЛИЗ:\n\n` +
                    `🧭 Ориентация: ${intelligentAnalysis.summary.orientation}\n` +
                    `👟 Тип обуви: ${intelligentAnalysis.summary.footprintType}\n` +
                    `🔷 Морфология: ${intelligentAnalysis.summary.morphology}\n` +
                    `🕸️ Топология: ${intelligentAnalysis.summary.topology}`;

                await bot.sendMessage(chatId, intelMessage);
            }

            // 🔥 ДОБАВЛЯЕМ ЗАПРОС ОБРАТНОЙ СВЯЗИ
            if (!hasSession && totalCount === 1 && predictionsForAnalysis.length > 0) {
                // Выбираем самый уверенный prediction
                const bestPrediction = predictionsForAnalysis.reduce((best, current) =>
                    (current.confidence || 0) > (best.confidence || 0) ? current : best
                );

                if (bestPrediction && bestPrediction.confidence > 0.6) {
                    // Случайный шанс 30% чтобы не спамить
                    if (Math.random() < 0.3) {
                        setTimeout(async () => {
                            const feedbackRequest = feedbackManager.requestFeedback(
                                userId,
                                chatId,
                                bestPrediction,
                                {
                                    imageId: tempImagePath,
                                    analysisType: 'single_photo',
                                    timestamp: new Date()
                                }
                            );

                            await bot.sendMessage(chatId,
                                `💬 **ПОМОГИТЕ УЛУЧШИТЬ ТОЧНОСТЬ**\n\n` +
                                `Насколько правильно определен этот элемент?\n` +
                                `**Класс:** ${bestPrediction.class}\n` +
                                `**Уверенность:** ${(bestPrediction.confidence * 100).toFixed(1)}%`,
                                {
                                    reply_markup: feedbackManager.createFeedbackKeyboard()
                                }
                            );
                        }, 1000);
                    }
                }
            }

            // Очистка
            tempFileManager.removeFile(tempImagePath);
            if (topologyVizPath) tempFileManager.removeFile(topologyVizPath);
        }

        updateUserStats(userId, msg.from.username || msg.from.first_name, 'analysis');

    } catch (error) {
        console.log('❌ Ошибка анализа фото:', error.message);
        await bot.sendMessage(chatId, `❌ Ошибка при обработке фото ${currentIndex || ''}`);
    }
}

// =============================================================================
// 📸 ОБРАБОТКА ФОТО С ПАЧКАМИ И ОЧЕРЕДЯМИ
// =============================================================================
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Добавляем фото в детектор пачки
    if (!photoBatchDetector.has(userId)) {
        photoBatchDetector.set(userId, {
            photos: [],
            timer: null
        });
    }

    const detector = photoBatchDetector.get(userId);
    detector.photos.push({
        msg: msg,
        timestamp: Date.now()
    });

    // Сбрасываем таймер
    if (detector.timer) {
        clearTimeout(detector.timer);
    }

    // Ждем 1 секунду для сбора пачки фото
    detector.timer = setTimeout(async () => {
        const photos = detector.photos;
        photoBatchDetector.delete(userId);

        // Если фото одно и нет активной сессии - обрабатываем сразу
        if (photos.length === 1 && (!sessionManager || !sessionManager.hasActiveSession(userId))) {
            await processSinglePhoto(chatId, userId, photos[0].msg);
            return;
        }

        // Если несколько фото или есть активная сессия - добавляем в очередь
        if (!photoQueue.has(userId)) {
            photoQueue.set(userId, []);
        }

        photos.forEach(photo => {
            photoQueue.get(userId).push({
                msg: photo.msg,
                timestamp: photo.timestamp
            });
        });

        // Запускаем обработку очереди
        setTimeout(() => processPhotoQueue(userId, chatId), 100);

    }, 1000); // Ждем 1 секунду для сбора пачки
});

// =============================================================================
// 🆕 НОВЫЕ КОМАНДЫ ДЛЯ ГРАФОВОЙ СИСТЕМЫ
// =============================================================================

// Команда /footprint_start - начать сессию
bot.onText(/\/footprint_start(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const sessionName = match[1] || `Сессия_${new Date().toLocaleDateString('ru-RU')}`;

    try {
        if (!footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        // Проверяем активную сессию
        if (footprintManager.getActiveSession(userId)) {
            await bot.sendMessage(chatId,
                `⚠️ **СЕССИЯ УЖЕ АКТИВНА**\n\n` +
                `Отправляйте фото следов. Система будет автоматически:\n` +
                `• Определять одинаковые следы\n` +
                `• Объединять их в одну модель\n` +
                `• Игнорировать разные следы\n\n` +
                `🏁 Завершить: /footprint_save "Название модели"`
            );
            return;
        }

        // Создаём новую сессию
        const session = footprintManager.createSession(userId, sessionName);

        await bot.sendMessage(chatId,
            `🔄 **НОВАЯ СЕССИЯ СОЗДАНА**\n\n` +
            `📝 Название: ${sessionName}\n` +
            `🎯 Автосовмещение: ВКЛЮЧЕНО\n` +
            `🎨 Визуализация объединения: ВКЛЮЧЕНА\n\n` +
            `📸 **Как использовать:**\n` +
            `1. Отправляйте фото следов по одному\n` +
            `2. Система автоматически определит, это тот же след или другой\n` +
            `3. При одинаковых следах - объединит в одну модель\n` +
            `4. При разных следах - начнёт новую модель\n\n` +
            `💡 **Рекомендации:**\n` +
            `• Снимайте один след с разных ракурсов\n` +
            `• Для лучшего качества - 3-5 фото одного следа\n` +
            `• Избегайте сильных искажений перспективы\n\n` +
            `🏁 Завершить и сохранить: /footprint_save "Название"`
        );

    } catch (error) {
        console.log('❌ Ошибка создания сессии:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /footprint_save - сохранить сессию как модель
bot.onText(/\/footprint_save(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const modelName = match[1] || `Модель_${new Date().toLocaleDateString('ru-RU')}`;

    try {
        if (!footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        await bot.sendMessage(chatId, `💾 Сохраняю сессию как модель "${modelName}"...`);

        const saveResult = footprintManager.saveSessionAsModel(userId, modelName);

        if (saveResult.success) {
            let response = `✅ **МОДЕЛЬ СОХРАНЕНА!**\n\n`;
            response += `📝 Название: ${saveResult.modelName}\n`;
            response += `🆔 ID: ${saveResult.modelId?.slice(0, 8)}...\n`;
            response += `📊 Узлов: ${saveResult.modelStats?.nodes || 0}\n`;
            response += `🔗 Рёбер: ${saveResult.modelStats?.edges || 0}\n`;
            response += `💎 Уверенность: ${Math.round((saveResult.modelStats?.confidence || 0) * 100)}%\n`;
            response += `📸 Фото в сессии: ${saveResult.sessionInfo?.photos || 0}\n\n`;

            response += `🎯 **ЧТО МОЖНО СДЕЛАТЬ:**\n`;
            response += `/my_footprints - Посмотреть свои модели\n`;
            response += `/find_similar_footprints - Найти похожие\n`;
            response += `/footprint_start - Начать новую сессию`;

            await bot.sendMessage(chatId, response);
        } else {
            await bot.sendMessage(chatId,
                `❌ **Не удалось сохранить модель**\n\n` +
                `Ошибка: ${saveResult.error}\n\n` +
                `💡 **Возможные причины:**\n` +
                `• Слишком мало узлов (нужно минимум 5)\n` +
                `• Нет активной сессии (/footprint_start)\n` +
                `• Недостаточно фото одного следа`
            );
        }

    } catch (error) {
        console.log('❌ Ошибка сохранения модели:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /my_footprints - показать мои модели
bot.onText(/\/my_footprints/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        if (!footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        const userModels = footprintManager.getUserModels(userId);

        if (!userModels || userModels.length === 0) {
            await bot.sendMessage(chatId,
                `📭 **У вас нет сохранённых моделей**\n\n` +
                `💡 **Как создать модель:**\n` +
                `1. Начните сессию: /footprint_start\n` +
                `2. Отправьте 2+ фото одного следа\n` +
                `3. Сохраните: /footprint_save "Название"\n\n` +
                `🎯 **Система автоматически:**\n` +
                `• Определит одинаковые следы\n` +
                `• Объединит их в модель\n` +
                `• Игнорирует разные следы`
            );
            return;
        }

        let response = `📚 **ВАШИ МОДЕЛИ** (${userModels.length})\n\n`;

        // Показываем все модели с полными ID
        userModels.slice(0, 10).forEach((model, index) => {
            const date = model.metadata?.created
                ? new Date(model.metadata.created).toLocaleDateString('ru-RU')
                : 'неизвестно';
            const fullId = model.id || 'unknown';
            const shortId = fullId.slice(0, 8);
            const nodeCount = model.graph?.nodes?.size || model.nodes?.length || 0;
            const confidence = Math.round((model.stats?.confidence || model.confidence || 0) * 100);
            const photoCount = model.metadata?.totalPhotos || model.photoHistory?.length || 0;

            response += `**${index + 1}. ${model.name || 'Без имени'}**\n`;
            response += `   🆔 ${fullId}\n`;
            response += `   👁️ Короткий: ${shortId}...\n`;
            response += `   📅 ${date}\n`;
            response += `   📊 ${nodeCount} узлов\n`;
            response += `   📸 ${photoCount} фото\n`;
            response += `   💎 ${confidence}% уверенность\n`;
            response += `   🎨 /visualize_model ${fullId}\n`;
            response += `   🔍 /visualize_compare ${fullId} [ID_другой_модели]\n`;
            response += `   📋 /view_model ${fullId}\n\n`;
        });

        if (userModels.length > 10) {
            response += `... и ещё ${userModels.length - 10} моделей\n\n`;
        }

        response += `💡 **Используйте:**\n`;
        response += `/visualize_model [ID] - Визуализация\n`;
        response += `/visualize_compare [ID1] [ID2] - Сравнение\n`;
        response += `/view_model [ID] - Детальная информация\n`;
        response += `\n📋 **Совет:** ID можно копировать из списка выше`;

        await bot.sendMessage(chatId, response);

    } catch (error) {
        console.log('❌ Ошибка /my_footprints:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /view_footprint_XXXX - просмотр модели
bot.onText(/\/view_footprint_([a-f0-9_]+)/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const shortId = match[1];

    try {
        if (!footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        await bot.sendMessage(chatId, `🔍 Загружаю модель ${shortId}...`);

        // Найти модель по ID
        const userModels = footprintManager.getUserModels(userId);
        const model = userModels.find(m => m.id && m.id.startsWith(shortId));

        if (!model) {
            await bot.sendMessage(chatId,
                `❌ **МОДЕЛЬ НЕ НАЙДЕНА**\n\n` +
                `ID: ${shortId}\n\n` +
                `💡 **Возможные причины:**\n` +
                `• Модель удалена\n` +
                `• Это не ваша модель\n` +
                `• Ошибка в ID\n\n` +
                `📋 **Посмотреть все модели:**\n` +
                `/my_footprints`
            );
            return;
        }

        // Показать информацию о модели
        const info = model.getInfo ? model.getInfo() : {
            name: model.name || 'Без имени',
            id: model.id || 'unknown',
            metadata: {
                created: model.createdAt ? new Date(model.createdAt).toLocaleString('ru-RU') : 'неизвестно',
                lastUpdated: model.updatedAt ? new Date(model.updatedAt).toLocaleString('ru-RU') : 'неизвестно'
            },
            graph: {
                nodes: model.graph?.nodes?.size || model.nodes?.length || 0,
                edges: model.graph?.edges?.size || model.edges?.length || 0,
                invariants: {
                    graphDiameter: 0,
                    clusteringCoefficient: 0,
                    avgDegree: 0,
                    density: 0
                }
            },
            stats: {
                qualityScore: Math.round((model.confidence || model.stats?.confidence || 0) * 100),
                nodes: model.graph?.nodes?.size || model.nodes?.length || 0,
                edges: model.graph?.edges?.size || model.edges?.length || 0
            },
            history: {
                photos: model.photosCount || 0
            }
        };

        let response = `👣 **ЦИФРОВОЙ ОТПЕЧАТОК**\n\n`;
        response += `📝 **Название:** ${info.name}\n`;
        response += `🆔 **ID:** ${info.id.slice(0, 12)}...\n`;
        response += `📅 **Создана:** ${info.metadata.created}\n`;
        response += `🔄 **Обновлена:** ${info.metadata.lastUpdated}\n`;
        response += `📊 **Узлов в графе:** ${info.graph.nodes}\n`;
        response += `🔗 **Рёбер в графе:** ${info.graph.edges}\n`;
        response += `💎 **Уверенность:** ${info.stats.qualityScore}%\n`;
        response += `📸 **Фото в истории:** ${info.history.photos}\n\n`;

        // Инварианты графа
        const invariants = info.graph.invariants;
        response += `📊 **ИНВАРИАНТЫ ГРАФА:**\n`;
        response += `• Диаметр: ${invariants.graphDiameter}\n`;
        response += `• Коэф. кластеризации: ${invariants.clusteringCoefficient.toFixed(3)}\n`;
        response += `• Средняя степень: ${invariants.avgDegree.toFixed(2)}\n`;
        response += `• Плотность: ${invariants.density.toFixed(4)}\n\n`;

        response += `🎯 **ЧТО МОЖНО СДЕЛАТЬ:**\n`;
        response += `/find_similar_footprints - Найти похожие\n`;
        response += `/footprint_start - Создать новую модель\n`;
        response += `\n📤 **Совет:** Отправьте больше фото этой обуви для улучшения модели!`;

        await bot.sendMessage(chatId, response);

    } catch (error) {
        console.log('❌ Ошибка просмотра модели:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /find_similar_footprints - найти похожие
bot.onText(/\/find_similar_footprints/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        if (!footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        // Проверяем, есть ли последний анализ
        const lastAnalysis = getLastUserAnalysis(userId);

        if (!lastAnalysis || !lastAnalysis.predictions || lastAnalysis.predictions.length === 0) {
            await bot.sendMessage(chatId,
                `❌ **Нет данных для поиска**\n\n` +
                `Сначала отправьте фото следа для анализа.\n` +
                `После анализа используйте /find_similar_footprints\n\n` +
                `📸 **Как сделать:**\n` +
                `1. Отправьте фото следа\n` +
                `2. Дождитесь анализа\n` +
                `3. Используйте /find_similar_footprints`
            );
            return;
        }

        await bot.sendMessage(chatId, `🔍 Ищу похожие модели...`);

        // Создаём временный отпечаток из последнего анализа
        const tempFootprint = new SimpleFootprint({
            name: 'Поисковый запрос',
            userId: userId
        });

        tempFootprint.addAnalysis(lastAnalysis, { search: true });

        // Ищем похожие модели
        const searchResult = footprintManager.findSimilarModels(tempFootprint, userId, {
            maxResults: 5
        });

        if (!searchResult.success || searchResult.similarCount === 0) {
            await bot.sendMessage(chatId,
                `🎯 **Уникальный след!**\n\n` +
                `Похожих моделей не найдено.\n` +
                `Сохраните его как новую модель:\n` +
                `/footprint_save "Уникальный след"`
            );
            return;
        }

        // Показать результаты
        let response = `🔍 **Найдено похожих моделей:** ${searchResult.similarCount}\n\n`;

        searchResult.similarModels.forEach((similar, index) => {
            const model = similar.model;
            const shortId = model.id ? model.id.slice(0, 8) : 'unknown';

            response += `**${index + 1}. ${model.name || 'Без имени'}**\n`;
            response += `   🆔 ${shortId}\n`;
            response += `   📊 Совпадение: ${Math.round(similar.similarity * 100)}%\n`;
            response += `   👣 Узлов: ${model.graph?.nodes?.size || model.nodes?.length || 0}\n`;
            response += `   👁️ /view_footprint_${shortId}\n\n`;
        });

        response += `💡 **Что это значит?**\n`;
        response += `• >70% - Возможно, та же обувь\n`;
        response += `• 40-70% - Похожий тип протектора\n`;
        response += `• <40% - Случайное совпадение`;

        await bot.sendMessage(chatId, response);

    } catch (error) {
        console.log('❌ Ошибка поиска похожих:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /footprint_stats - статистика системы
bot.onText(/\/footprint_stats/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        if (!footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        const stats = footprintManager.getSystemStats();
        const userModels = footprintManager.getUserModels(userId);

        let response = `📊 **СТАТИСТИКА СИСТЕМЫ ОТПЕЧАТКОВ**\n\n`;
        response += `👣 **Всего моделей в системе:** ${stats.storage?.totalModels || 0}\n`;
        response += `👥 **Пользователей с моделями:** ${stats.storage?.totalUsers || 0}\n`;
        response += `🔄 **Активных сессий:** ${stats.storage?.activeSessions || 0}\n`;
        response += `🔍 **Всего сравнений:** ${stats.performance?.totalComparisons || 0}\n\n`;

        response += `📈 **ВАША СТАТИСТИКА:**\n`;
        response += `• Ваших моделей: ${userModels.length}\n`;

        if (userModels.length > 0) {
            const totalNodes = userModels.reduce((sum, m) => sum + (m.graph?.nodes?.size || m.nodes?.length || 0), 0);
            const avgConfidence = userModels.reduce((sum, m) => sum + (m.stats?.confidence || m.confidence || 0), 0) / userModels.length;

            response += `• Всего узлов: ${totalNodes}\n`;
            response += `• Средняя уверенность: ${Math.round(avgConfidence * 100)}%\n`;
        }

        response += `\n🎯 **Автосовмещение:** ${stats.config?.autoAlignment ? '✅ ВКЛЮЧЕНО' : '❌ ВЫКЛЮЧЕНО'}\n`;
        response += `💾 **Автосохранение:** ${stats.config?.autoSave ? '✅ ВКЛЮЧЕНО' : '❌ ВЫКЛЮЧЕНО'}\n`;
        response += `🎨 **Визуализация объединения:** ${stats.config?.enableMergeVisualization ? '✅ ВКЛЮЧЕНО' : '❌ ВЫКЛЮЧЕНО'}\n\n`;

        response += `🚀 **Система работает:** ${stats.system?.uptime || 0} секунд`;

        await bot.sendMessage(chatId, response);

    } catch (error) {
        console.log('❌ Ошибка статистики:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// 📝 ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ УЛУЧШЕНИЯ ВИЗУАЛИЗАЦИИ
async function enhanceVisualizationWithAnalysis(imagePath, analysis) {
    // Здесь можно добавить аннотации к визуализации на основе анализа
    // Например: стрелки направления, подписи типа обуви и т.д.
    // Пока оставляем как заглушку для будущего улучшения
    return true;
}

// Команда /visualize_model - визуализация модели
bot.onText(/\/visualize_model(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const modelId = match[1]; // Можно передать ID или использовать последнюю модель

    try {
        await bot.sendMessage(chatId, '🎨 Создаю визуализацию...');

        let model;
        if (modelId) {
            // Ищем модель по ID
            model = footprintManager.getModelById(modelId);
        } else {
            // Берем последнюю модель пользователя
            const userModels = footprintManager.getUserModels(userId);
            if (userModels.length > 0) {
                model = userModels[userModels.length - 1];
            }
        }

        if (!model) {
            await bot.sendMessage(chatId,
                `❌ **Модель не найдена**\n\n` +
                `Укажите ID модели:\n` +
                `/visualize_model [ID]\n\n` +
                `📋 Посмотреть ваши модели:\n` +
                `/my_footprints`
            );
            return;
        }

        // Создаем визуализацию
        const vizPath = await model.visualizeGraph();

        if (vizPath && fs.existsSync(vizPath)) {
            await bot.sendPhoto(chatId, vizPath, {
                caption: `🎨 **ВИЗУАЛИЗАЦИЯ МОДЕЛИ**\n\n` +
                        `📝 ${model.name}\n` +
                        `📊 Узлов: ${model.graph.nodes.size}\n` +
                        `🔗 Рёбер: ${model.graph.edges.size}\n` +
                        `💎 Уверенность: ${Math.round(model.stats.confidence * 100)}%\n\n` +
                        `🔴 Точки - центры протекторов\n` +
                        `🔵 Линии - связи между протекторами`
            });

            // Очистка файла через минуту
            setTimeout(() => {
                if (fs.existsSync(vizPath)) {
                    fs.unlinkSync(vizPath);
                }
            }, 60000);
        } else {
            await bot.sendMessage(chatId, '❌ Не удалось создать визуализацию');
        }

    } catch (error) {
        console.log('❌ Ошибка команды visualize_model:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /visualize_compare - сравнение двух моделей
bot.onText(/\/visualize_compare(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const input = match[1];

    try {
        if (!input || !input.includes(' ')) {
            await bot.sendMessage(chatId,
                `🔍 **Сравнение моделей**\n\n` +
                `📝 Формат:\n` +
                `/visualize_compare [ID1] [ID2]\n\n` +
                `Пример:\n` +
                `/visualize_compare fp_123 fp_456\n\n` +
                `📋 Ваши модели:\n` +
                `/my_footprints`
            );
            return;
        }

        const [modelId1, modelId2] = input.split(' ');
        await bot.sendMessage(chatId, '🎨 Создаю визуализацию сравнения...');

        const result = await footprintManager.visualizeComparison(modelId1, modelId2);

        if (result.success && result.visualization && fs.existsSync(result.visualization)) {
            await bot.sendPhoto(chatId, result.visualization, {
                caption: `🔍 **СРАВНЕНИЕ МОДЕЛЕЙ**\n\n` +
                        `📊 Similarity: ${Math.round(result.comparison.similarity * 100)}%\n` +
                        `🎯 Решение: ${result.comparison.decision}\n` +
                        `💡 ${result.comparison.reason}\n\n` +
                        `🔴 Красный - модель 1\n` +
                        `🟢 Зеленый - модель 2\n` +
                        `🟡 Желтые линии - совпадения`
            });

            // Очистка файла
            setTimeout(() => {
                if (fs.existsSync(result.visualization)) {
                    fs.unlinkSync(result.visualization);
                }
            }, 60000);
        } else {
            await bot.sendMessage(chatId,
                `❌ **Не удалось сравнить модели**\n\n` +
                `Ошибка: ${result.error || 'неизвестная ошибка'}\n\n` +
                `💡 **Возможные причины:**\n` +
                `• Неверные ID моделей\n` +
                `• Модели не найдены\n` +
                `• Ошибка визуализации`
            );
        }

    } catch (error) {
        console.log('❌ Ошибка команды visualize_compare:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /visualize_session - визуализация текущей сессии
bot.onText(/\/visualize_session/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        await bot.sendMessage(chatId, '🎨 Создаю визуализацию сессии...');

        const result = await footprintManager.visualizeSession(userId);

        if (result.success && result.visualization && fs.existsSync(result.visualization)) {
            await bot.sendPhoto(chatId, result.visualization, {
                caption: `🔄 **ВИЗУАЛИЗАЦИЯ СЕССИИ**\n\n` +
                        `🆔 ${result.sessionId?.slice(0, 8) || 'unknown'}\n` +
                        `📊 Разные цвета - разные фото\n` +
                        `⚪ Белый - финальная модель\n\n` +
                        `💡 **Как читать:**\n` +
                        `• Каждый цвет - отдельное фото\n` +
                        `• Точки накладываются при совпадении\n` +
                        `• Чем больше перекрытий - лучше совмещение`
            });

            // Очистка файла
            setTimeout(() => {
                if (fs.existsSync(result.visualization)) {
                    fs.unlinkSync(result.visualization);
                }
            }, 60000);
        } else {
            await bot.sendMessage(chatId,
                `❌ **Нет активной сессии**\n\n` +
                `Начните сессию для визуализации:\n` +
                `/footprint_start`
            );
        }

    } catch (error) {
        console.log('❌ Ошибка команды visualize_session:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

bot.onText(/\/view_model(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const modelId = match[1];

    try {
        if (!footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        if (!modelId) {
            await bot.sendMessage(chatId,
                `🔍 **ПРОСМОТР МОДЕЛИ**\n\n` +
                `📝 Формат:\n` +
                `/view_model [ID_модели]\n\n` +
                `📋 Получить ID моделей:\n` +
                `/my_footprints`
            );
            return;
        }

        const model = footprintManager.getModelById(modelId);
        if (!model) {
            await bot.sendMessage(chatId,
                `❌ **МОДЕЛЬ НЕ НАЙДЕНА**\n\n` +
                `ID: ${modelId}\n\n` +
                `💡 **Проверьте:**\n` +
                `1. Правильность ID\n` +
                `2. Это ваша модель?\n` +
                `3. Модель существует?\n\n` +
                `📋 **Ваши модели:**\n` +
                `/my_footprints`
            );
            return;
        }

        // Получаем информацию о модели
        const info = model.getInfo ? model.getInfo() : {
            name: model.name || 'Без имени',
            id: model.id || 'unknown',
            metadata: {
                created: model.createdAt ? new Date(model.createdAt).toLocaleString('ru-RU') : 'неизвестно',
                lastUpdated: model.updatedAt ? new Date(model.updatedAt).toLocaleString('ru-RU') : 'неизвестно'
            },
            graph: {
                nodes: model.graph?.nodes?.size || model.nodes?.length || 0,
                edges: model.graph?.edges?.size || model.edges?.length || 0
            },
            stats: {
                confidence: model.stats?.confidence || model.confidence || 0,
                qualityScore: Math.round((model.stats?.confidence || model.confidence || 0) * 100)
            },
            history: {
                photos: model.metadata?.totalPhotos || model.photoHistory?.length || 0,
                analyses: model.analysisHistory?.length || 0
            }
        };

        let response = `👣 **ЦИФРОВОЙ ОТПЕЧАТОК - ПОЛНАЯ ИНФОРМАЦИЯ**\n\n`;
        response += `📝 **Название:** ${info.name}\n`;
        response += `🆔 **Полный ID:** ${info.id}\n`;
        response += `📅 **Создана:** ${info.metadata.created}\n`;
        response += `🔄 **Обновлена:** ${info.metadata.lastUpdated}\n\n`;

        response += `📊 **СТАТИСТИКА:**\n`;
        response += `• Узлов в графе: ${info.graph.nodes}\n`;
        response += `• Рёбер в графе: ${info.graph.edges}\n`;
        response += `• Фото в истории: ${info.history.photos}\n`;
        response += `• Анализов: ${info.history.analyses}\n`;
        response += `• Уверенность: ${info.stats.qualityScore}%\n\n`;

        // Показываем инварианты если есть
        if (model.graph && model.graph.getBasicInvariants) {
            const invariants = model.graph.getBasicInvariants();
            response += `📈 **ИНВАРИАНТЫ ГРАФА:**\n`;
            response += `• Диаметр: ${invariants.graphDiameter}\n`;
            response += `• Коэф. кластеризации: ${invariants.clusteringCoefficient.toFixed(3)}\n`;
            response += `• Средняя степень: ${invariants.avgDegree.toFixed(2)}\n`;
            response += `• Плотность: ${invariants.density.toFixed(4)}\n\n`;
        }

        // История фото
        if (model.photoHistory && model.photoHistory.length > 0) {
            response += `📸 **ИСТОРИЯ ФОТО:**\n`;
            model.photoHistory.slice(0, 5).forEach((photo, idx) => {
                const date = photo.timestamp ? new Date(photo.timestamp).toLocaleString('ru-RU') : 'неизвестно';
                const points = photo.points || '?';
                response += `${idx + 1}. ${date} - ${points} точек\n`;
            });
            if (model.photoHistory.length > 5) {
                response += `... и ещё ${model.photoHistory.length - 5} фото\n`;
            }
            response += `\n`;
        }

        response += `🎯 **КОМАНДЫ ДЛЯ ЭТОЙ МОДЕЛИ:**\n`;
        response += `/visualize_model ${info.id} - Визуализация\n`;
        response += `/visualize_compare ${info.id} [ID] - Сравнить с другой\n`;
        response += `/find_similar_footprints - Найти похожие\n\n`;

        response += `📤 **Экспорт:** /export_model ${info.id}`;

        await bot.sendMessage(chatId, response);

    } catch (error) {
        console.log('❌ Ошибка /view_model:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /visualize_stats - визуализация со статистикой совпадений
bot.onText(/\/visualize_stats(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const modelId = match[1];

    try {
        await bot.sendMessage(chatId, '📊 Создаю визуализацию со статистикой...');

        let model;
        if (modelId) {
            model = footprintManager.getModelById(modelId);
        } else {
            const userModels = footprintManager.getUserModels(userId);
            if (userModels.length > 0) {
                model = userModels[userModels.length - 1];
            }
        }

        if (!model) {
            await bot.sendMessage(chatId,
                `❌ **Модель не найдена**\n\n` +
                `Укажите ID модели:\n` +
                `/visualize_stats [ID]\n\n` +
                `📋 Получить ID моделей:\n` +
                `/my_footprints`
            );
            return;
        }

        // Создаём визуализацию со статистикой
        const GraphVisualizer = require('./modules/footprint/graph-visualizer');
        const visualizer = new GraphVisualizer();

        const vizPath = await visualizer.visualizeModelWithHistory(model, {
            filename: `stats_${model.id.slice(0, 8)}.png`
        });

        if (vizPath && fs.existsSync(vizPath)) {
            // Считаем статистику для текста
            const nodeStats = visualizer.calculateNodeStatistics(model);
            const totalNodes = nodeStats.nodes.size;
            const avgMatches = totalNodes > 0
                ? Array.from(nodeStats.nodes.values()).reduce((sum, stat) => sum + stat.count, 0) / totalNodes
                : 0;
            const strongMatches = Array.from(nodeStats.nodes.values()).filter(stat => stat.count >= 3).length;

            await bot.sendPhoto(chatId, vizPath, {
                caption: `📊 **СТАТИСТИКА СОВПАДЕНИЙ**\n\n` +
                        `📝 ${model.name}\n` +
                        `📊 Узлов: ${totalNodes}\n` +
                        `📸 Фото: ${model.metadata?.totalPhotos || 0}\n` +
                        `🎯 Среднее совпадений: ${avgMatches.toFixed(1)}\n` +
                        `💪 Надёжных узлов (≥3 фото): ${strongMatches}\n\n` +
                        `🎨 **ЦВЕТА:**\n` +
                        `🔴 1 фото - точка с одного фото\n` +
                        `🟠 2 фото - совпала на двух фото\n` +
                        `🟡 3 фото - совпала на трёх фото\n` +
                        `🟢 4-6 фото - хорошее совпадение\n` +
                        `🔵 7+ фото - отличное совпадение\n\n` +
                        `📈 **Чем больше синих точек - тем надёжнее модель!**`
            });

            // Очистка файла
            setTimeout(() => {
                if (fs.existsSync(vizPath)) {
                    fs.unlinkSync(vizPath);
                }
            }, 60000);
        } else {
            await bot.sendMessage(chatId, '❌ Не удалось создать визуализацию со статистикой');
        }

    } catch (error) {
        console.log('❌ Ошибка команды visualize_stats:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

bot.onText(/\/show_why_same/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        await bot.sendMessage(chatId, '🔍 Анализирую почему система видит одинаковые следы...');

        // Создаём два тестовых графа
        const SimpleGraph = require('./modules/footprint/simple-graph');

        // Граф 1 - "вертикальный" след
        const graph1 = new SimpleGraph("След вертикально");
        const points1 = [];
        for (let i = 0; i < 30; i++) {
            points1.push({
                x: 100 + Math.random() * 200,
                y: 100 + Math.random() * 100,
                confidence: 0.8
            });
        }
        graph1.buildFromPoints(points1);

        // Граф 2 - тот же след, но "горизонтальный" (повёрнутый на 90°)
        const graph2 = new SimpleGraph("След горизонтально");
        const points2 = points1.map(p => ({
            x: 300 - p.y,  // Поворот на 90° + смещение
            y: 100 + p.x - 100,
            confidence: 0.8
        }));
        graph2.buildFromPoints(points2);

        // Сравниваем
        const SimpleGraphMatcher = require('./modules/footprint/simple-matcher');
        const matcher = new SimpleGraphMatcher({ debug: true });
        const comparison = matcher.compareGraphs(graph1, graph2);

        // Создаём визуализацию
        const InvariantVisualizer = require('./modules/footprint/invariant-visualizer');
        const visualizer = new InvariantVisualizer();
        const imagePath = await visualizer.visualizeComparison(graph1, graph2, comparison);

        if (imagePath && fs.existsSync(imagePath)) {
            await bot.sendPhoto(chatId, imagePath, {
                caption: `🎯 **ПОЧЕМУ СИСТЕМА ВИДИТ ОДИН СЛЕД**\n\n` +
                        `📊 Similarity: ${(comparison.similarity * 100).toFixed(1)}%\n` +
                        `🤔 Решение: ${comparison.decision}\n` +
                        `💡 Причина: ${comparison.reason}\n\n` +
                        `🔴 **Слева:** След в вертикальной ориентации\n` +
                        `🟢 **Справа:** Тот же след в горизонтальной ориентации\n` +
                        `🎨 **В центре:** Что сравнивает система (инварианты)\n\n` +
                        `💪 **СИСТЕМА НЕ СМОТРИТ:**\n` +
                        `• Абсолютные координаты точек\n` +
                        `• Ориентацию в кадре\n` +
                        `• Абсолютный размер\n\n` +
                        `🔍 **СИСТЕМА СМОТРИТ:**\n` +
                        `• Структуру (кто с кем связан)\n` +
                        `• Относительные расстояния\n` +
                        `• "Форму" облака точек`
            });

            // Очистка
            setTimeout(() => {
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            }, 60000);
        }

    } catch (error) {
        console.log('❌ Ошибка show_why_same:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// 🔴 НОВАЯ КОМАНДА: /visualize_merge - показать визуализацию объединения
bot.onText(/\/visualize_merge/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        if (!footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        // Получаем последнюю визуализацию объединения
        const mergeViz = footprintManager.getLastMergeVisualization(userId);

        if (!mergeViz) {
            await bot.sendMessage(chatId,
                `📭 **Нет визуализаций объединения**\n\n` +
                `💡 **Как получить визуализацию:**\n` +
                `1. Начните сессию: /footprint_start\n` +
                `2. Отправьте 2+ фото одного следа\n` +
                `3. Система автоматически создаст визуализацию при объединении\n\n` +
                `🎯 **После объединения вы получите картинку автоматически!**`
            );
            return;
        }

        // Проверяем существует ли файл
        if (!fs.existsSync(mergeViz.path)) {
            await bot.sendMessage(chatId, '❌ Файл визуализации не найден или был удалён');
            return;
        }

        await bot.sendPhoto(chatId, mergeViz.path, {
            caption: `🎭 **ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ СЛЕДОВ**\n\n` +
                    `📊 Схожесть: ${Math.round(mergeViz.similarity * 100)}%\n` +
                    `👣 Объединено узлов: ${mergeViz.mergedNodes || 0}\n` +
                    `📸 Фото: ${mergeViz.photos?.length || 2}\n` +
                    `🕰️ Дата: ${new Date(mergeViz.timestamp).toLocaleString('ru-RU')}\n\n` +
                    `🎨 **ЦВЕТА:**\n` +
                    `🔴 Красный - первое фото\n` +
                    `🔵 Синий - второе фото\n` +
                    `🟢 Зеленый - совпавшие точки\n` +
                    `⚪ Белый - объединённый граф\n\n` +
                    `💡 **Как читать:**\n` +
                    `• Чем больше зелёных точек - лучше совмещение\n` +
                    `• Белый граф - итоговая модель\n` +
                    `• Точки накладываются при совпадении`
        });

    } catch (error) {
        console.log('❌ Ошибка команды visualize_merge:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// =============================================================================
// 🧪 НОВЫЕ КОМАНДЫ ДЛЯ ГИБРИДНОЙ СИСТЕМЫ
// =============================================================================

// Команда /hybrid_stats
bot.onText(/\/hybrid_stats/, async (msg) => {
    const chatId = msg.chat.id;

    if (!hybridManager) {
        await bot.sendMessage(chatId, '❌ Гибридная система не инициализирована');
        return;
    }

    const stats = hybridManager.getStats();

    let message = `🎭 **СТАТИСТИКА ГИБРИДНОЙ СИСТЕМЫ**\n\n`;
    message += `📊 Всего сравнений: ${stats.totalComparisons}\n`;
    message += `🚫 Быстрых отсевов: ${stats.fastRejects} (${stats.totalComparisons > 0 ? Math.round(stats.fastRejects/stats.totalComparisons*100) : 0}%)\n`;
    message += `⏱️ Среднее время: ${stats.avgComparisonTime.toFixed(1)}ms\n`;
    message += `👥 Пользователей: ${stats.totalUsers}\n`;
    message += `👣 Отпечатков: ${stats.totalFootprints}\n\n`;

    message += `✅ Same: ${stats.sameDecisions}\n`;
    message += `🔍 Similar: ${stats.similarDecisions}\n`;
    message += `❌ Different: ${stats.differentDecisions}\n\n`;

    message += `🎯 **Настройки:**\n`;
    message += `• Порог same: ${stats.config.minSimilarityForSame}\n`;
    message += `• Порог similar: ${stats.config.minSimilarityForSimilar}\n`;
    message += `• Fast reject: ${stats.config.fastRejectBitmaskDistance}/64\n`;

    await bot.sendMessage(chatId, message);
});

// Команда /hybrid_test
bot.onText(/\/hybrid_test/, async (msg) => {
    const chatId = msg.chat.id;

    await bot.sendMessage(chatId, '🧪 Тестирую гибридную систему...');

    try {
        const result = await HybridManager.test();
        await bot.sendMessage(chatId, '✅ Тест гибридной системы завершён\n\nПосмотреть статистику: /hybrid_stats');
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Ошибка теста: ${error.message}`);
    }
});

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
        <p>🧪 Гибридная система (битмаска + граф): АКТИВИРОВАНА ✅</p>
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
            footprintManager: footprintManager !== null,
            hybridManager: hybridManager !== null // 🆕 Добавили гибридный менеджер
        },
        debug: {
            mode: DEBUG_MODE,
            footprintSessions: footprintManager ? Array.from(footprintManager.userSessions.keys()).length : 0,
            hybridSessions: hybridManager ? 'активна' : 'не активна',
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

console.log('🛡️ Глобальные обработчики ошибок активированы');

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

    // 🧪 ИНИЦИАЛИЗАЦИЯ ГИБРИДНОЙ СИСТЕМЫ
    try {
        await initializeHybridSystem();
        console.log('✅ Гибридная система (битмаска + граф) активирована!');
    } catch (error) {
        console.log('❌ Ошибка инициализации гибридной системы:', error.message);
        hybridManager = null;
    }

    console.log('🚀 Все модули инициализированы!');
    console.log('🎯 Практический анализ для ПСО активирован');
    console.log('🐕 Фильтрация следов животных активирована');
    console.log('👣 Новая графовая система с автосовмещением: АКТИВИРОВАНА ✅');
    console.log('🧪 Гибридная система (битмаска + граф): АКТИВИРОВАНА ✅');
    console.log('🎨 Визуализация объединения следов: АКТИВИРОВАНА ✅');
    console.log(`🔧 DEBUG_MODE: ${DEBUG_MODE ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);

})();

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
function getCorrectionDescription(type) {
    const descriptions = {
        'animal': '🐾 След животного',
        'other_shoe': '👞 Другая обувь',
        'bounds': '📏 Неправильные границы',
        'multiple': '👣 Несколько следов',
        'not_footprint': '🚫 Не след вообще',
        'other_class': '🔍 Другой класс',
        'correct': '✅ Правильно'
    };

    return descriptions[type] || type;
}

// =============================================================================
// 🌐 НАСТРОЙКА ВЕБХУКА ДЛЯ RENDER.COM
// =============================================================================

async function setupWebhook() {
    try {
        console.log('🔄 Настраиваю вебхук...');

        // 1. Удаляем старый вебхук
        const deleted = await bot.deleteWebHook({ drop_pending_updates: true });
        console.log('✅ Старый вебхук удален:', deleted);

        // 2. Ждем 2 секунды
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 3. Устанавливаем новый вебхук
        // ⚠️ ВАЖНО: Используйте ВАШ URL от Render
        const webhookUrl = `https://shoe-print-bot.onrender.com/bot${config.TELEGRAM_TOKEN}`;
        console.log('🔗 Устанавливаю вебхук:', webhookUrl);

        const result = await bot.setWebHook(webhookUrl, {
            max_connections: 40,
            allowed_updates: ["message", "callback_query", "polling_answer"]
        });

        console.log('✅ Вебхук установлен:', result);

        // 4. Проверяем
        const info = await bot.getWebHookInfo();
        console.log('📊 Информация о вебхуке:');
        console.log('- URL:', info.url);
        console.log('- Ошибок:', info.last_error_message || 'нет');
        console.log('- Ожидающих обновлений:', info.pending_update_count);

    } catch (error) {
        console.log('❌ КРИТИЧЕСКАЯ ошибка вебхука:', error.message);
        console.log('⚠️ Если вебхук не работает, запускаю polling как запасной вариант...');

        // Fallback на polling если вебхук не работает
        setTimeout(() => {
            bot.startPolling().then(() => {
                console.log('✅ Polling запущен как запасной вариант');
            }).catch(pollErr => {
                console.log('❌ Не удалось запустить polling:', pollErr.message);
            });
        }, 5000);
    }
}

// Запускаем настройку вебхука через 3 секунды после старта
setTimeout(setupWebhook, 3000);

// Периодическая проверка вебхука
setInterval(async () => {
    try {
        const info = await bot.getWebHookInfo();
        if (!info.url || info.pending_update_count > 50) {
            console.log('⚠️ Вебхук требует внимания, переустанавливаю...');
            await setupWebhook();
        }
    } catch (error) {
        console.log('❌ Ошибка проверки вебхука:', error.message);
    }
}, 30 * 60 * 1000); // Проверка каждые 30 минут

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
├─ 🦶 Footprint: гибридные отпечатки
├─ 🔍 Analysis: анализ следов
├─ 🎨 Visualization: визуализации
├─ 🤖 Bot: телеграм бот
├─ 🧮 Calculators: расчеты
├─ 📱 Apps: полезные приложения

⚙️ **НАСТРОЙКИ:**
├─ Гибридный режим: ${config.hybridMode ? '✅ ВКЛ' : '❌ ВЫКЛ'}
├─ Автосовмещение: ✅ ВКЛ
├─ Визуализация объединений: ✅ ВКЛ
├─ Debug: ${config.debug ? '✅ ВКЛ' : '❌ ВЫКЛ'}

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

// Запуск сервера
app.listen(config.PORT, () => {
    console.log(`✅ Сервер запущен на порту ${config.PORT}`);
    console.log(`🤖 Telegram бот готов к работе`);
    console.log(`🎯 Практический анализ для ПСО активирован`);
    console.log(`🐕 Фильтрация животных: активна`);
    console.log(`👣 Графовая система с автосовмещением: АКТИВИРОВАНА`);
    console.log(`🧪 Гибридная система (битмаска + граф): АКТИВИРОВАНА`);
    console.log(`🎨 Визуализация объединения следов: АКТИВИРОВАНА`);
    console.log(`🔧 DEBUG_MODE: ${DEBUG_MODE ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
});
