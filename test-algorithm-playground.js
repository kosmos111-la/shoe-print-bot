// test-algorithm-playground.js
console.log('🎯 ТЕСТОВЫЙ ПОЛИГОН ДЛЯ АЛГОРИТМОВ СРАВНЕНИЯ\n');

// 🔧 БАЗОВЫЕ ФУНКЦИИ ДЛЯ СОЗДАНИЯ ТЕСТОВЫХ ДАННЫХ
class TestDataGenerator {
    // 1. Создаём реалистичные фигуры
    static createRealisticShape(shapeType, options = {}) {
        const {
            centerX = 400,
            centerY = 300,
            scale = 1.0,
            pointDensity = 'normal',
            noise = 0,
            rotation = 0
        } = options;

        let points = [];

        switch (shapeType) {
            case 'eight':
                points = this.createFigureEight(centerX, centerY, scale, pointDensity);
                break;
            case 'six':
                points = this.createFigureSix(centerX, centerY, scale, pointDensity);
                break;
            case 'ellipse':
                points = this.createEllipse(centerX, centerY, scale, pointDensity);
                break;
            case 'shoe_print':
                points = this.createShoePrint(centerX, centerY, scale, pointDensity);
                break;
            default:
                points = this.createRandomPoints(centerX, centerY, scale, 30);
        }

        // Добавляем шум
        if (noise > 0) {
            points = this.addNoise(points, noise);
        }

        // Применяем поворот
        if (rotation !== 0) {
            points = this.rotatePoints(points, rotation, centerX, centerY);
        }

        return points;
    }

    // 1.1 Фигура восьмёрка
    static createFigureEight(centerX, centerY, scale, density) {
        const points = [];
        const a = 100 * scale;
        const b = 60 * scale;
       
        const step = density === 'high' ? 0.15 : density === 'low' ? 0.4 : 0.2;
       
        for (let t = 0; t < 2 * Math.PI; t += step) {
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(2 * t);
            points.push({ x: Math.round(x), y: Math.round(y), id: `p8_${t.toFixed(2)}` });
        }
       
        return points;
    }

    // 1.2 Фигура шестёрка (меньше деталей)
    static createFigureSix(centerX, centerY, scale, density) {
        const points = [];
        const a = 100 * scale;
        const b = 60 * scale;
       
        const step = density === 'high' ? 0.25 : density === 'low' ? 0.6 : 0.3;
       
        for (let t = 0; t < 2 * Math.PI; t += step) {
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(2 * t) * 0.8; // Немного другая форма
            points.push({ x: Math.round(x), y: Math.round(y), id: `p6_${t.toFixed(2)}` });
        }
       
        return points;
    }

    // 1.3 Эллипс (похож, но другой)
    static createEllipse(centerX, centerY, scale, density) {
        const points = [];
        const a = 100 * scale;
        const b = 70 * scale;
       
        const step = density === 'high' ? 0.15 : density === 'low' ? 0.4 : 0.2;
       
        for (let t = 0; t < 2 * Math.PI; t += step) {
            const x = centerX + a * Math.cos(t);
            const y = centerY + b * Math.sin(t);
            points.push({ x: Math.round(x), y: Math.round(y), id: `pe_${t.toFixed(2)}` });
        }
       
        return points;
    }

    // 1.4 След обуви (реалистичный)
    static createShoePrint(centerX, centerY, scale, density) {
        const points = [];
        const length = 250 * scale;
        const width = 100 * scale;
       
        const pointCount = density === 'high' ? 24 : density === 'low' ? 12 : 18;
       
        // Контур
        for (let i = 0; i < pointCount; i++) {
            const angle = (i / pointCount) * 2 * Math.PI;
            const x = centerX + Math.cos(angle) * width / 2;
            const y = centerY + Math.sin(angle) * length / 2 * (1 - 0.3 * Math.cos(angle));
            points.push({ x: Math.round(x), y: Math.round(y), id: `ps_${i}`, type: 'contour' });
        }
       
        // Внутренние точки (протектор)
        if (density !== 'low') {
            const innerCount = density === 'high' ? 15 : 8;
            for (let i = 0; i < innerCount; i++) {
                const x = centerX + (Math.random() - 0.5) * width * 0.4;
                const y = centerY + (Math.random() - 0.5) * length * 0.4;
                points.push({ x: Math.round(x), y: Math.round(y), id: `ps_inner_${i}`, type: 'tread' });
            }
        }
       
        return points;
    }

