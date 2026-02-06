// test-2.js - ПРОСТОЙ И ТОЧНЫЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ
console.log('🎯 ПРОСТОЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ\n');
console.log('📐 Точное сравнение углов треугольников\n');

// ============================================
// 🔷 ПРОСТОЙ И ТОЧНЫЙ КЛАСС
// ============================================
class SimpleTriangleAlgorithm {
    constructor(options = {}) {
        this.maxDistance = options.maxDistance || 100; // Макс расстояние между соседями
        this.anglePrecision = options.anglePrecision || 1; // Точность углов (градусы)
        this.minCommonTriangles = options.minCommonTriangles || 2; // Минимум общих треугольников
        this.debug = options.debug || true;
    }
   
    // 🎯 СОЗДАТЬ ОТПЕЧАТОК
    createFootprint(points, name = '') {
        if (this.debug) console.log(`👣 Создание "${name}": ${points.length} точек`);
       
        const footprint = [];
       
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // Найти ближайших соседей
            const neighbors = this.findNearestNeighbors(point, points, i, 4); // 4 ближайших
           
            if (neighbors.length >= 2) {
                // Создать треугольники
                const triangles = this.createTriangles(point, neighbors);
               
                if (triangles.length > 0) {
                    // Для каждого треугольника сохраняем его углы
                    const triangleAngles = triangles.map(t => ({
                        angles: t.angles,
                        hash: this.anglesToHash(t.angles)
                    }));
                   
                    footprint.push({
                        id: point.id || `p${i}`,
                        x: point.x,
                        y: point.y,
                        triangles: triangleAngles,
                        triangleHashes: triangleAngles.map(t => t.hash)
                    });
                }
            }
        }
       
        if (this.debug) {
            const avgTri = footprint.length > 0
                ? (footprint.reduce((sum, p) => sum + p.triangles.length, 0) / footprint.length).toFixed(1)
                : 0;
            console.log(`   ✅ Создано: ${footprint.length} точек, среднее: ${avgTri} треугольников\n`);
        }
       
