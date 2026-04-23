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
    const { photoId, contours, outlineContour, fastMode = false } = options;
   
    console.log(`\n🚀 ModelEnhancer: улучшение модели ${existingModel.id?.substring(0,12)}...`);

    // ===== ШАГ 1: ТРЕУГОЛЬНОЕ СРАВНЕНИЕ =====
    console.log(`\n🔍 ТРЕУГОЛЬНОЕ СРАВНЕНИЕ с моделью ${existingModel.id?.substring(0,12)}...`);
   
    const triangleResult = await this._compareByTriangles(existingModel, newExactGraph);

    if (!triangleResult || triangleResult.count < 1) {
        console.log(`⚠️ Недостаточно треугольных соответствий (${triangleResult?.count || 0})`);
        return {
            success: false,
            reason: 'insufficient_triangles',
            similarity: triangleResult?.similarity || 0
        };
    }

    console.log(`✅ Найдено ${triangleResult.matches?.length || 0} треугольных соответствий!`);

    // ===== ШАГ 2: СОЗДАНИЕ ЯКОРЕЙ =====
    if (this.debug) console.log(`\n🔍 СОЗДАНИЕ ВРЕМЕННЫХ ЯКОРЕЙ ДЛЯ ГЛОБАЛЬНОЙ ПРОВЕРКИ`);

    const tempAnchors = [];
    const matches = triangleResult.matches;

    for (let i = 0; i < matches.length; i += 3) {
        if (i + 2 < matches.length) {
            const group = [matches[i], matches[i+1], matches[i+2]];
            tempAnchors.push({
                aIndex: -1,
                bIndex: -1,
                geometryScore: Math.min(...group.map(m => m.confidence)),
                points: group.map(m => ({
                    pointA: m.pointA,
                    pointB: m.pointB,
                    confidence: m.confidence
                }))
            });
        }
    }

    if (this.debug) console.log(`   • Создано временных якорей: ${tempAnchors.length}`);

    // ===== ШАГ 3: ИЗВЛЕЧЕНИЕ ТРЕУГОЛЬНИКОВ =====
    if (this.debug) console.log(`\n🔍 ИЗВЛЕЧЕНИЕ ТРЕУГОЛЬНИКОВ ИЗ ГРАФОВ`);
   
    const trianglesA = this._extractTrianglesFromGraph(newExactGraph);
    const trianglesB = this._extractTrianglesFromGraph(existingModel.graph);

    if (this.debug) {
        console.log(`   • Треугольников в A: ${trianglesA.length}`);
        console.log(`   • Треугольников в B: ${trianglesB.length}`);
    }

    // ===== ШАГ 4: ГЛОБАЛЬНАЯ ПРОВЕРКА =====
    if (this.debug) console.log(`\n🔍 ЗАПУСК ГЛОБАЛЬНОЙ ПРОВЕРКИ СОГЛАСОВАННОСТИ`);

    const consistent = this.checkGlobalConsistency(
        tempAnchors, trianglesA, trianglesB,
        newExactGraph, existingModel.graph
    );

    // ===== ШАГ 5: ДВУХЭТАПНАЯ ДОСТРОЙКА =====
    const finalMatches = this.twoStagePositioning(
        consistent.points,
        triangleResult.matches,
        newExactGraph,
        existingModel.graph,
        newMorphology,
        existingModel.morphologyMap
    );

    if (this.debug) {
        console.log(`\n📊 РЕЗУЛЬТАТ ДОСТРОЙКИ:`);
        console.log(`   • Было matches: ${triangleResult.matches.length}`);
        console.log(`   • Стало matches: ${finalMatches.length}`);
    }

    // ===== ШАГ 6: ПАРАЛЛЕЛЬНАЯ ВАЛИДАЦИЯ =====
    console.log(`\n🔄 ЗАПУСК ПАРАЛЛЕЛЬНОЙ ВАЛИДАЦИИ`);

    // Подготавливаем якоря для валидации
    let anchorsForValidation = [];

    if (triangleResult.triangles && triangleResult.triangles.length > 0) {
        console.log(`\n🔍 ИСПОЛЬЗУЮ ТРЕУГОЛЬНИКИ ИЗ MATCHER (${triangleResult.triangles.length} шт)`);

        for (const tri of triangleResult.triangles) {
            if (tri.pB1 && tri.pB2 && tri.pB3) {
                anchorsForValidation.push({
                    pointA: tri.p1.id,
                    pointB: tri.pB1.id,
                    confidence: tri.confidence || 0.9,
                    triangleId: tri.id
                });
                anchorsForValidation.push({
                    pointA: tri.p2.id,
                    pointB: tri.pB2.id,
                    confidence: tri.confidence || 0.9,
                    triangleId: tri.id
                });
                anchorsForValidation.push({
                    pointA: tri.p3.id,
                    pointB: tri.pB3.id,
                    confidence: tri.confidence || 0.9,
                    triangleId: tri.id
                });
            }
        }

        if (anchorsForValidation.length > 0) {
            console.log(`   ✅ Создано ${anchorsForValidation.length} якорей из ${anchorsForValidation.length/3} треугольников`);
        }
    }

    if (anchorsForValidation.length === 0) {
        console.log(`   ⚠️ Нет треугольников, использую consistent.points`);
        anchorsForValidation = consistent.points.map(p => ({
            pointA: p.pointA,
            pointB: p.pointB,
            confidence: p.confidence
        }));
    }

    if (this.debug) console.log(`\n🔍 ЭТАП 1: Вычисление базового transform по ${anchorsForValidation.length} надёжным якорям`);

    // Вычисляем базовый transform
    const baseTransform = this.validator.calculateTransform(
        anchorsForValidation,
        newExactGraph,
        existingModel.graph
    );

    if (!baseTransform) {
        console.log(`❌ Не удалось вычислить базовый transform`);
        return {
            success: false,
            reason: 'transform_failed',
            similarity: triangleResult?.similarity || 0
        };
    }

    if (this.debug) {
        console.log(`\n📐 БАЗОВЫЙ TRANSFORM (${anchorsForValidation.length} якорей):`);
        console.log(`   • Масштаб: ${baseTransform.scale.toFixed(3)}`);
        console.log(`   • Поворот: ${(baseTransform.rotation * 180 / Math.PI).toFixed(1)}°`);
        console.log(`   • Сдвиг: (${baseTransform.translation.x.toFixed(1)}, ${baseTransform.translation.y.toFixed(1)})`);
    }

    // ===== ШАГ 7: ПОСТРОЕНИЕ ТОПОЛОГИЧЕСКИХ СТРУКТУР =====
    console.log(`\n🔍 ЭТАП 2: Построение топологических структур из ${anchorsForValidation.length} якорей`);

    const StructureManager = require('../StructureManager');
    const structureManager = new StructureManager(this.validator, {
        debug: this.debug,
        minConfidence: 0.7,
        maxScaleDeviation: 0.1,
        maxRotationDeviation: 5
    });

    const allGraphTriangles = this._extractTrianglesFromGraph(newExactGraph);
   
    console.log(`\n🔍 СОЗДАЮ ТРЕУГОЛЬНИКИ ИЗ ${anchorsForValidation.length} ЯКОРЕЙ`);
    console.log(`   • Всего треугольников в графе: ${allGraphTriangles.length}`);
    console.log(`   • triangleResult.triangles: ${triangleResult.triangles?.length || 0} треугольников`);

    // Группируем якоря по triangleId
    const anchorsByTriangle = new Map();

    for (const anchor of anchorsForValidation) {
        const triId = anchor.triangleId;
        if (!triId) {
            if (this.debug) console.log(`   ⚠️ Якорь без triangleId: ${anchor.pointA}`);
            continue;
        }
        if (!anchorsByTriangle.has(triId)) {
            anchorsByTriangle.set(triId, []);
        }
        anchorsByTriangle.get(triId).push(anchor);
    }

    console.log(`   • Найдено уникальных треугольников-якорей: ${anchorsByTriangle.size}`);

    // Создаём якорные треугольники
    const anchorTrianglesMap = new Map();
    const anchorTriangleIds = new Set();

    for (const [triId, anchors] of anchorsByTriangle) {
        if (anchors.length !== 3) continue;

        const originalTriangle = triangleResult.triangles?.find(t => t.id === triId);

        const a1 = anchors[0];
        const a2 = anchors[1];
        const a3 = anchors[2];

        const p1 = newExactGraph.nodes.get(a1.pointA);
        const p2 = newExactGraph.nodes.get(a2.pointA);
        const p3 = newExactGraph.nodes.get(a3.pointA);
        const pB1 = existingModel.graph.nodes.get(a1.pointB);
        const pB2 = existingModel.graph.nodes.get(a2.pointB);
        const pB3 = existingModel.graph.nodes.get(a3.pointB);

        if (p1.id === p2.id || p1.id === p3.id || p2.id === p3.id) continue;

        const edges = [];
        if (originalTriangle && originalTriangle.edges) {
            for (let i = 0; i < originalTriangle.edges.length; i++) {
                const origEdge = originalTriangle.edges[i];
                edges.push({
                    v1: [p1, p2, p3][i],
                    v2: [p1, p2, p3][(i+1) % 3],
                    neighborTriangles: [],
                    externalPoint: origEdge.externalPoint || null
                });
            }
        } else {
            edges = [
                { v1: p1, v2: p2, neighborTriangles: [], externalPoint: null },
                { v1: p2, v2: p3, neighborTriangles: [], externalPoint: null },
                { v1: p3, v2: p1, neighborTriangles: [], externalPoint: null }
            ];
        }

        const anchorTriangle = {
            id: triId,
            p1, p2, p3,
            pB1, pB2, pB3,
            confidence: (a1.confidence + a2.confidence + a3.confidence) / 3,
            edges: edges
        };

        anchorTrianglesMap.set(triId, anchorTriangle);
        anchorTriangleIds.add(triId);
    }

    console.log(`   • Создано якорных треугольников: ${anchorTrianglesMap.size}`);

    const candidateTriangles = allGraphTriangles.filter(t => !anchorTriangleIds.has(t.id));
    console.log(`   • Треугольников-кандидатов для расширения: ${candidateTriangles.length}`);

    console.log(`\n📊 ПЕРЕДАЮ В STRUCTUREBUILDER: ${anchorTrianglesMap.size} якорных треугольников`);

    const structures = structureManager.buildStructures(
        anchorsForValidation,
        Array.from(anchorTrianglesMap.values()),
        newExactGraph,
        existingModel.graph,
        newMorphology,
        existingModel.morphologyMap
    );

    // ===== ШАГ 8: ГЕОМЕТРИЧЕСКОЕ РАСШИРЕНИЕ =====
    if (structures.length > 0 && !fastMode) {
        console.log(`\n🔧 ЭТАП 2: Геометрическое расширение структур...`);

        const mainStructure = structures[0];
        console.log(`   • Исходная структура: ${mainStructure.triangleIds.size} треугольников`);

        let expanded = true;
        let iteration = 0;
        const maxIterations = 10;

        while (expanded && iteration < maxIterations) {
            expanded = false;
            iteration++;

            const boundaryEdges = this._getBoundaryEdgesFromStructure(mainStructure);
            console.log(`   • Итерация ${iteration}: граничных рёбер ${boundaryEdges.length}`);

            for (const edge of boundaryEdges) {
                const neighbor = this._findNeighborTriangleInGraph(edge, candidateTriangles, mainStructure);

                if (neighbor) {
                    const added = this._tryAddGeometricTriangle(
                        neighbor, mainStructure, newExactGraph, existingModel.graph,
                        newMorphology, existingModel.morphologyMap
                    );

                    if (added) {
                        expanded = true;
                        const idx = candidateTriangles.findIndex(t => t.id === neighbor.id);
                        if (idx !== -1) candidateTriangles.splice(idx, 1);
                        console.log(`      ✅ Добавлен треугольник ${neighbor.id.substring(0,12)} (осталось кандидатов: ${candidateTriangles.length})`);
                    }
                }
            }
        }

        console.log(`   ✅ Геометрическое расширение завершено, теперь ${mainStructure.triangleIds.size} треугольников`);
        console.log(`   • Осталось кандидатов: ${candidateTriangles.length}`);
    }

    console.log(`\n📊 ПОСТРОЕНО СТРУКТУР: ${structures.length}`);

