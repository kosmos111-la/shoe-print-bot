// modules/footprint/clean/vector-algorithm.js
// 🎯 ЧИСТО ГЕОМЕТРИЧЕСКИЕ ХЭШИ (без координат)

class VectorAlgorithm {
    constructor(options = {}) {
        this.neighborCount = options.neighborCount || 5;
        this.anglePrecision = options.anglePrecision || 5; // Округляем углы до 5 градусов
        this.ratioPrecision = options.ratioPrecision || 0.1; // Округляем отношения до 0.1
        this.minSimilarity = options.minSimilarity || 0.6;
        this.debug = options.debug !== false;
    }

    // 🔥 СОЗДАНИЕ ГЕОМЕТРИЧЕСКИХ ХЭШЕЙ
    createFootprint(points, name = '') {
        console.log(`🎯 Создаю геометрические хэши из ${points.length} точек`);

        if (points.length < 5) {
            console.log(`⚠️ Слишком мало точек для геометрического анализа: ${points.length}`);
            return [];
        }

        const vectorFootprint = [];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // 🔥 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЙ ХЭШ НА ОСНОВЕ ОТНОСИТЕЛЬНЫХ РАССТОЯНИЙ И УГЛОВ
            const geometricHash = this.createRelativeGeometricHash(point, points, i);
           
            // Сохраняем оригинальные координаты ТОЛЬКО для отображения
            const footprintPoint = {
                originalId: point.id || `pt_${i}`,
                x: point.x, // Только для визуализации
                y: point.y, // Только для визуализации
                confidence: point.confidence || 0.5,
                index: i,
                vectorId: geometricHash, // 🔥 ГЕОМЕТРИЧЕСКИЙ ХЭШ
                confirmedCount: 1
            };

            vectorFootprint.push(footprintPoint);
        }

        if (this.debug && vectorFootprint.length > 0) {
            console.log(`✅ Создано ${vectorFootprint.length} геометрических хэшей`);
            console.log(`   Пример хэша: ${vectorFootprint[0].vectorId.substring(0, 60)}...`);
        }

