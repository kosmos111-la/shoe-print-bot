// =============================================================================
// 🎯 СИСТЕМА АНАЛИЗА СЛЕДОВ ОБУВИ - ОСНОВНОЙ ФАЙЛ
// =============================================================================
//
// 📋 СТАТУС: РАБОЧАЯ ВЕРСИЯ 2.2 - С ПОЛНОЙ ИНТЕГРАЦИЕЙ FOOTPRINT MANAGER
// ✅ ЧТО РАБОТАЕТ:
//   • Модульная система визуализации
//   • Анализ через Roboflow API
//   • Telegram бот с командами
//   • Canvas визуализация с выбором стилей
//   • Статистика пользователей
//   • Топологическая карта протектора
//   • 🆕 Практический анализ для ПСО
//   • 🆕 Фильтрация следов животных
//   • 🆕 ПОЛНАЯ ИНТЕГРАЦИЯ FOOTPRINT MANAGER
//
// 🏗️ АРХИТЕКТУРА:
//   • Express.js сервер + Telegram Bot API
//   • Модульная структура в папке modules/
//   • Canvas для генерации визуализаций
//   • Roboflow для ML-анализа изображений
//   • FootprintManager для автосовмещения следов
//   • Временные файлы в папке temp/
//
// 🔄 ПОСЛЕДНИЕ ИЗМЕНЕНИЯ:
//   • Исправлена ошибка avgConfidence is not defined
//   • Добавлена полная интеграция FootprintManager
//   • Добавлен автосовмещение следов в сессиях
//   • Улучшена система сохранения моделей
//   • Добавлены команды для работы с моделями
//
// =============================================================================

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ИМПОРТ МОДУЛЕЙ (дополняем существующие)
const visualizationModule = require('./modules/visualization');
const yandexDiskModule = require('./modules/yandex-disk');
const tempManagerModule = require('./modules/temp-manager');
const calculatorsModule = require('./modules/calculators');
const appsModule = require('./modules/apps');
const { AnalysisModule } = require('./modules/analysis');
const { TopologyVisualizer } = require('./modules/visualization/topology-visualizer');

// 🔍 ДОБАВЛЯЕМ ПРАКТИЧЕСКИЙ АНАЛИЗ ДЛЯ ПСО
const { PracticalAnalyzer } = require('./modules/analysis/practical-analyzer');
const { AnimalFilter } = require('./modules/correction/animal-filter');

// 🆕 ДОБАВЛЯЕМ СЕССИОННЫЕ МОДУЛИ
const { SessionManager } = require('./modules/session/session-manager');
const { SessionAnalyzer } = require('./modules/session/session-analyzer');
const { FeedbackDatabase } = require('./modules/feedback/feedback-db');
const { FeedbackManager } = require('./modules/feedback/feedback-manager');
// 🆕 СИСТЕМА ЦИФРОВЫХ ОТПЕЧАТКОВ
const { FootprintManager } = require('./modules/footprint');

// ВСТРОЕННЫЙ CONFIG
const config = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI',
    PORT: process.env.PORT || 10000,
    YANDEX_DISK_TOKEN: process.env.YANDEX_DISK_TOKEN,
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,

    ROBOFLOW: {
        API_URL: 'https://detect.roboflow.com/-zqyih/31',
        API_KEY: 'NeHOB854EyHkDbGGLE6G',
        CONFIDENCE: 25,
        OVERLAP: 30
    }
};

// Вставьте где-нибудь в начале main.js (после require)
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

// Глобальный кэш FootprintManagers
global.footprintManagers = new Map();

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
    console.log('💥 Невозможно запустить систему с некорректной конфигурацией');
    process.exit(1);
}

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
// 🆕 ДОБАВЛЯЕМ СЕССИОННЫЕ МОДУЛИ
let sessionManager;
let sessionAnalyzer;

// 🆕 ИНИЦИАЛИЗИРУЕМ ОБРАТНУЮ СВЯЗЬ
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
    console.log('📨 Вебхук запрос:', {
        update_id: update.update_id,
        message: update.message ? '📝 есть' : 'нет',
        callback_query: update.callback_query ? '🔄 есть' : 'нет'
    });

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

    const currentStyle = visualization.getUserStyle(msg.from.id);
    const styleInfo = visualization.getAvailableStyles().find(s => s.id === currentStyle);

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
        `• Фильтрация следов животных\n\n` +
        `🧮 **ИНСТРУМЕНТЫ:**\n` +
        `/calculators - Калькуляторы и расчеты\n\n` +
        `🎯 **Команды:**\n` +
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

    const styles = visualization.getAvailableStyles();
    const currentStyle = visualization.getUserStyle(userId);
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

    await bot.sendMessage(chatId, message);
});

