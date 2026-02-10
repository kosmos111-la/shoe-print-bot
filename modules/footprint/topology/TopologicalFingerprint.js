// modules/footprint/topology/TopologicalFingerprint.js
// 🎯 ИНВАРИАНТНЫЕ ПОДПИСИ УЗЛОВ (WEISFEILER-LEHMAN)

class TopologicalFingerprint {
    constructor(options = {}) {
        this.iterations = options.iterations || 3;
        this.debug = options.debug || false;
        this.hashCache = new Map(); // Кэш для производительности
       
        console.log('🔷 TopologicalFingerprint создан (Weisfeiler-Lehman)');
    }
   
    // Основной метод: вычисляем подписи для всех узлов графа
    computeGraphFingerprints(graph) {
        console.log(`🔷 Вычисляю WL-подписи для графа (${graph.nodes.size} узлов, ${this.iterations} итераций)...`);
       
        const nodes = graph.nodes;
        const edges = graph.edges;
       
        // 1. Инициализируем подписи (начальные метки)
        const signatures = new Map();
        for (const [nodeId, node] of nodes) {
            // Начальная подпись = степень узла
            const initialSig = this.hashString(`DEGREE_${node.degree}`);
            signatures.set(nodeId, {
                current: initialSig,
                previous: null,
                degree: node.degree,
                history: [initialSig]
            });
           
            if (this.debug && signatures.size <= 5) {
                console.log(`   Начальная подпись ${nodeId}: ${initialSig} (степень: ${node.degree})`);
            }
        }
       
        // 2. Итерации Weisfeiler-Lehman
        for (let iter = 0; iter < this.iterations; iter++) {
            const newSignatures = new Map();
           
            for (const [nodeId, node] of nodes) {
                // Собираем подписи соседей
                const neighborSigs = [];
               
                // Находим всех соседей через рёбра
                for (const edge of edges) {
                    const [nodeA, nodeB] = edge.split('--');
                    if (nodeA === nodeId) {
                        const neighborSig = signatures.get(nodeB)?.current || '';
                        neighborSigs.push(neighborSig);
                    } else if (nodeB === nodeId) {
                        const neighborSig = signatures.get(nodeA)?.current || '';
                        neighborSigs.push(neighborSig);
                    }
                }
               
                // Сортируем для инвариантности к порядку
                neighborSigs.sort();
               
                // Создаем новую подпись: текущая + соседи
                const currentSig = signatures.get(nodeId).current;
                const neighborSigStr = neighborSigs.length > 0 ?
                    neighborSigs.join(',') : 'NO_NEIGHBORS';
               
                const newSig = this.hashString(`${currentSig}|${neighborSigStr}`);
               
                newSignatures.set(nodeId, {
                    current: newSig,
                    previous: currentSig,
                    degree: node.degree,
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
       
        // 3. Финальные подписи (комбинируем всю историю)
        const finalSignatures = new Map();
        for (const [nodeId, sig] of signatures) {
            const finalSig = this.hashString(sig.history.join('::'));
            finalSignatures.set(nodeId, {
                signature: finalSig,
                degree: sig.degree,
                history: sig.history,
                historyLength: sig.history.length
            });
        }
       
        // Статистика
        const uniqueCount = new Set(Array.from(finalSignatures.values()).map(s => s.signature)).size;
        console.log(`✅ WL-подписи вычислены: ${finalSignatures.size} узлов, ${uniqueCount} уникальных подписей`);
       
        if (this.debug && finalSignatures.size > 0) {
            console.log(`\n📊 Примеры подписей (первые 5):`);
            let count = 0;
            for (const [nodeId, sig] of finalSignatures) {
                if (count++ >= 5) break;
                console.log(`   ${nodeId}: ${sig.signature.substring(0, 20)}... (степень: ${sig.degree})`);
            }
        }
       
        return finalSignatures;
    }
   
    // Сравнение двух графов по подписям
    compareGraphs(graph1, fingerprints1, graph2, fingerprints2) {
        console.log(`🔍 Сравниваю графы по WL-подписям...`);
       
        // Создаем обратные мапы: подпись → [узлы с этой подписью]
        const sigToNodes1 = new Map();
        const sigToNodes2 = new Map();
       
        for (const [nodeId, fp] of fingerprints1) {
            if (!sigToNodes1.has(fp.signature)) {
                sigToNodes1.set(fp.signature, []);
            }
            sigToNodes1.get(fp.signature).push({
                nodeId,
                degree: fp.degree,
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
                from: 'graph2'
            });
        }
       
        // Находим общие подписи
        const commonSignatures = new Set();
        for (const sig of sigToNodes1.keys()) {
            if (sigToNodes2.has(sig)) {
                commonSignatures.add(sig);
            }
        }
       
        // Находим точные совпадения (узлы с одинаковыми подписями)
        const exactMatches = [];
        for (const sig of commonSignatures) {
            const nodes1 = sigToNodes1.get(sig);
            const nodes2 = sigToNodes2.get(sig);
           
            // Сопоставляем узлы (просто берем первые из каждого списка)
            for (let i = 0; i < Math.min(nodes1.length, nodes2.length); i++) {
                exactMatches.push({
                    node1: nodes1[i].nodeId,
                    node2: nodes2[i].nodeId,
                    signature: sig,
                    confidence: 1.0,
                    degree: nodes1[i].degree
                });
            }
        }
       
        // Статистика
        const totalNodes1 = fingerprints1.size;
        const totalNodes2 = fingerprints2.size;
        const matchRatio1 = exactMatches.length / Math.max(1, totalNodes1);
        const matchRatio2 = exactMatches.length / Math.max(1, totalNodes2);
        const similarity = (matchRatio1 + matchRatio2) / 2;
       
        console.log(`📊 Результат сравнения WL-подписей:`);
        console.log(`   Узлов в графе 1: ${totalNodes1}`);
        console.log(`   Узлов в графе 2: ${totalNodes2}`);
        console.log(`   Общих подписей: ${commonSignatures.size}`);
        console.log(`   Точных совпадений: ${exactMatches.length}`);
        console.log(`   Сходство графа1→граф2: ${(matchRatio1 * 100).toFixed(1)}%`);
        console.log(`   Сходство графа2→граф1: ${(matchRatio2 * 100).toFixed(1)}%`);
        console.log(`   Среднее сходство: ${(similarity * 100).toFixed(1)}%`);
       
        return {
            similarity: similarity,
            exactMatches: exactMatches,
            matchRatio1: matchRatio1,
            matchRatio2: matchRatio2,
            totalNodes1: totalNodes1,
            totalNodes2: totalNodes2,
            commonSignatures: commonSignatures.size,
            method: 'weisfeiler-lehman'
        };
    }
   
    // Простая хеш-функция (можно заменить на более продвинутую)
    hashString(str) {
        if (this.hashCache.has(str)) {
            return this.hashCache.get(str);
        }
       
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Преобразуем в 32-битное целое
        }
       
        // Преобразуем в шестнадцатеричную строку
        const result = Math.abs(hash).toString(16).padStart(8, '0');
        this.hashCache.set(str, result);
       
        return result;
    }
   
    // Получить информацию о подписях графа
    getFingerprintInfo(fingerprints) {
        const degrees = Array.from(fingerprints.values()).map(fp => fp.degree);
        const signatures = Array.from(fingerprints.values()).map(fp => fp.signature);
       
        const uniqueSignatures = new Set(signatures);
        const degreeDistribution = {};
       
        degrees.forEach(deg => {
            degreeDistribution[deg] = (degreeDistribution[deg] || 0) + 1;
        });
       
        return {
            totalNodes: fingerprints.size,
            uniqueSignatures: uniqueSignatures.size,
            uniquenessRatio: uniqueSignatures.size / Math.max(1, fingerprints.size),
            avgDegree: degrees.reduce((a, b) => a + b, 0) / degrees.length,
            degreeDistribution: degreeDistribution,
            maxDegree: Math.max(...degrees),
            minDegree: Math.min(...degrees)
        };
    }
   
    // Визуализация совпадений
    visualizeMatches(comparisonResult, limit = 10) {
        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ СОВПАДЕНИЙ:`);
        console.log(`═`.repeat(60));
       
        const { exactMatches, similarity, totalNodes1, totalNodes2 } = comparisonResult;
       
        console.log(`🎯 СХОДСТВО: ${(similarity * 100).toFixed(1)}%`);
        console.log(`📊 СТАТИСТИКА:`);
        console.log(`   Совпадений: ${exactMatches.length} / макс(${totalNodes1}, ${totalNodes2})`);
        console.log(`   Покрытие графа 1: ${((exactMatches.length / totalNodes1) * 100).toFixed(1)}%`);
        console.log(`   Покрытие графа 2: ${((exactMatches.length / totalNodes2) * 100).toFixed(1)}%`);
       
        console.log(`\n🔗 ТОЧНЫЕ СОВПАДЕНИЯ (первые ${Math.min(limit, exactMatches.length)}):`);
        exactMatches.slice(0, limit).forEach((match, idx) => {
            console.log(`   ${idx + 1}. ${match.node1} ↔ ${match.node2}`);
            console.log(`      Подпись: ${match.signature.substring(0, 24)}...`);
            console.log(`      Степень: ${match.degree}`);
        });
       
        if (exactMatches.length > limit) {
            console.log(`\n... и еще ${exactMatches.length - limit} совпадений`);
        }
       
        console.log(`═`.repeat(60));
    }
}

module.exports = TopologicalFingerprint;
