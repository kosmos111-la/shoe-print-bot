// modules/footprint/clean/vector-algorithm.js
// 🎯 ВЕКТОРНЫЙ АЛГОРИТМ - ГЕОМЕТРИЧЕСКИЕ ИНВАРИАНТЫ

console.log('🎯 ВЕКТОРНЫЙ АЛГОРИТМ - МАТЕМАТИЧЕСКАЯ КАРТА ОТНОШЕНИЙ\n');

class VectorAlgorithm {
    constructor(options = {}) {
        // 🔥 КЛЮЧЕВЫЕ ПАРАМЕТРЫ
        this.neighborDepth = options.neighborDepth || 2;    // Глубина анализа соседей
        this.angleTolerance = options.angleTolerance || 10; // Допуск по углам (градусы)
        this.hashPrecision = options.hashPrecision || 5;    // Округление углов
        this.minSimilarity = options.minSimilarity || 0.6;  // Минимальная схожесть
        this.structuralLevels = 3; // Уровни сравнения
        this.minPointsForFootprint = options.minPointsForFootprint || 3; // Минимум точек
        this.debug = options.debug !== false;
    }

    // ============================================
    // 🎯 СОЗДАНИЕ ВЕКТОРНОГО ОТПЕЧАТКА
    // ============================================

    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`🎯 Создаю векторный отпечаток "${name}" из ${points.length} точек`);
        }

        if (points.length < this.minPointsForFootprint) {
            if (this.debug) {
                console.log(`⚠️ Слишком мало точек для векторного анализа: ${points.length}`);
            }
            // 🔥 ИСПРАВЛЕНИЕ: возвращаем простые дескрипторы вместо пустого массива
            return this.createSimpleFootprint(points, name);
        }

        // 1. Нормализуем точки (центрируем, но НЕ масштабируем!)
        const normalizedPoints = this.normalizeToVectorSpace(points);

        // 2. Создаем геометрические паспорта для каждой точки
        const vectorFootprint = [];

        for (let i = 0; i < normalizedPoints.length; i++) {
            const point = normalizedPoints[i];

            // 🔥 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЙ ПАСПОРТ
            const passport = this.createGeometricPassport(point, normalizedPoints, i);

            if (passport) {
                vectorFootprint.push({
                    // 🔥 ВЕКТОРНЫЙ ИДЕНТИФИКАТОР
                    vectorId: passport.vectorId,
                    originalId: point.originalId || passport.vectorId,

                    // Координаты
                    x: point.x,
                    y: point.y,
                    index: i,

                    // ГЕОМЕТРИЧЕСКИЙ ПАСПОРТ
                    passport: passport,

                    // Уровни геометрической информации
                    level1: passport.triangles || [],
                    level2: passport.neighborRelations || [],
                    level3: passport.structuralRole || {},

                    // Для совместимости с геометрическим алгоритмом
                    geometricHash: passport.vectorId,
                    triangleHashes: (passport.triangles || []).map(t => t.hash || ''),
                    triangles: passport.triangles || [],
                    confirmedCount: 1,
                    confirmedBy: ['vector_initial']
                });
            }
        }

        if (this.debug) {
            console.log(`✅ Создан векторный отпечаток: ${vectorFootprint.length} точек`);
            if (vectorFootprint.length > 0) {
                console.log(`   Первый векторный ID: ${vectorFootprint[0].vectorId.substring(0, 30)}...`);
            }
        }

        return vectorFootprint;
    }

    // 🔥 ПРОСТОЙ ВАРИАНТ ДЛЯ МАЛОГО КОЛИЧЕСТВА ТОЧЕК
    createSimpleFootprint(points, name = '') {
        const footprint = [];
       
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const vectorId = this.createSimpleVectorId(point, i, points);
           
            footprint.push({
                vectorId: vectorId,
                originalId: point.id || `pt_${i}`,
                x: point.x,
                y: point.y,
                index: i,
                geometricHash: vectorId,
                triangleHashes: [],
                triangles: [],
                confirmedCount: 1,
                confirmedBy: ['simple_initial']
            });
        }
       
        if (this.debug) {
            console.log(`📊 Создан простой отпечаток: ${footprint.length} точек`);
        }
       
        return footprint;
    }

    createSimpleVectorId(point, index, allPoints) {
        // Простой ID на основе координат и положения
        const relativeCoords = allPoints.map(p => ({
            dx: p.x - point.x,
            dy: p.y - point.y
        }));
       
        // Сортируем по расстоянию
        relativeCoords.sort((a, b) => {
            const distA = Math.sqrt(a.dx*a.dx + a.dy*a.dy);
            const distB = Math.sqrt(b.dx*b.dx + b.dy*b.dy);
            return distA - distB;
        });
       
        // Берем ближайшие 3 точки
        const nearest = relativeCoords.slice(1, 4); // пропускаем себя
       
        let hash = '';
        nearest.forEach((coord, idx) => {
            const angle = Math.atan2(coord.dy, coord.dx) * 180 / Math.PI;
            const distance = Math.sqrt(coord.dx*coord.dx + coord.dy*coord.dy);
            hash += `A${Math.round(angle/5)*5}_D${Math.round(distance/10)}_`;
        });
       
        return `SIMPLE_${hash}`;
    }

    // ============================================
    // 🏗️ СОЗДАНИЕ ГЕОМЕТРИЧЕСКОГО ПАСПОРТА
    // ============================================

    createGeometricPassport(centerPoint, allPoints, centerIndex) {
        // 🔥 УРОВЕНЬ 1: Локальные треугольники
        const triangles = this.createLocalTriangles(centerPoint, allPoints, centerIndex);

        if (triangles.length === 0) {
            // Если не удалось создать треугольники, создаем простой паспорт
            return this.createSimplePassport(centerPoint, allPoints, centerIndex);
        }

        // 🔥 УРОВЕНЬ 2: Отношения с соседями
        const neighborRelations = this.analyzeNeighborRelations(centerPoint, allPoints, centerIndex);

        // 🔥 УРОВЕНЬ 3: Структурная роль
        const structuralRole = this.determineStructuralRole(centerPoint, allPoints, centerIndex, triangles, neighborRelations);

        // 🔥 СОЗДАЕМ ВЕКТОРНЫЙ ID
        const vectorId = this.createVectorId(triangles, neighborRelations, structuralRole);

        return {
            vectorId: vectorId,
            triangles: triangles,
            neighborRelations: neighborRelations,
            structuralRole: structuralRole,
            geometricSignature: this.createGeometricSignature(triangles, neighborRelations)
        };
    }

    createSimplePassport(centerPoint, allPoints, centerIndex) {
        // Простой паспорт для точек без треугольников
        const nearest = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, 2);
       
        const vectorId = `SIMPLE_${centerIndex}_`;
        if (nearest.length > 0) {
            nearest.forEach((neighbor, idx) => {
                const dx = neighbor.x - centerPoint.x;
                const dy = neighbor.y - centerPoint.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                vectorId += `N${idx}_D${Math.round(distance)}_A${Math.round(angle)}_`;
            });
        }
       
        return {
            vectorId: vectorId,
            triangles: [],
            neighborRelations: [],
            structuralRole: {
                type: 'simple',
                centrality: 0,
                neighborDensity: nearest.length,
                avgDistance: 0,
                distanceVariance: 0,
                roleHash: 'simple'
            }
        };
    }

    // ============================================
    // 📐 УРОВЕНЬ 1: ЛОКАЛЬНЫЕ ТРЕУГОЛЬНИКИ
    // ============================================

    createLocalTriangles(centerPoint, allPoints, centerIndex) {
        const triangles = [];

        // Находим ближайших соседей
        const nearestNeighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, 4);

        if (nearestNeighbors.length < 2) return triangles;

        // Создаем треугольники со всеми парами соседей
        for (let i = 0; i < nearestNeighbors.length; i++) {
            for (let j = i + 1; j < nearestNeighbors.length; j++) {
                const triangle = this.createVectorTriangle(
                    centerPoint,
                    nearestNeighbors[i],
                    nearestNeighbors[j]
                );

                if (triangle && this.isValidTriangle(triangle)) {
                    triangles.push(triangle);
                }
            }
        }

        return triangles;
    }

    createVectorTriangle(p1, p2, p3) {
        try {
            // Вычисляем углы
            const angles = this.calculateVectorAngles(p1, p2, p3);

            // Нормализуем и сортируем
            const normalized = this.normalizeAngles(angles);
            const sorted = normalized.sort((a, b) => a - b);

            // Округляем для устойчивости
            const rounded = sorted.map(angle =>
                Math.round(angle / this.hashPrecision) * this.hashPrecision
            );

            return {
                angles: angles,
                normalizedAngles: sorted,
                roundedAngles: rounded,
                hash: rounded.join('-'),
                geometricHash: rounded.join('-')
            };
        } catch (error) {
            if (this.debug) console.log(`⚠️ Ошибка создания треугольника: ${error.message}`);
            return null;
        }
    }

    // ============================================
    // 🔄 СРАВНЕНИЕ ВЕКТОРНЫХ ОТПЕЧАТКОВ
    // ============================================

    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        if (this.debug) {
            console.log(`\n🔍 ВЕКТОРНОЕ СРАВНЕНИЕ: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);
        }

        if (fp1.length === 0 || fp2.length === 0) {
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                matches: [],
                stats: {
                    level1Matches: 0,
                    level2Matches: 0,
                    level3Matches: 0,
                    totalMatches: 0,
                    percent1to2: '0.0',
                    percent2to1: '0.0',
                    avgSimilarity: 0
                }
            };
        }

        try {
            // 🔥 МНОГОУРОВНЕВОЕ СРАВНЕНИЕ
            const level1Matches = this.compareLevel1(fp1, fp2);
            const level2Matches = this.compareLevel2(fp1, fp2);
            const level3Matches = this.compareLevel3(fp1, fp2);

            // 🔥 КОМБИНИРУЕМ РЕЗУЛЬТАТЫ
            const combinedMatches = this.combineMatches(level1Matches, level2Matches, level3Matches);
            const matchedPoints = combinedMatches.length;

            // Вычисляем схожесть
            const maxPossible = Math.min(fp1.length, fp2.length);
            const similarity = maxPossible > 0 ? matchedPoints / maxPossible : 0;

            const isSame = similarity >= this.minSimilarity;
            const decision = isSame ? 'same' : 'different';

            // Статистика для совместимости
            const percent1to2 = fp1.length > 0 ? (matchedPoints / fp1.length * 100).toFixed(1) : '0.0';
            const percent2to1 = fp2.length > 0 ? (matchedPoints / fp2.length * 100).toFixed(1) : '0.0';

            const avgSimilarity = combinedMatches.length > 0 ?
                (combinedMatches.reduce((sum, m) => sum + (m.similarity || 0), 0) / combinedMatches.length).toFixed(3) : 0;

            if (this.debug) {
                console.log(`📊 РЕЗУЛЬТАТ:`);
                console.log(`   Уровень 1: ${level1Matches.length} совпадений`);
                console.log(`   Уровень 2: ${level2Matches.length} совпадений`);
                console.log(`   Уровень 3: ${level3Matches.length} совпадений`);
                console.log(`   Общих совпадений: ${matchedPoints}`);
                console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}% (порог: ${this.minSimilarity * 100}%)`);
                console.log(`   Решение: ${decision}`);
            }

            return {
                similar: isSame,
                similarity: similarity,
                decision: decision,
                matches: combinedMatches,
                stats: {
                    level1Matches: level1Matches.length,
                    level2Matches: level2Matches.length,
                    level3Matches: level3Matches.length,
                    totalMatches: matchedPoints,
                    percent1to2: percent1to2,
                    percent2to1: percent2to1,
                    avgSimilarity: parseFloat(avgSimilarity),
                    similarity: similarity
                }
            };

        } catch (error) {
            console.error(`❌ Ошибка сравнения: ${error.message}`);
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                matches: [],
                stats: {
                    level1Matches: 0,
                    level2Matches: 0,
                    level3Matches: 0,
                    totalMatches: 0,
                    percent1to2: '0.0',
                    percent2to1: '0.0',
                    avgSimilarity: 0
                }
            };
        }
    }

    compareLevel1(fp1, fp2) {
        const matches = [];

        for (const point1 of fp1) {
            for (const point2 of fp2) {
                // Проверяем по векторному ID
                if (point1.vectorId && point2.vectorId &&
                    point1.vectorId === point2.vectorId) {
                    matches.push({
                        point1: point1,
                        point2: point2,
                        similarity: 1.0,
                        matchLevel: 'level1_exact',
                        confidence: 1.0
                    });
                    continue;
                }

                // Проверяем по геометрическому хешу
                if (point1.geometricHash && point2.geometricHash &&
                    point1.geometricHash === point2.geometricHash) {
                    matches.push({
                        point1: point1,
                        point2: point2,
                        similarity: 1.0,
                        matchLevel: 'level1_hash',
                        confidence: 0.9
                    });
                    continue;
                }

                // Сравниваем треугольники если есть
                if (point1.triangles && point1.triangles.length > 0 &&
                    point2.triangles && point2.triangles.length > 0) {
                   
                    const similarity = this.compareTriangles(point1.triangles, point2.triangles);
                    if (similarity > 0.8) {
                        matches.push({
                            point1: point1,
                            point2: point2,
                            similarity: similarity,
                            matchLevel: 'level1_triangles',
                            confidence: similarity
                        });
                    }
                }
            }
        }

        return matches;
    }

    compareLevel2(fp1, fp2) {
        const matches = [];

        for (const point1 of fp1) {
            for (const point2 of fp2) {
                // Пропускаем если уже совпали на уровне 1
                const alreadyMatched = matches.some(m =>
                    m.point1 === point1 || m.point2 === point2);
                if (alreadyMatched) continue;

                // Сравниваем по координатам (упрощенное сравнение)
                const dx = point1.x - point2.x;
                const dy = point1.y - point2.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
               
                if (distance < 50) { // 50px порог
                    const similarity = Math.max(0, 1 - distance / 100);
                    matches.push({
                        point1: point1,
                        point2: point2,
                        similarity: similarity,
                        matchLevel: 'level2_distance',
                        confidence: similarity * 0.7
                    });
                }
            }
        }

        return matches;
    }

    compareLevel3(fp1, fp2) {
        const matches = [];

        // Простое сравнение по индексам если мало совпадений
        if (fp1.length === fp2.length && fp1.length < 10) {
            for (let i = 0; i < Math.min(fp1.length, fp2.length); i++) {
                const point1 = fp1[i];
                const point2 = fp2[i];
               
                const alreadyMatched = matches.some(m =>
                    m.point1 === point1 || m.point2 === point2);
                if (!alreadyMatched) {
                    matches.push({
                        point1: point1,
                        point2: point2,
                        similarity: 0.5,
                        matchLevel: 'level3_index',
                        confidence: 0.5
                    });
                }
            }
        }

        return matches;
    }

    combineMatches(level1, level2, level3) {
        const combined = [];
        const used1 = new Set();
        const used2 = new Set();

        // Сначала берем точные совпадения
        for (const match of level1) {
            if (!used1.has(match.point1) && !used2.has(match.point2)) {
                combined.push(match);
                used1.add(match.point1);
                used2.add(match.point2);
            }
        }

        // Затем совпадения по расстоянию
        for (const match of level2) {
            if (!used1.has(match.point1) && !used2.has(match.point2)) {
                combined.push(match);
                used1.add(match.point1);
                used2.add(match.point2);
            }
        }

        // Затем по индексам
        for (const match of level3) {
            if (!used1.has(match.point1) && !used2.has(match.point2)) {
                combined.push(match);
                used1.add(match.point1);
                used2.add(match.point2);
            }
        }

        return combined;
    }

    // 🔥 МЕТОД ДЛЯ СОВМЕСТИМОСТИ С SIMPLE-MANAGER
    comparePoints(points1, points2, name1 = 'След 1', name2 = 'След 2') {
        const fp1 = this.createFootprint(points1, name1);
        const fp2 = this.createFootprint(points2, name2);

        return this.compareFootprints(fp1, fp2, name1, name2);
    }

    // 🔥 МЕТОД ДЛЯ ОБНОВЛЕНИЯ ПОДТВЕРЖДЕНИЙ
    updatePointConfirmations(points1, points2, matches) {
        if (!matches || matches.length === 0) return 0;
       
        let updated = 0;
       
        matches.forEach(match => {
            if (match.point1 && match.point2) {
                // Обновляем confirmedCount если есть
                if (match.point1.confirmedCount !== undefined) {
                    match.point1.confirmedCount = (match.point1.confirmedCount || 1) + 1;
                    updated++;
                }
                if (match.point2.confirmedCount !== undefined) {
                    match.point2.confirmedCount = (match.point2.confirmedCount || 1) + 1;
                    updated++;
                }
            }
        });
       
        return updated;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (остальные из оригинального файла)
    // ... остальные методы остаются без изменений ...

    normalizeToVectorSpace(points) {
        // Центрируем
        const center = { x: 0, y: 0 };
        points.forEach(p => {
            center.x += p.x;
            center.y += p.y;
        });
        center.x /= points.length;
        center.y /= points.length;

        return points.map((p, idx) => ({
            x: p.x - center.x,
            y: p.y - center.y,
            index: idx,
            originalId: p.id || `pt_${idx}`,
            confidence: p.confidence || 0.5
        }));
    }

    findNearestNeighbors(centerPoint, allPoints, centerIndex, count) {
        const distances = [];

        for (let i = 0; i < allPoints.length; i++) {
            if (i === centerIndex) continue;

            const distance = this.vectorDistance(centerPoint, allPoints[i]);
            distances.push({
                point: allPoints[i],
                distance: distance,
                index: i
            });
        }

        distances.sort((a, b) => a.distance - b.distance);
        return distances.slice(0, count).map(d => d.point);
    }

    vectorDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    calculateVectorAngles(p1, p2, p3) {
        const a = this.vectorDistance(p2, p3);
        const b = this.vectorDistance(p1, p3);
        const c = this.vectorDistance(p1, p2);

        const angleA = this.cosineLawAngle(b, c, a);
        const angleB = this.cosineLawAngle(a, c, b);
        const angleC = this.cosineLawAngle(a, b, c);

        return [angleA, angleB, angleC];
    }

    cosineLawAngle(side1, side2, opposite) {
        const cos = (side1 * side1 + side2 * side2 - opposite * opposite) / (2 * side1 * side2);
        const clamped = Math.max(-1, Math.min(1, cos));
        return Math.acos(clamped) * 180 / Math.PI;
    }

    normalizeAngles(angles) {
        const sum = angles.reduce((s, a) => s + a, 0);
        if (sum === 0) return angles;
        return angles.map(a => a * 180 / sum);
    }

    isValidTriangle(triangle) {
        if (!triangle || !triangle.angles) return false;

        for (const angle of triangle.angles) {
            if (angle < 10 || angle > 170 || isNaN(angle)) {
                return false;
            }
        }

        return true;
    }

    compareTriangles(triangles1, triangles2) {
        if (triangles1.length === 0 || triangles2.length === 0) return 0;

        const hashes1 = new Set(triangles1.map(t => t.geometricHash || t.hash));
        const hashes2 = new Set(triangles2.map(t => t.geometricHash || t.hash));

        let common = 0;
        for (const hash1 of hashes1) {
            if (hashes2.has(hash1)) {
                common++;
            }
        }

        return common / Math.min(triangles1.length, triangles2.length);
    }
}

module.exports = VectorAlgorithm;
