// modules/footprint/topology/SubgraphIsomorphism.js
// 🔥 ТОЧНОЕ СОВПАДЕНИЕ ТОПОЛОГИЧЕСКИХ СТРУКТУР (100% точность)

class SubgraphIsomorphism {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.maxDepth = options.maxDepth || 2; // Глубина окрестности
        this.cache = new Map(); // Кеш результатов проверки
        this.cacheHits = 0;
        this.cacheMisses = 0;
       
        console.log('🔷 SubgraphIsomorphism создан (проверка изоморфизма подграфов)');
        console.log(`   Глубина: ${this.maxDepth}, кеш активен`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    checkIsomorphism(nodeA, graphA, nodeB, graphB, depth = null) {
        const checkDepth = depth || this.maxDepth;
        const cacheKey = `${nodeA.id}|${nodeB.id}|${checkDepth}`;
       
        // Проверяем кеш
        if (this.cache.has(cacheKey)) {
            this.cacheHits++;
            return this.cache.get(cacheKey);
        }
        this.cacheMisses++;

        // ШАГ 1: Извлекаем подграфы
        const subgraphA = this.extractSubgraph(nodeA, graphA, checkDepth);
        const subgraphB = this.extractSubgraph(nodeB, graphB, checkDepth);

        // ШАГ 2: Быстрые проверки (must-match)
        if (!this.quickChecks(subgraphA, subgraphB)) {
            this.cache.set(cacheKey, false);
            return false;
        }

        // ШАГ 3: Точная проверка изоморфизма
        const result = this.checkExactIsomorphism(subgraphA, subgraphB);
        this.cache.set(cacheKey, result);
       
        if (this.debug && result) {
            console.log(`   ✅ Изоморфизм: ${nodeA.id.substring(0, 12)}... ↔ ${nodeB.id.substring(0, 12)}...`);
            console.log(`      Узлов: ${subgraphA.nodes.size}, рёбер: ${subgraphA.edges.size}`);
        }
       
        return result;
    }

    // ==================== ИЗВЛЕЧЕНИЕ ПОДГРАФА ====================

    extractSubgraph(rootNode, fullGraph, depth) {
        const nodes = new Map();
        const edges = new Set();
        const nodeDepths = new Map();
       
        // BFS для сбора окрестности
        const queue = [{ node: rootNode, currentDepth: 0 }];
        const visited = new Set([rootNode.id]);
       
        nodes.set(rootNode.id, {
            id: rootNode.id,
            degree: 0,
            originalDegree: rootNode.degree || 0,
            neighbors: [],
            depth: 0
        });
        nodeDepths.set(rootNode.id, 0);

        while (queue.length > 0) {
            const { node, currentDepth } = queue.shift();
           
            if (currentDepth < depth) {
                const neighbors = this.findNodeNeighbors(node.id, fullGraph);
               
                for (const neighbor of neighbors) {
                    const neighborId = neighbor.id;
                   
                    // Добавляем ребро
                    const edgeId = [node.id, neighborId].sort().join('--');
                    edges.add(edgeId);
                   
                    // Добавляем узел, если ещё не видели
                    if (!visited.has(neighborId)) {
                        visited.add(neighborId);
                        nodes.set(neighborId, {
                            id: neighborId,
                            degree: 0,
                            originalDegree: neighbor.degree || 0,
                            neighbors: [],
                            depth: currentDepth + 1
                        });
                        nodeDepths.set(neighborId, currentDepth + 1);
                        queue.push({ node: neighbor, currentDepth: currentDepth + 1 });
                    }
                   
                    // Обновляем связи (не дублируем)
                    const nodeData = nodes.get(node.id);
                    if (!nodeData.neighbors.includes(neighborId)) {
                        nodeData.neighbors.push(neighborId);
                    }
                   
                    const neighborData = nodes.get(neighborId);
                    if (!neighborData.neighbors.includes(node.id)) {
                        neighborData.neighbors.push(node.id);
                    }
                }
            }
        }

        // Вычисляем степени в подграфе (важно: считаем только внутри подграфа!)
        for (const node of nodes.values()) {
            node.degree = node.neighbors.length;
        }

        return {
            nodes,
            edges,
            rootId: rootNode.id,
            nodeDepths,
            size: nodes.size,
            edgeCount: edges.size
        };
    }

    // ==================== БЫСТРЫЕ ПРОВЕРКИ ====================

    quickChecks(subA, subB) {
        // 1. Одинаковое количество узлов
        if (subA.nodes.size !== subB.nodes.size) {
            if (this.debug) console.log(`   ❌ Разное количество узлов: ${subA.nodes.size} vs ${subB.nodes.size}`);
            return false;
        }
       
        // 2. Одинаковое количество рёбер
        if (subA.edges.size !== subB.edges.size) {
            if (this.debug) console.log(`   ❌ Разное количество рёбер: ${subA.edges.size} vs ${subB.edges.size}`);
            return false;
        }
       
        // 3. Одинаковое распределение степеней (мультимножество)
        const degreesA = Array.from(subA.nodes.values()).map(n => n.degree).sort((a,b) => a-b);
        const degreesB = Array.from(subB.nodes.values()).map(n => n.degree).sort((a,b) => a-b);
       
        for (let i = 0; i < degreesA.length; i++) {
            if (degreesA[i] !== degreesB[i]) {
                if (this.debug) console.log(`   ❌ Разное распределение степеней: [${degreesA}] vs [${degreesB}]`);
                return false;
            }
        }
       
        // 4. Корневой узел имеет ту же степень
        const rootA = subA.nodes.get(subA.rootId);
        const rootB = subB.nodes.get(subB.rootId);
        if (rootA.degree !== rootB.degree) {
            if (this.debug) console.log(`   ❌ Разная степень корня: ${rootA.degree} vs ${rootB.degree}`);
            return false;
        }
       
        return true;
    }

    // ==================== ТОЧНАЯ ПРОВЕРКА ИЗОМОРФИЗМА ====================

    checkExactIsomorphism(subA, subB) {
        // Сортируем узлы по степени (эвристика для ускорения)
        const nodesA = Array.from(subA.nodes.values())
            .sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id));
       