    // 1.5 Случайные точки
    static createRandomPoints(centerX, centerY, scale, count) {
        const points = [];
        const radius = 100 * scale;
       
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const r = Math.random() * radius;
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);
            points.push({ x: Math.round(x), y: Math.round(y), id: `pr_${i}` });
        }
       
        return points;
    }

    // 2. Трансформации
    static transformPoints(points, options = {}) {
        const {
            angle = 0,
            scale = 1.0,
            offsetX = 0,
            offsetY = 0,
            noise = 0
        } = options;

        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        // Находим центр для поворота вокруг центра
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        return points.map(point => {
            // Смещаем в центр
            let x = point.x - centerX;
            let y = point.y - centerY;

            // Поворот
            const rotatedX = x * cosA - y * sinA;
            const rotatedY = x * sinA + y * cosA;

            // Масштаб
            x = rotatedX * scale;
            y = rotatedY * scale;

            // Возвращаем на место + смещение
            x += centerX + offsetX;
            y += centerY + offsetY;

            // Добавляем шум
            if (noise > 0) {
                x += (Math.random() - 0.5) * 2 * noise;
                y += (Math.random() - 0.5) * 2 * noise;
            }

            return {
                ...point,
                x: Math.round(x),
                y: Math.round(y),
                originalId: point.id,
                id: `${point.id}_t${angle}_s${scale}`
            };
        });
    }

    // 3. Вспомогательные функции
    static addNoise(points, maxNoise) {
        return points.map(point => ({
            ...point,
            x: point.x + (Math.random() - 0.5) * 2 * maxNoise,
            y: point.y + (Math.random() - 0.5) * 2 * maxNoise,
            id: `${point.id}_n${maxNoise}`
        }));
    }

    static rotatePoints(points, angleDeg, centerX, centerY) {
        const angleRad = angleDeg * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        return points.map(point => {
            const x = point.x - centerX;
            const y = point.y - centerY;
           
            const rotatedX = x * cosA - y * sinA;
            const rotatedY = x * sinA + y * cosA;
           
            return {
                ...point,
                x: Math.round(rotatedX + centerX),
                y: Math.round(rotatedY + centerY)
            };
        });
    }

    // 4. Статистика набора точек
    static getPointStats(points) {
        if (points.length === 0) return null;
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        return {
            count: points.length,
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
            centerY: (Math.min(...ys) + Math.max(...ys)) / 2,
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }
}

// 🔍 АЛГОРИТМЫ СРАВНЕНИЯ
class ComparisonAlgorithms {
    constructor() {
        this.debug = false;
    }

    // 🎯 АЛГОРИТМ 1: Простой поиск ближайших соседей
    simpleNearestNeighbor(points1, points2, threshold = 25) {
        console.log('🧠 АЛГОРИТМ 1: Простой поиск ближайших соседей');
       
        const matches = [];
        const used1 = new Set();
        const used2 = new Set();
       
        // Для каждой точки из points1 ищем ближайшую в points2
        for (let i = 0; i < points1.length; i++) {
            let bestMatch = null;
            let minDistance = Infinity;
            let bestJ = -1;
           
            for (let j = 0; j < points2.length; j++) {
                if (used2.has(j)) continue;
               
                const dx = points1[i].x - points2[j].x;
                const dy = points1[i].y - points2[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < minDistance && distance < threshold) {
                    minDistance = distance;
                    bestMatch = { point1: points1[i], point2: points2[j], distance };
                    bestJ = j;
                }
            }
           
            if (bestMatch && !used1.has(i)) {
                matches.push(bestMatch);
                used1.add(i);
                used2.add(bestJ);
            }
        }
       
        return matches;
    }

    // 🎯 АЛГОРИТМ 2: Взаимный поиск ближайших соседей (один-к-одному)
    mutualNearestNeighbor(points1, points2, threshold = 25) {
        console.log('🧠 АЛГОРИТМ 2: Взаимный поиск ближайших соседей');
       
        const allPairs = [];
       
        // Создаем все возможные пары
        for (let i = 0; i < points1.length; i++) {
            for (let j = 0; j < points2.length; j++) {
                const dx = points1[i].x - points2[j].x;
                const dy = points1[i].y - points2[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < threshold) {
                    allPairs.push({
                        i, j, distance,
                        point1: points1[i],
                        point2: points2[j]
                    });
                }
            }
        }
       
        // Сортируем по расстоянию
        allPairs.sort((a, b) => a.distance - b.distance);
       
        const matches = [];
        const used1 = new Set();
        const used2 = new Set();
       
        // Выбираем лучшие пары
        for (const pair of allPairs) {
            if (!used1.has(pair.i) && !used2.has(pair.j)) {
                matches.push({
                    point1: pair.point1,
                    point2: pair.point2,
                    distance: pair.distance
                });
                used1.add(pair.i);
                used2.add(pair.j);
            }
        }
       
        return matches;
    }

