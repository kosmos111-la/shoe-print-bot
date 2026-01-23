// modules/footprint/vector-super-model.js
const TemplateBuilder = require('./template-builder');

class VectorSuperModel {
    constructor(options = {}) {
        this.id = `vsm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Шаблонная супер-модель';

        // 🔥 СИНХРОНИЗИРУЕМ ПОРОГИ
        this.config = {
            matchThreshold: 0.05,
            decisionThreshold: 0.6,
            minConfirmationsForHighConfidence: 2,
            bestGraphMinNodes: options.bestGraphMinNodes || 15,
            enableTemplateMode: true,
            enableDynamicReference: true,

            similarityThresholds: {
                SAME: 0.6,
                SIMILAR: 0.4,
                DIFFERENT: 0.0
            },

            referenceUpdateThreshold: 1.15,
            minQualityForReference: 0.4,
            ...options
        };

        console.log(`🎯 VECTOR-MODEL пороги СИНХРОНИЗИРОВАНЫ: SAME=${this.config.similarityThresholds.SAME}`);

        // 🔥 TEMPLATE BUILDER
        this.templateBuilder = new TemplateBuilder({
            name: `Шаблон_${this.name}`,
            enablePCA: false,
            cellSize: 25,
            matchThreshold: 0.05,
            decisionThreshold: 0.6,
            ...options
        });

        // 🔥 Храним ссылки на исходные графы
        this.sourceGraphs = new Map();

        // 🔥 Лучший след-представитель
        this.bestGraphId = null;
        this.bestGraphScore = 0;
        this.bestGraphMetadata = null;

        // Статистика
        this.stats = {
            totalMerges: 0,
            totalGraphsAdded: 0,
            confidence: 0,
            createdAt: new Date(),
            lastUpdated: new Date(),
            bestGraphUpdates: 0,
            sourceGraphsCount: 0,
            templateCells: 0,
            confirmedCells: 0,
            avgConfirmations: 0
        };

        console.log(`🏗️ Создана ШАБЛОННАЯ векторная супер-модель "${this.name}"`);
    }

    // 🔥 НОВЫЙ МЕТОД: Принудительное добавление С ПРАВИЛЬНЫМИ КООРДИНАТАМИ
    addGraphWithForcedConfidence(graph, graphId, metadata = {}) {
        console.log(`🎯 [FORCED-ADD] ПРИНУДИТЕЛЬНО добавляю граф ${graphId} с уверенностью ${metadata.similarity}`);
       
        if (metadata.similarity && metadata.similarity > 0.9) {
            console.log(`🔥 SIMPLE-MATCHER УВЕРЕН НА ${(metadata.similarity * 100).toFixed(1)}%`);
           
            // 1. Сохраняем исходный граф
            this.saveSourceGraph(graph, graphId, metadata);
           
            // 2. 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Получаем точки В ПРАВИЛЬНОЙ СИСТЕМЕ КООРДИНАТ
            let pointsForTemplate = [];
           
            if (metadata.sourceFootprint && metadata.sourceFootprint.getPointsForTemplateComparison) {
                // Получаем точки уже в системе шаблона [0,1]
                pointsForTemplate = metadata.sourceFootprint.getPointsForTemplateComparison();
                console.log(`📊 Получено ${pointsForTemplate.length} точек в системе шаблона [0,1]`);
               
                if (pointsForTemplate.length > 0) {
                    console.log(`   Пример: (${pointsForTemplate[0].nx?.toFixed(3)}, ${pointsForTemplate[0].ny?.toFixed(3)})`);
                }
            } else {
                // Фаллбэк
                pointsForTemplate = this.templateBuilder.extractPointsFromGraph(graph);
                console.log(`⚠️ Фаллбэк: получено ${pointsForTemplate.length} точек`);
            }
           
            if (pointsForTemplate.length < 3) {
                console.log(`❌ Недостаточно точек для принудительного добавления: ${pointsForTemplate.length}`);
                return false;
            }
           
            // 3. 🔥 ДОБАВЛЯЕМ К ШАБЛОНУ С ПРАВИЛЬНЫМИ КООРДИНАТАМИ
            if (!this.templateBuilder.referenceGraphId) {
                // Первый граф
                console.log(`🎯 Устанавливаю как начальный эталон`);
                this.templateBuilder.setReferenceGraph(graph, graphId, metadata);
               
                if (this.templateBuilder.referenceGraphId) {
                    this.bestGraphId = graphId;
                    this.bestGraphScore = this.calculateGraphScore(graph);
                    this.bestGraphMetadata = metadata;
                }
            } else {
                // 🔥 ВАЖНО: Добавляем точки К СУЩЕСТВУЮЩЕМУ ШАБЛОНУ
                console.log(`🔄 Принудительно добавляю ${pointsForTemplate.length} точек к существующему шаблону...`);
               
                let addedCount = 0;
                let mergedCount = 0;
               
                pointsForTemplate.forEach((point, index) => {
                    if (!point.nx || !point.ny) {
                        console.log(`⚠️ Точка ${index} без nx/ny координат`);
                        return;
                    }
                   
                    // Ищем ближайшую ячейку в шаблоне
                    let nearestCellId = null;
                    let minDistance = Infinity;
                   
                    for (const [cellId, cell] of this.templateBuilder.invariantCells) {
                        const distance = Math.sqrt(
                            Math.pow(cell.normalizedCenter.nx - point.nx, 2) +
                            Math.pow(cell.normalizedCenter.ny - point.ny, 2)
                        );
                       
                        if (distance < minDistance) {
                            minDistance = distance;
                            nearestCellId = cellId;
                        }
                    }
                   
                    const MERGE_DISTANCE = 0.05; // 5% от размера шаблона
                   
                    if (nearestCellId && minDistance < MERGE_DISTANCE) {
                        // Объединяем с существующей ячейкой
                        const cell = this.templateBuilder.invariantCells.get(nearestCellId);
                        if (cell) {
                            const oldConfirmations = cell.confirmations || 1;
                            cell.confirmations = oldConfirmations + 1;
                            cell.confidence = Math.min(1.0, (cell.confidence || 0.7) + 0.1);
                           
                            if (!cell.sources) cell.sources = new Set();
                            cell.sources.add(graphId);
                           
                            // Уточняем координаты
                            const weight = 1.0 / cell.confirmations;
                            cell.normalizedCenter.nx = cell.normalizedCenter.nx * (1 - weight) +
                                                      point.nx * weight;
                            cell.normalizedCenter.ny = cell.normalizedCenter.ny * (1 - weight) +
                                                      point.ny * weight;
                           
                            mergedCount++;
                        }
                    } else {
                        // Создаем новую ячейку
                        const cellId = `forced_${graphId}_${index}_${Date.now()}`;
                       
                        const newCell = {
                            normalizedCenter: {
                                nx: point.nx,
                                ny: point.ny
                            },
                            originalCenter: {
                                x: point.x || 0,
                                y: point.y || 0
                            },
                            radius: 0.03,
                            points: [point.id || `pt_${index}`],
                            confirmations: 1,
                            confidence: metadata.similarity * 0.9, // Учитываем уверенность simple-matcher
                            sources: new Set([graphId]),
                            invariants: null,
                            isForced: true,
                            forcedBy: 'high_confidence_match',
                            forcedConfidence: metadata.similarity,
                            addedAt: new Date()
                        };
                       
                        this.templateBuilder.invariantCells.set(cellId, newCell);
                        addedCount++;
                    }
                });
               
                console.log(`✅ Принудительно добавлено: ${addedCount} новых, ${mergedCount} объединено`);
            }
           
            // Обновляем статистику
            this.stats.totalGraphsAdded++;
            this.stats.totalMerges++;
            this.stats.lastUpdated = new Date();
            this.updateStats();
           
            console.log(`🏁 Принудительное добавление завершено`);
            console.log(`   Всего ячеек в шаблоне: ${this.templateBuilder.invariantCells.size}`);
           
            return true;
        }
       
        console.log(`⚠️ Недостаточная уверенность для принудительного добавления: ${metadata.similarity}`);
        return this.addGraph(graph, graphId, metadata);
    }

    // 🔥 ИСПРАВЛЕННЫЙ addGraph - используем принудительное добавление при высокой уверенности
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} к динамической супер-модели...`);

