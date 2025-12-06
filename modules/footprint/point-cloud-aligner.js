// modules/footprint/point-cloud-aligner.js
const TopologyUtils = require('./topology-utils');

class PointCloudAligner {
    constructor(options = {}) {
        this.options = {
            maxIterations: options.maxIterations || 1000,
            inlierThreshold: options.inlierThreshold || 15.0,      // Более строгий порог
            minInliersRatio: options.minInliersRatio || 0.6,       // Требуем 60% совпадений
            minInliersAbsolute: options.minInliersAbsolute || 5,   // Минимум inliers
            scaleRange: options.scaleRange || { min: 0.7, max: 1.3 }, // Ужесточаем масштаб
            mirrorCheck: true,
            // 🔥 НОВЫЕ СТРОГИЕ ПАРАМЕТРЫ
            requireGoodDistribution: true,
            maxAvgDistance: 10,
            confidenceThreshold: 0.6,      // Минимальная уверенность точек
           
            ...options
        };

        console.log('🔧 PointCloudAligner создан с параметрами:', {
            maxIterations: this.options.maxIterations,
            inlierThreshold: this.options.inlierThreshold,
            minInliersRatio: this.options.minInliersRatio,
            minInliersAbsolute: this.options.minInliersAbsolute,
            scaleRange: this.options.scaleRange,
            confidenceThreshold: this.options.confidenceThreshold
        });
    }

    // 🔥 ИСПРАВЛЕННЫЙ ОСНОВНОЙ МЕТОД С ДОПОЛНИТЕЛЬНЫМИ ПРОВЕРКАМИ
    findBestAlignment(points1, points2) {
        console.log(`🎯 Поиск наилучшего выравнивания для ${points1?.length || 0} и ${points2?.length || 0} точек`);

        if (!points1 || !points2 || points1.length < 3 || points2.length < 3) {
            console.log('⚠️ Недостаточно точек для выравнивания');
            return {
                score: 0,
                transform: null,
                inliers: [],
                mirrored: false,
                quality: {
                    quality: 0,
                    message: 'Недостаточно точек для выравнивания'
                }
            };
        }

        // Нормализуем точки для RANSAC
        const normalized1 = this.normalizePointsForRANSAC(points1);
        const normalized2 = this.normalizePointsForRANSAC(points2);

        console.log(`📊 Нормализовано: ${normalized1.length} и ${normalized2.length} точек`);

        // Проверяем качество точек (уверенность)
        const avgConfidence1 = normalized1.reduce((sum, p) => sum + p.confidence, 0) / normalized1.length;
        const avgConfidence2 = normalized2.reduce((sum, p) => sum + p.confidence, 0) / normalized2.length;
       
        if (avgConfidence1 < this.options.confidenceThreshold || avgConfidence2 < this.options.confidenceThreshold) {
            console.log(`⚠️ Низкая уверенность точек: ${avgConfidence1.toFixed(2)}/${avgConfidence2.toFixed(2)}`);
        }

        // Запускаем RANSAC для обычной и зеркальной трансформации
        const resultRegular = this.runRANSAC(normalized1, normalized2, false);
        const resultMirrored = this.runRANSAC(normalized1, normalized2, true);

        // 🔥 СТРОГАЯ ПРОВЕРКА: зеркальная трансформация должна быть значительно лучше
        const mirrorThreshold = 0.15; // Зеркальная должна быть лучше на 15%
        let bestResult;
       
        if (resultMirrored.score > resultRegular.score * (1 + mirrorThreshold)) {
            bestResult = resultMirrored;
            console.log(`✅ Выбрана зеркальная трансформация (лучше на ${((resultMirrored.score/resultRegular.score - 1)*100).toFixed(1)}%)`);
        } else {
            bestResult = resultRegular;
            if (resultMirrored.score > resultRegular.score) {
                console.log(`ℹ️  Зеркальная лучше, но недостаточно: ${resultMirrored.score.toFixed(4)} vs ${resultRegular.score.toFixed(4)}`);
            }
        }

        console.log(`📊 Результаты: Обычный=${resultRegular.score.toFixed(4)}, Зеркальный=${resultMirrored.score.toFixed(4)}`);

        // 🔥 ДОПОЛНИТЕЛЬНО: Если результат плохой (score < 0.3), НЕ пробуем уточнять
        // Это предотвращает "натягивание" совпадений на случайные точки
        if (bestResult.score < 0.3 && bestResult.inliers.length < this.options.minInliersAbsolute) {
            console.log('⚠️ Слишком низкий score и мало inliers - пропускаем уточнение');
            bestResult = {
                score: bestResult.score,
                transform: null,
                inliers: [],
                mirrored: bestResult.mirrored,
                quality: {
                    quality: bestResult.score,
                    message: 'Очень плохое выравнивание'
                }
            };
        } else if (bestResult.score < 0.3) {
            console.log('🔄 Пробую уточнить трансформацию...');
            bestResult = this.refineTransformation(normalized1, normalized2, bestResult);
        }

        // Конвертируем трансформацию обратно в оригинальные координаты
        if (bestResult.transform) {
            bestResult.transform = this.convertToOriginalCoordinates(bestResult.transform, points1, points2);
        }

        // 🔥 ДОБАВЛЯЕМ КАЧЕСТВО
        bestResult.quality = this.checkAlignmentQuality(bestResult);

        return bestResult;
    }

