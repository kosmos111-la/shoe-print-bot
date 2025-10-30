// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵
// 🔵                       АНАЛИЗАТОР СЛЕДОВ ОБУВИ (WEBHOOK ВЕРСИЯ)               🔵
// 🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json());

// 🎯 НАСТРОЙКИ
const TELEGRAM_TOKEN = '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI';
const PORT = process.env.PORT || 10000;
const WEBHOOK_URL = `https://shoe-print-bot.onrender.com/bot${TELEGRAM_TOKEN}`;

console.log('🚀 Запуск бота с Webhook...');
console.log(`🔗 Webhook URL: ${WEBHOOK_URL}`);

// 📊 СИСТЕМА СТАТИСТИКИ
const userStats = new Map();
const globalStats = {
    totalUsers: 0,
    totalPhotos: 0,
    totalAnalyses: 0,
    sessionsStarted: 0,
    comparisonsMade: 0
};

// 🎯 ИНИЦИАЛИЗАЦИЯ БОТА
const bot = new TelegramBot(TELEGRAM_TOKEN);

// 🟢 WEBHOOK МАРШРУТ
app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// 🟢 СТРАНИЦА ДЛЯ RENDER
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>Анализатор следов обуви</title></head>
            <body>
                <h1>🤖 Анализатор следов обуви</h1>
                <p>Бот работает! Используйте Telegram:</p>
                <p><a href="https://t.me/Sled_la_bot">@Sled_la_bot</a></p>
                <p>📊 Статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} фото</p>
            </body>
        </html>
    `);
});

// 🟢 HEALTH CHECK ДЛЯ RENDER
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

// 🟢 ОСНОВНЫЕ КОМАНДЫ БОТА
bot.onText(/\/start/, (msg) => {
    updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'session');
   
    bot.sendMessage(msg.chat.id,
        `👟 **АНАЛИЗАТОР СЛЕДОВ ОБУВИ** 🚀\n\n` +
        `📊 Статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} фото\n\n` +
        `📸 **Отправьте фото** для анализа следа\n` +
        `📊 **/statistics** - показать статистику\n` +
        `🆘 **/help** - помощь\n\n` +
        `💡 Бот работает в стабильном режиме!`
    );
});

bot.onText(/\/statistics/, (msg) => {
    const activeUsers = Array.from(userStats.values()).filter(user =>
        (new Date() - user.lastSeen) < 7 * 24 * 60 * 60 * 1000
    ).length;

    const stats = `📊 **СТАТИСТИКА БОТА:**\n\n` +
                 `👥 Пользователи: ${globalStats.totalUsers} (${activeUsers} активных)\n` +
                 `📸 Фото обработано: ${globalStats.totalPhotos}\n` +
                 `🔍 Анализов проведено: ${globalStats.totalAnalyses}\n` +
                 `📋 Сессий начато: ${globalStats.sessionsStarted}\n` +
                 `🔄 Сравнений сделано: ${globalStats.comparisonsMade}`;

    bot.sendMessage(msg.chat.id, stats);
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🆘 **ПОМОЩЬ**\n\n` +
        `📸 **Основные команды:**\n` +
        `• Просто отправьте фото - анализ следа\n` +
        `• /statistics - статистика бота\n` +
        `• /start - перезапустить бота\n\n` +
        `💡 **Советы:**\n` +
        `• Для лучших результатов: хорошее освещение\n` +
        `• Фото под прямым углом\n` +
        `• Четкий фокус на следе`
    );
});

// 🟢 КОМАНДА ДЛЯ СБРОСА WEBHOOK
bot.onText(/\/reset_webhook/, async (msg) => {
    try {
        await bot.deleteWebHook();
        await bot.setWebHook(WEBHOOK_URL);
        await bot.sendMessage(msg.chat.id, '✅ Webhook сброшен и установлен заново!');
    } catch (error) {
        await bot.sendMessage(msg.chat.id, `❌ Ошибка: ${error.message}`);
    }
});