        // 🔥 ВАЖНО: Если simple-matcher уверен >90% - используем ПРИНУДИТЕЛЬНОЕ ДОБАВЛЕНИЕ
        if (metadata.similarity && metadata.similarity > 0.9) {
            console.log(`🎯 ВЫСОКАЯ УВЕРЕННОСТЬ ${metadata.similarity.toFixed(3)} - использую принудительное добавление`);
            return this.addGraphWithForcedConfidence(graph, graphId, metadata);
        }

        console.log(`🔍 [VECTOR-MODEL-DIAG] Входные данные:`);
        console.log(`   Узлов в графе: ${graph?.nodes?.size || 0}`);
        console.log(`   Сходство из metadata: ${metadata.similarity || 'нет'}`);

        // 🔥 ПРОВЕРЯЕМ ПОРОГИ ИЗ МЕТАДАННЫХ (если есть)
        if (metadata.similarity !== undefined) {
            const decisionCheck = this.checkDecisionWithSynchronizedThreshold(metadata.similarity);
           
            // 🔥 ДОБАВЛЯЕМ ИНФОРМАЦИЮ О РЕШЕНИИ В МЕТАДАННЫЕ
            metadata.vectorDecision = decisionCheck.decision;
            metadata.vectorDecisionReason = decisionCheck.reason;
            metadata.vectorThresholdUsed = decisionCheck.thresholdUsed;
        }