// 🔥 ПРИНУДИТЕЛЬНОЕ ЗАПОЛНЕНИЕ pointIds ИЗ ТРЕУГОЛЬНИКОВ
for (const structure of structures) {
    // Собираем pointIds из треугольников
    if (structure.triangles && structure.triangles.size > 0) {
        let addedCount = 0;
        for (const tri of structure.triangles.values()) {
            if (tri.p1?.id && !structure.pointIds.has(tri.p1.id)) {
                structure.pointIds.add(tri.p1.id);
                addedCount++;
            }
            if (tri.p2?.id && !structure.pointIds.has(tri.p2.id)) {
                structure.pointIds.add(tri.p2.id);
                addedCount++;
            }
            if (tri.p3?.id && !structure.pointIds.has(tri.p3.id)) {
                structure.pointIds.add(tri.p3.id);
                addedCount++;
            }
        }
        if (addedCount > 0) {
            console.log(`   🔧 Структура ${structure.id}: добавлено ${addedCount} точек в pointIds (всего ${structure.pointIds.size})`);
        }
    }
   
    // Также собираем triangleIds, если пусто
    if (structure.triangleIds.size === 0 && structure.triangles) {
        for (const tri of structure.triangles.values()) {
            if (tri.id) structure.triangleIds.add(tri.id);
        }
        console.log(`   🔧 Структура ${structure.id}: восстановлено triangleIds: ${structure.triangleIds.size}`);
    }
}

