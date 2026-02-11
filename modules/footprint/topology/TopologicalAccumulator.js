// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ ЧИСТАЯ ТОПОЛОГИЯ - ТОЛЬКО СТРУКТУРА, КООРДИНАТЫ ДЛЯ ВИЗУАЛИЗАЦИИ

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
        console.log(`   🎯 ФИЛОСОФИЯ: Чистая топология, координаты только для визуализации`);
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: Обработка точек (чистая топология)
    async processPoints(points, options = {}) {
        console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК (ЧИСТАЯ ТОПОЛОГИЯ)...`);
       
        const modelId = options.modelId || this.currentModelId;
        const pointSource = options.source || `source_${Date.now()}`;
       
        // 🔥 1. Строим граф Делоне (только структура!)
        const graph = this.topologyBuilder.buildDelaunayGraph(points, pointSource);
       
        if (this.debug) {
            this.topologyBuilder.visualizeGraph(graph, 5);
        }
       
        // 🔥 2. Вычисляем WL-подписи (структурные идентификаторы)
        const fingerprints = this.fingerprinter.computeGraphFingerprints(graph);
       
        // 🔥 3. Если нет активной модели - создаем новую
        if (!modelId || !this.models.has(modelId)) {
            console.log(`🆕 СОЗДАЮ НОВУЮ ТОПОЛОГИЧЕСКУЮ МОДЕЛЬ`);
            return this.createNewModel(graph, fingerprints, points, options);
        }
       
        // 🔥 4. Сравниваем с существующей моделью (чистая топология)
        console.log(`🔍 СРАВНИВАЮ С МОДЕЛЬЮ "${modelId}" (ТОЛЬКО СТРУКТУРА)`);
        const existingModel = this.models.get(modelId);
       
        const comparison = this.fingerprinter.compareGraphs(
            existingModel.graph,
            existingModel.fingerprints,
            graph,
            fingerprints
        );
       
        // 🔥 5. Принимаем решение на основе СТРУКТУРНОГО сходства
        if (comparison.similarity >= this.similarityThreshold) {
            console.log(`✅ СТРУКТУРНОЕ СОВПАДЕНИЕ: ${(comparison.similarity * 100).toFixed(1)}% ≥ ${this.similarityThreshold * 100}%`);
           
            // 🔥 6. Улучшаем модель (структурное улучшение)
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
                method: 'pure_topological_enhancement'
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
   
    // 🔥 СОЗДАНИЕ НОВОЙ МОДЕЛИ (с сохранением координат только для визуализации)
    createNewModel(graph, fingerprints, originalPoints, options = {}) {
        const modelId = `topo_model_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
       
        // 🔥 СОХРАНЯЕМ КООРДИНАТЫ ТОЛЬКО ДЛЯ ВИЗУАЛИЗАЦИИ
        // но в логике они не участвуют!
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
                method: 'pure_topology'
            }]
        };
       
        // 🔥 ИНИЦИАЛИЗИРУЕМ confirmationCount = 1 для всех узлов
        // (первое фото - первое подтверждение)
        for (const node of model.graph.nodes.values()) {
            node.confirmationCount = 1; // 🔥 ПЕРВОЕ ПОДТВЕРЖДЕНИЕ
            node.addedFrom = 'original_creation';
            node.addedAt = new Date();
        }
       
        this.models.set(modelId, model);
        this.currentModelId = modelId;
        this.stats.totalModels++;
        this.stats.lastUpdated = new Date();
       
        console.log(`🏗️ СОЗДАНА НОВАЯ ТОПОЛОГИЧЕСКАЯ МОДЕЛЬ "${modelId}":`);
        console.log(`   Узлов: ${graph.nodes.size} (все с confirmationCount=1)`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Треугольников: ${graph.triangles?.length || 0}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);
       
        const fpInfo = this.fingerprinter.getFingerprintInfo(fingerprints);
        console.log(`   Уникальных структурных подписей: ${fpInfo.uniqueSignatures}/${fpInfo.totalNodes}`);
       
        return {
            status: 'created',
            modelId: modelId,
            nodes: graph.nodes.size,
            edges: graph.edges.size,
            avgDegree: graph.avgDegree,
            message: `Создана новая чисто топологическая модель`
        };
    }
   
    // 🔥 СТРУКТУРНОЕ УЛУЧШЕНИЕ МОДЕЛИ (без привязки к координатам)
    async enhanceModelStructural(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`🔧 СТРУКТУРНОЕ УЛУЧШЕНИЕ МОДЕЛИ "${modelId}"...`);
       
        const model = this.models.get(modelId);
       
        // 🔥 ИСПОЛЬЗУЕМ ВСЕ СОВПАДЕНИЯ (структурные)
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
       
        console.log(`📊 Структурных совпадений: ${allMatches.length}`);
       
        if (allMatches.length < this.minMatchesForEnhancement) {
            console.log(`⚠️ Мало структурных совпадений для улучшения`);
            return { newNodesAdded: 0, reason: 'insufficient_structural_matches' };
        }
       
        // 🔥 СОЗДАЕМ СТРУКТУРНЫЙ МАППИНГ (на основе подписей)
        const structuralMapping = this.createStructuralMapping(
            model.fingerprints,
            newFingerprints,
            allMatches
        );
       
        console.log(`🗺️ Создан структурный маппинг: ${structuralMapping.size} соответствий`);
       
        // 🔥 НАХОДИМ СТРУКТУРНО НОВЫЕ УЗЛЫ
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
       
        // 🔥 ДОБАВЛЯЕМ СТРУКТУРНО НОВЫЕ УЗЛЫ
        const addedNodes = this.addStructuralNodesToModel(
            modelId,
            structurallyNewNodes,
            newGraph,
            structuralMapping,
            options
        );
       
        // 🔥 ОБНОВЛЯЕМ СТРУКТУРНЫЕ ПОДПИСИ
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }
       
        // 🔥 УВЕЛИЧИВАЕМ ПОДТВЕРЖДЕНИЯ ДЛЯ СТРУКТУРНО СОВПАВШИХ УЗЛОВ
        this.increaseStructuralConfirmations(modelId, structuralMapping);
       
        // 🔥 ОБНОВЛЯЕМ ИСТОРИЮ
        model.history.push({
            action: 'enhanced_structural',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            similarity: comparison.similarity,
            source: options.source || 'unknown',
            method: 'pure_topological_enhancement'
        });
       
        this.stats.totalEnhancements++;
        this.stats.lastUpdated = new Date();
       
        console.log(`✅ МОДЕЛЬ СТРУКТУРНО УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
       
        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size
        };
    }
   
    // 🔥 СОЗДАНИЕ СТРУКТУРНОГО МАППИНГА (на основе подписей)
    createStructuralMapping(modelFingerprints, newFingerprints, matches) {
        console.log(`🗺️ Создание структурного маппинга...`);
       
        const mapping = new Map();
        const usedModelNodes = new Set();
       
        // 🔥 ПРИНЦИП: подпись -> соответствие
        // Не смотрим на координаты, только на структуру!
       
        for (const match of matches) {
            const modelNodeId = match.node1; // Узел в модели
            const newNodeId = match.node2;   // Узел в новом графе
           
            // Получаем структурные подписи
            const modelFp = modelFingerprints.get(modelNodeId);
            const newFp = newFingerprints.get(newNodeId);
           
            if (modelFp && newFp) {
                // 🔥 СТРУКТУРНОЕ СООТВЕТСТВИЕ: похожие или одинаковые подписи
                const isExactMatch = modelFp.signature === newFp.signature;
                const isSimilarMatch = match.confidence > 0.8; // Высокая уверенность
               
                if (isExactMatch || isSimilarMatch) {
                    if (!usedModelNodes.has(modelNodeId)) {
                        mapping.set(newNodeId, modelNodeId);
                        usedModelNodes.add(modelNodeId);
                       
                        if (this.debug) {
                            console.log(`   📍 Структурное соответствие:`);
                            console.log(`      новый: ${newNodeId.substring(0, 20)}...`);
                            console.log(`      модель: ${modelNodeId.substring(0, 20)}...`);
                            console.log(`      подпись: ${modelFp.signature.substring(0, 20)}...`);
                            console.log(`      уверенность: ${(match.confidence * 100).toFixed(1)}%`);
                        }
                    }
                }
            }
        }
       
        console.log(`✅ Создан структурный маппинг: ${mapping.size} соответствий`);
        return mapping;
    }
   
    // 🔥 ПОИСК СТРУКТУРНО НОВЫХ УЗЛОВ (тех, кого нет в маппинге)
    findStructurallyNewNodes(modelGraph, newGraph, newFingerprints, structuralMapping) {
        console.log(`🔍 Поиск структурно новых узлов...`);
       
        const newNodes = [];
        const mappedNodeIds = new Set(structuralMapping.keys());
       
        console.log(`   Узлов в новом графе: ${newGraph.nodes.size}`);
        console.log(`   Уже сопоставлено: ${mappedNodeIds.size}`);
        console.log(`   Ожидаем новых: ${newGraph.nodes.size - mappedNodeIds.size}`);
       
        // 🔥 ПРОСТОЙ ПРИНЦИП: Все узлы нового графа, которых нет в маппинге
        for (const [nodeId, node] of newGraph.nodes) {
            // Если узел уже имеет структурное соответствие - пропускаем
            if (mappedNodeIds.has(nodeId)) continue;
           
            // 🔥 НАХОДИМ СТРУКТУРНЫХ СОСЕДЕЙ (тех, что уже в модели)
            const structuralNeighbors = this.findStructuralNeighborsInNewGraph(
                nodeId,
                newGraph,
                structuralMapping
            );
           
            // 🔥 УСЛОВИЕ: узел связан с ≥2 узлами, которые уже есть в модели
            if (structuralNeighbors.length >= 2) {
                const fingerprint = newFingerprints.get(nodeId);
               
                newNodes.push({
                    nodeId: nodeId,
                    nodeData: node,
                    structuralNeighbors: structuralNeighbors, // ID узлов в модели
                    fingerprint: fingerprint,
                    neighborCount: structuralNeighbors.length,
                    reason: `структурно связан с ${structuralNeighbors.length} узлами модели`
                });
               
                console.log(`   ✓ Структурно новый узел: ${nodeId.substring(0, 25)}...`);
                console.log(`      структурных соседей в модели: ${structuralNeighbors.length}`);
                if (fingerprint) {
                    console.log(`      структурная подпись: ${fingerprint.signature.substring(0, 20)}...`);
                }
            }
        }
       
        console.log(`🎯 Найдено ${newNodes.length} структурно новых узлов`);
       
        // 🔥 ДИАГНОСТИКА
        newNodes.forEach((nodeInfo, idx) => {
            console.log(`   ${idx+1}. ${nodeInfo.nodeId.substring(0, 30)}...`);
            console.log(`      соседей в модели: ${nodeInfo.structuralNeighbors.length}`);
            console.log(`      причина: ${nodeInfo.reason}`);
        });
       
        return newNodes;
    }
   
    // 🔥 ПОИСК СТРУКТУРНЫХ СОСЕДЕЙ В НОВОМ ГРАФЕ
    findStructuralNeighborsInNewGraph(nodeId, newGraph, structuralMapping) {
        const structuralNeighbors = [];
       
        // Ищем всех соседей в новом графе
        for (const edge of newGraph.edges) {
            const [nodeA, nodeB] = edge.split('--');
           
            if (nodeA === nodeId && structuralMapping.has(nodeB)) {
                // Сосед имеет соответствие в модели
                structuralNeighbors.push(structuralMapping.get(nodeB));
            } else if (nodeB === nodeId && structuralMapping.has(nodeA)) {
                structuralNeighbors.push(structuralMapping.get(nodeA));
            }
        }
       
        return structuralNeighbors;
    }
   
    // 🔥 ДОБАВЛЕНИЕ СТРУКТУРНЫХ УЗЛОВ В МОДЕЛЬ
    addStructuralNodesToModel(modelId, newNodes, newGraph, structuralMapping, options) {
        const model = this.models.get(modelId);
        const addedNodes = [];
       
        console.log(`🔨 Добавляю ${newNodes.length} структурно новых узлов...`);
       
        for (const nodeInfo of newNodes) {
            const originalNodeId = nodeInfo.nodeId;
            const sourceNode = nodeInfo.nodeData;
           
            // 🔥 СОЗДАЕМ УНИКАЛЬНЫЙ ID ДЛЯ МОДЕЛИ
            const modelNodeId = `structural_node_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
           
            // 🔥 ВЫЧИСЛЯЕМ ВИЗУАЛИЗАЦИОННУЮ ПОЗИЦИЮ (только для отрисовки!)
            const visualizationPosition = this.calculateVisualizationPosition(
                nodeInfo.structuralNeighbors,
                model.graph
            );
           
            // 🔥 СОЗДАЕМ УЗЕЛ (структурные данные + визуализационные)
            const newNode = {
                // 🔴 СТРУКТУРНЫЕ ДАННЫЕ (главное!)
                id: modelNodeId,
                originalId: originalNodeId,
                fingerprint: sourceNode.fingerprint,
                localStructure: sourceNode.fingerprint?.localStructure,
                degree: 0,
               
                // 🟡 ДАННЫЕ ПОДТВЕРЖДЕНИЙ
                confirmationCount: 1, // 🔥 ПЕРВОЕ ПОДТВЕРЖДЕНИЕ!
                addedFrom: 'structural_enhancement',
                addedAt: new Date(),
               
                // 🟢 ВИЗУАЛИЗАЦИОННЫЕ ДАННЫЕ (только для отрисовки!)
                x: visualizationPosition.x,
                y: visualizationPosition.y,
                confidence: sourceNode.confidence || 0.5,
               
                // 🔵 СТРУКТУРНАЯ ИНФОРМАЦИЯ
                structuralNeighbors: nodeInfo.structuralNeighbors,
                structuralNeighborCount: nodeInfo.neighborCount,
                enhancementReason: nodeInfo.reason,
                visualizationMethod: visualizationPosition.method,
               
                // 🟣 ОРИГИНАЛЬНЫЕ ДАННЫЕ (для отладки)
                originalData: {
                    x: sourceNode.x,
                    y: sourceNode.y,
                    confidence: sourceNode.confidence,
                    source: sourceNode.source
                }
            };
           
            console.log(`   + ${modelNodeId}:`);
            console.log(`      структурных соседей: ${newNode.structuralNeighborCount}`);
            console.log(`      визуализационная позиция: (${newNode.x.toFixed(1)}, ${newNode.y.toFixed(1)})`);
            console.log(`      подтверждений: ${newNode.confirmationCount}`);
           
            // 🔥 ДОБАВЛЯЕМ УЗЕЛ В МОДЕЛЬ
            model.graph.nodes.set(modelNodeId, newNode);
           
            // 🔥 ДОБАВЛЯЕМ СТРУКТУРНЫЕ СВЯЗИ (рёбра)
            let edgesAdded = 0;
            for (const neighborModelId of nodeInfo.structuralNeighbors) {
                if (model.graph.nodes.has(neighborModelId)) {
                    const edge = [modelNodeId, neighborModelId].sort().join('--');
                    model.graph.edges.add(edge);
                    edgesAdded++;
                   
                    // Обновляем степени
                    newNode.degree++;
                    model.graph.nodes.get(neighborModelId).degree++;
                }
            }
           
            console.log(`      добавлено структурных связей: ${edgesAdded}`);
           
            addedNodes.push({
                id: modelNodeId,
                x: newNode.x,
                y: newNode.y,
                confidence: newNode.confidence,
                structuralNeighbors: newNode.structuralNeighborCount,
                edgesAdded: edgesAdded,
                visualizationMethod: visualizationPosition.method
            });
        }
       
        console.log(`✅ Добавлено ${addedNodes.length} структурно новых узлов`);
       
        return addedNodes;
    }
   
    // 🔥 ВЫЧИСЛЕНИЕ ВИЗУАЛИЗАЦИОННОЙ ПОЗИЦИИ (только для отрисовки!)
    calculateVisualizationPosition(structuralNeighborIds, modelGraph) {
        if (structuralNeighborIds.length === 0) {
            // Если нет структурных соседей - случайная позиция
            return {
                x: 400 + (Math.random() - 0.5) * 200,
                y: 300 + (Math.random() - 0.5) * 200,
                method: 'random_no_neighbors'
            };
        }
       
        // 🔥 ПРОСТОЙ МЕТОД: Среднее соседей + случайное смещение
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
           
            // 🔥 ДОБАВЛЯЕМ СЛУЧАЙНОЕ СМЕЩЕНИЕ, чтобы не перекрывать
            const offsetX = (Math.random() - 0.5) * 40;
            const offsetY = (Math.random() - 0.5) * 40;
           
            return {
                x: avgX + offsetX,
                y: avgY + offsetY,
                method: `average_of_${count}_neighbors`
            };
        }
       
        // 🔥 ФОЛБЭК: случайная позиция
        return {
            x: 400 + (Math.random() - 0.5) * 300,
            y: 300 + (Math.random() - 0.5) * 200,
            method: 'random_fallback'
        };
    }
   
    // 🔥 УВЕЛИЧЕНИЕ ПОДТВЕРЖДЕНИЙ ДЛЯ СТРУКТУРНО СОВПАВШИХ УЗЛОВ
    increaseStructuralConfirmations(modelId, structuralMapping) {
        const model = this.models.get(modelId);
       
        if (!model || structuralMapping.size === 0) {
            console.log(`⚠️ Нет структурного маппинга для подтверждений`);
            return;
        }
       
        let increasedCount = 0;
        let createdCount = 0;
       
        // 🔥 ПРОХОДИМ ПО ВСЕМ СТРУКТУРНЫМ СООТВЕТСТВИЯМ
        for (const [newNodeId, modelNodeId] of structuralMapping) {
            if (model.graph.nodes.has(modelNodeId)) {
                const node = model.graph.nodes.get(modelNodeId);
               
                // 🔥 ГАРАНТИРУЕМ НАЛИЧИЕ confirmationCount
                if (node.confirmationCount === undefined || node.confirmationCount === null) {
                    node.confirmationCount = 1;
                    createdCount++;
                    console.log(`   🆕 Создан confirmationCount=1 для узла ${modelNodeId.substring(0, 20)}...`);
                } else {
                    node.confirmationCount += 1;
                    increasedCount++;
                   
                    if (this.debug) {
                        console.log(`   📈 Узел ${modelNodeId.substring(0, 20)}...: ${node.confirmationCount-1} → ${node.confirmationCount}`);
                    }
                }
               
                node.lastConfirmed = new Date();
            }
        }
       
        console.log(`📈 Увеличены подтверждения: ${increasedCount} узлов, создано: ${createdCount}`);
       
        // 🔥 ДИАГНОСТИКА: статистика подтверждений
        const confirmationStats = { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0 };
        for (const node of model.graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmationStats['4+']++;
            else confirmationStats[count] = (confirmationStats[count] || 0) + 1;
        }
       
        console.log(`📊 Статистика подтверждений после улучшения:`);
        console.log(`   0 подтверждений: ${confirmationStats[0]}`);
        console.log(`   1 подтверждение: ${confirmationStats[1]}`);
        console.log(`   2 подтверждения: ${confirmationStats[2]}`);
        console.log(`   3 подтверждения: ${confirmationStats[3]}`);
        console.log(`   4+ подтверждений: ${confirmationStats['4+']}`);
    }
   
    // 🔥 ОБНОВЛЕНИЕ СТРУКТУРНЫХ ПОДПИСЕЙ МОДЕЛИ
    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
       
        console.log(`🔄 Обновляю структурные подписи для модели ${modelId}...`);
       
        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;
       
        console.log(`✅ Структурные подписи обновлены: ${newFingerprints.size} узлов`);
       
        return newFingerprints;
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
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
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmationStats['4+']++;
            else confirmationStats[count] = (confirmationStats[count] || 0) + 1;
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
                confirmationStats: confirmationStats
            },
            metadata: model.metadata,
            history: {
                totalActions: model.history.length,
                lastAction: model.history[model.history.length - 1],
                enhancements: model.history.filter(h => h.action.includes('enhanced')).length
            },
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated,
            philosophy: 'pure_topology_coordinates_for_visualization_only'
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
       
        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ ТОПОЛОГИЧЕСКОЙ МОДЕЛИ "${model.metadata.name}":`);
        console.log(`═`.repeat(70));
       
        console.log(`📊 СТРУКТУРНАЯ ИНФОРМАЦИЯ:`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Треугольников: ${model.metadata.triangleCount || 0}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);
       
        // Статистика подтверждений
        const confirmationStats = { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0 };
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmationStats['4+']++;
            else confirmationStats[count] = (confirmationStats[count] || 0) + 1;
        }
       
        console.log(`\n🎯 ПОДТВЕРЖДЕНИЯ (структурные):`);
        console.log(`   🔴 4+ подтверждений: ${confirmationStats['4+']} (структурные ядра)`);
        console.log(`   🟠 3 подтверждения: ${confirmationStats[3]} (стабильные узлы)`);
        console.log(`   🟡 2 подтверждения: ${confirmationStats[2]} (подтверждённые узлы)`);
        console.log(`   🔵 1 подтверждение: ${confirmationStats[1]} (новые узлы)`);
        console.log(`   ⚪ 0 подтверждений: ${confirmationStats[0]} (неподтверждённые)`);
       
        // Показываем узлы (ограниченное количество)
        const showNodes = options.showNodes || 6;
        console.log(`\n📋 УЗЛЫ (первые ${showNodes}, координаты ТОЛЬКО для визуализации):`);
       
        let count = 0;
        for (const [nodeId, node] of graph.nodes) {
            if (count++ >= showNodes) break;
           
            const confirmations = node.confirmationCount || 0;
            const source = node.addedFrom ? `[${node.addedFrom}]` : '[original]';
            console.log(`   ${nodeId.substring(0, 20)}... ${source}`);
            console.log(`      подтверждений: ${confirmations}, степень: ${node.degree}`);
            console.log(`      визуализационные координаты: (${node.x?.toFixed(1) || '?'}, ${node.y?.toFixed(1) || '?'})`);
        }
       
        if (graph.nodes.size > showNodes) {
            console.log(`   ... и еще ${graph.nodes.size - showNodes} структурных узлов`);
        }
       
        // Показываем историю
        console.log(`\n📜 ИСТОРИЯ СТРУКТУРНЫХ ИЗМЕНЕНИЙ (последние 3):`);
        model.history.slice(-3).forEach((entry, idx) => {
            const emoji = entry.action.includes('created') ? '🆕' : '🔧';
            console.log(`   ${emoji} ${entry.action.toUpperCase()}: ${entry.timestamp.toLocaleTimeString()}`);
            console.log(`      метод: ${entry.method || 'unknown'}`);
            console.log(`      узлов: ${entry.nodes || '?'}, рёбер: ${entry.edges || '?'}`);
            if (entry.newNodes) console.log(`      +${entry.newNodes} новых структурных узлов`);
        });
       
        console.log(`\n🎯 ФИЛОСОФИЯ: Чистая топология, координаты только для визуализации`);
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
            _version: '2.0-pure-topology',
            _exportedAt: new Date().toISOString(),
            _philosophy: 'pure_topological_structure_coordinates_for_visualization_only'
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
           
            // 🔥 ГАРАНТИРУЕМ confirmationCount
            for (const node of graph.nodes.values()) {
                if (node.confirmationCount === undefined || node.confirmationCount === null) {
                    node.confirmationCount = 1; // Минимум 1 подтверждение
                }
            }
           
            this.models.set(modelId, model);
           
            if (!this.currentModelId) {
                this.currentModelId = modelId;
            }
           
            console.log(`📥 Импортирована чисто топологическая модель "${model.metadata.name}"`);
            console.log(`   Узлов: ${graph.nodes.size}, Рёбер: ${graph.edges.size}`);
            console.log(`   Философия: ${data._philosophy || 'чистая топология'}`);
           
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
            const info = this.getModelInfo(modelId);
            modelsInfo.push({
                id: modelId,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                createdAt: model.metadata.createdAt,
                confirmationStats: info.stats?.confirmationStats
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
                philosophy: 'pure_topological_structure_coordinates_for_visualization_only'
            }
        };
    }
}

module.exports = TopologicalAccumulator;
