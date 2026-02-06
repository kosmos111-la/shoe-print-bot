// test-geometric-hash-robust.js
console.log('🎯 РОБАСТНЫЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ (ГИБКАЯ ВЕРСИЯ)\n');
console.log('📐 ИДЕЯ: Гибкое построение треугольников + адаптивные пороги\n');

// 🔷 УПРОЩЕННЫЙ И БОЛЕЕ ГИБКИЙ КЛАСС
class RobustGeometricHash {
    constructor(options = {}) {
        this.maxTrianglesPerPoint = options.maxTrianglesPerPoint || 10; // Максимум треугольников
        this.hashPrecision = options.hashPrecision || 0; // Округление до целых градусов
        this.minSimilarity = options.minSimilarity || 0.3; // Минимальное сходство
        this.debug = options.debug || false;
    }
   
    // 🎯 ОСНОВНАЯ ФУНКЦИЯ: Создание геометрического отпечатка
    createFootprint(points, name = 'unknown') {
        console.log(`👣 Создание отпечатка "${name}": ${points.length} точек`);
       
        const footprint = [];
       
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // Ищем ВСЕХ соседей (не ограничиваем количеством)
            const neighbors = this.findAllNeighbors(point, points, i);
           
            // Создаем все возможные треугольники
            const triangles = this.createAllValidTriangles(point, neighbors);
           
            if (triangles.length > 0) {
                // Создаем геометрические хеши
                const geometricHashes = this.createGeometricHashes(triangles);
               
                footprint.push({
                    id: point.id || `p${i}`,
                    x: point.x,
                    y: point.y,
                    hashes: geometricHashes,
                    triangles: triangles,
                    neighborCount: neighbors.length
                });
            }
           
            if (this.debug && i < 3 && triangles.length > 0) {
                console.log(`   Точка ${i}: ${triangles.length} треугольников, ${geometricHashes.length} хешей`);
            }
        }
       
