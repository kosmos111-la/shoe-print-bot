// src/handlers/commands.handler.js
// 📋 ВСЕ КОМАНДЫ БОТА (вынесено из main.js на Этапе D)
// Секции: системные, обратная связь, стили, калькуляторы, сессии,
//         следы, Яндекс.Диск, модели отпечатков, визуализация, callback, диагностика.

const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Чистые утилиты (Этап A)
const { escapeHtml, isCoordinates, parseDateTime, getCorrectionDescription } = require('../utils/text');
const { smartPostProcessing, analyzePredictions, generateTopologyText } = require('../utils/predictions');
const { getContourCenter, rotatePredictions, normalizeFootprintOrientation } = require('../utils/geometry');
// Централизованное состояние (Этап A)
const store = require('../state/store');
const { userStats, globalStats, userLastAnalysis, photoBatchDetector, photoQueue, processingUsers } = store;

/**
 * Регистрирует все текстовые команды бота.
 * @param {TelegramBot} bot - экземпляр бота
 * @param {Object} ctx - контекст с геттерами на глобальные объекты main.js
 */
module.exports = function registerCommandsHandler(bot, ctx) {

// ===== HELPERS: получение моделей пользователя (обёртка над getPermanentModels) =====
// SimpleFootprintManager хранит модели как { id, name, model, stats },
// где model = SimpleFootprint c полями graph/metadata/photoHistory/userId/stats/name.
// Распаковываем в плоский формат, который ожидают команды.
function getUserModels(userId) {
    const fm = ctx.footprintManager;
    if (!fm || typeof fm.getPermanentModels !== 'function') return [];
    return fm.getPermanentModels(userId).map(m => ({
        id: m.id,
        name: (m.model && m.model.name) || m.name || 'Без имени',
        graph: m.model && m.model.graph,
        metadata: (m.model && m.model.metadata) || {},
        photoHistory: (m.model && m.model.photoHistory) || [],
        userId: (m.model && m.model.userId) || userId,
        stats: (m.model && m.model.stats) || m.stats || {},
        model: m.model || m
    }));
}

function getModelById(modelId) {
    const fm = ctx.footprintManager;
    if (!fm || typeof fm.getPermanentModels !== 'function') return null;
    // getPermanentModels без userId вернёт ВСЕ модели; ищем по id/префиксу
    const all = fm.getPermanentModels();
    const found = all.find(m => m.id === modelId || (m.id && m.id.startsWith(modelId)));
    if (!found) return null;
    return {
        id: found.id,
        name: (found.model && found.model.name) || found.name || 'Без имени',
        graph: found.model && found.model.graph,
        metadata: (found.model && found.model.metadata) || {},
        photoHistory: (found.model && found.model.photoHistory) || [],
        stats: (found.model && found.model.stats) || found.stats || {},
        model: found.model || found
    };
}


// ===== ЛОКАЛЬНОЕ СОСТОЯНИЕ КОМАНД =====

// =============================================================================
// 🧭 СИСТЕМНЫЕ КОМАНДЫ И ОБРАТНАЯ СВЯЗЬ
// =============================================================================


// =============================================================================
// 📌 СИСТЕМНЫЕ КОМАНДЫ И ОБРАТНАЯ СВЯЗЬ
// =============================================================================
bot.onText(/\/start/, (msg) => {
    ctx.updateUserStats(msg.from.id, msg.from.username || msg.from.first_name);

    const currentStyle = ctx.visualization ? ctx.visualization.getUserStyle(msg.from.id) : 'original';
    const styleInfo = ctx.visualization ? ctx.visualization.getAvailableStyles().find(s => s.id === currentStyle) : { name: 'Стиль маски' };

    bot.sendMessage(msg.chat.id,
        `👟 **СИСТЕМА АНАЛИЗА СЛЕДОВ ОБУВИ** 🚀\n\n` +
        `📊 Статистика: ${globalStats.totalUsers} пользователей, ${globalStats.totalPhotos} отпечатков\n\n` +
        `🎨 **Текущий стиль:** ${styleInfo?.name || 'Стиль маски'}\n\n` +
        `🔄 **СЕССИОННЫЙ РЕЖИМ:**\n` +
        `• Отправьте 2+ фото пачкой - автоматический запуск\n` +
        `• Или вручную: /trail_start\n` +
        `• Анализ цепочки следов с отчетом\n\n` +
        `🔍 **ФУНКЦИОНАЛ:**\n` +
        `• Анализ через Roboflow API\n` +
        `• Визуализация контуров\n` +
        `• Топология протектора\n` +
        `• Практический анализ для ПСО\n` +
        `• Фильтрация следов животных\n` +
        `• 🆕 Графовая система автосовмещения\n` +
        `• 🆕 Визуализация объединения следов\n\n` +
        `🧮 **ИНСТРУМЕНТЫ:**\n` +
        `/calculators - Калькуляторы и расчеты\n\n` +
        `🎯 **Команды цифровых отпечатков:**\n` +
        `/footprint_start - Начать сессию отпечатков\n` +
        `/my_footprints - Мои модели отпечатков\n` +
        `/find_similar_footprints - Найти похожие\n` +
        `/footprint_stats - Статистика системы\n\n` +
        `/style - Выбор стиля визуализации\n` +
        `/help - Помощь\n` +
        `/statistics - Статистика\n\n` +
        `📸 **Просто отправьте фото следа обуви**`
    );
});

// Команда /statistics
bot.onText(/\/statistics/, (msg) => {
    const activeUsers = Array.from(userStats.values()).filter(user =>
        (new Date() - user.lastSeen) < 7 * 24 * 60 * 60 * 1000
    ).length;

    const stats = `📊 **СТАТИСТИКА СИСТЕМЫ:**\n\n` +
                 `👥 Пользователи: ${globalStats.totalUsers} (${activeUsers} активных)\n` +
                 `📸 Фото обработано: ${globalStats.totalPhotos}\n` +
                 `🔍 Анализов проведено: ${globalStats.totalAnalyses}\n` +
                 `📅 Последний анализ: ${globalStats.lastAnalysis ?
                     globalStats.lastAnalysis.toLocaleString('ru-RU') : 'еще нет'}\n\n` +
                 `🔄 Активных сессий: ${ctx.sessionManager ? Array.from(ctx.sessionManager.activeSessions.keys()).length : 0}`;

    bot.sendMessage(msg.chat.id, stats);
});

// Команда /feedback_stats - статистика обратной связи
bot.onText(/\/feedback_stats/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const stats = ctx.feedbackDB.getStatistics();
        const accuracy = stats.total > 0 ?
            (stats.correct / stats.total) * 100 : 0;

        let message = `📊 **СТАТИСТИКА ОБРАТНОЙ СВЯЗИ**\n\n`;
        message += `📈 Всего оценок: ${stats.total}\n`;
        message += `✅ Правильных: ${stats.correct} (${accuracy.toFixed(1)}%)\n`;
        message += `🔧 Исправлений: ${stats.total - stats.correct}\n\n`;

        if (Object.keys(stats.correctionsByType || {}).length > 0) {
            message += `📋 **ТИПЫ ИСПРАВЛЕНИЙ:**\n`;
            Object.entries(stats.correctionsByType).forEach(([type, count]) => {
                message += `• ${getCorrectionDescription(type)}: ${count}\n`;
            });
        }

        if (stats.accuracyHistory && stats.accuracyHistory.length > 1) {
            const first = stats.accuracyHistory[0].accuracy;
            const last = stats.accuracyHistory[stats.accuracyHistory.length - 1].accuracy;
            const trend = last - first;

            message += `\n📈 **ТРЕНД ТОЧНОСТИ:** `;
            if (trend > 0) {
                message += `+${trend.toFixed(1)}% улучшение`;
            } else if (trend < 0) {
                message += `${trend.toFixed(1)}% снижение`;
            } else {
                message += `стабильно`;
            }
        }

        message += `\n\n💡 Каждая ваша оценка делает анализ точнее!`;

        await bot.sendMessage(chatId, message);

    } catch (error) {
        console.log('❌ Ошибка статистики:', error);
        await bot.sendMessage(chatId, '❌ Не удалось получить статистику');
    }
});

// Команда /feedback_export - экспорт для переобучения
bot.onText(/\/feedback_export/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Только для администраторов или тестировщиков
    const adminUsers = [699140291]; // Твой ID

    if (!adminUsers.includes(userId)) {
        await bot.sendMessage(chatId,
            `❌ Эта команда только для администраторов\n` +
            `Статистику можно посмотреть: /feedback_stats`
        );
        return;
    }

    try {
        const exportData = ctx.feedbackDB.exportForRoboflow();

        let message = `📤 **ЭКСПОРТ ДАННЫХ ДЛЯ ПЕРЕОБУЧЕНИЯ**\n\n`;
        message += `📊 Всего исправлений: ${exportData.total_corrections}\n`;

        if (exportData.corrections_by_class) {
            message += `📋 **По классам:**\n`;
            Object.entries(exportData.corrections_by_class).forEach(([cls, count]) => {
                message += `• ${cls}: ${count}\n`;
            });
        }

        message += `\n💾 Данные готовы для загрузки в Roboflow\n`;
        message += `📅 Версия: ${exportData.version}`;

        await bot.sendMessage(chatId, message);

        // Можно также сохранить в файл и отправить
        const exportJson = JSON.stringify(exportData, null, 2);
        const tempFile = ctx.tempFileManager.createTempFile('feedback_export', 'json');
        require('fs').writeFileSync(tempFile, exportJson);

        await bot.sendDocument(chatId, tempFile, {
            caption: `feedback_export_${new Date().toISOString().split('T')[0]}.json`
        });

        ctx.tempFileManager.removeFile(tempFile);

    } catch (error) {
        console.log('❌ Ошибка экспорта:', error);
        await bot.sendMessage(chatId, '❌ Не удалось экспортировать данные');
    }
});

// Команда /style

// =============================================================================
// 📌 СТИЛИ ВИЗУАЛИЗАЦИИ
// =============================================================================
bot.onText(/\/style/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const styles = ctx.visualization ? ctx.visualization.getAvailableStyles() : [{ id: 'original', name: 'Оригинальный', description: 'Основной стиль' }];
    const currentStyle = ctx.visualization ? ctx.visualization.getUserStyle(userId) : 'original';
    const currentStyleInfo = styles.find(s => s.id === currentStyle);

    let message = `🎨 **ВЫБОР СТИЛЯ ВИЗУАЛИЗАЦИИ**\n\n`;
    message += `📊 Текущий стиль: ${currentStyleInfo?.name || 'Стиль маски'}\n\n`;
    message += `Доступные стили:\n`;

    styles.forEach(style => {
        const isCurrent = style.id === currentStyle ? ' ✅' : '';
        message += `\n${style.name}${isCurrent}\n`;
        message += `└ ${style.description}\n`;
        message += `└ /setstyle_${style.id}\n`;
    });

    message += `\n💡 Стиль сохранится до перезагрузки бота`;
    message += `\n\n📸 Отправьте фото для анализа в выбранном стиле!`;

    await bot.sendMessage(msg.chat.id, message);
});

// Обработка выбора стиля
bot.onText(/\/setstyle_(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const styleId = match[1];

    if (ctx.visualization && ctx.visualization.setUserStyle(userId, styleId)) {
        const styleName = ctx.visualization.getAvailableStyles().find(s => s.id === styleId)?.name;
        await bot.sendMessage(chatId,
            `✅ Стиль визуализации изменен на: ${styleName}\n\n` +
            `Теперь все новые анализы будут использовать выбранный стиль.\n\n` +
            `Проверить текущий стиль: /currentstyle`
        );
    } else {
        await bot.sendMessage(chatId, '❌ Неизвестный стиль визуализации. Посмотрите доступные: /style');
    }
});

// Команда /currentstyle
bot.onText(/\/currentstyle/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const currentStyle = ctx.visualization ? ctx.visualization.getUserStyle(userId) : 'original';
    const styleInfo = ctx.visualization ? ctx.visualization.getAvailableStyles().find(s => s.id === currentStyle) : { name: 'Оригинальный', description: 'Основной стиль' };

    await bot.sendMessage(chatId,
        `🎨 **ТЕКУЩИЙ СТИЛЬ ВИЗУАЛИЗАЦИИ**\n\n` +
        `📝 ${styleInfo?.name || 'Оригинальный'}\n` +
        `📋 ${styleInfo?.description || 'Цветная визуализация'}\n\n` +
        `Изменить стиль: /style`
    );
});

// =============================================================================
// 🧮 СИСТЕМА КАЛЬКУЛЯТОРОВ
// =============================================================================

// 🎯 ПРАВИЛЬНАЯ СИСТЕМА КОНТЕКСТОВ
const userContext = {};

// Команда /calculators

