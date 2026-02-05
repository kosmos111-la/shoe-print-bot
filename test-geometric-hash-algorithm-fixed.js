// test-geometric-hash-algorithm-fixed.js
console.log('🎯 ТЕСТ ГЕОМЕТРИЧЕСКОГО ХЕШ-АЛГОРИТМА (МНОГОУРОВНЕВЫЙ ПОДХОД)\n');
console.log('📐 ИДЕЯ: Многоуровневые треугольники + частичные совпадения хешей\n');

// 🔷 КЛАСС ДЛЯ ГЕОМЕТРИЧЕСКОГО ХЕШ-АЛГОРИТМА (ИСПРАВЛЕННЫЙ)
class GeometricHashAlgorithm {
    constructor(options = {}) {
        this.neighborsCount = options.neighborsCount || 4; // Сколько соседей использовать
        this.hashPrecision = options.hashPrecision || 1;   // Точность округления углов
        this.minTrianglesForMatch = options.minTrianglesForMatch || 2; // Минимальное совпадение треугольников
        this.debug = options.debug || false;
        this.triangleCache = new Map(); // Кэш для треугольников
    }
   
    // 🎯 ОСНОВНАЯ ФУНКЦИЯ: Создание геометрического отпечатка для набора точек
    createGeometricFootprint(points, name = 'unknown') {
        console.log(`👣 Создание геометрического отпечатка для "${name}": ${points.length} точек`);
       
        if (points.length < 3) {
            console.warn(`⚠️ Слишком мало точек (${points.length}) для создания геометрического отпечатка`);
            return [];
        }
       
        const footprint = [];
       
        // Для каждой точки создаем геометрический дескриптор
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // Находим k ближайших соседей
            const neighbors = this.findKNearestNeighbors(point, points, i, this.neighborsCount);
           
            if (neighbors.length >= 2) {
                // Создаем треугольники 1-го уровня (точка + 2 соседа)
                const level1Triangles = this.createLevel1Triangles(point, neighbors);
               
                // Создаем треугольники 2-го уровня (центры треугольников 1-го уровня)
                const level2Triangles = this.createLevel2Triangles(level1Triangles);
               
                // Создаем набор геометрических хешей
                const geometricHashes = this.createGeometricHashes(level1Triangles, level2Triangles);
               
                // Создаем полный дескриптор точки
                footprint.push({
                    id: point.id || `point_${i}`,
                    x: point.x,
                    y: point.y,
                    hashes: geometricHashes, // Массив хешей, а не один!
                    level1Triangles: level1Triangles,
                    level2Triangles: level2Triangles,
                    neighborCount: neighbors.length,
                    signature: this.createPointSignature(point, neighbors)
                });
               
                if (this.debug && i < 3) {
                    console.log(`   Точка ${i}: ${geometricHashes.length} хешей`);
                    geometricHashes.slice(0, 2).forEach((hash, idx) => {
                        console.log(`     Хеш ${idx + 1}: ${hash.substring(0, 40)}...`);
                    });
                }
            }
        }
       
