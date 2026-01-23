// modules/footprint/core/comparison/footprint-comparison-engine.js
// 🔥 ИСПРАВЛЕНИЕ NaN ПРОБЛЕМ И ДОБАВЛЕНИЕ ЗАЩИТЫ

class FootprintComparisonEngine {
    constructor(manager) {
        this.manager = manager;
        this.config = manager.config;
       
        this.RotationInvariance = require('../../rotation-invariance');
        this.SimpleGraph = require('../../simple-graph');
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД С ЗАЩИТОЙ ОТ NaN
    async compareWithPatterns(footprint1, footprint2) {
        console.log(`🎯 Сравнение через паттерны: "${footprint1.name}" vs "${footprint2.name}"`);

        try {
            // 🔥 ЗАЩИТА ОТ ПУСТЫХ ДАННЫХ
            if (!footprint1 || !footprint2) {
                console.log('❌ Один из отпечатков не существует');
                return this.createErrorResult('invalid_footprint');
            }

            // Получаем точки для сравнения
            let points1, points2;

            try {
                points1 = footprint1.getPointsForPatternMatching ?
                    footprint1.getPointsForPatternMatching() :
                    this.manager.extractPointsFromFootprint(footprint1);
                points2 = footprint2.getPointsForPatternMatching ?
                    footprint2.getPointsForPatternMatching() :
                    this.manager.extractPointsFromFootprint(footprint2);
            } catch (error) {
                console.log(`⚠️ Ошибка получения точек: ${error.message}`);
                points1 = this.manager.extractPointsFromFootprint(footprint1);
                points2 = this.manager.extractPointsFromFootprint(footprint2);
            }

            // 🔥 ПРОВЕРКА НА ПУСТЫЕ ДАННЫЕ
            if (!points1 || points1.length === 0 || !points2 || points2.length === 0) {
                console.log('❌ Нет точек для сравнения');
                return this.createErrorResult('no_points', {
                    points1: points1?.length || 0,
                    points2: points2?.length || 0
                });
            }

            console.log(`🔍 Точки для сравнения: ${points1.length} vs ${points2.length}`);

            // Используем SimpleMatcher если есть, иначе простой алгоритм
            let matchResult;
            if (this.manager.matcher && this.manager.matcher.matchPatterns) {
                matchResult = this.manager.matcher.matchPatterns(points1, points2);
            } else {
                matchResult = this.simplePatternMatch(points1, points2);
            }

            // 🔥 ЗАЩИТА ОТ NaN
            let similarity = matchResult.similarity || 0;

            if (isNaN(similarity) || !isFinite(similarity)) {
                console.log('⚠️ Обнаружен NaN в схожести, сбрасываю на 0');
                similarity = 0;
            }

            // Ограничиваем диапазон
            similarity = Math.max(0, Math.min(1, similarity));

            // 🔥 ДЕТАЛЬНАЯ ДИАГНОСТИКА ПРИ ПРОБЛЕМАХ
            if (similarity === 0 && points1.length > 0 && points2.length > 0) {
                console.log('🔍 Детальный анализ нулевой схожести:');
                console.log(`   Точки 1: ${points1.length}, пример: (${points1[0]?.x}, ${points1[0]?.y})`);
                console.log(`   Точки 2: ${points2.length}, пример: (${points2[0]?.x}, ${points2[0]?.y})`);

                const system1 = this.manager.detectCoordinateSystem ?
                    this.manager.detectCoordinateSystem(points1) : 'unknown';
                const system2 = this.manager.detectCoordinateSystem ?
                    this.manager.detectCoordinateSystem(points2) : 'unknown';
                console.log(`   Системы: ${system1} vs ${system2}`);
            }

            // Принимаем решение
            const decision = this.makeDecision(similarity, matchResult);

            console.log(`📊 Реальная схожесть: ${(similarity * 100).toFixed(1)}%`);
            console.log(`🎯 Финальная схожесть для решения: ${(similarity * 100).toFixed(1)}%`);

            return {
                similarity: similarity,
                decision: decision,
                method: 'pattern_based',
                matchResult: matchResult,
                pointsCounts: {
                    footprint1: points1.length,
                    footprint2: points2.length
                },
                valid: true
            };

        } catch (error) {
            console.log(`❌ Критическая ошибка в compareWithPatterns: ${error.message}`);
            return this.createErrorResult('comparison_error', { error: error.message });
        }
    }

    // 🔥 ПРОСТОЙ АЛГОРИТМ СРАВНЕНИЯ (если нет matcher)
    simplePatternMatch(points1, points2) {
        console.log('🔄 Использую простой алгоритм сравнения паттернов');
       
        let matches = 0;
        const matchDetails = [];
        const threshold = 50; // 50px порог

        for (const point1 of points1) {
            let bestMatch = null;
            let minDistance = Infinity;

            for (const point2 of points2) {
                const distance = Math.sqrt(
                    Math.pow(point2.x - point1.x, 2) +
                    Math.pow(point2.y - point1.y, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = {
                        point1,
                        point2,
                        distance
                    };
                }
            }

            if (bestMatch && minDistance < threshold) {
                matches++;
                matchDetails.push(bestMatch);
            }
        }

        const similarity = matches / Math.max(points1.length, points2.length);

        return {
            similarity,
            matches,
            matchDetails,
            threshold
        };
    }

    createErrorResult(errorType, details = {}) {
        return {
            similarity: 0,
            decision: 'error',
            method: 'error',
            error: errorType,
            details: details,
            valid: false
        };
    }

    makeDecision(similarity, matchResult) {
        // 🔥 ИСПОЛЬЗУЕМ ЕДИНЫЙ ПОРОГ
        const thresholds = this.manager.DECISION_THRESHOLDS || {
            PATTERN_SIMILARITY: 0.6,
            MIN_MATCHES: 10
        };

        if (similarity > thresholds.PATTERN_SIMILARITY) {
            return 'same';
        } else if (similarity > 0.3) {
            return 'similar';
        } else {
            return 'different';
        }
    }

    // 🔥 Другие методы из оригинального файла
    async compareWithAlignment(footprint1, footprint2) {
        console.log(`🎯 Сравнение с ВЫРАВНИВАНИЕМ: "${footprint1.name}" vs "${footprint2.name}"`);

        // Получаем точки
        const points1 = this.getPointsInConsistentSystem(footprint1);
        const points2 = this.getPointsInConsistentSystem(footprint2);

        console.log(`📊 Точки для сравнения: ${points1.length} и ${points2.length}`);

        // Используем улучшенный алайнер если есть
        let alignmentResult;
        if (this.manager.improvedAligner && this.manager.improvedAligner.alignWithIntelligentMatching) {
            alignmentResult = await this.manager.improvedAligner.alignWithIntelligentMatching(
                points2, points1,
                footprint2.getTransformation ? footprint2.getTransformation() : null,
                footprint1.getTransformation ? footprint1.getTransformation() : null
            );
        } else {
            // Простое выравнивание
            alignmentResult = await this.simpleAlignment(points1, points2);
        }

        if (alignmentResult && alignmentResult.success) {
            return this.compareAlignedFootprints(points1, alignmentResult.alignedPoints || []);
        } else {
            console.log(`⚠️ Выравнивание не удалось`);
            return await this.compareWithPatterns(footprint1, footprint2);
        }
    }

    getPointsInConsistentSystem(footprint) {
        const points = [];

        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                if (point.originalCoordinates) {
                    points.push({
                        x: point.originalCoordinates.x,
                        y: point.originalCoordinates.y,
                        id: id,
                        confidence: point.rating || 0.5
                    });
                } else {
                    points.push({
                        x: point.x,
                        y: point.y,
                        id: id,
                        confidence: point.rating || 0.5
                    });
                }
            }
        }

        console.log(`📊 Точки в согласованной системе: ${points.length}`);
        return points;
    }

