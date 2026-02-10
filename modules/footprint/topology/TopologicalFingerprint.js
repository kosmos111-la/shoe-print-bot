// modules/footprint/topology/TopologicalFingerprint.js
// 🎯 ЧИСТАЯ ТОПОЛОГИЯ - ТОЛЬКО СТРУКТУРА ГРАФА (БЕЗ КООРДИНАТ)

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
       
        console.log('🔷 ЧИСТЫЙ ТОПОЛОГИЧЕСКИЙ АЛГОРИТМ (без координат)');
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
                history: [initialSig]
            });
           
            if (this.debug && signatures.size <= 3) {
                console.log(`   Узел ${nodeId}:`);
                console.log(`     Степень: ${degree} (${this.getDegreeBucket(degree)})`);
                console.log(`     Соседи: ${neighbors.length}`);
                console.log(`     Локальная структура: ${structuralSignature.substring(0, 16)}...`);
            }
        }
       
        // 3. Итеративное уточнение (Weisfeiler-Lehman)
        for (let iter = 0; iter < this.iterations; iter++) {
            const newSignatures = new Map();
           
            for (const [nodeId, node] of nodes) {
                const neighbors = neighborMap.get(nodeId) || [];
               
                // Собираем подписи соседей
                const neighborSigs = [];
                for (const neighborId of neighbors) {
                    const neighborSig = signatures.get(neighborId)?.current || 'NO_SIG';
                    neighborSigs.push(neighborSig);
                }
               
                // 🔥 СОРТИРУЕМ для инвариантности
                neighborSigs.sort();
               
                // Комбинируем с текущей подписью
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
                    history: [...signatures.get(nodeId).history, newSig]
                });
            }
           
            // Обновляем подписи
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
            // 🔥 Используем последние 2 итерации для устойчивости
            const recentHistory = sig.history.slice(-2);
            const finalSig = this.hashString(recentHistory.join('::'));
           
            finalSignatures.set(nodeId, {
                signature: finalSig,
                degree: sig.degree,
                degreeBucket: sig.degreeBucket,
                neighborCount: sig.neighborCount,
                localStructure: sig.localStructure,
                historyLength: sig.history.length
            });
        }
       
        // Статистика
        const uniqueCount = new Set(Array.from(finalSignatures.values()).map(s => s.signature)).size;
        const bucketDistribution = this.calculateDistribution(finalSignatures);
       
        console.log(`✅ ЧИСТЫЕ ТОПОЛОГИЧЕСКИЕ подписи:`);
        console.log(`   Узлов: ${finalSignatures.size}`);
        console.log(`   Уникальных подписей: ${uniqueCount} (${(uniqueCount/finalSignatures.size*100).toFixed(1)}%)`);
        console.log(`   Распределение по степеням:`, bucketDistribution.degree);
       
        if (this.debug && finalSignatures.size > 0) {
            console.log(`\n📊 Примеры подписей (первые 3):`);
            let count = 0;
            for (const [nodeId, sig] of finalSignatures) {
                if (count++ >= 3) break;
                console.log(`   ${nodeId}: ${sig.signature.substring(0, 20)}...`);
                console.log(`     Степень: ${sig.degree} (${sig.degreeBucket})`);
            }
        }
       
        return finalSignatures;
    }
   
    // 🔥 МЕТОД 2: Построение карты соседей
    buildNeighborMap(nodes, edges) {
        const neighborMap = new Map();
       
        // Инициализируем для всех узлов
        for (const nodeId of nodes.keys()) {
            neighborMap.set(nodeId, []);
        }
       
        // Заполняем связи
        for (const edge of edges) {
            const [nodeA, nodeB] = edge.split('--');
           
            if (neighborMap.has(nodeA)) {
                neighborMap.get(nodeA).push(nodeB);
            }
            if (neighborMap.has(nodeB)) {
                neighborMap.get(nodeB).push(nodeA);
            }
        }
       
        // Сортируем для детерминированности
        for (const neighbors of neighborMap.values()) {
            neighbors.sort();
        }
       
        return neighborMap;
    }
   
    // 🔥 МЕТОД 3: Вычисление локальной структуры
    computeLocalStructure(nodeId, neighbors, neighborMap) {
        if (neighbors.length === 0) {
            return 'ISOLATED';
        }
       
        // 1. Собираем степени соседей
        const neighborDegrees = [];
        for (const neighborId of neighbors) {
            const neighborNeighbors = neighborMap.get(neighborId) || [];
            neighborDegrees.push(neighborNeighbors.length);
        }
       
        // 2. Сортируем степени
        neighborDegrees.sort((a, b) => a - b);
       
        // 3. Проверяем наличие треугольников (cliques)
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
       
        // 4. Проверяем, является ли узел мостом
        let isBridge = false;
        if (neighbors.length === 2) {
            // Узел с 2 соседями может быть мостом
            const [neighborA, neighborB] = neighbors;
            const neighborsOfA = neighborMap.get(neighborA) || [];
            const neighborsOfB = neighborMap.get(neighborB) || [];
           
            // Если соседи не связаны между собой напрямую
            if (!neighborsOfA.includes(neighborB) && !neighborsOfB.includes(neighborA)) {
                isBridge = true;
            }
        }
       
        // 5. Создаем структурную сигнатуру
        const avgNeighborDegree = neighborDegrees.reduce((a, b) => a + b, 0) / neighborDegrees.length;
        const structuralFeatures = [
            `DEG_${neighbors.length}`,
            `AVG_NDEG_${Math.round(avgNeighborDegree)}`,
            `TRI_${triangleCount}`,
            isBridge ? 'BRIDGE' : 'NOT_BRIDGE',
            `MAX_DEG_${Math.max(...neighborDegrees)}`,
            `MIN_DEG_${Math.min(...neighborDegrees)}`
        ];
       
        return structuralFeatures.join('_');
    }
   
    // 🔥 МЕТОД 4: Группировка степеней
    getDegreeBucket(degree) {
        for (let i = 0; i < this.degreeBuckets.length; i++) {
            const [min, max] = this.degreeBuckets[i];
            if (degree >= min && degree <= max) {
                return `BUCKET_${i}`;
            }
        }
        return 'BUCKET_OTHER';
    }
   
    // 🔥 МЕТОД 5: Сравнение графов
    compareGraphs(graph1, fingerprints1, graph2, fingerprints2) {
        console.log(`🔍 Сравниваю графы по ЧИСТОЙ ТОПОЛОГИИ...`);
 // 🔥 ИСПРАВЛЕНИЕ: Увеличиваем порог структурного сходства
    const structuralSimilarityThreshold = 0.8; // Было 0.7
      
        // 1. Создаем обратные мапы
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
                neighborCount: fp.neighborCount,
                from: 'graph1'
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
                neighborCount: fp.neighborCount,
                from: 'graph2'
            });
        }
       
        // 2. Находим точные совпадения
        const exactMatches = [];
        for (const [sig, nodes1] of sigToNodes1) {
            if (sigToNodes2.has(sig)) {
                const nodes2 = sigToNodes2.get(sig);
               
                // Сопоставляем узлы один к одному
                for (let i = 0; i < Math.min(nodes1.length, nodes2.length); i++) {
                    exactMatches.push({
                        node1: nodes1[i].nodeId,
                        node2: nodes2[i].nodeId,
                        signature: sig,
                        confidence: 1.0,
                        degree: nodes1[i].degree,
                        type: 'exact',
                        matchType: 'topological_identity'
                    });
                }
            }
        }
       
        // 3. Находим структурно похожие узлы
        const similarMatches = this.findSimilarNodes(
        fingerprints1,
        fingerprints2,
        structuralSimilarityThreshold // 🔥 Передаем порог
    );
       
        // 4. Объединяем совпадения
        const allMatches = [...exactMatches, ...similarMatches];
       
        // 5. Статистика
        const totalNodes1 = fingerprints1.size;
        const totalNodes2 = fingerprints2.size;
        const matchRatio1 = allMatches.length / Math.max(1, totalNodes1);
        const matchRatio2 = allMatches.length / Math.max(1, totalNodes2);
        const similarity = (matchRatio1 + matchRatio2) / 2;
       
        console.log(`📊 Результат ЧИСТОГО ТОПОЛОГИЧЕСКОГО сравнения:`);
        console.log(`   Узлов в графе 1: ${totalNodes1}`);
        console.log(`   Узлов в графе 2: ${totalNodes2}`);
        console.log(`   Точных совпадений: ${exactMatches.length}`);
        console.log(`   Структурно похожих: ${similarMatches.length}`);
        console.log(`   Всего совпадений: ${allMatches.length}`);
        console.log(`   Сходство: ${(similarity * 100).toFixed(1)}%`);
       
        // Детальная диагностика
        if (this.debug && allMatches.length > 0) {
            this.printMatchDetails(allMatches, exactMatches, similarMatches);
        }
       
        return {
            similarity: similarity,
            exactMatches: exactMatches,
            similarMatches: similarMatches,
            allMatches: allMatches,
            matchRatio1: matchRatio1,
            matchRatio2: matchRatio2,
            totalNodes1: totalNodes1,
            totalNodes2: totalNodes2,
            method: 'pure_topological_structure'
        };
    }
   
    // 🔥 МЕТОД 6: Поиск структурно похожих узлов
    findSimilarNodes(fingerprints1, fingerprints2, threshold = 0.8) {
    const similarMatches = [];
    const usedNodes2 = new Set(); // Чтобы не использовать один узел дважды
   
    // Преобразуем в массивы для сравнения
    const nodes1 = Array.from(fingerprints1.entries());
    const nodes2 = Array.from(fingerprints2.entries());
   
    // Для каждого узла из первого графа ищем похожий во втором
    for (const [nodeId1, fp1] of nodes1) {
        let bestMatch = null;
        let bestSimilarity = 0;
        let bestNodeId2 = null;
       
        for (const [nodeId2, fp2] of nodes2) {
            if (usedNodes2.has(nodeId2)) continue;
           
            // Вычисляем структурное сходство
            const similarity = this.computeStructuralSimilarity(fp1, fp2);
           
            if (similarity > bestSimilarity && similarity >= threshold) {
                bestSimilarity = similarity;
                bestMatch = {
                    node1: nodeId1,
                    node2: nodeId2,
                    signature1: fp1.signature,
                    signature2: fp2.signature,
                    confidence: similarity,
                    degree: fp1.degree,
                    type: 'similar',
                    matchType: 'structural_similarity'
                };
                bestNodeId2 = nodeId2;
            }
        }
       
        if (bestMatch) {
            similarMatches.push(bestMatch);
            usedNodes2.add(bestNodeId2); // Помечаем узел как использованный
        }
    }
   
    return similarMatches;
}
   
    // 🔥 МЕТОД 7: Вычисление структурного сходства
    computeStructuralSimilarity(fp1, fp2) {
        let similarity = 0;
       
        // 1. Сравнение степени (вес 40%)
        const degreeDiff = Math.abs(fp1.degree - fp2.degree);
        const degreeSim = 1.0 - (degreeDiff / Math.max(fp1.degree, fp2.degree, 1));
        similarity += degreeSim * 0.4;
       
        // 2. Сравнение группы степени (вес 30%)
        if (fp1.degreeBucket === fp2.degreeBucket) {
            similarity += 0.3;
        }
       
        // 3. Сравнение количества соседей (вес 20%)
        const neighborDiff = Math.abs(fp1.neighborCount - fp2.neighborCount);
        const neighborSim = 1.0 - (neighborDiff / Math.max(fp1.neighborCount, fp2.neighborCount, 1));
        similarity += neighborSim * 0.2;
       
        // 4. Сравнение локальной структуры (вес 10%)
        if (fp1.localStructure && fp2.localStructure) {
            const commonTerms = this.countCommonTerms(fp1.localStructure, fp2.localStructure);
            const maxTerms = Math.max(
                fp1.localStructure.split('_').length,
                fp2.localStructure.split('_').length
            );
            similarity += (commonTerms / maxTerms) * 0.1;
        }
       
        return similarity;
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    countCommonTerms(str1, str2) {
        const terms1 = new Set(str1.split('_'));
        const terms2 = new Set(str2.split('_'));
        let common = 0;
       
        for (const term of terms1) {
            if (terms2.has(term)) {
                common++;
            }
        }
       
        return common;
    }
   
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
                console.log(`      Степень: ${match.degree}`);
            });
        }
    }
   
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
}

module.exports = TopologicalFingerprint;