        console.log(`   ✅ Создано ${footprint.length} геометрических дескрипторов`);
        return footprint;
    }
   
    // 🔍 Найти k ближайших соседей для точки
    findKNearestNeighbors(centerPoint, allPoints, centerIndex, k) {
        const distances = [];
       
        for (let i = 0; i < allPoints.length; i++) {
            if (i === centerIndex) continue; // Пропускаем саму точку
           
            const point = allPoints[i];
            const distance = this.calculateDistance(centerPoint, point);
           
            distances.push({
                point: point,
                distance: distance,
                index: i
            });
        }
       
        // Сортируем по расстоянию и берем k ближайших
        distances.sort((a, b) => a.distance - b.distance);
        return distances.slice(0, k).map(d => d.point);
    }
   
    // 📐 Создать треугольники 1-го уровня (точка + 2 соседа)
    createLevel1Triangles(centerPoint, neighbors) {
        const triangles = [];
        const usedPairs = new Set();
       
        // Создаем треугольники со всеми возможными парами соседей
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const neighbor1 = neighbors[i];
                const neighbor2 = neighbors[j];
               
                // Проверяем, чтобы лучи не пересекались с уже существующими треугольниками
                const isValid = this.validateTriangle(centerPoint, neighbor1, neighbor2, triangles);
               
                if (isValid) {
                    const triangle = this.createTriangle(centerPoint, neighbor1, neighbor2, 1);
                    triangles.push(triangle);
                    usedPairs.add(`${i}-${j}`);
                   
                    // Ограничиваем количество треугольников
                    if (triangles.length >= 5) break;
                }
            }
            if (triangles.length >= 5) break;
        }
       
        return triangles;
    }
   
    // 📐 Создать треугольники 2-го уровня (центры треугольников 1-го уровня)
    createLevel2Triangles(level1Triangles) {
        if (level1Triangles.length < 3) return [];
       
        const triangles = [];
        const centers = level1Triangles.map(t => t.center);
       
        // Используем центры треугольников 1-го уровня как точки для треугольников 2-го уровня
        for (let i = 0; i < centers.length; i++) {
            for (let j = i + 1; j < centers.length; j++) {
                for (let k = j + 1; k < centers.length; k++) {
                    const triangle = this.createTriangle(centers[i], centers[j], centers[k], 2);
                    triangles.push(triangle);
                   
                    if (triangles.length >= 3) break;
                }
                if (triangles.length >= 3) break;
            }
            if (triangles.length >= 3) break;
        }
       
        return triangles;
    }
   
    // 🔷 Создать треугольник с вычислением всех характеристик
    createTriangle(p1, p2, p3, level) {
        // Вычисляем центр треугольника
        const center = {
            x: (p1.x + p2.x + p3.x) / 3,
            y: (p1.y + p2.y + p3.y) / 3
        };
       
        // Вычисляем углы
        const angles = this.calculateTriangleAngles(p1, p2, p3);
       
        // Вычисляем площадь (для проверки вырожденности)
        const area = this.calculateTriangleArea(p1, p2, p3);
       
        return {
            points: [p1, p2, p3],
            angles: angles,
            center: center,
            area: area,
            level: level,
            hash: this.triangleToHash(angles)
        };
    }
   
    // ✅ Проверить валидность треугольника (чтобы лучи не пересекались)
    validateTriangle(p1, p2, p3, existingTriangles) {
        // Проверяем, не вырожден ли треугольник (площадь близка к нулю)
        const area = this.calculateTriangleArea(p1, p2, p3);
        if (area < 1) return false; // Слишком маленькая площадь
       
        // Проверяем, не пересекаются ли стороны с существующими треугольниками
        for (const triangle of existingTriangles) {
            if (this.trianglesIntersect([p1, p2, p3], triangle.points)) {
                return false;
            }
        }
       
        return true;
    }
   
    // 📏 Вычислить углы треугольника
    calculateTriangleAngles(p1, p2, p3) {
        // Длины сторон
        const a = this.calculateDistance(p2, p3); // Противолежащая p1
        const b = this.calculateDistance(p1, p3); // Противолежащая p2
        const c = this.calculateDistance(p1, p2); // Противолежащая p3
       
        // Углы по теореме косинусов
        const angleA = this.radToDeg(Math.acos((b*b + c*c - a*a) / (2*b*c)));
        const angleB = this.radToDeg(Math.acos((a*a + c*c - b*b) / (2*a*c)));
        const angleC = 180 - angleA - angleB;
       
        // Округляем до заданной точности
        const precision = this.hashPrecision;
        return [
            Math.round(angleA * Math.pow(10, precision)) / Math.pow(10, precision),
            Math.round(angleB * Math.pow(10, precision)) / Math.pow(10, precision),
            Math.round(angleC * Math.pow(10, precision)) / Math.pow(10, precision)
        ].sort((a, b) => a - b); // Сортируем для инвариантности
    }
   
    // 🎯 Создать набор геометрических хешей
    createGeometricHashes(level1Triangles, level2Triangles) {
        const hashes = [];
       
        // Хеши для треугольников 1-го уровня
        level1Triangles.forEach(triangle => {
            hashes.push(triangle.hash);
        });
       
        // Хеши для треугольников 2-го уровня
        level2Triangles.forEach(triangle => {
            hashes.push(`L2:${triangle.hash}`);
        });
       
        // Комбинированные хеши (группы из 2 треугольников)
        if (level1Triangles.length >= 2) {
            for (let i = 0; i < level1Triangles.length; i++) {
                for (let j = i + 1; j < level1Triangles.length; j++) {
                    const combinedHash = this.combineHashes(
                        level1Triangles[i].hash,
                        level1Triangles[j].hash
                    );
                    hashes.push(combinedHash);
                }
            }
        }
       
        return hashes;
    }
   
    // 🎯 СРАВНЕНИЕ ДВУХ ГЕОМЕТРИЧЕСКИХ ОТПЕЧАТКОВ (С ЧАСТИЧНЫМИ СОВПАДЕНИЯМИ)
    compareFootprints(fp1, fp2) {
        console.log(`🔍 Сравнение геометрических отпечатков: ${fp1.length} vs ${fp2.length} точек`);
       
        const matches = [];
       
        // Для каждой точки в fp1 ищем похожие в fp2
        fp1.forEach(point1 => {
            let bestMatch = null;
            let bestScore = 0;
           
            fp2.forEach(point2 => {
                // Сравниваем наборы хешей (частичное совпадение!)
                const similarity = this.compareHashSets(point1.hashes, point2.hashes);
               
                if (similarity > bestScore && similarity >= 0.5) { // Порог 50%
                    bestScore = similarity;
                    bestMatch = {
                        point1: point1,
                        point2: point2,
                        similarity: similarity,
                        commonHashes: this.findCommonHashes(point1.hashes, point2.hashes)
                    };
                }
            });
           
            if (bestMatch) {
                matches.push(bestMatch);
            }
        });
       
        console.log(`   ✅ Найдено ${matches.length} совпадений (частичные хеши)`);
       
        return {
            matches: matches,
            matchPercentage: ((matches.length / Math.min(fp1.length, fp2.length)) * 100).toFixed(1)
        };
    }
   
    // 🔄 Сравнение наборов хешей (частичное совпадение)
    compareHashSets(hashes1, hashes2) {
        if (!hashes1 || !hashes2 || hashes1.length === 0 || hashes2.length === 0) {
            return 0;
        }
       
        // Создаем множества для быстрого поиска
        const set1 = new Set(hashes1);
        const set2 = new Set(hashes2);
       
        // Находим общие хеши
        const common = hashes1.filter(hash => set2.has(hash));
       
        // Вычисляем коэффициент Жаккара (Jaccard similarity)
        const unionSize = new Set([...hashes1, ...hashes2]).size;
        const intersectionSize = common.length;
       
        return unionSize > 0 ? intersectionSize / unionSize : 0;
    }
   
    // 🔍 Найти общие хеши
    findCommonHashes(hashes1, hashes2) {
        const set2 = new Set(hashes2);
        return hashes1.filter(hash => set2.has(hash));
    }
   
    // ✍️ Создать уникальную сигнатуру точки
    createPointSignature(centerPoint, neighbors) {
        if (neighbors.length < 2) return '';
       
        // Вычисляем относительные углы между соседями
        const angles = [];
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const angle = this.calculateAngleBetweenVectors(
                    centerPoint, neighbors[i],
                    centerPoint, neighbors[j]
                );
                angles.push(Math.round(angle));
            }
        }
       
        // Сортируем и объединяем
        angles.sort((a, b) => a - b);
        return angles.join('-');
    }
   
    // 🔧 Вспомогательные методы
    calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
   
    radToDeg(rad) {
        return rad * 180 / Math.PI;
    }
   
    calculateAngleBetweenVectors(p1, p2, q1, q2) {
        const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const v2 = { x: q2.x - q1.x, y: q2.y - q1.y };
       
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
       
        const cosAngle = dot / (mag1 * mag2);
        return this.radToDeg(Math.acos(Math.max(-1, Math.min(1, cosAngle))));
    }
   
    calculateTriangleArea(p1, p2, p3) {
        return Math.abs(
            (p1.x * (p2.y - p3.y) +
             p2.x * (p3.y - p1.y) +
             p3.x * (p1.y - p2.y)) / 2
        );
    }
   
    trianglesIntersect(tri1, tri2) {
        // Упрощенная проверка пересечения треугольников
        // Проверяем пересечение сторон
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const a1 = tri1[i];
                const a2 = tri1[(i + 1) % 3];
                const b1 = tri2[j];
                const b2 = tri2[(j + 1) % 3];
               
                if (this.segmentsIntersect(a1, a2, b1, b2)) {
                    return true;
                }
            }
        }
        return false;
    }
   
    segmentsIntersect(a1, a2, b1, b2) {
        // Проверка пересечения отрезков
        const d1 = this.direction(b1, b2, a1);
        const d2 = this.direction(b1, b2, a2);
        const d3 = this.direction(a1, a2, b1);
        const d4 = this.direction(a1, a2, b2);
       
        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
            ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
            return true;
        }
       
        return false;
    }
   
    direction(p1, p2, p3) {
        return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
    }
   
    triangleToHash(angles) {
        return angles.map(a => a.toFixed(this.hashPrecision)).join('-');
    }
   
    combineHashes(hash1, hash2) {
        return `C:${hash1}|${hash2}`;
    }
   
    // 🎯 НАЙТИ СОСЕДЕЙ ДЛЯ ВОССТАНОВЛЕНИЯ
    findReconstructionNeighbors(point, matches) {
        // Находим совпавшие точки, которые были соседями в оригинале
        const neighbors = [];
       
        // Простая реализация: берем ближайшие совпавшие точки
        const sortedMatches = matches
            .map(match => ({
                point: match.point2,
                distance: this.calculateDistance(point, match.point2)
            }))
            .sort((a, b) => a.distance - b.distance);
       
        return sortedMatches.slice(0, 3).map(m => m.point);
    }
}

