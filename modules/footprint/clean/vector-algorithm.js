// modules/footprint/clean/vector-algorithm.js
// 🎯 ВЕКТОРНЫЙ АЛГОРИТМ - ГЕОМЕТРИЧЕСКИЕ ПАСПОРТА

console.log('🎯 ВЕКТОРНЫЙ АЛГОРИТМ - ГЕОМЕТРИЧЕСКИЕ ПАСПОРТА\n');

class VectorAlgorithm {
    constructor(options = {}) {
        // 🔥 КЛЮЧЕВЫЕ ПАРАМЕТРЫ
        this.neighborCount = options.neighborCount || 3;     // Сколько соседей анализировать
        this.anglePrecision = options.anglePrecision || 5;   // Округление углов (градусы)
        this.distancePrecision = options.distancePrecision || 10; // Округление расстояний
        this.minSimilarity = options.minSimilarity || 0.6;   // Минимальная схожесть
        this.debug = options.debug !== false;
       
        // 🔥 СТАТИСТИКА
        this.stats = {
            passportsCreated: 0,
            comparisonsMade: 0,
            matchesFound: 0
        };
    }

    // ============================================
    // 🎯 СОЗДАНИЕ ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ
    // ============================================

    /**
     * СОЗДАТЬ ГЕОМЕТРИЧЕСКИЕ ПАСПОРТА ИЗ ТОЧЕК
     */
    createGeometricPassports(points, sourceId = '') {
        if (this.debug) {
            console.log(`🎯 Создаю геометрические паспорта из ${points.length} точек`);
        }

        this.stats.passportsCreated += points.length;

        // Преобразуем точки в формат с индексами
        const indexedPoints = points.map((point, idx) => ({
            ...point,
            index: idx,
            originalId: point.id || `pt_${sourceId}_${idx}`
        }));

        // Создаем паспорт для каждой точки
        const passports = [];

        for (let i = 0; i < indexedPoints.length; i++) {
            const point = indexedPoints[i];
           
            // Находим ближайших соседей
            const neighbors = this.findNearestNeighbors(point, indexedPoints, i, this.neighborCount);
           
            if (neighbors.length >= 2) {
                const passport = this.createPointPassport(point, neighbors);
                passports.push(passport);
            } else {
                // Для точек с <2 соседей создаем простой паспорт
                const simplePassport = this.createSimplePassport(point, neighbors);
                passports.push(simplePassport);
            }
        }

        if (this.debug) {
            console.log(`✅ Создано ${passports.length} геометрических паспортов`);
        }

        return passports;
    }

    /**
     * СОЗДАТЬ ПАСПОРТ ТОЧКИ
     */
    createPointPassport(centerPoint, neighbors) {
        // 1. Вычисляем углы между соседями
        const angles = this.calculateAnglesBetweenNeighbors(centerPoint, neighbors);
       
        // 2. Вычисляем расстояния до соседей
        const distances = this.calculateDistances(centerPoint, neighbors);
       
        // 3. Создаем геометрический хеш
        const geometricHash = this.createGeometricHash(angles, distances);
       
        // 4. Определяем тип паттерна
        const patternType = this.determinePatternType(angles, distances);
       
        // 5. Создаем паспорт
        const passport = {
            // 🔥 ИДЕНТИФИКАЦИЯ
            pointId: centerPoint.originalId,
            coordinates: { x: centerPoint.x, y: centerPoint.y },
           
            // 🔥 ГЕОМЕТРИЧЕСКИЕ ХАРАКТЕРИСТИКИ
            geometricHash: geometricHash,
            angles: angles,
            distances: distances,
           
            // 🔥 ПАТТЕРН
            patternType: patternType,
            neighborCount: neighbors.length,
           
            // 🔥 ДЛЯ СОВМЕСТИМОСТИ
            hash: geometricHash, // синоним для совместимости
            triangles: this.createTriangles(centerPoint, neighbors),
           
            // 🔥 МЕТАДАННЫЕ
            createdAt: new Date(),
            source: 'vector_algorithm'
        };

        return passport;
    }

    /**
     * СОЗДАТЬ ПРОСТОЙ ПАСПОРТ (для точек с <2 соседей)
     */
    createSimplePassport(centerPoint, neighbors) {
        const distances = this.calculateDistances(centerPoint, neighbors);
        const avgDistance = distances.length > 0 ?
            distances.reduce((sum, d) => sum + d, 0) / distances.length : 0;
       
        const hash = `SIMPLE_${centerPoint.index}_D${Math.round(avgDistance / this.distancePrecision)}`;
       
        return {
            pointId: centerPoint.originalId,
            coordinates: { x: centerPoint.x, y: centerPoint.y },
            geometricHash: hash,
            angles: [],
            distances: distances,
            patternType: 'simple',
            neighborCount: neighbors.length,
            hash: hash,
            triangles: [],
            createdAt: new Date(),
            source: 'vector_algorithm_simple'
        };
    }

