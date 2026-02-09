// modules/footprint/clean/vector-algorithm.js
// 🎯 ГЕОМЕТРИЧЕСКИЕ ДЕСКРИПТОРЫ (как SIFT но без картинок)

class VectorAlgorithm {
    constructor(options = {}) {
        this.descriptorSize = options.descriptorSize || 8; // 8-мерный дескриптор
        this.neighborsForDescriptor = options.neighborsForDescriptor || 8; // 8 соседей для дескриптора
        this.angleBins = options.angleBins || 8; // 8 направлений (как SIFT)
        this.distanceBins = options.distanceBins || 4; // 4 расстояния
        this.minSimilarity = options.minSimilarity || 0.6;
        this.debug = options.debug !== false;
       
        console.log(`🎯 Геометрические дескрипторы: ${this.descriptorSize}D, ${this.neighborsForDescriptor} соседей`);
    }

    // 🔥 СОЗДАНИЕ ГЕОМЕТРИЧЕСКИХ ДЕСКРИПТОРОВ
    createFootprint(points, name = '') {
        console.log(`🎯 Создаю геометрические дескрипторы из ${points.length} точек`);

        if (points.length < 5) {
            console.log(`⚠️ Слишком мало точек: ${points.length}`);
            return this.createSimpleFootprint(points, name);
        }

        const vectorFootprint = [];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
           
            // 🔥 СОЗДАЕМ ГЕОМЕТРИЧЕСКИЙ ДЕСКРИПТОР
            const descriptor = this.createGeometricDescriptor(point, points, i);
           
            vectorFootprint.push({
                originalId: point.id || `pt_${i}`,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                index: i,
               
                // 🔥 ГЕОМЕТРИЧЕСКИЙ ДЕСКРИПТОР
                descriptor: descriptor.values,
                descriptorHash: descriptor.hash,
                vectorId: descriptor.hash,
               
                // Для сравнения
                dominantAngles: descriptor.dominantAngles,
               
                confirmedCount: 1
            });
        }

        if (this.debug && vectorFootprint.length > 0) {
            console.log(`✅ Создано ${vectorFootprint.length} геометрических дескрипторов`);
            const sample = vectorFootprint[0];
            console.log(`   Пример дескриптора: ${sample.descriptorHash.substring(0, 50)}...`);
            console.log(`   Доминирующие углы: ${sample.dominantAngles?.join(', ')}°`);
        }

