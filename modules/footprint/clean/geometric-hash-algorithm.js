// modules/footprint/core/comparison/geometric-hash-algorithm.js
console.log('🔷 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ - ВЕКТОРНЫЙ ПОДХОД\n');

/**
* 🎯 ГЕОМЕТРИЧЕСКИЙ ХЕШ-АЛГОРИТМ
* Сравнивает точки по геометрическим отношениям, а не по координатам
*/
class GeometricHashAlgorithm {
    /**
     * КОНСТРУКТОР
     * @param {Object} options - Параметры алгоритма
     */
    constructor(options = {}) {
        // 🔗 ФИКСИРОВАННЫЕ СОСЕДИ (ключевая идея!)
        this.neighborOffsets = options.neighborOffsets || [-2, -1, 1, 2];
       
        // 📐 ДОПУСКИ (работают с углами, не с координатами!)
        this.angleTolerance = options.angleTolerance || 10;     // ±10 градусов
        this.hashPrecision = options.hashPrecision || 5;        // округление до 5°
        this.minSimilarity = options.minSimilarity || 0.6;      // 60% сходства
        this.minTriangles = options.minTriangles || 2;          // минимум 2 треугольника
        this.useNormalization = options.useNormalization !== false; // Нормализация точек
       
        this.debug = options.debug || false;
        this.stats = {
            footprintsCreated: 0,
            comparisonsMade: 0,
            matchesFound: 0
        };
    }

    // ============================================
    // 🎯 ОСНОВНОЙ ИНТЕРФЕЙС
    // ============================================

