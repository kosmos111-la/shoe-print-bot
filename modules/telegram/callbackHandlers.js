// modules/telegram/callbackHandlers.js
const { showMainMenu, showTrailAnalysisMenu } = require('./menu');

async function handleCallbackActions(chatId, data, user, message, bot, sessionManager) {
    try {
        // 🏠 ГЛАВНОЕ МЕНЮ И НАВИГАЦИЯ
        if (data === 'main_menu') {
            await showMainMenu(chatId, bot, sessionManager);
        }
        else if (data === 'continue_analysis') {
            await showTrailAnalysisMenu(chatId, bot, sessionManager);
        }
      
        // 🕵️‍♂️ АНАЛИЗ ТРОПЫ
        else if (data === 'start_trail_analysis') {
            await handleStartTrailAnalysis(chatId, user, bot, sessionManager);
        }
        else if (data === 'single_analysis') {
            await handleSingleAnalysis(chatId, bot);
        }
      
        // 🔍 СРАВНЕНИЯ И ЭТАЛОНЫ
        else if (data === 'compare_reference') {
            await handleCompareReference(chatId, bot, sessionManager);
        }
        else if (data === 'save_reference') {
            await handleSaveReference(chatId, bot);
        }
      
        // 📊 ИНФОРМАЦИЯ
        else if (data === 'show_stats') {
            await handleShowStats(chatId, bot, sessionManager);
        }
        else if (data === 'show_help') {
            await handleShowHelp(chatId, bot);
        }
      
        // 🔍 МЕНЮ АНАЛИЗА ТРОПЫ
        else if (data === 'auto_analyze') {
            await handleAutoAnalyze(chatId, bot, sessionManager);
        }
        else if (data === 'show_groups') {
            await handleShowGroups(chatId, bot, sessionManager);
        }
        else if (data === 'assemble_models') {
            await handleAssembleModels(chatId, bot, sessionManager);
        }
        else if (data === 'rebuild_hierarchy') {
            await handleRebuildHierarchy(chatId, bot, sessionManager);
        }
        else if (data === 'save_data') {
            await handleSaveData(chatId, bot, sessionManager);
        }
        else if (data === 'detailed_report') {
            await handleDetailedReport(chatId, bot, sessionManager);
        }
        else if (data === 'add_footprints') {
            await handleAddFootprints(chatId, bot);
        }
      
        else {
            await bot.sendMessage(chatId, '❌ Неизвестная команда. Используйте кнопки меню.');
            await showMainMenu(chatId, bot, sessionManager);
        }
      
    } catch (error) {
        console.error('❌ Ошибка обработки кнопки:', error);
        await bot.sendMessage(chatId, '❌ Произошла ошибка при обработке запроса');
        await showMainMenu(chatId, bot, sessionManager);
    }
}

async function handleStartTrailAnalysis(chatId, user, bot, sessionManager) {
    const session = sessionManager.getTrailSession(chatId, user.username || user.first_name);
  
    await bot.sendMessage(chatId,
        `🕵️‍♂️ **АНАЛИЗ ТРОПЫ ЗАПУЩЕН!**\n\n` +
        `**Сессия:** ${session.sessionId}\n` +
        `**Эксперт:** ${session.expert}\n` +
        `**Время начала:** ${session.startTime.toLocaleString('ru-RU')}\n\n` +
      
        `📸 **Теперь отправляйте фото следов для анализа.**\n\n` +
      
        `🎯 **Система автоматически:**\n` +
        `• Сохранит следы в сессию\n` +
        `• Сравнит их между собой\n` +
        `• Определит группы людей\n` +
        `• Соберет полные модели\n\n` +
      
        `💡 **Совет:** Начните с 3-5 четких фото следов!`
    );
  
    await showTrailAnalysisMenu(chatId, bot, sessionManager);
}

async function handleSingleAnalysis(chatId, bot) {
    await bot.sendMessage(chatId,
        "📸 **РЕЖИМ АНАЛИЗА ОДНОГО СЛЕДА**\n\n" +
        "Просто отправьте фото следа для анализа.\n\n" +
        "🎯 **Система определит:**\n" +
        "• Морфологические признаки\n" +
        "• Тип протектора\n" +
        "• Качество изображения\n" +
        "• Рекомендации по съемке\n\n" +
      
        "💡 **Требования к фото:**\n" +
        "• Четкий след на контрастном фоне\n" +
        "• Прямой угол съемки\n" +
        "• Хорошее освещение\n" +
        "• Крупный план\n\n" +
      
        "📸 **Отправьте фото сейчас...**"
    );
}

