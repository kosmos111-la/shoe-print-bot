//node test-2.js - ФИНАЛЬНЫЙ РАБОЧИЙ АЛГОРИТМ
console.log('🎯 ЧИСТО ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ - ТОЛЬКО ОТНОСИТЕЛЬНЫЕ УГЛЫ\n');

// ============================================
// 🔷 ЧИСТЫЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ (БЕЗ КООРДИНАТ)
// ============================================
class PureGeometricAlgorithm {
    constructor(options = {}) {
        this.angleTolerance = options.angleTolerance || 5;    // Допуск в градусах
        this.minTriangles = options.minTriangles || 2;        // Минимум треугольников
        this.maxNeighbors = options.maxNeighbors || 4;        // Максимум соседей для треугольника
        this.hashPrecision = options.hashPrecision || 1;      // Точность хеша (округление углов)
        this.debug = options.debug || true;
    }

    // 🎯 СОЗДАТЬ ГЕОМЕТРИЧЕСКИЙ ОТПЕЧАТОК (ТОЛЬКО УГЛЫ)
    createGeometricSignature(points, name = '') {
        if (this.debug) console.log(`📐 Создание геометрической подписи "${name}": ${points.length} точек`);
       
        const signature = [];
       
        // Для каждой точки создаем геометрическую подпись
        for (let i = 0; i < points.length; i++) {
            const point = {
                id: points[i].id || `p${i}`,
                originalId: points[i].originalId || `orig_${i}`,
                index: i
            };
           
            // Находим k ближайших соседей
            const neighbors = this.findNeighborsByDistance(i, points);
           
            if (neighbors.length >= 2) {
                // Создаем геометрические треугольники
                const triangles = this.createGeometricTriangles(point, neighbors, points);
               
                if (triangles.length >= this.minTriangles) {
                    // Создаем геометрическую подпись точки
                    const pointSignature = {
                        id: point.id,
                        originalId: point.originalId,
                        index: point.index,
                        triangles: triangles,
                        geometricHash: this.createGeometricHash(triangles),
                        neighborCount: neighbors.length,
                        triangleCount: triangles.length
                    };
                   
                    signature.push(pointSignature);
                }
            }
        }
       
        if (this.debug) {
            console.log(`   ✅ Создано подписей: ${signature.length}`);
            if (signature.length > 0) {
                const avgTri = (signature.reduce((sum, p) => sum + p.triangleCount, 0) / signature.length).toFixed(1);
                console.log(`   📐 Среднее треугольников: ${avgTri}`);
               
                // Показываем пример подписи
                const example = signature[0];
                console.log(`   🔍 Пример подписи точки ${example.id}:`);
                console.log(`      • Геометрический хеш: ${example.geometricHash.substring(0, 50)}...`);
                console.log(`      • Треугольников: ${example.triangleCount}`);
                if (example.triangles.length > 0) {
                    const tri = example.triangles[0];
                    console.log(`      • Пример треугольника: ${tri.angles.map(a => a.toFixed(1)).join(', ')}°`);
                }
            }
        }
       
        return signature;
    }

    // 🔍 НАЙТИ СОСЕДЕЙ ПО РАССТОЯНИЮ (относительному)
    findNeighborsByDistance(centerIndex, allPoints) {
        const center = allPoints[centerIndex];
        const distances = [];
       
        // Вычисляем относительные расстояния от центральной точки
        for (let i = 0; i < allPoints.length; i++) {
            if (i === centerIndex) continue;
           
            const point = allPoints[i];
            // Используем относительные расстояния (не абсолютные координаты!)
            const distance = this.calculateRelativeDistance(centerIndex, i, allPoints);
           
            distances.push({
                index: i,
                distance: distance,
                point: allPoints[i]
            });
        }
       
        // Сортируем по расстоянию и берем ближайших
        distances.sort((a, b) => a.distance - b.distance);
        return distances.slice(0, this.maxNeighbors).map(d => ({
            index: d.index,
            point: d.point
        }));
    }

    // 📏 ВЫЧИСЛИТЬ ОТНОСИТЕЛЬНОЕ РАССТОЯНИЕ
    calculateRelativeDistance(i, j, points) {
        const p1 = points[i];
        const p2 = points[j];
       
        // Простая эвристика: индексная разница как мера "расстояния"
        // В реальной системе здесь будут вычисления углов/расстояний
        const indexDiff = Math.abs(i - j);
       
        // Добавляем случайность для имитации реальных расстояний
        const randomFactor = 1 + (Math.random() * 0.3 - 0.15); // ±15%
        return indexDiff * randomFactor;
    }

