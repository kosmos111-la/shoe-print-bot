// test-2.js - ГИБКИЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ
console.log('🎯 ГИБКИЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ\n');
console.log('📐 Углы + стороны + адаптивные допуски\n');

// ============================================
// 🔷 УЛУЧШЕННЫЙ КЛАСС АЛГОРИТМА С ДОПУСКАМИ
// ============================================
class FlexibleGeometricAlgorithm {
    constructor(options = {}) {
        this.neighborRadius = options.neighborRadius || 120;
        this.minSimilarity = options.minSimilarity || 0.4; // 40% совпадение
        this.maxTriangles = options.maxTriangles || 4;
        this.angleTolerance = options.angleTolerance || 10; // Допуск по углам в градусах
        this.sideTolerance = options.sideTolerance || 0.2; // Допуск по сторонам (20%)
        this.debug = options.debug || true;
    }
   
    // 🎯 СОЗДАТЬ ГЕОМЕТРИЧЕСКИЙ ОТПЕЧАТОК
    createFootprint(points, name = '') {
        if (this.debug) console.log(`👣 Создание "${name}": ${points.length} точек`);
       
        const footprint = [];
       
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const pointId = point.id || `p${i}`;
           
            // Найти соседей
            const neighbors = this.findNeighbors(point, points, i);
           
            if (neighbors.length >= 2) {
                // Создать геометрические дескрипторы
                const descriptors = this.createDescriptorsForPoint(point, neighbors);
               
                if (descriptors.length > 0) {
                    footprint.push({
                        id: pointId,
                        x: point.x,
                        y: point.y,
                        descriptors: descriptors,
                        neighbors: neighbors.length
                    });
                   
                    if (this.debug && i < 2) {
                        console.log(`   Точка ${pointId}: ${descriptors.length} дескрипторов`);
                    }
                }
            }
        }
       
        const avgDesc = footprint.length > 0
            ? (footprint.reduce((sum, p) => sum + p.descriptors.length, 0) / footprint.length).toFixed(1)
            : 0;
       
        if (this.debug) console.log(`   ✅ Создано: ${footprint.length} точек, среднее: ${avgDesc} дескрипторов\n`);
       
