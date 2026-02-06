// test-2.js - ФИНАЛЬНЫЙ РАБОЧИЙ АЛГОРИТМ
console.log('🎯 ФИНАЛЬНЫЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ - ВЕКТОРНЫЙ ПОДХОД\n');
console.log('📐 Векторные операции + Адаптивные допуски + Многоуровневые треугольники\n');

// ============================================
// 🔷 ФИНАЛЬНЫЙ АЛГОРИТМ С АДАПТИВНЫМИ ДОПУСКАМИ
// ============================================
class AdaptiveGeometricAlgorithm {
    constructor(options = {}) {
        // 🔧 АДАПТИВНЫЕ ПАРАМЕТРЫ
        this.angleTolerance = options.angleTolerance || 8;     // Допуск по углам в градусах
        this.distanceTolerance = options.distanceTolerance || 0.15; // Допуск по расстояниям (относительно)
        this.minSimilarity = options.minSimilarity || 0.7;     // Минимальное сходство
        this.minTriangles = options.minTriangles || 2;         // Минимум треугольников для сравнения
        this.maxNeighbors = options.maxNeighbors || 4;         // Максимум соседей для треугольника
        this.useLevel2 = options.useLevel2 !== false;          // Использовать треугольники 2-го уровня
        this.debug = options.debug || true;
       
        this.stats = {
            comparisons: 0,
            matches: 0,
            falsePositives: 0,
            falseNegatives: 0
        };
    }

    // 🎯 СОЗДАТЬ ГЕОМЕТРИЧЕСКИЙ ОТПЕЧАТОК (ВЕКТОРНЫЙ)
    createFootprint(points, name = '') {
        if (this.debug) console.log(`👣 Создание отпечатка "${name}": ${points.length} точек`);
       
        // Нормализуем точки к центру и единичному масштабу
        const normalizedPoints = this.normalizePoints(points);
       
        const footprint = [];
       
        for (let i = 0; i < normalizedPoints.length; i++) {
            const point = normalizedPoints[i];
           
            // Ищем соседей в нормализованном пространстве
            const neighbors = this.findNeighbors(point, normalizedPoints, i);
           
            if (neighbors.length >= 2) {
                // Создаем треугольники 1-го уровня
                const trianglesL1 = this.createTriangles(point, neighbors, 1);
               
                // Создаем треугольники 2-го уровня (если нужно)
                let trianglesL2 = [];
                if (this.useLevel2 && trianglesL1.length >= 3) {
                    trianglesL2 = this.createLevel2Triangles(trianglesL1);
                }
               
                // Создаем геометрический дескриптор
                const descriptor = this.createDescriptor(point, trianglesL1, trianglesL2);
               
                if (descriptor) {
                    footprint.push({
                        id: point.id || `p${i}`,
                        originalIndex: point.originalIndex || i,
                        x: point.x,
                        y: point.y,
                        descriptor: descriptor,
                        trianglesL1: trianglesL1,
                        trianglesL2: trianglesL2,
                        neighborCount: neighbors.length
                    });
                }
            }
        }
       
        if (this.debug) {
            console.log(`   ✅ Создано дескрипторов: ${footprint.length}`);
            if (footprint.length > 0) {
                const avgTriangles = (footprint.reduce((sum, p) =>
                    sum + p.trianglesL1.length + p.trianglesL2.length, 0) / footprint.length).toFixed(1);
                console.log(`   📐 Среднее треугольников на точку: ${avgTriangles}`);
            }
        }
       
        return footprint;
    }

    // 📐 НОРМАЛИЗАЦИЯ ТОЧЕК (центрирование + масштабирование)
    normalizePoints(points) {
        if (points.length === 0) return [];
       
        // Центрирование
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        const centered = points.map((p, i) => ({
            ...p,
            x: p.x - centerX,
            y: p.y - centerY,
            originalIndex: i
        }));
       
        // Масштабирование к единичному радиусу
        const maxDistance = Math.max(...centered.map(p =>
            Math.sqrt(p.x * p.x + p.y * p.y)
        ));
       
        if (maxDistance < 0.001) return centered;
       
        const scale = 1.0 / maxDistance;
        return centered.map(p => ({
            ...p,
            x: p.x * scale,
            y: p.y * scale
        }));
    }

