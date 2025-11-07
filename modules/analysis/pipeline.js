// modules/analysis/pipeline.js
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

// Импортируем функции анализа из старого кода (временно)
const { smartPostProcessing } = require('./imageProcessor');
const { extractFeatures } = require('./featureExtractor');
const { analyzePerspectiveDistortion, calculateOrientationAngle, analyzeOrientationType } = require('./perspectiveAnalyzer');

async function analyzePhotoPipeline(msg, bot, sessionManager, dataPersistence) {
    const chatId = msg.chat.id;
    const session = sessionManager.getSession(chatId);

    try {
        // Проверка сохранения эталона
        if (session.waitingForReference) {
            await handleReferencePhoto(msg, bot, sessionManager, session);
            return;
        }

        // Проверка сравнения с эталоном
        if (session.waitingForComparison) {
            await handleComparisonPhoto(msg, bot, sessionManager, session);
            return;
        }

        // Обычная обработка фото
        await handleRegularPhoto(msg, bot, sessionManager, dataPersistence);

    } catch (error) {
        console.error('❌ Ошибка в пайплайне анализа фото:', error);
        await bot.sendMessage(chatId, '❌ Ошибка при обработке фото. Попробуйте еще раз.');
    }
}

async function handleReferencePhoto(msg, bot, sessionManager, session) {
    const chatId = msg.chat.id;
    const modelName = session.waitingForReference;

    await bot.sendMessage(chatId, '📥 Получено фото эталона, анализирую...');

    const { fileUrl, predictions } = await processPhoto(msg, bot);
    const processedPredictions = smartPostProcessing(predictions);

    // Сохраняем эталон
    sessionManager.referencePrints.set(modelName, {
        features: extractFeatures(processedPredictions),
        imageUrl: fileUrl,
        timestamp: new Date(),
        predictions: processedPredictions
    });

    session.waitingForReference = null;

    await bot.sendMessage(chatId,
        `✅ Эталон сохранен: "${modelName}"\n` +
        `📊 Детали: ${processedPredictions.length} элементов\n\n` +
        'Используйте `/list_references` для просмотра'
    );
}

async function handleComparisonPhoto(msg, bot, sessionManager, session) {
    const chatId = msg.chat.id;
    const comparisonData = session.waitingForComparison;
    const modelName = comparisonData.modelName;
    const reference = comparisonData.reference;

    console.log(`🔍 Начинаем сравнение с эталоном "${modelName}"`);

    const { fileUrl, predictions } = await processPhoto(msg, bot);
    const processedPredictions = smartPostProcessing(predictions);
    const footprintPredictions = processedPredictions.length > 0 ? processedPredictions : predictions;

    const footprintFeatures = extractFeatures(footprintPredictions);
    console.log('✅ Features следа:', footprintFeatures);

    const referenceFeatures = reference.features || { detailCount: 0 };
    console.log('✅ Features эталона:', referenceFeatures);

    // Сравниваем следы
    const comparisonResult = compareWithMirror(referenceFeatures, footprintFeatures, footprintPredictions);

    // Формируем отчет
    let report = `🔍 **СРАВНЕНИЕ С "${modelName}"**\n\n`;
    report += `🎯 **Вероятность совпадения: ${Math.round(comparisonResult.overallScore)}%**\n\n`;

    if (comparisonResult.orientationAdjusted) {
        report += `📐 **Учет ориентации:** угол ${Math.abs(comparisonResult.orientationAngle).toFixed(1)}°\n`;
    }
    if (comparisonResult.mirrorUsed) {
        report += `🔄 **Учтена симметрия** (левый/правый ботинок)\n`;
    }

    report += `\n📈 **Детальный анализ:**\n`;
    report += `• 🎨 Узор: ${Math.round(comparisonResult.patternSimilarity)}%\n`;
    report += `• 📐 Расположение: ${Math.round(comparisonResult.spatialDistribution)}%\n`;
    report += `• 🔍 Детали: ${Math.round(comparisonResult.detailMatching)}%\n`;
    report += `• ⭐ Формы: ${Math.round(comparisonResult.shapeConsistency)}%\n\n`;

    // Интерпретация результата
    if (comparisonResult.overallScore > 70) {
        report += `✅ **ВЫСОКАЯ ВЕРОЯТНОСТЬ** - след соответствует модели`;
    } else if (comparisonResult.overallScore > 50) {
        report += `🟡 **СРЕДНЯЯ ВЕРОЯТНОСТЬ** - возможное соответствие`;
    } else if (comparisonResult.overallScore > 30) {
        report += `🟠 **НИЗКАЯ ВЕРОЯТНОСТЬ** - слабое соответствие`;
    } else {
        report += `❌ **ВЕРОЯТНО НЕСООТВЕТСТВИЕ** - разные модели`;
    }

    report += `\n\n---\n`;
    report += `🔍 **ИНФОРМАЦИЯ О СИСТЕМЕ:**\n`;
    report += `• Модель: Анализатор следов обуви (Активна)\n`;
    report += `• Уверенность анализа: Высокая\n\n`;
    report += `💡 **Рекомендации:** Четкий след на контрастном фоне, Прямой угол съемки, Хорошее освещение`;

    await bot.sendMessage(chatId, report);
    console.log('✅ Сравнение завершено успешно');

    session.waitingForComparison = null;
    sessionManager.updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'comparison');
}

