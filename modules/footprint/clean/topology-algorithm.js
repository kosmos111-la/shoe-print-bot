// modules/footprint/clean/topology-algorithm.js
// 🎯 АЛГОРИТМ ДЛЯ СРАВНЕНИЯ ТОПОЛОГИИ ДЕТАЛЕЙ ПОДОШВЫ

console.log('🎯 ТОПОЛОГИЧЕСКИЙ АЛГОРИТМ - СРАВНЕНИЕ ЦЕНТРОВ ДЕТАЛЕЙ\n');

class TopologyAlgorithm {
    constructor(options = {}) {
        // ПАРАМЕТРЫ АЛГОРИТМА
        this.minPoints = options.minPoints || 20;     // Минимум точек для сравнения
        this.similarityThreshold = options.similarityThreshold || 0.6; // Порог схожести
        this.maxRotation = options.maxRotation || 360; // Максимальный угол для поиска
        this.rotationStep = options.rotationStep || 5; // Шаг перебора поворотов
        this.pointMatchThreshold = options.pointMatchThreshold || 15; // Порог совпадения точек (пикселей)
       
        // 🔥 КЛЮЧЕВОЙ ПАРАМЕТР: Сколько ближайших соседей использовать
        this.neighborsCount = options.neighborsCount || 8;
       
        this.debug = options.debug !== false;
    }

    // ============================================
    // 🎯 ОСНОВНОЙ МЕТОД: СРАВНИТЬ ДВА НАБОРА ТОЧЕК
    // ============================================
   
