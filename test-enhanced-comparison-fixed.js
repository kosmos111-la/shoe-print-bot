// test-enhanced-comparison-fixed.js
console.log('🎯 УСОВЕРШЕНСТВОВАННЫЙ ТЕСТ С БИБЛИОТЕКАМИ - УТОЧНЕННАЯ ВЕРСИЯ\n');

// Подключаем библиотеки
try {
    const { Matrix, PCA } = require('ml-matrix');
    console.log('✅ Подключена библиотека ml-matrix');
} catch (error) {
    console.log('❌ Не удалось подключить ml-matrix. Используем fallback.');
}

// 🔧 РЕАЛИСТИЧНЫЙ ГЕНЕРАТОР ДАННЫХ
class RealisticDataGenerator {
    // Создаем следы с уникальными характеристиками
    static createFootprint(type, options = {}) {
        const {
            centerX = 400,
            centerY = 300,
            scale = 1.0,
            rotation = 0,
            noise = 0,
            pointCount = null,
            uniqueFeatures = [] // уникальные особенности следа
        } = options;

        let points = [];

        // Базовые параметры для разных типов следов с РАЗНЫМИ характеристиками
        const params = {
            normal: { length: 250, width: 100, toeWidth: 90, heelWidth: 75, archHeight: 0.7 },
            wide: { length: 250, width: 120, toeWidth: 110, heelWidth: 85, archHeight: 0.6 },
            narrow: { length: 250, width: 80, toeWidth: 75, heelWidth: 65, archHeight: 0.8 },
            long: { length: 280, width: 95, toeWidth: 85, heelWidth: 70, archHeight: 0.65 },
            sport: { length: 230, width: 105, toeWidth: 95, heelWidth: 80, archHeight: 0.75 },
            boot: { length: 270, width: 110, toeWidth: 100, heelWidth: 90, archHeight: 0.5 }
        }[type] || params.normal;

        const { length, width, toeWidth, heelWidth, archHeight } = params;

        // Определяем количество точек
        const targetCount = pointCount || Math.floor(25 + Math.random() * 15);

        // Создаем контур с уникальной формой
        const contourPoints = this.createUniqueContour(
            centerX, centerY, length * scale, width * scale,
            toeWidth * scale, heelWidth * scale, archHeight,
            Math.floor(targetCount * 0.6),
            uniqueFeatures
        );
        points.push(...contourPoints);

        // Создаем уникальные внутренние паттерны
        const innerPoints = this.createUniqueInnerPattern(
            centerX, centerY, length * scale, width * scale,
            heelWidth * scale, targetCount - contourPoints.length,
            type
        );
        points.push(...innerPoints);

        // Применяем трансформации
        if (rotation !== 0) {
            points = this.rotatePoints(points, rotation, centerX, centerY);
        }

        if (noise > 0) {
            points = this.addRealisticNoise(points, noise);
        }

        // Обрезаем до нужного количества
        return points.slice(0, targetCount);
    }