    async simpleAlignment(points1, points2) {
        console.log('🔄 Простое выравнивание точек');
       
        // Простой алгоритм: находим центры и сдвигаем
        const center1 = this.calculateCenter(points1);
        const center2 = this.calculateCenter(points2);
       
        const dx = center1.x - center2.x;
        const dy = center1.y - center2.y;
       
        const alignedPoints = points2.map(p => ({
            ...p,
            x: p.x + dx,
            y: p.y + dy
        }));
       
        return {
            success: true,
            alignedPoints,
            translation: { dx, dy },
            center1,
            center2
        };
    }

    compareAlignedFootprints(points1, alignedPoints2) {
        let perfectMatches = 0;
        let goodMatches = 0;
        let acceptableMatches = 0;
        const matches = [];

        const PERFECT_THRESHOLD = 15;
        const GOOD_THRESHOLD = 30;
        const ACCEPTABLE_THRESHOLD = 50;

        alignedPoints2.forEach(alignedPoint => {
            let bestMatch = null;
            let minDistance = Infinity;

            for (const point1 of points1) {
                const distance = Math.sqrt(
                    Math.pow(point1.x - alignedPoint.x, 2) +
                    Math.pow(point1.y - alignedPoint.y, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = {
                        point1,
                        alignedPoint,
                        distance,
                        quality: this.calculateMatchQuality(distance, alignedPoint.confidence || 0.5)
                    };
                }
            }

            if (bestMatch) {
                matches.push(bestMatch);

                if (minDistance < PERFECT_THRESHOLD) {
                    perfectMatches++;
                } else if (minDistance < GOOD_THRESHOLD) {
                    goodMatches++;
                } else if (minDistance < ACCEPTABLE_THRESHOLD) {
                    acceptableMatches++;
                }
            }
        });

        const totalMatches = perfectMatches + goodMatches + acceptableMatches;
        const similarity = totalMatches / Math.max(points1.length, alignedPoints2.length);

        let decision, reason;
        if (similarity > 0.7) {
            decision = 'same';
            reason = `Высокое совпадение: ${perfectMatches}/${points1.length} точных, ${goodMatches}/${points1.length} хороших`;
        } else if (similarity > 0.4) {
            decision = 'similar';
            reason = `Умеренное совпадение: ${perfectMatches}/${points1.length} точных, ${goodMatches}/${points1.length} хороших`;
        } else {
            decision = 'different';
            reason = `Низкое совпадение: ${perfectMatches}/${points1.length} точных, ${goodMatches}/${points1.length} хороших`;
        }

        return {
            similarity,
            decision,
            reason,
            matches,
            perfectMatches,
            goodMatches,
            acceptableMatches,
            totalMatches,
            points1Count: points1.length,
            points2Count: alignedPoints2.length,
            method: 'enhanced_alignment'
        };
    }

    calculateCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };

