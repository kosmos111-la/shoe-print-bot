// modules/footprint/topology/TopologicalFingerprint.js
// 🎯 ЧИСТАЯ ТОПОЛОГИЯ - НОРМАЛИЗОВАННОЕ СРАВНЕНИЕ (ВОЗВРАТ К РАБОЧЕЙ ВЕРСИИ)

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
       
        // 🔥 ПОРОГ ДЛЯ СТРУКТУРНОГО СХОДСТВА
        this.structuralSimilarityThreshold = options.structuralSimilarityThreshold || 0.7;
       
        console.log('🔷 ЧИСТЫЙ ТОПОЛОГИЧЕСКИЙ АЛГОРИТМ (нормализованное сравнение)');
        console.log(`   Порог структурного сходства: ${this.structuralSimilarityThreshold}`);
    }
   
    // 🔥 МЕТОД 1: Вычисление WL-подписей (ПОЛНАЯ ВЕРСИЯ ИЗ ПЕРВОГО БЭКАПА)
    computeGraphFingerprints(graph) {
        console.log(`🔷 Вычисляю ЧИСТЫЕ ТОПОЛОГИЧЕСКИЕ подписи (${graph.nodes.size} узлов)...`);
       
        const nodes = graph.nodes;
        const edges = graph.edges;
       
        // 1. Создаем карту соседей
        const neighborMap = this.buildNeighborMap(nodes, edges);
       
        // 2. Инициализируем подписи
        const signatures = new Map();
       
        for (const [nodeId, node] of nodes) {
            const neighbors = neighborMap.get(nodeId) || [];
            const degree = neighbors.length;
           
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
       
        // Статистика
        const uniqueCount = new Set(Array.from(finalSignatures.values()).map(s => s.signature)).size;
       
        console.log(`✅ ЧИСТЫЕ ТОПОЛОГИЧЕСКИЕ подписи:`);
        console.log(`   Узлов: ${finalSignatures.size}`);
        console.log(`   Уникальных подписей: ${uniqueCount} (${(uniqueCount/finalSignatures.size*100).toFixed(1)}%)`);
       
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
           
            if (neighborMap.has(nodeA)) {
                neighborMap.get(nodeA).push(nodeB);
            }
            if (neighborMap.has(nodeB)) {
                neighborMap.get(nodeB).push(nodeA);
            }
        }
       
        for (const neighbors of neighborMap.values()) {
            neighbors.sort();
        }
       
        return neighborMap;
    }
   
    // 🔥 МЕТОД 3: Вычисление локальной структуры (ПОЛНАЯ ВЕРСИЯ)
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
       
        neighborDegrees.sort((a, b) => a - b);
       
        // 2. Проверяем наличие треугольников
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
       
        // 3. Проверяем, является ли узел мостом
        let isBridge = false;
        if (neighbors.length === 2) {
            const [neighborA, neighborB] = neighbors;
            const neighborsOfA = neighborMap.get(neighborA) || [];
            const neighborsOfB = neighborMap.get(neighborB) || [];
           
            if (!neighborsOfA.includes(neighborB) && !neighborsOfB.includes(neighborA)) {
                isBridge = true;
            }
        }
       
        // 4. Проверяем, является ли узел частью клики
        let isCliqueMember = false;
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
            isCliqueMember = allConnected;
        }
       
        // 5. Проверяем лист и хаб
        const isLeaf = neighbors.length === 1;
        const isHub = neighbors.length >= 6;
       
        // 6. Вычисляем среднюю степень соседей
        const avgNeighborDegree = neighborDegrees.length > 0 ?
            Math.round(neighborDegrees.reduce((a, b) => a + b, 0) / neighborDegrees.length) : 0;
       
        // 7. Создаем структурную сигнатуру
        const structuralFeatures = [
            `DEG_${neighbors.length}`,
            `AVG_NDEG_${avgNeighborDegree}`,
            `TRI_${triangleCount}`,
            isBridge ? 'BRIDGE' : 'NO_BRIDGE',
            isCliqueMember ? 'CLIQUE' : 'NO_CLIQUE',
            isLeaf ? 'LEAF' : 'NO_LEAF',
            isHub ? 'HUB' : 'NO_HUB',
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
                return `B${i}`;
            }
        }
        return 'B_OTHER';
    }
   
    // 🔥 МЕТОД 5: Сравнение графов (НОРМАЛИЗОВАННОЕ)
    compareGraphs(graph1, fingerprints1, graph2, fingerprints2) {
        console.log(`🔍 Сравниваю графы по ЧИСТОЙ ТОПОЛОГИИ (нормализованное)...`);
       
        // 1. Создаем обратные мапы для точных совпадений
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
       
        // 2. Находим точные совпадения
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
                        degree: fingerprints1.get(nodes1[i]).degree,
                        type: 'exact'
                    });
                }
            }
        }
       
        // 3. Находим структурно похожие узлы (НОРМАЛИЗОВАННОЕ СРАВНЕНИЕ!)
        const similarMatches = [];
        const usedNodes2 = new Set(exactMatches.map(m => m.node2));
       
        const nodes1 = Array.from(fingerprints1.entries());
        const nodes2 = Array.from(fingerprints2.entries());
       
        for (const [nodeId1, fp1] of nodes1) {
            // Пропускаем уже найденные точные совпадения
            if (exactMatches.some(m => m.node1 === nodeId1)) continue;
           
            let bestMatch = null;
            let bestSimilarity = 0;
            let bestNodeId2 = null;
           
            for (const [nodeId2, fp2] of nodes2) {
                if (usedNodes2.has(nodeId2)) continue;
               
                // 🔥🔥🔥 НОРМАЛИЗОВАННОЕ СРАВНЕНИЕ!
                const similarity = this.computeNormalizedSimilarity(fp1, fp2);
               
                if (similarity > bestSimilarity && similarity >= this.structuralSimilarityThreshold) {
                    bestSimilarity = similarity;
                    bestMatch = {
                        node1: nodeId1,
                        node2: nodeId2,
                        signature1: fp1.signature,
                        signature2: fp2.signature,
                        confidence: similarity,
                        degree: fp1.degree,
                        degreeBucket: fp1.degreeBucket,
                        type: 'similar',
                        similarityScore: similarity
                    };
                    bestNodeId2 = nodeId2;
                }
            }
           
            if (bestMatch) {
                similarMatches.push(bestMatch);
                usedNodes2.add(bestNodeId2);
            }
        }
       
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
            method: 'normalized_topological'
        };
    }
   
    // 🔥🔥🔥 НОВЫЙ МЕТОД: НОРМАЛИЗОВАННОЕ СТРУКТУРНОЕ СХОДСТВО
    computeNormalizedSimilarity(fp1, fp2) {
        let similarity = 0;
        let totalWeight = 0;
       
        // 1. Степень узла (вес 0.3, нормализованная)
        const maxPossibleDegree = 30; // Максимальная степень в наших графах
        const degreeDiff = Math.abs(fp1.degree - fp2.degree);
        const degreeSim = 1.0 - Math.min(1.0, degreeDiff / maxPossibleDegree);
        similarity += degreeSim * 0.3;
        totalWeight += 0.3;
       
        // 2. Группа степени (вес 0.2)
        if (fp1.degreeBucket === fp2.degreeBucket) {
            similarity += 0.2;
        }
        totalWeight += 0.2;
       
        // 3. Количество соседей (вес 0.15, нормализованное)
        const maxNeighbors = 30;
        const neighborDiff = Math.abs(fp1.neighborCount - fp2.neighborCount);
        const neighborSim = 1.0 - Math.min(1.0, neighborDiff / maxNeighbors);
        similarity += neighborSim * 0.15;
        totalWeight += 0.15;
       
        // 4. Локальная структура (вес 0.35, нормализованная)
        if (fp1.localStructure && fp2.localStructure) {
            const terms1 = fp1.localStructure.split('_');
            const terms2 = fp2.localStructure.split('_');
           
            // Числовые признаки нормализуем
            const deg1 = this.extractNumericValue(terms1, 'DEG');
            const deg2 = this.extractNumericValue(terms2, 'DEG');
            const degSim = 1.0 - Math.min(1.0, Math.abs(deg1 - deg2) / 30);
           
            const avgDeg1 = this.extractNumericValue(terms1, 'AVG_NDEG');
            const avgDeg2 = this.extractNumericValue(terms2, 'AVG_NDEG');
            const avgDegSim = 1.0 - Math.min(1.0, Math.abs(avgDeg1 - avgDeg2) / 30);
           
            const tri1 = this.extractNumericValue(terms1, 'TRI');
            const tri2 = this.extractNumericValue(terms2, 'TRI');
            const triSim = 1.0 - Math.min(1.0, Math.abs(tri1 - tri2) / 20);
           
            const maxDeg1 = this.extractNumericValue(terms1, 'MAX_DEG');
            const maxDeg2 = this.extractNumericValue(terms2, 'MAX_DEG');
            const maxDegSim = 1.0 - Math.min(1.0, Math.abs(maxDeg1 - maxDeg2) / 30);
           
            const minDeg1 = this.extractNumericValue(terms1, 'MIN_DEG');
            const minDeg2 = this.extractNumericValue(terms2, 'MIN_DEG');
            const minDegSim = 1.0 - Math.min(1.0, Math.abs(minDeg1 - minDeg2) / 30);
           
            // Качественные признаки
            const set1 = new Set(terms1);
            const set2 = new Set(terms2);
           
            let qualMatches = 0;
            const qualFeatures = ['BRIDGE', 'CLIQUE', 'LEAF', 'HUB'];
            for (const feat of qualFeatures) {
                if (set1.has(feat) && set2.has(feat)) qualMatches += 2;
                else if (set1.has(feat) || set2.has(feat)) qualMatches += 0;
            }
           
            const qualSim = qualMatches / (qualFeatures.length * 2);
           
            // Среднее по всем признакам
            const structureSim = (degSim + avgDegSim + triSim + maxDegSim + minDegSim + qualSim) / 6;
            similarity += structureSim * 0.35;
        }
        totalWeight += 0.35;
       
        // Нормализуем результат
        return similarity / totalWeight;
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Извлечение числового значения из подписи
    extractNumericValue(terms, prefix) {
        for (const term of terms) {
            if (term.startsWith(prefix)) {
                const value = parseInt(term.split('_').pop());
                if (!isNaN(value)) return value;
            }
        }
        return 0;
    }
   
    // 🔥 МЕТОД 6: Вычисление структурного сходства (СТАРЫЙ, ДЛЯ СОВМЕСТИМОСТИ)
    computeStructuralSimilarity(fp1, fp2) {
        return this.computeNormalizedSimilarity(fp1, fp2);
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
   
    // 🔥 ИНФОРМАЦИЯ О ПОДПИСЯХ
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
