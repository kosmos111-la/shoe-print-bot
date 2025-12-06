// modules/footprint/point-cloud-aligner.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
class PointCloudAligner {
    constructor(options = {}) {
        this.options = {
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
            requireGoodSpread: true,
            maxRandomScore: 0.3,
            minUniqueAngles: 3,
            mirrorAdvantageThreshold: 0.15,
            ...options
        };

        console.log('🔧 PointCloudAligner создан с параметрами:', {
            maxIterations: this.options.maxIterations,
            inlierThreshold: this.options.inlierThreshold,
            mirrorCheck: this.options.mirrorCheck
        });
    }

    // 🔍 ОСНОВНОЙ МЕТОД: НАЙТИ ЛУЧШЕЕ СОВМЕЩЕНИЕ (ИСПРАВЛЕННЫЙ)
    findBestAlignment(points1, points2, initialGuess = null) {
        console.log(`🎯 Поиск наилучшего выравнивания для ${points1.length} и ${points2.length} точек`);

        const minPoints = Math.max(4, this.options.minPointsForAlignment);
        if (points1.length < minPoints || points2.length < minPoints) {
            console.log(`⚠️ Недостаточно точек для выравнивания`);
            return this.createNullResult('Мало точек');
        }

        const prepared1 = this.preparePoints(points1);
        const prepared2 = this.preparePoints(points2);

        console.log(`📊 Подготовлено: ${prepared1.length} и ${prepared2.length} точек`);

        let bestResult;

        if (this.options.mirrorCheck) {
            // 🔥 ИСПОЛЬЗУЕМ УПРОЩЕННУЮ ПРОВЕРКУ ЗЕРКАЛА
            bestResult = this.checkMirrorSimple(prepared1, prepared2, initialGuess);
        } else {
            console.log('🔄 Запуск RANSAC (обычный, без зеркала)...');
            bestResult = this.searchBestTransformation(
                prepared1, prepared2, false, initialGuess
            );
        }

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
            const isGoodMatch = bestResult.inliers.length >= 6 &&
                              bestResult.inliers.length > Math.min(prepared1.length, prepared2.length) * 0.5;

            if (!isGoodMatch) {
                bestResult.score = Math.min(bestResult.score, this.options.maxRandomScore);
            }
        }

        // ОЦЕНКА КАЧЕСТВА
        bestResult.quality = this.evaluateAlignmentQuality(bestResult);

        console.log(`✅ Лучшее совмещение: ${(bestResult.score * 100).toFixed(1)}%, ` +
                   `угол: ${bestResult.transform ? (bestResult.transform.rotation * 180 / Math.PI).toFixed(1) : 'N/A'}°, ` +
                   `зеркало: ${bestResult.mirrored ? 'да 🪞' : 'нет'}`);

