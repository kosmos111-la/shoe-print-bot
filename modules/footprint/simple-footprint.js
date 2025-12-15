// modules/footprint/simple-footprint.js
// ЦИФРОВОЙ ОТПЕЧАТОК - ОБЁРТКА НАД ГРАФОМ + МЕТАДАННЫХ + ГИБРИДНЫЕ ОТПЕЧАТКИ + POINTTRACKER

const crypto = require('crypto');
const fs = require('fs');
const SimpleGraph = require('./simple-graph');
const HybridFootprint = require('./hybrid-footprint');
const PointTracker = require('./point-tracker');

class SimpleFootprint {
    constructor(options = {}) {
        // Идентификаторы
        this.id = options.id || `fp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        this.name = options.name || `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`;
        this.userId = options.userId || null;

        // Граф - основа отпечатка
        this.graph = options.graph || new SimpleGraph(this.name);

        // Гибридный отпечаток (если доступен)
        this.hybridFootprint = options.hybridFootprint || null;
        if (!this.hybridFootprint && HybridFootprint) {
            try {
                this.hybridFootprint = new HybridFootprint({
                    id: this.id,
                    name: this.name,
                    userId: this.userId
                });
            } catch (error) {
                console.log('⚠️ Не удалось создать гибридный отпечаток:', error.message);
            }
        }

        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Добавляем PointTracker
        this.pointTracker = options.pointTracker || new PointTracker({
            ratingDecay: 0.97,
            minRating: 0.1,
            maxRating: 1.0,
            confirmationThreshold: 0.7
        });

        // Метаданные
        this.metadata = {
            created: new Date(),
            lastUpdated: new Date(),
            totalPhotos: 0,
            estimatedSize: options.estimatedSize || null,
            footprintType: options.footprintType || 'unknown',
            orientation: options.orientation || 0,
            features: {
                hasGraph: true,
                hasHybrid: this.hybridFootprint !== null,
                hasPointTracker: true, // 🔥 НОВОЕ: указываем что есть трекер
                hasMoments: this.hybridFootprint?.moments ? true : false,
                hasBitmask: this.hybridFootprint?.bitmask ? true : false
            },
            ...(options.metadata || {})
        };

        // Статистика
        this.stats = {
            confidence: options.confidence || 0.5,
            nodeCount: 0,
            edgeCount: 0,
            graphDiameter: 0,
            clusteringCoefficient: 0,
            qualityScore: 0,
            hybridScore: 0,
            trackerScore: 0 // 🔥 НОВОЕ: рейтинг от трекера
        };

        // История фото/анализов
        this.photoHistory = [];
        this.analysisHistory = [];

        // Связанные отпечатки (для объединения/сравнения)
        this.linkedFootprints = [];

        // Визуализация
        this.visualizationCache = null;

        console.log(`👣 Создан цифровой отпечаток "${this.name}" (ID: ${this.id}) с PointTracker`);
    }

    // 1. ДОБАВИТЬ АНАЛИЗ (обновленный с PointTracker)
    addAnalysis(analysis, sourceInfo = {}) {
        console.log(`📥 Добавляю анализ в отпечаток "${this.name}" через PointTracker...`);

        const { predictions } = analysis;

        // Проверка входных данных
        if (!predictions || !Array.isArray(predictions)) {
            console.log('⚠️ Нет предсказаний в анализе');
            return { error: 'No predictions', added: 0 };
        }

        // Извлечь точки протекторов
        const protectorPoints = this.extractProtectorPoints(predictions);

        if (protectorPoints.length < 3) {
            console.log(`⚠️ Слишком мало протекторов: ${protectorPoints.length}`);
            return { error: 'Not enough protectors', added: 0 };
        }

        console.log(`🔍 Найдено ${protectorPoints.length} протекторов`);

        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Обрабатываем точки через PointTracker
        const trackerResults = this.pointTracker.processNewPoints(protectorPoints, {
            ...sourceInfo,
            footprintId: this.id,
            analysisType: 'shoe_protector',
            timestamp: new Date()
        });

        console.log(`🎯 PointTracker: ${trackerResults.added} новых, ${trackerResults.updated} обновлено`);

        // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ:
// Получаем точки с высоким рейтингом для графа (на первом фото берём все)
let highConfidencePoints;

if (this.metadata.totalPhotos === 0) {
    // ⚠️ ПЕРВОЕ ФОТО: Используем ВСЕ точки трекера напрямую
    console.log('📸 Первое фото: создаю начальный граф из всех точек');
   
    // Собираем точки напрямую из трекера, игнорируя confirmedCount
    highConfidencePoints = [];
    for (const [id, pt] of this.pointTracker.points) {
        highConfidencePoints.push({
            id,
            x: pt.x,
            y: pt.y,
            rating: pt.rating,
            confirmedCount: pt.confirmedCount || 1, // Насильно ставим хотя бы 1
            lastSeen: pt.lastSeen
        });
    }
    console.log(`📊 Собрано ${highConfidencePoints.length} точек из трекера`);
} else {
    // Последующие фото: стандартная логика
    const minConfidence = 0.5;
    highConfidencePoints = this.pointTracker.getHighConfidencePoints(minConfidence);
}

// 🔥 ДОПОЛНИТЕЛЬНАЯ ЗАЩИТА: если все равно пусто
if (highConfidencePoints.length === 0) {
    console.log('⚠️ ВНИМАНИЕ: highConfidencePoints пуст! Экстренное восстановление...');
    // Создаем хотя бы одну точку из центра
    highConfidencePoints = [{
        id: 'emergency_node',
        x: 500,
        y: 500,
        rating: 0.5,
        confirmedCount: 1,
        lastSeen: new Date()
    }];
}

        // Обновляем граф на основе трекера
        const previousNodeCount = this.graph.nodes.size;

        // Создаем узлы графа из подтвержденных точек
        const graphNodes = [];
        highConfidencePoints.forEach((trackedPoint, index) => {
            const nodeId = `n_${trackedPoint.id}`;

            graphNodes.push({
                id: nodeId,
                x: trackedPoint.x,
                y: trackedPoint.y,
                confidence: trackedPoint.rating,
                confirmedCount: trackedPoint.confirmedCount,
                pointTrackerId: trackedPoint.id,
                sources: [{
                    timestamp: new Date(),
                    source: sourceInfo,
                    trackerData: trackedPoint
                }]
            });
        });

        // Построить граф из подтвержденных точек
        const graphInvariants = this.graph.buildFromPoints(graphNodes.map(p => ({
            x: p.x,
            y: p.y,
            confidence: p.confidence,
            id: p.id
        })));

        // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Связываем узлы графа с точками трекера
        this.linkNodesWithTracker(graphNodes);

        // Сохранить в историю
        const analysisRecord = {
            id: `analysis_${Date.now()}`,
            timestamp: new Date(),
            pointsCount: protectorPoints.length,
            trackerResults: trackerResults,
            highConfidencePoints: highConfidencePoints.length,
            sourceInfo: sourceInfo,
            graphSnapshot: {
                nodeCount: this.graph.nodes.size,
                edgeCount: this.graph.edges.size
            }
        };

        this.analysisHistory.push(analysisRecord);
        this.photoHistory.push({
            timestamp: new Date(),
            points: protectorPoints.length,
            source: sourceInfo,
            trackerResults: trackerResults
        });

        // Обновить метаданные
        this.metadata.totalPhotos++;
        this.metadata.lastUpdated = new Date();

        // Обновить статистику
        this.updateStats(graphInvariants, null);

        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Обновляем статистику из трекера
        const trackerStats = this.pointTracker.getStats();
        this.stats.trackerStats = trackerStats;
        this.stats.trackerScore = trackerStats.avgRating;

        // Комбинировать уверенность
        const graphConfidence = this.stats.confidence;
        const trackerConfidence = trackerStats.avgRating;
        this.stats.confidence = (graphConfidence * 0.4 + trackerConfidence * 0.6);

        const addedNodes = this.graph.nodes.size - previousNodeCount;

        console.log(`✅ Анализ добавлен: +${addedNodes} узлов, ` +
                  `трекер: ${trackerResults.updated} подтверждений`);

        return {
            success: true,
            added: addedNodes,
            totalNodes: this.graph.nodes.size,
            confidence: this.stats.confidence,
            graphInvariants: graphInvariants,
            trackerResults: trackerResults,
            trackerStats: trackerStats
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Связывание узлов графа с точками трекера
    linkNodesWithTracker(graphNodes) {
    let linkedCount = 0;
    let trackerPointsUsed = new Set();

    graphNodes.forEach(graphNode => {
        const node = this.graph.nodes.get(graphNode.id);
        if (node && graphNode.pointTrackerId) {
            // 🔥 ИСПРАВЛЕНИЕ: Проверяем существование точки в трекере
            const trackerPoint = this.pointTracker.points.get(graphNode.pointTrackerId);
           
            if (trackerPoint) {
                // Сохраняем связь с трекером
                node.pointTrackerId = graphNode.pointTrackerId;
                node.confirmedCount = trackerPoint.confirmedCount || 1;
                node.confidence = trackerPoint.rating;
                node.rating = trackerPoint.rating; // Сохраняем рейтинг
               
                // Сохраняем источники
                if (!node.sources) node.sources = [];
                if (trackerPoint.history) {
                    node.sources = trackerPoint.history.map(record => ({
                        timestamp: record.timestamp,
                        source: record.source,
                        confidence: record.confidence,
                        action: record.action
                    }));
                }
               
                trackerPointsUsed.add(graphNode.pointTrackerId);
                linkedCount++;
               
                // 🔥 ДЕБАГ: Логируем успешную связь
                if (trackerPoint.confirmedCount > 1) {
                    console.log(`🔗 Узел ${node.id} связан с трекером ${graphNode.pointTrackerId}, ` +
                              `подтверждений: ${trackerPoint.confirmedCount}`);
                }
            }
        }
    });

    // 🔥 ВАЖНО: Отмечаем узлы без связи с трекером
    this.graph.nodes.forEach((node, nodeId) => {
        if (!node.pointTrackerId) {
            node.confirmedCount = 1; // По умолчанию одно подтверждение (сама точка)
            node.confidence = node.confidence || 0.5;
        }
    });

    console.log(`🔗 Связано ${linkedCount} узлов графа с PointTracker, использовано ${trackerPointsUsed.size} точек трекера`);
    return linkedCount;
}

    // 2. ИЗВЛЕЧЬ ТОЧКИ ПРОТЕКТОРОВ ИЗ АНАЛИЗА
    extractProtectorPoints(predictions) {
        const points = [];

        // Фильтруем только протекторы обуви
        const protectors = predictions.filter(p =>
            p.class === 'shoe-protector' ||
            (p.class && p.class.toLowerCase().includes('protector'))
        );

        // Если нет класса shoe-protector, но есть точки с confidence
        if (protectors.length === 0 && predictions.length > 0) {
            console.log('⚠️ Нет класса shoe-protector, использую все точки с confidence > 0.3');

            predictions.forEach((pred, index) => {
                if ((pred.confidence || 0) > 0.3 && pred.points && pred.points.length > 0) {
                    // Берем центр точек
                    const center = this.calculateCenter(pred.points);
                    points.push({
                        x: center.x,
                        y: center.y,
                        confidence: pred.confidence || 0.5,
                        originalPoints: pred.points
                    });
                }
            });
        } else {
            // Нормальный случай: есть протекторы
            protectors.forEach(protector => {
                if (protector.points && protector.points.length > 0) {
                    const center = this.calculateCenter(protector.points);
                    points.push({
                        x: center.x,
                        y: center.y,
                        confidence: protector.confidence || 0.5,
                        originalPoints: protector.points
                    });
                }
            });
        }

        return points;
    }

    // 3. РАССЧИТАТЬ ЦЕНТР ТОЧЕК
    calculateCenter(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0 };
        }

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    // 4. ОБНОВИТЬ СТАТИСТИКУ - ОБНОВЛЕННЫЙ
    updateStats(graphInvariants, hybridResult = null) {
        this.stats.nodeCount = graphInvariants.nodeCount;
        this.stats.edgeCount = graphInvariants.edgeCount;
        this.stats.graphDiameter = graphInvariants.graphDiameter;
        this.stats.clusteringCoefficient = graphInvariants.clusteringCoefficient;

        // Рассчитать confidence на основе инвариантов
        const nodeScore = Math.min(1, graphInvariants.nodeCount / 20);
        const edgeScore = graphInvariants.edgeCount > 0 ?
            Math.min(1, graphInvariants.edgeCount / graphInvariants.nodeCount / 2) : 0;
        const clusteringScore = graphInvariants.clusteringCoefficient;

        const graphConfidence = (nodeScore * 0.4 + edgeScore * 0.3 + clusteringScore * 0.3);

        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Используем данные трекера если есть
        let trackerScore = 0;
        if (this.pointTracker) {
            const trackerStats = this.pointTracker.getStats();
            trackerScore = trackerStats.avgRating;
            this.stats.trackerScore = trackerScore;
            this.stats.trackerStats = trackerStats;
        }

        // Добавить гибридный score если есть
        let hybridScore = 0;
        if (this.hybridFootprint) {
            if (typeof this.hybridFootprint.calculateConfidence === 'function') {
                hybridScore = this.hybridFootprint.calculateConfidence();
            } else if (this.hybridFootprint.stats?.confidence) {
                hybridScore = this.hybridFootprint.stats.confidence;
            } else if (this.hybridFootprint.getConfidence && typeof this.hybridFootprint.getConfidence === 'function') {
                hybridScore = this.hybridFootprint.getConfidence();
            }
        }

        // Комбинированный confidence
        let combinedConfidence = graphConfidence;
        let weights = 1;

        if (trackerScore > 0) {
            combinedConfidence += trackerScore;
            weights++;
        }

        if (hybridScore > 0) {
            combinedConfidence += hybridScore;
            weights++;
            this.stats.hybridScore = hybridScore;
        }

        this.stats.confidence = combinedConfidence / weights;
        this.stats.qualityScore = this.stats.confidence * Math.min(1, this.metadata.totalPhotos / 3);

        // Обновить метаданные
        if (graphInvariants.nodeCount > 30 && !this.metadata.estimatedSize) {
            this.metadata.estimatedSize = Math.round(35 + (graphInvariants.nodeCount - 30) / 3);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: ОБНОВИТЬ ПОДТВЕРЖДЕНИЯ ИЗ POINTTRACKER
    updateNodeFromTracker(nodeId, trackerPoint) {
        const node = this.graph.nodes.get(nodeId);
        if (!node) return false;

        // Обновляем узел данными из трекера
        node.confirmedCount = trackerPoint.confirmedCount;
        node.confidence = trackerPoint.rating;
        node.lastConfirmed = new Date();

        // Сохраняем ID трекера для связи
        if (!node.pointTrackerId) {
            node.pointTrackerId = trackerPoint.id;
        }

        // Сохраняем источник подтверждения
        if (!node.sources) node.sources = [];
        node.sources.push({
            timestamp: new Date(),
            source: 'point_tracker',
            trackerId: trackerPoint.id,
            confidence: trackerPoint.rating
        });

        return true;
    }

    // 🔥 ДОБАВЛЕННЫЙ МЕТОД: ПОЛУЧИТЬ СТАТИСТИКУ ПОДТВЕРЖДЕНИЙ
    getConfirmationStats() {
        // Получаем статистику из трекера
        const trackerStats = this.pointTracker ? this.pointTracker.getStats() : {
            totalPoints: 0,
            highConfidencePoints: 0,
            avgRating: 0,
            avgConfirmations: 0,
            ratingDistribution: { low: 0, medium: 0, high: 0 }
        };

        // Также считаем статистику по узлам графа для совместимости
        let totalNodes = 0;
        let confirmedNodes = 0;
        let totalConfirmations = 0;

        if (this.graph && this.graph.nodes) {
            this.graph.nodes.forEach((node, nodeId) => {
                totalNodes++;
                const confirmCount = node.confirmedCount || 1;

                if (confirmCount > 1) {
                    confirmedNodes++;
                    totalConfirmations += confirmCount;
                }
            });
        }

        const stats = {
            totalNodes,
            confirmedNodes,
            unconfirmedNodes: totalNodes - confirmedNodes,
            averageConfirmations: confirmedNodes > 0 ? totalConfirmations / confirmedNodes : 0,

            // Статистика из PointTracker
            trackerStats: {
                totalPoints: trackerStats.totalPoints,
                highConfidencePoints: trackerStats.highConfidencePoints,
                avgRating: trackerStats.avgRating,
                avgConfirmations: trackerStats.avgConfirmations,
                ratingDistribution: trackerStats.ratingDistribution
            },

            // Совмещенные данные
            combinedConfidence: trackerStats.avgRating > 0 ?
                (trackerStats.avgRating + (confirmedNodes / Math.max(1, totalNodes))) / 2 :
                (confirmedNodes / Math.max(1, totalNodes))
        };

        return stats;
    }

    // 🔥 НОВЫЙ МЕТОД: Вспомогательный метод для поиска узла по координатам
    findNodeByCoordinates(point, threshold = 15) {
        let closestNode = null;
        let minDistance = Infinity;

        if (!this.graph || !this.graph.nodes) return null;

        this.graph.nodes.forEach((node, nodeId) => {
            const dx = node.x - point.x;
            const dy = node.y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance && distance < threshold) {
                minDistance = distance;
                closestNode = { id: nodeId, node: node, distance: distance };
            }
        });

        return closestNode;
    }

    // 5. СРАВНИТЬ С ДРУГИМ ОТПЕЧАТКОМ - ОБНОВЛЕННЫЙ
    compare(otherFootprint) {
        console.log(`🔍 Сравниваю "${this.name}" с "${otherFootprint.name}"...`);

        if (!otherFootprint || !otherFootprint.graph) {
            return { error: 'Invalid footprint to compare' };
        }

        // ПРОВЕРКА: Если оба отпечатка имеют гибридные признаки, использовать расширенное сравнение
        if (this.hybridFootprint && otherFootprint.hybridFootprint) {
            console.log('🎯 Использую гибридное сравнение...');
            return this.compareHybrid(otherFootprint);
        }

        // Классическое сравнение по графам
        return this.compareGraphBased(otherFootprint);
    }

    // 5a. ГИБРИДНОЕ СРАВНЕНИЕ
    compareHybrid(otherFootprint) {
        const hybridComparison = this.hybridFootprint.compare(otherFootprint.hybridFootprint);

        // Также получить сравнение графов для полного результата
        const graphComparison = this.compareGraphBased(otherFootprint);

        // Комбинировать результаты
        const hybridWeight = 0.7;  // Вес гибридного сравнения
        const graphWeight = 0.3;   // Вес графового сравнения

        const combinedSimilarity = hybridComparison.similarity * hybridWeight +
                                  graphComparison.similarity * graphWeight;

        let decision, reason;

        if (combinedSimilarity > 0.75) {
            decision = 'same';
            reason = `Высокая схожесть (гибридный: ${hybridComparison.similarity.toFixed(3)}, ` +
                    `граф: ${graphComparison.similarity.toFixed(3)})`;
        } else if (combinedSimilarity > 0.5) {
            decision = 'similar';
            reason = `Умеренная схожесть (гибридный: ${hybridComparison.similarity.toFixed(3)}, ` +
                    `граф: ${graphComparison.similarity.toFixed(3)})`;
        } else {
            decision = 'different';
            reason = `Низкая схожесть (гибридный: ${hybridComparison.similarity.toFixed(3)}, ` +
                    `граф: ${graphComparison.similarity.toFixed(3)})`;
        }

        return {
            similarity: Math.round(combinedSimilarity * 100) / 100,
            decision: decision,
            reason: reason,
            method: 'hybrid',
            comparisons: {
                hybrid: hybridComparison,
                graph: graphComparison
            },
            confidence: hybridComparison.confidence || 0.5
        };
    }

    // 5b. КЛАССИЧЕСКОЕ СРАВНЕНИЕ ПО ГРАФАМ
    compareGraphBased(otherFootprint) {
        const invariants1 = this.graph.getBasicInvariants();
        const invariants2 = otherFootprint.graph.getBasicInvariants();

        // Быстрое сравнение по количеству узлов (±30%)
        const nodeRatio = Math.min(invariants1.nodeCount, invariants2.nodeCount) /
                        Math.max(invariants1.nodeCount, invariants2.nodeCount);

        if (nodeRatio < 0.7) {
            console.log(`⚠️ Слишком разное количество узлов: ${nodeRatio.toFixed(2)}`);
            return {
                similarity: nodeRatio,
                decision: 'different',
                reason: `Разное количество узлов: ${invariants1.nodeCount} vs ${invariants2.nodeCount}`
            };
        }

        // Сравнение инвариантов
        const comparisons = [];

        // 1. Сравнение количества рёбер
        const edgeRatio = Math.min(invariants1.edgeCount, invariants2.edgeCount) /
                        Math.max(invariants1.edgeCount, invariants2.edgeCount);
        comparisons.push({ name: 'edgeCount', score: edgeRatio });

        // 2. Сравнение средней степени
        const degreeDiff = Math.abs(invariants1.avgDegree - invariants2.avgDegree);
        const degreeScore = 1 - Math.min(1, degreeDiff / 3); // Допуск 3
        comparisons.push({ name: 'avgDegree', score: degreeScore });

        // 3. Сравнение коэффициента кластеризации
        const clusteringDiff = Math.abs(invariants1.clusteringCoefficient - invariants2.clusteringCoefficient);
        const clusteringScore = 1 - Math.min(1, clusteringDiff / 0.3); // Допуск 0.3
        comparisons.push({ name: 'clustering', score: clusteringScore });

        // 4. Сравнение плотности графа
        const densityDiff = Math.abs(invariants1.density - invariants2.density);
        const densityScore = 1 - Math.min(1, densityDiff / 0.1); // Допуск 0.1
        comparisons.push({ name: 'density', score: densityScore });

        // Рассчитать общую схожесть
        const totalScore = comparisons.reduce((sum, comp) => sum + comp.score, 0) / comparisons.length;
        const similarity = Math.round(totalScore * 100) / 100; // Округлить до 2 знаков

        // Принять решение
        let decision, reason;
        if (similarity > 0.7) {
            decision = 'same';
            reason = `Высокая схожесть (${similarity}) - вероятно, та же обувь`;
        } else if (similarity > 0.4) {
            decision = 'similar';
            reason = `Умеренная схожесть (${similarity}) - похожий тип протектора`;
        } else {
            decision = 'different';
            reason = `Низкая схожесть (${similarity}) - разные следы`;
        }

        console.log(`📊 Результат сравнения: ${similarity} (${decision})`);

        return {
            similarity: similarity,
            decision: decision,
            reason: reason,
            comparisons: comparisons,
            invariants1: {
                nodeCount: invariants1.nodeCount,
                edgeCount: invariants1.edgeCount,
                avgDegree: invariants1.avgDegree.toFixed(2),
                clustering: invariants1.clusteringCoefficient.toFixed(3)
            },
            invariants2: {
                nodeCount: invariants2.nodeCount,
                edgeCount: invariants2.edgeCount,
                avgDegree: invariants2.avgDegree.toFixed(2),
                clustering: invariants2.clusteringCoefficient.toFixed(3)
            }
        };
    }

    // 6. ОБЪЕДИНИТЬ С ДРУГИМ ОТПЕЧАТКОМ (если это тот же след)
    merge(otherFootprint) {
        console.log(`🔄 Объединяю "${this.name}" с "${otherFootprint.name}"...`);

        const comparison = this.compare(otherFootprint);

        if (comparison.decision !== 'same') {
            console.log(`❌ Не могу объединить: ${comparison.reason}`);
            return {
                success: false,
                reason: comparison.reason,
                similarity: comparison.similarity
            };
        }

        // Объединить историю
        this.analysisHistory.push(...otherFootprint.analysisHistory);
        this.photoHistory.push(...otherFootprint.photoHistory);

        // Обновить метаданные
        this.metadata.totalPhotos += otherFootprint.metadata.totalPhotos;
        this.metadata.lastUpdated = new Date();

        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Объединить PointTracker если есть
        if (this.pointTracker && otherFootprint.pointTracker) {
            // Перемещаем все точки из другого трекера
            for (const [pointId, point] of otherFootprint.pointTracker.points) {
                // Ищем ближайшую точку в текущем трекере
                const nearest = this.pointTracker.findNearestPoint(point, 15);

                if (nearest && nearest.distance < 10) {
                    // Обновляем существующую точку
                    this.pointTracker.updatePoint(nearest.id, point, {
                        source: 'merge',
                        mergedFrom: otherFootprint.id,
                        timestamp: new Date()
                    });
                } else {
                    // Добавляем новую точку
                    this.pointTracker.addPoint(point, {
                        source: 'merge',
                        mergedFrom: otherFootprint.id,
                        timestamp: new Date()
                    });
                }
            }
        }

        // Объединить гибридные отпечатки если есть
        if (this.hybridFootprint && otherFootprint.hybridFootprint) {
            this.hybridFootprint.merge(otherFootprint.hybridFootprint);
        }

        // Добавить в связанные
        this.linkedFootprints.push({
            id: otherFootprint.id,
            name: otherFootprint.name,
            mergedAt: new Date(),
            similarity: comparison.similarity
        });

        // Обновить статистику (усреднить)
        this.stats.confidence = (this.stats.confidence + otherFootprint.stats.confidence) / 2;
        this.stats.qualityScore = Math.max(this.stats.qualityScore, otherFootprint.stats.qualityScore);

        if (this.hybridFootprint) {
            this.stats.hybridScore = this.hybridFootprint.calculateConfidence();
        }

        // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Обновляем статистику трекера
        if (this.pointTracker) {
            const trackerStats = this.pointTracker.getStats();
            this.stats.trackerScore = trackerStats.avgRating;
            this.stats.trackerStats = trackerStats;
        }

        console.log(`✅ Объединено успешно! Теперь ${this.metadata.totalPhotos} фото в отпечатке`);

        return {
            success: true,
            mergedPhotos: otherFootprint.metadata.totalPhotos,
            newTotalPhotos: this.metadata.totalPhotos,
            similarity: comparison.similarity,
            trackerStats: this.pointTracker ? this.pointTracker.getStats() : null
        };
    }

    // 7. ПОЛУЧИТЬ ИНФОРМАЦИЮ ОБ ОТПЕЧАТКЕ (обновленная)
    getInfo() {
        const info = {
            id: this.id,
            name: this.name,
            userId: this.userId,
            stats: {
                ...this.stats,
                qualityScore: Math.round(this.stats.qualityScore * 100)
            },
            metadata: {
                ...this.metadata,
                created: this.metadata.created.toLocaleString('ru-RU'),
                lastUpdated: this.metadata.lastUpdated.toLocaleString('ru-RU')
            },
            history: {
                analyses: this.analysisHistory.length,
                photos: this.photoHistory.length,
                linkedFootprints: this.linkedFootprints.length
            },
            graph: {
                nodes: this.graph.nodes.size,
                edges: this.graph.edges.size,
                invariants: this.graph.getBasicInvariants()
            }
        };

        // Добавить информацию о гибридных признаках
        if (this.hybridFootprint) {
            info.hybrid = this.hybridFootprint.getInfo();
        }

        // 🔥 НОВОЕ: Добавить информацию о PointTracker
        if (this.pointTracker) {
            const trackerStats = this.pointTracker.getStats();
            info.pointTracker = {
                totalPoints: trackerStats.totalPoints,
                highConfidencePoints: trackerStats.highConfidencePoints,
                avgRating: trackerStats.avgRating,
                avgConfirmations: trackerStats.avgConfirmations,
                hasTracker: true
            };
        }

        return info;
    }

    // 8. СОХРАНИТЬ В JSON - ОБНОВЛЕННЫЙ
    toJSON() {
        const data = {
            id: this.id,
            name: this.name,
            userId: this.userId,
            graph: this.graph.toJSON(),
            metadata: {
                ...this.metadata,
                created: this.metadata.created.toISOString(),
                lastUpdated: this.metadata.lastUpdated.toISOString()
            },
            stats: this.stats,
            analysisHistory: this.analysisHistory,
            photoHistory: this.photoHistory,
            linkedFootprints: this.linkedFootprints,
            _version: '1.2', // Обновили версию для поддержки PointTracker
            _savedAt: new Date().toISOString()
        };

        // Сохранить гибридный отпечаток если есть
        if (this.hybridFootprint) {
            data.hybridFootprint = this.hybridFootprint.toJSON();
        }

        // 🔥 ВАЖНО: Сохранить PointTracker
        if (this.pointTracker) {
            data.pointTracker = this.pointTracker.toJSON();
        }

        return data;
    }

    // 9. ЗАГРУЗИТЬ ИЗ JSON - ОБНОВЛЕННЫЙ
    static fromJSON(data) {
        console.log(`📂 Загружаю отпечаток "${data.name}"...`);

        // Создать граф из данных
        const graph = SimpleGraph.fromJSON(data.graph);

        // Создать гибридный отпечаток если есть данные
        let hybridFootprint = null;
        if (data.hybridFootprint && HybridFootprint) {
            try {
                hybridFootprint = HybridFootprint.fromJSON(data.hybridFootprint);
                console.log('   🎯 Загружен гибридный отпечаток');
            } catch (error) {
                console.log('⚠️ Ошибка загрузки гибридного отпечатка:', error.message);
            }
        }

        // 🔥 ВАЖНО: Создать PointTracker если есть данные
        let pointTracker = null;
        if (data.pointTracker && PointTracker) {
            try {
                pointTracker = PointTracker.fromJSON(data.pointTracker);
                console.log('   🎯 Загружен PointTracker');
            } catch (error) {
                console.log('⚠️ Ошибка загрузки PointTracker:', error.message);
                pointTracker = new PointTracker();
            }
        } else {
            // Создать новый трекер если данных нет
            pointTracker = new PointTracker();
        }

        // Создать отпечаток
        const footprint = new SimpleFootprint({
            id: data.id,
            name: data.name,
            userId: data.userId,
            graph: graph,
            hybridFootprint: hybridFootprint,
            pointTracker: pointTracker,
            metadata: data.metadata,
            confidence: data.stats?.confidence
        });

        // Восстановить историю
        if (Array.isArray(data.analysisHistory)) {
            footprint.analysisHistory = data.analysisHistory;
        }

        if (Array.isArray(data.photoHistory)) {
            footprint.photoHistory = data.photoHistory;
        }

        if (Array.isArray(data.linkedFootprints)) {
            footprint.linkedFootprints = data.linkedFootprints;
        }

        // Восстановить статистику
        if (data.stats) {
            footprint.stats = { ...footprint.stats, ...data.stats };
        }

        console.log(`✅ Загружен отпечаток "${footprint.name}" с ` +
                   `${footprint.graph.nodes.size} узлами и PointTracker`);

        return footprint;
    }

    // 10. ВИЗУАЛИЗАЦИЯ ДЛЯ ОТЛАДКИ (обновленная)
    visualize() {
        console.log(`\n👣 ЦИФРОВОЙ ОТПЕЧАТОК "${this.name}":`);
        console.log(`├─ ID: ${this.id}`);
        console.log(`├─ Узлов в графе: ${this.graph.nodes.size}`);
        console.log(`├─ Рёбер в графе: ${this.graph.edges.size}`);
        console.log(`├─ Фото в истории: ${this.photoHistory.length}`);
        console.log(`├─ Уверенность: ${Math.round(this.stats.confidence * 100)}%`);
        console.log(`├─ Качество: ${Math.round(this.stats.qualityScore * 100)}%`);

        if (this.pointTracker) {
            const trackerStats = this.pointTracker.getStats();
            console.log(`├─ PointTracker: ${trackerStats.totalPoints} точек`);
            console.log(`├─ Высоконадёжных: ${trackerStats.highConfidencePoints}`);
            console.log(`├─ Средний рейтинг: ${trackerStats.avgRating.toFixed(3)}`);
        }

        if (this.hybridFootprint) {
            console.log(`├─ Гибридный режим: ВКЛЮЧЕН`);
            console.log(`├─ Гибридный score: ${Math.round(this.stats.hybridScore * 100)}%`);
        }

        console.log(`└─ Создан: ${this.metadata.created.toLocaleString('ru-RU')}`);

        // Показать инварианты графа
        const invariants = this.graph.getBasicInvariants();
        console.log(`\n📊 ИНВАРИАНТЫ ГРАФА:`);
        console.log(`├─ Диаметр: ${invariants.graphDiameter}`);
        console.log(`├─ Кластеризация: ${invariants.clusteringCoefficient.toFixed(3)}`);
        console.log(`├─ Средняя степень: ${invariants.avgDegree.toFixed(2)}`);
        console.log(`└─ Плотность: ${invariants.density.toFixed(4)}`);
    }

    // 11. ВИЗУАЛИЗАЦИЯ ГРАФА ОТПЕЧАТКА (обновленная)
    async visualizeGraph(options = {}) {
        try {
            const GraphVisualizer = require('./graph-visualizer');
            const visualizer = new GraphVisualizer();

            // 🔥 ВАЖНОЕ ИСПРАВЛЕНИЕ: Используем метод с подтверждениями
            const vizPath = await visualizer.visualizeWithConfirmations(this, {
                title: `Отпечаток: ${this.name}`,
                filename: `footprint_${this.id}.png`,
                ...options
            });

            this.visualizationCache = {
                path: vizPath,
                timestamp: new Date()
            };

            console.log(`🎨 Визуализация создана: ${vizPath}`);
            return vizPath;

        } catch (error) {
            console.log('❌ Ошибка визуализации:', error.message);
            return null;
        }
    }

    // 12. ВИЗУАЛИЗАЦИЯ С КОНТУРОМ
    async visualizeWithContour(contourImagePath = null) {
        try {
            const GraphVisualizer = require('./graph-visualizer');
            const visualizer = new GraphVisualizer();

            // Найти лучшее фото для контура (с максимальным количеством протекторов)
            let bestPhotoPath = contourImagePath;
            if (!bestPhotoPath && this.photoHistory.length > 0) {
                const contourPhoto = this.photoHistory.find(photo =>
                    photo.source?.localPath && fs.existsSync(photo.source.localPath)
                );
                if (contourPhoto) {
                    bestPhotoPath = contourPhoto.source.localPath;
                }
            }

            const vizPath = await visualizer.visualizeModelWithContour(this, bestPhotoPath, {
                filename: `footprint_contour_${this.id}.png`
            });

            return vizPath;

        } catch (error) {
            console.log('❌ Ошибка визуализации с контуром:', error.message);
            return null;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧИТЬ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ ИЗ ТРЕКЕРА
    getTrackerVisualizationData() {
        if (this.pointTracker && this.pointTracker.exportForVisualization) {
            return this.pointTracker.exportForVisualization();
        }
        return null;
    }

    // 🔥 НОВЫЙ МЕТОД: ВИЗУАЛИЗИРОВАТЬ ТРЕКЕР
    visualizeTracker() {
        console.log(`\n🎯 POINT TRACKER ДЛЯ ОТПЕЧАТКА "${this.name}":`);
        if (this.pointTracker) {
            this.pointTracker.visualize();

            // Показать связь с узлами графа
            console.log(`\n🔗 СВЯЗЬ С ГРАФОМ:`);
            let linkedNodes = 0;
            this.graph.nodes.forEach((node, nodeId) => {
                if (node.pointTrackerId) {
                    linkedNodes++;
                }
            });
            console.log(`Узлов графа связанных с трекером: ${linkedNodes}/${this.graph.nodes.size}`);
        } else {
            console.log(`❌ PointTracker не инициализирован`);
        }
    }

    // 🔥 НОВЫЙ МЕТОД: ПРИНУДИТЕЛЬНО ОБНОВИТЬ ПОДТВЕРЖДЕНИЯ УЗЛОВ
    forceUpdateNodeConfirmations() {
        let updatedCount = 0;

        if (this.pointTracker && this.graph) {
            // Проходим по всем точкам трекера
            for (const [trackerId, trackerPoint] of this.pointTracker.points) {
                if (trackerPoint.confirmedCount > 1) {
                    // Находим ближайший узел графа
                    const node = this.findNodeByCoordinates(trackerPoint, 15);
                    if (node) {
                        // Обновляем узел
                        this.updateNodeFromTracker(node.id, trackerPoint);
                        updatedCount++;
                    }
                }
            }
        }

        console.log(`🔧 Принудительно обновлено ${updatedCount} узлов с подтверждениями`);
        return updatedCount;
    }

    // 13. ПОЛУЧИТЬ ГИБРИДНЫЙ ОТПЕЧАТОК
    getHybridFootprint() {
        return this.hybridFootprint;
    }

    // 14. УСТАНОВИТЬ ГИБРИДНЫЙ ОТПЕЧАТОК
    setHybridFootprint(hybridFootprint) {
        this.hybridFootprint = hybridFootprint;
        this.metadata.features.hasHybrid = true;
        this.metadata.features.hasMoments = hybridFootprint?.moments ? true : false;
        this.metadata.features.hasBitmask = hybridFootprint?.bitmask ? true : false;

        if (this.hybridFootprint) {
            this.stats.hybridScore = this.hybridFootprint.calculateConfidence();
        }

        return this;
    }

    // 15. ПОЛУЧИТЬ POINT TRACKER
    getPointTracker() {
        return this.pointTracker;
    }

    // 16. ОБНОВИТЬ POINT TRACKER
    updatePointTracker(newPoints, sourceInfo = {}) {
        if (!this.pointTracker) {
            this.pointTracker = new PointTracker();
        }

        const results = this.pointTracker.processNewPoints(newPoints, sourceInfo);

        // После обработки обновляем связанные узлы
        if (results.updated > 0) {
            this.forceUpdateNodeConfirmations();
        }

        return results;
    }
}

module.exports = SimpleFootprint;
