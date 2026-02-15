// modules/footprint/topology/LocalGroupSignature.js
// 🔥 ЛОКАЛЬНЫЕ ГРУППЫ - паттерны ближайшего окружения (2-3 уровня)

class LocalGroupSignature {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.depth = options.depth || 2; // глубина обхода (2-3 уровня)
        this.useMorphology = options.useMorphology !== false;
       
        // Роли узлов
        this.roles = ['L', 'B', 'H', 'C', 'R'];
       
        // Кеш для ускорения
        this.cache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
       
        console.log('🔷 LocalGroupSignature создан');
        console.log(`   Глубина обхода: ${this.depth}`);
        console.log(`   Учёт морфологии: ${this.useMorphology}`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    computeLocalSignature(nodeId, graph, morphologyMap = null) {
        const cacheKey = `${nodeId}|depth${this.depth}`;
        if (this.cache.has(cacheKey)) {
            this.cacheHits++;
            return this.cache.get(cacheKey);
        }
        this.cacheMisses++;

        // 1. Получаем локальную группу (node + соседи до depth)
        const group = this.extractLocalGroup(nodeId, graph, this.depth);
       
        // 2. Роль центральной точки
        const centerRole = this.getNodeRole(nodeId, group.nodes, group.edges);
       
        // 3. Зона (из координат, но это для визуализации, не для сравнения)
        const centerNode = graph.nodes.get(nodeId);
        const zone = centerNode ? this.getZone(centerNode.y) : 'C';
       
        // 4. Статистика по группе
        const stats = this.computeGroupStats(group);
       
        // 5. Морфология (если есть)
        let morphology = '';
        if (this.useMorphology && morphologyMap && morphologyMap.has(nodeId)) {
            const m = morphologyMap.get(nodeId);
            morphology = `|${m.aspectRatio.toFixed(2)}|${m.compactness.toFixed(2)}`;
        } else {
            morphology = '|0.00|0.00';
        }
       
        // 6. Собираем подпись
        const signature = `${centerRole}|${zone}|${stats.triangleDensity.toFixed(2)}|${stats.roleDistStr}${morphology}`;
       
        this.cache.set(cacheKey, signature);
        return signature;
    }

    // ==================== ИЗВЛЕЧЕНИЕ ЛОКАЛЬНОЙ ГРУППЫ ====================

    extractLocalGroup(centerId, graph, depth) {
        const nodes = new Map(); // nodeId -> node
        const edges = new Set();  // edge strings
       
        // Очередь для BFS: [nodeId, currentDepth]
        const queue = [{ id: centerId, depth: 0 }];
        const visited = new Set([centerId]);
       
        // Добавляем центральную точку
        const centerNode = graph.nodes.get(centerId);
        if (centerNode) {
            nodes.set(centerId, { ...centerNode, id: centerId });
        }
       
        while (queue.length > 0) {
            const { id: currentId, depth: currentDepth } = queue.shift();
           
            if (currentDepth >= depth) continue;
           
            // Находим соседей
            const neighbors = this.findNodeNeighbors(currentId, graph);
           
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push({ id: neighbor.id, depth: currentDepth + 1 });
                }
               
                // Добавляем узел
                if (!nodes.has(neighbor.id)) {
                    nodes.set(neighbor.id, { ...neighbor, id: neighbor.id });
                }
               
                // Добавляем ребро
                const edgeId = [currentId, neighbor.id].sort().join('--');
                edges.add(edgeId);
            }
        }
       
        // Добавляем рёбра между узлами группы (не только от центра)
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
        let totalNodes = 0;
        let triangleCount = 0;
       
        // Считаем роли
        for (const [nodeId, node] of group.nodes) {
            if (nodeId === group.centerId) continue; // центр не входит в распределение соседей
           
            const neighbors = this.findNodeNeighbors(nodeId, { nodes: group.nodes, edges: group.edges });
            const role = this.getNodeRole(nodeId, neighbors, { nodes: group.nodes, edges: group.edges });
            roleCounts[role]++;
            totalNodes++;
        }
       
        // Считаем треугольники в группе
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
       
        // Плотность треугольников
        const possibleTriangles = group.size >= 3 ? (group.size * (group.size - 1) * (group.size - 2)) / 6 : 0;
        const triangleDensity = possibleTriangles > 0 ? triangleCount / possibleTriangles : 0;
       
