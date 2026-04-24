// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ АККУМУЛЯТОР - ФАСАД НАД ModelManager + GraphProcessor
// 🔥 ОБНОВЛЁННАЯ ВЕРСИЯ ПОСЛЕ ФАЗЫ 4 (ПЕРЕСТРОЕНИЕ ГРАФА)

const ModelManager = require('./ModelManager');
const GraphProcessor = require('./GraphProcessor');
const GraphRebuilder = require('./GraphRebuilder');
const GraphHasher = require('./utils/GraphHasher');
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

        // 🔥 НОВЫЕ КОМПОНЕНТЫ (Фаза 4)
        this.graphRebuilder = new GraphRebuilder({
            debug: this.debug,
            k: options.k || 8,
            wlIterations: options.wlIterations || 3
        });
        this.graphHasher = new GraphHasher({ debug: this.debug });

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
            rebuildCount: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log(`🏗 TopologicalAccumulator (v4.0 - Перестроение графа) создан: "${this.name}"`);
        console.log(`   🔥 Режим: ${this.fastMode ? 'БЫСТРЫЙ' : 'ПОЛНЫЙ'}`);
        console.log(`   🔷 Порог сходства: ${this.similarityThreshold * 100}%`);
        console.log(`   🔄 Перестроение графа: ВКЛЮЧЕНО`);
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
                // Обновляем метаданные
                existingModel.metadata.photoCount = (existingModel.metadata.photoCount || 1) + 1;
               
                // 🔥 ДОБАВЛЯЕМ КОНТУР В МАССИВ
                // При добавлении контура в существующую модель
if (outlineContour) {
    if (!existingModel.metadata.outlineContours) {
        existingModel.metadata.outlineContours = [];
        if (existingModel.metadata.outlineContour) {
            existingModel.metadata.outlineContours.push({
                photoId: 'initial',
                points: existingModel.metadata.outlineContour.points,
                class: existingModel.metadata.outlineContour.class || 'Outline-trail',
                type: existingModel.metadata.outlineContour.type || 'footprint_outline'
            });
            delete existingModel.metadata.outlineContour;
        }
    }
    existingModel.metadata.outlineContours.push({
        photoId: photoId,
        points: outlineContour.points,
        class: outlineContour.class || 'Outline-trail',
        type: outlineContour.type || 'footprint_outline'
    });
}

                this.stats.triangleMatchesCount += enhanceResult.matches?.length || 0;
                this.modelManager.incrementEnhancements();

                // 🔥 ПЕРЕСТРАИВАЕМ ГРАФ ПОСЛЕ УЛУЧШЕНИЯ
                const newPointsCount = enhanceResult.newNodesAdded || 0;
                const shouldRebuild = this.graphRebuilder.shouldRebuild(existingModel, newPointsCount);

                if (shouldRebuild || options.forceRebuild) {
                    console.log(`\n🔄 ЗАПУСК ПЕРЕСТРОЕНИЯ ГРАФА...`);
                    this.graphRebuilder.rebuildModel(existingModel, { photoId });
                    this.stats.rebuildCount++;
                } else {
                    // Если не перестраиваем, просто сохраняем transform
                    existingModel.transform = enhanceResult.transform;
                   
                    if (enhanceResult.structures && enhanceResult.structures.length > 0) {
                        existingModel.structures = enhanceResult.structures;
                    }
                }

                // Сохраняем уникальные точки
                if (enhanceResult.uniquePhotoPoints) {
                    this.lastUniqueInPhoto = enhanceResult.uniquePhotoPoints;
                }

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
                    transform: existingModel.transform
                };

                console.log(`\n📊 СТАТИСТИКА МОДЕЛИ ПОСЛЕ УЛУЧШЕНИЯ:`);
console.log(`   • Всего узлов: ${existingModel.graph.nodes.size}`);
console.log(`   • Подтверждено: ${enhanceResult.matches?.length || 0}`);
console.log(`   • Граф перестроен: ${shouldRebuild ? '✅ ДА' : '❌ НЕТ'}`);

