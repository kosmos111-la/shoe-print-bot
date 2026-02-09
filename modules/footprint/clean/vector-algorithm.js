// modules/footprint/clean/vector-algorithm.js
// 🎯 ИСПРАВЛЕННЫЙ ВЕКТОРНЫЙ АЛГОРИТМ

class VectorAlgorithm {
    constructor(options = {}) {
        this.neighborDepth = options.neighborDepth || 2;
        this.angleTolerance = options.angleTolerance || 5;
        this.hashPrecision = options.hashPrecision || 1; // Более точное округление
        this.minSimilarity = options.minSimilarity || 0.6;
        this.debug = options.debug !== false;
    }

    // 🔥 СОЗДАНИЕ ВЕКТОРНОГО ОТПЕЧАТКА
    createFootprint(points, name = '') {
        console.log(`🎯 Создаю отпечаток "${name}" из ${points.length} точек`);

        if (points.length < 5) {
            return this.createSimpleFootprint(points, name);
        }

        // 1. Нормализуем точки
        const normalizedPoints = this.normalizeAndCenter(points);

        // 2. Создаем геометрические хэши
        const vectorFootprint = [];

        for (let i = 0; i < normalizedPoints.length; i++) {
            const point = normalizedPoints[i];
           
            // 🔥 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЙ ХЭШ
            const geometricHash = this.createGeometricHash(point, normalizedPoints, i);
           
            vectorFootprint.push({
                originalId: point.id || `pt_${i}`,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                index: i,
               
                // 🔥 ГЕОМЕТРИЧЕСКИЙ ХЭШ
                vectorId: geometricHash,
                geometricHash: geometricHash,
               
                // Для отладки
                _originalX: point.originalX,
                _originalY: point.originalY,
               
                confirmedCount: 1
            });
        }

        console.log(`✅ Создан отпечаток: ${vectorFootprint.length} точек`);
        console.log(`   Пример хэша: ${vectorFootprint[0]?.vectorId?.substring(0, 40)}...`);

        return vectorFootprint;
    }

