// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ МУЛЬТИ-МОДЕЛЬНЫЙ АККУМУЛЯТОР - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ

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
        if (this.debug) {
            console.log(`   🔥 Режим: ${this.fastMode ? 'БЫСТРЫЙ' : 'ПОЛНЫЙ'}`);
            console.log(`   🔷 Порог сходства: ${this.similarityThreshold * 100}%`);
        }
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    async processPoints(points, options = {}) {
        console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК...`);

        const photoId = options.photoId || `photo_${Date.now()}`;
        const contours = options.contours || [];
        const modelIdHint = options.modelId;

        if (this.debug) {
            console.log(`\n🔍 ОТЛАДКА processPoints:`);
            console.log(`   • photoId: ${photoId}`);
            console.log(`   • modelIdHint: ${modelIdHint}`);
            console.log(`   • models.has: ${this.models.has(modelIdHint)}`);
        }

        // 1. Строим графы
        const exactGraph = this.graphBuilder.buildGraph(points, options.source || 'photo');
        const knnGraph = this.knnBuilder.buildGraph(points, options.source || 'photo_knn');
        const morphologyMap = this.morphologyEncoder.encode(points, contours);
        const knnFingerprints = this.fingerprinter.computeGraphFingerprints(knnGraph);

        // 🔥 2. Если есть существующая модель - пробуем треугольное сравнение
        if (modelIdHint && this.models.has(modelIdHint)) {
            if (this.debug) console.log(`\n✅ НАЙДЕНА МОДЕЛЬ, запускаю треугольный матчер...`);

            const existingModel = this.models.get(modelIdHint);

            // Создаем временную модель из нового фото
            const tempModel = {
                graph: exactGraph,
                morphologyMap: morphologyMap,
                metadata: { name: 'temp' }
            };

            if (this.debug) console.log(`\n🔍 ТРЕУГОЛЬНОЕ СРАВНЕНИЕ с моделью ${modelIdHint.slice(0,12)}...`);
            const triangleResult = await this.compareByTriangleMatching(tempModel, existingModel);

            if (triangleResult.count >= 1) {
                console.log(`\n✅ Найдено ${triangleResult.count} треугольных соответствий!`);

                // ===== ШАГ 1: СОЗДАЁМ ВРЕМЕННЫЕ ЯКОРЯ ИЗ MATCHES =====
                if (this.debug) console.log(`\n🔍 СОЗДАНИЕ ВРЕМЕННЫХ ЯКОРЕЙ ДЛЯ ГЛОБАЛЬНОЙ ПРОВЕРКИ`);

                const tempAnchors = [];
                const matches = triangleResult.matches;

                for (let i = 0; i < matches.length; i += 3) {
                    if (i + 2 < matches.length) {
                        const group = [matches[i], matches[i+1], matches[i+2]];
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

                if (this.debug) console.log(`   • Создано временных якорей: ${tempAnchors.length}`);

                // Получаем треугольники из графов
                if (this.debug) console.log(`\n🔍 ИЗВЛЕЧЕНИЕ ТРЕУГОЛЬНИКОВ ИЗ ГРАФОВ`);
                const trianglesA = this.extractTrianglesFromGraph(exactGraph);
                const trianglesB = this.extractTrianglesFromGraph(existingModel.graph);

                if (this.debug) {
                    console.log(`   • Треугольников в A: ${trianglesA.length}`);
                    console.log(`   • Треугольников в B: ${trianglesB.length}`);
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

                console.log(`\n📊 РЕЗУЛЬТАТ ДОСТРОЙКИ:`);
                console.log(`   • Было matches: ${triangleResult.matches.length}`);
                console.log(`   • Стало matches: ${finalMatches.length}`);

                // ===== ШАГ 3.5: ПАРАЛЛЕЛЬНАЯ ВАЛИДАЦИЯ =====
                if (this.debug) console.log(`\n🔄 ЗАПУСК ПАРАЛЛЕЛЬНОЙ ВАЛИДАЦИИ`);

                const ValidationModule = require('../validation/ValidationModule');
                const validator = new ValidationModule({
                    debug: this.debug,
                    positionThreshold: 0.15,
                    morphologyThreshold: 0.85
                });

                const anchorsForValidation = consistent.points.map(p => ({
                    pointA: p.pointA,
                    pointB: p.pointB,
                    confidence: p.confidence
                }));

                if (this.debug) console.log(`\n🔍 ЭТАП 1: Вычисление базового transform по ${anchorsForValidation.length} надёжным якорям`);

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

                console.log(`\n📐 БАЗОВЫЙ TRANSFORM (${anchorsForValidation.length} якорей):`);
                console.log(`   • Масштаб: ${baseTransform.scale.toFixed(3)}`);
                console.log(`   • Поворот: ${(baseTransform.rotation * 180 / Math.PI).toFixed(1)}°`);
                console.log(`   • Сдвиг: (${baseTransform.translation.x.toFixed(1)}, ${baseTransform.translation.y.toFixed(1)})`);

                // 🔥 ЭТАП 2: Итеративное натягивание
                if (this.debug) console.log(`\n🔍 ЭТАП 2: Итеративное натягивание ${finalMatches.length} кандидатов`);

                let workingAnchors = [...anchorsForValidation];
                let workingTransform = baseTransform;
                let addedPoints = [];
                let rejectedPoints = [];

                const isPointConsistent = (pointA, pointB, transform) => {
                    const nodeA = exactGraph.nodes.get(pointA);
                    const nodeB = existingModel.graph.nodes.get(pointB);
                    if (!nodeA || !nodeB) return false;

                    const projected = validator.applyTransform(nodeA, transform);
                    const dx = projected.x - nodeB.x;
                    const dy = projected.y - nodeB.y;
                    const error = Math.sqrt(dx*dx + dy*dy);
                    const footprintSize = validator.getFootprintSize(Array.from(existingModel.graph.nodes.values()));
                    return (error / footprintSize) < 0.05;
                };

                const sortedCandidates = [...finalMatches].sort((a, b) => b.confidence - a.confidence);

                for (const candidate of sortedCandidates) {
                    if (this.debug) console.log(`\n   Проверка кандидата ${candidate.pointA.substring(0,12)}...`);

                    const testAnchors = [...workingAnchors, {
                        pointA: candidate.pointA,
                        pointB: candidate.pointB,
                        confidence: candidate.confidence
                    }];

                    const testTransform = validator.calculateTransform(
                        testAnchors,
                        exactGraph,
                        existingModel.graph
                    );

                    if (!testTransform) {
                        rejectedPoints.push({ ...candidate, reason: 'transform_failed' });
                        continue;
                    }

                    let allConsistent = true;
                    for (const anchor of workingAnchors) {
                        if (!isPointConsistent(anchor.pointA, anchor.pointB, testTransform)) {
                            allConsistent = false;
                            break;
                        }
                    }

                    if (allConsistent && isPointConsistent(candidate.pointA, candidate.pointB, testTransform)) {
                        if (this.debug) console.log(`   ✅ Кандидат согласован! Добавляю в якоря`);
                        workingAnchors.push({
                            pointA: candidate.pointA,
                            pointB: candidate.pointB,
                            confidence: candidate.confidence
                        });
                        workingTransform = testTransform;
                        addedPoints.push(candidate);
                    } else {
                        rejectedPoints.push({ ...candidate, reason: 'inconsistent' });
                    }
                }

                console.log(`\n📊 РЕЗУЛЬТАТ ИТЕРАТИВНОГО НАТЯГИВАНИЯ:`);
                console.log(`   • Было якорей: ${anchorsForValidation.length}`);
                console.log(`   • Добавлено: ${addedPoints.length}`);
                console.log(`   • Отвергнуто: ${rejectedPoints.length}`);
                console.log(`   • ВСЕГО: ${workingAnchors.length} точек`);

                // 🔥 ЭТАП 3: Финальная валидация
                if (this.debug) console.log(`\n🔍 ЭТАП 3: Финальная валидация с уточнённым transform`);

                const finalValidationResult = validator.validateAll(
                    exactGraph,
                    existingModel.graph,
                    workingAnchors,
                    morphologyMap,
                    existingModel.morphologyMap
                );

                if (finalValidationResult.success) {
                    const validated = finalValidationResult.results;
                    const finalTransform = finalValidationResult.transform;

                    if (existingModel) existingModel.transform = finalTransform;

                    console.log(`\n💾 ФИНАЛЬНЫЙ TRANSFORM СОХРАНЁН В МОДЕЛЬ:`);
                    console.log(`   • Масштаб: ${finalTransform?.scale.toFixed(3) || 'нет'}`);
                    console.log(`   • Поворот: ${finalTransform ? (finalTransform.rotation * 180 / Math.PI).toFixed(1) : 'нет'}°`);
                    console.log(`   • Сдвиг: ${finalTransform ? `(${finalTransform.translation.x.toFixed(1)}, ${finalTransform.translation.y.toFixed(1)})` : 'нет'}`);

                    let finalValidatedMatches = [
                        ...anchorsForValidation.map(a => ({
                            pointA: a.pointA,
                            pointB: a.pointB,
                            confidence: a.confidence,
                            status: 'anchor'
                        })),
                        ...addedPoints.map(a => ({
                            pointA: a.pointA,
                            pointB: a.pointB,
                            confidence: a.confidence,
                            status: 'validator_found'
                        }))
                    ];

                    console.log(`\n✅ ИТОГО ПОДТВЕРЖДЕННЫХ ТОЧЕК: ${finalValidatedMatches.length}`);

                    // ===== ШАГ 3.6: ФИНАЛЬНОЕ ПРИТЯГИВАНИЕ =====
                    if (this.debug) console.log(`\n🧲 ЗАПУСК ФИНАЛЬНОГО ПРИТЯГИВАНИЯ БЛИЗКИХ ТОЧЕК`);

                    const magneticPull = (matches, threshold = 25) => {
                        const pulledMatches = [...matches];
                        let pulledCount = 0;

                        for (let i = 0; i < pulledMatches.length; i++) {
                            const match = pulledMatches[i];
                            const photoPoint = exactGraph?.nodes?.get(match.pointA);
                            const modelPoint = existingModel?.graph?.nodes?.get(match.pointB);
                            if (!photoPoint || !modelPoint) continue;

                            const projected = {
                                x: photoPoint.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
                                   photoPoint.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                   finalTransform.translation.x,
                                y: photoPoint.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                   photoPoint.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
                                   finalTransform.translation.y
                            };

                            const dist = Math.hypot(projected.x - modelPoint.x, projected.y - modelPoint.y);
                            if (dist < threshold && dist > 0.5) {
                                if (this.debug) console.log(`   🧲 Точки рядом (${dist.toFixed(1)}px)`);
                                const weight = match.confidence || 0.5;
                                modelPoint.x = (projected.x * weight + modelPoint.x * (1 - weight));
                                modelPoint.y = (projected.y * weight + modelPoint.y * (1 - weight));
                                modelPoint.confirmationCount++;
                                pulledCount++;
                            }
                        }
                        return { pulledMatches, pulledCount };
                    };

                    if (finalTransform && finalValidatedMatches.length > 0) {
                        const { pulledCount } = magneticPull(finalValidatedMatches, 25);
                        if (pulledCount > 0) console.log(`\n✅ Притянуто ${pulledCount} точек!`);
                    }

                    // ===== ШАГ 3.7: ПОДГОТОВКА УНИКАЛЬНЫХ ТОЧЕК =====
                    if (this.debug) console.log(`\n📊 ПОДГОТОВКА УНИКАЛЬНЫХ ТОЧЕК`);

                    const allPointsInA = Array.from(exactGraph?.nodes?.values() || []);
                    const allPointsInB = Array.from(existingModel?.graph?.nodes?.values() || []);

                    const matchedPointsA = new Set(finalValidatedMatches?.map(m => m?.pointA) || []);
                    const matchedPointsB = new Set(finalValidatedMatches?.map(m => m?.pointB) || []);

                    if (this.debug) {
                        console.log(`   • Всего точек в A: ${allPointsInA.length}`);
                        console.log(`   • Всего точек в B: ${allPointsInB.length}`);
                        console.log(`   • Сопоставлено точек в A: ${matchedPointsA.size}`);
                        console.log(`   • Сопоставлено точек в B: ${matchedPointsB.size}`);
                    }

                    // ===== ШАГ 3.8: ПОИСК НОВЫХ ПАР =====
                    if (this.debug) console.log(`\n🔍 ПОИСК НОВЫХ ПАР СРЕДИ НЕСОПОСТАВЛЕННЫХ ТОЧЕК`);

                    const unmatchedModelPoints = new Map();
                    for (const [id, node] of existingModel.graph.nodes) {
                        if (!matchedPointsB.has(id)) unmatchedModelPoints.set(id, node);
                    }

                    const unmatchedPhotoPoints = points.filter(p => !matchedPointsA.has(p.id));

                    if (this.debug) {
                        console.log(`   • Несопоставленных точек модели: ${unmatchedModelPoints.size}`);
                        console.log(`   • Несопоставленных точек фото: ${unmatchedPhotoPoints.length}`);
                    }

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
                            const dist = Math.hypot(projected.x - modelPoint.x, projected.y - modelPoint.y);
                            if (dist < bestDist && dist < 15) {
                                bestDist = dist;
                                bestMatch = { modelId, modelPoint };
                            }
                        }

                        if (bestMatch) {
                            const photoMorph = morphologyMap.get(photoPoint.id);
                            const modelMorph = existingModel.morphologyMap.get(bestMatch.modelId);
                            let morphScore = 0.5;

                            if (photoMorph && modelMorph) {
                                let checks = 0;
                                if (photoMorph.eccentricity && modelMorph.eccentricity) {
                                    morphScore += Math.min(photoMorph.eccentricity, modelMorph.eccentricity) /
                                                  Math.max(photoMorph.eccentricity, modelMorph.eccentricity);
                                    checks++;
                                }
                                if (photoMorph.asymmetry && modelMorph.asymmetry) {
                                    morphScore += Math.min(photoMorph.asymmetry, modelMorph.asymmetry) /
                                                  Math.max(photoMorph.asymmetry, modelMorph.asymmetry);
                                    checks++;
                                }
                                morphScore = checks > 0 ? morphScore / checks : 0.5;
                            }

                            if (morphScore > 0.7) {
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

                    if (newPairsFound > 0) {
                        console.log(`\n✅ Найдено ${newPairsFound} новых пар среди несопоставленных точек!`);
                        finalValidatedMatches = [...finalValidatedMatches, ...newPairs];

                        matchedPointsA.clear();
                        matchedPointsB.clear();
                        for (const match of finalValidatedMatches) {
                            matchedPointsA.add(match.pointA);
                            matchedPointsB.add(match.pointB);
                        }
                    }

                    const uniqueInModel = allPointsInA
                        .filter(p => p && p.id && !matchedPointsA.has(p.id))
                        .map(p => ({ id: p.id, x: p.x, y: p.y, type: 'unique_in_model' }));

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
                            return { id: p.id, x: projected.x, y: projected.y, type: 'unique_in_photo' };
                        });

                    console.log(`\n📊 УНИКАЛЬНЫХ ТОЧЕК:`);
                    console.log(`   • В модели: ${uniqueInModel.length}`);
                    console.log(`   • В фото: ${uniqueInPhoto.length}`);

                    this.lastUniqueInPhoto = uniqueInPhoto;

                    if (existingModel) {
                        existingModel.uniquePoints = { model: uniqueInModel, photo: uniqueInPhoto };
                    }

                    // ===== ШАГ 3.9: ПОЛНЫЙ ЦИКЛ ДЛЯ СИНИХ ТОЧЕК =====
                    if (this.debug) console.log(`\n🔷 ПОЛНЫЙ ЦИКЛ ДЛЯ СИНИХ ТОЧЕК`);

                    try {
                        const remainingPhotoPoints = unmatchedPhotoPoints.filter(p => !matchedPointsA.has(p?.id));
                        const remainingModelPoints = Array.from(existingModel?.graph?.nodes?.values() || [])
                            .filter(p => !matchedPointsB.has(p?.id));

                        if (this.debug) {
                            console.log(`   • Синих точек фото: ${remainingPhotoPoints.length}`);
                            console.log(`   • Синих точек модели: ${remainingModelPoints.length}`);
                        }

                        if (remainingPhotoPoints.length > 0 && remainingModelPoints.length > 0) {
                            let blueCandidates = [];

                            for (const photoPoint of remainingPhotoPoints) {
                                if (!photoPoint?.id) continue;

                                const projected = {
                                    x: photoPoint.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
                                       photoPoint.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                       finalTransform.translation.x,
                                    y: photoPoint.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                       photoPoint.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
                                       finalTransform.translation.y
                                };

                                const candidates = [];
                                for (const modelPoint of remainingModelPoints) {
                                    if (!modelPoint?.id) continue;
                                    const dist = Math.hypot(projected.x - modelPoint.x, projected.y - modelPoint.y);
                                    if (dist < 15) {
                                        candidates.push({ modelPoint, distance: dist });
                                    }
                                }

                                if (candidates.length > 0) {
                                    candidates.sort((a, b) => a.distance - b.distance);
                                    blueCandidates.push({
                                        pointA: photoPoint.id,
                                        candidates: candidates.slice(0, 3),
                                        photoPoint,
                                        projected
                                    });
                                }
                            }

                            if (this.debug && blueCandidates.length > 0) {
                                console.log(`\n📊 Найдено ${blueCandidates.length} точек-кандидатов`);
                                console.log(`\n🔍 ТОПОЛОГИЧЕСКАЯ ПРОВЕРКА СИНИХ КАНДИДАТОВ`);
                            }

                            let topologicallyConsistent = [];

                            for (const candidate of blueCandidates) {
                                const photoNeighbors = this.findNodeNeighbors(candidate.pointA, exactGraph) || [];
                                const photoNeighborIds = photoNeighbors.map(n => n?.id).filter(id => id);
                                const matchedNeighbors = photoNeighborIds.filter(id => matchedPointsA.has(id));

                                if (matchedNeighbors.length < 2) continue;

                                for (const modelCandidate of candidate.candidates) {
                                    const modelPoint = modelCandidate.modelPoint;
                                    if (!modelPoint?.id) continue;

                                    const modelNeighbors = this.findNodeNeighbors(modelPoint.id, existingModel.graph) || [];
                                    const modelNeighborIds = modelNeighbors.map(n => n?.id).filter(id => id);
                                    const matchedModelNeighbors = modelNeighborIds.filter(id => matchedPointsB.has(id));

                                    if (matchedModelNeighbors.length !== matchedNeighbors.length) continue;

                                    let topologyMatch = true;
                                    for (let i = 0; i < matchedNeighbors.length; i++) {
                                        const match = finalValidatedMatches.find(m => m?.pointA === matchedNeighbors[i]);
                                        if (!match?.pointB || !modelNeighborIds.includes(match.pointB)) {
                                            topologyMatch = false;
                                            break;
                                        }
                                    }

                                    if (topologyMatch) {
                                        topologicallyConsistent.push({
                                            pointA: candidate.pointA,
                                            pointB: modelPoint.id,
                                            distance: modelCandidate.distance,
                                            photoPoint: candidate.photoPoint,
                                            modelPoint: modelPoint,
                                            projected: candidate.projected
                                        });
                                        break;
                                    }
                                }
                            }

                            if (this.debug && topologicallyConsistent.length > 0) {
                                console.log(`\n📊 Топологически согласовано: ${topologicallyConsistent.length} точек`);
                                console.log(`\n🔧 ИТЕРАТИВНОЕ НАТЯГИВАНИЕ СИНИХ ТОЧЕК`);
                            }

                            if (topologicallyConsistent.length > 0) {
                                let workingAnchors = finalValidatedMatches.map(m => ({
                                    pointA: m?.pointA,
                                    pointB: m?.pointB,
                                    confidence: m?.confidence || 0.5
                                })).filter(a => a.pointA && a.pointB);

                                let addedBluePoints = [];
                                topologicallyConsistent.sort((a, b) => a.distance - b.distance);

                                for (const candidate of topologicallyConsistent) {
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

                                    if (!testTransform) continue;

                                    let allConsistent = true;
                                    for (const anchor of workingAnchors) {
                                        const nodeA = exactGraph?.nodes?.get(anchor.pointA);
                                        const nodeB = existingModel?.graph?.nodes?.get(anchor.pointB);
                                        if (!nodeA || !nodeB) continue;

                                        const projected = validator.applyTransform(nodeA, testTransform);
                                        const error = Math.hypot(projected.x - nodeB.x, projected.y - nodeB.y);
                                        const footprintSize = validator.getFootprintSize(Array.from(existingModel?.graph?.nodes?.values() || []));
                                        if (error / (footprintSize || 1) >= 0.05) {
                                            allConsistent = false;
                                            break;
                                        }
                                    }

                                    if (allConsistent) {
                                        const nodeA = exactGraph?.nodes?.get(candidate.pointA);
                                        const nodeB = existingModel?.graph?.nodes?.get(candidate.pointB);
                                        if (nodeA && nodeB) {
                                            const projected = validator.applyTransform(nodeA, testTransform);
                                            const error = Math.hypot(projected.x - nodeB.x, projected.y - nodeB.y);
                                            const footprintSize = validator.getFootprintSize(Array.from(existingModel?.graph?.nodes?.values() || []));

                                            if (error / (footprintSize || 1) < 0.05) {
                                                nodeB.x = (projected.x + nodeB.x) / 2;
                                                nodeB.y = (projected.y + nodeB.y) / 2;
                                                nodeB.confirmationCount++;

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
                                }

                                if (addedBluePoints.length > 0) {
                                    console.log(`\n✅ Добавлено ${addedBluePoints.length} синих точек!`);
                                    finalValidatedMatches = [...finalValidatedMatches, ...addedBluePoints];

                                    matchedPointsA.clear();
                                    matchedPointsB.clear();
                                    for (const match of finalValidatedMatches) {
                                        if (match?.pointA) matchedPointsA.add(match.pointA);
                                        if (match?.pointB) matchedPointsB.add(match.pointB);
                                    }

                                    const updatedUniqueInModel = allPointsInA
                                        .filter(p => p && p.id && !matchedPointsA.has(p.id))
                                        .map(p => ({ id: p.id, x: p.x, y: p.y, type: 'unique_in_model' }));

                                    const updatedUniqueInPhoto = points
                                        .filter(p => !matchedPointsA.has(p.id))
                                        .map(p => {
                                            const proj = {
                                                x: p.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
                                                   p.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                                   finalTransform.translation.x,
                                                y: p.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
                                                   p.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
                                                   finalTransform.translation.y
                                            };
                                            return { id: p.id, x: proj.x, y: proj.y, type: 'unique_in_photo' };
                                        });

                                    console.log(`\n📊 НОВАЯ СТАТИСТИКА:`);
                                    console.log(`   • Сопоставлено точек в A: ${matchedPointsA.size}`);
                                    console.log(`   • Сопоставлено точек в B: ${matchedPointsB.size}`);
                                    console.log(`   • Уникальных в модели: ${updatedUniqueInModel.length}`);
                                    console.log(`   • Уникальных в фото: ${updatedUniqueInPhoto.length}`);

                                    if (existingModel) {
                                        existingModel.uniquePoints = {
                                            model: updatedUniqueInModel,
                                            photo: updatedUniqueInPhoto
                                        };
                                    }
                                }
                            }
                        }
                    } catch (blueError) {
                        if (this.debug) {
                            console.log(`\n⚠️ Ошибка в обработке синих точек: ${blueError.message}`);
                            console.log(blueError.stack);
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

                    if (existingModel) {
                        existingModel.knnGraph = knnGraph;
                        existingModel.knnFingerprints = new Map([...(existingModel.knnFingerprints || []), ...(knnFingerprints || [])]);
                        existingModel.metadata.photoCount = (existingModel.metadata.photoCount || 0) + 1;
                        existingModel.metadata.lastEnhanced = new Date();
                    }

                    const { matchMap, modelMatchMap } = this.buildTriangleMatchMap(
                        { matches: finalValidatedMatches || [] },
                        modelIdHint
                    );

                    if (existingModel) {
                        existingModel.lastTriangleResult = {
                            ...(existingModel.lastTriangleResult || {}),
                            modelMatchMap: modelMatchMap,
                            matchMap: matchMap,
                            globalConsistency: consistent?.stats
                        };
                    }

                    console.log(`\n🔍 ОТЛАДКА: ${finalValidatedMatches?.length || 0} согласованных точек`);
                    console.log(`   • matchMap передан в визуализацию: ${matchMap?.size || 0} пар`);
                    console.log(`   • modelMatchMap сохранён в модель: ${modelMatchMap?.size || 0} пар`);

                    const cleanResult = this.cleanUnconfirmedNodes(modelIdHint, 2, 3);
                    this.stats.totalNodesRemoved += cleanResult.removed;
                    this.stats.triangleMatchesCount += finalValidatedMatches?.length || 0;

                    const confirmedInModel = finalValidatedMatches?.length || 0;
                    const onlyInModel = (existingModel?.graph?.nodes?.size || 0) - confirmedInModel;
                    const onlyInPhoto = (exactGraph?.nodes?.size || 0) - confirmedInModel;

                    console.log(`\n📊 СТАТИСТИКА МОДЕЛИ:`);
                    console.log(`   • 🟠 Подтвержденных (2+ фото): ${confirmedInModel}`);
                    console.log(`   • 🔵 Только в модели: ${onlyInModel}`);
                    console.log(`   • 🔵 Только в новом фото: ${onlyInPhoto}`);
                    console.log(`   • Всего в модели теперь: ${existingModel?.graph?.nodes?.size || 0}`);

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
                        message: `Итеративно согласовано: ${finalValidatedMatches.length} точек`
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
                console.log(`   modelIdHint: ${modelIdHint}`);
                console.log(`   models.has: ${this.models.has(modelIdHint)}`);
            }
        }

        // Если это первое фото - создаём первую модель
        if (this.models.size === 0) {
            console.log(`🆕 Первое фото в сессии, создаю первую модель`);
            const result = this.createNewModel(exactGraph, knnFingerprints, morphologyMap, points, options);
            this.photoToModel.set(photoId, result.modelId);
            return { ...result, isFirstModel: true, totalModels: this.models.size };
        }

        // Стандартный путь (быстрое сравнение)
        if (this.debug) console.log(`\n🔍 Быстрый путь не сработал, запускаю полный анализ...`);

        const comparisons = [];
        for (const [modelId, model] of this.models) {
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
        } else {
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

    // ==================== ОСТАЛЬНЫЕ МЕТОДЫ ====================

    async compareByTriangleMatching(model1, model2, options = {}) {
        const startTime = Date.now();
        if (this.debug) console.log(`\n🔍 Треугольное сопоставление...`);

        const points1 = this.extractPointsFromModel(model1);
        const points2 = this.extractPointsFromModel(model2);

        if (this.debug) console.log(`📊 Точек: ${points1.length} ↔ ${points2.length}`);

        if (!points1?.length || !points2?.length) {
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

        const triangleMatcher = new TriangleMatcher({
            compactnessThreshold: 0.4,
            eccentricityThreshold: 0.2,
            areaThreshold: 0.5,
            ratioThreshold: 0.25
        });

        let result;
        try {
            result = triangleMatcher.findMatches(points1, points2, model1.graph, model2.graph);
        } catch (error) {
            console.log(`❌ Ошибка в triangleMatcher.findMatches:`, error.message);
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

        if (!result?.matches) {
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
                stats: result?.stats || {}
            };
        }

        const matchedPointA = new Set(result.matches.map(m => m.pointA));
        const matchedPointB = new Set(result.matches.map(m => m.pointB));

        const noMatchA = points1.filter(p => !matchedPointA.has(p.id)).map(p => p.id);
        const noMatchB = points2.filter(p => !matchedPointB.has(p.id)).map(p => p.id);

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

        if (this.debug) {
            console.log(`\n📊 РЕЗУЛЬТАТ ТРЕУГОЛЬНОГО СОПОСТАВЛЕНИЯ:`);
            console.log(`   • Найдено соответствий: ${finalResult.count}`);
            console.log(`   • Новых в А: ${finalResult.noMatchA.length}`);
            console.log(`   • Новых в Б: ${finalResult.noMatchB.length}`);
            console.log(`   • Достаточно для якорей: ${finalResult.sufficient ? '✅' : '❌'}`);
            console.log(`   • Время: ${finalResult.time}ms`);
        }

        return finalResult;
    }

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
                compactness: morph.compactness || 0,
                eccentricity: morph.eccentricity || 0,
                normalizedArea: morph.normalizedArea || 1,
                radialProfile: morph.radialProfile || [0,0,0,0,0,0,0,0],
                orientation: morph.orientation || 0,
                asymmetry: morph.asymmetry || 0,
                contour: morph.contour || null,
                neighborRoles: this.getNeighborRolesForPoint(nodeId, graph)
            });
        }

        if (this.debug) console.log(`📊 Извлечено ${points.length} точек из модели с морфологией`);
        return points;
    }

    buildTriangleMatchMap(result, targetModelId = null) {
        if (!result.matches?.length) {
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

            matchMap.set(pointA, { modelId: pointB, pairNumber, type: 'anchor', confidence: 1.0, status });
            modelMatchMap.set(pointB, { photoId: pointA, pairNumber, type: 'anchor', confidence: 1.0, status });
            pairNumber++;
        }

        if (this.debug) {
            console.log(`\n📊 ИТОГ buildTriangleMatchMap:`);
            console.log(`   • matchMap size: ${matchMap.size}`);
            console.log(`   • modelMatchMap size: ${modelMatchMap.size}`);
        }

        return { matchMap, modelMatchMap };
    }

    getNodeRoleSimple(nodeId, graph) {
        const node = graph.nodes.get(nodeId);
        if (!node) return 'R';
        const degree = node.degree || 0;
        if (degree >= 6) return 'H';
        if (degree === 1) return 'L';
        return 'R';
    }

    getNeighborRolesForPoint(nodeId, graph) {
        const neighbors = this.findNodeNeighbors(nodeId, graph);
        const roles = neighbors.map(n => this.getNodeRoleSimple(n.id, graph)).sort();
        return roles.join('');
    }

    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        const edges = Array.isArray(graph.edges) ? graph.edges : Array.from(graph.edges);
        for (const edge of edges) {
            const [a, b] = edge.split('--');
            if (a === nodeId) neighbors.push({ id: b });
            if (b === nodeId) neighbors.push({ id: a });
        }
        return neighbors;
    }

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
                if (this.debug) console.log(`   ✅ Подтверждена точка ${match.pointB.substring(0,12)} (теперь ${modelNode.confirmationCount})`);
            }
        }

        if (this.lastUniqueInPhoto?.length > 0) {
            if (this.debug) console.log(`\n📸 Добавляю ${this.lastUniqueInPhoto.length} новых точек из фото в модель`);

            for (const photoPoint of this.lastUniqueInPhoto) {
                let isDuplicate = false;
                for (const [modelId, modelNode] of model.graph.nodes) {
                    if (Math.hypot(modelNode.x - photoPoint.x, modelNode.y - photoPoint.y) < 5) {
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
                    if (this.debug) console.log(`      ✅ Добавлена новая точка (${photoPoint.x.toFixed(1)}, ${photoPoint.y.toFixed(1)})`);
                }
            }
        }

        console.log(`\n📊 Результат обновления модели:`);
        console.log(`   • Подтверждено существующих: ${confirmedExisting}`);
        console.log(`   • Новых точек добавлено: ${newNodesAdded}`);

        return { confirmedExisting, newNodesAdded };
    }

    async enhanceExistingModel(modelId, newExactGraph, newKNNGraph, newKnnFingerprints, newMorphology, options) {
        const model = this.models.get(modelId);
        if (!model) return { error: 'Модель не найдена' };

        if (this.debug) console.log(`\n🔧 УЛУЧШАЮ МОДЕЛЬ ${modelId.slice(0, 12)}...`);

        const centerMatches = this.centerMatcher.findCenterMatches(
            newExactGraph, model.graph, newMorphology, model.morphologyMap
        );

        console.log(`\n🔴 CenterMatcher нашёл ${centerMatches.size} якорей`);

        let finalMatches = new Map([...centerMatches]);
        let newNodesAdded = 0;

        if (centerMatches.size >= this.centerMatcher.minConsistentPairs) {
            if (this.debug) console.log(`\n🧩 RelativePositioning достраивает остальные точки...`);

            const allMatches = this.relativePositioning.positionPoints(
                newExactGraph, model.graph, centerMatches, newMorphology, model.morphologyMap,
                { confidenceThreshold: 0.5 }
            );

            const stabilizedMatches = this.relativePositioning.iterativeStabilization(
                newExactGraph, model.graph, centerMatches, newMorphology, model.morphologyMap
            );

            finalMatches = new Map([...centerMatches, ...allMatches, ...stabilizedMatches]);

            const updateResult = this.updateModelWithMatches(
                modelId, newExactGraph, finalMatches, centerMatches, newMorphology
            );
            newNodesAdded = updateResult.newNodesAdded;
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

        const cleanResult = this.cleanUnconfirmedNodes(modelId, 2, 3);
        this.stats.totalNodesRemoved += cleanResult.removed;

        return {
            centerMatches: centerMatches.size,
            totalMatches: finalMatches.size,
            newNodesAdded,
            nodesRemoved: cleanResult.removed,
            matchMap: new Map()
        };
    }

    buildMatchMap(centerMatches, allMatches, stabilizedMatches) {
        const matchMap = new Map();
        let pairNumber = 1;

        for (const [photoId, match] of centerMatches) {
            if (match?.confidence >= 0.7) {
                matchMap.set(photoId, { modelId: match.modelId, pairNumber: pairNumber++, type: 'anchor' });
            }
        }
        return matchMap;
    }

    updateModelWithMatches(modelId, newGraph, matches, anchorMatches, newMorphology) {
        const model = this.models.get(modelId);
        let confirmedExisting = 0;
        let newNodesAdded = 0;

        const matchedPhotoIds = new Set();
        const matchedModelIds = new Set();

        for (const [photoId, match] of matches) {
            const modelNode = model.graph.nodes.get(match.modelId);
            if (modelNode) {
                modelNode.confirmationCount++;
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

            if (this.isDuplicate(photoNode, model.graph, model.morphologyMap)) continue;

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
        return { confirmedExisting, newNodesAdded, duplicatesSkipped: 0 };
    }

    switchToModel(modelId) {
        if (!this.models.has(modelId)) return false;
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
        const stats = { total: this.models.size, current: this.currentModelId, differentFootprints: this.stats.differentFootprintsDetected, models: [] };
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
            relations.push({ modelId, relatedTo: rel.related, type: rel.type, similarity: rel.similarity });
        }
        return relations;
    }

    getModelForPhoto(photoId) {
        return this.photoToModel.get(photoId) || null;
    }

    getPhotosForModel(modelId) {
        const photos = [];
        for (const [photoId, mid] of this.photoToModel) {
            if (mid === modelId) photos.push(photoId);
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
        if (!newMorph?.hasContour) return false;

        for (const [existingId, existingNode] of modelGraph.nodes) {
            const existingMorph = morphologyMap.get(existingId);
            if (!existingMorph?.hasContour) continue;

            if (Math.abs(newMorph.compactness - existingMorph.compactness) < this.duplicateCompactnessThreshold &&
                Math.abs(newMorph.normalizedArea - existingMorph.normalizedArea) < this.duplicateAreaThreshold) {

                if (this.graphDistance(newNode.id, existingId, modelGraph) <= this.duplicateGraphDistance) {
                    return true;
                }
            }
        }
        return false;
    }

    graphDistance(nodeA, nodeB, graph) {
        if (nodeA === nodeB) return 0;
        const queue = [{ id: nodeA, dist: 0 }];
        const visited = new Set([nodeA]);

        while (queue.length) {
            const { id, dist } = queue.shift();
            for (const neighbor of this.findNodeNeighbors(id, graph)) {
                if (neighbor.id === nodeB) return dist + 1;
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push({ id: neighbor.id, dist: dist + 1 });
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

        for (const [nodeId, node] of graph.nodes) {
            if (node.addedFrom === 'original') continue;

            const confirmations = node.confirmationCount || 1;
            const addedAt = node.addedAt?.getTime() || now;
            const age = (now - addedAt) / (1000 * 60 * 60 * 24);

            if (confirmations < minConfirmations && age > 0.1) {
                toRemove.push(nodeId);
            }
        }

        toRemove.forEach(id => graph.nodes.delete(id));

        const newEdges = new Set();
        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (graph.nodes.has(a) && graph.nodes.has(b)) newEdges.add(edge);
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
        if (model) model.lastTriangleResult = result;
    }

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
        for (const edge of modelGraph.edges) {
            const [a, b] = edge.split('--');
            if (modelGraph.nodes.has(a)) modelGraph.nodes.get(a).degree++;
            if (modelGraph.nodes.has(b)) modelGraph.nodes.get(b).degree++;
        }
    }

    computeTriangles(graph) {
        if (!graph?.nodes || !graph.edges) return [];

        const triangles = [];
        const nodeIds = Array.from(graph.nodes.keys());
        const edges = graph.edges;

        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                for (let k = j + 1; k < nodeIds.length; k++) {
                    const a = nodeIds[i], b = nodeIds[j], c = nodeIds[k];
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
        const modelMatchMapFromModel = model.lastTriangleResult?.modelMatchMap || new Map();

        if (this.debug) console.log(`📋 getVisualizationData: modelMatchMap содержит ${modelMatchMapFromModel.size} записей`);

        let reliableNodeIds = new Set(reliablePhotoIds);
        if (!reliableNodeIds.size) {
            for (const [nodeId, node] of graph.nodes) {
                if (node.confirmationCount >= 2) reliableNodeIds.add(nodeId);
            }
        }

        const pointsByConfirmation = { confirmed3: [], confirmed2: [], confirmed1: [], confirmed0: [] };
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
            modelMatchMap: modelMatchMapFromModel,
            transform: model.transform,
            uniquePoints: model.uniquePoints
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

    checkGlobalConsistency(anchors, trianglesA, trianglesB, graphA, graphB) {
        if (this.debug) {
            console.log(`\n🔍 ГЛОБАЛЬНАЯ ПРОВЕРКА СОГЛАСОВАННОСТИ`);
            console.log(`   • Всего кандидатов: ${anchors.length} треугольников (${anchors.length * 3} точек)`);
        }

        const pointPairs = new Map();
        const reversePairs = new Map();

        for (const anchor of anchors) {
            if (anchor.aIndex === -1) {
                for (const point of anchor.points) {
                    if (!pointPairs.has(point.pointA) && !reversePairs.has(point.pointB)) {
                        pointPairs.set(point.pointA, { pointB: point.pointB, confidence: point.confidence || anchor.geometryScore });
                        reversePairs.set(point.pointB, point.pointA);
                    }
                }
            }
        }

        const finalPoints = [];
        for (const [pA, data] of pointPairs) {
            finalPoints.push({ pointA: pA, pointB: data.pointB, confidence: data.confidence });
        }

        if (this.debug) {
            console.log(`\n📊 ИТОГ ГЛОБАЛЬНОЙ ПРОВЕРКИ:`);
            console.log(`   • Согласованных точек: ${finalPoints.length}`);
        }

        return { anchors: [], points: finalPoints, stats: {} };
    }

    twoStagePositioning(anchors, allMatches, graphA, graphB, morphologyMap, modelMorphology) {
        if (this.debug) console.log(`\n🔧 ДВУХЭТАПНАЯ ДОСТРОЙКА ТОЧЕК`);

        const anchorSet = new Set(anchors.map(a => a.pointA));
        const confusedPoints = allMatches.filter(m => !anchorSet.has(m.pointA));

        if (this.debug) {
            console.log(`\n📊 РАЗДЕЛЕНИЕ ТОЧЕК ПО КАТЕГОРИЯМ:`);
            console.log(`   • Якорей: ${anchors.length} точек`);
            console.log(`   • Путающихся кандидатов: ${confusedPoints.length} точек`);
        }

        const allConfirmed = [...anchors];
        const finalMatches = [...allConfirmed];

        if (this.debug) {
            console.log(`\n🎯 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ:`);
            console.log(`   • Всего соответствий: ${finalMatches.length} точек`);
        }

        return finalMatches;
    }

    extractTrianglesFromGraph(graph) {
        const triangles = [];
        const nodeIds = Array.from(graph.nodes.keys());
        const edges = graph.edges;

        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                for (let k = j + 1; k < nodeIds.length; k++) {
                    const a = nodeIds[i], b = nodeIds[j], c = nodeIds[k];
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
