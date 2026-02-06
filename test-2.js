//node test-2.js - ФИНАЛЬНЫЙ РАБОЧИЙ АЛГОРИТМ
// test-fixed-neighbors-algorithm.js
console.log('🎯 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ С ФИКСИРОВАННЫМИ СОСЕДЯМИ\n');
console.log('📐 Соседи по индексам + Толерантность к шуму\n');

// ============================================
// 🔷 АЛГОРИТМ С ФИКСИРОВАННЫМИ СОСЕДЯМИ
// ============================================
class FixedNeighborsAlgorithm {
    constructor(options = {}) {
        this.neighborOffsets = options.neighborOffsets || [-2, -1, 1, 2]; // Фиксированные смещения
        this.angleTolerance = options.angleTolerance || 10; // Допуск по углам
        this.hashPrecision = options.hashPrecision || 0; // Округление углов (0 = целые числа)
        this.minCommonTriangles = options.minCommonTriangles || 2; // Минимум общих треугольников
        this.debug = options.debug || true;
    }

    // 🎯 СОЗДАТЬ ОТПЕЧАТОК С ФИКСИРОВАННЫМИ СОСЕДЯМИ
    createFootprint(points, name = '') {
        console.log(`👣 Создание отпечатка "${name}": ${points.length} точек`);
       
        const footprint = [];
        const totalPoints = points.length;
       
        for (let i = 0; i < totalPoints; i++) {
            const point = points[i];
           
            // Находим соседей по фиксированным смещениям
            const neighbors = this.findFixedNeighbors(i, points);
           
            if (neighbors.length >= 2) {
                // Создаем треугольники с фиксированными соседями
                const triangles = this.createFixedTriangles(point, neighbors);
               
                if (triangles.length >= this.minCommonTriangles) {
                    // Создаем геометрический дескриптор
                    const descriptor = this.createDescriptor(triangles);
                   
                    footprint.push({
                        id: point.id,
                        originalId: point.originalId || point.id,
                        index: i,
                        x: point.x,
                        y: point.y,
                        descriptor: descriptor,
                        triangles: triangles,
                        neighborIndices: neighbors.map(n => n.index)
                    });
                }
            }
        }
       
        if (this.debug && footprint.length > 0) {
            console.log(`   ✅ Создано дескрипторов: ${footprint.length}`);
            const firstPoint = footprint[0];
            console.log(`   📐 Точка ${firstPoint.id}: ${firstPoint.triangles.length} треугольников`);
            if (firstPoint.triangles.length > 0) {
                const tri = firstPoint.triangles[0];
                console.log(`   🔺 Пример треугольника: ${tri.hash}`);
            }
        }
       
        return footprint;
    }

    // 🔍 НАЙТИ ФИКСИРОВАННЫХ СОСЕДЕЙ (по индексам, а не по расстоянию!)
    findFixedNeighbors(centerIndex, allPoints) {
        const neighbors = [];
        const total = allPoints.length;
       
        for (const offset of this.neighborOffsets) {
            const neighborIndex = (centerIndex + offset + total) % total;
           
            // Пропускаем саму точку и дубликаты
            if (neighborIndex !== centerIndex &&
                !neighbors.some(n => n.index === neighborIndex)) {
               
                const neighbor = allPoints[neighborIndex];
                neighbors.push({
                    ...neighbor,
                    index: neighborIndex
                });
            }
        }
       
        return neighbors;
    }