// =============================================================================
// 📌 КАЛЬКУЛЯТОРЫ
// =============================================================================
bot.onText(/\/calculators/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        const menu = ctx.calculators.getMenu();

        let message = `🧮 ${menu.title}\n\n`;

        menu.sections.forEach(section => {
            message += `📌 ${section.name}\n`;
            message += `└ ${section.description}\n`;
            message += `└ Команда: ${section.command}\n\n`;
        });

        await bot.sendMessage(chatId, message);
    } catch (error) {
        console.log('❌ Ошибка в /calculators:', error);
        await bot.sendMessage(chatId, '❌ Ошибка загрузки калькуляторов');
    }
});

// ❄️ Команда калькулятора давности следа на снегу
bot.onText(/\/calc_snow_age/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // ОЧИЩАЕМ КОНТЕКСТ ПЕРЕД НОВОЙ КОМАНДОЙ
    delete userContext[userId];

    userContext[userId] = 'waiting_snow_age_location';

    await bot.sendMessage(chatId,
        '⏱️❄️ <b>КАЛЬКУЛЯТОР ДАВНОСТИ СЛЕДА НА СНЕГУ</b>\n\n' +
        '🎯 <b>Как это работает:</b>\n\n' +
        '1. 📍 <b>Отправьте местоположение</b> (скрепка → Местоположение)\n\n' +
        '2. 📅 <b>Укажите дату и время пропажи</b>\n' +
        '<code>2024-01-15 08:00</code>\n' +
        '<code>15.01.2024 8:00</code>\n\n' +
        '3. 📏 <b>Отправьте 3–5 замеров глубины следа</b> (см, через пробел)\n' +
        '<code>1.5 1.8 1.6</code>\n\n' +
        '📍 <i>Сначала отправьте местоположение</i>',
        { parse_mode: 'HTML', reply_markup: { keyboard: [[{ text: "📍 Отправить местоположение", request_location: true }]], resize_keyboard: true, one_time_keyboard: true } }
    );
});

// 🎯 ОБНОВЛЕННЫЕ КОМАНДЫ ДЛЯ УСТАНОВКИ КОНТЕКСТА
bot.onText(/\/calc_reverse/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // ОЧИЩАЕМ КОНТЕКСТ ПЕРЕД НОВОЙ КОМАНДОЙ
    delete userContext[userId];

    userContext[userId] = 'calc_reverse';

    await bot.sendMessage(chatId,
        '🔄 <b>ОБРАТНЫЙ КАЛЬКУЛЯТОР</b>\n\n' +
        'Расчет размера обуви по длине отпечатка\n\n' +
        '💡 <b>Отправьте длину отпечатка в см:</b>\n\n' +
        '<code>33 см</code>\n\n' +
        '<code>33</code>\n\n' +
        '📝 <i>Пример: отпечаток 33 см → размеры 41-50</i>',
        { parse_mode: 'HTML' }
    );
});

bot.onText(/\/calc_shoe/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // ОЧИЩАЕМ КОНТЕКСТ ПЕРЕД НОВОЙ КОМАНДОЙ
    delete userContext[userId];

    userContext[userId] = 'calc_shoe';

    try {
        const typesMessage = ctx.calculators.getShoeTypes();
        await bot.sendMessage(chatId, typesMessage, { parse_mode: 'HTML' });

        await bot.sendMessage(chatId,
            '💡 <b>Отправьте размер и тип обуви:</b>\n\n' +
            '<code>42 кроссовки</code>\n\n' +
            'Или в формате:\n' +
            '<code>размер=42 тип=кроссовки</code>',
            { parse_mode: 'HTML' }
        );
    } catch (error) {
        console.log('❌ Ошибка в /calc_shoe:', error);
        await bot.sendMessage(chatId, '❌ Ошибка загрузки калькулятора');
    }
});

// 🌤️ Команда погоды с историей
bot.onText(/\/calc_weather/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // ОЧИЩАЕМ КОНТЕКСТ ПЕРЕД НОВОЙ КОМАНДОЙ
    delete userContext[userId];

    // Устанавливаем контекст - пользователь хочет погоду
    userContext[userId] = 'calc_weather';

    await bot.sendMessage(chatId,
        '🌤️ <b>ПОГОДА С ИСТОРИЕЙ ЗА 7 ДНЕЙ</b>\n\n' +
        '📍 <b>Отправьте местоположение</b> (скрепка → Местоположение)\n\n' +
        '🏙️ <b>Или напишите город:</b>\n' +
        '<code>Москва</code>\n' +
        '<code>Санкт-Петербург</code>\n' +
        '<code>Новосибирск</code>\n\n' +
        '📌 <b>Или координаты:</b>\n' +
        '<code>55.7558 37.6173</code>\n\n' +
        '📊 <i>Бот покажет текущую погоду, прогноз и историю за неделю</i>',
        {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [
                    [{ text: "📍 Отправить местоположение", request_location: true }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }
    );
});

// 📍 ОБЩИЙ ОБРАБОТЧИК ГЕОЛОКАЦИИ
bot.on('location', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const context = userContext[userId];

    if (!context) return;

    const location = msg.location;

    try {
        // ❄️ ОБРАБОТКА ДЛЯ СНЕГА (ОСНОВНОЙ РЕЖИМ)
        if (context === 'waiting_snow_age_location') {
            userContext[userId] = {
                type: 'snow_age_calc',
                coordinates: {
                    lat: location.latitude,
                    lon: location.longitude
                }
            };

            await bot.sendMessage(chatId,
                '📍 Местоположение получено. Теперь укажите <b>дату и время пропажи</b>:\n\n' +
                '<code>2024-01-15 08:00</code>\n' +
                '<code>15.01.2024 8:00</code>\n\n' +
                '<i>Формат: ГГГГ-ММ-ДД ЧЧ:ММ или ДД.ММ.ГГГГ ЧЧ:ММ</i>',
                { parse_mode: 'HTML' }
            );
            return;
        }


        // 🌤️ ОБРАБОТКА ДЛЯ ПОГОДЫ
if (context === 'calc_weather') {
    await bot.sendMessage(chatId, '📍 Получаю погоду для вашего местоположения...');

    // Передаем chatId и bot для отправки графика
    const result = await ctx.calculators.getWeatherData({
        coordinates: {
            lat: location.latitude,
            lon: location.longitude
        }
    }, chatId, bot);  // ← добавляем chatId и bot

    // Очищаем контекст ПОСЛЕ выполнения
    delete userContext[userId];

    // Если результат вернулся (не null), отправляем текстом
    if (result) {
        await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
    }
    return;
}

    } catch (error) {
        console.log('❌ Ошибка обработки местоположения:', error);
        await bot.sendMessage(chatId, '❌ Ошибка обработки местоположения');
        // Очищаем контекст при ошибке
        delete userContext[userId];
    }
});

// 🎯 ГЛАВНЫЙ ОБРАБОТЧИК СООБЩЕНИЙ ДЛЯ КАЛЬКУЛЯТОРОВ
bot.on('message', async (msg) => {
    // Пропускаем команды и служебные сообщения
    if (msg.text && msg.text.startsWith('/')) return;
    if (msg.location) return; // Обрабатывается отдельно
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text.trim();
    const context = userContext[userId];

    try {
       // 🎯 ОБРАБОТКА КОНТЕКСТА СНЕГА: шаг 1 — дата пропажи
       if (context && context.type === 'snow_age_calc' && context.step !== 'depths') {
           const disappearanceTime = parseDateTime(text);

           if (!disappearanceTime) {
               await bot.sendMessage(chatId, '❌ Неверный формат даты. Используйте: <code>2024-01-15 08:00</code>', { parse_mode: 'HTML' });
               return;
           }

           // Шаг 2 — запрашиваем 3–5 замеров глубины следа
           userContext[userId] = {
               type: 'snow_age_calc',
               coordinates: context.coordinates,
               disappearanceTime: disappearanceTime,
               step: 'depths'
           };

           await bot.sendMessage(chatId,
               '📍 Дата принята: <code>' + disappearanceTime.toISOString().slice(0, 10) + '</code>\n\n' +
               '📏 Теперь отправьте <b>3–5 замеров глубины следа</b> (см, через пробел):\n\n' +
               '<code>1.5 1.8 1.6</code>\n\n' +
               '💡 Берём минимум (исключает намет); разброс > 3 см — «след неравномерный».',
               { parse_mode: 'HTML' }
           );
           return;
       }

       // 🎯 ОБРАБОТКА КОНТЕКСТА СНЕГА: шаг 2 — глубины
       if (context && context.type === 'snow_age_calc' && context.step === 'depths') {
           const tokens = text.replace(/,/g, '.').split(/\s+/).filter(t => t !== '');
           const depths = tokens.map(Number);

           if (depths.length < 3 || depths.length > 5 || depths.some(d => isNaN(d))) {
               await bot.sendMessage(chatId, '❌ Нужно 3–5 чисел (глубина в см), например: <code>1.5 1.8 1.6</code>', { parse_mode: 'HTML' });
               return;
           }

           await bot.sendMessage(chatId, '❄️🔮 Анализирую давность следа...');

           const result = await ctx.calculators.calculateSnowAge(context.coordinates, context.disappearanceTime, { depths });

           // Очищаем контекст ПОСЛЕ выполнения
           delete userContext[userId];

           await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
           return;
       }

        // 🎯 ОБРАБОТКА ПРОСТЫХ КАЛЬКУЛЯТОРОВ
        if (context === 'calc_snow') {
            // ❄️ Калькулятор снега - здесь только глубина снега
            const depth = text.trim();

            console.log('🔍 Расчет снега:', { depth });

            const result = ctx.calculators.calculateSnowDepth(depth, 'fresh');

            // Очищаем контекст ПОСЛЕ выполнения
            delete userContext[userId];

            await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            return;
        }

        if (context === 'calc_reverse') {
            // 🔄 Обратный калькулятор - здесь только длина отпечатка
            let footprintLength = text.trim();

            // Убираем "см" если есть
            footprintLength = footprintLength.replace('см', '').trim();

            console.log('🔍 Обратный расчет для длины:', footprintLength);

            const result = ctx.calculators.calculateReverse(footprintLength);

            // Очищаем контекст ПОСЛЕ выполнения
            delete userContext[userId];

            await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            return;
        }

        if (context === 'calc_shoe') {
            // 👟 Калькулятор обуви - здесь только размер обуви
            console.log('🔍 Обрабатываем как прямой калькулятор обуви');
            let size, type;

            // ЕСЛИ ПРОСТО ЧИСЛО - считаем это размером с неизвестным типом
            if (/^\d+$/.test(text.trim())) {
                size = text.trim();
                type = 'неизвестно';
            }
            // ЕСЛИ РАЗМЕР + ТИП
            else if (text.includes('размер=') && text.includes('тип=')) {
                const sizeMatch = text.match(/размер=(\d+)/);
                const typeMatch = text.match(/тип=([^]+)/);
                size = sizeMatch ? sizeMatch[1] : null;
                type = typeMatch ? typeMatch[1].trim() : null;
            } else {
                const parts = text.split(' ');
                size = parts[0];
                type = parts.slice(1).join(' ');
            }

            console.log('🔍 Парсинг обуви:', { size, type });

            if (size) {
                const result = ctx.calculators.calculateShoeSize(size, type || 'неизвестно');

                // Очищаем контекст ПОСЛЕ выполнения
                delete userContext[userId];

                await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            } else {
                await bot.sendMessage(chatId, '❌ Неверный формат. Пример: <code>42</code> или <code>42 кроссовки</code>', { parse_mode: 'HTML' });
            }
            return;
        }

        // 🌤️ ОБРАБОТКА КОНТЕКСТА ПОГОДЫ (город/координаты)
        if (context === 'calc_weather') {
            await bot.sendMessage(chatId, '🌤️ Запрашиваю погоду с историей...');

            let options = {};

            // Проверяем формат ввода
            if (isCoordinates(text)) {
                // Координаты: "55.7558 37.6173"
                const coords = text.split(' ').map(coord => parseFloat(coord));
                options.coordinates = { lat: coords[0], lon: coords[1] };
            } else {
                // Название города
                options.location = text;
            }

            // 🔥 ИЗМЕНЕНИЕ: передаем chatId и bot для отправки графика
            const result = await ctx.calculators.getWeatherData(options, chatId, bot);

            // Очищаем контекст ПОСЛЕ выполнения
            delete userContext[userId];

            // 🔥 ИЗМЕНЕНИЕ: если результат вернулся (не null), отправляем текстом
            if (result) {
                await bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
            }
            return;
        }

        // 🚫 ЕСЛИ НЕТ КОНТЕКСТА - НИЧЕГО НЕ ДЕЛАЕМ
        if (!context) {
            if (DEBUG_MODE) {
                console.log('⚠️ Нет активного контекста, сообщение не обработано');
            }
            return;
        }

        // Если дошли сюда и есть контекст, но не обработали - очищаем
        console.log('⚠️ Неизвестный контекст:', context);
        delete userContext[userId];

    } catch (error) {
        console.log('❌ Ошибка обработки калькулятора:', error);
        await bot.sendMessage(chatId, '❌ Не удалось обработать запрос. Проверьте формат ввода.');
        // Очищаем контекст при ошибке
        delete userContext[userId];
    }
});