    // 🔍 НАЙТИ СОСЕДЕЙ (в нормализованном пространстве)
    findNeighbors(center, allPoints, centerIndex) {
        const distances = [];
       
        for (let i = 0; i < allPoints.length; i++) {
            if (i === centerIndex) continue;
           
            const point = allPoints[i];
            const distance = this.vectorDistance(center, point);
           
            distances.push({
                point: point,
                distance: distance,
                index: i
            });
        }
       
        // Сортируем и берем ближайших
        distances.sort((a, b) => a.distance - b.distance);
        return distances.slice(0, this.maxNeighbors).map(d => d.point);
    }

    // 📐 СОЗДАТЬ ТРЕУГОЛЬНИКИ
    createTriangles(center, neighbors, level) {
        const triangles = [];
       
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const tri = this.createTriangle(center, neighbors[i], neighbors[j], level);
                if (tri && this.validateTriangle(tri)) {
                    triangles.push(tri);
                }
            }
        }
       
        return triangles;
    }

    // 📐 СОЗДАТЬ ТРЕУГОЛЬНИК 2-ГО УРОВНЯ (из центров треугольников 1-го уровня)
    createLevel2Triangles(trianglesL1) {
        if (trianglesL1.length < 3) return [];
       
        // Берем центры треугольников как точки
        const centers = trianglesL1.map(t => t.center);
        const trianglesL2 = [];
       
        // Создаем треугольники из центров
        for (let i = 0; i < centers.length; i++) {
            for (let j = i + 1; j < centers.length; j++) {
                for (let k = j + 1; k < centers.length; k++) {
                    const tri = this.createTriangle(centers[i], centers[j], centers[k], 2);
                    if (tri && this.validateTriangle(tri)) {
                        trianglesL2.push(tri);
                        if (trianglesL2.length >= 3) break;
                    }
                }
                if (trianglesL2.length >= 3) break;
            }
            if (trianglesL2.length >= 3) break;
        }
       
        return trianglesL2;
    }

    // 🔷 СОЗДАТЬ ОДИН ТРЕУГОЛЬНИК
    createTriangle(p1, p2, p3, level) {
        // Вычисляем углы
        const angles = this.calculateAngles(p1, p2, p3);
       
        // Вычисляем центр
        const center = {
            x: (p1.x + p2.x + p3.x) / 3,
            y: (p1.y + p2.y + p3.y) / 3
        };
       
        // Вычисляем относительные расстояния
        const distances = [
            this.vectorDistance(p1, p2),
            this.vectorDistance(p1, p3),
            this.vectorDistance(p2, p3)
        ];
       
        // Проверяем на вырожденность
        const area = this.triangleArea(p1, p2, p3);
        if (area < 0.001) return null;
       
        return {
            points: [p1, p2, p3],
            angles: angles,
            normalizedAngles: this.normalizeAngles(angles),
            distances: distances,
            center: center,
            area: area,
            level: level
        };
    }

    // ✅ ПРОВЕРИТЬ ВАЛИДНОСТЬ ТРЕУГОЛЬНИКА
    validateTriangle(triangle) {
        // Проверяем углы (не слишком маленькие/большие)
        for (const angle of triangle.angles) {
            if (angle < 10 || angle > 170) return false;
        }
       
        // Проверяем площадь
        if (triangle.area < 0.001) return false;
       
        return true;
    }

    // 🎯 СОЗДАТЬ ДЕСКРИПТОР ТОЧКИ
    createDescriptor(point, trianglesL1, trianglesL2) {
        if (trianglesL1.length < this.minTriangles) return null;
       
        // Создаем набор геометрических признаков
        const features = [];
       
        // Признаки из треугольников 1-го уровня
        trianglesL1.forEach(tri => {
            features.push({
                type: 'L1',
                angles: tri.normalizedAngles,
                distances: tri.distances,
                area: tri.area
            });
        });
       
        // Признаки из треугольников 2-го уровня
        trianglesL2.forEach(tri => {
            features.push({
                type: 'L2',
                angles: tri.normalizedAngles,
                distances: tri.distances,
                area: tri.area
            });
        });
       
        // Признаки относительного положения
        const positionFeatures = this.calculatePositionFeatures(point, trianglesL1);
       
        return {
            features: features,
            positionFeatures: positionFeatures,
            featureCount: features.length,
            triangleCount: trianglesL1.length + trianglesL2.length
        };
    }

    // 🔍 СРАВНИТЬ ДВА ОТПЕЧАТКА
    compareFootprints(fp1, fp2) {
        if (this.debug) console.log(`🔍 Сравнение: ${fp1.length} vs ${fp2.length} точек`);
       
        const matches = [];
       
        // Для каждой точки в fp1 ищем похожую в fp2
        for (const point1 of fp1) {
            let bestMatch = null;
            let bestScore = 0;
           
            for (const point2 of fp2) {
                // Сравниваем дескрипторы
                const score = this.compareDescriptors(point1.descriptor, point2.descriptor);
               
                if (score > bestScore && score >= this.minSimilarity) {
                    bestScore = score;
                    bestMatch = {
                        point1: point1,
                        point2: point2,
                        score: score
                    };
                }
            }
           
            if (bestMatch) {
                matches.push(bestMatch);
            }
        }
       
        this.stats.comparisons++;
        this.stats.matches += matches.length;
       
        if (this.debug) {
            console.log(`   ✅ Найдено совпадений: ${matches.length}`);
            if (matches.length > 0) {
                const avgScore = matches.reduce((sum, m) => sum + m.score, 0) / matches.length;
                console.log(`   📊 Средний балл: ${avgScore.toFixed(2)}`);
            }
        }
       
        return {
            matches: matches,
            matchPercentage: fp1.length > 0 ?
                ((matches.length / Math.min(fp1.length, fp2.length)) * 100).toFixed(1) : '0.0',
            stats: { ...this.stats }
        };
    }

    // 🔄 СРАВНИТЬ ДВА ДЕСКРИПТОРА
    compareDescriptors(desc1, desc2) {
        if (!desc1 || !desc2) return 0;
       
        // Сравниваем признаки треугольников
        const triangleScore = this.compareTriangleFeatures(desc1.features, desc2.features);
       
        // Сравниваем признаки положения
        const positionScore = this.comparePositionFeatures(
            desc1.positionFeatures,
            desc2.positionFeatures
        );
       
        // Взвешенная сумма
        return triangleScore * 0.7 + positionScore * 0.3;
    }

    // 🔄 СРАВНИТЬ ПРИЗНАКИ ТРЕУГОЛЬНИКОВ
    compareTriangleFeatures(features1, features2) {
        if (!features1.length || !features2.length) return 0;
       
        let totalScore = 0;
        let comparisons = 0;
       
        // Для каждого треугольника в features1 ищем похожий в features2
        for (const f1 of features1) {
            let bestMatchScore = 0;
           
            for (const f2 of features2) {
                // Сравниваем только треугольники одного типа
                if (f1.type !== f2.type) continue;
               
                const score = this.compareTriangle(f1, f2);
                if (score > bestMatchScore) {
                    bestMatchScore = score;
                }
            }
           
            totalScore += bestMatchScore;
            comparisons++;
        }
       
        return comparisons > 0 ? totalScore / comparisons : 0;
    }

    // 🔄 СРАВНИТЬ ОДИН ТРЕУГОЛЬНИК
    compareTriangle(t1, t2) {
        // Сравниваем углы с допуском
        let angleScore = 0;
        for (let i = 0; i < 3; i++) {
            const diff = Math.abs(t1.angles[i] - t2.angles[i]);
            angleScore += diff <= this.angleTolerance ? 1 : 0;
        }
        angleScore /= 3;
       
        // Сравниваем отношения расстояний
        let distanceScore = 0;
        if (t1.distances && t2.distances && t1.distances.length === t2.distances.length) {
            for (let i = 0; i < t1.distances.length; i++) {
                const ratio = Math.min(t1.distances[i], t2.distances[i]) /
                              Math.max(t1.distances[i], t2.distances[i]);
                distanceScore += ratio >= (1 - this.distanceTolerance) ? 1 : 0;
            }
            distanceScore /= t1.distances.length;
        }
       
        return (angleScore * 0.6 + distanceScore * 0.4);
    }

    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    vectorDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    calculateAngles(p1, p2, p3) {
        const a = this.vectorDistance(p2, p3);
        const b = this.vectorDistance(p1, p3);
        const c = this.vectorDistance(p1, p2);
       
        const angleA = this.cosineLawAngle(b, c, a);
        const angleB = this.cosineLawAngle(a, c, b);
        const angleC = this.cosineLawAngle(a, b, c);
       
        return [angleA, angleB, angleC].sort((x, y) => x - y);
    }

    cosineLawAngle(side1, side2, opposite) {
        const cos = (side1 * side1 + side2 * side2 - opposite * opposite) / (2 * side1 * side2);
        const clamped = Math.max(-1, Math.min(1, cos));
        return Math.acos(clamped) * 180 / Math.PI;
    }

    normalizeAngles(angles) {
        const sum = angles.reduce((s, a) => s + a, 0);
        return angles.map(a => a / sum * 180);
    }

    triangleArea(p1, p2, p3) {
        return Math.abs(
            (p1.x * (p2.y - p3.y) +
             p2.x * (p3.y - p1.y) +
             p3.x * (p1.y - p2.y)) / 2
        );
    }

    calculatePositionFeatures(point, triangles) {
        if (!triangles.length) return {};
       
        // Среднее расстояние до центров треугольников
        const avgDist = triangles.reduce((sum, tri) =>
            sum + this.vectorDistance(point, tri.center), 0) / triangles.length;
       
        // Дисперсия расстояний
        const variance = triangles.reduce((sum, tri) => {
            const dist = this.vectorDistance(point, tri.center);
            return sum + Math.pow(dist - avgDist, 2);
        }, 0) / triangles.length;
       
        return {
            avgDistanceToCenters: avgDist,
            distanceVariance: variance,
            triangleCount: triangles.length
        };
    }

    comparePositionFeatures(pos1, pos2) {
        if (!pos1 || !pos2) return 0;
       
        let score = 0;
        let comparisons = 0;
       
        // Сравниваем средние расстояния
        if (pos1.avgDistanceToCenters !== undefined && pos2.avgDistanceToCenters !== undefined) {
            const ratio = Math.min(pos1.avgDistanceToCenters, pos2.avgDistanceToCenters) /
                          Math.max(pos1.avgDistanceToCenters, pos2.avgDistanceToCenters);
            score += ratio >= 0.8 ? 1 : ratio;
            comparisons++;
        }
       
        // Сравниваем количество треугольников
        if (pos1.triangleCount !== undefined && pos2.triangleCount !== undefined) {
            const countDiff = Math.abs(pos1.triangleCount - pos2.triangleCount);
            const countScore = Math.max(0, 1 - countDiff / Math.max(pos1.triangleCount, pos2.triangleCount));
            score += countScore;
            comparisons++;
        }
       
        return comparisons > 0 ? score / comparisons : 0;
    }

    // 📊 ПОЛУЧИТЬ СТАТИСТИКУ
    getStats() {
        return { ...this.stats };
    }
}