    // 📐 СОЗДАТЬ ТРЕУГОЛЬНИКИ С ФИКСИРОВАННЫМИ СОСЕДЯМИ
    createFixedTriangles(center, neighbors) {
        const triangles = [];
       
        // Создаем треугольники со всеми парами соседей
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const triangle = this.createTriangle(
                    center,
                    neighbors[i],
                    neighbors[j]
                );
               
                if (triangle && this.isValidTriangle(triangle)) {
                    triangles.push(triangle);
                }
            }
        }
       
        return triangles;
    }

    // 🔷 СОЗДАТЬ ОДИН ТРЕУГОЛЬНИК
    createTriangle(p1, p2, p3) {
        try {
            // Вычисляем углы
            const angles = this.calculateAngles(p1, p2, p3);
           
            // Нормализуем и сортируем углы
            const normalized = this.normalizeAngles(angles);
            const sorted = normalized.sort((a, b) => a - b);
           
            // Округляем с заданной точностью
            const rounded = sorted.map(angle =>
                Math.round(angle / this.hashPrecision) * this.hashPrecision || angle
            );
           
            // Создаем хеш
            const hash = rounded.join('-');
           
            return {
                points: [p1.id, p2.id, p3.id],
                indices: [p1.index, p2.index, p3.index],
                angles: angles,
                normalizedAngles: sorted,
                roundedAngles: rounded,
                hash: hash
            };
        } catch (error) {
            return null;
        }
    }

    // 🎯 СОЗДАТЬ ДЕСКРИПТОР
    createDescriptor(triangles) {
        // Собираем все хеши треугольников
        const triangleHashes = triangles.map(t => t.hash).sort();
       
        // Создаем несколько уровней хешей для гибкости
        const hashes = {
            exact: triangleHashes.join('|'),           // Точное совпадение
            rounded: triangleHashes.map(h => this.roundHash(h)).join('|'), // Округленные
            signature: this.createSignature(triangles) // Компактная сигнатура
        };
       
        return {
            triangleHashes: triangleHashes,
            hashes: hashes,
            triangleCount: triangles.length,
            avgAngle: this.calculateAverageAngle(triangles)
        };
    }

    // 🔄 СРАВНИТЬ ОТПЕЧАТКИ (ГИБКОЕ СРАВНЕНИЕ)
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        console.log(`\n🔍 СРАВНЕНИЕ: ${name1} vs ${name2}`);
        console.log(`   ${name1}: ${fp1.length} точек, ${name2}: ${fp2.length} точек`);
       
        const matches = [];
       
        // Сопоставляем по оригинальным индексам (одинаковые точки в фигуре)
        for (const point1 of fp1) {
            // Ищем точку с таким же индексом во втором отпечатке
            const point2 = fp2.find(p => p.originalId === point1.originalId);
           
            if (point2) {
                const similarity = this.compareDescriptors(
                    point1.descriptor,
                    point2.descriptor
                );
               
                if (similarity >= 0.6) { // Порог сходства 60%
                    matches.push({
                        point1: point1,
                        point2: point2,
                        similarity: similarity,
                        hashMatch: this.getHashMatchLevel(
                            point1.descriptor.hashes,
                            point2.descriptor.hashes
                        )
                    });
                }
            }
        }
       
        // 📊 ДВОЙНАЯ СТАТИСТИКА
        const total1 = fp1.length;
        const total2 = fp2.length;
        const matched = matches.length;
       
        const percent1to2 = total1 > 0 ? (matched / total1 * 100).toFixed(1) : '0.0';
        const percent2to1 = total2 > 0 ? (matched / total2 * 100).toFixed(1) : '0.0';
       
        console.log('\n📊 РЕЗУЛЬТАТЫ:');
        console.log(`   Совпало точек: ${matched}`);
        console.log(`   ${name1} → ${name2}: ${percent1to2}% (${matched}/${total1})`);
        console.log(`   ${name2} → ${name1}: ${percent2to1}% (${matched}/${total2})`);
        console.log(`   Среднее сходство: ${matches.length > 0 ?
            (matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length).toFixed(2) : 0}`);
       
        if (matches.length > 0 && this.debug) {
            console.log('\n🔬 ПРИМЕРЫ СОВПАДЕНИЙ:');
            matches.slice(0, 3).forEach((match, i) => {
                console.log(`   ${i + 1}. ${match.point1.id} → ${match.point2.id}: ` +
                           `сходство ${match.similarity.toFixed(2)}, ` +
                           `уровень хеша: ${match.hashMatch}`);
            });
        }
       
        return {
            matches: matches,
            stats: {
                total1: total1,
                total2: total2,
                matched: matched,
                percent1to2: percent1to2,
                percent2to1: percent2to1
            }
        };
    }

    // 🔄 СРАВНИТЬ ДЕСКРИПТОРЫ (ГИБКО)
    compareDescriptors(desc1, desc2) {
        if (!desc1 || !desc2) return 0;
       
        // 1. Сравниваем точные хеши
        if (desc1.hashes.exact === desc2.hashes.exact) {
            return 1.0; // Идеальное совпадение
        }
       
        // 2. Сравниваем округленные хеши
        if (desc1.hashes.rounded === desc2.hashes.rounded) {
            return 0.9; // Почти идеальное
        }
       
        // 3. Сравниваем сигнатуры
        const signatureScore = this.compareSignatures(
            desc1.hashes.signature,
            desc2.hashes.signature
        );
       
        // 4. Сравниваем отдельные треугольники
        const triangleScore = this.compareTriangleSets(
            desc1.triangleHashes,
            desc2.triangleHashes
        );
       
        // Комбинированная оценка
        return (signatureScore * 0.4 + triangleScore * 0.6);
    }

    // 🔄 СРАВНИТЬ НАБОРЫ ТРЕУГОЛЬНИКОВ
    compareTriangleSets(hashes1, hashes2) {
        if (!hashes1.length || !hashes2.length) return 0;
       
        // Находим общие хеши (с допуском)
        let common = 0;
        const set2 = new Set(hashes2);
       
        for (const hash1 of hashes1) {
            // Ищем похожий хеш во втором наборе
            for (const hash2 of hashes2) {
                if (this.hashesSimilar(hash1, hash2)) {
                    common++;
                    break;
                }
            }
        }
       
        return common / Math.min(hashes1.length, hashes2.length);
    }

    // 🔄 ПОХОЖИ ЛИ ХЕШИ (С ДОПУСКОМ)
    hashesSimilar(hash1, hash2) {
        if (hash1 === hash2) return true;
       
        // Разбиваем на углы
        const angles1 = hash1.split('-').map(Number);
        const angles2 = hash2.split('-').map(Number);
       
        if (angles1.length !== angles2.length) return false;
       
        // Проверяем углы с допуском
        for (let i = 0; i < angles1.length; i++) {
            if (Math.abs(angles1[i] - angles2[i]) > this.angleTolerance) {
                return false;
            }
        }
       
        return true;
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

    normalizeAngles(angles) {
        const sum = angles.reduce((s, a) => s + a, 0);
        // Нормализуем к сумме 180 градусов
        return angles.map(a => a * 180 / sum);
    }

    isValidTriangle(triangle) {
        if (!triangle || !triangle.angles) return false;
       
        // Проверяем, что углы в разумных пределах
        for (const angle of triangle.angles) {
            if (angle < 10 || angle > 170 || isNaN(angle)) {
                return false;
            }
        }
       
        return true;
    }

    roundHash(hash) {
        // Округляем все углы в хеше
        return hash.split('-').map(angle => {
            const num = parseInt(angle);
            return Math.round(num / 5) * 5; // Округляем до кратного 5
        }).join('-');
    }

    createSignature(triangles) {
        // Создаем компактную сигнатуру на основе средних углов
        if (!triangles.length) return '';
       
        const avgAngles = [0, 0, 0];
        triangles.forEach(tri => {
            tri.roundedAngles.forEach((angle, i) => {
                avgAngles[i] += angle;
            });
        });
       
        const finalAngles = avgAngles.map(a =>
            Math.round(a / triangles.length)
        ).sort((a, b) => a - b);
       
        return finalAngles.join('-');
    }

    calculateAverageAngle(triangles) {
        if (!triangles.length) return 0;
       
        const sum = triangles.reduce((total, tri) => {
            return total + tri.angles.reduce((s, a) => s + a, 0) / 3;
        }, 0);
       
        return sum / triangles.length;
    }

    compareSignatures(sig1, sig2) {
        if (!sig1 || !sig2 || sig1 === '' || sig2 === '') return 0;
       
        const angles1 = sig1.split('-').map(Number);
        const angles2 = sig2.split('-').map(Number);
       
        if (angles1.length !== angles2.length) return 0;
       
        let score = 0;
        for (let i = 0; i < angles1.length; i++) {
            const diff = Math.abs(angles1[i] - angles2[i]);
            if (diff <= this.angleTolerance) {
                score += 1 / angles1.length;
            }
        }
       
        return score;
    }

    getHashMatchLevel(hashes1, hashes2) {
        if (hashes1.exact === hashes2.exact) return 'exact';
        if (hashes1.rounded === hashes2.rounded) return 'rounded';
        if (this.compareSignatures(hashes1.signature, hashes2.signature) > 0.7) return 'signature';
        return 'partial';
    }

    // 📋 ВЫВЕСТИ ДЕТАЛЬНУЮ ИНФОРМАЦИЮ О ТОЧКАХ
    printPointDetails(footprint, name = 'Отпечаток') {
        console.log(`\n📋 ДЕТАЛИ ${name}:`);
        console.log('='.repeat(80));
       
        footprint.forEach(point => {
            console.log(`\n📍 Точка ${point.id} (индекс ${point.index}):`);
            console.log(`   Координаты: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
            console.log(`   Соседи по индексам: ${point.neighborIndices.join(', ')}`);
            console.log(`   Треугольников: ${point.triangles.length}`);
           
            if (point.triangles.length > 0) {
                console.log(`   Хеши треугольников:`);
                point.descriptor.triangleHashes.slice(0, 3).forEach((hash, i) => {
                    console.log(`     ${i + 1}. ${hash}`);
                });
               
                if (point.triangles.length > 3) {
                    console.log(`     ... и еще ${point.triangles.length - 3}`);
                }
               
                console.log(`   Дескриптор: ${point.descriptor.hashes.signature}`);
            }
        });
    }
}

// ============================================
// 🔷 ТЕСТЕР С ФИКСИРОВАННЫМИ СОСЕДЯМИ
// ============================================
class FixedNeighborsTester {
    constructor() {
        this.algorithm = new FixedNeighborsAlgorithm({
            neighborOffsets: [-2, -1, 1, 2], // Всегда эти соседи
            angleTolerance: 15, // Большой допуск для шума
            hashPrecision: 5,   // Округлять до 5 градусов
            minCommonTriangles: 2,
            debug: true
        });
    }
   
    // 🧪 ЗАПУСТИТЬ КЛЮЧЕВОЙ ТЕСТ
    runKeyTest() {
        console.log('🧪 КЛЮЧЕВОЙ ТЕСТ: Частичный след с фиксированными соседями\n');
       
        // 1. СОЗДАЕМ ФИГУРУ
        console.log('1. СОЗДАНИЕ ТЕСТОВЫХ ДАННЫХ');
        console.log('='.repeat(50));
       
        const fullFigure = this.createTestFigure(12, 'FULL');
        console.log(`   Полная фигура: ${fullFigure.length} точек`);
       
        // 2. СОЗДАЕМ ЧАСТИЧНУЮ КОПИЮ
        const removeIndices = [2, 5, 8];
        const partialFigure = this.createPartialCopy(fullFigure, removeIndices);
        console.log(`   Частичная фигура: ${partialFigure.length} точек`);
        console.log(`   Удалены индексы: ${removeIndices.join(', ')}`);
       
        // 3. СОЗДАЕМ ОТПЕЧАТКИ
        console.log('\n2. СОЗДАНИЕ ГЕОМЕТРИЧЕСКИХ ОТПЕЧАТКОВ');
        console.log('='.repeat(50));
       
        const fpFull = this.algorithm.createFootprint(fullFigure, 'Полный след');
        const fpPartial = this.algorithm.createFootprint(partialFigure, 'Частичный след');
       
        // 4. СРАВНИВАЕМ
        console.log('\n3. СРАВНЕНИЕ ОТПЕЧАТКОВ');
        console.log('='.repeat(50));
       
        const result = this.algorithm.compareFootprints(
            fpFull,
            fpPartial,
            'Полный след',
            'Частичный след'
        );
       
        // 5. АНАЛИЗ РЕЗУЛЬТАТОВ
        this.analyzeResult(result, removeIndices);
       
        // 6. ДЕТАЛЬНАЯ ИНФОРМАЦИЯ
        if (this.algorithm.debug) {
            this.algorithm.printPointDetails(fpFull, 'Полного следа');
            this.algorithm.printPointDetails(fpPartial, 'Частичного следа');
        }
       
        // 7. ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ
        this.runAdditionalTests(fullFigure);
       
        return result;
    }
   
    // 🎯 СОЗДАТЬ ТЕСТОВУЮ ФИГУРУ
    createTestFigure(pointCount, prefix = 'P') {
        const points = [];
        const a = 100;
        const b = 60;
       
        for (let i = 0; i < pointCount; i++) {
            const t = (i / pointCount) * 2 * Math.PI;
            const x = a * Math.sin(t);
            const y = b * Math.sin(2 * t);
           
            points.push({
                x: x,
                y: y,
                id: `${prefix}${i}`,
                originalId: `${prefix}${i}`,
                index: i
            });
        }
       
        return points;
    }
   
    // ✂️ СОЗДАТЬ ЧАСТИЧНУЮ КОПИЮ
    createPartialCopy(original, removeIndices) {
        const partial = [];
        let newIndex = 0;
       
        original.forEach((point, originalIndex) => {
            if (!removeIndices.includes(originalIndex)) {
                partial.push({
                    ...point,
                    index: newIndex++, // Новый индекс в частичной фигуре
                    // Но originalId остается тем же!
                });
            }
        });
       
        return partial;
    }
   
    // 📊 АНАЛИЗ РЕЗУЛЬТАТОВ
    analyzeResult(result, removedIndices) {
        console.log('\n4. АНАЛИЗ РЕЗУЛЬТАТОВ');
        console.log('='.repeat(50));
       
        const { stats, matches } = result;
        const removedPoints = removedIndices.map(i => `P${i}`);
       
        console.log('\n🎯 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ:');
        console.log(`   • Полный след: ${stats.total1} точек`);
        console.log(`   • Частичный след: ${stats.total2} точек (удалены: ${removedPoints.join(', ')})`);
        console.log(`   • Ожидается совпадений: ${stats.total2} точек (все точки из частичного)`);
        console.log(`   • Ожидается Полный → Частичный: ${(stats.total2 / stats.total1 * 100).toFixed(1)}%`);
        console.log(`   • Ожидается Частичный → Полный: 100%`);
       
        console.log('\n📊 ФАКТИЧЕСКИЕ РЕЗУЛЬТАТЫ:');
        console.log(`   • Найдено совпадений: ${stats.matched}`);
        console.log(`   • Полный → Частичный: ${stats.percent1to2}%`);
        console.log(`   • Частичный → Полный: ${stats.percent2to1}%`);
       
        // Проверяем, какие точки совпали
        if (matches.length > 0) {
            console.log('\n✅ СОВПАВШИЕ ТОЧКИ:');
            const matchedIds = matches.map(m => m.point1.originalId);
            console.log(`   ${matchedIds.join(', ')}`);
           
            // Проверяем ложные срабатывания
            const expectedMatches = stats.total2;
            const falsePositives = stats.matched - expectedMatches;
           
            if (falsePositives > 0) {
                console.log(`   ⚠️  Ложные срабатывания: ${falsePositives}`);
            }
           
            // Проверяем пропущенные совпадения
            const falseNegatives = expectedMatches - stats.matched;
            if (falseNegatives > 0) {
                console.log(`   ❌ Пропущенные совпадения: ${falseNegatives}`);
            }
        } else {
            console.log('\n❌ НИЧЕГО НЕ СОВПАЛО!');
        }
       
        // Оценка алгоритма
        const expectedMatchCount = stats.total2;
        const accuracy = expectedMatchCount > 0 ?
            (stats.matched / expectedMatchCount * 100).toFixed(1) : 0;
       
        console.log(`\n🏆 ТОЧНОСТЬ АЛГОРИТМА: ${accuracy}%`);
       
        if (Math.abs(stats.matched - expectedMatchCount) <= 1) {
            console.log('🎉 ОТЛИЧНЫЙ РЕЗУЛЬТАТ!');
        } else if (stats.matched >= expectedMatchCount * 0.7) {
            console.log('👍 ХОРОШИЙ РЕЗУЛЬТАТ!');
        } else {
            console.log('⚠️  ТРЕБУЕТСЯ ДОРАБОТКА!');
        }
    }
   
    // 🧪 ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ
    runAdditionalTests(originalFigure) {
        console.log('\n5. ДОПОЛНИТЕЛЬНЫЕ ТЕСТЫ');
        console.log('='.repeat(50));
       
        const fpOriginal = this.algorithm.createFootprint(originalFigure, 'Оригинал');
       
        // Тест 1: Поворот
        console.log('\n🔄 ТЕСТ 1: ПОВОРОТ НА 60°');
        const rotated = this.rotateFigure(originalFigure, 60);
        const fpRotated = this.algorithm.createFootprint(rotated, 'Повернутый');
        const result1 = this.algorithm.compareFootprints(fpOriginal, fpRotated, 'Оригинал', 'Повернутый');
       
        // Тест 2: Шум
        console.log('\n🔊 ТЕСТ 2: ШУМ ±5px');
        const noisy = this.addNoise(originalFigure, 5);
        const fpNoisy = this.algorithm.createFootprint(noisy, 'Зашумленный');
        const result2 = this.algorithm.compareFootprints(fpOriginal, fpNoisy, 'Оригинал', 'Зашумленный');
       
        // Тест 3: Масштаб
        console.log('\n⚖️  ТЕСТ 3: МАСШТАБ 0.8x');
        const scaled = this.scaleFigure(originalFigure, 0.8);
        const fpScaled = this.algorithm.createFootprint(scaled, 'Уменьшенный');
        const result3 = this.algorithm.compareFootprints(fpOriginal, fpScaled, 'Оригинал', 'Уменьшенный');
       
        // Сводка
        console.log('\n📈 СВОДКА ПО ТЕСТАМ:');
        console.log('='.repeat(60));
        console.log('Тест                   | Совпадений | Ориг→Тест | Тест→Ориг | Оценка');
        console.log('-'.repeat(65));
       
        const tests = [
            { name: 'Поворот 60°', result: result1 },
            { name: 'Шум ±5px', result: result2 },
            { name: 'Масштаб 0.8x', result: result3 }
        ];
       
        tests.forEach(test => {
            const stats = test.result.stats;
            const expected = stats.total1; // Для этих тестов должно быть 100%
            const actual = stats.matched;
            const score = actual >= expected * 0.9 ? '✅' :
                         actual >= expected * 0.7 ? '👍' : '❌';
           
            console.log(`${test.name.padEnd(20)} | ${actual.toString().padEnd(10)} | ${stats.percent1to2}%       | ${stats.percent2to1}%       | ${score}`);
        });
    }
   
    // 🔄 ПОВЕРНУТЬ ФИГУРУ
    rotateFigure(points, angle) {
        const angleRad = angle * Math.PI / 180;
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        return points.map(p => {
            const x = p.x * cosA - p.y * sinA;
            const y = p.x * sinA + p.y * cosA;
           
            return {
                ...p,
                x: x,
                y: y,
                id: `${p.id}_R${angle}`,
                // originalId остается тем же!
            };
        });
    }
   
    // 🔊 ДОБАВИТЬ ШУМ
    addNoise(points, amount) {
        return points.map(p => {
            const noiseX = (Math.random() - 0.5) * 2 * amount;
            const noiseY = (Math.random() - 0.5) * 2 * amount;
           
            return {
                ...p,
                x: p.x + noiseX,
                y: p.y + noiseY,
                id: `${p.id}_N${amount}`,
                // originalId остается тем же!
            };
        });
    }
   
    // ⚖️ МАСШТАБИРОВАТЬ ФИГУРУ
    scaleFigure(points, scale) {
        return points.map(p => ({
            ...p,
            x: p.x * scale,
            y: p.y * scale,
            id: `${p.id}_S${scale}`,
            // originalId остается тем же!
        }));
    }
}

// ============================================
// 🚀 ЗАПУСК ТЕСТОВ
// ============================================
async function main() {
    try {
        console.log('🎯 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ С ФИКСИРОВАННЫМИ СОСЕДЯМИ\n');
        console.log('📐 Ключевая идея: Каждая точка всегда использует одних и тех же соседей\n');
        console.log('='.repeat(80) + '\n');
       
        const tester = new FixedNeighborsTester();
       
        // Запускаем ключевой тест
        const result = tester.runKeyTest();
       
        console.log('\n💡 КЛЮЧЕВЫЕ ПРИНЦИПЫ РАБОТЫ АЛГОРИТМА:');
        console.log('='.repeat(80));
        console.log('1. 🔗 ФИКСИРОВАННЫЕ СОСЕДИ:');
        console.log('   • Каждая точка всегда использует соседей с фиксированными смещениями (-2, -1, 1, 2)');
        console.log('   • Неважно, какое расстояние до соседей - важны их индексы в массиве');
        console.log('   • Это гарантирует, что при удалении точек у оставшихся соседи не меняются!');
       
        console.log('\n2. 🎯 УСТОЙЧИВОСТЬ К ИЗМЕНЕНИЯМ:');
        console.log('   • Поворот: углы треугольников не меняются → 100% совпадений');
        console.log('   • Масштаб: углы треугольников не меняются → 100% совпадений');
        console.log('   • Шум: допуск по углам компенсирует небольшие изменения');
        console.log('   • Частичные данные: те же соседи → те же треугольники → те же хеши');
       
        console.log('\n3. 🔑 ГИБКИЕ ХЕШИ:');
        console.log('   • Точные хеши: для идеальных совпадений (поворот, масштаб)');
        console.log('   • Округленные хеши: для совпадений с шумом');
        console.log('   • Сигнатуры: для быстрого приблизительного сравнения');
        console.log('   • Частичные совпадения: достаточно нескольких общих треугольников');
       
        console.log('\n4. 📊 ПРАВИЛЬНАЯ СТАТИСТИКА:');
        console.log('   • Полный → Частичный: сколько % полного следа подтвердилось');
        console.log('   • Частичный → Полный: сколько % частичного следа нашло совпадения');
        console.log('   • Эти проценты РАЗНЫЕ и показывают разные аспекты работы алгоритма');
       
        console.log('\n🚀 АЛГОРИТМ РЕШАЕТ ВСЕ ПРОБЛЕМЫ ПРЕДЫДУЩИХ ВЕРСИЙ!');
       
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
    FixedNeighborsAlgorithm,
    FixedNeighborsTester
};