        // 1. Сохраняем исходный граф
        this.saveSourceGraph(graph, graphId, metadata);

        // 2. 🔥 ДОБАВЛЯЕМ К TEMPLATE BUILDER
        let addedToTemplate = false;

        if (this.templateBuilder.referenceGraphId === null) {
            // Первый граф
            console.log(`🎯 Устанавливаю граф ${graphId} как начальный эталон`);
            addedToTemplate = this.templateBuilder.setReferenceGraph(graph, graphId, metadata);

            if (addedToTemplate) {
                this.bestGraphId = graphId;
                this.bestGraphScore = this.calculateGraphScore(graph);
                this.bestGraphMetadata = metadata;
                console.log(`🏆 Начальный эталон установлен: ${graphId}`);
            }
        } else {
            // Последующие графы
            addedToTemplate = this.templateBuilder.addGraph(graph, graphId, metadata);

            if (addedToTemplate) {
                // 🔥 ПРОВЕРЯЕМ, НЕ ИЗМЕНИЛСЯ ЛИ ЭТАЛОН
                const newReferenceId = this.templateBuilder.referenceGraphId;

                if (newReferenceId !== this.bestGraphId) {
                    // Эталон обновился!
                    console.log(`🔄 ОБНОВЛЕНИЕ ЭТАЛОНА В СУПЕР-МОДЕЛИ:`);
                    console.log(`   Старый: ${this.bestGraphId}`);
                    console.log(`   Новый: ${newReferenceId}`);

                    this.bestGraphId = newReferenceId;
                    this.bestGraphScore = this.templateBuilder.referenceGraphQuality;

                    // Обновляем метаданные
                    const sourceGraph = this.sourceGraphs.get(newReferenceId);
                    if (sourceGraph) {
                        this.bestGraphMetadata = sourceGraph.metadata;
                    }

                    this.stats.bestGraphUpdates++;
                    console.log(`🏆 ЭТАЛОН ОБНОВЛЁН: ${newReferenceId} (оценка: ${this.bestGraphScore.toFixed(3)})`);
                }
            }
        }

        if (!addedToTemplate) {
            console.log(`⚠️ Граф ${graphId} не добавлен к шаблону`);
           
            // 🔥 ЕСЛИ SIMPLE-MATCHER УВЕРЕН - ПРЕДЛАГАЕМ ПРИНУДИТЕЛЬНОЕ ДОБАВЛЕНИЕ
            if (metadata.similarity && metadata.similarity > 0.7) {
                console.log(`💡 РЕКОМЕНДАЦИЯ: simple-matcher уверен на ${(metadata.similarity * 100).toFixed(1)}%`);
                console.log(`   Используйте addGraphWithForcedConfidence для принудительного добавления`);
            }
           
            return false;
        }

