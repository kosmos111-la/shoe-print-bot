// modules/telegram/handlers.js
const path = require('path');
const { showMainMenu, showTrailAnalysisMenu } = require('./menu');
const { analyzePhotoPipeline } = require('../analysis/pipeline');

class TelegramHandlers {
    constructor(bot, sessionManager, dataPersistence) {
        this.bot = bot;
        this.sessionManager = sessionManager;
        this.dataPersistence = dataPersistence;
        this.setupHandlers();
    }

    setupHandlers() {
        this.setupTextHandlers();
        this.setupCallbackHandlers();
        this.setupPhotoHandler();
    }

    setupTextHandlers() {
        // =============================================================================
        // 📱 ОСНОВНЫЕ КОМАНДЫ
        // =============================================================================

        this.bot.onText(/\/start/, async (msg) => {
            this.sessionManager.updateUserStats(msg.from.id, msg.from.username || msg.from.first_name);
            await showMainMenu(msg.chat.id, this.bot, this.sessionManager);
        });

        this.bot.onText(/\/menu/, async (msg) => {
            await showMainMenu(msg.chat.id, this.bot, this.sessionManager);
        });

        this.bot.onText(/\/help/, async (msg) => {
            await this.handleHelp(msg.chat.id);
        });

        this.bot.onText(/\/statistics/, async (msg) => {
            await this.handleStatistics(msg.chat.id);
        });

        // =============================================================================
        // 🕵️‍♂️ КОМАНДЫ РЕЖИМА ТРОПЫ
        // =============================================================================

        this.bot.onText(/\/trail_start/, async (msg) => {
            await this.handleTrailStart(msg);
        });

        this.bot.onText(/\/trail_status/, async (msg) => {
            await this.handleTrailStatus(msg.chat.id);
        });

        this.bot.onText(/\/trail_report/, async (msg) => {
            await this.handleTrailReport(msg.chat.id);
        });

        this.bot.onText(/\/trail_notes(?:\s+(.+))?/, async (msg, match) => {
            await this.handleTrailNotes(msg.chat.id, match ? match[1] : null);
        });

        this.bot.onText(/\/trail_finish/, async (msg) => {
            await this.handleTrailFinish(msg.chat.id);
        });

        // =============================================================================
        // 💾 КОМАНДЫ ДЛЯ РАБОТЫ С ЭТАЛОНАМИ
        // =============================================================================

        this.bot.onText(/\/save_reference$/, async (msg) => {
            await this.handleSaveReference(msg.chat.id);
        });

        this.bot.onText(/\/save_reference (.+)/, async (msg, match) => {
            await this.handleSaveReferenceWithName(msg.chat.id, match[1].trim());
        });

        this.bot.onText(/\/list_references/, async (msg) => {
            await this.handleListReferences(msg.chat.id);
        });

        this.bot.onText(/\/compare$/, async (msg) => {
            await this.handleCompare(msg.chat.id);
        });

        this.bot.onText(/\/compare (.+)/, async (msg, match) => {
            await this.handleCompareWithModel(msg.chat.id, match[1].trim());
        });

        this.bot.onText(/\/cancel/, async (msg) => {
            await this.handleCancel(msg.chat.id);
        });

        // =============================================================================
        // 🧩 КОМАНДЫ СБОРКИ МОДЕЛЕЙ
        // =============================================================================

        this.bot.onText(/\/assemble_model/, async (msg) => {
            await this.handleAssembleModel(msg.chat.id);
        });

        this.bot.onText(/\/save_assembled (.+)/, async (msg, match) => {
            await this.handleSaveAssembled(msg.chat.id, match[1].trim());
        });

        this.bot.onText(/\/show_groups/, async (msg) => {
            await this.handleShowGroups(msg.chat.id);
        });

        this.bot.onText(/\/compare_footprints (\d+) (\d+)/, async (msg, match) => {
            await this.handleCompareFootprints(msg.chat.id, parseInt(match[1]), parseInt(match[2]));
        });

        this.bot.onText(/\/assemble_from_group (\d+)/, async (msg, match) => {
            await this.handleAssembleFromGroup(msg.chat.id, parseInt(match[1]) - 1);
        });

        this.bot.onText(/\/detailed_stats/, async (msg) => {
            await this.handleDetailedStats(msg.chat.id);
        });

        this.bot.onText(/\/save_data/, async (msg) => {
            await this.handleSaveData(msg.chat.id);
        });

        // =============================================================================
        // 🔧 КОМАНДЫ ТЕСТИРОВАНИЯ И ОТЛАДКИ
        // =============================================================================

        this.bot.onText(/\/debug_patterns/, async (msg) => {
            await this.handleDebugPatterns(msg.chat.id);
        });

        this.bot.onText(/\/test_classify/, async (msg) => {
            await this.handleTestClassify(msg.chat.id);
        });

        this.bot.onText(/\/test_geometry/, async (msg) => {
            await this.handleTestGeometry(msg.chat.id);
        });

        this.bot.onText(/\/rebuild_hierarchy/, async (msg) => {
            await this.handleRebuildHierarchy(msg.chat.id);
        });

        this.bot.onText(/\/hierarchy_debug/, async (msg) => {
            await this.handleHierarchyDebug(msg.chat.id);
        });

        this.bot.onText(/\/debug_reset/, async (msg) => {
            await this.handleDebugReset(msg);
        });
    }

