// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ МУЛЬТИ-МОДЕЛЬНЫЙ АККУМУЛЯТОР - ТРЕУГОЛЬНАЯ ВЕРСИЯ
// 🔥 Интегрирован TriangleMatcher

const GraphBuilder = require('./GraphBuilder');
const KNNGraphBuilder = require('./KNNGraphBuilder');
const LocalGroupSignature = require('./LocalGroupSignature');
const MorphologyEncoder = require('./MorphologyEncoder');
const CenterMatcher = require('./CenterMatcher');
const RelativePositioning = require('./RelativePositioning');
const TopologicalFingerprint = require('./TopologicalFingerprint');
const TriangleMatcher = require('../matching/TriangleMatcher'); // 🔥 НОВЫЙ!
const PatternAnalyzer = require('../analysis/PatternAnalyzer');
const ClusterAnalyzer = require('../analysis/ClusterAnalyzer');

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;

        // 🔥 РЕЖИМЫ РАБОТЫ
        this.fastMode = options.fastMode || false;
        this.similarityThreshold = options.similarityThreshold || 0.6;

        // 🔥 ДОПУСКИ ДЛЯ ПРИЗНАКОВ
        this.tolerances = {
            compactness: 0.4,
            eccentricity: 0.15,
            normalizedArea: 0.75,
            radialProfile: 0.3,
            degree: 2,
            triangles: 1,
            role: 'soft'
        };

        // Компоненты
        this.graphBuilder = new GraphBuilder({ debug: this.debug });
        this.knnBuilder = new KNNGraphBuilder({
            debug: this.debug,
            k: options.k || 8
        });

        this.fingerprinter = new TopologicalFingerprint({
            debug: this.debug,
            iterations: options.wlIterations || 3,
            structuralSimilarityThreshold: 0.5
        });

        this.localGroupSignature = new LocalGroupSignature({
            debug: this.debug,
            depth: options.localDepth || 3,
            useMorphology: true
        });

        this.morphologyEncoder = new MorphologyEncoder({ debug: this.debug });

        this.centerMatcher = new CenterMatcher({
            debug: this.debug,
            localGroupSignature: this.localGroupSignature,
            morphologyEncoder: this.morphologyEncoder,
            minLocalSimilarity: options.minLocalSimilarity || 0.5,
            minMorphologySimilarity: options.minMorphologySimilarity || 0.6,
            minConsistentPairs: options.minConsistentPairs || 1
        });

        this.relativePositioning = new RelativePositioning({
            debug: this.debug,
            localGroupSignature: this.localGroupSignature,
            minPathSimilarity: options.minPathSimilarity || 0.5,
            maxPathLengthDiff: options.maxPathLengthDiff || 3,
            confidenceThreshold: options.confidenceThreshold || 0.8
        });

        // 🔥 АНАЛИЗАТОРЫ
        this.patternAnalyzer = new PatternAnalyzer({ debug: this.debug });
        this.clusterAnalyzer = new ClusterAnalyzer({ debug: this.debug });

        // 🔥 ИНВАРИАНТНЫЕ ПАРАМЕТРЫ
        this.duplicateCompactnessThreshold = options.duplicateCompactnessThreshold || 0.3;
        this.duplicateAreaThreshold = options.duplicateAreaThreshold || 0.15;
        this.duplicateGraphDistance = options.duplicateGraphDistance || 2;

        // 🔥 ХРАНИЛИЩЕ МОДЕЛЕЙ
        this.models = new Map();
        this.currentModelId = null;
        this.modelRelations = new Map();
        this.photoToModel = new Map();

        // Статистика
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

        console.log(`🏗 МУЛЬТИ-МОДЕЛЬНЫЙ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   🔥 Режим: ${this.fastMode ? 'БЫСТРЫЙ' : 'ПОЛНЫЙ'}`);
        console.log(`   🔷 Порог сходства: ${this.similarityThreshold * 100}%`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    async processPoints(points, options = {}) {
    console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК...`);

    const photoId = options.photoId || `photo_${Date.now()}`;
    const contours = options.contours || [];
    const modelIdHint = options.modelId;

    // 🔥 ОТЛАДКА
    console.log(`\n🔍 ОТЛАДКА processPoints:`);
    console.log(`   • photoId: ${photoId}`);
    console.log(`   • modelIdHint: ${modelIdHint}`);
    console.log(`   • models.has: ${this.models.has(modelIdHint)}`);

    // 1. Строим графы
    const exactGraph = this.graphBuilder.buildGraph(points, options.source || 'photo');
    const knnGraph = this.knnBuilder.buildGraph(points, options.source || 'photo_knn');
    const morphologyMap = this.morphologyEncoder.encode(points, contours);
    const knnFingerprints = this.fingerprinter.computeGraphFingerprints(knnGraph);

    // 🔥 2. Если есть существующая модель - пробуем треугольное сравнение
    if (modelIdHint && this.models.has(modelIdHint)) {
        console.log(`\n✅ НАЙДЕНА МОДЕЛЬ, запускаю треугольный матчер...`);
       
        const existingModel = this.models.get(modelIdHint);

        // Создаем временную модель из нового фото
        const tempModel = {
            graph: exactGraph,
            morphologyMap: morphologyMap,
            metadata: { name: 'temp' }
        };

        console.log(`\n🔍 ТРЕУГОЛЬНОЕ СРАВНЕНИЕ с моделью ${modelIdHint.slice(0,12)}...`);
        const triangleResult = await this.compareByTriangleMatching(tempModel, existingModel);

        if (triangleResult.sufficient) {
            console.log(`\n✅ Найдено ${triangleResult.count} треугольных соответствий!`);

            // 2.1 Достраиваем остальные точки через RelativePositioning
            console.log(`\n🧩 ДОСТРАИВАНИЕ остальных точек...`);
            const allMatches = await this.relativePositioning.positionPoints(
                exactGraph,
                existingModel.graph,
                this.convertMatchesToMap(triangleResult.matches),
                morphologyMap,
                existingModel.morphologyMap,
                { confidenceThreshold: 0.5 }
            );

            // 2.2 Обновляем модель
            const updateResult = this.updateModelWithOptimalMatches(
                modelIdHint,
                exactGraph,
                triangleResult.matches,
                morphologyMap
            );

            // 2.3 Обновляем KNN-граф и подписи
            existingModel.knnGraph = knnGraph;
            existingModel.knnFingerprints = new Map([...existingModel.knnFingerprints, ...knnFingerprints]);
            existingModel.metadata.photoCount = (existingModel.metadata.photoCount || 0) + 1;
            existingModel.metadata.lastEnhanced = new Date();

            // 2.4 Создаем matchMap для визуализации
const { matchMap, modelMatchMap } = this.buildTriangleMatchMap(triangleResult);

// 🔥 СОХРАНЯЕМ В МОДЕЛИ для визуализации
existingModel.lastTriangleResult = {
    ...triangleResult,
    modelMatchMap: modelMatchMap,
    matchMap: matchMap
};

// 2.5 Очищаем неподтверждённые точки
const cleanResult = this.cleanUnconfirmedNodes(modelIdHint, 2, 3);
this.stats.totalNodesRemoved += cleanResult.removed;
this.stats.triangleMatchesCount += triangleResult.count;

// 2.6 Статистика
const confirmedInModel = triangleResult.matches.length;
const onlyInModel = existingModel.graph.nodes.size - confirmedInModel;
const onlyInPhoto = exactGraph.nodes.size - confirmedInModel;

console.log(`\n📊 СТАТИСТИКА МОДЕЛИ:`);
console.log(`   • 🟠 Подтвержденных (2+ фото): ${confirmedInModel}`);
console.log(`   • 🔵 Только в модели: ${onlyInModel}`);
console.log(`   • 🔵 Только в новом фото: ${onlyInPhoto}`);
console.log(`   • Всего в модели теперь: ${existingModel.graph.nodes.size}`);

this.photoToModel.set(photoId, modelIdHint);

return {
    status: 'enhanced_triangle',
    modelId: modelIdHint,
    similarity: triangleResult.similarity,
    centerMatches: triangleResult.count,
    totalMatches: triangleResult.matches.length,
    newNodesAdded: updateResult.newNodesAdded,
    nodesRemoved: cleanResult.removed,
    matchMap: matchMap,
    modelMatchMap: modelMatchMap, // 🔥 ВАЖНО!
    message: `Треугольное сопоставление: ${triangleResult.count} пар`
};
        } else {
            console.log(`\n⚠️ Треугольное сравнение дало только ${triangleResult.count} пар - недостаточно (нужно 12)`);
        }
    } else {
        console.log(`\n❌ МОДЕЛЬ НЕ НАЙДЕНА, создаю новую...`);
        console.log(`   modelIdHint: ${modelIdHint}`);
        console.log(`   models.has: ${this.models.has(modelIdHint)}`);
    }

    // Если это первое фото вообще - создаём первую модель
    if (this.models.size === 0) {
        console.log(`🆕 Первое фото в сессии, создаю первую модель`);
        const result = this.createNewModel(exactGraph, knnFingerprints, morphologyMap, points, options);
        this.photoToModel.set(photoId, result.modelId);
        return {
            ...result,
            isFirstModel: true,
            totalModels: this.models.size
        };
    }

    // Если быстрый путь не сработал - идем по стандартному пути
    console.log(`\n🔍 Быстрый путь не сработал, запускаю полный анализ...`);

    // Сравниваем со ВСЕМИ существующими моделями
    console.log(`\n🔍 Сравниваю с ${this.models.size} существующими моделями...`);

    const comparisons = [];

    for (const [modelId, model] of this.models) {
        console.log(`   Проверяю модель ${modelId.slice(0, 12)}...`);

        const comparison = this.fingerprinter.compareGraphs(
            model.knnGraph,
            model.knnFingerprints,
            knnGraph,
            knnFingerprints
        );

        comparisons.push({
            modelId,
            similarity: comparison.similarity,
            exactMatches: comparison.exactMatches.length,
            similarMatches: comparison.similarMatches.length,
            model
        });
    }

    comparisons.sort((a, b) => b.similarity - a.similarity);
    const bestMatch = comparisons[0];

    console.log(`\n📊 Лучшее совпадение:`);
    console.log(`   Модель: ${bestMatch.modelId.slice(0, 12)}...`);
    console.log(`   Сходство: ${(bestMatch.similarity * 100).toFixed(1)}%`);

    // Если сходство выше порога - улучшаем существующую модель
    if (bestMatch.similarity >= this.similarityThreshold) {
        console.log(`\n✅ СОВПАДЕНИЕ! Улучшаю модель ${bestMatch.modelId.slice(0, 12)}...`);

        this.switchToModel(bestMatch.modelId);

        if (!this.fastMode) {
            const enhancedResult = await this.enhanceExistingModel(
                bestMatch.modelId,
                exactGraph,
                knnGraph,
                knnFingerprints,
                morphologyMap,
                options
            );

            this.photoToModel.set(photoId, bestMatch.modelId);

            return {
                status: 'enhanced',
                modelId: bestMatch.modelId,
                similarity: bestMatch.similarity,
                ...enhancedResult,
                totalModels: this.models.size,
                matchedModel: bestMatch.modelId
            };
        } else {
            this.photoToModel.set(photoId, bestMatch.modelId);

            return {
                status: 'matched_fast',
                modelId: bestMatch.modelId,
                similarity: bestMatch.similarity,
                exactMatches: bestMatch.exactMatches,
                similarMatches: bestMatch.similarMatches,
                totalModels: this.models.size,
                matchedModel: bestMatch.modelId,
                message: `Фото соответствует модели (сходство ${(bestMatch.similarity * 100).toFixed(1)}%)`
            };
        }
    }
    // Если сходство ниже порога - создаём НОВУЮ модель
    else {
        console.log(`\n⚠️ НИЗКОЕ СХОДСТВО (${(bestMatch.similarity * 100).toFixed(1)}% < ${this.similarityThreshold * 100}%)`);
        console.log(`🆕 Создаю НОВУЮ модель для другого следа...`);

        const result = this.createNewModel(exactGraph, knnFingerprints, morphologyMap, points, {
            ...options,
            comparedWith: bestMatch.modelId,
            reason: 'different_footprint'
        });

        this.modelRelations.set(result.modelId, {
            related: [bestMatch.modelId],
            type: 'different',
            similarity: bestMatch.similarity
        });

        const existingRel = this.modelRelations.get(bestMatch.modelId);
        this.modelRelations.set(bestMatch.modelId, {
            related: [...(existingRel?.related || []), result.modelId],
            type: 'different',
            similarity: bestMatch.similarity
        });

        this.photoToModel.set(photoId, result.modelId);
        this.stats.differentFootprintsDetected++;

        return {
            status: 'created_new',
            modelId: result.modelId,
            similarity: bestMatch.similarity,
            comparedWith: bestMatch.modelId,
            totalModels: this.models.size,
            isDifferentFootprint: true,
            message: `Обнаружен ДРУГОЙ след! Создана новая модель.`
        };
    }
}

    // ==================== НОВЫЙ МЕТОД: ТРЕУГОЛЬНОЕ СРАВНЕНИЕ ====================

async compareByTriangleMatching(model1, model2, options = {}) {
    const startTime = Date.now();
    console.log(`\n🔍 Треугольное сопоставление...`);

    // Извлекаем точки из моделей
    const points1 = this.extractPointsFromModel(model1);
    const points2 = this.extractPointsFromModel(model2);

    console.log(`📊 Точек: ${points1.length} ↔ ${points2.length}`);

    // Создаем треугольный матчер
    const triangleMatcher = new TriangleMatcher({
        compactnessThreshold: 0.4,
        eccentricityThreshold: 0.2,
        areaThreshold: 0.5,
        ratioThreshold: 0.25
    });

    // 🔥 ЗАЩИТА: проверяем, что точки не пустые
    if (!points1 || !points2 || points1.length === 0 || points2.length === 0) {
        console.log(`❌ Нет точек для сопоставления`);
        return {
            success: false,
            matches: [],
            count: 0,
            sufficient: false,
            similarity: 0,
            time: Date.now() - startTime,
            ambiguous: [],
            noMatchA: points1?.map(p => p.id) || [],
            noMatchB: points2?.map(p => p.id) || [],
            stats: {}
        };
    }

    // Запускаем треугольный поиск
    console.log(`🔍 Запуск TriangleMatcher.findMatches...`);
    let result;
    try {
        result = triangleMatcher.findMatches(points1, points2);
    } catch (error) {
        console.log(`❌ Ошибка в triangleMatcher.findMatches:`, error.message);
        console.log(error.stack);
        // 🔥 ВАЖНО: возвращаем объект, а не массив!
        return {
            success: false,
            matches: [],
            count: 0,
            sufficient: false,
            similarity: 0,
            time: Date.now() - startTime,
            ambiguous: [],
            noMatchA: points1.map(p => p.id),
            noMatchB: points2.map(p => p.id),
            stats: {}
        };
    }

    // 🔥 ПРОВЕРКА: result может быть массивом (если ошибка в матчере)
    if (Array.isArray(result)) {
        console.log(`❌ triangleMatcher вернул массив вместо объекта`);
        console.log(`   Исправьте TriangleMatcher.findMatches чтобы возвращал объект с полем matches`);
        return {
            success: false,
            matches: [],
            count: 0,
            sufficient: false,
            similarity: 0,
            time: Date.now() - startTime,
            ambiguous: [],
            noMatchA: points1.map(p => p.id),
            noMatchB: points2.map(p => p.id),
            stats: {}
        };
    }

    if (!result) {
        console.log(`❌ triangleMatcher.findMatches вернул null/undefined`);
        return {
            success: false,
            matches: [],
            count: 0,
            sufficient: false,
            similarity: 0,
            time: Date.now() - startTime,
            ambiguous: [],
            noMatchA: points1.map(p => p.id),
            noMatchB: points2.map(p => p.id),
            stats: {}
        };
    }

    if (!result.matches) {
        console.log(`❌ result.matches = undefined`);
        console.log(`   result =`, result);
        console.log(`   keys =`, Object.keys(result));
        return {
            success: false,
            matches: [],
            count: 0,
            sufficient: false,
            similarity: 0,
            time: Date.now() - startTime,
            ambiguous: [],
            noMatchA: points1.map(p => p.id),
            noMatchB: points2.map(p => p.id),
            stats: result.stats || {}
        };
    }

    console.log(`✅ triangleMatcher.findMatches выполнен, matches: ${result.matches.length}`);

    // Находим точки без пары
    const matchedPointA = new Set(result.matches.map(m => m.pointA));
    const matchedPointB = new Set(result.matches.map(m => m.pointB));

    const noMatchA = points1
        .filter(p => !matchedPointA.has(p.id))
        .map(p => p.id);

    const noMatchB = points2
        .filter(p => !matchedPointB.has(p.id))
        .map(p => p.id);

    const finalResult = {
        success: true,
        matches: result.matches,
        count: result.matches.length,
        sufficient: result.matches.length >= 12,
        similarity: result.matches.length / Math.min(points1.length, points2.length),
        time: Date.now() - startTime,
        ambiguous: [],
        noMatchA,
        noMatchB,
        stats: result.stats
    };

    console.log(`\n📊 РЕЗУЛЬТАТ ТРЕУГОЛЬНОГО СОПОСТАВЛЕНИЯ:`);
    console.log(`   • Найдено соответствий: ${finalResult.count}`);
    console.log(`   • Новых в А: ${finalResult.noMatchA.length}`);
    console.log(`   • Новых в Б: ${finalResult.noMatchB.length}`);
    console.log(`   • Достаточно для якорей: ${finalResult.sufficient ? '✅' : '❌'}`);
    console.log(`   • Время: ${finalResult.time}ms`);

    return finalResult;
}

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    /**
     * Извлечение точек из модели
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
            role: this.getNodeRoleSimple(nodeId, graph),
            degree: node.degree || 0,
            triangles: node.triangles || 0,
           
            // 🔥 МОРФОЛОГИЯ (обязательно!)
            compactness: morph.compactness || 0,
            eccentricity: morph.eccentricity || 0,
            normalizedArea: morph.normalizedArea || 1,
            radialProfile: morph.radialProfile || [0,0,0,0],
            orientation: morph.orientation || 0,
           
            neighborRoles: this.getNeighborRolesForPoint(nodeId, graph)
          contour: morph.contour,
        });
    }

    console.log(`📊 Извлечено ${points.length} точек из модели с морфологией`);
    return points;
}

    /**
     * Строит matchMap для визуализации
     */
    buildTriangleMatchMap(result) {
        const matchMap = new Map();
        const modelMatchMap = new Map();
        let pairNumber = 1;

        for (const match of result.matches) {
            matchMap.set(match.pointA, {
                modelId: match.pointB,
                pairNumber: pairNumber,
                type: 'anchor',
                confidence: match.confidence
            });

            modelMatchMap.set(match.pointB, {
                photoId: match.pointA,
                pairNumber: pairNumber,
                type: 'anchor',
                confidence: match.confidence
            });

            pairNumber++;
        }

        console.log(`📋 Создан matchMap: ${matchMap.size} записей (${pairNumber-1} с номерами)`);
        console.log(`📋 Создан modelMatchMap: ${modelMatchMap.size} записей`);

        return { matchMap, modelMatchMap };
    }

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
     * Упрощенное определение роли
     */
    getNodeRoleSimple(nodeId, graph) {
        const node = graph.nodes.get(nodeId);
        if (!node) return 'R';
        const degree = node.degree || 0;
        if (degree >= 6) return 'H';
        if (degree === 1) return 'L';
        return 'R';
    }

    /**
     * Получить роли соседей
     */
    getNeighborRolesForPoint(nodeId, graph) {
        const neighbors = this.findNodeNeighbors(nodeId, graph);
        const roles = [];
        for (const neighbor of neighbors) {
            roles.push(this.getNodeRoleSimple(neighbor.id, graph));
        }
        return roles.sort().join('');
    }

    /**
     * Поиск соседей в графе
     */
    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (a === nodeId) neighbors.push({id: b});
            if (b === nodeId) neighbors.push({id: a});
        }
        return neighbors;
    }

    // ==================== ОСТАЛЬНЫЕ МЕТОДЫ (БЕЗ ИЗМЕНЕНИЙ) ====================

    updateModelWithOptimalMatches(modelId, newGraph, matches, newMorphology) {
        const model = this.models.get(modelId);
        let confirmedExisting = 0;
        let newNodesAdded = 0;

        const matchedPhotoIds = new Set();
        const matchedModelIds = new Set();

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

        for (const [photoId, photoNode] of newGraph.nodes) {
            if (matchedPhotoIds.has(photoId)) continue;

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

        return { confirmedExisting, newNodesAdded };
    }

    async enhanceExistingModel(modelId, newExactGraph, newKNNGraph, newKnnFingerprints, newMorphology, options) {
        const model = this.models.get(modelId);
        if (!model) return { error: 'Модель не найдена' };

        console.log(`\n🔧 УЛУЧШАЮ МОДЕЛЬ ${modelId.slice(0, 12)}...`);
        console.log(`\n🔧 ЗАПУСК ПОЛНОГО АНАЛИЗА (на Делоне-графе)...`);

        const centerMatches = this.centerMatcher.findCenterMatches(
            newExactGraph,
            model.graph,
            newMorphology,
            model.morphologyMap
        );

        console.log(`\n🔴 CenterMatcher нашёл ${centerMatches.size} якорей`);

        let allMatches = new Map();
        let stabilizedMatches = new Map();
        let finalMatches = new Map([...centerMatches]);
        let newNodesAdded = 0;

        if (centerMatches.size >= this.centerMatcher.minConsistentPairs) {
            console.log(`\n🧩 RelativePositioning достраивает остальные точки...`);

            allMatches = this.relativePositioning.positionPoints(
                newExactGraph,
                model.graph,
                centerMatches,
                newMorphology,
                model.morphologyMap,
                { confidenceThreshold: 0.5 }
            );

            stabilizedMatches = this.relativePositioning.iterativeStabilization(
                newExactGraph,
                model.graph,
                centerMatches,
                newMorphology,
                model.morphologyMap
            );

            finalMatches = new Map([...centerMatches, ...allMatches, ...stabilizedMatches]);

            const updateResult = this.updateModelWithMatches(
                modelId,
                newExactGraph,
                finalMatches,
                centerMatches,
                newMorphology
            );
            newNodesAdded = updateResult.newNodesAdded;
        } else {
            console.log(`\n⚠️ Недостаточно якорей (${centerMatches.size})`);
        }

        model.knnGraph = newKNNGraph;
        model.knnFingerprints = new Map([...model.knnFingerprints, ...newKnnFingerprints]);
        model.metadata.photoCount = (model.metadata.photoCount || 0) + 1;
        model.metadata.lastEnhanced = new Date();

        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            centerMatches: centerMatches.size,
            totalMatches: finalMatches.size,
            newNodes: newNodesAdded,
            totalNodes: model.graph.nodes.size
        });

        this.stats.totalEnhancements++;
        this.stats.lastUpdated = new Date();

        const matchMap = this.buildMatchMap(centerMatches, allMatches, stabilizedMatches);

        const cleanResult = this.cleanUnconfirmedNodes(modelId, 2, 3);
        this.stats.totalNodesRemoved += cleanResult.removed;

        return {
            centerMatches: centerMatches.size,
            totalMatches: finalMatches.size,
            newNodesAdded,
            nodesRemoved: cleanResult.removed,
            matchMap
        };
    }

    buildMatchMap(centerMatches, allMatches, stabilizedMatches) {
        const matchMap = new Map();
        let pairNumber = 1;

        console.log(`\n📋 ФОРМИРОВАНИЕ MATCHMAP:`);

        for (const [photoId, match] of centerMatches) {
            if (match && match.confidence >= 0.7) {
                matchMap.set(photoId, {
                    modelId: match.modelId,
                    pairNumber: pairNumber++,
                    type: 'anchor'
                });
                console.log(`   🔴 Якорь ${pairNumber-1}: ${photoId.slice(0,12)}... ↔ ${match.modelId.slice(0,12)}...`);
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

        console.log(`\n📊 ИТОГО: ${centerMatches.size} якорей, ${matchMap.size - centerMatches.size} дополнительных точек`);
        return matchMap;
    }

    updateModelWithMatches(modelId, newGraph, matches, anchorMatches, newMorphology) {
        const model = this.models.get(modelId);
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

    switchToModel(modelId) {
        if (!this.models.has(modelId)) {
            console.log(`❌ Модель ${modelId} не найдена`);
            return false;
        }
        this.currentModelId = modelId;
        console.log(`🔄 Переключился на модель ${modelId.slice(0, 12)}...`);
        return true;
    }

    getAllModels() {
        const models = [];
        for (const [modelId, model] of this.models) {
            models.push({
                id: modelId,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                photos: model.metadata.photoCount || 0,
                createdAt: model.metadata.createdAt,
                lastUpdated: model.metadata.lastEnhanced || model.metadata.createdAt,
                isCurrent: modelId === this.currentModelId
            });
        }
        return models;
    }

    getModel(modelId) {
        return this.models.get(modelId) || null;
    }

    getCurrentModel() {
        return this.currentModelId ? this.models.get(this.currentModelId) : null;
    }

    getCurrentModelId() {
        return this.currentModelId;
    }

    getModelsStats() {
        const stats = {
            total: this.models.size,
            current: this.currentModelId,
            differentFootprints: this.stats.differentFootprintsDetected,
            models: []
        };

        for (const [modelId, model] of this.models) {
            stats.models.push({
                id: modelId,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                photos: model.metadata.photoCount || 0,
                isCurrent: modelId === this.currentModelId,
                createdAt: model.metadata.createdAt
            });
        }

        return stats;
    }

    getModelRelations() {
        const relations = [];
        for (const [modelId, rel] of this.modelRelations) {
            relations.push({
                modelId,
                relatedTo: rel.related,
                type: rel.type,
                similarity: rel.similarity
            });
        }
        return relations;
    }

    getModelForPhoto(photoId) {
        return this.photoToModel.get(photoId) || null;
    }

    getPhotosForModel(modelId) {
        const photos = [];
        for (const [photoId, mid] of this.photoToModel) {
            if (mid === modelId) {
                photos.push(photoId);
            }
        }
        return photos;
    }

    createNewModel(exactGraph, knnFingerprints, morphologyMap, originalPoints, options = {}) {
        const modelId = `model_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        const points = Array.from(exactGraph.nodes.values());
        const features = new Map();

        for (const point of points) {
            const morph = morphologyMap.get(point.id) || {};
            features.set(point.id, {
                id: point.id,
                role: this.getNodeRoleSimple(point.id, exactGraph),
                degree: point.degree || 0,
                triangles: point.triangles || 0,
                morphology: morph,
                neighborRoles: this.getNeighborRolesForPoint(point.id, exactGraph),
                patternType: point.patternType || 'R',
                patternFrequency: point.patternFrequency || 1,
                compactness: morph.compactness,
                eccentricity: morph.eccentricity,
                normalizedArea: morph.normalizedArea,
                radialProfile: morph.radialProfile,
                logArea: morph.logArea
            });
        }

        const tempModel = { graph: exactGraph, morphologyMap };
        const patternData = this.patternAnalyzer.analyzeFootprint(tempModel);
        const clusterData = this.clusterAnalyzer.analyze(points, features, exactGraph);

        for (const [nodeId, node] of exactGraph.nodes) {
            const morph = morphologyMap.get(nodeId) || {};
            const cluster = clusterData.enhancedFeatures.get(nodeId);

            node.morphology = morph;
            node.hasContour = morph.hasContour || false;
            node.compactness = morph.compactness;
            node.eccentricity = morph.eccentricity;
            node.orientation = morph.orientation;
            node.normalizedArea = morph.normalizedArea;
            node.radialProfile = morph.radialProfile;
            node.asymmetry = morph.asymmetry;
            node.logArea = morph.logArea;

            if (cluster) {
                node.clusterId = cluster.clusterId || 'R0';
                node.clusterSize = cluster.clusterSize || 1;
                node.isUnique = cluster.isUnique || false;
                node.clusterSignature = cluster.clusterSignature || 'unknown';

                if (clusterData.relations) {
                    const rel = clusterData.relations.get(node.clusterId);
                    node.neighborClusters = rel ? rel.neighborCount : 0;
                }
            } else {
                node.clusterId = 'R0';
                node.clusterSize = 1;
                node.isUnique = false;
                node.clusterSignature = 'unknown';
                node.neighborClusters = 0;
            }

            node.patternType = patternData.patterns?.[nodeId]?.type || 'R';
            node.patternFrequency = patternData.patterns?.[nodeId]?.frequency || 1;
            node.gapPattern = patternData.gaps?.[nodeId] || '0';

            node.confirmationCount = 1;
            node.addedFrom = 'original';
            node.addedAt = new Date();
        }

        const model = {
            id: modelId,
            graph: exactGraph,
            knnGraph: null,
            knnFingerprints: knnFingerprints,
            morphologyMap: morphologyMap,
            originalPoints: originalPoints,
            patternData: patternData,
            clusterData: clusterData,
            metadata: {
                name: options.name || `Модель_${new Date().toLocaleTimeString('ru-RU')}`,
                createdAt: new Date(),
                pointsCount: originalPoints.length,
                nodesCount: exactGraph.nodes.size,
                edgesCount: exactGraph.edges.size,
                photoCount: 1,
                source: options.source || 'unknown'
            },
            history: [{
                action: 'created',
                timestamp: new Date(),
                points: originalPoints.length,
                nodes: exactGraph.nodes.size
            }]
        };

        this.models.set(modelId, model);
        this.currentModelId = modelId;
        this.stats.totalModels++;
        this.stats.lastUpdated = new Date();

        console.log(`🏗 СОЗДАНА НОВАЯ МОДЕЛЬ ${modelId.slice(0, 12)}...:`);
        console.log(`   Узлов: ${exactGraph.nodes.size}`);
        console.log(`   Точек с морфологией: ${morphologyMap.size}`);
        console.log(`   Паттернов найдено: ${Object.keys(patternData.patterns || {}).length}`);
        console.log(`   Кластеров: ${Object.keys(clusterData.clusters || {}).length}`);

        const clusterSizes = Object.values(clusterData.clusters || {}).map(c => c.size);
        const avgClusterSize = clusterSizes.length > 0
            ? (clusterSizes.reduce((a, b) => a + b, 0) / clusterSizes.length).toFixed(1)
            : 0;
        console.log(`   • Средний размер кластера: ${avgClusterSize}`);
        console.log(`   • Уникальных кластеров: ${clusterData.stats?.uniqueClusters || 0}`);

        return {
            status: 'created',
            modelId: modelId,
            nodes: exactGraph.nodes.size,
            edges: exactGraph.edges.size,
            morphologyCount: morphologyMap.size,
            patternCount: Object.keys(patternData.patterns || {}).length,
            clusterCount: Object.keys(clusterData.clusters || {}).length,
            message: `Создана новая топологическая модель`
        };
    }

    isDuplicate(newNode, modelGraph, morphologyMap) {
        if (modelGraph.nodes.size === 0) return false;

        const newMorph = morphologyMap.get(newNode.id);
        if (!newMorph || !newMorph.hasContour) return false;

        for (const [existingId, existingNode] of modelGraph.nodes) {
            const existingMorph = morphologyMap.get(existingId);
            if (!existingMorph || !existingMorph.hasContour) continue;

            const compactnessDiff = Math.abs(newMorph.compactness - existingMorph.compactness);
            const areaDiff = Math.abs(newMorph.normalizedArea - existingMorph.normalizedArea);

            if (compactnessDiff < this.duplicateCompactnessThreshold &&
                areaDiff < this.duplicateAreaThreshold) {

                const graphDist = this.graphDistance(newNode.id, existingId, modelGraph);

                if (graphDist <= this.duplicateGraphDistance) {
                    return true;
                }
            }
        }
        return false;
    }

    graphDistance(nodeA, nodeB, graph) {
        if (nodeA === nodeB) return 0;

        const queue = [{id: nodeA, dist: 0}];
        const visited = new Set([nodeA]);

        while (queue.length > 0) {
            const {id, dist} = queue.shift();

            const neighbors = this.findNodeNeighbors(id, graph);
            for (const neighbor of neighbors) {
                if (neighbor.id === nodeB) return dist + 1;
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push({id: neighbor.id, dist: dist + 1});
                }
            }
        }
        return Infinity;
    }

    cleanUnconfirmedNodes(modelId, minConfirmations = 2, maxAge = 3) {
        const model = this.models.get(modelId);
        if (!model) return { removed: 0, remaining: 0 };

        const graph = model.graph;
        const toRemove = [];
        const now = Date.now();

        const corePoints = new Set();
        if (model.lastTriangleResult && model.lastTriangleResult.zones) {
            model.lastTriangleResult.zones.core.forEach(p => corePoints.add(p.pointA));
        }

        for (const [nodeId, node] of graph.nodes) {
            if (corePoints.has(nodeId)) continue;
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

        console.log(`🧹 Очищено ${toRemove.length} неподтверждённых точек`);
        return { removed: toRemove.length, remaining: graph.nodes.size };
    }

    setTriangleResult(modelId, result) {
        const model = this.models.get(modelId);
        if (model) {
            model.lastTriangleResult = result;
        }
    }

    updateEdges(modelGraph, newGraph, matches) {
        for (const edge of newGraph.edges) {
            const [photoA, photoB] = edge.split('--');
            const modelA = matches.get(photoA)?.modelId;
            const modelB = matches.get(photoB)?.modelId;

            if (modelA && modelB && modelGraph.nodes.has(modelA) && modelGraph.nodes.has(modelB)) {
                modelGraph.edges.add([modelA, modelB].sort().join('--'));
            }
        }

        for (const node of modelGraph.nodes.values()) node.degree = 0;
        for (const edge of modelGraph.edges) {
            const [a, b] = edge.split('--');
            if (modelGraph.nodes.has(a)) modelGraph.nodes.get(a).degree++;
            if (modelGraph.nodes.has(b)) modelGraph.nodes.get(b).degree++;
        }
    }

    computeTriangles(graph) {
        if (!graph || !graph.nodes || !graph.edges) return [];

        const triangles = [];
        const nodeIds = Array.from(graph.nodes.keys());
        const edges = new Set(graph.edges);

        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                for (let k = j + 1; k < nodeIds.length; k++) {
                    const a = nodeIds[i];
                    const b = nodeIds[j];
                    const c = nodeIds[k];

                    if (edges.has([a, b].sort().join('--')) &&
                        edges.has([b, c].sort().join('--')) &&
                        edges.has([c, a].sort().join('--'))) {
                        triangles.push([a, b, c]);
                    }
                }
            }
        }
        return triangles;
    }

    getVisualizationData(modelId = null, reliablePhotoIds = []) {
        const targetId = modelId || this.currentModelId;
        if (!targetId || !this.models.has(targetId)) return null;

        const model = this.models.get(targetId);
        const graph = model.graph;

        let reliableNodeIds = new Set(reliablePhotoIds);
        if (reliableNodeIds.size === 0) {
            for (const [nodeId, node] of graph.nodes) {
                if (node.confirmationCount >= 2) reliableNodeIds.add(nodeId);
            }
        }

        const pointsByConfirmation = {
            confirmed3: [], confirmed2: [], confirmed1: [], confirmed0: []
        };

        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 3) pointsByConfirmation.confirmed3.push(node);
            else if (count >= 2) pointsByConfirmation.confirmed2.push(node);
            else if (count >= 1) pointsByConfirmation.confirmed1.push(node);
            else pointsByConfirmation.confirmed0.push(node);
        }

        // Получаем modelMatchMap из последнего результата
        const modelMatchMap = model.lastTriangleResult?.modelMatchMap || new Map();

        return {
            modelId: targetId,
            modelName: model.metadata.name,
            points: Array.from(graph.nodes.values()),
            edges: Array.from(graph.edges),
            stats: {
                totalNodes: graph.nodes.size,
                totalEdges: graph.edges.size,
                confirmed3: pointsByConfirmation.confirmed3.length,
                confirmed2: pointsByConfirmation.confirmed2.length,
                confirmed1: pointsByConfirmation.confirmed1.length,
                confirmed0: pointsByConfirmation.confirmed0.length,
                reliableNodes: reliableNodeIds.size
            },
            pointsByConfirmation,
            metadata: model.metadata,
            allModels: this.getAllModels(),
            currentModelId: this.currentModelId,
            modelMatchMap: modelMatchMap
        };
    }

    getModelInfo(modelId = null) {
        const targetId = modelId || this.currentModelId;
        if (!targetId || !this.models.has(targetId)) return { error: 'Model not found' };

        const model = this.models.get(targetId);
        const graph = model.graph;

        const confirmations = { 1: 0, 2: 0, 3: 0, '4+': 0 };
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmations['4+']++;
            else confirmations[count] = (confirmations[count] || 0) + 1;
        }

        return {
            id: model.id,
            name: model.metadata.name,
            stats: {
                nodes: graph.nodes.size,
                edges: graph.edges.size,
                confirmed1: confirmations[1] || 0,
                confirmed2: confirmations[2] || 0,
                confirmed3: confirmations[3] || 0,
                confirmed4plus: confirmations['4+'] || 0,
                photosCount: model.metadata.photoCount || 0
            },
            metadata: model.metadata,
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated
        };
    }

    getStats() {
        return {
            system: this.stats,
            models: this.getModelsStats(),
            relations: this.getModelRelations()
        };
    }

    exportModel(modelId) {
        const model = this.models.get(modelId);
        if (!model) return null;

        return {
            id: model.id,
            metadata: model.metadata,
            graph: {
                nodes: Array.from(model.graph.nodes.entries()),
                edges: Array.from(model.graph.edges),
                avgDegree: model.graph.avgDegree
            },
            knnFingerprints: Array.from(model.knnFingerprints.entries()),
            morphologyMap: Array.from(model.morphologyMap.entries()),
            history: model.history
        };
    }

    importModel(modelData) {
        try {
            const modelId = modelData.id;
            const nodes = new Map(modelData.graph.nodes);
            const edges = new Set(modelData.graph.edges);
            const knnFingerprints = new Map(modelData.knnFingerprints);
            const morphologyMap = new Map(modelData.morphologyMap);

            const model = {
                id: modelId,
                graph: { nodes, edges, avgDegree: modelData.graph.avgDegree },
                knnGraph: null,
                knnFingerprints,
                morphologyMap,
                originalPoints: [],
                metadata: modelData.metadata,
                history: modelData.history || []
            };

            this.models.set(modelId, model);
            this.stats.totalModels++;
            console.log(`📥 Импортирована модель ${modelId.slice(0, 12)}...`);
            return true;
        } catch (error) {
            console.log(`❌ Ошибка импорта: ${error.message}`);
            return false;
        }
    }

    clear() {
        this.models.clear();
        this.currentModelId = null;
        this.modelRelations.clear();
        this.photoToModel.clear();
        this.fingerprinter.clearCache();
        this.localGroupSignature.clearCache();
        this.morphologyEncoder.clearCache();
        this.centerMatcher.clear();
        this.relativePositioning.clear();

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
