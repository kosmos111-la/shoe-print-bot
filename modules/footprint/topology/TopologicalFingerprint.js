// modules/footprint/topology/TopologicalFingerprint.js
// 🎯 ИНВАРИАНТНЫЕ ПОДПИСИ УЗЛОВ (ИСПРАВЛЕННАЯ ВЕРСИЯ)

class TopologicalFingerprint {
    constructor(options = {}) {
        this.iterations = options.iterations || 3;
        this.debug = options.debug || false;
        this.hashCache = new Map();
       
        // 🔥 НОВЫЕ ПАРАМЕТРЫ ДЛЯ УСТОЙЧИВОСТИ
        this.bucketSize = options.bucketSize || 3; // Группировка степеней
        this.similarityThreshold = options.similarityThreshold || 0.8; // Порог схожести
       
        console.log('🔷 TopologicalFingerprint создан (устойчивый Weisfeiler-Lehman)');
    }
   
    // 🔥 ИСПРАВЛЕНИЕ 1: Группировка степеней узлов
    getDegreeBucket(degree) {
        // Группируем степени узлов в корзины
        if (degree <= 2) return 'low';
        if (degree <= 4) return 'medium';
        if (degree <= 6) return 'high';
        return 'very_high';
    }
   
    // 🔥 ИСПРАВЛЕНИЕ 2: Нормализация координат относительно центра
    normalizeCoordinates(nodes) {
        const nodeArray = Array.from(nodes.values());
       
        // Находим центр масс
        const centerX = nodeArray.reduce((sum, node) => sum + node.x, 0) / nodeArray.length;
        const centerY = nodeArray.reduce((sum, node) => sum + node.y, 0) / nodeArray.length;
       
        // Находим максимальное расстояние от центра
        const maxDist = Math.max(
            ...nodeArray.map(node => Math.sqrt(
                Math.pow(node.x - centerX, 2) + Math.pow(node.y - centerY, 2)
            ))
        );
       
        // Нормализуем координаты
        const normalizedNodes = new Map();
       
        for (const [nodeId, node] of nodes) {
            const normX = maxDist > 0 ? (node.x - centerX) / maxDist : 0;
            const normY = maxDist > 0 ? (node.y - centerY) / maxDist : 0;
           
            // Квантуем координаты (группируем близкие значения)
            const quantizedX = Math.round(normX * 10) / 10;
            const quantizedY = Math.round(normY * 10) / 10;
           
            normalizedNodes.set(nodeId, {
                ...node,
                normX: quantizedX,
                normY: quantizedY,
                sector: this.getPositionSector(quantizedX, quantizedY)
            });
        }
       
        return normalizedNodes;
    }
   
    // 🔥 НОВЫЙ МЕТОД: Определение сектора положения
    getPositionSector(x, y) {
        if (x === 0 && y === 0) return 'center';
       
        const angle = Math.atan2(y, x) * (180 / Math.PI);
        const normalizedAngle = (angle + 360) % 360;
       
        if (normalizedAngle < 45) return 'right';
        if (normalizedAngle < 90) return 'top_right';
        if (normalizedAngle < 135) return 'top';
        if (normalizedAngle < 180) return 'top_left';
        if (normalizedAngle < 225) return 'left';
        if (normalizedAngle < 270) return 'bottom_left';
        if (normalizedAngle < 315) return 'bottom';
        return 'bottom_right';
    }
   
