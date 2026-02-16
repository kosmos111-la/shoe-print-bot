// modules/footprint/topology/LocalGroupSignature.js
// 🔥 ЛОКАЛЬНЫЕ ГРУППЫ С ДИНАМИЧЕСКОЙ ГЛУБИНОЙ

class LocalGroupSignature {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.maxDepth = options.maxDepth || 4; // максимальная глубина
        this.targetCandidates = options.targetCandidates || 2; // желаемое число кандидатов
        this.useMorphology = options.useMorphology !== false;
       
        // Роли узлов
        this.roles = ['L', 'B', 'H', 'C', 'R'];
       
        // Кеш для ускорения
        this.cache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
       
        // Статистика по глубинам
        this.depthStats = {
            1: { used: 0, candidates: [] },
            2: { used: 0, candidates: [] },
            3: { used: 0, candidates: [] },
            4: { used: 0, candidates: [] }
        };
       
        console.log('🔷 LocalGroupSignature с ДИНАМИЧЕСКОЙ глубиной создан');
        console.log(`   Макс. глубина: ${this.maxDepth}`);
        console.log(`   Целевое число кандидатов: ${this.targetCandidates}`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    computeLocalSignature(nodeId, graph, morphologyMap = null, fixedDepth = null) {
        const depth = fixedDepth || this.maxDepth;
        const cacheKey = `${nodeId}|depth${depth}`;
       
        if (this.cache.has(cacheKey)) {
            this.cacheHits++;
            return this.cache.get(cacheKey);
        }
        this.cacheMisses++;

        // Получаем локальную группу
        const group = this.extractLocalGroup(nodeId, graph, depth);
       
        // Роль центральной точки
        const centerRole = this.getNodeRole(nodeId, group.nodes, group.edges);
       
        // Зона (для визуализации)
        const centerNode = graph.nodes.get(nodeId);
        const zone = centerNode ? this.getZone(centerNode.y) : 'C';
       
        // Статистика по группе
        const stats = this.computeGroupStats(group);
       
        // Морфология
        let morphology = '';
        if (this.useMorphology && morphologyMap && morphologyMap.has(nodeId)) {
            const m = morphologyMap.get(nodeId);
            morphology = `|${m.aspectRatio.toFixed(2)}|${m.compactness.toFixed(2)}|${m.angularity}`;
        } else {
            morphology = '|0.00|0.00|0';
        }
       
        // Собираем подпись
        const signature = `${centerRole}|${zone}|${depth}|${stats.triangleDensity.toFixed(2)}|${stats.roleDistStr}${morphology}`;
       
        this.cache.set(cacheKey, signature);
        return signature;
    }

    // ==================== ПОИСК ОПТИМАЛЬНОЙ ГЛУБИНЫ ====================

    findOptimalDepth(nodeId, photoGraph, modelGraph, modelNodes, morphologyMap = null) {
    console.time(`🔍 depth_${nodeId.substring(0,8)}`); // ← добавить
    const results = [];
       
        // Пробуем разные глубины
        for (let depth = 2; depth <= this.maxDepth; depth++) {
        console.time(`   depth${depth}_${nodeId.substring(0,8)}`);
            // Подпись для точки в фото
            const photoSig = this.computeLocalSignature(nodeId, photoGraph, morphologyMap, depth);
           
            // Ищем кандидатов в модели
            const candidates = [];
            for (const [modelId, modelNode] of modelNodes) {
                const modelSig = this.computeLocalSignature(modelId, modelGraph, morphologyMap, depth);
                const similarity = this.compareSignatures(photoSig, modelSig);
               
                if (similarity > 0.5) { // минимальный порог
                    candidates.push({
                        modelId,
                        similarity,
                        depth
                    });
                }
            }
           
            // Сортируем по сходству
            candidates.sort((a, b) => b.similarity - a.similarity);
           
            results.push({
                depth,
                candidates: candidates.slice(0, 5), // топ-5
                candidateCount: candidates.length,
                bestSimilarity: candidates.length > 0 ? candidates[0].similarity : 0
            });
           
            // Сохраняем статистику
            this.depthStats[depth].candidates.push(candidates.length);
           console.timeEnd(`   depth${depth}_${nodeId.substring(0,8)}`); // ← добавить
        }
       
        // Выбираем оптимальную глубину
        let bestDepth = 1;
        let bestScore = 0;
       
        for (const result of results) {
            // Чем ближе число кандидатов к targetCandidates, тем лучше
            const countScore = 1 - Math.min(1, Math.abs(result.candidateCount - this.targetCandidates) / 10);
            // Чем выше сходство лучшего кандидата, тем лучше
            const simScore = result.bestSimilarity;
            // Комбинируем
            const totalScore = countScore * 0.6 + simScore * 0.4;
           
            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestDepth = result.depth;
            }
        }
       
        // Обновляем статистику использования
        this.depthStats[bestDepth].used++;
       
        if (this.debug) {
            console.log(`   📊 Точка ${nodeId.substring(0,12)}... оптимальная глубина: ${bestDepth}`);
            results.forEach(r => {
                console.log(`      глубина ${r.depth}: ${r.candidateCount} кандидатов, best=${(r.bestSimilarity*100).toFixed(0)}%`);
            });
        }
       console.timeEnd(`🔍 depth_${nodeId.substring(0,8)}`); // ← добавить
        return {
            optimalDepth: bestDepth,
            candidates: results.find(r => r.depth === bestDepth)?.candidates || [],
            allResults: results
        };
    }