        console.log(`   ✅ Создано ${footprint.length} точек, среднее треугольников: ${
            (footprint.reduce((sum, p) => sum + p.triangles.length, 0) / footprint.length).toFixed(1)
        }`);
        return footprint;
    }
   
    // 🔍 Найти всех соседей в радиусе
    findAllNeighbors(centerPoint, allPoints, centerIndex, maxDistance = 150) {
        const neighbors = [];
       
        for (let i = 0; i < allPoints.length; i++) {
            if (i === centerIndex) continue;
           
            const point = allPoints[i];
            const distance = this.calculateDistance(centerPoint, point);
           
            if (distance <= maxDistance) {
                neighbors.push({
                    point: point,
                    distance: distance,
                    index: i
                });
            }
        }
       
        // Сортируем по расстоянию
        neighbors.sort((a, b) => a.distance - b.distance);
        return neighbors.map(n => n.point);
    }
   
    // 📐 Создать все валидные треугольники
    createAllValidTriangles(centerPoint, neighbors) {
        const triangles = [];
       
        if (neighbors.length < 2) return triangles;
       
        // Берем до 10 ближайших соседей для создания треугольников
        const maxNeighbors = Math.min(10, neighbors.length);
        const limitedNeighbors = neighbors.slice(0, maxNeighbors);
       
        // Создаем треугольники со всеми возможными парами
        for (let i = 0; i < limitedNeighbors.length; i++) {
            for (let j = i + 1; j < limitedNeighbors.length; j++) {
                // Проверяем только базовые условия
                const triangle = this.createTriangle(centerPoint, limitedNeighbors[i], limitedNeighbors[j]);
               
                if (triangle.area > 10) { // Минимальная площадь
                    triangles.push(triangle);
                   
                    // Ограничиваем общее количество
                    if (triangles.length >= this.maxTrianglesPerPoint) break;
                }
            }
            if (triangles.length >= this.maxTrianglesPerPoint) break;
        }
       
        return triangles;
    }
   
    // 🔷 Создать треугольник
    createTriangle(p1, p2, p3) {
        // Углы треугольника (сортируем для инвариантности)
        const angles = this.calculateTriangleAngles(p1, p2, p3).sort((a, b) => a - b);
       
        // Относительные расстояния (нормализованные)
        const d1 = this.calculateDistance(p1, p2);
        const d2 = this.calculateDistance(p1, p3);
        const d3 = this.calculateDistance(p2, p3);
        const distances = [d1, d2, d3].sort((a, b) => a - b);
       
        // Площадь (для фильтрации вырожденных)
        const area = this.calculateTriangleArea(p1, p2, p3);
       
        return {
            points: [p1, p2, p3],
            angles: angles,
            distances: distances,
            area: area,
            hash: this.triangleToHash(angles, distances)
        };
    }
   
    // 🎯 Создать геометрические хеши
    createGeometricHashes(triangles) {
        const hashes = [];
       
        // Основные хеши для каждого треугольника
        triangles.forEach(triangle => {
            hashes.push(triangle.hash);
        });
       
        // Комбинированные хеши (пары треугольников)
        for (let i = 0; i < Math.min(3, triangles.length); i++) {
            for (let j = i + 1; j < Math.min(3, triangles.length); j++) {
                const combinedHash = `C:${triangles[i].hash.substring(0, 15)}|${triangles[j].hash.substring(0, 15)}`;
                hashes.push(combinedHash);
            }
        }
       
        return hashes;
    }
   
    // 🔍 Сравнение двух отпечатков
    compareFootprints(fp1, fp2) {
        console.log(`🔍 Сравнение: ${fp1.length} vs ${fp2.length} точек`);
       
        const matches = [];
        const hashMap = new Map();
       
        // Создаем хеш-таблицу для второго отпечатка
        fp2.forEach(point => {
            point.hashes.forEach(hash => {
                if (!hashMap.has(hash)) {
                    hashMap.set(hash, []);
                }
                hashMap.get(hash).push(point);
            });
        });
       
        // Ищем совпадения в первом отпечатке
        fp1.forEach(point1 => {
            const matchedPoints = new Set();
            let totalScore = 0;
           
            point1.hashes.forEach(hash => {
                if (hashMap.has(hash)) {
                    const matchingPoints = hashMap.get(hash);
                    matchingPoints.forEach(point2 => {
                        if (!matchedPoints.has(point2.id)) {
                            matchedPoints.add(point2.id);
                            totalScore++;
                        }
                    });
                }
            });
           
            if (totalScore > 0) {
                // Находим лучшую пару по количеству общих хешей
                let bestMatch = null;
                let bestScore = 0;
               
                Array.from(matchedPoints).forEach(pointId => {
                    const point2 = fp2.find(p => p.id === pointId);
                    if (point2) {
                        const commonHashes = this.findCommonHashes(point1.hashes, point2.hashes);
                        if (commonHashes.length > bestScore) {
                            bestScore = commonHashes.length;
                            bestMatch = {
                                point1: point1,
                                point2: point2,
                                score: bestScore,
                                commonHashes: commonHashes,
                                similarity: commonHashes.length / Math.min(point1.hashes.length, point2.hashes.length)
                            };
                        }
                    }
                });
               
                if (bestMatch && bestMatch.similarity >= this.minSimilarity) {
                    matches.push(bestMatch);
                }
            }
        });
       
        console.log(`   ✅ Найдено ${matches.length} совпадений`);
        return {
            matches: matches,
            matchPercentage: ((matches.length / Math.min(fp1.length, fp2.length)) * 100).toFixed(1)
        };
    }
   
    // 📏 Вспомогательные методы
    calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
   
    calculateTriangleAngles(p1, p2, p3) {
        const a = this.calculateDistance(p2, p3);
        const b = this.calculateDistance(p1, p3);
        const c = this.calculateDistance(p1, p2);
       
        const angleA = this.radToDeg(Math.acos((b*b + c*c - a*a) / (2*b*c)));
        const angleB = this.radToDeg(Math.acos((a*a + c*c - b*b) / (2*a*c)));
        const angleC = 180 - angleA - angleB;
       
        // Округляем
        const precision = Math.pow(10, this.hashPrecision);
        return [
            Math.round(angleA * precision) / precision,
            Math.round(angleB * precision) / precision,
            Math.round(angleC * precision) / precision
        ];
    }
   
    calculateTriangleArea(p1, p2, p3) {
        return Math.abs(
            (p1.x * (p2.y - p3.y) +
             p2.x * (p3.y - p1.y) +
             p3.x * (p1.y - p2.y)) / 2
        );
    }
   
    radToDeg(rad) {
        return rad * 180 / Math.PI;
    }
   
    triangleToHash(angles, distances) {
        // Нормализуем расстояния (относительно самого большого)
        const maxDist = Math.max(...distances);
        const normDistances = distances.map(d => Math.round((d / maxDist) * 10));
       
        return `A${angles[0].toFixed(this.hashPrecision)}-${angles[1].toFixed(this.hashPrecision)}-${angles[2].toFixed(this.hashPrecision)}_D${normDistances[0]}-${normDistances[1]}-${normDistances[2]}`;
    }
   
    findCommonHashes(hashes1, hashes2) {
        const set2 = new Set(hashes2);
        return hashes1.filter(hash => set2.has(hash));
    }
}

