// modules/footprint/clean/vector-algorithm.js
// 🎯 ГЕОМЕТРИЧЕСКИЕ ХЭШИ БЕЗ ТРАНСФОРМАЦИЙ

class VectorAlgorithm {
    constructor(options = {}) {
        this.neighborCount = options.neighborCount || 5; // Берем 5 ближайших соседей
        this.hashPrecision = options.hashPrecision || 1; // Округляем до 1 градуса
        this.minSimilarity = options.minSimilarity || 0.6;
        this.debug = options.debug !== false;
    }

    // 🔥 СОЗДАНИЕ ОТПЕЧАТКА БЕЗ ТРАНСФОРМАЦИЙ
    createFootprint(points, name = '') {
        console.log(`🎯 Создаю отпечаток "${name}" из ${points.length} точек (без трансформаций)`);

        if (points.length < 5) {
            console.log(`⚠️ Слишком мало точек: ${points.length}`);
            return this.createSimpleFootprint(points, name);
        }

        // НЕ ТРАНСФОРМИРУЕМ! Берем оригинальные координаты
        const vectorFootprint = [];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // 🔥 СОЗДАЕМ УНИКАЛЬНЫЙ ГЕОМЕТРИЧЕСКИЙ ХЭШ
            const geometricHash = this.createGeometricHash(point, points, i);
           
            vectorFootprint.push({
                originalId: point.id || `pt_${i}`,
                x: point.x, // Оригинальные координаты
                y: point.y,
                confidence: point.confidence || 0.5,
                index: i,
               
                // 🔥 ГЕОМЕТРИЧЕСКИЙ ХЭШ (основа сравнения)
                vectorId: geometricHash,
                geometricHash: geometricHash,
               
                // Для отладки
                neighbors: this.getNeighborInfo(point, points, i),
               
                confirmedCount: 1
            });
        }

        if (this.debug && vectorFootprint.length > 0) {
            console.log(`✅ Создан отпечаток: ${vectorFootprint.length} точек`);
            console.log(`   Пример хэша: ${vectorFootprint[0].vectorId.substring(0, 50)}...`);
        }