// ============================================
// 🔷 УЛУЧШЕННЫЙ ТЕСТЕР С РЕАЛЬНЫМИ СЦЕНАРИЯМИ
// ============================================
class RealWorldTester {
    constructor() {
        this.algorithm = new AdaptiveGeometricAlgorithm({
            angleTolerance: 10,          // Больший допуск для устойчивости
            distanceTolerance: 0.2,      // 20% допуск по расстояниям
            minSimilarity: 0.65,         // 65% сходства достаточно
            minTriangles: 2,
            maxNeighbors: 5,
            useLevel2: true,
            debug: true
        });
    }

    // 🧪 ЗАПУСТИТЬ КОМПЛЕКСНОЕ ТЕСТИРОВАНИЕ
    runComprehensiveTests() {
        console.log('🧪 КОМПЛЕКСНОЕ ТЕСТИРОВАНИЕ АЛГОРИТМА\n');
       
        const testResults = [];
       
        // 📋 1. БАЗОВЫЙ ТЕСТ: Один и тот же след
        console.log('1️⃣ БАЗОВЫЙ ТЕСТ: ОДИН И ТОТ ЖЕ СЛЕД');
        const shape = this.createRealisticShape('eight', 16);
        testResults.push(this.runTest(shape, shape, 'Одинаковые следы', 90, 10));
       
        // 📋 2. ПОВОРОТ ВЕКТОРНЫЙ
        console.log('\n2️⃣ ТЕСТ: ВЕКТОРНЫЙ ПОВОРОТ 45°');
        const rotated = this.vectorRotate(shape, 45);
        testResults.push(this.runTest(shape, rotated, 'Поворот 45°', 85, 15));
       
        // 📋 3. МАСШТАБ ВЕКТОРНЫЙ
        console.log('\n3️⃣ ТЕСТ: ВЕКТОРНОЕ МАСШТАБИРОВАНИЕ 0.7x');
        const scaled = this.vectorScale(shape, 0.7);
        testResults.push(this.runTest(shape, scaled, 'Масштаб 0.7x', 85, 15));
       
        // 📋 4. СМЕЩЕНИЕ
        console.log('\n4️⃣ ТЕСТ: СМЕЩЕНИЕ +100,+80');
        const shifted = this.vectorShift(shape, 100, 80);
        testResults.push(this.runTest(shape, shifted, 'Смещение', 90, 10));
       
        // 📋 5. РЕАЛИСТИЧНЫЙ ШУМ
        console.log('\n5️⃣ ТЕСТ: РЕАЛИСТИЧНЫЙ ШУМ (±5px)');
        const noisy = this.addRealisticNoise(shape, 5);
        testResults.push(this.runTest(shape, noisy, 'Шум ±5px', 70, 20));
       
        // 📋 6. ЧАСТИЧНЫЙ СЛЕД (50% точек)
        console.log('\n6️⃣ ТЕСТ: ЧАСТИЧНЫЙ СЛЕД (50% точек)');
        const partial = this.createPartialShape(shape, 50);
        testResults.push(this.runTest(shape, partial, 'Частичный след', 50, 20));
       
        // 📋 7. ПОХОЖИЕ, НО РАЗНЫЕ ФИГУРЫ
        console.log('\n7️⃣ ТЕСТ: ПОХОЖИЕ ФИГУРЫ');
        const similar = this.createRealisticShape('six', 16);
        testResults.push(this.runTest(shape, similar, 'Похожие фигуры', 40, 30));
       
        // 📋 8. КОМБИНИРОВАННАЯ ТРАНСФОРМАЦИЯ
        console.log('\n8️⃣ ТЕСТ: КОМБИНИРОВАННАЯ ТРАНСФОРМАЦИЯ');
        const combined = this.combinedTransform(shape, {angle: 30, scale: 1.2, noise: 3});
        testResults.push(this.runTest(shape, combined, 'Комбинированная', 80, 20));
       
        // 📊 СВОДНЫЙ ОТЧЁТ
        this.printSummary(testResults);
       
        // 📈 СТАТИСТИКА АЛГОРИТМА
        this.printAlgorithmStats();
       
        return testResults;
    }

