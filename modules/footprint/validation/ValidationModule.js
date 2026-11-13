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
        console.log(`\n📐 ВЫЧИСЛЕНИЕ ПРЕОБРАЗОВАНИЯ ПО ${anchors.length} ЯКОРЯМ`);
      
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
          
            pointsA.push({ x: nodeA.x, y: nodeA.y, confidence: anchor.confidence || 0.5 });
            pointsB.push({ x: nodeB.x, y: nodeB.y, confidence: anchor.confidence || 0.5 });
        }

        if (pointsA.length < 2) {
            console.log(`   ⚠️ Недостаточно точек в графах`);
            return null;
        }

        // ===== ИТЕРАЦИЯ 1: ВЫЧИСЛЯЕМ НА ВСЕХ ТОЧКАХ =====
        const centerA = GeometryUtils.calculateCentroid(pointsA);
        const centerB = GeometryUtils.calculateCentroid(pointsB);

        let scaleSum = 0, scaleCount = 0;
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
            const centeredA = pointsA.map(p => ({ x: p.x - centerA.x, y: p.y - centerA.y }));
            const centeredB = pointsB.map(p => ({ x: p.x - centerB.x, y: p.y - centerB.y }));
            let sinSum = 0, cosSum = 0;
            for (let i = 0; i < centeredA.length; i++) {
                const scaledA = { x: centeredA[i].x * scale, y: centeredA[i].y * scale };
                sinSum += scaledA.x * centeredB[i].y - scaledA.y * centeredB[i].x;
                cosSum += scaledA.x * centeredB[i].x + scaledA.y * centeredB[i].y;
            }
            rotation = Math.atan2(sinSum, cosSum);
        }

        // Сдвиг через центры (старый метод)
        const translation = {
            x: centerB.x - (centerA.x * scale * Math.cos(rotation) - centerA.y * scale * Math.sin(rotation)),
            y: centerB.y - (centerA.x * scale * Math.sin(rotation) + centerA.y * scale * Math.cos(rotation))
        };

        // ===== 🔥 ШАГ 3 (ВАРИАНТ B): РОБАСТНЫЙ КОНСЕНСУС =====
        // Медианный фильтр ниже не работает, когда >50% якорей мусорные (медиана
        // мусорная → порог median*1.5 огромный → мусор не отсеивается). Ищем
        // согласованное подмножество: если найдено (≥3 inliers) — берём его transform.
        const consensusTransform = this._robustConsensusFit(pointsA, pointsB);
        if (consensusTransform) {
            return consensusTransform;
        }
        // ===== ФИЛЬТРАЦИЯ ВЫБРОСОВ ПО ОШИБКЕ ПРОЕКЦИИ =====
        const errors = [];
        for (let i = 0; i < pointsA.length; i++) {
            const pA = pointsA[i];
            const pB = pointsB[i];
           
            const projected = {
                x: pA.x * scale * Math.cos(rotation) - pA.y * scale * Math.sin(rotation) + translation.x,
                y: pA.x * scale * Math.sin(rotation) + pA.y * scale * Math.cos(rotation) + translation.y
            };
           
            const error = GeometryUtils.distance(projected, pB);
            errors.push({ index: i, error, confidence: pA.confidence });
        }
       
        // Сортируем по ошибке и находим медиану
        errors.sort((a, b) => a.error - b.error);
        const medianError = errors[Math.floor(errors.length / 2)].error;
        // 🔥 ЖЁСТЧЕ: множитель 1.5 вместо 2.5, минимум 10px вместо 20px
        const threshold = Math.max(medianError * 1.5, 10); // минимум 10 пикселей
       
        // Оставляем только точки с ошибкой < threshold
        const filteredA = [];
        const filteredB = [];
        let kept = 0, filtered = 0;
       
        for (const e of errors) {
            if (e.error < threshold) {
                filteredA.push(pointsA[e.index]);
                filteredB.push(pointsB[e.index]);
                kept++;
            } else {
                filtered++;
            }
        }
       
        console.log(`   📊 Фильтрация выбросов: медианная ошибка ${medianError.toFixed(1)}px, порог ${threshold.toFixed(1)}px`);
        console.log(`   📊 Оставлено ${kept} якорей, отфильтровано ${filtered}`);
       
        // ===== ИТЕРАЦИЯ 2: ПЕРЕСЧИТЫВАЕМ НА ОТФИЛЬТРОВАННЫХ ТОЧКАХ =====
        if (filteredA.length >= 3) {
            const newCenterA = GeometryUtils.calculateCentroid(filteredA);
            const newCenterB = GeometryUtils.calculateCentroid(filteredB);
           
            // Пересчитываем масштаб
            let newScaleSum = 0, newScaleCount = 0;
            for (let i = 0; i < filteredA.length; i++) {
                for (let j = i + 1; j < filteredA.length; j++) {
                    const distA = GeometryUtils.distance(filteredA[i], filteredA[j]);
                    const distB = GeometryUtils.distance(filteredB[i], filteredB[j]);
                    if (distA > 0 && distB > 0) {
                        newScaleSum += distB / distA;
                        newScaleCount++;
                    }
                }
            }
            const newScale = newScaleCount > 0 ? newScaleSum / newScaleCount : scale;
           
            // Пересчитываем поворот
            let newRotation = rotation;
            if (filteredA.length >= 2) {
                const centeredFA = filteredA.map(p => ({ x: p.x - newCenterA.x, y: p.y - newCenterA.y }));
                const centeredFB = filteredB.map(p => ({ x: p.x - newCenterB.x, y: p.y - newCenterB.y }));
                let sinSum = 0, cosSum = 0;
                for (let i = 0; i < centeredFA.length; i++) {
                    const scaledA = { x: centeredFA[i].x * newScale, y: centeredFA[i].y * newScale };
                    sinSum += scaledA.x * centeredFB[i].y - scaledA.y * centeredFB[i].x;
                    cosSum += scaledA.x * centeredFB[i].x + scaledA.y * centeredFB[i].y;
                }
                newRotation = Math.atan2(sinSum, cosSum);
            }
           
            // Новый сдвиг
            const newTranslation = {
                x: newCenterB.x - (newCenterA.x * newScale * Math.cos(newRotation) - newCenterA.y * newScale * Math.sin(newRotation)),
                y: newCenterB.y - (newCenterA.x * newScale * Math.sin(newRotation) + newCenterA.y * newScale * Math.cos(newRotation))
            };
           
            const transform = { scale: newScale, rotation: newRotation, translation: newTranslation };
           
            console.log(`\n📊 РЕЗУЛЬТАТ ПРЕОБРАЗОВАНИЯ (после фильтрации):`);
            console.log(`   • Масштаб: ${newScale.toFixed(3)} (было ${scale.toFixed(3)})`);
            console.log(`   • Поворот: ${(newRotation * 180 / Math.PI).toFixed(1)}° (было ${(rotation * 180 / Math.PI).toFixed(1)}°)`);
            console.log(`   • Сдвиг: (${newTranslation.x.toFixed(1)}, ${newTranslation.y.toFixed(1)}) (было ${translation.x.toFixed(1)}, ${translation.y.toFixed(1)})`);
           
            return transform;
        }
       
        // Если после фильтрации осталось мало точек — возвращаем исходный
        const transform = { scale, rotation, translation };
        console.log(`\n📊 РЕЗУЛЬТАТ ПРЕОБРАЗОВАНИЯ (без фильтрации):`);
        console.log(`   • Масштаб: ${scale.toFixed(3)}`);
        console.log(`   • Поворот: ${(rotation * 180 / Math.PI).toFixed(1)}°`);
        console.log(`   • Сдвиг: (${translation.x.toFixed(1)}, ${translation.y.toFixed(1)})`);
       
        return transform;
    }

        // ===== ШАГ 3 (ВАРИАНТ B): РОБАСТНЫЙ КОНСЕНСУС ПО ТОЧЕЧНЫМ ПАРАМ =====
    // Медианная фильтрация не работает, когда >50% якорей мусорные (медиана
    // мусорная → порог огромный). Вместо неё: систематический перебор ВСЕХ троек
    // якорей → фит подобия по каждой → подсчёт inliers (ошибка ≤ 10px) → берём
    // тройку с НАИБОЛЬШИМ числом inliers → пересчёт по всем inliers (до 3 итераций
    // уточнения). Детерминированно: комбинации в порядке возрастания индексов,
    // при равенстве inliers — меньше суммарная ошибка. Для чистых фото консенсус =
    // все якоря (результат тот же, что у медианного фильтра); для грязных —
    // правильное подмножество (напр. 6 хороших из 24 мусорных).
    // Возвращает transform или null (если согласованного подмножества ≥3 нет —
    // вызывающий падает на прежний медианный фильтр).
    _robustConsensusFit(pointsA, pointsB) {
        if (!pointsA || !pointsB || pointsA.length < 3 || pointsB.length !== pointsA.length) return null;

        // Защита от комбинаторного взрыва: обычно якорей ≤ 24 (C(24,3)=2024).
        // При n > ~53 (C(n,3) > 25000) — падаем на медианный фильтр.
        const n = pointsA.length;
        if (n * (n - 1) * (n - 2) / 6 > 25000) return null;

        // Фит подобия по точечным парам (тот же метод, что в ИТЕРАЦИИ 1/2 выше):
        // scale = среднее отношений расстояний, rotation через atan2 сумм, translation через центры.
        const fit = (a, b) => {
            const ca = GeometryUtils.calculateCentroid(a);
            const cb = GeometryUtils.calculateCentroid(b);
            let scaleSum = 0, scaleCount = 0;
            for (let i = 0; i < a.length; i++) {
                for (let j = i + 1; j < a.length; j++) {
                    const da = GeometryUtils.distance(a[i], a[j]);
                    const db = GeometryUtils.distance(b[i], b[j]);
                    if (da > 0 && db > 0) { scaleSum += db / da; scaleCount++; }
                }
            }
            if (scaleCount === 0) return null;
            const scale = scaleSum / scaleCount;
            const caCent = a.map(p => ({ x: p.x - ca.x, y: p.y - ca.y }));
            const cbCent = b.map(p => ({ x: p.x - cb.x, y: p.y - cb.y }));
            let sinSum = 0, cosSum = 0;
            for (let i = 0; i < caCent.length; i++) {
                const sx = caCent[i].x * scale, sy = caCent[i].y * scale;
                sinSum += sx * cbCent[i].y - sy * cbCent[i].x;
                cosSum += sx * cbCent[i].x + sy * cbCent[i].y;
            }
            const rotation = Math.atan2(sinSum, cosSum);
            const tx = cb.x - (ca.x * scale * Math.cos(rotation) - ca.y * scale * Math.sin(rotation));
            const ty = cb.y - (ca.x * scale * Math.sin(rotation) + ca.y * scale * Math.cos(rotation));
            return { scale, rotation, translation: { x: tx, y: ty } };
        };

        // Проекция точки по transform (тот же вид, что в calculateTransform)
        const project = (p, t) => ({
            x: p.x * t.scale * Math.cos(t.rotation) - p.y * t.scale * Math.sin(t.rotation) + t.translation.x,
            y: p.x * t.scale * Math.sin(t.rotation) + p.y * t.scale * Math.cos(t.rotation) + t.translation.y
        });

        const INLIER_PX = 10;   // жёсткий порог inlier (совпадает с min-10px медианного фильтра)

        const errorsOf = (t) => {
            const e = [];
            for (let i = 0; i < n; i++) {
                const pr = project(pointsA[i], t);
                e.push({ i, error: GeometryUtils.distance(pr, pointsB[i]) });
            }
            return e;
        };

        let bestFit = null;
        let bestInliers = 0;
        let bestErrorSum = Infinity;

        // Систематический перебор всех троек (i < j < k), детерминированно
        outer:
        for (let i = 0; i < n - 2; i++) {
            for (let j = i + 1; j < n - 1; j++) {
                for (let k = j + 1; k < n; k++) {
                    const t = fit([pointsA[i], pointsA[j], pointsA[k]], [pointsB[i], pointsB[j], pointsB[k]]);
                    if (!t) continue;
                    const errs = errorsOf(t);
                    const cnt = errs.filter(x => x.error <= INLIER_PX).length;
                    const errSum = errs.reduce((s, x) => s + x.error, 0);
                    if (cnt > bestInliers || (cnt === bestInliers && cnt > 0 && errSum < bestErrorSum)) {
                        bestInliers = cnt;
                        bestFit = t;
                        bestErrorSum = errSum;
                    }
                    if (cnt === n) break outer;   // идеальный консенсус — искать больше нечего
                }
            }
        }

        if (!bestFit || bestInliers < 3) return null;

        // Пересчёт по inliers лучшей тройки, до 3 итераций уточнения
        let curFit = bestFit;
        let finalInliers = bestInliers;
        for (let pass = 0; pass < 3; pass++) {
            const errs = errorsOf(curFit);
            const inlierIdx = errs.filter(x => x.error <= INLIER_PX).map(x => x.i);
            if (inlierIdx.length < 3) break;
            finalInliers = inlierIdx.length;
            const refined = fit(inlierIdx.map(i => pointsA[i]), inlierIdx.map(i => pointsB[i]));
            if (!refined) break;
            curFit = refined;
        }

        if (finalInliers < 3) return null;

        console.log(`   🔥 РОБАСТНЫЙ КОНСЕНСУС: ${finalInliers}/${n} якорей (ошибка ≤ ${INLIER_PX}px)`);
        console.log(`   • Масштаб: ${curFit.scale.toFixed(3)}`);
        console.log(`   • Поворот: ${(curFit.rotation * 180 / Math.PI).toFixed(1)}°`);
        console.log(`   • Сдвиг: (${curFit.translation.x.toFixed(1)}, ${curFit.translation.y.toFixed(1)})`);
        return curFit;
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