        return vectorFootprint;
    }

    // 🔥 СОЗДАНИЕ ГЕОМЕТРИЧЕСКОГО ДЕСКРИПТОРА
    createGeometricDescriptor(centerPoint, allPoints, centerIndex) {
        // Находим соседей
        const neighbors = this.findNearestNeighbors(centerPoint, allPoints, centerIndex, this.neighborsForDescriptor);
       
        if (neighbors.length < 3) {
            return this.createSimpleDescriptor(centerPoint, neighbors);
        }
       
        // 🔥 1. ВЫЧИСЛЯЕМ ГРАДИЕНТЫ НАПРАВЛЕНИЙ (как в SIFT)
        const gradients = this.calculateDirectionGradients(centerPoint, neighbors);
       
        // 🔥 2. СОЗДАЕМ ГИСТОГРАММУ НАПРАВЛЕНИЙ
        const angleHistogram = this.createAngleHistogram(gradients, this.angleBins);
       
        // 🔥 3. СОЗДАЕМ ГИСТОГРАММУ РАССТОЯНИЙ
        const distanceHistogram = this.createDistanceHistogram(centerPoint, neighbors, this.distanceBins);
       
        // 🔥 4. КОМБИНИРУЕМ В ДЕСКРИПТОР
        const descriptor = this.combineHistograms(angleHistogram, distanceHistogram);
       
        // 🔥 5. НОРМАЛИЗУЕМ И КВАНТУЕМ
        const normalized = this.normalizeDescriptor(descriptor);
        const quantized = this.quantizeDescriptor(normalized);
        const descriptorHash = this.createDescriptorHash(quantized);
       
        // Находим доминирующие направления
        const dominantAngles = this.findDominantAngles(angleHistogram);
       
        return {
            values: quantized,
            hash: descriptorHash,
            dominantAngles: dominantAngles,
            neighborCount: neighbors.length
        };
    }

    // 🔥 ВЫЧИСЛЕНИЕ ГРАДИЕНТОВ НАПРАВЛЕНИЙ
    calculateDirectionGradients(centerPoint, neighbors) {
        const gradients = [];
       
        for (const neighbor of neighbors) {
            const dx = neighbor.x - centerPoint.x;
            const dy = neighbor.y - centerPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI; // -180..180
           
            // Нормализуем угол к 0..360
            const normalizedAngle = ((angle % 360) + 360) % 360;
           
            // Величина градиента = обратное расстояние (близкие соседи важнее)
            const magnitude = 1 / (distance + 1);
           
            gradients.push({
                angle: normalizedAngle,
                magnitude: magnitude,
                distance: distance
            });
        }
       
        return gradients;
    }

    // 🔥 ГИСТОГРАММА НАПРАВЛЕНИЙ
    createAngleHistogram(gradients, bins) {
        const histogram = new Array(bins).fill(0);
        const binSize = 360 / bins;
       
        for (const grad of gradients) {
            const bin = Math.min(bins - 1, Math.floor(grad.angle / binSize));
            histogram[bin] += grad.magnitude;
        }
       
        return histogram;
    }

    // 🔥 ГИСТОГРАММА РАССТОЯНИЙ
    createDistanceHistogram(centerPoint, neighbors, bins) {
        if (neighbors.length === 0) return new Array(bins).fill(0);
       
        // Находим максимальное расстояние
        const maxDistance = Math.max(...neighbors.map(n =>
            Math.sqrt(Math.pow(n.x - centerPoint.x, 2) + Math.pow(n.y - centerPoint.y, 2))
        ));
       
        if (maxDistance === 0) return new Array(bins).fill(0);
       
        const histogram = new Array(bins).fill(0);
        const binSize = maxDistance / bins;
       
        for (const neighbor of neighbors) {
            const distance = Math.sqrt(
                Math.pow(neighbor.x - centerPoint.x, 2) +
                Math.pow(neighbor.y - centerPoint.y, 2)
            );
            const bin = Math.min(bins - 1, Math.floor(distance / binSize));
            histogram[bin] += 1;
        }
       
        return histogram;
    }

    // 🔥 КОМБИНАЦИЯ ГИСТОГРАММ
    combineHistograms(angleHistogram, distanceHistogram) {
        return [...angleHistogram, ...distanceHistogram];
    }

    // 🔥 НОРМАЛИЗАЦИЯ ДЕСКРИПТОРА
    normalizeDescriptor(descriptor) {
        const sum = descriptor.reduce((s, v) => s + v, 0);
        if (sum === 0) return descriptor;
       
        return descriptor.map(v => v / sum);
    }

    // 🔥 КВАНТОВАНИЕ (для хэша)
    quantizeDescriptor(descriptor) {
        // Квантуем до 4 уровней (0, 0.33, 0.66, 1.0)
        return descriptor.map(v => {
            if (v < 0.25) return 0;
            if (v < 0.5) return 1;
            if (v < 0.75) return 2;
            return 3;
        });
    }

    // 🔥 СОЗДАНИЕ ХЭША ДЕСКРИПТОРА
    createDescriptorHash(quantized) {
        return `DESC_${quantized.join('')}`;
    }

    // 🔥 НАХОЖДЕНИЕ ДОМИНИРУЮЩИХ УГЛОВ
    findDominantAngles(angleHistogram) {
        const bins = angleHistogram.length;
        const binSize = 360 / bins;
       
        // Находим 2 самых сильных направления
        const sorted = angleHistogram
            .map((value, index) => ({ value, angle: index * binSize }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 2);
       
        return sorted.map(item => Math.round(item.angle));
    }

    // 🔥 СРАВНЕНИЕ ДЕСКРИПТОРОВ
    compareFootprints(fp1, fp2, name1 = 'Отпечаток 1', name2 = 'Отпечаток 2') {
        console.log(`\n🔍 СРАВНЕНИЕ ГЕОМЕТРИЧЕСКИХ ДЕСКРИПТОРОВ: ${name1} (${fp1.length}) vs ${name2} (${fp2.length})`);

        if (fp1.length === 0 || fp2.length === 0) {
            return this.createEmptyComparisonResult();
        }

        try {
            // 🔥 ПАРНОЕ СРАВНЕНИЕ (как в SIFT)
            const matches = [];
            const used2 = new Set();
           
            // Для каждой точки из первого следа
            for (const point1 of fp1) {
                let bestMatch = null;
                let bestSimilarity = 0;
               
                // Ищем лучшего кандидата во втором следе
                for (let j = 0; j < fp2.length; j++) {
                    if (used2.has(j)) continue;
                   
                    const point2 = fp2[j];
                    const similarity = this.compareDescriptors(point1.descriptor, point2.descriptor);
                   
                    if (similarity > bestSimilarity && similarity > 0.7) { // 70% порог
                        bestSimilarity = similarity;
                        bestMatch = { point: point2, index: j, similarity: similarity };
                    }
                }
               
                // Если нашли хорошее совпадение
                if (bestMatch) {
                    // 🔥 ПРОВЕРКА ОДНОЗНАЧНОСТИ (ratio test как в SIFT)
                    let secondBestSimilarity = 0;
                   
                    for (let j = 0; j < fp2.length; j++) {
                        if (j === bestMatch.index) continue;
                        if (used2.has(j)) continue;
                       
                        const similarity = this.compareDescriptors(point1.descriptor, fp2[j].descriptor);
                        if (similarity > secondBestSimilarity) {
                            secondBestSimilarity = similarity;
                        }
                    }
                   
                    // Ratio test: best / secondBest > 1.5
                    if (secondBestSimilarity === 0 || (bestMatch.similarity / secondBestSimilarity) > 1.5) {
                        matches.push({
                            point1: point1,
                            point2: bestMatch.point,
                            similarity: bestMatch.similarity,
                            matchLevel: 'descriptor_match',
                            ratio: secondBestSimilarity > 0 ? (bestMatch.similarity / secondBestSimilarity).toFixed(2) : 'inf'
                        });
                        used2.add(bestMatch.index);
                    }
                }
            }
           
            const matchedPoints = matches.length;
            const maxPossible = Math.min(fp1.length, fp2.length);
            const similarity = maxPossible > 0 ? matchedPoints / maxPossible : 0;
           
            const isSame = similarity >= this.minSimilarity;
            const decision = isSame ? 'same' : 'different';
           
            console.log(`📊 РЕЗУЛЬТАТ:`);
            console.log(`   Уникальные совпадения дескрипторов: ${matchedPoints}/${maxPossible}`);
            console.log(`   Схожесть: ${(similarity * 100).toFixed(1)}% (порог: ${this.minSimilarity * 100}%)`);
            console.log(`   Решение: ${decision}`);
           
            if (matches.length > 0) {
                const avgSimilarity = matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length;
                console.log(`   Средняя схожесть дескрипторов: ${(avgSimilarity * 100).toFixed(1)}%`);
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

    // 🔥 СРАВНЕНИЕ ДЕСКРИПТОРОВ (евклидово расстояние)
    compareDescriptors(desc1, desc2) {
        if (!desc1 || !desc2 || desc1.length !== desc2.length) return 0;
       
        let sumSq = 0;
        for (let i = 0; i < desc1.length; i++) {
            const diff = desc1[i] - desc2[i];
            sumSq += diff * diff;
        }
       
        const distance = Math.sqrt(sumSq);
        const maxDistance = Math.sqrt(desc1.length * 9); // Макс. расстояние для 0-3 значений
       
        return Math.max(0, 1 - (distance / maxDistance));
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
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

    createSimpleDescriptor(centerPoint, neighbors) {
        const values = new Array(this.descriptorSize).fill(0);
       
        if (neighbors.length > 0) {
            // Простой дескриптор на основе направления к первому соседу
            const dx = neighbors[0].x - centerPoint.x;
            const dy = neighbors[0].y - centerPoint.y;
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const normalizedAngle = ((angle % 360) + 360) % 360;
           
            const bin = Math.min(this.angleBins - 1, Math.floor(normalizedAngle / (360 / this.angleBins)));
            values[bin] = 1;
        }
       
        const quantized = this.quantizeDescriptor(values);
        const hash = this.createDescriptorHash(quantized);
       
        return {
            values: quantized,
            hash: hash,
            dominantAngles: [],
            neighborCount: neighbors.length
        };
    }

    createSimpleFootprint(points, name = '') {
        const footprint = [];
       
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const neighbors = this.findNearestNeighbors(point, points, i, 3);
            const descriptor = this.createSimpleDescriptor(point, neighbors);
           
            footprint.push({
                originalId: point.id || `pt_${i}`,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                descriptor: descriptor.values,
                descriptorHash: descriptor.hash,
                vectorId: descriptor.hash,
                confirmedCount: 1
            });
        }
       
        return footprint;
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
}

module.exports = VectorAlgorithm;
