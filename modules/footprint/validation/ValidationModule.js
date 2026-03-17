// modules/footprint/validation/ValidationModule.js
// 🔍 ПАРАЛЛЕЛЬНЫЙ МОДУЛЬ ВАЛИДАЦИИ (векторный, без пикселей)

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
        console.log(`\n📐 ВЫЧИСЛЕНИЕ ПРЕОБРАЗОВАНИЯ ПО ${anchors.length} ЯКОРЯМ`);
       
        if (anchors.length < 2) {
            console.log(`   ⚠️ Недостаточно якорей (нужно минимум 2)`);
            return null;
        }

        // Берём точки из графов
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

        // Вычисляем центры масс
        const centerA = this.calculateCentroid(pointsA);
        const centerB = this.calculateCentroid(pointsB);

        // Вычисляем масштаб (среднее отношение расстояний)
        let scaleSum = 0;
        let scaleCount = 0;
       
        for (let i = 0; i < pointsA.length; i++) {
            for (let j = i + 1; j < pointsA.length; j++) {
                const distA = this.calcDistance(pointsA[i], pointsA[j]);
                const distB = this.calcDistance(pointsB[i], pointsB[j]);
               
                if (distA > 0 && distB > 0) {
                    scaleSum += distB / distA;
                    scaleCount++;
                }
            }
        }
       
        const scale = scaleCount > 0 ? scaleSum / scaleCount : 1.0;
       
        // Вычисляем поворот (метод наименьших квадратов)
        let rotation = 0;
        if (pointsA.length >= 2) {
            // Центрируем точки
            const centeredA = pointsA.map(p => ({
                x: p.x - centerA.x,
                y: p.y - centerA.y
            }));
           
            const centeredB = pointsB.map(p => ({
                x: p.x - centerB.x,
                y: p.y - centerB.y
            }));
           
            // Вычисляем угол поворота
            let sinSum = 0, cosSum = 0;
           
            for (let i = 0; i < centeredA.length; i++) {
                // Масштабируем A
                const scaledA = {
                    x: centeredA[i].x * scale,
                    y: centeredA[i].y * scale
                };
               
                sinSum += scaledA.x * centeredB[i].y - scaledA.y * centeredB[i].x;
                cosSum += scaledA.x * centeredB[i].x + scaledA.y * centeredB[i].y;
            }
           
            rotation = Math.atan2(sinSum, cosSum);
        }

        const transform = {
            scale,
            rotation,
            translation: {
                x: centerB.x - (centerA.x * scale * Math.cos(rotation) - centerA.y * scale * Math.sin(rotation)),
                y: centerB.y - (centerA.x * scale * Math.sin(rotation) + centerA.y * scale * Math.cos(rotation))
            }
        };

        console.log(`\n📊 РЕЗУЛЬТАТ ПРЕОБРАЗОВАНИЯ:`);
        console.log(`   • Масштаб: ${scale.toFixed(3)}`);
        console.log(`   • Поворот: ${(rotation * 180 / Math.PI).toFixed(1)}°`);
        console.log(`   • Сдвиг: (${transform.translation.x.toFixed(1)}, ${transform.translation.y.toFixed(1)})`);

        return transform;
    }

    /**
     * Применяет преобразование к точке
     */
    applyTransform(point, transform) {
        const { scale, rotation, translation } = transform;
       
        // Поворот и масштаб
        const xRot = point.x * Math.cos(rotation) - point.y * Math.sin(rotation);
        const yRot = point.x * Math.sin(rotation) + point.y * Math.cos(rotation);
       
        // Масштаб и сдвиг
        return {
            x: xRot * scale + translation.x,
            y: yRot * scale + translation.y
        };
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
        // Проецируем точку A в пространство B
        const projected = this.applyTransform(pointA, transform);
       
        // Ищем ближайшие реальные точки
        const candidates = [];
       
        for (const pointB of candidatesB) {
            const dx = pointB.x - projected.x;
            const dy = pointB.y - projected.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
           
            // Нормируем расстояние относительно размера следа
            const normDist = dist / this.getFootprintSize(candidatesB);
           
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
       
        // Сортируем по расстоянию
        candidates.sort((a, b) => a.distance - b.distance);
       
        // Проверяем морфологию лучшего кандидата
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
       
        // Сравниваем морфологию (эксцентриситет и асимметрия)
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
        console.log(`\n🔍 ЗАПУСК ВАЛИДАЦИИ ВСЕХ ТОЧЕК`);
       
        // Вычисляем преобразование по якорям
        const transform = this.calculateTransform(anchors, graphA, graphB);
        if (!transform) {
            return {
                success: false,
                error: 'Не удалось вычислить преобразование'
            };
        }

        // Получаем все точки из графов
        const pointsA = Array.from(graphA.nodes.values());
        const pointsB = Array.from(graphB.nodes.values());
       
        // Создаём множество якорей для быстрого поиска
        const anchorSetA = new Set(anchors.map(a => a.pointA));
        const anchorSetB = new Set(anchors.map(a => a.pointB));
       
        const results = {
            anchors: [],      // уже известные якоря
            confirmed: [],    // новые подтверждённые точки
            candidates: [],   // точки, требующие проверки
            rejected: []      // точки, не прошедшие валидацию
        };

        // Валидируем каждую точку из A
        for (const pointA of pointsA) {
            // Пропускаем якоря
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
                pointsB.filter(p => !anchorSetB.has(p.id)), // исключаем якоря из кандидатов
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

        console.log(`\n📊 РЕЗУЛЬТАТЫ ВАЛИДАЦИИ:`);
        console.log(`   • Якорей: ${results.anchors.length}`);
        console.log(`   • Подтверждено: ${results.confirmed.length}`);
        console.log(`   • Кандидатов: ${results.candidates.length}`);
        console.log(`   • Отвергнуто: ${results.rejected.length}`);
        console.log(`   • ВСЕГО: ${results.anchors.length + results.confirmed.length} точек`);

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
   
    // Создаём множества уже использованных точек
    const usedPointsA = new Set(existingMatches.map(m => m.pointA));
    const usedPointsB = new Set(existingMatches.map(m => m.pointB));
   
    // Получаем все точки из графов
    const pointsA = Array.from(graphA.nodes.values());
    const pointsB = Array.from(graphB.nodes.values());
   
    // Фильтруем только неиспользованные
    const unmatchedA = pointsA.filter(p => !usedPointsA.has(p.id));
    const unmatchedB = pointsB.filter(p => !usedPointsB.has(p.id));
   
    console.log(`   • Точек без пары в A: ${unmatchedA.length}`);
    console.log(`   • Точек без пары в B: ${unmatchedB.length}`);
   
    const newMatches = [];
    const searchRadius = this.getFootprintSize(pointsB) * this.positionThreshold; // 15% от размера
   
    for (const pointA of unmatchedA) {
        // Проецируем точку A в пространство B
        const projected = this.applyTransform(pointA, transform);
       
        // Ищем ближайшую точку в B
        let bestMatch = null;
        let bestDist = Infinity;
       
        for (const pointB of unmatchedB) {
            const dx = pointB.x - projected.x;
            const dy = pointB.y - projected.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
           
            if (dist < bestDist && dist < searchRadius) {
                bestDist = dist;
                bestMatch = pointB;
            }
        }
       
        if (bestMatch) {
            // Проверяем морфологию
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
     * Вычисляет центроид множества точек
     */
    calculateCentroid(points) {
        if (points.length === 0) return { x: 0, y: 0 };
       
        let sumX = 0, sumY = 0;
        for (const p of points) {
            sumX += p.x;
            sumY += p.y;
        }
       
        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    /**
     * Вычисляет расстояние между двумя точками
     */
    calcDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx*dx + dy*dy);
    }

    /**
     * Оценивает размер следа (для нормализации расстояний)
     */
    getFootprintSize(points) {
        if (points.length === 0) return 1;
       
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        for (const p of points) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }
       
        return Math.max(maxX - minX, maxY - minY);
    }

    /**
     * Сравнивает морфологию двух точек
     */
    compareMorphology(morphA, morphB) {
        let score = 0;
        let checks = 0;
       
        // Эксцентриситет
        if (morphA.eccentricity && morphB.eccentricity) {
            const ratio = Math.min(morphA.eccentricity, morphB.eccentricity) /
                         Math.max(morphA.eccentricity, morphB.eccentricity);
            score += ratio;
            checks++;
        }
       
        // Асимметрия
        if (morphA.asymmetry && morphB.asymmetry) {
            const ratio = Math.min(morphA.asymmetry, morphB.asymmetry) /
                         Math.max(morphA.asymmetry, morphB.asymmetry);
            score += ratio;
            checks++;
        }
       
        // Компактность (если есть)
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
