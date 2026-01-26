// modules/footprint/vector-super-model.js
// 🔥 ИСПРАВЛЕННАЯ ВЕРСИЯ ДЛЯ ИНТЕГРАЦИИ С COORDINATE DIRECTOR

const TemplateBuilder = require('./template-builder');

class VectorSuperModel {
    constructor(options = {}) {
        this.id = `vsm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Шаблонная супер-модель';

        // 🔥 ССЫЛКА НА МЕНЕДЖЕР ДЛЯ ДОСТУПА К COORDINATE DIRECTOR
        this.manager = options.manager || null;

        // 🔥 СИНХРОНИЗИРУЕМ ПОРОГИ С simple-manager.js
        this.config = {
            matchThreshold: 0.05,
            decisionThreshold: 0.6,
            minConfirmationsForHighConfidence: 2,
            bestGraphMinNodes: options.bestGraphMinNodes || 15,
            enableTemplateMode: true,
            enableDynamicReference: true,
            guaranteeCanonicalSystem: options.guaranteeCanonicalSystem !== false,

            similarityThresholds: {
                SAME: 0.6,
                SIMILAR: 0.4,
                DIFFERENT: 0.0
            },

            referenceUpdateThreshold: 1.15,
            minQualityForReference: 0.4,
            ...options
        };

        console.log(`🎯 VECTOR-MODEL пороги СИНХРОНИЗИРОВАНЫ:`);
        console.log(`   Решающий порог (SAME): ${this.config.similarityThresholds.SAME}`);
        console.log(`   Гарантия канонической системы: ${this.config.guaranteeCanonicalSystem ? '✅' : '❌'}`);

        // 🔥 TEMPLATE BUILDER
        this.templateBuilder = new TemplateBuilder({
            name: `Шаблон_${this.name}`,
            enablePCA: false,
            cellSize: 25,
            matchThreshold: 0.05,
            decisionThreshold: 0.6,
            coordinateManager: options.coordinateManager,
            useCoordinateManager: options.useCoordinateManager !== false,
            guaranteeCanonicalSystem: this.config.guaranteeCanonicalSystem,
            manager: this.manager,
            ...options
        });

        this.nodes = [];
        this.sourceGraphs = new Map();
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
            avgConfirmations: 0,
            thresholds: {
                match: this.config.matchThreshold,
                decision: this.config.decisionThreshold,
                same: this.config.similarityThresholds.SAME,
                similar: this.config.similarityThresholds.SIMILAR
            },
            coordinateSystem: {
                guaranteedCanonical: this.config.guaranteeCanonicalSystem,
                registeredInDirector: false
            }
        };

        console.log(`🏗️ Создана ШАБЛОННАЯ векторная супер-модель "${this.name}"`);
    }

    checkDecisionWithSynchronizedThreshold(similarity) {
        console.log(`🎯 [VECTOR-MODEL] Проверка решения с синхронизированным порогом:`);
        console.log(`   Сходство: ${similarity.toFixed(3)}`);
        console.log(`   Порог "SAME": ${this.config.similarityThresholds.SAME}`);

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

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Добавить граф
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} к супер-модели...`);

        // 🔥 ГАРАНТИЯ КАНОНИЧЕСКОЙ СИСТЕМЫ
        if (this.config.guaranteeCanonicalSystem && this.manager?.coordinateDirector && graph.transformation) {
            console.log('🎯 ПРИВЕДЕНИЕ ГРАФА К КАНОНИЧЕСКОЙ СИСТЕМЕ...');
           
            const canonicalTrans = this.manager.coordinateDirector.enforceCanonicalSystem(
                `vector_model_${graphId}`,
                graph.transformation
            );
           
            graph.transformation = canonicalTrans;
           
            if (metadata.transformationInfo) {
                metadata.transformationInfo = canonicalTrans;
            }
           
            console.log(`✅ Граф приведен к канонической системе: ${canonicalTrans.rotationAngle}°`);
        }

        console.log(`🔍 Входные данные:`);
        console.log(`   Граф ID: ${graphId}`);
        console.log(`   Узлов в графе: ${graph?.nodes?.size || 0}`);
        console.log(`   Сходство из metadata: ${metadata.similarity || 'нет'}`);
        console.log(`   Каноническая система: ${graph.transformation?.rotationAngle || 0}°`);

        // 🔥 ПРОВЕРЯЕМ ПОРОГИ ИЗ МЕТАДАННЫХ
        if (metadata.similarity !== undefined) {
            const decisionCheck = this.checkDecisionWithSynchronizedThreshold(metadata.similarity);
            const syncCheck = this.compareWithSimpleManagerThreshold(metadata.similarity);
           
            console.log(`📊 Решение из simple-manager: ${metadata.similarity.toFixed(3)} -> ${decisionCheck.decision}`);
           
            if (!syncCheck.isSynchronized || !syncCheck.decisionsMatch) {
                console.log(`⚠️ [VECTOR-MODEL-WARN] Расхождение порогов!`);
               
                // 🔥 ПРИНИМАЕМ РЕШЕНИЕ ОТ SIMPLE-MANAGER
                metadata.vectorDecisionOverride = syncCheck.simpleManagerDecision;
                metadata.vectorDecisionOverrideReason = 'Приоритет simple-manager при расхождении';
            } else {
                metadata.vectorDecision = decisionCheck.decision;
                metadata.vectorDecisionReason = decisionCheck.reason;
                metadata.vectorThresholdUsed = decisionCheck.thresholdUsed;
            }
        }

