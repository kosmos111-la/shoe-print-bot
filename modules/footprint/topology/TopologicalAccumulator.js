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
this.photoIdMapping = new Map(); // новый ID точки в фото -> оригинальный ID
    this.modelIdMapping = new Map(); // новый ID точки в модели -> оригинальный ID

      
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

    // 🔥 ВРЕМЕННО: срабатывает даже с 1 точкой
    if (triangleResult.count >= 1) {
        console.log(`\n✅ Найдено ${triangleResult.count} треугольных соответствий!`);

// ===== ШАГ 1: СОЗДАЁМ ВРЕМЕННЫЕ ЯКОРЯ ИЗ MATCHES =====
console.log(`\n🔍 СОЗДАНИЕ ВРЕМЕННЫХ ЯКОРЕЙ ДЛЯ ГЛОБАЛЬНОЙ ПРОВЕРКИ`);

// 🔥 ДИАГНОСТИКА: смотрим первые 9 matches
console.log(`\n🔍 ДИАГНОСТИКА matches (первые 9):`);
for (let i = 0; i < Math.min(9, triangleResult.matches.length); i++) {
    const m = triangleResult.matches[i];
    console.log(`   match[${i}]: pointA=${m.pointA.substring(0,15)}... pointB=${m.pointB.substring(0,15)}... conf=${m.confidence.toFixed(3)}`);
}

// Также покажем группировку по 3
console.log(`\n🔍 ГРУППИРОВКА ПО ТРЕУГОЛЬНИКАМ:`);
for (let i = 0; i < Math.min(9, triangleResult.matches.length); i += 3) {
    if (i + 2 < triangleResult.matches.length) {
        console.log(`   Треугольник ${i/3}:`);
        console.log(`      точка1: ${triangleResult.matches[i].pointA.substring(0,15)}... ↔ ${triangleResult.matches[i].pointB.substring(0,15)}...`);
        console.log(`      точка2: ${triangleResult.matches[i+1].pointA.substring(0,15)}... ↔ ${triangleResult.matches[i+1].pointB.substring(0,15)}...`);
        console.log(`      точка3: ${triangleResult.matches[i+2].pointA.substring(0,15)}... ↔ ${triangleResult.matches[i+2].pointB.substring(0,15)}...`);
    }
}

const tempAnchors = [];
const matches = triangleResult.matches;

for (let i = 0; i < matches.length; i += 3) {
    if (i + 2 < matches.length) {
        const group = [
            matches[i],
            matches[i+1],
            matches[i+2]
        ];
       
        tempAnchors.push({
            aIndex: -1,
            bIndex: -1,
            geometryScore: Math.min(...group.map(m => m.confidence)),
            points: group.map(m => ({
                pointA: m.pointA,
                pointB: m.pointB,
                confidence: m.confidence
            }))
        });
    }
}

console.log(`   • Создано временных якорей: ${tempAnchors.length}`);

// Получаем треугольники из графов (ПЕРЕД проверкой!)
console.log(`\n🔍 ИЗВЛЕЧЕНИЕ ТРЕУГОЛЬНИКОВ ИЗ ГРАФОВ`);
const trianglesA = this.extractTrianglesFromGraph(exactGraph);
const trianglesB = this.extractTrianglesFromGraph(existingModel.graph);

console.log(`   • Треугольников в A: ${trianglesA.length}`);
console.log(`   • Треугольников в B: ${trianglesB.length}`);

// ===== ШАГ 2: ГЛОБАЛЬНАЯ ПРОВЕРКА =====
console.log(`\n🔍 ЗАПУСК ГЛОБАЛЬНОЙ ПРОВЕРКИ СОГЛАСОВАННОСТИ`);

const consistent = this.checkGlobalConsistency(
    tempAnchors,
    trianglesA,
    trianglesB,
    exactGraph,
    existingModel.graph
);

        
        // ===== ШАГ 3: ДВУХЭТАПНАЯ ДОСТРОЙКА =====
const positionResult = this.twoStagePositioning(
    consistent.points,
    triangleResult.matches,
    exactGraph,
    existingModel.graph,
    morphologyMap,
    existingModel.morphologyMap
);

const finalMatches = positionResult.all;        // все 56 точек
const confirmedPoints = positionResult.anchors; // 44 точки (18+26)
const newPoints = positionResult.new;           // 12 точек

console.log(`\n📊 РЕЗУЛЬТАТ ДОСТРОЙКИ:`);
console.log(`   • Было matches: ${triangleResult.matches.length}`);
console.log(`   • Стало matches: ${finalMatches.length}`);
console.log(`   • Из них подтверждённых: ${confirmedPoints.length}`);
console.log(`   • Из них новых: ${newPoints.length}`);

// ===== ШАГ 3.5: ПРОВЕРКА ТОЛЬКО НОВЫХ ТОЧЕК =====
console.log(`\n🔄 ПРОВЕРКА ТОЛЬКО НОВЫХ ТОЧЕК (${newPoints.length})`);

let finalConsistentMatches = confirmedPoints; // начинаем с подтверждённых

if (newPoints.length > 0) {
    // Создаём временные якоря из новых точек
    const newAnchors = [];
    for (let i = 0; i < newPoints.length; i += 3) {
        if (i + 2 < newPoints.length) {
            const group = [
                newPoints[i],
                newPoints[i+1],
                newPoints[i+2]
            ];
            newAnchors.push({
                aIndex: -1,
                bIndex: -1,
                geometryScore: Math.min(...group.map(m => m.confidence)),
                points: group.map(m => ({
                    pointA: m.pointA,
                    pointB: m.pointB,
                    confidence: m.confidence
                }))
            });
        }
    }
   
    console.log(`   • Создано временных якорей: ${newAnchors.length}`);
   
    // Запускаем повторную глобальную проверку ТОЛЬКО для новых точек
    const newConsistent = this.checkGlobalConsistency(
        newAnchors,
        trianglesA,
        trianglesB,
        exactGraph,
        existingModel.graph
    );
   
    console.log(`\n📊 РЕЗУЛЬТАТ ПРОВЕРКИ НОВЫХ ТОЧЕК:`);
console.log(`   • Согласовалось: ${newConsistent.points.length}`);
console.log(`   • Отсеяно: ${newPoints.length - newConsistent.points.length}`);
   
    // Добавляем только согласованные новые точки
    finalConsistentMatches = [...confirmedPoints, ...newConsistent.points];
}

console.log(`\n🎯 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ:`);
console.log(`   • Старых подтверждённых: ${confirmedPoints.length}`);
console.log(`   • Новых согласованных: ${finalConsistentMatches.length - confirmedPoints.length}`);
console.log(`   • ВСЕГО: ${finalConsistentMatches.length} точек`);

// ===== ШАГ 4: КАСКАДНАЯ ДОСТРОЙКА =====
console.log(`\n🚀 ЗАПУСК КАСКАДНОЙ ДОСТРОЙКИ`);

// Преобразуем точки в формат якорей
const anchorsForCascade = finalConsistentMatches.map(p => ({
    pointA: p.pointA,
    pointB: p.pointB,
    confidence: p.confidence
}));

// Запускаем каскадную достройку
const cascadeResult = this.cascadePositioning(
    anchorsForCascade,
    exactGraph,
    existingModel.graph
);

// Обновляем финальные matches
const finalCascadeMatches = cascadeResult.anchors.map(a => ({
    pointA: a.pointA,
    pointB: a.pointB,
    confidence: a.confidence
}));

console.log(`\n🎯 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ ПОСЛЕ КАСКАДА:`);
console.log(`   • Было точек: ${finalConsistentMatches.length}`);
console.log(`   • Стало точек: ${finalCascadeMatches.length}`);
console.log(`   • Добавлено каскадом: ${cascadeResult.added}`);

// ===== ШАГ 5: ОБНОВЛЯЕМ МОДЕЛЬ =====
const updateResult = this.updateModelWithOptimalMatches(
    modelIdHint,
    exactGraph,
    finalCascadeMatches,  // ← ТЕПЕРЬ ИСПОЛЬЗУЕМ finalCascadeMatches
    morphologyMap
);

// 2.3 Обновляем KNN-граф и подписи
existingModel.knnGraph = knnGraph;
existingModel.knnFingerprints = new Map([...existingModel.knnFingerprints, ...knnFingerprints]);
existingModel.metadata.photoCount = (existingModel.metadata.photoCount || 0) + 1;
existingModel.metadata.lastEnhanced = new Date();

// 2.4 Создаем matchMap для визуализации
const { matchMap, modelMatchMap } = this.buildTriangleMatchMap(
    { matches: finalCascadeMatches },  // ← ЗАМЕНИТЬ!
    modelIdHint
);

// 🔥 СОХРАНЯЕМ modelMatchMap В МОДЕЛЬ
existingModel.lastTriangleResult = {
    ...(existingModel.lastTriangleResult || {}),
    modelMatchMap: modelMatchMap,
    matchMap: matchMap,
    globalConsistency: consistent.stats
};

console.log(`\n🔍 ОТЛАДКА: ${finalCascadeMatches.length} согласованных точек`);
console.log(`   • matchMap передан в визуализацию: ${matchMap.size} пар`);
console.log(`   • modelMatchMap сохранён в модель: ${modelMatchMap.size} пар`);

// 2.5 Очищаем неподтверждённые точки
const cleanResult = this.cleanUnconfirmedNodes(modelIdHint, 2, 3);
this.stats.totalNodesRemoved += cleanResult.removed;
this.stats.triangleMatchesCount += finalCascadeMatches.length;

// 2.6 Статистика
const confirmedInModel = finalCascadeMatches.length;
const onlyInModel = existingModel.graph.nodes.size - confirmedInModel;
const onlyInPhoto = exactGraph.nodes.size - confirmedInModel;

console.log(`\n📊 СТАТИСТИКА МОДЕЛИ:`);
console.log(`   • 🟠 Подтвержденных (2+ фото): ${confirmedInModel}`);
console.log(`   • 🔵 Только в модели: ${onlyInModel}`);
console.log(`   • 🔵 Только в новом фото: ${onlyInPhoto}`);
console.log(`   • Всего в модели теперь: ${existingModel.graph.nodes.size}`);

this.photoToModel.set(photoId, modelIdHint);

return {
    status: 'consistent_anchors',
    modelId: modelIdHint,
    similarity: triangleResult.similarity,
    centerMatches: finalCascadeMatches.length,
    totalMatches: finalCascadeMatches.length,
    newNodesAdded: updateResult.newNodesAdded,
    nodesRemoved: cleanResult.removed,
    matchMap: matchMap,
    modelMatchMap: modelMatchMap,
    consistency: consistent.stats,  // ← ИСПРАВЛЕНО! используем consistent
    message: `Глобально согласовано после достройки: ${finalCascadeMatches.length} точек`
};
    } else {
        console.log(`\n⚠️ Треугольное сравнение дало только ${triangleResult.count} пар - пропускаем`);
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
            result = triangleMatcher.findMatches(
                points1,
                points2,
                model1.graph,
                model2.graph
            );
        } catch (error) {
            console.log(`❌ Ошибка в triangleMatcher.findMatches:`, error.message);
            console.log(error.stack);
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
    extractPointsFromModel(model, source = 'A') {
    const points = [];
    const graph = model.graph;
    const morphologyMap = model.morphologyMap || new Map();
    let counter = 0;

    for (const [nodeId, node] of graph.nodes) {
        const morph = morphologyMap.get(nodeId) || {};
       
        // 🔥 СОЗДАЁМ УНИКАЛЬНЫЙ ID
        const uniqueId = `${nodeId}_${source}_${counter++}`;
       
        // 🔥 СОХРАНЯЕМ МАППИНГ
        if (source === 'A') {
            this.photoIdMapping.set(uniqueId, nodeId);
        } else {
            this.modelIdMapping.set(uniqueId, nodeId);
        }

        points.push({
            id: uniqueId,
            originalId: nodeId,  // сохраняем оригинал
            x: node.x,
            y: node.y,
            role: this.getNodeRoleSimple(nodeId, graph),
            degree: node.degree || 0,
            triangles: node.triangles || 0,

            // МОРФОЛОГИЯ
            compactness: morph.compactness || 0,
            eccentricity: morph.eccentricity || 0,
            normalizedArea: morph.normalizedArea || 1,
            radialProfile: morph.radialProfile || [0,0,0,0,0,0,0,0],
            orientation: morph.orientation || 0,
            asymmetry: morph.asymmetry || 0,

            // 🔥 КОНТУР
            contour: morph.contour || null,

            neighborRoles: this.getNeighborRolesForPoint(nodeId, graph)
        });
    }

    console.log(`📊 Извлечено ${points.length} точек из модели с морфологией`);
    return points;
}

    /**
     * Строит matchMap для визуализации
     */
buildTriangleMatchMap(result, targetModelId = null) {
    console.log(`\n🔍 buildTriangleMatchMap: начало`);
    console.log(`   • result.matches.length = ${result.matches?.length || 0}`);
    console.log(`   • Якорей (треугольников): ${result.anchors || 'не указано'}`);
   
    if (!result.matches || result.matches.length === 0) {
        console.log(`   ⚠️ Нет matches для построения map`);
        return { matchMap: new Map(), modelMatchMap: new Map() };
    }

    // ===== ШАГ 1: Сортируем все matches по убыванию уверенности =====
    console.log(`\n📋 ШАГ 1: Сортировка matches по уверенности`);
   
    const sortedMatches = [...result.matches].sort((a, b) => b.confidence - a.confidence);
   
    // Покажем первые 5 для отладки
    sortedMatches.slice(0, 5).forEach((m, i) => {
        console.log(`   ${i+1}. уверенность: ${(m.confidence*100).toFixed(1)}%`);
    });

    // ===== ШАГ 2: Строим максимальное непротиворечивое множество =====
    console.log(`\n📋 ШАГ 2: Построение максимального непротиворечивого множества`);
   
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
           
            if (added <= 10) { // покажем первые 10
                console.log(`   ✅ Добавлено: ${pointA.substring(0,12)} ↔ ${pointB.substring(0,12)} (уверенность: ${(match.confidence*100).toFixed(1)}%)`);
            }
        } else {
            skipped++;
            if (skipped <= 5) { // покажем первые 5 пропущенных
                console.log(`   ⚠️ Пропущено: ${pointA.substring(0,12)} ↔ ${pointB.substring(0,12)} (уверенность: ${(match.confidence*100).toFixed(1)}%)`);
                if (!aFree) console.log(`      • pointA уже соответствует ${pointCorrespondence.get(pointA).substring(0,12)}`);
                if (!bFree) console.log(`      • pointB уже соответствует ${reverseCorrespondence.get(pointB).substring(0,12)}`);
            }
        }
    }

    console.log(`\n📊 ИТОГ ПОСТРОЕНИЯ:`);
    console.log(`   • Добавлено уникальных соответствий: ${added}`);
    console.log(`   • Пропущено (конфликты): ${skipped}`);
    console.log(`   • Всего обработано matches: ${sortedMatches.length}`);

    // ===== ШАГ 3: Назначаем номера парам =====
    console.log(`\n📋 ШАГ 3: Назначение номеров парам`);
   
    const matchMap = new Map();
    const modelMatchMap = new Map();
    let pairNumber = 1;
   
    // Для назначения номеров используем тот же порядок, что и при добавлении
    // (он уже отсортирован по уверенности)
    for (const [pointA, pointB] of pointCorrespondence) {
    console.log(`   🔍 Назначение номера ${pairNumber}: ${pointA.substring(0,15)}... ↔ ${pointB.substring(0,15)}...`);
   
    matchMap.set(pointA, {  // ← используем pointA напрямую
        modelId: pointB,
        pairNumber: pairNumber,
        type: 'anchor',
        confidence: 1.0
    });

    modelMatchMap.set(pointB, {  // ← используем pointB напрямую
        photoId: pointA,
        pairNumber: pairNumber,
        type: 'anchor',
        confidence: 1.0
    });

    console.log(`   Пара ${pairNumber}: ${pointA.substring(0,12)} ↔ ${pointB.substring(0,12)}`);
    pairNumber++;
}

    // ===== ШАГ 4: Проверка целостности =====
    console.log(`\n📊 ИТОГ buildTriangleMatchMap:`);
    console.log(`   • matchMap size: ${matchMap.size}`);
    console.log(`   • modelMatchMap size: ${modelMatchMap.size}`);
    console.log(`   • Уникальных photo точек: ${pointCorrespondence.size}`);
    console.log(`   • Уникальных model точек: ${reverseCorrespondence.size}`);

    // Проверяем, сколько уникальных точек должно быть
    const uniquePhotoPoints = new Set(result.matches.map(m => m.pointA));
    const uniqueModelPoints = new Set(result.matches.map(m => m.pointB));
   
    console.log(`\n📊 СТАТИСТИКА ИСХОДНЫХ ДАННЫХ:`);
    console.log(`   • Уникальных photo точек в matches: ${uniquePhotoPoints.size}`);
    console.log(`   • Уникальных model точек в matches: ${uniqueModelPoints.size}`);
    console.log(`   • Покрытие photo точек: ${((pointCorrespondence.size / uniquePhotoPoints.size) * 100).toFixed(1)}%`);
    console.log(`   • Покрытие model точек: ${((reverseCorrespondence.size / uniqueModelPoints.size) * 100).toFixed(1)}%`);

    // ===== ШАГ 5: Сохраняем в модель =====
    const modelIdToUse = targetModelId || this.currentModelId;
    console.log(`\n💾 Сохранение в модель ${modelIdToUse?.substring(0,12)}:`);

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
       
        console.log(`   ✅ modelMatchMap сохранён (${modelMatchMap.size} записей)`);
        console.log(`   ✅ matchMap сохранён (${matchMap.size} записей)`);
        console.log(`   📊 Статистика сохранена в модели`);
       
    } else {
        console.log(`   ❌ Модель ${modelIdToUse?.substring(0,12)} не найдена!`);
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

    // ==================== ОСТАЛЬНЫЕ МЕТОДЫ ====================

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

        // 🔥 ПОЛУЧАЕМ modelMatchMap ИЗ МОДЕЛИ
        const modelMatchMapFromModel = model.lastTriangleResult?.modelMatchMap || new Map();
        console.log(`📋 getVisualizationData: modelMatchMap содержит ${modelMatchMapFromModel.size} записей`);

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
            modelMatchMap: modelMatchMapFromModel  // 🔥 ВАЖНО!
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

/**
* Проверяет глобальную согласованность всех найденных якорей
* @param {Array} anchors - массив якорей (треугольников)
* @param {Array} trianglesA - все треугольники из первого следа
* @param {Array} trianglesB - все треугольники из второго следа
* @param {Object} graphA - граф первого следа
* @param {Object} graphB - граф второго следа
* @returns {Object} - согласованные якоря и статистика
*/
checkGlobalConsistency(anchors, trianglesA, trianglesB, graphA, graphB) {
    console.log(`\n🔍 ГЛОБАЛЬНАЯ ПРОВЕРКА СОГЛАСОВАННОСТИ`);
    console.log(`   • Всего кандидатов: ${anchors.length} треугольников (${anchors.length * 3} точек)`);

      // 🔥 ДИАГНОСТИКА ВХОДНЫХ ДАННЫХ
console.log(`\n🔍 ДИАГНОСТИКА ПЕРВЫХ 5 ЯКОРЕЙ:`);
for (let i = 0; i < Math.min(5, anchors.length); i++) {
    const anchor = anchors[i];
    console.log(`   Якорь ${i}: aIndex=${anchor.aIndex}, bIndex=${anchor.bIndex}, geometryScore=${anchor.geometryScore?.toFixed(3)}`);
    if (anchor.points && anchor.points.length > 0) {
        anchor.points.forEach((p, j) => {
            console.log(`      point ${j}: ${p.pointA.substring(0,15)}... ↔ ${p.pointB.substring(0,15)}... (conf: ${p.confidence?.toFixed(3)})`);
        });
    } else {
        console.log(`      ⚠️ Нет точек в якоре`);
    }
}
      
    // ===== ШАГ 1: Собираем все уникальные соответствия точек =====
    const pointPairs = new Map(); // pointA -> { pointB, confidence }
    const reversePairs = new Map(); // pointB -> pointA
    let skippedAnchors = 0;

    for (const anchor of anchors) {
        // Для временных якорей (aIndex = -1) используем points
        if (anchor.aIndex === -1 || anchor.bIndex === -1) {
            // Восстанавливаем из points
            for (const point of anchor.points) {
                const pA = point.pointA;
                const pB = point.pointB;
               
                // Проверяем конфликты
                if (pointPairs.has(pA)) {
                    if (pointPairs.get(pA).pointB !== pB) {
                        console.log(`   ⚠️ Конфликт точки ${pA.substring(0,12)}: соответствует и ${pointPairs.get(pA).pointB.substring(0,12)} и ${pB.substring(0,12)}`);
                    }
                    continue;
                }

                if (reversePairs.has(pB)) {
                    console.log(`   ⚠️ Конфликт точки ${pB.substring(0,12)}: уже соответствует ${reversePairs.get(pB).substring(0,12)}`);
                    continue;
                }

                pointPairs.set(pA, {
                    pointB: pB,
                    confidence: point.confidence || anchor.geometryScore
                });
                reversePairs.set(pB, pA);
            }
        } else {
            // Для обычных якорей с индексами
            if (anchor.aIndex >= trianglesA.length || anchor.bIndex >= trianglesB.length) {
                console.log(`   ⚠️ Пропущен якорь с неверными индексами: aIndex=${anchor.aIndex}, bIndex=${anchor.bIndex}`);
                skippedAnchors++;
                continue;
            }
           
            const tA = trianglesA[anchor.aIndex];
            const tB = trianglesB[anchor.bIndex];
           
            if (!tA || !tB) {
                console.log(`   ⚠️ Пропущен якорь: треугольник не найден`);
                skippedAnchors++;
                continue;
            }

            const pointsA = [tA.p1.id, tA.p2.id, tA.p3.id];
            const pointsB = [tB.p1.id, tB.p2.id, tB.p3.id];

            for (let i = 0; i < 3; i++) {
                const pA = pointsA[i];
                const pB = pointsB[i];

                // Проверяем конфликты
                if (pointPairs.has(pA)) {
                    if (pointPairs.get(pA).pointB !== pB) {
                        console.log(`   ⚠️ Конфликт точки ${pA.substring(0,12)}: соответствует и ${pointPairs.get(pA).pointB.substring(0,12)} и ${pB.substring(0,12)}`);
                    }
                    continue;
                }

                if (reversePairs.has(pB)) {
                    console.log(`   ⚠️ Конфликт точки ${pB.substring(0,12)}: уже соответствует ${reversePairs.get(pB).substring(0,12)}`);
                    continue;
                }

                pointPairs.set(pA, {
                    pointB: pB,
                    confidence: anchor.geometryScore
                });
                reversePairs.set(pB, pA);
            }
        }
    }

    console.log(`\n📊 УНИКАЛЬНЫХ СООТВЕТСТВИЙ ТОЧЕК: ${pointPairs.size}`);
    if (skippedAnchors > 0) {
        console.log(`   • Пропущено якорей: ${skippedAnchors}`);
    }

    // ===== ШАГ 2: Анализируем распределение уверенностей =====
    const confidences = Array.from(pointPairs.values()).map(p => p.confidence);
    if (confidences.length === 0) {
        console.log(`\n⚠️ Нет соответствий для анализа`);
        return {
            anchors: [],
            points: [],
            stats: {
                original: anchors.length,
                final: 0,
                originalPoints: 0,
                finalPoints: 0,
                inconsistent: 0,
                lowConfidence: 0
            }
        };
    }

    confidences.sort((a, b) => b - a);

    console.log(`\n📈 РАСПРЕДЕЛЕНИЕ УВЕРЕННОСТЕЙ:`);
    console.log(`   • Максимальная: ${(confidences[0]*100).toFixed(1)}%`);
    console.log(`   • Минимальная: ${(confidences[confidences.length-1]*100).toFixed(1)}%`);
    console.log(`   • Медианная: ${(confidences[Math.floor(confidences.length/2)]*100).toFixed(1)}%`);

    // Находим естественный разрыв в уверенностях
    let threshold = 0.90; // по умолчанию
    for (let i = 1; i < confidences.length; i++) {
        if (confidences[i-1] - confidences[i] > 0.05) {
            threshold = confidences[i-1] - 0.01;
            console.log(`   • Естественный разрыв на ${(threshold*100).toFixed(1)}% (${i} точек выше, ${confidences.length-i} ниже)`);
            break;
        }
    }

    // ===== ШАГ 3: ТОПОЛОГИЧЕСКАЯ ПРОВЕРКА =====
    console.log(`\n🔍 ТОПОЛОГИЧЕСКАЯ ПРОВЕРКА:`);

    const consistentPoints = new Set();
    const inconsistentPoints = new Set();

    // Строим карту соответствий для быстрого доступа
    const pointMap = new Map();
    for (const [pA, data] of pointPairs) {
        pointMap.set(pA, data.pointB);
    }

    // Для каждой точки проверяем её соседей
    for (const [pA, data] of pointPairs) {
        const pB = data.pointB;

        // Находим соседей точки A в графе
        const neighborsA = this.findNodeNeighbors(pA, graphA);
        const neighborAnchorsA = neighborsA.filter(n => pointMap.has(n.id)).map(n => n.id);

        // Находим соседей точки B в графе
        const neighborsB = this.findNodeNeighbors(pB, graphB);
        const neighborAnchorsB = neighborsB.filter(n => reversePairs.has(n.id)).map(n => n.id);

        // Проверяем, что количество якорей-соседей совпадает
        if (neighborAnchorsA.length !== neighborAnchorsB.length) {
            console.log(`   ⚠️ Точка ${pA.substring(0,12)}: соседей-якорей ${neighborAnchorsA.length} vs ${neighborAnchorsB.length}`);
            inconsistentPoints.add(pA);
            continue;
        }

        // Проверяем, что соседи соответствуют друг другу
        let allMatch = true;
        for (const nA of neighborAnchorsA) {
            const nB = pointMap.get(nA);
            if (!neighborsB.some(n => n.id === nB)) {
                allMatch = false;
                break;
            }
        }

        if (allMatch) {
            consistentPoints.add(pA);
            if (consistentPoints.size <= 5) { // покажем первые 5
                console.log(`   ✅ Точка ${pA.substring(0,12)}: топология согласована`);
            }
        } else {
            console.log(`   ⚠️ Точка ${pA.substring(0,12)}: несоответствие соседей`);
            inconsistentPoints.add(pA);
        }
    }

    // ===== ШАГ 4: ФИЛЬТРАЦИЯ ПО УВЕРЕННОСТИ =====
    console.log(`\n🔍 ФИЛЬТРАЦИЯ ПО УВЕРЕННОСТИ (порог ${(threshold*100).toFixed(1)}%):`);

    const highConfidencePoints = [];
    const lowConfidencePoints = [];

    for (const [pA, data] of pointPairs) {
        if (data.confidence >= threshold) {
            highConfidencePoints.push(pA);
        } else {
            lowConfidencePoints.push(pA);
        }
    }

    console.log(`   • Высокая уверенность: ${highConfidencePoints.length} точек`);
    console.log(`   • Низкая уверенность: ${lowConfidencePoints.length} точек`);

    // ===== ШАГ 5: ФИНАЛЬНЫЙ ОТБОР =====
    console.log(`\n🎯 ФИНАЛЬНЫЙ ОТБОР СОГЛАСОВАННЫХ ТОЧЕК:`);

    const finalPoints = [];
    for (const pA of consistentPoints) {
        if (pointPairs.get(pA).confidence >= threshold) {
            finalPoints.push({
                pointA: pA,
                pointB: pointPairs.get(pA).pointB,
                confidence: pointPairs.get(pA).confidence
            });
        }
    }

    console.log(`   • Прошли все проверки: ${finalPoints.length} точек`);
    console.log(`   • Отсеяно топологией: ${inconsistentPoints.size} точек`);
    console.log(`   • Отсеяно по уверенности: ${lowConfidencePoints.length} точек`);

    // ===== ШАГ 6: ВОССТАНОВЛЕНИЕ ТРЕУГОЛЬНИКОВ ИЗ ТОЧЕК (ОПЦИОНАЛЬНО) =====
    // Для временных якорей мы не можем восстановить треугольники,
    // поэтому возвращаем только точки
    console.log(`\n📊 ИТОГ ГЛОБАЛЬНОЙ ПРОВЕРКИ:`);
    console.log(`   • Исходных якорей (треугольников): ${anchors.length}`);
    console.log(`   • Согласованных точек: ${finalPoints.length}`);

    return {
        anchors: [], // временно не восстанавливаем треугольники
        points: finalPoints,
        stats: {
            original: anchors.length,
            final: 0,
            originalPoints: pointPairs.size,
            finalPoints: finalPoints.length,
            inconsistent: inconsistentPoints.size,
            lowConfidence: lowConfidencePoints.length
        }
    };
}

/**
* Двухэтапная достройка точек на основе согласованных якорей
* @param {Array} anchors - согласованные якоря (точки) - 18 шт
* @param {Array} allMatches - все найденные matches (45 точек)
* @param {Object} graphA - граф первого следа
* @param {Object} graphB - граф второго следа
* @param {Map} morphologyMap - морфология точек первого следа
* @param {Map} modelMorphology - морфология точек модели
* @returns {Object} - достроенные соответствия с разделением по категориям
*/
twoStagePositioning(anchors, allMatches, graphA, graphB, morphologyMap, modelMorphology) {
    console.log(`\n🔧 ДВУХЭТАПНАЯ ДОСТРОЙКА ТОЧЕК`);
   
    // ===== ШАГ 1: Разделяем точки на категории =====
    console.log(`\n📊 РАЗДЕЛЕНИЕ ТОЧЕК ПО КАТЕГОРИЯМ:`);
   
    const anchorSet = new Set(anchors.map(a => a.pointA));
   
    const confusedPoints = []; // точки, которые есть в matches, но не в anchors
    for (const match of allMatches) {
        if (!anchorSet.has(match.pointA)) {
            confusedPoints.push(match);
        }
    }
   
    console.log(`   • Якорей (топология): ${anchors.length} точек`);
    console.log(`   • Путающихся кандидатов: ${confusedPoints.length} точек`);
   
    // ===== ШАГ 2: Строим карту якорей для быстрого доступа =====
    const anchorMap = new Map(); // pointA -> { pointB, confidence, x, y }
    for (const anchor of anchors) {
        const pointA = graphA.nodes.get(anchor.pointA);
        const pointB = graphB.nodes.get(anchor.pointB);
        anchorMap.set(anchor.pointA, {
            pointB: anchor.pointB,
            confidence: anchor.confidence,
            xA: pointA?.x,
            yA: pointA?.y,
            xB: pointB?.x,
            yB: pointB?.y
        });
    }
   
    // ===== ШАГ 3: УТОЧНЕНИЕ ПУТАЮЩИХСЯ ТОЧЕК (ГЕОМЕТРИЯ) =====
    console.log(`\n🔍 ЭТАП 1: УТОЧНЕНИЕ ПУТАЮЩИХСЯ ТОЧЕК (геометрия)`);
   
    const confirmedFromConfused = [];
    const stillConfused = [];
   
    for (const match of confusedPoints) {
        const pointA = match.pointA;
        const pointB = match.pointB;
       
        // Находим ближайшие якоря в пространстве (не в графе!)
        const neighborsA = this.findNearbyAnchors(pointA, graphA, anchorMap, 3);
        const neighborsB = this.findNearbyAnchors(pointB, graphB,
            new Map(Array.from(anchorMap.values()).map(a => [a.pointB, a])), 3);
       
        if (neighborsA.length < 2 || neighborsB.length < 2) {
            stillConfused.push(match);
            continue;
        }
       
        // Проверяем геометрические соотношения (инвариантно!)
        let consistent = true;
        const pairs = Math.min(neighborsA.length, neighborsB.length, 3);
       
        for (let i = 0; i < pairs; i++) {
            const [distAToAnchor, anchorA] = neighborsA[i];
            const [distBToAnchor, anchorB] = neighborsB[i];
           
            // Отношение расстояний должно сохраняться
            const ratioA = distAToAnchor / this.getAvgDistance(pointA, neighborsA);
            const ratioB = distBToAnchor / this.getAvgDistance(pointB, neighborsB);
           
            if (Math.abs(ratioA - ratioB) > 0.2) { // 20% допуск
                consistent = false;
                break;
            }
        }
       
        if (consistent) {
            confirmedFromConfused.push({
                pointA: pointA,
                pointB: pointB,
                confidence: match.confidence * 0.95 // чуть снижаем уверенность
            });
            console.log(`   ✅ Уточнена: ${pointA.substring(0,12)} ↔ ${pointB.substring(0,12)}`);
        } else {
            stillConfused.push(match);
        }
    }
   
    console.log(`\n📊 ИТОГ ЭТАПА 1:`);
    console.log(`   • Уточнено геометрией: ${confirmedFromConfused.length} точек`);
    console.log(`   • Осталось путающихся: ${stillConfused.length} точек`);
   
    // ===== ШАГ 4: ПОДГОТОВКА ЯКОРЕЙ ДЛЯ ДОСТРОЙКИ =====
    const allConfirmed = [...anchors, ...confirmedFromConfused];
    console.log(`\n🔧 Всего подтвержденных точек для достройки: ${allConfirmed.length}`);
   
    // Создаем карту подтвержденных соответствий
    const confirmedMap = new Map();
    for (const point of allConfirmed) {
        confirmedMap.set(point.pointA, point.pointB);
    }
   
    // ===== ШАГ 5: ДОСТРОЙКА НОВЫХ ТОЧЕК (ТОЛЬКО ГЕОМЕТРИЯ) =====
    console.log(`\n🔍 ЭТАП 2: ДОСТРОЙКА НОВЫХ ТОЧЕК (геометрия)`);
   
    // Находим все точки, которые есть только в первом следе
    const allPointsInA = Array.from(graphA.nodes.keys());
    const pointsToPosition = allPointsInA.filter(p => !confirmedMap.has(p));
   
    console.log(`   • Точек для достройки: ${pointsToPosition.length}`);
   
    const positionedMatches = [];
   
    for (const pointA of pointsToPosition) {
        const nodeA = graphA.nodes.get(pointA);
        if (!nodeA) continue;
       
        // Находим ближайшие якоря в пространстве
        const nearbyAnchors = this.findNearbyAnchors(pointA, graphA, anchorMap, 3);
       
        if (nearbyAnchors.length < 2) continue;
       
        // Интерполируем положение точки B
        const candidates = new Map(); // pointB -> score
       
        for (const [distToAnchor, anchorA] of nearbyAnchors) {
            const anchorData = anchorMap.get(anchorA);
            if (!anchorData) continue;
           
            const pointB = anchorData.pointB;
            const nodeB = graphB.nodes.get(pointB);
            if (!nodeB) continue;
           
            // Предполагаемое положение точки B
            const ratio = distToAnchor / this.getAvgDistance(pointA, nearbyAnchors);
            const estimatedX = nodeB.x * ratio;
            const estimatedY = nodeB.y * ratio;
           
            // Ищем реальные точки B рядом с предполагаемым положением
            for (const [bId, bNode] of graphB.nodes) {
                if (confirmedMap.has(bId)) continue;
               
                const dx = bNode.x - estimatedX;
                const dy = bNode.y - estimatedY;
                const dist = Math.sqrt(dx*dx + dy*dy);
               
                if (dist < 20) { // порог 20 пикселей
                    const score = 1 - (dist / 20);
                    if (!candidates.has(bId) || candidates.get(bId) < score) {
                        candidates.set(bId, score);
                    }
                }
            }
        }
       
        // Выбираем лучшего кандидата
        let bestB = null;
        let bestScore = 0;
        for (const [bId, score] of candidates) {
            if (score > bestScore && score > 0.5) {
                bestScore = score;
                bestB = bId;
            }
        }
       
        if (bestB) {
            positionedMatches.push({
                pointA: pointA,
                pointB: bestB,
                confidence: bestScore
            });
        }
    }
   
    console.log(`\n📊 ИТОГ ЭТАПА 2:`);
    console.log(`   • Достроено геометрией: ${positionedMatches.length} точек`);
   
    // ===== ШАГ 6: ФОРМИРУЕМ ФИНАЛЬНЫЙ РЕЗУЛЬТАТ =====
    const finalMatches = [...allConfirmed, ...positionedMatches];
   
    console.log(`\n🎯 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ:`);
    console.log(`   • Якорей (топология): ${anchors.length}`);
    console.log(`   • Уточнено геометрией: ${confirmedFromConfused.length}`);
    console.log(`   • Достроено геометрией: ${positionedMatches.length}`);
    console.log(`   • ВСЕГО: ${finalMatches.length} точек`);
   
    return {
        all: finalMatches,
        anchors: allConfirmed,      // топологически подтверждённые (42)
        new: positionedMatches       // только геометрией (23)
    };
}

/**
* Находит ближайшие якоря к точке в пространстве
*/
findNearbyAnchors(pointId, graph, anchorMap, count = 3) {
    const node = graph.nodes.get(pointId);
    if (!node) return [];
   
    const distances = [];
    for (const [anchorId, anchorData] of anchorMap) {
        const anchorNode = graph.nodes.get(anchorId);
        if (!anchorNode) continue;
       
        const dx = node.x - anchorNode.x;
        const dy = node.y - anchorNode.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
       
        distances.push([dist, anchorId]);
    }
   
    return distances.sort((a, b) => a[0] - b[0]).slice(0, count);
}

/**
* Вычисляет среднее расстояние до ближайших якорей
*/
getAvgDistance(pointId, nearbyAnchors) {
    if (nearbyAnchors.length === 0) return 1;
    const sum = nearbyAnchors.reduce((acc, [dist]) => acc + dist, 0);
    return sum / nearbyAnchors.length;
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
                   
                    triangles.push({
                        p1: graph.nodes.get(a),
                        p2: graph.nodes.get(b),
                        p3: graph.nodes.get(c)
                    });
                }
            }
        }
    }
   
    return triangles;
}