// 🔥 ДИАГНОСТИКА И ВОССТАНОВЛЕНИЕ pointIds
for (const structure of structures) {
    // Проверяем, есть ли pointIds
    let pointIdsSize = structure.pointIds?.size || 0;
   
    // Если pointIds пустые - собираем из треугольников
    if (pointIdsSize === 0 && structure.triangles) {
        console.log(`   🔧 Восстанавливаю pointIds для структуры ${structure.id}...`);
       
        for (const tri of structure.triangles.values()) {
            if (tri.p1?.id) structure.pointIds.add(tri.p1.id);
            if (tri.p2?.id) structure.pointIds.add(tri.p2.id);
            if (tri.p3?.id) structure.pointIds.add(tri.p3.id);
        }
       
        pointIdsSize = structure.pointIds?.size || 0;
        console.log(`      ✅ Восстановлено ${pointIdsSize} точек`);
    }
   
    // Также проверяем triangleIds
    if (structure.triangleIds?.size === 0 && structure.triangles) {
        for (const tri of structure.triangles.values()) {
            if (tri.id) structure.triangleIds.add(tri.id);
        }
        console.log(`      ✅ Восстановлено ${structure.triangleIds.size} треугольников`);
    }
   
    // Выводим статистику по структуре
    if (this.debug) {
        console.log(`   • Структура ${structure.id}: ${structure.triangleIds?.size || 0} треугольников, ${pointIdsSize} точек`);
    }
}

    // ===== ШАГ 9: ФИНАЛЬНАЯ ВАЛИДАЦИЯ СТРУКТУР =====
    console.log(`\n🔍 ЭТАП 3: Финальная валидация структур`);

    let finalValidationResult = null;
    let allValidatedPoints = [];
    let finalTransform = null;

    for (const structure of structures) {
        if (structure.triangleIds.size === 0) continue;

        const structureAnchors = structure.getAnchors();
        if (structureAnchors.length === 0) continue;

        console.log(`\n   Валидация структуры ${structure.id} (${structureAnchors.length} якорей)...`);

        const validationResult = this.validator.validateAll(
            newExactGraph,
            existingModel.graph,
            structureAnchors,
            newMorphology,
            existingModel.morphologyMap
        );

        if (validationResult.success) {
            if (validationResult.results) {
                allValidatedPoints.push(...validationResult.results.confirmed);
                allValidatedPoints.push(...validationResult.results.anchors);
            }

            structure.transform = validationResult.transform;

            if (!finalValidationResult || (validationResult.transform &&
                Math.abs(validationResult.transform.scale - 1) < Math.abs(finalValidationResult.transform?.scale - 1))) {
                finalValidationResult = validationResult;
                finalTransform = validationResult.transform;
            }

            if (this.debug) {
                console.log(`      ✅ Структура ${structure.id} успешно валидирована`);
            }
        } else {
            if (this.debug) {
                console.log(`      ⚠️ Структура ${structure.id} НЕ прошла валидацию!`);
            }
        }
    }

    // Если не удалось ни одной структуры - используем якоря
    if (!finalValidationResult) {
        console.log(`\n⚠️ Структуры не дали результата, используем якоря...`);

        finalValidationResult = this.validator.validateAll(
            newExactGraph,
            existingModel.graph,
            anchorsForValidation,
            newMorphology,
            existingModel.morphologyMap
        );

        if (finalValidationResult && finalValidationResult.success) {
            finalTransform = finalValidationResult.transform;
        }
    }

    if (!finalValidationResult || !finalValidationResult.success) {
        console.log(`\n⚠️ Финальная валидация не удалась`);
        return {
            success: false,
            reason: 'validation_failed',
            similarity: triangleResult?.similarity || 0
        };
    }

 // 🔥 ЛОГ: ПЕРВЫЕ 5 ЯКОРЕЙ ДЛЯ ДИАГНОСТИКИ
    if (anchorsForValidation && anchorsForValidation.length > 0) {
        console.log(`\n🔍 ПЕРВЫЕ 5 ЯКОРЕЙ ДЛЯ TRANSFORM:`);
        const sampleAnchors = anchorsForValidation.slice(0, 5);
        for (let i = 0; i < sampleAnchors.length; i++) {
            const a = sampleAnchors[i];
            const pA = newExactGraph.nodes.get(a.pointA);
            const pB = existingModel.graph.nodes.get(a.pointB);
            if (pA && pB) {
                console.log(`   ${i+1}. ${a.pointA.substring(0,16)} (${pA.x.toFixed(0)},${pA.y.toFixed(0)}) → ${a.pointB.substring(0,16)} (${pB.x.toFixed(0)},${pB.y.toFixed(0)})`);
            }
        }
    }
 
 // 🔥 ЛОГ: НАЧАЛЬНЫЙ TRANSFORM (до всех коррекций)
    if (finalTransform) {
        console.log(`\n📐 НАЧАЛЬНЫЙ TRANSFORM (до коррекций):`);
        console.log(`   • Масштаб: ${finalTransform.scale.toFixed(3)}`);
        console.log(`   • Поворот: ${(finalTransform.rotation * 180 / Math.PI).toFixed(1)}°`);
        console.log(`   • Сдвиг: (${finalTransform.translation.x.toFixed(1)}, ${finalTransform.translation.y.toFixed(1)})`);
    }
 
    // ===== СБОР ПОДТВЕРЖДЁННЫХ ТОЧЕК =====
let finalValidatedMatches = [];

for (const structure of structures) {
    const anchors = structure.getAnchors();
    for (const anchor of anchors) {
        if (anchor.pointA && anchor.pointB) {
            finalValidatedMatches.push({
                pointA: anchor.pointA,
                pointB: anchor.pointB,
                confidence: anchor.confidence,
                status: 'structure',
                structureId: structure.id
            });
        }
    }
}

console.log(`\n✅ ИТОГО ПОДТВЕРЖДЕННЫХ ТОЧЕК: ${finalValidatedMatches.length}`);

// ===== ШАГ 10: ФИНАЛЬНОЕ ПРИТЯГИВАНИЕ =====
if (this.debug) console.log(`\n🧲 ЗАПУСК ФИНАЛЬНОГО ПРИТЯГИВАНИЯ БЛИЗКИХ ТОЧЕК`);
    if (finalTransform && finalValidatedMatches.length > 0) {
        const { pulledMatches, pulledCount } = this._magneticPull(
            finalValidatedMatches,
            newExactGraph,
            existingModel.graph,
            finalTransform,
            25
        );

        if (pulledCount > 0) {
            if (this.debug) console.log(`\n✅ Притянуто ${pulledCount} точек!`);
            finalValidatedMatches = pulledMatches;
        }
    }

    // ===== ШАГ 11: ПОИСК НОВЫХ ПАР =====
const matchedPointsA = new Set(finalValidatedMatches?.map(m => m?.pointA) || []);
const matchedPointsB = new Set(finalValidatedMatches?.map(m => m?.pointB) || []);

const unmatchedPhotoPoints = originalPoints.filter(p => !matchedPointsA.has(p.id));

// 🔥 ИСПРАВЛЕНИЕ: создаём Map, а не массив
const unmatchedModelPoints = new Map();
if (existingModel?.graph?.nodes) {
    for (const [id, node] of existingModel.graph.nodes) {
        if (!matchedPointsB.has(id)) {
            unmatchedModelPoints.set(id, node);
        }
    }
}

let newPairsFound = 0;
const newPairs = [];

// 🔥 ПРОВЕРКА: если нет несопоставленных точек модели - пропускаем
if (unmatchedModelPoints.size === 0) {
    console.log(`   ⚠️ Нет несопоставленных точек модели для поиска новых пар`);
} else {
    for (const photoPoint of unmatchedPhotoPoints) {
        if (!photoPoint || !photoPoint.id) continue;
       
        const projected = {
            x: photoPoint.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
               photoPoint.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
               finalTransform.translation.x,
            y: photoPoint.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
               photoPoint.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
               finalTransform.translation.y
        };

        let bestMatch = null;
        let bestDist = Infinity;

        // 🔥 ИСПРАВЛЕНИЕ: используем Map.entries() для итерации
        for (const [modelId, modelPoint] of unmatchedModelPoints.entries()) {
            const dx = projected.x - modelPoint.x;
            const dy = projected.y - modelPoint.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < bestDist && dist < 20) {
                bestDist = dist;
                bestMatch = { modelId, modelPoint };
            }
        }

        if (bestMatch) {
            const photoMorph = newMorphology.get(photoPoint.id);
            const modelMorph = existingModel.morphologyMap.get(bestMatch.modelId);

            if (photoMorph && modelMorph) {
                let morphScore = 0;
                let checks = 0;

                if (photoMorph.eccentricity && modelMorph.eccentricity) {
                    const ratio = Math.min(photoMorph.eccentricity, modelMorph.eccentricity) /
                                 Math.max(photoMorph.eccentricity, modelMorph.eccentricity);
                    morphScore += ratio;
                    checks++;
                }

                if (photoMorph.asymmetry && modelMorph.asymmetry) {
                    const ratio = Math.min(photoMorph.asymmetry, modelMorph.asymmetry) /
                                 Math.max(photoMorph.asymmetry, modelMorph.asymmetry);
                    morphScore += ratio;
                    checks++;
                }

                const finalMorphScore = checks > 0 ? morphScore / checks : 0.5;

                if (finalMorphScore > 0.45) {
                    newPairs.push({
                        pointA: photoPoint.id,
                        pointB: bestMatch.modelId,
                        confidence: 1 - (bestDist / 30),
                        status: 'new_pair'
                    });
                    newPairsFound++;
                }
            }
        }
    }
}