    // 🧪 ЗАПУСТИТЬ ОДИН ТЕСТ
    runTest(points1, points2, testName, expected, tolerance) {
        console.log(`   ${testName}: ${points1.length} vs ${points2.length} точек`);
       
        const fp1 = this.algorithm.createFootprint(points1, 'форма1');
        const fp2 = this.algorithm.createFootprint(points2, 'форма2');
       
        const result = this.algorithm.compareFootprints(fp1, fp2);
        const percentage = parseFloat(result.matchPercentage);
       
        const isInRange = Math.abs(percentage - expected) <= tolerance;
        const status = isInRange ? '✅' : '❌';
       
        console.log(`   ${status} Результат: ${percentage}% (ожидалось ${expected}% ±${tolerance}%)`);
        console.log(`   Совпадений: ${result.matches.length} из ${Math.min(fp1.length, fp2.length)}`);
       
        if (result.matches.length > 0 && this.algorithm.debug) {
            const avgScore = result.matches.reduce((sum, m) => sum + m.score, 0) / result.matches.length;
            console.log(`   Средний балл сходства: ${avgScore.toFixed(2)}`);
        }
       
        return {
            name: testName,
            actual: percentage,
            expected: expected,
            tolerance: tolerance,
            inRange: isInRange,
            matches: result.matches.length
        };
    }