/**
* Анализирует разницу между полной и временной топологией
* @param {Array} anchors - массив якорей {pointA, pointB, confidence}
* @param {Object} graphA - граф первого следа
* @param {Object} graphB - граф второго следа
* @returns {Object} - информация о точках для поиска
*/
analyzeTemporalTopology(anchors, graphA, graphB) {
    console.log(`\n🔍 АНАЛИЗ ВРЕМЕННОЙ ТОПОЛОГИИ`);
   
    const anchorSetA = new Set(anchors.map(a => a.pointA));
    const anchorSetB = new Set(anchors.map(a => a.pointB));
   
    const results = {
        missingInA: [],      // точки есть в B, но нет в A
        missingInB: [],      // точки есть в A, но нет в B
        extraInA: [],        // лишние связи в A
        extraInB: []         // лишние связи в B
    };
   
    // Анализируем каждую якорную точку
    for (const anchor of anchors) {
        const pointA = anchor.pointA;
        const pointB = anchor.pointB;
       
        // Полная степень из графа
        const neighborsA = this.findNodeNeighbors(pointA, graphA);
        const neighborsB = this.findNodeNeighbors(pointB, graphB);
       
        const fullDegreeA = neighborsA.length;
        const fullDegreeB = neighborsB.length;
       
        // Временная степень (только среди якорей)
        const tempDegreeA = neighborsA.filter(n => anchorSetA.has(n.id)).length;
        const tempDegreeB = neighborsB.filter(n => anchorSetB.has(n.id)).length;
       
        console.log(`\n   Точка ${pointA.substring(0,12)}:`);
        console.log(`      A: полная=${fullDegreeA}, временная=${tempDegreeA}`);
        console.log(`      B: полная=${fullDegreeB}, временная=${tempDegreeB}`);
       
        // Анализируем разницу
        if (fullDegreeA === fullDegreeB) {
            if (tempDegreeA < fullDegreeA && tempDegreeB < fullDegreeB) {
                // В обоих следах не хватает точек - ищем в обоих
                const missingCount = fullDegreeA - tempDegreeA;
                console.log(`      ✅ Совпадает: не хватает ${missingCount} точек в обоих следах`);
               
                // Находим недостающие точки
                const missingInA = neighborsA.filter(n => !anchorSetA.has(n.id));
                const missingInB = neighborsB.filter(n => !anchorSetB.has(n.id));
               
                results.missingInA.push(...missingInA.map(n => ({
                    pointId: n.id,
                    anchorPoint: pointA,
                    expectedIn: 'both'
                })));
               
                results.missingInB.push(...missingInB.map(n => ({
                    pointId: n.id,
                    anchorPoint: pointB,
                    expectedIn: 'both'
                })));
            }
        } else if (fullDegreeA > fullDegreeB) {
            if (tempDegreeA > tempDegreeB) {
                // В A больше связей с якорями - лишние точки в A
                const extra = fullDegreeA - fullDegreeB;
                console.log(`      ⚠️ Различается: в A на ${extra} точек больше`);
               
                const extraInA = neighborsA.filter(n => !anchorSetA.has(n.id));
                results.extraInA.push(...extraInA.map(n => ({
                    pointId: n.id,
                    anchorPoint: pointA,
                    expectedIn: 'A_only'
                })));
            }
        } else if (fullDegreeA < fullDegreeB) {
            if (tempDegreeA < tempDegreeB) {
                // В B больше связей с якорями - лишние точки в B
                const extra = fullDegreeB - fullDegreeA;
                console.log(`      ⚠️ Различается: в B на ${extra} точек больше`);
               
                const extraInB = neighborsB.filter(n => !anchorSetB.has(n.id));
                results.extraInB.push(...extraInB.map(n => ({
                    pointId: n.id,
                    anchorPoint: pointB,
                    expectedIn: 'B_only'
                })));
            }
        }
    }
   
    console.log(`\n📊 ИТОГ АНАЛИЗА:`);
    console.log(`   • Ищем в A: ${results.missingInA.length} точек`);
    console.log(`   • Ищем в B: ${results.missingInB.length} точек`);
    console.log(`   • Лишних в A: ${results.extraInA.length}`);
    console.log(`   • Лишних в B: ${results.extraInB.length}`);
   
    return results;
}

