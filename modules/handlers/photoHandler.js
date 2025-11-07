const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const Helpers = require('../utils/helpers');

const { getWorkingSessionManager } = require('../sessions/sessionManager');
// или если не работает:
// const { getWorkingSessionManager } = require('../../bot'); // зависит от структуры


class PhotoHandler {
    constructor(bot, sessionManager, footprintAssembler, yandexDisk) {
        this.bot = bot;
        this.sessionManager = sessionManager;
        this.footprintAssembler = footprintAssembler;
        this.yandexDisk = yandexDisk;
        this.TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    }

    async handlePhoto(msg) {
        const chatId = msg.chat.id;

        try {
            const session = this.sessionManager.getSession(chatId);

            // Проверка сохранения эталона
            if (session.waitingForReference) {
                await this.handleReferencePhoto(msg, session);
                return;
            }

            // Проверка сравнения с эталоном
            if (session.waitingForComparison) {
                await this.handleComparisonPhoto(msg, session);
                return;
            }

            // Обычная обработка фото
            await this.handleRegularPhoto(msg, session);

        } catch (error) {
            console.error('❌ Ошибка обработки фото:', error);
            await this.bot.sendMessage(chatId, '❌ Ошибка при анализе фото. Попробуйте еще раз.');
        }
    }

    async handleRegularPhoto(msg, session) {
        const chatId = msg.chat.id;

        // Обновление статистики
        await this.updatePhotoStats(msg);

        await this.bot.sendMessage(chatId, '📥 Получено фото, начинаю анализ...');

        const { fileUrl, predictions, processedPredictions, finalPredictions } = await this.analyzeWithRoboflow(msg);

        // Анализ перспективы и классификация
        const perspectiveAnalysis = await this.analyzePerspective(fileUrl, finalPredictions);
        const { patternType, footprintFeatures } = await this.classifyFootprint(fileUrl, finalPredictions);

        // Добавление в экспертные сессии
        await this.addToTrailSession(chatId, fileUrl, finalPredictions, footprintFeatures, perspectiveAnalysis, patternType);

        // Загрузка на Яндекс.Диск
        await this.uploadToYandexDisk(msg, fileUrl);

        // Визуализация и отправка результатов
        await this.sendVisualizationResults(chatId, fileUrl, finalPredictions, msg.from, perspectiveAnalysis, patternType);
    }

    async handleReferencePhoto(msg, session) {
        const modelName = session.waitingForReference;
        const chatId = msg.chat.id;

        await this.bot.sendMessage(chatId, '📥 Получено фото эталона, анализирую...');

        const { fileUrl, processedPredictions } = await this.analyzeWithRoboflow(msg);

        this.sessionManager.referencePrints.set(modelName, {
            features: { detailCount: processedPredictions.length, totalArea: 0 },
            imageUrl: fileUrl,
            timestamp: new Date(),
            predictions: processedPredictions
        });

        session.waitingForReference = null;

        await this.bot.sendMessage(chatId,
            `✅ Эталон сохранен: "${modelName}"\n` +
            `📊 Детали: ${processedPredictions.length} элементов\n\n` +
            'Используйте `/list_references` для просмотра'
        );
    }

