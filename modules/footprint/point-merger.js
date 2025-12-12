// modules/footprint/point-merger.js
// АЛГОРИТМ ИНТЕЛЛЕКТУАЛЬНОГО СЛИЯНИЯ ТОЧЕК

const path = require('path');
const fs = require('fs');
const { createCanvas } = require('canvas');

class PointMerger {
    constructor(options = {}) {
        this.config = {
            mergeDistance: options.mergeDistance || 40,
            confidenceBoost: options.confidenceBoost || 1.5,
            minConfidenceForMerge: options.minConfidenceForMerge || 0.2,
            ...options
        };
        console.log(`🔧 PointMerger создан: mergeDistance=${this.config.mergeDistance}px`);
    }

    // 1. ОСНОВНОЙ МЕТОД СЛИЯНИЯ ДВУХ ТОЧЕК (ИСПРАВЛЕННЫЙ)
    mergeTwoPoints(point1, point2, transformation = null) {
        // Безопасно получить координаты
        const x1 = point1.x || 0;
        const y1 = point1.y || 0;
        const x2 = point2.x || 0;
        const y2 = point2.y || 0;

        // Рассчитать расстояние
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 🔴 ПРОВЕРКА: если точки слишком далеко, не сливаем
        if (distance > this.config.mergeDistance) {
            return null;
        }

        // 🔴 РАСЧЕТ SIMILARITY SCORE (0.0-1.0)
        const similarityScore = Math.max(0, 1 - (distance / this.config.mergeDistance));

        // 🔴 ИСПРАВЛЕНИЕ: Проверка минимального сходства
        if (similarityScore === 0.000 || similarityScore < 0.1) {
            // Слишком разные точки, не сливаем
            return null;
        }

        // Безопасно получить confidence
        const confidence1 = Math.max(0.0, Math.min(1.0, point1.confidence || 0.5));
        const confidence2 = Math.max(0.0, Math.min(1.0, point2.confidence || 0.5));

        // 🔴 ИСПРАВЛЕННЫЙ РАСЧЕТ CONFIDENCE
        // Взвешенное среднее с учетом confidence каждой точки
        const weight1 = confidence1;
        const weight2 = confidence2;
        const baseConfidence = (confidence1 * weight1 + confidence2 * weight2) / (weight1 + weight2);

        // Увеличение confidence за счет подтверждения (НО НЕ БОЛЬШЕ 1.0!)
        const similarityFactor = 0.5 + (similarityScore * 0.5); // 0.5-1.0
        const boostedConfidence = baseConfidence * this.config.confidenceBoost * similarityFactor;

        // 🔴 ОГРАНИЧИТЬ ДИАПАЗОН [0.0, 1.0]
        const finalConfidence = Math.max(0.0, Math.min(1.0, boostedConfidence));

        // 🔴 СОХРАНИТЬ ИНФОРМАЦИЮ О SOURCE
        const source1 = point1.source || 'unknown';
        const source2 = point2.source || 'unknown';

        return {
            x: (x1 + x2) / 2,
            y: (y1 + y2) / 2,
            confidence: finalConfidence,
            source: 'merged',
            originalSources: [
                { source: source1, confidence: confidence1 },
                { source: source2, confidence: confidence2 }
            ],
            mergedFrom: [point1.id || 'unknown1', point2.id || 'unknown2'],
            similarityScore: similarityScore,
            mergeDistance: distance,
            metadata: {
                ...(point1.metadata || {}),
                ...(point2.metadata || {}),
                mergedAt: new Date().toISOString()
            }
        };
    }