async function handleRegularPhoto(msg, bot, sessionManager, dataPersistence) {
    const chatId = msg.chat.id;

    sessionManager.updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'photo');
    await bot.sendMessage(chatId, '📥 Получено фото, начинаю анализ...');

    const { fileUrl, predictions } = await processPhoto(msg, bot);
    await bot.sendMessage(chatId, '🔍 Анализирую через Roboflow...');

    const processedPredictions = smartPostProcessing(predictions);
    const finalPredictions = processedPredictions.length > 0 ? processedPredictions : predictions;

    // Анализ перспективы
    let perspectiveAnalysis = { hasPerspectiveIssues: false, issues: [], recommendations: [] };
    try {
        const image = await loadImage(fileUrl);
        perspectiveAnalysis = analyzePerspectiveDistortion(
            finalPredictions,
            image.width,
            image.height
        );
    } catch (error) {
        console.log('⚠️ Не удалось проанализировать перспективу:', error.message);
    }

    // Классификация узора протектора
    let imageWidth = 800, imageHeight = 600;
    let patternType = 'unknown_pattern';
    try {
        const image = await loadImage(fileUrl);
        imageWidth = image.width;
        imageHeight = image.height;
       
        const { FootprintAssembler } = require('../footprint_assembler');
        const footprintAssembler = new FootprintAssembler();
        patternType = footprintAssembler.classifyFootprintPattern(
            finalPredictions,
            imageWidth,
            imageHeight
        );
        console.log(`🎯 Классификация узора протектора: ${patternType}`);
    } catch (error) {
        console.log('❌ Ошибка классификации узора:', error.message);
    }

    // Извлекаем фичи
    let footprintFeatures = extractFeatures(finalPredictions);
    footprintFeatures.patternType = patternType;
    console.log('✅ Footprint features с узором:', footprintFeatures);

    // Добавляем в экспертную сессию если активна
    const trailSession = sessionManager.trailSessions.get(chatId);
    if (trailSession && trailSession.status === 'active') {
        console.log(`🕵️‍♂️ [DEBUG] Активная сессия найдена! Добавляем отпечаток...`);
      
        const footprintData = {
            imageUrl: fileUrl,
            predictions: finalPredictions,
            features: footprintFeatures,
            perspectiveAnalysis: perspectiveAnalysis,
            orientation: {
                type: analyzeOrientationType(finalPredictions),
                angle: calculateOrientationAngle(
                    finalPredictions.find(pred =>
                        pred.class === 'Outline-trail' || pred.class.includes('Outline')
                    )?.points || []
                )
            },
            patternType: patternType,
            assemblyPotential: 0
        };

        try {
            const footprintRecord = trailSession.addFootprint(footprintData);
          
            // Обновляем потенциал сборки
            if (trailSession.calculateAssemblyPotential) {
                footprintRecord.assemblyPotential = trailSession.calculateAssemblyPotential(footprintRecord);
            }
          
            console.log(`✅ [DEBUG] Отпечаток успешно добавлен в сессию! Всего: ${trailSession.footprints.length}`);
          
        } catch (error) {
            console.error('❌ Ошибка добавления отпечатка в сессию:', error);
        }
    }

    // Создаем визуализацию
    await createAndSendVisualization(chatId, fileUrl, finalPredictions, msg.from, bot);

    // Отправляем отчет анализа
    await sendAnalysisReport(chatId, finalPredictions, perspectiveAnalysis, patternType, bot);
}