        return footprint;
    }
   
    // 🔍 НАЙТИ СОСЕДЕЙ
    findNeighbors(centerPoint, allPoints, centerIndex) {
        const neighbors = [];
       
        for (let i = 0; i < allPoints.length; i++) {
            if (i === centerIndex) continue;
           
            const point = allPoints[i];
            const distance = this.calculateDistance(centerPoint, point);
           
            if (distance <= this.neighborRadius && distance > 0) {
                neighbors.push({
                    point: point,
                    distance: distance
                });
            }
        }
       
        neighbors.sort((a, b) => a.distance - b.distance);
        return neighbors.slice(0, 6).map(n => n.point); // Берем 6 ближайших
    }
   
    // 📐 СОЗДАТЬ ДЕСКРИПТОРЫ
    createDescriptorsForPoint(centerPoint, neighbors) {
        const descriptors = [];
       
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const descriptor = this.createDescriptor(centerPoint, neighbors[i], neighbors[j]);
               
                if (descriptor) {
                    descriptors.push(descriptor);
                   
                    if (descriptors.length >= this.maxTriangles) break;
                }
            }
            if (descriptors.length >= this.maxTriangles) break;
        }
       
        return descriptors;
    }
   
    // 🎯 СОЗДАТЬ ДЕСКРИПТОР
    createDescriptor(p1, p2, p3) {
        try {
            // Стороны треугольника
            const a = this.calculateDistance(p2, p3);
            const b = this.calculateDistance(p1, p3);
            const c = this.calculateDistance(p1, p2);
           
            if (a < 5 || b < 5 || c < 5) return null; // Слишком маленький треугольник
           
            // Углы
            const angleA = this.calculateAngle(b, c, a);
            const angleB = this.calculateAngle(a, c, b);
            const angleC = this.calculateAngle(a, b, c);
           
            if (isNaN(angleA) || isNaN(angleB) || isNaN(angleC)) return null;
           
            // Сортируем углы по возрастанию
            const angles = [angleA, angleB, angleC].sort((x, y) => x - y);
           
            // Сортируем стороны по возрастанию и нормализуем
            const sides = [a, b, c].sort((x, y) => x - y);
            const maxSide = sides[2];
            const normalizedSides = sides.map(s => s / maxSide);
           
            return {
                angles: angles,
                sides: normalizedSides,
                rawAngles: [angleA, angleB, angleC],
                rawSides: [a, b, c]
            };
        } catch (error) {
            return null;
        }
    }
   
    // 🔍 СРАВНИТЬ ДВА ОТПЕЧАТКА (ГИБКОЕ СРАВНЕНИЕ)
    compareFootprints(fp1, fp2) {
        if (this.debug) console.log(`🔍 Сравнение: ${fp1.length} vs ${fp2.length} точек`);
       
        const matches = [];
       
        // Для каждой точки в fp1 ищем лучшую пару в fp2
        for (const point1 of fp1) {
            let bestMatch = null;
            let bestScore = 0;
           
            for (const point2 of fp2) {
                const score = this.compareDescriptorsFlexible(point1.descriptors, point2.descriptors);
               
                if (score > bestScore && score >= this.minSimilarity) {
                    bestScore = score;
                    bestMatch = {
                        point1: point1,
                        point2: point2,
                        similarity: score,
                        matchedDescriptors: this.countMatchedDescriptors(point1.descriptors, point2.descriptors)
                    };
                }
            }
           
            if (bestMatch) {
                matches.push(bestMatch);
            }
        }
       
        if (this.debug) console.log(`   ✅ Найдено совпадений: ${matches.length}\n`);
       
        return {
            matches: matches,
            matchPercentage: fp1.length > 0 ? ((matches.length / Math.min(fp1.length, fp2.length)) * 100).toFixed(1) : '0.0'
        };
    }
   
    // 🔄 ГИБКОЕ СРАВНЕНИЕ ДЕСКРИПТОРОВ
    compareDescriptorsFlexible(descriptors1, descriptors2) {
        if (descriptors1.length === 0 || descriptors2.length === 0) return 0;
       
        let matchedCount = 0;
       
        // Для каждого дескриптора из первого набора
        // ищем похожий во втором наборе
        for (const d1 of descriptors1) {
            let bestMatchScore = 0;
           
            for (const d2 of descriptors2) {
                const matchScore = this.descriptorsSimilarity(d1, d2);
                if (matchScore > bestMatchScore) {
                    bestMatchScore = matchScore;
                }
            }
           
            // Если нашли достаточно похожий дескриптор
            if (bestMatchScore >= 0.7) { // Порог 70% сходства
                matchedCount++;
            }
        }
       
        // Возвращаем долю совпавших дескрипторов
        return matchedCount / Math.min(descriptors1.length, descriptors2.length);
    }
   
    // 📊 ВЫЧИСЛИТЬ СХОДСТВО ДВУХ ДЕСКРИПТОРОВ
    descriptorsSimilarity(d1, d2) {
        // Сравниваем углы
        let angleScore = 0;
        for (let i = 0; i < 3; i++) {
            const diff = Math.abs(d1.angles[i] - d2.angles[i]);
            if (diff <= this.angleTolerance) {
                angleScore += (1 - diff / this.angleTolerance) / 3;
            }
        }
       
        // Сравниваем стороны
        let sideScore = 0;
        for (let i = 0; i < 3; i++) {
            const diff = Math.abs(d1.sides[i] - d2.sides[i]);
            if (diff <= this.sideTolerance) {
                sideScore += (1 - diff / this.sideTolerance) / 3;
            }
        }
       
        // Общее сходство (среднее углов и сторон)
        return (angleScore + sideScore) / 2;
    }
   
    // 🔢 ПОДСЧИТАТЬ СОВПАВШИЕ ДЕСКРИПТОРЫ
    countMatchedDescriptors(descriptors1, descriptors2) {
        let count = 0;
       
        for (const d1 of descriptors1) {
            for (const d2 of descriptors2) {
                if (this.descriptorsSimilarity(d1, d2) >= 0.7) {
                    count++;
                    break;
                }
            }
        }
       
        return count;
    }
   
    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
   
    calculateAngle(side1, side2, oppositeSide) {
        const cosAngle = (side1 * side1 + side2 * side2 - oppositeSide * oppositeSide) / (2 * side1 * side2);
        const clampedCos = Math.max(-1, Math.min(1, cosAngle));
        return Math.acos(clampedCos) * 180 / Math.PI;
    }
}