        return vectorFootprint;
    }

    // 🔥 СОЗДАНИЕ ГЕОМЕТРИЧЕСКОГО ХЭША НА ОСНОВЕ ОТНОСИТЕЛЬНЫХ КООРДИНАТ
    createGeometricHash(centerPoint, allPoints, centerIndex) {
        // Находим N ближайших соседей
        const nearestNeighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, this.neighborCount);
       
        if (nearestNeighbors.length < 3) {
            // Если мало соседей - простой хэш
            return this.createSimpleHash(centerPoint, nearestNeighbors);
        }
       
        // 🔥 1. СОЗДАЕМ ТРЕУГОЛЬНИКИ С 3 БЛИЖАЙШИМИ СОСЕДЯМИ
        const triangles = [];
       
        // Берем 3 ближайших соседа для основного треугольника
        const closest3 = nearestNeighbors.slice(0, 3);
       
        if (closest3.length === 3) {
            const mainTriangle = this.createTriangle(centerPoint, closest3[0], closest3[1], closest3[2]);
            if (mainTriangle) {
                triangles.push(mainTriangle);
            }
        }
       
        // 🔥 2. СОЗДАЕМ ОТНОШЕНИЯ С ОСТАЛЬНЫМИ СОСЕДЯМИ
        const neighborRelations = [];
       
        for (let i = 0; i < Math.min(nearestNeighbors.length, 5); i++) {
            const neighbor = nearestNeighbors[i];
            const distance = Math.round(this.vectorDistance(centerPoint, neighbor));
            const angle = Math.round(Math.atan2(neighbor.y - centerPoint.y, neighbor.x - centerPoint.x) * 180 / Math.PI);
           
            // Нормализуем угол к 0-360
            const normalizedAngle = ((angle % 360) + 360) % 360;
           
            neighborRelations.push({
                distance: distance,
                angle: normalizedAngle,
                neighborIndex: neighbor.index
            });
        }
       
        // Сортируем по расстоянию
        neighborRelations.sort((a, b) => a.distance - b.distance);
       
        // 🔥 3. СОЗДАЕМ УНИКАЛЬНЫЙ ХЭШ
        const triangleHash = triangles.length > 0 ? triangles[0].hash : "NO_TRI";
       
        const relationsHash = neighborRelations.map((rel, idx) =>
            `N${idx}_D${rel.distance}_A${Math.round(rel.angle/5)*5}`
        ).join('|');
       
        // 🔥 ФИНАЛЬНЫЙ ХЭШ: треугольник + отношения
        return `HASH_T${triangleHash}_R${relationsHash.substring(0, 100)}`;
    }

    // 🔥 СОЗДАНИЕ ТРЕУГОЛЬНИКА
    createTriangle(center, p1, p2, p3) {
        try {
            // Вычисляем стороны
            const a = this.vectorDistance(p2, p3);
            const b = this.vectorDistance(center, p3);
            const c = this.vectorDistance(center, p2);
           
            // Вычисляем углы при центре
            const angle1 = this.cosineLawAngle(b, c, a);
            const angle2 = this.cosineLawAngle(a, c, b);
            const angle3 = this.cosineLawAngle(a, b, c);
           
            // Сортируем углы по возрастанию
            const angles = [angle1, angle2, angle3].sort((x, y) => x - y);
           
            // Округляем
            const rounded = angles.map(angle =>
                Math.round(angle / this.hashPrecision) * this.hashPrecision
            );
           
            // Проверяем валидность треугольника
            const sum = angles.reduce((s, a) => s + a, 0);
            if (Math.abs(sum - 180) > 10) return null;
           
            return {
                angles: angles,
                roundedAngles: rounded,
                hash: rounded.join('-'),
                points: [p1.index, p2.index, p3.index]
            };
           
        } catch (error) {
            return null;
        }
    }

    // 🔥 СРАВНЕНИЕ ОТПЕЧАТКОВ
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        console.log(`\n🔍 ГЕОМЕТРИЧЕСКОЕ СРАВНЕНИЕ: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);

        if (fp1.length === 0 || fp2.length === 0) {
            return this.createEmptyComparisonResult();
        }

        try {
            // 🔥 ИСПОЛЬЗУЕМ ХЭШИ ДЛЯ БЫСТРОГО СРАВНЕНИЯ
            const matches = [];
            const used2 = new Set();
           
            // Создаем мап для быстрого поиска по хэшу
            const hashMap2 = new Map();
            fp2.forEach((point, index) => {
                if (point.vectorId) {
                    hashMap2.set(point.vectorId, { point, index });
                }
            });
           
            // 🔥 ПРОВЕРЯЕМ ТОЧНЫЕ СОВПАДЕНИЯ ХЭШЕЙ
            for (const point1 of fp1) {
                if (!point1.vectorId) continue;
               
                const match2 = hashMap2.get(point1.vectorId);
                if (match2 && !used2.has(match2.index)) {
                    matches.push({
                        point1: point1,
                        point2: match2.point,
                        similarity: 1.0,
                        matchLevel: 'exact_hash'
                    });
                    used2.add(match2.index);
                }
            }
           
            const matchedPoints = matches.length;
            const maxPossible = Math.min(fp1.length, fp2.length);
            const similarity = maxPossible > 0 ? matchedPoints / maxPossible : 0;
           
            const isSame = similarity >= this.minSimilarity;
            const decision = isSame ? 'same' : 'different';
           
            console.log(`📊 РЕЗУЛЬТАТ:`);
            console.log(`   Точные совпадения хэшей: ${matchedPoints}/${maxPossible}`);
            console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}% (порог: ${this.minSimilarity * 100}%)`);
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

    getNeighborInfo(centerPoint, allPoints, centerIndex) {
        const neighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, 3);
        return neighbors.map((neighbor, idx) => ({
            index: neighbor.index,
            distance: Math.round(this.vectorDistance(centerPoint, neighbor)),
            angle: Math.round(Math.atan2(neighbor.y - centerPoint.y, neighbor.x - centerPoint.x) * 180 / Math.PI)
        }));
    }

    createSimpleHash(centerPoint, neighbors) {
        let hash = `SIMPLE_X${Math.round(centerPoint.x)}_Y${Math.round(centerPoint.y)}`;
       
        neighbors.forEach((neighbor, idx) => {
            const distance = Math.round(this.vectorDistance(centerPoint, neighbor));
            const angle = Math.round(Math.atan2(neighbor.y - centerPoint.y, neighbor.x - centerPoint.x) * 180 / Math.PI);
            hash += `_N${idx}_D${distance}_A${angle}`;
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
            const simpleHash = this.createSimpleHash(point, []);
           
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