    // 🎯 АЛГОРИТМ 3: Сравнение с нормализацией и выравниванием
    normalizedAlignment(points1, points2, threshold = 0.15) {
        console.log('🧠 АЛГОРИТМ 3: Сравнение с нормализацией и выравниванием');
       
        // 1. Нормализация
        const norm1 = this.normalizePoints(points1);
        const norm2 = this.normalizePoints(points2);
       
        // 2. Выравнивание по главной оси
        const aligned1 = this.alignToPrincipalAxis(norm1);
        const aligned2 = this.alignToPrincipalAxis(norm2);
       
        // 3. Поиск совпадений
        return this.mutualNearestNeighbor(aligned1, aligned2, threshold);
    }

    // 🎯 АЛГОРИТМ 4: RANSAC-подобный алгоритм
    ransacLikeComparison(points1, points2, iterations = 100, inlierThreshold = 20) {
        console.log('🧠 АЛГОРИТМ 4: RANSAC-подобный алгоритм');
       
        if (points1.length < 3 || points2.length < 3) {
            return this.mutualNearestNeighbor(points1, points2, inlierThreshold);
        }
       
        let bestMatches = [];
        let bestInliers = 0;
       
        for (let iter = 0; iter < iterations; iter++) {
            // Выбираем случайные 3 точки из каждого набора
            const indices1 = this.getRandomIndices(points1.length, 3);
            const indices2 = this.getRandomIndices(points2.length, 3);
           
            // Рассчитываем предполагаемое преобразование
            const transform = this.estimateTransform(
                indices1.map(i => points1[i]),
                indices2.map(i => points2[i])
            );
           
            if (!transform) continue;
           
            // Применяем преобразование ко всем точкам points1
            const transformed1 = this.applyTransform(points1, transform);
           
            // Ищем инлайеры (точки, которые совпадают после преобразования)
            const matches = this.findInliers(transformed1, points2, inlierThreshold);
           
            if (matches.length > bestInliers) {
                bestInliers = matches.length;
                bestMatches = matches;
               
                if (this.debug) {
                    console.log(`   Итерация ${iter}: найдено ${matches.length} инлайеров`);
                }
            }
        }
       
        return bestMatches;
    }

    // 🎯 АЛГОРИТМ 5: Иерархический кластерный анализ
    hierarchicalClusterComparison(points1, points2, clusterThreshold = 30, pointThreshold = 15) {
        console.log('🧠 АЛГОРИТМ 5: Иерархический кластерный анализ');
       
        // 1. Создаем кластеры для каждого набора
        const clusters1 = this.createClusters(points1, clusterThreshold);
        const clusters2 = this.createClusters(points2, clusterThreshold);
       
        // 2. Сопоставляем кластеры
        const clusterMatches = [];
       
        for (const cluster1 of clusters1) {
            let bestCluster = null;
            let bestScore = 0;
           
            for (const cluster2 of clusters2) {
                const score = this.compareClusters(cluster1, cluster2);
                if (score > bestScore) {
                    bestScore = score;
                    bestCluster = cluster2;
                }
            }
           
            if (bestCluster && bestScore > 0.5) {
                clusterMatches.push({ cluster1, cluster2: bestCluster, score: bestScore });
            }
        }
       
        // 3. Внутри совпавших кластеров ищем совпадения точек
        const pointMatches = [];
       
        for (const match of clusterMatches) {
            const matches = this.mutualNearestNeighbor(
                match.cluster1.points,
                match.cluster2.points,
                pointThreshold
            );
            pointMatches.push(...matches);
        }
       
        return pointMatches;
    }

