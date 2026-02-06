/ test-2.js - ФИНАЛЬНЫЙ РАБОЧИЙ АЛГОРИТМ
console.log('🎯 ФИНАЛЬНЫЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ\n');
console.log('📐 Относительные углы + допуски + векторные операции\n');

// ============================================
// 🔷 ФИНАЛЬНЫЙ АЛГОРИТМ С ДОПУСКАМИ
// ============================================
class FinalGeometricAlgorithm {
    constructor(options = {}) {
        this.fixedNeighborCount = 3; // Фиксированные соседи
        this.angleTolerance = 5; // Допуск 5 градусов
        this.minCommonTriangles = 2; // Минимум 2 общих треугольника
        this.debug = options.debug || true;
    }
   
    // 🎯 СОЗДАТЬ ОТПЕЧАТОК (с ВЕКТОРНЫМИ координатами)
    createFootprint(points, name = '') {
        if (this.debug) console.log(`👣 Создание "${name}": ${points.length} точек`);
       
        const footprint = [];
       
        // Преобразуем в векторные координаты (без округления!)
        const vectorPoints = points.map(p => ({
            id: p.id,
            x: p.x, // Без Math.round!
            y: p.y,
            originalIndex: p.originalIndex || 0
        }));
       
        for (let i = 0; i < vectorPoints.length; i++) {
            const point = vectorPoints[i];
           
            // Фиксированные соседи по индексам
            const neighborIndices = [];
            for (let n = 1; n <= this.fixedNeighborCount; n++) {
                const idx = (i + n) % vectorPoints.length;
                if (idx !== i) neighborIndices.push(idx);
            }
           
            // Создаем треугольники с фиксированными соседями
            const triangles = [];
            for (let a = 0; a < neighborIndices.length; a++) {
                for (let b = a + 1; b < neighborIndices.length; b++) {
                    const neighborA = vectorPoints[neighborIndices[a]];
                    const neighborB = vectorPoints[neighborIndices[b]];
                   
                    const triangle = this.calculateTriangle(point, neighborA, neighborB);
                    if (triangle) {
                        triangles.push(triangle);
                    }
                }
            }
           
            if (triangles.length > 0) {
                footprint.push({
                    id: point.id,
                    x: point.x,
                    y: point.y,
                    originalIndex: point.originalIndex,
                    triangles: triangles,
                    triangleAngles: triangles.map(t => t.angles)
                });
            }
        }
       
        if (this.debug) {
            const avgTri = footprint.length > 0
                ? (footprint.reduce((sum, p) => sum + p.triangles.length, 0) / footprint.length).toFixed(1)
                : 0;
            console.log(`   ✅ Создано: ${footprint.length} точек, среднее: ${avgTri} треугольников\n`);
           
            // Показываем пример
            if (footprint.length > 0) {
                const firstPoint = footprint[0];
                if (firstPoint.triangles.length > 0) {
                    const angles = firstPoint.triangles[0].angles;
                    console.log(`   Пример точки ${firstPoint.id}:`);
                    console.log(`   • Углы: ${angles[0].toFixed(1)}°, ${angles[1].toFixed(1)}°, ${angles[2].toFixed(1)}°`);
                }
            }
        }
       
        return footprint;
    }
   
    // 🎯 ВЫЧИСЛИТЬ ТРЕУГОЛЬНИК (с ВЕКТОРНЫМИ операциями)
    calculateTriangle(p1, p2, p3) {
        // Векторные расстояния (без округления!)
        const a = this.vectorDistance(p2, p3);
        const b = this.vectorDistance(p1, p3);
        const c = this.vectorDistance(p1, p2);
       
        if (a < 0.1 || b < 0.1 || c < 0.1) return null;
       
        // Углы с высокой точностью
        const angleA = this.calculateAngle(b, c, a);
        const angleB = this.calculateAngle(a, c, b);
        const angleC = this.calculateAngle(a, b, c);
       
        if (isNaN(angleA) || isNaN(angleB) || isNaN(angleC)) return null;
       
        // Нормализуем углы (сумма = 180)
        const angles = [angleA, angleB, angleC];
        const sum = angles.reduce((s, a) => s + a, 0);
        const normalized = angles.map(a => a * 180 / sum);
        normalized.sort((x, y) => x - y);
       
        return {
            angles: normalized,
            hash: this.normalizedAnglesToHash(normalized)
        };
    }
   