async function processPhoto(msg, bot) {
    const photo = msg.photo[msg.photo.length - 1];
    const file = await bot.getFile(photo.file_id);
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8474413305:AAGUROU5GSKKTso_YtlwsguHzibBcpojLVI';
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;

    // Анализ через Roboflow
    const response = await axios({
        method: "POST",
        url: 'https://detect.roboflow.com/-zqyih/13',
        params: {
            api_key: 'NeHOB854EyHkDbGGLE6G',
            image: fileUrl,
            confidence: 25,
            overlap: 30,
            format: 'json'
        },
        timeout: 30000
    });

    const predictions = response.data.predictions || [];
    return { fileUrl, predictions };
}

async function createAndSendVisualization(chatId, fileUrl, predictions, userData, bot) {
    try {
        const image = await loadImage(fileUrl);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');

        // Рисуем оригинальное фото
        ctx.drawImage(image, 0, 0);

        // Цвета для разных классов
        const colors = {
            'Outline-trail': 'rgba(148, 0, 211, 0.8)',
            'shoe-protector': 'rgba(64, 224, 208, 0.7)',
            'Heel': 'rgba(0, 0, 255, 0.6)',
            'Toe': 'rgba(30, 144, 255, 0.6)'
        };

        // Рисуем полигоны БЕЗ ПОДПИСЕЙ
        predictions.forEach(pred => {
            if (pred.points && pred.points.length > 2) {
                const color = colors[pred.class] || 'rgba(255, 255, 255, 0.7)';
              
                ctx.strokeStyle = color;
                ctx.lineWidth = pred.class === 'Outline-trail' ? 4 : 2;
                ctx.beginPath();
              
                ctx.moveTo(pred.points[0].x, pred.points[0].y);
                for (let i = 1; i < pred.points.length; i++) {
                    ctx.lineTo(pred.points[i].x, pred.points[i].y);
                }
                ctx.closePath();
                ctx.stroke();
            }
        });

        // Водяной знак
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(10, image.height - 80, 300, 70);
      
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`👤 ${userData.username || 'Пользователь'}`, 20, image.height - 55);
        ctx.fillText(`📅 ${new Date().toLocaleString('ru-RU')}`, 20, image.height - 35);
        ctx.fillText(`🔍 Анализатор следов обуви`, 20, image.height - 15);

        const vizPath = `viz_${Date.now()}.jpg`;
        const buffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });
        fs.writeFileSync(vizPath, buffer);

        await bot.sendPhoto(chatId, vizPath, {
            caption: `📊 **РЕЗУЛЬТАТЫ АНАЛИЗА**\n\n` +
                    `• Обнаружено объектов: ${predictions.length}\n` +
                    `• Качество анализа: ${predictions.length > 5 ? '✅ Хорошее' : '⚠️ Требует проверки'}\n\n` +
                    `💡 *Разные цвета показывают разные типы элементов следа*`
        });

        // Удаляем временный файл
        fs.unlinkSync(vizPath);

    } catch (error) {
        console.log('❌ Ошибка визуализации:', error.message);
    }
}