    async handleComparisonPhoto(msg, session) {
        const comparisonData = session.waitingForComparison;
        const modelName = comparisonData.modelName;
        const reference = comparisonData.reference;
        const chatId = msg.chat.id;

        console.log(`🔍 Начинаем сравнение с эталоном "${modelName}"`);

        try {
            const { processedPredictions, finalPredictions } = await this.analyzeWithRoboflow(msg);

            const referencePredictions = reference.predictions || [];
            const footprintPredictions = processedPredictions || finalPredictions || [];
            const footprintFeatures = this.extractFeatures(footprintPredictions);
            const referenceFeatures = reference.features || { detailCount: 0 };

            const comparisonResult = this.compareFootprints(referenceFeatures, footprintFeatures);

            const report = this.generateComparisonReport(modelName, comparisonResult);
            await this.bot.sendMessage(chatId, report);

            console.log('✅ Сравнение завершено успешно');

        } catch (error) {
            console.error('❌ Ошибка при сравнении:', error);
            await this.bot.sendMessage(chatId,
                '❌ Ошибка при сравнении следов. Попробуйте другое фото.\n\n' +
                '💡 **Советы:**\n' +
                '• Убедитесь в четкости фото\n' +
                '• Прямой угол съемки\n' +
                '• Хорошее освещение'
            );
        }

        session.waitingForComparison = null;
        this.sessionManager.updateUserStats(msg.from.id, msg.from.username || msg.from.first_name, 'comparison');
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    async updatePhotoStats(msg) {
        try {
            const userId = msg.from.id;
            const username = msg.from.username || msg.from.first_name;
            this.sessionManager.updateUserStats(userId, username, 'photo');
            console.log(`🛡️ Статистика фото обновлена для ${username}`);
        } catch (statsError) {
            console.log('⚠️ Ошибка обновления статистики фото:', statsError.message);
        }
    }

    async analyzeWithRoboflow(msg) {
        const photo = msg.photo[msg.photo.length - 1];
        const file = await this.bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${this.TELEGRAM_TOKEN}/${file.file_path}`;

        await this.bot.sendMessage(msg.chat.id, '🔍 Анализирую через Roboflow...');

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
        const processedPredictions = this.smartPostProcessing(predictions);
        const finalPredictions = processedPredictions.length > 0 ? processedPredictions : predictions;

        return { fileUrl, predictions, processedPredictions, finalPredictions };
    }

    smartPostProcessing(predictions) {
        if (!predictions || predictions.length === 0) return [];
       
        console.log(`🔧 Умная постобработка: ${predictions.length} объектов`);

        const filtered = predictions.filter(pred => {
            if (!pred.points || pred.points.length < 3) return false;
            const bbox = this.calculateBoundingBox(pred.points);
            const area = bbox.width * bbox.height;
            return area > 100;
        });

        const optimized = filtered.map(pred => {
            if (pred.points.length <= 6) return pred;
            const optimizedPoints = this.simplifyPolygon(pred.points, this.getEpsilonForClass(pred.class));
            return {
                ...pred,
                points: optimizedPoints
            };
        });

        console.log(`✅ После постобработки: ${optimized.length} объектов`);
        return optimized;
    }

    calculateBoundingBox(points) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }

/**
* Упрощает полигон (стабильная версия)
*/
simplifyPolygon(points, epsilon = 2.0) {
    try {
        if (!points || points.length <= 4) {
            return points;
        }

        console.log(`🔄 Упрощение полигона: ${points.length} точек -> ${points.length} точек (отключено)`);
       
        // 🔧 ВРЕМЕННОЕ РЕШЕНИЕ: возвращаем исходные точки
        // Упрощение временно отключено для стабильности
        return points;

    } catch (error) {
        console.log('❌ Ошибка упрощения полигона, возвращаем исходные точки:', error.message);
        return points;
    }
}

    getEpsilonForClass(className) {
        switch(className) {
            case 'shoe-protector': return 1.5;
            case 'Outline-trail': return 0.8;
            case 'Heel': return 1.0;
            case 'Toe': return 1.0;
            default: return 1.2;
        }
    }

    async analyzePerspective(fileUrl, predictions) {
        try {
            const image = await loadImage(fileUrl);
            return this.analyzePerspectiveDistortion(predictions, image.width, image.height);
        } catch (error) {
            console.log('⚠️ Не удалось проанализировать перспективу:', error.message);
            return { hasPerspectiveIssues: false, issues: [], recommendations: [], confidence: 'low' };
        }
    }

    analyzePerspectiveDistortion(predictions, imageWidth, imageHeight) {
        console.log('📐 Анализирую перспективные искажения...');
       
        const analysis = {
            hasPerspectiveIssues: false,
            confidence: 'high',
            issues: [],
            recommendations: []
        };

        try {
            if (!predictions || predictions.length === 0) {
                analysis.confidence = 'low';
                return analysis;
            }

            // ИЩЕМ КОНТУР ДЛЯ АНАЛИЗА
            const outline = predictions.find(pred =>
                pred.class === 'Outline-trail' || pred.class.includes('Outline')
            );

            if (!outline || !outline.points) {
                analysis.confidence = 'medium';
                analysis.issues.push('контур_не_найден');
                return analysis;
            }

            const points = outline.points;
           
            // 1. АНАЛИЗ СООТНОШЕНИЯ СТОРОН
            const bbox = this.calculateBoundingBox(points);
            const aspectRatio = bbox.width / bbox.height;
           
            if (aspectRatio < 0.3 || aspectRatio > 3.0) {
                analysis.hasPerspectiveIssues = true;
                analysis.issues.push('неестественное_соотношение_сторон');
                analysis.recommendations.push('снимать под прямым углом к следу');
            }

            // 2. АНАЛИЗ РАЗМЕРА ОТНОСИТЕЛЬНО КАДРА
            const frameRatio = (bbox.width * bbox.height) / (imageWidth * imageHeight);
            if (frameRatio < 0.1) {
                analysis.issues.push('след_слишком_мал');
                analysis.recommendations.push('приблизьте камеру к следу');
            } else if (frameRatio > 0.8) {
                analysis.issues.push('след_занимает_весь_кадр');
                analysis.recommendations.push('немного отдалите камеру');
            }

            console.log(`📐 Результат анализа перспективы:`, {
                issues: analysis.issues.length,
                hasProblems: analysis.hasPerspectiveIssues
            });

            return analysis;

        } catch (error) {
            console.log('❌ Ошибка анализа перспективы:', error.message);
            analysis.confidence = 'low';
            return analysis;
        }
    }

    async classifyFootprint(fileUrl, predictions) {
        let imageWidth = 800, imageHeight = 600;
        try {
            const image = await loadImage(fileUrl);
            imageWidth = image.width;
            imageHeight = image.height;
        } catch (error) {
            console.log('⚠️ Не удалось получить размеры для анализа узоров:', error.message);
        }

        let patternType = 'unknown_pattern';
        try {
            patternType = this.footprintAssembler.classifyFootprintPattern(predictions, imageWidth, imageHeight);
            console.log(`🎯 Классификация узора протектора: ${patternType}`);
        } catch (error) {
            console.log('❌ Ошибка классификации узора:', error.message);
        }

        let footprintFeatures = this.extractFeatures(predictions);
        footprintFeatures.patternType = patternType;

        return { patternType, footprintFeatures };
    }

    extractFeatures(predictions) {
        console.log(`📊 Извлекаем улучшенные features из ${predictions.length} предсказаний`);
       
        const features = {
            detailCount: predictions.length,
            hasOutline: false,
            largeDetails: 0,
            density: 1,  // гарантируем значение по умолчанию
            spatialSpread: 0
        };

        // ЗАЩИТА ОТ ПУСТЫХ ДАННЫХ
        if (!predictions || predictions.length === 0) {
            return features;
        }

        let totalArea = 0;
        const centers = [];

        predictions.forEach(pred => {
            if (pred.class && pred.class.includes('Outline')) {
                features.hasOutline = true;
            }

            // Считаем площадь и центры для анализа распределения
            if (pred.points && pred.points.length > 3) {
                const bbox = this.calculateBoundingBox(pred.points);
                const area = bbox.width * bbox.height;
                totalArea += area;
               
                if (area > 1000) {
                    features.largeDetails++;
                }

                // Сохраняем центры для анализа распределения
                centers.push({
                    x: bbox.minX + bbox.width / 2,
                    y: bbox.minY + bbox.height / 2
                });
            }
        });

        // Рассчитываем плотность деталей (защита от деления на ноль)
        if (centers.length > 0 && totalArea > 0) {
            features.density = centers.length / (totalArea / 1000); // деталей на 1000px²
        }

        console.log('📊 Улучшенные features:', features);
        return features;
    }

    compareFootprints(referenceFeatures, footprintFeatures) {
        console.log('🔍 УЛУЧШЕННОЕ СРАВНЕНИЕ: эталон vs след');
       
        // ЗАЩИТА ОТ NaN - гарантируем числовые значения
        const refDetails = Math.max(referenceFeatures.detailCount || 0, 1);
        const footprintDetails = Math.max(footprintFeatures.detailCount || 0, 1);

        const scores = {
            patternSimilarity: 0,    // Схожесть узора (40%)
            spatialDistribution: 0,  // Пространственное распределение (30%)
            detailMatching: 0,       // Совпадение деталей (20%)
            shapeConsistency: 0,     // Соответствие форм (10%)
            overallScore: 0
        };

        // 1. Схожесть узора (40%) - сравниваем распределение деталей
        const countRatio = Math.min(refDetails, footprintDetails) / Math.max(refDetails, footprintDetails);
        scores.patternSimilarity = Math.round(countRatio * 25);
       
        // Бонус за достаточное количество деталей
        if (refDetails > 10 && footprintDetails > 10) {
            scores.patternSimilarity += 15;
        }
        scores.patternSimilarity = Math.min(scores.patternSimilarity, 40);

        // 2. Пространственное распределение (30%)
        const refDensity = referenceFeatures.density || 1;
        const footprintDensity = footprintFeatures.density || 1;
        const densitySimilarity = 1 - Math.abs(refDensity - footprintDensity) / Math.max(refDensity, footprintDensity);
        scores.spatialDistribution = Math.round(densitySimilarity * 30);

        // 3. Совпадение деталей (20%)
        const commonDetails = Math.min(refDetails, footprintDetails);
        const maxDetails = Math.max(refDetails, footprintDetails);
        scores.detailMatching = Math.round((commonDetails / maxDetails) * 20);

        // 4. Соответствие форм (10%) - базовый score
        scores.shapeConsistency = 8;
        if (referenceFeatures.hasOutline && footprintFeatures.hasOutline) {
            scores.shapeConsistency += 2;
        }

        // ОБЩИЙ СЧЕТ (гарантируем число)
        scores.overallScore = Math.min(
            scores.patternSimilarity + scores.spatialDistribution + scores.detailMatching + scores.shapeConsistency,
            100
        );

        console.log('📊 Улучшенные результаты:', scores);
        return scores;
    }

    async addToTrailSession(chatId, fileUrl, predictions, features, perspectiveAnalysis, patternType) {
        const sessionManager = getWorkingSessionManager();  // ✅ НОВЫЙ
    const trailSession = sessionManager.trailSessions.get(chatId);
        if (!trailSession || trailSession.status !== 'active') return;

        const footprintData = {
            imageUrl: fileUrl,
            predictions: predictions,
            features: features,
            perspectiveAnalysis: perspectiveAnalysis,
            orientation: {
                type: this.analyzeOrientationType(predictions),
                angle: this.calculateOrientationAngle(
                    predictions.find(pred =>
                        pred.class === 'Outline-trail' || pred.class.includes('Outline')
                    )?.points || []
                )
            },
            patternType: patternType,
            assemblyPotential: 0
        };

        try {
            const footprintRecord = trailSession.addFootprint(footprintData);

            if (trailSession.calculateAssemblyPotential) {
                footprintRecord.assemblyPotential = trailSession.calculateAssemblyPotential(footprintRecord);
            }

            console.log(`✅ Отпечаток успешно добавлен в сессию! Всего: ${trailSession.footprints.length}`);

            // Автоматический анализ групп
            if (trailSession.footprints.length >= 3) {
                setTimeout(async () => {
                    try {
                        if (trailSession.updateCompatibilityGroups) {
                            trailSession.updateCompatibilityGroups();
                            const groupsCount = trailSession.compatibilityGroups?.length || 0;
                            if (groupsCount > 0) {
                                await this.bot.sendMessage(chatId,
                                    `🔄 **Обновление групп совместимости**\n\n` +
                                    `Обнаружено групп: ${groupsCount}\n` +
                                    `Для просмотра: /show_groups\n` +
                                    `Для сборки: /assemble_model`
                                );
                            }
                        }
                    } catch (groupError) {
                        console.log('⚠️ Ошибка автоматического анализа групп:', groupError.message);
                    }
                }, 2000);
            }
        } catch (error) {
            console.log(`❌ Ошибка добавления отпечатка:`, error.message);
        }
    }

    calculateOrientationAngle(points) {
        console.log('🧭 Вычисляю угол ориентации следа...');
       
        if (!points || points.length < 3) {
            console.log('⚠️ Недостаточно точек для вычисления ориентации');
            return 0;
        }

        try {
            // 1. ВЫЧИСЛЯЕМ ЦЕНТР МАСС
            const center = points.reduce((acc, point) => {
                acc.x += point.x;
                acc.y += point.y;
                return acc;
            }, { x: 0, y: 0 });
           
            center.x /= points.length;
            center.y /= points.length;

            // 2. ВЫЧИСЛЯЕМ УГОЛ ЧЕРЕЗ МЕТОД ГЛАВНЫХ КОМПОНЕНТ
            let xx = 0, yy = 0, xy = 0;
           
            points.forEach(point => {
                const dx = point.x - center.x;
                const dy = point.y - center.y;
                xx += dx * dx;
                yy += dy * dy;
                xy += dx * dy;
            });

            // 3. ВЫЧИСЛЯЕМ УГОЛ НАКЛОНА
            const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
            const degrees = angle * (180 / Math.PI);
           
            console.log(`📐 Вычисленный угол поворота: ${degrees.toFixed(2)}°`);
            return degrees;

        } catch (error) {
            console.log('❌ Ошибка вычисления ориентации:', error.message);
            return 0;
        }
    }

    analyzeOrientationType(predictions) {
        if (!predictions || predictions.length === 0) {
            return 'unknown';
        }

        try {
            const outline = predictions.find(pred =>
                pred.class === 'Outline-trail' || pred.class.includes('Outline')
            );

            if (!outline) return 'unknown';

            const angle = this.calculateOrientationAngle(outline.points);
           
            // 🔧 НАСТРАИВАЕМ ПОРОГИ ДЛЯ БОЛЕЕ ТОЧНОЙ КЛАССИФИКАЦИИ
            if (Math.abs(angle) < 8) return 'aligned';          // ±8° - нормально
            if (angle > 8 && angle <= 45) return 'rotated_clockwise';
            if (angle < -8 && angle >= -45) return 'rotated_counterclockwise';
            if (Math.abs(angle) > 45) return 'strongly_rotated'; // Сильный поворот
           
            return 'aligned';
           
        } catch (error) {
            return 'unknown';
        }
    }

    async uploadToYandexDisk(msg, fileUrl) {
        if (!this.yandexDisk) return;

        try {
            const timestamp = Date.now();
            const photoId = `user_${msg.from.id}_${timestamp}`;
            const tempPhotoPath = `temp_${photoId}.jpg`;

            const photoResponse = await axios({
                method: 'GET',
                url: fileUrl,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(tempPhotoPath);
            photoResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            await this.yandexDisk.uploadFile(tempPhotoPath, `${photoId}.jpg`);
            fs.unlinkSync(tempPhotoPath);

            console.log(`✅ Фото загружено на Яндекс.Диск: ${photoId}.jpg`);
        } catch (uploadError) {
            console.log('⚠️ Ошибка загрузки на Яндекс.Диск:', uploadError.message);
        }
    }

    async sendVisualizationResults(chatId, fileUrl, predictions, user, perspectiveAnalysis, patternType) {
        if (predictions.length === 0) {
            await this.bot.sendMessage(chatId, '❌ Не удалось обнаружить детали на фото');
            return;
        }

        await this.bot.sendMessage(chatId, '🎨 Создаю визуализацию...');

        const userData = { username: user.username ? `@${user.username}` : user.first_name };
        const vizPath = await this.createAnalysisVisualization(fileUrl, predictions, userData);

        let caption = this.generateResultsCaption(predictions.length, chatId, perspectiveAnalysis, patternType);
        const transparentCaption = Helpers.addModelTransparency(caption, predictions.length);

        if (vizPath) {
            await this.bot.sendPhoto(chatId, vizPath, { caption: transparentCaption });
            fs.unlinkSync(vizPath);

            // Скелетная визуализация
            try {
                const skeletonPath = await this.createSkeletonVisualization(fileUrl, predictions, userData);
                if (skeletonPath) {
                    await this.bot.sendPhoto(chatId, skeletonPath, {
                        caption: `🕵️♂️ Карта морфологических признаков протектора`
                    });
                    fs.unlinkSync(skeletonPath);
                }
            } catch (error) {
                console.error('💥 Ошибка при создании скелетной визуализации:', error);
            }
        } else {
            await this.bot.sendMessage(chatId, transparentCaption);
        }
    }

    async createAnalysisVisualization(imageUrl, predictions, userData = {}) {
        if (!imageUrl || !predictions) {
            console.log('❌ Ошибка: нет imageUrl или predictions');
            return null;
        }

        if (predictions.length > 50) {
            console.log(`⚠️ Слишком много объектов (${predictions.length}), ограничиваем визуализацию`);
            predictions = predictions.slice(0, 50);
        }

        try {
            const image = await loadImage(imageUrl);
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

            return vizPath;

        } catch (error) {
            console.log('❌ Ошибка визуализации:', error.message);
            return null;
        }
    }

    async createSkeletonVisualization(imageUrl, predictions, userData) {
        try {
            console.log('🕵️‍♂️ Создаю карту морфологических признаков...');
           
            // Загружаем изображение
            const image = await loadImage(imageUrl);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');

            // ВРЕМЕННО: уберем полупрозрачность для теста
            ctx.drawImage(image, 0, 0);

            // ФИЛЬТРУЕМ: ТОЛЬКО ДЕТАЛИ ПРОТЕКТОРА
            const details = predictions.filter(pred =>
                pred.class === 'shoe-protector'
            );

            console.log(`🕵️‍♂️ Найдено ${details.length} морфологических признаков`);

            // Вычисляем центры
            const centers = details.map(pred => {
                const bbox = this.calculateBoundingBox(pred.points);
                return {
                    x: bbox.minX + bbox.width / 2,
                    y: bbox.minY + bbox.height / 2,
                    class: pred.class
                };
            });

            console.log(`🕵️‍♂️ Вычислено ${centers.length} точек анализа`);

            // 1. РИСУЕМ СВЯЗИ МЕЖДУ ЦЕНТРАМИ
            ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)'; // Более яркий цвет
            ctx.lineWidth = 2; // Толще линии
           
            const MAX_DISTANCE = Math.min(image.width, image.height) * 0.15;
           
            for (let i = 0; i < centers.length; i++) {
                for (let j = i + 1; j < centers.length; j++) {
                    const dist = Math.sqrt(
                        Math.pow(centers[i].x - centers[j].x, 2) +
                        Math.pow(centers[i].y - centers[j].y, 2)
                    );
                   
                    if (dist < MAX_DISTANCE) {
                        ctx.beginPath();
                        ctx.moveTo(centers[i].x, centers[i].y);
                        ctx.lineTo(centers[j].x, centers[j].y);
                        ctx.stroke();
                    }
                }
            }

            // 2. РИСУЕМ ТОЧКИ ЦЕНТРОВ (крупные и яркие)
            centers.forEach(center => {
                // Большие красные точки
                ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.arc(center.x, center.y, 8, 0, Math.PI * 2); // Увеличил радиус
                ctx.fill();

                // Белая обводка
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.stroke();
            });

            // 3. КОНТУР СЛЕДА (если есть)
            const outline = predictions.find(pred =>
                pred.class === 'Outline-trail' || pred.class.includes('Outline')
            );
           
            if (outline && outline.points) {
                ctx.strokeStyle = 'blue';
                ctx.lineWidth = 4;
                ctx.setLineDash([10, 5]); // Более заметный пунктир
               
                ctx.beginPath();
                ctx.moveTo(outline.points[0].x, outline.points[0].y);
               
                for (let i = 1; i < outline.points.length; i++) {
                    ctx.lineTo(outline.points[i].x, outline.points[i].y);
                }
               
                ctx.closePath();
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // 4. ТЕКСТ
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.font = 'bold 30px Arial';
            ctx.strokeText(`🕵️‍♂️ Карта морфологических признаков`, 20, 40);
            ctx.fillText(`🕵️‍♂️ Карта морфологических признаков`, 20, 40);
           
            ctx.font = '20px Arial';
            ctx.strokeText(`Признаки: ${details.length}`, 20, 70);
            ctx.fillText(`Признаки: ${details.length}`, 20, 70);       
            ctx.strokeText(`Точки анализа: ${centers.length}`, 20, 95);
            ctx.fillText(`Точки анализа: ${centers.length}`, 20, 95);

            // Сохраняем
            const tempPath = `skeleton_${Date.now()}.png`;
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(tempPath, buffer);

            console.log('✅ Скелетная визуализация создана успешно!');
            return tempPath;

        } catch (error) {
            console.error('❌ Ошибка создания скелетной визуализации:', error);
            return null;
        }
    }

    generateResultsCaption(detailsCount, chatId, perspectiveAnalysis, patternType) {
        let caption = `✅ Анализ завершен!\n🎯 Выявлено морфологических признаков: ${detailsCount}`;

        const trailSession = this.sessionManager.trailSessions.get(chatId);
        if (trailSession && trailSession.status === 'active') {
            caption += `\n\n🕵️♂️ **СЕССИЯ АНАЛИЗА ТРОПЫ**\n`;
            caption += `• Отпечаток #${trailSession.footprints.length} зарегистрирован\n`;

            if (trailSession.comparisons.length > 0) {
                const lastComparison = trailSession.comparisons[trailSession.comparisons.length - 1];
                caption += `• Автосравнение: ${lastComparison.similarity.toFixed(1)}% сходства\n`;
            }
        }

        if (perspectiveAnalysis.hasPerspectiveIssues) {
            caption += `\n⚠️ **Обнаружены искажения:** ${perspectiveAnalysis.issues.join(', ')}`;
            if (perspectiveAnalysis.recommendations.length > 0) {
                caption += `\n💡 **Рекомендации:** ${perspectiveAnalysis.recommendations.join(', ')}`;
            }
        } else {
            caption += `\n📐 Перспектива: нормальная`;
        }

        const orientationType = this.analyzeOrientationType([]); // Нужно передать predictions
        const orientationText = {
            'aligned': '✅ Нормальная ориентация',
            'rotated_clockwise': '🔄 Поворот по часовой',
            'rotated_counterclockwise': '🔄 Поворот против часовой',
            'strongly_rotated': '⚠️ Сильный поворот',
            'unknown': '❓ Ориентация не определена'
        };

        caption += `\n🧭 ${orientationText[orientationType]}`;

        return caption;
    }

    generateComparisonReport(modelName, comparisonResult) {
        let report = `🔍 **СРАВНЕНИЕ С "${modelName}"**\n\n`;
        report += `🎯 **Вероятность совпадения: ${Math.round(comparisonResult.overallScore)}%**\n\n`;

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

        return report;
    }
}

module.exports = PhotoHandler;