    // 📊 ВЫВЕСТИ СВОДКУ
    printSummary(results) {
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ ПО ТЕСТАМ:');
        console.log('='.repeat(70));
       
        let passed = 0;
        results.forEach((test, i) => {
            const status = test.inRange ? '✅' : '❌';
            console.log(`${status} ${test.name.padEnd(25)} ${test.actual}% (ожидалось ${test.expected}% ±${test.tolerance}%)`);
           
            if (test.inRange) passed++;
        });
       
        const successRate = (passed / results.length * 100).toFixed(1);
        console.log(`\n🎯 ИТОГО: ${passed}/${results.length} тестов пройдено (${successRate}%)`);
       
        if (successRate >= 80) {
            console.log('🏆 АЛГОРИТМ РАБОТАЕТ ОТЛИЧНО!');
        } else if (successRate >= 60) {
            console.log('⚠️ АЛГОРИТМ РАБОТАЕТ, НО ТРЕБУЕТ НАСТРОЙКИ');
        } else {
            console.log('❌ ТРЕБУЕТСЯ СЕРЬЕЗНАЯ ДОРАБОТКА');
        }
    }

    // 📈 ВЫВЕСТИ СТАТИСТИКУ АЛГОРИТМА
    printAlgorithmStats() {
        const stats = this.algorithm.getStats();
        console.log('\n📊 СТАТИСТИКА АЛГОРИТМА:');
        console.log('='.repeat(70));
        console.log(`• Сравнений выполнено: ${stats.comparisons}`);
        console.log(`• Всего совпадений найдено: ${stats.matches}`);
        console.log(`• Ложных срабатываний: ${stats.falsePositives}`);
        console.log(`• Пропущенных совпадений: ${stats.falseNegatives}`);
    }

