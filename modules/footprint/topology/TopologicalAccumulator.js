// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ АККУМУЛЯТИВНАЯ МОДЕЛЬ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ (ПОЛНАЯ ВЕРСИЯ)

const GeometryMemory = require('./GeometryMemory');

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;
        this.minMatchesForEnhancement = options.minMatchesForEnhancement || 3;
        this.similarityThreshold = options.similarityThreshold || 0.6;

        // Основные компоненты
        this.topologyBuilder = new (require('./TopologyBuilder'))({ debug: this.debug });
        this.fingerprinter = new (require('./TopologicalFingerprint'))({
            debug: this.debug,
            iterations: options.wlIterations || 3,
            bucketSize: 3,
            similarityThreshold: 0.7
        });

        // 🔥 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ
        this.geometryMemory = new GeometryMemory({ debug: this.debug });

        // Хранилище моделей
        this.models = new Map();
        this.currentModelId = null;

        // Статистика
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalPointsProcessed: 0,
            totalTriangulated: 0,
            totalRestored: 0,
            totalRemembered: 0,
            totalExactMatches: 0,
            totalSimilarMatches: 0,
            totalLostPoints: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log(`🏗️ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   Порог совпадения: ${this.similarityThreshold * 100}%`);
        console.log(`   Минимум для достройки: ${this.minMatchesForEnhancement} узлов`);
        console.log(`   📐 Геометрическая память: активна`);
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
                similarMatches: comparison.similarMatches.length,
                newNodesAdded: enhancementResult.newNodesAdded,
                totalNodesInModel: this.models.get(modelId).graph.nodes.size,
                lostPoints: enhancementResult.lostPoints,
                mappingAccuracy: enhancementResult.mappingAccuracy,
                restoredFromMemory: enhancementResult.restoredFromMemory,
                triangulated: enhancementResult.triangulated || 0,
                message: `Модель улучшена (+${enhancementResult.newNodesAdded} узлов, ${enhancementResult.restoredFromMemory} из памяти)`
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
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);

        const fpInfo = this.fingerprinter.getFingerprintInfo(fingerprints);
        console.log(`   Уникальных подписей: ${fpInfo.uniqueSignatures}/${fpInfo.totalNodes}`);

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

    async enhanceModel(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`\n🔧 ДОСТРАИВАЮ МОДЕЛЬ "${modelId}"...`);

        const model = this.models.get(modelId);
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
        const exactMatches = comparison.exactMatches || [];
        const similarMatches = comparison.similarMatches || [];

        // 📊 ТАБЛИЦА 1: ТОЧКИ ИЗ МОДЕЛИ
        const { foundCount, lostCount } = await this.printModelPointsTable(model, newGraph, allMatches, exactMatches, similarMatches);
        const mappingAccuracy = model.graph.nodes.size > 0 ? (foundCount / model.graph.nodes.size * 100).toFixed(1) : '0.0';

        // 🗺️ СОЗДАЕМ МАППИНГ ДЛЯ ГЕОМЕТРИИ
        const mapping = new Map();
        for (const match of allMatches) {
            if (!mapping.has(match.node2)) {
                mapping.set(match.node2, match.node1);
            }
        }

        // 🔥 1. ВОССТАНАВЛИВАЕМ ТОЧКИ ИЗ ПАМЯТИ
        const restoredNodes = await this.restoreFromMemory(modelId, newGraph, model.graph, mapping);

        // 🔥 2. ИЩЕМ НОВЫЕ ТОЧКИ
        const newNodes = this.findNewNodes(model.graph, newGraph, newFingerprints, mapping);

        // 🔥 3. ЗАПОМИНАЕМ НОВЫЕ ТОЧКИ
        const rememberedNodes = await this.rememberNewNodes(modelId, newNodes, newGraph, model.graph, mapping);

        // 🔥 4. ТРИАНГУЛЯЦИЯ (ДЛЯ ТОЧЕК, КОТОРЫЕ НЕ ЗАПОМНИЛИСЬ)
        const triangulatedNodes = await this.triangulateNodePositions(
            newNodes.filter(n => !rememberedNodes.some(r => r.nodeId === n.nodeId)),
            newGraph,
            model.graph,
            mapping
        );

        // 📊 ТАБЛИЦА 2: НОВЫЕ ТОЧКИ
        await this.printNewPointsTable(newGraph, mapping, model.graph, [...restoredNodes, ...rememberedNodes, ...triangulatedNodes]);

        // 📊 ТАБЛИЦА 3: СТАТИСТИКА ПО ЗОНАМ
        const zoneStats = this.calculateZoneStats(model, newGraph, allMatches);
        this.printZoneStats(zoneStats, allMatches.length);

        // ✅ ДОБАВЛЯЕМ ВСЕ ТОЧКИ В МОДЕЛЬ
        const addedNodes = [];
       
        for (const nodeInfo of [...restoredNodes, ...rememberedNodes, ...triangulatedNodes]) {
            const added = this.addNodeToModel(modelId, nodeInfo, newGraph);
            if (added) addedNodes.push(added);
        }

        // 🔄 ОБНОВЛЯЕМ ПОДПИСИ
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }

        // 📈 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ
        this.updateNodeConfirmations(modelId, allMatches);

        // 📜 ИСТОРИЯ
        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            restoredFromMemory: restoredNodes.length,
            remembered: rememberedNodes.length,
            triangulated: triangulatedNodes.filter(n => n.nodeData?.triangulated).length,
            totalNodes: model.graph.nodes.size,
            exactMatches: exactMatches.length,
            similarMatches: similarMatches.length,
            lostPoints: lostCount,
            mappingAccuracy: mappingAccuracy,
            similarity: comparison.similarity,
            source: options.source || 'unknown'
        });

        // 📊 ОБНОВЛЯЕМ СТАТИСТИКУ
        this.stats.totalEnhancements++;
        this.stats.totalRestored += restoredNodes.length;
        this.stats.totalRemembered += rememberedNodes.length;
        this.stats.totalTriangulated += triangulatedNodes.filter(n => n.nodeData?.triangulated).length;
        this.stats.totalExactMatches = exactMatches.length;
        this.stats.totalSimilarMatches = similarMatches.length;
        this.stats.totalLostPoints = lostCount;
        this.stats.lastUpdated = new Date();

        console.log(`\n✅ МОДЕЛЬ УЛУЧШЕНА:`);
        console.log(`   +${addedNodes.length} узлов (из памяти: ${restoredNodes.length}, запомнено: ${rememberedNodes.length}, триангуляция: ${triangulatedNodes.filter(n => n.nodeData?.triangulated).length})`);
        console.log(`   Всего узлов: ${model.graph.nodes.size}`);
        console.log(`   🎯 Точность маппинга: ${mappingAccuracy}%`);
        console.log(`   📐 Геометрическая память: ${this.geometryMemory.memory.size} записей`);

        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            restoredFromMemory: restoredNodes.length,
            remembered: rememberedNodes.length,
            triangulated: triangulatedNodes.filter(n => n.nodeData?.triangulated).length,
            totalNodes: model.graph.nodes.size,
            allMatches: allMatches.length,
            lostPoints: lostCount,
            mappingAccuracy: mappingAccuracy
        };
    }

    // ==================== ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ ====================

    async restoreFromMemory(modelId, newGraph, modelGraph, mapping) {
        console.log(`\n📐 Восстанавливаю точки из геометрической памяти...`);
       
        const restored = [];
        const memorySize = this.geometryMemory.memory.size;
        console.log(`   Всего записей в памяти: ${memorySize}`);

        for (const [nodeId, node] of newGraph.nodes) {
            if (mapping.has(nodeId)) continue;
           
            const position = this.geometryMemory.reconstruct(nodeId, modelGraph);
           
            if (position) {
                restored.push({
                    nodeId: nodeId,
                    nodeData: {
                        ...node,
                        id: nodeId,
                        x: position.x,
                        y: position.y,
                        confidence: position.confidence || 0.8,
                        restoredFromMemory: true,
                        triangulated: false
                    },
                    reason: `восстановлено из памяти (уверенность ${(position.confidence * 100).toFixed(0)}%)`
                });

                this.geometryMemory.confirm(nodeId);
                this.stats.totalRestored++;

                if (this.debug) {
                    console.log(`   📍 ${nodeId.substring(0, 20)}... восстановлен`);
                    console.log(`      Позиция: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
                }
            }
        }

        console.log(`   ✅ Восстановлено: ${restored.length} узлов`);
        return restored;
    }

    async rememberNewNodes(modelId, newNodes, newGraph, modelGraph, mapping) {
        console.log(`\n📐 Запоминаю геометрию новых точек...`);
       
        const remembered = [];

        for (const nodeInfo of newNodes) {
            const nodeId = nodeInfo.nodeId;
            const node = newGraph.nodes.get(nodeId);
           
            if (!node) continue;

            const success = this.geometryMemory.remember(
                nodeId,
                node,
                nodeInfo.structuralNeighbors || [],
                newGraph,
                modelGraph,
                mapping
            );

            if (success) {
                remembered.push({
                    ...nodeInfo,
                    nodeData: {
                        ...nodeInfo.nodeData,
                        remembered: true,
                        triangulated: false
                    }
                });

                this.stats.totalRemembered++;
            }
        }

        console.log(`   ✅ Запомнено: ${remembered.length} узлов`);
        return remembered;
    }

    // ==================== ТРИАНГУЛЯЦИЯ ====================

    async triangulateNodePositions(nodesToAdd, newGraph, modelGraph, mapping) {
        if (nodesToAdd.length === 0) return [];
       
        console.log(`\n🔺 Восстанавливаю позиции ${nodesToAdd.length} узлов через триангуляцию...`);
       
        const triangulated = [];

        for (const nodeInfo of nodesToAdd) {
            const newNodeId = nodeInfo.nodeId;
            const newNode = newGraph.nodes.get(newNodeId);
            if (!newNode) {
                triangulated.push(nodeInfo);
                continue;
            }

            // Находим ВСЕХ соседей в маппинге
            const candidates = [];
            for (const edge of newGraph.edges) {
                const [nodeA, nodeB] = edge.split('--');
                if (nodeA === newNodeId && mapping.has(nodeB)) {
                    const neighborNode = newGraph.nodes.get(nodeB);
                    candidates.push({
                        id: mapping.get(nodeB),
                        node: neighborNode,
                        modelNode: modelGraph.nodes.get(mapping.get(nodeB)),
                        dist: this.distance(newNode, neighborNode)
                    });
                } else if (nodeB === newNodeId && mapping.has(nodeA)) {
                    const neighborNode = newGraph.nodes.get(nodeA);
                    candidates.push({
                        id: mapping.get(nodeA),
                        node: neighborNode,
                        modelNode: modelGraph.nodes.get(mapping.get(nodeA)),
                        dist: this.distance(newNode, neighborNode)
                    });
                }
            }

            if (candidates.length < 3) {
                triangulated.push(nodeInfo);
                continue;
            }

            // Сортируем по расстоянию
            candidates.sort((a, b) => a.dist - b.dist);

            // Берём топ-6 и ищем лучший треугольник
            let bestTriangle = null;
            let bestScore = -1;
            const topN = Math.min(6, candidates.length);

            for (let i = 0; i < topN; i++) {
                for (let j = i + 1; j < topN; j++) {
                    for (let k = j + 1; k < topN; k++) {
                        const a = candidates[i].modelNode;
                        const b = candidates[j].modelNode;
                        const c = candidates[k].modelNode;

                        if (!a || !b || !c) continue;

                        const area = Math.abs(
                            (b.x - a.x) * (c.y - a.y) -
                            (b.y - a.y) * (c.x - a.x)
                        ) / 2;

                        const ab = this.distance(a, b);
                        const bc = this.distance(b, c);
                        const ca = this.distance(c, a);
                        const maxSide = Math.max(ab, bc, ca);
                        const minSide = Math.min(ab, bc, ca);
                        const uniformity = minSide / (maxSide + 0.0001);

                        const score = area * 0.01 + uniformity * 10;

                        if (score > bestScore) {
                            bestScore = score;
                            bestTriangle = { i, j, k };
                        }
                    }
                }
            }

            if (bestTriangle) {
                const { i, j, k } = bestTriangle;

                const aId = candidates[i].id;
                const bId = candidates[j].id;
                const cId = candidates[k].id;

                const a = candidates[i].modelNode;
                const b = candidates[j].modelNode;
                const c = candidates[k].modelNode;

                const aNew = candidates[i].node;
                const bNew = candidates[j].node;
                const cNew = candidates[k].node;

                const bary = this.computeBarycentric(newNode, aNew, bNew, cNew);

                let x = a.x * bary.alpha + b.x * bary.beta + c.x * bary.gamma;
                let y = a.y * bary.alpha + b.y * bary.beta + c.y * bary.gamma;

                // Мягкие границы
                const BOUNDS = { minX: 0, maxX: 800, minY: 0, maxY: 600 };
                x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, x));
                y = Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, y));

                nodeInfo.nodeData.x = x;
                nodeInfo.nodeData.y = y;
                nodeInfo.nodeData.triangulated = true;

                triangulated.push(nodeInfo);

                if (this.debug) {
                    console.log(`   🔺 ${newNodeId.substring(0, 20)}... восстановлен триангуляцией`);
                    console.log(`      Позиция: (${x.toFixed(1)}, ${y.toFixed(1)})`);
                }
            } else {
                triangulated.push(nodeInfo);
            }
        }

        console.log(`   ✅ Восстановлено триангуляцией: ${triangulated.filter(n => n.nodeData?.triangulated).length}/${nodesToAdd.length}`);
        return triangulated;
    }

    // ==================== ПОИСК НОВЫХ УЗЛОВ ====================

    findNewNodes(modelGraph, newGraph, newFingerprints, mapping) {
        const nodesToAdd = [];
        const mappedNodeIds = new Set(mapping.keys());
        const rememberedNodeIds = new Set();

        for (const [nodeId] of this.geometryMemory.memory) {
            rememberedNodeIds.add(nodeId);
        }

        for (const [nodeId, node] of newGraph.nodes) {
            if (mappedNodeIds.has(nodeId)) continue;
            if (rememberedNodeIds.has(nodeId)) continue;
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
                    structuralNeighbors: this.findStructuralNeighbors(nodeId, newGraph, mapping),
                    fingerprint: newFingerprints.get(nodeId),
                    reason: `connected to ${connectionsToMatched} matched nodes`
                });
            }
        }

        return nodesToAdd;
    }

    findStructuralNeighbors(nodeId, newGraph, mapping) {
        const neighbors = [];
        for (const edge of newGraph.edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodeA === nodeId && mapping.has(nodeB)) {
                neighbors.push(mapping.get(nodeB));
            } else if (nodeB === nodeId && mapping.has(nodeA)) {
                neighbors.push(mapping.get(nodeA));
            }
        }
        return neighbors;
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

    // ==================== УПРАВЛЕНИЕ МОДЕЛЬЮ ====================

    addNodeToModel(modelId, nodeInfo, sourceGraph) {
        const model = this.models.get(modelId);
        const nodeId = nodeInfo.nodeId;
        const nodeData = nodeInfo.nodeData;

        if (model.graph.nodes.has(nodeId)) return null;

        model.graph.nodes.set(nodeId, {
            ...nodeData,
            addedFrom: 'structural_enhancement',
            addedAt: new Date(),
            confirmationCount: 1,
            connectionsToMatched: nodeInfo.connectionsToMatched || 0
        });

        for (const edge of sourceGraph.edges) {
            const [nodeA, nodeB] = edge.split('--');
            if ((nodeA === nodeId && model.graph.nodes.has(nodeB)) ||
                (nodeB === nodeId && model.graph.nodes.has(nodeA))) {
                model.graph.edges.add(edge);
            }
        }

        this.updateNodeDegrees(model.graph);

        if (this.debug) {
            console.log(`   + ${nodeId.substring(0, 20)}... ${nodeInfo.reason || 'добавлен'}`);
        }

        return {
            id: nodeId,
            x: nodeData.x,
            y: nodeData.y,
            addedReason: nodeInfo.reason,
            restoredFromMemory: nodeData.restoredFromMemory || false,
            remembered: nodeData.remembered || false,
            triangulated: nodeData.triangulated || false
        };
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
               
                this.geometryMemory.confirm(nodeId);
                updated++;
            }
        }

        console.log(`📈 Обновлены подтверждения для ${updated} узлов`);
    }

    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
        console.log(`🔄 Обновляю WL-подписи...`);
        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;
        console.log(`✅ Подписи обновлены: ${newFingerprints.size} узлов`);
        return newFingerprints;
    }

    // ==================== ГЕОМЕТРИЧЕСКИЕ ПРИМИТИВЫ ====================

    distance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

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

    // ==================== ДИАГНОСТИКА ====================

    async printModelPointsTable(model, newGraph, allMatches, exactMatches, similarMatches) {
        console.log(`\n📋 ТАБЛИЦА 1: ТОЧКИ ИЗ ПЕРВОГО ФОТО (МОДЕЛЬ) - СТАТУС ВО ВТОРОМ ФОТО`);
        console.log(`┌─────┬────────────────────┬─────────────┬─────────┬────────────────────┬─────────────┬─────────┐`);
        console.log(`│  #  │   ТОЧКА В МОДЕЛИ   │ КООРДИНАТЫ  │  ЗОНА   │   СООТВЕТСТВИЕ В   │ КООРДИНАТЫ  │ СТАТУС  │`);
        console.log(`│     │                    │             │         │       ФОТО 2       │             │         │`);
        console.log(`├─────┼────────────────────┼─────────────┼─────────┼────────────────────┼─────────────┼─────────┤`);

        const matchMap = new Map();
        for (const match of allMatches) matchMap.set(match.node1, match.node2);

        const modelNodes = Array.from(model.graph.nodes.entries());
        let foundCount = 0, lostCount = 0;

        modelNodes.slice(0, 30).forEach(([nodeId, node], idx) => {
            const zone = node.y > 350 ? 'ПЯТКА' : node.y < 200 ? 'НОСОК' : 'ЦЕНТР';
            const matchNodeId = matchMap.get(nodeId);
           
            if (matchNodeId) {
                const matchNode = newGraph.nodes.get(matchNodeId);
                const matchZone = matchNode ? (matchNode.y > 350 ? 'ПЯТКА' : matchNode.y < 200 ? 'НОСОК' : 'ЦЕНТР') : '?';
                const isExact = exactMatches.some(m => m.node1 === nodeId);
                const isSimilar = similarMatches.some(m => m.node1 === nodeId);
                const status = isExact ? '✅ ТОЧНОЕ' : (isSimilar ? '🔄 ПОХОЖЕЕ' : '⚠️ НЕОПР');
                const zoneMatch = zone === matchZone ? '✅' : '❌';
               
                console.log(
                    `│ ${(idx+1).toString().padEnd(3)} │ ${nodeId.substring(0, 18).padEnd(18)} │ ` +
                    `(${node.x.toFixed(1).padStart(6)}, ${node.y.toFixed(1).padStart(6)}) │ ${zone.padEnd(7)} │ ` +
                    `${matchNodeId.substring(0, 18).padEnd(18)} │ ` +
                    `(${matchNode?.x.toFixed(1).padStart(6) || '?'}, ${matchNode?.y.toFixed(1).padStart(6) || '?'}) │ ` +
                    `${status} ${zoneMatch} │`
                );
                foundCount++;
            } else {
                console.log(
                    `│ ${(idx+1).toString().padEnd(3)} │ ${nodeId.substring(0, 18).padEnd(18)} │ ` +
                    `(${node.x.toFixed(1).padStart(6)}, ${node.y.toFixed(1).padStart(6)}) │ ${zone.padEnd(7)} │ ` +
                    `${' '.repeat(18)} │ ${' '.repeat(23)} │ ` +
                    `❌ ПОТЕРЯНА   │`
                );
                lostCount++;
            }
        });

        if (modelNodes.length > 30) {
            console.log(`│ ... │       ...          │    ...     │   ...   │       ...          │      ...      │    ...    │`);
        }

        console.log(`└─────┴────────────────────┴─────────────┴─────────┴────────────────────┴─────────────┴─────────┘`);
        console.log(`\n📊 СТАТИСТИКА ТОЧЕК МОДЕЛИ:`);
        console.log(`   ✅ Найдено во втором фото: ${foundCount} из ${modelNodes.length}`);
        console.log(`   ❌ Потеряно: ${lostCount} из ${modelNodes.length}`);
        console.log(`   📈 Точность сохранения: ${((foundCount / modelNodes.length) * 100).toFixed(1)}%`);

        return { foundCount, lostCount };
    }

    async printNewPointsTable(newGraph, mapping, modelGraph, addedNodes) {
        console.log(`\n📋 ТАБЛИЦА 2: НОВЫЕ ТОЧКИ ТОЛЬКО ВО ВТОРОМ ФОТО`);
        console.log(`┌─────┬────────────────────┬─────────────┬─────────┬────────────────────┬─────────────┬─────────┐`);
        console.log(`│  #  │   ТОЧКА В ФОТО 2   │ КООРДИНАТЫ  │  ЗОНА   │   ВОССТАНОВЛЕНА    │ КООРДИНАТЫ  │ СТАТУС  │`);
        console.log(`│     │                    │             │         │     В МОДЕЛИ       │ В МОДЕЛИ    │         │`);
        console.log(`├─────┼────────────────────┼─────────────┼─────────┼────────────────────┼─────────────┼─────────┤`);

        const mappedNodeIds = new Set(mapping.keys());
        const addedNodeMap = new Map();
        for (const n of addedNodes) addedNodeMap.set(n.nodeId, n);
       
        let newPoints = [];
        for (const [nodeId, node] of newGraph.nodes) {
            if (!mappedNodeIds.has(nodeId) && !modelGraph.nodes.has(nodeId)) {
                newPoints.push({ nodeId, node });
            }
        }

        newPoints.slice(0, 20).forEach(({nodeId, node}, idx) => {
            const zone = node.y > 350 ? 'ПЯТКА' : node.y < 200 ? 'НОСОК' : 'ЦЕНТР';
            const modelNode = modelGraph.nodes.get(nodeId);
            const addedNode = addedNodeMap.get(nodeId);
           
            if (modelNode) {
                const modelZone = modelNode.y > 350 ? 'ПЯТКА' : modelNode.y < 200 ? 'НОСОК' : 'ЦЕНТР';
                const zoneMatch = zone === modelZone ? '✅' : '❌';
               
                let status = '📍 КОПИЯ';
                if (addedNode?.nodeData?.restoredFromMemory) status = '📎 ПАМЯТЬ';
                if (addedNode?.nodeData?.triangulated) status = '🔺 ТРИАНГУЛЯЦИЯ';
                if (addedNode?.nodeData?.remembered) status = '📐 ЗАПОМНЕНО';
               
                console.log(
                    `│ ${(idx+1).toString().padEnd(3)} │ ${nodeId.substring(0, 18).padEnd(18)} │ ` +
                    `(${node.x.toFixed(1).padStart(6)}, ${node.y.toFixed(1).padStart(6)}) │ ${zone.padEnd(7)} │ ` +
                    `${modelNode.id.substring(0, 18).padEnd(18)} │ ` +
                    `(${modelNode.x.toFixed(1).padStart(6)}, ${modelNode.y.toFixed(1).padStart(6)}) │ ` +
                    `${status} ${zoneMatch} │`
                );
            } else {
                console.log(
                    `│ ${(idx+1).toString().padEnd(3)} │ ${nodeId.substring(0, 18).padEnd(18)} │ ` +
                    `(${node.x.toFixed(1).padStart(6)}, ${node.y.toFixed(1).padStart(6)}) │ ${zone.padEnd(7)} │ ` +
                    `${' '.repeat(18)} │ ${' '.repeat(23)} │ ` +
                    `⏳ ОЖИДАЕТ   │`
                );
            }
        });

        if (newPoints.length > 20) {
            console.log(`│ ... │       ...          │    ...     │   ...   │       ...          │      ...      │    ...    │`);
        }

        console.log(`└─────┴────────────────────┴─────────────┴─────────┴────────────────────┴─────────────┴─────────┘`);
    }

    calculateZoneStats(model, newGraph, allMatches) {
        const zoneStats = {
            HEEL: { total: 0, correct: 0, wrong: 0, lost: 0 },
            CENTER: { total: 0, correct: 0, wrong: 0, lost: 0 },
            TOE: { total: 0, correct: 0, wrong: 0, lost: 0 }
        };

        const matchMap = new Map();
        for (const match of allMatches) matchMap.set(match.node1, match.node2);

        for (const [nodeId, node] of model.graph.nodes) {
            const zone = node.y > 350 ? 'HEEL' : node.y < 200 ? 'TOE' : 'CENTER';
            zoneStats[zone].total++;
           
            const matchNodeId = matchMap.get(nodeId);
            if (matchNodeId) {
                const matchNode = newGraph.nodes.get(matchNodeId);
                const matchZone = matchNode ? (matchNode.y > 350 ? 'HEEL' : matchNode.y < 200 ? 'TOE' : 'CENTER') : zone;
                if (matchZone === zone) zoneStats[zone].correct++;
                else zoneStats[zone].wrong++;
            } else {
                zoneStats[zone].lost++;
            }
        }

        return zoneStats;
    }

    printZoneStats(zoneStats, totalMatches) {
        console.log(`\n📋 ТАБЛИЦА 3: ДЕТАЛИЗАЦИЯ СОВПАДЕНИЙ ПО ЗОНАМ`);
        console.log(`┌─────────┬─────────────┬──────────┬──────────┬──────────┬──────────┐`);
        console.log(`│  ЗОНА   │  ВСЕГО      │ ВЕРНО    │ ОШИБОЧНО │ ПОТЕРЯНО │ ТОЧНОСТЬ │`);
        console.log(`├─────────┼─────────────┼──────────┼──────────┼──────────┼──────────┤`);
       
        const heelAccuracy = zoneStats.HEEL.total > 0 ? (zoneStats.HEEL.correct / zoneStats.HEEL.total * 100).toFixed(1) : '0.0';
        const centerAccuracy = zoneStats.CENTER.total > 0 ? (zoneStats.CENTER.correct / zoneStats.CENTER.total * 100).toFixed(1) : '0.0';
        const toeAccuracy = zoneStats.TOE.total > 0 ? (zoneStats.TOE.correct / zoneStats.TOE.total * 100).toFixed(1) : '0.0';
       
        console.log(
            `│ ПЯТКА   │ ${zoneStats.HEEL.total.toString().padStart(7)}    │ ` +
            `${zoneStats.HEEL.correct.toString().padStart(6)}   │ ` +
            `${zoneStats.HEEL.wrong.toString().padStart(6)}   │ ` +
            `${zoneStats.HEEL.lost.toString().padStart(6)}   │ ` +
            `${heelAccuracy.padStart(6)}% │`
        );
        console.log(
            `│ ЦЕНТР   │ ${zoneStats.CENTER.total.toString().padStart(7)}    │ ` +
            `${zoneStats.CENTER.correct.toString().padStart(6)}   │ ` +
            `${zoneStats.CENTER.wrong.toString().padStart(6)}   │ ` +
            `${zoneStats.CENTER.lost.toString().padStart(6)}   │ ` +
            `${centerAccuracy.padStart(6)}% │`
        );
        console.log(
            `│ НОСОК   │ ${zoneStats.TOE.total.toString().padStart(7)}    │ ` +
            `${zoneStats.TOE.correct.toString().padStart(6)}   │ ` +
            `${zoneStats.TOE.wrong.toString().padStart(6)}   │ ` +
            `${zoneStats.TOE.lost.toString().padStart(6)}   │ ` +
            `${toeAccuracy.padStart(6)}% │`
        );
        console.log(`└─────────┴─────────────┴──────────┴──────────┴──────────┴──────────┘`);
    }

    // ==================== ИНФОРМАЦИЯ О МОДЕЛИ ====================

    getModelInfo(modelId = null) {
        const targetModelId = modelId || this.currentModelId;
        if (!targetModelId || !this.models.has(targetModelId)) return { error: 'Model not found' };

        const model = this.models.get(targetModelId);
        const graph = model.graph;
        const fpInfo = this.fingerprinter.getFingerprintInfo(model.fingerprints);

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
                restoredFromMemory: this.stats.totalRestored,
                remembered: this.stats.totalRemembered,
                triangulated: this.stats.totalTriangulated,
                memorySize: this.geometryMemory.memory.size
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

        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ МОДЕЛИ "${model.metadata.name}":`);
        console.log(`═`.repeat(70));
        console.log(`📊 ОБЩАЯ ИНФОРМАЦИЯ:`);
        console.log(`   ID: ${model.id}`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);
        console.log(`   📐 Геометрическая память: ${this.geometryMemory.memory.size} записей`);

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
            let icon = '  ';
            if (node.restoredFromMemory) icon = '📎';
            else if (node.triangulated) icon = '🔺';
            else if (node.remembered) icon = '📐';
           
            const zone = node.y > 350 ? 'П' : node.y < 200 ? 'Н' : 'Ц';
            console.log(
                `   ${icon} ${nodeId.substring(0, 16)}... ${source}: ` +
                `(${node.x?.toFixed(1) || '?'}, ${node.y?.toFixed(1) || '?'})${zone} ` +
                `| ст:${node.degree} | п:${node.confirmationCount || 1}`
            );
        }

        if (graph.nodes.size > showNodes) {
            console.log(`   ... и еще ${graph.nodes.size - showNodes} узлов`);
        }

        console.log(`\n📜 ИСТОРИЯ (последние 3 действия):`);
        model.history.slice(-3).forEach((entry, idx) => {
            console.log(`   ${entry.action === 'created' ? '🆕' : '🔧'} ${entry.action.toUpperCase()}: ${new Date(entry.timestamp).toLocaleTimeString()}`);
            console.log(`      Узлов: ${entry.nodes || '?'} → ${entry.totalNodes || '?'}`);
            if (entry.newNodes) console.log(`      +${entry.newNodes} новых узлов`);
            if (entry.restoredFromMemory) console.log(`      📎 ${entry.restoredFromMemory} из памяти`);
            if (entry.remembered) console.log(`      📐 ${entry.remembered} запомнено`);
            if (entry.triangulated) console.log(`      🔺 ${entry.triangulated} триангуляция`);
            if (entry.mappingAccuracy) console.log(`      🎯 Точность: ${entry.mappingAccuracy}%`);
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
            geometryMemory: this.geometryMemory.export(),
            stats: this.getModelInfo(targetModelId).stats,
            _version: '7.0-geometry-memory-full',
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

            if (data.geometryMemory) {
                this.geometryMemory.import(data.geometryMemory);
            }

            this.models.set(modelId, model);
            if (!this.currentModelId) this.currentModelId = modelId;
            console.log(`📥 Импортирована модель "${model.metadata.name}"`);
            console.log(`   📐 Геометрическая память: ${this.geometryMemory.memory.size} записей`);
            return true;
        } catch (error) {
            console.log(`❌ Ошибка импорта: ${error.message}`);
            return false;
        }
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        const modelsInfo = [];
        let totalNodes = 0;
        for (const [modelId, model] of this.models) {
            modelsInfo.push({
                id: modelId,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                memorySize: this.geometryMemory.memory.size,
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
            geometryMemory: {
                size: this.geometryMemory.memory.size,
                totalRestored: this.stats.totalRestored,
                totalRemembered: this.stats.totalRemembered,
                totalTriangulated: this.stats.totalTriangulated
            }
        };
    }
}

module.exports = TopologicalAccumulator;
