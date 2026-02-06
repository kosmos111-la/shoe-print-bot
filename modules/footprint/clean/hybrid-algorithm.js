// modules/footprint/clean/hybrid-algorithm.js
// 🎯 ГИБРИДНЫЙ АЛГОРИТМ: Триангуляция + Локальные паттерны

console.log('🎯 ГИБРИДНЫЙ АЛГОРИТМ - Триангуляция + Топология\n');

class HybridAlgorithm {
    constructor(options = {}) {
        // Параметры триангуляции
        this.fixedNeighbors = options.fixedNeighbors || [-3, -2, -1, 1, 2, 3];
        this.angleTolerance = options.angleTolerance || 10;
        this.hashPrecision = options.hashPrecision || 5;
       
        // Параметры сравнения
        this.similarityThreshold = options.similarityThreshold || 0.6;
        this.minPoints = options.minPoints || 20;
        this.minMatchedPoints = options.minMatchedPoints || 10;
       
        // 🔥 КЛЮЧЕВОЕ: Используем локальные дескрипторы для сравнения
        this.useLocalDescriptors = true;
        this.neighborsForMatching = 5; // Для поиска соответствий
       
        this.debug = options.debug !== false;
    }

    // ============================================
    // 🎯 СОЗДАНИЕ ОТПЕЧАТКА С ФИКСИРОВАННЫМИ СОСЕДЯМИ
    // ============================================
   
    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`🎯 Создаю гибридный отпечаток "${name}" из ${points.length} точек`);
        }
       
        const footprint = [];
        const totalPoints = points.length;
       
        // Подготавливаем точки с индексами
        const indexedPoints = points.map((p, idx) => ({
            ...p,
            index: idx,
            originalId: p.originalId || `pt_${idx}`
        }));
       
        // 🔥 ФАЗА 1: Триангуляция с фиксированными соседями
        for (let i = 0; i < totalPoints; i++) {
            const point = indexedPoints[i];
            const neighbors = this.findFixedNeighbors(i, indexedPoints);
           
            if (neighbors.length >= 2) {
                const triangles = this.createTriangles(point, neighbors);
               
                if (triangles.length > 0) {
                    // Создаем геометрический дескриптор
                    const geoDescriptor = this.createGeometricDescriptor(triangles);
                   
                    // 🔥 ФАЗА 2: Локальный топологический дескриптор
                    const localDescriptor = this.createLocalDescriptor(point, indexedPoints, i);
                   
                    footprint.push({
                        id: point.id || `pt_${i}`,
                        originalId: point.originalId,
                        index: i,
                        x: point.x,
                        y: point.y,
                        // Геометрические данные (триангуляция)
                        geoDescriptor: geoDescriptor,
                        triangles: triangles,
                        triangleCount: triangles.length,
                        // Топологические данные (локальные отношения)
                        localDescriptor: localDescriptor,
                        neighborIndices: neighbors.map(n => n.index)
                    });
                }
            }
        }
       
        if (this.debug) {
            console.log(`✅ Создан отпечаток: ${footprint.length} точек`);
            if (footprint.length > 0) {
                const firstPoint = footprint[0];
                console.log(`   Точка ${firstPoint.originalId}: ${firstPoint.triangleCount} треугольников, ` +
                          `локальный хеш: ${firstPoint.localDescriptor.hash}`);
            }
        }
       
        return footprint;
    }
   
    // ============================================
    // 🔄 УМНОЕ СРАВНЕНИЕ: Используем оба подхода
    // ============================================
   
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        if (this.debug) {
            console.log(`\n🔍 ГИБРИДНОЕ СРАВНЕНИЕ: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);
        }
       
        if (fp1.length < this.minPoints || fp2.length < this.minPoints) {
            return {
                similarity: 0,
                decision: 'different',
                matches: [],
                stats: { total1: fp1.length, total2: fp2.length, matched: 0 }
            };
        }
       
        // 🔥 КЛЮЧЕВАЯ ИДЕЯ: Используем локальные дескрипторы для поиска соответствий
        const matches = this.findMatchesUsingLocalDescriptors(fp1, fp2);
        const matched = matches.length;
       
        // Вычисляем схожесть на основе геометрических дескрипторов
        let totalSimilarity = 0;
        let comparedPairs = 0;
       
        for (const match of matches) {
            const similarity = this.compareGeometricDescriptors(
                match.point1.geoDescriptor,
                match.point2.geoDescriptor
            );
            totalSimilarity += similarity;
            comparedPairs++;
        }
       
        const avgSimilarity = comparedPairs > 0 ? totalSimilarity / comparedPairs : 0;
       
        // Процент совпавших точек
        const pointSimilarity = matched / Math.min(fp1.length, fp2.length);
       
        // 🔥 КОМБИНИРОВАННАЯ ОЦЕНКА
        const finalSimilarity = (avgSimilarity * 0.7 + pointSimilarity * 0.3);
       
        const decision = (matched >= this.minMatchedPoints && finalSimilarity >= this.similarityThreshold)
            ? 'same'
            : 'different';
       
        if (this.debug) {
            console.log(`📊 РЕЗУЛЬТАТ:`);
            console.log(`   Найдено соответствий: ${matched}`);
            console.log(`   Средняя геометрическая схожесть: ${(avgSimilarity * 100).toFixed(1)}%`);
            console.log(`   Процент совпавших точек: ${(pointSimilarity * 100).toFixed(1)}%`);
            console.log(`   Итоговая схожесть: ${(finalSimilarity * 100).toFixed(1)}%`);
            console.log(`   Решение: ${decision} (порог: ${this.similarityThreshold * 100}%)`);
           
            if (matches.length > 0) {
                console.log(`\n🔬 ПРИМЕРЫ СОВПАДЕНИЙ:`);
                matches.slice(0, 3).forEach((match, idx) => {
                    const geoSimilarity = this.compareGeometricDescriptors(
                        match.point1.geoDescriptor,
                        match.point2.geoDescriptor
                    );
                    console.log(`   ${idx + 1}. ${match.point1.originalId} ↔ ${match.point2.originalId}: ` +
                              `геометрия: ${geoSimilarity.toFixed(3)}, локально: ${match.localSimilarity.toFixed(3)}`);
                });
            }
        }
       
        return {
            similarity: finalSimilarity,
            decision: decision,
            matches: matches,
            stats: {
                total1: fp1.length,
                total2: fp2.length,
                matched: matched,
                avgGeometricSimilarity: avgSimilarity,
                pointSimilarity: pointSimilarity,
                finalSimilarity: finalSimilarity
            }
        };
    }
   
    // ============================================
    // 🔍 ПОИСК СООТВЕТСТВИЙ ПО ЛОКАЛЬНЫМ ДЕСКРИПТОРАМ
    // ============================================
   
    findMatchesUsingLocalDescriptors(fp1, fp2) {
        const matches = [];
        const used2 = new Set();
       
        // Создаем карту локальных хешей для быстрого поиска
        const hashMap = new Map();
        fp2.forEach((point, idx) => {
            const hash = point.localDescriptor.hash;
            if (!hashMap.has(hash)) {
                hashMap.set(hash, []);
            }
            hashMap.get(hash).push({ point, idx });
        });
       
        // Ищем соответствия для точек из fp1
        for (const point1 of fp1) {
            const hash = point1.localDescriptor.hash;
           
            if (hashMap.has(hash)) {
                const candidates = hashMap.get(hash);
                let bestMatch = null;
                let bestSimilarity = 0;
               
                // Ищем лучшего кандидата
                for (const candidate of candidates) {
                    if (used2.has(candidate.idx)) continue;
                   
                    const localSimilarity = this.compareLocalDescriptors(
                        point1.localDescriptor,
                        candidate.point.localDescriptor
                    );
                   
                    if (localSimilarity > bestSimilarity && localSimilarity > 0.7) {
                        bestSimilarity = localSimilarity;
                        bestMatch = candidate;
                    }
                }
               
                if (bestMatch) {
                    matches.push({
                        point1: point1,
                        point2: bestMatch.point,
                        localSimilarity: bestSimilarity
                    });
                    used2.add(bestMatch.idx);
                   
                    // Удаляем использованный дескриптор
                    const candidatesList = hashMap.get(hash);
                    const index = candidatesList.indexOf(bestMatch);
                    if (index > -1) {
                        candidatesList.splice(index, 1);
                    }
                    if (candidatesList.length === 0) {
                        hashMap.delete(hash);
                    }
                }
            }
        }
       
        return matches;
    }
   
    // ============================================
    // 📐 МЕТОДЫ ТРИАНГУЛЯЦИИ (твои, исправленные)
    // ============================================
   
    findFixedNeighbors(centerIndex, allPoints) {
        const neighbors = [];
        const total = allPoints.length;
       
        for (const offset of this.fixedNeighbors) {
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
   
    createTriangles(center, neighbors) {
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
   
    createGeometricDescriptor(triangles) {
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
   
    // ============================================
    // 🎯 МЕТОДЫ ЛОКАЛЬНЫХ ДЕСКРИПТОРОВ
    // ============================================
   
    createLocalDescriptor(centerPoint, allPoints, centerIndex) {
        // Находим K ближайших соседей (по расстоянию, а не по индексам!)
        const neighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex);
       
        if (neighbors.length < 2) {
            return {
                hash: 'insufficient_neighbors',
                features: []
            };
        }
       
        // Вычисляем признаки
        const features = [];
       
        // 1. Относительные расстояния и углы
        const vectors = [];
        for (const neighbor of neighbors) {
            const dx = neighbor.x - centerPoint.x;
            const dy = neighbor.y - centerPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
           
            vectors.push({
                dx, dy, distance, angle: (angle + 360) % 360
            });
           
            features.push({
                type: 'distance',
                value: Math.round(distance / 10) * 10 // Округляем до 10px
            });
        }
       
        // 2. Углы между векторами (отсортированные)
        for (let i = 0; i < vectors.length; i++) {
            for (let j = i + 1; j < vectors.length; j++) {
                let angleDiff = Math.abs(vectors[i].angle - vectors[j].angle);
                angleDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
               
                features.push({
                    type: 'angle_between',
                    value: Math.round(angleDiff / 5) * 5 // Округляем до 5°
                });
            }
        }
       
        // 3. Создаем хеш
        const hash = this.createLocalHash(features);
       
        return {
            hash: hash,
            features: features,
            vectors: vectors,
            neighborCount: neighbors.length
        };
    }
   
    findNearestNeighbors(centerPoint, allPoints, centerIndex) {
        const distances = [];
       
        for (let i = 0; i < allPoints.length; i++) {
            if (i === centerIndex) continue;
           
            const distance = this.calculateDistance(centerPoint, allPoints[i]);
            distances.push({
                point: allPoints[i],
                distance: distance,
                index: i
            });
        }
       
        // Сортируем по расстоянию и берем ближайших
        distances.sort((a, b) => a.distance - b.distance);
       
        return distances
            .slice(0, this.neighborsForMatching)
            .map(d => d.point);
    }
   
    createLocalHash(features) {
        // Группируем и сортируем признаки для стабильного хеша
        const distances = features.filter(f => f.type === 'distance')
            .map(f => f.value)
            .sort((a, b) => a - b);
       
        const angles = features.filter(f => f.type === 'angle_between')
            .map(f => f.value)
            .sort((a, b) => a - b);
       
        // Создаем компактный хеш
        const distHash = distances.map(d => Math.round(d / 20)).join('-');
        const angleHash = angles.map(a => Math.round(a / 10)).join('-');
       
        return `D${distHash}_A${angleHash}`;
    }
   
    // ============================================
    // 🔄 МЕТОДЫ СРАВНЕНИЯ
    // ============================================
   
    compareGeometricDescriptors(desc1, desc2) {
        if (!desc1 || !desc2) return 0;
       
        // 1. Проверка точных хешей
        if (desc1.hashes.exact === desc2.hashes.exact) return 1.0;
       
        // 2. Проверка округленных хешей
        if (desc1.hashes.rounded === desc2.hashes.rounded) return 0.9;
       
        // 3. Сравнение сигнатур
        const signatureScore = this.compareSignatures(
            desc1.hashes.signature,
            desc2.hashes.signature
        );
       
        // 4. Сравнение наборов треугольников
        const triangleScore = this.compareTriangleSets(
            desc1.triangleHashes,
            desc2.triangleHashes
        );
       
        // Комбинированная оценка
        return (signatureScore * 0.4 + triangleScore * 0.6);
    }
   
    compareLocalDescriptors(desc1, desc2) {
        if (!desc1 || !desc2 || desc1.hash === 'insufficient_neighbors' || desc2.hash === 'insufficient_neighbors') {
            return 0;
        }
       
        // Быстрая проверка по хешу
        if (desc1.hash === desc2.hash) return 1.0;
       
        // Подробное сравнение признаков
        let matchingFeatures = 0;
        let totalFeatures = 0;
       
        // Сравниваем расстояния
        const distances1 = desc1.features.filter(f => f.type === 'distance');
        const distances2 = desc2.features.filter(f => f.type === 'distance');
       
        for (const dist1 of distances1) {
            for (const dist2 of distances2) {
                if (Math.abs(dist1.value - dist2.value) <= 20) { // 20px допуск
                    matchingFeatures++;
                    break;
                }
            }
        }
       
        totalFeatures += Math.min(distances1.length, distances2.length);
       
        // Сравниваем углы
        const angles1 = desc1.features.filter(f => f.type === 'angle_between');
        const angles2 = desc2.features.filter(f => f.type === 'angle_between');
       
        for (const angle1 of angles1) {
            for (const angle2 of angles2) {
                if (Math.abs(angle1.value - angle2.value) <= 15) { // 15° допуск
                    matchingFeatures++;
                    break;
                }
            }
        }
       
        totalFeatures += Math.min(angles1.length, angles2.length);
       
        return totalFeatures > 0 ? matchingFeatures / totalFeatures : 0;
    }
   
    // ============================================
    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================
   
    calculateAngles(p1, p2, p3) {
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
        return Math.max(0, 1 - (avgDiff / 90));
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

module.exports = HybridAlgorithm;
