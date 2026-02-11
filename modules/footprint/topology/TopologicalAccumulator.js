// modules/footprint/topology/TopologicalAccumulator.js
// 🏗️ ЧИСТАЯ ТОПОЛОГИЯ С ДИНАМИЧЕСКОЙ СИСТЕМОЙ ДОВЕРИЯ

class TopologicalAccumulator {
    constructor(options = {}) {
        this.name = options.name || `Топологическая_модель_${Date.now()}`;
        this.debug = options.debug || false;
        this.minMatchesForEnhancement = options.minMatchesForEnhancement || 3;
        this.similarityThreshold = options.similarityThreshold || 0.6;
      
        // 🔥 СИСТЕМА ДОВЕРИЯ
        this.trustConfig = options.trustConfig || {
            FORGET_AFTER: 10,     // забыть после 10 неподтверждений
            HIDE_AFTER: 5,        // скрыть после 5 неподтверждений
            DEGRADE_AFTER: 3,     // понизить уровень после 3 неподтверждений
            PROMOTE_AT: 2,        // повысить уровень при 2 подтверждениях
            CORE_AT: 4,           // ядро при 4+ подтверждениях
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
      
        // Хранилище моделей
        this.models = new Map(); // modelId -> { graph, fingerprints, metadata }
        this.currentModelId = null;
      
        // Статистика
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            totalPointsProcessed: 0,
            totalNodesForgotten: 0,
            totalNodesResurrected: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
      
        console.log(`🏗️ TopologicalAccumulator создан: "${this.name}"`);
        console.log(`   Порог совпадения: ${this.similarityThreshold * 100}%`);
        console.log(`   Минимум для достройки: ${this.minMatchesForEnhancement} узлов`);
        console.log(`   🎯 ФИЛОСОФИЯ: Чистая топология, координаты только для визуализации`);
        console.log(`   🔥 ДОВЕРИЕ: Динамическая система с затуханием`);
        console.log(`      Забыть после: ${this.trustConfig.FORGET_AFTER} неподтверждений`);
        console.log(`      Скрыть после: ${this.trustConfig.HIDE_AFTER} неподтверждений`);
    }
  
    // 🔥 ГЛАВНЫЙ МЕТОД: Обработка точек (чистая топология + доверие)
    async processPoints(points, options = {}) {
        console.log(`\n🎯 ОБРАБОТКА ${points.length} ТОЧЕК (ЧИСТАЯ ТОПОЛОГИЯ + ДОВЕРИЕ)...`);
      
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
      
        // 🔥 5. ПРИМЕНЯЕМ СИСТЕМУ ДОВЕРИЯ ПЕРЕД РЕШЕНИЕМ
        this.applyTrustSystem(modelId, comparison, graph, fingerprints);
      
        // 🔥 6. Принимаем решение на основе СТРУКТУРНОГО сходства
        if (comparison.similarity >= this.similarityThreshold) {
            console.log(`✅ СТРУКТУРНОЕ СОВПАДЕНИЕ: ${(comparison.similarity * 100).toFixed(1)}% ≥ ${this.similarityThreshold * 100}%`);
          
            // 🔥 7. Улучшаем модель (структурное улучшение)
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
                method: 'pure_topological_enhancement_with_trust'
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
  
    // 🔥 ПРИМЕНЕНИЕ СИСТЕМЫ ДОВЕРИЯ К МОДЕЛИ
    applyTrustSystem(modelId, comparison, newGraph, newFingerprints) {
        const model = this.models.get(modelId);
        if (!model) return;
      
        console.log(`🔍 ПРИМЕНЯЮ СИСТЕМУ ДОВЕРИЯ к модели ${modelId}...`);
      
        const matchedNodes = new Set();
        const allMatches = comparison.allMatches || comparison.exactMatches || [];
      
        // 🔥 1. ОТМЕЧАЕМ СОВПАВШИЕ УЗЛЫ
        for (const match of allMatches) {
            if (match.node1 && model.graph.nodes.has(match.node1)) {
                matchedNodes.add(match.node1);
            }
        }
      
        // 🔥 2. ОБРАБАТЫВАЕМ ВСЕ УЗЛЫ МОДЕЛИ
        let confirmedCount = 0;
        let unconfirmedCount = 0;
        let hiddenCount = 0;
        let forgottenCount = 0;
      
        for (const [nodeId, node] of model.graph.nodes) {
            // 🔥 ГАРАНТИРУЕМ ПАРАМЕТРЫ ДОВЕРИЯ
            if (node.confirmationCount === undefined) node.confirmationCount = 1;
            if (node.unconfirmedStreak === undefined) node.unconfirmedStreak = 0;
          
            if (matchedNodes.has(nodeId)) {
                // 🔥 УЗЕЛ ПОДТВЕРЖДЁН В ТЕКУЩЕМ ФОТО
                node.confirmationCount += 1;
                node.unconfirmedStreak = 0; // Сбрасываем счётчик неподтверждений
                node.lastConfirmed = new Date();
                confirmedCount++;
              
                if (this.debug && node.confirmationCount >= this.trustConfig.CORE_AT) {
                    console.log(`   ✅ Узел ${nodeId.substring(0, 20)}... стал ЯДРОМ (${node.confirmationCount} подтверждений)`);
                }
            } else {
                // 🔥 УЗЕЛ НЕ ПОДТВЕРЖДЁН В ТЕКУЩЕМ ФОТО
                node.unconfirmedStreak += 1;
                unconfirmedCount++;
              
                // 🔥 ПРОВЕРЯЕМ НУЖНО ЛИ УМЕНЬШИТЬ УРОВЕНЬ ДОВЕРИЯ
                if (node.unconfirmedStreak >= this.trustConfig.DEGRADE_AFTER && node.confirmationCount > 0) {
                    // Постепенное уменьшение доверия
                    if (this.debug) {
                        console.log(`   ⬇️ Узел ${nodeId.substring(0, 20)}... теряет доверие (неподтверждений: ${node.unconfirmedStreak})`);
                    }
                }
              
                // 🔥 ПРОВЕРЯЕМ НУЖНО ЛИ СКРЫТЬ
                if (node.unconfirmedStreak >= this.trustConfig.HIDE_AFTER) {
                    hiddenCount++;
                    if (this.debug) {
                        console.log(`   🙈 Узел ${nodeId.substring(0, 20)}... скрыт (неподтверждений: ${node.unconfirmedStreak})`);
                    }
                }
              
                // 🔥 ПРОВЕРЯЕМ НУЖНО ЛИ ЗАБЫТЬ
                if (node.unconfirmedStreak >= this.trustConfig.FORGET_AFTER) {
                    // Помечаем для удаления (удалим позже)
                    node.markedForDeletion = true;
                    forgottenCount++;
                    this.stats.totalNodesForgotten++;
                  
                    console.log(`   💀 Узел ${nodeId.substring(0, 20)}... помечен для удаления`);
                }
            }
        }
      
        // 🔥 3. УДАЛЯЕМ ЗАБЫТЫЕ УЗЛЫ
        if (forgottenCount > 0) {
            this.removeForgottenNodes(modelId);
        }
      
        console.log(`📊 СИСТЕМА ДОВЕРИЯ:`);
        console.log(`   Подтверждено узлов: ${confirmedCount}`);
        console.log(`   Не подтверждено: ${unconfirmedCount}`);
        console.log(`   Скрыто: ${hiddenCount}`);
        console.log(`   Забыто: ${forgottenCount}`);
      
        return {
            confirmed: confirmedCount,
            unconfirmed: unconfirmedCount,
            hidden: hiddenCount,
            forgotten: forgottenCount
        };
    }
  
    // 🔥 УДАЛЕНИЕ ЗАБЫТЫХ УЗЛОВ
    removeForgottenNodes(modelId) {
        const model = this.models.get(modelId);
        if (!model) return;
      
        const nodesToRemove = [];
      
        for (const [nodeId, node] of model.graph.nodes) {
            if (node.markedForDeletion ||
                (node.unconfirmedStreak >= this.trustConfig.FORGET_AFTER &&
                 node.confirmationCount < this.trustConfig.CORE_AT)) {
                nodesToRemove.push(nodeId);
            }
        }
      
        if (nodesToRemove.length > 0) {
            console.log(`🧹 Удаляю ${nodesToRemove.length} забытых узлов...`);
          
            for (const nodeId of nodesToRemove) {
                // Удаляем узел
                model.graph.nodes.delete(nodeId);
              
                // Удаляем связанные рёбра
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
              
                if (this.debug) {
                    console.log(`   🗑️ Удалён узел ${nodeId.substring(0, 20)}...`);
                }
            }
          
            // Обновляем степени оставшихся узлов
            this.updateNodeDegrees(model.graph);
          
            console.log(`✅ Удалено ${nodesToRemove.length} забытых узлов`);
        }
    }
  
    // 🔥 СОЗДАНИЕ НОВОЙ МОДЕЛИ (с системой доверия)
    createNewModel(graph, fingerprints, originalPoints, options = {}) {
        const modelId = `topo_model_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
        // 🔥 СОХРАНЯЕМ КООРДИНАТЫ ТОЛЬКО ДЛЯ ВИЗУАЛИЗАЦИИ
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
                method: 'pure_topology_with_trust'
            }]
        };
      
        // 🔥 ИНИЦИАЛИЗИРУЕМ СИСТЕМУ ДОВЕРИЯ ДЛЯ ВСЕХ УЗЛОВ
        for (const node of model.graph.nodes.values()) {
            node.confirmationCount = 1; // 🔥 ПЕРВОЕ ПОДТВЕРЖДЕНИЕ
            node.unconfirmedStreak = 0; // 🔥 НУЛЕВОЙ СЧЁТЧИК НЕПОДТВЕРЖДЕНИЙ
            node.addedFrom = 'original_creation';
            node.addedAt = new Date();
            node.firstSeen = new Date();
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
        console.log(`   🛡️ Инициализирована система доверия для всех узлов`);
      
        return {
            status: 'created',
            modelId: modelId,
            nodes: graph.nodes.size,
            edges: graph.edges.size,
            avgDegree: graph.avgDegree,
            message: `Создана новая чисто топологическая модель с системой доверия`
        };
    }
  
    // 🔥 СТРУКТУРНОЕ УЛУЧШЕНИЕ МОДЕЛИ (с доверием)
    async enhanceModelStructural(modelId, newGraph, newFingerprints, comparison, options = {}) {
        console.log(`🔧 СТРУКТУРНОЕ УЛУЧШЕНИЕ МОДЕЛИ "${modelId}" с системой доверия...`);
      
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
      
        // 🔥 ДОБАВЛЯЕМ СТРУКТУРНО НОВЫЕ УЗЛЫ С СИСТЕМОЙ ДОВЕРИЯ
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
            action: 'enhanced_structural_with_trust',
            timestamp: new Date(),
            newNodes: addedNodes.length,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            similarity: comparison.similarity,
            source: options.source || 'unknown',
            method: 'pure_topological_enhancement_with_trust_system'
        });
      
        this.stats.totalEnhancements++;
        this.stats.lastUpdated = new Date();
      
        console.log(`✅ МОДЕЛЬ СТРУКТУРНО УЛУЧШЕНА: +${addedNodes.length} узлов, всего ${model.graph.nodes.size} узлов`);
      
        return {
            newNodesAdded: addedNodes.length,
            addedNodes: addedNodes,
            totalNodes: model.graph.nodes.size,
            structuralMatches: structuralMapping.size,
            trustApplied: true
        };
    }
  
    // 🔥 ДОБАВЛЕНИЕ СТРУКТУРНЫХ УЗЛОВ В МОДЕЛЬ (с доверием)
    addStructuralNodesToModel(modelId, newNodes, newGraph, structuralMapping, options) {
        const model = this.models.get(modelId);
        const addedNodes = [];
      
        console.log(`🔨 Добавляю ${newNodes.length} структурно новых узлов с системой доверия...`);
      
        for (const nodeInfo of newNodes) {
            const originalNodeId = nodeInfo.nodeId;
            const sourceNode = nodeInfo.nodeData;
          
            // 🔥 СОЗДАЕМ УНИКАЛЬНЫЙ ID ДЛЯ МОДЕЛИ
            const modelNodeId = `structural_node_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
          
            // 🔥 ВЫЧИСЛЯЕМ ВИЗУАЛИЗАЦИОННУЮ ПОЗИЦИЮ
            const visualizationPosition = this.calculateVisualizationPosition(
                nodeInfo.structuralNeighbors,
                model.graph
            );
          
            // 🔥 СОЗДАЕМ УЗЕЛ МОДЕЛИ С СИСТЕМОЙ ДОВЕРИЯ
            const newNode = {
                // 🔴 СТРУКТУРНЫЕ ДАННЫЕ
                id: modelNodeId,
                originalId: originalNodeId,
                degree: 0,
              
                // 🟡 СИСТЕМА ДОВЕРИЯ
                confirmationCount: 1, // 🔥 ПЕРВОЕ ПОДТВЕРЖДЕНИЕ!
                unconfirmedStreak: 0, // 🔥 НУЛЕВОЙ СЧЁТЧИК НЕПОДТВЕРЖДЕНИЙ
                addedFrom: 'structural_enhancement',
                addedAt: new Date(),
                firstSeen: new Date(),
              
                // 🟢 ВИЗУАЛИЗАЦИОННЫЕ КООРДИНАТЫ (ОБЯЗАТЕЛЬНО!)
                x: visualizationPosition.x,
                y: visualizationPosition.y,
                confidence: sourceNode.confidence || 0.5,
              
                // 🔵 СТРУКТУРНАЯ ИНФОРМАЦИЯ
                structuralNeighbors: nodeInfo.structuralNeighbors,
                structuralNeighborCount: nodeInfo.neighborCount,
                enhancementReason: nodeInfo.reason,
                visualizationMethod: visualizationPosition.method,
              
                // 🟣 ОРИГИНАЛЬНЫЕ ДАННЫЕ
                originalData: {
                    x: sourceNode.x !== undefined ? sourceNode.x : visualizationPosition.x,
                    y: sourceNode.y !== undefined ? sourceNode.y : visualizationPosition.y,
                    confidence: sourceNode.confidence,
                    source: sourceNode.source || 'structural_enhancement'
                }
            };
          
            console.log(`   + ${modelNodeId}:`);
            console.log(`      визуализационная позиция: (${newNode.x.toFixed(1)}, ${newNode.y.toFixed(1)})`);
            console.log(`      подтверждений: ${newNode.confirmationCount}`);
            console.log(`      система доверия: активна`);
          
            // 🔥 ДОБАВЛЯЕМ УЗЕЛ В МОДЕЛЬ
            model.graph.nodes.set(modelNodeId, newNode);
          
            // 🔥 ДОБАВЛЯЕМ СТРУКТУРНЫЕ СВЯЗИ
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
                visualizationMethod: visualizationPosition.method,
                trustInitialized: true
            });
        }
      
        console.log(`✅ Добавлено ${addedNodes.length} структурно новых узлов с системой доверия`);
      
        return addedNodes;
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
              
                // 🔥 ОБНОВЛЯЕМ СИСТЕМУ ДОВЕРИЯ
                if (node.confirmationCount === undefined || node.confirmationCount === null) {
                    node.confirmationCount = 2; // 1 от создания + 1 от совпадения
                    node.unconfirmedStreak = 0; // Сбрасываем счётчик
                    createdCount++;
                    console.log(`   🆕 Инициализирована система доверия для узла ${modelNodeId.substring(0, 20)}...`);
                } else {
                    node.confirmationCount += 1;
                    node.unconfirmedStreak = 0; // 🔥 ВАЖНО: сбрасываем при подтверждении!
                    increasedCount++;
                  
                    if (this.debug) {
                        console.log(`   📈 Узел ${modelNodeId.substring(0, 20)}...: ${node.confirmationCount-1} → ${node.confirmationCount} (неподтверждений: 0)`);
                    }
                }
              
                node.lastConfirmed = new Date();
            }
        }
      
        console.log(`📈 Увеличены подтверждения: ${increasedCount} узлов, создано: ${createdCount}`);
      
        // 🔥 СТАТИСТИКА ПОСЛЕ УЛУЧШЕНИЯ
        const confirmationStats = { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0 };
        const streakStats = { 0: 0, '1-2': 0, '3-4': 0, '5+': 0 };
      
        for (const node of model.graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmationStats['4+']++;
            else confirmationStats[count] = (confirmationStats[count] || 0) + 1;
          
            const streak = node.unconfirmedStreak || 0;
            if (streak >= 5) streakStats['5+']++;
            else if (streak >= 3) streakStats['3-4']++;
            else if (streak >= 1) streakStats['1-2']++;
            else streakStats[0]++;
        }
      
        console.log(`📊 Статистика системы доверия после улучшения:`);
        console.log(`   Подтверждения: 0=${confirmationStats[0]}, 1=${confirmationStats[1]}, 2=${confirmationStats[2]}, 3=${confirmationStats[3]}, 4+=${confirmationStats['4+']}`);
        console.log(`   Неподтверждения подряд: 0=${streakStats[0]}, 1-2=${streakStats['1-2']}, 3-4=${streakStats['3-4']}, 5+=${streakStats['5+']}`);
    }
  
    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ (аналогично предыдущей версии, но с доверием)
    createStructuralMapping(modelFingerprints, newFingerprints, matches) {
        console.log(`🗺️ Создание структурного маппинга с доверием...`);
      
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
      
        console.log(`✅ Создан структурный маппинг: ${mapping.size} соответствий`);
        return mapping;
    }
  
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
      
        console.log(`🎯 Найдено ${newNodes.length} структурно новых узлов`);
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
                method: `average_of_${count}_neighbors_with_offset`
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
      
        console.log(`🔄 Обновляю структурные подписи для модели ${modelId}...`);
      
        const newFingerprints = this.fingerprinter.computeGraphFingerprints(model.graph);
        model.fingerprints = newFingerprints;
      
        console.log(`✅ Структурные подписи обновлены: ${newFingerprints.size} узлов`);
      
        return newFingerprints;
    }
  
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
      
        // Статистика по системе доверия
        const confirmationStats = { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0 };
        const streakStats = { 0: 0, '1-2': 0, '3-4': 0, '5+': 0 };
        const trustStatus = { core: 0, stable: 0, confirmed: 0, newish: 0, fading: 0, hidden: 0, forgotten: 0 };
      
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmationStats['4+']++;
            else confirmationStats[count] = (confirmationStats[count] || 0) + 1;
          
            const streak = node.unconfirmedStreak || 0;
            if (streak >= 5) streakStats['5+']++;
            else if (streak >= 3) streakStats['3-4']++;
            else if (streak >= 1) streakStats['1-2']++;
            else streakStats[0]++;
          
            // Классификация по доверию
            if (streak >= this.trustConfig.FORGET_AFTER) trustStatus.forgotten++;
            else if (streak >= this.trustConfig.HIDE_AFTER) trustStatus.hidden++;
            else if (count >= 4 && streak === 0) trustStatus.core++;
            else if (count >= 3 && streak < 2) trustStatus.stable++;
            else if (count >= 2 && streak < 3) trustStatus.confirmed++;
            else if (count >= 1 && streak < 4) trustStatus.newish++;
            else trustStatus.fading++;
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
                confirmationStats: confirmationStats,
                streakStats: streakStats,
                trustStatus: trustStatus
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
            version: '2.1-dynamic-trust'
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
      
        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ ТОПОЛОГИЧЕСКОЙ МОДЕЛИ "${model.metadata.name}" (с доверием):`);
        console.log(`═`.repeat(80));
      
        console.log(`📊 СТРУКТУРНАЯ ИНФОРМАЦИЯ:`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Треугольников: ${model.metadata.triangleCount || 0}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);
      
        // Статистика системы доверия
        const confirmationStats = { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0 };
        const streakStats = { 0: 0, '1-2': 0, '3-4': 0, '5+': 0 };
      
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmationStats['4+']++;
            else confirmationStats[count] = (confirmationStats[count] || 0) + 1;
          
            const streak = node.unconfirmedStreak || 0;
            if (streak >= 5) streakStats['5+']++;
            else if (streak >= 3) streakStats['3-4']++;
            else if (streak >= 1) streakStats['1-2']++;
            else streakStats[0]++;
        }
      
        console.log(`\n🎯 СИСТЕМА ДОВЕРИЯ:`);
        console.log(`   Подтверждения: 🔴4+=${confirmationStats['4+']} 🟠3=${confirmationStats[3]} 🟡2=${confirmationStats[2]} 🔵1=${confirmationStats[1]} ⚪0=${confirmationStats[0]}`);
        console.log(`   Неподтверждения подряд: 0=${streakStats[0]} 1-2=${streakStats['1-2']} 3-4=${streakStats['3-4']} 5+=${streakStats['5+']}`);
        console.log(`   Пороги: забыть=${this.trustConfig.FORGET_AFTER} скрыть=${this.trustConfig.HIDE_AFTER} понизить=${this.trustConfig.DEGRADE_AFTER}`);
      
        // Показываем узлы
        const showNodes = options.showNodes || 6;
        console.log(`\n📋 УЗЛЫ (первые ${showNodes}, система доверия):`);
      
        let count = 0;
        for (const [nodeId, node] of graph.nodes) {
            if (count++ >= showNodes) break;
          
            const confirmations = node.confirmationCount || 0;
            const streak = node.unconfirmedStreak || 0;
            const source = node.addedFrom ? `[${node.addedFrom}]` : '[original]';
          
            let status = '';
            if (streak >= this.trustConfig.FORGET_AFTER) status = '💀 ЗАБЫТ';
            else if (streak >= this.trustConfig.HIDE_AFTER) status = '🙈 СКРЫТ';
            else if (confirmations >= 4 && streak === 0) status = '🔴 ЯДРО';
            else if (confirmations >= 3 && streak < 2) status = '🟠 СТАБИЛЬНЫЙ';
            else if (confirmations >= 2 && streak < 3) status = '🟡 ПОДТВЕРЖДЁН';
            else if (confirmations >= 1 && streak < 4) status = '🔵 НОВЫЙ';
            else status = '⚪ ЗАТУХАЮЩИЙ';
          
            console.log(`   ${nodeId.substring(0, 20)}... ${source}`);
            console.log(`      ${status} | подтверждений: ${confirmations}, неподтверждений: ${streak}`);
            console.log(`      визуализационные координаты: (${node.x?.toFixed(1) || '?'}, ${node.y?.toFixed(1) || '?'})`);
        }
      
        if (graph.nodes.size > showNodes) {
            console.log(`   ... и еще ${graph.nodes.size - showNodes} узлов с системой доверия`);
        }
      
        console.log(`\n📜 ИСТОРИЯ (последние 3):`);
        model.history.slice(-3).forEach((entry, idx) => {
            const emoji = entry.action.includes('created') ? '🆕' : '🔧';
            console.log(`   ${emoji} ${entry.action.toUpperCase()}: ${entry.timestamp.toLocaleTimeString()}`);
            console.log(`      метод: ${entry.method || 'unknown'}`);
            console.log(`      узлов: ${entry.nodes || '?'}, рёбер: ${entry.edges || '?'}`);
            if (entry.newNodes) console.log(`      +${entry.newNodes} новых узлов с доверием`);
        });
      
        console.log(`\n🎯 ФИЛОСОФИЯ: Чистая топология + динамическая система доверия`);
        console.log(`═`.repeat(80));
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
            _version: '2.1-dynamic-trust',
            _exportedAt: new Date().toISOString(),
            _philosophy: 'pure_topological_structure_coordinates_for_visualization_only',
            _trustSystem: this.trustConfig
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
          
            // 🔥 ВОССТАНАВЛИВАЕМ СИСТЕМУ ДОВЕРИЯ
            for (const node of graph.nodes.values()) {
                // Гарантируем базовые параметры
                if (node.confirmationCount === undefined || node.confirmationCount === null) {
                    node.confirmationCount = 1;
                }
                if (node.unconfirmedStreak === undefined || node.unconfirmedStreak === null) {
                    node.unconfirmedStreak = 0;
                }
                if (node.addedAt && typeof node.addedAt === 'string') {
                    node.addedAt = new Date(node.addedAt);
                }
                if (node.firstSeen && typeof node.firstSeen === 'string') {
                    node.firstSeen = new Date(node.firstSeen);
                }
                if (node.lastConfirmed && typeof node.lastConfirmed === 'string') {
                    node.lastConfirmed = new Date(node.lastConfirmed);
                }
            }
          
            this.models.set(modelId, model);
          
            if (!this.currentModelId) {
                this.currentModelId = modelId;
            }
          
            console.log(`📥 Импортирована топологическая модель "${model.metadata.name}" с системой доверия`);
            console.log(`   Узлов: ${graph.nodes.size}, Рёбер: ${graph.edges.size}`);
            console.log(`   Философия: ${data._philosophy || 'чистая топология + доверие'}`);
          
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
                confirmationStats: info.stats?.confirmationStats,
                trustStatus: info.stats?.trustStatus
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
                trustConfig: this.trustConfig,
                philosophy: 'pure_topological_structure_coordinates_for_visualization_only_with_dynamic_trust'
            }
        };
    }
}

module.exports = TopologicalAccumulator;
