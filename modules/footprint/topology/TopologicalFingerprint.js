// modules/footprint/topology/TopologicalFingerprint.js
// 🎯 ЧИСТАЯ ТОПОЛОГИЯ - ИНВАРИАНТНАЯ WL-ПОДПИСЬ (БЕЗ УЧЁТА СТЕПЕНИ)

class TopologicalFingerprint {
    constructor(options = {}) {
        this.iterations = options.iterations || 3;
        this.debug = options.debug || false;
        this.hashCache = new Map();
       
        // 🔥 ПОРОГ ДЛЯ ПОХОЖИХ УЗЛОВ
        this.similarityThreshold = options.similarityThreshold || 0.7;
       
        console.log('🔷 ИНВАРИАНТНЫЙ WL-АЛГОРИТМ (без учёта степени)');
        console.log(`   Порог сходства: ${this.similarityThreshold}`);
    }

    // 🔥🔥🔥 ВЫЧИСЛЕНИЕ WL-ПОДПИСИ БЕЗ УЧЁТА СТЕПЕНИ!
    computeGraphFingerprints(graph) {
        console.log(`🔷 Вычисляю ИНВАРИАНТНЫЕ WL-подписи (${graph.nodes.size} узлов)...`);
       
        const nodes = graph.nodes;
        const edges = graph.edges;
       
        // 1. Создаем карту соседей
        const neighborMap = this.buildNeighborMap(nodes, edges);
       
        // 2. Инициализируем подписи на основе ЛОКАЛЬНОЙ СТРУКТУРЫ (без степени!)
        const signatures = new Map();
       
        for (const [nodeId, node] of nodes) {
            const neighbors = neighborMap.get(nodeId) || [];
           
            // 🔥🔥🔥 Игнорируем степень! Только качественная структура
            const structuralSignature = this.computeInvariantStructure(nodeId, neighbors, neighborMap);
           
            signatures.set(nodeId, {
                current: structuralSignature,
                degree: neighbors.length,
                neighborCount: neighbors.length,
                neighborIds: neighbors,
                history: [structuralSignature]
            });
        }
       
        // 3. Итеративное уточнение - только по существующим соседям
        for (let iter = 0; iter < this.iterations; iter++) {
            const newSignatures = new Map();
           
            for (const [nodeId, node] of nodes) {
                const neighbors = neighborMap.get(nodeId) || [];
               
                // Собираем подписи ТОЛЬКО существующих соседей
                const neighborSigs = [];
                for (const neighborId of neighbors) {
                    const neighborSig = signatures.get(neighborId)?.current || '';
                    if (neighborSig) neighborSigs.push(neighborSig);
                }
               
                // 🔥🔥🔥 СОРТИРУЕМ и ОБЪЕДИНЯЕМ без учёта количества!
                neighborSigs.sort();
                const currentSig = signatures.get(nodeId).current;
               
                // Создаём новую подпись из текущей + уникальные подписи соседей
                const uniqueNeighborSigs = [...new Set(neighborSigs)].join('|');
                const newSig = this.hashString(`${currentSig}|${uniqueNeighborSigs}`);
               
                newSignatures.set(nodeId, {
                    current: newSig,
                    degree: node.degree,
                    neighborCount: neighbors.length,
                    neighborIds: neighbors,
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
            finalSignatures.set(nodeId, {
                signature: sig.current,
                degree: sig.degree,
                neighborCount: sig.neighborCount,
                neighborIds: sig.neighborIds,
                historyLength: sig.history.length
            });
        }
       
        // Статистика
        const uniqueCount = new Set(Array.from(finalSignatures.values()).map(s => s.signature)).size;
       
        console.log(`✅ ИНВАРИАНТНЫЕ WL-подписи:`);
        console.log(`   Узлов: ${finalSignatures.size}`);
        console.log(`   Уникальных подписей: ${uniqueCount} (${(uniqueCount/finalSignatures.size*100).toFixed(1)}%)`);
       
        return finalSignatures;
    }

    // 🔥🔥🔥 ВЫЧИСЛЕНИЕ ИНВАРИАНТНОЙ СТРУКТУРЫ (БЕЗ ЧИСЛОВЫХ ЗНАЧЕНИЙ!)
    computeInvariantStructure(nodeId, neighbors, neighborMap) {
        if (neighbors.length === 0) {
            return 'ISOLATED';
        }
       
        const features = [];
       
        // 1. Является ли листом? (качественный признак)
        features.push(neighbors.length === 1 ? 'LEAF' : 'NOT_LEAF');
       
        // 2. Является ли мостом? (качественный признак)
        if (neighbors.length === 2) {
            const [neighborA, neighborB] = neighbors;
            const neighborsOfA = neighborMap.get(neighborA) || [];
            const neighborsOfB = neighborMap.get(neighborB) || [];
           
            if (!neighborsOfA.includes(neighborB) && !neighborsOfB.includes(neighborA)) {
                features.push('BRIDGE');
            } else {
                features.push('NOT_BRIDGE');
            }
        } else {
            features.push('NOT_BRIDGE');
        }
       
        // 3. Является ли хабом? (качественный признак)
        features.push(neighbors.length >= 6 ? 'HUB' : 'NOT_HUB');
       
        // 4. Есть ли треугольники? (качественный признак)
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
        features.push(hasTriangles ? 'HAS_TRIANGLES' : 'NO_TRIANGLES');
       
        // 5. Является ли частью клики? (качественный признак)
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
            features.push(allConnected ? 'CLIQUE' : 'NOT_CLIQUE');
        } else {
            features.push('NOT_CLIQUE');
        }
       
        // 6. Типы соседей (качественные категории)
        let leafNeighbors = 0;
        let hubNeighbors = 0;
        let bridgeNeighbors = 0;
       
        for (const neighborId of neighbors) {
            const neighborNeighbors = neighborMap.get(neighborId) || [];
           
            if (neighborNeighbors.length === 1) leafNeighbors++;
            if (neighborNeighbors.length >= 6) hubNeighbors++;
           
            if (neighborNeighbors.length === 2) {
                const [n1, n2] = neighborNeighbors;
                const neighborsOfN1 = neighborMap.get(n1) || [];
                const neighborsOfN2 = neighborMap.get(n2) || [];
                if (!neighborsOfN1.includes(n2) && !neighborsOfN2.includes(n1)) {
                    bridgeNeighbors++;
                }
            }
        }
       
        // 🔥🔥🔥 Добавляем ТОЛЬКО качественные признаки (есть/нет), не количества!
        features.push(leafNeighbors > 0 ? 'HAS_LEAF_NEIGHBORS' : 'NO_LEAF_NEIGHBORS');
        features.push(hubNeighbors > 0 ? 'HAS_HUB_NEIGHBORS' : 'NO_HUB_NEIGHBORS');
        features.push(bridgeNeighbors > 0 ? 'HAS_BRIDGE_NEIGHBORS' : 'NO_BRIDGE_NEIGHBORS');
       
        return features.join('_');
    }

    // 🔥🔥🔥 СРАВНЕНИЕ ГРАФОВ С УЧЁТОМ ОТСУТСТВУЮЩИХ ТОЧЕК
    compareGraphs(graph1, fingerprints1, graph2, fingerprints2) {
        console.log(`🔍 Сравниваю графы по ИНВАРИАНТНЫМ WL-подписям...`);
       
        const exactMatches = [];
        const similarMatches = [];
        const usedNodes2 = new Set();
       
        // 1. Сначала ищем ТОЧНЫЕ совпадения подписей
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
                    usedNodes2.add(nodes2[i]);
                }
            }
        }
       