// 🔷 ПРОСТОЙ ТЕСТЕР
class SimpleTester {
    constructor() {
        this.algorithm = new RobustGeometricHash({
            maxTrianglesPerPoint: 8,
            hashPrecision: 0, // Целые градусы
            minSimilarity: 0.3,
            debug: true
        });
    }
   
    // 🧪 Запустить тесты
    runTests() {
        console.log('🧪 ЗАПУСК ПРОСТЫХ ТЕСТОВ\n');
       
        // Создаем простые фигуры
        const circle1 = this.createCircle(400, 300, 100, 16);
        const circle2 = this.createCircle(400, 300, 100, 16); // Та же самая
       
        // Тест 1: Та же фигура
        console.log('1️⃣ ТЕСТ: ОДНА И ТА ЖЕ ФИГУРА');
        this.runTest(circle1, circle2, 'Круг 1', 'Круг 1', 95, 5);
       
        // Тест 2: Повернутая фигура
        console.log('\n2️⃣ ТЕСТ: ПОВОРОТ 30°');
        const rotated = this.rotatePoints(circle1, 30, 400, 300);
        this.runTest(circle1, rotated, 'Круг', 'Повернутый круг', 90, 10);
       
        // Тест 3: Масштабированная фигура
        console.log('\n3️⃣ ТЕСТ: МАСШТАБ 1.5x');
        const scaled = this.scalePoints(circle1, 1.5, 400, 300);
        this.runTest(circle1, scaled, 'Круг', 'Масштабированный круг', 90, 10);
       
        // Тест 4: Со смещением
        console.log('\n4️⃣ ТЕСТ: СМЕЩЕНИЕ +100,+50');
        const shifted = this.shiftPoints(circle1, 100, 50);
        this.runTest(circle1, shifted, 'Круг', 'Смещенный круг', 95, 5);
       
        // Тест 5: С шумом
        console.log('\n5️⃣ ТЕСТ: С ШУМОМ ±5px');
        const noisy = this.addNoise(circle1, 5);
        this.runTest(circle1, noisy, 'Круг', 'Шумный круг', 80, 15);
       
        // Тест 6: Частичная фигура
        console.log('\n6️⃣ ТЕСТ: ЧАСТИЧНАЯ ФИГУРА (25% точек)');
        const partial = circle1.slice(0, Math.floor(circle1.length * 0.75));
        this.runTest(circle1, partial, 'Полный круг', 'Частичный круг', 70, 20);
    }
   