    comparePoints(points1, points2, name1 = 'След 1', name2 = 'След 2') {
        if (this.debug) {
            console.log(`🔍 СРАВНЕНИЕ ТОПОЛОГИЙ: ${name1} (${points1.length} точек) vs ${name2} (${points2.length} точек)`);
        }
       
        // Проверка минимального количества точек
        if (points1.length < this.minPoints || points2.length < this.minPoints) {
            console.log(`⚠️ Слишком мало точек: ${points1.length} и ${points2.length} (минимум ${this.minPoints})`);
            return {
                similarity: 0,
                decision: 'different',
                matches: [],
                transform: null
            };
        }
       
        // 1. Нормализуем оба набора точек
        const normalized1 = this.normalizePoints(points1);
        const normalized2 = this.normalizePoints(points2);
       
        // 2. Создаем топологические дескрипторы
        const descriptors1 = this.createTopologyDescriptors(normalized1);
        const descriptors2 = this.createTopologyDescriptors(normalized2);
       
        // 3. Находим наилучшее соответствие
        const bestMatch = this.findBestMatch(descriptors1, descriptors2);
       
        // 4. Оцениваем результат
        const similarity = bestMatch.score;
        const decision = similarity >= this.similarityThreshold ? 'same' : 'different';
       
        if (this.debug) {
            console.log(`📊 РЕЗУЛЬТАТ:`);
            console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}%`);
            console.log(`   Найдено совпадений: ${bestMatch.matchedPoints} из ${Math.min(points1.length, points2.length)}`);
            console.log(`   Лучший угол поворота: ${bestMatch.bestRotation.toFixed(1)}°`);
            console.log(`   Решение: ${decision} (порог: ${this.similarityThreshold * 100}%)`);
        }
       
        return {
            similarity: similarity,
            decision: decision,
            matches: bestMatch.matches,
            transform: bestMatch.transform,
            stats: {
                points1: points1.length,
                points2: points2.length,
                matchedPoints: bestMatch.matchedPoints,
                bestRotation: bestMatch.bestRotation,
                score: bestMatch.score
            }
        };
    }
   
    // ============================================
    // 📐 СОЗДАНИЕ ТОПОЛОГИЧЕСКИХ ДЕСКРИПТОРОВ
    // ============================================
   
    createTopologyDescriptors(points) {
        const descriptors = [];
       
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // Находим K ближайших соседей
            const neighbors = this.findKNearestNeighbors(point, points, i);
           
            if (neighbors.length >= 3) {
                // Создаем дескриптор на основе отношений с соседями
                const descriptor = this.createPointDescriptor(point, neighbors);
                descriptors.push({
                    point: point,
                    descriptor: descriptor,
                    neighbors: neighbors.map(n => n.index)
                });
            }
        }
       
        return descriptors;
    }
   
    createPointDescriptor(centerPoint, neighbors) {
        const features = [];
       
        // 1. Относительные векторы к соседям
        const vectors = [];
        for (const neighbor of neighbors) {
            const dx = neighbor.x - centerPoint.x;
            const dy = neighbor.y - centerPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
           
            vectors.push({
                dx, dy, distance, angle,
                neighborIndex: neighbor.index
            });
        }
       
        // 2. Углы между векторами
        for (let i = 0; i < vectors.length; i++) {
            for (let j = i + 1; j < vectors.length; j++) {
                const angleDiff = Math.abs(vectors[i].angle - vectors[j].angle);
                const normalizedAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff;
               
                features.push({
                    type: 'angle_between',
                    value: normalizedAngle,
                    vectors: [i, j]
                });
            }
        }
       
        // 3. Отношения расстояний
        for (let i = 0; i < vectors.length; i++) {
            for (let j = i + 1; j < vectors.length; j++) {
                if (vectors[j].distance > 0) {
                    const ratio = vectors[i].distance / vectors[j].distance;
                    features.push({
                        type: 'distance_ratio',
                        value: ratio,
                        vectors: [i, j]
                    });
                }
            }
        }
       
        // 4. Создаем хеш дескриптора
        const hash = this.createDescriptorHash(features);
       
        return {
            features: features,
            vectors: vectors,
            hash: hash,
            featureCount: features.length
        };
    }
   
    // ============================================
    // 🔍 ПОИСК НАИЛУЧШЕГО СООТВЕТСТВИЯ
    // ============================================
   
    findBestMatch(descriptors1, descriptors2) {
        let bestScore = 0;
        let bestRotation = 0;
        let bestMatches = [];
        let bestTransform = null;
       
        // Перебираем возможные повороты
        for (let rotation = 0; rotation < this.maxRotation; rotation += this.rotationStep) {
            const rotationRad = rotation * Math.PI / 180;
           
            // Поворачиваем второй набор дескрипторов
            const rotatedDescriptors2 = this.rotateDescriptors(descriptors2, rotationRad);
           
            // Сравниваем дескрипторы
            const matchResult = this.matchDescriptors(descriptors1, rotatedDescriptors2);
           
            if (matchResult.score > bestScore) {
                bestScore = matchResult.score;
                bestRotation = rotation;
                bestMatches = matchResult.matches;
                bestTransform = {
                    rotation: rotation,
                    scale: matchResult.scale
                };
            }
           
            // Если нашли отличное совпадение - можно остановиться раньше
            if (bestScore > 0.9) break;
        }
       
        return {
            score: bestScore,
            bestRotation: bestRotation,
            matches: bestMatches,
            matchedPoints: bestMatches.length,
            transform: bestTransform
        };
    }
   
    matchDescriptors(desc1, desc2) {
        const matches = [];
       
        // Создаем матрицу схожести
        const similarityMatrix = [];
        for (let i = 0; i < desc1.length; i++) {
            similarityMatrix[i] = [];
            for (let j = 0; j < desc2.length; j++) {
                similarityMatrix[i][j] = this.compareDescriptors(desc1[i].descriptor, desc2[j].descriptor);
            }
        }
       
        // Находим наилучшие соответствия (жадный алгоритм)
        const used1 = new Set();
        const used2 = new Set();
       
        // Создаем список всех возможных пар, отсортированных по схожести
        const allPairs = [];
        for (let i = 0; i < desc1.length; i++) {
            for (let j = 0; j < desc2.length; j++) {
                if (similarityMatrix[i][j] > 0.7) { // Порог для рассмотрения
                    allPairs.push({
                        i, j,
                        similarity: similarityMatrix[i][j],
                        distance: this.calculateDistance(desc1[i].point, desc2[j].point)
                    });
                }
            }
        }
       
        // Сортируем по убыванию схожести
        allPairs.sort((a, b) => b.similarity - a.similarity);
       
        // Берем наилучшие непересекающиеся пары
        for (const pair of allPairs) {
            if (!used1.has(pair.i) && !used2.has(pair.j) && pair.distance < this.pointMatchThreshold * 2) {
                matches.push({
                    point1: desc1[pair.i].point,
                    point2: desc2[pair.j].point,
                    similarity: pair.similarity,
                    distance: pair.distance
                });
                used1.add(pair.i);
                used2.add(pair.j);
            }
        }
       
        // Вычисляем общую схожесть
        const matchedCount = matches.length;
        const maxPossible = Math.min(desc1.length, desc2.length);
        const score = maxPossible > 0 ? matchedCount / maxPossible : 0;
       
        return {
            matches: matches,
            score: score,
            matchedCount: matchedCount
        };
    }
   
    // ============================================
    // 📏 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================
   
    normalizePoints(points) {
        // Преобразуем в наш формат
        const formattedPoints = points.map((p, idx) => ({
            x: p.x || 0,
            y: p.y || 0,
            index: idx,
            originalId: p.originalId || `pt_${idx}`,
            confidence: p.confidence || 0.5
        }));
       
        // Находим центр масс
        const center = { x: 0, y: 0 };
        formattedPoints.forEach(p => {
            center.x += p.x;
            center.y += p.y;
        });
        center.x /= formattedPoints.length;
        center.y /= formattedPoints.length;
       
        // Центрируем и масштабируем
        let maxDistance = 0;
        const centeredPoints = formattedPoints.map(p => {
            const dx = p.x - center.x;
            const dy = p.y - center.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            maxDistance = Math.max(maxDistance, distance);
            return {
                ...p,
                centeredX: dx,
                centeredY: dy,
                distanceFromCenter: distance
            };
        });
       
        // Нормализуем масштаб
        if (maxDistance > 0) {
            centeredPoints.forEach(p => {
                p.normalizedX = p.centeredX / maxDistance;
                p.normalizedY = p.centeredY / maxDistance;
            });
        }
       
        return centeredPoints;
    }
   
    findKNearestNeighbors(centerPoint, allPoints, centerIndex) {
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
       
        // Сортируем по расстоянию и берем K ближайших
        distances.sort((a, b) => a.distance - b.distance);
       
        return distances
            .slice(0, this.neighborsCount)
            .map(d => ({
                ...d.point,
                distanceToCenter: d.distance
            }));
    }
   
    calculateDistance(p1, p2) {
        const dx = (p1.normalizedX || p1.x) - (p2.normalizedX || p2.x);
        const dy = (p1.normalizedY || p1.y) - (p2.normalizedY || p2.y);
        return Math.sqrt(dx * dx + dy * dy);
    }
   
    createDescriptorHash(features) {
        // Группируем признаки по типам и усредняем
        const angleFeatures = features.filter(f => f.type === 'angle_between');
        const ratioFeatures = features.filter(f => f.type === 'distance_ratio');
       
        const avgAngle = angleFeatures.length > 0 ?
            angleFeatures.reduce((sum, f) => sum + f.value, 0) / angleFeatures.length : 0;
       
        const avgRatio = ratioFeatures.length > 0 ?
            ratioFeatures.reduce((sum, f) => sum + f.value, 0) / ratioFeatures.length : 0;
       
        // Создаем хеш на основе средних значений
        return `A${Math.round(avgAngle / 5) * 5}_R${Math.round(avgRatio * 100) / 100}`;
    }
   
    compareDescriptors(desc1, desc2) {
        if (!desc1 || !desc2) return 0;
       
        // Быстрая проверка по хешу
        if (desc1.hash === desc2.hash) return 1.0;
       
        // Подробное сравнение признаков
        let matchingFeatures = 0;
       
        // Сравниваем углы
        const angles1 = desc1.features.filter(f => f.type === 'angle_between');
        const angles2 = desc2.features.filter(f => f.type === 'angle_between');
       
        for (const angle1 of angles1) {
            for (const angle2 of angles2) {
                if (Math.abs(angle1.value - angle2.value) < 10) { // 10° допуск
                    matchingFeatures++;
                    break;
                }
            }
        }
       
        // Сравниваем отношения расстояний
        const ratios1 = desc1.features.filter(f => f.type === 'distance_ratio');
        const ratios2 = desc2.features.filter(f => f.type === 'distance_ratio');
       
        for (const ratio1 of ratios1) {
            for (const ratio2 of ratios2) {
                const diff = Math.abs(ratio1.value - ratio2.value);
                if (diff < 0.2) { // 20% допуск
                    matchingFeatures++;
                    break;
                }
            }
        }
       
        const totalFeatures = Math.max(desc1.featureCount, desc2.featureCount);
        return totalFeatures > 0 ? matchingFeatures / totalFeatures : 0;
    }
   
    rotateDescriptors(descriptors, angleRad) {
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);
       
        return descriptors.map(desc => {
            // Поворачиваем векторы к соседям
            const rotatedVectors = desc.descriptor.vectors.map(vec => ({
                ...vec,
                angle: (vec.angle + angleRad * 180 / Math.PI) % 360
            }));
           
            // Обновляем дескриптор
            const rotatedDescriptor = {
                ...desc.descriptor,
                vectors: rotatedVectors
            };
           
            return {
                ...desc,
                descriptor: rotatedDescriptor
            };
        });
    }
   
    // ============================================
    // 🎯 МЕТОД ДЛЯ МЕНЕДЖЕРА
    // ============================================
   
    createFootprint(points, name = '') {
        if (this.debug) {
            console.log(`🎯 Создаю топологический отпечаток "${name}" из ${points.length} точек`);
        }
       
        const normalized = this.normalizePoints(points);
        const descriptors = this.createTopologyDescriptors(normalized);
       
        return {
            points: normalized,
            descriptors: descriptors,
            pointCount: points.length
        };
    }
   
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        return this.comparePoints(
            fp1.points || fp1,
            fp2.points || fp2,
            name1,
            name2
        );
    }
}

module.exports = TopologyAlgorithm;
