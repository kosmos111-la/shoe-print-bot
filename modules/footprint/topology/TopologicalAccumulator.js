// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ АККУМУЛЯТИВНАЯ МОДЕЛЬ + ГЕОМЕТРИЧЕСКИЙ КОНТЕКСТ ТОЧЕК

const GeometryContext = require('./GeometryContext');

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

        // 🔥 НОВОЕ: Геометрический контекст точек
        this.geometryContext = new GeometryContext({ debug: this.debug });

        // Хранилище моделей
        this.models = new Map();
        this.currentModelId = null;

        // Статистика
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalPointsProcessed: 0,
            totalGeometryRecovered: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        console.log(`🏗️ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   📐 Геометрический контекст: активен`);
        console.log(`   🎯 Голосование по 4 методам восстановления`);
    }

    async processPoints(points, options = {}) {
        console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК...`);

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

        // 5. Обновляем подтверждения (ТОЛЬКО по точным совпадениям!)
        this.updateConfirmations(existingModel, comparison.exactMatches);

        // 6. Принимаем решение на основе сходства
        if (comparison.similarity >= this.similarityThreshold) {
            console.log(`✅ СОВПАДЕНИЕ: ${(comparison.similarity * 100).toFixed(1)}%`);

            // Улучшаем модель с геометрическим контекстом
            const enhancementResult = await this.enhanceModelWithGeometry(
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
                exactMatches: comparison.exactMatches?.length || 0,
                similarMatches: comparison.similarMatches?.length || 0,
                newNodesAdded: enhancementResult.newNodesAdded,
                geometryRecovered: enhancementResult.geometryRecovered || 0,
                totalNodesInModel: this.models.get(modelId).graph.nodes.size,
                message: `Модель улучшена (+${enhancementResult.newNodesAdded} узлов)`
            };

        } else {
            console.log(`🆕 РАЗНЫЕ СЛЕДЫ: ${(comparison.similarity * 100).toFixed(1)}%`);
            return this.createNewModel(graph, fingerprints, points, {
                ...options,
                comparedWith: modelId,
                similarity: comparison.similarity
            });
        }
    }

    // 🔥🔥🔥 УЛУЧШЕНИЕ МОДЕЛИ С ГЕОМЕТРИЧЕСКИМ КОНТЕКСТОМ
    async enhanceModelWithGeometry(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`🔧 УЛУЧШАЮ МОДЕЛЬ "${modelId}" ЧЕРЕЗ ГЕОМЕТРИЧЕСКИЙ КОНТЕКСТ...`);

        const model = this.models.get(modelId);

        // 🔥 ИСПОЛЬЗУЕМ ВСЕ СОВПАДЕНИЯ для маппинга
        const allMatches = comparison.allMatches || [];

        if (allMatches.length < this.minMatchesForEnhancement) {
            console.log(`⚠️ Мало совпадений: ${allMatches.length} < ${this.minMatchesForEnhancement}`);
            return { newNodesAdded: 0 };
        }

        // Создаем маппинг
        const mapping = new Map();
        const usedModelNodes = new Set();

        for (const match of allMatches) {
            if (!usedModelNodes.has(match.node1)) {
                mapping.set(match.node2, match.node1);
                usedModelNodes.add(match.node1);
            }
        }

        console.log(`🗺️ Маппинг: ${mapping.size} соответствий`);

        // Собираем опорные точки
        const anchors = [];
        for (const [newId, modelId] of mapping) {
            const modelNode = model.graph.nodes.get(modelId);
            const newNode = newGraph.nodes.get(newId);
            if (modelNode && newNode) {
                anchors.push({
                    id: modelId,
                    node: modelNode,
                    newNode: newNode
                });
            }
        }

        // Получаем маяки из модели
        const beacons = this.geometryContext.getBeacons(model.graph);
        console.log(`🎯 Маяков в модели: ${beacons.length}`);

        // Находим новые узлы
        const newNodes = this.findNewNodes(newGraph, mapping);
        console.log(`🎯 Найдено ${newNodes.length} новых узлов`);

        if (newNodes.length === 0) {
            return { newNodesAdded: 0 };
        }

        // 🔥🔥🔥 ДОБАВЛЯЕМ НОВЫЕ УЗЛЫ ЧЕРЕЗ ГЕОМЕТРИЧЕСКИЙ КОНТЕКСТ
        const addedNodes = [];

        for (const nodeId of newNodes) {
            const photo2Point = newGraph.nodes.get(nodeId);
            if (!photo2Point) continue;

            // Находим всех соседей этой точки в новом графе
            const neighbors = this.findNodeNeighbors(nodeId, newGraph);
           
            // Запоминаем геометрический контекст
            this.geometryContext.rememberContext(
                nodeId,
                photo2Point,
                neighbors,
                newGraph.nodes,
                beacons
            );

            // Восстанавливаем позицию голосованием
            const position = this.geometryContext.reconstructPosition(
                nodeId,
                model.graph,
                beacons
            );

            if (!position) {
                console.log(`   ⚠️ Не удалось восстановить позицию для ${nodeId}`);
                continue;
            }

            // Создаем новый узел в модели
            const modelNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

            const newNode = {
                id: modelNodeId,
                originalId: nodeId,
                x: position.x,
                y: position.y,
                confidence: photo2Point.confidence || 0.5,
                degree: 0,
                confirmationCount: 1,
                addedFrom: 'geometry_context',
                addedAt: new Date(),
                placementMethod: position.method,
                placementConfidence: position.confidence,
                geometryVotes: position.votes
            };

            model.graph.nodes.set(modelNodeId, newNode);

            // Добавляем связи с 3 ближайшими соседями
            const closestNeighbors = this.findClosestNeighbors(nodeId, newGraph, mapping, 3);
            let edgesAdded = 0;

            for (const neighborId of closestNeighbors) {
                const edge = [modelNodeId, neighborId].sort().join('--');
                model.graph.edges.add(edge);
                edgesAdded++;
                newNode.degree++;
               
                const neighborNode = model.graph.nodes.get(neighborId);
                if (neighborNode) neighborNode.degree++;
            }

            console.log(`   ✅ Добавлен узел (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
            console.log(`      Метод: ${position.method}, уверенность: ${(position.confidence * 100).toFixed(0)}%`);
            console.log(`      Связей: ${edgesAdded}`);

            addedNodes.push({
                id: modelNodeId,
                x: position.x,
                y: position.y,
                method: position.method,
                confidence: position.confidence,
                votes: position.votes
            });

            this.stats.totalGeometryRecovered++;
        }

        // Обновляем подписи
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }

        // Обновляем историю
        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            geometryRecovered: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            allMatches: allMatches.length,
            beacons: beacons.length,
            similarity: comparison.similarity
        });

        this.stats.totalEnhancements++;
        this.stats.lastUpdated = new Date();

        console.log(`✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
        console.log(`   📐 Геометрический контекст: ${addedNodes.length}`);

        return {
            newNodesAdded: addedNodes.length,
            geometryRecovered: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size
        };
    }

    // 🔥 ПОИСК СОСЕДЕЙ УЗЛА В ГРАФЕ
    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        for (const edge of graph.edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodeA === nodeId) neighbors.push(nodeB);
            if (nodeB === nodeId) neighbors.push(nodeA);
        }
        return [...new Set(neighbors)]; // Уникальные
    }

    // 🔥 ПОИСК БЛИЖАЙШИХ СОСЕДЕЙ В МОДЕЛИ
    findClosestNeighbors(nodeId, newGraph, mapping, count) {
        const newNode = newGraph.nodes.get(nodeId);
        if (!newNode) return [];

        const candidates = [];
        for (const [newId, modelId] of mapping) {
            if (newId === nodeId) continue;
            const node = newGraph.nodes.get(newId);
            if (node) {
                candidates.push({
                    id: modelId,
                    distance: this.distance(newNode, node)
                });
            }
        }

        return candidates
            .sort((a, b) => a.distance - b.distance)
            .slice(0, count)
            .map(c => c.id);
    }

    // 🔥 ПОИСК НОВЫХ УЗЛОВ
    findNewNodes(graph, mapping) {
        const newNodes = [];
        const mappedIds = new Set(mapping.keys());

        for (const [nodeId, node] of graph.nodes) {
            if (!mappedIds.has(nodeId)) {
                newNodes.push(nodeId);
            }
        }

        return newNodes;
    }

    // 🔥 ОБНОВЛЕНИЕ ПОДТВЕРЖДЕНИЙ (ТОЛЬКО ПО ТОЧНЫМ)
    updateConfirmations(model, exactMatches) {
        if (!model || !exactMatches || exactMatches.length === 0) return;

        let updated = 0;
        for (const match of exactMatches) {
            const node = model.graph.nodes.get(match.node1);
            if (node) {
                node.confirmationCount = (node.confirmationCount || 1) + 1;
                node.lastConfirmed = new Date();
                updated++;
            }
        }

        console.log(`📈 Подтверждений (точные): +${updated}`);
    }

    // 🔥 РАССТОЯНИЕ
    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 🔥 СОЗДАНИЕ НОВОЙ МОДЕЛИ
    createNewModel(graph, fingerprints, originalPoints, options = {}) {
        const modelId = `topo_model_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        // Инициализируем confirmationCount для всех узлов
        for (const node of graph.nodes.values()) {
            node.confirmationCount = 1;
            node.addedFrom = options.source || 'initial';
            node.addedAt = new Date();
        }

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
                source: options.source || 'unknown'
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

        return {
            status: 'created',
            modelId: modelId,
            nodes: graph.nodes.size,
            edges: graph.edges.size,
            avgDegree: graph.avgDegree
        };
    }

    // 🔥 ОБНОВЛЕНИЕ ПОДПИСЕЙ
    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
        console.log(`🔄 Обновляю WL-подписи...`);

        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;

        console.log(`✅ Подписи обновлены: ${newFingerprints.size} узлов`);
        return newFingerprints;
    }

    // 🔥 ПОЛУЧЕНИЕ ИНФОРМАЦИИ О МОДЕЛИ
    getModelInfo(modelId = null) {
        const targetId = modelId || this.currentModelId;
        if (!targetId || !this.models.has(targetId)) return { error: 'Model not found' };

        const model = this.models.get(targetId);
        const graph = model.graph;

        const confirmationStats = { 0: 0, 1: 0, 2: 0, 3: 0 };
        let geometryNodes = 0;

        for (const node of graph.nodes.values()) {
            const conf = node.confirmationCount || 0;
            if (conf >= 3) confirmationStats[3]++;
            else if (conf >= 2) confirmationStats[2]++;
            else if (conf >= 1) confirmationStats[1]++;
            else confirmationStats[0]++;

            if (node.addedFrom === 'geometry_context') geometryNodes++;
        }

        const beacons = this.geometryContext.getBeacons(graph);

        return {
            id: model.id,
            name: model.metadata.name,
            stats: {
                nodes: graph.nodes.size,
                edges: graph.edges.size,
                avgDegree: graph.avgDegree || 0,
                confirmed3: confirmationStats[3],
                confirmed2: confirmationStats[2],
                confirmed1: confirmationStats[1],
                confirmed0: confirmationStats[0],
                beacons: beacons.length,
                geometryNodes: geometryNodes,
                totalGeometryRecovered: this.stats.totalGeometryRecovered
            },
            metadata: model.metadata,
            beacons: beacons.slice(0, 5), // Первые 5 маяков для отладки
            history: {
                totalActions: model.history.length,
                lastAction: model.history[model.history.length - 1]
            },
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated
        };
    }

    // 🔥 ЭКСПОРТ
    exportModel(modelId = null) {
        const targetId = modelId || this.currentModelId;
        if (!targetId || !this.models.has(targetId)) return null;

        const model = this.models.get(targetId);

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
            geometryContext: this.geometryContext.export(),
            stats: this.getModelInfo(targetId).stats,
            _version: '3.0-geometry-context',
            _exportedAt: new Date().toISOString()
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

            this.models.set(modelId, model);

            if (data.geometryContext) {
                this.geometryContext.import(data.geometryContext);
            }

            if (!this.currentModelId) this.currentModelId = modelId;

            console.log(`📥 Импортирована модель "${model.metadata.name}"`);
            console.log(`   Узлов: ${graph.nodes.size}, Рёбер: ${graph.edges.size}`);

            return true;
        } catch (error) {
            console.log(`❌ Ошибка импорта: ${error.message}`);
            return false;
        }
    }

    getStats() {
        const models = [];
        let totalNodes = 0;

        for (const [id, model] of this.models) {
            const info = this.getModelInfo(id);
            models.push({
                id,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                beacons: info.stats?.beacons || 0,
                geometryNodes: info.stats?.geometryNodes || 0
            });
            totalNodes += model.graph.nodes.size;
        }

        return {
            system: this.stats,
            models: {
                total: this.models.size,
                totalNodes,
                list: models
            }
        };
    }
}

module.exports = TopologicalAccumulator;
