// test-enhanced-comparison.js
console.log('🎯 УСОВЕРШЕНСТВОВАННЫЙ ТЕСТ С БИБЛИОТЕКАМИ\n');

// Подключаем библиотеки
try {
    const { Matrix, PCA } = require('ml-matrix');
    console.log('✅ Подключена библиотека ml-matrix');
} catch (error) {
    console.log('❌ Не удалось подключить ml-matrix. Используем fallback.');
}

// 🔧 УЛУЧШЕННЫЙ ГЕНЕРАТОР ДАННЫХ
class EnhancedDataGenerator {
    static createRealisticFootprint(type, options = {}) {
        const {
            centerX = 400,
            centerY = 300,
            scale = 1.0,
            rotation = 0,
            noise = 0,
            pointCount = null
        } = options;

        let points = [];

        // Базовые параметры для разных типов следов
        const params = {
            normal: { length: 250, width: 100, heelWidth: 80 },
            wide: { length: 250, width: 120, heelWidth: 90 },
            narrow: { length: 250, width: 80, heelWidth: 70 },
            long: { length: 280, width: 95, heelWidth: 75 }
        }[type] || params.normal;

        const { length, width, heelWidth } = params;

        // Определяем количество точек
        const targetCount = pointCount || Math.floor(20 + Math.random() * 20);

        // Создаем контур следа
        const contourPoints = this.createContour(centerX, centerY, length * scale, width * scale, targetCount * 0.6);
        points.push(...contourPoints);

        // Создаем внутренние точки (протектор)
        const innerPoints = this.createInnerPattern(centerX, centerY, length * scale, width * scale, heelWidth * scale, targetCount * 0.4);
        points.push(...innerPoints);

        // Применяем трансформации
        if (rotation !== 0) {
            points = this.rotatePoints(points, rotation, centerX, centerY);
        }

        if (noise > 0) {
            points = this.addGaussianNoise(points, noise);
        }

        return points.slice(0, targetCount); // Обеспечиваем точное количество точек
    }

