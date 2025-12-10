// modules/footprint/vector-graph.js
// ВЕКТОРНЫЕ СХЕМЫ (ЗВЁЗДНЫЕ) ДЛЯ ТОЧНОГО СОВМЕЩЕНИЯ

class VectorGraph {
    constructor(options = {}) {
        this.points = options.points || [];
        this.starVectors = []; // Звёздные векторы от каждой точки
        this.centroid = { x: 0, y: 0 };
        this.config = {
            maxVectorsPerPoint: options.maxVectorsPerPoint || 10,
            normalizeVectors: true,
            enableRotationInvariant: true
        };
    }

    // 1. СОЗДАТЬ ЗВЁЗДНЫЕ ВЕКТОРЫ ИЗ ТОЧЕК
    createFromPoints(points) {
        if (!points || points.length < 4) {
            console.log('⚠️ Слишком мало точек для векторной схемы');
            return null;
        }

        this.points = points;
        this.calculateCentroid();
        this.buildStarVectors();
       
        return this.starVectors;
    }

    // 2. РАССЧИТАТЬ ЦЕНТРОИД
    calculateCentroid() {
        if (this.points.length === 0) {
            this.centroid = { x: 0, y: 0 };
            return;
        }

        let sumX = 0, sumY = 0;
        this.points.forEach(p => {
            sumX += p.x;
            sumY += p.y;
        });

        this.centroid = {
            x: sumX / this.points.length,
            y: sumY / this.points.length
        };
    }

    // 3. ПОСТРОИТЬ ЗВЁЗДНЫЕ ВЕКТОРЫ
    buildStarVectors() {
        const n = this.points.length;
        this.starVectors = new Array(n);
       
        // Для каждой точки создаём векторы ко всем другим точкам
        for (let i = 0; i < n; i++) {
            const pointVectors = [];
           
            for (let j = 0; j < n; j++) {
                if (i === j) continue;
               
                const dx = this.points[j].x - this.points[i].x;
                const dy = this.points[j].y - this.points[i].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
               
                pointVectors.push({
                    toPoint: j,
                    dx,
                    dy,
                    distance,
                    angle,
                    normalized: {
                        dx: dx / distance || 0,
                        dy: dy / distance || 0
                    }
                });
            }
           
            // Отсортировать по расстоянию и взять ближайшие
            pointVectors.sort((a, b) => a.distance - b.distance);
            const selectedVectors = pointVectors.slice(
                0, this.config.maxVectorsPerPoint
            );
           
            // Нормализовать если нужно
            if (this.config.normalizeVectors) {
                this.normalizePointVectors(selectedVectors);
            }
           
            this.starVectors[i] = {
                pointIndex: i,
                point: this.points[i],
                vectors: selectedVectors,
                signature: this.calculatePointSignature(selectedVectors)
            };
        }
    }

    // 4. НОРМАЛИЗОВАТЬ ВЕКТОРЫ ТОЧКИ
    normalizePointVectors(vectors) {
        if (vectors.length === 0) return;
       
        // Отсортировать по углу для создания последовательности
        vectors.sort((a, b) => a.angle - b.angle);
       
        // Создать векторную сумму для нормализации
        let sumDx = 0, sumDy = 0;
        vectors.forEach(v => {
            sumDx += v.dx;
            sumDy += v.dy;
        });
       
        const magnitude = Math.sqrt(sumDx * sumDx + sumDy * sumDy) || 1;
       
        vectors.forEach(v => {
            v.normalized.dx = v.dx / magnitude;
            v.normalized.dy = v.dy / magnitude;
        });
    }

    // 5. РАССЧИТАТЬ СИГНАТУРУ ТОЧКИ (инвариантную к вращению)
    calculatePointSignature(vectors) {
        if (vectors.length === 0) return null;
       
        const signature = {
            angles: [],
            distances: [],
            angleHistogram: new Array(8).fill(0),
            distanceHistogram: new Array(4).fill(0)
        };
       
        // Собрать углы и расстояния
        vectors.forEach(v => {
            signature.angles.push(v.angle);
            signature.distances.push(v.distance);
           
            // Гистограмма углов (8 направлений)
            const angleIndex = Math.floor(
                ((v.angle + Math.PI) / (2 * Math.PI)) * 8
            ) % 8;
            signature.angleHistogram[angleIndex]++;
           
            // Гистограмма расстояний (4 уровня)
            if (v.distance > 0) {
                const maxDist = Math.max(...signature.distances);
                const distLevel = Math.floor((v.distance / maxDist) * 4) % 4;
                signature.distanceHistogram[distLevel]++;
            }
        });
       
        // Нормализовать гистограммы
        const totalAngles = signature.angles.length;
        const totalDistances = signature.distances.length;
       
        if (totalAngles > 0) {
            signature.angleHistogram = signature.angleHistogram.map(
                val => val / totalAngles
            );
        }
       
        if (totalDistances > 0) {
            signature.distanceHistogram = signature.distanceHistogram.map(
                val => val / totalDistances
            );
        }
       
        return signature;
    }