// 📍 Вспомогательные функции для координат

// 🔧 ФУНКЦИЯ ПАРСИНГА ДАТЫ

// =============================================================================
// 🏁 КОНЕЦ БЛОКА КАЛЬКУЛЯТОРОВ
// =============================================================================

// Команда /apps

// =============================================================================
// 📌 ПРИЛОЖЕНИЯ И ПОМОЩЬ
// =============================================================================
bot.onText(/\/apps/, async (msg) => {
    const chatId = msg.chat.id;

    let message = `📱 ПОЛЕЗНЫЕ ПРИЛОЖЕНИЯ\n\n`;

    message += `🔍 **Честный знак**\n`;
    message += `• Узнать дату и место продажи по QR-коду\n`;
    message += `• Ссылка: rustore.ru/catalog/app/ru.crptech.mark\n\n`;

    message += `🍷 **Антиконтрафакт алко**\n`;
    message += `• Проверка акцизных марок алкоголя\n`;
    message += `• Ссылка: public.fsrar.ru/checkmark\n\n`;

    message += `🌤️ **Погода - архив погоды**\n`;
    message += `• Архивные погодные данные\n`;
    message += `• Ссылка: rustore.ru/catalog/app/com.mart.weather\n\n`;

    message += `📏 **ImageMeter**\n`;
    message += `• Измерения размеров на фото по эталону\n`;
    message += `• Ссылка: play.google.com/store/apps/details?id=de.dirkfarin.imagemeter\n\n`;

    message += `🦴 **Скелет | 3D Анатомии**\n`;
    message += `• Анатомический справочник\n`;
    message += `• Ссылка: play.google.com/store/apps/details?id=com.catfishanimationstudio.SkeletalSystemPreview\n\n`;

    message += `📍 **Conota: GPS-камера**\n`;
    message += `• Фото с логотипом и GPS-данными\n`;
    message += `• Ссылка: play.google.com/store/apps/details?id=com.gps.survey.cam\n\n`;

    message += `💡 Скопируйте ссылки для перехода`;

    await bot.sendMessage(chatId, message);
});

// Команда /help
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
        `🆘 **ПОМОЩЬ**\n\n` +
        `📸 **Как использовать:**\n` +
        `• Отправьте одно фото - быстрый анализ\n` +
        `• Отправьте пачку фото (2+) - автоматическая сессия\n` +
        `• Или начните сессию вручную: /trail_start\n\n` +
        `🔄 **СЕССИОННЫЙ РЕЖИМ:**\n` +
        `/trail_start - Начать сессию анализа\n` +
        `/trail_status - Статус сессии\n` +
        `/trail_details - Детали по каждому фото\n` +
        `/trail_end - Завершить с отчетом\n` +
        `/cancel - Отменить все операции\n\n` +
        `👣 **ЦИФРОВЫЕ ОТПЕЧАТКИ:**\n` +
        `/footprint_start - Начать сессию отпечатков\n` +
        `/my_footprints - Мои модели отпечатков\n` +
        `/find_similar_footprints - Найти похожие\n` +
        `/footprint_stats - Статистика системы\n\n` +
        `🔍 **Что анализируется:**\n` +
        `• Контуры подошвы\n` +
        `• Детали протектора\n` +
        `• Топология узора\n` +
        `• Практический анализ для ПСО\n` +
        `• Фильтрация следов животных\n` +
        `• 🆕 Автосовмещение следов\n` +
        `• 🆕 Визуализация объединения\n\n` +
        `🧮 **ИНСТРУМЕНТЫ:**\n` +
        `/calculators - Калькуляторы и расчеты\n\n` +
        `📱 **ПОЛЕЗНЫЕ ПРИЛОЖЕНИЯ:**\n` +
        `/apps - Рекомендованные приложения\n\n` +
        `🎨 **Стили визуализации:**\n` +
        `/style - Выбрать стиль отображения\n` +
        `/currentstyle - Текущий стиль\n` +
        `• Стиль маски (по умолчанию) - черные линии на полупрозрачном фоне\n` +
        `• Оригинальный стиль - цветная визуализация\n\n` +
        `💡 **Советы по съемке:**\n` +
        `• Прямой угол\n` +
        `• Хорошее освещение\n` +
        `• Четкий фокус\n\n` +
        `💾 **Сохранение результатов:**\n` +
        `/yandex - Статус Яндекс.Диска\n` +
        `• Автоматическое сохранение в облако\n\n` +
        `📊 **Другие команды:**\n` +
        `/start - Главное меню\n` +
        `/statistics - Статистика системы`
    );
});

// =============================================================================
// 🔄 КОМАНДЫ ДЛЯ УПРАВЛЕНИЯ СЕССИЯМИ И МОДЕЛЯМИ
// =============================================================================

// Хранилище запросов на удаление
const userClearRequests = new Map();

// Команда /reset - сбросить текущую сессию

// =============================================================================
// 📌 СЕССИИ И МОДЕЛИ
// =============================================================================
bot.onText(/\/reset/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
 
    console.log(`🔄 Пользователь ${userId} запросил сброс сессии`);
 
    try {
        // Если есть активная сессия - завершаем ее
        if (ctx.footprintManager && ctx.footprintManager.getActiveSession(userId)) {
            const result = ctx.footprintManager.endSession(userId, 'manual_reset');
           
            if (result.success) {
                bot.sendMessage(chatId,
                    '✅ Сессия сброшена\n\n' +
                    'Теперь следующее фото начнет новую сессию.'
                );
            } else {
                bot.sendMessage(chatId,
                    '⚠️ Не удалось сбросить сессию\n' +
                    'Просто отправьте новое фото - оно начнет новую сессию.'
                );
            }
        } else {
            bot.sendMessage(chatId,
                'ℹ️ У вас нет активной сессии\n' +
                'Просто отправьте фото для начала новой.'
            );
        }
     
    } catch (error) {
        console.log('⚠️ Ошибка при сбросе сессии:', error.message);
        bot.sendMessage(chatId, '⚠️ Произошла ошибка. Просто отправьте новое фото.');
    }
});