    // 🎯 АЛГОРИТМ 6: Гибридный алгоритм (комбинация лучших)
    hybridAlgorithm(points1, points2) {
        console.log('🧠 АЛГОРИТМ 6: Гибридный алгоритм');
       
        // 1. Сначала нормализуем и выравниваем
        const norm1 = this.normalizePoints(points1);
        const norm2 = this.normalizePoints(points2);
        const aligned1 = this.alignToPrincipalAxis(norm1);
        const aligned2 = this.alignToPrincipalAxis(norm2);
       
        // 2. Применяем RANSAC для грубого выравнивания
        const ransacMatches = this.ransacLikeComparison(aligned1, aligned2, 50, 0.1);
       
        if (ransacMatches.length < 3) {
            // Если RANSAC не нашел достаточно совпадений, используем простой алгоритм
            return this.mutualNearestNeighbor(aligned1, aligned2, 0.15);
        }
       
        // 3. Оцениваем преобразование на основе RANSAC совпадений
        const transform = this.estimateTransformFromMatches(ransacMatches);
       
        if (!transform) {
            return ransacMatches;
        }
       
        // 4. Применяем преобразование и ищем точные совпадения
        const transformed1 = this.applyTransform(aligned1, transform);
        const finalMatches = this.mutualNearestNeighbor(transformed1, aligned2, 0.08);
       
        return finalMatches;
    }

    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ АЛГОРИТМОВ
    normalizePoints(points) {
        if (points.length === 0) return points;
       
        // Центрирование
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        const centered = points.map(p => ({
            ...p,
            x: p.x - centerX,
            y: p.y - centerY
        }));
       
        // Масштабирование к единичному размеру
        const maxDistance = Math.max(
            ...centered.map(p => Math.sqrt(p.x * p.x + p.y * p.y))
        );
       
        if (maxDistance === 0) return centered;
       
        const scale = 1.0 / maxDistance;
        return centered.map(p => ({
            ...p,
            x: p.x * scale,
            y: p.y * scale
        }));
    }

    alignToPrincipalAxis(points) {
        if (points.length < 2) return points;
       
        // Вычисляем главную ось с помощью PCA
        let sumXX = 0, sumYY = 0, sumXY = 0;
       
        for (const p of points) {
            sumXX += p.x * p.x;
            sumYY += p.y * p.y;
            sumXY += p.x * p.y;
        }
       
        const n = points.length;
        const covariance = [
            [sumXX / n, sumXY / n],
            [sumXY / n, sumYY / n]
        ];
       
        // Собственные значения и векторы (упрощенно)
        const trace = covariance[0][0] + covariance[1][1];
        const determinant = covariance[0][0] * covariance[1][1] - covariance[0][1] * covariance[1][0];
       
        const eigenvalue1 = trace / 2 + Math.sqrt(Math.pow(trace / 2, 2) - determinant);
        const eigenvalue2 = trace / 2 - Math.sqrt(Math.pow(trace / 2, 2) - determinant);
       
        // Главный собственный вектор
        let principalAngle;
        if (Math.abs(covariance[0][1]) > 0.0001) {
            principalAngle = 0.5 * Math.atan2(
                2 * covariance[0][1],
                covariance[0][0] - covariance[1][1]
            );
        } else {
            principalAngle = eigenvalue1 > eigenvalue2 ? 0 : Math.PI / 2;
        }
       
        // Поворачиваем точки на -principalAngle
        const angleDeg = -principalAngle * 180 / Math.PI;
        return this.rotatePointsNormalized(points, angleDeg);
    }

    rotatePointsNormalized(points, angleDeg) {
        const angleRad = angleDeg * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        return points.map(p => ({
            ...p,
            x: p.x * cosA - p.y * sinA,
            y: p.x * sinA + p.y * cosA
        }));
    }

    getRandomIndices(max, count) {
        const indices = new Set();
        while (indices.size < count && indices.size < max) {
            indices.add(Math.floor(Math.random() * max));
        }
        return Array.from(indices);
    }

    estimateTransform(points1, points2) {
        if (points1.length !== points2.length || points1.length < 3) {
            return null;
        }
       
        // Простая оценка сдвига и масштаба (без поворота)
        const center1 = {
            x: points1.reduce((sum, p) => sum + p.x, 0) / points1.length,
            y: points1.reduce((sum, p) => sum + p.y, 0) / points1.length
        };
       
        const center2 = {
            x: points2.reduce((sum, p) => sum + p.x, 0) / points2.length,
            y: points2.reduce((sum, p) => sum + p.y, 0) / points2.length
        };
       
        // Среднее расстояние от центров
        const distances1 = points1.map(p =>
            Math.sqrt(Math.pow(p.x - center1.x, 2) + Math.pow(p.y - center1.y, 2))
        );
       
        const distances2 = points2.map(p =>
            Math.sqrt(Math.pow(p.x - center2.x, 2) + Math.pow(p.y - center2.y, 2))
        );
       
        const avgDist1 = distances1.reduce((sum, d) => sum + d, 0) / distances1.length;
        const avgDist2 = distances2.reduce((sum, d) => sum + d, 0) / distances2.length;
       
        const scale = avgDist2 / (avgDist1 || 1);
       
        return {
            dx: center2.x - center1.x * scale,
            dy: center2.y - center1.y * scale,
            scale: scale,
            angle: 0 // Упрощенно, без поворота
        };
    }

    applyTransform(points, transform) {
        return points.map(p => ({
            ...p,
            x: p.x * transform.scale + transform.dx,
            y: p.y * transform.scale + transform.dy
        }));
    }

