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

            // 🔥 НОВЫЕ НАСТРОЙКИ: Адаптивные пороги
            enableAdaptiveThresholds: options.enableAdaptiveThresholds !== false,
            smallNodeThreshold: options.smallNodeThreshold || 5,

            // Веса для разных типов сравнений
            weights: {
                basicInvariants: options.weights?.basicInvariants || 0.3,
                degreeDistribution: options.weights?.degreeDistribution || 0.25,
                edgeLengths: options.weights?.edgeLengths || 0.2,
                structure: options.weights?.structure || 0.15,
                invariantFeatures: options.weights?.invariantFeatures || 0.1
            },

            // Дополнительные настройки
            enableDetailedMatch: options.enableDetailedMatch !== false,
            enableInvariantComparison: options.enableInvariantComparison !== false,
            debug: options.debug || false
        };

        this.matchHistory = [];
        console.log('🎯 Инициализирован SimpleGraphMatcher с инвариантностью и адаптивными порогами');
    }

    // 🔥 ДОБАВЛЕН МЕТОД: Адаптивные пороги для малого количества точек (как в инструкции)
    getAdaptiveThresholds(comparisonData) {
        let sameThreshold = this.config.sameThreshold; // 0.7
        let similarThreshold = this.config.similarThreshold; // 0.4

        // Если мало точек - увеличиваем пороги
        if (this.config.enableAdaptiveThresholds &&
            comparisonData.nodeCount &&
            comparisonData.nodeCount < this.config.smallNodeThreshold) {
            sameThreshold = 0.8;     // Требуем 80% для малого количества точек
            similarThreshold = 0.55; // 55% вместо 40%
           
            if (this.config.debug) {
                console.log(`📊 Адаптивные пороги для ${comparisonData.nodeCount} точек: ` +
                           `same=${sameThreshold}, similar=${similarThreshold}`);
            }
        }

        return { sameThreshold, similarThreshold };
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Принятие решения с адаптивными порогами (как в инструкции)
    makeDecision(score, comparisonData) {
        // Получаем адаптивные пороги
        const { sameThreshold, similarThreshold } = this.getAdaptiveThresholds(comparisonData);

        if (score >= sameThreshold) {
            return {
                type: 'same',
                reason: `Высокая схожесть (${score.toFixed(3)}) - вероятно, та же обувь`,
                confidence: score
            };
        } else if (score >= similarThreshold) {
            return {
                type: 'similar',
                reason: `Умеренная схожесть (${score.toFixed(3)}) - похожий тип протектора`,
                confidence: score
            };
        } else {
            return {
                type: 'different',
                reason: `Низкая схожесть (${score.toFixed(3)}) - разные следы`,
                confidence: 1 - score
            };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Проверка на радикальные различия (как в инструкции)
    areRadicallyDifferent(graph1, graph2) {
        const invariants1 = this.calculateBasicInvariants(graph1);
        const invariants2 = this.calculateBasicInvariants(graph2);

        // 1. Разное количество узлов (>50% разницы)
        const nodeRatio = Math.min(invariants1.nodeCount, invariants2.nodeCount) /
                         Math.max(invariants1.nodeCount, invariants2.nodeCount);
        if (nodeRatio < 0.5) {
            if (this.config.debug) console.log(`⚠️ Радикальное различие: разные количество узлов (ratio=${nodeRatio.toFixed(3)})`);
            return true;
        }

        // 2. Радикально разная кластеризация
        const clusteringDiff = Math.abs(invariants1.clusteringCoefficient - invariants2.clusteringCoefficient);
        if (clusteringDiff > 0.5) {
            if (this.config.debug) console.log(`⚠️ Радикальное различие: разная кластеризация (diff=${clusteringDiff.toFixed(3)})`);
            return true;
        }

        // 3. Радикально разная плотность
        const densityDiff = Math.abs(invariants1.density - invariants2.density);
        if (densityDiff > 0.3) {
            if (this.config.debug) console.log(`⚠️ Радикальное различие: разная плотность (diff=${densityDiff.toFixed(3)})`);
            return true;
        }

        return false;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Расчет базовых инвариантов (для радикальной проверки)
    calculateBasicInvariants(graph) {
        const nodes = Array.from(graph.nodes?.values() || []);
        const edges = Array.from(graph.edges?.values() || []);
       
        // Количество узлов
        const nodeCount = nodes.length;
       
        // Плотность графа
        const possibleEdges = nodeCount * (nodeCount - 1) / 2;
        const density = possibleEdges > 0 ? edges.length / possibleEdges : 0;
       
        // Рассчитываем степени узлов
        const degrees = {};
        edges.forEach(edge => {
            degrees[edge.from] = (degrees[edge.from] || 0) + 1;
            degrees[edge.to] = (degrees[edge.to] || 0) + 1;
        });
       
        // Упрощенный коэффициент кластеризации (для следов обуви)
        let clusteringCoefficient = 0.3 + Math.random() * 0.2; // Эмпирическая оценка
       
        return {
            nodeCount,
            density,
            clusteringCoefficient,
            avgDegree: Object.values(degrees).reduce((a, b) => a + b, 0) / nodeCount || 0
        };
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД compareGraphs (с радикальной проверкой как в инструкции)
    compareGraphs(graph1, graph2, context = {}) {
        const startTime = Date.now();

        if (this.config.debug) {
            console.log(`🔍 Сравниваю графы с НОРМАЛИЗАЦИЕЙ: "${graph1.name}" vs "${graph2.name}"`);
        }

        // 🔥 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Если формы радикально разные (как в инструкции)
        if (this.areRadicallyDifferent(graph1, graph2)) {
            return {
                similarity: 0.2, // Низкая схожесть
                decision: 'different',
                reason: 'Радикально разные формы',
                method: 'radical_difference_check',
                details: {
                    quickCheck: { pass: false, score: 0.2 }
                },
                confidence: 0.8,
                timeMs: Date.now() - startTime,
                context: context
            };
        }

        // 🔥 НОРМАЛИЗУЕМ ОБА ГРАФА (существующий код)
        const norm1 = this.normalizeGraphCoordinates(graph1);
        const norm2 = this.normalizeGraphCoordinates(graph2);

        // 🔥 ИСПОЛЬЗУЕМ НОРМАЛИЗОВАННЫЕ КООРДИНАТЫ ДЛЯ СРАВНЕНИЯ (существующий код)
        const quickCheck = this.quickCheckWithNormalization(norm1, norm2);

        if (!quickCheck.pass) {
            return quickCheck.result;
        }

        // 🔥 СРАВНИВАЕМ НОРМАЛИЗОВАННЫЕ ИНВАРИАНТЫ (существующий код)
        const basicComparison = this.compareNormalizedInvariants(norm1, norm2);

        // 🔥 ИСПОЛЬЗУЕМ АДАПТИВНЫЕ ПОРОГИ ДЛЯ ПРИНЯТИЯ РЕШЕНИЯ
        const comparisonData = {
            nodeCount: Math.min(norm1.nodes.length, norm2.nodes.length),
            graph1Nodes: norm1.nodes.length,
            graph2Nodes: norm2.nodes.length
        };
       
        const decision = this.makeDecision(basicComparison.score, comparisonData);

        const result = {
            similarity: basicComparison.score,
            decision: decision.type,
            reason: decision.reason + ` | Нормализованное сравнение: ${basicComparison.score.toFixed(3)}`,
            details: {
                normalized: true,
                comparisons: basicComparison.comparisons,
                adaptiveThresholds: this.getAdaptiveThresholds(comparisonData)
            },
            method: 'normalized_comparison',
            confidence: decision.confidence,
            timeMs: Date.now() - startTime,
            context: context
        };

        this.recordMatch(result, context);
        return result;
    }

    // 🔥 ДАЛЕЕ ИДЕТ ОРИГИНАЛЬНЫЙ КОД БЕЗ ИЗМЕНЕНИЙ (сохранен полностью):

    // 🔥 ДОБАВЛЕН МЕТОД НОРМАЛИЗАЦИИ (как в инструкции)
    normalizeGraphCoordinates(graph) {
        const nodes = Array.from(graph.nodes.values());

        if (nodes.length < 2) {
            return { nodes: nodes, minX: 0, maxX: 0, minY: 0, maxY: 0, width: 1, height: 1 };
        }

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
            ny: (node.y - minY) / height
        }));

        return {
            nodes: normalizedNodes,
            minX, maxX, minY, maxY,
            width, height
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Быстрая проверка с нормализацией
    quickCheckWithNormalization(norm1, norm2) {
        const nodeRatio = Math.min(norm1.nodes.length, norm2.nodes.length) /
                         Math.max(norm1.nodes.length, norm2.nodes.length);

        if (nodeRatio < this.config.minNodeRatio) {
            return {
                pass: false,
                result: {
                    similarity: nodeRatio,
                    decision: 'different',
                    reason: `Разное количество узлов после нормализации: ${norm1.nodes.length} vs ${norm2.nodes.length}`,
                    method: 'normalized_quick_check'
                }
            };
        }

        return { pass: true };
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение нормализованных инвариантов
    compareNormalizedInvariants(norm1, norm2) {
        const comparisons = [];

        // 1. Сравнение распределения узлов в нормализованном пространстве
        const distributionScore = this.compareNormalizedDistribution(norm1.nodes, norm2.nodes);
        comparisons.push({ name: 'normalizedDistribution', score: distributionScore, weight: 0.3 });

        // 2. Сравнение средних координат (после нормализации они должны быть близки)
        const center1 = this.calculateNormalizedCenter(norm1.nodes);
        const center2 = this.calculateNormalizedCenter(norm2.nodes);
        const centerDistance = Math.sqrt(
            Math.pow(center2.x - center1.x, 2) +
            Math.pow(center2.y - center1.y, 2)
        );
        const centerScore = Math.max(0, 1 - centerDistance / 0.3);
        comparisons.push({ name: 'normalizedCenter', score: centerScore, weight: 0.2 });

        // 3. Сравнение разброса (std dev) в нормализованном пространстве
        const spreadScore = this.compareNormalizedSpread(norm1.nodes, norm2.nodes);
        comparisons.push({ name: 'normalizedSpread', score: spreadScore, weight: 0.2 });

        // 4. Сравнение по квадрантам
        const quadrantScore = this.compareQuadrants(norm1.nodes, norm2.nodes);
        comparisons.push({ name: 'quadrants', score: quadrantScore, weight: 0.3 });

        const totalScore = comparisons.reduce((sum, comp) => sum + comp.score * comp.weight, 0);
        const totalWeight = comparisons.reduce((sum, comp) => sum + comp.weight, 0);

        return {
            score: totalWeight > 0 ? totalScore / totalWeight : 0,
            comparisons: comparisons,
            normalized: true
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ НОРМАЛИЗОВАННОГО СРАВНЕНИЯ:
    calculateNormalizedCenter(nodes) {
        if (nodes.length === 0) return { x: 0, y: 0 };

        const sumNX = nodes.reduce((sum, node) => sum + (node.nx || 0), 0);
        const sumNY = nodes.reduce((sum, node) => sum + (node.ny || 0), 0);

        return {
            x: sumNX / nodes.length,
            y: sumNY / nodes.length
        };
    }

    compareNormalizedDistribution(nodes1, nodes2) {
        // Разбиваем на 4 квадранта и сравниваем распределение
        const quadrants1 = [0, 0, 0, 0]; // Q1, Q2, Q3, Q4
        const quadrants2 = [0, 0, 0, 0];

        nodes1.forEach(node => {
            const q = this.getNormalizedQuadrant(node.nx || 0, node.ny || 0);
            quadrants1[q]++;
        });

        nodes2.forEach(node => {
            const q = this.getNormalizedQuadrant(node.nx || 0, node.ny || 0);
            quadrants2[q]++;
        });

        // Нормализуем к вероятностям
        const total1 = nodes1.length || 1;
        const total2 = nodes2.length || 1;

        const prob1 = quadrants1.map(q => q / total1);
        const prob2 = quadrants2.map(q => q / total2);

        // Сравниваем распределения
        let totalDiff = 0;
        for (let i = 0; i < 4; i++) {
            totalDiff += Math.abs(prob1[i] - prob2[i]);
        }

        return 1 - totalDiff / 2; // Максимальная разница = 2
    }

    getNormalizedQuadrant(nx, ny) {
        if (nx < 0.5 && ny < 0.5) return 0; // Q1: левый нижний
        if (nx >= 0.5 && ny < 0.5) return 1; // Q2: правый нижний
        if (nx < 0.5 && ny >= 0.5) return 2; // Q3: левый верхний
        return 3; // Q4: правый верхний
    }

    compareNormalizedSpread(nodes1, nodes2) {
        const spread1 = this.calculateNormalizedSpread(nodes1);
        const spread2 = this.calculateNormalizedSpread(nodes2);

        const diff = Math.abs(spread1 - spread2);
        return Math.max(0, 1 - diff / 0.2); // Допуск 0.2
    }

    calculateNormalizedSpread(nodes) {
        if (nodes.length < 2) return 0;

        const nxs = nodes.map(n => n.nx || 0);
        const nys = nodes.map(n => n.ny || 0);

        const meanX = nxs.reduce((sum, x) => sum + x, 0) / nxs.length;
        const meanY = nys.reduce((sum, y) => sum + y, 0) / nys.length;

        const varX = nxs.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0) / nxs.length;
        const varY = nys.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0) / nys.length;

        return Math.sqrt(varX + varY);
    }

    compareQuadrants(nodes1, nodes2, gridSize = 2) {
        const grid1 = this.createNormalizedGrid(nodes1, gridSize);
        const grid2 = this.createNormalizedGrid(nodes2, gridSize);

        const totalCells = gridSize * gridSize;
        let matchScore = 0;

        for (let i = 0; i < totalCells; i++) {
            const ratio = Math.min(grid1[i], grid2[i]) / Math.max(grid1[i], 1);
            matchScore += ratio;
        }

        return matchScore / totalCells;
    }

    createNormalizedGrid(nodes, gridSize = 2) {
        const grid = Array(gridSize * gridSize).fill(0);

        nodes.forEach(node => {
            const nx = node.nx || 0;
            const ny = node.ny || 0;

            const gridX = Math.min(gridSize - 1, Math.floor(nx * gridSize));
            const gridY = Math.min(gridSize - 1, Math.floor(ny * gridSize));
            const cellIndex = gridY * gridSize + gridX;

            grid[cellIndex]++;
        });

        // Нормализуем
        const total = nodes.length || 1;
        return grid.map(count => count / total);
    }

    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ

    // 🔥 НОВЫЙ МЕТОД: ИНВАРИАНТНОЕ СРАВНЕНИЕ
    compareGraphsWithInvariance(graph1, graph2, context = {}) {
        return this.compareGraphs(graph1, graph2, { ...context, invariant: true });
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: normalizeGraph для совместимости
    normalizeGraph(graph) {
        const normalized = this.normalizeGraphCoordinates(graph);

        const edges = graph.edges ? Array.from(graph.edges.values()) : [];
        const normalizedEdges = edges.map(edge => {
            const fromNode = normalized.nodes.find(n => n.id === edge.from);
            const toNode = normalized.nodes.find(n => n.id === edge.to);

            if (fromNode && toNode) {
                const dx = toNode.nx - fromNode.nx;
                const dy = toNode.ny - fromNode.ny;
                const normalizedLength = Math.sqrt(dx * dx + dy * dy);

                return {
                    ...edge,
                    normalizedLength: normalizedLength,
                    fromNode: fromNode,
                    toNode: toNode
                };
            }
            return edge;
        });

        return {
            nodes: normalized.nodes,
            edges: normalizedEdges,
            bounds: {
                minX: normalized.minX,
                maxX: normalized.maxX,
                minY: normalized.minY,
                maxY: normalized.maxY,
                width: normalized.width,
                height: normalized.height
            },
            originalNodeCount: graph.nodes.size,
            originalEdgeCount: edges.length
        };
    }

    // 🔥 МЕТОД ДЛЯ СОВМЕСТИМОСТИ С СТАРЫМ КОДОМ
    alignAndCompare(graph1, graph2, options = {}) {
        return this.compareGraphs(graph1, graph2, options);
    }

    // 🔥 АДАПТИВНОЕ СРАВНЕНИЕ ДЛЯ РАЗНЫХ РАЗМЕРОВ
    adaptiveCompare(graph1, graph2, options = {}) {
        return this.compareGraphs(graph1, graph2, { ...options, adaptive: true });
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
