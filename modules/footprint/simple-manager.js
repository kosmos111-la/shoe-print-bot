// modules/footprint/simple-manager.js
// 🔥 УПРОЩЕННАЯ ВЕРСИЯ: Только супер-модель определяет подтверждения

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 🔥 Импорт SimpleGraph
const SimpleGraph = require('./simple-graph');

class SimpleFootprintManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/footprints',
            autoAlignment: options.autoAlignment !== false,
            autoSave: options.autoSave !== false,
            debug: options.debug || false,

            // 🔥 ТОЛЬКО СУПЕР-МОДЕЛЬ
            usePointTracker: true,
            enableVectorSuperModel: true, // 🔥 ВСЕГДА ВКЛЮЧЕНО
            enableMergeVisualization: options.enableMergeVisualization !== false,
           
            // Пороги
            topologySimilarityThreshold: options.topologySimilarityThreshold || 0.7,
            minPointsForFootprint: options.minPointsForFootprint || 5,
           
            // Настройки для сопоставления с шаблоном
            templateMatchThreshold: 80, // 🔥 Порог для сопоставления с шаблоном
            minTemplateConfirmations: 1, // 🔥 Минимальные подтверждения в шаблоне
           
            ...options
        };

        // Импорт модулей
        const SimpleFootprint = require('./simple-footprint');
        const SimpleMatcher = require('./simple-matcher');
        const MergeVisualizer = require('./merge-visualizer');
        const VectorSuperModel = require('./vector-super-model');
        const TemplateVisualizer = require('./template-visualizer');
        const RotationInvariance = require('./rotation-invariance');
        const MirrorDetection = require('./mirror-detection');

        this.rotationProcessor = new RotationInvariance({
            debug: this.config.debug
        });

        this.mirrorDetector = new MirrorDetection({
            debug: this.config.debug
        });

        // Сессии пользователей
        this.userSessions = new Map();
        this.loadedModels = new Map();
        this.vectorSuperModels = new Map(); // 🔥 Ключевой объект
       
        this.templateVisualizer = new TemplateVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations/templates'),
            debug: this.config.debug
        });

        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalPhotosProcessed: 0,
            totalTemplateConfirmations: 0,
            lastActivity: new Date()
        };

        this.ensureDirectories();
        this.loadExistingModels();

        console.log(`🚀 SimpleFootprintManager с упрощенной логикой (только супер-модель)`);
    }

    // 🔥 Ключевой метод: Обновление подтверждений ИЗ ШАБЛОНА
    updateConfirmationsFromTemplate(footprint, vectorModel, transformationInfo = null) {
        console.log(`🔄 ОБНОВЛЯЮ подтверждения ИЗ ШАБЛОНА...`);
       
        if (!footprint || !footprint.pointTracker || !vectorModel || !vectorModel.templateBuilder) {
            console.log('⚠️ Нет данных для обновления');
            return 0;
        }

        const tracker = footprint.pointTracker;
        const templateBuilder = vectorModel.templateBuilder;

        // 🔥 Получаем данные шаблона
        const templateData = templateBuilder.getVisualizationData();
        if (!templateData || !templateData.cells) {
            console.log('⚠️ Нет данных шаблона');
            return 0;
        }

        console.log(`📊 Данные шаблона:`);
        console.log(`   • Ячеек: ${templateData.cells.length}`);
        console.log(`   • Всего подтверждений: ${templateData.stats?.totalConfirmations || 0}`);
        console.log(`   • Среднее подтверждений: ${templateData.stats?.averageConfirmations?.toFixed(2) || 0}`);

        // 🔥 Преобразуем точки шаблона в систему координат PointTracker
        const templatePoints = templateData.cells.map(cell => ({
            id: `template_${cell.id}`,
            x: cell.x,
            y: cell.y,
            confirmations: cell.confirmations || 1,
            confidence: cell.confidence || 0.7,
            isFromTemplate: true
        }));

        console.log(`📊 Преобразовано ${templatePoints.length} точек из шаблона`);

        // 🔥 Если есть трансформация - применяем обратную
        let transformedTemplatePoints = templatePoints;
       
        if (transformationInfo) {
            console.log(`📐 Применяю обратную трансформацию...`);
            transformedTemplatePoints = this.transformCoordinatesBetweenSystems(
                templatePoints,
                transformationInfo,
                'to_original'
            );
            console.log(`✅ Трансформировано ${transformedTemplatePoints.length} точек`);
        }

        // 🔥 ПРОСТОЕ СОПОСТАВЛЕНИЕ: находим ближайшие точки в шаблоне
        let updatedCount = 0;
        const threshold = this.config.templateMatchThreshold;

        console.log(`🔍 Сопоставляю ${tracker.points.size} точек трекера с шаблоном (порог: ${threshold}px)...`);

        // 🔥 Для каждой точки трекера ищем ближайшую точку шаблона
        for (const [trackerId, trackerPoint] of tracker.points) {
            let bestMatch = null;
            let minDistance = threshold;

            for (const templatePoint of transformedTemplatePoints) {
                // 🔥 Проверяем, что у точки шаблона достаточно подтверждений
                if (templatePoint.confirmations < this.config.minTemplateConfirmations) {
                    continue;
                }

                const distance = Math.sqrt(
                    Math.pow(templatePoint.x - trackerPoint.x, 2) +
                    Math.pow(templatePoint.y - trackerPoint.y, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = templatePoint;
                }
            }

            // 🔥 ЕСЛИ НАШЛИ СОВПАДЕНИЕ С ШАБЛОНОМ
            if (bestMatch) {
                const oldCount = trackerPoint.confirmedCount || 0;
                const templateConfirmations = bestMatch.confirmations;
               
                // 🔥 Точка получает ВСЕ подтверждения из шаблона
                const newCount = Math.min(5, Math.max(oldCount, templateConfirmations));
               
                if (newCount > oldCount) {
                    trackerPoint.confirmedCount = newCount;
                    trackerPoint.confidence = Math.max(trackerPoint.confidence || 0.5, bestMatch.confidence || 0.7);
                   
                    // Добавляем информацию о подтверждении от шаблона
                    if (!trackerPoint.templateConfirmations) {
                        trackerPoint.templateConfirmations = [];
                    }
                   
                    trackerPoint.templateConfirmations.push({
                        timestamp: new Date(),
                        templateId: templateData.templateId,
                        confirmations: templateConfirmations,
                        distance: minDistance
                    });

                    updatedCount++;
                   
                    if (this.config.debug && updatedCount <= 10) {
                        console.log(`   ✅ ${trackerId.slice(0, 8)}: ${oldCount} → ${newCount} подтверждений (шаблон: ${templateConfirmations}, расстояние: ${minDistance.toFixed(1)}px)`);
                    }
                }
            }
        }

        console.log(`✅ Обновлено ${updatedCount} точек из ${tracker.points.size} на основе шаблона`);
       
        // 🔥 ВРЕМЕННОЕ РЕШЕНИЕ: Если следы совпали, но не нашли совпадений с шаблоном
        if (updatedCount === 0 && tracker.points.size > 0) {
            console.log(`⚠️ Не найдено совпадений с шаблоном, но следы совпали...`);
           
            let tempUpdated = 0;
            for (const [trackerId, trackerPoint] of tracker.points) {
                const oldCount = trackerPoint.confirmedCount || 0;
                if (oldCount < 2) {
                    trackerPoint.confirmedCount = Math.min(5, oldCount + 1);
                    tempUpdated++;
                   
                    if (this.config.debug && tempUpdated <= 5) {
                        console.log(`   ⚠️ ${trackerId.slice(0, 8)}: ${oldCount} → ${trackerPoint.confirmedCount} (временное)`);
                    }
                }
            }
           
            console.log(`⚠️ Временное обновление: ${tempUpdated} точек`);
            updatedCount = tempUpdated;
        }

        return updatedCount;
    }

    // 🔥 УПРОЩЕННЫЙ МЕТОД: Добавление фото с фокусом на шаблон
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО (упрощенная логика)`);

        try {
            if (!analysis || !analysis.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }

            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < 5) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }

            console.log(`🔍 Извлечено ${points.length} точек протекторов`);

            // Создаем граф
            const graph = new SimpleGraph(`Временный_${Date.now()}`);
            graph.buildFromPoints(points);

            // Нормализация
            const normalized = this.rotationProcessor.normalizeToCanonical(graph, {
                userId: userId,
                photoInfo: photoInfo,
                autoRotate: true
            });

            console.log(`📐 Автоповорот: ${normalized.rotationAngle.toFixed(1)}° → 0°`);
            console.log(`🪞 Зеркало: ${normalized.isMirrored ? 'да' : 'нет'}`);

            const corrected = this.mirrorDetector.autoCorrectMirroring(
                normalized.graph,
                'right'
            );

            if (corrected.correctionApplied) {
                console.log(`🔄 Автокоррекция применена: ${corrected.correctionType}`);
            }

            // 🔥 Сохраняем информацию о трансформации
            const currentTransformationInfo = {
                rotationAngle: normalized.rotationAngle,
                isMirrored: normalized.isMirrored,
                corrected: corrected.correctionApplied,
                scale: 1.0,
                timestamp: new Date(),
                footType: normalized.footType,
                photoId: photoInfo.photoId || `photo_${Date.now()}`
            };

            const finalGraph = corrected.graph;

            // Получаем или создаем сессию
            let session = this.userSessions.get(userId);
            if (!session) {
                session = this.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
                console.log(`🆕 Создана новая сессия`);
            }

            // Сохраняем трансформацию
            if (!session.metadata.normalizationHistory) {
                session.metadata.normalizationHistory = [];
            }
            session.metadata.normalizationHistory.push(currentTransformationInfo);
            session.metadata.lastTransformation = currentTransformationInfo;

            session.photos.push({
                id: `photo_${Date.now()}`,
                timestamp: new Date(),
                pointsCount: points.length,
                transformationInfo: currentTransformationInfo
            });
            session.lastActivity = new Date();

            const SimpleFootprint = require('./simple-footprint');

            // 🔥 ПЕРВОЕ ФОТО: создаем отпечаток и шаблон
            if (!session.currentFootprint) {
                console.log(`👣 Первое фото: создаю отпечаток и шаблон`);

                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`
                });

                session.currentFootprint.metadata.normalizationInfo = currentTransformationInfo;

                // Добавляем анализ
                const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
                    ...photoInfo,
                    normalizedGraph: finalGraph,
                    photoId: photoInfo.photoId || `photo_${Date.now()}`,
                    source: photoInfo.source || 'telegram_bot',
                    transformationInfo: currentTransformationInfo
                });

                // 🔥 СОЗДАЕМ СУПЕР-МОДЕЛЬ (ШАБЛОН)
                const VectorSuperModel = require('./vector-super-model');
                const vectorModel = new VectorSuperModel({
                    name: `Шаблон_${String(userId).slice(0, 6)}`,
                    enablePCA: false,
                    cellSize: 25,
                    debug: this.config.debug
                });

                // Добавляем первый граф как эталон
                vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
                    isFirst: true,
                    transformationInfo: currentTransformationInfo
                });
               
                this.vectorSuperModels.set(userId, vectorModel);

                console.log(`✅ Создан отпечаток с ${addResult.added} узлами`);
                console.log(`✅ Создан шаблон с ${vectorModel.templateBuilder.getVisualizationData()?.cells?.length || 0} ячейками`);

                return {
                    success: true,
                    isNewSession: true,
                    similarity: 0,
                    decision: 'new',
                    nodesAdded: addResult.added,
                    totalNodes: session.currentFootprint.graph.nodes.size,
                    sessionId: session.id,
                    hasTemplate: true
                };
            }

            // 🔥 ВТОРОЕ И ПОСЛЕДУЮЩИЕ ФОТО
            console.log(`🔍 Проверяю совпадение с существующим отпечатком (${session.currentFootprint.graph.nodes.size} узлов)`);

            // Создаем временный отпечаток для сравнения
            const tempFootprint = new SimpleFootprint({
                userId: userId,
                name: `Temp_${Date.now()}`
            });

            tempFootprint.metadata.normalizationInfo = currentTransformationInfo;

            const tempResult = tempFootprint.addAnalysisHonest(analysis, {
                ...photoInfo,
                normalizedGraph: finalGraph,
                photoId: photoInfo.photoId || `photo_${Date.now()}_temp`,
                source: photoInfo.source || 'telegram_bot_temp',
                transformationInfo: currentTransformationInfo
            });

            // 🔥 ПРОСТОЕ СРАВНЕНИЕ
            const SimpleMatcher = require('./simple-matcher');
            const matcher = new SimpleMatcher({
                debug: this.config.debug,
                similarityThreshold: this.config.topologySimilarityThreshold
            });

            const existingTransformationInfo = session.currentFootprint.metadata.normalizationInfo;
           
            const comparisonResult = await matcher.compareGraphs(
                session.currentFootprint.graph,
                tempFootprint.graph,
                {
                    userId: userId,
                    photoId: photoInfo.photoId,
                    transformationInfo1: existingTransformationInfo,
                    transformationInfo2: currentTransformationInfo
                }
            );

            const similarity = comparisonResult?.similarity || 0;
            const decision = similarity > 0.6 ? 'same' : 'different';

            console.log(`🎯 Сходство: ${similarity.toFixed(3)}, решение: ${decision}`);

            // 🔥 СЛЕДЫ СОВПАЛИ - обновляем шаблон и подтверждения
            if (decision === 'same') {
                console.log(`✅ Следы совпали (${similarity.toFixed(3)})`);

                // Получаем или создаем шаблон
                let vectorModel = this.vectorSuperModels.get(userId);
               
                if (!vectorModel) {
                    const VectorSuperModel = require('./vector-super-model');
                    vectorModel = new VectorSuperModel({
                        name: `Шаблон_${String(userId).slice(0, 6)}`,
                        enablePCA: false,
                        cellSize: 25,
                        debug: this.config.debug
                    });
                    this.vectorSuperModels.set(userId, vectorModel);
                   
                    // Добавляем существующий граф
                    vectorModel.addGraph(
                        session.currentFootprint.graph,
                        session.currentFootprint.id,
                        {
                            isFirst: true,
                            transformationInfo: existingTransformationInfo
                        }
                    );
                }

                // 🔥 ДОБАВЛЯЕМ НОВЫЙ ГРАФ В ШАБЛОН
                console.log(`🔄 Добавляю новый граф в шаблон...`);
                vectorModel.addGraph(
                    finalGraph,
                    tempFootprint.id,
                    {
                        similarity: similarity,
                        timestamp: new Date(),
                        ...photoInfo,
                        transformationInfo: currentTransformationInfo
                    }
                );

                // 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ ИЗ ШАБЛОНА
                console.log(`🔄 Обновляю подтверждения из шаблона...`);
                const updatedFromTemplate = this.updateConfirmationsFromTemplate(
                    session.currentFootprint,
                    vectorModel,
                    existingTransformationInfo
                );

                // 🔥 ВИЗУАЛИЗАЦИЯ ШАБЛОНА
                let templateVizPath = null;
                if (this.config.enableMergeVisualization && vectorModel) {
                    templateVizPath = await this.visualizeVectorSuperModel(userId, vectorModel);

                    // Отправляем в Telegram
                    if (bot && chatId && templateVizPath && templateVizPath.template) {
                        try {
                            if (fs.existsSync(templateVizPath.template)) {
                                const templateData = vectorModel.templateBuilder.getVisualizationData();
                                const stats = templateData?.stats || {};
                               
                                await bot.sendPhoto(chatId, templateVizPath.template, {
                                    caption: `✅ **Шаблон обновлен!**\n\n` +
                                            `🎯 Сходство: ${(similarity * 100).toFixed(1)}%\n` +
                                            `📊 Ячеек шаблона: ${templateData?.cells?.length || 0}\n` +
                                            `🔴 Подтвержденных точек: ${updatedFromTemplate}\n` +
                                            `📈 Среднее подтверждений: ${stats.averageConfirmations?.toFixed(2) || '0.00'}\n` +
                                            `📐 Угол: ${currentTransformationInfo.rotationAngle.toFixed(1)}°`
                                });
                                console.log(`✅ Визуализация шаблона отправлена в Telegram`);
                            }
                        } catch (sendError) {
                            console.log(`❌ Ошибка отправки: ${sendError.message}`);
                        }
                    }
                }

                // 🔥 Статистика
                const stats = this.calculateConfirmationStats(session.currentFootprint);
                console.log(`📊 ФИНАЛЬНАЯ СТАТИСТИКА:`);
                console.log(`   • Всего точек: ${stats.totalPoints}`);
                console.log(`   • 🔴 Красные (2+): ${stats.confirmed2}`);
                console.log(`   • 🔵 Синие (1): ${stats.confirmed1}`);
                console.log(`   • ⚪ Серые (0): ${stats.confirmed0}`);

                return {
                    success: true,
                    similarity: similarity,
                    decision: decision,
                    nodesAdded: tempResult.added,
                    message: `✅ След добавлен! Сходство: ${(similarity * 100).toFixed(1)}%`,
                    templateUpdated: true,
                    pointsUpdated: updatedFromTemplate,
                    templateStats: {
                        cells: vectorModel.templateBuilder.getVisualizationData()?.cells?.length || 0,
                        totalConfirmations: stats.totalPoints,
                        confirmed2plus: stats.confirmed2
                    }
                };

            } else {
                // 🔥 СЛЕДЫ РАЗНЫЕ - начинаем новую модель
                console.log(`🆕 Следы разные (${similarity.toFixed(3)}) - новая модель`);

                if (session.currentFootprint.graph.nodes.size >= 10) {
                    this.saveSessionAsModel(userId, `Модель_${new Date().toLocaleTimeString('ru-RU')}`);
                }

                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`
                });

                session.currentFootprint.metadata.normalizationInfo = currentTransformationInfo;

                const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
                    ...photoInfo,
                    normalizedGraph: finalGraph,
                    photoId: photoInfo.photoId || `photo_${Date.now()}`,
                    source: photoInfo.source || 'telegram_bot',
                    transformationInfo: currentTransformationInfo
                });

                // 🔥 Создаем новый шаблон
                const VectorSuperModel = require('./vector-super-model');
                const vectorModel = new VectorSuperModel({
                    name: `Шаблон_${String(userId).slice(0, 6)}_new`,
                    enablePCA: false,
                    cellSize: 25,
                    debug: this.config.debug
                });

                vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
                    isFirst: true,
                    transformationInfo: currentTransformationInfo
                });
               
                this.vectorSuperModels.set(userId, vectorModel);

                return {
                    success: true,
                    similarity: similarity,
                    decision: decision,
                    isNewModel: true,
                    nodesAdded: addResult.added,
                    hasTemplate: true
                };
            }

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // 🔥 Добавляем недостающие методы для команд
    getVectorSuperModelInfo(userId) {
        const vectorModel = this.vectorSuperModels.get(userId);
       
        if (!vectorModel) {
            return {
                exists: false,
                message: 'Шаблон не найден'
            };
        }

        const templateData = vectorModel.templateBuilder.getVisualizationData();
        const stats = templateData?.stats || {};
       
        return {
            exists: true,
            userId: userId,
            templateName: vectorModel.name,
            cellsCount: templateData?.cells?.length || 0,
            totalConfirmations: stats.totalConfirmations || 0,
            averageConfirmations: stats.averageConfirmations?.toFixed(2) || '0.00',
            confirmedCells: stats.confirmedCells || 0,
            lastUpdated: vectorModel.lastUpdated || new Date()
        };
    }

    clearVectorSuperModel(userId) {
        if (this.vectorSuperModels.has(userId)) {
            this.vectorSuperModels.delete(userId);
           
            // Также очищаем сессию
            if (this.userSessions.has(userId)) {
                this.userSessions.delete(userId);
            }
           
            console.log(`🧹 Очищен шаблон и сессия для пользователя ${userId}`);
           
            return {
                success: true,
                message: 'Шаблон и сессия очищены'
            };
        }
       
        return {
            success: false,
            message: 'Шаблон не найден'
        };
    }

    getTemplateVisualization(userId) {
        const vectorModel = this.vectorSuperModels.get(userId);
       
        if (!vectorModel) {
            return null;
        }

        return this.visualizeVectorSuperModel(userId, vectorModel);
    }

    // 🔥 Вспомогательные методы (остаются без изменений)
    transformCoordinatesBetweenSystems(originalPoints, transformationInfo, direction = 'to_original', referenceAngle = 0) {
        // ... существующий код без изменений ...
        if (!transformationInfo) return originalPoints;

        const angleRad = (transformationInfo.rotationAngle - (direction === 'to_normalized' ? referenceAngle : 0)) * (Math.PI / 180);
       
        return originalPoints.map(point => {
            let x = point.x;
            let y = point.y;

            if (direction === 'to_original') {
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);
                const rotatedX = x * cosA - y * sinA;
                const rotatedY = x * sinA + y * cosA;
                x = rotatedX;
                y = rotatedY;
                if (transformationInfo.isMirrored) x = -x;
            } else if (direction === 'to_normalized') {
                if (transformationInfo.isMirrored) x = -x;
                const cosA = Math.cos(-angleRad);
                const sinA = Math.sin(-angleRad);
                const rotatedX = x * cosA - y * sinA;
                const rotatedY = x * sinA + y * cosA;
                x = rotatedX;
                y = rotatedY;
            }

            return { ...point, x, y };
        });
    }

    extractPointsFromAnalysis(analysis) {
        const points = [];
        const predictions = analysis.predictions || [];

        predictions.forEach(pred => {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);

                points.push({
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2,
                    confidence: pred.confidence || 0.5,
                    originalPoints: pred.points
                });
            }
        });

        return points;
    }

    calculateConfirmationStats(footprint) {
        if (!footprint || !footprint.pointTracker) {
            return { confirmed2: 0, confirmed1: 0, confirmed0: 0, totalPoints: 0 };
        }

        let confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;

        for (const [id, point] of footprint.pointTracker.points) {
            const confirmations = point.confirmedCount || 0;

            if (confirmations >= 2) {
                confirmed2++;
            } else if (confirmations >= 1) {
                confirmed1++;
            } else {
                confirmed0++;
            }
        }

        const totalPoints = confirmed2 + confirmed1 + confirmed0;

        return {
            confirmed2,
            confirmed1,
            confirmed0,
            totalPoints
        };
    }

    async visualizeVectorSuperModel(userId, vectorModel) {
        console.log(`🎨 Создаю визуализацию ШАБЛОНА...`);

        try {
            if (!vectorModel) return null;

            let templateData = vectorModel.templateBuilder.getVisualizationData();

            if (!templateData || !templateData.cells || templateData.cells.length === 0) {
                if (vectorModel.templateBuilder) {
                    templateData = vectorModel.templateBuilder.getVisualizationData();
                }
            }

            const result = await this.templateVisualizer.visualizeTemplate(templateData, {
                filename: `template_${userId}_${Date.now()}.png`
            });

            const heatmapResult = await this.templateVisualizer.createHeatmap(templateData, {
                filename: `heatmap_${userId}_${Date.now()}.png`
            });

            let heatmapPath = heatmapResult;
            if (heatmapResult && typeof heatmapResult === 'object' && heatmapResult.path) {
                heatmapPath = heatmapResult.path;
            }

            return {
                template: result.path,
                heatmap: heatmapPath,
                stats: templateData?.stats,
                templateId: templateData?.templateId
            };

        } catch (error) {
            console.log(`❌ Ошибка визуализации шаблона: ${error.message}`);
            return null;
        }
    }

    createSession(userId, name = null) {
        const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const session = {
            id: sessionId,
            userId: String(userId),
            name: name || `Сессия_${new Date().toLocaleDateString('ru-RU')}`,
            startTime: new Date(),
            lastActivity: new Date(),
            photos: [],
            currentFootprint: null,
            metadata: {
                created: new Date(),
                normalizationHistory: [],
                lastTransformation: null
            }
        };

        this.userSessions.set(userId, session);
        this.systemStats.totalUsers = this.userSessions.size;

        console.log(`🆕 Создана сессия ${sessionId.slice(0, 8)} для пользователя ${userId}`);

        return session;
    }

    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'sessions'),
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'visualizations/templates')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    loadExistingModels() {
        const modelsDir = path.join(this.config.dbPath, 'models');

        if (!fs.existsSync(modelsDir)) {
            fs.mkdirSync(modelsDir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.json'));
        console.log(`📂 Загрузка моделей из ${modelsDir} (${files.length} файлов)`);

        let loadedCount = 0;

        files.slice(0, 100).forEach(file => {
            try {
                const filePath = path.join(modelsDir, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                const SimpleFootprint = require('./simple-footprint');
                const footprint = SimpleFootprint.fromJSON(data);
                this.loadedModels.set(footprint.id, footprint);
                loadedCount++;

            } catch (error) {
                console.log(`⚠️ Ошибка загрузки модели ${file}:`, error.message);
            }
        });

        this.systemStats.totalModels = loadedCount;
        console.log(`✅ Загружено ${loadedCount} моделей`);
    }

    saveSessionAsModel(userId, modelName = null) {
        const session = this.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии или отпечатка' };
        }

        const footprint = session.currentFootprint;

        if (modelName) {
            footprint.name = modelName;
        }

        const modelPath = path.join(this.config.dbPath, 'models', `${footprint.id}.json`);

        try {
            const modelData = footprint.toJSON();
            modelData.metadata.sessionInfo = {
                sessionId: session.id,
                photosCount: session.photos.length,
                normalizationHistory: session.metadata.normalizationHistory || []
            };

            fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));

            this.loadedModels.set(footprint.id, footprint);
            this.systemStats.totalModels = this.loadedModels.size;

            console.log(`💾 Модель сохранена: ${footprint.id} (${footprint.graph.nodes.size} узлов)`);

            this.userSessions.delete(userId);

            return {
                success: true,
                modelId: footprint.id,
                modelName: footprint.name,
                modelPath: modelPath,
                modelStats: {
                    nodes: footprint.graph.nodes.size,
                    edges: footprint.graph.edges.size
                }
            };

        } catch (error) {
            console.log('❌ Ошибка сохранения модели:', error.message);
            return { success: false, error: error.message };
        }
    }

    getSystemStats() {
        const templateStats = [];
       
        for (const [userId, vectorModel] of this.vectorSuperModels) {
            const templateData = vectorModel.templateBuilder?.getVisualizationData();
            const stats = templateData?.stats || {};
           
            templateStats.push({
                userId,
                cells: templateData?.cells?.length || 0,
                totalConfirmations: stats.totalConfirmations || 0,
                averageConfirmations: stats.averageConfirmations?.toFixed(2) || '0.00'
            });
        }

        return {
            ...this.systemStats,
            activeSessions: this.userSessions.size,
            loadedModels: this.loadedModels.size,
            vectorModels: this.vectorSuperModels.size,
            templateStats: templateStats
        };
    }
}

module.exports = SimpleFootprintManager;