    static createContour(centerX, centerY, length, width, count) {
        const points = [];
        const step = (2 * Math.PI) / count;

        for (let i = 0; i < count; i++) {
            const angle = i * step;
            // Эллиптическая форма с асимметрией (как настоящий след)
            const x = centerX + Math.cos(angle) * width / 2;
            const y = centerY + Math.sin(angle) * length / 2 * (1 - 0.2 * Math.cos(2 * angle));
           
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'contour',
                id: `c_${i}`
            });
        }

        return points;
    }

    static createInnerPattern(centerX, centerY, length, width, heelWidth, count) {
        const points = [];
       
        // Распределяем точки по зонам следа
        const zones = [
            { weight: 0.3, func: this.createHeelPattern.bind(this) },    // Пятка
            { weight: 0.4, func: this.createMidPattern.bind(this) },     // Середина
            { weight: 0.3, func: this.createToePattern.bind(this) }      // Носок
        ];

        let pointsCreated = 0;
        for (const zone of zones) {
            const zoneCount = Math.floor(count * zone.weight);
            const zonePoints = zone.func(centerX, centerY, length, width, heelWidth, zoneCount);
            points.push(...zonePoints);
            pointsCreated += zonePoints.length;
        }

        // Если создали меньше точек, добавляем случайные
        if (pointsCreated < count) {
            const remaining = count - pointsCreated;
            for (let i = 0; i < remaining; i++) {
                const x = centerX + (Math.random() - 0.5) * width * 0.3;
                const y = centerY + (Math.random() - 0.5) * length * 0.3;
                points.push({
                    x: Math.round(x),
                    y: Math.round(y),
                    type: 'random',
                    id: `r_${i}`
                });
            }
        }

        return points;
    }

    static createHeelPattern(centerX, centerY, length, width, heelWidth, count) {
        const points = [];
        const heelCenterY = centerY - length * 0.3;
       
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI;
            const radius = heelWidth * 0.3 * (0.5 + Math.random() * 0.5);
            const x = centerX + Math.cos(angle) * radius;
            const y = heelCenterY + Math.sin(angle) * radius * 0.5;
           
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'heel',
                id: `h_${i}`
            });
        }
       
        return points;
    }

    static createMidPattern(centerX, centerY, length, width, count) {
        const points = [];
       
        // Создаем полоски протектора
        const stripCount = Math.max(2, Math.floor(count / 3));
        for (let strip = 0; strip < stripCount; strip++) {
            const stripY = centerY - length * 0.1 + (strip / stripCount) * length * 0.4;
            const stripWidth = width * 0.6;
           
            for (let i = 0; i < Math.floor(count / stripCount); i++) {
                const x = centerX + (Math.random() - 0.5) * stripWidth;
                const y = stripY + (Math.random() - 0.5) * 5;
               
                points.push({
                    x: Math.round(x),
                    y: Math.round(y),
                    type: 'mid',
                    id: `m_${strip}_${i}`
                });
            }
        }
       
        return points;
    }

    static createToePattern(centerX, centerY, length, width, count) {
        const points = [];
        const toeCenterY = centerY + length * 0.3;
       
        for (let i = 0; i < count; i++) {
            const angle = Math.PI + (i / count) * Math.PI;
            const radius = width * 0.25 * (0.6 + Math.random() * 0.4);
            const x = centerX + Math.cos(angle) * radius;
            const y = toeCenterY + Math.sin(angle) * radius * 0.3;
           
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'toe',
                id: `t_${i}`
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

    static addGaussianNoise(points, sigma) {
        return points.map(point => {
            const noiseX = this.gaussianRandom(0, sigma);
            const noiseY = this.gaussianRandom(0, sigma);
           
            return {
                ...point,
                x: Math.round(point.x + noiseX),
                y: Math.round(point.y + noiseY)
            };
        });
    }

    static gaussianRandom(mean = 0, stdev = 1) {
        const u = 1 - Math.random();
        const v = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return z * stdev + mean;
    }

    static transformPoints(points, options = {}) {
        const {
            angle = 0,
            scale = 1.0,
            offsetX = 0,
            offsetY = 0,
            noise = 0,
            nonLinear = false
        } = options;

        // Находим центр
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        return points.map((point, index) => {
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

            // Нелинейная деформация (если нужно)
            if (nonLinear) {
                const deformation = 1 + 0.05 * Math.sin(index * 0.1);
                x *= deformation;
                y *= deformation;
            }

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
                originalId: point.id,
                id: `${point.id}_transformed`
            };
        });
    }
}

// 🔍 УСОВЕРШЕНСТВОВАННЫЙ АНАЛИЗАТОР С PCA
class EnhancedAnalyzer {
    constructor() {
        this.usePCA = false;
        try {
            // Проверяем доступность ml-matrix
            require('ml-matrix');
            this.usePCA = true;
        } catch (e) {
            console.log('⚠️ PCA будет использоваться в упрощенном режиме');
        }
    }

    // Основной метод сравнения
    compareStructured(points1, points2) {
        console.log(`\n🔍 Сравниваем: ${points1.length} vs ${points2.length} точек`);

        // 1. Предварительная проверка
        if (points1.length < 3 || points2.length < 3) {
            return { score: 0, details: { error: 'Слишком мало точек' } };
        }

        // 2. Выравнивание с помощью PCA
        const aligned1 = this.alignWithPCA(points1);
        const aligned2 = this.alignWithPCA(points2);

        // 3. Сравнение характеристик
        const scores = {
            shape: this.compareShape(aligned1, aligned2),
            distribution: this.compareDistribution(aligned1, aligned2),
            density: this.compareDensity(aligned1, aligned2),
            orientation: this.compareOrientation(aligned1, aligned2),
            topology: this.compareTopology(aligned1, aligned2)
        };

        // 4. Взвешенное усреднение
        const weights = {
            shape: 0.35,
            distribution: 0.20,
            density: 0.15,
            orientation: 0.15,
            topology: 0.15
        };

        let totalScore = 0;
        for (const [key, score] of Object.entries(scores)) {
            totalScore += score * weights[key];
        }

        // 5. Корректировка на основе количества точек
        const countRatio = Math.min(points1.length, points2.length) / Math.max(points1.length, points2.length);
        totalScore *= (0.7 + 0.3 * countRatio); // Штрафуем за разное количество точек

        return {
            score: Math.min(100, Math.max(0, totalScore * 100)),
            details: scores,
            alignedPoints1: aligned1,
            alignedPoints2: aligned2
        };
    }

