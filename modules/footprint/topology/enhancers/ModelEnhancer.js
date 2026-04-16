// modules/footprint/topology/enhancers/ModelEnhancer.js
// 🚀 УЛУЧШЕНИЕ МОДЕЛИ НОВЫМ ФОТО - ВЫНЕСЕННАЯ ЛОГИКА

const GeometryUtils = require('../utils/GeometryUtils');
const GraphUtils = require('../utils/GraphUtils');
const RoleClassifier = require('../utils/RoleClassifier');
const ValidationModule = require('../../validation/ValidationModule');
const AffineRefiner = require('../AffineRefiner');

class ModelEnhancer {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.fastMode = options.fastMode || false;
       
        // Пороги
        this.positionThreshold = options.positionThreshold || 0.15;
        this.morphologyThreshold = options.morphologyThreshold || 0.85;
        this.geometryThreshold = options.geometryThreshold || 0.3;
        this.softThreshold = options.softThreshold || 20;
       
        // Компоненты
        this.validator = options.validator || new ValidationModule({
            debug: this.debug,
            positionThreshold: this.positionThreshold,
            morphologyThreshold: this.morphologyThreshold
        });
       
        this.roleClassifier = options.roleClassifier || new RoleClassifier();
        this.affineRefiner = options.affineRefiner || new AffineRefiner({ debug: this.debug });
       
        // Статистика
        this.stats = {
            enhancements: 0,
            magneticPulls: 0,
            geometricExpansions: 0,
            mergedPoints: 0,
            validatedPoints: 0
        };
       
        console.log('🚀 ModelEnhancer создан');
    }
   
    // ==================== ПРИВАТНЫЕ МЕТОДЫ (БУДУТ ДОБАВЛЯТЬСЯ ПО ШАГАМ) ====================

/**
     * Извлекает все треугольники из графа
     */
    extractTrianglesFromGraph(graph) {
        const triangles = [];
        const nodeIds = Array.from(graph.nodes.keys());
        const edges = graph.edges;
       
        for (let i = 0; i < nodeIds.length; i++) {
            for (let j = i + 1; j < nodeIds.length; j++) {
                for (let k = j + 1; k < nodeIds.length; k++) {
                    const a = nodeIds[i];
                    const b = nodeIds[j];
                    const c = nodeIds[k];
                   
                    if (edges.has([a, b].sort().join('--')) &&
                        edges.has([b, c].sort().join('--')) &&
                        edges.has([c, a].sort().join('--'))) {
                       
                        const p1 = graph.nodes.get(a);
                        const p2 = graph.nodes.get(b);
                        const p3 = graph.nodes.get(c);
                       
                        if (p1 && p2 && p3) {
                            triangles.push({ p1, p2, p3, id: `tri_${a}_${b}_${c}` });
                        }
                    }
                }
            }
        }
       
        if (this.debug) {
            console.log(`   📐 Извлечено треугольников: ${triangles.length}`);
        }
       
        return triangles;
    }  

/**
     * Сливает дублирующиеся точки в графе
     */
    mergeDuplicatePoints(graph, threshold = 5) {
        const points = Array.from(graph.nodes.values());
        const merged = new Set();
        let mergedCount = 0;
        let edgesToUpdate = new Map();
       
        for (let i = 0; i < points.length; i++) {
            if (merged.has(points[i].id)) continue;
           
            for (let j = i + 1; j < points.length; j++) {
                if (merged.has(points[j].id)) continue;
               
                const dx = points[i].x - points[j].x;
                const dy = points[i].y - points[j].y;
                const dist = Math.sqrt(dx*dx + dy*dy);
               
                if (dist < threshold) {
                    const avgX = (points[i].x + points[j].x) / 2;
                    const avgY = (points[i].y + points[j].y) / 2;
                    points[i].x = avgX;
                    points[i].y = avgY;
                    points[i].confirmationCount = (points[i].confirmationCount || 1) + (points[j].confirmationCount || 1);
                   
                    edgesToUpdate.set(points[j].id, points[i].id);
                    graph.nodes.delete(points[j].id);
                    merged.add(points[j].id);
                    mergedCount++;
                }
            }
        }
       
        if (edgesToUpdate.size > 0) {
            const newEdges = new Set();
            for (const edge of graph.edges) {
                let [a, b] = edge.split('--');
                if (edgesToUpdate.has(a)) a = edgesToUpdate.get(a);
                if (edgesToUpdate.has(b)) b = edgesToUpdate.get(b);
                if (a !== b) {
                    newEdges.add([a, b].sort().join('--'));
                }
            }
            graph.edges = newEdges;
           
            for (const node of graph.nodes.values()) node.degree = 0;
            for (const edge of graph.edges) {
                const [a, b] = edge.split('--');
                if (graph.nodes.has(a)) graph.nodes.get(a).degree++;
                if (graph.nodes.has(b)) graph.nodes.get(b).degree++;
            }
        }
       
        return mergedCount;
    }