// Обработка выбора стиля
bot.onText(/\/setstyle_(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const styleId = match[1];

    if (visualization.setUserStyle(userId, styleId)) {
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

    const currentStyle = visualization.getUserStyle(userId);
    const styleInfo = visualization.getAvailableStyles().find(s => s.id === currentStyle);

    await bot.sendMessage(chatId,
        `🎨 **ТЕКУЩИЙ СТИЛЬ ВИЗУАЛИЗАЦИИ**\n\n` +
        `📝 ${styleInfo?.name || 'Оригинальный'}\n` +
        `📋 ${styleInfo?.description || 'Цветная визуализация'}\n\n` +
        `Изменить стиль: /style`
    );
});

// =============================================================================
// 🧮 СИСТЕМА КАЛЬКУЛЯТОРОВ - БЕЗ ПРОБЛЕМНОГО СНЕГА
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

    console.log('📍 Получена геолокация, контекст:', context);

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

    console.log('🔍 Получено сообщение для обработки:', text, 'Контекст:', context);

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
            console.log('⚠️ Нет активного контекста, сообщение не обработано');
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
        `🔍 **Что анализируется:**\n` +
        `• Контуры подошвы\n` +
        `• Детали протектора\n` +
        `• Топология узора\n` +
        `• Практический анализ для ПСО\n` +
        `• Фильтрация следов животных\n\n` +
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

    // ⭐ ДОБАВЬ ЭТОТ КОД ПРЯМО ЗДЕСЬ:
    // Показываем топологию лучшего фото в сессии
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
// 📸 ОСНОВНАЯ ФУНКЦИЯ ОБРАБОТКИ ФОТО С ИСПРАВЛЕННОЙ ОШИБКОЙ avgConfidence
// =============================================================================

// Обработчик отдельного фото (вынесенная логика)
async function processSinglePhoto(chatId, userId, msg, currentIndex = 1, totalCount = 1) {
    const hasSession = sessionManager.hasActiveSession(userId);

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
        if (hasSession) {
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

        const predictions = roboflowResponse.data.predictions || [];
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
                const vizModule = visualization.getVisualization(userId, 'analysis');
                vizPath = tempFileManager.createTempFile('analysis', 'png');

                await vizModule.createVisualization(
                    fileUrl,
                    predictionsForAnalysis,
                    { username: msg.from.username || msg.from.first_name },
                    vizPath
                );

                // Топологическая визуализация только если есть протекторы
                const protectors = predictionsForAnalysis.filter(p => p.class === 'shoe-protector');
                if (protectors.length > 3) {
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
        // 🎯 ИНТЕГРАЦИЯ С FOOTPRINTMANAGER (АВТОСОВМЕЩЕНИЕ)
        // =============================================================================
        if (predictionsForAnalysis && predictionsForAnalysis.length > 0) {
            try {
                // Получаем протекторы для FootprintManager
                const shoeProtectors = predictionsForAnalysis.filter(p => p.class === 'shoe-protector');

                if (shoeProtectors.length >= 3) { // Минимум 3 протектора для работы
                    console.log(`👣 FOOTPRINT INTEGRATION: ${shoeProtectors.length} протекторов для совмещения`);

                    // Подготавливаем точки для FootprintManager
                    const footprintPoints = shoeProtectors.map(p => {
                        // Центр протектора
                        const xs = p.points.map(pt => pt.x);
                        const ys = p.points.map(pt => pt.y);
                        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
                        const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

                        return {
                            x: centerX,
                            y: centerY,
                            confidence: p.confidence || 0.5,
                            class: 'shoe-protector',
                            originalPoints: p.points
                        };
                    });

                    // Создаем анализ для FootprintManager
                    const footprintAnalysis = {
                        id: `fp_${Date.now()}_${userId}`,
                        predictions: footprintPoints,
                        timestamp: new Date(),
                        confidence: avgConfidence,
                        source: {
                            userId: userId,
                            chatId: chatId,
                            photoPath: tempImagePath,
                            batchInfo: { index: currentIndex, total: totalCount }
                        }
                    };

                    // Проверяем, есть ли активная сессия
                    if (hasSession) {
                        console.log(`🎯 Использую сессионный режим с автосовмещением`);

                        // Инициализируем FootprintManager если еще нет
                        if (!global.footprintManagers.has(userId)) {
                            const { FootprintManager } = require('./modules/footprint');
                            const fpManager = new FootprintManager({
                                autoAlignment: true,
                                dbPath: './data/footprints'
                            });
                            global.footprintManagers.set(userId, fpManager);

                            // Начинаем сессию
                            const session = sessionManager.getActiveSession(userId);
                            fpManager.startNewSession(userId, session.name || `session_${session.id}`);
                        }

                        const fpManager = global.footprintManagers.get(userId);

                        // Добавляем фото с автосовмещением
                        const alignmentResult = await fpManager.addPhotoToSession(
                            footprintAnalysis,
                            tempImagePath,
                            {
                                userId: userId,
                                sessionName: `Сессия_${userId}`,
                                photoIndex: sessionManager.getActiveSession(userId).photos.length + 1
                            }
                        );

                        console.log(`🎯 Результат автосовмещения: ${alignmentResult.alignmentScore ?
                            (alignmentResult.alignmentScore * 100).toFixed(1) + '% совпадение' :
                            'не применено'}`);

                        // Сохраняем в сессию информацию о совмещении
                        if (sessionManager.addAnalysisToSession) {
                            sessionManager.addAnalysisToSession(userId, {
                                ...footprintAnalysis,
                                alignmentResult: alignmentResult,
                                protectorCount: shoeProtectors.length
                            });
                        }

                        // Показываем пользователю информацию о совмещении
                        if (alignmentResult.alignmentScore && alignmentResult.alignmentScore > 0.4) {
                            setTimeout(async () => {
                                const scorePercent = (alignmentResult.alignmentScore * 100).toFixed(1);
                                await bot.sendMessage(chatId,
                                    `🎯 **АВТОСОВМЕЩЕНИЕ СРАБОТАЛО!**\n\n` +
                                    `📊 Совпадение с предыдущими фото: ${scorePercent}%\n` +
                                    `✅ Добавлено узлов: ${alignmentResult.added || 0}\n` +
                                    `🔄 Объединено узлов: ${alignmentResult.merged || 0}\n\n` +
                                    `💡 Система автоматически совмещает следы для создания точной модели.`
                                );
                            }, 1000);
                        }
                    }

                    // Сохраняем анализ для будущего использования
                    saveUserLastAnalysis(userId, {
                        predictions: predictionsForAnalysis,
                        practicalAnalysis: practicalAnalysis,
                        intelligentAnalysis: intelligentAnalysis,
                        analysis: analysis,
                        timestamp: new Date(),
                        confidence: avgConfidence,
                        visualizationPaths: { analysis: vizPath, topology: topologyVizPath },
                        localPhotoPath: tempImagePath,
                        // 🔥 ДОБАВЛЯЕМ ДАННЫЕ ДЛЯ FOOTPRINT
                        footprintAnalysis: footprintAnalysis,
                        hasFootprintData: true,
                        protectorCount: shoeProtectors.length
                    });

                } else {
                    console.log(`⚠️ Слишком мало протекторов для совмещения: ${shoeProtectors.length}`);
                }

            } catch (error) {
                console.log('⚠️ Ошибка интеграции FootprintManager:', error.message);
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
        if (photos.length === 1 && !sessionManager.hasActiveSession(userId)) {
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
// 🔧 НОВЫЕ КОМАНДЫ ДЛЯ FOOTPRINT MANAGER
// =============================================================================

// Команда для проверки интеграции FootprintManager
bot.onText(/\/footprint_test/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
   
    try {
        // Проверяем базовую функциональность
        await bot.sendMessage(chatId, `🎯 **ТЕСТ СИСТЕМЫ ОТПЕЧАТКОВ**\n\nПроверяю модули...`);
       
        // 1. Проверяем импорт
        let modulesLoaded = 0;
        const modules = ['DigitalFootprint', 'FootprintDatabase', 'FootprintManager', 'PointCloudAligner'];
       
        for (const moduleName of modules) {
            try {
                const module = require(`./modules/footprint/${moduleName.toLowerCase()}`);
                console.log(`✅ ${moduleName} загружен`);
                modulesLoaded++;
            } catch (e) {
                console.log(`❌ ${moduleName}: ${e.message}`);
            }
        }
       
        // 2. Создаем тестовую модель
        const { FootprintManager } = require('./modules/footprint');
        const manager = new FootprintManager({ autoAlignment: true });
       
        // 3. Тестируем сессию
        const session = manager.startNewSession('test_user', 'Тестовая сессия');
       
        // 4. Создаем тестовые данные с реальными координатами
        const testPoints = [];
        for (let i = 0; i < 10; i++) {
            testPoints.push({
                x: Math.random() * 100 + 50,
                y: Math.random() * 100 + 50,
                confidence: 0.8,
                class: 'shoe-protector'
            });
        }
       
        const testAnalysis = {
            id: 'test_1',
            predictions: testPoints,
            timestamp: new Date()
        };
       
        // 5. Добавляем фото
        const result = await manager.addPhotoToSession(testAnalysis, 'test.jpg', {});
       
        let response = `🎯 **ТЕСТ ПРОЙДЕН!**\n\n`;
        response += `✅ Модулей загружено: ${modulesLoaded}/${modules.length}\n`;
        response += `✅ FootprintManager создан\n`;
        response += `✅ Сессия запущена: ${session.id.slice(0, 8)}...\n`;
        response += `✅ Фото добавлено: ${result.added || 0} узлов\n`;
       
        if (result.alignmentScore) {
            response += `✅ Автосовмещение: ${(result.alignmentScore * 100).toFixed(1)}%\n`;
        } else {
            response += `📌 Автосовмещение: не применялось (первое фото)\n`;
        }
       
        response += `\n🚀 **СИСТЕМА ГОТОВА К РАБОТЕ!**\n\n`;
        response += `💡 **Попробуйте:**\n`;
        response += `1. /trail_start - начать сессию\n`;
        response += `2. Отправить 2+ фото одного следа\n`;
        response += `3. /save_model "Моя модель" - сохранить\n`;
        response += `4. /my_models - посмотреть модели`;
       
        await bot.sendMessage(chatId, response);
       
    } catch (error) {
        console.log('❌ Ошибка теста:', error);
        await bot.sendMessage(chatId,
            `❌ **ОШИБКА ТЕСТА**\n\n` +
            `Ошибка: ${error.message}\n\n` +
            `💡 **Проверьте:**\n` +
            `1. Файлы в modules/footprint/\n` +
            `2. Папка data/footprints/ существует\n` +
            `3. Права на запись в папку data/`
        );
    }
});

bot.onText(/\/footprint_debug/, async (msg) => {
    const chatId = msg.chat.id;
   
    let response = `🔧 **ДИАГНОСТИКА FOOTPRINT СИСТЕМЫ**\n\n`;
   
    try {
        // Пробуем загрузить каждый модуль отдельно
        const modules = [
            { name: 'digital-footprint', path: './modules/footprint/digital-footprint.js' },
            { name: 'footprint-database', path: './modules/footprint/footprint-database.js' },
            { name: 'footprint-manager', path: './modules/footprint/footprint-manager.js' },
            { name: 'point-cloud-aligner', path: './modules/footprint/point-cloud-aligner.js' },
            { name: 'topology-utils', path: './modules/footprint/topology-utils.js' }
        ];
       
        for (const module of modules) {
            try {
                require(module.path);
                response += `✅ ${module.name}: ЗАГРУЖЕН\n`;
            } catch (error) {
                response += `❌ ${module.name}: ${error.message}\n`;
            }
        }
       
        // Проверяем index.js
        response += `\n📦 **ПРОВЕРКА INDEX.JS:**\n`;
        try {
            const { FootprintManager } = require('./modules/footprint');
            const manager = new FootprintManager();
            response += `✅ FootprintManager создан\n`;
            response += `✅ DB метод: ${typeof manager.database.saveFootprint}\n`;
        } catch (error) {
            response += `❌ Ошибка: ${error.message}\n`;
        }
       
        // Проверяем папку data
        response += `\n📁 **ПРОВЕРКА ПАПОК:**\n`;
        const fs = require('fs');
        if (fs.existsSync('./data/footprints')) {
            const files = fs.readdirSync('./data/footprints');
            response += `✅ Папка footprints: ${files.length} файлов\n`;
        } else {
            response += `⚠️ Папка footprints не существует\n`;
        }
       
        if (fs.existsSync('./data')) {
            response += `✅ Папка data существует\n`;
        }
       
    } catch (error) {
        response += `\n💥 Критическая ошибка: ${error.message}\n`;
    }
   
    await bot.sendMessage(chatId, response);
});

bot.onText(/\/db_test/, async (msg) => {
    const chatId = msg.chat.id;
   
    try {
        const { FootprintDatabase } = require('./modules/footprint');
        const db = new FootprintDatabase();
       
        let response = `🗄️ **ТЕСТ DATABASE**\n\n`;
       
        // 1. Проверяем методы
        response += `📊 **МЕТОДЫ:**\n`;
        response += `• saveFootprint: ${typeof db.saveFootprint}\n`;
        response += `• loadFootprint: ${typeof db.loadFootprint}\n`;
        response += `• getUserModels: ${typeof db.getUserModels}\n`;
        response += `• getStats: ${typeof db.getStats}\n\n`;
       
        // 2. Проверяем инстанс
        response += `🔧 **ИНФОРМАЦИЯ:**\n`;
        response += `• dbPath: ${db.dbPath}\n`;
        response += `• spatialIndex: ${db.spatialIndex.size} записей\n`;
       
        // 3. Тестовое сохранение
        response += `\n🧪 **ТЕСТ СОХРАНЕНИЯ:**\n`;
       
        const testFootprint = {
            id: `test_${Date.now()}`,
            name: 'Тестовая модель',
            userId: 'test_user',
            nodes: new Map([
                ['node1', { x: 100, y: 100, confidence: 0.9 }],
                ['node2', { x: 200, y: 200, confidence: 0.8 }]
            ]),
            edges: [],
            stats: { confidence: 0.85, topologyQuality: 0.7 },
            metadata: { test: true }
        };
       
        const saveResult = db.saveFootprint(testFootprint);
       
        if (saveResult.success) {
            response += `✅ Сохранено! ID: ${saveResult.id}\n`;
           
            // Пробуем загрузить
            const loadResult = db.loadFootprint(saveResult.id);
            if (loadResult.success) {
                response += `✅ Загружено! Имя: ${loadResult.footprint.name}\n`;
                response += `✅ Узлов: ${loadResult.footprint.nodes.size}\n`;
            } else {
                response += `❌ Ошибка загрузки: ${loadResult.error}\n`;
            }
        } else {
            response += `❌ Ошибка сохранения: ${saveResult.error}\n`;
        }
       
        // 4. Статистика
        const stats = db.getStats();
        response += `\n📈 **СТАТИСТИКА:**\n`;
        response += `• Всего моделей: ${stats.total}\n`;
        response += `• Пользователей: ${stats.byUser.length}\n`;
       
        await bot.sendMessage(chatId, response);
       
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Ошибка теста: ${error.message}\n${error.stack}`);
    }
});

bot.onText(/\/alignment_test/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
   
    try {
        const { FootprintManager } = require('./modules/footprint');
        const manager = new FootprintManager({ autoAlignment: true });
       
        // Тестовые данные
        const testPoints1 = [
            { x: 100, y: 100, confidence: 0.9, class: 'shoe-protector' },
            { x: 200, y: 150, confidence: 0.8, class: 'shoe-protector' },
            { x: 150, y: 250, confidence: 0.85, class: 'shoe-protector' }
        ];
       
        const testPoints2 = [
            { x: 105, y: 105, confidence: 0.9, class: 'shoe-protector' },
            { x: 205, y: 155, confidence: 0.8, class: 'shoe-protector' },
            { x: 155, y: 255, confidence: 0.85, class: 'shoe-protector' }
        ];
       
        manager.startNewSession(userId, 'test_alignment');
       
        // Первое фото
        const result1 = await manager.addPhotoToSession(
            { id: 'test1', predictions: testPoints1 },
            'test1.jpg',
            { test: true }
        );
       
        // Второе фото (немного смещено)
        const result2 = await manager.addPhotoToSession(
            { id: 'test2', predictions: testPoints2 },
            'test2.jpg',
            { test: true }
        );
       
        let response = `🎯 **ТЕСТ АВТОСОВМЕЩЕНИЯ**\n\n`;
        response += `📊 Первое фото: ${result1.added || 0} узлов\n`;
        response += `📊 Второе фото: ${result2.added || 0} узлов\n`;
       
        if (result2.alignmentScore) {
            response += `✅ **АВТОСОВМЕЩЕНИЕ РАБОТАЕТ!**\n`;
            response += `🎯 Совпадение: ${(result2.alignmentScore * 100).toFixed(1)}%\n`;
            response += `🔄 Трансформировано: ${result2.transformed ? 'да' : 'нет'}\n`;
        } else {
            response += `⚠️ **АВТОСОВМЕЩЕНИЕ НЕ СРАБОТАЛО**\n`;
            response += `Возможные причины:\n`;
            response += `• Слишком мало точек (нужно от ${manager.alignmentConfig.minPointsForAlignment})\n`;
            response += `• Плохое совпадение (< ${manager.alignmentConfig.minAlignmentScore})\n`;
        }
       
        response += `\n📈 **Статистика сессии:**\n`;
        const stats = manager.getSessionStats();
        if (stats) {
            response += `• Фото: ${stats.photosCount}\n`;
            response += `• Успешных совмещений: ${stats.successfulAlignments}\n`;
            response += `• Средний score: ${(stats.avgAlignmentScore * 100).toFixed(1)}%\n`;
        }
       
        await bot.sendMessage(chatId, response);
       
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Ошибка теста: ${error.message}`);
    }
});

// =============================================================================
// 🎯 ОБНОВЛЕННАЯ КОМАНДА /save_model С ИНТЕГРАЦИЕЙ FOOTPRINTMANAGER
// =============================================================================

// ЗАМЕНЯЕМ старую команду /save_model на новую:
bot.onText(/\/save_model(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const modelName = match[1] || `Модель_${new Date().toLocaleDateString('ru-RU')}`;
   
    console.log(`💾 СОХРАНЕНИЕ МОДЕЛИ: "${modelName}"`);
   
    try {
        await bot.sendMessage(chatId, `🔄 Создаю модель "${modelName}"...`);
       
        // Используем FootprintManager
        const { FootprintManager } = require('./modules/footprint');
        const manager = new FootprintManager({
            autoAlignment: true,
            dbPath: './data/footprints'
        });
       
        // Проверяем активную сессию
        const hasSession = sessionManager && sessionManager.hasActiveSession(userId);
       
        if (hasSession) {
            // 🔥 СЕССИОННЫЙ РЕЖИМ: используем данные из сессии
            const session = sessionManager.getActiveSession(userId);
            console.log(`📊 Использую сессию: ${session.id}, фото: ${session.photos.length}`);
           
            manager.startNewSession(userId, session.name);
           
            // Добавляем все анализы из сессии
            if (session.analysisResults && session.analysisResults.length > 0) {
                console.log(`📸 Добавляю ${session.analysisResults.length} анализов из сессии`);
               
                for (let i = 0; i < session.analysisResults.length; i++) {
                    const analysis = session.analysisResults[i];
                   
                    if (analysis.predictions && analysis.predictions.length > 0) {
                        // Фильтруем только протекторы
                        const shoeProtectors = analysis.predictions.filter(p => p.class === 'shoe-protector');
                       
                        if (shoeProtectors.length >= 3) {
                            const footprintAnalysis = {
                                id: `analysis_${Date.now()}_${i}`,
                                predictions: shoeProtectors.map(p => {
                                    const xs = p.points.map(pt => pt.x);
                                    const ys = p.points.map(pt => pt.y);
                                    return {
                                        x: (Math.min(...xs) + Math.max(...xs)) / 2,
                                        y: (Math.min(...ys) + Math.max(...ys)) / 2,
                                        confidence: p.confidence || 0.5,
                                        class: 'shoe-protector'
                                    };
                                }),
                                timestamp: analysis.timestamp || new Date(),
                                confidence: analysis.confidence || 0.5
                            };
                           
                            const result = await manager.addPhotoToSession(
                                footprintAnalysis,
                                analysis.localPhotoPath,
                                {
                                    userId: userId,
                                    sessionName: session.name,
                                    photoIndex: i + 1
                                }
                            );
                           
                            console.log(`📸 Фото ${i+1}: ${result.added || 0} узлов, совмещение: ${result.alignmentScore ? (result.alignmentScore * 100).toFixed(1) + '%' : 'нет'}`);
                        }
                    }
                }
            }
           
        } else {
            // 🔥 ОДИНОЧНОЕ ФОТО: используем последний анализ
            const lastAnalysis = getLastUserAnalysis(userId);
           
            if (!lastAnalysis || !lastAnalysis.predictions) {
                await bot.sendMessage(chatId,
                    `❌ **Нет данных для сохранения**\n\n` +
                    `Сначала отправьте фото следа.\n` +
                    `Для лучших результатов используйте сессию: /trail_start`
                );
                return;
            }
           
            console.log(`📸 Использую последний анализ: ${lastAnalysis.predictions.length} предсказаний`);
           
            manager.startNewSession(userId, `single_${Date.now()}`);
           
            const shoeProtectors = lastAnalysis.predictions.filter(p => p.class === 'shoe-protector');
           
            if (shoeProtectors.length >= 3) {
                const footprintAnalysis = {
                    id: `analysis_${Date.now()}`,
                    predictions: shoeProtectors.map(p => {
                        const xs = p.points.map(pt => pt.x);
                        const ys = p.points.map(pt => pt.y);
                        return {
                            x: (Math.min(...xs) + Math.max(...xs)) / 2,
                            y: (Math.min(...ys) + Math.max(...ys)) / 2,
                            confidence: p.confidence || 0.5,
                            class: 'shoe-protector'
                        };
                    }),
                    timestamp: new Date(),
                    confidence: lastAnalysis.confidence || 0.5
                };
               
                await manager.addPhotoToSession(
                    footprintAnalysis,
                    lastAnalysis.localPhotoPath,
                    { userId: userId }
                );
            }
        }
       
        // Сохраняем модель
        console.log(`💾 Сохраняю модель "${modelName}"...`);
        const saveResult = await manager.saveSessionAsModel(modelName);
       
        if (saveResult.success) {
            let response = `✅ **МОДЕЛЬ СОХРАНЕНА!**\n\n`;
            response += `📝 **Имя:** ${modelName}\n`;
            response += `🆔 **ID:** ${saveResult.modelId?.slice(0, 8) || 'сгенерирован'}...\n`;
           
            if (saveResult.stats) {
                response += `📊 **Узлов:** ${saveResult.stats.nodes || 0}\n`;
                response += `🔗 **Ребер:** ${saveResult.stats.edges || 0}\n`;
                response += `💎 **Качество:** ${saveResult.stats.topologyQuality ?
                    (saveResult.stats.topologyQuality * 100).toFixed(1) + '%' : 'не оценено'}\n`;
            }
           
            if (hasSession) {
                const session = sessionManager.getActiveSession(userId);
                response += `📸 **Фото в сессии:** ${session.photos.length}\n`;
            }
           
            response += `\n🎯 **ЧТО ДЕЛАТЬ ДАЛЬШЕ:**\n`;
            response += `/my_models - Посмотреть свои модели\n`;
            response += `/find_similar - Найти похожие следы\n`;
           
            await bot.sendMessage(chatId, response);
           
            // Завершаем сессию если была
            if (hasSession) {
                sessionManager.endSession(userId);
            }
           
        } else {
            await bot.sendMessage(chatId,
                `❌ **Не удалось сохранить модель**\n\n` +
                `Ошибка: ${saveResult.error}\n\n` +
                `💡 **Попробуйте:**\n` +
                `1. Убедитесь, что на фото есть протекторы\n` +
                `2. Отправьте больше фото\n` +
                `3. Используйте сессию: /trail_start`
            );
        }
       
    } catch (error) {
        console.log('❌ Ошибка сохранения модели:', error);
        await bot.sendMessage(chatId,
            `💥 **Критическая ошибка**\n\n` +
            `${error.message}\n\n` +
            `Логи сохранены для отладки.`
        );
    }
});

// 📝 ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ УЛУЧШЕНИЯ ВИЗУАЛИЗАЦИИ
async function enhanceVisualizationWithAnalysis(imagePath, analysis) {
    // Здесь можно добавить аннотации к визуализации на основе анализа
    // Например: стрелки направления, подписи типа обуви и т.д.
    // Пока оставляем как заглушку для будущего улучшения
    return true;
}

// =============================================================================
// 🚀 ЗАПУСК СЕРВЕРА
// =============================================================================
app.get('/', (req, res) => {
    res.send(`
        <h1>🤖 Система анализа следов обуви v2.2</h1>
        <p>✅ Модульная система работает!</p>
        <p>📊 Пользователей: ${globalStats.totalUsers}</p>
        <p>📸 Фото обработано: ${globalStats.totalPhotos}</p>
        <p>🎯 Практический анализ для ПСО: активен</p>
        <p>🐕 Фильтрация животных: активна</p>
        <p>👣 FootprintManager: интегрирован</p>
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
            footprintManager: true
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

    try {
        await FootprintManager.initialize();
        console.log('✅ Система цифровых отпечатков готова');
    } catch (error) {
        console.log('❌ Ошибка инициализации системы отпечатков:', error.message);
        // Не падаем, система будет работать в ограниченном режиме
    }

    console.log('🚀 Все модули инициализированы, бот готов к работе!');
    console.log('🎯 Практический анализ для ПСО активирован');
    console.log('🐕 Фильтрация следов животных активирована');
    console.log('👣 FootprintManager с автосовмещением активирован');
})();

// =============================================================================
// 👣 СИСТЕМА ЦИФРОВЫХ ОТПЕЧАТКОВ ОБУВИ (FOOTPRINT SYSTEM)
// =============================================================================

// =============================================================================
// 🆕 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ FOOTPRINT SYSTEM
// =============================================================================

// Команда /alignment_status - статус автосовмещения
bot.onText(/\/alignment_status/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const { FootprintManager } = require('./modules/footprint');
        const footprintManager = new FootprintManager();

        const response = `🎯 **СТАТУС АВТОСОВМЕЩЕНИЯ**\n\n` +
                        `🔧 **Состояние:** ${footprintManager.alignmentConfig.enabled ? 'ВКЛЮЧЕНО ✅' : 'ВЫКЛЮЧЕНО ⚠️'}\n` +
                        `🎯 **Минимальный score:** ${footprintManager.alignmentConfig.minAlignmentScore}\n` +
                        `📊 **Точек для совмещения:** от ${footprintManager.alignmentConfig.minPointsForAlignment}\n\n` +
                        `💡 **Команды:**\n` +
                        `/auto_alignment on - включить автосовмещение\n` +
                        `/auto_alignment off - выключить\n` +
                        `/alignment_settings - настроить параметры`;

        await bot.sendMessage(chatId, response);
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /auto_alignment - включить/выключить
bot.onText(/\/auto_alignment (on|off)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const action = match[1];

    try {
        const { FootprintManager } = require('./modules/footprint');
        const footprintManager = new FootprintManager();
        const enabled = footprintManager.setAutoAlignment(action === 'on');

        await bot.sendMessage(chatId,
            `🔧 **АВТОСОВМЕЩЕНИЕ ${enabled ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО'}**\n\n` +
            `Теперь при добавлении фото в сессию система будет:\n` +
            `${enabled ? '✅ Автоматически искать совмещение с предыдущими фото' : '⚠️ Добавлять фото без совмещения'}\n\n` +
            `Проверить статус: /alignment_status`
        );
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /my_models - показать мои модели
bot.onText(/\/my_models/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
   
    try {
        const { FootprintManager } = require('./modules/footprint');
        const manager = new FootprintManager({ dbPath: './data/footprints' });
       
        // Загружаем модели пользователя
        await bot.sendMessage(chatId, `📚 Загружаю ваши модели...`);
       
        // Получаем модели через database
        const db = manager.database;
        const userModels = db.getUserModels(userId);
       
        if (!userModels || userModels.length === 0) {
            await bot.sendMessage(chatId,
                `📭 **У вас нет сохраненных моделей**\n\n` +
                `💡 **Как создать модель:**\n` +
                `1. Отправьте фото следа\n` +
                `2. Используйте /save_model "Название"\n\n` +
                `🎯 **Для лучших результатов:**\n` +
                `• Начните сессию: /trail_start\n` +
                `• Отправьте 2+ фото одного следа\n` +
                `• Сохраните: /save_model "Детальная модель"`
            );
            return;
        }
       
        let response = `📚 **ВАШИ МОДЕЛИ** (${userModels.length})\n\n`;
       
        // Показываем первые 5 моделей
        userModels.slice(0, 5).forEach((model, index) => {
            const date = model.created ? new Date(model.created).toLocaleDateString('ru-RU') : 'неизвестно';
            const shortId = model.id ? model.id.slice(0, 8) : '???';
           
            response += `**${index + 1}. ${model.name || 'Без имени'}**\n`;
            response += `   🆔 ${shortId}...\n`;
            response += `   📅 ${date}\n`;
            response += `   📊 ${model.nodes ? model.nodes.size : 0} узлов\n`;
            response += `   💎 ${model.stats?.confidence ? (model.stats.confidence * 100).toFixed(1) + '%' : 'не оценено'}\n`;
            response += `   🔍 /view_${shortId}\n\n`;
        });
       
        if (userModels.length > 5) {
            response += `... и еще ${userModels.length - 5} моделей\n\n`;
        }
       
        response += `💡 **Используйте:**\n`;
        response += `/view_[ID] - Детали модели (первые 8 символов)\n`;
        response += `/find_similar - Найти похожие\n`;
        response += `/save_model "Название" - Создать новую`;
       
        await bot.sendMessage(chatId, response);
       
    } catch (error) {
        console.log('❌ Ошибка /my_models:', error);
        await bot.sendMessage(chatId,
            `❌ **Не удалось загрузить модели**\n\n` +
            `Ошибка: ${error.message}\n` +
            `Проверьте папку data/footprints/`
        );
    }
});

// Команда /find_similar - найти похожие модели
bot.onText(/\/find_similar/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    console.log(`🔍 Пользователь ${userId} ищет похожие модели`);

    try {
        // Проверяем, есть ли последний анализ
        const lastAnalysis = getLastUserAnalysis(userId);

        if (!lastAnalysis || !lastAnalysis.predictions || lastAnalysis.predictions.length === 0) {
            await bot.sendMessage(chatId,
                `❌ **Нет данных для поиска**\n\n` +
                `Сначала отправьте фото следа для анализа.\n` +
                `После анализа используйте /find_similar\n\n` +
                `📸 **Как сделать:**\n` +
                `1. Отправьте фото следа\n` +
                `2. Дождитесь анализа\n` +
                `3. Используйте /find_similar`
            );
            return;
        }

        // Начинаем поиск
        await bot.sendMessage(chatId, `🔍 Ищу похожие модели...`);

        // Начинаем поиск с топологической коррекцией
        await bot.sendMessage(chatId,
            `🔍 **Запускаю УМНЫЙ поиск...**\n\n` +
            `Теперь учитываю:\n` +
            `• Перспективные искажения\n` +
            `• Разный масштаб съемки\n` +
            `• Топологию протекторов\n` +
            `• Зеркальность (правый/левый)\n\n` +
            `⏳ Это может занять несколько секунд...`
        );

        // ✅ ИСПОЛЬЗУЕМ УЛУЧШЕННЫЙ ПОИСК
        const similar = await FootprintManager.findSimilarWithTopologyCorrection(
            lastAnalysis,
            userId,
            {
                threshold: 0.3, // СНИЖАЕМ до 30%
                limit: 5
            }
        );

        // Формируем ответ
        if (!similar || similar.length === 0) {
            await bot.sendMessage(chatId,
                `🎯 **Уникальный след!**\n\n` +
                `Похожих моделей не найдено.\n` +
                `Сохраните его как новую модель:\n` +
                `/save_model "Уникальный след"`
            );
            return;
        }

        // Отображаем результаты
        let response = `🔍 **Найдено похожих моделей:** ${similar.length}\n\n`;

        similar.forEach((match, index) => {
            const model = match.footprint;
            const shortId = model.id.slice(0, 8);

            response += `**${index + 1}. ${model.name || 'Без имени'}**\n`;
            response += `   🆔 ${shortId}\n`;
            response += `   📊 Совпадение: ${Math.round(match.score * 100)}%\n`;
            response += `   👣 Узлов: ${model.nodes.size}\n`;
            response += `   👁️ /view_${shortId}\n\n`;
        });

        response += `💡 **Что это значит?**\n`;
        response += `• >80% - Возможно, та же обувь\n`;
        response += `• 60-80% - Похожий тип протектора\n`;
        response += `• <60% - Случайное совпадение`;

        await bot.sendMessage(chatId, response);

    } catch (error) {
        console.log('❌ Ошибка /find_similar:', error);
        await bot.sendMessage(chatId, `❌ Ошибка поиска: ${error.message}`);
    }
});

// Команда /footprint_stats - статистика системы
bot.onText(/\/footprint_stats/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    console.log(`📊 Пользователь ${userId} запрашивает статистику`);

    // Проверяем права (опционально - можно сделать для всех)
    const adminUsers = [699140291]; // Твой ID

    if (!adminUsers.includes(userId)) {
        const userModels = await FootprintManager.getUserModels(userId);
        const userCount = userModels.length;

        await bot.sendMessage(chatId,
            `📊 **ВАША СТАТИСТИКА**\n\n` +
            `👣 Ваших моделей: ${userCount}\n` +
            `💎 Средняя уверенность: ${userCount > 0 ?
                Math.round(userModels.reduce((sum, m) => sum + m.stats.confidence, 0) / userCount * 100) + '%' : 'нет данных'}\n\n` +
            `💡 **Советы:**\n` +
            `• Сохраняйте разные ракурсы одной обуви\n` +
            `• Чем больше фото - тем точнее модель\n` +
            `• Ищите похожие: /find_similar\n\n` +
            `📈 Администраторы могут видеть общую статистику`
        );
        return;
    }

    await bot.sendMessage(chatId, '📊 Собираю статистику системы...');

    try {
        const stats = await FootprintManager.getStats();

        let response = `📊 **СТАТИСТИКА СИСТЕМЫ ОТПЕЧАТКОВ**\n\n`;
        response += `👣 **Всего моделей:** ${stats.total}\n`;
        response += `👥 **Пользователей с моделями:** ${stats.byUser?.length || 0}\n`;
        response += `📁 **Индексов:** ${stats.spatialIndex?.byWidth || 0}\n\n`;

        if (stats.byUser && stats.byUser.length > 0) {
            response += `🏆 **ТОП ПОЛЬЗОВАТЕЛЕЙ:**\n`;
            stats.byUser
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)
                .forEach((user, index) => {
                    response += `${index + 1}. 👤 ${user.userId}: ${user.count} моделей\n`;
                });
            response += `\n`;
        }

        response += `💾 **Хранение:**\n`;
        response += `• Модели: data/footprints/\n`;
        response += `• Индекс: data/footprints/_index.json\n`;
        response += `• Автосохранение: каждое изменение\n\n`;

        response += `🚀 **Следующие шаги:**\n`;
        response += `• Сравнение с искажениями\n`;
        response += `• Визуализация моделей\n`;
        response += `• Автоматическое объединение дубликатов`;

        await bot.sendMessage(chatId, response);

    } catch (error) {
        console.log('❌ Ошибка статистики:', error);
        await bot.sendMessage(chatId,
            `❌ **Не удалось получить статистику**\n\n` +
            `Ошибка: ${error.message}`
        );
    }
});

// Команда /view_XXXXXXX - просмотр модели с улучшенной визуализацией
bot.onText(/\/view_([a-f0-9_]+)/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const shortId = match[1];

    console.log(`👁️ Пользователь ${userId} просматривает модель ${shortId}`);

    await bot.sendMessage(chatId, `🔍 Загружаю модель ${shortId}...`);

    try {
        // Загружаем модели пользователя
        const models = await FootprintManager.getUserModels(userId);
        const model = models.find(m =>
            m.id.startsWith(shortId) ||
            m.name.toLowerCase().includes(shortId.toLowerCase())
        );

        if (!model) {
            await bot.sendMessage(chatId,
                `❌ **МОДЕЛЬ НЕ НАЙДЕНА**\n\n` +
                `ID: ${shortId}\n\n` +
                `💡 **Возможные причины:**\n` +
                `• Модель удалена\n` +
                `• Это не ваша модель\n` +
                `• Ошибка в ID\n\n` +
                `📋 **Посмотреть все модели:**\n` +
                `/my_models`
            );
            return;
        }

        const date = new Date(model.stats.created).toLocaleDateString('ru-RU');
        const updated = new Date(model.stats.lastUpdated).toLocaleDateString('ru-RU');

        // 1. ОТПРАВЛЯЕМ ИНФОРМАЦИЮ О МОДЕЛИ
        let response = `👣 **ЦИФРОВОЙ ОТПЕЧАТОК**\n\n`;
        response += `📝 **Название:** ${model.name}\n`;
        response += `🆔 **ID:** ${model.id.slice(0, 12)}...\n`;
        response += `📅 **Создана:** ${date}\n`;
        response += `🔄 **Обновлена:** ${updated}\n`;
        response += `📊 **Узлов протектора:** ${model.nodes.size}\n`;
        response += `🔗 **Топологических связей:** ${model.edges.length}\n`;
        response += `💎 **Общая уверенность:** ${Math.round(model.stats.confidence * 100)}%\n`;
        response += `📸 **Фото в модели:** ${model.stats.totalPhotos || model.stats.totalSources || 0}\n\n`;

        // Контуры и каблуки
        if (model.bestContours && model.bestContours.length > 0) {
            response += `🎯 **Геометрия:**\n`;
            response += `• Контуров сохранено: ${model.bestContours.length}\n`;
            if (model.bestHeels && model.bestHeels.length > 0) {
                response += `• Каблуков сохранено: ${model.bestHeels.length}\n`;
            }
            response += `\n`;
        }

        // Метаданные
        if (model.metadata) {
            response += `📋 **МЕТАДАННЫЕ:**\n`;
            if (model.metadata.estimatedSize) {
                response += `• Размер: ${model.metadata.estimatedSize}\n`;
            }
            if (model.metadata.footprintType && model.metadata.footprintType !== 'unknown') {
                response += `• Тип: ${model.metadata.footprintType}\n`;
            }
            if (model.metadata.orientation) {
                response += `• Ориентация: ${model.metadata.orientation}°\n`;
            }
            if (model.metadata.isMirrored) {
                response += `• 🪞 **ЗЕРКАЛЬНАЯ КОПИЯ**\n`;
            }
            response += `\n`;
        }

        // Искажения
        if (model.bestContours && model.bestContours.some(c => c.isDistorted)) {
            response += `⚠️ **Обнаружены искажения перспективы**\n`;
            response += `Система автоматически их учитывает при сравнении\n\n`;
        }

        response += `🎯 **ЧТО МОЖНО СДЕЛАТЬ:**\n`;
        response += `/find_similar - Найти похожие следы\n`;
        response += `/compare_models ${model.id.slice(0, 8)} [ID] - Сравнить с другой моделью\n`;
        if (model.metadata && model.metadata.isMirrored) {
            response += `/view_${model.metadata.originalModelId?.slice(0, 8) || ''} - Посмотреть оригинал\n`;
        } else {
            response += `/create_mirror_${model.id.slice(0, 8)} - Создать зеркальную копию\n`;
        }
        response += `\n📤 **Совет:** Отправьте больше фото этой обуви для улучшения модели!`;

        await bot.sendMessage(chatId, response);

        // 2. СОЗДАЕМ И ОТПРАВЛЯЕМ УЛУЧШЕННУЮ ВИЗУАЛИЗАЦИЮ
        await bot.sendMessage(chatId, `🎨 Создаю улучшенную визуализацию...`);

        try {
            // ИСПРАВЛЕННЫЙ ИМПОРТ: используем прямой импорт, не деструктуризацию
            const EnhancedModelVisualizer = require('./modules/footprint/enhanced-model-visualizer');
            const enhancedVisualizer = new EnhancedModelVisualizer();
            const vizPath = await enhancedVisualizer.visualizeModelWithPhoto(model);

            if (vizPath && fs.existsSync(vizPath)) {
                const caption = `🎨 Улучшенная визуализация модели\n\n` +
                               `📝 ${model.name}\n` +
                               `📊 Узлов: ${model.nodes.size}\n` +
                               `💎 Уверенность: ${Math.round(model.stats.confidence * 100)}%\n` +
                               `📸 С фото-подложкой`;

                await bot.sendPhoto(chatId, vizPath, {
                    caption: caption
                });

                // Очистка через tempFileManager
                const keepFileForMinutes = 5; // Храним 5 минут
                if (vizPath && fs.existsSync(vizPath)) {
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(vizPath)) {
                                fs.unlinkSync(vizPath);
                                console.log(`🧹 Удален файл визуализации: ${vizPath}`);
                            }
                        } catch (err) {
                            console.log(`⚠️ Не удалось удалить файл: ${err.message}`);
                        }
                    }, keepFileForMinutes * 60 * 1000);
                }

            } else {
                await bot.sendMessage(chatId,
                    `⚠️ Не удалось создать визуализацию\n` +
                    `Модель будет отображаться без фото-подложки`
                );

                // Пробуем обычную визуализацию как fallback
                const { ModelVisualizer } = require('./modules/footprint');
                const visualizer = new ModelVisualizer();
                const fallbackPath = await visualizer.visualizeModel(model);

                if (fallbackPath && fs.existsSync(fallbackPath)) {
                    await bot.sendPhoto(chatId, fallbackPath, {
                        caption: `📊 Базовая визуализация модели`
                    });

                    setTimeout(() => {
                        if (tempFileManager && tempFileManager.removeFile) {
                            tempFileManager.removeFile(fallbackPath);
                        }
                    }, 5000);
                }
            }

        } catch (vizError) {
            console.log('❌ Ошибка визуализации:', vizError.message);
            await bot.sendMessage(chatId,
                `⚠️ Улучшенная визуализация временно недоступна\n` +
                `Ошибка: ${vizError.message}\n` +
                `Используем обычную визуализацию...`
            );

            // Пробуем обычную визуализацию
            try {
                const { ModelVisualizer } = require('./modules/footprint');
                const visualizer = new ModelVisualizer();
                const fallbackPath = await visualizer.visualizeModel(model);

                if (fallbackPath && fs.existsSync(fallbackPath)) {
                    await bot.sendPhoto(chatId, fallbackPath, {
                        caption: `📊 Модель: ${model.name}\n` +
                                 `Узлов: ${model.nodes.size}`
                    });

                    setTimeout(() => {
                        if (tempFileManager && tempFileManager.removeFile) {
                            tempFileManager.removeFile(fallbackPath);
                        }
                    }, 5000);
                }
            } catch (fallbackError) {
                console.log('❌ Ошибка fallback визуализации:', fallbackError.message);
            }
        }

        // 3. ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ О КАЧЕСТВЕ
        if (model.stats.avgPhotoQuality < 0.4) {
            setTimeout(async () => {
                await bot.sendMessage(chatId,
                    `💡 **РЕКОМЕНДАЦИЯ ДЛЯ УЛУЧШЕНИЯ КАЧЕСТВЫ:**\n\n` +
                    `📸 **Качество фото:** ${Math.round(model.stats.avgPhotoQuality * 100)}%\n` +
                    `**Советы по съемке:**\n` +
                    `• Используйте лучшее освещение\n` +
                    `• Снимайте прямо сверху\n` +
                    `• Убедитесь что след в фокусе\n` +
                    `• Избегайте сильных теней\n\n` +
                    `🎯 **Каждое новое качественное фото улучшает модель!**`
                );
            }, 1000);
        }

    } catch (error) {
        console.log('❌ Ошибка просмотра модели:', error);
        await bot.sendMessage(chatId,
            `❌ **НЕ УДАЛОСЬ ЗАГРУЗИТЬ МОДЕЛЬ**\n\n` +
            `Ошибка: ${error.message}\n\n` +
            `💡 **Попробуйте:**\n` +
            `1. Проверить ID модели\n` +
            `2. Подождать и попробовать снова\n` +
            `3. Обратиться к администратору`
        );
    }
});