    // 2. ОСНОВНОЙ МЕТОД СЛИЯНИЯ МНОЖЕСТВА ТОЧЕК
    mergePoints(points1, points2, transformation = null) {
        console.log(`🔄 Интеллектуальное слияние: ${points1.length} + ${points2.length} точек`);

        // Нормализовать точки перед обработкой
        const normalizedPoints1 = this.normalizePoints(points1, 'footprint1');
        const normalizedPoints2 = this.normalizePoints(points2, 'footprint2');

        // Применить трансформацию ко второму набору точек
        const transformedPoints2 = transformation
            ? this.applyTransformation(normalizedPoints2, transformation)
            : normalizedPoints2;

        // Найти соответствия между точками
        const matches = this.findPointMatches(normalizedPoints1, transformedPoints2);

        // Выполнить слияние (ИСПРАВЛЕННЫЙ МЕТОД)
        const mergeResult = this.performMergeWithSources(normalizedPoints1, transformedPoints2, matches, transformation);
       
        const allPoints = mergeResult.points;
        const stats = mergeResult.stats;

        console.log(`✅ Результат слияния: ${allPoints.length} точек`);
        console.log(`   📊 Совпадений: ${matches.length}`);
        console.log(`   📈 Эффективность: ${stats.efficiency}`);

        // 🔴 ПРОВЕРИТЬ CONFIDENCE В РЕЗУЛЬТАТЕ
        const confidenceIssues = this.checkConfidenceIssues(allPoints);
        if (confidenceIssues.length > 0) {
            console.log(`⚠️  Обнаружены проблемы с confidence:`, confidenceIssues);
            // Исправить автоматически
            allPoints.forEach((point, i) => {
                if (point.confidence > 1.0 || point.confidence < 0) {
                    allPoints[i].confidence = Math.max(0.0, Math.min(1.0, point.confidence));
                }
            });
        }

        return {
            points: allPoints,
            matches: matches,
            stats: stats
        };
    }

    // 3. НОРМАЛИЗАЦИЯ ТОЧЕК (новый метод)
    normalizePoints(points, defaultSource) {
        return points.map((point, index) => {
            // Убедиться, что есть source
            const source = point.source || defaultSource || 'unknown';

            // Нормализовать confidence
            let confidence = point.confidence || 0.5;
            confidence = Math.max(0.0, Math.min(1.0, confidence));

            // Создать уникальный ID если нет
            const id = point.id || `${defaultSource}_${index}_${Date.now()}`;

            return {
                ...point,
                x: point.x || 0,
                y: point.y || 0,
                confidence: confidence,
                source: source,
                id: id,
                metadata: point.metadata || {}
            };
        });
    }

    // 4. ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ
    applyTransformation(points, transformation) {
        if (!transformation || transformation.type === 'insufficient_points') {
            return points;
        }

        return points.map(p => {
            let x = p.x;
            let y = p.y;

            if (transformation.translation) {
                x += transformation.translation.dx || 0;
                y += transformation.translation.dy || 0;
            }

            if (transformation.rotation && transformation.rotation !== 0) {
                const rad = transformation.rotation * Math.PI / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const newX = x * cos - y * sin;
                const newY = x * sin + y * cos;
                x = newX;
                y = newY;
            }

            if (transformation.scale && transformation.scale !== 1) {
                x *= transformation.scale;
                y *= transformation.scale;
            }

            return {
                ...p,
                x,
                y,
                transformed: true,
                // 🔴 СОХРАНИТЬ ИСТОРИЮ ТРАНСФОРМАЦИИ
                transformationHistory: [
                    ...(p.transformationHistory || []),
                    { type: 'merge_transformation', ...transformation }
                ]
            };
        });
    }

