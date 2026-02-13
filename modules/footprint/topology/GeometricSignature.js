// modules/footprint/topology/GeometricSignature.js
// 🎯 ТОПОЛОГИЧЕСКАЯ ПАМЯТЬ - ТОЛЬКО ИНВАРИАНТНЫЕ ПРИЗНАКИ

class GeometricSignature {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище сигнатур: modelNodeId -> { degree, triangleCount, roles, zone }
        this.signatures = new Map();
       
        // Кластеры: modelNodeId -> [childNodeIds]
        this.clusters = new Map();
       
        // Индекс по зонам для быстрого поиска
        this.zoneIndex = {
            'HEEL': new Map(),
            'CENTER': new Map(),
            'TOE': new Map()
        };
       
        // Статистика
        this.stats = {
            totalIdentified: 0,
            totalClusters: 0,
            totalClusterMembers: 0
        };
       
        console.log('🎯 GeometricSignature создана (топологическая память)');
        console.log('   ✅ Признаки: степень, треугольники, роли (инвариантны)');
    }

    // 🔥 ЗАПОМНИТЬ ТОЧКУ ПРИ ПЕРВОМ ПОЯВЛЕНИИ
    remember(nodeId, node, neighbors, graph) {
        // 1. Степень (количество соседей)
        const degree = neighbors.length;
       
        // 2. Количество треугольников среди соседей
        const triangleCount = this.countTriangles(neighbors, graph);
       
        // 3. Роль точки
        const roles = this.determineRoles(node, neighbors, graph);
       
        const zone = this.getZone(node.y);
       
        const signature = {
            nodeId,
            degree,
            triangleCount,
            roles,
            zone,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            confidence: 1.0,
            timesSeen: 1
        };

        this.signatures.set(nodeId, signature);
        this.zoneIndex[zone].set(nodeId, signature);

        if (this.debug) {
            console.log(`   🎯 Запомнена точка ${nodeId.substring(0, 20)}...`);
            console.log(`      Степень: ${degree}, треугольников: ${triangleCount}`);
            console.log(`      Роли: ${Object.entries(roles).filter(([_,v]) => v).map(([k]) => k).join(', ')}`);
            console.log(`      Зона: ${zone}`);
        }

        return true;
    }

    // 🔥 НАЙТИ ТОЧКУ ПО ТОПОЛОГИЧЕСКИМ ПРИЗНАКАМ
    identify(node, neighbors, graph) {
        const currentNode = {
            id: node.id,
            y: node.y,
            degree: neighbors.length,
            triangleCount: this.countTriangles(neighbors, graph),
            roles: this.determineRoles(node, neighbors, graph)
        };
       
        const currentZone = this.getZone(node.y);
       
        if (this.debug) {
            console.log(`\n   🔍 Идентификация точки ${node.id.substring(0, 20)}...`);
            console.log(`      Зона: ${currentZone}`);
            console.log(`      Текущие признаки: степень=${currentNode.degree}, треугольников=${currentNode.triangleCount}`);
        }

        let bestMatch = null;
        let bestScore = 0;
        let candidates = 0;

        // Ищем ТОЛЬКО в той же зоне
        const zoneSignatures = this.zoneIndex[currentZone];
       
        for (const [candidateId, sig] of zoneSignatures) {
            candidates++;
           
            // Вычисляем сходство
            const similarity = this.computeTopologicalSimilarity(
                currentNode,
                sig
            );

            if (similarity > bestScore) {
                bestScore = similarity;
                bestMatch = {
                    nodeId: candidateId,
                    confidence: similarity,
                    degree: sig.degree,
                    triangleCount: sig.triangleCount,
                    roles: sig.roles
                };
            }
        }

        // Порог 40% - достаточно для кластеризации
        if (bestMatch && bestMatch.confidence > 0.4) {
            const sig = this.signatures.get(bestMatch.nodeId);
            if (sig) {
                sig.lastSeen = Date.now();
                sig.timesSeen++;
                sig.confidence = Math.min(1.0, sig.confidence + 0.1);
            }

            if (this.debug) {
                console.log(`   ✅ ИДЕНТИФИЦИРОВАНА:`);
                console.log(`      → Модель: ${bestMatch.nodeId.substring(0, 20)}...`);
                console.log(`      Уверенность: ${(bestMatch.confidence * 100).toFixed(1)}%`);
                console.log(`      Просмотрено кандидатов: ${candidates}`);
               
                // Детали сравнения
                console.log(`      Степень: ${currentNode.degree} vs ${bestMatch.degree} (${(Math.min(currentNode.degree, bestMatch.degree) / Math.max(currentNode.degree, bestMatch.degree) * 100).toFixed(0)}%)`);
                console.log(`      Треугольники: ${currentNode.triangleCount} vs ${bestMatch.triangleCount}`);
                console.log(`      Роли: ${Object.entries(bestMatch.roles).filter(([_,v]) => v).map(([k]) => k).join(', ')}`);
            }

            // Проверяем, не является ли это кластером
            if (currentNode.degree < bestMatch.degree * 0.7) {
                // Текущая точка имеет значительно меньше соседей
                // Значит, это детализация кластера!
                this.registerCluster(bestMatch.nodeId, node.id);
            }

            this.stats.totalIdentified++;
            return bestMatch;
        }

        if (this.debug) {
            console.log(`   ❌ НЕ ИДЕНТИФИЦИРОВАНА (лучший балл: ${(bestScore * 100).toFixed(1)}%)`);
        }

        return null;
    }

    // 🔥 ВЫЧИСЛИТЬ ТОПОЛОГИЧЕСКОЕ СХОДСТВО
    computeTopologicalSimilarity(current, memory) {
        let score = 0;
        let totalWeight = 0;

        // 1. Степень (вес 40%) - с учётом возможной детализации
        const degreeRatio = Math.min(current.degree, memory.degree) /
                            Math.max(current.degree, memory.degree);
        score += degreeRatio * 0.4;
        totalWeight += 0.4;

        // 2. Треугольники (вес 30%) - пропорционально
        const triangleRatio = Math.min(current.triangleCount, memory.triangleCount) /
                              Math.max(current.triangleCount, memory.triangleCount, 1);
        score += triangleRatio * 0.3;
        totalWeight += 0.3;

        // 3. Роли (вес 30%) - каждая роль даёт вклад
        let roleScore = 0;
        let roleCount = 0;
       
        const roles = ['isBridge', 'isLeaf', 'isHub', 'isClique'];
        for (const role of roles) {
            if (current.roles[role] === memory.roles[role]) {
                roleScore += 1;
            }
            roleCount++;
        }
       
        score += (roleScore / roleCount) * 0.3;
        totalWeight += 0.3;

        return score / totalWeight;
    }

    // 🔥 ПОДСЧЁТ ТРЕУГОЛЬНИКОВ СРЕДИ СОСЕДЕЙ
    countTriangles(neighbors, graph) {
        let count = 0;
       
        // Создаём множество ID соседей для быстрого поиска
        const neighborIds = new Set(neighbors.map(n => n.id));
       
        // Для каждой пары соседей проверяем, связаны ли они
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const a = neighbors[i];
                const b = neighbors[j];
               
                // Проверяем, есть ли ребро между a и b
                if (this.areConnected(a, b, graph)) {
                    count++;
                }
            }
        }
       
        return count;
    }

    // 🔥 ПРОВЕРКА СВЯЗИ МЕЖДУ ДВУМЯ ТОЧКАМИ
    areConnected(nodeA, nodeB, graph) {
        const edgeId = [nodeA.id, nodeB.id].sort().join('--');
        return graph.edges.has(edgeId);
    }

    // 🔥 ОПРЕДЕЛЕНИЕ РОЛЕЙ ТОЧКИ
    determineRoles(node, neighbors, graph) {
        const degree = neighbors.length;
       
        const roles = {
            isBridge: false,
            isLeaf: degree === 1,
            isHub: degree >= 6,
            isClique: false
        };

        // Проверка на мост (точка с 2 соседями, которые не связаны)
        if (degree === 2) {
            const [a, b] = neighbors;
            roles.isBridge = !this.areConnected(a, b, graph);
        }

        // Проверка на клику (все соседи связаны между собой)
        if (degree >= 3) {
            let allConnected = true;
            for (let i = 0; i < neighbors.length && allConnected; i++) {
                for (let j = i + 1; j < neighbors.length && allConnected; j++) {
                    if (!this.areConnected(neighbors[i], neighbors[j], graph)) {
                        allConnected = false;
                    }
                }
            }
            roles.isClique = allConnected;
        }

        return roles;
    }

    // 🔥 РЕГИСТРАЦИЯ КЛАСТЕРА
    registerCluster(headNodeId, childNodeId) {
        if (!this.clusters.has(headNodeId)) {
            this.clusters.set(headNodeId, []);
            this.stats.totalClusters++;
        }
       
        const members = this.clusters.get(headNodeId);
        if (!members.includes(childNodeId)) {
            members.push(childNodeId);
            this.stats.totalClusterMembers++;
           
            if (this.debug) {
                console.log(`   🎯 Кластер ${headNodeId.substring(0, 20)}... → +1 точка (всего ${members.length})`);
            }
        }
       
        return members.length;
    }

    // 🔥 ОПРЕДЕЛИТЬ ЗОНУ ПО Y
    getZone(y) {
        if (y > 350) return 'HEEL';
        if (y < 200) return 'TOE';
        return 'CENTER';
    }

    // 🔥 ПОЛУЧИТЬ СТАТИСТИКУ
    getStats() {
        const zoneStats = {
            HEEL: this.zoneIndex.HEEL.size,
            CENTER: this.zoneIndex.CENTER.size,
            TOE: this.zoneIndex.TOE.size
        };
       
        let totalClusterMembers = 0;
        for (const members of this.clusters.values()) {
            totalClusterMembers += members.length;
        }
       
        return {
            totalSignatures: this.signatures.size,
            totalClusters: this.clusters.size,
            totalClusterMembers,
            totalIdentified: this.stats.totalIdentified,
            zoneStats
        };
    }

    // 🔥 ОЧИСТИТЬ СТАРЫЕ ЗАПИСИ
    cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) {
        const now = Date.now();
        let removed = 0;
       
        for (const [nodeId, sig] of this.signatures) {
            if (now - sig.lastSeen > maxAge) {
                this.signatures.delete(nodeId);
                this.zoneIndex[sig.zone].delete(nodeId);
                removed++;
            }
        }
       
        if (removed > 0 && this.debug) {
            console.log(`🧹 Удалено ${removed} устаревших сигнатур`);
        }
       
        return removed;
    }

    // 🔥 ОТЛАДОЧНАЯ ИНФОРМАЦИЯ
    debugInfo() {
        console.log(`\n📊 СТАТИСТИКА GeometricSignature:`);
        console.log(`   Всего сигнатур: ${this.signatures.size}`);
        console.log(`   Кластеров: ${this.clusters.size}`);
        console.log(`   Идентифицировано всего: ${this.stats.totalIdentified}`);
       
        console.log(`\n   Распределение по зонам:`);
        console.log(`      ПЯТКА: ${this.zoneIndex.HEEL.size} точек`);
        console.log(`      ЦЕНТР: ${this.zoneIndex.CENTER.size} точек`);
        console.log(`      НОСОК: ${this.zoneIndex.TOE.size} точек`);
       
        if (this.clusters.size > 0) {
            console.log(`\n   Кластеры:`);
            for (const [headId, members] of this.clusters) {
                console.log(`      ${headId.substring(0, 20)}... → ${members.length} точек`);
            }
        }
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
            },
            stats: this.stats
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
       
        if (data.stats) {
            this.stats = data.stats;
        }
       
        console.log(`📥 Импортировано ${this.signatures.size} сигнатур, ${this.clusters.size} кластеров`);
        this.debugInfo();
    }
}

module.exports = GeometricSignature;