/**
* Притягивание близких точек с топологической проверкой
* @param {Array} matches - массив соответствий
* @param {Object} photoGraph - граф фото
* @param {Object} modelGraph - граф модели
* @param {Object} transform - текущая трансформация
* @param {number} threshold - порог расстояния для притягивания (px)
* @returns {Object} - { pulledMatches, pulledCount }
*/
_magneticPull(matches, photoGraph, modelGraph, transform, threshold = 10) {
    const pulledMatches = [];
    const usedPhotoPoints = new Set();
    const usedModelPoints = new Set();
    let pulledCount = 0;
    let topologyCheckedCount = 0;
    let topologyRejectedCount = 0;

    // Сортируем matches по уверенности
    const sortedMatches = [...matches].sort((a, b) => b.confidence - a.confidence);

    // Строим карту уже сопоставленных точек
    const matchedPhotoMap = new Map();
    const matchedModelMap = new Map();
    for (const match of sortedMatches) {
        matchedPhotoMap.set(match.pointA, match.pointB);
        matchedModelMap.set(match.pointB, match.pointA);
    }

    for (const match of sortedMatches) {
        const photoPoint = photoGraph?.nodes?.get(match.pointA);
        const modelPoint = modelGraph?.nodes?.get(match.pointB);

        if (!photoPoint || !modelPoint) continue;

        // Проецируем точку фото в пространство модели
        const projected = {
            x: photoPoint.x * transform.scale * Math.cos(transform.rotation) -
               photoPoint.y * transform.scale * Math.sin(transform.rotation) +
               transform.translation.x,
            y: photoPoint.x * transform.scale * Math.sin(transform.rotation) +
               photoPoint.y * transform.scale * Math.cos(transform.rotation) +
               transform.translation.y
        };

        // Вычисляем расстояние до точки модели
        const dx = projected.x - modelPoint.x;
        const dy = projected.y - modelPoint.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        // Если точка уже близко — притягиваем
        if (dist < threshold && dist > 0.5) {
            if (this.debug && dist > 1) {
                console.log(`   🧲 Точки рядом (${dist.toFixed(1)}px): ${match.pointA.substring(0,12)} ↔ ${match.pointB.substring(0,12)}`);
            }

            const weight = match.confidence || 0.5;
            const avgX = (projected.x * weight + modelPoint.x * (1 - weight));
            const avgY = (projected.y * weight + modelPoint.y * (1 - weight));

            modelPoint.x = avgX;
            modelPoint.y = avgY;
            modelPoint.confirmationCount = (modelPoint.confirmationCount || 1) + 1;
            modelPoint.pulled = true;
            modelPoint.pullDistance = dist;

            pulledMatches.push({
                ...match,
                pulled: true,
                pullDistance: dist,
                newPosition: { x: avgX, y: avgY },
                topologyChecked: false
            });

            usedPhotoPoints.add(match.pointA);
            usedModelPoints.add(match.pointB);
            pulledCount++;
            continue;
        }

        // Если точка далеко — пробуем найти правильную с топологической проверкой
        if (dist >= threshold) {
            // Находим всех соседей точки A в графе фото
            const photoNeighbors = GraphUtils.findNodeNeighbors(match.pointA, photoGraph);
            const matchedNeighbors = photoNeighbors.filter(n => matchedPhotoMap.has(n.id));

            // Если у точки нет сопоставленных соседей — не можем проверить топологию
            if (matchedNeighbors.length < 2) {
                if (this.debug && dist > threshold * 2) {
                    console.log(`   ⚠️ Точки далеко (${dist.toFixed(1)}px): ${match.pointA.substring(0,12)} ↔ ${match.pointB.substring(0,12)} - мало соседей`);
                }
                pulledMatches.push(match);
                usedPhotoPoints.add(match.pointA);
                usedModelPoints.add(match.pointB);
                continue;
            }

            // Ищем кандидатов среди точек модели в расширенном радиусе
            const candidates = [];
            for (const [candidateId, candidatePoint] of modelGraph.nodes) {
                if (usedModelPoints.has(candidateId)) continue;

                const candidateDx = projected.x - candidatePoint.x;
                const candidateDy = projected.y - candidatePoint.y;
                const candidateDist = Math.sqrt(candidateDx*candidateDx + candidateDy*candidateDy);

                if (candidateDist < threshold * 2) {
                    candidates.push({ id: candidateId, point: candidatePoint, dist: candidateDist });
                }
            }

            // Сортируем по расстоянию
            candidates.sort((a, b) => a.dist - b.dist);

            let bestCandidate = null;
            let bestTopologyScore = 0;

            // Проверяем каждого кандидата на топологию
            for (const candidate of candidates) {
                const modelNeighbors = GraphUtils.findNodeNeighbors(candidate.id, modelGraph);
                const matchedModelNeighbors = modelNeighbors.filter(n => matchedModelMap.has(n.id));

                // Количество сопоставленных соседей должно совпадать
                if (matchedModelNeighbors.length !== matchedNeighbors.length) continue;

                // Проверяем, что соседи соответствуют друг другу
                let topologyScore = 0;
                for (const photoNeighbor of matchedNeighbors) {
                    const expectedModelId = matchedPhotoMap.get(photoNeighbor.id);
                    if (matchedModelNeighbors.some(n => n.id === expectedModelId)) {
                        topologyScore++;
                    }
                }

                const matchRatio = topologyScore / matchedNeighbors.length;
                if (matchRatio > bestTopologyScore && matchRatio >= 0.7) {
                    bestTopologyScore = matchRatio;
                    bestCandidate = candidate;
                }
            }

            if (bestCandidate) {
                topologyCheckedCount++;

                if (this.debug) {
                    console.log(`   🧲 Топологический магнит: ${match.pointA.substring(0,12)} → ${bestCandidate.id.substring(0,12)} (${bestCandidate.dist.toFixed(1)}px, совпадение ${(bestTopologyScore*100).toFixed(0)}%)`);
                }

                const weight = match.confidence || 0.5;
                const avgX = (projected.x * weight + bestCandidate.point.x * (1 - weight));
                const avgY = (projected.y * weight + bestCandidate.point.y * (1 - weight));

                bestCandidate.point.x = avgX;
                bestCandidate.point.y = avgY;
                bestCandidate.point.confirmationCount = (bestCandidate.point.confirmationCount || 1) + 1;
                bestCandidate.point.pulled = true;
                bestCandidate.point.pullDistance = bestCandidate.dist;

                pulledMatches.push({
                    pointA: match.pointA,
                    pointB: bestCandidate.id,
                    confidence: match.confidence,
                    pulled: true,
                    pullDistance: bestCandidate.dist,
                    topologyChecked: true,
                    topologyScore: bestTopologyScore,
                    originalPointB: match.pointB
                });

                usedPhotoPoints.add(match.pointA);
                usedModelPoints.add(bestCandidate.id);
                pulledCount++;
            } else {
                topologyRejectedCount++;
                if (this.debug && dist > threshold * 2) {
                    console.log(`   ⚠️ Точки далеко (${dist.toFixed(1)}px): ${match.pointA.substring(0,12)} ↔ ${match.pointB.substring(0,12)} - нет кандидата`);
                }
                pulledMatches.push(match);
                usedPhotoPoints.add(match.pointA);
                usedModelPoints.add(match.pointB);
            }
        } else {
            // Точки уже почти совпадают
            pulledMatches.push(match);
            usedPhotoPoints.add(match.pointA);
            usedModelPoints.add(match.pointB);
        }
    }

    if (this.debug) {
        console.log(`\n📊 РЕЗУЛЬТАТ ПРИТЯГИВАНИЯ:`);
        console.log(`   • Притянуто точек: ${pulledCount}`);
        console.log(`   • Топологически проверено: ${topologyCheckedCount}`);
        console.log(`   • Отвергнуто топологией: ${topologyRejectedCount}`);
        console.log(`   • Осталось без изменений: ${pulledMatches.length - pulledCount}`);
    }

    return { pulledMatches, pulledCount };
}

 /**
* Глобальная проверка согласованности всех найденных якорей
* @param {Array} anchors - массив якорей (треугольников)
* @param {Array} trianglesA - все треугольники из первого следа
* @param {Array} trianglesB - все треугольники из второго следа
* @param {Object} graphA - граф первого следа
* @param {Object} graphB - граф второго следа
* @returns {Object} - согласованные якоря и статистика
*/
checkGlobalConsistency(anchors, trianglesA, trianglesB, graphA, graphB) {
    if (this.debug) {
        console.log(`\n🔍 ГЛОБАЛЬНАЯ ПРОВЕРКА СОГЛАСОВАННОСТИ`);
        console.log(`   • Всего кандидатов: ${anchors.length} треугольников (${anchors.length * 3} точек)`);
    }

    // ===== ШАГ 1: Собираем все уникальные соответствия точек =====
    const pointPairs = new Map();
    const reversePairs = new Map();
    let skippedAnchors = 0;

    for (const anchor of anchors) {
        if (anchor.aIndex === -1 || anchor.bIndex === -1) {
            for (const point of anchor.points) {
                const pA = point.pointA;
                const pB = point.pointB;

                if (pointPairs.has(pA)) {
                    if (pointPairs.get(pA).pointB !== pB) {
                        if (this.debug) console.log(`   ⚠️ Конфликт точки ${pA.substring(0,12)}`);
                    }
                    continue;
                }

                if (reversePairs.has(pB)) {
                    if (this.debug) console.log(`   ⚠️ Конфликт точки ${pB.substring(0,12)}`);
                    continue;
                }

                pointPairs.set(pA, {
                    pointB: pB,
                    confidence: point.confidence || anchor.geometryScore
                });
                reversePairs.set(pB, pA);
            }
        } else {
            if (anchor.aIndex >= trianglesA.length || anchor.bIndex >= trianglesB.length) {
                skippedAnchors++;
                continue;
            }

            const tA = trianglesA[anchor.aIndex];
            const tB = trianglesB[anchor.bIndex];

            if (!tA || !tB) {
                skippedAnchors++;
                continue;
            }

            const pointsA = [tA.p1.id, tA.p2.id, tA.p3.id];
            const pointsB = [tB.p1.id, tB.p2.id, tB.p3.id];

            for (let i = 0; i < 3; i++) {
                const pA = pointsA[i];
                const pB = pointsB[i];

                if (pointPairs.has(pA)) {
                    if (pointPairs.get(pA).pointB !== pB) {
                        if (this.debug) console.log(`   ⚠️ Конфликт точки ${pA.substring(0,12)}`);
                    }
                    continue;
                }

                if (reversePairs.has(pB)) {
                    if (this.debug) console.log(`   ⚠️ Конфликт точки ${pB.substring(0,12)}`);
                    continue;
                }

                pointPairs.set(pA, {
                    pointB: pB,
                    confidence: anchor.geometryScore
                });
                reversePairs.set(pB, pA);
            }
        }
    }

    if (this.debug) {
        console.log(`\n📊 УНИКАЛЬНЫХ СООТВЕТСТВИЙ ТОЧЕК: ${pointPairs.size}`);
        if (skippedAnchors > 0) {
            console.log(`   • Пропущено якорей: ${skippedAnchors}`);
        }
    }

    // ===== ШАГ 2: Анализируем распределение уверенностей =====
    const confidences = Array.from(pointPairs.values()).map(p => p.confidence);
    if (confidences.length === 0) {
        if (this.debug) console.log(`\n⚠️ Нет соответствий для анализа`);
        return {
            anchors: [],
            points: [],
            stats: {
                original: anchors.length,
                final: 0,
                originalPoints: 0,
                finalPoints: 0,
                inconsistent: 0,
                lowConfidence: 0
            }
        };
    }

    confidences.sort((a, b) => b - a);

    if (this.debug) {
        console.log(`\n📈 РАСПРЕДЕЛЕНИЕ УВЕРЕННОСТЕЙ:`);
        console.log(`   • Максимальная: ${(confidences[0]*100).toFixed(1)}%`);
        console.log(`   • Минимальная: ${(confidences[confidences.length-1]*100).toFixed(1)}%`);
        console.log(`   • Медианная: ${(confidences[Math.floor(confidences.length/2)]*100).toFixed(1)}%`);
    }

    let threshold = 0.90;
    for (let i = 1; i < confidences.length; i++) {
        if (confidences[i-1] - confidences[i] > 0.05) {
            threshold = confidences[i-1] - 0.01;
            if (this.debug) console.log(`   • Естественный разрыв на ${(threshold*100).toFixed(1)}%`);
            break;
        }
    }

    // ===== ШАГ 3: ТОПОЛОГИЧЕСКАЯ ПРОВЕРКА =====
    if (this.debug) console.log(`\n🔍 ТОПОЛОГИЧЕСКАЯ ПРОВЕРКА:`);

    const consistentPoints = new Set();
    const inconsistentPoints = new Set();

    const pointMap = new Map();
    for (const [pA, data] of pointPairs) {
        pointMap.set(pA, data.pointB);
    }

    for (const [pA, data] of pointPairs) {
        const pB = data.pointB;

        const neighborsA = GraphUtils.findNodeNeighbors(pA, graphA);
        const neighborAnchorsA = neighborsA.filter(n => pointMap.has(n.id)).map(n => n.id);

        const neighborsB = GraphUtils.findNodeNeighbors(pB, graphB);
        const neighborAnchorsB = neighborsB.filter(n => reversePairs.has(n.id)).map(n => n.id);

        if (neighborAnchorsA.length !== neighborAnchorsB.length) {
            if (this.debug) console.log(`   ⚠️ Точка ${pA.substring(0,12)}: соседей-якорей ${neighborAnchorsA.length} vs ${neighborAnchorsB.length}`);
            inconsistentPoints.add(pA);
            continue;
        }

        let allMatch = true;
        for (const nA of neighborAnchorsA) {
            const nB = pointMap.get(nA);
            if (!neighborsB.some(n => n.id === nB)) {
                allMatch = false;
                break;
            }
        }

        if (allMatch) {
            consistentPoints.add(pA);
            if (this.debug && consistentPoints.size <= 5) {
                console.log(`   ✅ Точка ${pA.substring(0,12)}: топология согласована`);
            }
        } else {
            if (this.debug) console.log(`   ⚠️ Точка ${pA.substring(0,12)}: несоответствие соседей`);
            inconsistentPoints.add(pA);
        }
    }

    // ===== ШАГ 4: ФИЛЬТРАЦИЯ ПО УВЕРЕННОСТИ =====
    if (this.debug) console.log(`\n🔍 ФИЛЬТРАЦИЯ ПО УВЕРЕННОСТИ (порог ${(threshold*100).toFixed(1)}%):`);

    const highConfidencePoints = [];
    const lowConfidencePoints = [];

    for (const [pA, data] of pointPairs) {
        if (data.confidence >= threshold) {
            highConfidencePoints.push(pA);
        } else {
            lowConfidencePoints.push(pA);
        }
    }

    if (this.debug) {
        console.log(`   • Высокая уверенность: ${highConfidencePoints.length} точек`);
        console.log(`   • Низкая уверенность: ${lowConfidencePoints.length} точек`);
    }

    // ===== ШАГ 5: ФИНАЛЬНЫЙ ОТБОР =====
    if (this.debug) console.log(`\n🎯 ФИНАЛЬНЫЙ ОТБОР СОГЛАСОВАННЫХ ТОЧЕК:`);

    const finalPoints = [];
    for (const pA of consistentPoints) {
        if (pointPairs.get(pA).confidence >= threshold) {
            finalPoints.push({
                pointA: pA,
                pointB: pointPairs.get(pA).pointB,
                confidence: pointPairs.get(pA).confidence
            });
        }
    }

    if (this.debug) {
        console.log(`   • Прошли все проверки: ${finalPoints.length} точек`);
        console.log(`   • Отсеяно топологией: ${inconsistentPoints.size} точек`);
        console.log(`   • Отсеяно по уверенности: ${lowConfidencePoints.length} точек`);
    }

    if (this.debug) {
        console.log(`\n📊 ИТОГ ГЛОБАЛЬНОЙ ПРОВЕРКИ:`);
        console.log(`   • Исходных якорей (треугольников): ${anchors.length}`);
        console.log(`   • Согласованных точек: ${finalPoints.length}`);
    }

    return {
        anchors: [],
        points: finalPoints,
        stats: {
            original: anchors.length,
            final: 0,
            originalPoints: pointPairs.size,
            finalPoints: finalPoints.length,
            inconsistent: inconsistentPoints.size,
            lowConfidence: lowConfidencePoints.length
        }
    };
} 