    // 🔥 СОЗДАНИЕ ГЕОМЕТРИЧЕСКОГО ХЭША
    createGeometricHash(centerPoint, allPoints, centerIndex) {
        try {
            // Находим 3 ближайших соседа
            const nearestNeighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, 3);
           
            if (nearestNeighbors.length < 2) {
                return `SIMPLE_${centerIndex}_N${nearestNeighbors.length}`;
            }
           
            // Создаем треугольники
            const triangleHashes = [];
           
            // Треугольник с 2 ближайшими соседями
            if (nearestNeighbors.length >= 2) {
                const triangle1 = this.calculateTriangle(
                    centerPoint,
                    nearestNeighbors[0],
                    nearestNeighbors[1]
                );
                if (triangle1 && this.isValidTriangle(triangle1)) {
                    triangleHashes.push(triangle1.hash);
                }
            }
           
            // Треугольник с 1 и 3 соседями
            if (nearestNeighbors.length >= 3) {
                const triangle2 = this.calculateTriangle(
                    centerPoint,
                    nearestNeighbors[0],
                    nearestNeighbors[2]
                );
                if (triangle2 && this.isValidTriangle(triangle2)) {
                    triangleHashes.push(triangle2.hash);
                }
            }
           
            // Создаем отношения с соседями
            const neighborRelations = [];
           
            for (const neighbor of nearestNeighbors) {
                const distance = this.vectorDistance(centerPoint, neighbor);
                const angle = Math.atan2(neighbor.y - centerPoint.y, neighbor.x - centerPoint.x) * 180 / Math.PI;
               
                neighborRelations.push({
                    distance: Math.round(distance),
                    angle: Math.round(angle / 5) * 5
                });
            }
           
            // Сортируем и создаем хэш
            neighborRelations.sort((a, b) => a.distance - b.distance);
           
            const relationsHash = neighborRelations.map(r =>
                `D${r.distance}_A${r.angle}`
            ).join('|');
           
            const trianglesHash = triangleHashes.length > 0 ?
                triangleHashes.join('_') : 'NO_TRI';
           
            // 🔥 ФИНАЛЬНЫЙ ХЭШ
            return `VEC_${trianglesHash.substring(0, 30)}_${relationsHash.substring(0, 40)}`;
           
        } catch (error) {
            console.log(`⚠️ Ошибка создания хэша: ${error.message}`);
            return `ERROR_${centerIndex}`;
        }
    }

    // 🔥 СРАВНЕНИЕ ОТПЕЧАТКОВ (ИСПРАВЛЕННОЕ)
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        console.log(`\n🔍 СРАВНЕНИЕ: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);

        if (fp1.length === 0 || fp2.length === 0) {
            return this.createEmptyComparisonResult();
        }

        try {
            // 🔥 ИСПРАВЛЕНИЕ: Используем Map для предотвращения множественных совпадений
            const matches = [];
            const usedPoints1 = new Set();
            const usedPoints2 = new Set();
           
            // 🔥 ПЕРВЫЙ ПРОХОД: Точные совпадения
            for (let i = 0; i < fp1.length; i++) {
                if (usedPoints1.has(i)) continue;
               
                const point1 = fp1[i];
                let bestMatch = null;
                let bestSimilarity = 0;
               
                for (let j = 0; j < fp2.length; j++) {
                    if (usedPoints2.has(j)) continue;
                   
                    const point2 = fp2[j];
                   
                    // Точное совпадение хэшей
                    if (point1.vectorId && point2.vectorId && point1.vectorId === point2.vectorId) {
                        bestMatch = { index: j, point: point2, similarity: 1.0 };
                        bestSimilarity = 1.0;
                        break; // Нашли точное совпадение, выходим
                    }
                   
                    // Частичное совпадение (первые 20 символов)
                    if (point1.vectorId && point2.vectorId) {
                        const minLen = Math.min(point1.vectorId.length, point2.vectorId.length);
                        const compareLen = Math.min(20, minLen);
                       
                        let common = 0;
                        for (let k = 0; k < compareLen; k++) {
                            if (point1.vectorId[k] === point2.vectorId[k]) common++;
                        }
                       
                        const similarity = common / compareLen;
                        if (similarity > 0.8 && similarity > bestSimilarity) {
                            bestSimilarity = similarity;
                            bestMatch = { index: j, point: point2, similarity: similarity };
                        }
                    }
                }
               
                if (bestMatch && bestSimilarity > 0.8) {
                    matches.push({
                        point1: point1,
                        point2: bestMatch.point,
                        similarity: bestSimilarity,
                        matchLevel: bestSimilarity === 1.0 ? 'exact' : 'partial'
                    });
                   
                    usedPoints1.add(i);
                    usedPoints2.add(bestMatch.index);
                }
            }
           
            // 🔥 ВТОРОЙ ПРОХОД: Совпадение по координатам (близкие точки)
            const coordinateMatches = [];
           
            for (let i = 0; i < fp1.length; i++) {
                if (usedPoints1.has(i)) continue;
               
                const point1 = fp1[i];
                let bestDistance = Infinity;
                let bestPoint2 = null;
               
                for (let j = 0; j < fp2.length; j++) {
                    if (usedPoints2.has(j)) continue;
                   
                    const point2 = fp2[j];
                    const distance = this.vectorDistance(point1, point2);
                   
                    if (distance < bestDistance && distance < 30) { // 30px порог
                        bestDistance = distance;
                        bestPoint2 = point2;
                    }
                }
               
                if (bestPoint2) {
                    const similarity = Math.max(0, 1 - (bestDistance / 50));
                    coordinateMatches.push({
                        point1: point1,
                        point2: bestPoint2,
                        similarity: similarity,
                        matchLevel: 'coordinate'
                    });
                   
                    usedPoints1.add(i);
                    // Не отмечаем usedPoints2, чтобы одна точка могла быть близка к нескольким
                }
            }
           
            // Добавляем координатные совпадения (ограничиваем количество)
            const maxCoordinateMatches = Math.min(10, coordinateMatches.length);
            for (let i = 0; i < maxCoordinateMatches; i++) {
                matches.push(coordinateMatches[i]);
            }
           
            // 🔥 ИСПРАВЛЕНИЕ: Правильный расчет процентов
            const matchedPoints = matches.length;
            const similarity = matchedPoints / Math.min(fp1.length, fp2.length);
           
            // 🔥 ДЕБАГ ИНФОРМАЦИЯ
            const exactMatches = matches.filter(m => m.matchLevel === 'exact').length;
            const partialMatches = matches.filter(m => m.matchLevel === 'partial').length;
            const coordMatches = matches.filter(m => m.matchLevel === 'coordinate').length;
           
            console.log(`📊 РЕЗУЛЬТАТ СРАВНЕНИЯ:`);
            console.log(`   Точные совпадения: ${exactMatches}`);
            console.log(`   Частичные совпадения: ${partialMatches}`);
            console.log(`   Совпадения по координатам: ${coordMatches}`);
            console.log(`   Всего совпадений: ${matchedPoints}/${Math.min(fp1.length, fp2.length)}`);
            console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}% (порог: ${this.minSimilarity * 100}%)`);
           
            const isSame = similarity >= this.minSimilarity;
            const decision = isSame ? 'same' : 'different';
            console.log(`   Решение: ${decision}`);
           
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
                    partialMatches: partialMatches,
                    coordinateMatches: coordMatches,
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
    normalizeAndCenter(points) {
        if (points.length < 3) return points.map((p, idx) => ({ ...p, index: idx }));
       
        // Центрируем
        let sumX = 0, sumY = 0;
        points.forEach(p => {
            sumX += p.x;
            sumY += p.y;
        });
       
        const centerX = sumX / points.length;
        const centerY = sumY / points.length;
       
        // Находим максимальное расстояние от центра
        let maxDistance = 0;
        points.forEach(p => {
            const distance = Math.sqrt(
                Math.pow(p.x - centerX, 2) +
                Math.pow(p.y - centerY, 2)
            );
            maxDistance = Math.max(maxDistance, distance);
        });
       
        // Нормализуем к радиусу 100
        const scale = maxDistance > 0 ? 100 / maxDistance : 1;
       
        return points.map((p, idx) => ({
            ...p,
            originalX: p.x,
            originalY: p.y,
            x: (p.x - centerX) * scale,
            y: (p.y - centerY) * scale,
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

    calculateTriangle(p1, p2, p3) {
        try {
            const a = this.vectorDistance(p2, p3);
            const b = this.vectorDistance(p1, p3);
            const c = this.vectorDistance(p1, p2);
           
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
                roundedAngles: rounded,
                hash: rounded.join('-')
            };
           
        } catch (error) {
            return null;
        }
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

    isValidTriangle(triangle) {
        if (!triangle || !triangle.angles) return false;
       
        // Проверяем углы
        for (const angle of triangle.angles) {
            if (angle < 20 || angle > 160 || isNaN(angle)) {
                return false;
            }
        }
       
        // Проверяем что не все углы одинаковые (слишком равносторонний)
        const [a1, a2, a3] = triangle.angles;
        if (Math.abs(a1 - a2) < 5 && Math.abs(a2 - a3) < 5) {
            return false; // Слишком равносторонний
        }
       
        return true;
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
}

module.exports = VectorAlgorithm;
