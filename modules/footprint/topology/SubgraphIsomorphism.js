// modules/footprint/topology/SubgraphIsomorphism.js
// 🔥 ПРОВЕРКА ИЗОМОРФИЗМА ПОДГРАФОВ С ОСЛАБЛЕННЫМИ ПРОВЕРКАМИ ДЛЯ РЕАЛЬНЫХ ДАННЫХ

class SubgraphIsomorphism {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.maxDepth = options.maxDepth || 2; // Глубина окрестности
        this.cache = new Map(); // Кеш результатов проверки
        this.cacheHits = 0;
        this.cacheMisses = 0;
       
        // Пороги для ослабленных проверок
        this.maxSizeDiffRatio = options.maxSizeDiffRatio || 0.3; // Максимальная разница в размере (30%)
        this.maxDegreeDiff = options.maxDegreeDiff || 2; // Максимальная разница в степени корня
        this.minMatchRatio = options.minMatchRatio || 0.7; // Минимальное совпадение узлов (70%)
        this.minNeighborJaccard = options.minNeighborJaccard || 0.5; // Минимальное совпадение соседей (50%)
       
        console.log('🔷 SubgraphIsomorphism создан (проверка изоморфизма подграфов)');
        console.log(`   Глубина: ${this.maxDepth}, кеш активен`);
        console.log(`   Ослабленные проверки: размер ±30%, степень корня ±2, совпадение узлов ≥70%`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    checkIsomorphism(nodeA, graphA, nodeB, graphB, depth = null) {
        const checkDepth = depth || this.maxDepth;
        const cacheKey = `${nodeA.id}|${nodeB.id}|${checkDepth}`;
       
        // Проверяем кеш
        if (this.cache.has(cacheKey)) {
            this.cacheHits++;
            if (this.debug) console.log(`   🔍 Кеш: ${cacheKey.substring(0, 30)}... → ${this.cache.get(cacheKey)}`);
            return this.cache.get(cacheKey);
        }
        this.cacheMisses++;

        if (this.debug) {
            console.log(`\n   🔍 Проверка изоморфизма:`);
            console.log(`      A: ${nodeA.id.substring(0, 20)}... (степень ${nodeA.degree || '?'})`);
            console.log(`      B: ${nodeB.id.substring(0, 20)}... (степень ${nodeB.degree || '?'})`);
        }

        // ШАГ 1: Извлекаем подграфы
        const subgraphA = this.extractSubgraph(nodeA, graphA, checkDepth);
        const subgraphB = this.extractSubgraph(nodeB, graphB, checkDepth);

        if (this.debug) {
            console.log(`      Подграф A: ${subgraphA.nodes.size} узлов, ${subgraphA.edges.size} рёбер`);
            console.log(`      Подграф B: ${subgraphB.nodes.size} узлов, ${subgraphB.edges.size} рёбер`);
        }

        // ШАГ 2: Ослабленные проверки
        if (!this.relaxedChecks(subgraphA, subgraphB)) {
            this.cache.set(cacheKey, false);
            return false;
        }

        // ШАГ 3: Поиск соответствия с учетом возможных расхождений
        const result = this.findRelaxedIsomorphism(subgraphA, subgraphB);
        this.cache.set(cacheKey, result);
       
        if (this.debug && result) {
            console.log(`   ✅ ИЗОМОРФИЗМ ПОДТВЕРЖДЕН (совпадение ${(result.matchRatio * 100).toFixed(1)}%)`);
        } else if (this.debug) {
            console.log(`   ❌ ИЗОМОРФИЗМ НЕ ПОДТВЕРЖДЕН`);
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

    // ==================== ОСЛАБЛЕННЫЕ ПРОВЕРКИ ====================

    relaxedChecks(subA, subB) {
        // 1. Размеры могут отличаться (до maxSizeDiffRatio)
        const sizeDiff = Math.abs(subA.nodes.size - subB.nodes.size);
        const maxSize = Math.max(subA.nodes.size, subB.nodes.size);
        const sizeDiffRatio = sizeDiff / maxSize;
       
        if (sizeDiffRatio > this.maxSizeDiffRatio) {
            if (this.debug) console.log(`   ❌ Слишком большая разница в размере: ${subA.nodes.size} vs ${subB.nodes.size} (${(sizeDiffRatio*100).toFixed(1)}%)`);
            return false;
        }
       
        // 2. Степень корня может отличаться (до maxDegreeDiff)
        const rootA = subA.nodes.get(subA.rootId);
        const rootB = subB.nodes.get(subB.rootId);
        const degreeDiff = Math.abs(rootA.degree - rootB.degree);
       
        if (degreeDiff > this.maxDegreeDiff) {
            if (this.debug) console.log(`   ❌ Слишком большая разница в степени корня: ${rootA.degree} vs ${rootB.degree} (разница ${degreeDiff})`);
            return false;
        }
       
        // 3. Проверяем распределение степеней (гистограмма)
        const histA = this.getDegreeHistogram(subA);
        const histB = this.getDegreeHistogram(subB);
       
        // Степени должны быть похожи (допускаем небольшие отклонения)
        for (let deg = 0; deg <= 20; deg++) {
            const countA = histA[deg] || 0;
            const countB = histB[deg] || 0;
            const diff = Math.abs(countA - countB);
           
            if (diff > 2 && countA > 0 && countB > 0) {
                if (this.debug) console.log(`   ❌ Слишком большая разница для степени ${deg}: ${countA} vs ${countB}`);
                return false;
            }
        }
       
        return true;
    }

    getDegreeHistogram(subgraph) {
        const hist = {};
        for (const node of subgraph.nodes.values()) {
            hist[node.degree] = (hist[node.degree] || 0) + 1;
        }
        return hist;
    }

    // ==================== ПОИСК СООТВЕТСТВИЯ ====================

    findRelaxedIsomorphism(subA, subB) {
        const nodesA = Array.from(subA.nodes.values());
        const nodesB = Array.from(subB.nodes.values());
       
        let matchedCount = 0;
        const usedB = new Set();
        const matches = [];
       
        // Жадный алгоритм: для каждого узла из A ищем похожий в B
        for (const nodeA of nodesA) {
            let bestMatch = null;
            let bestScore = 0;
            let bestNeighborJaccard = 0;
           
            for (const nodeB of nodesB) {
                if (usedB.has(nodeB.id)) continue;
               
                // Сравниваем степени (основной признак)
                const degreeDiff = Math.abs(nodeA.degree - nodeB.degree);
                if (degreeDiff > 2) continue; // Слишком большая разница
               
                // Сравниваем соседей (Jaccard similarity)
                const neighborsA = new Set(nodeA.neighbors);
                const neighborsB = new Set(nodeB.neighbors);
               
                const intersection = new Set([...neighborsA].filter(x => neighborsB.has(x)));
                const union = new Set([...neighborsA, ...neighborsB]);
               
                const jaccard = union.size > 0 ? intersection.size / union.size : 1;
               
                // Комбинированная оценка
                const degreeScore = 1 - (degreeDiff / Math.max(nodeA.degree, nodeB.degree, 1));
                const combinedScore = degreeScore * 0.3 + jaccard * 0.7;
               
                if (combinedScore > bestScore && jaccard >= this.minNeighborJaccard) {
                    bestScore = combinedScore;
                    bestNeighborJaccard = jaccard;
                    bestMatch = nodeB;
                }
            }
           
            if (bestMatch) {
                matchedCount++;
                usedB.add(bestMatch.id);
                matches.push({
                    nodeA: nodeA.id,
                    nodeB: bestMatch.id,
                    score: bestScore,
                    neighborJaccard: bestNeighborJaccard
                });
               
                if (this.debug) {
                    console.log(`      Совпадение: ${nodeA.id.substring(0, 12)}... ↔ ${bestMatch.id.substring(0, 12)}... (Jaccard: ${(bestNeighborJaccard*100).toFixed(1)}%)`);
                }
            }
        }
       
        const matchRatio = matchedCount / Math.max(nodesA.length, nodesB.length);
       
        if (this.debug) {
            console.log(`      Совпало узлов: ${matchedCount}/${nodesA.length} (${(matchRatio*100).toFixed(1)}%)`);
        }
       
        return {
            isMatch: matchRatio >= this.minMatchRatio,
            matchRatio,
            matchedCount,
            totalNodesA: nodesA.length,
            totalNodesB: nodesB.length,
            matches
        };
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
                : '0%',
            thresholds: {
                maxSizeDiffRatio: this.maxSizeDiffRatio,
                maxDegreeDiff: this.maxDegreeDiff,
                minMatchRatio: this.minMatchRatio,
                minNeighborJaccard: this.minNeighborJaccard
            }
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