/**
* Двухэтапная достройка точек на основе согласованных якорей
* @param {Array} anchors - согласованные якоря (точки)
* @param {Array} allMatches - все найденные matches
* @param {Object} graphA - граф первого следа
* @param {Object} graphB - граф второго следа
* @param {Map} morphologyMap - морфология точек первого следа
* @param {Map} modelMorphology - морфология точек модели
* @returns {Array} - достроенные соответствия
*/
twoStagePositioning(anchors, allMatches, graphA, graphB, morphologyMap, modelMorphology) {
    if (this.debug) console.log(`\n🔧 ДВУХЭТАПНАЯ ДОСТРОЙКА ТОЧЕК`);

    // ===== ШАГ 1: Разделяем точки на категории =====
    if (this.debug) console.log(`\n📊 РАЗДЕЛЕНИЕ ТОЧЕК ПО КАТЕГОРИЯМ:`);

    const anchorSet = new Set(anchors.map(a => a.pointA));
    const allPointsA = new Set(allMatches.map(m => m.pointA));

    const confusedPoints = [];
    for (const match of allMatches) {
        if (!anchorSet.has(match.pointA)) {
            confusedPoints.push(match);
        }
    }

    if (this.debug) {
        console.log(`   • Якорей: ${anchors.length} точек`);
        console.log(`   • Путающихся кандидатов: ${confusedPoints.length} точек`);
    }

    // ===== ШАГ 2: Строим карту якорей для быстрого доступа =====
    const anchorMap = new Map();
    for (const anchor of anchors) {
        anchorMap.set(anchor.pointA, {
            pointB: anchor.pointB,
            confidence: anchor.confidence
        });
    }

    // ===== ШАГ 3: УТОЧНЕНИЕ ПУТАЮЩИХСЯ ТОЧЕК =====
    if (this.debug) console.log(`\n🔍 ЭТАП 1: УТОЧНЕНИЕ ПУТАЮЩИХСЯ ТОЧЕК`);

    const confirmedFromConfused = [];
    const stillConfused = [];

    for (const match of confusedPoints) {
        const pointA = match.pointA;
        const pointB = match.pointB;

        const neighborsA = GraphUtils.findNodeNeighbors(pointA, graphA);
        const anchorNeighborsA = neighborsA.filter(n => anchorMap.has(n.id));

        const neighborsB = GraphUtils.findNodeNeighbors(pointB, graphB);
        const anchorNeighborsB = neighborsB.filter(n =>
            Array.from(anchorMap.values()).some(a => a.pointB === n.id)
        );

        if (anchorNeighborsA.length === 0 || anchorNeighborsB.length === 0) {
            stillConfused.push(match);
            continue;
        }

        let consistent = true;
        const minNeighbors = Math.min(anchorNeighborsA.length, anchorNeighborsB.length);

        for (let i = 0; i < minNeighbors; i++) {
            const nA = anchorNeighborsA[i];
            const nB = anchorNeighborsB[i];

            const distA = GraphUtils.graphDistance(pointA, nA.id, graphA);
            const distB = GraphUtils.graphDistance(pointB, nB.id, graphB);

            if (Math.abs(distA - distB) > 1) {
                consistent = false;
                break;
            }
        }

        if (consistent) {
            confirmedFromConfused.push({
                pointA: pointA,
                pointB: pointB,
                confidence: match.confidence * 0.9
            });
            if (this.debug) console.log(`   ✅ Уточнена: ${pointA.substring(0,12)} ↔ ${pointB.substring(0,12)}`);
        } else {
            stillConfused.push(match);
        }
    }

    if (this.debug) {
        console.log(`\n📊 ИТОГ ЭТАПА 1:`);
        console.log(`   • Уточнено: ${confirmedFromConfused.length} точек`);
        console.log(`   • Осталось путающихся: ${stillConfused.length} точек`);
    }

    // ===== ШАГ 4: ПОДГОТОВКА ЯКОРЕЙ ДЛЯ ДОСТРОЙКИ =====
    const allConfirmed = [...anchors, ...confirmedFromConfused];
    if (this.debug) console.log(`\n🔧 Всего подтвержденных точек для достройки: ${allConfirmed.length}`);

    const confirmedMap = new Map();
    for (const point of allConfirmed) {
        confirmedMap.set(point.pointA, point.pointB);
    }

    // ===== ШАГ 5: ДОСТРОЙКА НОВЫХ ТОЧЕК =====
    if (this.debug) console.log(`\n🔍 ЭТАП 2: ДОСТРОЙКА НОВЫХ ТОЧЕК`);

    const allPointsInA = Array.from(graphA.nodes.keys());
    const pointsToPosition = allPointsInA.filter(p => !confirmedMap.has(p));

    if (this.debug) console.log(`   • Точек для достройки: ${pointsToPosition.length}`);

    const anchorMatches = new Map();
    for (const point of allConfirmed) {
        anchorMatches.set(point.pointA, {
            modelId: point.pointB,
            confidence: point.confidence
        });
    }

    // Используем переданный relativePositioning или создаём новый
    const RelativePositioning = require('../RelativePositioning');
    const relativePositioning = this.relativePositioning || new RelativePositioning({ debug: this.debug });

    const positionedMatches = relativePositioning.positionPoints(
        graphA,
        graphB,
        anchorMatches,
        morphologyMap,
        modelMorphology,
        { confidenceThreshold: 0.5 }
    );

    if (this.debug) console.log(`\n📊 ИТОГ ЭТАПА 2:`);
    if (this.debug) console.log(`   • Достроено: ${positionedMatches.size} точек`);

    // ===== ШАГ 6: ФОРМИРУЕМ ФИНАЛЬНЫЙ РЕЗУЛЬТАТ =====
    const finalMatches = [];

    for (const point of allConfirmed) {
        finalMatches.push({
            pointA: point.pointA,
            pointB: point.pointB,
            confidence: point.confidence
        });
    }

    for (const [pointA, match] of positionedMatches) {
        if (!confirmedMap.has(pointA)) {
            finalMatches.push({
                pointA: pointA,
                pointB: match.modelId,
                confidence: match.confidence
            });
        }
    }

    if (this.debug) {
        console.log(`\n🎯 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ:`);
        console.log(`   • Всего соответствий: ${finalMatches.length} точек`);
        console.log(`   • Из них якорей: ${anchors.length}`);
        console.log(`   • Уточнено путающихся: ${confirmedFromConfused.length}`);
        console.log(`   • Достроено новых: ${finalMatches.length - allConfirmed.length}`);
    }

    return finalMatches;
}