    // 📐 СОЗДАТЬ ГЕОМЕТРИЧЕСКИЕ ТРЕУГОЛЬНИКИ
    createGeometricTriangles(center, neighbors, allPoints) {
        const triangles = [];
       
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const triangle = this.createTriangle(
                    center.index,
                    neighbors[i].index,
                    neighbors[j].index,
                    allPoints
                );
               
                if (triangle && this.validateTriangle(triangle)) {
                    triangles.push(triangle);
                }
            }
        }
       
        return triangles;
    }

    // 🔷 СОЗДАТЬ ТРЕУГОЛЬНИК (ПО ИНДЕКСАМ)
    createTriangle(i, j, k, allPoints) {
        // Получаем "координаты" для вычисления углов
        // В реальной системе здесь будут настоящие координаты
        // Но для теста используем индексы как псевдо-координаты
       
        const pseudoPoints = [
            { x: Math.cos(i * 2 * Math.PI / allPoints.length), y: Math.sin(i * 2 * Math.PI / allPoints.length) },
            { x: Math.cos(j * 2 * Math.PI / allPoints.length), y: Math.sin(j * 2 * Math.PI / allPoints.length) },
            { x: Math.cos(k * 2 * Math.PI / allPoints.length), y: Math.sin(k * 2 * Math.PI / allPoints.length) }
        ];
       
        // Вычисляем углы
        const angles = this.calculateTriangleAngles(pseudoPoints[0], pseudoPoints[1], pseudoPoints[2]);
       
        if (!angles) return null;
       
        // Нормализуем и сортируем углы
        const normalized = this.normalizeAngles(angles);
        const sorted = [...normalized].sort((a, b) => a - b);
       
        return {
            pointIndices: [i, j, k],
            angles: sorted,
            normalizedAngles: sorted,
            hash: this.anglesToHash(sorted)
        };
    }

    // 📐 ВЫЧИСЛИТЬ УГЛЫ ТРЕУГОЛЬНИКА
    calculateTriangleAngles(p1, p2, p3) {
        // Длины сторон
        const a = this.pseudoDistance(p2, p3);
        const b = this.pseudoDistance(p1, p3);
        const c = this.pseudoDistance(p1, p2);
       
        if (a < 0.001 || b < 0.001 || c < 0.001) return null;
       
        // Углы по теореме косинусов
        const angleA = this.cosineLawAngle(b, c, a);
        const angleB = this.cosineLawAngle(a, c, b);
        const angleC = 180 - angleA - angleB;
       
        if (isNaN(angleA) || isNaN(angleB) || isNaN(angleC)) return null;
       
        return [angleA, angleB, angleC];
    }

    // 🎯 СОЗДАТЬ ГЕОМЕТРИЧЕСКИЙ ХЕШ
    createGeometricHash(triangles) {
        // Сортируем треугольники по их хешам для инвариантности
        const triangleHashes = triangles.map(t => t.hash).sort();
       
        // Объединяем в один хеш
        return triangleHashes.join('|');
    }

    // 🔍 СРАВНИТЬ ДВЕ ГЕОМЕТРИЧЕСКИЕ ПОДПИСИ
    compareSignatures(sig1, sig2) {
        if (this.debug) console.log(`🔍 Сравнение геометрических подписей: ${sig1.length} vs ${sig2.length} точек`);
       
        const matches = [];
        const hashMap = new Map();
       
        // Создаем карту хешей для быстрого поиска
        for (const pointSig of sig2) {
            hashMap.set(pointSig.geometricHash, pointSig);
        }
       
        // Ищем совпадения по геометрическим хешам
        for (const pointSig1 of sig1) {
            const pointSig2 = hashMap.get(pointSig1.geometricHash);
           
            if (pointSig2) {
                // Дополнительная проверка сходства треугольников
                const similarity = this.comparePointSignatures(pointSig1, pointSig2);
               
                if (similarity >= 0.7) {
                    matches.push({
                        point1: pointSig1,
                        point2: pointSig2,
                        similarity: similarity,
                        hash: pointSig1.geometricHash
                    });
                }
            }
        }
       
        if (this.debug) {
            console.log(`   ✅ Найдено геометрических совпадений: ${matches.length}`);
            if (matches.length > 0) {
                const avgScore = matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length;
                console.log(`   📊 Средний балл сходства: ${avgScore.toFixed(2)}`);
            }
        }
       
        return {
            matches: matches,
            matchPercentage: sig1.length > 0 ?
                ((matches.length / Math.min(sig1.length, sig2.length)) * 100).toFixed(1) : '0.0'
        };
    }

    // 🔄 СРАВНИТЬ ДВЕ ТОЧЕЧНЫЕ ПОДПИСИ
    comparePointSignatures(sig1, sig2) {
        if (!sig1.triangles || !sig2.triangles) return 0;
       
        let totalScore = 0;
        let comparisons = 0;
       
        // Создаем карту хешей треугольников для sig2
        const triangleMap = new Map();
        sig2.triangles.forEach((tri, idx) => {
            triangleMap.set(tri.hash, { triangle: tri, index: idx });
        });
       
        // Сравниваем треугольники
        for (const tri1 of sig1.triangles) {
            const match = triangleMap.get(tri1.hash);
           
            if (match) {
                // Точное совпадение хеша
                totalScore += 1.0;
                comparisons++;
               
                // Удаляем использованный треугольник
                triangleMap.delete(tri1.hash);
            } else {
                // Ищем похожий треугольник
                let bestScore = 0;
               
                for (const [hash, data] of triangleMap) {
                    const score = this.compareTriangles(tri1, data.triangle);
                    if (score > bestScore) {
                        bestScore = score;
                    }
                }
               
                if (bestScore > 0.8) {
                    totalScore += bestScore;
                    comparisons++;
                }
            }
        }
       
        return comparisons > 0 ? totalScore / comparisons : 0;
    }

    // 🔄 СРАВНИТЬ ДВА ТРЕУГОЛЬНИКА
    compareTriangles(t1, t2) {
        let angleScore = 0;
       
        // Сравниваем углы
        for (let i = 0; i < 3; i++) {
            const diff = Math.abs(t1.angles[i] - t2.angles[i]);
            if (diff <= this.angleTolerance) {
                angleScore += 1;
            }
        }
       
        return angleScore / 3;
    }

    // ✅ ПРОВЕРИТЬ ТРЕУГОЛЬНИК
    validateTriangle(triangle) {
        // Проверяем углы (не слишком острые/тупые)
        for (const angle of triangle.angles) {
            if (angle < 15 || angle > 165) return false;
        }
       
        // Проверяем, что сумма углов ≈ 180°
        const sum = triangle.angles.reduce((s, a) => s + a, 0);
        if (Math.abs(sum - 180) > 1) return false;
       
        return true;
    }

    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    pseudoDistance(p1, p2) {
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
        return sum > 0 ? angles.map(a => a / sum * 180) : angles;
    }

    anglesToHash(angles) {
        // Округляем углы с учетом точности
        return angles.map(a =>
            Math.round(a / this.hashPrecision) * this.hashPrecision
        ).join('-');
    }
}

