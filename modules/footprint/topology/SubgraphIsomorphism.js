// modules/footprint/topology/SubgraphIsomorphism.js
// 🔥 АДАПТИВНАЯ ГЛУБИНА: сначала depth=2, если нет - depth=1

class SubgraphIsomorphism {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.maxDepth = options.maxDepth || 2; // Максимальная глубина
        this.cache = new Map(); // Кеш результатов проверки
        this.cacheHits = 0;
        this.cacheMisses = 0;
       
        // 🔥 ПОРОГИ ДЛЯ РАЗНОЙ ГЛУБИНЫ
        this.thresholds = {
            2: { minMatchRatio: 0.85, maxDegreeDiff: 2, maxSizeDiff: 2 }, // depth=2 - более мягкий
            1: { minMatchRatio: 0.95, maxDegreeDiff: 1, maxSizeDiff: 1 }  // depth=1 - очень строгий
        };
       
        console.log('🔷 SubgraphIsomorphism создан (АДАПТИВНАЯ глубина)');
        console.log(`   Глубина: сначала 2, если нет - 1`);
        console.log(`   Пороги: depth=2 ≥85%, depth=1 ≥95%`);
    }

    // ==================== ОСНОВНОЙ МЕТОД С АДАПТИВНОЙ ГЛУБИНОЙ ====================

    checkIsomorphism(nodeA, graphA, nodeB, graphB) {
        const cacheKey = `${nodeA.id}|${nodeB.id}`;
       
        // Проверяем кеш
        if (this.cache.has(cacheKey)) {
            this.cacheHits++;
            return this.cache.get(cacheKey);
        }
        this.cacheMisses++;

        if (this.debug) {
            console.log(`\n   🔍 Адаптивная проверка изоморфизма:`);
            console.log(`      A: ${nodeA.id.substring(0, 20)}... (степень ${nodeA.degree || '?'})`);
            console.log(`      B: ${nodeB.id.substring(0, 20)}... (степень ${nodeB.degree || '?'})`);
        }

        // ШАГ 1: Пробуем depth = 2 (максимальная глубина)
        if (this.checkWithDepth(nodeA, graphA, nodeB, graphB, 2)) {
            if (this.debug) console.log(`   ✅ НАЙДЕНО на глубине 2`);
            this.cache.set(cacheKey, true);
            return true;
        }

        // ШАГ 2: Если не получилось, пробуем depth = 1 (только прямые соседи)
        if (this.checkWithDepth(nodeA, graphA, nodeB, graphB, 1)) {
            if (this.debug) console.log(`   ✅ НАЙДЕНО на глубине 1`);
            this.cache.set(cacheKey, true);
            return true;
        }

        // ШАГ 3: Не нашли ни на какой глубине
        if (this.debug) console.log(`   ❌ НЕ НАЙДЕНО ни на какой глубине`);
        this.cache.set(cacheKey, false);
        return false;
    }

    // ==================== ПРОВЕРКА С ЗАДАННОЙ ГЛУБИНОЙ ====================

    checkWithDepth(nodeA, graphA, nodeB, graphB, depth) {
        const threshold = this.thresholds[depth];
        if (!threshold) return false;

        if (this.debug) {
            console.log(`      Попытка depth=${depth}...`);
        }

        // ШАГ 1: Быстрая проверка степени корня
        if (Math.abs(nodeA.degree - nodeB.degree) > threshold.maxDegreeDiff) {
            if (this.debug) console.log(`      ❌ Степени корня слишком разные: ${nodeA.degree} vs ${nodeB.degree}`);
            return false;
        }

        // ШАГ 2: Извлекаем подграфы
        const subgraphA = this.extractSubgraph(nodeA, graphA, depth);
        const subgraphB = this.extractSubgraph(nodeB, graphB, depth);

        if (this.debug) {
            console.log(`      Подграф A: ${subgraphA.nodes.size} узлов, ${subgraphA.edges.size} рёбер`);
            console.log(`      Подграф B: ${subgraphB.nodes.size} узлов, ${subgraphB.edges.size} рёбер`);
        }

        // ШАГ 3: Проверки для данной глубины
        if (!this.depthSpecificChecks(subgraphA, subgraphB, threshold)) {
            return false;
        }

        // ШАГ 4: Поиск точного изоморфизма
        const mapping = this.findExactIsomorphism(subgraphA, subgraphB);
       
        if (!mapping) {
            if (this.debug) console.log(`      ❌ Точного изоморфизма не найдено`);
            return false;
        }

        // ШАГ 5: Проверка качества совпадения
        const matchQuality = this.checkMappingQuality(mapping, subgraphA, subgraphB);
       
        // 🔥 Корневой узел должен совпасть обязательно
        if (!mapping.has(subgraphA.rootId)) {
            if (this.debug) console.log(`      ❌ Корневой узел не совпал`);
            return false;
        }

        if (matchQuality < threshold.minMatchRatio) {
            if (this.debug) console.log(`      ❌ Качество совпадения: ${(matchQuality*100).toFixed(1)}% < ${threshold.minMatchRatio*100}%`);
            return false;
        }

        if (this.debug) {
            console.log(`      ✅ Качество совпадения: ${(matchQuality*100).toFixed(1)}%`);
        }
       
        return true;
    }

    // ==================== ПРОВЕРКИ ДЛЯ КОНКРЕТНОЙ ГЛУБИНЫ ====================

    depthSpecificChecks(subA, subB, threshold) {
        // 1. Проверка размера
        const sizeDiff = Math.abs(subA.nodes.size - subB.nodes.size);
        if (sizeDiff > threshold.maxSizeDiff) {
            if (this.debug) console.log(`      ❌ Размеры слишком разные: ${subA.nodes.size} vs ${subB.nodes.size}`);
            return false;
        }
       
        // 2. Проверка распределения степеней
        const histA = this.getDegreeHistogram(subA);
        const histB = this.getDegreeHistogram(subB);
       
        for (let deg = 0; deg <= 20; deg++) {
            const countA = histA[deg] || 0;
            const countB = histB[deg] || 0;
            if (Math.abs(countA - countB) > 2) { // Допускаем небольшие расхождения
                if (this.debug) console.log(`      ❌ Разное распределение степеней для deg=${deg}: ${countA} vs ${countB}`);
                return false;
            }
        }
       
        return true;
    }

    // ==================== ИЗВЛЕЧЕНИЕ ПОДГРАФА ====================

    extractSubgraph(rootNode, fullGraph, depth) {
        const nodes = new Map();
        const edges = new Set();
       
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
                        queue.push({ node: neighbor, currentDepth: currentDepth + 1 });
                    }
                   
                    // Обновляем связи
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

        // Вычисляем степени в подграфе
        for (const node of nodes.values()) {
            node.degree = node.neighbors.length;
        }

        return {
            nodes,
            edges,
            rootId: rootNode.id,
            size: nodes.size,
            edgeCount: edges.size
        };
    }

    // ==================== ТОЧНЫЙ ИЗОМОРФИЗМ ====================

    findExactIsomorphism(subA, subB) {
        const nodesA = Array.from(subA.nodes.values());
        const nodesB = Array.from(subB.nodes.values());
       
        // Сортируем по степени для эвристики
        nodesA.sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id));
        nodesB.sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id));
       
        const mapping = new Map();
        const usedB = new Set();
       
        // Начинаем с корневого узла
        const rootA = subA.nodes.get(subA.rootId);
        let rootB = null;
       
        // Ищем корневой узел в B с похожей степенью
        for (const nodeB of nodesB) {
            if (Math.abs(nodeB.degree - rootA.degree) <= 1) { // Допускаем разницу в 1
                rootB = nodeB;
                mapping.set(rootA.id, nodeB.id);
                usedB.add(nodeB.id);
                break;
            }
        }
       
        if (!rootB) {
            return null;
        }
       
        // Рекурсивно строим изоморфизм
        if (!this.buildIsomorphism(nodesA, nodesB, mapping, usedB, 0, subA, subB)) {
            return null;
        }
       
        return mapping;
    }

    buildIsomorphism(nodesA, nodesB, mapping, usedB, index, subA, subB) {
        if (index >= nodesA.length) {
            return true;
        }
       
        const nodeA = nodesA[index];
       
        // Если узел уже сопоставлен, пропускаем
        if (mapping.has(nodeA.id)) {
            return this.buildIsomorphism(nodesA, nodesB, mapping, usedB, index + 1, subA, subB);
        }
       
        // Ищем кандидата в B
        for (const nodeB of nodesB) {
            // Пропускаем уже использованные
            if (usedB.has(nodeB.id)) continue;
           
            // Степени должны быть близки
            if (Math.abs(nodeA.degree - nodeB.degree) > 1) continue;
           
            // Проверяем совместимость с уже сопоставленными соседями
            if (!this.isCompatible(nodeA, nodeB, mapping, subA, subB)) continue;
           
            // Пробуем это сопоставление
            mapping.set(nodeA.id, nodeB.id);
            usedB.add(nodeB.id);
           
            if (this.buildIsomorphism(nodesA, nodesB, mapping, usedB, index + 1, subA, subB)) {
                return true;
            }
           
            // Откатываем
            mapping.delete(nodeA.id);
            usedB.delete(nodeB.id);
        }
       
        return false;
    }

    isCompatible(nodeA, nodeB, mapping, subA, subB) {
        // Проверяем всех уже сопоставленных соседей
        for (const neighborId of nodeA.neighbors) {
            if (mapping.has(neighborId)) {
                const mappedNeighbor = mapping.get(neighborId);
               
                // Проверяем, есть ли ребро между nodeB и mappedNeighbor в subB
                const edgeId = [nodeB.id, mappedNeighbor].sort().join('--');
                if (!subB.edges.has(edgeId)) {
                    return false;
                }
            }
        }
        return true;
    }

    // ==================== ПРОВЕРКА КАЧЕСТВА ====================

    checkMappingQuality(mapping, subA, subB) {
        let matchedNodes = 0;
        const totalNodes = Math.max(subA.nodes.size, subB.nodes.size);
       
        // Проверяем каждый узел из A
        for (const [nodeAId, nodeBId] of mapping) {
            const nodeA = subA.nodes.get(nodeAId);
            const nodeB = subB.nodes.get(nodeBId);
           
            if (!nodeA || !nodeB) continue;
           
            // Проверяем соседей этого узла
            let neighborsMatch = 0;
            for (const neighborAId of nodeA.neighbors) {
                if (mapping.has(neighborAId)) {
                    const neighborBId = mapping.get(neighborAId);
                    if (nodeB.neighbors.includes(neighborBId)) {
                        neighborsMatch++;
                    }
                }
            }
           
            // Если совпало больше половины соседей, считаем узел совпавшим
            if (neighborsMatch >= nodeA.neighbors.length / 2) {
                matchedNodes++;
            }
        }
       
        return matchedNodes / totalNodes;
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

    getDegreeHistogram(subgraph) {
        const hist = {};
        for (const node of subgraph.nodes.values()) {
            hist[node.degree] = (hist[node.degree] || 0) + 1;
        }
        return hist;
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
            thresholds: this.thresholds
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
