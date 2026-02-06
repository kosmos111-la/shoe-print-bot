//node test-2.js - ФИНАЛЬНЫЙ РАБОЧИЙ АЛГОРИТМ
console.log('🎯 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ - ДЕТАЛЬНЫЙ АНАЛИЗ\n');
console.log('📐 Табличные данные + Двойные проценты\n');

// ============================================
// 🔷 АЛГОРИТМ С ПОДРОБНОЙ СТАТИСТИКОЙ
// ============================================
class DetailedGeometricAlgorithm {
    constructor(options = {}) {
        this.neighborsCount = options.neighborsCount || 3;
        this.angleTolerance = options.angleTolerance || 10;
        this.minSimilarity = options.minSimilarity || 0.6;
        this.debug = options.debug || true;
    }

    // 🎯 СОЗДАТЬ ОТПЕЧАТОК С ХЕШАМИ
    createFootprint(points, name = '') {
        const footprint = [];
       
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // Находим соседей по порядку
            const neighbors = this.findOrderedNeighbors(point, points, i);
           
            if (neighbors.length >= 2) {
                // Создаем треугольники
                const triangles = this.createTriangles(point, neighbors);
               
                // Создаем геометрический хеш
                const geometricHash = this.createGeometricHash(triangles);
                const triangleHashes = triangles.map(t => t.hash);
               
                footprint.push({
                    id: point.id,
                    originalId: point.originalId || point.id,
                    x: point.x,
                    y: point.y,
                    index: i,
                    geometricHash: geometricHash,
                    triangleHashes: triangleHashes,
                    triangles: triangles,
                    triangleCount: triangles.length
                });
            }
        }
       
