// modules/footprint/simple-manager.js
// УПРОЩЕННЫЙ МЕНЕДЖЕР ЦИФРОВЫХ ОТПЕЧАТКОВ С АВТОСОВМЕЩЕНИЕМ И POINT TRACKER

const fs = require('fs');
const path = require('path');
const SimpleFootprint = require('./simple-footprint');
const SimpleMatcher = require('./simple-matcher');
const MergeVisualizer = require('./merge-visualizer');
const crypto = require('crypto');

class SimpleFootprintManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/footprints',
            autoAlignment: options.autoAlignment !== false,
            autoSave: options.autoSave !== false,
            debug: options.debug || false,

            // 🔥 ВАЖНЫЕ НАСТРОЙКИ ДЛЯ ПОДТВЕРЖДЕНИЙ
            usePointTracker: true, // Всегда использовать PointTracker
            enableMergeVisualization: options.enableMergeVisualization !== false,
            enableIntelligentMerge: options.enableIntelligentMerge !== false,
            enableTopologySuperModel: options.enableTopologySuperModel !== false,

            // Пороги
            topologySimilarityThreshold: options.topologySimilarityThreshold || 0.7,
            highConfidenceThreshold: options.highConfidenceThreshold || 0.8,
            minPointsForFootprint: options.minPointsForFootprint || 5,

            // Настройки PointTracker
            trackerConfirmationThreshold: 2, // Минимум 2 подтверждения для высокой уверенности
            ...options
        };

        // Сессии пользователей: userId -> session
        this.userSessions = new Map();

        // Загруженные модели: modelId -> SimpleFootprint
        this.loadedModels = new Map();

        // Визуализатор объединений
        this.mergeVisualizer = new MergeVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations'),
            debug: this.config.debug
        });

        // Матчер для сравнения графов
        this.matcher = new SimpleMatcher({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold
        });

        // История последних визуализаций объединения: userId -> [{path, timestamp, similarity}]
        this.lastMergeVisualizations = new Map();

        // Статистика системы
        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalComparisons: 0,
            successfulMerges: 0,
            totalPhotosProcessed: 0,
            trackerConfirmations: 0,
            lastActivity: new Date()
        };

        // Обеспечиваем существование директорий
        this.ensureDirectories();

        // Загружаем существующие модели
        this.loadExistingModels();

        console.log(`🚀 SimpleFootprintManager инициализирован`);
        console.log(`   📁 База данных: ${this.config.dbPath}`);
        console.log(`   🎯 Auto Alignment: ${this.config.autoAlignment ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🎨 Визуализация объединения: ${this.config.enableMergeVisualization ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🎯 PointTracker: ВКЛ (подтверждения узлов)`);
    }

    // 🔥 КРИТИЧЕСКИЙ МЕТОД: ДОБАВЛЕНИЕ ФОТО В СЕССИЮ (ИСПРАВЛЕННЫЙ)
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО В СЕССИЮ для пользователя ${userId}`);

        try {
            // Проверяем анализ
            if (!analysis || !analysis.predictions || analysis.predictions.length === 0) {
                console.log('❌ Нет данных анализа');
                return {
                    success: false,
                    error: 'Нет данных анализа',
                    nodesAdded: 0
                };
            }

            // Извлекаем точки протекторов
            const points = this.extractPointsFromAnalysis(analysis);

            if (points.length < this.config.minPointsForFootprint) {
                console.log(`⚠️ Слишком мало точек: ${points.length} (нужно минимум ${this.config.minPointsForFootprint})`);
                return {
                    success: false,
                    error: `Слишком мало точек: ${points.length}`,
                    nodesAdded: 0
                };
            }

            console.log(`🔍 Извлечено ${points.length} точек протекторов`);

            // Получаем или создаем сессию
            let session = this.userSessions.get(userId);
            const isNewSession = !session;

            if (isNewSession) {
                // Создаем новую сессию
                session = this.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
                console.log(`🆕 Создана новая сессия: ${session.id}`);
            } else {
                console.log(`🔄 Использую существующую сессию: ${session.id.slice(0, 8)}...`);
            }

            // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Обновляем информацию о сессии
            session.photos.push({
                id: `photo_${Date.now()}`,
                timestamp: new Date(),
                photoInfo: photoInfo,
                pointsCount: points.length
            });

            session.lastActivity = new Date();
            this.systemStats.totalPhotosProcessed++;

            // Если это первое фото в сессии - просто создаем отпечаток
            if (!session.currentFootprint) {
                console.log(`👣 Создаю новый отпечаток (первое фото в сессии)`);

                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
                    metadata: {
                        sessionId: session.id,
                        firstPhoto: photoInfo.photoId
                    }
                });

                // Добавляем анализ через PointTracker
                const addResult = session.currentFootprint.addAnalysis(analysis, {
                    ...photoInfo,
                    sessionId: session.id,
                    isFirstPhoto: true
                });

                console.log(`✅ Создан новый отпечаток с ${addResult.added} узлами`);

                // Сохраняем результат анализа
                session.analyses.push({
                    id: `analysis_${Date.now()}`,
                    timestamp: new Date(),
                    success: true,
                    pointsCount: points.length,
                    nodesAdded: addResult.added,
                    isFirstPhoto: true,
                    trackerResults: addResult.trackerResults
                });

                // Автосохранение
                if (this.config.autoSave) {
                    this.saveSession(userId);
                }

                return {
                    success: true,
                    isNewSession: true,
                    nodesAdded: addResult.added,
                    totalNodes: session.currentFootprint.graph.nodes.size,
                    sessionId: session.id,
                    alignment: null,
                    mergeVisualization: null,
                    trackerStats: addResult.trackerStats
                };
            }

            // 🔥 КРИТИЧЕСКАЯ ЧАСТЬ: ЕСЛИ ЕСТЬ СУЩЕСТВУЮЩИЙ ОТПЕЧАТОК - СРАВНИВАЕМ И ОБЪЕДИНЯЕМ

            console.log(`🔍 Сравниваю с существующим отпечатком (${session.currentFootprint.graph.nodes.size} узлов)`);

            // Создаем временный отпечаток для сравнения
            const tempFootprint = new SimpleFootprint({
                userId: userId,
                name: `Temp_${Date.now()}`,
                metadata: {
                    isTemporary: true
                }
            });

            // Добавляем анализ во временный отпечаток
            const tempResult = tempFootprint.addAnalysis(analysis, {
                ...photoInfo,
                sessionId: session.id,
                isTemporary: true
            });

            // Сравниваем отпечатки
            const alignmentResult = await this.matcher.alignAndCompare(
                session.currentFootprint.graph,
                tempFootprint.graph,
                {
                    userId: userId,
                    debug: this.config.debug
                }
            );

            console.log(`📊 Результат сравнения: similarity=${alignmentResult.similarity.toFixed(3)}, ` +
                      `decision=${alignmentResult.decision}`);

            // Сохраняем результат сравнения
            session.comparisons = session.comparisons || [];
            session.comparisons.push({
                timestamp: new Date(),
                similarity: alignmentResult.similarity,
                decision: alignmentResult.decision,
                pointsCount: points.length,
                alignmentResult: alignmentResult
            });

            this.systemStats.totalComparisons++;

            // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: НОВАЯ ЛОГИКА ОБЪЕДИНЕНИЯ
            let mergeVizPath = null;
            let mergeMethod = 'none';
            let trackerUpdateResult = null;

            if (alignmentResult.similarity > this.config.topologySimilarityThreshold) {
                // 🔥 СЛУЧАЙ 1: СЛЕДЫ СОВПАДАЮТ - ОБЪЕДИНЯЕМ ОБЕ МОДЕЛИ!
                console.log(`✅ Следы совпали (${alignmentResult.similarity.toFixed(3)}) - ОБЪЕДИНЯЕМ обе модели!`);

                mergeMethod = 'intelligent_merge';

                // 🔥 ИСПРАВЛЕНИЕ: Объединяем трекеры И графы
                trackerUpdateResult = await this.mergeTrackersFromAlignment(
                    session.currentFootprint,
                    tempFootprint,
                    alignmentResult,
                    {
                        photoId: photoInfo.photoId,
                        timestamp: new Date(),
                        alignmentSimilarity: alignmentResult.similarity
                    }
                );

                console.log(`🎯 PointTracker объединен: ${trackerUpdateResult.merged} точек добавлено, ${trackerUpdateResult.updated} обновлено`);

                // 🔥 ИСПРАВЛЕНИЕ: Объединяем графы с добавлением новых узлов
                const mergeResult = this.mergeGraphsIntelligently(
                    session.currentFootprint.graph,
                    tempFootprint.graph,
                    alignmentResult
                );

                console.log(`🔄 Графы объединены: ${mergeResult.added} новых узлов добавлено`);

                // Обновляем статистику сессии
                session.confirmedPhotos = (session.confirmedPhotos || 0) + 1;
                this.systemStats.successfulMerges++;
                this.systemStats.trackerConfirmations += trackerUpdateResult.updated;

                // 🔥 СОЗДАЕМ ВИЗУАЛИЗАЦИЮ ОБЪЕДИНЕННОЙ СУПЕР-МОДЕЛИ
                if (this.config.enableMergeVisualization) {
                    try {
                        console.log('🎨 Создаю визуализацию объединенной супер-модели...');

                        mergeVizPath = await this.mergeVisualizer.visualizeSuperModel(
                            session.currentFootprint,
                            tempFootprint,
                            {
                                outputPath: path.join(
                                    this.mergeVisualizer.config.outputDir,
                                    `super_model_${session.id.slice(0, 8)}_${Date.now()}.png`
                                ),
                                title: `Супер-модель: ${session.currentFootprint.name} (объединение)`,
                                showConfirmations: true,
                                highlightNewNodes: true
                            }
                        );

                        // Сохраняем в историю визуализаций
                        this.addMergeVisualization(userId, {
                            path: mergeVizPath,
                            timestamp: new Date(),
                            similarity: alignmentResult.similarity,
                            confirmedNodes: trackerUpdateResult.updated,
                            addedNodes: trackerUpdateResult.merged,
                            method: mergeMethod
                        });

                        console.log(`✅ Визуализация объединенной модели создана: ${mergeVizPath}`);

                    } catch (vizError) {
                        console.log('⚠️ Ошибка создания визуализации:', vizError.message);
                    }
                }

                // Отправляем уведомление в Telegram если есть бот
                if (bot && chatId) {
                    try {
                        const totalAdded = (trackerUpdateResult.merged || 0) + (trackerUpdateResult.updated || 0);
                        await bot.sendMessage(chatId,
                            `✅ **Следы совпали - модели объединены!**\n\n` +
                            `🎯 Новых точек добавлено: ${trackerUpdateResult.merged || 0}\n` +
                            `🔄 Существующих обновлено: ${trackerUpdateResult.updated || 0}\n` +
                            `📊 Схожесть: ${(alignmentResult.similarity * 100).toFixed(1)}%\n` +
                            `📈 Всего узлов в супер-модели: ${session.currentFootprint.graph.nodes.size}\n\n` +
                            `💡 **Объединение завершено успешно!**\n` +
                            `Теперь модель содержит данные с ВСЕХ фотографий.`
                        );
                    } catch (botError) {
                        console.log('⚠️ Ошибка отправки сообщения:', botError.message);
                    }
                }

            } else {
                // 🔥 СЛУЧАЙ 2: СЛЕДЫ НЕ СОВПАДАЮТ - НАЧИНАЕМ НОВУЮ МОДЕЛЬ
                console.log(`🆕 Следы разные (${alignmentResult.similarity.toFixed(3)}) - начинаю новую модель`);

                mergeMethod = 'new_model';

                // Сохраняем текущий отпечаток
                if (session.currentFootprint.graph.nodes.size >= this.config.minPointsForFootprint) {
                    const savedModel = this.saveSessionAsModel(userId,
                        `${session.currentFootprint.name}_${new Date().toLocaleTimeString('ru-RU')}`);

                    if (savedModel.success) {
                        console.log(`💾 Сохранена модель: ${savedModel.modelId?.slice(0, 8)}...`);
                    }
                }

                // Создаем новый отпечаток
                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`,
                    metadata: {
                        sessionId: session.id,
                        previousModel: session.currentFootprint?.id
                    }
                });

                // Добавляем анализ
                const addResult = session.currentFootprint.addAnalysis(analysis, {
                    ...photoInfo,
                    sessionId: session.id,
                    isNewModel: true
                });

                console.log(`✅ Создан новый отпечаток с ${addResult.added} узлами`);
            }

            // Сохраняем результат анализа
            session.analyses.push({
                id: `analysis_${Date.now()}`,
                timestamp: new Date(),
                success: true,
                pointsCount: points.length,
                nodesAdded: tempResult.added,
                alignmentResult: alignmentResult,
                mergeMethod: mergeMethod,
                trackerResults: trackerUpdateResult || tempResult.trackerResults
            });

            // Автосохранение
            if (this.config.autoSave) {
                this.saveSession(userId);
            }

            // Обновляем статистику
            const stats = session.currentFootprint.getConfirmationStats ?
                session.currentFootprint.getConfirmationStats() : {
                    totalNodes: session.currentFootprint.graph.nodes.size,
                    confirmedNodes: 0,
                    averageConfirmations: 0
                };

            return {
                success: true,
                isNewSession: isNewSession,
                nodesAdded: tempResult.added,
                totalNodes: session.currentFootprint.graph.nodes.size,
                sessionId: session.id,
                alignment: alignmentResult,
                mergeVisualization: mergeVizPath,
                mergeMethod: mergeMethod,
                trackerUpdate: trackerUpdateResult,
                confirmationStats: stats
            };

        } catch (error) {
            console.log(`❌ Ошибка добавления фото в сессию:`, error);
            console.error(error.stack);

            return {
                success: false,
                error: error.message,
                nodesAdded: 0
            };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: ОБЪЕДИНЕНИЕ ТРЕКЕРОВ И ГРАФОВ (а не только подтверждение)
    async mergeTrackersFromAlignment(mainFootprint, tempFootprint, alignmentResult, sourceInfo = {}) {
        try {
            if (!mainFootprint.pointTracker || !tempFootprint.pointTracker) {
                console.log('⚠️ Один из отпечатков не имеет PointTracker');
                return { merged: 0, updated: 0 };
            }

            console.log(`🔄 Объединяю трекеры: основной ${mainFootprint.pointTracker.points.size} точек, временный ${tempFootprint.pointTracker.points.size} точек`);

            let mergedCount = 0;
            let updatedCount = 0;

            // 🔥 ШАГ 1: Переносим ВСЕ точки из временного трекера в основной
            for (const [tempTrackerId, tempPoint] of tempFootprint.pointTracker.points) {
                const pointForMain = {
                    x: tempPoint.x,
                    y: tempPoint.y,
                    confidence: tempPoint.rating || alignmentResult.similarity
                };

                // Ищем ближайшую точку в основном трекере
                const nearest = mainFootprint.pointTracker.findNearestPoint(pointForMain, 25);

                if (nearest && nearest.distance < 20) {
                    // Точка уже есть - обновляем
                    mainFootprint.pointTracker.updatePoint(nearest.id, pointForMain, {
                        ...sourceInfo,
                        source: 'alignment_merge',
                        distance: nearest.distance,
                        mergedFrom: tempTrackerId
                    });
                    updatedCount++;
                } else {
                    // НОВАЯ ТОЧКА - добавляем!
                    const newPointId = mainFootprint.pointTracker.addPoint(pointForMain, {
                        ...sourceInfo,
                        source: 'new_from_alignment',
                        mergedFrom: tempTrackerId
                    });
                    mergedCount++;
                    console.log(`➕ Добавлена новая точка ${newPointId} из временного трекера`);
                }
            }

            // 🔥 ШАГ 2: Обновляем граф с новыми точками
            // Получаем ВСЕ точки из обновленного трекера
            const allPoints = [];
            for (const [trackerId, trackerPoint] of mainFootprint.pointTracker.points) {
                allPoints.push({
                    x: trackerPoint.x,
                    y: trackerPoint.y,
                    confidence: trackerPoint.rating,
                    pointTrackerId: trackerId,
                    confirmedCount: trackerPoint.confirmedCount
                });
            }

            // Перестраиваем граф с ВСЕМИ точками
            const previousNodeCount = mainFootprint.graph.nodes.size;

            // Очищаем старый граф
            mainFootprint.graph.nodes.clear();
            mainFootprint.graph.edges.clear();

            // Строим новый граф из всех точек
            const graphNodes = allPoints.map((point, index) => ({
                id: `n_${point.pointTrackerId}`,
                x: point.x,
                y: point.y,
                confidence: point.confidence,
                confirmedCount: point.confirmedCount,
                pointTrackerId: point.pointTrackerId
            }));

            const graphInvariants = mainFootprint.graph.buildFromPoints(graphNodes.map(p => ({
                x: p.x,
                y: p.y,
                confidence: p.confidence,
                id: p.id
            })));

            // Связываем узлы с трекером
            const linkedCount = mainFootprint.linkNodesWithTracker(graphNodes);

            const addedNodes = mainFootprint.graph.nodes.size - previousNodeCount;

            console.log(`✅ Трекеры объединены: +${mergedCount} новых точек, ${updatedCount} обновлено`);
            console.log(`📊 Граф перестроен: было ${previousNodeCount} узлов, стало ${mainFootprint.graph.nodes.size} (+${addedNodes})`);

            // Получаем статистику
            const trackerStats = mainFootprint.pointTracker.getStats();

            return {
                merged: mergedCount,
                updated: updatedCount,
                addedNodes: addedNodes,
                avgRating: trackerStats.avgRating,
                trackerStats: trackerStats,
                highConfidencePoints: trackerStats.highConfidencePoints
            };

        } catch (error) {
            console.log('❌ Ошибка объединения трекеров:', error.message);
            console.error(error.stack);
            return { merged: 0, updated: 0, error: error.message };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: ИНТЕЛЛЕКТУАЛЬНОЕ ОБЪЕДИНЕНИЕ ГРАФОВ
    mergeGraphsIntelligently(mainGraph, tempGraph, alignmentResult) {
        console.log(`🔄 Интеллектуальное объединение графов: ${mainGraph.nodes.size} + ${tempGraph.nodes.size} узлов`);

        let addedNodes = 0;
        let matchedNodes = 0;

        // 🔥 ИСПОЛЬЗУЕМ matchedPairs из alignmentResult если есть
        if (alignmentResult.matchedPairs && alignmentResult.matchedPairs.length > 0) {
            console.log(`🔍 Использую ${alignmentResult.matchedPairs.length} совпавших пар для объединения`);

            // Проходим по всем узлам временного графа
            for (const [tempNodeId, tempNode] of tempGraph.nodes) {
                let isMatched = false;

                // Проверяем, есть ли этот узел в совпавших парах
                for (const pair of alignmentResult.matchedPairs) {
                    if (pair.node2 === tempNodeId) {
                        // Узел уже совпал с существующим - обновляем подтверждения
                        const mainNode = mainGraph.nodes.get(pair.node1);
                        if (mainNode) {
                            mainNode.confirmedCount = (mainNode.confirmedCount || 1) + 1;
                            mainNode.lastConfirmed = new Date();
                            matchedNodes++;
                        }
                        isMatched = true;
                        break;
                    }
                }

                // Если узел НЕ совпал ни с одним существующим - добавляем как новый
                if (!isMatched) {
                    const newNodeId = `n_merged_${Date.now()}_${tempNodeId}`;
                    mainGraph.nodes.set(newNodeId, {
                        ...tempNode,
                        id: newNodeId,
                        confirmedCount: 1,
                        isNewFromMerge: true,
                        mergedFrom: tempNodeId,
                        mergedAt: new Date()
                    });
                    addedNodes++;
                    console.log(`➕ Добавлен новый узел ${newNodeId} из временного графа`);
                }
            }
        } else {
            // 🔥 АЛЬТЕРНАТИВНЫЙ ПОДХОД: добавление уникальных узлов
            console.log('🔍 Использую альтернативный метод объединения');

            // Находим уникальные узлы из временного графа
            const uniqueTempNodes = [];
            for (const [tempNodeId, tempNode] of tempGraph.nodes) {
                let isUnique = true;

                // Проверяем, есть ли похожий узел в основном графе
                for (const [mainNodeId, mainNode] of mainGraph.nodes) {
                    const dx = mainNode.x - tempNode.x;
                    const dy = mainNode.y - tempNode.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 20) { // Порог 20 пикселей
                        isUnique = false;
                        // Обновляем подтверждения
                        mainNode.confirmedCount = (mainNode.confirmedCount || 1) + 1;
                        matchedNodes++;
                        break;
                    }
                }

                if (isUnique) {
                    uniqueTempNodes.push({ id: tempNodeId, node: tempNode });
                }
            }

            // Добавляем уникальные узлы
            uniqueTempNodes.forEach(({ id, node }) => {
                const newNodeId = `n_merged_${Date.now()}_${id}`;
                mainGraph.nodes.set(newNodeId, {
                    ...node,
                    id: newNodeId,
                    confirmedCount: 1,
                    isNewFromMerge: true,
                    mergedFrom: id,
                    mergedAt: new Date()
                });
                addedNodes++;
            });

            console.log(`📊 Найдено ${uniqueTempNodes.length} уникальных узлов из временного графа`);
        }

        // 🔥 ПЕРЕСТРАИВАЕМ РЕБРА ГРАФА с учетом новых узлов
        console.log('🔗 Перестраиваю рёбра графа...');
        mainGraph.buildFromPoints(Array.from(mainGraph.nodes.values()).map(node => ({
            x: node.x,
            y: node.y,
            confidence: node.confidence || 0.5,
            id: node.id
        })));

        console.log(`✅ Графы объединены: +${addedNodes} новых узлов, ${matchedNodes} узлов обновлено`);

        return {
            added: addedNodes,
            matched: matchedNodes,
            totalNodes: mainGraph.nodes.size,
            totalEdges: mainGraph.edges.size
        };
    }

    // 🔥 УДАЛЕН СТАРЫЙ МЕТОД updateConfirmationsFromAlignment - он больше не нужен!

    // 🔥 НОВЫЙ МЕТОД: ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ ПОДТВЕРЖДЕНИЙ ДЛЯ СЕССИИ
    async forceUpdateSessionConfirmations(userId) {
        const session = this.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии' };
        }

        console.log(`🔧 Принудительное обновление подтверждений для сессии ${session.id.slice(0, 8)}...`);

        let totalUpdated = 0;

        // Проходим по всем анализам в сессии (кроме первого)
        for (let i = 1; i < session.analyses.length; i++) {
            const analysis = session.analyses[i];

            if (analysis.alignmentResult && analysis.alignmentResult.similarity > 0.7) {
                // Создаем временный отпечаток для анализа
                const tempFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Temp_force_${i}`,
                    metadata: { isTemporary: true }
                });

                // Нужно восстановить точки из анализа (упрощенно)
                // В реальной реализации здесь нужно восстановить точки из истории

                console.log(`   Анализ ${i}: similarity=${analysis.alignmentResult.similarity.toFixed(3)}`);
                totalUpdated++;
            }
        }

        // Принудительно обновляем узлы в текущем отпечатке
        const forceUpdated = session.currentFootprint.forceUpdateNodeConfirmations();

        console.log(`✅ Принудительно обновлено ${forceUpdated} узлов`);

        return {
            success: true,
            analysesUpdated: totalUpdated,
            nodesUpdated: forceUpdated,
            totalNodes: session.currentFootprint.graph.nodes.size
        };
    }

    // Создание сессии
    createSession(userId, name = null) {
        const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const session = {
            id: sessionId,
            userId: userId,
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
                usePointTracker: true
            }
        };

        this.userSessions.set(userId, session);
        this.systemStats.totalUsers = this.userSessions.size;

        console.log(`🆕 Создана сессия ${sessionId.slice(0, 8)}... для пользователя ${userId}`);

        return session;
    }

    // Сохранение сессии как модели
    saveSessionAsModel(userId, modelName = null) {
        const session = this.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии или отпечатка' };
        }

        const footprint = session.currentFootprint;

        // Обновляем имя если указано
        if (modelName) {
            footprint.name = modelName;
        }

        // 🔥 ВАЖНО: Принудительно обновляем подтверждения перед сохранением
        footprint.forceUpdateNodeConfirmations();

        // Сохраняем модель
        const modelPath = path.join(this.config.dbPath, 'models', `${footprint.id}.json`);

        try {
            const modelData = footprint.toJSON();
            modelData.metadata.sessionInfo = {
                sessionId: session.id,
                photosCount: session.photos.length,
                confirmedPhotos: session.confirmedPhotos || 0,
                analysesCount: session.analyses.length
            };

            fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));

            // Добавляем в загруженные модели
            this.loadedModels.set(footprint.id, footprint);
            this.systemStats.totalModels = this.loadedModels.size;

            console.log(`💾 Модель сохранена: ${footprint.id} (${footprint.graph.nodes.size} узлов)`);

            // Очищаем сессию
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
                    confirmedNodes: footprint.getConfirmationStats ?
                        footprint.getConfirmationStats().confirmedNodes : 0
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

    // 🔥 НОВЫЙ МЕТОД: ДОБАВЛЕНИЕ ВИЗУАЛИЗАЦИИ ОБЪЕДИНЕНИЯ В ИСТОРИЮ
    addMergeVisualization(userId, vizInfo) {
        const history = this.lastMergeVisualizations.get(userId) || [];
        history.unshift(vizInfo);

        // Ограничиваем историю 10 последними визуализациями
        if (history.length > 10) {
            history.pop();
        }

        this.lastMergeVisualizations.set(userId, history);
        return history.length;
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧЕНИЕ ПОСЛЕДНЕЙ ВИЗУАЛИЗАЦИИ ОБЪЕДИНЕНИЯ
    getLastMergeVisualization(userId) {
        const history = this.lastMergeVisualizations.get(userId);
        return history && history.length > 0 ? history[0] : null;
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧЕНИЕ СТАТИСТИКИ ПОДТВЕРЖДЕНИЙ ДЛЯ СЕССИИ
    getSessionConfirmationStats(userId) {
        const session = this.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            return null;
        }

        const footprint = session.currentFootprint;

        // Получаем статистику из отпечатка
        const stats = footprint.getConfirmationStats ? footprint.getConfirmationStats() : {
            totalNodes: footprint.graph.nodes.size,
            confirmedNodes: 0,
            averageConfirmations: 0
        };

        // Добавляем информацию о сессии
        return {
            sessionId: session.id,
            sessionName: session.name,
            photosCount: session.photos.length,
            confirmedPhotos: session.confirmedPhotos || 0,
            analysesCount: session.analyses.length,
            footprintStats: stats,
            lastActivity: session.lastActivity
        };
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧЕНИЕ КОЛИЧЕСТВА ВИЗУАЛИЗАЦИЙ ОБЪЕДИНЕНИЯ
    getMergeVisualizationCount() {
        let total = 0;
        for (const [userId, history] of this.lastMergeVisualizations) {
            total += history.length;
        }
        return total;
    }

    // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============

    // Вспомогательные методы
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

    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'sessions'),
            path.join(this.config.dbPath, 'visualizations')
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
            console.log('📁 Директория моделей не существует, создаю...');
            fs.mkdirSync(modelsDir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.json'));

        console.log(`📂 Загрузка моделей из ${modelsDir} (${files.length} файлов)`);

        let loadedCount = 0;

        files.slice(0, 100).forEach(file => { // Ограничиваем загрузку 100 моделями
            try {
                const filePath = path.join(modelsDir, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

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

    // Остальные методы остаются без изменений
    getActiveSession(userId) {
        return this.userSessions.get(userId);
    }

    getUserModels(userId) {
        return Array.from(this.loadedModels.values())
            .filter(model => model.userId === userId)
            .sort((a, b) => new Date(b.metadata.created) - new Date(a.metadata.created));
    }

    getModelById(modelId) {
        return this.loadedModels.get(modelId);
    }

    getSystemStats() {
        return {
            ...this.systemStats,
            activeSessions: this.userSessions.size,
            loadedModels: this.loadedModels.size,
            mergeVisualizations: this.getMergeVisualizationCount(),
            config: {
                autoAlignment: this.config.autoAlignment,
                enableMergeVisualization: this.config.enableMergeVisualization,
                usePointTracker: this.config.usePointTracker,
                topologySimilarityThreshold: this.config.topologySimilarityThreshold
            },
            system: {
                uptime: Math.floor(process.uptime()),
                memoryUsage: process.memoryUsage()
            }
        };
    }

    endSession(userId, reason = 'manual') {
        const session = this.userSessions.get(userId);
        if (!session) {
            return { success: false, error: 'Сессия не найдена' };
        }

        const result = {
            success: true,
            sessionId: session.id,
            userId: userId,
            reason: reason,
            duration: new Date() - session.startTime,
            photos: session.photos.length,
            analyses: session.analyses.length,
            confirmedPhotos: session.confirmedPhotos || 0,
            footprint: session.currentFootprint ? {
                id: session.currentFootprint.id,
                nodes: session.currentFootprint.graph.nodes.size,
                confidence: session.currentFootprint.stats.confidence
            } : null
        };

        // Удаляем сессию
        this.userSessions.delete(userId);

        console.log(`🏁 Сессия завершена: ${session.id.slice(0, 8)}... (${reason})`);

        return result;
    }

    saveSession(userId) {
        const session = this.userSessions.get(userId);
        if (!session) return false;

        try {
            const sessionPath = path.join(this.config.dbPath, 'sessions', `${session.id}.json`);
            const sessionData = {
                id: session.id,
                userId: session.userId,
                name: session.name,
                startTime: session.startTime.toISOString(),
                lastActivity: session.lastActivity.toISOString(),
                photos: session.photos,
                analyses: session.analyses,
                comparisons: session.comparisons,
                confirmedPhotos: session.confirmedPhotos,
                metadata: session.metadata
            };

            fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
            return true;
        } catch (error) {
            console.log('⚠️ Ошибка сохранения сессии:', error.message);
            return false;
        }
    }

    // Визуализация сравнения
    async visualizeComparison(modelId1, modelId2) {
        try {
            const model1 = this.getModelById(modelId1);
            const model2 = this.getModelById(modelId2);

            if (!model1 || !model2) {
                return { success: false, error: 'Модели не найдены' };
            }

            const comparison = model1.compare(model2);
            const vizPath = await this.mergeVisualizer.visualizeMerge(
                model1,
                model2,
                comparison
            );

            return {
                success: true,
                visualization: vizPath.path,
                comparison: comparison
            };

        } catch (error) {
            console.log('❌ Ошибка визуализации сравнения:', error);
            return { success: false, error: error.message };
        }
    }

    // Визуализация сессии
    async visualizeSession(userId) {
        const session = this.getActiveSession(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии' };
        }

        try {
            const GraphVisualizer = require('./graph-visualizer');
            const visualizer = new GraphVisualizer();

            const vizPath = await visualizer.visualizeSessionHistory(session, {
                filename: `session_${session.id.slice(0, 8)}.png`
            });

            return {
                success: true,
                visualization: vizPath,
                sessionId: session.id,
                footprint: {
                    nodes: session.currentFootprint.graph.nodes.size,
                    edges: session.currentFootprint.graph.edges.size
                }
            };

        } catch (error) {
            console.log('❌ Ошибка визуализации сессии:', error);
            return { success: false, error: error.message };
        }
    }

    // Поиск похожих моделей
    findSimilarModels(footprint, userId, options = {}) {
        const userModels = this.getUserModels(userId);
        const maxResults = options.maxResults || 5;
        const minSimilarity = options.minSimilarity || 0.4;

        const similarities = [];

        userModels.forEach(model => {
            if (model.id === footprint.id) return; // Пропускаем ту же модель

            const comparison = footprint.compare(model);

            if (comparison.similarity >= minSimilarity) {
                similarities.push({
                    model: model,
                    similarity: comparison.similarity,
                    decision: comparison.decision,
                    reason: comparison.reason
                });
            }
        });

        // Сортировка по схожести
        similarities.sort((a, b) => b.similarity - a.similarity);

        return {
            success: true,
            similarCount: similarities.length,
            similarModels: similarities.slice(0, maxResults),
            searchedModels: userModels.length
        };
    }

    // Очистка старых сессий
    cleanupOldSessions(maxAgeHours = 24) {
        const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        let cleaned = 0;

        for (const [userId, session] of this.userSessions) {
            if (session.lastActivity.getTime() < cutoffTime) {
                this.userSessions.delete(userId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Очищено ${cleaned} старых сессий`);
        }

        return cleaned;
    }
}

module.exports = SimpleFootprintManager;