/**
* Находит треугольник по общему ребру
* @param {string} point1 - первая вершина ребра
* @param {string} point2 - вторая вершина ребра
* @param {Object} graph - граф
* @returns {Object|null} - информация о треугольнике {thirdPoint, triangle}
*/
findTriangleByEdge(point1, point2, graph) {
    // Ищем все треугольники, содержащие это ребро
    const triangles = [];
   
    for (const [nodeId, node] of graph.nodes) {
        if (nodeId === point1 || nodeId === point2) continue;
       
        // Проверяем, образует ли node треугольник с point1 и point2
        if (this.areConnected(point1, nodeId, graph) &&
            this.areConnected(point2, nodeId, graph)) {
           
            // Нашли треугольник
            const p1 = graph.nodes.get(point1);
            const p2 = graph.nodes.get(point2);
            const p3 = graph.nodes.get(nodeId);
           
            triangles.push({
                thirdPoint: nodeId,
                triangle: { p1, p2, p3 }
            });
        }
    }
   
    // Возвращаем первый найденный (в триангуляции Делоне у ребра не больше 2 треугольников)
    return triangles.length > 0 ? triangles[0] : null;
}

/**
* Вычисляет трансформацию между двумя треугольниками
* @param {Object} t1 - треугольник в первом следе {p1,p2,p3}
* @param {Object} t2 - треугольник во втором следе {p1,p2,p3}
* @returns {Object} - отношения сторон для трансформации
*/
calculateTriangleTransform(t1, t2) {
    // Вычисляем длины сторон в первом треугольнике
    const sides1 = [
        this.calcDistance(t1.p1, t1.p2),
        this.calcDistance(t1.p2, t1.p3),
        this.calcDistance(t1.p3, t1.p1)
    ];
   
    // Вычисляем длины сторон во втором треугольнике
    const sides2 = [
        this.calcDistance(t2.p1, t2.p2),
        this.calcDistance(t2.p2, t2.p3),
        this.calcDistance(t2.p3, t2.p1)
    ];
   
    // Вычисляем отношения для каждой стороны
    const ratios = [];
    for (let i = 0; i < 3; i++) {
        ratios.push(sides2[i] / sides1[i]);
    }
   
    // Усредняем отношение (должно быть одинаково для всех сторон)
    const scale = ratios.reduce((a, b) => a + b, 0) / 3;
   
    return {
        scale,
        sides1,
        sides2,
        ratios
    };
}  
  