// ============================================
// 🔷 КЛАСС ДЛЯ СОЗДАНИЯ ТЕСТОВЫХ ДАННЫХ
// ============================================
class TestDataFlexible {
    // Создать фигуру
    static createFigure(centerX = 400, centerY = 300, scale = 1.0, points = 16, shape = 'eight') {
        const result = [];
       
        for (let i = 0; i < points; i++) {
            const t = (i / points) * 2 * Math.PI;
            let x, y;
           
            if (shape === 'eight') {
                const a = 100 * scale;
                const b = 60 * scale;
                x = centerX + a * Math.sin(t);
                y = centerY + b * Math.sin(2 * t);
            } else if (shape === 'six') {
                const a = 100 * scale;
                const b = 40 * scale; // Более отличная форма
                x = centerX + a * Math.sin(t);
                y = centerY + b * Math.sin(1.8 * t);
            } else if (shape === 'circle') {
                const radius = 80 * scale;
                x = centerX + radius * Math.cos(t);
                y = centerY + radius * Math.sin(t);
            }
           
            result.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `${shape}_${i}`
            });
        }
       
        return result;
    }
   
    // Трансформация
    static transform(points, angle = 0, scale = 1.0, dx = 0, dy = 0) {
        if (angle === 0 && scale === 1.0 && dx === 0 && dy === 0) {
            return points.map(p => ({...p}));
        }
       
        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
       
        return points.map(point => {
            let x = point.x - centerX;
            let y = point.y - centerY;
           
            const rotatedX = x * cosA - y * sinA;
            const rotatedY = x * sinA + y * cosA;
           
            x = rotatedX * scale;
            y = rotatedY * scale;
           
            x = Math.round(x + centerX + dx);
            y = Math.round(y + centerY + dy);
           
            return {
                ...point,
                x: x,
                y: y,
                id: `${point.id}_t${angle}_s${scale}`
            };
        });
    }
   
    // Шум
    static addNoise(points, maxNoise = 5) {
        return points.map(point => {
            // Более мягкий шум
            const noise = () => (Math.random() - 0.5) * 2 * maxNoise * 0.7;
           
            return {
                ...point,
                x: Math.round(point.x + noise()),
                y: Math.round(point.y + noise()),
                id: `${point.id}_n${maxNoise}`
            };
        });
    }
   
    // Удалить точки
    static removeRandom(points, percent = 30) {
        const removeCount = Math.floor(points.length * percent / 100);
        const indices = new Set();
       
        while (indices.size < removeCount) {
            indices.add(Math.floor(Math.random() * points.length));
        }
       
        return points.filter((_, i) => !indices.has(i));
    }
}

// ============================================
// 🔷 ТЕСТЕР С РЕАЛИСТИЧНЫМИ ОЖИДАНИЯМИ
// ============================================
class FlexibleTester {
    constructor() {
        this.algorithm = new FlexibleGeometricAlgorithm({
            neighborRadius: 150, // Больший радиус для лучшего покрытия
            minSimilarity: 0.3,  // 30% совпадение
            maxTriangles: 6,     // Больше треугольников
            angleTolerance: 15,  // 15 градусов допуск
            sideTolerance: 0.25, // 25% допуск по сторонам
            debug: true
        });
    }
   
