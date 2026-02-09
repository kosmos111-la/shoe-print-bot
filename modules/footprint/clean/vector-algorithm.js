// modules/footprint/clean/vector-algorithm.js
// 🎯 МНОГОУРОВНЕВАЯ ГЕОМЕТРИЯ ТРЕУГОЛЬНИКОВ

class VectorAlgorithm {
    constructor(options = {}) {
        this.levels = options.levels || 3; // Уровни вложенности треугольников
        this.neighborsPerLevel = options.neighborsPerLevel || 3; // По 3 соседа на уровень
        this.anglePrecision = options.anglePrecision || 5; // Округляем углы до 5°
        this.minSimilarity = options.minSimilarity || 0.6;
        this.debug = options.debug !== false;
       
        console.log(`🎯 Многоуровневая геометрия: ${this.levels} уровня, ${this.neighborsPerLevel} соседей на уровень`);
    }

    // 🔥 СОЗДАНИЕ МНОГОУРОВНЕВЫХ ГЕОМЕТРИЧЕСКИХ ХЭШЕЙ
    createFootprint(points, name = '') {
        console.log(`🎯 Создаю многоуровневые геометрические хэши из ${points.length} точек`);

        if (points.length < 7) { // Нужно минимум 7 точек для 3 уровней
            console.log(`⚠️ Слишком мало точек для многоуровневой геометрии: ${points.length}`);
            return this.createSimpleFootprint(points, name);
        }

        const vectorFootprint = [];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // 🔥 СОЗДАЕМ МНОГОУРОВНЕВУЮ ГЕОМЕТРИЧЕСКУЮ СИГНАТУРУ
            const multiLevelSignature = this.createMultiLevelSignature(point, points, i);
           
            vectorFootprint.push({
                originalId: point.id || `pt_${i}`,
                x: point.x, // Только для отображения
                y: point.y, // Только для отображения
                confidence: point.confidence || 0.5,
                index: i,
               
                // 🔥 МНОГОУРОВНЕВАЯ СИГНАТУРА
                vectorId: multiLevelSignature.signature,
                geometricHash: multiLevelSignature.signature,
               
                // Для отладки
                levels: multiLevelSignature.levels,
               
                confirmedCount: 1
            });
        }

        if (this.debug && vectorFootprint.length > 0) {
            console.log(`✅ Создано ${vectorFootprint.length} многоуровневых сигнатур`);
            const sample = vectorFootprint[0];
            console.log(`   Пример сигнатуры: ${sample.vectorId.substring(0, 80)}...`);
            console.log(`   Уровней: ${sample.levels?.length || 0}`);
        }