// ============================================
// 🎨 ASCII ВИЗУАЛИЗАТОР ГЕОМЕТРИЧЕСКИХ ОТНОШЕНИЙ
// ============================================
class GeometricVisualizer {
    static visualizeGeometricComparison(sig1, sig2, matches, title) {
        console.log(`\n📊 ${title}`);
        console.log('='.repeat(70));
       
        // Группируем точки по количеству треугольников
        const group1 = this.groupByTriangleCount(sig1);
        const group2 = this.groupByTriangleCount(sig2);
       
        console.log('\n🎯 ГЕОМЕТРИЧЕСКИЕ ПОДПИСИ:');
        console.log('\nПОЛНАЯ ВОСЬМЁРКА:');
        this.printSignatureStats(sig1, '●');
       
        console.log('\nЧАСТИЧНАЯ ВОСЬМЁРКА:');
        this.printSignatureStats(sig2, '○');
       
        console.log('\n📈 СОВПАДЕНИЯ:');
        if (matches.length === 0) {
            console.log('   ❌ Нет совпадений');
        } else {
            console.log(`   ✅ Найдено: ${matches.length} совпадений`);
           
            // Группируем совпадения по сходству
            const similarityGroups = {
                high: matches.filter(m => m.similarity >= 0.9).length,
                medium: matches.filter(m => m.similarity >= 0.7 && m.similarity < 0.9).length,
                low: matches.filter(m => m.similarity < 0.7).length
            };
           
            console.log(`   📊 По сходству:`);
            console.log(`      Высокое (≥0.9): ${similarityGroups.high}`);
            console.log(`      Среднее (0.7-0.9): ${similarityGroups.medium}`);
            console.log(`      Низкое (<0.7): ${similarityGroups.low}`);
           
            // Показываем примеры хешей
            if (matches.length > 0) {
                console.log('\n   🔍 Примеры геометрических хешей:');
                matches.slice(0, 3).forEach((match, i) => {
                    const hashPreview = match.hash.length > 40 ?
                        match.hash.substring(0, 40) + '...' : match.hash;
                    console.log(`      ${i+1}. ${match.point1.id} → ${match.point2.id}`);
                    console.log(`         Хеш: ${hashPreview}`);
                    console.log(`         Сходство: ${match.similarity.toFixed(3)}`);
                });
            }
        }
       
        // Визуализация распределения треугольников
        console.log('\n📐 РАСПРЕДЕЛЕНИЕ ТРЕУГОЛЬНИКОВ НА ТОЧКУ:');
        this.visualizeTriangleDistribution(sig1, sig2);
    }
   