    static createUniqueContour(centerX, centerY, length, width, toeWidth, heelWidth, archHeight, count, uniqueFeatures) {
        const points = [];
        if (count < 8) count = 8;
       
        for (let i = 0; i < count; i++) {
            const t = i / count;
            const angle = t * 2 * Math.PI;
           
            // Уникальная форма для каждого типа обуви
            let shapeFactor = 1;
            if (angle > Math.PI * 0.75 && angle < Math.PI * 1.25) {
                // Носок - может быть острый или тупой
                shapeFactor = toeWidth / width;
            } else if (angle > Math.PI * 0.25 && angle < Math.PI * 0.75) {
                // Пятка
                shapeFactor = heelWidth / width;
            } else {
                // Свод стопы
                shapeFactor = archHeight;
            }
           
            // Добавляем случайные уникальные особенности
            if (uniqueFeatures.includes('pointy_toe')) {
                if (angle > Math.PI * 0.85 && angle < Math.PI * 1.15) {
                    shapeFactor *= 0.8;
                }
            }
           
            if (uniqueFeatures.includes('wide_heel')) {
                if (angle > Math.PI * 0.35 && angle < Math.PI * 0.65) {
                    shapeFactor *= 1.2;
                }
            }
           
            const x = centerX + Math.cos(angle) * width / 2 * shapeFactor;
            // Асимметричная форма по вертикали
            const yMultiplier = angle > Math.PI ? 1.1 : 0.9; // Носок выше пятки
            const y = centerY + Math.sin(angle) * length / 2 * yMultiplier;
           
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'contour',
                id: `c_${i}`,
                section: this.getSection(angle)
            });
        }

        return points;
    }

    static getSection(angle) {
        if (angle >= 0 && angle < Math.PI/4) return 'right_side';
        if (angle >= Math.PI/4 && angle < Math.PI/2) return 'right_front';
        if (angle >= Math.PI/2 && angle < 3*Math.PI/4) return 'front';
        if (angle >= 3*Math.PI/4 && angle < Math.PI) return 'left_front';
        if (angle >= Math.PI && angle < 5*Math.PI/4) return 'left_side';
        if (angle >= 5*Math.PI/4 && angle < 3*Math.PI/2) return 'left_back';
        if (angle >= 3*Math.PI/2 && angle < 7*Math.PI/4) return 'back';
        return 'right_back';
    }

    static createUniqueInnerPattern(centerX, centerY, length, width, heelWidth, count, shoeType) {
        const points = [];
        if (count <= 0) return points;
       
        // Уникальные паттерны протектора для разных типов обуви
        const patterns = {
            normal: { rows: 5, cols: 4, pattern: 'grid' },
            wide: { rows: 5, cols: 5, pattern: 'dense_grid' },
            narrow: { rows: 6, cols: 3, pattern: 'vertical_stripes' },
            long: { rows: 7, cols: 4, pattern: 'horizontal_stripes' },
            sport: { rows: 4, cols: 6, pattern: 'diagonal' },
            boot: { rows: 8, cols: 4, pattern: 'zigzag' }
        };
       
        const pattern = patterns[shoeType] || patterns.normal;
       
        // Создаем паттерн в зависимости от типа обуви
        switch (pattern.pattern) {
            case 'grid':
                points.push(...this.createGridPattern(centerX, centerY, length, width, pattern.rows, pattern.cols, count));
                break;
            case 'dense_grid':
                points.push(...this.createDenseGridPattern(centerX, centerY, length, width, pattern.rows, pattern.cols, count));
                break;
            case 'vertical_stripes':
                points.push(...this.createVerticalStripes(centerX, centerY, length, width, pattern.rows, pattern.cols, count));
                break;
            case 'horizontal_stripes':
                points.push(...this.createHorizontalStripes(centerX, centerY, length, width, pattern.rows, pattern.cols, count));
                break;
            default:
                points.push(...this.createRandomPattern(centerX, centerY, length, width, count));
        }
       
        return points.slice(0, count);
    }

    static createGridPattern(centerX, centerY, length, width, rows, cols, maxPoints) {
        const points = [];
        const rowSpacing = length * 0.6 / rows;
        const colSpacing = width * 0.6 / cols;
       
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (points.length >= maxPoints) break;
               
                const x = centerX + (col - cols/2 + 0.5) * colSpacing;
                const y = centerY + (row - rows/2 + 0.5) * rowSpacing;
               
                // Добавляем небольшую случайность
                const jitterX = (Math.random() - 0.5) * colSpacing * 0.3;
                const jitterY = (Math.random() - 0.5) * rowSpacing * 0.3;
               
                points.push({
                    x: Math.round(x + jitterX),
                    y: Math.round(y + jitterY),
                    type: 'grid',
                    id: `g_${row}_${col}`
                });
            }
        }
       
        return points;
    }

    static createRandomPattern(centerX, centerY, length, width, count) {
        const points = [];
       
        for (let i = 0; i < count; i++) {
            // Случайная точка внутри эллипса
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.sqrt(Math.random());
            const x = centerX + Math.cos(angle) * width * 0.4 * radius;
            const y = centerY + Math.sin(angle) * length * 0.4 * radius;
           
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'random',
                id: `r_${i}`
            });
        }
       
        return points;
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

    static addRealisticNoise(points, sigma) {
        // Гауссовский шум
        const gaussianRandom = (mean = 0, stdev = 1) => {
            const u = 1 - Math.random();
            const v = Math.random();
            const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            return z * stdev + mean;
        };

        return points.map(point => {
            const noiseX = gaussianRandom(0, sigma);
            const noiseY = gaussianRandom(0, sigma);
           
            return {
                ...point,
                x: Math.round(point.x + noiseX),
                y: Math.round(point.y + noiseY)
            };
        });
    }

    static transformPoints(points, options = {}) {
        const {
            angle = 0,
            scale = 1.0,
            offsetX = 0,
            offsetY = 0,
            noise = 0
        } = options;

        // Находим центр
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        return points.map((point) => {
            // Смещаем в центр
            let x = point.x - centerX;
            let y = point.y - centerY;

            // Поворот
            const angleRad = angle * Math.PI / 180;
            const cosA = Math.cos(angleRad);
            const sinA = Math.sin(angleRad);
           
            const rotatedX = x * cosA - y * sinA;
            const rotatedY = x * sinA + y * cosA;

            // Масштаб
            x = rotatedX * scale;
            y = rotatedY * scale;

            // Возвращаем и добавляем смещение
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
                id: `${point.id}_t`
            };
        });
    }
}

