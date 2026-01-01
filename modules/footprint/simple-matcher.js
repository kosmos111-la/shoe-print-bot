// modules/footprint/simple-matcher.js
// УМНЫЙ СРАВНИТЕЛЬ ГРАФОВ - СЕРДЦЕ СИСТЕМЫ

const TransformationManager = require('./transformation-manager');

class SimpleGraphMatcher {
    constructor(options = {}) {
        this.config = {
            // Пороги для принятия решений
            sameThreshold: options.sameThreshold || 0.7,
            similarThreshold: options.similarThreshold || 0.4,
            minNodeRatio: options.minNodeRatio || 0.7,
            maxNodeDiff: options.maxNodeDiff || 0.3,

            // Веса для разных типов сравнений
            weights: {
                basicInvariants: options.weights?.basicInvariants || 0.4,
                degreeDistribution: options.weights?.degreeDistribution || 0.3,
                edgeLengths: options.weights?.edgeLengths || 0.2,
                structure: options.weights?.structure || 0.1
            },

            // Настройки трансформаций
            enableTransformations: options.enableTransformations !== false,
            maxTransformationError: options.maxTransformationError || 30,
            enableAdaptiveComparison: options.enableAdaptiveComparison !== false,

            // Дополнительные настройки
            enableDetailedMatch: options.enableDetailedMatch !== false,
            debug: options.debug || false
        };

        // 🔥 Менеджер трансформаций
        this.transformationManager = new TransformationManager({
            debug: this.config.debug
        });

        // 🔥 Кэш трансформаций
        this.transformationsCache = new Map(); // graphId_pair -> transformation

        this.matchHistory = [];
        console.log('🎯 Инициализирован SimpleGraphMatcher с поддержкой трансформаций');
    }

