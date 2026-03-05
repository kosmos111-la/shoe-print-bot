// modules/footprint/matching/GeometricValidator.js
// 🔥 ГЕОМЕТРИЧЕСКАЯ ВЕРИФИКАЦИЯ ЯКОРЕЙ ЧЕРЕЗ RANSAC

class GeometricValidator {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Параметры RANSAC
        this.ransacIterations = options.ransacIterations || 100;
        this.distanceThreshold = options.distanceThreshold || 10.0; // пикселей
        this.minInliers = options.minInliers || 3;
       
        console.log(`📐 GeometricValidator создан`);
        console.log(`   • Итераций RANSAC: ${this.ransacIterations}`);
        console.log(`   • Порог расстояния: ${this.distanceThreshold}px`);
    }

    /**
     * 🔥 ОСНОВНОЙ МЕТОД: верификация якорей
     * @param {Array} anchors - массив якорей { pointA, pointB, confidence, zone }
     * @param {Map} pointsA - карта точек из фото (id -> {x, y})
     * @param {Map} pointsB - карта точек из модели (id -> {x, y})
     * @returns {Object} результат верификации
     */
    validateAnchors(anchors, pointsA, pointsB) {
        console.log(`\n🔍 ГЕОМЕТРИЧЕСКАЯ ВЕРИФИКАЦИЯ ЯКОРЕЙ`);
        console.log(`========================================`);
        console.log(`📊 Всего кандидатов: ${anchors.length}`);

        if (anchors.length < 3) {
            console.log(`⚠️ Меньше 3 якорей, верификация невозможна`);
            return {
                verified: [],
                rejected: [],
                transform: null,
                inliers: [],
                outliers: []
            };
        }

        // ШАГ 1: Подготовка данных для RANSAC
        const data = [];
        for (const anchor of anchors) {
            const pointA = pointsA.get(anchor.pointA);
            const pointB = pointsB.get(anchor.pointB);
           
            if (!pointA || !pointB) continue;
           
            data.push({
                id: anchor.pointA,
                modelId: anchor.pointB,
                x1: pointA.x,
                y1: pointA.y,
                x2: pointB.x,
                y2: pointB.y,
                confidence: anchor.confidence,
                zone: anchor.zone
            });
        }

        console.log(`📊 Подготовлено данных: ${data.length}`);

        // ШАГ 2: RANSAC для поиска лучшего преобразования
        const bestModel = this.ransac(data);
       
        if (!bestModel) {
            console.log(`❌ RANSAC не нашел стабильного преобразования`);
            return {
                verified: [],
                rejected: anchors,
                transform: null,
                inliers: [],
                outliers: data
            };
        }

        // ШАГ 3: Классификация на inliers/outliers
        const inliers = [];
        const outliers = [];
       
        for (const point of data) {
            const projected = this.applyTransform(point.x1, point.y1, bestModel.transform);
            const dx = projected.x - point.x2;
            const dy = projected.y - point.y2;
            const dist = Math.sqrt(dx*dx + dy*dy);
           
            if (dist <= this.distanceThreshold) {
                inliers.push(point);
            } else {
                outliers.push(point);
            }
        }

        console.log(`\n📊 РЕЗУЛЬТАТ ВЕРИФИКАЦИИ:`);
        console.log(`   • Подтверждено (inliers): ${inliers.length}`);
        console.log(`   • Отвергнуто (outliers): ${outliers.length}`);
        console.log(`   • Точность модели: ${(inliers.length/data.length*100).toFixed(1)}%`);

        // ШАГ 4: Формируем результат
        const verified = [];
        const rejected = [];

        for (const inlier of inliers) {
            verified.push({
                pointA: inlier.id,
                pointB: inlier.modelId,
                confidence: 1.0,
                zone: inlier.zone,
                geometricError: this.calculateError(inlier, bestModel.transform)
            });
        }

        for (const outlier of outliers) {
            rejected.push({
                pointA: outlier.id,
                pointB: outlier.modelId,
                confidence: 0.0,
                zone: outlier.zone,
                geometricError: this.calculateError(outlier, bestModel.transform),
                alternatives: this.findAlternatives(outlier, data, bestModel.transform)
            });
        }

        return {
            verified,
            rejected,
            transform: bestModel.transform,
            inliers: inliers.map(p => p.id),
            outliers: outliers.map(p => p.id),
            stats: {
                total: data.length,
                verified: verified.length,
                rejected: rejected.length,
                inlierRatio: inliers.length / data.length
            }
        };
    }

    /**
     * 🔥 RANSAC: поиск лучшего преобразования
     */
    ransac(data) {
        if (data.length < 2) return null;

        let bestInliers = [];
        let bestTransform = null;
        let bestScore = 0;

        for (let iter = 0; iter < this.ransacIterations; iter++) {
            // Случайно выбираем 2 точки для вычисления преобразования
            const idx1 = Math.floor(Math.random() * data.length);
            let idx2;
            do {
                idx2 = Math.floor(Math.random() * data.length);
            } while (idx2 === idx1);

            const p1 = data[idx1];
            const p2 = data[idx2];

            // Вычисляем преобразование (поворот + сдвиг)
            const transform = this.computeTransform(p1, p2);
            if (!transform) continue;

            // Считаем, сколько точек поддерживают это преобразование
            const inliers = [];
            for (const point of data) {
                const projected = this.applyTransform(point.x1, point.y1, transform);
                const dx = projected.x - point.x2;
                const dy = projected.y - point.y2;
                const dist = Math.sqrt(dx*dx + dy*dy);
               
                if (dist <= this.distanceThreshold) {
                    inliers.push(point);
                }
            }

            // Обновляем лучшее решение
            if (inliers.length > bestScore) {
                bestScore = inliers.length;
                bestInliers = inliers;
                bestTransform = transform;
            }

            // Ранний выход, если нашли отличное решение
            if (bestScore > data.length * 0.8) {
                break;
            }
        }

        if (bestScore < this.minInliers) {
            return null;
        }

        // Пересчитываем преобразование по всем inliers для точности
        if (bestInliers.length >= 2) {
            bestTransform = this.refineTransform(bestInliers);
        }

        return {
            transform: bestTransform,
            inliers: bestInliers,
            score: bestScore
        };
    }

    /**
     * 🔥 Вычисление преобразования по двум точкам
     * Модель: поворот + масштаб + сдвиг
     */
    computeTransform(p1, p2) {
        // Вектора в первом изображении
        const dx1 = p2.x1 - p1.x1;
        const dy1 = p2.y1 - p1.y1;
       
        // Вектора во втором изображении
        const dx2 = p2.x2 - p1.x2;
        const dy2 = p2.y2 - p1.y2;
       
        // Вычисляем масштаб
        const len1 = Math.sqrt(dx1*dx1 + dy1*dy1);
        const len2 = Math.sqrt(dx2*dx2 + dy2*dy2);
       
        if (len1 < 0.001 || len2 < 0.001) return null;
       
        const scale = len2 / len1;
       
        // Вычисляем угол поворота
        let angle = Math.atan2(dy2, dx2) - Math.atan2(dy1, dx1);
       
        // Нормализуем угол
        while (angle < -Math.PI) angle += 2*Math.PI;
        while (angle > Math.PI) angle -= 2*Math.PI;
       
        // Вычисляем сдвиг
        const tx = p1.x2 - (p1.x1 * Math.cos(angle) - p1.y1 * Math.sin(angle)) * scale;
        const ty = p1.y2 - (p1.x1 * Math.sin(angle) + p1.y1 * Math.cos(angle)) * scale;
       
        return {
            scale,
            angle,
            tx,
            ty,
            cos: Math.cos(angle),
            sin: Math.sin(angle)
        };
    }

    /**
     * 🔥 Применение преобразования к точке
     */
    applyTransform(x, y, transform) {
        const xr = x * transform.cos - y * transform.sin;
        const yr = x * transform.sin + y * transform.cos;
       
        return {
            x: xr * transform.scale + transform.tx,
            y: yr * transform.scale + transform.ty
        };
    }

    /**
     * 🔥 Уточнение преобразования по множеству точек (метод наименьших квадратов)
     */
    refineTransform(points) {
        if (points.length < 2) return null;

        // Усредняем масштаб и угол по всем парам
        let sumScale = 0;
        let sumAngle = 0;
        let validPairs = 0;

        for (let i = 0; i < points.length; i++) {
            for (let j = i+1; j < points.length; j++) {
                const p1 = points[i];
                const p2 = points[j];
               
                const dx1 = p2.x1 - p1.x1;
                const dy1 = p2.y1 - p1.y1;
                const dx2 = p2.x2 - p1.x2;
                const dy2 = p2.y2 - p1.y2;
               
                const len1 = Math.sqrt(dx1*dx1 + dy1*dy1);
                const len2 = Math.sqrt(dx2*dx2 + dy2*dy2);
               
                if (len1 < 0.001 || len2 < 0.001) continue;
               
                sumScale += len2 / len1;
               
                let angle = Math.atan2(dy2, dx2) - Math.atan2(dy1, dx1);
                while (angle < -Math.PI) angle += 2*Math.PI;
                while (angle > Math.PI) angle -= 2*Math.PI;
               
                sumAngle += angle;
                validPairs++;
            }
        }

        if (validPairs === 0) return null;

        const scale = sumScale / validPairs;
        const angle = sumAngle / validPairs;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Вычисляем сдвиг как среднее по всем точкам
        let sumTx = 0;
        let sumTy = 0;

        for (const point of points) {
            const xr = point.x1 * cos - point.y1 * sin;
            const yr = point.x1 * sin + point.y1 * cos;
           
            sumTx += point.x2 - xr * scale;
            sumTy += point.y2 - yr * scale;
        }

        const tx = sumTx / points.length;
        const ty = sumTy / points.length;

        return { scale, angle, tx, ty, cos, sin };
    }

    /**
     * 🔥 Вычисление ошибки для точки
     */
    calculateError(point, transform) {
        const projected = this.applyTransform(point.x1, point.y1, transform);
        const dx = projected.x - point.x2;
        const dy = projected.y - point.y2;
        return Math.sqrt(dx*dx + dy*dy);
    }

    /**
     * 🔥 Поиск альтернативных соответствий для отвергнутой точки
     */
    findAlternatives(point, allPoints, transform) {
        const alternatives = [];
       
        // Ищем другие точки модели, которые могли бы соответствовать этой точке фото
        for (const other of allPoints) {
            if (other.modelId === point.modelId) continue;
           
            const projected = this.applyTransform(point.x1, point.y1, transform);
            const dx = projected.x - other.x2;
            const dy = projected.y - other.y2;
            const dist = Math.sqrt(dx*dx + dy*dy);
           
            if (dist <= this.distanceThreshold * 2) {
                alternatives.push({
                    pointB: other.modelId,
                    distance: dist,
                    confidence: 1 - dist / (this.distanceThreshold * 4)
                });
            }
        }

        return alternatives.sort((a, b) => a.distance - b.distance);
    }
}

module.exports = GeometricValidator;
