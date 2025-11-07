// modules/telegram/menu.js

async function showMainMenu(chatId, bot, sessionManager) {
    const session = sessionManager.trailSessions.get(chatId);
    const hasActiveSession = session && session.status === 'active';
    const footprintsCount = hasActiveSession ? session.footprints.length : 0;
  
    const menuKeyboard = {
        reply_markup: {
            inline_keyboard: [
                // Основные действия
                [
                    { text: "🕵️‍♂️ Начать анализ тропы", callback_data: "start_trail_analysis" },
                    { text: "📸 Анализ одного следа", callback_data: "single_analysis" }
                ],
                // Сравнения и эталоны
                [
                    { text: "🔍 Сравнить с эталоном", callback_data: "compare_reference" },
                    { text: "💾 Сохранить эталон", callback_data: "save_reference" }
                ],
                // Информация
                [
                    { text: "📊 Статистика системы", callback_data: "show_stats" },
                    { text: "ℹ️ Помощь", callback_data: "show_help" }
                ],
                // Если есть активная сессия - быстрый доступ
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
        const stats = sessionManager.getStatistics();
        message += `📊 **Статистика системы:**\n`;
        message += `• Экспертов: ${stats.totalUsers}\n`;
        message += `• Отпечатков: ${stats.totalPhotos}\n`;
        message += `• Анализов: ${stats.totalAnalyses}\n\n`;
    }
  
    message += `🎮 **Выберите действие:**`;
  
    await bot.sendMessage(chatId, message, menuKeyboard);
}

async function showTrailAnalysisMenu(chatId, bot, sessionManager) {
    const session = sessionManager.trailSessions.get(chatId);
    const footprintsCount = session ? session.footprints.length : 0;
    const modelsCount = session ? session.assembledModels.length : 0;
    const groupsCount = session ? (session.compatibilityGroups ? session.compatibilityGroups.length : 0) : 0;
    const comparisonsCount = session ? session.comparisons.length : 0;
  
    const trailKeyboard = {
        reply_markup: {
            inline_keyboard: [
                // Основные действия
                [
                    { text: "📸 Добавить следы", callback_data: "add_footprints" },
                    { text: "🔄 Автоанализ", callback_data: "auto_analyze" }
                ],
                // Анализ и группировка
                [
                    { text: `👥 Группы (${groupsCount})`, callback_data: "show_groups" },
                    { text: `🧩 Собрать модели`, callback_data: "assemble_models" }
                ],
                // Продвинутые функции
                [
                    { text: "🏔️ Умный анализ", callback_data: "rebuild_hierarchy" },
                    { text: "📈 Отчет", callback_data: "detailed_report" }
                ],
                // Управление данными
                [
                    { text: "💾 Сохранить", callback_data: "save_data" },
                    { text: "🔙 Главное меню", callback_data: "main_menu" }
                ]
            ]
        }
    };
  
    let message = `🔍 **РЕЖИМ АНАЛИЗА ТРОПЫ**\n\n`;
  
    if (session) {
        message += `📊 **Статус сессии:**\n`;
        message += `• ID: ${session.sessionId}\n`;
        message += `• Статус: ${session.status === 'active' ? '🟢 АКТИВНА' : '🔴 ЗАВЕРШЕНА'}\n`;
        message += `• Следов: ${footprintsCount}\n`;
        message += `• Групп: ${groupsCount}\n`;
        message += `• Моделей: ${modelsCount}\n`;
        message += `• Сравнений: ${comparisonsCount}\n`;
        message += `• Эксперт: ${session.expert}\n\n`;
    } else {
        message += `❌ **Сессия не активна**\n\n`;
    }
  
    message += `🎮 **Выберите действие:**`;
  
    await bot.sendMessage(chatId, message, trailKeyboard);
}

module.exports = { showMainMenu, showTrailAnalysisMenu };