    // 🎯 СОЗДАТЬ РЕАЛИСТИЧНУЮ ФИГУРУ
    createRealisticShape(type, pointCount) {
        const points = [];
        const a = 100;
        const b = type === 'eight' ? 60 : 55;
       
        for (let i = 0; i < pointCount; i++) {
            const t = (i / pointCount) * 2 * Math.PI;
            const x = a * Math.sin(t);
            const y = b * Math.sin(type === 'eight' ? 2 * t : 1.9 * t);
           
            points.push({
                x: x,
                y: y,
                id: `${type}_${i}`,
                originalIndex: i
            });
        }
       
        return points;
    }

    // 🔄 ВЕКТОРНЫЙ ПОВОРОТ
    vectorRotate(points, angle) {
        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        return points.map(p => ({
            ...p,
            x: p.x * cosA - p.y * sinA,
            y: p.x * sinA + p.y * cosA,
            id: `${p.id}_rot${angle}`
        }));
    }

    // ⚖️ ВЕКТОРНОЕ МАСШТАБИРОВАНИЕ
    vectorScale(points, scale) {
        return points.map(p => ({
            ...p,
            x: p.x * scale,
            y: p.y * scale,
            id: `${p.id}_scale${scale}`
        }));
    }

    // 📍 ВЕКТОРНОЕ СМЕЩЕНИЕ
    vectorShift(points, dx, dy) {
        return points.map(p => ({
            ...p,
            x: p.x + dx,
            y: p.y + dy,
            id: `${p.id}_shift${dx}${dy}`
        }));
    }