    // 🔥 ОСНОВНОЙ МЕТОД: СРАВНИТЬ С ВЫРАВНИВАНИЕМ И ТРАНСФОРМАЦИЯМИ
    alignAndCompare(graph1, graph2, options = {}) {
        const startTime = Date.now();

        if (this.config.debug) {
            console.log(`🔍 Сравниваю с выравниванием: "${graph1.name || 'Graph1'}" vs "${graph2.name || 'Graph2'}"`);
            console.log(`   Граф 1: ${graph1.nodes.size} узлов, ${graph1.edges.size} рёбер`);
            console.log(`   Граф 2: ${graph2.nodes.size} узлов, ${graph2.edges.size} рёбер`);
        }

        // 🔥 ШАГ 1: Быстрая проверка (отсев явно разных следов)
        const quickCheck = this.quickCheck(graph1, graph2);

        if (!quickCheck.pass && quickCheck.score < 0.3) {
            const result = {
                similarity: quickCheck.score,
                decision: 'different',
                reason: quickCheck.reason,
                steps: ['quick_check_failed'],
                confidence: quickCheck.confidence,
                timeMs: Date.now() - startTime,
                matchedPairs: []
            };

            this.recordMatch(result, options);
            return result;
        }

        // 🔥 ШАГ 2: Сравнение в инвариантном пространстве
        const invariantComparison = this.compareInvariantStructures(graph1, graph2);

        if (this.config.debug) {
            console.log(`📊 Инвариантное сравнение: ${invariantComparison.similarity.toFixed(3)}`);
            console.log(`   Длины рёбер: ${invariantComparison.edgeLengthSimilarity?.toFixed(3)}`);
            console.log(`   Распределение степеней: ${invariantComparison.degreeSimilarity?.toFixed(3)}`);
            console.log(`   Коэффициент кластеризации: ${invariantComparison.clusteringSimilarity?.toFixed(3)}`);
        }

        // 🔥 ШАГ 3: Если достаточно похожи - ищем трансформацию
        let transformation = null;
        let matchedPairs = [];
        let transformedGraph2 = null;

        if (invariantComparison.similarity > 0.5 && this.config.enableTransformations) {
            // 🔥 Находим трансформацию в инвариантном пространстве
            transformation = this.transformationManager.findTransformationInInvariantSpace(
                graph1, graph2
            );

            if (transformation && transformation.error < this.config.maxTransformationError) {
                if (this.config.debug) {
                    console.log(`🎯 Найдена трансформация:`);
                    console.log(`   Масштаб: ${transformation.scale.toFixed(3)}`);
                    console.log(`   Поворот: ${(transformation.rotation * 180 / Math.PI).toFixed(1)}°`);
                    console.log(`   Смещение: (${transformation.dx.toFixed(1)}, ${transformation.dy.toFixed(1)})`);
                    console.log(`   Ошибка: ${transformation.error.toFixed(2)}`);
                }

                // 🔥 Применяем трансформацию
                transformedGraph2 = this.transformationManager.applyTransformationToGraph(
                    graph2, transformation
                );

                // 🔥 Ищем совпадения в одной системе координат
                matchedPairs = this.findMatchedPairs(graph1, transformedGraph2);

                if (this.config.debug) {
                    console.log(`✅ После трансформации найдено ${matchedPairs.length} совпавших пар`);
                }

                // 🔥 Кэшируем трансформацию
                const cacheKey = `${graph1.id || 'g1'}_${graph2.id || 'g2'}`;
                this.transformationsCache.set(cacheKey, transformation);
            } else {
                console.log(`⚠️ Трансформация не найдена или ошибка слишком велика: ${transformation?.error || 'N/A'}`);
            }
        }

        // 🔥 ШАГ 4: Если не удалось найти трансформацию, используем адаптивное сравнение
        let finalSimilarity;
        let decision;

        if (matchedPairs.length > 0) {
            // 🔥 Рассчитываем схожесть с учетом совпавших пар
            finalSimilarity = this.calculateSimilarityWithMatches(
                invariantComparison,
                matchedPairs.length,
                Math.min(graph1.nodes.size, graph2.nodes.size),
                transformation
            );
        } else {
            // 🔥 Используем адаптивное сравнение
            if (this.config.enableAdaptiveComparison) {
                const adaptiveResult = this.adaptiveCompare(graph1, graph2, options);
                finalSimilarity = adaptiveResult.similarity;
                decision = adaptiveResult.decision;
                matchedPairs = adaptiveResult.matchedPairs || [];
            } else {
                // Стандартное сравнение
                const basicComparison = this.compareBasicInvariants(graph1, graph2);
                finalSimilarity = basicComparison.score;
            }
        }

        // 🔥 ШАГ 5: Принимаем решение
        if (!decision) {
            decision = this.makeDecision(finalSimilarity, {
                invariantComparison,
                matchedPairsCount: matchedPairs.length,
                transformation: transformation
            });
        }

        const result = {
            similarity: finalSimilarity,
            decision: decision.type,
            reason: decision.reason,
            confidence: decision.confidence,
            matchedPairs: matchedPairs,
            transformation: transformation,
            invariantComparison: invariantComparison,
            transformedGraph: transformedGraph2,
            steps: ['quick_check', 'invariant_comparison',
                   ...(transformation ? ['transformation_found'] : []),
                   ...(matchedPairs.length > 0 ? ['detailed_matching'] : [])],
            timeMs: Date.now() - startTime,
            context: options
        };

        // Записываем в историю
        this.recordMatch(result, options);

        if (this.config.debug) {
            console.log(`📊 Результат: ${finalSimilarity.toFixed(3)} (${decision.type})`);
            console.log(`   Причина: ${decision.reason}`);
            console.log(`   Время: ${result.timeMs}мс`);
            console.log(`   Совпавших пар: ${matchedPairs.length}`);
        }

        return result;
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение инвариантных структур
    compareInvariantStructures(graph1, graph2) {
        // Получаем базовые инварианты
        const invariants1 = graph1.getBasicInvariants ? graph1.getBasicInvariants() : this.extractBasicInvariants(graph1);
        const invariants2 = graph2.getBasicInvariants ? graph2.getBasicInvariants() : this.extractBasicInvariants(graph2);

        // 1. Сравнение нормализованных длин рёбер
        let edgeLengthSimilarity = 0.5;
        if (invariants1.edgeLengthHistogram && invariants2.edgeLengthHistogram) {
            const normalizedEdgeLengths1 = this.normalizeHistogram(invariants1.edgeLengthHistogram);
            const normalizedEdgeLengths2 = this.normalizeHistogram(invariants2.edgeLengthHistogram);
            edgeLengthSimilarity = this.compareNormalizedDistributions(
                normalizedEdgeLengths1, normalizedEdgeLengths2
            );
        }

        // 2. Сравнение распределения степеней
        let degreeSimilarity = 0.5;
        if (invariants1.degreeHistogram && invariants2.degreeHistogram) {
            degreeSimilarity = this.compareHistograms(
                invariants1.degreeHistogram, invariants2.degreeHistogram
            );
        }

        // 3. Сравнение коэффициента кластеризации
        let clusteringSimilarity = 0.5;
        if (invariants1.clusteringCoefficient !== undefined &&
            invariants2.clusteringCoefficient !== undefined) {
            clusteringSimilarity = 1 - Math.min(1,
                Math.abs(invariants1.clusteringCoefficient - invariants2.clusteringCoefficient) / 0.3
            );
        }

        // 4. Сравнение количества узлов (нормализованное)
        const nodeSimilarity = Math.min(invariants1.nodeCount, invariants2.nodeCount) /
                             Math.max(invariants1.nodeCount, invariants2.nodeCount);

        // Общая схожесть (взвешенная)
        const totalSimilarity = (
            edgeLengthSimilarity * 0.3 +
            degreeSimilarity * 0.25 +
            clusteringSimilarity * 0.2 +
            nodeSimilarity * 0.25
        );

        return {
            similarity: totalSimilarity,
            edgeLengthSimilarity: edgeLengthSimilarity,
            degreeSimilarity: degreeSimilarity,
            clusteringSimilarity: clusteringSimilarity,
            nodeSimilarity: nodeSimilarity
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Рассчитать схожесть с учетом совпавших пар
    calculateSimilarityWithMatches(invariantComparison, matchedPairsCount, minNodeCount, transformation) {
        if (minNodeCount === 0) return 0;

        // Базовый вес инвариантов
        let baseSimilarity = invariantComparison.similarity;

        // Вес совпавших пар (до 40% от общей схожести)
        const matchRatio = matchedPairsCount / minNodeCount;
        const matchBonus = Math.min(0.4, matchRatio * 0.6);

        // Бонус за качественную трансформацию
        let transformationBonus = 0;
        if (transformation && transformation.error < 20) {
            transformationBonus = 0.1 * (1 - transformation.error / 100);
        }

        // Итоговая схожесть
        const finalSimilarity = Math.min(1,
            baseSimilarity * 0.6 +
            matchBonus * 0.3 +
            transformationBonus * 0.1
        );

        return finalSimilarity;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Нормализовать гистограмму
    normalizeHistogram(histogram) {
        if (!histogram || histogram.length === 0) return [];
       
        const sum = histogram.reduce((s, val) => s + val, 0);
        if (sum === 0) return histogram;
       
        return histogram.map(val => val / sum);
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Сравнить нормализованные распределения
    compareNormalizedDistributions(dist1, dist2) {
        if (!dist1 || !dist2 || dist1.length !== dist2.length) return 0;
       
        let totalDiff = 0;
        const n = Math.min(dist1.length, dist2.length);
       
        for (let i = 0; i < n; i++) {
            totalDiff += Math.abs((dist1[i] || 0) - (dist2[i] || 0));
        }
       
        return 1 - Math.min(1, totalDiff / n);
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: найти совпадающие пары узлов
    findMatchedPairs(graph1, graph2, options = {}) {
        const pairs = [];

        if (!graph1 || !graph2 || !graph1.nodes || !graph2.nodes) {
            return pairs;
        }

        const nodes1 = Array.from(graph1.nodes.values());
        const nodes2 = Array.from(graph2.nodes.values());

        // 🔥 АДАПТИВНЫЙ ПОРОГ
        const sizeRatio = Math.min(nodes1.length, nodes2.length) / Math.max(nodes1.length, nodes2.length);
        let distanceThreshold = options.distanceThreshold || 30;

        // Увеличиваем порог для разных размеров
        if (sizeRatio < 0.7) {
            distanceThreshold = 50;
        }

        // 🔥 Используем принцип "каждой точке - ближайшая"
        const usedNodes2 = new Set();

        // Для каждого узла первого графа находим ближайший узел второго графа
        nodes1.forEach((node1, i) => {
            let bestMatch = null;
            let minDistance = Infinity;

            nodes2.forEach((node2, j) => {
                if (usedNodes2.has(j)) return;

                const dx = node1.x - node2.x;
                const dy = node1.y - node2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance && distance < distanceThreshold) {
                    minDistance = distance;
                    bestMatch = {
                        node1: node1.id,
                        node2: node2.id,
                        distance: distance,
                        node1Data: { x: node1.x, y: node1.y, confidence: node1.confidence },
                        node2Data: { x: node2.x, y: node2.y, confidence: node2.confidence }
                    };
                }
            });

            if (bestMatch) {
                const node2Index = nodes2.findIndex(n => n.id === bestMatch.node2);
                if (node2Index !== -1) {
                    usedNodes2.add(node2Index);
                    pairs.push(bestMatch);
                }
            }
        });

        return pairs;
    }

    // 🔥 НОВЫЙ МЕТОД: Адаптивное сравнение для разных размеров
    adaptiveCompare(graph1, graph2, options = {}) {
        const startTime = Date.now();

        const invariants1 = graph1.getBasicInvariants ? graph1.getBasicInvariants() : this.extractBasicInvariants(graph1);
        const invariants2 = graph2.getBasicInvariants ? graph2.getBasicInvariants() : this.extractBasicInvariants(graph2);

        // Адаптивный порог
        const sizeRatio = Math.min(invariants1.nodeCount, invariants2.nodeCount) /
                         Math.max(invariants1.nodeCount, invariants2.nodeCount);

        // Адаптивные пороги для разных размеров
        let similarityThreshold = this.config.sameThreshold;
        let similarThreshold = this.config.similarThreshold;

        if (sizeRatio < 0.7) {
            similarityThreshold *= 0.9;
            similarThreshold *= 0.8;
        }

        // Сравниваем основные инварианты
        const comparisons = [];

        // 1. Сравнение количества узлов
        const nodeScore = sizeRatio;
        comparisons.push({ name: 'nodeCount', score: nodeScore });

        // 2. Сравнение центров масс
        const center1 = this.calculateCenterOfMass(Array.from(graph1.nodes.values()));
        const center2 = this.calculateCenterOfMass(Array.from(graph2.nodes.values()));
        const centerDistance = Math.sqrt(
            Math.pow(center2.x - center1.x, 2) +
            Math.pow(center2.y - center1.y, 2)
        );
        const centerScore = Math.max(0, 1 - centerDistance / 100);
        comparisons.push({ name: 'centerDistance', score: centerScore });

        // 3. Сравнение распределения узлов
        const distributionScore = this.compareDistributions(graph1, graph2);
        comparisons.push({ name: 'distribution', score: distributionScore });

        // 4. Сравнение инвариантных структур
        const invariantScore = this.compareInvariantStructures(graph1, graph2).similarity;
        comparisons.push({ name: 'invariant', score: invariantScore });

        // Общая схожесть
        const totalScore = comparisons.reduce((sum, comp) => sum + comp.score, 0) / comparisons.length;

        // Принимаем решение
        let decision, reason;
        if (totalScore > similarityThreshold) {
            decision = 'same';
            reason = `Следы похожи (${totalScore.toFixed(3)})`;
        } else if (totalScore > similarThreshold) {
            decision = 'similar';
            reason = `Умеренная схожесть (${totalScore.toFixed(3)})`;
        } else {
            decision = 'different';
            reason = `Низкая схожесть (${totalScore.toFixed(3)})`;
        }

        return {
            similarity: totalScore,
            decision: decision,
            reason: reason,
            sizeRatio: sizeRatio,
            comparisons: comparisons,
            matchedPairs: this.findMatchedPairs(graph1, graph2),
            timeMs: Date.now() - startTime
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Извлечь базовые инварианты
    extractBasicInvariants(graph) {
        const nodes = Array.from(graph.nodes.values());
        const edges = Array.from(graph.edges.values());
       
        // Рассчитываем степени узлов
        const degreeMap = new Map();
        nodes.forEach(node => degreeMap.set(node.id, 0));
       
        edges.forEach(edge => {
            degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
            degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
        });
       
        const degrees = Array.from(degreeMap.values());
        const avgDegree = degrees.reduce((sum, d) => sum + d, 0) / degrees.length;
       
        // Гистограмма степеней
        const maxDegree = Math.max(...degrees, 0);
        const degreeHistogram = new Array(maxDegree + 1).fill(0);
        degrees.forEach(d => degreeHistogram[d] = (degreeHistogram[d] || 0) + 1);
       
        // Длины рёбер
        const edgeLengths = edges.map(edge => {
            const node1 = graph.nodes.get(edge.source);
            const node2 = graph.nodes.get(edge.target);
            if (!node1 || !node2) return 0;
           
            const dx = node1.x - node2.x;
            const dy = node1.y - node2.y;
            return Math.sqrt(dx * dx + dy * dy);
        });
       
        // Гистограмма длин рёбер
        const maxEdgeLength = Math.max(...edgeLengths, 1);
        const edgeLengthHistogram = new Array(10).fill(0);
        edgeLengths.forEach(length => {
            const bin = Math.min(9, Math.floor((length / maxEdgeLength) * 10));
            edgeLengthHistogram[bin] = (edgeLengthHistogram[bin] || 0) + 1;
        });
       
        return {
            nodeCount: nodes.length,
            edgeCount: edges.length,
            avgDegree: avgDegree,
            degreeHistogram: degreeHistogram,
            edgeLengthHistogram: edgeLengthHistogram,
            clusteringCoefficient: this.calculateClusteringCoefficient(graph),
            graphDiameter: this.calculateGraphDiameter(graph)
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Коэффициент кластеризации
    calculateClusteringCoefficient(graph) {
        const nodes = Array.from(graph.nodes.values());
        let totalCoefficient = 0;
        let validNodes = 0;
       
        nodes.forEach(node => {
            const neighbors = this.getNeighbors(graph, node.id);
            const k = neighbors.length;
           
            if (k < 2) {
                totalCoefficient += 0;
                validNodes++;
                return;
            }
           
            // Считаем рёбра между соседями
            let edgesBetweenNeighbors = 0;
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    if (this.hasEdge(graph, neighbors[i], neighbors[j])) {
                        edgesBetweenNeighbors++;
                    }
                }
            }
           
            const possibleEdges = k * (k - 1) / 2;
            const coefficient = possibleEdges > 0 ? edgesBetweenNeighbors / possibleEdges : 0;
           
            totalCoefficient += coefficient;
            validNodes++;
        });
       
        return validNodes > 0 ? totalCoefficient / validNodes : 0;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Диаметр графа
    calculateGraphDiameter(graph) {
        const nodes = Array.from(graph.nodes.values());
        let maxDistance = 0;
       
        // Упрощенный расчет - максимальное расстояние между узлами
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                maxDistance = Math.max(maxDistance, distance);
            }
        }
       
        return maxDistance;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ для работы с графом
    getNeighbors(graph, nodeId) {
        const neighbors = [];
        const edges = Array.from(graph.edges.values());
       
        edges.forEach(edge => {
            if (edge.source === nodeId && !neighbors.includes(edge.target)) {
                neighbors.push(edge.target);
            }
            if (edge.target === nodeId && !neighbors.includes(edge.source)) {
                neighbors.push(edge.source);
            }
        });
       
        return neighbors;
    }

    hasEdge(graph, node1Id, node2Id) {
        const edges = Array.from(graph.edges.values());
        return edges.some(edge =>
            (edge.source === node1Id && edge.target === node2Id) ||
            (edge.source === node2Id && edge.target === node1Id)
        );
    }

    // Остальные методы (quickCheck, compareBasicInvariants и т.д.) остаются как в вашем исходном коде
    // Добавляем только недостающие методы для совместимости:

    // 1. ОСНОВНОЙ МЕТОД ДЛЯ СОВМЕСТИМОСТИ: СРАВНИТЬ ДВА ГРАФА
    compareGraphs(graph1, graph2, context = {}) {
        // Используем новый метод alignAndCompare для сохранения совместимости
        return this.alignAndCompare(graph1, graph2, context);
    }

    // 2. Сравнение распределений (для адаптивного сравнения)
    compareDistributions(graph1, graph2) {
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

    // 3. Нормализация координат
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
            ny: (node.y - minY) / height
        }));
    }

    // 4. Распределение по квадрантам
    getQuadrantDistribution(nodes) {
        const quadrants = [0, 0, 0, 0];

        nodes.forEach(node => {
            if (node.nx < 0.5 && node.ny < 0.5) quadrants[0]++; // Левый верхний
            else if (node.nx >= 0.5 && node.ny < 0.5) quadrants[1]++; // Правый верхный
            else if (node.nx < 0.5 && node.ny >= 0.5) quadrants[2]++; // Левый нижний
            else quadrants[3]++; // Правый нижний
        });

        // Нормализуем к проценту
        const total = nodes.length || 1;
        return quadrants.map(q => q / total);
    }

    // 5. Быстрая проверка (остается без изменений)
    quickCheck(graph1, graph2) {
        const invariants1 = graph1.getBasicInvariants ? graph1.getBasicInvariants() : this.extractBasicInvariants(graph1);
        const invariants2 = graph2.getBasicInvariants ? graph2.getBasicInvariants() : this.extractBasicInvariants(graph2);

        // Проверка количества узлов
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

        // Проверка количества рёбер
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

        const quickScore = (nodeRatio + edgeRatio) / 2;

        return {
            pass: true,
            score: quickScore,
            reason: 'Быстрая проверка пройдена',
            confidence: quickScore
        };
    }

    // 6. Сравнение базовых инвариантов (упрощенная версия для совместимости)
    compareBasicInvariants(graph1, graph2) {
        const invariantComparison = this.compareInvariantStructures(graph1, graph2);
       
        return {
            score: invariantComparison.similarity,
            comparisons: [
                { name: 'edgeLength', score: invariantComparison.edgeLengthSimilarity },
                { name: 'degree', score: invariantComparison.degreeSimilarity },
                { name: 'clustering', score: invariantComparison.clusteringSimilarity },
                { name: 'nodeCount', score: invariantComparison.nodeSimilarity }
            ],
            details: {
                nodeCount1: graph1.nodes.size,
                nodeCount2: graph2.nodes.size
            }
        };
    }

    // 7. Рассчитать центр масс
    calculateCenterOfMass(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };

        const sumX = points.reduce((sum, p) => sum + (p.nx || p.x || 0), 0);
        const sumY = points.reduce((sum, p) => sum + (p.ny || p.y || 0), 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    // 8. Сравнить гистограммы
    compareHistograms(hist1, hist2) {
        if (!hist1 || !hist2) return 0;

        const maxLength = Math.max(hist1.length, hist2.length);
        let totalDiff = 0;
       
        for (let i = 0; i < maxLength; i++) {
            const val1 = hist1[i] || 0;
            const val2 = hist2[i] || 0;
            const maxVal = Math.max(val1, val2, 1);
            totalDiff += Math.abs(val1 - val2) / maxVal;
        }

        return 1 - Math.min(1, totalDiff / maxLength);
    }

    // 9. Принять решение
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

            if (comparisonData.invariantComparison) {
                const worst = [
                    { name: 'edgeLength', score: comparisonData.invariantComparison.edgeLengthSimilarity },
                    { name: 'degree', score: comparisonData.invariantComparison.degreeSimilarity },
                    { name: 'clustering', score: comparisonData.invariantComparison.clusteringSimilarity }
                ].reduce((worst, current) => current.score < worst.score ? current : worst);

                if (worst.score < 0.4) {
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

    // 10. Записать результат сравнения
    recordMatch(result, context) {
        const record = {
            timestamp: new Date(),
            similarity: result.similarity,
            decision: result.decision,
            confidence: result.confidence,
            timeMs: result.timeMs,
            context: context,
            details: {
                steps: result.steps,
                matchedPairs: result.matchedPairs?.length || 0
            }
        };

        this.matchHistory.push(record);

        if (this.matchHistory.length > 100) {
            this.matchHistory.shift();
        }
    }

    // 11. Проверить, одна ли это обувь?
    isSameShoe(graph1, graph2) {
        const result = this.compareGraphs(graph1, graph2, { checkType: 'isSameShoe' });
        return {
            isSame: result.decision === 'same',
            similarity: result.similarity,
            confidence: result.confidence,
            reason: result.reason
        };
    }

    // 12. Получить статистику матчера
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
            transformationCacheSize: this.transformationsCache.size,
            config: this.config
        };
    }
}

module.exports = SimpleGraphMatcher;
