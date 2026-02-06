// modules/footprint/clean/geometric-hash-algorithm.js
// 🎯 ТВОЙ РАБОЧИЙ ВЕКТОРНЫЙ АЛГОРИТМ (адаптирован для системы)

console.log('🎯 ГЕОМЕТРИЧЕСКИЙ ХЕШ-АЛГОРИТМ - ВЕКТОРНЫЙ ПОДХОД\n');

class GeometricHashAlgorithm {
    /**
     * КОНСТРУКТОР С ПАРАМЕТРАМИ
     * Все параметры работают в ВЕКТОРНОМ пространстве
     */
    constructor(options = {}) {
        // 🔗 ФИКСИРОВАННЫЕ СОСЕДИ (ключевая идея!)
        this.neighborOffsets = options.neighborOffsets || [-2, -1, 1, 2];

        // 📐 ДОПУСКИ (работают с углами, не с координатами!)
        this.angleTolerance = options.angleTolerance || 10;     // ±10 градусов
        this.hashPrecision = options.hashPrecision || 5;        // округление до 5°
        this.minSimilarity = options.minSimilarity || 0.3;      // 30% сходства для частичных
        this.minTriangles = options.minTriangles || 2;          // минимум 2 треугольника
        this.fixedThreshold = 0.6; // 🔥 ФИКСИРОВАННЫЙ ПОРОГ 60%!

        this.debug = options.debug !== false;
    }

    // ============================================
    // 🎯 ОСНОВНАЯ ФУНКЦИЯ: СОЗДАТЬ ГЕОМЕТРИЧЕСКИЙ ОТПЕЧАТОК
    // ============================================