// 🔷 КЛАСС ДЛЯ СОЗДАНИЯ ТЕСТОВЫХ ДАННЫХ
class TestDataGenerator {
    // Создать фигуру восьмёрки
    static createFigureEight(centerX = 400, centerY = 300, scale = 1.0, pointCount = 32) {
        const points = [];
        const a = 100 * scale;
        const b = 60 * scale;
       
        for (let i = 0; i < pointCount; i++) {
            const t = (i / pointCount) * 2 * Math.PI;
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(2 * t);
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `eight_${i}`
            });
        }
       
        return points;
    }
   
    // Создать фигуру шестёрки (похожа, но не идентична)
    static createFigureSix(centerX = 400, centerY = 300, scale = 1.0, pointCount = 21) {
        const points = [];
        const a = 100 * scale;
        const b = 60 * scale;
       
        for (let i = 0; i < pointCount; i++) {
            const t = (i / pointCount) * 2 * Math.PI;
            const x = centerX + a * Math.sin(t);
            const y = centerY + b * Math.sin(2 * t) * 0.8; // Немного другая форма
            points.push({
                x: Math.round(x),
                y: Math.round(y),
                id: `six_${i}`
            });
        }
       
        return points;
    }
   
    // Применить трансформацию к точкам
    static transformPoints(points, transformation) {
        const { angle = 0, scale = 1.0, offsetX = 0, offsetY = 0 } = transformation;
        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        // Находим центр
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
           
            // Возвращаем на место + смещение
            x += centerX + offsetX;
            y += centerY + offsetY;
           
            return {
                ...point,
                x: Math.round(x),
                y: Math.round(y),
                id: `${point.id}_t${angle}_s${scale}`
            };
        });
    }
   
    // Добавить шум к точкам
    static addNoise(points, maxNoise = 5) {
        return points.map(point => ({
            ...point,
            x: point.x + (Math.random() - 0.5) * 2 * maxNoise,
            y: point.y + (Math.random() - 0.5) * 2 * maxNoise,
            id: `${point.id}_noise${maxNoise}`
        }));
    }
   
    // Удалить случайные точки (имитация частичного отпечатка)
    static removeRandomPoints(points, percentage = 30) {
        const removeCount = Math.floor(points.length * (percentage / 100));
        const indicesToRemove = new Set();
       
        while (indicesToRemove.size < removeCount) {
            indicesToRemove.add(Math.floor(Math.random() * points.length));
        }
       
        return points.filter((_, index) => !indicesToRemove.has(index));
    }
   
    // Удалить случайные треугольники (точки остаются, но некоторые треугольники не могут быть построены)
    static removeRandomTriangles(points, footprint, percentage = 30) {
        // Для каждой точки удаляем случайные хеши (имитируем отсутствие некоторых треугольников)
        return footprint.map(point => {
            if (Math.random() * 100 < percentage) {
                // Удаляем 1-2 хеша
                const hashesToRemove = Math.min(1 + Math.floor(Math.random() * 2), point.hashes.length - 1);
                const newHashes = [...point.hashes];
               
                for (let i = 0; i < hashesToRemove; i++) {
                    const index = Math.floor(Math.random() * newHashes.length);
                    newHashes.splice(index, 1);
                }
               
                return {
                    ...point,
                    hashes: newHashes,
                    id: `${point.id}_missing_hashes`
                };
            }
            return point;
        });
    }
}

