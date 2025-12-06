// modules/footprint/point-cloud-aligner.js
class PointCloudAligner {
    constructor(options = {}) {
        this.options = {
            // 🔧 НАСТРОЙКИ АЛГОРИТМА
            minPointsForAlignment: 3,     // Минимум точек для совмещения
            maxIterations: 100,           // Максимум итераций RANSAC
            inlierThreshold: 20,          // Порог inlier в пикселях
            minInliersRatio: 0.3,         // Минимум inlier для успеха
            angleStep: 15,                // Шаг угла при поиске (градусы)
            scaleRange: { min: 0.5, max: 2.0 }, // Диапазон масштабов
            mirrorCheck: true,            // Проверять зеркальность
           
            // 🔍 НАСТРОЙКИ ПРОВЕРКИ
            confidenceWeight: 0.7,        // Вес уверенности в оценке
            distanceWeight: 0.3,          // Вес расстояния в оценке
           
            // 🎯 ЦЕЛЕВЫЕ ПАРАМЕТРЫ
            targetAlignmentScore: 0.7,    // Порог успешного совмещения
            goodAlignmentScore: 0.8,      // Оценка "хорошо"
            excellentAlignmentScore: 0.9, // Оценка "отлично"
           
            ...options
        };

        console.log('🎯 PointCloudAligner создан');
    }

    // 🔍 ОСНОВНОЙ МЕТОД: НАЙТИ ЛУЧШЕЕ СОВМЕЩЕНИЕ
    findBestAlignment(points1, points2, initialGuess = null) {
        console.log(`🔍 Ищу совмещение: ${points1.length} точек → ${points2.length} точек`);

        if (points1.length < this.options.minPointsForAlignment ||
            points2.length < this.options.minPointsForAlignment) {
            console.log('⚠️ Слишком мало точек для совмещения');
            return this.createNullResult('Мало точек');
        }

        // 1. ПОДГОТОВКА ДАННЫХ
        const prepared1 = this.preparePoints(points1);
        const prepared2 = this.preparePoints(points2);

        // 2. ПОИСК БЕЗ ЗЕРКАЛА
        console.log('🔄 Пробую совмещение БЕЗ зеркала...');
        const resultNoMirror = this.searchBestTransformation(
            prepared1, prepared2, false, initialGuess
        );

        // 3. ПОИСК С ЗЕРКАЛОМ (если включено)
        let resultWithMirror = null;
        if (this.options.mirrorCheck) {
            console.log('🔄 Пробую совмещение С зеркалом...');
            resultWithMirror = this.searchBestTransformation(
                prepared1, prepared2, true, initialGuess
            );
        }

        // 4. ВЫБОР ЛУЧШЕГО РЕЗУЛЬТАТА
        const results = [resultNoMirror];
        if (resultWithMirror) results.push(resultWithMirror);

        const bestResult = results.reduce((best, current) =>
            current.score > best.score ? current : best
        );

        // 5. ОЦЕНКА КАЧЕСТВА
        bestResult.quality = this.evaluateAlignmentQuality(bestResult);

        console.log(`✅ Лучшее совмещение: ${(bestResult.score * 100).toFixed(1)}%, ` +
                   `угол: ${(bestResult.rotation * 180 / Math.PI).toFixed(1)}°, ` +
                   `зеркало: ${bestResult.mirrored ? 'да' : 'нет'}`);

        return bestResult;
    }

