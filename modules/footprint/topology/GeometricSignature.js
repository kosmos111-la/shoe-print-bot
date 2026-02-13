// modules/footprint/topology/GeometricSignature.js
// 🎯 ИДЕНТИФИКАЦИЯ НА OCHOBE WEISFEILER-LEHMAN ПОДПИСЕЙ

const RobustWLSignature = require('./RobustWLSignature');

class GeometricSignature {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище сигнатур
        this.signatures = new Map();
       
        // Кластеры
        this.clusters = new Map();
       
        // 🔥 WL-подписчик
        this.wlSigner = new RobustWLSignature({
            debug: this.debug,
            iterations: 2
        });
       
        // Статистика
        this.stats = {
            totalIdentified: 0,
            totalRejected: 0,
            totalClusters: 0,
            totalClusterMembers: 0
        };
       
        console.log('🎯 GeometricSignature создана (WL-идентификация)');
    }

    // ==================== ОСНОВНАЯ ИДЕНТИФИКАЦИЯ ====================

    identify(node, neighbors, currentGraph, modelGraph) {
        if (!modelGraph) return null;
       
        // ШАГ 1: Вычисляем WL-подпись для текущей точки
        const currentWL = this.wlSigner.computeSignature(node, currentGraph);
        const currentZone = this.wlSigner.getZone(node.y);
       
        if (this.debug) {
            console.log(`\n   🔍 Идентификация точки ${node.id.substring(0, 20)}...`);
            console.log(`      WL: ${currentWL}`);
            console.log(`      Зона: ${currentZone}`);
        }
       
        // ШАГ 2: Ищем кандидатов с похожей подписью
        const candidates = [];
       
        for (const [candidateId, signature] of this.signatures) {
            const candidateNode = modelGraph.nodes.get(candidateId);
            if (!candidateNode) continue;
           
            // Быстрая фильтрация по зоне
            if (this.wlSigner.getZone(candidateNode.y) !== currentZone) continue;
           
            // Сравниваем WL-подписи
            const wlSimilarity = this.wlSigner.compareSignatures(
                currentWL,
                signature.wlSignature
            );
           
            if (wlSimilarity > 0.5) { // Порог для кандидатов
                candidates.push({
                    nodeId: candidateId,
                    wlSimilarity,
                    node: candidateNode
                });
            }
        }
       
        if (this.debug) {
            console.log(`      Кандидатов: ${candidates.length}`);
        }
       
        if (candidates.length === 0) {
            this.stats.totalRejected++;
            return null;
        }
       
        // ШАГ 3: Выбираем лучшего кандидата
        candidates.sort((a, b) => b.wlSimilarity - a.wlSimilarity);
        const best = candidates[0];
       
        // ШАГ 4: Проверяем качество совпадения
        if (best.wlSimilarity > 0.7) {
            if (this.debug) {
                console.log(`   ✅ НАЙДЕНО: ${best.nodeId.substring(0, 20)}...`);
                console.log(`      Уверенность: ${(best.wlSimilarity * 100).toFixed(1)}%`);
            }
           
            // Обновляем статистику сигнатуры
            const sig = this.signatures.get(best.nodeId);
            if (sig) {
                sig.lastSeen = Date.now();
                sig.timesSeen = (sig.timesSeen || 0) + 1;
                sig.confidence = Math.min(1.0, (sig.confidence || 0.5) + 0.1);
            }
           
            this.stats.totalIdentified++;
           
            return {
                nodeId: best.nodeId,
                confidence: best.wlSimilarity,
                method: 'wl_signature',
                degree: best.node.degree
            };
        }
       
        if (this.debug) {
            console.log(`   ❌ НЕ НАЙДЕНО (лучший: ${(best.wlSimilarity * 100).toFixed(1)}%)`);
        }
       
        this.stats.totalRejected++;
        return null;
    }

    // ==================== ЗАПОМИНАНИЕ ТОЧКИ ====================

    remember(nodeId, node, neighbors, graph) {
        // Вычисляем WL-подпись
        const wlSignature = this.wlSigner.computeSignature(node, graph);
       
        // Определяем роль
        const role = this.wlSigner.getNodeRole(node, neighbors, graph);
       
        const signature = {
            nodeId,
            wlSignature,
            degree: neighbors.length,
            triangleCount: this.wlSigner.countTriangles(neighbors, graph),
            role,
            zone: this.wlSigner.getZone(node.y),
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            confidence: 1.0,
            timesSeen: 1
        };

        this.signatures.set(nodeId, signature);
       
        if (this.debug) {
            console.log(`   🎯 Запомнена точка ${nodeId.substring(0, 20)}...`);
            console.log(`      WL: ${wlSignature}`);
            console.log(`      Роль: ${role}, зона: ${signature.zone}`);
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

    // ==================== СТАТИСТИКА ====================

    getStats() {
        const wlStats = this.wlSigner ? this.wlSigner.getStats() : null;
       
        // Распределение по ролям
        const roleStats = {};
        for (const sig of this.signatures.values()) {
            roleStats[sig.role] = (roleStats[sig.role] || 0) + 1;
        }
       
        return {
            totalSignatures: this.signatures.size,
            totalClusters: this.clusters.size,
            totalClusterMembers: this.stats.totalClusterMembers,
            totalIdentified: this.stats.totalIdentified,
            totalRejected: this.stats.totalRejected,
            roleStats,
            wlSigner: wlStats
        };
    }

    // ==================== ЭКСПОРТ/ИМПОРТ ====================

    export() {
        return {
            signatures: Array.from(this.signatures.entries()),
            clusters: Array.from(this.clusters.entries()),
            stats: this.stats,
            wlSigner: {
                cache: Array.from(this.wlSigner.signatureCache.entries()),
                cacheHits: this.wlSigner.cacheHits,
                cacheMisses: this.wlSigner.cacheMisses
            }
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
       
        if (data.wlSigner && this.wlSigner) {
            this.wlSigner.signatureCache = new Map(data.wlSigner.cache || []);
            this.wlSigner.cacheHits = data.wlSigner.cacheHits || 0;
            this.wlSigner.cacheMisses = data.wlSigner.cacheMisses || 0;
        }
       
        console.log(`📥 Импортировано ${this.signatures.size} сигнатур, ${this.clusters.size} кластеров`);
    }
}

module.exports = GeometricSignature;
