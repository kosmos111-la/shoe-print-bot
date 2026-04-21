// modules/footprint/topology/GraphProcessor.js
// 🔷 ПРОЦЕССОР ГРАФОВ - построение, обработка, делегирование улучшения

const GraphBuilder = require('./GraphBuilder');
const KNNGraphBuilder = require('./KNNGraphBuilder');
const MorphologyEncoder = require('./MorphologyEncoder');
const TopologicalFingerprint = require('./TopologicalFingerprint');
const PatternAnalyzer = require('../analysis/PatternAnalyzer');
const ClusterAnalyzer = require('../analysis/ClusterAnalyzer');
const RoleClassifier = require('./utils/RoleClassifier');
const ModelEnhancer = require('./enhancers/ModelEnhancer');
const ValidationModule = require('../validation/ValidationModule');

class GraphProcessor {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.fastMode = options.fastMode || false;
       
        // Компоненты для построения графов
        this.graphBuilder = new GraphBuilder({ debug: this.debug });
        this.knnBuilder = new KNNGraphBuilder({
            debug: this.debug,
            k: options.k || 8
        });
       
        // Компоненты для анализа
        this.morphologyEncoder = new MorphologyEncoder({ debug: this.debug });
        this.fingerprinter = new TopologicalFingerprint({
            debug: this.debug,
            iterations: options.wlIterations || 3,
            structuralSimilarityThreshold: 0.5
        });
        this.patternAnalyzer = new PatternAnalyzer({ debug: this.debug });
        this.clusterAnalyzer = new ClusterAnalyzer({ debug: this.debug });
        this.roleClassifier = new RoleClassifier({
            hubThreshold: options.hubThreshold || 6
        });
       
        // Валидатор и энхансер
        this.validator = options.validator || new ValidationModule({
            debug: this.debug,
            positionThreshold: options.positionThreshold || 0.15,
            morphologyThreshold: options.morphologyThreshold || 0.85
        });
       
        this.modelEnhancer = null; // Ленивая инициализация
       
