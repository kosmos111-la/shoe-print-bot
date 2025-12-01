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

// ИМПОРТ МОДУЛЕЙ
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

// Временные заглушки пока идет инициализация
yandexDisk = createYandexDiskStub();
calculators = createCalculatorsStub();
apps = createAppsStub();
practicalAnalyzer = createPracticalAnalyzerStub();
animalFilter = createAnimalFilterStub();

const app = express();
const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: false });

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
        `🎨 **Текущий стиль визуализации:** ${styleInfo?.name || 'Стиль маски'}\n\n` +
        `🔍 **ФУНКЦИОНАЛ:**\n` +
        `• Анализ через Roboflow API\n` +
        `• Визуализация контуров\n` +
        `• Топология протектора\n` +
        `• Выбор стиля визуализации\n` +
        `• 🆕 Практический анализ для ПСО\n` +
        `• 🆕 Фильтрация следов животных\n\n` +
        `🧮 **ИНСТРУМЕНТЫ:**\n` +
        `/calculators - Калькуляторы и расчеты\n\n` +
        `🎯 **Команды:**\n` +
        `/style - Выбор стиля визуализации\n` +
        `/currentstyle - Текущий стиль\n` +
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
                     globalStats.lastAnalysis.toLocaleString('ru-RU') : 'еще нет'}`;

    bot.sendMessage(msg.chat.id, stats);
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
        `Просто отправьте фото следа обуви\n\n` +
        `🔍 **Что анализируется:**\n` +
        `• Контуры подошвы\n` +
        `• Детали протектора\n` +
        `• Топология узора\n` +
        `• 🆕 Практический анализ для ПСО\n` +
        `• 🆕 Фильтрация следов животных\n\n` +
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
// 📸 ОБРАБОТКА ФОТО С ПРАКТИЧЕСКИМ АНАЛИЗОМ
// =============================================================================
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    try {
        updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'photo');

        // 🎨 ПОДСКАЗКА О СТИЛЕ ПРИ ПЕРВОМ ИСПОЛЬЗОВАНИИ
        const userId = msg.from.id;
        if (!visualization.userPreferences.has(String(userId))) {
            const currentStyle = visualization.getUserStyle(userId);
            const styleInfo = visualization.getAvailableStyles().find(s => s.id === currentStyle);

            await bot.sendMessage(chatId,
                `🎨 **Стиль визуализации:** ${styleInfo?.name || 'Стиль маски'}\n` +
                `Изменить: /style`
            );
        }
        await bot.sendMessage(chatId, '📥 Получено фото, начинаю анализ...');

        const photo = msg.photo[msg.photo.length - 1];
        const file = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_TOKEN}/${file.file_path}`;

        // 🔄 СОХРАНЯЕМ ФОТО ВО ВРЕМЕННЫЙ ФАЙЛ ДЛЯ АНАЛИЗА
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

        await bot.sendMessage(chatId, '🔍 Анализирую через Roboflow...');

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

   // 🔍 ПРАКТИЧЕСКИЙ АНАЛИЗ ДЛЯ ПСО (ВЫПОЛНЯЕТСЯ ВСЕГДА)
let predictionsForAnalysis = processedPredictions; // По умолчанию используем все предсказания
       
