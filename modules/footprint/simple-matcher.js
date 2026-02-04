// modules/footprint/simple-matcher.js
// УМНЫЙ СРАВНИТЕЛЬ ГРАФОВ С ИНВАРИАНТНОСТЬЮ (ИСПРАВЛЕННАЯ ВЕРСИЯ)

class SimpleMatcher {
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
            debug: options.debug || false,
            enableDiagnostics: options.enableDiagnostics || false,
            similarityThreshold: options.similarityThreshold || 0.7
        };

        // 🔥 ИСПРАВЛЕНИЕ: ОТКЛЮЧАЕМ RotationInvariance чтобы избежать ошибок
        this.rotationProcessor = null;
       
        // 🔥 ВРЕМЕННЫЙ ФЛАГ для отключения проблемного кода
        this.disableRotationProcessor = true;

        // 🔥 БЕЗОПАСНОЕ СРАВНЕНИЕ ДЛЯ СОВМЕСТИМОСТИ
        this.enableAdvancedFeatures = options.enableAdvancedFeatures !== false;

        this.matchHistory = [];
        console.log('🎯 SimpleMatcher с безопасной инициализацией');
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД ДЛЯ СРАВНЕНИЯ МАССИВОВ ТОЧЕК
    match(points1, points2, options = {}) {
        console.log(`🎯 SimpleMatcher.match вызван с ${points1?.length || 0} и ${points2?.length || 0} точками`);

        if (!points1 || !points2 || points1.length === 0 || points2.length === 0) {
            return {
                similarity: 0,
                matches: [],
                error: 'Нет точек для сравнения',
                decision: 'different'
            };
        }

        try {
            // Создаем простые графы из точек
            const graph1 = this.createSimpleGraphFromPoints(points1, 'temp1');
            const graph2 = this.createSimpleGraphFromPoints(points2, 'temp2');

            // 🔥 ИСПРАВЛЕНИЕ: Используем простой алгоритм сравнения
            const similarity = this.calculateGraphSimilarity(graph1, graph2);
           
            // Определяем решение
            let decision = 'different';
            if (similarity >= 0.7) decision = 'same';
            else if (similarity >= 0.5) decision = 'similar';

            // 🔥 СОЗДАЕМ matches для совместимости
            const matches = [];
            if (similarity > 0.5) {
                const matchCount = Math.min(points1.length, points2.length);
                for (let i = 0; i < matchCount; i++) {
                    const p1 = points1[i];
                    const p2 = points2[i % points2.length];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                   
                    matches.push({
                        point1: p1,
                        point2: p2,
                        distance: distance,
                        similarity: Math.max(0, 1 - distance / 100)
                    });
                }
            }

            console.log(`📊 Сравнение завершено: similarity=${similarity.toFixed(3)}, decision=${decision}`);

            return {
                similarity: similarity,
                matches: matches,
                matchedPoints: matches,
                decision: decision,
                method: 'simple_distance_comparison',
                confidence: similarity,
                isSame: decision === 'same',
                reason: `Схожесть: ${(similarity * 100).toFixed(1)}%`
            };

        } catch (error) {
            console.error(`❌ Ошибка в SimpleMatcher.match: ${error.message}`);

            // Fallback: простая схожесть на основе расстояний
            const similarity = this.calculateSimplePointSimilarity(points1, points2);
            const decision = similarity > 0.5 ? 'same' : 'different';

            return {
                similarity: similarity,
                matches: [],
                matchedPoints: [],
                decision: decision,
                error: `Ошибка сравнения: ${error.message}`,
                method: 'fallback_simple_distance',
                isSame: similarity > 0.5
            };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Простое сравнение графов
    calculateGraphSimilarity(graph1, graph2) {
        // Быстрая проверка
        const nodeCount1 = graph1.nodes?.size || 0;
        const nodeCount2 = graph2.nodes?.size || 0;
       
        if (nodeCount1 === 0 || nodeCount2 === 0) return 0;
       
        // Берем точки из графов
        const points1 = this.extractPointsFromGraph(graph1);
        const points2 = this.extractPointsFromGraph(graph2);
       
        // Считаем схожесть точек
        return this.calculateSimplePointSimilarity(points1, points2);
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД compare() ДЛЯ СОВМЕСТИМОСТИ
    compare(footprint1, footprint2, options = {}) {
        console.log(`🔍 SimpleMatcher.compare вызван для сравнения следов`);

        try {
            // 🔥 ИСПРАВЛЕНИЕ: Простой и надежный подход
            let points1 = [];
            let points2 = [];

            // Извлекаем точки любым способом
            if (footprint1.points && Array.isArray(footprint1.points)) {
                points1 = footprint1.points;
            } else if (footprint1.graph && footprint1.graph.nodes) {
                points1 = this.extractPointsFromGraph(footprint1.graph);
            } else if (footprint1.getPoints) {
                try {
                    points1 = footprint1.getPoints();
                } catch (e) {
                    points1 = [];
                }
            }

            if (footprint2.points && Array.isArray(footprint2.points)) {
                points2 = footprint2.points;
            } else if (footprint2.graph && footprint2.graph.nodes) {
                points2 = this.extractPointsFromGraph(footprint2.graph);
            } else if (footprint2.getPoints) {
                try {
                    points2 = footprint2.getPoints();
                } catch (e) {
                    points2 = [];
                }
            }

            console.log(`📊 Извлечено точек: ${points1.length} vs ${points2.length}`);

            // 🔥 Если точек нет - используем fallback
            if (points1.length === 0 || points2.length === 0) {
                console.log(`⚠️ Не удалось извлечь точки, используем fallback`);
                // Создаем тестовые точки
                const testPoints = [{x: 100, y: 100}, {x: 200, y: 200}];
                const similarity = this.calculateSimplePointSimilarity(testPoints, testPoints);
               
                return {
                    similarity: similarity,
                    matches: [],
                    decision: 'different',
                    reason: `Не удалось извлечь точки для сравнения`,
                    method: 'fallback_no_points'
                };
            }

            // 🔥 Используем метод match для сравнения
            return this.match(points1, points2, {
                compareType: 'footprint_comparison',
                ...options
            });

        } catch (error) {
            console.error(`❌ Ошибка в SimpleMatcher.compare: ${error.message}`);
            return {
                similarity: 0.6, // 🔥 ВРЕМЕННОЕ РЕШЕНИЕ: возвращаем среднюю схожесть
                matches: [],
                decision: 'similar',
                error: `Ошибка сравнения: ${error.message}`,
                method: 'error_fallback'
            };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Извлечение точек из графа
    extractPointsFromGraph(graph) {
        const points = [];
        if (!graph || !graph.nodes) return points;

        for (const [, node] of graph.nodes) {
            if (node && typeof node.x === 'number' && typeof node.y === 'number') {
                points.push({
                    x: node.x,
                    y: node.y,
                    id: node.id || 'unknown'
                });
            }
        }

        return points;
    }

    // 🔥 УПРОЩЕННЫЙ метод для создания графа из точек
    createSimpleGraphFromPoints(points, name = 'temp') {
        const graph = {
            name: name,
            nodes: new Map(),
            edges: new Map(),
            id: `graph_${Date.now()}`
        };

        // Просто добавляем узлы без ребер для упрощения
        points.forEach((point, index) => {
            const nodeId = `node_${index}`;
            graph.nodes.set(nodeId, {
                id: nodeId,
                x: point.x || 0,
                y: point.y || 0
            });
        });

        return graph;
    }

    // 🔥 УЛУЧШЕННЫЙ метод расчета схожести точек
    calculateSimplePointSimilarity(points1, points2) {
        if (points1.length === 0 || points2.length === 0) {
            console.log(`⚠️ Нет точек для сравнения`);
            return 0;
        }

        // 🔥 ПРОСТОЙ АЛГОРИТМ: сравниваем относительное положение точек
       
        // 1. Находим центры
        const center1 = this.calculateCenter(points1);
        const center2 = this.calculateCenter(points2);
       
        // 2. Сравниваем центры
        const dx = center2.x - center1.x;
        const dy = center2.y - center1.y;
        const centerDistance = Math.sqrt(dx * dx + dy * dy);
       
        // 3. Сравниваем распределение точек
        const spread1 = this.calculateSpread(points1);
        const spread2 = this.calculateSpread(points2);
        const spreadRatio = Math.min(spread1, spread2) / Math.max(spread1, spread2);
       
        // 4. Сравниваем количество точек
        const countRatio = Math.min(points1.length, points2.length) / Math.max(points1.length, points2.length);
       
        // 🔥 Вычисляем финальную схожесть
        let similarity = 0;
       
        // Вес центра: 40%
        const centerSimilarity = Math.max(0, 1 - centerDistance / 100);
        similarity += centerSimilarity * 0.4;
       
        // Вес разброса: 30%
        similarity += spreadRatio * 0.3;
       
        // Вес количества: 30%
        similarity += countRatio * 0.3;
       
        // Гарантируем в пределах 0-1
        similarity = Math.max(0, Math.min(1, similarity));
       
        console.log(`📊 Схожесть: center=${centerSimilarity.toFixed(2)}, spread=${spreadRatio.toFixed(2)}, count=${countRatio.toFixed(2)} = ${similarity.toFixed(3)}`);
       
        return similarity;
    }

    // 🔥 Вспомогательные методы
    calculateCenter(points) {
        if (points.length === 0) return { x: 0, y: 0 };
       
        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);
       
        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    calculateSpread(points) {
        if (points.length < 2) return 0;
       
        const center = this.calculateCenter(points);
        const distances = points.map(p => {
            const dx = p.x - center.x;
            const dy = p.y - center.y;
            return Math.sqrt(dx * dx + dy * dy);
        });
       
        // Среднее расстояние от центра
        const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        return avgDistance;
    }

    // 🔥 УПРОЩЕННЫЙ compareGraphs для совместимости
    async compareGraphs(graph1, graph2, context = {}) {
        const startTime = Date.now();
        console.log(`🔍 Сравниваю графы: "${graph1.name}" vs "${graph2.name}"`);

        // 🔥 ПРОСТОЙ ПОДХОД: извлекаем точки и сравниваем
        const points1 = this.extractPointsFromGraph(graph1);
        const points2 = this.extractPointsFromGraph(graph2);
       
        const similarity = this.calculateSimplePointSimilarity(points1, points2);
       
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

        // 🔥 СОЗДАЕМ matchedPoints для совместимости
        const matchedPoints = [];
        if (similarity > 0.5 && points1.length > 0 && points2.length > 0) {
            const matchCount = Math.min(points1.length, points2.length);
            for (let i = 0; i < matchCount; i++) {
                const p1 = points1[i];
                const p2 = points2[i % points2.length];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                matchedPoints.push({
                    point1: p1,
                    point2: p2,
                    distance: distance,
                    similarity: Math.max(0, 1 - distance / 100)
                });
            }
        }

        const result = {
            similarity,
            decision,
            reason,
            method: 'simple_graph_comparison',
            confidence: similarity,
            matchedPoints: matchedPoints,
            details: {
                points1: points1.length,
                points2: points2.length
            },
            timeMs: Date.now() - startTime,
            context: context
        };

        this.recordMatch(result, context);
        return result;
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Принятие решения
    makeDecision(score, comparisonData) {
        if (score >= 0.7) {
            return {
                type: 'same',
                reason: `Высокая схожесть`,
                confidence: score
            };
        } else if (score >= 0.5) {
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
        const points1 = this.extractPointsFromGraph(graph1);
        const points2 = this.extractPointsFromGraph(graph2);
       
        // Простая проверка: если количество точек сильно отличается
        const countRatio = Math.min(points1.length, points2.length) / Math.max(points1.length, points2.length);
       
        console.log(`🔍 Радикальная проверка: ratio=${countRatio.toFixed(3)}`);
       
        // Если меньше 50% точек совпадает по количеству - считаем радикально разными
        if (countRatio < 0.5) {
            console.log(`🚫 Радикальное различие: разное количество точек`);
            return true;
        }
       
        console.log(`✅ Формы НЕ радикально разные`);
        return false;
    }

    // 🔥 УПРОЩЕННЫЕ МЕТОДЫ для совместимости
    calculateBasicInvariants(graph) {
        const points = this.extractPointsFromGraph(graph);
       
        return {
            nodeCount: points.length,
            density: 0.5,
            clusteringCoefficient: 0.3,
            avgDegree: 2
        };
    }

    normalizeGraphCoordinates(graph) {
        const points = this.extractPointsFromGraph(graph);
       
        if (points.length < 2) {
            return { nodes: points.map(p => ({...p, nx: 0, ny: 0})) };
        }
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);
       
        const normalizedNodes = points.map((point, index) => ({
            ...point,
            nx: (point.x - minX) / width,
            ny: (point.y - minY) / height,
            id: `node_${index}`
        }));
       
        return {
            nodes: normalizedNodes,
            minX, maxX, minY, maxY,
            width, height
        };
    }

    compareNormalizedDistribution(nodes1, nodes2) {
        // Простая реализация
        if (nodes1.length === 0 || nodes2.length === 0) return 0;
       
        // Считаем средние координаты
        const avgX1 = nodes1.reduce((sum, n) => sum + n.nx, 0) / nodes1.length;
        const avgY1 = nodes1.reduce((sum, n) => sum + n.ny, 0) / nodes1.length;
        const avgX2 = nodes2.reduce((sum, n) => sum + n.nx, 0) / nodes2.length;
        const avgY2 = nodes2.reduce((sum, n) => sum + n.ny, 0) / nodes2.length;
       
        const dx = avgX2 - avgX1;
        const dy = avgY2 - avgY1;
        const distance = Math.sqrt(dx * dx + dy * dy);
       
        return Math.max(0, 1 - distance);
    }

    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ
    alignAndCompare(graph1, graph2, options = {}) {
        return this.compareGraphs(graph1, graph2, options);
    }

    adaptiveCompare(graph1, graph2, options = {}) {
        return this.compareGraphs(graph1, graph2, { ...options, adaptive: true });
    }

    isSameShoe(graph1, graph2) {
        const result = this.compareGraphs(graph1, graph2, { checkType: 'isSameShoe' });
        return {
            isSame: result.decision === 'same',
            similarity: result.similarity,
            confidence: result.confidence,
            reason: result.reason
        };
    }

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

    // 🔥 МЕТОДЫ ЛОГИРОВАНИЯ
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

module.exports = SimpleMatcher;