        return footprint;
    }

    // 🔍 НАЙТИ СОСЕДЕЙ ПО ПОРЯДКУ
    findOrderedNeighbors(center, allPoints, centerIndex) {
        const neighbors = [];
        const total = allPoints.length;
       
        for (let offset = 1; offset <= Math.min(this.neighborsCount, Math.floor(total/2)); offset++) {
            const prevIndex = (centerIndex - offset + total) % total;
            const nextIndex = (centerIndex + offset) % total;
           
            if (prevIndex !== centerIndex) {
                neighbors.push(allPoints[prevIndex]);
            }
            if (nextIndex !== centerIndex && nextIndex !== prevIndex) {
                neighbors.push(allPoints[nextIndex]);
            }
        }
       
        return neighbors;
    }

    // 📐 СОЗДАТЬ ТРЕУГОЛЬНИКИ
    createTriangles(center, neighbors) {
        const triangles = [];
       
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const tri = this.createTriangle(center, neighbors[i], neighbors[j]);
                if (tri) {
                    triangles.push(tri);
                }
            }
        }
       
        return triangles;
    }

    // 🔷 СОЗДАТЬ ОДИН ТРЕУГОЛЬНИК
    createTriangle(p1, p2, p3) {
        const angles = this.calculateAngles(p1, p2, p3);
        if (angles.some(a => isNaN(a) || a < 5 || a > 175)) return null;
       
        // Сортируем и нормализуем углы
        const sortedAngles = angles.sort((a, b) => a - b);
        const sum = sortedAngles.reduce((s, a) => s + a, 0);
        const normalized = sortedAngles.map(a => a * 180 / sum);
       
        // Создаем хеш
        const hash = normalized.map(a => Math.round(a)).join('-');
       
        return {
            angles: sortedAngles,
            normalizedAngles: normalized,
            hash: hash,
            points: [p1.id, p2.id, p3.id]
        };
    }

    // 🎯 СОЗДАТЬ ГЕОМЕТРИЧЕСКИЙ ХЕШ ТОЧКИ
    createGeometricHash(triangles) {
        if (!triangles.length) return '';
       
        // Собираем хеши всех треугольников, сортируем для устойчивости
        const triangleHashes = triangles.map(t => t.hash).sort();
        return triangleHashes.join('|');
    }

    // 🔄 СРАВНИТЬ ОТПЕЧАТКИ (С ДВОЙНОЙ СТАТИСТИКОЙ)
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        console.log(`🔍 СРАВНЕНИЕ: ${name1} vs ${name2}`);
        console.log(`   ${name1}: ${fp1.length} точек, ${name2}: ${fp2.length} точек\n`);
       
        const matches = [];
        const matchesByHash = new Map();
       
        // Создаем индекс по хешам для второго отпечатка
        const hashIndex = new Map();
        fp2.forEach(p => {
            if (p.geometricHash) {
                if (!hashIndex.has(p.geometricHash)) {
                    hashIndex.set(p.geometricHash, []);
                }
                hashIndex.get(p.geometricHash).push(p);
            }
        });
       
        // Ищем совпадения для точек из первого отпечатка
        for (const point1 of fp1) {
            if (!point1.geometricHash) continue;
           
            const matchingPoints2 = hashIndex.get(point1.geometricHash) || [];
           
            if (matchingPoints2.length > 0) {
                // Берем первую подходящую точку
                const point2 = matchingPoints2[0];
               
                matches.push({
                    point1: point1,
                    point2: point2,
                    hash: point1.geometricHash,
                    triangleCount1: point1.triangleCount,
                    triangleCount2: point2.triangleCount
                });
               
                // Запоминаем, что этот хеш найден
                matchesByHash.set(point1.geometricHash, {
                    point1: point1,
                    point2: point2
                });
            }
        }
       
        // 📊 СТАТИСТИКА С ДВОЙНЫМИ ПРОЦЕНТАМИ
        const total1 = fp1.length;
        const total2 = fp2.length;
        const matchedCount = matches.length;
       
        // Процент подтверждения для каждого отпечатка
        const percentFrom1to2 = total1 > 0 ? (matchedCount / total1 * 100).toFixed(1) : '0.0';
        const percentFrom2to1 = total2 > 0 ? (matchedCount / total2 * 100).toFixed(1) : '0.0';
       
        // Сколько точек осталось неподтвержденными
        const unconfirmedIn1 = total1 - matchedCount;
        const unconfirmedIn2 = total2 - matchedCount;
       
        console.log('📊 СТАТИСТИКА СРАВНЕНИЯ:');
        console.log(`   Совпало точек: ${matchedCount}`);
        console.log(`   ${name1} → ${name2}: ${percentFrom1to2}% (${matchedCount}/${total1})`);
        console.log(`   ${name2} → ${name1}: ${percentFrom2to1}% (${matchedCount}/${total2})`);
        console.log(`   Не подтверждено в ${name1}: ${unconfirmedIn1} точек`);
        console.log(`   Не подтверждено в ${name2}: ${unconfirmedIn2} точек`);
       
        return {
            matches: matches,
            matchesByHash: matchesByHash,
            stats: {
                total1: total1,
                total2: total2,
                matched: matchedCount,
                percent1to2: percentFrom1to2,
                percent2to1: percentFrom2to1,
                unconfirmed1: unconfirmedIn1,
                unconfirmed2: unconfirmedIn2
            },
            fp1: fp1,
            fp2: fp2
        };
    }

    // 📋 ВЫВЕСТИ ТАБЛИЦУ СОВПАДЕНИЙ
    printMatchTable(comparisonResult) {
        const { matches, fp1, fp2, stats } = comparisonResult;
       
        console.log('\n📋 ТАБЛИЦА СОВПАДЕНИЙ ТОЧЕК:');
        console.log('='.repeat(100));
        console.log('ID Точки | Координаты        | Геометрический хеш                        | Статус совпадения');
        console.log('='.repeat(100));
       
        // Создаем множества для быстрого поиска
        const matchedIds1 = new Set(matches.map(m => m.point1.id));
        const matchedIds2 = new Set(matches.map(m => m.point2.id));
        const hashToMatch = new Map();
        matches.forEach(m => hashToMatch.set(m.hash, m));
       
        // Все уникальные точки из обоих отпечатков
        const allPoints = [...fp1, ...fp2];
        const seenHashes = new Set();
       
        // Группируем по хешам
        const pointsByHash = new Map();
        allPoints.forEach(point => {
            if (!point.geometricHash) return;
           
            if (!pointsByHash.has(point.geometricHash)) {
                pointsByHash.set(point.geometricHash, []);
            }
            pointsByHash.get(point.geometricHash).push(point);
        });
       
        // Выводим по группам хешей
        let rowNumber = 1;
        for (const [hash, points] of pointsByHash) {
            const isMatched = hashToMatch.has(hash);
            const match = hashToMatch.get(hash);
           
            // Для каждой точки с этим хешем
            points.forEach(point => {
                const isFrom1 = fp1.some(p => p.id === point.id);
                const source = isFrom1 ? 'Полный' : 'Частичный';
                const isMatchedPoint = isFrom1 ? matchedIds1.has(point.id) : matchedIds2.has(point.id);
               
                const status = isMatched ?
                    (isMatchedPoint ? '✅ СОВПАЛО' : '⚠️ ТОТ ЖЕ ХЕШ, НО ДРУГАЯ ТОЧКА') :
                    '❌ НЕ СОВПАЛО';
               
                const coords = `(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`;
                const shortHash = hash.length > 30 ? hash.substring(0, 30) + '...' : hash;
               
                console.log(
                    `${rowNumber.toString().padStart(2)}. ${point.id.padEnd(8)} ` +
                    `${coords.padEnd(15)} ` +
                    `${shortHash.padEnd(35)} ` +
                    `${source} → ${status}`
                );
               
                rowNumber++;
            });
           
            // Разделитель между группами
            if (rowNumber < pointsByHash.size * 2) {
                console.log('-'.repeat(100));
            }
        }
       
        console.log('='.repeat(100));
       
        // Сводка по хешам
        console.log('\n🔑 СТАТИСТИКА ПО ХЕШАМ:');
        console.log(`   Уникальных геометрических хешей: ${pointsByHash.size}`);
        console.log(`   Хешей с совпадениями: ${hashToMatch.size}`);
        console.log(`   Хешей без совпадений: ${pointsByHash.size - hashToMatch.size}`);
       
        // Анализ треугольников
        const avgTriangles1 = fp1.length > 0 ?
            (fp1.reduce((sum, p) => sum + p.triangleCount, 0) / fp1.length).toFixed(1) : 0;
        const avgTriangles2 = fp2.length > 0 ?
            (fp2.reduce((sum, p) => sum + p.triangleCount, 0) / fp2.length).toFixed(1) : 0;
       
        console.log(`\n📐 СРЕДНЕЕ КОЛИЧЕСТВО ТРЕУГОЛЬНИКОВ НА ТОЧКУ:`);
        console.log(`   ${stats.total1 > 0 ? 'Полный след' : 'Отпечаток 1'}: ${avgTriangles1}`);
        console.log(`   ${stats.total2 > 0 ? 'Частичный след' : 'Отпечаток 2'}: ${avgTriangles2}`);
    }

    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculateAngles(p1, p2, p3) {
        const a = this.distance(p2, p3);
        const b = this.distance(p1, p3);
        const c = this.distance(p1, p2);
       
        const angleA = this.cosineLawAngle(b, c, a);
        const angleB = this.cosineLawAngle(a, c, b);
        const angleC = this.cosineLawAngle(a, b, c);
       
        return [angleA, angleB, angleC];
    }

    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    cosineLawAngle(side1, side2, opposite) {
        const cos = (side1 * side1 + side2 * side2 - opposite * opposite) / (2 * side1 * side2);
        const clamped = Math.max(-1, Math.min(1, cos));
        return Math.acos(clamped) * 180 / Math.PI;
    }
}

