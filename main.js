// =============================================================================
// 🎯 СИСТЕМА АНАЛИЗА СЛЕДОВ ОБУВИ - ОСНОВНОЙ ФАЙЛ
// =============================================================================
// 
// 📋 СТАТУС: РАБОЧАЯ ВЕРСИЯ 2.0 - МОДУЛЬНАЯ АРХИТЕКТУРА
// ✅ ЧТО РАБОТАЕТ:
//   • Модульная система визуализации
//   • Анализ через Roboflow API
//   • Telegram бот с командами (/start, /help, /statistics)
//   • Canvas визуализация с выбором стилей (оригинальный/маска)
//   • Статистика пользователей
//   • Топологическая карта протектора
//
// 🏗️ АРХИТЕКТУРА:
//   • Express.js сервер + Telegram Bot API
//   • Модульная структура в папке modules/
//   • Canvas для генерации визуализаций
//   • Roboflow для ML-анализа изображений
//   • Временные файлы в папке temp/
//
// 🔄 ПОСЛЕДНИЕ ИЗМЕНЕНИЯ:
//   • Добавлена система выбора стилей визуализации
//   • Стиль "маска" установлен по умолчанию
//   • Улучшена информационная панель на визуализациях
//
// 🎯 СЛЕДУЮЩИЕ ШАГИ:
//   • Модуль Яндекс.Диска для сохранения результатов
//   • Расширенная статистика и аналитика
//   • Дополнительные команды бота
//
// =============================================================================

// =============================================================================
// 🎯 СИСТЕМА АНАЛИЗА СЛЕДОВ ОБУВИ - ОСНОВНОЙ ФАЙЛ
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

// ВСТРОЕННЫЙ CONFIG
const config = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI',
    PORT: process.env.PORT || 10000,
    YANDEX_DISK_TOKEN: process.env.YANDEX_DISK_TOKEN,

    ROBOFLOW: {
        API_URL: 'https://detect.roboflow.com/-zqyih/13',
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

console.log('🚀 Запуск системы с модульной визуализацией...');

// 🔒 ЗАЩИЩЕННАЯ ИНИЦИАЛИЗАЦИЯ МОДУЛЕЙ
let visualization;
let tempFileManager;
let yandexDisk;
let calculators;
let apps;

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

// Временные заглушки пока идет инициализация
yandexDisk = createYandexDiskStub();
calculators = createCalculatorsStub();
apps = createAppsStub();

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
        `• Выбор стиля визуализации\n\n` +
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

bot.onText(/\/calculators/

// Команда калькулятора обуви
bot.onText(/\/calc_shoe/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const typesMessage = calculators.getShoeTypes();
        await bot.sendMessage(chatId, typesMessage, { parse_mode: 'HTML' });

        await bot.sendMessage(chatId,
            '💡 <b>Как использовать:</b>\n\n' +
            'Отправьте сообщение в формате:\n' +
            '<code>размер=42 тип=кроссовки</code>\n\n' +
            'Или просто:\n' +
            '<code>42 кроссовки</code>',
            { parse_mode: 'HTML' }
        );
    } catch (error) {
        console.log('❌ Ошибка в /calc_shoe:', error);
        await bot.sendMessage(chatId, '❌ Ошибка загрузки калькулятора');
    }
});

// Команда обратного калькулятора
bot.onText(/\/calc_reverse/, async (msg) => {
    const chatId = msg.chat.id;
   
    try {
        await bot.sendMessage(chatId,
            '🔄 <b>Обратный калькулятор</b>\n\n' +
            'Расчет размера обуви по длине отпечатка\n\n' +
            '💡 <b>Как использовать:</b>\n\n' +
            'Отправьте длину отпечатка в см:\n' +
            '<code>33 см</code>\n\n' +
            'Или просто число:\n' +
            '<code>33</code>\n\n' +
            '📝 <i>Пример: отпечаток 33 см → размеры 41-50</i>',
            { parse_mode: 'HTML' }
        );
    } catch (error) {
        console.log('❌ Ошибка в /calc_reverse:', error);
        await bot.sendMessage(chatId, '❌ Ошибка загрузки калькулятора');
    }
});