/**
* Прогнозирует положение точки в B по её положению в A
* @param {Object} pointA - точка в A {id, x, y}
* @param {Object} triangleA - опорный треугольник в A {p1,p2,p3}
* @param {Object} triangleB - опорный треугольник в B {p1,p2,p3}
* @returns {Object} - прогнозируемые координаты {x, y}
*/
predictPointPosition(pointA, triangleA, triangleB) {
    // Используем барицентрические координаты
    // Точка pointA выражается через вершины triangleA:
    // pointA = α*tA.p1 + β*tA.p2 + γ*tA.p3, где α+β+γ=1
   
    // Вычисляем барицентрические координаты
    const v0 = {
        x: triangleA.p2.x - triangleA.p1.x,
        y: triangleA.p2.y - triangleA.p1.y
    };
    const v1 = {
        x: triangleA.p3.x - triangleA.p1.x,
        y: triangleA.p3.y - triangleA.p1.y
    };
    const v2 = {
        x: pointA.x - triangleA.p1.x,
        y: pointA.y - triangleA.p1.y
    };
   
    const dot00 = v0.x * v0.x + v0.y * v0.y;
    const dot01 = v0.x * v1.x + v0.y * v1.y;
    const dot02 = v0.x * v2.x + v0.y * v2.y;
    const dot11 = v1.x * v1.x + v1.y * v1.y;
    const dot12 = v1.x * v2.x + v1.y * v2.y;
   
    const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
    const beta = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const gamma = (dot00 * dot12 - dot01 * dot02) * invDenom;
    const alpha = 1 - beta - gamma;
   
    // Применяем те же координаты к triangleB
    const x = alpha * triangleB.p1.x + beta * triangleB.p2.x + gamma * triangleB.p3.x;
    const y = alpha * triangleB.p1.y + beta * triangleB.p2.y + gamma * triangleB.p3.y;
   
    return { x, y };
}