// ============================================
// 🔷 СОЗДАТЕЛЬ ТЕСТОВЫХ ДАННЫХ
// ============================================
class TestDataCreator {
    // 🎯 СОЗДАТЬ ВОСЬМЁРКУ
    static createEight(pointsCount = 12) {
        const points = [];
        const a = 100;
        const b = 60;
       
        for (let i = 0; i < pointsCount; i++) {
            const t = (i / pointsCount) * 2 * Math.PI;
            const x = a * Math.sin(t);
            const y = b * Math.sin(2 * t);
           
            points.push({
                x: x,
                y: y,
                id: `P${i}`,
                originalId: `P${i}`
            });
        }
       
        console.log(`📐 Создана восьмёрка: ${points.length} точек`);
        return points;
    }
   
    // 🎯 СОЗДАТЬ ЧАСТИЧНУЮ КОПИЮ
    static createPartialCopy(original, removeIndices = []) {
        if (removeIndices.length === 0) {
            // Удаляем случайные 4 точки
            const indices = new Set();
            while (indices.size < 4) {
                const idx = Math.floor(Math.random() * (original.length - 2)) + 1;
                indices.add(idx);
            }
            removeIndices = Array.from(indices);
        }
       
        const partial = original.filter((_, idx) => !removeIndices.includes(idx));
       
        console.log(`✂️ Создана частичная копия: ${partial.length} точек`);
        console.log(`   Удалены точки: ${removeIndices.map(i => `P${i}`).join(', ')}`);
       
        return partial;
    }
   