// 🔷 КЛАСС ДЛЯ ТЕСТИРОВАНИЯ
class GeometricHashTester {
    constructor() {
        this.algorithm = new GeometricHashAlgorithm({
            neighborsCount: 4, // Меньше соседей = меньше треугольников
            hashPrecision: 1,
            minTrianglesForMatch: 2,
            debug: true
        });
    }
   
    // 🧪 Запустить все тесты
    runAllTests() {
        console.log('🧪 ЗАПУСК ТЕСТОВ МНОГОУРОВНЕВОГО ГЕОМЕТРИЧЕСКОГО АЛГОРИТМА\n');
       
        const results = [];
       
        // ТЕСТ 1: Одна и та же фигура
        console.log('1️⃣ ТЕСТ 1: ОДНА И ТА ЖЕ ФИГУРА (должно быть ~100%)');
        const original = TestDataGenerator.createFigureEight(400, 300, 1.0, 20);
        const test1 = this.runTest(
            original,
            [...original], // Копия
            'Одинаковая восьмёрка',
            { expected: 95, tolerance: 5 }
        );
        results.push(test1);
       
        // ТЕСТ 2: Восьмёрка vs Шестёрка (похожие, но разные)
        console.log('\n2️⃣ ТЕСТ 2: ВОСЬМЁРКА vs ШЕСТЁРКА (должно быть ~70-80%)');
        const six = TestDataGenerator.createFigureSix(400, 300, 1.0, 15);
        const test2 = this.runTest(
            original,
            six,
            'Восьмёрка vs Шестёрка',
            { expected: 75, tolerance: 15 }
        );
        results.push(test2);
       
        // ТЕСТ 3: С поворотом
        console.log('\n3️⃣ ТЕСТ 3: С ПОВОРОТОМ 45° (должно быть ~100%)');
        const rotated = TestDataGenerator.transformPoints(original, { angle: 45 });
        const test3 = this.runTest(
            original,
            rotated,
            'Поворот 45°',
            { expected: 95, tolerance: 5 }
        );
        results.push(test3);
       
        // ТЕСТ 4: С масштабированием
        console.log('\n4️⃣ ТЕСТ 4: МАСШТАБ 0.8x (должно быть ~100%)');
        const scaled = TestDataGenerator.transformPoints(original, { scale: 0.8 });
        const test4 = this.runTest(
            original,
            scaled,
            'Масштаб 0.8x',
            { expected: 95, tolerance: 5 }
        );
        results.push(test4);
       
        // ТЕСТ 5: Со смещением
        console.log('\n5️⃣ ТЕСТ 5: СМЕЩЕНИЕ +50,+30 (должно быть ~100%)');
        const shifted = TestDataGenerator.transformPoints(original, { offsetX: 50, offsetY: 30 });
        const test5 = this.runTest(
            original,
            shifted,
            'Смещение +50,+30',
            { expected: 95, tolerance: 5 }
        );
        results.push(test5);
       
        // ТЕСТ 6: С шумом
        console.log('\n6️⃣ ТЕСТ 6: С ШУМОМ ±10px (должно быть ~80-90%)');
        const noisy = TestDataGenerator.addNoise(original, 10);
        const test6 = this.runTest(
            original,
            noisy,
            'Шум ±10px',
            { expected: 85, tolerance: 10 }
        );
        results.push(test6);
       
        // ТЕСТ 7: Частичные хеши (некоторые треугольники отсутствуют)
        console.log('\n7️⃣ ТЕСТ 7: ЧАСТИЧНЫЕ ХЕШИ (30% треугольников удалено)');
        const fp1 = this.algorithm.createGeometricFootprint(original, 'original');
        const fpWithMissingHashes = TestDataGenerator.removeRandomTriangles(original, fp1, 30);
        const test7 = this.runComparison(
            fp1,
            fpWithMissingHashes,
            'Частичные хеши',
            { expected: 80, tolerance: 15 }
        );
        results.push(test7);
       
        // 📊 Сводный отчет
        console.log('\n📈 СВОДНЫЙ ОТЧЁТ ПО ТЕСТАМ:');
        console.log('='.repeat(60));
       
        let passed = 0;
        results.forEach((test, index) => {
            const isInRange = Math.abs(test.actual - test.expected) <= test.tolerance;
            const status = isInRange ? '✅' : '❌';
           
            if (isInRange) passed++;
           
            console.log(`${status} ТЕСТ ${index + 1}: ${test.name}`);
            console.log(`   Получено: ${test.actual}%, Ожидалось: ${test.expected}% ±${test.tolerance}%`);
            console.log(`   Совпадений: ${test.matches?.length || 0}`);
            console.log();
        });
       
        console.log(`🎯 ИТОГО: ${passed}/${results.length} тестов пройдено успешно`);
       
        // Анализ хешей
        console.log('\n🔬 АНАЛИЗ ХЕШЕЙ:');
        this.analyzeHashes(fp1);
       
        return results;
    }
   