/**
* Каскадная достройка точек через общие рёбра
* @param {Array} anchors - начальные якоря
* @param {Object} graphA - граф первого следа
* @param {Object} graphB - граф второго следа
* @returns {Object} - новые якоря и статистика
*/
cascadePositioning(anchors, graphA, graphB) {
    console.log(`\n🔧 КАСКАДНАЯ ДОСТРОЙКА ЧЕРЕЗ ОБЩИЕ РЁБРА`);
   
    let currentAnchors = [...anchors];
    const anchorMapA = new Map(currentAnchors.map(a => [a.pointA, a]));
    const anchorMapB = new Map(currentAnchors.map(a => [a.pointB, a]));
   
    const processedEdges = new Set();
    const newAnchors = [];
    let iteration = 0;
    let found;
   
    do {
        found = false;
        iteration++;
        console.log(`\n📌 ИТЕРАЦИЯ ${iteration}:`);
       
        // Проходим по всем текущим якорям
        for (const anchor of currentAnchors) {
            const pointA = anchor.pointA;
            const pointB = anchor.pointB;
           
            // Находим все рёбра, инцидентные pointA
            const neighborsA = this.findNodeNeighbors(pointA, graphA);
           
            for (const neighbor of neighborsA) {
                const edgeKey = [pointA, neighbor.id].sort().join('--');
               
                // Пропускаем уже обработанные рёбра
                if (processedEdges.has(edgeKey)) continue;
                processedEdges.add(edgeKey);
               
                // Ищем треугольник за этим ребром в A
                const triangleInA = this.findTriangleByEdge(pointA, neighbor.id, graphA);
                if (!triangleInA) continue;
               
                const thirdA = triangleInA.thirdPoint;
               
                // Если третья точка уже якорь, пропускаем
                if (anchorMapA.has(thirdA)) continue;
               
                console.log(`\n   🔍 Ребро ${pointA.substring(0,8)}-${neighbor.id.substring(0,8)}`);
                console.log(`      Треугольник в A: ${pointA.substring(0,8)}, ${neighbor.id.substring(0,8)}, ${thirdA.substring(0,8)}`);
               
                // Проверяем, есть ли такое же ребро в B
                if (!anchorMapB.has(pointB)) continue;
               
                // Ищем треугольник за этим ребром в B
                const triangleInB = this.findTriangleByEdge(pointB, anchorMapB.get(pointB)?.pointB, graphB);
                if (!triangleInB) continue;
               
                const thirdB = triangleInB.thirdPoint;
               
                // Вычисляем трансформацию между якорными треугольниками
                // Нам нужен опорный треугольник, содержащий это ребро
                // Ищем любой якорный треугольник с этим ребром
const anchorTriangle = this.findAnchorTriangleWithEdge(
    pointA, neighbor.id, currentAnchors, graphA, graphB  // ← добавили graphB
);
               
                if (anchorTriangle) {
    // ПОЛУЧАЕМ ТОЧКИ С ПРОВЕРКОЙ
    const point3A = graphA.nodes.get(thirdA);
    if (!point3A) {
        console.log(`      ⚠️ Точка ${thirdA.substring(0,8)} не найдена в графе A`);
        continue;
    }
   
    // Проверяем, что треугольники существуют
    if (!anchorTriangle.triangleA || !anchorTriangle.triangleB) {
        console.log(`      ⚠️ Опорный треугольник не полный`);
        continue;
    }
   
    // Проверяем, что все вершины треугольника A есть в графе
    const tA = anchorTriangle.triangleA;
    if (!tA.p1 || !tA.p2 || !tA.p3) {
        console.log(`      ⚠️ Вершины треугольника A не определены`);
        continue;
    }
   
    // Проверяем, что все вершины треугольника B есть в графе
    const tB = anchorTriangle.triangleB;
    if (!tB.p1 || !tB.p2 || !tB.p3) {
        console.log(`      ⚠️ Вершины треугольника B не определены`);
        continue;
    }
   
    // Прогнозируем положение thirdB
    const predicted = this.predictPointPosition(
        point3A,
        tA,
        tB
    );
                   
                    // Ищем реальную точку рядом с прогнозом
                    const candidates = [];
                    for (const [bId, bNode] of graphB.nodes) {
                        if (anchorMapB.has(bId)) continue;
                       
                        const dx = bNode.x - predicted.x;
                        const dy = bNode.y - predicted.y;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                       
                        if (dist < 20) { // порог 20 пикселей
                            candidates.push({ id: bId, dist });
                        }
                    }
                   
                    if (candidates.length === 1) {
                        // Однозначно нашли
                        console.log(`      ✅ Найдена точка ${candidates[0].id.substring(0,8)}`);
                       
                        const newAnchor = {
                            pointA: thirdA,
                            pointB: candidates[0].id,
                            confidence: anchor.confidence * 0.95
                        };
                       
                        newAnchors.push(newAnchor);
                        anchorMapA.set(thirdA, newAnchor);
                        anchorMapB.set(candidates[0].id, newAnchor);
                        found = true;
                       
                    } else if (candidates.length > 1) {
                        // Несколько кандидатов - нужна доп. проверка
                        console.log(`      ⚠️ Несколько кандидатов: ${candidates.length}`);
                    }
                }
            }
        }
       
        // Добавляем новые якоря к текущим для следующих итераций
        if (newAnchors.length > 0) {
            currentAnchors = [...currentAnchors, ...newAnchors];
            console.log(`   → Добавлено ${newAnchors.length} новых якорей`);
        }
       
    } while (found && iteration < 5); // максимум 5 итераций
   
    console.log(`\n📊 ИТОГ КАСКАДНОЙ ДОСТРОЙКИ:`);
    console.log(`   • Было якорей: ${anchors.length}`);
    console.log(`   • Стало якорей: ${currentAnchors.length}`);
    console.log(`   • Добавлено: ${currentAnchors.length - anchors.length}`);
   
    return {
        anchors: currentAnchors,
        added: currentAnchors.length - anchors.length
    };
}

