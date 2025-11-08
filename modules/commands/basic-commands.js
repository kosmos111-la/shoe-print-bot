module.exports = {
    setup(bot, modules) {
        const stats = modules.stats;
       
        bot.onText(/\/start/, async (msg) => {
            stats.updateUserStats(msg.from.id, msg.from.username || msg.from.first_name);
          
            await bot.sendMessage(msg.chat.id,
                `👟 **БАЗОВЫЙ АНАЛИЗАТОР СЛЕДОВ ОБУВИ** 🚀\n\n` +
                `📊 Статистика: ${stats.getGlobalStats().totalUsers} пользователей\n\n` +
                `🔍 **ФУНКЦИОНАЛ:**\n` +
                `• Базовый анализ - отправьте фото отпечатка\n` +
                `• Визуализация деталей\n` +
                `• Топология протектора\n\n` +
                `📸 **Просто отправьте фото следа обуви**`
            );
        });
       
        bot.onText(/\/statistics/, async (msg) => {
            const statsReport = stats.getStatisticsReport();
            await bot.sendMessage(msg.chat.id, statsReport);
        });
       
        bot.onText(/\/help/, async (msg) => {
            await bot.sendMessage(msg.chat.id,
                `🆘 **ПОМОЩЬ**\n\n` +
                `📸 Отправьте фото следа обуви для анализа\n\n` +
                `🔍 **Что анализируется:**\n` +
                `• Контуры подошвы\n` +
                `• Детали протектора\n` +
                `• Топология узора\n\n` +
                `💡 **Советы по съемке:**\n` +
                `• Прямой угол\n` +
                `• Хорошее освещение\n` +
                `• Четкий фокус`
            );
        });
    }
};