// 🔍 СТРОГИЙ АНАЛИЗАТОР С PCA
class StrictFootprintAnalyzer {
    constructor() {
        this.usePCA = false;
        try {
            require('ml-matrix');
            this.usePCA = true;
            console.log('✅ Анализатор использует PCA');
        } catch (e) {
            console.log('⚠️ Анализатор использует упрощенные методы');
        }
       
        // Более строгие пороги
        this.thresholds = {
            shape: 0.7,      // Форма должна быть очень похожей
            distribution: 0.6, // Распределение точек
            density: 0.5,    // Плотность
            orientation: 0.8, // Ориентация
            topology: 0.6,   // Топология
            pointMatches: 0.6 // Совпадение точек
        };
    }

    // Основной метод сравнения - БОЛЕЕ СТРОГИЙ
    compareStrict(points1, points2) {
        // 1. Быстрая проверка
        if (points1.length < 5 || points2.length < 5) {
            return {
                score: 0,
                details: {
                    shape: 0, distribution: 0, density: 0,
                    orientation: 0, topology: 0, pointMatches: 0
                },
                decision: '❌ Слишком мало точек'
            };
        }

        // 2. Выравнивание с PCA
        const aligned1 = this.alignWithPCA(points1);
        const aligned2 = this.alignWithPCA(points2);

        // 3. Вычисляем ВСЕ показатели
        const shapeScore = this.compareShapeStrict(aligned1, aligned2);
        const distributionScore = this.compareDistributionStrict(aligned1, aligned2);
        const densityScore = this.compareDensityStrict(aligned1, aligned2);
        const orientationScore = this.compareOrientationStrict(aligned1, aligned2);
        const topologyScore = this.compareTopologyStrict(aligned1, aligned2);
        const pointMatchesScore = this.comparePointMatchesStrict(aligned1, aligned2);

        // 4. Более строгое взвешенное усреднение
        const weights = {
            shape: 0.30,
            distribution: 0.15,
            density: 0.10,
            orientation: 0.10,
            topology: 0.15,
            pointMatches: 0.20
        };

        // Штраф за разное количество точек
        const countPenalty = this.calculateCountPenalty(points1.length, points2.length);

        // Вычисляем итоговый score
        let totalScore = 0;
        totalScore += shapeScore * weights.shape;
        totalScore += distributionScore * weights.distribution;
        totalScore += densityScore * weights.density;
        totalScore += orientationScore * weights.orientation;
        totalScore += topologyScore * weights.topology;
        totalScore += pointMatchesScore * weights.pointMatches;
       
        // Применяем штраф
        totalScore *= countPenalty;

        // 5. Определяем решение на основе строгих правил
        let decision;
        let confidence = 'low';
       
        if (totalScore >= 0.85) {
            decision = '✅ Одна и та же обувь';
            confidence = 'very-high';
        } else if (totalScore >= 0.70) {
            decision = '🟡 Возможно одна и та же';
            confidence = 'high';
        } else if (totalScore >= 0.55) {
            decision = '🟠 Похожая обувь';
            confidence = 'medium';
        } else if (totalScore >= 0.40) {
            decision = '🟣 Возможно похожая';
            confidence = 'low';
        } else if (totalScore >= 0.25) {
            decision = '🔵 Мало похожа';
            confidence = 'very-low';
        } else {
            decision = '❌ Разная обувь';
            confidence = 'none';
        }

        // Дополнительная проверка: если хотя бы один показатель очень низкий
        const minScore = Math.min(shapeScore, distributionScore, pointMatchesScore);
        if (minScore < 0.3 && totalScore > 0.6) {
            // Понижаем оценку, если есть явные несоответствия
            totalScore *= 0.7;
            decision += ' (есть несоответствия)';
        }

        return {
            score: Math.min(100, Math.max(0, totalScore * 100)),
            details: {
                shape: shapeScore * 100,
                distribution: distributionScore * 100,
                density: densityScore * 100,
                orientation: orientationScore * 100,
                topology: topologyScore * 100,
                pointMatches: pointMatchesScore * 100
            },
            decision,
            confidence,
            alignedPoints1: aligned1,
            alignedPoints2: aligned2,
            countPenalty: countPenalty * 100
        };
    }

    calculateCountPenalty(count1, count2) {
        const ratio = Math.min(count1, count2) / Math.max(count1, count2);
        // Сильный штраф за большое расхождение в количестве точек
        if (ratio < 0.5) return 0.5;
        if (ratio < 0.7) return 0.7;
        if (ratio < 0.8) return 0.85;
        return 1.0;
    }