    // PCA-выравнивание
    alignWithPCA(points) {
        if (!this.usePCA || points.length < 3) {
            return this.simpleAlignment(points);
        }

        try {
            const { Matrix, PCA } = require('ml-matrix');
           
            // Преобразуем точки в матрицу
            const matrix = new Matrix(points.map(p => [p.x, p.y]));
           
            // Вычисляем PCA
            const pca = new PCA(matrix);
            const loadings = pca.getLoadings();
           
            if (loadings.rows < 2 || loadings.columns < 2) {
                return this.simpleAlignment(points);
            }
           
            // Получаем главный компонент (первый собственный вектор)
            const principalVector = [loadings.get(0, 0), loadings.get(1, 0)];
           
            // Вычисляем угол поворота
            let angle = Math.atan2(principalVector[1], principalVector[0]);
           
            // Поворачиваем точки так, чтобы главная ось была горизонтальной
            const cosA = Math.cos(-angle);
            const sinA = Math.sin(-angle);
           
            // Центрируем
            const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
            const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
           
            const aligned = points.map(p => {
                const x = p.x - centerX;
                const y = p.y - centerY;
               
                return {
                    ...p,
                    x: x * cosA - y * sinA,
                    y: x * sinA + y * cosA
                };
            });
           
            return this.normalizeScale(aligned);
           
        } catch (error) {
            console.log(`⚠️ Ошибка PCA: ${error.message}`);
            return this.simpleAlignment(points);
        }
    }

    simpleAlignment(points) {
        if (points.length < 2) return points;
       
        // Центрируем
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
       
        // Находим максимальное расстояние от центра
        const distances = points.map(p => Math.sqrt(p.x * p.x + p.y * p.y));
        const maxDist = Math.max(...distances);
       
        if (maxDist === 0) return points;
       
        // Масштабируем к единичному радиусу
        const scale = 1 / maxDist;
       
        return points.map(p => ({
            ...p,
            x: p.x * scale,
            y: p.y * scale
        }));
    }

    // Сравнение формы через моменты
    compareShape(points1, points2) {
        // Вычисляем моменты инерции
        const moments1 = this.calculateMoments(points1);
        const moments2 = this.calculateMoments(points2);
       
        // Сравниваем моменты
        let similarity = 0;
        const weights = [0.4, 0.3, 0.2, 0.1]; // Веса для разных моментов
       
        for (let i = 0; i < Math.min(moments1.length, moments2.length, weights.length); i++) {
            const diff = Math.abs(moments1[i] - moments2[i]);
            similarity += weights[i] * Math.max(0, 1 - diff);
        }
       
        return similarity;
    }

    calculateMoments(points) {
        if (points.length === 0) return [0, 0, 0, 0];
       
        // Центр масс
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        // Моменты
        let m00 = points.length;
        let m10 = 0, m01 = 0, m20 = 0, m02 = 0, m11 = 0;
       
        for (const p of points) {
            const x = p.x - centerX;
            const y = p.y - centerY;
           
            m10 += x;
            m01 += y;
            m20 += x * x;
            m02 += y * y;
            m11 += x * y;
        }
       
        // Нормализованные моменты
        const n20 = m20 / m00;
        const n02 = m02 / m00;
        const n11 = m11 / m00;
       
        // Центральные моменты
        const mu20 = n20;
        const mu02 = n02;
        const mu11 = n11;
       
        // Моменты инерции
        const I1 = mu20 + mu02;
        const I2 = Math.pow(mu20 - mu02, 2) + 4 * Math.pow(mu11, 2);
        const I3 = Math.pow(mu20 + mu02, 2) - 4 * Math.pow(mu11, 2);
       
        return [I1, I2, I3, Math.sqrt(m20 * m02)];
    }

