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
            usePointTracker: true,
            enableMergeVisualization: options.enableMergeVisualization !== false,
            enableIntelligentMerge: options.enableIntelligentMerge !== false,
            enableTopologySuperModel: options.enableTopologySuperModel !== false,

            // 🔥 НАСТРОЙКИ ТРАНСФОРМАЦИЙ
            useTransformations: options.useTransformations !== false,
            maxTransformationError: options.maxTransformationError || 50,
            minTransformationSimilarity: options.minTransformationSimilarity || 0.5,

            // Пороги
            topologySimilarityThreshold: options.topologySimilarityThreshold || 0.7,
            highConfidenceThreshold: options.highConfidenceThreshold || 0.8,
            minPointsForFootprint: options.minPointsForFootprint || 5,

            // Настройки PointTracker
            trackerConfirmationThreshold: 2,
            ...options
        };

        // Сессии пользователей
        this.userSessions = new Map();
       
        // Загруженные модели
        this.loadedModels = new Map();
       
        // Визуализатор объединений
        this.mergeVisualizer = new MergeVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations'),
            debug: this.config.debug
        });

        // 🔥 ОБНОВЛЕННЫЙ МАТЧЕР С ТРАНСФОРМАЦИЯМИ
        this.matcher = new SimpleMatcher({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold,
            enableTransformations: this.config.useTransformations,
            maxTransformationError: this.config.maxTransformationError,
            enableAdaptiveComparison: true
        });

        // История последних визуализаций
        this.lastMergeVisualizations = new Map();
       
        // 🔥 КЭШ ТРАНСФОРМАЦИЙ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ
        this.userTransformations = new Map();

        // Статистика системы
        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalComparisons: 0,
            successfulMerges: 0,
            totalPhotosProcessed: 0,
            trackerConfirmations: 0,
            transformationsUsed: 0,
            transformationSuccessRate: 0,
            lastActivity: new Date()
        };

        // Обеспечиваем существование директорий
        this.ensureDirectories();

        // Загружаем существующие модели
        this.loadExistingModels();

        console.log(`🚀 SimpleFootprintManager инициализирован с поддержкой трансформаций`);
        console.log(`   📁 База данных: ${this.config.dbPath}`);
        console.log(`   🎯 Трансформации: ${this.config.useTransformations ? 'ВКЛ' : 'ВЫКЛ'}`);
        console.log(`   🎨 Визуализация объединения: ${this.config.enableMergeVisualization ? 'ВКЛ' : 'ВЫКЛ'}`);
    }

    // 🔥 ОСНОВНОЙ МЕТОД: ДОБАВЛЕНИЕ ФОТО В СЕССИЮ С ТРАНСФОРМАЦИЯМИ
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
                session = this.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
                console.log(`🆕 Создана новая сессия: ${session.id}`);
            }

            // Добавляем фото в историю сессии
            session.photos.push({
                id: `photo_${Date.now()}`,
                timestamp: new Date(),
                photoInfo: photoInfo,
                pointsCount: points.length
            });

            session.lastActivity = new Date();
            this.systemStats.totalPhotosProcessed++;

            // Если это первое фото в сессии
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

                // Добавляем анализ
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

            // 🔥 КРИТИЧЕСКАЯ ЧАСТЬ: ЕСЛИ ЕСТЬ СУЩЕСТВУЮЩИЙ ОТПЕЧАТОК
           
            console.log(`🔍 Сравниваю с существующим отпечатком (${session.currentFootprint.graph.nodes.size} узлов)`);

            // Создаем временный отпечаток для сравнения
            const tempFootprint = new SimpleFootprint({
                userId: userId,
                name: `Temp_${Date.now()}`,
                metadata: { isTemporary: true }
            });

            // Добавляем анализ во временный отпечаток
            const tempResult = tempFootprint.addAnalysis(analysis, {
                ...photoInfo,
                sessionId: session.id,
                isTemporary: true
            });

            // 🔥 ИСПОЛЬЗУЕМ ОБНОВЛЕННЫЙ МАТЧЕР С ТРАНСФОРМАЦИЯМИ
            const alignmentResult = await this.matcher.alignAndCompare(
                session.currentFootprint.graph,
                tempFootprint.graph,
                {
                    userId: userId,
                    debug: this.config.debug
                }
            );

            console.log(`📊 Результат сравнения:`);
            console.log(`   Схожесть: ${alignmentResult.similarity.toFixed(3)}`);
            console.log(`   Решение: ${alignmentResult.decision}`);
            console.log(`   Совпавших пар: ${alignmentResult.matchedPairs?.length || 0}`);
            console.log(`   Трансформация: ${alignmentResult.transformation ? 'да' : 'нет'}`);

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

            // 🔥 НОВАЯ ЛОГИКА: ОБЪЕДИНЕНИЕ С ТРАНСФОРМАЦИЯМИ
            let mergeVizPath = null;
            let mergeMethod = 'none';
            let mergeResult = null;

            const similarityThreshold = this.config.topologySimilarityThreshold;

            if (alignmentResult.similarity > similarityThreshold ||
                (alignmentResult.matchedPairs && alignmentResult.matchedPairs.length > 10)) {
               
                // 🔥 СЛУЧАЙ 1: СЛЕДЫ СОВПАДАЮТ
                console.log(`✅ Следы совпали - объединяю с трансформацией!`);

                mergeMethod = 'transformative_merge';

                // 🔥 ОБЪЕДИНЯЕМ С ИСПОЛЬЗОВАНИЕМ ТРАНСФОРМАЦИИ
                mergeResult = await this.mergeTrackersFromAlignment(
                    session.currentFootprint,
                    tempFootprint,
                    alignmentResult,
                    {
                        photoId: photoInfo.photoId,
                        timestamp: new Date(),
                        alignmentSimilarity: alignmentResult.similarity
                    }
                );

                console.log(`🎯 Объединение завершено:`);
                console.log(`   Добавлено новых: ${mergeResult.merged}`);
                console.log(`   Обновлено: ${mergeResult.updated}`);
                console.log(`   Ошибка трансформации: ${mergeResult.transformationError?.toFixed(2) || 'N/A'}`);

                // Обновляем статистику
                session.confirmedPhotos = (session.confirmedPhotos || 0) + 1;
                this.systemStats.successfulMerges++;
                this.systemStats.trackerConfirmations += mergeResult.updated;
               
                if (alignmentResult.transformation) {
                    this.systemStats.transformationsUsed++;
                }

                // 🔥 СОЗДАЕМ ВИЗУАЛИЗАЦИЮ
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
                                highlightNewNodes: true,
                                transformation: alignmentResult.transformation
                            }
                        );

                        this.addMergeVisualization(userId, {
                            path: mergeVizPath,
                            timestamp: new Date(),
                            similarity: alignmentResult.similarity,
                            confirmedNodes: mergeResult.updated,
                            addedNodes: mergeResult.merged,
                            method: mergeMethod,
                            transformationUsed: !!alignmentResult.transformation
                        });

                        console.log(`✅ Визуализация создана: ${mergeVizPath}`);

                    } catch (vizError) {
                        console.log('⚠️ Ошибка создания визуализации:', vizError.message);
                    }
                }

                // Отправляем уведомление в Telegram
                if (bot && chatId) {
                    try {
                        await bot.sendMessage(chatId,
                            `✅ **Следы совпали - модели объединены!**\n\n` +
                            `🎯 Новых точек добавлено: ${mergeResult.merged || 0}\n` +
                            `🔄 Существующих обновлено: ${mergeResult.updated || 0}\n` +
                            `📊 Схожесть: ${(alignmentResult.similarity * 100).toFixed(1)}%\n` +
                            `${alignmentResult.transformation ? `🔄 Трансформация применена (ошибка: ${alignmentResult.transformation.error?.toFixed(1) || 'N/A'})` : ''}\n\n` +
                            `💡 **Объединение завершено успешно!**`
                        );
                    } catch (botError) {
                        console.log('⚠️ Ошибка отправки сообщения:', botError.message);
                    }
                }

            } else {
                // 🔥 СЛУЧАЙ 2: СЛЕДЫ НЕ СОВПАДАЮТ
                console.log(`🆕 Следы разные (${alignmentResult.similarity.toFixed(3)})`);

                // Пробуем принудительное объединение
                const matchedPairs = alignmentResult.matchedPairs || [];

                if (matchedPairs.length > 5) {
                    console.log(`🤝 Найдено ${matchedPairs.length} совпавших пар - пробую объединить!`);

                    mergeMethod = 'force_merge';
                    mergeResult = await this.forceMergeFootprints(
                        session.currentFootprint,
                        tempFootprint,
                        matchedPairs,
                        alignmentResult
                    );

                    if (mergeResult.success) {
                        console.log(`✅ Принудительное объединение успешно!`);
                        session.confirmedPhotos = (session.confirmedPhotos || 0) + 1;
                        this.systemStats.successfulMerges++;
                    } else {
                        console.log(`❌ Не удалось объединить, создаю новую модель`);
                        mergeMethod = 'new_model';
                        this.createNewModel(session, userId, analysis, photoInfo);
                    }
                } else {
                    console.log(`❌ Слишком мало совпадений (${matchedPairs.length}), создаю новую модель`);
                    mergeMethod = 'new_model';
                    this.createNewModel(session, userId, analysis, photoInfo);
                }
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
                mergeResult: mergeResult
            });

            // Автосохранение
            if (this.config.autoSave) {
                this.saveSession(userId);
            }

            // Обновляем статистику трансформаций
            this.updateTransformationStats();

            return {
                success: true,
                isNewSession: isNewSession,
                nodesAdded: tempResult.added,
                totalNodes: session.currentFootprint.graph.nodes.size,
                sessionId: session.id,
                alignment: alignmentResult,
                mergeVisualization: mergeVizPath,
                mergeMethod: mergeMethod,
                mergeResult: mergeResult,
                transformation: alignmentResult.transformation
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

    // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Объединение с трансформациями
    async mergeTrackersFromAlignment(mainFootprint, tempFootprint, alignmentResult, sourceInfo = {}) {
        try {
            console.log(`🔄 Объединение в инвариантном пространстве...`);

            // Если нет трансформации, используем простой метод
            if (!alignmentResult.transformation) {
                console.log('⚠️ Нет информации о трансформации, использую простой метод');
                return await this.mergeTrackersSimple(mainFootprint, tempFootprint, sourceInfo);
            }

            const transformation = alignmentResult.transformation;

            // Проверяем качество трансформации
            if (transformation.error > this.config.maxTransformationError) {
                console.log(`⚠️ Ошибка трансформации слишком велика: ${transformation.error}`);
                return await this.mergeTrackersSimple(mainFootprint, tempFootprint, sourceInfo);
            }

            console.log(`🎯 Применяю трансформацию:`);
            console.log(`   Масштаб: ${transformation.scale.toFixed(3)}`);
            console.log(`   Поворот: ${(transformation.rotation * 180 / Math.PI).toFixed(1)}°`);
            console.log(`   Смещение: (${transformation.dx.toFixed(1)}, ${transformation.dy.toFixed(1)})`);
            console.log(`   Ошибка: ${transformation.error.toFixed(2)}`);

            // 🔥 1. ВЫЧИСЛЯЕМ ОБРАТНУЮ ТРАНСФОРМАЦИЮ
            const inverseTransformation = this.calculateInverseTransformation(transformation);

            // 🔥 2. ОБРАБАТЫВАЕМ КАЖДУЮ ТОЧКУ С УЧЁТОМ ТРАНСФОРМАЦИИ
            let mergedCount = 0;
            let updatedCount = 0;

            for (const [tempTrackerId, tempPoint] of tempFootprint.pointTracker.points) {
                // Исходные координаты точки во временной системе
                const originalPoint = {
                    x: tempPoint.originalX || tempPoint.x,
                    y: tempPoint.originalY || tempPoint.y,
                    confidence: tempPoint.rating
                };

                // 🔥 ПРЕОБРАЗУЕМ в систему основной модели
                const transformedPoint = this.applyTransformation(
                    originalPoint,
                    inverseTransformation
                );

                // 🔥 Ищем ближайшую точку в ОДНОЙ системе координат
                const nearest = mainFootprint.pointTracker.findNearestPoint(
                    transformedPoint,
                    25 * transformation.scale // Масштабируем порог
                );

                if (nearest && nearest.distance < 20 * transformation.scale) {
                    // 🔥 ОБЪЕДИНЕНИЕ: обновляем существующую точку
                    const mainPoint = mainFootprint.pointTracker.points.get(nearest.id);
                   
                    // Взвешенное усреднение координат
                    const weight = Math.min(0.7, tempPoint.confirmedCount / (tempPoint.confirmedCount + mainPoint.confirmedCount));
                   
                    const updateResult = mainFootprint.pointTracker.updatePoint(
                        nearest.id,
                        {
                            x: mainPoint.x * (1 - weight) + transformedPoint.x * weight,
                            y: mainPoint.y * (1 - weight) + transformedPoint.y * weight,
                            confidence: Math.max(tempPoint.rating, mainPoint.rating)
                        },
                        {
                            ...sourceInfo,
                            action: 'merge_transformed',
                            transformation: transformation,
                            originalCoords: originalPoint,
                            transformedCoords: transformedPoint,
                            distance: nearest.distance,
                            weight: weight
                        }
                    );

                    updatedCount++;
                } else {
                    // 🔥 ДОБАВЛЕНИЕ: новая точка в системе основной модели
                    const newPointId = mainFootprint.pointTracker.addPoint(
                        {
                            x: transformedPoint.x,
                            y: transformedPoint.y,
                            confidence: transformedPoint.confidence,
                            // 🔥 ВАЖНО: сохраняем историю трансформаций
                            transformationHistory: [{
                                original: originalPoint,
                                transformation: transformation,
                                timestamp: new Date(),
                                error: transformation.error
                            }],
                            source: 'transformed_merge',
                            originalTrackerId: tempTrackerId
                        },
                        {
                            ...sourceInfo,
                            action: 'add_transformed',
                            originalFrom: tempTrackerId,
                            transformation: transformation
                        }
                    );

                    mergedCount++;
                    console.log(`➕ Добавлена трансформированная точка ${newPointId}`);
                }
            }

            // 🔥 3. ОБНОВЛЯЕМ ГРАФ с учётом всех подтверждений
            await this.updateGraphFromTracker(mainFootprint);

            console.log(`✅ Объединение с трансформацией завершено:`);
            console.log(`   - Обновлено точек: ${updatedCount}`);
            console.log(`   - Добавлено новых: ${mergedCount}`);
            console.log(`   - Ошибка трансформации: ${transformation.error.toFixed(2)}`);

            // Сохраняем трансформацию для пользователя
            this.saveUserTransformation(mainFootprint.userId, transformation);

            return {
                merged: mergedCount,
                updated: updatedCount,
                transformation: transformation,
                transformationError: transformation.error,
                scale: transformation.scale,
                rotation: transformation.rotation * 180 / Math.PI
            };

        } catch (error) {
            console.log('❌ Ошибка объединения с трансформацией:', error.message);
            console.error(error.stack);
            return await this.mergeTrackersSimple(mainFootprint, tempFootprint, sourceInfo);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Вычислить обратную трансформацию
    calculateInverseTransformation(transformation) {
        const { a, b, c, d, dx, dy } = transformation.matrix || { a: 1, b: 0, c: 0, d: 1, dx: 0, dy: 0 };

        // Определитель матрицы
        const det = a * d - b * c;

        if (Math.abs(det) < 1e-10) {
            console.log('⚠️ Определитель матрицы близок к нулю, использую единичную трансформацию');
            return { scale: 1, rotation: 0, dx: 0, dy: 0 };
        }

        // Обратная матрица
        const invA = d / det;
        const invB = -b / det;
        const invC = -c / det;
        const invD = a / det;

        // Обратное смещение
        const invDx = -(invA * dx + invC * dy);
        const invDy = -(invB * dx + invD * dy);

        // Рассчитываем параметры обратной трансформации
        const invScale = 1 / transformation.scale;
        const invRotation = -transformation.rotation;

        return {
            scale: invScale,
            rotation: invRotation,
            dx: invDx,
            dy: invDy,
            matrix: { a: invA, b: invB, c: invC, d: invD }
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Применить трансформацию к точке
    applyTransformation(point, transformation) {
        const { a = 1, b = 0, c = 0, d = 1, dx = 0, dy = 0 } = transformation.matrix || {};

        // Применяем матрицу трансформации
        const x = a * point.x + c * point.y + dx;
        const y = b * point.x + d * point.y + dy;

        // Применяем масштаб и поворот если указаны отдельно
        const scale = transformation.scale || 1;
        const rotation = transformation.rotation || 0;

        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;

        return {
            x: rotatedX * scale,
            y: rotatedY * scale,
            confidence: point.confidence,
            originalPoint: point
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Обновить граф из трекера
    async updateGraphFromTracker(footprint) {
        const tracker = footprint.pointTracker;
        const graph = footprint.graph;

        if (!tracker || !graph) {
            console.log('⚠️ Нет трекера или графа для обновления');
            return;
        }

        let updatedNodes = 0;
        let addedNodes = 0;

        console.log(`🔄 Обновление графа из трекера (${tracker.points.size} точек)`);

        // Для каждой точки в трекере
        for (const [trackerId, trackerPoint] of tracker.points) {
            // Ищем узел графа, связанный с этой точкой
            let graphNode = null;
            let graphNodeId = null;

            graph.nodes.forEach((node, nodeId) => {
                if (node.pointTrackerId === trackerId) {
                    graphNode = node;
                    graphNodeId = nodeId;
                }
            });

            if (graphNode) {
                // 🔥 ОБНОВЛЯЕМ существующий узел
                graphNode.confirmedCount = trackerPoint.confirmedCount || 1;
                graphNode.confidence = trackerPoint.rating || 0.5;

                // Плавно обновляем координаты
                const weight = 0.3; // Скорость адаптации
                graphNode.x = graphNode.x * (1 - weight) + trackerPoint.x * weight;
                graphNode.y = graphNode.y * (1 - weight) + trackerPoint.y * weight;

                // Сохраняем историю трансформаций если есть
                if (trackerPoint.transformationHistory) {
                    graphNode.transformationHistory = [
                        ...(graphNode.transformationHistory || []),
                        ...trackerPoint.transformationHistory
                    ];
                }

                updatedNodes++;
            } else {
                // 🔥 ДОБАВЛЯЕМ новый узел
                const newNodeId = `n_${trackerId}`;
                graph.nodes.set(newNodeId, {
                    id: newNodeId,
                    x: trackerPoint.x,
                    y: trackerPoint.y,
                    confidence: trackerPoint.rating || 0.5,
                    confirmedCount: trackerPoint.confirmedCount || 1,
                    pointTrackerId: trackerId,
                    sources: trackerPoint.history || [],
                    transformationHistory: trackerPoint.transformationHistory || [],
                    createdAt: new Date()
                });
                addedNodes++;
            }
        }

        // Перестраиваем рёбра
        const graphNodes = Array.from(graph.nodes.values()).map(node => ({
            x: node.x,
            y: node.y,
            confidence: node.confidence,
            id: node.id
        }));

        graph.buildFromPoints(graphNodes);

        console.log(`📊 Граф обновлён: +${addedNodes} узлов, ${updatedNodes} обновлено`);
        console.log(`   Всего узлов: ${graph.nodes.size}, рёбер: ${graph.edges.size}`);
    }

    // 🔥 НОВЫЙ МЕТОД: Сохранить трансформацию для пользователя
    saveUserTransformation(userId, transformation) {
        const userTransforms = this.userTransformations.get(userId) || [];
       
        userTransforms.push({
            ...transformation,
            timestamp: new Date(),
            rotationDeg: transformation.rotation * 180 / Math.PI
        });

        // Ограничиваем историю 10 последними трансформациями
        if (userTransforms.length > 10) {
            userTransforms.shift();
        }

        this.userTransformations.set(userId, userTransforms);
       
        console.log(`💾 Сохранена трансформация для пользователя ${userId}`);
    }

    // 🔥 НОВЫЙ МЕТОД: Обновить статистику трансформаций
    updateTransformationStats() {
        const totalComparisons = this.systemStats.totalComparisons;
        const transformationsUsed = this.systemStats.transformationsUsed;
       
        if (totalComparisons > 0) {
            this.systemStats.transformationSuccessRate =
                (transformationsUsed / totalComparisons) * 100;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Получить историю трансформаций пользователя
    getUserTransformationHistory(userId) {
        return this.userTransformations.get(userId) || [];
    }

    // 🔥 НОВЫЙ МЕТОД: Простой метод объединения (для обратной совместимости)
    async mergeTrackersSimple(mainFootprint, tempFootprint, sourceInfo = {}) {
        console.log(`🔄 Простое объединение трекеров...`);

        let mergedCount = 0;
        let updatedCount = 0;

        for (const [tempTrackerId, tempPoint] of tempFootprint.pointTracker.points) {
            const pointForMain = {
                x: tempPoint.x,
                y: tempPoint.y,
                confidence: tempPoint.rating || 0.5
            };

            const nearest = mainFootprint.pointTracker.findNearestPoint(pointForMain, 25);

            if (nearest && nearest.distance < 20) {
                mainFootprint.pointTracker.updatePoint(nearest.id, pointForMain, {
                    ...sourceInfo,
                    source: 'simple_merge',
                    distance: nearest.distance
                });
                updatedCount++;
            } else {
                mainFootprint.pointTracker.addPoint(pointForMain, {
                    ...sourceInfo,
                    source: 'new_from_simple_merge'
                });
                mergedCount++;
            }
        }

        // Обновляем граф
        await this.updateGraphFromTracker(mainFootprint);

        console.log(`✅ Простое объединение: +${mergedCount} новых, ${updatedCount} обновлено`);

        return {
            merged: mergedCount,
            updated: updatedCount,
            method: 'simple'
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Принудительное объединение
    async forceMergeFootprints(mainFootprint, tempFootprint, matchedPairs, alignmentResult) {
        console.log(`🤝 Принудительное объединение по ${matchedPairs.length} совпавшим парам...`);

        try {
            // Объединяем трекеры
            const trackerResult = await this.mergeTrackersFromAlignment(
                mainFootprint,
                tempFootprint,
                alignmentResult,
                {
                    source: 'force_merge',
                    matchedPairs: matchedPairs.length
                }
            );

            return {
                success: true,
                ...trackerResult
            };

        } catch (error) {
            console.log(`❌ Ошибка принудительного объединения:`, error.message);
            return { success: false, error: error.message };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Создать новую модель
    createNewModel(session, userId, analysis, photoInfo) {
        // Сохраняем текущий отпечаток если он достаточно большой
        if (session.currentFootprint && session.currentFootprint.graph.nodes.size >= this.config.minPointsForFootprint) {
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

    // 🔥 НОВЫЙ МЕТОД: Взвешенное среднее
    weightedAverage(value1, value2, weight1 = 1, weight2 = 1) {
        const totalWeight = weight1 + weight2;
        return (value1 * weight1 + value2 * weight2) / totalWeight;
    }

    // ============ ОСТАЛЬНЫЕ МЕТОДЫ (без изменений) ============

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
                usePointTracker: true,
                useTransformations: this.config.useTransformations
            }
        };

        this.userSessions.set(userId, session);
        this.systemStats.totalUsers = this.userSessions.size;

        console.log(`🆕 Создана сессия ${sessionId.slice(0, 8)}... для пользователя ${userId}`);

        return session;
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
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'transformations')
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

        files.slice(0, 100).forEach(file => {
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

    // ... остальные методы без изменений ...

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
                transformationsUsed: this.getUserTransformationHistory(userId).length
            };

            fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));

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

    getSystemStats() {
        return {
            ...this.systemStats,
            activeSessions: this.userSessions.size,
            loadedModels: this.loadedModels.size,
            mergeVisualizations: this.getMergeVisualizationCount(),
            userTransformations: this.getTotalTransformations(),
            config: {
                autoAlignment: this.config.autoAlignment,
                enableMergeVisualization: this.config.enableMergeVisualization,
                usePointTracker: this.config.usePointTracker,
                useTransformations: this.config.useTransformations,
                topologySimilarityThreshold: this.config.topologySimilarityThreshold,
                maxTransformationError: this.config.maxTransformationError
            },
            system: {
                uptime: Math.floor(process.uptime()),
                memoryUsage: process.memoryUsage()
            }
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Получить общее количество трансформаций
    getTotalTransformations() {
        let total = 0;
        for (const [userId, transforms] of this.userTransformations) {
            total += transforms.length;
        }
        return total;
    }

    // ... остальные методы без существенных изменений ...
}

module.exports = SimpleFootprintManager;
