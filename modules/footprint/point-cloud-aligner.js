// modules/footprint/point-cloud-aligner.js
const TopologyUtils = require('./topology-utils');

class PointCloudAligner {
    constructor(options = {}) {
        this.options = {
            maxIterations: options.maxIterations || 1000,
            inlierThreshold: options.inlierThreshold || 10.0,
            minInliersRatio: options.minInliersRatio || 0.3,
            scaleRange: options.scaleRange || { min: 0.5, max: 2.0 },
            ...options
        };

        console.log('🔧 PointCloudAligner создан с параметрами:', {
            maxIterations: this.options.maxIterations,
            inlierThreshold: this.options.inlierThreshold,
            minInliersRatio: this.options.minInliersRatio,
            scaleRange: this.options.scaleRange
        });
    }

    // ОСНОВНОЙ МЕТОД: ПОИСК НАИЛУЧШЕГО ВЫРАВНИВАНИЯ
    findBestAlignment(points1, points2) {
        console.log(`🎯 Поиск наилучшего выравнивания для ${points1?.length || 0} и ${points2?.length || 0} точек`);

        if (!points1 || !points2 || points1.length < 3 || points2.length < 3) {
            console.log('⚠️ Недостаточно точек для выравнивания');
            return {
                score: 0,
                transform: null,
                inliers: [],
                mirrored: false
            };
        }

        // Нормализуем точки для RANSAC
        const normalized1 = this.normalizePointsForRANSAC(points1);
        const normalized2 = this.normalizePointsForRANSAC(points2);

        console.log(`📊 Нормализовано: ${normalized1.length} и ${normalized2.length} точек`);

        // Запускаем RANSAC для обычной и зеркальной трансформации
        const resultRegular = this.runRANSAC(normalized1, normalized2, false);
        const resultMirrored = this.runRANSAC(normalized1, normalized2, true);

        // Выбираем лучший результат
        let bestResult = resultRegular.score >= resultMirrored.score ? resultRegular : resultMirrored;

        console.log(`📊 Результаты: Обычный=${resultRegular.score.toFixed(4)}, Зеркальный=${resultMirrored.score.toFixed(4)}`);

        // 🔥 ДОПОЛНИТЕЛЬНО: Если результат плохой (score < 0.3), пробуем уточнить
        if (bestResult.score < 0.3) {
            console.log('🔄 Пробую уточнить трансформацию...');
            bestResult = this.refineTransformation(normalized1, normalized2, bestResult);
        }

        // Конвертируем трансформацию обратно в оригинальные координаты
        if (bestResult.transform) {
            bestResult.transform = this.convertToOriginalCoordinates(bestResult.transform, points1, points2);
        }

        return bestResult;
    }

    // RANSAC АЛГОРИТМ
    runRANSAC(points1, points2, mirrored) {
        const { maxIterations, inlierThreshold, minInliersRatio } = this.options;
        const minInliers = Math.ceil(points1.length * minInliersRatio);

        let bestTransform = null;
        let bestInliers = [];
        let bestScore = 0;

        console.log(`🔄 Запуск RANSAC (${mirrored ? 'зеркальный' : 'обычный'})...`);

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            // 1. Случайная выборка из 3 точек
            const sample1 = this.getRandomSample(points1, 3);
            const sample2 = this.getRandomSample(points2, 3);

            // 2. Вычисление трансформации для этой выборки
            const transform = this.calculateTransformationFromSamples(sample1, sample2, mirrored);

            if (!transform) continue;

            // 3. Подсчет inliers (точек, удовлетворяющих трансформации)
            const { inliers, score } = this.evaluateTransformation(points1, points2, transform, mirrored);

            // 4. Обновление лучшего результата
            if (inliers.length >= minInliers && score > bestScore) {
                bestScore = score;
                bestInliers = inliers;
                bestTransform = transform;

                // Ранняя остановка если нашли хорошее совпадение
                if (score > 0.8 && inliers.length >= Math.max(5, points1.length * 0.7)) {
                    console.log(`✅ Ранняя остановка на итерации ${iteration}: score=${score.toFixed(4)}`);
                    break;
                }
            }

            // Прогресс
            if (iteration % 100 === 0 && iteration > 0) {
                console.log(`   Итерация ${iteration}/${maxIterations}, лучший score=${bestScore.toFixed(4)}`);
            }
        }