/**
* Находит якорный треугольник, содержащий заданное ребро
*/
findAnchorTriangleWithEdge(point1, point2, anchors, graphA, graphB) {
    const point1Anchor = anchors.find(a => a.pointA === point1);
    const point2Anchor = anchors.find(a => a.pointA === point2);
   
    if (!point1Anchor || !point2Anchor) return null;
   
    // Получаем все треугольники в графе B
    const trianglesB = this.extractTrianglesFromGraph(graphB);
   
    // Ищем треугольник в A, содержащий point1 и point2
    for (const anchor of anchors) {
        if (anchor.pointA === point1 || anchor.pointA === point2) continue;
       
        if (this.areConnected(point1, anchor.pointA, graphA) &&
            this.areConnected(point2, anchor.pointA, graphA)) {
           
            // Нашли треугольник в A, теперь ищем соответствующий в B
            const p3A = anchor.pointA;
            const p1B = point1Anchor.pointB;
            const p2B = point2Anchor.pointB;
            const p3B = anchor.pointB;
           
            // Проверяем, есть ли такой треугольник в B
            const triangleExists = trianglesB.some(t => {
                const ids = [t.p1.id, t.p2.id, t.p3.id].sort();
                const expected = [p1B, p2B, p3B].sort();
                return ids[0] === expected[0] &&
                       ids[1] === expected[1] &&
                       ids[2] === expected[2];
            });
           
            if (!triangleExists) {
                console.log(`      ⚠️ Треугольник (${p1B.substring(0,8)},${p2B.substring(0,8)},${p3B.substring(0,8)}) не найден в B`);
                return null;
            }
           
            return {
                triangleA: {
                    p1: graphA.nodes.get(point1),
                    p2: graphA.nodes.get(point2),
                    p3: graphA.nodes.get(p3A)
                },
                triangleB: {
                    p1: graphB.nodes.get(p1B),
                    p2: graphB.nodes.get(p2B),
                    p3: graphB.nodes.get(p3B)
                }
            };
        }
    }
   
    return null;
}

/**
* Проверяет, соединены ли две точки в графе
*/
areConnected(id1, id2, graph) {
    const edgeId = [id1, id2].sort().join('--');
    return graph.edges.has(edgeId);
}

/**
* Вычисляет расстояние между двумя точками
*/
calcDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx*dx + dy*dy);
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
