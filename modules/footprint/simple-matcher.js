// modules/footprint/simple-matcher.js
// УМНЫЙ СРАВНИТЕЛЬ ГРАФОВ С ИНВАРИАНТНОСТЬЮ (ИСПРАВЛЕННАЯ ВЕРСИЯ)

class SimpleGraphMatcher {
    constructor(options = {}) {
        this.config = {
            // 🔥 ФИКСИРОВАННЫЕ ПОРОГИ согласно инструкции
            sameThreshold: options.sameThreshold || 0.7,      // >0.7 = одна обувь
            similarThreshold: options.similarThreshold || 0.5, // 0.5-0.7 = похожая
            differentThreshold: options.differentThreshold || 0.3, // НОВЫЙ ПОРОГ
            minNodeRatio: options.minNodeRatio || 0.7,        // Минимальное соотношение узлов
            maxNodeDiff: options.maxNodeDiff || 0.3,          // Максимальная разница узлов

            // 🔥 ОТКЛЮЧЕНО: Адаптивные пороги
            enableAdaptiveThresholds: false,
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

        // 🔥 ИСПРАВЛЕНИЕ: ВКЛЮЧАЕМ RotationInvariance БЕЗ РЕКУРСИИ
        this.rotationProcessor = null;
       
        // Отложенная инициализация, чтобы избежать циклических зависимостей
        try {
            // Используем динамический импорт при вызове методов
            console.log('🎯 RotationInvariance будет загружена динамически');
        } catch (error) {
            console.log('⚠️ Временное отключение RotationInvariance:', error.message);
        }

        // 🔥 БЕЗОПАСНОЕ СРАВНЕНИЕ ДЛЯ СОВМЕСТИМОСТИ
        this.enableAdvancedFeatures = options.enableAdvancedFeatures !== false;
       
        this.matchHistory = [];
        console.log('🎯 SimpleGraphMatcher с безопасной инициализацией');
    }

    // 🔥 НОВЫЙ МЕТОД: безопасная загрузка RotationInvariance
    async ensureRotationProcessor() {
        if (this.rotationProcessor) return true;
       
        try {
            // Динамический импорт для избежания циклических зависимостей
            const RotationInvariance = require('./rotation-invariance');
            this.rotationProcessor = new RotationInvariance({
                debug: this.config.debug
            });
            console.log('✅ RotationInvariance загружена динамически');
            return true;
        } catch (error) {
            console.log('⚠️ Не удалось загрузить RotationInvariance:', error.message);
            return false;
        }
    }

    // 🔥 ПЕРЕПИСАННЫЙ compareGraphs С ВОЗМОЖНОСТЬЮ ПОВОРОТНОЙ ИНВАРИАНТНОСТИ
    async compareGraphs(graph1, graph2, context = {}) {
        const startTime = Date.now();
        console.log(`🔍 Сравниваю графы: "${graph1.name}" vs "${graph2.name}"`);

        // 1. Быстрая проверка количества узлов
        const nodeRatio = Math.min(graph1.nodes.size, graph2.nodes.size) /
                         Math.max(graph1.nodes.size, graph2.nodes.size);

        if (nodeRatio < this.config.minNodeRatio) {
            return {
                similarity: nodeRatio,
                decision: 'different',
                reason: `Разное количество узлов: ${graph1.nodes.size} vs ${graph2.nodes.size}`,
                method: 'quick_check',
                timeMs: Date.now() - startTime,
                context: context
            };
        }

        // 2. Использовать поворотную инвариантность если доступно
        let bestResult = null;
       
        if (this.enableAdvancedFeatures) {
            try {
                // Пытаемся использовать RotationInvariance
                await this.ensureRotationProcessor();
               
                if (this.rotationProcessor) {
                    // 🔥 БЕЗОПАСНОЕ СРАВНЕНИЕ БЕЗ РЕКУРСИИ
                    const rotationResult = this.rotationProcessor.compareWithAllMethods(
                        graph1,
                        graph2,
                        { simpleMode: true } // Флаг для простого режима без рекурсии
                    );
                   
                    if (rotationResult && rotationResult.similarity > 0) {
                        bestResult = {
                            similarity: rotationResult.similarity,
                            decision: rotationResult.decision,
                            reason: rotationResult.reason || `Поворотная инвариантность: ${rotationResult.similarity.toFixed(3)}`,
                            method: 'rotation_invariant_safe',
                            confidence: rotationResult.similarity,
                            details: rotationResult.details
                        };
                    }
                }
            } catch (error) {
                console.log(`⚠️ Поворотная инвариантность временно недоступна: ${error.message}`);
            }
        }

        // 3. Если поворотная инвариантность не сработала - использовать простое сравнение
        if (!bestResult) {
            // Простое сравнение координат (как было)
            const norm1 = this.normalizeGraphCoordinates(graph1);
            const norm2 = this.normalizeGraphCoordinates(graph2);
           
            const center1 = this.calculateNormalizedCenter(norm1.nodes);
            const center2 = this.calculateNormalizedCenter(norm2.nodes);
            const centerDistance = Math.sqrt(
                Math.pow(center2.x - center1.x, 2) +
                Math.pow(center2.y - center1.y, 2)
            );

            // Рассчитать схожесть
            let similarity = 0;
            similarity += nodeRatio * 0.3;
           
            const centerSimilarity = Math.max(0, 1 - centerDistance / 0.3);
            similarity += centerSimilarity * 0.3;
           
            const distributionScore = this.compareNormalizedDistribution(norm1.nodes, norm2.nodes);
            similarity += distributionScore * 0.4;
           
            similarity = Math.max(0, Math.min(1, similarity));

            // Принять решение
            let decision, reason;
            if (similarity >= 0.7) {
                decision = 'same';
                reason = `Высокая схожесть (${similarity.toFixed(3)})`;
            } else if (similarity >= 0.5) {
                decision = 'similar';
                reason = `Умеренная схожесть (${similarity.toFixed(3)})`;
            } else {
                decision = 'different';
                reason = `Низкая схожесть (${similarity.toFixed(3)})`;
            }

            bestResult = {
                similarity,
                decision,
                reason,
                method: 'simple_comparison_fallback',
                confidence: similarity,
                details: {
                    nodeRatio,
                    centerDistance,
                    centerSimilarity,
                    distributionScore
                }
            };
        }

        const finalResult = {
            ...bestResult,
            timeMs: Date.now() - startTime,
            context: context
        };

        this.recordMatch(finalResult, context);
        return finalResult;
    }

    // 🔥 Вспомогательный метод
    calculateNormalizedCenter(nodes) {
        if (nodes.length === 0) return { x: 0, y: 0 };

        const sumNX = nodes.reduce((sum, node) => sum + (node.nx || 0), 0);
        const sumNY = nodes.reduce((sum, node) => sum + (node.ny || 0), 0);

        return {
            x: sumNX / nodes.length,
            y: sumNY / nodes.length
        };
    }

    // 🔥 ИЗМЕНЕНО: Метод getAdaptiveThresholds теперь возвращает фиксированные пороги
    getAdaptiveThresholds(comparisonData) {
        // Всегда возвращаем фиксированные пороги согласно инструкции
        const sameThreshold = this.config.sameThreshold; // 0.7
        const similarThreshold = this.config.similarThreshold; // 0.5

        if (this.config.debug) {
            console.log(`📊 ФИКСИРОВАННЫЕ пороги: same=${sameThreshold}, similar=${similarThreshold}`);
        }

        return { sameThreshold, similarThreshold };
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Принятие решения с ФИКСИРОВАННЫМИ порогами (как в инструкции)
    makeDecision(score, comparisonData) {
        const sameThreshold = 0.7;
        const similarThreshold = 0.5;
        const differentThreshold = 0.3;

        if (score >= sameThreshold) {
            return {
                type: 'same',
                reason: `Высокая схожесть`,
                confidence: score
            };
        } else if (score >= similarThreshold) {
            return {
                type: 'similar',
                reason: `Умеренная схожесть`,
                confidence: score
            };
        } else {
            return {
                type: 'different',
                reason: `Низкая схожесть`,
                confidence: 1 - score
            };
        }
    }

    // 🔥 СРОЧНОЕ ИСПРАВЛЕНИЕ: ЗАМЕНИТЬ ВЕСЬ МЕТОД areRadicallyDifferent
    areRadicallyDifferent(graph1, graph2) {
        const invariants1 = this.calculateBasicInvariants(graph1);
        const invariants2 = this.calculateBasicInvariants(graph2);

        console.log(`🔍 РАДИКАЛЬНАЯ ПРОВЕРКА:`);
        console.log(`   Граф 1: ${invariants1.nodeCount} узлов, кластеризация=${invariants1.clusteringCoefficient?.toFixed(3)}`);
        console.log(`   Граф 2: ${invariants2.nodeCount} узлов, кластеризация=${invariants2.clusteringCoefficient?.toFixed(3)}`);

        // 1. Разное количество узлов (>50% разницы)
        const nodeRatio = Math.min(invariants1.nodeCount, invariants2.nodeCount) /
                         Math.max(invariants1.nodeCount, invariants2.nodeCount);
        if (nodeRatio < 0.7) {
            console.log(`🚫 Радикальное различие: разные количество узлов (ratio=${nodeRatio.toFixed(3)})`);
            return true;
        }

        // 2. Радикально разная кластеризация
        const clusteringDiff = Math.abs(invariants1.clusteringCoefficient - invariants2.clusteringCoefficient);
        if (clusteringDiff > 0.4) {
            console.log(`🚫 Радикальное различие: разная кластеризация (diff=${clusteringDiff.toFixed(3)})`);
            return true;
        }

        // 3. Радикально разная плотность
        const densityDiff = Math.abs(invariants1.density - invariants2.density);
        if (densityDiff > 0.2) {
            console.log(`🚫 Радикальное различие: разная плотность (diff=${densityDiff.toFixed(3)})`);
            return true;
        }

        // 🔥 4. НОВАЯ ПРОВЕРКА: разное распределение по квадрантам
        const quadrantDiff = this.calculateQuadrantDifference(graph1, graph2);
        console.log(`   Разница распределения по квадрантам: ${quadrantDiff.toFixed(3)}`);
        if (quadrantDiff > 0.3) {
            console.log(`🚫 Радикальное различие: разное распределение точек (diff=${quadrantDiff.toFixed(3)})`);
            return true;
        }

        console.log(`✅ Формы НЕ радикально разные`);
        return false;
    }

    // 🔥 ДОБАВЛЕН НОВЫЙ МЕТОД: Расчет разницы распределения по квадрантам
    calculateQuadrantDifference(graph1, graph2) {
        const norm1 = this.normalizeGraphCoordinates(graph1);
        const norm2 = this.normalizeGraphCoordinates(graph2);

        // Используем сетку 2x2 для быстрого сравнения
        const grid1 = this.createNormalizedGrid(norm1.nodes, 2);
        const grid2 = this.createNormalizedGrid(norm2.nodes, 2);

        let totalDiff = 0;
        for (let i = 0; i < grid1.length; i++) {
            totalDiff += Math.abs(grid1[i] - grid2[i]);
        }

        return totalDiff / grid1.length;
    }

    // 🔥 ДОБАВЛЕН МЕТОД createNormalizedGrid
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

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Расчет базовых инвариантов
    calculateBasicInvariants(graph) {
        const nodes = Array.from(graph.nodes?.values() || []);
        const edges = Array.from(graph.edges?.values() || []);

        // Количество узлов
        const nodeCount = nodes.length;

        // Плотность графа
        const possibleEdges = nodeCount * (nodeCount - 1) / 2;
        const density = possibleEdges > 0 ? edges.length / possibleEdges : 0;

        // Рассчитываем реальные степени узлов
        const degrees = new Map();
        edges.forEach(edge => {
            degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
            degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);
        });

        // РЕАЛЬНЫЙ расчет коэффициента кластеризации
        let clusteringCoefficient = 0;
        if (nodeCount > 0 && edges.length > 0) {
            let totalClustering = 0;
            let nodesWithNeighbors = 0;

            // Для каждого узла считаем локальный коэффициент кластеризации
            for (const [nodeId, node] of graph.nodes) {
                const neighborIds = [];

                // Находим соседей через ребра
                for (const [edgeId, edge] of graph.edges) {
                    if (edge.from === nodeId) neighborIds.push(edge.to);
                    if (edge.to === nodeId) neighborIds.push(edge.from);
                }

                if (neighborIds.length >= 2) {
                    let possibleTriangles = 0;
                    let actualTriangles = 0;

                    // Проверяем связи между соседями
                    for (let i = 0; i < neighborIds.length; i++) {
                        for (let j = i + 1; j < neighborIds.length; j++) {
                            possibleTriangles++;

                            // Проверяем есть ли ребро между neighborIds[i] и neighborIds[j]
                            let hasEdge = false;
                            for (const [edgeId, edge] of graph.edges) {
                                if ((edge.from === neighborIds[i] && edge.to === neighborIds[j]) ||
                                    (edge.from === neighborIds[j] && edge.to === neighborIds[i])) {
                                    hasEdge = true;
                                    break;
                                }
                            }
                            if (hasEdge) actualTriangles++;
                        }
                    }

                    if (possibleTriangles > 0) {
                        totalClustering += actualTriangles / possibleTriangles;
                        nodesWithNeighbors++;
                    }
                }
            }

            clusteringCoefficient = nodesWithNeighbors > 0 ? totalClustering / nodesWithNeighbors : 0;
        }

        const avgDegree = edges.length * 2 / Math.max(1, nodeCount);

        return {
            nodeCount,
            density,
            clusteringCoefficient: Math.max(0, Math.min(1, clusteringCoefficient)),
            avgDegree
        };
    }

    // 🔥 МЕТОД НОРМАЛИЗАЦИИ
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

    // 🔥 НОВЫЙ МЕТОД: Сравнение нормализованных инвариантов
    compareNormalizedInvariants(norm1, norm2) {
        const comparisons = [];

        // 1. Сравнение распределения узлов
        const distributionScore = this.compareNormalizedDistribution(norm1.nodes, norm2.nodes);
        comparisons.push({ name: 'normalizedDistribution', score: distributionScore, weight: 0.3 });

        // 2. Сравнение средних координат
        const center1 = this.calculateNormalizedCenter(norm1.nodes);
        const center2 = this.calculateNormalizedCenter(norm2.nodes);
        const centerDistance = Math.sqrt(
            Math.pow(center2.x - center1.x, 2) +
            Math.pow(center2.y - center1.y, 2)
        );
        const centerScore = Math.max(0, 1 - centerDistance / 0.3);
        comparisons.push({ name: 'normalizedCenter', score: centerScore, weight: 0.2 });

        // 3. Сравнение разброса
        const spreadScore = this.compareNormalizedSpread(norm1.nodes, norm2.nodes);
        comparisons.push({ name: 'normalizedSpread', score: spreadScore, weight: 0.2 });

        // 4. Сравнение по квадрантам
        const quadrantScore = 0.5;
        comparisons.push({ name: 'quadrants', score: quadrantScore, weight: 0.3 });

        const totalScore = comparisons.reduce((sum, comp) => sum + comp.score * comp.weight, 0);
        const totalWeight = comparisons.reduce((sum, comp) => sum + comp.weight, 0);

        return {
            score: totalWeight > 0 ? totalScore / totalWeight : 0,
            comparisons: comparisons,
            normalized: true
        };
    }

    // 🔥 МЕТОДЫ ДЛЯ НОРМАЛИЗОВАННОГО СРАВНЕНИЯ:
    compareNormalizedDistribution(nodes1, nodes2) {
        // Разбиваем на 4 квадранта и сравниваем распределение
        const quadrants1 = [0, 0, 0, 0];
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

        return 1 - totalDiff / 2;
    }

    getNormalizedQuadrant(nx, ny) {
        if (nx < 0.5 && ny < 0.5) return 0;
        if (nx >= 0.5 && ny < 0.5) return 1;
        if (nx < 0.5 && ny >= 0.5) return 2;
        return 3;
    }

    compareNormalizedSpread(nodes1, nodes2) {
        const spread1 = this.calculateNormalizedSpread(nodes1);
        const spread2 = this.calculateNormalizedSpread(nodes2);

        const diff = Math.abs(spread1 - spread2);
        return Math.max(0, 1 - diff / 0.2);
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

    // 🔥 МЕТОД ДЛЯ СОВМЕСТИМОСТИ С СТАРЫМ КОДОМ
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

    alignAndCompare(graph1, graph2, options = {}) {
        return this.compareGraphs(graph1, graph2, options);
    }

    adaptiveCompare(graph1, graph2, options = {}) {
        return this.compareGraphs(graph1, graph2, { ...options, adaptive: true });
    }

    // ПРОВЕРИТЬ, ОДНА ЛИ ЭТО ОБУВЬ?
    isSameShoe(graph1, graph2) {
        const result = this.compareGraphs(graph1, graph2, { checkType: 'isSameShoe' });
        return {
            isSame: result.decision === 'same',
            similarity: result.similarity,
            confidence: result.confidence,
            reason: result.reason
        };
    }

    // НАЙТИ САМЫЙ ПОХОЖИЙ ГРАФ ИЗ СПИСКА
    findMostSimilar(targetGraph, graphList, maxResults = 5) {
        console.log(`🔎 Ищу похожие графы для "${targetGraph.name}" среди ${graphList.length} кандидатов...`);

        const comparisons = [];

        graphList.forEach((graph, index) => {
            if (graph.id === targetGraph.id) return;

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

    // ЗАПИСАТЬ РЕЗУЛЬТАТ СРАВНЕНИЯ
    recordMatch(result, context) {
        const record = {
            timestamp: new Date(),
            similarity: result.similarity,
            decision: result.decision,
            confidence: result.confidence,
            timeMs: result.timeMs,
            context: context,
            details: {
                method: result.method
            }
        };

        this.matchHistory.push(record);

        // Держать только последние 100 записей
        if (this.matchHistory.length > 100) {
            this.matchHistory.shift();
        }
    }

    // ПОЛУЧИТЬ СТАТИСТИКУ МАТЧЕРА
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