    alignWithPCA(points) {
        if (!this.usePCA || points.length < 5) {
            return this.simpleAlignment(points);
        }

        try {
            const { Matrix } = require('ml-matrix');
           
            const data = points.map(p => [p.x, p.y]);
            const matrix = new Matrix(data);
           
            // Центрируем
            const meanX = matrix.mean('column')[0];
            const meanY = matrix.mean('column')[1];
            const centered = matrix.subRowVector([meanX, meanY]);
           
            // Ковариационная матрица
            const covariance = centered.transpose().mmul(centered).div(points.length - 1);
           
            const a = covariance.get(0, 0);
            const b = covariance.get(0, 1);
            const c = covariance.get(1, 1);
           
            // Собственные значения
            const trace = a + c;
            const determinant = a * c - b * b;
            const eigenvalue1 = trace / 2 + Math.sqrt(Math.pow(trace / 2, 2) - determinant);
           
            // Главный собственный вектор
            let principalVector;
            if (Math.abs(b) > 0.0001) {
                principalVector = [eigenvalue1 - c, b];
            } else {
                principalVector = [1, 0];
            }
           
            // Нормализуем
            const length = Math.sqrt(principalVector[0] * principalVector[0] + principalVector[1] * principalVector[1]);
            principalVector[0] /= length;
            principalVector[1] /= length;
           
            // Угол поворота
            let angle = Math.atan2(principalVector[1], principalVector[0]);
           
            // Поворачиваем
            const cosA = Math.cos(-angle);
            const sinA = Math.sin(-angle);
           
            const aligned = points.map(p => {
                const x = p.x - meanX;
                const y = p.y - meanY;
               
                return {
                    ...p,
                    x: x * cosA - y * sinA,
                    y: x * sinA + y * cosA
                };
            });
           
            return this.normalizeScale(aligned);
           
        } catch (error) {
            return this.simpleAlignment(points);
        }
    }

    simpleAlignment(points) {
        if (points.length < 2) return points;
       
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        const centered = points.map(p => ({
            ...p,
            x: p.x - centerX,
            y: p.y - centerY
        }));
       
        return this.normalizeScale(centered);
    }

    normalizeScale(points) {
        if (points.length === 0) return points;
       
        const distances = points.map(p => Math.sqrt(p.x * p.x + p.y * p.y));
        const maxDist = Math.max(...distances);
       
        if (maxDist === 0) return points;
       
        const scale = 1 / maxDist;
       
        return points.map(p => ({
            ...p,
            x: p.x * scale,
            y: p.y * scale
        }));
    }

    compareShapeStrict(points1, points2) {
        // Сравниваем моменты с большей строгостью
        const moments1 = this.calculateCentralMoments(points1);
        const moments2 = this.calculateCentralMoments(points2);
       
        let similarity = 0;
        const weights = [0.4, 0.3, 0.2, 0.1];
       
        for (let i = 0; i < Math.min(moments1.length, moments2.length, weights.length); i++) {
            const diff = Math.abs(moments1[i] - moments2[i]);
            // Более строгая оценка различий
            similarity += weights[i] * Math.max(0, 1 - diff * 1.5);
        }
       
        return Math.min(1, similarity);
    }

    calculateCentralMoments(points) {
        if (points.length < 5) return [0, 0, 0, 0];
       
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        let mu20 = 0, mu02 = 0, mu11 = 0, mu30 = 0, mu03 = 0, mu21 = 0, mu12 = 0;
       
        for (const p of points) {
            const x = p.x - centerX;
            const y = p.y - centerY;
           
            mu20 += x * x;
            mu02 += y * y;
            mu11 += x * y;
            mu30 += x * x * x;
            mu03 += y * y * y;
            mu21 += x * x * y;
            mu12 += x * y * y;
        }
       
        const n = points.length;
        mu20 /= n; mu02 /= n; mu11 /= n;
        mu30 /= n; mu03 /= n; mu21 /= n; mu12 /= n;
       
        // Центральные моменты
        const nu20 = mu20;
        const nu02 = mu02;
        const nu11 = mu11;
       
        // Нормализованные моменты
        const m00 = Math.pow(Math.sqrt(mu20 * mu02), 0.5);
        const eta20 = nu20 / Math.pow(m00, 4);
        const eta02 = nu02 / Math.pow(m00, 4);
        const eta11 = nu11 / Math.pow(m00, 4);
       
        // Моменты Ху (Hu moments)
        const I1 = eta20 + eta02;
        const I2 = Math.pow(eta20 - eta02, 2) + 4 * Math.pow(eta11, 2);
        const I3 = Math.pow(eta30 - 3*eta12, 2) + Math.pow(3*eta21 - eta03, 2);
        const I4 = Math.pow(eta30 + eta12, 2) + Math.pow(eta21 + eta03, 2);
       
        return [I1, I2, I3, I4];
    }

    compareDistributionStrict(points1, points2) {
        // Разбиваем на 8 секторов вместо 4 для большей точности
        const sectors1 = this.getSectorDistribution(points1, 8);
        const sectors2 = this.getSectorDistribution(points2, 8);
       
        let similarity = 0;
        for (let i = 0; i < 8; i++) {
            const diff = Math.abs(sectors1[i] - sectors2[i]);
            // Очень строгая оценка распределения
            similarity += 0.125 * Math.max(0, 1 - diff * 3);
        }
       
        return similarity;
    }

