// modules/footprint/validation/ValidationModule.js
// 🔍 ПАРАЛЛЕЛЬНЫЙ МОДУЛЬ ВАЛИДАЦИИ (векторный, без пикселей)

const GeometryUtils = require('../topology/utils/GeometryUtils');
const GraphUtils = require('../topology/utils/GraphUtils');

class ValidationModule {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.positionThreshold = options.positionThreshold || 0.15; // 15% от размера
        this.morphologyThreshold = options.morphologyThreshold || 0.85; // 85% сходства
       
        console.log(`🔍 ValidationModule создан`);
        console.log(`   • Порог позиции: ${this.positionThreshold * 100}%`);
        console.log(`   • Порог морфологии: ${this.morphologyThreshold * 100}%`);
    }

    /**
     * Вычисляет преобразование между двумя множествами точек
     * @param {Array} anchors - массив якорей {pointA, pointB, confidence}
     * @param {Object} graphA - граф первого следа (для координат)
     * @param {Object} graphB - граф второго следа (для координат)
     * @returns {Object} - преобразование {scale, rotation, translation}
     */
    calculateTransform(anchors, graphA, graphB) {
        if (this.debug) {
            console.log(`\n📐 ВЫЧИСЛЕНИЕ ПРЕОБРАЗОВАНИЯ ПО ${anchors.length} ЯКОРЯМ`);
        }
      
        if (anchors.length < 2) {
            console.log(`   ⚠️ Недостаточно якорей (нужно минимум 2)`);
            return null;
        }

        const pointsA = [];
        const pointsB = [];
      
        for (const anchor of anchors) {
            const nodeA = graphA.nodes.get(anchor.pointA);
            const nodeB = graphB.nodes.get(anchor.pointB);
          
            if (!nodeA || !nodeB) continue;
          
            pointsA.push({ x: nodeA.x, y: nodeA.y });
            pointsB.push({ x: nodeB.x, y: nodeB.y });
        }

        if (pointsA.length < 2) {
            console.log(`   ⚠️ Недостаточно точек в графах`);
            return null;
        }

        const centerA = GeometryUtils.calculateCentroid(pointsA);
        const centerB = GeometryUtils.calculateCentroid(pointsB);

        let scaleSum = 0;
        let scaleCount = 0;
      
        for (let i = 0; i < pointsA.length; i++) {
            for (let j = i + 1; j < pointsA.length; j++) {
                const distA = GeometryUtils.distance(pointsA[i], pointsA[j]);
                const distB = GeometryUtils.distance(pointsB[i], pointsB[j]);
              
                if (distA > 0 && distB > 0) {
                    scaleSum += distB / distA;
                    scaleCount++;
                }
            }
        }
      
        const scale = scaleCount > 0 ? scaleSum / scaleCount : 1.0;
      
        let rotation = 0;
        if (pointsA.length >= 2) {
            const centeredA = pointsA.map(p => ({
                x: p.x - centerA.x,
                y: p.y - centerA.y
            }));
          
            const centeredB = pointsB.map(p => ({
                x: p.x - centerB.x,
                y: p.y - centerB.y
            }));
          
            let sinSum = 0, cosSum = 0;
          
            for (let i = 0; i < centeredA.length; i++) {
                const scaledA = {
                    x: centeredA[i].x * scale,
                    y: centeredA[i].y * scale
                };
              
                sinSum += scaledA.x * centeredB[i].y - scaledA.y * centeredB[i].x;
                cosSum += scaledA.x * centeredB[i].x + scaledA.y * centeredB[i].y;
            }
          
            rotation = Math.atan2(sinSum, cosSum);
        }

        // 🔥 НОВЫЙ СПОСОБ ВЫЧИСЛЕНИЯ СДВИГА: среднее смещение всех точек после трансформации
        let totalDx = 0;
        let totalDy = 0;
        let validPoints = 0;

        for (let i = 0; i < pointsA.length; i++) {
            const pA = pointsA[i];
            const pB = pointsB[i];
           
            // Применяем масштаб и поворот к точке фото
            const rotatedX = pA.x * scale * Math.cos(rotation) - pA.y * scale * Math.sin(rotation);
            const rotatedY = pA.x * scale * Math.sin(rotation) + pA.y * scale * Math.cos(rotation);
           
            // Смещение для этой точки
            const dx = pB.x - rotatedX;
            const dy = pB.y - rotatedY;
           
            totalDx += dx;
            totalDy += dy;
            validPoints++;
        }

        const translation = {
            x: validPoints > 0 ? totalDx / validPoints : centerB.x - centerA.x,
            y: validPoints > 0 ? totalDy / validPoints : centerB.y - centerA.y
        };

        const transform = {
            scale,
            rotation,
            translation
        };

        if (this.debug) {
            console.log(`\n📊 РЕЗУЛЬТАТ ПРЕОБРАЗОВАНИЯ:`);
            console.log(`   • Масштаб: ${scale.toFixed(3)}`);
            console.log(`   • Поворот: ${(rotation * 180 / Math.PI).toFixed(1)}°`);
            console.log(`   • Сдвиг (новый метод): (${transform.translation.x.toFixed(1)}, ${transform.translation.y.toFixed(1)})`);
           
            // Для сравнения покажем старый метод
            const oldTranslation = {
                x: centerB.x - (centerA.x * scale * Math.cos(rotation) - centerA.y * scale * Math.sin(rotation)),
                y: centerB.y - (centerA.x * scale * Math.sin(rotation) + centerA.y * scale * Math.cos(rotation))
            };
            console.log(`   • Сдвиг (старый метод): (${oldTranslation.x.toFixed(1)}, ${oldTranslation.y.toFixed(1)})`);
        }

        return transform;
    }

    /**
     * Валидирует точку из первого следа
     * @param {Object} pointA - точка из первого следа
     * @param {Array} candidatesB - все точки из второго следа
     * @param {Object} transform - вычисленное преобразование
     * @param {Map} morphologyA - морфология точки A
     * @param {Map} morphologyB - морфология всех точек B
     * @returns {Object} - результат валидации
     */
    validatePoint(pointA, candidatesB, transform, morphologyA, morphologyB) {
        const projected = GeometryUtils.applyTransform(pointA, transform);
       
        const candidates = [];
        const footprintSize = GeometryUtils.getFootprintSize(candidatesB);
       
        for (const pointB of candidatesB) {
            const dist = GeometryUtils.distance(pointB, projected);
            const normDist = dist / footprintSize;
           
            if (normDist < this.positionThreshold) {
                candidates.push({
                    pointB,
                    distance: normDist,
                    pointBDist: dist
                });
            }
        }
       
        if (candidates.length === 0) {
            return {
                validated: false,
                reason: 'no_candidates',
                projected
            };
        }
       
        candidates.sort((a, b) => a.distance - b.distance);
       
        const best = candidates[0];
        const morphA = morphologyA.get(pointA.id);
        const morphB = morphologyB.get(best.pointB.id);
       
        if (!morphA || !morphB) {
            return {
                validated: true,
                pointB: best.pointB,
                confidence: 1 - best.distance,
                method: 'position_only'
            };
        }
       
        const morphScore = this.compareMorphology(morphA, morphB);
       
        if (morphScore >= this.morphologyThreshold) {
            return {
                validated: true,
                pointB: best.pointB,
                confidence: (1 - best.distance) * 0.4 + morphScore * 0.6,
                method: 'position_and_morphology'
            };
        } else {
            return {
                validated: false,
                reason: 'morphology_mismatch',
                bestCandidate: best,
                morphScore,
                projected
            };
        }
    }

    /**
     * Валидирует все точки первого следа
     * @param {Object} graphA - граф первого следа
     * @param {Object} graphB - граф второго следа
     * @param {Array} anchors - якоря
     * @param {Map} morphologyA - морфология первого следа
     * @param {Map} morphologyB - морфология второго следа
     * @returns {Object} - результаты валидации
     */
    validateAll(graphA, graphB, anchors, morphologyA, morphologyB) {
        if (this.debug) {
            console.log(`\n🔍 ЗАПУСК ВАЛИДАЦИИ ВСЕХ ТОЧЕК`);
        }
       
        const transform = this.calculateTransform(anchors, graphA, graphB);
        if (!transform) {
            return {
                success: false,
                error: 'Не удалось вычислить преобразование'
            };
        }

        const pointsA = Array.from(graphA.nodes.values());
        const pointsB = Array.from(graphB.nodes.values());
       
        const anchorSetA = new Set(anchors.map(a => a.pointA));
        const anchorSetB = new Set(anchors.map(a => a.pointB));
       
        const results = {
            anchors: [],
            confirmed: [],
            candidates: [],
            rejected: []
        };

        for (const pointA of pointsA) {
            if (anchorSetA.has(pointA.id)) {
                results.anchors.push({
                    pointA: pointA.id,
                    pointB: anchors.find(a => a.pointA === pointA.id).pointB,
                    confidence: 1.0
                });
                continue;
            }

            const validation = this.validatePoint(
                pointA,
                pointsB.filter(p => !anchorSetB.has(p.id)),
                transform,
                morphologyA,
                morphologyB
            );

            if (validation.validated) {
                results.confirmed.push({
                    pointA: pointA.id,
                    pointB: validation.pointB.id,
                    confidence: validation.confidence,
                    method: validation.method
                });
            } else if (validation.reason === 'no_candidates') {
                results.rejected.push({
                    pointA: pointA.id,
                    reason: 'нет точки рядом',
                    projected: validation.projected
                });
            } else if (validation.reason === 'morphology_mismatch') {
                results.candidates.push({
                    pointA: pointA.id,
                    bestCandidate: validation.bestCandidate.pointB.id,
                    morphScore: validation.morphScore,
                    distance: validation.bestCandidate.distance,
                    projected: validation.projected
                });
            }
        }

        if (this.debug) {
            console.log(`\n📊 РЕЗУЛЬТАТЫ ВАЛИДАЦИИ:`);
            console.log(`   • Якорей: ${results.anchors.length}`);
            console.log(`   • Подтверждено: ${results.confirmed.length}`);
            console.log(`   • Кандидатов: ${results.candidates.length}`);
            console.log(`   • Отвергнуто: ${results.rejected.length}`);
            console.log(`   • ВСЕГО: ${results.anchors.length + results.confirmed.length} точек`);
        }

        return {
            success: true,
            transform,
            results
        };
    }

    /**
     * Находит новые соответствия среди нераспознанных точек
     * @param {Object} graphA - граф первого следа
     * @param {Object} graphB - граф второго следа
     * @param {Array} existingMatches - уже найденные соответствия
     * @param {Object} transform - вычисленное преобразование
     * @param {Map} morphologyA - морфология первого следа
     * @param {Map} morphologyB - морфология второго следа
     * @returns {Array} - новые найденные соответствия
     */
    findNewMatches(graphA, graphB, existingMatches, transform, morphologyA, morphologyB) {
        console.log(`\n🔍 ПОИСК НОВЫХ СООТВЕТСТВИЙ ЧЕРЕЗ ВАЛИДАТОР`);
       
        const usedPointsA = new Set(existingMatches.map(m => m.pointA));
        const usedPointsB = new Set(existingMatches.map(m => m.pointB));
       
        const pointsA = Array.from(graphA.nodes.values());
        const pointsB = Array.from(graphB.nodes.values());
       
        const unmatchedA = pointsA.filter(p => !usedPointsA.has(p.id));
        const unmatchedB = pointsB.filter(p => !usedPointsB.has(p.id));
       
        console.log(`   • Точек без пары в A: ${unmatchedA.length}`);
        console.log(`   • Точек без пары в B: ${unmatchedB.length}`);
       
        const newMatches = [];
        const searchRadius = GeometryUtils.getFootprintSize(pointsB) * this.positionThreshold;
       
        for (const pointA of unmatchedA) {
            const projected = GeometryUtils.applyTransform(pointA, transform);
           
            let bestMatch = null;
            let bestDist = Infinity;
           
            for (const pointB of unmatchedB) {
                const dist = GeometryUtils.distance(pointB, projected);
               
                if (dist < bestDist && dist < searchRadius) {
                    bestDist = dist;
                    bestMatch = pointB;
                }
            }
           
            if (bestMatch) {
                const morphA = morphologyA.get(pointA.id);
                const morphB = morphologyB.get(bestMatch.id);
               
                if (morphA && morphB) {
                    const morphScore = this.compareMorphology(morphA, morphB);
                   
                    if (morphScore >= this.morphologyThreshold) {
                        newMatches.push({
                            pointA: pointA.id,
                            pointB: bestMatch.id,
                            confidence: (1 - bestDist / searchRadius) * 0.6 + morphScore * 0.4,
                            method: 'validator_new',
                            status: 'validator_found'
                        });
                    }
                }
            }
        }
       
        console.log(`\n📊 НАЙДЕНО НОВЫХ СООТВЕТСТВИЙ: ${newMatches.length}`);
        return newMatches;
    }

    /**
     * Сравнивает морфологию двух точек
     * @param {Object} morphA - морфология первой точки
     * @param {Object} morphB - морфология второй точки
     * @returns {number} - оценка сходства (0-1)
     */
    compareMorphology(morphA, morphB) {
        let score = 0;
        let checks = 0;
       
        if (morphA.eccentricity && morphB.eccentricity) {
            const ratio = Math.min(morphA.eccentricity, morphB.eccentricity) /
                         Math.max(morphA.eccentricity, morphB.eccentricity);
            score += ratio;
            checks++;
        }
       
        if (morphA.asymmetry && morphB.asymmetry) {
            const ratio = Math.min(morphA.asymmetry, morphB.asymmetry) /
                         Math.max(morphA.asymmetry, morphB.asymmetry);
            score += ratio;
            checks++;
        }
       
        if (morphA.compactness && morphB.compactness) {
            const ratio = Math.min(morphA.compactness, morphB.compactness) /
                         Math.max(morphA.compactness, morphB.compactness);
            score += ratio;
            checks++;
        }
       
        return checks > 0 ? score / checks : 0.5;
    }
}

module.exports = ValidationModule;
