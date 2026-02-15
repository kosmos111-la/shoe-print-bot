// modules/footprint/topology/RobustWLSignature.js
// 🔥 WEISFEILER-LEHMAN НА ПАТТЕРНАХ (ПОЛНАЯ ВЕРСИЯ)

class RobustWLSignature {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.iterations = options.iterations || 2;
       
        // Роли
        this.roles = ['L', 'B', 'H', 'C', 'R'];
       
        // Кеш для паттернов
        this.cache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
       
        console.log('🔷 RobustWLSignature (паттерновый) создан');
        console.log(`   Учитываем: распределение ролей, плотность треугольников, степень`);
    }

    // ==================== ОСНОВНОЙ МЕТОД: ВОЗВРАЩАЕТ ПАТТЕРНОВУЮ СТРОКУ ====================

    computePattern(node, graph) {
        const cacheKey = `${node.id}|pattern|${this.iterations}`;
        if (this.cache.has(cacheKey)) {
            this.cacheHits++;
            return this.cache.get(cacheKey);
        }
        this.cacheMisses++;

        const neighbors = this.findNodeNeighbors(node.id, graph);
       
        // Паттерн точки
        const pattern = {
            self: {
                role: this.getNodeRole(node, neighbors, graph),
                degree: neighbors.length,
                degreeBucket: this.getDegreeBucket(neighbors.length),
                triangleCount: this.countTriangles(neighbors, graph),
                triangleDensity: neighbors.length > 1
                    ? this.countTriangles(neighbors, graph) / (neighbors.length * (neighbors.length-1) / 2)
                    : 0,
                zone: this.getZone(node.y)
            },
            neighborRoles: this.getRoleDistribution(neighbors, graph),
            neighborStats: this.getNeighborStats(neighbors, graph),
            neighborCount: neighbors.length
        };
       
        const signature = this.patternToString(pattern);
        this.cache.set(cacheKey, signature);
        return signature;
    }

    // ==================== СБОР ПАТТЕРНОВ ====================

    getRoleDistribution(neighbors, graph) {
        const dist = { L: 0, B: 0, H: 0, C: 0, R: 0 };
       
        for (const neighbor of neighbors) {
            const neighborNeighbors = this.findNodeNeighbors(neighbor.id, graph);
            const role = this.getNodeRole(neighbor, neighborNeighbors, graph);
            dist[role]++;
        }
       
        return dist;
    }

    getNeighborStats(neighbors, graph) {
        if (neighbors.length === 0) {
            return { avgDegree: 0, avgTriangles: 0, avgDensity: 0 };
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
        const avgDensity = avgDegree > 1 ? avgTriangles / (avgDegree * (avgDegree - 1) / 2) : 0;
       
        return { avgDegree, avgTriangles, avgDensity };
    }

    patternToString(pattern) {
    const s = pattern.self;
    const n = pattern.neighborRoles;
    // Было: return `${s.role}|${s.degree}|${s.triangleDensity.toFixed(2)}|${n.L}x${n.B}x${n.H}x${n.C}x${n.R}`;
    // Стало (добавляем зону):
    return `${s.role}|${s.zone}|${s.degree}|${s.triangleDensity.toFixed(2)}|${n.L}x${n.B}x${n.H}x${n.C}x${n.R}`;
}

    // ==================== ПАРСИНГ ПАТТЕРНА ====================

 parsePattern(sig) {
    try {
        const parts = sig.split('|');
        if (parts.length < 5) {
            console.log(`   ⚠️ Слишком мало частей: ${parts.length}`);
            return null;
        }
       
        // parts: [role, zone, degree, density, roles]
        const roleDist = parts[4].split('x').map(Number);
       
        return {
            self: {
                role: parts[0],
                zone: parts[1],
                degree: parseInt(parts[2]),
                triangleDensity: parseFloat(parts[3])
            },
            neighborRoles: {
                L: roleDist[0] || 0,
                B: roleDist[1] || 0,
                H: roleDist[2] || 0,
                C: roleDist[3] || 0,
                R: roleDist[4] || 0
            }
        };
    } catch (e) {
        console.log(`   ❌ Ошибка парсинга: ${e.message}`);
        return null;
    }
}    // ==================== СРАВНЕНИЕ РАСПРЕДЕЛЕНИЙ ====================

    compareRoleDistributions(d1, d2) {
        let matches = 0;
        let total = 0;
       
        for (const role of this.roles) {
            const count1 = d1[role] || 0;
            const count2 = d2[role] || 0;
            matches += Math.min(count1, count2);
            total += Math.max(count1, count2);
        }
       
        return total > 0 ? matches / total : 1;
    }

    // ==================== ОСНОВНОЕ СРАВНЕНИЕ ПАТТЕРНОВ ====================

    comparePatterns(sig1, sig2) {
    if (sig1 === sig2) return 1.0;

   // console.log(`\n🔍 Сравнение подписей:`);
  //  console.log(`   sig1: ${sig1}`);
  //  console.log(`   sig2: ${sig2}`);

    const p1 = this.parsePattern(sig1);
    const p2 = this.parsePattern(sig2);

    if (!p1 || !p2) {
      //  console.log(`   ❌ Не удалось распарсить`);
        return 0;
    }

 //   console.log(`   ✅ Распарсено успешно`);
 //   console.log(`   p1: роль=${p1.self.role}, зона=${p1.self.zone}, степень=${p1.self.degree}, плотность=${p1.self.triangleDensity}`);
 //   console.log(`   p2: роль=${p2.self.role}, зона=${p2.self.zone}, степень=${p2.self.degree}, плотность=${p2.self.triangleDensity}`);

    const weights = {
        role: 0.25,
        zone: 0.20,
        degree: 0.15,
        density: 0.15,
        neighborRoles: 0.25
    };

    let score = 0;
   // let details = [];

    if (p1.self.role === p2.self.role) {
        score += weights.role;
        details.push(`роль: +${weights.role}`);
    } else {
        details.push(`роль: 0`);
    }

    if (p1.self.zone === p2.self.zone) {
        score += weights.zone;
        details.push(`зона: +${weights.zone}`);
    } else {
        details.push(`зона: 0`);
    }

    const degreeRatio = Math.min(p1.self.degree, p2.self.degree) /
                        Math.max(p1.self.degree, p2.self.degree, 1);
    score += degreeRatio * weights.degree;
    details.push(`степень: +${(degreeRatio * weights.degree).toFixed(3)} (ratio=${degreeRatio.toFixed(2)})`);

    const densityDiff = Math.abs(p1.self.triangleDensity - p2.self.triangleDensity);
    const densitySim = Math.max(0, 1 - densityDiff);
    score += densitySim * weights.density;
    details.push(`плотность: +${(densitySim * weights.density).toFixed(3)} (sim=${densitySim.toFixed(2)})`);

    const roleSim = this.compareRoleDistributions(p1.neighborRoles, p2.neighborRoles);
    score += roleSim * weights.neighborRoles;
    details.push(`роли соседей: +${(roleSim * weights.neighborRoles).toFixed(3)} (sim=${roleSim.toFixed(2)})`);

  //  console.log(`   Детали: ${details.join(', ')}`);
  //  console.log(`   ИТОГОВЫЙ SCORE: ${score.toFixed(3)}`);

    return score;
}

    // ==================== ОПРЕДЕЛЕНИЕ РОЛИ ====================

    getNodeRole(node, neighbors, graph) {
        const degree = neighbors.length;
       
        if (degree === 1) return 'L';
        if (degree >= 6) return 'H';
       
        if (degree === 2) {
            const [a, b] = neighbors;
            if (!this.areConnected(a, b, graph)) return 'B';
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

    // ==================== ПОДСЧЕТ ТРЕУГОЛЬНИКОВ ====================

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

    // ==================== ПРОВЕРКА СВЯЗИ ====================

    areConnected(a, b, graph) {
        if (!graph || !graph.edges) return false;
        const edgeId = [a.id, b.id].sort().join('--');
        return graph.edges.has(edgeId);
    }

    // ==================== ПОИСК СОСЕДЕЙ ====================

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

    // ==================== ОПРЕДЕЛЕНИЕ ЗОНЫ ====================

    getZone(y) {
        if (y > 350) return 'K';
        if (y < 200) return 'N';
        return 'C';
    }

    // ==================== БАКЕТ СТЕПЕНИ ====================

    getDegreeBucket(degree) {
        if (degree <= 2) return 'B0';
        if (degree <= 4) return 'B1';
        if (degree <= 6) return 'B2';
        if (degree <= 9) return 'B3';
        if (degree <= 12) return 'B4';
        return 'B5';
    }

    // ==================== ХЕШ-ФУНКЦИЯ (ДЛЯ СОВМЕСТИМОСТИ) ====================

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36).padStart(8, '0');
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
        console.log('🧹 Кеш RobustWLSignature очищен');
    }
}

module.exports = RobustWLSignature;
