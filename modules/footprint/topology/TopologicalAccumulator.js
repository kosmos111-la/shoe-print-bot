// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ ЧИСТАЯ ТОПОЛОГИЯ + ИЕРАРХИЧЕСКАЯ ТРИАНГУЛЯЦИЯ

const GeometryMemory = require('./GeometryMemory');
const HierarchicalTriangulation = require('./HierarchicalTriangulation');
const { TrustLevelManager, TRUST_LEVELS } = require('./TrustLevel');

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;
        this.minMatchesForEnhancement = options.minMatchesForEnhancement || 3;
        this.similarityThreshold = options.similarityThreshold || 0.6;
       
        // 🔥 ИЕРАРХИЧЕСКАЯ ТРИАНГУЛЯЦИЯ (ОСНОВНОЕ!)
        this.triangulation = new HierarchicalTriangulation({ debug: this.debug });
       
        // 🔥 УПРАВЛЕНИЕ ДОВЕРИЕМ
        this.trustManager = new TrustLevelManager({ debug: this.debug });
       
        // 🔥 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ (РЕЗЕРВ)
        this.geometryMemory = new GeometryMemory({ debug: this.debug });
       
        this.topologyBuilder = new (require('./TopologyBuilder'))({ debug: this.debug });
        this.fingerprinter = new (require('./TopologicalFingerprint'))({
            debug: this.debug,
            iterations: options.wlIterations || 3,
            bucketSize: 3,
            similarityThreshold: 0.7
        });
       
        this.models = new Map();
        this.currentModelId = null;
       
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalPointsProcessed: 0,
            totalTriangulated: 0,
            totalBeacons: 0,
            totalForgotten: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
       
        console.log(`🏗️ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   🔺 ИЕРАРХИЧЕСКАЯ ТРИАНГУЛЯЦИЯ: активна (основной метод)`);
        console.log(`   🎯 МАЯКИ: 3+ подтверждений (абсолютные опоры)`);
        console.log(`   📐 Геометрическая память: резервный метод`);
    }

    async processPoints(points, options = {}) {
        if (this.debug) console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК...`);
       
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
                triangulatedNodes: enhancementResult.triangulated || 0,
                message: `Модель улучшена (+${enhancementResult.newNodesAdded} узлов)`,
                method: 'hierarchical_triangulation'
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

    createNewModel(graph, fingerprints, originalPoints, options = {}) {
        const modelId = `topo_model_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
       
        const model = {
            id: modelId,
            graph: graph,
            fingerprints: fingerprints,
            originalPoints: originalPoints,
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
                edges: graph.edges.size
            }]
        };
       
        // Все новые узлы получают уровень NEW
        for (const node of model.graph.nodes.values()) {
            node.confirmationCount = 1;
            node.unconfirmedStreak = 0;
            node.addedFrom = 'original_creation';
            node.addedAt = new Date();
            node.firstSeen = new Date();
            node.trustLevel = this.trustManager.getTrustLevel(node);
        }
       
        this.models.set(modelId, model);
        this.currentModelId = modelId;
        this.stats.totalModels++;
        this.stats.lastUpdated = new Date();
       
        console.log(`🏗️ СОЗДАНА НОВАЯ МОДЕЛЬ "${modelId}":`);
        console.log(`   Узлов: ${graph.nodes.size} (все с confirmationCount=1)`);
        console.log(`   Уникальных подписей: ${fingerprints ? this.fingerprinter.getFingerprintInfo(fingerprints).uniqueSignatures : '?'}/${graph.nodes.size}`);
       
        return {
            status: 'created',
            modelId: modelId,
            nodes: graph.nodes.size,
            edges: graph.edges.size,
            avgDegree: graph.avgDegree
        };
    }

    async enhanceModelStructural(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`🔧 УЛУЧШЕНИЕ МОДЕЛИ "${modelId}"...`);
       
        const model = this.models.get(modelId);
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
       
        if (allMatches.length < this.minMatchesForEnhancement) {
            return { newNodesAdded: 0, reason: 'insufficient_matches' };
        }
       
        const structuralMapping = this.createStructuralMapping(
            model.fingerprints,
            newFingerprints,
            allMatches
        );
       
        console.log(`🗺️ Создан структурный маппинг: ${structuralMapping.size} соответствий`);
       
        // Сохраняем оригинальные координаты
        this.saveOriginalCoordinates(model, newGraph, structuralMapping);
       
        // Находим новые узлы
        const newNodes = this.findNewNodes(
            model.graph,
            newGraph,
            newFingerprints,
            structuralMapping
        );
       
        if (newNodes.length === 0) {
            console.log(`✅ Все узлы уже в модели`);
            return { newNodesAdded: 0 };
        }
       
        console.log(`🎯 Найдено ${newNodes.length} НОВЫХ узлов`);
       
        // 🔥🔥🔥 ДОБАВЛЯЕМ УЗЛЫ ЧЕРЕЗ ИЕРАРХИЧЕСКУЮ ТРИАНГУЛЯЦИЮ
        const addedNodes = this.addNodesViaTriangulation(
            modelId,
            newNodes,
            newGraph,
            structuralMapping,
            options
        );
       
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }
       
        // Увеличиваем подтверждения для совпавших узлов
        this.increaseConfirmations(modelId, structuralMapping);
       
        // Подсчитываем маяки
        const beacons = this.trustManager.getBeacons(model.graph);
        this.stats.totalBeacons = beacons.length;
       
        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            triangulated: addedNodes.filter(n => n.method === 'hierarchical_triangulation').length,
            beacons: beacons.length,
            similarity: comparison.similarity
        });
       
        this.stats.totalEnhancements++;
        this.stats.totalTriangulated += addedNodes.filter(n => n.method === 'hierarchical_triangulation').length;
        this.stats.lastUpdated = new Date();
       
        console.log(`✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
        console.log(`   🔺 По триангуляции: ${addedNodes.filter(n => n.method === 'hierarchical_triangulation').length}`);
        console.log(`   🎯 Маяков в модели: ${beacons.length}`);
       
        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            triangulated: addedNodes.filter(n => n.method === 'hierarchical_triangulation').length
        };
    }

    // 🔥🔥🔥 ГЛАВНЫЙ МЕТОД - ДОБАВЛЕНИЕ ЧЕРЕЗ ТРИАНГУЛЯЦИЮ
    addNodesViaTriangulation(modelId, newNodes, newGraph, structuralMapping, options) {
        const model = this.models.get(modelId);
        const addedNodes = [];
       
        console.log(`🔺 Добавляю ${newNodes.length} узлов через иерархическую триангуляцию...`);
       
        // Сначала пробуем восстановить каждый узел через треугольники
        for (const nodeInfo of newNodes) {
            const originalNodeId = nodeInfo.nodeId;
            const sourceNode = newGraph.nodes.get(originalNodeId);
            if (!sourceNode) continue;
           
            let position = null;
            let method = null;
            let confidence = 0;
           
            // 🔥🔥🔥 ПРИОРИТЕТ 1: ВОССТАНОВЛЕНИЕ ПО ТРЕУГОЛЬНИКУ ИЗ МАЯКОВ
            const triangle = this.triangulation.rememberTriangle(
                originalNodeId,
                sourceNode,
                newGraph,
                structuralMapping,
                model.graph
            );
           
            if (triangle) {
                const reconstructed = this.triangulation.reconstructPosition(originalNodeId, model.graph);
                if (reconstructed) {
                    position = { x: reconstructed.x, y: reconstructed.y };
                    method = 'hierarchical_triangulation';
                    confidence = reconstructed.confidence;
                }
            }
           
            // 🔥 ПРИОРИТЕТ 2: ОРИГИНАЛЬНЫЕ КООРДИНАТЫ (если есть)
            if (!position && model.photoCoordinates?.has(originalNodeId)) {
                const coord = model.photoCoordinates.get(originalNodeId);
                position = { x: coord.x, y: coord.y };
                method = 'original_coordinates';
                confidence = 0.8;
                console.log(`   📍 Оригинальные координаты: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
            }
           
            // 🔥 ПРИОРИТЕТ 3: ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ (резерв)
            if (!position) {
                const reconstructed = this.geometryMemory.reconstructPosition(originalNodeId, model.graph);
                if (reconstructed) {
                    position = { x: reconstructed.x, y: reconstructed.y };
                    method = reconstructed.method;
                    confidence = reconstructed.confidence || 0.6;
                    console.log(`   📐 Геометрическая память: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
                    this.stats.totalGeomRestored = (this.stats.totalGeomRestored || 0) + 1;
                }
            }
           
            // 🔥 ПОСЛЕДНИЙ ШАНС: центр масс ближайших соседей
            if (!position) {
                const neighbors = this.getClosestNeighbors(originalNodeId, newGraph, structuralMapping, model.graph);
                position = this.calculateFallbackPosition(neighbors, model.graph);
                method = 'fallback_centroid';
                confidence = 0.4;
                console.log(`   ⚠️ Запасной метод: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
            }
           
            // Создаём узел в модели
            const modelNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
           
            const newNode = {
                id: modelNodeId,
                originalId: originalNodeId,
                degree: 0,
                confirmationCount: 1,
                unconfirmedStreak: 0,
                addedFrom: 'enhancement',
                addedAt: new Date(),
                firstSeen: new Date(),
                x: position.x,
                y: position.y,
                confidence: sourceNode.confidence || 0.5,
                placementMethod: method,
                placementConfidence: confidence,
                triangleMemory: !!triangle,
                originalData: {
                    x: sourceNode._originalX || sourceNode.x,
                    y: sourceNode._originalY || sourceNode.y,
                    confidence: sourceNode.confidence
                }
            };
           
            model.graph.nodes.set(modelNodeId, newNode);
           
            // Добавляем связи с ближайшими соседями
            let edgesAdded = 0;
            const neighbors = this.getClosestNeighbors(originalNodeId, newGraph, structuralMapping, model.graph);
           
            for (const neighborId of neighbors.slice(0, 3)) {
                if (model.graph.nodes.has(neighborId)) {
                    const edge = [modelNodeId, neighborId].sort().join('--');
                    model.graph.edges.add(edge);
                    edgesAdded++;
                    newNode.degree++;
                    model.graph.nodes.get(neighborId).degree++;
                }
            }
           
            console.log(`   + ${modelNodeId.substring(0, 20)}...`);
            console.log(`     📍 метод: ${method} (${(confidence * 100).toFixed(0)}%)`);
            console.log(`     🔗 связей: ${edgesAdded}`);
           
            addedNodes.push({
                id: modelNodeId,
                x: newNode.x,
                y: newNode.y,
                method: method,
                confidence: confidence,
                edgesAdded: edgesAdded
            });
        }
       
        console.log(`✅ Добавлено ${addedNodes.length} узлов:`);
        console.log(`   🔺 Триангуляция: ${addedNodes.filter(n => n.method === 'hierarchical_triangulation').length}`);
        console.log(`   📍 Оригинальные: ${addedNodes.filter(n => n.method === 'original_coordinates').length}`);
        console.log(`   📐 Геометрия: ${addedNodes.filter(n => n.method === 'between' || n.method === 'barycentric').length}`);
        console.log(`   ⚠️ Запасные: ${addedNodes.filter(n => n.method === 'fallback_centroid').length}`);
       
        return addedNodes;
    }

    // 🔥 ПОЛУЧИТЬ БЛИЖАЙШИХ СОСЕДЕЙ
    getClosestNeighbors(nodeId, newGraph, structuralMapping, modelGraph) {
        const neighbors = [];
        const newNode = newGraph.nodes.get(nodeId);
       
        for (const edge of newGraph.edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodeA === nodeId && structuralMapping.has(nodeB)) {
                neighbors.push({
                    id: structuralMapping.get(nodeB),
                    distance: this.distance(newNode, newGraph.nodes.get(nodeB))
                });
            } else if (nodeB === nodeId && structuralMapping.has(nodeA)) {
                neighbors.push({
                    id: structuralMapping.get(nodeA),
                    distance: this.distance(newNode, newGraph.nodes.get(nodeA))
                });
            }
        }
       
        return neighbors
            .sort((a, b) => a.distance - b.distance)
            .map(n => n.id);
    }

    // 🔥 ЗАПАСНОЙ МЕТОД - ЦЕНТР МАСС
    calculateFallbackPosition(neighborIds, modelGraph) {
        if (neighborIds.length === 0) {
            return {
                x: 400 + (Math.random() - 0.5) * 200,
                y: 300 + (Math.random() - 0.5) * 200
            };
        }
       
        let sumX = 0, sumY = 0, count = 0;
        for (const id of neighborIds.slice(0, 3)) {
            const node = modelGraph.nodes.get(id);
            if (node) {
                sumX += node.x;
                sumY += node.y;
                count++;
            }
        }
       
        if (count > 0) {
            return {
                x: sumX / count + (Math.random() - 0.5) * 20,
                y: sumY / count + (Math.random() - 0.5) * 20
            };
        }
       
        return {
            x: 400 + (Math.random() - 0.5) * 200,
            y: 300 + (Math.random() - 0.5) * 200
        };
    }

    // 🔥 РАССТОЯНИЕ
    distance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 🔥 ПОИСК НОВЫХ УЗЛОВ
    findNewNodes(modelGraph, newGraph, newFingerprints, structuralMapping) {
        console.log(`🔍 Поиск новых узлов...`);
       
        const newNodes = [];
        const mappedIds = new Set(structuralMapping.keys());
       
        for (const [nodeId, node] of newGraph.nodes) {
            if (mappedIds.has(nodeId)) continue;
           
            const neighbors = this.findStructuralNeighbors(nodeId, newGraph, structuralMapping);
           
            if (neighbors.length >= 3) { // Нужно минимум 3 соседа для треугольника
                newNodes.push({
                    nodeId: nodeId,
                    nodeData: node,
                    structuralNeighbors: neighbors,
                    neighborCount: neighbors.length
                });
                console.log(`   ✓ Новый узел: ${nodeId.substring(0, 25)}... (${neighbors.length} соседей)`);
            }
        }
       
        console.log(`🎯 Найдено ${newNodes.length} НОВЫХ узлов`);
        return newNodes;
    }

    // 🔥 ПОИСК СОСЕДЕЙ В МАППИНГЕ
    findStructuralNeighbors(nodeId, newGraph, structuralMapping) {
        const neighbors = [];
        for (const edge of newGraph.edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodeA === nodeId && structuralMapping.has(nodeB)) {
                neighbors.push(structuralMapping.get(nodeB));
            } else if (nodeB === nodeId && structuralMapping.has(nodeA)) {
                neighbors.push(structuralMapping.get(nodeA));
            }
        }
        return neighbors;
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
                const isExact = modelFp.signature === newFp.signature;
                const isSimilar = match.confidence > 0.8;
               
                if (isExact || isSimilar) {
                    if (!usedModelNodes.has(modelNodeId)) {
                        mapping.set(newNodeId, modelNodeId);
                        usedModelNodes.add(modelNodeId);
                    }
                }
            }
        }
       
        return mapping;
    }

    // 🔥 СОХРАНЕНИЕ ОРИГИНАЛЬНЫХ КООРДИНАТ
    saveOriginalCoordinates(model, newGraph, structuralMapping) {
        if (!model.photoCoordinates) model.photoCoordinates = new Map();
       
        let saved = 0;
        for (const [newNodeId, modelNodeId] of structuralMapping) {
            const node = newGraph.nodes.get(newNodeId);
            if (node && node._hasOriginalCoordinates) {
                model.photoCoordinates.set(newNodeId, {
                    x: node._originalX,
                    y: node._originalY,
                    confidence: node.confidence || 0.5
                });
                saved++;
            }
        }
       
        if (saved > 0) console.log(`   📍 Сохранено ${saved} оригинальных координат`);
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
       
        let promoted = 0, demoted = 0, ghosts = 0;
       
        for (const [nodeId, node] of model.graph.nodes) {
            if (matchedNodes.has(nodeId)) {
                const oldLevel = this.trustManager.getTrustLevel(node).level;
                const newLevel = this.trustManager.promote(node).level;
                if (newLevel > oldLevel) promoted++;
            } else {
                this.trustManager.demote(node);
                demoted++;
            }
        }
       
        // Удаляем призраков
        const ghostsIds = this.trustManager.cleanupGhosts(model.graph);
        for (const id of ghostsIds) {
            model.graph.nodes.delete(id);
            ghosts++;
        }
       
        if (ghosts > 0) this.stats.totalForgotten += ghosts;
       
        console.log(`📊 ДОВЕРИЕ: +${promoted} повышений, -${demoted} понижений, 👻 ${ghosts} призраков`);
    }

    // 🔥 УВЕЛИЧЕНИЕ ПОДТВЕРЖДЕНИЙ
    increaseConfirmations(modelId, structuralMapping) {
        const model = this.models.get(modelId);
        if (!model) return;
       
        let count = 0;
        for (const [newId, modelId] of structuralMapping) {
            const node = model.graph.nodes.get(modelId);
            if (node) {
                this.trustManager.promote(node);
                count++;
            }
        }
       
        console.log(`📈 Подтверждений: +${count}`);
    }

    // 🔥 ОБНОВЛЕНИЕ ПОДПИСЕЙ
    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
        console.log(`🔄 Обновляю подписи...`);
       
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
        const fpInfo = this.fingerprinter.getFingerprintInfo(model.fingerprints);
       
        let beacons = 0, stable = 0, confirmed = 0, fading = 0, ghosts = 0;
       
        for (const node of graph.nodes.values()) {
            const level = this.trustManager.getTrustLevel(node);
            if (level.level === TRUST_LEVELS.BEACON) beacons++;
            else if (level.level === TRUST_LEVELS.STABLE) stable++;
            else if (level.level === TRUST_LEVELS.CONFIRMED) confirmed++;
            else if (level.level === TRUST_LEVELS.FADING) fading++;
            else if (level.level === TRUST_LEVELS.GHOST) ghosts++;
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
                beacons: beacons,
                stable: stable,
                confirmed: confirmed,
                fading: fading,
                ghosts: ghosts,
                triangulated: this.stats.totalTriangulated
            },
            metadata: model.metadata,
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated
        };
    }

    // 🔥 ЭКСПОРТ/ИМПОРТ
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
            photoCoordinates: model.photoCoordinates ? Array.from(model.photoCoordinates.entries()) : [],
            triangulationMemory: this.triangulation.export(),
            geometryMemory: this.geometryMemory.export(),
            stats: this.getModelInfo(targetId).stats,
            _version: '5.0-hierarchical-triangulation',
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
           
            this.models.set(modelId, model);
           
            if (data.triangulationMemory) {
                this.triangulation.import(data.triangulationMemory);
            }
           
            if (data.geometryMemory) {
                this.geometryMemory.import(data.geometryMemory);
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
                triangulated: info.stats?.triangulated || 0
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