    setupCallbackHandlers() {
        this.bot.on('callback_query', async (callbackQuery) => {
            const message = callbackQuery.message;
            const chatId = message.chat.id;
            const data = callbackQuery.data;
            const user = callbackQuery.from;

            await this.bot.answerCallbackQuery(callbackQuery.id);

            console.log(`🔄 Обработка кнопки: ${data} от пользователя ${user.username || user.first_name}`);

            try {
                await this.handleCallbackQuery(chatId, data, user, message);
            } catch (error) {
                console.error('❌ Ошибка обработки кнопки:', error);
                await this.bot.sendMessage(chatId, '❌ Произошла ошибка при обработке запроса');
                await showMainMenu(chatId, this.bot, this.sessionManager);
            }
        });
    }

    setupPhotoHandler() {
        this.bot.on('photo', async (msg) => {
            try {
                await analyzePhotoPipeline(msg, this.bot, this.sessionManager, this.dataPersistence);
            } catch (error) {
                console.error('❌ Ошибка обработки фото:', error);
                await this.bot.sendMessage(msg.chat.id, '❌ Ошибка при обработке фото. Попробуйте еще раз.');
            }
        });
    }

    // =============================================================================
    // 🎯 РЕАЛИЗАЦИИ ОБРАБОТЧИКОВ КОМАНД
    // =============================================================================

    async handleHelp(chatId) {
        const helpText = `🆘 **ПОМОЩЬ И ИНФОРМАЦИЯ О СИСТЕМЕ**\n\n` +
            `🔍 **О СИСТЕМЕ:**\n` +
            `• Модель: Анализатор следов обуви\n` +
            `• Статус: Активна\n` +
            `• Версия: 2.0\n\n` +
            `🎯 **ОСНОВНЫЕ КОМАНДЫ:**\n` +
            `• Просто отправьте фото - анализ следа\n` +
            `• /trail_start - режим анализа тропы\n` +
            `• /save_reference - сохранить эталон\n` +
            `• /compare - сравнить с эталоном\n\n` +
            `🧩 **ФУНКЦИИ СБОРКИ:**\n` +
            `• /assemble_model - собрать полную модель из частей\n` +
            `• /show_groups - показать группы совместимости\n` +
            `• /compare_footprints 1 2 - сравнить два отпечатка\n\n` +
            `💡 **Рекомендации по съемке:**\n` +
            `- Четкий след на контрастном фоне\n` +
            `- Прямой угол съемки\n` +
            `- Хорошее освещение\n` +
            `- Крупный план\n\n` +
            `⚠️ **Ограничения системы:**\n` +
            `- Требуется хорошее качество фото\n` +
            `- Может не работать с сильно зашумленными изображениями`;

        await this.bot.sendMessage(chatId, helpText);
    }

    async handleStatistics(chatId) {
        const stats = this.sessionManager.getStatistics();
        const activeUsers = stats.activeUsers;

        const statsText = `📊 **СТАТИСТИКА БОТА:**\n\n` +
            `👥 Пользователи: ${stats.totalUsers} (${activeUsers} активных)\n` +
            `📸 Фото обработано: ${stats.totalPhotos}\n` +
            `🔍 Анализов проведено: ${stats.totalAnalyses}\n` +
            `🔄 Сравнений сделано: ${stats.comparisonsMade}\n` +
            `📅 Последний анализ: ${this.sessionManager.globalStats.lastAnalysis ?
                this.sessionManager.globalStats.lastAnalysis.toLocaleString('ru-RU') : 'еще нет'}`;

        await this.bot.sendMessage(chatId, statsText);
    }