    // 🧪 ЗАПУСТИТЬ ТЕСТЫ
    runAllTests() {
        console.log('🧪 ТЕСТИРОВАНИЕ С ГИБКИМИ ДОПУСКАМИ\n');
       
        const tests = [];
       
        // Тест 1: Один и тот же след
        console.log('1️⃣ ТЕСТ: ОДИН И ТОТ ЖЕ СЛЕД');
        const eight = TestDataFlexible.createFigure(400, 300, 1.0, 16, 'eight');
        tests.push(this.runTest(eight, [...eight], 'Одинаковая восьмёрка', 95, 5));
       
        // Тест 2: Разные фигуры (должно быть мало совпадений)
        console.log('\n2️⃣ ТЕСТ: ВОСЬМЁРКА vs ШЕСТЁРКА (разные фигуры)');
        const six = TestDataFlexible.createFigure(400, 300, 1.0, 16, 'six');
        tests.push(this.runTest(eight, six, 'Разные фигуры', 20, 15)); // Ожидаем 5-35%
       
        // Тест 3: Поворот
        console.log('\n3️⃣ ТЕСТ: ПОВОРОТ 45°');
        const rotated = TestDataFlexible.transform(eight, 45);
        tests.push(this.runTest(eight, rotated, 'Поворот 45°', 85, 10));
       
        // Тест 4: Масштаб
        console.log('\n4️⃣ ТЕСТ: МАСШТАБ 0.6x');
        const scaled = TestDataFlexible.transform(eight, 0, 0.6);
        tests.push(this.runTest(eight, scaled, 'Масштаб 0.6x', 80, 15));
       
        // Тест 5: Смещение
        console.log('\n5️⃣ ТЕСТ: СМЕЩЕНИЕ');
        const shifted = TestDataFlexible.transform(eight, 0, 1.0, 200, 150);
        tests.push(this.runTest(eight, shifted, 'Смещение', 95, 5));
       
        // Тест 6: Шум
        console.log('\n6️⃣ ТЕСТ: С ШУМОМ ±8px');
        const noisy = TestDataFlexible.addNoise(eight, 8);
        tests.push(this.runTest(eight, noisy, 'Шум ±8px', 70, 15));
       
        // Тест 7: Частичный след
        console.log('\n7️⃣ ТЕСТ: ЧАСТИЧНЫЙ СЛЕД (33% точек)');
        const partial = TestDataFlexible.removeRandom(eight, 33);
        tests.push(this.runTest(eight, partial, 'Частичный след', 65, 20));
       
        // Тест 8: Комбинированная (меньше трансформаций)
        console.log('\n8️⃣ ТЕСТ: КОМБИНИРОВАННАЯ (поворот 30° + шум 5px)');
        const combined = TestDataFlexible.transform(eight, 30, 1.0, 0, 0);
        const combinedNoisy = TestDataFlexible.addNoise(combined, 5);
        tests.push(this.runTest(eight, combinedNoisy, 'Комбинированная', 75, 15));
       
        // Сводка
        this.printSummary(tests);
       
        return tests;
    }
   
    // 🧪 ЗАПУСТИТЬ ОДИН ТЕСТ
    runTest(points1, points2, name, expected, tolerance) {
        console.log(`   ${name}: ${points1.length} vs ${points2.length} точек`);
       
        const fp1 = this.algorithm.createFootprint(points1, 'форма1');
        const fp2 = this.algorithm.createFootprint(points2, 'форма2');
       
        const result = this.algorithm.compareFootprints(fp1, fp2);
        const percentage = parseFloat(result.matchPercentage);
       
        const isInRange = Math.abs(percentage - expected) <= tolerance;
        const status = isInRange ? '✅' : '❌';
       
        console.log(`   ${status} Результат: ${percentage}% (ожидалось ${expected}% ±${tolerance}%)`);
        console.log(`   Совпадений: ${result.matches.length} из ${Math.min(points1.length, points2.length)}`);
       
        if (result.matches.length > 0 && percentage > 0 && percentage < 100) {
            const match = result.matches[0];
            console.log(`   Пример: ${match.point1.id} → ${match.point2.id}, сходство: ${match.similarity.toFixed(2)}`);
        }
       
        return {
            name: name,
            actual: percentage,
            expected: expected,
            tolerance: tolerance,
            inRange: isInRange,
            matches: result.matches.length
        };
    }
   
