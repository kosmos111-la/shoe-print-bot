const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

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

console.log('🚀 Запуск системы с текстовым анализом...');

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
  
    bot.sendMessage(msg.chat.id,
        `👟 **СИСТЕМА АНАЛИЗА СЛЕДОВ ОБУВИ** 🚀\n\n` +
        `📊 Статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} отпечатков\n\n` +
        `🔍 **ФУНКЦИОНАЛ:**\n` +
        `• Анализ через Roboflow API\n` +
        `• Текстовый отчет деталей\n` +
        `• Топологический анализ\n\n` +
        `📸 **Просто отправьте фото следа обуви**\n\n` +
        `⚠️ *Визуализация временно отключена*`
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

// Обработка фото
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    try {
        updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'photo');
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
        const analysis = analyzePredictions(predictions);

        if (analysis.total > 0) {
            let report = `✅ **АНАЛИЗ ЗАВЕРШЕН**\n\n`;
            report += `🎯 Обнаружено объектов: ${analysis.total}\n\n`;
           
            report += `📋 **КЛАССИФИКАЦИЯ:**\n`;
            Object.entries(analysis.classes).forEach(([className, count]) => {
                report += `• ${className}: ${count}\n`;
            });
           
            report += `\n${generateTopologyText(predictions)}`;
           
            report += `\n\n🔍 **ВЫВОДЫ:**\n`;
            if (analysis.hasOutline) {
                report += `✅ Контур подошвы обнаружен\n`;
            }
            if (analysis.protectorCount > 10) {
                report += `✅ Сложный узор протектора\n`;
            } else if (analysis.protectorCount > 5) {
                report += `🟡 Средняя детализация\n`;
            } else {
                report += `🟠 Минимальная детализация\n`;
            }

            await bot.sendMessage(chatId, report);
           
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
        <p>✅ Текстовая версия работает!</p>
        <p>📊 Пользователей: ${globalStats.totalUsers}</p>
        <p>📸 Фото обработано: ${globalStats.totalPhotos}</p>
        <p>⚠️ Визуализация временно отключена</p>
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

app.listen(config.PORT, () => {
    console.log(`✅ Сервер запущен на порту ${config.PORT}`);
    console.log(`🤖 Telegram бот готов к работе`);
    console.log(`📝 Текстовая версия активирована`);
});