if (newPairsFound > 0) {
    console.log(`\n✅ Найдено ${newPairsFound} новых пар среди несопоставленных точек!`);
    finalValidatedMatches = [...finalValidatedMatches, ...newPairs];
} else {
    if (this.debug) console.log(`\n⚠️ Новых пар не найдено`);
}

    // ===== ШАГ 12: КОРРЕКЦИЯ ПО BOUNDING BOX =====
    if (finalValidatedMatches.length >= 3 && finalTransform) {
        console.log(`\n🔧 ЗАПУСК КОРРЕКЦИИ ПО BOUNDING BOX...`);

        const photoPoints = [];
        const modelPoints = [];

        for (const match of finalValidatedMatches) {
            const photoPoint = newExactGraph.nodes.get(match.pointA);
            const modelPoint = existingModel.graph.nodes.get(match.pointB);
            if (photoPoint && modelPoint) {
                photoPoints.push({ x: photoPoint.x, y: photoPoint.y, weight: match.confidence || 0.5 });
                modelPoints.push({ x: modelPoint.x, y: modelPoint.y, weight: match.confidence || 0.5 });
            }
        }

        if (photoPoints.length >= 3) {
            let photoCenterX = 0, photoCenterY = 0;
            let modelCenterX = 0, modelCenterY = 0;
            let totalWeight = 0;

            for (let i = 0; i < photoPoints.length; i++) {
                const w = photoPoints[i].weight;
                photoCenterX += photoPoints[i].x * w;
                photoCenterY += photoPoints[i].y * w;
                modelCenterX += modelPoints[i].x * w;
                modelCenterY += modelPoints[i].y * w;
                totalWeight += w;
            }

            photoCenterX /= totalWeight;
            photoCenterY /= totalWeight;
            modelCenterX /= totalWeight;
            modelCenterY /= totalWeight;

            const currentRot = finalTransform?.rotation || 0;
            const currentScale = finalTransform?.scale || 1;

            const transformedPhotoPoints = photoPoints.map(p => ({
                x: modelCenterX + ((p.x - photoCenterX) * currentScale * Math.cos(currentRot) -
                                   (p.y - photoCenterY) * currentScale * Math.sin(currentRot)),
                y: modelCenterY + ((p.x - photoCenterX) * currentScale * Math.sin(currentRot) +
                                   (p.y - photoCenterY) * currentScale * Math.cos(currentRot)),
                weight: p.weight
            }));

            let transMinX = Infinity, transMaxX = -Infinity;
            let transMinY = Infinity, transMaxY = -Infinity;
            for (const p of transformedPhotoPoints) {
                transMinX = Math.min(transMinX, p.x);
                transMaxX = Math.max(transMaxX, p.x);
                transMinY = Math.min(transMinY, p.y);
                transMaxY = Math.max(transMaxY, p.y);
            }

            let modelMinX = Infinity, modelMaxX = -Infinity;
            let modelMinY = Infinity, modelMaxY = -Infinity;
            for (const p of modelPoints) {
                modelMinX = Math.min(modelMinX, p.x);
                modelMaxX = Math.max(modelMaxX, p.x);
                modelMinY = Math.min(modelMinY, p.y);
                modelMaxY = Math.max(modelMaxY, p.y);
            }

            const transWidth = transMaxX - transMinX;
            const transHeight = transMaxY - transMinY;
            const modelWidth = modelMaxX - modelMinX;
            const modelHeight = modelMaxY - modelMinY;

            const scaleX = modelWidth / transWidth;
            const scaleY = modelHeight / transHeight;

            const safeScaleX = Math.min(Math.max(scaleX, 0.8), 1.2);
            const safeScaleY = Math.min(Math.max(scaleY, 0.8), 1.2);
            const avgScale = (safeScaleX + safeScaleY) / 2;

            console.log(`\n📊 BOUNDING BOX АНАЛИЗ:`);
            console.log(`   • Требуемый масштаб X: ${scaleX.toFixed(3)} → ${safeScaleX.toFixed(3)}`);
            console.log(`   • Требуемый масштаб Y: ${scaleY.toFixed(3)} → ${safeScaleY.toFixed(3)}`);
            console.log(`   • Усреднённый масштаб: ${avgScale.toFixed(3)}`);

            finalTransform = {
                scale: currentScale * avgScale,
                rotation: currentRot,
                translation: {
                    x: modelCenterX - (photoCenterX * currentScale * avgScale * Math.cos(currentRot) -
                                       photoCenterY * currentScale * avgScale * Math.sin(currentRot)),
                    y: modelCenterY - (photoCenterX * currentScale * avgScale * Math.sin(currentRot) +
                                       photoCenterY * currentScale * avgScale * Math.cos(currentRot))
                }
            };

            console.log(`\n✅ КОРРЕКЦИЯ ЗАВЕРШЕНА`);
            console.log(`   • Новый масштаб: ${finalTransform.scale.toFixed(3)} (было ${currentScale.toFixed(3)})`);
        }
    }

