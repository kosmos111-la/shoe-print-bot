// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ АККУМУЛЯТИВНАЯ МОДЕЛЬ С ПРАВИЛЬНЫМ МАППИНГОМ И СТРУКТУРНЫМ РАЗМЕЩЕНИЕМ

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
   
    // 🔥 ОСНОВНОЙ МЕТОД: Обработка нового набора точек
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
       
        // 🔥 СРАВНИВАЕМ ПО ПОДПИСЯМ
        const comparison = this.fingerprinter.compareGraphs(
            existingModel.graph,
            existingModel.fingerprints,
            graph,
            fingerprints
        );
       
        // 5. Принимаем решение на основе сходства
        if (comparison.similarity >= this.similarityThreshold) {
            console.log(`✅ СОВПАДЕНИЕ: ${(comparison.similarity * 100).toFixed(1)}% ≥ ${this.similarityThreshold * 100}%`);
           
            // 🔥 СОЗДАЕМ ПРАВИЛЬНЫЙ МАППИНГ НА ОСНОВЕ ПОДПИСЕЙ
            const signatureMapping = this.createSignatureBasedMapping(
                existingModel.fingerprints,
                fingerprints,
                comparison.allMatches
            );
           
            // Улучшаем существующую модель с правильным маппингом
            const enhancementResult = await this.enhanceModelWithCorrectMapping(
                modelId,
                graph,
                fingerprints,
                comparison,
                signatureMapping,
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
   
    // 🔥 НОВЫЙ МЕТОД: Создание маппинга на основе подписей (а не ID!)
    createSignatureBasedMapping(modelFingerprints, newFingerprints, matches) {
        console.log(`🗺️ Создаю маппинг на основе ${matches?.length || 0} совпадений...`);
       
        const mapping = new Map();
        const usedModelNodes = new Set();
       
        if (!matches || matches.length === 0) {
            console.log('⚠️ Нет совпадений для создания маппинга');
            return mapping;
        }
       
        // Проходим по всем совпадениям
        for (const match of matches) {
            const modelNodeId = match.node1; // Узел в модели
            const newNodeId = match.node2;   // Узел в новом графе
           
            // Получаем подписи
            const modelFp = modelFingerprints.get(modelNodeId);
            const newFp = newFingerprints.get(newNodeId);
           
            if (modelFp && newFp) {
                // 🔥 ПРОВЕРЯЕМ, ЧТО ПОДПИСИ ДЕЙСТВИТЕЛЬНО ПОХОЖИ
                if (modelFp.signature === newFp.signature ||
                    match.confidence > 0.7) {
                   
                    // Проверяем, что узел модели ещё не использован
                    if (!usedModelNodes.has(modelNodeId)) {
                        mapping.set(newNodeId, modelNodeId);
                        usedModelNodes.add(modelNodeId);
                       
                        if (this.debug && mapping.size <= 3) {
                            console.log(`   📍 ${newNodeId.substring(0, 15)}... → ${modelNodeId.substring(0, 15)}...`);
                            console.log(`      уверенность: ${(match.confidence * 100).toFixed(1)}%`);
                        }
                    }
                }
            }
        }
       
        console.log(`✅ Создан маппинг: ${mapping.size} соответствий`);
        return mapping;
    }
   
    // 🔥 НОВЫЙ МЕТОД: Улучшение модели с правильным маппингом
    async enhanceModelWithCorrectMapping(modelId, newGraph, newFingerprints, comparison, mapping, options = {}) {
        console.log(`🔧 ДОСТРАИВАЮ МОДЕЛЬ "${modelId}" с правильным маппингом...`);
       
        const model = this.models.get(modelId);
       
        if (mapping.size < this.minMatchesForEnhancement) {
            console.log(`⚠️ Мало совпадений для достройки: ${mapping.size} < ${this.minMatchesForEnhancement}`);
            return { newNodesAdded: 0, reason: 'insufficient_matches' };
        }
       
        // 🔥 НАХОДИМ РЕАЛЬНО НОВЫЕ УЗЛЫ (те, которые не имеют соответствий в модели)
        const trulyNewNodes = this.findTrulyNewNodes(
            model.graph,
            newGraph,
            newFingerprints,
            mapping
        );
       
        if (trulyNewNodes.length === 0) {
            console.log(`✅ Все узлы уже есть в модели`);
            return { newNodesAdded: 0, reason: 'all_nodes_exist' };
        }
       
        console.log(`🎯 Найдено ${trulyNewNodes.length} РЕАЛЬНО НОВЫХ узлов для добавления`);
       
        // 🔥 ДОБАВЛЯЕМ НОВЫЕ УЗЛЫ С ПРАВИЛЬНЫМ РАЗМЕЩЕНИЕМ
        const addedNodes = this.addNewNodesWithStructuralPlacement(
            modelId,
            trulyNewNodes,
            newGraph,
            mapping
        );
       
        // Обновляем подписи модели
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }
       
        // 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ ТОЛЬКО ДЛЯ СОВПАВШИХ УЗЛОВ
        this.updateConfirmedNodes(modelId, mapping);
       
        // Обновляем историю
        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            exactMatches: mapping.size,
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
            allMatches: mapping.size
        };
    }
   
    // 🔥 НОВЫЙ МЕТОД: Поиск действительно новых узлов
    findTrulyNewNodes(modelGraph, newGraph, newFingerprints, mapping) {
        console.log(`🔍 Поиск РЕАЛЬНО НОВЫХ узлов...`);
       
        const newNodes = [];
        const mappedNodeIds = new Set(mapping.keys()); // ID узлов, которые уже имеют соответствия
       
        // Рассчитываем границы существующей модели
        const modelBounds = this.calculateModelBounds(modelGraph);
       
        // Проходим по всем узлам нового графа
        for (const [nodeId, node] of newGraph.nodes) {
            // Если узел уже имеет соответствие - пропускаем
            if (mappedNodeIds.has(nodeId)) continue;
           
            // 🔥 ПРОВЕРЯЕМ, МОЖЕТ ЭТОТ УЗЕЛ УЖЕ ЕСТЬ В МОДЕЛИ
            const isAlreadyInModel = this.checkIfNodeInModel(node, modelGraph, newFingerprints.get(nodeId));
           
            if (!isAlreadyInModel) {
                // 🔥 НАХОДИМ ЕГО СТРУКТУРНЫХ СОСЕДЕЙ (тех, что имеют соответствия)
                const structuralNeighbors = this.findStructuralNeighbors(nodeId, newGraph, mapping);
               
                // 🔥 ПРОВЕРЯЕМ, ЧТО УЗЕЛ НАХОДИТСЯ ВНЕ ЗОНЫ МОДЕЛИ
                const isOutsideModelBounds = !this.isPointInsideBounds(node, modelBounds);
               
                if (structuralNeighbors.length >= 2) {
                    newNodes.push({
                        nodeId: nodeId,
                        nodeData: node,
                        structuralNeighbors: structuralNeighbors,
                        fingerprint: newFingerprints.get(nodeId),
                        isOutsideModel: isOutsideModelBounds,
                        connectionsToMatched: structuralNeighbors.length,
                        reason: `связан с ${structuralNeighbors.length} совпавшими узлами ${isOutsideModelBounds ? '(ВНЕ ЗОНЫ)' : ''}`
                    });
                   
                    if (this.debug && newNodes.length <= 3) {
                        console.log(`   ✓ НОВЫЙ узел: ${nodeId.substring(0, 20)}...`);
                        console.log(`      структурные соседи: ${structuralNeighbors.length}`);
                        console.log(`      координаты: (${node.x?.toFixed(1) || '?'}, ${node.y?.toFixed(1) || '?'})`);
                        console.log(`      вне зоны модели: ${isOutsideModelBounds}`);
                    }
                }
            }
        }
       
        // 🔥 ФИЛЬТРУЕМ: В первую очередь добавляем узлы ВНЕ зоны модели
        const externalNodes = newNodes.filter(n => n.isOutsideModel);
        const internalNodes = newNodes.filter(n => !n.isOutsideModel);
       
        console.log(`📊 РЕЗУЛЬТАТ ПОИСКА:`);
        console.log(`   Всего новых узлов: ${newNodes.length}`);
        console.log(`   Вне зоны модели: ${externalNodes.length} (приоритет)`);
        console.log(`   Внутри зоны модели: ${internalNodes.length}`);
       
        // 🔥 ВОЗВРАЩАЕМ СНАЧАЛА УЗЛЫ ВНЕ ЗОНЫ, ПОТОМ ВНУТРИ
        return [...externalNodes, ...internalNodes];
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Найти структурных соседей через маппинг
    findStructuralNeighbors(nodeId, newGraph, mapping) {
        const neighbors = [];
       
        // Находим всех соседей в новом графе
        for (const edge of newGraph.edges) {
            const [nodeA, nodeB] = edge.split('--');
           
            if (nodeA === nodeId && mapping.has(nodeB)) {
                neighbors.push(mapping.get(nodeB)); // ID узла в модели
            } else if (nodeB === nodeId && mapping.has(nodeA)) {
                neighbors.push(mapping.get(nodeA)); // ID узла в модели
            }
        }
       
        return neighbors;
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Проверка, есть ли узел уже в модели
    checkIfNodeInModel(node, modelGraph, fingerprint) {
        // 1. Проверка по координатам (с допуском)
        for (const [modelNodeId, modelNode] of modelGraph.nodes) {
            if (modelNode.x && modelNode.y && node.x && node.y) {
                const distance = Math.sqrt(
                    Math.pow(modelNode.x - node.x, 2) +
                    Math.pow(modelNode.y - node.y, 2)
                );
               
                // Если очень близко - вероятно, это та же точка
                if (distance < 15) {
                    return true;
                }
            }
        }
       
        // 2. Проверка по структурной подписи (если есть)
        if (fingerprint) {
            for (const [modelNodeId, modelNode] of modelGraph.nodes) {
                if (modelNode.fingerprint && modelNode.fingerprint.signature === fingerprint.signature) {
                    return true;
                }
            }
        }
       
        return false;
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Расчет границ модели
    calculateModelBounds(modelGraph) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        for (const node of modelGraph.nodes.values()) {
            if (node.x && node.y) {
                minX = Math.min(minX, node.x);
                maxX = Math.max(maxX, node.x);
                minY = Math.min(minY, node.y);
                maxY = Math.max(maxY, node.y);
            }
        }
       
        // Добавляем отступ для зоны "внутри модели"
        const padding = 30;
        return {
            minX: minX - padding,
            maxX: maxX + padding,
            minY: minY - padding,
            maxY: maxY + padding,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Проверка точки внутри границ
    isPointInsideBounds(point, bounds) {
        if (!point.x || !point.y) return false;
       
        return point.x >= bounds.minX &&
               point.x <= bounds.maxX &&
               point.y >= bounds.minY &&
               point.y <= bounds.maxY;
    }
   
    // 🔥 НОВЫЙ МЕТОД: Добавление узлов со структурным размещением
    addNewNodesWithStructuralPlacement(modelId, newNodes, newGraph, mapping) {
        const model = this.models.get(modelId);
        const addedNodes = [];
       
        console.log(`🔨 Добавляю ${newNodes.length} новых узлов со структурным размещением...`);
       
        for (const nodeInfo of newNodes) {
            const originalNodeId = nodeInfo.nodeId;
            const sourceNode = nodeInfo.nodeData;
           
            // 🔥 СОЗДАЕМ УНИКАЛЬНЫЙ ID ДЛЯ МОДЕЛИ
            const modelNodeId = `new_node_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
           
            // 🔥 ВЫЧИСЛЯЕМ ПОЗИЦИЮ НА ОСНОВЕ СТРУКТУРНЫХ СОСЕДЕЙ
            const position = this.calculateStructuralPosition(
                nodeInfo.structuralNeighbors,
                model.graph,
                sourceNode,
                nodeInfo.isOutsideModel
            );
           
            const newNode = {
                // Основные данные
                id: modelNodeId,
                originalId: originalNodeId,
                x: position.x,
                y: position.y,
                confidence: sourceNode.confidence || 0.5,
                degree: 0,
               
                // Метаданные
                addedFrom: 'enhancement_structural',
                addedAt: new Date(),
                structuralNeighbors: nodeInfo.structuralNeighbors,
                positionMethod: position.method,
                isOutsideModel: nodeInfo.isOutsideModel,
               
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
                localStructure: sourceNode.fingerprint?.localStructure,
               
                // Для отладки
                isTrulyNew: true,
                enhancementReason: nodeInfo.reason
            };
           
            console.log(`   + ${modelNodeId}:`);
            console.log(`      позиция: (${newNode.x.toFixed(1)}, ${newNode.y.toFixed(1)}) [${position.method}]`);
            console.log(`      структурных соседей: ${nodeInfo.structuralNeighbors.length}`);
            console.log(`      подтверждений: ${newNode.confirmationCount}`);
            console.log(`      вне зоны модели: ${nodeInfo.isOutsideModel}`);
           
            // Добавляем узел в модель
            model.graph.nodes.set(modelNodeId, newNode);
           
            // 🔥 ДОБАВЛЯЕМ РЁБРА К СТРУКТУРНЫМ СОСЕДЯМ
            for (const neighborModelId of nodeInfo.structuralNeighbors) {
                if (model.graph.nodes.has(neighborModelId)) {
                    const edge = [modelNodeId, neighborModelId].sort().join('--');
                    model.graph.edges.add(edge);
                   
                    // Обновляем степени
                    newNode.degree++;
                    model.graph.nodes.get(neighborModelId).degree++;
                }
            }
           
            addedNodes.push({
                id: modelNodeId,
                x: newNode.x,
                y: newNode.y,
                confidence: newNode.confidence,
                positionMethod: position.method,
                structuralNeighbors: nodeInfo.structuralNeighbors.length,
                isOutsideModel: nodeInfo.isOutsideModel
            });
        }
       
        console.log(`✅ Добавлено ${addedNodes.length} новых узлов, всего ${model.graph.nodes.size} узлов`);
       
        return addedNodes;
    }
   
    // 🔥 НОВЫЙ МЕТОД: Вычисление позиции на основе структурных соседей
    calculateStructuralPosition(structuralNeighborIds, modelGraph, sourceNode, isOutsideModel) {
        if (structuralNeighborIds.length === 0) {
            // Если нет структурных соседей
            return {
                x: sourceNode.x || 400 + (Math.random() - 0.5) * 100,
                y: sourceNode.y || 300 + (Math.random() - 0.5) * 100,
                method: 'original_coords_no_neighbors'
            };
        }
       
        // 🔥 СПОСОБ 1: Среднее положение структурных соседей
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
           
            // 🔥 ЕСЛИ УЗЕЛ ВНЕ ЗОНЫ МОДЕЛИ - РАЗМЕЩАЕМ ВНЕ
            if (isOutsideModel) {
                // Вычисляем вектор от центра модели к узлу
                const bounds = this.calculateModelBounds(modelGraph);
                const centerX = bounds.centerX;
                const centerY = bounds.centerY;
               
                // Направление от центра к среднему положению соседей
                const dirX = avgX - centerX;
                const dirY = avgY - centerY;
                const distance = Math.sqrt(dirX * dirX + dirY * dirY);
               
                // Увеличиваем расстояние от центра
                const scale = distance > 0 ? 1.5 : 1.0;
                const newX = centerX + dirX * scale;
                const newY = centerY + dirY * scale;
               
                return {
                    x: newX,
                    y: newY,
                    method: `outside_model_placement_${count}_neighbors`
                };
            } else {
                // 🔥 ЕСЛИ УЗЕЛ ВНУТРИ ЗОНЫ МОДЕЛИ - СЛЕГКА СМЕЩАЕМ
                const offsetX = (Math.random() - 0.5) * 20;
                const offsetY = (Math.random() - 0.5) * 20;
               
                return {
                    x: avgX + offsetX,
                    y: avgY + offsetY,
                    method: `inside_model_average_${count}_neighbors`
                };
            }
        }
       
        // 🔥 СПОСОБ 2: Используем оригинальные координаты
        return {
            x: sourceNode.x || 400 + (Math.random() - 0.5) * 100,
            y: sourceNode.y || 300 + (Math.random() - 0.5) * 100,
            method: 'original_with_random_offset'
        };
    }
   
    // 🔥 НОВЫЙ МЕТОД: Обновление подтверждений только для совпавших узлов
    updateConfirmedNodes(modelId, mapping) {
        const model = this.models.get(modelId);
       
        if (!model || mapping.size === 0) return;
       
        let updatedCount = 0;
       
        // Обновляем только узлы, которые имеют соответствия
        for (const [newNodeId, modelNodeId] of mapping) {
            if (model.graph.nodes.has(modelNodeId)) {
                const node = model.graph.nodes.get(modelNodeId);
                const oldCount = node.confirmationCount || 1;
                node.confirmationCount = oldCount + 1;
                node.lastConfirmed = new Date();
                updatedCount++;
               
                if (this.debug && updatedCount <= 3) {
                    console.log(`   📈 Узел ${modelNodeId.substring(0, 15)}...: подтверждений ${oldCount} → ${node.confirmationCount}`);
                }
            }
        }
       
        console.log(`📈 Обновлены подтверждения для ${updatedCount} совпавших узлов`);
    }
   
    // 🔥 МЕТОД: Создание новой модели
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
   
    // Обновление степеней узлов
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
   
    // Обновление WL-подписей
    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
       
        console.log(`🔄 Обновляю WL-подписи для модели ${modelId}...`);
       
        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;
       
        console.log(`✅ Подписи обновлены: ${newFingerprints.size} узлов`);
       
        return newFingerprints;
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
       
        // Показываем узлы
        const showNodes = options.showNodes || 8;
        console.log(`\n📋 УЗЛЫ (первые ${showNodes}):`);
       
        let count = 0;
        for (const [nodeId, node] of graph.nodes) {
            if (count++ >= showNodes) break;
           
            const source = node.addedFrom ? `[${node.addedFrom}]` : '[original]';
            const confirmations = node.confirmationCount || 1;
            console.log(`   ${nodeId.substring(0, 15)}... ${source}:`);
            console.log(`      координаты: (${node.x?.toFixed(1) || '?'}, ${node.y?.toFixed(1) || '?'})`);
            console.log(`      степень: ${node.degree}, подтверждений: ${confirmations}`);
            if (node.isOutsideModel) console.log(`      📍 ВНЕ ЗОНЫ МОДЕЛИ`);
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
            _version: '1.2-topological-structural-placement',
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
   
    // Получить глобальную статистику
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