        return {
            score: bestScore,
            transform: bestTransform,
            inliers: bestInliers,
            mirrored: mirrored
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: ВЫЧИСЛЕНИЕ ТРАНСФОРМАЦИИ ИЗ ВЫБОРКИ
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

            // 🔥 ИСПРАВЛЕНИЕ: Для зеркального случая инвертируем X координату
            const adjustedCentered2 = mirrored ?
                centered2.map(p => ({ x: -p.x, y: p.y })) :
                centered2;

            // 1. ВЫЧИСЛЕНИЕ МАСШТАБА (среднее отношение расстояний)
            const scales = [];
            for (let i = 0; i < 3; i++) {
                for (let j = i + 1; j < 3; j++) {
                    const dist1 = this.calculateDistance(centered1[i], centered1[j]);
                    const dist2 = this.calculateDistance(adjustedCentered2[i], adjustedCentered2[j]);

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

            // Сравниваем векторы между точками
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if (i !== j) {
                        const v1 = {
                            x: centered1[j].x - centered1[i].x,
                            y: centered1[j].y - centered1[i].y
                        };
                        const v2 = {
                            x: adjustedCentered2[j].x - adjustedCentered2[i].x,
                            y: adjustedCentered2[j].y - adjustedCentered2[i].y
                        };

                        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
                        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

                        if (len1 > 0 && len2 > 0) {
                            // 🔥 ИСПРАВЛЕНИЕ 2: Правильный расчёт угла
                            const dot = v1.x * v2.x + v1.y * v2.y;
                            const cross = v1.x * v2.y - v1.y * v2.x;
                            const angle = Math.atan2(cross, dot); // Используем atan2

                            totalAngle += angle;
                            angleCount++;
                        }
                    }
                }
            }

            const rotation = angleCount > 0 ? totalAngle / angleCount : 0;

            // 🔥 ИСПРАВЛЕНИЕ 3: Правильный расчёт смещения
            // Смещение = center2 - (повёрнутый и масштабированный center1)
            // Учитываем зеркальность при трансформации center1
            const center1ForTransform = mirrored ?
                { x: -center1.x, y: center1.y } :
                center1;
               
            const translation = {
                x: center2.x - (center1ForTransform.x * scale * Math.cos(rotation) - center1ForTransform.y * scale * Math.sin(rotation)),
                y: center2.y - (center1ForTransform.x * scale * Math.sin(rotation) + center1ForTransform.y * scale * Math.cos(rotation))
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

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: ТРАНСФОРМАЦИЯ ТОЧКИ
    transformPoint(point, transform, mirrored) {
        if (!transform) return point;

        let x = point.x;
        let y = point.y;

        // 🔥 ИСПРАВЛЕНИЕ: Применяем зеркальность, если она указана в transform
        const applyMirror = mirrored || (transform.mirrored || false);
        if (applyMirror) {
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

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    // ОЦЕНКА ТРАНСФОРМАЦИИ
    evaluateTransformation(points1, points2, transform, mirrored) {
        if (!transform) return { inliers: [], score: 0 };

        const inlierThreshold = this.options.inlierThreshold;
        const inliers = [];

        // Для каждой точки из первого набора ищем ближайшую во втором
        for (const point1 of points1) {
            const transformedPoint = this.transformPoint(point1, transform, mirrored);
           
            // Ищем ближайшую точку во втором наборе
            let minDistance = Infinity;
            let closestPoint = null;

            for (const point2 of points2) {
                const distance = this.calculateDistance(transformedPoint, point2);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPoint = point2;
                }
            }

            if (minDistance <= inlierThreshold && closestPoint) {
                inliers.push({
                    point1: point1,
                    point2: closestPoint,
                    distance: minDistance
                });
            }
        }

        // Вычисляем score: учитываем количество inliers и среднее расстояние
        const inlierRatio = points1.length > 0 ? inliers.length / points1.length : 0;
        const avgDistance = inliers.length > 0 ?
            inliers.reduce((sum, inlier) => sum + inlier.distance, 0) / inliers.length :
            inlierThreshold;

        const distanceScore = Math.max(0, 1 - (avgDistance / inlierThreshold));
        const score = (inlierRatio * 0.7 + distanceScore * 0.3);

        return { inliers, score };
    }

    // УТОЧНЕНИЕ ТРАНСФОРМАЦИИ (использует все inliers)
    refineTransformation(points1, points2, initialResult) {
        const { transform, mirrored } = initialResult;

        if (!transform || initialResult.inliers.length < 3) {
            return initialResult;
        }

        try {
            // Используем все inliers для уточнения
            const inlierPoints1 = initialResult.inliers.map(inlier => inlier.point1);
            const inlierPoints2 = initialResult.inliers.map(inlier => inlier.point2);

            // Простая оптимизация: усредняем параметры трансформации
            const transforms = [];

            // Генерируем несколько вариантов из разных подмножеств inliers
            for (let i = 0; i < Math.min(10, initialResult.inliers.length - 2); i++) {
                const sample1 = this.getRandomSample(inlierPoints1, 3);
                const sample2 = this.getRandomSample(inlierPoints2, 3);
                const refinedTransform = this.calculateTransformationFromSamples(sample1, sample2, mirrored);
               
                if (refinedTransform) {
                    transforms.push(refinedTransform);
                }
            }

            if (transforms.length === 0) return initialResult;

            // Усредняем параметры
            const avgScale = transforms.reduce((sum, t) => sum + t.scale, 0) / transforms.length;
            const avgRotation = transforms.reduce((sum, t) => sum + t.rotation, 0) / transforms.length;
            const avgTranslationX = transforms.reduce((sum, t) => sum + t.translation.x, 0) / transforms.length;
            const avgTranslationY = transforms.reduce((sum, t) => sum + t.translation.y, 0) / transforms.length;

            const refinedTransform = {
                scale: avgScale,
                rotation: avgRotation,
                translation: { x: avgTranslationX, y: avgTranslationY },
                mirrored: mirrored
            };

            // Оцениваем уточненную трансформацию
            const { inliers, score } = this.evaluateTransformation(points1, points2, refinedTransform, mirrored);

            return {
                score: score,
                transform: refinedTransform,
                inliers: inliers,
                mirrored: mirrored
            };

        } catch (error) {
            console.log('⚠️ Ошибка уточнения трансформации:', error.message);
            return initialResult;
        }
    }

    // НОРМАЛИЗАЦИЯ ТОЧЕК ДЛЯ RANSAC
    normalizePointsForRANSAC(points) {
        if (!points || points.length === 0) return [];

        // Преобразуем в простой формат {x, y, confidence}
        return points.map((p, index) => ({
            x: p.x || (p.center && p.center.x) || 0,
            y: p.y || (p.center && p.center.y) || 0,
            confidence: p.confidence || 0.5,
            id: p.id || `point_${index}`,
            original: p
        }));
    }

    // ПОЛУЧЕНИЕ СЛУЧАЙНОЙ ВЫБОРКИ
    getRandomSample(points, size) {
        if (!points || points.length < size) return [];

        const shuffled = [...points].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, size);
    }

    // ВЫЧИСЛЕНИЕ ЦЕНТРА ТОЧЕК
    calculateCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    // ВЫЧИСЛЕНИЕ РАССТОЯНИЯ
    calculateDistance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ПОЛУЧЕНИЕ МЕДИАНЫ
    getMedian(numbers) {
        if (!numbers || numbers.length === 0) return 0;
       
        const sorted = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
       
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        } else {
            return sorted[mid];
        }
    }

    // КОНВЕРТАЦИЯ ТРАНСФОРМАЦИИ В ОРИГИНАЛЬНЫЕ КООРДИНАТЫ
    convertToOriginalCoordinates(transform, originalPoints1, originalPoints2) {
        if (!transform) return null;

        // Для простоты возвращаем как есть
        // В реальном случае нужно учитывать нормализацию
        return transform;
    }

    // СОХРАНЕНИЕ ВЫРАВНИВАНИЯ (для отладки)
    saveAlignmentDebug(points1, points2, result, filePath) {
        console.log('💾 Сохранение отладочной информации (заглушка)');
        return true;
    }

    // ПРОВЕРКА КАЧЕСТВА ВЫРАВНИВАНИЯ
    checkAlignmentQuality(result) {
        if (!result || !result.transform) {
            return { quality: 0, message: 'Нет трансформации' };
        }

        const { score, inliers } = result;

        let quality = score;
        let message = '';

        if (score >= 0.8) {
            message = 'Отличное выравнивание';
            quality = 0.9 + (score - 0.8) * 0.5; // Нормализуем к 0.9-1.0
        } else if (score >= 0.6) {
            message = 'Хорошее выравнивание';
            quality = 0.7 + (score - 0.6) * 1.0; // Нормализуем к 0.7-0.9
        } else if (score >= 0.4) {
            message = 'Удовлетворительное выравнивание';
            quality = 0.5 + (score - 0.4) * 1.0; // Нормализуем к 0.5-0.7
        } else if (score >= 0.2) {
            message = 'Плохое выравнивание';
            quality = 0.3 + (score - 0.2) * 1.0; // Нормализуем к 0.3-0.5
        } else {
            message = 'Очень плохое выравнивание';
            quality = score;
        }

        return {
            quality: Math.min(1, Math.max(0, quality)),
            score: score,
            inliersCount: inliers.length,
            message: message
        };
    }

    // ЭКСПОРТ РЕЗУЛЬТАТОВ В ПРОСТОМ ФОРМАТЕ
    exportResultsSimple(result) {
        if (!result || !result.transform) {
            return null;
        }

        return {
            score: result.score,
            scale: result.transform.scale,
            rotationDeg: result.transform.rotation * 180 / Math.PI,
            translationX: result.transform.translation.x,
            translationY: result.transform.translation.y,
            mirrored: result.mirrored,
            inliersCount: result.inliers.length
        };
    }
}

module.exports = PointCloudAligner;
