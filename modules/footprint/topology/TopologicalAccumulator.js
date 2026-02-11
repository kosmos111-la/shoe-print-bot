// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ ТОПОЛОГИЧЕСКИЙ АККУМУЛЯТОР С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ

const GeometryMemory = require('./GeometryMemory');

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;
        this.minMatchesForEnhancement = options.minMatchesForEnhancement || 3;
        this.similarityThreshold = options.similarityThreshold || 0.6;
        this.trustConfig = options.trustConfig || {
            FORGET_AFTER: 10,
            HIDE_AFTER: 5,
            DEGRADE_AFTER: 3,
            PROMOTE_AT: 2,
            CORE_AT: 4
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
            totalGeometricMemories: 0,
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
      
        // Строим граф Делоне
        const graph = this.topologyBuilder.buildDelaunayGraph(points, pointSource);
      
        // Вычисляем WL-подписи
        const fingerprints = this.fingerprinter.computeGraphFingerprints(graph);
      
        // Если нет активной модели - создаём новую
        if (!modelId || !this.models.has(modelId)) {
            console.log(`🆕 СОЗДАЮ НОВУЮ МОДЕЛЬ`);
            return this.createNewModel(graph, fingerprints, points, options);
        }
      
        // Сравниваем с существующей моделью
        console.log(`🔍 СРАВНИВАЮ С МОДЕЛЬЮ "${modelId}"`);
        const existingModel = this.models.get(modelId);
      
        const comparison = this.fingerprinter.compareGraphs(
            existingModel.graph,
            existingModel.fingerprints,
            graph,
            fingerprints
        );
      
        // Применяем систему доверия
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
                message: `Модель улучшена (+${enhancementResult.newNodesAdded} узлов)`,
                method: 'topology_with_geometric_memory'
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
                method: 'topology_with_geometric_memory'
            }]
        };
      
        // 🔥 ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ ДОВЕРИЯ И ГЕОМЕТРИИ
        for (const node of model.graph.nodes.values()) {
            node.confirmationCount = 1;
            node.unconfirmedStreak = 0;
            node.addedFrom = 'original_creation';
            node.addedAt = new Date();
            node.firstSeen = new Date();
          
            // 🔥 СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ!
            if (node._originalX === undefined && node.x !== undefined) {
                node._originalX = node.x;
                node._originalY = node.y;
            }
        }
      
        this.models.set(modelId, model);
        this.currentModelId = modelId;
        this.stats.totalModels++;
        this.stats.lastUpdated = new Date();
      
        console.log(`🏗️ СОЗДАНА НОВАЯ МОДЕЛЬ "${modelId}":`);
        console.log(`   Узлов: ${graph.nodes.size} (все с confirmationCount=1)`);
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
  
    // 🔥 СТРУКТУРНОЕ УЛУЧШЕНИЕ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ
    async enhanceModelStructural(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`🔧 УЛУЧШЕНИЕ МОДЕЛИ "${modelId}" с геометрической памятью...`);
      
        const model = this.models.get(modelId);
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
      
        if (allMatches.length < this.minMatchesForEnhancement) {
            return { newNodesAdded: 0, reason: 'insufficient_structural_matches' };
        }
      
        const structuralMapping = this.createStructuralMapping(
            model.fingerprints,
            newFingerprints,
            allMatches
        );
      
        const structurallyNewNodes = this.findStructurallyNewNodes(
            model.graph,
            newGraph,
            newFingerprints,
            structuralMapping
        );
      
        if (structurallyNewNodes.length === 0) {
            return { newNodesAdded: 0, reason: 'all_structural_nodes_exist' };
        }
      
        // 🔥 ДОБАВЛЯЕМ НОВЫЕ УЗЛЫ
        const addedNodes = this.addStructuralNodesToModel(
            modelId,
            structurallyNewNodes,
            newGraph,
            structuralMapping,
            options
        );
      
        // 🔥 ЗАПОМИНАЕМ ГЕОМЕТРИЮ НОВЫХ УЗЛОВ!
        if (addedNodes.length > 0) {
            this.rememberNewNodesGeometry(structurallyNewNodes, newGraph, modelId, addedNodes);
        }
      
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }
      
        this.increaseStructuralConfirmations(modelId, structuralMapping);
      
        model.history.push({
            action: 'enhanced_with_geometry',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            similarity: comparison.similarity,
            source: options.source || 'unknown',
            method: 'topology_with_geometric_memory'
        });
      
        this.stats.totalEnhancements++;
        this.stats.lastUpdated = new Date();
      
        console.log(`✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
      
        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size
        };
    }
  
    // 🔥 ЗАПОМИНАНИЕ ГЕОМЕТРИИ НОВЫХ УЗЛОВ
    rememberNewNodesGeometry(newNodes, newGraph, modelId, addedNodes) {
        console.log(`📐 Запоминаю геометрию ${newNodes.length} новых узлов...`);
      
        const model = this.models.get(modelId);
        if (!model) return;
      
        newNodes.forEach((nodeInfo, index) => {
            const nodeId = nodeInfo.nodeId;
            const node = newGraph.nodes.get(nodeId);
            if (!node) return;
          
            const addedNode = addedNodes[index];
            if (!addedNode) return;
          
            // 🔥 СОЗДАЁМ УЗЕЛ С ОРИГИНАЛЬНЫМИ КООРДИНАТАМИ ИЗ ФОТО!
            const tempNode = {
                id: node.id,
                x: node._originalX || node.x,
                y: node._originalY || node.y,
                confidence: node.confidence || node._originalConfidence || 0.5,
                originalPoints: node._originalPoints || []
            };
          
            // Запоминаем геометрию
            const relations = this.geometryMemory.rememberNodeGeometry(
                nodeId,
                tempNode,
                nodeInfo.structuralNeighbors,
                newGraph.nodes
            );
          
            // Сохраняем ссылку в модели
            const modelNodeId = addedNode.id;
            if (modelNodeId && model.graph.nodes.has(modelNodeId)) {
                const modelNode = model.graph.nodes.get(modelNodeId);
                modelNode.geometryMemory = nodeId;
              
                // 🔥 СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ!
                modelNode._originalX = tempNode.x;
                modelNode._originalY = tempNode.y;
                modelNode._hasOriginalCoordinates = true;
                modelNode._geometryRelations = relations?.length || 0;
              
                this.stats.totalGeometricMemories++;
            }
        });
      
        console.log(`   ✅ Запомнена геометрия ${newNodes.length} узлов`);
    }
  
    // 🔥 ДОБАВЛЕНИЕ СТРУКТУРНЫХ УЗЛОВ
    addStructuralNodesToModel(modelId, newNodes, newGraph, structuralMapping, options) {
        const model = this.models.get(modelId);
        const addedNodes = [];
      
        console.log(`🔨 Добавляю ${newNodes.length} узлов с геометрической памятью...`);
      
        for (const nodeInfo of newNodes) {
            const originalNodeId = nodeInfo.nodeId;
            const sourceNode = newGraph.nodes.get(originalNodeId);
            if (!sourceNode) continue;
          
            const modelNodeId = `structural_node_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
          
            // Визуализационная позиция (фолбэк)
            const visualizationPosition = this.calculateVisualizationPosition(
                nodeInfo.structuralNeighbors,
                model.graph
            );
          
            // 🔥 БЕРЁМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ ЕСЛИ ЕСТЬ!
            const hasOriginalCoords = sourceNode._originalX !== undefined && sourceNode._originalY !== undefined;
            const posX = hasOriginalCoords ? sourceNode._originalX : visualizationPosition.x;
            const posY = hasOriginalCoords ? sourceNode._originalY : visualizationPosition.y;
            const posMethod = hasOriginalCoords ? 'original_from_photo' : visualizationPosition.method;
          
            const newNode = {
                id: modelNodeId,
                originalId: originalNodeId,
                degree: 0,
              
                confirmationCount: 1,
                unconfirmedStreak: 0,
                addedFrom: 'structural_enhancement',
                addedAt: new Date(),
                firstSeen: new Date(),
              
                // 🔥 ВИЗУАЛИЗАЦИОННЫЕ КООРДИНАТЫ
                x: posX,
                y: posY,
                confidence: sourceNode.confidence || sourceNode._originalConfidence || 0.5,
              
                // 🔥 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ - СОХРАНЯЕМ ОРИГИНАЛ!
                _originalX: sourceNode._originalX || sourceNode.x,
                _originalY: sourceNode._originalY || sourceNode.y,
                _originalConfidence: sourceNode._originalConfidence || sourceNode.confidence,
                _originalPoints: sourceNode._originalPoints || [],
                _hasOriginalCoordinates: hasOriginalCoords,
              
                structuralNeighbors: nodeInfo.structuralNeighbors,
                structuralNeighborCount: nodeInfo.neighborCount,
                enhancementReason: nodeInfo.reason,
                visualizationMethod: posMethod
            };
          
            model.graph.nodes.set(modelNodeId, newNode);
            nodeInfo.modelNodeId = modelNodeId;
          
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
            console.log(`      📍 позиция: (${posX.toFixed(1)}, ${posY.toFixed(1)}) [${posMethod}]`);
            console.log(`      🔗 связей: ${edgesAdded}`);
            console.log(`      📐 оригинальные координаты: ${hasOriginalCoords ? 'да' : 'нет'}`);
          
            addedNodes.push({
                id: modelNodeId,
                x: posX,
                y: posY,
                confidence: newNode.confidence,
                structuralNeighbors: newNode.structuralNeighborCount,
                edgesAdded: edgesAdded,
                visualizationMethod: posMethod,
                hasOriginalCoordinates: hasOriginalCoords
            });
        }
      
        console.log(`✅ Добавлено ${addedNodes.length} узлов с геометрической памятью`);
        return addedNodes;
    }
  
    // 🔥 ПРИМЕНЕНИЕ СИСТЕМЫ ДОВЕРИЯ
    applyTrustSystem(modelId, comparison) {
        const model = this.models.get(modelId);
        if (!model) return;
      
        const matchedNodes = new Set();
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
      
        for (const match of allMatches) {
            if (match.node1 && model.graph.nodes.has(match.node1)) {
                matchedNodes.add(match.node1);
            }
        }
      
        let confirmed = 0, unconfirmed = 0;
      
        for (const [nodeId, node] of model.graph.nodes) {
            if (node.confirmationCount === undefined) node.confirmationCount = 1;
            if (node.unconfirmedStreak === undefined) node.unconfirmedStreak = 0;
          
            if (matchedNodes.has(nodeId)) {
                node.confirmationCount++;
                node.unconfirmedStreak = 0;
                node.lastConfirmed = new Date();
                confirmed++;
            } else {
                node.unconfirmedStreak++;
                unconfirmed++;
            }
        }
      
        console.log(`📊 СИСТЕМА ДОВЕРИЯ: +${confirmed}, -${unconfirmed}`);
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
                increasedCount++;
            }
        }
      
        console.log(`📈 Увеличены подтверждения: ${increasedCount} узлов`);
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
      
        console.log(`🗺️ Создан структурный маппинг: ${mapping.size} соответствий`);
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
  
    // 🔥 ОБНОВЛЕНИЕ ПОДПИСЕЙ
    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
        console.log(`🔄 Обновляю структурные подписи...`);
      
        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;
      
        console.log(`✅ Подписи обновлены: ${newFingerprints.size} узлов`);
        return newFingerprints;
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
        const geometricStats = { original: 0, reconstructed: 0, pending: 0 };
      
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmationStats['4+']++;
            else confirmationStats[count] = (confirmationStats[count] || 0) + 1;
          
            if (node._originalX && node._originalY) geometricStats.original++;
            if (node.reconstructionMethod) geometricStats.reconstructed++;
            if (node.geometryMemory && !node._originalX) geometricStats.pending++;
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
                geometricMemory: geometricStats
            },
            metadata: model.metadata,
            history: {
                totalActions: model.history.length,
                lastAction: model.history[model.history.length - 1],
                enhancements: model.history.filter(h => h.action.includes('enhanced')).length
            },
            geometricMemory: {
                total: this.stats.totalGeometricMemories,
                original: geometricStats.original,
                reconstructed: geometricStats.reconstructed,
                pending: geometricStats.pending
            },
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated,
            philosophy: 'topology_with_geometric_memory',
            version: '2.2-geometric-memory'
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
            metadata: model.metadata,
            history: model.history,
            geometryMemory: this.geometryMemory.export(),
            stats: this.getModelInfo(targetModelId).stats,
            _version: '2.2-geometric-memory',
            _exportedAt: new Date().toISOString(),
            _philosophy: 'topology_with_geometric_memory'
        };
    }
  
    // 🔥 ИМПОРТ
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
          
            // Восстанавливаем геометрическую память
            if (data.geometryMemory) {
                this.geometryMemory.import(data.geometryMemory);
            }
          
            // Восстанавливаем атрибуты узлов
            for (const node of graph.nodes.values()) {
                if (node.confirmationCount === undefined) node.confirmationCount = 1;
                if (node.unconfirmedStreak === undefined) node.unconfirmedStreak = 0;
                if (node.addedAt && typeof node.addedAt === 'string') {
                    node.addedAt = new Date(node.addedAt);
                }
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
                createdAt: model.metadata.createdAt,
                geometricMemory: info.stats?.geometricMemory
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
                geometricMemories: this.stats.totalGeometricMemories,
                philosophy: 'topology_with_geometric_memory'
            }
        };
    }
}

module.exports = TopologicalAccumulator;