    findInliers(points1, points2, threshold) {
        const matches = [];
        const used2 = new Set();
       
        for (let i = 0; i < points1.length; i++) {
            let bestMatch = null;
            let minDistance = Infinity;
            let bestJ = -1;
           
            for (let j = 0; j < points2.length; j++) {
                if (used2.has(j)) continue;
               
                const dx = points1[i].x - points2[j].x;
                const dy = points1[i].y - points2[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = { point1: points1[i], point2: points2[j], distance };
                    bestJ = j;
                }
            }
           
            if (bestMatch && minDistance < threshold) {
                matches.push(bestMatch);
                used2.add(bestJ);
            }
        }
       
        return matches;
    }

    createClusters(points, threshold) {
        if (points.length === 0) return [];
       
        const clusters = [];
        const visited = new Set();
       
        for (let i = 0; i < points.length; i++) {
            if (visited.has(i)) continue;
           
            const cluster = {
                points: [points[i]],
                center: { x: points[i].x, y: points[i].y }
            };
           
            visited.add(i);
           
            // Ищем соседей
            for (let j = i + 1; j < points.length; j++) {
                if (visited.has(j)) continue;
               
                const dx = points[i].x - points[j].x;
                const dy = points[i].y - points[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < threshold) {
                    cluster.points.push(points[j]);
                    visited.add(j);
                }
            }
           
            // Обновляем центр кластера
            if (cluster.points.length > 0) {
                cluster.center = {
                    x: cluster.points.reduce((sum, p) => sum + p.x, 0) / cluster.points.length,
                    y: cluster.points.reduce((sum, p) => sum + p.y, 0) / cluster.points.length
                };
                clusters.push(cluster);
            }
        }
       
        return clusters;
    }

    compareClusters(cluster1, cluster2) {
        // Расстояние между центрами
        const dx = cluster1.center.x - cluster2.center.x;
        const dy = cluster1.center.y - cluster2.center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
       
        // Сходство размеров
        const size1 = cluster1.points.length;
        const size2 = cluster2.points.length;
        const sizeRatio = Math.min(size1, size2) / Math.max(size1, size2);
       
        // Общая оценка сходства
        const distanceScore = Math.max(0, 1 - distance / 100);
        return (distanceScore + sizeRatio) / 2;
    }

    estimateTransformFromMatches(matches) {
        if (matches.length < 3) return null;
       
        // Простая оценка: средний сдвиг и масштаб
        const dxValues = matches.map(m => m.point2.x - m.point1.x);
        const dyValues = matches.map(m => m.point2.y - m.point1.y);
       
        const avgDx = dxValues.reduce((sum, d) => sum + d, 0) / dxValues.length;
        const avgDy = dyValues.reduce((sum, d) => sum + d, 0) / dyValues.length;
       
        // Оценка масштаба (упрощенно)
        const distances1 = matches.map(m =>
            Math.sqrt(Math.pow(m.point1.x, 2) + Math.pow(m.point1.y, 2))
        );
       
        const distances2 = matches.map(m =>
            Math.sqrt(Math.pow(m.point2.x, 2) + Math.pow(m.point2.y, 2))
        );
       
        const scaleValues = distances2.map((d2, i) => d2 / (distances1[i] || 1));
        const avgScale = scaleValues.reduce((sum, s) => sum + s, 0) / scaleValues.length;
       
        return {
            dx: avgDx,
            dy: avgDy,
            scale: avgScale,
            angle: 0
        };
    }
}

// 📊 АНАЛИЗАТОР РЕЗУЛЬТАТОВ
class ResultAnalyzer {
    constructor() {
        this.algorithms = new ComparisonAlgorithms();
    }

    // Запуск одного теста
    runSingleTest(points1, points2, testName, algorithmType = 'hybrid') {
        console.log(`\n🧪 ТЕСТ: ${testName}`);
        console.log(`   Форма 1: ${points1.length} точек, Форма 2: ${points2.length} точек`);
       
        let matches;
       
        // Выбираем алгоритм
        switch (algorithmType) {
            case 'simple':
                matches = this.algorithms.simpleNearestNeighbor(points1, points2);
                break;
            case 'mutual':
                matches = this.algorithms.mutualNearestNeighbor(points1, points2);
                break;
            case 'normalized':
                matches = this.algorithms.normalizedAlignment(points1, points2);
                break;
            case 'ransac':
                matches = this.algorithms.ransacLikeComparison(points1, points2);
                break;
            case 'cluster':
                matches = this.algorithms.hierarchicalClusterComparison(points1, points2);
                break;
            case 'hybrid':
            default:
                matches = this.algorithms.hybridAlgorithm(points1, points2);
                break;
        }
       
        // Анализ результатов
        const stats = this.analyzeMatches(points1, points2, matches);
       
        // Визуализация
        this.visualizeComparison(points1, points2, matches);
       
        return { matches, stats, algorithm: algorithmType };
    }