    // Сравнение распределения точек
    compareDistribution(points1, points2) {
        // Разбиваем на квадранты
        const quadrants1 = this.getQuadrantDistribution(points1);
        const quadrants2 = this.getQuadrantDistribution(points2);
       
        // Сравниваем распределения
        let similarity = 0;
        for (let i = 0; i < 4; i++) {
            const diff = Math.abs(quadrants1[i] - quadrants2[i]);
            similarity += 0.25 * Math.max(0, 1 - diff * 2); // Штраф за большие различия
        }
       
        return similarity;
    }

    getQuadrantDistribution(points) {
        const quadrants = [0, 0, 0, 0];
       
        for (const p of points) {
            if (p.x >= 0 && p.y >= 0) quadrants[0]++;
            else if (p.x < 0 && p.y >= 0) quadrants[1]++;
            else if (p.x < 0 && p.y < 0) quadrants[2]++;
            else quadrants[3]++;
        }
       
        // Нормализуем
        const total = points.length || 1;
        return quadrants.map(q => q / total);
    }

    // Сравнение плотности
    compareDensity(points1, points2) {
        const density1 = this.calculateDensity(points1);
        const density2 = this.calculateDensity(points2);
       
        const ratio = Math.min(density1, density2) / Math.max(density1, density2);
        return ratio;
    }

    calculateDensity(points) {
        if (points.length < 2) return 0;
       
        // Находим ограничивающий прямоугольник
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);
       
        const area = width * height || 1;
        return points.length / area;
    }

    // Сравнение ориентации
    compareOrientation(points1, points2) {
        // Уже выровнены PCA, сравниваем остаточную ориентацию
        const angle1 = this.getDominantAngle(points1);
        const angle2 = this.getDominantAngle(points2);
       
        const angleDiff = Math.abs(angle1 - angle2) % (Math.PI / 2); // Учитываем симметрию
        return Math.max(0, 1 - angleDiff / (Math.PI / 4));
    }

    getDominantAngle(points) {
        if (points.length < 2) return 0;
       
        let sumXX = 0, sumYY = 0, sumXY = 0;
        for (const p of points) {
            sumXX += p.x * p.x;
            sumYY += p.y * p.y;
            sumXY += p.x * p.y;
        }
       
        const angle = 0.5 * Math.atan2(2 * sumXY, sumXX - sumYY);
        return angle;
    }

    // Сравнение топологии (соседних отношений)
    compareTopology(points1, points2) {
        if (points1.length < 3 || points2.length < 3) return 0.5;
       
        // Строим графы смежности
        const graph1 = this.buildAdjacencyGraph(points1);
        const graph2 = this.buildAdjacencyGraph(points2);
       
        // Сравниваем степени вершин
        const degrees1 = this.getDegreeDistribution(graph1);
        const degrees2 = this.getDegreeDistribution(graph2);
       
        // Нормализуем и сравниваем
        const maxDegree1 = Math.max(...degrees1) || 1;
        const maxDegree2 = Math.max(...degrees2) || 1;
       
        const normalized1 = degrees1.map(d => d / maxDegree1);
        const normalized2 = degrees2.map(d => d / maxDegree2);
       
        // Гистограмма степеней
        const hist1 = this.createHistogram(normalized1, 5);
        const hist2 = this.createHistogram(normalized2, 5);
       
        // Сравниваем гистограммы
        let similarity = 0;
        for (let i = 0; i < 5; i++) {
            const diff = Math.abs(hist1[i] - hist2[i]);
            similarity += 0.2 * Math.max(0, 1 - diff);
        }
       
        return similarity;
    }

    buildAdjacencyGraph(points) {
        const graph = new Array(points.length).fill().map(() => []);
        const k = Math.min(3, points.length - 1); // Количество ближайших соседей
       
        for (let i = 0; i < points.length; i++) {
            // Находим k ближайших соседей
            const distances = [];
            for (let j = 0; j < points.length; j++) {
                if (i === j) continue;
                const dx = points[i].x - points[j].x;
                const dy = points[i].y - points[j].y;
                distances.push({ index: j, distance: Math.sqrt(dx * dx + dy * dy) });
            }
           
            distances.sort((a, b) => a.distance - b.distance);
           
            // Добавляем ребра к k ближайшим соседям
            for (let n = 0; n < Math.min(k, distances.length); n++) {
                graph[i].push(distances[n].index);
                graph[distances[n].index].push(i); // Ненаправленный граф
            }
        }
       
        return graph;
    }

    getDegreeDistribution(graph) {
        return graph.map(neighbors => neighbors.length);
    }

    createHistogram(data, bins) {
        const histogram = new Array(bins).fill(0);
       
        for (const value of data) {
            const bin = Math.min(bins - 1, Math.floor(value * bins));
            histogram[bin]++;
        }
       
        // Нормализуем
        const total = data.length || 1;
        return histogram.map(h => h / total);
    }

    // Дополнительный метод: поиск точных совпадений точек
    findPointMatches(points1, points2, threshold = 0.1) {
        const matches = [];
        const used2 = new Set();
       
        // Для каждой точки в points1 ищем ближайшую в points2
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
           
            if (bestMatch && minDistance < threshold) {
                matches.push({
                    point1: points1[i],
                    point2: bestMatch,
                    distance: minDistance
                });
                used2.add(bestIndex);
            }
        }
       
        return matches;
    }
}