// ===== КОРРЕКЦИЯ ПОЛОЖЕНИЯ НОВЫХ ТОЧЕК ПО ЯКОРЯМ =====
if (this.lastUniqueInPhoto && this.lastUniqueInPhoto.length > 0 && anchorsForValidation.length >= 3) {
    console.log(`\n🔧 КОРРЕКЦИЯ ПОЛОЖЕНИЯ ${this.lastUniqueInPhoto.length} НОВЫХ ТОЧЕК ПО ЯКОРЯМ...`);
   
    // Собираем якорные пары (точки, которые уже сопоставлены)
    const anchorPairs = [];
    for (const match of finalValidatedMatches) {
        const photoPoint = newExactGraph.nodes.get(match.pointA);
        const modelPoint = existingModel.graph.nodes.get(match.pointB);
        if (photoPoint && modelPoint) {
            anchorPairs.push({
                photo: photoPoint,
                model: modelPoint,
                confidence: match.confidence || 0.5
            });
        }
    }
   
    if (anchorPairs.length >= 3) {
        // Вычисляем среднее смещение между фото и моделью по якорям
        let totalDx = 0, totalDy = 0;
        let totalWeight = 0;
       
        for (const pair of anchorPairs) {
            // Проецируем фото-точку через текущий transform
            const projected = {
                x: pair.photo.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
                   pair.photo.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
                   finalTransform.translation.x,
                y: pair.photo.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
                   pair.photo.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
                   finalTransform.translation.y
            };
           
            // Смещение между спроецированной точкой и реальной точкой модели
            const dx = pair.model.x - projected.x;
            const dy = pair.model.y - projected.y;
            const weight = pair.confidence;
           
            totalDx += dx * weight;
            totalDy += dy * weight;
            totalWeight += weight;
        }
       
        const avgDx = totalWeight > 0 ? totalDx / totalWeight : 0;
        const avgDy = totalWeight > 0 ? totalDy / totalWeight : 0;
       
        console.log(`   📊 Среднее смещение по якорям: dx=${avgDx.toFixed(2)}px, dy=${avgDy.toFixed(2)}px`);
       
        // Применяем коррекцию ко всем новым точкам
        if (Math.abs(avgDx) > 0.5 || Math.abs(avgDy) > 0.5) {
            let correctedCount = 0;
            for (const point of this.lastUniqueInPhoto) {
                point.x += avgDx;
                point.y += avgDy;
                correctedCount++;
            }
            console.log(`   ✅ Скорректировано ${correctedCount} новых точек (сдвиг компенсирован)`);
           
            // Также корректируем transform, чтобы следующие фото ложились точнее
            finalTransform.translation.x += avgDx;
            finalTransform.translation.y += avgDy;
            console.log(`   🔄 Transform скорректирован: новый сдвиг (${finalTransform.translation.x.toFixed(1)}, ${finalTransform.translation.y.toFixed(1)})`);
        } else {
            console.log(`   ✅ Смещение минимально (${avgDx.toFixed(2)}, ${avgDy.toFixed(2)}), коррекция не требуется`);
        }
    } else {
        console.log(`   ⚠️ Недостаточно якорей для коррекции (нужно минимум 3, есть ${anchorPairs.length})`);
    }
}
 
 
// ===== СОХРАНЯЕМ УНИКАЛЬНЫЕ ТОЧКИ ФОТО С КЛАСТЕРНОЙ ТРАНСФОРМАЦИЕЙ =====
const finalMatchedPointsA = new Set(finalValidatedMatches?.map(m => m?.pointA) || []);
const unmatchedPhotoPointsForModel = originalPoints.filter(p => !finalMatchedPointsA.has(p.id));
console.log(`   📸 Несопоставленных точек фото для добавления в модель: ${unmatchedPhotoPointsForModel.length}`);

// 🔥 Строим карту: pointId → structure
const pointToStructureMap = new Map();
for (const structure of structures) {
    if (structure.pointIds) {
        for (const pointId of structure.pointIds) {
            pointToStructureMap.set(pointId, structure);
        }
    }
}

// 🔥 Для структур без transform — вычисляем
for (const structure of structures) {
    if (!structure.transform && structure.triangleIds?.size >= 2) {
        const structureAnchors = structure.getAnchors ? structure.getAnchors() : [];
        if (structureAnchors.length >= 3) {
            structure.transform = this.validator.calculateTransform(
                structureAnchors, newExactGraph, existingModel.graph
            );
            if (this.debug && structure.transform) {
                console.log(`      🔧 Вычислен transform для структуры ${structure.id}: scale=${structure.transform.scale.toFixed(3)}`);
            }
        }
    }
}

// 🔥 Функция поиска ближайшей структуры с transform
const findNearestStructureWithTransform = (point) => {
    let nearest = null;
    let minDist = Infinity;
   
    for (const structure of structures) {
        if (!structure.transform) continue;
       
        // Ищем минимальное расстояние до любой точки структуры
        for (const structPointId of (structure.pointIds || [])) {
            const structPoint = newExactGraph.nodes.get(structPointId);
            if (structPoint) {
                const dist = Math.sqrt(
                    Math.pow(point.x - structPoint.x, 2) +
                    Math.pow(point.y - structPoint.y, 2)
                );
                if (dist < minDist) {
                    minDist = dist;
                    nearest = structure;
                }
            }
        }
    }
   
    return nearest;
};

// 🔥 Применяем кластерную трансформацию
const uniquePhotoPoints = [];
const transformStats = {
    ownStructure: 0,
    nearestStructure: 0,
    global: 0
};

for (const p of unmatchedPhotoPointsForModel) {
    const pointStructure = pointToStructureMap.get(p.id);
   
    let transform;
    let transformSource;
    let usedStructureId = null;
   
    if (pointStructure && pointStructure.transform) {
        // Точка принадлежит структуре с известным transform
        transform = pointStructure.transform;
        transformSource = 'own_structure';
        usedStructureId = pointStructure.id;
        transformStats.ownStructure++;
    } else {
        // Ищем ближайшую структуру с transform
        const nearestStructure = findNearestStructureWithTransform(p);
       
        if (nearestStructure && nearestStructure.transform) {
            transform = nearestStructure.transform;
            transformSource = 'nearest_structure';
            usedStructureId = nearestStructure.id;
            transformStats.nearestStructure++;
        } else {
            // Fallback на глобальный transform
            transform = finalTransform;
            transformSource = 'global';
            usedStructureId = null;
            transformStats.global++;
        }
    }
   
    // Применяем выбранный transform
    const projected = {
        x: p.x * transform.scale * Math.cos(transform.rotation) -
           p.y * transform.scale * Math.sin(transform.rotation) +
           transform.translation.x,
        y: p.x * transform.scale * Math.sin(transform.rotation) +
           p.y * transform.scale * Math.cos(transform.rotation) +
           transform.translation.y
    };
   
    uniquePhotoPoints.push({
        id: p.id,
        x: projected.x,
        y: projected.y,
        type: 'unique_in_photo',
        transformSource: transformSource,
        structureId: usedStructureId
    });
}

console.log(`   📊 Источники трансформации для новых точек:`);
console.log(`      • Своя структура: ${transformStats.ownStructure}`);
console.log(`      • Ближайшая структура: ${transformStats.nearestStructure}`);
console.log(`      • Глобальная: ${transformStats.global}`);

this.lastUniqueInPhoto = uniquePhotoPoints;

// ===== ШАГ 13: ОБНОВЛЕНИЕ МОДЕЛИ (ПЕРЕДАЁМ uniquePhotoPoints ЯВНО) =====
console.log(`\n📤 Передаём в updateModelWithOptimalMatches: ${finalValidatedMatches?.length || 0} точек`);

const updateResult = this._updateModel(
    existingModel,
    newExactGraph,
    finalValidatedMatches,
    newMorphology,
    uniquePhotoPoints  // ← ПЕРЕДАЁМ ЯВНО
);

// Слияние дубликатов
const mergedCount = this.mergeDuplicatePoints(existingModel.graph, 5);
if (this.debug && mergedCount > 0) {
    console.log(`\n🔗 Слито ${mergedCount} дублирующихся точек`);
}

// Сохраняем ТРАНСФОРМИРОВАННЫЙ контур в модель
if (outlineContour) {
    // 🔥 Контур тоже трансформируем через глобальный transform
    // (для контура кластерная трансформация не нужна — он один на весь след)
    const transformedContourPoints = outlineContour.points.map(p => {
        const projected = {
            x: p.x * finalTransform.scale * Math.cos(finalTransform.rotation) -
               p.y * finalTransform.scale * Math.sin(finalTransform.rotation) +
               finalTransform.translation.x,
            y: p.x * finalTransform.scale * Math.sin(finalTransform.rotation) +
               p.y * finalTransform.scale * Math.cos(finalTransform.rotation) +
               finalTransform.translation.y
        };
        return projected;
    });
   
    const transformedContour = {
        points: transformedContourPoints,
        class: outlineContour.class || 'Outline-trail',
        type: outlineContour.type || 'footprint_outline'
    };
   
    if (!existingModel.metadata.outlineContours) {
        existingModel.metadata.outlineContours = [];
        // Переносим старый контур, если он был
        if (existingModel.metadata.outlineContour) {
            existingModel.metadata.outlineContours.push({
                photoId: 'initial',
                points: existingModel.metadata.outlineContour.points,
                class: existingModel.metadata.outlineContour.class || 'Outline-trail',
                type: existingModel.metadata.outlineContour.type || 'footprint_outline'
            });
            delete existingModel.metadata.outlineContour;
        }
    }
   
    existingModel.metadata.outlineContours.push({
        photoId: photoId,
        points: transformedContourPoints,
        class: outlineContour.class || 'Outline-trail',
        type: outlineContour.type || 'footprint_outline'
    });
   
    console.log(`💾 Трансформированный контур следа сохранён в модель (${transformedContourPoints.length} точек)`);
}