        return vectorFootprint;
    }

    // 🔥 СОЗДАНИЕ ОТНОСИТЕЛЬНОГО ГЕОМЕТРИЧЕСКОГО ХЭША
    createRelativeGeometricHash(centerPoint, allPoints, centerIndex) {
        // Находим N ближайших соседей
        const nearestNeighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, this.neighborCount);
       
        if (nearestNeighbors.length < 3) {
            return `MIN_${nearestNeighbors.length}_NEIGHBORS`;
        }
       
        // 🔥 1. ВЫЧИСЛЯЕМ ОТНОСИТЕЛЬНЫЕ РАССТОЯНИЯ И УГЛЫ
        const neighborInfo = [];
       
        for (const neighbor of nearestNeighbors) {
            const dx = neighbor.x - centerPoint.x;
            const dy = neighbor.y - centerPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
           
            neighborInfo.push({
                distance: distance,
                angle: angle,
                neighborIndex: neighbor.index
            });
        }
       
        // Сортируем по расстоянию
        neighborInfo.sort((a, b) => a.distance - b.distance);
       
        // 🔥 2. НОРМАЛИЗУЕМ РАССТОЯНИЯ (делаем относительными)
        // Берем расстояние до ближайшего соседа как единицу измерения
        const baseDistance = neighborInfo[0].distance;
        if (baseDistance < 1) return `BASE_TOO_SMALL`;
       
        const normalizedInfo = neighborInfo.map(info => ({
            relativeDistance: Math.round((info.distance / baseDistance) / this.ratioPrecision) * this.ratioPrecision,
            relativeAngle: Math.round(info.angle / this.anglePrecision) * this.anglePrecision
        }));
       
        // 🔥 3. СОЗДАЕМ ТРЕУГОЛЬНИКИ ИЗ ОТНОСИТЕЛЬНЫХ РАССТОЯНИЙ
        const triangleHashes = [];
       
        // Берем 3 ближайших соседа
        if (normalizedInfo.length >= 3) {
            const t1 = this.createRelativeTriangle(
                normalizedInfo[0].relativeDistance,
                normalizedInfo[1].relativeDistance,
                normalizedInfo[2].relativeDistance,
                normalizedInfo[0].relativeAngle,
                normalizedInfo[1].relativeAngle,
                normalizedInfo[2].relativeAngle
            );
           
            if (t1) triangleHashes.push(t1);
        }
       
        // Еще треугольники из разных комбинаций
        if (normalizedInfo.length >= 4) {
            const t2 = this.createRelativeTriangle(
                normalizedInfo[0].relativeDistance,
                normalizedInfo[2].relativeDistance,
                normalizedInfo[3].relativeDistance,
                normalizedInfo[0].relativeAngle,
                normalizedInfo[2].relativeAngle,
                normalizedInfo[3].relativeAngle
            );
           
            if (t2) triangleHashes.push(t2);
        }
       
        // 🔥 4. СОЗДАЕМ ФИНАЛЬНЫЙ ХЭШ
        const trianglePart = triangleHashes.length > 0 ?
            triangleHashes.map(t => t.hash).join('|').substring(0, 40) :
            "NO_TRI";
       
        const neighborPart = normalizedInfo.map((info, idx) =>
            `N${idx}_RD${info.relativeDistance}_RA${info.relativeAngle}`
        ).join('|').substring(0, 60);
       
        return `GEO_${trianglePart}_${neighborPart}`;
    }

    // 🔥 СОЗДАНИЕ ТРЕУГОЛЬНИКА ИЗ ОТНОСИТЕЛЬНЫХ РАССТОЯНИЙ
    createRelativeTriangle(d1, d2, d3, a1, a2, a3) {
        try {
            // Вычисляем "виртуальные" стороны на основе относительных расстояний
            // Углы между направлениями к соседям
            const angle12 = Math.abs(((a2 - a1 + 180) % 360) - 180);
            const angle13 = Math.abs(((a3 - a1 + 180) % 360) - 180);
            const angle23 = Math.abs(((a3 - a2 + 180) % 360) - 180);
           
            // Сортируем углы
            const angles = [angle12, angle13, angle23].sort((x, y) => x - y);
           
            // Округляем
            const rounded = angles.map(angle =>
                Math.round(angle / this.anglePrecision) * this.anglePrecision
            );
           
            // Проверяем валидность (сумма углов вокруг точки должна быть около 360)
            const sum = angles.reduce((s, a) => s + a, 0);
            if (sum < 60 || sum > 300) return null;
           
            return {
                angles: angles,
                roundedAngles: rounded,
                hash: `T${rounded.join('-')}`,
                relativeDistances: [d1, d2, d3]
            };
           
        } catch (error) {
            return null;
        }
    }

    // 🔥 СРАВНЕНИЕ ОТПЕЧАТКОВ
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        console.log(`\n🔍 СРАВНЕНИЕ ГЕОМЕТРИЧЕСКИХ ХЭШЕЙ: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);

        if (fp1.length === 0 || fp2.length === 0) {
            return this.createEmptyComparisonResult();
        }

        try {
            // 🔥 БЫСТРОЕ СРАВНЕНИЕ ПО ХЭШАМ
            const matches = [];
           
            // Создаем Set для быстрого поиска
            const hashSet2 = new Set();
            fp2.forEach(point => {
                if (point.vectorId) {
                    hashSet2.add(point.vectorId);
                }
            });
           
            // Ищем точные совпадения хэшей
            for (const point1 of fp1) {
                if (point1.vectorId && hashSet2.has(point1.vectorId)) {
                    // Находим matching point2
                    const point2 = fp2.find(p => p.vectorId === point1.vectorId);
                    if (point2) {
                        matches.push({
                            point1: point1,
                            point2: point2,
                            similarity: 1.0,
                            matchLevel: 'exact_geometric_hash'
                        });
                    }
                }
            }
           
            const matchedPoints = matches.length;
            const maxPossible = Math.min(fp1.length, fp2.length);
            const similarity = maxPossible > 0 ? matchedPoints / maxPossible : 0;
           
            const isSame = similarity >= this.minSimilarity;
            const decision = isSame ? 'same' : 'different';
           
            console.log(`📊 РЕЗУЛЬТАТ:`);
            console.log(`   Совпадения геометрических хэшей: ${matchedPoints}/${maxPossible}`);
            console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}%`);
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
}

module.exports = VectorAlgorithm;
