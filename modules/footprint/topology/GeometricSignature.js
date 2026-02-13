// modules/footprint/topology/GeometricSignature.js
// 🎯 ИДЕНТИФИКАЦИЯ ТОЧЕК ПО ПЕРЕСЕЧЕНИЮ СОСЕДЕЙ (БЕЗ ПРИВЯЗКИ К ID)

class GeometricSignature {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище сигнатур: modelNodeId -> { neighbors, zone, confidence }
        this.signatures = new Map();
       
        // Связи "одна точка → много точек" (кластеры)
        this.clusters = new Map(); // originalNodeId -> [childNodeIds]
       
        // Кэш для быстрого поиска по пересечению
        this.zoneIndex = {
            'HEEL': new Map(),
            'CENTER': new Map(),
            'TOE': new Map()
        };
       
        console.log('🎯 GeometricSignature создана (идентификация по соседям)');
    }

    // 🔥 ЗАПОМНИТЬ ТОЧКУ ПРИ ПЕРВОМ ПОЯВЛЕНИИ
    remember(nodeId, node, neighbors, graph) {
        // Получаем ID ВСЕХ соседей (не только те, что в маппинге!)
        const neighborIds = neighbors.map(n => n.id || n);
       
        // Сортируем для детерминированности
        neighborIds.sort();
       
        const zone = this.getZone(node.y);
       
        const signature = {
            nodeId,
            neighbors: neighborIds,
            neighborCount: neighborIds.length,
            zone: zone,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            confidence: 1.0,
            timesSeen: 1
        };

        this.signatures.set(nodeId, signature);
       
        // Индексируем по зоне для быстрого поиска
        this.zoneIndex[zone].set(nodeId, signature);

        if (this.debug) {
            console.log(`   🎯 Запомнена сигнатура ${nodeId.substring(0, 20)}...`);
            console.log(`      Соседей: ${neighborIds.length}, зона: ${zone}`);
        }

        return true;
    }

    // 🔥 НАЙТИ ТОЧКУ ПО ПЕРЕСЕЧЕНИЮ СОСЕДЕЙ (БЕЗ ID!)
    identify(node, neighbors, modelGraph) {
        const currentNode = {
            neighbors: neighbors.map(n => n.id || n),
            zone: this.getZone(node.y)
        };

        let bestMatch = null;
        let bestScore = 0;
        let bestOverlap = 0;
        let candidates = 0;

        // 🔥🔥🔥 Ищем ТОЛЬКО в той же зоне!
        const zoneSignatures = this.zoneIndex[currentNode.zone];
       
        for (const [candidateId, sig] of zoneSignatures) {
            candidates++;
           
            // Вычисляем пересечение множеств соседей
            const overlap = this.jaccardIndex(
                new Set(currentNode.neighbors),
                new Set(sig.neighbors)
            );

            // Вычисляем уверенность
            const confidence = this.computeConfidence(
                overlap,
                sig.neighborCount,
                currentNode.neighbors.length
            );

            if (confidence > bestScore) {
                bestScore = confidence;
                bestOverlap = overlap;
                bestMatch = {
                    nodeId: candidateId,  // ID из МОДЕЛИ!
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
                console.log(`   ✅ Идентифицирована точка из зоны ${currentNode.zone}`);
                console.log(`      → Модель: ${bestMatch.nodeId.substring(0, 20)}...`);
                console.log(`      Пересечение: ${(bestMatch.overlap * 100).toFixed(1)}%`);
                console.log(`      Уверенность: ${(bestMatch.confidence * 100).toFixed(1)}%`);
                console.log(`      Просмотрено кандидатов: ${candidates}`);
            }

            return bestMatch;
        }

        if (this.debug && candidates > 0) {
            console.log(`   ❌ НЕ идентифицирована точка из зоны ${currentNode.zone}`);
            console.log(`      Просмотрено кандидатов: ${candidates}, лучший балл: ${(bestScore * 100).toFixed(1)}%`);
        }

        return null;
    }

    // 🔥 ВЫЧИСЛИТЬ УВЕРЕННОСТЬ
    computeConfidence(overlap, expectedNeighbors, actualNeighbors) {
        // 1. Базовый коэффициент - само пересечение
        let confidence = overlap * 0.5;
       
        // 2. Если у нас МЕНЬШЕ соседей, чем ожидалось (детализация кластера)
        if (actualNeighbors < expectedNeighbors && actualNeighbors > 0) {
            // Мы видим часть кластера - добавляем бонус
            const ratio = actualNeighbors / expectedNeighbors;
            confidence += ratio * 0.3;
        }
       
        // 3. Если мы видим МНОГО общих соседей - отлично!
        if (overlap > 0.3) {
            confidence += 0.2;
        }
       
        return Math.min(0.95, confidence);
    }

    // 🔥 ОБРАБОТКА КЛАСТЕРА (одна точка → много точек)
    registerCluster(originalNodeId, childNodeIds) {
        this.clusters.set(originalNodeId, childNodeIds);
       
        if (this.debug) {
            console.log(`   🎯 Зарегистрирован кластер:`);
            console.log(`      Голова: ${originalNodeId.substring(0, 20)}... → ${childNodeIds.length} точек`);
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
        // ИЛИ точка, у которой уже есть дети в кластере
        return sig.neighborCount >= 10 || this.clusters.has(nodeId);
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
        if (setA.size === 0 || setB.size === 0) return 0.0;
       
        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);
       
        return intersection.size / union.size;
    }

    // 🔥 ПОЛУЧИТЬ СТАТИСТИКУ
    getStats() {
        let totalClusters = 0;
        let totalClusterChildren = 0;
        let totalConfidence = 0;
       
        for (const sig of this.signatures.values()) {
            totalConfidence += sig.confidence;
        }
       
        for (const [head, children] of this.clusters) {
            totalClusters++;
            totalClusterChildren += children.length;
        }
       
        const zoneStats = {
            HEEL: this.zoneIndex.HEEL.size,
            CENTER: this.zoneIndex.CENTER.size,
            TOE: this.zoneIndex.TOE.size
        };
       
        return {
            totalSignatures: this.signatures.size,
            totalClusters,
            totalClusterChildren,
            avgConfidence: this.signatures.size > 0 ? totalConfidence / this.signatures.size : 0,
            zoneStats,
            indexStats: {
                HEEL: this.zoneIndex.HEEL.size,
                CENTER: this.zoneIndex.CENTER.size,
                TOE: this.zoneIndex.TOE.size
            }
        };
    }

    // 🔥 ОЧИСТИТЬ СТАРЫЕ ЗАПИСИ
    cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) {
        const now = Date.now();
        let removed = 0;
       
        for (const [nodeId, sig] of this.signatures) {
            if (now - sig.lastSeen > maxAge) {
                this.signatures.delete(nodeId);
                // Удаляем из индекса
                this.zoneIndex[sig.zone].delete(nodeId);
                removed++;
            }
        }
       
        if (removed > 0 && this.debug) {
            console.log(`🧹 Удалено ${removed} устаревших сигнатур`);
        }
       
        return removed;
    }

    // 🔥 ЭКСПОРТ
    export() {
        return {
            signatures: Array.from(this.signatures.entries()),
            clusters: Array.from(this.clusters.entries()),
            zoneIndex: {
                HEEL: Array.from(this.zoneIndex.HEEL.keys()),
                CENTER: Array.from(this.zoneIndex.CENTER.keys()),
                TOE: Array.from(this.zoneIndex.TOE.keys())
            }
        };
    }

    // 🔥 ИМПОРТ
    import(data) {
        if (data.signatures) {
            this.signatures = new Map(data.signatures);
            // Перестраиваем индекс
            this.zoneIndex = { HEEL: new Map(), CENTER: new Map(), TOE: new Map() };
            for (const [nodeId, sig] of this.signatures) {
                this.zoneIndex[sig.zone].set(nodeId, sig);
            }
        }
       
        if (data.clusters) {
            this.clusters = new Map(data.clusters);
        }
       
        console.log(`📥 Импортировано ${this.signatures.size} сигнатур, ${this.clusters.size} кластеров`);
        const stats = this.getStats();
        console.log(`   Зоны: ПЯТКА=${stats.zoneStats.HEEL}, ЦЕНТР=${stats.zoneStats.CENTER}, НОСОК=${stats.zoneStats.TOE}`);
    }

    // 🔥 ОТЛАДОЧНЫЙ МЕТОД - показать распределение по зонам
    debugZones() {
        console.log(`\n📊 РАСПРЕДЕЛЕНИЕ СИГНАТУР ПО ЗОНАМ:`);
        console.log(`   ПЯТКА: ${this.zoneIndex.HEEL.size} точек`);
        console.log(`   ЦЕНТР: ${this.zoneIndex.CENTER.size} точек`);
        console.log(`   НОСОК: ${this.zoneIndex.TOE.size} точек`);
       
        // Показать примеры из каждой зоны
        for (const zone of ['HEEL', 'CENTER', 'TOE']) {
            const samples = Array.from(this.zoneIndex[zone].values()).slice(0, 3);
            if (samples.length > 0) {
                console.log(`\n   Примеры из ${zone}:`);
                samples.forEach(sig => {
                    console.log(`      ${sig.nodeId.substring(0, 20)}... соседей: ${sig.neighborCount}, уверенность: ${(sig.confidence * 100).toFixed(0)}%`);
                });
            }
        }
    }
}

module.exports = GeometricSignature;
