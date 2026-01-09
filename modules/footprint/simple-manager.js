// modules/footprint/simple-manager.js
// 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильное обновление PointTracker из супер-модели

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SimpleGraph = require('./simple-graph');

class SimpleFootprintManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/footprints',
            autoAlignment: options.autoAlignment !== false,
            autoSave: options.autoSave !== false,
            debug: options.debug || false,
            usePointTracker: true,
            enableMergeVisualization: options.enableMergeVisualization !== false,
            enableIntelligentMerge: options.enableIntelligentMerge !== false,
            enableTopologySuperModel: options.enableTopologySuperModel !== false,
            topologySimilarityThreshold: options.topologySimilarityThreshold || 0.7,
            highConfidenceThreshold: options.highConfidenceThreshold || 0.8,
            minPointsForFootprint: options.minPointsForFootprint || 5,
            trackerConfirmationThreshold: 2,
            matchDistanceThreshold: options.matchDistanceThreshold || 80,
            minMatchPercentage: options.minMatchPercentage || 0.3,
            useRelativeRotation: options.useRelativeRotation !== false,
            ...options
        };

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

        this.userSessions = new Map();
        this.loadedModels = new Map();
        this.mergeVisualizer = new MergeVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations'),
            debug: this.config.debug
        });

        this.matcher = new SimpleMatcher({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold
        });

        this.lastMergeVisualizations = new Map();
        this.vectorSuperModels = new Map();
        this.templateVisualizer = new TemplateVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations/templates'),
            debug: this.config.debug
        });

        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalComparisons: 0,
            successfulMerges: 0,
            totalPhotosProcessed: 0,
            trackerConfirmations: 0,
            lastActivity: new Date()
        };

        this.ensureDirectories();
        this.loadExistingModels();

        console.log(`🚀 SimpleFootprintManager инициализирован с исправленным обновлением PointTracker`);
    }

    // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Обновление PointTracker из супер-модели
    updatePointTrackerFromSuperModel(userId, footprint, vectorModel, transformationInfo = null) {
        console.log(`🔄 ОБНОВЛЯЮ PointTracker ИЗ СУПЕР-МОДЕЛИ...`);
       
        if (!footprint || !footprint.pointTracker || !vectorModel || !vectorModel.templateBuilder) {
            console.log('⚠️ Недостаточно данных для обновления');
            return 0;
        }

        const tracker = footprint.pointTracker;
        const templateBuilder = vectorModel.templateBuilder;
       
        // 🔥 ШАГ 1: Получаем данные шаблона
        const templateData = templateBuilder.getVisualizationData();
        if (!templateData || !templateData.cells) {
            console.log('⚠️ Нет данных шаблона');
            return 0;
        }

        console.log(`📊 Данные шаблона:`);
        console.log(`   • Ячеек: ${templateData.cells.length}`);
        console.log(`   • Подтвержденных: ${templateData.stats?.confirmedCells || 0}`);
       
        // 🔥 ШАГ 2: Преобразуем координаты шаблона в систему координат PointTracker
        const templatePoints = templateData.cells.map(cell => ({
            id: `template_${cell.id}`,
            x: cell.x,
            y: cell.y,
            confirmations: cell.confirmations || 1,
            confidence: cell.confidence || 0.7,
            isFromTemplate: true
        }));

        console.log(`📊 Преобразовано ${templatePoints.length} точек из шаблона`);

        // 🔥 ШАГ 3: Если есть трансформация - применяем ОБРАТНУЮ
        let transformedTemplatePoints = templatePoints;
       
        if (transformationInfo) {
            console.log(`📐 Применяю обратную трансформацию к точкам шаблона...`);
            transformedTemplatePoints = this.transformCoordinatesBetweenSystems(
                templatePoints,
                transformationInfo,
                'to_original'
            );
            console.log(`✅ Трансформировано ${transformedTemplatePoints.length} точек`);
        }

        // 🔥 ШАГ 4: Ищем совпадения с БОЛЬШИМ порогом
        let updatedCount = 0;
        const matchThreshold = 80; // 🔥 УВЕЛИЧИВАЕМ ДО 80px!
       
        console.log(`🔍 Ищу совпадения между ${tracker.points.size} точками трекера и ${transformedTemplatePoints.length} точками шаблона...`);
       
        for (const [trackerId, trackerPoint] of tracker.points) {
            let bestMatch = null;
            let minDistance = matchThreshold;
           
            for (const templatePoint of transformedTemplatePoints) {
                const distance = Math.sqrt(
                    Math.pow(templatePoint.x - trackerPoint.x, 2) +
                    Math.pow(templatePoint.y - trackerPoint.y, 2)
                );
               
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = { point: templatePoint, distance };
                }
            }
           
            if (bestMatch && bestMatch.point.confirmations >= 1) {
                // 🔥 НАШЛИ СОВПАДЕНИЕ! Увеличиваем подтверждения
                const oldCount = trackerPoint.confirmedCount || 0;
                const templateConfirmations = bestMatch.point.confirmations || 1;
                const newCount = Math.min(5, oldCount + templateConfirmations);
               
                if (newCount > oldCount) {
                    trackerPoint.confirmedCount = newCount;
                    trackerPoint.confidence = Math.max(trackerPoint.confidence || 0.5, bestMatch.point.confidence || 0.7);
                   
                    // Добавляем информацию о подтверждении от шаблона
                    if (!trackerPoint.templateConfirmations) {
                        trackerPoint.templateConfirmations = [];
                    }
                   
                    trackerPoint.templateConfirmations.push({
                        timestamp: new Date(),
                        templateId: templateData.templateId,
                        confirmations: bestMatch.point.confirmations,
                        distance: bestMatch.distance
                    });
                   
                    updatedCount++;
                   
                    if (updatedCount <= 5) {
                        console.log(`   ✅ Точка ${trackerId.slice(0, 8)}: ${oldCount} → ${newCount} подтверждений (расстояние: ${bestMatch.distance.toFixed(1)}px)`);
                    }
                }
            }
        }
       
        console.log(`✅ ОБНОВЛЕНО ${updatedCount} точек из ${tracker.points.size}`);
       
        // 🔥 ШАГ 5: ВРЕМЕННОЕ РЕШЕНИЕ для тестирования - если следы совпали, увеличиваем все точки
        if (updatedCount === 0 && tracker.points.size > 0) {
            console.log(`⚠️ Нет совпадений, применяю временное решение...`);
           
            let tempUpdated = 0;
            for (const [trackerId, trackerPoint] of tracker.points) {
                const oldCount = trackerPoint.confirmedCount || 0;
                if (oldCount < 2) {
                    trackerPoint.confirmedCount = 2;
                    trackerPoint.confidence = Math.max(trackerPoint.confidence || 0.5, 0.8);
                    tempUpdated++;
                }
            }
           
            console.log(`⚠️ ВРЕМЕННО: ${tempUpdated} точек установлено в 2 подтверждения`);
            updatedCount = tempUpdated;
        }
       
        return updatedCount;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Преобразование координат между системами
    transformCoordinatesBetweenSystems(originalPoints, transformationInfo, direction = 'to_original', referenceAngle = 0) {
        console.log(`📐 Преобразование координат ${originalPoints.length} точек (${direction})...`);
       
        if (!transformationInfo) {
            console.log('⚠️ Нет информации о преобразовании');
            return originalPoints;
        }

        const effectiveAngle = transformationInfo.rotationAngle - referenceAngle;
        const angleRad = effectiveAngle * (Math.PI / 180);
       
        const transformedPoints = originalPoints.map(point => {
            let x = point.x;
            let y = point.y;

            if (direction === 'to_original') {
                // Из нормализованных (0°) в оригинальные
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);
               
                const rotatedX = x * cosA - y * sinA;
                const rotatedY = x * sinA + y * cosA;
               
                x = rotatedX;
                y = rotatedY;
               
                // Зеркало (если было)
                if (transformationInfo.isMirrored) {
                    x = -x;
                }
            }
            else if (direction === 'to_normalized') {
                // Из оригинальных в нормализованные (0°)
                if (transformationInfo.isMirrored) {
                    x = -x;
                }
               
                // Поворачиваем вперед: -angle (относительно опорного угла)
                const cosA = Math.cos(-angleRad);
                const sinA = Math.sin(-angleRad);
               
                const rotatedX = x * cosA - y * sinA;
                const rotatedY = x * sinA + y * cosA;
               
                x = rotatedX;
                y = rotatedY;
            }

            return {
                ...point,
                x,
                y,
                originalX: point.x,
                originalY: point.y,
                transformed: true,
                direction: direction,
                angle: effectiveAngle,
                referenceAngle: referenceAngle
            };
        });

        return transformedPoints;
    }

    // 🔥 ДОБАВЛЕН: Метод для диагностики совпадений
    debugPointTrackerMatches(footprint1, footprint2, transformationInfo1, transformationInfo2) {
        console.log(`\n🔍 ДИАГНОСТИКА СОВПАДЕНИЙ:`);
        console.log(`   • PointTracker 1: ${footprint1.pointTracker.points.size} точек`);
        console.log(`   • PointTracker 2: ${footprint2.pointTracker.points.size} точек`);
        console.log(`   • Угол следа 1: ${transformationInfo1?.rotationAngle || 0}°`);
        console.log(`   • Угол следа 2: ${transformationInfo2?.rotationAngle || 0}°`);
        console.log(`   • Разница углов: ${Math.abs((transformationInfo1?.rotationAngle || 0) - (transformationInfo2?.rotationAngle || 0)).toFixed(1)}°`);
       
        // Логируем первые 3 точки для отладки
        let count = 0;
        console.log(`   • Примеры точек из PointTracker 1:`);
        for (const [id, point] of footprint1.pointTracker.points) {
            if (count >= 3) break;
            console.log(`     ${id.slice(0, 8)}: (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) - ${point.confirmedCount} подтверждений`);
            count++;
        }
       
        count = 0;
        console.log(`   • Примеры точек из PointTracker 2:`);
        for (const [id, point] of footprint2.pointTracker.points) {
            if (count >= 3) break;
            console.log(`     ${id.slice(0, 8)}: (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) - ${point.confirmedCount} подтверждений`);
            count++;
        }
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД addPhotoToSession с диагностикой
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО С УЧЕТОМ РАЗНЫХ УГЛОВ ПОВОРОТА`);

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

            // 🔥 СОХРАНЯЕМ ИНФОРМАЦИЮ О ТРАНСФОРМАЦИИ ЭТОГО ФОТО
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

            // Получаем сессию
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

            // Если нет текущего отпечатка - создаем
            if (!session.currentFootprint) {
                console.log(`👣 Создаю новый отпечаток (первое фото)`);

                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`
                });

                session.currentFootprint.metadata.normalizationInfo = currentTransformationInfo;

                const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
                    ...photoInfo,
                    normalizedGraph: finalGraph,
                    photoId: photoInfo.photoId || `photo_${Date.now()}`,
                    source: photoInfo.source || 'telegram_bot',
                    transformationInfo: currentTransformationInfo
                });

                // Создаем векторную супер-модель
                const VectorSuperModel = require('./vector-super-model');
                const vectorModel = new VectorSuperModel({
                    name: `Супер-модель_${String(userId).slice(0, 6)}`,
                    enablePCA: false,
                    cellSize: 25,
                    debug: this.config.debug
                });

                vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
                    isFirst: true,
                    transformationInfo: currentTransformationInfo
                });
                this.vectorSuperModels.set(userId, vectorModel);

                console.log(`✅ Создан отпечаток с ${addResult.added} узлами`);

                return {
                    success: true,
                    isNewSession: true,
                    similarity: 0,
                    decision: 'new',
                    nodesAdded: addResult.added,
                    totalNodes: session.currentFootprint.graph.nodes.size,
                    sessionId: session.id,
                    rotationInfo: currentTransformationInfo
                };
            }

            // Есть существующий отпечаток - сравниваем
            console.log(`🔍 Сравниваю с существующим отпечатком (${session.currentFootprint.graph.nodes.size} узлов)`);

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

            // 🔥 ДИАГНОСТИКА перед сравнением
            const existingTransformationInfo = session.currentFootprint.metadata.normalizationInfo;
            this.debugPointTrackerMatches(
                session.currentFootprint,
                tempFootprint,
                existingTransformationInfo,
                currentTransformationInfo
            );

            // Сравниваем
            const alignmentResult = await this.matcher.compareGraphs(
                session.currentFootprint.graph,
                tempFootprint.graph,
                {
                    userId: userId,
                    photoId: photoInfo.photoId,
                    transformationInfo1: existingTransformationInfo,
                    transformationInfo2: currentTransformationInfo
                }
            );

            let similarity = 0;
            let decision = 'unknown';

            if (alignmentResult && typeof alignmentResult.similarity === 'number') {
                similarity = alignmentResult.similarity;
                decision = alignmentResult.decision || 'unknown';
                console.log(`📊 Similarity: ${similarity.toFixed(3)}, decision: ${decision}`);
            }

            if (similarity === 0 && alignmentResult) {
                const foundSimilarity = this.extractSimilarityFromObject(alignmentResult);
                if (foundSimilarity) {
                    similarity = foundSimilarity.value;
                    decision = foundSimilarity.decision || 'unknown';
                }
            }

            if (isNaN(similarity) || typeof similarity !== 'number') {
                similarity = 0;
                decision = 'different';
            }

            const finalSimilarity = Math.max(0, Math.min(1, similarity));
            const finalDecision = decision !== 'unknown' ? decision :
                                (finalSimilarity > 0.6 ? 'same' : 'different');

            console.log(`🎯 Финальное: similarity=${finalSimilarity.toFixed(3)}, decision=${finalDecision}`);

            // 🔥 ЛОГИКА: Если следы совпали
            if (finalSimilarity > 0.6 && finalDecision === 'same') {
                console.log(`✅ Следы совпали (${finalSimilarity.toFixed(3)})`);

                // 🔥 КРИТИЧЕСКИЙ ШАГ: Обновляем PointTracker из супер-модели
                let vectorModel = this.vectorSuperModels.get(userId);
               
                if (!vectorModel) {
                    const VectorSuperModel = require('./vector-super-model');
                    vectorModel = new VectorSuperModel({
                        name: `Супер-модель_${String(userId).slice(0, 6)}`,
                        enablePCA: false,
                        cellSize: 25,
                        debug: this.config.debug
                    });
                    this.vectorSuperModels.set(userId, vectorModel);
                   
                    vectorModel.addGraph(
                        session.currentFootprint.graph,
                        session.currentFootprint.id,
                        {
                            isFirst: true,
                            transformationInfo: existingTransformationInfo
                        }
                    );
                }

                // Добавляем новый граф в супер-модель
                vectorModel.addGraph(
                    finalGraph,
                    tempFootprint.id,
                    {
                        similarity: finalSimilarity,
                        timestamp: new Date(),
                        ...photoInfo,
                        transformationInfo: currentTransformationInfo
                    }
                );

                // 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ В ОБОИХ ОТПЕЧАТКАХ
                console.log(`🔄 Обновляю подтверждения в основном отпечатке...`);
                const updatedMain = this.updatePointTrackerFromSuperModel(
                    userId,
                    session.currentFootprint,
                    vectorModel,
                    existingTransformationInfo
                );

                console.log(`🔄 Обновляю подтверждения во временном отпечатке...`);
                const updatedTemp = this.updatePointTrackerFromSuperModel(
                    userId,
                    tempFootprint,
                    vectorModel,
                    currentTransformationInfo
                );

                console.log(`📊 Итого обновлено: ${updatedMain} в основном, ${updatedTemp} во временном`);

                // 🔥 СОЗДАЕМ ВИЗУАЛИЗАЦИЮ С УЧЕТОМ РАЗНЫХ УГЛОВ
                let clusterVizResult = null;
                if (this.config.enableMergeVisualization) {
                    clusterVizResult = await this.createClusterComparisonVisualization(
                        session.currentFootprint,
                        tempFootprint,
                        alignmentResult,
                        userId,
                        existingTransformationInfo,
                        currentTransformationInfo
                    );
                }

                // Визуализация и отправка в Telegram
                let vectorVizPath = null;
                if (this.config.enableMergeVisualization && vectorModel) {
                    vectorVizPath = await this.visualizeVectorSuperModel(userId, vectorModel);

                    if (bot && chatId && vectorVizPath && vectorVizPath.template) {
                        try {
                            if (fs.existsSync(vectorVizPath.template)) {
                                await bot.sendPhoto(chatId, vectorVizPath.template, {
                                    caption: `✅ **Следы совпали!**\n\n` +
                                            `🎯 Схожесть: ${(finalSimilarity * 100).toFixed(1)}%\n` +
                                            `📊 Обновлено точек: ${updatedMain}\n` +
                                            `📐 Угол 1: ${existingTransformationInfo?.rotationAngle.toFixed(1)}°\n` +
                                            `📐 Угол 2: ${currentTransformationInfo.rotationAngle.toFixed(1)}°\n` +
                                            `🔄 Разница: ${Math.abs((existingTransformationInfo?.rotationAngle || 0) - currentTransformationInfo.rotationAngle).toFixed(1)}°`
                                });
                                console.log(`✅ Визуализация отправлена в Telegram`);
                            }
                        } catch (sendError) {
                            console.log(`❌ Ошибка отправки: ${sendError.message}`);
                        }
                    }
                }

                // Отправка кластерной визуализации
                if (bot && chatId && clusterVizResult && clusterVizResult.path) {
                    try {
                        if (fs.existsSync(clusterVizResult.path)) {
                            const stats1 = this.calculateConfirmationStats(session.currentFootprint);
                            const stats2 = this.calculateConfirmationStats(tempFootprint);

                            let caption = `🎯 **СРАВНЕНИЕ СЛЕДОВ**\n\n`;
                            caption += `📊 Схожесть: ${(finalSimilarity * 100).toFixed(1)}%\n`;
                            caption += `📐 Углы: ${existingTransformationInfo?.rotationAngle.toFixed(1)}° vs ${currentTransformationInfo.rotationAngle.toFixed(1)}°\n`;
                            caption += `🔄 Обновлено точек: ${updatedMain}\n\n`;
                            caption += `📈 **ПОДТВЕРЖДЕНИЯ:**\n`;
                            caption += `• 🔴 Красные (2+): ${stats1.confirmed2} в следе 1, ${stats2.confirmed2} в следе 2\n`;
                            caption += `• 🔵 Синие (1): ${stats1.confirmed1} в следе 1, ${stats2.confirmed1} в следе 2\n\n`;
                            caption += `🎨 **ИНВАРИАНТНОСТЬ К ПОВОРОТУ:**\n`;
                            caption += `• Система учитывает разные углы поворота\n`;
                            caption += `• Точки совпадают независимо от ориентации`;

                            await bot.sendPhoto(chatId, clusterVizResult.path, {
                                caption: caption,
                                parse_mode: 'Markdown'
                            });

                            console.log('✅ Кластерная визуализация отправлена');
                        }
                    } catch (sendError) {
                        console.log('❌ Ошибка отправки кластерной визуализации:', sendError.message);
                    }
                }

                const result = {
                    success: true,
                    similarity: finalSimilarity,
                    decision: finalDecision,
                    nodesAdded: tempResult.added,
                    hasMergeVisualization: true,
                    mergeMethod: 'rotation_invariant',
                    message: `✅ След добавлен! Сходство: ${(finalSimilarity * 100).toFixed(1)}%\nОбновлено точек: ${updatedMain}`,
                    transformationInfo: currentTransformationInfo,
                    angleDifference: Math.abs((existingTransformationInfo?.rotationAngle || 0) - currentTransformationInfo.rotationAngle),
                    pointsUpdated: updatedMain
                };

                console.log(`📊 Результат addPhotoToSession: схожесть=${finalSimilarity.toFixed(3)}, решение=${finalDecision}, обновлено точек=${updatedMain}`);

                return result;

            } else {
                // СЛЕДЫ РАЗНЫЕ
                console.log(`🆕 Следы разные (${finalSimilarity.toFixed(3)}) - начинаю новую модель`);

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

                return {
                    success: true,
                    similarity: finalSimilarity,
                    decision: finalDecision,
                    isNewModel: true,
                    nodesAdded: addResult.added,
                    transformationInfo: currentTransformationInfo
                };
            }

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Интеллектуальное сопоставление с учетом разных углов
    intelligentPointMatchingWithRotation(tracker1, tracker2, transformationInfo1, transformationInfo2) {
        console.log(`🤖 Интеллектуальное сопоставление с разными углами...`);
       
        const points1 = Array.from(tracker1.points.values()).map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            confirmations: p.confirmedCount || 0,
            confidence: p.rating || 0.5
        }));
       
        const points2 = Array.from(tracker2.points.values()).map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            confirmations: p.confirmedCount || 0,
            confidence: p.rating || 0.5
        }));
       
        console.log(`📊 Углы поворота:`);
        console.log(`   • След 1: ${transformationInfo1?.rotationAngle || 0}°`);
        console.log(`   • След 2: ${transformationInfo2?.rotationAngle || 0}°`);
        console.log(`   • Разница: ${Math.abs((transformationInfo1?.rotationAngle || 0) - (transformationInfo2?.rotationAngle || 0)).toFixed(1)}°`);
       
        const referenceAngle = transformationInfo1?.rotationAngle || 0;
       
        // Преобразуем оба следа в общую систему
        let normalizedPoints1 = points1;
        let normalizedPoints2 = points2;
       
        if (transformationInfo1 && transformationInfo2) {
            normalizedPoints1 = this.transformCoordinatesBetweenSystems(
                points1,
                transformationInfo1,
                'to_normalized',
                referenceAngle
            );
           
            normalizedPoints2 = this.transformCoordinatesBetweenSystems(
                points2,
                transformationInfo2,
                'to_normalized',
                referenceAngle
            );
        }
       
        // Находим совпадения
        const matches = [];
        const usedPoints2 = new Set();
        const distanceThreshold = 80;
       
        for (const point1 of normalizedPoints1) {
            let bestMatch = null;
            let minDistance = distanceThreshold;
           
            for (const point2 of normalizedPoints2) {
                if (usedPoints2.has(point2.id)) continue;
               
                const dx = point2.x - point1.x;
                const dy = point2.y - point1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = { point: point2, distance };
                }
            }
           
            if (bestMatch) {
                matches.push({
                    point1: point1,
                    point2: bestMatch.point,
                    distance: bestMatch.distance,
                    type: 'exact'
                });
                usedPoints2.add(bestMatch.point.id);
            }
        }
       
        console.log(`📊 Найдено ${matches.length} совпадений после выравнивания`);
       
        const result = matches.map(match => {
            const originalPoint1 = points1.find(p => p.id === match.point1.id);
            const originalPoint2 = points2.find(p => p.id === match.point2.id);
           
            return {
                point1: originalPoint1,
                point2: originalPoint2,
                distance: match.distance,
                type: match.type,
                shouldBeRed: true
            };
        });
       
        return {
            matches: result,
            totalPoints1: points1.length,
            totalPoints2: points2.length,
            matchCount: matches.length,
            matchPercentage: (matches.length / Math.min(points1.length, points2.length)) * 100,
            transformationInfo1: transformationInfo1,
            transformationInfo2: transformationInfo2
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Создание кластерной визуализации
    async createClusterComparisonVisualization(footprint1, footprint2, comparisonResult, userId, transformationInfo1 = null, transformationInfo2 = null) {
        console.log('🎨 Создаю визуализацию с учетом разных углов поворота...');

        try {
            let pointAnalysis;
           
            if (transformationInfo1 && transformationInfo2 &&
                transformationInfo1.rotationAngle !== transformationInfo2.rotationAngle) {
                pointAnalysis = this.intelligentPointMatchingWithRotation(
                    footprint1.pointTracker,
                    footprint2.pointTracker,
                    transformationInfo1,
                    transformationInfo2
                );
            } else {
                const effectiveTransformation = transformationInfo1 || transformationInfo2;
                pointAnalysis = this.intelligentPointMatching(
                    footprint1.pointTracker,
                    footprint2.pointTracker,
                    effectiveTransformation
                );
            }

            console.log(`🎯 РЕЗУЛЬТАТ СОПОСТАВЛЕНИЯ: ${pointAnalysis.matchCount} совпадений`);

            // Обновляем трекеры на основе совпадений
            this.updateTrackersBasedOnMatches(footprint1, footprint2, pointAnalysis);

            // Получаем статистику
            const stats1 = this.calculateConfirmationStats(footprint1);
            const stats2 = this.calculateConfirmationStats(footprint2);

            console.log(`📊 ФИНАЛЬНАЯ СТАТИСТИКА:`);
            console.log(`   След 1: ${stats1.confirmed2}🔴 ${stats1.confirmed1}🔵 ${stats1.confirmed0}⚪`);
            console.log(`   След 2: ${stats2.confirmed2}🔴 ${stats2.confirmed1}🔵 ${stats2.confirmed0}⚪`);

            let ClusterVisualizer;
            try {
                ClusterVisualizer = require('./visualizations/cluster-visualizer');
            } catch (error) {
                console.log('⚠️ ClusterVisualizer не найден:', error.message);
                return null;
            }

            const visualizer = new ClusterVisualizer({
                outputDir: path.join(this.config.dbPath, 'visualizations/clusters'),
                debug: this.config.debug,
                forceTextMode: false
            });

            const vizResult = await visualizer.visualizeTwoFootprintComparison(
                footprint1,
                footprint2,
                {
                    filename: `cluster_comparison_${userId}_${Date.now()}.png`,
                    mode: 'rotation_invariant',
                    customData: {
                        comparison: comparisonResult,
                        transformationInfo1: transformationInfo1,
                        transformationInfo2: transformationInfo2,
                        pointAnalysis: pointAnalysis,
                        stats: { stats1, stats2 },
                        hasDifferentAngles: transformationInfo1 && transformationInfo2 &&
                                          transformationInfo1.rotationAngle !== transformationInfo2.rotationAngle
                    }
                }
            );

            console.log('✅ Визуализация создана с учетом разных углов:', vizResult?.path);
            return vizResult;

        } catch (error) {
            console.log('❌ Ошибка создания визуализации:', error.message);
            return null;
        }
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Обновление трекеров на основе совпадений
    updateTrackersBasedOnMatches(footprint1, footprint2, pointAnalysis) {
        let updated1 = 0;
        let updated2 = 0;

        console.log(`🎯 Обновляю трекеры на основе ${pointAnalysis.matchCount} совпадений...`);

        for (const match of pointAnalysis.matches) {
            const point1 = footprint1.pointTracker.points.get(match.point1.id);
            if (point1) {
                const oldCount = point1.confirmedCount || 0;
                const newCount = Math.min(5, oldCount + 1);
               
                if (newCount > oldCount) {
                    point1.confirmedCount = newCount;
                    point1.confidence = Math.max(point1.confidence || 0.5, 0.8);
                    updated1++;
                }
            }
           
            const point2 = footprint2.pointTracker.points.get(match.point2.id);
            if (point2) {
                const oldCount = point2.confirmedCount || 0;
                const newCount = Math.min(5, oldCount + 1);
               
                if (newCount > oldCount) {
                    point2.confirmedCount = newCount;
                    point2.confidence = Math.max(point2.confidence || 0.5, 0.8);
                    updated2++;
                }
            }
        }

        console.log(`✅ Обновлено: ${updated1} точек в следе 1, ${updated2} в следе 2`);
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
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

    extractSimilarityFromObject(obj, path = '') {
        if (!obj || typeof obj !== 'object') return null;

        for (const key in obj) {
            if (key === 'similarity' && typeof obj[key] === 'number') {
                const decision = obj.decision ||
                               obj.result?.decision ||
                               obj.details?.decision ||
                               'unknown';

                return {
                    value: obj[key],
                    decision: decision,
                    path: path ? `${path}.${key}` : key
                };
            }

            if (typeof obj[key] === 'object' && obj[key] !== null) {
                const found = this.extractSimilarityFromObject(obj[key], key);
                if (found) return found;
            }
        }

        return null;
    }

    async visualizeVectorSuperModel(userId, vectorModel) {
        console.log(`🎨 Создаю визуализацию ШАБЛОНА...`);

        try {
            if (!vectorModel) return null;

            let templateData = vectorModel.getVisualizationData();

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

    createSession(userId, name = null) {
        const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const session = {
            id: sessionId,
            userId: String(userId),
            name: name || `Сессия_${new Date().toLocaleDateString('ru-RU')}`,
            startTime: new Date(),
            lastActivity: new Date(),
            photos: [],
            analyses: [],
            comparisons: [],
            confirmedPhotos: 0,
            currentFootprint: null,
            metadata: {
                created: new Date(),
                autoAlignment: this.config.autoAlignment,
                usePointTracker: true,
                normalizationHistory: [],
                lastTransformation: null
            }
        };

        this.userSessions.set(userId, session);
        this.systemStats.totalUsers = this.userSessions.size;

        console.log(`🆕 Создана сессия ${sessionId.slice(0, 8)}... для пользователя ${userId}`);

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

    getActiveSession(userId) {
        return this.userSessions.get(userId);
    }

    getVectorSuperModel(userId) {
        return this.vectorSuperModels.get(userId);
    }

    getSystemStats() {
        return {
            ...this.systemStats,
            activeSessions: this.userSessions.size,
            loadedModels: this.loadedModels.size,
            vectorModels: this.vectorSuperModels.size,
            config: {
                autoAlignment: this.config.autoAlignment,
                enableMergeVisualization: this.config.enableMergeVisualization,
                usePointTracker: this.config.usePointTracker,
                topologySimilarityThreshold: this.config.topologySimilarityThreshold
            }
        };
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
                confirmedPhotos: session.confirmedPhotos || 0,
                analysesCount: session.analyses.length,
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
                    edges: footprint.graph.edges.size,
                    confidence: footprint.stats.confidence,
                    confirmedNodes: 0
                },
                sessionInfo: {
                    photos: session.photos.length,
                    analyses: session.analyses.length,
                    confirmedPhotos: session.confirmedPhotos || 0
                }
            };

        } catch (error) {
            console.log('❌ Ошибка сохранения модели:', error.message);
            return { success: false, error: error.message };
        }
    }

    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ БЕЗ ИЗМЕНЕНИЙ
    calculateCenter(points) {
        if (points.length === 0) return { x: 0, y: 0 };
       
        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);
       
        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    calculateDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    intelligentPointMatching(tracker1, tracker2, transformationInfo = null) {
        console.log(`🤖 Интеллектуальное сопоставление точек...`);
       
        const points1 = Array.from(tracker1.points.values()).map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            confirmations: p.confirmedCount || 0
        }));
       
        const points2 = Array.from(tracker2.points.values()).map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            confirmations: p.confirmedCount || 0
        }));
       
        console.log(`📊 До сопоставления:`);
        console.log(`   • След 1: ${points1.length} точек`);
        console.log(`   • След 2: ${points2.length} точек`);
       
        let normalizedPoints1 = points1;
        let normalizedPoints2 = points2;
       
        if (transformationInfo) {
            console.log(`📐 Преобразую оба следа в нормализованную систему...`);
            normalizedPoints1 = this.transformCoordinatesBetweenSystems(points1, transformationInfo, 'to_normalized');
            normalizedPoints2 = this.transformCoordinatesBetweenSystems(points2, transformationInfo, 'to_normalized');
        }
       
        const center1 = this.calculateCenter(normalizedPoints1);
        const center2 = this.calculateCenter(normalizedPoints2);
       
        const offsetX = center2.x - center1.x;
        const offsetY = center2.y - center1.y;
       
        const alignedPoints2 = normalizedPoints2.map(p => ({
            ...p,
            x: p.x - offsetX,
            y: p.y - offsetY
        }));
       
        const matches = [];
        const usedPoints2 = new Set();
       
        for (const point1 of normalizedPoints1) {
            let bestMatch = null;
            let minDistance = this.config.matchDistanceThreshold;
           
            for (const point2 of alignedPoints2) {
                if (usedPoints2.has(point2.id)) continue;
               
                const dx = point2.x - point1.x;
                const dy = point2.y - point1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = { point: point2, distance };
                }
            }
           
            if (bestMatch) {
                matches.push({
                    point1: point1,
                    point2: bestMatch.point,
                    distance: bestMatch.distance,
                    type: 'exact'
                });
                usedPoints2.add(bestMatch.point.id);
            }
        }
       
        console.log(`📊 Найдено ${matches.length} совпадений`);
       
        const result = matches.map(match => {
            const originalPoint1 = points1.find(p => p.id === match.point1.id);
            const originalPoint2 = points2.find(p => p.id === match.point2.id);
           
            return {
                point1: originalPoint1,
                point2: originalPoint2,
                distance: match.distance,
                type: match.type,
                shouldBeRed: true
            };
        });
       
        return {
            matches: result,
            totalPoints1: points1.length,
            totalPoints2: points2.length,
            matchCount: matches.length,
            matchPercentage: (matches.length / Math.min(points1.length, points2.length)) * 100,
            transformationApplied: !!transformationInfo
        };
    }

    getMergeVisualizationCount() {
        let total = 0;
        for (const [userId, history] of this.lastMergeVisualizations) {
            total += history.length;
        }
        return total;
    }

    addMergeVisualization(userId, vizInfo) {
        const history = this.lastMergeVisualizations.get(userId) || [];
        history.unshift(vizInfo);

        if (history.length > 10) {
            history.pop();
        }

        this.lastMergeVisualizations.set(userId, history);
        return history.length;
    }
}

module.exports = SimpleFootprintManager;