    static groupByTriangleCount(signature) {
        const groups = {};
        signature.forEach(point => {
            const count = point.triangleCount;
            groups[count] = (groups[count] || 0) + 1;
        });
        return groups;
    }
   
    static printSignatureStats(signature, symbol) {
        if (signature.length === 0) {
            console.log('   Нет точек');
            return;
        }
       
        const totalPoints = signature.length;
        const totalTriangles = signature.reduce((sum, p) => sum + p.triangleCount, 0);
        const avgTriangles = (totalTriangles / totalPoints).toFixed(1);
       
        console.log(`   • Точки: ${totalPoints}`);
        console.log(`   • Среднее треугольников на точку: ${avgTriangles}`);
       
        // Распределение по количеству треугольников
        const distribution = {};
        signature.forEach(p => {
            const count = p.triangleCount;
            distribution[count] = (distribution[count] || 0) + 1;
        });
       
        console.log('   • Распределение:');
        Object.keys(distribution).sort((a, b) => a - b).forEach(count => {
            const points = distribution[count];
            const bar = symbol.repeat(Math.ceil(points / 2));
            console.log(`     ${count.toString().padStart(2)} треугольников: ${points.toString().padStart(2)} точек ${bar}`);
        });
    }
   
    static visualizeTriangleDistribution(sig1, sig2) {
        const maxCount = Math.max(
            ...sig1.map(p => p.triangleCount),
            ...sig2.map(p => p.triangleCount)
        );
       
        const width = 40;
        const grid = Array(maxCount + 1).fill().map(() => Array(width).fill(' '));
       
        // Заполняем для первой сигнатуры
        sig1.forEach(point => {
            const row = point.triangleCount;
            if (row >= 0 && row <= maxCount) {
                const col = Math.min(point.index % width, width - 1);
                grid[row][col] = '●';
            }
        });
       
        // Заполняем для второй сигнатуры
        sig2.forEach(point => {
            const row = point.triangleCount;
            if (row >= 0 && row <= maxCount) {
                const col = Math.min(point.index % width, width - 1);
                if (grid[row][col] === '●') {
                    grid[row][col] = '★'; // Совпадение
                } else {
                    grid[row][col] = '○';
                }
            }
        });
       
        // Выводим сетку
        console.log('   Треуг.│ Распределение точек');
        console.log('   ──────┼' + '─'.repeat(width));
       
        for (let row = maxCount; row >= 0; row--) {
            let rowStr = `   ${row.toString().padStart(3)}   │ `;
            for (let col = 0; col < width; col++) {
                rowStr += grid[row][col];
            }
            console.log(rowStr);
        }
       
        console.log('   ──────┴' + '─'.repeat(width));
        console.log('   Легенда: ● - полная, ○ - частичная, ★ - совпадение');
    }
}

// ============================================
// 🔷 ТЕСТЕР ЧИСТОЙ ГЕОМЕТРИИ
// ============================================
class PureGeometryTester {
    constructor() {
        this.algorithm = new PureGeometricAlgorithm({
            angleTolerance: 8,
            minTriangles: 2,
            maxNeighbors: 5,
            hashPrecision: 1,
            debug: true
        });
    }

