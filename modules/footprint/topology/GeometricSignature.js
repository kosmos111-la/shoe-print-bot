// modules/footprint/topology/GeometricSignature.js
// 🎯 ИДЕНТИФИКАЦИЯ ТОЧЕК ЧЕРЕЗ WL-ПОДПИСИ + ДИАГНОСТИКА

const FeatureExtractor = require('./FeatureExtractor');

class GeometricSignature {
    constructor(options = {}) {
        this.debug = options.debug || false;
        
        // Хранилище сигнатур
        this.signatures = new Map();
        
        // Кластеры
        this.clusters = new Map();
        
        // 🔥 Диагностика
        this.featureExtractor = new FeatureExtractor({ 
            debug: this.debug 
        });
        
        // Бакеты для степеней
        this.degreeBuckets = [
            [0, 2],   // B0: листья
            [3, 4],   // B1: низкая
            [5, 6],   // B2: средняя
            [7, 9],   // B3: высокая
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
        
        console.log('🎯 GeometricSignature создана (WL-идентификация + диагностика)');
    }

    // ==================== ВЫЧИСЛЕНИЕ WL-ПОДПИСИ ====================

    computeWLSignature(node, graph, iterations = 2) {
        const neighbors = this.findNodeNeighbors(node.id, graph);
        
        // Базовая подпись
        let signature = `${this.getNodeRole(node, neighbors, graph)}|${this.getZoneCode(node.y)}|T${this.countTriangles(neighbors, graph)}|D${Math.min(neighbors.length, 10)}`;
        
        // Итеративное уточнение
        for (let iter = 0; iter < iterations; iter++) {
            const neighborSigs = [];
            
            for (const neighbor of neighbors) {
                const neighborNeighbors = this.findNodeNeighbors(neighbor.id, graph);
                const neighborSig = `${this.getNodeRole(neighbor, neighborNeighbors, graph)}|T${this.countTriangles(neighborNeighbors, graph)}|D${Math.min(neighborNeighbors.length, 10)}`;
                neighborSigs.push(neighborSig);
            }
            
            neighborSigs.sort();
            signature = this.hashString(signature + '|' + neighborSigs.join('|'));
        }
        
        return signature;
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
        if (y > 350) return 'ПЯТКА';
        if (y < 200) return 'НОСОК';
        return 'ЦЕНТР';
    }

    getZoneCode(y) {
        if (y > 350) return 'K';
        if (y < 200) return 'N';
        return 'C';
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

    // ==================== ПОИСК СОСЕДЕЙ ====================

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

    // ==================== ОСНОВНАЯ ИДЕНТИФИКАЦИЯ ====================

    identify(node, neighbors, currentGraph, modelGraph) {
        if (!modelGraph) return null;
        
        // Вычисляем WL-подпись для текущей точки
        const currentWL = this.computeWLSignature(node, currentGraph);
        const currentZone = this.getZone(node.y);
        const currentRole = this.getNodeRole(node, neighbors, currentGraph);
        const currentTriangles = this.countTriangles(neighbors, currentGraph);
        
        if (this.debug) {
            console.log(`\n   🔍 Идентификация точки ${node.id.substring(0, 20)}...`);
            console.log(`      WL: ${currentWL}`);
            console.log(`      Роль: ${currentRole}, зона: ${currentZone}`);
        }
        
        // Ищем кандидатов
        const candidates = [];
        
        for (const [candidateId, signature] of this.signatures) {
            const candidateNode = modelGraph.nodes.get(candidateId);
            if (!candidateNode) continue;
            
            // Быстрая фильтрация по зоне
            if (signature.zone !== currentZone) continue;
            
            // Сравниваем подписи
            if (signature.signature === currentWL) {
                candidates.push({
                    nodeId: candidateId,
                    similarity: 1.0,
                    node: candidateNode,
                    signature
                });
            } else {
                const similarity = this.compareSignatures(signature, {
                    role: currentRole,
                    zone: currentZone,
                    triangleCount: currentTriangles,
                    degree: neighbors.length,
                    degreeBucket: this.getDegreeBucket(neighbors.length)
                });
                
                if (similarity > 0.7) {
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
        
        // 🔥 ДИАГНОСТИКА: собираем признаки
        if (this.featureExtractor) {
            const distance = Math.sqrt(
                Math.pow(node.x - best.node.x, 2) + 
                Math.pow(node.y - best.node.y, 2)
            );
            
            // Временно помечаем правильные совпадения (для обучения)
            // Позже это будет определяться автоматически
            const isCorrect = distance < 50 && currentZone === this.getZone(best.node.y);
            
            const matchInfo = {
                modelX: best.node.x,
                modelY: best.node.y,
                modelZone: this.getZone(best.node.y),
                modelRole: best.signature.role,
                modelTriangles: best.signature.triangleCount,
                modelDegree: best.signature.degree,
                modelSignature: best.signature.signature,
                distance: distance,
                isCorrect: isCorrect
            };
            
            this.featureExtractor.extractFeatures(node, currentGraph, matchInfo);
        }
        
        // Обновляем статистику сигнатуры
        const sig = this.signatures.get(best.nodeId);
        if (sig) {
            sig.lastSeen = Date.now();
            sig.timesSeen = (sig.timesSeen || 0) + 1;
        }
        
        this.stats.totalIdentified++;
        
        if (this.debug) {
            console.log(`   ✅ НАЙДЕНО: ${best.nodeId.substring(0, 20)}...`);
            console.log(`      Сходство: ${(best.similarity * 100).toFixed(1)}%`);
        }
        
        return {
            nodeId: best.nodeId,
            confidence: best.similarity,
            method: best.similarity === 1.0 ? 'exact_wl' : 'similar_wl',
            degree: best.node.degree,
            role: currentRole,
            zone: currentZone
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
        // Вычисляем признаки
        const role = this.getNodeRole(node, neighbors, graph);
        const zone = this.getZone(node.y);
        const zoneCode = this.getZoneCode(node.y);
        const triangleCount = this.countTriangles(neighbors, graph);
        const degree = neighbors.length;
        const degreeBucket = this.getDegreeBucket(degree);
        
        // Вычисляем WL-подпись
        const wlSignature = this.computeWLSignature(node, graph);
        
        const signature = {
            nodeId,
            signature: wlSignature,
            role,
            zone,
            zoneCode,
            triangleCount,
            degree,
            degreeBucket,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            timesSeen: 1
        };

        this.signatures.set(nodeId, signature);
        
        if (this.debug) {
            console.log(`   🎯 Запомнена точка ${nodeId.substring(0, 20)}...`);
            console.log(`      WL: ${signature.signature}`);
            console.log(`      Роль: ${signature.role}, зона: ${signature.zone}`);
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

    // ==================== ДИАГНОСТИКА ====================

    printDiagnostics() {
        if (this.featureExtractor) {
            this.featureExtractor.printFeatureTable();
            this.featureExtractor.analyzeFeatureImportance();
        }
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        const extractorStats = this.featureExtractor ? this.featureExtractor.getStats() : null;
        
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
            zoneStats,
            featureExtractor: extractorStats
        };
    }

    // ==================== ЭКСПОРТ/ИМПОРТ ====================

    export() {
        return {
            signatures: Array.from(this.signatures.entries()),
            clusters: Array.from(this.clusters.entries()),
            stats: this.stats,
            featureExtractor: this.featureExtractor ? {
                history: this.featureExtractor.featureHistory,
                table: this.featureExtractor.featureTable,
                stats: this.featureExtractor.featureStats
            } : null
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
        
        if (data.featureExtractor && this.featureExtractor) {
            this.featureExtractor.featureHistory = data.featureExtractor.history || [];
            this.featureExtractor.featureTable = data.featureExtractor.table || [];
            this.featureExtractor.featureStats = data.featureExtractor.stats || {
                zone: { correct: 0, false: 0, total: 0 },
                role: { correct: 0, false: 0, total: 0 },
                triangleCount: { correct: 0, false: 0, total: 0 },
                degree: { correct: 0, false: 0, total: 0 },
                neighborDegrees: { correct: 0, false: 0, total: 0 },
                neighborRoles: { correct: 0, false: 0, total: 0 },
                wlSignature: { correct: 0, false: 0, total: 0 }
            };
        }
        
        console.log(`📥 Импортировано ${this.signatures.size} сигнатур, ${this.clusters.size} кластеров`);
    }
}

module.exports = GeometricSignature;
