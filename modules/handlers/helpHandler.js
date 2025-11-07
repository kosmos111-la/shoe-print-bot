const fs = require('fs');

class HelpHandler {
    constructor(bot, sessionManager) {
        this.bot = bot;
        this.sessionManager = sessionManager;
    }

    /**
     * Показывает общий FAQ для всех пользователей
     */
    async showGeneralHelp(chatId, userId) {
        const isAdmin = await this.isAdmin(userId);
       
        let helpText = `🤖 **ПОМОЩЬ ПО СИСТЕМЕ АНАЛИЗА СЛЕДОВ**\n\n`;

        helpText += `🎯 **ОСНОВНЫЕ КОМАНДЫ:**\n`;
        helpText += `• /start - запуск бота\n`;
        helpText += `• /menu - главное меню с кнопками\n`;
        helpText += `• /help - эта справка\n`;
        helpText += `• Просто отправьте фото - быстрый анализ следа\n\n`;

        helpText += `🕵️‍♂️ **РЕЖИМ АНАЛИЗА ТРОПЫ:**\n`;
        helpText += `• /trail_start - начать сессию анализа\n`;
        helpText += `• /trail_status - статус текущей сессии\n`;
        helpText += `• /trail_report - экспертное заключение\n`;
        helpText += `• /trail_notes [текст] - добавить заметки\n`;
        helpText += `• /trail_finish - завершить сессию\n\n`;

        helpText += `🔍 **СРАВНЕНИЕ И ЭТАЛОНЫ:**\n`;
        helpText += `• /save_reference [название] - сохранить эталон\n`;
        helpText += `• /list_references - список эталонов\n`;
        helpText += `• /compare [модель] - сравнить с эталоном\n`;
        helpText += `• /compare_footprints 1 2 - сравнить два следа\n\n`;

        helpText += `🧩 **СБОРКА МОДЕЛЕЙ:**\n`;
        helpText += `• /assemble_model - собрать модель из следов\n`;
        helpText += `• /show_groups - показать группы людей\n`;
        helpText += `• /assemble_from_group 1 - собрать из группы\n`;
        helpText += `• /save_assembled [название] - сохранить модель\n\n`;

        helpText += `🎨 **ВИЗУАЛИЗАЦИЯ:**\n`;
        helpText += `• /visualize_results - все модели с картинками\n`;
        helpText += `• /show_model 1 - показать модель\n`;
        helpText += `• /model_details 1 - детальная визуализация\n\n`;

        helpText += `📊 **СТАТИСТИКА:**\n`;
        helpText += `• /statistics - общая статистика\n`;
        helpText += `• /detailed_stats - расширенная статистика\n`;

        if (isAdmin) {
            helpText += `\n⚙️ **АДМИНСКИЕ КОМАНДЫ:**\n`;
            helpText += `• /admin_stats - детальная статистика\n`;
            helpText += `• /admin_export - экспорт всех данных\n`;
            helpText += `• /admin_cleanup - очистка старых данных\n`;
            helpText += `• /admin_debug - отладочная информация\n`;
        }

        helpText += `\n💡 **СОВЕТ:** Используйте кнопки меню для удобной навигации!`;

        await this.bot.sendMessage(chatId, helpText);
    }

    /**
     * Детальная справка по режиму тропы
     */
    async showTrailHelp(chatId) {
        const helpText = `🕵️‍♂️ **РЕЖИМ АНАЛИЗА ТРОПЫ - ПОЛНОЕ РУКОВОДСТВО**\n\n`

        + `📋 **ЧТО ЭТО ТАКОЕ?**\n`
        + `Режим для анализа нескольких следов от разных людей. Система автоматически группирует следы по людям и собирает полные модели.\n\n`

        + `🎯 **ПОШАГОВЫЙ ПЛАН:**\n`
        + `1. /trail_start - начать сессию\n`
        + `2. 📸 Отправлять фото следов (3-10 штук)\n`
        + `3. /show_groups - посмотреть группы людей\n`
        + `4. /assemble_model - собрать модели\n`
        + `5. /visualize_results - посмотреть результат\n`
        + `6. /trail_finish - завершить\n\n`

        + `🔧 **КОМАНДЫ ЭКСПЕРТА:**\n`
        + `• /trail_status - текущий статус\n`
        + `• /trail_report - экспертное заключение\n`
        + `• /trail_notes "Заметка" - добавить текст\n`
        + `• /compare_footprints 1 3 - сравнить следы\n\n`

        + `💡 **РЕКОМЕНДАЦИИ:**\n`
        + `• Минимум 3 следа для анализа\n`
        + `• Чем больше следов - точнее группы\n`
        + `• Используйте разные ракурсы\n`
        + `• Сохраняйте эталоны четких следов`;

        await this.bot.sendMessage(chatId, helpText);
    }

