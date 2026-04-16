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
  
  
}
module.exports = ModelEnhancer;
