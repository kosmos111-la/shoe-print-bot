// modules/footprint/topology/SubgraphIsomorphism.js
// 🔥 ЖЕСТКАЯ ИДЕНТИФИКАЦИЯ: одна точка модели = одна точка в фото (или ничего)

class SubgraphIsomorphism {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.maxDepth = options.maxDepth || 2; // Глубина окрестности
        this.cache = new Map(); // Кеш результатов проверки
        this.cacheHits = 0;
        this.cacheMisses = 0;
       
        // 🔥 ЖЕСТКИЕ ПОРОГИ
        this.minMatchRatio = options.minMatchRatio || 0.9; // Минимум 90% узлов должны совпасть
        this.requireRootMatch = true; // Корневой узел ОБЯЗАТЕЛЬНО должен совпасть
        this.maxDegreeDiff = options.maxDegreeDiff || 1; // Максимальная разница в степени (строго)
       
        console.log('🔷 SubgraphIsomorphism создан (ЖЕСТКАЯ идентификация)');
        console.log(`   Глубина: ${this.maxDepth}, кеш активен`);
        console.log(`   Правило: одна точка = одна точка, совпадение ≥${this.minMatchRatio*100}%`);
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

        if (this.debug) {
            console.log(`\n   🔍 Жесткая проверка изоморфизма:`);
            console.log(`      A: ${nodeA.id.substring(0, 20)}... (степень ${nodeA.degree || '?'})`);
            console.log(`      B: ${nodeB.id.substring(0, 20)}... (степень ${nodeB.degree || '?'})`);
        }

        // ШАГ 1: Быстрая проверка степени корня
        if (Math.abs(nodeA.degree - nodeB.degree) > this.maxDegreeDiff) {
            if (this.debug) console.log(`   ❌ Степени корня слишком разные: ${nodeA.degree} vs ${nodeB.degree}`);
            this.cache.set(cacheKey, false);
            return false;
        }

        // ШАГ 2: Извлекаем подграфы
        const subgraphA = this.extractSubgraph(nodeA, graphA, checkDepth);
        const subgraphB = this.extractSubgraph(nodeB, graphB, checkDepth);

        if (this.debug) {
            console.log(`      Подграф A: ${subgraphA.nodes.size} узлов, ${subgraphA.edges.size} рёбер`);
            console.log(`      Подграф B: ${subgraphB.nodes.size} узлов, ${subgraphB.edges.size} рёбер`);
        }

        // ШАГ 3: Жесткие проверки
        if (!this.strictChecks(subgraphA, subgraphB)) {
            this.cache.set(cacheKey, false);
            return false;
        }

        // ШАГ 4: Поиск точного изоморфизма
        const mapping = this.findExactIsomorphism(subgraphA, subgraphB);
       
        if (!mapping) {
            if (this.debug) console.log(`   ❌ Точного изоморфизма не найдено`);
            this.cache.set(cacheKey, false);
            return false;
        }

        // ШАГ 5: Проверка качества совпадения
        const matchQuality = this.checkMappingQuality(mapping, subgraphA, subgraphB);
       
        // 🔥 ЖЕСТКОЕ УСЛОВИЕ: корневой узел должен совпасть
        if (!mapping.has(subgraphA.rootId)) {
            if (this.debug) console.log(`   ❌ Корневой узел не совпал`);
            this.cache.set(cacheKey, false);
            return false;
        }

        // 🔥 Совпадение должно быть высоким
        if (matchQuality < this.minMatchRatio) {
            if (this.debug) console.log(`   ❌ Качество совпадения太低: ${(matchQuality*100).toFixed(1)}% < ${this.minMatchRatio*100}%`);
            this.cache.set(cacheKey, false);
            return false;
        }

        if (this.debug) {
            console.log(`   ✅ ТОЧНОЕ СОВПАДЕНИЕ! Качество: ${(matchQuality*100).toFixed(1)}%`);
        }
       
        this.cache.set(cacheKey, true);
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

    // ==================== ЖЕСТКИЕ ПРОВЕРКИ ====================

    strictChecks(subA, subB) {
        // 1. Размер должен совпадать точно (или почти точно)
        const sizeDiff = Math.abs(subA.nodes.size - subB.nodes.size);
        if (sizeDiff > 1) { // Допускаем разницу максимум в 1 узел
            if (this.debug) console.log(`   ❌ Размеры слишком разные: ${subA.nodes.size} vs ${subB.nodes.size}`);
            return false;
        }
       
        // 2. Количество рёбер должно совпадать примерно
        const edgeDiff = Math.abs(subA.edges.size - subB.edges.size);
        if (edgeDiff > 2) { // Допускаем разницу в 2 ребра
            if (this.debug) console.log(`   ❌ Рёбер слишком разное количество: ${subA.edges.size} vs ${subB.edges.size}`);
            return false;
        }
       
        // 3. Распределение степеней должно совпадать (гистограмма)
        const histA = this.getDegreeHistogram(subA);
        const histB = this.getDegreeHistogram(subB);
       
        for (let deg = 0; deg <= 20; deg++) {
            const countA = histA[deg] || 0;
            const countB = histB[deg] || 0;
            if (Math.abs(countA - countB) > 1) { // Допускаем разницу в 1
                if (this.debug) console.log(`   ❌ Разное распределение степеней для deg=${deg}: ${countA} vs ${countB}`);
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
       
        // Ищем корневой узел в B с той же степенью
        for (const nodeB of nodesB) {
            if (nodeB.degree === rootA.degree) {
                rootB = nodeB;
                mapping.set(rootA.id, nodeB.id);
                usedB.add(nodeB.id);
                break;
            }
        }
       
        if (!rootB) {
            if (this.debug) console.log(`   ❌ Не найден корневой узел в B с той же степенью`);
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
           
            // Степени должны совпадать
            if (nodeA.degree !== nodeB.degree) continue;
           
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
                minMatchRatio: this.minMatchRatio,
                maxDegreeDiff: this.maxDegreeDiff,
                requireRootMatch: this.requireRootMatch
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
