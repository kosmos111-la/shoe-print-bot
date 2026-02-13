// modules/footprint/topology/TopologicalFingerprint.js
// 🎯 ЧИСТАЯ ТОПОЛОГИЯ + ГЕОМЕТРИЧЕСКИЕ ПРИЗНАКИ (ПОЛНАЯ ВЕРСИЯ)

class TopologicalFingerprint {
    constructor(options = {}) {
        this.iterations = options.iterations || 3;
        this.debug = options.debug || false;
        this.hashCache = new Map();
       
        // 🔥 РАСШИРЕННЫЕ БАКЕТЫ ДЛЯ СТЕПЕНЕЙ
        this.degreeBuckets = [
            [0, 2],   // B0: изолированные и листья
            [3, 4],   // B1: низкая степень
            [5, 6],   // B2: средняя степень
            [7, 9],   // B3: высокая степень
            [10, 12], // B4: очень высокая степень
            [13, 100] // B5: экстремально высокая степень
        ];
       
        // 🔥 ПОРОГ ДЛЯ СТРУКТУРНОГО СХОДСТВА
        this.structuralSimilarityThreshold = options.structuralSimilarityThreshold || 0.85;
       
        console.log('🔷 УСИЛЕННЫЙ ТОПОЛОГИЧЕСКИЙ АЛГОРИТМ (с геометрией)');
        console.log(`   Порог сходства: ${this.structuralSimilarityThreshold}`);
        console.log(`   Признаки: степень, треугольники, мосты, листья, хабы, клики, положение`);
    }
   