        return vectorFootprint;
    }

    // 🔥 СОЗДАНИЕ МНОГОУРОВНЕВОЙ СИГНАТУРЫ
    createMultiLevelSignature(centerPoint, allPoints, centerIndex) {
        const levels = [];
       
        // 🔥 УРОВЕНЬ 0: Базовый (сама точка)
        const level0 = {
            type: 'center',
            pointIndex: centerIndex
        };
        levels.push(level0);
       
        // 🔥 УРОВЕНЬ 1: "Квартира" - треугольник из ближайших соседей
        const level1 = this.createLevel1(centerPoint, allPoints, centerIndex);
        if (!level1) {
            return { signature: `NO_LEVEL1`, levels: [] };
        }
        levels.push(level1);
       
        // 🔥 УРОВЕНЬ 2: "Этаж" - треугольник из центров треугольников уровня 1
        const level2 = this.createLevel2(level1, allPoints);
        if (level2) {
            levels.push(level2);
           
            // 🔥 УРОВЕНЬ 3: "Подъезд" - треугольник из центров треугольников уровня 2
            const level3 = this.createLevel3(level2, allPoints);
            if (level3) {
                levels.push(level3);
            }
        }
       
        // 🔥 СОЗДАЕМ СИГНАТУРУ ИЗ УГЛОВ ВСЕХ УРОВНЕЙ
        const signature = this.createSignatureFromLevels(levels);
       
        return {
            signature: signature,
            levels: levels,
            levelCount: levels.length
        };
    }

    // 🔥 УРОВЕНЬ 1: Треугольник из ближайших соседей ("квартира")
    createLevel1(centerPoint, allPoints, centerIndex) {
        // Находим N ближайших соседей
        const neighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, this.neighborsPerLevel + 2);
       
        if (neighbors.length < 3) return null;
       
        // Берем 3 ближайших соседа для треугольника
        const trianglePoints = [neighbors[0], neighbors[1], neighbors[2]];
       
        // Вычисляем углы треугольника
        const angles = this.calculateTriangleAngles(trianglePoints[0], trianglePoints[1], trianglePoints[2]);
        if (!angles) return null;
       
        // Вычисляем центр треугольника
        const center = this.calculateTriangleCenter(trianglePoints[0], trianglePoints[1], trianglePoints[2]);
       
        return {
            type: 'level1_triangle',
            neighborIndices: trianglePoints.map(p => p.index),
            angles: angles.sortedAngles,
            roundedAngles: angles.roundedAngles,
            center: center,
            hash: `L1_${angles.roundedAngles.join('-')}`
        };
    }

    // 🔥 УРОВЕНЬ 2: Треугольник из центров треугольников уровня 1 соседних точек ("этаж")
    createLevel2(level1, allPoints) {
        // Нужны соседние точки, у которых тоже есть level1
        // Для простоты берем точки из треугольника level1
        const trianglePoints = [];
       
        for (const neighborIndex of level1.neighborIndices) {
            const neighborPoint = allPoints[neighborIndex];
            if (!neighborPoint) continue;
           
            // Создаем level1 для соседней точки
            const neighborLevel1 = this.createLevel1(neighborPoint, allPoints, neighborIndex);
            if (neighborLevel1 && neighborLevel1.center) {
                trianglePoints.push({
                    point: neighborPoint,
                    center: neighborLevel1.center,
                    index: neighborIndex
                });
            }
        }
       
        if (trianglePoints.length < 3) return null;
       
        // Берем 3 точки для треугольника
        const centers = [trianglePoints[0].center, trianglePoints[1].center, trianglePoints[2].center];
       
        // Вычисляем углы треугольника из центров
        const angles = this.calculateTriangleAngles(
            { x: centers[0].x, y: centers[0].y },
            { x: centers[1].x, y: centers[1].y },
            { x: centers[2].x, y: centers[2].y }
        );
        if (!angles) return null;
       
        // Вычисляем центр этого треугольника
        const center = this.calculateTriangleCenter(
            { x: centers[0].x, y: centers[0].y },
            { x: centers[1].x, y: centers[1].y },
            { x: centers[2].x, y: centers[2].y }
        );
       
        return {
            type: 'level2_triangle',
            sourceIndices: trianglePoints.map(p => p.index),
            angles: angles.sortedAngles,
            roundedAngles: angles.roundedAngles,
            center: center,
            hash: `L2_${angles.roundedAngles.join('-')}`
        };
    }

    // 🔥 УРОВЕНЬ 3: Треугольник из центров треугольников уровня 2 ("подъезд")
    createLevel3(level2, allPoints) {
        // Берем точки, которые использовались в level2
        const trianglePoints = [];
       
        for (const sourceIndex of level2.sourceIndices) {
            const sourcePoint = allPoints[sourceIndex];
            if (!sourcePoint) continue;
           
            // Создаем level1 для этой точки
            const sourceLevel1 = this.createLevel1(sourcePoint, allPoints, sourceIndex);
            if (!sourceLevel1) continue;
           
            // Создаем level2 для этой точки
            const sourceLevel2 = this.createLevel2(sourceLevel1, allPoints);
            if (sourceLevel2 && sourceLevel2.center) {
                trianglePoints.push({
                    point: sourcePoint,
                    center: sourceLevel2.center,
                    index: sourceIndex
                });
            }
        }
       
        if (trianglePoints.length < 3) return null;
       
        const centers = [trianglePoints[0].center, trianglePoints[1].center, trianglePoints[2].center];
       
        const angles = this.calculateTriangleAngles(
            { x: centers[0].x, y: centers[0].y },
            { x: centers[1].x, y: centers[1].y },
            { x: centers[2].x, y: centers[2].y }
        );
        if (!angles) return null;
       
        return {
            type: 'level3_triangle',
            sourceIndices: trianglePoints.map(p => p.index),
            angles: angles.sortedAngles,
            roundedAngles: angles.roundedAngles,
            hash: `L3_${angles.roundedAngles.join('-')}`
        };
    }

    // 🔥 СОЗДАНИЕ СИГНАТУРЫ ИЗ ВСЕХ УРОВНЕЙ
    createSignatureFromLevels(levels) {
        const parts = [];
       
        for (const level of levels) {
            if (level.hash) {
                parts.push(level.hash);
            } else if (level.type === 'center') {
                parts.push('CENTER');
            }
        }
       
        // Добавляем отношения между уровнями
        if (levels.length >= 2) {
            const level1 = levels.find(l => l.type === 'level1_triangle');
            const level2 = levels.find(l => l.type === 'level2_triangle');
           
            if (level1 && level2) {
                // Угол между центрами треугольников
                const angle = this.calculateAngleBetweenCenters(level1.center, level2.center);
                const roundedAngle = Math.round(angle / this.anglePrecision) * this.anglePrecision;
                parts.push(`REL_L1-L2_A${roundedAngle}`);
            }
        }
       
        if (levels.length >= 3) {
            const level2 = levels.find(l => l.type === 'level2_triangle');
            const level3 = levels.find(l => l.type === 'level3_triangle');
           
            if (level2 && level3 && level2.center) {
                // Для level3 нет центра, используем углы
                const angleDiff = this.calculateAngleDifference(level2.angles, level3.angles);
                parts.push(`REL_L2-L3_D${angleDiff}`);
            }
        }
       
        return `ML_${parts.join('_')}`;
    }

    // 🔥 СРАВНЕНИЕ МНОГОУРОВНЕВЫХ СИГНАТУР
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        console.log(`\n🔍 СРАВНЕНИЕ МНОГОУРОВНЕВЫХ СИГНАТУР: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);

        if (fp1.length === 0 || fp2.length === 0) {
            return this.createEmptyComparisonResult();
        }

        try {
            // 🔥 СРАВНИВАЕМ СИГНАТУРЫ С УЧЕТОМ УГЛОВ
            const matches = [];
           
            for (const point1 of fp1) {
                for (const point2 of fp2) {
                    if (!point1.vectorId || !point2.vectorId) continue;
                   
                    // 🔥 СРАВНИВАЕМ МНОГОУРОВНЕВЫЕ СИГНАТУРЫ
                    const similarity = this.compareMultiLevelSignatures(point1.vectorId, point2.vectorId);
                   
                    if (similarity > 0.7) { // 70% схожести сигнатур
                        matches.push({
                            point1: point1,
                            point2: point2,
                            similarity: similarity,
                            matchLevel: 'multi_level_signature',
                            signatureSimilarity: similarity
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
            console.log(`   Совпадения многоуровневых сигнатур: ${matchedPoints}/${maxPossible}`);
            console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}% (порог: ${this.minSimilarity * 100}%)`);
            console.log(`   Решение: ${decision}`);
           
            if (matches.length > 0 && this.debug) {
                const avgSignatureSimilarity = matches.reduce((sum, m) => sum + m.signatureSimilarity, 0) / matches.length;
                console.log(`   Средняя схожесть сигнатур: ${(avgSignatureSimilarity * 100).toFixed(1)}%`);
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

    // 🔥 СРАВНЕНИЕ МНОГОУРОВНЕВЫХ СИГНАТУР
    compareMultiLevelSignatures(sig1, sig2) {
        if (!sig1 || !sig2) return 0;
        if (sig1 === sig2) return 1.0;
       
        // Разбиваем сигнатуры на части
        const parts1 = sig1.split('_');
        const parts2 = sig2.split('_');
       
        // Сравниваем основные части (L1, L2, L3)
        let commonParts = 0;
        let totalParts = 0;
       
        // Ищем части с углами (L1_, L2_, L3_)
        const angleParts1 = parts1.filter(p => p.startsWith('L') && p.includes('-'));
        const angleParts2 = parts2.filter(p => p.startsWith('L') && p.includes('-'));
       
        totalParts = Math.max(angleParts1.length, angleParts2.length);
       
        // Сравниваем угловые части
        for (const part1 of angleParts1) {
            for (const part2 of angleParts2) {
                if (this.compareAngleParts(part1, part2)) {
                    commonParts++;
                    break;
                }
            }
        }
       
        return totalParts > 0 ? commonParts / totalParts : 0;
    }

    // 🔥 СРАВНЕНИЕ УГЛОВЫХ ЧАСТЕЙ (независимо от порядка углов)
    compareAngleParts(part1, part2) {
        try {
            // Пример: "L1_60-90-30" → углы [60, 90, 30]
            const angles1 = this.extractAngles(part1);
            const angles2 = this.extractAngles(part2);
           
            if (!angles1 || !angles2 || angles1.length !== angles2.length) {
                return false;
            }
           
            // Сортируем углы для сравнения
            const sorted1 = [...angles1].sort((a, b) => a - b);
            const sorted2 = [...angles2].sort((a, b) => a - b);
           
            // Сравниваем с допуском
            for (let i = 0; i < sorted1.length; i++) {
                if (Math.abs(sorted1[i] - sorted2[i]) > this.anglePrecision * 2) {
                    return false;
                }
            }
           
            return true;
           
        } catch (error) {
            return false;
        }
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    extractAngles(part) {
        // Ищем числа в строке
        const matches = part.match(/\d+/g);
        if (!matches) return null;
       
        return matches.map(m => parseInt(m, 10)).filter(a => !isNaN(a));
    }

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

    calculateTriangleAngles(p1, p2, p3) {
        try {
            const a = this.distance(p2, p3);
            const b = this.distance(p1, p3);
            const c = this.distance(p1, p2);
           
            const angleA = this.cosineLawAngle(b, c, a);
            const angleB = this.cosineLawAngle(a, c, b);
            const angleC = this.cosineLawAngle(a, b, c);
           
            // Сортируем углы
            const angles = [angleA, angleB, angleC].sort((x, y) => x - y);
           
            // Округляем
            const roundedAngles = angles.map(angle =>
                Math.round(angle / this.anglePrecision) * this.anglePrecision
            );
           
            // Проверяем валидность (сумма ≈ 180°)
            const sum = angles.reduce((s, a) => s + a, 0);
            if (Math.abs(sum - 180) > 20) return null;
           
            return {
                angles: angles,
                sortedAngles: angles,
                roundedAngles: roundedAngles
            };
           
        } catch (error) {
            return null;
        }
    }

    calculateTriangleCenter(p1, p2, p3) {
        return {
            x: (p1.x + p2.x + p3.x) / 3,
            y: (p1.y + p2.y + p3.y) / 3
        };
    }

    calculateAngleBetweenCenters(center1, center2) {
        const dx = center2.x - center1.x;
        const dy = center2.y - center1.y;
        return Math.atan2(dy, dx) * 180 / Math.PI;
    }

    calculateAngleDifference(angles1, angles2) {
        if (!angles1 || !angles2 || angles1.length !== angles2.length) return 180;
       
        let totalDiff = 0;
        for (let i = 0; i < angles1.length; i++) {
            totalDiff += Math.abs(angles1[i] - angles2[i]);
        }
       
        return Math.round(totalDiff / angles1.length);
    }

    distance(p1, p2) {
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

    createSimpleFootprint(points, name = '') {
        const footprint = [];
       
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            footprint.push({
                originalId: point.id || `pt_${i}`,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                vectorId: `SIMPLE_${i}`,
                geometricHash: `SIMPLE_${i}`,
                confirmedCount: 1
            });
        }
       
        return footprint;
    }
}

module.exports = VectorAlgorithm;
