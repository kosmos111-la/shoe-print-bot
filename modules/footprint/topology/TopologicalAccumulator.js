// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ АККУМУЛЯТИВНАЯ МОДЕЛЬ С ДОСТРАИВАНИЕМ ГРАФА

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;
        this.minMatchesForEnhancement = options.minMatchesForEnhancement || 3;
        this.similarityThreshold = options.similarityThreshold || 0.6; // 60%
       
        // Основные компоненты
        this.topologyBuilder = new (require('./TopologyBuilder'))({ debug: this.debug });
        this.fingerprinter = new (require('./TopologicalFingerprint'))({
            debug: this.debug,
            iterations: options.wlIterations || 3
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
   
    // Улучшение существующей модели (достраивание)
    async enhanceModel(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`🔧 ДОСТРАИВАЮ МОДЕЛЬ "${modelId}"...`);
       
        const model = this.models.get(modelId);
        const exactMatches = comparison.exactMatches;
       
        if (exactMatches.length < this.minMatchesForEnhancement) {
            console.log(`⚠️ Мало совпадений для достройки: ${exactMatches.length} < ${this.minMatchesForEnhancement}`);
            return { newNodesAdded: 0, reason: 'insufficient_matches' };
        }
       
        // Находим узлы, которые нужно добавить
        const nodesToAdd = this.findNodesToAdd(
            model.graph,
            newGraph,
            newFingerprints,
            exactMatches
        );
       
        if (nodesToAdd.length === 0) {
            console.log(`✅ Все узлы уже есть в модели`);
            return { newNodesAdded: 0, reason: 'all_nodes_exist' };
        }
       
        console.log(`🎯 Найдено ${nodesToAdd.length} новых узлов для добавления`);
       
        // Добавляем узлы в модель
        const addedNodes = this.addNodesToModel(modelId, nodesToAdd, newGraph);
       
        // Обновляем подписи модели (необязательно, можно лениво)
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }
       
        // Обновляем историю
        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            exactMatches: exactMatches.length,
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
            exactMatches: exactMatches.length
        };
    }
   
    // Находим узлы для добавления в модель
    findNodesToAdd(modelGraph, newGraph, newFingerprints, exactMatches) {
        const nodesToAdd = [];
        const matchedNodeIds = new Set(exactMatches.map(m => m.node2));
       
        // Проходим по всем узлам нового графа
        for (const [nodeId, node] of newGraph.nodes) {
            // Если узел уже совпал - пропускаем
            if (matchedNodeIds.has(nodeId)) continue;
           
            // Если узел уже есть в модели - пропускаем
            if (modelGraph.nodes.has(nodeId)) continue;
           
            // Проверяем связи с совпавшими узлами
            const connectionsToMatched = this.countConnectionsToMatched(
                nodeId,
                matchedNodeIds,
                newGraph.edges
            );
           
            // Если узел связан с достаточным количеством совпавших узлов
            if (connectionsToMatched >= 2) {
                nodesToAdd.push({
                    nodeId: nodeId,
                    nodeData: node,
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
           
            // Добавляем узел
            model.graph.nodes.set(nodeId, {
                ...nodeInfo.nodeData,
                addedFrom: sourceGraph.points.find(p => p.id === nodeId)?.source || 'unknown',
                addedAt: new Date(),
                connectionsToMatched: nodeInfo.connectionsToMatched
            });
           
            // Добавляем рёбра (только те, где второй узел уже в модели)
            for (const edge of sourceGraph.edges) {
                const [nodeA, nodeB] = edge.split('--');
               
                if ((nodeA === nodeId && model.graph.nodes.has(nodeB)) ||
                    (nodeB === nodeId && model.graph.nodes.has(nodeA))) {
                    model.graph.edges.add(edge);
                }
            }
           
            addedNodes.push({
                id: nodeId,
                ...nodeInfo.nodeData,
                addedReason: nodeInfo.reason
            });
           
            if (this.debug) {
                console.log(`   + ${nodeId}: ${nodeInfo.reason}`);
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
   
    // Обновляем подписи модели (может быть дорого, можно делать лениво)
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
       
        // Собираем статистику по подтверждениям (узлы из разных источников)
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
            console.log(`   ${nodeId} ${source}: (${node.x?.toFixed(1) || '?'}, ${node.y?.toFixed(1) || '?'}) | степень: ${node.degree}`);
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
   
    // Экспорт модели для сохранения
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
            _version: '1.0-topological',
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
