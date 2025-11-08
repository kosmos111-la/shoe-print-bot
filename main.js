const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

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

console.log('🚀 Запуск системы с Telegram ботом...');

const app = express();
const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: false });

app.use(express.json());

// Webhook для Telegram
app.post(`/bot${config.TELEGRAM_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Базовые команды
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🤖 Модульная система анализа следов\n\n` +
        `✅ Система запущена!\n` +
        `📸 Отправьте фото следа для анализа`
    );
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🆘 Помощь по системе:\n\n` +
        `📸 Просто отправьте фото следа обуви\n` +
        `🤖 Система автоматически проанализирует его\n` +
        `🎯 Пока в разработке - базовые функции`
    );
});

// Заглушка для фото
bot.on('photo', (msg) => {
    bot.sendMessage(msg.chat.id,
        `📸 Фото получено!\n\n` +
        `⏳ Модуль анализа в разработке...\n` +
        `🔜 Скоро будет полноценный анализ`
    );
});

// Базовая страница
app.get('/', (req, res) => {
    res.send(`
        <h1>🤖 Система РАБОТАЕТ!</h1>
        <p>Telegram бот подключен</p>
        <p>Порт: ${config.PORT}</p>
        <p><a href="/health">Health Check</a></p>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        bot: 'connected'
    });
});

app.listen(config.PORT, () => {
    console.log(`✅ Сервер запущен на порту ${config.PORT}`);
    console.log(`🤖 Telegram бот готов к работе`);
});