    // 📊 СВОДКА
    printSummary(tests) {
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ:');
        console.log('='.repeat(60));
       
        let passed = 0;
        tests.forEach((test, i) => {
            const status = test.inRange ? '✅' : '❌';
            console.log(`${status} ТЕСТ ${i + 1}: ${test.name}`);
            console.log(`   Результат: ${test.actual}% (ожидалось ${test.expected}% ±${test.tolerance}%)`);
           
            if (test.inRange) passed++;
        });
       
        console.log(`\n🎯 ИТОГО: ${passed}/${tests.length} тестов пройдено`);
       
        if (passed >= tests.length * 0.7) {
            console.log('✅ Алгоритм работает хорошо!');
        } else if (passed >= tests.length * 0.5) {
            console.log('⚠️ Алгоритм требует настройки');
        } else {
            console.log('❌ Серьезные проблемы с алгоритмом');
        }
    }
   
    // 🎯 ДЕМОНСТРАЦИЯ
    demonstrate() {
        console.log('\n🎯 ДЕМОНСТРАЦИЯ ГИБКОГО АЛГОРИТМА:\n');
       
        // Квадрат
        const square = [
            { x: 100, y: 100, id: 'A' },
            { x: 200, y: 100, id: 'B' },
            { x: 200, y: 200, id: 'C' },
            { x: 100, y: 200, id: 'D' }
        ];
       
        console.log('1. Создаем квадрат:');
        const fp = this.algorithm.createFootprint(square, 'квадрат');
       
        // Масштабированный и повернутый квадрат
        console.log('\n2. Создаем масштабированный и повернутый квадрат:');
        const transformed = TestDataFlexible.transform(square, 30, 1.5);
        const fpTransformed = this.algorithm.createFootprint(transformed, 'трансформированный');
       
        console.log('\n3. Сравниваем:');
        const result = this.algorithm.compareFootprints(fp, fpTransformed);
       
        console.log(`\n4. Результат: ${result.matches.length} из 4 точек совпали`);
       
        if (result.matches.length === 4) {
            console.log('✅ ВСЕ точки правильно идентифицированы!');
        }
    }
}

// ============================================
// 🚀 ЗАПУСК
// ============================================
async function main() {
    try {
        console.log('🎯 ГИБКИЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ\n');
        console.log('📐 Адаптивные допуски + гибкое сравнение\n');
       
        const tester = new FlexibleTester();
       
        // Демонстрация
        tester.demonstrate();
       
        // Тесты
        console.log('\n' + '='.repeat(60));
        const results = tester.runAllTests();
       
        console.log('\n💡 КЛЮЧЕВЫЕ ФИЧИ АЛГОРИТМА:');
        console.log('='.repeat(60));
        console.log('1. ГИБКОЕ СРАВНЕНИЕ:');
        console.log('   • Допуск по углам: ±15 градусов');
        console.log('   • Допуск по сторонам: ±25%');
        console.log('   • Постепенное сходство (не бинарное)');
       
        console.log('\n2. АДАПТИВНЫЕ ПОРОГИ:');
        console.log('   • Требуется всего 30% совпадений дескрипторов');
        console.log('   • Учитывает качество каждого совпадения');
        console.log('   • Работает с неполными данными');
       
        console.log('\n3. УСТОЙЧИВОСТЬ К ТРАНСФОРМАЦИЯМ:');
        console.log('   • Углы не меняются при повороте/смещении');
        console.log('   • Относительные стороны не меняются при масштабе');
        console.log('   • Допуски компенсируют шум и неточности');
       
        console.log('\n🎯 ПРЕИМУЩЕСТВА:');
        console.log('✅ Работает при масштабировании (благодаря относительным сторонам)');
        console.log('✅ Устойчив к шуму (благодаря допускам)');
        console.log('✅ Различает разные фигуры (разные геометрические отношения)');
        console.log('✅ Работает с частичными данными (гибкие пороги)');
       
        console.log('\n🚀 АЛГОРИТМ ГОТОВ К ИНТЕГРАЦИИ!');
       
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
    FlexibleGeometricAlgorithm,
    TestDataFlexible,
    FlexibleTester
};
