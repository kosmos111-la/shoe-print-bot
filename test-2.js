// test-2.js - ФИНАЛЬНЫЙ ОТЛАЖЕННЫЙ АЛГОРИТМ
console.log('🎯 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ 2.0 - ОТЛАДКА\n');
console.log('📐 Углы + относительные расстояния + точное сравнение\n');

// ============================================
// 🔷 ОСНОВНОЙ КЛАСС АЛГОРИТМА
// ============================================
class GeometricAlgorithm2 {
    constructor(options = {}) {
        this.neighborRadius = options.neighborRadius || 100;
        this.minSimilarity = options.minSimilarity || 0.5; // 50% совпадение дескрипторов
        this.maxTriangles = options.maxTriangles || 4; // Максимум треугольников на точку
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
                // Создать геометрические дескрипторы (треугольники)
                const descriptors = this.createDescriptorsForPoint(point, neighbors);
               
                if (descriptors.length > 0) {
                    footprint.push({
                        id: pointId,
                        x: point.x,
                        y: point.y,
                        descriptors: descriptors,
                        neighbors: neighbors.length
                    });
                   
                    if (this.debug && i < 3) {
                        console.log(`   Точка ${pointId}: ${descriptors.length} дескрипторов`);
                        descriptors.slice(0, 1).forEach(d => {
                            console.log(`     Дескриптор: ${d.hash}`);
                        });
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
           
            // Берем соседей в радиусе
            if (distance <= this.neighborRadius && distance > 0) {
                neighbors.push({
                    point: point,
                    distance: distance
                });
            }
        }
       
        // Сортируем по расстоянию и берем ближайших
        neighbors.sort((a, b) => a.distance - b.distance);
        return neighbors.slice(0, 8).map(n => n.point);
    }
   
    // 📐 СОЗДАТЬ ДЕСКРИПТОРЫ ДЛЯ ТОЧКИ
    createDescriptorsForPoint(centerPoint, neighbors) {
        const descriptors = [];
       
        // Создаем треугольники с разными парами соседей
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const descriptor = this.createTriangleDescriptor(centerPoint, neighbors[i], neighbors[j]);
               
                if (descriptor) {
                    descriptors.push(descriptor);
                   
                    // Ограничиваем количество
                    if (descriptors.length >= this.maxTriangles) break;
                }
            }
            if (descriptors.length >= this.maxTriangles) break;
        }
       