    async handleTrailStart(msg) {
        const chatId = msg.chat.id;
        const username = msg.from.username || msg.from.first_name;

        console.log(`🕵️‍♂️ Запрос на создание сессии от ${username} (chatId: ${chatId})`);

        const session = this.sessionManager.getTrailSession(chatId, username);

        console.log(`✅ Сессия создана:`, {
            sessionId: session.sessionId,
            status: session.status,
            footprintsCount: session.footprints.length
        });

        await this.bot.sendMessage(chatId,
            `🕵️‍♂️ **РЕЖИМ ТРОПЫ АКТИВИРОВАН**\n\n` +
            `**Сессия:** ${session.sessionId}\n` +
            `**Эксперт:** ${username}\n` +
            `**Время начала:** ${session.startTime.toLocaleString('ru-RU')}\n\n` +
            `🔍 **Теперь все отпечатки будут автоматически:**\n` +
            `• Сохраняться в текущую сессию\n` +
            `• Сравниваться между собой\n` +
            `• Анализироваться на сходимость\n\n` +
            `📸 **Просто отправляйте фото отпечатков подошв**\n\n` +
            `**Команды эксперта:**\n` +
            `• /trail_status - статус сессии\n` +
            `• /trail_report - экспертное заключение\n` +
            `• /trail_notes - добавить заметки\n` +
            `• /trail_finish - завершить сессию\n\n` +
            `⚠️ *Все данные сохраняются только до перезапуска бота*`
        );
    }

    async handleTrailStatus(chatId) {
        const session = this.sessionManager.trailSessions.get(chatId);

        if (!session) {
            await this.bot.sendMessage(chatId,
                '❌ Активная сессия анализа тропы не найдена.\n' +
                'Используйте /trail_start для начала работы.'
            );
            return;
        }

        const summary = session.getSessionSummary();

        let status = `🕵️‍♂️ **РЕЖИМ ТРОПЫ АКТИВИРОВАН**\n\n`;
        status += `**ID:** ${summary.sessionId}\n`;
        status += `**Статус:** ${summary.status === 'active' ? '🟢 АКТИВНА' : '🔴 ЗАВЕРШЕНА'}\n`;
        status += `**Отпечатков:** ${summary.footprintsCount}\n`;
        status += `**Сравнений:** ${summary.comparisonsCount}\n`;
        status += `**Средняя сходимость:** ${summary.averageSimilarity.toFixed(1)}%\n`;
        status += `**Длительность:** ${Math.round(summary.duration / 60000)} мин.\n`;

        if (session.notes) {
            status += `\n**Заметки эксперта:**\n${session.notes}`;
        }

        await this.bot.sendMessage(chatId, status);
    }

    async handleTrailReport(chatId) {
        const session = this.sessionManager.trailSessions.get(chatId);

        if (!session) {
            await this.bot.sendMessage(chatId, '❌ Нет активной сессии для отчета.');
            return;
        }

        if (session.footprints.length < 2) {
            await this.bot.sendMessage(chatId,
                '📊 **Недостаточно данных для отчета**\n\n' +
                'Для генерации экспертного заключения требуется минимум 2 отпечатка.\n' +
                `Сейчас в сессии: ${session.footprints.length} отпечатков`
            );
            return;
        }

        const report = session.generateExpertReport();
        await this.bot.sendMessage(chatId, report);
    }

    async handleTrailNotes(chatId, notesText) {
        const session = this.sessionManager.trailSessions.get(chatId);

        if (!session) {
            await this.bot.sendMessage(chatId, '❌ Нет активной сессии для добавления заметок.');
            return;
        }

        if (!notesText) {
            await this.bot.sendMessage(chatId,
                '📝 **Добавление заметок к сессии**\n\n' +
                'Использование: `/trail_notes Ваш текст заметки`\n\n' +
                'Текущие заметки:\n' +
                (session.notes || 'Пока нет заметок')
            );
            return;
        }

        session.notes = notesText;
        await this.bot.sendMessage(chatId, '✅ Заметки эксперта сохранены');
    }

