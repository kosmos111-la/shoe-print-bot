// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ МУЛЬТИ-МОДЕЛЬНЫЙ АККУМУЛЯТОР - ИСПРАВЛЕННАЯ ВЕРСИЯ 

const GraphBuilder = require('./GraphBuilder');
const KNNGraphBuilder = require('./KNNGraphBuilder');
const LocalGroupSignature = require('./LocalGroupSignature');
const MorphologyEncoder = require('./MorphologyEncoder');
const CenterMatcher = require('./CenterMatcher');
const RelativePositioning = require('./RelativePositioning');
const TopologicalFingerprint = require('./TopologicalFingerprint');
const TriangleMatcher = require('../matching/TriangleMatcher');
const PatternAnalyzer = require('../analysis/PatternAnalyzer');
const ClusterAnalyzer = require('../analysis/ClusterAnalyzer');
const ValidationModule = require('../validation/ValidationModule');
const StructureManager = require('./StructureManager');
const AffineRefiner = require('./AffineRefiner');
const GeometryUtils = require('./utils/GeometryUtils');
const GraphUtils = require('./utils/GraphUtils');
const RoleClassifier = require('./utils/RoleClassifier');
const ModelEnhancer = require('./enhancers/ModelEnhancer');

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

this.affineRefiner = new AffineRefiner({
    debug: this.debug,
    maxIterations: 3,
    useRansac: true,
    ransacThreshold: 5
});

 this.roleClassifier = new RoleClassifier({
            hubThreshold: options.hubThreshold || 6,
            bridgeThreshold: options.bridgeThreshold || 2,
            cliqueThreshold: options.cliqueThreshold || 3
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

 // 🔥 ДОБАВИТЬ ВАЛИДАТОР
    const ValidationModule = require('../validation/ValidationModule');
    this.validator = new ValidationModule({
        debug: this.debug,
        positionThreshold: 0.15,
        morphologyThreshold: 0.85
    });
      
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
        console.log(`   🔥 Режим: ${this.fastMode ? 'БЫСТРЫЙ' : 'ПОЛНЫЙ'}`);
        console.log(`   🔷 Порог сходства: ${this.similarityThreshold * 100}%`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    async processPoints(points, options = {}) {
        console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК...`);

        const photoId = options.photoId || `photo_${Date.now()}`;
        const contours = options.contours || [];
        const modelIdHint = options.modelId;

    // 🔥 НОВОЕ: Извлекаем контур следа из contours
    const outlineContour = contours.find(c => c.class === 'Outline-trail' || c.type === 'footprint_outline');
   
    if (outlineContour && this.debug) {
        console.log(`📐 Найден контур следа (${outlineContour.points.length} точек) для сохранения в модель`);
    }

        if (this.debug) {
            console.log(`\n🔍 ОТЛАДКА processPoints:`);
            console.log(`   • photoId: ${photoId}`);
            console.log(`   • modelIdHint: ${modelIdHint}`);
            console.log(`   • models.has: ${this.models.has(modelIdHint)}`);
        }

        // 1. Строим графы
        const exactGraph = this.graphBuilder.buildGraph(points, options.source || 'photo');
        const knnGraph = this.knnBuilder.buildGraph(points, options.source || 'photo_knn');
        const morphologyMap = this.morphologyEncoder.encode(points, contours);
        const knnFingerprints = this.fingerprinter.computeGraphFingerprints(knnGraph);

        // 🔥 2. Если есть существующая модель - пробуем треугольное сравнение
if (modelIdHint && this.models.has(modelIdHint)) {
    console.log(`\n✅ НАЙДЕНА МОДЕЛЬ, запускаю улучшение...`);

    const existingModel = this.models.get(modelIdHint);

    if (!this.modelEnhancer) {
        const ModelEnhancer = require('./enhancers/ModelEnhancer');
        this.modelEnhancer = new ModelEnhancer({
            debug: this.debug,
            fastMode: this.fastMode,
            validator: this.validator,
            positionThreshold: this.positionThreshold,
            morphologyThreshold: this.morphologyThreshold
        });
    }

    const enhanceResult = await this.modelEnhancer.enhance(
    existingModel,
    exactGraph,
    morphologyMap,
    points,
    { photoId, contours, outlineContour, fastMode: this.fastMode }
);

if (enhanceResult.success) {
    // Обновляем модель
    existingModel.transform = enhanceResult.transform;
    existingModel.structures = enhanceResult.structures;
   
    // 🔥 ВАЖНО: строим pointToStructure для визуализации треугольников
    if (enhanceResult.structures && enhanceResult.structures.length > 0) {
        existingModel.pointToStructure = new Map();
        for (const structure of enhanceResult.structures) {
            if (structure.pointIds && Array.isArray(structure.pointIds)) {
                for (const pointId of structure.pointIds) {
                    existingModel.pointToStructure.set(pointId, structure.id);
                }
            }
            // Также обрабатываем pointIds из структуры, если они в другом формате
            if (structure.points && Array.isArray(structure.points)) {
                for (const point of structure.points) {
                    existingModel.pointToStructure.set(point.id || point, structure.id);
                }
            }
        }
        console.log(`   🔗 Построено pointToStructure: ${existingModel.pointToStructure.size} записей`);
    }
   
    // 🔥 Сохраняем уникальные точки фото для последующего добавления
    if (enhanceResult.uniquePhotoPoints) {
        this.lastUniqueInPhoto = enhanceResult.uniquePhotoPoints;
    }
       
        this.stats.triangleMatchesCount += enhanceResult.matches.length;
       
        const cleanResult = this.cleanUnconfirmedNodes(modelIdHint, 2, 3);
        this.stats.totalNodesRemoved += cleanResult.removed;
       
        const { matchMap, modelMatchMap } = this.buildTriangleMatchMap(
    { matches: enhanceResult.matches || [] },  // ← убедитесь, что matches не пустые
    modelIdHint
);
       
        if (existingModel) {
            existingModel.lastTriangleResult = {
                modelMatchMap: modelMatchMap,
                matchMap: matchMap,
                transform: enhanceResult.transform
            };
        }
       
        // Сохраняем уникальные точки фото для последующего добавления
        if (enhanceResult.uniquePhotoPoints) {
            this.lastUniqueInPhoto = enhanceResult.uniquePhotoPoints;
        }
       
        console.log(`\n📊 СТАТИСТИКА МОДЕЛИ ПОСЛЕ УЛУЧШЕНИЯ:`);
        console.log(`   • Всего узлов: ${existingModel.graph.nodes.size}`);
        console.log(`   • Подтверждено: ${enhanceResult.matches.length}`);
       
        return {
            status: 'enhanced',
            modelId: modelIdHint,
            similarity: enhanceResult.similarity,
            matches: enhanceResult.matches,
            newNodesAdded: enhanceResult.newNodesAdded,
            nodesRemoved: cleanResult.removed,
            matchMap: matchMap,
            modelMatchMap: modelMatchMap,
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

        // Если это первое фото вообще - создаём первую модель
        if (this.models.size === 0) {
            console.log(`🆕 Первое фото в сессии, создаю первую модель`);
            const result = this.createNewModel(exactGraph, knnFingerprints, morphologyMap, points, {
    ...options,
    outlineContour: outlineContour  // 🔥 ПЕРЕДАЁМ КОНТУР
});
            this.photoToModel.set(photoId, result.modelId);
            return {
                ...result,
                isFirstModel: true,
                totalModels: this.models.size
            };
        }

        // Если быстрый путь не сработал - идем по стандартному пути
        if (this.debug) console.log(`\n🔍 Быстрый путь не сработал, запускаю полный анализ...`);

        // Сравниваем со ВСЕМИ существующими моделями
        if (this.debug) console.log(`\n🔍 Сравниваю с ${this.models.size} существующими моделями...`);

        const comparisons = [];

        for (const [modelId, model] of this.models) {
            if (this.debug) console.log(`   Проверяю модель ${modelId.slice(0, 12)}...`);

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

        if (this.debug) {
            console.log(`\n📊 Лучшее совпадение:`);
            console.log(`   Модель: ${bestMatch.modelId.slice(0, 12)}...`);
            console.log(`   Сходство: ${(bestMatch.similarity * 100).toFixed(1)}%`);
        }

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

              if (this.models.has(modelIdHint)) {
    const model = this.models.get(modelIdHint);
    if (outlineContour && !model.metadata.outlineContour) {
        // Сохраняем только если ещё нет (или обновляем)
        model.metadata.outlineContour = outlineContour;
        console.log(`💾 Контур следа сохранён в модель ${modelIdHint.substring(0,12)}`);
        console.log(`   точек в контуре: ${outlineContour.points.length}`);
    } else if (outlineContour && model.metadata.outlineContour) {
        console.log(`⚠️ Контур уже существует в модели, не перезаписываю`);
    } else if (!outlineContour) {
        console.log(`⚠️ Нет контура для сохранения`);
    }
}

    // В возвращаемом результате также передаём контур
    return {
                status: 'created_new',
                modelId: result.modelId,
                similarity: bestMatch.similarity,
                comparedWith: bestMatch.modelId,
                totalModels: this.models.size,
     outlineContour: outlineContour,
                isDifferentFootprint: true,
                message: `Обнаружен ДРУГОЙ след! Создана новая модель.`
            };
        }
    }

    // ==================== НОВЫЙ МЕТОД: ТРЕУГОЛЬНОЕ СРАВНЕНИЕ ====================

    async compareByTriangleMatching(model1, model2, options = {}) {
        const startTime = Date.now();
        if (this.debug) console.log(`\n🔍 Треугольное сопоставление...`);

        // Извлекаем точки из моделей
        const points1 = this.extractPointsFromModel(model1);
        const points2 = this.extractPointsFromModel(model2);

        if (this.debug) console.log(`📊 Точек: ${points1.length} ↔ ${points2.length}`);

        // Создаем треугольный матчер
        const triangleMatcher = new TriangleMatcher({
            debug: false,  // ← уже выключено
            compactnessThreshold: 0.4,
            eccentricityThreshold: 0.2,
            areaThreshold: 0.5,
            ratioThreshold: 0.25
        });

        // 🔥 ЗАЩИТА: проверяем, что точки не пустые
        if (!points1 || !points2 || points1.length === 0 || points2.length === 0) {
            if (this.debug) console.log(`❌ Нет точек для сопоставления`);
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
        if (this.debug) console.log(`🔍 Запуск TriangleMatcher.findMatches...`);
        let result;
        try {
            result = triangleMatcher.findMatches(
                points1,
                points2,
                model1.graph,
                model2.graph
            );
        } catch (error) {
            if (this.debug) {
                console.log(`❌ Ошибка в triangleMatcher.findMatches:`, error.message);
                console.log(error.stack);
            }
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
            if (this.debug) console.log(`❌ triangleMatcher.findMatches вернул null/undefined`);
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
            if (this.debug) {
                console.log(`❌ result.matches = undefined`);
                console.log(`   result =`, result);
                console.log(`   keys =`, Object.keys(result));
            }
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

        if (this.debug) console.log(`✅ triangleMatcher.findMatches выполнен, matches: ${result.matches.length}`);

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
    triangles: result.triangles,  // 🔥 ПЕРЕДАЁМ ДАЛЬШЕ
    count: result.matches.length,
    sufficient: result.matches.length >= 12,
    similarity: result.matches.length / Math.min(points1.length, points2.length),
    time: Date.now() - startTime,
    ambiguous: [],
    noMatchA,
    noMatchB,
    stats: result.stats
};

        if (this.debug) {
            console.log(`\n📊 РЕЗУЛЬТАТ ТРЕУГОЛЬНОГО СОПОСТАВЛЕНИЯ:`);
            console.log(`   • Найдено соответствий: ${finalResult.count}`);
            console.log(`   • Новых в А: ${finalResult.noMatchA.length}`);
            console.log(`   • Новых в Б: ${finalResult.noMatchB.length}`);
            console.log(`   • Достаточно для якорей: ${finalResult.sufficient ? '✅' : '❌'}`);
            console.log(`   • Время: ${finalResult.time}ms`);
        }

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
                role: this.roleClassifier.classifySimple(nodeId, graph),
                degree: node.degree || 0,
                triangles: node.triangles || 0,

                // МОРФОЛОГИЯ
                compactness: morph.compactness || 0,
                eccentricity: morph.eccentricity || 0,
                normalizedArea: morph.normalizedArea || 1,
                radialProfile: morph.radialProfile || [0,0,0,0,0,0,0,0],
                orientation: morph.orientation || 0,
                asymmetry: morph.asymmetry || 0,

                // 🔥 КОНТУР (для новых признаков)
                contour: morph.contour || null,

                neighborRoles: this.getNeighborRolesForPoint(nodeId, graph)
            });
        }

        if (this.debug) console.log(`📊 Извлечено ${points.length} точек из модели с морфологией`);
        return points;
    }

    /**
     * Строит matchMap для визуализации
     */
    buildTriangleMatchMap(result, targetModelId = null) {
        if (this.debug) {
            console.log(`\n🔍 buildTriangleMatchMap: начало`);
            console.log(`   • result.matches.length = ${result.matches?.length || 0}`);
            console.log(`   • Якорей (треугольников): ${result.anchors || 'не указано'}`);
        }

        if (!result.matches || result.matches.length === 0) {
            if (this.debug) console.log(`   ⚠️ Нет matches для построения map`);
            return { matchMap: new Map(), modelMatchMap: new Map() };
        }

        // ===== ШАГ 1: Сортируем все matches по убыванию уверенности =====
        if (this.debug) console.log(`\n📋 ШАГ 1: Сортировка matches по уверенности`);

        const sortedMatches = [...result.matches].sort((a, b) => b.confidence - a.confidence);

        // Покажем первые 5 для отладки
        if (this.debug) {
            sortedMatches.slice(0, 5).forEach((m, i) => {
                console.log(`   ${i+1}. уверенность: ${(m.confidence*100).toFixed(1)}%`);
            });
        }

        // ===== ШАГ 2: Строим максимальное непротиворечивое множество =====
        if (this.debug) console.log(`\n📋 ШАГ 2: Построение максимального непротиворечивого множества`);

        const pointCorrespondence = new Map(); // pointA -> pointB
        const reverseCorrespondence = new Map(); // pointB -> pointA
        let added = 0;
        let skipped = 0;

        for (const match of sortedMatches) {
            const pointA = match.pointA;
            const pointB = match.pointB;

            // Проверяем, свободны ли обе точки
            const aFree = !pointCorrespondence.has(pointA);
            const bFree = !reverseCorrespondence.has(pointB);

            if (aFree && bFree) {
                // Обе точки свободны - добавляем
                pointCorrespondence.set(pointA, pointB);
                reverseCorrespondence.set(pointB, pointA);
                added++;

                if (this.debug && added <= 10) { // покажем первые 10
                    console.log(`   ✅ Добавлено: ${pointA.substring(0,12)} ↔ ${pointB.substring(0,12)} (уверенность: ${(match.confidence*100).toFixed(1)}%)`);
                }
            } else {
                skipped++;
                if (this.debug && skipped <= 5) { // покажем первые 5 пропущенных
                    console.log(`   ⚠️ Пропущено: ${pointA.substring(0,12)} ↔ ${pointB.substring(0,12)} (уверенность: ${(match.confidence*100).toFixed(1)}%)`);
                    if (!aFree) console.log(`      • pointA уже соответствует ${pointCorrespondence.get(pointA).substring(0,12)}`);
                    if (!bFree) console.log(`      • pointB уже соответствует ${reverseCorrespondence.get(pointB).substring(0,12)}`);
                }
            }
        }

        if (this.debug) {
            console.log(`\n📊 ИТОГ ПОСТРОЕНИЯ:`);
            console.log(`   • Добавлено уникальных соответствий: ${added}`);
            console.log(`   • Пропущено (конфликты): ${skipped}`);
            console.log(`   • Всего обработано matches: ${sortedMatches.length}`);
        }

        // ===== ШАГ 3: Назначаем номера парам =====
        if (this.debug) console.log(`\n📋 ШАГ 3: Назначение номеров парам`);

        const matchMap = new Map();
        const modelMatchMap = new Map();
        let pairNumber = 1;

        // Для назначения номеров используем тот же порядок, что и при добавлении
        for (const [pointA, pointB] of pointCorrespondence) {
            // 🔥 ИЩЕМ СТАТУС ТОЧКИ В ИСХОДНЫХ ДАННЫХ
            const match = result.matches.find(m => m.pointA === pointA && m.pointB === pointB);
            const status = match?.status || 'anchor'; // по умолчанию anchor

            matchMap.set(pointA, {
                modelId: pointB,
                pairNumber: pairNumber,
                type: 'anchor',
                confidence: 1.0,
                status: status
            });

            modelMatchMap.set(pointB, {
                photoId: pointA,
                pairNumber: pairNumber,
                type: 'anchor',
                confidence: 1.0,
                status: status
            });

            if (this.debug) console.log(`   Пара ${pairNumber}: ${pointA.substring(0,12)} ↔ ${pointB.substring(0,12)} [${status}]`);
            pairNumber++;
        }

        // ===== ШАГ 4: Проверка целостности =====
        if (this.debug) {
            console.log(`\n📊 ИТОГ buildTriangleMatchMap:`);
            console.log(`   • matchMap size: ${matchMap.size}`);
            console.log(`   • modelMatchMap size: ${modelMatchMap.size}`);
            console.log(`   • Уникальных photo точек: ${pointCorrespondence.size}`);
            console.log(`   • Уникальных model точек: ${reverseCorrespondence.size}`);
        }

        // Проверяем, сколько уникальных точек должно быть
        const uniquePhotoPoints = new Set(result.matches.map(m => m.pointA));
        const uniqueModelPoints = new Set(result.matches.map(m => m.pointB));

        if (this.debug) {
            console.log(`\n📊 СТАТИСТИКА ИСХОДНЫХ ДАННЫХ:`);
            console.log(`   • Уникальных photo точек в matches: ${uniquePhotoPoints.size}`);
            console.log(`   • Уникальных model точек в matches: ${uniqueModelPoints.size}`);
            console.log(`   • Покрытие photo точек: ${((pointCorrespondence.size / uniquePhotoPoints.size) * 100).toFixed(1)}%`);
            console.log(`   • Покрытие model точек: ${((reverseCorrespondence.size / uniqueModelPoints.size) * 100).toFixed(1)}%`);
        }

        // ===== ШАГ 5: Сохраняем в модель =====
        const modelIdToUse = targetModelId || this.currentModelId;
        if (this.debug) console.log(`\n💾 Сохранение в модель ${modelIdToUse?.substring(0,12)}:`);

        if (modelIdToUse && this.models.has(modelIdToUse)) {
            const model = this.models.get(modelIdToUse);

            model.lastTriangleResult = {
                ...(model.lastTriangleResult || {}),
                modelMatchMap: modelMatchMap,
                matchMap: matchMap,
                pointCorrespondence: pointCorrespondence,
                stats: {
                    totalMatches: result.matches.length,
                    uniquePhotoPoints: uniquePhotoPoints.size,
                    uniqueModelPoints: uniqueModelPoints.size,
                    coverage: (pointCorrespondence.size / uniquePhotoPoints.size) * 100,
                    conflicts: skipped,
                    anchors: matchMap.size
                },
                timestamp: new Date().toISOString()
            };

            if (this.debug) {
                console.log(`   ✅ modelMatchMap сохранён (${modelMatchMap.size} записей)`);
                console.log(`   ✅ matchMap сохранён (${matchMap.size} записей)`);
                console.log(`   📊 Статистика сохранена в модели`);
            }

        } else {
            if (this.debug) console.log(`   ❌ Модель ${modelIdToUse?.substring(0,12)} не найдена!`);
        }

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
     * Получить роли соседей
     */
    getNeighborRolesForPoint(nodeId, graph) {
    const neighbors = GraphUtils.findNodeNeighbors(nodeId, graph);
    const roles = [];
    for (const neighbor of neighbors) {
        roles.push(this.roleClassifier.classifySimple(neighbor.id, graph));
    }
    return roles.sort().join('');
}


    // ==================== ОСТАЛЬНЫЕ МЕТОДЫ ====================

    updateModelWithOptimalMatches(modelId, newGraph, matches, newMorphology) {
    const model = this.models.get(modelId);
    let confirmedExisting = 0;
    let newNodesAdded = 0;

    const matchedPhotoIds = new Set();
    const matchedModelIds = new Set();

    // 1. Обновляем существующие точки (только счётчик!)
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
            for (const [modelId, modelNode] of model.graph.nodes) {
                const dx = modelNode.x - photoPoint.x;
                const dy = modelNode.y - photoPoint.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
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
                if (this.debug) console.log(`      ✅ Добавлена новая точка (${photoPoint.x.toFixed(1)}, ${photoPoint.y.toFixed(1)})`);
            }
        }
    }

    if (this.debug) {
        console.log(`\n📊 Результат обновления модели:`);
        console.log(`   • Подтверждено существующих: ${confirmedExisting}`);
        console.log(`   • Новых точек добавлено: ${newNodesAdded}`);
        console.log(`   • Всего узлов в модели: ${model.graph.nodes.size}`);
    }

    return { confirmedExisting, newNodesAdded };
}

    async enhanceExistingModel(modelId, newExactGraph, newKNNGraph, newKnnFingerprints, newMorphology, options) {
        const model = this.models.get(modelId);
        if (!model) return { error: 'Модель не найдена' };

        if (this.debug) {
            console.log(`\n🔧 УЛУЧШАЮ МОДЕЛЬ ${modelId.slice(0, 12)}...`);
            console.log(`\n🔧 ЗАПУСК ПОЛНОГО АНАЛИЗА (на Делоне-графе)...`);
        }

        const centerMatches = this.centerMatcher.findCenterMatches(
            newExactGraph,
            model.graph,
            newMorphology,
            model.morphologyMap
        );

        if (this.debug) console.log(`\n🔴 CenterMatcher нашёл ${centerMatches.size} якорей`);

        let allMatches = new Map();
        let stabilizedMatches = new Map();
        let finalMatches = new Map([...centerMatches]);
        let newNodesAdded = 0;

        if (centerMatches.size >= this.centerMatcher.minConsistentPairs) {
            if (this.debug) console.log(`\n🧩 RelativePositioning достраивает остальные точки...`);

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
            if (this.debug) console.log(`\n⚠️ Недостаточно якорей (${centerMatches.size})`);
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

        if (this.debug) console.log(`\n📋 ФОРМИРОВАНИЕ MATCHMAP:`);

        for (const [photoId, match] of centerMatches) {
            if (match && match.confidence >= 0.7) {
                matchMap.set(photoId, {
                    modelId: match.modelId,
                    pairNumber: pairNumber++,
                    type: 'anchor'
                });
                if (this.debug) console.log(`   🔴 Якорь ${pairNumber-1}: ${photoId.slice(0,12)}... ↔ ${match.modelId.slice(0,12)}...`);
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

        if (this.debug) console.log(`\n📊 ИТОГО: ${centerMatches.size} якорей, ${matchMap.size - centerMatches.size} дополнительных точек`);
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
            if (this.debug) console.log(`❌ Модель ${modelId} не найдена`);
            return false;
        }
        this.currentModelId = modelId;
        if (this.debug) console.log(`🔄 Переключился на модель ${modelId.slice(0, 12)}...`);
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
                role: this.roleClassifier.classifySimple(point.id, exactGraph),
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
                logArea: morph.logArea,
                asymmetry: morph.asymmetry || 0
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
            node.asymmetry = morph.asymmetry || 0;
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
 // 🔥 СОХРАНЯЕМ КОНТУР В МОДЕЛЬ (если передан)
    if (options.outlineContour) {
        model.metadata.outlineContour = options.outlineContour;
        console.log(`💾 Контур следа сохранён в новую модель ${modelId.substring(0,12)}`);
        console.log(`   точек в контуре: ${options.outlineContour.points.length}`);
    }
        this.models.set(modelId, model);
        this.currentModelId = modelId;
        this.stats.totalModels++;
        this.stats.lastUpdated = new Date();

        console.log(`🏗 СОЗДАНА НОВАЯ МОДЕЛЬ ${modelId.slice(0, 12)}...:`);
        console.log(`   Узлов: ${exactGraph.nodes.size}`);
        console.log(`   Точек с морфологией: ${morphologyMap.size}`);
        console.log(`   Паттернов найдено: ${Object.keys(patternData.patterns || {}).length}`);
        console.log(`   Кластеров: ${Object.keys(clusterData.clusters || {}).length}`);

        const clusterSizes = Object.values(clusterData.clusters || {}).map(c => c.size);
        const avgClusterSize = clusterSizes.length > 0
            ? (clusterSizes.reduce((a, b) => a + b, 0) / clusterSizes.length).toFixed(1)
            : 0;
        console.log(`   • Средний размер кластера: ${avgClusterSize}`);
        console.log(`   • Уникальных кластеров: ${clusterData.stats?.uniqueClusters || 0}`);

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

                const graphDist = GraphUtils.graphDistance(newNode.id, existingId, modelGraph);

                if (graphDist <= this.duplicateGraphDistance) {
                    return true;
                }
            }
        }
        return false;
    }

    graphDistance(nodeA, nodeB, graph) {
    return GraphUtils.graphDistance(nodeA, nodeB, graph);
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

        if (this.debug) console.log(`🧹 Очищено ${toRemove.length} неподтверждённых точек`);
        return { removed: toRemove.length, remaining: graph.nodes.size };
    }

    setTriangleResult(modelId, result) {
        const model = this.models.get(modelId);
        if (model) {
            model.lastTriangleResult = result;
        }
    }

    updateEdges(modelGraph, newGraph, matches) {
        // 🔥 Преобразуем Set в массив для итерации
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

        // 🔥 Преобразуем Set в массив для итерации
        const modelEdges = Array.isArray(modelGraph.edges) ? modelGraph.edges : Array.from(modelGraph.edges);

        for (const edge of modelEdges) {
            const [a, b] = edge.split('--');
            if (modelGraph.nodes.has(a)) modelGraph.nodes.get(a).degree++;
            if (modelGraph.nodes.has(b)) modelGraph.nodes.get(b).degree++;
        }
    }

    computeTriangles(graph) {
    if (!graph || !graph.nodes || !graph.edges) return [];

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
                        triangles.push({ p1, p2, p3 });
                    }
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

    // 🔥 ПОЛУЧАЕМ КОНТУР (ОДИН РАЗ)
    const outlineContour = model.metadata?.outlineContour || null;

    if (this.debug) {
        console.log(`\n🔍 getVisualizationData: контур из метаданных:`);
        console.log(`   outlineContour: ${outlineContour ? 'ЕСТЬ' : 'НЕТ'}`);
        if (outlineContour) {
            console.log(`   points: ${outlineContour.points?.length || 0}`);
        }
    }

    const rawStructures = model.structures || [];
    const pointToStructure = model.pointToStructure || new Map();
    const structureColors = this.generateStructureColors(rawStructures);

    const structures = rawStructures.filter(s => s && s.id).map(s => ({
        id: s.id,
        pointCount: s.pointIds ? s.pointIds.length : 0,
        pointIds: s.pointIds || [],
        triangleCount: s.triangleIds ? s.triangleIds.length : 0,
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

    const modelMatchMapFromModel = model.lastTriangleResult?.modelMatchMap || new Map();

    let reliableNodeIds = new Set(reliablePhotoIds);
    if (reliableNodeIds.size === 0) {
        for (const [nodeId, node] of graph.nodes) {
            if (node.confirmationCount >= 2) reliableNodeIds.add(nodeId);
        }
    }

    const modelTriangles = this.extractTrianglesFromGraph(graph);

   // 🔥 НОВОЕ: считаем подтверждённые точки для метрики (ДО return)
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
    structures: structures,
    triangles: modelTriangles,
    pointToStructure: pointToStructure,
    outlineContour: outlineContour,
    stats: {
        totalNodes: graph.nodes.size,
        totalEdges: graph.edges.size,
        confirmed3: pointsByConfirmation.confirmed3.length,
        confirmed2: pointsByConfirmation.confirmed2.length,
        confirmed1: pointsByConfirmation.confirmed1.length,
        confirmed0: pointsByConfirmation.confirmed0.length,
        structureCount: structures.length,
        reliableNodes: reliableNodeIds.size,
        // 🔥 НОВЫЕ ПОЛЯ
        uniquePoints: graph.nodes.size,
        confirmedPoints: confirmedPointsCount,
        stability: stability
    },
    pointsByConfirmation: pointsByConfirmation,
    metadata: model.metadata,
    allModels: this.getAllModels(),
    currentModelId: this.currentModelId,
    modelMatchMap: modelMatchMapFromModel,
    transform: model.transform,
    uniquePoints: model.uniquePoints
};
}

generateStructureColors(structures) {
    const colors = new Map();
    const palette = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7B787', '#B5EAD7', '#C7CEE6',
        '#FFB7B2', '#B5F2E8', '#FFDAC1', '#E2F0CB', '#B5E3FF',
        '#FF9AA2', '#FFDAC1', '#B5EAD7', '#C7CEE6', '#F5C6A0'
    ];

    structures.forEach((structure, idx) => {
        colors.set(structure.id, palette[idx % palette.length]);
    });

    return colors;
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

  /**
* Глобальная проверка согласованности всех найденных якорей
*/
checkGlobalConsistency(anchors, trianglesA, trianglesB, graphA, graphB) {
    if (!this.modelEnhancer) {
        const ModelEnhancer = require('./enhancers/ModelEnhancer');
        this.modelEnhancer = new ModelEnhancer({ debug: this.debug });
    }
    return this.modelEnhancer.checkGlobalConsistency(anchors, trianglesA, trianglesB, graphA, graphB);
}

/**
* Двухэтапная достройка точек на основе согласованных якорей
*/
twoStagePositioning(anchors, allMatches, graphA, graphB, morphologyMap, modelMorphology) {
    if (!this.modelEnhancer) {
        const ModelEnhancer = require('./enhancers/ModelEnhancer');
        this.modelEnhancer = new ModelEnhancer({ debug: this.debug });
    }
    return this.modelEnhancer.twoStagePositioning(anchors, allMatches, graphA, graphB, morphologyMap, modelMorphology);
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
    * Извлекает все треугольники из графа
    * @param {Object} graph - граф с nodes и edges
    * @returns {Array} - массив треугольников {p1, p2, p3}
    */
extractTrianglesFromGraph(graph) {
        // Временно делегируем в ModelEnhancer (после импорта)
        if (!this.modelEnhancer) {
            const ModelEnhancer = require('./enhancers/ModelEnhancer');
            this.modelEnhancer = new ModelEnhancer({ debug: this.debug });
        }
        return this.modelEnhancer.extractTrianglesFromGraph(graph);
    }


/**
* Вычисляет угол между тремя точками (вершина в точке b)
*/
calcAngleInTriangle(a, b, c) {
    // Делегируем в GeometryUtils
    return GeometryUtils.angleBetween(a, b, c);
}

/**
* Находит модель точки по ID фото (из структуры)
*/
findModelPointForPhoto(photoPointId, structure) {
    const anchors = structure.getAnchors();
    const anchor = anchors.find(a => a.pointA === photoPointId);
    return anchor ? anchor.pointB : null;
}
 

    /**
    * Проверяет равенство массивов (для сравнения треугольников)
    */
    arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

/**
* Геометрическое расширение структуры через поиск новых точек
* @param {Object} structure - текущая структура
* @param {Object} graphA - граф фото
* @param {Object} graphB - граф модели
* @param {Map} morphologyMap - морфология фото
* @param {Map} modelMorphology - морфология модели
* @returns {number} - количество добавленных точек
*/
expandStructureGeometrically(structure, graphA, graphB, morphologyMap, modelMorphology) {
    if (!structure || !structure.transform) {
        if (this.debug) console.log(`   ⚠️ Нет transform у структуры`);
        return 0;
    }

    let totalAdded = 0;
    let iteration = 0;
    const maxIterations = 10;
    let expanded = true;

    while (expanded && iteration < maxIterations) {
        expanded = false;
        iteration++;

        const boundaryEdges = this.getBoundaryEdgesFromStructure(structure);
        const pointsInStructure = new Set(structure.pointIds);
        let addedThisIter = 0;

        for (const edge of boundaryEdges) {
            const photoA = edge.v1;
            const photoB = edge.v2;

            const neighborsA = GraphUtils.findNodeNeighbors(photoA.id, graphA);
            const neighborsB = GraphUtils.findNodeNeighbors(photoB.id, graphA);

            const candidates = [];
            for (const nA of neighborsA) {
                if (pointsInStructure.has(nA.id)) continue;
                if (neighborsB.some(nB => nB.id === nA.id)) {
                    candidates.push(nA);
                }
            }
            if (candidates.length === 0) continue;

            const modelA = this.getModelPointFromStructure(photoA.id, structure);
            const modelB = this.getModelPointFromStructure(photoB.id, structure);
            if (!modelA || !modelB) continue;

            for (const candidate of candidates) {
                if (pointsInStructure.has(candidate.id)) continue;

                const photoTriangle = { p1: photoA, p2: photoB, p3: candidate };
                const projectedC = this.applyTransform(candidate, structure.transform);
                const modelC = { x: projectedC.x, y: projectedC.y };

                const isValid = this.compareTrianglesGeometrically(
                    photoTriangle, { p1: modelA, p2: modelB, p3: modelC }, structure
                );

                if (isValid) {
                    const modelPoint = this.findNearestModelPoint(modelC, graphB);
                    if (modelPoint) {
                        if (structure.addPoint) structure.addPoint(candidate, modelPoint);
                        if (structure.addAnchor) {
                            structure.addAnchor({ pointA: candidate.id, pointB: modelPoint.id, confidence: 0.85 });
                        }
                        pointsInStructure.add(candidate.id);
                        totalAdded++;
                        addedThisIter++;
                        expanded = true;
                        break;
                    }
                }
            }
        }

        // 🔥 ВЫВОД ПО ИТЕРАЦИИ (только если что-то добавили)
        if (this.debug && addedThisIter > 0) {
            console.log(`   • Итерация ${iteration}: +${addedThisIter} тр. (всего ${structure.triangleIds.size})`);
        } else if (this.debug && iteration === 1 && addedThisIter === 0) {
            console.log(`   • Итерация ${iteration}: +0 тр. (нет кандидатов)`);
        }

        if (expanded) {
            const anchors = structure.getAnchors();
            if (anchors.length >= 3) {
                const newTransform = this.validator.calculateTransform(anchors, graphA, graphB);
                if (newTransform) structure.transform = newTransform;
            }
        }
    }

    // 🔥 ИТОГОВЫЙ ВЫВОД
    if (this.debug) {
        console.log(`   ✅ Расширение завершено: +${totalAdded} тр. (всего ${structure.triangleIds.size})`);
    }

    return totalAdded;
}



/**
* Сливает дублирующиеся точки в модели
* @param {Object} graph - граф модели
* @param {number} threshold - порог расстояния для слияния (px)
* @returns {number} - количество слитых точек
*/
    mergeDuplicatePoints(graph, threshold = 5) {
        if (!this.modelEnhancer) {
            const ModelEnhancer = require('./enhancers/ModelEnhancer');
            this.modelEnhancer = new ModelEnhancer({ debug: this.debug });
        }
        return this.modelEnhancer.mergeDuplicatePoints(graph, threshold);
    }

// ==================== ДЕЛЕГИРОВАНИЕ В ModelEnhancer ====================

getBoundaryEdgesFromStructure(structure) {
    if (!this.modelEnhancer) {
        const ModelEnhancer = require('./enhancers/ModelEnhancer');
        this.modelEnhancer = new ModelEnhancer({ debug: this.debug });
    }
    return this.modelEnhancer._getBoundaryEdgesFromStructure(structure);
}

findNeighborTriangleInGraph(edge, allTriangles, structure) {
    if (!this.modelEnhancer) {
        const ModelEnhancer = require('./enhancers/ModelEnhancer');
        this.modelEnhancer = new ModelEnhancer({ debug: this.debug });
    }
    return this.modelEnhancer._findNeighborTriangleInGraph(edge, allTriangles, structure);
}

findCommonEdgeInTriangle(triangle, structure) {
    if (!this.modelEnhancer) {
        const ModelEnhancer = require('./enhancers/ModelEnhancer');
        this.modelEnhancer = new ModelEnhancer({ debug: this.debug });
    }
    return this.modelEnhancer._findCommonEdgeInTriangle(triangle, structure);
}

compareTrianglesGeometrically(tPhoto, tModel, structure) {
    if (!this.modelEnhancer) {
        const ModelEnhancer = require('./enhancers/ModelEnhancer');
        this.modelEnhancer = new ModelEnhancer({ debug: this.debug });
    }
    return this.modelEnhancer._compareTrianglesGeometrically(tPhoto, tModel, structure);
}

findNearestModelPoint(point, graphB, threshold = 15) {
    if (!this.modelEnhancer) {
        const ModelEnhancer = require('./enhancers/ModelEnhancer');
        this.modelEnhancer = new ModelEnhancer({ debug: this.debug });
    }
    return this.modelEnhancer._findNearestModelPoint(point, graphB, threshold);
}

tryAddGeometricTriangle(triangle, structure, graphA, graphB, morphologyMap, modelMorphology) {
    if (!this.modelEnhancer) {
        const ModelEnhancer = require('./enhancers/ModelEnhancer');
        this.modelEnhancer = new ModelEnhancer({ debug: this.debug });
    }
    return this.modelEnhancer._tryAddGeometricTriangle(triangle, structure, graphA, graphB, morphologyMap, modelMorphology);
}

getModelPointFromStructure(pointId, structure) {
    if (!this.modelEnhancer) {
        const ModelEnhancer = require('./enhancers/ModelEnhancer');
        this.modelEnhancer = new ModelEnhancer({ debug: this.debug });
    }
    return this.modelEnhancer._getModelPointFromStructure(pointId, structure);
}
 
 // ==================== ВРЕМЕННЫЕ МЕТОДЫ-ОБЁРТКИ (ДО ПОЛНОГО РЕФАКТОРИНГА) ====================

/**
* Временная обёртка для совместимости
*/
calcDistance(p1, p2) {
    return GeometryUtils.distance(p1, p2);
}

/**
* Временная обёртка для совместимости
*/
findNodeNeighbors(nodeId, graph) {
    return GraphUtils.findNodeNeighbors(nodeId, graph);
}

/**
* Временная обёртка для совместимости
*/
applyTransform(point, transform) {
    return GeometryUtils.applyTransform(point, transform);
}

/**
* Временная обёртка для совместимости
*/
calcAngleInTriangle(a, b, c) {
    return GeometryUtils.angleBetween(a, b, c);
}

/**
* Временная обёртка для совместимости
*/
graphDistance(nodeA, nodeB, graph) {
    return GraphUtils.graphDistance(nodeA, nodeB, graph);
}

/**
* Временная обёртка для совместимости
*/
getNodeRoleSimple(nodeId, graph) {
    return this.roleClassifier.classifySimple(nodeId, graph);
}

 areConnected(aId, bId, graph) {
    return GraphUtils.areConnected(aId, bId, graph);
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
