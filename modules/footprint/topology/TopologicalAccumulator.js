// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ ЧИСТАЯ ТОПОЛОГИЯ + ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ

const GeometryMemory = require('./GeometryMemory');

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;
        this.minMatchesForEnhancement = options.minMatchesForEnhancement || 3;
        this.similarityThreshold = options.similarityThreshold || 0.6;
       
        // 🔥 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ
        this.geometryMemory = new GeometryMemory({ debug: this.debug });
       
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
            totalGeomRestored: 0,
            totalForgotten: 0,
            totalResurrected: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
       
        console.log(`🏗️ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   Порог совпадения: ${this.similarityThreshold * 100}%`);
        console.log(`   Минимум для достройки: ${this.minMatchesForEnhancement} узлов`);
        console.log(`   🎯 ФИЛОСОФИЯ: Чистая топология + Геометрическая память`);
        console.log(`   🔥 ДОВЕРИЕ: Динамическая система с затуханием`);
        console.log(`   📐 ГЕОМЕТРИЯ: Инвариантные отношения (без координат в логике)`);
    }

    async processPoints(points, options = {}) {
        if (this.debug) {
            console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК (ТОПОЛОГИЯ + ГЕОМЕТРИЯ)...`);
        }
       
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
       
        // Применяем систему доверия
        this.applyTrustSystem(modelId, comparison);
       
        if (comparison.similarity >= this.similarityThreshold) {
            console.log(`✅ СТРУКТУРНОЕ СОВПАДЕНИЕ: ${(comparison.similarity * 100).toFixed(1)}% ≥ ${this.similarityThreshold * 100}%`);
           
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
                message: `Модель улучшена (+${enhancementResult.newNodesAdded} узлов)`,
                method: 'pure_topological_enhancement_with_geometry'
            };
        } else {
            console.log(`🆕 РАЗНЫЕ СТРУКТУРЫ: ${(comparison.similarity * 100).toFixed(1)}% < ${this.similarityThreshold * 100}%`);
           
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
            // 🔥 ХРАНИЛИЩЕ ОРИГИНАЛЬНЫХ КООРДИНАТ
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
                edges: graph.edges.size,
                method: 'pure_topology_with_geometry'
            }]
        };
       
        // Инициализируем систему доверия
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
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Треугольников: ${graph.triangles?.length || 0}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);
       
        const fpInfo = this.fingerprinter.getFingerprintInfo(fingerprints);
        console.log(`   Уникальных структурных подписей: ${fpInfo.uniqueSignatures}/${fpInfo.totalNodes} (${(fpInfo.uniquenessRatio * 100).toFixed(1)}%)`);
        console.log(`   📐 Геометрическая память инициализирована`);
       
        return {
            status: 'created',
            modelId: modelId,
            nodes: graph.nodes.size,
            edges: graph.edges.size,
            avgDegree: graph.avgDegree,
            message: `Создана новая модель с геометрической памятью`
        };
    }

    // 🔥 УЛУЧШЕНИЕ МОДЕЛИ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ
    async enhanceModelStructural(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`🔧 УЛУЧШЕНИЕ МОДЕЛИ "${modelId}" с геометрической памятью...`);
       
        const model = this.models.get(modelId);
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
       
        console.log(`📊 Структурных совпадений: ${allMatches.length}`);
       
        if (allMatches.length < this.minMatchesForEnhancement) {
            return { newNodesAdded: 0, reason: 'insufficient_structural_matches' };
        }
       
        // Создаём маппинг структурных соответствий
        const structuralMapping = this.createStructuralMapping(
            model.fingerprints,
            newFingerprints,
            allMatches
        );
       
        console.log(`🗺️ Создан структурный маппинг: ${structuralMapping.size} соответствий`);
       
        // 🔥 СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ ИЗ НОВОГО ФОТО
        this.saveOriginalCoordinates(model, newGraph, structuralMapping);
       
        // Находим структурно новые узлы
        const structurallyNewNodes = this.findStructurallyNewNodes(
            model.graph,
            newGraph,
            newFingerprints,
            structuralMapping
        );
       
        if (structurallyNewNodes.length === 0) {
            console.log(`✅ Все структурные узлы уже в модели`);
            return { newNodesAdded: 0, reason: 'all_structural_nodes_exist' };
        }
       
        console.log(`🎯 Найдено ${structurallyNewNodes.length} СТРУКТУРНО НОВЫХ узлов`);
       
        // 🔥 ДОБАВЛЯЕМ УЗЛЫ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ
        const addedNodes = this.addStructuralNodesWithGeometry(
            modelId,
            structurallyNewNodes,
            newGraph,
            structuralMapping,
            options
        );
       
        // Обновляем подписи
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }
       
        // Увеличиваем подтверждения
        this.increaseStructuralConfirmations(modelId, structuralMapping);
       
        model.history.push({
            action: 'enhanced_with_geometry',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            similarity: comparison.similarity,
            source: options.source || 'unknown',
            method: 'pure_topological_enhancement_with_geometry'
        });
       
        this.stats.totalEnhancements++;
        this.stats.lastUpdated = new Date();
       
        console.log(`✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
       
        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            geometryApplied: addedNodes.filter(n => n.method === 'original_from_photo' || n.method === 'between' || n.method === 'barycentric').length
        };
    }

    // 🔥 СОХРАНЕНИЕ ОРИГИНАЛЬНЫХ КООРДИНАТ
    saveOriginalCoordinates(model, newGraph, structuralMapping) {
        if (!model.photoCoordinates) {
            model.photoCoordinates = new Map();
        }
       
        let savedCount = 0;
        for (const [newNodeId, modelNodeId] of structuralMapping) {
            const node = newGraph.nodes.get(newNodeId);
            if (node && node._hasOriginalCoordinates) {
                model.photoCoordinates.set(newNodeId, {
                    x: node._originalX,
                    y: node._originalY,
                    confidence: node.confidence || 0.5,
                    degree: node.degree || 0
                });
                savedCount++;
            }
        }
       
        console.log(`   📐 Сохранено ${savedCount} оригинальных координат из нового фото`);
    }

    // 🔥 ДОБАВЛЕНИЕ УЗЛОВ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ
    addStructuralNodesWithGeometry(modelId, newNodes, newGraph, structuralMapping, options) {
        const model = this.models.get(modelId);
        const addedNodes = [];
       
        console.log(`🔨 Добавляю ${newNodes.length} узлов с геометрической памятью...`);
       
        for (const nodeInfo of newNodes) {
            const originalNodeId = nodeInfo.nodeId;
            const sourceNode = newGraph.nodes.get(originalNodeId);
            if (!sourceNode) continue;
           
            // 🔥 ПЫТАЕМСЯ ВОССТАНОВИТЬ ПО ГЕОМЕТРИЧЕСКОЙ ПАМЯТИ
            let visualizationPosition = null;
           
            // 1. СНАЧАЛА - оригинальные координаты из фото (если есть)
            if (model.photoCoordinates && model.photoCoordinates.has(originalNodeId)) {
                const photoCoord = model.photoCoordinates.get(originalNodeId);
                visualizationPosition = {
                    x: photoCoord.x,
                    y: photoCoord.y,
                    method: 'original_from_photo',
                    confidence: 0.95
                };
                console.log(`   📍 ИСПОЛЬЗУЮ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ ИЗ ФОТО: (${visualizationPosition.x.toFixed(1)}, ${visualizationPosition.y.toFixed(1)})`);
            }
           
            // 2. ЕСЛИ НЕТ - пробуем восстановить через геометрическую память
            if (!visualizationPosition) {
                const reconstructed = this.geometryMemory.reconstructPosition(
                    originalNodeId,
                    model.graph
                );
                if (reconstructed) {
                    visualizationPosition = {
                        x: reconstructed.x,
                        y: reconstructed.y,
                        method: reconstructed.method,
                        confidence: reconstructed.confidence || 0.7
                    };
                    console.log(`   📍 Восстановлено геометрической памятью: (${visualizationPosition.x.toFixed(1)}, ${visualizationPosition.y.toFixed(1)}) [${visualizationPosition.method}]`);
                    this.stats.totalGeomRestored++;
                }
            }
           
            // 3. ВЫБИРАЕМ ЛУЧШИХ СОСЕДЕЙ (ТОЛЬКО 2!)
            const bestNeighbors = this.findBestNeighborsForPosition(
                originalNodeId,
                newGraph,
                structuralMapping,
                model.graph
            );
           
            // 4. ЕСЛИ ВСЁ ЕЩЁ НЕТ - вычисляем через лучших соседей
            if (!visualizationPosition) {
                visualizationPosition = this.calculateVisualizationPosition(
                    bestNeighbors,
                    model.graph
                );
                console.log(`   📍 Вычислена визуализационная позиция: (${visualizationPosition.x.toFixed(1)}, ${visualizationPosition.y.toFixed(1)}) [${visualizationPosition.method}]`);
            }
           
            // 🔥 ЗАПОМИНАЕМ ГЕОМЕТРИЮ ДЛЯ БУДУЩЕГО
            this.geometryMemory.rememberNodeGeometry(
                originalNodeId,
                sourceNode,
                bestNeighbors,  // Сохраняем только лучших соседей!
                newGraph.nodes,
                model.graph.nodes
            );
           
            // СОЗДАЁМ УЗЕЛ В МОДЕЛИ
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
                x: visualizationPosition.x,
                y: visualizationPosition.y,
                confidence: sourceNode.confidence || 0.5,
                geometryMethod: visualizationPosition.method,
                geometryConfidence: visualizationPosition.confidence || 0.5,
                structuralNeighbors: bestNeighbors,
                structuralNeighborCount: bestNeighbors.length,
                originalData: {
                    x: sourceNode._originalX || sourceNode.x,
                    y: sourceNode._originalY || sourceNode.y,
                    confidence: sourceNode.confidence,
                    source: sourceNode.source
                }
            };
           
            model.graph.nodes.set(modelNodeId, newNode);
           
            // Добавляем связи
            let edgesAdded = 0;
            for (const neighborModelId of bestNeighbors) {
                if (model.graph.nodes.has(neighborModelId)) {
                    const edge = [modelNodeId, neighborModelId].sort().join('--');
                    model.graph.edges.add(edge);
                    edgesAdded++;
                    newNode.degree++;
                    model.graph.nodes.get(neighborModelId).degree++;
                }
            }
           
            console.log(`   + ${modelNodeId.substring(0, 20)}...`);
            console.log(`     🔗 связей: ${edgesAdded}`);
            console.log(`     📐 метод: ${visualizationPosition.method}`);
            console.log(`     📐 оригинальные координаты: ${visualizationPosition.method === 'original_from_photo' ? 'да' : 'нет'}`);
           
            addedNodes.push({
                id: modelNodeId,
                x: newNode.x,
                y: newNode.y,
                confidence: newNode.confidence,
                structuralNeighbors: newNode.structuralNeighborCount,
                edgesAdded: edgesAdded,
                method: visualizationPosition.method
            });
        }
       
        console.log(`✅ Добавлено ${addedNodes.length} узлов с геометрической памятью`);
        return addedNodes;
    }

    // 🔥 ВЫБИРАЕМ ЛУЧШИХ 2 СОСЕДЕЙ ДЛЯ ПОЗИЦИОНИРОВАНИЯ
    findBestNeighborsForPosition(nodeId, newGraph, structuralMapping, modelGraph) {
        const allNeighbors = [];
       
        // Собираем всех соседей, которые есть в маппинге
        for (const edge of newGraph.edges) {
            const [nodeA, nodeB] = edge.split('--');
           
            if (nodeA === nodeId && structuralMapping.has(nodeB)) {
                allNeighbors.push(structuralMapping.get(nodeB));
            } else if (nodeB === nodeId && structuralMapping.has(nodeA)) {
                allNeighbors.push(structuralMapping.get(nodeA));
            }
        }
       
        if (allNeighbors.length <= 2) {
            return allNeighbors;
        }
       
        // Оцениваем каждого соседа и берём ТОЛЬКО 2 ЛУЧШИХ
        const scoredNeighbors = allNeighbors.map(neighborId => {
            const node = modelGraph.nodes.get(neighborId);
            let score = 0;
           
            // Высокая степень = надёжный узел
            score += (node?.degree || 0) * 0.1;
           
            // Много подтверждений = надёжный узел
            score += (node?.confirmationCount || 1) * 0.2;
           
            // Оригинальные узлы надёжнее структурных
            if (node?.addedFrom === 'original_creation') {
                score += 0.5;
            }
           
            // Чем больше соседей, тем хуже (специфичность)
            score -= (allNeighbors.length / 10);
           
            return { id: neighborId, score };
        });
       
        // Сортируем и берём топ-2
        const bestTwo = scoredNeighbors
            .sort((a, b) => b.score - a.score)
            .slice(0, 2)
            .map(n => n.id);
       
        if (this.debug) {
            console.log(`   🔍 Выбрано 2 лучших соседа из ${allNeighbors.length}`);
        }
       
        return bestTwo;
    }

    // 🔥 ПОИСК СТРУКТУРНО НОВЫХ УЗЛОВ
    findStructurallyNewNodes(modelGraph, newGraph, newFingerprints, structuralMapping) {
        console.log(`🔍 Поиск структурно новых узлов...`);
       
        const newNodes = [];
        const mappedNodeIds = new Set(structuralMapping.keys());
       
        console.log(`   Узлов в новом графе: ${newGraph.nodes.size}`);
        console.log(`   Уже сопоставлено: ${mappedNodeIds.size}`);
        console.log(`   Ожидаем новых: ${newGraph.nodes.size - mappedNodeIds.size}`);
       
        for (const [nodeId, node] of newGraph.nodes) {
            if (mappedNodeIds.has(nodeId)) continue;
           
            const structuralNeighbors = this.findStructuralNeighborsInNewGraph(
                nodeId,
                newGraph,
                structuralMapping
            );
           
            if (structuralNeighbors.length >= 2) {
                const fingerprint = newFingerprints.get(nodeId);
               
                newNodes.push({
                    nodeId: nodeId,
                    nodeData: node,
                    structuralNeighbors: structuralNeighbors,
                    neighborCount: structuralNeighbors.length,
                    fingerprint: fingerprint,
                    reason: `структурно связан с ${structuralNeighbors.length} узлами модели`
                });
               
                console.log(`   ✓ Структурно новый узел: ${nodeId.substring(0, 25)}...`);
                console.log(`      соседей в модели: ${structuralNeighbors.length}`);
            }
        }
       
        console.log(`🎯 Найдено ${newNodes.length} СТРУКТУРНО НОВЫХ узлов`);
        return newNodes;
    }

    // 🔥 ПОИСК СОСЕДЕЙ В НОВОМ ГРАФЕ
    findStructuralNeighborsInNewGraph(nodeId, newGraph, structuralMapping) {
        const structuralNeighbors = [];
       
        for (const edge of newGraph.edges) {
            const [nodeA, nodeB] = edge.split('--');
           
            if (nodeA === nodeId && structuralMapping.has(nodeB)) {
                structuralNeighbors.push(structuralMapping.get(nodeB));
            } else if (nodeB === nodeId && structuralMapping.has(nodeA)) {
                structuralNeighbors.push(structuralMapping.get(nodeA));
            }
        }
       
        return structuralNeighbors;
    }

    // 🔥 СОЗДАНИЕ СТРУКТУРНОГО МАППИНГА
    createStructuralMapping(modelFingerprints, newFingerprints, matches) {
        console.log(`🗺️ Создание структурного маппинга...`);
       
        const mapping = new Map();
        const usedModelNodes = new Set();
       
        for (const match of matches) {
            const modelNodeId = match.node1;
            const newNodeId = match.node2;
           
            const modelFp = modelFingerprints.get(modelNodeId);
            const newFp = newFingerprints.get(newNodeId);
           
            if (modelFp && newFp) {
                const isExactMatch = modelFp.signature === newFp.signature;
                const isSimilarMatch = match.confidence > 0.8;
               
                if (isExactMatch || isSimilarMatch) {
                    if (!usedModelNodes.has(modelNodeId)) {
                        mapping.set(newNodeId, modelNodeId);
                        usedModelNodes.add(modelNodeId);
                    }
                }
            }
        }
       
        console.log(`✅ Создан структурный маппинг: ${mapping.size} соответствий`);
        return mapping;
    }

    // 🔥 ВЫЧИСЛЕНИЕ ВИЗУАЛИЗАЦИОННОЙ ПОЗИЦИИ
    calculateVisualizationPosition(neighborIds, modelGraph) {
        if (neighborIds.length === 0) {
            return {
                x: 400 + (Math.random() - 0.5) * 200,
                y: 300 + (Math.random() - 0.5) * 200,
                method: 'random_fallback'
            };
        }
       
        if (neighborIds.length === 1) {
            const neighbor = modelGraph.nodes.get(neighborIds[0]);
            if (neighbor) {
                return {
                    x: neighbor.x + (Math.random() - 0.5) * 40,
                    y: neighbor.y + (Math.random() - 0.5) * 40,
                    method: 'single_neighbor_offset'
                };
            }
        }
       
        if (neighborIds.length >= 2) {
            const a = modelGraph.nodes.get(neighborIds[0]);
            const b = modelGraph.nodes.get(neighborIds[1]);
            if (a && b) {
                // Ставим точку посередине между двумя лучшими соседями
                return {
                    x: (a.x + b.x) / 2 + (Math.random() - 0.5) * 20,
                    y: (a.y + b.y) / 2 + (Math.random() - 0.5) * 20,
                    method: 'midpoint_of_best_pair'
                };
            }
        }
       
        return {
            x: 400 + (Math.random() - 0.5) * 200,
            y: 300 + (Math.random() - 0.5) * 200,
            method: 'ultimate_fallback'
        };
    }

    // 🔥 СИСТЕМА ДОВЕРИЯ
    applyTrustSystem(modelId, comparison) {
        const model = this.models.get(modelId);
        if (!model) return;
       
        console.log(`📊 СИСТЕМА ДОВЕРИЯ:`);
       
        const matchedNodes = new Set();
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
       
        for (const match of allMatches) {
            if (match.node1 && model.graph.nodes.has(match.node1)) {
                matchedNodes.add(match.node1);
            }
        }
       
        let confirmedCount = 0;
        let unconfirmedCount = 0;
        let forgottenCount = 0;
       
        for (const [nodeId, node] of model.graph.nodes) {
            if (node.confirmationCount === undefined) node.confirmationCount = 1;
            if (node.unconfirmedStreak === undefined) node.unconfirmedStreak = 0;
           
            if (matchedNodes.has(nodeId)) {
                node.confirmationCount += 1;
                node.unconfirmedStreak = 0;
                node.lastConfirmed = new Date();
                confirmedCount++;
            } else {
                node.unconfirmedStreak += 1;
                unconfirmedCount++;
               
                // Забываем узлы после 10 неподтверждений
                if (node.unconfirmedStreak >= 10 && node.confirmationCount < 3) {
                    node.markedForDeletion = true;
                    forgottenCount++;
                    this.stats.totalForgotten++;
                }
            }
        }
       
        // Удаляем забытые узлы
        if (forgottenCount > 0) {
            this.removeForgottenNodes(modelId);
        }
       
        console.log(`   Подтверждено узлов: ${confirmedCount}`);
        console.log(`   Не подтверждено: ${unconfirmedCount}`);
        console.log(`   Забыто: ${forgottenCount}`);
    }

    // 🔥 УДАЛЕНИЕ ЗАБЫТЫХ УЗЛОВ
    removeForgottenNodes(modelId) {
        const model = this.models.get(modelId);
        if (!model) return;
       
        const nodesToRemove = [];
       
        for (const [nodeId, node] of model.graph.nodes) {
            if (node.markedForDeletion) {
                nodesToRemove.push(nodeId);
            }
        }
       
        if (nodesToRemove.length > 0) {
            console.log(`🧹 Удаляю ${nodesToRemove.length} забытых узлов...`);
           
            for (const nodeId of nodesToRemove) {
                model.graph.nodes.delete(nodeId);
               
                const edgesToRemove = [];
                for (const edge of model.graph.edges) {
                    const [nodeA, nodeB] = edge.split('--');
                    if (nodeA === nodeId || nodeB === nodeId) {
                        edgesToRemove.push(edge);
                    }
                }
               
                for (const edge of edgesToRemove) {
                    model.graph.edges.delete(edge);
                }
            }
        }
    }

    // 🔥 УВЕЛИЧЕНИЕ ПОДТВЕРЖДЕНИЙ
    increaseStructuralConfirmations(modelId, structuralMapping) {
        const model = this.models.get(modelId);
        if (!model || structuralMapping.size === 0) return;
       
        let increasedCount = 0;
       
        for (const [newNodeId, modelNodeId] of structuralMapping) {
            if (model.graph.nodes.has(modelNodeId)) {
                const node = model.graph.nodes.get(modelNodeId);
                node.confirmationCount += 1;
                node.unconfirmedStreak = 0;
                node.lastConfirmed = new Date();
                increasedCount++;
            }
        }
       
        console.log(`📈 Увеличены подтверждения: ${increasedCount} узлов`);
    }

    // 🔥 ОБНОВЛЕНИЕ ПОДПИСЕЙ
    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
        console.log(`🔄 Обновляю структурные подписи...`);
       
        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;
       
        console.log(`✅ Подписи обновлены: ${newFingerprints.size} узлов`);
        return newFingerprints;
    }

    // 🔥 ПОЛУЧЕНИЕ ИНФОРМАЦИИ О МОДЕЛИ
    getModelInfo(modelId = null) {
        const targetModelId = modelId || this.currentModelId;
        if (!targetModelId || !this.models.has(targetModelId)) {
            return { error: 'Model not found' };
        }
       
        const model = this.models.get(targetModelId);
        const graph = model.graph;
        const fpInfo = this.fingerprinter.getFingerprintInfo(model.fingerprints);
       
        // Статистика по подтверждениям
        const confirmationStats = { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0 };
        const geometryStats = { original: 0, between: 0, barycentric: 0, computed: 0 };
       
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmationStats['4+']++;
            else confirmationStats[count] = (confirmationStats[count] || 0) + 1;
           
            if (node.addedFrom === 'structural_enhancement') {
                if (node.geometryMethod === 'original_from_photo') geometryStats.original++;
                else if (node.geometryMethod === 'between') geometryStats.between++;
                else if (node.geometryMethod === 'barycentric') geometryStats.barycentric++;
                else geometryStats.computed++;
            }
        }
       
        return {
            id: model.id,
            name: model.metadata.name,
            stats: {
                nodes: graph.nodes.size,
                edges: graph.edges.size,
                triangles: graph.triangles?.length || 0,
                avgDegree: graph.avgDegree || 0,
                uniqueSignatures: fpInfo.uniqueSignatures,
                uniquenessRatio: fpInfo.uniquenessRatio,
                confirmed4: confirmationStats['4+'] || 0,
                confirmed3: confirmationStats[3] || 0,
                confirmed2: confirmationStats[2] || 0,
                confirmed1: confirmationStats[1] || 0,
                confirmed0: confirmationStats[0] || 0,
                originalGeometry: geometryStats.original,
                betweenGeometry: geometryStats.between,
                barycentricGeometry: geometryStats.barycentric,
                computedGeometry: geometryStats.computed
            },
            metadata: model.metadata,
            history: {
                totalActions: model.history.length,
                lastAction: model.history[model.history.length - 1],
                enhancements: model.history.filter(h => h.action.includes('enhanced')).length
            },
            trustSystem: {
                totalForgotten: this.stats.totalForgotten,
                totalResurrected: this.stats.totalResurrected
            },
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated,
            philosophy: 'pure_topology_with_geometry_memory',
            version: '3.0-geometric-memory'
        };
    }

    // 🔥 ВИЗУАЛИЗАЦИЯ МОДЕЛИ (ДЛЯ КОНСОЛИ)
    visualizeModel(modelId = null, options = {}) {
        const targetModelId = modelId || this.currentModelId;
        if (!targetModelId || !this.models.has(targetModelId)) {
            console.log('⚠️ Модель не найдена');
            return;
        }
       
        const model = this.models.get(targetModelId);
        const graph = model.graph;
       
        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ МОДЕЛИ "${model.metadata.name}" (с геометрией):`);
        console.log(`═`.repeat(80));
       
        console.log(`📊 СТРУКТУРНАЯ ИНФОРМАЦИЯ:`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Треугольников: ${model.metadata.triangleCount || 0}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);
       
        // Статистика подтверждений
        const confirmationStats = { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0 };
        const geometryStats = { original: 0, between: 0, barycentric: 0, computed: 0 };
       
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmationStats['4+']++;
            else confirmationStats[count] = (confirmationStats[count] || 0) + 1;
           
            if (node.addedFrom === 'structural_enhancement') {
                if (node.geometryMethod === 'original_from_photo') geometryStats.original++;
                else if (node.geometryMethod === 'between') geometryStats.between++;
                else if (node.geometryMethod === 'barycentric') geometryStats.barycentric++;
                else geometryStats.computed++;
            }
        }
       
        console.log(`\n🎯 ПОДТВЕРЖДЕНИЯ:`);
        console.log(`   🔴 4+: ${confirmationStats['4+']}`);
        console.log(`   🟠 3: ${confirmationStats[3]}`);
        console.log(`   🟡 2: ${confirmationStats[2]}`);
        console.log(`   🔵 1: ${confirmationStats[1]}`);
        console.log(`   ⚪ 0: ${confirmationStats[0]}`);
       
        console.log(`\n📐 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ:`);
        console.log(`   📍 Из фото: ${geometryStats.original}`);
        console.log(`   📐 Between: ${geometryStats.between}`);
        console.log(`   🔺 Barycentric: ${geometryStats.barycentric}`);
        console.log(`   🧮 Вычислено: ${geometryStats.computed}`);
       
        const fpInfo = this.fingerprinter.getFingerprintInfo(model.fingerprints);
        console.log(`\n🔍 СТРУКТУРНЫЕ ПОДПИСИ:`);
        console.log(`   Уникальных: ${fpInfo.uniqueSignatures}/${fpInfo.totalNodes} (${(fpInfo.uniquenessRatio * 100).toFixed(1)}%)`);
       
        console.log(`\n═`.repeat(80));
    }

    // 🔥 ЭКСПОРТ/ИМПОРТ
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
                triangles: model.graph.triangles,
                avgDegree: model.graph.avgDegree
            },
            fingerprints: Array.from(model.fingerprints.entries()),
            metadata: model.metadata,
            history: model.history,
            photoCoordinates: model.photoCoordinates ? Array.from(model.photoCoordinates.entries()) : [],
            geometryMemory: this.geometryMemory.export(),
            stats: this.getModelInfo(targetModelId).stats,
            _version: '3.0-geometric-memory',
            _exportedAt: new Date().toISOString()
        };
    }

    importModel(data) {
        if (!data || !data.id || !data.graph) {
            console.log('⚠️ Неверный формат данных');
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
                originalPoints: data.originalPoints || [],
                photoCoordinates: new Map(data.photoCoordinates || [])
            };
           
            // Восстанавливаем даты
            if (model.metadata.createdAt && typeof model.metadata.createdAt === 'string') {
                model.metadata.createdAt = new Date(model.metadata.createdAt);
            }
           
            // Восстанавливаем систему доверия
            for (const node of graph.nodes.values()) {
                if (node.confirmationCount === undefined) node.confirmationCount = 1;
                if (node.unconfirmedStreak === undefined) node.unconfirmedStreak = 0;
                if (node.addedAt && typeof node.addedAt === 'string') {
                    node.addedAt = new Date(node.addedAt);
                }
                if (node.firstSeen && typeof node.firstSeen === 'string') {
                    node.firstSeen = new Date(node.firstSeen);
                }
                if (node.lastConfirmed && typeof node.lastConfirmed === 'string') {
                    node.lastConfirmed = new Date(node.lastConfirmed);
                }
            }
           
            this.models.set(modelId, model);
           
            if (data.geometryMemory) {
                this.geometryMemory.import(data.geometryMemory);
            }
           
            if (!this.currentModelId) {
                this.currentModelId = modelId;
            }
           
            console.log(`📥 Импортирована модель "${model.metadata.name}" с геометрической памятью`);
            console.log(`   Узлов: ${graph.nodes.size}, Рёбер: ${graph.edges.size}`);
           
            return true;
        } catch (error) {
            console.log(`❌ Ошибка импорта: ${error.message}`);
            return false;
        }
    }

    getStats() {
        const modelsInfo = [];
        let totalNodes = 0;
        let totalEdges = 0;
       
        for (const [modelId, model] of this.models) {
            const info = this.getModelInfo(modelId);
            modelsInfo.push({
                id: modelId,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                createdAt: model.metadata.createdAt,
                uniquenessRatio: info.stats?.uniquenessRatio,
                confirmed3: info.stats?.confirmed3,
                confirmed2: info.stats?.confirmed2,
                confirmed1: info.stats?.confirmed1,
                originalGeometry: info.stats?.originalGeometry || 0,
                betweenGeometry: info.stats?.betweenGeometry || 0,
                barycentricGeometry: info.stats?.barycentricGeometry || 0
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
                minMatchesForEnhancement: this.minMatchesForEnhancement,
                philosophy: 'pure_topology_with_geometry_memory'
            }
        };
    }
}

module.exports = TopologicalAccumulator;
