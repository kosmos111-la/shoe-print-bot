// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ ЧИСТАЯ ТОПОЛОГИЯ + ГЛОБАЛЬНАЯ ТРАНСФОРМАЦИЯ + ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ

const GeometryMemory = require('./GeometryMemory');
const TransformCalculator = require('./TransformCalculator');

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;
        this.minMatchesForEnhancement = options.minMatchesForEnhancement || 3;
        this.similarityThreshold = options.similarityThreshold || 0.6;
       
        // 🔥 ГЛОБАЛЬНАЯ ТРАНСФОРМАЦИЯ
        this.transformCalculator = new TransformCalculator({ debug: this.debug });
       
        // 🔥 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ
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
            totalGeomRestored: 0,
            totalGlobalTransforms: 0,
            totalForgotten: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
       
        console.log(`🏗️ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   Порог совпадения: ${this.similarityThreshold * 100}%`);
        console.log(`   Минимум для достройки: ${this.minMatchesForEnhancement} узлов`);
        console.log(`   🔥 ГЛОБАЛЬНАЯ ТРАНСФОРМАЦИЯ: активна`);
        console.log(`   📐 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ: активна`);
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
                method: 'with_global_transform'
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
       
        const fpInfo = this.fingerprinter.getFingerprintInfo(fingerprints);
        console.log(`   Уникальных подписей: ${fpInfo.uniqueSignatures}/${fpInfo.totalNodes} (${(fpInfo.uniquenessRatio * 100).toFixed(1)}%)`);
       
        return {
            status: 'created',
            modelId: modelId,
            nodes: graph.nodes.size,
            edges: graph.edges.size,
            avgDegree: graph.avgDegree,
            message: `Создана новая модель`
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
       
        // 🔥🔥🔥 ШАГ 1: СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ
        this.saveOriginalCoordinates(model, newGraph, structuralMapping);
       
        // 🔥🔥🔥 ШАГ 2: ВЫЧИСЛЯЕМ ГЛОБАЛЬНУЮ ТРАНСФОРМАЦИЮ
        const globalTransform = this.computeGlobalTransform(model.graph, newGraph, structuralMapping);
        if (globalTransform) {
            model.globalTransform = globalTransform;
            this.stats.totalGlobalTransforms++;
        }
       
        const structurallyNewNodes = this.findStructurallyNewNodes(
            model.graph,
            newGraph,
            newFingerprints,
            structuralMapping
        );
       
        if (structurallyNewNodes.length === 0) {
            console.log(`✅ Все узлы уже в модели`);
            return { newNodesAdded: 0 };
        }
       
        console.log(`🎯 Найдено ${structurallyNewNodes.length} НОВЫХ узлов`);
       
        // 🔥🔥🔥 ШАГ 3: ДОБАВЛЯЕМ УЗЛЫ С ПРИОРИТЕТАМИ
        const addedNodes = this.addStructuralNodesWithPriority(
            modelId,
            structurallyNewNodes,
            newGraph,
            structuralMapping,
            globalTransform,
            options
        );
       
        if (addedNodes.length > 0) {
            await this.updateModelFingerprints(modelId);
        }
       
        this.increaseStructuralConfirmations(modelId, structuralMapping);
       
        model.history.push({
            action: 'enhanced',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            similarity: comparison.similarity,
            hadGlobalTransform: !!globalTransform
        });
       
        this.stats.totalEnhancements++;
        this.stats.lastUpdated = new Date();
       
        console.log(`✅ МОДЕЛЬ УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
        if (globalTransform) {
            console.log(`   🎯 Глобальная трансформация: угол ${globalTransform.angle.toFixed(1)}°, масштаб ${globalTransform.scale.toFixed(3)}`);
        }
       
        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            globalTransformApplied: !!globalTransform
        };
    }

    // 🔥🔥🔥 ВЫЧИСЛИТЬ ГЛОБАЛЬНУЮ ТРАНСФОРМАЦИЮ
    computeGlobalTransform(modelGraph, newGraph, structuralMapping) {
        console.log(`🔄 Вычисляю глобальную трансформацию...`);
       
        const pointsModel = [];
        const pointsNew = [];
       
        for (const [newNodeId, modelNodeId] of structuralMapping) {
            const modelNode = modelGraph.nodes.get(modelNodeId);
            const newNode = newGraph.nodes.get(newNodeId);
           
            if (modelNode && newNode && modelNode._hasOriginalCoordinates && newNode._hasOriginalCoordinates) {
                pointsModel.push({ x: modelNode.x, y: modelNode.y });
                pointsNew.push({ x: newNode._originalX, y: newNode._originalY });
            }
        }
       
        if (pointsModel.length < 2) {
            console.log(`   ⚠️ Недостаточно точек для трансформации: ${pointsModel.length}`);
            return null;
        }
       
        console.log(`   📊 Использую ${pointsModel.length} общих точек`);
        const transform = this.transformCalculator.computeTransformation(pointsNew, pointsModel);
       
        if (transform && transform.confidence > 0.5) {
            console.log(`   ✅ Глобальная трансформация: ошибка ${transform.error.toFixed(2)}px, уверенность ${(transform.confidence * 100).toFixed(0)}%`);
            return transform;
        }
       
        console.log(`   ⚠️ Трансформация ненадёжна: уверенность ${transform?.confidence ? (transform.confidence * 100).toFixed(0) : 0}%`);
        return null;
    }

    // 🔥🔥🔥 ДОБАВЛЕНИЕ УЗЛОВ С ПРИОРИТЕТАМИ
    addStructuralNodesWithPriority(modelId, newNodes, newGraph, structuralMapping, globalTransform, options) {
        const model = this.models.get(modelId);
        const addedNodes = [];
       
        console.log(`🔨 Добавляю ${newNodes.length} узлов с приоритетами...`);
        console.log(`   🎯 ПРИОРИТЕТ 1: Глобальная трансформация (${globalTransform ? '✅' : '❌'})`);
        console.log(`   📍 ПРИОРИТЕТ 2: Оригинальные координаты`);
        console.log(`   📐 ПРИОРИТЕТ 3: Геометрическая память`);
        console.log(`   🔗 ПРИОРИТЕТ 4: Локальные соседи`);
       
        for (const nodeInfo of newNodes) {
            const originalNodeId = nodeInfo.nodeId;
            const sourceNode = newGraph.nodes.get(originalNodeId);
            if (!sourceNode) continue;
           
            let visualizationPosition = null;
            let method = null;
            let confidence = 0;
           
            // 🔥🔥🔥 ПРИОРИТЕТ 1: ГЛОБАЛЬНАЯ ТРАНСФОРМАЦИЯ
            if (globalTransform && sourceNode._hasOriginalCoordinates) {
                const transformed = this.transformCalculator.applyTransform(
                    { x: sourceNode._originalX, y: sourceNode._originalY },
                    globalTransform
                );
               
                visualizationPosition = { x: transformed.x, y: transformed.y };
                method = `global_${globalTransform.type}`;
                confidence = globalTransform.confidence || 0.9;
               
                console.log(`   🎯 [1] ГЛОБАЛЬНАЯ ТРАНСФОРМАЦИЯ: (${visualizationPosition.x.toFixed(1)}, ${visualizationPosition.y.toFixed(1)})`);
            }
           
            // 🔥 ПРИОРИТЕТ 2: ОРИГИНАЛЬНЫЕ КООРДИНАТЫ
            if (!visualizationPosition && model.photoCoordinates?.has(originalNodeId)) {
                const coord = model.photoCoordinates.get(originalNodeId);
                visualizationPosition = { x: coord.x, y: coord.y };
                method = 'original_from_photo';
                confidence = 0.8;
               
                console.log(`   📍 [2] ОРИГИНАЛЬНЫЕ КООРДИНАТЫ: (${visualizationPosition.x.toFixed(1)}, ${visualizationPosition.y.toFixed(1)})`);
            }
           
            // 🔥 ПРИОРИТЕТ 3: ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ
            if (!visualizationPosition) {
                const reconstructed = this.geometryMemory.reconstructPosition(originalNodeId, model.graph);
                if (reconstructed) {
                    visualizationPosition = { x: reconstructed.x, y: reconstructed.y };
                    method = reconstructed.method;
                    confidence = reconstructed.confidence || 0.7;
                   
                    console.log(`   📐 [3] ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ: (${visualizationPosition.x.toFixed(1)}, ${visualizationPosition.y.toFixed(1)}) [${method}]`);
                    this.stats.totalGeomRestored++;
                }
            }
           
            // 🔥 ПРИОРИТЕТ 4: ЛОКАЛЬНЫЕ СОСЕДИ (ТОЛЬКО 2 ЛУЧШИХ!)
            const bestNeighbors = this.findBestNeighborsForPosition(
                originalNodeId,
                newGraph,
                structuralMapping,
                model.graph
            );
           
            if (!visualizationPosition) {
                visualizationPosition = this.calculateVisualizationPosition(bestNeighbors, model.graph);
                method = visualizationPosition.method;
                confidence = 0.5;
               
                console.log(`   🔗 [4] ЛОКАЛЬНЫЕ СОСЕДИ: (${visualizationPosition.x.toFixed(1)}, ${visualizationPosition.y.toFixed(1)}) [${method}]`);
            }
           
            // Запоминаем геометрию для будущего
            this.geometryMemory.rememberNodeGeometry(
                originalNodeId,
                sourceNode,
                bestNeighbors,
                newGraph.nodes,
                model.graph.nodes
            );
           
            // Создаём узел
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
                geometryMethod: method,
                geometryConfidence: confidence,
                globalTransformApplied: !!globalTransform,
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
            console.log(`     📐 метод: ${method}`);
            console.log(`     🎯 уверенность: ${(confidence * 100).toFixed(0)}%`);
           
            addedNodes.push({
                id: modelNodeId,
                x: newNode.x,
                y: newNode.y,
                confidence: newNode.confidence,
                structuralNeighbors: newNode.structuralNeighborCount,
                edgesAdded: edgesAdded,
                method: method,
                confidence: confidence
            });
        }
       
        const globalCount = addedNodes.filter(n => n.method?.startsWith('global_')).length;
        console.log(`✅ Добавлено ${addedNodes.length} узлов:`);
        console.log(`   🎯 Глобальная трансформация: ${globalCount}`);
        console.log(`   📍 Оригинальные координаты: ${addedNodes.filter(n => n.method === 'original_from_photo').length}`);
        console.log(`   📐 Геометрическая память: ${addedNodes.filter(n => n.method === 'between' || n.method === 'barycentric').length}`);
        console.log(`   🔗 Локальные соседи: ${addedNodes.filter(n => n.method === 'midpoint_of_best_pair' || n.method === 'midpoint_of_pair').length}`);
       
        return addedNodes;
    }

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
       
        console.log(`   📍 Сохранено ${saved} оригинальных координат`);
    }

    findBestNeighborsForPosition(nodeId, newGraph, structuralMapping, modelGraph) {
        const allNeighbors = [];
       
        for (const edge of newGraph.edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodeA === nodeId && structuralMapping.has(nodeB)) {
                allNeighbors.push(structuralMapping.get(nodeB));
            } else if (nodeB === nodeId && structuralMapping.has(nodeA)) {
                allNeighbors.push(structuralMapping.get(nodeA));
            }
        }
       
        if (allNeighbors.length <= 2) return allNeighbors;
       
        // Оцениваем и берём ТОЛЬКО 2 ЛУЧШИХ
        const scored = allNeighbors.map(id => {
            const node = modelGraph.nodes.get(id);
            let score = 0;
            if (node) {
                score += (node.degree || 0) * 0.1;
                score += (node.confirmationCount || 1) * 0.2;
                if (node.addedFrom === 'original_creation') score += 0.5;
            }
            return { id, score };
        });
       
        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, 2)
            .map(n => n.id);
    }

    findStructuralNeighborsInNewGraph(nodeId, newGraph, structuralMapping) {
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

    findStructurallyNewNodes(modelGraph, newGraph, newFingerprints, structuralMapping) {
        console.log(`🔍 Поиск новых узлов...`);
       
        const newNodes = [];
        const mappedIds = new Set(structuralMapping.keys());
       
        console.log(`   Узлов в новом графе: ${newGraph.nodes.size}`);
        console.log(`   Уже сопоставлено: ${mappedIds.size}`);
        console.log(`   Ожидаем новых: ${newGraph.nodes.size - mappedIds.size}`);
       
        for (const [nodeId, node] of newGraph.nodes) {
            if (mappedIds.has(nodeId)) continue;
           
            const neighbors = this.findStructuralNeighborsInNewGraph(nodeId, newGraph, structuralMapping);
           
            if (neighbors.length >= 2) {
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

    calculateVisualizationPosition(neighborIds, modelGraph) {
        if (neighborIds.length === 0) {
            return {
                x: 400 + (Math.random() - 0.5) * 200,
                y: 300 + (Math.random() - 0.5) * 200,
                method: 'random_fallback'
            };
        }
       
        if (neighborIds.length === 1) {
            const n = modelGraph.nodes.get(neighborIds[0]);
            if (n) {
                return {
                    x: n.x + (Math.random() - 0.5) * 40,
                    y: n.y + (Math.random() - 0.5) * 40,
                    method: 'single_neighbor'
                };
            }
        }
       
        if (neighborIds.length >= 2) {
            const a = modelGraph.nodes.get(neighborIds[0]);
            const b = modelGraph.nodes.get(neighborIds[1]);
            if (a && b) {
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
       
        let confirmed = 0, unconfirmed = 0, forgotten = 0;
       
        for (const [nodeId, node] of model.graph.nodes) {
            if (node.confirmationCount === undefined) node.confirmationCount = 1;
            if (node.unconfirmedStreak === undefined) node.unconfirmedStreak = 0;
           
            if (matchedNodes.has(nodeId)) {
                node.confirmationCount += 1;
                node.unconfirmedStreak = 0;
                node.lastConfirmed = new Date();
                confirmed++;
            } else {
                node.unconfirmedStreak += 1;
                unconfirmed++;
               
                if (node.unconfirmedStreak >= 10 && node.confirmationCount < 3) {
                    node.markedForDeletion = true;
                    forgotten++;
                }
            }
        }
       
        if (forgotten > 0) this.removeForgottenNodes(modelId);
       
        console.log(`📊 ДОВЕРИЕ: +${confirmed}, -${unconfirmed}, забыто: ${forgotten}`);
    }

    removeForgottenNodes(modelId) {
        const model = this.models.get(modelId);
        if (!model) return;
       
        const toRemove = [];
        for (const [id, node] of model.graph.nodes) {
            if (node.markedForDeletion) toRemove.push(id);
        }
       
        for (const id of toRemove) {
            model.graph.nodes.delete(id);
            const edgesToRemove = [];
            for (const edge of model.graph.edges) {
                if (edge.includes(id)) edgesToRemove.push(edge);
            }
            for (const edge of edgesToRemove) model.graph.edges.delete(edge);
        }
       
        if (toRemove.length > 0) {
            console.log(`🧹 Удалено ${toRemove.length} забытых узлов`);
            this.stats.totalForgotten += toRemove.length;
        }
    }

    increaseStructuralConfirmations(modelId, structuralMapping) {
        const model = this.models.get(modelId);
        if (!model) return;
       
        let count = 0;
        for (const [newId, modelId] of structuralMapping) {
            const node = model.graph.nodes.get(modelId);
            if (node) {
                node.confirmationCount += 1;
                node.unconfirmedStreak = 0;
                count++;
            }
        }
       
        console.log(`📈 Подтверждений: +${count}`);
    }

    async updateModelFingerprints(modelId) {
        const model = this.models.get(modelId);
        console.log(`🔄 Обновляю подписи...`);
       
        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;
       
        console.log(`✅ Подписи обновлены: ${newFingerprints.size} узлов`);
        return newFingerprints;
    }

    getModelInfo(modelId = null) {
        const targetId = modelId || this.currentModelId;
        if (!targetId || !this.models.has(targetId)) return { error: 'Model not found' };
       
        const model = this.models.get(targetId);
        const graph = model.graph;
        const fpInfo = this.fingerprinter.getFingerprintInfo(model.fingerprints);
       
        const confirmations = { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0 };
        const geometry = { global: 0, original: 0, between: 0, barycentric: 0, local: 0 };
       
        for (const node of graph.nodes.values()) {
            const c = node.confirmationCount || 0;
            if (c >= 4) confirmations['4+']++;
            else confirmations[c] = (confirmations[c] || 0) + 1;
           
            if (node.addedFrom === 'structural_enhancement') {
                if (node.geometryMethod?.startsWith('global_')) geometry.global++;
                else if (node.geometryMethod === 'original_from_photo') geometry.original++;
                else if (node.geometryMethod === 'between') geometry.between++;
                else if (node.geometryMethod === 'barycentric') geometry.barycentric++;
                else geometry.local++;
            }
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
                confirmed4: confirmations['4+'],
                confirmed3: confirmations[3],
                confirmed2: confirmations[2],
                confirmed1: confirmations[1],
                confirmed0: confirmations[0],
                globalTransform: geometry.global,
                originalGeometry: geometry.original,
                betweenGeometry: geometry.between,
                barycentricGeometry: geometry.barycentric,
                localGeometry: geometry.local
            },
            metadata: model.metadata,
            globalTransform: model.globalTransform,
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated
        };
    }

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
            globalTransform: model.globalTransform,
            geometryMemory: this.geometryMemory.export(),
            stats: this.getModelInfo(targetId).stats,
            _version: '4.0-global-transform',
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
                photoCoordinates: new Map(data.photoCoordinates || []),
                globalTransform: data.globalTransform
            };
           
            for (const node of graph.nodes.values()) {
                if (node.confirmationCount === undefined) node.confirmationCount = 1;
                if (node.unconfirmedStreak === undefined) node.unconfirmedStreak = 0;
                if (node.addedAt && typeof node.addedAt === 'string') node.addedAt = new Date(node.addedAt);
                if (node.firstSeen && typeof node.firstSeen === 'string') node.firstSeen = new Date(node.firstSeen);
                if (node.lastConfirmed && typeof node.lastConfirmed === 'string') node.lastConfirmed = new Date(node.lastConfirmed);
            }
           
            this.models.set(modelId, model);
           
            if (data.geometryMemory) this.geometryMemory.import(data.geometryMemory);
            if (!this.currentModelId) this.currentModelId = modelId;
           
            console.log(`📥 Импортирована модель "${model.metadata.name}"`);
            console.log(`   Узлов: ${graph.nodes.size}, Рёбер: ${graph.edges.size}`);
            if (model.globalTransform) {
                console.log(`   🎯 Глобальная трансформация: угол ${model.globalTransform.angle.toFixed(1)}°`);
            }
           
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
                uniquenessRatio: info.stats?.uniquenessRatio,
                globalTransform: !!model.globalTransform,
                confirmed3: info.stats?.confirmed3,
                confirmed2: info.stats?.confirmed2,
                confirmed1: info.stats?.confirmed1
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
