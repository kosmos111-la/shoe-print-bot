// modules/footprint/simple-matcher.js
// УМНЫЙ СРАВНИТЕЛЬ ГРАФОВ С ИНВАРИАНТНОСТЬЮ

class SimpleGraphMatcher {
    constructor(options = {}) {
        this.config = {
            // Пороги для принятия решений
            sameThreshold: options.sameThreshold || 0.7,      // >0.7 = одна обувь
            similarThreshold: options.similarThreshold || 0.4, // 0.4-0.7 = похожая
            minNodeRatio: options.minNodeRatio || 0.7,        // Минимальное соотношение узлов
            maxNodeDiff: options.maxNodeDiff || 0.3,          // Максимальная разница узлов

            // Веса для разных типов сравнений
            weights: {
                basicInvariants: options.weights?.basicInvariants || 0.3,
                degreeDistribution: options.weights?.degreeDistribution || 0.25,
                edgeLengths: options.weights?.edgeLengths || 0.2,
                structure: options.weights?.structure || 0.15,
                invariantFeatures: options.weights?.invariantFeatures || 0.1 // 🔥 НОВОЕ
            },

            // Дополнительные настройки
            enableDetailedMatch: options.enableDetailedMatch !== false,
            enableInvariantComparison: options.enableInvariantComparison !== false, // 🔥 НОВОЕ
            debug: options.debug || false
        };

        this.matchHistory = [];
        console.log('🎯 Инициализирован SimpleGraphMatcher с инвариантностью');
    }

    // 🔥 ОСНОВНОЙ МЕТОД: СРАВНИТЬ ДВА ГРАФА С ИНВАРИАНТНОСТЬЮ
    compareGraphs(graph1, graph2, context = {}) {
        const startTime = Date.now();

        if (this.config.debug) {
            console.log(`🔍 Сравниваю графы с ИНВАРИАНТНОСТЬЮ: "${graph1.name}" vs "${graph2.name}"`);
            console.log(`   Граф 1: ${graph1.nodes.size} узлов, ${graph1.edges.size} рёбер`);
            console.log(`   Граф 2: ${graph2.nodes.size} узлов, ${graph2.edges.size} рёбер`);
        }

        // 🔥 Если запрошено инвариантное сравнение
        if (context.invariant || this.config.enableInvariantComparison) {
            return this.compareGraphsWithInvariance(graph1, graph2, context);
        }

        // ... существующий код продолжает работать для обратной совместимости ...

        const result = {
            similarity: 0,
            decision: 'different',
            reason: 'Используется инвариантное сравнение',
            timeMs: Date.now() - startTime,
            method: 'invariant_comparison'
        };

        this.recordMatch(result, context);
        return result;
    }

    // 🔥 НОВЫЙ МЕТОД: ИНВАРИАНТНОЕ СРАВНЕНИЕ С НОРМАЛИЗАЦИЕЙ
    compareGraphsWithInvariance(graph1, graph2, context = {}) {
        const startTime = Date.now();
       
        console.log(`🔍 Сравниваю графы с ИНВАРИАНТНОСТЬЮ: "${graph1.name}" vs "${graph2.name}"`);

        // 1. НОРМАЛИЗУЕМ оба графа к единому пространству [0,1]
        const normalized1 = this.normalizeGraph(graph1);
        const normalized2 = this.normalizeGraph(graph2);

        console.log(`   Нормализовано: ${normalized1.nodes.length} и ${normalized2.nodes.length} узлов`);

        // 2. ИНВАРИАНТНОЕ сравнение нормализованных графов
        const invariantResult = this.compareInvariantGraphs(normalized1, normalized2);

        // 3. Также сравниваем оригиналы (для совместимости)
        const originalResult = this.compareOriginalGraphs(graph1, graph2, { ...context, invariant: true });

        // 4. Комбинируем результаты
        const combinedSimilarity = this.combineInvariantScores(invariantResult, originalResult);

        // 5. Принимаем решение
        const decision = this.makeInvariantDecision(combinedSimilarity, {
            invariant: invariantResult,
            original: originalResult
        });

        const result = {
            similarity: combinedSimilarity,
            decision: decision.type,
            reason: decision.reason,
            details: {
                invariant: invariantResult,
                original: originalResult,
                combined: combinedSimilarity
            },
            method: 'invariant_comparison',
            matchedPairs: invariantResult.matchedPairs || [],
            confidence: decision.confidence,
            timeMs: Date.now() - startTime,
            context: context
        };

        this.recordMatch(result, context);
        return result;
    }

