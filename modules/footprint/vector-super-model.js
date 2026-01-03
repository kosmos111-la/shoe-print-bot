// modules/footprint/vector-super-model.js
// ПЕРЕРАБОТАННАЯ ВЕКТОРНАЯ СУПЕР-МОДЕЛЬ С ШАБЛОНАМИ

const TemplateBuilder = require('./template-builder');

class VectorSuperModel {
    constructor(options = {}) {
        this.id = `vsm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Шаблонная супер-модель';

        // 🔥 ЗАМЕНЯЕМ СТАРУЮ ЛОГИКУ НА TEMPLATE BUILDER
        this.templateBuilder = new TemplateBuilder({
            name: `Шаблон_${this.name}`,
            enablePCA: false, // 🔥 ОТКЛЮЧАЕМ PCA
            cellSize: 25,     // 🔥 УВЕЛИЧИВАЕМ РАЗМЕР ЯЧЕЙКИ
            ...options
        });

        // Для совместимости сохраняем старые поля
        this.nodes = []; // Устарело, но оставляем

        // 🔥 Храним ссылки на исходные графы
        this.sourceGraphs = new Map(); // graphId -> {graph, metadata, nodeCount, addedAt}

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

        // Минимальные настройки
        this.config = {
            matchThreshold: options.matchThreshold || 0.08,
            minConfirmationsForHighConfidence: 2,
            bestGraphMinNodes: options.bestGraphMinNodes || 15,
            enableTemplateMode: true, // 🔥 ВКЛЮЧАЕМ ШАБЛОННЫЙ РЕЖИМ
            ...options
        };

        console.log(`🏗️ Создана ШАБЛОННАЯ векторная супер-модель "${this.name}"`);
    }

    // 🔥 УПРОЩЕННЫЙ МЕТОД: добавить граф в шаблон
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} в шаблонную модель...`);

        // 1. Сохраняем исходный граф
        this.saveSourceGraph(graph, graphId, metadata);

        // 2. 🔥 УПРОЩАЕМ ЛОГИКУ
        let addedToTemplate = false;

        if (this.templateBuilder.referenceGraphId === null) {
            // Первый граф - устанавливаем как эталон
            console.log(`🎯 Устанавливаю граф ${graphId} как эталон шаблона`);
            addedToTemplate = this.templateBuilder.setReferenceGraph(graph, graphId, metadata);

            if (addedToTemplate) {
                // Это лучший граф по умолчанию
                this.bestGraphId = graphId;
                this.bestGraphScore = this.calculateGraphScore(graph);
                this.bestGraphMetadata = metadata;
                console.log(`🏆 Эталон установлен как лучший след: ${graphId}`);
            }
        } else {
            // Последующие графы - добавляем к шаблону
            addedToTemplate = this.templateBuilder.addGraph(graph, graphId, metadata);

            if (addedToTemplate) {
                // Оцениваем как кандидата на лучший
                const score = this.calculateGraphScore(graph);
                console.log(`📈 Оценка графа ${graphId}: ${score.toFixed(3)}`);

                if (score > this.bestGraphScore * 1.1) { // На 10% лучше
                    this.bestGraphId = graphId;
                    this.bestGraphScore = score;
                    this.bestGraphMetadata = metadata;
                    this.stats.bestGraphUpdates++;
                    console.log(`🏆 НОВЫЙ ЛУЧШИЙ СЛЕД: ${graphId} (оценка: ${score.toFixed(3)})`);
                }
            }
        }

        if (!addedToTemplate) {
            console.log(`⚠️ Граф ${graphId} не добавлен к шаблону`);
            return false;
        }

        // 3. Обновить статистику
        this.stats.totalMerges++;
        this.stats.totalGraphsAdded++;
        this.stats.lastUpdated = new Date();
        this.updateStats();

        // 4. Получить информацию о шаблоне
        const templateInfo = this.templateBuilder.getInfo();

        console.log(`✅ Граф добавлен к шаблону. Статистика:`);
        console.log(`   Ячеек шаблона: ${templateInfo.templateCells}`);
        console.log(`   Подтвержденных ячеек: ${templateInfo.stats.confirmedCells}`);
        console.log(`   Среднее подтверждений: ${templateInfo.stats.avgConfirmations?.toFixed(2) || 0}`);

