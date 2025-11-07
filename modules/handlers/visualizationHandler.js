const fs = require('fs');
const VisualizationService = require('../services/visualizationService');
 

class VisualizationHandler {
    constructor(bot, sessionManager) {
        this.bot = bot;
        this.sessionManager = sessionManager;
        this.visualizationService = new VisualizationService();
    }

    /**
     * Показывает собранную модель
     */
    async handleShowModel(msg, match) {
        const chatId = msg.chat.id;
        const modelNumber = match ? parseInt(match[1]) : 1;

        try {
            const session = this.sessionManager.trailSessions.get(chatId);
            if (!session) {
                await this.bot.sendMessage(chatId, '❌ Нет активной сессии анализа тропы');
                return;
            }

            if (session.assembledModels.length === 0) {
                await this.bot.sendMessage(chatId,
                    '❌ Нет собранных моделей\n\n' +
                    'Сначала соберите модели:\n' +
                    '• /assemble_model - автоматическая сборка\n' +
                    '• /assemble_from_group [номер] - сборка из группы'
                );
                return;
            }

            const modelIndex = modelNumber - 1;
            if (modelIndex < 0 || modelIndex >= session.assembledModels.length) {
                await this.bot.sendMessage(chatId,
                    `❌ Модель №${modelNumber} не найдена\n\n` +
                    `Доступные модели: 1-${session.assembledModels.length}`
                );
                return;
            }

            const model = session.assembledModels[modelIndex];
            const footprints = session.footprints.filter(f =>
                model.sourcePrints.includes(f.id)
            );

            await this.bot.sendMessage(chatId, '🎨 Создаю визуализацию модели...');

            const vizPath = await this.visualizationService.createModelVisualization(model, footprints);
           
            if (vizPath) {
                await this.bot.sendPhoto(chatId, vizPath, {
                    caption: `🧩 **МОДЕЛЬ №${modelNumber}**\n\n` +
                            `📊 **Характеристики:**\n` +
                            `• Следов: ${footprints.length}\n` +
                            `• Полнота: ${model.completeness}%\n` +
                            `• Уверенность: ${model.confidence}%\n` +
                            `• ID: ${model.id}\n\n` +
                            `💡 *Цвета показывают разные исходные следы*`
                });

                // Удаляем временный файл
                fs.unlinkSync(vizPath);
            } else {
                await this.bot.sendMessage(chatId, '❌ Не удалось создать визуализацию');
            }

        } catch (error) {
            console.error('❌ Ошибка показа модели:', error);
            await this.bot.sendMessage(chatId, '❌ Ошибка при создании визуализации');
        }
    }

    /**
     * Детальная визуализация конкретной модели
     */
    async handleModelDetails(msg, match) {
        const chatId = msg.chat.id;
        const modelNumber = match ? parseInt(match[1]) : 1;

        try {
            const session = this.sessionManager.trailSessions.get(chatId);
            if (!session) {
                await this.bot.sendMessage(chatId, '❌ Нет активной сессии анализа тропы');
                return;
            }

            const modelIndex = modelNumber - 1;
            if (modelIndex < 0 || modelIndex >= session.assembledModels.length) {
                await this.bot.sendMessage(chatId,
                    `❌ Модель №${modelNumber} не найдена\n\n` +
                    `Доступные модели: 1-${session.assembledModels.length}`
                );
                return;
            }

            const model = session.assembledModels[modelIndex];
            const footprints = session.footprints.filter(f =>
                model.sourcePrints.includes(f.id)
            );

            // Создаем детальную визуализацию
            await this.bot.sendMessage(chatId, '🔍 Создаю детальную визуализацию...');

            const detailedViz = await this.visualizationService.createDetailedModelVisualization(model, footprints);
           
            if (detailedViz) {
                let detailsMessage = `🔬 **ДЕТАЛЬНЫЙ АНАЛИЗ МОДЕЛИ №${modelNumber}**\n\n`;
               
                detailsMessage += `📊 **Общая информация:**\n`;
                detailsMessage += `• ID: ${model.id}\n`;
                detailsMessage += `• Дата сборки: ${model.timestamp.toLocaleString('ru-RU')}\n`;
                detailsMessage += `• Полнота: ${model.completeness}%\n`;
                detailsMessage += `• Уверенность: ${model.confidence}%\n\n`;

                detailsMessage += `👣 **Использованные следы:**\n`;
                footprints.forEach((footprint, index) => {
                    const footprintNum = footprint.id.replace('footprint_', '#');
                    detailsMessage += `${index + 1}. ${footprintNum} (${footprint.patternType || 'неизвестно'})\n`;
                });

                detailsMessage += `\n🎯 **Рекомендации:**\n`;
                if (model.completeness < 50) {
                    detailsMessage += `• Добавьте больше следов для повышения полноты\n`;
                }
                if (model.confidence < 60) {
                    detailsMessage += `• Используйте более четкие фото для уверенности\n`;
                }

                await this.bot.sendPhoto(chatId, detailedViz, { caption: detailsMessage });

                // Удаляем временный файл
                fs.unlinkSync(detailedViz);
            } else {
                await this.bot.sendMessage(chatId, '❌ Не удалось создать детальную визуализацию');
            }

        } catch (error) {
            console.error('❌ Ошибка детальной визуализации:', error);
            await this.bot.sendMessage(chatId, '❌ Ошибка при создании детальной визуализации');
        }
    }