    computeGraphFingerprints(graph) {
        console.log(`🔷 Вычисляю УСИЛЕННЫЕ топологические подписи (${graph.nodes.size} узлов)...`);
       
        const nodes = graph.nodes;
        const edges = graph.edges;
       
        const neighborMap = this.buildNeighborMap(nodes, edges);
        const globalStats = this.computeGlobalStats(graph);
        const signatures = new Map();
       
        for (const [nodeId, node] of nodes) {
            const neighbors = neighborMap.get(nodeId) || [];
            const degree = neighbors.length;
           
            const structuralSignature = this.computeEnhancedLocalStructure(
                nodeId, neighbors, neighborMap, globalStats
            );
           
            const initialSig = this.hashString(structuralSignature);
           
            signatures.set(nodeId, {
                current: initialSig,
                degree: degree,
                degreeBucket: this.getDegreeBucket(degree),
                neighborCount: neighbors.length,
                localStructure: structuralSignature,
                neighborIds: neighbors,
                y: node.y,
                avgNeighborY: this.computeAvgNeighborY(nodeId, neighbors, graph),
                positionBucket: this.getPositionBucket(node.y),
                history: [initialSig]
            });
        }
       
        for (let iter = 0; iter < this.iterations; iter++) {
            const newSignatures = new Map();
           
            for (const [nodeId, node] of nodes) {
                const neighbors = neighborMap.get(nodeId) || [];
               
                const neighborSigs = [];
                const neighborY = [];
               
                for (const neighborId of neighbors) {
                    const neighborSig = signatures.get(neighborId);
                    if (neighborSig) {
                        neighborSigs.push(neighborSig.current);
                        neighborY.push(neighborSig.y || 0);
                    }
                }
               
                neighborSigs.sort();
                neighborY.sort();
               
                const avgNeighborY = neighborY.length > 0
                    ? neighborY.reduce((a, b) => a + b, 0) / neighborY.length
                    : 0;
                const yBucket = this.getPositionBucket(avgNeighborY);
               
                const currentSig = signatures.get(nodeId).current;
                const neighborSigStr = neighborSigs.length > 0
                    ? neighborSigs.join('|')
                    : 'NO_NEIGHBORS';
               
                const newSig = this.hashString(
                    `${currentSig}|${neighborSigStr}|Y_${yBucket}`
                );
               
                newSignatures.set(nodeId, {
                    current: newSig,
                    degree: node.degree,
                    degreeBucket: signatures.get(nodeId).degreeBucket,
                    neighborCount: neighbors.length,
                    localStructure: signatures.get(nodeId).localStructure,
                    neighborIds: signatures.get(nodeId).neighborIds,
                    y: signatures.get(nodeId).y,
                    avgNeighborY: avgNeighborY,
                    positionBucket: signatures.get(nodeId).positionBucket,
                    history: [...signatures.get(nodeId).history, newSig]
                });
            }
           
            for (const [nodeId, sig] of newSignatures) {
                signatures.set(nodeId, sig);
            }
        }
       
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
                y: sig.y,
                avgNeighborY: sig.avgNeighborY,
                positionBucket: sig.positionBucket,
                historyLength: sig.history.length
            });
        }
       
        const uniqueCount = new Set(Array.from(finalSignatures.values()).map(s => s.signature)).size;
       
        console.log(`✅ УСИЛЕННЫЕ топологические подписи:`);
        console.log(`   Узлов: ${finalSignatures.size}`);
        console.log(`   Уникальных подписей: ${uniqueCount} (${(uniqueCount/finalSignatures.size*100).toFixed(1)}%)`);
       
        return finalSignatures;
    }
   
    computeGlobalStats(graph) {
        const yCoords = [];
        for (const node of graph.nodes.values()) {
            yCoords.push(node.y);
        }
       
        yCoords.sort((a, b) => a - b);
       
        return {
            yMin: yCoords[0] || 0,
            yMax: yCoords[yCoords.length - 1] || 600,
            yMedian: yCoords[Math.floor(yCoords.length / 2)] || 300,
            yQ1: yCoords[Math.floor(yCoords.length / 4)] || 150,
            yQ3: yCoords[Math.floor(yCoords.length * 3 / 4)] || 450
        };
    }
   
    computeEnhancedLocalStructure(nodeId, neighbors, neighborMap, globalStats) {
        if (neighbors.length === 0) {
            return 'ISOLATED';
        }
       
        const features = [];
       
        // 1. СТЕПЕНЬ
        features.push(`DEG_${this.getDegreeBucket(neighbors.length)}`);
        features.push(`DEG_VAL_${neighbors.length}`);
       
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
        features.push(triangleCount > 0 ? 'TRI_YES' : 'TRI_NO');
       
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
       
        // 5. ХАБ
        features.push(neighbors.length >= 6 ? 'HUB_YES' : 'HUB_NO');
       
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
       
        // 7. СТАТИСТИКА ПО СОСЕДЯМ
        const neighborDegrees = [];
        for (const neighborId of neighbors) {
            const neighborNeighbors = neighborMap.get(neighborId) || [];
            neighborDegrees.push(neighborNeighbors.length);
        }
        neighborDegrees.sort((a, b) => a - b);
       
        const avgNeighborDegree = neighborDegrees.length > 0
            ? Math.round(neighborDegrees.reduce((a, b) => a + b, 0) / neighborDegrees.length)
            : 0;
        features.push(`AVG_NDEG_${avgNeighborDegree}`);
        features.push(`MAX_NDEG_${Math.max(...neighborDegrees)}`);
        features.push(`MIN_NDEG_${Math.min(...neighborDegrees)}`);
       
        return features.join('_');
    }
   
    getPositionBucket(y) {
        if (y > 350) return 'HEEL';
        if (y < 200) return 'TOE';
        return 'CENTER';
    }
   
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
   
    getDegreeBucket(degree) {
        for (let i = 0; i < this.degreeBuckets.length; i++) {
            const [min, max] = this.degreeBuckets[i];
            if (degree >= min && degree <= max) {
                return `B${i}`;
            }
        }
        return 'B5';
    }
   
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
   
    compareGraphs(graph1, fingerprints1, graph2, fingerprints2) {
        console.log(`🔍 Сравниваю графы с УЧЕТОМ ГЕОМЕТРИИ...`);
       
        const sigToNodes1 = new Map();
        const sigToNodes2 = new Map();
       
        for (const [nodeId, fp] of fingerprints1) {
            if (!sigToNodes1.has(fp.signature)) {
                sigToNodes1.set(fp.signature, []);
            }
            sigToNodes1.get(fp.signature).push({
                nodeId,
                degree: fp.degree,
                degreeBucket: fp.degreeBucket,
                positionBucket: fp.positionBucket
            });
        }
       
        for (const [nodeId, fp] of fingerprints2) {
            if (!sigToNodes2.has(fp.signature)) {
                sigToNodes2.set(fp.signature, []);
            }
            sigToNodes2.get(fp.signature).push({
                nodeId,
                degree: fp.degree,
                degreeBucket: fp.degreeBucket,
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
                        positionBucket: nodes1[i].positionBucket,
                        type: 'exact'
                    });
                }
            }
        }
       
        const similarMatches = this.findSimilarNodesWithGeometry(fingerprints1, fingerprints2);
        const allMatches = [...exactMatches, ...similarMatches];
       
        const totalNodes1 = fingerprints1.size;
        const totalNodes2 = fingerprints2.size;
        const matchedNodes1 = new Set(allMatches.map(m => m.node1)).size;
        const matchedNodes2 = new Set(allMatches.map(m => m.node2)).size;
       
        const matchRatio1 = matchedNodes1 / Math.max(1, totalNodes1);
        const matchRatio2 = matchedNodes2 / Math.max(1, totalNodes2);
        const similarity = (matchRatio1 + matchRatio2) / 2;
       
        console.log(`📊 Результат УСИЛЕННОГО сравнения:`);
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
            matchRatio1,
            matchRatio2,
            matchedNodes1,
            matchedNodes2,
            totalNodes1,
            totalNodes2,
            method: 'enhanced_topological_with_geometry'
        };
    }
   
    findSimilarNodesWithGeometry(fingerprints1, fingerprints2) {
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
               
                // 🔥 ЖЕСТКИЙ ФИЛЬТР ПО ПОЗИЦИИ!
                if (fp1.positionBucket !== fp2.positionBucket) continue;
                if (fp1.degreeBucket !== fp2.degreeBucket) continue;
               
                const similarity = this.computeEnhancedSimilarity(fp1, fp2);
               
                if (similarity > bestSimilarity && similarity >= this.structuralSimilarityThreshold) {
                    bestSimilarity = similarity;
                    bestMatch = {
                        node1: nodeId1,
                        node2: nodeId2,
                        confidence: similarity,
                        degree: fp1.degree,
                        degreeBucket: fp1.degreeBucket,
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
   
    computeEnhancedSimilarity(fp1, fp2) {
        let similarity = 0;
        let totalWeight = 0;
       
        const degreeDiff = Math.abs(fp1.degree - fp2.degree);
        const degreeSim = 1.0 - (degreeDiff / Math.max(fp1.degree, fp2.degree, 1));
        similarity += degreeSim * 0.25;
        totalWeight += 0.25;
       
        if (fp1.degreeBucket === fp2.degreeBucket) {
            similarity += 0.15;
        }
        totalWeight += 0.15;
       
        const neighborDiff = Math.abs(fp1.neighborCount - fp2.neighborCount);
        const neighborSim = 1.0 - (neighborDiff / Math.max(fp1.neighborCount, fp2.neighborCount, 1));
        similarity += neighborSim * 0.15;
        totalWeight += 0.15;
       
        if (fp1.localStructure && fp2.localStructure) {
            const structureSim = this.computeLocalStructureSimilarity(
                fp1.localStructure,
                fp2.localStructure
            );
            similarity += structureSim * 0.30;
        }
        totalWeight += 0.30;
       
        if (fp1.positionBucket === fp2.positionBucket) {
            similarity += 0.15;
        }
        totalWeight += 0.15;
       
        return similarity / totalWeight;
    }
   
    computeLocalStructureSimilarity(struct1, struct2) {
        const terms1 = struct1.split('_');
        const terms2 = struct2.split('_');
       
        const set1 = new Set(terms1);
        const set2 = new Set(terms2);
       
        let matches = 0;
        for (const term of set1) {
            if (set2.has(term)) matches++;
        }
       
        const specialCases = ['BRG_YES', 'CLQ_YES', 'LEAF_YES', 'HUB_YES', 'TRI_YES'];
        for (const special of specialCases) {
            if (set1.has(special) && set2.has(special)) {
                matches += 2;
            }
        }
       
        return matches / Math.max(set1.size, set2.size);
    }
   
    // 🔥🔥🔥 ВОССТАНОВЛЕННЫЕ МЕТОДЫ!
   
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
                console.log(`      Подпись: ${match.signature?.substring(0, 20) || '...'}`);
                console.log(`      Позиция: ${match.positionBucket || '?'}`);
            });
        }
       
        if (similarMatches.length > 0) {
            console.log(`🔄 СТРУКТУРНО ПОХОЖИЕ (первые 3):`);
            similarMatches.slice(0, 3).forEach((match, idx) => {
                console.log(`   ${idx+1}. ${match.node1} ↔ ${match.node2}`);
                console.log(`      Уверенность: ${(match.confidence * 100).toFixed(1)}%`);
                console.log(`      Степень: ${match.degree} (${match.degreeBucket})`);
                console.log(`      Позиция: ${match.positionBucket}`);
            });
        }
    }
   
    visualizeMatches(comparisonResult, limit = 10) {
        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ СОВПАДЕНИЙ:`);
        console.log(`═`.repeat(80));
       
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
        console.log(`┌─────┬────────────────────┬──────────┬────────────────────┬──────────┬─────────┐`);
        console.log(`│  #  │       ФОТО2        │ ПОЗИЦИЯ  │      МОДЕЛЬ        │ ПОЗИЦИЯ  │ СОВПАД. │`);
        console.log(`├─────┼────────────────────┼──────────┼────────────────────┼──────────┼─────────┤`);
       
        allMatches.slice(0, limit).forEach((match, idx) => {
            const type = match.type === 'exact' ? '✅' : '🔄';
            const pos1 = match.positionBucket || '?';
            const pos2 = match.positionBucket || '?'; // для exact совпадает
            console.log(
                `│ ${(idx+1).toString().padEnd(3)} │ ${match.node1.substring(0, 18).padEnd(18)} │ ${pos1.padEnd(8)} │ ` +
                `${match.node2.substring(0, 18).padEnd(18)} │ ${pos2.padEnd(8)} │   ${type}   │`
            );
        });
       
        if (allMatches.length > limit) {
            console.log(`├─────┼────────────────────┼──────────┼────────────────────┼──────────┼─────────┤`);
            console.log(`│ ... │       ...          │   ...    │       ...          │   ...    │  ...    │`);
        }
       
        console.log(`└─────┴────────────────────┴──────────┴────────────────────┴──────────┴─────────┘`);
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
   
    // Для совместимости
    findSimilarNodes(fingerprints1, fingerprints2) {
        return this.findSimilarNodesWithGeometry(fingerprints1, fingerprints2);
    }
   
    computeStructuralSimilarity(fp1, fp2) {
        return this.computeEnhancedSimilarity(fp1, fp2);
    }
}

module.exports = TopologicalFingerprint;