// Команда /clearmodel - очистить супер-модель
bot.onText(/\/clearmodel/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        // Проверяем права (если нужно)
        const allowedUsers = [699140291]; // Твой ID для тестов
        if (!allowedUsers.includes(userId)) {
            await bot.sendMessage(chatId, '⛔ Эта команда только для тестирования');
            return;
        }

        await bot.sendMessage(chatId, '🔄 Очищаю супер-модель...');

        // Проверяем, есть ли активная сессия
        const session = ctx.footprintManager ? ctx.footprintManager.getActiveSession(userId) : null;

        if (!session || !session.currentFootprint) {
            await bot.sendMessage(chatId, '⚠️ У вас нет активной супер-модели');
            return;
        }

        const footprint = session.currentFootprint;
       
        // Получаем информацию безопасным способом
        let modelInfo;
        try {
            // Пробуем получить через getInfo если есть
            if (footprint.getInfo) {
                modelInfo = footprint.getInfo();
            } else {
                throw new Error('getInfo не доступен');
            }
        } catch (error) {
            console.log('⚠️ Ошибка получения информации о модели:', error.message);
            // Используем безопасный способ получения информации
            modelInfo = {
                name: footprint.name || 'Текущая модель',
                stats: {
                    nodes: footprint.graph?.nodes?.size || 0,
                    totalNodes: footprint.graph?.nodes?.size || 0,
                    merges: 0,
                    totalMerges: 0,
                    confidence: footprint.stats?.confidence || 0,
                    photoCount: footprint.photoHistory?.length || session.photos?.length || 0
                }
            };
        }

        // Показываем что будет удалено
        const stats = modelInfo.stats || {};
        const nodeCount = stats.nodes || stats.totalNodes || 0;
        const mergeCount = stats.merges || stats.totalMerges || 0;
        const confidence = stats.confidence || 0;
        const photoCount = stats.photoCount || footprint.photoHistory?.length || 0;

        await bot.sendMessage(chatId,
            `🗑️ УДАЛЕНИЕ СУПЕР-МОДЕЛИ:\n` +
            `Название: ${modelInfo.name || 'Текущая модель'}\n` +
            `Узлов: ${nodeCount}\n` +
            `Фото: ${photoCount}\n` +
            `Слияний: ${mergeCount}\n` +
            `Уверенность: ${(confidence * 100).toFixed(1)}%\n\n` +
            `Подтвердите удаление командой: /confirmclear`
        );

        // Сохраняем запрос на удаление
        userClearRequests.set(userId, {
            timestamp: Date.now(),
            sessionId: session.id,
            modelInfo: modelInfo,
            footprint: footprint // Сохраняем ссылку на объект
        });

    } catch (error) {
        console.log('❌ Ошибка в /clearmodel:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /confirmclear - подтверждение удаления
bot.onText(/\/confirmclear/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const clearRequest = userClearRequests.get(userId);
        if (!clearRequest) {
            await bot.sendMessage(chatId, '⚠️ Нет запроса на удаление. Сначала используйте /clearmodel');
            return;
        }

        // Проверяем что запрос не старше 2 минут
        if (Date.now() - clearRequest.timestamp > 120000) {
            userClearRequests.delete(userId);
            await bot.sendMessage(chatId, '⏱️ Время подтверждения истекло. Используйте /clearmodel снова');
            return;
        }

        await bot.sendMessage(chatId, '🗑️ Удаляю супер-модель...');

        // Получаем данные из запроса
        const info = clearRequest.modelInfo;
        const nodeCount = info.stats?.nodes || info.stats?.totalNodes || 0;
        const photoCount = info.stats?.photoCount || 0;

        // Просто удаляем сессию напрямую
        let result = { success: true };
       
        if (ctx.footprintManager && ctx.footprintManager.userSessions) {
            ctx.footprintManager.userSessions.delete(userId);
           
            // Также удаляем векторную модель если есть
            if (ctx.footprintManager.vectorSuperModels) {
                ctx.footprintManager.vectorSuperModels.delete(userId);
            }
           
            console.log(`🧹 Сессия пользователя ${userId} очищена вручную`);
        }

        if (result.success) {
            await bot.sendMessage(chatId,
                `✅ СУПЕР-МОДЕЛЬ УДАЛЕНА!\n\n` +
                `🗑️ Удалено:\n` +
                `• Супер-модель: ${info.name || 'Текущая модель'}\n` +
                `• ${nodeCount} узлов\n` +
                `• ${photoCount} фото\n\n` +
                `🆕 Теперь можно начать с чистого листа!\n` +
                `Отправьте фото для создания новой модели.`
            );

            // Очищаем запрос
            userClearRequests.delete(userId);

        } else {
            await bot.sendMessage(chatId, `⚠️ Не удалось удалить данные: ${result.error || 'неизвестная ошибка'}`);
        }

    } catch (error) {
        console.log('❌ Ошибка в /confirmclear:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /clearsession - быстрая очистка (без подтверждения)
bot.onText(/\/clearsession/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
  
    try {
        // Только для тестовых пользователей
        const allowedUsers = [699140291];
        if (!allowedUsers.includes(userId)) {
            await bot.sendMessage(chatId, '⛔ Эта команда только для тестирования');
            return;
        }
      
        await bot.sendMessage(chatId, '🧹 Быстрая очистка сессии...');
      
        let result;
        if (ctx.footprintManager) {
            result = ctx.footprintManager.endSession(userId, 'fast_clear');
        } else {
            result = { success: false, error: 'FootprintManager не инициализирован' };
        }
      
        if (result.success) {
            await bot.sendMessage(chatId,
                `✅ СЕССИЯ ОЧИЩЕНА!\n\n` +
                `🆕 Теперь можно начать с чистого листа.\n` +
                `Отправьте фото для создания новой модели.`
            );
        } else {
            await bot.sendMessage(chatId, `ℹ️ Нечего очищать - сессия уже пуста или ${result.error}`);
        }
      
    } catch (error) {
        console.log('❌ Ошибка в /clearsession:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /modelinfo - информация о текущей модели
bot.onText(/\/modelinfo/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
  
    try {
        // Проверяем есть ли активная сессия
        const session = ctx.footprintManager ? ctx.footprintManager.getActiveSession(userId) : null;
       
        if (!session || !session.currentFootprint) {
            await bot.sendMessage(chatId, '📭 У вас нет активной супер-модели');
            return;
        }

        const footprint = session.currentFootprint;
        const info = footprint.getInfo ? footprint.getInfo() : {
            name: 'Текущая модель',
            stats: {}
        };
       
        const stats = info.stats || {};
        const nodeCount = stats.nodes || stats.totalNodes || 0;
        const mergeCount = stats.merges || stats.totalMerges || 0;
        const confidence = stats.confidence || 0;
        const photoCount = stats.photos || stats.totalPhotos || 0;
       
        let message = `📊 ИНФОРМАЦИЯ О СУПЕР-МОДЕЛИ:\n\n`;
        message += `🏷️ Название: ${info.name || 'Текущая модель'}\n`;
        message += `🆔 ID сессии: ${session.id?.slice(0, 12)}...\n\n`;
      
        message += `📈 СТАТИСТИКА:\n`;
        message += `• Узлов: ${nodeCount}\n`;
        message += `• Слияний: ${mergeCount}\n`;
        message += `• Фото: ${photoCount}\n`;
        message += `• Уверенность: ${(confidence * 100).toFixed(1)}%\n`;
       
        if (stats.createdAt) {
            message += `• Создана: ${stats.createdAt}\n`;
        }
       
        if (stats.lastUpdated) {
            message += `• Обновлена: ${stats.lastUpdated}\n`;
        }
      
        // Добавляем информацию о подтверждениях, если есть
        if (footprint.getConfirmationStats) {
            const confirmStats = footprint.getConfirmationStats();
            if (confirmStats) {
                message += `\n🎯 ПОДТВЕРЖДЕНИЯ:\n`;
                message += `• Всего узлов: ${confirmStats.totalNodes || 0}\n`;
                message += `• Подтвержденных: ${confirmStats.confirmedNodes || 0}\n`;
                message += `• Среднее подтверждений: ${confirmStats.averageConfirmations?.toFixed(1) || '0.0'}\n`;
            }
        }
      
        message += `\n⚡ Команды:\n`;
        message += `/clearmodel - удалить эту модель\n`;
        message += `/clearsession - быстрая очистка\n`;
        message += `/debug - подробная отладка`;
      
        await bot.sendMessage(chatId, message);
      
    } catch (error) {
        console.log('❌ Ошибка в /modelinfo:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /debug - полная отладка системы

// =============================================================================
// 📌 ОТЛАДКА
// =============================================================================
bot.onText(/\/debug/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
  
    try {
        // Только для тестовых пользователей
        const allowedUsers = [699140291];
        if (!allowedUsers.includes(userId)) {
            await bot.sendMessage(chatId, '⛔ Эта команда только для тестирования');
            return;
        }
      
        await bot.sendMessage(chatId, '🔧 Запуск отладки системы...');
      
        // 1. Информация о системе
        let systemStats = {};
        if (ctx.footprintManager) {
            systemStats = ctx.footprintManager.getSystemStats ?
                ctx.footprintManager.getSystemStats() :
                { activeSessions: 0, loadedModels: 0 };
        }
      
        // 2. Информация о пользователе
        const session = ctx.footprintManager ? ctx.footprintManager.getActiveSession(userId) : null;
        const footprint = session ? session.currentFootprint : null;
      
        let debugMessage = `⚡ ОТЛАДКА СИСТЕМЫ\n\n`;
      
        debugMessage += `📊 СИСТЕМА:\n`;
        debugMessage += `• Активных сессий: ${systemStats.activeSessions || 0}\n`;
        debugMessage += `• Загруженных моделей: ${systemStats.loadedModels || 0}\n`;
        debugMessage += `• Векторных моделей: ${systemStats.vectorModels || 0}\n`;
        debugMessage += `• Всего фото: ${systemStats.totalPhotosProcessed || 0}\n\n`;
      
        debugMessage += `👤 ПОЛЬЗОВАТЕЛЬ ${userId}:\n`;
        debugMessage += `• Сессия: ${session ? 'есть' : 'нет'}\n`;
        if (session) {
            debugMessage += `• ID сессии: ${session.id?.slice(0, 12) || 'unknown'}...\n`;
            debugMessage += `• Фото в сессии: ${session.photos ? session.photos.length : 0}\n`;
        }
        debugMessage += `• Супер-модель: ${footprint ? 'есть' : 'нет'}\n`;
      
        if (footprint) {
            const info = footprint.getInfo ? footprint.getInfo() : {};
            const stats = info.stats || {};
            debugMessage += `• Узлов: ${stats.nodes || stats.totalNodes || 0}\n`;
            debugMessage += `• Слияний: ${stats.merges || stats.totalMerges || 0}\n`;
        }
      
        debugMessage += `\n🎯 КОМАНДЫ ОЧИСТКИ:\n`;
        debugMessage += `/clearmodel - удалить супер-модель\n`;
        debugMessage += `/clearsession - очистить сессию\n`;
        debugMessage += `/modelinfo - информация о модели\n`;
        debugMessage += `/test - запустить тест системы`;
      
        await bot.sendMessage(chatId, debugMessage);
      
    } catch (error) {
        console.log('❌ Ошибка в /debug:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

bot.onText(/\/debug_accumulation/, async (msg) => {
    const userId = msg.from.id;
    manager.debugAccumulation(userId);
});

// Команда /test - тест системы
bot.onText(/\/test/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
  
    try {
        await bot.sendMessage(chatId, '🧪 Запуск теста системы...');
      
        // Очищаем старые данные для чистого теста
        if (ctx.footprintManager) {
            ctx.footprintManager.endSession(userId, 'test_reset');
        }
      
        await bot.sendMessage(chatId,
            `✅ СИСТЕМА ГОТОВА К ТЕСТУ!\n\n` +
            `Теперь отправьте:\n` +
            `1. Первое фото подошвы\n` +
            `2. Второе фото подошвы (с другого угла)\n\n` +
            `Система должна:\n` +
            `• Нормализовать углы\n` +
            `• Объединить следы в супер-модель\n` +
            `• Отправить визуализацию`
        );
      
    } catch (error) {
        console.log('❌ Ошибка в /test:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

bot.onText(/\/check_honest/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
  
    try {
        const session = ctx.footprintManager ? ctx.footprintManager.getActiveSession(userId) : null;
        if (session && session.currentFootprint) {
            const footprint = session.currentFootprint;

            let message = `🎯 **ЧЕСТНЫЕ ДАННЫЕ ОТПЕЧАТКА**\n\n`;
            message += `• Имя: ${footprint.name}\n`;
            message += `• Узлов: ${footprint.graph?.nodes?.size || 0}\n`;
            message += `• Фото: ${footprint.metadata?.totalPhotos || 0}\n\n`;

            if (footprint.pointTracker) {
                const tracker = footprint.pointTracker;

                // Считаем подтверждения
                let confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;
                if (tracker.points && tracker.points.size) {
                    for (const [id, point] of tracker.points) {
                        const count = point.confirmedCount || 0;
                        if (count >= 2) confirmed2++;
                        else if (count >= 1) confirmed1++;
                        else confirmed0++;
                    }
                }

                message += `📊 **POINT TRACKER:**\n`;
                message += `• Всего точек: ${tracker.points?.size || 0}\n`;
                message += `• 🔴 2+ подтверждений: ${confirmed2}\n`;
                message += `• 🔵 1 подтверждение: ${confirmed1}\n`;
                message += `• ⚪ 0 подтверждений: ${confirmed0}\n\n`;

                message += `🎨 **ЦВЕТА ВИЗУАЛИЗАЦИИ:**\n`;
                message += `• 🔴 Красный: точка есть в 2+ фото\n`;
                message += `• 🔵 Синий: точка есть в 1 фото\n`;
                message += `• ⚪ Серый: предсказанная точка\n`;

                // Добавляем прогресс
                if (confirmed2 > 0) {
                    const progress = Math.min(100, (confirmed2 / (tracker.points?.size || 1)) * 100);
                    message += `\n📈 **ПРОГРЕСС:** ${progress.toFixed(1)}% точек подтверждены 2+ фото`;
                }
            }

            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId, '❌ Нет активной сессии или отпечатка');
        }
    } catch (error) {
        console.log('❌ Ошибка /check_honest:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// =============================================================================
// 🆕 СЕССИОННЫЕ КОМАНДЫ
// =============================================================================

// Команда /trail_start - начать сессию анализа следов

// =============================================================================
// 📌 СЛЕДЫ (TRAIL)
// =============================================================================
bot.onText(/\/trail_start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (ctx.sessionManager.hasActiveSession(userId)) {
        const session = ctx.sessionManager.getActiveSession(userId);
        await bot.sendMessage(chatId,
            `⚠️ **СЕССИЯ УЖЕ АКТИВНА**\n\n` +
            `🆔 ${session.id.slice(0, 8)}...\n` +
            `⏰ Начата: ${session.startTime.toLocaleTimeString('ru-RU')}\n` +
            `📸 Фото: ${session.photos.length}\n\n` +
            `📊 Статус: /trail_status\n` +
            `🏁 Завершить: /trail_end`
        );
        return;
    }

    const session = ctx.sessionManager.createSession(userId, 'trail_analysis');

    await bot.sendMessage(chatId,
        `🔄 **РЕЖИМ СЕССИИ АКТИВИРОВАН**\n\n` +
        `📋 Отправляйте фото следов по одному\n` +
        `✅ Каждое фото будет подтверждено\n` +
        `📊 В конце - полный отчет\n\n` +
        `📍 **Инструкция:**\n` +
        `1. Сфотографируйте общую картину\n` +
        `2. Сделайте детальные фото отдельных следов\n` +
        `3. Сохраняйте последовательность\n\n` +
        `📸 Отправьте первое фото`
    );
});

// Команда /trail_status - статус текущей сессии
bot.onText(/\/trail_status/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!ctx.sessionManager.hasActiveSession(userId)) {
        await bot.sendMessage(chatId,
            `❌ Нет активной сессии\n` +
            `Начните: /trail_start`
        );
        return;
    }

    const session = ctx.sessionManager.getActiveSession(userId);
    const summary = ctx.sessionManager.getSessionSummary(userId);

    await bot.sendMessage(chatId,
        `📊 **СТАТУС СЕССИИ**\n\n` +
        `🆔 ${session.id.slice(0, 8)}...\n` +
        `⏰ Длительность: ${summary.duration.toFixed(0)} сек\n` +
        `📸 Фото: ${summary.photoCount}\n` +
        `🔍 Анализов: ${summary.analysisCount}\n\n` +
        `📝 Последнее фото: ${session.photos[session.photos.length - 1]?.timestamp.toLocaleTimeString('ru-RU') || 'нет'}\n\n` +
        `🏁 Завершить: /trail_end`
    );
});

// Команда /trail_end - завершить сессию с анализом
bot.onText(/\/trail_end/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!ctx.footprintManager) {
        await bot.sendMessage(chatId, '❌ Система не инициализирована');
        return;
    }

    await bot.sendMessage(chatId, '🔍 Завершаю сессию и анализирую результаты...');

    // 🔥 ВЫЗЫВАЕМ НОВЫЙ МЕТОД С АВТОМАТИЧЕСКИМ СРАВНЕНИЕМ
    const result = await ctx.footprintManager.endSession(userId, {
        compare: true,  // сравниваем с базой
        save: true,     // сохраняем в базу
        name: `Модель_${new Date().toLocaleDateString('ru-RU')}`,
        threshold: 0.6
    });

    if (result.success) {
        await bot.sendMessage(chatId, result.message);
       
        // Если есть очень похожие модели (>80%)
        const highSimilarity = result.comparison?.filter(m => m.similarity > 0.8);
        if (highSimilarity?.length > 0) {
            setTimeout(async () => {
                await bot.sendMessage(chatId,
                    `⚠️ **ВНИМАНИЕ!**\n\n` +
                    `Найдены модели с очень высоким сходством ( >80% ):\n` +
                    highSimilarity.map(m => `• ${m.name}`).join('\n') + `\n\n` +
                    `Возможно, это та же обувь, что и в предыдущих сессиях.`
                );
            }, 1000);
        }
    } else {
        await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
    }
});

// Команда /cancel - отменить все операции
bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Очищаем контекст калькуляторов
    delete userContext[userId];

    // Проверяем активную сессию
    if (ctx.sessionManager.hasActiveSession(userId)) {
        const session = ctx.sessionManager.endSession(userId);
        await bot.sendMessage(chatId,
            `🗑️ **СЕССИЯ ОТМЕНЕНА**\n\n` +
            `Сессия "${session.id.slice(0, 8)}..." отменена\n` +
            `Удалено: ${session.photos.length} фото\n\n` +
            `🔄 Новая сессию: /trail_start`
        );
        return;
    }

    await bot.sendMessage(chatId,
        `✅ Все активные операции отменены\n` +
        `Готов к новым командам`
    );
});

// =============================================================================
// 🆕 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СЕССИЙ
// =============================================================================

// Функция для поиска лучшего фото в сессии (с максимальным количеством протекторов)
function findBestPhotoInSession(session) {
    if (!session.analysisResults || session.analysisResults.length === 0) {
        return null;
    }

    let bestPhoto = null;
    let maxProtectors = 0;

    session.analysisResults.forEach((result, index) => {
        const protectorCount = result.predictions?.filter(p =>
            p.class === 'shoe-protector').length || 0;

        if (protectorCount > maxProtectors) {
            maxProtectors = protectorCount;
            bestPhoto = {
                index: index,
                result: result,
                protectorCount: protectorCount
            };
        }
    });

    return bestPhoto;
}

// Команда /trail_details - детали сессии
bot.onText(/\/trail_details/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!ctx.sessionManager.hasActiveSession(userId)) {
        await bot.sendMessage(chatId,
            `❌ Нет активной сессии\n` +
            `Начните: /trail_start`
        );
        return;
    }

    const session = ctx.sessionManager.getActiveSession(userId);

    if (session.analysisResults.length === 0) {
        await bot.sendMessage(chatId,
            `📭 В сессии пока нет проанализированных фото\n` +
            `Отправьте фото для анализа`
        );
        return;
    }

    let detailsMessage = `📋 **ДЕТАЛИ СЕССИИ** (${session.analysisResults.length} фото)\n\n`;

    // Находим лучшее фото
    const bestPhoto = findBestPhotoInSession(session);

    if (bestPhoto) {
        detailsMessage += `⭐ **ЛУЧШЕЕ ФОТО:** №${bestPhoto.index + 1}\n`;
        detailsMessage += `• Протекторов: ${bestPhoto.protectorCount}\n\n`;
    }

    session.analysisResults.forEach((result, index) => {
        const footprintCount = result.predictions?.filter(p =>
            p.class === 'Outline-trail').length || 0;
        const protectorCount = result.predictions?.filter(p =>
            p.class === 'shoe-protector').length || 0;
        const animalCount = result.predictions?.filter(p =>
            p.class === 'animal-paw' || p.class === 'Animal').length || 0;

        detailsMessage += `**Фото ${index + 1}:**\n`;
        detailsMessage += `• Следов: ${footprintCount}\n`;
        detailsMessage += `• Деталей протектора: ${protectorCount}\n`;

        if (animalCount > 0) {
            detailsMessage += `• Следов животных: ${animalCount}\n`;
        }

        if (result.intelligentAnalysis?.summary) {
            detailsMessage += `• Тип: ${result.intelligentAnalysis.summary.footprintType}\n`;
            detailsMessage += `• Ориентация: ${result.intelligentAnalysis.summary.orientation}\n`;
        }

        if (index === bestPhoto?.index) {
            detailsMessage += `⭐ **Лучшее по детализации**\n`;
        }

        detailsMessage += `\n`;
    });

    await bot.sendMessage(chatId, detailsMessage);

    // Показываем топологию лучшего фото если есть
    if (bestPhoto && bestPhoto.result.visualizationPaths?.topology) {
        const topologyPath = bestPhoto.result.visualizationPaths.topology;

        if (fs.existsSync(topologyPath)) {
            setTimeout(async () => {
                await bot.sendPhoto(chatId, topologyPath, {
                    caption: `🕸️ **Топология фото ${bestPhoto.index + 1}**\n` +
                             `• Протекторов: ${bestPhoto.protectorCount}\n` +
                             '• 🟢 Зеленые точки - центры протекторов\n' +
                             '• 🟠 Оранжевые линии - связи\n' +
                             '• 🔵 Синий пунктир - контур следа'
                });
            }, 500);
        }
    }
});

// Команда /yandex
bot.onText(/\/yandex/, async (msg) => {
    const chatId = msg.chat.id;

    if (!ctx.yandexDisk) {
        await bot.sendMessage(chatId,
            '❌ **Яндекс.Диск не настроен**\n\n' +
            'Добавьте YANDEX_DISK_TOKEN в конфигурацию'
        );
        return;
    }

    try {
        await bot.sendMessage(chatId, '🔍 Проверяю подключение к Яндекс.Диску...');

        const diskInfo = await ctx.yandexDisk.getDiskInfo();
        const connectionOk = await ctx.yandexDisk.checkConnection();

        if (connectionOk && diskInfo.success) {
            const freeGB = (diskInfo.free / 1024 / 1024 / 1024).toFixed(2);
            const totalGB = (diskInfo.total / 1024 / 1024 / 1024).toFixed(2);

            await bot.sendMessage(chatId,
                '✅ **Яндекс.Диск подключен**\n\n' +
                `💾 Доступно: ${freeGB} GB / ${totalGB} GB\n` +
                `📁 Папка: apps/ShoeBot/\n` +
                `🔄 Автосохранение: включено\n\n` +
                `Все результаты анализов автоматически сохраняются в облако.`
            );
        } else {
            await bot.sendMessage(chatId, '❌ Ошибка подключения к Яндекс.Диску');
        }
    } catch (error) {
        await bot.sendMessage(chatId, '❌ Ошибка проверки Яндекс.Диска');
    }
});

// =============================================================================
// 🆕 СИСТЕМА ОЧЕРЕДИ И ДЕТЕКТОР ПАЧКИ ФОТО
// =============================================================================


// Функция для обработки очереди фото
// =============================================================================
// 🆕 НОВЫЕ КОМАНДЫ ДЛЯ ГРАФОВОЙ СИСТЕМЫ
// =============================================================================

// Команда /footprint_start - начать сессию

// =============================================================================
// 📌 МОДЕЛИ ОТПЕЧАТКОВ
// =============================================================================
bot.onText(/\/footprint_start(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const sessionName = match[1] || `Сессия_${new Date().toLocaleDateString('ru-RU')}`;

    try {
        if (!ctx.footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        // Проверяем активную сессию
        if (ctx.footprintManager.getActiveSession(userId)) {
            await bot.sendMessage(chatId,
                `⚠️ **СЕССИЯ УЖЕ АКТИВНА**\n\n` +
                `Отправляйте фото следов. Система будет автоматически:\n` +
                `• Определять одинаковые следы\n` +
                `• Объединять их в одну модель\n` +
                `• Игнорировать разные следы\n\n` +
                `🏁 Завершить: /footprint_save "Название модели"`
            );
            return;
        }

        // Создаём новую сессию
        const session = ctx.footprintManager.createSession(userId, sessionName);

        await bot.sendMessage(chatId,
            `🔄 **НОВАЯ СЕССИЯ СОЗДАНА**\n\n` +
            `📝 Название: ${sessionName}\n` +
            `🎯 Автосовмещение: ВКЛЮЧЕНО\n` +
            `🎨 Визуализация объединения: ВКЛЮЧЕНА\n\n` +
            `📸 **Как использовать:**\n` +
            `1. Отправляйте фото следов по одному\n` +
            `2. Система автоматически определит, это тот же след или другой\n` +
            `3. При одинаковых следах - объединит в одну модель\n` +
            `4. При разных следах - начнёт новую модель\n\n` +
            `💡 **Рекомендации:**\n` +
            `• Снимайте один след с разных ракурсов\n` +
            `• Для лучшего качества - 3-5 фото одного следа\n` +
            `• Избегайте сильных искажений перспективы\n\n` +
            `🏁 Завершить и сохранить: /footprint_save "Название"`
        );

    } catch (error) {
        console.log('❌ Ошибка создания сессии:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /footprint_save - сохранить сессию как модель
bot.onText(/\/footprint_save(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const modelName = match[1] || `Модель_${new Date().toLocaleDateString('ru-RU')}`;

    try {
        if (!ctx.footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        await bot.sendMessage(chatId, `💾 Сохраняю сессию как модель "${modelName}"...`);

        // ⚠️ Функция в разработке — заменено на вежливую заглушку
        await bot.sendMessage(chatId, '⚠️ Эта функция находится в разработке и пока недоступна.');
        return;

        if (saveResult.success) {
            let response = `✅ **МОДЕЛЬ СОХРАНЕНА!**\n\n`;
            response += `📝 Название: ${saveResult.modelName}\n`;
            response += `🆔 ID: ${saveResult.modelId?.slice(0, 8)}...\n`;
            response += `📊 Узлов: ${saveResult.modelStats?.nodes || 0}\n`;
            response += `🔗 Рёбер: ${saveResult.modelStats?.edges || 0}\n`;
            response += `💎 Уверенность: ${Math.round((saveResult.modelStats?.confidence || 0) * 100)}%\n`;
            response += `📸 Фото в сессии: ${saveResult.sessionInfo?.photos || 0}\n\n`;

            response += `🎯 **ЧТО МОЖНО СДЕЛАТЬ:**\n`;
            response += `/my_footprints - Посмотреть свои модели\n`;
            response += `/find_similar_footprints - Найти похожие\n`;
            response += `/footprint_start - Начать новую сессию`;

            await bot.sendMessage(chatId, response);
        } else {
            await bot.sendMessage(chatId,
                `❌ **Не удалось сохранить модель**\n\n` +
                `Ошибка: ${saveResult.error}\n\n` +
                `💡 **Возможные причины:**\n` +
                `• Слишком мало узлов (нужно минимум 5)\n` +
                `• Нет активной сессии (/footprint_start)\n` +
                `• Недостаточно фото одного следа`
            );
        }

    } catch (error) {
        console.log('❌ Ошибка сохранения модели:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /my_footprints - показать мои модели
bot.onText(/\/my_footprints/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        if (!ctx.footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        const userModels = getUserModels(userId);

        if (!userModels || userModels.length === 0) {
            await bot.sendMessage(chatId,
                `📭 **У вас нет сохранённых моделей**\n\n` +
                `💡 **Как создать модель:**\n` +
                `1. Начните сессию: /footprint_start\n` +
                `2. Отправьте 2+ фото одного следа\n` +
                `3. Сохраните: /footprint_save "Название"\n\n` +
                `🎯 **Система автоматически:**\n` +
                `• Определит одинаковые следы\n` +
                `• Объединит их в модель\n` +
                `• Игнорирует разные следы`
            );
            return;
        }

        let response = `📚 **ВАШИ МОДЕЛИ** (${userModels.length})\n\n`;

        // Показываем все модели с полными ID
        userModels.slice(0, 10).forEach((model, index) => {
            const date = model.metadata?.created
                ? new Date(model.metadata.created).toLocaleDateString('ru-RU')
                : 'неизвестно';
            const fullId = model.id || 'unknown';
            const shortId = fullId.slice(0, 8);
            const nodeCount = model.graph?.nodes?.size || model.nodes?.length || 0;
            const confidence = Math.round((model.stats?.confidence || model.confidence || 0) * 100);
            const photoCount = model.metadata?.totalPhotos || model.photoHistory?.length || 0;

            response += `**${index + 1}. ${model.name || 'Без имени'}**\n`;
            response += `   🆔 ${fullId}\n`;
            response += `   👁️ Короткий: ${shortId}...\n`;
            response += `   📅 ${date}\n`;
            response += `   📊 ${nodeCount} узлов\n`;
            response += `   📸 ${photoCount} фото\n`;
            response += `   💎 ${confidence}% уверенность\n`;
            response += `   🎨 /visualize_model ${fullId}\n`;
            response += `   🔍 /visualize_compare ${fullId} [ID_другой_модели]\n`;
            response += `   📋 /view_model ${fullId}\n\n`;
        });

        if (userModels.length > 10) {
            response += `... и ещё ${userModels.length - 10} моделей\n\n`;
        }

        response += `💡 **Используйте:**\n`;
        response += `/visualize_model [ID] - Визуализация\n`;
        response += `/visualize_compare [ID1] [ID2] - Сравнение\n`;
        response += `/view_model [ID] - Детальная информация\n`;
        response += `\n📋 **Совет:** ID можно копировать из списка выше`;

        await bot.sendMessage(chatId, response);

    } catch (error) {
        console.log('❌ Ошибка /my_footprints:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /view_footprint_XXXX - просмотр модели
bot.onText(/\/view_footprint_([a-f0-9_]+)/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const shortId = match[1];

    try {
        if (!ctx.footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        await bot.sendMessage(chatId, `🔍 Загружаю модель ${shortId}...`);

        // Найти модель по ID
        const userModels = getUserModels(userId);
        const model = userModels.find(m => m.id && m.id.startsWith(shortId));

        if (!model) {
            await bot.sendMessage(chatId,
                `❌ **МОДЕЛЬ НЕ НАЙДЕНА**\n\n` +
                `ID: ${shortId}\n\n` +
                `💡 **Возможные причины:**\n` +
                `• Модель удалена\n` +
                `• Это не ваша модель\n` +
                `• Ошибка в ID\n\n` +
                `📋 **Посмотреть все модели:**\n` +
                `/my_footprints`
            );
            return;
        }

        // Показать информацию о модели
        const info = model.getInfo ? model.getInfo() : {
            name: model.name || 'Без имени',
            id: model.id || 'unknown',
            metadata: {
                created: model.createdAt ? new Date(model.createdAt).toLocaleString('ru-RU') : 'неизвестно',
                lastUpdated: model.updatedAt ? new Date(model.updatedAt).toLocaleString('ru-RU') : 'неизвестно'
            },
            graph: {
                nodes: model.graph?.nodes?.size || model.nodes?.length || 0,
                edges: model.graph?.edges?.size || model.edges?.length || 0,
                invariants: {
                    graphDiameter: 0,
                    clusteringCoefficient: 0,
                    avgDegree: 0,
                    density: 0
                }
            },
            stats: {
                qualityScore: Math.round((model.confidence || model.stats?.confidence || 0) * 100),
                nodes: model.graph?.nodes?.size || model.nodes?.length || 0,
                edges: model.graph?.edges?.size || model.edges?.length || 0
            },
            history: {
                photos: model.photosCount || 0
            }
        };

        let response = `👣 **ЦИФРОВОЙ ОТПЕЧАТОК**\n\n`;
        response += `📝 **Название:** ${info.name}\n`;
        response += `🆔 **ID:** ${info.id.slice(0, 12)}...\n`;
        response += `📅 **Создана:** ${info.metadata.created}\n`;
        response += `🔄 **Обновлена:** ${info.metadata.lastUpdated}\n`;
        response += `📊 **Узлов в графе:** ${info.graph.nodes}\n`;
        response += `🔗 **Рёбер в графе:** ${info.graph.edges}\n`;
        response += `💎 **Уверенность:** ${info.stats.qualityScore}%\n`;
        response += `📸 **Фото в истории:** ${info.history.photos}\n\n`;

        // Инварианты графа
        const invariants = info.graph.invariants;
        response += `📊 **ИНВАРИАНТЫ ГРАФА:**\n`;
        response += `• Диаметр: ${invariants.graphDiameter}\n`;
        response += `• Коэф. кластеризации: ${invariants.clusteringCoefficient.toFixed(3)}\n`;
        response += `• Средняя степень: ${invariants.avgDegree.toFixed(2)}\n`;
        response += `• Плотность: ${invariants.density.toFixed(4)}\n\n`;

        response += `🎯 **ЧТО МОЖНО СДЕЛАТЬ:**\n`;
        response += `/find_similar_footprints - Найти похожие\n`;
        response += `/footprint_start - Создать новую модель\n`;
        response += `\n📤 **Совет:** Отправьте больше фото этой обуви для улучшения модели!`;

        await bot.sendMessage(chatId, response);

    } catch (error) {
        console.log('❌ Ошибка просмотра модели:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /find_similar_footprints - найти похожие
bot.onText(/\/find_similar_footprints/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        if (!ctx.footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        // Проверяем, есть ли последний анализ
        const lastAnalysis = ctx.getLastUserAnalysis(userId);

        if (!lastAnalysis || !lastAnalysis.predictions || lastAnalysis.predictions.length === 0) {
            await bot.sendMessage(chatId,
                `❌ **Нет данных для поиска**\n\n` +
                `Сначала отправьте фото следа для анализа.\n` +
                `После анализа используйте /find_similar_footprints\n\n` +
                `📸 **Как сделать:**\n` +
                `1. Отправьте фото следа\n` +
                `2. Дождитесь анализа\n` +
                `3. Используйте /find_similar_footprints`
            );
            return;
        }

        await bot.sendMessage(chatId, `🔍 Ищу похожие модели...`);

        // Создаём временный отпечаток из последнего анализа
        const SimpleFootprint = require('../../../modules/footprint/simple-footprint');
        const tempFootprint = new SimpleFootprint({
            name: 'Поисковый запрос',
            userId: userId
        });

        tempFootprint.addAnalysis(lastAnalysis, { search: true });

        // Ищем похожие модели
        // ⚠️ Функция в разработке — заменено на вежливую заглушку
        await bot.sendMessage(chatId, '⚠️ Эта функция находится в разработке и пока недоступна.');
        return;

        if (!searchResult.success || searchResult.similarCount === 0) {
            await bot.sendMessage(chatId,
                `🎯 **Уникальный след!**\n\n` +
                `Похожих моделей не найдено.\n` +
                `Сохраните его как новую модель:\n` +
                `/footprint_save "Уникальный след"`
            );
            return;
        }

        // Показать результаты
        let response = `🔍 **Найдено похожих моделей:** ${searchResult.similarCount}\n\n`;

        searchResult.similarModels.forEach((similar, index) => {
            const model = similar.model;
            const shortId = model.id ? model.id.slice(0, 8) : 'unknown';

            response += `**${index + 1}. ${model.name || 'Без имени'}**\n`;
            response += `   🆔 ${shortId}\n`;
            response += `   📊 Совпадение: ${Math.round(similar.similarity * 100)}%\n`;
            response += `   👣 Узлов: ${model.graph?.nodes?.size || model.nodes?.length || 0}\n`;
            response += `   👁️ /view_footprint_${shortId}\n\n`;
        });

        response += `💡 **Что это значит?**\n`;
        response += `• >70% - Возможно, та же обувь\n`;
        response += `• 40-70% - Похожий тип протектора\n`;
        response += `• <40% - Случайное совпадение`;

        await bot.sendMessage(chatId, response);

    } catch (error) {
        console.log('❌ Ошибка поиска похожих:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /footprint_stats - статистика системы
bot.onText(/\/footprint_stats/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        if (!ctx.footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        const stats = ctx.footprintManager.getSystemStats();
        const userModels = getUserModels(userId);

        let response = `📊 **СТАТИСТИКА СИСТЕМЫ ОТПЕЧАТКОВ**\n\n`;
        response += `👣 **Всего моделей в системе:** ${stats.storage?.totalModels || 0}\n`;
        response += `👥 **Пользователей с моделями:** ${stats.storage?.totalUsers || 0}\n`;
        response += `🔄 **Активных сессий:** ${stats.storage?.activeSessions || 0}\n`;
        response += `🔍 **Всего сравнений:** ${stats.performance?.totalComparisons || 0}\n\n`;

        response += `📈 **ВАША СТАТИСТИКА:**\n`;
        response += `• Ваших моделей: ${userModels.length}\n`;

        if (userModels.length > 0) {
            const totalNodes = userModels.reduce((sum, m) => sum + (m.graph?.nodes?.size || m.nodes?.length || 0), 0);
            const avgConfidence = userModels.reduce((sum, m) => sum + (m.stats?.confidence || m.confidence || 0), 0) / userModels.length;

            response += `• Всего узлов: ${totalNodes}\n`;
            response += `• Средняя уверенность: ${Math.round(avgConfidence * 100)}%\n`;
        }

        response += `\n🎯 **Автосовмещение:** ${stats.config?.autoAlignment ? '✅ ВКЛЮЧЕНО' : '❌ ВЫКЛЮЧЕНО'}\n`;
        response += `💾 **Автосохранение:** ${stats.config?.autoSave ? '✅ ВКЛЮЧЕНО' : '❌ ВЫКЛЮЧЕНО'}\n`;
        response += `🎨 **Визуализация объединения:** ${stats.config?.enableMergeVisualization ? '✅ ВКЛЮЧЕНО' : '❌ ВЫКЛЮЧЕНО'}\n\n`;

        response += `🚀 **Система работает:** ${stats.system?.uptime || 0} секунд`;

        await bot.sendMessage(chatId, response);

    } catch (error) {
        console.log('❌ Ошибка статистики:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// 📝 ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ УЛУЧШЕНИЯ ВИЗУАЛИЗАЦИИ
async function enhanceVisualizationWithAnalysis(imagePath, analysis) {
    // Здесь можно добавить аннотации к визуализации на основе анализа
    // Например: стрелки направления, подписи типа обуви и т.д.
    // Пока оставляем как заглушку для будущего улучшения
    return true;
}

// Команда /visualize_model - визуализация модели

// =============================================================================
// 📌 ВИЗУАЛИЗАЦИЯ
// =============================================================================
bot.onText(/\/visualize_model(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const modelId = match[1]; // Можно передать ID или использовать последнюю модель

    try {
        await bot.sendMessage(chatId, '🎨 Создаю визуализацию...');

        let model;
        if (modelId) {
            // Ищем модель по ID
            model = getModelById(modelId);
        } else {
            // Берем последнюю модель пользователя
            const userModels = getUserModels(userId);
            if (userModels.length > 0) {
                model = userModels[userModels.length - 1];
            }
        }

        if (!model) {
            await bot.sendMessage(chatId,
                `❌ **Модель не найдена**\n\n` +
                `Укажите ID модели:\n` +
                `/visualize_model [ID]\n\n` +
                `📋 Посмотреть ваши модели:\n` +
                `/my_footprints`
            );
            return;
        }

        // Создаем визуализацию
        const vizPath = await model.visualizeGraph();

        if (vizPath && fs.existsSync(vizPath)) {
            await bot.sendPhoto(chatId, vizPath, {
                caption: `🎨 **ВИЗУАЛИЗАЦИЯ МОДЕЛИ**\n\n` +
                        `📝 ${model.name}\n` +
                        `📊 Узлов: ${model.graph.nodes.size}\n` +
                        `🔗 Рёбер: ${model.graph.edges.size}\n` +
                        `💎 Уверенность: ${Math.round(model.stats.confidence * 100)}%\n\n` +
                        `🔴 Точки - центры протекторов\n` +
                        `🔵 Линии - связи между протекторами`
            });

            // Очистка файла через минуту
            setTimeout(() => {
                if (fs.existsSync(vizPath)) {
                    fs.unlinkSync(vizPath);
                }
            }, 60000);
        } else {
            await bot.sendMessage(chatId, '❌ Не удалось создать визуализацию');
        }

    } catch (error) {
        console.log('❌ Ошибка команды visualize_model:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /visualize_compare - сравнение двух моделей
bot.onText(/\/visualize_compare(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const input = match[1];

    try {
        if (!input || !input.includes(' ')) {
            await bot.sendMessage(chatId,
                `🔍 **Сравнение моделей**\n\n` +
                `📝 Формат:\n` +
                `/visualize_compare [ID1] [ID2]\n\n` +
                `Пример:\n` +
                `/visualize_compare fp_123 fp_456\n\n` +
                `📋 Ваши модели:\n` +
                `/my_footprints`
            );
            return;
        }

        const [modelId1, modelId2] = input.split(' ');
        await bot.sendMessage(chatId, '🎨 Создаю визуализацию сравнения...');

        // ⚠️ Функция в разработке — заменено на вежливую заглушку
        await bot.sendMessage(chatId, '⚠️ Эта функция находится в разработке и пока недоступна.');
        return;

        if (result.success && result.visualization && fs.existsSync(result.visualization)) {
            await bot.sendPhoto(chatId, result.visualization, {
                caption: `🔍 **СРАВНЕНИЕ МОДЕЛЕЙ**\n\n` +
                        `📊 Similarity: ${Math.round(result.comparison.similarity * 100)}%\n` +
                        `🎯 Решение: ${result.comparison.decision}\n` +
                        `💡 ${result.comparison.reason}\n\n` +
                        `🔴 Красный - модель 1\n` +
                        `🟢 Зеленый - модель 2\n` +
                        `🟡 Желтые линии - совпадения`
            });

            // Очистка файла
            setTimeout(() => {
                if (fs.existsSync(result.visualization)) {
                    fs.unlinkSync(result.visualization);
                }
            }, 60000);
        } else {
            await bot.sendMessage(chatId,
                `❌ **Не удалось сравнить модели**\n\n` +
                `Ошибка: ${result.error || 'неизвестная ошибка'}\n\n` +
                `💡 **Возможные причины:**\n` +
                `• Неверные ID моделей\n` +
                `• Модели не найдены\n` +
                `• Ошибка визуализации`
            );
        }

    } catch (error) {
        console.log('❌ Ошибка команды visualize_compare:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /visualize_session - визуализация текущей сессии
bot.onText(/\/visualize_session/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        await bot.sendMessage(chatId, '🎨 Создаю визуализацию сессии...');

        // ⚠️ Функция в разработке — заменено на вежливую заглушку
        await bot.sendMessage(chatId, '⚠️ Эта функция находится в разработке и пока недоступна.');
        return;

        if (result.success && result.visualization && fs.existsSync(result.visualization)) {
            await bot.sendPhoto(chatId, result.visualization, {
                caption: `🔄 **ВИЗУАЛИЗАЦИЯ СЕССИИ**\n\n` +
                        `🆔 ${result.sessionId?.slice(0, 8) || 'unknown'}\n` +
                        `📊 Разные цвета - разные фото\n` +
                        `⚪ Белый - финальная модель\n\n` +
                        `💡 **Как читать:**\n` +
                        `• Каждый цвет - отдельное фото\n` +
                        `• Точки накладываются при совпадении\n` +
                        `• Чем больше перекрытий - лучше совмещение`
            });

            // Очистка файла
            setTimeout(() => {
                if (fs.existsSync(result.visualization)) {
                    fs.unlinkSync(result.visualization);
                }
            }, 60000);
        } else {
            await bot.sendMessage(chatId,
                `❌ **Нет активной сессии**\n\n` +
                `Начните сессию для визуализации:\n` +
                `/footprint_start`
            );
        }

    } catch (error) {
        console.log('❌ Ошибка команды visualize_session:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

bot.onText(/\/view_model(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const modelId = match[1];

    try {
        if (!ctx.footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        if (!modelId) {
            await bot.sendMessage(chatId,
                `🔍 **ПРОСМОТР МОДЕЛИ**\n\n` +
                `📝 Формат:\n` +
                `/view_model [ID_модели]\n\n` +
                `📋 Получить ID моделей:\n` +
                `/my_footprints`
            );
            return;
        }

        const model = getModelById(modelId);
        if (!model) {
            await bot.sendMessage(chatId,
                `❌ **МОДЕЛЬ НЕ НАЙДЕНА**\n\n` +
                `ID: ${modelId}\n\n` +
                `💡 **Проверьте:**\n` +
                `1. Правильность ID\n` +
                `2. Это ваша модель?\n` +
                `3. Модель существует?\n\n` +
                `📋 **Ваши модели:**\n` +
                `/my_footprints`
            );
            return;
        }

        // Получаем информацию о модели
        const info = model.getInfo ? model.getInfo() : {
            name: model.name || 'Без имени',
            id: model.id || 'unknown',
            metadata: {
                created: model.createdAt ? new Date(model.createdAt).toLocaleString('ru-RU') : 'неизвестно',
                lastUpdated: model.updatedAt ? new Date(model.updatedAt).toLocaleString('ru-RU') : 'неизвестно'
            },
            graph: {
                nodes: model.graph?.nodes?.size || model.nodes?.length || 0,
                edges: model.graph?.edges?.size || model.edges?.length || 0
            },
            stats: {
                confidence: model.stats?.confidence || model.confidence || 0,
                qualityScore: Math.round((model.stats?.confidence || model.confidence || 0) * 100)
            },
            history: {
                photos: model.metadata?.totalPhotos || model.photoHistory?.length || 0,
                analyses: model.analysisHistory?.length || 0
            }
        };

        let response = `👣 **ЦИФРОВОЙ ОТПЕЧАТОК - ПОЛНАЯ ИНФОРМАЦИЯ**\n\n`;
        response += `📝 **Название:** ${info.name}\n`;
        response += `🆔 **Полный ID:** ${info.id}\n`;
        response += `📅 **Создана:** ${info.metadata.created}\n`;
        response += `🔄 **Обновлена:** ${info.metadata.lastUpdated}\n\n`;

        response += `📊 **СТАТИСТИКА:**\n`;
        response += `• Узлов в графе: ${info.graph.nodes}\n`;
        response += `• Рёбер в графе: ${info.graph.edges}\n`;
        response += `• Фото в истории: ${info.history.photos}\n`;
        response += `• Анализов: ${info.history.analyses}\n`;
        response += `• Уверенность: ${info.stats.qualityScore}%\n\n`;

        // 🔥 ДОБАВИТЬ В ИНФОРМАЦИЮ О МОДЕЛИ:
        if (model.getConfirmationStats) {
            const stats = model.getConfirmationStats();
            response += `\n📊 **ПОДТВЕРЖДЕНИЯ УЗЛОВ:**\n`;
            response += `• Всего узлов: ${stats.totalNodes}\n`;
            response += `• Подтвержденных: ${stats.confirmedNodes}\n`;
            response += `• Среднее подтверждений: ${stats.averageConfirmations?.toFixed(1) || '0.0'}\n`;
          
            if (stats.trackerStats) {
                response += `\n🎯 **POINT TRACKER:**\n`;
                response += `• Точек в трекере: ${stats.trackerStats.totalPoints}\n`;
                response += `• Высоконадёжных: ${stats.trackerStats.highConfidencePoints}\n`;
                response += `• Средний рейтинг: ${stats.trackerStats.avgRating?.toFixed(3) || '0.000'}\n`;
            }
        }

        // Показываем инварианты если есть
        if (model.graph && model.graph.getBasicInvariants) {
            const invariants = model.graph.getBasicInvariants();
            response += `\n📈 **ИНВАРИАНТЫ ГРАФА:**\n`;
            response += `• Диаметр: ${invariants.graphDiameter}\n`;
            response += `• Коэф. кластеризации: ${invariants.clusteringCoefficient.toFixed(3)}\n`;
            response += `• Средняя степень: ${invariants.avgDegree.toFixed(2)}\n`;
            response += `• Плотность: ${invariants.density.toFixed(4)}\n\n`;
        }

        // История фото
        if (model.photoHistory && model.photoHistory.length > 0) {
            response += `📸 **ИСТОРИЯ ФОТО:**\n`;
            model.photoHistory.slice(0, 5).forEach((photo, idx) => {
                const date = photo.timestamp ? new Date(photo.timestamp).toLocaleString('ru-RU') : 'неизвестно';
                const points = photo.points || '?';
                response += `${idx + 1}. ${date} - ${points} точек\n`;
            });
            if (model.photoHistory.length > 5) {
                response += `... и ещё ${model.photoHistory.length - 5} фото\n`;
            }
            response += `\n`;
        }

        response += `🎯 **КОМАНДЫ ДЛЯ ЭТОЙ МОДЕЛИ:**\n`;
        response += `/visualize_model ${info.id} - Визуализация\n`;
        response += `/visualize_compare ${info.id} [ID] - Сравнить с другой\n`;
        response += `/find_similar_footprints - Найти похожие\n\n`;

        response += `📤 **Экспорт:** /export_model ${info.id}`;

        await bot.sendMessage(chatId, response);

    } catch (error) {
        console.log('❌ Ошибка /view_model:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// Команда /visualize_stats - визуализация со статистикой совпадений
bot.onText(/\/visualize_stats(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const modelId = match[1];

    try {
        await bot.sendMessage(chatId, '📊 Создаю визуализацию со статистикой подтверждений...');

        let model;
        if (modelId) {
            model = getModelById(modelId);
        } else {
            const userModels = getUserModels(userId);
            if (userModels.length > 0) {
                model = userModels[userModels.length - 1];
            }
        }

        if (!model) {
            await bot.sendMessage(chatId,
                `❌ **Модель не найдена**\n\n` +
                `Укажите ID модели:\n` +
                `/visualize_stats [ID]\n\n` +
                `📋 Получить ID моделей:\n` +
                `/my_footprints`
            );
            return;
        }

        // 🔥 ИСПРАВЛЕНИЕ: Получаем статистику подтверждений
        const stats = model.getConfirmationStats ? model.getConfirmationStats() : {
            totalNodes: model.graph?.nodes?.size || 0,
            confirmedNodes: 0,
            unconfirmedNodes: 0,
            averageConfirmations: 0
        };

        // Создаём визуализацию со статистикой
        // [CLEANUP] Битый require: ./modules/footprint/graph-visualizer не существует (удалён)
        // const GraphVisualizer = require('../../../modules/footprint/graph-visualizer');
        // const visualizer = new GraphVisualizer();
        const vizPath = null; // [CLEANUP] заглушка: визуализатор удалён

        // const vizPath = await visualizer.visualizeModelWithHistory(model, {
            // filename: `stats_${model.id.slice(0, 8)}.png`
        // });

        if (vizPath && fs.existsSync(vizPath)) {
            // 🔥 ОБНОВЛЕННАЯ ПОДПИСЬ с подтверждениями
            let caption = `📊 **СТАТИСТИКА ПОДТВЕРЖДЕНИЙ**\n\n` +
                         `📝 ${model.name}\n` +
                         `📊 Всего узлов: ${stats.totalNodes}\n` +
                         `✅ Подтвержденных узлов: ${stats.confirmedNodes}\n` +
                         `❌ Неподтвержденных: ${stats.unconfirmedNodes}\n` +
                         `📈 Среднее подтверждений: ${stats.averageConfirmations?.toFixed(1) || '0.0'}\n\n`;
          
            // Добавляем статистику из трекера если есть
            if (stats.trackerStats) {
                caption += `🎯 **POINT TRACKER:**\n`;
                caption += `• Точек в трекере: ${stats.trackerStats.totalPoints}\n`;
                caption += `• Высоконадёжных: ${stats.trackerStats.highConfidencePoints}\n`;
                caption += `• Средний рейтинг: ${stats.trackerStats.avgRating?.toFixed(3) || '0.000'}\n\n`;
            }
          
            caption += `🎨 **ЦВЕТА УЗЛОВ:**\n` +
                      `⚫ 1 фото - точка с одного фото\n` +
                      `🟠 2 фото - совпала на двух фото\n` +
                      `🟡 3 фото - совпала на трёх фото\n` +
                      `🟢 4-6 фото - хорошее совпадение\n` +
                      `🔵 7+ фото - отличное совпадение\n\n` +
                      `📈 **Чем больше синих точек - тем надёжнее модель!**`;

            await bot.sendPhoto(chatId, vizPath, { caption });

            // Очистка файла
            setTimeout(() => {
                if (fs.existsSync(vizPath)) {
                    fs.unlinkSync(vizPath);
                }
            }, 60000);
        } else {
            await bot.sendMessage(chatId, '❌ Не удалось создать визуализацию со статистикой');
        }

    } catch (error) {
        console.log('❌ Ошибка команды visualize_stats:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

bot.onText(/\/show_why_same/, async (msg) => {
    const chatId = msg.chat.id;

    try {
        await bot.sendMessage(chatId, '🔍 Анализирую почему система видет одинаковые следы...');

        // Создаём два тестовых графа
        const SimpleGraph = require('../../../modules/footprint/simple-graph');

        // Граф 1 - "вертикальный" след
        const graph1 = new SimpleGraph("След вертикально");
        const points1 = [];
        for (let i = 0; i < 30; i++) {
            points1.push({
                x: 100 + Math.random() * 200,
                y: 100 + Math.random() * 100,
                confidence: 0.8
            });
        }
        graph1.buildFromPoints(points1);

        // Граф 2 - тот же след, но "горизонтальный" (повёрнутый на 90°)
        const graph2 = new SimpleGraph("След горизонтально");
        const points2 = points1.map(p => ({
            x: 300 - p.y,  // Поворот на 90° + смещение
            y: 100 + p.x - 100,
            confidence: 0.8
        }));
        graph2.buildFromPoints(points2);

        // Сравниваем
        const SimpleGraphMatcher = require('../../../modules/footprint/simple-matcher');
        const matcher = new SimpleGraphMatcher({ debug: true });
        const comparison = matcher.compareGraphs(graph1, graph2);

        // Создаём визуализацию
        // [CLEANUP] Битый require: ./modules/footprint/invariant-visualizer не существует (удалён)
        // const InvariantVisualizer = require('../../../modules/footprint/invariant-visualizer');
        // const visualizer = new InvariantVisualizer();
        // const imagePath = await visualizer.visualizeComparison(graph1, graph2, comparison);
        const imagePath = null; // [CLEANUP] заглушка: визуализатор удалён

        if (imagePath && fs.existsSync(imagePath)) {
            await bot.sendPhoto(chatId, imagePath, {
                caption: `🎯 **ПОЧЕМУ СИСТЕМА ВИДЕТ ОДИН СЛЕД**\n\n` +
                        `📊 Similarity: ${(comparison.similarity * 100).toFixed(1)}%\n` +
                        `🤔 Решение: ${comparison.decision}\n` +
                        `💡 Причина: ${comparison.reason}\n\n` +
                        `🔴 **Слева:** След в вертикальной ориентации\n` +
                        `🟢 **Справа:** Тот же след в горизонтальной ориентации\n` +
                        `🎨 **В центре:** Что сравнивает система (инварианты)\n\n` +
                        `💪 **СИСТЕМА НЕ СМОТРИТ:**\n` +
                        `• Абсолютные координаты точек\n` +
                        `• Ориентацию в кадре\n` +
                        `• Абсолютный размер\n\n` +
                        `🔍 **СИСТЕМА СМОТРИТ:**\n` +
                        `• Структуру (кто с кем связан)\n` +
                        `• Относительные расстояния\n` +
                        `• "Форму" облака точек`
            });

            // Очистка
            setTimeout(() => {
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            }, 60000);
        }

    } catch (error) {
        console.log('❌ Ошибка show_why_same:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// 🔴 НОВАЯ КОМАНДА: /visualize_merge - показать визуализацию объединения
bot.onText(/\/visualize_merge/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        if (!ctx.footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        // Получаем последнюю визуализацию объединения
        // ⚠️ Функция в разработке — заменено на вежливую заглушку
        await bot.sendMessage(chatId, '⚠️ Эта функция находится в разработке и пока недоступна.');
        return;

        if (!mergeViz) {
            await bot.sendMessage(chatId,
                `📭 **Нет визуализаций объединения**\n\n` +
                `💡 **Как получить визуализацию:**\n` +
                `1. Начните сессию: /footprint_start\n` +
                `2. Отправьте 2+ фото одного следа\n` +
                `3. Система автоматически создаст визуализацию при объединении\n\n` +
                `🎯 **После объединения вы получите картинку автоматически!**`
            );
            return;
        }

        // Проверяем существует ли файл
        if (!fs.existsSync(mergeViz.path)) {
            await bot.sendMessage(chatId, '❌ Файл визуализации не найден или был удалён');
            return;
        }

        // 🔥 ИСПРАВЛЕНИЕ: Получаем актуальную статистику подтверждений
        const session = ctx.footprintManager.getActiveSession(userId);
        let caption;
      
        if (session && session.currentFootprint) {
            const stats = session.currentFootprint.getConfirmationStats ?
                session.currentFootprint.getConfirmationStats() : {
                    totalNodes: 0,
                    confirmedNodes: 0,
                    averageConfirmations: 0
                };
          
            // ОБНОВЛЕННАЯ ПОДПИСЬ с подтверждениями
            caption = `🎭 **ВИЗУАЛИЗАЦИЯ СУПЕР-МОДЕЛИ С ПОДТВЕРЖДЕНИЯМИ**\n\n` +
                     `📊 Всего узлов: ${stats.totalNodes || 0}\n` +
                     `✅ Подтвержденных узлов: ${stats.confirmedNodes || 0}\n` +
                     `📈 Среднее подтверждений: ${stats.averageConfirmations?.toFixed(1) || '0.0'}\n` +
                     `🕰️ Дата: ${new Date(mergeViz.timestamp).toLocaleString('ru-RU')}\n\n` +
                     `🎨 **ЦВЕТА УЗЛОВ:**\n` +
                     `⚫ Чёрный - 1 подтверждение\n` +
                     `🟠 Оранжевый - 2 подтверждения\n` +
                     `🟡 Жёлтый - 3 подтверждения\n` +
                     `🔴 Красный - 4+ подтверждений\n\n` +
                     `⭕ **Круги:** узлы из последнего следа\n` +
                     `🔢 **Цифры:** количество подтверждений\n\n` +
                     `💪 **Чем больше красных точек - тем надёжнее модель!**`;
        } else {
            // Старая подпись если нет сессии
            caption = `🎭 **ВИЗУАЛИЗАЦИЯ ОБЪЕДИНЕНИЯ СЛЕДОВ**\n\n` +
                     `📊 Схожесть: ${Math.round(mergeViz.similarity * 100)}%\n` +
                     `🕰️ Дата: ${new Date(mergeViz.timestamp).toLocaleString('ru-RU')}\n\n` +
                     `🎨 **ЦВЕТА:**\n` +
                     `⚫ Чёрный - 1 фото\n` +
                     `🟠 Оранжевый - 2 фото\n` +
                     `🟡 Жёлтый - 3 фото\n` +
                     `🔴 Красный - 4+ фото`;
        }

        await bot.sendPhoto(chatId, mergeViz.path, { caption });

    } catch (error) {
        console.log('❌ Ошибка команды visualize_merge:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// /features - показать таблицу признаков

// =============================================================================
// 📌 ФИЧИ И ПОДТВЕРЖДЕНИЯ
// =============================================================================
bot.onText(/\/features/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!ctx.footprintManager) {
        await bot.sendMessage(chatId, '❌ Система не инициализирована');
        return;
    }

    await bot.sendMessage(chatId, '📊 Генерирую таблицу признаков...');

    const result = await ctx.footprintManager.printFeatureTable(userId);

    if (!result.success) {
        await bot.sendMessage(chatId, `❌ ${result.error}`);
    }
});

// /feature <id> - детали конкретной точки
bot.onText(/\/feature (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const pointId = match[1];

    if (!ctx.footprintManager) {
        await bot.sendMessage(chatId, '❌ Система не инициализирована');
        return;
    }

    await bot.sendMessage(chatId, `🔍 Ищу детали для точки ${pointId}...`);

    const result = await ctx.footprintManager.printFeatureTable(userId, { pointId });

    if (!result.success) {
        await bot.sendMessage(chatId, `❌ ${result.error}`);
    }
});

// 🔥 НОВАЯ КОМАНДА: /force_update_confirmations - принудительное обновление подтверждений
bot.onText(/\/force_update_confirmations/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        if (!ctx.footprintManager) {
            await bot.sendMessage(chatId, '❌ Система отпечатков не инициализирована');
            return;
        }

        await bot.sendMessage(chatId, '🔧 Принудительно обновляю подтверждения узлов...');

        // Вызываем метод принудительного обновления
        // ⚠️ Функция в разработке — заменено на вежливую заглушку
        await bot.sendMessage(chatId, '⚠️ Эта функция находится в разработке и пока недоступна.');
        return;

        if (result.success) {
            let message = `✅ **ПОДТВЕРЖДЕНИЯ ОБНОВЛЕНЫ!**\n\n`;
            message += `📊 **РЕЗУЛЬТАТ:**\n`;
            message += `• Обновлено анализов: ${result.analysesUpdated}\n`;
            message += `• Обновлено узлов: ${result.nodesUpdated}\n`;
            message += `• Всего узлов: ${result.totalNodes}\n\n`;
            message += `💡 **Теперь точки будут правильно окрашены по количеству подтверждений!**`;
          
            await bot.sendMessage(chatId, message);
          
            // Показываем обновленную статистику
            const session = ctx.footprintManager.getActiveSession(userId);
            if (session && session.currentFootprint) {
                const stats = session.currentFootprint.getConfirmationStats ?
                    session.currentFootprint.getConfirmationStats() : {
                        totalNodes: 0,
                        confirmedNodes: 0
                    };
              
                setTimeout(async () => {
                    await bot.sendMessage(chatId,
                        `📊 **АКТУАЛЬНАЯ СТАТИСТИКА:**\n\n` +
                        `• Всего узлов: ${stats.totalNodes}\n` +
                        `• Подтвержденных узлов: ${stats.confirmedNodes}\n` +
                        `• Среднее подтверждений: ${stats.averageConfirmations?.toFixed(1) || '0.0'}\n\n` +
                        `🎯 **Команды:**\n` +
                        `/visualize_merge - показать объединение\n` +
                        `/visualize_stats - статистика совпадений`
                    );
                }, 1000);
            }
        } else {
            await bot.sendMessage(chatId,
                `❌ **Не удалось обновить подтверждения**\n\n` +
                `Ошибка: ${result.error || 'неизвестная ошибка'}\n\n` +
                `💡 **Возможные причины:**\n` +
                `• Нет активной сессии\n` +
                `• Нет данных для обновления\n` +
                `• Ошибка системы`
            );
        }

    } catch (error) {
        console.log('❌ Ошибка команды force_update_confirmations:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
});

// =============================================================================
// 🔄 ПОВОРОТ ГОРИЗОНТАЛЬНЫХ ИЗОБРАЖЕНИЙ ПЕРЕД ROBOFLOW (через canvas)
// =============================================================================


/**
* Определяет, является ли изображение горизонтальным (ширина > высоты)
* @param {string} imagePath - путь к изображению
* @returns {Promise<boolean>}
*/

/**
* Поворачивает изображение на 90 градусов (горизонтальное → вертикальное)
* @param {string} inputPath - путь к исходному изображению
* @param {string} outputPath - путь для сохранения повёрнутого
* @returns {Promise<Buffer>}
*/

// =============================================================================
// =============================================================================


// =============================================================================
// 🛡️ ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ОШИБОК
// =============================================================================

// Обработчик необработанных обещаний

// Обработчик необработанных исключений

// Graceful shutdown

// =============================================================================
// =============================================================================


// =============================================================================
// =============================================================================


// =============================================================================
// 🔄 ОБРАБОТЧИК CALLBACK-КНОПОК ДЛЯ ОБРАТНОЙ СВЯЗИ
// =============================================================================

// Глобальная переменная для временных данных
const feedbackSessions = new Map();


// =============================================================================
// 📌 ОБРАТНАЯ СВЯЗЬ (CALLBACK)
// =============================================================================
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
        // Обработка основной feedback кнопки
        if (data === 'feedback_correct') {
            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Спасибо за подтверждение!'
            });

            // Сохраняем в базу
            const feedbackData = {
                userId: userId,
                prediction: null, // Нужно найти оригинальный prediction
                correctionType: 'correct',
                imageId: 'unknown',
                timestamp: new Date().toISOString()
            };

            ctx.feedbackDB.addFeedback(feedbackData);

            // Обновляем сообщение
            await bot.editMessageText(
                `✅ Спасибо! Ваш ответ поможет улучшить точность анализа.`,
                {
                    chat_id: chatId,
                    message_id: messageId
                }
            );

        } else if (data === 'feedback_incorrect') {
            await bot.answerCallbackQuery(callbackQuery.id);

            // Показываем меню выбора типа ошибки
            await bot.editMessageText(
                `Что не так с анализом? Выберите вариант:`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: ctx.feedbackManager.createCorrectionKeyboard()
                }
            );

        }
        // Обработка конкретных исправлений
        else if (data.startsWith('correction_')) {
            const correctionType = data.replace('correction_', '');

            await bot.answerCallbackQuery(callbackQuery.id, {
                text: 'Спасибо за исправление!'
            });

            // Сохраняем в базу
            const feedbackData = {
                userId: userId,
                prediction: null,
                correctionType: correctionType,
                imageId: 'unknown',
                timestamp: new Date().toISOString(),
                notes: getCorrectionDescription(correctionType)
            };

            ctx.feedbackDB.addFeedback(feedbackData);

            // Обновляем сообщение
            await bot.editMessageText(
                `✅ Спасибо за исправление!\n` +
                `Тип: ${getCorrectionDescription(correctionType)}\n` +
                `Это поможет значительно улучшить точность модели.`,
                {
                    chat_id: chatId,
                    message_id: messageId
                }
            );
        }

    } catch (error) {
        console.log('❌ Ошибка обработки callback:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'Ошибка обработки'
        });
    }
});

// Вспомогательная функция для описаний исправлений

// =============================================================================
// 🌐 НАСТРОЙКА ВЕБХУКА ДЛЯ RENDER.COM
// =============================================================================


// Запускаем настройку вебхука через 3 секунды после старта

// Тестовый эндпоинт для проверки

// =============================================================================
// 🔧 КОМАНДЫ ДЛЯ СИСТЕМНОЙ ДИАГНОСТИКИ
// =============================================================================

// Команда /diagnostic - полная диагностика системы

// =============================================================================
// 📌 ДИАГНОСТИКА
// =============================================================================
bot.onText(/\/diagnostic/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        await bot.sendMessage(chatId, '🔍 Запускаю полную диагностику системы...');

        // Используем глобальную переменную systemDiagnostic
        if (systemDiagnostic) {
            await systemDiagnostic.sendDiagnosticReport(bot, chatId);
            await bot.sendMessage(chatId, '✅ Диагностика завершена!');
        } else {
            await bot.sendMessage(chatId, '❌ Модуль диагностики не инициализирован');
        }
    } catch (error) {
        console.log('❌ Ошибка диагностики:', error);
        await bot.sendMessage(chatId, `❌ Ошибка диагностики: ${error.message}`);
    }
});

// Команда /system_info - краткая информация о системе
bot.onText(/\/system_info/, async (msg) => {
    const chatId = msg.chat.id;

    const info = `
🔧 **СИСТЕМНАЯ ИНФОРМАЦИЯ**

📦 **МОДУЛИ:**
├─ 🦶 Footprint: цифровые отпечатки
├─ 🔍 Analysis: анализ следов
├─ 🎨 Visualization: визуализации
├─ 🤖 Bot: телеграм бот
├─ 🧮 Calculators: расчеты
├─ 📱 Apps: полезные приложения

⚙️ **НАСТРОЙКИ:**
├─ Автосовмещение: ✅ ВКЛ
├─ Визуализация объединений: ✅ ВКЛ
├─ Debug: ${DEBUG_MODE ? '✅ ВКЛ' : '❌ ВЫКЛ'}

📊 **КОМАНДЫ:**
├─ /start - начать
├─ /footprint_start - создать сессию отпечатков
├─ /diagnostic - диагностика системы
├─ /system_info - эта информация
├─ /visualize_merge - визуализация объединения
└─ /help - помощь

📈 **СТАТИСТИКА:**
├─ Пользователей: ${globalStats.totalUsers}
├─ Фото обработано: ${globalStats.totalPhotos}
├─ Анализов: ${globalStats.totalAnalyses}
└─ Активных сессий: ${ctx.sessionManager ? Array.from(ctx.sessionManager.activeSessions.keys()).length : 0}
`;

    await bot.sendMessage(chatId, info);
});

};