    // Анализ совпадений
    analyzeMatches(points1, points2, matches) {
        const matchedPoints1 = new Set(matches.map(m => m.point1.id));
        const matchedPoints2 = new Set(matches.map(m => m.point2.id));
       
        // Расстояния
        const distances = matches.map(m => m.distance);
        const avgDistance = distances.length > 0
            ? distances.reduce((sum, d) => sum + d, 0) / distances.length
            : 0;
       
        const minDistance = distances.length > 0 ? Math.min(...distances) : 0;
        const maxDistance = distances.length > 0 ? Math.max(...distances) : 0;
       
        return {
            totalPoints1: points1.length,
            totalPoints2: points2.length,
            matches: matches.length,
            matchedPoints1: matchedPoints1.size,
            matchedPoints2: matchedPoints2.size,
            unmatchedPoints1: points1.length - matchedPoints1.size,
            unmatchedPoints2: points2.length - matchedPoints2.size,
            matchPercentage1: ((matchedPoints1.size / points1.length) * 100).toFixed(1),
            matchPercentage2: ((matchedPoints2.size / points2.length) * 100).toFixed(1),
            avgDistance: avgDistance.toFixed(2),
            minDistance: minDistance.toFixed(2),
            maxDistance: maxDistance.toFixed(2)
        };
    }

    // Простая визуализация
    visualizeComparison(points1, points2, matches) {
        const gridSize = 30;
        const grid = Array(gridSize).fill().map(() => Array(gridSize).fill(' '));
       
        // Границы
        const allPoints = [...points1, ...points2];
        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
       
        // Функция преобразования
        const toGrid = (x, y) => ({
            x: Math.floor((x - minX) / (maxX - minX) * (gridSize - 1)),
            y: Math.floor((y - minY) / (maxY - minY) * (gridSize - 1))
        });
       
        // Отмечаем совпадения
        const matchGrid = new Set();
        matches.forEach(match => {
            const pos1 = toGrid(match.point1.x, match.point1.y);
            const pos2 = toGrid(match.point2.x, match.point2.y);
           
            // Средняя позиция для отображения совпадения
            const avgX = Math.floor((pos1.x + pos2.x) / 2);
            const avgY = Math.floor((pos1.y + pos2.y) / 2);
           
            const key = `${avgY},${avgX}`;
            matchGrid.add(key);
           
            if (avgX >= 0 && avgX < gridSize && avgY >= 0 && avgY < gridSize) {
                grid[avgY][avgX] = '●';
            }
        });
       
        // Отмечаем точки формы 1 (не совпавшие)
        points1.forEach(point => {
            const pos = toGrid(point.x, point.y);
            const key = `${pos.y},${pos.x}`;
           
            if (!matchGrid.has(key) && pos.x >= 0 && pos.x < gridSize && pos.y >= 0 && pos.y < gridSize) {
                grid[pos.y][pos.x] = 'O';
            }
        });
       
        // Отмечаем точки формы 2 (не совпавшие)
        points2.forEach(point => {
            const pos = toGrid(point.x, point.y);
            const key = `${pos.y},${pos.x}`;
           
            if (!matchGrid.has(key) && pos.x >= 0 && pos.x < gridSize && pos.y >= 0 && pos.y < gridSize) {
                grid[pos.y][pos.x] = 'X';
            }
        });
       
        // Выводим сетку
        console.log('\n📊 ВИЗУАЛИЗАЦИЯ:');
        console.log('Легенда: ●=совпадение, O=форма1, X=форма2');
        console.log('┌' + '─'.repeat(gridSize) + '┐');
        for (let y = 0; y < gridSize; y++) {
            let row = '│';
            for (let x = 0; x < gridSize; x++) {
                row += grid[y][x];
            }
            row += '│';
            console.log(row);
        }
        console.log('└' + '─'.repeat(gridSize) + '┘');
    }