        const nodesB = Array.from(subB.nodes.values())
            .sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id));
       
        // Начинаем с отображения корневых узлов
        const mapping = new Map();
        mapping.set(subA.rootId, subB.rootId);
       
        // Рекурсивный поиск изоморфизма
        return this.findIsomorphism(nodesA, nodesB, mapping, 1, subA, subB);
    }

    findIsomorphism(nodesA, nodesB, mapping, index, subA, subB) {
        if (index >= nodesA.length) {
            // Все узлы сопоставлены, проверяем рёбра
            return this.verifyEdges(mapping, subA, subB);
        }
       
        const nodeA = nodesA[index];
       
        // Если этот узел уже сопоставлен (корень), пропускаем
        if (mapping.has(nodeA.id)) {
            return this.findIsomorphism(nodesA, nodesB, mapping, index + 1, subA, subB);
        }
       
        // Ищем кандидата в B с той же степенью
        for (const nodeB of nodesB) {
            // Пропускаем уже сопоставленные
            if (Array.from(mapping.values()).includes(nodeB.id)) continue;
           
            // Должны совпадать степени
            if (nodeA.degree !== nodeB.degree) continue;
           
            // Проверяем совместимость с уже сопоставленными соседями
            if (!this.isCompatible(nodeA, nodeB, mapping, subA, subB)) continue;
           
            // Пробуем это сопоставление
            mapping.set(nodeA.id, nodeB.id);
           
            if (this.findIsomorphism(nodesA, nodesB, mapping, index + 1, subA, subB)) {
                return true;
            }
           
            // Откатываем
            mapping.delete(nodeA.id);
        }
       
        return false;
    }

    isCompatible(nodeA, nodeB, mapping, subA, subB) {
        // Проверяем всех уже сопоставленных соседей
        for (const neighborId of nodeA.neighbors) {
            if (mapping.has(neighborId)) {
                const mappedNeighbor = mapping.get(neighborId);
               
                // Должно быть ребро между nodeB и mappedNeighbor в subB
                const edgeId = [nodeB.id, mappedNeighbor].sort().join('--');
                if (!subB.edges.has(edgeId)) {
                    return false;
                }
            }
        }
        return true;
    }

    verifyEdges(mapping, subA, subB) {
        // Проверяем все рёбра из A
        for (const edge of subA.edges) {
            const [a1, a2] = edge.split('--');
           
            const b1 = mapping.get(a1);
            const b2 = mapping.get(a2);
           
            if (!b1 || !b2) return false;
           
            // Проверяем, есть ли ребро в B
            const mappedEdge = [b1, b2].sort().join('--');
            if (!subB.edges.has(mappedEdge)) {
                return false;
            }
        }
       
        // Проверяем все рёбра из B (обратное отображение)
        for (const edge of subB.edges) {
            const [b1, b2] = edge.split('--');
           
            // Находим прообразы
            let a1 = null, a2 = null;
            for (const [a, b] of mapping) {
                if (b === b1) a1 = a;
                if (b === b2) a2 = a;
            }
           
            if (!a1 || !a2) return false;
           
            // Проверяем, есть ли ребро в A
            const originalEdge = [a1, a2].sort().join('--');
            if (!subA.edges.has(originalEdge)) {
                return false;
            }
        }
       
        return true;
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        for (const edge of graph.edges) {
            const [a, b] = edge.split('--');
            if (a === nodeId) {
                const node = graph.nodes.get(b);
                if (node) neighbors.push(node);
            }
            if (b === nodeId) {
                const node = graph.nodes.get(a);
                if (node) neighbors.push(node);
            }
        }
        return neighbors;
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        return {
            cacheSize: this.cache.size,
            cacheHits: this.cacheHits,
            cacheMisses: this.cacheMisses,
            hitRate: this.cacheHits + this.cacheMisses > 0
                ? (this.cacheHits / (this.cacheHits + this.cacheMisses) * 100).toFixed(1) + '%'
                : '0%'
        };
    }

    clearCache() {
        this.cache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        console.log('🧹 Кеш изоморфизма очищен');
    }
}

module.exports = SubgraphIsomorphism;
