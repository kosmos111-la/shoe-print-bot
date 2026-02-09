// modules/footprint/clean/vector-algorithm.js
// 🎯 УПРОЩЕННЫЙ ВЕКТОРНЫЙ АЛГОРИТМ С ГЕОМЕТРИЧЕСКИМИ ПАСПОРТАМИ

console.log('🎯 УПРОЩЕННЫЙ ВЕКТОРНЫЙ АЛГОРИТМ С ПАСПОРТАМИ\n');

class VectorAlgorithm {
    constructor(options = {}) {
        // 🔥 ОСНОВНЫЕ ПАРАМЕТРЫ
        this.neighborCount = options.neighborCount || 4;       // 4 ближайших соседа
        this.minSimilarity = options.minSimilarity || 0.6;     // 60% порог
        this.debug = options.debug !== false;

        console.log(`🎯 Параметры: ${this.neighborCount} соседей, порог ${this.minSimilarity * 100}%`);
    }

    // ============================================
    // 🎯 СОЗДАНИЕ УПРОЩЕННОГО ВЕКТОРНОГО ОТПЕЧАТКА
    // ============================================

    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`🎯 Создаю упрощенный отпечаток "${name}" из ${points.length} точек`);
        }

        const vectorFootprint = [];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // 🔥 СОЗДАЕМ УПРОЩЕННЫЙ ПАСПОРТ
            const passport = this.createSimplePassport(point, points, i);
           
            vectorFootprint.push({
                originalId: point.id || `pt_${i}`,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                index: i,
               
                // 🔥 УПРОЩЕННЫЙ ПАСПОРТ
                vectorId: passport.vectorId,
                geometricHash: passport.vectorId,
               
                // Для сравнения
                distances: passport.distances,
                angles: passport.angles,
               
                confirmedCount: 1
            });
        }

        if (this.debug && vectorFootprint.length > 0) {
            console.log(`✅ Создано ${vectorFootprint.length} упрощенных паспортов`);
            const sample = vectorFootprint[0];
            console.log(`   Пример паспорта: ${sample.vectorId.substring(0, 50)}...`);
        }

        return vectorFootprint;
    }

    // 🔥 СОЗДАНИЕ УПРОЩЕННОГО ПАСПОРТА
    createSimplePassport(centerPoint, allPoints, centerIndex) {
        // Находим ближайших соседей
        const neighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, this.neighborCount);
       
        if (neighbors.length === 0) {
            return {
                vectorId: `ISOLATED_${centerIndex}`,
                distances: [],
                angles: []
            };
        }

        // Создаем векторный ID на основе расстояний и углов
        let vectorId = `PASSPORT_${centerIndex}_N${neighbors.length}_`;
        const distances = [];
        const angles = [];

        neighbors.forEach((neighbor, idx) => {
            const dx = neighbor.x - centerPoint.x;
            const dy = neighbor.y - centerPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const normalizedAngle = ((angle % 360) + 360) % 360;
           
            // Округляем для устойчивости
            const roundedDistance = Math.round(distance / 5) * 5; // до 5px
            const roundedAngle = Math.round(normalizedAngle / 15) * 15; // до 15°
           
            vectorId += `D${roundedDistance}_A${roundedAngle}_`;
            distances.push(roundedDistance);
            angles.push(roundedAngle);
        });

        return {
            vectorId: vectorId,
            distances: distances,
            angles: angles
        };
    }

    // ============================================
    // 🔄 СРАВНЕНИЕ С ПАСПОРТАМИ
    // ============================================

    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        if (this.debug) {
            console.log(`\n🔍 СРАВНЕНИЕ ПАСПОРТОВ: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);
        }

        if (fp1.length === 0 || fp2.length === 0) {
            return this.createEmptyComparisonResult();
        }

        try {
            // 🔥 ПРОСТОЕ СРАВНЕНИЕ ПО ПАСПОРТАМ
            const matches = [];
            const used2 = new Set();

            // Создаем Map для быстрого поиска
            const fp2Map = new Map();
            fp2.forEach((point, index) => {
                fp2Map.set(point.vectorId, { point, index });
            });

            // Ищем точные совпадения по vectorId
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

            // Если точных совпадений мало, ищем похожие
            if (matches.length < Math.min(fp1.length, fp2.length) * 0.3) {
                const similarMatches = this.findSimilarPassports(fp1, fp2, used2);
                matches.push(...similarMatches);
            }

            const matchedPoints = matches.length;
            const maxPossible = Math.min(fp1.length, fp2.length);
            const similarity = maxPossible > 0 ? matchedPoints / maxPossible : 0;

            const isSame = similarity >= this.minSimilarity;
            const decision = isSame ? 'same' : 'different';

            if (this.debug) {
                console.log(`📊 РЕЗУЛЬТАТ:`);
                console.log(`   Совпадения: ${matchedPoints}/${maxPossible}`);
                console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}% (порог: ${this.minSimilarity * 100}%)`);
                console.log(`   Решение: ${decision}`);
               
                if (matches.length > 0) {
                    const exact = matches.filter(m => m.matchType === 'exact_passport').length;
                    const similar = matches.filter(m => m.matchType === 'similar_passport').length;
                    console.log(`   Точные совпадения: ${exact}`);
                    console.log(`   Похожие совпадения: ${similar}`);
                }
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

    // 🔥 ПОИСК ПОХОЖИХ ПАСПОРТОВ
    findSimilarPassports(fp1, fp2, used2) {
        const similarMatches = [];

        for (const point1 of fp1) {
            if (similarMatches.length >= Math.min(fp1.length, fp2.length) * 0.7) {
                break; // Достаточно совпадений
            }

            let bestMatch = null;
            let bestSimilarity = 0;

            for (let i = 0; i < fp2.length; i++) {
                if (used2.has(i)) continue;

                const point2 = fp2[i];
                const similarity = this.comparePassports(point1, point2);
               
                if (similarity > bestSimilarity && similarity > 0.7) {
                    bestSimilarity = similarity;
                    bestMatch = { point: point2, index: i, similarity: similarity };
                }
            }

            if (bestMatch) {
                similarMatches.push({
                    point1: point1,
                    point2: bestMatch.point,
                    similarity: bestMatch.similarity,
                    matchType: 'similar_passport',
                    confidence: bestMatch.similarity
                });
                used2.add(bestMatch.index);
            }
        }

        return similarMatches;
    }

    // 🔥 СРАВНЕНИЕ ДВУХ ПАСПОРТОВ
    comparePassports(point1, point2) {
        // Сравниваем расстояния
        const distSim = this.compareArrays(point1.distances || [], point2.distances || []);
       
        // Сравниваем углы
        const angleSim = this.compareArrays(point1.angles || [], point2.angles || []);
       
        // Средняя схожесть
        return (distSim + angleSim) / 2;
    }

    // 🔥 СРАВНЕНИЕ МАССИВОВ ЧИСЕЛ
    compareArrays(arr1, arr2) {
        if (arr1.length === 0 || arr2.length === 0) return 0;
       
        const maxLength = Math.max(arr1.length, arr2.length);
        let matches = 0;
       
        for (let i = 0; i < Math.min(arr1.length, arr2.length); i++) {
            const diff = Math.abs(arr1[i] - arr2[i]);
           
            // Для расстояний (допуск 10px)
            if (i < Math.min(arr1.length, arr2.length)) {
                if (diff <= 10) matches++;
            }
           
            // Для углов (допуск 30°)
            else {
                const angleDiff = Math.min(diff, 360 - diff);
                if (angleDiff <= 30) matches++;
            }
        }
       
        return matches / maxLength;
    }

    // ============================================
    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================

    findNearestNeighbors(centerPoint, allPoints, centerIndex, count) {
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
