// modules/footprint/clean/vector-algorithm.js
// 🎯 МНОГОУРОВНЕВЫЕ ГЕОМЕТРИЧЕСКИЕ ХЭШИ

class VectorAlgorithm {
    constructor(options = {}) {
        this.neighborDepth = options.neighborDepth || 3; // Берем 3 уровня соседей
        this.angleTolerance = options.angleTolerance || 5;
        this.hashPrecision = options.hashPrecision || 2; // Более точное округление
        this.minSimilarity = options.minSimilarity || 0.6;
        this.debug = options.debug !== false;
    }

    // 🔥 СОЗДАНИЕ ВЕКТОРНОГО ОТПЕЧАТКА С МНОГОУРОВНЕВЫМИ ХЭШАМИ
    createFootprint(points, name = '') {
        console.log(`🎯 Создаю многоуровневый отпечаток "${name}" из ${points.length} точек`);

        if (points.length < 5) {
            console.log(`⚠️ Слишком мало точек для многоуровневого анализа: ${points.length}`);
            return this.createSimpleFootprint(points, name);
        }

        // 1. Центрируем и нормализуем масштаб
        const normalizedPoints = this.normalizeScale(points);

        // 2. Создаем многоуровневые геометрические хэши
        const vectorFootprint = [];

        for (let i = 0; i < normalizedPoints.length; i++) {
            const point = normalizedPoints[i];
           
            // 🔥 УРОВЕНЬ 1: Локальные треугольники (3 ближайших соседа)
            const triangles = this.createLocalTriangles(point, normalizedPoints, i);
           
            // 🔥 УРОВЕНЬ 2: Отношения между треугольниками
            const triangleRelations = this.analyzeTriangleRelations(triangles);
           
            // 🔥 УРОВЕНЬ 3: Структура соседей (2-й уровень)
            const neighborStructure = this.analyzeNeighborStructure(point, normalizedPoints, i);
           
            // 🔥 ФИНАЛЬНЫЙ МНОГОУРОВНЕВЫЙ ХЭШ
            const multiLevelHash = this.createMultiLevelHash(triangles, triangleRelations, neighborStructure);
           
            vectorFootprint.push({
                originalId: point.id || `pt_${i}`,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                index: i,
               
                // 🔥 МНОГОУРОВНЕВЫЕ ДАННЫЕ
                triangles: triangles,
                triangleRelations: triangleRelations,
                neighborStructure: neighborStructure,
               
                // 🔥 ХЭШИ
                vectorId: multiLevelHash,
                geometricHash: multiLevelHash,
                level1Hash: this.createLevel1Hash(triangles),
                level2Hash: this.createLevel2Hash(triangleRelations),
                level3Hash: this.createLevel3Hash(neighborStructure),
               
                confirmedCount: 1
            });
        }

        console.log(`✅ Создан многоуровневый отпечаток: ${vectorFootprint.length} точек`);
        console.log(`   Пример хэша: ${vectorFootprint[0]?.vectorId?.substring(0, 60)}...`);

        return vectorFootprint;
    }

    // 🔥 УРОВЕНЬ 1: Локальные треугольники
    createLocalTriangles(centerPoint, allPoints, centerIndex) {
        const triangles = [];
       
        // Находим 4 ближайших соседа
        const nearestNeighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, 4);
       
        if (nearestNeighbors.length < 3) return triangles;
       
        // Создаем треугольники со всеми комбинациями из 3 соседей
        for (let i = 0; i < nearestNeighbors.length - 2; i++) {
            for (let j = i + 1; j < nearestNeighbors.length - 1; j++) {
                for (let k = j + 1; k < nearestNeighbors.length; k++) {
                    const triangle = this.createGeometricTriangle(
                        centerPoint,
                        nearestNeighbors[i],
                        nearestNeighbors[j],
                        nearestNeighbors[k]
                    );
                   
                    if (triangle && this.isValidTriangle(triangle)) {
                        triangles.push(triangle);
                    }
                }
            }
        }
       