    async handleTrailFinish(chatId) {
        const session = this.sessionManager.trailSessions.get(chatId);

        if (!session) {
            await this.bot.sendMessage(chatId, '❌ Нет активной сессии для завершения.');
            return;
        }

        session.status = 'completed';
        const report = session.generateExpertReport();

        await this.bot.sendMessage(chatId,
            `🔚 **СЕССИЯ АНАЛИЗА ТРОПЫ ЗАВЕРШЕНА**\n\n${report}\n\n` +
            `📁 Все данные сохранены до перезапуска бота.\n` +
            `🔄 Для новой сессии используйте /trail_start`
        );
    }

    async handleSaveReference(chatId) {
        await this.bot.sendMessage(chatId,
            '💾 **СОХРАНЕНИЕ ЭТАЛОННОГО ОТПЕЧАТКА**\n\n' +
            '📝 **Укажите название модели через пробел:**\n' +
            'Пример: `/save_reference Nike_Air_Max_90`\n\n' +
            '💡 **Рекомендации:**\n' +
            '• Фото чистой подошвы сверху\n' +
            '• Хорошее освещение без теней\n' +
            '• Четкий фокус на протекторе\n' +
            '• Название без пробелов (используйте _)\n\n' +
            '❌ Для отмены: /cancel'
        );
    }

    async handleSaveReferenceWithName(chatId, modelName) {
        const session = this.sessionManager.getSession(chatId);

        if (modelName.length < 2) {
            await this.bot.sendMessage(chatId, '❌ Название модели слишком короткое');
            return;
        }

        session.waitingForReference = modelName;

        await this.bot.sendMessage(chatId,
            `💾 Сохраняю эталон: "${modelName}"\n\n` +
            '📸 **Отправьте фото подошвы:**\n' +
            '• Чистая подошва, вид сверху\n' +
            '• Хорошее освещение\n' +
            '• Максимальная детализация\n\n' +
            '❌ Для отмены: /cancel'
        );
    }

    async handleListReferences(chatId) {
        if (this.sessionManager.referencePrints.size === 0) {
            await this.bot.sendMessage(chatId,
                '📝 **СПИСОК ЭТАЛОНОВ ПУСТ**\n\n' +
                'Для добавления эталонов:\n' +
                '`/save_reference Название_Модели`'
            );
            return;
        }

        let list = '📝 **СОХРАНЕННЫЕ ЭТАЛОНЫ:**\n\n';
        let counter = 1;

        this.sessionManager.referencePrints.forEach((ref, modelName) => {
            const date = ref.timestamp.toLocaleDateString('ru-RU');
            const details = ref.features ? ref.features.detailCount : '?';
            list += `${counter}. **${modelName}**\n`;
            list += `   📅 ${date} | 🔵 ${details} дет.\n\n`;
            counter++;
        });

        await this.bot.sendMessage(chatId, list);
    }

    async handleCompare(chatId) {
        if (this.sessionManager.referencePrints.size === 0) {
            await this.bot.sendMessage(chatId,
                '📝 **СПИСОК ЭТАЛОНОВ ПУСТ**\n\n' +
                'Сначала сохраните эталоны:\n' +
                '`/save_reference Название_Модели`\n\n' +
                'Или просто отправьте фото для быстрого анализа'
            );
            return;
        }

        let message = '🔍 **СРАВНЕНИЕ С ЭТАЛОНОМ**\n\n';
        message += '📝 **Укажите модель для сравнения:**\n';

        this.sessionManager.referencePrints.forEach((ref, modelName) => {
            const details = ref.features ? ref.features.detailCount : '?';
            message += `• \`/compare ${modelName}\` (${details} дет.)\n`;
        });

        message += '\n💡 **Или отправьте фото для быстрого анализа**';

        await this.bot.sendMessage(chatId, message);
    }