// Обработчик ввода данных для калькулятора
bot.on('message', async (msg) => {
    // Пропускаем команды и служебные сообщения
    if (msg.text && msg.text.startsWith('/')) return;
    if (!msg.text) return;
   
    const chatId = msg.chat.id;
    const text = msg.text.toLowerCase();
   
    console.log('🔍 Получено сообщение для обработки:', text);
   
    try {
        // Проверяем обратный расчет (длина отпечатка)
        if (text.includes('см') || /^\d+[.,]?\d*$/.test(text.trim())) {
            const lengthMatch = text.match(/(\d+[.,]?\d*)\s*см/) || [null, text.trim()];
            const footprintLength = lengthMatch[1].replace(',', '.');
           
            console.log('🔍 Обратный расчет для длины:', footprintLength);
           
            const result = calculators.calculateReverse(footprintLength);
            await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            return;
        }
       
        // Проверяем прямой расчет (размер + тип обуви)
        if ((text.includes('размер=') && text.includes('тип=')) ||
            (/^\d+/.test(text) && text.split(' ').length >= 2)) {
           
            console.log('🔍 Обрабатываем как прямой калькулятор');
            let size, type;
           
            if (text.includes('размер=') && text.includes('тип=')) {
                const sizeMatch = text.match(/размер=(\d+)/);
                const typeMatch = text.match(/тип=([^]+)/);
                size = sizeMatch ? sizeMatch[1] : null;
                type = typeMatch ? typeMatch[1].trim() : null;
            } else {
                const parts = text.split(' ');
                size = parts[0];
                type = parts.slice(1).join(' ');
            }
           
            console.log('🔍 Парсинг:', { size, type });
           
            if (size && type) {
                const result = calculators.calculateShoeSize(size, type);
                console.log('🔍 Результат калькулятора:', result);
                await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            }
        }
    } catch (error) {
        console.log('❌ Ошибка обработки калькулятора:', error);
        // Игнорируем ошибки парсинга
    }
});

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
        `• Топология узора\n\n` +
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