    getSectorDistribution(points, numSectors) {
        const sectors = new Array(numSectors).fill(0);
       
        for (const p of points) {
            let angle = Math.atan2(p.y, p.x);
            if (angle < 0) angle += 2 * Math.PI;
           
            const sector = Math.floor(angle / (2 * Math.PI) * numSectors) % numSectors;
            sectors[sector]++;
        }
       
        const total = points.length || 1;
        return sectors.map(s => s / total);
    }

    compareDensityStrict(points1, points2) {
        const density1 = this.calculateLocalDensity(points1);
        const density2 = this.calculateLocalDensity(points2);
       
        if (density1 === 0 || density2 === 0) return 0;
       
        const ratio = Math.min(density1, density2) / Math.max(density1, density2);
        // Строгая оценка: даже небольшое различие сильно снижает оценку
        return Math.pow(ratio, 2);
    }

    calculateLocalDensity(points) {
        if (points.length < 3) return 0;
       
        // Среднее расстояние до ближайших соседей
        let totalDistance = 0;
       
        for (const point of points) {
            let minDistance = Infinity;
           
            for (const other of points) {
                if (point === other) continue;
               
                const dx = point.x - other.x;
                const dy = point.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < minDistance) {
                    minDistance = distance;
                }
            }
           
            if (minDistance < Infinity) {
                totalDistance += minDistance;
            }
        }
       
        const avgDistance = totalDistance / points.length;
        // Плотность обратно пропорциональна среднему расстоянию
        return avgDistance > 0 ? 1 / avgDistance : 0;
    }

    compareOrientationStrict(points1, points2) {
        const orientation1 = this.getDetailedOrientation(points1);
        const orientation2 = this.getDetailedOrientation(points2);
       
        // Сравниваем не только угол, но и эллиптичность
        const angleDiff = Math.abs(orientation1.angle - orientation2.angle) % (Math.PI / 2);
        const eccentricityDiff = Math.abs(orientation1.eccentricity - orientation2.eccentricity);
       
        const angleScore = Math.max(0, 1 - angleDiff / (Math.PI / 8));
        const eccentricityScore = Math.max(0, 1 - eccentricityDiff * 2);
       
        return (angleScore * 0.7 + eccentricityScore * 0.3);
    }

    getDetailedOrientation(points) {
        if (points.length < 3) return { angle: 0, eccentricity: 0 };
       
        let sumXX = 0, sumYY = 0, sumXY = 0;
        for (const p of points) {
            sumXX += p.x * p.x;
            sumYY += p.y * p.y;
            sumXY += p.x * p.y;
        }
       
        const n = points.length;
        const angle = 0.5 * Math.atan2(2 * sumXY / n, sumXX / n - sumYY / n);
       
        // Эллиптичность
        const eigen1 = (sumXX + sumYY) / n + Math.sqrt(Math.pow((sumXX - sumYY) / n, 2) + 4 * Math.pow(sumXY / n, 2));
        const eigen2 = (sumXX + sumYY) / n - Math.sqrt(Math.pow((sumXX - sumYY) / n, 2) + 4 * Math.pow(sumXY / n, 2));
        const eccentricity = Math.sqrt(1 - Math.min(eigen1, eigen2) / Math.max(eigen1, eigen2));
       
        return { angle, eccentricity };
    }

    compareTopologyStrict(points1, points2) {
        if (points1.length < 4 || points2.length < 4) return 0.5;
       
        // Сравниваем графы смежности с k=4 ближайших соседей
        const graph1 = this.buildKNNGraph(points1, 4);
        const graph2 = this.buildKNNGraph(points2, 4);
       
        const degrees1 = this.getDegreeDistribution(graph1);
        const degrees2 = this.getDegreeDistribution(graph2);
       
        // Сравниваем статистики степеней
        const mean1 = degrees1.reduce((a, b) => a + b, 0) / degrees1.length;
        const mean2 = degrees2.reduce((a, b) => a + b, 0) / degrees2.length;
        const std1 = Math.sqrt(degrees1.map(d => Math.pow(d - mean1, 2)).reduce((a, b) => a + b, 0) / degrees1.length);
        const std2 = Math.sqrt(degrees2.map(d => Math.pow(d - mean2, 2)).reduce((a, b) => a + b, 0) / degrees2.length);
       
        const meanDiff = Math.abs(mean1 - mean2) / Math.max(mean1, mean2, 1);
        const stdDiff = Math.abs(std1 - std2) / Math.max(std1, std2, 1);
       
        return Math.max(0, 1 - (meanDiff + stdDiff));
    }

    buildKNNGraph(points, k) {
        const graph = new Array(points.length).fill().map(() => []);
       
        for (let i = 0; i < points.length; i++) {
            const distances = [];
           
            for (let j = 0; j < points.length; j++) {
                if (i === j) continue;
               
                const dx = points[i].x - points[j].x;
                const dy = points[i].y - points[j].y;
                distances.push({ index: j, distance: Math.sqrt(dx * dx + dy * dy) });
            }
           
            distances.sort((a, b) => a.distance - b.distance);
           
            for (let n = 0; n < Math.min(k, distances.length); n++) {
                graph[i].push(distances[n].index);
            }
        }
       
        return graph;
    }

    getDegreeDistribution(graph) {
        return graph.map(neighbors => neighbors.length);
    }

    comparePointMatchesStrict(points1, points2) {
        const matches = this.findStrictMatches(points1, points2, 0.1); // Очень строгий порог
       
        // Штраф за несовпавшие точки
        const matchedRatio = matches.length / Math.min(points1.length, points2.length);
       
        // Также учитываем качество совпадений (среднее расстояние)
        let avgDistance = 0;
        if (matches.length > 0) {
            avgDistance = matches.reduce((sum, m) => sum + m.distance, 0) / matches.length;
        }
       
        const distanceScore = Math.max(0, 1 - avgDistance * 10); // Очень строго к расстояниям
       
        return matchedRatio * distanceScore;
    }

    findStrictMatches(points1, points2, threshold) {
        const matches = [];
        const used2 = new Set();
       
        // Для более точного сопоставления используем двустороннюю проверку
        for (let i = 0; i < points1.length; i++) {
            let bestMatch = null;
            let minDistance = Infinity;
            let bestIndex = -1;
           
            for (let j = 0; j < points2.length; j++) {
                if (used2.has(j)) continue;
               
                const dx = points1[i].x - points2[j].x;
                const dy = points1[i].y - points2[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = points2[j];
                    bestIndex = j;
                }
            }
           
            // Проверяем обратное соответствие
            if (bestMatch) {
                let isMutual = true;
               
                // Проверяем, является ли points1[i] также ближайшей для bestMatch
                let reverseMinDistance = Infinity;
                for (let k = 0; k < points1.length; k++) {
                    if (k === i) continue;
                   
                    const dx = bestMatch.x - points1[k].x;
                    const dy = bestMatch.y - points1[k].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                   
                    if (distance < reverseMinDistance) {
                        reverseMinDistance = distance;
                    }
                }
               
                const dx = bestMatch.x - points1[i].x;
                const dy = bestMatch.y - points1[i].y;
                const directDistance = Math.sqrt(dx * dx + dy * dy);
               
                // Если это взаимно ближайшие точки и расстояние маленькое
                if (minDistance < threshold && minDistance <= reverseMinDistance * 1.2) {
                    matches.push({
                        point1: points1[i],
                        point2: bestMatch,
                        distance: minDistance
                    });
                    used2.add(bestIndex);
                }
            }
        }
       
        return matches;
    }
}