    // 6. СРАВНИТЬ С ДРУГОЙ ВЕКТОРНОЙ СХЕМОЙ
    compare(otherVectorGraph) {
        if (!this.starVectors || !otherVectorGraph.starVectors) {
            return { similarity: 0, error: 'Векторные схемы не созданы' };
        }
       
        const n1 = this.starVectors.length;
        const n2 = otherVectorGraph.starVectors.length;
       
        // Найти потенциальные соответствия точек
        const pointMatches = this.findPointMatches(otherVectorGraph);
       
        // Рассчитать схожесть на основе совпадающих точек
        const similarity = this.calculateSimilarityFromMatches(pointMatches);
       
        // Найти трансформацию для объединения
        const transformation = this.findTransformation(pointMatches);
       
        return {
            similarity,
            transformation,
            pointMatches: pointMatches.slice(0, 10), // Первые 10 совпадений
            totalMatches: pointMatches.length,
            maxPossibleMatches: Math.min(n1, n2),
            details: {
                n1, n2,
                matchRatio: pointMatches.length / Math.min(n1, n2)
            }
        };
    }

    // 7. НАЙТИ СООТВЕТСТВИЯ ТОЧЕК
    findPointMatches(otherVectorGraph) {
        const matches = [];
        const usedJ = new Set();
       
        // Для каждой точки в этой схеме найти лучшую пару в другой
        for (let i = 0; i < this.starVectors.length; i++) {
            const pointA = this.starVectors[i];
            let bestMatch = null;
            let bestScore = 0;
            let bestJ = -1;
           
            for (let j = 0; j < otherVectorGraph.starVectors.length; j++) {
                if (usedJ.has(j)) continue;
               
                const pointB = otherVectorGraph.starVectors[j];
                const score = this.comparePointSignatures(
                    pointA.signature,
                    pointB.signature
                );
               
                if (score > bestScore && score > 0.7) {
                    bestScore = score;
                    bestMatch = pointB;
                    bestJ = j;
                }
            }
           
            if (bestMatch) {
                matches.push({
                    pointA: pointA.pointIndex,
                    pointB: bestMatch.pointIndex,
                    score: bestScore,
                    distance: this.calculatePointDistance(pointA, bestMatch)
                });
                usedJ.add(bestJ);
            }
        }
       
        // Отсортировать по уверенности
        matches.sort((a, b) => b.score - a.score);
        return matches;
    }

    // 8. СРАВНИТЬ СИГНАТУРЫ ТОЧЕК
    comparePointSignatures(sigA, sigB) {
        if (!sigA || !sigB) return 0;
       
        // Сравнить гистограммы углов
        let angleScore = 0;
        for (let k = 0; k < 8; k++) {
            const diff = Math.abs(sigA.angleHistogram[k] - sigB.angleHistogram[k]);
            angleScore += 1 - diff;
        }
        angleScore /= 8;
       
        // Сравнить гистограммы расстояний
        let distanceScore = 0;
        for (let k = 0; k < 4; k++) {
            const diff = Math.abs(sigA.distanceHistogram[k] - sigB.distanceHistogram[k]);
            distanceScore += 1 - diff;
        }
        distanceScore /= 4;
       
        // Общий score (взвешенный)
        return angleScore * 0.6 + distanceScore * 0.4;
    }

