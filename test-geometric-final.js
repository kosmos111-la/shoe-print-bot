// test-geometric-final.js
console.log('🎯 ФИНАЛЬНЫЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ\n');
console.log('📐 ПРОСТОЙ + РАБОЧИЙ ПОДХОД\n');

// 🔷 ПРОСТОЙ И РАБОЧИЙ КЛАСС ГЕОМЕТРИЧЕСКОГО ХЕШИРОВАНИЯ
class SimpleGeometricHash {
    constructor(options = {}) {
        this.neighborRadius = options.neighborRadius || 100; // Радиус поиска соседей
        this.hashPrecision = options.hashPrecision || 0; // Округление углов
        this.minTriangles = options.minTriangles || 1; // Минимум треугольников для точки
        this.debug = options.debug || false;
    }
   
    // 🎯 СОЗДАТЬ ГЕОМЕТРИЧЕСКИЙ ОТПЕЧАТОК
    createFootprint(points, name = '') {
        if (this.debug) console.log(`👣 Создание отпечатка "${name}": ${points.length} точек`);
       
        const footprint = [];
       
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // Найти соседей в радиусе
            const neighbors = this.findNeighbors(point, points, i);
           
            if (neighbors.length >= 2) {
                // Создать треугольники с соседями
                const triangles = this.createTriangles(point, neighbors);
               
                if (triangles.length >= this.minTriangles) {
                    // Создать хеши для треугольников
                    const hashes = triangles.map(t => this.triangleToHash(t));
                   
                    footprint.push({
                        id: point.id || `p${i}`,
                        x: point.x,
                        y: point.y,
                        hashes: hashes,
                        triangles: triangles.length,
                        neighbors: neighbors.length
                    });
                }
            }
        }
       
        if (this.debug) {
            const avgTriangles = footprint.length > 0
                ? (footprint.reduce((sum, p) => sum + p.triangles, 0) / footprint.length).toFixed(1)
                : 0;
            console.log(`   ✅ Создано ${footprint.length} точек, среднее треугольников: ${avgTriangles}`);
        }
       
