// modules/footprint/clean/vector-algorithm.js
// 🔥 ПРОСТОЙ ВЕКТОРНЫЙ АЛГОРИТМ ДЛЯ ОБЪЕДИНЕНИЯ СЛЕДОВ

console.log('🎯 ПРОСТОЙ ВЕКТОРНЫЙ АЛГОРИТМ - ГЕОМЕТРИЧЕСКИЕ ОТНОШЕНИЯ\n');

class VectorAlgorithm {
    constructor(options = {}) {
        // 🔥 КЛЮЧЕВЫЕ ПАРАМЕТРЫ
        this.neighborCount = options.neighborCount || 5;        // 5 ближайших соседей
        this.distanceTolerance = options.distanceTolerance || 20; // 20px допуск
        this.angleTolerance = options.angleTolerance || 15;    // 15° допуск
        this.minSimilarity = options.minSimilarity || 0.6;     // 60% порог
        this.debug = options.debug !== false;

        console.log(`🎯 Параметры: ${this.neighborCount} соседей, допуск ${this.distanceTolerance}px`);
    }

    // ============================================
    // 🎯 СОЗДАНИЕ ВЕКТОРНОГО ОТПЕЧАТКА
    // ============================================

    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`🎯 Создаю векторный отпечаток "${name}" из ${points.length} точек`);
        }

        const vectorFootprint = [];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // 🔥 СОЗДАЕМ ПРОСТОЙ ВЕКТОРНЫЙ ID
            const vectorId = this.createSimpleVectorId(point, i, points);
           
            vectorFootprint.push({
                originalId: point.id || `pt_${i}`,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                index: i,
               
                // 🔥 ГЕОМЕТРИЧЕСКИЙ ВЕКТОРНЫЙ ID
                vectorId: vectorId,
               
                // Для быстрого сравнения
                geometricHash: vectorId,
               
                // Статистика
                confirmedCount: 1
            });
        }

        if (this.debug) {
            console.log(`✅ Создано ${vectorFootprint.length} векторных точек`);
            if (vectorFootprint.length > 0) {
                console.log(`   Первый векторный ID: ${vectorFootprint[0].vectorId.substring(0, 40)}...`);
            }
        }

        return vectorFootprint;
    }

    // 🔥 ПРОСТОЙ ВЕКТОРНЫЙ ID НА ОСНОВЕ ОТНОСИТЕЛЬНЫХ КООРДИНАТ
    createSimpleVectorId(point, index, allPoints) {
        // Находим 5 ближайших соседей
        const neighbors = this.findNearestNeighbors(point, allPoints, index, this.neighborCount);
       
        if (neighbors.length === 0) {
            return `ISOLATED_${index}`;
        }

        // Создаем геометрический паттерн на основе относительных координат
        let vectorString = '';
       
        neighbors.forEach((neighbor, neighborIndex) => {
            const dx = neighbor.x - point.x;
            const dy = neighbor.y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI; // -180..180
            const normalizedAngle = ((angle % 360) + 360) % 360; // 0..360
           
            // Округляем для устойчивости
            const roundedDistance = Math.round(distance / 10) * 10; // до 10px
            const roundedAngle = Math.round(normalizedAngle / 10) * 10; // до 10°
           
            vectorString += `D${roundedDistance}_A${roundedAngle}_`;
        });

        // Добавляем информацию о количестве соседей
        return `VEC_${neighbors.length}_${vectorString}`.slice(0, 100); // Ограничиваем длину
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
            // 🔥 ПРОСТОЕ СРАВНЕНИЕ ПО ВЕКТОРНЫМ ID
            const matches = [];
            const used2 = new Set();

            // Создаем Map для быстрого поиска по vectorId
            const fp2Map = new Map();
            fp2.forEach((point, index) => {
                fp2Map.set(point.vectorId, { point, index });
            });

            // Ищем совпадения
            for (const point1 of fp1) {
                // 1. Пытаемся найти точное совпадение по vectorId
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
                    continue;
                }

                // 2. Если нет точного совпадения, ищем похожие по расстоянию и координатам
                if (!used2.has(point1.index) && matches.length < Math.min(fp1.length, fp2.length)) {
                    const similarMatch = this.findSimilarByGeometry(point1, fp2, used2);
                    if (similarMatch) {
                        matches.push(similarMatch);
                        used2.add(similarMatch.point2.index);
                    }
                }
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
                    const exactMatches = matches.filter(m => m.matchType === 'exact_vector_id').length;
                    const geometryMatches = matches.filter(m => m.matchType === 'geometry').length;
                    console.log(`   Точные совпадения: ${exactMatches}`);
                    console.log(`   Геометрические совпадения: ${geometryMatches}`);
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

    // 🔥 ПОИСК ПОХОЖИХ ТОЧЕК ПО ГЕОМЕТРИИ
    findSimilarByGeometry(point1, fp2, used2) {
        let bestMatch = null;
        let bestSimilarity = 0;

        for (let i = 0; i < fp2.length; i++) {
            if (used2.has(i)) continue;

            const point2 = fp2[i];
           
            // 1. Проверяем расстояние между точками
            const distance = this.calculateDistance(point1, point2);
            if (distance > this.distanceTolerance * 3) continue; // Слишком далеко
           
            // 2. Проверяем похожесть векторных ID
            const vectorSimilarity = this.compareVectorIds(point1.vectorId, point2.vectorId);
           
            // 3. Проверяем локальную геометрию
            const geometrySimilarity = this.compareLocalGeometry(point1, point2);
           
            // Общая схожесть
            const totalSimilarity = (vectorSimilarity * 0.4 + geometrySimilarity * 0.6);
           
            if (totalSimilarity > bestSimilarity && totalSimilarity > 0.5) {
                bestSimilarity = totalSimilarity;
                bestMatch = {
                    point1: point1,
                    point2: point2,
                    similarity: totalSimilarity,
                    matchType: 'geometry',
                    confidence: totalSimilarity
                };
            }
        }

        return bestMatch;
    }

    // 🔥 СРАВНЕНИЕ ВЕКТОРНЫХ ID
    compareVectorIds(id1, id2) {
        if (id1 === id2) return 1.0;
       
        // Извлекаем компоненты из ID
        const parts1 = id1.split('_');
        const parts2 = id2.split('_');
       
        // Проверяем количество соседей
        if (parts1.length >= 2 && parts2.length >= 2) {
            const neighbors1 = parseInt(parts1[1]) || 0;
            const neighbors2 = parseInt(parts2[1]) || 0;
           
            if (Math.abs(neighbors1 - neighbors2) > 2) {
                return 0.3; // Слишком разное количество соседей
            }
        }
       
        // Сравниваем расстояния и углы
        let matches = 0;
        let total = 0;
       
        for (let i = 2; i < Math.min(parts1.length, parts2.length); i += 2) {
            if (i + 1 >= parts1.length || i + 1 >= parts2.length) break;
           
            const dist1 = parseInt(parts1[i]?.replace('D', '')) || 0;
            const angle1 = parseInt(parts1[i + 1]?.replace('A', '')) || 0;
            const dist2 = parseInt(parts2[i]?.replace('D', '')) || 0;
            const angle2 = parseInt(parts2[i + 1]?.replace('A', '')) || 0;
           
            // Проверяем расстояние (допуск 20px)
            if (Math.abs(dist1 - dist2) <= 20) matches++;
           
            // Проверяем угол (допуск 30°)
            const angleDiff = Math.abs(((angle1 - angle2 + 180) % 360) - 180);
            if (angleDiff <= 30) matches++;
           
            total += 2;
        }
       
        return total > 0 ? matches / total : 0.5;
    }

    // 🔥 СРАВНЕНИЕ ЛОКАЛЬНОЙ ГЕОМЕТРИИ
    compareLocalGeometry(point1, point2) {
        // Для простоты используем расстояние и примерное положение
        const distance = this.calculateDistance(point1, point2);
        const distanceSimilarity = Math.max(0, 1 - distance / (this.distanceTolerance * 2));
       
        return distanceSimilarity;
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

    calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
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