        // 🔥 РЕГИСТРИРУЕМ СИСТЕМУ В COORDINATE DIRECTOR
        if (this.manager?.coordinateDirector && !this.stats.coordinateSystem.registeredInDirector) {
            this.manager.coordinateDirector.registerSystem(
                `vector_model_${this.id}`,
                graph.transformation || { rotationAngle: 0, center: { x: 500, y: 500 } }
            );
            this.stats.coordinateSystem.registeredInDirector = true;
            console.log(`📝 VectorModel зарегистрирована в CoordinateDirector`);
        }

        // 1. Сохраняем исходный граф
        this.saveSourceGraph(graph, graphId, metadata);

        // 2. ДОБАВЛЯЕМ К TEMPLATE BUILDER
        let addedToTemplate = false;

        if (this.templateBuilder.referenceGraphId === null) {
            console.log(`🎯 Устанавливаю граф ${graphId} как начальный эталон`);
            addedToTemplate = this.templateBuilder.setReferenceGraph(graph, graphId, metadata);

            if (addedToTemplate) {
                this.bestGraphId = graphId;
                this.bestGraphScore = this.calculateGraphScore(graph);
                this.bestGraphMetadata = metadata;
                console.log(`🏆 Начальный эталон установлен: ${graphId}`);
            }
        } else {
            addedToTemplate = this.templateBuilder.addGraph(graph, graphId, metadata);

            if (addedToTemplate) {
                const newReferenceId = this.templateBuilder.referenceGraphId;

                if (newReferenceId !== this.bestGraphId) {
                    console.log(`🔄 ОБНОВЛЕНИЕ ЭТАЛОНА В СУПЕР-МОДЕЛИ:`);
                    console.log(`   Старый: ${this.bestGraphId}`);
                    console.log(`   Новый: ${newReferenceId}`);

                    this.bestGraphId = newReferenceId;
                    this.bestGraphScore = this.templateBuilder.referenceGraphQuality;

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
            return false;
        }

        this.stats.totalMerges++;
        this.stats.totalGraphsAdded++;
        this.stats.lastUpdated = new Date();
        this.updateStats();

        const templateInfo = this.templateBuilder.getInfo();

        console.log(`✅ Граф добавлен. Статистика:`);
        console.log(`   Ячеек шаблона: ${templateInfo.templateCells}`);
        console.log(`   Подтвержденных ячеек: ${templateInfo.stats.confirmedCells}`);
        console.log(`   Лучший граф: ${this.bestGraphId} (${this.bestGraphScore.toFixed(3)})`);
        console.log(`   Всего графов: ${this.stats.sourceGraphsCount}`);

        return true;
    }

    compareWithSimpleManagerThreshold(similarity) {
        const simpleManagerThreshold = 0.6;

        console.log(`\n🔍 [SYNC-CHECK] Сравнение порогов:`);
        console.log(`   simple-manager порог: ${simpleManagerThreshold}`);
        console.log(`   vector-model порог: ${this.config.similarityThresholds.SAME}`);
        console.log(`   Сходство: ${similarity.toFixed(3)}`);

        const isSynchronized = Math.abs(this.config.similarityThresholds.SAME - simpleManagerThreshold) < 0.01;
        const simpleManagerDecision = similarity >= simpleManagerThreshold ? 'same' : 'different';
        const vectorModelDecision = similarity >= this.config.similarityThresholds.SAME ? 'same' : 'different';

        console.log(`   Пороги синхронизированы: ${isSynchronized ? '✅' : '❌'}`);
        console.log(`   Решение simple-manager: ${simpleManagerDecision}`);
        console.log(`   Решение vector-model: ${vectorModelDecision}`);

        return {
            isSynchronized,
            simpleManagerDecision,
            vectorModelDecision,
            decisionsMatch: simpleManagerDecision === vectorModelDecision
        };
    }

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
                },
                coordinateSystem: {
                    guaranteedCanonical: this.config.guaranteeCanonicalSystem,
                    registeredInDirector: this.stats.coordinateSystem.registeredInDirector
                }
            }
        };
    }

    getTemplateStats() {
        if (!this.templateBuilder) return null;

        const templateInfo = this.templateBuilder.getInfo();
        const zones = this.templateBuilder.calculateZones ?
            this.templateBuilder.calculateZones() : {};

        return {
            templateId: this.templateBuilder.id,
            cells: {
                total: templateInfo.templateCells,
                confirmed: templateInfo.stats.confirmedCells,
                highConfidence: templateInfo.stats.highConfidenceCells,
                avgConfirmations: templateInfo.stats.avgConfirmations?.toFixed(2) || '0.00'
            },
            referenceGraphId: this.templateBuilder.referenceGraphId,
            referenceGraphQuality: this.templateBuilder.referenceGraphQuality,
            zones: zones,
            alignmentStats: {
                totalGraphs: templateInfo.stats.totalGraphs,
                transformations: this.templateBuilder.graphTransformations?.size || 0,
                avgError: templateInfo.stats.alignmentError?.toFixed(3) || '0.000'
            }
        };
    }

    getInfo() {
        const templateStats = this.getTemplateStats();
        const bestGraphInfo = this.bestGraphId ? {
            bestGraphId: this.bestGraphId,
            bestGraphScore: Math.round(this.bestGraphScore * 1000) / 1000,
            bestGraphUpdates: this.stats.bestGraphUpdates,
            bestGraphNodeCount: this.sourceGraphs.get(this.bestGraphId)?.nodeCount || 0
        } : {};

        const allGraphsInfo = [];
        for (const [graphId, graphData] of this.sourceGraphs) {
            allGraphsInfo.push({
                id: graphId,
                nodeCount: graphData.nodeCount,
                edgeCount: graphData.edgeCount,
                quality: this.templateBuilder.graphQualities.get(graphId) || 0,
                isBest: graphId === this.bestGraphId,
                isReference: graphId === this.templateBuilder.referenceGraphId
            });
        }

        allGraphsInfo.sort((a, b) => b.quality - a.quality);

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
            graphs: {
                total: allGraphsInfo.length,
                bestQuality: allGraphsInfo.length > 0 ? allGraphsInfo[0].quality : 0,
                referenceQuality: this.templateBuilder.referenceGraphQuality || 0,
                list: allGraphsInfo.slice(0, 5)
            },
            config: this.config,
            hasTemplate: !!this.templateBuilder.referenceGraphId,
            dynamicReferenceEnabled: this.config.enableDynamicReference,
            thresholdsSynchronized: {
                withSimpleManager: true,
                sameThreshold: this.config.similarityThresholds.SAME,
                note: 'Пороги синхронизированы с simple-manager.js (0.6 для SAME)'
            },
            coordinateSystem: {
                guaranteedCanonical: this.config.guaranteeCanonicalSystem,
                registeredInDirector: this.stats.coordinateSystem.registeredInDirector,
                directorAvailable: !!this.manager?.coordinateDirector
            }
        };
    }

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

    static fromJSON(data) {
        const model = new VectorSuperModel({
            name: data.name,
            matchThreshold: data.config?.matchThreshold,
            decisionThreshold: 0.6,
            enableDynamicReference: data.config?.enableDynamicReference !== false,
            guaranteeCanonicalSystem: data.config?.guaranteeCanonicalSystem !== false
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
                    decisionThreshold: 0.6,
                    guaranteeCanonicalSystem: model.config.guaranteeCanonicalSystem
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

        if (model.stats.createdAt && typeof model.stats.createdAt === 'string') {
            model.stats.createdAt = new Date(model.stats.createdAt);
        }
        if (model.stats.lastUpdated && typeof model.stats.lastUpdated === 'string') {
            model.stats.lastUpdated = new Date(model.stats.lastUpdated);
        }

        console.log(`📂 Загружена супер-модель "${model.name}"`);
        console.log(`   Ячеек шаблона: ${model.templateBuilder?.templateCells?.size || 0}`);
        console.log(`   Лучший граф: ${model.bestGraphId || 'нет'}`);

        return model;
    }

    toJSON() {
        const data = {
            id: this.id,
            name: this.name,
            stats: this.stats,
            config: this.config,
            bestGraphId: this.bestGraphId,
            bestGraphScore: this.bestGraphScore,
            bestGraphMetadata: this.bestGraphMetadata,
            _version: '3.0-coordinate-director-integration',
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

    getBestGraph() {
        if (!this.bestGraphId || !this.sourceGraphs.has(this.bestGraphId)) {
            return null;
        }

        const source = this.sourceGraphs.get(this.bestGraphId);

        if (source.graph) {
            return source.graph;
        }

        if (source.graphData) {
            return this.reconstructGraph(source.graphData);
        }

        return null;
    }

    reconstructGraph(graphData) {
        const SimpleGraph = require('./simple-graph');
        const graph = new SimpleGraph('Восстановленный граф');

        if (graphData.nodes) {
            const points = graphData.nodes.map(node => ({
                x: node.x,
                y: node.y,
                confidence: node.confidence || 0.5,
                id: node.id
            }));

            graph.buildFromPoints(points);
        }

        return graph;
    }

    getBestGraphInfo() {
        if (!this.bestGraphId || !this.sourceGraphs.has(this.bestGraphId)) {
            return null;
        }

        const source = this.sourceGraphs.get(this.bestGraphId);
        return {
            graphId: this.bestGraphId,
            score: this.bestGraphScore,
            nodeCount: source.nodeCount,
            edgeCount: source.edgeCount,
            addedAt: source.addedAt,
            metadata: source.metadata,
            canVisualize: !!(source.graph || source.graphData)
        };
    }
}

module.exports = VectorSuperModel;
