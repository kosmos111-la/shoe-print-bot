// modules/footprint/topology/TopologicalFingerprint.js
// 🎯 WL-ПОДПИСИ ДЛЯ СРАВНЕНИЯ ГРАФОВ (ПОЛНАЯ ВЕРСИЯ)

class TopologicalFingerprint {
    constructor(options = {}) {
        this.iterations = options.iterations || 2;
        this.debug = options.debug || false;
        this.hashCache = new Map();
       
        // 🔥 БАКЕТЫ ДЛЯ АБСОЛЮТНОЙ СТЕПЕНИ (сохранено)
        this.degreeBuckets = [
            [0, 2],   // B0: листья
            [3, 4],   // B1: низкая
            [5, 6],   // B2: средняя
            [7, 9],   // B3: высокая
            [10, 12], // B4: очень высокая
            [13, 100] // B5: экстремальная
        ];
       
        // 🔥 Веса для разных признаков
        this.weights = {
            role: 0.35,
            zone: 0.25,
            triangles: 0.2,
            degree: 0.1,
            neighbors: 0.1
        };
       
        // Порог структурного сходства
        this.structuralSimilarityThreshold = options.structuralSimilarityThreshold || 0.7;
       
        console.log('🔷 ТОПОЛОГИЧЕСКИЙ АЛГОРИТМ (WL-подписи)');
        console.log(`   Порог сходства: ${this.structuralSimilarityThreshold}`);
        console.log(`   Признаки: роль, зона, треугольники, степень`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    computeGraphFingerprints(graph) {
        console.log(`🔷 Вычисляю WL-подписи (${graph.nodes.size} узлов)...`);
       
        const nodes = graph.nodes;
        const edges = graph.edges;
       
        // 1. Создаем карту соседей
        const neighborMap = this.buildNeighborMap(nodes, edges);
       
        // 2. Вычисляем максимальную степень (для нормализации)
        let maxDegree = 0;
        for (const node of nodes.values()) {
            const degree = neighborMap.get(node.id)?.length || 0;
            maxDegree = Math.max(maxDegree, degree);
        }
        console.log(`   📊 Максимальная степень в графе: ${maxDegree}`);
       
        // 3. Создаем подписи для всех узлов
        const signatures = new Map();
       
        for (const [nodeId, node] of nodes) {
            const neighbors = neighborMap.get(nodeId) || [];
            const degree = neighbors.length;
           
            // 🔥 Роль узла
            const role = this.getNodeRole(nodeId, neighbors, neighborMap, graph);
           
            // 🔥 Зона
            const zone = this.getZone(node.y);
           
            // 🔥 Количество треугольников
            const triangleCount = this.countTriangles(nodeId, neighbors, neighborMap, graph);
           
            // 🔥 Нормализованная степень
            const normalizedDegree = maxDegree > 0 ? degree / maxDegree : 0;
            const normBucket = Math.min(7, Math.floor(normalizedDegree * 8));
           
            // 🔥 Базовая подпись
            const baseSignature = `${role}|${zone}|T${triangleCount}|D${Math.min(degree, 10)}`;
           
            // 🔥 Итеративное уточнение (WL)
            let currentSig = this.hashString(baseSignature);
           
            // Сохраняем историю для итераций
            const history = [currentSig];
           
            for (let iter = 0; iter < this.iterations; iter++) {
                // Собираем подписи соседей
                const neighborSigs = [];
                const neighborRoles = [];
               
                for (const neighborId of neighbors) {
                    const neighborDegree = neighborMap.get(neighborId)?.length || 0;
                    const neighborRole = this.getNodeRole(neighborId,
                        neighborMap.get(neighborId) || [], neighborMap, graph);
                    const neighborTriangles = this.countTriangles(neighborId,
                        neighborMap.get(neighborId) || [], neighborMap, graph);
                   
                    const neighborSig = `${neighborRole}|T${neighborTriangles}|D${Math.min(neighborDegree, 10)}`;
                    neighborSigs.push(neighborSig);
                    neighborRoles.push(neighborRole);
                }
               
                // Сортируем для инвариантности
                neighborSigs.sort();
                neighborRoles.sort();
               
                // Статистика по ролям соседей
                const roleCounts = {};
                neighborRoles.forEach(r => roleCounts[r] = (roleCounts[r] || 0) + 1);
                const roleStats = Object.entries(roleCounts)
                    .sort()
                    .map(([r, c]) => `${r}${c}`)
                    .join('');
               
                // Новая подпись
                const newSig = this.hashString(
                    `${currentSig}|${neighborSigs.join('|')}|${roleStats}`
                );
               
                history.push(newSig);
                currentSig = newSig;
            }
           
            // Финальная подпись (последние две итерации)
            const finalSig = this.hashString(history.slice(-2).join('::'));
           
            signatures.set(nodeId, {
                signature: finalSig,
                baseSignature,
                role,
                zone,
                triangleCount,
                degree,
                normalizedDegree,
                normBucket,
                degreeBucket: this.getDegreeBucket(degree),
                neighborCount: neighbors.length,
                neighborIds: neighbors,
                history
            });
        }
       
        // Статистика
        const uniqueSignatures = new Set();
        for (const sig of signatures.values()) {
            uniqueSignatures.add(sig.signature);
        }
       
        console.log(`✅ WL-подписи вычислены:`);
        console.log(`   Узлов: ${signatures.size}`);
        console.log(`   Уникальных подписей: ${uniqueSignatures.size} (${(uniqueSignatures.size/signatures.size*100).toFixed(1)}%)`);
        console.log(`   Роли: L(лист), B(мост), H(хаб), C(клика), R(обычный)`);
       
        return signatures;
    }

    // ==================== ОПРЕДЕЛЕНИЕ РОЛИ ====================

    getNodeRole(nodeId, neighbors, neighborMap, graph) {
        const degree = neighbors.length;
       
        // Лист
        if (degree === 1) return 'L';
       
        // Хаб (много связей)
        if (degree >= 6) return 'H';
       
        // Мост (два соседа, не связанных между собой)
        if (degree === 2) {
            const [aId, bId] = neighbors;
            if (!this.areConnected(aId, bId, graph)) {
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

    countTriangles(nodeId, neighbors, neighborMap, graph) {
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

    areConnected(nodeAId, nodeBId, graph) {
        const edgeId = [nodeAId, nodeBId].sort().join('--');
        return graph.edges.has(edgeId);
    }

    // ==================== ОПРЕДЕЛЕНИЕ ЗОНЫ ====================

    getZone(y) {
        if (y > 350) return 'K'; // пятка (heel)
        if (y < 200) return 'N'; // носок (toe)
        return 'C'; // центр
    }

    // ==================== БАКЕТ АБСОЛЮТНОЙ СТЕПЕНИ ====================

    getDegreeBucket(degree) {
        for (let i = 0; i < this.degreeBuckets.length; i++) {
            const [min, max] = this.degreeBuckets[i];
            if (degree >= min && degree <= max) {
                return `B${i}`;
            }
        }
        return 'B5';
    }

    // ==================== КАРТА СОСЕДЕЙ ====================

    buildNeighborMap(nodes, edges) {
        const neighborMap = new Map();
       
        // Инициализируем
        for (const nodeId of nodes.keys()) {
            neighborMap.set(nodeId, []);
        }
       
        // Добавляем связи
        for (const edge of edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (neighborMap.has(nodeA)) {
                neighborMap.get(nodeA).push(nodeB);
            }
            if (neighborMap.has(nodeB)) {
                neighborMap.get(nodeB).push(nodeA);
            }
        }
       
        // Сортируем для консистентности
        for (const neighbors of neighborMap.values()) {
            neighbors.sort();
        }
       
        return neighborMap;
    }

    // ==================== СРАВНЕНИЕ ГРАФОВ ====================

    compareGraphs(graph1, fingerprints1, graph2, fingerprints2) {
        console.log(`\n🔍 Сравниваю графы по WL-подписям...`);
       
        // Индекс по подписям для быстрого поиска
        const sigToNodes1 = new Map();
        const sigToNodes2 = new Map();
       
        for (const [nodeId, fp] of fingerprints1) {
            if (!sigToNodes1.has(fp.signature)) {
                sigToNodes1.set(fp.signature, []);
            }
            sigToNodes1.get(fp.signature).push({
                nodeId,
                role: fp.role,
                zone: fp.zone,
                degree: fp.degree,
                normBucket: fp.normBucket
            });
        }
       
        for (const [nodeId, fp] of fingerprints2) {
            if (!sigToNodes2.has(fp.signature)) {
                sigToNodes2.set(fp.signature, []);
            }
            sigToNodes2.get(fp.signature).push({
                nodeId,
                role: fp.role,
                zone: fp.zone,
                degree: fp.degree,
                normBucket: fp.normBucket
            });
        }
       
        // Точные совпадения подписей
        const exactMatches = [];
        for (const [sig, nodes1] of sigToNodes1) {
            if (sigToNodes2.has(sig)) {
                const nodes2 = sigToNodes2.get(sig);
                const matchCount = Math.min(nodes1.length, nodes2.length);
               
                for (let i = 0; i < matchCount; i++) {
                    exactMatches.push({
                        node1: nodes1[i].nodeId,
                        node2: nodes2[i].nodeId,
                        signature: sig,
                        confidence: 1.0,
                        role: nodes1[i].role,
                        zone: nodes1[i].zone,
                        degree: nodes1[i].degree,
                        normBucket: nodes1[i].normBucket,
                        type: 'exact'
                    });
                }
            }
        }
       
        // Поиск структурно похожих
        const similarMatches = this.findSimilarNodes(fingerprints1, fingerprints2);
       
        const allMatches = [...exactMatches, ...similarMatches];
       
        // Статистика
        const totalNodes1 = fingerprints1.size;
        const totalNodes2 = fingerprints2.size;
        const matchedNodes1 = new Set(allMatches.map(m => m.node1)).size;
        const matchedNodes2 = new Set(allMatches.map(m => m.node2)).size;
       
        const matchRatio1 = matchedNodes1 / Math.max(1, totalNodes1);
        const matchRatio2 = matchedNodes2 / Math.max(1, totalNodes2);
      const similarity = (matchRatio1 + matchRatio2 * 1.5) / 2.5; // увеличиваем вес похожих
       
        console.log(`📊 Результат сравнения:`);
        console.log(`   Узлов в графе 1: ${totalNodes1}`);
        console.log(`   Узлов в графе 2: ${totalNodes2}`);
        console.log(`   Точных совпадений: ${exactMatches.length}`);
        console.log(`   Структурно похожих: ${similarMatches.length}`);
        console.log(`   Сходство: ${(similarity * 100).toFixed(1)}%`);
       
        return {
            similarity,
            exactMatches,
            similarMatches,
            allMatches,
            matchedNodes1,
            matchedNodes2,
            totalNodes1,
            totalNodes2,
            method: 'wl_signature'
        };
    }

    // ==================== ПОИСК ПОХОЖИХ УЗЛОВ ====================

    findSimilarNodes(fingerprints1, fingerprints2) {
        const similarMatches = [];
        const usedNodes2 = new Set();
       
        const nodes1 = Array.from(fingerprints1.entries());
        const nodes2 = Array.from(fingerprints2.entries());
       
        for (const [nodeId1, fp1] of nodes1) {
            let bestMatch = null;
            let bestSimilarity = 0;
            let bestNodeId2 = null;
           
            for (const [nodeId2, fp2] of nodes2) {
                if (usedNodes2.has(nodeId2)) continue;
               
                // 🔥 ЖЕСТКАЯ ФИЛЬТРАЦИЯ ПО ЗОНЕ
                if (fp1.zone !== fp2.zone) continue;
               
                // 🔥 ФИЛЬТРАЦИЯ ПО РОЛИ
                if (fp1.role !== fp2.role) continue;
               
                // Вычисляем сходство
                const similarity = this.computeNodeSimilarity(fp1, fp2);
               
                if (similarity > bestSimilarity && similarity >= this.structuralSimilarityThreshold) {
                    bestSimilarity = similarity;
                    bestMatch = {
                        node1: nodeId1,
                        node2: nodeId2,
                        confidence: similarity,
                        role: fp1.role,
                        zone: fp1.zone,
                        degree: fp1.degree,
                        normBucket: fp1.normBucket,
                        type: 'similar'
                    };
                    bestNodeId2 = nodeId2;
                }
            }
           
            if (bestMatch) {
                similarMatches.push(bestMatch);
                usedNodes2.add(bestNodeId2);
            }
        }
       
        return similarMatches;
    }

    // ==================== ВЫЧИСЛЕНИЕ СХОДСТВА УЗЛОВ ====================

    computeNodeSimilarity(fp1, fp2) {
        let score = 0;
        let totalWeight = 0;
       
        // 1. Роль (вес 35%)
        if (fp1.role === fp2.role) {
            score += 0.35;
        }
        totalWeight += 0.35;
       
        // 2. Зона (вес 25%)
        if (fp1.zone === fp2.zone) {
            score += 0.25;
        }
        totalWeight += 0.25;
       
        // 3. Треугольники (вес 20%)
        const triangleRatio = Math.min(fp1.triangleCount || 0, fp2.triangleCount || 0) /
                              Math.max(fp1.triangleCount || 1, fp2.triangleCount || 1);
        score += triangleRatio * 0.2;
        totalWeight += 0.2;
       
        // 4. Степень (вес 10%)
        const degreeRatio = Math.min(fp1.degree, fp2.degree) /
                            Math.max(fp1.degree, fp2.degree, 1);
        score += degreeRatio * 0.1;
        totalWeight += 0.1;
       
        // 5. Нормализованная степень (вес 10%)
        if (fp1.normBucket !== undefined && fp2.normBucket !== undefined) {
            const normBucketDiff = Math.abs(fp1.normBucket - fp2.normBucket);
            const normSim = 1.0 - (normBucketDiff / 8);
            score += normSim * 0.1;
            totalWeight += 0.1;
        }
       
        return score / totalWeight;
    }

    // ==================== ГЛОБАЛЬНАЯ СТАТИСТИКА ====================

    computeGlobalStats(graph) {
        const yCoords = [];
        for (const node of graph.nodes.values()) {
            yCoords.push(node.y);
        }
        yCoords.sort((a, b) => a - b);
        return {
            yMin: yCoords[0] || 0,
            yMax: yCoords[yCoords.length - 1] || 600,
            yMedian: yCoords[Math.floor(yCoords.length / 2)] || 300
        };
    }

    // ==================== ПОЗИЦИЯ ====================

    getPositionBucket(y) {
        if (y > 350) return 'HEEL';
        if (y < 200) return 'TOE';
        return 'CENTER';
    }

    // ==================== СРЕДНИЙ Y СОСЕДЕЙ ====================

    computeAvgNeighborY(nodeId, neighbors, graph) {
        if (neighbors.length === 0) return 0;
        let sumY = 0;
        let count = 0;
        for (const neighborId of neighbors) {
            const neighbor = graph.nodes.get(neighborId);
            if (neighbor) {
                sumY += neighbor.y;
                count++;
            }
        }
        return count > 0 ? sumY / count : 0;
    }

    // ==================== ДИАГНОСТИКА ====================

    calculateDistribution(fingerprints) {
        const degreeDist = {};
        const bucketDist = {};
        const normBucketDist = {};
        const roleDist = {};
        const zoneDist = {};
       
        for (const fp of fingerprints.values()) {
            degreeDist[fp.degree] = (degreeDist[fp.degree] || 0) + 1;
            bucketDist[fp.degreeBucket] = (bucketDist[fp.degreeBucket] || 0) + 1;
            normBucketDist[fp.normBucket] = (normBucketDist[fp.normBucket] || 0) + 1;
            roleDist[fp.role] = (roleDist[fp.role] || 0) + 1;
            zoneDist[fp.zone] = (zoneDist[fp.zone] || 0) + 1;
        }
       
        return {
            degree: degreeDist,
            bucket: bucketDist,
            normBucket: normBucketDist,
            role: roleDist,
            zone: zoneDist
        };
    }

    getFingerprintInfo(fingerprints) {
        const degrees = Array.from(fingerprints.values()).map(fp => fp.degree);
        const normBuckets = Array.from(fingerprints.values()).map(fp => fp.normBucket);
        const signatures = Array.from(fingerprints.values()).map(fp => fp.signature);
        const uniqueSignatures = new Set(signatures);
        const distribution = this.calculateDistribution(fingerprints);
       
        const roles = {};
        const zones = {};
        for (const fp of fingerprints.values()) {
            roles[fp.role] = (roles[fp.role] || 0) + 1;
            zones[fp.zone] = (zones[fp.zone] || 0) + 1;
        }
       
        return {
            totalNodes: fingerprints.size,
            uniqueSignatures: uniqueSignatures.size,
            uniquenessRatio: uniqueSignatures.size / Math.max(1, fingerprints.size),
            avgDegree: degrees.reduce((a, b) => a + b, 0) / degrees.length,
            avgNormBucket: normBuckets.reduce((a, b) => a + b, 0) / normBuckets.length,
            degreeDistribution: distribution.degree,
            bucketDistribution: distribution.bucket,
            normBucketDistribution: distribution.normBucket,
            roleDistribution: distribution.role,
            zoneDistribution: distribution.zone,
            maxDegree: Math.max(...degrees),
            minDegree: Math.min(...degrees)
        };
    }

    printMatchDetails(exactMatches, similarMatches) {
        console.log(`\n🔍 ДЕТАЛИ СОВПАДЕНИЙ:`);
       
        if (exactMatches.length > 0) {
            console.log(`✅ ТОЧНЫЕ СОВПАДЕНИЯ (первые 5):`);
            exactMatches.slice(0, 5).forEach((match, idx) => {
                console.log(`   ${idx+1}. ${match.node1.substring(0, 16)}... ↔ ${match.node2.substring(0, 16)}...`);
                console.log(`      Подпись: ${match.signature?.substring(0, 20) || '...'}`);
                console.log(`      Роль: ${match.role}, зона: ${match.zone}`);
                console.log(`      NormBucket: ${match.normBucket}`);
            });
        }
       
        if (similarMatches.length > 0) {
            console.log(`🔄 СТРУКТУРНО ПОХОЖИЕ (первые 3):`);
            similarMatches.slice(0, 3).forEach((match, idx) => {
                console.log(`   ${idx+1}. ${match.node1.substring(0, 16)}... ↔ ${match.node2.substring(0, 16)}...`);
                console.log(`      Уверенность: ${(match.confidence * 100).toFixed(1)}%`);
                console.log(`      Роль: ${match.role}, зона: ${match.zone}`);
                console.log(`      NormBucket: ${match.normBucket}`);
            });
        }
    }

    visualizeMatches(comparisonResult, limit = 10) {
        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ СОВПАДЕНИЙ:`);
        console.log(`═`.repeat(100));
       
        const { allMatches, similarity, totalNodes1, totalNodes2, exactMatches, similarMatches } = comparisonResult;
       
        console.log(`🎯 СХОДСТВО: ${(similarity * 100).toFixed(1)}%`);
        console.log(`📊 СТАТИСТИКА:`);
        console.log(`   Точных совпадений: ${exactMatches.length}`);
        console.log(`   Структурно похожих: ${similarMatches.length}`);
        console.log(`   Всего совпадений: ${allMatches.length} / макс(${totalNodes1}, ${totalNodes2})`);
       
        if (allMatches.length > 0) {
            const matchedNodes1 = new Set(allMatches.map(m => m.node1)).size;
            const matchedNodes2 = new Set(allMatches.map(m => m.node2)).size;
            console.log(`   Покрытие графа 1: ${((matchedNodes1 / totalNodes1) * 100).toFixed(1)}%`);
            console.log(`   Покрытие графа 2: ${((matchedNodes2 / totalNodes2) * 100).toFixed(1)}%`);
        }
       
        console.log(`\n🔗 СОВПАДЕНИЯ (первые ${Math.min(limit, allMatches.length)}):`);
        console.log(`┌─────┬────────────────────┬─────────┬──────┬─────────┬────────────────────┬─────────┬──────┬─────────┐`);
        console.log(`│  #  │       МОДЕЛЬ       │ СТЕПЕНЬ │ РОЛЬ │  ЗОНА   │       ФОТО2        │ СТЕПЕНЬ │ РОЛЬ │  ЗОНА   │`);
        console.log(`├─────┼────────────────────┼─────────┼──────┼─────────┼────────────────────┼─────────┼──────┼─────────┤`);
       
        allMatches.slice(0, limit).forEach((match, idx) => {
            console.log(
                `│ ${(idx+1).toString().padEnd(3)} │ ${match.node1.substring(0, 18).padEnd(18)} │ ` +
                `${(match.degree || '').toString().padEnd(7)} │ ` +
                `${(match.role || '').padEnd(4)} │ ` +
                `${(match.zone || '').padEnd(7)} │ ` +
                `${match.node2.substring(0, 18).padEnd(18)} │ ` +
                `${(match.degree || '').toString().padEnd(7)} │ ` +
                `${(match.role || '').padEnd(4)} │ ` +
                `${(match.zone || '').padEnd(7)} │`
            );
        });
       
        if (allMatches.length > limit) {
            console.log(`├─────┼────────────────────┼─────────┼──────┼─────────┼────────────────────┼─────────┼──────┼─────────┤`);
            console.log(`│ ... │        ...         │   ...   │  ..  │   ...   │        ...         │   ...   │  ..  │   ...   │`);
        }
       
        console.log(`└─────┴────────────────────┴─────────┴──────┴─────────┴────────────────────┴─────────┴──────┴─────────┘`);
    }

    // ==================== ХЕШ-ФУНКЦИЯ ====================

    hashString(str) {
        if (this.hashCache.has(str)) {
            return this.hashCache.get(str);
        }
       
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
       
        const result = Math.abs(hash).toString(36).padStart(8, '0');
        this.hashCache.set(str, result);
        return result;
    }

    // ==================== ДЛЯ СОВМЕСТИМОСТИ ====================

    computeEnhancedSimilarity(fp1, fp2) {
        return this.computeNodeSimilarity(fp1, fp2);
    }

    // ==================== ОЧИСТКА КЕША ====================

    clearCache() {
        this.hashCache.clear();
        console.log('🧹 Кеш хешей очищен');
    }
}

module.exports = TopologicalFingerprint;
