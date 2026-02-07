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
       
        this.debug = options.debug !== false;
    }

    // ============================================
    // 🎯 СОЗДАНИЕ ВЕКТОРНОГО ОТПЕЧАТКА
    // ============================================
   
    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`🎯 Создаю векторный отпечаток "${name}" из ${points.length} точек`);
        }
       
        if (points.length < 3) {
            console.log(`⚠️ Слишком мало точек для векторного анализа: ${points.length}`);
            return [];
        }
       
        // 1. Нормализуем точки (центрируем, но НЕ масштабируем!)
        const normalizedPoints = this.normalizeToVectorSpace(points);
       
        // 2. Создаем геометрические паспорта для каждой точки
        const vectorFootprint = [];
       
        for (let i = 0; i < normalizedPoints.length; i++) {
            const point = normalizedPoints[i];
           
            // 🔥 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЙ ПАСПОРТ
            const passport = this.createGeometricPassport(point, normalizedPoints, i);
           
            if (passport && passport.triangles.length > 0) {
                vectorFootprint.push({
                    // 🔥 ВЕКТОРНЫЙ ИДЕНТИФИКАТОР (на основе геометрии!)
                    vectorId: passport.vectorId,
                    originalId: point.originalId || passport.vectorId,
                   
                    // Координаты (для справки)
                    x: point.x,
                    y: point.y,
                    index: i,
                   
                    // ГЕОМЕТРИЧЕСКИЙ ПАСПОРТ
                    passport: passport,
                   
                    // Уровни геометрической информации
                    level1: passport.triangles,           // Локальные треугольники
                    level2: passport.neighborRelations,   // Отношения с соседями
                    level3: passport.structuralRole,      // Структурная роль
                   
                    // Для отладки
                    debug: {
                        triangleCount: passport.triangles.length,
                        neighborCount: passport.neighborRelations.length,
                        structuralRole: passport.structuralRole
                    }
                });
            }
        }
       
        if (this.debug) {
            console.log(`✅ Создан векторный отпечаток: ${vectorFootprint.length} точек`);
            if (vectorFootprint.length > 0) {
                const firstPoint = vectorFootprint[0];
                console.log(`   Пример векторного ID: ${firstPoint.vectorId}`);
                console.log(`   Треугольников: ${firstPoint.passport.triangles.length}`);
                console.log(`   Структурная роль: ${firstPoint.passport.structuralRole}`);
            }
        }
       
        return vectorFootprint;
    }
   
    // ============================================
    // 🏗️ СОЗДАНИЕ ГЕОМЕТРИЧЕСКОГО ПАСПОРТА
    // ============================================
   
    createGeometricPassport(centerPoint, allPoints, centerIndex) {
        // 🔥 УРОВЕНЬ 1: Локальные треугольники
        const triangles = this.createLocalTriangles(centerPoint, allPoints, centerIndex);
       
        if (triangles.length === 0) return null;
       
        // 🔥 УРОВЕНЬ 2: Отношения с соседями
        const neighborRelations = this.analyzeNeighborRelations(centerPoint, allPoints, centerIndex);
       
        // 🔥 УРОВЕНЬ 3: Структурная роль
        const structuralRole = this.determineStructuralRole(centerPoint, allPoints, centerIndex, triangles, neighborRelations);
       
        // 🔥 СОЗДАЕМ ВЕКТОРНЫЙ ID (геометрическая сигнатура)
        const vectorId = this.createVectorId(triangles, neighborRelations, structuralRole);
       
        return {
            vectorId: vectorId,
            triangles: triangles,
            neighborRelations: neighborRelations,
            structuralRole: structuralRole,
            geometricSignature: this.createGeometricSignature(triangles, neighborRelations)
        };
    }
   
    // ============================================
    // 📐 УРОВЕНЬ 1: ЛОКАЛЬНЫЕ ТРЕУГОЛЬНИКИ
    // ============================================
   
    createLocalTriangles(centerPoint, allPoints, centerIndex) {
        const triangles = [];
       
        // Находим ближайших соседей (по расстоянию, не по индексам!)
        const nearestNeighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, 6);
       
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
           
            // Относительные расстояния (нормализованные)
            const distances = [
                this.vectorDistance(p1, p2),
                this.vectorDistance(p1, p3),
                this.vectorDistance(p2, p3)
            ];
            const maxDist = Math.max(...distances);
            const normalizedDistances = distances.map(d => d / maxDist);
           
            return {
                angles: angles,
                normalizedAngles: sorted,
                roundedAngles: rounded,
                normalizedDistances: normalizedDistances,
                hash: rounded.join('-'),
                distanceHash: normalizedDistances.map(d => Math.round(d * 100)).join('-'),
                geometricHash: `${rounded.join('-')}_${normalizedDistances.map(d => Math.round(d * 100)).join('-')}`
            };
        } catch (error) {
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
        // Находим общих соседей
        const commonNeighbors = this.findCommonNeighbors(pointA, pointB, allPoints);
       
        if (commonNeighbors.length === 0) return null;
       
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
    }
   
    // ============================================
    // 🏛️ УРОВЕНЬ 3: СТРУКТУРНАЯ РОЛЬ
    // ============================================
   
    determineStructuralRole(centerPoint, allPoints, centerIndex, triangles, neighborRelations) {
        // Анализируем положение точки в структуре
       
        // 1. Центральность (сколько треугольников проходит через точку)
        const centrality = triangles.length;
       
        // 2. Плотность соседей
        const neighborDensity = neighborRelations.length > 0 ?
            neighborRelations.reduce((sum, r) => sum + r.commonNeighbors, 0) / neighborRelations.length : 0;
       
        // 3. Распределение расстояний до соседей
        const distances = neighborRelations.map(r => r.distance);
        const avgDistance = distances.length > 0 ?
            distances.reduce((sum, d) => sum + d, 0) / distances.length : 0;
        const distanceVariance = distances.length > 0 ?
            distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length : 0;
       
        // Определяем роль на основе параметров
        let role = 'standard';
       
        if (centrality > 8 && neighborDensity > 2) {
            role = 'hub'; // Центральная точка, много связей
        } else if (centrality < 3 && neighborDensity < 1) {
            role = 'peripheral'; // Периферийная точка
        } else if (distanceVariance > avgDistance * 0.5) {
            role = 'connector'; // Соединяет разные группы
        } else if (triangles.some(t => t.angles.some(a => a < 30 || a > 150))) {
            role = 'boundary'; // На границе (острые/тупые углы)
        }
       
        return {
            type: role,
            centrality: centrality,
            neighborDensity: neighborDensity,
            avgDistance: avgDistance,
            distanceVariance: distanceVariance,
            roleHash: `${role}_C${centrality}_D${Math.round(neighborDensity)}`
        };
    }
   
    // ============================================
    // 🆔 СОЗДАНИЕ ВЕКТОРНЫХ ИДЕНТИФИКАТОРОВ
    // ============================================
   
    createVectorId(triangles, neighborRelations, structuralRole) {
        // Собираем геометрические признаки
       
        // 1. Хеши треугольников (отсортированные)
        const triangleHashes = triangles.map(t => t.hash).sort();
        const triangleHash = triangleHashes.length > 0 ?
            triangleHashes.map(h => h.split('-').map(a => Math.round(parseInt(a)/5)*5).join('-')).join('|') : 'NO_TRI';
       
        // 2. Хеши отношений с соседями
        const relationHashes = neighborRelations.map(r => r.relationHash).sort();
        const relationHash = relationHashes.length > 0 ? relationHashes.join('|') : 'NO_REL';
       
        // 3. Структурная роль
        const roleHash = structuralRole.roleHash;
       
        // 🔥 ГЕОМЕТРИЧЕСКИЙ ВЕКТОРНЫЙ ID
        return `VEC_T${triangleHash.substring(0, 20)}_R${relationHash.substring(0, 15)}_S${roleHash}`;
    }
   
    createGeometricSignature(triangles, neighborRelations) {
        // Компактная сигнатура для быстрого сравнения
       
        // Средние углы треугольников
        const avgAngles = triangles.length > 0 ?
            [0, 0, 0].map((_, idx) =>
                triangles.reduce((sum, t) => sum + t.normalizedAngles[idx], 0) / triangles.length
            ) : [0, 0, 0];
       
        // Среднее количество общих соседей
        const avgCommonNeighbors = neighborRelations.length > 0 ?
            neighborRelations.reduce((sum, r) => sum + r.commonNeighbors, 0) / neighborRelations.length : 0;
       
        return `A${avgAngles.map(a => Math.round(a)).join('-')}_C${Math.round(avgCommonNeighbors)}`;
    }
   
    // ============================================
    // 🔄 СРАВНЕНИЕ ВЕКТОРНЫХ ОТПЕЧАТКОВ
    // ============================================
   
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        if (this.debug) {
            console.log(`\n🔍 ВЕКТОРНОЕ СРАВНЕНИЕ: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);
        }
       
        if (fp1.length < 3 || fp2.length < 3) {
            return {
                similarity: 0,
                decision: 'different',
                matches: []
            };
        }
       
        // 🔥 МНОГОУРОВНЕВОЕ СРАВНЕНИЕ
        const level1Matches = this.compareLevel1(fp1, fp2); // Треугольники
        const level2Matches = this.compareLevel2(fp1, fp2); // Отношения с соседями
        const level3Matches = this.compareLevel3(fp1, fp2); // Структурные роли
       
        // 🔥 КОМБИНИРУЕМ РЕЗУЛЬТАТЫ
        const combinedMatches = this.combineMatches(level1Matches, level2Matches, level3Matches);
        const matchedPoints = combinedMatches.length;
       
        // Вычисляем схожесть
        const maxPossible = Math.min(fp1.length, fp2.length);
        const similarity = maxPossible > 0 ? matchedPoints / maxPossible : 0;
       
        const decision = similarity >= this.minSimilarity ? 'same' : 'different';
       
        if (this.debug) {
            console.log(`📊 РЕЗУЛЬТАТ:`);
            console.log(`   Уровень 1 (треугольники): ${level1Matches.length} совпадений`);
            console.log(`   Уровень 2 (отношения): ${level2Matches.length} совпадений`);
            console.log(`   Уровень 3 (структура): ${level3Matches.length} совпадений`);
            console.log(`   Общих совпадений: ${matchedPoints}`);
            console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}%`);
            console.log(`   Решение: ${decision} (порог: ${this.minSimilarity * 100}%)`);
           
            if (combinedMatches.length > 0) {
                console.log(`\n🔬 ПРИМЕРЫ СОВПАДЕНИЙ:`);
                combinedMatches.slice(0, 3).forEach((match, idx) => {
                    console.log(`   ${idx + 1}. ${match.point1.vectorId.substring(0, 30)}...`);
                    console.log(`      → ${match.point2.vectorId.substring(0, 30)}...`);
                    console.log(`      Уровень: ${match.matchLevel}, уверенность: ${match.confidence.toFixed(2)}`);
                });
            }
        }
       
        return {
            similarity: similarity,
            decision: decision,
            matches: combinedMatches,
            stats: {
                level1Matches: level1Matches.length,
                level2Matches: level2Matches.length,
                level3Matches: level3Matches.length,
                totalMatches: matchedPoints,
                similarity: similarity
            }
        };
    }
   
    compareLevel1(fp1, fp2) {
        // Сравнение по треугольникам
        const matches = [];
       
        for (const point1 of fp1) {
            for (const point2 of fp2) {
                const similarity = this.compareTriangles(
                    point1.passport.triangles,
                    point2.passport.triangles
                );
               
                if (similarity > 0.8) { // Высокий порог для точных совпадений
                    matches.push({
                        point1: point1,
                        point2: point2,
                        similarity: similarity,
                        matchLevel: 'level1',
                        confidence: similarity
                    });
                }
            }
        }
       
        return matches;
    }
   
    compareLevel2(fp1, fp2) {
        // Сравнение по отношениям с соседями
        const matches = [];
       
        for (const point1 of fp1) {
            for (const point2 of fp2) {
                const similarity = this.compareNeighborRelations(
                    point1.passport.neighborRelations,
                    point2.passport.neighborRelations
                );
               
                if (similarity > 0.6) {
                    matches.push({
                        point1: point1,
                        point2: point2,
                        similarity: similarity,
                        matchLevel: 'level2',
                        confidence: similarity * 0.8
                    });
                }
            }
        }
       
        return matches;
    }
   
    compareLevel3(fp1, fp2) {
        // Сравнение по структурным ролям
        const matches = [];
       
        for (const point1 of fp1) {
            for (const point2 of fp2) {
                const similarity = this.compareStructuralRoles(
                    point1.passport.structuralRole,
                    point2.passport.structuralRole
                );
               
                if (similarity > 0.5) {
                    matches.push({
                        point1: point1,
                        point2: point2,
                        similarity: similarity,
                        matchLevel: 'level3',
                        confidence: similarity * 0.6
                    });
                }
            }
        }
       
        return matches;
    }
   
    combineMatches(level1, level2, level3) {
        // Объединяем совпадения, отдавая приоритет более высоким уровням
        const combined = [];
        const used1 = new Set();
        const used2 = new Set();
       
        // Сначала берем совпадения уровня 1
        for (const match of level1) {
            if (!used1.has(match.point1.vectorId) && !used2.has(match.point2.vectorId)) {
                combined.push(match);
                used1.add(match.point1.vectorId);
                used2.add(match.point2.vectorId);
            }
        }
       
        // Затем уровень 2
        for (const match of level2) {
            if (!used1.has(match.point1.vectorId) && !used2.has(match.point2.vectorId)) {
                combined.push(match);
                used1.add(match.point1.vectorId);
                used2.add(match.point2.vectorId);
            }
        }
       
        // Затем уровень 3
        for (const match of level3) {
            if (!used1.has(match.point1.vectorId) && !used2.has(match.point2.vectorId)) {
                combined.push(match);
                used1.add(match.point1.vectorId);
                used2.add(match.point2.vectorId);
            }
        }
       
        return combined;
    }
   
    // ============================================
    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================
   
    normalizeToVectorSpace(points) {
        // Центрируем, но НЕ масштабируем (сохраняем относительные расстояния!)
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
            originalId: p.originalId || `pt_${idx}`,
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
   
    findCommonNeighbors(pointA, pointB, allPoints) {
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
   
    calculateAngleBetweenVectors(v1, v2) {
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
       
        if (mag1 === 0 || mag2 === 0) return 0;
       
        const cos = dot / (mag1 * mag2);
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
       
        // Сравниваем геометрические хеши
        const hashes1 = new Set(triangles1.map(t => t.geometricHash));
        const hashes2 = new Set(triangles2.map(t => t.geometricHash));
       
        let common = 0;
        for (const hash1 of hashes1) {
            if (hashes2.has(hash1)) {
                common++;
            }
        }
       
        return common / Math.min(triangles1.length, triangles2.length);
    }
   
    compareNeighborRelations(relations1, relations2) {
        if (relations1.length === 0 || relations2.length === 0) return 0;
       
        // Сравниваем хеши отношений
        const hashes1 = new Set(relations1.map(r => r.relationHash));
        const hashes2 = new Set(relations2.map(r => r.relationHash));
       
        let common = 0;
        for (const hash1 of hashes1) {
            if (hashes2.has(hash1)) {
                common++;
            }
        }
       
        return common / Math.min(relations1.length, relations2.length);
    }
   
    compareStructuralRoles(role1, role2) {
        if (role1.type === role2.type) {
            // Если роли одинаковые, сравниваем детали
            const centralityDiff = Math.abs(role1.centrality - role2.centrality) / Math.max(role1.centrality, role2.centrality);
            const densityDiff = Math.abs(role1.neighborDensity - role2.neighborDensity) / Math.max(role1.neighborDensity, role2.neighborDensity);
           
            return Math.max(0, 1 - (centralityDiff + densityDiff) / 2);
        }
       
        return 0;
    }
   
    // ============================================
    // 🎯 МЕТОД ДЛЯ МЕНЕДЖЕРА
    // ============================================
   
    comparePoints(points1, points2, name1 = 'След 1', name2 = 'След 2') {
        const fp1 = this.createFootprint(points1, name1);
        const fp2 = this.createFootprint(points2, name2);
       
        return this.compareFootprints(fp1, fp2, name1, name2);
    }
}

module.exports = VectorAlgorithm;