    async handleCompareWithModel(chatId, modelName) {
        const session = this.sessionManager.getSession(chatId);
        const reference = this.sessionManager.referencePrints.get(modelName);

        if (!reference) {
            let message = `❌ Эталон "${modelName}" не найден\n\n`;
            message += '📋 **Доступные эталоны:**\n';

            this.sessionManager.referencePrints.forEach((ref, name) => {
                message += `• ${name}\n`;
            });

            await this.bot.sendMessage(chatId, message);
            return;
        }

        session.waitingForComparison = {
            modelName: modelName,
            reference: reference
        };

        await this.bot.sendMessage(chatId,
            `🔍 Сравниваю со следом: "${modelName}"\n\n` +
            '📸 **Отправьте фото следа:**\n' +
            '• След на грунте/песке\n' +
            '• Прямой угол съемки\n' +
            '• Хорошая четкость\n\n' +
            '🎯 **Алгоритм учитывает:**\n' +
            '• Крупные элементы узора\n' +
            '• Расположение деталей\n' +
            '• Характерные формы\n\n' +
            '❌ Для отмены: /cancel'
        );
    }

    async handleCancel(chatId) {
        const session = this.sessionManager.getSession(chatId);
        session.waitingForReference = null;
        session.waitingForComparison = null;
        await this.bot.sendMessage(chatId, '❌ Операция отменена');
    }

        async handleAssembleModel(chatId) {
        console.log(`🧩 Запрос сборки модели для чата ${chatId}`);
      
        const session = this.sessionManager.trailSessions.get(chatId);
        if (!session || session.footprints.length < 2) {
            await this.bot.sendMessage(chatId,
                '❌ Недостаточно отпечатков для сборки модели.\n\n' +
                'Требуется минимум 2 отпечатка.\n' +
                `Сейчас в сессии: ${session ? session.footprints.length : 0} отпечатков`
            );
            return;
        }
      
        await this.bot.sendMessage(chatId,
            '🧩 Начинаю сборку полной модели из доступных частей...\n' +
            '📊 Анализирую геометрию и совместимость...'
        );
      
        // Получаем размер изображения для анализа
        let imageWidth = 800, imageHeight = 600;
        try {
            const { loadImage } = require('canvas');
            const firstFootprint = session.footprints[0];
            const image = await loadImage(firstFootprint.imageUrl);
            imageWidth = image.width;
            imageHeight = image.height;
        } catch (error) {
            console.log('⚠️ Не удалось получить размер изображения, использую значения по умолчанию');
        }
      
        // Получаем FootprintAssembler
        const { FootprintAssembler } = require('../footprint_assembler');
        const footprintAssembler = new FootprintAssembler();
      
        const result = session.assembleModelFromParts(imageWidth, imageHeight, footprintAssembler);
      
        if (result.success) {
            const partsStats = session.getPartsStatistics();
          
            let message = `🧩 **МОДЕЛЬ УСПЕШНО СОБРАНА!**\n\n`;
            message += `📊 **Использовано отпечатков:** ${result.usedPrints.length}\n`;
            message += `🎯 **Полнота модели:** ${result.completeness}%\n`;
            message += `✅ **Уверенность:** ${result.confidence}%\n\n`;
          
            message += `📋 **Статистика частей:**\n`;
            message += `• Левые: ${partsStats.left_small + partsStats.left_medium + partsStats.left_large}\n`;
            message += `• Правые: ${partsStats.right_small + partsStats.right_medium + partsStats.right_large}\n`;
            message += `• Центральные: ${partsStats.center_small + partsStats.center_medium + partsStats.center_large}\n`;
            message += `• Неизвестные: ${partsStats.unknown}\n\n`;
          
            message += `💾 **Сохранить как эталон:**\n`;
            message += '`/save_assembled "Название_Модели"`\n\n';
          
            message += `🔍 **Просмотреть группы:** /show_groups`;
          
            await this.bot.sendMessage(chatId, message);
        } else {
            await this.bot.sendMessage(chatId,
                `❌ **Сборка модели не удалась**\n\n` +
                `Причина: ${result.error}\n\n` +
                `💡 **Рекомендации:**\n` +
                `• Добавьте больше отпечатков\n` +
                `• Убедитесь в схожести следов\n` +
                `• Используйте /compare_footprints для проверки совместимости`
            );
        }
    }

