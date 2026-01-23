// modules/footprint/simple-graph.js
// 🔥 ДОБАВЛЕНА ЗАЩИТА ОТ ПОВТОРНЫХ ВЫЧИСЛЕНИЙ И РЕКУРСИИ

class SimpleGraph {
    constructor(name = 'Безымянный граф') {
        this.name = name;
        this.id = `graph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.nodes = new Map();
        this.edges = new Map();

        // 🔥 ЗАЩИТА ОТ ПОВТОРНЫХ ВЫЧИСЛЕНИЙ
        this.invariantsCache = null;
        this.invariantsCacheTime = 0;
        this.cacheValidityDuration = 5000; // 5 секунд
        this._calculatingInvariants = false;

        // 🔥 Для методов из оригинального файла
        this.cachedInvariants = null;
        this.lastUpdated = new Date();

        console.log(`📊 Создан граф "${name}"`);
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Вычислить инварианты с кэшированием
    getBasicInvariants(forceRecalculate = false) {
        // Проверяем кэш
        const now = Date.now();
        if (!forceRecalculate &&
            this.invariantsCache &&
            (now - this.invariantsCacheTime) < this.cacheValidityDuration) {
            return this.invariantsCache;
        }

        // 🔥 ЗАЩИТА ОТ РЕКУРСИИ
        if (this._calculatingInvariants) {
            console.log('⚠️ Обнаружена рекурсия в вычислении инвариантов!');
            return this.createEmergencyInvariants();
        }

        this._calculatingInvariants = true;

        try {
            console.log(`🧮 Вычисляю инварианты для графа "${this.name}"...`);

            const nodeCount = this.nodes.size;
            const edgeCount = this.edges.size;

            if (nodeCount === 0) {
                return {
                    nodeCount: 0,
                    edgeCount: 0,
                    graphDiameter: 0,
                    clusteringCoefficient: 0,
                    density: 0,
                    avgDegree: 0,
                    _cached: true,
                    _fromCache: false
                };
            }

            // Вычисляем реальные инварианты
            const invariants = this.calculateAllInvariants();

            // Кэшируем результат
            this.invariantsCache = invariants;
            this.invariantsCacheTime = now;
            this.cachedInvariants = invariants;
            this.lastUpdated = new Date();

            console.log(`✅ Инварианты вычислены: ${nodeCount} узлов, ${edgeCount} рёбер, диаметр=${invariants.graphDiameter}`);

            return invariants;

        } finally {
            this._calculatingInvariants = false;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Вычислить все инварианты
    calculateAllInvariants() {
        const nodeCount = this.nodes.size;
        const edgeCount = this.edges.size;

        // Базовые инварианты
        const invariants = {
            nodeCount: nodeCount,
            edgeCount: edgeCount,
            density: edgeCount / Math.max(1, nodeCount * (nodeCount - 1) / 2),
           
            avgDegree: 0,
            maxDegree: 0,
            degreeHistogram: [],
           
            avgEdgeLength: 0,
            edgeLengthHistogram: [],
           
            graphDiameter: this.calculateGraphDiameter(),
            clusteringCoefficient: this.calculateClusteringCoefficient(),
           
            normalizedMetrics: {
                normalizedEdgeLengths: [],
                normalizedNodeDistribution: this.calculateNormalizedNodeDistribution()
            },
            _cached: true,
            _fromCache: false,
            _calculatedAt: new Date()
        };

        // Вычислить степени узлов
        let totalDegree = 0;
        const degreeCounts = {};

        this.nodes.forEach(node => {
            totalDegree += node.degree || 0;
            invariants.maxDegree = Math.max(invariants.maxDegree, node.degree || 0);
           
            degreeCounts[node.degree || 0] = (degreeCounts[node.degree || 0] || 0) + 1;
        });

        invariants.avgDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;

        // Преобразовать гистограмму степеней
        invariants.degreeHistogram = Object.entries(degreeCounts)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([degree, count]) => ({ degree: parseInt(degree), count }));

        // Вычислить длины рёбер
        let totalEdgeLength = 0;
        const edgeLengths = [];

        this.edges.forEach(edge => {
            if (edge.length) {
                totalEdgeLength += edge.length;
                edgeLengths.push(edge.length);
            }
        });

        invariants.avgEdgeLength = edgeCount > 0 ? totalEdgeLength / edgeCount : 0;
        invariants.edgeLengthHistogram = this.createHistogram(edgeLengths, 8);

        // Нормализованные длины рёбер
        this.edges.forEach(edge => {
            if (edge.normalizedLength) {
                invariants.normalizedMetrics.normalizedEdgeLengths.push(edge.normalizedLength);
            }
        });

        return invariants;
    }

    createEmergencyInvariants() {
        return {
            nodeCount: this.nodes.size,
            edgeCount: this.edges.size,
            graphDiameter: 0,
            clusteringCoefficient: 0,
            density: 0,
            avgDegree: 0,
            _emergency: true,
            _error: 'recursion_detected'
        };
    }

    // 🔥 Метод для очистки кэша (при изменении графа)
    invalidateCache() {
        this.invariantsCache = null;
        this.invariantsCacheTime = 0;
        this.cachedInvariants = null;
    }

    // Методы из оригинального файла с добавлением очистки кэша
    addNode(point, confidence = 0.5) {
        if (!point || point.x === undefined || point.y === undefined) {
            console.log('⚠️ Пропускаю узел без координат');
            return null;
        }

        const nodeId = `n${this.nodes.size + 1}`;
        const node = {
            id: nodeId,
            x: point.x,
            y: point.y,
            confidence: Math.max(0.1, Math.min(1.0, confidence)),
            degree: 0,
            neighbors: new Set()
        };

        this.nodes.set(nodeId, node);
        this.invalidateCache(); // 🔥 ОЧИЩАЕМ КЭШ
        return nodeId;
    }

    addEdge(nodeId1, nodeId2) {
        if (!this.nodes.has(nodeId1) || !this.nodes.has(nodeId2) || nodeId1 === nodeId2) {
            return false;
        }

        const edgeId = `${nodeId1}-${nodeId2}`;
        const reverseEdgeId = `${nodeId2}-${nodeId1}`;

        if (this.edges.has(edgeId) || this.edges.has(reverseEdgeId)) {
            return false;
        }

        const node1 = this.nodes.get(nodeId1);
        const node2 = this.nodes.get(nodeId2);

        const length = Math.sqrt(
            Math.pow(node2.x - node1.x, 2) +
            Math.pow(node2.y - node1.y, 2)
        );

        const confidence = (node1.confidence + node2.confidence) / 2;

        const edge = {
            id: edgeId,
            from: nodeId1,
            to: nodeId2,
            length: length,
            confidence: confidence,
            normalizedLength: null
        };

        this.edges.set(edgeId, edge);

        // Обновить степени узлов
        node1.degree = (node1.degree || 0) + 1;
        node2.degree = (node2.degree || 0) + 1;
        if (node1.neighbors) node1.neighbors.add(nodeId2);
        if (node2.neighbors) node2.neighbors.add(nodeId1);

        this.invalidateCache(); // 🔥 ОЧИЩАЕМ КЭШ
        return true;
    }

    buildFromPoints(points, maxNeighbors = 5, distanceThreshold = 150) {
        console.log(`🔨 Строю граф из ${points.length} точек...`);

        // Создать узлы
        const nodeIds = [];
        points.forEach((point, index) => {
            const nodeId = this.addNode(
                { x: point.x, y: point.y },
                point.confidence || 0.5
            );
            if (nodeId) {
                nodeIds.push({
                    id: nodeId,
                    x: point.x,
                    y: point.y,
                    confidence: point.confidence || 0.5
                });
            }
        });

        console.log(`✅ Создано ${nodeIds.length} узлов`);

        // Создать рёбра к ближайшим соседям
        nodeIds.forEach((node1, i) => {
            const distances = [];
            nodeIds.forEach((node2, j) => {
                if (i !== j) {
                    const dist = Math.sqrt(
                        Math.pow(node2.x - node1.x, 2) +
                        Math.pow(node2.y - node1.y, 2)
                    );
                    if (dist <= distanceThreshold) {
                        distances.push({
                            nodeId: node2.id,
                            distance: dist,
                            confidence: node2.confidence
                        });
                    }
                }
            });

            distances.sort((a, b) => a.distance - b.distance);
            const nearest = distances.slice(0, maxNeighbors);

            nearest.forEach(neighbor => {
                this.addEdge(node1.id, neighbor.nodeId);
            });
        });

        // Нормализовать длины рёбер
        this.normalizeEdgeLengths();

        console.log(`✅ Построен граф: ${this.nodes.size} узлов, ${this.edges.size} рёбер`);
        return this.getBasicInvariants();
    }

    normalizeEdgeLengths() {
        if (this.edges.size === 0) return;

        let totalLength = 0;
        this.edges.forEach(edge => {
            totalLength += edge.length || 0;
        });
        const meanLength = totalLength / this.edges.size;

        this.edges.forEach(edge => {
            edge.normalizedLength = meanLength > 0 ? edge.length / meanLength : 1;
        });

        console.log(`📏 Нормализовано ${this.edges.size} рёбер (средняя длина: ${meanLength.toFixed(1)})`);
    }

    calculateGraphDiameter() {
        if (this.nodes.size < 2) return 0;

        const nodeIds = Array.from(this.nodes.keys());
        let maxDistance = 0;

        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                const node1 = this.nodes.get(nodeIds[i]);
                const node2 = this.nodes.get(nodeIds[j]);
                const distance = Math.sqrt(
                    Math.pow(node2.x - node1.x, 2) +
                    Math.pow(node2.y - node1.y, 2)
                );
                maxDistance = Math.max(maxDistance, distance);
            }
        }

        return Math.round(maxDistance);
    }

    calculateClusteringCoefficient() {
        if (this.nodes.size < 3) return 0;

        let totalCoefficient = 0;
        let nodesWithNeighbors = 0;

        this.nodes.forEach(node => {
            const neighbors = node.neighbors ? Array.from(node.neighbors) : [];
            const k = neighbors.length;

            if (k < 2) {
                totalCoefficient += 0;
                return;
            }

            let edgesBetweenNeighbors = 0;
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    const edgeId1 = `${neighbors[i]}-${neighbors[j]}`;
                    const edgeId2 = `${neighbors[j]}-${neighbors[i]}`;
                    if (this.edges.has(edgeId1) || this.edges.has(edgeId2)) {
                        edgesBetweenNeighbors++;
                    }
                }
            }

            const maxPossibleEdges = k * (k - 1) / 2;
            const nodeCoefficient = maxPossibleEdges > 0 ?
                edgesBetweenNeighbors / maxPossibleEdges : 0;

            totalCoefficient += nodeCoefficient;
            nodesWithNeighbors++;
        });

        return nodesWithNeighbors > 0 ? totalCoefficient / nodesWithNeighbors : 0;
    }

    calculateNormalizedNodeDistribution() {
        if (this.nodes.size === 0) return [];

        const nodesArray = Array.from(this.nodes.values());
        const xs = nodesArray.map(n => n.x);
        const ys = nodesArray.map(n => n.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);

        return nodesArray.map(node => ({
            nx: width === 0 ? 0.5 : (node.x - minX) / width,
            ny: height === 0 ? 0.5 : (node.y - minY) / height,
            originalX: node.x,
            originalY: node.y,
            confidence: node.confidence
        }));
    }

    createHistogram(values, bins = 8) {
        if (!values || values.length === 0) return [];

        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;
        const binSize = range / bins;

        const histogram = Array(bins).fill(0);

        values.forEach(value => {
            if (range === 0) {
                histogram[0]++;
            } else {
                const binIndex = Math.min(
                    bins - 1,
                    Math.floor((value - min) / binSize)
                );
                histogram[binIndex]++;
            }
        });

        return histogram;
    }

    // Другие методы из оригинального файла...
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            nodes: Array.from(this.nodes.values()),
            edges: Array.from(this.edges.values()),
            invariants: this.getBasicInvariants()
        };
    }

    static fromJSON(data) {
        const graph = new SimpleGraph(data.name || 'Загруженный граф');
        graph.id = data.id || graph.id;

        if (Array.isArray(data.nodes)) {
            data.nodes.forEach(nodeData => {
                const node = {
                    id: nodeData.id,
                    x: nodeData.x,
                    y: nodeData.y,
                    confidence: nodeData.confidence || 0.5,
                    degree: nodeData.degree || 0,
                    neighbors: new Set(nodeData.neighbors || [])
                };
                graph.nodes.set(node.id, node);
            });
        }

        if (Array.isArray(data.edges)) {
            data.edges.forEach(edgeData => {
                graph.edges.set(edgeData.id, edgeData);
            });
        }

        if (data.invariants) {
            graph.cachedInvariants = data.invariants;
        }

        console.log(`📂 Загружен граф "${graph.name}" с ${graph.nodes.size} узлами`);
        return graph;
    }

    getStats() {
        const invariants = this.getBasicInvariants();

        return {
            id: this.id,
            name: this.name,
            nodes: this.nodes.size,
            edges: this.edges.size,
            avgDegree: invariants.avgDegree.toFixed(2),
            graphDiameter: invariants.graphDiameter,
            clusteringCoefficient: invariants.clusteringCoefficient.toFixed(3),
            density: invariants.density.toFixed(3)
        };
    }

    visualize() {
        console.log('\n🕸️  ВИЗУАЛИЗАЦИЯ ГРАФА:');
        console.log(`├─ Название: ${this.name}`);
        console.log(`├─ Узлы: ${this.nodes.size}`);
        console.log(`├─ Рёбра: ${this.edges.size}`);

        const invariants = this.getBasicInvariants();
        console.log('└─ ИНВАРИАНТЫ:');
        console.log(`   ├─ Узлов: ${invariants.nodeCount}`);
        console.log(`   ├─ Рёбер: ${invariants.edgeCount}`);
        console.log(`   ├─ Средняя степень: ${invariants.avgDegree.toFixed(2)}`);
        console.log(`   ├─ Диаметр графа: ${invariants.graphDiameter}`);
        console.log(`   └─ Коэф. кластеризации: ${invariants.clusteringCoefficient.toFixed(3)}`);
    }
}

module.exports = SimpleGraph;