// ==================== МЕТОДЫ ДЛЯ РАБОТЫ СО СТРУКТУРАМИ ====================

_getBoundaryEdgesFromStructure(structure) {
    const edges = [];
    if (!structure || !structure.boundaryEdges) return edges;
   
    for (const [edgeKey, edgeData] of structure.boundaryEdges) {
        edges.push({
            key: edgeKey,
            v1: edgeData.v1,
            v2: edgeData.v2
        });
    }
    return edges;
}

_findNeighborTriangleInGraph(edge, allTriangles, structure) {
    const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');

    for (const triangle of allTriangles) {
        if (structure.triangleIds.has(triangle.id)) continue;
        if (!triangle.edges) continue;

        for (const triEdge of triangle.edges) {
            if (!triEdge.v1 || !triEdge.v2) continue;
            const triEdgeKey = [triEdge.v1.id, triEdge.v2.id].sort().join('--');
            if (triEdgeKey === edgeKey) {
                return {
                    id: triangle.id,
                    p1: triangle.p1,
                    p2: triangle.p2,
                    p3: triangle.p3,
                    edges: triangle.edges,
                    confidence: triangle.confidence || 0.5
                };
            }
        }
    }
    return null;
}

_findCommonEdgeInTriangle(triangle, structure) {
    for (const edge of triangle.edges) {
        if (structure.pointIds.has(edge.v1.id) && structure.pointIds.has(edge.v2.id)) {
            return edge;
        }
    }
    return null;
}

