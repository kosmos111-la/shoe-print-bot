// modules/footprint/topology/GeometricSignature.js
// 🎯 ИДЕНТИФИКАЦИЯ ТОЧЕК ПО ПЕРЕСЕЧЕНИЮ СОСЕДЕЙ

class GeometricSignature {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище сигнатур: nodeId -> { neighbors, firstSeen, confidence }
        this.signatures = new Map();
       
        // Связи "одна точка → много точек" (кластеры)
        this.clusters = new Map(); // originalNodeId -> [childNodeIds]
       
        console.log('🎯 GeometricSignature создана (идентификация по соседям)');
    }

    // 🔥 ЗАПОМНИТЬ ТОЧКУ ПРИ ПЕРВОМ ПОЯВЛЕНИИ
    remember(nodeId, node, neighbors, graph) {
        // Получаем ВСЕХ соседей (не только те, что в маппинге!)
        const allNeighbors = neighbors.map(n => n.id || n);
       
        // Сортируем для детерминированности
        allNeighbors.sort();
       
        this.signatures.set(nodeId, {
            nodeId,
            neighbors: allNeighbors,
            neighborCount: allNeighbors.length,
            zone: this.getZone(node.y),
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            confidence: 1.0,
            timesSeen: 1
        });

        if (this.debug) {
            console.log(`   🎯 Запомнена сигнатура ${nodeId.substring(0, 20)}...`);
            console.log(`      Соседей: ${allNeighbors.length}, зона: ${this.getZone(node.y)}`);
        }

        return true;
    }

    // 🔥 НАЙТИ ТОЧКУ ПО ПЕРЕСЕЧЕНИЮ СОСЕДЕЙ
    identify(node, neighbors, modelGraph) {
        const currentNode = {
            id: node.id,
            y: node.y,
            neighbors: neighbors.map(n => n.id || n)
        };

        let bestMatch = null;
        let bestScore = 0;
        let bestOverlap = 0;

        for (const [candidateId, sig] of this.signatures) {
            // Проверяем зону (грубая фильтрация)
            const nodeZone = this.getZone(node.y);
            if (sig.zone !== nodeZone) continue;

            // Вычисляем пересечение множеств соседей
            const overlap = this.jaccardIndex(
                new Set(currentNode.neighbors),
                new Set(sig.neighbors)
            );

            // Вычисляем уверенность
            const confidence = this.computeConfidence(overlap, sig.neighborCount, currentNode.neighbors.length);

            if (confidence > bestScore) {
                bestScore = confidence;
                bestOverlap = overlap;
                bestMatch = {
                    nodeId: candidateId,
                    confidence: confidence,
                    overlap: overlap,
                    expectedNeighbors: sig.neighborCount,
                    actualNeighbors: currentNode.neighbors.length
                };
            }
        }

        if (bestMatch && bestMatch.confidence > 0.3) {
            // Обновляем статистику
            const sig = this.signatures.get(bestMatch.nodeId);
            if (sig) {
                sig.lastSeen = Date.now();
                sig.timesSeen++;
                sig.confidence = Math.min(1.0, sig.confidence + 0.1);
            }

            if (this.debug) {
                console.log(`   ✅ Идентифицирована ${node.id.substring(0, 20)}...`);
                console.log(`      → ${bestMatch.nodeId.substring(0, 20)}...`);
                console.log(`      Пересечение: ${(bestMatch.overlap * 100).toFixed(1)}%`);
                console.log(`      Уверенность: ${(bestMatch.confidence * 100).toFixed(1)}%`);
            }

            return bestMatch;
        }

        return null;
    }

    // 🔥 ОБРАБОТКА КЛАСТЕРА (одна точка → много точек)
    registerCluster(originalNodeId, childNodeIds) {
        this.clusters.set(originalNodeId, childNodeIds);
       
        if (this.debug) {
            console.log(`   🎯 Кластер: ${originalNodeId.substring(0, 20)}... → ${childNodeIds.length} точек`);
        }
    }

    // 🔥 ПОЛУЧИТЬ ДЕТЕЙ КЛАСТЕРА
    getClusterChildren(originalNodeId) {
        return this.clusters.get(originalNodeId) || [];
    }

    // 🔥 ЯВЛЯЕТСЯ ЛИ ТОЧКА ГОЛОВОЙ КЛАСТЕРА?
    isClusterHead(nodeId) {
        const sig = this.signatures.get(nodeId);
        if (!sig) return false;
       
        // Точка с >10 соседями - потенциальная голова кластера
        return sig.neighborCount >= 10;
    }

    // 🔥 ВЫЧИСЛИТЬ УВЕРЕННОСТЬ
    computeConfidence(overlap, expectedNeighbors, actualNeighbors) {
        // 1. Базовый коэффициент - само пересечение
        let confidence = overlap * 0.6;
       
        // 2. Если у нас БОЛЬШЕ соседей, чем ожидалось (детализация)
        if (actualNeighbors < expectedNeighbors) {
            // Мы видим только часть - это нормально для кластера
            confidence += 0.2;
        }
       
        // 3. Если мы видим столько же или больше - отлично!
        if (actualNeighbors >= expectedNeighbors) {
            confidence += 0.3;
        }
       
        return Math.min(0.95, confidence);
    }

    // 🔥 ОПРЕДЕЛИТЬ ЗОНУ ПО Y
    getZone(y) {
        if (y > 350) return 'HEEL';
        if (y < 200) return 'TOE';
        return 'CENTER';
    }

    // 🔥 ИНДЕКС ЖАККАРА (ПЕРЕСЕЧЕНИЕ / ОБЪЕДИНЕНИЕ)
    jaccardIndex(setA, setB) {
        if (setA.size === 0 && setB.size === 0) return 1.0;
       
        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);
       
        return intersection.size / union.size;
    }

    // 🔥 ОЧИСТИТЬ СТАРЫЕ ЗАПИСИ
    cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) {
        const now = Date.now();
        let removed = 0;
       
        for (const [nodeId, sig] of this.signatures) {
            if (now - sig.lastSeen > maxAge) {
                this.signatures.delete(nodeId);
                removed++;
            }
        }
       
        if (removed > 0 && this.debug) {
            console.log(`🧹 Удалено ${removed} устаревших сигнатур`);
        }
       
        return removed;
    }

    // 🔥 ПОЛУЧИТЬ СТАТИСТИКУ
    getStats() {
        let totalClusters = 0;
        let totalClusterChildren = 0;
       
        for (const [head, children] of this.clusters) {
            totalClusters++;
            totalClusterChildren += children.length;
        }
       
        return {
            totalSignatures: this.signatures.size,
            totalClusters,
            totalClusterChildren,
            avgConfidence: Array.from(this.signatures.values()).reduce((acc, s) => acc + s.confidence, 0) / this.signatures.size || 0
        };
    }

    // 🔥 ЭКСПОРТ
    export() {
        return {
            signatures: Array.from(this.signatures.entries()),
            clusters: Array.from(this.clusters.entries())
        };
    }

    // 🔥 ИМПОРТ
    import(data) {
        if (data.signatures) this.signatures = new Map(data.signatures);
        if (data.clusters) this.clusters = new Map(data.clusters);
        console.log(`📥 Импортировано ${this.signatures.size} сигнатур, ${this.clusters.size} кластеров`);
    }
}

module.exports = GeometricSignature;