    // 🧪 Запустить один тест
    runTest(points1, points2, testName, expectations) {
        console.log(`   ${testName}: ${points1.length} vs ${points2.length} точек`);
       
        // Создаем геометрические отпечатки
        const fp1 = this.algorithm.createGeometricFootprint(points1, 'shape1');
        const fp2 = this.algorithm.createGeometricFootprint(points2, 'shape2');
       
        return this.runComparison(fp1, fp2, testName, expectations);
    }
   
    // 🔍 Запустить сравнение отпечатков
    runComparison(fp1, fp2, testName, expectations) {
        // Сравниваем
        const result = this.algorithm.compareFootprints(fp1, fp2);
       
        const actual = parseFloat(result.matchPercentage);
       
        // Выводим примеры совпадений
        if (result.matches.length > 0) {
            console.log('   Примеры совпадений (частичные хеши):');
            for (let i = 0; i < Math.min(2, result.matches.length); i++) {
                const match = result.matches[i];
                console.log(`     Совпадение ${i + 1}: сходство ${match.similarity.toFixed(2)}`);
                if (match.commonHashes && match.commonHashes.length > 0) {
                    console.log(`       Общие хеши: ${match.commonHashes.length} шт`);
                    match.commonHashes.slice(0, 2).forEach(hash => {
                        console.log(`       - ${hash.substring(0, 30)}...`);
                    });
                }
            }
        }
       
        return {
            name: testName,
            actual: actual,
            expected: expectations.expected,
            tolerance: expectations.tolerance,
            matches: result.matches
        };
    }
   