// 📊 ТЕСТОВЫЙ РАННЕР
class EnhancedTestRunner {
    constructor() {
        this.generator = new EnhancedDataGenerator();
        this.analyzer = new EnhancedAnalyzer();
        this.results = [];
    }

    async runComprehensiveTests() {
        console.log('🧪 ЗАПУСК УСОВЕРШЕНСТВОВАННЫХ ТЕСТОВ\n');

        const tests = [
            {
                name: 'Один и тот же след',
                points1: () => this.generator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: (points1) => JSON.parse(JSON.stringify(points1)),
                expected: { min: 85, max: 95 }
            },
            {
                name: 'Похожая обувь (нормальная vs широкая)',
                points1: () => this.generator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: () => this.generator.createRealisticFootprint('wide', { pointCount: 32 }),
                expected: { min: 65, max: 80 }
            },
            {
                name: 'Разная обувь (нормальная vs узкая)',
                points1: () => this.generator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: () => this.generator.createRealisticFootprint('narrow', { pointCount: 38 }),
                expected: { min: 40, max: 60 }
            },
            {
                name: 'Поворот 45°',
                points1: () => this.generator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: (points1) => this.generator.rotatePoints(points1, 45, 400, 300),
                expected: { min: 80, max: 95 }
            },
            {
                name: 'Масштаб 0.8x',
                points1: () => this.generator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: (points1) => this.generator.transformPoints(points1, { scale: 0.8 }),
                expected: { min: 75, max: 90 }
            },
            {
                name: 'С шумом ±10px',
                points1: () => this.generator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: (points1) => this.generator.addGaussianNoise(points1, 10),
                expected: { min: 70, max: 85 }
            },
            {
                name: 'Смещение +30,+20',
                points1: () => this.generator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: (points1) => this.generator.transformPoints(points1, { offsetX: 30, offsetY: 20 }),
                expected: { min: 80, max: 95 }
            },
            {
                name: 'Комбинированная трансформация',
                points1: () => this.generator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: (points1) => this.generator.transformPoints(points1, {
                    angle: 30,
                    scale: 1.2,
                    offsetX: 20,
                    offsetY: -15,
                    noise: 5
                }),
                expected: { min: 70, max: 85 }
            },
            {
                name: 'Сильно разные следы',
                points1: () => this.generator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: () => this.generator.createRealisticFootprint('long', {
                    pointCount: 36,
                    centerX: 450,
                    centerY: 350
                }),
                expected: { min: 20, max: 40 }
            }
        ];

        for (const test of tests) {
            console.log(`\n🎯 ТЕСТ: ${test.name}`);
           
            // Генерируем точки
            const points1 = test.points1();
            const points2 = typeof test.points2 === 'function' && test.points2.length === 1
                ? test.points2(points1)
                : test.points2();
           
            console.log(`👣 Создан след: ${points1.length} точек`);
            console.log(`👣 Создан след: ${points2.length} точек`);

            // Выполняем сравнение
            const result = this.analyzer.compareStructured(points1, points2);
           
            // Находим точные совпадения точек
            const matches = this.analyzer.findPointMatches(
                result.alignedPoints1 || points1,
                result.alignedPoints2 || points2,
                0.15
            );
           
            // Анализируем результаты
            const score = result.score;
            const isInRange = score >= test.expected.min && score <= test.expected.max;
            const matchPercentage = points1.length > 0 ? (matches.length / points1.length * 100) : 0;
           
            // Определяем решение
            let decision = 'Не определено';
            if (score >= 85) decision = 'Одна и та же обувь';
            else if (score >= 65) decision = 'Похожая обувь';
            else if (score >= 40) decision = 'Возможно похожая';
            else decision = 'Разная обувь';
           
            console.log(`\n📊 РЕЗУЛЬТАТЫ СРАВНЕНИЯ:`);
            console.log(`   • Структурное сходство: ${score.toFixed(1)}%`);
            console.log(`   • Точечные совпадения: ${matchPercentage.toFixed(1)}% (${matches.length}/${points1.length})`);
            console.log(`   • Форма: ${(result.details.shape * 100).toFixed(1)}%`);
            console.log(`   • Распределение: ${(result.details.distribution * 100).toFixed(1)}%`);
            console.log(`   • Плотность: ${(result.details.density * 100).toFixed(1)}%`);
            console.log(`   • Ориентация: ${(result.details.orientation * 100).toFixed(1)}%`);
            console.log(`   • Топология: ${(result.details.topology * 100).toFixed(1)}%`);
            console.log(`   🎯 ИТОГО: ${score.toFixed(1)}%`);
            console.log(`   🤔 РЕШЕНИЕ: ${decision}`);
           
            // Визуализация
            this.visualizeComparison(points1, points2, matches);
           
            // Сохраняем результат
            this.results.push({
                name: test.name,
                score,
                expected: test.expected,
                inRange: isInRange,
                decision,
                matchPercentage,
                details: result.details
            });
           
            console.log(`\n${isInRange ? '✅' : '❌'} ${test.name}: ${score.toFixed(1)}% (ожидалось ${test.expected.min}-${test.expected.max}%)`);
            console.log(`   Статус: ${isInRange ? 'В пределах ожиданий' : 'Вне ожиданий'}`);
        }
       
        // Сводный отчет
        this.generateSummaryReport();
    }

