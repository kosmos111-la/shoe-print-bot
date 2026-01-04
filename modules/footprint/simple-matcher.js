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

    // 1. ОСНОВНОЙ МЕТОД: СРАВНИТЬ ДВА ГРАФА
    compareGraphs(graph1, graph2, context = {}) {
        const startTime = Date.now();

        if (this.config.debug) {
            console.log(`🔍 Сравниваю графы с ИНВАРИАНТНОСТЬЮ: "${graph1.name}" vs "${graph2.name}"`);
            console.log(`   Граф 1: ${graph1.nodes.size} узлов, ${graph1.edges.size} рёбер`);
            console.log(`   Граф 2: ${graph2.nodes.size} узлов, ${graph2.edges.size} рёбер`);
        }

        // ШАГ 1: Быстрая проверка (с учетом инвариантности)
        const quickCheck = this.invariantQuickCheck(graph1, graph2);

        if (!quickCheck.pass) {
            const result = {
                similarity: quickCheck.score,
                decision: 'different',
                reason: quickCheck.reason,
                steps: ['invariant_quick_check_failed'],
                confidence: quickCheck.confidence,
                timeMs: Date.now() - startTime,
                matchedPairs: []
            };

            this.recordMatch(result, context);
            return result;
        }

        // ШАГ 2: Сравнение базовых инвариантов
        const basicComparison = this.compareBasicInvariants(graph1, graph2);

        // ШАГ 3: 🔥 ИНВАРИАНТНОЕ СРАВНЕНИЕ
        let invariantComparison = { score: 0, details: {} };
        if (this.config.enableInvariantComparison) {
            invariantComparison = this.compareGraphInvariants(graph1, graph2);
        }

        // ШАГ 4: Детальное сравнение (если включено)
        let detailedComparison = { score: 0, details: {} };
        if (this.config.enableDetailedMatch && basicComparison.score > 0.5) {
            detailedComparison = this.detailedCompare(graph1, graph2);
        }

        // ШАГ 5: 🔥 ИНВАРИАНТНЫЕ СОВПАДАЮЩИЕ ПАРЫ
        const matchedPairs = this.findInvariantMatchedPairs(graph1, graph2);

        // ШАГ 6: Рассчитать общую схожесть с инвариантностью
        const finalScore = this.calculateInvariantFinalScore(
            basicComparison,
            detailedComparison,
            invariantComparison,
            matchedPairs
        );

        // ШАГ 7: Принять решение
        const decision = this.makeInvariantDecision(finalScore, {
            basicComparison,
            detailedComparison,
            invariantComparison,
            quickCheck,
            matchedPairs
        });

        const result = {
            similarity: finalScore,
            decision: decision.type,
            reason: decision.reason,
            confidence: decision.confidence,
            details: {
                basic: basicComparison,
                detailed: detailedComparison.details,
                invariant: invariantComparison.details,
                quickCheck: quickCheck
            },
            matchedPairs: matchedPairs,
            invariantMetrics: invariantComparison.metrics,
            steps: ['invariant_quick_check', 'basic_invariants',
                   'invariant_comparison',
                   ...(detailedComparison.score > 0 ? ['detailed_comparison'] : [])],
            timeMs: Date.now() - startTime,
            context: context
        };

        // Записать в историю
        this.recordMatch(result, context);

        if (this.config.debug) {
            console.log(`📊 Результат: ${finalScore.toFixed(3)} (${decision.type})`);
            console.log(`   Причина: ${decision.reason}`);
            console.log(`   Инвариантные пары: ${matchedPairs.length}`);
            console.log(`   Время: ${result.timeMs}мс`);
        }

        return result;
    }

    // 🔥 НОВЫЙ МЕТОД: БЫСТРАЯ ПРОВЕРКА С ИНВАРИАНТНОСТЬЮ
    invariantQuickCheck(graph1, graph2) {
        const invariants1 = graph1.getBasicInvariants();
        const invariants2 = graph2.getBasicInvariants();

        // 1. Проверка количества узлов (нормализованная)
        const nodeRatio = Math.min(invariants1.nodeCount, invariants2.nodeCount) /
                         Math.max(invariants1.nodeCount, invariants2.nodeCount);

        if (nodeRatio < this.config.minNodeRatio * 0.8) { // 🔥 Более мягкий порог для инвариантности
            return {
                pass: false,
                score: nodeRatio,
                reason: `Слишком разное количество узлов: ${invariants1.nodeCount} vs ${invariants2.nodeCount} (ratio: ${nodeRatio.toFixed(2)})`,
                confidence: 1 - nodeRatio
            };
        }

        // 2. 🔥 Проверка ИНВАРИАНТНЫХ свойств графа
        const invariantProperties = this.compareInvariantProperties(invariants1, invariants2);
       
        if (invariantProperties.score < 0.4) {
            return {
                pass: false,
                score: invariantProperties.score,
                reason: `Разные инвариантные свойства: ${invariantProperties.reason}`,
                confidence: invariantProperties.score
            };
        }

        // 3. Проверка плотности графа (инвариант)
        const densityDiff = Math.abs(invariants1.density - invariants2.density);
        if (densityDiff > 0.3) {
            const densityScore = 1 - Math.min(1, densityDiff);
            return {
                pass: false,
                score: densityScore,
                reason: `Слишком разная плотность графов: ${invariants1.density.toFixed(2)} vs ${invariants2.density.toFixed(2)}`,
                confidence: densityScore
            };
        }

        const quickScore = (nodeRatio + invariantProperties.score + (1 - densityDiff)) / 3;

        return {
            pass: true,
            score: quickScore,
            reason: 'Быстрая инвариантная проверка пройдена',
            confidence: quickScore,
            invariantProperties: invariantProperties
        };
    }

    // 🔥 НОВЫЙ МЕТОД: ИНВАРИАНТНЫЕ СВОЙСТВА
    compareInvariantProperties(invariants1, invariants2) {
        const comparisons = [];

        // 1. Средняя степень узла (инвариант)
        const degreeRatio = Math.min(invariants1.avgDegree, invariants2.avgDegree) /
                           Math.max(invariants1.avgDegree, invariants2.avgDegree);
        comparisons.push({ name: 'avgDegree', score: degreeRatio });

        // 2. Коэффициент кластеризации (инвариант)
        const clusteringDiff = Math.abs(invariants1.clusteringCoefficient - invariants2.clusteringCoefficient);
        const clusteringScore = 1 - Math.min(1, clusteringDiff / 0.3);
        comparisons.push({ name: 'clustering', score: clusteringScore });

        // 3. Диаметр графа (нормализованный)
        const diameterRatio = Math.min(invariants1.graphDiameter, invariants2.graphDiameter) /
                             Math.max(invariants1.graphDiameter, invariants2.graphDiameter);
        comparisons.push({ name: 'diameter', score: diameterRatio });

        const totalScore = comparisons.reduce((sum, comp) => sum + comp.score, 0) / comparisons.length;

        // Найти самую плохую оценку для объяснения
        const worst = comparisons.reduce((worst, current) =>
            current.score < worst.score ? current : worst);

        return {
            score: totalScore,
            reason: worst.score < 0.6 ? `Низкая схожесть по ${worst.name}: ${worst.score.toFixed(2)}` : 'OK',
            comparisons: comparisons
        };
    }

    // 🔥 НОВЫЙ МЕТОД: ИНВАРИАНТНОЕ СРАВНЕНИЕ ГРАФОВ
    compareGraphInvariants(graph1, graph2) {
        const invariants1 = graph1.getBasicInvariants();
        const invariants2 = graph2.getBasicInvariants();

        const comparisons = [];
        const metrics = {};

        // 1. Распределение степеней (уже есть, но улучшаем)
        comparisons.push({
            name: 'degreeDistribution',
            score: this.compareHistograms(
                invariants1.degreeHistogram.map(d => d.count),
                invariants2.degreeHistogram.map(d => d.count)
            )
        });

        // 2. Распределение длин рёбер (нормализованное)
        if (invariants1.normalizedMetrics?.normalizedEdgeLengths &&
            invariants2.normalizedMetrics?.normalizedEdgeLengths) {

            const score = this.compareHistograms(
                this.createHistogram(invariants1.normalizedMetrics.normalizedEdgeLengths, 8),
                this.createHistogram(invariants2.normalizedMetrics.normalizedEdgeLengths, 8)
            );
            comparisons.push({ name: 'edgeLengthDistribution', score: score });
            metrics.edgeLengthScore = score;
        }

        // 3. Распределение узлов (нормализованное)
        const nodeDistScore = this.compareNodeDistributions(graph1, graph2);
        comparisons.push({ name: 'nodeDistribution', score: nodeDistScore });
        metrics.nodeDistScore = nodeDistScore;

        // 4. Спектральные свойства графа (инвариант)
        const spectralScore = this.compareSpectralProperties(graph1, graph2);
        comparisons.push({ name: 'spectralProperties', score: spectralScore });
        metrics.spectralScore = spectralScore;

        // 5. Топологические инварианты
        const topologyScore = this.compareGraphTopology(graph1, graph2);
        comparisons.push({ name: 'topology', score: topologyScore.score });
        metrics.topologyScore = topologyScore.score;

        // 6. Нормализованная геометрия
        const geometryScore = this.compareNormalizedGeometry(graph1, graph2);
        comparisons.push({ name: 'normalizedGeometry', score: geometryScore.score });
        metrics.geometryScore = geometryScore.score;

        const totalScore = comparisons.reduce((sum, comp) => sum + comp.score, 0) / comparisons.length;

        return {
            score: totalScore,
            details: comparisons,
            metrics: metrics
        };
    }

    // 🔥 НОВЫЙ МЕТОД: СРАВНЕНИЕ РАСПРЕДЕЛЕНИЯ УЗЛОВ
    compareNodeDistributions(graph1, graph2) {
        const nodes1 = Array.from(graph1.nodes.values());
        const nodes2 = Array.from(graph2.nodes.values());

        // Нормализуем координаты
        const normalized1 = this.normalizeCoordinates(nodes1);
        const normalized2 = this.normalizeCoordinates(nodes2);

        // Разбиваем на квадранты и сравниваем распределение
        const quadrants1 = this.getQuadrantDistribution(normalized1);
        const quadrants2 = this.getQuadrantDistribution(normalized2);

        // Сравниваем распределение по квадрантам
        let diffSum = 0;
        for (let i = 0; i < 4; i++) {
            diffSum += Math.abs(quadrants1[i] - quadrants2[i]);
        }

        return Math.max(0, 1 - diffSum / 2);
    }

    // 🔥 НОВЫЙ МЕТОД: НОРМАЛИЗАЦИЯ КООРДИНАТ
    normalizeCoordinates(nodes) {
        if (nodes.length === 0) return [];

        const xs = nodes.map(n => n.x);
        const ys = nodes.map(n => n.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);

        return nodes.map(node => ({
            nx: (node.x - minX) / width,
            ny: (node.y - minY) / height,
            original: node
        }));
    }

    // 🔥 НОВЫЙ МЕТОД: РАСПРЕДЕЛЕНИЕ ПО КВАДРАНТАМ
    getQuadrantDistribution(nodes) {
        const quadrants = [0, 0, 0, 0];

        nodes.forEach(node => {
            if (node.nx < 0.5 && node.ny < 0.5) quadrants[0]++; // Левый верхний
            else if (node.nx >= 0.5 && node.ny < 0.5) quadrants[1]++; // Правый верхний
            else if (node.nx < 0.5 && node.ny >= 0.5) quadrants[2]++; // Левый нижний
            else quadrants[3]++; // Правый нижний
        });

        // Нормализуем к проценту
        const total = nodes.length || 1;
        return quadrants.map(q => q / total);
    }

    // 🔥 НОВЫЙ МЕТОД: СПЕКТРАЛЬНЫЕ СВОЙСТВА
    compareSpectralProperties(graph1, graph2) {
        // Упрощенная версия: сравниваем основные статистики
        const invariants1 = graph1.getBasicInvariants();
        const invariants2 = graph2.getBasicInvariants();

        let score = 0;
        let comparisons = 0;

        // 1. Сравниваем среднюю степень
        const degreeDiff = Math.abs(invariants1.avgDegree - invariants2.avgDegree);
        const maxDegree = Math.max(invariants1.avgDegree, invariants2.avgDegree);
        score += 1 - Math.min(1, degreeDiff / Math.max(1, maxDegree * 0.5));
        comparisons++;

        // 2. Сравниваем коэффициент асимметрии степени
        if (invariants1.degreeSkewness !== undefined && invariants2.degreeSkewness !== undefined) {
            const skewDiff = Math.abs(invariants1.degreeSkewness - invariants2.degreeSkewness);
            score += 1 - Math.min(1, skewDiff / 0.5);
            comparisons++;
        }

        // 3. Сравниваем ассортативность
        if (invariants1.assortativity !== undefined && invariants2.assortativity !== undefined) {
            const assortDiff = Math.abs(invariants1.assortativity - invariants2.assortativity);
            score += 1 - Math.min(1, assortDiff / 0.3);
            comparisons++;
        }

        return comparisons > 0 ? score / comparisons : 0.5;
    }

    // 🔥 НОВЫЙ МЕТОД: ТОПОЛОГИЧЕСКОЕ СРАВНЕНИЕ
    compareGraphTopology(graph1, graph2) {
        // Сравниваем не координаты, а структуру графа
        const metrics = [];

        // 1. Число компонент связности
        const components1 = this.countConnectedComponents(graph1);
        const components2 = this.countConnectedComponents(graph2);
        metrics.push({
            name: 'connectedComponents',
            score: 1 - Math.abs(components1 - components2) / Math.max(components1, components2, 1)
        });

        // 2. Циклы в графе
        const cycleScore = this.compareCycles(graph1, graph2);
        metrics.push({ name: 'cycles', score: cycleScore });

        // 3. Средняя длина пути
        const pathScore = this.compareAveragePathLength(graph1, graph2);
        metrics.push({ name: 'avgPathLength', score: pathScore });

        const totalScore = metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length;

        return {
            score: totalScore,
            metrics: metrics
        };
    }

    // 🔥 НОВЫЙ МЕТОД: НОРМАЛИЗОВАННАЯ ГЕОМЕТРИЯ
    compareNormalizedGeometry(graph1, graph2) {
        // Нормализуем координаты и сравниваем
        const normalized1 = this.normalizeCoordinates(Array.from(graph1.nodes.values()));
        const normalized2 = this.normalizeCoordinates(Array.from(graph2.nodes.values()));

        const comparisons = [];

        // 1. Относительные расстояния между узлами
        const relativeDistScore = this.compareRelativeDistances(normalized1, normalized2);
        comparisons.push({ name: 'relativeDistances', score: relativeDistScore });

        // 2. Углы между связями
        const angleScore = this.compareAngles(graph1, graph2);
        comparisons.push({ name: 'angles', score: angleScore });

        // 3. Форма (моменты)
        const momentScore = this.compareMoments(normalized1, normalized2);
        comparisons.push({ name: 'moments', score: momentScore });

        const totalScore = comparisons.reduce((sum, c) => sum + c.score, 0) / comparisons.length;

        return {
            score: totalScore,
            comparisons: comparisons
        };
    }

    // 🔥 НОВЫЙ МЕТОД: ИНВАРИАНТНЫЕ СОВПАДАЮЩИЕ ПАРЫ
    findInvariantMatchedPairs(graph1, graph2) {
        const pairs = [];

        if (!graph1 || !graph2 || !graph1.nodes || !graph2.nodes) {
            return pairs;
        }

        const nodes1 = Array.from(graph1.nodes.values());
        const nodes2 = Array.from(graph2.nodes.values());

        // Нормализуем координаты для инвариантного сравнения
        const normalized1 = this.normalizeCoordinates(nodes1);
        const normalized2 = this.normalizeCoordinates(nodes2);

        // 🔥 ИНВАРИАНТНЫЙ ПОРОГ: основан на относительных расстояниях
        const distanceThreshold = 0.2; // 20% от нормализованного размера

        const usedNodes2 = new Set();

        // Для каждого узла первого графа находим инвариантно-ближайший узел второго графа
        normalized1.forEach((node1, i) => {
            let bestMatch = null;
            let minDistance = Infinity;

            normalized2.forEach((node2, j) => {
                if (usedNodes2.has(j)) return;

                // 🔥 ИНВАРИАНТНОЕ РАССТОЯНИЕ: в нормализованном пространстве
                const dx = node1.nx - node2.nx;
                const dy = node1.ny - node2.ny;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance && distance < distanceThreshold) {
                    minDistance = distance;
                    bestMatch = {
                        node1: nodes1[i].id,
                        node2: nodes2[j].id,
                        distance: distance,
                        normalizedDistance: distance,
                        node1Data: {
                            x: nodes1[i].x,
                            y: nodes1[i].y,
                            nx: node1.nx,
                            ny: node1.ny
                        },
                        node2Data: {
                            x: nodes2[j].x,
                            y: nodes2[j].y,
                            nx: node2.nx,
                            ny: node2.ny
                        }
                    };
                }
            });

            if (bestMatch) {
                const node2Index = normalized2.findIndex(n => n.original.id === bestMatch.node2);
                if (node2Index !== -1) {
                    usedNodes2.add(node2Index);
                    pairs.push(bestMatch);
                }
            }
        });

        if (this.config.debug) {
            console.log(`✅ Найдено ${pairs.length} инвариантных совпадающих пар (порог: ${distanceThreshold})`);
        }

        return pairs;
    }

    // 🔥 НОВЫЙ МЕТОД: ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ИНВАРИАНТНОСТИ
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

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: alignAndCompare для совместимости
    alignAndCompare(graph1, graph2, options = {}) {
        // Используем улучшенный метод сравнения с инвариантностью
        const result = this.compareGraphs(graph1, graph2, options);

        return result;
    }

    // 🔥 АДАПТИВНОЕ СРАВНЕНИЕ ДЛЯ РАЗНЫХ РАЗМЕРОВ
    adaptiveCompare(graph1, graph2, options = {}) {
        const startTime = Date.now();

        const invariants1 = graph1.getBasicInvariants();
        const invariants2 = graph2.getBasicInvariants();

        // 🔥 АДАПТИВНЫЙ ПОРОГ: учитываем размеры
        const sizeRatio = Math.min(invariants1.nodeCount, invariants2.nodeCount) /
                         Math.max(invariants1.nodeCount, invariants2.nodeCount);

        console.log(`📏 Адаптивное сравнение: ${invariants1.nodeCount} vs ${invariants2.nodeCount} узлов (ratio: ${sizeRatio.toFixed(2)})`);

        // Адаптивные пороги для разных размеров
        let similarityThreshold = this.config.sameThreshold;
        let similarThreshold = this.config.similarThreshold;

        if (sizeRatio < 0.7) {
            // Для разных размеров снижаем пороги
            similarityThreshold *= 0.9; // 0.63 вместо 0.7
            similarThreshold *= 0.8;    // 0.32 вместо 0.4
            console.log(`🎯 Адаптивные пороги: same=${similarityThreshold.toFixed(2)}, similar=${similarThreshold.toFixed(2)}`);
        }

        // 🔥 ИСПОЛЬЗУЕМ ИНВАРИАНТНЫЕ МЕТРИКИ
        const invariantComparison = this.compareGraphInvariants(graph1, graph2);
        const matchedPairs = this.findInvariantMatchedPairs(graph1, graph2);

        // 🔥 КОМБИНИРОВАННЫЙ SCORE с учетом инвариантности
        const matchRatio = matchedPairs.length / Math.max(invariants1.nodeCount, invariants2.nodeCount, 1);
        const invariantScore = invariantComparison.score;
       
        const finalScore = (invariantScore * 0.7) + (matchRatio * 0.3);

        // Принимаем решение
        let decision, reason;
        if (finalScore > similarityThreshold) {
            decision = 'same';
            reason = `Следы похожи (${finalScore.toFixed(3)}) несмотря на разный размер (ratio: ${sizeRatio.toFixed(2)})`;
        } else if (finalScore > similarThreshold) {
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
            sizeRatio: sizeRatio,
            matchRatio: matchRatio,
            invariantScore: invariantScore,
            matchedPairs: matchedPairs,
            timeMs: Date.now() - startTime
        };
    }

    // 🔥 НОВЫЙ МЕТОД: РАСЧЕТ ИТОГОВОГО SCORE С ИНВАРИАНТНОСТЬЮ
    calculateInvariantFinalScore(basicComparison, detailedComparison, invariantComparison, matchedPairs) {
        const basicWeight = this.config.weights.basicInvariants;
        const detailedWeight = detailedComparison.score > 0 ?
            this.config.weights.degreeDistribution +
            this.config.weights.edgeLengths +
            this.config.weights.structure : 0;
        const invariantWeight = this.config.weights.invariantFeatures;

        const totalWeight = basicWeight + detailedWeight + invariantWeight;

        if (totalWeight === 0) {
            return basicComparison.score;
        }

        const basicPart = basicComparison.score * basicWeight;
        const detailedPart = detailedComparison.score * detailedWeight;
        const invariantPart = invariantComparison.score * invariantWeight;

        // 🔥 ДОБАВЛЯЕМ ВЛИЯНИЕ СОВПАДАЮЩИХ ПАР
        const matchScore = matchedPairs.length > 0 ?
            Math.min(1, matchedPairs.length / Math.max(basicComparison.details?.nodeCount1 || 10, 10)) : 0;
        const matchWeight = 0.2; // 20% влияния совпадающих пар

        const finalScore = (basicPart + detailedPart + invariantPart + (matchScore * matchWeight)) /
                          (totalWeight + matchWeight);

        return Math.min(1, Math.max(0, finalScore));
    }

    // 🔥 НОВЫЙ МЕТОД: ПРИНЯТИЕ РЕШЕНИЯ С ИНВАРИАНТНОСТЬЮ
    makeInvariantDecision(score, comparisonData) {
        const { matchedPairs, basicComparison, invariantComparison } = comparisonData;
       
        // 🔥 АДАПТИВНЫЕ ПОРОГИ с учетом инвариантных совпадений
        let effectiveThreshold = this.config.sameThreshold;
        let effectiveSimilarThreshold = this.config.similarThreshold;

        // Если много инвариантных совпадений, снижаем порог
        const matchRatio = matchedPairs.length / Math.max(basicComparison.details?.nodeCount1 || 10, 10);
        if (matchRatio > 0.6 && invariantComparison.score > 0.7) {
            effectiveThreshold *= 0.9; // Снижаем порог на 10%
            effectiveSimilarThreshold *= 0.8; // Снижаем порог на 20%
        }

        if (score >= effectiveThreshold) {
            return {
                type: 'same',
                reason: `Высокая инвариантная схожесть (${score.toFixed(3)}), ${matchedPairs.length} совпадающих пар`,
                confidence: score * (1 + matchRatio * 0.2) // Увеличиваем уверенность при совпадениях
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
            if (comparisonData.invariantComparison && comparisonData.invariantComparison.details) {
                const worst = comparisonData.invariantComparison.details
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

    // ============ СУЩЕСТВУЮЩИЕ МЕТОДЫ ============

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

    calculateMean(values) {
        if (!values || values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    calculateStdDev(values, mean) {
        if (!values || values.length < 2) return 0;
        const squareDiffs = values.map(val => Math.pow(val - mean, 2));
        return Math.sqrt(squareDiffs.reduce((sum, val) => sum + val, 0) / values.length);
    }

    calculateCenterOfMass(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };

        const sumX = points.reduce((sum, p) => sum + (p.nx || p.x || 0), 0);
        const sumY = points.reduce((sum, p) => sum + (p.ny || p.y || 0), 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ИНВАРИАНТНОСТИ
    countConnectedComponents(graph) {
        // Упрощенная версия: считаем узлы с ребрами
        let components = 0;
        const visited = new Set();
       
        graph.nodes.forEach((node, nodeId) => {
            if (!visited.has(nodeId) && graph.edges.size > 0) {
                components++;
                visited.add(nodeId);
            }
        });
       
        return Math.max(1, components);
    }

    compareCycles(graph1, graph2) {
        // Упрощенная версия: сравниваем количество треугольников
        const cycles1 = this.countTriangles(graph1);
        const cycles2 = this.countTriangles(graph2);
       
        const maxCycles = Math.max(cycles1, cycles2, 1);
        return 1 - Math.abs(cycles1 - cycles2) / maxCycles;
    }

    countTriangles(graph) {
        let triangles = 0;
        const nodes = Array.from(graph.nodes.keys());
       
        // Упрощенный подсчет треугольников
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                for (let k = j + 1; k < nodes.length; k++) {
                    if (graph.hasEdge(nodes[i], nodes[j]) &&
                        graph.hasEdge(nodes[j], nodes[k]) &&
                        graph.hasEdge(nodes[k], nodes[i])) {
                        triangles++;
                    }
                }
            }
        }
       
        return triangles;
    }

    compareAveragePathLength(graph1, graph2) {
        // Упрощенная версия: используем диаметр как показатель
        const invariants1 = graph1.getBasicInvariants();
        const invariants2 = graph2.getBasicInvariants();
       
        const ratio = Math.min(invariants1.graphDiameter, invariants2.graphDiameter) /
                     Math.max(invariants1.graphDiameter, invariants2.graphDiameter, 1);
        return ratio;
    }

    compareRelativeDistances(normalized1, normalized2) {
        if (normalized1.length < 3 || normalized2.length < 3) return 0.5;
       
        // Сравниваем относительные расстояния между точками
        const distances1 = this.calculateRelativeDistances(normalized1);
        const distances2 = this.calculateRelativeDistances(normalized2);
       
        return this.compareHistograms(
            this.createHistogram(distances1, 5),
            this.createHistogram(distances2, 5)
        );
    }

    calculateRelativeDistances(points) {
        const distances = [];
       
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dx = points[i].nx - points[j].nx;
                const dy = points[i].ny - points[j].ny;
                distances.push(Math.sqrt(dx * dx + dy * dy));
            }
        }
       
        return distances;
    }

    compareAngles(graph1, graph2) {
        // Упрощенная версия: сравниваем углы между ребрами
        const angles1 = this.collectEdgeAngles(graph1);
        const angles2 = this.collectEdgeAngles(graph2);
       
        if (angles1.length === 0 || angles2.length === 0) return 0.5;
       
        return this.compareHistograms(
            this.createHistogram(angles1, 8),
            this.createHistogram(angles2, 8)
        );
    }

    collectEdgeAngles(graph) {
        const angles = [];
       
        graph.edges.forEach(edge => {
            const node1 = graph.nodes.get(edge.from);
            const node2 = graph.nodes.get(edge.to);
           
            if (node1 && node2) {
                const angle = Math.atan2(node2.y - node1.y, node2.x - node1.x);
                angles.push(angle);
            }
        });
       
        return angles;
    }

    compareMoments(normalized1, normalized2) {
        // Упрощенная версия: сравниваем первые моменты
        const moment1 = this.calculateCentralMoments(normalized1);
        const moment2 = this.calculateCentralMoments(normalized2);
       
        let score = 0;
        const moments = ['meanX', 'meanY', 'varX', 'varY'];
       
        moments.forEach(moment => {
            const diff = Math.abs(moment1[moment] - moment2[moment]);
            score += 1 - Math.min(1, diff / 0.3);
        });
       
        return score / moments.length;
    }

    calculateCentralMoments(points) {
        if (points.length === 0) return { meanX: 0, meanY: 0, varX: 0, varY: 0 };
       
        const meanX = points.reduce((sum, p) => sum + p.nx, 0) / points.length;
        const meanY = points.reduce((sum, p) => sum + p.ny, 0) / points.length;
       
        const varX = points.reduce((sum, p) => sum + Math.pow(p.nx - meanX, 2), 0) / points.length;
        const varY = points.reduce((sum, p) => sum + Math.pow(p.ny - meanY, 2), 0) / points.length;
       
        return { meanX, meanY, varX, varY };
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
            reason: result.reason,
            matchedPairs: result.matchedPairs
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
