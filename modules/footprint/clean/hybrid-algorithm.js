// modules/footprint/clean/hybrid-algorithm.js - ИСПРАВЛЕННЫЙ
// 🎯 ГИБРИДНЫЙ АЛГОРИТМ, ИНВАРИАНТНЫЙ К ПОВОРОТУ

console.log('🎯 ГИБРИДНЫЙ АЛГОРИТМ - ИНВАРИАНТНЫЙ К ПОВОРОТУ\n');

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
       
        // 🔥 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Используем относительные углы
        this.useRelativeAngles = true;
        this.neighborsForMatching = 5;
       
        // 🔥 НОВЫЙ ПАРАМЕТР: Толерантность при поиске поворота
        this.rotationSearchStep = options.rotationSearchStep || 15; // градусов
       
        this.debug = options.debug !== false;
    }

    // ============================================
    // 🎯 СОЗДАНИЕ ОТПЕЧАТКА (ИНВАРИАНТНОГО К ПОВОРОТУ)
    // ============================================
   
    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`🎯 Создаю отпечаток "${name}" из ${points.length} точек`);
        }
       
        const footprint = [];
        const totalPoints = points.length;
       
        // 1. Нормализуем точки (центрируем)
        const normalizedPoints = this.normalizePoints(points);
       
        // 2. Для каждой точки создаем инвариантные дескрипторы
        for (let i = 0; i < totalPoints; i++) {
            const point = normalizedPoints[i];
           
            // 🔥 ФИКСИРОВАННЫЕ СОСЕДИ (по индексам в исходном порядке!)
            const neighbors = this.findFixedNeighbors(i, normalizedPoints);
           
            if (neighbors.length >= 2) {
                // 📐 ГЕОМЕТРИЧЕСКИЙ ДЕСКРИПТОР (углы треугольников)
                const triangles = this.createTriangles(point, neighbors);
               
                if (triangles.length > 0) {
                    // 🎯 ЛОКАЛЬНЫЙ ДЕСКРИПТОР (инвариантный к повороту)
                    const localDescriptor = this.createRotationInvariantDescriptor(point, normalizedPoints, i);
                   
                    footprint.push({
                        id: point.id || `pt_${i}`,
                        originalId: point.originalId,
                        index: i,
                        x: point.x,
                        y: point.y,
                        // Геометрические данные
                        geoDescriptor: this.createGeometricDescriptor(triangles),
                        triangles: triangles,
                        triangleCount: triangles.length,
                        // Локальные данные (инвариантные)
                        localDescriptor: localDescriptor,
                        neighborIndices: neighbors.map(n => n.index)
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
    // 🔄 СРАВНЕНИЕ С ПОИСКОМ НАИЛУЧШЕГО ПОВОРОТА
    // ============================================
   
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        if (this.debug) {
            console.log(`\n🔍 СРАВНЕНИЕ: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);
        }
       
        if (fp1.length < this.minPoints || fp2.length < this.minPoints) {
            return {
                similarity: 0,
                decision: 'different',
                matches: []
            };
        }
       
        // 🔥 КЛЮЧЕВОЕ: Ищем наилучший поворот для соответствия
        const bestMatch = this.findBestRotationMatch(fp1, fp2);
       
        const similarity = bestMatch.score;
        const decision = (bestMatch.matchedPoints >= this.minMatchedPoints &&
                         similarity >= this.similarityThreshold)
                         ? 'same' : 'different';
       
        if (this.debug) {
            console.log(`📊 РЕЗУЛЬТАТ:`);
            console.log(`   Наилучший угол поворота: ${bestMatch.bestRotation.toFixed(1)}°`);
            console.log(`   Найдено соответствий: ${bestMatch.matchedPoints}`);
            console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}%`);
            console.log(`   Решение: ${decision} (порог: ${this.similarityThreshold * 100}%)`);
           
            if (bestMatch.matches.length > 0) {
                console.log(`\n🔬 ПРИМЕРЫ СОВПАДЕНИЙ:`);
                bestMatch.matches.slice(0, 3).forEach((match, idx) => {
                    console.log(`   ${idx + 1}. ${match.point1.originalId} ↔ ${match.point2.originalId}`);
                });
            }
        }
       
        return {
            similarity: similarity,
            decision: decision,
            matches: bestMatch.matches,
            bestRotation: bestMatch.bestRotation,
            stats: {
                matchedPoints: bestMatch.matchedPoints,
                bestRotation: bestMatch.bestRotation,
                score: bestMatch.score
            }
        };
    }
   
    // ============================================
    // 🔍 ПОИСК НАИЛУЧШЕГО ПОВОРОТА ДЛЯ СОВПАДЕНИЯ
    // ============================================
   
    findBestRotationMatch(fp1, fp2) {
        let bestScore = 0;
        let bestRotation = 0;
        let bestMatches = [];
        let bestMatchedPoints = 0;
       
        // Перебираем возможные углы поворота
        for (let rotation = 0; rotation < 360; rotation += this.rotationSearchStep) {
            const rotationRad = rotation * Math.PI / 180;
           
            // Поворачиваем локальные дескрипторы второго отпечатка
            const rotatedDescriptors = this.rotateDescriptors(fp2, rotationRad);
           
            // Сравниваем дескрипторы
            const matches = this.matchDescriptors(fp1, rotatedDescriptors);
           
            // Вычисляем схожесть
            const matchedPoints = matches.length;
            const maxPossible = Math.min(fp1.length, fp2.length);
            const score = maxPossible > 0 ? matchedPoints / maxPossible : 0;
           
            if (score > bestScore) {
                bestScore = score;
                bestRotation = rotation;
                bestMatches = matches;
                bestMatchedPoints = matchedPoints;
            }
           
            // Если нашли отличное совпадение - можно остановиться
            if (bestScore > 0.9) break;
        }
       
        return {
            score: bestScore,
            bestRotation: bestRotation,
            matches: bestMatches,
            matchedPoints: bestMatchedPoints
        };
    }
   
    // ============================================
    // 🎯 СОЗДАНИЕ ИНВАРИАНТНЫХ ДЕСКРИПТОРОВ
    // ============================================
   
    createRotationInvariantDescriptor(centerPoint, allPoints, centerIndex) {
        // Находим K ближайших соседей
        const neighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex);
       
        if (neighbors.length < 2) {
            return {
                hash: 'insufficient_neighbors',
                angles: [],
                ratios: []
            };
        }
       
        // 🔥 КЛЮЧЕВОЕ: Вычисляем ОТНОСИТЕЛЬНЫЕ углы между соседями
        // Эти углы НЕ МЕНЯЮТСЯ при повороте всей фигуры!
       
        const vectors = [];
        for (const neighbor of neighbors) {
            const dx = neighbor.x - centerPoint.x;
            const dy = neighbor.y - centerPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
           
            vectors.push({
                dx, dy, distance, angle
            });
        }
       
        // Сортируем векторы по углу (относительная ориентация)
        vectors.sort((a, b) => a.angle - b.angle);
       
        // Вычисляем относительные углы между последовательными векторами
        const relativeAngles = [];
        for (let i = 0; i < vectors.length; i++) {
            const nextIdx = (i + 1) % vectors.length;
            let angleDiff = vectors[nextIdx].angle - vectors[i].angle;
            if (angleDiff < 0) angleDiff += 2 * Math.PI;
           
            relativeAngles.push({
                angle: angleDiff * 180 / Math.PI, // в градусах
                distance1: vectors[i].distance,
                distance2: vectors[nextIdx].distance
            });
        }
       
        // Сортируем углы для инвариантности к начальной точке
        const sortedAngles = relativeAngles.map(a => a.angle).sort((a, b) => a - b);
        const sortedRatios = relativeAngles.map(a => {
            if (a.distance2 > 0) return a.distance1 / a.distance2;
            return 1;
        }).sort((a, b) => a - b);
       
        // Создаем хеш на основе относительных углов
        const angleHash = sortedAngles.map(a => Math.round(a / 5) * 5).join('-');
        const ratioHash = sortedRatios.map(r => Math.round(r * 100) / 100).join('-');
       
        return {
            hash: `A${angleHash}_R${ratioHash}`,
            angles: sortedAngles,
            ratios: sortedRatios,
            vectors: vectors
        };
    }
   
    // ============================================
    // 🔄 СРАВНЕНИЕ ДЕСКРИПТОРОВ
    // ============================================
   
    matchDescriptors(fp1, descriptors2) {
        const matches = [];
        const used2 = new Set();
       
        // Создаем карту хешей для быстрого поиска
        const hashMap = new Map();
        descriptors2.forEach((desc, idx) => {
            const hash = desc.localDescriptor.hash;
            if (!hashMap.has(hash)) {
                hashMap.set(hash, []);
            }
            hashMap.get(hash).push({ desc, idx });
        });
       
        // Ищем соответствия
        for (const point1 of fp1) {
            const hash = point1.localDescriptor.hash;
           
            if (hashMap.has(hash) && hash !== 'insufficient_neighbors') {
                const candidates = hashMap.get(hash);
                let bestCandidate = null;
                let bestSimilarity = 0;
               
                for (const candidate of candidates) {
                    if (used2.has(candidate.idx)) continue;
                   
                    const similarity = this.compareLocalDescriptors(
                        point1.localDescriptor,
                        candidate.desc.localDescriptor
                    );
                   
                    if (similarity > bestSimilarity && similarity > 0.7) {
                        bestSimilarity = similarity;
                        bestCandidate = candidate;
                    }
                }
               
                if (bestCandidate) {
                    matches.push({
                        point1: point1,
                        point2: bestCandidate.desc,
                        similarity: bestSimilarity
                    });
                    used2.add(bestCandidate.idx);
                   
                    // Удаляем использованный
                    const candidatesList = hashMap.get(hash);
                    const index = candidatesList.indexOf(bestCandidate);
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
   
    compareLocalDescriptors(desc1, desc2) {
        if (!desc1 || !desc2 || desc1.hash === 'insufficient_neighbors' || desc2.hash === 'insufficient_neighbors') {
            return 0;
        }
       
        // Быстрая проверка по хешу
        if (desc1.hash === desc2.hash) return 1.0;
       
        // Сравниваем углы
        let angleMatch = 0;
        for (const angle1 of desc1.angles) {
            for (const angle2 of desc2.angles) {
                if (Math.abs(angle1 - angle2) < 10) { // 10° допуск
                    angleMatch++;
                    break;
                }
            }
        }
       
        const angleScore = desc1.angles.length > 0 ?
            angleMatch / Math.min(desc1.angles.length, desc2.angles.length) : 0;
       
        // Сравниваем отношения расстояний
        let ratioMatch = 0;
        for (const ratio1 of desc1.ratios) {
            for (const ratio2 of desc2.ratios) {
                if (Math.abs(ratio1 - ratio2) < 0.2) { // 20% допуск
                    ratioMatch++;
                    break;
                }
            }
        }
       
        const ratioScore = desc1.ratios.length > 0 ?
            ratioMatch / Math.min(desc1.ratios.length, desc2.ratios.length) : 0;
       
        return (angleScore * 0.6 + ratioScore * 0.4);
    }
   
    rotateDescriptors(descriptors, rotationRad) {
        return descriptors.map(desc => {
            // Поворачиваем векторы в локальном дескрипторе
            const rotatedVectors = desc.localDescriptor.vectors?.map(vec => ({
                ...vec,
                angle: vec.angle + rotationRad
            })) || [];
           
            // Пересчитываем относительные углы
            if (rotatedVectors.length > 0) {
                rotatedVectors.sort((a, b) => a.angle - b.angle);
               
                const relativeAngles = [];
                for (let i = 0; i < rotatedVectors.length; i++) {
                    const nextIdx = (i + 1) % rotatedVectors.length;
                    let angleDiff = rotatedVectors[nextIdx].angle - rotatedVectors[i].angle;
                    if (angleDiff < 0) angleDiff += 2 * Math.PI;
                   
                    relativeAngles.push(angleDiff * 180 / Math.PI);
                }
               
                const sortedAngles = relativeAngles.sort((a, b) => a - b);
                const angleHash = sortedAngles.map(a => Math.round(a / 5) * 5).join('-');
               
                return {
                    ...desc,
                    localDescriptor: {
                        ...desc.localDescriptor,
                        hash: `A${angleHash}_R${desc.localDescriptor.ratios.join('-')}`,
                        angles: sortedAngles
                    }
                };
            }
           
            return desc;
        });
    }
   
    // ============================================
    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (без изменений)
    // ============================================
   
    normalizePoints(points) {
        const center = { x: 0, y: 0 };
        points.forEach(p => {
            center.x += p.x;
            center.y += p.y;
        });
        center.x /= points.length;
        center.y /= points.length;
       
        return points.map((p, idx) => ({
            ...p,
            x: p.x - center.x,
            y: p.y - center.y,
            index: idx,
            originalId: p.originalId || `pt_${idx}`
        }));
    }
   
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
       
        distances.sort((a, b) => a.distance - b.distance);
       
        return distances
            .slice(0, this.neighborsForMatching)
            .map(d => d.point);
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
            triangleCount: triangles.length
        };
    }
   
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
