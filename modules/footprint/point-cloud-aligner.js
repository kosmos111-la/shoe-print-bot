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
            // 1. ВЫЧИСЛЕНИЕ МАСШТАБА (среднее отношение расстояний)
            const scales = [];
            for (let i = 0; i < 3; i++) {
                for (let j = i + 1; j < 3; j++) {
                    const dist1 = this.calculateDistance(sample1[i], sample1[j]);
                    const dist2 = this.calculateDistance(sample2[i], sample2[j]);
                   
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

            // 2. ВЫЧИСЛЕНИЕ ПОВОРОТА (через векторы)
            const vectors1 = [];
            const vectors2 = [];
           
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if (i !== j) {
                        vectors1.push({
                            dx: sample1[j].x - sample1[i].x,
                            dy: sample1[j].y - sample1[i].y
                        });
                        vectors2.push({
                            dx: sample2[j].x - sample2[i].x,
                            dy: sample2[j].y - sample2[i].y
                        });
                    }
                }
            }

            let totalRotation = 0;
            let rotationCount = 0;

            for (let i = 0; i < vectors1.length; i++) {
                const v1 = vectors1[i];
                const v2 = vectors2[i];

                // Нормализуем векторы
                const len1 = Math.sqrt(v1.dx * v1.dx + v1.dy * v1.dy);
                const len2 = Math.sqrt(v2.dx * v2.dx + v2.dy * v2.dy);

                if (len1 > 0 && len2 > 0) {
                    const cosAngle = (v1.dx * v2.dx + v1.dy * v2.dy) / (len1 * len2);
                    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
                    totalRotation += angle;
                    rotationCount++;
                }
            }

            const rotation = rotationCount > 0 ? totalRotation / rotationCount : 0;

            // 3. ВЫЧИСЛЕНИЕ СМЕЩЕНИЯ
            const center1 = this.calculateCenter(sample1);
            const center2 = this.calculateCenter(sample2);

            // Применяем масштаб и поворот к центру первого набора
            const rotatedCenter1 = {
                x: center1.x * scale * Math.cos(rotation) - center1.y * scale * Math.sin(rotation),
                y: center1.x * scale * Math.sin(rotation) + center1.y * scale * Math.cos(rotation)
            };

            const translation = {
                x: center2.x - rotatedCenter1.x,
                y: center2.y - rotatedCenter1.y
            };

            // 4. ЗЕРКАЛЬНОСТЬ
            if (mirrored) {
                // Для зеркала инвертируем X координату
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

        // ПОИСК БЛИЖАЙШИХ СОСЕДЕЙ
        for (let i = 0; i < transformedPoints1.length; i++) {
            const transformedPoint = transformedPoints1[i];
            const originalPoint = points1[i];

            // Ищем ближайшую точку в points2
            let bestMatch = null;
            let bestDistance = Infinity;

            for (const point2 of points2) {
                const distance = this.calculateDistance(transformedPoint, point2);
               
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = point2;
                }
            }

            // Проверяем является ли inlier
            if (bestMatch && bestDistance <= this.options.inlierThreshold) {
                inliers.push({
                    point1: originalPoint,
                    point2: bestMatch,
                    distance: bestDistance,
                    transformed: transformedPoint
                });
               
                totalDistance += bestDistance;
                matchedPoints++;
            }
        }

        // РАСЧЁТ SCORE
        let score = 0;
       
        if (matchedPoints > 0) {
            // 1. ФАКТОР INLIER RATIO
            const inlierRatio = matchedPoints / Math.min(points1.length, points2.length);
           
            // 2. ФАКТОР СРЕДНЕГО РАССТОЯНИЯ
            const avgDistance = totalDistance / matchedPoints;
            const distanceScore = Math.max(0, 1 - (avgDistance / this.options.inlierThreshold));
           
            // 3. ФАКТОР УВЕРЕННОСТИ (если есть)
            let confidenceScore = 0.5; // По умолчанию
            if (points1[0]?.confidence && points2[0]?.confidence) {
                const avgConf1 = points1.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / points1.length;
                const avgConf2 = points2.reduce((sum, p) => sum + (p.confidence || 0.5), 0) / points2.length;
                confidenceScore = (avgConf1 + avgConf2) / 2;
            }

            // ИТОГОВЫЙ SCORE
            score = (inlierRatio * 0.4) +
                   (distanceScore * this.options.distanceWeight) +
                   (confidenceScore * this.options.confidenceWeight);
           
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

        // Зеркало (инверсия по X)
        if (mirrored) {
            x = -x;
        }

        // Масштаб
        x *= transform.scale;
        y *= transform.scale;

        // Поворот
        const cos = Math.cos(transform.rotation);
        const sin = Math.sin(transform.rotation);
       
        const rotatedX = x * cos - y * sin;
        const rotatedY = x * sin + y * cos;

        // Смещение
        return {
            x: rotatedX + transform.translation.x,
            y: rotatedY + transform.translation.y
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