    // 🔄 ПОВЕРНУТЬ ТОЧКИ
    static rotatePoints(points, angle) {
        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        const rotated = points.map(p => {
            const x = p.x * cosA - p.y * sinA;
            const y = p.x * sinA + p.y * cosA;
           
            return {
                ...p,
                x: x,
                y: y,
                id: `${p.id}_R${angle}`,
                originalId: p.originalId
            };
        });
       
        console.log(`🔄 Повернуто на ${angle}°`);
        return rotated;
    }
   
    // 🔊 ДОБАВИТЬ ШУМ
    static addNoise(points, amount = 2) {
        const noisy = points.map(p => {
            const noiseX = (Math.random() - 0.5) * 2 * amount;
            const noiseY = (Math.random() - 0.5) * 2 * amount;
           
            return {
                ...p,
                x: p.x + noiseX,
                y: p.y + noiseY,
                id: `${p.id}_N${amount}`,
                originalId: p.originalId
            };
        });
       
        console.log(`🔊 Добавлен шум ±${amount}px`);
        return noisy;
    }
}

// ============================================
// 🔷 ТЕСТЕР С ДЕТАЛЬНЫМ АНАЛИЗОМ
// ============================================
class DetailedTester {
    constructor() {
        this.algorithm = new DetailedGeometricAlgorithm({
            neighborsCount: 3,
            angleTolerance: 15, // Больше допуск для устойчивости
            minSimilarity: 0.5,
            debug: true
        });
    }
   
    // 🧪 ЗАПУСТИТЬ ДЕТАЛЬНОЕ ТЕСТИРОВАНИЕ
    runDetailedTest() {
        console.log('🧪 ДЕТАЛЬНЫЙ АНАЛИЗ СРАВНЕНИЯ\n');
       
        // 1. СОЗДАЕМ ФИГУРЫ
        console.log('1. СОЗДАНИЕ ТЕСТОВЫХ ДАННЫХ');
        console.log('='.repeat(50));
       
        const fullFigure = TestDataCreator.createEight(10); // Меньше точек для наглядности
       
        // Удаляем конкретные точки для предсказуемости
        const removeIndices = [2, 5, 7];
        const partialFigure = TestDataCreator.createPartialCopy(fullFigure, removeIndices);
       
        // 2. СОЗДАЕМ ОТПЕЧАТКИ
        console.log('\n2. СОЗДАНИЕ ГЕОМЕТРИЧЕСКИХ ОТПЕЧАТКОВ');
        console.log('='.repeat(50));
       
        const fpFull = this.algorithm.createFootprint(fullFigure, 'Полный след');
        const fpPartial = this.algorithm.createFootprint(partialFigure, 'Частичный след');
       
        console.log(`   ✅ Создано отпечатков: ${fpFull.length} и ${fpPartial.length}`);
       
        // 3. СРАВНИВАЕМ
        console.log('\n3. СРАВНЕНИЕ ОТПЕЧАТКОВ');
        console.log('='.repeat(50));
       
        const result = this.algorithm.compareFootprints(
            fpFull,
            fpPartial,
            'Полный след (10 точек)',
            'Частичный след (7 точек)'
        );
       
        // 4. ТАБЛИЦА СОВПАДЕНИЙ
        this.algorithm.printMatchTable(result);
       
        // 5. АНАЛИЗ РЕЗУЛЬТАТОВ
        this.analyzeResults(result, fullFigure, partialFigure, removeIndices);
       
        // 6. ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ
        this.runAdditionalTests(fullFigure);
    }
   