    // 🔥 ИСПРАВЛЕНИЕ 3: Основной метод с устойчивыми подписями
    computeGraphFingerprints(graph) {
        console.log(`🔷 Вычисляю УСТОЙЧИВЫЕ WL-подписи для графа (${graph.nodes.size} узлов)...`);
       
        const nodes = graph.nodes;
        const edges = graph.edges;
       
        // Нормализуем координаты
        const normalizedNodes = this.normalizeCoordinates(nodes);
       
        // 1. Инициализируем подписи (группированные степени + позиция)
        const signatures = new Map();
       
        for (const [nodeId, node] of normalizedNodes) {
            const degreeBucket = this.getDegreeBucket(node.degree);
            const positionSector = node.sector;
           
            // 🔥 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Используем группированные характеристики
            const initialSig = this.hashString(`DEG_${degreeBucket}_POS_${positionSector}`);
           
            signatures.set(nodeId, {
                current: initialSig,
                previous: null,
                degree: node.degree,
                degreeBucket: degreeBucket,
                positionSector: positionSector,
                history: [initialSig]
            });
           
            if (this.debug && signatures.size <= 3) {
                console.log(`   Начальная подпись ${nodeId}:`);
                console.log(`     Степень: ${node.degree} -> ${degreeBucket}`);
                console.log(`     Позиция: (${node.normX.toFixed(2)}, ${node.normY.toFixed(2)}) -> ${positionSector}`);
                console.log(`     Подпись: ${initialSig}`);
            }
        }
       
        // 2. Итерации Weisfeiler-Lehman с группировкой соседей
        for (let iter = 0; iter < this.iterations; iter++) {
            const newSignatures = new Map();
           
            for (const [nodeId, node] of normalizedNodes) {
                // Собираем БУКЕТЫ подписей соседей (группируем одинаковые)
                const neighborBuckets = new Map();
               
                // Находим всех соседей
                for (const edge of edges) {
                    const [nodeA, nodeB] = edge.split('--');
                   
                    if (nodeA === nodeId) {
                        const neighborSig = signatures.get(nodeB)?.current || '';
                        neighborBuckets.set(neighborSig, (neighborBuckets.get(neighborSig) || 0) + 1);
                    } else if (nodeB === nodeId) {
                        const neighborSig = signatures.get(nodeA)?.current || '';
                        neighborBuckets.set(neighborSig, (neighborBuckets.get(neighborSig) || 0) + 1);
                    }
                }
               
                // 🔥 СОРТИРУЕМ по частоте встречаемости, затем по подписи
                const sortedNeighbors = Array.from(neighborBuckets.entries())
                    .sort((a, b) => {
                        // Сначала по частоте (убывание)
                        if (b[1] !== a[1]) return b[1] - a[1];
                        // Затем по подписи
                        return a[0].localeCompare(b[0]);
                    })
                    .map(([sig, count]) => `${sig}:${count}`);
               
                // Создаем новую подпись
                const currentSig = signatures.get(nodeId).current;
                const neighborSigStr = sortedNeighbors.length > 0 ?
                    sortedNeighbors.join(',') : 'NO_NEIGHBORS';
               
                const newSig = this.hashString(`${currentSig}|${neighborSigStr}`);
               
                newSignatures.set(nodeId, {
                    current: newSig,
                    previous: currentSig,
                    degree: node.degree,
                    degreeBucket: signatures.get(nodeId).degreeBucket,
                    positionSector: signatures.get(nodeId).positionSector,
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
            // 🔥 ИСПРАВЛЕНИЕ: Используем только последние 2 итерации для устойчивости
            const recentHistory = sig.history.slice(-2);
            const finalSig = this.hashString(recentHistory.join('::'));
           
            finalSignatures.set(nodeId, {
                signature: finalSig,
                degree: sig.degree,
                degreeBucket: sig.degreeBucket,
                positionSector: sig.positionSector,
                history: sig.history,
                historyLength: sig.history.length
            });
        }
       
        // Статистика
        const uniqueCount = new Set(Array.from(finalSignatures.values()).map(s => s.signature)).size;
        const bucketDistribution = this.calculateBucketDistribution(finalSignatures);
       
        console.log(`✅ УСТОЙЧИВЫЕ WL-подписи вычислены:`);
        console.log(`   Узлов: ${finalSignatures.size}`);
        console.log(`   Уникальных подписей: ${uniqueCount} (${(uniqueCount/finalSignatures.size*100).toFixed(1)}%)`);
        console.log(`   Распределение по секторам:`, bucketDistribution.position);
        console.log(`   Распределение по степеням:`, bucketDistribution.degree);
       
        if (this.debug && finalSignatures.size > 0) {
            console.log(`\n📊 Примеры подписей (первые 3):`);
            let count = 0;
            for (const [nodeId, sig] of finalSignatures) {
                if (count++ >= 3) break;
                console.log(`   ${nodeId}:`);
                console.log(`     Степень: ${sig.degree} (${sig.degreeBucket})`);
                console.log(`     Сектор: ${sig.positionSector}`);
                console.log(`     Подпись: ${sig.signature.substring(0, 16)}...`);
            }
        }
       
        return finalSignatures;
    }
   
    // 🔥 НОВЫЙ МЕТОД: Распределение по корзинам
    calculateBucketDistribution(fingerprints) {
        const positionDist = {};
        const degreeDist = {};
       
        for (const fp of fingerprints.values()) {
            positionDist[fp.positionSector] = (positionDist[fp.positionSector] || 0) + 1;
            degreeDist[fp.degreeBucket] = (degreeDist[fp.degreeBucket] || 0) + 1;
        }
       
        return { position: positionDist, degree: degreeDist };
    }
   
    // 🔥 ИСПРАВЛЕНИЕ 4: Сравнение с допусками на схожесть
    compareGraphs(graph1, fingerprints1, graph2, fingerprints2) {
        console.log(`🔍 Сравниваю графы по УСТОЙЧИВЫМ WL-подписям...`);
       
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
                degreeBucket: fp.degreeBucket,
                positionSector: fp.positionSector,
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
                positionSector: fp.positionSector,
                from: 'graph2'
            });
        }
       
        // 🔥 ИСПРАВЛЕНИЕ: Находим ОЧЕНЬ ПОХОЖИЕ подписи (первые 12 символов)
        const similarSignatures = new Map();
       
        for (const [sig1, nodes1] of sigToNodes1) {
            for (const [sig2, nodes2] of sigToNodes2) {
                // Сравниваем первые 12 символов подписи
                const sig1Prefix = sig1.substring(0, 12);
                const sig2Prefix = sig2.substring(0, 12);
               
                if (sig1Prefix === sig2Prefix) {
                    const similarityKey = `${sig1Prefix}_similar`;
                    if (!similarSignatures.has(similarityKey)) {
                        similarSignatures.set(similarityKey, []);
                    }
                   
                    // Добавляем все возможные пары узлов
                    for (const node1 of nodes1) {
                        for (const node2 of nodes2) {
                            // Проверяем, что узлы в похожих позициях
                            if (node1.positionSector === node2.positionSector &&
                                node1.degreeBucket === node2.degreeBucket) {
                               
                                // Вычисляем степень схожести
                                const degreeDiff = Math.abs(node1.degree - node2.degree);
                                const similarityScore = 1.0 - (degreeDiff / Math.max(node1.degree, node2.degree));
                               
                                if (similarityScore >= this.similarityThreshold) {
                                    similarSignatures.get(similarityKey).push({
                                        node1: node1.nodeId,
                                        node2: node2.nodeId,
                                        signature1: sig1,
                                        signature2: sig2,
                                        similarity: similarityScore,
                                        degree: node1.degree,
                                        position: node1.positionSector
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
       
        // Находим точные совпадения
        const exactMatches = [];
        for (const sig of sigToNodes1.keys()) {
            if (sigToNodes2.has(sig)) {
                const nodes1 = sigToNodes1.get(sig);
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
       
        // Находим похожие совпадения
        const similarMatches = [];
        for (const [key, matches] of similarSignatures) {
            // Берем лучшую пару для каждого префикса
            if (matches.length > 0) {
                const bestMatch = matches.reduce((best, current) =>
                    current.similarity > best.similarity ? current : best
                );
               
                similarMatches.push({
                    node1: bestMatch.node1,
                    node2: bestMatch.node2,
                    signature1: bestMatch.signature1,
                    signature2: bestMatch.signature2,
                    confidence: bestMatch.similarity,
                    degree: bestMatch.degree,
                    position: bestMatch.position,
                    type: 'similar'
                });
            }
        }
       
        // Объединяем все совпадения
        const allMatches = [...exactMatches, ...similarMatches];
       
        // Статистика
        const totalNodes1 = fingerprints1.size;
        const totalNodes2 = fingerprints2.size;
        const matchRatio1 = allMatches.length / Math.max(1, totalNodes1);
        const matchRatio2 = allMatches.length / Math.max(1, totalNodes2);
        const similarity = (matchRatio1 + matchRatio2) / 2;
       
        console.log(`📊 Результат сравнения УСТОЙЧИВЫХ WL-подписей:`);
        console.log(`   Узлов в графе 1: ${totalNodes1}`);
        console.log(`   Узлов в графе 2: ${totalNodes2}`);
        console.log(`   Точных совпадений: ${exactMatches.length}`);
        console.log(`   Похожих совпадений: ${similarMatches.length}`);
        console.log(`   Всего совпадений: ${allMatches.length}`);
        console.log(`   Сходство графа1→граф2: ${(matchRatio1 * 100).toFixed(1)}%`);
        console.log(`   Сходство графа2→граф1: ${(matchRatio2 * 100).toFixed(1)}%`);
        console.log(`   Среднее сходство: ${(similarity * 100).toFixed(1)}%`);
       
        // 🔥 ДИАГНОСТИКА: Показываем примеры совпадений
        if (allMatches.length > 0 && this.debug) {
            console.log(`\n🔍 Примеры совпадений:`);
            allMatches.slice(0, 5).forEach((match, idx) => {
                console.log(`   ${idx+1}. ${match.node1} ↔ ${match.node2}`);
                console.log(`      Тип: ${match.type}, Уверенность: ${(match.confidence * 100).toFixed(1)}%`);
                console.log(`      Степень: ${match.degree}, Позиция: ${match.position || 'N/A'}`);
            });
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
            exactCount: exactMatches.length,
            similarCount: similarMatches.length,
            method: 'stable_weisfeiler-lehman'
        };
    }
   
    // Простая хеш-функция
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
       
        const result = Math.abs(hash).toString(16).padStart(12, '0'); // 🔥 Увеличили длину
        this.hashCache.set(str, result);
       
        return result;
    }
   
    // Получить информацию о подписях графа
    getFingerprintInfo(fingerprints) {
        const degrees = Array.from(fingerprints.values()).map(fp => fp.degree);
        const signatures = Array.from(fingerprints.values()).map(fp => fp.signature);
       
        const uniqueSignatures = new Set(signatures);
        const degreeDistribution = {};
        const bucketDistribution = this.calculateBucketDistribution(fingerprints);
       
        degrees.forEach(deg => {
            degreeDistribution[deg] = (degreeDistribution[deg] || 0) + 1;
        });
       
        return {
            totalNodes: fingerprints.size,
            uniqueSignatures: uniqueSignatures.size,
            uniquenessRatio: uniqueSignatures.size / Math.max(1, fingerprints.size),
            avgDegree: degrees.reduce((a, b) => a + b, 0) / degrees.length,
            degreeDistribution: degreeDistribution,
            positionDistribution: bucketDistribution.position,
            degreeBucketDistribution: bucketDistribution.degree,
            maxDegree: Math.max(...degrees),
            minDegree: Math.min(...degrees)
        };
    }
   
    // Визуализация совпадений
    visualizeMatches(comparisonResult, limit = 10) {
        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ СОВПАДЕНИЙ:`);
        console.log(`═`.repeat(60));
       
        const { allMatches, similarity, totalNodes1, totalNodes2, exactCount, similarCount } = comparisonResult;
       
        console.log(`🎯 СХОДСТВО: ${(similarity * 100).toFixed(1)}%`);
        console.log(`📊 СТАТИСТИКА:`);
        console.log(`   Точных совпадений: ${exactCount}`);
        console.log(`   Похожих совпадений: ${similarCount}`);
        console.log(`   Всего совпадений: ${allMatches.length} / макс(${totalNodes1}, ${totalNodes2})`);
        console.log(`   Покрытие графа 1: ${((allMatches.length / totalNodes1) * 100).toFixed(1)}%`);
        console.log(`   Покрытие графа 2: ${((allMatches.length / totalNodes2) * 100).toFixed(1)}%`);
       
        console.log(`\n🔗 СОВПАДЕНИЯ (первые ${Math.min(limit, allMatches.length)}):`);
        allMatches.slice(0, limit).forEach((match, idx) => {
            console.log(`   ${idx + 1}. ${match.node1} ↔ ${match.node2}`);
            console.log(`      Тип: ${match.type === 'exact' ? 'ТОЧНОЕ' : 'ПОХОЖЕЕ'}`);
            console.log(`      Уверенность: ${(match.confidence * 100).toFixed(1)}%`);
            if (match.position) console.log(`      Позиция: ${match.position}`);
        });
       
        if (allMatches.length > limit) {
            console.log(`\n... и еще ${allMatches.length - limit} совпадений`);
        }
       
        console.log(`═`.repeat(60));
    }
}

module.exports = TopologicalFingerprint;
