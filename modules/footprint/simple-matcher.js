// modules/footprint/simple-matcher.js
// 🔥 ПРОСТАЯ ОБЕРТКА ДЛЯ ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА - ТОЛЬКО ВЕКТОРНЫЕ ОПЕРАЦИИ

class SimpleMatcher {
    constructor(options = {}) {
        console.log('🎯 SimpleMatcher - ВЕКТОРНАЯ обертка для GeometricHashAlgorithm');

        // 🔥 ЗАГРУЖАЕМ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ
        try {
            const GeometricHashAlgorithm = require('./clean/vector-algorithm');
            this.geometricAlgorithm = new GeometricHashAlgorithm({
                neighborOffsets: [-2, -1, 1, 2],
                angleTolerance: 10,
                minSimilarity: options.sameThreshold || 0.6,
                debug: options.debug || false
            });
            console.log('✅ Геометрический алгоритм загружен (ВЕКТОРНЫЙ)');
        } catch (error) {
            console.log(`⚠️ Не удалось загрузить геометрический алгоритм: ${error.message}`);
            this.geometricAlgorithm = null;
        }

        this.config = {
            sameThreshold: options.sameThreshold || 0.6,
            debug: options.debug || false
        };
    }

    // 🔥 ОСНОВНОЙ МЕТОД ДЛЯ СРАВНЕНИЯ ВЕКТОРНЫХ ТОЧЕК
    match(points1, points2, options = {}) {
        console.log(`🎯 SimpleMatcher.match (ВЕКТОРНЫЙ) с ${points1?.length || 0} и ${points2?.length || 0} точками`);

        if (!points1 || !points2 || points1.length === 0 || points2.length === 0) {
            return {
                similarity: 0,
                matches: [],
                error: 'Нет ВЕКТОРНЫХ точек для сравнения',
                decision: 'different'
            };
        }

        try {
            // 🔥 ИСПОЛЬЗУЕМ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ (ВЕКТОРНЫЙ)
            if (this.geometricAlgorithm) {
                const geo1 = this.geometricAlgorithm.createFootprint(points1, 'points1');
                const geo2 = this.geometricAlgorithm.createFootprint(points2, 'points2');

                const result = this.geometricAlgorithm.compareFootprints(geo1, geo2);

                const similarity = result.stats.percent1to2 / 100;
                const decision = similarity > (options.threshold || this.config.sameThreshold) ? 'same' : 'different';

                // Создаем matches для совместимости
                const matches = result.matches.map(match => ({
                    point1: match.point1,
                    point2: match.point2,
                    similarity: match.similarity,
                    distance: match.distance
                }));

                console.log(`📊 ВЕКТОРНОЕ сравнение: ${(similarity * 100).toFixed(1)}% схожести`);

                return {
                    similarity: similarity,
                    matches: matches,
                    matchedPoints: matches,
                    decision: decision,
                    method: 'geometric_hash_vector',
                    confidence: similarity,
                    isSame: decision === 'same',
                    reason: `ВЕКТОРНОЕ сходство: ${(similarity * 100).toFixed(1)}%`
                };
            } else {
                // Fallback: простое ВЕКТОРНОЕ сравнение
                return this.vectorFallbackComparison(points1, points2);
            }

        } catch (error) {
            console.error(`❌ Ошибка в SimpleMatcher.match (ВЕКТОРНЫЙ): ${error.message}`);
            return this.vectorFallbackComparison(points1, points2);
        }
    }

    // 🔥 МЕТОД ДЛЯ СРАВНЕНИЯ ОТПЕЧАТКОВ (для совместимости)
    compare(footprint1, footprint2, options = {}) {
        console.log(`🔍 SimpleMatcher.compare для следов (ВЕКТОРНЫЙ)`);

        try {
            // Извлекаем ВЕКТОРНЫЕ точки
            const points1 = this.extractVectorPoints(footprint1);
            const points2 = this.extractVectorPoints(footprint2);

            return this.match(points1, points2, options);
        } catch (error) {
            console.error(`❌ Ошибка в SimpleMatcher.compare (ВЕКТОРНЫЙ): ${error.message}`);
            return {
                similarity: 0.5,
                matches: [],
                decision: 'similar',
                error: `Ошибка ВЕКТОРНОГО сравнения: ${error.message}`,
                method: 'error_fallback'
            };
        }
    }