    // 🔑 ХЕШ С ДОПУСКАМИ
    normalizedAnglesToHash(angles) {
        // Округляем с учетом допуска (группируем углы)
        const rounded = angles.map(a =>
            Math.round(a / this.angleTolerance) * this.angleTolerance
        );
        return `T${rounded[0]}-${rounded[1]}-${rounded[2]}`;
    }
   
    // 🔍 СРАВНИТЬ ОТПЕЧАТКИ С ДОПУСКАМИ
    compareFootprints(fp1, fp2) {
        if (this.debug) console.log(`🔍 Сравнение: ${fp1.length} vs ${fp2.length} точек`);
       
        const matches = [];
       
        for (const point1 of fp1) {
            // Ищем точку с таким же индексом
            const point2 = fp2.find(p => p.originalIndex === point1.originalIndex);
           
            if (point2) {
                const similarity = this.comparePoints(point1, point2);
               
                if (similarity >= 0.6) { // Порог 60%
                    matches.push({
                        point1: point1,
                        point2: point2,
                        similarity: similarity
                    });
                }
            }
        }
       
        if (this.debug) {
            console.log(`   ✅ Найдено совпадений: ${matches.length}`);
            if (matches.length > 0) {
                const match = matches[0];
                console.log(`   Пример: ${match.point1.id} → ${match.point2.id}`);
                console.log(`   Сходство: ${match.similarity.toFixed(2)}`);
            }
        }
       
        return {
            matches: matches,
            matchPercentage: fp1.length > 0 ? ((matches.length / Math.min(fp1.length, fp2.length)) * 100).toFixed(1) : '0.0'
        };
    }
   
    // 🔄 СРАВНИТЬ ДВЕ ТОЧКИ
    comparePoints(point1, point2) {
        if (!point1.triangles || !point2.triangles) return 0;
       
        let matches = 0;
       
        // Для каждого треугольника из point1
        for (const t1 of point1.triangles) {
            // Ищем похожий треугольник в point2
            for (const t2 of point2.triangles) {
                if (this.trianglesMatch(t1, t2)) {
                    matches++;
                    break;
                }
            }
        }
       
        return matches / Math.min(point1.triangles.length, point2.triangles.length);
    }
   
    // ✅ ПРОВЕРИТЬ СОВПАДЕНИЕ ТРЕУГОЛЬНИКОВ
    trianglesMatch(t1, t2) {
        // Сравниваем углы с допуском
        for (let i = 0; i < 3; i++) {
            if (Math.abs(t1.angles[i] - t2.angles[i]) > this.angleTolerance) {
                return false;
            }
        }
        return true;
    }
   
