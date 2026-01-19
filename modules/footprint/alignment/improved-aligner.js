// modules/footprint/alignment/improved-aligner.js

const fs = require('fs');
const path = require('path');

class ImprovedAligner {
    constructor(options = {}) {
        this.config = {
            debug: options.debug || false,
            visualizationDir: options.visualizationDir || './data/visualizations/alignments',
            maxPoints: options.maxPoints || 100,
            matchThreshold: options.matchThreshold || 30,
            ransacIterations: options.ransacIterations || 100,
            minPointsForRANSAC: options.minPointsForRANSAC || 3,
            ...options
        };

        // Создаем директорию для визуализаций
        if (!fs.existsSync(this.config.visualizationDir)) {
            fs.mkdirSync(this.config.visualizationDir, { recursive: true });
        }
    }

    // Основной метод выравнивания с интеллектуальным сопоставлением
    async alignWithIntelligentMatching(points2, points1, transformation2 = null, transformation1 = null) {
        console.log(`🎯 ИНТЕЛЛЕКТУАЛЬНОЕ ВЫРАВНИВАНИЕ:`);
        console.log(`   Целевые точки: ${points1.length}`);
        console.log(`   Исходные точки: ${points2.length}`);
       
        if (transformation1) {
            console.log(`   Трансформация цели: ${transformation1.rotationAngle?.toFixed(1) || 0}°`);
        }
        if (transformation2) {
            console.log(`   Трансформация источника: ${transformation2.rotationAngle?.toFixed(1) || 0}°`);
        }

        // 1. Предварительная обработка точек
        const processedPoints1 = this.preprocessPoints(points1);
        const processedPoints2 = this.preprocessPoints(points2);

        // 2. Поиск характерных точек для сопоставления
        const keypoints1 = this.extractKeypoints(processedPoints1);
        const keypoints2 = this.extractKeypoints(processedPoints2);

        console.log(`🔑 Характерные точки: ${keypoints1.length} и ${keypoints2.length}`);

        // 3. Сопоставление характерных точек
        const matches = this.matchKeypoints(keypoints1, keypoints2);

        console.log(`🤝 Найдено сопоставлений: ${matches.length}`);

        if (matches.length < this.config.minPointsForRANSAC) {
            console.log(`⚠️ Недостаточно сопоставлений для RANSAC, использую простое выравнивание`);
            return this.alignWithSimpleTransform(points2, points1, transformation2, transformation1);
        }

        // 4. Оценка трансформации с помощью RANSAC
        const bestTransform = this.estimateTransformWithRANSAC(matches);

        if (!bestTransform) {
            console.log(`⚠️ RANSAC не смог найти хорошую трансформацию, использую простое выравнивание`);
            return this.alignWithSimpleTransform(points2, points1, transformation2, transformation1);
        }

        // 5. Применение трансформации ко всем точкам
        const alignedPoints = this.applyTransform(points2, bestTransform);

        // 6. Расчет качества выравнивания
        const quality = this.calculateAlignmentQuality(processedPoints1, alignedPoints);

        console.log(`✅ Выравнивание успешно! Качество: ${quality.toFixed(3)}`);
        console.log(`   Трансформация:`);
        console.log(`     Поворот: ${bestTransform.rotation?.toFixed(2) || 0}°`);
        console.log(`     Смещение: (${bestTransform.translation?.x?.toFixed(1) || 0}, ${bestTransform.translation?.y?.toFixed(1) || 0})`);
        console.log(`     Масштаб: ${bestTransform.scale?.toFixed(3) || 1}`);

        return {
            success: true,
            quality: quality,
            alignedPoints: alignedPoints,
            transform: bestTransform,
            matches: matches,
            method: 'intelligent_matching_with_ransac'
        };
    }

    // Простое выравнивание (фоллбэк)
    alignWithSimpleTransform(points2, points1, transformation2, transformation1) {
        console.log(`🔄 Простое выравнивание (фоллбэк)`);
       
        // 1. Выравниваем по центрам
        const center1 = this.calculateCenter(points1);
        const center2 = this.calculateCenter(points2);
       
        const translation = {
            x: center1.x - center2.x,
            y: center1.y - center2.y
        };
       
        // 2. Если есть информация о трансформациях, используем ее
        let rotation = 0;
        if (transformation1 && transformation2) {
            rotation = (transformation1.rotationAngle || 0) - (transformation2.rotationAngle || 0);
            console.log(`   Корректировка угла: ${rotation.toFixed(1)}°`);
        }
       
        // 3. Применяем трансформацию
        const transform = {
            rotation: rotation,
            translation: translation,
            scale: 1,
            center: center2
        };
       
        const alignedPoints = this.applyTransform(points2, transform);
       
        // 4. Расчет качества
        const quality = this.calculateSimpleAlignmentQuality(points1, alignedPoints);
       
        return {
            success: true,
            quality: quality,
            alignedPoints: alignedPoints,
            transform: transform,
            method: 'simple_alignment_fallback'
        };
    }