        const sumX = points.reduce((acc, p) => acc + (p.x || 0), 0);
        const sumY = points.reduce((acc, p) => acc + (p.y || 0), 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    calculateMatchQuality(distance, confidence) {
        const distanceScore = Math.max(0, 1 - distance / 50);
        const confidenceScore = confidence || 0.5;
        return (distanceScore * 0.7 + confidenceScore * 0.3);
    }

    // 🔥 Метод для сравнения с повернутыми следами
    async compareWithFixedAlignment(footprint1, footprint2) {
        console.log(`🎯 УМНОЕ СРАВНЕНИЕ С ПОВЕРНУТЫМИ СЛЕДАМИ`);

        const points1 = this.getPointsInConsistentSystem(footprint1);
        const points2 = this.getPointsInConsistentSystem(footprint2);

        // Проверить ориентацию
        const needsRotationCorrection = this.checkIfNeeds90DegreeRotation(points1, points2);

        let adjustedPoints2 = [...points2];
        if (needsRotationCorrection) {
            console.log('🔄 Применяю коррекцию поворота 90°...');
            adjustedPoints2 = this.apply90DegreeRotation(adjustedPoints2);
        }

        // Выравнивание
        const alignmentResult = await this.simpleAlignment(points1, adjustedPoints2);

        // Сравнение
        return this.compareAlignedFootprints(points1, alignmentResult.alignedPoints);
    }

    checkIfNeeds90DegreeRotation(points1, points2) {
        const bounds1 = this.calculateBounds(points1);
        const bounds2 = this.calculateBounds(points2);

        const ratio1 = bounds1.width / Math.max(1, bounds1.height);
        const ratio2 = bounds2.width / Math.max(1, bounds2.height);

        const needsCorrection = (ratio1 > 2.0 && ratio2 < 0.5) || (ratio1 < 0.5 && ratio2 > 2.0);

        console.log(`📏 Пропорции: ${ratio1.toFixed(2)} vs ${ratio2.toFixed(2)} -> ${needsCorrection ? 'НУЖНА коррекция' : 'OK'}`);

        return needsCorrection;
    }

    apply90DegreeRotation(points) {
        const center = this.calculateCenter(points);

        const rotatedPoints = points.map(point => {
            let x = point.x - center.x;
            let y = point.y - center.y;

            const rotatedX = -y;
            const rotatedY = x;

            return {
                ...point,
                x: rotatedX + center.x,
                y: rotatedY + center.y,
                rotated90: true
            };
        });

        return rotatedPoints;
    }

    calculateBounds(points) {
        if (!points || points.length === 0) return { width: 0, height: 0 };

        const xs = points.map(p => p.x || 0);
        const ys = points.map(p => p.y || 0);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return {
            minX, maxX, minY, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    // 🔥 Метод из оригинального файла с исправлением NaN
    async compareWithPatternsFixed(footprint1, footprint2) {
        console.log(`\n🎯 СРАВНЕНИЕ С ВЫРАВНИВАНИЕМ: "${footprint1.name}" vs "${footprint2.name}"`);

        const processor = new this.RotationInvariance({ debug: true });

        const points1_raw = this.manager.extractPointsFromFootprint ?
            this.manager.extractPointsFromFootprint(footprint1) : [];
        const points2_raw = this.manager.extractPointsFromFootprint ?
            this.manager.extractPointsFromFootprint(footprint2) : [];

        const angle1 = footprint1.getTransformation ?
            (footprint1.getTransformation()?.rotationAngle || 0) : 0;
        const angle2 = footprint2.getTransformation ?
            (footprint2.getTransformation()?.rotationAngle || 0) : 0;

        console.log(`📐 УГЛЫ ПОВОРОТА: ${angle1.toFixed(1)}° vs ${angle2.toFixed(1)}°`);

        const points1 = processor.transformPointsSimple(points1_raw, angle1, 0);
        const points2 = processor.transformPointsSimple(points2_raw, angle2, 0);

        const points1_centered = processor.alignPointsToCommonSystem(points1);
        const points2_centered = processor.alignPointsToCommonSystem(points2);

        console.log(`📊 ТОЧКИ: ${points1_centered.length} vs ${points2_centered.length}`);

        const center1 = processor.calculateCenter(points1_centered);
        const center2 = processor.calculateCenter(points2_centered);
        const centerDistance = Math.sqrt(
            Math.pow(center2.x - center1.x, 2) +
            Math.pow(center2.y - center1.y, 2)
        );

        console.log(`📏 РАССТОЯНИЕ МЕЖДУ ЦЕНТРАМИ: ${centerDistance.toFixed(1)}px`);

        const adaptiveThreshold = Math.max(25, Math.min(50, centerDistance / 2));
        console.log(`🎯 Адаптивный порог: ${adaptiveThreshold.toFixed(1)}px`);

        let matches = 0;
        const matchDetails = [];

        for (const point1 of points1_centered) {
            let bestMatch = null;
            let minDistance = Infinity;

            for (const point2 of points2_centered) {
                const distance = Math.sqrt(
                    Math.pow(point2.x - point1.x, 2) +
                    Math.pow(point2.y - point1.y, 2)
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = {
                        point1,
                        point2,
                        distance
                    };
                }
            }

            if (bestMatch && minDistance < adaptiveThreshold) {
                matches++;
                matchDetails.push(bestMatch);
            }
        }

        const REAL_THRESHOLDS = {
            PERFECT: 15,
            GOOD: 30,
            ACCEPTABLE: 50
        };

        const realMatches = matchDetails.filter(match =>
            match.distance < REAL_THRESHOLDS.ACCEPTABLE
        );

        const falseMatches = matchDetails.filter(match =>
            match.distance >= REAL_THRESHOLDS.ACCEPTABLE
        );

        console.log(`🔍 РЕАЛЬНЫЕ СОВПАДЕНИЯ: ${realMatches.length}/${matchDetails.length}`);

        const realSimilarity = realMatches.length / Math.max(points1_centered.length, points2_centered.length, 1);
       
        // 🔥 ЗАЩИТА ОТ NaN
        const finalSimilarity = isNaN(realSimilarity) ? 0 : Math.max(0, Math.min(1, realSimilarity));
       
        console.log(`📊 Реальная схожесть: ${(finalSimilarity * 100).toFixed(1)}%`);

        let decision, reason;
        if (finalSimilarity > 0.7) {
            decision = 'same';
            reason = `Высокое сходство (${(finalSimilarity * 100).toFixed(1)}%) после выравнивания`;
        } else if (finalSimilarity > 0.4) {
            decision = 'similar';
            reason = `Умеренное сходство (${(finalSimilarity * 100).toFixed(1)}%) после выравнивания`;
        } else {
            decision = 'different';
            reason = `Низкое сходство (${(finalSimilarity * 100).toFixed(1)}%) после выравнивания`;
        }

        return {
            similarity: finalSimilarity,
            decision,
            reason,
            matchesCount: realMatches.length,
            totalPoints: Math.max(points1_centered.length, points2_centered.length),
            alignmentInfo: {
                centerDistance,
                adaptiveThreshold,
                center1,
                center2,
                angle1,
                angle2
            },
            diagnostics: {
                totalMatches: matchDetails.length,
                realMatches: realMatches.length,
                falseMatches: falseMatches.length
            }
        };
    }
}

module.exports = FootprintComparisonEngine;