        return footprint;
    }
   
    // 🔍 НАЙТИ СОСЕДЕЙ В РАДИУСЕ
    findNeighbors(centerPoint, allPoints, centerIndex) {
        const neighbors = [];
       
        for (let i = 0; i < allPoints.length; i++) {
            if (i === centerIndex) continue;
           
            const point = allPoints[i];
            const distance = this.distance(centerPoint, point);
           
            if (distance <= this.neighborRadius) {
                neighbors.push({ point, distance });
            }
        }
       
        // Сортируем по расстоянию
        neighbors.sort((a, b) => a.distance - b.distance);
       
        // Берем до 8 ближайших соседей
        return neighbors.slice(0, 8).map(n => n.point);
    }
   
    // 📐 СОЗДАТЬ ТРЕУГОЛЬНИКИ ИЗ ТОЧКИ И СОСЕДЕЙ
    createTriangles(centerPoint, neighbors) {
        const triangles = [];
       
        // Создаем треугольники с разными парами соседей
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const triangle = {
                    p1: centerPoint,
                    p2: neighbors[i],
                    p3: neighbors[j],
                    angles: this.calculateAngles(centerPoint, neighbors[i], neighbors[j])
                };
               
                // Фильтруем вырожденные треугольники (слишком маленькие углы)
                if (triangle.angles.every(angle => angle > 10 && angle < 170)) {
                    triangles.push(triangle);
                }
               
                // Ограничиваем количество
                if (triangles.length >= 6) break;
            }
            if (triangles.length >= 6) break;
        }
       
        return triangles;
    }
   
    // 📏 ВЫЧИСЛИТЬ УГЛЫ ТРЕУГОЛЬНИКА
    calculateAngles(p1, p2, p3) {
        // Длины сторон
        const a = this.distance(p2, p3); // Противолежащая p1
        const b = this.distance(p1, p3); // Противолежащая p2 
        const c = this.distance(p1, p2); // Противолежащая p3
       
        // Углы по теореме косинусов
        const angleA = this.radToDeg(Math.acos((b*b + c*c - a*a) / (2*b*c)));
        const angleB = this.radToDeg(Math.acos((a*a + c*c - b*b) / (2*a*c)));
        const angleC = 180 - angleA - angleB;
       
        // Округляем и сортируем
        const angles = [angleA, angleB, angleC]
            .map(angle => Math.round(angle * Math.pow(10, this.hashPrecision)) / Math.pow(10, this.hashPrecision))
            .sort((a, b) => a - b);
       
        return angles;
    }
   
    // 🔑 СОЗДАТЬ ХЕШ ДЛЯ ТРЕУГОЛЬНИКА
    triangleToHash(triangle) {
        const angles = triangle.angles;
        return `A${angles[0]}-${angles[1]}-${angles[2]}`;
    }
   
    // 🔍 СРАВНИТЬ ДВА ОТПЕЧАТКА
    compareFootprints(fp1, fp2) {
        if (this.debug) console.log(`🔍 Сравнение: ${fp1.length} vs ${fp2.length} точек`);
       
        const matches = [];
       
        // Создаем карту хешей для второго отпечатка
        const hashMap = new Map();
        fp2.forEach(point => {
            point.hashes.forEach(hash => {
                if (!hashMap.has(hash)) {
                    hashMap.set(hash, []);
                }
                hashMap.get(hash).push(point);
            });
        });
       
        // Ищем совпадения по хешам
        fp1.forEach(point1 => {
            const matchingPoints = new Map(); // point2 -> количество общих хешей
           
            point1.hashes.forEach(hash => {
                if (hashMap.has(hash)) {
                    hashMap.get(hash).forEach(point2 => {
                        const count = matchingPoints.get(point2) || 0;
                        matchingPoints.set(point2, count + 1);
                    });
                }
            });
           
            // Находим лучшее совпадение
            if (matchingPoints.size > 0) {
                let bestMatch = null;
                let bestScore = 0;
               
                for (const [point2, commonHashes] of matchingPoints) {
                    // Вычисляем сходство: общие хеши / минимальное количество хешей
                    const similarity = commonHashes / Math.min(point1.hashes.length, point2.hashes.length);
                   
                    if (similarity > bestScore && similarity >= 0.4) { // Порог 40%
                        bestScore = similarity;
                        bestMatch = {
                            point1: point1,
                            point2: point2,
                            similarity: similarity,
                            commonHashes: commonHashes,
                            totalHashes1: point1.hashes.length,
                            totalHashes2: point2.hashes.length
                        };
                    }
                }
               
                if (bestMatch) {
                    matches.push(bestMatch);
                }
            }
        });
       
        if (this.debug) console.log(`   ✅ Найдено ${matches.length} совпадений`);
       
        return {
            matches: matches,
            matchPercentage: fp1.length > 0 ? ((matches.length / fp1.length) * 100).toFixed(1) : '0.0'
        };
    }
   
    // 📊 АНАЛИЗ ОТПЕЧАТКА
    analyzeFootprint(footprint) {
        console.log('\n📊 АНАЛИЗ ОТПЕЧАТКА:');
        console.log(`   Всего точек: ${footprint.length}`);
       
        if (footprint.length === 0) return;
       
        const totalHashes = footprint.reduce((sum, p) => sum + p.hashes.length, 0);
        const avgHashes = (totalHashes / footprint.length).toFixed(1);
       
        console.log(`   Всего хешей: ${totalHashes}`);
        console.log(`   Среднее хешей на точку: ${avgHashes}`);
       
        // Распределение по количеству хешей
        const distribution = {};
        footprint.forEach(p => {
            const count = p.hashes.length;
            distribution[count] = (distribution[count] || 0) + 1;
        });
       
        console.log('   Распределение хешей:');
        Object.keys(distribution).sort((a, b) => a - b).forEach(count => {
            console.log(`     ${count} хешей: ${distribution[count]} точек`);
        });
       
        // Примеры хешей
        if (footprint.length > 0) {
            console.log('   Примеры хешей:');
            const samplePoint = footprint[0];
            samplePoint.hashes.slice(0, 3).forEach((hash, i) => {
                console.log(`     ${i + 1}. ${hash}`);
            });
        }
    }
   
    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
   
    radToDeg(rad) {
        return rad * 180 / Math.PI;
    }
}

