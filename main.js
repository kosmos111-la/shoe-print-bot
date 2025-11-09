const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ИМПОРТ МОДУЛЕЙ
const visualizationModule = require('./modules/visualization');

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

console.log('🚀 Запуск системы с модульной визуализацией...');

// 🔒 ЗАЩИЩЕННАЯ ИНИЦИАЛИЗАЦИЯ МОДУЛЕЙ
let visualization;
try {
    visualization = visualizationModule.initialize(); // ← ИСПОЛЬЗУЕМ visualizationModule!
    console.log('✅ Модуль визуализации загружен');
} catch (error) {
    console.log('❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось загрузить модуль визуализации:', error.message);
    // Создаем заглушку чтобы бот не падал
    visualization = {
        getVisualization: () => ({ createVisualization: async () => null }),
        setUserStyle: () => false,
        getUserStyle: () => 'original',
        getAvailableStyles: () => [{ id: 'original', name: 'Оригинальный', description: 'Основной стиль' }]
    };
}

const app = express();
const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: false });

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
// 🤖 TELEGRAM БОТ
// =============================================================================
app.use(express.json());

// Webhook для Telegram
app.post(`/bot${config.TELEGRAM_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Команды бота
bot.onText(/\/start/, (msg) => {
    updateUserStats(msg.from.id, msg.from.username || msg.from.first_name);
   
    // Получаем текущий стиль пользователя
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
        `🎯 **Команды:**\n` +
        `/style - Выбор стиля визуализации\n` +
        `/currentstyle - Текущий стиль\n` +
        `/help - Помощь\n` +
        `/statistics - Статистика\n\n` +
        `📸 **Просто отправьте фото следа обуви**`
    );
});

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

// Команда выбора стиля визуализации
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

// Показ текущего стиля
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


bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🆘 **ПОМОЩЬ**\n\n` +
        `📸 **Как использовать:**\n` +
        `Просто отправьте фото следа обуви\n\n` +
        `🔍 **Что анализируется:**\n` +
        `• Контуры подошвы\n` +
        `• Детали протектора\n` +
        `• Топология узора\n\n` +
        `🎨 **Стили визуализации:**\n` +
        `/style - Выбрать стиль отображения\n` +
        `/currentstyle - Текущий стиль\n` +
        `• Стиль маски (по умолчанию) - черные линии на полупрозрачном фоне\n` +
        `• Оригинальный стиль - цветная визуализация\n\n` +
        `💡 **Советы по съемке:**\n` +
        `• Прямой угол\n` +
        `• Хорошее освещение\n` +
        `• Четкий фокус\n\n` +
        `📊 **Другие команды:**\n` +
        `/start - Главное меню\n` +
        `/statistics - Статистика системы`
    );
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

const vizPath = await vizModule.createVisualization(fileUrl, processedPredictions, userData);
const topologyPath = await topologyModule.createVisualization(fileUrl, processedPredictions, userData);
           
            let caption = `✅ **АНАЛИЗ ЗАВЕРШЕН**\n\n`;
            caption += `🎯 Обнаружено объектов: ${analysis.total}\n\n`;
           
            caption += `📋 **КЛАССИФИКАЦИЯ:**\n`;
            Object.entries(analysis.classes).forEach(([className, count]) => {
                caption += `• ${className}: ${count}\n`;
            });
           
            if (vizPath) {
    // ОТПРАВЛЯЕМ ТОЛЬКО ОДНУ ФОТОГРАФИЮ с краткой подписью
    await bot.sendPhoto(chatId, vizPath, {
        caption: `✅ Анализ завершен\n🎯 Обнаружено объектов: ${analysis.total}`
    });
  
    // Очистка временных файлов
    [vizPath, topologyPath].forEach(path => {
        try {
            if (path && require('fs').existsSync(path)) {
                require('fs').unlinkSync(path);
                console.log('✅ Файл удален:', path);
            }
        } catch(e) {
            console.log('⚠️ Не удалось удалить файл:', path);
        }
    });
} else {
    await bot.sendMessage(chatId, caption);
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
// 🔒 ЗАЩИЩЕННАЯ ОЧИСТКА ФАЙЛОВ
function safeFileCleanup(paths) {
    if (!paths || !Array.isArray(paths)) return;
   
    paths.forEach(filePath => {
        try {
            if (filePath && typeof filePath === 'string' && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('✅ Файл удален:', filePath);
            }
        } catch (e) {
            console.log('⚠️ Не удалось удалить файл:', filePath);
        }
    });
}

// 🚀 ЗАПУСК СЕРВЕРА
app.listen(config.PORT, () => {
    console.log(`✅ Сервер запущен на порту ${config.PORT}`);
    console.log(`🤖 Telegram бот готов к работе`);
    console.log(`🎯 Модульная система с визуализацией активирована`);
});