    async handleSaveAssembled(chatId, modelName) {
        console.log(`💾 Запрос сохранения собранной модели: "${modelName}"`);
      
        const session = this.sessionManager.trailSessions.get(chatId);
        if (!session || session.assembledModels.length === 0) {
            await this.bot.sendMessage(chatId,
                '❌ Нет собранных моделей для сохранения.\n' +
                'Сначала используйте /assemble_model'
            );
            return;
        }
      
        // Берем последнюю собранную модель
        const lastModel = session.assembledModels[session.assembledModels.length - 1];
      
        // Сохраняем как эталон
        this.sessionManager.referencePrints.set(modelName, {
            features: lastModel.model.features,
            imageUrl: lastModel.model.sourcePrints[0] ?
                session.footprints.find(f => f.id === lastModel.model.sourcePrints[0])?.imageUrl : '',
            timestamp: new Date(),
            predictions: lastModel.model.predictions,
            isAssembled: true,
            sourcePrints: lastModel.model.sourcePrints,
            completeness: lastModel.completeness,
            confidence: lastModel.confidence
        });
      
        await this.bot.sendMessage(chatId,
            `✅ **СОБРАННАЯ МОДЕЛЬ СОХРАНЕНА**\n\n` +
            `🏷️ **Название:** "${modelName}"\n` +
            `📊 **Источник:** ${lastModel.model.sourcePrints.length} отпечатков\n` +
            `🎯 **Полнота:** ${lastModel.completeness}%\n` +
            `✅ **Уверенность:** ${lastModel.confidence}%\n\n` +
            `💡 Используйте: \`/compare ${modelName}\` для сравнения`
        );
      
        // Автосохранение данных
        await this.dataPersistence.saveAllData();
    }

    async handleShowGroups(chatId) {
        const session = this.sessionManager.trailSessions.get(chatId);
        if (!session) {
            await this.bot.sendMessage(chatId, '❌ Активная сессия не найдена');
            return;
        }
      
        // Получаем FootprintAssembler для обновления групп
        const { FootprintAssembler } = require('../footprint_assembler');
        const footprintAssembler = new FootprintAssembler();
      
        session.updateCompatibilityGroups(footprintAssembler);
      
        if (session.compatibilityGroups.length === 0) {
            await this.bot.sendMessage(chatId, '❌ Группы не обнаружены. Добавьте больше следов.');
            return;
        }
      
        let message = `🕵️‍♂️ **АНАЛИЗ ТРОПЫ: ОБНАРУЖЕННЫЕ ЛЮДИ**\n\n`;
        message += `Всего следов: ${session.footprints.length}\n`;
        message += `Обнаружено людей: ${session.compatibilityGroups.length}\n\n`;
      
        session.compatibilityGroups.forEach((group, index) => {
            message += `**👤 ЧЕЛОВЕК ${index + 1}** (${group.length} следов):\n`;
          
            // Анализируем характеристики группы
            const groupAnalysis = this.analyzeGroupCharacteristics(group);
          
            message += `• 🎯 Уверенность: ${groupAnalysis.confidence}%\n`;
            message += `• 👣 Преобладающий тип: ${groupAnalysis.dominantPattern}\n`;
            message += `• 📏 Средний размер: ${groupAnalysis.avgSize}\n`;
            message += `• 🔍 Следы: ${group.map(f => f.id.replace('footprint_', '#')).join(', ')}\n\n`;
          
            message += `💡 *Для сборки модели:* /assemble_from_group ${index + 1}\n\n`;
        });
      
        // Несгруппированные следы
        const allGroupedFootprints = session.compatibilityGroups.flat();
        const ungroupedFootprints = session.footprints.filter(f => !allGroupedFootprints.includes(f));
      
        if (ungroupedFootprints.length > 0) {
            message += `⚠️ **НЕОПОЗНАННЫЕ СЛЕДЫ** (${ungroupedFootprints.length}):\n`;
            message += `• Возможно другие люди или шум\n`;
            message += `• Следы: ${ungroupedFootprints.map(f => f.id.replace('footprint_', '#')).join(', ')}\n\n`;
        }
      
        message += `🎯 **СЛЕДОВАТЬ ДАЛЬШЕ:**\n`;
        message += `• Добавьте следы с перекрестка\n`;
        message += `• Используйте /assemble_from_group [номер] для сборки конкретного человека\n`;
        message += `• /trail_report - полный отчет\n`;
      
        await this.bot.sendMessage(chatId, message);
    }

