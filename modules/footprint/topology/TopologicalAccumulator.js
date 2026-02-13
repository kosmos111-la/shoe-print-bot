// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ АККУМУЛЯТИВНАЯ МОДЕЛЬ С ТРИАНГУЛЯЦИОННЫМ ВОССТАНОВЛЕНИЕМ

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
        this.models = new Map();
        this.currentModelId = null;

        // Статистика
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalPointsProcessed: 0,
            totalTriangulated: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log(`🏗️ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   Порог совпадения: ${this.similarityThreshold * 100}%`);
        console.log(`   Минимум для достройки: ${this.minMatchesForEnhancement} узлов`);
    }

    // Основной метод: обработка нового набора точек
    async processPoints(points, options = {}) {
        console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК...`);

        const modelId = options.modelId || this.currentModelId;
        const pointSource = options.source || `source_${Date.now()}`;

        // 1. Строим граф Делоне
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

        // Инициализируем confirmationCount для всех узлов
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

    // 🔥🔥🔥 УЛУЧШЕНИЕ МОДЕЛИ С ТАБЛИЦЕЙ МАППИНГА
    async enhanceModel(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`🔧 ДОСТРАИВАЮ МОДЕЛЬ "${modelId}"...`);

        const model = this.models.get(modelId);

        // Используем ВСЕ совпадения
        const allMatches = comparison.allMatches || comparison.exactMatches || [];

        console.log(`📊 Использую для достройки: ${allMatches.length} совпадений`);

        // 🔥🔥🔥 ТАБЛИЦА СООТВЕТСТВИЙ - ДИАГНОСТИКА МАППИНГА!
        console.log(`\n📋 ТАБЛИЦА СООТВЕТСТВИЙ (${allMatches.length} совпадений):`);
        console.log(`┌─────────┬────────────────────┬─────────────────┬────────────────────┬─────────────────┐`);
        console.log(`│   #     │    ТОЧКА В ФОТО2   │   КООРДИНАТЫ    │    ТОЧКА В МОДЕЛИ  │   КООРДИНАТЫ    │`);
        console.log(`├─────────┼────────────────────┼─────────────────┼────────────────────┼─────────────────┤`);

        allMatches.slice(0, 20).forEach((match, idx) => {
            const node2 = newGraph.nodes.get(match.node2);
            const node1 = model.graph.nodes.get(match.node1);
            
            if (node2 && node1) {
                const zone2 = node2.y > 350 ? 'П' : node2.y < 200 ? 'Н' : 'Ц';
                const zone1 = node1.y > 350 ? 'П' : node1.y < 200 ? 'Н' : 'Ц';
                const matchType = zone2 === zone1 ? '✅' : '❌';
                
                console.log(
                    `│ ${(idx+1).toString().padStart(7)} │ ${match.node2.substring(0, 18).padEnd(18)} │ ` +
                    `(${node2.x.toFixed(1).padStart(6)}, ${node2.y.toFixed(1).padStart(6)})${zone2} │ ` +
                    `${match.node1.substring(0, 18).padEnd(18)} │ ` +
                    `(${node1.x.toFixed(1).padStart(6)}, ${node1.y.toFixed(1).padStart(6)})${zone1} ${matchType} │`
                );
            }
        });

        if (allMatches.length > 20) {
            console.log(`│   ...   │       ...           │        ...        │        ...           │        ...        │`);
        }
        console.log(`└─────────┴────────────────────┴─────────────────┴────────────────────┴─────────────────┘`);

        // 🔥 СТАТИСТИКА ПО ЗОНАМ
        let sameZone = 0;
        let differentZone = 0;
        let heelToHeel = 0, heelToCenter = 0, heelToToe = 0;
        let centerToHeel = 0, centerToCenter = 0, centerToToe = 0;
        let toeToHeel = 0, toeToCenter = 0, toeToToe = 0;

        allMatches.forEach(match => {
            const node2 = newGraph.nodes.get(match.node2);
            const node1 = model.graph.nodes.get(match.node1);
            if (node2 && node1) {
                const zone2 = node2.y > 350 ? 'ПЯТКА' : node2.y < 200 ? 'НОСОК' : 'ЦЕНТР';
                const zone1 = node1.y > 350 ? 'ПЯТКА' : node1.y < 200 ? 'НОСОК' : 'ЦЕНТР';
                
                if (zone2 === zone1) {
                    sameZone++;
                    if (zone2 === 'ПЯТКА') heelToHeel++;
                    if (zone2 === 'ЦЕНТР') centerToCenter++;
                    if (zone2 === 'НОСОК') toeToToe++;
                } else {
                    differentZone++;
                    if (zone2 === 'ПЯТКА' && zone1 === 'ЦЕНТР') heelToCenter++;
                    if (zone2 === 'ПЯТКА' && zone1 === 'НОСОК') heelToToe++;
                    if (zone2 === 'ЦЕНТР' && zone1 === 'ПЯТКА') centerToHeel++;
                    if (zone2 === 'ЦЕНТР' && zone1 === 'НОСОК') centerToToe++;
                    if (zone2 === 'НОСОК' && zone1 === 'ПЯТКА') toeToHeel++;
                    if (zone2 === 'НОСОК' && zone1 === 'ЦЕНТР') toeToCenter++;
                }
            }
        });

        console.log(`\n📊 СТАТИСТИКА СООТВЕТСТВИЙ ПО ЗОНАМ:`);
        console.log(`   ✅ Совпадают зоны: ${sameZone} из ${allMatches.length} (${(sameZone/allMatches.length*100).toFixed(1)}%)`);
        console.log(`      ├─ ПЯТКА→ПЯТКА: ${heelToHeel}`);
        console.log(`      ├─ ЦЕНТР→ЦЕНТР: ${centerToCenter}`);
        console.log(`      └─ НОСОК→НОСОК: ${toeToToe}`);
        console.log(`   ❌ Разные зоны: ${differentZone} из ${allMatches.length} (${(differentZone/allMatches.length*100).toFixed(1)}%)`);
        console.log(`      ├─ ПЯТКА→ЦЕНТР: ${heelToCenter}`);
        console.log(`      ├─ ПЯТКА→НОСОК: ${heelToToe}`);
        console.log(`      ├─ ЦЕНТР→ПЯТКА: ${centerToHeel}`);
        console.log(`      ├─ ЦЕНТР→НОСОК: ${centerToToe}`);
        console.log(`      ├─ НОСОК→ПЯТКА: ${toeToHeel}`);
        console.log(`      └─ НОСОК→ЦЕНТР: ${toeToCenter}`);
        console.log(``);

        if (allMatches.length < this.minMatchesForEnhancement) {
            console.log(`⚠️ Мало совпадений для достройки: ${allMatches.length} < ${this.minMatchesForEnhancement}`);
            return { newNodesAdded: 0, reason: 'insufficient_matches' };
        }

        // Создаем маппинг: node2 (новое фото) → node1 (модель)
        const mapping = new Map();
        for (const match of allMatches) {
            if (!mapping.has(match.node2)) {
                mapping.set(match.node2, match.node1);
            }
        }

        // Находим узлы для добавления
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

        // ТРИАНГУЛЯЦИОННОЕ ВОССТАНОВЛЕНИЕ ПОЗИЦИЙ
        const triangulatedNodes = await this.triangulateNodePositions(
            nodesToAdd,
            newGraph,
            model.graph,
            mapping
        );

        // Добавляем узлы в модель
        const addedNodes = this.addNodesToModel(
            modelId,
            triangulatedNodes,
            newGraph
        );

        // Обновляем подписи модели
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }

        // Обновляем подтверждения для ВСЕХ совпавших узлов
        this.updateNodeConfirmations(modelId, allMatches);

        // Обновляем историю
        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            exactMatches: allMatches.length,
            similarity: comparison.similarity,
            source: options.source || 'unknown',
            triangulated: triangulatedNodes.filter(n => n.nodeData.triangulated).length,
            mappingAccuracy: (sameZone/allMatches.length*100).toFixed(1)
        });

        this.stats.totalEnhancements++;
        this.stats.totalTriangulated += triangulatedNodes.filter(n => n.nodeData.triangulated).length;
        this.stats.lastUpdated = new Date();

        console.log(`✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
        console.log(`   🔺 По триангуляции: ${triangulatedNodes.filter(n => n.nodeData.triangulated).length}`);
        console.log(`   🎯 Точность маппинга: ${(sameZone/allMatches.length*100).toFixed(1)}%`);

        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            allMatches: allMatches.length,
            triangulated: triangulatedNodes.filter(n => n.nodeData.triangulated).length,
            mappingAccuracy: (sameZone/allMatches.length*100).toFixed(1)
        };
    }

    // 🔥🔥🔥 ТРИАНГУЛЯЦИОННОЕ ВОССТАНОВЛЕНИЕ ПОЗИЦИЙ (С ФИЛЬТРОМ ПО ЗОНАМ)
    async triangulateNodePositions(nodesToAdd, newGraph, modelGraph, mapping) {
        console.log(`🔺 Восстанавливаю позиции ${nodesToAdd.length} узлов...`);
        
        const triangulated = [];
        
        for (const nodeInfo of nodesToAdd) {
            const newNodeId = nodeInfo.nodeId;
            const newNode = newGraph.nodes.get(newNodeId);
            if (!newNode) {
                triangulated.push(nodeInfo);
                continue;
            }
            
            // Определяем зону новой точки
            const newY = newNode.y;
            let targetZone = 'UNKNOWN';
            if (newY > 350) targetZone = 'HEEL';
            else if (newY < 200) targetZone = 'TOE';
            else targetZone = 'CENTER';
            
            // 1. Находим ВСЕХ соседей в маппинге
            const candidates = [];
            for (const edge of newGraph.edges) {
                const [nodeA, nodeB] = edge.split('--');
                if (nodeA === newNodeId && mapping.has(nodeB)) {
                    const neighborNode = newGraph.nodes.get(nodeB);
                    // 🔥🔥🔥 ФИЛЬТР: только точки из той же зоны!
                    if (Math.abs(neighborNode.y - newY) < 100) {
                        candidates.push({
                            id: mapping.get(nodeB),
                            node: neighborNode,
                            modelNode: modelGraph.nodes.get(mapping.get(nodeB)),
                            dist: this.distance(newNode, neighborNode)
                        });
                    }
                } else if (nodeB === newNodeId && mapping.has(nodeA)) {
                    const neighborNode = newGraph.nodes.get(nodeA);
                    if (Math.abs(neighborNode.y - newY) < 100) {
                        candidates.push({
                            id: mapping.get(nodeA),
                            node: neighborNode,
                            modelNode: modelGraph.nodes.get(mapping.get(nodeA)),
                            dist: this.distance(newNode, neighborNode)
                        });
                    }
                }
            }
            
            if (candidates.length < 3) {
                if (this.debug) {
                    console.log(`   ⚠️ ${newNodeId.substring(0, 20)}... только ${candidates.length} соседей в зоне ${targetZone}`);
                }
                triangulated.push(nodeInfo);
                continue;
            }
            
            // 2. Сортируем по расстоянию
            candidates.sort((a, b) => a.dist - b.dist);
            
            // 3. Берём топ-6 ближайших и ищем лучший треугольник
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
                        
                        // Проверяем, что все точки в модели тоже из той же зоны
                        const aZone = a.y > 350 ? 'HEEL' : a.y < 200 ? 'TOE' : 'CENTER';
                        const bZone = b.y > 350 ? 'HEEL' : b.y < 200 ? 'TOE' : 'CENTER';
                        const cZone = c.y > 350 ? 'HEEL' : c.y < 200 ? 'TOE' : 'CENTER';
                        
                        if (aZone !== targetZone || bZone !== targetZone || cZone !== targetZone) {
                            continue; // Пропускаем, если точки из другой зоны
                        }
                        
                        // Площадь треугольника (чем больше, тем лучше)
                        const area = Math.abs(
                            (b.x - a.x) * (c.y - a.y) - 
                            (b.y - a.y) * (c.x - a.x)
                        ) / 2;
                        
                        // Равномерность (чем ближе к равностороннему, тем лучше)
                        const ab = this.distance(a, b);
                        const bc = this.distance(b, c);
                        const ca = this.distance(c, a);
                        const maxSide = Math.max(ab, bc, ca);
                        const minSide = Math.min(ab, bc, ca);
                        const uniformity = minSide / (maxSide + 0.0001);
                        
                        // Общий балл
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
                
                // Вычисляем барицентрические координаты
                const bary = this.computeBarycentric(newNode, aNew, bNew, cNew);
                
                // Восстанавливаем позицию
                let x = a.x * bary.alpha + b.x * bary.beta + c.x * bary.gamma;
                let y = a.y * bary.alpha + b.y * bary.beta + c.y * bary.gamma;
                
                // 🔥🔥🔥 ОГРАНИЧИВАЕМ КООРДИНАТЫ
                const BOUNDS = {
                    minX: 0,
                    maxX: 800,
                    minY: 0,
                    maxY: 600
                };
                
                x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, x));
                y = Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, y));
                
                nodeInfo.nodeData.x = x;
                nodeInfo.nodeData.y = y;
                nodeInfo.nodeData.triangulated = true;
                
                triangulated.push(nodeInfo);
                
                if (this.debug) {
                    console.log(`   🔺 ${newNodeId.substring(0, 20)}... восстановлен (зона: ${targetZone}, балл: ${bestScore.toFixed(0)})`);
                    console.log(`      Позиция: (${x.toFixed(1)}, ${y.toFixed(1)})`);
                }
            } else {
                triangulated.push(nodeInfo);
                if (this.debug) {
                    console.log(`   ⚠️ ${newNodeId.substring(0, 20)}... не удалось найти треугольник в зоне ${targetZone}`);
                }
            }
        }
        
        console.log(`   ✅ Восстановлено: ${triangulated.filter(n => n.nodeData.triangulated).length}/${nodesToAdd.length}`);
        return triangulated;
    }

    // Находим узлы для добавления в модель
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
                        connectionsToMatched: connectionsToMatched,
                        triangulated: false
                    },
                    connectionsToMatched: connectionsToMatched,
                    fingerprint: newFingerprints.get(nodeId),
                    reason: `connected to ${connectionsToMatched} matched nodes`
                });
            }
        }

        return nodesToAdd;
    }

    // Считаем связи с совпавшими узлами
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

    // Добавляем узлы в модель
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

            if (this.debug) {
                console.log(`   + ${nodeId.substring(0, 20)}... ${nodeInfo.reason} ${nodeData.triangulated ? '🔺' : '📍'}`);
            }
        }

        // Обновляем степени узлов
        this.updateNodeDegrees(model.graph);

        return addedNodes;
    }

    // Обновляем степени узлов в графе
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

    // Обновление подтверждений узлов
    updateNodeConfirmations(modelId, matches) {
        const model = this.models.get(modelId);
        let updated = 0;

        for (const match of matches) {
            const nodeId = match.node1;
            if (model.graph.nodes.has(nodeId)) {
                const node = model.graph.nodes.get(nodeId);
                
                node.confirmationCount = (node.confirmationCount || 1) + 1;
                node.lastConfirmed = new Date();
                
                if (match.confidence) {
                    node.confidence = Math.max(node.confidence || 0.5, match.confidence);
                }
                
                updated++;
            }
        }

        console.log(`📈 Обновлены подтверждения для ${updated} узлов`);
    }

    // Обновляем подписи модели
    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
        
        console.log(`🔄 Обновляю WL-подписи для модели ${modelId}...`);

        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;

        console.log(`✅ Подписи обновлены: ${newFingerprints.size} узлов`);
        
        return newFingerprints;
    }

    // Расстояние между точками
    distance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Вычисление барицентрических координат
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

    // Получить информацию о модели
    getModelInfo(modelId = null) {
        const targetModelId = modelId || this.currentModelId;

        if (!targetModelId || !this.models.has(targetModelId)) {
            return { error: 'Model not found' };
        }

        const model = this.models.get(targetModelId);
        const graph = model.graph;
        const fpInfo = this.fingerprinter.getFingerprintInfo(model.fingerprints);

        const confirmations = { 1: 0, 2: 0, 3: 0, '4+': 0 };
        const sources = {};

        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmations['4+']++;
            else confirmations[count] = (confirmations[count] || 0) + 1;

            const source = node.addedFrom || 'original';
            sources[source] = (sources[source] || 0) + 1;
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
                confirmed1: confirmations[1] || 0,
                confirmed2: confirmations[2] || 0,
                confirmed3: confirmations[3] || 0,
                confirmed4plus: confirmations['4+'] || 0,
                triangulated: this.stats.totalTriangulated,
                nodeSources: sources
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

    // Визуализация модели
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
        console.log(`   ID: ${model.id}`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);
        console.log(`   Создана: ${model.metadata.createdAt.toLocaleString('ru-RU')}`);

        const confirmations = { 1: 0, 2: 0, 3: 0, '4+': 0 };
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmations['4+']++;
            else confirmations[count] = (confirmations[count] || 0) + 1;
        }

        console.log(`\n🎯 ПОДТВЕРЖДЕНИЯ:`);
        console.log(`   🔴 4+ подтверждений: ${confirmations['4+']} (ядра)`);
        console.log(`   🟠 3 подтверждения: ${confirmations[3]} (стабильные)`);
        console.log(`   🟡 2 подтверждения: ${confirmations[2]} (подтверждённые)`);
        console.log(`   🔵 1 подтверждение: ${confirmations[1]} (новые)`);

        const showNodes = options.showNodes || 8;
        console.log(`\n📋 УЗЛЫ (первые ${showNodes}):`);

        let count = 0;
        for (const [nodeId, node] of graph.nodes) {
            if (count++ >= showNodes) break;

            const source = node.addedFrom ? `[${node.addedFrom}]` : '[original]';
            const tri = node.triangulated ? '🔺' : '  ';
            console.log(`   ${tri} ${nodeId.substring(0, 20)}... ${source}: (${node.x?.toFixed(1) || '?'}, ${node.y?.toFixed(1) || '?'}) | степень: ${node.degree} | подтверждений: ${node.confirmationCount || 1}`);
        }

        if (graph.nodes.size > showNodes) {
            console.log(`   ... и еще ${graph.nodes.size - showNodes} узлов`);
        }

        console.log(`\n📜 ИСТОРИЯ (последние 3 действия):`);
        model.history.slice(-3).forEach((entry, idx) => {
            console.log(`   ${entry.action === 'created' ? '🆕' : '🔧'} ${entry.action.toUpperCase()}: ${new Date(entry.timestamp).toLocaleTimeString()}`);
            console.log(`      Узлов: ${entry.nodes || '?'}, Рёбер: ${entry.edges || '?'}`);
            if (entry.newNodes) console.log(`      +${entry.newNodes} новых узлов`);
            if (entry.triangulated) console.log(`      🔺 ${entry.triangulated} по триангуляции`);
            if (entry.mappingAccuracy) console.log(`      🎯 Точность маппинга: ${entry.mappingAccuracy}%`);
        });

        console.log(`═`.repeat(70));
    }

    // Экспорт модели
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
            _version: '5.0-mapping-diagnostics',
            _exportedAt: new Date().toISOString()
        };
    }

    // Импорт модели
    importModel(data) {
        if (!data || !data.id || !data.graph) {
            console.log('⚠️ Неверный формат данных для импорта');
            return false;
        }

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
                originalPoints: data.originalPoints || []
            };

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
            console.log(`   Узлов: ${graph.nodes.size}, Рёбер: ${graph.edges.size}`);

            return true;

        } catch (error) {
            console.log(`❌ Ошибка импорта модели: ${error.message}`);
            return false;
        }
    }

    // Глобальная статистика
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
                triangulated: this.stats.totalTriangulated,
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