    visualizeComparison(points1, points2, matches) {
        // Простая ASCII визуализация
        const gridSize = 40;
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
       
        // Сначала отмечаем совпадения
        matches.forEach(match => {
            const pos1 = toGrid(match.point1.x, match.point1.y);
            const pos2 = toGrid(match.point2.x, match.point2.y);
           
            // Средняя позиция
            const avgX = Math.floor((pos1.x + pos2.x) / 2);
            const avgY = Math.floor((pos1.y + pos2.y) / 2);
           
            if (avgX >= 0 && avgX < gridSize && avgY >= 0 && avgY < gridSize) {
                grid[avgY][avgX] = '●';
            }
        });
       
        // Затем отмечаем остальные точки
        points1.forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridSize && pos.y >= 0 && pos.y < gridSize) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = 'O';
                }
            }
        });
       
        points2.forEach(point => {
            const pos = toGrid(point.x, point.y);
            if (pos.x >= 0 && pos.x < gridSize && pos.y >= 0 && pos.y < gridSize) {
                if (grid[pos.y][pos.x] === ' ') {
                    grid[pos.y][pos.x] = 'X';
                }
            }
        });
       
        // Выводим
        console.log('\n📊 ВИЗУАЛИЗАЦИЯ:');
        console.log('Легенда: ●=совпадение, O=первый след, X=второй след');
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

    generateSummaryReport() {
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ:');
        console.log('='.repeat(60));
       
        let passed = 0;
        this.results.forEach(result => {
            const status = result.inRange ? '✅' : '❌';
            if (result.inRange) passed++;
           
            console.log(`${status} ${result.name}: ${result.score.toFixed(1)}% (ожидалось ${result.expected.min}-${result.expected.max}%)`);
            console.log(`   Решение: ${result.decision}, Совпадения: ${result.matchPercentage.toFixed(1)}%`);
        });
       
        const total = this.results.length;
        const percentage = (passed / total * 100).toFixed(1);
       
        console.log(`\n🎯 ИТОГО: ${passed}/${total} тестов пройдено (${percentage}%)`);
       
        if (passed >= total * 0.8) {
            console.log('✅ Алгоритм работает хорошо! Можно интегрировать в систему.');
        } else if (passed >= total * 0.6) {
            console.log('⚠️ Алгоритм требует небольшой доработки.');
        } else {
            console.log('❌ Требуется серьезная доработка алгоритма.');
        }
       
        // Рекомендации
        console.log('\n💡 РЕКОМЕНДАЦИИ:');
        console.log('='.repeat(60));
       
        if (passed < total) {
            const failedTests = this.results.filter(r => !r.inRange);
            console.log('Проблемные тесты:');
            failedTests.forEach(test => {
                console.log(`   • ${test.name}: ${test.score.toFixed(1)}% вместо ${test.expected.min}-${test.expected.max}%`);
                console.log(`     Проблема: ${test.score < test.expected.min ? 'слишком низкий результат' : 'слишком высокий результат'}`);
            });
           
            console.log('\n🔧 Рекомендуемые улучшения:');
            console.log('   1. Настройте весовые коэффициенты в compareStructured()');
            console.log('   2. Добавьте нормализацию по количеству точек');
            console.log('   3. Улучшите обработку выбросов');
            console.log('   4. Добавьте анализ частных признаков (особые точки)');
        } else {
            console.log('🎉 Алгоритм готов к использованию!');
            console.log('🚀 Для внедрения в систему:');
            console.log('   1. Импортируйте класс EnhancedAnalyzer');
            console.log('   2. Используйте метод compareStructured() для сравнения');
            console.log('   3. Пороговые значения для решений:');
            console.log('      - ≥85%: Одна и та же обувь');
            console.log('      - 65-84%: Похожая обувь');
            console.log('      - 40-64%: Возможно похожая');
            console.log('      - <40%: Разная обувь');
        }
       
        return this.results;
    }
}

// 🚀 ЗАПУСК ТЕСТОВ
async function main() {
    console.log('🎯 УСОВЕРШЕНСТВОВАННЫЙ ТЕСТ СТРУКТУРНОГО СРАВНЕНИЯ\n');
    console.log('📚 Используется PCA и статистический анализ\n');
   
    try {
        const testRunner = new EnhancedTestRunner();
        await testRunner.runComprehensiveTests();
       
        console.log('\n🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!');
       
    } catch (error) {
        console.error(`❌ Ошибка: ${error.message}`);
        console.error(error.stack);
    }
}

// Установите зависимости перед запуском:
// npm install ml-matrix

// Запуск теста
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    EnhancedDataGenerator,
    EnhancedAnalyzer,
    EnhancedTestRunner
};
