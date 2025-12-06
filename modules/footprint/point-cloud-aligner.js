// modules/footprint/point-cloud-aligner.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
class PointCloudAligner {
    constructor(options = {}) {
        this.options = {
            // 🔥 ОПТИМАЛЬНЫЕ НАСТРОЙКИ ПО УМОЛЧАНИЮ
            minPointsForAlignment: 4,
            maxIterations: 150,
            inlierThreshold: 20,
            minInliersRatio: 0.6,
            minInliersAbsolute: 4,
            scaleRange: { min: 0.5, max: 2.0 },
            confidenceThreshold: 0.5,
            mirrorCheck: true,
            adaptiveInlierThreshold: true,
            requireGoodDistribution: true,
            // 🔥 НОВЫЕ НАСТРОЙКИ ДЛЯ БОРЬБЫ СО СЛУЧАЙНЫМИ ДАННЫМИ
            requireGoodSpread: true,
            maxRandomScore: 0.3,
            minUniqueAngles: 3,
            mirrorAdvantageThreshold: 0.15,

            ...options
        };

        console.log('🔧 PointCloudAligner создан с параметрами:', {
            maxIterations: this.options.maxIterations,
            inlierThreshold: this.options.inlierThreshold,
            minInliersRatio: this.options.minInliersRatio,
            minInliersAbsolute: this.options.minInliersAbsolute,
            scaleRange: this.options.scaleRange,
            confidenceThreshold: this.options.confidenceThreshold,
            adaptiveInlierThreshold: this.options.adaptiveInlierThreshold,
            maxRandomScore: this.options.maxRandomScore
        });
    }