// Сохраняем transform и структуры
existingModel.transform = finalTransform;
existingModel.structures = structures.map(s => {
    // Гарантируем, что pointIds не пустые
    let pointIds = Array.from(s.pointIds || []);
  
    // Если всё ещё пусто - последняя попытка собрать из треугольников
    if (pointIds.length === 0 && s.triangles && s.triangles.size > 0) {
        const pointSet = new Set();
        for (const tri of s.triangles.values()) {
            if (tri.p1?.id) pointSet.add(tri.p1.id);
            if (tri.p2?.id) pointSet.add(tri.p2.id);
            if (tri.p3?.id) pointSet.add(tri.p3.id);
        }
        pointIds = Array.from(pointSet);
        if (pointIds.length > 0) {
            console.log(`      🔧 При сохранении восстановлено pointIds: ${pointIds.length} точек для ${s.id}`);
        }
    }
  
    return {
        id: s.id,
        triangleIds: Array.from(s.triangleIds || []),
        pointIds: pointIds,
        transform: s.transform,
        confidence: s.calculateConfidence ? s.calculateConfidence() : 0.5,
        rays: s.rays || [],
        triangles: s.triangles ? Array.from(s.triangles.values()).map(t => ({
            id: t.id,
            p1: t.p1,
            p2: t.p2,
            p3: t.p3,
            pB1: t.pB1,
            pB2: t.pB2,
            pB3: t.pB3
        })) : []
    };
});

// ===== ПРОСТАЯ КОРРЕКЦИЯ СДВИГА ПО СРЕДНЕМУ СМЕЩЕНИЮ =====
if (anchorsForValidation.length >= 3 && finalTransform) {
    console.log(`\n🔧 КОРРЕКЦИЯ СДВИГА ПО ${anchorsForValidation.length} ЯКОРЯМ (среднее смещение)...`);
   
    // Собираем пары фото-модель
    const pairs = [];
    for (const anchor of anchorsForValidation) {
        const photoPoint = newExactGraph.nodes.get(anchor.pointA);
        const modelPoint = existingModel.graph.nodes.get(anchor.pointB);
        if (photoPoint && modelPoint) {
            pairs.push({ photo: photoPoint, model: modelPoint, confidence: anchor.confidence || 0.5 });
        }
    }
   
    if (pairs.length >= 3) {
        let totalOffsetX = 0, totalOffsetY = 0, totalWeight = 0;
       
        for (const pair of pairs) {
            const projected = GeometryUtils.applyTransform(pair.photo, finalTransform);
           
            const dx = pair.model.x - projected.x;
            const dy = pair.model.y - projected.y;
            const weight = pair.confidence;
           
            totalOffsetX += dx * weight;
            totalOffsetY += dy * weight;
            totalWeight += weight;
        }
       
        const avgOffsetX = totalWeight > 0 ? totalOffsetX / totalWeight : 0;
        const avgOffsetY = totalWeight > 0 ? totalOffsetY / totalWeight : 0;
       
        // Применяем коррекцию ОДИН РАЗ
        finalTransform.translation.x += avgOffsetX;
        finalTransform.translation.y += avgOffsetY;
       
        console.log(`   📊 Среднее смещение: dx=${avgOffsetX.toFixed(2)}px, dy=${avgOffsetY.toFixed(2)}px`);
        console.log(`   🔄 Transform скорректирован ОДНИМ шагом: новый сдвиг (${finalTransform.translation.x.toFixed(1)}, ${finalTransform.translation.y.toFixed(1)})`);
        console.log(`   🔒 Модель НЕ смещалась — координаты точек модели неизменны`);
    }
}

// 🔥 ВЫВОДИМ КОНТРОЛЬНЫЕ ТОЧКИ ПОСЛЕ ВСЕХ КОРРЕКЦИЙ
if (finalValidatedMatches && finalValidatedMatches.length >= 5 && finalTransform) {
    console.log(`\n🔍 КОНТРОЛЬНЫЕ ТОЧКИ (ПОСЛЕ ВСЕХ КОРРЕКЦИЙ):`);
    this._logControlPoints(finalValidatedMatches, newExactGraph, existingModel.graph, finalTransform);
}
 
// Статистика
const confirmedInModel = finalValidatedMatches?.length || 0;
const uniquePoints = existingModel?.graph?.nodes?.size || 0;
let confirmedPointsCount = 0;
for (const node of existingModel.graph.nodes.values()) {
    if ((node.confirmationCount || 0) >= 2) confirmedPointsCount++;
}
const stability = uniquePoints > 0 ? (confirmedPointsCount / uniquePoints * 100).toFixed(1) : 0;

console.log(`\n📊 СТАТИСТИКА МОДЕЛИ:`);
console.log(`   • 🟠 Подтвержденных (2+ фото): ${confirmedInModel}`);
console.log(`   • Всего в модели теперь: ${uniquePoints}`);
console.log(`   • Стабильность: ${stability}%`);

this.stats.enhancements++;
this.stats.magneticPulls += 1;

const serializedStructures = structures.map(s => {
    // Собираем pointIds из треугольников, если их нет
    let pointIds = Array.from(s.pointIds || []);
  
    if (pointIds.length === 0 && s.triangles && s.triangles.size > 0) {
        const pointSet = new Set();
        for (const tri of s.triangles.values()) {
            if (tri.p1?.id) pointSet.add(tri.p1.id);
            if (tri.p2?.id) pointSet.add(tri.p2.id);
            if (tri.p3?.id) pointSet.add(tri.p3.id);
        }
        pointIds = Array.from(pointSet);
        console.log(`   🔧 Сериализация: для ${s.id} собрано ${pointIds.length} точек из треугольников`);
    }
  
    return {
        id: s.id,
        triangleIds: Array.from(s.triangleIds || []),
        pointIds: pointIds,
        transform: s.transform,
        confidence: s.calculateConfidence ? s.calculateConfidence() : 0.5,
        rays: s.rays || [],
        triangles: s.triangles ? Array.from(s.triangles.values()).map(t => ({
            id: t.id,
            p1: t.p1,
            p2: t.p2,
            p3: t.p3,
            pB1: t.pB1,
            pB2: t.pB2,
            pB3: t.pB3
        })) : []
    };
});

// 🔥 ЛОГ: какой transform возвращает ModelEnhancer
console.log(`\n📤 ModelEnhancer ВОЗВРАЩАЕТ TRANSFORM:`);
console.log(`   • Масштаб: ${finalTransform.scale.toFixed(3)}`);
console.log(`   • Поворот: ${(finalTransform.rotation * 180 / Math.PI).toFixed(1)}°`);
console.log(`   • Сдвиг: (${finalTransform.translation.x.toFixed(1)}, ${finalTransform.translation.y.toFixed(1)})`);

return {
    success: true,
    matches: finalValidatedMatches,
    transform: finalTransform,
    newNodesAdded: updateResult.newNodesAdded,
    mergedCount: mergedCount,
    similarity: triangleResult.similarity,
    structures: serializedStructures,
    stats: this.stats,
    uniquePhotoPoints: uniquePhotoPoints
};
}
 

