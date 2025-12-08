// modules/footprint/simple-graph.js
// ФУНДАМЕНТ НОВОЙ СИСТЕМЫ - ПРОСТОЙ ГРАФ ДЛЯ СЛЕДОВ

class SimpleGraph {
    constructor(name = 'Без названия') {
        this.id = `graph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = name;
        this.createdAt = new Date();
       
        // Узлы графа (центры протекторов)
        this.nodes = new Map(); // id -> {x, y, confidence, degree}
       
        // Рёбра графа (связи между протекторами)
        this.edges = new Map(); // "node1-node2" -> {from, to, length, confidence}
       
        // Кэшированные инварианты для быстрого сравнения
        this.cachedInvariants = null;
        this.lastUpdated = this.createdAt;
       
        console.log(`📐 Создан новый граф "${name}" (ID: ${this.id})`);
    }
   
    // 1. ДОБАВИТЬ УЗЕЛ (центр протектора)
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
        this.cachedInvariants = null; // Сбросить кэш
        this.lastUpdated = new Date();
       
        return nodeId;
    }
   
    // 2. ДОБАВИТЬ РЕБРО МЕЖДУ УЗЛАМИ
    addEdge(nodeId1, nodeId2) {
        if (!this.nodes.has(nodeId1) || !this.nodes.has(nodeId2) || nodeId1 === nodeId2) {
            return false;
        }
       
        const edgeId = `${nodeId1}-${nodeId2}`;
        const reverseEdgeId = `${nodeId2}-${nodeId1}`;
       
        // Убедиться, что ребро ещё не существует
        if (this.edges.has(edgeId) || this.edges.has(reverseEdgeId)) {
            return false;
        }
       
        const node1 = this.nodes.get(nodeId1);
        const node2 = this.nodes.get(nodeId2);
       
        // Вычислить длину ребра
        const length = Math.sqrt(
            Math.pow(node2.x - node1.x, 2) +
            Math.pow(node2.y - node1.y, 2)
        );
       
        // Уверенность ребра = средняя уверенность узлов
        const confidence = (node1.confidence + node2.confidence) / 2;
       
        const edge = {
            id: edgeId,
            from: nodeId1,
            to: nodeId2,
            length: length,
            confidence: confidence,
            normalizedLength: null // Будет заполнено позже
        };
       
        this.edges.set(edgeId, edge);
       
        // Обновить степени узлов
        node1.degree++;
        node2.degree++;
        node1.neighbors.add(nodeId2);
        node2.neighbors.add(nodeId1);
       
        this.cachedInvariants = null; // Сбросить кэш
        return true;
    }
   
    // 3. ПОСТРОИТЬ ГРАФ ИЗ ТОЧЕК (основной метод)
    buildFromPoints(points, maxNeighbors = 5, distanceThreshold = 150) {
        console.log(`🔨 Строю граф из ${points.length} точек...`);
       
        // Шаг 1: Создать узлы из всех точек
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
       
        // Шаг 2: Найти ближайших соседей для каждого узла
        nodeIds.forEach((node1, i) => {
            // Создать список расстояний до всех других узлов
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
           
            // Отсортировать по расстоянию и взять ближайших
            distances.sort((a, b) => a.distance - b.distance);
            const nearest = distances.slice(0, maxNeighbors);
           
            // Добавить рёбра к ближайшим соседям
            nearest.forEach(neighbor => {
                this.addEdge(node1.id, neighbor.nodeId);
            });
        });
       
        // Шаг 3: Нормализовать длины рёбер для инвариантности к масштабу
        this.normalizeEdgeLengths();
       
        console.log(`✅ Построен граф: ${this.nodes.size} узлов, ${this.edges.size} рёбер`);
        return this.getBasicInvariants();
    }
   
    // 4. НОРМАЛИЗОВАТЬ ДЛИНЫ РЁБЕР (чтобы граф был инвариантен к масштабу)
    normalizeEdgeLengths() {
        if (this.edges.size === 0) return;
       
        // Найти среднюю длину рёбер
        let totalLength = 0;
        this.edges.forEach(edge => {
            totalLength += edge.length;
        });
        const meanLength = totalLength / this.edges.size;
       
        // Нормализовать все длины рёбер
        this.edges.forEach(edge => {
            edge.normalizedLength = edge.length / meanLength;
        });
       
        console.log(`📏 Нормализовано ${this.edges.size} рёбер (средняя длина: ${meanLength.toFixed(1)})`);
    }
   
    // 5. ПОЛУЧИТЬ КЛЮЧЕВЫЕ ИНВАРИАНТЫ ГРАФА (5-7 параметров)
    getBasicInvariants() {
        // Если есть кэш и граф не менялся - вернуть кэш
        if (this.cachedInvariants &&
            (new Date() - this.lastUpdated) < 5000) { // 5 секунд кэш
            return this.cachedInvariants;
        }
       
        console.log(`🧮 Вычисляю инварианты для графа "${this.name}"...`);
       
        const nodeCount = this.nodes.size;
        const edgeCount = this.edges.size;
       
        // Базовые инварианты
        const invariants = {
            // 1. Количественные
            nodeCount: nodeCount,
            edgeCount: edgeCount,
            density: edgeCount / Math.max(1, nodeCount * (nodeCount - 1) / 2),
           
            // 2. Степени узлов
            avgDegree: 0,
            maxDegree: 0,
            degreeHistogram: [],
           
            // 3. Длины рёбер
            avgEdgeLength: 0,
            edgeLengthHistogram: [],
           
            // 4. Структурные
            graphDiameter: this.calculateGraphDiameter(),
            clusteringCoefficient: this.calculateClusteringCoefficient(),
           
            // 5. Геометрические (нормализованные)
            normalizedMetrics: {
                normalizedEdgeLengths: [],
                normalizedNodeDistribution: []
            }
        };
       
        // Вычислить степени узлов
        let totalDegree = 0;
        const degreeCounts = {};
       
        this.nodes.forEach(node => {
            totalDegree += node.degree;
            invariants.maxDegree = Math.max(invariants.maxDegree, node.degree);
           
            // Собрать гистограмму степеней
            degreeCounts[node.degree] = (degreeCounts[node.degree] || 0) + 1;
        });
       
        invariants.avgDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
       
        // Преобразовать гистограмму степеней в массив
        invariants.degreeHistogram = Object.entries(degreeCounts)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([degree, count]) => ({ degree: parseInt(degree), count }));
       
        // Вычислить длины рёбер
        let totalEdgeLength = 0;
        const edgeLengths = [];
       
        this.edges.forEach(edge => {
            totalEdgeLength += edge.length;
            edgeLengths.push(edge.length);
        });
       
        invariants.avgEdgeLength = edgeCount > 0 ? totalEdgeLength / edgeCount : 0;
       
        // Создать гистограмму длин рёбер (8 корзин)
        invariants.edgeLengthHistogram = this.createHistogram(edgeLengths, 8);
       
        // Нормализованные длины рёбер
        invariants.normalizedMetrics.normalizedEdgeLengths = [];
        this.edges.forEach(edge => {
            if (edge.normalizedLength) {
                invariants.normalizedMetrics.normalizedEdgeLengths.push(
                    edge.normalizedLength
                );
            }
        });
       
        // Нормализованное распределение узлов
        if (nodeCount > 0) {
            const xs = Array.from(this.nodes.values()).map(n => n.x);
            const ys = Array.from(this.nodes.values()).map(n => n.y);
            const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
            const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
            const maxDistance = Math.max(
                Math.max(...xs) - Math.min(...xs),
                Math.max(...ys) - Math.min(...ys)
            ) || 1;
           
            // Нормализовать координаты относительно центра и размера
            invariants.normalizedMetrics.normalizedNodeDistribution =
                Array.from(this.nodes.values()).map(node => ({
                    nx: (node.x - centerX) / maxDistance,
                    ny: (node.y - centerY) / maxDistance
                }));
        }
       
        // Кэшировать результаты
        this.cachedInvariants = invariants;
       
        console.log(`✅ Инварианты вычислены: ${nodeCount} узлов, ${edgeCount} рёбер, ` +
                   `диаметр=${invariants.graphDiameter}, кластеризация=${invariants.clusteringCoefficient.toFixed(3)}`);
       
        return invariants;
    }
   
    // 6. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
   
    // Вычислить диаметр графа (максимальное расстояние между узлами)
    calculateGraphDiameter() {
        if (this.nodes.size < 2) return 0;
       
        const nodeIds = Array.from(this.nodes.keys());
        let maxDistance = 0;
       
        // Простой алгоритм - ищем максимальное геометрическое расстояние
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
   
    // Вычислить коэффициент кластеризации
    calculateClusteringCoefficient() {
        if (this.nodes.size < 3) return 0;
       
        let totalCoefficient = 0;
        let nodesWithNeighbors = 0;
       
        this.nodes.forEach(node => {
            const neighbors = Array.from(node.neighbors);
            const k = neighbors.length;
           
            if (k < 2) {
                totalCoefficient += 0;
                return;
            }
           
            // Подсчитать количество рёбер между соседями
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
           
            // Коэффициент кластеризации для узла
            const maxPossibleEdges = k * (k - 1) / 2;
            const nodeCoefficient = maxPossibleEdges > 0 ?
                edgesBetweenNeighbors / maxPossibleEdges : 0;
           
            totalCoefficient += nodeCoefficient;
            nodesWithNeighbors++;
        });
       
        return nodesWithNeighbors > 0 ? totalCoefficient / nodesWithNeighbors : 0;
    }
   
    // Создать гистограмму
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
   
    // 7. СОХРАНИТЬ ГРАФ В JSON
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            createdAt: this.createdAt.toISOString(),
            lastUpdated: this.lastUpdated.toISOString(),
            nodes: Array.from(this.nodes.values()),
            edges: Array.from(this.edges.values()),
            invariants: this.getBasicInvariants()
        };
    }
   
    // 8. ЗАГРУЗИТЬ ГРАФ ИЗ JSON
    static fromJSON(data) {
        const graph = new SimpleGraph(data.name || 'Загруженный граф');
        graph.id = data.id || graph.id;
        graph.createdAt = new Date(data.createdAt || Date.now());
        graph.lastUpdated = new Date(data.lastUpdated || Date.now());
       
        // Загрузить узлы
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
       
        // Загрузить рёбра
        if (Array.isArray(data.edges)) {
            data.edges.forEach(edgeData => {
                graph.edges.set(edgeData.id, edgeData);
            });
        }
       
        // Восстановить кэш инвариантов
        if (data.invariants) {
            graph.cachedInvariants = data.invariants;
        }
       
        console.log(`📂 Загружен граф "${graph.name}" с ${graph.nodes.size} узлами`);
        return graph;
    }
   
    // 9. ПОЛУЧИТЬ СТАТИСТИКУ ГРАФА
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
            density: invariants.density.toFixed(3),
            created: this.createdAt.toLocaleString('ru-RU'),
            updated: this.lastUpdated.toLocaleString('ru-RU')
        };
    }
   
    // 10. ВИЗУАЛИЗАЦИЯ ГРАФА (для отладки)
    visualize() {
        console.log('\n🕸️  ВИЗУАЛИЗАЦИЯ ГРАФА:');
        console.log(`├─ Название: ${this.name}`);
        console.log(`├─ Узлы: ${this.nodes.size}`);
        console.log(`├─ Рёбра: ${this.edges.size}`);
       
        if (this.nodes.size > 0) {
            console.log('├─ Первые 3 узла:');
            let count = 0;
            for (const [id, node] of this.nodes) {
                if (count >= 3) break;
                console.log(`│  ├─ ${id}: (${node.x.toFixed(1)}, ${node.y.toFixed(1)}) ` +
                          `[уверенность: ${node.confidence.toFixed(2)}, степень: ${node.degree}]`);
                count++;
            }
        }
       
        if (this.edges.size > 0) {
            console.log('├─ Первые 3 ребра:');
            let count = 0;
            for (const [id, edge] of this.edges) {
                if (count >= 3) break;
                console.log(`│  ├─ ${id}: длина=${edge.length.toFixed(1)}, ` +
                          `норм.длина=${edge.normalizedLength?.toFixed(2) || 'н/д'}`);
                count++;
            }
        }
       
        const invariants = this.getBasicInvariants();
        console.log('└─ ИНВАРИАНТЫ:');
        console.log(`   ├─ Узлов: ${invariants.nodeCount}`);
        console.log(`   ├─ Рёбер: ${invariants.edgeCount}`);
        console.log(`   ├─ Средняя степень: ${invariants.avgDegree.toFixed(2)}`);
        console.log(`   ├─ Диаметр графа: ${invariants.graphDiameter}`);
        console.log(`   └─ Коэф. кластеризации: ${invariants.clusteringCoefficient.toFixed(3)}`);
    }
}

// Экспорт класса
module.exports = SimpleGraph;
