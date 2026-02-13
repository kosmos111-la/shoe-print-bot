// modules/footprint/topology/TopologicalFingerprint.js
// 🎯 ЧИСТАЯ ТОПОЛОГИЯ + НОРМАЛИЗОВАННАЯ СТЕПЕНЬ (ПОЛНАЯ ВЕРСИЯ)

class TopologicalFingerprint {
    constructor(options = {}) {
        this.iterations = options.iterations || 3;
        this.debug = options.debug || false;
        this.hashCache = new Map();
       
        // 🔥 БАКЕТЫ ДЛЯ АБСОЛЮТНОЙ СТЕПЕНИ (РЕЗЕРВ)
        this.degreeBuckets = [
            [0, 2],   // B0: листья
            [3, 4],   // B1: низкая
            [5, 6],   // B2: средняя
            [7, 9],   // B3: высокая
            [10, 12], // B4: очень высокая
            [13, 100] // B5: экстремальная
        ];
       
        // 🔥🔥🔥 ПОРОГ ДЛЯ СТРУКТУРНОГО СХОДСТВА
        this.structuralSimilarityThreshold = options.structuralSimilarityThreshold || 0.8;
       
        console.log('🔷 НОРМАЛИЗОВАННЫЙ ТОПОЛОГИЧЕСКИЙ АЛГОРИТМ');
        console.log(`   Порог сходства: ${this.structuralSimilarityThreshold}`);
        console.log(`   Признаки: относительная степень, треугольники, геометрия`);
    }

    computeGraphFingerprints(graph) {
        console.log(`🔷 Вычисляю НОРМАЛИЗОВАННЫЕ топологические подписи (${graph.nodes.size} узлов)...`);
       
        const nodes = graph.nodes;
        const edges = graph.edges;
       
        // 1. Создаем карту соседей
        const neighborMap = this.buildNeighborMap(nodes, edges);
       
        // 🔥🔥🔥 2. ВЫЧИСЛЯЕМ ГЛОБАЛЬНЫЙ МАКСИМУМ СТЕПЕНИ!
        let maxDegree = 0;
        for (const node of nodes.values()) {
            const degree = neighborMap.get(node.id)?.length || 0;
            maxDegree = Math.max(maxDegree, degree);
        }
        console.log(`   📊 Максимальная степень в графе: ${maxDegree}`);
       
        // 3. Глобальная геометрия
        const globalStats = this.computeGlobalStats(graph);
       
        // 4. Инициализируем подписи
        const signatures = new Map();
       
        for (const [nodeId, node] of nodes) {
            const neighbors = neighborMap.get(nodeId) || [];
            const absoluteDegree = neighbors.length;
           
            // 🔥🔥🔥 5. НОРМАЛИЗОВАННАЯ СТЕПЕНЬ (0..1) → БАКЕТ (0..7)
            const normalizedDegree = maxDegree > 0 ? absoluteDegree / maxDegree : 0;
            const normBucket = Math.min(7, Math.floor(normalizedDegree * 8));
           
            // 6. Локальная структура с нормализованной степенью
            const structuralSignature = this.computeNormalizedLocalStructure(
                nodeId, neighbors, neighborMap, absoluteDegree, normalizedDegree, normBucket
            );
           
            const initialSig = this.hashString(structuralSignature);
           
            signatures.set(nodeId, {
                current: initialSig,
                degree: absoluteDegree,
                normalizedDegree: normalizedDegree,
                normBucket: normBucket,
                degreeBucket: this.getDegreeBucket(absoluteDegree),
                neighborCount: neighbors.length,
                localStructure: structuralSignature,
                neighborIds: neighbors,
                y: node.y,
                avgNeighborY: this.computeAvgNeighborY(nodeId, neighbors, graph),
                positionBucket: this.getPositionBucket(node.y),
                history: [initialSig]
            });
        }
       
        // 7. Итеративное уточнение с нормализованными подписями
        for (let iter = 0; iter < this.iterations; iter++) {
            const newSignatures = new Map();
           
            for (const [nodeId, node] of nodes) {
                const neighbors = neighborMap.get(nodeId) || [];
               
                const neighborSigs = [];
                const neighborNormBuckets = [];
               
                for (const neighborId of neighbors) {
                    const neighborSig = signatures.get(neighborId);
                    if (neighborSig) {
                        neighborSigs.push(neighborSig.current);
                        neighborNormBuckets.push(neighborSig.normBucket);
                    }
                }
               
                neighborSigs.sort();
                neighborNormBuckets.sort();
               
                // Статистика по нормализованным степеням соседей
                const avgNormBucket = neighborNormBuckets.length > 0
                    ? neighborNormBuckets.reduce((a, b) => a + b, 0) / neighborNormBuckets.length
                    : 0;
               
                const currentSig = signatures.get(nodeId).current;
                const neighborSigStr = neighborSigs.length > 0
                    ? neighborSigs.join('|')
                    : 'NO_NEIGHBORS';
               
                // Добавляем нормализованную статистику в подпись
                const newSig = this.hashString(
                    `${currentSig}|${neighborSigStr}|NB_${Math.round(avgNormBucket)}`
                );
               
                newSignatures.set(nodeId, {
                    current: newSig,
                    degree: node.degree,
                    normalizedDegree: signatures.get(nodeId).normalizedDegree,
                    normBucket: signatures.get(nodeId).normBucket,
                    degreeBucket: signatures.get(nodeId).degreeBucket,
                    neighborCount: neighbors.length,
                    localStructure: signatures.get(nodeId).localStructure,
                    neighborIds: signatures.get(nodeId).neighborIds,
                    y: signatures.get(nodeId).y,
                    avgNeighborY: signatures.get(nodeId).avgNeighborY,
                    positionBucket: signatures.get(nodeId).positionBucket,
                    history: [...signatures.get(nodeId).history, newSig]
                });
            }
           
            for (const [nodeId, sig] of newSignatures) {
                signatures.set(nodeId, sig);
            }
        }
       
        // 8. Финальные подписи
        const finalSignatures = new Map();
        for (const [nodeId, sig] of signatures) {
            const recentHistory = sig.history.slice(-2);
            const finalSig = this.hashString(recentHistory.join('::'));
           
            finalSignatures.set(nodeId, {
                signature: finalSig,
                degree: sig.degree,
                normalizedDegree: sig.normalizedDegree,
                normBucket: sig.normBucket,
                degreeBucket: sig.degreeBucket,
                neighborCount: sig.neighborCount,
                localStructure: sig.localStructure,
                neighborIds: sig.neighborIds,
                y: sig.y,
                avgNeighborY: sig.avgNeighborY,
                positionBucket: sig.positionBucket,
                historyLength: sig.history.length
            });
        }
       
        const uniqueCount = new Set(Array.from(finalSignatures.values()).map(s => s.signature)).size;
       
        console.log(`✅ НОРМАЛИЗОВАННЫЕ топологические подписи:`);
        console.log(`   Узлов: ${finalSignatures.size}`);
        console.log(`   Уникальных подписей: ${uniqueCount} (${(uniqueCount/finalSignatures.size*100).toFixed(1)}%)`);
        console.log(`   Диапазон нормализованной степени: 0-1 → бакеты 0-7`);
       
        return finalSignatures;
    }

