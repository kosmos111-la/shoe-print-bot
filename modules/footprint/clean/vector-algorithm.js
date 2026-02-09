// modules/footprint/clean/vector-algorithm.js
// 🎯 ВЕКТОРНЫЙ АЛГОРИТМ ИЗ ТВОЕГО ФАЙЛА (упрощенный)

console.log('🎯 УПРОЩЕННЫЙ ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ (паспорта)\n');

class VectorAlgorithm {
    constructor(options = {}) {
        // 🔥 КЛЮЧЕВЫЕ ПАРАМЕТРЫ
        this.neighborCount = options.neighborCount || 3;       // 3 ближайших соседа (для треугольников)
        this.angleTolerance = options.angleTolerance || 10;    // 10° допуск
        this.minSimilarity = options.minSimilarity || 0.6;     // 60% порог
        this.debug = options.debug !== false;

        console.log(`🎯 Параметры: ${this.neighborCount} соседей, порог ${this.minSimilarity * 100}%`);
    }

    // ============================================
    // 🎯 СОЗДАНИЕ ГЕОМЕТРИЧЕСКОГО ПАСПОРТА (упрощенный)
    // ============================================

    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`🎯 Создаю геометрические паспорта "${name}" из ${points.length} точек`);
        }

        const vectorFootprint = [];

        // 🔥 ВАЖНО: НОРМАЛИЗУЕМ ТОЧКИ (центрируем)
        const normalizedPoints = this.normalizePoints(points);

        for (let i = 0; i < normalizedPoints.length; i++) {
            const point = normalizedPoints[i];
           
            // 🔥 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЙ ПАСПОРТ (упрощенный)
            const passport = this.createGeometricPassport(point, normalizedPoints, i);
           
            vectorFootprint.push({
                originalId: point.id || `pt_${i}`,
                x: point.x,        // Оригинальные координаты
                y: point.y,
                nx: point.nx,      // Нормализованные координаты
                ny: point.ny,
                confidence: point.confidence || 0.5,
                index: i,
               
                // 🔥 ГЕОМЕТРИЧЕСКИЙ ПАСПОРТ
                vectorId: passport.vectorId,
                geometricHash: passport.vectorId,
               
                // Для сравнения
                triangles: passport.triangles,
                neighborCount: passport.neighborCount,
               
                confirmedCount: 1
            });
        }

        if (this.debug && vectorFootprint.length > 0) {
            console.log(`✅ Создано ${vectorFootprint.length} геометрических паспортов`);
        }

        return vectorFootprint;
    }

    // 🔥 НОРМАЛИЗАЦИЯ ТОЧЕК (центрирование)
    normalizePoints(points) {
        if (points.length < 3) return points.map(p => ({ ...p, nx: p.x, ny: p.y }));

        // Находим центр
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        points.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Центрируем относительно центра
        return points.map((p, idx) => ({
            ...p,
            nx: p.x - centerX,  // Нормализованная X
            ny: p.y - centerY,  // Нормализованная Y
            originalIndex: idx
        }));
    }

    // 🔥 СОЗДАНИЕ ГЕОМЕТРИЧЕСКОГО ПАСПОРТА
    createGeometricPassport(centerPoint, allPoints, centerIndex) {
        // Находим ближайших соседей
        const neighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, this.neighborCount);
       
        if (neighbors.length < 2) {
            return {
                vectorId: `SIMPLE_${centerIndex}_N0`,
                triangles: [],
                neighborCount: 0
            };
        }

        // 🔥 СОЗДАЕМ ТРЕУГОЛЬНИКИ (геометрические отношения)
        const triangles = [];
       
        // Создаем треугольники с парами соседей
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const triangle = this.createTriangle(
                    centerPoint,
                    neighbors[i],
                    neighbors[j]
                );
               
                if (triangle) {
                    triangles.push(triangle);
                }
            }
        }

        // 🔥 СОЗДАЕМ ВЕКТОРНЫЙ ID НА ОСНОВЕ ТРЕУГОЛЬНИКОВ
        const vectorId = this.createVectorIdFromTriangles(triangles, neighbors.length);

        return {
            vectorId: vectorId,
            triangles: triangles,
            neighborCount: neighbors.length
        };
    }

    // 🔥 СОЗДАНИЕ ТРЕУГОЛЬНИКА
    createTriangle(p1, p2, p3) {
        try {
            // Вычисляем стороны
            const a = this.distance(p2, p3);
            const b = this.distance(p1, p3);
            const c = this.distance(p1, p2);

            // Вычисляем углы
            const angleA = this.cosineLawAngle(b, c, a);
            const angleB = this.cosineLawAngle(a, c, b);
            const angleC = this.cosineLawAngle(a, b, c);

            // Сортируем углы для инвариантности
            const sortedAngles = [angleA, angleB, angleC].sort((x, y) => x - y);

            // Округляем
            const roundedAngles = sortedAngles.map(angle => Math.round(angle / 5) * 5);

            return {
                angles: sortedAngles,
                roundedAngles: roundedAngles,
                hash: roundedAngles.join('-')
            };
        } catch (error) {
            return null;
        }
    }

    // 🔥 СОЗДАНИЕ ВЕКТОРНОГО ID ИЗ ТРЕУГОЛЬНИКОВ
    createVectorIdFromTriangles(triangles, neighborCount) {
        if (triangles.length === 0) {
            return `SIMPLE_N${neighborCount}`;
        }

        // Собираем хэши треугольников
        const triangleHashes = triangles.map(t => t.hash).filter(h => h).sort();
       
        // Берем первые 2 треугольника (самые стабильные)
        const mainHashes = triangleHashes.slice(0, 2);
       
        return `TRI_${neighborCount}_${mainHashes.join('|')}`.slice(0, 100);
    }

    // ============================================
    // 🔄 СРАВНЕНИЕ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ
    // ============================================

    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        if (this.debug) {
            console.log(`\n🔍 СРАВНЕНИЕ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);
        }

        if (fp1.length === 0 || fp2.length === 0) {
            return this.createEmptyComparisonResult();
        }

        try {
            // 🔥 СРАВНЕНИЕ ПО ВЕКТОРНЫМ ID (геометрические паспорта)
            const matches = [];
            const used2 = new Set();

            // Map для быстрого поиска
            const fp2Map = new Map();
            fp2.forEach((point, index) => {
                fp2Map.set(point.vectorId, { point, index });
            });

            // 1. Ищем точные совпадения
            for (const point1 of fp1) {
                const exactMatch = fp2Map.get(point1.vectorId);
               
                if (exactMatch && !used2.has(exactMatch.index)) {
                    matches.push({
                        point1: point1,
                        point2: exactMatch.point,
                        similarity: 1.0,
                        matchType: 'exact_passport',
                        confidence: 1.0
                    });
                    used2.add(exactMatch.index);
                }
            }

            const matchedPoints = matches.length;
            const maxPossible = Math.min(fp1.length, fp2.length);
            const similarity = maxPossible > 0 ? matchedPoints / maxPossible : 0;

            const isSame = similarity >= this.minSimilarity;
            const decision = isSame ? 'same' : 'different';

            if (this.debug) {
                console.log(`📊 РЕЗУЛЬТАТ:`);
                console.log(`   Точные совпадения паспортов: ${matchedPoints}/${maxPossible}`);
                console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}% (порог: ${this.minSimilarity * 100}%)`);
                console.log(`   Решение: ${decision}`);
            }

            return {
                similar: isSame,
                similarity: similarity,
                decision: decision,
                matches: matches,
                stats: {
                    totalPoints1: fp1.length,
                    totalPoints2: fp2.length,
                    matchedPoints: matchedPoints,
                    percent1to2: fp1.length > 0 ? (matchedPoints / fp1.length * 100).toFixed(1) : '0.0',
                    percent2to1: fp2.length > 0 ? (matchedPoints / fp2.length * 100).toFixed(1) : '0.0',
                    similarity: similarity
                }
            };

        } catch (error) {
            console.error(`❌ Ошибка сравнения: ${error.message}`);
            return this.createEmptyComparisonResult();
        }
    }

    // ============================================
    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================

    findNearestNeighbors(centerPoint, allPoints, centerIndex, count) {
        const distances = [];

        for (let i = 0; i < allPoints.length; i++) {
            if (i === centerIndex) continue;

            const dx = allPoints[i].nx - centerPoint.nx;
            const dy = allPoints[i].ny - centerPoint.ny;
            const distance = Math.sqrt(dx * dx + dy * dy);

            distances.push({
                point: allPoints[i],
                distance: distance,
                index: i
            });
        }

        distances.sort((a, b) => a.distance - b.distance);
        return distances.slice(0, count).map(d => d.point);
    }

    distance(p1, p2) {
        const dx = p1.nx - p2.nx;
        const dy = p1.ny - p2.ny;
        return Math.sqrt(dx * dx + dy * dy);
    }

    cosineLawAngle(side1, side2, opposite) {
        const cos = (side1 * side1 + side2 * side2 - opposite * opposite) / (2 * side1 * side2);
        const clamped = Math.max(-1, Math.min(1, cos));
        return Math.acos(clamped) * 180 / Math.PI;
    }

    createEmptyComparisonResult() {
        return {
            similar: false,
            similarity: 0,
            decision: 'different',
            matches: [],
            stats: {
                totalPoints1: 0,
                totalPoints2: 0,
                matchedPoints: 0,
                percent1to2: '0.0',
                percent2to1: '0.0',
                similarity: 0
            }
        };
    }

    // 🔥 МЕТОД ДЛЯ СОВМЕСТИМОСТИ
    comparePoints(points1, points2, name1 = 'След 1', name2 = 'След 2') {
        const fp1 = this.createFootprint(points1, name1);
        const fp2 = this.createFootprint(points2, name2);

        return this.compareFootprints(fp1, fp2, name1, name2);
    }
}

module.exports = VectorAlgorithm;