// 🔥 ЛОГ: какой transform возвращает TopologicalAccumulator
const returnTransform = enhanceResult.transform || existingModel.transform;
if (returnTransform) {
    console.log(`\n📤 TopologicalAccumulator ВОЗВРАЩАЕТ TRANSFORM:`);
    console.log(`   • Масштаб: ${returnTransform.scale.toFixed(3)}`);
    console.log(`   • Поворот: ${(returnTransform.rotation * 180 / Math.PI).toFixed(1)}°`);
    console.log(`   • Сдвиг: (${returnTransform.translation.x.toFixed(1)}, ${returnTransform.translation.y.toFixed(1)})`);
}

return {
    status: 'enhanced',
    modelId: modelIdHint,
    similarity: enhanceResult.similarity,
    matches: enhanceResult.matches,
    newNodesAdded: enhanceResult.newNodesAdded,
    nodesRemoved: cleanResult.removed,
    matchMap,
    modelMatchMap,
    transform: returnTransform,
    structures: existingModel.structures,
    graphRebuilt: shouldRebuild,
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

            // Инициализируем массив контуров (для первого фото трансформация не нужна)
if (outlineContour) {
    modelData.metadata.outlineContours = [{
        photoId: photoId,
        points: outlineContour.points,
        class: outlineContour.class || 'Outline-trail',
        type: outlineContour.type || 'footprint_outline',
        transformed: false  // первое фото — оригинальные координаты
    }];
    delete modelData.metadata.outlineContour;
}

            const model = this.modelManager.createModel(modelData);
           
            // 🔥 Вычисляем хэш графа
            model.graphHash = this.graphHasher.computeGraphHash(model.graph);
           
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
                graphHash: model.graphHash,
                isFirstModel: true,
                totalModels: this.modelManager.getModelCount(),
                message: `Создана новая топологическая модель`
            };
        }

        // 4. 🔥 ПОИСК МОДЕЛИ ПО ХЭШУ (быстрый путь)
        const photoHash = this.graphHasher.computeGraphHash(graphs.exactGraph);
        const exactMatch = this.modelManager.findModelByHash(photoHash);

        if (exactMatch) {
            console.log(`\n🎯 НАЙДЕНО ТОЧНОЕ СОВПАДЕНИЕ ПО ХЭШУ! Модель: ${exactMatch.id.substring(0, 12)}...`);

            this.modelManager.switchToModel(exactMatch.id);
            this.currentModelId = exactMatch.id;

            const enhanceResult = await this.graphProcessor.enhanceModel(
                exactMatch,
                graphs,
                points,
                { photoId, contours, outlineContour }
            );

            if (enhanceResult.success) {
                exactMatch.metadata.photoCount = (exactMatch.metadata.photoCount || 1) + 1;
               
                // Добавляем контур
                if (outlineContour) {
                    if (!exactMatch.metadata.outlineContours) {
                        exactMatch.metadata.outlineContours = [];
                    }
                    exactMatch.metadata.outlineContours.push({
                        photoId: photoId,
                        points: outlineContour.points
                    });
                }

                // Перестраиваем граф
                const shouldRebuild = this.graphRebuilder.shouldRebuild(exactMatch, enhanceResult.newNodesAdded || 0);
                if (shouldRebuild || options.forceRebuild) {
                    console.log(`\n🔄 ЗАПУСК ПЕРЕСТРОЕНИЯ ГРАФА...`);
                    this.graphRebuilder.rebuildModel(exactMatch, { photoId });
                    this.stats.rebuildCount++;
                }

                this.modelManager.linkPhotoToModel(photoId, exactMatch.id);
this.stats.totalEnhancements = this.modelManager.stats.totalEnhancements;

// 🔥 ЛОГ: какой transform возвращается при exact match
if (enhanceResult.transform) {
    console.log(`\n📤 TopologicalAccumulator (exact match) ВОЗВРАЩАЕТ TRANSFORM:`);
    console.log(`   • Масштаб: ${enhanceResult.transform.scale.toFixed(3)}`);
    console.log(`   • Поворот: ${(enhanceResult.transform.rotation * 180 / Math.PI).toFixed(1)}°`);
    console.log(`   • Сдвиг: (${enhanceResult.transform.translation.x.toFixed(1)}, ${enhanceResult.transform.translation.y.toFixed(1)})`);
}

return {
    status: 'enhanced_exact',
    modelId: exactMatch.id,
    similarity: 1.0,
    ...enhanceResult,
    totalModels: this.modelManager.getModelCount(),
    matchedModel: exactMatch.id,
    matchMethod: 'hash'
};
            }
        }

        // 5. Сравниваем со всеми существующими моделями через WL
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
            console.log(`\n📊 Лучшее совпадение (WL):`);
            console.log(`   Модель: ${bestMatch.modelId.slice(0, 12)}...`);
            console.log(`   Сходство: ${(bestMatch.similarity * 100).toFixed(1)}%`);
        }

        // 6. Если сходство выше порога - улучшаем
        if (bestMatch.similarity >= this.similarityThreshold) {
            console.log(`\n✅ СОВПАДЕНИЕ (WL)! Улучшаю модель ${bestMatch.modelId.slice(0, 12)}...`);

            this.modelManager.switchToModel(bestMatch.modelId);
            this.currentModelId = bestMatch.modelId;

            const existingModel = this.modelManager.getModel(bestMatch.modelId);

            const enhanceResult = await this.graphProcessor.enhanceModel(
                existingModel,
                graphs,
                points,
                { photoId, contours, outlineContour }
            );

            if (enhanceResult.success) {
                existingModel.metadata.photoCount = (existingModel.metadata.photoCount || 1) + 1;
               
                // Добавляем контур
                if (outlineContour) {
                    if (!existingModel.metadata.outlineContours) {
                        existingModel.metadata.outlineContours = [];
                    }
                    existingModel.metadata.outlineContours.push({
                        photoId: photoId,
                        points: outlineContour.points
                    });
                }

                // Перестраиваем граф
                const shouldRebuild = this.graphRebuilder.shouldRebuild(existingModel, enhanceResult.newNodesAdded || 0);
                if (shouldRebuild || options.forceRebuild) {
                    console.log(`\n🔄 ЗАПУСК ПЕРЕСТРОЕНИЯ ГРАФА...`);
                    this.graphRebuilder.rebuildModel(existingModel, { photoId });
                    this.stats.rebuildCount++;
                }
            }

            this.modelManager.linkPhotoToModel(photoId, bestMatch.modelId);
this.stats.totalEnhancements = this.modelManager.stats.totalEnhancements;

// 🔥 ЛОГ: какой transform возвращается при WL match
if (enhanceResult.transform) {
    console.log(`\n📤 TopologicalAccumulator (WL match) ВОЗВРАЩАЕТ TRANSFORM:`);
    console.log(`   • Масштаб: ${enhanceResult.transform.scale.toFixed(3)}`);
    console.log(`   • Поворот: ${(enhanceResult.transform.rotation * 180 / Math.PI).toFixed(1)}°`);
    console.log(`   • Сдвиг: (${enhanceResult.transform.translation.x.toFixed(1)}, ${enhanceResult.transform.translation.y.toFixed(1)})`);
}

return {
    status: 'enhanced_wl',
    modelId: bestMatch.modelId,
    similarity: bestMatch.similarity,
    ...enhanceResult,
    totalModels: this.modelManager.getModelCount(),
    matchedModel: bestMatch.modelId,
    matchMethod: 'wl'
};
        }

        // 7. Если сходство ниже порога - создаём новую модель
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

        // Инициализируем массив контуров
