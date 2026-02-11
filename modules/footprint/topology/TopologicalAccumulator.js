// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ АККУМУЛЯТИВНАЯ МОДЕЛЬ С ТОПОЛОГИЧЕСКИМ ПЕРЕНОСОМ ЧЕРЕЗ ТРЕУГОЛЬНИКИ ДЕЛОНЕ

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
       
        // Хранилище моделей
        this.models = new Map(); // modelId -> { graph, fingerprints, metadata }
        this.currentModelId = null;
       
        // Статистика
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalPointsProcessed: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
       
        console.log(`🏗️ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   Порог совпадения: ${this.similarityThreshold * 100}%`);
        console.log(`   Минимум для достройки: ${this.minMatchesForEnhancement} узлов`);
    }
   
    // Основной метод: обработка нового набора точек
    async processPoints(points, options = {}) {
        console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК...`);
       
        const modelId = options.modelId || this.currentModelId;
        const pointSource = options.source || `source_${Date.now()}`;
       
        // 1. Строим граф Делоне с треугольниками
        const graph = this.topologyBuilder.buildDelaunayGraph(points, pointSource);
       
        if (this.debug) {
            this.topologyBuilder.visualizeGraph(graph, 5);
        }
       
        // 2. Вычисляем WL-подписи
        const fingerprints = this.fingerprinter.computeGraphFingerprints(graph);
       
        // 3. Если нет активной модели - создаем новую
        if (!modelId || !this.models.has(modelId)) {
            console.log(`🆕 СОЗДАЮ НОВУЮ ТОПОЛОГИЧЕСКУЮ МОДЕЛЬ`);
            return this.createNewModel(graph, fingerprints, points, options);
        }
       
        // 4. Сравниваем с существующей моделью
        console.log(`🔍 СРАВНИВАЮ С МОДЕЛЬЮ "${modelId}"`);
        const existingModel = this.models.get(modelId);
        const comparison = this.fingerprinter.compareGraphs(
            existingModel.graph,
            existingModel.fingerprints,
            graph,
            fingerprints
        );
       
        // 5. Принимаем решение на основе сходства
        if (comparison.similarity >= this.similarityThreshold) {
            console.log(`✅ СОВПАДЕНИЕ: ${(comparison.similarity * 100).toFixed(1)}% ≥ ${this.similarityThreshold * 100}%`);
           
            // Улучшаем существующую модель
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
           
            // Создаем новую модель
            return this.createNewModel(graph, fingerprints, points, {
                ...options,
                comparedWith: modelId,
                similarity: comparison.similarity
            });
        }
    }
   
    // Создание новой топологической модели
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
                triangleCount: graph.triangles?.length || 0,
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
       
        this.models.set(modelId, model);
        this.currentModelId = modelId;
        this.stats.totalModels++;
        this.stats.lastUpdated = new Date();
       
        console.log(`🏗️ СОЗДАНА НОВАЯ МОДЕЛЬ "${modelId}":`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Треугольников: ${graph.triangles?.length || 0}`);
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
   
    // 🔥 УЛУЧШЕННЫЙ МЕТОД: Улучшение модели с топологическим переносом
    async enhanceModel(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`🔧 ДОСТРАИВАЮ МОДЕЛЬ "${modelId}"...`);
       
        const model = this.models.get(modelId);
       
        // 🔥 ИСПРАВЛЕНИЕ: Используем ВСЕ совпадения
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
       
        console.log(`📊 Использую для достройки: ${allMatches.length} совпадений`);
       
        if (allMatches.length < this.minMatchesForEnhancement) {
            console.log(`⚠️ Мало совпадений для достройки: ${allMatches.length} < ${this.minMatchesForEnhancement}`);
            return { newNodesAdded: 0, reason: 'insufficient_matches' };
        }
       
        // 🔥 СОЗДАЕМ МАППИНГ: node2 (новый граф) -> node1 (модель)
        const mapping = new Map();
        allMatches.forEach(match => {
            mapping.set(match.node2, match.node1); // node2 → node1
        });
       
        console.log(`🗺️ Создан маппинг: ${mapping.size} соответствий`);
       
        // Находим узлы, которые нужно добавить (С ТРЕУГОЛЬНИКАМИ)
        const nodesToAdd = this.findNodesToAddWithTriangles(
            model.graph,
            newGraph,
            newFingerprints,
            allMatches,
            mapping
        );
       
        if (nodesToAdd.length === 0) {
            console.log(`✅ Все узлы уже есть в модели`);
            return { newNodesAdded: 0, reason: 'all_nodes_exist' };
        }
       
        console.log(`🎯 Найдено ${nodesToAdd.length} новых узлов для добавления`);
       
        // Добавляем узлы в модель (С ПЕРЕНОСОМ ЧЕРЕЗ ТРЕУГОЛЬНИКИ)
        const addedNodes = this.addNodesToModelWithTransfer(
            modelId,
            nodesToAdd,
            newGraph,
            mapping
        );
       
        // Обновляем подписи модели
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }
       
        // 🔥 ИСПРАВЛЕНИЕ: Обновляем подтверждения для совпавших узлов
        this.updateNodeConfirmations(modelId, allMatches);
       
        // Обновляем историю
        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            exactMatches: allMatches.length,
            similarity: comparison.similarity,
            source: options.source || 'unknown'
        });
       
        this.stats.totalEnhancements++;
        this.stats.lastUpdated = new Date();
       
        console.log(`✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
       
        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            allMatches: allMatches.length
        };
    }
   
    // 🔥 НОВЫЙ МЕТОД: Поиск узлов с использованием треугольников
    findNodesToAddWithTriangles(modelGraph, newGraph, newFingerprints, allMatches, mapping) {
        console.log(`🔍 Поиск новых узлов с треугольниками Делоне...`);
       
        const nodesToAdd = [];
        const matchedNodeIds = new Set(allMatches.map(m => m.node2));
       
        // 🔥 СОБИРАЕМ ТРЕУГОЛЬНИКИ ИЗ НОВОГО ГРАФА
        const triangles = newGraph.triangles || [];
        console.log(`   Треугольников в новом графе: ${triangles.length}`);
       
        // Создаем карту треугольников для быстрого поиска
        const triangleMap = new Map(); // nodeId -> [треугольники, содержащие этот узел]
       
        for (const triangle of triangles) {
            const vertexIds = triangle.map(v => v.id);
            for (const vertexId of vertexIds) {
                if (!triangleMap.has(vertexId)) {
                    triangleMap.set(vertexId, []);
                }
                triangleMap.get(vertexId).push(triangle);
            }
        }
       
        // 🔥 ПРОВЕРЯЕМ ВСЕ УЗЛЫ НОВОГО ГРАФА
        for (const [nodeId, node] of newGraph.nodes) {
            // Если узел уже совпал - пропускаем
            if (matchedNodeIds.has(nodeId)) continue;
           
            // Если узел уже есть в модели - пропускаем
            if (modelGraph.nodes.has(nodeId)) continue;
           
            // 🔥 ПРОВЕРЯЕМ, ЧТО У УЗЛА ЕСТЬ КООРДИНАТЫ
            if (!node.x || !node.y) {
                console.log(`⚠️ Узел ${nodeId} не имеет координат, пропускаем`);
                continue;
            }
           
            // 🔥 ИЩЕМ ТРЕУГОЛЬНИКИ, СОДЕРЖАЩИЕ ЭТОТ УЗЕЛ
            const containingTriangles = triangleMap.get(nodeId) || [];
           
            if (containingTriangles.length === 0) {
                console.log(`⚠️ Узел ${nodeId} не входит ни в один треугольник`);
                continue;
            }
           
            // 🔥 ПРОВЕРЯЕМ, ВСЕ ЛИ ВЕРШИНЫ ТРЕУГОЛЬНИКА ИМЕЮТ СООТВЕТСТВИЯ
            for (const triangle of containingTriangles) {
                const vertexIds = triangle.map(v => v.id);
               
                // Проверяем, сколько вершин имеют соответствия
                const mappedVertices = vertexIds.filter(vId => mapping.has(vId));
               
                if (mappedVertices.length >= 2) {
                    // 🔥 УСПЕХ: нашли треугольник, где ≥2 вершин имеют соответствия
                    console.log(`   ✓ Узел ${nodeId}: найден треугольник с ${mappedVertices.length} соответствиями`);
                   
                    // Вычисляем барицентрические координаты
                    const barycentric = this.topologyBuilder.computeBarycentricCoords(
                        node,
                        triangle
                    );
                   
                    if (!barycentric || isNaN(barycentric.alpha)) {
                        console.log(`⚠️ Не удалось вычислить барицентрические координаты`);
                        continue;
                    }
                   
                    nodesToAdd.push({
                        nodeId: nodeId,
                        nodeData: node,
                        containingTriangle: triangle,
                        triangleVertices: vertexIds,
                        mappedVertices: mappedVertices,
                        barycentric: barycentric,
                        connectionsToMatched: mappedVertices.length,
                        fingerprint: newFingerprints.get(nodeId),
                        reason: `в треугольнике с ${mappedVertices.length} соответствиями`
                    });
                   
                    break; // Используем первый подходящий треугольник
                }
            }
           
            // 🔥 ФОЛБЭК: если не нашли треугольник, используем связи с соседями
            if (nodesToAdd[nodesToAdd.length - 1]?.nodeId !== nodeId) {
                const connectionsToMatched = this.countConnectionsToMatched(
                    nodeId,
                    matchedNodeIds,
                    newGraph.edges
                );
               
                if (connectionsToMatched >= 2) {
                    nodesToAdd.push({
                        nodeId: nodeId,
                        nodeData: node,
                        connectionsToMatched: connectionsToMatched,
                        fingerprint: newFingerprints.get(nodeId),
                        reason: `connected to ${connectionsToMatched} matched nodes (фолбэк)`
                    });
                }
            }
        }
       
        console.log(`🎯 Найдено ${nodesToAdd.length} новых узлов для добавления`);
       
        // 🔥 ДИАГНОСТИКА
        nodesToAdd.forEach((nodeInfo, idx) => {
            console.log(`   ${idx + 1}. ${nodeInfo.nodeId}: ${nodeInfo.reason}`);
            if (nodeInfo.barycentric) {
                console.log(`      барицентрические: α=${nodeInfo.barycentric.alpha.toFixed(3)}, β=${nodeInfo.barycentric.beta.toFixed(3)}, γ=${nodeInfo.barycentric.gamma.toFixed(3)}`);
            }
        });
       
        return nodesToAdd;
    }
   
    // 🔥 НОВЫЙ МЕТОД: Добавление узлов с переносом через треугольники
    addNodesToModelWithTransfer(modelId, nodesToAdd, sourceGraph, mapping) {
        const model = this.models.get(modelId);
        const addedNodes = [];
       
        console.log(`🔨 Добавляю ${nodesToAdd.length} новых узлов с топологическим переносом...`);
       
        for (const nodeInfo of nodesToAdd) {
            const originalNodeId = nodeInfo.nodeId;
           
            // 🔥 СОЗДАЕМ УНИКАЛЬНЫЙ ID ДЛЯ МОДЕЛИ
            const modelNodeId = `${originalNodeId}_model_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
           
            const sourceNode = nodeInfo.nodeData;
           
            let newNode = {
                // Основные данные
                id: modelNodeId,
                originalId: originalNodeId,
                confidence: sourceNode.confidence || 0.5,
                degree: sourceNode.degree || 0,
               
                // Метаданные
                addedFrom: sourceGraph.metadata?.source || 'enhancement',
                photoId: sourceGraph.metadata?.photoId || 'unknown',
                addedAt: new Date(),
                connectionsToMatched: nodeInfo.connectionsToMatched,
               
                // 🔥 ВАЖНО: confirmationCount = 1 для новых узлов
                confirmationCount: 1,
               
                // Сохраняем оригинальные данные
                originalData: {
                    x: sourceNode.x,
                    y: sourceNode.y,
                    confidence: sourceNode.confidence,
                    source: sourceNode.source
                },
               
                // Структурные данные
                fingerprint: sourceNode.fingerprint,
                localStructure: sourceNode.fingerprint?.localStructure
            };
           
            // 🔥 ВЫЧИСЛЯЕМ КООРДИНАТЫ ЧЕРЕЗ ТРЕУГОЛЬНИКИ ИЛИ ФОЛБЭК
            if (nodeInfo.barycentric && nodeInfo.containingTriangle) {
                // 🔥 СПОСОБ 1: ТОПОЛОГИЧЕСКИЙ ПЕРЕНОС ЧЕРЕЗ ТРЕУГОЛЬНИКИ
                const transferredCoords = this.transferViaTriangle(
                    nodeInfo.barycentric,
                    nodeInfo.containingTriangle,
                    mapping,
                    model.graph
                );
               
                if (transferredCoords) {
                    newNode.x = transferredCoords.x;
                    newNode.y = transferredCoords.y;
                    newNode.transferMethod = 'triangle_delaunay';
                    console.log(`   ✓ ${modelNodeId}: перенос через треугольник → (${newNode.x.toFixed(1)}, ${newNode.y.toFixed(1)})`);
                } else {
                    // 🔥 ФОЛБЭК: среднее соседей
                    const fallbackCoords = this.transferViaNeighbors(
                        originalNodeId,
                        sourceGraph,
                        mapping,
                        model.graph
                    );
                   
                    if (fallbackCoords) {
                        newNode.x = fallbackCoords.x;
                        newNode.y = fallbackCoords.y;
                        newNode.transferMethod = 'neighbors_average';
                        console.log(`   ⚠️ ${modelNodeId}: фолбэк через соседей → (${newNode.x.toFixed(1)}, ${newNode.y.toFixed(1)})`);
                    } else {
                        // 🔥 ФОЛБЭК 2: случайные координаты
                        newNode.x = sourceNode.x + Math.random() * 50 - 25;
                        newNode.y = sourceNode.y + Math.random() * 50 - 25;
                        newNode.transferMethod = 'random_offset';
                        console.log(`   ⚠️ ${modelNodeId}: случайные координаты → (${newNode.x.toFixed(1)}, ${newNode.y.toFixed(1)})`);
                    }
                }
            } else {
                // 🔥 СПОСОБ 2: СРЕДНЕЕ ПОЛОЖЕНИЕ СОСЕДЕЙ
                const neighborCoords = this.transferViaNeighbors(
                    originalNodeId,
                    sourceGraph,
                    mapping,
                    model.graph
                );
               
                if (neighborCoords) {
                    newNode.x = neighborCoords.x;
                    newNode.y = neighborCoords.y;
                    newNode.transferMethod = 'neighbors_average';
                    console.log(`   ✓ ${modelNodeId}: среднее соседей → (${newNode.x.toFixed(1)}, ${newNode.y.toFixed(1)})`);
                } else {
                    // 🔥 ФОЛБЭК: оригинальные координаты
                    newNode.x = sourceNode.x;
                    newNode.y = sourceNode.y;
                    newNode.transferMethod = 'original_coords';
                    console.log(`   ⚠️ ${modelNodeId}: оригинальные координаты → (${newNode.x.toFixed(1)}, ${newNode.y.toFixed(1)})`);
                }
            }
           
            // Добавляем узел в модель
            model.graph.nodes.set(modelNodeId, newNode);
           
            // Добавляем рёбра
            let edgesAdded = 0;
            for (const edge of sourceGraph.edges) {
                const [nodeA, nodeB] = edge.split('--');
               
                // Если этот узел участвует в ребре
                if (nodeA === originalNodeId || nodeB === originalNodeId) {
                    const otherNodeId = nodeA === originalNodeId ? nodeB : nodeA;
                   
                    // Ищем соответствие другого узла в модели
                    let otherModelNodeId = null;
                   
                    if (mapping.has(otherNodeId)) {
                        otherModelNodeId = mapping.get(otherNodeId);
                    } else if (model.graph.nodes.has(otherNodeId)) {
                        otherModelNodeId = otherNodeId;
                    }
                   
                    // Добавляем ребро, если оба узла есть в модели
                    if (otherModelNodeId && model.graph.nodes.has(otherModelNodeId)) {
                        const modelEdge = [modelNodeId, otherModelNodeId].sort().join('--');
                        model.graph.edges.add(modelEdge);
                        edgesAdded++;
                    }
                }
            }
           
            // Обновляем степени
            newNode.degree = edgesAdded;
           
            addedNodes.push({
                id: modelNodeId,
                originalId: originalNodeId,
                x: newNode.x,
                y: newNode.y,
                confidence: newNode.confidence,
                transferMethod: newNode.transferMethod,
                addedReason: nodeInfo.reason,
                edgesAdded: edgesAdded
            });
        }
       
        // Обновляем степени всех узлов
        this.updateNodeDegrees(model.graph);
       
        console.log(`✅ Добавлено ${addedNodes.length} новых узлов, всего ${model.graph.nodes.size} узлов`);
       
        return addedNodes;
    }
   
    // 🔥 МЕТОД 1: Топологический перенос через треугольники
    transferViaTriangle(barycentric, triangle, mapping, modelGraph) {
        const { alpha, beta, gamma } = barycentric;
        const [A, B, C] = triangle;
       
        // Ищем соответствия вершин в модели
        const A_prime = mapping.has(A.id) ? modelGraph.nodes.get(mapping.get(A.id)) : null;
        const B_prime = mapping.has(B.id) ? modelGraph.nodes.get(mapping.get(B.id)) : null;
        const C_prime = mapping.has(C.id) ? modelGraph.nodes.get(mapping.get(C.id)) : null;
       
        // Проверяем, что все три вершины имеют соответствия
        if (A_prime && B_prime && C_prime) {
            const x = alpha * A_prime.x + beta * B_prime.x + gamma * C_prime.x;
            const y = alpha * A_prime.y + beta * B_prime.y + gamma * C_prime.y;
            return { x, y };
        }
       
        // Если есть только 2 соответствия
        if (A_prime && B_prime) {
            // Проекция на линию A'B'
            const x = (A_prime.x + B_prime.x) / 2;
            const y = (A_prime.y + B_prime.y) / 2;
            return { x, y };
        }
       
        return null;
    }
   
    // 🔥 МЕТОД 2: Перенос через среднее соседей
    transferViaNeighbors(nodeId, sourceGraph, mapping, modelGraph) {
        const neighbors = this.getNeighbors(nodeId, sourceGraph.edges);
        const mappedNeighbors = neighbors.filter(n => mapping.has(n));
       
        if (mappedNeighbors.length === 0) return null;
       
        let sumX = 0, sumY = 0, count = 0;
       
        for (const neighborId of mappedNeighbors) {
            const modelNodeId = mapping.get(neighborId);
            const neighborNode = modelGraph.nodes.get(modelNodeId);
           
            if (neighborNode && neighborNode.x !== undefined && neighborNode.y !== undefined) {
                sumX += neighborNode.x;
                sumY += neighborNode.y;
                count++;
            }
        }
       
        if (count === 0) return null;
       
        return {
            x: sumX / count,
            y: sumY / count
        };
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    getNeighbors(nodeId, edges) {
        const neighbors = new Set();
       
        for (const edge of edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodeA === nodeId) neighbors.add(nodeB);
            if (nodeB === nodeId) neighbors.add(nodeA);
        }
       
        return Array.from(neighbors);
    }
   
    countConnectionsToMatched(nodeId, matchedNodeIds, edges) {
        let connections = 0;
       
        for (const edge of edges) {
            const [nodeA, nodeB] = edge.split('--');
           
            if (nodeA === nodeId && matchedNodeIds.has(nodeB)) {
                connections++;
            } else if (nodeB === nodeId && matchedNodeIds.has(nodeA)) {
                connections++;
            }
        }
       
        return connections;
    }
   
    updateNodeConfirmations(modelId, matches) {
        const model = this.models.get(modelId);
       
        if (!model || !matches || matches.length === 0) {
            console.log(`⚠️ Нет совпадений для обновления подтверждений`);
            return;
        }
       
        let updatedCount = 0;
       
        for (const match of matches) {
            const nodeId = match.node1; // Узел в модели
           
            if (model.graph.nodes.has(nodeId)) {
                const node = model.graph.nodes.get(nodeId);
                const oldCount = node.confirmationCount || 1;
                node.confirmationCount = oldCount + 1;
                node.lastConfirmed = new Date();
               
                if (match.confidence) {
                    node.confidence = Math.max(node.confidence || 0.5, match.confidence);
                }
               
                updatedCount++;
               
                if (this.debug) {
                    console.log(`   📈 Узел ${nodeId}: подтверждений ${oldCount} → ${node.confirmationCount}`);
                }
            }
        }
       
        console.log(`📈 Обновлены подтверждения для ${updatedCount}/${matches.length} узлов`);
    }
   
    updateNodeDegrees(graph) {
        // Сбрасываем степени
        for (const node of graph.nodes.values()) {
            node.degree = 0;
        }
       
        // Пересчитываем
        for (const edge of graph.edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (graph.nodes.has(nodeA)) graph.nodes.get(nodeA).degree++;
            if (graph.nodes.has(nodeB)) graph.nodes.get(nodeB).degree++;
        }
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
       
        if (!targetModelId || !this.models.has(targetModelId)) {
            return { error: 'Model not found' };
        }
       
        const model = this.models.get(targetModelId);
        const graph = model.graph;
        const fpInfo = this.fingerprinter.getFingerprintInfo(model.fingerprints);
       
        const nodeSources = {};
        for (const node of graph.nodes.values()) {
            const source = node.addedFrom || 'original';
            nodeSources[source] = (nodeSources[source] || 0) + 1;
        }
       
        return {
            id: model.id,
            name: model.metadata.name,
            stats: {
                nodes: graph.nodes.size,
                edges: graph.edges.size,
                triangles: graph.triangles || 0,
                avgDegree: graph.avgDegree || 0,
                uniqueSignatures: fpInfo.uniqueSignatures,
                uniquenessRatio: fpInfo.uniquenessRatio,
                degreeDistribution: fpInfo.degreeDistribution,
                nodeSources: nodeSources
            },
            metadata: model.metadata,
            history: {
                totalActions: model.history.length,
                lastAction: model.history[model.history.length - 1],
                enhancements: model.history.filter(h => h.action === 'enhanced').length
            },
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
        console.log(`   Треугольников: ${model.metadata.triangleCount || 0}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);
        console.log(`   Создана: ${model.metadata.createdAt.toLocaleString('ru-RU')}`);
       
        // Статистика по источникам узлов
        const nodeSources = {};
        for (const node of graph.nodes.values()) {
            const source = node.addedFrom || 'original';
            nodeSources[source] = (nodeSources[source] || 0) + 1;
        }
       
        console.log(`\n📈 СТАТИСТИКА УЗЛОВ:`);
        Object.entries(nodeSources).forEach(([source, count]) => {
            console.log(`   ${source}: ${count} узлов`);
        });
       
        // Показываем узлы (ограниченное количество)
        const showNodes = options.showNodes || 8;
        console.log(`\n📋 УЗЛЫ (первые ${showNodes}):`);
       
        let count = 0;
        for (const [nodeId, node] of graph.nodes) {
            if (count++ >= showNodes) break;
           
            const source = node.addedFrom ? `[${node.addedFrom}]` : '[original]';
            console.log(`   ${nodeId} ${source}: (${node.x?.toFixed(1) || '?'}, ${node.y?.toFixed(1) || '?'}) | степень: ${node.degree} | подтверждений: ${node.confirmationCount || 1}`);
        }
       
        if (graph.nodes.size > showNodes) {
            console.log(`   ... и еще ${graph.nodes.size - showNodes} узлов`);
        }
       
        // Показываем историю
        console.log(`\n📜 ИСТОРИЯ (последние 3 действия):`);
        model.history.slice(-3).forEach((entry, idx) => {
            console.log(`   ${entry.action === 'created' ? '🆕' : '🔧'} ${entry.action.toUpperCase()}: ${entry.timestamp.toLocaleTimeString()}`);
            console.log(`      Узлов: ${entry.nodes || '?'}, Рёбер: ${entry.edges || '?'}`);
            if (entry.newNodes) console.log(`      +${entry.newNodes} новых узлов`);
        });
       
        console.log(`═`.repeat(70));
    }
   
    exportModel(modelId = null) {
        const targetModelId = modelId || this.currentModelId;
       
        if (!targetModelId || !this.models.has(targetModelId)) {
            return null;
        }
       
        const model = this.models.get(targetModelId);
       
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
            stats: this.getModelInfo(targetModelId).stats,
            _version: '1.1-topological-with-triangles',
            _exportedAt: new Date().toISOString()
        };
    }
   
    importModel(data) {
        if (!data || !data.id || !data.graph) {
            console.log('⚠️ Неверный формат данных для импорта');
            return false;
        }
       
        try {
            const modelId = data.id;
           
            // Восстанавливаем граф
            const graph = {
                nodes: new Map(data.graph.nodes),
                edges: new Set(data.graph.edges),
                triangles: data.graph.triangles,
                avgDegree: data.graph.avgDegree
            };
           
            // Восстанавливаем подписи
            const fingerprints = new Map(data.fingerprints);
           
            const model = {
                id: modelId,
                graph: graph,
                fingerprints: fingerprints,
                metadata: data.metadata || {},
                history: data.history || [],
                originalPoints: data.originalPoints || []
            };
           
            // Восстанавливаем даты
            if (model.metadata.createdAt && typeof model.metadata.createdAt === 'string') {
                model.metadata.createdAt = new Date(model.metadata.createdAt);
            }
           
            if (model.history && Array.isArray(model.history)) {
                model.history.forEach(entry => {
                    if (entry.timestamp && typeof entry.timestamp === 'string') {
                        entry.timestamp = new Date(entry.timestamp);
                    }
                });
            }
           
            this.models.set(modelId, model);
           
            if (!this.currentModelId) {
                this.currentModelId = modelId;
            }
           
            console.log(`📥 Импортирована топологическая модель "${model.metadata.name}"`);
            console.log(`   Узлов: ${graph.nodes.size}, Рёбер: ${graph.edges.size}`);
           
            return true;
           
        } catch (error) {
            console.log(`❌ Ошибка импорта модели: ${error.message}`);
            return false;
        }
    }
   
    getStats() {
        const modelsInfo = [];
        let totalNodes = 0;
        let totalEdges = 0;
       
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
            models: {
                total: this.models.size,
                totalNodes: totalNodes,
                totalEdges: totalEdges,
                list: modelsInfo
            },
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