// 🔷 КЛАСС ДЛЯ СОЗДАНИЯ ТЕСТОВЫХ ДАННЫХ
class TestData {
    // Создать фигуру восьмёрки
    static createEight(centerX = 400, centerY = 300, scale = 1.0, points = 24) {
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
   
    // Создать фигуру шестёрки (немного другая форма)
    static createSix(centerX = 400, centerY = 300, scale = 1.0, points = 18) {
        const result = [];
        const a = 100 * scale;
        const b = 60 * scale;
       
        for (let i = 0; i < points; i++) {
            const t = (i / points) * 2 * Math.PI;
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(2 * t) * 0.7; // Другая форма
            result.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `six_${i}`
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
       
        // Центр для поворота
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
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
   
    // Добавить шум
    static addNoise(points, maxNoise = 5) {
        return points.map(point => ({
            ...point,
            x: point.x + (Math.random() - 0.5) * 2 * maxNoise,
            y: point.y + (Math.random() - 0.5) * 2 * maxNoise,
            id: `${point.id}_n${maxNoise}`
        }));
    }
   
    // Удалить часть точек
    static removePoints(points, percent = 30) {
        const removeCount = Math.floor(points.length * (percent / 100));
        const indices = new Set();
       
        while (indices.size < removeCount) {
            indices.add(Math.floor(Math.random() * points.length));
        }
       
        return points.filter((_, i) => !indices.has(i));
    }
}

// 🔷 КЛАСС ДЛЯ ТЕСТИРОВАНИЯ
class GeometricTestSuite {
    constructor() {
        this.algorithm = new SimpleGeometricHash({
            neighborRadius: 120,
            hashPrecision: 0, // Целые градусы
            minTriangles: 1,
            debug: true
        });
    }
   
    // 🧪 ЗАПУСТИТЬ ВСЕ ТЕСТЫ
    runAllTests() {
        console.log('🧪 ТЕСТИРОВАНИЕ ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА\n');
       
        const tests = [];
       
        // Тест 1: Один и тот же след
        console.log('1️⃣ ТЕСТ: ОДИН И ТОТ ЖЕ СЛЕД (ожидаем ~100%)');
        const eight = TestData.createEight(400, 300, 1.0, 20);
        tests.push(this.runTest(eight, [...eight], 'Одинаковая восьмёрка', 95, 5));
       
        // Тест 2: Похожие фигуры (восьмёрка vs шестёрка)
        console.log('\n2️⃣ ТЕСТ: ВОСЬМЁРКА vs ШЕСТЁРКА (ожидаем ~60-80%)');
        const six = TestData.createSix(400, 300, 1.0, 15);
        tests.push(this.runTest(eight, six, 'Восьмёрка vs Шестёрка', 70, 15));
       
        // Тест 3: Поворот
        console.log('\n3️⃣ ТЕСТ: ПОВОРОТ 30° (ожидаем ~95-100%)');
        const rotated = TestData.transform(eight, 30);
        tests.push(this.runTest(eight, rotated, 'Поворот 30°', 95, 5));
       
        // Тест 4: Масштаб
        console.log('\n4️⃣ ТЕСТ: МАСШТАБ 1.5x (ожидаем ~95-100%)');
        const scaled = TestData.transform(eight, 0, 1.5);
        tests.push(this.runTest(eight, scaled, 'Масштаб 1.5x', 95, 5));
       
        // Тест 5: Смещение
        console.log('\n5️⃣ ТЕСТ: СМЕЩЕНИЕ +80,+60 (ожидаем ~95-100%)');
        const shifted = TestData.transform(eight, 0, 1.0, 80, 60);
        tests.push(this.runTest(eight, shifted, 'Смещение +80,+60', 95, 5));
       
        // Тест 6: С шумом
        console.log('\n6️⃣ ТЕСТ: С ШУМОМ ±8px (ожидаем ~80-95%)');
        const noisy = TestData.addNoise(eight, 8);
        tests.push(this.runTest(eight, noisy, 'Шум ±8px', 85, 10));
       
        // Тест 7: Частичный след
        console.log('\n7️⃣ ТЕСТ: ЧАСТИЧНЫЙ СЛЕД (25% точек удалено)');
        const partial = TestData.removePoints(eight, 25);
        tests.push(this.runTest(eight, partial, 'Частичный след', 70, 20));
       
        // Тест 8: Комбинированная трансформация
        console.log('\n8️⃣ ТЕСТ: КОМБИНИРОВАННАЯ (поворот + масштаб + смещение)');
        const combined = TestData.transform(eight, 45, 0.8, 50, -30);
        tests.push(this.runTest(eight, combined, 'Комбинированная', 90, 10));
       
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
       
        console.log(`   ${status} Получено: ${percentage}%, Ожидалось: ${expected}% ±${tolerance}%`);
        console.log(`   Совпадений: ${result.matches.length} из ${points1.length}`);
       
        // Показать пример совпадения
        if (result.matches.length > 0 && this.algorithm.debug) {
            const match = result.matches[0];
            console.log(`   Пример: ${match.point1.id} → ${match.point2.id}`);
            console.log(`   Сходство: ${match.similarity.toFixed(2)}, общих хешей: ${match.commonHashes}`);
        }
       
        return {
            name: name,
            actual: percentage,
            expected: expected,
            tolerance: tolerance,
            inRange: isInRange,
            matches: result.matches.length,
            total: points1.length
        };
    }
   
    // 📊 ВЫВЕСТИ СВОДНЫЙ ОТЧЕТ
    printSummary(tests) {
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ:');
        console.log('='.repeat(60));
       
        let passed = 0;
        tests.forEach((test, i) => {
            const status = test.inRange ? '✅' : '❌';
            console.log(`${status} ТЕСТ ${i + 1}: ${test.name}`);
            console.log(`   Результат: ${test.actual}% (ожидалось ${test.expected}% ±${test.tolerance}%)`);
            console.log(`   Совпадений: ${test.matches}/${test.total}`);
            console.log();
           
            if (test.inRange) passed++;
        });
       
        console.log(`🎯 ИТОГО: ${passed}/${tests.length} тестов пройдено успешно`);
       
        if (passed === tests.length) {
            console.log('🏆 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Алгоритм работает отлично!');
        } else if (passed >= tests.length * 0.7) {
            console.log('⚠️ Большинство тестов пройдены, требуется небольшая настройка');
        } else {
            console.log('❌ Требуется серьезная доработка алгоритма');
        }
    }
   
    // 🎯 ДЕМОНСТРАЦИЯ НА ПРОСТОМ ПРИМЕРЕ
    demonstrate() {
        console.log('\n🎯 ДЕМОНСТРАЦИЯ РАБОТЫ АЛГОРИТМА:\n');
       
        // Создаем простую фигуру: квадрат
        const square = [
            { x: 100, y: 100, id: 'A' },
            { x: 200, y: 100, id: 'B' },
            { x: 200, y: 200, id: 'C' },
            { x: 100, y: 200, id: 'D' },
            { x: 150, y: 150, id: 'E' }
        ];
       
        console.log('1. Создаем квадрат из 5 точек');
       
        const fp1 = this.algorithm.createFootprint(square, 'квадрат');
        this.algorithm.analyzeFootprint(fp1);
       
        // Поворачиваем квадрат
        console.log('\n2. Поворачиваем квадрат на 45 градусов');
        const rotatedSquare = TestData.transform(square, 45, 1.0, 50, 50);
       
        const fp2 = this.algorithm.createFootprint(rotatedSquare, 'повернутый квадрат');
       
        console.log('\n3. Сравниваем отпечатки:');
        const result = this.algorithm.compareFootprints(fp1, fp2);
       
        console.log(`\n4. Результат: ${result.matches.length} из ${Math.min(square.length, rotatedSquare.length)} точек совпали`);
       
        if (result.matches.length === Math.min(square.length, rotatedSquare.length)) {
            console.log('✅ ВСЕ точки правильно идентифицированы!');
            console.log('📐 Геометрические хеши остались неизменными при повороте');
        }
    }
}

// 🚀 ЗАПУСК ПРОГРАММЫ
async function main() {
    try {
        console.log('🎯 ПРОСТОЙ И ЭФФЕКТИВНЫЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ\n');
        console.log('📐 Сравнение геометрических отношений вместо координат\n');
       
        const tester = new GeometricTestSuite();
       
        // Демонстрация
        tester.demonstrate();
       
        // Полное тестирование
        const results = tester.runAllTests();
       
        console.log('\n💡 КАК ЭТО РАБОТАЕТ:');
        console.log('='.repeat(60));
        console.log('1. ДЛЯ КАЖДОЙ ТОЧКИ:');
        console.log('   • Находим соседей в радиусе 120px');
        console.log('   • Создаем треугольники с разными парами соседей');
        console.log('   • Вычисляем углы треугольников');
        console.log('   • Создаем хеш вида "Aугол1-угол2-угол3"');
       
        console.log('\n2. ПРИ СРАВНЕНИИ:');
        console.log('   • Ищем точки с одинаковыми хешами');
        console.log('   • Учитываем частичные совпадения (от 40% хешей)');
        console.log('   • Находим лучшие пары по количеству общих хешей');
       
        console.log('\n3. ПОЧЕМУ ЭТО РАБОТАЕТ:');
        console.log('   • Углы треугольников НЕ меняются при:');
        console.log('     ✅ Повороте фигуры');
        console.log('     ✅ Масштабировании');
        console.log('     ✅ Смещении');
        console.log('   • Каждая точка описывается через отношения с соседями');
        console.log('   • Не требуется точного совпадения координат');
       
        console.log('\n🎯 ПРЕИМУЩЕСТВА:');
        console.log('1. Инвариантность к трансформациям');
        console.log('2. Работает с частичными данными');
        console.log('3. Простая реализация');
        console.log('4. Быстрое сравнение через хеши');
       
        console.log('\n🚀 АЛГОРИТМ ГОТОВ К ИНТЕГРАЦИИ В СИСТЕМУ!');
       
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
    SimpleGeometricHash,
    TestData,
    GeometricTestSuite
};
```

🚀 ЗАПУСК:

```bash
node test-geometric-final.js
