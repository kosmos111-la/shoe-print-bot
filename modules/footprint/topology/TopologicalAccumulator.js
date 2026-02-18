// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ ДВУХРЕЖИМНЫЙ АККУМУЛЯТОР - Делоне для точек, KNN для WL
// 🔥 ИСПРАВЛЕНО: ИНВАРИАНТНАЯ фильтрация дубликатов (только compactness + топология)

const GraphBuilder = require('./GraphBuilder');
const KNNGraphBuilder = require('./KNNGraphBuilder');
const LocalGroupSignature = require('./LocalGroupSignature');
const MorphologyEncoder = require('./MorphologyEncoder');
const CenterMatcher = require('./CenterMatcher');
const RelativePositioning = require('./RelativePositioning');
const TopologicalFingerprint = require('./TopologicalFingerprint');

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;

        // 🔥 РЕЖИМЫ РАБОТЫ
        this.fastMode = options.fastMode || false;
        this.similarityThreshold = options.similarityThreshold || 0.6;

        // Компоненты
        this.graphBuilder = new GraphBuilder({ debug: this.debug }); // Делоне
        this.knnBuilder = new KNNGraphBuilder({
            debug: this.debug,
            k: options.k || 8  // KNN для WL
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
            confidenceThreshold: options.confidenceThreshold || 0.8  // 🔥 80%
        });

        // 🔥 ИНВАРИАНТНЫЕ ПАРАМЕТРЫ
        this.duplicateCompactnessThreshold = options.duplicateCompactnessThreshold || 0.3; // разница compactness
        this.duplicateAreaThreshold = options.duplicateAreaThreshold || 0.15; // разница normalizedArea
        this.duplicateGraphDistance = options.duplicateGraphDistance || 2; // расстояние в графе

        // Хранилище моделей
        this.models = new Map();
        this.currentModelId = null;

        // Статистика
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalCenterMatches: 0,
            totalRelativeMatches: 0,
            totalNodesRemoved: 0,
            totalDuplicatesSkipped: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log(`🏗️ ДВУХРЕЖИМНЫЙ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   🔥 Режим: ${this.fastMode ? 'БЫСТРЫЙ (только WL)' : 'ПОЛНЫЙ'}`);
        console.log(`   🔷 Порог сходства: ${this.similarityThreshold * 100}%`);
        console.log(`   🔷 Порог уверенности: ${this.relativePositioning.confidenceThreshold * 100}%`);
        console.log(`   🔷 ИНВАРИАНТНЫЕ ПОРОГИ:`);
        console.log(`      - compactness разница < ${this.duplicateCompactnessThreshold}`);
        console.log(`      - area разница < ${this.duplicateAreaThreshold}`);
        console.log(`      - графовое расстояние ≤ ${this.duplicateGraphDistance}`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    async processPoints(points, options = {}) {
        console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК...`);

        const modelId = options.modelId || this.currentModelId;
        const contours = options.contours || [];

        // 1. Строим Делоне-граф (для точной идентификации)
        const exactGraph = this.graphBuilder.buildGraph(points, options.source || 'photo');

        // 2. Строим KNN-граф (для WL-сравнения)
        const knnGraph = this.knnBuilder.buildGraph(points, options.source || 'photo_knn');

        // 3. Кодируем морфологию
        const morphologyMap = this.morphologyEncoder.encode(points, contours);

        // 4. Вычисляем WL-подписи на KNN-графе
        const knnFingerprints = this.fingerprinter.computeGraphFingerprints(knnGraph);

        // Если нет существующей модели - создаём новую
        if (!modelId || !this.models.has(modelId)) {
            return this.createNewModel(exactGraph, knnFingerprints, morphologyMap, points, options);
        }

        const existingModel = this.models.get(modelId);
        console.log(`🔍 Сравниваю с моделью "${modelId}"`);

        // 🔥 5. ГЛОБАЛЬНОЕ WL-СРАВНЕНИЕ НА KNN-ГРАФАХ
        console.log(`\n🔍 Сравниваю графы по WL-подписям (KNN)...`);

        const comparison = this.fingerprinter.compareGraphs(
            existingModel.knnGraph,           // KNN-граф модели
            existingModel.knnFingerprints,    // его подписи
            knnGraph,                          // KNN-граф нового фото
            knnFingerprints                     // его подписи
        );

        const globalSimilarity = comparison.similarity;

        console.log(`📊 Результат сравнения:`);
        console.log(`   Узлов в графе 1: ${comparison.totalNodes1}`);
        console.log(`   Узлов в графе 2: ${comparison.totalNodes2}`);
        console.log(`   Точных совпадений: ${comparison.exactMatches.length}`);
        console.log(`   Структурно похожих: ${comparison.similarMatches.length}`);
        console.log(`   Сходство: ${(globalSimilarity * 100).toFixed(1)}%`);

        // Если сходство ниже порога - создаём новую модель
        if (globalSimilarity < this.similarityThreshold) {
            console.log(`⚠️ Сходство ниже порога (${(globalSimilarity * 100).toFixed(1)}% < ${this.similarityThreshold * 100}%)`);
            console.log(`🆕 Создаю новую модель`);
            return this.createNewModel(exactGraph, knnFingerprints, morphologyMap, points, {
                ...options,
                comparedWith: modelId,
                reason: 'low_similarity'
            });
        }

        // 🔥 6. ЕСЛИ ВКЛЮЧЕН ПОЛНЫЙ РЕЖИМ - запускаем точную идентификацию на Делоне
        if (!this.fastMode) {
            console.log(`\n🔧 ЗАПУСК ПОЛНОГО АНАЛИЗА (на Делоне-графе)...`);

            const centerMatches = this.centerMatcher.findCenterMatches(
                exactGraph,
                existingModel.graph,           // Делоне-граф модели
                morphologyMap,
                existingModel.morphologyMap
            );

            if (centerMatches.size >= this.centerMatcher.minConsistentPairs) {
                console.log(`✅ Найдено ${centerMatches.size} АБСОЛЮТНО НАДЁЖНЫХ ТОЧЕК`);

                const allMatches = this.relativePositioning.positionPoints(
                    exactGraph,
                    existingModel.graph,
                    centerMatches,
                    morphologyMap,
                    existingModel.morphologyMap
                );

                const stabilizedMatches = this.relativePositioning.iterativeStabilization(
                    exactGraph,
                    existingModel.graph,
                    centerMatches,
                    morphologyMap,
                    existingModel.morphologyMap
                );

                const finalMatches = new Map([...allMatches, ...stabilizedMatches]);

                this.printFinalTable(exactGraph, existingModel.graph, finalMatches);

                const updatedModel = await this.enhanceModel(
                    modelId,
                    exactGraph,
                    knnGraph,
                    knnFingerprints,
                    morphologyMap,
                    finalMatches,
                    centerMatches,
                    options
                );

                // 🔥 ОЧИЩАЕМ МОДЕЛЬ ОТ НЕПОДТВЕРЖДЁННЫХ ТОЧЕК
                const cleanResult = this.cleanUnconfirmedNodes(modelId, 2, 3);
                this.stats.totalNodesRemoved += cleanResult.removed;

                // 🔥 СОЗДАЁМ КАРТУ СООТВЕТСТВИЙ С НОМЕРАМИ ДЛЯ ВИЗУАЛИЗАЦИИ
                const matchMap = new Map();
                let pairNumber = 1;
                for (const [photoId, match] of finalMatches) {
                    if (match.confidence >= 0.7) {
                        matchMap.set(photoId, {
                            modelId: match.modelId,
                            pairNumber: pairNumber++
                        });
                    }
                }

                return {
                    status: 'enhanced_full',
                    modelId: modelId,
                    similarity: globalSimilarity,
                    centerMatches: centerMatches.size,
                    totalMatches: finalMatches.size,
                    newNodesAdded: updatedModel.newNodesAdded,
                    nodesRemoved: cleanResult.removed,
                    duplicatesSkipped: updatedModel.duplicatesSkipped || 0,
                    matchMap: matchMap,
                    message: `Модель улучшена (WL: ${(globalSimilarity * 100).toFixed(1)}%, надёжных: ${centerMatches.size}, новых: ${updatedModel.newNodesAdded}, дубликатов: ${updatedModel.duplicatesSkipped || 0}, удалено: ${cleanResult.removed})`
                };
            } else {
                console.log(`⚠️ Недостаточно надёжных точек (${centerMatches.size} < ${this.centerMatcher.minConsistentPairs})`);
            }
        }

        // 🔥 7. БЫСТРЫЙ РЕЖИМ
        return {
            status: 'enhanced_fast',
            modelId: modelId,
            similarity: globalSimilarity,
            exactMatches: comparison.exactMatches.length,
            similarMatches: comparison.similarMatches.length,
            message: `Модель совпадает (WL: ${(globalSimilarity * 100).toFixed(1)}%)`
        };
    }

    // ==================== ИНВАРИАНТНАЯ ПРОВЕРКА ДУБЛИКАТОВ ====================

    /**
     * Проверяет, является ли новая точка дубликатом существующей
     * ИСПОЛЬЗУЕТ ТОЛЬКО ИНВАРИАНТНЫЕ МЕТРИКИ:
     * - compactness (инвариантен к повороту/масштабу)
     * - normalizedArea (инвариантна к масштабу)
     * - графовое расстояние (инвариантно к повороту/масштабу)
     */
    isDuplicate(newNode, modelGraph, morphologyMap) {
        if (modelGraph.nodes.size === 0) return false;

        const newMorph = morphologyMap.get(newNode.id);
        if (!newMorph || !newMorph.hasContour) return false;

        for (const [existingId, existingNode] of modelGraph.nodes) {
            const existingMorph = morphologyMap.get(existingId);
            if (!existingMorph || !existingMorph.hasContour) continue;

            // 🔥 1. Сравниваем compactness (инвариантен!)
            const compactnessDiff = Math.abs(newMorph.compactness - existingMorph.compactness);
            
            // 🔥 2. Сравниваем normalizedArea (инвариантна!)
            const areaDiff = Math.abs(newMorph.normalizedArea - existingMorph.normalizedArea);

            // Если форма сильно различается - точно не дубликат
            if (compactnessDiff > this.duplicateCompactnessThreshold || 
                areaDiff > this.duplicateAreaThreshold) {
                continue;
            }

            // 🔥 3. Проверяем топологическое расстояние (инвариантно!)
            const graphDist = this.graphDistance(newNode.id, existingId, modelGraph);
            
            // Если топологически рядом И форма похожа - это дубликат
            if (graphDist <= this.duplicateGraphDistance) {
                if (this.debug) {
                    console.log(`   🚫 Дубликат: compactness diff ${compactnessDiff.toFixed(2)}, area diff ${areaDiff.toFixed(2)}, graph dist ${graphDist}`);
                }
                return true;
            }
        }

        return false;
    }

    /**
     * Вычисляет расстояние между узлами в графе (BFS)
     * ПОЛНОСТЬЮ ИНВАРИАНТНО к повороту/масштабу!
     */
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

    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (a === nodeId) neighbors.push({id: b});
            if (b === nodeId) neighbors.push({id: a});
        }
        return neighbors;
    }

    // ==================== ОЧИСТКА НЕПОДТВЕРЖДЁННЫХ ТОЧЕК ====================

    cleanUnconfirmedNodes(modelId, minConfirmations = 2, maxAge = 3) {
        const model = this.models.get(modelId);
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

        toRemove.forEach(nodeId => {
            graph.nodes.delete(nodeId);
        });

        const newEdges = new Set();
        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (graph.nodes.has(a) && graph.nodes.has(b)) {
                newEdges.add(edge);
            }
        }
        graph.edges = newEdges;

        for (const node of graph.nodes.values()) {
            node.degree = 0;
        }
        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (graph.nodes.has(a)) graph.nodes.get(a).degree++;
            if (graph.nodes.has(b)) graph.nodes.get(b).degree++;
        }

        console.log(`🧹 Очищено ${toRemove.length} неподтверждённых точек из модели`);

        return {
            removed: toRemove.length,
            remaining: graph.nodes.size
        };
    }

    // ==================== УЛУЧШЕНИЕ МОДЕЛИ ====================

    async enhanceModel(modelId, newExactGraph, newKNNGraph, newKnnFingerprints, newMorphology, allMatches, anchorMatches, options) {
        const model = this.models.get(modelId);

        let confirmedExisting = 0;
        let newNodesAdded = 0;
        let duplicatesSkipped = 0;
        let missingFromModel = 0;

        const matchedPhotoIds = new Set();
        const matchedModelIds = new Set();

        // Подтверждаем существующие точки
        for (const [photoId, match] of allMatches) {
            const modelNode = model.graph.nodes.get(match.modelId);
            if (modelNode) {
                modelNode.confirmationCount = (modelNode.confirmationCount || 1) + 1;
                modelNode.lastConfirmed = new Date();
                confirmedExisting++;

                matchedPhotoIds.add(photoId);
                matchedModelIds.add(match.modelId);
            }
        }

        // Добавляем новые точки с ИНВАРИАНТНОЙ проверкой
        for (const [photoId, photoNode] of newExactGraph.nodes) {
            if (matchedPhotoIds.has(photoId)) continue;

            const match = allMatches.get(photoId);
            if (!match || match.confidence < 0.7) continue;

            // 🔥 ИНВАРИАНТНАЯ проверка на дубликат
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

            matchedPhotoIds.add(photoId);
        }

        for (const [modelId, modelNode] of model.graph.nodes) {
            if (matchedModelIds.has(modelId)) continue;
            if (modelNode.addedFrom !== 'original') {
                missingFromModel++;
            }
        }

        this.updateEdges(model.graph, newExactGraph, allMatches);

        model.knnGraph = newKNNGraph;
        model.knnFingerprints = new Map([...model.knnFingerprints, ...newKnnFingerprints]);

        model.metadata.nodesCount = model.graph.nodes.size;
        model.metadata.lastEnhanced = new Date();

        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            anchorMatches: anchorMatches.size,
            totalMatches: allMatches.size,
            confirmedExisting,
            newNodes: newNodesAdded,
            duplicatesSkipped,
            missingFromModel,
            totalNodes: model.graph.nodes.size
        });

        this.stats.totalEnhancements++;
        this.stats.totalCenterMatches += anchorMatches.size;
        this.stats.totalRelativeMatches += allMatches.size - anchorMatches.size;
        this.stats.totalDuplicatesSkipped += duplicatesSkipped;
        this.stats.lastUpdated = new Date();

        console.log(`\n📊 ИТОГ УЛУЧШЕНИЯ:`);
        console.log(`   Якорей: ${anchorMatches.size} точек`);
        console.log(`   Всего сопоставлено: ${allMatches.size} точек`);
        console.log(`   Подтверждено существующих: ${confirmedExisting} точек`);
        console.log(`   🔥 НОВЫХ добавлено: ${newNodesAdded} точек`);
        console.log(`   🚫 Дубликатов пропущено: ${duplicatesSkipped} точек`);
        console.log(`   ⚰️ Неподтверждённых (старых): ${missingFromModel} точек`);
        console.log(`   Теперь в модели: ${model.graph.nodes.size} точек`);

        return {
            confirmedExisting,
            newNodesAdded,
            duplicatesSkipped,
            missingFromModel,
            anchorMatches: anchorMatches.size,
            totalMatches: allMatches.size
        };
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    printFinalTable(newGraph, modelGraph, matches) {
        console.log(`\n📋 ИТОГОВАЯ ТАБЛИЦА СОПОСТАВЛЕНИЯ ВСЕХ ТОЧЕК:`);
        console.log(`┌─────┬──────────────────────┬──────────────────────┬───────────┬───────────┬─────────────────────┬─────────────────────┐`);
        console.log(`│  #  │   ТОЧКА В ФОТО 2      │   ТОЧКА В МОДЕЛИ      │ УВЕРЕН.   │ СТАТУС    │   КООРД. ФОТО 2     │   КООРД. МОДЕЛИ     │`);
        console.log(`├─────┼──────────────────────┼──────────────────────┼───────────┼───────────┼─────────────────────┼─────────────────────┤`);

        let count = 0;
        for (const [photoId, match] of matches) {
            if (count >= 30) break;

            const photoNode = newGraph.nodes.get(photoId);
            const modelNode = modelGraph.nodes.get(match.modelId);

            if (!photoNode || !modelNode) continue;

            count++;
            console.log(
                `│ ${count.toString().padEnd(3)} │ ${photoId.substring(0,20).padEnd(20)} │ ` +
                `${match.modelId.substring(0,20).padEnd(20)} │ ` +
                `${(match.confidence*100).toFixed(0).padStart(5)}%   │ ` +
                `${'✅'.padEnd(7)}   │ ` +
                `(${photoNode.x.toFixed(1).padStart(6)}, ${photoNode.y.toFixed(1).padStart(6)}) │ ` +
                `(${modelNode.x.toFixed(1).padStart(6)}, ${modelNode.y.toFixed(1).padStart(6)}) │`
            );
        }
        console.log(`└─────┴──────────────────────┴──────────────────────┴───────────┴───────────┴─────────────────────┴─────────────────────┘`);
    }

    createNewModel(exactGraph, knnFingerprints, morphologyMap, originalPoints, options = {}) {
        const modelId = `topo_model_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        let morphologyCount = 0;
        for (const [nodeId, node] of exactGraph.nodes) {
            const morph = morphologyMap.get(nodeId);
            if (morph) {
                node.morphology = morph;
                node.hasContour = morph.hasContour || false;
                morphologyCount++;
            }
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
            metadata: {
                name: options.name || `Модель_${new Date().toLocaleTimeString('ru-RU')}`,
                createdAt: new Date(),
                pointsCount: originalPoints.length,
                nodesCount: exactGraph.nodes.size,
                edgesCount: exactGraph.edges.size,
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

        console.log(`🏗️ СОЗДАНА НОВАЯ МОДЕЛЬ "${modelId}":`);
        console.log(`   Узлов: ${exactGraph.nodes.size}`);
        console.log(`   Точек с морфологией: ${morphologyCount}`);
        console.log(`   WL-подписей (KNN): ${knnFingerprints.size}`);

        return {
            status: 'created',
            modelId: modelId,
            nodes: exactGraph.nodes.size,
            edges: exactGraph.edges.size,
            morphologyCount: morphologyCount,
            message: `Создана новая топологическая модель`
        };
    }

    updateEdges(modelGraph, newGraph, matches) {
        const modelToPhoto = new Map();
        for (const [photoId, match] of matches) {
            modelToPhoto.set(match.modelId, photoId);
        }

        for (const edge of newGraph.edges) {
            const [photoA, photoB] = edge.split('--');

            const modelA = matches.get(photoA)?.modelId;
            const modelB = matches.get(photoB)?.modelId;

            if (modelA && modelB && modelGraph.nodes.has(modelA) && modelGraph.nodes.has(modelB)) {
                const modelEdge = [modelA, modelB].sort().join('--');
                modelGraph.edges.add(modelEdge);
            }
        }

        for (const node of modelGraph.nodes.values()) {
            node.degree = 0;
        }

        for (const edge of modelGraph.edges) {
            const [a, b] = edge.split('--');
            if (modelGraph.nodes.has(a)) modelGraph.nodes.get(a).degree++;
            if (modelGraph.nodes.has(b)) modelGraph.nodes.get(b).degree++;
        }
    }

    // ==================== ВЫЧИСЛЕНИЕ ТРЕУГОЛЬНИКОВ ====================

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

                    const ab = [a, b].sort().join('--');
                    const bc = [b, c].sort().join('--');
                    const ca = [c, a].sort().join('--');

                    if (edges.has(ab) && edges.has(bc) && edges.has(ca)) {
                        triangles.push([a, b, c]);
                    }
                }
            }
        }

        return triangles;
    }

    // ==================== ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ ====================

    getVisualizationData(modelId = null, reliablePhotoIds = []) {
        const targetId = modelId || this.currentModelId;
        if (!targetId || !this.models.has(targetId)) return null;

        const model = this.models.get(targetId);
        const graph = model.graph;

        let reliableNodeIds = new Set(reliablePhotoIds);

        if (reliableNodeIds.size === 0) {
            for (const [nodeId, node] of graph.nodes) {
                if (node.confirmationCount >= 2) {
                    reliableNodeIds.add(nodeId);
                }
            }
        }

        const allTriangles = this.computeTriangles(graph);

        const reliableTriangles = [];
        const regularTriangles = [];

        for (const triangle of allTriangles) {
            const [a, b, c] = triangle;
            const isReliable = reliableNodeIds.has(a) && reliableNodeIds.has(b) && reliableNodeIds.has(c);

            if (isReliable) {
                reliableTriangles.push(triangle);
            } else {
                regularTriangles.push(triangle);
            }
        }

        const pointsByConfirmation = {
            confirmed3: [],
            confirmed2: [],
            confirmed1: [],
            confirmed0: []
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
            reliableTriangles: reliableTriangles,
            regularTriangles: regularTriangles,
            stats: {
                totalNodes: graph.nodes.size,
                totalEdges: graph.edges.size,
                reliableTriangles: reliableTriangles.length,
                regularTriangles: regularTriangles.length,
                avgDegree: graph.avgDegree || 0,
                confirmed3: pointsByConfirmation.confirmed3.length,
                confirmed2: pointsByConfirmation.confirmed2.length,
                confirmed1: pointsByConfirmation.confirmed1.length,
                confirmed0: pointsByConfirmation.confirmed0.length,
                reliableNodes: reliableNodeIds.size,
                duplicatesSkipped: this.stats.totalDuplicatesSkipped,
                nodesRemoved: this.stats.totalNodesRemoved
            },
            pointsByConfirmation: pointsByConfirmation,
            metadata: model.metadata,
            isTopological: true,
            reliableNodeIds: Array.from(reliableNodeIds)
        };
    }

    // ==================== ИНФОРМАЦИЯ О МОДЕЛИ ====================

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

        let withMorphology = 0;
        for (const node of graph.nodes.values()) {
            if (node.morphology && node.hasContour) withMorphology++;
        }

        return {
            id: model.id,
            name: model.metadata.name,
            stats: {
                nodes: graph.nodes.size,
                edges: graph.edges.size,
                withMorphology,
                confirmed1: confirmations[1] || 0,
                confirmed2: confirmations[2] || 0,
                confirmed3: confirmations[3] || 0,
                confirmed4plus: confirmations['4+'] || 0,
                centerMatches: this.stats.totalCenterMatches,
                relativeMatches: this.stats.totalRelativeMatches,
                duplicatesSkipped: this.stats.totalDuplicatesSkipped,
                nodesRemoved: this.stats.totalNodesRemoved
            },
            metadata: model.metadata,
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated
        };
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        return {
            system: this.stats,
            models: {
                total: this.models.size,
                list: Array.from(this.models.keys()).map(id => {
                    const model = this.models.get(id);
                    const graph = model.graph;
                    return {
                        id,
                        name: model.metadata.name,
                        nodes: graph.nodes.size,
                        edges: graph.edges.size,
                        withMorphology: Array.from(graph.nodes.values()).filter(n => n.hasContour).length
                    };
                })
            },
            fingerprinter: this.fingerprinter.getStats(),
            localGroupSignature: this.localGroupSignature.getStats(),
            centerMatcher: this.centerMatcher.getStats(),
            relativePositioning: this.relativePositioning.getStats()
        };
    }

    // ==================== ОЧИСТКА ====================

    clear() {
        this.models.clear();
        this.currentModelId = null;
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
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log('🧹 TopologicalAccumulator очищен');
    }
}

module.exports = TopologicalAccumulator;