    /**
     * СОЗДАТЬ ГЕОМЕТРИЧЕСКИЙ ОТПЕЧАТОК ДЛЯ НАБОРА ТОЧЕК
     * @param {Array} points - Массив точек [{x, y, id}]
     * @param {string} name - Имя отпечатка для отладки
     * @returns {Array} Геометрические дескрипторы точек
     */
    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`🎯 Создаю геометрический отпечаток "${name}" из ${points.length} точек`);
        }

        const footprint = [];
        const totalPoints = points.length;

        // ВАЖНО: Сохраняем оригинальные индексы!
        const indexedPoints = points.map((p, idx) => ({
            ...p,
            originalIndex: idx,
            originalId: p.id || `pt_${idx}`
        }));

        for (let i = 0; i < totalPoints; i++) {
            const point = indexedPoints[i];

            // 🔗 НАХОДИМ ФИКСИРОВАННЫХ СОСЕДЕЙ (по индексам!)
            const neighbors = this.findFixedNeighbors(i, indexedPoints);

            if (neighbors.length >= 2) {
                // 📐 СОЗДАЕМ ТРЕУГОЛЬНИКИ С ФИКСИРОВАННЫМИ СОСЕДЯМИ
                const triangles = this.createFixedTriangles(point, neighbors);

                if (triangles.length >= this.minTriangles) {
                    // 🎯 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЙ ДЕСКРИПТОР
                    const descriptor = this.createDescriptor(triangles);

                    footprint.push({
                        // ИДЕНТИФИКАТОРЫ (не меняются при трансформациях!)
                        id: point.id,
                        originalId: point.originalId,
                        originalIndex: point.originalIndex,

                        // КООРДИНАТЫ (векторные, без округления!)
                        x: point.x,
                        y: point.y,

                        // ГЕОМЕТРИЧЕСКАЯ ИНФОРМАЦИЯ
                        descriptor: descriptor,
                        triangles: triangles,
                        neighborIndices: neighbors.map(n => n.originalIndex),
                        triangleCount: triangles.length
                    });
                }
            }
        }

        if (this.debug) {
            console.log(`✅ Создан геометрический отпечаток: ${footprint.length} точек с дескрипторами`);
        }

        return footprint;
    }

    // ============================================
    // 🔗 ФИКСИРОВАННЫЕ СОСЕДИ (КЛЮЧЕВАЯ ФУНКЦИЯ!)
    // ============================================

    /**
     * НАЙТИ ФИКСИРОВАННЫХ СОСЕДЕЙ ДЛЯ ТОЧКИ
     * @param {number} centerIndex - Индекс центральной точки
     * @param {Array} allPoints - Все точки с индексами
     * @returns {Array} Соседи с фиксированными смещениями
     */
    findFixedNeighbors(centerIndex, allPoints) {
        const neighbors = [];
        const total = allPoints.length;

        // 🔑 КЛЮЧЕВАЯ ЛОГИКА: всегда используем ОДНИХ И ТЕХ ЖЕ соседей!
        for (const offset of this.neighborOffsets) {
            // Циклический индекс (для замкнутых фигур)
            const neighborIndex = (centerIndex + offset + total) % total;

            // Берем соседа, даже если он "далеко" по расстоянию!
            // Важны ИНДЕКСЫ, а не расстояния!
            if (neighborIndex !== centerIndex) {
                const neighbor = allPoints[neighborIndex];
                neighbors.push({
                    ...neighbor,
                    relativeIndex: offset // Сохраняем относительное смещение
                });
            }
        }

        return neighbors;
    }

    // ============================================
    // 📐 СОЗДАНИЕ ТРЕУГОЛЬНИКОВ (ВЕКТОРНАЯ ГЕОМЕТРИЯ)
    // ============================================

    /**
     * СОЗДАТЬ ТРЕУГОЛЬНИКИ С ФИКСИРОВАННЫМИ СОСЕДЯМИ
     * @param {Object} center - Центральная точка
     * @param {Array} neighbors - Соседи с фиксированными смещениями
     * @returns {Array} Массив треугольников
     */
    createFixedTriangles(center, neighbors) {
        const triangles = [];

        // Создаем треугольники со ВСЕМИ парами соседей
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const triangle = this.createTriangle(
                    center,
                    neighbors[i],
                    neighbors[j]
                );

                // Проверяем валидность треугольника
                if (triangle && this.isValidTriangle(triangle)) {
                    triangles.push(triangle);
                }
            }
        }

        return triangles;
    }

    /**
     * СОЗДАТЬ ОДИН ТРЕУГОЛЬНИК (векторные вычисления)
     */
    createTriangle(p1, p2, p3) {
        try {
            // 📐 ВЫЧИСЛЯЕМ УГЛЫ (векторная математика, без округления!)
            const angles = this.calculateAngles(p1, p2, p3);

            // 🔄 НОРМАЛИЗУЕМ И СОРТИРУЕМ углы
            const normalized = this.normalizeAngles(angles);
            const sorted = normalized.sort((a, b) => a - b);

            // 🔢 ОКРУГЛЯЕМ с учетом precision (для устойчивости к шуму)
            const rounded = sorted.map(angle => {
                if (this.hashPrecision > 0) {
                    return Math.round(angle / this.hashPrecision) * this.hashPrecision;
                }
                return Math.round(angle);
            });

            // 🔑 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЙ ХЕШ
            const hash = rounded.join('-');

            return {
                // Идентификаторы точек
                points: [p1.id, p2.id, p3.id],
                indices: [p1.originalIndex, p2.originalIndex, p3.originalIndex],

                // Геометрические характеристики
                angles: angles,              // Исходные углы
                normalizedAngles: sorted,    // Нормализованные
                roundedAngles: rounded,      // Округленные
                hash: hash,                  // Геометрический хеш

                // Векторные расстояния (для дополнительной проверки)
                distances: [
                    this.vectorDistance(p1, p2),
                    this.vectorDistance(p1, p3),
                    this.vectorDistance(p2, p3)
                ]
            };
        } catch (error) {
            // Если треугольник вырожденный - пропускаем
            return null;
        }
    }

    // ============================================
    // 🎯 СОЗДАНИЕ ДЕСКРИПТОРА (МНОГОУРОВНЕВЫЕ ХЕШИ)
    // ============================================

    /**
     * СОЗДАТЬ ГЕОМЕТРИЧЕСКИЙ ДЕСКРИПТОР ТОЧКИ
     * Используем МНОГОУРОВНЕВЫЕ хеши для гибкости
     */
    createDescriptor(triangles) {
        // Собираем хеши всех треугольников
        const triangleHashes = triangles.map(t => t.hash).sort();

        return {
            // 📊 РАЗНЫЕ УРОВНИ ХЕШЕЙ (для разных сценариев)
            hashes: {
                exact: triangleHashes.join('|'),      // Для точных совпадений
                rounded: this.createRoundedHash(triangleHashes), // Для шума
                signature: this.createSignature(triangles)      // Для быстрого сравнения
            },

            // 📈 СТАТИСТИКА
            triangleHashes: triangleHashes,
            triangleCount: triangles.length,
            avgAngle: this.calculateAverageAngle(triangles),

            // 🔍 ДЛЯ ДЕТАЛЬНОГО АНАЛИЗА
            triangles: triangles.map(t => ({
                hash: t.hash,
                angles: t.roundedAngles,
                indices: t.indices
            }))
        };
    }

    // ============================================
    // 🔄 СРАВНЕНИЕ ОТПЕЧАТКОВ (ГИБКИЙ ПОДХОД)
    // ============================================

    /**
     * СРАВНИТЬ ДВА ГЕОМЕТРИЧЕСКИХ ОТПЕЧАТКА
     * Возвращает схожесть 0-1
     */
    compareFootprints(fp1, fp2) {
        const matches = [];

        // 🔗 СОПОСТАВЛЯЕМ ПО ОРИГИНАЛЬНЫМ ИНДЕКСАМ
        // (одинаковые точки в исходной фигуре)
        const fp2ByOriginalId = new Map();
        fp2.forEach(p => fp2ByOriginalId.set(p.originalId, p));

        for (const point1 of fp1) {
            const point2 = fp2ByOriginalId.get(point1.originalId);

            if (point2) {
                // 🔄 СРАВНИВАЕМ ГЕОМЕТРИЧЕСКИЕ ДЕСКРИПТОРЫ
                const similarity = this.compareDescriptors(
                    point1.descriptor,
                    point2.descriptor
                );

                if (similarity >= this.minSimilarity) {
                    matches.push({
                        point1: point1,
                        point2: point2,
                        similarity: similarity
                    });
                }
            }
        }

        // 📊 ВЫЧИСЛЯЕМ ДВОЙНУЮ СТАТИСТИКУ
        const total1 = fp1.length;
        const total2 = fp2.length;
        const matched = matches.length;

        const percent1to2 = total1 > 0 ? (matched / total1) * 100 : 0;
        const percent2to1 = total2 > 0 ? (matched / total2) * 100 : 0;

        // 🔥 КЛЮЧЕВОЙ МОМЕНТ: Используем процент от первого ко второму
        const similarity = percent1to2 / 100;

        if (this.debug) {
            console.log(`📊 Результат сравнения:`);
            console.log(`   fp1 → fp2: ${percent1to2.toFixed(1)}% (${matched}/${total1})`);
            console.log(`   fp2 → fp1: ${percent2to1.toFixed(1)}% (${matched}/${total2})`);
            console.log(`   Схожесть для решения: ${similarity.toFixed(3)}`);
            console.log(`   Порог: ${this.fixedThreshold} (60%)`);
        }

        return {
            matches: matches,
            similarity: similarity,
            decision: similarity >= this.fixedThreshold ? 'same' : 'different',
            stats: {
                total1: total1,
                total2: total2,
                matched: matched,
                percent1to2: percent1to2.toFixed(1),
                percent2to1: percent2to1.toFixed(1)
            }
        };
    }

    /**
     * ПРОСТОЙ МЕТОД: Сравнить два набора точек напрямую
     */
    comparePoints(points1, points2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        // Создаём геометрические отпечатки
        const geo1 = this.createFootprint(points1, name1);
        const geo2 = this.createFootprint(points2, name2);

        // Сравниваем
        return this.compareFootprints(geo1, geo2);
    }

    // ============================================
    // 🔄 СРАВНЕНИЕ ДЕСКРИПТОРОВ (МНОГОУРОВНЕВОЕ)
    // ============================================

    /**
     * СРАВНИТЬ ДВА ГЕОМЕТРИЧЕСКИХ ДЕСКРИПТОРА
     * Используем несколько уровней сравнения
     */
    compareDescriptors(desc1, desc2) {
        if (!desc1 || !desc2) return 0;

        // 1. ✅ ТОЧНОЕ СОВПАДЕНИЕ (для поворота/масштаба)
        if (desc1.hashes.exact === desc2.hashes.exact) {
            return 1.0;
        }

        // 2. 🔄 ОКРУГЛЕННОЕ СОВПАДЕНИЕ (для шума)
        if (desc1.hashes.rounded === desc2.hashes.rounded) {
            return 0.9;
        }

        // 3. 🎯 СРАВНЕНИЕ СИГНАТУР (быстрое)
        const signatureScore = this.compareSignatures(
            desc1.hashes.signature,
            desc2.hashes.signature
        );

        // 4. 🔍 ДЕТАЛЬНОЕ СРАВНЕНИЕ ТРЕУГОЛЬНИКОВ
        const triangleScore = this.compareTriangleSets(
            desc1.triangleHashes,
            desc2.triangleHashes
        );

        // 📊 КОМБИНИРОВАННАЯ ОЦЕНКА
        return (signatureScore * 0.4 + triangleScore * 0.6);
    }

    /**
     * СРАВНИТЬ СИГНАТУРЫ
     */
    compareSignatures(sig1, sig2) {
        if (!sig1 || !sig2) return 0;
        if (sig1 === sig2) return 1.0;

        // Простое сравнение строк
        const parts1 = sig1.split('-').map(Number);
        const parts2 = sig2.split('-').map(Number);

        if (parts1.length !== parts2.length) return 0;

        let totalDiff = 0;
        for (let i = 0; i < parts1.length; i++) {
            totalDiff += Math.abs(parts1[i] - parts2[i]);
        }

        const avgDiff = totalDiff / parts1.length;
        return Math.max(0, 1 - (avgDiff / 180)); // 180° - максимальная разница
    }

    /**
     * СРАВНИТЬ НАБОРЫ ТРЕУГОЛЬНИКОВ
     */
    compareTriangleSets(hashes1, hashes2) {
        if (!hashes1 || !hashes2 || hashes1.length === 0 || hashes2.length === 0) {
            return 0;
        }

        let common = 0;
        for (const hash1 of hashes1) {
            for (const hash2 of hashes2) {
                if (this.hashesSimilar(hash1, hash2)) {
                    common++;
                    break;
                }
            }
        }

        return common / Math.min(hashes1.length, hashes2.length);
    }

    // ============================================
    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (ВЕКТОРНЫЕ!)
    // ============================================

    /**
     * ВЫЧИСЛИТЬ УГЛЫ ТРЕУГОЛЬНИКА (теорема косинусов)
     * ВЕКТОРНЫЕ вычисления, без округления координат!
     */
    calculateAngles(p1, p2, p3) {
        // Векторные расстояния (точные!)
        const a = this.vectorDistance(p2, p3);
        const b = this.vectorDistance(p1, p3);
        const c = this.vectorDistance(p1, p2);

        // Углы по теореме косинусов
        const angleA = this.cosineLawAngle(b, c, a);
        const angleB = this.cosineLawAngle(a, c, b);
        const angleC = this.cosineLawAngle(a, b, c);

        return [angleA, angleB, angleC];
    }

    /**
     * ВЕКТОРНОЕ РАССТОЯНИЕ (без Math.round!)
     */
    vectorDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * УГОЛ ПО ТЕОРЕМЕ КОСИНУСОВ
     */
    cosineLawAngle(side1, side2, opposite) {
        const cos = (side1 * side1 + side2 * side2 - opposite * opposite) / (2 * side1 * side2);
        const clamped = Math.max(-1, Math.min(1, cos));
        return Math.acos(clamped) * 180 / Math.PI;
    }

    /**
     * НОРМАЛИЗОВАТЬ УГЛЫ (сумма = 180°)
     */
    normalizeAngles(angles) {
        const sum = angles.reduce((s, a) => s + a, 0);
        if (sum === 0) return angles;
        return angles.map(a => a * 180 / sum);
    }

    /**
     * СОЗДАТЬ ОКРУГЛЕННЫЙ ХЕШ (для устойчивости к шуму)
     */
    createRoundedHash(triangleHashes) {
        return triangleHashes.map(hash => {
            return hash.split('-').map(angle => {
                const num = parseInt(angle);
                return Math.round(num / 10) * 10; // Округляем до 10°
            }).join('-');
        }).sort().join('|');
    }

    /**
     * СОЗДАТЬ КОМПАКТНУЮ СИГНАТУРУ
     */
    createSignature(triangles) {
        if (!triangles.length) return '';

        // Средние углы всех треугольников
        const avgAngles = [0, 0, 0];
        triangles.forEach(tri => {
            tri.roundedAngles.forEach((angle, i) => {
                avgAngles[i] += angle;
            });
        });

        return avgAngles.map(a =>
            Math.round(a / triangles.length)
        ).sort((a, b) => a - b).join('-');
    }

    /**
     * ПОХОЖИ ЛИ ХЕШИ (с допуском)
     */
    hashesSimilar(hash1, hash2) {
        if (hash1 === hash2) return true;

        const angles1 = hash1.split('-').map(Number);
        const angles2 = hash2.split('-').map(Number);

        if (angles1.length !== angles2.length) return false;

        for (let i = 0; i < angles1.length; i++) {
            if (Math.abs(angles1[i] - angles2[i]) > this.angleTolerance) {
                return false;
            }
        }

        return true;
    }

    /**
     * РАССЧИТАТЬ СРЕДНИЙ УГОЛ
     */
    calculateAverageAngle(triangles) {
        if (!triangles.length) return 0;

        let total = 0;
        triangles.forEach(tri => {
            tri.angles.forEach(angle => {
                total += angle;
            });
        });

        return total / (triangles.length * 3);
    }

    /**
     * ПРОВЕРИТЬ ВАЛИДНОСТЬ ТРЕУГОЛЬНИКА
     */
    isValidTriangle(triangle) {
        if (!triangle || !triangle.angles) return false;

        for (const angle of triangle.angles) {
            if (angle < 10 || angle > 170 || isNaN(angle)) {
                return false;
            }
        }

        return true;
    }
}

module.exports = GeometricHashAlgorithm;
