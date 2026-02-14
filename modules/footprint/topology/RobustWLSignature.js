// modules/footprint/topology/RobustWLSignature.js
// 🔥 WEISFEILER-LEHMAN НА ПАТТЕРНАХ (устойчив к удалению точек)

class RobustWLSignature {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.iterations = options.iterations || 2;
       
        // Роли (как и раньше)
        this.roles = ['L', 'B', 'H', 'C', 'R'];
       
        // Кеш для ускорения
        this.cache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
       
        console.log('🔷 RobustWLSignature (паттерновый) создан');
        console.log(`   Учитываем: распределение ролей, плотность треугольников, степень`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    computeSignature(node, graph) {
        const cacheKey = `${node.id}|${this.iterations}`;
        if (this.cache.has(cacheKey)) {
            this.cacheHits++;
            return this.cache.get(cacheKey);
        }
        this.cacheMisses++;

        const neighbors = this.findNodeNeighbors(node.id, graph);
       
        // 1. Базовые характеристики узла
        const nodeRole = this.getNodeRole(node, neighbors, graph);
        const nodeDegree = neighbors.length;
        const nodeTriangleCount = this.countTriangles(neighbors, graph);
       
        // 2. Статистика окрестности (ПАТТЕРНЫ!)
        const pattern = {
            // Характеристики самой точки
            self: {
                role: nodeRole,
                degree: nodeDegree,
                degreeBucket: this.getDegreeBucket(nodeDegree),
                triangleCount: nodeTriangleCount,
                triangleDensity: nodeDegree > 1 ? nodeTriangleCount / (nodeDegree * (nodeDegree-1) / 2) : 0
            },
           
            // Распределение ролей среди соседей
            neighborRoles: this.getRoleDistribution(neighbors, graph),
           
            // Статистика соседей (усредненная)
            neighborStats: this.getNeighborStats(neighbors, graph),
           
            // Количество треугольников в окрестности
            totalTriangles: nodeTriangleCount,
           
            // Количество соседей
            neighborCount: nodeDegree
        };
       
        // 3. Сериализуем в компактную строку
        const signature = this.patternToString(pattern);
       
        this.cache.set(cacheKey, signature);
        return signature;
    }

    // ==================== СБОР ПАТТЕРНОВ ====================

    getRoleDistribution(neighbors, graph) {
        const dist = {
            L: 0, B: 0, H: 0, C: 0, R: 0
        };
       
        for (const neighbor of neighbors) {
            const neighborNeighbors = this.findNodeNeighbors(neighbor.id, graph);
            const role = this.getNodeRole(neighbor, neighborNeighbors, graph);
            dist[role]++;
        }
       
        return dist;
    }

    getNeighborStats(neighbors, graph) {
        if (neighbors.length === 0) {
            return {
                avgDegree: 0,
                avgTriangles: 0,
                avgDensity: 0
            };
        }
       
        let totalDegree = 0;
        let totalTriangles = 0;
       
        for (const neighbor of neighbors) {
            const neighborNeighbors = this.findNodeNeighbors(neighbor.id, graph);
            totalDegree += neighborNeighbors.length;
            totalTriangles += this.countTriangles(neighborNeighbors, graph);
        }
       
        const avgDegree = totalDegree / neighbors.length;
        const avgTriangles = totalTriangles / neighbors.length;
        const avgDensity = avgDegree > 1 ?
            avgTriangles / (avgDegree * (avgDegree - 1) / 2) : 0;
       
        return {
            avgDegree,
            avgTriangles,
            avgDensity
        };
    }

    patternToString(pattern) {
        // Компактное представление: роль|степень|плотность|LxBxHxCxR|avgDeg|avgTri
        const s = pattern.self;
        const n = pattern.neighborRoles;
        const ns = pattern.neighborStats;
       
        return `${s.role}|${s.degree}|${s.triangleDensity.toFixed(2)}|` +
               `${n.L}x${n.B}x${n.H}x${n.C}x${n.R}|` +
               `${ns.avgDegree.toFixed(1)}|${ns.avgTriangles.toFixed(1)}`;
    }

    // ==================== СРАВНЕНИЕ ПАТТЕРНОВ ====================

    comparePatterns(sig1, sig2) {
        if (sig1 === sig2) return 1.0;
       
        // Парсим паттерны
        const p1 = this.parsePattern(sig1);
        const p2 = this.parsePattern(sig2);
       
        if (!p1 || !p2) return 0;
       
        // 1. Сравнение роли (40% веса)
        let score = 0;
        if (p1.self.role === p2.self.role) score += 0.4;
       
        // 2. Сравнение распределения ролей соседей (30% веса)
        const roleSim = this.compareRoleDistributions(
            p1.neighborRoles, p2.neighborRoles
        );
        score += roleSim * 0.3;
       
        // 3. Сравнение плотности треугольников (20% веса)
        const densitySim = 1 - Math.abs(p1.self.triangleDensity - p2.self.triangleDensity);
        score += Math.max(0, densitySim) * 0.2;
       
        // 4. Сравнение степени (10% веса)
        const degreeDiff = Math.abs(p1.self.degree - p2.self.degree);
        const degreeSim = 1 - (degreeDiff / Math.max(p1.self.degree, p2.self.degree, 1));
        score += Math.max(0, degreeSim) * 0.1;
       
        return score;
    }

    compareRoleDistributions(d1, d2) {
        let total = 0;
        let matches = 0;
       
        for (const role of this.roles) {
            const count1 = d1[role] || 0;
            const count2 = d2[role] || 0;
            total += Math.max(count1, count2);
            matches += Math.min(count1, count2);
        }
       
        return total > 0 ? matches / total : 1;
    }

    parsePattern(sig) {
        try {
            const parts = sig.split('|');
            if (parts.length < 6) return null;
           
            const roleDist = parts[3].split('x').map(Number);
           
            return {
                self: {
                    role: parts[0],
                    degree: parseInt(parts[1]),
                    triangleDensity: parseFloat(parts[2])
                },
                neighborRoles: {
                    L: roleDist[0] || 0,
                    B: roleDist[1] || 0,
                    H: roleDist[2] || 0,
                    C: roleDist[3] || 0,
                    R: roleDist[4] || 0
                },
                neighborStats: {
                    avgDegree: parseFloat(parts[4]),
                    avgTriangles: parseFloat(parts[5])
                }
            };
        } catch (e) {
            return null;
        }
    }

    // ==================== СУЩЕСТВУЮЩИЕ МЕТОДЫ ====================

    getNodeRole(node, neighbors, graph) {
        const degree = neighbors.length;
       
        if (degree === 1) return 'L';
        if (degree >= 6) return 'H';
       
        if (degree === 2) {
            const [a, b] = neighbors;
            if (!this.areConnected(a, b, graph)) {
                return 'B';
            }
        }
       
        if (degree >= 3) {
            let allConnected = true;
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    if (!this.areConnected(neighbors[i], neighbors[j], graph)) {
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

    countTriangles(neighbors, graph) {
        let count = 0;
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                if (this.areConnected(neighbors[i], neighbors[j], graph)) {
                    count++;
                }
            }
        }
        return count;
    }

    areConnected(a, b, graph) {
        const edgeId = [a.id, b.id].sort().join('--');
        return graph.edges.has(edgeId);
    }

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

    getDegreeBucket(degree) {
        if (degree <= 2) return 'B0';
        if (degree <= 4) return 'B1';
        if (degree <= 6) return 'B2';
        if (degree <= 9) return 'B3';
        if (degree <= 12) return 'B4';
        return 'B5';
    }

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
        console.log('🧹 Кеш RobustWLSignature очищен');
    }
}

module.exports = RobustWLSignature;