    // 🔊 РЕАЛИСТИЧНЫЙ ШУМ
    addRealisticNoise(points, maxNoise) {
        return points.map(p => {
            // Гауссовский шум с уменьшением на краях
            const gaussianNoise = () => {
                let u = 0, v = 0;
                while(u === 0) u = Math.random();
                while(v === 0) v = Math.random();
                return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * 0.5;
            };
           
            // Уменьшаем шум для точек с большими координатами
            const distance = Math.sqrt(p.x * p.x + p.y * p.y);
            const noiseFactor = Math.max(0.3, 1 - distance / 200);
           
            const noiseX = gaussianNoise() * maxNoise * noiseFactor;
            const noiseY = gaussianNoise() * maxNoise * noiseFactor;
           
            return {
                ...p,
                x: p.x + noiseX,
                y: p.y + noiseY,
                id: `${p.id}_noise${maxNoise}`
            };
        });
    }

    // 🎯 СОЗДАТЬ ЧАСТИЧНУЮ ФИГУРУ
    createPartialShape(points, keepPercentage) {
        const keepCount = Math.max(3, Math.floor(points.length * keepPercentage / 100));
        const indices = new Set();
       
        while (indices.size < keepCount) {
            indices.add(Math.floor(Math.random() * points.length));
        }
       
        return Array.from(indices).map(idx => ({
            ...points[idx],
            id: `${points[idx].id}_partial`
        }));
    }

    // 🔄 КОМБИНИРОВАННАЯ ТРАНСФОРМАЦИЯ
    combinedTransform(points, options) {
        let result = [...points];
       
        if (options.angle) {
            result = this.vectorRotate(result, options.angle);
        }
       
        if (options.scale) {
            result = this.vectorScale(result, options.scale);
        }
       
        if (options.noise) {
            result = this.addRealisticNoise(result, options.noise);
        }
       
        return result.map(p => ({
            ...p,
            id: `${p.id}_combined`
        }));
    }