    // 9. РАССЧИТАТЬ РАССТОЯНИЕ МЕЖДУ ТОЧКАМИ
    calculatePointDistance(pointA, pointB) {
        const dx = pointB.point.x - pointA.point.x;
        const dy = pointB.point.y - pointA.point.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 10. РАССЧИТАТЬ СХОЖЕСТЬ ИЗ СОВПАДЕНИЙ
    calculateSimilarityFromMatches(matches) {
        if (matches.length === 0) return 0;
       
        const totalScore = matches.reduce((sum, match) => sum + match.score, 0);
        const avgScore = totalScore / matches.length;
       
        // Учесть количество совпадений
        const maxPoints = Math.max(this.starVectors.length, 1);
        const coverage = matches.length / maxPoints;
       
        // Общая схожесть
        return avgScore * coverage;
    }

    // 11. НАЙТИ ТРАНСФОРМАЦИЮ ДЛЯ ОБЪЕДИНЕНИЯ
    findTransformation(matches) {
        if (matches.length < 3) {
            return {
                type: 'insufficient_points',
                translation: { dx: 0, dy: 0 },
                rotation: 0,
                scale: 1,
                confidence: 0
            };
        }
       
        // Использовать первые 5 лучших совпадений для точности
        const bestMatches = matches.slice(0, Math.min(5, matches.length));
       
        // Рассчитать среднее смещение
        let sumDx = 0, sumDy = 0;
        bestMatches.forEach(match => {
            const pointA = this.points[match.pointA];
            const pointB = this.starVectors.find(
                sv => sv.pointIndex === match.pointB
            )?.point;
           
            if (pointA && pointB) {
                sumDx += pointB.x - pointA.x;
                sumDy += pointB.y - pointA.y;
            }
        });
       
        const translation = {
            dx: sumDx / bestMatches.length,
            dy: sumDy / bestMatches.length
        };
       
        // Простая трансформация (только смещение)
        // В будущем можно добавить поворот и масштаб
       
        return {
            type: 'translation',
            translation,
            rotation: 0,
            scale: 1,
            confidence: bestMatches.reduce((sum, m) => sum + m.score, 0) / bestMatches.length,
            matchesUsed: bestMatches.length
        };
    }

    // 12. ПРИМЕНИТЬ ТРАНСФОРМАЦИЮ К ТОЧКАМ
    applyTransformation(points, transformation) {
        if (!transformation || transformation.type !== 'translation') {
            return points;
        }
       
        return points.map(p => ({
            x: p.x + transformation.translation.dx,
            y: p.y + transformation.translation.dy,
            confidence: p.confidence || 0.5
        }));
    }

    // 13. ОБЪЕДИНИТЬ С ДРУГОЙ СХЕМОЙ
    merge(otherVectorGraph, transformation = null) {
        const comparison = this.compare(otherVectorGraph);
       
        if (comparison.similarity < 0.6) {
            return {
                success: false,
                reason: `Низкая схожесть: ${comparison.similarity.toFixed(3)}`,
                ...comparison
            };
        }
       
        // Применить трансформацию если есть
        let transformedPoints = otherVectorGraph.points;
        if (transformation) {
            transformedPoints = this.applyTransformation(
                otherVectorGraph.points,
                transformation
            );
        } else if (comparison.transformation) {
            transformedPoints = this.applyTransformation(
                otherVectorGraph.points,
                comparison.transformation
            );
        }
       
        // Объединить точки
        const mergedPoints = [...this.points, ...transformedPoints];
       
        // Создать новую векторную схему из объединённых точек
        const mergedGraph = new VectorGraph({
            points: mergedPoints,
            maxVectorsPerPoint: this.config.maxVectorsPerPoint
        });
       
        mergedGraph.createFromPoints(mergedPoints);
       
        return {
            success: true,
            mergedPoints: mergedPoints.length,
            originalPoints: this.points.length,
            addedPoints: transformedPoints.length,
            similarity: comparison.similarity,
            transformation: transformation || comparison.transformation,
            mergedGraph
        };
    }

    // 14. ВИЗУАЛИЗИРОВАТЬ СХЕМУ
    visualize(maxPoints = 5) {
        console.log(`\n🎯 ВЕКТОРНАЯ СХЕМА (${this.points.length} точек):`);
        console.log(`├─ Центроид: (${this.centroid.x.toFixed(1)}, ${this.centroid.y.toFixed(1)})`);
        console.log(`├─ Звёздных векторов: ${this.starVectors.length}`);
       
        // Показать первые несколько точек с их векторами
        for (let i = 0; i < Math.min(maxPoints, this.starVectors.length); i++) {
            const sv = this.starVectors[i];
            console.log(`├─ Точка ${i}: (${sv.point.x.toFixed(1)}, ${sv.point.y.toFixed(1)})`);
            console.log(`│  └─ Векторов: ${sv.vectors.length}`);
           
            if (sv.signature) {
                const angleHist = sv.signature.angleHistogram
                    .map(v => v.toFixed(2))
                    .join(' ');
                console.log(`│     📐 Углы: [${angleHist}]`);
            }
        }
       
        if (this.starVectors.length > maxPoints) {
            console.log(`└─ ... и ещё ${this.starVectors.length - maxPoints} точек`);
        }
    }

    // 15. СОХРАНИТЬ В JSON
    toJSON() {
        // Сохраняем только необходимые данные
        return {
            points: this.points,
            centroid: this.centroid,
            pointsCount: this.points.length,
            vectorsCount: this.starVectors.length,
            config: this.config
        };
    }

    // 16. ЗАГРУЗИТЬ ИЗ JSON
    static fromJSON(data) {
        const graph = new VectorGraph({
            points: data.points || [],
            maxVectorsPerPoint: data.config?.maxVectorsPerPoint || 10
        });
       
        graph.centroid = data.centroid || { x: 0, y: 0 };
        graph.createFromPoints(graph.points);
       
        return graph;
    }
}

module.exports = VectorGraph;