        console.log('🔷 GraphProcessor создан');
    }

    // ==================== ЛЕНИВАЯ ИНИЦИАЛИЗАЦИЯ ====================

    _getModelEnhancer() {
        if (!this.modelEnhancer) {
            this.modelEnhancer = new ModelEnhancer({
                debug: this.debug,
                fastMode: this.fastMode,
                validator: this.validator,
                roleClassifier: this.roleClassifier,
                positionThreshold: this.validator.positionThreshold,
                morphologyThreshold: this.validator.morphologyThreshold
            });
        }
        return this.modelEnhancer;
    }

    // ==================== ПОСТРОЕНИЕ ГРАФОВ ====================

    /**
     * Построить все графы и морфологию из точек
     */
    buildGraphs(points, contours, source) {
        const exactGraph = this.graphBuilder.buildGraph(points, source);
        const knnGraph = this.knnBuilder.buildGraph(points, `${source}_knn`);
        const morphologyMap = this.morphologyEncoder.encode(points, contours);
        const knnFingerprints = this.fingerprinter.computeGraphFingerprints(knnGraph);
       
        return {
            exactGraph,
            knnGraph,
            morphologyMap,
            knnFingerprints
        };
    }

    // ==================== СОЗДАНИЕ НОВОЙ МОДЕЛИ ====================

    /**
     * Создать новую модель из графов
     */
    createModelFromGraphs(graphs, originalPoints, options = {}) {
        const { exactGraph, knnFingerprints, morphologyMap } = graphs;
       
        // Извлекаем точки для анализа
        const points = Array.from(exactGraph.nodes.values());
       
        // Собираем признаки для кластеризации
        const features = new Map();
        for (const point of points) {
            const morph = morphologyMap.get(point.id) || {};
            features.set(point.id, {
                id: point.id,
                role: this.roleClassifier.classifySimple(point.id, exactGraph),
                degree: point.degree || 0,
                triangles: point.triangles || 0,
                morphology: morph,
                neighborRoles: this._getNeighborRoles(point.id, exactGraph),
                compactness: morph.compactness,
                eccentricity: morph.eccentricity,
                normalizedArea: morph.normalizedArea,
                radialProfile: morph.radialProfile,
                asymetry: morph.asymmetry || 0
            });
        }
       
        // Анализируем паттерны и кластеры
        const tempModel = { graph: exactGraph, morphologyMap };
        const patternData = this.patternAnalyzer.analyzeFootprint(tempModel);
        const clusterData = this.clusterAnalyzer.analyze(points, features, exactGraph);
       
        // Обогащаем узлы графа
        for (const [nodeId, node] of exactGraph.nodes) {
            const morph = morphologyMap.get(nodeId) || {};
            const cluster = clusterData.enhancedFeatures?.get(nodeId);
           
            node.morphology = morph;
            node.hasContour = morph.hasContour || false;
            node.compactness = morph.compactness;
            node.eccentricity = morph.eccentricity;
            node.orientation = morph.orientation;
            node.normalizedArea = morph.normalizedArea;
            node.radialProfile = morph.radialProfile;
            node.asymmetry = morph.asymmetry || 0;
           
            if (cluster) {
                node.clusterId = cluster.clusterId || 'R0';
                node.clusterSize = cluster.clusterSize || 1;
                node.isUnique = cluster.isUnique || false;
            }
           
            node.patternType = patternData.patterns?.[nodeId]?.type || 'R';
            node.patternFrequency = patternData.patterns?.[nodeId]?.frequency || 1;
            node.gapPattern = patternData.gaps?.[nodeId] || '0';
           
            node.confirmationCount = 1;
            node.addedFrom = 'original';
            node.addedAt = new Date();
        }
       
        // Формируем данные модели
        const modelData = {
            graph: exactGraph,
            knnGraph: graphs.knnGraph,
            knnFingerprints,
            morphologyMap,
            originalPoints,
            patternData,
            clusterData,
            metadata: {
                name: options.name || `Модель_${new Date().toLocaleTimeString('ru-RU')}`,
                photoCount: 1,
                source: options.source || 'unknown',
                outlineContour: options.outlineContour || null
            },
            history: [{
                action: 'created',
                timestamp: new Date(),
                points: originalPoints.length,
                nodes: exactGraph.nodes.size
            }]
        };
       
        if (this.debug) {
            console.log(`🔷 GraphProcessor: создана модель с ${exactGraph.nodes.size} узлами`);
        }
       
        return modelData;
    }

    /**
     * Получить роли соседей (строка)
     */
    _getNeighborRoles(nodeId, graph) {
        const neighbors = [];
        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (a === nodeId) neighbors.push(b);
            if (b === nodeId) neighbors.push(a);
        }
       
        const roles = [];
        for (const neighborId of neighbors) {
            const role = this.roleClassifier.classifySimple(neighborId, graph);
            roles.push(role);
        }
       
        return roles.sort().join('');
    }

    // ==================== УЛУЧШЕНИЕ МОДЕЛИ ====================

    /**
     * Улучшить существующую модель новым фото
     */
    async enhanceModel(existingModel, newGraphs, originalPoints, options = {}) {
        const { exactGraph, morphologyMap } = newGraphs;
        const { photoId, contours, outlineContour } = options;
       
        if (this.debug) {
            console.log(`🔷 GraphProcessor: улучшение модели ${existingModel.id?.substring(0, 12)}...`);
        }
       
        const enhancer = this._getModelEnhancer();
       
        const result = await enhancer.enhance(
            existingModel,
            exactGraph,
            morphologyMap,
            originalPoints,
            { photoId, contours, outlineContour, fastMode: this.fastMode }
        );
       
        return result;
    }

    // ==================== СРАВНЕНИЕ ГРАФОВ ====================

    /**
     * Сравнить два графа через WL-подписи
     */
    compareGraphs(graph1, fingerprints1, graph2, fingerprints2) {
        return this.fingerprinter.compareGraphs(
            graph1, fingerprints1,
            graph2, fingerprints2
        );
    }

    // ==================== ИЗВЛЕЧЕНИЕ ТОЧЕК ====================

    /**
     * Извлечь точки из модели (для треугольного сравнения)
     */
    extractPointsFromModel(model) {
        const points = [];
        const graph = model.graph;
        const morphologyMap = model.morphologyMap || new Map();
       
        for (const [nodeId, node] of graph.nodes) {
            const morph = morphologyMap.get(nodeId) || {};
           
            points.push({
                id: nodeId,
                x: node.x,
                y: node.y,
                role: this.roleClassifier.classifySimple(nodeId, graph),
                degree: node.degree || 0,
                triangles: node.triangles || 0,
               
                // Морфология
                compactness: morph.compactness || 0,
                eccentricity: morph.eccentricity || 0,
                normalizedArea: morph.normalizedArea || 1,
                radialProfile: morph.radialProfile || [0, 0, 0, 0, 0, 0, 0, 0],
                orientation: morph.orientation || 0,
                asymetry: morph.asymmetry || 0,
               
                contour: morph.contour || null,
                neighborRoles: this._getNeighborRoles(nodeId, graph)
            });
        }
       
        return points;
    }

    // ==================== СТАТИСТИКА ====================

    /**
     * Получить статистику процессора
     */
    getStats() {
        return {
            fingerprinter: this.fingerprinter ? {
                cacheSize: this.fingerprinter.hashCache?.size || 0
            } : null,
            morphologyEncoder: this.morphologyEncoder?.getStats() || null,
            modelEnhancer: this.modelEnhancer?.stats || null
        };
    }

    /**
     * Очистить кеши
     */
    clearCaches() {
        if (this.fingerprinter) {
            this.fingerprinter.clearCache();
        }
        if (this.morphologyEncoder) {
            this.morphologyEncoder.clearCache();
        }
    }
}

module.exports = GraphProcessor;
