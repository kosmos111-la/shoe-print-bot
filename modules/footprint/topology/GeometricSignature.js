// modules/footprint/topology/GeometricSignature.js
// 🎯 ИДЕНТИФИКАЦИЯ ТОЧЕК ЧЕРЕЗ WL-ПОДПИСИ (совместимо с TopologicalFingerprint)

class GeometricSignature {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище сигнатур
        this.signatures = new Map();
       
        // Кластеры
        this.clusters = new Map();
       
        // 🔥 Те же бакеты, что в TopologicalFingerprint
        this.degreeBuckets = [
            [0, 2],   // B0: листья
            [3, 4],   // B1: низкая
            [5, 6],   // B2: средняя
            [7, 9],   // B3: высокая
            [10, 12], // B4: очень высокая
            [13, 100] // B5: экстремальная
        ];
       
        // Статистика
        this.stats = {
            totalIdentified: 0,
            totalRejected: 0,
            totalClusters: 0,
            totalClusterMembers: 0
        };
       
        console.log('🎯 GeometricSignature создана (WL-идентификация)');
    }

    // ==================== ВЫЧИСЛЕНИЕ WL-ПОДПИСИ (как в TopologicalFingerprint) ====================

    computeWLSignature(node, graph) {
        const neighbors = this.findNodeNeighbors(node.id, graph);
        const degree = neighbors.length;
       
        // Роль узла
        const role = this.getNodeRole(node.id, neighbors, graph);
       
        // Зона
        const zone = this.getZone(node.y);
       
        // Количество треугольников
        const triangleCount = this.countTriangles(neighbors, graph);
       
        // Базовая подпись
        const baseSignature = `${role}|${zone}|T${triangleCount}|D${Math.min(degree, 10)}`;
       
        // Итеративное уточнение (2 итерации, как в TopologicalFingerprint)
        let currentSig = this.hashString(baseSignature);
       
        for (let iter = 0; iter < 2; iter++) {
            const neighborSigs = [];
           
            for (const neighbor of neighbors) {
                const neighborNeighbors = this.findNodeNeighbors(neighbor.id, graph);
                const neighborRole = this.getNodeRole(neighbor.id, neighborNeighbors, graph);
                const neighborTriangles = this.countTriangles(neighborNeighbors, graph);
                const neighborDegree = neighborNeighbors.length;
               
                const neighborSig = `${neighborRole}|T${neighborTriangles}|D${Math.min(neighborDegree, 10)}`;
                neighborSigs.push(neighborSig);
            }
           
            neighborSigs.sort();
            currentSig = this.hashString(currentSig + '|' + neighborSigs.join('|'));
        }
       
        return {
            signature: currentSig,
            role,
            zone,
            triangleCount,
            degree,
            degreeBucket: this.getDegreeBucket(degree)
        };
    }

    // ==================== ОПРЕДЕЛЕНИЕ РОЛИ (как в TopologicalFingerprint) ====================

    getNodeRole(nodeId, neighbors, graph) {
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
        const edgeId = [a.id, b.id].sort().join('--');
        return graph.edges.has(edgeId);
    }

    // ==================== ОПРЕДЕЛЕНИЕ ЗОНЫ ====================

    getZone(y) {
        if (y > 350) return 'K'; // пятка
        if (y < 200) return 'N'; // носок
        return 'C'; // центр
    }

    // ==================== БАКЕТ СТЕПЕНИ ====================

    getDegreeBucket(degree) {
        for (let i = 0; i < this.degreeBuckets.length; i++) {
            const [min, max] = this.degreeBuckets[i];
            if (degree >= min && degree <= max) {
                return `B${i}`;
            }
        }
        return 'B5';
    }

    // ==================== ОСНОВНАЯ ИДЕНТИФИКАЦИЯ ====================

    identify(node, neighbors, currentGraph, modelGraph) {
        if (!modelGraph) return null;
       
        // Вычисляем WL-подпись для текущей точки
        const currentWL = this.computeWLSignature(node, currentGraph);
       
        if (this.debug) {
            console.log(`\n   🔍 Идентификация точки ${node.id.substring(0, 20)}...`);
            console.log(`      WL: ${currentWL.signature}`);
            console.log(`      Роль: ${currentWL.role}, зона: ${currentWL.zone}`);
        }
       
        // Ищем кандидатов с похожей подписью
        const candidates = [];
       
        for (const [candidateId, signature] of this.signatures) {
            const candidateNode = modelGraph.nodes.get(candidateId);
            if (!candidateNode) continue;
           
            // Быстрая фильтрация по зоне
            if (signature.zone !== currentWL.zone) continue;
           
            // Быстрая фильтрация по роли
            if (signature.role !== currentWL.role) continue;
           
            // Сравниваем подписи
            if (signature.signature === currentWL.signature) {
                candidates.push({
                    nodeId: candidateId,
                    similarity: 1.0,
                    node: candidateNode,
                    signature
                });
            } else {
                // Частичное совпадение (похожие, но не идентичные)
                const similarity = this.compareSignatures(signature, currentWL);
                if (similarity > 0.8) {
                    candidates.push({
                        nodeId: candidateId,
                        similarity,
                        node: candidateNode,
                        signature
                    });
                }
            }
        }
       
        if (candidates.length === 0) {
            this.stats.totalRejected++;
            return null;
        }
       
        // Сортируем по убыванию сходства
        candidates.sort((a, b) => b.similarity - a.similarity);
        const best = candidates[0];
       
        // Обновляем статистику сигнатуры
        const sig = this.signatures.get(best.nodeId);
        if (sig) {
            sig.lastSeen = Date.now();
            sig.timesSeen = (sig.timesSeen || 0) + 1;
        }
       
        this.stats.totalIdentified++;
       
        if (this.debug) {
            console.log(`   ✅ НАЙДЕНО: ${best.nodeId.substring(0, 20)}...`);
            console.log(`      Сходство: ${(best.similarity * 100).toFixed(1)}%`);
        }
       
        return {
            nodeId: best.nodeId,
            confidence: best.similarity,
            method: best.similarity === 1.0 ? 'exact_wl' : 'similar_wl',
            degree: best.node.degree,
            role: currentWL.role,
            zone: currentWL.zone
        };
    }

    // ==================== СРАВНЕНИЕ ПОДПИСЕЙ ====================

    compareSignatures(sig1, sig2) {
        let score = 0;
       
        // Роль (35%)
        if (sig1.role === sig2.role) score += 0.35;
       
        // Зона (25%)
        if (sig1.zone === sig2.zone) score += 0.25;
       
        // Треугольники (20%)
        const triangleRatio = Math.min(sig1.triangleCount, sig2.triangleCount) /
                              Math.max(sig1.triangleCount, 1);
        score += triangleRatio * 0.2;
       
        // Степень (10%)
        const degreeRatio = Math.min(sig1.degree, sig2.degree) /
                            Math.max(sig1.degree, 1);
        score += degreeRatio * 0.1;
       
        // Бакет степени (10%)
        if (sig1.degreeBucket === sig2.degreeBucket) score += 0.1;
       
        return score;
    }

    // ==================== ЗАПОМИНАНИЕ ТОЧКИ ====================

    remember(nodeId, node, neighbors, graph) {
        // Вычисляем WL-подпись
        const wlSignature = this.computeWLSignature(node, graph);
       
        const signature = {
            nodeId,
            signature: wlSignature.signature,
            role: wlSignature.role,
            zone: wlSignature.zone,
            triangleCount: wlSignature.triangleCount,
            degree: wlSignature.degree,
            degreeBucket: wlSignature.degreeBucket,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            timesSeen: 1
        };

        this.signatures.set(nodeId, signature);
       
        if (this.debug) {
            console.log(`   🎯 Запомнена точка ${nodeId.substring(0, 20)}...`);
            console.log(`      WL: ${signature.signature}`);
            console.log(`      Роль: ${signature.role}, зона: ${signature.zone}`);
        }

        return true;
    }

    // ==================== КЛАСТЕРЫ ====================

    registerCluster(headNodeId, childNodeId) {
        if (!this.clusters.has(headNodeId)) {
            this.clusters.set(headNodeId, []);
            this.stats.totalClusters++;
        }
       
        const members = this.clusters.get(headNodeId);
        if (!members.includes(childNodeId)) {
            members.push(childNodeId);
            this.stats.totalClusterMembers++;
        }
       
        return members.length;
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

    // ==================== ХЕШ-ФУНКЦИЯ ====================

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
        // Распределение по ролям
        const roleStats = {};
        const zoneStats = {};
       
        for (const sig of this.signatures.values()) {
            roleStats[sig.role] = (roleStats[sig.role] || 0) + 1;
            zoneStats[sig.zone] = (zoneStats[sig.zone] || 0) + 1;
        }
       
        return {
            totalSignatures: this.signatures.size,
            totalClusters: this.clusters.size,
            totalClusterMembers: this.stats.totalClusterMembers,
            totalIdentified: this.stats.totalIdentified,
            totalRejected: this.stats.totalRejected,
            roleStats,
            zoneStats
        };
    }

    // ==================== ЭКСПОРТ/ИМПОРТ ====================

    export() {
        return {
            signatures: Array.from(this.signatures.entries()),
            clusters: Array.from(this.clusters.entries()),
            stats: this.stats
        };
    }

    import(data) {
        if (data.signatures) {
            this.signatures = new Map(data.signatures);
        }
       
        if (data.clusters) {
            this.clusters = new Map(data.clusters);
        }
       
        if (data.stats) {
            this.stats = data.stats;
        }
       
        console.log(`📥 Импортировано ${this.signatures.size} сигнатур, ${this.clusters.size} кластеров`);
    }
}

module.exports = GeometricSignature;
