// modules/footprint/topology/TopologicalFingerprint.js
// 🎯 ЧИСТАЯ ТОПОЛОГИЯ - ТОЛЬКО СТРУКТУРА ГРАФА (ПОЛНАЯ ВЕРСИЯ)

class TopologicalFingerprint {
    constructor(options = {}) {
        this.iterations = options.iterations || 3;
        this.debug = options.debug || false;
        this.hashCache = new Map();
       
        // 🔥 ТОЛЬКО ТОПОЛОГИЧЕСКИЕ ПАРАМЕТРЫ
        this.degreeBuckets = [
            [0, 2],   // Низкая степень
            [3, 4],   // Средняя степень
            [5, 6],   // Высокая степень
            [7, 100]  // Очень высокая степень
        ];
       
        // 🔥 НОВЫЙ ПАРАМЕТР: порог для структурного сходства
        this.structuralSimilarityThreshold = options.structuralSimilarityThreshold || 0.8;
       
        console.log('🔷 ЧИСТЫЙ ТОПОЛОГИЧЕСКИЙ АЛГОРИТМ (без координат)');
        console.log(`   Порог структурного сходства: ${this.structuralSimilarityThreshold}`);
    }
   
    // 🔥 МЕТОД 1: Только степень узла и структура соседей
    computeGraphFingerprints(graph) {
        console.log(`🔷 Вычисляю ЧИСТЫЕ ТОПОЛОГИЧЕСКИЕ подписи (${graph.nodes.size} узлов)...`);
       
        const nodes = graph.nodes;
        const edges = graph.edges;
       
        // 1. Создаем карту соседей для быстрого доступа
        const neighborMap = this.buildNeighborMap(nodes, edges);
       
        // 2. Инициализируем подписи на основе локальной структуры
        const signatures = new Map();
       
        for (const [nodeId, node] of nodes) {
            const neighbors = neighborMap.get(nodeId) || [];
            const degree = neighbors.length;
           
            // 🔥 КЛЮЧЕВОЕ: Только степень и структура соседей
            const structuralSignature = this.computeLocalStructure(nodeId, neighbors, neighborMap);
           
            const initialSig = this.hashString(`DEG_${this.getDegreeBucket(degree)}_STR_${structuralSignature}`);
           
            signatures.set(nodeId, {
                current: initialSig,
                degree: degree,
                degreeBucket: this.getDegreeBucket(degree),
                neighborCount: neighbors.length,
                localStructure: structuralSignature,
                neighborIds: neighbors,
                history: [initialSig]
            });
           
            if (this.debug && signatures.size <= 3) {
                console.log(`   Узел ${nodeId}:`);
                console.log(`     Степень: ${degree} (${this.getDegreeBucket(degree)})`);
                console.log(`     Соседи: ${neighbors.length} [${neighbors.slice(0, 3).join(', ')}...]`);
                console.log(`     Локальная структура: ${structuralSignature.substring(0, 30)}...`);
            }
        }
       
        // 3. Итеративное уточнение (Weisfeiler-Lehman)
        for (let iter = 0; iter < this.iterations; iter++) {
            const newSignatures = new Map();
           
            for (const [nodeId, node] of nodes) {
                const neighbors = neighborMap.get(nodeId) || [];
               
                const neighborSigs = [];
                for (const neighborId of neighbors) {
                    const neighborSig = signatures.get(neighborId)?.current || 'NO_SIG';
                    neighborSigs.push(neighborSig);
                }
               
                neighborSigs.sort();
               
                const currentSig = signatures.get(nodeId).current;
                const neighborSigStr = neighborSigs.length > 0 ?
                    neighborSigs.join('|') : 'NO_NEIGHBORS';
               
                const newSig = this.hashString(`${currentSig}|${neighborSigStr}`);
               
                newSignatures.set(nodeId, {
                    current: newSig,
                    degree: node.degree,
                    degreeBucket: signatures.get(nodeId).degreeBucket,
                    neighborCount: neighbors.length,
                    localStructure: signatures.get(nodeId).localStructure,
                    neighborIds: signatures.get(nodeId).neighborIds,
                    history: [...signatures.get(nodeId).history, newSig]
                });
            }
           
            for (const [nodeId, sig] of newSignatures) {
                signatures.set(nodeId, sig);
            }
           
            if (this.debug) {
                const uniqueSigs = new Set(Array.from(signatures.values()).map(s => s.current));
                console.log(`   Итерация ${iter + 1}: ${uniqueSigs.size} уникальных подписей`);
            }
        }
       
        // 4. Финальные подписи
        const finalSignatures = new Map();
        for (const [nodeId, sig] of signatures) {
            const recentHistory = sig.history.slice(-2);
            const finalSig = this.hashString(recentHistory.join('::'));
           
            finalSignatures.set(nodeId, {
                signature: finalSig,
                degree: sig.degree,
                degreeBucket: sig.degreeBucket,
                neighborCount: sig.neighborCount,
                localStructure: sig.localStructure,
                neighborIds: sig.neighborIds,
                historyLength: sig.history.length
            });
        }
       
        const uniqueCount = new Set(Array.from(finalSignatures.values()).map(s => s.signature)).size;
        const bucketDistribution = this.calculateDistribution(finalSignatures);
       
        console.log(`✅ ЧИСТЫЕ ТОПОЛОГИЧЕСКИЕ подписи:`);
        console.log(`   Узлов: ${finalSignatures.size}`);
        console.log(`   Уникальных подписей: ${uniqueCount} (${(uniqueCount/finalSignatures.size*100).toFixed(1)}%)`);
        console.log(`   Распределение по степеням:`, bucketDistribution.degree);
       
        return finalSignatures;
    }
   