    async handleCompareFootprints(chatId, footprintIdA, footprintIdB) {
        console.log(`🔍 Запрос сравнения: ${footprintIdA} vs ${footprintIdB}`);
      
        const session = this.sessionManager.trailSessions.get(chatId);
        if (!session) {
            await this.bot.sendMessage(chatId,
                '❌ Активная сессия не найдена.\n' +
                'Используйте /trail_start для начала работы.'
            );
            return;
        }
      
        const footprintA = session.footprints.find(f => f.id === `footprint_${footprintIdA}`);
        const footprintB = session.footprints.find(f => f.id === `footprint_${footprintIdB}`);
      
        if (!footprintA || !footprintB) {
            await this.bot.sendMessage(chatId,
                '❌ Один или оба отпечатка не найдены.\n\n' +
                '📋 Доступные отпечатки:\n' +
                session.footprints.map(f => `• ${f.id.replace('footprint_', '')}: ${f.partType || 'неизвестно'}`).join('\n')
            );
            return;
        }
      
        await this.bot.sendMessage(chatId, '🎨 Создаю детальную визуализацию сравнения...');
      
        // Создаем визуализатор сравнения
        const { ComparisonVisualizer } = require('../comparisonVisualizer');
        const visualizer = new ComparisonVisualizer();
        const vizPath = await visualizer.createComparisonVisualization(
            footprintA,
            footprintB,
            footprintA.imageUrl
        );
      
        if (vizPath) {
            const similarity = visualizer.calculateOverallSimilarity(footprintA, footprintB);
          
            await this.bot.sendPhoto(chatId, vizPath, {
                caption: `🔍 **ДЕТАЛЬНОЕ СРАВНЕНИЕ**\n\n` +
                        `🆔 Отпечатки: #${footprintIdA} vs #${footprintIdB}\n` +
                        `🎯 Общее сходство: ${similarity.toFixed(1)}%\n` +
                        `📊 Типы: ${footprintA.partType || 'неизв.'} vs ${footprintB.partType || 'неизв.'}\n\n` +
                        `💡 *Зеленый = совпадения, Красный = различия, Желтый = отсутствующие*`
            });
          
            // Удаляем временный файл
            const fs = require('fs');
            fs.unlinkSync(vizPath);
        } else {
            await this.bot.sendMessage(chatId, '❌ Не удалось создать визуализацию сравнения');
        }
    }

    async handleAssembleFromGroup(chatId, groupNumber) {
        const session = this.sessionManager.trailSessions.get(chatId);
      
        if (!session) {
            await this.bot.sendMessage(chatId, '❌ Активная сессия не найдена');
            return;
        }
      
        // Получаем FootprintAssembler
        const { FootprintAssembler } = require('../footprint_assembler');
        const footprintAssembler = new FootprintAssembler();
      
        session.updateCompatibilityGroups(footprintAssembler);
      
        if (groupNumber < 0 || groupNumber >= session.compatibilityGroups.length) {
            await this.bot.sendMessage(chatId,
                `❌ Группа №${groupNumber + 1} не найдена. Доступные группы: 1-${session.compatibilityGroups.length}`
            );
            return;
        }
      
        const group = session.compatibilityGroups[groupNumber];
      
        await this.bot.sendMessage(chatId,
            `🧩 Сборка модели для человека ${groupNumber + 1}...\n` +
            `📊 Используется ${group.length} следов`
        );
      
        // Используем только следы из выбранной группы
        let imageWidth = 800, imageHeight = 600;
        if (group[0].features?.imageSize) {
            imageWidth = group[0].features.imageSize.width;
            imageHeight = group[0].features.imageSize.height;
        }
      
        const result = session.assembleModelFromGroup(group, imageWidth, imageHeight, footprintAssembler);
      
        if (result.success) {
            let message = `👤 **МОДЕЛЬ ЧЕЛОВЕКА ${groupNumber + 1}**\n\n`;
            message += `📊 Следов использовано: ${result.usedPrints.length}\n`;
            message += `🎯 Полнота модели: ${result.completeness}%\n`;
            message += `✅ Уверенность: ${result.confidence}%\n\n`;
            message += `💾 Сохранить как: /save_assembled Человек_${groupNumber + 1}\n\n`;
            message += `🔍 Просмотреть детали: /debug_group ${groupNumber + 1}`;
          
            await this.bot.sendMessage(chatId, message);
        } else {
            await this.bot.sendMessage(chatId, `❌ Не удалось собрать модель: ${result.error}`);
        }
    }