    // Запуск серии тестов
    runTestSuite() {
        console.log('🚀 ЗАПУСК КОМПЛЕКСНОГО ТЕСТА АЛГОРИТМОВ\n');
       
        const tests = [];
        const results = [];
       
        // 📋 ТЕСТ 1: Один и тот же след (должно быть 85-95%)
        console.log('\n📋 ТЕСТ 1: ОДИН И ТОТ ЖЕ СЛЕД');
        const samePrint = TestDataGenerator.createRealisticShape('shoe_print', {
            pointDensity: 'normal'
        });
        const samePrintCopy = JSON.parse(JSON.stringify(samePrint));
       
        tests.push({
            name: 'Один и тот же след',
            points1: samePrint,
            points2: samePrintCopy,
            expected: { min: 85, max: 95 }
        });
       
        // 📋 ТЕСТ 2: Восьмёрка vs Шестёрка (должно быть 60-80%)
        console.log('\n📋 ТЕСТ 2: ВОСЬМЁРКА vs ШЕСТЁРКА');
        const eight = TestDataGenerator.createRealisticShape('eight', {
            pointDensity: 'normal'
        });
        const six = TestDataGenerator.createRealisticShape('six', {
            pointDensity: 'low'
        });
       
        tests.push({
            name: 'Восьмёрка vs Шестёрка',
            points1: eight,
            points2: six,
            expected: { min: 60, max: 80 }
        });
       
        // 📋 ТЕСТ 3: С поворотом 45°
        console.log('\n📋 ТЕСТ 3: С ПОВОРОТОМ 45°');
        const rotated = TestDataGenerator.transformPoints(eight, { angle: 45 });
       
        tests.push({
            name: 'С поворотом 45°',
            points1: eight,
            points2: rotated,
            expected: { min: 80, max: 95 }
        });
       
        // 📋 ТЕСТ 4: Разный масштаб
        console.log('\n📋 ТЕСТ 4: РАЗНЫЙ МАСШТАБ (0.8x)');
        const scaled = TestDataGenerator.transformPoints(eight, { scale: 0.8 });
       
        tests.push({
            name: 'Разный масштаб (0.8x)',
            points1: eight,
            points2: scaled,
            expected: { min: 80, max: 95 }
        });
       
        // 📋 ТЕСТ 5: С шумом
        console.log('\n📋 ТЕСТ 5: С ШУМОМ (±10px)');
        const noisy = TestDataGenerator.transformPoints(eight, { noise: 10 });
       
        tests.push({
            name: 'С шумом (±10px)',
            points1: eight,
            points2: noisy,
            expected: { min: 70, max: 90 }
        });
       
        // 📋 ТЕСТ 6: Разные фигуры (должно быть 20-40%)
        console.log('\n📋 ТЕСТ 6: РАЗНЫЕ ФИГУРЫ');
        const ellipse = TestDataGenerator.createRealisticShape('ellipse', {
            pointDensity: 'normal'
        });
       
        tests.push({
            name: 'Разные фигуры (восьмёрка vs эллипс)',
            points1: eight,
            points2: ellipse,
            expected: { min: 20, max: 40 }
        });
       
        // 📋 ТЕСТ 7: Комбинированная трансформация
        console.log('\n📋 ТЕСТ 7: КОМБИНИРОВАННАЯ ТРАНСФОРМАЦИЯ');
        const combined = TestDataGenerator.transformPoints(eight, {
            angle: 30,
            scale: 1.2,
            offsetX: 20,
            offsetY: -15,
            noise: 5
        });
       
        tests.push({
            name: 'Комбинированная трансформация',
            points1: eight,
            points2: combined,
            expected: { min: 75, max: 90 }
        });
       
        // 📋 ТЕСТ 8: Сильно разные следы
        console.log('\n📋 ТЕСТ 8: СИЛЬНО РАЗНЫЕ СЛЕДЫ');
        const shoe1 = TestDataGenerator.createRealisticShape('shoe_print', {
            centerX: 400,
            centerY: 300
        });
        const shoe2 = TestDataGenerator.createRealisticShape('shoe_print', {
            centerX: 450,
            centerY: 350,
            scale: 0.7,
            rotation: 90
        });
       
        tests.push({
            name: 'Сильно разные следы',
            points1: shoe1,
            points2: shoe2,
            expected: { min: 30, max: 60 }
        });
       
        // Запускаем все тесты с разными алгоритмами
        const algorithms = ['simple', 'mutual', 'normalized', 'ransac', 'cluster', 'hybrid'];
       
        for (const algorithm of algorithms) {
            console.log(`\n🔬 ТЕСТИРУЕМ АЛГОРИТМ: ${algorithm.toUpperCase()}`);
            console.log('='.repeat(50));
           
            const algorithmResults = [];
           
            for (const test of tests) {
                const result = this.runSingleTest(
                    test.points1,
                    test.points2,
                    test.name,
                    algorithm
                );
               
                const percentage = parseFloat(result.stats.matchPercentage1);
                const isInRange = percentage >= test.expected.min && percentage <= test.expected.max;
               
                algorithmResults.push({
                    test: test.name,
                    percentage,
                    expected: test.expected,
                    inRange: isInRange,
                    matches: result.stats.matches,
                    avgDistance: result.stats.avgDistance
                });
               
                console.log(`   ${isInRange ? '✅' : '❌'} ${test.name}: ${percentage}% (ожидалось ${test.expected.min}-${test.expected.max}%)`);
            }
           
            // Сводка по алгоритму
            const passed = algorithmResults.filter(r => r.inRange).length;
            const total = algorithmResults.length;
           
            results.push({
                algorithm,
                passed,
                total,
                percentage: ((passed / total) * 100).toFixed(1),
                details: algorithmResults
            });
           
            console.log(`\n📊 АЛГОРИТМ ${algorithm.toUpperCase()}: ${passed}/${total} тестов пройдено`);
        }
       
        // 📈 Сводный отчет
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ ПО ВСЕМ АЛГОРИТМАМ:');
        console.log('='.repeat(60));
       
        results.sort((a, b) => b.passed - a.passed);
       
        results.forEach(result => {
            console.log(`${result.passed === result.total ? '🏆' : '📊'} ${result.algorithm.toUpperCase()}: ${result.passed}/${result.total} (${result.percentage}%)`);
        });
       
        // Лучший алгоритм
        const bestAlgorithm = results[0];
        console.log(`\n🎯 ЛУЧШИЙ АЛГОРИТМ: ${bestAlgorithm.algorithm.toUpperCase()} (${bestAlgorithm.passed}/${bestAlgorithm.total} тестов)`);
       
        // Рекомендации
        console.log('\n💡 РЕКОМЕНДАЦИИ ДЛЯ ВНЕДРЕНИЯ В СИСТЕМУ:');
        console.log('='.repeat(60));
       
        if (bestAlgorithm.passed === bestAlgorithm.total) {
            console.log('✅ Алгоритм готов к внедрению!');
            console.log('🚀 Используйте алгоритм: ' + bestAlgorithm.algorithm);
        } else {
            console.log('⚠️ Требуется доработка алгоритма:');
           
            // Показываем проваленные тесты для лучшего алгоритма
            const failedTests = bestAlgorithm.details.filter(r => !r.inRange);
            failedTests.forEach(test => {
                console.log(`   • ${test.test}: получено ${test.percentage}%, ожидалось ${test.expected.min}-${test.expected.max}%`);
            });
           
            console.log('\n🔧 Рекомендуемые улучшения:');
            console.log('   1. Настройте пороги расстояния');
            console.log('   2. Добавьте фильтрацию выбросов');
            console.log('   3. Улучшите оценку трансформаций');
            console.log('   4. Добавьте весовые коэффициенты для разных типов точек');
        }
       
        return { tests, results, bestAlgorithm: bestAlgorithm.algorithm };
    }
}