_compareTrianglesGeometrically(tPhoto, tModel, structure) {
    // Углы
    const anglePhoto1 = GeometryUtils.angleBetween(tPhoto.p1, tPhoto.p2, tPhoto.p3);
    const anglePhoto2 = GeometryUtils.angleBetween(tPhoto.p2, tPhoto.p3, tPhoto.p1);
    const anglePhoto3 = GeometryUtils.angleBetween(tPhoto.p3, tPhoto.p1, tPhoto.p2);
  
    const angleModel1 = GeometryUtils.angleBetween(tModel.p1, tModel.p2, tModel.p3);
    const angleModel2 = GeometryUtils.angleBetween(tModel.p2, tModel.p3, tModel.p1);
    const angleModel3 = GeometryUtils.angleBetween(tModel.p3, tModel.p1, tModel.p2);
  
    const angleDiff = (Math.abs(anglePhoto1 - angleModel1) +
                       Math.abs(anglePhoto2 - angleModel2) +
                       Math.abs(anglePhoto3 - angleModel3)) / 3;
  
    const angleTolerance = Math.min(20, 10 + Math.floor(structure.triangleIds.size / 5));
    if (angleDiff > angleTolerance) return false;
  
    // Пропорции сторон
    const sidesPhoto = [
        GeometryUtils.distance(tPhoto.p1, tPhoto.p2),
        GeometryUtils.distance(tPhoto.p2, tPhoto.p3),
        GeometryUtils.distance(tPhoto.p3, tPhoto.p1)
    ].sort((a, b) => a - b);
  
    const sidesModel = [
        GeometryUtils.distance(tModel.p1, tModel.p2),
        GeometryUtils.distance(tModel.p2, tModel.p3),
        GeometryUtils.distance(tModel.p3, tModel.p1)
    ].sort((a, b) => a - b);
  
    const ratiosPhoto = [sidesPhoto[0] / sidesPhoto[2], sidesPhoto[1] / sidesPhoto[2]];
    const ratiosModel = [sidesModel[0] / sidesModel[2], sidesModel[1] / sidesModel[2]];
  
    const ratioDiff = (Math.abs(ratiosPhoto[0] - ratiosModel[0]) +
                       Math.abs(ratiosPhoto[1] - ratiosModel[1])) / 2;
  
    if (ratioDiff > 0.2) return false;
  
    // Масштаб
    const scalePhoto = (sidesPhoto[0] + sidesPhoto[1] + sidesPhoto[2]) / 3;
    const scaleModel = (sidesModel[0] + sidesModel[1] + sidesModel[2]) / 3;
    const scaleEstimate = scaleModel / scalePhoto;
    const scaleDiff = Math.abs(scaleEstimate - structure.transform.scale) / Math.max(structure.transform.scale, 0.001);
  
    if (scaleDiff > 0.2) return false;
  
    return true;
}