        return true;
    }

    // 🔥 СОХРАНИТЬ ИСХОДНЫЙ ГРАФ (без изменений)
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

    // 🔥 РАСЧЁТ ОЦЕНКИ ГРАФА (без изменений)
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

    // 🔥 ОБНОВИТЬ СТАТИСТИКУ
    updateStats() {
        // Получаем статистику из TemplateBuilder
        const templateInfo = this.templateBuilder.getInfo();

        if (!templateInfo || templateInfo.templateCells === 0) {
            this.stats.confidence = 0;
            return;
        }

        const confirmedRatio = templateInfo.stats.confirmedCells / templateInfo.templateCells;
        const avgConfirmations = templateInfo.stats.avgConfirmations || 0;

        // 🔥 ДОБАВЛЯЕМ ФАКТОР ШАБЛОНА
        const templateQuality = Math.min(1,
            confirmedRatio * 0.6 + // 60% за долю подтвержденных ячеек
            Math.min(0.3, avgConfirmations * 0.1) // 30% за среднее подтверждений
        );

        // 🔥 ДОБАВЛЯЕМ ФАКТОР ЛУЧШЕГО ГРАФА
        const bestGraphBonus = this.bestGraphScore * 0.1; // 10% бонуса

        this.stats.confidence = Math.min(1.0, templateQuality + bestGraphBonus);

        // Обновляем статистику
        this.stats.templateCells = templateInfo.templateCells;
        this.stats.confirmedCells = templateInfo.stats.confirmedCells;
        this.stats.avgConfirmations = avgConfirmations;
        this.stats.bestGraphId = this.bestGraphId;
        this.stats.bestGraphScore = this.bestGraphScore;
    }

    // 🔥 ПОЛУЧИТЬ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ (ОСНОВАННЫЕ НА ШАБЛОНЕ)
    getVisualizationData() {
        // 🔥 ИСПОЛЬЗУЕМ ДАННЫЕ ИЗ TEMPLATE BUILDER
        const templateData = this.templateBuilder.getVisualizationData();

        // Добавляем информацию о супер-модели
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
                sourceGraphsCount: this.stats.sourceGraphsCount
            }
        };
    }

    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧИТЬ СТАТИСТИКУ ШАБЛОНА
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
            zones: zones,
            alignmentStats: {
                totalGraphs: templateInfo.totalGraphs,
                transformations: this.templateBuilder.graphTransformations?.size || 0,
                avgError: templateInfo.stats.alignmentError?.toFixed(3) || '0.000'
            }
        };
    }

    // 🔥 МЕТОД: ПОЛУЧИТЬ ИНФОРМАЦИЮ (ОБНОВЛЕННАЯ)
    getInfo() {
        const templateStats = this.getTemplateStats();
        const bestGraphInfo = this.bestGraphId ? {
            bestGraphId: this.bestGraphId,
            bestGraphScore: Math.round(this.bestGraphScore * 1000) / 1000,
            bestGraphUpdates: this.stats.bestGraphUpdates
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
            hasTemplate: !!this.templateBuilder.referenceGraphId
        };
    }

    // 🔥 ЗАГРУЗИТЬ ИЗ JSON (ОБНОВЛЕННЫЙ)
    static fromJSON(data) {
        const model = new VectorSuperModel({
            name: data.name,
            matchThreshold: data.config?.matchThreshold
        });

        model.id = data.id || model.id;
        model.stats = data.stats || model.stats;
        model.config = data.config || model.config;

        // 🔥 ВОССТАНАВЛИВАЕМ TEMPLATE BUILDER
        if (data.templateBuilder) {
            try {
                model.templateBuilder = TemplateBuilder.fromJSON(data.templateBuilder);
                console.log(`📂 Восстановлен TemplateBuilder с ${model.templateBuilder.templateCells.size} ячейками`);
            } catch (error) {
                console.log(`⚠️ Ошибка восстановления TemplateBuilder:`, error.message);
                model.templateBuilder = new TemplateBuilder({ name: model.name });
            }
        }

        // Восстанавливаем лучший граф
        if (data.bestGraphId) {
            model.bestGraphId = data.bestGraphId;
            model.bestGraphScore = data.bestGraphScore || 0;
            model.bestGraphMetadata = data.bestGraphMetadata || null;
        }

        // Восстанавливаем исходные графы
        if (data.sourceGraphs && Array.isArray(data.sourceGraphs)) {
            data.sourceGraphs.forEach(graphData => {
                if (graphData.graphId) {
                    model.sourceGraphs.set(graphData.graphId, graphData);
                }
            });
            model.stats.sourceGraphsCount = model.sourceGraphs.size;
        }

        // Восстановить даты
        if (model.stats.createdAt && typeof model.stats.createdAt === 'string') {
            model.stats.createdAt = new Date(model.stats.createdAt);
        }
        if (model.stats.lastUpdated && typeof model.stats.lastUpdated === 'string') {
            model.stats.lastUpdated = new Date(model.stats.lastUpdated);
        }

        console.log(`📂 Загружена ШАБЛОННАЯ супер-модель "${model.name}"`);
        console.log(`   Ячеек шаблона: ${model.templateBuilder?.templateCells?.size || 0}`);
        console.log(`   Лучший граф: ${model.bestGraphId || 'нет'}`);

        return model;
    }

    // 🔥 СОХРАНИТЬ В JSON (ОБНОВЛЕННЫЙ)
    toJSON() {
        const data = {
            id: this.id,
            name: this.name,
            stats: this.stats,
            config: this.config,
            bestGraphId: this.bestGraphId,
            bestGraphScore: this.bestGraphScore,
            bestGraphMetadata: this.bestGraphMetadata,
            _version: '2.0', // 🔥 ОБНОВИЛИ ВЕРСИЮ ДЛЯ ШАБЛОННОЙ МОДЕЛИ
            _savedAt: new Date().toISOString()
        };

        // 🔥 СОХРАНЯЕМ TEMPLATE BUILDER
        if (this.templateBuilder) {
            data.templateBuilder = this.templateBuilder.toJSON();
        }

        // Сохраняем исходные графы
        if (this.sourceGraphs.size > 0) {
            data.sourceGraphs = Array.from(this.sourceGraphs.values());
        }

        return data;
    }

    // ============ СТАРЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ ============

    // 🔥 ОСТАВЛЯЕМ ДЛЯ СОВМЕСТИМОСТИ, НО ПОМЕЧАЕМ КАК УСТАРЕВШИЕ
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
        // Для совместимости
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
