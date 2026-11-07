// src/services/telegram.service.js
// 🤖 TELEGRAM-СЕРВИС: создание бота и настройка вебхука (вынесено из main.js)

/**
 * Создаёт экземпляр Telegram-бота
 * @param {string} token - токен бота
 * @returns {TelegramBot}
 */
function createBot(token) {
    const TelegramBot = require('node-telegram-bot-api');
    return new TelegramBot(token);
}

/**
 * Настраивает вебхук для Render.com
 * @param {TelegramBot} bot - экземпляр бота
 * @param {string} token - токен бота (для построения URL вебхука)
 */
async function setupWebhook(bot, token) {
    try {
        console.log('🔄 Настраиваю вебхук...');

        // 1. Удаляем старый вебхук
        const deleted = await bot.deleteWebHook({ drop_pending_updates: true });
        console.log('✅ Старый вебхук удален:', deleted);

        // 2. Ждем 2 секунды
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 3. Устанавливаем новый вебхук
        // ⚠️ ВАЖНО: Используйте ВАШ URL от Render
        const webhookUrl = `https://shoe-print-bot.onrender.com/bot${token}`;
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

module.exports = {
    createBot,
    setupWebhook
};