        return bestResult;
    }

    // 🔥 НОВЫЙ МЕТОД: Простая проверка зеркала (РАБОЧАЯ ВЕРСИЯ)
    checkMirrorSimple(points1, points2, initialGuess = null) {
        console.log('🪞 Простая проверка зеркала...');

        // 1. Обычный поиск
        console.log('🔄 Запуск RANSAC (обычный)...');
        const normalResult = this.searchBestTransformation(
            points1, points2, false, initialGuess
        );

        // 2. Поиск с зеркальным отражением
        console.log('🔄 Запуск RANSAC (зеркальный)...');
        const mirroredResult = this.searchBestTransformationMirrored(
            points1, points2, initialGuess
        );

        console.log(`📊 Сравнение: обычный=${normalResult.score.toFixed(3)}, зеркальный=${mirroredResult.score.toFixed(3)}`);

        // 3. Если зеркальный результат значительно лучше
        if (mirroredResult.score > normalResult.score + this.options.mirrorAdvantageThreshold &&
            mirroredResult.score > 0.3) {
            console.log(`✅ ОБНАРУЖЕНО ЗЕРКАЛО! +${((mirroredResult.score - normalResult.score) * 100).toFixed(1)}%`);

            // Корректируем трансформацию для зеркала
            mirroredResult.mirrored = true;
            if (mirroredResult.transform) {
                mirroredResult.transform.mirrored = true;
                // Для зеркала инвертируем X координату трансляции и вращение
                mirroredResult.transform.translation.x = -mirroredResult.transform.translation.x;
                mirroredResult.transform.rotation = -mirroredResult.transform.rotation;
            }

            return mirroredResult;
        }

        // 4. Если обычный результат лучше
        console.log(`📌 Использую обычный результат`);
        normalResult.mirrored = false;
        return normalResult;
    }

    // 🔥 НОВЫЙ МЕТОД: Поиск с зеркальным отражением
    searchBestTransformationMirrored(points1, points2, initialGuess = null) {
        // Создаем зеркальную версию points2 (отражение по оси Y)
        const mirroredPoints2 = points2.map(p => ({
            x: -p.x,  // 🔥 ОТРАЖАЕМ ПО ОСИ Y (инвертируем X)
            y: p.y,
            confidence: p.confidence,
            id: `${p.id}_mirrored`
        }));

        // Ищем совмещение с отраженными точками
        const mirroredResult = this.searchBestTransformation(
            points1, mirroredPoints2, false, initialGuess
        );

        // 🔥 ВАЖНО: преобразуем результат обратно
        if (mirroredResult.transform) {
            mirroredResult.transform.mirrored = true;
            // Корректируем трансформацию для отражения
            mirroredResult.transform.rotation = -mirroredResult.transform.rotation;
            mirroredResult.transform.translation.x = -mirroredResult.transform.translation.x;
        }

        return mirroredResult;
    }

    // 🔄 ПОИСК ЛУЧШЕЙ ТРАНСФОРМАЦИИ (RANSAC-подобный) - ИСПРАВЛЕННЫЙ
    searchBestTransformation(points1, points2, mirrored = false, initialGuess = null) {
        console.log(`🔍 searchBestTransformation вызван: mirrored=${mirrored}, точек: ${points1.length} vs ${points2.length}`);

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

        // RANSAC цикл
        const startTime = Date.now();
        let iterations = 0;

        for (let iteration = 0; iteration < this.options.maxIterations; iteration++) {
            iterations++;
           
            // 1. ВЫБОР СЛУЧАЙНЫХ ТОЧЕК
            const sample1 = this.getRandomSample(points1, 3);
            const sample2 = this.getRandomSample(points2, 3);

            // 2. ВЫЧИСЛЕНИЕ ТРАНСФОРМАЦИИ ПО 3 ТОЧКАМ
            const transform = this.calculateTransformationFromSamples(
                sample1, sample2, mirrored
            );

            if (!transform) continue;

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

            // ТАЙМАУТ (предотвращение бесконечных циклов)
            if (Date.now() - startTime > 5000) { // 5 секунд
                console.log(`⚠️ Таймаут после ${iteration} итераций`);
                break;
            }
        }

        console.log(`📊 searchBestTransformation завершен: score=${bestScore}, mirrored=${mirrored}, iterations=${iterations}`);

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
            iterationCount: bestIteration,
            totalIterations: iterations
        };
    }

    // 📐 ВЫЧИСЛЕНИЕ ТРАНСФОРМАЦИИ ПО 3 ТОЧКАМ (ИСПРАВЛЕННЫЙ)
    calculateTransformationFromSamples(sample1, sample2, mirrored) {
        if (sample1.length !== 3 || sample2.length !== 3) {
            console.log('❌ Недостаточно точек для вычисления трансформации');
            return null;
        }

        try {
            // 🔥 ИСПРАВЛЕНИЕ: Правильная обработка зеркала
            let workingSample2 = sample2;
            if (mirrored) {
                // Для зеркала корректируем координаты уже отраженных точек
                workingSample2 = sample2.map(p => ({
                    x: p.x,
                    y: p.y,
                    confidence: p.confidence,
                    id: p.id
                }));
            }

            const center1 = this.calculateCenter(sample1);
            const center2 = this.calculateCenter(workingSample2);

            // Центрируем точки
            const centered1 = sample1.map(p => ({
                x: p.x - center1.x,
                y: p.y - center1.y
            }));
            const centered2 = workingSample2.map(p => ({
                x: p.x - center2.x,
                y: p.y - center2.y
            }));

            // 1. ВЫЧИСЛЕНИЕ МАСШТАБА
            const scales = [];
            for (let i = 0; i < 3; i++) {
                for (let j = i + 1; j < 3; j++) {
                    const dist1 = this.calculateDistance(centered1[i], centered1[j]);
                    const dist2 = this.calculateDistance(centered2[i], centered2[j]);

                    if (dist1 > 10 && dist2 > 10) {
                        scales.push(dist2 / dist1);
                    }
                }
            }

            if (scales.length === 0) {
                console.log('❌ Не удалось вычислить масштаб');
                return null;
            }

            const medianScale = this.getMedian(scales);
            const scale = Math.max(
                this.options.scaleRange.min,
                Math.min(this.options.scaleRange.max, medianScale)
            );

            // 2. ВЫЧИСЛЕНИЕ ПОВОРОТА
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

                        if (len1 > 10 && len2 > 10) {
                            const dot = v1.x * v2.x + v1.y * v2.y;
                            const cross = v1.x * v2.y - v1.y * v2.x;
                            const angle = Math.atan2(cross, dot);

                            // Нормализуем угол
                            let normalizedAngle = angle;
                            if (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;
                            if (normalizedAngle < -Math.PI) normalizedAngle += 2 * Math.PI;

                            // 🔥 ДЛЯ ЗЕРКАЛА: инвертируем угол
                            if (mirrored) {
                                normalizedAngle = -normalizedAngle;
                            }

                            totalAngle += normalizedAngle;
                            angleCount++;
                        }
                    }
                }
            }

            if (angleCount === 0) {
                console.log('❌ Не удалось вычислить поворот');
                return null;
            }

            const rotation = totalAngle / angleCount;

            // 🔥 ИСПРАВЛЕНИЕ: Правильный расчёт смещения (универсальная формула)
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);

            // Для зеркала корректируем расчет
            let adjustedCenter1X = center1.x;
            if (mirrored) {
                adjustedCenter1X = -center1.x; // Отражение по оси Y
            }

            const translation = {
                x: center2.x - (adjustedCenter1X * cos * scale - center1.y * sin * scale),
                y: center2.y - (adjustedCenter1X * sin * scale + center1.y * cos * scale)
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
            console.log(`❌ Слишком мало inliers: ${matchedPoints} < ${this.options.minInliersAbsolute}`);
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
            console.log(`❌ Слишком низкий inlier ratio: ${inlierRatio.toFixed(3)} < ${this.options.minInliersRatio}`);
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

        console.log(`📈 Оценка трансформации: score=${score.toFixed(3)}, inliers=${matchedPoints}, avgDist=${avgDistance.toFixed(1)}`);

        return {
            score: score,
            inliers: inliers,
            avgDistance: avgDistance,
            matchedPoints: matchedPoints,
            inlierRatio: inlierRatio
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Трансформация точки
    transformPoint(point, transform, mirrored) {
        if (!transform) return point;

        let x = point.x;
        let y = point.y;

        // 🔥 КОРРЕКТНАЯ ОБРАБОТКА ЗЕРКАЛА
        // mirrored - это параметр метода, transform.mirrored - это свойство трансформации
        const shouldMirror = mirrored || (transform && transform.mirrored);

        if (shouldMirror) {
            x = -x;  // Отражение по оси Y
        }

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

    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ БЕЗ ИЗМЕНЕНИЙ (из оригинального кода):
   
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

            // Медианные значения
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

        const { score, mirrored } = result;

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

    // 🔥 Методы для проверки случайных данных (из оригинального кода):
    checkForRandomPattern(inliers, points1, points2) {
        if (inliers.length < 4) return false;

        if (this.options.requireGoodSpread) {
            const spreadScore = this.calculatePointSpreadScore(inliers.map(i => i.point2));
            if (spreadScore < 0.3) {
                console.log('⚠️ Слишком плотное скопление inliers');
                return true;
            }
        }

        const uniqueAngles = this.countUniqueAngles(points1);
        if (uniqueAngles < this.options.minUniqueAngles) {
            console.log('⚠️ Слишком мало уникальных углов');
            return true;
        }

        if (this.checkUniformDistances(points1)) {
            console.log('⚠️ Слишком равномерные расстояния');
            return true;
        }

        if (this.checkUniformGrid(points2)) {
            console.log('⚠️ Обнаружена регулярная сетка');
            return true;
        }

        return false;
    }

    calculatePointSpreadScore(points) {
        if (points.length < 3) return 1.0;

        const center = this.calculateCenter(points);
        const distances = points.map(p => this.calculateDistance(p, center));
        const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
        const maxDistance = Math.max(...distances);

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
                    const quantized = Math.round(angle * 10);
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

        const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
        const variance = distances.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / distances.length;
        const cv = Math.sqrt(variance) / avg;

        return cv < 0.2;
    }

    checkUniformGrid(points) {
        if (points.length < 9) return false;

        const xs = [...new Set(points.map(p => Math.round(p.x / 20) * 20))];
        const ys = [...new Set(points.map(p => Math.round(p.y / 20) * 20))];

        if (xs.length >= 3 && ys.length >= 3) {
            xs.sort((a, b) => a - b);
            ys.sort((a, b) => a - b);

            let xUniform = true;
            if (xs.length > 2) {
                const firstGap = xs[1] - xs[0];
                for (let i = 2; i < xs.length; i++) {
                    const gap = xs[i] - xs[i-1];
                    if (Math.abs(gap - firstGap) > 10) {
                        xUniform = false;
                        break;
                    }
                }
            }

            let yUniform = true;
            if (ys.length > 2) {
                const firstGap = ys[1] - ys[0];
                for (let i = 2; i < ys.length; i++) {
                    const gap = ys[i] - ys[i-1];
                    if (Math.abs(gap - firstGap) > 10) {
                        yUniform = false;
                        break;
                    }
                }
            }

            if (xUniform && yUniform) {
                console.log(`⚠️ Обнаружена регулярная сетка: ${xs.length}x${ys.length}`);
                return true;
            }
        }

        return false;
    }

    calculateTriangleAngle(p1, p2, p3) {
        const a = this.calculateDistance(p1, p2);
        const b = this.calculateDistance(p2, p3);
        const c = this.calculateDistance(p1, p3);

        const cosAngle = (a*a + b*b - c*c) / (2 * a * b);
        return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    }

    // ЭКСПОРТ ДЛЯ ДЕБАГА
    getDebugInfo() {
        return {
            options: this.options,
            algorithm: 'Fixed RANSAC with mirror detection',
            features: [
                'Fixed mirror detection',
                'Improved transformation calculation',
                'Better point matching',
                'Random pattern detection'
            ]
        };
    }
}

module.exports = PointCloudAligner;