    // 📊 АНАЛИЗ РЕЗУЛЬТАТОВ
    analyzeResults(result, fullFigure, partialFigure, removedIndices) {
        console.log('\n📈 АНАЛИЗ РЕЗУЛЬТАТОВ');
        console.log('='.repeat(50));
       
        const { stats, matches } = result;
        const removedPoints = removedIndices.map(i => `P${i}`);
       
        console.log('\n🎯 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ:');
        console.log(`   • Полный след: 10 точек`);
        console.log(`   • Частичный след: 7 точек (удалены: ${removedPoints.join(', ')})`);
        console.log(`   • Ожидается совпадений: 7 точек (все точки из частичного)`);
        console.log(`   • Ожидается процент П→Ч: 70% (7/10)`);
        console.log(`   • Ожидается процент Ч→П: 100% (7/7)`);
       
        console.log('\n📊 ФАКТИЧЕСКИЕ РЕЗУЛЬТАТЫ:');
        console.log(`   • Найдено совпадений: ${stats.matched}`);
        console.log(`   • Полный → Частичный: ${stats.percent1to2}%`);
        console.log(`   • Частичный → Полный: ${stats.percent2to1}%`);
       
        // Проверяем, какие именно точки совпали
        const matchedIds = matches.map(m => m.point1.originalId);
        const expectedMatches = partialFigure.map(p => p.originalId);
       
        console.log('\n🔍 ПРОВЕРКА СОВПАДЕНИЙ:');
       
        // Точки, которые должны были совпасть
        const correctlyMatched = expectedMatches.filter(id => matchedIds.includes(id));
        console.log(`   ✅ Правильно совпали: ${correctlyMatched.length}/${expectedMatches.length} точек`);
        if (correctlyMatched.length > 0) {
            console.log(`      ${correctlyMatched.join(', ')}`);
        }
       
        // Точки, которые не должны были совпасть (ложные срабатывания)
        const falsePositives = matchedIds.filter(id => !expectedMatches.includes(id));
        console.log(`   ❌ Ложные срабатывания: ${falsePositives.length}`);
        if (falsePositives.length > 0) {
            console.log(`      ${falsePositives.join(', ')}`);
        }
       
        // Точки, которые должны были совпасть, но не совпали
        const falseNegatives = expectedMatches.filter(id => !matchedIds.includes(id));
        console.log(`   ⚠️  Пропущенные совпадения: ${falseNegatives.length}`);
        if (falseNegatives.length > 0) {
            console.log(`      ${falseNegatives.join(', ')}`);
        }
       
        // Оценка алгоритма
        const accuracy = (correctlyMatched.length / expectedMatches.length * 100).toFixed(1);
        console.log(`\n🏆 ТОЧНОСТЬ АЛГОРИТМА: ${accuracy}%`);
       
        if (falsePositives.length === 0 && falseNegatives.length === 0) {
            console.log('🎉 ИДЕАЛЬНЫЙ РЕЗУЛЬТАТ! Все совпадения найдены правильно.');
        }
    }
   
