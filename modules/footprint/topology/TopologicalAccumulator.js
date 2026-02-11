// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ ЧИСТАЯ ТОПОЛОГИЯ + ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ

const GeometryMemory = require('./GeometryMemory');

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
        this.geometryMemory = new GeometryMemory({
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
            totalGeometryRecords: 0,
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
      
        const graph = this.topologyBuilder.buildDelaunayGraph(points, pointSource);
        const fingerprints = this.fingerprinter.computeGraphFingerprints(graph);
      
        if (!modelId || !this.models.has(modelId)) {
            console.log(`🆕 СОЗДАЮ НОВУЮ ТОПОЛОГИЧЕСКУЮ МОДЕЛЬ`);
            return this.createNewModel(graph, fingerprints, points, options);
        }
      
        console.log(`🔍 СРАВНИВАЮ С МОДЕЛЬЮ "${modelId}"`);
        const existingModel = this.models.get(modelId);
      
        const comparison = this.fingerprinter.compareGraphs(
            existingModel.graph,
            existingModel.fingerprints,
            graph,
            fingerprints
        );
      
        // Применяем систему доверия
        this.applyTrustSystem(modelId, comparison, graph, fingerprints);
      
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
                edges: graph.edges.size,
                method: 'topology_with_geometry'
            }]
        };
      
        // Инициализация системы доверия
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
        console.log(`   📐 Геометрическая память инициализирована`);
      
        return {
            status: 'created',
            modelId: modelId,
            nodes: graph.nodes.size,
            edges: graph.edges.size,
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
      
        // Создаём структурный маппинг
        const structuralMapping = this.createStructuralMapping(
            model.fingerprints,
            newFingerprints,
            allMatches
        );
      
        console.log(`🗺️ Создан структурный маппинг: ${structuralMapping.size} соответствий`);
      
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
      
        // 🔥 ЗАПОМИНАЕМ ГЕОМЕТРИЮ ДОБАВЛЕНИЯ
        const geometryInfo = this.captureGeometryBeforeAddition(
            structurallyNewNodes,
            newGraph,
            structuralMapping
        );
      
        // Добавляем структурно новые узлы
        const addedNodes = this.addStructuralNodesToModel(
            modelId,
            structurallyNewNodes,
            newGraph,
            structuralMapping,
            geometryInfo,
            options
        );
      
        // 🔥 ЗАПОМИНАЕМ ГЕОМЕТРИЮ ДЛЯ КАЖДОГО НОВОГО УЗЛА
        if (addedNodes.length > 0) {
            this.rememberNewNodesGeometry(
                structurallyNewNodes,
                addedNodes,
                newGraph,
                modelId
            );
            this.stats.totalGeometryRecords += addedNodes.length;
        }
      
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
            geometryRecords: addedNodes.length,
            similarity: comparison.similarity,
            method: 'topology_with_geometry_memory'
        });
      
        this.stats.totalEnhancements++;
        this.stats.lastUpdated = new Date();
      
        console.log(`✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов (с геометрией)`);
      
        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            geometryRecords: addedNodes.length
        };
    }
  
    // 🔥 ЗАХВАТ ГЕОМЕТРИИ ПЕРЕД ДОБАВЛЕНИЕМ
    captureGeometryBeforeAddition(newNodes, newGraph, structuralMapping) {
        const geometryInfo = new Map();
      
        newNodes.forEach(nodeInfo => {
            const nodeId = nodeInfo.nodeId;
            const node = newGraph.nodes.get(nodeId);
            if (!node) return;
          
            // Сохраняем оригинальные координаты ТОЛЬКО для геометрических вычислений
            const originalX = node.x;
            const originalY = node.y;
          
            // Находим соседей, которые уже есть в модели
            const mappedNeighbors = nodeInfo.structuralNeighbors.map(nId => ({
                modelId: nId,
                originalNode: newGraph.nodes.get(
                    Array.from(structuralMapping.entries())
                        .find(([k, v]) => v === nId)?.[0]
                )
            })).filter(n => n.originalNode);
          
            geometryInfo.set(nodeId, {
                originalX,
                originalY,
                mappedNeighbors,
                neighborCount: nodeInfo.structuralNeighbors.length,
                degree: nodeInfo.nodeData?.degree || 0
            });
        });
      
        return geometryInfo;
    }
  
    // 🔥 ЗАПОМИНАНИЕ ГЕОМЕТРИИ НОВЫХ УЗЛОВ
    rememberNewNodesGeometry(newNodes, addedNodes, newGraph, modelId) {
        console.log(`📐 Запоминаю геометрию ${newNodes.length} новых узлов...`);
      
        const model = this.models.get(modelId);
        if (!model) return;
      
        newNodes.forEach((nodeInfo, index) => {
            const originalNodeId = nodeInfo.nodeId;
            const originalNode = newGraph.nodes.get(originalNodeId);
            const addedNode = addedNodes[index];
          
            if (!originalNode || !addedNode) return;
          
            // Находим ID узла в модели
            let modelNodeId = null;
            for (const [nodeId, node] of model.graph.nodes) {
                if (node.originalId === originalNodeId) {
                    modelNodeId = nodeId;
                    break;
                }
            }
          
            if (modelNodeId) {
                // 🔥 ЗАПОМИНАЕМ ГЕОМЕТРИЮ В ИСХОДНОМ ГРАФЕ
                this.geometryMemory.rememberNodeGeometry(
                    originalNodeId,
                    originalNode,
                    nodeInfo.structuralNeighbors,
                    newGraph.nodes
                );
              
                // 🔥 СОХРАНЯЕМ ССЫЛКУ НА ГЕОМЕТРИЮ В УЗЛЕ МОДЕЛИ
                const modelNode = model.graph.nodes.get(modelNodeId);
                if (modelNode) {
                    modelNode.geometryMemory = originalNodeId;
                    modelNode.originalGeometry = {
                        x: originalNode.x,
                        y: originalNode.y,
                        confidence: originalNode.confidence,
                        neighbors: nodeInfo.structuralNeighbors
                    };
                  
                    if (this.debug) {
                        console.log(`   ✅ Геометрия сохранена для ${modelNodeId.substring(0, 20)}...`);
                    }
                }
            }
        });
      
        console.log(`   ✅ Запомнено ${newNodes.length} геометрических паттернов`);
    }
  
    // 🔥 ДОБАВЛЕНИЕ СТРУКТУРНЫХ УЗЛОВ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ
    addStructuralNodesToModel(modelId, newNodes, newGraph, structuralMapping, geometryInfo, options) {
        const model = this.models.get(modelId);
        const addedNodes = [];
      
        console.log(`🔨 Добавляю ${newNodes.length} узлов с геометрической памятью...`);
      
        for (const nodeInfo of newNodes) {
            const originalNodeId = nodeInfo.nodeId;
            const sourceNode = nodeInfo.nodeData;
            const geometry = geometryInfo.get(originalNodeId);
          
            const modelNodeId = `structural_node_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
          
            // 🔥 ВЫЧИСЛЯЕМ ПОЗИЦИЮ С УЧЁТОМ ГЕОМЕТРИЧЕСКОЙ ПАМЯТИ
            let visualizationPosition;
          
            if (geometry) {
                // Пробуем восстановить по геометрической памяти
                const reconstructed = this.geometryMemory.reconstructPosition(
                    originalNodeId,
                    model.graph
                );
              
                if (reconstructed) {
                    visualizationPosition = reconstructed;
                } else {
                    // Фолбэк - среднее соседей
                    visualizationPosition = this.calculateVisualizationPosition(
                        nodeInfo.structuralNeighbors,
                        model.graph
                    );
                }
            } else {
                visualizationPosition = this.calculateVisualizationPosition(
                    nodeInfo.structuralNeighbors,
                    model.graph
                );
            }
          
            // 🔥 СОЗДАЁМ УЗЕЛ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ
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
              
                // Визуализационные координаты
                x: visualizationPosition.x,
                y: visualizationPosition.y,
                confidence: sourceNode.confidence || 0.5,
              
                // Структурная информация
                structuralNeighbors: nodeInfo.structuralNeighbors,
                structuralNeighborCount: nodeInfo.neighborCount,
                enhancementReason: nodeInfo.reason,
                visualizationMethod: visualizationPosition.method,
              
                // 🔥 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ
                geometryMemory: originalNodeId,
                originalGeometry: geometry ? {
                    x: geometry.originalX,
                    y: geometry.originalY,
                    neighborCount: geometry.neighborCount,
                    degree: geometry.degree
                } : null,
              
                reconstructionMethod: visualizationPosition.method,
              
                // Оригинальные данные
                originalData: {
                    x: sourceNode.x,
                    y: sourceNode.y,
                    confidence: sourceNode.confidence,
                    source: sourceNode.source
                }
            };
          
            console.log(`   + ${modelNodeId}:`);
            console.log(`      визуализация: (${newNode.x.toFixed(1)}, ${newNode.y.toFixed(1)})`);
            console.log(`      метод: ${newNode.visualizationMethod}`);
            console.log(`      геометрия: ${geometry ? 'запомнена' : 'нет'}`);
          
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
          
            console.log(`      связей: ${edgesAdded}`);
          
            addedNodes.push({
                id: modelNodeId,
                x: newNode.x,
                y: newNode.y,
                modelNodeId: modelNodeId,
                originalNodeId: originalNodeId,
                geometryMemory: originalNodeId
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
              
                if (node.unconfirmedStreak >= this.trustConfig.FORGET_AFTER) {
                    node.markedForDeletion = true;
                    this.stats.totalNodesForgotten++;
                }
            }
        }
      
        if (this.stats.totalNodesForgotten > 0) {
            this.removeForgottenNodes(modelId);
        }
      
        console.log(`📊 СИСТЕМА ДОВЕРИЯ: +${confirmedCount}, -${unconfirmedCount}`);
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
                    const [a, b] = edge.split('--');
                    if (a === nodeId || b === nodeId) {
                        edgesToRemove.push(edge);
                    }
                }
              
                for (const edge of edgesToRemove) {
                    model.graph.edges.delete(edge);
                }
            }
          
            this.updateNodeDegrees(model.graph);
        }
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
  
    // 🔥 ПОИСК СТРУКТУРНО НОВЫХ УЗЛОВ
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
  
    // 🔥 ВЫЧИСЛЕНИЕ ВИЗУАЛИЗАЦИОННОЙ ПОЗИЦИИ (ФОЛБЭК)
    calculateVisualizationPosition(structuralNeighborIds, modelGraph) {
        if (structuralNeighborIds.length === 0) {
            return {
                x: 400 + (Math.random() - 0.5) * 200,
                y: 300 + (Math.random() - 0.5) * 200,
                method: 'random_fallback'
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
            return {
                x: sumX / count,
                y: sumY / count,
                method: `average_of_${count}_neighbors`
            };
        }
      
        return {
            x: 400 + (Math.random() - 0.5) * 200,
            y: 300 + (Math.random() - 0.5) * 200,
            method: 'fallback'
        };
    }
  
    // 🔥 УВЕЛИЧЕНИЕ ПОДТВЕРЖДЕНИЙ
    increaseStructuralConfirmations(modelId, structuralMapping) {
        const model = this.models.get(modelId);
      
        for (const [newNodeId, modelNodeId] of structuralMapping) {
            if (model.graph.nodes.has(modelNodeId)) {
                const node = model.graph.nodes.get(modelNodeId);
                node.confirmationCount = (node.confirmationCount || 1) + 1;
                node.unconfirmedStreak = 0;
                node.lastConfirmed = new Date();
            }
        }
    }
  
    // 🔥 ОБНОВЛЕНИЕ ПОДПИСЕЙ
    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;
        return newFingerprints;
    }
  
    // 🔥 ОБНОВЛЕНИЕ СТЕПЕНЕЙ
    updateNodeDegrees(graph) {
        for (const node of graph.nodes.values()) {
            node.degree = 0;
        }
      
        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (graph.nodes.has(a)) graph.nodes.get(a).degree++;
            if (graph.nodes.has(b)) graph.nodes.get(b).degree++;
        }
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
      
        // Статистика доверия
        const confirmationStats = { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0 };
        const geometryStats = { withMemory: 0, withoutMemory: 0 };
      
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmationStats['4+']++;
            else confirmationStats[count] = (confirmationStats[count] || 0) + 1;
          
            if (node.geometryMemory) geometryStats.withMemory++;
            else geometryStats.withoutMemory++;
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
                lastAction: model.history[model.history.length - 1],
                enhancements: model.history.filter(h => h.action.includes('enhanced')).length
            },
            trustSystem: {
                config: this.trustConfig,
                totalForgotten: this.stats.totalNodesForgotten,
                totalResurrected: this.stats.totalNodesResurrected,
                totalGeometryRecords: this.stats.totalGeometryRecords
            },
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated,
            philosophy: 'pure_topology_with_geometry_memory'
        };
    }
  
    // 🔥 ВИЗУАЛИЗАЦИЯ МОДЕЛИ (ДИАГНОСТИКА)
    visualizeModel(modelId = null, options = {}) {
        const targetModelId = modelId || this.currentModelId;
        if (!targetModelId || !this.models.has(targetModelId)) {
            console.log('⚠️ Модель не найдена');
            return;
        }
      
        const model = this.models.get(targetModelId);
        const graph = model.graph;
      
        console.log(`\n🔷 ТОПОЛОГИЧЕСКАЯ МОДЕЛЬ "${model.metadata.name}":`);
        console.log(`═`.repeat(70));
      
        console.log(`📊 СТРУКТУРА:`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Треугольников: ${model.metadata.triangleCount || 0}`);
      
        const stats = this.getModelInfo(targetModelId).stats;
      
        console.log(`\n🎯 ДОВЕРИЕ:`);
        console.log(`   🔴 4+: ${stats.confirmationStats['4+']}`);
        console.log(`   🟠 3: ${stats.confirmationStats[3]}`);
        console.log(`   🟡 2: ${stats.confirmationStats[2]}`);
        console.log(`   🔵 1: ${stats.confirmationStats[1]}`);
        console.log(`   ⚪ 0: ${stats.confirmationStats[0]}`);
      
        console.log(`\n📐 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ:`);
        console.log(`   ✅ С памятью: ${stats.geometryStats.withMemory}`);
        console.log(`   ⚠️ Без памяти: ${stats.geometryStats.withoutMemory}`);
        console.log(`   📝 Всего записей: ${this.stats.totalGeometryRecords}`);
      
        console.log(`\n🎯 ФИЛОСОФИЯ: Топология + Геометрическая память`);
        console.log(`═`.repeat(70));
    }
  
    // 🔥 ЭКСПОРТ МОДЕЛИ
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
            stats: this.getModelInfo(targetModelId).stats,
            geometryMemory: this.geometryMemory.export(),
            _version: '3.0-geometry-memory',
            _exportedAt: new Date().toISOString(),
            _philosophy: 'pure_topology_with_geometry_memory'
        };
    }
  
    // 🔥 ИМПОРТ МОДЕЛИ
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
                originalPoints: data.originalPoints || []
            };
          
            // Восстанавливаем систему доверия и геометрию
            for (const node of graph.nodes.values()) {
                if (node.confirmationCount === undefined) node.confirmationCount = 1;
                if (node.unconfirmedStreak === undefined) node.unconfirmedStreak = 0;
            }
          
            // Восстанавливаем геометрическую память
            if (data.geometryMemory) {
                this.geometryMemory.import(data.geometryMemory);
            }
          
            this.models.set(modelId, model);
            if (!this.currentModelId) this.currentModelId = modelId;
          
            console.log(`📥 Импортирована модель "${model.metadata.name}" с геометрической памятью`);
            return true;
          
        } catch (error) {
            console.log(`❌ Ошибка импорта: ${error.message}`);
            return false;
        }
    }
  
    // 🔥 СТАТИСТИКА
    getStats() {
        const modelsInfo = [];
        let totalNodes = 0, totalEdges = 0;
      
        for (const [modelId, model] of this.models) {
            const info = this.getModelInfo(modelId);
            modelsInfo.push({
                id: modelId,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                geometryRecords: info.stats?.geometryStats?.withMemory || 0
            });
            totalNodes += model.graph.nodes.size;
            totalEdges += model.graph.edges.size;
        }
      
        return {
            system: this.stats,
            models: {
                total: this.models.size,
                totalNodes,
                totalEdges,
                list: modelsInfo
            },
            geometryMemory: {
                totalRecords: this.geometryMemory.relations.size,
                activeReferences: this.stats.totalGeometryRecords
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