// 📊 ТЕСТОВЫЙ РАННЕР С КОРРЕКТНЫМИ ОЖИДАНИЯМИ
class RealisticTestRunner {
    constructor() {
        this.analyzer = new StrictFootprintAnalyzer();
        this.results = [];
    }

    async runTests() {
        console.log('🧪 ЗАПУСК РЕАЛИСТИЧНЫХ ТЕСТОВ\n');

        const tests = [
            {
                name: 'Один и тот же след',
                points1: () => RealisticDataGenerator.createFootprint('normal', {
                    pointCount: 30,
                    uniqueFeatures: ['pointy_toe']
                }),
                points2: (points1) => JSON.parse(JSON.stringify(points1)),
                expected: { min: 85, max: 98 },
                description: 'Точная копия одного и того же следа'
            },
            {
                name: 'Похожая обувь (нормальная vs широкая)',
                points1: () => RealisticDataGenerator.createFootprint('normal', {
                    pointCount: 30,
                    uniqueFeatures: ['pointy_toe']
                }),
                points2: () => RealisticDataGenerator.createFootprint('wide', {
                    pointCount: 28
                }),
                expected: { min: 60, max: 75 },
                description: 'Похожие но разные следы'
            },
            {
                name: 'Разная обувь (нормальная vs узкая)',
                points1: () => RealisticDataGenerator.createFootprint('normal', {
                    pointCount: 30
                }),
                points2: () => RealisticDataGenerator.createFootprint('narrow', {
                    pointCount: 32,
                    uniqueFeatures: ['wide_heel']
                }),
                expected: { min: 40, max: 55 },
                description: 'Заметно разные следы'
            },
            {
                name: 'Поворот 45°',
                points1: () => RealisticDataGenerator.createFootprint('normal', {
                    pointCount: 30
                }),
                points2: (points1) => RealisticDataGenerator.rotatePoints(points1, 45, 400, 300),
                expected: { min: 80, max: 92 },
                description: 'Тот же след, повернутый на 45°'
            },
            {
                name: 'Масштаб 0.8x',
                points1: () => RealisticDataGenerator.createFootprint('normal', {
                    pointCount: 30
                }),
                points2: (points1) => RealisticDataGenerator.transformPoints(points1, { scale: 0.8 }),
                expected: { min: 75, max: 88 },
                description: 'Тот же след, уменьшенный на 20%'
            },
            {
                name: 'С шумом ±8px',
                points1: () => RealisticDataGenerator.createFootprint('normal', {
                    pointCount: 30
                }),
                points2: (points1) => RealisticDataGenerator.addRealisticNoise(points1, 8),
                expected: { min: 70, max: 85 },
                description: 'Тот же след с небольшим шумом'
            },
            {
                name: 'Совсем другая обувь',
                points1: () => RealisticDataGenerator.createFootprint('normal', {
                    pointCount: 30
                }),
                points2: () => RealisticDataGenerator.createFootprint('boot', {
                    pointCount: 35,
                    centerX: 450,
                    centerY: 350
                }),
                expected: { min: 20, max: 40 },
                description: 'Совершенно разные типы обуви'
            },
            {
                name: 'Разные паттерны протектора',
                points1: () => RealisticDataGenerator.createFootprint('sport', {
                    pointCount: 30
                }),
                points2: () => RealisticDataGenerator.createFootprint('long', {
                    pointCount: 32
                }),
                expected: { min: 25, max: 45 },
                description: 'Разные паттерны внутренних точек'
            },
            {
                name: 'Случайные следы',
                points1: () => RealisticDataGenerator.createFootprint('normal', {
                    pointCount: 25,
                    centerX: 300,
                    centerY: 200
                }),
                points2: () => RealisticDataGenerator.createFootprint('wide', {
                    pointCount: 28,
                    centerX: 500,
                    centerY: 400
                }),
                expected: { min: 15, max: 35 },
                description: 'Случайные следы в разных местах'
            }
        ];

        for (const test of tests) {
            console.log(`\n🎯 ${test.name.toUpperCase()}`);
            console.log(`📝 ${test.description}`);
           
            try {
                // Генерируем точки
                const points1 = test.points1();
                const points2 = typeof test.points2 === 'function' && test.points2.length === 1
                    ? test.points2(points1)
                    : test.points2();
               
                console.log(`👣 Создан след 1: ${points1.length} точек`);
                console.log(`👣 Создан след 2: ${points2.length} точек`);

                // Выполняем сравнение
                const result = this.analyzer.compareStrict(points1, points2);
               
                // Анализируем результаты
                const score = result.score;
                const isInRange = score >= test.expected.min && score <= test.expected.max;
               
                console.log(`\n📊 РЕЗУЛЬТАТЫ:`);
                console.log(`   • Общий score: ${score.toFixed(1)}%`);
                console.log(`   • Штраф за количество точек: ${result.countPenalty.toFixed(1)}%`);
                console.log(`   • Форма: ${result.details.shape.toFixed(1)}%`);
                console.log(`   • Распределение: ${result.details.distribution.toFixed(1)}%`);
                console.log(`   • Плотность: ${result.details.density.toFixed(1)}%`);
                console.log(`   • Ориентация: ${result.details.orientation.toFixed(1)}%`);
                console.log(`   • Топология: ${result.details.topology.toFixed(1)}%`);
                console.log(`   • Совпадение точек: ${result.details.pointMatches.toFixed(1)}%`);
                console.log(`   🎯 ИТОГ: ${score.toFixed(1)}%`);
                console.log(`   🤔 РЕШЕНИЕ: ${result.decision}`);
                console.log(`   🔍 УВЕРЕННОСТЬ: ${result.confidence}`);
               
                // Сохраняем результат
                this.results.push({
                    name: test.name,
                    score,
                    expected: test.expected,
                    inRange: isInRange,
                    decision: result.decision,
                    confidence: result.confidence,
                    description: test.description
                });
               
                console.log(`\n${isInRange ? '✅' : '❌'} Результат: ${score.toFixed(1)}% (ожидалось ${test.expected.min}-${test.expected.max}%)`);
               
            } catch (error) {
                console.error(`❌ Ошибка в тесте "${test.name}": ${error.message}`);
                this.results.push({
                    name: test.name,
                    score: 0,
                    expected: test.expected,
                    inRange: false,
                    decision: 'Ошибка',
                    error: error.message
                });
            }
        }
       
        // Сводный отчет
        this.generateSummaryReport();
    }

    generateSummaryReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📈 СВОДНЫЙ ОТЧЁТ ПО ТЕСТАМ');
        console.log('='.repeat(60));
       
        let passed = 0;
        let totalScore = 0;
        let testsWithResults = 0;
       
        console.log('\n№  ТЕСТ                             РЕЗУЛЬТАТ   ОЖИДАНИЕ   СТАТУС');
        console.log('─'.repeat(60));
       
        this.results.forEach((result, index) => {
            const status = result.inRange ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН';
            if (result.inRange) passed++;
           
            if (result.score !== undefined) {
                totalScore += result.score;
                testsWithResults++;
            }
           
            const scoreStr = result.score !== undefined ? `${result.score.toFixed(1)}%` : 'ОШИБКА';
            const expectedStr = `${result.expected.min}-${result.expected.max}%`;
           
            console.log(`${index + 1}. ${result.name.padEnd(30)} ${scoreStr.padEnd(10)} ${expectedStr.padEnd(10)} ${status}`);
           
            if (result.decision && result.decision !== 'Ошибка') {
                console.log(`   Решение: ${result.decision}`);
            }
        });
       
        const total = this.results.length;
        const percentage = total > 0 ? (passed / total * 100).toFixed(1) : '0.0';
        const avgScore = testsWithResults > 0 ? (totalScore / testsWithResults).toFixed(1) : '0.0';
       