    // 🔍 ОСНОВНОЙ МЕТОД: НАЙТИ ЛУЧШЕЕ СОВМЕЩЕНИЕ
    findBestAlignment(points1, points2, initialGuess = null) {
        console.log(`🎯 Поиск наилучшего выравнивания для ${points1.length} и ${points2.length} точек`);

        // 🔥 ИСПРАВЛЕНИЕ: Проверка с минимальным количеством точек
        const minPoints = Math.max(4, this.options.minPointsForAlignment);
        if (points1.length < minPoints || points2.length < minPoints) {
            console.log(`⚠️ Недостаточно точек для выравнивания: ${points1.length} и ${points2.length}`);
            return this.createNullResult('Мало точек');
        }

        const prepared1 = this.preparePoints(points1);
        const prepared2 = this.preparePoints(points2);

        console.log(`📊 Подготовлено: ${prepared1.length} и ${prepared2.length} точек`);

        // 2. ПОИСК БЕЗ ЗЕРКАЛА
        console.log('🔄 Запуск RANSAC (обычный)...');
        const resultNoMirror = this.searchBestTransformation(
            prepared1, prepared2, false, initialGuess
        );

        // 3. ПОИСК С ЗЕРКАЛОМ (если включено)
        let resultWithMirror = null;
        if (this.options.mirrorCheck) {
            console.log('🔄 Запуск RANSAC (зеркальный)...');
            resultWithMirror = this.searchBestTransformation(
                prepared1, prepared2, true, initialGuess
            );
        }

        // 4. ВЫБОР ЛУЧШЕГО РЕЗУЛЬТАТА С УЧЕТОМ ЗЕРКАЛА
        const results = [];
        if (resultNoMirror && resultNoMirror.score > this.options.maxRandomScore) {
            results.push(resultNoMirror);
        }
        if (resultWithMirror && resultWithMirror.score > this.options.maxRandomScore) {
            results.push(resultWithMirror);
        }

        if (results.length === 0) {
            console.log('❌ Не найдено приемлемых совмещений');
            return this.createNullResult('Нет совмещений');
        }

        // 🔥 ЯВНОЕ СРАВНЕНИЕ ЗЕРКАЛА И НЕЗЕРКАЛА
        let bestResult = results[0];
        if (results.length > 1) {
            const scoreDiff = Math.abs(results[0].score - results[1].score);
            const mirrorAdvantage = results[1].score - results[0].score;
           
            if (scoreDiff > 0.1) { // Разница >10%
                bestResult = results[0].score > results[1].score ? results[0] : results[1];
               
                // Если зеркальный результат лучше на порог
                if (results[1].mirrored && mirrorAdvantage > this.options.mirrorAdvantageThreshold) {
                    console.log(`🪞 ЗЕРКАЛО ОБНАРУЖЕНО: +${(mirrorAdvantage*100).toFixed(1)}% лучше`);
                    bestResult.mirrored = true;
                    bestResult.score *= 1.05; // Небольшой бонус
                }
            } else {
                // Разница небольшая - берем незеркальный
                bestResult = results.find(r => !r.mirrored) || results[0];
            }
        }

        console.log(`📊 Результаты: Обычный=${resultNoMirror?.score?.toFixed(4) || 0}, Зеркальный=${resultWithMirror?.score?.toFixed(4) || 0}`);

        // 🔥 ПРОВЕРКА НА СЛУЧАЙНЫЕ ДАННЫЕ
        if (bestResult.inliers && bestResult.inliers.length > 0) {
            const isRandom = this.checkForRandomPattern(
                bestResult.inliers,
                prepared1,
                prepared2
            );
           
            if (isRandom && bestResult.score < 0.5) {
                console.log('⚠️ Возможно случайные данные - снижаю score');
                bestResult.score *= 0.5;
            }
        }

        // 🔥 ОГРАНИЧИВАЕМ SCORE ДЛЯ СЛУЧАЙНЫХ ДАННЫХ
        if (bestResult.score > this.options.maxRandomScore) {
            // Проверяем, действительно ли это хорошее совмещение
            const isGoodMatch = bestResult.inliers.length >= 6 &&
                               bestResult.inliers.length > Math.min(prepared1.length, prepared2.length) * 0.5;
           
            if (!isGoodMatch) {
                bestResult.score = Math.min(bestResult.score, this.options.maxRandomScore);
            }
        }

        // 5. ОЦЕНКА КАЧЕСТВА
        bestResult.quality = this.evaluateAlignmentQuality(bestResult);

        console.log(`✅ Лучшее совмещение: ${(bestResult.score * 100).toFixed(1)}%, ` +
                   `угол: ${bestResult.transform ? (bestResult.transform.rotation * 180 / Math.PI).toFixed(1) : 'N/A'}°, ` +
                   `зеркало: ${bestResult.mirrored ? 'да' : 'нет'}`);

        return bestResult;
    }