try {
    await bot.sendMessage(chatId, '🎯 Провожу практический анализ для поисковых работ...');
   
    // 1. ФИЛЬТРАЦИЯ СЛЕДОВ ЖИВОТНЫХ
    const animalFilterResult = animalFilter.filterAnimalPaws(processedPredictions);
    const filteredPredictions = animalFilterResult.filtered;
   
    // 2. ПРАКТИЧЕСКИЙ АНАЛИЗ ДЛЯ ПСО
    const psoAnalysis = practicalAnalyzer.analyzeForPSO(filteredPredictions);
   
    // Формируем сообщение с практическими рекомендациями
    let psoMessage = '🎯 **ПРАКТИЧЕСКИЙ АНАЛИЗ ДЛЯ ПСО**\n\n';
   
    psoMessage += '🔍 **КЛЮЧЕВЫЕ НАХОДКИ:**\n';
   
    // ПРОВЕРЯЕМ КАЖДЫЙ ЭЛЕМЕНТ НА НАЛИЧИЕ
    if (psoAnalysis.keyFindings && psoAnalysis.keyFindings.isAnimal) {
        psoMessage += `• ${psoAnalysis.keyFindings.isAnimal.message}\n`;
    }
   
    if (psoAnalysis.keyFindings && psoAnalysis.keyFindings.hasHeel) {
        psoMessage += `• ${psoAnalysis.keyFindings.hasHeel.message}\n`;
    }
   
    if (psoAnalysis.keyFindings && psoAnalysis.keyFindings.hasToe) {
        psoMessage += `• ${psoAnalysis.keyFindings.hasToe.message}\n`;
    }
   
    if (psoAnalysis.keyFindings && psoAnalysis.keyFindings.hasGroundDisturbance) {
        psoMessage += `• ${psoAnalysis.keyFindings.hasGroundDisturbance.message}\n`;
    }
   
    if (psoAnalysis.keyFindings && psoAnalysis.keyFindings.footprintCount) {
        psoMessage += `• ${psoAnalysis.keyFindings.footprintCount.message}\n`;
    }
   
    if (psoAnalysis.keyFindings && psoAnalysis.keyFindings.protectorDetails) {
        psoMessage += `• ${psoAnalysis.keyFindings.protectorDetails.message}\n`;
    }
   
    psoMessage += '\n💡 **РЕКОМЕНДАЦИИ:**\n';
   
    // ПРОВЕРЯЕМ ЕСТЬ ЛИ РЕКОМЕНДАЦИИ
    if (psoAnalysis.recommendations && Array.isArray(psoAnalysis.recommendations)) {
        psoAnalysis.recommendations.forEach(rec => {
            psoMessage += `• ${rec}\n`;
        });
    } else {
        psoMessage += '• Нет рекомендаций\n';
    }
   
    psoMessage += '\n📊 **ФАКТЫ:**\n';
   
    if (psoAnalysis.facts && psoAnalysis.facts.classesFound) {
        psoMessage += `• Найдено классов: ${psoAnalysis.facts.classesFound.join(', ') || 'нет'}\n`;
    }
   
    if (psoAnalysis.facts && typeof psoAnalysis.facts.hasClearOutline !== 'undefined') {
        psoMessage += `• Контур следа: ${psoAnalysis.facts.hasClearOutline ? 'да' : 'нет'}\n`;
    }
   
    if (animalFilterResult.removed > 0) {
        psoMessage += `\n🚫 **ФИЛЬТРАЦИЯ ЖИВОТНЫХ:** ${animalFilterResult.message}`;
        predictionsForAnalysis = filteredPredictions; // Используем отфильтрованные предсказания
    }
   
    // Отправляем практический анализ СРАЗУ
    await bot.sendMessage(chatId, psoMessage);
   
} catch (psoError) {
    console.log('⚠️ Ошибка практического анализа:', psoError);
    console.log('🔍 Подробности ошибки:', psoError.stack);
    await bot.sendMessage(chatId, '⚠️ Практический анализ временно недоступен, продолжаю базовый анализ...');
    predictionsForAnalysis = processedPredictions;
}

        if (analysis.total > 0) {
            // 🧠 ИНТЕЛЛЕКТУАЛЬНЫЙ АНАЛИЗ СЛЕДА (если модуль доступен)
            let intelligentAnalysis = null;
            try {
                if (analysisModule && analysisModule.performComprehensiveAnalysis) {
                    await bot.sendMessage(chatId, '🧠 Провожу интеллектуальный анализ...');
                   
                    intelligentAnalysis = await analysisModule.performComprehensiveAnalysis(
                        tempImagePath,
                        predictionsForAnalysis, // ⚠️ ИСПОЛЬЗУЕМ ОТФИЛЬТРОВАННЫЕ ПРЕДСКАЗАНИЯ
                        {
                            userId: msg.from.id,
                            username: msg.from.username || msg.from.first_name
                        }
                    );

                    // 📊 ВЫВОД РЕЗУЛЬТАТОВ ИНТЕЛЛЕКТУАЛЬНОГО АНАЛИЗА
                    if (intelligentAnalysis && intelligentAnalysis.summary) {
                        const summary = intelligentAnalysis.summary;
                        await bot.sendMessage(chatId,
                            `🧠 **ИНТЕЛЛЕКТУАЛЬНЫЙ АНАЛИЗ СЛЕДА**\n\n` +
                            `🧭 Ориентация: ${summary.orientation}\n` +
                            `📊 Уверенность: ${summary.confidence}\n` +
                            `👟 Тип обуви: ${summary.footprintType}\n` +
                            `📏 Примерный размер: ${summary.sizeEstimation}\n` +
                            `🔷 Морфология: ${summary.morphology}\n` +
                            `🕸️ Топология: ${summary.topology}\n\n` +
                            `💡 Рекомендации:\n${summary.recommendations.join('\n')}`
                        );
                    }
                }
            } catch (analysisError) {
                console.log('⚠️ Ошибка интеллектуального анализа:', analysisError.message);
                // Не отправляем сообщение пользователю, чтобы не засорять чат
            }

            await bot.sendMessage(chatId, '🎨 Создаю визуализацию...');

            const userData = {
                username: msg.from.username ? `@${msg.from.username}` : msg.from.first_name
            };

            // ИСПОЛЬЗУЕМ МОДУЛИ ВИЗУАЛИЗАЦИИ С ВЫБОРОМ СТИЛЯ
            const vizModule = visualization.getVisualization(msg.from.id, 'analysis');
            const topologyModule = visualization.getVisualization(msg.from.id, 'topology');

            // 🔄 НОВЫЙ КОД С ИНТЕГРАЦИЕЙ МЕНЕДЖЕРА ФАЙЛОВ
            let vizPath, topologyPath;

            try {
                // СОЗДАЕМ ПУТИ ЧЕРЕЗ МЕНЕДЖЕР
                vizPath = tempFileManager.createTempFile('analysis', 'png');
                topologyPath = tempFileManager.createTempFile('topology', 'png');

                // Сохраняем визуализации в созданные пути (ИСПОЛЬЗУЕМ ОТФИЛЬТРОВАННЫЕ ПРЕДСКАЗАНИЯ)
                await vizModule.createVisualization(fileUrl, predictionsForAnalysis, userData, vizPath);
                await topologyModule.createVisualization(fileUrl, predictionsForAnalysis, userData, topologyPath);

                // 🆕 ТОПОЛОГИЧЕСКАЯ ВИЗУАЛИЗАЦИЯ
                const topologyVizPath = tempFileManager.createTempFile('topology_science', 'png');
                const topologyCreated = await topologyVisualizer.createTopologyVisualization(
                    fileUrl,
                    predictionsForAnalysis,
                    topologyVizPath
                );

                // Отправка результатов
                if (vizPath && require('fs').existsSync(vizPath)) {
                    let caption = `✅ Анализ завершен\n🎯 Обнаружено объектов: ${analysis.total}`;

                    // ДОБАВЛЯЕМ ИНТЕЛЛЕКТУАЛЬНЫЕ ВЫВОДЫ В ПОДПИСЬ (если есть)
                    if (intelligentAnalysis && intelligentAnalysis.summary) {
                        caption += `\n🧭 Ориентация: ${intelligentAnalysis.summary.orientation}`;
                        caption += `\n👟 Тип: ${intelligentAnalysis.summary.footprintType}`;
                    }

                    // 1. ОСНОВНАЯ ВИЗУАЛИЗАЦИЯ
                    await bot.sendPhoto(chatId, vizPath, { caption: caption });

                    // 2. ТОПОЛОГИЧЕСКАЯ КАРТА (если создалась)
                    if (topologyCreated) {
                        await bot.sendPhoto(chatId, topologyVizPath, {
                            caption: '🕸️ Топологический анализ протектора\n• Зеленые точки - центры протекторов\n• Оранжевые линии - связи\n• Синий пунктир - контур следа'
                        });
                        tempFileManager.removeFile(topologyVizPath);
                    }

                    // 💾 СОХРАНЕНИЕ В ЯНДЕКС.ДИСК
                    if (yandexDisk && vizPath && topologyPath) {
                        try {
                            await bot.sendMessage(chatId, '💾 Сохраняю результаты в облако...');

                            const filesToUpload = [
                                { localPath: vizPath, name: 'visualization.png', type: 'visualization' },
                                { localPath: topologyPath, name: 'topology_map.png', type: 'topology' },
                                { localPath: tempImagePath, name: 'original_photo.jpg', type: 'original' }
                            ];

                            if (topologyCreated) {
                                filesToUpload.push({
                                    localPath: topologyVizPath,
                                    name: 'topology_science.png',
                                    type: 'topology_science'
                                });
                            }

                            const analysisData = {
                                predictions: predictionsForAnalysis.length,
                                classes: analysis.classes,
                                timestamp: new Date().toISOString(),
                                user: userData.username,
                                intelligentAnalysis: intelligentAnalysis ? {
                                    orientation: intelligentAnalysis.summary.orientation,
                                    footprintType: intelligentAnalysis.summary.footprintType,
                                    sizeEstimation: intelligentAnalysis.summary.sizeEstimation,
                                    morphology: intelligentAnalysis.summary.morphology,
                                    topology: intelligentAnalysis.summary.topology
                                } : null
                            };

                            const saveResult = await yandexDisk.saveAnalysisResults(
                                msg.from.id,
                                filesToUpload,
                                analysisData
                            );

                            if (saveResult.success) {
                                await bot.sendMessage(chatId,
                                    `💾 **Результаты сохранены в Яндекс.Диск**\n\n` +
                                    `📁 Папка: ${path.basename(saveResult.folderPath)}\n` +
                                    `📊 Файлов: ${saveResult.uploadedFiles.length}\n` +
                                    `🕒 ${new Date().toLocaleString('ru-RU')}`
                                );
                            }
                        } catch (uploadError) {
                            console.log('⚠️ Ошибка загрузки в Яндекс.Диск:', uploadError.message);
                        }
                    }

                    // 🔄 АВТОМАТИЧЕСКАЯ ОЧИСТКА
                    tempFileManager.removeFile(vizPath);
                    tempFileManager.removeFile(topologyPath);
                    tempFileManager.removeFile(tempImagePath);
                } else {
                    // Если визуализация не создалась
                    let caption = `✅ **АНАЛИЗ ЗАВЕРШЕН**\n\n`;
                    caption += `🎯 Обнаружено объектов: ${analysis.total}\n\n`;

                    if (intelligentAnalysis && intelligentAnalysis.summary) {
                        caption += `🧠 **ИНТЕЛЛЕКТУАЛЬНЫЙ АНАЛИЗ:**\n`;
                        caption += `• Ориентация: ${intelligentAnalysis.summary.orientation}\n`;
                        caption += `• Тип обуви: ${intelligentAnalysis.summary.footprintType}\n`;
                        caption += `• Размер: ${intelligentAnalysis.summary.sizeEstimation}\n`;
                        caption += `• Морфология: ${intelligentAnalysis.summary.morphology}\n`;
                        caption += `• Топология: ${intelligentAnalysis.summary.topology}\n\n`;
                    }

                    caption += `📋 **КЛАССИФИКАЦИЯ:**\n`;
                    Object.entries(analysis.classes).forEach(([className, count]) => {
                        caption += `• ${className}: ${count}\n`;
                    });
                  
                    await bot.sendMessage(chatId, caption);
                }
            } catch (error) {
                console.log('❌ Ошибка создания визуализации:', error);
                if (vizPath) tempFileManager.removeFile(vizPath);
                if (topologyPath) tempFileManager.removeFile(topologyPath);
                if (tempImagePath) tempFileManager.removeFile(tempImagePath);
                throw error;
            }

        } else {
            await bot.sendMessage(chatId, '❌ Не удалось обнаружить детали на фото');
        }

        updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'analysis');

    } catch (error) {
        console.log('❌ Ошибка анализа фото:', error.message);
        await bot.sendMessage(chatId, '❌ Ошибка при анализе фото. Попробуйте еще раз.');
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

// Запуск сервера
app.listen(config.PORT, () => {
    console.log(`✅ Сервер запущен на порту ${config.PORT}`);
    console.log(`🤖 Telegram бот готов к работе`);
    console.log(`🎯 Практический анализ для ПСО активирован`);
    console.log(`🐕 Фильтрация животных: активна`);
});