    // 🔬 Анализ хешей
    analyzeHashes(footprint) {
        console.log('   Статистика хешей:');
       
        let totalHashes = 0;
        let minHashes = Infinity;
        let maxHashes = 0;
        const hashDistribution = {};
       
        footprint.forEach(point => {
            const count = point.hashes.length;
            totalHashes += count;
            minHashes = Math.min(minHashes, count);
            maxHashes = Math.max(maxHashes, count);
           
            // Распределение по количеству хешей
            hashDistribution[count] = (hashDistribution[count] || 0) + 1;
        });
       
        const avgHashes = totalHashes / footprint.length;
       
        console.log(`     Всего точек: ${footprint.length}`);
        console.log(`     Всего хешей: ${totalHashes}`);
        console.log(`     Среднее хешей на точку: ${avgHashes.toFixed(1)}`);
        console.log(`     Минимум хешей: ${minHashes}`);
        console.log(`     Максимум хешей: ${maxHashes}`);
       
        console.log('     Распределение:');
        Object.keys(hashDistribution).sort().forEach(count => {
            console.log(`       ${count} хешей: ${hashDistribution[count]} точек`);
        });
       
        // Анализ типов хешей
        const hashTypes = {
            level1: 0,
            level2: 0,
            combined: 0
        };
       
        footprint.forEach(point => {
            point.hashes.forEach(hash => {
                if (hash.startsWith('L2:')) {
                    hashTypes.level2++;
                } else if (hash.startsWith('C:')) {
                    hashTypes.combined++;
                } else {
                    hashTypes.level1++;
                }
            });
        });
       
        console.log('     Типы хешей:');
        console.log(`       Уровень 1 (треугольники): ${hashTypes.level1}`);
        console.log(`       Уровень 2 (центры): ${hashTypes.level2}`);
        console.log(`       Комбинированные: ${hashTypes.combined}`);
    }
   