if (outlineContour) {
    modelData.metadata.outlineContours = [{
        photoId: photoId,
        points: outlineContour.points,
        class: outlineContour.class || 'Outline-trail',
        type: outlineContour.type || 'footprint_outline'
    }];
    delete modelData.metadata.outlineContour;
}

        const newModel = this.modelManager.createModel(modelData);
        newModel.graphHash = this.graphHasher.computeGraphHash(newModel.graph);
       
        this.modelManager.linkPhotoToModel(photoId, newModel.id);
        this.modelManager.addModelRelation(newModel.id, bestMatch.modelId, 'different', bestMatch.similarity);

        // Обновляем статистику
        this.stats.totalModels = this.modelManager.getModelCount();
        this.stats.differentFootprintsDetected = this.modelManager.stats.differentFootprintsDetected;
        this.currentModelId = newModel.id;

        return {
            status: 'created_new',
            modelId: newModel.id,
            similarity: bestMatch.similarity,
            comparedWith: bestMatch.modelId,
            totalModels: this.modelManager.getModelCount(),
            graphHash: newModel.graphHash,
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

    // ==================== ПРИНУДИТЕЛЬНОЕ ПЕРЕСТРОЕНИЕ ====================

    /**
     * Принудительно перестроить граф модели
     */
    rebuildModel(modelId) {
        const model = this.modelManager.getModel(modelId);
        if (!model) {
            return { success: false, error: 'Модель не найдена' };
        }

        console.log(`\n🔄 ПРИНУДИТЕЛЬНОЕ ПЕРЕСТРОЕНИЕ ГРАФА МОДЕЛИ ${modelId.substring(0, 12)}...`);
       
        this.graphRebuilder.rebuildModel(model, { force: true });
        this.stats.rebuildCount++;

        return {
            success: true,
            modelId: modelId,
            nodes: model.graph.nodes.size,
            edges: model.graph.edges.size,
            graphHash: model.graphHash
        };
    }

    // ==================== ВИЗУАЛИЗАЦИЯ ====================

    getVisualizationData(modelId = null, reliablePhotoIds = []) {
        const targetId = modelId || this.modelManager.getCurrentModelId();
        if (!targetId || !this.modelManager.hasModel(targetId)) return null;

        const model = this.modelManager.getModel(targetId);
        const graph = model.graph;

        // 🔥 Поддержка старого и нового формата контуров
                // 🔥 Поддержка старого и нового формата контуров
        let outlineContours = model.metadata?.outlineContours || [];
        if (outlineContours.length === 0 && model.metadata?.outlineContour) {
            outlineContours = [{
                photoId: 'initial',
                points: model.metadata.outlineContour.points,
                class: model.metadata.outlineContour.class || 'Outline-trail',
                type: model.metadata.outlineContour.type || 'footprint_outline'
            }];
        }

        // 🔥 Ищем якорную точку контура в графе
        let contourAnchor = null;
        for (const node of graph.nodes.values()) {
            if (node.isContourAnchor) {
                contourAnchor = node;
                break;
            }
        }

        // 🔥 Если есть якорь контура — корректируем контур относительно него
       let outlineContour = null;
     
        if (outlineContours.length > 0 && contourAnchor) {
            const firstContour = outlineContours[0];
           
            // Вычисляем исходный центр контура из первого сохранения
            const origPoints = firstContour.points;
            let origCx = 0, origCy = 0;
            for (const p of origPoints) {
                origCx += p.x;
                origCy += p.y;
            }
            origCx /= origPoints.length;
            origCy /= origPoints.length;
           
            // Сдвиг между исходным центром и текущим положением якоря
            const shiftX = contourAnchor.x - origCx;
            const shiftY = contourAnchor.y - origCy;
           
            // Корректируем все точки контура
            const shiftedPoints = origPoints.map(p => ({
                x: p.x + shiftX,
                y: p.y + shiftY
            }));
           
            outlineContour = {
                points: shiftedPoints,
                class: firstContour.class || 'Outline-trail',
                type: firstContour.type || 'footprint_outline'
            };
           
            console.log(`   📐 Контур скорректирован по якорю: сдвиг (${shiftX.toFixed(1)}, ${shiftY.toFixed(1)})`);
        } else if (outlineContours.length > 0) {
            // Если якоря нет — используем как есть
            outlineContour = {
                points: outlineContours[0].points,
                class: outlineContours[0].class || 'Outline-trail',
                type: outlineContours[0].type || 'footprint_outline'
            };
            console.log(`   ⚠️ Якорь контура не найден, контур без коррекции`);
        }

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
            outlineContours: outlineContours,
outlineContour: outlineContour,
            graphHash: model.graphHash,
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
                stability,
                rebuildCount: model.metadata.rebuildCount || 0
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
            processor: processorStats,
            rebuilder: {
                rebuildCount: this.stats.rebuildCount
            }
        };
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
            rebuildCount: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log('🧹 Аккумулятор очищен');
    }
}

module.exports = TopologicalAccumulator;