    // 🔥 НОВЫЙ МЕТОД: НОРМАЛИЗАЦИЯ ГРАФА
    normalizeGraph(graph) {
        const nodes = Array.from(graph.nodes.values());

        if (nodes.length === 0) {
            return { nodes: [], edges: [], bounds: null };
        }

        // Находим границы
        const xs = nodes.map(n => n.x);
        const ys = nodes.map(n => n.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);

        // Нормализуем координаты к [0, 1]
        const normalizedNodes = nodes.map(node => ({
            ...node,
            nx: (node.x - minX) / width,
            ny: (node.y - minY) / height,
            originalX: node.x,
            originalY: node.y
        }));

        // Нормализуем длины рёбер
        const normalizedEdges = [];
        if (graph.edges) {
            for (const [edgeId, edge] of graph.edges) {
                const fromNode = normalizedNodes.find(n => n.id === edge.from);
                const toNode = normalizedNodes.find(n => n.id === edge.to);

                if (fromNode && toNode) {
                    const dx = toNode.nx - fromNode.nx;
                    const dy = toNode.ny - fromNode.ny;
                    const normalizedLength = Math.sqrt(dx * dx + dy * dy);

                    normalizedEdges.push({
                        ...edge,
                        normalizedLength: normalizedLength,
                        fromNode: fromNode,
                        toNode: toNode
                    });
                }
            }
        }

        return {
            nodes: normalizedNodes,
            edges: normalizedEdges,
            bounds: { minX, maxX, minY, maxY, width, height },
            originalNodeCount: graph.nodes.size,
            originalEdgeCount: graph.edges.size
        };
    }

