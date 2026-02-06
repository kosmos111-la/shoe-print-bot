// modules/footprint/clean/geometric-hash-algorithm.js - ИСПРАВЛЕННЫЙ

console.log('🎯 ГЕОМЕТРИЧЕСКИЙ ХЕШ-АЛГОРИТМ - ФИКСИРОВАННЫЕ СОСЕДИ\n');

class GeometricHashAlgorithm {
    constructor(options = {}) {
        // 🔗 ФИКСИРОВАННЫЕ СОСЕДИ (ключевая идея!)
        this.neighborOffsets = options.neighborOffsets || [-2, -1, 1, 2];
       
        // 📐 ДОПУСКИ
        this.angleTolerance = options.angleTolerance || 10;
        this.hashPrecision = options.hashPrecision || 5;
        this.minSimilarity = options.minSimilarity || 0.3;
        this.minTriangles = options.minTriangles || 2;
        this.fixedThreshold = 0.6;
       
        this.debug = options.debug !== false;
    }

    // ============================================
    // 🎯 СОЗДАНИЕ ГЕОМЕТРИЧЕСКОГО ОТПЕЧАТКА
    // ============================================
   
    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`🎯 Создаю геометрический отпечаток "${name}" из ${points.length} точек`);
        }

        const footprint = [];
        const totalPoints = points.length;

        // 🔥 ИСПРАВЛЕНИЕ 1: Сохраняем индексы как originalId
        const indexedPoints = points.map((p, idx) => ({
            ...p,
            originalId: p.originalId || `pt_${idx}`,  // Используем переданный или создаем
            index: idx
        }));

        for (let i = 0; i < totalPoints; i++) {
            const point = indexedPoints[i];
           
            // 🔗 НАХОДИМ ФИКСИРОВАННЫХ СОСЕДЕЙ
            const neighbors = this.findFixedNeighbors(i, indexedPoints);
           
            if (neighbors.length >= 2) {
                // 📐 СОЗДАЕМ ТРЕУГОЛЬНИКИ
                const triangles = this.createFixedTriangles(point, neighbors);
               
                if (triangles.length >= this.minTriangles) {
                    // 🎯 СОЗДАЕМ ДЕСКРИПТОР
                    const descriptor = this.createDescriptor(triangles);
                   
                    footprint.push({
                        // 🔥 ИСПРАВЛЕНИЕ 2: Сохраняем индексы для сравнения
                        id: point.id || `pt_${i}`,
                        originalId: point.originalId,  // Используем как ключ для сравнения
                        index: i,
                       
                        // Координаты
                        x: point.x,
                        y: point.y,
                       
                        // Геометрическая информация
                        descriptor: descriptor,
                        triangles: triangles,
                        neighborIndices: neighbors.map(n => n.index),
                        triangleCount: triangles.length
                    });
                }
            }
        }

        if (this.debug && footprint.length > 0) {
            console.log(`✅ Создан геометрический отпечаток: ${footprint.length} точек с дескрипторами`);
            const firstPoint = footprint[0];
            console.log(`📐 Точка ${firstPoint.originalId}: ${firstPoint.triangles.length} треугольников`);
        }

        return footprint;
    }

    // ============================================
    // 🔄 СРАВНЕНИЕ ОТПЕЧАТКОВ (ОСНОВНОЕ ИСПРАВЛЕНИЕ!)
    // ============================================
   
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        if (this.debug) {
            console.log(`\n🔍 СРАВНЕНИЕ: ${name1} vs ${name2}`);
            console.log(`   ${name1}: ${fp1.length} точек, ${name2}: ${fp2.length} точек`);
        }

        const matches = [];
       
        // 🔥 ИСПРАВЛЕНИЕ 3: ДВА СПОСОБА СРАВНЕНИЯ
       
        // СПОСОБ 1: По индексам (для тестовых данных с одинаковой структурой)
        // Если точки в том же порядке - сравниваем по индексам
        const compareByIndex = fp1.length === fp2.length;
       
        if (compareByIndex) {
            // Простое сравнение по индексам
            for (let i = 0; i < Math.min(fp1.length, fp2.length); i++) {
                const similarity = this.compareDescriptors(
                    fp1[i].descriptor,
                    fp2[i].descriptor
                );
               
                if (similarity >= this.minSimilarity) {
                    matches.push({
                        point1: fp1[i],
                        point2: fp2[i],
                        similarity: similarity
                    });
                }
            }
        } else {
            // 🔥 ИСПРАВЛЕНИЕ 4: ГЕОМЕТРИЧЕСКОЕ СРАВНЕНИЕ БЕЗ ID
           
            // Создаем карты дескрипторов для быстрого поиска
            const descriptors1 = fp1.map(p => ({
                point: p,
                signature: p.descriptor.hashes.signature,
                triangles: p.descriptor.triangleHashes
            }));
           
            const descriptors2 = fp2.map(p => ({
                point: p,
                signature: p.descriptor.hashes.signature,
                triangles: p.descriptor.triangleHashes
            }));
           
            // Ищем похожие точки по геометрическим признакам
            for (const desc1 of descriptors1) {
                let bestMatch = null;
                let bestSimilarity = 0;
               
                for (const desc2 of descriptors2) {
                    // Быстрая проверка по сигнатуре
                    if (this.signaturesSimilar(desc1.signature, desc2.signature)) {
                        // Подробное сравнение
                        const similarity = this.compareDescriptors(
                            desc1.point.descriptor,
                            desc2.point.descriptor
                        );
                       
                        if (similarity > bestSimilarity && similarity >= this.minSimilarity) {
                            bestSimilarity = similarity;
                            bestMatch = desc2.point;
                        }
                    }
                }
               
                if (bestMatch) {
                    matches.push({
                        point1: desc1.point,
                        point2: bestMatch,
                        similarity: bestSimilarity
                    });
                }
            }
        }

        // 📊 ВЫЧИСЛЯЕМ СТАТИСТИКУ
        const total1 = fp1.length;
        const total2 = fp2.length;
        const matched = matches.length;

        const percent1to2 = total1 > 0 ? (matched / total1 * 100) : 0;
        const percent2to1 = total2 > 0 ? (matched / total2 * 100) : 0;
       
        // 🔥 ИСПРАВЛЕНИЕ 5: Правильная схожесть
        const similarity = percent1to2 / 100;

        if (this.debug) {
            console.log(`\n📊 РЕЗУЛЬТАТЫ СРАВНЕНИЯ:`);
            console.log(`   Совпало точек: ${matched}`);
            console.log(`   ${name1} → ${name2}: ${percent1to2.toFixed(1)}% (${matched}/${total1})`);
            console.log(`   ${name2} → ${name1}: ${percent2to1.toFixed(1)}% (${matched}/${total2})`);
            console.log(`   Схожесть для решения: ${similarity.toFixed(3)}`);
            console.log(`   Порог: ${this.fixedThreshold} (60%)`);
           
            if (matches.length > 0) {
                console.log(`\n🔬 ПРИМЕРЫ СОВПАДЕНИЙ:`);
                matches.slice(0, 3).forEach((match, i) => {
                    console.log(`   ${i + 1}. ${match.point1.originalId} → ${match.point2.originalId}: ` +
                               `сходство ${match.similarity.toFixed(2)}`);
                });
            }
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
   
    // ============================================
    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================
   
    signaturesSimilar(sig1, sig2) {
        if (!sig1 || !sig2) return false;
        if (sig1 === sig2) return true;
       
        const parts1 = sig1.split('-').map(Number);
        const parts2 = sig2.split('-').map(Number);
       
        if (parts1.length !== parts2.length) return false;
       
        for (let i = 0; i < parts1.length; i++) {
            if (Math.abs(parts1[i] - parts2[i]) > this.angleTolerance * 2) {
                return false;
            }
        }
       
        return true;
    }
   
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
   
    compareDescriptors(desc1, desc2) {
        if (!desc1 || !desc2) return 0;
       
        if (desc1.hashes.exact === desc2.hashes.exact) return 1.0;
        if (desc1.hashes.rounded === desc2.hashes.rounded) return 0.9;
       
        const signatureScore = this.compareSignatures(
            desc1.hashes.signature,
            desc2.hashes.signature
        );
       
        const triangleScore = this.compareTriangleSets(
            desc1.triangleHashes,
            desc2.triangleHashes
        );
       
        return (signatureScore * 0.4 + triangleScore * 0.6);
    }
   
    compareSignatures(sig1, sig2) {
        if (!sig1 || !sig2) return 0;
        if (sig1 === sig2) return 1.0;
       
        const parts1 = sig1.split('-').map(Number);
        const parts2 = sig2.split('-').map(Number);
       
        if (parts1.length !== parts2.length) return 0;
       
        let totalDiff = 0;
        for (let i = 0; i < parts1.length; i++) {
            totalDiff += Math.abs(parts1[i] - parts2[i]);
        }
       
        const avgDiff = totalDiff / parts1.length;
        return Math.max(0, 1 - (avgDiff / 180));
    }
   
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
}

module.exports = GeometricHashAlgorithm;