// 🚀 ЗАПУСК ПРОГРАММЫ
async function main() {
    try {
        console.log('🎯 ТЕСТОВЫЙ ПОЛИГОН ДЛЯ АЛГОРИТМОВ СРАВНЕНИЯ\n');
        console.log('📚 ЦЕЛЬ: Найти лучший алгоритм для системы сравнения следов\n');
       
        const analyzer = new ResultAnalyzer();
       
        // Запускаем все тесты
        const results = analyzer.runTestSuite();
       
        console.log('\n🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!\n');
       
        // Готовим рекомендации для внедрения
        console.log('🚀 ПЛАН ВНЕДРЕНИЯ В СИСТЕМУ:');
        console.log('='.repeat(60));
       
        const bestAlgo = results.bestAlgorithm;
       
        console.log(`1. Импортируйте алгоритм "${bestAlgo}" в модуль сравнения`);
        console.log(`2. Настройте параметры алгоритма под ваши данные:`);
        console.log(`   • Порог расстояния: 0.1-0.15 для нормализованных точек`);
        console.log(`   • Минимальное количество совпадений: 3-5 точек`);
        console.log(`   • Максимальное расстояние для совпадения: 20-30 пикселей`);
        console.log(`3. Добавьте предобработку данных:`);
        console.log(`   • Нормализация координат`);
        console.log(`   • Выравнивание по главной оси`);
        console.log(`   • Фильтрация выбросов`);
        console.log(`4. Протестируйте на реальных данных перед полным внедрением`);
       
        console.log('\n💪 Удачи с внедрением!');
       
    } catch (error) {
        console.error(`❌ Ошибка: ${error.message}`);
        console.error(error.stack);
    }
}

// Запуск
if (require.main === module) {
    main();
}

module.exports = {
    TestDataGenerator,
    ComparisonAlgorithms,
    ResultAnalyzer
};