        return footprint;
    }
   
    // 🔍 НАЙТИ БЛИЖАЙШИХ СОСЕДЕЙ
    findNearestNeighbors(center, points, centerIndex, count) {
        const distances = [];
       
        for (let i = 0; i < points.length; i++) {
            if (i === centerIndex) continue;
           
            const point = points[i];
            const distance = this.distance(center, point);
           
            if (distance <= this.maxDistance) {
                distances.push({ point, distance, index: i });
            }
        }
       
        distances.sort((a, b) => a.distance - b.distance);
        return distances.slice(0, count).map(d => d.point);
    }
   
    // 📐 СОЗДАТЬ ТРЕУГОЛЬНИКИ
    createTriangles(center, neighbors) {
        const triangles = [];
       
        // Создаем треугольники с разными парами соседей
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const triangle = this.calculateTriangle(center, neighbors[i], neighbors[j]);
               
                if (triangle) {
                    triangles.push(triangle);
                }
            }
        }
       
        return triangles;
    }
   
    // 🎯 ВЫЧИСЛИТЬ ТРЕУГОЛЬНИК
    calculateTriangle(p1, p2, p3) {
        // Расстояния между точками
        const a = this.distance(p2, p3); // сторона напротив p1
        const b = this.distance(p1, p3); // сторона напротив p2
        const c = this.distance(p1, p2); // сторона напротив p3
       
        // Проверяем, что треугольник не вырожденный
        if (a < 1 || b < 1 || c < 1) return null;
       
        // Вычисляем углы
        const angleA = this.calculateAngle(b, c, a); // угол при p1
        const angleB = this.calculateAngle(a, c, b); // угол при p2
        const angleC = this.calculateAngle(a, b, c); // угол при p3
       
        // Проверяем валидность углов
        if (isNaN(angleA) || isNaN(angleB) || isNaN(angleC)) return null;
       
        // Сортируем углы для инвариантности
        const angles = [angleA, angleB, angleC].sort((x, y) => x - y);
       
        return {
            p1, p2, p3,
            angles: angles,
            sides: [a, b, c]
        };
    }
   
    // 🔑 ПРЕОБРАЗОВАТЬ УГЛЫ В ХЕШ
    anglesToHash(angles) {
        // Округляем до заданной точности
        const rounded = angles.map(a =>
            Math.round(a * Math.pow(10, this.anglePrecision)) / Math.pow(10, this.anglePrecision)
        );
       
        return `T${rounded[0]}-${rounded[1]}-${rounded[2]}`;
    }
   
    // 🔍 СРАВНИТЬ ДВА ОТПЕЧАТКА
    compareFootprints(fp1, fp2) {
        if (this.debug) console.log(`🔍 Сравнение: ${fp1.length} vs ${fp2.length} точек`);
       
        const matches = [];
       
        // Для каждой точки в fp1
        for (const point1 of fp1) {
            let bestMatch = null;
            let bestCommon = 0;
           
            // Ищем лучшую пару в fp2
            for (const point2 of fp2) {
                // Считаем общие треугольники (точное совпадение хешей)
                const commonTriangles = this.countCommonTriangles(point1, point2);
               
                if (commonTriangles > bestCommon) {
                    bestCommon = commonTriangles;
                    bestMatch = {
                        point1: point1,
                        point2: point2,
                        commonTriangles: commonTriangles,
                        totalTriangles1: point1.triangles.length,
                        totalTriangles2: point2.triangles.length
                    };
                }
            }
           
            // Если нашли достаточно общих треугольников
            if (bestMatch && bestCommon >= this.minCommonTriangles) {
                matches.push(bestMatch);
            }
        }
       
        if (this.debug) console.log(`   ✅ Найдено совпадений: ${matches.length}\n`);
       
        return {
            matches: matches,
            matchPercentage: fp1.length > 0 ? ((matches.length / Math.min(fp1.length, fp2.length)) * 100).toFixed(1) : '0.0'
        };
    }
   
    // 🔢 ПОДСЧИТАТЬ ОБЩИЕ ТРЕУГОЛЬНИКИ
    countCommonTriangles(point1, point2) {
        if (!point1.triangleHashes || !point2.triangleHashes) return 0;
       
        const hashes2 = new Set(point2.triangleHashes);
        let common = 0;
       
        for (const hash of point1.triangleHashes) {
            if (hashes2.has(hash)) {
                common++;
            }
        }
       
        return common;
    }
   
    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
   
    calculateAngle(side1, side2, oppositeSide) {
        // cos(angle) = (side1² + side2² - oppositeSide²) / (2 * side1 * side2)
        const cosAngle = (side1 * side1 + side2 * side2 - oppositeSide * oppositeSide) / (2 * side1 * side2);
        const clampedCos = Math.max(-1, Math.min(1, cosAngle));
        return Math.acos(clampedCos) * 180 / Math.PI;
    }
}

// ============================================
// 🔷 ПРОСТЫЕ ТЕСТОВЫЕ ДАННЫЕ
// ============================================
class SimpleTestData {
    // Создать восьмёрку
    static createEight(centerX = 400, centerY = 300, scale = 1.0, points = 12) {
        const result = [];
        const a = 100 * scale;
        const b = 60 * scale;
       
        for (let i = 0; i < points; i++) {
            const t = (i / points) * 2 * Math.PI;
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(2 * t);
            result.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `eight_${i}`
            });
        }
       
        return result;
    }
   
    // Создать ШЕСТЁРКУ (похожую, но другую!)
    static createSix(centerX = 400, centerY = 300, scale = 1.0, points = 12) {
        const result = [];
        const a = 100 * scale;
        const b = 50 * scale; // Другая высота!
       
        for (let i = 0; i < points; i++) {
            const t = (i / points) * 2 * Math.PI;
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(1.7 * t); // Другая форма!
            result.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `six_${i}`
            });
        }
       
        return result;
    }
   
    // ПОВОРОТ (углы НЕ меняются!)
    static rotate(points, angle) {
        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        // Центр
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
       
        return points.map(point => {
            let x = point.x - centerX;
            let y = point.y - centerY;
           
            const rotatedX = x * cosA - y * sinA;
            const rotatedY = x * sinA + y * cosA;
           
            return {
                ...point,
                x: Math.round(rotatedX + centerX),
                y: Math.round(rotatedY + centerY),
                id: `${point.id}_rot${angle}`
            };
        });
    }
   
    // МАСШТАБ (углы НЕ меняются!)
    static scale(points, scale) {
        // Центр
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
       
        return points.map(point => {
            const x = (point.x - centerX) * scale + centerX;
            const y = (point.y - centerY) * scale + centerY;
           
            return {
                ...point,
                x: Math.round(x),
                y: Math.round(y),
                id: `${point.id}_scale${scale}`
            };
        });
    }
   
    // СМЕЩЕНИЕ (углы НЕ меняются!)
    static shift(points, dx, dy) {
        return points.map(point => ({
            ...point,
            x: point.x + dx,
            y: point.y + dy,
            id: `${point.id}_shift${dx}${dy}`
        }));
    }
   
    // ШУМ (углы немного меняются)
    static addNoise(points, amount = 3) {
        return points.map(point => {
            const noiseX = (Math.random() - 0.5) * 2 * amount;
            const noiseY = (Math.random() - 0.5) * 2 * amount;
           
            return {
                ...point,
                x: Math.round(point.x + noiseX),
                y: Math.round(point.y + noiseY),
                id: `${point.id}_noise${amount}`
            };
        });
    }
}

