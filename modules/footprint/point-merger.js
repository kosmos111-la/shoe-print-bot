// modules/footprint/point-merger.js
// АЛГОРИТМ ИНТЕЛЛЕКТУАЛЬНОГО СЛИЯНИЯ ТОЧЕК

class PointMerger {
    constructor(options = {}) {
        this.config = {
            mergeDistance: options.mergeDistance || 40, // БЫЛО 15! УВЕЛИЧИВАЕМ!
            confidenceBoost: options.confidenceBoost || 1.5,
            minConfidenceForMerge: options.minConfidenceForMerge || 0.2, // БЫЛО 0.4! СНИЖАЕМ!
            ...options
        };
        console.log(`🔧 PointMerger создан: mergeDistance=${this.config.mergeDistance}px`);
    }
    // 1. ОСНОВНОЙ МЕТОД СЛИЯНИЯ
    mergePoints(points1, points2, transformation = null) {
        console.log(`🔄 Интеллектуальное слияние: ${points1.length} + ${points2.length} точек`);
       
        // Применить трансформацию ко второму набору точек
        const transformedPoints2 = transformation
            ? this.applyTransformation(points2, transformation)
            : points2;

        // Найти соответствия между точками
        const matches = this.findPointMatches(points1, transformedPoints2);
       
        // Выполнить слияние
        const mergedPoints = this.performMerge(points1, transformedPoints2, matches);
       
        console.log(`✅ Результат слияния: ${mergedPoints.length} точек`);
        console.log(`   📊 Совпадений: ${matches.length}`);
        console.log(`   📈 Эффективность: ${((points1.length + points2.length - mergedPoints.length) / (points1.length + points2.length) * 100).toFixed(1)}% сокращение`);
       
        return {
            points: mergedPoints,
            matches: matches,
            stats: {
                originalCount1: points1.length,
                originalCount2: points2.length,
                mergedCount: mergedPoints.length,
                matchesCount: matches.length,
                uniqueFrom1: mergedPoints.filter(p => p.source === 'footprint1').length,
                uniqueFrom2: mergedPoints.filter(p => p.source === 'footprint2').length,
                mergedPoints: mergedPoints.filter(p => p.source === 'merged').length,
                transformationApplied: !!transformation
            }
        };
    }

    // 2. ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ
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
           
            return { ...p, x, y, transformed: true };
        });
    }

    // 3. НАЙТИ СООТВЕТСТВИЯ МЕЖДУ ТОЧКАМИ
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
               
                if (distance < this.config.mergeDistance &&
                    distance < bestDistance &&
                    (p1.confidence || 0.5) >= this.config.minConfidenceForMerge &&
                    (p2.confidence || 0.5) >= this.config.minConfidenceForMerge) {
                   
                    bestDistance = distance;
                    bestMatch = p2;
                    bestIndex = j;
                }
            }
           
            if (bestMatch && bestDistance < this.config.mergeDistance) {
                matches.push({
                    index1: i,
                    index2: bestIndex,
                    point1: p1,
                    point2: bestMatch,
                    distance: bestDistance,
                    mergeScore: this.calculateMergeScore(p1, bestMatch, bestDistance)
                });
                usedIndices2.add(bestIndex);
            }
        }
       
        return matches;
    }

    // 4. ВЫПОЛНИТЬ СЛИЯНИЕ НА ОСНОВЕ СООТВЕТСТВИЙ
    performMerge(points1, points2, matches) {
        const mergedPoints = [];
        const usedIndices1 = new Set();
        const usedIndices2 = new Set();
       
        // 1. СЛИТЬ СОВПАДАЮЩИЕ ТОЧКИ
        matches.forEach(match => {
            const p1 = points1[match.index1];
            const p2 = points2[match.index2];
           
            // Усреднить координаты
            const mergedPoint = {
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2,
                confidence: Math.max(p1.confidence || 0.5, p2.confidence || 0.5) * this.config.confidenceBoost,
                source: 'merged',
                originalPoints: [p1, p2],
                matchDistance: match.distance,
                mergeScore: match.mergeScore,
                metadata: {
                    fromFootprint1: true,
                    fromFootprint2: true,
                    mergedAt: new Date()
                }
            };
           
            mergedPoints.push(mergedPoint);
            usedIndices1.add(match.index1);
            usedIndices2.add(match.index2);
        });
       
        // 2. ДОБАВИТЬ УНИКАЛЬНЫЕ ТОЧКИ ИЗ ПЕРВОГО НАБОРА
        points1.forEach((p, i) => {
            if (!usedIndices1.has(i)) {
                mergedPoints.push({
                    ...p,
                    source: 'footprint1',
                    metadata: {
                        fromFootprint1: true,
                        fromFootprint2: false
                    }
                });
            }
        });
       
        // 3. ДОБАВИТЬ УНИКАЛЬНЫЕ ТОЧКИ ИЗ ВТОРОГО НАБОРА
        points2.forEach((p, i) => {
            if (!usedIndices2.has(i)) {
                mergedPoints.push({
                    ...p,
                    source: 'footprint2',
                    metadata: {
                        fromFootprint1: false,
                        fromFootprint2: true
                    }
                });
            }
        });
       
        // 4. УДАЛИТЬ ДУБЛИКАТЫ (на всякий случай)
        return this.removeDuplicates(mergedPoints);
    }

    // 5. РАССЧИТАТЬ SCORE СЛИЯНИЯ
    calculateMergeScore(p1, p2, distance) {
        const confidence1 = p1.confidence || 0.5;
        const confidence2 = p2.confidence || 0.5;
       
        const confidenceScore = (confidence1 + confidence2) / 2;
        const distanceScore = 1 - (distance / this.config.mergeDistance);
       
        return confidenceScore * 0.6 + distanceScore * 0.4;
    }

    // 6. УДАЛИТЬ ДУБЛИКАТЫ
    removeDuplicates(points) {
        const uniquePoints = [];
        const seen = new Set();
       
        points.forEach(p => {
            const key = `${p.x.toFixed(1)}_${p.y.toFixed(1)}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniquePoints.push(p);
            }
        });
       
        return uniquePoints;
    }

    // 7. АНАЛИЗ РЕЗУЛЬТАТОВ СЛИЯНИЯ
    analyzeMergeResults(original1, original2, merged) {
        const stats = {
            totalReduction: original1.length + original2.length - merged.length,
            reductionPercentage: ((original1.length + original2.length - merged.length) /
                                 (original1.length + original2.length) * 100).toFixed(1),
            avgConfidenceBefore: (original1.reduce((s, p) => s + (p.confidence || 0.5), 0) / original1.length +
                                 original2.reduce((s, p) => s + (p.confidence || 0.5), 0) / original2.length) / 2,
            avgConfidenceAfter: merged.reduce((s, p) => s + (p.confidence || 0.5), 0) / merged.length
        };
       
        return stats;
    }
}

module.exports = PointMerger;
