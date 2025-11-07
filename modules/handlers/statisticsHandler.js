class StatisticsHandler {
    constructor(bot, sessionManager) {
        this.bot = bot;
        this.sessionManager = sessionManager;
    }

    async handleStatistics(msg) {
        const stats = this.sessionManager.getStatistics();
        const message = `📊 **СТАТИСТИКА СИСТЕМЫ**\n\n` +
                       `👥 **Пользователи:**\n` +
                       `• Всего: ${stats.totalUsers}\n` +
                       `• Активных: ${stats.activeUsers}\n\n` +
                       `📸 **Обработка фото:**\n` +
                       `• Фото обработано: ${stats.totalPhotos}\n` +
                       `• Анализов проведено: ${stats.totalAnalyses}\n` +
                       `• Сравнений сделано: ${stats.comparisonsMade}\n\n` +
                       `🕵️♂️ **Активные сессии:**\n` +
                       `• Сессий анализа: ${stats.activeSessions}\n` +
                       `• Сохраненных эталонов: ${stats.referencePrintsCount}\n\n` +
                       `📅 **Последний анализ:** ${this.sessionManager.globalStats.lastAnalysis ?
                              this.sessionManager.globalStats.lastAnalysis.toLocaleString('ru-RU') : 'еще нет'}`;

        await this.bot.sendMessage(msg.chat.id, message);
    }
}

module.exports = StatisticsHandler;