    // 🔥 НОВЫЙ МЕТОД: Проверка на случайные данные
    checkForRandomPattern(inliers, points1, points2) {
        if (inliers.length < 4) return false;
       
        // 1. Проверка на равномерность распределения inliers
        if (this.options.requireGoodSpread) {
            const spreadScore = this.calculatePointSpreadScore(inliers.map(i => i.point2));
            if (spreadScore < 0.3) {
                console.log('⚠️ Слишком плотное скопление inliers (возможно случайные данные)');
                return true;
            }
        }
       
        // 2. Проверка на уникальные углы между точками
        const uniqueAngles = this.countUniqueAngles(points1);
        if (uniqueAngles < this.options.minUniqueAngles) {
            console.log('⚠️ Слишком мало уникальных углов');
            return true;
        }
       
        // 3. Проверка на слишком равномерные расстояния
        if (this.checkUniformDistances(points1)) {
            console.log('⚠️ Слишком равномерные расстояния (похоже на регулярную сетку)');
            return true;
        }
       
        return false;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ПРОВЕРКИ СЛУЧАЙНЫХ ДАННЫХ:
    calculatePointSpreadScore(points) {
        if (points.length < 3) return 1.0;
       
        const center = this.calculateCenter(points);
        const distances = points.map(p => this.calculateDistance(p, center));
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        const maxDistance = Math.max(...distances);
       
        // Если все точки близко к центру - плохо
        return avgDistance / Math.max(maxDistance, 1);
    }

    countUniqueAngles(points) {
        if (points.length < 3) return 0;
       
        const angles = new Set();
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                for (let k = j + 1; k < points.length; k++) {
                    const angle = this.calculateTriangleAngle(
                        points[i], points[j], points[k]
                    );
                    const quantized = Math.round(angle * 10); // Квантуем до 0.1 радиана
                    angles.add(quantized);
                }
            }
        }
        return angles.size;
    }

    checkUniformDistances(points) {
        if (points.length < 4) return false;
       
        const distances = [];
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                distances.push(this.calculateDistance(points[i], points[j]));
            }
        }
       
        // Проверяем вариацию расстояний
        const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
        const variance = distances.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / distances.length;
        const cv = Math.sqrt(variance) / avg; // Коэффициент вариации
       
        // Если расстояния слишком равномерны (CV маленький)
        return cv < 0.2;
    }

    calculateTriangleAngle(p1, p2, p3) {
        // Угол при вершине p2
        const a = this.calculateDistance(p1, p2);
        const b = this.calculateDistance(p2, p3);
        const c = this.calculateDistance(p1, p3);
       
        // Теорема косинусов
        const cosAngle = (a*a + b*b - c*c) / (2 * a * b);
        return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    }

    // 🔄 ПОИСК ЛУЧШЕЙ ТРАНСФОРМАЦИИ (RANSAC-подобный)
    searchBestTransformation(points1, points2, mirrored = false, initialGuess = null) {
        let bestTransform = null;
        let bestScore = 0;
        let bestInliers = [];
        let bestIteration = 0;

        // Если есть начальное предположение - пробуем его
        if (initialGuess) {
            const transform = this.createTransformationFromGuess(initialGuess, mirrored);
            const { score, inliers } = this.evaluateTransformation(
                points1, points2, transform, mirrored
            );

            if (score > bestScore) {
                bestScore = score;
                bestTransform = transform;
                bestInliers = inliers;
            }
        }

        // RANSAC цикл - ИСПРАВЛЕНИЕ для зеркала
        for (let iteration = 0; iteration < this.options.maxIterations; iteration++) {
            // 1. ВЫБОР СЛУЧАЙНЫХ ТОЧЕК
            const sample1 = this.getRandomSample(points1, 3);
            const sample2 = this.getRandomSample(points2, 3);

            // 🔥 ИСПРАВЛЕНИЕ: Для зеркала инвертируем X координаты sample2
            let transformSample2 = sample2;
            if (mirrored) {
                transformSample2 = sample2.map(p => ({
                    x: -p.x,
                    y: p.y,
                    confidence: p.confidence,
                    id: p.id
                }));
            }

            // 2. ВЫЧИСЛЕНИЕ ТРАНСФОРМАЦИИ ПО 3 ТОЧКАМ
            const transform = this.calculateTransformationFromSamples(
                sample1, transformSample2, false // Всегда false, т.к. уже отразили
            );

            if (!transform) continue;

            // 🔥 ИСПРАВЛЕНИЕ: Для зеркального результата помечаем mirrored
            if (mirrored) {
                transform.mirrored = true;
            }

            // 3. ОЦЕНКА ТРАНСФОРМАЦИИ НА ВСЕХ ТОЧКАХ
            const { score, inliers } = this.evaluateTransformation(
                points1, points2, transform, mirrored
            );

            // 4. ОБНОВЛЕНИЕ ЛУЧШЕГО РЕЗУЛЬТАТА
            if (score > bestScore) {
                bestScore = score;
                bestTransform = transform;
                bestInliers = inliers;
                bestIteration = iteration;

                // РАННИЙ ВЫХОД ЕСЛИ ОТЛИЧНЫЙ РЕЗУЛЬТАТ
                if (score > 0.9) {
                    console.log(`✅ Ранняя остановка на итерации ${iteration}: score=${score.toFixed(4)}`);
                    break;
                }
            }
        }

        // УТОЧНЕНИЕ ПО INLIERS (если нашли хорошие совпадения)
        if (bestInliers.length >= 3) {
            const refinedTransform = this.refineTransformationWithInliers(
                points1, points2, bestInliers, mirrored
            );

            if (refinedTransform) {
                const { score: refinedScore } = this.evaluateTransformation(
                    points1, points2, refinedTransform, mirrored
                );

                if (refinedScore > bestScore) {
                    bestScore = refinedScore;
                    bestTransform = refinedTransform;
                }
            }
        }

        return {
            transform: bestTransform,
            score: bestScore,
            inliers: bestInliers,
            mirrored: mirrored,
            iterationCount: bestIteration
        };
    }

    // 📐 ВЫЧИСЛЕНИЕ ТРАНСФОРМАЦИИ ПО 3 ТОЧКАМ
    calculateTransformationFromSamples(sample1, sample2, mirrored) {
        if (sample1.length !== 3 || sample2.length !== 3) {
            return null;
        }

        try {
            // 🔥 ИСПРАВЛЕНИЕ: Используем центры ДО вычислений
            const center1 = this.calculateCenter(sample1);
            const center2 = this.calculateCenter(sample2);

            // Центрируем точки
            const centered1 = sample1.map(p => ({
                x: p.x - center1.x,
                y: p.y - center1.y
            }));
            const centered2 = sample2.map(p => ({
                x: p.x - center2.x,
                y: p.y - center2.y
            }));

            // 1. ВЫЧИСЛЕНИЕ МАСШТАБА (медиана отношений расстояний)
            const scales = [];
            for (let i = 0; i < 3; i++) {
                for (let j = i + 1; j < 3; j++) {
                    const dist1 = this.calculateDistance(centered1[i], centered1[j]);
                    const dist2 = this.calculateDistance(centered2[i], centered2[j]);

                    if (dist1 > 10 && dist2 > 10) { // Избегаем очень близких точек
                        scales.push(dist2 / dist1);
                    }
                }
            }

            if (scales.length === 0) return null;

            const medianScale = this.getMedian(scales);
            const scale = Math.max(
                this.options.scaleRange.min,
                Math.min(this.options.scaleRange.max, medianScale)
            );

            // 2. ВЫЧИСЛЕНИЕ ПОВОРОТА (через векторы)
            let totalAngle = 0;
            let angleCount = 0;

            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if (i !== j) {
                        const v1 = {
                            x: centered1[j].x - centered1[i].x,
                            y: centered1[j].y - centered1[i].y
                        };
                        const v2 = {
                            x: centered2[j].x - centered2[i].x,
                            y: centered2[j].y - centered2[i].y
                        };

                        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
                        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

                        if (len1 > 10 && len2 > 10) { // Избегаем очень коротких векторов
                            const dot = v1.x * v2.x + v1.y * v2.y;
                            const cross = v1.x * v2.y - v1.y * v2.x;
                            const angle = Math.atan2(cross, dot);

                            // Нормализуем угол
                            let normalizedAngle = angle;
                            if (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;
                            if (normalizedAngle < -Math.PI) normalizedAngle += 2 * Math.PI;

                            totalAngle += normalizedAngle;
                            angleCount++;
                        }
                    }
                }
            }

            const rotation = angleCount > 0 ? totalAngle / angleCount : 0;

            // 🔥 ИСПРАВЛЕНИЕ: Правильный расчёт смещения
            // Смещение = center2 - (повёрнутый и масштабированный center1)
            const translation = {
                x: center2.x - (center1.x * Math.cos(rotation) * scale - center1.y * Math.sin(rotation) * scale),
                y: center2.y - (center1.x * Math.sin(rotation) * scale + center1.y * Math.cos(rotation) * scale)
            };

            return {
                scale: scale,
                rotation: rotation,
                translation: translation,
                mirrored: mirrored
            };

        } catch (error) {
            console.log('❌ Ошибка вычисления трансформации:', error.message);
            return null;
        }
    }

    // 📊 ОЦЕНКА ТРАНСФОРМАЦИИ (С АДАПТИВНЫМ ПОРОГОМ)
    evaluateTransformation(points1, points2, transform, mirrored) {
        if (!transform || !points1 || !points2) {
            return { score: 0, inliers: [], avgDistance: Infinity, matchedPoints: 0, inlierRatio: 0 };
        }

        const inliers = [];
        let totalDistance = 0;
        let matchedPoints = 0;

        // 🔥 АДАПТИВНЫЙ ПОРОГ
        let inlierThreshold = this.options.inlierThreshold;
        if (this.options.adaptiveInlierThreshold) {
            // Для больших следов увеличиваем порог
            const avgPointDistance = this.calculateAveragePointDistance(points1);
            inlierThreshold = Math.max(15, Math.min(30, avgPointDistance * 0.3));
        }

        // Трансформируем все точки
        const transformedPoints1 = points1.map(p =>
            this.transformPoint(p, transform, mirrored)
        );

        // Используем greedy matching
        const usedIndices = new Set();

        transformedPoints1.forEach((transformedPoint, i) => {
            let bestMatchIndex = -1;
            let bestDistance = Infinity;

            // Ищем ближайшую НЕИСПОЛЬЗОВАННУЮ точку
            for (let j = 0; j < points2.length; j++) {
                if (usedIndices.has(j)) continue;

                const distance = this.calculateDistance(transformedPoint, points2[j]);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatchIndex = j;
                }
            }

            const point1Confidence = points1[i].confidence || 0.5;
            const point2Confidence = points2[bestMatchIndex]?.confidence || 0.5;
            const avgConfidence = (point1Confidence + point2Confidence) / 2;

            // 🔥 ИСПРАВЛЕНИЕ: Используем адаптивный порог
            if (bestMatchIndex !== -1 &&
                bestDistance <= inlierThreshold &&
                avgConfidence >= this.options.confidenceThreshold) {

                inliers.push({
                    point1: points1[i],
                    point2: points2[bestMatchIndex],
                    distance: bestDistance,
                    transformed: transformedPoint,
                    confidence: avgConfidence
                });

                usedIndices.add(bestMatchIndex);
                totalDistance += bestDistance;
                matchedPoints++;
            }
        });

        // 🔥 ПРОВЕРКА МИНИМАЛЬНЫХ ТРЕБОВАНИЙ
        if (matchedPoints < this.options.minInliersAbsolute) {
            return {
                score: 0,
                inliers: [],
                avgDistance: Infinity,
                matchedPoints: 0,
                inlierRatio: 0
            };
        }

        const inlierRatio = matchedPoints / Math.min(points1.length, points2.length);
        if (inlierRatio < this.options.minInliersRatio) {
            return {
                score: 0,
                inliers: [],
                avgDistance: Infinity,
                matchedPoints: 0,
                inlierRatio: inlierRatio
            };
        }

        // 🔥 РАСЧЁТ SCORE
        let score = 0;
        const avgDistance = totalDistance / matchedPoints;

        // 1. ФАКТОР INLIER RATIO
        let inlierScore;
        if (inlierRatio >= 0.8) {
            inlierScore = 1.0;
        } else if (inlierRatio >= 0.6) {
            inlierScore = 0.7 + (inlierRatio - 0.6) * 1.5;
        } else {
            inlierScore = inlierRatio * 0.7 / 0.6;
        }

        // 2. ФАКТОР РАССТОЯНИЯ
        const maxAllowedDistance = inlierThreshold;
        const distanceScore = Math.exp(-avgDistance / (maxAllowedDistance / 3));

        // 3. ФАКТОР РАВНОМЕРНОСТИ
        let distributionScore = 1.0;
        if (this.options.requireGoodDistribution && inliers.length >= 3) {
            const centers = inliers.map(inlier => inlier.point2);
            const centerOfCenters = this.calculateCenter(centers);
            const distancesToCenter = centers.map(p => this.calculateDistance(p, centerOfCenters));
            const avgDistToCenter = distancesToCenter.reduce((a, b) => a + b, 0) / distancesToCenter.length;
            const maxDist = Math.max(...distancesToCenter);

            // Если все inliers близко к центру - плохо
            distributionScore = Math.min(1.0, avgDistToCenter / (maxDist * 0.5));
        }

        // 4. ФАКТОР УВЕРЕННОСТИ
        const avgConfidence = inliers.reduce((sum, inlier) => sum + inlier.confidence, 0) / inliers.length;
        const confidenceScore = Math.max(0, (avgConfidence - 0.5) * 2);

        // 🔥 БАЛАНСИРОВАННЫЕ ВЕСА
        const WEIGHTS = {
            INLIER: 0.4,
            DISTANCE: 0.3,
            DISTRIBUTION: 0.2,
            CONFIDENCE: 0.1
        };

        score = (inlierScore * WEIGHTS.INLIER) +
                (distanceScore * WEIGHTS.DISTANCE) +
                (distributionScore * WEIGHTS.DISTRIBUTION) +
                (confidenceScore * WEIGHTS.CONFIDENCE);

        // 🔥 ШТРАФ ЗА БОЛЬШИЕ РАССТОЯНИЯ
        if (avgDistance > 20) {
            score *= 0.8;
        }

        // 🔥 ШТРАФ ЗА МАЛО INLIERS
        if (inlierRatio < 0.5) {
            score *= 0.7;
        }

        score = Math.max(0, Math.min(1, score));

        return {
            score: score,
            inliers: inliers,
            avgDistance: avgDistance,
            matchedPoints: matchedPoints,
            inlierRatio: inlierRatio
        };
    }

    // 🎨 УТОЧНЕНИЕ ТРАНСФОРМАЦИИ ПО INLIERS
    refineTransformationWithInliers(points1, points2, inliers, mirrored) {
        if (inliers.length < 3) return null;

        try {
            const inlierPoints1 = inliers.map(i => i.point1);
            const inlierPoints2 = inliers.map(i => i.point2);

            // Усредняем параметры из нескольких случайных выборок
            const transforms = [];
            const iterations = Math.min(20, Math.floor(inliers.length / 2));

            for (let i = 0; i < iterations; i++) {
                const sample1 = this.getRandomSample(inlierPoints1, 3);
                const sample2 = this.getRandomSample(inlierPoints2, 3);

                const transform = this.calculateTransformationFromSamples(
                    sample1, sample2, mirrored
                );

                if (transform) transforms.push(transform);
            }

            if (transforms.length === 0) return null;

            // Медианные значения (устойчивее к выбросам)
            const scales = transforms.map(t => t.scale).sort((a, b) => a - b);
            const rotations = transforms.map(t => t.rotation).sort((a, b) => a - b);
            const translationsX = transforms.map(t => t.translation.x).sort((a, b) => a - b);
            const translationsY = transforms.map(t => t.translation.y).sort((a, b) => a - b);

            const medianScale = scales[Math.floor(scales.length / 2)];
            const medianRotation = rotations[Math.floor(rotations.length / 2)];
            const medianTx = translationsX[Math.floor(translationsX.length / 2)];
            const medianTy = translationsY[Math.floor(translationsY.length / 2)];

            return {
                scale: medianScale,
                rotation: medianRotation,
                translation: { x: medianTx, y: medianTy },
                mirrored: mirrored
            };

        } catch (error) {
            console.log('❌ Ошибка уточнения трансформации:', error.message);
            return null;
        }
    }

    // 🎯 ОЦЕНКА КАЧЕСТВА СОВМЕЩЕНИЯ
    evaluateAlignmentQuality(result) {
        if (!result || result.score <= 0) {
            return {
                quality: 'poor',
                message: 'Совмещение не найдено',
                color: '#ff0000'
            };
        }

        const { score, inliers, mirrored } = result;

        if (score >= 0.8) {
            return {
                quality: 'excellent',
                message: `Отличное совмещение (${(score * 100).toFixed(0)}%)`,
                color: '#00ff00',
                mirrored: mirrored ? 'зеркальное' : 'прямое'
            };
        } else if (score >= 0.6) {
            return {
                quality: 'good',
                message: `Хорошее совмещение (${(score * 100).toFixed(0)}%)`,
                color: '#ffff00',
                mirrored: mirrored ? 'зеркальное' : 'прямое'
            };
        } else if (score >= 0.4) {
            return {
                quality: 'acceptable',
                message: `Приемлемое совмещение (${(score * 100).toFixed(0)}%)`,
                color: '#ff9900',
                mirrored: mirrored ? 'зеркальное' : 'прямое'
            };
        } else {
            return {
                quality: 'poor',
                message: `Слабое совмещение (${(score * 100).toFixed(0)}%)`,
                color: '#ff0000',
                mirrored: mirrored ? 'зеркальное' : 'прямое'
            };
        }
    }

    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    // 🔥 НОВЫЙ МЕТОД: Расчёт среднего расстояния между точками
    calculateAveragePointDistance(points) {
        if (points.length < 2) return 20;

        let totalDistance = 0;
        let count = 0;

        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                totalDistance += this.calculateDistance(points[i], points[j]);
                count++;
            }
        }

        return count > 0 ? totalDistance / count : 20;
    }

    // Подготовка точек
    preparePoints(points) {
        return points.map((p, index) => ({
            x: p.x || p.center?.x || 0,
            y: p.y || p.center?.y || 0,
            confidence: p.confidence || 0.5,
            id: p.id || `p_${index}`
        }));
    }

    // Трансформация точки
    transformPoint(point, transform, mirrored) {
        if (!transform) return point;

        let x = point.x;
        let y = point.y;

        // Зеркало (инверсия по X)
        if (mirrored) {
            x = -x;
        }

        // 🔥 ИСПРАВЛЕНИЕ: Правильный порядок трансформаций
        // 1. Поворот
        const cos = Math.cos(transform.rotation);
        const sin = Math.sin(transform.rotation);
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;

        // 2. Масштаб
        const scaledX = rotatedX * transform.scale;
        const scaledY = rotatedY * transform.scale;

        // 3. Смещение
        return {
            x: scaledX + transform.translation.x,
            y: scaledY + transform.translation.y
        };
    }

    // Случайная выборка
    getRandomSample(points, count) {
        if (points.length <= count) return [...points];

        const shuffled = [...points].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    // Расстояние между точками
    calculateDistance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Центр точек
    calculateCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };

        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    // Медиана массива
    getMedian(values) {
        if (!values || values.length === 0) return 0;

        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);

        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
            return sorted[mid];
        }
    }

    // Создание трансформации из предположения
    createTransformationFromGuess(guess, mirrored) {
        return {
            scale: guess.scale || 1.0,
            rotation: guess.rotation || 0,
            translation: guess.translation || { x: 0, y: 0 },
            mirrored: mirrored
        };
    }

    // Результат при ошибке
    createNullResult(message) {
        return {
            transform: null,
            score: 0,
            inliers: [],
            mirrored: false,
            iterationCount: 0,
            quality: {
                quality: 'failed',
                message: message || 'Ошибка совмещения',
                color: '#ff0000'
            }
        };
    }

    // ЭКСПОРТ ДЛЯ ДЕБАГА
    getDebugInfo() {
        return {
            options: this.options,
            algorithm: 'Optimized RANSAC-based point cloud alignment',
            features: [
                'Rotation detection',
                'Scale detection (0.5x-2.0x)',
                'Mirror detection (fixed)',
                'Adaptive inlier threshold',
                'Confidence-weighted scoring',
                'Distribution-aware evaluation',
                'Random pattern detection'
            ]
        };
    }
}

module.exports = PointCloudAligner;