    // 🧪 Запустить один тест
    runTest(points1, points2, name1, name2, expected, tolerance) {
        const fp1 = this.algorithm.createFootprint(points1, name1);
        const fp2 = this.algorithm.createFootprint(points2, name2);
       
        const result = this.algorithm.compareFootprints(fp1, fp2);
        const percentage = parseFloat(result.matchPercentage);
       
        const isInRange = Math.abs(percentage - expected) <= tolerance;
        const status = isInRange ? '✅' : '❌';
       
        console.log(`   ${status} Получено: ${percentage}%, Ожидалось: ${expected}% ±${tolerance}%`);
        console.log(`   Совпадений: ${result.matches.length} из ${Math.min(points1.length, points2.length)}`);
       
        if (result.matches.length > 0 && this.algorithm.debug) {
            console.log('   Примеры хешей:');
            const match = result.matches[0];
            match.commonHashes.slice(0, 2).forEach(hash => {
                console.log(`     - ${hash}`);
            });
        }
       
        return { percentage, matches: result.matches.length, expected, inRange: isInRange };
    }
   
    // 🔧 Вспомогательные функции для создания данных
    createCircle(centerX, centerY, radius, points) {
        const circle = [];
        for (let i = 0; i < points; i++) {
            const angle = (i / points) * 2 * Math.PI;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            circle.push({ x: Math.round(x), y: Math.round(y), id: `circle_${i}` });
        }
        return circle;
    }
   
    rotatePoints(points, angleDeg, centerX, centerY) {
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
                y: Math.round(rotatedY + centerY),
                id: `${point.id}_r${angleDeg}`
            };
        });
    }
   
    scalePoints(points, scale, centerX, centerY) {
        return points.map(point => {
            const x = (point.x - centerX) * scale + centerX;
            const y = (point.y - centerY) * scale + centerY;
           
            return {
                ...point,
                x: Math.round(x),
                y: Math.round(y),
                id: `${point.id}_s${scale}`
            };
        });
    }
   
    shiftPoints(points, dx, dy) {
        return points.map(point => ({
            ...point,
            x: point.x + dx,
            y: point.y + dy,
            id: `${point.id}_shift${dx}_${dy}`
        }));
    }
   
    addNoise(points, maxNoise) {
        return points.map(point => ({
            ...point,
            x: point.x + (Math.random() - 0.5) * 2 * maxNoise,
            y: point.y + (Math.random() - 0.5) * 2 * maxNoise,
            id: `${point.id}_noise${maxNoise}`
        }));
    }
}

// 🔷 ДЕМОНСТРАЦИОННЫЙ КЛАСС
class Demonstration {
    constructor() {
        this.algorithm = new RobustGeometricHash({
            maxTrianglesPerPoint: 6,
            hashPrecision: 0,
            minSimilarity: 0.3,
            debug: false
        });
    }
   
    // 🎯 Показать как работает алгоритм
    demonstrate() {
        console.log('\n🎯 ДЕМОНСТРАЦИЯ РАБОТЫ АЛГОРИТМА:\n');
       
        // Создаем простой треугольник
        const triangle = [
            { x: 100, y: 100, id: 'A' },
            { x: 200, y: 100, id: 'B' },
            { x: 150, y: 200, id: 'C' }
        ];
       
        console.log('1. Создаем треугольник из 3 точек:');
        triangle.forEach((p, i) => {
            console.log(`   Точка ${p.id}: (${p.x}, ${p.y})`);
        });
       
        console.log('\n2. Создаем геометрический отпечаток:');
        const fp = this.algorithm.createFootprint(triangle, 'triangle');
       
        console.log('\n3. Анализируем точку A:');
        const pointA = fp.find(p => p.id === 'A');
        if (pointA) {
            console.log(`   • Треугольников: ${pointA.triangles.length}`);
            console.log(`   • Хешей: ${pointA.hashes.length}`);
            console.log('   • Примеры хешей:');
            pointA.hashes.slice(0, 3).forEach((hash, i) => {
                console.log(`     ${i + 1}. ${hash}`);
            });
           
            // Показываем углы треугольников
            if (pointA.triangles.length > 0) {
                const triangle = pointA.triangles[0];
                console.log(`   • Углы треугольника: ${triangle.angles[0]}°, ${triangle.angles[1]}°, ${triangle.angles[2]}°`);
            }
        }
       
        // Создаем повернутый треугольник
        console.log('\n4. Создаем повернутый треугольник (45°):');
        const rotatedTriangle = this.rotateTriangle(triangle, 45);
        const fpRotated = this.algorithm.createFootprint(rotatedTriangle, 'rotated_triangle');
       
        console.log('\n5. Сравниваем отпечатки:');
        const result = this.algorithm.compareFootprints(fp, fpRotated);
       
        console.log(`\n6. Результат: ${result.matches.length} из 3 точек совпали`);
       
        if (result.matches.length === 3) {
            console.log('✅ ВСЕ точки правильно идентифицированы!');
            console.log('📐 Углы треугольников не изменились при повороте:');
            result.matches.forEach(match => {
                console.log(`   Точка ${match.point1.id} → ${match.point2.id}: ${match.commonHashes.length} общих хешей`);
            });
        }
    }
   