    // 🔥🔥🔥 НОВЫЙ МЕТОД: Локальная структура с НОРМАЛИЗОВАННОЙ степенью
    computeNormalizedLocalStructure(nodeId, neighbors, neighborMap, absoluteDegree, normalizedDegree, normBucket) {
        if (neighbors.length === 0) {
            return 'ISOLATED';
        }
       
        const features = [];
       
        // 1. 🔥 НОРМАЛИЗОВАННАЯ СТЕПЕНЬ (ИНВАРИАНТ К РАЗМЕРУ ГРАФА!)
        features.push(`NORM_B${normBucket}`);
        features.push(`ABS_DEG_${absoluteDegree}`); // для отладки
       
        // 2. ТРЕУГОЛЬНИКИ
        let triangleCount = 0;
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const neighborA = neighbors[i];
                const neighborB = neighbors[j];
                const neighborsOfA = neighborMap.get(neighborA) || [];
                if (neighborsOfA.includes(neighborB)) {
                    triangleCount++;
                }
            }
        }
        features.push(`TRI_${triangleCount}`);
       
        // 3. МОСТ
        let isBridge = false;
        if (neighbors.length === 2) {
            const [neighborA, neighborB] = neighbors;
            const neighborsOfA = neighborMap.get(neighborA) || [];
            const neighborsOfB = neighborMap.get(neighborB) || [];
            if (!neighborsOfA.includes(neighborB) && !neighborsOfB.includes(neighborA)) {
                isBridge = true;
            }
        }
        features.push(isBridge ? 'BRG_YES' : 'BRG_NO');
       
        // 4. ЛИСТ
        features.push(neighbors.length === 1 ? 'LEAF_YES' : 'LEAF_NO');
       
        // 5. ХАБ (теперь на основе нормализованной степени!)
        features.push(normBucket >= 5 ? 'HUB_YES' : 'HUB_NO');
       
        // 6. КЛИКА
        let isClique = false;
        if (neighbors.length >= 3) {
            let allConnected = true;
            for (let i = 0; i < neighbors.length && allConnected; i++) {
                for (let j = i + 1; j < neighbors.length && allConnected; j++) {
                    const neighborA = neighbors[i];
                    const neighborB = neighbors[j];
                    const neighborsOfA = neighborMap.get(neighborA) || [];
                    if (!neighborsOfA.includes(neighborB)) {
                        allConnected = false;
                    }
                }
            }
            isClique = allConnected;
        }
        features.push(isClique ? 'CLQ_YES' : 'CLQ_NO');
       
        // 7. СТАТИСТИКА ПО СОСЕДЯМ (тоже нормализованная!)
        const neighborDegrees = [];
        for (const neighborId of neighbors) {
            const neighborNeighbors = neighborMap.get(neighborId) || [];
            neighborDegrees.push(neighborNeighbors.length);
        }
       
        const maxNeighborDegree = Math.max(...neighborDegrees);
        const minNeighborDegree = Math.min(...neighborDegrees);
        const avgNeighborDegree = neighborDegrees.reduce((a, b) => a + b, 0) / neighborDegrees.length;
       
        features.push(`MAX_ND_${maxNeighborDegree}`);
        features.push(`MIN_ND_${minNeighborDegree}`);
        features.push(`AVG_ND_${Math.round(avgNeighborDegree)}`);
       
        return features.join('_');
    }

    // 🔥🔥🔥 НОВЫЙ МЕТОД: Сравнение с нормализованной степенью
    computeNormalizedSimilarity(fp1, fp2) {
        let similarity = 0;
        let totalWeight = 0;
       
        // 1. НОРМАЛИЗОВАННАЯ СТЕПЕНЬ (вес 30%) - ИНВАРИАНТ!
        const normBucketDiff = Math.abs(fp1.normBucket - fp2.normBucket);
        const normSim = 1.0 - (normBucketDiff / 8); // бакеты 0-7
        similarity += normSim * 0.30;
        totalWeight += 0.30;
       
        // 2. АБСОЛЮТНАЯ СТЕПЕНЬ (вес 10%) - для точных совпадений
        if (fp1.degreeBucket === fp2.degreeBucket) {
            similarity += 0.10;
        }
        totalWeight += 0.10;
       
        // 3. Количество соседей (вес 15%)
        const neighborDiff = Math.abs(fp1.neighborCount - fp2.neighborCount);
        const neighborSim = 1.0 - (neighborDiff / Math.max(fp1.neighborCount, fp2.neighborCount, 1));
        similarity += neighborSim * 0.15;
        totalWeight += 0.15;
       
        // 4. Локальная структура (вес 30%)
        if (fp1.localStructure && fp2.localStructure) {
            const structureSim = this.computeLocalStructureSimilarity(
                fp1.localStructure,
                fp2.localStructure
            );
            similarity += structureSim * 0.30;
        }
        totalWeight += 0.30;
       
        // 5. Позиция (вес 15%)
        if (fp1.positionBucket === fp2.positionBucket) {
            similarity += 0.15;
        }
        totalWeight += 0.15;
       
        return similarity / totalWeight;
    }

    // 🔥 ГЛОБАЛЬНАЯ СТАТИСТИКА
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

    // 🔥 ПОЗИЦИЯ
    getPositionBucket(y) {
        if (y > 350) return 'HEEL';
        if (y < 200) return 'TOE';
        return 'CENTER';
    }

    // 🔥 СРЕДНИЙ Y СОСЕДЕЙ
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

    // 🔥 БАКЕТ АБСОЛЮТНОЙ СТЕПЕНИ
    getDegreeBucket(degree) {
        for (let i = 0; i < this.degreeBuckets.length; i++) {
            const [min, max] = this.degreeBuckets[i];
            if (degree >= min && degree <= max) {
                return `B${i}`;
            }
        }
        return 'B5';
    }

    // 🔥 КАРТА СОСЕДЕЙ
    buildNeighborMap(nodes, edges) {
        const neighborMap = new Map();
        for (const nodeId of nodes.keys()) neighborMap.set(nodeId, []);
        for (const edge of edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (neighborMap.has(nodeA)) neighborMap.get(nodeA).push(nodeB);
            if (neighborMap.has(nodeB)) neighborMap.get(nodeB).push(nodeA);
        }
        for (const neighbors of neighborMap.values()) neighbors.sort();
        return neighborMap;
    }

    // 🔥 СРАВНЕНИЕ ГРАФОВ
    compareGraphs(graph1, fingerprints1, graph2, fingerprints2) {
        console.log(`🔍 Сравниваю графы с НОРМАЛИЗОВАННОЙ степенью...`);
       
        const sigToNodes1 = new Map();
        const sigToNodes2 = new Map();
       
        for (const [nodeId, fp] of fingerprints1) {
            if (!sigToNodes1.has(fp.signature)) sigToNodes1.set(fp.signature, []);
            sigToNodes1.get(fp.signature).push({
                nodeId,
                degree: fp.degree,
                normBucket: fp.normBucket,
                positionBucket: fp.positionBucket
            });
        }
       
        for (const [nodeId, fp] of fingerprints2) {
            if (!sigToNodes2.has(fp.signature)) sigToNodes2.set(fp.signature, []);
            sigToNodes2.get(fp.signature).push({
                nodeId,
                degree: fp.degree,
                normBucket: fp.normBucket,
                positionBucket: fp.positionBucket
            });
        }
       
        const exactMatches = [];
        for (const [sig, nodes1] of sigToNodes1) {
            if (sigToNodes2.has(sig)) {
                const nodes2 = sigToNodes2.get(sig);
                for (let i = 0; i < Math.min(nodes1.length, nodes2.length); i++) {
                    exactMatches.push({
                        node1: nodes1[i].nodeId,
                        node2: nodes2[i].nodeId,
                        signature: sig,
                        confidence: 1.0,
                        degree: nodes1[i].degree,
                        normBucket: nodes1[i].normBucket,
                        positionBucket: nodes1[i].positionBucket,
                        type: 'exact'
                    });
                }
            }
        }
       
        const similarMatches = this.findSimilarNodes(fingerprints1, fingerprints2);
        const allMatches = [...exactMatches, ...similarMatches];
       
        const totalNodes1 = fingerprints1.size;
        const totalNodes2 = fingerprints2.size;
        const matchedNodes1 = new Set(allMatches.map(m => m.node1)).size;
        const matchedNodes2 = new Set(allMatches.map(m => m.node2)).size;
       
        const matchRatio1 = matchedNodes1 / Math.max(1, totalNodes1);
        const matchRatio2 = matchedNodes2 / Math.max(1, totalNodes2);
        const similarity = (matchRatio1 + matchRatio2) / 2;
       
        console.log(`📊 Результат НОРМАЛИЗОВАННОГО сравнения:`);
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
            method: 'normalized_topological'
        };
    }

    // 🔥 ПОИСК ПОХОЖИХ
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
               
                // 🔥 ЖЁСТКИЙ ФИЛЬТР ПО ГЕОМЕТРИИ
                if (fp1.positionBucket !== fp2.positionBucket) continue;
               
                // 🔥 НОРМАЛИЗОВАННОЕ СРАВНЕНИЕ!
                const similarity = this.computeNormalizedSimilarity(fp1, fp2);
               
                if (similarity > bestSimilarity && similarity >= this.structuralSimilarityThreshold) {
                    bestSimilarity = similarity;
                    bestMatch = {
                        node1: nodeId1,
                        node2: nodeId2,
                        confidence: similarity,
                        degree: fp1.degree,
                        normBucket: fp1.normBucket,
                        positionBucket: fp1.positionBucket,
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

    // 🔥 СРАВНЕНИЕ ЛОКАЛЬНЫХ СТРУКТУР
    computeLocalStructureSimilarity(struct1, struct2) {
        const terms1 = struct1.split('_');
        const terms2 = struct2.split('_');
       
        const set1 = new Set(terms1);
        const set2 = new Set(terms2);
       
        let matches = 0;
        for (const term of set1) {
            if (set2.has(term)) matches++;
        }
       
        return matches / Math.max(set1.size, set2.size);
    }

    // 🔥🔥🔥 ВОССТАНОВЛЕННЫЕ ДИАГНОСТИЧЕСКИЕ МЕТОДЫ

    calculateDistribution(fingerprints) {
        const degreeDist = {};
        const bucketDist = {};
        const normBucketDist = {};
       
        for (const fp of fingerprints.values()) {
            degreeDist[fp.degree] = (degreeDist[fp.degree] || 0) + 1;
            bucketDist[fp.degreeBucket] = (bucketDist[fp.degreeBucket] || 0) + 1;
            normBucketDist[fp.normBucket] = (normBucketDist[fp.normBucket] || 0) + 1;
        }
       
        return {
            degree: degreeDist,
            bucket: bucketDist,
            normBucket: normBucketDist
        };
    }

    getFingerprintInfo(fingerprints) {
        const degrees = Array.from(fingerprints.values()).map(fp => fp.degree);
        const normBuckets = Array.from(fingerprints.values()).map(fp => fp.normBucket);
        const signatures = Array.from(fingerprints.values()).map(fp => fp.signature);
        const uniqueSignatures = new Set(signatures);
        const distribution = this.calculateDistribution(fingerprints);
       
        return {
            totalNodes: fingerprints.size,
            uniqueSignatures: uniqueSignatures.size,
            uniquenessRatio: uniqueSignatures.size / Math.max(1, fingerprints.size),
            avgDegree: degrees.reduce((a, b) => a + b, 0) / degrees.length,
            avgNormBucket: normBuckets.reduce((a, b) => a + b, 0) / normBuckets.length,
            degreeDistribution: distribution.degree,
            bucketDistribution: distribution.bucket,
            normBucketDistribution: distribution.normBucket,
            maxDegree: Math.max(...degrees),
            minDegree: Math.min(...degrees)
        };
    }

    printMatchDetails(allMatches, exactMatches, similarMatches) {
        console.log(`\n🔍 ДЕТАЛИ СОВПАДЕНИЙ:`);
       
        if (exactMatches.length > 0) {
            console.log(`✅ ТОЧНЫЕ СОВПАДЕНИЯ (первые 5):`);
            exactMatches.slice(0, 5).forEach((match, idx) => {
                console.log(`   ${idx+1}. ${match.node1} ↔ ${match.node2}`);
                console.log(`      Подпись: ${match.signature?.substring(0, 20) || '...'}`);
                console.log(`      Позиция: ${match.positionBucket || '?'}`);
                console.log(`      NormBucket: ${match.normBucket}`);
            });
        }
       
        if (similarMatches.length > 0) {
            console.log(`🔄 СТРУКТУРНО ПОХОЖИЕ (первые 3):`);
            similarMatches.slice(0, 3).forEach((match, idx) => {
                console.log(`   ${idx+1}. ${match.node1} ↔ ${match.node2}`);
                console.log(`      Уверенность: ${(match.confidence * 100).toFixed(1)}%`);
                console.log(`      Степень: ${match.degree}`);
                console.log(`      NormBucket: ${match.normBucket}`);
                console.log(`      Позиция: ${match.positionBucket}`);
            });
        }
    }

    visualizeMatches(comparisonResult, limit = 10) {
        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ СОВПАДЕНИЙ:`);
        console.log(`═`.repeat(90));
       
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
        console.log(`┌─────┬────────────────────┬─────────┬──────────┬────────────────────┬─────────┬─────────┐`);
        console.log(`│  #  │       МОДЕЛЬ       │ СТЕПЕНЬ │ NORM_B   │       ФОТО2        │ СТЕПЕНЬ │ NORM_B  │`);
        console.log(`├─────┼────────────────────┼─────────┼──────────┼────────────────────┼─────────┼─────────┤`);
       
        allMatches.slice(0, limit).forEach((match, idx) => {
            console.log(
                `│ ${(idx+1).toString().padEnd(3)} │ ${match.node1.substring(0, 18).padEnd(18)} │ ` +
                `${(match.degree || '').toString().padEnd(7)} │ ` +
                `${(match.normBucket || '').toString().padEnd(8)} │ ` +
                `${match.node2.substring(0, 18).padEnd(18)} │ ` +
                `${(match.degree || '').toString().padEnd(7)} │ ` +
                `${(match.normBucket || '').toString().padEnd(7)} │`
            );
        });
       
        if (allMatches.length > limit) {
            console.log(`├─────┼────────────────────┼─────────┼──────────┼────────────────────┼─────────┼─────────┤`);
            console.log(`│ ... │       ...          │   ...   │   ...    │       ...          │   ...   │   ...   │`);
        }
       
        console.log(`└─────┴────────────────────┴─────────┴──────────┴────────────────────┴─────────┴─────────┘`);
    }

    // 🔥 ХЕШ-ФУНКЦИЯ
    hashString(str) {
        if (this.hashCache.has(str)) return this.hashCache.get(str);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const result = Math.abs(hash).toString(16).padStart(12, '0');
        this.hashCache.set(str, result);
        return result;
    }

    // 🔥 ДЛЯ СОВМЕСТИМОСТИ
    computeEnhancedSimilarity(fp1, fp2) {
        return this.computeNormalizedSimilarity(fp1, fp2);
    }
}

module.exports = TopologicalFingerprint;
