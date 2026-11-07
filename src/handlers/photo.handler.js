// src/handlers/photo.handler.js
// 📸 ОБРАБОТКА ФОТО: очередь, одиночная обработка, пачки, поворот изображений
// (вынесено из main.js на Этапе C — код перенесён БЕЗ внутренней декомпозиции)

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');

// Чистые утилиты (Этап A)
const { smartPostProcessing, analyzePredictions } = require('../utils/predictions');
// Централизованное состояние очередей (Этап A)
const store = require('../state/store');
const { photoBatchDetector, photoQueue, processingUsers } = store;

/**
 * Регистрирует обработчик фото.
 * @param {TelegramBot} bot - экземпляр бота
 * @param {Object} ctx - контекст с геттерами на глобальные объекты main.js
 */
module.exports = function registerPhotoHandler(bot, ctx) {
// ---------- Поворот изображений (canvas) ----------
const { createCanvas, loadImage } = require('canvas');

/**
* Определяет, является ли изображение горизонтальным (ширина > высоты)
* @param {string} imagePath - путь к изображению
* @returns {Promise<boolean>}
*/
async function isHorizontalImage(imagePath) {
    try {
        const image = await loadImage(imagePath);
        const isHorizontal = image.width > image.height;
        if (isHorizontal) {
            console.log(`📐 Изображение горизонтальное (${image.width}x${image.height}) → будет повёрнуто`);
        }
        return isHorizontal;
    } catch (error) {
        console.log('⚠️ Ошибка определения ориентации:', error.message);
        return false;
    }
}

/**
* Поворачивает изображение на 90 градусов (горизонтальное → вертикальное)
* @param {string} inputPath - путь к исходному изображению
* @param {string} outputPath - путь для сохранения повёрнутого
* @returns {Promise<Buffer>}
*/
async function rotateImageToVertical(inputPath, outputPath) {
    try {
        const image = await loadImage(inputPath);
       
        const canvas = createCanvas(image.height, image.width);
        const ctx = canvas.getContext('2d');
       
        ctx.translate(image.height, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(image, 0, 0);
       
        const buffer = canvas.toBuffer('image/jpeg');
        fs.writeFileSync(outputPath, buffer);
       
        console.log(`🔄 Изображение повёрнуто на 90° (горизонтальное → вертикальное)`);
        return buffer;
    } catch (error) {
        console.log('⚠️ Ошибка поворота:', error.message);
        const originalBuffer = fs.readFileSync(inputPath);
        return originalBuffer;
    }
}


bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Добавляем фото в детектор пачки
    if (!photoBatchDetector.has(userId)) {
        photoBatchDetector.set(userId, {
            photos: [],
            timer: null
        });
    }

    const detector = photoBatchDetector.get(userId);
    detector.photos.push({
        msg: msg,
        timestamp: Date.now()
    });

    // Сбрасываем таймер
    if (detector.timer) {
        clearTimeout(detector.timer);
    }

    // Ждем 1 секунду для сбора пачки фото
    detector.timer = setTimeout(async () => {
        const photos = detector.photos;
        photoBatchDetector.delete(userId);

        // Если фото одно и нет активной сессии - обрабатываем сразу
        if (photos.length === 1 && (!ctx.sessionManager || !ctx.sessionManager.hasActiveSession(userId))) {
            await processSinglePhoto(chatId, userId, photos[0].msg);
            return;
        }

        // Если несколько фото или есть активная сессия - добавляем в очередь
        if (!photoQueue.has(userId)) {
            photoQueue.set(userId, []);
        }

        photos.forEach(photo => {
            photoQueue.get(userId).push({
                msg: photo.msg,
                timestamp: photo.timestamp
            });
        });

        // Запускаем обработку очереди
        setTimeout(() => processPhotoQueue(userId, chatId), 100);

    }, 1000); // Ждем 1 секунду для сбора пачки
});