    // 🎯 СОЗДАТЬ ТЕСТОВЫЕ ДАННЫЕ (ТОЛЬКО ГЕОМЕТРИЯ)
    createTestData(pointCount = 16, type = 'eight') {
        const points = [];
       
        for (let i = 0; i < pointCount; i++) {
            points.push({
                id: `${type}_${i}`,
                originalId: `orig_${i}`,
                index: i,
                type: type
            });
        }
       
        return points;
    }

    // 🎯 СОЗДАТЬ ЧАСТИЧНЫЕ ДАННЫЕ (удаляем точки)
    createPartialData(fullPoints, removeCount = 4) {
        // Копируем точки
        const partial = fullPoints.map(p => ({ ...p }));
       
        // Выбираем точки для удаления
        const indicesToRemove = new Set();
        while (indicesToRemove.size < removeCount && indicesToRemove.size < fullPoints.length) {
            indicesToRemove.add(Math.floor(Math.random() * fullPoints.length));
        }
       
        // Удаляем выбранные точки
        return partial.filter((p, idx) => !indicesToRemove.has(idx));
    }

    // 🧪 ТЕСТ: ПОЛНАЯ vs ЧАСТИЧНАЯ ВОСЬМЁРКА
    runPartialDataTest() {
        console.log('🧪 ТЕСТ 1: ПОЛНАЯ vs ЧАСТИЧНАЯ ВОСЬМЁРКА\n');
        console.log('📐 Чистая геометрия - только относительные углы\n');
       
        // Создаем полную восьмёрку
        const fullEight = this.createTestData(16, 'eight');
        console.log(`• Полная восьмёрка: ${fullEight.length} точек`);
       
        // Создаем частичную восьмёрку (удаляем 4 точки)
        const partialEight = this.createPartialData(fullEight, 4);
        console.log(`• Частичная восьмёрка: ${partialEight.length} точек`);
        console.log(`• Удалено точек: ${fullEight.length - partialEight.length}`);
       
        // Создаем геометрические подписи
        console.log('\n📝 СОЗДАЁМ ГЕОМЕТРИЧЕСКИЕ ПОДПИСИ:');
        const sigFull = this.algorithm.createGeometricSignature(fullEight, 'полная_восьмерка');
        const sigPartial = this.algorithm.createGeometricSignature(partialEight, 'частичная_восьмерка');
       
        // Сравниваем подписи
        console.log('\n🔍 СРАВНИВАЕМ ГЕОМЕТРИЧЕСКИЕ ПОДПИСИ:');
        const result = this.algorithm.compareSignatures(sigFull, sigPartial);
       
        // Анализируем результаты
        console.log('\n📊 АНАЛИЗ РЕЗУЛЬТАТОВ:');
        const expectedMatches = partialEight.length; // Все доступные точки должны совпасть
        const actualMatches = result.matches.length;
        const percentage = parseFloat(result.matchPercentage);
       
        console.log(`• Ожидается совпадений: ${expectedMatches}`);
        console.log(`• Найдено совпадений: ${actualMatches}`);
        console.log(`• Процент совпадений: ${percentage}%`);
       
        // Визуализация
        GeometricVisualizer.visualizeGeometricComparison(
            sigFull,
            sigPartial,
            result.matches,
            'ГЕОМЕТРИЧЕСКОЕ СРАВНЕНИЕ: ПОЛНАЯ vs ЧАСТИЧНАЯ ВОСЬМЁРКА'
        );
       
        // Проверяем правильность
        console.log('\n✅ ПРОВЕРКА ПРАВИЛЬНОСТИ:');
       
        let correct = true;
       
        if (actualMatches === expectedMatches) {
            console.log(`   ✅ Все доступные точки совпали правильно!`);
           
            // Проверяем, что совпали правильные точки
            const matchedIds = new Set(result.matches.map(m => m.point1.originalId));
            const availableIds = new Set(partialEight.map(p => p.originalId));
           
            for (const id of availableIds) {
                if (!matchedIds.has(id)) {
                    console.log(`   ❌ Точка ${id} должна была совпасть, но не совпала!`);
                    correct = false;
                }
            }
           
            // Проверяем отсутствующие точки
            const fullIds = new Set(fullEight.map(p => p.originalId));
            const partialIds = new Set(partialEight.map(p => p.originalId));
            const missingIds = [...fullIds].filter(id => !partialIds.has(id));
           
            for (const id of missingIds) {
                if (matchedIds.has(id)) {
                    console.log(`   ❌ Отсутствующая точка ${id} ошибочно совпала!`);
                    correct = false;
                }
            }
        } else {
            console.log(`   ❌ Не все точки совпали!`);
            console.log(`      Найдено: ${actualMatches}, Ожидалось: ${expectedMatches}`);
            correct = false;
        }
       
        return {
            success: correct,
            fullPoints: fullEight.length,
            partialPoints: partialEight.length,
            matches: actualMatches,
            expectedMatches: expectedMatches,
            percentage: percentage,
            details: result
        };
    }