    async handleDetailedStats(chatId) {
        const session = this.sessionManager.trailSessions.get(chatId);
        if (session && session.footprints.length > 0) {
            const report = session.generateEnhancedReport();
            await this.bot.sendMessage(chatId, report);
        } else {
            await this.bot.sendMessage(chatId,
                '❌ Нет данных для отчета.\n\n' +
                '💡 **Сначала добавьте следы в сессию**'
            );
        }
    }

    async handleSaveData(chatId) {
        await this.bot.sendMessage(chatId, '💾 Сохраняю все данные...');
      
        await this.dataPersistence.saveAllData();
      
        const sessionsCount = Array.from(this.sessionManager.trailSessions.values()).length;
      
        await this.bot.sendMessage(chatId,
            '✅ **ВСЕ ДАННЫЕ СОХРАНЕНЫ!**\n\n' +
            `📊 **Сохранено:**\n` +
            `• Сессий анализа: ${sessionsCount}\n` +
            `• Эталонов: ${this.sessionManager.referencePrints.size}\n` +
            `• Пользователей: ${this.sessionManager.userStats.size}\n\n` +
            `💡 **В сохраненные данные входят:**\n` +
            `• Все активные сессии\n` +
            `• Эталонные отпечатки\n` +
            `• Статистика системы\n` +
            `• История анализов\n\n` +
            `🔄 **Данные будут восстановлены после перезапуска бота**`
        );
    }

    // Вспомогательные методы
    analyzeGroupCharacteristics(group) {
        if (group.length === 0) {
            return { confidence: 0, dominantPattern: 'неизвестно', avgSize: 'неизвестно' };
        }
      
        // Анализ преобладающего типа узора
        const patternCounts = {};
        group.forEach(footprint => {
            const pattern = footprint.patternType || 'unknown';
            patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
        });
      
        const dominantPattern = Object.entries(patternCounts)
            .sort((a, b) => b[1] - a[1])[0][0];
      
        // Расчет уверенности
        const confidence = Math.min((group.length / 3) * 100, 100);
      
        // Средний "размер" по деталям
        const avgDetails = group.reduce((sum, f) => sum + (f.features?.detailCount || 0), 0) / group.length;
        const avgSize = avgDetails > 20 ? 'крупный' : avgDetails > 10 ? 'средний' : 'мелкий';
      
        return {
            confidence: Math.round(confidence),
            dominantPattern: dominantPattern.split('_')[0] || 'неизвестно',
            avgSize: avgSize
        };
    }

    async handleCallbackQuery(chatId, data, user, message) {
        // Обработка callback запросов будет реализована в отдельном модуле
        const { handleCallbackActions } = require('./callbackHandlers');
        await handleCallbackActions(chatId, data, user, message, this.bot, this.sessionManager);
    }

    // Методы для тестирования и отладки будут добавлены позже
    async handleDebugPatterns(chatId) {
        await this.bot.sendMessage(chatId, '🔬 Функция отладки узоров в разработке...');
    }

    async handleTestClassify(chatId) {
        await this.bot.sendMessage(chatId, '🧪 Тест классификации в разработке...');
    }

    async handleTestGeometry(chatId) {
        await this.bot.sendMessage(chatId, '📐 Тест геометрии в разработке...');
    }

    async handleRebuildHierarchy(chatId) {
        await this.bot.sendMessage(chatId, '🏔️ Перевернутая пирамида в разработке...');
    }

    async handleHierarchyDebug(chatId) {
        await this.bot.sendMessage(chatId, '🔍 Детали пирамиды в разработке...');
    }

    async handleDebugReset(msg) {
        const chatId = msg.chat.id;
        this.sessionManager.trailSessions.delete(chatId);
        const session = this.sessionManager.getTrailSession(chatId, msg.from.username || msg.from.first_name);
      
        await this.bot.sendMessage(chatId,
            '🔄 **СБРОС СЕССИИ ДЛЯ ТЕСТИРОВАНИЯ**\n\n' +
            'Сессия очищена и создана заново.\n' +
            'Можете начинать тестирование функций сборки.'
        );
    }
}

module.exports = { TelegramHandlers };