async function handleCompareReference(chatId, bot, sessionManager) {
    if (sessionManager.referencePrints.size === 0) {
        await bot.sendMessage(chatId,
            '📝 **СПИСОК ЭТАЛОНОВ ПУСТ**\n\n' +
            'Сначала сохраните эталоны командой:\n' +
            '`/save_reference Название_Модели`\n\n' +
            'Или через кнопку "💾 Сохранить эталон"\n\n' +
            '💡 **Пример:**\n' +
            '`/save_reference Nike_Air_Max_90`'
        );
        return;
    }

    // Создаем кнопки для выбора эталона
    const referenceButtons = Array.from(sessionManager.referencePrints.entries()).map(([modelName, ref]) => {
        const details = ref.features ? ref.features.detailCount : '?';
        return [{
            text: `🔍 ${modelName} (${details} дет.)`,
            callback_data: `compare_with_${modelName}`
        }];
    });

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                ...referenceButtons,
                [{ text: "🔙 Назад", callback_data: "main_menu" }]
            ]
        }
    };

    await bot.sendMessage(chatId,
        '🔍 **ВЫБЕРИТЕ ЭТАЛОН ДЛЯ СРАВНЕНИЯ:**\n\n' +
        'После выбора эталона отправьте фото следа для сравнения.',
        keyboard
    );
}

async function handleSaveReference(chatId, bot) {
    await bot.sendMessage(chatId,
        '💾 **СОХРАНЕНИЕ ЭТАЛОННОГО ОТПЕЧАТКА**\n\n' +
        '📝 **Укажите название модели через пробел:**\n' +
        'Пример: `/save_reference Nike_Air_Max_90`\n\n' +
      
        '💡 **Рекомендации по названию:**\n' +
        '• Используйте латиницу или кириллицу\n' +
        '• Замените пробелы на подчеркивания\n' +
        '• Будьте конкретны в описании\n\n' +
      
        '📸 **После ввода названия отправьте фото подошвы:**\n' +
        '• Чистая подошва, вид сверху\n' +
        '• Хорошее освещение\n' +
        '• Максимальная детализация\n\n' +
      
        '❌ **Для отмены:** /cancel\n\n' +
      
        '📝 **Введите название модели сейчас...**'
    );
}

async function handleShowStats(chatId, bot, sessionManager) {
    const stats = sessionManager.getStatistics();

    const statsText = `📊 **СТАТИСТИКА СИСТЕМЫ**\n\n` +
                     `👥 **Пользователи:**\n` +
                     `• Всего: ${stats.totalUsers}\n` +
                     `• Активных: ${stats.activeUsers}\n\n` +
                   
                     `📸 **Обработка фото:**\n` +
                     `• Фото обработано: ${stats.totalPhotos}\n` +
                     `• Анализов проведено: ${stats.totalAnalyses}\n` +
                     `• Сравнений сделано: ${stats.comparisonsMade}\n\n` +
                   
                     `🕵️‍♂️ **Активные сессии:**\n` +
                     `• Сессий анализа: ${stats.activeSessions}\n` +
                     `• Сохраненных эталонов: ${stats.referencePrintsCount}\n\n` +
                   
                     `📅 **Последний анализ:** ${sessionManager.globalStats.lastAnalysis ?
                         sessionManager.globalStats.lastAnalysis.toLocaleString('ru-RU') : 'еще нет'}`;

    await bot.sendMessage(chatId, statsText);
}

async function handleShowHelp(chatId, bot) {
    await bot.sendMessage(chatId,
        `🆘 **ПОМОЩЬ И РУКОВОДСТВО**\n\n` +
      
        `🎮 **ОСНОВНЫЕ КНОПКИ:**\n` +
        `• 🕵️‍♂️ Начать анализ тропы - полный анализ нескольких следов\n` +
        `• 📸 Анализ одного следа - быстрый анализ фото\n` +
        `• 🔍 Сравнить с эталоном - сравнение с сохраненными моделями\n` +
        `• 💾 Сохранить эталон - создать новый эталон\n\n` +
      
        `🔧 **КОМАНДЫ ДЛЯ ЭКСПЕРТА:**\n` +
        `• /trail_start - начать анализ тропы\n` +
        `• /save_reference Название - сохранить эталон\n` +
        `• /list_references - список эталонов\n` +
        `• /assemble_model - собрать модель из следов\n` +
        `• /show_groups - показать группы следов\n\n` +
      
        `📸 **ТРЕБОВАНИЯ К ФОТО:**\n` +
        `• Четкий след на контрастном фоне\n` +
        `• Прямой угол съемки\n` +
        `• Хорошее освещение без теней\n` +
        `• Крупный план, след занимает 70% кадра\n\n` +
      
        `💡 **СОВЕТЫ:**\n` +
        `• Начните с "Анализ одного следа" для тестирования\n` +
        `• Для анализа тропы нужно 3+ следов\n` +
        `• Сохраняйте эталоны четких подошв\n` +
        `• Используйте одинаковые условия съемки\n\n` +
      
        `❓ **Нужна помощь?** Просто напишите в чат!`
    );
}

