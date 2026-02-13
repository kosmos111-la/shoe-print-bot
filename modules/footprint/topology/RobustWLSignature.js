// modules/footprint/topology/RobustWLSignature.js
// 🔥 WEISFEILER-LEHMAN С УСТОЙЧИВОСТЬЮ К ИЗМЕНЕНИЯМ

class RobustWLSignature {
    constructor(options = {}) {
        this.iterations = options.iterations || 2;
        this.debug = options.debug || false;
       
        // Веса для разных признаков
        this.weights = {
            role: 0.35,        // роль узла (очень стабильна)
            zone: 0.25,         // зона (абсолютно стабильна)
            triangles: 0.2,     // треугольники (стабильны)
            degree: 0.1,        // степень (может меняться)
            neighbors: 0.1      // соседи (для контекста)
        };
       
        // Кеш для ускорения
        this.signatureCache = new Map();
        this.cacheHits = 0;
        this.cacheMisses = 0;
       
        console.log('🔷 RobustWLSignature создан');
        console.log(`   Итераций: ${this.iterations}, веса: роль=${this.weights.role}, зона=${this.weights.zone}`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    computeSignature(node, graph) {
        const cacheKey = `${node.id}|${this.iterations}`;
        if (this.signatureCache.has(cacheKey)) {
            this.cacheHits++;
            return this.signatureCache.get(cacheKey);
        }
        this.cacheMisses++;

        const neighbors = this.findNeighbors(node.id, graph);
       
        // Уровень 0: базовая подпись узла
        let signature = this.getNodeSignature(node, neighbors, graph);
       
        // Итеративное уточнение
        for (let iter = 0; iter < this.iterations; iter++) {
            // Собираем подписи соседей
            const neighborSignatures = [];
            for (const neighbor of neighbors) {
                const neighborNeighbors = this.findNeighbors(neighbor.id, graph);
                const neighborSig = this.getNodeSignature(neighbor, neighborNeighbors, graph);
                neighborSignatures.push(neighborSig);
            }
           
            // Сортируем для инвариантности
            neighborSignatures.sort((a, b) => a.localeCompare(b));
           
            // Новая подпись = старая + подписи соседей
            signature = this.hashString(signature + '|' + neighborSignatures.join('|'));
        }

        this.signatureCache.set(cacheKey, signature);
        return signature;
    }

    // ==================== ПОДПИСЬ УЗЛА (БЕЗ ИТЕРАЦИЙ) ====================

    getNodeSignature(node, neighbors, graph) {
        const features = [];
       
        // 1. Роль узла (самый важный признак)
        features.push(this.getNodeRole(node, neighbors, graph));
       
        // 2. Зона (второй по важности)
        features.push(this.getZone(node.y));
       
        // 3. Количество треугольников
        const triangleCount = this.countTriangles(neighbors, graph);
        features.push(`T${triangleCount}`);
       
        // 4. Степень (с ограничением)
        const degree = Math.min(neighbors.length, 10); // Ограничиваем до 10
        features.push(`D${degree}`);
       
        // 5. Роли соседей (обобщенно)
        const neighborRoles = {};
        for (const neighbor of neighbors) {
            const neighborNeighbors = this.findNeighbors(neighbor.id, graph);
            const role = this.getNodeRole(neighbor, neighborNeighbors, graph);
            neighborRoles[role] = (neighborRoles[role] || 0) + 1;
        }
       
        // Сортируем роли для инвариантности
        const sortedRoles = Object.entries(neighborRoles)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([role, count]) => `${role}${count}`);
       
        features.push(...sortedRoles);
       
        return features.join('|');
    }

    // ==================== ОПРЕДЕЛЕНИЕ РОЛИ ====================

    getNodeRole(node, neighbors, graph) {
        const degree = neighbors.length;
       
        // Лист
        if (degree === 1) return 'L';
       
        // Хаб (много связей)
        if (degree >= 6) return 'H';
       
        // Мост (два соседа, не связанных между собой)
        if (degree === 2) {
            const [a, b] = neighbors;
            if (!this.areConnected(a, b, graph)) {
                return 'B';
            }
        }
       
        // Клика (все соседи связаны между собой)
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
       
        // Обычный узел
        return 'R';
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

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

    findNeighbors(nodeId, graph) {
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

    getZone(y) {
        if (y > 350) return 'K'; // пятка (heel)
        if (y < 200) return 'N'; // носок (toe)
        return 'C'; // центр
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36).padStart(8, '0');
    }

    // ==================== СРАВНЕНИЕ ПОДПИСЕЙ ====================

    compareSignatures(sig1, sig2) {
        if (sig1 === sig2) return 1.0;
       
        // Если подписи разные, но могут быть похожи
        // Распарсить сложно, поэтому используем расстояние Хэмминга
        let diff = 0;
        for (let i = 0; i < Math.min(sig1.length, sig2.length); i++) {
            if (sig1[i] !== sig2[i]) diff++;
        }
       
        const similarity = 1 - (diff / Math.max(sig1.length, sig2.length));
        return Math.max(0, similarity);
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        return {
            cacheSize: this.signatureCache.size,
            cacheHits: this.cacheHits,
            cacheMisses: this.cacheMisses,
            hitRate: this.cacheHits + this.cacheMisses > 0
                ? (this.cacheHits / (this.cacheHits + this.cacheMisses) * 100).toFixed(1) + '%'
                : '0%'
        };
    }

    clearCache() {
        this.signatureCache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        console.log('🧹 Кеш RobustWLSignature очищен');
    }
}

module.exports = RobustWLSignature;