    // 🔥 МЕТОД 2: Построение карты соседей
    buildNeighborMap(nodes, edges) {
        const neighborMap = new Map();
       
        for (const nodeId of nodes.keys()) {
            neighborMap.set(nodeId, []);
        }
       
        for (const edge of edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (neighborMap.has(nodeA)) neighborMap.get(nodeA).push(nodeB);
            if (neighborMap.has(nodeB)) neighborMap.get(nodeB).push(nodeA);
        }
       
        for (const neighbors of neighborMap.values()) {
            neighbors.sort();
        }
       
        return neighborMap;
    }
   
    // 🔥 МЕТОД 3: Вычисление локальной структуры (СМЯГЧЁННАЯ ВЕРСИЯ)
    computeLocalStructure(nodeId, neighbors, neighborMap) {
        if (neighbors.length === 0) {
            return 'ISOLATED';
        }
       
        // 1. ТОЛЬКО БАКЕТЫ, без точных чисел!
        const degreeBucket = this.getDegreeBucket(neighbors.length);
       
        // 2. Проверяем наличие треугольников (ДА/НЕТ)
        let hasTriangles = false;
        for (let i = 0; i < neighbors.length && !hasTriangles; i++) {
            for (let j = i + 1; j < neighbors.length && !hasTriangles; j++) {
                const neighborA = neighbors[i];
                const neighborB = neighbors[j];
                const neighborsOfA = neighborMap.get(neighborA) || [];
                if (neighborsOfA.includes(neighborB)) {
                    hasTriangles = true;
                }
            }
        }
       
        // 3. Проверяем, является ли узел мостом (ДА/НЕТ)
        let isBridge = false;
        if (neighbors.length === 2) {
            const [neighborA, neighborB] = neighbors;
            const neighborsOfA = neighborMap.get(neighborA) || [];
            const neighborsOfB = neighborMap.get(neighborB) || [];
            if (!neighborsOfA.includes(neighborB) && !neighborsOfB.includes(neighborA)) {
                isBridge = true;
            }
        }
       
        // 4. Проверяем, является ли узел листом (ДА/НЕТ)
        const isLeaf = neighbors.length === 1;
       
        // 5. Проверяем, является ли узел хабом (ДА/НЕТ)
        const isHub = neighbors.length >= 6;
       
        // 6. Проверяем, является ли узел частью клики (ДА/НЕТ)
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
       
        // 🔥 ТОЛЬКО КАЧЕСТВЕННЫЕ ПРИЗНАКИ!
        const features = [
            `DEG_${degreeBucket}`,
            hasTriangles ? 'TRI_YES' : 'TRI_NO',
            isBridge ? 'BRG_YES' : 'BRG_NO',
            isLeaf ? 'LFF_YES' : 'LFF_NO',
            isHub ? 'HUB_YES' : 'HUB_NO',
            isClique ? 'CLQ_YES' : 'CLQ_NO'
        ];
       
        return features.join('_');
    }
   