    /**
     * Справка по визуализации
     */
    async showVisualizationHelp(chatId) {
        const helpText = `🎨 **ВИЗУАЛИЗАЦИЯ - ПОЛНОЕ РУКОВОДСТВО**\n\n`

        + `📊 **ЧТО ПОКАЗЫВАЕТ ВИЗУАЛИЗАЦИЯ?**\n`
        + `• Наложение нескольких следов разными цветами\n`
        + `• Зоны сходимости и различий\n`
        + `• Полноту собранной модели\n`
        + `• Уверенность системы в результате\n\n`

        + `🎯 **КОМАНДЫ ВИЗУАЛИЗАЦИИ:**\n`
        + `• /visualize_results - все модели\n`
        + `• /show_model 1 - конкретная модель\n`
        + `• /model_details 1 - детальный анализ\n\n`

        + `🌈 **ЛЕГЕНДА ЦВЕТОВ:**\n`
        + `• 🔴 Красный - первый след\n`
        + `• 🟢 Зеленый - второй след  \n`
        + `• 🔵 Синий - третий след\n`
        + `• 🟡 Желтый - четвертый след\n`
        + `• И т.д. - разные цвета для каждого следа\n\n`

        + `💡 **ИНТЕРПРЕТАЦИЯ:**\n`
        + `• Перекрывающиеся области - совпадения\n`
        + `• Разные цвета в одной зоне - различия\n`
        + `• Сплошные линии - контуры\n`
        + `• Пунктирные линии - детали протектора`;

        await this.bot.sendMessage(chatId, helpText);
    }

    /**
     * Справка по сборке моделей
     */
    async showAssemblyHelp(chatId) {
        const helpText = `🧩 **СБОРКА МОДЕЛЕЙ - ПОЛНОЕ РУКОВОДСТВО**\n\n`

        + `🎯 **ЧТО ТАКОЕ СБОРКА МОДЕЛЕЙ?**\n`
        + `Автоматическое создание полной модели подошвы из нескольких частичных следов.\n\n`

        + `🔧 **КАК РАБОТАЕТ:**\n`
        + `1. Анализирует геометрию каждого следа\n`
        + `2. Определяет левый/правый/центральный\n`
        + `3. Группирует совместимые следы\n`
        + `4. Собирает полную модель\n\n`

        + `📊 **КОМАНДЫ СБОРКИ:**\n`
        + `• /assemble_model - автоматическая сборка\n`
        + `• /show_groups - посмотреть группы\n`
        + `• /assemble_from_group 1 - сборка из группы\n`
        + `• /save_assembled "Название" - сохранить\n\n`

        + `💡 **МЕТРИКИ КАЧЕСТВА:**\n`
        + `• **Полнота** - насколько полная модель\n`
        + `• **Уверенность** - точность сборки\n`
        + `• **Использовано следов** - сколько частей\n\n`

        + `🎯 **РЕКОМЕНДАЦИИ:**\n`
        + `• Нужно минимум 2 следа\n`
        + `• Идеально 4-6 следов\n`
        + `• Разные ракурсы улучшают качество\n`
        + `• Четкие фото = выше уверенность`;

        await this.bot.sendMessage(chatId, helpText);
    }

    /**
     * Админские команды (только для админа)
     */
    async showAdminHelp(chatId, userId) {
        if (!await this.isAdmin(userId)) {
            await this.bot.sendMessage(chatId, '❌ Доступ запрещен');
            return;
        }

        const helpText = `⚙️ **АДМИНСКИЕ КОМАНДЫ - ТОЛЬКО ДЛЯ АДМИНИСТРАТОРА**\n\n`

        + `📊 **СТАТИСТИКА И МОНИТОРИНГ:**\n`
        + `• /admin_stats - детальная статистика\n`
        + `• /admin_users - список пользователей\n`
        + `• /admin_sessions - активные сессии\n`
        + `• /admin_models - все собранные модели\n\n`

        + `💾 **УПРАВЛЕНИЕ ДАННЫМИ:**\n`
        + `• /admin_export - экспорт всех данных\n`
        + `• /admin_backup - принудительный бэкап\n`
        + `• /admin_cleanup - очистка старых данных\n`
        + `• /admin_reset_stats - сброс статистики\n\n`

        + `🔧 **СИСТЕМНЫЕ КОМАНДЫ:**\n`
        + `• /admin_debug - отладочная информация\n`
        + `• /admin_restart - перезапуск сервисов\n`
        + `• /admin_logs - последние логи\n`
        + `• /admin_status - статус системы\n\n`

        + `⚠️ **ВНИМАНИЕ:** Эти команды влияют на всю систему!`;

        await this.bot.sendMessage(chatId, helpText);
    }

    /**
     * Проверка прав администратора
     */
    async isAdmin(userId) {
        // 🔧 ЗАМЕНИТЕ НА ВАШ ID
        const adminIds = [699140291]; // Ваш Telegram ID
        return adminIds.includes(userId);
    }

    /**
     * Показывает интерактивное меню помощи
     */
    async showInteractiveHelp(chatId, userId) {
        const isAdmin = await this.isAdmin(userId);

        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🕵️‍♂️ Режим тропы", callback_data: "help_trail" },
                        { text: "🎨 Визуализация", callback_data: "help_visualization" }
                    ],
                    [
                        { text: "🧩 Сборка моделей", callback_data: "help_assembly" },
                        { text: "🔍 Сравнение", callback_data: "help_comparison" }
                    ],
                    [
                        { text: "📊 Статистика", callback_data: "help_stats" },
                        { text: "💾 Сохранение", callback_data: "help_storage" }
                    ],
                    isAdmin ? [
                        { text: "⚙️ Админские команды", callback_data: "help_admin" }
                    ] : [],
                    [
                        { text: "❌ Закрыть", callback_data: "help_close" }
                ]
                ].filter(row => row.length > 0)
            }
        };

        await this.bot.sendMessage(chatId,
            `📚 **ИНТЕРАКТИВНАЯ СПРАВКА**\n\n` +
            `Выберите раздел для подробного объяснения:`,
            keyboard
        );
    }
}

module.exports = HelpHandler;
