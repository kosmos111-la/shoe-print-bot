// modules/footprint/topology/TopologicalFingerprint.js
// 🎯 ЧИСТАЯ ТОПОЛОГИЯ - ТОЛЬКО КАЧЕСТВЕННЫЕ ПРИЗНАКИ

class TopologicalFingerprint {
    constructor(options = {}) {
        this.iterations = options.iterations || 3;
        this.debug = options.debug || false;
        this.hashCache = new Map();
       
        // 🔥 БАКЕТЫ ДЛЯ СТЕПЕНЕЙ (ВСЕГО 5 ГРУПП)
        this.degreeBuckets = [
            [0, 2],   // B0: изолированные и листья
            [3, 4],   // B1: низкая степень
            [5, 6],   // B2: средняя степень
            [7, 10],  // B3: высокая степень
            [11, 100] // B4: очень высокая степень
        ];
       
        // 🔥 ПОРОГ СХОДСТВА
        this.structuralSimilarityThreshold = options.structuralSimilarityThreshold || 0.7;
       
        console.log('🔷 ЧИСТЫЙ ТОПОЛОГИЧЕСКИЙ АЛГОРИТМ (качественные признаки)');
        console.log(`   Порог сходства: ${this.structuralSimilarityThreshold}`);
    }

    computeGraphFingerprints(graph) {
        console.log(`🔷 Вычисляю ТОПОЛОГИЧЕСКИЕ подписи (${graph.nodes.size} узлов)...`);
       
        const nodes = graph.nodes;
        const edges = graph.edges;
        const neighborMap = this.buildNeighborMap(nodes, edges);
        const signatures = new Map();
       
        // Начальные подписи
        for (const [nodeId, node] of nodes) {
            const neighbors = neighborMap.get(nodeId) || [];
           
            // 🔥🔥🔥 ТОЛЬКО КАЧЕСТВЕННЫЕ ПРИЗНАКИ!
            const structuralSignature = this.computeLocalStructure(nodeId, neighbors, neighborMap);
           
            signatures.set(nodeId, {
                current: structuralSignature,
                degree: neighbors.length,
                degreeBucket: this.getDegreeBucket(neighbors.length),
                neighborCount: neighbors.length,
                localStructure: structuralSignature,
                neighborIds: neighbors,
                history: [structuralSignature]
            });
        }
       
        // 3. Итеративное уточнение (Weisfeiler-Lehman)
        for (let iter = 0; iter < this.iterations; iter++) {
            const newSignatures = new Map();
           
            for (const [nodeId, node] of nodes) {
                const neighbors = neighborMap.get(nodeId) || [];
               
                // Собираем подписи соседей
                const neighborSigs = [];
                for (const neighborId of neighbors) {
                    const neighborSig = signatures.get(neighborId)?.current || '';
                    if (neighborSig) neighborSigs.push(neighborSig);
                }
               
                neighborSigs.sort();
               
                const currentSig = signatures.get(nodeId).current;
                const uniqueNeighborSigs = [...new Set(neighborSigs)].join('|');
                const newSig = this.hashString(`${currentSig}|${uniqueNeighborSigs}`);
               
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
        }
       
        // Финальные подписи
        const finalSignatures = new Map();
        for (const [nodeId, sig] of signatures) {
            finalSignatures.set(nodeId, {
                signature: sig.current,
                degree: sig.degree,
                degreeBucket: sig.degreeBucket,
                neighborCount: sig.neighborCount,
                localStructure: sig.localStructure,
                neighborIds: sig.neighborIds,
                historyLength: sig.history.length
            });
        }
       
        // Статистика
        const uniqueCount = new Set(Array.from(finalSignatures.values()).map(s => s.signature)).size;
       
        console.log(`✅ ТОПОЛОГИЧЕСКИЕ подписи:`);
        console.log(`   Узлов: ${finalSignatures.size}`);
        console.log(`   Уникальных подписей: ${uniqueCount} (${(uniqueCount/finalSignatures.size*100).toFixed(1)}%)`);
       
        return finalSignatures;
    }

    // 🔥🔥🔥 ТОЛЬКО КАЧЕСТВЕННЫЕ ПРИЗНАКИ! БЕЗ ЧИСЕЛ!
    computeLocalStructure(nodeId, neighbors, neighborMap) {
        if (neighbors.length === 0) {
            return 'ISOLATED';
        }

        // 1. БАКЕТ СТЕПЕНИ (B0, B1, B2, B3, B4)
        const degreeBucket = this.getDegreeBucket(neighbors.length);
       
        // 2. ЕСТЬ ЛИ ТРЕУГОЛЬНИКИ? (ДА/НЕТ)
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

        // 3. ЯВЛЯЕТСЯ ЛИ МОСТОМ? (ДА/НЕТ)
        let isBridge = false;
        if (neighbors.length === 2) {
            const [neighborA, neighborB] = neighbors;
            const neighborsOfA = neighborMap.get(neighborA) || [];
            const neighborsOfB = neighborMap.get(neighborB) || [];
            if (!neighborsOfA.includes(neighborB) && !neighborsOfB.includes(neighborA)) {
                isBridge = true;
            }
        }

        // 4. ЛИСТ? (ДА/НЕТ)
        const isLeaf = neighbors.length === 1;
       
        // 5. ХАБ? (ДА/НЕТ)
        const isHub = neighbors.length >= 6;
       
        // 6. ЯВЛЯЕТСЯ ЛИ ЧАСТЬЮ КЛИКИ? (ДА/НЕТ)
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

    getDegreeBucket(degree) {
        for (let i = 0; i < this.degreeBuckets.length; i++) {
            const [min, max] = this.degreeBuckets[i];
            if (degree >= min && degree <= max) {
                return `B${i}`;
            }
        }
        return 'B4';
    }

    compareGraphs(graph1, fingerprints1, graph2, fingerprints2) {
        console.log(`🔍 Сравниваю графы по ТОПОЛОГИИ...`);
       
        // Точные совпадения подписей
        const sigToNodes1 = new Map();
        const sigToNodes2 = new Map();
       
        for (const [nodeId, fp] of fingerprints1) {
            if (!sigToNodes1.has(fp.signature)) sigToNodes1.set(fp.signature, []);
            sigToNodes1.get(fp.signature).push(nodeId);
        }
       
        for (const [nodeId, fp] of fingerprints2) {
            if (!sigToNodes2.has(fp.signature)) sigToNodes2.set(fp.signature, []);
            sigToNodes2.get(fp.signature).push(nodeId);
        }
       
        const exactMatches = [];
        for (const [sig, nodes1] of sigToNodes1) {
            if (sigToNodes2.has(sig)) {
                const nodes2 = sigToNodes2.get(sig);
                for (let i = 0; i < Math.min(nodes1.length, nodes2.length); i++) {
                    exactMatches.push({
                        node1: nodes1[i],
                        node2: nodes2[i],
                        signature: sig,
                        confidence: 1.0,
                        type: 'exact'
                    });
                }
            }
        }
       
        // Похожие совпадения
        const similarMatches = this.findSimilarNodes(fingerprints1, fingerprints2);
        const allMatches = [...exactMatches, ...similarMatches];
       
        const totalNodes1 = fingerprints1.size;
        const totalNodes2 = fingerprints2.size;
        const matchedNodes1 = new Set(allMatches.map(m => m.node1)).size;
        const matchedNodes2 = new Set(allMatches.map(m => m.node2)).size;
       
        const matchRatio1 = matchedNodes1 / Math.max(1, totalNodes1);
        const matchRatio2 = matchedNodes2 / Math.max(1, totalNodes2);
        const similarity = (matchRatio1 + matchRatio2) / 2;
       
        console.log(`📊 Результат сравнения:`);
        console.log(`   Узлов в графе 1: ${totalNodes1}`);
        console.log(`   Узлов в графе 2: ${totalNodes2}`);
        console.log(`   Точных совпадений: ${exactMatches.length}`);
        console.log(`   Структурно похожих: ${similarMatches.length}`);
        console.log(`   Уникальных совпавших узлов в графе 1: ${matchedNodes1}`);
        console.log(`   Уникальных совпавших узлов в графе 2: ${matchedNodes2}`);
        console.log(`   Сходство: ${(similarity * 100).toFixed(1)}%`);
       
        return {
            similarity,
            exactMatches,
            similarMatches,
            allMatches,
            matchedNodes1,
            matchedNodes2,
            totalNodes1,
            totalNodes2
        };
    }

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
       
        return similarMatches;
    }

    computeStructuralSimilarity(fp1, fp2) {
        // Сравнение качественных признаков
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
       
        return {
            totalNodes: fingerprints.size,
            uniqueSignatures: uniqueSignatures.size,
            uniquenessRatio: uniqueSignatures.size / Math.max(1, fingerprints.size),
            avgDegree: degrees.reduce((a, b) => a + b, 0) / degrees.length
        };
    }
}

module.exports = TopologicalFingerprint;