    // 🔥 ВЕКТОРНЫЙ ФОЛЛБЭК: Простое сравнение
    vectorFallbackComparison(points1, points2) {
        if (points1.length === 0 || points2.length === 0) return 0;

        // Находим центры ВЕКТОРНЫХ точек
        const center1 = this.calculateVectorCenter(points1);
        const center2 = this.calculateVectorCenter(points2);

        const dx = center2.x - center1.x;
        const dy = center2.y - center1.y;
        const centerDistance = Math.sqrt(dx * dx + dy * dy);

        // Сравниваем распределение ВЕКТОРНЫХ точек
        const spread1 = this.calculateVectorSpread(points1);
        const spread2 = this.calculateVectorSpread(points2);
        const spreadRatio = Math.min(spread1, spread2) / Math.max(spread1, spread2);

        // Сравниваем количество ВЕКТОРНЫХ точек
        const countRatio = Math.min(points1.length, points2.length) / Math.max(points1.length, points2.length);

        // Вычисляем схожесть
        let similarity = 0;
        const centerSimilarity = Math.max(0, 1 - centerDistance / 100);
        similarity += centerSimilarity * 0.4;
        similarity += spreadRatio * 0.3;
        similarity += countRatio * 0.3;

        similarity = Math.max(0, Math.min(1, similarity));

        const decision = similarity > 0.6 ? 'same' : 'different';

        console.log(`📊 Простое ВЕКТОРНОЕ сравнение: ${(similarity * 100).toFixed(1)}% схожести`);

        return {
            similarity: similarity,
            matches: [],
            matchedPoints: [],
            decision: decision,
            method: 'simple_vector_distance_comparison',
            confidence: similarity,
            isSame: decision === 'same'
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (ВЕКТОРНЫЕ)

    extractVectorPoints(footprint) {
        const points = [];

        // Извлекаем ВЕКТОРНЫЕ точки любым способом
        if (footprint.points && Array.isArray(footprint.points)) {
            return footprint.points.filter(p =>
                p && typeof p.x === 'number' && typeof p.y === 'number' &&
                !isNaN(p.x) && !isNaN(p.y)
            );
        } else if (footprint.graph && footprint.graph.nodes) {
            for (const [, node] of footprint.graph.nodes) {
                if (node && typeof node.x === 'number' && typeof node.y === 'number') {
                    points.push({
                        x: node.x,
                        y: node.y,
                        id: node.id || 'unknown'
                    });
                }
            }
            return points;
        } else if (footprint.getPoints) {
            try {
                const extracted = footprint.getPoints();
                if (Array.isArray(extracted)) {
                    return extracted.filter(p =>
                        p && typeof p.x === 'number' && typeof p.y === 'number' &&
                        !isNaN(p.x) && !isNaN(p.y)
                    );
                }
            } catch (e) {
                return [];
            }
        }

        return points;
    }

    calculateVectorCenter(points) {
        if (points.length === 0) return { x: 0, y: 0 };

        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    calculateVectorSpread(points) {
        if (points.length < 2) return 0;

        const center = this.calculateVectorCenter(points);
        const distances = points.map(p => {
            const dx = p.x - center.x;
            const dy = p.y - center.y;
            return Math.sqrt(dx * dx + dy * dy);
        });

        return distances.reduce((sum, d) => sum + d, 0) / distances.length;
    }

    // 🔥 МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ (ВЕКТОРНЫЕ)

    compareGraphs(graph1, graph2, context = {}) {
        const points1 = this.extractVectorPointsFromGraph(graph1);
        const points2 = this.extractVectorPointsFromGraph(graph2);

        const result = this.match(points1, points2, context);

        return {
            similarity: result.similarity,
            decision: result.decision,
            reason: result.reason,
            method: result.method,
            confidence: result.confidence,
            matchedPoints: result.matchedPoints,
            timeMs: 0,
            context: context
        };
    }

    extractVectorPointsFromGraph(graph) {
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

    // 🔥 Другие методы для совместимости (ВЕКТОРНЫЕ)
    alignAndCompare(graph1, graph2, options = {}) {
        return this.compareGraphs(graph1, graph2, options);
    }

    adaptiveCompare(graph1, graph2, options = {}) {
        return this.compareGraphs(graph1, graph2, { ...options, adaptive: true });
    }

    isSameShoe(graph1, graph2) {
        const result = this.compareGraphs(graph1, graph2);
        return {
            isSame: result.decision === 'same',
            similarity: result.similarity,
            confidence: result.confidence,
            reason: result.reason
        };
    }

    findMostSimilar(targetGraph, graphList, maxResults = 5) {
        console.log(`🔎 Ищу похожие ВЕКТОРНЫЕ графы для "${targetGraph.name}" среди ${graphList.length} кандидатов...`);

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

        comparisons.sort((a, b) => b.similarity - a.similarity);

        const bestMatches = comparisons.slice(0, maxResults);

        console.log(`✅ Найдено ${bestMatches.length} похожих ВЕКТОРНЫХ графов`);

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

    // 🔥 Простые методы логирования
    getStats() {
        return {
            algorithm: this.geometricAlgorithm ? 'geometric_hash_vector' : 'simple_vector_fallback',
            geometricAvailable: !!this.geometricAlgorithm,
            config: this.config
        };
    }
}

module.exports = SimpleMatcher;
