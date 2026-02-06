// modules/footprint/clean/geometric-hash-algorithm.js - ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ

console.log('🎯 ГЕОМЕТРИЧЕСКИЙ ХЕШ-АЛГОРИТМ - ИСПРАВЛЕННЫЙ ВАРИАНТ\n');

class GeometricHashAlgorithm {
    constructor(options = {}) {
        // 🔗 ФИКСИРОВАННЫЕ СОСЕДИ
        this.neighborOffsets = options.neighborOffsets || [-2, -1, 1, 2];
       
        // 📐 ПАРАМЕТРЫ СРАВНЕНИЯ
        this.angleTolerance = options.angleTolerance || 15;
        this.hashPrecision = options.hashPrecision || 5;
        this.minSimilarity = options.minSimilarity || 0.6; // 🔥 Повысили до 60%
        this.minTriangles = options.minTriangles || 2;
        this.similarityThreshold = 0.6; // Порог для решения
       
        // 🔥 НОВЫЕ ПАРАМЕТРЫ
        this.minMatchedPoints = options.minMatchedPoints || 3; // Минимум совпавших точек
        this.maxMatchDistance = options.maxMatchDistance || 0.7; // Макс расстояние между точками
       
        this.debug = options.debug !== false;
    }

    // ============================================
    // 🎯 СОЗДАНИЕ ГЕОМЕТРИЧЕСКОГО ОТПЕЧАТКА (ОСТАЁТСЯ ПРАВИЛЬНЫМ)
    // ============================================
   
    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`🎯 Создаю геометрический отпечаток "${name}" из ${points.length} точек`);
        }

        const footprint = [];
        const totalPoints = points.length;

        // Подготавливаем точки с индексами
        const indexedPoints = points.map((p, idx) => ({
            ...p,
            index: idx,
            originalId: p.originalId || `pt_${idx}`
        }));

        for (let i = 0; i < totalPoints; i++) {
            const point = indexedPoints[i];
           
            // Находим фиксированных соседей
            const neighbors = this.findFixedNeighbors(i, indexedPoints);
           
            if (neighbors.length >= 2) {
                // Создаем треугольники
                const triangles = this.createFixedTriangles(point, neighbors);
               
                if (triangles.length >= this.minTriangles) {
                    // Создаем дескриптор
                    const descriptor = this.createDescriptor(triangles);
                   
                    footprint.push({
                        id: point.id || `pt_${i}`,
                        originalId: point.originalId,
                        index: i,
                        x: point.x,
                        y: point.y,
                        descriptor: descriptor,
                        triangles: triangles,
                        neighborIndices: neighbors.map(n => n.index),
                        triangleCount: triangles.length
                    });
                }
            }
        }

        if (this.debug && footprint.length > 0) {
            console.log(`✅ Создан отпечаток: ${footprint.length} точек`);
        }

        return footprint;
    }

    // ============================================
    // 🔄 СРАВНЕНИЕ ОТПЕЧАТКОВ - ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ МЕТОД!
    // ============================================
   
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        if (this.debug) {
            console.log(`\n🔍 СРАВНЕНИЕ: ${name1} (${fp1.length} точек) vs ${name2} (${fp2.length} точек)`);
        }

        // 🔥 ПРАВИЛЬНЫЙ ПОДХОД: Сравниваем геометрические дескрипторы
        // 1. Создаем матрицу схожести между всеми точками
        const similarityMatrix = [];
       
        for (let i = 0; i < fp1.length; i++) {
            similarityMatrix[i] = [];
            for (let j = 0; j < fp2.length; j++) {
                const similarity = this.compareDescriptors(
                    fp1[i].descriptor,
                    fp2[j].descriptor
                );
                similarityMatrix[i][j] = similarity;
            }
        }

        // 2. Находим наилучшие соответствия (жадный алгоритм)
        const matches = [];
        const used1 = new Set();
        const used2 = new Set();
       
        // Сортируем все возможные пары по убыванию схожести
        const allPairs = [];
        for (let i = 0; i < fp1.length; i++) {
            for (let j = 0; j < fp2.length; j++) {
                if (similarityMatrix[i][j] >= this.minSimilarity) {
                    allPairs.push({
                        i, j,
                        similarity: similarityMatrix[i][j]
                    });
                }
            }
        }
       
        // Сортируем по убыванию схожести
        allPairs.sort((a, b) => b.similarity - a.similarity);
       
        // Берем наилучшие непересекающиеся пары
        for (const pair of allPairs) {
            if (!used1.has(pair.i) && !used2.has(pair.j)) {
                matches.push({
                    point1: fp1[pair.i],
                    point2: fp2[pair.j],
                    similarity: pair.similarity
                });
                used1.add(pair.i);
                used2.add(pair.j);
            }
        }

        // 3. Вычисляем статистику ПРАВИЛЬНО
        const matched = matches.length;
        const total1 = fp1.length;
        const total2 = fp2.length;
       
        // 🔥 ПРАВИЛЬНЫЕ ПРОЦЕНТЫ: сколько точек из первого нашли пару во втором
        const percent1to2 = total1 > 0 ? (matched / total1) * 100 : 0;
        const percent2to1 = total2 > 0 ? (matched / total2) * 100 : 0;
       
        // 🔥 КЛЮЧЕВОЙ МОМЕНТ: схожесть = процент совпавших точек из первого следа
        const similarity = percent1to2 / 100;

        if (this.debug) {
            console.log(`📊 РЕЗУЛЬТАТЫ:`);
            console.log(`   Найдено пар: ${matched}`);
            console.log(`   ${name1} → ${name2}: ${percent1to2.toFixed(1)}% (${matched}/${total1})`);
            console.log(`   ${name2} → ${name1}: ${percent2to1.toFixed(1)}% (${matched}/${total2})`);
            console.log(`   Общая схожесть: ${similarity.toFixed(3)}`);
            console.log(`   Порог для решения: ${this.similarityThreshold}`);
           
            if (matches.length > 0) {
                console.log(`\n🔬 ЛУЧШИЕ СОВПАДЕНИЯ:`);
                matches.slice(0, 3).forEach((match, idx) => {
                    console.log(`   ${idx + 1}. ${match.point1.originalId} ↔ ${match.point2.originalId}: ${match.similarity.toFixed(3)}`);
                });
            }
        }

        // 4. Принимаем решение
        const decision = (matched >= this.minMatchedPoints && similarity >= this.similarityThreshold)
            ? 'same'
            : 'different';

        return {
            matches: matches,
            similarity: similarity,
            decision: decision,
            stats: {
                total1: total1,
                total2: total2,
                matched: matched,
                percent1to2: percent1to2.toFixed(1),
                percent2to1: percent2to1.toFixed(1)
            }
        };
    }
   
    // ============================================
    // 🔄 СРАВНЕНИЕ ДЕСКРИПТОРОВ - ИСПРАВЛЕННЫЙ
    // ============================================
   
    compareDescriptors(desc1, desc2) {
        if (!desc1 || !desc2) return 0;
       
        // 1. Проверяем точное совпадение хешей
        if (desc1.hashes.exact === desc2.hashes.exact) {
            return 1.0;
        }
       
        // 2. Проверяем округленные хеши
        if (desc1.hashes.rounded === desc2.hashes.rounded) {
            return 0.9;
        }
       
        // 3. Сравниваем сигнатуры
        const signatureScore = this.compareSignatures(
            desc1.hashes.signature,
            desc2.hashes.signature
        );
       
        // 4. Сравниваем наборы треугольников
        const triangleScore = this.compareTriangleHashes(
            desc1.triangleHashes,
            desc2.triangleHashes
        );
       
        // 5. Учитываем количество треугольников
        const countScore = 1 - Math.abs(desc1.triangleCount - desc2.triangleCount) /
            Math.max(desc1.triangleCount, desc2.triangleCount);
       
        // 🔥 ВЕСОВЫЕ КОЭФФИЦИЕНТЫ (настроены эмпирически)
        const finalScore =
            signatureScore * 0.3 +
            triangleScore * 0.5 +
            countScore * 0.2;
       
        // 🔥 ОГРАНИЧИВАЕМ от 0 до 1
        return Math.max(0, Math.min(1, finalScore));
    }
   
    compareSignatures(sig1, sig2) {
        if (!sig1 || !sig2 || sig1 === '' || sig2 === '') return 0;
        if (sig1 === sig2) return 1.0;
       
        const angles1 = sig1.split('-').map(Number);
        const angles2 = sig2.split('-').map(Number);
       
        if (angles1.length !== angles2.length) return 0;
       
        let totalDiff = 0;
        for (let i = 0; i < angles1.length; i++) {
            totalDiff += Math.abs(angles1[i] - angles2[i]);
        }
       
        const avgDiff = totalDiff / angles1.length;
        // Преобразуем разницу в оценку от 0 до 1
        return Math.max(0, 1 - (avgDiff / 90)); // 90° - максимальная средняя разница
    }
   
    compareTriangleHashes(hashes1, hashes2) {
        if (!hashes1 || !hashes2 || hashes1.length === 0 || hashes2.length === 0) {
            return 0;
        }
       
        // Находим общие хеши (с допуском)
        const set2 = new Set(hashes2);
        let common = 0;
       
        for (const hash1 of hashes1) {
            // Ищем похожий хеш во втором наборе
            for (const hash2 of hashes2) {
                if (this.hashesSimilar(hash1, hash2)) {
                    common++;
                    break;
                }
            }
        }
       
        // Нормализуем по меньшему набору
        const minCount = Math.min(hashes1.length, hashes2.length);
        return minCount > 0 ? common / minCount : 0;
    }
   
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

    // ============================================
    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (остаются без изменений)
    // ============================================
   
    findFixedNeighbors(centerIndex, allPoints) {
        const neighbors = [];
        const total = allPoints.length;
       
        for (const offset of this.neighborOffsets) {
            const neighborIndex = (centerIndex + offset + total) % total;
           
            if (neighborIndex !== centerIndex) {
                const neighbor = allPoints[neighborIndex];
                neighbors.push({
                    ...neighbor,
                    relativeIndex: offset
                });
            }
        }
       
        return neighbors;
    }
   
    createFixedTriangles(center, neighbors) {
        const triangles = [];
       
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const triangle = this.createTriangle(
                    center,
                    neighbors[i],
                    neighbors[j]
                );
               
                if (triangle && this.isValidTriangle(triangle)) {
                    triangles.push(triangle);
                }
            }
        }
       
        return triangles;
    }
   
    createTriangle(p1, p2, p3) {
        try {
            const angles = this.calculateAngles(p1, p2, p3);
            const normalized = this.normalizeAngles(angles);
            const sorted = normalized.sort((a, b) => a - b);
           
            const rounded = sorted.map(angle => {
                if (this.hashPrecision > 0) {
                    return Math.round(angle / this.hashPrecision) * this.hashPrecision;
                }
                return Math.round(angle);
            });
           
            const hash = rounded.join('-');
           
            return {
                points: [p1.originalId, p2.originalId, p3.originalId],
                indices: [p1.index, p2.index, p3.index],
                angles: angles,
                normalizedAngles: sorted,
                roundedAngles: rounded,
                hash: hash
            };
        } catch (error) {
            return null;
        }
    }
   
    createDescriptor(triangles) {
        const triangleHashes = triangles.map(t => t.hash).sort();
       
        return {
            hashes: {
                exact: triangleHashes.join('|'),
                rounded: this.createRoundedHash(triangleHashes),
                signature: this.createSignature(triangles)
            },
            triangleHashes: triangleHashes,
            triangleCount: triangles.length,
            avgAngle: this.calculateAverageAngle(triangles)
        };
    }
   
    calculateAngles(p1, p2, p3) {
        const a = this.vectorDistance(p2, p3);
        const b = this.vectorDistance(p1, p3);
        const c = this.vectorDistance(p1, p2);
       
        const angleA = this.cosineLawAngle(b, c, a);
        const angleB = this.cosineLawAngle(a, c, b);
        const angleC = this.cosineLawAngle(a, b, c);
       
        return [angleA, angleB, angleC];
    }
   
    vectorDistance(p1, p2) {
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
        if (sum === 0) return angles;
        return angles.map(a => a * 180 / sum);
    }
   
    createRoundedHash(triangleHashes) {
        return triangleHashes.map(hash => {
            return hash.split('-').map(angle => {
                const num = parseInt(angle);
                return Math.round(num / 10) * 10;
            }).join('-');
        }).sort().join('|');
    }
   
    createSignature(triangles) {
        if (!triangles.length) return '';
       
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
   
    isValidTriangle(triangle) {
        if (!triangle || !triangle.angles) return false;
       
        for (const angle of triangle.angles) {
            if (angle < 10 || angle > 170 || isNaN(angle)) {
                return false;
            }
        }
       
        return true;
    }
   
    // 🔥 НОВЫЙ МЕТОД: Прямое сравнение точек
    comparePoints(points1, points2, name1 = 'След 1', name2 = 'След 2') {
        console.log(`\n🔍 ПРЯМОЕ СРАВНЕНИЕ: ${name1} vs ${name2}`);
       
        // Создаем геометрические отпечатки
        const geo1 = this.createFootprint(points1, name1);
        const geo2 = this.createFootprint(points2, name2);
       
        // Сравниваем
        return this.compareFootprints(geo1, geo2, name1, name2);
    }
}

module.exports = GeometricHashAlgorithm;