_findNearestModelPoint(point, graphB, threshold = 15) {
    let bestPoint = null;
    let bestDist = Infinity;
  
    for (const [id, modelPoint] of graphB.nodes) {
        const dx = modelPoint.x - point.x;
        const dy = modelPoint.y - point.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
      
        if (dist < bestDist && dist < threshold) {
            bestDist = dist;
            bestPoint = modelPoint;
        }
    }
    return bestPoint;
}

_tryAddGeometricTriangle(triangle, structure, graphA, graphB, morphologyMap, modelMorphology) {
    if (!triangle || !triangle.edges) return false;

    const commonEdge = this._findCommonEdgeInTriangle(triangle, structure);
    if (!commonEdge) return false;

    const newPoint = [triangle.p1, triangle.p2, triangle.p3].find(p =>
        p.id !== commonEdge.v1.id && p.id !== commonEdge.v2.id
    );
    if (!newPoint) return false;

    const photoA = graphA.nodes.get(commonEdge.v1.id);
    const photoB = graphA.nodes.get(commonEdge.v2.id);
    const photoC = graphA.nodes.get(newPoint.id);
    if (!photoA || !photoB || !photoC) return false;

    let modelA = this._getModelPointFromStructure(photoA.id, structure);
    let modelB = this._getModelPointFromStructure(photoB.id, structure);
    if (!modelA || !modelB) return false;

    if (typeof modelA === 'string') {
        const found = graphB.nodes.get(modelA);
        if (!found) return false;
        modelA = found;
    }
    if (typeof modelB === 'string') {
        const found = graphB.nodes.get(modelB);
        if (!found) return false;
        modelB = found;
    }

    let modelC;
    if (structure.transform) {
        const projected = GeometryUtils.applyTransform(photoC, structure.transform);
        modelC = { x: projected.x, y: projected.y };
    } else {
        return false;
    }

    const anglePhoto = GeometryUtils.angleBetween(photoA, photoC, photoB);
    const angleModel = GeometryUtils.angleBetween(modelA, modelC, modelB);
    const angleDiff = Math.abs(anglePhoto - angleModel);
    const angleTolerance = Math.min(25, 12 + Math.floor(structure.triangleIds.size / 3));

    if (angleDiff > angleTolerance) return false;

    const sidePhoto1 = GeometryUtils.distance(photoA, photoC);
    const sidePhoto2 = GeometryUtils.distance(photoB, photoC);
    const ratioPhoto = sidePhoto1 / sidePhoto2;
    const sideModel1 = GeometryUtils.distance(modelA, modelC);
    const sideModel2 = GeometryUtils.distance(modelB, modelC);
    const ratioModel = sideModel1 / sideModel2;
    const ratioDiff = Math.abs(ratioPhoto - ratioModel) / Math.max(ratioModel, 0.001);

    if (ratioDiff > 0.25) return false;

    const sumPhoto = sidePhoto1 + sidePhoto2 + GeometryUtils.distance(photoA, photoB);
    const sumModel = sideModel1 + sideModel2 + GeometryUtils.distance(modelA, modelB);
    const scaleEstimate = sumModel / sumPhoto;
    const scaleDiff = Math.abs(scaleEstimate - structure.transform.scale) / Math.max(structure.transform.scale, 0.001);

    if (scaleDiff > 0.2) return false;

    const photoMorph = morphologyMap?.get(photoC.id);
    const modelIdForMorph = modelC.id || (modelC.pointB || modelC);
    const modelMorph = modelMorphology?.get(modelIdForMorph);

    if (photoMorph && modelMorph) {
        let morphScore = 0, checks = 0;
        if (photoMorph.eccentricity && modelMorph.eccentricity) {
            morphScore += Math.min(photoMorph.eccentricity, modelMorph.eccentricity) / Math.max(photoMorph.eccentricity, modelMorph.eccentricity);
            checks++;
        }
        if (photoMorph.asymmetry && modelMorph.asymmetry) {
            morphScore += Math.min(photoMorph.asymmetry, modelMorph.asymmetry) / Math.max(photoMorph.asymmetry, modelMorph.asymmetry);
            checks++;
        }
        const finalMorphScore = checks > 0 ? morphScore / checks : 0.5;
        if (finalMorphScore < 0.6) return false;
    }

    structure.addTriangle(triangle);
    return true;
}

