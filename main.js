// =============================================================================
// 🎯 СИСТЕМА АНАЛИЗА СЛЕДОВ ОБУВИ - ОСНОВНОЙ ФАЙЛ
// =============================================================================
//
// 📋 СТАТУС: РАБОЧАЯ ВЕРСИЯ 2.1 - С ПРАКТИЧЕСКИМ АНАЛИЗОМ ДЛЯ ПСО
// ✅ ЧТО РАБОТАЕТ:
//   • Модульная система визуализации
//   • Анализ через Roboflow API
//   • Telegram бот с командами (/start, /help, /statistics)
//   • Canvas визуализация с выбором стилей (оригинальный/маска)
//   • Статистика пользователей
//   • Топологическая карта протектора
//   • 🆕 Практический анализ для ПСО
//   • 🆕 Фильтрация следов животных
//
// 🏗️ АРХИТЕКТУРА:
//   • Express.js сервер + Telegram Bot API
//   • Модульная структура в папке modules/
//   • Canvas для генерации визуализаций
//   • Roboflow для ML-анализа изображений
//   • Временные файлы в папке temp/
//
// 🔄 ПОСЛЕДНИЕ ИЗМЕНЕНИЯ:
//   • Добавлен практический анализ для ПСО
//   • Добавлен фильтр следов животных
//   • Улучшена логика обработки предсказаний
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
   
    // 🧑‍🤝‍🧑 АНАЛИЗ ЛЮДЕЙ
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
        if (topologyPath && require('fs').existsSync(topologyPath)) {
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
            `🔄 Новая сессия: /trail_start`
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
       
        if (require('fs').existsSync(topologyPath)) {
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
            const writer = require('fs').createWriteStream(tempImagePath);
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
let resultMessage = `✅ **АНАЛИЗ ЗАВЕРШЕН**\n\n`;
resultMessage += `📊 Обнаружено: ${analysis.total} объектов\n\n`;

// Классификация
resultMessage += `📋 **КЛАССИФИКАЦИЯ:**\n`;
Object.entries(analysis.classes).forEach(([className, count]) => {
    resultMessage += `• ${className}: ${count}\n`;
});

await bot.sendMessage(chatId, resultMessage);

// Визуализация
if (vizPath && require('fs').existsSync(vizPath)) {
    await bot.sendPhoto(chatId, vizPath, {
        caption: '🎨 Визуализация анализа'
    });
    tempFileManager.removeFile(vizPath);
}

// 🔥 ВЕРНУЛИ ТОПОЛОГИЧЕСКУЮ ВИЗУАЛИЗАЦИЮ ДЛЯ ОДИНОЧНОГО ФОТО
if (topologyVizPath && require('fs').existsSync(topologyVizPath)) {
    await bot.sendPhoto(chatId, topologyVizPath, {
        caption: '🕸️ **Топологический анализ протектора**\n' +
                 '• 🟢 Зеленые точки - центры протекторов\n' +
                 '• 🟠 Оранжевые линии - связи\n' +
                 '• 🔵 Синий пунктир - контур следа'
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
    const intelMessage = `🧠 **ИНТЕЛЛЕКТУАЛЬНЫЙ АНАЛИЗ:**\n\n` +
        `🧭 Ориентация: ${intelligentAnalysis.summary.orientation}\n` +
        `👟 Тип обуви: ${intelligentAnalysis.summary.footprintType}\n` +
        // `📏 Примерный размер: ${intelligentAnalysis.summary.sizeEstimation}\n` +
        `🔷 Морфология: ${intelligentAnalysis.summary.morphology}\n` +
        `🕸️ Топология: ${intelligentAnalysis.summary.topology}`;
   
    await bot.sendMessage(chatId, intelMessage);
}

  // 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥
    // 🔥 ВСТАВЬ КОД ОБРАТНОЙ СВЯЗИ ПРЯМО ЗДЕСЬ:
    // 🔥 ДОБАВЛЯЕМ ЗАПРОС ОБРАТНОЙ СВЯЗИ (только для одиночных фото с хорошими prediction)
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
    // 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥 🔥
          
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
        <h1>🤖 Система анализа следов обуви v2.1</h1>
        <p>✅ Модульная система работает!</p>
        <p>📊 Пользователей: ${globalStats.totalUsers}</p>
        <p>📸 Фото обработано: ${globalStats.totalPhotos}</p>
        <p>🎯 Практический анализ для ПСО: активен</p>
        <p>🐕 Фильтрация животных: активна</p>
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
            yandexDisk: yandexDisk !== null
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

    console.log('🚀 Все модули инициализированы, бот готов к работе!');
    console.log('🎯 Практический анализ для ПСО активирован');
    console.log('🐕 Фильтрация следов животных активирована');
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
                notes: this.getCorrectionDescription(correctionType)
            };
           
            feedbackDB.addFeedback(feedbackData);
           
            // Обновляем сообщение
            await bot.editMessageText(
                `✅ Спасибо за исправление!\n` +
                `Тип: ${this.getCorrectionDescription(correctionType)}\n` +
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

// Запуск сервера
app.listen(config.PORT, () => {
    console.log(`✅ Сервер запущен на порту ${config.PORT}`);
    console.log(`🤖 Telegram бот готов к работе`);
    console.log(`🎯 Практический анализ для ПСО активирован`);
    console.log(`🐕 Фильтрация животных: активна`);
});
