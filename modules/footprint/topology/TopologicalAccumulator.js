// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ АККУМУЛЯТИВНАЯ МОДЕЛЬ С КВАЗАРНОЙ НАВИГАЦИЕЙ

const GeometricSignature = require('./GeometricSignature');
const GeometryMemory = require('./GeometryMemory');
const AnchorPropagator = require('./AnchorPropagator');
const QuasarNavigation = require('./QuasarNavigation');

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;
        this.minMatchesForEnhancement = options.minMatchesForEnhancement || 3;
        this.similarityThreshold = options.similarityThreshold || 0.6;

        // Основные компоненты
        this.topologyBuilder = new (require('./TopologyBuilder'))({ debug: this.debug });

        // 🔥 WL - ТОЛЬКО ДЛЯ СРАВНЕНИЯ СЛЕДОВ
        this.fingerprinter = new (require('./TopologicalFingerprint'))({
            debug: this.debug,
            iterations: options.wlIterations || 3,
            similarityThreshold: 0.7
        });

        // 🔥 НОВАЯ СИСТЕМА - БЕЗ МАППИНГА!
        this.geometricSignature = new GeometricSignature({ debug: this.debug });
        this.geometryMemory = new GeometryMemory({ debug: this.debug });

        // 🔥 РАСПРОСТРАНЕНИЕ ОТ ЯКОРЕЙ
        this.anchorPropagator = new AnchorPropagator({
            debug: this.debug,
            minAnchors: 3
        });

        // 🔥 КВАЗАРНАЯ НАВИГАЦИЯ
        this.quasarNav = new QuasarNavigation({
            debug: this.debug,
            minAnchors: 3,
            similarityThreshold: 0.95
        });

        // Хранилище моделей
        this.models = new Map();
        this.currentModelId = null;

        // Статистика
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalPointsProcessed: 0,
            totalIdentified: 0,
            totalRestored: 0,
            totalClusters: 0,
            totalForgotten: 0,
            totalAnchors: 0,
            totalPropagated: 0,
            totalQuasarFound: 0,
            avgError: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log(`🏗️ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   🔥 WL: только для сравнения следов`);
        console.log(`   🎯 GeometricSignature: идентификация точек`);
        console.log(`   📐 GeometryMemory: восстановление позиций`);
        console.log(`   ⚓ AnchorPropagator: распространение от якорей (мин. ${this.anchorPropagator.minAnchors})`);
        console.log(`   🌌 QuasarNavigation: квазарная навигация (мин. 3 якоря, порог 95%)`);
    }

    // ==================== ОСНОВНЫЕ МЕТОДЫ ====================

    async processPoints(points, options = {}) {
        console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК...`);

        const modelId = options.modelId || this.currentModelId;
        const pointSource = options.source || `source_${Date.now()}`;

        const graph = this.topologyBuilder.buildDelaunayGraph(points, pointSource);
        const fingerprints = this.fingerprinter.computeGraphFingerprints(graph);

        if (!modelId || !this.models.has(modelId)) {
            console.log(`🆕 СОЗДАЮ НОВУЮ ТОПОЛОГИЧЕСКУЮ МОДЕЛЬ`);
            return this.createNewModel(graph, fingerprints, points, options);
        }

        const existingModel = this.models.get(modelId);
        console.log(`🔍 СРАВНИВАЮ С МОДЕЛЬЮ "${modelId}"`);

        // 🔥 ТОЛЬКО ДЛЯ СРАВНЕНИЯ! НЕ ДЛЯ МАППИНГА!
        const comparison = this.fingerprinter.compareGraphs(
            existingModel.graph,
            existingModel.fingerprints,
            graph,
            fingerprints
        );

        // Сохраняем similarity для статистики
        this.stats.similarity = comparison.similarity * 100;

        if (comparison.similarity >= this.similarityThreshold) {
            console.log(`✅ СОВПАДЕНИЕ: ${(comparison.similarity * 100).toFixed(1)}% ≥ ${this.similarityThreshold * 100}%`);

            const enhancementResult = await this.enhanceModel(
                modelId,
                graph,
                fingerprints,
                options
            );

            return {
                status: 'enhanced',
                modelId: modelId,
                similarity: comparison.similarity,
                newNodesAdded: enhancementResult.newNodesAdded,
                totalNodesInModel: this.models.get(modelId).graph.nodes.size,
                identified: enhancementResult.identified,
                restored: enhancementResult.restored,
                clusters: enhancementResult.clusters,
                anchors: enhancementResult.anchors,
                propagated: enhancementResult.propagated,
                quasarFound: enhancementResult.quasarFound,
                message: `Модель улучшена (🎯${enhancementResult.identified} ид, 📐${enhancementResult.restored} восст, 🔥${enhancementResult.clusters} класт, ⚓${enhancementResult.anchors} якорей, ➕${enhancementResult.propagated} распр, 🌌${enhancementResult.quasarFound} квазар)`
            };

        } else {
            console.log(`🆕 РАЗНЫЕ СЛЕДЫ: ${(comparison.similarity * 100).toFixed(1)}% < ${this.similarityThreshold * 100}%`);
            return this.createNewModel(graph, fingerprints, points, {
                ...options,
                comparedWith: modelId,
                similarity: comparison.similarity
            });
        }
    }

    createNewModel(graph, fingerprints, originalPoints, options = {}) {
        const modelId = `topo_model_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        const model = {
            id: modelId,
            graph: graph,
            fingerprints: fingerprints,
            originalPoints: originalPoints,
            metadata: {
                name: options.name || `Модель_${new Date().toLocaleTimeString('ru-RU')}`,
                createdAt: new Date(),
                pointsCount: originalPoints.length,
                nodesCount: graph.nodes.size,
                edgesCount: graph.edges.size,
                avgDegree: graph.avgDegree,
                source: options.source || 'unknown'
            },
            history: [{
                action: 'created',
                timestamp: new Date(),
                points: originalPoints.length,
                nodes: graph.nodes.size,
                edges: graph.edges.size
            }]
        };

        // 🔥🔥🔥 ЗАПОМИНАЕМ ВСЁ!
        console.log(`\n📐 Запоминаю точки в память...`);
        let rememberedCount = 0;

        for (const [nodeId, node] of graph.nodes) {
            node.confirmationCount = 1;
            node.addedFrom = 'original_creation';
            node.addedAt = new Date();

            const neighbors = this.findNodeNeighbors(nodeId, graph);

            // 1. GeometricSignature (для идентификации)
            this.geometricSignature.remember(nodeId, node, neighbors, graph);

            // 2. GeometryMemory (для восстановления позиций)
            const closest = this.geometryMemory.findThreeClosest(node, graph);
            if (closest.length >= 3) {
                const bary = this.geometryMemory.computeBarycentric(
                    node,
                    closest[0].node,
                    closest[1].node,
                    closest[2].node
                );

                this.geometryMemory.remember(
                    nodeId,
                    node,
                    closest.map(c => c.node),
                    bary
                );
                rememberedCount++;
            } else {
                if (this.debug) {
                    console.log(`   ⚠️ Недостаточно якорей для точки ${nodeId.substring(0, 20)}... (${closest.length}/3)`);
                }
            }
        }

        this.models.set(modelId, model);
        this.currentModelId = modelId;
        this.stats.totalModels++;
        this.stats.lastUpdated = new Date();

        console.log(`🏗️ СОЗДАНА НОВАЯ МОДЕЛЬ "${modelId}":`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   🎯 GeometricSignature: ${this.geometricSignature.signatures.size} записей`);
        console.log(`   📐 GeometryMemory: ${rememberedCount}/${graph.nodes.size} точек запомнено`);

        const fpInfo = this.fingerprinter.getFingerprintInfo(fingerprints);
        console.log(`   🔍 Уникальных WL-подписей: ${fpInfo.uniqueSignatures}/${fpInfo.totalNodes}`);

        return {
            status: 'created',
            modelId: modelId,
            nodes: graph.nodes.size,
            edges: graph.edges.size,
            avgDegree: graph.avgDegree,
            message: `Создана новая топологическая модель`
        };
    }

    // ==================== УЛУЧШЕНИЕ МОДЕЛИ ====================

    async enhanceModel(modelId, newGraph, newFingerprints, options = {}) {
        console.log(`\n🔧 ДОСТРАИВАЮ МОДЕЛЬ "${modelId}"...`);

        const model = this.models.get(modelId);

        // 🔥🔥🔥 ШАГ 1: ИДЕНТИФИКАЦИЯ ТОЧЕК
        const identification = await this.identifyPoints(model, newGraph);

        // 🔥🔥🔥 ШАГ 2: ПОИСК ЯКОРЕЙ
const anchors = this.geometricSignature.findAnchorPoints(newGraph.nodes, model.graph);
this.stats.totalAnchors = anchors.length;

// 🔥🔥🔥 ДИАГНОСТИКА: ПОКАЗЫВАЕМ 30 ЯКОРЕЙ
console.log(`\n📋 ТАБЛИЦА ЯКОРЕЙ (${anchors.length} пар):`);
console.log(`┌─────┬──────────────────────┬──────────────────────┬─────────────────────┬─────────────────────┬───────────┐`);
console.log(`│  #  │   ID В ФОТО 2         │   ID В МОДЕЛИ         │   КООРД. В ФОТО 2   │   КООРД. В МОДЕЛИ   │ РАССТОЯНИЕ│`);
console.log(`├─────┼──────────────────────┼──────────────────────┼─────────────────────┼─────────────────────┼───────────┤`);

const anchorsArray = Array.isArray(anchors) ? anchors : Array.from(anchors);
let exactMatches = 0;

anchorsArray.slice(0, 30).forEach((anchor, idx) => {
    const photoNode = newGraph.nodes.get(anchor.photoId);
    const modelNode = model.graph.nodes.get(anchor.modelId);
   
    if (!photoNode || !modelNode) return;
   
    const dx = photoNode.x - modelNode.x;
    const dy = photoNode.y - modelNode.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
   
    if (distance < 5) exactMatches++;
   
    console.log(
        `│ ${(idx+1).toString().padEnd(3)} │ ${anchor.photoId.substring(0, 20).padEnd(20)} │ ` +
        `${anchor.modelId.substring(0, 20).padEnd(20)} │ ` +
        `(${photoNode.x.toFixed(1).padStart(6)}, ${photoNode.y.toFixed(1).padStart(6)}) │ ` +
        `(${modelNode.x.toFixed(1).padStart(6)}, ${modelNode.y.toFixed(1).padStart(6)}) │ ` +
        `${distance.toFixed(1).padStart(7)}px │`
    );
});

console.log(`└─────┴──────────────────────┴──────────────────────┴─────────────────────┴─────────────────────┴───────────┘`);
console.log(`\n📊 ТОЧНОСТЬ ЯКОРЕЙ: ${exactMatches}/${anchorsArray.length} совпадают с точностью <5px`);

// 🔥🔥🔥 ШАГ 3: КВАЗАРНАЯ НАВИГАЦИЯ
let quasarFound = 0;
if (anchors.length >= 3) {
    console.log(`\n🌌 Запускаю квазарную навигацию с ${anchors.length} якорями...`);
   
    // 🔥 АБСОЛЮТНАЯ ЗАЩИТА: преобразуем anchors в массив
    const anchorsArray = Array.isArray(anchors) ? anchors : Array.from(anchors);
   
    console.log(`   Тип anchors: ${Array.isArray(anchorsArray) ? 'массив ✅' : typeof anchorsArray}`);
    if (anchorsArray.length > 0) {
        console.log(`   Первый якорь: ${anchorsArray[0]?.photoId?.substring(0, 12)}... ↔ ${anchorsArray[0]?.modelId?.substring(0, 12)}...`);
    }
   
    const quasarMatches = this.quasarNav.findAllMatches(
        newGraph,
        model.graph,
        anchorsArray  // ← теперь точно массив
    );
   
    for (const [photoId, matchInfo] of quasarMatches) {
        if (!identification.identifiedMap.has(photoId)) {
            identification.identifiedMap.set(photoId, matchInfo.modelId);
            identification.count++;
            quasarFound++;
           
            if (this.debug) {
                console.log(`      ✨ Найдено квазарами: сходство ${(matchInfo.similarity*100).toFixed(1)}%`);
            }
        }
    }
   
    console.log(`   ✅ Квазарами найдено: ${quasarFound} точек`);
    this.stats.totalQuasarFound += quasarFound;
}

        // 🔥🔥🔥 ШАГ 4: РАСПРОСТРАНЕНИЕ ОТ ЯКОРЕЙ
        let propagatedCount = 0;
        if (anchors.length >= 3) {
            console.log(`\n⚓ Запускаю распространение от ${anchors.length} якорей...`);

            const propagatedMatches = this.anchorPropagator.propagate(
                newGraph,
                model.graph,
                anchors
            );

            propagatedCount = propagatedMatches.size - anchors.length;
            this.stats.totalPropagated += propagatedCount;

            // Обновляем identifiedMap с учетом распространенных
            for (const [photoId, modelId] of propagatedMatches) {
                if (!identification.identifiedMap.has(photoId)) {
                    identification.identifiedMap.set(photoId, modelId);
                    identification.count++;
                }
            }

            console.log(`   ✅ Распространено: ${propagatedCount} новых точек`);
        }

        // 🔥🔥🔥 ШАГ 5: ВОССТАНОВЛЕНИЕ ПОЗИЦИЙ
        const restoration = await this.restorePositions(model, newGraph, identification.identifiedMap);

        // 🔥🔥🔥 ШАГ 6: ПОИСК НОВЫХ ТОЧЕК
        const newNodes = this.findNewNodes(model, newGraph, identification.identifiedMap);

        // 🔥🔥🔥 ШАГ 7: ДОБАВЛЕНИЕ НОВЫХ ТОЧЕК В МОДЕЛЬ
        const addedNodes = await this.addNewNodes(modelId, newNodes, newGraph, identification.identifiedMap);

        // 🔥🔥🔥 ШАГ 8: ОБНОВЛЕНИЕ СИГНАТУР
        for (const nodeId of addedNodes) {
            const node = model.graph.nodes.get(nodeId);
            if (node) {
                const neighbors = this.findNodeNeighbors(nodeId, model.graph);
                this.geometricSignature.remember(nodeId, node, neighbors, model.graph);

                const closest = this.geometryMemory.findThreeClosest(node, model.graph);
                if (closest.length >= 3) {
                    const bary = this.geometryMemory.computeBarycentric(
                        node,
                        closest[0].node,
                        closest[1].node,
                        closest[2].node
                    );

                    this.geometryMemory.remember(
                        nodeId,
                        node,
                        closest.map(c => c.node),
                        bary
                    );
                }
            }
        }

        // 🔄 ОБНОВЛЯЕМ ПОДПИСИ
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }

        // 📈 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ
        this.updateNodeConfirmations(model, identification.identifiedMap);

        // 📜 ИСТОРИЯ
        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            identified: identification.count,
            restored: restoration.count,
            clusters: identification.clusterCount,
            anchors: anchors.length,
            propagated: propagatedCount,
            quasarFound: quasarFound,
            totalNodes: model.graph.nodes.size
        });

        // 📊 ОБНОВЛЯЕМ СТАТИСТИКУ
        this.stats.totalEnhancements++;
        this.stats.totalIdentified += identification.count;
        this.stats.totalRestored += restoration.count;
        this.stats.totalClusters += identification.clusterCount;
        this.stats.avgError = restoration.avgError;
        this.stats.lastUpdated = new Date();

        // 📊 ФИНАЛЬНАЯ СТАТИСТИКА
        this.printFinalStats(model, newGraph, identification, restoration, addedNodes, anchors.length, propagatedCount, quasarFound);

        return {
            newNodesAdded: addedNodes.length,
            identified: identification.count,
            restored: restoration.count,
            clusters: identification.clusterCount,
            anchors: anchors.length,
            propagated: propagatedCount,
            quasarFound: quasarFound
        };
    }

    // ==================== ИДЕНТИФИКАЦИЯ ТОЧЕК ====================

    async identifyPoints(model, newGraph) {
        console.log(`\n📋 ТАБЛИЦА 1: ИДЕНТИФИКАЦИЯ ТОЧЕК (GEOMETRIC SIGNATURE)`);
        console.log(`┌─────┬──────────────────────┬─────────┬─────────┬──────────────────────┬─────────┬─────────┬────────────────────┬────────────────────┐`);
        console.log(`│  #  │   ТОЧКА В МОДЕЛИ      │ СТЕПЕНЬ │  ЗОНА   │   ТОЧКА В ФОТО 2      │ СТЕПЕНЬ │  ЗОНА   │ КООРД. МОДЕЛИ      │ КООРД. ФОТО 2      │`);
        console.log(`├─────┼──────────────────────┼─────────┼─────────┼──────────────────────┼─────────┼─────────┼────────────────────┼────────────────────┤`);

        const identifiedMap = new Map();
        const reverseMap = new Map();
        let identifiedCount = 0;
        let clusterCount = 0;

        for (const [nodeId, node] of newGraph.nodes) {
            const neighbors = this.findNodeNeighbors(nodeId, newGraph);

            const match = this.geometricSignature.identify(
                node,
                neighbors,
                newGraph,
                model.graph
            );

            if (match) {
                const modelNode = model.graph.nodes.get(match.nodeId);

                if (!modelNode) {
                    console.log(`   ⚠️ Пропущен призрак: ${match.nodeId} нет в модели`);
                    continue;
                }

                const zone = this.getZone(node.y);
                const modelZone = this.getZone(modelNode.y);

                identifiedMap.set(nodeId, match.nodeId);

                if (!reverseMap.has(match.nodeId)) {
                    reverseMap.set(match.nodeId, []);
                }
                reverseMap.get(match.nodeId).push(nodeId);

                console.log(
                    `│ ${(identifiedCount+1).toString().padEnd(3)} │ ${match.nodeId.substring(0, 20).padEnd(20)} │ ` +
                    `${modelNode.degree.toString().padEnd(7)} │ ${modelZone.padEnd(7)} │ ` +
                    `${nodeId.substring(0, 20).padEnd(20)} │ ` +
                    `${node.degree.toString().padEnd(7)} │ ${zone.padEnd(7)} │ ` +
                    `(${modelNode.x.toFixed(1).padStart(6)}, ${modelNode.y.toFixed(1).padStart(6)}) │ ` +
                    `(${node.x.toFixed(1).padStart(6)}, ${node.y.toFixed(1).padStart(6)}) │`
                );

                identifiedCount++;

                const closest = this.geometryMemory.findThreeClosest(node, newGraph);
                if (closest.length >= 3) {
                    const bary = this.geometryMemory.computeBarycentric(
                        node,
                        closest[0].node,
                        closest[1].node,
                        closest[2].node
                    );

                    this.geometryMemory.remember(
                        nodeId,
                        node,
                        closest.map(c => c.node),
                        bary
                    );
                }
            }
        }

        console.log(`└─────┴──────────────────────┴─────────┴─────────┴──────────────────────┴─────────┴─────────┴────────────────────┴────────────────────┘`);
        console.log(`\n📊 ИТОГ ИДЕНТИФИКАЦИИ:`);
        console.log(`   ✅ Идентифицировано точек: ${identifiedCount} из ${newGraph.nodes.size}`);

        console.log(`\n📋 ОБНАРУЖЕННЫЕ КЛАСТЕРЫ:`);
        for (const [modelId, childIds] of reverseMap) {
            if (childIds.length > 1) {
                clusterCount++;
                const modelNode = model.graph.nodes.get(modelId);
                console.log(`   🎯 Кластер ${clusterCount}:`);
                console.log(`      Модель: ${modelId.substring(0, 20)}... (${modelNode ? this.getZone(modelNode.y) : '?'})`);
                console.log(`      Детали: ${childIds.length} точек в фото2`);
                for (const childId of childIds) {
                    const childNode = newGraph.nodes.get(childId);
                    console.log(`         - ${childId.substring(0, 20)}... (${this.getZone(childNode.y)})`);
                }

                this.geometricSignature.registerCluster(modelId, childIds);
            }
        }

        return {
            count: identifiedCount,
            clusterCount,
            identifiedMap,
            reverseMap
        };
    }

    // ==================== ВОССТАНОВЛЕНИЕ ПОЗИЦИЙ ====================

    async restorePositions(model, newGraph, identifiedMap) {
        console.log(`\n📋 ТАБЛИЦА 2: ВОССТАНОВЛЕНИЕ ПОЗИЦИЙ (GEOMETRY MEMORY)`);
        console.log(`┌─────┬──────────────────────┬─────────────┬─────────┬──────────────────────┬─────────────┬─────────┬─────────┐`);
        console.log(`│  #  │   ТОЧКА В ФОТО 2      │   ОЖИДАЛАСЬ │  ЗОНА   │   ВОССТАНОВЛЕНА      │   РЕАЛЬНО   │  ЗОНА   │ ОШИБКА  │`);
        console.log(`├─────┼──────────────────────┼─────────────┼─────────┼──────────────────────┼─────────────┼─────────┼─────────┤`);

        let restoredCount = 0;
        let totalError = 0;
        let validErrors = 0;

        for (const [newNodeId, modelNodeId] of identifiedMap) {
            const position = this.geometryMemory.reconstruct(modelNodeId, model.graph);
            const node = newGraph.nodes.get(newNodeId);

            if (position && node && !isNaN(position.x) && !isNaN(position.y)) {
                const zone = this.getZone(node.y);
                const restoredZone = this.getZone(position.y);
                const error = Math.sqrt(
                    Math.pow(position.x - node.x, 2) +
                    Math.pow(position.y - node.y, 2)
                );

                console.log(
                    `│ ${(restoredCount+1).toString().padEnd(3)} │ ${newNodeId.substring(0, 20).padEnd(20)} │ ` +
                    `(${node.x.toFixed(1).padStart(6)}, ${node.y.toFixed(1).padStart(6)}) │ ${zone.padEnd(7)} │ ` +
                    `(${position.x.toFixed(1).padStart(6)}, ${position.y.toFixed(1).padStart(6)}) │ ` +
                    `${restoredZone.padEnd(7)} │ ${error.toFixed(1).padStart(6)}px │`
                );

                restoredCount++;
                totalError += error;
                validErrors++;

                this.geometryMemory.confirm(modelNodeId);
            } else {
                console.log(
                    `│ ${(restoredCount+1).toString().padEnd(3)} │ ${newNodeId.substring(0, 20).padEnd(20)} │ ` +
                    `(${node.x.toFixed(1).padStart(6)}, ${node.y.toFixed(1).padStart(6)}) │ ${this.getZone(node.y).padEnd(7)} │ ` +
                    `⚠️ НЕТ В ПАМЯТИ        │             │         │`
                );
            }
        }

        if (restoredCount === 0) {
            console.log(`│     │                      │             │         │                      │             │         │         │`);
        }

        console.log(`└─────┴──────────────────────┴─────────────┴─────────┴──────────────────────┴─────────────┴─────────┴─────────┘`);

        const avgError = validErrors > 0 ? totalError / validErrors : 0;

        console.log(`\n📊 ИТОГ ВОССТАНОВЛЕНИЯ:`);
        console.log(`   ✅ Восстановлено позиций: ${restoredCount}`);
        console.log(`   📏 Средняя ошибка: ${avgError.toFixed(2)}px`);

        return {
            count: restoredCount,
            avgError
        };
    }

    // ==================== ПОИСК НОВЫХ ТОЧЕК ====================

    findNewNodes(model, newGraph, identifiedMap) {
        const newNodes = [];
        const identifiedIds = new Set(identifiedMap.keys());

        for (const [nodeId, node] of newGraph.nodes) {
            if (!identifiedIds.has(nodeId) && !model.graph.nodes.has(nodeId)) {
                newNodes.push({
                    nodeId,
                    nodeData: {
                        ...node,
                        id: nodeId,
                        x: node.x,
                        y: node.y,
                        confidence: node.confidence || 0.5
                    }
                });
            }
        }

        console.log(`\n🔍 НОВЫЕ ТОЧКИ: ${newNodes.length}`);
        return newNodes;
    }

    // ==================== ДОБАВЛЕНИЕ НОВЫХ ТОЧЕК ====================

    async addNewNodes(modelId, newNodes, newGraph, identifiedMap) {
        const model = this.models.get(modelId);
        const addedNodes = [];

        for (const nodeInfo of newNodes) {
            const nodeId = nodeInfo.nodeId;
            const nodeData = nodeInfo.nodeData;

            if (model.graph.nodes.has(nodeId)) continue;

            const closest = this.geometryMemory.findThreeClosest(nodeData, newGraph);
            if (closest.length >= 3) {
                const bary = this.geometryMemory.computeBarycentric(
                    nodeData,
                    closest[0].node,
                    closest[1].node,
                    closest[2].node
                );

                this.geometryMemory.remember(
                    nodeId,
                    nodeData,
                    closest.map(c => c.node),
                    bary
                );
            }

            model.graph.nodes.set(nodeId, {
                ...nodeData,
                addedFrom: 'structural_enhancement',
                addedAt: new Date(),
                confirmationCount: 1
            });

            const edgesArray = Array.from(newGraph.edges || []);
            for (const edge of edgesArray) {
                const [nodeA, nodeB] = edge.split('--');
                if ((nodeA === nodeId && model.graph.nodes.has(nodeB)) ||
                    (nodeB === nodeId && model.graph.nodes.has(nodeA))) {
                    model.graph.edges.add(edge);
                }
            }

            addedNodes.push(nodeId);
        }

        this.updateNodeDegrees(model.graph);

        console.log(`   ✅ Добавлено в модель: ${addedNodes.length} узлов`);
        return addedNodes;
    }

    // ==================== ИТОГОВАЯ СТАТИСТИКА ====================

    printFinalStats(model, newGraph, identification, restoration, addedNodes, anchorsCount, propagatedCount, quasarFound) {
        console.log(`\n📊 ИТОГОВАЯ СТАТИСТИКА ОБРАБОТКИ:`);
        console.log(`┌───────────────────────────────────┬─────────────┐`);
        console.log(`│ Параметр                          │ Значение    │`);
        console.log(`├───────────────────────────────────┼─────────────┤`);
        console.log(`│ WL-сходство следов                │ ${this.stats.similarity?.toFixed(1) || '?'}%        │`);
        console.log(`├───────────────────────────────────┼─────────────┤`);
        console.log(`│ Точки в модели ДО обработки       │ ${model.graph.nodes.size - addedNodes.length}         │`);
        console.log(`├───────────────────────────────────┼─────────────┤`);
        console.log(`│ Точки в новом фото                │ ${newGraph.nodes.size}         │`);
        console.log(`├───────────────────────────────────┼─────────────┤`);
        console.log(`│ Идентифицировано (нашли себя)     │ ${identification.count}         │`);
        console.log(`├───────────────────────────────────┼─────────────┤`);
        console.log(`│   ▸ Одна-к-одной                  │ ${identification.count - identification.clusterCount}         │`);
        console.log(`│   ▸ Одна-ко-многим (кластеры)     │ ${identification.clusterCount}         │`);
        console.log(`├───────────────────────────────────┼─────────────┤`);
        console.log(`│   ▸ Из них якорей (WL≥0.5)        │ ${anchorsCount}         │`);
        console.log(`│   ▸ Из них квазарами               │ ${quasarFound}         │`);
        console.log(`│   ▸ Распространено от якорей      │ ${propagatedCount}         │`);
        console.log(`├───────────────────────────────────┼─────────────┤`);
        console.log(`│ Восстановлено позиций из памяти   │ ${restoration.count}         │`);
        console.log(`├───────────────────────────────────┼─────────────┤`);
        console.log(`│ Средняя ошибка восстановления     │ ${restoration.avgError.toFixed(2)}px      │`);
        console.log(`├───────────────────────────────────┼─────────────┤`);
        console.log(`│ Новых точек добавлено в модель    │ ${addedNodes.length}         │`);
        console.log(`├───────────────────────────────────┼─────────────┤`);
        console.log(`│ Точки в модели ПОСЛЕ обработки    │ ${model.graph.nodes.size}         │`);
        console.log(`└───────────────────────────────────┴─────────────┘`);

        const zoneStats = this.calculateZoneStats(model, newGraph, identification.identifiedMap);
        console.log(`\n📊 ДЕТАЛИЗАЦИЯ ПО ЗОНАМ:`);
        console.log(`┌─────────┬─────────────┬─────────────┬─────────────┬─────────────┐`);
        console.log(`│  ЗОНА   │  В МОДЕЛИ   │ В НОВОМ ФОТО│ НАЙДЕНО     │ ТОЧНОСТЬ    │`);
        console.log(`├─────────┼─────────────┼─────────────┼─────────────┼─────────────┤`);

        for (const zone of ['ПЯТКА', 'ЦЕНТР', 'НОСОК']) {
            const modelCount = Array.from(model.graph.nodes.values()).filter(
                n => this.getZone(n.y) === zone
            ).length;

            const newCount = Array.from(newGraph.nodes.values()).filter(
                n => this.getZone(n.y) === zone
            ).length;

            const found = zoneStats[zone] || 0;
            const accuracy = newCount > 0 ? (found / newCount * 100).toFixed(1) : '0.0';

            console.log(
                `│ ${zone.padEnd(7)} │ ${modelCount.toString().padStart(11)} │ ` +
                `${newCount.toString().padStart(11)} │ ${found.toString().padStart(11)} │ ` +
                `${accuracy.padStart(9)}% │`
            );
        }
        console.log(`└─────────┴─────────────┴─────────────┴─────────────┴─────────────┘`);
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        const edgesArray = Array.from(graph.edges || []);
        for (const edge of edgesArray) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodeA === nodeId) {
                const node = graph.nodes.get(nodeB);
                if (node) neighbors.push(node);
            }
            if (nodeB === nodeId) {
                const node = graph.nodes.get(nodeA);
                if (node) neighbors.push(node);
            }
        }
        return neighbors;
    }

    getZone(y) {
        if (y > 350) return 'ПЯТКА';
        if (y < 200) return 'НОСОК';
        return 'ЦЕНТР';
    }

    updateNodeDegrees(graph) {
        for (const node of graph.nodes.values()) node.degree = 0;
        const edgesArray = Array.from(graph.edges || []);
        for (const edge of edgesArray) {
            const [nodeA, nodeB] = edge.split('--');
            if (graph.nodes.has(nodeA)) graph.nodes.get(nodeA).degree++;
            if (graph.nodes.has(nodeB)) graph.nodes.get(nodeB).degree++;
        }
    }

    updateNodeConfirmations(model, identifiedMap) {
        let updated = 0;
        for (const [newId, modelId] of identifiedMap) {
            const node = model.graph.nodes.get(modelId);
            if (node) {
                node.confirmationCount = (node.confirmationCount || 1) + 1;
                node.lastConfirmed = new Date();
                updated++;
            }
        }
        console.log(`📈 Обновлены подтверждения для ${updated} узлов`);
    }

    calculateZoneStats(model, newGraph, identifiedMap) {
        const stats = { 'ПЯТКА': 0, 'ЦЕНТР': 0, 'НОСОК': 0 };

        for (const [newId, modelId] of identifiedMap) {
            const node = newGraph.nodes.get(newId);
            if (node) {
                const zone = this.getZone(node.y);
                stats[zone]++;
            }
        }

        return stats;
    }

    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
        console.log(`🔄 Обновляю WL-подписи...`);

        if (!model || !model.graph) {
            console.log(`   ⚠️ Модель или граф не найдены`);
            return;
        }

        const graph = model.graph;
        const edgesArray = Array.from(graph.edges || []);

        const tempGraph = {
            nodes: graph.nodes,
            edges: new Set(edgesArray)
        };

        const newFingerprints = this.fingerprinter.computeGraphFingerprints(tempGraph);
        model.fingerprints = newFingerprints;
        console.log(`✅ Подписи обновлены: ${newFingerprints.size} узлов`);
        return newFingerprints;
    }

    // ==================== МЕТОДЫ ДЛЯ ИНФОРМАЦИИ ====================

    getModelInfo(modelId = null) {
        const targetModelId = modelId || this.currentModelId;
        if (!targetModelId || !this.models.has(targetModelId)) return { error: 'Model not found' };

        const model = this.models.get(targetModelId);
        const graph = model.graph;
        const fpInfo = this.fingerprinter.getFingerprintInfo(model.fingerprints);
        const sigStats = this.geometricSignature.getStats();
        const memStats = this.geometryMemory.getStats();

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
                avgDegree: graph.avgDegree || 0,
                uniqueSignatures: fpInfo.uniqueSignatures,
                uniquenessRatio: fpInfo.uniquenessRatio,
                confirmed1: confirmations[1] || 0,
                confirmed2: confirmations[2] || 0,
                confirmed3: confirmations[3] || 0,
                confirmed4plus: confirmations['4+'] || 0,
                identified: this.stats.totalIdentified,
                restored: this.stats.totalRestored,
                clusters: this.stats.totalClusters,
                anchors: this.stats.totalAnchors,
                propagated: this.stats.totalPropagated,
                quasarFound: this.stats.totalQuasarFound,
                avgError: this.stats.avgError,
                memorySignatures: sigStats.totalSignatures,
                memoryPositions: memStats.totalPositions
            },
            metadata: model.metadata,
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated
        };
    }

    visualizeModel(modelId = null, options = {}) {
        const targetModelId = modelId || this.currentModelId;
        if (!targetModelId || !this.models.has(targetModelId)) {
            console.log('⚠️ Модель не найдена');
            return;
        }

        const model = this.models.get(targetModelId);
        const graph = model.graph;
        const sigStats = this.geometricSignature.getStats();
        const memStats = this.geometryMemory.getStats();

        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ МОДЕЛИ "${model.metadata.name}":`);
        console.log(`═`.repeat(70));
        console.log(`📊 ОБЩАЯ ИНФОРМАЦИЯ:`);
        console.log(`   ID: ${model.id}`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);
        console.log(`   🎯 GeometricSignature: ${sigStats.totalSignatures} записей, ${sigStats.totalClusters} кластеров`);
        console.log(`   📐 GeometryMemory: ${memStats.totalPositions} позиций`);
        console.log(`   ⚓ Якорей найдено: ${this.stats.totalAnchors}, распространено: ${this.stats.totalPropagated}`);
        console.log(`   🌌 Квазарами найдено: ${this.stats.totalQuasarFound}`);

        const confirmations = { 1: 0, 2: 0, 3: 0, '4+': 0 };
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmations['4+']++;
            else confirmations[count] = (confirmations[count] || 0) + 1;
        }

        console.log(`\n🎯 ПОДТВЕРЖДЕНИЯ:`);
        console.log(`   🔴 4+ подтверждений: ${confirmations['4+']} (ядра)`);
        console.log(`   🟠 3 подтверждения: ${confirmations[3]} (стабильные)`);
        console.log(`   🟡 2 подтверждения: ${confirmations[2]} (подтверждённые)`);
        console.log(`   🔵 1 подтверждение: ${confirmations[1]} (новые)`);

        const showNodes = options.showNodes || 8;
        console.log(`\n📋 УЗЛЫ (первые ${showNodes}):`);
        let count = 0;
        for (const [nodeId, node] of graph.nodes) {
            if (count++ >= showNodes) break;
            const source = node.addedFrom ? `[${node.addedFrom}]` : '[original]';
            const zone = this.getZone(node.y);
            console.log(
                `   ${nodeId.substring(0, 16)}... ${source}: ` +
                `(${node.x?.toFixed(1) || '?'}, ${node.y?.toFixed(1) || '?'}) ${zone} ` +
                `| ст:${node.degree} | п:${node.confirmationCount || 1}`
            );
        }

        if (graph.nodes.size > showNodes) {
            console.log(`   ... и еще ${graph.nodes.size - showNodes} узлов`);
        }

        console.log(`\n📜 ИСТОРИЯ (последние 3 действия):`);
        model.history.slice(-3).forEach((entry, idx) => {
            console.log(`   ${entry.action === 'created' ? '🆕' : '🔧'} ${entry.action.toUpperCase()}: ${new Date(entry.timestamp).toLocaleTimeString()}`);
            console.log(`      Узлов: ${entry.totalNodes || entry.nodes || '?'}`);
            if (entry.newNodes) console.log(`      +${entry.newNodes} новых узлов`);
            if (entry.identified) console.log(`      🎯 ${entry.identified} идентифицировано`);
            if (entry.restored) console.log(`      📐 ${entry.restored} восстановлено`);
            if (entry.clusters) console.log(`      🔥 ${entry.clusters} кластеров`);
            if (entry.anchors) console.log(`      ⚓ ${entry.anchors} якорей`);
            if (entry.propagated) console.log(`      ➕ ${entry.propagated} распространено`);
            if (entry.quasarFound) console.log(`      🌌 ${entry.quasarFound} квазарами`);
        });

        console.log(`═`.repeat(70));
    }

    // ==================== ЭКСПОРТ/ИМПОРТ ====================

    exportModel(modelId = null) {
        const targetModelId = modelId || this.currentModelId;
        if (!targetModelId || !this.models.has(targetModelId)) return null;

        const model = this.models.get(targetModelId);
        return {
            id: model.id,
            name: model.metadata.name,
            graph: {
                nodes: Array.from(model.graph.nodes.entries()),
                edges: Array.from(model.graph.edges),
                avgDegree: model.graph.avgDegree
            },
            fingerprints: Array.from(model.fingerprints.entries()),
            metadata: model.metadata,
            history: model.history,
            geometricSignature: this.geometricSignature.export(),
            geometryMemory: this.geometryMemory.export(),
            stats: this.getModelInfo(targetModelId).stats,
            _version: '11.0-quasar-navigation',
            _exportedAt: new Date().toISOString()
        };
    }

    importModel(data) {
        if (!data || !data.id || !data.graph) return false;
        try {
            const modelId = data.id;
            const graph = {
                nodes: new Map(data.graph.nodes),
                edges: new Set(data.graph.edges),
                avgDegree: data.graph.avgDegree
            };
            const fingerprints = new Map(data.fingerprints);
            const model = {
                id: modelId,
                graph: graph,
                fingerprints: fingerprints,
                metadata: data.metadata || {},
                history: data.history || [],
                originalPoints: data.originalPoints || []
            };

            if (data.geometricSignature) {
                this.geometricSignature.import(data.geometricSignature);
            }
            if (data.geometryMemory) {
                this.geometryMemory.import(data.geometryMemory);
            }

            this.models.set(modelId, model);
            if (!this.currentModelId) this.currentModelId = modelId;

            console.log(`📥 Импортирована модель "${model.metadata.name}"`);
            console.log(`   🎯 GeometricSignature: ${this.geometricSignature.signatures.size} записей`);
            console.log(`   📐 GeometryMemory: ${this.geometryMemory.positions.size} позиций`);
            return true;
        } catch (error) {
            console.log(`❌ Ошибка импорта: ${error.message}`);
            return false;
        }
    }

    getStats() {
        const modelsInfo = [];
        let totalNodes = 0;
        for (const [modelId, model] of this.models) {
            modelsInfo.push({
                id: modelId,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                identified: this.stats.totalIdentified,
                clusters: this.stats.totalClusters,
                anchors: this.stats.totalAnchors,
                propagated: this.stats.totalPropagated,
                quasarFound: this.stats.totalQuasarFound,
                createdAt: model.metadata.createdAt
            });
            totalNodes += model.graph.nodes.size;
        }
        return {
            system: this.stats,
            models: { total: this.models.size, totalNodes, list: modelsInfo },
            accumulator: {
                name: this.name,
                currentModelId: this.currentModelId,
                similarityThreshold: this.similarityThreshold,
                minMatchesForEnhancement: this.minMatchesForEnhancement
            },
            geometricSignature: this.geometricSignature.getStats(),
            geometryMemory: this.geometryMemory.getStats(),
            quasarNav: this.quasarNav.getStats()
        };
    }
}

module.exports = TopologicalAccumulator;
