// test-webhook.js
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.TELEGRAM_TOKEN || '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI';
const bot = new TelegramBot(token);

async function testWebhook() {
    console.log('🚀 Тестирование вебхука для Render.com');
    console.log('🔑 Токен:', token.substring(0, 10) + '...');
   
    try {
        // 1. Проверяем бота
        const me = await bot.getMe();
        console.log('✅ Бот доступен:', me.username);
       
        // 2. Проверяем текущий вебхук
        const info = await bot.getWebHookInfo();
        console.log('\n📊 Текущий вебхук:');
        console.log('- URL:', info.url || '❌ Не установлен');
        console.log('- Ошибок:', info.last_error_message || '✅ Нет');
        console.log('- Ожидающих:', info.pending_update_count);
       
        // 3. Предлагаем действия
        console.log('\n🎯 Доступные действия:');
        console.log('1. Удалить вебхук: await bot.deleteWebHook()');
        console.log('2. Установить вебхук: await bot.setWebHook("https://shoe-print-bot.onrender.com/bot<TOKEN>")');
        console.log('3. Проверить еще раз: await bot.getWebHookInfo()');
       
        return { bot: me, webhook: info };
       
    } catch (error) {
        console.log('❌ Ошибка:', error.message);
        return { error: error.message };
    }
}

testWebhook().then(result => {
    console.log('\n🎯 Тест завершен');
    process.exit(0);
}).catch(error => {
    console.log('💥 Критическая ошибка:', error);
    process.exit(1);
});
