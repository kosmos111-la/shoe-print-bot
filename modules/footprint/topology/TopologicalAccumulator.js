// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ АККУМУЛЯТИВНАЯ МОДЕЛЬ С ДОСТРАИВАНИЕМ ГРАФА (ДЕПЛОЙ)

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;
        this.minMatchesForEnhancement = options.minMatchesForEnhancement || 3;
        this.similarityThreshold = options.similarityThreshold || 0.6;

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
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log(`🏗️ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   Порог совпадения: ${this.similarityThreshold * 100}%`);
        console.log(`   Минимум для достройки: ${this.minMatchesForEnhancement} узлов`);
    }

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

        const comparison = this.fingerprinter.compareGraphs(
            existingModel.graph,
            existingModel.fingerprints,
            graph,
            fingerprints
        );

        if (comparison.similarity >= this.similarityThreshold) {
            console.log(`✅ СОВПАДЕНИЕ: ${(comparison.similarity * 100).toFixed(1)}% ≥ ${this.similarityThreshold * 100}%`);

            const enhancementResult = await this.enhanceModel(
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
                message: `Модель улучшена (+${enhancementResult.newNodesAdded} узлов)`
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
                source: options.source || 'unknown',
                ...options
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
            node.addedFrom = 'original_creation';
            node.addedAt = new Date();
        }

        this.models.set(modelId, model);
        this.currentModelId = modelId;
        this.stats.totalModels++;
        this.stats.lastUpdated = new Date();

        console.log(`🏗️ СОЗДАНА НОВАЯ МОДЕЛЬ "${modelId}":`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);

        const fpInfo = this.fingerprinter.getFingerprintInfo(fingerprints);
        console.log(`   Уникальных подписей: ${fpInfo.uniqueSignatures}/${fpInfo.totalNodes}`);

        return {
            status: 'created',
            modelId: modelId,
            nodes: graph.nodes.size,
            edges: graph.edges.size,
            avgDegree: graph.avgDegree,
            message: `Создана новая топологическая модель`
        };
    }

    async enhanceModel(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`🔧 ДОСТРАИВАЮ МОДЕЛЬ "${modelId}"...`);

        const model = this.models.get(modelId);
        const allMatches = comparison.allMatches || comparison.exactMatches || [];

        console.log(`📊 Использую для достройки: ${allMatches.length} совпадений`);

        if (allMatches.length < this.minMatchesForEnhancement) {
            console.log(`⚠️ Мало совпадений для достройки: ${allMatches.length} < ${this.minMatchesForEnhancement}`);
            return { newNodesAdded: 0, reason: 'insufficient_matches' };
        }

        const mapping = new Map();
        for (const match of allMatches) {
            if (!mapping.has(match.node2)) {
                mapping.set(match.node2, match.node1);
            }
        }

        const nodesToAdd = this.findNodesToAdd(
            model.graph,
            newGraph,
            newFingerprints,
            mapping
        );

        if (nodesToAdd.length === 0) {
            console.log(`✅ Все узлы уже есть в модели`);
            return { newNodesAdded: 0, reason: 'all_nodes_exist' };
        }

        console.log(`🎯 Найдено ${nodesToAdd.length} новых узлов для добавления`);

        // 🔥 ТРИАНГУЛЯЦИЯ
        const triangulatedNodes = await this.triangulateNodePositions(
            nodesToAdd,
            newGraph,
            model.graph,
            mapping
        );

        const addedNodes = this.addNodesToModel(
            modelId,
            triangulatedNodes,
            newGraph
        );

        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }

        this.updateNodeConfirmations(modelId, allMatches);

        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            exactMatches: allMatches.length,
            similarity: comparison.similarity,
            source: options.source || 'unknown',
            triangulated: triangulatedNodes.filter(n => n.triangulated).length
        });

        this.stats.totalEnhancements++;
        this.stats.lastUpdated = new Date();

        console.log(`✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
        console.log(`   🔺 По триангуляции: ${triangulatedNodes.filter(n => n.triangulated).length}`);

        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            allMatches: allMatches.length,
            triangulated: triangulatedNodes.filter(n => n.triangulated).length
        };
    }

    // 🔥 НОВЫЙ МЕТОД - ТРИАНГУЛЯЦИЯ
    async triangulateNodePositions(nodesToAdd, newGraph, modelGraph, mapping) {
        console.log(`🔺 Восстанавливаю позиции ${nodesToAdd.length} узлов...`);
        const triangulated = [];

        for (const nodeInfo of nodesToAdd) {
            const newNodeId = nodeInfo.nodeId;
            const newNode = newGraph.nodes.get(newNodeId);
            if (!newNode) continue;

            const neighbors = this.findThreeClosestInGraph(newNodeId, newGraph);
            const mappedNeighbors = neighbors
                .map(n => mapping.get(n))
                .filter(id => id && modelGraph.nodes.has(id));

            if (mappedNeighbors.length >= 3) {
                const [aId, bId, cId] = mappedNeighbors.slice(0, 3);
                const a = modelGraph.nodes.get(aId);
                const b = modelGraph.nodes.get(bId);
                const c = modelGraph.nodes.get(cId);
                
                const aNew = newGraph.nodes.get(neighbors[0]);
                const bNew = newGraph.nodes.get(neighbors[1]);
                const cNew = newGraph.nodes.get(neighbors[2]);

                const bary = this.computeBarycentric(newNode, aNew, bNew, cNew);
                
                const x = a.x * bary.alpha + b.x * bary.beta + c.x * bary.gamma;
                const y = a.y * bary.alpha + b.y * bary.beta + c.y * bary.gamma;
                
                nodeInfo.nodeData.x = x;
                nodeInfo.nodeData.y = y;
                nodeInfo.nodeData.triangulated = true;
                
                triangulated.push({ ...nodeInfo, triangulated: true });
            } else {
                triangulated.push({ ...nodeInfo, triangulated: false });
            }
        }

        console.log(`   ✅ Восстановлено: ${triangulated.filter(n => n.triangulated).length}/${nodesToAdd.length}`);
        return triangulated;
    }

    // 🔥 НОВЫЙ МЕТОД - ПОИСК БЛИЖАЙШИХ
    findThreeClosestInGraph(nodeId, graph) {
        const node = graph.nodes.get(nodeId);
        if (!node) return [];

        const distances = [];
        for (const [otherId, otherNode] of graph.nodes) {
            if (otherId === nodeId) continue;
            const dx = node.x - otherNode.x;
            const dy = node.y - otherNode.y;
            distances.push({ id: otherId, dist: Math.sqrt(dx * dx + dy * dy) });
        }

        return distances
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 3)
            .map(d => d.id);
    }

    // 🔥 НОВЫЙ МЕТОД - БАРИЦЕНТРИЧЕСКИЕ КООРДИНАТЫ
    computeBarycentric(p, a, b, c) {
        const v0 = { x: c.x - a.x, y: c.y - a.y };
        const v1 = { x: b.x - a.x, y: b.y - a.y };
        const v2 = { x: p.x - a.x, y: p.y - a.y };

        const dot00 = v0.x * v0.x + v0.y * v0.y;
        const dot01 = v0.x * v1.x + v0.y * v1.y;
        const dot02 = v0.x * v2.x + v0.y * v2.y;
        const dot11 = v1.x * v1.x + v1.y * v1.y;
        const dot12 = v1.x * v2.x + v1.y * v2.y;

        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const beta = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const gamma = (dot00 * dot12 - dot01 * dot02) * invDenom;
        const alpha = 1 - beta - gamma;

        return { alpha, beta, gamma };
    }

    findNodesToAdd(modelGraph, newGraph, newFingerprints, mapping) {
        const nodesToAdd = [];
        const mappedNodeIds = new Set(mapping.keys());

        for (const [nodeId, node] of newGraph.nodes) {
            if (mappedNodeIds.has(nodeId)) continue;
            if (modelGraph.nodes.has(nodeId)) continue;

            const connectionsToMatched = this.countConnectionsToMatched(
                nodeId,
                mappedNodeIds,
                newGraph.edges
            );

            if (connectionsToMatched >= 2) {
                nodesToAdd.push({
                    nodeId: nodeId,
                    nodeData: {
                        ...node,
                        id: nodeId,
                        x: node.x,
                        y: node.y,
                        confidence: node.confidence || 0.5,
                        connectionsToMatched: connectionsToMatched
                    },
                    connectionsToMatched: connectionsToMatched,
                    fingerprint: newFingerprints.get(nodeId),
                    reason: `connected to ${connectionsToMatched} matched nodes`
                });
            }
        }

        return nodesToAdd;
    }

    countConnectionsToMatched(nodeId, matchedNodeIds, edges) {
        let connections = 0;
        for (const edge of edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodeA === nodeId && matchedNodeIds.has(nodeB)) connections++;
            if (nodeB === nodeId && matchedNodeIds.has(nodeA)) connections++;
        }
        return connections;
    }

    addNodesToModel(modelId, nodesToAdd, sourceGraph) {
        const model = this.models.get(modelId);
        const addedNodes = [];

        for (const nodeInfo of nodesToAdd) {
            const nodeId = nodeInfo.nodeId;
            const nodeData = nodeInfo.nodeData;

            model.graph.nodes.set(nodeId, {
                ...nodeData,
                addedFrom: 'structural_enhancement',
                addedAt: new Date(),
                confirmationCount: 1,
                connectionsToMatched: nodeInfo.connectionsToMatched,
                triangulated: nodeData.triangulated || false
            });

            for (const edge of sourceGraph.edges) {
                const [nodeA, nodeB] = edge.split('--');
                if ((nodeA === nodeId && model.graph.nodes.has(nodeB)) ||
                    (nodeB === nodeId && model.graph.nodes.has(nodeA))) {
                    model.graph.edges.add(edge);
                }
            }

            addedNodes.push({
                id: nodeId,
                x: nodeData.x,
                y: nodeData.y,
                connectionsToMatched: nodeInfo.connectionsToMatched,
                addedReason: nodeInfo.reason,
                triangulated: nodeData.triangulated || false
            });
        }

        this.updateNodeDegrees(model.graph);
        return addedNodes;
    }

    updateNodeDegrees(graph) {
        for (const node of graph.nodes.values()) node.degree = 0;
        for (const edge of graph.edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (graph.nodes.has(nodeA)) graph.nodes.get(nodeA).degree++;
            if (graph.nodes.has(nodeB)) graph.nodes.get(nodeB).degree++;
        }
    }

    updateNodeConfirmations(modelId, matches) {
        const model = this.models.get(modelId);
        let updated = 0;
        for (const match of matches) {
            const nodeId = match.node1;
            if (model.graph.nodes.has(nodeId)) {
                const node = model.graph.nodes.get(nodeId);
                node.confirmationCount = (node.confirmationCount || 1) + 1;
                node.lastConfirmed = new Date();
                updated++;
            }
        }
        console.log(`📈 Обновлены подтверждения для ${updated} узлов`);
    }

    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
        console.log(`🔄 Обновляю WL-подписи для модели ${modelId}...`);
        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;
        console.log(`✅ Подписи обновлены: ${newFingerprints.size} узлов`);
        return newFingerprints;
    }

    getModelInfo(modelId = null) {
        const targetModelId = modelId || this.currentModelId;
        if (!targetModelId || !this.models.has(targetModelId)) return { error: 'Model not found' };

        const model = this.models.get(targetModelId);
        const graph = model.graph;
        const fpInfo = this.fingerprinter.getFingerprintInfo(model.fingerprints);

        return {
            id: model.id,
            name: model.metadata.name,
            stats: {
                nodes: graph.nodes.size,
                edges: graph.edges.size,
                avgDegree: graph.avgDegree || 0,
                uniqueSignatures: fpInfo.uniqueSignatures,
                uniquenessRatio: fpInfo.uniquenessRatio
            },
            metadata: model.metadata,
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated
        };
    }

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
            _version: '1.0'
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
                history: data.history || []
            };
            this.models.set(modelId, model);
            if (!this.currentModelId) this.currentModelId = modelId;
            return true;
        } catch (error) {
            return false;
        }
    }

    getStats() {
        const modelsInfo = [];
        let totalNodes = 0, totalEdges = 0;
        for (const [modelId, model] of this.models) {
            modelsInfo.push({
                id: modelId,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                createdAt: model.metadata.createdAt
            });
            totalNodes += model.graph.nodes.size;
            totalEdges += model.graph.edges.size;
        }
        return {
            system: this.stats,
            models: { total: this.models.size, totalNodes, totalEdges, list: modelsInfo },
            accumulator: {
                name: this.name,
                currentModelId: this.currentModelId,
                similarityThreshold: this.similarityThreshold,
                minMatchesForEnhancement: this.minMatchesForEnhancement
            }
        };
    }
}

module.exports = TopologicalAccumulator;