        console.log('\n' + '='.repeat(60));
        console.log(`🎯 ИТОГО: ${passed}/${total} тестов пройдено (${percentage}%)`);
        console.log(`📊 Средний результат: ${avgScore}%`);
       
        if (passed >= total * 0.8) {
            console.log('\n✅ ОТЛИЧНО! Алгоритм работает корректно. Можно интегрировать в систему.');
            this.showIntegrationInstructions();
        } else if (passed >= total * 0.6) {
            console.log('\n⚠️ УДОВЛЕТВОРИТЕЛЬНО. Алгоритм требует небольшой настройки.');
            this.showImprovementSuggestions();
        } else {
            console.log('\n❌ ТРЕБУЕТСЯ ДОРАБОТКА. Алгоритм слишком "лояльный".');
            this.showImprovementSuggestions();
        }
    }

    showIntegrationInstructions() {
        console.log('\n🚀 ИНСТРУКЦИИ ПО ИНТЕГРАЦИИ:');
        console.log('='.repeat(60));
        console.log('1. Скопируйте файл test-enhanced-comparison-fixed.js в ваш проект');
        console.log('2. Установите зависимость: npm install ml-matrix');
        console.log('3. Импортируйте и используйте:');
        console.log(`
   const { StrictFootprintAnalyzer } = require('./test-enhanced-comparison-fixed');
  
   const analyzer = new StrictFootprintAnalyzer();
   const result = analyzer.compareStrict(points1, points2);
  
   if (result.score >= 85) {
       console.log("✅ Одна и та же обувь");
   } else if (result.score >= 70) {
       console.log("🟡 Возможно одна и та же");
   } else if (result.score >= 55) {
       console.log("🟠 Похожая обувь");
   } else if (result.score >= 40) {
       console.log("🟣 Возможно похожая");
   } else {
       console.log("❌ Разная обувь");
   }
        `);
    }

    showImprovementSuggestions() {
        console.log('\n🔧 РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ:');
        console.log('='.repeat(60));
       
        const failedTests = this.results.filter(r => !r.inRange);
       
        if (failedTests.length > 0) {
            console.log('Проблемные тесты:');
            failedTests.forEach(test => {
                if (test.score !== undefined) {
                    const issue = test.score < test.expected.min ? 'слишком низкий' : 'слишком высокий';
                    console.log(`   • ${test.name}: ${test.score.toFixed(1)}% (${issue})`);
                }
            });
           
            console.log('\nВозможные улучшения:');
            console.log('   1. Увеличьте строгость порогов в StrictFootprintAnalyzer.thresholds');
            console.log('   2. Добавьте анализ уникальных признаков (особые точки, углы)');
            console.log('   3. Используйте machine learning для обучения на реальных данных');
            console.log('   4. Добавьте сравнение гистограмм расстояний');
            console.log('   5. Внедрите анализ текстурных паттернов');
        }
    }
}

// 🚀 ЗАПУСК ТЕСТОВ
async function main() {
    console.log('🎯 РЕАЛИСТИЧНЫЙ ТЕСТ СРАВНЕНИЯ СЛЕДОВ ОБУВИ\n');
    console.log('📚 Используются строгие алгоритмы с PCA и статистическим анализом\n');
    console.log('='.repeat(60));
   
    try {
        const testRunner = new RealisticTestRunner();
        await testRunner.runTests();
       
        console.log('\n🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!');
       
    } catch (error) {
        console.error(`❌ Критическая ошибка: ${error.message}`);
        console.error(error.stack);
    }
}

// Инструкция по установке
console.log('\n📦 ИНСТРУКЦИЯ ПО УСТАНОВКЕ:');
console.log('1. Установите зависимости:');
console.log('   sudo apt-get update');
console.log('   sudo apt-get install -y libcairo2-dev libjpeg-dev libgif-dev libpango1.0-dev');
console.log('2. Установите библиотеку:');
console.log('   npm install ml-matrix');
console.log('3. Запустите тест:');
console.log('   node test-enhanced-comparison-fixed.js');
console.log('='.repeat(60));

// Запуск теста
if (require.main === module) {
    main().catch(console.error);
}

// Экспорт для использования в других модулях
module.exports = {
    RealisticDataGenerator,
    StrictFootprintAnalyzer,
    RealisticTestRunner
};