    // 🔄 ПОИСК ЛУЧШЕЙ ТРАНСФОРМАЦИИ (RANSAC-подобный)
    searchBestTransformation(points1, points2, mirrored = false, initialGuess = null) {
        let bestTransform = null;
        let bestScore = -1;
        let bestInliers = [];

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
        for (let iteration = 0; iteration < this.options.maxIterations; iteration++) {
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

                // РАННИЙ ВЫХОД ЕСЛИ ОТЛИЧНЫЙ РЕЗУЛЬТАТ
                if (score > this.options.excellentAlignmentScore) {
                    console.log(`🎯 Ранний выход: отличный score ${score.toFixed(3)}`);
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
            iterationCount: this.options.maxIterations
        };
    }

    // 📐 ВЫЧИСЛЕНИЕ ТРАНСФОРМАЦИИ ПО 3 ТОЧКАМ
   calculateTransformationFromSamples(sample1, sample2, mirrored) {
    if (sample1.length !== 3 || sample2.length !== 3) {
        return null;
    }

    try {
        // 🔥 ИСПРАВЛЕНИЕ 1: Используем центры ДО вычислений
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

        // 1. ВЫЧИСЛЕНИЕ МАСШТАБА (среднее отношение расстояний)
        const scales = [];
        for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
                const dist1 = this.calculateDistance(centered1[i], centered1[j]);
                const dist2 = this.calculateDistance(centered2[i], centered2[j]);
               
                if (dist1 > 0 && dist2 > 0) {
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

        // 2. ВЫЧИСЛЕНИЕ ПОВОРОТА (через векторы между точками)
        let totalAngle = 0;
        let angleCount = 0;
       
        // Сравниваем векторы между точками 0→1 и 0→2
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
                   
                    if (len1 > 0 && len2 > 0) {
                        // 🔥 ИСПРАВЛЕНИЕ 2: Правильный расчёт угла
                        const dot = v1.x * v2.x + v1.y * v2.y;
                        const cross = v1.x * v2.y - v1.y * v2.x;
                        const angle = Math.atan2(cross, dot); // Используем atan2 вместо acos
                       
                        // Нормализуем угол
                        const normalizedAngle = angle;
                        totalAngle += normalizedAngle;
                        angleCount++;
                    }
                }
            }
        }

        const rotation = angleCount > 0 ? totalAngle / angleCount : 0;

        // 🔥 ИСПРАВЛЕНИЕ 3: Правильный расчёт смещения
        // Смещение = center2 - (повёрнутый и масштабированный center1)
        const translation = {
            x: center2.x - (center1.x * scale * Math.cos(rotation) - center1.y * scale * Math.sin(rotation)),
            y: center2.y - (center1.x * scale * Math.sin(rotation) + center1.y * scale * Math.cos(rotation))
        };

        // 4. ЗЕРКАЛЬНОСТЬ
        if (mirrored) {
            // Для зеркала инвертируем X координату при трансформации
            return {
                scale: scale,
                rotation: rotation,
                translation: translation,
                mirrored: true
            };
        }

        return {
            scale: scale,
            rotation: rotation,
            translation: translation,
            mirrored: false
        };

    } catch (error) {
        console.log('❌ Ошибка вычисления трансформации:', error.message);
        return null;
    }
}

    // 📊 ОЦЕНКА ТРАНСФОРМАЦИИ
    evaluateTransformation(points1, points2, transform, mirrored) {
    if (!transform || !points1 || !points2) {
        return { score: 0, inliers: [], avgDistance: Infinity };
    }

    const inliers = [];
    let totalDistance = 0;
    let matchedPoints = 0;

    // ТРАНСФОРМАЦИЯ всех точек из points1
    const transformedPoints1 = points1.map(p =>
        this.transformPoint(p, transform, mirrored)
    );

    // 🔥 ИСПРАВЛЕНИЕ: Используем Hungarian алгоритм или ближайшие соседи
    // Для каждой трансформированной точки ищем ближайшую в points2
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
       
        // Проверяем является ли inlier
        if (bestMatchIndex !== -1 && bestDistance <= this.options.inlierThreshold) {
            inliers.push({
                point1: points1[i],
                point2: points2[bestMatchIndex],
                distance: bestDistance,
                transformed: transformedPoint
            });
           
            usedIndices.add(bestMatchIndex);
            totalDistance += bestDistance;
            matchedPoints++;
        }
    });

    // 🔥 ИСПРАВЛЕНИЕ: БОЛЕЕ СТРОГИЙ РАСЧЁТ SCORE
    let score = 0;
   
    if (matchedPoints > 0) {
        // 1. ФАКТОР INLIER RATIO (теперь квадрат для усиления различий)
        const inlierRatio = matchedPoints / Math.min(points1.length, points2.length);
        const inlierScore = inlierRatio * inlierRatio; // Квадрат!
       
        // 2. ФАКТОР СРЕДНЕГО РАССТОЯНИЯ (теперь экспоненциальный штраф)
        const avgDistance = totalDistance / matchedPoints;
        const maxAllowedDistance = this.options.inlierThreshold * 2;
        const distanceScore = Math.exp(-avgDistance / (maxAllowedDistance / 3));
       
        // 3. ФАКТОР РАВНОМЕРНОСТИ РАСПРЕДЕЛЕНИЯ inliers
        let distributionScore = 1.0;
        if (inliers.length > 3) {
            // Проверяем, что inliers не сгруппированы в одном месте
            const centers = inliers.map(inlier => inlier.point2);
            const centerOfCenters = this.calculateCenter(centers);
            const distancesToCenter = centers.map(p => this.calculateDistance(p, centerOfCenters));
            const avgDistToCenter = distancesToCenter.reduce((a, b) => a + b, 0) / distancesToCenter.length;
            const maxDist = Math.max(...distancesToCenter);
           
            // Если все inliers близко к центру - плохо, если равномерно - хорошо
            distributionScore = Math.min(1.0, avgDistToCenter / (maxDist * 0.5));
        }
       
        // 4. ФАКТОР УВЕРЕННОСТИ
        let confidenceScore = 0.5;
        if (points1[0]?.confidence && points2[0]?.confidence) {
            const avgConf1 = points1.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / points1.length;
            const avgConf2 = points2.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / points2.length;
            confidenceScore = (avgConf1 + avgConf2) / 2;
        }
       
        // 🔥 ИСПРАВЛЕНИЕ: ВЕСА
        // Больше веса inlier ratio, меньше веса distance (так как расстояния могут быть большими)
        const WEIGHTS = {
            INLIER: 0.5,      // Самый важный - сколько точек совпало
            DISTANCE: 0.2,    // Насколько точно
            DISTRIBUTION: 0.2, // Равномерность
            CONFIDENCE: 0.1   // Уверенность точек
        };
       
        score = (inlierScore * WEIGHTS.INLIER) +
                (distanceScore * WEIGHTS.DISTANCE) +
                (distributionScore * WEIGHTS.DISTRIBUTION) +
                (confidenceScore * WEIGHTS.CONFIDENCE);
       
        // 🔥 ИСПРАВЛЕНИЕ: ЖЁСТКИЙ ПОРОГ ДЛЯ СЛУЧАЙНЫХ ТОЧЕК
        // Если inlier ratio низкий, сильно снижаем score
        if (inlierRatio < 0.3) {
            score *= 0.3;
        }
       
        score = Math.max(0, Math.min(1, score));
    }

    return {
        score: score,
        inliers: inliers,
        avgDistance: matchedPoints > 0 ? totalDistance / matchedPoints : Infinity,
        matchedPoints: matchedPoints,
        inlierRatio: matchedPoints / Math.min(points1.length, points2.length)
    };
}

    // 🎨 УТОЧНЕНИЕ ТРАНСФОРМАЦИИ ПО INLIERS
    refineTransformationWithInliers(points1, points2, inliers, mirrored) {
        if (inliers.length < 3) return null;

        try {
            // Берем только точки из inliers
            const inlierPoints1 = inliers.map(i => i.point1);
            const inlierPoints2 = inliers.map(i => i.point2);

            // Вычисляем новую трансформацию по всем inliers
            // (можно использовать метод наименьших квадратов)
           
            // Пока упрощённо - усредняем параметры
            const transforms = [];
           
            // Генерируем трансформации из разных комбинаций inliers
            for (let i = 0; i < Math.min(10, inliers.length); i++) {
                const sample1 = this.getRandomSample(inlierPoints1, 3);
                const sample2 = this.getRandomSample(inlierPoints2, 3);
               
                const transform = this.calculateTransformationFromSamples(
                    sample1, sample2, mirrored
                );
               
                if (transform) transforms.push(transform);
            }

            if (transforms.length === 0) return null;

            // Усредняем параметры
            const avgScale = transforms.reduce((sum, t) => sum + t.scale, 0) / transforms.length;
            const avgRotation = transforms.reduce((sum, t) => sum + t.rotation, 0) / transforms.length;
            const avgTx = transforms.reduce((sum, t) => sum + t.translation.x, 0) / transforms.length;
            const avgTy = transforms.reduce((sum, t) => sum + t.translation.y, 0) / transforms.length;

            return {
                scale: avgScale,
                rotation: avgRotation,
                translation: { x: avgTx, y: avgTy },
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

        if (score >= this.options.excellentAlignmentScore) {
            return {
                quality: 'excellent',
                message: `Отличное совмещение (${(score * 100).toFixed(0)}%)`,
                color: '#00ff00',
                mirrored: mirrored ? 'зеркальное' : 'прямое'
            };
        } else if (score >= this.options.goodAlignmentScore) {
            return {
                quality: 'good',
                message: `Хорошее совмещение (${(score * 100).toFixed(0)}%)`,
                color: '#ffff00',
                mirrored: mirrored ? 'зеркальное' : 'прямое'
            };
        } else if (score >= this.options.targetAlignmentScore) {
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

    // Подготовка точек
    preparePoints(points) {
        return points.map(p => ({
            x: p.x || p.center?.x || 0,
            y: p.y || p.center?.y || 0,
            confidence: p.confidence || 0.5,
            id: p.id || `p_${Math.random().toString(36).substr(2, 9)}`
        }));
    }

    // Трансформация точки
    transformPoint(point, transform, mirrored) {
    if (!transform) return point;

    let x = point.x;
    let y = point.y;

    // 🔥 ИСПРАВЛЕНИЕ: Правильный порядок для зеркала
    if (mirrored) {
        x = -x; // Зеркалим по оси X
    }

    // 🔥 ИСПРАВЛЕНИЕ: Сначала поворот, потом масштаб, потом смещение
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
            algorithm: 'RANSAC-based point cloud alignment',
            features: [
                'Rotation detection (0-180°)',
                'Scale detection (0.5x-2.0x)',
                'Mirror detection',
                'Inlier-based refinement',
                'Confidence-weighted scoring'
            ]
        };
    }
}

module.exports = PointCloudAligner;
