// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ ЧИСТАЯ ТОПОЛОГИЯ - ТОЛЬКО ТОЧНЫЕ WL-ПОДПИСИ

const TriangulationMemory = require('./TriangulationMemory');
const { TrustLevelManager, TRUST_LEVELS } = require('./TrustLevel');

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;
        this.minMatchesForEnhancement = options.minMatchesForEnhancement || 3;
        this.similarityThreshold = options.similarityThreshold || 0.6;
       
        this.triangulation = new TriangulationMemory({ debug: this.debug });
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
        console.log(`   🔺 ТОЛЬКО ТОЧНЫЕ WL-ПОДПИСИ ДЛЯ МАППИНГА!`);
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
                method: 'exact_wl_matches_only'
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
       
        // 🔥🔥🔥 ТОЛЬКО ТОЧНЫЕ СОВПАДЕНИЯ! SIMILAR НЕ ИСПОЛЬЗУЕМ!
        const exactMatches = comparison.exactMatches || [];
       
        if (exactMatches.length < this.minMatchesForEnhancement) {
            console.log(`⚠️ Недостаточно точных совпадений: ${exactMatches.length} < ${this.minMatchesForEnhancement}`);
            return { newNodesAdded: 0, reason: 'insufficient_exact_matches' };
        }
       
        console.log(`🎯 Использую ТОЛЬКО точные WL-подписи: ${exactMatches.length} совпадений`);
       
        // Создаём маппинг ТОЛЬКО из точных совпадений
        const structuralMapping = this.createMappingFromExactMatches(exactMatches);
       
        console.log(`🗺️ Создан маппинг из ТОЧНЫХ WL-подписей: ${structuralMapping.size} соответствий`);
       
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
       
        const addedNodes = this.addNodesViaTriangulation(
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
            similarity: comparison.similarity,
            exactMatchesUsed: exactMatches.length
        });
       
        this.stats.totalEnhancements++;
        this.stats.totalTriangulated += addedNodes.filter(n => n.method === 'triangulation_3point').length;
        this.stats.lastUpdated = new Date();
       
        console.log(`✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
        console.log(`   🔺 По триангуляции: ${addedNodes.filter(n => n.method === 'triangulation_3point').length}`);
        console.log(`   🎯 Маяков в модели: ${beacons.length}`);
       
        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            triangulated: addedNodes.filter(n => n.method === 'triangulation_3point').length
        };
    }

    // 🔥🔥🔥 МАППИНГ ТОЛЬКО ИЗ ТОЧНЫХ СОВПАДЕНИЙ
    createMappingFromExactMatches(exactMatches) {
        const mapping = new Map();
        const usedModelNodes = new Set();
       
        for (const match of exactMatches) {
            const modelNodeId = match.node1;
            const newNodeId = match.node2;
           
            if (!usedModelNodes.has(modelNodeId)) {
                mapping.set(newNodeId, modelNodeId);
                usedModelNodes.add(modelNodeId);
            }
        }
       
        return mapping;
    }

    addNodesViaTriangulation(modelId, newNodes, newGraph, structuralMapping, options) {
        const model = this.models.get(modelId);
        const addedNodes = [];
       
        console.log(`🔺 Добавляю ${newNodes.length} узлов через триангуляцию...`);
       
        const anchors = [];
        for (const [newId, modelId] of structuralMapping) {
            const modelNode = model.graph.nodes.get(modelId);
            const newNode = newGraph.nodes.get(newId);
            if (modelNode && newNode) {
                anchors.push({
                    id: modelId,
                    node: modelNode,
                    newNode: newNode,
                    photo2Id: newId
                });
            }
        }
       
        console.log(`   🎯 Опорных точек (точные WL): ${anchors.length}`);
       
        for (const nodeInfo of newNodes) {
            const originalNodeId = nodeInfo.nodeId;
            const photo2Point = newGraph.nodes.get(originalNodeId);
            if (!photo2Point) continue;
           
            const closestInPhoto2 = this.findThreeClosestAnchors(photo2Point, anchors);
           
            if (closestInPhoto2.length < 3) {
                console.log(`   ⚠️ Недостаточно опорных точек (${closestInPhoto2.length}/3)`);
                continue;
            }
           
            const photo2Anchors = closestInPhoto2.map(a => ({
                id: a.photo2Id,
                node: a.newNode
            }));
           
            const modelAnchors = closestInPhoto2.map(a => ({
                id: a.id,
                node: a.node
            }));
           
            const triangle = this.triangulation.rememberTriangle(
                originalNodeId,
                photo2Point,
                photo2Anchors,
                modelAnchors
            );
           
            if (!triangle) {
                console.log(`   ⚠️ Не удалось построить треугольник`);
                continue;
            }
           
            const position = this.triangulation.reconstructPosition(originalNodeId, model.graph);
           
            if (!position) {
                console.log(`   ⚠️ Не удалось восстановить позицию`);
                continue;
            }
           
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
                confidence: photo2Point.confidence || 0.5,
                placementMethod: 'triangulation_3point',
                placementConfidence: position.confidence,
                triangulationMemory: true,
                anchor1: modelAnchors[0].id,
                anchor2: modelAnchors[1].id,
                anchor3: modelAnchors[2].id
            };
           
            model.graph.nodes.set(modelNodeId, newNode);
           
            let edgesAdded = 0;
            for (const anchor of modelAnchors) {
                if (model.graph.nodes.has(anchor.id)) {
                    const edge = [modelNodeId, anchor.id].sort().join('--');
                    model.graph.edges.add(edge);
                    edgesAdded++;
                    newNode.degree++;
                    model.graph.nodes.get(anchor.id).degree++;
                }
            }
           
            console.log(`   ✅ УСПЕШНО ВОССТАНОВЛЕНО:`);
            console.log(`      📍 Позиция: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
            console.log(`      🎯 Уверенность: ${(position.confidence * 100).toFixed(0)}%`);
            console.log(`      🔗 Связей: ${edgesAdded}`);
           
            addedNodes.push({
                id: modelNodeId,
                x: position.x,
                y: position.y,
                method: 'triangulation_3point',
                confidence: position.confidence,
                edgesAdded: edgesAdded
            });
        }
       
        console.log(`\n✅ Добавлено ${addedNodes.length} узлов через триангуляцию`);
        return addedNodes;
    }

    findThreeClosestAnchors(point, anchors) {
        if (anchors.length < 3) return [];
       
        const withDistance = anchors.map(a => ({
            ...a,
            distance: this.distance(point, a.newNode)
        }));
       
        withDistance.sort((a, b) => a.distance - b.distance);
        return withDistance.slice(0, 3);
    }

    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

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
                console.log(`   ✓ Новый узел: Y=${node.y.toFixed(1)}, соседей: ${neighbors.length}`);
            }
        }
       
        console.log(`🎯 Найдено ${newNodes.length} НОВЫХ узлов`);
        return newNodes;
    }

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

    applyTrustSystem(modelId, comparison) {
        const model = this.models.get(modelId);
        if (!model) return;
       
        const matchedNodes = new Set();
        const exactMatches = comparison.exactMatches || [];
       
        for (const match of exactMatches) {
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

    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
        console.log(`🔄 Обновляю подписи...`);
       
        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;
       
        console.log(`✅ Подписи обновлены: ${newFingerprints.size} узлов`);
        return newFingerprints;
    }

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
            _version: '12.0-exact-matches-only',
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
