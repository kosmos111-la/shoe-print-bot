// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ АККУМУЛЯТОР - ФАСАД НАД ModelManager + GraphProcessor
// 🔥 ОБНОВЛЁННАЯ ВЕРСИЯ ПОСЛЕ ФАЗЫ 3

const ModelManager = require('./ModelManager');
const GraphProcessor = require('./GraphProcessor');
const TriangleMatcher = require('../matching/TriangleMatcher');
const ValidationModule = require('../validation/ValidationModule');
const GeometryUtils = require('./utils/GeometryUtils');
const GraphUtils = require('./utils/GraphUtils');

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;
        this.fastMode = options.fastMode || false;
        this.similarityThreshold = options.similarityThreshold || 0.6;

        // 🔥 НОВЫЕ КОМПОНЕНТЫ (Фаза 3)
        this.modelManager = new ModelManager({ debug: this.debug });
        this.graphProcessor = new GraphProcessor({
            debug: this.debug,
            fastMode: this.fastMode,
            k: options.k || 8,
            wlIterations: options.wlIterations || 3,
            positionThreshold: options.positionThreshold || 0.15,
            morphologyThreshold: options.morphologyThreshold || 0.85
        });

        // Валидатор (для обратной совместимости)
        this.validator = new ValidationModule({
            debug: this.debug,
            positionThreshold: options.positionThreshold || 0.15,
            morphologyThreshold: options.morphologyThreshold || 0.85
        });

        // Для обратной совместимости (старые вызовы)
        this.models = this.modelManager.models;
        this.currentModelId = null;
        this.modelRelations = this.modelManager.modelRelations;
        this.photoToModel = this.modelManager.photoToModel;

        // Статистика (для обратной совместимости)
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalCenterMatches: 0,
            totalRelativeMatches: 0,
            totalNodesRemoved: 0,
            totalDuplicatesSkipped: 0,
            differentFootprintsDetected: 0,
            triangleMatchesCount: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log(`🏗 TopologicalAccumulator (v3.0 - Фасад) создан: "${this.name}"`);
        console.log(`   🔥 Режим: ${this.fastMode ? 'БЫСТРЫЙ' : 'ПОЛНЫЙ'}`);
        console.log(`   🔷 Порог сходства: ${this.similarityThreshold * 100}%`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    async processPoints(points, options = {}) {
        console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК...`);

        const photoId = options.photoId || `photo_${Date.now()}`;
        const contours = options.contours || [];
        const modelIdHint = options.modelId;
        const outlineContour = contours.find(c => c.class === 'Outline-trail' || c.type === 'footprint_outline');

        if (this.debug) {
            console.log(`\n🔍 ОТЛАДКА processPoints:`);
            console.log(`   • photoId: ${photoId}`);
            console.log(`   • modelIdHint: ${modelIdHint}`);
            console.log(`   • hasModel: ${this.modelManager.hasModel(modelIdHint)}`);
        }

        // 1. Строим графы
        const graphs = this.graphProcessor.buildGraphs(points, contours, options.source || 'photo');

        // 2. Если есть существующая модель - улучшаем
        if (modelIdHint && this.modelManager.hasModel(modelIdHint)) {
            console.log(`\n✅ НАЙДЕНА МОДЕЛЬ, запускаю улучшение...`);

            const existingModel = this.modelManager.getModel(modelIdHint);

            const enhanceResult = await this.graphProcessor.enhanceModel(
                existingModel,
                graphs,
                points,
                { photoId, contours, outlineContour }
            );

            if (enhanceResult.success) {
                // Обновляем модель
                existingModel.transform = enhanceResult.transform;
               
                if (enhanceResult.structures && enhanceResult.structures.length > 0) {
                    existingModel.structures = enhanceResult.structures;
                   
                    // Строим pointToStructure
                    existingModel.pointToStructure = new Map();
                    for (const structure of enhanceResult.structures) {
                        const pointIds = structure.pointIds || [];
                        for (const pointId of pointIds) {
                            existingModel.pointToStructure.set(pointId, structure.id);
                        }
                    }
                }

                // Сохраняем уникальные точки
                if (enhanceResult.uniquePhotoPoints) {
                    this.lastUniqueInPhoto = enhanceResult.uniquePhotoPoints;
                }

                this.stats.triangleMatchesCount += enhanceResult.matches?.length || 0;
                this.modelManager.incrementEnhancements();

                // Очистка неподтверждённых узлов
                const cleanResult = this.cleanUnconfirmedNodes(modelIdHint, 2, 3);
                this.stats.totalNodesRemoved += cleanResult.removed;

                // Строим matchMap
                const { matchMap, modelMatchMap } = this.buildTriangleMatchMap(
                    { matches: enhanceResult.matches || [] },
                    modelIdHint
                );

                existingModel.lastTriangleResult = {
                    modelMatchMap,
                    matchMap,
                    transform: enhanceResult.transform
                };

                console.log(`\n📊 СТАТИСТИКА МОДЕЛИ ПОСЛЕ УЛУЧШЕНИЯ:`);
                console.log(`   • Всего узлов: ${existingModel.graph.nodes.size}`);
                console.log(`   • Подтверждено: ${enhanceResult.matches?.length || 0}`);

                return {
                    status: 'enhanced',
                    modelId: modelIdHint,
                    similarity: enhanceResult.similarity,
                    matches: enhanceResult.matches,
                    newNodesAdded: enhanceResult.newNodesAdded,
                    nodesRemoved: cleanResult.removed,
                    matchMap,
                    modelMatchMap,
                    transform: enhanceResult.transform,
                    structures: enhanceResult.structures,
                    message: `Модель улучшена: +${enhanceResult.newNodesAdded} точек`
                };
            } else {
                console.log(`\n⚠️ Улучшение модели не удалось: ${enhanceResult.reason}`);
                return {
                    status: 'enhancement_failed',
                    modelId: modelIdHint,
                    similarity: enhanceResult.similarity || 0,
                    message: enhanceResult.reason
                };
            }
        }

        // 3. Если моделей ещё нет - создаём первую
        if (this.modelManager.getModelCount() === 0) {
            console.log(`🆕 Первое фото в сессии, создаю первую модель`);
           
            const modelData = this.graphProcessor.createModelFromGraphs(
                graphs,
                points,
                {
                    name: options.name,
                    source: options.source,
                    outlineContour
                }
            );
           
            const model = this.modelManager.createModel(modelData);
            this.modelManager.linkPhotoToModel(photoId, model.id);
           
            // Обновляем статистику для обратной совместимости
            this.stats.totalModels = this.modelManager.getModelCount();
            this.currentModelId = model.id;
           
            return {
                status: 'created',
                modelId: model.id,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                morphologyCount: model.morphologyMap.size,
                patternCount: Object.keys(model.patternData?.patterns || {}).length,
                clusterCount: Object.keys(model.clusterData?.clusters || {}).length,
                isFirstModel: true,
                totalModels: this.modelManager.getModelCount(),
                outlineContour,
                message: `Создана новая топологическая модель`
            };
        }

        // 4. Сравниваем со всеми существующими моделями
        if (this.debug) console.log(`\n🔍 Сравниваю с ${this.modelManager.getModelCount()} существующими моделями...`);

        const comparisons = [];
        const { knnGraph, knnFingerprints } = graphs;

        for (const model of this.modelManager.getAllFullModels().values()) {
            const comparison = this.graphProcessor.compareGraphs(
                model.knnGraph,
                model.knnFingerprints,
                knnGraph,
                knnFingerprints
            );

            comparisons.push({
                modelId: model.id,
                similarity: comparison.similarity,
                exactMatches: comparison.exactMatches?.length || 0,
                similarMatches: comparison.similarMatches?.length || 0,
                model
            });
        }

        comparisons.sort((a, b) => b.similarity - a.similarity);
        const bestMatch = comparisons[0];

        if (this.debug) {
            console.log(`\n📊 Лучшее совпадение:`);
            console.log(`   Модель: ${bestMatch.modelId.slice(0, 12)}...`);
            console.log(`   Сходство: ${(bestMatch.similarity * 100).toFixed(1)}%`);
        }

        // 5. Если сходство выше порога - улучшаем
        if (bestMatch.similarity >= this.similarityThreshold) {
            console.log(`\n✅ СОВПАДЕНИЕ! Улучшаю модель ${bestMatch.modelId.slice(0, 12)}...`);

            this.modelManager.switchToModel(bestMatch.modelId);
            this.currentModelId = bestMatch.modelId;

            const existingModel = this.modelManager.getModel(bestMatch.modelId);

            const enhanceResult = await this.graphProcessor.enhanceModel(
                existingModel,
                graphs,
                points,
                { photoId, contours, outlineContour }
            );

            this.modelManager.linkPhotoToModel(photoId, bestMatch.modelId);
           
            // Обновляем статистику для обратной совместимости
            this.stats.totalEnhancements = this.modelManager.stats.totalEnhancements;

            return {
                status: 'enhanced',
                modelId: bestMatch.modelId,
                similarity: bestMatch.similarity,
                ...enhanceResult,
                totalModels: this.modelManager.getModelCount(),
                matchedModel: bestMatch.modelId
            };
        }

        // 6. Если сходство ниже порога - создаём новую модель
        console.log(`\n⚠️ НИЗКОЕ СХОДСТВО (${(bestMatch.similarity * 100).toFixed(1)}% < ${this.similarityThreshold * 100}%)`);
        console.log(`🆕 Создаю НОВУЮ модель для другого следа...`);

        const modelData = this.graphProcessor.createModelFromGraphs(
            graphs,
            points,
            {
                name: options.name,
                source: options.source,
                outlineContour
            }
        );

        const newModel = this.modelManager.createModel(modelData);
        this.modelManager.linkPhotoToModel(photoId, newModel.id);
       
        this.modelManager.addModelRelation(newModel.id, bestMatch.modelId, 'different', bestMatch.similarity);
       
        // Обновляем статистику для обратной совместимости
        this.stats.totalModels = this.modelManager.getModelCount();
        this.stats.differentFootprintsDetected = this.modelManager.stats.differentFootprintsDetected;
        this.currentModelId = newModel.id;

        return {
            status: 'created_new',
            modelId: newModel.id,
            similarity: bestMatch.similarity,
            comparedWith: bestMatch.modelId,
            totalModels: this.modelManager.getModelCount(),
            outlineContour,
            isDifferentFootprint: true,
            message: `Обнаружен ДРУГОЙ след! Создана новая модель.`
        };
    }

    // ==================== ТРЕУГОЛЬНОЕ СРАВНЕНИЕ ====================

    async compareByTriangleMatching(model1, model2, options = {}) {
        const startTime = Date.now();
        if (this.debug) console.log(`\n🔍 Треугольное сопоставление...`);

        const points1 = this.graphProcessor.extractPointsFromModel(model1);
        const points2 = this.graphProcessor.extractPointsFromModel(model2);

        if (!points1.length || !points2.length) {
            return {
                success: false,
                matches: [],
                count: 0,
                sufficient: false,
                similarity: 0,
                time: Date.now() - startTime
            };
        }

        const triangleMatcher = new TriangleMatcher({ debug: false });
        const result = triangleMatcher.findMatches(points1, points2, model1.graph, model2.graph);

        const matchedPointA = new Set(result.matches.map(m => m.pointA));
        const matchedPointB = new Set(result.matches.map(m => m.pointB));

        return {
            success: true,
            matches: result.matches,
            triangles: result.triangles,
            count: result.matches.length,
            sufficient: result.matches.length >= 12,
            similarity: result.matches.length / Math.min(points1.length, points2.length),
            time: Date.now() - startTime,
            noMatchA: points1.filter(p => !matchedPointA.has(p.id)).map(p => p.id),
            noMatchB: points2.filter(p => !matchedPointB.has(p.id)).map(p => p.id),
            stats: result.stats
        };
    }

    // ==================== MATCHMAP ====================

    buildTriangleMatchMap(result, targetModelId = null) {
        if (!result.matches || result.matches.length === 0) {
            return { matchMap: new Map(), modelMatchMap: new Map() };
        }

        const sortedMatches = [...result.matches].sort((a, b) => b.confidence - a.confidence);
        const pointCorrespondence = new Map();
        const reverseCorrespondence = new Map();

        for (const match of sortedMatches) {
            if (!pointCorrespondence.has(match.pointA) && !reverseCorrespondence.has(match.pointB)) {
                pointCorrespondence.set(match.pointA, match.pointB);
                reverseCorrespondence.set(match.pointB, match.pointA);
            }
        }

        const matchMap = new Map();
        const modelMatchMap = new Map();
        let pairNumber = 1;

        for (const [pointA, pointB] of pointCorrespondence) {
            const match = result.matches.find(m => m.pointA === pointA && m.pointB === pointB);
            const status = match?.status || 'anchor';

            matchMap.set(pointA, {
                modelId: pointB,
                pairNumber: pairNumber,
                type: 'anchor',
                confidence: 1.0,
                status
            });

            modelMatchMap.set(pointB, {
                photoId: pointA,
                pairNumber: pairNumber,
                type: 'anchor',
                confidence: 1.0,
                status
            });

            pairNumber++;
        }

        const modelIdToUse = targetModelId || this.currentModelId;
        if (modelIdToUse && this.modelManager.hasModel(modelIdToUse)) {
            const model = this.modelManager.getModel(modelIdToUse);
            model.lastTriangleResult = {
                modelMatchMap,
                matchMap,
                pointCorrespondence,
                stats: {
                    totalMatches: result.matches.length,
                    uniquePhotoPoints: new Set(result.matches.map(m => m.pointA)).size,
                    uniqueModelPoints: new Set(result.matches.map(m => m.pointB)).size,
                    coverage: (pointCorrespondence.size / new Set(result.matches.map(m => m.pointA)).size) * 100,
                    anchors: matchMap.size
                },
                timestamp: new Date().toISOString()
            };
        }

        return { matchMap, modelMatchMap };
    }

    // ==================== ОЧИСТКА НЕПОДТВЕРЖДЁННЫХ УЗЛОВ ====================

    cleanUnconfirmedNodes(modelId, minConfirmations = 2, maxAge = 3) {
        const model = this.modelManager.getModel(modelId);
        if (!model) return { removed: 0, remaining: 0 };

        const graph = model.graph;
        const toRemove = [];
        const now = Date.now();

        for (const [nodeId, node] of graph.nodes) {
            if (node.addedFrom === 'original') continue;
           
            const confirmations = node.confirmationCount || 1;
            const addedAt = node.addedAt ? node.addedAt.getTime() : now;
            const age = (now - addedAt) / (1000 * 60 * 60 * 24);

            if (confirmations < minConfirmations && age > 0.1) {
                toRemove.push(nodeId);
            }
        }

        toRemove.forEach(nodeId => graph.nodes.delete(nodeId));

        const newEdges = new Set();
        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (graph.nodes.has(a) && graph.nodes.has(b)) {
                newEdges.add(edge);
            }
        }
        graph.edges = newEdges;

        for (const node of graph.nodes.values()) node.degree = 0;
        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (graph.nodes.has(a)) graph.nodes.get(a).degree++;
            if (graph.nodes.has(b)) graph.nodes.get(b).degree++;
        }

        return { removed: toRemove.length, remaining: graph.nodes.size };
    }

    // ==================== ДЕЛЕГИРОВАНИЕ В MODELMANAGER ====================

    getCurrentModel() {
        return this.modelManager.getCurrentModel();
    }

    getCurrentModelId() {
        return this.modelManager.getCurrentModelId();
    }

    getModel(modelId) {
        return this.modelManager.getModel(modelId);
    }

    getAllModels() {
        return this.modelManager.getAllModels();
    }

    switchToModel(modelId) {
        const result = this.modelManager.switchToModel(modelId);
        this.currentModelId = this.modelManager.currentModelId;
        return result;
    }

    getModelInfo(modelId = null) {
        return this.modelManager.getModelInfo(modelId);
    }

    getModelsStats() {
        return this.modelManager.getModelsStats();
    }

    getModelRelations() {
        return this.modelManager.getModelRelations();
    }

    getModelForPhoto(photoId) {
        return this.modelManager.getModelForPhoto(photoId);
    }

    getPhotosForModel(modelId) {
        return this.modelManager.getPhotosForModel(modelId);
    }

    exportModel(modelId) {
        return this.modelManager.exportModel(modelId);
    }

    importModel(modelData) {
        const result = this.modelManager.importModel(modelData);
        this.stats.totalModels = this.modelManager.getModelCount();
        return result;
    }

    // ==================== ВИЗУАЛИЗАЦИЯ ====================

    getVisualizationData(modelId = null, reliablePhotoIds = []) {
        const targetId = modelId || this.modelManager.getCurrentModelId();
        if (!targetId || !this.modelManager.hasModel(targetId)) return null;

        const model = this.modelManager.getModel(targetId);
        const graph = model.graph;

        const outlineContour = model.metadata?.outlineContour || null;

        const rawStructures = model.structures || [];
        const pointToStructure = model.pointToStructure || new Map();
        const structureColors = this._generateStructureColors(rawStructures);

        const structures = rawStructures.filter(s => s && s.id).map(s => ({
            id: s.id,
            pointCount: s.pointIds?.length || 0,
            pointIds: s.pointIds || [],
            triangleCount: s.triangleIds?.length || 0,
            transform: s.transform || null,
            confidence: s.confidence || 0,
            color: structureColors.get(s.id) || '#CCCCCC',
            rays: s.rays || [],
            triangles: s.triangles || []
        }));

        const pointsWithStructure = Array.from(graph.nodes.values()).map(node => ({
            ...node,
            structureId: pointToStructure.get(node.id) || null,
            structureColor: pointToStructure.has(node.id) ? structureColors.get(pointToStructure.get(node.id)) : null
        }));

        const pointsByConfirmation = {
            confirmed3: pointsWithStructure.filter(p => p.confirmationCount >= 3),
            confirmed2: pointsWithStructure.filter(p => p.confirmationCount === 2),
            confirmed1: pointsWithStructure.filter(p => p.confirmationCount === 1),
            confirmed0: pointsWithStructure.filter(p => !p.confirmationCount)
        };

        const modelMatchMap = model.lastTriangleResult?.modelMatchMap || new Map();

        let reliableNodeIds = new Set(reliablePhotoIds);
        if (reliableNodeIds.size === 0) {
            for (const node of graph.nodes.values()) {
                if (node.confirmationCount >= 2) reliableNodeIds.add(node.id);
            }
        }

        const modelTriangles = this._extractTrianglesFromGraph(graph);

        let confirmedPointsCount = 0;
        for (const node of graph.nodes.values()) {
            if ((node.confirmationCount || 0) >= 2) confirmedPointsCount++;
        }
        const stability = graph.nodes.size > 0 ? (confirmedPointsCount / graph.nodes.size * 100).toFixed(1) : 0;

        return {
            modelId: targetId,
            modelName: model.metadata.name,
            points: pointsWithStructure,
            edges: Array.from(graph.edges),
            structures,
            triangles: modelTriangles,
            pointToStructure,
            outlineContour,
            stats: {
                totalNodes: graph.nodes.size,
                totalEdges: graph.edges.size,
                confirmed3: pointsByConfirmation.confirmed3.length,
                confirmed2: pointsByConfirmation.confirmed2.length,
                confirmed1: pointsByConfirmation.confirmed1.length,
                confirmed0: pointsByConfirmation.confirmed0.length,
                structureCount: structures.length,
                reliableNodes: reliableNodeIds.size,
                uniquePoints: graph.nodes.size,
                confirmedPoints: confirmedPointsCount,
                stability
            },
            pointsByConfirmation,
            metadata: model.metadata,
            allModels: this.modelManager.getAllModels(),
            currentModelId: this.modelManager.getCurrentModelId(),
            modelMatchMap,
            transform: model.transform
        };
    }

    _generateStructureColors(structures) {
        const colors = new Map();
        const palette = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7B787', '#B5EAD7', '#C7CEE6'
        ];

        structures.forEach((structure, idx) => {
            colors.set(structure.id, palette[idx % palette.length]);
        });

        return colors;
    }

    _extractTrianglesFromGraph(graph) {
        const triangles = [];
        const nodeIds = Array.from(graph.nodes.keys());
        const edges = graph.edges;

        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                for (let k = j + 1; k < nodeIds.length; k++) {
                    const a = nodeIds[i];
                    const b = nodeIds[j];
                    const c = nodeIds[k];

                    if (edges.has([a, b].sort().join('--')) &&
                        edges.has([b, c].sort().join('--')) &&
                        edges.has([c, a].sort().join('--'))) {

                        const p1 = graph.nodes.get(a);
                        const p2 = graph.nodes.get(b);
                        const p3 = graph.nodes.get(c);

                        if (p1 && p2 && p3) {
                            triangles.push({ p1, p2, p3, id: `tri_${a}_${b}_${c}` });
                        }
                    }
                }
            }
        }

        return triangles;
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        const modelStats = this.modelManager.getStats();
        const processorStats = this.graphProcessor.getStats();

        return {
            system: {
                ...this.stats,
                totalModels: modelStats.totalModels,
                totalEnhancements: modelStats.totalEnhancements,
                differentFootprintsDetected: modelStats.differentFootprintsDetected
            },
            models: this.modelManager.getModelsStats(),
            relations: this.modelManager.getModelRelations(),
            processor: processorStats
        };
    }

// ==================== ВОССТАНОВЛЕННЫЕ МЕТОДЫ ====================

    /**
     * Конвертирует matches в Map
     */
    convertMatchesToMap(matches) {
        const map = new Map();
        for (const match of matches) {
            map.set(match.pointA, {
                modelId: match.pointB,
                confidence: match.confidence
            });
        }
        return map;
    }

    /**
     * Обновление модели оптимальными соответствиями
     */
    updateModelWithOptimalMatches(modelId, newGraph, matches, newMorphology) {
        const model = this.modelManager.getModel(modelId);
        if (!model) return { confirmedExisting: 0, newNodesAdded: 0 };
       
        let confirmedExisting = 0;
        let newNodesAdded = 0;

        const matchedPhotoIds = new Set();
        const matchedModelIds = new Set();

        // 1. Обновляем существующие точки
        for (const match of matches) {
            const modelNode = model.graph.nodes.get(match.pointB);
            if (modelNode) {
                modelNode.confirmationCount = (modelNode.confirmationCount || 1) + 1;
                modelNode.lastConfirmed = new Date();
                confirmedExisting++;
                matchedPhotoIds.add(match.pointA);
                matchedModelIds.add(match.pointB);
            }
        }

        // 2. Добавляем новые точки из фото
        if (this.lastUniqueInPhoto && this.lastUniqueInPhoto.length > 0) {
            if (this.debug) console.log(`\n📸 Добавляю ${this.lastUniqueInPhoto.length} новых точек из фото в модель`);

            for (const photoPoint of this.lastUniqueInPhoto) {
                let isDuplicate = false;
                for (const modelNode of model.graph.nodes.values()) {
                    const dist = GeometryUtils.distance(modelNode, photoPoint);
                    if (dist < 5) {
                        isDuplicate = true;
                        break;
                    }
                }

                if (!isDuplicate) {
                    const newNodeId = `node_${Date.now()}_${newNodesAdded}_${Math.random().toString(36).substr(2, 4)}`;

                    model.graph.nodes.set(newNodeId, {
                        id: newNodeId,
                        x: photoPoint.x,
                        y: photoPoint.y,
                        degree: 0,
                        morphology: newMorphology?.get(photoPoint.id),
                        confirmationCount: 1,
                        addedFrom: 'new_photo_point',
                        addedAt: new Date(),
                        originalPhotoId: photoPoint.id
                    });

                    newNodesAdded++;
                }
            }
        }

        return { confirmedExisting, newNodesAdded };
    }

    /**
     * Построение matchMap для визуализации (старая версия)
     */
    buildMatchMap(centerMatches, allMatches, stabilizedMatches) {
        const matchMap = new Map();
        let pairNumber = 1;

        for (const [photoId, match] of centerMatches) {
            if (match && match.confidence >= 0.7) {
                matchMap.set(photoId, {
                    modelId: match.modelId,
                    pairNumber: pairNumber++,
                    type: 'anchor'
                });
            }
        }

        for (const [photoId, match] of allMatches) {
            if (!centerMatches.has(photoId) && match && match.confidence >= 0.7) {
                matchMap.set(photoId, {
                    modelId: match.modelId,
                    type: 'regular'
                });
            }
        }

        for (const [photoId, match] of stabilizedMatches) {
            if (!centerMatches.has(photoId) && !allMatches.has(photoId) && match && match.confidence >= 0.7) {
                matchMap.set(photoId, {
                    modelId: match.modelId,
                    type: 'regular'
                });
            }
        }

        return matchMap;
    }

    /**
     * Обновление модели соответствиями (старая версия)
     */
    updateModelWithMatches(modelId, newGraph, matches, anchorMatches, newMorphology) {
        const model = this.modelManager.getModel(modelId);
        if (!model) return { confirmedExisting: 0, newNodesAdded: 0, duplicatesSkipped: 0 };
       
        let confirmedExisting = 0;
        let newNodesAdded = 0;
        let duplicatesSkipped = 0;

        const matchedPhotoIds = new Set();
        const matchedModelIds = new Set();

        for (const [photoId, match] of matches) {
            const modelNode = model.graph.nodes.get(match.modelId);
            if (modelNode) {
                modelNode.confirmationCount = (modelNode.confirmationCount || 1) + 1;
                modelNode.lastConfirmed = new Date();
                confirmedExisting++;
                matchedPhotoIds.add(photoId);
                matchedModelIds.add(match.modelId);
            }
        }

        for (const [photoId, photoNode] of newGraph.nodes) {
            if (matchedPhotoIds.has(photoId)) continue;

            const match = matches.get(photoId);
            if (!match || match.confidence < 0.7) continue;

            if (this.isDuplicate(photoNode, model.graph, model.morphologyMap)) {
                duplicatesSkipped++;
                continue;
            }

            const newNodeId = `node_${Date.now()}_${newNodesAdded}`;
            model.graph.nodes.set(newNodeId, {
                id: newNodeId,
                x: photoNode.x,
                y: photoNode.y,
                degree: photoNode.degree,
                morphology: newMorphology.get(photoId),
                confirmationCount: 1,
                addedFrom: 'new_point',
                addedAt: new Date(),
                originalPhotoId: photoId
            });
            newNodesAdded++;
        }

        this.updateEdges(model.graph, newGraph, matches);

        return { confirmedExisting, newNodesAdded, duplicatesSkipped };
    }

    /**
     * Проверка на дубликат точки
     */
    isDuplicate(newNode, modelGraph, morphologyMap) {
        if (modelGraph.nodes.size === 0) return false;

        const newMorph = morphologyMap.get(newNode.id);
        if (!newMorph || !newMorph.hasContour) return false;

        const duplicateCompactnessThreshold = 0.3;
        const duplicateAreaThreshold = 0.15;
        const duplicateGraphDistance = 2;

        for (const [existingId, existingNode] of modelGraph.nodes) {
            const existingMorph = morphologyMap.get(existingId);
            if (!existingMorph || !existingMorph.hasContour) continue;

            const compactnessDiff = Math.abs(newMorph.compactness - existingMorph.compactness);
            const areaDiff = Math.abs(newMorph.normalizedArea - existingMorph.normalizedArea);

            if (compactnessDiff < duplicateCompactnessThreshold &&
                areaDiff < duplicateAreaThreshold) {

                const graphDist = GraphUtils.graphDistance(newNode.id, existingId, modelGraph);

                if (graphDist <= duplicateGraphDistance) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Установить результат треугольного сравнения
     */
    setTriangleResult(modelId, result) {
        const model = this.modelManager.getModel(modelId);
        if (model) {
            model.lastTriangleResult = result;
        }
    }

    /**
     * Обновить рёбра в графе модели
     */
    updateEdges(modelGraph, newGraph, matches) {
        const newEdges = Array.isArray(newGraph.edges) ? newGraph.edges : Array.from(newGraph.edges);

        for (const edge of newEdges) {
            const [photoA, photoB] = edge.split('--');
            const modelA = matches.get(photoA)?.modelId;
            const modelB = matches.get(photoB)?.modelId;

            if (modelA && modelB && modelGraph.nodes.has(modelA) && modelGraph.nodes.has(modelB)) {
                modelGraph.edges.add([modelA, modelB].sort().join('--'));
            }
        }

        for (const node of modelGraph.nodes.values()) node.degree = 0;

        const modelEdges = Array.isArray(modelGraph.edges) ? modelGraph.edges : Array.from(modelGraph.edges);

        for (const edge of modelEdges) {
            const [a, b] = edge.split('--');
            if (modelGraph.nodes.has(a)) modelGraph.nodes.get(a).degree++;
            if (modelGraph.nodes.has(b)) modelGraph.nodes.get(b).degree++;
        }
    }

/**
     * Конвертирует согласованные якоря обратно в matches для визуализации
     * @param {Array} consistentAnchors - массив согласованных якорей из checkGlobalConsistency
     * @returns {Array} - массив matches для визуализации
     */
    convertConsistentToMatches(consistentAnchors) {
        const matches = [];
        for (const anchor of consistentAnchors) {
            // Для каждой точки в треугольнике
            for (const point of anchor.points) {
                matches.push({
                    pointA: point.pointA,
                    pointB: point.pointB,
                    confidence: point.confidence
                });
            }
        }
        return matches;
    }

    /**
     * Находит модель точки по ID фото (из структуры)
     */
    findModelPointForPhoto(photoPointId, structure) {
        if (!structure) return null;
       
        const anchors = structure.getAnchors ? structure.getAnchors() : [];
        const anchor = anchors.find(a => a.pointA === photoPointId);
        return anchor ? anchor.pointB : null;
    }

    /**
     * Проверяет равенство массивов (для сравнения треугольников)
     */
    arraysEqual(a, b) {
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

// ДОБАВИТЬ перед секцией "ОЧИСТКА":

    // ==================== ПРОКСИ-МЕТОДЫ ДЛЯ MODELENHANCER (обратная совместимость) ====================

    /**
     * Глобальная проверка согласованности всех найденных якорей
     * @deprecated Используйте ModelEnhancer напрямую
     */
    checkGlobalConsistency(anchors, trianglesA, trianglesB, graphA, graphB) {
        const enhancer = this.graphProcessor._getModelEnhancer();
        return enhancer.checkGlobalConsistency(anchors, trianglesA, trianglesB, graphA, graphB);
    }

    /**
     * Двухэтапная достройка точек на основе согласованных якорей
     * @deprecated Используйте ModelEnhancer напрямую
     */
    twoStagePositioning(anchors, allMatches, graphA, graphB, morphologyMap, modelMorphology) {
        const enhancer = this.graphProcessor._getModelEnhancer();
        return enhancer.twoStagePositioning(anchors, allMatches, graphA, graphB, morphologyMap, modelMorphology);
    }

    /**
     * Геометрическое расширение структуры через поиск новых точек
     * @deprecated Используйте ModelEnhancer напрямую
     */
    expandStructureGeometrically(structure, graphA, graphB, morphologyMap, modelMorphology) {
        const enhancer = this.graphProcessor._getModelEnhancer();
        return enhancer._expandStructureGeometrically(structure, graphA, graphB, morphologyMap, modelMorphology);
    }

    /**
     * Сливает дублирующиеся точки в модели
     * @deprecated Используйте ModelEnhancer напрямую
     */
    mergeDuplicatePoints(graph, threshold = 5) {
        const enhancer = this.graphProcessor._getModelEnhancer();
        return enhancer.mergeDuplicatePoints(graph, threshold);
    }

    /**
     * Получение граничных рёбер структуры
     * @deprecated Используйте ModelEnhancer напрямую
     */
    getBoundaryEdgesFromStructure(structure) {
        const enhancer = this.graphProcessor._getModelEnhancer();
        return enhancer._getBoundaryEdgesFromStructure(structure);
    }

    /**
     * Поиск соседнего треугольника в графе по ребру
     * @deprecated Используйте ModelEnhancer напрямую
     */
    findNeighborTriangleInGraph(edge, allTriangles, structure) {
        const enhancer = this.graphProcessor._getModelEnhancer();
        return enhancer._findNeighborTriangleInGraph(edge, allTriangles, structure);
    }

    /**
     * Поиск общего ребра треугольника со структурой
     * @deprecated Используйте ModelEnhancer напрямую
     */
    findCommonEdgeInTriangle(triangle, structure) {
        const enhancer = this.graphProcessor._getModelEnhancer();
        return enhancer._findCommonEdgeInTriangle(triangle, structure);
    }

    /**
     * Геометрическое сравнение треугольников
     * @deprecated Используйте ModelEnhancer напрямую
     */
    compareTrianglesGeometrically(tPhoto, tModel, structure) {
        const enhancer = this.graphProcessor._getModelEnhancer();
        return enhancer._compareTrianglesGeometrically(tPhoto, tModel, structure);
    }

    /**
     * Поиск ближайшей точки модели
     * @deprecated Используйте ModelEnhancer напрямую
     */
    findNearestModelPoint(point, graphB, threshold = 15) {
        const enhancer = this.graphProcessor._getModelEnhancer();
        return enhancer._findNearestModelPoint(point, graphB, threshold);
    }

    /**
     * Попытка добавить треугольник геометрически
     * @deprecated Используйте ModelEnhancer напрямую
     */
    tryAddGeometricTriangle(triangle, structure, graphA, graphB, morphologyMap, modelMorphology) {
        const enhancer = this.graphProcessor._getModelEnhancer();
        return enhancer._tryAddGeometricTriangle(triangle, structure, graphA, graphB, morphologyMap, modelMorphology);
    }

    /**
     * Получение точки модели из структуры
     * @deprecated Используйте ModelEnhancer напрямую
     */
    getModelPointFromStructure(pointId, structure) {
        const enhancer = this.graphProcessor._getModelEnhancer();
        return enhancer._getModelPointFromStructure(pointId, structure);
    }

    /**
     * Вычисление угла между тремя точками
     * @deprecated Используйте GeometryUtils напрямую
     */
    calcAngleInTriangle(a, b, c) {
        return GeometryUtils.angleBetween(a, b, c);
    }

    /**
     * Вычисление расстояния между точками
     * @deprecated Используйте GeometryUtils напрямую
     */
    calcDistance(p1, p2) {
        return GeometryUtils.distance(p1, p2);
    }

    /**
     * Применение трансформации к точке
     * @deprecated Используйте GeometryUtils напрямую
     */
    applyTransform(point, transform) {
        return GeometryUtils.applyTransform(point, transform);
    }

    /**
     * Поиск соседей узла
     * @deprecated Используйте GraphUtils напрямую
     */
    findNodeNeighbors(nodeId, graph) {
        return GraphUtils.findNodeNeighbors(nodeId, graph);
    }

    /**
     * Проверка соединения двух узлов
     * @deprecated Используйте GraphUtils напрямую
     */
    areConnected(aId, bId, graph) {
        return GraphUtils.areConnected(aId, bId, graph);
    }

    /**
     * Расстояние в графе
     * @deprecated Используйте GraphUtils напрямую
     */
    graphDistance(nodeA, nodeB, graph) {
        return GraphUtils.graphDistance(nodeA, nodeB, graph);
    }

    /**
     * Классификация роли узла (упрощённая)
     * @deprecated Используйте RoleClassifier напрямую
     */
    getNodeRoleSimple(nodeId, graph) {
        return this.graphProcessor.getRoleClassifier().classifySimple(nodeId, graph);
    }

    /**
     * Извлечение всех треугольников из графа (публичный метод)
     */
    extractTrianglesFromGraph(graph) {
        return this._extractTrianglesFromGraph(graph);
    }

    /**
     * Вычисление треугольников в графе (синоним для совместимости)
     */
    computeTriangles(graph) {
        return this._extractTrianglesFromGraph(graph);
    }

  /**
     * Улучшение существующей модели новым фото
     * @deprecated Используйте graphProcessor.enhanceModel напрямую
     */
    async enhanceExistingModel(modelId, newExactGraph, newKNNGraph, newKnnFingerprints, newMorphology, options) {
        const model = this.modelManager.getModel(modelId);
        if (!model) return { error: 'Модель не найдена' };

        // Обновляем KNN-данные модели
        model.knnGraph = newKNNGraph;
        model.knnFingerprints = new Map([...model.knnFingerprints, ...newKnnFingerprints]);

        // Делегируем улучшение через ModelEnhancer
        const points = Array.from(newExactGraph.nodes.values());
        const contours = options.contours || [];
        const outlineContour = contours.find(c => c.class === 'Outline-trail' || c.type === 'footprint_outline');

        const enhancer = this.graphProcessor._getModelEnhancer();
       
        return await enhancer.enhance(
            model,
            newExactGraph,
            newMorphology,
            points,
            {
                photoId: options.photoId || `photo_${Date.now()}`,
                contours,
                outlineContour,
                fastMode: this.fastMode
            }
        );
    }
 
    // ==================== ОЧИСТКА ====================

    clear() {
        this.modelManager.clear();
        this.graphProcessor.clearCaches();
       
        this.currentModelId = null;
        this.lastUniqueInPhoto = null;
       
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalCenterMatches: 0,
            totalRelativeMatches: 0,
            totalNodesRemoved: 0,
            totalDuplicatesSkipped: 0,
            differentFootprintsDetected: 0,
            triangleMatchesCount: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log('🧹 Аккумулятор очищен');
    }
}

module.exports = TopologicalAccumulator;