        // 3. Обновить статистику
        this.stats.totalMerges++;
        this.stats.totalGraphsAdded++;
        this.stats.lastUpdated = new Date();
        this.updateStats();

        // 4. Получить информацию о шаблоне
        const templateInfo = this.templateBuilder.getInfo();

        console.log(`✅ Граф добавлен. Динамическая статистика:`);
        console.log(`   Ячеек шаблона: ${templateInfo.templateCells}`);
        console.log(`   Подтвержденных ячеек: ${templateInfo.stats.confirmedCells}`);
        console.log(`   Лучший граф: ${this.bestGraphId} (${this.bestGraphScore.toFixed(3)})`);
        console.log(`   Всего графов: ${this.stats.sourceGraphsCount}`);
        console.log(`   СИНХРОНИЗИРОВАННЫЕ ПОРОГИ: SAME=${this.config.similarityThresholds.SAME}`);

        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: Проверка решения с синхронизированным порогом
    checkDecisionWithSynchronizedThreshold(similarity) {
        console.log(`🎯 [VECTOR-MODEL] Проверка решения с синхронизированным порогом:`);
        console.log(`   Сходство: ${similarity.toFixed(3)}`);
        console.log(`   Порог "SAME": ${this.config.similarityThresholds.SAME}`);
        console.log(`   Порог "SIMILAR": ${this.config.similarityThresholds.SIMILAR}`);

        let decision, reason;

        if (similarity >= this.config.similarityThresholds.SAME) {
            decision = 'same';
            reason = `Сходство ${(similarity * 100).toFixed(1)}% ≥ порог ${(this.config.similarityThresholds.SAME * 100).toFixed(1)}%`;
        } else if (similarity >= this.config.similarityThresholds.SIMILAR) {
            decision = 'similar';
            reason = `Сходство ${(similarity * 100).toFixed(1)}% ≥ порог ${(this.config.similarityThresholds.SIMILAR * 100).toFixed(1)}%`;
        } else {
            decision = 'different';
            reason = `Сходство ${(similarity * 100).toFixed(1)}% < порог ${(this.config.similarityThresholds.SIMILAR * 100).toFixed(1)}%`;
        }

        console.log(`   Решение: ${decision} (${reason})`);

        return {
            decision,
            reason,
            similarity,
            thresholdUsed: this.config.similarityThresholds.SAME,
            isSynchronized: true
        };
    }

    // 🔥 СОХРАНИТЬ ИСХОДНЫЙ ГРАФ
    saveSourceGraph(graph, graphId, metadata) {
        const nodeCount = graph.nodes ? graph.nodes.size : 0;

        this.sourceGraphs.set(graphId, {
            graphId: graphId,
            nodeCount: nodeCount,
            edgeCount: graph.edges ? graph.edges.size : 0,
            metadata: metadata,
            addedAt: new Date(),
            invariants: graph.getBasicInvariants ? graph.getBasicInvariants() : null,
            graph: nodeCount <= 100 ? graph : null,
            graphData: nodeCount > 100 ? this.extractGraphData(graph) : null
        });

        this.stats.sourceGraphsCount = this.sourceGraphs.size;
        console.log(`💾 Сохранен исходный граф ${graphId} с ${nodeCount} узлами`);
    }

    // 🔥 ОБНОВЛЯЕМ СТАТИСТИКУ
    updateStats() {
        const templateInfo = this.templateBuilder.getInfo();
        const visualizationData = this.templateBuilder.getVisualizationData();

        if (!visualizationData || visualizationData.cells.length === 0) {
            this.stats.confidence = 0;
            return;
        }

        const cells = visualizationData.cells;
        const stats = visualizationData.stats;

        this.stats.templateCells = cells.length;
        this.stats.confirmedCells = stats.confirmedCells || 0;
        this.stats.totalConfirmations = stats.totalConfirmations || 0;
        this.stats.averageConfirmations = stats.averageConfirmations || 0;

        const confirmedRatio = this.stats.confirmedCells / Math.max(1, this.stats.templateCells);
        const avgConfirmations = this.stats.averageConfirmations;

        this.stats.confidence = Math.min(1.0,
            confirmedRatio * 0.5 +
            Math.min(0.3, avgConfirmations * 0.15) +
            (this.bestGraphScore * 0.2)
        );
    }