    /**
     * НАЙТИ БЛИЖАЙШИХ СОСЕДЕЙ
     */
    findNearestNeighbors(centerPoint, allPoints, centerIndex, count) {
        const distances = [];

        for (let i = 0; i < allPoints.length; i++) {
            if (i === centerIndex) continue;

            const point = allPoints[i];
            const distance = this.calculateDistance(centerPoint, point);
           
            distances.push({
                point: point,
                distance: distance,
                index: i
            });
        }

        // Сортируем по расстоянию
        distances.sort((a, b) => a.distance - b.distance);
       
        // Берем ближайших
        return distances.slice(0, count).map(d => d.point);
    }

    /**
     * ВЫЧИСЛИТЬ УГЛЫ МЕЖДУ СОСЕДЯМИ
     */
    calculateAnglesBetweenNeighbors(centerPoint, neighbors) {
        const angles = [];

        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const angle = this.calculateAngle(
                    centerPoint,
                    neighbors[i],
                    neighbors[j]
                );
                angles.push(angle);
            }
        }

        // Сортируем углы
        angles.sort((a, b) => a - b);
       
        // Округляем
        return angles.map(angle =>
            Math.round(angle / this.anglePrecision) * this.anglePrecision
        );
    }

    /**
     * ВЫЧИСЛИТЬ РАССТОЯНИЯ ДО СОСЕДЕЙ
     */
    calculateDistances(centerPoint, neighbors) {
        return neighbors.map(neighbor =>
            Math.round(this.calculateDistance(centerPoint, neighbor) / this.distancePrecision) * this.distancePrecision
        ).sort((a, b) => a - b);
    }

    /**
     * СОЗДАТЬ ГЕОМЕТРИЧЕСКИЙ ХЕШ
     */
    createGeometricHash(angles, distances) {
        const anglePart = angles.map(a => `A${a}`).join('_');
        const distancePart = distances.map(d => `D${d}`).join('_');
        const hash = `GEO_${anglePart}_${distancePart}`;
       
        // Ограничиваем длину хеша
        return hash.length > 100 ? hash.substring(0, 100) : hash;
    }

    /**
     * ОПРЕДЕЛИТЬ ТИП ПАТТЕРНА
     */
    determinePatternType(angles, distances) {
        if (angles.length === 0) return 'single_point';
       
        // Проверяем на равносторонний треугольник
        if (angles.length >= 3) {
            const isEquilateral = angles.every(angle =>
                Math.abs(angle - 60) < (this.anglePrecision * 2)
            );
            if (isEquilateral) return 'equilateral_triangle';
        }
       
        // Проверяем на прямоугольный треугольник
        const hasRightAngle = angles.some(angle =>
            Math.abs(angle - 90) < (this.anglePrecision * 2)
        );
        if (hasRightAngle) return 'right_triangle';
       
        // Проверяем на изолированную точку
        if (distances.length < 2) return 'isolated_point';
       
        // Проверяем на линейный паттерн
        const allAnglesSmall = angles.every(angle => angle < 30);
        if (allAnglesSmall) return 'linear_pattern';
       
        // Проверяем на кластер
        const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        const isDense = distances.every(d => d < avgDistance * 0.5);
        if (isDense) return 'dense_cluster';
       
        return 'complex_pattern';
    }

    /**
     * СОЗДАТЬ ТРЕУГОЛЬНИКИ (для совместимости)
     */
    createTriangles(centerPoint, neighbors) {
        const triangles = [];
       
        if (neighbors.length >= 2) {
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    const triangle = {
                        points: [
                            centerPoint.originalId,
                            neighbors[i].originalId,
                            neighbors[j].originalId
                        ],
                        angles: this.calculateTriangleAngles(centerPoint, neighbors[i], neighbors[j])
                    };
                    triangles.push(triangle);
                }
            }
        }
       
        return triangles;
    }

    // ============================================
    // 🔄 СРАВНЕНИЕ ПАСПОРТОВ
    // ============================================

    /**
     * СРАВНИТЬ ДВА НАБОРА ПАСПОРТОВ
     */
    comparePassports(passports1, passports2, options = {}) {
        if (this.debug) {
            console.log(`🔍 Сравниваю ${passports1.length} vs ${passports2.length} паспортов`);
        }

        this.stats.comparisonsMade++;

        const minSimilarity = options.minSimilarity || this.minSimilarity;
        const matches = [];
       
        // Создаем индекс хешей для второго набора
        const hashIndex = new Map();
        passports2.forEach(passport => {
            if (passport.geometricHash) {
                if (!hashIndex.has(passport.geometricHash)) {
                    hashIndex.set(passport.geometricHash, []);
                }
                hashIndex.get(passport.geometricHash).push(passport);
            }
        });

        // Ищем совпадения по хешам
        passports1.forEach(passport1 => {
            if (!passport1.geometricHash) return;
           
            const matchingPassports = hashIndex.get(passport1.geometricHash) || [];
           
            for (const passport2 of matchingPassports) {
                // Дополнительная проверка геометрического сходства
                const similarity = this.calculatePassportSimilarity(passport1, passport2);
               
                if (similarity >= minSimilarity) {
                    matches.push({
                        passport1: passport1,
                        passport2: passport2,
                        similarity: similarity,
                        hash: passport1.geometricHash,
                        patternType: passport1.patternType
                    });
                    break;
                }
            }
        });

        this.stats.matchesFound += matches.length;

        // Создаем результат сравнения
        return this.createComparisonResult(passports1, passports2, matches, options);
    }

    /**
     * ВЫЧИСЛИТЬ СХОДСТВО ДВУХ ПАСПОРТОВ
     */
    calculatePassportSimilarity(passport1, passport2) {
        if (passport1.geometricHash === passport2.geometricHash) return 1.0;
       
        let similarity = 0;
       
        // Сравниваем углы
        const angleSimilarity = this.compareAngles(passport1.angles, passport2.angles);
        similarity += angleSimilarity * 0.4;
       
        // Сравниваем расстояния
        const distanceSimilarity = this.compareDistances(passport1.distances, passport2.distances);
        similarity += distanceSimilarity * 0.3;
       
        // Сравниваем типы паттернов
        if (passport1.patternType === passport2.patternType) {
            similarity += 0.3;
        }
       
        return similarity;
    }

    /**
     * СОЗДАТЬ РЕЗУЛЬТАТ СРАВНЕНИЯ
     */
    createComparisonResult(passports1, passports2, matches, options) {
        const total1 = passports1.length;
        const total2 = passports2.length;
        const matched = matches.length;
       
        const percent1to2 = total1 > 0 ? (matched / total1 * 100).toFixed(1) : '0.0';
        const percent2to1 = total2 > 0 ? (matched / total2 * 100).toFixed(1) : '0.0';
       
        const avgSimilarity = matches.length > 0 ?
            (matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length).toFixed(3) : 0;
       
        const similarity = matched / Math.max(total1, total2);
        const isSame = similarity >= (options.minSimilarity || this.minSimilarity);
       
        return {
            matches: matches,
            similarity: similarity,
            isSame: isSame,
            decision: isSame ? 'same' : 'different',
            stats: {
                totalPassports1: total1,
                totalPassports2: total2,
                matchedPassports: matched,
                percent1to2: percent1to2,
                percent2to1: percent2to1,
                avgSimilarity: parseFloat(avgSimilarity)
            },
            metadata: {
                algorithm: 'geometric_passports',
                timestamp: new Date(),
                minSimilarity: options.minSimilarity || this.minSimilarity
            }
        };
    }

    // ============================================
    // 📏 МАТЕМАТИЧЕСКИЕ ФУНКЦИИ
    // ============================================

    calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    calculateAngle(center, p1, p2) {
        const v1 = { x: p1.x - center.x, y: p1.y - center.y };
        const v2 = { x: p2.x - center.x, y: p2.y - center.y };
       
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
       
        if (mag1 === 0 || mag2 === 0) return 0;
       
        const cos = dot / (mag1 * mag2);
        const clamped = Math.max(-1, Math.min(1, cos));
        return Math.acos(clamped) * 180 / Math.PI;
    }

    calculateTriangleAngles(p1, p2, p3) {
        const a = this.calculateDistance(p2, p3);
        const b = this.calculateDistance(p1, p3);
        const c = this.calculateDistance(p1, p2);
       
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

    compareAngles(angles1, angles2) {
        if (angles1.length === 0 && angles2.length === 0) return 1.0;
        if (angles1.length === 0 || angles2.length === 0) return 0;
       
        const minLen = Math.min(angles1.length, angles2.length);
        let sum = 0;
       
        for (let i = 0; i < minLen; i++) {
            const diff = Math.abs(angles1[i] - angles2[i]);
            sum += 1 - Math.min(1, diff / 30); // 30° максимальная разница
        }
       
        return sum / minLen;
    }

    compareDistances(distances1, distances2) {
        if (distances1.length === 0 && distances2.length === 0) return 1.0;
        if (distances1.length === 0 || distances2.length === 0) return 0;
       
        const minLen = Math.min(distances1.length, distances2.length);
        let sum = 0;
       
        for (let i = 0; i < minLen; i++) {
            const maxDist = Math.max(distances1[i], distances2[i]);
            if (maxDist === 0) {
                sum += 1;
            } else {
                const diff = Math.abs(distances1[i] - distances2[i]);
                sum += 1 - Math.min(1, diff / maxDist);
            }
        }
       
        return sum / minLen;
    }

    // ============================================
    // 📊 СОВМЕСТИМОСТЬ СО СТАРЫМ ИНТЕРФЕЙСОМ
    // ============================================

    /**
     * ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
     */
    createFootprint(points, name = '') {
        return this.createGeometricPassports(points, name);
    }

    /**
     * ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
     */
    compareFootprints(fp1, fp2, options = {}) {
        return this.comparePassports(fp1, fp2, options);
    }

    /**
     * ПОЛУЧИТЬ СТАТИСТИКУ
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * СБРОСИТЬ СТАТИСТИКУ
     */
    resetStats() {
        this.stats = {
            passportsCreated: 0,
            comparisonsMade: 0,
            matchesFound: 0
        };
    }
}

module.exports = VectorAlgorithm;