    // Предобработка точек
    preprocessPoints(points) {
        return points.map(point => ({
            x: point.x || 0,
            y: point.y || 0,
            id: point.id || `p_${Math.random().toString(36).substr(2, 9)}`,
            confidence: point.confidence || 0.5,
            original: point
        }));
    }

    // Извлечение характерных точек
    extractKeypoints(points) {
        if (points.length <= 10) {
            return points; // Все точки считаем характерными при малом количестве
        }
       
        // 1. Кластеризация точек для нахождения плотных областей
        const clusters = this.clusterPoints(points, 50); // 50px радиус кластера
       
        // 2. Выбираем наиболее характерные точки из каждого кластера
        const keypoints = [];
       
        clusters.forEach(cluster => {
            if (cluster.points.length > 0) {
                // Выбираем точку с наибольшей уверенностью или ближайшую к центру кластера
                const bestPoint = this.selectBestPointInCluster(cluster);
                keypoints.push(bestPoint);
            }
        });
       
        // 3. Добавляем крайние точки (границы)
        const extremePoints = this.extractExtremePoints(points);
        extremePoints.forEach(point => {
            if (!this.isPointNearKeypoints(point, keypoints, 30)) {
                keypoints.push(point);
            }
        });
       
        // Ограничиваем количество ключевых точек
        return keypoints.slice(0, this.config.maxPoints / 2);
    }

    // Кластеризация точек
    clusterPoints(points, radius) {
        const clusters = [];
        const visited = new Set();
       
        points.forEach((point, index) => {
            if (visited.has(index)) return;
           
            const cluster = {
                points: [point],
                center: { x: point.x, y: point.y },
                indices: [index]
            };
           
            visited.add(index);
           
            // Находим все точки в радиусе
            for (let j = index + 1; j < points.length; j++) {
                if (visited.has(j)) continue;
               
                const distance = this.calculateDistance(point, points[j]);
                if (distance < radius) {
                    cluster.points.push(points[j]);
                    cluster.indices.push(j);
                    visited.add(j);
                   
                    // Обновляем центр кластера
                    cluster.center.x = (cluster.center.x * (cluster.points.length - 1) + points[j].x) / cluster.points.length;
                    cluster.center.y = (cluster.center.y * (cluster.points.length - 1) + points[j].y) / cluster.points.length;
                }
            }
           
            clusters.push(cluster);
        });
       
        return clusters;
    }

    // Выбрать лучшую точку в кластере
    selectBestPointInCluster(cluster) {
        if (cluster.points.length === 1) return cluster.points[0];
       
        // Выбираем точку с наибольшей уверенностью
        let bestPoint = cluster.points[0];
        let maxConfidence = bestPoint.confidence || 0;
       
        cluster.points.forEach(point => {
            const confidence = point.confidence || 0;
            if (confidence > maxConfidence) {
                maxConfidence = confidence;
                bestPoint = point;
            }
        });
       
        // Если уверенности одинаковые, выбираем ближайшую к центру
        if (maxConfidence === 0) {
            let minDistance = Infinity;
            cluster.points.forEach(point => {
                const distance = this.calculateDistance(point, cluster.center);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestPoint = point;
                }
            });
        }
       