        return triangles.slice(0, 3); // Берем максимум 3 лучших треугольника
    }

    // 🔥 УРОВЕНЬ 2: Отношения между треугольниками
    analyzeTriangleRelations(triangles) {
        if (triangles.length < 2) return [];
       
        const relations = [];
       
        for (let i = 0; i < triangles.length - 1; i++) {
            for (let j = i + 1; j < triangles.length; j++) {
                const relation = this.compareTriangles(triangles[i], triangles[j]);
                if (relation) {
                    relations.push(relation);
                }
            }
        }
       
        return relations;
    }

    // 🔥 УРОВЕНЬ 3: Структура соседей (2-й уровень)
    analyzeNeighborStructure(centerPoint, allPoints, centerIndex) {
        const structure = {
            firstLevel: [],
            secondLevel: []
        };
       
        // Уровень 1: ближайшие соседи
        const firstLevel = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, 4);
        structure.firstLevel = firstLevel.map((neighbor, idx) => ({
            distance: Math.round(this.vectorDistance(centerPoint, neighbor)),
            angle: Math.round(Math.atan2(neighbor.y - centerPoint.y, neighbor.x - centerPoint.x) * 180 / Math.PI / 5) * 5,
            index: neighbor.index
        }));
       
        // Уровень 2: соседи соседей
        for (const neighbor of firstLevel) {
            const secondLevel = this.findNearestNeighbors(neighbor, allPoints, neighbor.index, 3);
           
            for (const secondNeighbor of secondLevel) {
                if (secondNeighbor.index !== centerIndex) {
                    structure.secondLevel.push({
                        viaNeighbor: neighbor.index,
                        distance: Math.round(this.vectorDistance(centerPoint, secondNeighbor)),
                        angle: Math.round(Math.atan2(secondNeighbor.y - centerPoint.y, secondNeighbor.x - centerPoint.x) * 180 / Math.PI / 5) * 5
                    });
                }
            }
        }
       
        return structure;
    }

    // 🔥 СОЗДАНИЕ МНОГОУРОВНЕВОГО ХЭША
    createMultiLevelHash(triangles, triangleRelations, neighborStructure) {
        const level1 = this.createLevel1Hash(triangles);
        const level2 = this.createLevel2Hash(triangleRelations);
        const level3 = this.createLevel3Hash(neighborStructure);
       
        // Комбинируем все уровни
        return `ML_${level1.substring(0, 20)}_${level2.substring(0, 15)}_${level3.substring(0, 15)}`;
    }

    createLevel1Hash(triangles) {
        if (triangles.length === 0) return "NO_TRI";
       
        const triangleHashes = triangles.map(t => t.hash || "").filter(h => h);
        triangleHashes.sort();
       
        return `L1_${triangleHashes.join('|').replace(/-/g, '_')}`;
    }

    createLevel2Hash(triangleRelations) {
        if (triangleRelations.length === 0) return "NO_REL";
       
        const relationHashes = triangleRelations.map(r => r.hash || "").filter(h => h);
        relationHashes.sort();
       
        return `L2_${relationHashes.join('|')}`;
    }

    createLevel3Hash(neighborStructure) {
        const firstLevelStr = neighborStructure.firstLevel.map(n =>
            `D${n.distance}A${n.angle}`
        ).join('');
       
        const secondLevelStr = neighborStructure.secondLevel.map(n =>
            `V${n.viaNeighbor}D${n.distance}A${n.angle}`
        ).join('');
       
        return `L3_${firstLevelStr.substring(0, 10)}_${secondLevelStr.substring(0, 10)}`;
    }

    // 🔥 ГЕОМЕТРИЧЕСКИЙ ТРЕУГОЛЬНИК
    createGeometricTriangle(p1, p2, p3, p4) {
        // Берем 3 точки для треугольника
        const points = [p2, p3, p4];
        const triangles = [];
       
        for (let i = 0; i < points.length - 2; i++) {
            for (let j = i + 1; j < points.length - 1; j++) {
                for (let k = j + 1; k < points.length; k++) {
                    const triangle = this.calculateTriangle(p1, points[i], points[j], points[k]);
                    if (triangle) triangles.push(triangle);
                }
            }
        }
       
        if (triangles.length === 0) return null;
       
        // Берем самый "равносторонний" треугольник
        triangles.sort((a, b) => {
            const aUniform = this.calculateUniformity(a.angles);
            const bUniform = this.calculateUniformity(b.angles);
            return bUniform - aUniform;
        });
       
        return triangles[0];
    }

    calculateTriangle(p1, p2, p3, p4) {
        const a = this.vectorDistance(p2, p3);
        const b = this.vectorDistance(p1, p3);
        const c = this.vectorDistance(p1, p2);
       
        const angleA = this.cosineLawAngle(b, c, a);
        const angleB = this.cosineLawAngle(a, c, b);
        const angleC = this.cosineLawAngle(a, b, c);
       
        const angles = [angleA, angleB, angleC].sort((x, y) => x - y);
       
        const rounded = angles.map(angle =>
            Math.round(angle / this.hashPrecision) * this.hashPrecision
        );
       
        return {
            angles: angles,
            roundedAngles: rounded,
            hash: rounded.join('-'),
            uniformity: this.calculateUniformity(angles)
        };
    }

    compareTriangles(t1, t2) {
        if (!t1 || !t2) return null;
       
        // Сравниваем углы
        const angleDiff = t1.roundedAngles.map((a, i) =>
            Math.abs(a - (t2.roundedAngles[i] || 0))
        ).reduce((sum, diff) => sum + diff, 0);
       
        const similarity = 1 - (angleDiff / (180 * 3));
       
        return {
            triangle1: t1.hash,
            triangle2: t2.hash,
            similarity: similarity,
            hash: `T${t1.hash.substring(0, 5)}_${t2.hash.substring(0, 5)}_S${Math.round(similarity * 100)}`
        };
    }

    // 🔥 СРАВНЕНИЕ ОТПЕЧАТКОВ
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        console.log(`\n🔍 МНОГОУРОВНЕВОЕ СРАВНЕНИЕ: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);

        if (fp1.length === 0 || fp2.length === 0) {
            return this.createEmptyComparisonResult();
        }

        try {
            // 🔥 МНОГОУРОВНЕВОЕ СРАВНЕНИЕ
            const matches = [];
           
            // Уровень 1: Точное совпадение многоуровневых хэшей
            for (const point1 of fp1) {
                for (const point2 of fp2) {
                    if (point1.vectorId && point2.vectorId && point1.vectorId === point2.vectorId) {
                        matches.push({
                            point1: point1,
                            point2: point2,
                            similarity: 1.0,
                            matchLevel: 'exact_multi_level',
                            confidence: 1.0
                        });
                        continue;
                    }
                   
                    // Уровень 2: Совпадение по level1Hash (локальные треугольники)
                    if (point1.level1Hash && point2.level1Hash && point1.level1Hash === point2.level1Hash) {
                        matches.push({
                            point1: point1,
                            point2: point2,
                            similarity: 0.9,
                            matchLevel: 'level1_triangles',
                            confidence: 0.9
                        });
                        continue;
                    }
                   
                    // Уровень 3: Частичное совпадение хэшей
                    if (point1.vectorId && point2.vectorId) {
                        const similarity = this.compareHashes(point1.vectorId, point2.vectorId);
                        if (similarity > 0.7) {
                            matches.push({
                                point1: point1,
                                point2: point2,
                                similarity: similarity,
                                matchLevel: 'partial_hash',
                                confidence: similarity
                            });
                        }
                    }
                }
            }
           
            // Вычисляем схожесть
            const matchedPoints = matches.length;
            const maxPossible = Math.min(fp1.length, fp2.length);
            const similarity = maxPossible > 0 ? matchedPoints / maxPossible : 0;
           
            const isSame = similarity >= this.minSimilarity;
            const decision = isSame ? 'same' : 'different';
           
            console.log(`📊 РЕЗУЛЬТАТ МНОГОУРОВНЕВОГО СРАВНЕНИЯ:`);
            console.log(`   Совпадения: ${matchedPoints}/${maxPossible}`);
            console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}% (порог: ${this.minSimilarity * 100}%)`);
            console.log(`   Решение: ${decision}`);
           
            if (matches.length > 0) {
                const matchLevels = {};
                matches.forEach(m => {
                    matchLevels[m.matchLevel] = (matchLevels[m.matchLevel] || 0) + 1;
                });
                console.log(`   Уровни совпадений:`, matchLevels);
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

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    normalizeScale(points) {
        if (points.length < 3) return points.map((p, idx) => ({ ...p, index: idx }));
       
        // Находим границы
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        points.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });
       
        const width = maxX - minX;
        const height = maxY - minY;
        const scale = 100 / Math.max(width, height); // Нормализуем к 100px
       
        return points.map((p, idx) => ({
            ...p,
            x: (p.x - minX) * scale,
            y: (p.y - minY) * scale,
            index: idx,
            originalX: p.x,
            originalY: p.y
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

    cosineLawAngle(side1, side2, opposite) {
        try {
            const cos = (side1 * side1 + side2 * side2 - opposite * opposite) / (2 * side1 * side2);
            const clamped = Math.max(-1, Math.min(1, cos));
            return Math.acos(clamped) * 180 / Math.PI;
        } catch (error) {
            return 60;
        }
    }

    calculateUniformity(angles) {
        if (angles.length < 3) return 0;
       
        const sum = angles.reduce((s, a) => s + a, 0);
        const avg = sum / angles.length;
       
        const variance = angles.reduce((v, a) => v + Math.pow(a - avg, 2), 0) / angles.length;
       
        // Максимальная равномерность: углы 60°, 60°, 60°
        const maxVariance = Math.pow(60, 2) * 3 / 3;
       
        return Math.max(0, 1 - (variance / maxVariance));
    }

    compareHashes(hash1, hash2) {
        if (!hash1 || !hash2) return 0;
       
        const minLength = Math.min(hash1.length, hash2.length);
        let commonChars = 0;
       
        for (let i = 0; i < Math.min(50, minLength); i++) {
            if (hash1[i] === hash2[i]) {
                commonChars++;
            }
        }
       
        return commonChars / Math.min(50, minLength);
    }

    isValidTriangle(triangle) {
        if (!triangle || !triangle.angles) return false;
       
        for (const angle of triangle.angles) {
            if (angle < 15 || angle > 165 || isNaN(angle)) {
                return false;
            }
        }
       
        return triangle.uniformity > 0.3;
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

    // 🔥 ПРОСТОЙ ВАРИАНТ ДЛЯ МАЛОГО КОЛИЧЕСТВА ТОЧЕК
    createSimpleFootprint(points, name = '') {
        const footprint = [];
       
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const simpleHash = `SIMPLE_X${Math.round(point.x/5)}_Y${Math.round(point.y/5)}_I${i}`;
           
            footprint.push({
                originalId: point.id || `pt_${i}`,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                vectorId: simpleHash,
                geometricHash: simpleHash,
                level1Hash: simpleHash,
                confirmedCount: 1
            });
        }
       
        return footprint;
    }
}

module.exports = VectorAlgorithm;