    // 🔥 МЕТОД 4: Группировка степеней
    getDegreeBucket(degree) {
        for (let i = 0; i < this.degreeBuckets.length; i++) {
            const [min, max] = this.degreeBuckets[i];
            if (degree >= min && degree <= max) {
                return `B${i}`;
            }
        }
        return 'B_OTHER';
    }
   
    // 🔥 МЕТОД 5: Сравнение графов (ГЛАВНЫЙ МЕТОД)
    compareGraphs(graph1, fingerprints1, graph2, fingerprints2) {
        console.log(`🔍 Сравниваю графы по ЧИСТОЙ ТОПОЛОГИИ...`);
       
        const sigToNodes1 = new Map();
        const sigToNodes2 = new Map();
       
        for (const [nodeId, fp] of fingerprints1) {
            if (!sigToNodes1.has(fp.signature)) sigToNodes1.set(fp.signature, []);
            sigToNodes1.get(fp.signature).push({ nodeId, degree: fp.degree, degreeBucket: fp.degreeBucket });
        }
       
        for (const [nodeId, fp] of fingerprints2) {
            if (!sigToNodes2.has(fp.signature)) sigToNodes2.set(fp.signature, []);
            sigToNodes2.get(fp.signature).push({ nodeId, degree: fp.degree, degreeBucket: fp.degreeBucket });
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
       
        console.log(`📊 Результат ЧИСТОГО ТОПОЛОГИЧЕСКОГО сравнения:`);
        console.log(`   Узлов в графе 1: ${totalNodes1}`);
        console.log(`   Узлов в графе 2: ${totalNodes2}`);
        console.log(`   Точных совпадений: ${exactMatches.length}`);
        console.log(`   Структурно похожих: ${similarMatches.length}`);
        console.log(`   Уникальных совпавших узлов в графе 1: ${matchedNodes1}`);
        console.log(`   Уникальных совпавших узлов в графе 2: ${matchedNodes2}`);
        console.log(`   Сходство графа1: ${(matchRatio1 * 100).toFixed(1)}%`);
        console.log(`   Сходство графа2: ${(matchRatio2 * 100).toFixed(1)}%`);
        console.log(`   Среднее сходство: ${(similarity * 100).toFixed(1)}%`);
       
        return {
            similarity,
            exactMatches,
            similarMatches,
            allMatches,
            matchRatio1,
            matchRatio2,
            matchedNodes1,
            matchedNodes2,
            totalNodes1,
            totalNodes2,
            method: 'pure_topological_structure'
        };
    }
   
    // 🔥 МЕТОД 6: Поиск структурно похожих узлов
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
                if (fp1.degreeBucket !== fp2.degreeBucket) continue;
               
                const similarity = this.computeStructuralSimilarity(fp1, fp2);
                if (similarity > bestSimilarity && similarity >= this.structuralSimilarityThreshold) {
                    bestSimilarity = similarity;
                    bestMatch = {
                        node1: nodeId1,
                        node2: nodeId2,
                        confidence: similarity,
                        degree: fp1.degree,
                        degreeBucket: fp1.degreeBucket,
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
       
        console.log(`🔍 Найдено ${similarMatches.length} структурно похожих узлов`);
        return similarMatches;
    }
   
    // 🔥 МЕТОД 7: Вычисление структурного сходства
    computeStructuralSimilarity(fp1, fp2) {
        const struct1 = fp1.localStructure.split('_');
        const struct2 = fp2.localStructure.split('_');
       
        const set1 = new Set(struct1);
        const set2 = new Set(struct2);
       
        let matches = 0;
        for (const term of set1) {
            if (set2.has(term)) matches++;
        }
       
        return matches / Math.max(set1.size, set2.size);
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculateDistribution(fingerprints) {
        const degreeDist = {};
        const bucketDist = {};
       
        for (const fp of fingerprints.values()) {
            degreeDist[fp.degree] = (degreeDist[fp.degree] || 0) + 1;
            bucketDist[fp.degreeBucket] = (bucketDist[fp.degreeBucket] || 0) + 1;
        }
       
        return { degree: degreeDist, bucket: bucketDist };
    }
   
    printMatchDetails(allMatches, exactMatches, similarMatches) {
        console.log(`\n🔍 ДЕТАЛИ СОВПАДЕНИЙ:`);
       
        if (exactMatches.length > 0) {
            console.log(`✅ ТОЧНЫЕ СОВПАДЕНИЯ (первые 5):`);
            exactMatches.slice(0, 5).forEach((match, idx) => {
                console.log(`   ${idx+1}. ${match.node1} ↔ ${match.node2}`);
                console.log(`      Подпись: ${match.signature.substring(0, 20)}...`);
            });
        }
       
        if (similarMatches.length > 0) {
            console.log(`🔄 СТРУКТУРНО ПОХОЖИЕ (первые 3):`);
            similarMatches.slice(0, 3).forEach((match, idx) => {
                console.log(`   ${idx+1}. ${match.node1} ↔ ${match.node2}`);
                console.log(`      Уверенность: ${(match.confidence * 100).toFixed(1)}%`);
                console.log(`      Степень: ${match.degree} (${match.degreeBucket})`);
            });
        }
    }
   
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
   
    getFingerprintInfo(fingerprints) {
        const degrees = Array.from(fingerprints.values()).map(fp => fp.degree);
        const signatures = Array.from(fingerprints.values()).map(fp => fp.signature);
        const uniqueSignatures = new Set(signatures);
        const distribution = this.calculateDistribution(fingerprints);
       
        return {
            totalNodes: fingerprints.size,
            uniqueSignatures: uniqueSignatures.size,
            uniquenessRatio: uniqueSignatures.size / Math.max(1, fingerprints.size),
            avgDegree: degrees.reduce((a, b) => a + b, 0) / degrees.length,
            degreeDistribution: distribution.degree,
            bucketDistribution: distribution.bucket,
            maxDegree: Math.max(...degrees),
            minDegree: Math.min(...degrees)
        };
    }
   
    visualizeMatches(comparisonResult, limit = 10) {
        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ СОВПАДЕНИЙ:`);
        console.log(`═`.repeat(60));
       
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
        allMatches.slice(0, limit).forEach((match, idx) => {
            console.log(`   ${idx + 1}. ${match.node1} ↔ ${match.node2}`);
            console.log(`      Тип: ${match.type === 'exact' ? 'ТОЧНОЕ' : 'ПОХОЖЕЕ'}`);
            console.log(`      Уверенность: ${(match.confidence * 100).toFixed(1)}%`);
            console.log(`      Степень: ${match.degree}`);
        });
       
        if (allMatches.length > limit) {
            console.log(`\n... и еще ${allMatches.length - limit} совпадений`);
        }
       
        console.log(`═`.repeat(60));
    }
}

module.exports = TopologicalFingerprint;
