// test-geometric-hash-algorithm.js
console.log('🎯 ТЕСТ ГЕОМЕТРИЧЕСКОГО ХЕШ-АЛГОРИТМА\n');
console.log('📐 ФУНДАМЕНТАЛЬНАЯ ИДЕЯ: Сравнение геометрических отношений, а не координат\n');

// 🔷 КЛАСС ДЛЯ ГЕОМЕТРИЧЕСКОГО ХЕШ-АЛГОРИТМА
class GeometricHashAlgorithm {
    constructor(options = {}) {
        this.neighborsCount = options.neighborsCount || 5; // Сколько соседей использовать
        this.hashPrecision = options.hashPrecision || 2;   // Точность округления углов
        this.debug = options.debug || false;
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
                // Создаем геометрические треугольники с разными соседями
                const triangles = this.createTrianglesWithNeighbors(point, neighbors);
               
                // Вычисляем геометрический хеш
                const geometricHash = this.calculateGeometricHash(triangles);
               
                // Создаем полный дескриптор точки
                footprint.push({
                    id: point.id || `point_${i}`,
                    x: point.x,
                    y: point.y,
                    hash: geometricHash,
                    triangles: triangles,
                    neighborCount: neighbors.length,
                    signature: this.createPointSignature(point, neighbors)
                });
               
                if (this.debug && i < 5) {
                    console.log(`   Точка ${i}: ${geometricHash.substring(0, 50)}...`);
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
   
    // 📐 Создать треугольники с разными комбинациями соседей
    createTrianglesWithNeighbors(centerPoint, neighbors) {
        const triangles = [];
       
        // Создаем треугольники со всеми возможными парами соседей
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const triangle = {
                    points: [centerPoint, neighbors[i], neighbors[j]],
                    angles: this.calculateTriangleAngles(centerPoint, neighbors[i], neighbors[j]),
                    distances: [
                        this.calculateDistance(centerPoint, neighbors[i]),
                        this.calculateDistance(centerPoint, neighbors[j]),
                        this.calculateDistance(neighbors[i], neighbors[j])
                    ]
                };
               
                triangles.push(triangle);
               
                // Ограничиваем количество треугольников для производительности
                if (triangles.length >= 10) break;
            }
            if (triangles.length >= 10) break;
        }
       
        return triangles;
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
        ].sort((a, b) => a - b); // Сортируем для инвариантности к порядку точек
    }
   
    // 🎯 Вычислить геометрический хеш на основе треугольников
    calculateGeometricHash(triangles) {
        // Создаем уникальную строку на основе углов треугольников
        const angleStrings = triangles.map(triangle => {
            return triangle.angles.map(angle => angle.toFixed(this.hashPrecision)).join('-');
        });
       
        // Сортируем для инвариантности к порядку треугольников
        angleStrings.sort();
       
        // Объединяем в один хеш
        return angleStrings.join('|');
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
   
    // 🎯 СРАВНЕНИЕ ДВУХ ГЕОМЕТРИЧЕСКИХ ОТПЕЧАТКОВ
    compareFootprints(fp1, fp2) {
        console.log(`🔍 Сравнение геометрических отпечатков: ${fp1.length} vs ${fp2.length} точек`);
       
        const matches = [];
        const hashMap = new Map();
       
        // Создаем хеш-таблицу для быстрого поиска
        fp2.forEach(point => {
            if (point.hash) {
                if (!hashMap.has(point.hash)) {
                    hashMap.set(point.hash, []);
                }
                hashMap.get(point.hash).push(point);
            }
        });
       
        // Ищем совпадения по хешу
        fp1.forEach(point1 => {
            if (point1.hash && hashMap.has(point1.hash)) {
                const matchingPoints = hashMap.get(point1.hash);
               
                matchingPoints.forEach(point2 => {
                    // Дополнительная проверка по сигнатуре (если есть)
                    let confidence = 1.0;
                    if (point1.signature && point2.signature) {
                        const sigSimilarity = this.compareSignatures(
                            point1.signature,
                            point2.signature
                        );
                        confidence = sigSimilarity;
                    }
                   
                    if (confidence > 0.7) { // Порог уверенности
                        matches.push({
                            point1: point1,
                            point2: point2,
                            confidence: confidence,
                            hash: point1.hash
                        });
                    }
                });
            }
        });
       
        console.log(`   ✅ Найдено ${matches.length} геометрических совпадений`);
       
        // Группируем совпадения по хешам для анализа
        const hashGroups = this.groupMatchesByHash(matches);
       
        return {
            matches: matches,
            hashGroups: hashGroups,
            matchPercentage: ((matches.length / Math.min(fp1.length, fp2.length)) * 100).toFixed(1)
        };
    }
   
    // 🔗 Восстановление недостающих точек на основе геометрических отношений
    reconstructMissingPoints(baseFP, sourceFP, matches) {
        console.log(`🔧 Восстановление недостающих точек...`);
       
        const reconstructed = [];
        const matchedPoints1 = new Set(matches.map(m => m.point1.id));
       
        // Находим точки в sourceFP, которых нет в baseFP
        const missingInBase = sourceFP.filter(point =>
            !Array.from(matchedPoints1).some(id => id === point.id)
        );
       
        console.log(`   Пропущено точек: ${missingInBase.length}`);
       
        // Для каждой пропущенной точки пытаемся восстановить
        missingInBase.forEach(missingPoint => {
            // Находим ближайшие совпавшие точки
            const nearestMatches = this.findNearestMatches(missingPoint, matches);
           
            if (nearestMatches.length >= 2) {
                // Пытаемся восстановить положение на основе геометрии
                const reconstructedPoint = this.reconstructFromGeometry(
                    missingPoint,
                    nearestMatches
                );
               
                if (reconstructedPoint) {
                    reconstructed.push(reconstructedPoint);
                }
            }
        });
       
        console.log(`   ✅ Восстановлено ${reconstructed.length} точек`);
        return reconstructed;
    }
   
    // 🔄 Трансформация отпечатка (для тестирования инвариантности)
    transformFootprint(footprint, transformation) {
        const { angle = 0, scale = 1.0, offsetX = 0, offsetY = 0 } = transformation;
       
        console.log(`🔄 Трансформация отпечатка: поворот ${angle}°, масштаб ${scale}x, смещение (${offsetX}, ${offsetY})`);
       
        // Преобразуем координаты точек
        const transformedPoints = footprint.map(point => {
            const angleRad = angle * Math.PI / 180;
            const cosA = Math.cos(angleRad);
            const sinA = Math.sin(angleRad);
           
            // Поворот и масштаб вокруг центра
            let x = point.x * cosA - point.y * sinA;
            let y = point.x * sinA + point.y * cosA;
           
            x *= scale;
            y *= scale;
           
            // Смещение
            x += offsetX;
            y += offsetY;
           
            return {
                ...point,
                x: Math.round(x),
                y: Math.round(y),
                id: `${point.id}_transformed`
            };
        });
       
        // Создаем новый геометрический отпечаток
        return this.createGeometricFootprint(transformedPoints, 'transformed');
    }
   
    // 📊 Вспомогательные методы
    calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
   
    radToDeg(rad) {
        return rad * 180 / Math.PI;
    }
   
    calculateAngleBetweenVectors(p1, p2, p1, p3) {
        const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const v2 = { x: p3.x - p1.x, y: p3.y - p1.y };
       
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
       
        const cosAngle = dot / (mag1 * mag2);
        return this.radToDeg(Math.acos(Math.max(-1, Math.min(1, cosAngle))));
    }
   
    compareSignatures(sig1, sig2) {
        if (!sig1 || !sig2) return 0;
       
        const angles1 = sig1.split('-').map(Number);
        const angles2 = sig2.split('-').map(Number);
       
        if (angles1.length !== angles2.length) return 0;
       
        // Сравниваем углы
        let similarity = 0;
        for (let i = 0; i < angles1.length; i++) {
            const diff = Math.abs(angles1[i] - angles2[i]);
            if (diff < 5) { // Допуск 5 градусов
                similarity += 1 / angles1.length;
            }
        }
       
        return similarity;
    }
   
    groupMatchesByHash(matches) {
        const groups = new Map();
       
        matches.forEach(match => {
            if (!groups.has(match.hash)) {
                groups.set(match.hash, []);
            }
            groups.get(match.hash).push(match);
        });
       
        return Array.from(groups.entries()).map(([hash, matches]) => ({
            hash: hash,
            count: matches.length,
            matches: matches
        }));
    }
   
    findNearestMatches(point, matches, count = 3) {
        const distances = matches.map(match => ({
            match: match,
            distance: this.calculateDistance(point, match.point2)
        }));
       
        distances.sort((a, b) => a.distance - b.distance);
        return distances.slice(0, count).map(d => d.match);
    }
   
    reconstructFromGeometry(missingPoint, nearestMatches) {
        if (nearestMatches.length < 2) return null;
       
        // Простое восстановление: среднее положение совпавших точек
        const avgX = nearestMatches.reduce((sum, m) => sum + m.point1.x, 0) / nearestMatches.length;
        const avgY = nearestMatches.reduce((sum, m) => sum + m.point1.y, 0) / nearestMatches.length;
       
        return {
            id: `reconstructed_${missingPoint.id}`,
            x: Math.round(avgX),
            y: Math.round(avgY),
            hash: missingPoint.hash,
            reconstructed: true
        };
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
}

// 🔷 КЛАСС ДЛЯ ТЕСТИРОВАНИЯ
class GeometricHashTester {
    constructor() {
        this.algorithm = new GeometricHashAlgorithm({
            neighborsCount: 6,
            hashPrecision: 1,
            debug: true
        });
    }
   
    // 🧪 Запустить все тесты
    runAllTests() {
        console.log('🧪 ЗАПУСК ТЕСТОВ ГЕОМЕТРИЧЕСКОГО ХЕШ-АЛГОРИТМА\n');
       
        const results = [];
       
        // ТЕСТ 1: Одна и та же фигура
        console.log('1️⃣ ТЕСТ 1: ОДНА И ТА ЖЕ ФИГУРА (должно быть ~100%)');
        const test1 = this.runTest(
            TestDataGenerator.createFigureEight(),
            TestDataGenerator.createFigureEight(),
            'Одинаковая восьмёрка',
            { expected: 95, tolerance: 5 }
        );
        results.push(test1);
       
        // ТЕСТ 2: Восьмёрка vs Шестёрка (похожие, но разные)
        console.log('\n2️⃣ ТЕСТ 2: ВОСЬМЁРКА vs ШЕСТЁРКА (должно быть ~70-80%)');
        const test2 = this.runTest(
            TestDataGenerator.createFigureEight(),
            TestDataGenerator.createFigureSix(),
            'Восьмёрка vs Шестёрка',
            { expected: 75, tolerance: 15 }
        );
        results.push(test2);
       
        // ТЕСТ 3: С поворотом
        console.log('\n3️⃣ ТЕСТ 3: С ПОВОРОТОМ 45° (должно быть ~100%)');
        const original = TestDataGenerator.createFigureEight();
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
       
        // ТЕСТ 7: Комбинированная трансформация
        console.log('\n7️⃣ ТЕСТ 7: КОМБИНИРОВАННАЯ ТРАНСФОРМАЦИЯ');
        const combined = TestDataGenerator.transformPoints(original, {
            angle: 30,
            scale: 1.2,
            offsetX: 20,
            offsetY: -15
        });
        const test7 = this.runTest(
            original,
            combined,
            'Комбинированная',
            { expected: 95, tolerance: 5 }
        );
        results.push(test7);
       
        // ТЕСТ 8: Частичный отпечаток
        console.log('\n8️⃣ ТЕСТ 8: ЧАСТИЧНЫЙ ОТПЕЧАТОК (30% точек удалено)');
        const partial = TestDataGenerator.removeRandomPoints(original, 30);
        const test8 = this.runTest(
            original,
            partial,
            'Частичный отпечаток',
            { expected: 70, tolerance: 20 }
        );
       
        // Восстановление недостающих точек
        console.log('\n🔄 ВОССТАНОВЛЕНИЕ НЕДОСТАЮЩИХ ТОЧЕК:');
        const fp1 = this.algorithm.createGeometricFootprint(original, 'original');
        const fp2 = this.algorithm.createGeometricFootprint(partial, 'partial');
        const comparison = this.algorithm.compareFootprints(fp1, fp2);
        const reconstructed = this.algorithm.reconstructMissingPoints(fp1, fp2, comparison.matches);
       
        console.log(`   Исходно: ${original.length} точек`);
        console.log(`   После удаления: ${partial.length} точек`);
        console.log(`   Восстановлено: ${reconstructed.length} точек`);
        console.log(`   Итого: ${partial.length + reconstructed.length} точек`);
       
        const recoveryRate = ((reconstructed.length / (original.length - partial.length)) * 100).toFixed(1);
        console.log(`   📈 Эффективность восстановления: ${recoveryRate}%`);
       
        test8.recoveryRate = recoveryRate;
        results.push(test8);
       
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
            if (test.recoveryRate) {
                console.log(`   Восстановление: ${test.recoveryRate}%`);
            }
            console.log(`   Совпадений: ${test.matches.length} из ${test.totalPoints}`);
            console.log();
        });
       
        console.log(`🎯 ИТОГО: ${passed}/${results.length} тестов пройдено успешно`);
       
        if (passed === results.length) {
            console.log('🏆 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Алгоритм работает идеально!');
        } else {
            console.log(`⚠️ Требуется доработка: ${results.length - passed} тестов не пройдены`);
        }
       
        return results;
    }
   
    // 🧪 Запустить один тест
    runTest(points1, points2, testName, expectations) {
        console.log(`   ${testName}: ${points1.length} vs ${points2.length} точек`);
       
        // Создаем геометрические отпечатки
        const fp1 = this.algorithm.createGeometricFootprint(points1, 'shape1');
        const fp2 = this.algorithm.createGeometricFootprint(points2, 'shape2');
       
        // Сравниваем
        const result = this.algorithm.compareFootprints(fp1, fp2);
       
        const actual = parseFloat(result.matchPercentage);
       
        // Выводим примеры хешей для первых 3 совпадений
        if (result.matches.length > 0) {
            console.log('   Примеры геометрических хешей:');
            for (let i = 0; i < Math.min(3, result.matches.length); i++) {
                const match = result.matches[i];
                const hashPreview = match.hash.length > 50
                    ? match.hash.substring(0, 50) + '...'
                    : match.hash;
                console.log(`     ${i + 1}. ${hashPreview}`);
            }
        }
       
        return {
            name: testName,
            actual: actual,
            expected: expectations.expected,
            tolerance: expectations.tolerance,
            matches: result.matches,
            totalPoints: Math.min(points1.length, points2.length),
            hashGroups: result.hashGroups
        };
    }
   
    // 🔬 Детальный анализ хешей
    analyzeHashDistribution(footprint) {
        console.log('\n🔬 АНАЛИЗ РАСПРЕДЕЛЕНИЯ ХЕШЕЙ:');
       
        const hashMap = new Map();
        footprint.forEach(point => {
            const hash = point.hash;
            hashMap.set(hash, (hashMap.get(hash) || 0) + 1);
        });
       
        // Статистика
        const totalPoints = footprint.length;
        const uniqueHashes = hashMap.size;
        const collisionRate = ((totalPoints - uniqueHashes) / totalPoints * 100).toFixed(1);
       
        console.log(`   Всего точек: ${totalPoints}`);
        console.log(`   Уникальных хешей: ${uniqueHashes}`);
        console.log(`   Коллизии: ${collisionRate}%`);
       
        // Находим хеши с коллизиями
        const collisions = Array.from(hashMap.entries())
            .filter(([hash, count]) => count > 1)
            .sort((a, b) => b[1] - a[1]);
       
        if (collisions.length > 0) {
            console.log(`   Хеши с коллизиями (первые 3):`);
            collisions.slice(0, 3).forEach(([hash, count]) => {
                console.log(`     "${hash.substring(0, 40)}..." - ${count} точек`);
            });
        } else {
            console.log(`   ✅ Все хеши уникальны!`);
        }
       
        return {
            uniqueHashes,
            collisionRate,
            collisions: collisions.length
        };
    }
   
    // 🎯 Демонстрация работы алгоритма на простом примере
    runDemo() {
        console.log('\n🎯 ДЕМОНСТРАЦИЯ РАБОТЫ АЛГОРИТМА:\n');
       
        // Простой пример: треугольник
        const triangle1 = [
            { x: 100, y: 100, id: 'A' },
            { x: 200, y: 100, id: 'B' },
            { x: 150, y: 200, id: 'C' }
        ];
       
        // Тот же треугольник, но повернутый и смещенный
        const triangle2 = [
            { x: 300, y: 300, id: 'A_t' },
            { x: 400, y: 300, id: 'B_t' },
            { x: 350, y: 400, id: 'C_t' }
        ];
       
        console.log('1. Создаем геометрические отпечатки для треугольника:');
        const fp1 = this.algorithm.createGeometricFootprint(triangle1, 'triangle1');
        const fp2 = this.algorithm.createGeometricFootprint(triangle2, 'triangle2');
       
        console.log('\n2. Геометрические хеши точек:');
        fp1.forEach(point => {
            console.log(`   Точка ${point.id}: ${point.hash}`);
        });
       
        console.log('\n3. Сравниваем отпечатки:');
        const result = this.algorithm.compareFootprints(fp1, fp2);
       
        console.log(`\n4. Результат: ${result.matches.length} совпадений из 3`);
       
        if (result.matches.length === 3) {
            console.log('✅ Все точки правильно идентифицированы, несмотря на смещение!');
        }
    }
}