    // 5. НАЙТИ СООТВЕТСТВИЯ МЕЖДУ ТОЧКАМИ
    findPointMatches(points1, points2) {
        const matches = [];
        const usedIndices2 = new Set();

        // Для каждой точки из первого набора
        for (let i = 0; i < points1.length; i++) {
            const p1 = points1[i];
            let bestMatch = null;
            let bestDistance = Infinity;
            let bestIndex = -1;

            // Найти ближайшую точку во втором наборе
            for (let j = 0; j < points2.length; j++) {
                if (usedIndices2.has(j)) continue;

                const p2 = points2[j];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // 🔴 ИСПРАВЛЕНИЕ: Только если confidence достаточно высок
                const conf1 = p1.confidence || 0.5;
                const conf2 = p2.confidence || 0.5;

                if (distance < this.config.mergeDistance &&
                    distance < bestDistance &&
                    conf1 >= this.config.minConfidenceForMerge &&
                    conf2 >= this.config.minConfidenceForMerge) {

                    bestDistance = distance;
                    bestMatch = p2;
                    bestIndex = j;
                }
            }

            if (bestMatch && bestDistance < this.config.mergeDistance) {
                // 🔴 РАСЧЕТ SCORE С УЧЕТОТОМ СХОДСТВА
                const similarityScore = Math.max(0, 1 - (bestDistance / this.config.mergeDistance));

                matches.push({
                    index1: i,
                    index2: bestIndex,
                    point1: p1,
                    point2: bestMatch,
                    distance: bestDistance,
                    similarityScore: similarityScore,
                    mergeScore: this.calculateMergeScore(p1, bestMatch, bestDistance)
                });
                usedIndices2.add(bestIndex);
            }
        }

        return matches;
    }

    // 6. ВЫПОЛНИТЬ СЛИЯНИЕ С СОХРАНЕНИЕМ SOURCE И УНИКАЛЬНЫХ ТОЧЕК
    performMergeWithSources(points1, points2, matches, transformation = null) {
        const mergedPoints = [];
        const usedIndices1 = new Set();
        const usedIndices2 = new Set();

        // 1. СЛИТЬ СОВПАДАЮЩИЕ ТОЧКИ
        matches.forEach(match => {
            const p1 = points1[match.index1];
            const p2 = points2[match.index2];

            // Использовать исправленный метод mergeTwoPoints
            const mergedPoint = this.mergeTwoPoints(p1, p2);

            if (mergedPoint) {
                mergedPoints.push(mergedPoint);
                usedIndices1.add(match.index1);
                usedIndices2.add(match.index2);
            } else {
                // Если точки не были слиты, добавить их как отдельные
                if (!usedIndices1.has(match.index1)) {
                    mergedPoints.push({
                        ...p1,
                        source: p1.source || 'footprint1',
                        metadata: {
                            ...p1.metadata,
                            fromFootprint1: true,
                            fromFootprint2: false,
                            mergeAttempted: true,
                            mergeFailedReason: 'points_too_different'
                        }
                    });
                    usedIndices1.add(match.index1);
                }

                if (!usedIndices2.has(match.index2)) {
                    mergedPoints.push({
                        ...p2,
                        source: p2.source || 'footprint2',
                        metadata: {
                            ...p2.metadata,
                            fromFootprint1: false,
                            fromFootprint2: true,
                            mergeAttempted: true,
                            mergeFailedReason: 'points_too_different'
                        }
                    });
                    usedIndices2.add(match.index2);
                }
            }
        });

        // 🔴 ДОБАВЛЕНО: Добавление уникальных точек
        const uniqueFrom1 = [];
        const uniqueFrom2 = [];

        // 1. Найти уникальные точки из первого набора
        points1.forEach((point, index) => {
            if (!usedIndices1.has(index)) {
                uniqueFrom1.push({
                    ...point,
                    source: 'footprint1',
                    confidence: Math.max(0.0, Math.min(1.0, point.confidence || 0.5)),
                    metadata: {
                        ...point.metadata,
                        fromFootprint1: true,
                        fromFootprint2: false,
                        uniquePoint: true
                    }
                });
            }
        });

        // 2. Найти уникальные точки из второго набора
        points2.forEach((point, index) => {
            if (!usedIndices2.has(index)) {
                uniqueFrom2.push({
                    ...point,
                    source: 'footprint2',
                    confidence: Math.max(0.0, Math.min(1.0, point.confidence || 0.5)),
                    metadata: {
                        ...point.metadata,
                        fromFootprint1: false,
                        fromFootprint2: true,
                        uniquePoint: true
                    }
                });
            }
        });

        // 3. Объединить все точки: слитые + уникальные
        const allPoints = [
            ...mergedPoints,
            ...uniqueFrom1,
            ...uniqueFrom2
        ];

        // 4. Обновить статистику
        const stats = {
            originalCount1: points1.length,
            originalCount2: points2.length,
            mergedCount: mergedPoints.length,
            matchesCount: matches.length,
            uniqueFrom1: uniqueFrom1.length,
            uniqueFrom2: uniqueFrom2.length,
            mergedPoints: mergedPoints.filter(p => p.source === 'merged').length,
            totalPointsAfter: allPoints.length,
            transformationApplied: !!transformation,
            efficiency: ((points1.length + points2.length - allPoints.length) /
                        (points1.length + points2.length) * 100).toFixed(1) + '%'
        };

        return {
            points: allPoints,
            matches: matches,
            stats: stats
        };
    }