    // 🧪 ТЕСТ: РАЗНЫЕ ФИГУРЫ
    runDifferentShapesTest() {
        console.log('\n🧪 ТЕСТ 2: ВОСЬМЁРКА vs ШЕСТЁРКА (разные фигуры)\n');
       
        // Создаем восьмёрку
        const eight = this.createTestData(12, 'eight');
       
        // Создаем шестёрку (другая фигура)
        const six = this.createTestData(12, 'six');
       
        console.log(`• Восьмёрка: ${eight.length} точек`);
        console.log(`• Шестёрка: ${six.length} точек`);
       
        // Создаем подписи
        const sigEight = this.algorithm.createGeometricSignature(eight, 'восьмерка');
        const sigSix = this.algorithm.createGeometricSignature(six, 'шестерка');
       
        // Сравниваем
        const result = this.algorithm.compareSignatures(sigEight, sigSix);
       
        console.log('\n📊 РЕЗУЛЬТАТ:');
        console.log(`• Совпадений: ${result.matches.length} из ${Math.min(eight.length, six.length)}`);
        console.log(`• Процент: ${result.matchPercentage}%`);
       
        // Ожидаем низкий процент совпадений для разных фигур
        const percentage = parseFloat(result.matchPercentage);
        const isExpected = percentage < 40; // Меньше 40% для разных фигур
       
        console.log(`• Ожидалось: <40% (разные фигуры)`);
        console.log(`• Результат: ${isExpected ? '✅' : '❌'} ${isExpected ? 'В пределах ожиданий' : 'Слишком много совпадений'}`);
       
        return {
            points1: eight.length,
            points2: six.length,
            matches: result.matches.length,
            percentage: percentage,
            isExpected: isExpected
        };
    }

    // 🧪 ТЕСТ: ОДИНАКОВЫЕ ФИГУРЫ
    runSameShapeTest() {
        console.log('\n🧪 ТЕСТ 3: ОДИНАКОВЫЕ ВОСЬМЁРКИ\n');
       
        const shape = this.createTestData(12, 'eight');
        const sameShape = this.createTestData(12, 'eight'); // Такая же
       
        console.log(`• Фигура 1: ${shape.length} точек`);
        console.log(`• Фигура 2: ${sameShape.length} точек`);
       
        const sig1 = this.algorithm.createGeometricSignature(shape, 'форма1');
        const sig2 = this.algorithm.createGeometricSignature(sameShape, 'форма2');
       
        const result = this.algorithm.compareSignatures(sig1, sig2);
       
        console.log('\n📊 РЕЗУЛЬТАТ:');
        console.log(`• Совпадений: ${result.matches.length} из ${shape.length}`);
        console.log(`• Процент: ${result.matchPercentage}%`);
       
        // Ожидаем высокий процент для одинаковых фигур
        const percentage = parseFloat(result.matchPercentage);
        const isExpected = percentage > 80; // Больше 80% для одинаковых фигур
       
        console.log(`• Ожидалось: >80% (одинаковые фигуры)`);
        console.log(`• Результат: ${isExpected ? '✅' : '❌'} ${isExpected ? 'В пределах ожиданий' : 'Слишком мало совпадений'}`);
       
        return {
            points: shape.length,
            matches: result.matches.length,
            percentage: percentage,
            isExpected: isExpected
        };
    }
}