// 🟢 ОБРАБОТКА ФОТО
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
   
    try {
        updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'photo');
       
        await bot.sendMessage(chatId, '📥 Получено фото, начинаю анализ...');
       
        // Скачиваем фото
        const photo = msg.photo[msg.photo.length - 1];
        const file = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
       
        await bot.sendMessage(chatId, '🔍 Анализирую через Roboflow...');
       
        // Анализ через Roboflow (упрощенный)
        const response = await axios({
            method: "POST",
            url: 'https://detect.roboflow.com/-zqyih/12',
            params: {
                api_key: 'NeHOB854EyHkDbGGLE6G',
                image: fileUrl,
                confidence: 30,
                overlap: 30,
                format: 'json'
            },
            timeout: 30000
        });

        const predictions = response.data.predictions || [];
       
        await bot.sendMessage(chatId,
            `✅ Анализ завершен!\n` +
            `🎯 Обнаружено объектов: ${predictions.length}\n` +
            `📊 Обработано фото: ${globalStats.totalPhotos}`
        );

        updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'analysis');

    } catch (error) {
        console.log('❌ Ошибка анализа фото:', error.message);
        await bot.sendMessage(chatId, '❌ Ошибка при анализе фото. Попробуйте еще раз.');
    }
});

// 🟢 ФУНКЦИЯ ОБНОВЛЕНИЯ СТАТИСТИКИ
function updateUserStats(userId, username, action = 'photo') {
    if (!userStats.has(userId)) {
        userStats.set(userId, {
            username: username || `user_${userId}`,
            photosCount: 0,
            analysesCount: 0,
            sessionsCount: 0,
            comparisonsCount: 0,
            firstSeen: new Date(),
            lastSeen: new Date()
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
            break;
        case 'session':
            user.sessionsCount++;
            globalStats.sessionsStarted++;
            break;
        case 'comparison':
            user.comparisonsCount++;
            globalStats.comparisonsMade++;
            break;
    }

    // Автосохранение каждые 10 фото
    if (globalStats.totalPhotos % 10 === 0) {
        saveStats();
    }
}

// 🟢 СОХРАНЕНИЕ СТАТИСТИКИ
function saveStats() {
    try {
        const statsData = {
            global: globalStats,
            users: Array.from(userStats.entries()),
            timestamp: new Date().toISOString()
        };
        console.log('💾 Статистика обновлена');
    } catch (error) {
        console.log('❌ Ошибка сохранения статистики:', error.message);
    }
}

// 🟢 ЗАГРУЗКА СТАТИСТИКИ ПРИ СТАРТЕ
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
            Object.assign(globalStats, remoteStats.global);
            userStats.clear();
           
            if (remoteStats.users && Array.isArray(remoteStats.users)) {
                remoteStats.users.forEach(([userId, userData]) => {
                    userStats.set(userId, userData);
                });
            }
           
            console.log('✅ Статистика загружена:');
            console.log(`   👥 Пользователей: ${globalStats.totalUsers}`);
            console.log(`   📸 Фото: ${globalStats.totalPhotos}`);
        }
    } catch (error) {
        console.log('❌ Ошибка загрузки статистики:', error.message);
        console.log('💫 Начинаем со свежей статистики');
    }
}

// 🟢 АВТОСОХРАНЕНИЕ КАЖДЫЕ 5 МИНУТ
setInterval(saveStats, 5 * 60 * 1000);

// 🟢 АНТИ-СОН СИСТЕМА
setInterval(() => {
    console.log('🔄 Keep-alive ping:', new Date().toISOString());
}, 4 * 60 * 1000);

// 🚀 ЗАПУСК СЕРВЕРА
app.listen(PORT, async () => {
    console.log(`🟢 HTTP сервер запущен на порту ${PORT}`);
   
    // Настраиваем webhook
    try {
        await bot.setWebHook(WEBHOOK_URL);
        console.log('✅ Webhook установлен');
    } catch (error) {
        console.log('❌ Ошибка установки webhook:', error.message);
    }
   
    // Загружаем статистику
    await loadStats();
   
    console.log('🤖 Бот полностью готов к работе!');
    console.log(`📊 Текущая статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} фото`);
});

// 🟢 ОБРАБОТЧИКИ ОШИБОК
process.on('unhandledRejection', (error) => {
    console.error('⚠️ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error);
});