    // 7. РАССЧИТАТЬ SCORE СЛИЯНИЯ
    calculateMergeScore(p1, p2, distance) {
        const confidence1 = Math.max(0.0, Math.min(1.0, p1.confidence || 0.5));
        const confidence2 = Math.max(0.0, Math.min(1.0, p2.confidence || 0.5));

        const confidenceScore = (confidence1 + confidence2) / 2;
        const distanceScore = 1 - (distance / this.config.mergeDistance);
        const similarityScore = Math.max(0, distanceScore);

        // 🔴 ИСПРАВЛЕНИЕ: Не сливать точки с нулевым сходством
        if (similarityScore === 0) {
            return 0;
        }

        return confidenceScore * 0.6 + similarityScore * 0.4;
    }

    // 8. УДАЛИТЬ ДУБЛИКАТЫ
    removeDuplicates(points) {
        const uniquePoints = [];
        const seen = new Set();

        points.forEach(p => {
            const key = `${Math.round(p.x)}_${Math.round(p.y)}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniquePoints.push(p);
            }
        });

        return uniquePoints;
    }

    // 9. ПРОВЕРИТЬ ПРОБЛЕМЫ С CONFIDENCE
    checkConfidenceIssues(points) {
        const issues = [];

        points.forEach((point, index) => {
            const confidence = point.confidence || 0.5;

            if (confidence < 0.0) {
                issues.push({
                    index,
                    type: 'confidence_too_low',
                    value: confidence,
                    message: `Confidence меньше 0.0: ${confidence}`
                });
            }

            if (confidence > 1.0) {
                issues.push({
                    index,
                    type: 'confidence_too_high',
                    value: confidence,
                    message: `Confidence больше 1.0: ${confidence}`
                });
            }

            if (!point.source) {
                issues.push({
                    index,
                    type: 'missing_source',
                    message: 'Точка без source'
                });
            }
        });

        return issues;
    }

    // 10. АНАЛИЗ РЕЗУЛЬТАТОВ СЛИЯНИЯ
    analyzeMergeResults(original1, original2, merged) {
        // Рассчитать средние confidence с нормализацией
        const avgConfidence1 = original1.length > 0
            ? original1.reduce((sum, p) => sum + Math.max(0.0, Math.min(1.0, p.confidence || 0.5)), 0) / original1.length
            : 0.5;

        const avgConfidence2 = original2.length > 0
            ? original2.reduce((sum, p) => sum + Math.max(0.0, Math.min(1.0, p.confidence || 0.5)), 0) / original2.length
            : 0.5;

        const avgConfidenceAfter = merged.length > 0
            ? merged.reduce((sum, p) => sum + Math.max(0.0, Math.min(1.0, p.confidence || 0.5)), 0) / merged.length
            : 0.5;

        const avgConfidenceBefore = (avgConfidence1 + avgConfidence2) / 2;

        const stats = {
            totalReduction: original1.length + original2.length - merged.length,
            reductionPercentage: ((original1.length + original2.length - merged.length) /
                                (original1.length + original2.length) * 100).toFixed(1),
            avgConfidenceBefore: avgConfidenceBefore,
            avgConfidenceAfter: avgConfidenceAfter,
            confidenceImprovement: avgConfidenceAfter - avgConfidenceBefore
        };

        return stats;
    }
}

module.exports = PointMerger;