async function processPhotoQueue(userId, chatId) {
    if (processingUsers.has(userId)) return;
    if (!photoQueue.has(userId) || photoQueue.get(userId).length === 0) return;

    processingUsers.add(userId);
    const queue = photoQueue.get(userId);

    // Сортируем по времени получения
    queue.sort((a, b) => a.timestamp - b.timestamp);

    // Проверяем, нужно ли создать сессию автоматически
    const shouldCreateAutoSession = queue.length >= 2 &&
                                   !ctx.sessionManager.hasActiveSession(userId);

    let sessionCreated = false;
    if (shouldCreateAutoSession) {
        // Создаем автоматическую сессию для пачки фото
        const session = ctx.sessionManager.createSession(userId, 'auto_batch');

        // Предупреждаем пользователя ОДИН РАЗ
        await bot.sendMessage(chatId,
            `📦 **ОБНАРУЖЕНА ПАЧКА ФОТО (${queue.length})**\n\n` +
            `🔄 Автоматически перехожу в сессионный режим\n` +
            `🆔 Сессия: ${session.id.slice(0, 8)}...\n\n` +
            `📋 **Инструкция:**\n` +
            `• Фото будут обработаны по очереди\n` +
            `• Каждое фото будет подтверждено\n` +
            `• В конце - полный отчет\n\n` +
            `💡 **Команды сессии:**\n` +
            `/trail_status - статус\n` +
            `/trail_end - завершить с отчетом\n` +
            `/cancel - отменить сессию`
        );

        sessionCreated = true;
    }

    // Обрабатываем фото по очереди
    for (let i = 0; i < queue.length; i++) {
        const photoData = queue[i];

        try {
            // Имитируем отправку фото (вызываем обработчик фото)
            await processSinglePhoto(chatId, userId, photoData.msg, i + 1, queue.length);

            // Небольшая задержка между обработкой фото
            if (i < queue.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

        } catch (error) {
            console.log(`❌ Ошибка обработки фото ${i + 1}:`, error.message);
            await bot.sendMessage(chatId, `❌ Ошибка при обработке фото ${i + 1}`);
        }
    }

    // Очищаем очередь
    photoQueue.delete(userId);
    processingUsers.delete(userId);

    // Если создали автоматическую сессию, напоминаем о командах
    if (sessionCreated) {
        await bot.sendMessage(chatId,
            `✅ Все ${queue.length} фото обработаны\n\n` +
            `📊 Сессия активна, можно:\n` +
            `• Отправить еще фото\n` +
            `• Проверить статус: /trail_status\n` +
            `• Завершить с отчетом: /trail_end\n` +
            `• Отменить: /cancel`
        );
    }
}

async function processSinglePhoto(chatId, userId, msg, currentIndex = 1, totalCount = 1) {
    const hasSession = ctx.sessionManager ? ctx.sessionManager.hasActiveSession(userId) : false;
   
    // 🔥 ОБЪЯВЛЯЕМ ПЕРЕМЕННЫЕ ДЛЯ ФАЙЛОВ (в самом начале)
    let tempImagePath = null;
    let finalImagePath = null;

    try {
        ctx.updateUserStats(userId, msg.from.username || msg.from.first_name, 'photo');

        // 🆕 СЕССИОННЫЙ РЕЖИМ: отправляем короткое подтверждение
        let statusMessage = null;
        if (hasSession) {
            const session = ctx.sessionManager.getActiveSession(userId);
            const photoNum = session.photos.length + 1;

            if (totalCount > 1) {
                statusMessage = await bot.sendMessage(chatId,
                    `📸 Обрабатываю фото ${currentIndex}/${totalCount}...`
                );
            } else {
                statusMessage = await bot.sendMessage(chatId,
                    `📸 Получено фото ${photoNum}...`
                );
            }
        } else if (totalCount > 1) {
            // Пачка фото без сессии
            statusMessage = await bot.sendMessage(chatId,
                `📸 Обрабатываю фото ${currentIndex}/${totalCount}...`
            );
        } else {
            // Одиночное фото без сессии
            await bot.sendMessage(chatId, '📥 Получено фото, начинаю анализ...');
        }

        const photo = msg.photo[msg.photo.length - 1];
        const file = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${ctx.config.TELEGRAM_TOKEN}/${file.file_path}`;

        
        // Если сессия - добавляем фото
        if (hasSession && ctx.sessionManager) {
            ctx.sessionManager.addPhotoToSession(userId, {
                fileId: photo.file_id,
                chatId: chatId,
                fileUrl: fileUrl,
                localPath: tempImagePath,
                batchIndex: currentIndex,
                batchTotal: totalCount
            });
        }

// 🔍 АНАЛИЗ ROBOFLOW
// Сохраняем оригинальное фото во временный файл
tempImagePath = ctx.tempFileManager.createTempFile('original', 'jpg');
const response = await axios({
    method: 'GET',
    url: fileUrl,
    responseType: 'stream'
});

await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(tempImagePath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
});

// 🔥 ПРОВЕРЯЕМ, НУЖНО ЛИ ПОВЕРНУТЬ
const isHorizontal = await isHorizontalImage(tempImagePath);
let finalImagePath = tempImagePath;

if (isHorizontal) {
    const rotatedPath = ctx.tempFileManager.createTempFile('rotated', 'jpg');
    await rotateImageToVertical(tempImagePath, rotatedPath);
    finalImagePath = rotatedPath;
    console.log(`🖼️ Изображение повёрнуто в вертикальную ориентацию`);
}

// 🔥 ОБЪЯВЛЯЕМ ПЕРЕМЕННУЮ ЗДЕСЬ
let predictions = [];

// Отправляем файл в Roboflow
const FormData = require('form-data');
const form = new FormData();
form.append('file', fs.createReadStream(finalImagePath), {
    filename: 'image.jpg',
    contentType: 'image/jpeg'
});

console.log(`📤 Отправка файла: ${finalImagePath}, размер: ${(fs.statSync(finalImagePath).size / 1024).toFixed(1)} KB`);

try {
    const roboflowResponse = await axios({
        method: "POST",
        url: ctx.config.ROBOFLOW.API_URL,
        params: {
            api_key: ctx.config.ROBOFLOW.API_KEY,
            confidence: ctx.config.ROBOFLOW.CONFIDENCE,
            overlap: ctx.config.ROBOFLOW.OVERLAP,
            format: 'json'
        },
        data: form,
        headers: form.getHeaders(),
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
    });

    predictions = roboflowResponse.data.predictions || [];
    console.log(`📊 Roboflow: ${predictions.length} объектов`);

} catch (error) {
    console.log(`❌ Ошибка Roboflow: ${error.message}`);
    if (error.response) {
        console.log(`   Статус: ${error.response.status}`);
        console.log(`   Данные:`, error.response.data);
    }
    throw error;
}

// 🔥 ДАЛЬШЕ ИСПОЛЬЗУЕМ predictions
if (predictions.length > 0) {
    const classCount = {};
    predictions.forEach(pred => {
        const className = pred.class || 'unknown';
        classCount[className] = (classCount[className] || 0) + 1;
    });
    console.log(`📊 Roboflow: ${predictions.length} объектов. Распределение: ${JSON.stringify(classCount)}`);
} else {
    console.log('📭 Roboflow: объектов не обнаружено');
}

          

        const processedPredictions = smartPostProcessing(predictions);
        const analysis = analyzePredictions(processedPredictions);

        // 🔍 ПРАКТИЧЕСКИЙ АНАЛИЗ
        let predictionsForAnalysis = processedPredictions;
        let practicalAnalysis = null;
        let animalFilterResult = null;

        try {
            animalFilterResult = ctx.animalFilter.filterAnimalPaws(processedPredictions);
            const filteredPredictions = animalFilterResult.filtered;
            practicalAnalysis = ctx.practicalAnalyzer.analyzeForPSO(filteredPredictions);
            predictionsForAnalysis = filteredPredictions;
        } catch (psoError) {
            console.log('⚠️ Практический анализ пропущен:', psoError.message);
        }

        // 🧠 ИНТЕЛЛЕКТУАЛЬНЫЙ АНАЛИЗ
        let intelligentAnalysis = null;
        try {
            if (ctx.analysisModule && ctx.analysisModule.performComprehensiveAnalysis) {
                intelligentAnalysis = await ctx.analysisModule.performComprehensiveAnalysis(
                    tempImagePath,
                    predictionsForAnalysis,
                    {
                        userId: userId,
                        username: msg.from.username || msg.from.first_name
                    }
                );
            }
        } catch (analysisError) {
            console.log('⚠️ Интеллектуальный анализ пропущен:', analysisError.message);
        }

        // 🔥 ИСПРАВЛЕНИЕ: СЧИТАЕМ avgConfidence ЗДЕСЬ, перед использованием
        const avgConfidence = predictionsForAnalysis && predictionsForAnalysis.length > 0
            ? predictionsForAnalysis.reduce((sum, p) => sum + (p.confidence || 0), 0) / predictionsForAnalysis.length
            : 0.5;

        // 🎨 ВИЗУАЛИЗАЦИЯ
        let vizPath = null;
        let topologyVizPath = null;

        if (analysis.total > 0) {
            try {
                const vizModule = ctx.visualization ? ctx.visualization.getVisualization(userId, 'analysis') : null;
                vizPath = ctx.tempFileManager.createTempFile('analysis', 'png');

                if (vizModule) {
                    await vizModule.createVisualization(
                        fileUrl,
                        predictionsForAnalysis,
                        { username: msg.from.username || msg.from.first_name },
                        vizPath
                    );
                }

                // Топологическая визуализация только если есть протекторы
                const protectors = predictionsForAnalysis.filter(p => p.class === 'shoe-protector');
                if (protectors.length > 3 && ctx.topologyVisualizer) {
                    topologyVizPath = ctx.tempFileManager.createTempFile('topology_science', 'png');
                    await ctx.topologyVisualizer.createTopologyVisualization(
                        fileUrl,
                        predictionsForAnalysis,
                        topologyVizPath
                    );
                }

            } catch (vizError) {
                console.log('⚠️ Визуализация пропущена:', vizError.message);
            }
        }

        // =============================================================================
        // 🎯 ПЕРВЫЙ ПРИОРИТЕТ: НОВАЯ СИСТЕМА С ТОПОЛОГИЧЕСКИМ СЛИЯНИЕМ
        // =============================================================================
        let usedSimpleFootprint = false;

if (ctx.footprintManager && predictionsForAnalysis && predictionsForAnalysis.length > 0) {
    try {
        console.log('👣 ВЫЗЫВАЮ SimpleFootprintManager.addPhotoToSession...');

        const shoeProtectors = predictionsForAnalysis.filter(p =>
            p.class === 'shoe-protector' ||
            (p.confidence || 0) > 0.3
        );

        if (shoeProtectors.length < 3) {
            console.log(`⚠️ Слишком мало протекторов: ${shoeProtectors.length}, нужны минимум 3`);
            // Пропускаем, но продолжаем обычную обработку
        } else {
            console.log(`👣 Достаточно протекторов: ${shoeProtectors.length}`);

            // Проверяем, есть ли активная сессия
           // let session = ctx.footprintManager.getActiveSession(userId); было
          let session = ctx.footprintManager.sessionManager.getActiveSession(userId);
if (!session) {
    console.log('🔄 Создаю новую сессию...');
    session = ctx.footprintManager.sessionManager.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
    console.log(`✅ Создана сессия: ${session.id}`);
}

            // ВСЕГДА вызываем addPhotoToSession
            const result = await ctx.footprintManager.addPhotoToSession(
                userId,
                { predictions: shoeProtectors },
                {
                    photoId: photo.file_id,
                    chatId: chatId,
                    localPath: tempImagePath,
                    photoQuality: avgConfidence,
                    timestamp: new Date(),
                    username: msg.from.username || msg.from.first_name,
                    predictionsCount: processedPredictions.length,
                    protectorsCount: shoeProtectors.length
                },
                bot,
                chatId
            );

            console.log('📊 Результат addPhotoToSession:', {
                success: result.success,
                nodesAdded: result.nodesAdded,
                hasMergeVisualization: !!result.mergeVisualization,
                mergeMethod: result.mergeMethod,
                similarity: result.similarity, // ✅ Теперь должно быть
                decision: result.decision      // ✅ Теперь должно быть
            });

            // 🔥 ГАРАНТИРОВАТЬ similarity для дальнейшей обработки
            const similarity = result.similarity || 0;
            const decision = result.decision || 'unknown';

            console.log(`🎯 Результат обработки: similarity=${similarity}, decision=${decision}`);

            usedSimpleFootprint = true;

            // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: stats ОБЪЯВЛЕНА ЗДЕСЬ, перед любым использованием
            let stats = { confirmedNodes: 0, totalNodes: 0, averageConfirmations: 0 };

            // 🔥 ИСПРАВЛЕНИЕ: После объединения следов показываем правильную статистику
            if (result.success && similarity > 0.7) {
                console.log(`🎯 Следы совпали (${similarity}), обновляю статистику подтверждений...`);

                // Получаем актуальную сессию (может обновиться после addPhotoToSession)
                const currentSession = ctx.footprintManager.getActiveSession(userId);

                if (currentSession && currentSession.currentFootprint) {
                    try {
                        const newStats = currentSession.currentFootprint.getConfirmationStats ?
                            currentSession.currentFootprint.getConfirmationStats() :
                            { confirmedNodes: 0, totalNodes: 0, averageConfirmations: 0 };

                        stats = newStats;
                        console.log(`📊 Получена статистика: ${stats.totalNodes} узлов, ${stats.confirmedNodes} подтвержденных`);
                    } catch (statsError) {
                        console.log('⚠️ Ошибка получения статистики:', statsError.message);
                    }
                }

                // Если есть визуализация объединения, добавить в caption
                let visualizationPath = null;

                // Проверяем разные форматы mergeVisualization
                if (result.mergeVisualization) {
                    if (typeof result.mergeVisualization === 'string') {
                        visualizationPath = result.mergeVisualization;
                    } else if (result.mergeVisualization.path) {
                        visualizationPath = result.mergeVisualization.path;
                    } else if (result.mergeVisualization.mergeVisualization) {
                        visualizationPath = result.mergeVisualization.mergeVisualization;
                    }
                }

                if (visualizationPath && fs.existsSync(visualizationPath)) {
                    console.log(`📤 Найдена визуализация по пути: ${visualizationPath}`);
                    setTimeout(async () => {
                        try {
                            const caption = `🎭 **ВИЗУАЛИЗАЦИЯ СУПЕР-МОДЕЛИ С ПОДТВЕРЖДЕНИЯМИ**\n\n` +
                                          `📊 Всего узлов: ${stats.totalNodes || 0}\n` +
                                          `✅ Подтвержденных узлов: ${stats.confirmedNodes || 0}\n` +
                                          `📈 Среднее подтверждений: ${stats.averageConfirmations?.toFixed(1) || '0.0'}\n\n` +
                                          `🎨 **ЦВЕТА УЗЛОВ:**\n` +
                                          `⚫ Чёрный - 1 подтверждение\n` +
                                          `🟠 Оранжевый - 2 подтверждения\n` +
                                          `🟡 Жёлтый - 3 подтверждения\n` +
                                          `🔴 Красный - 4+ подтверждений\n\n` +
                                          `⭕ **Круги:** узлы из последнего следа\n` +
                                          `🔢 **Цифры:** количество подтверждений\n\n` +
                                          `💪 **Чем больше красных точек - тем надёжнее модель!**`;

                            console.log(`📤 Отправляю визуализацию: ${visualizationPath}`);
                            await bot.sendPhoto(chatId, visualizationPath, { caption });

                            // 🔥 ДОПОЛНИТЕЛЬНОЕ СООБЩЕНИЕ С ДЕТАЛЬНОЙ СТАТИСТИКОЙ
                            setTimeout(async () => {
                                let statsMessage = `✅ **СЛЕДЫ УСПЕШНО ОБЪЕДИНЕНЫ!**\n\n`;
                                statsMessage += `📊 **СТАТИСТИКА ПОДТВЕРЖДЕНИЙ:**\n`;
                                statsMessage += `• Всего узлов: ${stats.totalNodes || 0}\n`;
                                statsMessage += `• Подтвержденных узлов: ${stats.confirmedNodes || 0}\n`;
                                statsMessage += `• Среднее подтверждений: ${stats.averageConfirmations?.toFixed(1) || '0.0'}\n`;

                                // Добавляем статистику из трекера если есть
                                if (stats.trackerStats) {
                                    statsMessage += `\n🎯 **POINT TRACKER:**\n`;
                                    statsMessage += `• Точек в трекере: ${stats.trackerStats.totalPoints || 0}\n`;
                                    statsMessage += `• Высоконадёжных: ${stats.trackerStats.highConfidencePoints || 0}\n`;
                                    statsMessage += `• Средний рейтинг: ${stats.trackerStats.avgRating?.toFixed(3) || '0.000'}\n`;
                                }

                                statsMessage += `\n💡 **Точки теперь окрашены по количеству подтверждений!**`;

                                await bot.sendMessage(chatId, statsMessage);

                            }, 1000);

                        } catch (sendError) {
                            console.log('❌ Ошибка отправки визуализации:', sendError.message);
                            await bot.sendMessage(chatId,
                                `✅ **СЛЕДЫ СОВПАЛИ!**\n\n` +
                                `🎯 Схожесть: ${(similarity * 100).toFixed(1)}%\n` +
                                `📊 Всего узлов: ${stats.totalNodes || 0}\n` +
                                `🔄 Отпечатки объединены в супер-модель`
                            );
                        }
                    }, 1000);
                } else {
                    console.log('⚠️ Нет визуализации для отправки');
                    await bot.sendMessage(chatId,
                        `✅ **СЛЕДЫ СОВПАЛИ!**\n\n` +
                        `🎯 Схожесть: ${(similarity * 100).toFixed(1)}%\n` +
                        `📊 Всего узлов: ${stats.totalNodes || 0}\n` +
                        `🔄 Отпечатки объединены в супер-модель`
                    );
                }
            }

            // 🔥 Теперь stats всегда определена, даже если if блок не сработал
            ctx.saveUserLastAnalysis(userId, {
                predictions: predictionsForAnalysis,
                practicalAnalysis: practicalAnalysis,
                intelligentAnalysis: intelligentAnalysis,
                analysis: analysis,
                timestamp: new Date(),
                confidence: avgConfidence,
                visualizationPaths: { analysis: vizPath, topology: topologyVizPath },
                localPhotoPath: tempImagePath,
                hasSimpleFootprintData: true,
                sessionId: session.id,
                nodesCount: result.totalNodes || 0,
                hasMergeVisualization: !!result.mergeVisualization,
                mergeVisualizationPath: result.mergeVisualization,
                alignmentResult: result.alignment,
                // ✅ Теперь stats всегда определена
                confirmationStats: stats,
                trackerUpdate: result.trackerUpdate
            });

            console.log('✅ SimpleFootprintManager успешно обработал фото');
        }

    } catch (error) {
        console.log('❌ Ошибка SimpleFootprintManager:', error.message);
        console.error(error.stack);
        usedSimpleFootprint = false;
    }
}

        // =============================================================================
        // 🎨 ВАЖНОЕ ИСПРАВЛЕНИЕ: НЕ ВЫХОДИТЬ СРАЗУ ПРИ ОДИНОЧНОМ ФОТО
        // =============================================================================

        // Для одиночного фото (без сессии) - ВСЕГДА показываем обычную топологию
        if (!hasSession && totalCount === 1) {
            // Отправляем результаты анализа ОДИНОЧНОГО фото
            if (analysis.total === 0) {
                await bot.sendMessage(chatId, '❌ Не удалось обнаружить детали на фото');
                ctx.tempFileManager.removeFile(tempImagePath);
                return;
            }
         
            // Отправляем результаты
            let resultMessage = `✅ АНАЛИЗ ЗАВЕРШЕН\n\n`;
            resultMessage += `📊 Обнаружено: ${analysis.total} объектов\n\n`;
         
            // Классификация
            resultMessage += `📋 КЛАССИФИКАЦИЯ:\n`;
            Object.entries(analysis.classes).forEach(([className, count]) => {
                resultMessage += `• ${className}: ${count}\n`;
            });
         
            await bot.sendMessage(chatId, resultMessage);
         
            // Визуализация
            if (vizPath && fs.existsSync(vizPath)) {
                await bot.sendPhoto(chatId, vizPath, {
                    caption: '🎨 Визуализация анализа'
                });
                ctx.tempFileManager.removeFile(vizPath);
            }
         
            // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Всегда показывать топологию для одиночного фото
            if (topologyVizPath && fs.existsSync(topologyVizPath)) {
                await bot.sendPhoto(chatId, topologyVizPath, {
                    caption: '🕸️ Топологический анализ протектора\n' +
                             ' 🟢 Зеленые точки - центры протекторов\n' +
                             ' 🟠 Оранжевые линии - связи\n' +
                             ' 🔵 Синий пунктир - контур следа'
                });
                ctx.tempFileManager.removeFile(topologyVizPath);
            } else {
                // Если не создалась - создаем новую
                const protectors = predictionsForAnalysis.filter(p => p.class === 'shoe-protector');
                if (protectors.length > 3 && ctx.topologyVisualizer) {
                    const newTopologyPath = ctx.tempFileManager.createTempFile('topology_fallback', 'png');
                    await ctx.topologyVisualizer.createTopologyVisualization(
                        fileUrl,
                        predictionsForAnalysis,
                        newTopologyPath
                    );
                 
                    if (fs.existsSync(newTopologyPath)) {
                        await bot.sendPhoto(chatId, newTopologyPath, {
                            caption: '🕸️ Топологический анализ протектора\n' +
                                     ' 🟢 Зеленые точки - центры протекторов\n' +
                                     ' 🟠 Оранжевые линии - связи\n' +
                                     ' 🔵 Синий пунктир - контур следа'
                        });
                        ctx.tempFileManager.removeFile(newTopologyPath);
                    }
                }
            }
         
            // Практический анализ
            if (practicalAnalysis && practicalAnalysis.recommendations) {
                let practicalMessage = `🎯 **ПРАКТИЧЕСКИЙ АНАЛИЗ:**\n\n`;
                practicalAnalysis.recommendations.slice(0, 3).forEach(rec => {
                    practicalMessage += `• ${rec}\n`;
                });
                await bot.sendMessage(chatId, practicalMessage);
            }
         
            // Интеллектуальный анализ
            if (intelligentAnalysis && intelligentAnalysis.summary) {
                const intelMessage = `🧠 ИНТЕЛЛЕКТУАЛЬНЫЙ АНАЛИЗ:\n\n` +
                    `🧭 Ориентация: ${intelligentAnalysis.summary.orientation}\n` +
                    `👟 Тип обуви: ${intelligentAnalysis.summary.footprintType}\n` +
                    `🔷 Морфология: ${intelligentAnalysis.summary.morphology}\n` +
                    `🕸️ Топология: ${intelligentAnalysis.summary.topology}`;
             
                await bot.sendMessage(chatId, intelMessage);
            }
         
            // 🔥 ОБРАТНАЯ СВЯЗЬ
            if (!hasSession && totalCount === 1 && predictionsForAnalysis.length > 0) {
                const bestPrediction = predictionsForAnalysis.reduce((best, current) =>
                    (current.confidence || 0) > (best.confidence || 0) ? current : best
                );
             
                if (bestPrediction && bestPrediction.confidence > 0.6) {
                    if (Math.random() < 0.3) {
                        setTimeout(async () => {
                            const feedbackRequest = ctx.feedbackManager.requestFeedback(
                                userId,
                                chatId,
                                bestPrediction,
                                {
                                    imageId: tempImagePath,
                                    analysisType: 'single_photo',
                                    timestamp: new Date()
                                }
                            );
                         
                            await bot.sendMessage(chatId,
                                `💬 **ПОМОГИТЕ УЛУЧШИТЬ ТОЧНОСТЬ**\n\n` +
                                `Насколько правильно определен этот элемент?\n` +
                                `**Класс:** ${bestPrediction.class}\n` +
                                `**Уверенность:** ${(bestPrediction.confidence * 100).toFixed(1)}%`,
                                {
                                    reply_markup: ctx.feedbackManager.createFeedbackKeyboard()
                                }
                            );
                        }, 1000);
                    }
                }
            }
         
            // Если использовали SimpleFootprintManager, показываем дополнительную информацию
            if (usedSimpleFootprint) {
                await bot.sendMessage(chatId,
                    `👣 **След сохранен в цифровой отпечаток**\n\n` +
                    `💾 Данные добавлены в сессию графовой системы\n` +
                    `🎯 Для объединения с другими фото:\n` +
                    `• Отправьте еще фото того же следа\n` +
                    `• Система автоматически их объединит\n\n` +
                    `📋 Команды:\n` +
                    `/visualize_merge - показать объединение\n` +
                    `/my_footprints - мои модели`
                );
            }
         
            // Очистка
ctx.tempFileManager.removeFile(tempImagePath);
if (finalImagePath && finalImagePath !== tempImagePath) {
    ctx.tempFileManager.removeFile(finalImagePath);
}
if (topologyVizPath) ctx.tempFileManager.removeFile(topologyVizPath);
         
            return; // Выходим здесь после обработки одиночного фото
        }

        // 🆕 СЕССИОННЫЙ РЕЖИМ: КОРОТКОЕ ПОДТВЕРЖДЕНИЕ
        if (hasSession) {
            const session = ctx.sessionManager.getActiveSession(userId);

            // Добавляем анализ в сессию
            ctx.sessionManager.addAnalysisToSession(userId, {
                predictions: predictionsForAnalysis,
                practicalAnalysis: practicalAnalysis,
                intelligentAnalysis: intelligentAnalysis,
                analysis: analysis,
                timestamp: new Date(),
                visualizationPaths: {
                    analysis: vizPath,
                    topology: topologyVizPath
                },
                batchInfo: {
                    index: currentIndex,
                    total: totalCount
                }
            });

            // Обновляем сообщение на короткое подтверждение
            if (statusMessage) {
                if (totalCount > 1) {
                    await bot.editMessageText(
                        `✅ Фото ${currentIndex}/${totalCount} обработано\n` +
                        `📊 Сессия: ${session.photos.length} фото`,
                        {
                            chat_id: chatId,
                            message_id: statusMessage.message_id
                        }
                    );
                } else {
                    await bot.editMessageText(
                        `✅ Фото ${session.photos.length} принято\n` +
                        `📊 Сессия: ${session.photos.length} фото`,
                        {
                            chat_id: chatId,
                            message_id: statusMessage.message_id
                        }
                    );
                }
            }

        } else if (totalCount > 1) {
            // Пачка фото без сессии - просто подтверждение
            if (statusMessage) {
                await bot.editMessageText(
                    `✅ Фото ${currentIndex}/${totalCount} обработано`,
                    {
                        chat_id: chatId,
                        message_id: statusMessage.message_id
                    }
                );
            }

            // Очистка
            ctx.tempFileManager.removeFile(tempImagePath);
            if (vizPath) ctx.tempFileManager.removeFile(vizPath);
            if (topologyVizPath) ctx.tempFileManager.removeFile(topologyVizPath);

        } else {
            // 🆕 ОДИНОЧНОЕ ФОТО БЕЗ СЕССИИ: ПОЛНЫЙ АНАЛИЗ
            if (analysis.total === 0) {
                await bot.sendMessage(chatId, '❌ Не удалось обнаружить детали на фото');
                ctx.tempFileManager.removeFile(tempImagePath);
                return;
            }

            // Отправляем результаты
            let resultMessage = `✅ АНАЛИЗ ЗАВЕРШЕН\n\n`;
            resultMessage += `📊 Обнаружено: ${analysis.total} объектов\n\n`;

            // Классификация
            resultMessage += `📋 КЛАССИФИКАЦИЯ:\n`;
            Object.entries(analysis.classes).forEach(([className, count]) => {
                resultMessage += `• ${className}: ${count}\n`;
            });

            await bot.sendMessage(chatId, resultMessage);

            // Визуализация
            if (vizPath && fs.existsSync(vizPath)) {
                await bot.sendPhoto(chatId, vizPath, {
                    caption: '🎨 Визуализация анализа'
                });
                ctx.tempFileManager.removeFile(vizPath);
            }

            // 🔥 ВЕРНУЛИ ТОПОЛОГИЧЕСКУЮ ВИЗУАЛИЗАЦИЮ ДЛЯ ОДИНОЧНОГО ФОТО
            if (topologyVizPath && fs.existsSync(topologyVizPath)) {
                await bot.sendPhoto(chatId, topologyVizPath, {
                    caption: '🕸️ Топологический анализ протектора\n' +
                             ' 🟢 Зеленые точки - центры протекторов\n' +
                             ' 🟠 Оранжевые линии - связи\n' +
                             ' 🔵 Синий пунктир - контур следа'
                });
                ctx.tempFileManager.removeFile(topologyVizPath);
            }

            // Практический анализ
            if (practicalAnalysis && practicalAnalysis.recommendations) {
                let practicalMessage = `🎯 **ПРАКТИЧЕСКИЙ АНАЛИЗ:**\n\n`;
                practicalAnalysis.recommendations.slice(0, 3).forEach(rec => {
                    practicalMessage += `• ${rec}\n`;
                });
                await bot.sendMessage(chatId, practicalMessage);
            }

            // Интеллектуальный анализ
            if (intelligentAnalysis && intelligentAnalysis.summary) {
                const intelMessage = `🧠 ИНТЕЛЛЕКТУАЛЬНЫЙ АНАЛИЗ:\n\n` +
                    `🧭 Ориентация: ${intelligentAnalysis.summary.orientation}\n` +
                    `👟 Тип обуви: ${intelligentAnalysis.summary.footprintType}\n` +
                    `🔷 Морфология: ${intelligentAnalysis.summary.morphology}\n` +
                    `🕸️ Топология: ${intelligentAnalysis.summary.topology}`;

                await bot.sendMessage(chatId, intelMessage);
            }

            // 🔥 ДОБАВЛЯЕМ ЗАПРОС ОБРАТНОЙ СВЯЗИ
            if (!hasSession && totalCount === 1 && predictionsForAnalysis.length > 0) {
                // Выбираем самый уверенный prediction
                const bestPrediction = predictionsForAnalysis.reduce((best, current) =>
                    (current.confidence || 0) > (best.confidence || 0) ? current : best
                );

                if (bestPrediction && bestPrediction.confidence > 0.6) {
                    // Случайный шанс 30% чтобы не спамить
                    if (Math.random() < 0.3) {
                        setTimeout(async () => {
                            const feedbackRequest = ctx.feedbackManager.requestFeedback(
                                userId,
                                chatId,
                                bestPrediction,
                                {
                                    imageId: tempImagePath,
                                    analysisType: 'single_photo',
                                    timestamp: new Date()
                                }
                            );

                            await bot.sendMessage(chatId,
                                `💬 **ПОМОГИТЕ УЛУЧШИТЬ ТОЧНОСТЬ**\n\n` +
                                `Насколько правильно определен этот элемент?\n` +
                                `**Класс:** ${bestPrediction.class}\n` +
                                `**Уверенность:** ${(bestPrediction.confidence * 100).toFixed(1)}%`,
                                {
                                    reply_markup: ctx.feedbackManager.createFeedbackKeyboard()
                                }
                            );
                        }, 1000);
                    }
                }
            }

            // Очистка
            ctx.tempFileManager.removeFile(tempImagePath);
            if (topologyVizPath) ctx.tempFileManager.removeFile(topologyVizPath);
        }

        ctx.updateUserStats(userId, msg.from.username || msg.from.first_name, 'analysis');

    } catch (error) {
        console.log('❌ Ошибка анализа фото:', error.message);
        await bot.sendMessage(chatId, `❌ Ошибка при обработке фото ${currentIndex || ''}`);
    }
}

};
