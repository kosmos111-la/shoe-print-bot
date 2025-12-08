// modules/footprint/simple-matcher.js
// УМНЫЙ СРАВНИТЕЛЬ ГРАФОВ - СЕРДЦЕ СИСТЕМЫ

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
                basicInvariants: options.weights?.basicInvariants || 0.4,
                degreeDistribution: options.weights?.degreeDistribution || 0.3,
                edgeLengths: options.weights?.edgeLengths || 0.2,
                structure: options.weights?.structure || 0.1
            },
           
            // Дополнительные настройки
            enableDetailedMatch: options.enableDetailedMatch !== false,
            debug: options.debug || false
        };
       
        this.matchHistory = [];
        console.log('🎯 Инициализирован SimpleGraphMatcher');
    }
   
    // 1. ОСНОВНОЙ МЕТОД: СРАВНИТЬ ДВА ГРАФА
    compareGraphs(graph1, graph2, context = {}) {
        const startTime = Date.now();
       
        if (this.config.debug) {
            console.log(`🔍 Сравниваю графы: "${graph1.name}" vs "${graph2.name}"`);
            console.log(`   Граф 1: ${graph1.nodes.size} узлов, ${graph1.edges.size} рёбер`);
            console.log(`   Граф 2: ${graph2.nodes.size} узлов, ${graph2.edges.size} рёбер`);
        }
       
        // ШАГ 1: Быстрая проверка (отсев явно разных следов)
        const quickCheck = this.quickCheck(graph1, graph2);
       
        if (!quickCheck.pass) {
            const result = {
                similarity: quickCheck.score,
                decision: 'different',
                reason: quickCheck.reason,
                steps: ['quick_check_failed'],
                confidence: quickCheck.confidence,
                timeMs: Date.now() - startTime
            };
           
            this.recordMatch(result, context);
            return result;
        }
       
        // ШАГ 2: Сравнение базовых инвариантов
        const basicComparison = this.compareBasicInvariants(graph1, graph2);
       
        // ШАГ 3: Детальное сравнение (если включено)
        let detailedComparison = { score: 0, details: {} };
        if (this.config.enableDetailedMatch && basicComparison.score > 0.5) {
            detailedComparison = this.detailedCompare(graph1, graph2);
        }
       
        // ШАГ 4: Рассчитать общую схожесть
        const finalScore = this.calculateFinalScore(basicComparison, detailedComparison);
       
        // ШАГ 5: Принять решение
        const decision = this.makeDecision(finalScore, {
            basicComparison,
            detailedComparison,
            quickCheck
        });
       
        const result = {
            similarity: finalScore,
            decision: decision.type,
            reason: decision.reason,
            confidence: decision.confidence,
            details: {
                basic: basicComparison,
                detailed: detailedComparison.details,
                quickCheck: quickCheck
            },
            steps: ['quick_check', 'basic_invariants',
                   ...(detailedComparison.score > 0 ? ['detailed_comparison'] : [])],
            timeMs: Date.now() - startTime,
            context: context
        };
       
        // Записать в историю
        this.recordMatch(result, context);
       
        if (this.config.debug) {
            console.log(`📊 Результат: ${finalScore.toFixed(3)} (${decision.type})`);
            console.log(`   Причина: ${decision.reason}`);
            console.log(`   Время: ${result.timeMs}мс`);
        }
       
        return result;
    }
   
    // 2. БЫСТРАЯ ПРОВЕРКА (отсев явно разных)
    quickCheck(graph1, graph2) {
        const invariants1 = graph1.getBasicInvariants();
        const invariants2 = graph2.getBasicInvariants();
       
        // 1. Проверка количества узлов
        const nodeRatio = Math.min(invariants1.nodeCount, invariants2.nodeCount) /
                         Math.max(invariants1.nodeCount, invariants2.nodeCount);
       
        if (nodeRatio < this.config.minNodeRatio) {
            return {
                pass: false,
                score: nodeRatio,
                reason: `Слишком разное количество узлов: ${invariants1.nodeCount} vs ${invariants2.nodeCount} (ratio: ${nodeRatio.toFixed(2)})`,
                confidence: 1 - nodeRatio
            };
        }
       
        // 2. Проверка количества рёбер
        const edgeRatio = Math.min(invariants1.edgeCount, invariants2.edgeCount) /
                         Math.max(invariants1.edgeCount, invariants2.edgeCount);
       
        if (edgeRatio < 0.6) {
            const score = (nodeRatio + edgeRatio) / 2;
            return {
                pass: false,
                score: score,
                reason: `Слишком разное количество рёбер: ${invariants1.edgeCount} vs ${invariants2.edgeCount}`,
                confidence: score
            };
        }
       
        // 3. Быстрая проверка диаметра графа
        const diameterRatio = Math.min(invariants1.graphDiameter, invariants2.graphDiameter) /
                             Math.max(invariants1.graphDiameter, invariants2.graphDiameter);
       
        const quickScore = (nodeRatio + edgeRatio + diameterRatio) / 3;
       
        return {
            pass: true,
            score: quickScore,
            reason: 'Быстрая проверка пройдена',
            confidence: quickScore
        };
    }
   
    // 3. СРАВНЕНИЕ БАЗОВЫХ ИНВАРИАНТОВ
    compareBasicInvariants(graph1, graph2) {
        const invariants1 = graph1.getBasicInvariants();
        const invariants2 = graph2.getBasicInvariants();
       
        const comparisons = [];
        let totalScore = 0;
       
        // 1. Количество узлов (уже проверено, но добавляем для точности)
        const nodeScore = Math.min(invariants1.nodeCount, invariants2.nodeCount) /
                         Math.max(invariants1.nodeCount, invariants2.nodeCount);
        comparisons.push({ name: 'nodeCount', score: nodeScore, weight: 0.2 });
        totalScore += nodeScore * 0.2;
       
        // 2. Количество рёбер
        const edgeScore = Math.min(invariants1.edgeCount, invariants2.edgeCount) /
                         Math.max(invariants1.edgeCount, invariants2.edgeCount);
        comparisons.push({ name: 'edgeCount', score: edgeScore, weight: 0.15 });
        totalScore += edgeScore * 0.15;
       
        // 3. Средняя степень узла
        const degreeDiff = Math.abs(invariants1.avgDegree - invariants2.avgDegree);
        const degreeScore = 1 - Math.min(1, degreeDiff / Math.max(1, invariants1.avgDegree * 0.3));
        comparisons.push({ name: 'avgDegree', score: degreeScore, weight: 0.15 });
        totalScore += degreeScore * 0.15;
       
        // 4. Коэффициент кластеризации
        const clusteringDiff = Math.abs(invariants1.clusteringCoefficient - invariants2.clusteringCoefficient);
        const clusteringScore = 1 - Math.min(1, clusteringDiff / 0.2);
        comparisons.push({ name: 'clustering', score: clusteringScore, weight: 0.15 });
        totalScore += clusteringScore * 0.15;
       
        // 5. Диаметр графа
        const diameterScore = Math.min(invariants1.graphDiameter, invariants2.graphDiameter) /
                             Math.max(invariants1.graphDiameter, invariants2.graphDiameter);
        comparisons.push({ name: 'graphDiameter', score: diameterScore, weight: 0.1 });
        totalScore += diameterScore * 0.1;
       
        // 6. Плотность графа
        const densityDiff = Math.abs(invariants1.density - invariants2.density);
        const densityScore = 1 - Math.min(1, densityDiff / 0.1);
        comparisons.push({ name: 'density', score: densityScore, weight: 0.1 });
        totalScore += densityScore * 0.1;
       
        // 7. Распределение степеней (гистограмма)
        const degreeHistScore = this.compareHistograms(
            invariants1.degreeHistogram,
            invariants2.degreeHistogram
        );
        comparisons.push({ name: 'degreeDistribution', score: degreeHistScore, weight: 0.15 });
        totalScore += degreeHistScore * 0.15;
       
        const finalScore = Math.min(1, Math.max(0, totalScore));
       
        return {
            score: finalScore,
            comparisons: comparisons,
            details: {
                nodeCount1: invariants1.nodeCount,
                nodeCount2: invariants2.nodeCount,
                edgeCount1: invariants1.edgeCount,
                edgeCount2: invariants2.edgeCount,
                avgDegree1: invariants1.avgDegree.toFixed(2),
                avgDegree2: invariants2.avgDegree.toFixed(2),
                clustering1: invariants1.clusteringCoefficient.toFixed(3),
                clustering2: invariants2.clusteringCoefficient.toFixed(3)
            }
        };
    }
   
    // 4. ДЕТАЛЬНОЕ СРАВНЕНИЕ (для высокой точности)
    detailedCompare(graph1, graph2) {
        const invariants1 = graph1.getBasicInvariants();
        const invariants2 = graph2.getBasicInvariants();
       
        const details = {};
        let totalScore = 0;
        let totalWeight = 0;
       
        // 1. Сравнение гистограмм длин рёбер
        if (invariants1.edgeLengthHistogram && invariants2.edgeLengthHistogram) {
            const edgeLengthScore = this.compareHistograms(
                invariants1.edgeLengthHistogram,
                invariants2.edgeLengthHistogram
            );
            details.edgeLengthComparison = {
                score: edgeLengthScore,
                hist1: invariants1.edgeLengthHistogram.slice(0, 5),
                hist2: invariants2.edgeLengthHistogram.slice(0, 5)
            };
            totalScore += edgeLengthScore * 0.3;
            totalWeight += 0.3;
        }
       
        // 2. Сравнение нормализованных длин рёбер
        if (invariants1.normalizedMetrics?.normalizedEdgeLengths &&
            invariants2.normalizedMetrics?.normalizedEdgeLengths) {
           
            const lengths1 = invariants1.normalizedMetrics.normalizedEdgeLengths;
            const lengths2 = invariants2.normalizedMetrics.normalizedEdgeLengths;
           
            // Сравнить статистики распределений
            const mean1 = this.calculateMean(lengths1);
            const mean2 = this.calculateMean(lengths2);
            const std1 = this.calculateStdDev(lengths1, mean1);
            const std2 = this.calculateStdDev(lengths2, mean2);
           
            const meanScore = 1 - Math.min(1, Math.abs(mean1 - mean2) / 0.2);
            const stdScore = 1 - Math.min(1, Math.abs(std1 - std2) / 0.1);
           
            const normalizedScore = (meanScore + stdScore) / 2;
           
            details.normalizedLengths = {
                score: normalizedScore,
                mean1: mean1.toFixed(3),
                mean2: mean2.toFixed(3),
                std1: std1.toFixed(3),
                std2: std2.toFixed(3)
            };
           
            totalScore += normalizedScore * 0.4;
            totalWeight += 0.4;
        }
       
        // 3. Сравнение распределения узлов
        if (invariants1.normalizedMetrics?.normalizedNodeDistribution &&
            invariants2.normalizedMetrics?.normalizedNodeDistribution) {
           
            const nodes1 = invariants1.normalizedMetrics.normalizedNodeDistribution;
            const nodes2 = invariants2.normalizedMetrics.normalizedNodeDistribution;
           
            if (nodes1.length > 5 && nodes2.length > 5) {
                // Простая проверка: сравниваем центры масс
                const center1 = this.calculateCenterOfMass(nodes1);
                const center2 = this.calculateCenterOfMass(nodes2);
               
                const distance = Math.sqrt(
                    Math.pow(center2.x - center1.x, 2) +
                    Math.pow(center2.y - center1.y, 2)
                );
               
                const distributionScore = 1 - Math.min(1, distance / 0.3);
               
                details.nodeDistribution = {
                    score: distributionScore,
                    center1: { x: center1.x.toFixed(3), y: center1.y.toFixed(3) },
                    center2: { x: center2.x.toFixed(3), y: center2.y.toFixed(3) },
                    distance: distance.toFixed(3)
                };
               
                totalScore += distributionScore * 0.3;
                totalWeight += 0.3;
            }
        }
       
        const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
       
        return {
            score: finalScore,
            details: details
        };
    }
   
    // 5. РАССЧИТАТЬ ИТОГОВЫЙ SCORE
    calculateFinalScore(basicComparison, detailedComparison) {
        const basicWeight = this.config.weights.basicInvariants;
        const detailedWeight = detailedComparison.score > 0 ?
            this.config.weights.degreeDistribution +
            this.config.weights.edgeLengths +
            this.config.weights.structure : 0;
       
        const totalWeight = basicWeight + detailedWeight;
       
        if (totalWeight === 0) {
            return basicComparison.score;
        }
       
        const basicPart = basicComparison.score * basicWeight;
        const detailedPart = detailedComparison.score * detailedWeight;
       
        return (basicPart + detailedPart) / totalWeight;
    }
   
    // 6. ПРИНЯТЬ РЕШЕНИЕ
    makeDecision(score, comparisonData) {
        if (score >= this.config.sameThreshold) {
            return {
                type: 'same',
                reason: `Высокая схожесть (${score.toFixed(3)}) - вероятно, та же обувь`,
                confidence: score
            };
        } else if (score >= this.config.similarThreshold) {
            return {
                type: 'similar',
                reason: `Умеренная схожесть (${score.toFixed(3)}) - похожий тип протектора`,
                confidence: score
            };
        } else {
            let reason = `Низкая схожесть (${score.toFixed(3)}) - разные следы`;
           
            // Добавить конкретную причину если есть
            if (comparisonData.quickCheck && !comparisonData.quickCheck.pass) {
                reason = comparisonData.quickCheck.reason;
            } else if (comparisonData.basicComparison) {
                const worst = comparisonData.basicComparison.comparisons
                    .reduce((worst, current) =>
                        current.score < worst.score ? current : worst);
               
                if (worst.score < 0.5) {
                    reason += `. Проблема с ${worst.name}: ${worst.score.toFixed(2)}`;
                }
            }
           
            return {
                type: 'different',
                reason: reason,
                confidence: 1 - score // Чем меньше схожесть, тем больше уверенность что это разные следы
            };
        }
    }
   
    // 7. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
   
    // Сравнить две гистограммы
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
   
    // Рассчитать среднее
    calculateMean(values) {
        if (!values || values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
   
    // Рассчитать стандартное отклонение
    calculateStdDev(values, mean) {
        if (!values || values.length < 2) return 0;
        const squareDiffs = values.map(val => Math.pow(val - mean, 2));
        return Math.sqrt(squareDiffs.reduce((sum, val) => sum + val, 0) / values.length);
    }
   
    // Рассчитать центр масс
    calculateCenterOfMass(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };
       
        const sumX = points.reduce((sum, p) => sum + (p.nx || p.x || 0), 0);
        const sumY = points.reduce((sum, p) => sum + (p.ny || p.y || 0), 0);
       
        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }
   
    // 8. ЗАПИСАТЬ РЕЗУЛЬТАТ СРАВНЕНИЯ
    recordMatch(result, context) {
        const record = {
            timestamp: new Date(),
            similarity: result.similarity,
            decision: result.decision,
            confidence: result.confidence,
            timeMs: result.timeMs,
            context: context,
            details: {
                steps: result.steps
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
        const result = this.compareGraphs(graph1, graph2, { checkType: 'isSameShoe' });
        return {
            isSame: result.decision === 'same',
            similarity: result.similarity,
            confidence: result.confidence,
            reason: result.reason
        };
    }
   
    // 10. НАЙТИ САМЫЙ ПОХОЖИЙ ГРАФ ИЗ СПИСКА
    findMostSimilar(targetGraph, graphList, maxResults = 5) {
        console.log(`🔎 Ищу похожие графы для "${targetGraph.name}" среди ${graphList.length} кандидатов...`);
       
        const comparisons = [];
       
        graphList.forEach((graph, index) => {
            if (graph.id === targetGraph.id) return; // Пропустить сам себя
           
            const result = this.compareGraphs(targetGraph, graph, {
                searchIndex: index,
                totalCandidates: graphList.length
            });
           
            comparisons.push({
                graph: graph,
                similarity: result.similarity,
                decision: result.decision,
                confidence: result.confidence,
                reason: result.reason,
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
       
        this.matchHistory.forEach(match => {
            decisions[match.decision] = (decisions[match.decision] || 0) + 1;
            totalSimilarity += match.similarity;
            totalTime += match.timeMs;
        });
       
        return {
            totalMatches: totalMatches,
            decisions: decisions,
            avgSimilarity: totalSimilarity / totalMatches,
            avgTimeMs: totalTime / totalMatches,
            lastMatch: this.matchHistory[this.matchHistory.length - 1]?.timestamp,
            config: this.config
        };
    }
}

module.exports = SimpleGraphMatcher;