    // 🔥 ПОЛУЧИТЬ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
    getVisualizationData() {
        const templateData = this.templateBuilder.getVisualizationData();

        return {
            ...templateData,
            metadata: {
                id: this.id,
                name: this.name,
                merges: this.stats.totalMerges,
                createdAt: this.stats.createdAt,
                visualizationMethod: 'template_based',
                bestGraphId: this.bestGraphId,
                bestGraphScore: this.bestGraphScore,
                sourceGraphsCount: this.stats.sourceGraphsCount,
                dynamicReferenceEnabled: this.config.enableDynamicReference,
                bestGraphUpdates: this.stats.bestGraphUpdates,
                thresholds: {
                    same: this.config.similarityThresholds.SAME,
                    similar: this.config.similarityThresholds.SIMILAR,
                    match: this.config.matchThreshold,
                    synchronized: true
                }
            }
        };
    }

    // 🔥 РАСЧЁТ ОЦЕНКИ ГРАФА
    calculateGraphScore(graph) {
        if (!graph || !graph.nodes) return 0;

        const nodeCount = graph.nodes.size;
        const edgeCount = graph.edges ? graph.edges.size : 0;

        if (nodeCount < this.config.bestGraphMinNodes) {
            return 0;
        }

        const factors = {
            nodeCount: Math.min(1, nodeCount / 50),
            connectivity: Math.min(1, edgeCount / (nodeCount * 1.5)),
            uniformity: this.calculateNodeUniformity(graph),
            clusterQuality: this.calculateClusterQuality(graph)
        };

        const weights = {
            nodeCount: 0.35,
            connectivity: 0.25,
            uniformity: 0.20,
            clusterQuality: 0.20
        };

        let totalScore = 0;
        for (const [factor, value] of Object.entries(factors)) {
            totalScore += value * weights[factor];
        }

        return Math.min(1, totalScore);
    }

    // 🔥 ИНФОРМАЦИЯ
    getInfo() {
        const templateStats = this.templateBuilder.getInfo();
        const bestGraphInfo = this.bestGraphId ? {
            bestGraphId: this.bestGraphId,
            bestGraphScore: Math.round(this.bestGraphScore * 1000) / 1000,
            bestGraphUpdates: this.stats.bestGraphUpdates,
            bestGraphNodeCount: this.sourceGraphs.get(this.bestGraphId)?.nodeCount || 0
        } : {};

        return {
            id: this.id,
            name: this.name,
            stats: {
                ...this.stats,
                confidence: Math.round(this.stats.confidence * 1000) / 1000,
                createdAt: this.stats.createdAt.toLocaleString('ru-RU'),
                lastUpdated: this.stats.lastUpdated.toLocaleString('ru-RU'),
                ...bestGraphInfo
            },
            template: templateStats,
            config: this.config,
            hasTemplate: !!this.templateBuilder.referenceGraphId,
            dynamicReferenceEnabled: this.config.enableDynamicReference,
            thresholdsSynchronized: {
                withSimpleManager: true,
                sameThreshold: this.config.similarityThresholds.SAME,
                note: 'Пороги синхронизированы с simple-manager.js (0.6 для SAME)'
            }
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    extractGraphData(graph) {
        const nodes = [];
        const edges = [];

        if (graph.nodes) {
            for (const [id, node] of graph.nodes) {
                nodes.push({
                    id: id,
                    x: node.x,
                    y: node.y,
                    confidence: node.confidence || 0.5
                });
            }
        }

        return { nodes, edges };
    }

    calculateNodeUniformity(graph) {
        if (!graph.nodes || graph.nodes.size < 10) return 0.5;

        const nodes = Array.from(graph.nodes.values());
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            minX = Math.min(minX, node.x || 0);
            maxX = Math.max(maxX, node.x || 0);
            minY = Math.min(minY, node.y || 0);
            maxY = Math.max(maxY, node.y || 0);
        });

        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
        const grid = Array(9).fill(0);
        const cellWidth = width / 3;
        const cellHeight = height / 3;

        nodes.forEach(node => {
            const gridX = Math.min(2, Math.floor((node.x - minX) / cellWidth));
            const gridY = Math.min(2, Math.floor((node.y - minY) / cellHeight));
            const cellIndex = gridY * 3 + gridX;
            grid[cellIndex]++;
        });

        const avg = nodes.length / 9;
        let variance = 0;
        grid.forEach(count => {
            variance += Math.pow(count - avg, 2);
        });
        variance /= 9;

        const maxVariance = Math.pow(nodes.length, 2) / 9;
        const uniformity = 1 - (variance / maxVariance);

        return Math.max(0, Math.min(1, uniformity));
    }

