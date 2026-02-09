// modules/footprint/clean/vector-algorithm.js
// 🎯 ВЕКТОРНЫЙ АЛГОРИТМ - ГЕОМЕТРИЧЕСКИЕ ИНВАРИАНТЫ

const crypto = require('crypto');

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
            return this.createSimpleFootprint(points, name);
        }

        // 🔥 НОРМАЛИЗУЕМ ТОЧКИ С СОХРАНЕНИЕМ ОТНОСИТЕЛЬНЫХ РАССТОЯНИЙ
        const normalizedPoints = this.normalizeWithStructure(points);
       
        // 🔥 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЕ ПАСПОРТА
        const vectorFootprint = [];

        for (let i = 0; i < normalizedPoints.length; i++) {
            const point = normalizedPoints[i];

            // 🔥 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЙ ПАСПОРТ
            const passport = this.createGeometricPassport(point, normalizedPoints, i);

            if (passport) {
                vectorFootprint.push({
                    // 🔥 ВЕКТОРНЫЙ ИДЕНТИФИКАТОР (уникальный для геометрии точки)
                    vectorId: passport.vectorId,
                    geometricHash: passport.vectorId, // 🔥 ОДИН И ТОТ ЖЕ ДЛЯ ОДИНАКОВЫХ ФИЗИЧЕСКИХ ТОЧЕК!
                    originalId: point.originalId || passport.vectorId,

                    // Координаты оригинальные
                    originalX: point.originalX || point.x,
                    originalY: point.originalY || point.y,
                    x: point.x,
                    y: point.y,
                    index: i,

                    // ГЕОМЕТРИЧЕСКИЙ ПАСПОРТ
                    passport: passport,

                    // Для совместимости
                    triangleHashes: (passport.triangles || []).map(t => t.hash || ''),
                    triangles: passport.triangles || [],
                    confirmedCount: 1,
                    confirmedBy: ['vector_initial'],
                   
                    // 🔥 ДОПОЛНИТЕЛЬНЫЕ ДАННЫЕ ДЛЯ АККУМУЛЯТОРА
                    confidence: point.confidence || 0.5
                });
            }
        }

        if (this.debug) {
            console.log(`✅ Создан векторный отпечаток: ${vectorFootprint.length} точек`);
            if (vectorFootprint.length > 0) {
                console.log(`   Пример хеша: ${vectorFootprint[0].geometricHash.substring(0, 40)}...`);
            }
        }

        return vectorFootprint;
    }

    // 🔥 НОРМАЛИЗАЦИЯ С СОХРАНЕНИЕМ СТРУКТУРЫ
    normalizeWithStructure(points) {
        if (points.length < 3) {
            return points.map((p, idx) => ({
                ...p,
                originalX: p.x,
                originalY: p.y,
                originalId: p.id || `pt_${idx}`
            }));
        }

        // 1. Центрируем
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        // 2. Вычисляем масштаб (среднее расстояние от центра)
        const distances = points.map(p =>
            Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2))
        );
        const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        const scale = avgDistance > 0 ? 100 / avgDistance : 1; // Приводим к 100px радиусу

        // 3. Нормализуем
        return points.map((p, idx) => ({
            x: (p.x - centerX) * scale,
            y: (p.y - centerY) * scale,
            originalX: p.x,
            originalY: p.y,
            originalId: p.id || `pt_${idx}`,
            confidence: p.confidence || 0.5,
            index: idx
        }));
    }

    // 🔥 ПРОСТОЙ ВАРИАНТ ДЛЯ МАЛОГО КОЛИЧЕСТВА ТОЧЕК
    createSimpleFootprint(points, name = '') {
        const footprint = [];
      
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // 🔥 ГЕОМЕТРИЧЕСКИЙ ХЕШ НА ОСНОВЕ ПОЛОЖЕНИЯ В СТРУКТУРЕ
            const neighbors = this.getStructuralNeighbors(points, i);
            const vectorId = this.createStructuralHash(point, neighbors, i, points);
          
            footprint.push({
                vectorId: vectorId,
                geometricHash: vectorId, // 🔥 ТОТ ЖЕ ХЕШ!
                originalId: point.id || `pt_${i}`,
                originalX: point.x,
                originalY: point.y,
                x: point.x,
                y: point.y,
                index: i,
                triangleHashes: [],
                triangles: [],
                confirmedCount: 1,
                confirmedBy: ['simple_initial'],
                confidence: point.confidence || 0.5
            });
        }
      
        if (this.debug) {
            console.log(`📊 Создан простой отпечаток: ${footprint.length} точек`);
        }
      
        return footprint;
    }

    // 🔥 ПОЛУЧИТЬ СТРУКТУРНЫХ СОСЕДЕЙ
    getStructuralNeighbors(points, centerIndex) {
        const neighbors = [];
        const center = points[centerIndex];
       
        // Находим ближайших соседей
        const distances = [];
        for (let i = 0; i < points.length; i++) {
            if (i === centerIndex) continue;
            const dx = points[i].x - center.x;
            const dy = points[i].y - center.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            distances.push({ index: i, distance, dx, dy });
        }
       
        // Сортируем по расстоянию
        distances.sort((a, b) => a.distance - b.distance);
       
        // Берем 4 ближайших
        return distances.slice(0, 4).map(d => ({
            index: d.index,
            distance: d.distance,
            dx: d.dx,
            dy: d.dy,
            angle: Math.atan2(d.dy, d.dx) * 180 / Math.PI
        }));
    }

    // 🔥 СОЗДАТЬ СТРУКТУРНЫЙ ХЕШ
    createStructuralHash(center, neighbors, centerIndex, allPoints) {
        if (neighbors.length === 0) {
            // Изолированная точка
            return `ISO_${centerIndex}_X${Math.round(center.x/10)}_Y${Math.round(center.y/10)}`;
        }
       
        // Создаем дескриптор на основе геометрии соседей
        let hash = `C${centerIndex}_N${neighbors.length}_`;
       
        // Добавляем информацию о распределении соседей
        const angles = neighbors.map(n => Math.round(n.angle / 15) * 15); // Группируем по 15°
        const distances = neighbors.map(n => Math.round(n.distance / 20)); // Группируем по 20px
       
        // Сортируем углы
        angles.sort((a, b) => a - b);
       
        hash += `A${angles.join('-')}_`;
        hash += `D${distances.join('-')}_`;
       
        // Добавляем информацию о форме (минимальный охватывающий угол)
        if (angles.length >= 2) {
            const maxAngleGap = this.calculateMaxAngleGap(angles);
            hash += `G${maxAngleGap}_`;
        }
       
        return `STRUCT_${hash}`;
    }

    // 🔥 ВЫЧИСЛИТЬ МАКСИМАЛЬНЫЙ УГЛОВОЙ ПРОМЕЖУТОК
    calculateMaxAngleGap(angles) {
        let maxGap = 0;
        const sorted = [...angles].sort((a, b) => a - b);
       
        for (let i = 0; i < sorted.length; i++) {
            const next = (i + 1) % sorted.length;
            let gap = sorted[next] - sorted[i];
            if (gap < 0) gap += 360;
            if (gap > maxGap) maxGap = gap;
        }
       
        return Math.round(maxGap / 30) * 30; // Группируем по 30°
    }

    // ============================================
    // 🏗️ СОЗДАНИЕ ГЕОМЕТРИЧЕСКОГО ПАСПОРТА
    // ============================================

    createGeometricPassport(centerPoint, allPoints, centerIndex) {
        // 🔥 УРОВЕНЬ 1: Локальные треугольники
        const triangles = this.createLocalTriangles(centerPoint, allPoints, centerIndex);

        if (triangles.length === 0) {
            // Если не удалось создать треугольники, создаем структурный паспорт
            return this.createStructuralPassport(centerPoint, allPoints, centerIndex);
        }

        // 🔥 УРОВЕНЬ 2: Отношения с соседями
        const neighborRelations = this.analyzeNeighborRelations(centerPoint, allPoints, centerIndex);

        // 🔥 СОЗДАЕМ ВЕКТОРНЫЙ ID
        const vectorId = this.createVectorId(triangles, neighborRelations);

        return {
            vectorId: vectorId,
            triangles: triangles,
            neighborRelations: neighborRelations,
            geometricSignature: this.createGeometricSignature(triangles, neighborRelations)
        };
    }

    createStructuralPassport(centerPoint, allPoints, centerIndex) {
        const neighbors = this.getStructuralNeighbors(
            allPoints.map(p => ({ x: p.x, y: p.y })),
            centerIndex
        );
       
        const vectorId = this.createStructuralHash(
            centerPoint,
            neighbors,
            centerIndex,
            allPoints
        );
      
        return {
            vectorId: vectorId,
            triangles: [],
            neighborRelations: [],
            geometricSignature: `STRUCT_${centerIndex}`
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

            // 🔥 УСТОЙЧИВЫЙ ХЕШ ТРЕУГОЛЬНИКА
            const triangleHash = rounded.join('-');
            const geometricHash = `TRI_${triangleHash}`;

            return {
                angles: angles,
                normalizedAngles: sorted,
                roundedAngles: rounded,
                hash: triangleHash,
                geometricHash: geometricHash
            };
        } catch (error) {
            if (this.debug) console.log(`⚠️ Ошибка создания треугольника: ${error.message}`);
            return null;
        }
    }

    // ============================================
    // 🔗 УРОВЕНЬ 2: ОТНОШЕНИЯ С СОСЕДЯМИ
    // ============================================

    analyzeNeighborRelations(centerPoint, allPoints, centerIndex) {
        const relations = [];
        const nearestNeighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, 4);

        for (const neighbor of nearestNeighbors) {
            const relation = this.analyzeSingleRelation(centerPoint, neighbor, allPoints);
            if (relation) {
                relations.push(relation);
            }
        }

        return relations;
    }

    analyzeSingleRelation(pointA, pointB, allPoints) {
        try {
            // Находим общих соседей
            const commonNeighbors = this.findCommonNeighbors(pointA, pointB, allPoints);

            // Анализируем геометрические отношения
            const distance = this.vectorDistance(pointA, pointB);
            const anglesWithCommon = [];

            for (const common of commonNeighbors) {
                const angle = this.calculateAngleBetweenVectors(
                    { x: pointB.x - pointA.x, y: pointB.y - pointA.y },
                    { x: common.x - pointA.x, y: common.y - pointA.y }
                );
                anglesWithCommon.push(angle);
            }

            // Средний угол с общими соседями
            const avgAngle = anglesWithCommon.length > 0 ?
                anglesWithCommon.reduce((sum, a) => sum + a, 0) / anglesWithCommon.length : 0;

            return {
                neighborIndex: pointB.index,
                distance: distance,
                commonNeighbors: commonNeighbors.length,
                avgAngleWithCommon: avgAngle,
                relationHash: `D${Math.round(distance/10)}_C${commonNeighbors.length}_A${Math.round(avgAngle/5)*5}`
            };
        } catch (error) {
            if (this.debug) console.log(`⚠️ Ошибка анализа отношения: ${error.message}`);
            return null;
        }
    }

    findCommonNeighbors(pointA, pointB, allPoints) {
        try {
            const neighborsA = this.findNearestNeighbors(pointA, allPoints, pointA.index, 5);
            const neighborsB = this.findNearestNeighbors(pointB, allPoints, pointB.index, 5);

            const common = [];
            const neighborSetB = new Set(neighborsB.map(n => n.index));

            for (const neighborA of neighborsA) {
                if (neighborSetB.has(neighborA.index) &&
                    neighborA.index !== pointA.index &&
                    neighborA.index !== pointB.index) {
                    common.push(neighborA);
                }
            }

            return common;
        } catch (error) {
            return [];
        }
    }

    // ============================================
    // 🆔 СОЗДАНИЕ ВЕКТОРНЫХ ИДЕНТИФИКАТОРОВ
    // ============================================

    createVectorId(triangles, neighborRelations) {
        try {
            // Собираем геометрические признаки

            // 1. Хеши треугольников (отсортированные)
            const triangleHashes = triangles.map(t => t.geometricHash || t.hash || '')
                .filter(h => h)
                .sort();
           
            const triangleHash = triangleHashes.length > 0 ?
                triangleHashes.map(h => h.split('-').slice(0, 2).join('-')).join('|') : 'NO_TRI';

            // 2. Хеши отношений с соседями
            const relationHashes = neighborRelations.map(r => r.relationHash || '')
                .filter(h => h)
                .sort();
           
            const relationHash = relationHashes.length > 0 ?
                relationHashes.slice(0, 3).join('|') : 'NO_REL';

            // 🔥 ГЕОМЕТРИЧЕСКИЙ ВЕКТОРНЫЙ ID (стабильный!)
            const combinedHash = `VEC_${triangleHash.substring(0, 30)}_${relationHash.substring(0, 20)}`;
           
            // Создаем MD5 хеш для гарантированной уникальности и стабильности
            const md5Hash = crypto.createHash('md5').update(combinedHash).digest('hex');
           
            return `GEO_${md5Hash.substring(0, 16)}`;
           
        } catch (error) {
            return `ERR_${Date.now()}`;
        }
    }

    createGeometricSignature(triangles, neighborRelations) {
        try {
            // Средние углы треугольников
            const avgAngles = triangles.length > 0 ?
                [0, 0, 0].map((_, idx) =>
                    triangles.reduce((sum, t) => sum + (t.normalizedAngles?.[idx] || 0), 0) / triangles.length
                ) : [0, 0, 0];

            // Среднее количество общих соседей
            const avgCommonNeighbors = neighborRelations.length > 0 ?
                neighborRelations.reduce((sum, r) => sum + (r.commonNeighbors || 0), 0) / neighborRelations.length : 0;

            return `A${avgAngles.map(a => Math.round(a)).join('-')}_C${Math.round(avgCommonNeighbors)}`;
        } catch (error) {
            return 'ERROR_SIG';
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
            if (this.debug) console.log('⚠️ Один из отпечатков пуст');
            return this.createEmptyComparisonResult();
        }

        try {
            // 🔥 СРАВНЕНИЕ ПО ГЕОМЕТРИЧЕСКИМ ХЕШАМ
            const matches = [];
            const hashMap2 = new Map();

            // Индексируем второй отпечаток по геометрическим хешам
            for (const point2 of fp2) {
                if (point2.geometricHash) {
                    if (!hashMap2.has(point2.geometricHash)) {
                        hashMap2.set(point2.geometricHash, []);
                    }
                    hashMap2.get(point2.geometricHash).push(point2);
                }
            }

            // Ищем совпадения
            for (const point1 of fp1) {
                if (!point1.geometricHash) continue;

                const matchingPoints2 = hashMap2.get(point1.geometricHash) || [];

                for (const point2 of matchingPoints2) {
                    // ТОЧНОЕ СОВПАДЕНИЕ ГЕОМЕТРИЧЕСКОГО ХЕША!
                    matches.push({
                        point1: point1,
                        point2: point2,
                        similarity: 1.0,
                        matchLevel: 'exact_geometric_hash',
                        confidence: 1.0,
                        geometricHash: point1.geometricHash
                    });
                    break; // Первое совпадение достаточно
                }
            }

            // Вычисляем схожесть
            const matchedPoints = matches.length;
            const maxPossible = Math.min(fp1.length, fp2.length);
            const similarity = maxPossible > 0 ? matchedPoints / maxPossible : 0;

            const isSame = similarity >= this.minSimilarity;
            const decision = isSame ? 'same' : 'different';

            const result = this.createComparisonResult(fp1, fp2, matches, similarity, isSame, decision);
          
            if (this.debug) {
                console.log(`📊 РЕЗУЛЬТАТ:`);
                console.log(`   Совпадения: ${matchedPoints}/${maxPossible}`);
                console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}% (порог: ${this.minSimilarity * 100}%)`);
                console.log(`   Решение: ${decision}`);
            }

            return result;

        } catch (error) {
            console.error(`❌ Ошибка сравнения: ${error.message}`);
            return this.createEmptyComparisonResult();
        }
    }

    createEmptyComparisonResult() {
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

    createComparisonResult(fp1, fp2, matches, similarity, isSame, decision) {
        const matchedPoints = matches.length;
        const percent1to2 = fp1.length > 0 ? (matchedPoints / fp1.length * 100).toFixed(1) : '0.0';
        const percent2to1 = fp2.length > 0 ? (matchedPoints / fp2.length * 100).toFixed(1) : '0.0';

        const avgSimilarity = matches.length > 0 ?
            (matches.reduce((sum, m) => sum + (m.similarity || 0), 0) / matches.length).toFixed(3) : 0;

        return {
            similar: isSame,
            similarity: similarity,
            decision: decision,
            matches: matches,
            stats: {
                totalPoints1: fp1.length,
                totalPoints2: fp2.length,
                matchedPoints: matchedPoints,
                percent1to2: percent1to2,
                percent2to1: percent2to1,
                avgSimilarity: parseFloat(avgSimilarity),
                similarity: similarity,
                geometricMatches: matchedPoints
            }
        };
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

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    findNearestNeighbors(centerPoint, allPoints, centerIndex, count) {
        try {
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
        } catch (error) {
            return [];
        }
    }

    vectorDistance(p1, p2) {
        try {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            return Math.sqrt(dx * dx + dy * dy);
        } catch (error) {
            return 9999;
        }
    }

    calculateVectorAngles(p1, p2, p3) {
        try {
            const a = this.vectorDistance(p2, p3);
            const b = this.vectorDistance(p1, p3);
            const c = this.vectorDistance(p1, p2);

            const angleA = this.cosineLawAngle(b, c, a);
            const angleB = this.cosineLawAngle(a, c, b);
            const angleC = this.cosineLawAngle(a, b, c);

            return [angleA, angleB, angleC];
        } catch (error) {
            return [60, 60, 60]; // Равносторонний треугольник по умолчанию
        }
    }

    cosineLawAngle(side1, side2, opposite) {
        try {
            const cos = (side1 * side1 + side2 * side2 - opposite * opposite) / (2 * side1 * side2);
            const clamped = Math.max(-1, Math.min(1, cos));
            return Math.acos(clamped) * 180 / Math.PI;
        } catch (error) {
            return 60;
        }
    }

    normalizeAngles(angles) {
        try {
            const sum = angles.reduce((s, a) => s + a, 0);
            if (sum === 0) return angles;
            return angles.map(a => a * 180 / sum);
        } catch (error) {
            return angles;
        }
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

    calculateAngleBetweenVectors(v1, v2) {
        try {
            const dot = v1.x * v2.x + v1.y * v2.y;
            const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
            const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

            if (mag1 === 0 || mag2 === 0) return 0;

            const cos = dot / (mag1 * mag2);
            const clamped = Math.max(-1, Math.min(1, cos));
            return Math.acos(clamped) * 180 / Math.PI;
        } catch (error) {
            return 0;
        }
    }

    // 🔥 МЕТОД ДЛЯ ПОЛУЧЕНИЯ СТАТИСТИКИ
    getStats() {
        return {
            algorithm: 'vector_algorithm',
            minSimilarity: this.minSimilarity,
            neighborDepth: this.neighborDepth,
            debug: this.debug
        };
    }
}

module.exports = VectorAlgorithm;