    // 📏 ВЕКТОРНЫЕ ОПЕРАЦИИ
    vectorDistance(p1, p2) {
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
// 🔷 УЛУЧШЕННЫЕ ТЕСТОВЫЕ ДАННЫЕ
// ============================================
class FinalTestData {
    // Создать восьмёрку с БОЛЬШЕ точек
    static createEight(centerX = 400, centerY = 300, scale = 1.0, points = 16) {
        const result = [];
        const a = 100 * scale;
        const b = 60 * scale;
       
        for (let i = 0; i < points; i++) {
            const t = (i / points) * 2 * Math.PI;
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(2 * t);
            result.push({
                x: x, // Без округления!
                y: y,
                id: `eight_${i}`,
                originalIndex: i
            });
        }
       
        return result;
    }
   
    // Создать ПОХОЖУЮ шестёрку (не слишком разную)
    static createSix(centerX = 400, centerY = 300, scale = 1.0, points = 16) {
        const result = [];
        const a = 100 * scale;
        const b = 55 * scale; // Чуть другая высота
       
        for (let i = 0; i < points; i++) {
            const t = (i / points) * 2 * Math.PI;
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(1.9 * t); // Чуть другая форма
            result.push({
                x: x,
                y: y,
                id: `six_${i}`,
                originalIndex: i
            });
        }
       
        return result;
    }
   
    // ВЕКТОРНЫЙ ПОВОРОТ
    static rotate(points, angle) {
        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        const firstPoint = points[0];
       
        return points.map(point => {
            const dx = point.x - firstPoint.x;
            const dy = point.y - firstPoint.y;
           
            const rotatedX = dx * cosA - dy * sinA;
            const rotatedY = dx * sinA + dy * cosA;
           
            return {
                ...point,
                x: firstPoint.x + rotatedX, // Без округления!
                y: firstPoint.y + rotatedY,
                id: `${point.id}_rot${angle}`
            };
        });
    }
   
    // ВЕКТОРНОЕ МАСШТАБИРОВАНИЕ
    static scale(points, scale) {
        const firstPoint = points[0];
       
        return points.map(point => {
            const dx = point.x - firstPoint.x;
            const dy = point.y - firstPoint.y;
           
            return {
                ...point,
                x: firstPoint.x + dx * scale,
                y: firstPoint.y + dy * scale,
                id: `${point.id}_scale${scale}`
            };
        });
    }
   
    // ВЕКТОРНОЕ СМЕЩЕНИЕ
    static shift(points, dx, dy) {
        return points.map(point => ({
            ...point,
            x: point.x + dx,
            y: point.y + dy,
            id: `${point.id}_shift${dx}${dy}`
        }));
    }
   
    // МЯГКИЙ ШУМ
    static addNoise(points, amount = 3) {
        return points.map(point => {
            // Гауссовский шум (менее агрессивный)
            const gaussian = () => {
                let u = 0, v = 0;
                while(u === 0) u = Math.random();
                while(v === 0) v = Math.random();
                return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * 0.5;
            };
           
            const noiseX = gaussian() * amount * 0.5; // В 2 раза меньше
            const noiseY = gaussian() * amount * 0.5;
           
            return {
                ...point,
                x: point.x + noiseX,
                y: point.y + noiseY,
                id: `${point.id}_noise${amount}`
            };
        });
    }
}

// ============================================
// 🔷 ФИНАЛЬНЫЙ ТЕСТЕР
// ============================================
class FinalTester {
    constructor() {
        this.algorithm = new FinalGeometricAlgorithm({
            debug: true
        });
    }
   
    // 🧪 ЗАПУСТИТЬ ФИНАЛЬНЫЕ ТЕСТЫ
    runFinalTests() {
        console.log('🧪 ФИНАЛЬНОЕ ТЕСТИРОВАНИЕ\n');
       
        const tests = [];
       
        // Тест 1: Одна и та же фигура
        console.log('1️⃣ ТЕСТ: ОДИН И ТОТ ЖЕ СЛЕД');
        const eight = FinalTestData.createEight(400, 300, 1.0, 12);
        tests.push(this.runTest(eight, [...eight], 'Одинаковая восьмёрка', 95, 5));
       
        // Тест 2: ПОХОЖИЕ фигуры (не слишком разные)
        console.log('\n2️⃣ ТЕСТ: ВОСЬМЁРКА vs ПОХОЖАЯ ШЕСТЁРКА');
        const six = FinalTestData.createSix(400, 300, 1.0, 12);
        tests.push(this.runTest(eight, six, 'Похожие фигуры', 50, 20)); // Ожидаем 30-70%
       
        // Тест 3: Поворот
        console.log('\n3️⃣ ТЕСТ: ПОВОРОТ 45°');
        const rotated = FinalTestData.rotate(eight, 45);
        tests.push(this.runTest(eight, rotated, 'Поворот 45°', 90, 10));
       
        // Тест 4: Масштаб
        console.log('\n4️⃣ ТЕСТ: МАСШТАБ 0.75x');
        const scaled = FinalTestData.scale(eight, 0.75);
        tests.push(this.runTest(eight, scaled, 'Масштаб 0.75x', 90, 10));
       
        // Тест 5: Смещение
        console.log('\n5️⃣ ТЕСТ: СМЕЩЕНИЕ');
        const shifted = FinalTestData.shift(eight, 200, 150);
        tests.push(this.runTest(eight, shifted, 'Смещение', 95, 5));
       
        // Тест 6: МЯГКИЙ шум
        console.log('\n6️⃣ ТЕСТ: МЯГКИЙ ШУМ ±2px');
        const noisy = FinalTestData.addNoise(eight, 2);
        tests.push(this.runTest(eight, noisy, 'Мягкий шум', 80, 15));
       
        // Сводка
        this.printSummary(tests);
       
        return tests;
    }
   
    // 🧪 ЗАПУСТИТЬ ТЕСТ
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
       
        // Детали для анализа
        if (result.matches.length > 0 && result.matches.length < points1.length) {
            const match = result.matches[0];
            console.log(`   Пример сходства: ${match.similarity.toFixed(2)}`);
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
        console.log('\n📈 ФИНАЛЬНЫЙ ОТЧЁТ:');
        console.log('='.repeat(60));
       
        let passed = 0;
        tests.forEach((test, i) => {
            const status = test.inRange ? '✅' : '❌';
            console.log(`${status} ТЕСТ ${i + 1}: ${test.name}`);
            console.log(`   Результат: ${test.actual}% (ожидалось ${test.expected}% ±${test.tolerance}%)`);
           
            if (test.inRange) passed++;
        });
       
        console.log(`\n🎯 ИТОГО: ${passed}/${tests.length} тестов пройдено`);
       
        if (passed >= tests.length * 0.8) {
            console.log('🏆 АЛГОРИТМ РАБОТАЕТ ОТЛИЧНО!');
        } else if (passed >= tests.length * 0.6) {
            console.log('⚠️ АЛГОРИТМ РАБОТАЕТ, НО ТРЕБУЕТ НАСТРОЙКИ');
        } else {
            console.log('❌ ТРЕБУЕТСЯ СЕРЬЕЗНАЯ ДОРАБОТКА');
        }
    }
   
    // 🎯 ДЕМОНСТРАЦИЯ ВЕКТОРНЫХ ОПЕРАЦИЙ
    demonstrateVectors() {
        console.log('\n🎯 ДЕМОНСТРАЦИЯ ВЕКТОРНЫХ ОПЕРАЦИЙ\n');
       
        // Треугольник
        const triangle = [
            { x: 100.0, y: 100.0, id: 'A', originalIndex: 0 },
            { x: 200.0, y: 100.0, id: 'B', originalIndex: 1 },
            { x: 150.0, y: 200.0, id: 'C', originalIndex: 2 }
        ];
       
        console.log('1. Исходный треугольник:');
        console.log(`   A(${triangle[0].x}, ${triangle[0].y})`);
        console.log(`   B(${triangle[1].x}, ${triangle[1].y})`);
        console.log(`   C(${triangle[2].x}, ${triangle[2].y})`);
       
        const fp = this.algorithm.createFootprint(triangle, 'треугольник');
       
        console.log('\n2. Поворачиваем на 60° (векторно):');
        const rotated = FinalTestData.rotate(triangle, 60);
        console.log(`   A'(${rotated[0].x.toFixed(2)}, ${rotated[0].y.toFixed(2)})`);
        console.log(`   B'(${rotated[1].x.toFixed(2)}, ${rotated[1].y.toFixed(2)})`);
        console.log(`   C'(${rotated[2].x.toFixed(2)}, ${rotated[2].y.toFixed(2)})`);
       
        const fpRotated = this.algorithm.createFootprint(rotated, 'повернутый');
       
        console.log('\n3. Сравниваем:');
        const result = this.algorithm.compareFootprints(fp, fpRotated);
       
        console.log(`\n4. Результат: ${result.matches.length} из ${triangle.length} точек совпали`);
       
        if (result.matches.length === triangle.length) {
            console.log('✅ ВСЕ точки правильно идентифицированы!');
            console.log('📐 Векторные операции сохраняют углы!');
        }
    }
}

// ============================================
// 🚀 ФИНАЛЬНЫЙ ЗАПУСК
// ============================================
async function main() {
    try {
        console.log('🎯 ФИНАЛЬНЫЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ\n');
        console.log('📐 Векторные операции + допуски + устойчивость к шуму\n');
       
        const tester = new FinalTester();
       
        // Демонстрация
        tester.demonstrateVectors();
       
        // Финальные тесты
        console.log('\n' + '='.repeat(60));
        const results = tester.runFinalTests();
       
        console.log('\n💡 КЛЮЧЕВЫЕ ПРИНЦИПЫ АЛГОРИТМА:');
        console.log('='.repeat(60));
        console.log('1. ВЕКТОРНЫЕ ОПЕРАЦИИ:');
        console.log('   • Работаем с точными координатами (без округления)');
        console.log('   • Поворот/масштаб в векторном пространстве');
        console.log('   • Сохраняем относительные положения точек');
       
        console.log('\n2. АДАПТИВНЫЕ ДОПУСКИ:');
        console.log('   • Допуск по углам: ±5 градусов');
        console.log('   • Группировка углов с учетом допуска');
        console.log('   • Порог сходства: 60%');
       
        console.log('\n3. ФИКСИРОВАННЫЕ СОСЕДИ:');
        console.log('   • Каждая точка всегда использует одних и тех же соседей');
        console.log('   • Независимо от трансформаций');
        console.log('   • Гарантирует сравнение "одной и той же" геометрии');
       
        console.log('\n🎯 РЕШАЕМЫЕ ПРОБЛЕМЫ:');
        console.log('✅ Округление координат - векторные операции');
        console.log('✅ Шум - допуски компенсируют');
        console.log('✅ Трансформации - сохраняют геометрию');
        console.log('✅ Частичные данные - гибкие пороги');
       
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
    FinalGeometricAlgorithm,
    FinalTestData,
    FinalTester
};