_getModelPointFromStructure(pointId, structure) {
    const anchors = structure.getAnchors();
    for (const anchor of anchors) {
        if (anchor.pointA === pointId) {
            return anchor.pointB;
        }
    }
    return null;
}

/**
* Главный метод — улучшить существующую модель новым фото
* @param {Object} existingModel - существующая модель
* @param {Object} newExactGraph - граф нового фото
* @param {Map} newMorphology - морфология нового фото
* @param {Array} originalPoints - исходные точки фото
* @param {Object} options - дополнительные опции
* @returns {Object} - результат улучшения
*/
async enhance(existingModel, newExactGraph, newMorphology, originalPoints, options = {}) {
    const { photoId, contours, triangleResult: externalTriangleResult, fastMode = false } = options;
   
    console.log(`\n🚀 ModelEnhancer: улучшение модели ${existingModel.id?.substring(0,12)}...`);

    // ===== ШАГ 1: ТРЕУГОЛЬНОЕ СРАВНЕНИЕ =====
    let triangleResult = externalTriangleResult;
    if (!triangleResult) {
        triangleResult = await this._compareByTriangles(existingModel, newExactGraph);
    }

    if (!triangleResult || triangleResult.count < 1) {
        console.log(`⚠️ Недостаточно треугольных соответствий (${triangleResult?.count || 0})`);
        return { success: false, reason: 'insufficient_triangles', similarity: triangleResult?.similarity || 0 };
    }

    console.log(`\n✅ Найдено ${triangleResult.count} треугольных соответствий!`);

    // ===== ШАГ 2: СОЗДАНИЕ ЯКОРЕЙ =====
    const anchors = this._createAnchorsFromTriangles(triangleResult, newExactGraph, existingModel.graph);

    // ===== ШАГ 3: ГЛОБАЛЬНАЯ ПРОВЕРКА =====
    const trianglesA = this._extractTrianglesFromGraph(newExactGraph);
    const trianglesB = this._extractTrianglesFromGraph(existingModel.graph);

    const consistent = this.checkGlobalConsistency(
        anchors, trianglesA, trianglesB,
        newExactGraph, existingModel.graph
    );

    // ===== ШАГ 4: ДВУХЭТАПНАЯ ДОСТРОЙКА =====
    const finalMatches = this.twoStagePositioning(
        consistent.points,
        triangleResult.matches,
        newExactGraph,
        existingModel.graph,
        newMorphology,
        existingModel.morphologyMap
    );

    // ===== ШАГ 5: ВАЛИДАЦИЯ =====
    const validationResult = await this._validateMatches(
        finalMatches, newExactGraph, existingModel.graph,
        newMorphology, existingModel.morphologyMap
    );

    if (!validationResult.success) {
        console.log(`⚠️ Валидация не удалась: ${validationResult.reason}`);
        return { success: false, reason: 'validation_failed', similarity: triangleResult.similarity };
    }

    // ===== ШАГ 6: ПРИТЯГИВАНИЕ ТОЧЕК =====
    const { pulledMatches, pulledCount } = this._magneticPull(
        finalMatches, newExactGraph, existingModel.graph,
        validationResult.transform, this.softThreshold
    );
    this.stats.magneticPulls += pulledCount;

    // ===== ШАГ 7: ПОИСК НОВЫХ ПАР =====
    const newPairs = await this._findNewPairs(
        pulledMatches, newExactGraph, existingModel.graph,
        validationResult.transform, newMorphology, existingModel.morphologyMap
    );

    const allMatches = [...pulledMatches, ...newPairs];

    // ===== ШАГ 8: ИТЕРАТИВНОЕ УТОЧНЕНИЕ =====
    const refinedResult = await this._iterativeRefinement(
        allMatches, newExactGraph, existingModel.graph,
        newMorphology, existingModel.morphologyMap,
        validationResult.transform
    );

    // ===== ШАГ 9: ПОСТРОЕНИЕ СТРУКТУР =====
    let structures = [];
    if (!fastMode) {
        structures = await this._buildAndExpandStructures(
            refinedResult.anchors, newExactGraph, existingModel.graph,
            newMorphology, existingModel.morphologyMap, triangleResult
        );
        this.stats.geometricExpansions += structures.length;
    }

    // ===== ШАГ 10: ОБНОВЛЕНИЕ МОДЕЛИ =====
    const updateResult = this._updateModel(
        existingModel, newExactGraph, refinedResult.matches, newMorphology
    );

    // ===== ШАГ 11: СЛИЯНИЕ ДУБЛИКАТОВ =====
    const mergedCount = this._mergeDuplicatePoints(existingModel.graph, 5);
    this.stats.mergedPoints += mergedCount;

    // ===== ШАГ 12: СОХРАНЕНИЕ РЕЗУЛЬТАТОВ =====
    if (structures.length > 0) {
        existingModel.structures = structures;
        existingModel.pointToStructure = this._buildPointToStructureMap(structures);
    }
    existingModel.transform = refinedResult.transform;

    this.stats.enhancements++;
    this.stats.validatedPoints += refinedResult.matches.length;

    console.log(`\n✅ ModelEnhancer: улучшение завершено`);
    console.log(`   • Подтверждено точек: ${refinedResult.matches.length}`);
    console.log(`   • Добавлено новых: ${updateResult.newNodesAdded}`);
    console.log(`   • Слито дубликатов: ${mergedCount}`);

    return {
        success: true,
        matches: refinedResult.matches,
        transform: refinedResult.transform,
        anchors: refinedResult.anchors,
        structures: structures,
        newNodesAdded: updateResult.newNodesAdded,
        similarity: triangleResult.similarity,
        stats: this.stats
    };
}
 
}
module.exports = ModelEnhancer;