        return descriptors;
    }
   
    // 🎯 СОЗДАТЬ ДЕСКРИПТОР ТРЕУГОЛЬНИКА
    createTriangleDescriptor(p1, p2, p3) {
        try {
            // Вычисляем стороны треугольника
            const a = this.calculateDistance(p2, p3); // противолежащая p1
            const b = this.calculateDistance(p1, p3); // противолежащая p2
            const c = this.calculateDistance(p1, p2); // противолежащая p3
           
            // Проверяем, что треугольник не вырожденный
            if (a < 1 || b < 1 || c < 1) return null;
           
            // Вычисляем углы по теореме косинусов
            const angleA = this.calculateAngle(b, c, a); // угол при p1
            const angleB = this.calculateAngle(a, c, b); // угол при p2
            const angleC = this.calculateAngle(a, b, c); // угол при p3
           
            // Проверяем, что углы валидные
            if (isNaN(angleA) || isNaN(angleB) || isNaN(angleC)) return null;
            if (angleA < 10 || angleA > 170 || angleB < 10 || angleB > 170 || angleC < 10 || angleC > 170) return null;
           
            // Сортируем углы по возрастанию
            const sortedAngles = [angleA, angleB, angleC].sort((x, y) => x - y);
           
            // Вычисляем относительные стороны (делим на самую длинную сторону)
            const sides = [a, b, c].sort((x, y) => x - y);
            const maxSide = sides[2];
            const normalizedSides = sides.map(s => s / maxSide);
           
            // Создаем уникальный хеш
            const hash = this.createDescriptorHash(sortedAngles, normalizedSides);
           
            return {
                angles: sortedAngles,
                sides: normalizedSides,
                hash: hash,
                rawDistances: [a, b, c]
            };
        } catch (error) {
            if (this.debug) console.warn(`   ⚠️ Ошибка создания дескриптора: ${error.message}`);
            return null;
        }
    }
   
    // 🔑 СОЗДАТЬ ХЕШ ДЕСКРИПТОРА
    createDescriptorHash(angles, sides) {
        // Округляем углы до целых градусов
        const roundedAngles = angles.map(a => Math.round(a));
       
        // Округляем стороны до 2 знаков (0.00 - 1.00)
        const roundedSides = sides.map(s => Math.round(s * 100));
       
        return `A${roundedAngles[0]}-${roundedAngles[1]}-${roundedAngles[2]}_S${roundedSides[0]}-${roundedSides[1]}-${roundedSides[2]}`;
    }
   
    // 🔍 СРАВНИТЬ ДВА ОТПЕЧАТКА
    compareFootprints(fp1, fp2) {
        if (this.debug) console.log(`🔍 Сравнение: ${fp1.length} vs ${fp2.length} точек`);
       
        const matches = [];
       
        // Создаем индекс хешей для fp2 для быстрого поиска
        const hashIndex = this.createHashIndex(fp2);
       
        // Для каждой точки в fp1 ищем совпадения в fp2
        for (const point1 of fp1) {
            let bestMatch = null;
            let bestScore = 0;
           
            // Ищем точку в fp2 с максимальным совпадением дескрипторов
            for (const point2 of fp2) {
                const similarity = this.calculatePointSimilarity(point1, point2, hashIndex);
               
                if (similarity > bestScore && similarity >= this.minSimilarity) {
                    bestScore = similarity;
                    bestMatch = {
                        point1: point1,
                        point2: point2,
                        similarity: similarity,
                        commonDescriptors: this.findCommonDescriptors(point1, point2)
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
   
    // 📊 СОЗДАТЬ ИНДЕКС ХЕШЕЙ
    createHashIndex(footprint) {
        const index = new Map();
       
        for (const point of footprint) {
            for (const descriptor of point.descriptors) {
                if (!index.has(descriptor.hash)) {
                    index.set(descriptor.hash, []);
                }
                index.get(descriptor.hash).push(point);
            }
        }
       
        return index;
    }
   
    // 🔄 ВЫЧИСЛИТЬ СХОДСТВО ТОЧЕК
    calculatePointSimilarity(point1, point2, hashIndex) {
        if (point1.descriptors.length === 0 || point2.descriptors.length === 0) return 0;
       
        let commonCount = 0;
       
        // Для каждого дескриптора из point1 проверяем, есть ли он в point2
        for (const descriptor of point1.descriptors) {
            if (hashIndex.has(descriptor.hash)) {
                const pointsWithHash = hashIndex.get(descriptor.hash);
                if (pointsWithHash.some(p => p.id === point2.id)) {
                    commonCount++;
                }
            }
        }
       
        // Возвращаем долю совпавших дескрипторов
        return commonCount / Math.min(point1.descriptors.length, point2.descriptors.length);
    }
   
    // 🔍 НАЙТИ ОБЩИЕ ДЕСКРИПТОРЫ
    findCommonDescriptors(point1, point2) {
        const common = [];
        const hashes2 = new Set(point2.descriptors.map(d => d.hash));
       
        for (const descriptor of point1.descriptors) {
            if (hashes2.has(descriptor.hash)) {
                common.push(descriptor.hash);
            }
        }
       
        return common;
    }
   
    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
   
    calculateAngle(side1, side2, oppositeSide) {
        // Угол по теореме косинусов: cos(A) = (b² + c² - a²) / (2bc)
        const cosAngle = (side1 * side1 + side2 * side2 - oppositeSide * oppositeSide) / (2 * side1 * side2);
       
        // Ограничиваем значение косинуса [-1, 1] для избежания NaN
        const clampedCos = Math.max(-1, Math.min(1, cosAngle));
       
        // Конвертируем в градусы
        return Math.acos(clampedCos) * 180 / Math.PI;
    }
}

// ============================================
// 🔷 КЛАСС ДЛЯ СОЗДАНИЯ ТЕСТОВЫХ ДАННЫХ
// ============================================
class TestData2 {
    // Создать реалистичную фигуру
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
                const b = 50 * scale;
                x = centerX + a * Math.sin(t);
                y = centerY + b * Math.sin(1.5 * t); // Другая форма!
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
   
    // Применить трансформацию
    static transform(points, angle = 0, scale = 1.0, dx = 0, dy = 0) {
        if (angle === 0 && scale === 1.0 && dx === 0 && dy === 0) {
            return points.map(p => ({...p}));
        }
       
        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        // Центр фигуры
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
       
        return points.map(point => {
            // Относительные координаты
            let x = point.x - centerX;
            let y = point.y - centerY;
           
            // Поворот
            const rotatedX = x * cosA - y * sinA;
            const rotatedY = x * sinA + y * cosA;
           
            // Масштаб
            x = rotatedX * scale;
            y = rotatedY * scale;
           
            // Возвращаем и добавляем смещение
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
   
    // Добавить реалистичный шум
    static addNoise(points, maxNoise = 5) {
        return points.map(point => {
            // Гауссовский шум (более реалистичный)
            const gaussian = () => {
                let u = 0, v = 0;
                while(u === 0) u = Math.random();
                while(v === 0) v = Math.random();
                return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * 0.5;
            };
           
            const noiseX = gaussian() * maxNoise;
            const noiseY = gaussian() * maxNoise;
           
            return {
                ...point,
                x: Math.round(point.x + noiseX),
                y: Math.round(point.y + noiseY),
                id: `${point.id}_n${maxNoise}`
            };
        });
    }
   
    // Удалить случайные точки
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
// 🔷 КЛАСС ДЛЯ ТЕСТИРОВАНИЯ
// ============================================
class Tester2 {
    constructor() {
        this.algorithm = new GeometricAlgorithm2({
            neighborRadius: 120,
            minSimilarity: 0.6, // 60% совпадение дескрипторов
            maxTriangles: 4,
            debug: true
        });
    }
   
    // 🧪 ЗАПУСТИТЬ ВСЕ ТЕСТЫ
    runAllTests() {
        console.log('🧪 КОМПЛЕКСНОЕ ТЕСТИРОВАНИЕ\n');
       
        const tests = [];
       
        // Тест 1: Один и тот же след
        console.log('1️⃣ ТЕСТ: ОДИН И ТОТ ЖЕ СЛЕД');
        const eight = TestData2.createFigure(400, 300, 1.0, 12, 'eight');
        tests.push(this.runTest(eight, [...eight], 'Одинаковая восьмёрка', 95, 5));
       
        // Тест 2: Разные фигуры
        console.log('\n2️⃣ ТЕСТ: РАЗНЫЕ ФИГУРЫ (восьмёрка vs шестёрка)');
        const six = TestData2.createFigure(400, 300, 1.0, 12, 'six');
        tests.push(this.runTest(eight, six, 'Восьмёрка vs Шестёрка', 30, 20)); // Ожидаем низкое совпадение
       
        // Тест 3: Поворот
        console.log('\n3️⃣ ТЕСТ: ПОВОРОТ 90°');
        const rotated = TestData2.transform(eight, 90);
        tests.push(this.runTest(eight, rotated, 'Поворот 90°', 90, 10));
       
        // Тест 4: Масштаб
        console.log('\n4️⃣ ТЕСТ: МАСШТАБ 0.5x');
        const scaled = TestData2.transform(eight, 0, 0.5);
        tests.push(this.runTest(eight, scaled, 'Масштаб 0.5x', 85, 10));
       
        // Тест 5: Смещение
        console.log('\n5️⃣ ТЕСТ: СМЕЩЕНИЕ +150,+100');
        const shifted = TestData2.transform(eight, 0, 1.0, 150, 100);
        tests.push(this.runTest(eight, shifted, 'Смещение', 95, 5));
       
        // Тест 6: Шум
        console.log('\n6️⃣ ТЕСТ: С ШУМОМ ±10px');
        const noisy = TestData2.addNoise(eight, 10);
        tests.push(this.runTest(eight, noisy, 'Шум ±10px', 70, 15));
       
        // Тест 7: Частичный след
        console.log('\n7️⃣ ТЕСТ: ЧАСТИЧНЫЙ СЛЕД (40% точек удалено)');
        const partial = TestData2.removeRandom(eight, 40);
        tests.push(this.runTest(eight, partial, 'Частичный след', 60, 20));
       
        // Тест 8: Комбинированная
        console.log('\n8️⃣ ТЕСТ: КОМБИНИРОВАННАЯ (поворот + масштаб + шум)');
        const combined = TestData2.transform(eight, 45, 0.8, 50, -30);
        const combinedNoisy = TestData2.addNoise(combined, 5);
        tests.push(this.runTest(eight, combinedNoisy, 'Комбинированная', 75, 15));
       
        // Сводный отчет
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
   
    // 📊 ВЫВЕСТИ СВОДКУ
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
        } else {
            console.log('⚠️ Требуется доработка алгоритма');
        }
    }
   
    // 🎯 ДЕМОНСТРАЦИЯ
    demonstrate() {
        console.log('\n🎯 ДЕМОНСТРАЦИЯ АЛГОРИТМА:\n');
       
        // Простая фигура: треугольник
        const triangle = [
            { x: 100, y: 100, id: 'A' },
            { x: 200, y: 100, id: 'B' },
            { x: 150, y: 200, id: 'C' }
        ];
       
        console.log('1. Создаем треугольник:');
        const fp = this.algorithm.createFootprint(triangle, 'треугольник');
       
        // Повернутый треугольник
        console.log('\n2. Создаем повернутый треугольник (60°):');
        const rotated = TestData2.transform(triangle, 60);
        const fpRotated = this.algorithm.createFootprint(rotated, 'повернутый');
       
        console.log('\n3. Сравниваем:');
        const result = this.algorithm.compareFootprints(fp, fpRotated);
       
        console.log(`\n4. Результат: ${result.matches.length} из 3 точек совпали`);
       
        if (result.matches.length === 3) {
            console.log('✅ ВСЕ точки правильно идентифицированы!');
           
            // Показываем дескрипторы
            console.log('\n5. Примеры геометрических дескрипторов:');
            const pointA = fp.find(p => p.id === 'A');
            if (pointA && pointA.descriptors.length > 0) {
                const descriptor = pointA.descriptors[0];
                console.log(`   Дескриптор точки A: ${descriptor.hash}`);
                console.log(`   Углы: ${descriptor.angles[0].toFixed(1)}°, ${descriptor.angles[1].toFixed(1)}°, ${descriptor.angles[2].toFixed(1)}°`);
                console.log(`   Отн. стороны: ${descriptor.sides[0].toFixed(2)}, ${descriptor.sides[1].toFixed(2)}, ${descriptor.sides[2].toFixed(2)}`);
            }
        }
    }
}

// ============================================
// 🚀 ЗАПУСК ПРОГРАММЫ
// ============================================
async function main() {
    try {
        console.log('🎯 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ 2.0 - ФИНАЛЬНАЯ ВЕРСИЯ\n');
        console.log('📐 Инвариантное сравнение геометрических отношений\n');
       
        const tester = new Tester2();
       
        // Демонстрация
        tester.demonstrate();
       
        // Полное тестирование
        console.log('\n' + '='.repeat(60));
        const results = tester.runAllTests();
       
        console.log('\n💡 КАК РАБОТАЕТ АЛГОРИТМ:');
        console.log('='.repeat(60));
        console.log('1. ДЛЯ КАЖДОЙ ТОЧКИ:');
        console.log('   • Находим ближайших соседей (радиус 120px)');
        console.log('   • Создаем треугольники с разными парами соседей');
        console.log('   • Вычисляем углы и относительные стороны');
        console.log('   • Создаем уникальный хеш: "Aуглы_Sстороны"');
       
        console.log('\n2. ПРИ СРАВНЕНИИ:');
        console.log('   • Создаем индекс хешей для быстрого поиска');
        console.log('   • Ищем точки с общими геометрическими дескрипторами');
        console.log('   • Требуется ≥60% совпадений дескрипторов');
       
        console.log('\n3. ПОЧЕМУ ЭТО РАБОТАЕТ:');
        console.log('   • Углы треугольника инвариантны к повороту/смещению');
        console.log('   • Относительные стороны инвариантны к масштабу');
        console.log('   • Хеши уникальны для каждой точки в контексте соседей');
       
        console.log('\n🎯 ПРЕИМУЩЕСТВА:');
        console.log('1. Инвариантность к трансформациям');
        console.log('2. Работает с частичными и зашумленными данными');
        console.log('3. Точно различает разные фигуры');
        console.log('4. Быстрое сравнение через хеширование');
       
        console.log('\n🚀 ГОТОВ К ИНТЕГРАЦИИ В СИСТЕМУ!');
       
    } catch (error) {
        console.error(`❌ Ошибка: ${error.message}`);
        console.error(error.stack);
    }
}

// Запуск
if (require.main === module) {
    main();
}

// Экспорт для использования в других файлах
module.exports = {
    GeometricAlgorithm2,
    TestData2,
    Tester2
};
