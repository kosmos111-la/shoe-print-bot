// test-enhanced-comparison-fixed.js
console.log('🎯 УСОВЕРШЕНСТВОВАННЫЙ ТЕСТ С БИБЛИОТЕКАМИ - ИСПРАВЛЕННЫЙ\n');

// Подключаем библиотеки
try {
    const { Matrix, PCA } = require('ml-matrix');
    console.log('✅ Подключена библиотека ml-matrix');
} catch (error) {
    console.log('❌ Не удалось подключить ml-matrix. Используем fallback.');
}

// 🔧 УЛУЧШЕННЫЙ ГЕНЕРАТОР ДАННЫХ
class EnhancedDataGenerator {
    // Статический метод для создания реалистичных следов
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
            long: { length: 280, width: 95, heelWidth: 75 },
            small: { length: 200, width: 80, heelWidth: 60 }
        }[type] || { length: 250, width: 100, heelWidth: 80 };

        const { length, width, heelWidth } = params;

        // Определяем количество точек
        const targetCount = pointCount || Math.floor(20 + Math.random() * 20);

        // Создаем контур следа
        const contourPoints = this.createContour(centerX, centerY, length * scale, width * scale, Math.floor(targetCount * 0.6));
        points.push(...contourPoints);

        // Создаем внутренние точки (протектор)
        const innerPoints = this.createInnerPattern(centerX, centerY, length * scale, width * scale, heelWidth * scale, Math.floor(targetCount * 0.4));
        points.push(...innerPoints);

        // Если нужно добавить случайные точки
        if (points.length < targetCount) {
            const remaining = targetCount - points.length;
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
        if (count < 4) count = 4; // Минимум 4 точки для контура
       
        for (let i = 0; i < count; i++) {
            const t = i / count;
            const angle = t * 2 * Math.PI;
           
            // Эллиптическая форма с асимметрией (как настоящий след)
            const x = centerX + Math.cos(angle) * width / 2;
            // Более реалистичная форма: пятка уже, носок шире
            const yMultiplier = angle > Math.PI ? 0.9 : 1.1; // Носок немного выше
            const y = centerY + Math.sin(angle) * length / 2 * yMultiplier * (1 - 0.2 * Math.cos(2 * angle));
           
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
        if (count <= 0) return points;
       
        // Случайные внутренние точки в разных зонах
        for (let i = 0; i < count; i++) {
            // Выбираем случайную зону
            const zone = Math.random();
            let x, y;
           
            if (zone < 0.3) { // Пятка
                x = centerX + (Math.random() - 0.5) * heelWidth * 0.6;
                y = centerY - length * 0.3 + (Math.random() - 0.5) * heelWidth * 0.4;
            } else if (zone < 0.7) { // Середина
                x = centerX + (Math.random() - 0.5) * width * 0.4;
                y = centerY + (Math.random() - 0.5) * length * 0.2;
            } else { // Носок
                x = centerX + (Math.random() - 0.5) * width * 0.5;
                y = centerY + length * 0.3 + (Math.random() - 0.5) * width * 0.3;
            }
           
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                type: 'inner',
                id: `i_${i}`
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
                originalId: point.id,
                id: `${point.id}_t`
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
            const { Matrix, PCA } = require('ml-matrix');
            this.usePCA = true;
            console.log('✅ Анализатор использует PCA');
        } catch (e) {
            console.log('⚠️ Анализатор использует упрощенные методы');
        }
    }

    // Основной метод сравнения
    compareStructured(points1, points2) {
        // 1. Предварительная проверка
        if (points1.length < 3 || points2.length < 3) {
            return {
                score: 0,
                details: {
                    shape: 0,
                    distribution: 0,
                    density: 0,
                    orientation: 0,
                    topology: 0
                }
            };
        }

        // 2. Выравнивание
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
        totalScore *= (0.7 + 0.3 * countRatio);

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
            const { Matrix } = require('ml-matrix');
           
            // Преобразуем точки в матрицу
            const data = points.map(p => [p.x, p.y]);
            const matrix = new Matrix(data);
           
            // Центрируем данные
            const meanX = matrix.mean('column')[0];
            const meanY = matrix.mean('column')[1];
            const centered = matrix.subRowVector([meanX, meanY]);
           
            // Ковариационная матрица
            const covariance = centered.transpose().mmul(centered).div(points.length - 1);
           
            // Собственные значения и векторы (упрощенный расчет)
            const a = covariance.get(0, 0);
            const b = covariance.get(0, 1);
            const c = covariance.get(1, 1);
           
            const trace = a + c;
            const determinant = a * c - b * b;
           
            const eigenvalue1 = trace / 2 + Math.sqrt(Math.pow(trace / 2, 2) - determinant);
            const eigenvalue2 = trace / 2 - Math.sqrt(Math.pow(trace / 2, 2) - determinant);
           
            // Главный собственный вектор
            let principalVector;
            if (Math.abs(b) > 0.0001) {
                principalVector = [eigenvalue1 - c, b];
            } else {
                principalVector = eigenvalue1 > eigenvalue2 ? [1, 0] : [0, 1];
            }
           
            // Нормализуем вектор
            const length = Math.sqrt(principalVector[0] * principalVector[0] + principalVector[1] * principalVector[1]);
            principalVector[0] /= length;
            principalVector[1] /= length;
           
            // Вычисляем угол поворота
            let angle = Math.atan2(principalVector[1], principalVector[0]);
           
            // Поворачиваем точки так, чтобы главная ось была горизонтальной
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

    compareShape(points1, points2) {
        const moments1 = this.calculateMoments(points1);
        const moments2 = this.calculateMoments(points2);
       
        let similarity = 0;
        const weights = [0.4, 0.3, 0.2, 0.1];
       
        for (let i = 0; i < Math.min(moments1.length, moments2.length, weights.length); i++) {
            const diff = Math.abs(moments1[i] - moments2[i]);
            similarity += weights[i] * Math.max(0, 1 - diff);
        }
       
        return similarity;
    }

    calculateMoments(points) {
        if (points.length === 0) return [0, 0, 0, 0];
       
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        let m00 = points.length;
        let m20 = 0, m02 = 0, m11 = 0;
       
        for (const p of points) {
            const x = p.x - centerX;
            const y = p.y - centerY;
           
            m20 += x * x;
            m02 += y * y;
            m11 += x * y;
        }
       
        const n20 = m20 / m00;
        const n02 = m02 / m00;
        const n11 = m11 / m00;
       
        const I1 = n20 + n02;
        const I2 = Math.pow(n20 - n02, 2) + 4 * Math.pow(n11, 2);
        const I3 = Math.pow(n20 + n02, 2) - 4 * Math.pow(n11, 2);
       
        return [I1, I2, I3, Math.sqrt(m20 * m02)];
    }

    compareDistribution(points1, points2) {
        const quadrants1 = this.getQuadrantDistribution(points1);
        const quadrants2 = this.getQuadrantDistribution(points2);
       
        let similarity = 0;
        for (let i = 0; i < 4; i++) {
            const diff = Math.abs(quadrants1[i] - quadrants2[i]);
            similarity += 0.25 * Math.max(0, 1 - diff * 2);
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
       
        const total = points.length || 1;
        return quadrants.map(q => q / total);
    }

    compareDensity(points1, points2) {
        const density1 = this.calculateDensity(points1);
        const density2 = this.calculateDensity(points2);
       
        if (density1 === 0 || density2 === 0) return 0;
       
        const ratio = Math.min(density1, density2) / Math.max(density1, density2);
        return ratio;
    }

    calculateDensity(points) {
        if (points.length < 2) return 0;
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const width = Math.max(...xs) - Math.min(...xs) || 1;
        const height = Math.max(...ys) - Math.min(...ys) || 1;
       
        return points.length / (width * height);
    }

    compareOrientation(points1, points2) {
        const angle1 = this.getDominantAngle(points1);
        const angle2 = this.getDominantAngle(points2);
       
        const angleDiff = Math.abs(angle1 - angle2) % (Math.PI / 2);
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
       
        return 0.5 * Math.atan2(2 * sumXY, sumXX - sumYY);
    }

    compareTopology(points1, points2) {
        if (points1.length < 3 || points2.length < 3) return 0.5;
       
        // Простое сравнение через распределение расстояний
        const distances1 = this.getDistanceDistribution(points1);
        const distances2 = this.getDistanceDistribution(points2);
       
        // Нормализуем распределения
        const maxDist1 = Math.max(...distances1) || 1;
        const maxDist2 = Math.max(...distances2) || 1;
       
        const normalized1 = distances1.map(d => d / maxDist1);
        const normalized2 = distances2.map(d => d / maxDist2);
       
        // Сравниваем через корреляцию
        let similarity = 0;
        const minLength = Math.min(normalized1.length, normalized2.length);
       
        for (let i = 0; i < minLength; i++) {
            const diff = Math.abs(normalized1[i] - normalized2[i]);
            similarity += Math.max(0, 1 - diff);
        }
       
        return minLength > 0 ? similarity / minLength : 0.5;
    }

    getDistanceDistribution(points) {
        const distances = [];
       
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dx = points[i].x - points[j].x;
                const dy = points[i].y - points[j].y;
                distances.push(Math.sqrt(dx * dx + dy * dy));
            }
        }
       
        distances.sort((a, b) => a - b);
        return distances.slice(0, Math.min(20, distances.length)); // Берем 20 ближайших расстояний
    }

    // Метод для поиска точных совпадений точек
    findPointMatches(points1, points2, threshold = 0.15) {
        const matches = [];
        const used2 = new Set();
       
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
        this.analyzer = new EnhancedAnalyzer();
        this.results = [];
    }

    async runComprehensiveTests() {
        console.log('🧪 ЗАПУСК УСОВЕРШЕНСТВОВАННЫХ ТЕСТОВ\n');

        const tests = [
            {
                name: 'Один и тот же след',
                points1: () => EnhancedDataGenerator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: (points1) => JSON.parse(JSON.stringify(points1)),
                expected: { min: 85, max: 95 }
            },
            {
                name: 'Похожая обувь (нормальная vs широкая)',
                points1: () => EnhancedDataGenerator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: () => EnhancedDataGenerator.createRealisticFootprint('wide', { pointCount: 32 }),
                expected: { min: 65, max: 80 }
            },
            {
                name: 'Разная обувь (нормальная vs узкая)',
                points1: () => EnhancedDataGenerator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: () => EnhancedDataGenerator.createRealisticFootprint('narrow', { pointCount: 38 }),
                expected: { min: 40, max: 60 }
            },
            {
                name: 'Поворот 45°',
                points1: () => EnhancedDataGenerator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: (points1) => EnhancedDataGenerator.rotatePoints(points1, 45, 400, 300),
                expected: { min: 80, max: 95 }
            },
            {
                name: 'Масштаб 0.8x',
                points1: () => EnhancedDataGenerator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: (points1) => EnhancedDataGenerator.transformPoints(points1, { scale: 0.8 }),
                expected: { min: 75, max: 90 }
            },
            {
                name: 'С шумом ±10px',
                points1: () => EnhancedDataGenerator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: (points1) => EnhancedDataGenerator.addGaussianNoise(points1, 10),
                expected: { min: 70, max: 85 }
            },
            {
                name: 'Смещение +30,+20',
                points1: () => EnhancedDataGenerator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: (points1) => EnhancedDataGenerator.transformPoints(points1, { offsetX: 30, offsetY: 20 }),
                expected: { min: 80, max: 95 }
            },
            {
                name: 'Комбинированная трансформация',
                points1: () => EnhancedDataGenerator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: (points1) => EnhancedDataGenerator.transformPoints(points1, {
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
                points1: () => EnhancedDataGenerator.createRealisticFootprint('normal', { pointCount: 35 }),
                points2: () => EnhancedDataGenerator.createRealisticFootprint('long', {
                    pointCount: 36,
                    centerX: 450,
                    centerY: 350
                }),
                expected: { min: 20, max: 40 }
            }
        ];

        for (const test of tests) {
            console.log(`\n🎯 ТЕСТ: ${test.name}`);
           
            try {
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
                const aligned1 = result.alignedPoints1 || points1;
                const aligned2 = result.alignedPoints2 || points2;
                const matches = this.analyzer.findPointMatches(aligned1, aligned2, 0.15);
               
                // Анализируем результаты
                const score = result.score;
                const isInRange = score >= test.expected.min && score <= test.expected.max;
                const matchPercentage = points1.length > 0 ? (matches.length / Math.min(points1.length, points2.length) * 100) : 0;
               
                // Определяем решение
                let decision = 'Не определено';
                if (score >= 85) decision = '✅ Одна и та же обувь';
                else if (score >= 65) decision = '🟡 Похожая обувь';
                else if (score >= 40) decision = '🟠 Возможно похожая';
                else decision = '❌ Разная обувь';
               
                console.log(`\n📊 РЕЗУЛЬТАТЫ СРАВНЕНИЯ:`);
                console.log(`   • Структурное сходство: ${score.toFixed(1)}%`);
                console.log(`   • Точечные совпадения: ${matchPercentage.toFixed(1)}% (${matches.length}/${Math.min(points1.length, points2.length)})`);
                console.log(`   • Форма: ${(result.details.shape * 100).toFixed(1)}%`);
                console.log(`   • Распределение: ${(result.details.distribution * 100).toFixed(1)}%`);
                console.log(`   • Плотность: ${(result.details.density * 100).toFixed(1)}%`);
                console.log(`   • Ориентация: ${(result.details.orientation * 100).toFixed(1)}%`);
                console.log(`   • Топология: ${(result.details.topology * 100).toFixed(1)}%`);
                console.log(`   🎯 ИТОГО: ${score.toFixed(1)}%`);
                console.log(`   🤔 РЕШЕНИЕ: ${decision}`);
               
                // Простая визуализация
                this.visualizeSimple(points1, points2, matches);
               
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

    visualizeSimple(points1, points2, matches) {
        // Простая текстовая визуализация
        console.log('\n📊 ПРОСТАЯ ВИЗУАЛИЗАЦИЯ:');
        console.log(`   Всего точек: ${points1.length} vs ${points2.length}`);
        console.log(`   Совпадений: ${matches.length}`);
       
        if (matches.length > 0) {
            const avgDistance = matches.reduce((sum, m) => sum + m.distance, 0) / matches.length;
            console.log(`   Среднее расстояние: ${avgDistance.toFixed(3)}`);
        }
       
        // Показываем несколько примеров совпадений
        if (matches.length > 0) {
            console.log('   Примеры совпадений:');
            for (let i = 0; i < Math.min(3, matches.length); i++) {
                const match = matches[i];
                console.log(`     ${i+1}. Расстояние: ${match.distance.toFixed(3)}`);
            }
        }
    }

    generateSummaryReport() {
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ:');
        console.log('='.repeat(60));
       
        let passed = 0;
        let totalScore = 0;
       
        this.results.forEach((result, index) => {
            const status = result.inRange ? '✅' : '❌';
            if (result.inRange) passed++;
            totalScore += result.score || 0;
           
            const scoreStr = result.score !== undefined ? `${result.score.toFixed(1)}%` : 'ОШИБКА';
            console.log(`${index + 1}. ${status} ${result.name}: ${scoreStr} (ожидалось ${result.expected.min}-${result.expected.max}%)`);
           
            if (result.decision) {
                console.log(`   Решение: ${result.decision}`);
            }
            if (result.error) {
                console.log(`   Ошибка: ${result.error}`);
            }
        });
       
        const total = this.results.length;
        const percentage = total > 0 ? (passed / total * 100).toFixed(1) : '0.0';
        const avgScore = total > 0 ? (totalScore / total).toFixed(1) : '0.0';
       
        console.log(`\n🎯 ИТОГО: ${passed}/${total} тестов пройдено (${percentage}%)`);
        console.log(`📊 Средний результат: ${avgScore}%`);
       
        if (passed >= total * 0.8) {
            console.log('\n✅ АЛГОРИТМ РАБОТАЕТ ОТЛИЧНО! Можно интегрировать в систему.');
            this.showIntegrationGuide();
        } else if (passed >= total * 0.6) {
            console.log('\n⚠️ Алгоритм работает удовлетворительно, требует небольшой настройки.');
            this.showImprovements();
        } else {
            console.log('\n❌ Алгоритм требует серьезной доработки.');
            this.showImprovements();
        }
    }

    showIntegrationGuide() {
        console.log('\n🚀 РУКОВОДСТВО ПО ИНТЕГРАЦИИ В СИСТЕМУ:');
        console.log('='.repeat(60));
        console.log('1. Скопируйте классы EnhancedDataGenerator и EnhancedAnalyzer в ваш проект');
        console.log('2. Используйте метод compareStructured() для сравнения двух следов:');
        console.log('');
        console.log('   const analyzer = new EnhancedAnalyzer();');
        console.log('   const result = analyzer.compareStructured(points1, points2);');
        console.log('   ');
        console.log('   if (result.score >= 85) {');
        console.log('       console.log("✅ Одна и та же обувь");');
        console.log('   } else if (result.score >= 65) {');
        console.log('       console.log("🟡 Похожая обувь");');
        console.log('   } else if (result.score >= 40) {');
        console.log('       console.log("🟠 Возможно похожая");');
        console.log('   } else {');
        console.log('       console.log("❌ Разная обувь");');
        console.log('   }');
        console.log('');
        console.log('3. Для поиска точных совпадений точек используйте:');
        console.log('   const matches = analyzer.findPointMatches(points1, points2, 0.15);');
        console.log('');
        console.log('4. Установите зависимость в package.json:');
        console.log('   "dependencies": {');
        console.log('     "ml-matrix": "^6.11.0"');
        console.log('   }');
    }

    showImprovements() {
        console.log('\n🔧 РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ:');
        console.log('='.repeat(60));
       
        const failedTests = this.results.filter(r => !r.inRange);
       
        if (failedTests.length > 0) {
            console.log('Проблемные тесты:');
            failedTests.forEach(test => {
                if (test.score !== undefined) {
                    const issue = test.score < test.expected.min ? 'слишком низкий' : 'слишком высокий';
                    console.log(`   • ${test.name}: ${test.score.toFixed(1)}% вместо ${test.expected.min}-${test.expected.max}% (${issue})`);
                }
            });
        }
       
        console.log('\nВозможные улучшения:');
        console.log('   1. Настройте весовые коэффициенты в compareStructured()');
        console.log('   2. Добавьте нормализацию по количеству точек');
        console.log('   3. Улучшите PCA-выравнивание');
        console.log('   4. Добавьте анализ особых точек (ключевых признаков)');
        console.log('   5. Используйте machine learning для обучения порогов');
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

// Запуск теста
if (require.main === module) {
    main().catch(console.error);
}

// Экспорт для использования в других модулях
module.exports = {
    EnhancedDataGenerator,
    EnhancedAnalyzer,
    EnhancedTestRunner
};