    // ==================== ИЗВЛЕЧЕНИЕ ЛОКАЛЬНОЙ ГРУППЫ ====================

    extractLocalGroup(centerId, graph, depth) {
        const nodes = new Map();
        const edges = new Set();
       
        const queue = [{ id: centerId, depth: 0 }];
        const visited = new Set([centerId]);
       
        const centerNode = graph.nodes.get(centerId);
        if (centerNode) {
            nodes.set(centerId, { ...centerNode, id: centerId });
        }
       
        while (queue.length > 0) {
            const { id: currentId, depth: currentDepth } = queue.shift();
           
            if (currentDepth >= depth) continue;
           
            const neighbors = this.findNodeNeighbors(currentId, graph);
           
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push({ id: neighbor.id, depth: currentDepth + 1 });
                }
               
                if (!nodes.has(neighbor.id)) {
                    nodes.set(neighbor.id, { ...neighbor, id: neighbor.id });
                }
               
                const edgeId = [currentId, neighbor.id].sort().join('--');
                edges.add(edgeId);
            }
        }
       
        // Добавляем рёбра между узлами группы
        const nodeIds = Array.from(nodes.keys());
        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                const a = nodeIds[i];
                const b = nodeIds[j];
                const edgeId = [a, b].sort().join('--');
                if (graph.edges.has(edgeId)) {
                    edges.add(edgeId);
                }
            }
        }
       
        return {
            centerId,
            nodes,
            edges,
            size: nodes.size
        };
    }

    // ==================== СТАТИСТИКА ГРУППЫ ====================

    computeGroupStats(group) {
        const roleCounts = { L: 0, B: 0, H: 0, C: 0, R: 0 };
        let triangleCount = 0;
       
        // Считаем роли (кроме центра)
        for (const [nodeId, node] of group.nodes) {
            if (nodeId === group.centerId) continue;
           
            const neighbors = this.findNodeNeighbors(nodeId, { nodes: group.nodes, edges: group.edges });
            const role = this.getNodeRole(nodeId, neighbors, { nodes: group.nodes, edges: group.edges });
            roleCounts[role]++;
        }
       
        // Считаем треугольники
        const nodeIds = Array.from(group.nodes.keys());
        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                for (let k = j + 1; k < nodeIds.length; k++) {
                    const a = nodeIds[i];
                    const b = nodeIds[j];
                    const c = nodeIds[k];
                   
                    const ab = [a, b].sort().join('--');
                    const bc = [b, c].sort().join('--');
                    const ca = [c, a].sort().join('--');
                   
                    if (group.edges.has(ab) && group.edges.has(bc) && group.edges.has(ca)) {
                        triangleCount++;
                    }
                }
            }
        }
       
        const possibleTriangles = group.size >= 3 ? (group.size * (group.size - 1) * (group.size - 2)) / 6 : 0;
        const triangleDensity = possibleTriangles > 0 ? triangleCount / possibleTriangles : 0;
       
        const roleDistStr = `L${roleCounts.L}B${roleCounts.B}H${roleCounts.H}C${roleCounts.C}R${roleCounts.R}`;
       
        return {
            roleCounts,
            roleDistStr,
            triangleCount,
            triangleDensity,
            groupSize: group.size
        };
    }

    // ==================== СРАВНЕНИЕ ПОДПИСЕЙ ====================

    compareSignatures(sig1, sig2) {
        if (sig1 === sig2) return 1.0;
       
        const p1 = this.parseSignature(sig1);
        const p2 = this.parseSignature(sig2);
       
        if (!p1 || !p2) return 0;
       
        // Веса зависят от глубины
        const depth = p1.depth || 2;
        const weights = {
            role: 0.20,
            zone: 0.05,
            density: 0.15,
            roleDist: 0.30,
            morphology: 0.30
        };
       
        let score = 0;
       
        if (p1.role === p2.role) score += weights.role;
        if (p1.zone === p2.zone) score += weights.zone;
       
        const densityDiff = Math.abs(p1.triangleDensity - p2.triangleDensity);
        score += Math.max(0, 1 - densityDiff) * weights.density;
       
        const roleSim = this.compareRoleDistributions(p1.roleDist, p2.roleDist);
        score += roleSim * weights.roleDist;
       
        if (p1.morphology && p2.morphology) {
            const morphSim = this.compareMorphology(p1.morphology, p2.morphology);
            score += morphSim * weights.morphology;
        }
       
        return score;
    }

    compareRoleDistributions(dist1, dist2) {
        let matches = 0;
        let total = 0;
       
        for (const role of this.roles) {
            const count1 = dist1[role] || 0;
            const count2 = dist2[role] || 0;
            matches += Math.min(count1, count2);
            total += Math.max(count1, count2);
        }
       
        return total > 0 ? matches / total : 1;
    }

    compareMorphology(m1, m2) {
        const aspectSim = 1 - Math.min(1, Math.abs(m1.aspectRatio - m2.aspectRatio) / 2);
        const compactSim = 1 - Math.min(1, Math.abs(m1.compactness - m2.compactness) / 5);
        const angleSim = m1.angularity === m2.angularity ? 1 : 0.5;
       
        return (aspectSim * 0.4 + compactSim * 0.4 + angleSim * 0.2);
    }

    // ==================== ПАРСИНГ ====================

    parseSignature(sig) {
        try {
            const parts = sig.split('|');
            if (parts.length < 6) return null;
           
            const role = parts[0];
            const zone = parts[1];
            const depth = parseInt(parts[2]);
            const triangleDensity = parseFloat(parts[3]);
           
            const roleStr = parts[4];
            const roleDist = { L: 0, B: 0, H: 0, C: 0, R: 0 };
           
            const matches = roleStr.match(/[LBHCR]\d+/g);
            if (matches) {
                for (const m of matches) {
                    const r = m[0];
                    const count = parseInt(m.substring(1));
                    roleDist[r] = count;
                }
            }
           
            let morphology = null;
            if (parts.length >= 7) {
                morphology = {
                    aspectRatio: parseFloat(parts[5]),
                    compactness: parseFloat(parts[6]),
                    angularity: parseInt(parts[7] || 0)
                };
            }
           
            return {
                role,
                zone,
                depth,
                triangleDensity,
                roleDist,
                morphology
            };
        } catch (e) {
            return null;
        }
    }

    // ==================== ОПРЕДЕЛЕНИЕ РОЛИ ====================

    getNodeRole(nodeId, neighbors, graph) {
        const degree = neighbors.length;
       
        if (degree === 1) return 'L';
        if (degree >= 6) return 'H';
       
        if (degree === 2) {
            const [a, b] = neighbors;
            if (!this.areConnected(a.id, b.id, graph)) return 'B';
        }
       
        if (degree >= 3) {
            let allConnected = true;
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    if (!this.areConnected(neighbors[i].id, neighbors[j].id, graph)) {
                        allConnected = false;
                        break;
                    }
                }
                if (!allConnected) break;
            }
            if (allConnected) return 'C';
        }
       
        return 'R';
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

    findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        if (!graph || !graph.edges) return neighbors;
       
        const edgesArray = Array.from(graph.edges);
        for (const edge of edgesArray) {
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

    areConnected(aId, bId, graph) {
        const edgeId = [aId, bId].sort().join('--');
        return graph.edges.has(edgeId);
    }

    getZone(y) {
        if (y > 350) return 'K';
        if (y < 200) return 'N';
        return 'C';
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        const stats = {
            cacheSize: this.cache.size,
            cacheHits: this.cacheHits,
            cacheMisses: this.cacheMisses,
            hitRate: this.cacheHits + this.cacheMisses > 0
                ? (this.cacheHits / (this.cacheHits + this.cacheMisses) * 100).toFixed(1) + '%'
                : '0%',
            depthStats: {}
        };
       
        for (let d = 1; d <= this.maxDepth; d++) {
            const candidates = this.depthStats[d].candidates;
            stats.depthStats[d] = {
                used: this.depthStats[d].used,
                avgCandidates: candidates.length > 0
                    ? (candidates.reduce((a, b) => a + b, 0) / candidates.length).toFixed(1)
                    : 0
            };
        }
       
        return stats;
    }

    clearCache() {
        this.cache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.depthStats = {
            1: { used: 0, candidates: [] },
            2: { used: 0, candidates: [] },
            3: { used: 0, candidates: [] },
            4: { used: 0, candidates: [] }
        };
        console.log('🧹 Кеш LocalGroupSignature очищен');
    }
}

module.exports = LocalGroupSignature;