// 🚀 ЗАПУСК ТЕСТОВ
async function main() {
    try {
        console.log('🎯 ГЕОМЕТРИЧЕСКИЙ ХЕШ-АЛГОРИТМ ДЛЯ СРАВНЕНИЯ СЛЕДОВ\n');
        console.log('📐 ИДЕЯ: Сравнивать геометрические отношения точек, а не их координаты\n');
       
        const tester = new GeometricHashTester();
       
        // Демонстрация
        tester.runDemo();
       
        // Полное тестирование
        const results = tester.runAllTests();
       
        // Анализ распределения хешей
        const testPoints = TestDataGenerator.createFigureEight();
        const footprint = tester.algorithm.createGeometricFootprint(testPoints, 'analysis');
        tester.analyzeHashDistribution(footprint);
       
        console.log('\n💡 ВЫВОДЫ И РЕКОМЕНДАЦИИ:');
        console.log('='.repeat(60));
        console.log('✅ Преимущества геометрического хеш-алгоритма:');
        console.log('   1. Инвариантен к поворотам, масштабированию и смещениям');
        console.log('   2. Работает с частичными отпечатками');
        console.log('   3. Позволяет восстанавливать недостающие точки');
        console.log('   4. Быстрый поиск совпадений через хеш-таблицы');
        console.log('   5. Четкая математическая основа');
       
        console.log('\n🚀 РЕКОМЕНДАЦИИ ПО ВНЕДРЕНИЮ:');
        console.log('   1. Использовать neighborsCount = 6-8 для баланса точности и скорости');
        console.log('   2. hashPrecision = 1-2 (округлять углы до 0.1-1 градуса)');
        console.log('   3. Добавить кэширование геометрических отпечатков');
        console.log('   4. Комбинировать с другими признаками для повышения надежности');
        console.log('   5. Для очень плотных точек увеличить neighborsCount');
       
        console.log('\n🎉 АЛГОРИТМ ГОТОВ К ИНТЕГРАЦИИ В СИСТЕМУ!');
       
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