    /**
     * СОЗДАТЬ ГЕОМЕТРИЧЕСКИЙ ОТПЕЧАТОК
     * @param {Array} points - Массив точек [{x, y, id, originalId?}]
     * @param {string} name - Имя для отладки
     * @returns {Array} Геометрические дескрипторы
     */
    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`👣 Создание геометрического отпечатка "${name}": ${points.length} точек`);
        }
       
        this.stats.footprintsCreated++;
       
        // Нормализуем точки если нужно
        const normalizedPoints = this.useNormalization
            ? this.normalizePoints(points)
            : points.map((p, idx) => ({
                ...p,
                originalIndex: idx,
                normalized: false
            }));
       
        const footprint = [];
       
        for (let i = 0; i < normalizedPoints.length; i++) {
            const point = normalizedPoints[i];
            const descriptor = this.createPointDescriptor(point, normalizedPoints, i);
           
            if (descriptor) {
                footprint.push(descriptor);
            }
        }
       
        if (this.debug && footprint.length > 0) {
            console.log(`   ✅ Создано дескрипторов: ${footprint.length}`);
        }
       
        return footprint;
    }

    /**
     * СРАВНИТЬ ДВА ОТПЕЧАТКА
     * @param {Array} fp1 - Первый отпечаток
     * @param {Array} fp2 - Второй отпечаток
     * @param {Object} options - Опции сравнения
     * @returns {Object} Результат сравнения
     */
    compareFootprints(fp1, fp2, options = {}) {
        this.stats.comparisonsMade++;
       
        const minSimilarity = options.minSimilarity || this.minSimilarity;
        const matches = [];
        const hashMap = new Map();
       
        // Создаем индекс хешей для второго отпечатка
        fp2.forEach(point => {
            if (point.geometricHash) {
                if (!hashMap.has(point.geometricHash)) {
                    hashMap.set(point.geometricHash, []);
                }
                hashMap.get(point.geometricHash).push(point);
            }
        });
       
        // Ищем совпадения по хешам
        fp1.forEach(point1 => {
            if (!point1.geometricHash) return;
           
            const matchingPoints = hashMap.get(point1.geometricHash) || [];
           
            for (const point2 of matchingPoints) {
                // Дополнительная проверка сходства
                const similarity = this.calculatePointSimilarity(point1, point2);
               
                if (similarity >= minSimilarity) {
                    matches.push({
                        point1: point1,
                        point2: point2,
                        similarity: similarity,
                        distance: this.calculateDistance(point1, point2),
                        hash: point1.geometricHash
                    });
                    break;
                }
            }
        });
       
        this.stats.matchesFound += matches.length;
       
        return this.createComparisonResult(fp1, fp2, matches, options);
    }

    /**
     * ОБНОВИТЬ ПОДТВЕРЖДЕНИЯ ТОЧЕК
     * @param {Array} points1 - Точки первого отпечатка
     * @param {Array} points2 - Точки второго отпечатка
     * @param {Array} matches - Совпадения
     * @returns {number} Количество обновленных точек
     */
    updatePointConfirmations(points1, points2, matches) {
        let updatedCount = 0;
        const matchedIds = new Set();
       
        // Для каждой пары совпадений обновляем подтверждения
        matches.forEach(match => {
            const point1 = points1.find(p => p.id === match.point1.id);
            const point2 = points2.find(p => p.id === match.point2.id);
           
            if (point1 && point2) {
                // Обновляем подтверждения
                if (point1.confirmedCount) {
                    point1.confirmedCount++;
                    point1.confirmedBy = point1.confirmedBy || [];
                    point1.confirmedBy.push(`geo_match_${match.point2.id}`);
                    point1.lastConfirmed = new Date();
                }
               
                if (point2.confirmedCount) {
                    point2.confirmedCount++;
                    point2.confirmedBy = point2.confirmedBy || [];
                    point2.confirmedBy.push(`geo_match_${match.point1.id}`);
                    point2.lastConfirmed = new Date();
                }
               
                matchedIds.add(point1.id);
                matchedIds.add(point2.id);
                updatedCount++;
            }
        });
       
        return updatedCount;
    }

    // ============================================
    // 🔧 ВНУТРЕННИЕ МЕТОДЫ
    // ============================================

    /**
     * СОЗДАТЬ ДЕСКРИПТОР ТОЧКИ
     */
    createPointDescriptor(centerPoint, allPoints, centerIndex) {
        // Находим фиксированных соседей
        const neighbors = this.findFixedNeighbors(centerIndex, allPoints);
       
        if (neighbors.length < 2) return null;
       
        // Создаем треугольники
        const triangles = this.createTriangles(centerPoint, neighbors);
       
        if (triangles.length < this.minTriangles) return null;
       
        // Создаем геометрический хеш
        const geometricHash = this.createGeometricHash(triangles);
        const triangleHashes = triangles.map(t => t.hash);
       
        return {
            // Идентификаторы
            id: centerPoint.id,
            originalId: centerPoint.originalId || centerPoint.id,
            originalIndex: centerPoint.originalIndex || centerIndex,
           
            // Координаты (векторные!)
            x: centerPoint.x,
            y: centerPoint.y,
           
            // Геометрическая информация
            geometricHash: geometricHash,
            triangleHashes: triangleHashes,
            triangles: triangles,
            triangleCount: triangles.length,
           
            // Метаданные
            neighborCount: neighbors.length,
            normalized: centerPoint.normalized || false,
           
            // Для совместимости с системой
            confirmedCount: centerPoint.confirmedCount || 1,
            confirmedBy: centerPoint.confirmedBy || ['geometric_initial'],
            lastConfirmed: centerPoint.lastConfirmed || new Date()
        };
    }

    /**
     * НАЙТИ ФИКСИРОВАННЫХ СОСЕДЕЙ
     */
    findFixedNeighbors(centerIndex, allPoints) {
        const neighbors = [];
        const total = allPoints.length;
       
        for (const offset of this.neighborOffsets) {
            const neighborIndex = (centerIndex + offset + total) % total;
           
            if (neighborIndex !== centerIndex) {
                const neighbor = allPoints[neighborIndex];
                neighbors.push({
                    ...neighbor,
                    relativeOffset: offset
                });
            }
        }
       
        return neighbors;
    }

    /**
     * СОЗДАТЬ ТРЕУГОЛЬНИКИ
     */
    createTriangles(center, neighbors) {
        const triangles = [];
       
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const triangle = this.createTriangle(center, neighbors[i], neighbors[j]);
                if (triangle && this.isValidTriangle(triangle)) {
                    triangles.push(triangle);
                }
            }
        }
       
        return triangles;
    }

    /**
     * СОЗДАТЬ ОДИН ТРЕУГОЛЬНИК
     */
    createTriangle(p1, p2, p3) {
        try {
            const angles = this.calculateTriangleAngles(p1, p2, p3);
            const normalized = this.normalizeAngles(angles);
            const sorted = normalized.sort((a, b) => a - b);
           
            // Округляем с заданной точностью
            const rounded = sorted.map(angle => {
                if (this.hashPrecision > 0) {
                    return Math.round(angle / this.hashPrecision) * this.hashPrecision;
                }
                return Math.round(angle);
            });
           
            // Создаем хеш
            const hash = rounded.join('-');
           
            return {
                points: [p1.id, p2.id, p3.id],
                indices: [
                    p1.originalIndex || 0,
                    p2.originalIndex || 0,
                    p3.originalIndex || 0
                ],
                angles: angles,
                normalizedAngles: sorted,
                roundedAngles: rounded,
                hash: hash
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * СОЗДАТЬ ГЕОМЕТРИЧЕСКИЙ ХЕШ ТОЧКИ
     */
    createGeometricHash(triangles) {
        const triangleHashes = triangles.map(t => t.hash).sort();
        return triangleHashes.join('|');
    }

    /**
     * ВЫЧИСЛИТЬ СХОДСТВО ТОЧЕК
     */
    calculatePointSimilarity(point1, point2) {
        if (!point1.geometricHash || !point2.geometricHash) return 0;
       
        // Если хеши совпадают - 100% сходство
        if (point1.geometricHash === point2.geometricHash) return 1.0;
       
        // Сравниваем наборы треугольников
        const set1 = new Set(point1.triangleHashes);
        const set2 = new Set(point2.triangleHashes);
       
        const intersection = [...set1].filter(h => set2.has(h)).length;
        const union = new Set([...set1, ...set2]).size;
       
        return union > 0 ? intersection / union : 0;
    }

    /**
     * НОРМАЛИЗОВАТЬ ТОЧКИ
     */
    normalizePoints(points) {
        if (points.length < 3) return points;
       
        // Центрирование
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        const centered = points.map((p, idx) => ({
            ...p,
            x: p.x - centerX,
            y: p.y - centerY,
            originalIndex: idx,
            normalized: true
        }));
       
        // Масштабирование к единичному радиусу
        const maxDist = Math.max(...centered.map(p =>
            Math.sqrt(p.x * p.x + p.y * p.y)
        ));
       
        if (maxDist > 0.001) {
            const scale = 1.0 / maxDist;
            return centered.map(p => ({
                ...p,
                x: p.x * scale,
                y: p.y * scale
            }));
        }
       
        return centered;
    }

    /**
     * ВЫЧИСЛИТЬ РЕЗУЛЬТАТ СРАВНЕНИЯ
     */
    createComparisonResult(fp1, fp2, matches, options) {
        const total1 = fp1.length;
        const total2 = fp2.length;
        const matched = matches.length;
       
        // Двойная статистика
        const percent1to2 = total1 > 0 ? (matched / total1 * 100).toFixed(1) : '0.0';
        const percent2to1 = total2 > 0 ? (matched / total2 * 100).toFixed(1) : '0.0';
       
        // Среднее сходство
        const avgSimilarity = matches.length > 0
            ? (matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length).toFixed(3)
            : 0;
       
        return {
            matches: matches,
            stats: {
                totalPoints1: total1,
                totalPoints2: total2,
                matchedPoints: matched,
                percent1to2: percent1to2,
                percent2to1: percent2to1,
                avgSimilarity: avgSimilarity,
                unconfirmed1: total1 - matched,
                unconfirmed2: total2 - matched
            },
            metadata: {
                algorithm: 'geometric-hash',
                timestamp: new Date(),
                options: {
                    angleTolerance: this.angleTolerance,
                    minSimilarity: options.minSimilarity || this.minSimilarity,
                    normalization: this.useNormalization
                }
            }
        };
    }

    // ============================================
    // 📏 МАТЕМАТИЧЕСКИЕ ФУНКЦИИ
    // ============================================

    calculateTriangleAngles(p1, p2, p3) {
        const a = this.calculateDistance(p2, p3);
        const b = this.calculateDistance(p1, p3);
        const c = this.calculateDistance(p1, p2);
       
        const angleA = this.cosineLawAngle(b, c, a);
        const angleB = this.cosineLawAngle(a, c, b);
        const angleC = this.cosineLawAngle(a, b, c);
       
        return [angleA, angleB, angleC];
    }

    calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    cosineLawAngle(side1, side2, opposite) {
        const cos = (side1 * side1 + side2 * side2 - opposite * opposite) / (2 * side1 * side2);
        const clamped = Math.max(-1, Math.min(1, cos));
        return Math.acos(clamped) * 180 / Math.PI;
    }

    normalizeAngles(angles) {
        const sum = angles.reduce((s, a) => s + a, 0);
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

    /**
     * ПОЛУЧИТЬ СТАТИСТИКУ АЛГОРИТМА
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * СБРОСИТЬ СТАТИСТИКУ
     */
    resetStats() {
        this.stats = {
            footprintsCreated: 0,
            comparisonsMade: 0,
            matchesFound: 0
        };
    }
}

module.exports = GeometricHashAlgorithm;
