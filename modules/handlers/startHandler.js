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
    try {
        // 🔧 ДОБАВЛЯЕМ ПРОВЕРКИ НА ОШИБКИ
        if (!this.sessionManager || !this.sessionManager.trailSessions) {
            console.log('⚠️ SessionManager не готов, используем базовое меню');
            return await this.showBasicMenu(chatId);
        }

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
                    [
                        { text: "🔍 Сравнить с эталоном", callback_data: "compare_reference" },
                        { text: "💾 Сохранить эталон", callback_data: "save_reference" }
                    ],
                    [
                        { text: "📊 Статистика системы", callback_data: "show_stats" },
                        { text: "ℹ️ Помощь", callback_data: "show_help" }
                    ],
                    hasActiveSession ? [
                        { text: `🔍 Продолжить анализ (${footprintsCount} следов)`, callback_data: "continue_analysis" }
                    ] : []
                ].filter(row => row.length > 0)
            }
        };

        let message = `🤖 **СИСТЕМА КРИМИНАЛИСТИЧЕСКОЙ ЭКСПЕРТИЗЫ**\n\n`;

        if (hasActiveSession) {
            message += `🟢 **АКТИВНА СЕССИЯ АНАЛИЗА**\n`;
            message += `• Следов: ${footprintsCount}\n`;
            message += `• ID: ${session.sessionId}\n`;
            message += `• Эксперт: ${session.expert}\n\n`;
        } else {
            // 🔧 БЕЗОПАСНЫЙ ДОСТУП К СТАТИСТИКЕ
            const stats = this.sessionManager.getStatistics ?
                this.sessionManager.getStatistics() :
                { totalUsers: 1, totalPhotos: 0, totalAnalyses: 0 };
               
            message += `📊 **Статистика системы:**\n`;
            message += `• Экспертов: ${stats.totalUsers}\n`;
            message += `• Отпечатков: ${stats.totalPhotos}\n`;
            message += `• Анализов: ${stats.totalAnalyses}\n\n`;
        }

        message += `🎮 **Выберите действие:**`;

        await this.bot.sendMessage(chatId, message, menuKeyboard);
       
    } catch (error) {
        console.log('❌ Ошибка в showMainMenu:', error.message);
        // 🔧 ВСЕГДА ВОЗВРАЩАЕМ РАБОЧЕЕ МЕНЮ ДАЖЕ ПРИ ОШИБКАХ
        return await this.showBasicMenu(chatId);
    }
}

// 🔧 ДОБАВЛЯЕМ РЕЗЕРВНЫЙ МЕТОД (ЕСЛИ ЕГО ЕЩЕ НЕТ)
async showBasicMenu(chatId) {
    const menuKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🕵️‍♂️ Начать анализ тропы", callback_data: "start_trail_analysis" },
                    { text: "📸 Анализ одного следа", callback_data: "single_analysis" }
                ],
                [
                    { text: "ℹ️ Помощь", callback_data: "show_help" }
                ]
            ]
        }
    };
   
    await this.bot.sendMessage(chatId,
        '🤖 **СИСТЕМА АНАЛИЗА СЛЕДОВ ОБУВИ**\n\n' +
        '🎯 **Основные команды:**\n' +
        '• /trail_start - начать анализ тропы\n' + 
        '• Отправьте фото - анализ следа\n' +
        '• /help - справка по командам\n\n' +
        '💡 **Система готова к работе!**',
        menuKeyboard
    );
}

module.exports = StartHandler;