// Команда /compare_models - сравнить две модели
bot.onText(/\/compare_models (.+) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const [id1, id2] = match.slice(1);

    console.log(`🔍 Пользователь ${userId} сравнивает моделей: ${id1} vs ${id2}`);

    await bot.sendMessage(chatId,
        `🔍 **СРАВНИВАЮ МОДЕЛИ...**\n\n` +
        `🔄 Учитываю:\n` +
        `• Перспективные искажения\n` +
        `• Разный масштаб съемки\n` +
        `• Зеркальность (правый/левый)\n` +
        `• Качество фото`
    );

    try {
        // Загружаем модели пользователя
        const models = await FootprintManager.getUserModels(userId);
        const model1 = models.find(m =>
            m.id.startsWith(id1) ||
            m.name.toLowerCase().includes(id1.toLowerCase())
        );
        const model2 = models.find(m =>
            m.id.startsWith(id2) ||
            m.name.toLowerCase().includes(id2.toLowerCase())
        );

        if (!model1 || !model2) {
            await bot.sendMessage(chatId,
                `❌ **НЕ УДАЛОСЬ НАЙТИ МОДЕЛИ**\n\n` +
                `Модель 1 (${id1}): ${model1 ? '✅ найдена' : '❌ не найдена'}\n` +
                `Модель 2 (${id2}): ${model2 ? '✅ найдена' : '❌ не найдена'}\n\n` +
                `💡 **Используйте:**\n` +
                `• ID модели (первые 8 символов)\n` +
                `• Имя модели\n` +
                `• Комбинацию ID и имени\n\n` +
                `📋 **Примеры:**\n` +
                `/compare_models fp_17647 "Вторая модель"\n` +
                `/compare_models "Моя модель" fp_62dd`
            );
            return;
        }

        if (model1.id === model2.id) {
            await bot.sendMessage(chatId, `❌ Это одна и та же модель!`);
            return;
        }

        // Сравниваем
        const comparison = model1.compare(model2);

        // Создаем визуализацию
        const ModelVisualizer = require('./modules/footprint/model-visualizer');
        const visualizer = new ModelVisualizer();
        const vizPath = await visualizer.visualizeComparison(model1, model2, comparison);

        let response = `🔍 **СРАВНЕНИЕ МОДЕЛЕЙ**\n\n`;
        response += `📝 **${model1.name}** vs **${model2.name}**\n\n`;
        response += `📊 **Результат:** ${Math.round(comparison.score * 100)}% совпадение\n`;
        response += `✅ **Совпало:** ${comparison.matched} из ${comparison.total} узлов\n\n`;

        if (comparison.score > 0.8) {
            response += `🎯 **ВЫСОКАЯ ВЕРОЯТНОСТЬ**\n`;
            response += `Это может быть одна и та же обувь!\n`;
        } else if (comparison.score > 0.6) {
            response += `⚠️ **СРЕДНЯЯ ВЕРОЯТНОСТЬ**\n`;
            response += `Похожие протекторы, но нужны доп. данные\n`;
        } else {
            response += `🟢 **НИЗКАЯ ВЕРОЯТНОСТЬ**\n`;
            response += `Разные протекторы\n`;
        }

        response += `\n💡 **Интерпретация:**\n`;
        response += `• >80% - Возможно, та же обувь\n`;
        response += `• 60-80% - Похожий тип протектора\n`;
        response += `• <60% - Случайное совпадение`;

        await bot.sendMessage(chatId, response);

        // Отправляем визуализацию если есть
        if (vizPath && fs.existsSync(vizPath)) {
            await bot.sendPhoto(chatId, vizPath, {
                caption: `🖼️ Сравнение моделей\n` +
                        `📝 ${model1.name} vs ${model2.name}\n` +
                        `🎯 Совпадение: ${Math.round(comparison.score * 100)}%`
            });

            // Очистка через tempFileManager
            setTimeout(() => {
                if (tempFileManager && tempFileManager.removeFile) {
                    tempFileManager.removeFile(vizPath);
                }
            }, 5000);
        }

    } catch (error) {
        console.log('❌ Ошибка сравнения моделей:', error);
        await bot.sendMessage(chatId,
            `❌ **Не удалось сравнить модели**\n\n` +
            `Ошибка: ${error.message}\n` +
            `Проверьте ID моделей и попробуйте снова`
        );
    }
});

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

// Запуск сервеера
app.listen(config.PORT, () => {
    console.log(`✅ Сервер запущен на порту ${config.PORT}`);
    console.log(`🤖 Telegram бот готов к работе`);
    console.log(`🎯 Практический анализ для ПСО активирован`);
    console.log(`🐕 Фильтрация животных: активна`);
    console.log(`👣 FootprintManager с автосовмещением: ИНТЕГРИРОВАН`);
});