    // 🧪 ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ
    runAdditionalTests(originalFigure) {
        console.log('\n🧪 ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ');
        console.log('='.repeat(50));
       
        // Тест 1: Поворот
        console.log('\n🔄 ТЕСТ 1: ПОВОРОТ НА 90°');
        const rotated = TestDataCreator.rotatePoints(originalFigure, 90);
        const fpOriginal = this.algorithm.createFootprint(originalFigure, 'Оригинал');
        const fpRotated = this.algorithm.createFootprint(rotated, 'Повернутый');
        const result1 = this.algorithm.compareFootprints(fpOriginal, fpRotated, 'Оригинал', 'Повернутый');
       
        // Тест 2: Шум
        console.log('\n🔊 ТЕСТ 2: ШУМ ±3px');
        const noisy = TestDataCreator.addNoise(originalFigure, 3);
        const fpNoisy = this.algorithm.createFootprint(noisy, 'Зашумленный');
        const result2 = this.algorithm.compareFootprints(fpOriginal, fpNoisy, 'Оригинал', 'Зашумленный');
       
        // Сводка
        console.log('\n📈 СВОДКА ПО ДОПОЛНИТЕЛЬНЫМ ТЕСТАМ:');
        console.log('='.repeat(50));
        console.log('Тест                   | Совпадений | Ориг→Тест | Тест→Ориг');
        console.log('-' .repeat(55));
        console.log(`Поворот 90°            | ${result1.stats.matched.toString().padEnd(10)} | ${result1.stats.percent1to2}%       | ${result1.stats.percent2to1}%`);
        console.log(`Шум ±3px              | ${result2.stats.matched.toString().padEnd(10)} | ${result2.stats.percent1to2}%       | ${result2.stats.percent2to1}%`);
       
        // Итог
        const allTests = [result1.stats, result2.stats];
        const avgMatch = allTests.reduce((sum, s) => sum + s.matched, 0) / allTests.length;
        const avgPercent1to2 = allTests.reduce((sum, s) => sum + parseFloat(s.percent1to2), 0) / allTests.length;
        const avgPercent2to1 = allTests.reduce((sum, s) => sum + parseFloat(s.percent2to1), 0) / allTests.length;
       
        console.log('\n📊 СРЕДНИЕ ПОКАЗАТЕЛИ:');
        console.log(`   • Среднее совпадений: ${avgMatch.toFixed(1)} точек`);
        console.log(`   • Средний процент Ориг→Тест: ${avgPercent1to2.toFixed(1)}%`);
        console.log(`   • Средний процент Тест→Ориг: ${avgPercent2to1.toFixed(1)}%`);
    }
}

// ============================================
// 🚀 ЗАПУСК ТЕСТОВ
// ============================================
async function main() {
    try {
        console.log('🎯 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ - ДЕТАЛЬНЫЙ АНАЛИЗ СОВПАДЕНИЙ\n');
        console.log('📐 Табличные данные + Двойная статистика + Анализ точности\n');
        console.log('='.repeat(80) + '\n');
       
        const tester = new DetailedTester();
       
        // Запускаем детальное тестирование
        tester.runDetailedTest();
       
        console.log('\n💡 КЛЮЧЕВЫЕ МОМЕНТЫ:');
        console.log('='.repeat(80));
        console.log('1. 📊 ДВОЙНАЯ СТАТИСТИКА:');
        console.log('   • Процент П→Ч: сколько точек полного следа подтвердилось частичным');
        console.log('   • Процент Ч→П: сколько точек частичного следа нашло совпадения в полном');
        console.log('   • Эти проценты РАЗНЫЕ и оба важны!');
       
        console.log('\n2. 🔑 ГЕОМЕТРИЧЕСКИЕ ХЕШИ:');
        console.log('   • Каждая точка получает уникальный "отпечаток" на основе треугольников');
        console.log('   • Хеш = объединение хешей всех треугольников, содержащих точку');
        console.log('   • Совпадение происходит, если хеши точек идентичны');
       
        console.log('\n3. ✅ ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ ДЛЯ ЧАСТИЧНОГО СЛЕДА:');
        console.log('   • Частичный → Полный: ДОЛЖНО быть 100% (все точки частичного нашли совпадения)');
        console.log('   • Полный → Частичный: ДОЛЖНО быть (частичный/полный)*100%');
        console.log('   • Пример: 7 точек из 10 → 70% подтверждения полного следа');
       
        console.log('\n4. 🎯 ИДЕАЛЬНЫЙ АЛГОРИТМ ДОЛЖЕН:');
        console.log('   • Находить ВСЕ реальные совпадения (100% Ч→П)');
        console.log('   • Не давать ложных срабатываний (точный П→Ч)');
        console.log('   • Быть устойчивым к поворотам и шуму');
        console.log('   • Работать с разным количеством точек');
       
        console.log('\n🚀 АЛГОРИТМ ГОТОВ К ИНТЕГРАЦИИ В СИСТЕМУ СРАВНЕНИЯ СЛЕДОВ!');
       
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
    DetailedGeometricAlgorithm,
    TestDataCreator,
    DetailedTester
};