    // 🔥 НОВЫЙ МЕТОД: ИНВАРИАНТНОЕ СРАВНЕНИЕ ГРАФОВ
    compareInvariantGraphs(normGraph1, normGraph2) {
        if (normGraph1.nodes.length === 0 || normGraph2.nodes.length === 0) {
            return { similarity: 0, comparisons: [], matchedPairs: [] };
        }

        const comparisons = [];

        // 1. Сравнение количества узлов (нормализованное)
        const nodeRatio = Math.min(normGraph1.nodes.length, normGraph2.nodes.length) /
                        Math.max(normGraph1.nodes.length, normGraph2.nodes.length);
        comparisons.push({ name: 'nodeCount', score: nodeRatio });

        // 2. Сравнение распределения узлов в нормализованном пространстве
        const distributionScore = this.compareNormalizedDistributions(normGraph1.nodes, normGraph2.nodes);
        comparisons.push({ name: 'nodeDistribution', score: distributionScore });

        // 3. Сравнение длин рёбер (нормализованных)
        const edgeLengthScore = this.compareNormalizedEdgeLengths(normGraph1.edges, normGraph2.edges);
        comparisons.push({ name: 'edgeLengths', score: edgeLengthScore });

        // 4. Сравнение степени узлов (топологическое)
        const degreeScore = this.compareNodeDegrees(normGraph1, normGraph2);
        comparisons.push({ name: 'nodeDegrees', score: degreeScore });

        // 5. Сравнение плотности графа
        const densityScore = this.compareGraphDensity(normGraph1, normGraph2);
        comparisons.push({ name: 'graphDensity', score: densityScore });

        // 6. Находим совпадающие пары узлов
        const matchedPairs = this.findInvariantMatchedPairsFromNormalized(normGraph1, normGraph2);

        // Рассчитываем общую схожесть
        const totalScore = comparisons.reduce((sum, comp) => sum + comp.score, 0) / comparisons.length;

        // Улучшаем оценку на основе совпадающих пар
        const matchScore = matchedPairs.length > 0 ?
            Math.min(1, matchedPairs.length / Math.min(normGraph1.nodes.length, normGraph2.nodes.length)) : 0;
        const finalScore = (totalScore * 0.7) + (matchScore * 0.3);

        return {
            similarity: Math.max(0, Math.min(1, finalScore)),
            comparisons: comparisons,
            nodes1: normGraph1.nodes.length,
            nodes2: normGraph2.nodes.length,
            edges1: normGraph1.edges.length,
            edges2: normGraph2.edges.length,
            matchedPairs: matchedPairs,
            matchScore: matchScore
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение распределений в нормализованном пространстве
    compareNormalizedDistributions(nodes1, nodes2) {
        // Разбиваем на 3x3 сетку (9 квадрантов)
        const grid1 = this.createDistributionGrid(nodes1, 3);
        const grid2 = this.createDistributionGrid(nodes2, 3);

        // Сравниваем распределение по квадрантам
        let totalDiff = 0;
        for (let i = 0; i < 9; i++) {
            totalDiff += Math.abs(grid1[i] - grid2[i]);
        }

        return 1 - (totalDiff / 2); // Максимальная разница = 2
    }

    // 🔥 НОВЫЙ МЕТОД: Создание сетки распределения
    createDistributionGrid(nodes, gridSize = 3) {
        const grid = Array(gridSize * gridSize).fill(0);

        nodes.forEach(node => {
            const nx = node.nx || node.x || 0;
            const ny = node.ny || node.y || 0;

            // Определяем квадрант
            const gridX = Math.min(gridSize - 1, Math.floor(nx * gridSize));
            const gridY = Math.min(gridSize - 1, Math.floor(ny * gridSize));
            const cellIndex = gridY * gridSize + gridX;

            grid[cellIndex]++;
        });

        // Нормализуем к вероятностям
        const total = nodes.length || 1;
        return grid.map(count => count / total);
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение нормализованных длин рёбер
    compareNormalizedEdgeLengths(edges1, edges2) {
        if (edges1.length === 0 || edges2.length === 0) return 0;

        const lengths1 = edges1.map(e => e.normalizedLength || e.length || 0).sort((a, b) => a - b);
        const lengths2 = edges2.map(e => e.normalizedLength || e.length || 0).sort((a, b) => a - b);

        // Сравниваем статистики
        const mean1 = this.calculateMean(lengths1);
        const mean2 = this.calculateMean(lengths2);
        const std1 = this.calculateStdDev(lengths1, mean1);
        const std2 = this.calculateStdDev(lengths2, mean2);

        const meanScore = 1 - Math.min(1, Math.abs(mean1 - mean2) / 0.2);
        const stdScore = 1 - Math.min(1, Math.abs(std1 - std2) / 0.1);

        return (meanScore + stdScore) / 2;
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение степеней узлов
    compareNodeDegrees(normGraph1, normGraph2) {
        // Вычисляем степени для каждого графа
        const degrees1 = this.calculateNodeDegrees(normGraph1);
        const degrees2 = this.calculateNodeDegrees(normGraph2);

        // Сравниваем распределения степеней
        const maxDegree = Math.max(
            ...degrees1.map(d => d.degree),
            ...degrees2.map(d => d.degree)
        );

        // Создаем гистограммы
        const bins = Math.min(5, maxDegree + 1);
        const hist1 = this.createHistogram(degrees1.map(d => d.degree), bins);
        const hist2 = this.createHistogram(degrees2.map(d => d.degree), bins);

        return this.compareHistograms(hist1, hist2);
    }

    // 🔥 НОВЫЙ МЕТОД: Вычисление степеней узлов
    calculateNodeDegrees(normGraph) {
        const degreeMap = new Map();

        // Инициализируем все узлы
        normGraph.nodes.forEach(node => {
            degreeMap.set(node.id, { node, degree: 0 });
        });

        // Считаем рёбра
        normGraph.edges.forEach(edge => {
            if (degreeMap.has(edge.from)) {
                degreeMap.get(edge.from).degree++;
            }
            if (degreeMap.has(edge.to)) {
                degreeMap.get(edge.to).degree++;
            }
        });

        return Array.from(degreeMap.values());
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение плотности графа
    compareGraphDensity(normGraph1, normGraph2) {
        const n1 = normGraph1.nodes.length;
        const n2 = normGraph2.nodes.length;

        if (n1 < 2 || n2 < 2) return 0;

        // Максимальное возможное количество рёбер
        const maxEdges1 = n1 * (n1 - 1) / 2;
        const maxEdges2 = n2 * (n2 - 1) / 2;

        const density1 = normGraph1.edges.length / maxEdges1;
        const density2 = normGraph2.edges.length / maxEdges2;

        return 1 - Math.min(1, Math.abs(density1 - density2) / 0.3);
    }

    // 🔥 НОВЫЙ МЕТОД: Комбинация инвариантных и оригинальных оценок
    combineInvariantScores(invariantResult, originalResult) {
        const invariantWeight = 0.7;  // Больший вес инвариантному сравнению
        const originalWeight = 0.3;   // Меньший вес оригинальному

        const invariantScore = invariantResult.similarity || 0;
        const originalScore = originalResult.similarity || 0;

        return (invariantScore * invariantWeight + originalScore * originalWeight) /
               (invariantWeight + originalWeight);
    }

    // 🔥 НОВЫЙ МЕТОД: Нахождение совпадающих пар из нормализованных графов
    findInvariantMatchedPairsFromNormalized(normGraph1, normGraph2) {
        const pairs = [];
        const usedNodes2 = new Set();
        const distanceThreshold = 0.15; // 15% от нормализованного размера

        // Для каждого узла первого графа находим ближайший узел второго графа
        normGraph1.nodes.forEach(node1 => {
            let bestMatch = null;
            let minDistance = Infinity;

            normGraph2.nodes.forEach((node2, j) => {
                if (usedNodes2.has(j)) return;

                const dx = node1.nx - node2.nx;
                const dy = node1.ny - node2.ny;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance && distance < distanceThreshold) {
                    minDistance = distance;
                    bestMatch = {
                        node1: node1.id,
                        node2: node2.id,
                        distance: distance,
                        normalizedDistance: distance,
                        node1Data: {
                            x: node1.originalX || node1.x,
                            y: node1.originalY || node1.y,
                            nx: node1.nx,
                            ny: node1.ny
                        },
                        node2Data: {
                            x: node2.originalX || node2.x,
                            y: node2.originalY || node2.y,
                            nx: node2.nx,
                            ny: node2.ny
                        }
                    };
                }
            });

            if (bestMatch) {
                const node2Index = normGraph2.nodes.findIndex(n => n.id === bestMatch.node2);
                if (node2Index !== -1) {
                    usedNodes2.add(node2Index);
                    pairs.push(bestMatch);
                }
            }
        });

        return pairs;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ИСТОРИЧЕСКОГО КОДА (адаптированные)
   
    // Старый метод compareGraphs для обратной совместимости
    compareOriginalGraphs(graph1, graph2, context = {}) {
        // Быстрая проверка с инвариантностью
        const quickCheck = this.invariantQuickCheck(graph1, graph2);
       
        if (!quickCheck.pass) {
            return {
                similarity: quickCheck.score,
                decision: 'different',
                reason: quickCheck.reason,
                confidence: quickCheck.confidence
            };
        }

        // Сравнение базовых инвариантов
        const basicComparison = this.compareBasicInvariants(graph1, graph2);
       
        return {
            similarity: basicComparison.score,
            decision: basicComparison.score > this.config.sameThreshold ? 'same' :
                     basicComparison.score > this.config.similarThreshold ? 'similar' : 'different',
            reason: `Базовое сравнение: ${basicComparison.score.toFixed(3)}`,
            confidence: basicComparison.score
        };
    }

    // 🔥 НОВЫЙ МЕТОД: ПРИНЯТИЕ РЕШЕНИЯ С ИНВАРИАНТНОСТЬЮ
    makeInvariantDecision(score, comparisonData) {
        const { invariant, original } = comparisonData;
        const matchedPairs = invariant?.matchedPairs || [];

        // 🔥 АДАПТИВНЫЕ ПОРОГИ с учетом инвариантных совпадений
        let effectiveThreshold = this.config.sameThreshold;
        let effectiveSimilarThreshold = this.config.similarThreshold;

        // Если много инвариантных совпадений, снижаем порог
        const matchRatio = matchedPairs.length > 0 ?
            matchedPairs.length / Math.max(invariant?.nodes1 || 10, 10) : 0;
           
        if (matchRatio > 0.6 && invariant?.similarity > 0.7) {
            effectiveThreshold *= 0.9; // Снижаем порог на 10%
            effectiveSimilarThreshold *= 0.8; // Снижаем порог на 20%
        }

        if (score >= effectiveThreshold) {
            return {
                type: 'same',
                reason: `Высокая инвариантная схожесть (${score.toFixed(3)}), ${matchedPairs.length} совпадающих пар`,
                confidence: score * (1 + matchRatio * 0.2)
            };
        } else if (score >= effectiveSimilarThreshold) {
            return {
                type: 'similar',
                reason: `Умеренная инвариантная схожесть (${score.toFixed(3)})`,
                confidence: score
            };
        } else {
            let reason = `Низкая инвариантная схожесть (${score.toFixed(3)})`;

            // Добавить конкретную причину
            if (invariant && invariant.comparisons) {
                const worst = invariant.comparisons
                    .reduce((worst, current) =>
                        current.score < worst.score ? current : worst);

                if (worst.score < 0.5) {
                    reason += `. Проблема с ${worst.name}: ${worst.score.toFixed(2)}`;
                }
            }

            return {
                type: 'different',
                reason: reason,
                confidence: 1 - score
            };
        }
    }

    // ============ СУЩЕСТВУЮЩИЕ МЕТОДЫ (адаптированные) ============

    // Быстрая проверка с инвариантностью
    invariantQuickCheck(graph1, graph2) {
        const invariants1 = graph1.getBasicInvariants ? graph1.getBasicInvariants() : { nodeCount: graph1.nodes.size };
        const invariants2 = graph2.getBasicInvariants ? graph2.getBasicInvariants() : { nodeCount: graph2.nodes.size };

        // 1. Проверка количества узлов (нормализованная)
        const nodeRatio = Math.min(invariants1.nodeCount, invariants2.nodeCount) /
                         Math.max(invariants1.nodeCount, invariants2.nodeCount);

        if (nodeRatio < this.config.minNodeRatio * 0.8) {
            return {
                pass: false,
                score: nodeRatio,
                reason: `Слишком разное количество узлов: ${invariants1.nodeCount} vs ${invariants2.nodeCount} (ratio: ${nodeRatio.toFixed(2)})`,
                confidence: 1 - nodeRatio
            };
        }

        const quickScore = nodeRatio;

        return {
            pass: true,
            score: quickScore,
            reason: 'Быстрая инвариантная проверка пройдена',
            confidence: quickScore
        };
    }

    // Сравнение базовых инвариантов
    compareBasicInvariants(graph1, graph2) {
        const invariants1 = graph1.getBasicInvariants ? graph1.getBasicInvariants() : { nodeCount: graph1.nodes.size, edgeCount: graph1.edges.size };
        const invariants2 = graph2.getBasicInvariants ? graph2.getBasicInvariants() : { nodeCount: graph2.nodes.size, edgeCount: graph2.edges.size };

        const comparisons = [];
        let totalScore = 0;

        // 1. Количество узлов
        const nodeScore = Math.min(invariants1.nodeCount, invariants2.nodeCount) /
                         Math.max(invariants1.nodeCount, invariants2.nodeCount);
        comparisons.push({ name: 'nodeCount', score: nodeScore, weight: 0.2 });
        totalScore += nodeScore * 0.2;

        // 2. Количество рёбер
        const edgeScore = Math.min(invariants1.edgeCount, invariants2.edgeCount) /
                         Math.max(invariants1.edgeCount, invariants2.edgeCount);
        comparisons.push({ name: 'edgeCount', score: edgeScore, weight: 0.15 });
        totalScore += edgeScore * 0.15;

        const finalScore = Math.min(1, Math.max(0, totalScore));

        return {
            score: finalScore,
            comparisons: comparisons,
            details: {
                nodeCount1: invariants1.nodeCount,
                nodeCount2: invariants2.nodeCount,
                edgeCount1: invariants1.edgeCount,
                edgeCount2: invariants2.edgeCount
            }
        };
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    compareHistograms(hist1, hist2) {
        if (!hist1 || !hist2 || hist1.length !== hist2.length) {
            return 0;
        }

        let totalDiff = 0;
        for (let i = 0; i < hist1.length; i++) {
            const val1 = typeof hist1[i] === 'object' ? hist1[i].count || hist1[i] : hist1[i];
            const val2 = typeof hist2[i] === 'object' ? hist2[i].count || hist2[i] : hist2[i];
            const maxVal = Math.max(val1, val2, 1);
            totalDiff += Math.abs(val1 - val2) / maxVal;
        }

        const avgDiff = totalDiff / hist1.length;
        return 1 - Math.min(1, avgDiff);
    }

    createHistogram(values, bins = 5) {
        if (!values || values.length === 0) return Array(bins).fill(0);

        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;

        if (range === 0) return Array(bins).fill(values.length / bins);

        const histogram = Array(bins).fill(0);
        const binSize = range / bins;

        values.forEach(value => {
            const binIndex = Math.min(bins - 1, Math.floor((value - min) / binSize));
            histogram[binIndex]++;
        });

        // Нормализуем
        const total = values.length;
        return histogram.map(count => count / total);
    }

    calculateMean(values) {
        if (!values || values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    calculateStdDev(values, mean) {
        if (!values || values.length < 2) return 0;
        const squareDiffs = values.map(val => Math.pow(val - mean, 2));
        return Math.sqrt(squareDiffs.reduce((sum, val) => sum + val, 0) / values.length);
    }

    // 8. ЗАПИСАТЬ РЕЗУЛЬТАТ СРАВНЕНИЯ
    recordMatch(result, context) {
        const record = {
            timestamp: new Date(),
            similarity: result.similarity,
            decision: result.decision,
            confidence: result.confidence,
            matchedPairs: result.matchedPairs?.length || 0,
            timeMs: result.timeMs,
            context: context,
            details: {
                steps: result.steps,
                method: result.method
            }
        };

        this.matchHistory.push(record);

        // Держать только последние 100 записей
        if (this.matchHistory.length > 100) {
            this.matchHistory.shift();
        }
    }

    // 9. ПРОВЕРИТЬ, ОДНА ЛИ ЭТО ОБУВЬ? (простой интерфейс)
    isSameShoe(graph1, graph2) {
        const result = this.compareGraphsWithInvariance(graph1, graph2, { checkType: 'isSameShoe' });
        return {
            isSame: result.decision === 'same',
            similarity: result.similarity,
            confidence: result.confidence,
            reason: result.reason,
            matchedPairs: result.matchedPairs
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: alignAndCompare для совместимости
    alignAndCompare(graph1, graph2, options = {}) {
        // Используем улучшенный метод сравнения с инвариантностью
        return this.compareGraphsWithInvariance(graph1, graph2, options);
    }

    // 🔥 АДАПТИВНОЕ СРАВНЕНИЕ ДЛЯ РАЗНЫХ РАЗМЕРОВ
    adaptiveCompare(graph1, graph2, options = {}) {
        const startTime = Date.now();

        // 🔥 ИСПОЛЬЗУЕМ ИНВАРИАНТНЫЕ МЕТРИКИ
        const normalized1 = this.normalizeGraph(graph1);
        const normalized2 = this.normalizeGraph(graph2);
       
        const invariantResult = this.compareInvariantGraphs(normalized1, normalized2);
        const matchedPairs = invariantResult.matchedPairs || [];

        // 🔥 КОМБИНИРОВАННЫЙ SCORE с учетом инвариантности
        const matchRatio = matchedPairs.length / Math.max(normalized1.nodes.length, normalized2.nodes.length, 1);
        const invariantScore = invariantResult.similarity;

        const finalScore = (invariantScore * 0.7) + (matchRatio * 0.3);

        // Принимаем решение
        let decision, reason;
        if (finalScore > this.config.sameThreshold) {
            decision = 'same';
            reason = `Следы похожи (${finalScore.toFixed(3)}) несмотря на разный размер`;
        } else if (finalScore > this.config.similarThreshold) {
            decision = 'similar';
            reason = `Умеренная схожесть (${finalScore.toFixed(3)})`;
        } else {
            decision = 'different';
            reason = `Слишком разные (${finalScore.toFixed(3)})`;
        }

        return {
            similarity: finalScore,
            decision: decision,
            reason: reason,
            matchRatio: matchRatio,
            invariantScore: invariantScore,
            matchedPairs: matchedPairs,
            timeMs: Date.now() - startTime
        };
    }

    // 10. НАЙТИ САМЫЙ ПОХОЖИЙ ГРАФ ИЗ СПИСКА
    findMostSimilar(targetGraph, graphList, maxResults = 5) {
        console.log(`🔎 Ищу похожие графы для "${targetGraph.name}" среди ${graphList.length} кандидатов...`);

        const comparisons = [];

        graphList.forEach((graph, index) => {
            if (graph.id === targetGraph.id) return; // Пропустить сам себя

            const result = this.compareGraphsWithInvariance(targetGraph, graph, {
                searchIndex: index,
                totalCandidates: graphList.length
            });

            comparisons.push({
                graph: graph,
                similarity: result.similarity,
                decision: result.decision,
                confidence: result.confidence,
                reason: result.reason,
                matchedPairs: result.matchedPairs,
                index: index
            });
        });

        // Отсортировать по схожести
        comparisons.sort((a, b) => b.similarity - a.similarity);

        // Взять лучшие результаты
        const bestMatches = comparisons.slice(0, maxResults);

        console.log(`✅ Найдено ${bestMatches.length} похожих графов (лучший: ${bestMatches[0]?.similarity?.toFixed(3) || 'нет'})`);

        return {
            targetGraph: targetGraph.name,
            totalCompared: comparisons.length,
            bestMatches: bestMatches,
            stats: {
                sameCount: comparisons.filter(c => c.decision === 'same').length,
                similarCount: comparisons.filter(c => c.decision === 'similar').length,
                differentCount: comparisons.filter(c => c.decision === 'different').length
            }
        };
    }

    // 11. ПОЛУЧИТЬ СТАТИСТИКУ МАТЧЕРА
    getStats() {
        const totalMatches = this.matchHistory.length;

        if (totalMatches === 0) {
            return { totalMatches: 0 };
        }

        const decisions = {
            same: 0,
            similar: 0,
            different: 0
        };

        let totalSimilarity = 0;
        let totalTime = 0;
        let totalMatchedPairs = 0;

        this.matchHistory.forEach(match => {
            decisions[match.decision] = (decisions[match.decision] || 0) + 1;
            totalSimilarity += match.similarity;
            totalTime += match.timeMs;
            totalMatchedPairs += match.matchedPairs || 0;
        });

        return {
            totalMatches: totalMatches,
            decisions: decisions,
            avgSimilarity: totalSimilarity / totalMatches,
            avgMatchedPairs: totalMatchedPairs / totalMatches,
            avgTimeMs: totalTime / totalMatches,
            lastMatch: this.matchHistory[this.matchHistory.length - 1]?.timestamp,
            config: this.config
        };
    }
}

module.exports = SimpleGraphMatcher;