    // 🔥 УСОВЕРШЕНСТВОВАННЫЙ RANSAC
    runRANSAC(points1, points2, mirrored) {
        const { maxIterations, inlierThreshold, minInliersRatio, minInliersAbsolute } = this.options;
        const minInliers = Math.max(minInliersAbsolute, Math.ceil(points1.length * minInliersRatio));

        let bestTransform = null;
        let bestInliers = [];
        let bestScore = 0;
        let bestDistributionScore = 0;

        console.log(`🔄 Запуск RANSAC (${mirrored ? 'зеркальный' : 'обычный'})...`);

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            // 1. Случайная выборка из 3 точек (только с хорошей уверенностью)
            const sample1 = this.getRandomSampleWithConfidence(points1, 3);
            const sample2 = this.getRandomSampleWithConfidence(points2, 3);

            if (sample1.length < 3 || sample2.length < 3) continue;

            // 2. Вычисление трансформации для этой выборки
            const transform = this.calculateTransformationFromSamples(sample1, sample2, mirrored);

            if (!transform) continue;

            // 🔥 СТРОГАЯ ОЦЕНКА ТРАНСФОРМАЦИИ
            const evaluation = this.evaluateTransformationStrict(points1, points2, transform, mirrored);

            // 4. Проверяем минимальные требования
            if (evaluation.inliers.length < minInliers) continue;
            if (evaluation.inlierRatio < minInliersRatio) continue;

            // 🔥 УЧИТЫВАЕМ РАСПРЕДЕЛЕНИЕ INLIERS
            const distributionScore = this.calculateDistributionScore(evaluation.inliers);

            // Комбинированный score с учётом распределения
            const combinedScore = evaluation.score * (0.7 + distributionScore * 0.3);

            // 5. Обновление лучшего результата
            if (combinedScore > bestScore || (Math.abs(combinedScore - bestScore) < 0.01 && distributionScore > bestDistributionScore)) {
                bestScore = combinedScore;
                bestInliers = evaluation.inliers;
                bestTransform = transform;
                bestDistributionScore = distributionScore;

                // Ранняя остановка если нашли отличное совпадение
                if (bestScore > 0.9 && evaluation.inliers.length >= Math.max(7, points1.length * 0.8)) {
                    console.log(`✅ Ранняя остановка на итерации ${iteration}: score=${bestScore.toFixed(4)}`);
                    break;
                }
            }

            // Прогресс
            if (iteration % 200 === 0 && iteration > 0) {
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

    // 🔥 СТРОГАЯ ОЦЕНКА ТРАНСФОРМАЦИИ
    evaluateTransformationStrict(points1, points2, transform, mirrored) {
        if (!transform) return { inliers: [], score: 0, inlierRatio: 0 };

        const inlierThreshold = this.options.inlierThreshold;
        const inliers = [];
        const usedIndices = new Set(); // 🔥 Запрещаем повторное использование точек

        // Для каждой точки из первого набора ищем ближайшую во втором
        for (const point1 of points1) {
            // 🔥 Пропускаем точки с низкой уверенностью
            if (point1.confidence < this.options.confidenceThreshold) continue;

            const transformedPoint = this.transformPoint(point1, transform, mirrored);

            // Ищем ближайшую НЕИСПОЛЬЗОВАННУЮ точку во втором наборе
            let minDistance = Infinity;
            let closestPoint = null;
            let closestIndex = -1;

            for (let j = 0; j < points2.length; j++) {
                if (usedIndices.has(j)) continue;
               
                const point2 = points2[j];
                // 🔥 Пропускаем точки с низкой уверенностью
                if (point2.confidence < this.options.confidenceThreshold) continue;

                const distance = this.calculateDistance(transformedPoint, point2);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPoint = point2;
                    closestIndex = j;
                }
            }

            // 🔥 СТРОГИЕ КРИТЕРИИ: расстояние + уверенность
            const avgConfidence = (point1.confidence + (closestPoint?.confidence || 0)) / 2;
           
            if (closestPoint &&
                minDistance <= inlierThreshold &&
                avgConfidence >= this.options.confidenceThreshold) {
               
                inliers.push({
                    point1: point1,
                    point2: closestPoint,
                    distance: minDistance,
                    confidence: avgConfidence
                });
                usedIndices.add(closestIndex);
            }
        }

        // Вычисляем score с весами
        const inlierRatio = points1.length > 0 ? inliers.length / points1.length : 0;
       
        // 🔥 СИЛЬНЫЙ ШТРАФ ЗА БОЛЬШИЕ РАССТОЯНИЯ
        const avgDistance = inliers.length > 0 ?
            inliers.reduce((sum, inlier) => sum + inlier.distance, 0) / inliers.length :
            inlierThreshold;

        let distanceScore;
        if (avgDistance <= inlierThreshold * 0.3) {
            distanceScore = 1.0;
        } else if (avgDistance <= inlierThreshold * 0.6) {
            distanceScore = 0.7;
        } else if (avgDistance <= inlierThreshold) {
            distanceScore = 0.3;
        } else {
            distanceScore = 0;
        }

        // 🔥 ШТРАФ ЗА МАЛО INLIERS
        let inlierScore;
        if (inlierRatio >= 0.8) {
            inlierScore = 1.0;
        } else if (inlierRatio >= 0.6) {
            inlierScore = 0.7 + (inlierRatio - 0.6) * 1.5;
        } else {
            inlierScore = inlierRatio * 0.7 / 0.6;
        }

        // 🔥 ФАКТОР УВЕРЕННОСТИ
        const avgConfidence = inliers.length > 0 ?
            inliers.reduce((sum, inlier) => sum + inlier.confidence, 0) / inliers.length :
            0.5;
        const confidenceScore = Math.max(0, (avgConfidence - 0.5) * 2);

        // 🔥 ЖЁСТКИЕ ВЕСА
        const WEIGHTS = {
            INLIER: 0.4,
            DISTANCE: 0.3,
            CONFIDENCE: 0.2,
            DISTRIBUTION: 0.1
        };

        // Сначала без distribution score
        let score = (inlierScore * WEIGHTS.INLIER) +
                    (distanceScore * WEIGHTS.DISTANCE) +
                    (confidenceScore * WEIGHTS.CONFIDENCE);

        // 🔥 СИЛЬНЫЙ ШТРАФ ЗА БОЛЬШИЕ СРЕДНИЕ РАССТОЯНИЯ
        if (avgDistance > this.options.maxAvgDistance) {
            score *= 0.5;
        }

        // 🔥 ШТРАФ ЗА МАЛО INLIERS (даже если прошли порог)
        if (inlierRatio < 0.7) {
            score *= 0.8;
        }

        score = Math.max(0, Math.min(1, score));

        return {
            inliers,
            score,
            inlierRatio,
            avgDistance,
            avgConfidence
        };
    }

    // 🔥 РАСЧЁТ КОЭФФИЦИЕНТА РАСПРЕДЕЛЕНИЯ
    calculateDistributionScore(inliers) {
        if (!this.options.requireGoodDistribution || inliers.length < 3) {
            return 1.0;
        }

        const points = inliers.map(inlier => inlier.point2);
        const center = this.calculateCenter(points);
       
        // Расстояния от центра
        const distances = points.map(p => this.calculateDistance(p, center));
        const maxDist = Math.max(...distances);
       
        if (maxDist < 10) {
            return 0.1; // Все точки в одном месте - очень плохо
        }

        // Стандартное отклонение расстояний
        const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length;
        const stdDev = Math.sqrt(variance);

        // Чем больше stdDev относительно maxDist, тем лучше распределение
        const distribution = stdDev / (maxDist * 0.5);
       
        return Math.max(0.1, Math.min(1.0, distribution));
    }

    // 🔥 ВЫБОРКА С УЧЁТОМ УВЕРЕННОСТИ
    getRandomSampleWithConfidence(points, size) {
        if (!points || points.length < size) return [];
       
        // Взвешенная выборка: точки с большей уверенностью имеют больше шансов
        const weightedPoints = points.map(p => ({
            point: p,
            weight: p.confidence || 0.5
        }));
       
        const selected = [];
        for (let i = 0; i < size && weightedPoints.length > 0; i++) {
            // Выбираем точку с учётом веса
            const totalWeight = weightedPoints.reduce((sum, wp) => sum + wp.weight, 0);
            let random = Math.random() * totalWeight;
           
            for (let j = 0; j < weightedPoints.length; j++) {
                random -= weightedPoints[j].weight;
                if (random <= 0) {
                    selected.push(weightPoints[j].point);
                    weightedPoints.splice(j, 1);
                    break;
                }
            }
        }
       
        return selected;
    }

    // ОСТАВЛЯЕМ ОСТАЛЬНЫЕ МЕТОДЫ БЕЗ ИЗМЕНЕНИЙ, НО ИСПРАВИМ ОШИБКИ:

    // 🔥 ИСПРАВЛЕНИЕ: В calculateTransformationFromSamples исправляем зеркало
    calculateTransformationFromSamples(sample1, sample2, mirrored) {
        // ... существующий код ...

        try {
            // ... существующий код ...

            // 🔥 ИСПРАВЛЕНИЕ: Правильное определение зеркала
            // Проверяем, действительно ли это зеркало
            if (mirrored) {
                // Для зеркала вычисляем детерминант матрицы преобразования
                // Если детерминант положительный - это не зеркало, а поворот
                const points1Tri = sample1.map(p => ({x: p.x, y: p.y}));
                const points2Tri = sample2.map(p => ({x: p.x, y: p.y}));
               
                // Вычисляем матрицу преобразования
                const A = [];
                const B = [];
               
                for (let i = 0; i < 3; i++) {
                    A.push([points1Tri[i].x, -points1Tri[i].y, 1, 0]);
                    A.push([points1Tri[i].y, points1Tri[i].x, 0, 1]);
                    B.push(points2Tri[i].x);
                    B.push(points2Tri[i].y);
                }
               
                // Решаем систему для получения параметров [a, b, tx, ty]
                // где a = s*cosθ, b = s*sinθ
                const params = this.solveLinearSystem(A, B);
                if (params) {
                    const det = params[0] * params[0] + params[1] * params[1];
                    const scale = Math.sqrt(det);
                    // Если масштаб близок к 1, а угол мал - это не зеркало
                    if (Math.abs(scale - 1) < 0.1) {
                        const angle = Math.atan2(params[1], params[0]);
                        if (Math.abs(angle) < Math.PI/6) { // Меньше 30 градусов
                            // Вероятно, это не зеркало, а небольшой поворот
                            mirrored = false;
                        }
                    }
                }
            }

            // ... остальной код ...
        } catch (error) {
            console.log('❌ Ошибка вычисления трансформации:', error.message);
            return null;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Решение системы линейных уравнений
    solveLinearSystem(A, B) {
        // Простая реализация для 4x4 системы
        // Используем метод Гаусса
        const n = B.length;
        const augmented = A.map((row, i) => [...row, B[i]]);
       
        // Прямой ход
        for (let i = 0; i < n; i++) {
            // Поиск максимального элемента в столбце
            let maxRow = i;
            for (let j = i + 1; j < n; j++) {
                if (Math.abs(augmented[j][i]) > Math.abs(augmented[maxRow][i])) {
                    maxRow = j;
                }
            }
           
            // Обмен строк
            [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
           
            // Проверка на ноль
            if (Math.abs(augmented[i][i]) < 1e-10) {
                return null;
            }
           
            // Нормализация
            for (let j = i + 1; j < n; j++) {
                const factor = augmented[j][i] / augmented[i][i];
                for (let k = i; k <= n; k++) {
                    augmented[j][k] -= factor * augmented[i][k];
                }
            }
        }
       
        // Обратный ход
        const x = new Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            x[i] = augmented[i][n];
            for (let j = i + 1; j < n; j++) {
                x[i] -= augmented[i][j] * x[j];
            }
            x[i] /= augmented[i][i];
        }
       
        return x;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД ПРОВЕРКИ КАЧЕСТВА
    checkAlignmentQuality(result) {
        if (!result || !result.transform || result.score < 0.3) {
            return { quality: 0, message: 'Очень плохое выравнивание' };
        }

        const { score, inliers } = result;

        let quality = score;
        let message = '';

        // 🔥 СТРОГАЯ ГРАДАЦИЯ
        if (score >= 0.8 && inliers.length >= this.options.minInliersAbsolute) {
            message = 'Отличное выравнивание';
            quality = 0.9 + (score - 0.8) * 0.5;
        } else if (score >= 0.7 && inliers.length >= this.options.minInliersAbsolute) {
            message = 'Хорошее выравнивание';
            quality = 0.8 + (score - 0.7) * 1.0;
        } else if (score >= 0.5 && inliers.length >= this.options.minInliersAbsolute) {
            message = 'Удовлетворительное выравнивание';
            quality = 0.5 + (score - 0.5) * 1.0;
        } else if (score >= 0.3) {
            message = 'Плохое выравнивание';
            quality = 0.3 + (score - 0.3) * 1.0;
        } else {
            message = 'Очень плохое выравнивание';
            quality = score;
        }

        // 🔥 ШТРАФ ЗА МАЛО INLIERS
        if (inliers.length < this.options.minInliersAbsolute) {
            quality *= 0.7;
            message += ' (мало совпадающих точек)';
        }

        return {
            quality: Math.min(1, Math.max(0, quality)),
            score: score,
            inliersCount: inliers.length,
            message: message
        };
    }

    // ОСТАЛЬНЫЕ МЕТОДЫ ОСТАЮТСЯ ТАКИМИ ЖЕ, КАК В ВАШЕМ ФАЙЛЕ
    // (transformPoint, normalizePointsForRANSAC, getRandomSample, calculateCenter,
    // calculateDistance, getMedian, convertToOriginalCoordinates, refineTransformation,
    // exportResultsSimple, saveAlignmentDebug)

    // ... остальные методы без изменений ...
}

module.exports = PointCloudAligner;