/**
* Сравнение по треугольникам
*/
async _compareByTriangles(model, graph) {
    const TriangleMatcher = require('../../matching/TriangleMatcher');
    const points = this._extractPointsFromModel(model);
    const pointsNew = Array.from(graph.nodes.values()).map(n => ({
        id: n.id, x: n.x, y: n.y,
        eccentricity: n.eccentricity || 0,
        asymmetry: n.asymmetry || 0,
        radialProfile: n.radialProfile || [0,0,0,0,0,0,0,0]
    }));
    const matcher = new TriangleMatcher({ debug: false });
    return matcher.findMatches(pointsNew, points, graph, model.graph);
}

/**
* Извлечение точек из модели
*/
_extractPointsFromModel(model) {
    const points = [];
    for (const [nodeId, node] of model.graph.nodes) {
        const morph = model.morphologyMap?.get(nodeId) || {};
        points.push({
            id: nodeId, x: node.x, y: node.y,
            eccentricity: morph.eccentricity || 0,
            asymmetry: morph.asymmetry || 0,
            radialProfile: morph.radialProfile || [0,0,0,0,0,0,0,0]
        });
    }
    return points;
}

/**
* Создание якорей из треугольников
*/
_createAnchorsFromTriangles(triangleResult, graphA, graphB) {
    const anchors = [];
    if (!triangleResult.triangles) return anchors;
    for (const tri of triangleResult.triangles) {
        if (tri.pB1 && tri.pB2 && tri.pB3) {
            anchors.push({ pointA: tri.p1.id, pointB: tri.pB1.id, confidence: tri.confidence || 0.9, triangleId: tri.id });
            anchors.push({ pointA: tri.p2.id, pointB: tri.pB2.id, confidence: tri.confidence || 0.9, triangleId: tri.id });
            anchors.push({ pointA: tri.p3.id, pointB: tri.pB3.id, confidence: tri.confidence || 0.9, triangleId: tri.id });
        }
    }
    return anchors;
}

/**
* Валидация matches
*/
_validateMatches(matches, graphA, graphB, morphologyMap, modelMorphology) {
    const anchors = matches.map(m => ({ pointA: m.pointA, pointB: m.pointB, confidence: m.confidence || 0.8 }));
    if (anchors.length < 3) return { success: false, reason: 'insufficient_anchors' };
    const result = this.validator.validateAll(graphA, graphB, anchors, morphologyMap, modelMorphology);
    return { success: result.success, transform: result.transform, results: result.results };
}

