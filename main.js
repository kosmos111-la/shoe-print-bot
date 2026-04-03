const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

// =============================================================================
// КОНФИГУРАЦИЯ
// =============================================================================

const config = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '8474413305:AAG2PClbwwTRpzr3ga4KdIlFeIqvHXSLNYE',
    PORT: process.env.PORT || 10000
};

const app = express();
const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });

// =============================================================================
// ПРОСТЫЕ КОМАНДЫ
// =============================================================================

// Команда /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `✅ БОТ РАБОТАЕТ!\n\n` +
        `📊 Режим: POLLING (упрощённая версия)\n` +
        `🕐 Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
        `📸 Отправьте фото для анализа\n` +
        `🔧 Команды: /help, /status, /test`
    );
});

// Команда /help
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🆘 ПОМОЩЬ\n\n` +
        `/start - Главное меню\n` +
        `/status - Статус бота\n` +
        `/test - Тестовая команда\n\n` +
        `📸 Просто отправьте фото — я его приму`
    );
});

// Команда /status
bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `📊 СТАТУС БОТА\n\n` +
        `✅ Режим: POLLING\n` +
        `✅ Упрощённая версия\n` +
        `✅ Нет сложных модулей\n` +
        `🕐 Время работы: ${process.uptime().toFixed(0)} сек`
    );
});

// Команда /test
bot.onText(/\/test/, (msg) => {
    bot.sendMessage(msg.chat.id, '✅ Тест пройден! Бот отвечает корректно.');
});

// =============================================================================
// ОБРАБОТКА ФОТО
// =============================================================================

bot.on('photo', (msg) => {
    const chatId = msg.chat.id;
    const photo = msg.photo[msg.photo.length - 1];
   
    bot.sendMessage(chatId,
        `📸 Фото получено!\n\n` +
        `📏 Размер: ${photo.width}x${photo.height}\n` +
        `🆔 File ID: ${photo.file_id.substring(0, 20)}...\n\n` +
        `🔍 Анализ в упрощённой версии не выполняется.\n` +
        `💡 Для полного анализа восстановите основную версию бота.`
    );
});

// =============================================================================
// ОБРАБОТКА ЛЮБЫХ СООБЩЕНИЙ
// =============================================================================

bot.on('message', (msg) => {
    if (msg.text && !msg.text.startsWith('/') && !msg.photo) {
        bot.sendMessage(msg.chat.id,
            `❓ Неизвестная команда\n\n` +
            `Отправьте /start для списка команд\n` +
            `Или отправьте фото для теста`
        );
    }
});

// =============================================================================
// ЗАПУСК СЕРВЕРА (ДЛЯ HEALTH CHECK)
// =============================================================================

app.get('/', (req, res) => {
    res.send(`
        <h1>🤖 Упрощённый тестовый бот</h1>
        <p>✅ Режим: POLLING</p>
        <p>🕐 Время: ${new Date().toLocaleString('ru-RU')}</p>
        <p><a href="/health">Health Check</a></p>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        mode: 'polling',
        simplified: true,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

const PORT = config.PORT;
app.listen(PORT, () => {
    console.log(`✅ Упрощённый сервер на порту ${PORT}`);
    console.log(`✅ Бот запущен в режиме polling!`);
    console.log(`✅ Отправьте /start в Telegram`);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.log('⚠️ Polling ошибка:', error.message);
});

console.log('🚀 Упрощённый бот запускается...');