        return {
            ...bestPoint,
            isKeypoint: true,
            clusterSize: cluster.points.length
        };
    }

    // Извлечь крайние точки
    extractExtremePoints(points) {
        if (points.length < 4) return [];
       
        const bounds = this.calculateBounds(points);
        const extremePoints = [];
       
        // Находим точки близкие к границам
        const margin = 10; // px от границы
       
        points.forEach(point => {
            const nearLeft = Math.abs(point.x - bounds.minX) < margin;
            const nearRight = Math.abs(point.x - bounds.maxX) < margin;
            const nearTop = Math.abs(point.y - bounds.minY) < margin;
            const nearBottom = Math.abs(point.y - bounds.maxY) < margin;
           
            if (nearLeft || nearRight || nearTop || nearBottom) {
                extremePoints.push({
                    ...point,
                    isExtreme: true,
                    position: {
                        nearLeft, nearRight, nearTop, nearBottom
                    }
                });
            }
        });
       
        return extremePoints;
    }

    // Сопоставление характерных точек
    matchKeypoints(keypoints1, keypoints2) {
        const matches = [];
       
        // Для каждой ключевой точки в первом наборе ищем ближайшую во втором
        keypoints1.forEach(kp1 => {
            let bestMatch = null;
            let minDistance = Infinity;
           
            keypoints2.forEach(kp2 => {
                const distance = this.calculateDistance(kp1, kp2);
               
                // Учитываем дополнительную информацию (кластеры, крайние точки)
                let distanceScore = distance;
               
                // Если оба ключевые точки, уменьшаем штраф
                if (kp1.isKeypoint && kp2.isKeypoint) {
                    distanceScore *= 0.8;
                }
               
                // Если оба крайние точки в схожих позициях
                if (kp1.isExtreme && kp2.isExtreme) {
                    const similarPosition = this.areExtremePositionsSimilar(kp1.position, kp2.position);
                    if (similarPosition) {
                        distanceScore *= 0.7;
                    }
                }
               
                if (distanceScore < minDistance) {
                    minDistance = distanceScore;
                    bestMatch = {
                        point1: kp1,
                        point2: kp2,
                        distance: distance,
                        score: 1 - (distanceScore / 100) // Нормализованная оценка
                    };
                }
            });
           
            if (bestMatch && bestMatch.distance < this.config.matchThreshold * 2) {
                matches.push(bestMatch);
            }
        });
       
        // Фильтруем дубликаты (если одна точка соответствует нескольким)
        return this.filterDuplicateMatches(matches);
    }

    // Оценка трансформации с помощью RANSAC
    estimateTransformWithRANSAC(matches) {
        console.log(`🔧 RANSAC: ${matches.length} сопоставлений, ${this.config.ransacIterations} итераций`);
       
        let bestTransform = null;
        let bestInliers = [];
        let bestError = Infinity;
       
        for (let i = 0; i < this.config.ransacIterations; i++) {
            // 1. Выбираем случайную выборку
            const sample = this.getRandomSample(matches, this.config.minPointsForRANSAC);
           
            // 2. Оцениваем трансформацию по выборке
            const transform = this.estimateTransformFromMatches(sample);
           
            if (!transform) continue;
           
            // 3. Находим инлайеры (точки, которые хорошо соответствуют трансформации)
            const { inliers, error } = this.findInliers(matches, transform, this.config.matchThreshold);
           
            // 4. Обновляем лучшую трансформацию
            if (inliers.length > bestInliers.length ||
                (inliers.length === bestInliers.length && error < bestError)) {
                bestInliers = inliers;
                bestError = error;
                bestTransform = transform;
            }
           
            // Ранняя остановка если нашли хорошую трансформацию
            if (inliers.length >= matches.length * 0.7) {
                console.log(`   Ранняя остановка на итерации ${i}: ${inliers.length} инлайеров`);
                break;
            }
        }
       
        if (bestTransform && bestInliers.length >= this.config.minPointsForRANSAC) {
            console.log(`   Лучшая трансформация: ${bestInliers.length} инлайеров, ошибка: ${bestError.toFixed(2)}`);
           
            // Переоцениваем трансформацию по всем инлайерам
            const refinedTransform = this.estimateTransformFromMatches(bestInliers);
            return refinedTransform || bestTransform;
        }
       
        return null;
    }

    // Оценить трансформацию по сопоставлениям
    estimateTransformFromMatches(matches) {
        if (matches.length < 2) return null;
       
        // Для простоты оцениваем только сдвиг и поворот
        // В реальной реализации здесь может быть оценка аффинной или проективной трансформации
       
        // 1. Оцениваем поворот
        const rotation = this.estimateRotation(matches);
       
        // 2. Оцениваем сдвиг
        const translation = this.estimateTranslation(matches, rotation);
       
        // 3. Оцениваем масштаб
        const scale = this.estimateScale(matches, rotation, translation);
       
        return {
            rotation: rotation,
            translation: translation,
            scale: scale,
            center: this.calculateCenter(matches.map(m => m.point2))
        };
    }

    // Оценить поворот
    estimateRotation(matches) {
        if (matches.length < 2) return 0;
       
        let totalRotation = 0;
        let weightSum = 0;
       
        // Используем пары точек для оценки поворота
        for (let i = 0; i < matches.length; i++) {
            for (let j = i + 1; j < matches.length; j++) {
                const m1 = matches[i];
                const m2 = matches[j];
               
                // Вектор между точками в первом наборе
                const dx1 = m1.point1.x - m2.point1.x;
                const dy1 = m1.point1.y - m2.point1.y;
               
                // Вектор между точками во втором наборе
                const dx2 = m1.point2.x - m2.point2.x;
                const dy2 = m1.point2.y - m2.point2.y;
               
                // Углы векторов
                const angle1 = Math.atan2(dy1, dx1);
                const angle2 = Math.atan2(dy2, dx2);
               
                // Разница углов
                let angleDiff = angle2 - angle1;
               
                // Нормализуем к [-π, π]
                while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
                while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
               
                // Вес на основе расстояния между точками (более длинные векторы дают более точную оценку)
                const weight = Math.sqrt(dx1*dx1 + dy1*dy1);
               
                totalRotation += angleDiff * weight;
                weightSum += weight;
            }
        }
       
        if (weightSum === 0) return 0;
       
        const avgRotation = totalRotation / weightSum;
        return avgRotation * 180 / Math.PI; // Конвертируем в градусы
    }

    // Оценить сдвиг
    estimateTranslation(matches, rotation) {
        if (matches.length === 0) return { x: 0, y: 0 };
       
        // Поворачиваем точки второго набора обратно
        const cosA = Math.cos(-rotation * Math.PI / 180);
        const sinA = Math.sin(-rotation * Math.PI / 180);
       
        let totalDx = 0;
        let totalDy = 0;
       
        matches.forEach(match => {
            // Поворачиваем точку2 обратно
            const rotatedX = match.point2.x * cosA - match.point2.y * sinA;
            const rotatedY = match.point2.x * sinA + match.point2.y * cosA;
           
            // Разница с точкой1
            totalDx += match.point1.x - rotatedX;
            totalDy += match.point1.y - rotatedY;
        });
       
        return {
            x: totalDx / matches.length,
            y: totalDy / matches.length
        };
    }

    // Оценить масштаб
    estimateScale(matches, rotation, translation) {
        if (matches.length < 2) return 1;
       
        let totalScale = 0;
        let count = 0;
       
        // Поворачиваем и сдвигаем точки второго набора
        const cosA = Math.cos(-rotation * Math.PI / 180);
        const sinA = Math.sin(-rotation * Math.PI / 180);
       
        for (let i = 0; i < matches.length; i++) {
            for (let j = i + 1; j < matches.length; j++) {
                const m1 = matches[i];
                const m2 = matches[j];
               
                // Расстояние между точками в первом наборе
                const dx1 = m1.point1.x - m2.point1.x;
                const dy1 = m1.point1.y - m2.point1.y;
                const dist1 = Math.sqrt(dx1*dx1 + dy1*dy1);
               
                if (dist1 < 10) continue; // Пропускаем слишком близкие точки
               
                // Преобразуем точки второго набора
                const transformPoint = (p) => {
                    // Поворот
                    let x = p.x * cosA - p.y * sinA;
                    let y = p.x * sinA + p.y * cosA;
                   
                    // Сдвиг
                    x += translation.x;
                    y += translation.y;
                   
                    return { x, y };
                };
               
                const t1 = transformPoint(m1.point2);
                const t2 = transformPoint(m2.point2);
               
                // Расстояние между преобразованными точками
                const dx2 = t1.x - t2.x;
                const dy2 = t1.y - t2.y;
                const dist2 = Math.sqrt(dx2*dx2 + dy2*dy2);
               
                if (dist2 > 0) {
                    totalScale += dist1 / dist2;
                    count++;
                }
            }
        }
       
        if (count === 0) return 1;
       
        return totalScale / count;
    }

    // Найти инлайеры
    findInliers(matches, transform, threshold) {
        const inliers = [];
        let totalError = 0;
       
        matches.forEach(match => {
            // Применяем трансформацию к point2
            const transformed = this.applyTransformToPoint(match.point2, transform);
           
            // Расстояние до point1
            const error = this.calculateDistance(transformed, match.point1);
           
            if (error < threshold) {
                inliers.push({
                    ...match,
                    error: error
                });
                totalError += error;
            }
        });
       
        return {
            inliers: inliers,
            error: inliers.length > 0 ? totalError / inliers.length : Infinity
        };
    }

    // Применить трансформацию к точке
    applyTransformToPoint(point, transform) {
        let x = point.x;
        let y = point.y;
       
        // Если есть центр, смещаем к центру
        if (transform.center) {
            x -= transform.center.x;
            y -= transform.center.y;
        }
       
        // Масштаб
        x *= transform.scale || 1;
        y *= transform.scale || 1;
       
        // Поворот
        if (transform.rotation) {
            const angleRad = transform.rotation * Math.PI / 180;
            const cosA = Math.cos(angleRad);
            const sinA = Math.sin(angleRad);
           
            const rotatedX = x * cosA - y * sinA;
            const rotatedY = x * sinA + y * cosA;
           
            x = rotatedX;
            y = rotatedY;
        }
       
        // Сдвиг
        if (transform.translation) {
            x += transform.translation.x;
            y += transform.translation.y;
        }
       
        // Если был центр, возвращаем обратно
        if (transform.center) {
            x += transform.center.x;
            y += transform.center.y;
        }
       
        return {
            x: x,
            y: y,
            original: point,
            transformed: true
        };
    }

    // Применить трансформацию ко всем точкам
    applyTransform(points, transform) {
        return points.map(point => this.applyTransformToPoint(point, transform));
    }

    // Расчет качества выравнивания
    calculateAlignmentQuality(points1, alignedPoints2) {
        if (points1.length === 0 || alignedPoints2.length === 0) return 0;
       
        let totalError = 0;
        let matchedPoints = 0;
       
        // Для каждой точки в alignedPoints2 находим ближайшую в points1
        alignedPoints2.forEach(point2 => {
            let minDistance = Infinity;
           
            points1.forEach(point1 => {
                const distance = this.calculateDistance(point2, point1);
                if (distance < minDistance) {
                    minDistance = distance;
                }
            });
           
            if (minDistance < this.config.matchThreshold * 2) {
                totalError += minDistance;
                matchedPoints++;
            }
        });
       
        if (matchedPoints === 0) return 0;
       
        const avgError = totalError / matchedPoints;
        const matchRate = matchedPoints / Math.max(points1.length, alignedPoints2.length);
       
        // Качество = комбинация низкой ошибки и высокой степени соответствия
        const errorScore = Math.max(0, 1 - avgError / this.config.matchThreshold);
        const quality = (errorScore * 0.7 + matchRate * 0.3);
       
        return Math.min(1, quality);
    }

    // Простой расчет качества
    calculateSimpleAlignmentQuality(points1, alignedPoints2) {
        const quality = this.calculateAlignmentQuality(points1, alignedPoints2);
       
        // Дополнительная проверка: считаем сколько точек хорошо совпало
        let goodMatches = 0;
        const goodThreshold = this.config.matchThreshold;
       
        alignedPoints2.forEach(point2 => {
            let minDistance = Infinity;
           
            points1.forEach(point1 => {
                const distance = this.calculateDistance(point2, point1);
                if (distance < minDistance) minDistance = distance;
            });
           
            if (minDistance < goodThreshold) goodMatches++;
        });
       
        const goodMatchRate = goodMatches / Math.max(points1.length, alignedPoints2.length);
       
        // Комбинируем с исходным качеством
        return (quality * 0.6 + goodMatchRate * 0.4);
    }

    // Вспомогательные методы
    calculateDistance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }
   
    calculateCenter(points) {
        if (points.length === 0) return { x: 0, y: 0 };
       
        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);
       
        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }
   
    calculateBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
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
   
    getRandomSample(array, size) {
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, size);
    }
   
    isPointNearKeypoints(point, keypoints, threshold) {
        for (const kp of keypoints) {
            if (this.calculateDistance(point, kp) < threshold) {
                return true;
            }
        }
        return false;
    }
   
    areExtremePositionsSimilar(pos1, pos2) {
        if (!pos1 || !pos2) return false;
       
        // Считаем похожими если обе точки находятся на схожих границах
        return (pos1.nearLeft && pos2.nearLeft) ||
               (pos1.nearRight && pos2.nearRight) ||
               (pos1.nearTop && pos2.nearTop) ||
               (pos1.nearBottom && pos2.nearBottom);
    }
   
    filterDuplicateMatches(matches) {
        const filtered = [];
        const usedPoints1 = new Set();
        const usedPoints2 = new Set();
       
        // Сортируем по качеству совпадения
        matches.sort((a, b) => b.score - a.score);
       
        matches.forEach(match => {
            const point1Id = match.point1.id;
            const point2Id = match.point2.id;
           
            if (!usedPoints1.has(point1Id) && !usedPoints2.has(point2Id)) {
                filtered.push(match);
                usedPoints1.add(point1Id);
                usedPoints2.add(point2Id);
            }
        });
       
        return filtered;
    }
}

module.exports = ImprovedAligner;