async function sendAnalysisReport(chatId, predictions, perspectiveAnalysis, patternType, bot) {
    let report = `🔬 **ОТЧЕТ АНАЛИЗА**\n\n`;
    report += `📊 **Обнаружено элементов:** ${predictions.length}\n`;
    report += `🎯 **Тип протектора:** ${patternType}\n\n`;

    if (perspectiveAnalysis.hasPerspectiveIssues) {
        report += `⚠️ **ПРОБЛЕМЫ СЪЕМКИ:**\n`;
        perspectiveAnalysis.issues.forEach(issue => {
            report += `• ${issue}\n`;
        });
        report += `\n💡 **Рекомендации:**\n`;
        perspectiveAnalysis.recommendations.forEach(rec => {
            report += `• ${rec}\n`;
        });
    } else {
        report += `✅ **Качество съемки:** Хорошее\n`;
        report += `📐 **Угол съемки:** Оптимальный\n\n`;
    }

    report += `🎯 **Дальнейшие действия:**\n`;
    report += `• Для анализа тропы: /trail_start\n`;
    report += `• Для сравнения: /compare\n`;
    report += `• Для сохранения эталона: /save_reference`;

    await bot.sendMessage(chatId, report);
}

// Временные функции из старого кода (будут вынесены в отдельные модули)
function compareWithMirror(referenceFeatures, footprintFeatures, footprintPredictions = []) {
    // Упрощенная версия сравнения
    const normalScore = compareFootprints(referenceFeatures, footprintFeatures);
  
    let orientationAdjustedScore = normalScore.overallScore;
  
    try {
        const orientationType = analyzeOrientationType(footprintPredictions);
        const orientationAngle = calculateOrientationAngle(
            footprintPredictions.find(pred =>
                pred.class === 'Outline-trail' || pred.class.includes('Outline')
            )?.points || []
        );
      
        if (Math.abs(orientationAngle) > 15) {
            const rotationPenalty = Math.min(Math.abs(orientationAngle) * 0.5, 25);
            orientationAdjustedScore = Math.max(0, normalScore.overallScore - rotationPenalty);
        }
    } catch (error) {
        console.log('⚠️ Не удалось учесть ориентацию при сравнении:', error.message);
    }
  
    const bestScore = Math.max(orientationAdjustedScore, normalScore.overallScore);
  
    return {
        ...normalScore,
        overallScore: bestScore,
        mirrorUsed: bestScore !== orientationAdjustedScore,
        orientationAdjusted: orientationAdjustedScore !== normalScore.overallScore
    };
}

function compareFootprints(referenceFeatures, footprintFeatures) {
    // Упрощенная версия сравнения
    const refDetails = Math.max(referenceFeatures.detailCount || 0, 1);
    const footprintDetails = Math.max(footprintFeatures.detailCount || 0, 1);

    const scores = {
        patternSimilarity: 0,
        spatialDistribution: 0,
        detailMatching: 0,
        shapeConsistency: 0,
        overallScore: 0
    };

    const countRatio = Math.min(refDetails, footprintDetails) / Math.max(refDetails, footprintDetails);
    scores.patternSimilarity = Math.round(countRatio * 25);
  
    if (refDetails > 10 && footprintDetails > 10) {
        scores.patternSimilarity += 15;
    }
    scores.patternSimilarity = Math.min(scores.patternSimilarity, 40);

    const refDensity = referenceFeatures.density || 1;
    const footprintDensity = footprintFeatures.density || 1;
    const densitySimilarity = 1 - Math.abs(refDensity - footprintDensity) / Math.max(refDensity, footprintDensity);
    scores.spatialDistribution = Math.round(densitySimilarity * 30);

    const commonDetails = Math.min(refDetails, footprintDetails);
    const maxDetails = Math.max(refDetails, footprintDetails);
    scores.detailMatching = Math.round((commonDetails / maxDetails) * 20);

    scores.shapeConsistency = 8;
    if (referenceFeatures.hasOutline && footprintFeatures.hasOutline) {
        scores.shapeConsistency += 2;
    }

    scores.overallScore = Math.min(
        scores.patternSimilarity + scores.spatialDistribution + scores.detailMatching + scores.shapeConsistency,
        100
    );

    return scores;
}

module.exports = { analyzePhotoPipeline };
