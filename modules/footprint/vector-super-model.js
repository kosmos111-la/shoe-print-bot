// modules/footprint/vector-super-model.js
const TemplateBuilder = require('./template-builder');

class VectorSuperModel {
    constructor(options = {}) {
        this.id = `vsm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Векторная супер-модель (шаблонная)';

        // 🔥 ЗАМЕНЯЕМ узлы на TemplateBuilder (как в инструкции)
        this.templateBuilder = new TemplateBuilder({
            name: options.name || 'Векторная супер-модель (шаблонная)',
            ...options
        });

        // Убираем старые nodes, оставляем для совместимости (как в инструкции)
        this.nodes = []; // Для совместимости, но не используем

        // 🔥 Сохраняем исходные графы
        this.sourceGraphs = new Map();
        this.bestGraphId = null;
        this.bestGraphScore = 0;
        this.bestGraphMetadata = null;

        // 🔥 Статистика
        this.stats = {
            totalMerges: 0,
            totalNodesAdded: 0,
            confidence: 0,
            createdAt: new Date(),
            lastUpdated: new Date(),
            bestGraphUpdates: 0,
            sourceGraphsCount: 0
        };

        this.config = {
            matchThreshold: options.matchThreshold || 0.08,
            minConfirmationsForHighConfidence: 2,
            bestGraphMinNodes: options.bestGraphMinNodes || 15,
            ...options
        };

        console.log(`🏗️ Создана ШАБЛОННАЯ векторная супер-модель "${this.name}"`);
    }

    // 🔥 ПЕРЕПИСЫВАЕМ addGraph (как в инструкции)
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} в шаблонную модель...`);

        // Сохраняем исходный граф (как было)
        this.saveSourceGraph(graph, graphId, metadata);

        // 🔥 ИСПОЛЬЗУЕМ TEMPLATE BUILDER (как в инструкции)
        const result = this.templateBuilder.addGraph(graph, graphId, metadata);

        if (result) {
            // Оцениваем как лучший граф (если нужно)
            this.evaluateGraphForBest(graph, graphId, metadata);

            // Обновляем статистику
            this.stats.totalMerges++;
            this.stats.lastUpdated = new Date();
            this.updateStats();

            console.log(`✅ Граф добавлен к шаблону. Ячеек: ${this.templateBuilder.templateCells.size}`);
        }

        return result;
    }

    // 🔥 ПЕРЕПИСЫВАЕМ getVisualizationData (как в инструкции)
    getVisualizationData() {
        // Используем данные из TemplateBuilder
        const templateData = this.templateBuilder.getVisualizationData();

        return {
            ...templateData,
            metadata: {
                ...templateData.metadata,
                id: this.id,
                name: this.name,
                merges: this.stats.totalMerges,
                createdAt: this.stats.createdAt,
                visualizationMethod: 'template_based'
            }
        };
    }

    // 🔥 ОБНОВЛЯЕМ updateStats (как в инструкции, но исправлена ошибка)
    updateStats() {
        const templateInfo = this.templateBuilder.getInfo();
       
        // 🔥 ИСПРАВЛЕНИЕ: templateInfo.stats.confirmedCells может быть undefined
        const confirmedCells = templateInfo.stats?.confirmedCells || 0;
        const templateCells = templateInfo.templateCells || 0;
        const avgConfirmations = templateInfo.stats?.avgConfirmations || 0;

        this.stats.confidence = Math.min(1.0,
            (confirmedCells / Math.max(1, templateCells)) * 0.6 +
            (avgConfirmations / 5) * 0.3 +
            (this.bestGraphScore || 0) * 0.1
        );

        // 🔥 Обновляем статистику (исправлено)
        this.stats.nodeCount = templateCells;
        this.stats.confirmedNodeCount = confirmedCells;
        this.stats.highConfidenceNodes = templateInfo.stats?.highConfidenceCells || 0;
        this.stats.avgConfirmations = avgConfirmations;
    }

    // 🔥 СОХРАНИТЬ ИСХОДНЫЙ ГРАФ (оставляем без изменений)
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

    // 🔥 ОЦЕНИТЬ ГРАФ КАК КАНДИДАТА НА "ЛУЧШИЙ" (оставляем без изменений)
    evaluateGraphForBest(graph, graphId, metadata) {
        const score = this.calculateGraphScore(graph);

        console.log(`📈 Оценка графа ${graphId}: ${score.toFixed(3)} (текущий лучший: ${this.bestGraphScore.toFixed(3)})`);

        if (score > this.bestGraphScore) {
            this.bestGraphId = graphId;
            this.bestGraphScore = score;
            this.bestGraphMetadata = metadata;
            this.stats.bestGraphUpdates++;

            console.log(`🏆 НОВЫЙ ЛУЧШИЙ СЛЕД: ${graphId}`);
            console.log(`   Узлов: ${graph.nodes ? graph.nodes.size : 0}`);
            console.log(`   Оценка: ${score.toFixed(3)}`);
        }
    }

    // 🔥 ПОЛУЧИТЬ ИНФОРМАЦИЮ (адаптируем для шаблонов)
    getInfo() {
        const templateInfo = this.templateBuilder.getInfo();
        const bestGraphInfo = this.bestGraphId ? {
            bestGraphId: this.bestGraphId,
            bestGraphScore: Math.round(this.bestGraphScore * 1000) / 1000,
            bestGraphUpdates: this.stats.bestGraphUpdates,
            sourceGraphsCount: this.stats.sourceGraphsCount
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
            templateStats: templateInfo.stats || {},
            templateCells: templateInfo.templateCells || 0,
            confirmedCells: templateInfo.stats?.confirmedCells || 0,
            config: this.config,
            hasBestGraph: !!this.bestGraphId
        };
    }

    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ - берем из оригинала без изменений
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

    normalizeNodeForSearch(node) {
        return {
            nx: Math.max(0, Math.min(1, (node.x || 0) / 1000)),
            ny: Math.max(0, Math.min(1, (node.y || 0) / 1000))
        };
    }

    // 🔥 fromJSON адаптируем для шаблонов
    static fromJSON(data) {
        const model = new VectorSuperModel({
            name: data.name,
            matchThreshold: data.config?.matchThreshold
        });

        model.id = data.id || model.id;
        model.stats = data.stats || model.stats;
        model.config = data.config || model.config;

        // 🔥 ВОССТАНАВЛИВАЕМ ШАБЛОН
        if (data.templateBuilder) {
            model.templateBuilder = TemplateBuilder.fromJSON(data.templateBuilder);
        }

        // Для обратной совместимости
        if (data.nodes && data.nodes.length > 0) {
            model.nodes = data.nodes;
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

        console.log(`📂 Загружена шаблонная векторная супер-модель "${model.name}"`);
       
        const templateInfo = model.templateBuilder.getInfo();
        console.log(`   Шаблонных ячеек: ${templateInfo.templateCells}, Лучший граф: ${model.bestGraphId || 'нет'}`);

        return model;
    }
}

module.exports = VectorSuperModel;
