// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ ЧИСТАЯ ТОПОЛОГИЯ + ТРИАНГУЛЯЦИЯ ПО 3 ТОЧКАМ В МОДЕЛИ

const TriangulationMemory = require('./TriangulationMemory');
const { TrustLevelManager, TRUST_LEVELS } = require('./TrustLevel');

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;
        this.minMatchesForEnhancement = options.minMatchesForEnhancement || 3;
        this.similarityThreshold = options.similarityThreshold || 0.6;
       
        // 🔥 ТРИАНГУЛЯЦИОННАЯ ПАМЯТЬ
        this.triangulation = new TriangulationMemory({ debug: this.debug });
       
        // 🔥 УПРАВЛЕНИЕ ДОВЕРИЕМ
        this.trustManager = new TrustLevelManager({ debug: this.debug });
       
        this.topologyBuilder = new (require('./TopologyBuilder'))({ debug: this.debug });
        this.fingerprinter = new (require('./TopologicalFingerprint'))({
            debug: this.debug,
            iterations: options.wlIterations || 3,
            bucketSize: 3,
            similarityThreshold: 0.7
        });
       
        this.models = new Map();
        this.currentModelId = null;
       
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalPointsProcessed: 0,
            totalTriangulated: 0,
            totalBeacons: 0,
            totalForgotten: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
       
        console.log(`🏗️ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   🔺 ТРИАНГУЛЯЦИЯ ПО 3 ТОЧКАМ В МОДЕЛИ: активна`);
        console.log(`   🎯 БАРИЦЕНТРИЧЕСКИЕ КООРДИНАТЫ = 100% точность`);
    }

    async processPoints(points, options = {}) {
        if (this.debug) console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК...`);
       
        const modelId = options.modelId || this.currentModelId;
        const pointSource = options.source || `source_${Date.now()}`;
       
        const graph = this.topologyBuilder.buildDelaunayGraph(points, pointSource);
        const fingerprints = this.fingerprinter.computeGraphFingerprints(graph);
       
        if (!modelId || !this.models.has(modelId)) {
            console.log(`🆕 СОЗДАЮ НОВУЮ МОДЕЛЬ`);
            return this.createNewModel(graph, fingerprints, points, options);
        }
       
        const existingModel = this.models.get(modelId);
        console.log(`🔍 СРАВНИВАЮ С МОДЕЛЬЮ "${modelId}"`);
       
        const comparison = this.fingerprinter.compareGraphs(
            existingModel.graph,
            existingModel.fingerprints,
            graph,
            fingerprints
        );
       
        this.applyTrustSystem(modelId, comparison);
       
        if (comparison.similarity >= this.similarityThreshold) {
            console.log(`✅ СТРУКТУРНОЕ СОВПАДЕНИЕ: ${(comparison.similarity * 100).toFixed(1)}%`);
           
            const enhancementResult = await this.enhanceModelStructural(
                modelId,
                graph,
                fingerprints,
                comparison,
                options
            );
           
            return {
                status: 'enhanced',
                modelId: modelId,
                similarity: comparison.similarity,
                exactMatches: comparison.exactMatches.length,
                newNodesAdded: enhancementResult.newNodesAdded,
                totalNodesInModel: this.models.get(modelId).graph.nodes.size,
                triangulatedNodes: enhancementResult.triangulated || 0,
                message: `Модель улучшена (+${enhancementResult.newNodesAdded} узлов)`,
                method: 'triangulation_3point_in_model'
            };
        } else {
            console.log(`🆕 РАЗНЫЕ СТРУКТУРЫ: ${(comparison.similarity * 100).toFixed(1)}%`);
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
            photoCoordinates: new Map(),
            metadata: {
                name: options.name || `Модель_${new Date().toLocaleTimeString('ru-RU')}`,
                createdAt: new Date(),
                pointsCount: originalPoints.length,
                nodesCount: graph.nodes.size,
                edgesCount: graph.edges.size,
                triangleCount: graph.triangles?.length || 0,
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
       
        for (const node of model.graph.nodes.values()) {
            node.confirmationCount = 1;
            node.unconfirmedStreak = 0;
            node.addedFrom = 'original_creation';
            node.addedAt = new Date();
            node.firstSeen = new Date();
            node.trustLevel = this.trustManager.getTrustLevel(node);
        }
       
        this.models.set(modelId, model);
        this.currentModelId = modelId;
        this.stats.totalModels++;
        this.stats.lastUpdated = new Date();
       
        console.log(`🏗️ СОЗДАНА НОВАЯ МОДЕЛЬ "${modelId}":`);
        console.log(`   Узлов: ${graph.nodes.size} (все с confirmationCount=1)`);
       
        return {
            status: 'created',
            modelId: modelId,
            nodes: graph.nodes.size,
            edges: graph.edges.size,
            avgDegree: graph.avgDegree
        };
    }

    async enhanceModelStructural(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`🔧 УЛУЧШЕНИЕ МОДЕЛИ "${modelId}"...`);
       
        const model = this.models.get(modelId);
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
       
        if (allMatches.length < this.minMatchesForEnhancement) {
            return { newNodesAdded: 0, reason: 'insufficient_matches' };
        }
       
        const structuralMapping = this.createStructuralMapping(
            model.fingerprints,
            newFingerprints,
            allMatches
        );
       
        console.log(`🗺️ Создан структурный маппинг: ${structuralMapping.size} соответствий`);
       
        this.saveOriginalCoordinates(model, newGraph, structuralMapping);
       
        const newNodes = this.findNewNodes(
            model.graph,
            newGraph,
            newFingerprints,
            structuralMapping
        );
       
        if (newNodes.length === 0) {
            console.log(`✅ Все узлы уже в модели`);
            return { newNodesAdded: 0 };
        }
       
        console.log(`🎯 Найдено ${newNodes.length} НОВЫХ узлов`);
       
        // 🔥🔥🔥 ЕДИНСТВЕННЫЙ МЕТОД - ТРИАНГУЛЯЦИЯ ПО 3 ТОЧКАМ В МОДЕЛИ
        const addedNodes = this.addNodesViaTriangulationInModel(
            modelId,
            newNodes,
            newGraph,
            structuralMapping,
            options
        );
       
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }
       
        this.increaseConfirmations(modelId, structuralMapping);
       
        const beacons = this.trustManager.getBeacons(model.graph);
        this.stats.totalBeacons = beacons.length;
       
        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            triangulated: addedNodes.filter(n => n.method === 'triangulation_3point').length,
            beacons: beacons.length,
            similarity: comparison.similarity
        });
       
        this.stats.totalEnhancements++;
        this.stats.totalTriangulated += addedNodes.filter(n => n.method === 'triangulation_3point').length;
        this.stats.lastUpdated = new Date();
       
        console.log(`✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
        console.log(`   🔺 По триангуляции в модели: ${addedNodes.filter(n => n.method === 'triangulation_3point').length}`);
        console.log(`   🎯 Маяков в модели: ${beacons.length}`);
       
        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            triangulated: addedNodes.filter(n => n.method === 'triangulation_3point').length
        };
    }

    // 🔥🔥🔥 ГЛАВНЫЙ МЕТОД - ВОССТАНОВЛЕНИЕ ПО 3 ТОЧКАМ В МОДЕЛИ
    addNodesViaTriangulationInModel(modelId, newNodes, newGraph, structuralMapping, options) {
        const model = this.models.get(modelId);
        const addedNodes = [];
       
        console.log(`🔺 Добавляю ${newNodes.length} узлов через триангуляцию по 3 точкам В МОДЕЛИ...`);
       
        // Собираем все опорные точки
        const anchors = [];
        for (const [newId, modelId] of structuralMapping) {
            const modelNode = model.graph.nodes.get(modelId);
            const newNode = newGraph.nodes.get(newId);
            if (modelNode && newNode) {
                anchors.push({
                    id: modelId,
                    node: modelNode,
                    newNode: newNode,
                    // Сохраняем координаты в обоих фото
                    modelX: modelNode.x,
                    modelY: modelNode.y,
                    photo2X: newNode.x,
                    photo2Y: newNode.y
                });
            }
        }
       
        console.log(`   🎯 Опорных точек: ${anchors.length}`);
       
        for (const nodeInfo of newNodes) {
            const originalNodeId = nodeInfo.nodeId;
            const sourceNode = newGraph.nodes.get(originalNodeId);
            if (!sourceNode) continue;
           
            console.log(`\n   🔍 Обрабатываю точку ${originalNodeId.substring(0, 20)}...`);
            console.log(`      Позиция в фото2: (${sourceNode.x.toFixed(1)}, ${sourceNode.y.toFixed(1)})`);
           
            // 🔥🔥🔥 1. НАХОДИМ ТРИ ЛУЧШИЕ ОПОРНЫЕ ТОЧКИ В МОДЕЛИ!
            const bestAnchors = this.triangulation.findThreeBestAnchorsInModel(
                sourceNode,
                originalNodeId,
                anchors,
                model.graph
            );
           
            if (bestAnchors.length < 3) {
                console.log(`   ⚠️ Недостаточно опорных точек в модели (${bestAnchors.length}/3)`);
                continue;
            }
           
            console.log(`   ✅ Выбраны 3 опорные точки в модели:`);
            bestAnchors.forEach((a, i) => {
                console.log(`      ${i+1}. ID: ${a.id.substring(0, 15)}...`);
                console.log(`         В модели: (${a.node.x.toFixed(1)}, ${a.node.y.toFixed(1)})`);
                console.log(`         В фото2: (${a.newNode.x.toFixed(1)}, ${a.newNode.y.toFixed(1)})`);
            });
           
            // 🔥🔥🔥 2. ЗАПОМИНАЕМ ТРЕУГОЛЬНИК!
            const triangle = this.triangulation.rememberTriangle(
                originalNodeId,
                sourceNode,
                bestAnchors[0].id,
                bestAnchors[1].id,
                bestAnchors[2].id,
                bestAnchors[0].node,
                bestAnchors[1].node,
                bestAnchors[2].node
            );
           
            if (!triangle) {
                console.log(`   ⚠️ Не удалось построить треугольник в модели`);
                continue;
            }
           
            // 🔥🔥🔥 3. ВОССТАНАВЛИВАЕМ ПОЗИЦИЮ!
            const position = this.triangulation.reconstructPosition(originalNodeId, model.graph);
           
            if (!position) {
                console.log(`   ⚠️ Не удалось восстановить позицию`);
                continue;
            }
           
            // Создаём узел в модели
            const modelNodeId = `structural_node_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
           
            const newNode = {
                id: modelNodeId,
                originalId: originalNodeId,
                degree: 0,
                confirmationCount: 1,
                unconfirmedStreak: 0,
                addedFrom: 'structural_enhancement',
                addedAt: new Date(),
                firstSeen: new Date(),
                x: position.x,
                y: position.y,
                confidence: sourceNode.confidence || 0.5,
                placementMethod: 'triangulation_3point',
                placementConfidence: position.confidence || 0.7,
                triangulationMemory: true,
                anchor1: bestAnchors[0].id,
                anchor2: bestAnchors[1].id,
                anchor3: bestAnchors[2].id,
                originalData: {
                    x: sourceNode._originalX || sourceNode.x,
                    y: sourceNode._originalY || sourceNode.y,
                    confidence: sourceNode.confidence,
                    source: sourceNode.source
                }
            };
           
            model.graph.nodes.set(modelNodeId, newNode);
           
            // Добавляем связи с тремя опорными точками
            let edgesAdded = 0;
            for (const anchor of bestAnchors) {
                if (model.graph.nodes.has(anchor.id)) {
                    const edge = [modelNodeId, anchor.id].sort().join('--');
                    model.graph.edges.add(edge);
                    edgesAdded++;
                    newNode.degree++;
                    model.graph.nodes.get(anchor.id).degree++;
                }
            }
           
            const bary = triangle.barycentric;
           
            console.log(`   ✅ УСПЕШНО ВОССТАНОВЛЕНО:`);
            console.log(`      ID в модели: ${modelNodeId.substring(0, 20)}...`);
            console.log(`      🔺 Барицентрические координаты: (${bary.alpha.toFixed(3)}, ${bary.beta.toFixed(3)}, ${bary.gamma.toFixed(3)})`);
            console.log(`      📍 Позиция в модели: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
            console.log(`      🎯 Уверенность: ${(position.confidence * 100).toFixed(0)}%`);
            console.log(`      🔗 Добавлено связей: ${edgesAdded}`);
           
            addedNodes.push({
                id: modelNodeId,
                x: position.x,
                y: position.y,
                method: 'triangulation_3point',
                confidence: position.confidence,
                edgesAdded: edgesAdded,
                barycentric: bary,
                photo2Y: sourceNode.y
            });
        }
       
        console.log(`\n✅ Добавлено ${addedNodes.length} узлов через триангуляцию в модели`);
        return addedNodes;
    }

    // 🔥 ПОИСК НОВЫХ УЗЛОВ
    findNewNodes(modelGraph, newGraph, newFingerprints, structuralMapping) {
        console.log(`🔍 Поиск новых узлов...`);
       
        const newNodes = [];
        const mappedIds = new Set(structuralMapping.keys());
       
        for (const [nodeId, node] of newGraph.nodes) {
            if (mappedIds.has(nodeId)) continue;
           
            const neighbors = this.findStructuralNeighbors(nodeId, newGraph, structuralMapping);
           
            if (neighbors.length >= 3) {
                newNodes.push({
                    nodeId: nodeId,
                    nodeData: node,
                    structuralNeighbors: neighbors,
                    neighborCount: neighbors.length
                });
                console.log(`   ✓ Новый узел: ${nodeId.substring(0, 25)}... Y=${node.y.toFixed(1)}, соседей: ${neighbors.length}`);
            }
        }
       
        console.log(`🎯 Найдено ${newNodes.length} НОВЫХ узлов`);
        return newNodes;
    }

    // 🔥 ПОИСК СОСЕДЕЙ В МАППИНГЕ
    findStructuralNeighbors(nodeId, newGraph, structuralMapping) {
        const neighbors = [];
        for (const edge of newGraph.edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodeA === nodeId && structuralMapping.has(nodeB)) {
                neighbors.push(structuralMapping.get(nodeB));
            } else if (nodeB === nodeId && structuralMapping.has(nodeA)) {
                neighbors.push(structuralMapping.get(nodeA));
            }
        }
        return neighbors;
    }

    // 🔥 СОЗДАНИЕ СТРУКТУРНОГО МАППИНГА
    createStructuralMapping(modelFingerprints, newFingerprints, matches) {
        const mapping = new Map();
        const usedModelNodes = new Set();
       
        for (const match of matches) {
            const modelNodeId = match.node1;
            const newNodeId = match.node2;
           
            const modelFp = modelFingerprints.get(modelNodeId);
            const newFp = newFingerprints.get(newNodeId);
           
            if (modelFp && newFp) {
                const isExact = modelFp.signature === newFp.signature;
                const isSimilar = match.confidence > 0.8;
               
                if (isExact || isSimilar) {
                    if (!usedModelNodes.has(modelNodeId)) {
                        mapping.set(newNodeId, modelNodeId);
                        usedModelNodes.add(modelNodeId);
                    }
                }
            }
        }
       
        return mapping;
    }

    // 🔥 СОХРАНЕНИЕ ОРИГИНАЛЬНЫХ КООРДИНАТ
    saveOriginalCoordinates(model, newGraph, structuralMapping) {
        if (!model.photoCoordinates) model.photoCoordinates = new Map();
       
        let saved = 0;
        for (const [newNodeId, modelNodeId] of structuralMapping) {
            const node = newGraph.nodes.get(newNodeId);
            if (node && node._hasOriginalCoordinates) {
                model.photoCoordinates.set(newNodeId, {
                    x: node._originalX,
                    y: node._originalY,
                    confidence: node.confidence || 0.5
                });
                saved++;
            }
        }
       
        if (saved > 0) console.log(`   📍 Сохранено ${saved} оригинальных координат`);
    }

    // 🔥 ПРИМЕНЕНИЕ СИСТЕМЫ ДОВЕРИЯ
    applyTrustSystem(modelId, comparison) {
        const model = this.models.get(modelId);
        if (!model) return;
       
        const matchedNodes = new Set();
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
       
        for (const match of allMatches) {
            if (match.node1 && model.graph.nodes.has(match.node1)) {
                matchedNodes.add(match.node1);
            }
        }
       
        let promoted = 0, demoted = 0, ghosts = 0;
       
        for (const [nodeId, node] of model.graph.nodes) {
            if (matchedNodes.has(nodeId)) {
                const oldLevel = this.trustManager.getTrustLevel(node).level;
                const newLevel = this.trustManager.promote(node).level;
                if (newLevel > oldLevel) promoted++;
            } else {
                this.trustManager.demote(node);
                demoted++;
            }
        }
       
        const ghostsIds = this.trustManager.cleanupGhosts(model.graph);
        for (const id of ghostsIds) {
            model.graph.nodes.delete(id);
            ghosts++;
        }
       
        if (ghosts > 0) this.stats.totalForgotten += ghosts;
       
        console.log(`📊 ДОВЕРИЕ: +${promoted} повышений, -${demoted} понижений, 👻 ${ghosts} призраков`);
    }

    // 🔥 УВЕЛИЧЕНИЕ ПОДТВЕРЖДЕНИЙ
    increaseConfirmations(modelId, structuralMapping) {
        const model = this.models.get(modelId);
        if (!model) return;
       
        let count = 0;
        for (const [newId, modelId] of structuralMapping) {
            const node = model.graph.nodes.get(modelId);
            if (node) {
                this.trustManager.promote(node);
                count++;
            }
        }
       
        console.log(`📈 Подтверждений: +${count}`);
    }

    // 🔥 ОБНОВЛЕНИЕ ПОДПИСЕЙ
    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
        console.log(`🔄 Обновляю подписи...`);
       
        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;
       
        console.log(`✅ Подписи обновлены: ${newFingerprints.size} узлов`);
        return newFingerprints;
    }

    // 🔥 ПОЛУЧЕНИЕ ИНФОРМАЦИИ О МОДЕЛИ
    getModelInfo(modelId = null) {
        const targetId = modelId || this.currentModelId;
        if (!targetId || !this.models.has(targetId)) return { error: 'Model not found' };
       
        const model = this.models.get(targetId);
        const graph = model.graph;
        const fpInfo = this.fingerprinter.getFingerprintInfo(model.fingerprints);
       
        let beacons = 0, stable = 0, confirmed = 0, newNodes = 0, fading = 0, ghosts = 0;
        let triangulatedNodes = 0;
       
        for (const node of graph.nodes.values()) {
            const level = this.trustManager.getTrustLevel(node);
            if (level.level === TRUST_LEVELS.BEACON) beacons++;
            else if (level.level === TRUST_LEVELS.STABLE) stable++;
            else if (level.level === TRUST_LEVELS.CONFIRMED) confirmed++;
            else if (level.level === TRUST_LEVELS.NEW) newNodes++;
            else if (level.level === TRUST_LEVELS.FADING) fading++;
            else if (level.level === TRUST_LEVELS.GHOST) ghosts++;
           
            if (node.placementMethod === 'triangulation_3point') triangulatedNodes++;
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
                beacons: beacons,
                stable: stable,
                confirmed: confirmed,
                new: newNodes,
                fading: fading,
                ghosts: ghosts,
                triangulatedNodes: triangulatedNodes,
                totalTriangulated: this.stats.totalTriangulated
            },
            metadata: model.metadata,
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated,
            triangulationMemory: this.triangulation.getStats()
        };
    }

    // 🔥 ПОЛУЧИТЬ ТРЕУГОЛЬНИКИ ДЛЯ ВИЗУАЛИЗАЦИИ
    getDebugTriangles() {
        return this.triangulation.getDebugTriangles();
    }

    // 🔥 ЭКСПОРТ
    exportModel(modelId = null) {
        const targetId = modelId || this.currentModelId;
        if (!targetId || !this.models.has(targetId)) return null;
       
        const model = this.models.get(targetId);
       
        return {
            id: model.id,
            name: model.metadata.name,
            graph: {
                nodes: Array.from(model.graph.nodes.entries()),
                edges: Array.from(model.graph.edges),
                triangles: model.graph.triangles,
                avgDegree: model.graph.avgDegree
            },
            fingerprints: Array.from(model.fingerprints.entries()),
            metadata: model.metadata,
            history: model.history,
            photoCoordinates: model.photoCoordinates ? Array.from(model.photoCoordinates.entries()) : [],
            triangulationMemory: this.triangulation.export(),
            stats: this.getModelInfo(targetId).stats,
            _version: '9.0-triangulation-in-model',
            _exportedAt: new Date().toISOString()
        };
    }

    // 🔥 ИМПОРТ
    importModel(data) {
        if (!data || !data.id || !data.graph) return false;
       
        try {
            const modelId = data.id;
            const graph = {
                nodes: new Map(data.graph.nodes),
                edges: new Set(data.graph.edges),
                triangles: data.graph.triangles,
                avgDegree: data.graph.avgDegree
            };
           
            const fingerprints = new Map(data.fingerprints);
           
            const model = {
                id: modelId,
                graph: graph,
                fingerprints: fingerprints,
                metadata: data.metadata || {},
                history: data.history || [],
                originalPoints: data.originalPoints || [],
                photoCoordinates: new Map(data.photoCoordinates || [])
            };
           
            this.models.set(modelId, model);
           
            if (data.triangulationMemory) {
                this.triangulation.import(data.triangulationMemory);
            }
           
            if (!this.currentModelId) this.currentModelId = modelId;
           
            console.log(`📥 Импортирована модель "${model.metadata.name}"`);
            console.log(`   Узлов: ${graph.nodes.size}, Рёбер: ${graph.edges.size}`);
           
            return true;
        } catch (error) {
            console.log(`❌ Ошибка импорта: ${error.message}`);
            return false;
        }
    }

    getStats() {
        const models = [];
        let totalNodes = 0;
       
        for (const [id, model] of this.models) {
            const info = this.getModelInfo(id);
            models.push({
                id,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                beacons: info.stats?.beacons || 0,
                triangulatedNodes: info.stats?.triangulatedNodes || 0
            });
            totalNodes += model.graph.nodes.size;
        }
       
        return {
            system: this.stats,
            models: {
                total: this.models.size,
                totalNodes,
                list: models
            },
            triangulationMemory: this.triangulation.getStats()
        };
    }
}

module.exports = TopologicalAccumulator;
