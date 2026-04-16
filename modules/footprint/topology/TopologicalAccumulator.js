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
            console.log(`\n✅ НАЙДЕНА МОДЕЛЬ, запускаю треугольный матчер...`);

            const existingModel = this.models.get(modelIdHint);

            // Создаем временную модель из нового фото
            const tempModel = {
                graph: exactGraph,
                morphologyMap: morphologyMap,
                metadata: { name: 'temp' }
            };

            if (this.debug) console.log(`\n🔍 ТРЕУГОЛЬНОЕ СРАВНЕНИЕ с моделью ${modelIdHint.slice(0,12)}...`);
            const triangleResult = await this.compareByTriangleMatching(tempModel, existingModel);

            // 🔥 ВРЕМЕННО: срабатывает даже с 1 точкой
            if (triangleResult.count >= 1) {
                console.log(`\n✅ Найдено ${triangleResult.count} треугольных соответствий!`);

                // ===== ШАГ 1: СОЗДАЁМ ВРЕМЕННЫЕ ЯКОРЯ ИЗ MATCHES =====
                if (this.debug) console.log(`\n🔍 СОЗДАНИЕ ВРЕМЕННЫХ ЯКОРЕЙ ДЛЯ ГЛОБАЛЬНОЙ ПРОВЕРКИ`);

                // Так как все ID одинаковые, группируем просто по порядку (каждые 3 точки)
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

                if (this.debug) console.log(`   • Создано временных якорей: ${tempAnchors.length}`);

                // Получаем треугольники из графов (ПЕРЕД проверкой!)
                if (this.debug) console.log(`\n🔍 ИЗВЛЕЧЕНИЕ ТРЕУГОЛЬНИКОВ ИЗ ГРАФОВ`);
                const trianglesA = this.extractTrianglesFromGraph(exactGraph);
                const trianglesB = this.extractTrianglesFromGraph(existingModel.graph);

                if (this.debug) {
                    console.log(`   • Треугольников в A: ${trianglesA.length}`);
                    console.log(`   • Треугольников в B: ${trianglesB.length}`);
                }

                // ===== ШАГ 2: ГЛОБАЛЬНАЯ ПРОВЕРКА =====
                if (this.debug) console.log(`\n🔍 ЗАПУСК ГЛОБАЛЬНОЙ ПРОВЕРКИ СОГЛАСОВАННОСТИ`);

                const consistent = this.checkGlobalConsistency(
                    tempAnchors,
                    trianglesA,
                    trianglesB,
                    exactGraph,
                    existingModel.graph
                );

                // ===== ШАГ 3: ДВУХЭТАПНАЯ ДОСТРОЙКА =====
                const finalMatches = this.twoStagePositioning(
                    consistent.points,
                    triangleResult.matches,
                    exactGraph,
                    existingModel.graph,
                    morphologyMap,
                    existingModel.morphologyMap
                );

                if (this.debug) {
                    console.log(`\n📊 РЕЗУЛЬТАТ ДОСТРОЙКИ:`);
                    console.log(`   • Было matches: ${triangleResult.matches.length}`);
                    console.log(`   • Стало matches: ${finalMatches.length}`);
                }

                // ===== ШАГ 3.5: ПАРАЛЛЕЛЬНАЯ ВАЛИДАЦИЯ =====
                console.log(`\n🔄 ЗАПУСК ПАРАЛЛЕЛЬНОЙ ВАЛИДАЦИИ`);

                const ValidationModule = require('../validation/ValidationModule');
                const validator = new ValidationModule({
                    debug: this.debug,
                    positionThreshold: 0.15,
                    morphologyThreshold: 0.85
                });

                // 🔥 ИСПРАВЛЕНИЕ: Используем ТОЛЬКО согласованные якоря для вычисления transform
                let anchorsForValidation = [];

// Пытаемся получить треугольники из triangleResult
if (triangleResult && triangleResult.triangles && triangleResult.triangles.length > 0) {
    console.log(`\n🔍 ИСПОЛЬЗУЮ ТРЕУГОЛЬНИКИ ИЗ MATCHER (${triangleResult.triangles.length} шт)`);
   
    for (const tri of triangleResult.triangles) {
        // Проверяем, что у треугольника есть соответствия
        if (tri.pB1 && tri.pB2 && tri.pB3) {
            anchorsForValidation.push({
                pointA: tri.p1.id,
                pointB: tri.pB1.id,
                confidence: tri.confidence || 0.9,
                triangleId: tri.id
            });
            anchorsForValidation.push({
                pointA: tri.p2.id,
                pointB: tri.pB2.id,
                confidence: tri.confidence || 0.9,
                triangleId: tri.id
            });
            anchorsForValidation.push({
                pointA: tri.p3.id,
                pointB: tri.pB3.id,
                confidence: tri.confidence || 0.9,
                triangleId: tri.id
            });
        }
    }
   
    if (anchorsForValidation.length > 0) {
        console.log(`   ✅ Создано ${anchorsForValidation.length} якорей из ${anchorsForValidation.length/3} треугольников`);
    }
}

// Если не получилось — используем consistent.points
if (anchorsForValidation.length === 0) {
    console.log(`   ⚠️ Нет треугольников, использую consistent.points`);
    anchorsForValidation = consistent.points.map(p => ({
        pointA: p.pointA,
        pointB: p.pointB,
        confidence: p.confidence
    }));
}

                if (this.debug) console.log(`\n🔍 ЭТАП 1: Вычисление базового transform по ${anchorsForValidation.length} надёжным якорям`);

                // Сначала вычисляем transform по надёжным якорям
                const baseTransform = validator.calculateTransform(
                    anchorsForValidation,
                    exactGraph,
                    existingModel.graph
                );

                if (!baseTransform) {
                    console.log(`❌ Не удалось вычислить базовый transform`);
                    return {
                        status: 'transform_failed',
                        modelId: modelIdHint,
                        similarity: triangleResult?.similarity || 0,
                        message: 'Не удалось вычислить transform по якорям'
                    };
                }

                if (this.debug) {
                    console.log(`\n📐 БАЗОВЫЙ TRANSFORM (${anchorsForValidation.length} якорей):`);
                    console.log(`   • Масштаб: ${baseTransform.scale.toFixed(3)}`);
                    console.log(`   • Поворот: ${(baseTransform.rotation * 180 / Math.PI).toFixed(1)}°`);
                    console.log(`   • Сдвиг: (${baseTransform.translation.x.toFixed(1)}, ${baseTransform.translation.y.toFixed(1)})`);
                }

              // 🔥 ЭТАП 2: Построение топологических структур (НОВЫЙ ПОДХОД)
console.log(`\n🔍 ЭТАП 2: Построение топологических структур из ${anchorsForValidation.length} якорей`);

// Создаём менеджер структур
const structureManager = new StructureManager(validator, {
    debug: this.debug,
    minConfidence: 0.7,
    maxScaleDeviation: 0.1,
    maxRotationDeviation: 5
});

// 🔥 ПОЛУЧАЕМ ВСЕ ТРЕУГОЛЬНИКИ ИЗ ГРАФА
const allGraphTriangles = this.extractTrianglesFromGraph(exactGraph);
console.log(`\n🔍 СОЗДАЮ ТРЕУГОЛЬНИКИ ИЗ ${anchorsForValidation.length} ЯКОРЕЙ`);
console.log(`   • Всего треугольников в графе: ${allGraphTriangles.length}`);
console.log(`   • triangleResult.triangles: ${triangleResult.triangles?.length || 0} треугольников`);

// Проверяем, есть ли externalPoint в исходных треугольниках
if (triangleResult.triangles && triangleResult.triangles.length > 0) {
    let trianglesWithExternal = 0;
    let edgesWithExternal = 0;
    for (const tri of triangleResult.triangles) {
        if (tri.edges) {
            for (const e of tri.edges) {
                if (e.externalPoint) edgesWithExternal++;
            }
            if (tri.edges.some(e => e.externalPoint)) trianglesWithExternal++;
        }
    }
    console.log(`   • В triangleResult: ${trianglesWithExternal}/${triangleResult.triangles.length} треугольников с лучами, ${edgesWithExternal} рёбер с externalPoint`);
}

// 🔥 ГРУППИРУЕМ ЯКОРЯ ПО triangleId
const anchorsByTriangle = new Map();

for (const anchor of anchorsForValidation) {
    const triId = anchor.triangleId;
    if (!triId) {
        if (this.debug) console.log(`   ⚠️ Якорь без triangleId: ${anchor.pointA}`);
        continue;
    }

    if (!anchorsByTriangle.has(triId)) {
        anchorsByTriangle.set(triId, []);
    }
    anchorsByTriangle.get(triId).push(anchor);
}

console.log(`   • Найдено уникальных треугольников-якорей: ${anchorsByTriangle.size}`);

// 🔥 СОЗДАЁМ МАПУ ЯКОРНЫХ ТРЕУГОЛЬНИКОВ (только те, у которых есть 3 якоря)
const anchorTrianglesMap = new Map();      // якорные треугольники (24 шт)
const anchorTriangleIds = new Set();       // ID якорных треугольников

for (const [triId, anchors] of anchorsByTriangle) {
    if (anchors.length !== 3) continue;

    // Находим оригинальный треугольник из triangleResult
    const originalTriangle = triangleResult.triangles?.find(t => t.id === triId);

    const a1 = anchors[0];
    const a2 = anchors[1];
    const a3 = anchors[2];

    const p1 = exactGraph.nodes.get(a1.pointA);
    const p2 = exactGraph.nodes.get(a2.pointA);
    const p3 = exactGraph.nodes.get(a3.pointA);

    const pB1 = existingModel.graph.nodes.get(a1.pointB);
    const pB2 = existingModel.graph.nodes.get(a2.pointB);
    const pB3 = existingModel.graph.nodes.get(a3.pointB);

    if (p1.id === p2.id || p1.id === p3.id || p2.id === p3.id) continue;

    // Создаём рёбра с сохранением externalPoint
    const edges = [];
    if (originalTriangle && originalTriangle.edges) {
        for (let i = 0; i < originalTriangle.edges.length; i++) {
            const origEdge = originalTriangle.edges[i];
            edges.push({
                v1: [p1, p2, p3][i],
                v2: [p1, p2, p3][(i+1) % 3],
                neighborTriangles: [],
                externalPoint: origEdge.externalPoint || null
            });
        }
    } else {
        edges = [
            { v1: p1, v2: p2, neighborTriangles: [], externalPoint: null },
            { v1: p2, v2: p3, neighborTriangles: [], externalPoint: null },
            { v1: p3, v2: p1, neighborTriangles: [], externalPoint: null }
        ];
    }

    // Сохраняем якорный треугольник
    const anchorTriangle = {
        id: triId,
        p1, p2, p3,
        pB1, pB2, pB3,
        confidence: (a1.confidence + a2.confidence + a3.confidence) / 3,
        edges: edges
    };
   
    anchorTrianglesMap.set(triId, anchorTriangle);
    anchorTriangleIds.add(triId);
}

console.log(`   • Создано якорных треугольников: ${anchorTrianglesMap.size}`);

// 🔥 СОЗДАЁМ МАПУ ТРЕУГОЛЬНИКОВ-КАНДИДАТОВ (все остальные, без якорей)
// Это треугольники, которые НЕ входят в якорные, но могут быть присоединены геометрически
const candidateTriangles = allGraphTriangles.filter(t => !anchorTriangleIds.has(t.id));
console.log(`   • Треугольников-кандидатов для расширения: ${candidateTriangles.length}`);

// 🔥 ПЕРЕДАЁМ В STRUCTUREBUILDER ТОЛЬКО ЯКОРНЫЕ ТРЕУГОЛЬНИКИ (24 шт)
// Структура строится ТОЛЬКО из них, без мусора
console.log(`\n📊 ПЕРЕДАЮ В STRUCTUREBUILDER: ${anchorTrianglesMap.size} якорных треугольников`);

const structures = structureManager.buildStructures(
    anchorsForValidation,
    Array.from(anchorTrianglesMap.values()),  // ← только 24 якоря!
    exactGraph,
    existingModel.graph,
    morphologyMap,
    existingModel.morphologyMap
);

// ==================== ЭТАП 2: ГЕОМЕТРИЧЕСКОЕ РАСШИРЕНИЕ ====================
if (structures.length > 0 && !this.fastMode) {
    console.log(`\n🔧 ЭТАП 2: Геометрическое расширение структур...`);

    // Берём главную структуру (самую большую)
    const mainStructure = structures[0];
    console.log(`   • Исходная структура: ${mainStructure.triangleIds.size} треугольников`);

    // Расширяем структуру, используя ТОЛЬКО треугольники-кандидаты (без якорей)
    let expanded = true;
    let iteration = 0;
    const maxIterations = 10;

    while (expanded && iteration < maxIterations) {
        expanded = false;
        iteration++;

        // Получаем граничные рёбра структуры
        const boundaryEdges = this.getBoundaryEdgesFromStructure(mainStructure);
        console.log(`   • Итерация ${iteration}: граничных рёбер ${boundaryEdges.length}`);

        for (const edge of boundaryEdges) {
            // Ищем соседний треугольник СРЕДИ КАНДИДАТОВ (не в структуре)
            const neighbor = this.findNeighborTriangleInGraph(
                edge,
                candidateTriangles,  // ← ищем только среди кандидатов!
                mainStructure
            );

            if (neighbor) {
                // Пытаемся добавить геометрически
                const added = this.tryAddGeometricTriangle(
                    neighbor, mainStructure, exactGraph, existingModel.graph,
                    morphologyMap, existingModel.morphologyMap
                );

                if (added) {
                    expanded = true;
                    // 🔥 Удаляем добавленный треугольник из кандидатов
                    const idx = candidateTriangles.findIndex(t => t.id === neighbor.id);
                    if (idx !== -1) candidateTriangles.splice(idx, 1);
                    console.log(`      ✅ Добавлен треугольник ${neighbor.id.substring(0,12)} (осталось кандидатов: ${candidateTriangles.length})`);
                }
            }
        }
    }

    console.log(`   ✅ Геометрическое расширение завершено, теперь ${mainStructure.triangleIds.size} треугольников`);
    console.log(`   • Осталось кандидатов: ${candidateTriangles.length}`);
}   
             
// Сохраняем структуры в модель
if (existingModel) {
    existingModel.structures = structures.map(s => ({
        id: s.id,
        triangleIds: Array.from(s.triangleIds),
        pointIds: Array.from(s.pointIds),
        transform: s.transform,
        confidence: s.calculateConfidence(),
        rays: s.rays || [],
        // 🔥 ДОБАВЛЯЕМ САМИ ТРЕУГОЛЬНИКИ
        triangles: Array.from(s.triangles.values()).map(t => ({
            id: t.id,
            p1: t.p1,
            p2: t.p2,
            p3: t.p3,
            pB1: t.pB1,
            pB2: t.pB2,
            pB3: t.pB3,
            confidence: t.confidence,
            edges: t.edges ? t.edges.map(e => ({
                v1: e.v1,
                v2: e.v2,
                externalPoint: e.externalPoint
            })) : []
        }))
    }));

    existingModel.pointToStructure = new Map();
    for (const structure of structures) {
        for (const pointId of structure.pointIds) {
            existingModel.pointToStructure.set(pointId, structure.id);
        }
    }

    console.log(`   💾 Сохранено структур: ${structures.length}, всего лучей: ${structures.reduce((sum, s) => sum + (s.rays?.length || 0), 0)}`);
    console.log(`   💾 Сохранено треугольников: ${structures.reduce((sum, s) => sum + s.triangles.size, 0)}`);
}
             
                console.log(`\n📊 ПОСТРОЕНО СТРУКТУР: ${structures.length}`);

                // Анализируем отношения между структурами
                const relations = structureManager.analyzeRelations();
                if (relations.count > 1 && this.debug) {
                    console.log(`\n🔍 ОБНАРУЖЕНО ${relations.count} НЕЗАВИСИМЫХ СТРУКТУР:`);
                    relations.relations.forEach((r, i) => {
                        console.log(`   • Структуры ${i+1}: разница масштаба ${(r.scaleDiff*100).toFixed(1)}%, поворота ${r.rotationDiff.toFixed(1)}°`);
                    });
                }

                // Сохраняем transform'ы структур в модель
                if (!existingModel.structures) {
                    existingModel.structures = [];
                }
                for (const structure of structures) {
                    existingModel.structures.push({
                        id: structure.id,
                        transform: structure.transform,
                        points: Array.from(structure.pointIds),
                        confidence: structure.calculateConfidence()
                    });
                }

                // Для обратной совместимости - используем transform самой уверенной структуры
                let primaryTransform = null;
                if (structures.length > 0) {
                    const best = structureManager.getBestStructure();
                    primaryTransform = best?.transform || null;
                    if (this.debug && structures.length > 1) {
                        console.log(`\n🎯 Выбрана главная структура с уверенностью ${(best.calculateConfidence()*100).toFixed(1)}%`);
                    }
                }

                // ===== ЭТАП 3: Финальная валидация =====
                console.log(`\n🔍 ЭТАП 3: Финальная валидация структур`);

                let finalValidationResult = null;
                let allValidatedPoints = [];
                let finalTransform = null;

                // Валидируем каждую структуру отдельно
                for (const structure of structures) {
                    if (structure.triangleIds.size === 0) continue;

                    const structureAnchors = structure.getAnchors();
                    if (structureAnchors.length === 0) continue;

                    console.log(`\n   Валидация структуры ${structure.id} (${structureAnchors.length} якорей)...`);
                   
                    // 🔥 ДИАГНОСТИКА: показываем первые якоря структуры
                    if (this.debug && structureAnchors.length > 0) {
                        console.log(`      🔍 Первые 3 якоря структуры:`);
                        structureAnchors.slice(0, 3).forEach((a, i) => {
                            const pA = exactGraph.nodes.get(a.pointA);
                            const pB = existingModel.graph.nodes.get(a.pointB);
                            if (pA && pB) {
                                console.log(`         ${i+1}: A(${pA.x.toFixed(1)},${pA.y.toFixed(1)}) ↔ B(${pB.x.toFixed(1)},${pB.y.toFixed(1)}) [${(a.confidence*100).toFixed(0)}%]`);
                            } else {
                                console.log(`         ${i+1}: точка не найдена! A=${!!pA}, B=${!!pB}`);
                            }
                        });
                    }

                    const validationResult = validator.validateAll(
                        exactGraph,
                        existingModel.graph,
                        structureAnchors,
                        morphologyMap,
                        existingModel.morphologyMap
                    );
                   
                    // 🔥 ДИАГНОСТИКА: результат валидации
                    if (this.debug) {
                        console.log(`      📊 Результат валидации: success=${validationResult.success}`);
                        if (validationResult.results) {
                            console.log(`         Якорей: ${validationResult.results.anchors?.length || 0}`);
                            console.log(`         Подтверждено: ${validationResult.results.confirmed?.length || 0}`);
                            console.log(`         Кандидатов: ${validationResult.results.candidates?.length || 0}`);
                            console.log(`         Отвергнуто: ${validationResult.results.rejected?.length || 0}`);
                        }
                        if (validationResult.transform) {
                            console.log(`         Transform: масштаб ${validationResult.transform.scale.toFixed(3)}, поворот ${(validationResult.transform.rotation * 180 / Math.PI).toFixed(1)}°`);
                        }
                    }

                    if (validationResult.success) {
                        if (validationResult.results) {
                            allValidatedPoints.push(...validationResult.results.confirmed);
                            allValidatedPoints.push(...validationResult.results.anchors);
                        }

                        structure.transform = validationResult.transform;

                        if (!finalValidationResult || (validationResult.transform &&
                            Math.abs(validationResult.transform.scale - 1) < Math.abs(finalValidationResult.transform?.scale - 1))) {
                            finalValidationResult = validationResult;
                            finalTransform = validationResult.transform;
                        }
                       
                        if (this.debug) {
                            console.log(`      ✅ Структура ${structure.id} успешно валидирована`);
                        }
                    } else {
                        if (this.debug) {
                            console.log(`      ⚠️ Структура ${structure.id} НЕ прошла валидацию!`);
                            if (validationResult.error) {
                                console.log(`         Ошибка: ${validationResult.error}`);
                            }
                        }
                    }
                }

                // Если не удалось ни одной структуры - используем якоря
                if (!finalValidationResult) {
                    console.log(`\n⚠️ Структуры не дали результата, используем якоря...`);
                   
                    if (this.debug) {
                        console.log(`   Якорей для валидации: ${anchorsForValidation.length}`);
                        anchorsForValidation.slice(0, 3).forEach((a, i) => {
                            const pA = exactGraph.nodes.get(a.pointA);
                            const pB = existingModel.graph.nodes.get(a.pointB);
                            if (pA && pB) {
                                console.log(`      Якорь ${i+1}: A(${pA.x.toFixed(1)},${pA.y.toFixed(1)}) ↔ B(${pB.x.toFixed(1)},${pB.y.toFixed(1)})`);
                            }
                        });
                    }
                   
                    finalValidationResult = validator.validateAll(
                        exactGraph,
                        existingModel.graph,
                        anchorsForValidation,
                        morphologyMap,
                        existingModel.morphologyMap
                    );
                   
                    if (this.debug && finalValidationResult) {
                        console.log(`   Результат валидации якорей: success=${finalValidationResult.success}`);
                        if (finalValidationResult.results) {
                            console.log(`      Якорей: ${finalValidationResult.results.anchors?.length || 0}`);
                            console.log(`      Подтверждено: ${finalValidationResult.results.confirmed?.length || 0}`);
                        }
                    }
                   
                    if (finalValidationResult.success) {
                        finalTransform = finalValidationResult.transform;
                    }
                }

                if (finalValidationResult && finalValidationResult.success) {
                    // 🔥 СОХРАНЯЕМ TRANSFORM В МОДЕЛЬ
                    if (existingModel) {
                        existingModel.transform = finalTransform;
                    }
                  // 🔥 СОХРАНЯЕМ КОНТУР В СУЩЕСТВУЮЩУЮ МОДЕЛЬ
    if (outlineContour && !existingModel.metadata.outlineContour) {
        existingModel.metadata.outlineContour = outlineContour;
        console.log(`💾 Контур следа сохранён в существующую модель ${modelIdHint.substring(0,12)}`);
        console.log(`   точек в контуре: ${outlineContour.points.length}`);
    } else if (outlineContour && existingModel.metadata.outlineContour) {
        console.log(`⚠️ Контур уже существует в модели, не перезаписываю`);
    } else if (!outlineContour) {
        console.log(`⚠️ Нет контура для сохранения`);
    }

                    if (this.debug) {
                        console.log(`\n💾 ФИНАЛЬНЫЙ TRANSFORM СОХРАНЁН В МОДЕЛЬ:`);
                        console.log(`   • Масштаб: ${finalTransform?.scale.toFixed(3) || 'нет'}`);
                        console.log(`   • Поворот: ${finalTransform ? (finalTransform.rotation * 180 / Math.PI).toFixed(1) : 'нет'}°`);
                        console.log(`   • Сдвиг: ${finalTransform ? `(${finalTransform.translation.x.toFixed(1)}, ${finalTransform.translation.y.toFixed(1)})` : 'нет'}`);
                    }

                    // 🔥 Формируем финальный список matches (ОДИН РАЗ!)
                    let finalValidatedMatches = [];

                    for (const structure of structures) {
                        const anchors = structure.getAnchors();
                        for (const anchor of anchors) {
                            if (anchor.pointA && anchor.pointB) {
                                finalValidatedMatches.push({
                                    pointA: anchor.pointA,
                                    pointB: anchor.pointB,
                                    confidence: anchor.confidence,
                                    status: 'structure',
                                    structureId: structure.id
                                });
                            }
                        }
                    }

                    console.log(`\n✅ ИТОГО ПОДТВЕРЖДЕННЫХ ТОЧЕК: ${finalValidatedMatches.length}`);

                    // ===== ШАГ 3.6: Финальное притягивание близких точек с топологической проверкой =====
                    if (this.debug) console.log(`\n🧲 ЗАПУСК ФИНАЛЬНОГО ПРИТЯГИВАНИЯ БЛИЗКИХ ТОЧЕК`);

const magneticPull = (matches, photoGraph, modelGraph, transform, threshold = 10, structure = null) => {
    if (!this.modelEnhancer) {
        const ModelEnhancer = require('./enhancers/ModelEnhancer');
        this.modelEnhancer = new ModelEnhancer({ debug: this.debug });
    }
    return this.modelEnhancer._magneticPull(matches, photoGraph, modelGraph, transform, threshold);
};
                    // Применяем притягивание если есть transform и matches
                    if (finalTransform && finalValidatedMatches && finalValidatedMatches.length > 0) {
                        const { pulledMatches, pulledCount } = magneticPull(
                            finalValidatedMatches,
                            exactGraph,
                            existingModel.graph,
                            finalTransform,
                            25
                        );

                        if (pulledCount > 0) {
                            if (this.debug) console.log(`\n✅ Притянуто ${pulledCount} точек!`);
                            finalValidatedMatches = pulledMatches;
                        }
                    } else {
                        if (this.debug) console.log(`\n⚠️ Нет transform или matches для притягивания`);
                    }
// ===== ТЕСТ: АНАЛИЗ ОШИБОК ПО ЗОНАМ =====
if (this.debug && finalTransform && finalValidatedMatches.length > 0) {
    console.log(`\n📊 АНАЛИЗ ОШИБОК ПО ЗОНАМ (после магнита):`);
   
    const errorsByZone = { heel: [], arch: [], toe: [] };
    const zoneNames = { heel: 'пятка', arch: 'свод', toe: 'носок' };
   
    // Определяем границы зон по Y в системе модели
    const allY = finalValidatedMatches.map(match => {
        const modelPoint = existingModel.graph.nodes.get(match.pointB);
        return modelPoint?.y || 0;
    }).filter(y => y > 0);
   
    if (allY.length > 0) {
        const yMin = Math.min(...allY);
        const yMax = Math.max(...allY);
        const yRange = yMax - yMin;
       
        const zoneBounds = {
            heel: { min: yMax - yRange * 0.3, max: yMax },
            arch: { min: yMin + yRange * 0.3, max: yMax - yRange * 0.3 },
            toe: { min: yMin, max: yMin + yRange * 0.3 }
        };
       
        for (const match of finalValidatedMatches) {
            const photoPoint = exactGraph.nodes.get(match.pointA);
            const modelPoint = existingModel.graph.nodes.get(match.pointB);
           
            if (!photoPoint || !modelPoint) continue;
           
            // Проецируем фото-точку через transform
            const projected = {
                x: photoPoint.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
                   photoPoint.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
                   finalTransform.translation.x,
                y: photoPoint.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
                   photoPoint.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
                   finalTransform.translation.y
            };
           
            const error = Math.sqrt((projected.x - modelPoint.x)**2 + (projected.y - modelPoint.y)**2);
            const y = modelPoint.y; // используем Y модели
           
            // Определяем зону
            let zone = 'arch';
            if (y >= zoneBounds.heel.min) zone = 'heel';
            if (y <= zoneBounds.toe.max) zone = 'toe';
           
            errorsByZone[zone].push(error);
        }
       
        // Выводим статистику
        console.log(`\n📊 ОШИБКИ ПО ЗОНАМ (после магнита):`);
        for (const [zone, errors] of Object.entries(errorsByZone)) {
            if (errors.length > 0) {
                const avg = errors.reduce((a, b) => a + b, 0) / errors.length;
                const max = Math.max(...errors);
                const min = Math.min(...errors);
                console.log(`   • ${zoneNames[zone]}: ${errors.length} точек, средняя ${avg.toFixed(1)}px (мин ${min.toFixed(1)}px, макс ${max.toFixed(1)}px)`);
            } else {
                console.log(`   • ${zoneNames[zone]}: нет точек`);
            }
        }
       
        // Диагностика: нужно ли зональное выравнивание?
        const heelAvg = errorsByZone.heel.reduce((a,b)=>a+b,0) / (errorsByZone.heel.length || 1);
        const toeAvg = errorsByZone.toe.reduce((a,b)=>a+b,0) / (errorsByZone.toe.length || 1);
        const archAvg = errorsByZone.arch.reduce((a,b)=>a+b,0) / (errorsByZone.arch.length || 1);
       
        console.log(`\n🔍 ДИАГНОСТИКА:`);
        if (Math.abs(heelAvg - toeAvg) > 2) {
            console.log(`   ⚠️ ЗНАЧИТЕЛЬНАЯ РАЗНИЦА: пятка ${heelAvg.toFixed(1)}px vs носок ${toeAvg.toFixed(1)}px`);
            console.log(`   → Рекомендуется ЗОНАЛЬНЫЙ TRANSFORM`);
        } else if (Math.max(heelAvg, toeAvg, archAvg) > 3) {
            console.log(`   ⚠️ ВЫСОКАЯ ОШИБКА: средняя ${Math.max(heelAvg, toeAvg, archAvg).toFixed(1)}px`);
            console.log(`   → Нужно смягчить пороги или улучшить магнит`);
        } else {
            console.log(`   ✅ ОШИБКИ В НОРМЕ: магнит работает хорошо`);
        }
    }
}
                    // ===== ШАГ 3.7: ПОДГОТОВКА УНИКАЛЬНЫХ ТОЧЕК =====
                    if (this.debug) console.log(`\n📊 ПОДГОТОВКА УНИКАЛЬНЫХ ТОЧЕК`);

                    // Получаем все точки из графов
                    const allPointsInA = Array.from(exactGraph?.nodes?.values() || []);
                    const allPointsInB = Array.from(existingModel?.graph?.nodes?.values() || []);

                    if (this.debug) {
                        console.log(`   • Всего точек в A: ${allPointsInA.length}`);
                        console.log(`   • Всего точек в B: ${allPointsInB.length}`);
                    }

                    // Множества уже сопоставленных точек
                    const matchedPointsA = new Set(finalValidatedMatches?.map(m => m?.pointA) || []);
                    const matchedPointsB = new Set(finalValidatedMatches?.map(m => m?.pointB) || []);

                    if (this.debug) {
                        console.log(`   • Сопоставлено точек в A: ${matchedPointsA.size}`);
                        console.log(`   • Сопоставлено точек в B: ${matchedPointsB.size}`);
                    }

                    // ===== ШАГ 3.8: ПОИСК НОВЫХ ПАР СРЕДИ НЕСОПОСТАВЛЕННЫХ =====
                    if (this.debug) console.log(`\n🔍 ПОИСК НОВЫХ ПАР СРЕДИ НЕСОПОСТАВЛЕННЫХ ТОЧЕК`);

                    // Получаем все точки модели без пары
                    const unmatchedModelPoints = new Map();
                    for (const [id, node] of existingModel.graph.nodes) {
                        if (!matchedPointsB.has(id)) {
                            unmatchedModelPoints.set(id, node);
                        }
                    }

                    // Получаем все точки фото без пары (из originalPhotoPoints)
                    const unmatchedPhotoPoints = points.filter(p => !matchedPointsA.has(p.id));

                    if (this.debug) {
                        console.log(`   • Несопоставленных точек модели: ${unmatchedModelPoints.size}`);
                        console.log(`   • Несопоставленных точек фото: ${unmatchedPhotoPoints.length}`);
                    }

                    // Проверяем каждую точку фото без пары
                    let newPairsFound = 0;
                    const newPairs = [];

                    for (const photoPoint of unmatchedPhotoPoints) {
                        const projected = {
                            x: photoPoint.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
                               photoPoint.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
                               finalTransform.translation.x,
                            y: photoPoint.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
                               photoPoint.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
                               finalTransform.translation.y
                        };

                        let bestMatch = null;
                        let bestDist = Infinity;

                        for (const [modelId, modelPoint] of unmatchedModelPoints) {
                            const dx = projected.x - modelPoint.x;
                            const dy = projected.y - modelPoint.y;
                            const dist = Math.sqrt(dx*dx + dy*dy);

                            if (dist < bestDist && dist < 20) {  // ← радиус 20px
                                bestDist = dist;
                                bestMatch = { modelId, modelPoint };
                            }
                        }

                        if (bestMatch) {
                            if (this.debug) {
                                console.log(`\n   🆕 Найдена потенциальная пара:`);
                                console.log(`      Фото ${photoPoint.id.substring(0,12)} (${projected.x.toFixed(1)}, ${projected.y.toFixed(1)})`);
                                console.log(`      Модель ${bestMatch.modelId.substring(0,12)} (${bestMatch.modelPoint.x.toFixed(1)}, ${bestMatch.modelPoint.y.toFixed(1)})`);
                                console.log(`      Расстояние: ${bestDist.toFixed(1)}px`);
                            }

                            const photoMorph = morphologyMap.get(photoPoint.id);
                            const modelMorph = existingModel.morphologyMap.get(bestMatch.modelId);

                            if (photoMorph && modelMorph) {
                                let morphScore = 0;
                                let checks = 0;

                                if (photoMorph.eccentricity && modelMorph.eccentricity) {
                                    const ratio = Math.min(photoMorph.eccentricity, modelMorph.eccentricity) /
                                                 Math.max(photoMorph.eccentricity, modelMorph.eccentricity);
                                    morphScore += ratio;
                                    checks++;
                                }

                                if (photoMorph.asymmetry && modelMorph.asymmetry) {
                                    const ratio = Math.min(photoMorph.asymmetry, modelMorph.asymmetry) /
                                                 Math.max(photoMorph.asymmetry, modelMorph.asymmetry);
                                    morphScore += ratio;
                                    checks++;
                                }

                                const finalMorphScore = checks > 0 ? morphScore / checks : 0.5;
                                if (this.debug) console.log(`      Морфология: ${(finalMorphScore * 100).toFixed(1)}%`);

                                if (finalMorphScore > 0.45) {  // с 70% до 45%
    newPairs.push({
        pointA: photoPoint.id,
        pointB: bestMatch.modelId,
        confidence: 1 - (bestDist / 30),
        status: 'new_pair'
    });
    newPairsFound++;
}
                            }
                        }
                    }

                    if (newPairsFound > 0) {
                        console.log(`\n✅ Найдено ${newPairsFound} новых пар среди несопоставленных точек!`);
                        finalValidatedMatches = [...finalValidatedMatches, ...newPairs];

                        matchedPointsA.clear();
                        matchedPointsB.clear();
                        for (const match of finalValidatedMatches) {
                            matchedPointsA.add(match.pointA);
                            matchedPointsB.add(match.pointB);
                        }

                        if (this.debug) {
                            console.log(`   • Теперь сопоставлено точек в A: ${matchedPointsA.size}`);
                            console.log(`   • Теперь сопоставлено точек в B: ${matchedPointsB.size}`);
                        }
                    } else {
                        if (this.debug) console.log(`\n⚠️ Новых пар не найдено`);
                    }

// ===== МЯГКОЕ ПРИТЯГИВАНИЕ БЛИЗКИХ НЕСОПОСТАВЛЕННЫХ ТОЧЕК =====
if (this.debug) console.log(`\n🧲 МЯГКОЕ ПРИТЯГИВАНИЕ БЛИЗКИХ НЕСОПОСТАВЛЕННЫХ ТОЧЕК`);

let softPulled = 0;
const softThreshold = 15; // порог в пикселях для мягкого притягивания (было 12)

// Обновляем множества после добавления новых пар
const updatedMatchedPointsA = new Set(finalValidatedMatches.map(m => m.pointA));
const updatedMatchedPointsB = new Set(finalValidatedMatches.map(m => m.pointB));

const remainingPhotoPoints = points.filter(p => !updatedMatchedPointsA.has(p.id));
const remainingModelPoints = Array.from(existingModel.graph.nodes.values())
    .filter(p => !updatedMatchedPointsB.has(p.id));

for (const photoPoint of remainingPhotoPoints) {
    if (!photoPoint || !photoPoint.id) continue;
   
    const projected = GeometryUtils.applyTransform(photoPoint, finalTransform);
   
    let bestMatch = null;
    let bestDist = Infinity;
   
    for (const modelPoint of remainingModelPoints) {
        if (!modelPoint || !modelPoint.id) continue;
       
        const dx = projected.x - modelPoint.x;
        const dy = projected.y - modelPoint.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
       
        if (dist < bestDist && dist < softThreshold) {
            bestDist = dist;
            bestMatch = modelPoint;
        }
    }
   
    if (bestMatch && bestDist > 0.5) {
        // Усредняем позицию (мягкое притягивание)
        const weight = 0.5;
        const avgX = (projected.x * weight + bestMatch.x * (1 - weight));
        const avgY = (projected.y * weight + bestMatch.y * (1 - weight));
       
        bestMatch.x = avgX;
        bestMatch.y = avgY;
        bestMatch.softPulled = true;
        bestMatch.softPullDistance = bestDist;
       
        softPulled++;
       
        if (this.debug && softPulled <= 10) {
            console.log(`   🧲 Мягкое притягивание: ${photoPoint.id.substring(0,12)} → ${bestMatch.id.substring(0,12)} (${bestDist.toFixed(1)}px)`);
        }
    }
}

if (this.debug && softPulled > 0) {
    console.log(`   ✅ Мягко притянуто ${softPulled} точек (порог ${softThreshold}px)`);
}

// ===== ИТЕРАТИВНОЕ УТОЧНЕНИЕ TRANSFORM =====
if (softPulled > 0 && this.debug) console.log(`\n🔄 ИТЕРАТИВНОЕ УТОЧНЕНИЕ TRANSFORM (после мягкого притягивания)`);

let refinementIteration = 0;
const maxRefinements = 3;
let transformRefined = finalTransform;

while (refinementIteration < maxRefinements) {
    refinementIteration++;
   
    // Собираем все актуальные соответствия
    const allAnchors = [];
    for (const match of finalValidatedMatches) {
        const photoPoint = exactGraph.nodes.get(match.pointA);
        const modelPoint = existingModel.graph.nodes.get(match.pointB);
        if (photoPoint && modelPoint) {
            allAnchors.push({
                pointA: match.pointA,
                pointB: match.pointB,
                confidence: match.confidence
            });
        }
    }
   
    if (allAnchors.length < 3) break;
   
    // Пересчитываем transform
    const newTransform = validator.calculateTransform(allAnchors, exactGraph, existingModel.graph);
    if (!newTransform) break;
   
    // Проверяем, изменился ли transform
    const scaleDiff = Math.abs(newTransform.scale - transformRefined.scale) / transformRefined.scale;
    const rotDiff = Math.abs(newTransform.rotation - transformRefined.rotation) * 180 / Math.PI;
   
    if (scaleDiff < 0.01 && rotDiff < 0.5) {
        if (this.debug) console.log(`   ✅ Transform стабилизировался (масштаб ${(scaleDiff*100).toFixed(2)}%, поворот ${rotDiff.toFixed(2)}°)`);
        break;
    }
   
    transformRefined = newTransform;
   
    if (this.debug) {
        console.log(`   🔄 Итерация ${refinementIteration}: масштаб ${transformRefined.scale.toFixed(3)} (было ${finalTransform.scale.toFixed(3)}), поворот ${(transformRefined.rotation * 180 / Math.PI).toFixed(1)}° (было ${(finalTransform.rotation * 180 / Math.PI).toFixed(1)}°)`);
    }
   
    // Повторяем мягкое притягивание с новым transform
    let softPulledAgain = 0;
    const remainingPhotoPoints = points.filter(p => !updatedMatchedPointsA.has(p.id));
    const remainingModelPoints = Array.from(existingModel.graph.nodes.values())
        .filter(p => !updatedMatchedPointsB.has(p.id));
   
    for (const photoPoint of remainingPhotoPoints) {
        if (!photoPoint || !photoPoint.id) continue;
       
        const projected = this.applyTransform(photoPoint, transformRefined);
       
        let bestMatch = null;
        let bestDist = Infinity;
       
        for (const modelPoint of remainingModelPoints) {
            if (!modelPoint || !modelPoint.id) continue;
           
            const dx = projected.x - modelPoint.x;
            const dy = projected.y - modelPoint.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
           
            if (dist < bestDist && dist < softThreshold) {
                bestDist = dist;
                bestMatch = modelPoint;
            }
        }
       
        if (bestMatch && bestDist > 0.5) {
            const weight = 0.5;
            const avgX = (projected.x * weight + bestMatch.x * (1 - weight));
            const avgY = (projected.y * weight + bestMatch.y * (1 - weight));
           
            bestMatch.x = avgX;
            bestMatch.y = avgY;
            softPulledAgain++;
        }
    }
   
    if (this.debug && softPulledAgain > 0) {
        console.log(`   🧲 Дополнительное мягкое притягивание: ${softPulledAgain} точек`);
    }
   
    // Обновляем transform для следующей итерации
    finalTransform = transformRefined;
}

if (this.debug && refinementIteration > 1) {
    console.log(`   ✅ Уточнение transform завершено после ${refinementIteration} итераций`);
}
                 
                 
                    // Точки только в первом следе (модель)
                    const uniqueInModel = allPointsInA
                        .filter(p => p && p.id && !matchedPointsA.has(p.id))
                        .map(p => ({
                            id: p.id,
                            x: p.x,
                            y: p.y,
                            type: 'unique_in_model'
                        }));

                    // Точки только во втором следе (фото)
                    const uniqueInPhoto = points
                        .filter(p => !matchedPointsA.has(p.id))
                        .map(p => {
                            const projected = {
                                x: p.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
                                   p.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                   finalTransform.translation.x,
                                y: p.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                   p.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
                                   finalTransform.translation.y
                            };
                            return {
                                id: p.id,
                                x: projected.x,
                                y: projected.y,
                                type: 'unique_in_photo'
                            };
                        });

                    if (this.debug) {
                        console.log(`   • Уникальных в модели: ${uniqueInModel.length}`);
                        console.log(`   • Уникальных в фото: ${uniqueInPhoto.length}`);
                    }

                    // Сохраняем уникальные точки фото для последующего добавления в модель
                    this.lastUniqueInPhoto = uniqueInPhoto;

                    if (this.debug) {
                        // ===== ТАБЛИЦА ТОЧЕК ИЗ ВИЗУАЛИЗАЦИИ =====
                        console.log(`\n📊 ТОЧКИ В ВИЗУАЛИЗАЦИИ:`);
                        console.log(`┌──────┬────────────┬──────────────┬──────────────┬──────────────┬──────────┐`);
                        console.log(`│  #   │    Тип     │    Индекс     │  Координаты  │  Расстояние  │  Статус  │`);
                        console.log(`├──────┼────────────┼──────────────┼──────────────┼──────────────┼──────────┤`);

                        // Создаём карты индексов
                        const photoIndexMap = new Map();
                        const modelIndexMap = new Map();

                        Array.from(exactGraph?.nodes?.keys() || []).forEach((id, idx) => photoIndexMap.set(id, idx + 1));
                        Array.from(existingModel?.graph?.nodes?.keys() || []).forEach((id, idx) => modelIndexMap.set(id, idx + 1));

                        let rowNumber = 1;

                        // 1. Ярко-синие точки модели (без пары)
                        for (const point of uniqueInModel) {
                            const idx = modelIndexMap.get(point.id) || '?';
                            console.log(`│ ${rowNumber.toString().padEnd(4)} │ Модель 🔵   │ ${idx.toString().padEnd(12)} │ (${point.x.toFixed(1)},${point.y.toFixed(1).padStart(6)}) │      —      │ без пары │`);
                            rowNumber++;
                        }

                        // 2. Блёкло-синие точки фото (без пары)
                        for (const point of uniqueInPhoto) {
                            const idx = photoIndexMap.get(point.id) || '?';
                            console.log(`│ ${rowNumber.toString().padEnd(4)} │ Фото 🔷     │ ${idx.toString().padEnd(12)} │ (${point.x.toFixed(1)},${point.y.toFixed(1).padStart(6)}) │      —      │ без пары │`);
                            rowNumber++;
                        }

                        // 3. Пары (с расстояниями)
                        for (const match of finalValidatedMatches) {
                            if (!match?.pointA || !match?.pointB) continue;

                            const photoIdx = photoIndexMap.get(match.pointA);
                            const modelIdx = modelIndexMap.get(match.pointB);
                            const photoPoint = exactGraph?.nodes?.get(match.pointA);
                            const modelPoint = existingModel?.graph?.nodes?.get(match.pointB);

                            if (photoPoint && modelPoint && finalTransform) {
                                // Проецируем точку фото в пространство модели
                                const projected = {
                                    x: photoPoint.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
                                       photoPoint.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                       finalTransform.translation.x,
                                    y: photoPoint.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                       photoPoint.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
                                       finalTransform.translation.y
                                };

                                const dist = Math.sqrt(
                                    Math.pow(projected.x - modelPoint.x, 2) +
                                    Math.pow(projected.y - modelPoint.y, 2)
                                );

                                // Определяем иконку статуса
                                let statusIcon = '';
                                switch(match.status) {
                                    case 'anchor': statusIcon = '🔴'; break;
                                    case 'validator_found': statusIcon = '🟢'; break;
                                    case 'new_pair': statusIcon = '🆕'; break;
                                    case 'blue_confirmed': statusIcon = '🔷'; break;
                                    default: statusIcon = '🟡';
                                }

                                console.log(`│ ${rowNumber.toString().padEnd(4)} │ Пара ${statusIcon} │ фото ${photoIdx}→модель ${modelIdx} │ ${dist.toFixed(1).padStart(5)}px      │ ${match.status} │`);
                                rowNumber++;
                            }
                        }

                        console.log(`└──────┴────────────┴──────────────┴──────────────┴──────────────┴──────────┘`);

                        // Итог
                        console.log(`\n📊 ИТОГО В ВИЗУАЛИЗАЦИИ:`);
                        console.log(`   • Модель 🔵: ${uniqueInModel.length} точек`);
                        console.log(`   • Фото 🔷: ${uniqueInPhoto.length} точек`);
                        console.log(`   • Пар: ${finalValidatedMatches.length} точек`);
                        console.log(`   • ВСЕГО: ${uniqueInModel.length + uniqueInPhoto.length + finalValidatedMatches.length} точек`);
                    }

                    // Сохраняем в модель для визуализации
                    if (existingModel) {
                        existingModel.uniquePoints = {
                            model: uniqueInModel,
                            photo: uniqueInPhoto
                        };
                    }

                    // ===== ШАГ 3.9: ПОЛНЫЙ ЦИКЛ ДЛЯ СИНИХ ТОЧЕК =====
                    if (this.debug) console.log(`\n🔷 ПОЛНЫЙ ЦИКЛ ДЛЯ СИНИХ ТОЧЕК`);

                    try {
                        // Получаем оставшиеся синие точки
                        const remainingPhotoPoints = unmatchedPhotoPoints.filter(p => !matchedPointsA.has(p?.id));
                        const remainingModelPoints = Array.from(existingModel?.graph?.nodes?.values() || [])
                            .filter(p => !matchedPointsB.has(p?.id));

                        if (this.debug) {
                            console.log(`   • Синих точек фото: ${remainingPhotoPoints.length}`);
                            console.log(`   • Синих точек модели: ${remainingModelPoints.length}`);
                        }

                        if (remainingPhotoPoints.length === 0 || remainingModelPoints.length === 0) {
                            if (this.debug) console.log(`   ⚠️ Нет синих точек для обработки`);
                        } else {
                            // ШАГ 1: Собираем кандидатов (как в валидаторе)
                            let blueCandidates = [];

                            for (const photoPoint of remainingPhotoPoints) {
                                if (!photoPoint || !photoPoint.id) continue;

                                try {
                                    const projected = {
                                        x: photoPoint.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
                                           photoPoint.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                           finalTransform.translation.x,
                                        y: photoPoint.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                           photoPoint.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
                                           finalTransform.translation.y
                                    };

                                    // Ищем ближайшие точки модели
                                    const candidates = [];
                                    for (const modelPoint of remainingModelPoints) {
                                        if (!modelPoint || !modelPoint.id) continue;

                                        const dx = projected.x - modelPoint.x;
                                        const dy = projected.y - modelPoint.y;
                                        const dist = Math.sqrt(dx*dx + dy*dy);

                                        if (dist < 20) {  // с 15px до 20px
                                            candidates.push({
                                                modelPoint,
                                                distance: dist,
                                                normalizedDist: dist / 100
                                            });
                                        }
                                    }

                                    if (candidates.length > 0) {
                                        candidates.sort((a, b) => a.distance - b.distance);
                                        blueCandidates.push({
                                            pointA: photoPoint.id,
                                            candidates: candidates.slice(0, 3), // топ-3 кандидата
                                            photoPoint,
                                            projected
                                        });
                                    }
                                } catch (pointError) {
                                    if (this.debug) console.log(`   ⚠️ Ошибка обработки точки ${photoPoint?.id?.substring(0,12)}: ${pointError.message}`);
                                }
                            }

                            if (this.debug) console.log(`\n📊 Найдено ${blueCandidates.length} точек-кандидатов`);

                            // ШАГ 2: ТОПОЛОГИЧЕСКАЯ ПРОВЕРКА (как в checkGlobalConsistency)
                            if (this.debug) console.log(`\n🔍 ТОПОЛОГИЧЕСКАЯ ПРОВЕРКА СИНИХ КАНДИДАТОВ`);

                            let topologicallyConsistent = [];

                            for (const candidate of blueCandidates) {
                                try {
                                    if (this.debug) console.log(`\n   Проверка точки ${candidate.pointA.substring(0,12)}...`);

                                    // Для каждого кандидата проверяем топологию
                                    const photoNeighbors = GraphUtils.findNodeNeighbors(candidate.pointA, exactGraph) || [];
                                    const photoNeighborIds = photoNeighbors.map(n => n?.id).filter(id => id);

                                    // Какие из соседей уже сопоставлены?
                                    const matchedNeighbors = photoNeighborIds.filter(id => matchedPointsA.has(id));

                                    if (matchedNeighbors.length < 2) {
                                        if (this.debug) console.log(`      ⚠️ Мало сопоставленных соседей (${matchedNeighbors.length}) - пропускаем`);
                                        continue;
                                    }

                                    // Для каждого кандидата из топ-3
                                    for (const modelCandidate of candidate.candidates) {
                                        const modelPoint = modelCandidate.modelPoint;
                                        if (!modelPoint || !modelPoint.id) continue;

                                        const modelNeighbors = GraphUtils.findNodeNeighbors(modelPoint.id, existingModel.graph) || [];
                                        const modelNeighborIds = modelNeighbors.map(n => n?.id).filter(id => id);

                                        // Проверяем, что соседи модели тоже сопоставлены
                                        const matchedModelNeighbors = modelNeighborIds.filter(id => matchedPointsB.has(id));

                                        if (matchedModelNeighbors.length !== matchedNeighbors.length) {
                                            continue;
                                        }

                                        // Проверяем, что соседи соответствуют друг другу
                                        let topologyMatch = true;
                                        for (let i = 0; i < matchedNeighbors.length; i++) {
                                            const photoNeighbor = matchedNeighbors[i];
                                            // Находим, какой точке модели соответствует этот сосед
                                            const match = finalValidatedMatches.find(m => m?.pointA === photoNeighbor);
                                            if (!match || !match.pointB) {
                                                topologyMatch = false;
                                                break;
                                            }
                                            // Проверяем, есть ли этот modelId среди соседей модели
                                            if (!modelNeighborIds.includes(match.pointB)) {
                                                topologyMatch = false;
                                                break;
                                            }
                                        }

                                        if (topologyMatch) {
                                            if (this.debug) console.log(`      ✅ Топология согласована с кандидатом ${modelPoint.id.substring(0,12)}`);
                                            topologicallyConsistent.push({
                                                pointA: candidate.pointA,
                                                pointB: modelPoint.id,
                                                distance: modelCandidate.distance,
                                                photoPoint: candidate.photoPoint,
                                                modelPoint: modelPoint,
                                                projected: candidate.projected
                                            });
                                            break; // Берём первого подходящего
                                        }
                                    }
                                } catch (candidateError) {
                                    if (this.debug) console.log(`   ⚠️ Ошибка проверки кандидата: ${candidateError.message}`);
                                }
                            }

                            if (this.debug) console.log(`\n📊 Топологически согласовано: ${topologicallyConsistent.length} точек`);

                            // ШАГ 3: ИТЕРАТИВНОЕ НАТЯГИВАНИЕ (как в этапе 2)
                            if (topologicallyConsistent.length > 0) {
                                if (this.debug) console.log(`\n🔧 ИТЕРАТИВНОЕ НАТЯГИВАНИЕ СИНИХ ТОЧЕК`);

                                let workingAnchors = finalValidatedMatches.map(m => ({
                                    pointA: m?.pointA,
                                    pointB: m?.pointB,
                                    confidence: m?.confidence || 0.5
                                })).filter(a => a.pointA && a.pointB);

                                let addedBluePoints = [];

                                // Сортируем по расстоянию
                                topologicallyConsistent.sort((a, b) => a.distance - b.distance);

                                for (const candidate of topologicallyConsistent) {
                                    try {
                                        if (this.debug) console.log(`\n   Проверка кандидата ${candidate.pointA.substring(0,12)}...`);

                                        const testAnchors = [...workingAnchors, {
                                            pointA: candidate.pointA,
                                            pointB: candidate.pointB,
                                            confidence: 0.9
                                        }];

                                        const testTransform = validator.calculateTransform(
                                            testAnchors,
                                            exactGraph,
                                            existingModel.graph
                                        );

                                        if (!testTransform) {
                                            if (this.debug) console.log(`      ⚠️ Не удалось вычислить transform`);
                                            continue;
                                        }

                                        // Проверяем все существующие якоря
                                        let allConsistent = true;
                                        for (const anchor of workingAnchors) {
                                            if (!anchor || !anchor.pointA || !anchor.pointB) continue;

                                            const nodeA = exactGraph?.nodes?.get(anchor.pointA);
                                            const nodeB = existingModel?.graph?.nodes?.get(anchor.pointB);

                                            if (!nodeA || !nodeB) continue;

                                            const projected = validator.applyTransform(nodeA, testTransform);
                                            const dx = projected.x - nodeB.x;
                                            const dy = projected.y - nodeB.y;
                                            const error = Math.sqrt(dx*dx + dy*dy);
                                            const footprintSize = validator.getFootprintSize(Array.from(existingModel?.graph?.nodes?.values() || []));
                                            const relativeError = error / (footprintSize || 1);

                                            if (relativeError >= 0.05) {
                                                allConsistent = false;
                                                if (this.debug) console.log(`      ⚠️ Нарушена точка ${anchor.pointA.substring(0,12)}`);
                                                break;
                                            }
                                        }

                                        if (allConsistent) {
                                            // Проверяем самого кандидата
                                            const nodeA = exactGraph?.nodes?.get(candidate.pointA);
                                            const nodeB = existingModel?.graph?.nodes?.get(candidate.pointB);

                                            if (nodeA && nodeB) {
                                                const projected = validator.applyTransform(nodeA, testTransform);
                                                const dx = projected.x - nodeB.x;
                                                const dy = projected.y - nodeB.y;
                                                const error = Math.sqrt(dx*dx + dy*dy);
                                                const footprintSize = validator.getFootprintSize(Array.from(existingModel?.graph?.nodes?.values() || []));
                                                const relativeError = error / (footprintSize || 1);

                                                if (relativeError < 0.05) {
                                                    if (this.debug) console.log(`      ✅ Кандидат согласован!`);

                                                    // Притягиваем (усредняем)
                                                    const avgX = (projected.x + nodeB.x) / 2;
                                                    const avgY = (projected.y + nodeB.y) / 2;

                                                    nodeB.x = avgX;
                                                    nodeB.y = avgY;
                                                    nodeB.confirmationCount = (nodeB.confirmationCount || 1) + 1;

                                                    addedBluePoints.push({
                                                        pointA: candidate.pointA,
                                                        pointB: candidate.pointB,
                                                        confidence: 0.9,
                                                        status: 'blue_confirmed'
                                                    });

                                                    workingAnchors = testAnchors;
                                                }
                                            }
                                        }
                                    } catch (iterError) {
                                        if (this.debug) console.log(`   ⚠️ Ошибка итерации: ${iterError.message}`);
                                    }
                                }

                                if (addedBluePoints.length > 0) {
                                    console.log(`\n✅ Добавлено ${addedBluePoints.length} синих точек!`);
                                    finalValidatedMatches = [...finalValidatedMatches, ...addedBluePoints];

                                    // 🔥 ДОБАВЛЯЕМ МАГНИТ ДЛЯ НОВЫХ ПАР
                                    if (this.debug) console.log(`\n🧲 ДОПОЛНИТЕЛЬНОЕ ПРИТЯГИВАНИЕ НОВЫХ ПАР`);

                                    const { pulledMatches, pulledCount } = magneticPull(
                                        finalValidatedMatches,
                                        exactGraph,
                                        existingModel.graph,
                                        finalTransform,
                                        20 // порог в пикселях
                                    );

                                    if (pulledCount > 0) {
                                        if (this.debug) console.log(`\n✅ Притянуто ещё ${pulledCount} новых пар!`);
                                        finalValidatedMatches = pulledMatches;
                                    }

                                    // ===== ДОПОЛНИТЕЛЬНОЕ СОПОСТАВЛЕНИЕ СИНИХ КАНДИДАТОВ =====
                                    if (this.debug) console.log(`\n🔷 ДОПОЛНИТЕЛЬНОЕ СОПОСТАВЛЕНИЕ СИНИХ КАНДИДАТОВ`);

                                    // Находим оставшиеся синие точки
                                    const finalBluePhotoPoints = unmatchedPhotoPoints.filter(p => !matchedPointsA.has(p.id));
                                    const finalBlueModelPoints = Array.from(existingModel.graph.nodes.values())
                                        .filter(p => !matchedPointsB.has(p.id));

                                    if (this.debug) {
                                        console.log(`   • Осталось синих фото: ${finalBluePhotoPoints.length}`);
                                        console.log(`   • Осталось синих модели: ${finalBlueModelPoints.length}`);
                                    }

                                    // Ищем явные пары по расстоянию
                                    let finalBluePairs = 0;
                                    const blueCandidates = [];

                                    for (const photoPoint of finalBluePhotoPoints) {
                                        const projected = {
                                            x: photoPoint.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
                                               photoPoint.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                               finalTransform.translation.x,
                                            y: photoPoint.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                               photoPoint.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
                                               finalTransform.translation.y
                                        };

                                        // Ищем ближайшую модель
                                        let bestMatch = null;
                                        let bestDist = Infinity;

                                        for (const modelPoint of finalBlueModelPoints) {
                                            const dx = projected.x - modelPoint.x;
                                            const dy = projected.y - modelPoint.y;
                                            const dist = Math.sqrt(dx*dx + dy*dy);

                                            if (dist < bestDist && dist < 10) { // порог 10px
                                                bestDist = dist;
                                                bestMatch = modelPoint;
                                            }
                                        }

                                        if (bestMatch) {
                                            if (this.debug) {
                                                console.log(`\n   🔍 Найдена пара:`);
                                                console.log(`      Фото (${projected.x.toFixed(1)}, ${projected.y.toFixed(1)})`);
                                                console.log(`      Модель (${bestMatch.x.toFixed(1)}, ${bestMatch.y.toFixed(1)})`);
                                                console.log(`      Расстояние: ${bestDist.toFixed(1)}px`);
                                            }

                                            // Проверяем морфологию
                                            const photoMorph = morphologyMap.get(photoPoint.id);
                                            const modelMorph = existingModel.morphologyMap.get(bestMatch.id);

                                            if (photoMorph && modelMorph) {
                                                let morphScore = 0;
                                                let checks = 0;

                                                if (photoMorph.eccentricity && modelMorph.eccentricity) {
                                                    const ratio = Math.min(photoMorph.eccentricity, modelMorph.eccentricity) /
                                                                 Math.max(photoMorph.eccentricity, modelMorph.eccentricity);
                                                    morphScore += ratio;
                                                    checks++;
                                                }

                                                if (photoMorph.asymmetry && modelMorph.asymmetry) {
                                                    const ratio = Math.min(photoMorph.asymmetry, modelMorph.asymmetry) /
                                                                 Math.max(photoMorph.asymmetry, modelMorph.asymmetry);
                                                    morphScore += ratio;
                                                    checks++;
                                                }

                                                const finalMorphScore = checks > 0 ? morphScore / checks : 0.5;
                                                if (this.debug) console.log(`      Морфология: ${(finalMorphScore * 100).toFixed(1)}%`);

                                                if (finalMorphScore > 0.6) { // чуть ниже порог для последнего шанса
                                                    blueCandidates.push({
                                                        pointA: photoPoint.id,
                                                        pointB: bestMatch.id,
                                                        distance: bestDist,
                                                        morphScore: finalMorphScore
                                                    });
                                                }
                                            }
                                        }
                                    }

                                    if (blueCandidates.length > 0) {
                                        if (this.debug) console.log(`\n📊 Найдено ${blueCandidates.length} финальных кандидатов`);

                                        // Добавляем их в matches
                                        for (const cand of blueCandidates) {
                                            finalValidatedMatches.push({
                                                pointA: cand.pointA,
                                                pointB: cand.pointB,
                                                confidence: 0.8,
                                                status: 'final_blue'
                                            });
                                            finalBluePairs++;

                                            // Притягиваем точки
                                            const nodeA = exactGraph.nodes.get(cand.pointA);
                                            const nodeB = existingModel.graph.nodes.get(cand.pointB);
                                            if (nodeA && nodeB) {
                                                const projected = {
                                                    x: nodeA.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
                                                       nodeA.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                                       finalTransform.translation.x,
                                                    y: nodeA.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                                       nodeA.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
                                                       finalTransform.translation.y
                                                };

                                                nodeB.x = (projected.x + nodeB.x) / 2;
                                                nodeB.y = (projected.y + nodeB.y) / 2;
                                                nodeB.confirmationCount++;
                                            }
                                        }

                                        if (this.debug) console.log(`\n✅ Добавлено ${finalBluePairs} финальных синих пар!`);

                                        // Обновляем статистику
                                        matchedPointsA.clear();
                                        matchedPointsB.clear();
                                        for (const match of finalValidatedMatches) {
                                            matchedPointsA.add(match.pointA);
                                            matchedPointsB.add(match.pointB);
                                        }
                                    } else {
                                        if (this.debug) console.log(`\n⚠️ Финальных кандидатов не найдено`);
                                    }

                                    // Обновляем множества
                                    matchedPointsA.clear();
                                    matchedPointsB.clear();
                                    for (const match of finalValidatedMatches) {
                                        if (match?.pointA) matchedPointsA.add(match.pointA);
                                        if (match?.pointB) matchedPointsB.add(match.pointB);
                                    }

                                    // Пересчитываем уникальные точки
                                    const uniqueInModel = allPointsInA
                                        .filter(p => p && p.id && !matchedPointsA.has(p.id))
                                        .map(p => ({
                                            id: p.id,
                                            x: p.x,
                                            y: p.y,
                                            type: 'unique_in_model'
                                        }));

                                    const uniqueInPhoto = points  // ← оригинальные точки фото
                                        .filter(p => !matchedPointsA.has(p.id))
                                        .map(p => {
                                            const projected = {
                                                x: p.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
                                                   p.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                                   finalTransform.translation.x,
                                                y: p.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                                   p.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
                                                   finalTransform.translation.y
                                            };
                                            return {
                                                id: p.id,
                                                x: projected.x,
                                                y: projected.y,
                                                type: 'unique_in_photo'
                                            };
                                        });

                                    if (this.debug) {
                                        console.log(`\n📊 НОВАЯ СТАТИСТИКА:`);
                                        console.log(`   • Сопоставлено точек в A: ${matchedPointsA.size}`);
                                        console.log(`   • Сопоставлено точек в B: ${matchedPointsB.size}`);
                                        console.log(`   • Уникальных в модели: ${uniqueInModel.length}`);
                                        console.log(`   • Уникальных в фото: ${uniqueInPhoto.length}`);
                                    }

                                    // Обновляем uniquePoints в модели
                                    if (existingModel) {
                                        existingModel.uniquePoints = {
                                            model: uniqueInModel,
                                            photo: uniqueInPhoto
                                        };
                                    }
                                } else {
                                    if (this.debug) console.log(`\n⚠️ Ни один кандидат не прошёл проверку`);
                                }
                            } else {
                                if (this.debug) console.log(`\n⚠️ Нет топологически согласованных кандидатов`);
                            }
                        }
                    } catch (blueError) {
                        if (this.debug) {
                            console.log(`\n⚠️ Ошибка в обработке синих точек: ${blueError.message}`);
                            console.log(blueError.stack);
                        }
                    }

// ===== ШАГ 3.10: КОРРЕКЦИЯ ПО BOUNDING BOX =====
if (finalValidatedMatches.length >= 3) {
    console.log(`\n🔧 ЗАПУСК КОРРЕКЦИИ ПО BOUNDING BOX...`);
   
    // Собираем точки
    const photoPoints = [];
    const modelPoints = [];
   
    for (const match of finalValidatedMatches) {
        const photoPoint = exactGraph.nodes.get(match.pointA);
        const modelPoint = existingModel.graph.nodes.get(match.pointB);
        if (photoPoint && modelPoint) {
            photoPoints.push({ x: photoPoint.x, y: photoPoint.y, weight: match.confidence || 0.5 });
            modelPoints.push({ x: modelPoint.x, y: modelPoint.y, weight: match.confidence || 0.5 });
        }
    }
   
    if (photoPoints.length >= 3) {
        // 1. Вычисляем центроиды
        let photoCenterX = 0, photoCenterY = 0;
        let modelCenterX = 0, modelCenterY = 0;
        let totalWeight = 0;
       
        for (let i = 0; i < photoPoints.length; i++) {
            const w = photoPoints[i].weight;
            photoCenterX += photoPoints[i].x * w;
            photoCenterY += photoPoints[i].y * w;
            modelCenterX += modelPoints[i].x * w;
            modelCenterY += modelPoints[i].y * w;
            totalWeight += w;
        }
       
        photoCenterX /= totalWeight;
        photoCenterY /= totalWeight;
        modelCenterX /= totalWeight;
        modelCenterY /= totalWeight;
       
        // 2. 🔥 НОВОЕ: Применяем текущий transform к точкам фото
        const currentRot = finalTransform?.rotation || 0;
        const currentScale = finalTransform?.scale || 1;
       
        const transformedPhotoPoints = photoPoints.map(p => ({
            x: modelCenterX + ((p.x - photoCenterX) * currentScale * Math.cos(currentRot) -
                               (p.y - photoCenterY) * currentScale * Math.sin(currentRot)),
            y: modelCenterY + ((p.x - photoCenterX) * currentScale * Math.sin(currentRot) +
                               (p.y - photoCenterY) * currentScale * Math.cos(currentRot)),
            weight: p.weight
        }));
       
        // 3. Находим bounding box трансформированного фото
        let transMinX = Infinity, transMaxX = -Infinity;
        let transMinY = Infinity, transMaxY = -Infinity;
        for (const p of transformedPhotoPoints) {
            transMinX = Math.min(transMinX, p.x);
            transMaxX = Math.max(transMaxX, p.x);
            transMinY = Math.min(transMinY, p.y);
            transMaxY = Math.max(transMaxY, p.y);
        }
       
        // 4. Находим bounding box модели (прямо по точкам)
        let modelMinX = Infinity, modelMaxX = -Infinity;
        let modelMinY = Infinity, modelMaxY = -Infinity;
        for (const p of modelPoints) {
            modelMinX = Math.min(modelMinX, p.x);
            modelMaxX = Math.max(modelMaxX, p.x);
            modelMinY = Math.min(modelMinY, p.y);
            modelMaxY = Math.max(modelMaxY, p.y);
        }
       
        // 5. Вычисляем размеры
        const transWidth = transMaxX - transMinX;
        const transHeight = transMaxY - transMinY;
        const modelWidth = modelMaxX - modelMinX;
        const modelHeight = modelMaxY - modelMinY;
       
        // 6. Вычисляем масштабы (целевой / текущий)
        const scaleX = modelWidth / transWidth;
        const scaleY = modelHeight / transHeight;
       
        // 7. Ограничиваем
        const safeScaleX = Math.min(Math.max(scaleX, 0.8), 1.2);
        const safeScaleY = Math.min(Math.max(scaleY, 0.8), 1.2);
       
        // 8. Усредняем
        const avgScale = (safeScaleX + safeScaleY) / 2;
       
        console.log(`\n📊 BOUNDING BOX АНАЛИЗ (после трансформации):`);
        console.log(`   Трансформированное фото: ${transWidth.toFixed(1)} x ${transHeight.toFixed(1)}`);
        console.log(`   Модель: ${modelWidth.toFixed(1)} x ${modelHeight.toFixed(1)}`);
        console.log(`   Требуемый масштаб X: ${scaleX.toFixed(3)} → ${safeScaleX.toFixed(3)}`);
        console.log(`   Требуемый масштаб Y: ${scaleY.toFixed(3)} → ${safeScaleY.toFixed(3)}`);
        console.log(`   Усреднённый масштаб: ${avgScale.toFixed(3)}`);
       
        // 9. Применяем коррекцию к transform
        const newTransform = {
            scale: currentScale * avgScale,
            rotation: currentRot,
            translation: {
                x: modelCenterX - (photoCenterX * currentScale * avgScale * Math.cos(currentRot) -
                                   photoCenterY * currentScale * avgScale * Math.sin(currentRot)),
                y: modelCenterY - (photoCenterX * currentScale * avgScale * Math.sin(currentRot) +
                                   photoCenterY * currentScale * avgScale * Math.cos(currentRot))
            },
            scaleX: safeScaleX,
            scaleY: safeScaleY,
            method: 'bounding_box_iterative'
        };
       
        console.log(`\n✅ КОРРЕКЦИЯ ЗАВЕРШЕНА`);
        console.log(`   Новый масштаб: ${newTransform.scale.toFixed(3)} (было ${currentScale.toFixed(3)})`);
        console.log(`   Изменение: ${((newTransform.scale / currentScale - 1) * 100).toFixed(1)}%`);
       
        finalTransform = newTransform;
        if (existingModel) {
            existingModel.transform = finalTransform;
        }
    }
}
                 
                    // ===== ШАГ 4: ОБНОВЛЯЕМ МОДЕЛЬ =====
                    console.log(`\n📤 Передаём в updateModelWithOptimalMatches: ${finalValidatedMatches?.length || 0} точек`);

                    const updateResult = this.updateModelWithOptimalMatches(
    modelIdHint,
    exactGraph,
    finalValidatedMatches || [],
    morphologyMap
);

// 🔥 СЛИВАЕМ ДУБЛИРУЮЩИЕСЯ ТОЧКИ
const mergedCount = this.mergeDuplicatePoints(existingModel.graph, 5);  // с 3px до 5px
if (this.debug && mergedCount > 0) {
    console.log(`\n🔗 Слито ${mergedCount} дублирующихся точек`);
}

// После updateModelWithOptimalMatches

// 🔥 ДИАГНОСТИКА ДУБЛИРУЮЩИХСЯ ТОЧЕК
if (this.debug) {
    const modelPoints = Array.from(existingModel.graph.nodes.values());
    const duplicates = [];
    for (let i = 0; i < modelPoints.length; i++) {
        for (let j = i + 1; j < modelPoints.length; j++) {
            const dx = modelPoints[i].x - modelPoints[j].x;
            const dy = modelPoints[i].y - modelPoints[j].y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 3) { // порог 3px
                duplicates.push({
                    id1: modelPoints[i].id,
                    id2: modelPoints[j].id,
                    dist: dist,
                    pos1: { x: modelPoints[i].x, y: modelPoints[i].y },
                    pos2: { x: modelPoints[j].x, y: modelPoints[j].y }
                });
            }
        }
    }
    if (duplicates.length > 0) {
        console.log(`\n⚠️ ОБНАРУЖЕНО ДУБЛИРУЮЩИХСЯ ТОЧЕК В МОДЕЛИ: ${duplicates.length}`);
        duplicates.slice(0, 10).forEach(d => {
            console.log(`   • ${d.id1.substring(0,12)} и ${d.id2.substring(0,12)}: расстояние ${d.dist.toFixed(1)}px`);
        });
    } else {
        console.log(`\n✅ Дублирующихся точек в модели нет`);
    }
}
                 
                    // Обновляем KNN-граф и подписи
                    if (existingModel) {
                        existingModel.knnGraph = knnGraph;
                        existingModel.knnFingerprints = new Map([...(existingModel.knnFingerprints || []), ...(knnFingerprints || [])]);
                        existingModel.metadata.photoCount = (existingModel.metadata.photoCount || 0) + 1;
                        existingModel.metadata.lastEnhanced = new Date();
                    }

                    // Создаем matchMap для визуализации
                    const { matchMap, modelMatchMap } = this.buildTriangleMatchMap(
                        { matches: finalValidatedMatches || [] },
                        modelIdHint
                    );

                    // 🔥 СОХРАНЯЕМ modelMatchMap В МОДЕЛЬ
                    if (existingModel) {
                        existingModel.lastTriangleResult = {
                            ...(existingModel.lastTriangleResult || {}),
                            modelMatchMap: modelMatchMap,
                            matchMap: matchMap,
                            globalConsistency: consistent?.stats
                        };
                    }

                    if (this.debug) {
                        console.log(`\n🔍 ОТЛАДКА: ${finalValidatedMatches?.length || 0} согласованных точек`);
                        console.log(`   • matchMap передан в визуализацию: ${matchMap?.size || 0} пар`);
                        console.log(`   • modelMatchMap сохранён в модель: ${modelMatchMap?.size || 0} пар`);
                    }

                    // Очищаем неподтверждённые точки
                    const cleanResult = this.cleanUnconfirmedNodes(modelIdHint, 2, 3);
                    this.stats.totalNodesRemoved += cleanResult.removed;
                    this.stats.triangleMatchesCount += finalValidatedMatches?.length || 0;

                    // Статистика
                    const confirmedInModel = finalValidatedMatches?.length || 0;
                    const onlyInModel = (existingModel?.graph?.nodes?.size || 0) - confirmedInModel;
                    const onlyInPhoto = (exactGraph?.nodes?.size || 0) - confirmedInModel;

// 🔥 НОВОЕ: считаем стабильность модели
const uniquePoints = existingModel?.graph?.nodes?.size || 0;
let confirmedPointsCount = 0;  // ← другое имя
for (const node of existingModel.graph.nodes.values()) {
    if ((node.confirmationCount || 0) >= 2) confirmedPointsCount++;
}
const stability = uniquePoints > 0 ? (confirmedPointsCount / uniquePoints * 100).toFixed(1) : 0;

console.log(`\n📊 СТАТИСТИКА МОДЕЛИ:`);
console.log(`   • 🟠 Подтвержденных (2+ фото): ${confirmedInModel}`);
console.log(`   • 🔵 Только в модели: ${onlyInModel}`);
console.log(`   • 🔵 Только в новом фото: ${onlyInPhoto}`);
console.log(`   • Всего в модели теперь: ${uniquePoints}`);
console.log(`\n🏗 КАЧЕСТВО МОДЕЛИ:`);
console.log(`   • Уникальных точек: ${uniquePoints}`);
console.log(`   • Подтверждено (2+ фото): ${confirmedPointsCount}`);
console.log(`   • Стабильность: ${stability}%`);

                    this.photoToModel.set(photoId, modelIdHint);

                    return {
                        status: 'consistent_anchors',
                        modelId: modelIdHint,
                        similarity: triangleResult?.similarity || 0,
                        centerMatches: finalMatches?.length || 0,
                        totalMatches: finalMatches?.length || 0,
                        newNodesAdded: updateResult?.newNodesAdded || 0,
                        nodesRemoved: cleanResult?.removed || 0,
                        matchMap: matchMap,
                        modelMatchMap: modelMatchMap,
                        consistency: consistent?.stats,
                        originalPhotoPoints: points,
                        transform: finalTransform,
                        structures: structures.map(s => ({
                            id: s.id,
                            triangleCount: s.triangleIds.size,
                            pointCount: s.pointIds.size,
                            confidence: s.calculateConfidence(),
                            transform: s.transform
                        })),
                        structureCount: structures.length,
                        message: `Построено ${structures.length} структур, согласовано: ${finalValidatedMatches.length} точек`
                    };
                } else {
                    console.log(`\n⚠️ Финальная валидация не удалась`);
                    return {
                        status: 'validation_failed',
                        modelId: modelIdHint,
                        similarity: triangleResult?.similarity || 0,
                        message: 'Финальная валидация не удалась'
                    };
                }
            } else {
                if (this.debug) console.log(`\n⚠️ Треугольное сравнение дало только ${triangleResult.count} пар - пропускаем`);
            }
        } else {
            if (this.debug) {
                console.log(`\n❌ МОДЕЛЬ НЕ НАЙДЕНА, создаю новую...`);
                console.log(`   modelIdHint: ${modelIdHint}`);
                console.log(`   models.has: ${this.models.has(modelIdHint)}`);
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
    * @param {Array} anchors - согласованные якоря (точки)
    * @param {Array} allMatches - все найденные matches (45 точек)
    * @param {Object} graphA - граф первого следа
    * @param {Object} graphB - граф второго следа
    * @param {Map} morphologyMap - морфология точек первого следа
    * @param {Map} modelMorphology - морфология точек модели
    * @returns {Object} - достроенные соответствия
    */
    twoStagePositioning(anchors, allMatches, graphA, graphB, morphologyMap, modelMorphology) {
        if (this.debug) console.log(`\n🔧 ДВУХЭТАПНАЯ ДОСТРОЙКА ТОЧЕК`);

        // ===== ШАГ 1: Разделяем точки на категории =====
        if (this.debug) console.log(`\n📊 РАЗДЕЛЕНИЕ ТОЧЕК ПО КАТЕГОРИЯМ:`);

        const anchorSet = new Set(anchors.map(a => a.pointA));
        const allPointsA = new Set(allMatches.map(m => m.pointA));

        const confusedPoints = []; // точки, которые есть в matches, но не в anchors
        for (const match of allMatches) {
            if (!anchorSet.has(match.pointA)) {
                confusedPoints.push(match);
            }
        }

        if (this.debug) {
            console.log(`   • Якорей: ${anchors.length} точек`);
            console.log(`   • Путающихся кандидатов: ${confusedPoints.length} точек`);
        }

        // ===== ШАГ 2: Строим карту якорей для быстрого доступа =====
        const anchorMap = new Map(); // pointA -> { pointB, confidence }
        for (const anchor of anchors) {
            anchorMap.set(anchor.pointA, {
                pointB: anchor.pointB,
                confidence: anchor.confidence
            });
        }

        // ===== ШАГ 3: УТОЧНЕНИЕ ПУТАЮЩИХСЯ ТОЧЕК =====
        if (this.debug) console.log(`\n🔍 ЭТАП 1: УТОЧНЕНИЕ ПУТАЮЩИХСЯ ТОЧЕК`);

        const confirmedFromConfused = [];
        const stillConfused = [];

        for (const match of confusedPoints) {
            const pointA = match.pointA;
            const pointB = match.pointB;

            // Находим всех соседей-якорей для точки A
            const neighborsA = GraphUtils.findNodeNeighbors(pointA, graphA);
            const anchorNeighborsA = neighborsA.filter(n => anchorMap.has(n.id));

            // Находим всех соседей-якорей для точки B
            const neighborsB = GraphUtils.findNodeNeighbors(pointB, graphB);
            const anchorNeighborsB = neighborsB.filter(n =>
                Array.from(anchorMap.values()).some(a => a.pointB === n.id)
            );

            if (anchorNeighborsA.length === 0 || anchorNeighborsB.length === 0) {
                stillConfused.push(match);
                continue;
            }

            // Проверяем расстояния до якорей в графе
            let consistent = true;
            const minNeighbors = Math.min(anchorNeighborsA.length, anchorNeighborsB.length);

            for (let i = 0; i < minNeighbors; i++) {
                const nA = anchorNeighborsA[i];
                const nB = anchorNeighborsB[i];

                const distA = GraphUtils.graphDistance(pointA, nA.id, graphA);
                const distB = this.graphDistance(pointB, nB.id, graphB);

                if (Math.abs(distA - distB) > 1) {
                    consistent = false;
                    break;
                }
            }

            if (consistent) {
                confirmedFromConfused.push({
                    pointA: pointA,
                    pointB: pointB,
                    confidence: match.confidence * 0.9 // чуть снижаем уверенность
                });
                if (this.debug) console.log(`   ✅ Уточнена: ${pointA.substring(0,12)} ↔ ${pointB.substring(0,12)}`);
            } else {
                stillConfused.push(match);
            }
        }

        if (this.debug) {
            console.log(`\n📊 ИТОГ ЭТАПА 1:`);
            console.log(`   • Уточнено: ${confirmedFromConfused.length} точек`);
            console.log(`   • Осталось путающихся: ${stillConfused.length} точек`);
        }

        // ===== ШАГ 4: ПОДГОТОВКА ЯКОРЕЙ ДЛЯ ДОСТРОЙКИ =====
        const allConfirmed = [...anchors, ...confirmedFromConfused];
        if (this.debug) console.log(`\n🔧 Всего подтвержденных точек для достройки: ${allConfirmed.length}`);

        // Создаем карту подтвержденных соответствий
        const confirmedMap = new Map();
        for (const point of allConfirmed) {
            confirmedMap.set(point.pointA, point.pointB);
        }

        // ===== ШАГ 5: ДОСТРОЙКА НОВЫХ ТОЧЕК =====
        if (this.debug) console.log(`\n🔍 ЭТАП 2: ДОСТРОЙКА НОВЫХ ТОЧЕК`);

        // Находим все точки, которые есть только в первом следе
        const allPointsInA = Array.from(graphA.nodes.keys());
        const pointsToPosition = allPointsInA.filter(p => !confirmedMap.has(p));

        if (this.debug) console.log(`   • Точек для достройки: ${pointsToPosition.length}`);

        // Создаем карту якорей для RelativePositioning
        const anchorMatches = new Map();
        for (const point of allConfirmed) {
            anchorMatches.set(point.pointA, {
                modelId: point.pointB,
                confidence: point.confidence
            });
        }

        // Запускаем RelativePositioning
        const positionedMatches = this.relativePositioning.positionPoints(
            graphA,
            graphB,
            anchorMatches,
            morphologyMap,
            modelMorphology,
            { confidenceThreshold: 0.5 }
        );

        if (this.debug) console.log(`\n📊 ИТОГ ЭТАПА 2:`);
        if (this.debug) console.log(`   • Достроено: ${positionedMatches.size} точек`);

        // ===== ШАГ 6: ФОРМИРУЕМ ФИНАЛЬНЫЙ РЕЗУЛЬТАТ =====
        const finalMatches = [];

        // Добавляем все подтвержденные точки
        for (const point of allConfirmed) {
            finalMatches.push({
                pointA: point.pointA,
                pointB: point.pointB,
                confidence: point.confidence
            });
        }

        // Добавляем достроенные точки
        for (const [pointA, match] of positionedMatches) {
            // Проверяем, что точка ещё не добавлена
            if (!confirmedMap.has(pointA)) {
                finalMatches.push({
                    pointA: pointA,
                    pointB: match.modelId,
                    confidence: match.confidence
                });
            }
        }

        if (this.debug) {
            console.log(`\n🎯 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ:`);
            console.log(`   • Всего соответствий: ${finalMatches.length} точек`);
            console.log(`   • Из них якорей: ${anchors.length}`);
            console.log(`   • Уточнено путающихся: ${confirmedFromConfused.length}`);
            console.log(`   • Достроено новых: ${finalMatches.length - allConfirmed.length}`);
        }

        return finalMatches;
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
* Получает граничные рёбра структуры
*/
getBoundaryEdgesFromStructure(structure) {
    const edges = [];
    for (const [edgeKey, edgeData] of structure.boundaryEdges) {
        edges.push({
            key: edgeKey,
            v1: edgeData.v1,
            v2: edgeData.v2
        });
    }
    return edges;
}

/**
* Находит соседний треугольник в графе по ребру
*/
findNeighborTriangleInGraph(edge, allTriangles, structure) {
    const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');

    for (const triangle of allTriangles) {
        if (structure.triangleIds.has(triangle.id)) continue;
        if (!triangle.edges) continue;

        for (const triEdge of triangle.edges) {
            if (!triEdge.v1 || !triEdge.v2) continue;
            const triEdgeKey = [triEdge.v1.id, triEdge.v2.id].sort().join('--');
            if (triEdgeKey === edgeKey) {
                // 🔥 ВОЗВРАЩАЕМ ТРЕУГОЛЬНИК С ГАРАНТИРОВАННЫМИ ПОЛЯМИ
                return {
                    id: triangle.id,
                    p1: triangle.p1,
                    p2: triangle.p2,
                    p3: triangle.p3,
                    edges: triangle.edges,
                    confidence: triangle.confidence || 0.5
                };
            }
        }
    }
    return null;
}

/**
* Пытается добавить треугольник по геометрии (без якорей)
*/
tryAddGeometricTriangle(triangle, structure, graphA, graphB, morphologyMap, modelMorphology) {
    if (!triangle || !triangle.edges) return false;

    const commonEdge = this.findCommonEdgeInTriangle(triangle, structure);
    if (!commonEdge) return false;

    const newPoint = [triangle.p1, triangle.p2, triangle.p3].find(p =>
        p.id !== commonEdge.v1.id && p.id !== commonEdge.v2.id
    );
    if (!newPoint) return false;

    const photoA = graphA.nodes.get(commonEdge.v1.id);
    const photoB = graphA.nodes.get(commonEdge.v2.id);
    const photoC = graphA.nodes.get(newPoint.id);
    if (!photoA || !photoB || !photoC) return false;

    let modelA = this.getModelPointFromStructure(photoA.id, structure);
    let modelB = this.getModelPointFromStructure(photoB.id, structure);
    if (!modelA || !modelB) return false;

    if (typeof modelA === 'string') {
        const found = graphB.nodes.get(modelA);
        if (!found) return false;
        modelA = found;
    }
    if (typeof modelB === 'string') {
        const found = graphB.nodes.get(modelB);
        if (!found) return false;
        modelB = found;
    }

    let modelC;
    if (structure.transform) {
        const projected = GeometryUtils.applyTransform(photoC, structure.transform);
        modelC = { x: projected.x, y: projected.y };
    } else {
        return false;
    }

    // ========== ПРОВЕРКИ ==========
    const anglePhoto = GeometryUtils.angleBetween(photoA, photoC, photoB);
    const angleModel = this.calcAngleInTriangle(modelA, modelC, modelB);
    const angleDiff = Math.abs(anglePhoto - angleModel);
    const angleTolerance = Math.min(25, 12 + Math.floor(structure.triangleIds.size / 3));

    if (angleDiff > angleTolerance) {
        if (this.debug) console.log(`      ❌ Угол: ${angleDiff.toFixed(0)}° > ${angleTolerance}°`);
        return false;
    }

    const sidePhoto1 = GeometryUtils.distance(photoA, photoC);
    const sidePhoto2 = this.calcDistance(photoB, photoC);
    const sidePhoto3 = this.calcDistance(photoA, photoB);
    const sideModel1 = this.calcDistance(modelA, modelC);
    const sideModel2 = this.calcDistance(modelB, modelC);
    const sideModel3 = this.calcDistance(modelA, modelB);

    const ratioPhoto = sidePhoto1 / sidePhoto2;
    const ratioModel = sideModel1 / sideModel2;
    const ratioDiff = Math.abs(ratioPhoto - ratioModel) / Math.max(ratioModel, 0.001);

    if (ratioDiff > 0.25) {
        if (this.debug) console.log(`      ❌ Пропорции: ${(ratioDiff*100).toFixed(0)}% > 25%`);
        return false;
    }

    const sumPhoto = sidePhoto1 + sidePhoto2 + sidePhoto3;
    const sumModel = sideModel1 + sideModel2 + sideModel3;
    const scaleEstimate = sumModel / sumPhoto;
    const scaleDiff = Math.abs(scaleEstimate - structure.transform.scale) / Math.max(structure.transform.scale, 0.001);

    if (scaleDiff > 0.2) {
        if (this.debug) console.log(`      ❌ Масштаб: ${(scaleDiff*100).toFixed(0)}% > 20%`);
        return false;
    }

    // Морфология (опционально)
    const photoMorph = morphologyMap?.get(photoC.id);
    const modelIdForMorph = modelC.id || (modelC.pointB || modelC);
    const modelMorph = modelMorphology?.get(modelIdForMorph);

    let morphScore = 0.5;
    if (photoMorph && modelMorph) {
        let score = 0, checks = 0;
        if (photoMorph.eccentricity && modelMorph.eccentricity) {
            score += Math.min(photoMorph.eccentricity, modelMorph.eccentricity) / Math.max(photoMorph.eccentricity, modelMorph.eccentricity);
            checks++;
        }
        if (photoMorph.asymmetry && modelMorph.asymmetry) {
            score += Math.min(photoMorph.asymmetry, modelMorph.asymmetry) / Math.max(photoMorph.asymmetry, modelMorph.asymmetry);
            checks++;
        }
        if (photoMorph.compactness && modelMorph.compactness) {
            score += Math.min(photoMorph.compactness, modelMorph.compactness) / Math.max(photoMorph.compactness, modelMorph.compactness);
            checks++;
        }
        morphScore = checks > 0 ? score / checks : 0.5;
        if (morphScore < 0.6) {
            if (this.debug) console.log(`      ❌ Морфология: ${(morphScore*100).toFixed(0)}% < 60%`);
            return false;
        }
    }

    // ========== УСПЕХ ==========
    structure.addTriangle(triangle);

    const anchors = structure.getAnchors();
    if (anchors.length >= 3) {
        const newTransform = this.validator.calculateTransform(anchors, graphA, graphB);
        if (newTransform) structure.transform = newTransform;
    }

    // 🔥 ТОЛЬКО УСПЕХ (компактно)
    if (this.debug) {
        console.log(`      ✅ +1 (угол ${angleDiff.toFixed(0)}°, проп ${(ratioDiff*100).toFixed(0)}%, масшт ${(scaleDiff*100).toFixed(0)}%)`);
    }

    return true;
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
* Находит общее ребро между треугольником и структурой
*/
findCommonEdgeInTriangle(triangle, structure) {
    for (const edge of triangle.edges) {
        if (structure.pointIds.has(edge.v1.id) && structure.pointIds.has(edge.v2.id)) {
            // 🔥 ДИАГНОСТИКА
            if (this.debug) {
                console.log(`      🔍 Найдено общее ребро:`);
                console.log(`         v1: ${edge.v1.id.substring(0,12)} (${edge.v1?.x},${edge.v1?.y})`);
                console.log(`         v2: ${edge.v2.id.substring(0,12)} (${edge.v2?.x},${edge.v2?.y})`);
            }
            return edge;
        }
    }
    return null;
}

/**
* Получает модель точки из структуры
*/
getModelPointFromStructure(pointId, structure) {
    const anchors = structure.getAnchors();
    for (const anchor of anchors) {
        if (anchor.pointA === pointId) {
            return anchor.pointB;
        }
    }
    return null;
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
* Сравнивает два треугольника геометрически
*/
compareTrianglesGeometrically(tPhoto, tModel, structure) {
    // ========== 1. УГЛЫ ==========
    const anglePhoto1 = this.calcAngleInTriangle(tPhoto.p1, tPhoto.p2, tPhoto.p3);
    const anglePhoto2 = this.calcAngleInTriangle(tPhoto.p2, tPhoto.p3, tPhoto.p1);
    const anglePhoto3 = this.calcAngleInTriangle(tPhoto.p3, tPhoto.p1, tPhoto.p2);
   
    const angleModel1 = this.calcAngleInTriangle(tModel.p1, tModel.p2, tModel.p3);
    const angleModel2 = this.calcAngleInTriangle(tModel.p2, tModel.p3, tModel.p1);
    const angleModel3 = this.calcAngleInTriangle(tModel.p3, tModel.p1, tModel.p2);
   
    // Среднее отклонение углов
    const angleDiff = (Math.abs(anglePhoto1 - angleModel1) +
                       Math.abs(anglePhoto2 - angleModel2) +
                       Math.abs(anglePhoto3 - angleModel3)) / 3;
   
    const angleTolerance = Math.min(20, 10 + Math.floor(structure.triangleIds.size / 5));
    if (angleDiff > angleTolerance) {
        if (this.debug) {
            console.log(`         ❌ Углы: среднее отклонение ${angleDiff.toFixed(1)}° > ${angleTolerance}°`);
        }
        return false;
    }
   
    // ========== 2. ПРОПОРЦИИ СТОРОН ==========
    const sidesPhoto = [
        this.calcDistance(tPhoto.p1, tPhoto.p2),
        this.calcDistance(tPhoto.p2, tPhoto.p3),
        this.calcDistance(tPhoto.p3, tPhoto.p1)
    ].sort((a, b) => a - b);
   
    const sidesModel = [
        this.calcDistance(tModel.p1, tModel.p2),
        this.calcDistance(tModel.p2, tModel.p3),
        this.calcDistance(tModel.p3, tModel.p1)
    ].sort((a, b) => a - b);
   
    // Отношения сторон (нормированные)
    const ratiosPhoto = [sidesPhoto[0] / sidesPhoto[2], sidesPhoto[1] / sidesPhoto[2]];
    const ratiosModel = [sidesModel[0] / sidesModel[2], sidesModel[1] / sidesModel[2]];
   
    const ratioDiff = (Math.abs(ratiosPhoto[0] - ratiosModel[0]) +
                       Math.abs(ratiosPhoto[1] - ratiosModel[1])) / 2;
   
    const ratioTolerance = 0.2; // 20%
    if (ratioDiff > ratioTolerance) {
        if (this.debug) {
            console.log(`         ❌ Пропорции: отклонение ${(ratioDiff*100).toFixed(1)}% > ${ratioTolerance*100}%`);
        }
        return false;
    }
   
    // ========== 3. МАСШТАБ ==========
    const scalePhoto = (sidesPhoto[0] + sidesPhoto[1] + sidesPhoto[2]) / 3;
    const scaleModel = (sidesModel[0] + sidesModel[1] + sidesModel[2]) / 3;
    const scaleEstimate = scaleModel / scalePhoto;
    const scaleDiff = Math.abs(scaleEstimate - structure.transform.scale) / structure.transform.scale;
   
    const scaleTolerance = 0.2; // 20%
    if (scaleDiff > scaleTolerance) {
        if (this.debug) {
            console.log(`         ❌ Масштаб: отклонение ${(scaleDiff*100).toFixed(1)}% > ${scaleTolerance*100}%`);
        }
        return false;
    }
   
    if (this.debug) {
        console.log(`         ✅ Углы: ${angleDiff.toFixed(1)}° | Пропорции: ${(ratioDiff*100).toFixed(1)}% | Масштаб: ${(scaleDiff*100).toFixed(1)}%`);
    }
   
    return true;
}

/**
* Находит ближайшую точку в модели по координатам
*/
findNearestModelPoint(point, graphB) {
    let bestPoint = null;
    let bestDist = Infinity;
   
    for (const [id, modelPoint] of graphB.nodes) {
        const dx = modelPoint.x - point.x;
        const dy = modelPoint.y - point.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
       
        if (dist < bestDist && dist < 15) { // порог 15px
            bestDist = dist;
            bestPoint = modelPoint;
        }
    }
   
    return bestPoint;
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