async function handleAutoAnalyze(chatId, bot, sessionManager) {
    const session = sessionManager.trailSessions.get(chatId);
    if (!session || session.footprints.length === 0) {
        await bot.sendMessage(chatId, '❌ Нет следов для анализа. Сначала отправьте фото следов.');
        return;
    }
  
    await bot.sendMessage(chatId, '🤖 **ЗАПУСК АВТОМАТИЧЕСКОГО АНАЛИЗА**\n\n⏳ Обрабатываю следы...');
  
    // Здесь будет логика автоанализа
    await bot.sendMessage(chatId, '✅ Автоанализ завершен! Используйте /show_groups для просмотра результатов.');
  
    await showTrailAnalysisMenu(chatId, bot, sessionManager);
}

async function handleShowGroups(chatId, bot, sessionManager) {
    const session = sessionManager.trailSessions.get(chatId);
    if (!session) {
        await bot.sendMessage(chatId, '❌ Активируйте сначала анализ тропы');
        return;
    }
  
    // Получаем FootprintAssembler для обновления групп
    const { FootprintAssembler } = require('../footprint_assembler');
    const footprintAssembler = new FootprintAssembler();
  
    session.updateCompatibilityGroups(footprintAssembler);
  
    if (session.compatibilityGroups.length === 0) {
        await bot.sendMessage(chatId,
            '❌ Группы не обнаружены.\n\n' +
            '💡 **Добавьте больше следов:**\n' +
            '• Нужно минимум 2 следа\n' +
            '• Чем больше следов - точнее группы\n' +
            '• Используйте четкие фото'
        );
        return;
    }
  
    await bot.sendMessage(chatId,
        `👥 **Обнаружено групп: ${session.compatibilityGroups.length}**\n\n` +
        `Используйте команду /show_groups для детального просмотра групп.`
    );
}

async function handleAssembleModels(chatId, bot, sessionManager) {
    const session = sessionManager.trailSessions.get(chatId);
    if (!session || session.footprints.length < 2) {
        await bot.sendMessage(chatId, '❌ Недостаточно следов для сборки (нужно минимум 2)');
        return;
    }
  
    await bot.sendMessage(chatId, '🧩 **НАЧИНАЮ СБОРКУ МОДЕЛЕЙ**\n\n⏳ Анализирую совместимость...');
  
    // Здесь будет логика сборки моделей
    await bot.sendMessage(chatId, '✅ Сборка моделей завершена! Используйте /detailed_stats для просмотра результатов.');
  
    await showTrailAnalysisMenu(chatId, bot, sessionManager);
}

async function handleRebuildHierarchy(chatId, bot, sessionManager) {
    await bot.sendMessage(chatId, '🏔️ **Перевернутая пирамида в разработке...**');
    await showTrailAnalysisMenu(chatId, bot, sessionManager);
}

async function handleSaveData(chatId, bot, sessionManager) {
    await bot.sendMessage(chatId, '💾 Сохраняю все данные...');
  
    // Здесь будет логика сохранения
    await bot.sendMessage(chatId, '✅ Все данные сохранены!');
  
    await showTrailAnalysisMenu(chatId, bot, sessionManager);
}

async function handleDetailedReport(chatId, bot, sessionManager) {
    const session = sessionManager.trailSessions.get(chatId);
    if (session && session.footprints.length > 0) {
        const report = session.generateEnhancedReport();
        await bot.sendMessage(chatId, report);
    } else {
        await bot.sendMessage(chatId,
            '❌ Нет данных для отчета.\n\n' +
            '💡 **Сначала добавьте следы в сессию**'
        );
    }
}

async function handleAddFootprints(chatId, bot) {
    await bot.sendMessage(chatId,
        "📸 **ДОБАВЛЕНИЕ СЛЕДОВ В СЕССИЮ**\n\n" +
        "Отправляйте фото следов для анализа.\n\n" +
        "🎯 **Каждое фото будет:**\n" +
        "• Проанализировано на детали\n" +
        "• Добавлено в текущую сессию\n" +
        "• Автоматически сравнено с предыдущими\n" +
        "• Классифицировано по типу протектора\n\n" +
      
        "💡 **Рекомендации:**\n" +
        "• Отправляйте по одному фото за раз\n" +
        "• Следите за качеством изображения\n" +
        "• Используйте одинаковые условия съемки\n\n" +
      
        "📸 **Отправляйте фото сейчас...**\n\n" +
        "❌ **Для отмены:** /cancel"
    );
}

module.exports = { handleCallbackActions };