        // Строка распределения ролей
        const roleDistStr = `L${roleCounts.L}B${roleCounts.B}H${roleCounts.H}C${roleCounts.C}R${roleCounts.R}`;
       
        return {
            roleCounts,
            roleDistStr,
            triangleCount,
            triangleDensity,
            totalNodes
        };
    }

    // ==================== СРАВНЕНИЕ ПОДПИСЕЙ ====================

    compareSignatures(sig1, sig2) {
        if (sig1 === sig2) return 1.0;
       
        const p1 = this.parseSignature(sig1);
        const p2 = this.parseSignature(sig2);
       
        if (!p1 || !p2) return 0;
       
        // Веса для разных компонентов
        const weights = {
            role: 0.25,        // роль центральной точки
            zone: 0.10,         // зона (носок/центр/пятка) - низкий вес
            density: 0.20,      // плотность треугольников в группе
            roleDist: 0.30,     // распределение ролей соседей
            morphology: 0.15    // морфология фигуры
        };
       
        let score = 0;
       
        // Роль центра
        if (p1.role === p2.role) score += weights.role;
       
        // Зона
        if (p1.zone === p2.zone) score += weights.zone;
       
        // Плотность треугольников
        const densityDiff = Math.abs(p1.triangleDensity - p2.triangleDensity);
        const densitySim = Math.max(0, 1 - densityDiff);
        score += densitySim * weights.density;
       
        // Распределение ролей соседей
        const roleSim = this.compareRoleDistributions(p1.roleDist, p2.roleDist);
        score += roleSim * weights.roleDist;
       
        // Морфология
        if (p1.morphology && p2.morphology) {
            const aspectSim = 1 - Math.min(1, Math.abs(p1.morphology.aspectRatio - p2.morphology.aspectRatio) / 2);
            const compactSim = 1 - Math.min(1, Math.abs(p1.morphology.compactness - p2.morphology.compactness) / 5);
            const morphSim = (aspectSim + compactSim) / 2;
            score += morphSim * weights.morphology;
        } else {
            // Если морфологии нет, перераспределяем вес на roleDist
            score += weights.morphology * 0.5; // частичный бонус
        }
       
        return Math.min(1, Math.max(0, score));
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

    // ==================== ПАРСИНГ ====================

    parseSignature(sig) {
        try {
            const parts = sig.split('|');
            if (parts.length < 5) return null;
           
            // parts: [role, zone, density, roleDist, aspectRatio, compactness]
            const role = parts[0];
            const zone = parts[1];
            const triangleDensity = parseFloat(parts[2]);
           
            // Парсим распределение ролей: L2B1H3C0R1
            const roleStr = parts[3];
            const roleDist = { L: 0, B: 0, H: 0, C: 0, R: 0 };
           
            const matches = roleStr.match(/[LBHCR]\d+/g);
            if (matches) {
                for (const m of matches) {
                    const r = m[0];
                    const count = parseInt(m.substring(1));
                    roleDist[r] = count;
                }
            }
           
            // Морфология
            let morphology = null;
            if (parts.length >= 6) {
                morphology = {
                    aspectRatio: parseFloat(parts[4]),
                    compactness: parseFloat(parts[5])
                };
            }
           
            return {
                role,
                zone,
                triangleDensity,
                roleDist,
                morphology
            };
        } catch (e) {
            if (this.debug) console.log(`   ❌ Ошибка парсинга: ${e.message}`);
            return null;
        }
    }

    // ==================== ОПРЕДЕЛЕНИЕ РОЛИ ====================

    getNodeRole(nodeId, neighbors, graph) {
        const degree = neighbors.length;
       
        // Лист
        if (degree === 1) return 'L';
       
        // Хаб (много связей)
        if (degree >= 6) return 'H';
       
        // Мост (два соседа, не связанных между собой)
        if (degree === 2) {
            const [a, b] = neighbors;
            if (!this.areConnected(a.id, b.id, graph)) {
                return 'B';
            }
        }
       
        // Клика (все соседи связаны между собой)
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
       
        // Обычный узел
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
        if (y > 350) return 'K'; // пятка
        if (y < 200) return 'N'; // носок
        return 'C'; // центр
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
            depth: this.depth
        };
    }

    clearCache() {
        this.cache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        console.log('🧹 Кеш LocalGroupSignature очищен');
    }
}

module.exports = LocalGroupSignature;
