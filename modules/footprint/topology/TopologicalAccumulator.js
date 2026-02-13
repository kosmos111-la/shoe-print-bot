// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ АККУМУЛЯТИВНАЯ МОДЕЛЬ С ПОЛНОЙ ДИАГНОСТИКОЙ МАППИНГА

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
            totalExactMatches: 0,
            totalSimilarMatches: 0,
            totalLostPoints: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log(`🏗️ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   Порог совпадения: ${this.similarityThreshold * 100}%`);
        console.log(`   Минимум для достройки: ${this.minMatchesForEnhancement} узлов`);
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
                similarMatches: comparison.similarMatches.length,
                newNodesAdded: enhancementResult.newNodesAdded,
                totalNodesInModel: this.models.get(modelId).graph.nodes.size,
                lostPoints: enhancementResult.lostPoints,
                mappingAccuracy: enhancementResult.mappingAccuracy,
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

    // 🔥🔥🔥 ПОЛНАЯ ДИАГНОСТИКА МАППИНГА
    async enhanceModel(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`\n🔧 ДОСТРАИВАЮ МОДЕЛЬ "${modelId}"...`);

        const model = this.models.get(modelId);
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
        const exactMatches = comparison.exactMatches || [];
        const similarMatches = comparison.similarMatches || [];

        // 🔥🔥🔥 ТАБЛИЦА 1: ТОЧКИ ИЗ МОДЕЛИ - КТО НАШЁЛСЯ, КТО ПОТЕРЯН
        console.log(`\n📋 ТАБЛИЦА 1: ТОЧКИ ИЗ ПЕРВОГО ФОТО (МОДЕЛЬ) - СТАТУС ВО ВТОРОМ ФОТО`);
        console.log(`┌─────┬────────────────────┬─────────────┬─────────┬────────────────────┬─────────────┬─────────┐`);
        console.log(`│  #  │   ТОЧКА В МОДЕЛИ   │ КООРДИНАТЫ  │  ЗОНА   │   СООТВЕТСТВИЕ В   │ КООРДИНАТЫ  │ СТАТУС  │`);
        console.log(`│     │                    │             │         │       ФОТО 2       │             │         │`);
        console.log(`├─────┼────────────────────┼─────────────┼─────────┼────────────────────┼─────────────┼─────────┤`);

        const modelNodes = Array.from(model.graph.nodes.entries());
        let foundCount = 0;
        let lostCount = 0;
        const matchMap = new Map();
       
        // Создаём карту соответствий
        for (const match of allMatches) {
            matchMap.set(match.node1, match.node2);
        }

        modelNodes.forEach(([nodeId, node], idx) => {
            const zone = node.y > 350 ? 'ПЯТКА' : node.y < 200 ? 'НОСОК' : 'ЦЕНТР';
            const matchNodeId = matchMap.get(nodeId);
           
            if (matchNodeId) {
                const matchNode = newGraph.nodes.get(matchNodeId);
                const matchZone = matchNode.y > 350 ? 'ПЯТКА' : matchNode.y < 200 ? 'НОСОК' : 'ЦЕНТР';
                const isExact = exactMatches.some(m => m.node1 === nodeId);
                const isSimilar = similarMatches.some(m => m.node1 === nodeId);
                const status = isExact ? '✅ ТОЧНОЕ' : (isSimilar ? '🔄 ПОХОЖЕЕ' : '⚠️ НЕОПР');
                const zoneMatch = zone === matchZone ? '✅' : '❌';
               
                console.log(
                    `│ ${(idx+1).toString().padEnd(3)} │ ${nodeId.substring(0, 18).padEnd(18)} │ ` +
                    `(${node.x.toFixed(1).padStart(6)}, ${node.y.toFixed(1).padStart(6)}) │ ${zone.padEnd(7)} │ ` +
                    `${matchNodeId.substring(0, 18).padEnd(18)} │ ` +
                    `(${matchNode.x.toFixed(1).padStart(6)}, ${matchNode.y.toFixed(1).padStart(6)}) │ ` +
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

        console.log(`└─────┴────────────────────┴─────────────┴─────────┴────────────────────┴─────────────┴─────────┘`);
        console.log(`\n📊 СТАТИСТИКА ТОЧЕК МОДЕЛИ:`);
        console.log(`   ✅ Найдено во втором фото: ${foundCount} из ${modelNodes.length}`);
        console.log(`   ❌ Потеряно: ${lostCount} из ${modelNodes.length}`);
        console.log(`   📈 Точность сохранения: ${((foundCount / modelNodes.length) * 100).toFixed(1)}%`);

        // 🔥🔥🔥 ТАБЛИЦА 2: НОВЫЕ ТОЧКИ ТОЛЬКО В ФОТО 2
        const mappedNodeIds = new Set(allMatches.map(m => m.node2));
        const newPoints = [];
       
        for (const [nodeId, node] of newGraph.nodes) {
            if (!mappedNodeIds.has(nodeId) && !model.graph.nodes.has(nodeId)) {
                newPoints.push({ nodeId, node });
            }
        }

        console.log(`\n📋 ТАБЛИЦА 2: НОВЫЕ ТОЧКИ ТОЛЬКО ВО ВТОРОМ ФОТО`);
        console.log(`┌─────┬────────────────────┬─────────────┬─────────┬────────────────────┬─────────────┬─────────┐`);
        console.log(`│  #  │   ТОЧКА В ФОТО 2   │ КООРДИНАТЫ  │  ЗОНА   │   ВОССТАНОВЛЕНА    │ КООРДИНАТЫ  │ СТАТУС  │`);
        console.log(`│     │                    │             │         │     В МОДЕЛИ       │ В МОДЕЛИ    │         │`);
        console.log(`├─────┼────────────────────┼─────────────┼─────────┼────────────────────┼─────────────┼─────────┤`);

        newPoints.forEach(({nodeId, node}, idx) => {
            const zone = node.y > 350 ? 'ПЯТКА' : node.y < 200 ? 'НОСОК' : 'ЦЕНТР';
            const modelNode = model.graph.nodes.get(nodeId);
           
            if (modelNode) {
                const modelZone = modelNode.y > 350 ? 'ПЯТКА' : modelNode.y < 200 ? 'НОСОК' : 'ЦЕНТР';
                const zoneMatch = zone === modelZone ? '✅' : '❌';
                const triangulated = modelNode.triangulated ? '🔺 ТРИАНГ' : '📍 КОПИЯ';
               
                console.log(
                    `│ ${(idx+1).toString().padEnd(3)} │ ${nodeId.substring(0, 18).padEnd(18)} │ ` +
                    `(${node.x.toFixed(1).padStart(6)}, ${node.y.toFixed(1).padStart(6)}) │ ${zone.padEnd(7)} │ ` +
                    `${modelNode.id.substring(0, 18).padEnd(18)} │ ` +
                    `(${modelNode.x.toFixed(1).padStart(6)}, ${modelNode.y.toFixed(1).padStart(6)}) │ ` +
                    `${triangulated} ${zoneMatch} │`
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

        console.log(`└─────┴────────────────────┴─────────────┴─────────┴────────────────────┴─────────────┴─────────┘`);

        // 🔥🔥🔥 ТАБЛИЦА 3: ДЕТАЛЬНАЯ ИНФОРМАЦИЯ О СОВПАДЕНИЯХ ПО ЗОНАМ
        console.log(`\n📋 ТАБЛИЦА 3: ДЕТАЛИЗАЦИЯ СОВПАДЕНИЙ ПО ЗОНАМ`);
       
        const zoneStats = {
            HEEL: { total: 0, exact: 0, similar: 0, lost: 0, correct: 0, wrong: 0 },
            CENTER: { total: 0, exact: 0, similar: 0, lost: 0, correct: 0, wrong: 0 },
            TOE: { total: 0, exact: 0, similar: 0, lost: 0, correct: 0, wrong: 0 }
        };

        for (const [nodeId, node] of model.graph.nodes) {
            const zone = node.y > 350 ? 'HEEL' : node.y < 200 ? 'TOE' : 'CENTER';
            zoneStats[zone].total++;
           
            const matchNodeId = matchMap.get(nodeId);
            if (matchNodeId) {
                const matchNode = newGraph.nodes.get(matchNodeId);
                const matchZone = matchNode.y > 350 ? 'HEEL' : matchNode.y < 200 ? 'TOE' : 'CENTER';
               
                if (exactMatches.some(m => m.node1 === nodeId)) {
                    zoneStats[zone].exact++;
                } else {
                    zoneStats[zone].similar++;
                }
               
                if (zone === matchZone) {
                    zoneStats[zone].correct++;
                } else {
                    zoneStats[zone].wrong++;
                }
            } else {
                zoneStats[zone].lost++;
            }
        }

        console.log(`┌─────────┬─────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐`);
        console.log(`│  ЗОНА   │  ВСЕГО      │ ТОЧНЫЕ   │ ПОХОЖИЕ  │ ПОТЕРЯНО │ ВЕРНО    │ ОШИБОЧНО │`);
        console.log(`├─────────┼─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤`);
        console.log(
            `│ ПЯТКА   │ ${zoneStats.HEEL.total.toString().padStart(7)}    │ ` +
            `${zoneStats.HEEL.exact.toString().padStart(6)}   │ ` +
            `${zoneStats.HEEL.similar.toString().padStart(6)}   │ ` +
            `${zoneStats.HEEL.lost.toString().padStart(6)}   │ ` +
            `${zoneStats.HEEL.correct.toString().padStart(6)}   │ ` +
            `${zoneStats.HEEL.wrong.toString().padStart(6)}   │`
        );
        console.log(
            `│ ЦЕНТР   │ ${zoneStats.CENTER.total.toString().padStart(7)}    │ ` +
            `${zoneStats.CENTER.exact.toString().padStart(6)}   │ ` +
            `${zoneStats.CENTER.similar.toString().padStart(6)}   │ ` +
            `${zoneStats.CENTER.lost.toString().padStart(6)}   │ ` +
            `${zoneStats.CENTER.correct.toString().padStart(6)}   │ ` +
            `${zoneStats.CENTER.wrong.toString().padStart(6)}   │`
        );
        console.log(
            `│ НОСОК   │ ${zoneStats.TOE.total.toString().padStart(7)}    │ ` +
            `${zoneStats.TOE.exact.toString().padStart(6)}   │ ` +
            `${zoneStats.TOE.similar.toString().padStart(6)}   │ ` +
            `${zoneStats.TOE.lost.toString().padStart(6)}   │ ` +
            `${zoneStats.TOE.correct.toString().padStart(6)}   │ ` +
            `${zoneStats.TOE.wrong.toString().padStart(6)}   │`
        );
        console.log(`└─────────┴─────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘`);

        // 🔥🔥🔥 СТАТИСТИКА ПО КАЧЕСТВУ ВОССТАНОВЛЕНИЯ
        const restoredPoints = [];
        for (const node of model.graph.nodes.values()) {
            if (node.triangulated) {
                restoredPoints.push(node);
            }
        }

        console.log(`\n📊 СТАТИСТИКА ВОССТАНОВЛЕНИЯ:`);
        console.log(`   🔺 Всего восстановлено триангуляцией: ${restoredPoints.length}`);
       
        let correctRestore = 0;
        let wrongRestore = 0;
       
        for (const node of restoredPoints) {
            const originalNode = newGraph.nodes.get(node.originalId);
            if (originalNode) {
                const zone = originalNode.y > 350 ? 'ПЯТКА' : originalNode.y < 200 ? 'НОСОК' : 'ЦЕНТР';
                const modelZone = node.y > 350 ? 'ПЯТКА' : node.y < 200 ? 'НОСОК' : 'ЦЕНТР';
               
                if (zone === modelZone) {
                    correctRestore++;
                } else {
                    wrongRestore++;
                }
            }
        }
       
        console.log(`      ✅ Восстановлено в правильную зону: ${correctRestore}`);
        console.log(`      ❌ Восстановлено в неправильную зону: ${wrongRestore}`);
        console.log(`      📈 Точность восстановления: ${((correctRestore / (correctRestore + wrongRestore)) * 100).toFixed(1)}%`);

        // Сохраняем статистику
        this.stats.totalExactMatches = exactMatches.length;
        this.stats.totalSimilarMatches = similarMatches.length;
        this.stats.totalLostPoints = lostCount;

        // Проверяем достаточно ли совпадений для достройки
        if (allMatches.length < this.minMatchesForEnhancement) {
            console.log(`\n⚠️ Мало совпадений для достройки: ${allMatches.length} < ${this.minMatchesForEnhancement}`);
            return {
                newNodesAdded: 0,
                reason: 'insufficient_matches',
                lostPoints: lostCount,
                mappingAccuracy: ((foundCount / modelNodes.length) * 100).toFixed(1)
            };
        }

        // Создаем маппинг
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
            console.log(`\n✅ Все узлы уже есть в модели`);
            return {
                newNodesAdded: 0,
                reason: 'all_nodes_exist',
                lostPoints: lostCount,
                mappingAccuracy: ((foundCount / modelNodes.length) * 100).toFixed(1)
            };
        }

        console.log(`\n🎯 Найдено ${nodesToAdd.length} новых узлов для добавления`);

        // Триангуляционное восстановление позиций
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
            exactMatches: exactMatches.length,
            similarMatches: similarMatches.length,
            lostPoints: lostCount,
            mappingAccuracy: ((foundCount / modelNodes.length) * 100).toFixed(1),
            similarity: comparison.similarity,
            source: options.source || 'unknown',
            triangulated: triangulatedNodes.filter(n => n.nodeData.triangulated).length
        });

        this.stats.totalEnhancements++;
        this.stats.totalTriangulated += triangulatedNodes.filter(n => n.nodeData.triangulated).length;
        this.stats.lastUpdated = new Date();

        console.log(`\n✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
        console.log(`   🔺 По триангуляции: ${triangulatedNodes.filter(n => n.nodeData.triangulated).length}`);
        console.log(`   🎯 Точность маппинга: ${((foundCount / modelNodes.length) * 100).toFixed(1)}%`);

        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            allMatches: allMatches.length,
            triangulated: triangulatedNodes.filter(n => n.nodeData.triangulated).length,
            lostPoints: lostCount,
            mappingAccuracy: ((foundCount / modelNodes.length) * 100).toFixed(1)
        };
    }

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
           
            // Находим ВСЕХ соседей в маппинге
            const candidates = [];
            for (const edge of newGraph.edges) {
                const [nodeA, nodeB] = edge.split('--');
                if (nodeA === newNodeId && mapping.has(nodeB)) {
                    const neighborNode = newGraph.nodes.get(nodeB);
                    const neighborY = neighborNode.y;
                    const neighborZone = neighborY > 350 ? 'HEEL' : neighborY < 200 ? 'TOE' : 'CENTER';
                   
                    // 🔥 ЖЁСТКИЙ ФИЛЬТР - ТОЛЬКО ТОЧКИ ИЗ ТОЙ ЖЕ ЗОНЫ!
                    if (neighborZone === targetZone) {
                        candidates.push({
                            id: mapping.get(nodeB),
                            node: neighborNode,
                            modelNode: modelGraph.nodes.get(mapping.get(nodeB)),
                            dist: this.distance(newNode, neighborNode)
                        });
                    }
                } else if (nodeB === newNodeId && mapping.has(nodeA)) {
                    const neighborNode = newGraph.nodes.get(nodeA);
                    const neighborY = neighborNode.y;
                    const neighborZone = neighborY > 350 ? 'HEEL' : neighborY < 200 ? 'TOE' : 'CENTER';
                   
                    if (neighborZone === targetZone) {
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
                    console.log(`   ⚠️ ${newNodeId.substring(0, 20)}... только ${candidates.length} соседей в зоне ${targetZone}`);
                }
                triangulated.push(nodeInfo);
                continue;
            }
           
            // Сортируем по расстоянию
            candidates.sort((a, b) => a.dist - b.dist);
           
            // Берём топ-6 ближайших и ищем лучший треугольник
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
                            continue;
                        }
                       
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
               
                // Мягкие границы (не даём улететь в космос)
                const BOUNDS = { minX: 0, maxX: 800, minY: 0, maxY: 600 };
                x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, x));
                y = Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, y));
               
                nodeInfo.nodeData.x = x;
                nodeInfo.nodeData.y = y;
                nodeInfo.nodeData.triangulated = true;
               
                triangulated.push(nodeInfo);
               
                if (this.debug) {
                    console.log(`   🔺 ${newNodeId.substring(0, 20)}... восстановлен в зоне ${targetZone}`);
                    console.log(`      Позиция: (${x.toFixed(1)}, ${y.toFixed(1)})`);
                }
            } else {
                triangulated.push(nodeInfo);
                if (this.debug) {
                    console.log(`   ⚠️ ${newNodeId.substring(0, 20)}... нет подходящего треугольника в зоне ${targetZone}`);
                }
            }
        }
       
        console.log(`   ✅ Восстановлено: ${triangulated.filter(n => n.nodeData.triangulated).length}/${nodesToAdd.length}`);
        return triangulated;
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
                console.log(`   + ${nodeId.substring(0, 20)}... ${nodeInfo.reason} ${nodeData.triangulated ? '🔺' : '📍'}`);
            }
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

    getModelInfo(modelId = null) {
        const targetModelId = modelId || this.currentModelId;
        if (!targetModelId || !this.models.has(targetModelId)) return { error: 'Model not found' };

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
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated
        };
    }

// 🔥🔥🔥 ДОБАВЬ ЭТОТ МЕТОД В КОНЕЦ КЛАССА (перед exportModel)

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
    console.log(`   Создана: ${model.metadata.createdAt.toLocaleString('ru-RU')}`);

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
        const tri = node.triangulated ? '🔺' : '  ';
        const zone = node.y > 350 ? 'П' : node.y < 200 ? 'Н' : 'Ц';
        console.log(
            `   ${tri} ${nodeId.substring(0, 16)}... ${source}: ` +
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
        console.log(`      Узлов: ${entry.nodes || '?'}, Рёбер: ${entry.edges || '?'}`);
        if (entry.newNodes) console.log(`      +${entry.newNodes} новых узлов`);
        if (entry.triangulated) console.log(`      🔺 ${entry.triangulated} по триангуляции`);
        if (entry.mappingAccuracy) console.log(`      🎯 Точность маппинга: ${entry.mappingAccuracy}%`);
    });

    console.log(`═`.repeat(70));
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
            stats: this.getModelInfo(targetModelId).stats,
            _version: '6.0-full-diagnostics',
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
            this.models.set(modelId, model);
            if (!this.currentModelId) this.currentModelId = modelId;
            return true;
        } catch (error) {
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
                triangulated: this.stats.totalTriangulated,
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
            }
        };
    }
}

module.exports = TopologicalAccumulator;
