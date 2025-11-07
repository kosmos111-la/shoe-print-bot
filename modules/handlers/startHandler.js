const DataManager = require('../storage/dataManager');

class StartHandler {
    constructor(bot, sessionManager) {
        this.bot = bot;
        this.sessionManager = sessionManager;
    }

    async handleStart(msg) {
        const userId = msg.from.id;
        const username = msg.from.username || msg.from.first_name;
        const chatId = msg.chat.id;
       
        console.log(`🛡️  /start от ${username} (ID: ${userId})`);

        try {
            // 🔄 БЕЗОПАСНАЯ МИГРАЦИЯ: ОБНОВЛЯЕМ ОБЕ СИСТЕМЫ
            console.log('   🔄 Обновление статистики в обеих системах...');
           
            // 1. 📊 НОВАЯ СИСТЕМА (newSessionManager)
            this.sessionManager.updateUserStats(userId, username);
            console.log('      ✅ Новая система обновлена');
           
            // 2. 📊 СТАРАЯ СИСТЕМА (DataManager) - для обратной совместимости
            DataManager.updateUserStats(userId, username);
            console.log('      ✅ Старая система обновлена');
           
            // 3. 🎯 ОСНОВНАЯ ЛОГИКА
            await this.showMainMenu(chatId);
           
            console.log(`🛡️  /start для ${username} завершен успешно`);
           
        } catch (error) {
            console.log(`❌ Ошибка в /start для ${username}:`, error.message);
           
            // 🆘 АВАРИЙНЫЙ РЕЖИМ: пробуем использовать только старую систему
            try {
                DataManager.updateUserStats(userId, username);
                await this.showMainMenu(chatId);
                console.log('✅ Восстановлено через старую систему');
            } catch (fallbackError) {
                console.log('🚨 Критическая ошибка:', fallbackError.message);
                await this.bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
            }
        }
    }

    async showMainMenu(chatId) {
        // Пока оставим старую функцию, потом тоже вынесем
        const session = this.sessionManager.trailSessions.get(chatId);
        const hasActiveSession = session && session.status === 'active';
        const footprintsCount = hasActiveSession ? session.footprints.length : 0;
       
        const menuKeyboard = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🕵️‍♂️ Начать анализ тропы", callback_data: "start_trail_analysis" },
                        { text: "📸 Анализ одного следа", callback_data: "single_analysis" }
                    ],
                    // ... остальная клавиатура
                ]
            }
        };
       
        let message = `🤖 **СИСТЕМА КРИМИНАЛИСТИЧЕСКОЙ ЭКСПЕРТИЗЫ**\n\n`;
       
        if (hasActiveSession) {
            message += `🟢 **АКТИВНА СЕССИЯ АНАЛИЗА**\n`;
            message += `• Следов: ${footprintsCount}\n`;
            message += `• ID: ${session.sessionId}\n`;
            message += `• Эксперт: ${session.expert}\n\n`;
        } else {
            message += `📊 **Статистика системы:**\n`;
            message += `• Экспертов: ${this.sessionManager.globalStats.totalUsers}\n`;
            message += `• Отпечатков: ${this.sessionManager.globalStats.totalPhotos}\n`;
            message += `• Анализов: ${this.sessionManager.globalStats.totalAnalyses}\n\n`;
        }
       
        message += `🎮 **Выберите действие:**`;
       
        await this.bot.sendMessage(chatId, message, menuKeyboard);
    }
}

module.exports = StartHandler;
