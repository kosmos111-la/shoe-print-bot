// modules/footprint/vector-super-model.js
// ПРОСТАЯ ВЕКТОРНАЯ СУПЕР-МОДЕЛЬ - без сложностей!

class VectorSuperModel {
    constructor(options = {}) {
        this.id = `vsm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Векторная супер-модель';
       
        // Векторные узлы в нормализованном пространстве [0, 1]
        this.nodes = []; // {id, nx, ny, confirmedCount, confidence, sources[], graphId}
       
        // 🔥 НОВОЕ: Храним ссылки на исходные графы
        this.sourceGraphs = new Map(); // graphId -> {graph, metadata, nodeCount, addedAt}
       
        // 🔥 НОВОЕ: Лучший след-представитель
        this.bestGraphId = null;
        this.bestGraphScore = 0;
        this.bestGraphMetadata = null;
       
        // Статистика
        this.stats = {
            totalMerges: 0,
            totalNodesAdded: 0,
            confidence: 0,
            createdAt: new Date(),
            lastUpdated: new Date(),
            // 🔥 НОВАЯ СТАТИСТИКА
            bestGraphUpdates: 0,
            sourceGraphsCount: 0
        };
       
        // Минимальные настройки
        this.config = {
            matchThreshold: options.matchThreshold || 0.08,
            minConfirmationsForHighConfidence: 2,
            bestGraphMinNodes: options.bestGraphMinNodes || 15, // Минимум узлов для лучшего графа
            ...options
        };
       
        console.log(`🏗️ Создана векторная супер-модель "${this.name}"`);
    }
   
    // 1. ОСНОВНОЙ МЕТОД: добавить граф в супер-модель (ОБНОВЛЕННЫЙ)
    addGraph(graph, graphId, metadata = {}) {
        console.log(`🔄 Добавляю граф ${graphId} в супер-модель ${this.id}...`);
       
        // 🔥 СОХРАНЯЕМ ИСХОДНЫЙ ГРАФ
        this.saveSourceGraph(graph, graphId, metadata);
       
        // Получаем инварианты графа
        const invariants = graph.getBasicInvariants();
        if (!invariants || !invariants.normalizedMetrics) {
            console.log('⚠️ Граф не имеет нормализованных метрик');
            return false;
        }
       
        const normalizedNodes = invariants.normalizedMetrics.normalizedNodeDistribution || [];
        console.log(`📊 Получил ${normalizedNodes.length} нормализованных узлов`);
       
        // 🔥 ОЦЕНИВАЕМ ГРАФ (нужен ли для лучшего?)
        this.evaluateGraphForBest(graph, graphId, metadata);
       
        if (this.nodes.length === 0) {
            // ПЕРВЫЙ ГРАФ - просто копируем
            this.nodes = normalizedNodes.map((node, i) => ({
                id: `vn_${i}`,
                nx: node.nx || 0,
                ny: node.ny || 0,
                confirmedCount: 1,
                confidence: 0.7,
                sources: [graphId],
                graphId: graphId, // 🔥 Сохраняем ID исходного графа
                metadata: metadata
            }));
           
            console.log(`✅ Первый граф добавлен: ${this.nodes.length} узлов`);
        } else {
            // СЛИЯНИЕ с существующими узлами
            this.mergeWith(normalizedNodes, graphId, metadata);
        }
       
        // Обновить статистику
        this.stats.totalMerges++;
        this.stats.lastUpdated = new Date();
        this.updateStats();
       
        console.log(`✅ Граф добавлен. Теперь ${this.nodes.length} узлов, ${this.stats.confidence.toFixed(3)} уверенность`);
        return true;
    }
   
    // 🔥 НОВЫЙ МЕТОД: СОХРАНИТЬ ИСХОДНЫЙ ГРАФ
    saveSourceGraph(graph, graphId, metadata) {
        const nodeCount = graph.nodes ? graph.nodes.size : 0;
       
        this.sourceGraphs.set(graphId, {
            graphId: graphId,
            nodeCount: nodeCount,
            edgeCount: graph.edges ? graph.edges.size : 0,
            metadata: metadata,
            addedAt: new Date(),
            invariants: graph.getBasicInvariants ? graph.getBasicInvariants() : null,
            // Сохраняем ссылку на сам граф (если он не слишком большой)
            graph: nodeCount <= 100 ? graph : null, // Сохраняем только небольшие графы
            graphData: nodeCount > 100 ? this.extractGraphData(graph) : null
        });
       
        this.stats.sourceGraphsCount = this.sourceGraphs.size;
        console.log(`💾 Сохранен исходный граф ${graphId} с ${nodeCount} узлами`);
    }
   
    // 🔥 НОВЫЙ МЕТОД: ИЗВЛЕЧЬ ДАННЫЕ ГРАФА (для больших графов)
    extractGraphData(graph) {
        const nodes = [];
        const edges = [];
       
        // Сохраняем только позиции узлов
        if (graph.nodes) {
            for (const [id, node] of graph.nodes) {
                nodes.push({
                    id: id,
                    x: node.x,
                    y: node.y,
                    confidence: node.confidence || 0.5
                });
            }
        }
       
        return { nodes, edges };
    }
   
    // 🔥 НОВЫЙ МЕТОД: ОЦЕНИТЬ ГРАФ КАК КАНДИДАТА НА "ЛУЧШИЙ"
    evaluateGraphForBest(graph, graphId, metadata) {
        const score = this.calculateGraphScore(graph);
       
        console.log(`📈 Оценка графа ${graphId}: ${score.toFixed(3)} (текущий лучший: ${this.bestGraphScore.toFixed(3)})`);
       
        if (score > this.bestGraphScore) {
            this.bestGraphId = graphId;
            this.bestGraphScore = score;
            this.bestGraphMetadata = metadata;
            this.stats.bestGraphUpdates++;
           
            console.log(`🏆 НОВЫЙ ЛУЧШИЙ СЛЕД: ${graphId}`);
            console.log(`   Узлов: ${graph.nodes ? graph.nodes.size : 0}`);
            console.log(`   Оценка: ${score.toFixed(3)}`);
        }
    }
   
    // 🔥 НОВЫЙ МЕТОД: РАСЧЁТ ОЦЕНКИ ГРАФА
    calculateGraphScore(graph) {
        if (!graph || !graph.nodes) return 0;
       
        const nodeCount = graph.nodes.size;
        const edgeCount = graph.edges ? graph.edges.size : 0;
       
        // Минимальное требование
        if (nodeCount < this.config.bestGraphMinNodes) {
            return 0;
        }
       
        // Факторы оценки:
        const factors = {
            nodeCount: Math.min(1, nodeCount / 50),          // 0-1, идеал 50+ узлов
            connectivity: Math.min(1, edgeCount / (nodeCount * 1.5)), // Связность
            uniformity: this.calculateNodeUniformity(graph), // Равномерность
            clusterQuality: this.calculateClusterQuality(graph) // Качество кластеризации
        };
       
        // Веса факторов
        const weights = {
            nodeCount: 0.35,      // 35% - детализация
            connectivity: 0.25,   // 25% - связность
            uniformity: 0.20,     // 20% - равномерность
            clusterQuality: 0.20  // 20% - качество кластеризации
        };
       
        // Итоговая оценка
        let totalScore = 0;
        for (const [factor, value] of Object.entries(factors)) {
            totalScore += value * weights[factor];
        }
       
        return Math.min(1, totalScore);
    }
   
    // 🔥 НОВЫЙ МЕТОД: РАСЧЁТ РАВНОМЕРНОСТИ РАСПРЕДЕЛЕНИЯ УЗЛОВ
    calculateNodeUniformity(graph) {
        if (!graph.nodes || graph.nodes.size < 10) return 0.5;
       
        const nodes = Array.from(graph.nodes.values());
       
        // Находим границы
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        nodes.forEach(node => {
            minX = Math.min(minX, node.x || 0);
            maxX = Math.max(maxX, node.x || 0);
            minY = Math.min(minY, node.y || 0);
            maxY = Math.max(maxY, node.y || 0);
        });
       
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
       
        // Разбиваем на квадранты (3x3 сетка)
        const grid = Array(9).fill(0);
        const cellWidth = width / 3;
        const cellHeight = height / 3;
       
        nodes.forEach(node => {
            const gridX = Math.min(2, Math.floor((node.x - minX) / cellWidth));
            const gridY = Math.min(2, Math.floor((node.y - minY) / cellHeight));
            const cellIndex = gridY * 3 + gridX;
            grid[cellIndex]++;
        });
       
        // Рассчитываем равномерность
        const avg = nodes.length / 9;
        let variance = 0;
        grid.forEach(count => {
            variance += Math.pow(count - avg, 2);
        });
        variance /= 9;
       
        // Нормализуем (0-1, где 1 - идеально равномерно)
        const maxVariance = Math.pow(nodes.length, 2) / 9;
        const uniformity = 1 - (variance / maxVariance);
       
        return Math.max(0, Math.min(1, uniformity));
    }
   
    // 🔥 НОВЫЙ МЕТОД: КАЧЕСТВО КЛАСТЕРИЗАЦИИ
    calculateClusterQuality(graph) {
        // Простая оценка: среднее количество соседей у узлов
        if (!graph.nodes || graph.nodes.size === 0) return 0;
       
        let totalNeighbors = 0;
       
        if (graph.edges && graph.edges.size > 0) {
            // Считаем степень каждого узла
            const degrees = new Map();
           
            for (const [edgeId, edge] of graph.edges) {
                degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
                degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);
            }
           
            // Средняя степень
            for (const degree of degrees.values()) {
                totalNeighbors += degree;
            }
           
            const avgDegree = totalNeighbors / graph.nodes.size;
            return Math.min(1, avgDegree / 4); // Идеал 4+ соседа
        }
       
        return 0.3; // Базовая оценка для графов без рёбер
    }
   
    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧИТЬ ЛУЧШИЙ ГРАФ
    getBestGraph() {
        if (!this.bestGraphId || !this.sourceGraphs.has(this.bestGraphId)) {
            return null;
        }
       
        const source = this.sourceGraphs.get(this.bestGraphId);
       
        // Если граф сохранён полностью
        if (source.graph) {
            return source.graph;
        }
       
        // Если есть данные для восстановления
        if (source.graphData) {
            return this.reconstructGraph(source.graphData);
        }
       
        return null;
    }
   
    // 🔥 НОВЫЙ МЕТОД: ВОССТАНОВИТЬ ГРАФ ИЗ ДАННЫХ
    reconstructGraph(graphData) {
        const SimpleGraph = require('./simple-graph');
        const graph = new SimpleGraph('Восстановленный граф');
       
        if (graphData.nodes) {
            const points = graphData.nodes.map(node => ({
                x: node.x,
                y: node.y,
                confidence: node.confidence || 0.5,
                id: node.id
            }));
           
            graph.buildFromPoints(points);
        }
       
        return graph;
    }
   
    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧИТЬ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ НА ОСНОВЕ ЛУЧШЕГО СЛЕДА
    getBestGraphVisualizationData() {
        const bestGraph = this.getBestGraph();
       
        if (!bestGraph) {
            return this.getVisualizationData(); // Fallback к старой версии
        }
       
        // Получаем узлы лучшего графа
        const bestGraphNodes = Array.from(bestGraph.nodes.values());
       
        // Сопоставляем узлы лучшего графа с узлами супер-модели
        const enhancedNodes = bestGraphNodes.map((node, index) => {
            const nodeId = `best_${index}`;
           
            // Ищем соответствие в супер-модели
            let confirmedCount = 1;
            let confidence = 0.5;
            let isNew = true;
           
            // 🔥 КРИТИЧЕСКИЙ МОМЕНТ: находим подтверждения из супер-модели
            // Нормализуем координаты узла для поиска
            const normalizedNode = this.normalizeNodeForSearch(node);
           
            // Ищем ближайший узел в супер-модели
            let nearestMatch = null;
            let minDistance = Infinity;
           
            this.nodes.forEach(superNode => {
                const dx = superNode.nx - normalizedNode.nx;
                const dy = superNode.ny - normalizedNode.ny;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < minDistance && distance < this.config.matchThreshold * 1.5) {
                    minDistance = distance;
                    nearestMatch = superNode;
                }
            });
           
            if (nearestMatch) {
                confirmedCount = nearestMatch.confirmedCount;
                confidence = nearestMatch.confidence;
                isNew = false;
            }
           
            return {
                id: nodeId,
                x: node.x,
                y: node.y,
                nx: normalizedNode.nx,
                ny: normalizedNode.ny,
                confirmedCount: confirmedCount,
                confidence: confidence,
                isNew: isNew,
                isHighConfidence: confirmedCount >= 3,
                isBestGraphNode: true,
                originalNodeId: node.id
            };
        });
       
        // Статистика
        const confirmedNodes = enhancedNodes.filter(n => n.confirmedCount > 1);
        const highConfidenceNodes = enhancedNodes.filter(n => n.confirmedCount >= 3);
        const newNodes = enhancedNodes.filter(n => n.confirmedCount === 1);
       
        return {
            nodes: enhancedNodes,
            stats: {
                total: enhancedNodes.length,
                confirmed: confirmedNodes.length,
                highConfidence: highConfidenceNodes.length,
                new: newNodes.length,
                confidence: this.stats.confidence,
                bestGraphScore: this.bestGraphScore,
                bestGraphId: this.bestGraphId,
                bestGraphNodes: bestGraphNodes.length
            },
            metadata: {
                id: this.id,
                name: this.name,
                merges: this.stats.totalMerges,
                createdAt: this.stats.createdAt,
                visualizationMethod: 'best_graph_based'
            }
        };
    }
   
    // 🔥 НОВЫЙ МЕТОД: НОРМАЛИЗОВАТЬ УЗЕЛ ДЛЯ ПОИСКА
    normalizeNodeForSearch(node) {
        // Для поиска нам нужно нормализовать координаты
        // В идеале - использовать ту же нормализацию, что и при добавлении графа
        // Упрощённая версия:
        return {
            nx: Math.max(0, Math.min(1, (node.x || 0) / 1000)),
            ny: Math.max(0, Math.min(1, (node.y || 0) / 1000))
        };
    }
   
    // 2. ПРОСТОЕ СЛИЯНИЕ (ОБНОВЛЕННОЕ - сохраняем graphId)
    mergeWith(newNodes, sourceId, metadata = {}) {
        console.log(`🔍 Ищу совпадения для ${newNodes.length} новых узлов...`);
       
        let matchedCount = 0;
        let addedCount = 0;
       
        newNodes.forEach((newNode, newIdx) => {
            const nx = newNode.nx || 0;
            const ny = newNode.ny || 0;
           
            // Поиск ближайшего существующего узла
            let bestMatch = null;
            let minDistance = Infinity;
           
            this.nodes.forEach((existingNode, existingIdx) => {
                const dx = existingNode.nx - nx;
                const dy = existingNode.ny - ny;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = { idx: existingIdx, node: existingNode, distance };
                }
            });
           
            // Проверяем порог совпадения
            if (bestMatch && minDistance < this.config.matchThreshold) {
                // СОВПАЛО - увеличиваем подтверждения
                bestMatch.node.confirmedCount++;
                bestMatch.node.confidence = Math.min(1.0, bestMatch.node.confidence + 0.1);
                if (!bestMatch.node.sources.includes(sourceId)) {
                    bestMatch.node.sources.push(sourceId);
                }
                matchedCount++;
               
                // Легкая коррекция позиции (взвешенное среднее)
                const weight = 1 / bestMatch.node.confirmedCount;
                bestMatch.node.nx = bestMatch.node.nx * (1 - weight) + nx * weight;
                bestMatch.node.ny = bestMatch.node.ny * (1 - weight) + ny * weight;
               
            } else {
                // НЕ СОВПАЛО - добавляем новый узел
                this.nodes.push({
                    id: `vn_${this.nodes.length}`,
                    nx: nx,
                    ny: ny,
                    confirmedCount: 1,
                    confidence: 0.5,
                    sources: [sourceId],
                    graphId: sourceId, // 🔥 Сохраняем ID графа
                    metadata: metadata,
                    isNew: true
                });
                addedCount++;
            }
        });
       
        console.log(`📊 Слияние: ${matchedCount} совпадений, ${addedCount} новых узлов`);
        this.stats.totalNodesAdded += addedCount;
    }
   
    // 3. ОБНОВИТЬ СТАТИСТИКУ (ДОБАВЛЕНА СТАТИСТИКА ЛУЧШЕГО ГРАФА)
    updateStats() {
        if (this.nodes.length === 0) {
            this.stats.confidence = 0;
            return;
        }
       
        // Подсчитываем узлы с подтверждениями
        const confirmedNodes = this.nodes.filter(n => n.confirmedCount > 1);
        const confirmedRatio = confirmedNodes.length / this.nodes.length;
       
        // Среднее количество подтверждений
        const avgConfirmations = this.nodes.reduce((sum, n) => sum + n.confirmedCount, 0) /
                               this.nodes.length;
       
        // 🔥 ДОБАВЛЯЕМ ФАКТОР ЛУЧШЕГО ГРАФА
        const bestGraphBonus = this.bestGraphScore * 0.15; // До 15% бонуса
       
        // Расчет уверенности
        this.stats.confidence = Math.min(1.0,
            confirmedRatio * 0.5 + // 50% за долю подтвержденных узлов
            Math.min(0.25, (avgConfirmations - 1) * 0.12) + // 25% за среднее подтверждений
            Math.min(0.1, this.stats.totalMerges * 0.05) + // 10% за количество слияний
            bestGraphBonus // До 15% за качество лучшего графа
        );
       
        // Дополнительная статистика
        this.stats.nodeCount = this.nodes.length;
        this.stats.confirmedNodeCount = confirmedNodes.length;
        this.stats.highConfidenceNodes = this.nodes.filter(n => n.confirmedCount >= 3).length;
        this.stats.avgConfirmations = avgConfirmations;
        this.stats.bestGraphId = this.bestGraphId;
        this.stats.bestGraphScore = this.bestGraphScore;
    }
   
    // 4. ПОЛУЧИТЬ ИНФОРМАЦИЮ (ОБНОВЛЕННАЯ)
    getInfo() {
        const bestGraphInfo = this.bestGraphId ? {
            bestGraphId: this.bestGraphId,
            bestGraphScore: Math.round(this.bestGraphScore * 1000) / 1000,
            bestGraphUpdates: this.stats.bestGraphUpdates,
            sourceGraphsCount: this.stats.sourceGraphsCount
        } : {};
       
        return {
            id: this.id,
            name: this.name,
            stats: {
                ...this.stats,
                confidence: Math.round(this.stats.confidence * 1000) / 1000,
                createdAt: this.stats.createdAt.toLocaleString('ru-RU'),
                lastUpdated: this.stats.lastUpdated.toLocaleString('ru-RU'),
                ...bestGraphInfo
            },
            nodes: this.nodes.length,
            confirmedNodes: this.stats.confirmedNodeCount || 0,
            highConfidenceNodes: this.stats.highConfidenceNodes || 0,
            config: this.config,
            hasBestGraph: !!this.bestGraphId
        };
    }
   
    // 5. ПОЛУЧИТЬ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ (ОБНОВЛЕННЫЙ - использует лучший граф если есть)
    getVisualizationData() {
        // 🔥 ПЕРВЫЙ ПРИОРИТЕТ: данные на основе лучшего графа
        if (this.bestGraphId) {
            const bestGraphData = this.getBestGraphVisualizationData();
            if (bestGraphData.nodes.length > 0) {
                return bestGraphData;
            }
        }
       
        // 🔥 ЗАПАСНОЙ ВАРИАНТ: старая логика
        const confirmedNodes = this.nodes.filter(n => n.confirmedCount > 1);
        const highConfidenceNodes = this.nodes.filter(n => n.confirmedCount >= 3);
        const newNodes = this.nodes.filter(n => n.confirmedCount === 1);
       
        return {
            nodes: this.nodes.map(node => ({
                id: node.id,
                nx: node.nx,
                ny: node.ny,
                confirmedCount: node.confirmedCount,
                confidence: node.confidence,
                isHighConfidence: node.confirmedCount >= 3,
                isNew: node.confirmedCount === 1 || node.isNew
            })),
            stats: {
                total: this.nodes.length,
                confirmed: confirmedNodes.length,
                highConfidence: highConfidenceNodes.length,
                new: newNodes.length,
                confidence: this.stats.confidence
            },
            metadata: {
                id: this.id,
                name: this.name,
                merges: this.stats.totalMerges,
                createdAt: this.stats.createdAt,
                visualizationMethod: 'legacy'
            }
        };
    }
   
    // ... остальные методы без изменений
   
    // 7. ЗАГРУЗИТЬ ИЗ JSON (ОБНОВЛЕННЫЙ)
    static fromJSON(data) {
        const model = new VectorSuperModel({
            name: data.name,
            matchThreshold: data.config?.matchThreshold
        });
       
        model.id = data.id || model.id;
        model.nodes = data.nodes || [];
        model.stats = data.stats || model.stats;
        model.config = data.config || model.config;
       
        // 🔥 ВОССТАНАВЛИВАЕМ ДАННЫЕ ЛУЧШЕГО ГРАФА
        if (data.bestGraphId) {
            model.bestGraphId = data.bestGraphId;
            model.bestGraphScore = data.bestGraphScore || 0;
            model.bestGraphMetadata = data.bestGraphMetadata || null;
        }
       
        // 🔥 ВОССТАНАВЛИВАЕМ ИСХОДНЫЕ ГРАФЫ (если сохранены)
        if (data.sourceGraphs && Array.isArray(data.sourceGraphs)) {
            data.sourceGraphs.forEach(graphData => {
                if (graphData.graphId) {
                    model.sourceGraphs.set(graphData.graphId, graphData);
                }
            });
            model.stats.sourceGraphsCount = model.sourceGraphs.size;
        }
       
        // Восстановить даты
        if (model.stats.createdAt && typeof model.stats.createdAt === 'string') {
            model.stats.createdAt = new Date(model.stats.createdAt);
        }
        if (model.stats.lastUpdated && typeof model.stats.lastUpdated === 'string') {
            model.stats.lastUpdated = new Date(model.stats.lastUpdated);
        }
       
        console.log(`📂 Загружена векторная супер-модель "${model.name}"`);
        console.log(`   Узлов: ${model.nodes.length}, Лучший граф: ${model.bestGraphId || 'нет'}`);
       
        return model;
    }
   
    // 🔥 НОВЫЙ МЕТОД: ПОЛУЧИТЬ ИНФОРМАЦИЮ О ЛУЧШЕМ ГРАФЕ
    getBestGraphInfo() {
        if (!this.bestGraphId || !this.sourceGraphs.has(this.bestGraphId)) {
            return null;
        }
       
        const source = this.sourceGraphs.get(this.bestGraphId);
        return {
            graphId: this.bestGraphId,
            score: this.bestGraphScore,
            nodeCount: source.nodeCount,
            edgeCount: source.edgeCount,
            addedAt: source.addedAt,
            metadata: source.metadata,
            canVisualize: !!(source.graph || source.graphData)
        };
    }
}

module.exports = VectorSuperModel;