// Обработка фото
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    try {
        updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'photo');

        // 🎨 ПОДСКАЗКА О СТИЛЕ ПРИ ПЕРВОМ ИСПОЛЬЗОВАНИИ
        const userId = msg.from.id;
        if (!visualization.userPreferences.has(String(userId))) {
            // Первое использование - показываем подсказку о стиле
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

        await bot.sendMessage(chatId, '🔍 Анализирую через Roboflow...');

        const response = await axios({
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

        const predictions = response.data.predictions || [];
        const processedPredictions = smartPostProcessing(predictions);
        const analysis = analyzePredictions(processedPredictions);

        if (analysis.total > 0) {
            await bot.sendMessage(chatId, '🎨 Создаю визуализацию...');

            const userData = {
                username: msg.from.username ? `@${msg.from.username}` : msg.from.first_name
            };

            // ИСПОЛЬЗУЕМ МОДУЛИ ВИЗУАЛИЗАЦИИ С ВЫБОРОМ СТИЛЯ
            const userId = msg.from.id;
            const vizModule = visualization.getVisualization(msg.from.id, 'analysis');
            const topologyModule = visualization.getVisualization(msg.from.id, 'topology');

            // 🔄 НОВЫЙ КОД С ИНТЕГРАЦИЕЙ МЕНЕДЖЕРА ФАЙЛОВ
            let vizPath, topologyPath;
           
            try {
                // СОЗДАЕМ ПУТИ ЧЕРЕЗ МЕНЕДЖЕР (автоматическое отслеживание)
                vizPath = tempFileManager.createTempFile('analysis', 'png');
                topologyPath = tempFileManager.createTempFile('topology', 'png');

                // Сохраняем визуализации в созданные пути
                await vizModule.createVisualization(fileUrl, processedPredictions, userData, vizPath);
                await topologyModule.createVisualization(fileUrl, processedPredictions, userData, topologyPath);

                // Отправка результата
                if (vizPath && require('fs').existsSync(vizPath)) {
                    await bot.sendPhoto(chatId, vizPath, {
                        caption: `✅ Анализ завершен\n🎯 Обнаружено объектов: ${analysis.total}`
                    });

                    // 💾 СОХРАНЕНИЕ В ЯНДЕКС.ДИСК
                    if (yandexDisk && vizPath && topologyPath) {
                        try {
                            await bot.sendMessage(chatId, '💾 Сохраняю результаты в облако...');

                            const filesToUpload = [
                                { localPath: vizPath, name: 'visualization.png', type: 'visualization' },
                                { localPath: topologyPath, name: 'topology_map.png', type: 'topology' }
                            ];

                            const analysisData = {
                                predictions: processedPredictions.length,
                                classes: analysis.classes,
                                timestamp: new Date().toISOString(),
                                user: userData.username
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
                            // Не прерываем основной поток из-за ошибки загрузки
                        }
                    }

                    // 🔄 АВТОМАТИЧЕСКАЯ ОЧИСТКА ЧЕРЕЗ МЕНЕДЖЕР
                    tempFileManager.removeFile(vizPath);
                    tempFileManager.removeFile(topologyPath);
                } else {
                    // Если визуализация не создалась, отправляем текстовый результат
                    let caption = `✅ **АНАЛИЗ ЗАВЕРШЕН**\n\n`;
                    caption += `🎯 Обнаружено объектов: ${analysis.total}\n\n`;
                    caption += `📋 **КЛАССИФИКАЦИЯ:**\n`;
                    Object.entries(analysis.classes).forEach(([className, count]) => {
                        caption += `• ${className}: ${count}\n`;
                    });
                    await bot.sendMessage(chatId, caption);
                }
            } catch (error) {
                console.log('❌ Ошибка создания визуализации:', error);
                // 🔄 ГАРАНТИРОВАННАЯ ОЧИСТКА ПРИ ОШИБКЕ
                if (vizPath) tempFileManager.removeFile(vizPath);
                if (topologyPath) tempFileManager.removeFile(topologyPath);
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

// =============================================================================
// 🚀 ЗАПУСК СЕРВЕРА
// =============================================================================
app.get('/', (req, res) => {
    res.send(`
        <h1>🤖 Система анализа следов обуви</h1>
        <p>✅ Модульная система работает!</p>
        <p>📊 Пользователей: ${globalStats.totalUsers}</p>
        <p>📸 Фото обработано: ${globalStats.totalPhotos}</p>
        <p>🎨 Визуализация активирована</p>
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
    tempFileManager.cleanup();
});

// Обработчик необработанных исключений
process.on('uncaughtException', (error) => {
    console.log('💥 Критическая ошибка:', error);
    console.log('🔄 Очищаем временные файлы...');
    tempFileManager.cleanup();
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Получен SIGINT, очищаем ресурсы...');
    const cleaned = tempFileManager.cleanup();
    console.log(`🧹 Удалено ${cleaned} временных файлов перед выходом`);
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Получен SIGTERM, очищаем ресурсы...');
    const cleaned = tempFileManager.cleanup();
    console.log(`🧹 Удалено ${cleaned} временных файлов перед выходом`);
    process.exit(0);
});

// Периодическая очистка старых файлов (каждые 30 минут)
setInterval(() => {
    const cleaned = tempFileManager.cleanupOldFiles(60); // файлы старше 60 минут
    if (cleaned > 0) {
        console.log(`⏰ Периодическая очистка: удалено ${cleaned} старых файлов`);
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
})();

// Запуск сервера
app.listen(config.PORT, () => {
    console.log(`✅ Сервер запущен на порту ${config.PORT}`);
    console.log(`🤖 Telegram бот готов к работе`);
    console.log(`🎯 Модульная система с визуализацией активирована`);
});