    /**
     * Показывает все модели с картинками
     */
    async handleVisualizeResults(msg) {
        const chatId = msg.chat.id;

        try {
            const session = this.sessionManager.trailSessions.get(chatId);
            if (!session) {
                await this.bot.sendMessage(chatId, '❌ Нет активной сессии анализа тропы');
                return;
            }

            if (session.assembledModels.length === 0) {
                await this.bot.sendMessage(chatId,
                    '❌ Нет собранных моделей для визуализации\n\n' +
                    'Сначала соберите модели командой:\n' +
                    '`/assemble_model`'
                );
                return;
            }

            await this.bot.sendMessage(chatId,
                `📊 **ВИЗУАЛИЗАЦИЯ РЕЗУЛЬТАТОВ**\n\n` +
                `Обрабатываю ${session.assembledModels.length} моделей...`
            );

            // Создаем визуализацию для каждой модели
        for (let i = 0; i < session.assembledModels.length; i++) {
            const model = session.assembledModels[i];
            const footprints = session.footprints.filter(f => {
                // 🔧 ДОБАВИТЬ ПРОВЕРКУ ID ЗДЕСЬ:
                if (!f || !f.id) {
                    console.log('⚠️ Пропускаем след без ID:', f);
                    return false;
                }
                return model.sourcePrints.includes(f.id);
            });

            // 🔧 И ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА:
            if (footprints.length === 0) {
                console.log('⚠️ Нет валидных следов для модели:', model.id);
                continue;
            }

            const vizPath = await this.visualizationService.createModelVisualization(model, footprints);
           
            if (vizPath) {
                await this.bot.sendPhoto(chatId, vizPath, {
                    caption: `🧩 **МОДЕЛЬ ${i + 1}/${session.assembledModels.length}**\n\n` +
                            `• Следов: ${footprints.length}\n` +
                            `• Полнота: ${model.completeness}%\n` +
                            `• Уверенность: ${model.confidence}%\n\n` +
                            `🔍 Детали: /model_details ${i + 1}`
                });

                // Удаляем временный файл
                fs.unlinkSync(vizPath);
               
                // Небольшая задержка между сообщениями
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

            // Итоговое сообщение
            await this.bot.sendMessage(chatId,
                `🎯 **ВИЗУАЛИЗАЦИЯ ЗАВЕРШЕНА**\n\n` +
                `📈 **Итоги:**\n` +
                `• Обработано моделей: ${session.assembledModels.length}\n` +
                `• Всего следов: ${session.footprints.length}\n` +
                `• Средняя полнота: ${this.calculateAverageCompleteness(session).toFixed(1)}%\n\n` +
                `💡 **Дальнейшие действия:**\n` +
                `• /show_model [номер] - посмотреть конкретную модель\n` +
                `• /model_details [номер] - детальный анализ\n` +
                `• /save_assembled Название - сохранить как эталон`
            );

        } catch (error) {
            console.error('❌ Ошибка визуализации результатов:', error);
            await this.bot.sendMessage(chatId, '❌ Ошибка при создании визуализации результатов');
        }
    }

    /**
     * Расчет средней полноты моделей
     */
    calculateAverageCompleteness(session) {
        if (session.assembledModels.length === 0) return 0;
       
        const totalCompleteness = session.assembledModels.reduce((sum, model) =>
            sum + (model.completeness || 0), 0
        );
       
        return totalCompleteness / session.assembledModels.length;
    }
}

module.exports = VisualizationHandler;
