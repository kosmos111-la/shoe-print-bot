// modules/footprint/clean/vector-algorithm.js
// 🎯 ВЕКТОРНЫЙ АЛГОРИТМ - ТОЛЬКО ГЕОМЕТРИЧЕСКИЕ ХЭШИ

class VectorAlgorithm {
    constructor(options = {}) {
        // 🔥 ПАРАМЕТРЫ
        this.neighborDepth = options.neighborDepth || 2;
        this.angleTolerance = options.angleTolerance || 10;
        this.hashPrecision = options.hashPrecision || 5;
        this.minSimilarity = options.minSimilarity || 0.6;
        this.minPointsForFootprint = options.minPointsForFootprint || 3;
        this.debug = options.debug !== false;
    }

    // 🔥 СОЗДАНИЕ ВЕКТОРНОГО ОТПЕЧАТКА
    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`🎯 Создаю векторный отпечаток "${name}" из ${points.length} точек`);
        }

        if (points.length < this.minPointsForFootprint) {
            if (this.debug) {
                console.log(`⚠️ Слишком мало точек: ${points.length}`);
            }
            return this.createSimpleFootprint(points, name);
        }

        // Центрируем точки
        const centeredPoints = this.centerPoints(points);

        // Создаем геометрические паспорта
        const vectorFootprint = [];

        for (let i = 0; i < centeredPoints.length; i++) {
            const point = centeredPoints[i];

            // 🔥 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЙ ХЭШ
            const vectorHash = this.createVectorHash(point, centeredPoints, i);

            vectorFootprint.push({
                originalId: point.id || `pt_${i}`,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                index: i,
               
                // 🔥 ГЕОМЕТРИЧЕСКИЙ ХЭШ
                vectorId: vectorHash,
                geometricHash: vectorHash,
               
                // Для совместимости
                confirmedCount: 1
            });
        }

        if (this.debug) {
            console.log(`✅ Создан векторный отпечаток: ${vectorFootprint.length} точек`);
            if (vectorFootprint.length > 0) {
                console.log(`   Пример vectorId: ${vectorFootprint[0].vectorId.substring(0, 40)}...`);
            }
        }

        return vectorFootprint;
    }

    // 🔥 СОЗДАНИЕ ВЕКТОРНОГО ХЭША
    createVectorHash(centerPoint, allPoints, centerIndex) {
        // Находим ближайших соседей
        const nearestNeighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, 4);
       
        if (nearestNeighbors.length < 2) {
            return `SIMPLE_${centerIndex}_NO_NEIGHBORS`;
        }
       
        // Создаем треугольники с соседями
        const triangleHashes = [];
       
        for (let i = 0; i < nearestNeighbors.length; i++) {
            for (let j = i + 1; j < nearestNeighbors.length; j++) {
                const triangle = this.createTriangle(
                    centerPoint,
                    nearestNeighbors[i],
                    nearestNeighbors[j]
                );
               
                if (triangle) {
                    triangleHashes.push(triangle.hash);
                }
            }
        }
       
        // Сортируем и объединяем хэши треугольников
        triangleHashes.sort();
        const trianglesHash = triangleHashes.length > 0 ?
            triangleHashes.join('|').substring(0, 100) : 'NO_TRI';
       
        // Создаем отношения с соседями
        const neighborRelations = [];
       
        for (const neighbor of nearestNeighbors) {
            const distance = this.vectorDistance(centerPoint, neighbor);
            const angle = Math.atan2(neighbor.y - centerPoint.y, neighbor.x - centerPoint.x);
           
            neighborRelations.push({
                distance: Math.round(distance / 5) * 5,
                angle: Math.round(angle * 180 / Math.PI / 5) * 5
            });
        }
       
        // Сортируем по расстоянию
        neighborRelations.sort((a, b) => a.distance - b.distance);
       
        const relationsHash = neighborRelations.map(r =>
            `D${r.distance}_A${r.angle}`
        ).join('|').substring(0, 80);
       
        // 🔥 ФИНАЛЬНЫЙ ВЕКТОРНЫЙ ХЭШ
        return `VEC_${trianglesHash}_REL_${relationsHash}`;
    }

    // 🔥 ПРОСТОЙ ВАРИАНТ
    createSimpleFootprint(points, name = '') {
        const footprint = [];
       
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // Простой хэш на основе координат
            const simpleHash = `SIMPLE_X${Math.round(point.x/10)}_Y${Math.round(point.y/10)}_I${i}`;
           
            footprint.push({
                originalId: point.id || `pt_${i}`,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                vectorId: simpleHash,
                geometricHash: simpleHash,
                confirmedCount: 1
            });
        }
       
        return footprint;
    }

    // 🔥 СОЗДАНИЕ ТРЕУГОЛЬНИКА
    createTriangle(p1, p2, p3) {
        try {
            // Вычисляем стороны
            const a = this.vectorDistance(p2, p3);
            const b = this.vectorDistance(p1, p3);
            const c = this.vectorDistance(p1, p2);
           
            // Вычисляем углы по теореме косинусов
            const angleA = this.cosineLawAngle(b, c, a);
            const angleB = this.cosineLawAngle(a, c, b);
            const angleC = this.cosineLawAngle(a, b, c);
           
            // Сортируем углы
            const angles = [angleA, angleB, angleC].sort((x, y) => x - y);
           
            // Округляем
            const rounded = angles.map(angle =>
                Math.round(angle / this.hashPrecision) * this.hashPrecision
            );
           
            return {
                angles: angles,
                hash: rounded.join('-')
            };
           
        } catch (error) {
            return null;
        }
    }

    // 🔥 СРАВНЕНИЕ ОТПЕЧАТКОВ
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        if (this.debug) {
            console.log(`\n🔍 ВЕКТОРНОЕ СРАВНЕНИЕ: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);
        }

        if (fp1.length === 0 || fp2.length === 0) {
            return this.createEmptyComparisonResult();
        }

        try {
            // 🔥 СРАВНИВАЕМ ПО ВЕКТОРНЫМ ХЭШАМ
            const matches = [];
           
            for (const point1 of fp1) {
                for (const point2 of fp2) {
                    if (point1.vectorId && point2.vectorId) {
                        // 🔥 ТОЧНОЕ СОВПАДЕНИЕ ХЭШЕЙ
                        if (point1.vectorId === point2.vectorId) {
                            matches.push({
                                point1: point1,
                                point2: point2,
                                similarity: 1.0,
                                matchLevel: 'exact_hash'
                            });
                            continue;
                        }
                       
                        // 🔥 ЧАСТИЧНОЕ СОВПАДЕНИЕ (по первым N символам)
                        const minLength = Math.min(point1.vectorId.length, point2.vectorId.length);
                        let commonChars = 0;
                       
                        for (let i = 0; i < Math.min(50, minLength); i++) {
                            if (point1.vectorId[i] === point2.vectorId[i]) {
                                commonChars++;
                            }
                        }
                       
                        const similarity = commonChars / Math.min(50, minLength);
                       
                        if (similarity > 0.8) {
                            matches.push({
                                point1: point1,
                                point2: point2,
                                similarity: similarity,
                                matchLevel: 'partial_hash'
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
           
            if (this.debug) {
                console.log(`📊 РЕЗУЛЬТАТ:`);
                console.log(`   Совпадения: ${matchedPoints}/${maxPossible}`);
                console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}%`);
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

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    centerPoints(points) {
        if (points.length === 0) return [];
       
        // Находим центр
        let sumX = 0, sumY = 0;
        points.forEach(p => {
            sumX += p.x;
            sumY += p.y;
        });
       
        const centerX = sumX / points.length;
        const centerY = sumY / points.length;
       
        // Центрируем
        return points.map((p, idx) => ({
            ...p,
            x: p.x - centerX,
            y: p.y - centerY,
            index: idx
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
}

module.exports = VectorAlgorithm;
