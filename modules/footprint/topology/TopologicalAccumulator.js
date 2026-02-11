// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ ЧИСТАЯ ТОПОЛОГИЯ + ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;
        this.minMatchesForEnhancement = options.minMatchesForEnhancement || 3;
        this.similarityThreshold = options.similarityThreshold || 0.6;
       
        // 🔥 СИСТЕМА ДОВЕРИЯ
        this.trustConfig = options.trustConfig || {
            FORGET_AFTER: 10,
            HIDE_AFTER: 5,
            DEGRADE_AFTER: 3,
            PROMOTE_AT: 2,
            CORE_AT: 4,
            RESURRECTION_THRESHOLD: 0.9
        };
       
        // Основные компоненты
        this.topologyBuilder = new (require('./TopologyBuilder'))({ debug: this.debug });
        this.fingerprinter = new (require('./TopologicalFingerprint'))({
            debug: this.debug,
            iterations: options.wlIterations || 3,
            bucketSize: 3,
            similarityThreshold: 0.7
        });
       
        // 🔥 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ
        this.geometryMemory = new (require('./GeometryMemory'))({
            debug: this.debug
        });
       
        // Хранилище моделей
        this.models = new Map();
        this.currentModelId = null;
       
        // Статистика
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalPointsProcessed: 0,
            totalNodesForgotten: 0,
            totalNodesResurrected: 0,
            totalNodesWithOriginalCoordinates: 0,
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
   
    // 🔥 ГЛАВНЫЙ МЕТОД
    async processPoints(points, options = {}) {
        console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК (ТОПОЛОГИЯ + ГЕОМЕТРИЯ)...`);
       
        const modelId = options.modelId || this.currentModelId;
        const pointSource = options.source || `source_${Date.now()}`;
       
        // 1. Строим граф Делоне
        const graph = this.topologyBuilder.buildDelaunayGraph(points, pointSource);
       
        // 2. Вычисляем WL-подписи
        const fingerprints = this.fingerprinter.computeGraphFingerprints(graph);
       
        // 3. Если нет активной модели - создаем новую
        if (!modelId || !this.models.has(modelId)) {
            console.log(`🆕 СОЗДАЮ НОВУЮ МОДЕЛЬ`);
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
       
        // 5. Применяем систему доверия
        this.applyTrustSystem(modelId, comparison, graph, fingerprints);
       
        // 6. Принимаем решение
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
                message: `Модель улучшена (+${enhancementResult.newNodesAdded} узлов)`,
                method: 'topology_with_geometry_memory'
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
   
    // 🔥 СОЗДАНИЕ НОВОЙ МОДЕЛИ
    createNewModel(graph, fingerprints, originalPoints, options = {}) {
        const modelId = `topo_model_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
       
        const model = {
            id: modelId,
            graph: graph,
            fingerprints: fingerprints,
            originalPoints: originalPoints,
           
            // 🔥 ХРАНИЛИЩЕ ОРИГИНАЛЬНЫХ КООРДИНАТ ИЗ ФОТО
            photoCoordinates: new Map(),
           
            metadata: {
                name: options.name || `Модель_${new Date().toLocaleTimeString('ru-RU')}`,
                createdAt: new Date(),
                pointsCount: originalPoints.length,
                nodesCount: graph.nodes.size,
                edgesCount: graph.edges.size,
                triangleCount: graph.triangles?.length || 0,
                avgDegree: graph.avgDegree,
                source: options.source || 'unknown',
                hasGeometryMemory: true,
                ...options
            },
            history: [{
                action: 'created',
                timestamp: new Date(),
                points: originalPoints.length,
                nodes: graph.nodes.size,
                edges: graph.edges.size,
                method: 'topology_with_geometry'
            }]
        };
       
        // 🔥 ИНИЦИАЛИЗАЦИЯ УЗЛОВ
        for (const node of model.graph.nodes.values()) {
            node.confirmationCount = 1;
            node.unconfirmedStreak = 0;
            node.addedFrom = 'original_creation';
            node.addedAt = new Date();
            node.firstSeen = new Date();
           
            // Сохраняем оригинальные координаты в photoCoordinates
            if (node._originalX && node._originalY) {
                model.photoCoordinates.set(node.id, {
                    x: node._originalX,
                    y: node._originalY,
                    confidence: node.confidence,
                    source: 'original_photo'
                });
            }
        }
       
        this.models.set(modelId, model);
        this.currentModelId = modelId;
        this.stats.totalModels++;
        this.stats.lastUpdated = new Date();
        this.stats.totalNodesWithOriginalCoordinates += model.photoCoordinates.size;
       
        console.log(`🏗️ СОЗДАНА НОВАЯ МОДЕЛЬ "${modelId}":`);
        console.log(`   Узлов: ${graph.nodes.size} (все с confirmationCount=1)`);
        console.log(`   📐 Геометрическая память инициализирована`);
       
        return {
            status: 'created',
            modelId: modelId,
            nodes: graph.nodes.size,
            edges: graph.edges.size,
            avgDegree: graph.avgDegree,
            message: `Создана модель с геометрической памятью`
        };
    }
   
    // 🔥 СТРУКТУРНОЕ УЛУЧШЕНИЕ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ
    async enhanceModelStructural(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`🔧 УЛУЧШЕНИЕ МОДЕЛИ "${modelId}" с геометрической памятью...`);
       
        const model = this.models.get(modelId);
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
       
        console.log(`📊 Структурных совпадений: ${allMatches.length}`);
       
        if (allMatches.length < this.minMatchesForEnhancement) {
            return { newNodesAdded: 0, reason: 'insufficient_structural_matches' };
        }
       
        // Создаем структурный маппинг
        const structuralMapping = this.createStructuralMapping(
            model.fingerprints,
            newFingerprints,
            allMatches
        );
       
        console.log(`🗺️ Создан структурный маппинг: ${structuralMapping.size} соответствий`);
       
        // 🔥 СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ ИЗ НОВОГО ФОТО
        let savedCoordinates = 0;
        for (const [newNodeId, modelNodeId] of structuralMapping) {
            const newNode = newGraph.nodes.get(newNodeId);
            if (newNode && newNode._originalX && newNode._originalY) {
                model.photoCoordinates = model.photoCoordinates || new Map();
                model.photoCoordinates.set(newNodeId, {
                    x: newNode._originalX,
                    y: newNode._originalY,
                    confidence: newNode.confidence,
                    source: 'enhancement_photo',
                    matchedTo: modelNodeId
                });
                savedCoordinates++;
            }
        }
        console.log(`   📐 Сохранено ${savedCoordinates} оригинальных координат из нового фото`);
       
        // Находим структурно новые узлы
        const structurallyNewNodes = this.findStructurallyNewNodes(
            model.graph,
            newGraph,
            newFingerprints,
            structuralMapping
        );
       
        if (structurallyNewNodes.length === 0) {
            return { newNodesAdded: 0, reason: 'all_structural_nodes_exist' };
        }
       
        console.log(`🎯 Найдено ${structurallyNewNodes.length} СТРУКТУРНО НОВЫХ узлов`);
       
        // 🔥 ДОБАВЛЯЕМ НОВЫЕ УЗЛЫ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ
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
       
        // Обновляем историю
        model.history.push({
            action: 'enhanced_with_geometry',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            savedCoordinates: savedCoordinates,
            similarity: comparison.similarity,
            source: options.source || 'unknown',
            method: 'topology_with_geometry_memory'
        });
       
        this.stats.totalEnhancements++;
        this.stats.lastUpdated = new Date();
        this.stats.totalNodesWithOriginalCoordinates += addedNodes.filter(n => n.hasOriginalCoordinates).length;
       
        console.log(`✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
       
        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            savedCoordinates: savedCoordinates
        };
    }
   
    // 🔥 ДОБАВЛЕНИЕ НОВЫХ УЗЛОВ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ
    addStructuralNodesWithGeometry(modelId, newNodes, newGraph, structuralMapping, options) {
        const model = this.models.get(modelId);
        const addedNodes = [];
       
        console.log(`🔨 Добавляю ${newNodes.length} узлов с геометрической памятью...`);
       
        for (const nodeInfo of newNodes) {
            const originalNodeId = nodeInfo.nodeId;
            const sourceNode = newGraph.nodes.get(originalNodeId);
           
            const modelNodeId = `structural_node_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
           
            // 🔥 ПРОВЕРЯЕМ, ЕСТЬ ЛИ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ ИЗ ФОТО
            let vizPosition;
            let hasOriginalCoordinates = false;
           
            if (model.photoCoordinates && model.photoCoordinates.has(originalNodeId)) {
                const photoCoord = model.photoCoordinates.get(originalNodeId);
                vizPosition = {
                    x: photoCoord.x,
                    y: photoCoord.y,
                    method: 'original_from_photo'
                };
                hasOriginalCoordinates = true;
                console.log(`   📍 Использую оригинальные координаты из фото: (${vizPosition.x}, ${vizPosition.y})`);
            } else {
                vizPosition = this.calculateVisualizationPosition(
                    nodeInfo.structuralNeighbors,
                    model.graph
                );
                console.log(`   📍 Вычислена визуализационная позиция: (${vizPosition.x.toFixed(1)}, ${vizPosition.y.toFixed(1)}) [${vizPosition.method}]`);
            }
           
            // 🔥 СОЗДАЕМ УЗЕЛ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ
            const newNode = {
                id: modelNodeId,
                originalId: originalNodeId,
                degree: 0,
               
                // Система доверия
                confirmationCount: 1,
                unconfirmedStreak: 0,
                addedFrom: 'structural_enhancement',
                addedAt: new Date(),
                firstSeen: new Date(),
               
                // 🔥 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ
                x: vizPosition.x,
                y: vizPosition.y,
                confidence: sourceNode?.confidence || 0.5,
                _hasOriginalCoordinates: hasOriginalCoordinates,
                _originalX: hasOriginalCoordinates ? vizPosition.x : null,
                _originalY: hasOriginalCoordinates ? vizPosition.y : null,
                _geometrySource: hasOriginalCoordinates ? 'photo' : 'computed',
               
                // Структурная информация
                structuralNeighbors: nodeInfo.structuralNeighbors,
                structuralNeighborCount: nodeInfo.neighborCount,
                enhancementReason: nodeInfo.reason,
                visualizationMethod: vizPosition.method,
               
                // Ссылка на геометрию
                geometryMemoryId: originalNodeId
            };
           
            // Добавляем узел в модель
            model.graph.nodes.set(modelNodeId, newNode);
           
            // Добавляем связи
            let edgesAdded = 0;
            for (const neighborModelId of nodeInfo.structuralNeighbors) {
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
            console.log(`     📐 оригинальные координаты: ${hasOriginalCoordinates ? 'да' : 'нет'}`);
           
            // 🔥 ЗАПОМИНАЕМ ГЕОМЕТРИЮ
            if (sourceNode) {
                const tempNode = {
                    id: originalNodeId,
                    x: hasOriginalCoordinates ? vizPosition.x : sourceNode.x,
                    y: hasOriginalCoordinates ? vizPosition.y : sourceNode.y,
                    confidence: sourceNode.confidence
                };
               
                this.geometryMemory.rememberNodeGeometry(
                    originalNodeId,
                    tempNode,
                    nodeInfo.structuralNeighbors,
                    newGraph.nodes
                );
            }
           
            addedNodes.push({
                id: modelNodeId,
                x: newNode.x,
                y: newNode.y,
                structuralNeighbors: newNode.structuralNeighborCount,
                edgesAdded: edgesAdded,
                hasOriginalCoordinates: hasOriginalCoordinates,
                visualizationMethod: vizPosition.method
            });
        }
       
        console.log(`✅ Добавлено ${addedNodes.length} узлов с геометрической памятью`);
        return addedNodes;
    }
   
    // 🔥 ПРИМЕНЕНИЕ СИСТЕМЫ ДОВЕРИЯ
    applyTrustSystem(modelId, comparison, newGraph, newFingerprints) {
        const model = this.models.get(modelId);
        if (!model) return;
       
        const matchedNodes = new Set();
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
       
        for (const match of allMatches) {
            if (match.node1 && model.graph.nodes.has(match.node1)) {
                matchedNodes.add(match.node1);
            }
        }
       
        let confirmedCount = 0;
        let unconfirmedCount = 0;
       
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
            }
        }
       
        console.log(`📊 СИСТЕМА ДОВЕРИЯ: +${confirmedCount}, -${unconfirmedCount}`);
    }
   
    // 🔥 УВЕЛИЧЕНИЕ ПОДТВЕРЖДЕНИЙ
    increaseStructuralConfirmations(modelId, structuralMapping) {
        const model = this.models.get(modelId);
        if (!model || structuralMapping.size === 0) return;
       
        let increasedCount = 0;
       
        for (const [newNodeId, modelNodeId] of structuralMapping) {
            if (model.graph.nodes.has(modelNodeId)) {
                const node = model.graph.nodes.get(modelNodeId);
                node.confirmationCount = (node.confirmationCount || 1) + 1;
                node.unconfirmedStreak = 0;
                increasedCount++;
            }
        }
       
        console.log(`📈 Увеличены подтверждения: ${increasedCount} узлов`);
    }
   
    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ (без изменений)
    createStructuralMapping(modelFingerprints, newFingerprints, matches) {
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
       
        return mapping;
    }
   
    findStructurallyNewNodes(modelGraph, newGraph, newFingerprints, structuralMapping) {
        const newNodes = [];
        const mappedNodeIds = new Set(structuralMapping.keys());
       
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
                    fingerprint: fingerprint,
                    neighborCount: structuralNeighbors.length,
                    reason: `связан с ${structuralNeighbors.length} узлами модели`
                });
            }
        }
       
        console.log(`   🎯 Найдено ${newNodes.length} СТРУКТУРНО НОВЫХ узлов`);
        return newNodes;
    }
   
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
   
    calculateVisualizationPosition(structuralNeighborIds, modelGraph) {
        if (structuralNeighborIds.length === 0) {
            return {
                x: 400 + (Math.random() - 0.5) * 200,
                y: 300 + (Math.random() - 0.5) * 200,
                method: 'random_no_neighbors'
            };
        }
       
        let sumX = 0, sumY = 0, count = 0;
       
        for (const neighborId of structuralNeighborIds) {
            const neighbor = modelGraph.nodes.get(neighborId);
            if (neighbor && neighbor.x !== undefined && neighbor.y !== undefined) {
                sumX += neighbor.x;
                sumY += neighbor.y;
                count++;
            }
        }
       
        if (count > 0) {
            const avgX = sumX / count;
            const avgY = sumY / count;
            const offsetX = (Math.random() - 0.5) * 30;
            const offsetY = (Math.random() - 0.5) * 30;
           
            return {
                x: avgX + offsetX,
                y: avgY + offsetY,
                method: `average_of_${count}_neighbors`
            };
        }
       
        return {
            x: 400 + (Math.random() - 0.5) * 200,
            y: 300 + (Math.random() - 0.5) * 200,
            method: 'visualization_fallback'
        };
    }
   
    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;
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
       
        const confirmationStats = { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0 };
        const geometryStats = {
            withOriginalCoords: 0,
            withComputedCoords: 0,
            structuralNodes: 0,
            originalNodes: 0
        };
       
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmationStats['4+']++;
            else confirmationStats[count] = (confirmationStats[count] || 0) + 1;
           
            if (node.addedFrom === 'structural_enhancement') {
                geometryStats.structuralNodes++;
                if (node._hasOriginalCoordinates) {
                    geometryStats.withOriginalCoords++;
                } else {
                    geometryStats.withComputedCoords++;
                }
            } else {
                geometryStats.originalNodes++;
                geometryStats.withOriginalCoords++;
            }
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
                confirmationStats: confirmationStats,
                geometryStats: geometryStats
            },
            metadata: model.metadata,
            history: {
                totalActions: model.history.length,
                lastAction: model.history[model.history.length - 1]
            },
            trustSystem: {
                config: this.trustConfig
            },
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated,
            philosophy: 'pure_topology_with_geometry_memory'
        };
    }
   
    visualizeModel(modelId = null, options = {}) {
        const targetModelId = modelId || this.currentModelId;
        if (!targetModelId || !this.models.has(targetModelId)) return;
       
        const model = this.models.get(targetModelId);
        const graph = model.graph;
       
        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ МОДЕЛИ "${model.metadata.name}":`);
        console.log(`═`.repeat(70));
        console.log(`📊 СТРУКТУРНАЯ ИНФОРМАЦИЯ:`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Треугольников: ${model.metadata.triangleCount || 0}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);
       
        const geometryStats = {
            original: 0,
            structural: 0,
            withOriginalCoords: 0,
            withComputedCoords: 0
        };
       
        for (const node of graph.nodes.values()) {
            if (node.addedFrom === 'structural_enhancement') {
                geometryStats.structural++;
                if (node._hasOriginalCoordinates) geometryStats.withOriginalCoords++;
                else geometryStats.withComputedCoords++;
            } else {
                geometryStats.original++;
                geometryStats.withOriginalCoords++;
            }
        }
       
        console.log(`\n📐 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ:`);
        console.log(`   📍 Оригинальных узлов: ${geometryStats.original}`);
        console.log(`   🆕 Структурных узлов: ${geometryStats.structural}`);
        console.log(`   ✅ С оригинальными координатами: ${geometryStats.withOriginalCoords}`);
        console.log(`   🔄 С вычисленными координатами: ${geometryStats.withComputedCoords}`);
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
                triangles: model.graph.triangles,
                avgDegree: model.graph.avgDegree
            },
            fingerprints: Array.from(model.fingerprints.entries()),
            photoCoordinates: Array.from(model.photoCoordinates?.entries() || []),
            metadata: model.metadata,
            history: model.history,
            _version: '2.2-geometry-memory',
            _exportedAt: new Date().toISOString(),
            _philosophy: 'pure_topology_with_geometry_memory'
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
            const photoCoordinates = new Map(data.photoCoordinates || []);
           
            const model = {
                id: modelId,
                graph: graph,
                fingerprints: fingerprints,
                photoCoordinates: photoCoordinates,
                metadata: data.metadata || {},
                history: data.history || [],
                originalPoints: data.originalPoints || []
            };
           
            this.models.set(modelId, model);
            if (!this.currentModelId) this.currentModelId = modelId;
           
            console.log(`📥 Импортирована модель "${model.metadata.name}" с геометрической памятью`);
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
        let totalWithOriginalCoords = 0;
       
        for (const [modelId, model] of this.models) {
            const info = this.getModelInfo(modelId);
            modelsInfo.push({
                id: modelId,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                createdAt: model.metadata.createdAt,
                geometryStats: info.stats?.geometryStats
            });
           
            totalNodes += model.graph.nodes.size;
            totalEdges += model.graph.edges.size;
            totalWithOriginalCoords += model.photoCoordinates?.size || 0;
        }
       
        return {
            system: {
                ...this.stats,
                totalNodesWithOriginalCoordinates: totalWithOriginalCoords
            },
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
                trustConfig: this.trustConfig,
                philosophy: 'pure_topology_with_geometry_memory'
            }
        };
    }
}

module.exports = TopologicalAccumulator;
