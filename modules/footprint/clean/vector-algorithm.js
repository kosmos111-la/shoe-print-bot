// modules/footprint/clean/vector-algorithm.js
// 🎯 ВЕКТОРНЫЙ АЛГОРИТМ С ГЕОМЕТРИЧЕСКИМИ ПАСПОРТАМИ (ПОЛНАЯ ВЕРСИЯ)

console.log('🎯 ВЕКТОРНЫЙ АЛГОРИТМ С ПАСПОРТАМИ - ПОЛНАЯ ВЕРСИЯ\n');

class VectorAlgorithm {
    constructor(options = {}) {
        // 🔥 КЛЮЧЕВЫЕ ПАРАМЕТРЫ
        this.neighborDepth = options.neighborDepth || 2;       // Глубина анализа
        this.angleTolerance = options.angleTolerance || 10;    // Допуск по углам
        this.hashPrecision = options.hashPrecision || 5;       // Округление углов
        this.minSimilarity = options.minSimilarity || 0.6;     // Минимальная схожесть
        this.minPointsForFootprint = options.minPointsForFootprint || 3;
        this.debug = options.debug !== false;

        console.log(`🎯 Полная векторная система: ${this.neighborDepth} уровня, порог ${this.minSimilarity * 100}%`);
    }

    // ============================================
    // 🎯 СОЗДАНИЕ ВЕКТОРНОГО ОТПЕЧАТКА
    // ============================================

    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`🎯 Создаю векторный отпечаток "${name}" из ${points.length} точек`);
        }

        if (points.length < this.minPointsForFootprint) {
            return this.createSimpleFootprint(points, name);
        }

        // 🔥 ВАЖНО: НЕ НОРМАЛИЗУЕМ координаты! Работаем с оригинальными
        const vectorFootprint = [];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];

            // 🔥 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЙ ПАСПОРТ на основе ОРИГИНАЛЬНЫХ координат
            const passport = this.createGeometricPassport(point, i, points);

            if (passport) {
                vectorFootprint.push({
                    // 🔥 ИСПОЛЬЗУЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ
                    x: point.x,
                    y: point.y,
                    index: i,
                    confidence: point.confidence || 0.5,
                    originalId: point.id || `pt_${i}`,

                    // 🔥 ГЕОМЕТРИЧЕСКИЙ ПАСПОРТ
                    vectorId: passport.vectorId,
                    geometricHash: passport.vectorId,
                   
                    // Данные для сравнения
                    triangles: passport.triangles || [],
                    neighborRelations: passport.neighborRelations || [],
                    structuralRole: passport.structuralRole || {},
                   
                    // Для статистики
                    confirmedCount: 1
                });
            }
        }

        if (this.debug) {
            console.log(`✅ Создано ${vectorFootprint.length} векторных паспортов`);
            if (vectorFootprint.length > 0) {
                console.log(`   Пример vectorId: ${vectorFootprint[0].vectorId?.substring(0, 60)}...`);
            }
        }

        return vectorFootprint;
    }

    // 🔥 СОЗДАНИЕ ГЕОМЕТРИЧЕСКОГО ПАСПОРТА (упрощенная версия)
    createGeometricPassport(centerPoint, centerIndex, allPoints) {
        // 🔥 УРОВЕНЬ 1: Локальные треугольники
        const triangles = this.createLocalTriangles(centerPoint, centerIndex, allPoints);

        // 🔥 УРОВЕНЬ 2: Отношения с соседями
        const neighborRelations = this.analyzeNeighborRelations(centerPoint, centerIndex, allPoints);

        // 🔥 СОЗДАЕМ УПРОЩЕННЫЙ ВЕКТОРНЫЙ ID
        const vectorId = this.createVectorIdFromRelations(centerPoint, centerIndex, allPoints, triangles, neighborRelations);

        return {
            vectorId: vectorId,
            triangles: triangles,
            neighborRelations: neighborRelations,
            structuralRole: {
                type: triangles.length > 0 ? 'connected' : 'isolated',
                triangleCount: triangles.length
            }
        };
    }

    // 🔥 СОЗДАНИЕ ЛОКАЛЬНЫХ ТРЕУГОЛЬНИКОВ (оптимизированная версия)
    createLocalTriangles(centerPoint, centerIndex, allPoints) {
        const triangles = [];
        const neighbors = this.findNearestNeighbors(centerPoint, centerIndex, allPoints, 4);

        if (neighbors.length < 2) return triangles;

        // Создаем треугольники с ближайшими соседями
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const triangle = this.createTriangle(
                    centerPoint,
                    neighbors[i],
                    neighbors[j]
                );
                if (triangle) triangles.push(triangle);
            }
        }

        return triangles;
    }

    // 🔥 СОЗДАНИЕ ТРЕУГОЛЬНИКА
    createTriangle(p1, p2, p3) {
        try {
            // Вычисляем углы
            const a = this.distance(p2, p3);
            const b = this.distance(p1, p3);
            const c = this.distance(p1, p2);

            const angleA = this.cosineLawAngle(b, c, a);
            const angleB = this.cosineLawAngle(a, c, b);
            const angleC = this.cosineLawAngle(a, b, c);

            // Округляем
            const roundedA = Math.round(angleA / this.hashPrecision) * this.hashPrecision;
            const roundedB = Math.round(angleB / this.hashPrecision) * this.hashPrecision;
            const roundedC = Math.round(angleC / this.hashPrecision) * this.hashPrecision;

            // Сортируем и создаем хэш
            const sorted = [roundedA, roundedB, roundedC].sort((x, y) => x - y);
            const hash = sorted.join('-');

            return {
                angles: [angleA, angleB, angleC],
                roundedAngles: sorted,
                hash: hash
            };
        } catch (error) {
            return null;
        }
    }

    // 🔥 АНАЛИЗ ОТНОШЕНИЙ С СОСЕДЯМИ
    analyzeNeighborRelations(centerPoint, centerIndex, allPoints) {
        const relations = [];
        const neighbors = this.findNearestNeighbors(centerPoint, centerIndex, allPoints, 4);

        for (const neighbor of neighbors) {
            const dx = neighbor.x - centerPoint.x;
            const dy = neighbor.y - centerPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const normalizedAngle = ((angle % 360) + 360) % 360;

            relations.push({
                distance: distance,
                angle: normalizedAngle,
                roundedDistance: Math.round(distance / 10) * 10,
                roundedAngle: Math.round(normalizedAngle / 15) * 15
            });
        }

        return relations;
    }

    // 🔥 СОЗДАНИЕ ВЕКТОРНОГО ID ИЗ ОТНОШЕНИЙ
    createVectorIdFromRelations(centerPoint, centerIndex, allPoints, triangles, neighborRelations) {
        // 🔥 ОСНОВНОЙ ХЭШ: на основе расстояний и углов к 4 ближайшим соседям
        const neighbors = this.findNearestNeighbors(centerPoint, centerIndex, allPoints, 4);
       
        let hash = `VEC_${centerIndex}_N${neighbors.length}_`;

        // Добавляем информацию о соседях
        neighbors.forEach((neighbor, idx) => {
            const dx = neighbor.x - centerPoint.x;
            const dy = neighbor.y - centerPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const normalizedAngle = ((angle % 360) + 360) % 360;

            const roundedDistance = Math.round(distance / 5) * 5;
            const roundedAngle = Math.round(normalizedAngle / 10) * 10;

            hash += `D${roundedDistance}_A${roundedAngle}_`;
        });

        // Добавляем информацию о треугольниках
        if (triangles.length > 0) {
            const triangleHashes = triangles.map(t => t.hash).sort();
            const triangleHash = triangleHashes.slice(0, 2).join('|'); // Берем 2 первых
            hash += `T${triangleHash}_`;
        }

        return hash.substring(0, 120); // Ограничиваем длину
    }

    // ============================================
    // 🔄 СРАВНЕНИЕ ВЕКТОРНЫХ ОТПЕЧАТКОВ
    // ============================================

    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        if (this.debug) {
            console.log(`\n🔍 СРАВНЕНИЕ: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);
        }

        if (fp1.length === 0 || fp2.length === 0) {
            return this.createEmptyComparisonResult();
        }

        try {
            // 🔥 БЫСТРОЕ СРАВНЕНИЕ ПО ВЕКТОРНЫМ ID
            const matches = [];
            const used2 = new Set();

            // Создаем Map для быстрого поиска
            const fp2Map = new Map();
            fp2.forEach((point, index) => {
                fp2Map.set(point.vectorId, { point, index });
            });

            // 1. Ищем точные совпадения по vectorId
            let exactMatches = 0;
            for (const point1 of fp1) {
                const exactMatch = fp2Map.get(point1.vectorId);
                if (exactMatch && !used2.has(exactMatch.index)) {
                    matches.push({
                        point1: point1,
                        point2: exactMatch.point,
                        similarity: 1.0,
                        matchType: 'exact_vector_id',
                        confidence: 1.0
                    });
                    used2.add(exactMatch.index);
                    exactMatches++;
                }
            }

            // 2. Если точных совпадений мало, ищем по геометрии
            if (exactMatches < Math.min(fp1.length, fp2.length) * 0.5) {
                const geometricMatches = this.findGeometricMatches(fp1, fp2, used2);
                matches.push(...geometricMatches);
            }

            const matchedPoints = matches.length;
            const maxPossible = Math.min(fp1.length, fp2.length);
            const similarity = maxPossible > 0 ? matchedPoints / maxPossible : 0;

            const isSame = similarity >= this.minSimilarity;
            const decision = isSame ? 'same' : 'different';

            if (this.debug) {
                console.log(`📊 РЕЗУЛЬТАТ:`);
                console.log(`   Всего совпадений: ${matchedPoints}/${maxPossible}`);
                console.log(`   Точные совпадения: ${exactMatches}`);
                console.log(`   Геометрические: ${matchedPoints - exactMatches}`);
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
                    exactMatches: exactMatches,
                    geometricMatches: matchedPoints - exactMatches,
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

    // 🔥 ПОИСК ГЕОМЕТРИЧЕСКИХ СОВПАДЕНИЙ
    findGeometricMatches(fp1, fp2, used2) {
        const geometricMatches = [];

        // Для каждой точки из первого следа ищем геометрически похожую во втором
        for (const point1 of fp1) {
            if (geometricMatches.length >= Math.min(fp1.length, fp2.length) * 0.8) break;

            let bestMatch = null;
            let bestSimilarity = 0;

            for (let i = 0; i < fp2.length; i++) {
                if (used2.has(i)) continue;

                const point2 = fp2[i];
               
                // 🔥 СРАВНИВАЕМ ПО ГЕОМЕТРИИ
                const similarity = this.compareByGeometry(point1, point2);
               
                if (similarity > bestSimilarity && similarity > 0.8) { // Высокий порог
                    bestSimilarity = similarity;
                    bestMatch = { point: point2, index: i, similarity: similarity };
                }
            }

            if (bestMatch) {
                geometricMatches.push({
                    point1: point1,
                    point2: bestMatch.point,
                    similarity: bestMatch.similarity,
                    matchType: 'geometry',
                    confidence: bestMatch.similarity
                });
                used2.add(bestMatch.index);
            }
        }

        return geometricMatches;
    }

    // 🔥 СРАВНЕНИЕ ПО ГЕОМЕТРИИ
    compareByGeometry(point1, point2) {
        // 1. Сравниваем положение относительно центра масс
        const distanceSim = this.compareDistance(point1, point2);
       
        // 2. Сравниваем соседей (если есть данные)
        const neighborSim = this.compareNeighbors(point1, point2);
       
        // 3. Сравниваем треугольники (если есть)
        const triangleSim = this.compareTriangles(point1.triangles || [], point2.triangles || []);
       
        // Общая схожесть
        return (distanceSim * 0.4 + neighborSim * 0.3 + triangleSim * 0.3);
    }

    // 🔥 СРАВНЕНИЕ РАССТОЯНИЙ
    compareDistance(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
       
        // Если точки очень близко (до 20px) - высокая схожесть
        if (distance < 20) return 1.0;
       
        // Если далеко (больше 100px) - низкая схожесть
        if (distance > 100) return 0.0;
       
        // Линейно уменьшаем схожесть
        return 1.0 - (distance / 100);
    }

    // 🔥 СРАВНЕНИЕ СОСЕДЕЙ
    compareNeighbors(point1, point2) {
        // Пока возвращаем базовую схожесть
        return 0.7;
    }

    // 🔥 СРАВНЕНИЕ ТРЕУГОЛЬНИКОВ
    compareTriangles(triangles1, triangles2) {
        if (triangles1.length === 0 || triangles2.length === 0) return 0.5;
       
        const hashes1 = new Set(triangles1.map(t => t.hash));
        const hashes2 = new Set(triangles2.map(t => t.hash));
       
        let common = 0;
        for (const hash of hashes1) {
            if (hashes2.has(hash)) common++;
        }
       
        return common / Math.max(hashes1.size, hashes2.size);
    }

    // ============================================
    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================

    findNearestNeighbors(centerPoint, centerIndex, allPoints, count) {
        const distances = [];

        for (let i = 0; i < allPoints.length; i++) {
            if (i === centerIndex) continue;

            const dx = allPoints[i].x - centerPoint.x;
            const dy = allPoints[i].y - centerPoint.y;
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
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    cosineLawAngle(side1, side2, opposite) {
        const cos = (side1 * side1 + side2 * side2 - opposite * opposite) / (2 * side1 * side2);
        const clamped = Math.max(-1, Math.min(1, cos));
        return Math.acos(clamped) * 180 / Math.PI;
    }

    createSimpleFootprint(points, name = '') {
        const footprint = [];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const vectorId = this.createSimpleVectorId(point, i, points);

            footprint.push({
                x: point.x,
                y: point.y,
                index: i,
                confidence: point.confidence || 0.5,
                vectorId: vectorId,
                geometricHash: vectorId,
                confirmedCount: 1
            });
        }

        return footprint;
    }

    createSimpleVectorId(point, index, allPoints) {
        const neighbors = this.findNearestNeighbors(point, index, allPoints, 3);
       
        let hash = `SIMPLE_${index}_`;
        neighbors.forEach((neighbor, idx) => {
            const dx = neighbor.x - point.x;
            const dy = neighbor.y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const normalizedAngle = ((angle % 360) + 360) % 360;
           
            const roundedDistance = Math.round(distance / 10) * 10;
            const roundedAngle = Math.round(normalizedAngle / 30) * 30;
           
            hash += `D${roundedDistance}_A${roundedAngle}_`;
        });

        return hash;
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
                exactMatches: 0,
                geometricMatches: 0,
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