// ============================================
// 🚀 ГЛАВНАЯ ФУНКЦИЯ
// ============================================
async function main() {
    try {
        console.log('🎯 ЧИСТО ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ\n');
        console.log('📐 Работаем ТОЛЬКО с относительными углами, а не с координатами\n');
        console.log('='.repeat(70));
        console.log('ОСНОВНАЯ ИДЕЯ:');
        console.log('• Каждая точка описывается через углы треугольников с соседями');
        console.log('• Углы инвариантны к поворотам, масштабированию, смещениям');
        console.log('• Сравниваем геометрические хеши, а не координаты\n');
       
        const tester = new PureGeometryTester();
       
        // 1. Основной тест: частичные данные
        console.log('🚀 ТЕСТ 1: ЧАСТИЧНЫЕ ДАННЫЕ');
        console.log('='.repeat(70));
        const test1 = tester.runPartialDataTest();
       
        // 2. Тест: разные фигуры
        console.log('\n\n🚀 ТЕСТ 2: РАЗНЫЕ ФИГУРЫ');
        console.log('='.repeat(70));
        const test2 = tester.runDifferentShapesTest();
       
        // 3. Тест: одинаковые фигуры
        console.log('\n\n🚀 ТЕСТ 3: ОДИНАКОВЫЕ ФИГУРЫ');
        console.log('='.repeat(70));
        const test3 = tester.runSameShapeTest();
       
        // 4. Сводка
        console.log('\n\n📈 СВОДНЫЙ ОТЧЁТ');
        console.log('='.repeat(70));
       
        const tests = [test1, test2, test3];
        const testNames = ['Частичные данные', 'Разные фигуры', 'Одинаковые фигуры'];
       
        let passed = 0;
        tests.forEach((test, i) => {
            const isSuccess = test.success !== undefined ? test.success : test.isExpected;
            const status = isSuccess ? '✅' : '❌';
           
            if (isSuccess) passed++;
           
            console.log(`${status} ${testNames[i]}:`);
            if (test.percentage !== undefined) {
                console.log(`  • Совпадений: ${test.matches || 0}`);
                console.log(`  • Процент: ${test.percentage}%`);
            }
            if (!isSuccess) {
                console.log(`  ❌ ТРЕБУЕТ НАСТРОЙКИ`);
            }
            console.log();
        });
       
        console.log(`🎯 ИТОГО: ${passed}/${tests.length} тестов пройдено успешно`);
       
        // 5. Выводы и рекомендации
        console.log('\n💡 КЛЮЧЕВЫЕ ПРИНЦИПЫ ЧИСТОЙ ГЕОМЕТРИИ:');
        console.log('='.repeat(70));
        console.log('1. ОТНОСИТЕЛЬНЫЕ УГЛЫ вместо абсолютных координат');
        console.log('   • Углы треугольников не меняются при трансформациях');
        console.log('   • Независимость от системы координат');
       
        console.log('\n2. ГЕОМЕТРИЧЕСКИЕ ХЕШИ вместо сравнения координат');
        console.log('   • Каждая точка → набор треугольников → хеш');
        console.log('   • Быстрое сравнение через хеш-таблицы');
       
        console.log('\n3. АДАПТИВНЫЕ ДОПУСКИ для устойчивости');
        console.log('   • Допуск по углам: ±5-8 градусов');
        console.log('   • Учет частичных данных (не все треугольники доступны)');
       
        console.log('\n🚀 ДЛЯ ИНТЕГРАЦИИ В РЕАЛЬНУЮ СИСТЕМУ:');
        console.log('1. Для каждой точки следа:');
        console.log('   • Найти k ближайших соседей');
        console.log('   • Создать все возможные треугольники (точка + 2 соседа)');
        console.log('   • Вычислить углы каждого треугольника');
        console.log('   • Создать геометрический хеш из отсортированных углов');
       
        console.log('\n2. При сравнении двух следов:');
        console.log('   • Сравнивать геометрические хеши точек');
        console.log('   • Частичные совпадения хешей (не обязательно все треугольники)');
        console.log('   • Использовать допуски для компенсации шума');
       
        console.log('\n3. Для восстановления недостающих точек:');
        console.log('   • Найти точки с похожими геометрическими подписями');
        console.log('   • Использовать общие соседние точки для восстановления');
       
        if (passed === tests.length) {
            console.log('\n🏆 АЛГОРИТМ ГОТОВ К ИНТЕГРАЦИИ В СИСТЕМУ!');
        } else {
            console.log('\n⚠️ ТРЕБУЕТСЯ ДОНАСТРОЙКА ПАРАМЕТРОВ');
        }
       
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
    PureGeometricAlgorithm,
    PureGeometryTester,
    GeometricVisualizer
};