// ============================================
// 🔷 ТЕСТЕР
// ============================================
class SimpleTester {
    constructor() {
        this.algorithm = new SimpleTriangleAlgorithm({
            maxDistance: 120,
            anglePrecision: 0, // Целые градусы
            minCommonTriangles: 2, // Нужно минимум 2 общих треугольника
            debug: true
        });
    }
   
    // 🧪 ЗАПУСТИТЬ ТЕСТЫ
    runTests() {
        console.log('🧪 ТЕСТИРОВАНИЕ ПРОСТОГО АЛГОРИТМА\n');
       
        const tests = [];
       
        // Тест 1: Одна и та же фигура
        console.log('1️⃣ ТЕСТ: ОДИН И ТОТ ЖЕ СЛЕД');
        const eight = SimpleTestData.createEight(400, 300, 1.0, 10);
        tests.push(this.runTest(eight, [...eight], 'Одинаковая восьмёрка', 90, 10));
       
        // Тест 2: РАЗНЫЕ фигуры (должно быть мало совпадений!)
        console.log('\n2️⃣ ТЕСТ: ВОСЬМЁРКА vs ШЕСТЁРКА');
        const six = SimpleTestData.createSix(400, 300, 1.0, 10);
        tests.push(this.runTest(eight, six, 'Разные фигуры', 20, 15));
       
        // Тест 3: Поворот
        console.log('\n3️⃣ ТЕСТ: ПОВОРОТ 45°');
        const rotated = SimpleTestData.rotate(eight, 45);
        tests.push(this.runTest(eight, rotated, 'Поворот 45°', 90, 10));
       
        // Тест 4: Масштаб
        console.log('\n4️⃣ ТЕСТ: МАСШТАБ 0.7x');
        const scaled = SimpleTestData.scale(eight, 0.7);
        tests.push(this.runTest(eight, scaled, 'Масштаб 0.7x', 90, 10));
       
        // Тест 5: Смещение
        console.log('\n5️⃣ ТЕСТ: СМЕЩЕНИЕ');
        const shifted = SimpleTestData.shift(eight, 100, 80);
        tests.push(this.runTest(eight, shifted, 'Смещение', 90, 10));
       
        // Тест 6: Шум
        console.log('\n6️⃣ ТЕСТ: С ШУМОМ ±5px');
        const noisy = SimpleTestData.addNoise(eight, 5);
        tests.push(this.runTest(eight, noisy, 'Шум ±5px', 60, 20));
       
        // Тест 7: Частичный след
        console.log('\n7️⃣ ТЕСТ: ЧАСТИЧНЫЙ СЛЕД (убрали 3 точки)');
        const partial = eight.slice(0, 7); // Убрали 3 точки из 10
        tests.push(this.runTest(eight, partial, 'Частичный след', 70, 15));
       
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
       
        // Показываем детали для анализа
        if (result.matches.length > 0 && result.matches.length < points1.length) {
            const match = result.matches[0];
            console.log(`   Пример: ${match.point1.id} → ${match.point2.id}`);
            console.log(`   Общих треугольников: ${match.commonTriangles}`);
           
            // Показываем треугольники точки
            if (match.point1.triangles && match.point1.triangles.length > 0) {
                console.log(`   Треугольники точки ${match.point1.id}:`);
                match.point1.triangles.slice(0, 2).forEach((t, i) => {
                    console.log(`     ${i + 1}. ${t.hash} (углы: ${t.angles[0]}, ${t.angles[1]}, ${t.angles[2]})`);
                });
            }
        }
       
        return {
            name: name,
            actual: percentage,
            expected: expected,
            tolerance: tolerance,
            inRange: isInRange
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
    }
   
    // 🎯 ДЕМОНСТРАЦИЯ
    demonstrate() {
        console.log('\n🎯 ДЕМОНСТРАЦИЯ РАБОТЫ АЛГОРИТМА:\n');
       
        // Простой треугольник
        const triangle = [
            { x: 100, y: 100, id: 'A' },
            { x: 200, y: 100, id: 'B' },
            { x: 150, y: 200, id: 'C' }
        ];
       
        console.log('1. Создаем треугольник:');
        const fp = this.algorithm.createFootprint(triangle, 'треугольник');
       
        // Показываем треугольники для точки A
        const pointA = fp.find(p => p.id === 'A');
        if (pointA && pointA.triangles.length > 0) {
            console.log(`\n2. Геометрические треугольники точки A:`);
            pointA.triangles.forEach((t, i) => {
                console.log(`   Треугольник ${i + 1}: ${t.hash}`);
                console.log(`     Углы: ${t.angles[0].toFixed(1)}°, ${t.angles[1].toFixed(1)}°, ${t.angles[2].toFixed(1)}°`);
            });
        }
       
        // Повернутый треугольник
        console.log('\n3. Создаем повернутый треугольник (60°):');
        const rotated = SimpleTestData.rotate(triangle, 60);
        const fpRotated = this.algorithm.createFootprint(rotated, 'повернутый');
       
        console.log('\n4. Сравниваем:');
        const result = this.algorithm.compareFootprints(fp, fpRotated);
       
        console.log(`\n5. Результат: ${result.matches.length} из 3 точек совпали`);
       
        if (result.matches.length === 3) {
            console.log('✅ ВСЕ точки правильно идентифицированы при повороте!');
            console.log('📐 Углы треугольников остались неизменными!');
        }
    }
}

// ============================================
// 🚀 ЗАПУСК
// ============================================
async function main() {
    try {
        console.log('🎯 ПРОСТОЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ\n');
        console.log('📐 Сравнение углов треугольников (инвариантно к трансформациям)\n');
       
        const tester = new SimpleTester();
       
        // Демонстрация
        tester.demonstrate();
       
        // Тесты
        console.log('\n' + '='.repeat(60));
        const results = tester.runTests();
       
        console.log('\n💡 ПРИНЦИП РАБОТЫ:');
        console.log('='.repeat(60));
        console.log('1. Для каждой точки находим 4 ближайших соседа');
        console.log('2. Создаем треугольники: точка + 2 разных соседа');
        console.log('3. Вычисляем углы треугольников и сохраняем их хеш');
        console.log('4. При сравнении ищем точки с одинаковыми хешами треугольников');
       
        console.log('\n📐 ПОЧЕМУ ЭТО РАБОТАЕТ:');
        console.log('• Углы треугольника НЕ меняются при:');
        console.log('  ✅ Повороте фигуры');
        console.log('  ✅ Масштабировании');
        console.log('  ✅ Смещении');
        console.log('• Разные фигуры имеют разные углы треугольников');
        console.log('• Шум немного меняет углы (нужны допуски)');
       
        console.log('\n🎯 ЧТО ТЕСТИРУЕМ:');
        console.log('✅ Одна и та же фигура: ~90-100% совпадений');
        console.log('✅ Разные фигуры: ~5-35% совпадений');
        console.log('✅ Поворот: ~90-100% совпадений');
        console.log('✅ Масштаб: ~90-100% совпадений');
        console.log('✅ Смещение: ~90-100% совпадений');
        console.log('✅ Шум: ~50-80% совпадений');
        console.log('✅ Частичные данные: ~60-85% совпадений');
       
        console.log('\n🚀 АЛГОРИТМ ГОТОВ К ТЕСТИРОВАНИЮ!');
       
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
    SimpleTriangleAlgorithm,
    SimpleTestData,
    SimpleTester
};