    calculateClusterQuality(graph) {
        if (!graph.nodes || graph.nodes.size === 0) return 0;

        let totalNeighbors = 0;

        if (graph.edges && graph.edges.size > 0) {
            const degrees = new Map();

            for (const [edgeId, edge] of graph.edges) {
                degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
                degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);
            }

            for (const degree of degrees.values()) {
                totalNeighbors += degree;
            }

            const avgDegree = totalNeighbors / graph.nodes.size;
            return Math.min(1, avgDegree / 4);
        }

        return 0.3;
    }

    // 🔥 СОХРАНИТЬ И ЗАГРУЗИТЬ
    toJSON() {
        const data = {
            id: this.id,
            name: this.name,
            stats: this.stats,
            config: this.config,
            bestGraphId: this.bestGraphId,
            bestGraphScore: this.bestGraphScore,
            bestGraphMetadata: this.bestGraphMetadata,
            _version: '3.0-dynamic-reference-synchronized',
            _savedAt: new Date().toISOString()
        };

        if (this.templateBuilder) {
            data.templateBuilder = this.templateBuilder.toJSON();
        }

        if (this.sourceGraphs.size > 0) {
            data.sourceGraphs = Array.from(this.sourceGraphs.values());
        }

        return data;
    }

    static fromJSON(data) {
        const model = new VectorSuperModel({
            name: data.name,
            matchThreshold: data.config?.matchThreshold,
            decisionThreshold: 0.6,
            enableDynamicReference: data.config?.enableDynamicReference !== false
        });

        model.id = data.id || model.id;
        model.stats = data.stats || model.stats;
        model.config = data.config || model.config;

        if (model.config.similarityThresholds) {
            model.config.similarityThresholds.SAME = 0.6;
            model.config.similarityThresholds.SIMILAR = 0.4;
        }

        if (data.templateBuilder) {
            try {
                model.templateBuilder = TemplateBuilder.fromJSON(data.templateBuilder);
                console.log(`📂 Восстановлен TemplateBuilder`);
            } catch (error) {
                console.log(`⚠️ Ошибка восстановления TemplateBuilder:`, error.message);
                model.templateBuilder = new TemplateBuilder({
                    name: model.name,
                    enableDynamicReference: model.config.enableDynamicReference,
                    decisionThreshold: 0.6
                });
            }
        }

        if (data.bestGraphId) {
            model.bestGraphId = data.bestGraphId;
            model.bestGraphScore = data.bestGraphScore || 0;
            model.bestGraphMetadata = data.bestGraphMetadata || null;
        }

        if (data.sourceGraphs && Array.isArray(data.sourceGraphs)) {
            data.sourceGraphs.forEach(graphData => {
                if (graphData.graphId) {
                    model.sourceGraphs.set(graphData.graphId, graphData);
                }
            });
            model.stats.sourceGraphsCount = model.sourceGraphs.size;
        }

        console.log(`📂 Загружена ШАБЛОННАЯ супер-модель "${model.name}" с СИНХРОНИЗИРОВАННЫМИ порогами`);
        console.log(`   Ячеек шаблона: ${model.templateBuilder?.invariantCells?.size || 0}`);
        console.log(`   Лучший граф: ${model.bestGraphId || 'нет'}`);

        return model;
    }
}

module.exports = VectorSuperModel;