    // 🎯 Демонстрация на простом примере
    runDemo() {
        console.log('\n🎯 ДЕМОНСТРАЦИЯ НА ПРОСТОМ ПРИМЕРЕ:\n');
       
        // Простой квадрат с точками
        const square = [
            { x: 100, y: 100, id: 'A' },
            { x: 200, y: 100, id: 'B' },
            { x: 200, y: 200, id: 'C' },
            { x: 100, y: 200, id: 'D' },
            { x: 150, y: 150, id: 'E' } // Центральная точка
        ];
       
        // Повернутый квадрат
        const rotatedSquare = TestDataGenerator.transformPoints(square, { angle: 45 });
       
        console.log('1. Создаем геометрические отпечатки для квадрата:');
        const fp1 = this.algorithm.createGeometricFootprint(square, 'square');
        const fp2 = this.algorithm.createGeometricFootprint(rotatedSquare, 'rotated_square');
       
        console.log('\n2. Анализ точки E (центральная):');
        const pointE = fp1.find(p => p.id === 'E');
        if (pointE) {
            console.log(`   Точка E имеет ${pointE.hashes.length} хешей:`);
            pointE.hashes.slice(0, 3).forEach((hash, idx) => {
                console.log(`   Хеш ${idx + 1}: ${hash.substring(0, 40)}...`);
            });
           
            // Находим соответствующую точку в повернутом квадрате
            const rotatedPointE = fp2.find(p => p.id === 'E_t45_s1');
            if (rotatedPointE) {
                const similarity = this.algorithm.compareHashSets(pointE.hashes, rotatedPointE.hashes);
                console.log(`   Сходство с повернутой точкой: ${similarity.toFixed(2)}`);
            }
        }
       
        console.log('\n3. Сравниваем отпечатки:');
        const result = this.algorithm.compareFootprints(fp1, fp2);
        console.log(`   Результат: ${result.matches.length} совпадений из ${Math.min(fp1.length, fp2.length)}`);
       
        if (result.matches.length === Math.min(fp1.length, fp2.length)) {
            console.log('✅ Все точки правильно идентифицированы, несмотря на поворот!');
        }
    }
}

// 🚀 ЗАПУСК ТЕСТОВ
async function main() {
    try {
        console.log('🎯 МНОГОУРОВНЕВЫЙ ГЕОМЕТРИЧЕСКИЙ ХЕШ-АЛГОРИТМ\n');
        console.log('📐 ИДЕЯ: Частичные совпадения хешей + многоуровневые треугольники\n');
       
        const tester = new GeometricHashTester();
       
        // Демонстрация
        tester.runDemo();
       
        // Полное тестирование
        const results = tester.runAllTests();
       
        console.log('\n💡 ОСНОВНЫЕ ПРИНЦИПЫ АЛГОРИТМА:');
        console.log('='.repeat(60));
        console.log('1. МНОГОУРОВНЕВЫЕ ТРЕУГОЛЬНИКИ:');
        console.log('   • Уровень 1: точка + 2 соседние точки');
        console.log('   • Уровень 2: центры треугольников уровня 1');
        console.log('   • Проверка на пересечение лучей');
       
        console.log('\n2. ЧАСТИЧНЫЕ СОВПАДЕНИЯ ХЕШЕЙ:');
        console.log('   • Каждая точка имеет МАССИВ хешей (а не один!)');
        console.log('   • Совпадение считается, если совпадает достаточно хешей');
        console.log('   • Коэффициент Жаккара для оценки сходства наборов');
       
        console.log('\n3. АДАПТИВНОСТЬ К НЕПОЛНЫМ ДАННЫМ:');
        console.log('   • Работает, когда часть треугольников отсутствует');
        console.log('   • Точка может войти в разное количество треугольников');
        console.log('   • Восстановление через соседние совпавшие точки');
       
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

module.exports = {
    GeometricHashAlgorithm,
    TestDataGenerator,
    GeometricHashTester
};
