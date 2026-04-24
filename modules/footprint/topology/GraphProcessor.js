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
       
        // 🔥 Если есть контур — добавляем его центр как якорную точку в граф
        let contourCenter = null;
        if (options.outlineContour && options.outlineContour.points && options.outlineContour.points.length > 0) {
            const contourPoints = options.outlineContour.points;
            let cx = 0, cy = 0;
            for (const p of contourPoints) {
                cx += p.x;
                cy += p.y;
            }
            cx /= contourPoints.length;
            cy /= contourPoints.length;
           
            contourCenter = { x: cx, y: cy };
           
            // Добавляем центр контура как узел в граф
            const contourAnchorId = `contour_anchor_${points.length}`;
            exactGraph.nodes.set(contourAnchorId, {
                id: contourAnchorId,
                x: cx,
                y: cy,
                confidence: 0.5,
                degree: 0,
                triangles: 0,
                confirmationCount: 999, // всегда подтверждена
                addedFrom: 'contour_anchor',
                addedAt: new Date(),
                isContourAnchor: true  // пометка
            });
           
            // Соединяем с ближайшими точками графа
            const nearestPoints = points
                .map(p => ({ id: p.id, dist: Math.sqrt(Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2)) }))
                .sort((a, b) => a.dist - b.dist)
                .slice(0, 3);
           
            for (const np of nearestPoints) {
                exactGraph.edges.add([contourAnchorId, np.id].sort().join('--'));
            }
           
            console.log(`📍 Центр контура (${cx.toFixed(1)}, ${cy.toFixed(1)}) добавлен как якорная точка ${contourAnchorId}`);
            console.log(`   Соединён с ближайшими точками: ${nearestPoints.map(p => p.id.substring(0,12)).join(', ')}`);
        }
       
        // 🔥 ЛОГ: координаты при создании модели
        console.log(`\n📍 СОЗДАНИЕ МОДЕЛИ — КООРДИНАТЫ ТОЧЕК (первые 5):`);
        const samplePoints = points.slice(0, 5);
        samplePoints.forEach((p, i) => {
            console.log(`   ${i+1}. ${p.id.substring(0,16)}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
        });
       
        if (options.outlineContour) {
            console.log(`\n📍 СОЗДАНИЕ МОДЕЛИ — КОНТУР (первые 5 точек):`);
            options.outlineContour.points.slice(0, 5).forEach((p, i) => {
                console.log(`   ${i+1}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
            });
        }
       
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
       
        // Добавляем contourCenter в modelData
        modelData.contourCenter = contourCenter;
       
        // 🔥 Сохраняем исходный центр контура в метаданных
        if (contourCenter) {
            if (!modelData.metadata) modelData.metadata = {};
            modelData.metadata.contourOriginalCenter = {
                x: contourCenter.x,
                y: contourCenter.y
            };
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
   
    // 🔥 ЛОГ: какой transform проходит через GraphProcessor
    if (result.success && result.transform) {
        console.log(`📤 GraphProcessor ПРОПУСКАЕТ TRANSFORM:`);
        console.log(`   • Масштаб: ${result.transform.scale.toFixed(3)}`);
        console.log(`   • Поворот: ${(result.transform.rotation * 180 / Math.PI).toFixed(1)}°`);
        console.log(`   • Сдвиг: (${result.transform.translation.x.toFixed(1)}, ${result.transform.translation.y.toFixed(1)})`);
    }
   
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

 /**
     * Получить RoleClassifier
     */
    getRoleClassifier() {
        return this.roleClassifier;
    }

/**
     * Получить экземпляр ModelEnhancer
     */
    getModelEnhancer() {
        return this._getModelEnhancer();
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