        // 2. Затем ищем ПОХОЖИЕ (для отсутствующих/изменённых точек)
        for (const [nodeId1, fp1] of fingerprints1) {
            // Пропускаем уже найденные точные совпадения
            if (exactMatches.some(m => m.node1 === nodeId1)) continue;
           
            let bestMatch = null;
            let bestSimilarity = 0;
            let bestNodeId2 = null;
           
            for (const [nodeId2, fp2] of fingerprints2) {
                if (usedNodes2.has(nodeId2)) continue;
               
                // 🔥🔥🔥 ВЫЧИСЛЯЕМ СХОДСТВО НА ОСНОВЕ ОБЩИХ СОСЕДЕЙ!
                const similarity = this.computeInvariantSimilarity(
                    fp1, fp2,
                    graph1, graph2,
                    nodeId1, nodeId2
                );
               
                if (similarity > bestSimilarity && similarity >= this.similarityThreshold) {
                    bestSimilarity = similarity;
                    bestMatch = {
                        node1: nodeId1,
                        node2: nodeId2,
                        signature1: fp1.signature,
                        signature2: fp2.signature,
                        confidence: similarity,
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
       
        console.log(`📊 Результат ИНВАРИАНТНОГО сравнения:`);
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
            method: 'invariant_wl'
        };
    }

    // 🔥🔥🔥 ВЫЧИСЛЕНИЕ СХОДСТВА НА ОСНОВЕ ОБЩИХ СОСЕДЕЙ
    computeInvariantSimilarity(fp1, fp2, graph1, graph2, nodeId1, nodeId2) {
        // 1. Получаем соседей в обоих графах
        const neighbors1 = fp1.neighborIds || [];
        const neighbors2 = fp2.neighborIds || [];
       
        // 2. Находим общих соседей по ID (это уже смаппленные точки!)
        const commonNeighbors = neighbors1.filter(n1 =>
            neighbors2.includes(n1)  // В реальности тут нужен маппинг, но упрощаем
        );
       
        // 3. Сходство на основе ОБЩИХ соседей
        const neighborSimilarity = commonNeighbors.length /
            Math.max(1, Math.max(neighbors1.length, neighbors2.length));
       
        // 4. Сравнение качественных признаков
        const struct1 = fp1.signature.split('_');
        const struct2 = fp2.signature.split('_');
       
        let commonFeatures = 0;
        const set1 = new Set(struct1);
        const set2 = new Set(struct2);
       
        for (const feat of set1) {
            if (set2.has(feat)) commonFeatures++;
        }
       
        const featureSimilarity = commonFeatures / Math.max(set1.size, set2.size);
       
        // 5. Общее сходство
        return neighborSimilarity * 0.6 + featureSimilarity * 0.4;
    }

    // 🔥 ПОСТРОЕНИЕ КАРТЫ СОСЕДЕЙ
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
