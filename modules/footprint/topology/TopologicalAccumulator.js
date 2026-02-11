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
       
        // 📐 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ
        const GeometryMemory = require('./GeometryMemory');
        this.geometryMemory = new GeometryMemory({ debug: this.debug });
      
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
  
    // 🔥 ГЛАВНЫЙ МЕТОД: Обработка точек
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
                method: 'pure_topological_enhancement_with_geometry'
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
            // 📐 ХРАНИЛИЩЕ ОРИГИНАЛЬНЫХ КООРДИНАТ ИЗ ФОТО
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
                method: 'pure_topology_with_geometry'
            }]
        };
      
        // Инициализация системы доверия
        for (const node of model.graph.nodes.values()) {
            node.confirmationCount = 1;
            node.unconfirmedStreak = 0;
            node.addedFrom = 'original_creation';
            node.addedAt = new Date();
            node.firstSeen = new Date();
           
            // Сохраняем оригинальные координаты
            if (node._originalX && node._originalY) {
                node._hasOriginalCoordinates = true;
                this.stats.totalNodesWithOriginalCoordinates++;
            }
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
            avgDegree: graph.avgDegree,
            message: `Создана новая модель с геометрической памятью`
        };
    }
  
    // 🔥 ПРИМЕНЕНИЕ СИСТЕМЫ ДОВЕРИЯ
    applyTrustSystem(modelId, comparison, newGraph, newFingerprints) {
        const model = this.models.get(modelId);
        if (!model) return;
      
        console.log(`📊 СИСТЕМА ДОВЕРИЯ: +${comparison.exactMatches?.length || 0}, -${model.graph.nodes.size - (comparison.matchedNodes1 || 0)}`);
      
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
      
        // Удаляем забытые узлы
        this.removeForgottenNodes(modelId);
    }
  
    // 🔥 УДАЛЕНИЕ ЗАБЫТЫХ УЗЛОВ
    removeForgottenNodes(modelId) {
        const model = this.models.get(modelId);
        if (!model) return;
      
        const nodesToRemove = [];
      
        for (const [nodeId, node] of model.graph.nodes) {
            if (node.unconfirmedStreak >= this.trustConfig.FORGET_AFTER) {
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
          
            this.updateNodeDegrees(model.graph);
            this.stats.totalNodesForgotten += nodesToRemove.length;
            console.log(`✅ Удалено ${nodesToRemove.length} забытых узлов`);
        }
    }
  
    // 🔥 СТРУКТУРНОЕ УЛУЧШЕНИЕ МОДЕЛИ
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
       
        // 📐 СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ ИЗ НОВОГО ФОТО
        let savedCoordinates = 0;
        for (const [newNodeId, modelNodeId] of structuralMapping) {
            const node = newGraph.nodes.get(newNodeId);
            if (node && (node._originalX || node.x)) {
                if (!model.photoCoordinates) {
                    model.photoCoordinates = new Map();
                }
                model.photoCoordinates.set(newNodeId, {
                    x: node._originalX || node.x,
                    y: node._originalY || node.y,
                    confidence: node.confidence || 0.5
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
            console.log(`✅ Все структурные узлы уже в модели`);
            return { newNodesAdded: 0, reason: 'all_structural_nodes_exist' };
        }
      
        console.log(`🎯 Найдено ${structurallyNewNodes.length} СТРУКТУРНО НОВЫХ узлов`);
      
        // Добавляем новые узлы с геометрической памятью
        const addedNodes = this.addStructuralNodesToModel(
            modelId,
            structurallyNewNodes,
            newGraph,
            structuralMapping,
            options
        );
      
        // Запоминаем геометрию новых узлов
        if (addedNodes.length > 0) {
            this.rememberNewNodesGeometry(structurallyNewNodes, newGraph, modelId);
        }
      
        // Обновляем подписи
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }
      
        // Увеличиваем подтверждения
        this.increaseStructuralConfirmations(modelId, structuralMapping);
      
        // Обновляем историю
        model.history.push({
            action: 'enhanced_structural_with_geometry',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            similarity: comparison.similarity,
            source: options.source || 'unknown',
            method: 'pure_topological_enhancement_with_geometry_memory'
        });
      
        this.stats.totalEnhancements++;
        this.stats.lastUpdated = new Date();
      
        console.log(`✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
      
        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            geometryMemoryApplied: true
        };
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
                    fingerprint: fingerprint,
                    neighborCount: structuralNeighbors.length,
                    reason: `структурно связан с ${structuralNeighbors.length} узлами модели`
                });
            }
        }
      
        console.log(`🎯 Найдено ${newNodes.length} СТРУКТУРНО НОВЫХ узлов`);
        return newNodes;
    }
  
    // 🔥 ПОИСК СТРУКТУРНЫХ СОСЕДЕЙ
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
  
    // 🔥 ДОБАВЛЕНИЕ СТРУКТУРНЫХ УЗЛОВ В МОДЕЛЬ (ИСПРАВЛЕНО!)
  addStructuralNodesToModel(modelId, newNodes, newGraph, structuralMapping, options) {
    const model = this.models.get(modelId);
    const addedNodes = [];
   
    console.log(`🔨 Добавляю ${newNodes.length} узлов с геометрической памятью...`);
   
    for (const nodeInfo of newNodes) {
        const originalNodeId = nodeInfo.nodeId;
        const sourceNode = newGraph.nodes.get(originalNodeId);
       
        // 🔥🔥🔥 ВОТ ЭТОТ БЛОК - КОПИРУЙ ЕГО СЮДА!
        let visualizationPosition;
       
        if (model.photoCoordinates && model.photoCoordinates.has(originalNodeId)) {
            const photoCoord = model.photoCoordinates.get(originalNodeId);
            visualizationPosition = {
                x: photoCoord.x,
                y: photoCoord.y,
                method: 'original_from_photo'
            };
            console.log(`   📍 ИСПОЛЬЗУЮ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ ИЗ ФОТО: (${visualizationPosition.x}, ${visualizationPosition.y})`);
        } else {
            visualizationPosition = this.calculateVisualizationPosition(
                nodeInfo.structuralNeighbors,
                model.graph
            );
            console.log(`   📍 Вычислена визуализационная позиция: (${visualizationPosition.x}, ${visualizationPosition.y}) [${visualizationPosition.method}]`);
        }
          
            const modelNodeId = `structural_node_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
            nodeInfo.modelNodeId = modelNodeId;
          
            const newNode = {
                id: modelNodeId,
                originalId: originalNodeId,
                degree: 0,
              
                confirmationCount: 1,
                unconfirmedStreak: 0,
                addedFrom: 'structural_enhancement',
                addedAt: new Date(),
                firstSeen: new Date(),
              
                // 📐 КООРДИНАТЫ ДЛЯ ВИЗУАЛИЗАЦИИ
                x: visualizationPosition.x,
                y: visualizationPosition.y,
                confidence: sourceNode?.confidence || 0.5,
              
                // 📐 МЕТАДАННЫЕ ГЕОМЕТРИИ
                visualizationMethod: visualizationPosition.method,
                hasOriginalCoordinates: model.photoCoordinates?.has(originalNodeId) || false,
              
                // 📐 ССЫЛКА НА ГЕОМЕТРИЧЕСКУЮ ПАМЯТЬ
                geometryMemory: originalNodeId,
              
                structuralNeighbors: nodeInfo.structuralNeighbors,
                structuralNeighborCount: nodeInfo.neighborCount,
                enhancementReason: nodeInfo.reason,
              
                originalData: sourceNode ? {
                    x: sourceNode._originalX || sourceNode.x,
                    y: sourceNode._originalY || sourceNode.y,
                    confidence: sourceNode.confidence,
                    source: sourceNode.source
                } : null
            };
           
            // 📐 СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ В УЗЛЕ
            if (model.photoCoordinates && model.photoCoordinates.has(originalNodeId)) {
                const photoCoord = model.photoCoordinates.get(originalNodeId);
                newNode._originalX = photoCoord.x;
                newNode._originalY = photoCoord.y;
                newNode._hasOriginalCoordinates = true;
                this.stats.totalNodesWithOriginalCoordinates++;
            }
          
            console.log(`   + ${modelNodeId.substring(0, 20)}...`);
            console.log(`     🔗 связей: ${nodeInfo.neighborCount}`);
            console.log(`     📐 оригинальные координаты: ${newNode._hasOriginalCoordinates ? 'да' : 'нет'}`);
          
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
          
            console.log(`     🔗 добавлено связей: ${edgesAdded}`);
          
            addedNodes.push({
                id: modelNodeId,
                x: newNode.x,
                y: newNode.y,
                confidence: newNode.confidence,
                structuralNeighbors: newNode.structuralNeighborCount,
                edgesAdded: edgesAdded,
                visualizationMethod: visualizationPosition.method,
                hasOriginalCoordinates: newNode._hasOriginalCoordinates
            });
        }
      
        console.log(`✅ Добавлено ${addedNodes.length} узлов с геометрической памятью`);
        return addedNodes;
    }
  
    // 🔥 ЗАПОМИНАНИЕ ГЕОМЕТРИИ НОВЫХ УЗЛОВ
    rememberNewNodesGeometry(newNodes, newGraph, modelId) {
        console.log(`📐 Запоминаю геометрию ${newNodes.length} новых узлов...`);
      
        const model = this.models.get(modelId);
        if (!model) return;
      
        let remembered = 0;
        newNodes.forEach(nodeInfo => {
            const nodeId = nodeInfo.nodeId;
            const node = newGraph.nodes.get(nodeId);
           
            if (node && (node._originalX || node.x)) {
                // Создаем временный узел с оригинальными координатами
                const tempNode = {
                    id: node.id,
                    x: node._originalX || node.x,
                    y: node._originalY || node.y,
                    confidence: node.confidence || 0.5,
                    originalPoints: node._originalPoints || []
                };
               
                // Запоминаем геометрические отношения
                this.geometryMemory.rememberNodeGeometry(
                    nodeId,
                    tempNode,
                    nodeInfo.structuralNeighbors,
                    newGraph.nodes
                );
                remembered++;
            }
        });
      
        console.log(`   ✅ Запомнена геометрия ${remembered} узлов`);
    }
  
    // 🔥 ВЫЧИСЛЕНИЕ ВИЗУАЛИЗАЦИОННОЙ ПОЗИЦИИ
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
  
    // 🔥 ОБНОВЛЕНИЕ СТЕПЕНЕЙ
    updateNodeDegrees(graph) {
        for (const node of graph.nodes.values()) {
            node.degree = 0;
        }
      
        for (const edge of graph.edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (graph.nodes.has(nodeA)) graph.nodes.get(nodeA).degree++;
            if (graph.nodes.has(nodeB)) graph.nodes.get(nodeB).degree++;
        }
    }
  
    // 🔥 ИНФОРМАЦИЯ О МОДЕЛИ
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
            withOriginalCoordinates: 0,
            withRecoveredGeometry: 0,
            structuralNodes: 0
        };
      
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmationStats['4+']++;
            else confirmationStats[count] = (confirmationStats[count] || 0) + 1;
           
            if (node._hasOriginalCoordinates) geometryStats.withOriginalCoordinates++;
            if (node.addedFrom === 'structural_enhancement') geometryStats.structuralNodes++;
            if (node.reconstructionMethod) geometryStats.withRecoveredGeometry++;
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
                totalResurrected: this.stats.totalNodesResurrected
            },
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated,
            philosophy: 'pure_topology_coordinates_for_visualization_only',
            version: '2.2-geometry-memory'
        };
    }
  
    // 🔥 ЭКСПОРТ
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
            photoCoordinates: model.photoCoordinates ? Array.from(model.photoCoordinates.entries()) : [],
            metadata: model.metadata,
            history: model.history,
            stats: this.getModelInfo(targetModelId).stats,
            _version: '2.2-geometry-memory',
            _exportedAt: new Date().toISOString(),
            _philosophy: 'pure_topology_with_geometry_memory'
        };
    }
  
    // 🔥 ИМПОРТ
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
           
            // Восстанавливаем photoCoordinates
            const photoCoordinates = new Map();
            if (data.photoCoordinates) {
                data.photoCoordinates.forEach(([key, value]) => {
                    photoCoordinates.set(key, value);
                });
            }
          
            const model = {
                id: modelId,
                graph: graph,
                fingerprints: fingerprints,
                photoCoordinates: photoCoordinates,
                metadata: data.metadata || {},
                history: data.history || [],
                originalPoints: data.originalPoints || []
            };
          
            // Восстанавливаем даты
            if (model.metadata.createdAt && typeof model.metadata.createdAt === 'string') {
                model.metadata.createdAt = new Date(model.metadata.createdAt);
            }
          
            // Восстанавливаем систему доверия и геометрию
            for (const node of graph.nodes.values()) {
                if (node.confirmationCount === undefined) node.confirmationCount = 1;
                if (node.unconfirmedStreak === undefined) node.unconfirmedStreak = 0;
                if (node._hasOriginalCoordinates) {
                    this.stats.totalNodesWithOriginalCoordinates++;
                }
            }
          
            this.models.set(modelId, model);
            if (!this.currentModelId) this.currentModelId = modelId;
          
            console.log(`📥 Импортирована модель "${model.metadata.name}" с геометрической памятью`);
            console.log(`   Узлов: ${graph.nodes.size}, Рёбер: ${graph.edges.size}`);
            console.log(`   📐 Оригинальных координат: ${photoCoordinates.size}`);
          
            return true;
          
        } catch (error) {
            console.log(`❌ Ошибка импорта модели: ${error.message}`);
            return false;
        }
    }
  
    // 🔥 СТАТИСТИКА
    getStats() {
        const modelsInfo = [];
        let totalNodes = 0;
        let totalEdges = 0;
        let totalOriginalCoordinates = 0;
      
        for (const [modelId, model] of this.models) {
            const info = this.getModelInfo(modelId);
            modelsInfo.push({
                id: modelId,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                createdAt: model.metadata.createdAt,
                confirmationStats: info.stats?.confirmationStats,
                geometryStats: info.stats?.geometryStats
            });
          
            totalNodes += model.graph.nodes.size;
            totalEdges += model.graph.edges.size;
            totalOriginalCoordinates += model.photoCoordinates?.size || 0;
        }
      
        return {
            system: {
                ...this.stats,
                totalNodesWithOriginalCoordinates: totalOriginalCoordinates
            },
            models: {
                total: this.models.size,
                totalNodes: totalNodes,
                totalEdges: totalEdges,
                totalOriginalCoordinates: totalOriginalCoordinates,
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