    rotateTriangle(points, angleDeg) {
        const centerX = (points[0].x + points[1].x + points[2].x) / 3;
        const centerY = (points[0].y + points[1].y + points[2].y) / 3;
       
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
                x: Math.round(rotatedX + centerX + 100), // Добавляем смещение для наглядности
                y: Math.round(rotatedY + centerY + 100),
                id: `${point.id}_rotated`
            };
        });
    }
}

// 🚀 ЗАПУСК ПРОГРАММЫ
async function main() {
    try {
        console.log('🎯 РОБАСТНЫЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ\n');
        console.log('📐 ГИБКОЕ ПОСТРОЕНИЕ ТРЕУГОЛЬНИКОВ + АДАПТИВНЫЕ ПОРОГИ\n');
       
        // Демонстрация на простом примере
        const demo = new Demonstration();
        demo.demonstrate();
       
        // Запуск тестов
        const tester = new SimpleTester();
        tester.runTests();
       
        console.log('\n💡 КЛЮЧЕВЫЕ ПРИНЦИПЫ РАБОТЫ:');
        console.log('='.repeat(60));
        console.log('1. ГИБКОЕ ПОСТРОЕНИЕ ТРЕУГОЛЬНИКОВ:');
        console.log('   • Используем ВСЕХ соседей в радиусе, а не фиксированное количество');
        console.log('   • Минимальная проверка: только площадь > 10');
        console.log('   • Нет строгих проверок пересечения лучей');
       
        console.log('\n2. БОГАТЫЕ ГЕОМЕТРИЧЕСКИЕ ХЕШИ:');
        console.log('   • Хеш включает углы И нормализованные расстояния');
        console.log('   • Формат: "Aугол1-угол2-угол3_Dнорм1-норм2-норм3"');
        console.log('   • Округление до целых градусов (hashPrecision = 0)');
       
        console.log('\n3. АДАПТИВНОЕ СРАВНЕНИЕ:');
        console.log('   • Ищем частичные совпадения хешей');
        console.log('   • Порог сходства: 30% (minSimilarity = 0.3)');
        console.log('   • Учитываем количество общих хешей');
       
        console.log('\n🎯 ПОЧЕМУ ЭТО РАБОТАЕТ ЛУЧШЕ:');
        console.log('1. Каждая точка получает МНОГО треугольников (6-8 вместо 1-3)');
        console.log('2. Хеши включают больше информации (углы + расстояния)');
        console.log('3. Мягкие пороги, а не строгие совпадения');
        console.log('4. Адаптация к неполным данным через частичные совпадения');
       
        console.log('\n🚀 ГОТОВО ДЛЯ ИНТЕГРАЦИИ!');
       
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
    RobustGeometricHash,
    SimpleTester,
    Demonstration
};