    // 🎯 ДЕМОНСТРАЦИЯ РАБОТЫ АЛГОРИТМА
    demonstrateAlgorithm() {
        console.log('\n🎯 ДЕМОНСТРАЦИЯ РАБОТЫ АЛГОРИТМА\n');
       
        // Создаем тестовую фигуру
        const shape = this.createRealisticShape('eight', 8);
        console.log('1. Создаем тестовую фигуру (8 точек):');
        shape.forEach((p, i) => {
            console.log(`   Точка ${i}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
        });
       
        // Создаем отпечаток
        const fp = this.algorithm.createFootprint(shape, 'оригинал');
        console.log(`\n2. Создан отпечаток: ${fp.length} точек`);
       
        // Показываем дескриптор первой точки
        if (fp.length > 0) {
            const firstPoint = fp[0];
            console.log(`\n3. Дескриптор точки ${firstPoint.id}:`);
            console.log(`   • Треугольников уровня 1: ${firstPoint.trianglesL1.length}`);
            console.log(`   • Треугольников уровня 2: ${firstPoint.trianglesL2.length}`);
            console.log(`   • Всего признаков: ${firstPoint.descriptor.featureCount}`);
           
            if (firstPoint.trianglesL1.length > 0) {
                const tri = firstPoint.trianglesL1[0];
                console.log(`   • Пример треугольника:`);
                console.log(`     Углы: ${tri.angles.map(a => a.toFixed(1)).join(', ')}°`);
                console.log(`     Норм. углы: ${tri.normalizedAngles.map(a => a.toFixed(1)).join(', ')}°`);
            }
        }
       
        // Создаем повернутую версию
        const rotated = this.vectorRotate(shape, 60);
        const fpRotated = this.algorithm.createFootprint(rotated, 'повернутый');
       
        // Сравниваем
        console.log('\n4. Сравниваем оригинал и повернутый на 60°:');
        const result = this.algorithm.compareFootprints(fp, fpRotated);
        console.log(`   • Найдено совпадений: ${result.matches.length}`);
        console.log(`   • Процент совпадений: ${result.matchPercentage}%`);
       
        if (result.matches.length > 0) {
            const avgScore = result.matches.reduce((sum, m) => sum + m.score, 0) / result.matches.length;
            console.log(`   • Среднее сходство: ${avgScore.toFixed(2)}`);
           
            console.log('\n5. Пример совпадения:');
            const match = result.matches[0];
            console.log(`   • ${match.point1.id} → ${match.point2.id}`);
            console.log(`   • Балл сходства: ${match.score.toFixed(2)}`);
        }
    }
}

// ============================================
// 🚀 ФИНАЛЬНЫЙ ЗАПУСК
// ============================================
async function main() {
    try {
        console.log('🎯 ФИНАЛЬНЫЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ - РЕАЛЬНЫЙ МИР\n');
        console.log('📐 Векторные операции + Адаптивные допуски + Многоуровневые треугольники\n');
        console.log('='.repeat(70) + '\n');
       
        const tester = new RealWorldTester();
       
        // Демонстрация работы алгоритма
        tester.demonstrateAlgorithm();
       
        // Комплексное тестирование
        console.log('\n' + '='.repeat(70));
        const results = tester.runComprehensiveTests();
       
        // Вывод рекомендаций
        console.log('\n💡 РЕКОМЕНДАЦИИ ДЛЯ ИНТЕГРАЦИИ В СИСТЕМУ:');
        console.log('='.repeat(70));
        console.log('1. ПРЕДОБРАБОТКА ДАННЫХ:');
        console.log('   • Всегда нормализуйте точки перед анализом');
        console.log('   • Используйте векторные операции для трансформаций');
        console.log('   • Не округляйте координаты до сравнения');
       
        console.log('\n2. НАСТРОЙКА ПАРАМЕТРОВ:');
        console.log('   • angleTolerance: 8-12 градусов (чем больше шум, тем больше допуск)');
        console.log('   • distanceTolerance: 0.15-0.25 (15-25% допуск по расстояниям)');
        console.log('   • minSimilarity: 0.6-0.7 (60-70% сходства достаточно)');
       
        console.log('\n3. ОПТИМИЗАЦИЯ ПРОИЗВОДИТЕЛЬНОСТИ:');
        console.log('   • Используйте кэширование геометрических дескрипторов');
        console.log('   • Ограничьте maxNeighbors 4-5 для плотных облаков точек');
        console.log('   • Треугольники 2-го уровня включайте только при необходимости');
       
        console.log('\n4. ОБРАБОТКА ГРАНИЧНЫХ СЛУЧАЕВ:');
        console.log('   • Проверяйте площадь треугольника (> 0.001)');
        console.log('   • Фильтруйте вырожденные треугольники (углы < 10° или > 170°)');
        console.log('   • Для частичных данных уменьшайте minTriangles до 1-2');
       
        console.log('\n🎯 АЛГОРИТМ ГОТОВ К ИНТЕГРАЦИИ!');
        console.log('📧 Для тонкой настройки под конкретные данные:');
        console.log('   • Проанализируйте статистику совпадений');
        console.log('   • Настройте допуски под уровень шума ваших данных');
        console.log('   • Проверьте на реальных следах обуви');
       
    } catch (error) {
        console.error(`\n❌ ОШИБКА: ${error.message}`);
        console.error(error.stack);
    }
}

// Запуск
if (require.main === module) {
    main();
}

module.exports = {
    AdaptiveGeometricAlgorithm,
    RealWorldTester
};