/**
* Обновление модели новыми соответствиями
*/
_updateModel(model, newGraph, matches, newMorphology, uniquePhotoPoints = null) {
        let confirmedExisting = 0;
        let newNodesAdded = 0;
       
        // 🔥 ЛОГ: координаты модели ДО добавления новых точек
        const nodesBefore = Array.from(model.graph.nodes.values());
        if (nodesBefore.length > 0) {
            console.log(`\n📍 ДО ДОБАВЛЕНИЯ — существующие точки (первые 5):`);
            nodesBefore.slice(0, 5).forEach((node, i) => {
                console.log(`   ${i+1}. ${node.id.substring(0,16)}: (${node.x.toFixed(1)}, ${node.y.toFixed(1)}) [conf=${node.confirmationCount || 1}]`);
            });
        }

    for (const match of matches) {
        const modelNode = model.graph.nodes.get(match.pointB);
        if (modelNode) {
            modelNode.confirmationCount = (modelNode.confirmationCount || 1) + 1;
            confirmedExisting++;
        }
    }

    // 🔥 Используем переданный параметр или fallback на this.lastUniqueInPhoto
    const pointsToAdd = uniquePhotoPoints || this.lastUniqueInPhoto || [];
   
    if (pointsToAdd.length > 0) {
        console.log(`   📸 Добавляем ${pointsToAdd.length} новых точек в модель (уже трансформированных)`);
      
        for (const photoPoint of pointsToAdd) {
            // Проверка на дубликат
            let isDuplicate = false;
            let closestDist = Infinity;
          
            for (const [modelId, modelNode] of model.graph.nodes) {
                const dist = GeometryUtils.distance(modelNode, photoPoint);
                closestDist = Math.min(closestDist, dist);
                if (dist < 5) {
                    isDuplicate = true;
                    break;
                }
            }
          
            if (!isDuplicate) {
    const newNodeId = `node_${Date.now()}_${newNodesAdded}_${Math.random().toString(36).substr(2, 4)}`;
    model.graph.nodes.set(newNodeId, {
        id: newNodeId,
        x: photoPoint.x,
        y: photoPoint.y,
        degree: 0,
        triangles: 0,
        confirmationCount: 1,  // 🔥 Новая точка — 1 подтверждение
        addedFrom: 'new_photo_point',
        addedAt: new Date(),
        originalPhotoId: photoPoint.id,
       
        // 🔥 Сохраняем source структуры и трансформации
        structureId: photoPoint.structureId || null,
        transformSource: photoPoint.transformSource || 'unknown',
       
        // Морфология (если есть)
        morphology: photoPoint.morphology || {}
    });
    newNodesAdded++;
   
    if (this.debug && newNodesAdded <= 3) {
        console.log(`      ✅ Добавлена точка: (${photoPoint.x.toFixed(1)}, ${photoPoint.y.toFixed(1)}) [confirmation=1, structure=${photoPoint.structureId || 'none'}]`);
    }
            } else if (this.debug) {
                console.log(`      ⏭️ Пропущен дубликат: (${photoPoint.x.toFixed(1)}, ${photoPoint.y.toFixed(1)}) [dist=${closestDist.toFixed(1)}px]`);
            }
        }
      
        console.log(`   📊 Добавлено новых узлов: ${newNodesAdded}`);
    }

if (pointsToAdd.length > 0) {
            console.log(`\n📍 ДОБАВЛЯЮ НОВЫЕ ТОЧКИ (первые 5):`);
            pointsToAdd.slice(0, 5).forEach((p, i) => {
                console.log(`   ${i+1}. ${p.id}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) [трансформированные]`);
            });
        }
       
        // 🔥 ЛОГ: координаты модели ПОСЛЕ добавления
        const nodesAfter = Array.from(model.graph.nodes.values());
        if (nodesAfter.length > nodesBefore.length) {
            console.log(`\n📍 ПОСЛЕ ДОБАВЛЕНИЯ — все точки (первые 5):`);
            nodesAfter.slice(0, 5).forEach((node, i) => {
                const oldNode = nodesBefore.find(n => n.id === node.id);
                const status = oldNode ? 'существующая' : 'НОВАЯ';
                console.log(`   ${i+1}. ${node.id.substring(0,16)}: (${node.x.toFixed(1)}, ${node.y.toFixed(1)}) [${status}] [conf=${node.confirmationCount || 1}]`);
            });
        }

        return { confirmedExisting, newNodesAdded };
    }
 /**
* Извлекает все треугольники из графа
*/
_extractTrianglesFromGraph(graph) {
    const triangles = [];
    const nodeIds = Array.from(graph.nodes.keys());
    const edges = graph.edges;
   
    for (let i = 0; i < nodeIds.length; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
            for (let k = j + 1; k < nodeIds.length; k++) {
                const a = nodeIds[i];
                const b = nodeIds[j];
                const c = nodeIds[k];
               
                const edgeAB = [a, b].sort().join('--');
                const edgeBC = [b, c].sort().join('--');
                const edgeCA = [c, a].sort().join('--');
               
                if (edges.has(edgeAB) && edges.has(edgeBC) && edges.has(edgeCA)) {
                    const p1 = graph.nodes.get(a);
                    const p2 = graph.nodes.get(b);
                    const p3 = graph.nodes.get(c);
                   
                    if (p1 && p2 && p3) {
                        triangles.push({
                            p1, p2, p3,
                            id: `tri_${a}_${b}_${c}`,
                            edges: [
                                { v1: p1, v2: p2, externalPoint: null, neighborTriangles: [] },
                                { v1: p2, v2: p3, externalPoint: null, neighborTriangles: [] },
                                { v1: p3, v2: p1, externalPoint: null, neighborTriangles: [] }
                            ]
                        });
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
     * Выводит 5 контрольных точек для проверки качества сопоставления
     * @param {Array} matches - массив соответствий {pointA, pointB, confidence}
     * @param {Object} photoGraph - граф фото
     * @param {Object} modelGraph - граф модели
     * @param {Object} transform - финальная трансформация
     */
    _logControlPoints(matches, photoGraph, modelGraph, transform) {
        if (!matches || matches.length < 5) {
            if (this.debug) console.log('⚠️ Недостаточно соответствий для контрольных точек');
            return;
        }

        // 1. Собираем все сопоставленные точки
        const pairedPoints = [];
        for (const match of matches) {
            const photoPoint = photoGraph.nodes.get(match.pointA);
            const modelPoint = modelGraph.nodes.get(match.pointB);
            if (photoPoint && modelPoint) {
                pairedPoints.push({
                    photo: photoPoint,
                    model: modelPoint,
                    confidence: match.confidence || 0.5
                });
            }
        }

        if (pairedPoints.length < 5) return;

        // 2. Находим центр (точка, ближайшая к геометрическому центру всех сопоставленных точек)
        let centerX = 0, centerY = 0;
        for (const p of pairedPoints) {
            centerX += p.model.x;
            centerY += p.model.y;
        }
        centerX /= pairedPoints.length;
        centerY /= pairedPoints.length;

        // Ближайшая точка к центру
        let centerPoint = null;
        let minCenterDist = Infinity;
        for (const p of pairedPoints) {
            const dist = Math.sqrt(Math.pow(p.model.x - centerX, 2) + Math.pow(p.model.y - centerY, 2));
            if (dist < minCenterDist) {
                minCenterDist = dist;
                centerPoint = p;
            }
        }

        // 3. Находим крайние точки относительно центра
        let topPoint = null, bottomPoint = null, leftPoint = null, rightPoint = null;
        let maxTop = -Infinity, maxBottom = Infinity, maxLeft = Infinity, maxRight = -Infinity;

        for (const p of pairedPoints) {
            const dy = p.model.y - centerPoint.model.y;
            const dx = p.model.x - centerPoint.model.x;

            // Верх (отрицательный Y — вверх)
            if (dy < 0 && dy < maxTop) {
                maxTop = dy;
                topPoint = p;
            }
            // Низ (положительный Y — вниз)
            if (dy > 0 && dy > maxBottom) {
                maxBottom = dy;
                bottomPoint = p;
            }
            // Лево (отрицательный X — влево)
            if (dx < 0 && dx < maxLeft) {
                maxLeft = dx;
                leftPoint = p;
            }
            // Право (положительный X — вправо)
            if (dx > 0 && dx > maxRight) {
                maxRight = dx;
                rightPoint = p;
            }
        }

        // 4. Собираем контрольные точки
        const controlPoints = [
            { name: 'Центр', point: centerPoint },
            { name: 'Верх', point: topPoint },
            { name: 'Низ', point: bottomPoint },
            { name: 'Лево', point: leftPoint },
            { name: 'Право', point: rightPoint }
        ];

        // 5. Вычисляем смещения и выводим таблицу
        const offsets = [];
        console.log('\n🔍 КОНТРОЛЬНЫЕ ТОЧКИ СОПОСТАВЛЕНИЯ:');
        console.log('┌─────────────┬──────────────────────┬──────────────────────┬──────────────────┐');
        console.log('│   Точка     │     В модели (x,y)   │   В фото (x,y)       │  Смещение (dx,dy)│');
        console.log('├─────────────┼──────────────────────┼──────────────────────┼──────────────────┤');

        for (const cp of controlPoints) {
            if (!cp.point) continue;

            const modelX = cp.point.model.x.toFixed(0);
            const modelY = cp.point.model.y.toFixed(0);
           
            // Трансформируем точку фото
            const projected = GeometryUtils.applyTransform(cp.point.photo, transform);
            const photoX = projected.x.toFixed(0);
            const photoY = projected.y.toFixed(0);
           
            const dx = (projected.x - cp.point.model.x).toFixed(1);
            const dy = (projected.y - cp.point.model.y).toFixed(1);
           
            offsets.push({ dx: parseFloat(dx), dy: parseFloat(dy) });

            console.log(`│ ${cp.name.padEnd(11)} │ (${modelX.padStart(5)},${modelY.padStart(5)})      │ (${photoX.padStart(5)},${photoY.padStart(5)})      │ (${dx.padStart(5)},${dy.padStart(5)})     │`);
        }

        console.log('└─────────────┴──────────────────────┴──────────────────────┴──────────────────┘');

        // 6. Статистика
        if (offsets.length > 0) {
            const avgDx = offsets.reduce((sum, o) => sum + Math.abs(o.dx), 0) / offsets.length;
            const avgDy = offsets.reduce((sum, o) => sum + Math.abs(o.dy), 0) / offsets.length;
            const maxOffset = Math.max(...offsets.map(o => Math.sqrt(o.dx*o.dx + o.dy*o.dy)));

            console.log(`📊 СРЕДНЕЕ АБСОЛЮТНОЕ СМЕЩЕНИЕ: |dx|=${avgDx.toFixed(1)}px, |dy|=${avgDy.toFixed(1)}px`);
            console.log(`📊 МАКСИМАЛЬНОЕ СМЕЩЕНИЕ: ${maxOffset.toFixed(1)}px`);
           
            // Дополнительно: проверяем трапециевидное искажение
            if (topPoint && bottomPoint && leftPoint && rightPoint) {
                const topOffset = Math.sqrt(Math.pow(topPoint.model.x - topPoint.photo.x, 2) + Math.pow(topPoint.model.y - topPoint.photo.y, 2));
                const bottomOffset = Math.sqrt(Math.pow(bottomPoint.model.x - bottomPoint.photo.x, 2) + Math.pow(bottomPoint.model.y - bottomPoint.photo.y, 2));
                const leftOffset = Math.sqrt(Math.pow(leftPoint.model.x - leftPoint.photo.x, 2) + Math.pow(leftPoint.model.y - leftPoint.photo.y, 2));
                const rightOffset = Math.sqrt(Math.pow(rightPoint.model.x - rightPoint.photo.x, 2) + Math.pow(rightPoint.model.y - rightPoint.photo.y, 2));
               
                const verticalAsymmetry = Math.abs(topOffset - bottomOffset);
                const horizontalAsymmetry = Math.abs(leftOffset - rightOffset);
               
                if (verticalAsymmetry > 10 || horizontalAsymmetry > 10) {
                    console.log(`⚠️ ОБНАРУЖЕНА АСИММЕТРИЯ: вертикальная ${verticalAsymmetry.toFixed(1)}px, горизонтальная ${horizontalAsymmetry.toFixed(1)}px`);
                }
            }
        }
    }
 
}
module.exports = ModelEnhancer;
