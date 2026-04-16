// modules/footprint/topology/enhancers/ModelEnhancer.js
// 🚀 УЛУЧШАТЕЛЬ МОДЕЛИ - вынесенная логика сравнения и улучшения существующей модели

const GeometryUtils = require('../utils/GeometryUtils');
const GraphUtils = require('../utils/GraphUtils');
const RoleClassifier = require('../utils/RoleClassifier');
const ValidationModule = require('../../validation/ValidationModule');
const AffineRefiner = require('../AffineRefiner');
const LocalGroupSignature = require('../LocalGroupSignature');
const MorphologyEncoder = require('../MorphologyEncoder');
const StructureManager = require('../structures/StructureManager');
const TriangleMatcher = require('../../matching/TriangleMatcher');

class ModelEnhancer {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.fastMode = options.fastMode || false;
       
        // Пороги и параметры
        this.positionThreshold = options.positionThreshold || 0.15;
        this.morphologyThreshold = options.morphologyThreshold || 0.85;
        this.geometryThreshold = options.geometryThreshold || 0.3;
        this.softThreshold = options.softThreshold || 20; // px для притягивания
        this.maxRefinements = options.maxRefinements || 3;
       
        // Компоненты
        this.validator = options.validator || new ValidationModule({
            debug: this.debug,
            positionThreshold: this.positionThreshold,
            morphologyThreshold: this.morphologyThreshold
        });
       
        this.roleClassifier = options.roleClassifier || new RoleClassifier();
        this.affineRefiner = options.affineRefiner || new AffineRefiner({
            debug: this.debug,
            maxIterations: 3,
            useRansac: true,
            ransacThreshold: 5
        });
       
        this.localGroupSignature = options.localGroupSignature || new LocalGroupSignature({
            debug: this.debug,
            maxDepth: 3,
            useMorphology: true
        });
       
        this.morphologyEncoder = options.morphologyEncoder || new MorphologyEncoder({
            debug: this.debug
        });
       
        // Статистика
        this.stats = {
            enhancements: 0,
            magneticPulls: 0,
            geometricExpansions: 0,
            mergedPoints: 0,
            validatedPoints: 0,
            newPairsFound: 0
        };
       
        if (this.debug) {
            console.log('🚀 ModelEnhancer создан');
            console.log(`   • Порог позиции: ${this.positionThreshold * 100}%`);
            console.log(`   • Порог морфологии: ${this.morphologyThreshold * 100}%`);
            console.log(`   • Мягкий порог: ${this.softThreshold}px`);
            console.log(`   • Быстрый режим: ${this.fastMode ? 'ДА' : 'НЕТ'}`);
        }
    }
   
    // ==================== ГЛАВНЫЙ МЕТОД ====================
   
    /**
     * Улучшает существующую модель новым фото
     * @param {Object} existingModel - существующая модель
     * @param {Object} newExactGraph - граф нового фото (Делоне)
     * @param {Map} newMorphology - морфология нового фото
     * @param {Array} originalPoints - оригинальные точки фото
     * @param {Object} options - дополнительные параметры
     * @returns {Object} - результат улучшения
     */
    async enhance(existingModel, newExactGraph, newMorphology, originalPoints, options = {}) {
        const { photoId, contours, triangleResult: externalTriangleResult, outlineContour } = options;
       
        console.log(`\n🔧 ModelEnhancer: улучшение модели ${existingModel.id?.substring(0,12) || 'unknown'}...`);
       
        // ===== ШАГ 1: Треугольное сравнение =====
        let triangleResult = externalTriangleResult;
        if (!triangleResult) {
            triangleResult = await this._compareByTriangles(existingModel, newExactGraph);
        }
       
        if (!triangleResult || triangleResult.count < 1) {
            console.log(`⚠️ Недостаточно треугольных соответствий (${triangleResult?.count || 0})`);
            return { success: false, reason: 'insufficient_triangles', triangleResult };
        }
       
        console.log(`✅ Найдено ${triangleResult.count} треугольных соответствий!`);
       
        // ===== ШАГ 2: Создание якорей из треугольников =====
        const anchors = this._createAnchorsFromTriangles(triangleResult, newExactGraph, existingModel.graph);
       
        // ===== ШАГ 3: Глобальная проверка согласованности =====
        const trianglesA = this._extractTrianglesFromGraph(newExactGraph);
        const trianglesB = this._extractTrianglesFromGraph(existingModel.graph);
       
        const consistent = this._checkGlobalConsistency(
            anchors, trianglesA, trianglesB,
            newExactGraph, existingModel.graph
        );
       
        // ===== ШАГ 4: Двухэтапная достройка =====
        const finalMatches = this._twoStagePositioning(
            consistent.points,
            triangleResult.matches,
            newExactGraph,
            existingModel.graph,
            newMorphology,
            existingModel.morphologyMap
        );
       
        // ===== ШАГ 5: Валидация через ValidationModule =====
        const validationResult = await this._validateMatches(
            finalMatches,
            newExactGraph,
            existingModel.graph,
            newMorphology,
            existingModel.morphologyMap
        );
       
        if (!validationResult.success) {
            console.log(`⚠️ Финальная валидация не удалась`);
            return { success: false, reason: 'validation_failed', validationResult };
        }
       
        // ===== ШАГ 6: Притягивание близких точек =====
        const { pulledMatches, pulledCount } = this._magneticPull(
            finalMatches,
            newExactGraph,
            existingModel.graph,
            validationResult.transform,
            this.softThreshold
        );
       
        this.stats.magneticPulls += pulledCount;
       
        // ===== ШАГ 7: Поиск новых пар =====
        const newPairs = await this._findNewPairs(
            pulledMatches,
            newExactGraph,
            existingModel.graph,
            validationResult.transform,
            newMorphology,
            existingModel.morphologyMap
        );
       
        this.stats.newPairsFound += newPairs.length;
        const allMatches = [...pulledMatches, ...newPairs];
       
        // ===== ШАГ 8: Итеративное уточнение =====
        const refinedResult = await this._iterativeRefinement(
            allMatches,
            newExactGraph,
            existingModel.graph,
            newMorphology,
            existingModel.morphologyMap,
            validationResult.transform
        );
       
        // ===== ШАГ 9: Построение структур (геометрическое расширение) =====
        if (!this.fastMode && refinedResult.anchors && refinedResult.anchors.length >= 3) {
            const structures = await this._buildAndExpandStructures(
                refinedResult.anchors,
                newExactGraph,
                existingModel.graph,
                newMorphology,
                existingModel.morphologyMap,
                triangleResult
            );
           
            if (structures && structures.length > 0) {
                existingModel.structures = structures;
                existingModel.pointToStructure = this._buildPointToStructureMap(structures);
                this.stats.geometricExpansions += structures.length;
                console.log(`   🏗️ Построено структур: ${structures.length}`);
            }
        }
       
        // ===== ШАГ 10: Обновление модели =====
        const updateResult = this._updateModelWithMatches(
            existingModel,
            newExactGraph,
            refinedResult.matches,
            newMorphology
        );
       
        // ===== ШАГ 11: Слияние дублирующихся точек =====
        const mergedCount = this._mergeDuplicatePoints(existingModel.graph, 5);
        this.stats.mergedPoints += mergedCount;
       
        // ===== ШАГ 12: Сохранение контура =====
        if (outlineContour && !existingModel.metadata.outlineContour) {
            existingModel.metadata.outlineContour = outlineContour;
            console.log(`💾 Контур следа сохранён в существующую модель`);
        }
       
        // ===== ШАГ 13: Обновление метаданных =====
        existingModel.metadata.photoCount = (existingModel.metadata.photoCount || 0) + 1;
        existingModel.metadata.lastEnhanced = new Date();
        existingModel.transform = refinedResult.transform;
       
        this.stats.enhancements++;
        this.stats.validatedPoints += refinedResult.matches.length;
       
        console.log(`\n✅ ModelEnhancer: улучшение завершено`);
        console.log(`   • Подтверждено точек: ${refinedResult.matches.length}`);
        console.log(`   • Добавлено новых: ${updateResult.newNodesAdded}`);
        console.log(`   • Слито дубликатов: ${mergedCount}`);
        console.log(`   • Новых пар найдено: ${newPairs.length}`);
       
        return {
            success: true,
            matches: refinedResult.matches,
            transform: refinedResult.transform,
            anchors: refinedResult.anchors,
            structures: existingModel.structures,
            stats: { ...this.stats },
            newNodesAdded: updateResult.newNodesAdded,
            mergedCount
        };
    }
   
    // ==================== ПРИВАТНЫЕ МЕТОДЫ ====================
   
    /**
     * Создаёт якоря из треугольников
     */
    _createAnchorsFromTriangles(triangleResult, graphA, graphB) {
        const anchors = [];
       
        if (!triangleResult.triangles || triangleResult.triangles.length === 0) {
            return anchors;
        }
       
        for (const tri of triangleResult.triangles) {
            if (tri.pB1 && tri.pB2 && tri.pB3) {
                anchors.push({
                    pointA: tri.p1.id,
                    pointB: tri.pB1.id,
                    confidence: tri.confidence || 0.9,
                    triangleId: tri.id
                });
                anchors.push({
                    pointA: tri.p2.id,
                    pointB: tri.pB2.id,
                    confidence: tri.confidence || 0.9,
                    triangleId: tri.id
                });
                anchors.push({
                    pointA: tri.p3.id,
                    pointB: tri.pB3.id,
                    confidence: tri.confidence || 0.9,
                    triangleId: tri.id
                });
            }
        }
       
        console.log(`   • Создано якорей: ${anchors.length} из ${anchors.length/3} треугольников`);
        return anchors;
    }
   
    /**
     * Сравнение по треугольникам
     */
    async _compareByTriangles(model, graph) {
        const points = this._extractPointsFromModel(model);
        const pointsNew = Array.from(graph.nodes.values()).map(n => ({
            id: n.id,
            x: n.x,
            y: n.y,
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
                id: nodeId,
                x: node.x,
                y: node.y,
                eccentricity: morph.eccentricity || 0,
                asymmetry: morph.asymmetry || 0,
                radialProfile: morph.radialProfile || [0,0,0,0,0,0,0,0]
            });
        }
        return points;
    }
   
    /**
     * Извлечение треугольников из графа
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
                            const triangleEdges = [
                                { v1: p1, v2: p2, externalPoint: null, neighborTriangles: [] },
                                { v1: p2, v2: p3, externalPoint: null, neighborTriangles: [] },
                                { v1: p3, v2: p1, externalPoint: null, neighborTriangles: [] }
                            ];
                           
                            triangles.push({
                                p1, p2, p3,
                                edges: triangleEdges,
                                id: `tri_${a}_${b}_${c}`,
                                confidence: 0.5
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
     * Глобальная проверка согласованности якорей
     */
    _checkGlobalConsistency(anchors, trianglesA, trianglesB, graphA, graphB) {
        if (this.debug) {
            console.log(`\n🔍 ГЛОБАЛЬНАЯ ПРОВЕРКА СОГЛАСОВАННОСТИ`);
            console.log(`   • Всего кандидатов: ${anchors.length} треугольников (${anchors.length * 3} точек)`);
        }
       
        const pointPairs = new Map();
        const reversePairs = new Map();
       
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
                    continue;
                }
               
                const tA = trianglesA[anchor.aIndex];
                const tB = trianglesB[anchor.bIndex];
               
                if (!tA || !tB) continue;
               
                const pointsA = [tA.p1.id, tA.p2.id, tA.p3.id];
                const pointsB = [tB.p1.id, tB.p2.id, tB.p3.id];
               
                for (let i = 0; i < 3; i++) {
                    const pA = pointsA[i];
                    const pB = pointsB[i];
                   
                    if (pointPairs.has(pA)) {
                        if (pointPairs.get(pA).pointB !== pB) continue;
                        continue;
                    }
                   
                    if (reversePairs.has(pB)) continue;
                   
                    pointPairs.set(pA, {
                        pointB: pB,
                        confidence: anchor.geometryScore
                    });
                    reversePairs.set(pB, pA);
                }
            }
        }
       
        // Топологическая проверка
        const consistentPoints = new Set();
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
            }
        }
       
        // Фильтрация по уверенности
        const confidences = Array.from(pointPairs.values()).map(p => p.confidence);
        confidences.sort((a, b) => b - a);
       
        let threshold = 0.90;
        for (let i = 1; i < confidences.length; i++) {
            if (confidences[i-1] - confidences[i] > 0.05) {
                threshold = confidences[i-1] - 0.01;
                break;
            }
        }
       
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
            console.log(`\n📊 ИТОГ ГЛОБАЛЬНОЙ ПРОВЕРКИ:`);
            console.log(`   • Согласованных точек: ${finalPoints.length}`);
        }
       
        return {
            anchors: [],
            points: finalPoints,
            stats: {
                original: anchors.length,
                finalPoints: finalPoints.length
            }
        };
    }
   
    /**
     * Двухэтапная достройка точек
     */
    _twoStagePositioning(anchors, allMatches, graphA, graphB, morphologyMap, modelMorphology) {
        if (this.debug) console.log(`\n🔧 ДВУХЭТАПНАЯ ДОСТРОЙКА ТОЧЕК`);
       
        const anchorSet = new Set(anchors.map(a => a.pointA));
       
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
       
        const anchorMap = new Map();
        for (const anchor of anchors) {
            anchorMap.set(anchor.pointA, {
                pointB: anchor.pointB,
                confidence: anchor.confidence
            });
        }
       
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
                const distA = GraphUtils.graphDistance(pointA, nA.id, graphA);
                const distB = GraphUtils.graphDistance(pointB, anchorNeighborsB[i].id, graphB);
               
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
       
        const allConfirmed = [...anchors, ...confirmedFromConfused];
        const confirmedMap = new Map();
        for (const point of allConfirmed) {
            confirmedMap.set(point.pointA, point.pointB);
        }
       
        const anchorMatches = new Map();
        for (const point of allConfirmed) {
            anchorMatches.set(point.pointA, {
                modelId: point.pointB,
                confidence: point.confidence
            });
        }
       
        // Простая достройка через геометрию
        const additionalMatches = [];
        const allPointsInA = Array.from(graphA.nodes.keys());
        const pointsToPosition = allPointsInA.filter(p => !confirmedMap.has(p));
       
        if (this.debug) console.log(`   • Точек для достройки: ${pointsToPosition.length}`);
       
        // Вычисляем transform по якорям
        const transform = this.validator.calculateTransform(
            allConfirmed.map(a => ({ pointA: a.pointA, pointB: a.pointB, confidence: a.confidence })),
            graphA, graphB
        );
       
        if (transform) {
            const footprintSize = GeometryUtils.getFootprintSize(Array.from(graphB.nodes.values()));
            const searchRadius = footprintSize * this.positionThreshold;
           
            for (const pointId of pointsToPosition) {
                const pointA = graphA.nodes.get(pointId);
                if (!pointA) continue;
               
                const projected = GeometryUtils.applyTransform(pointA, transform);
               
                let bestMatch = null;
                let bestDist = Infinity;
               
                for (const [modelId, modelPoint] of graphB.nodes) {
                    if (confirmedMap.has(modelId)) continue;
                   
                    const dist = GeometryUtils.distance(projected, modelPoint);
                    if (dist < bestDist && dist < searchRadius) {
                        bestDist = dist;
                        bestMatch = modelId;
                    }
                }
               
                if (bestMatch) {
                    additionalMatches.push({
                        pointA: pointId,
                        pointB: bestMatch,
                        confidence: 1 - (bestDist / searchRadius),
                        source: 'geometric'
                    });
                }
            }
        }
       
        const finalMatches = [
            ...allConfirmed.map(p => ({ pointA: p.pointA, pointB: p.pointB, confidence: p.confidence })),
            ...additionalMatches
        ];
       
        if (this.debug) {
            console.log(`\n🎯 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ:`);
            console.log(`   • Всего соответствий: ${finalMatches.length} точек`);
            console.log(`   • Достроено новых: ${additionalMatches.length}`);
        }
       
        return finalMatches;
    }
   
    /**
     * Валидация через ValidationModule
     */
    async _validateMatches(matches, graphA, graphB, morphologyMap, modelMorphology) {
        const anchors = matches.map(m => ({
            pointA: m.pointA,
            pointB: m.pointB,
            confidence: m.confidence || 0.8
        }));
       
        if (anchors.length < 3) {
            return { success: false, reason: 'insufficient_anchors' };
        }
       
        const result = this.validator.validateAll(
            graphA, graphB, anchors,
            morphologyMap, modelMorphology
        );
       
        return {
            success: result.success,
            transform: result.transform,
            results: result.results
        };
    }
   
    /**
     * Притягивание близких точек с топологической проверкой
     */
    _magneticPull(matches, photoGraph, modelGraph, transform, threshold = 10) {
        if (this.debug) console.log(`\n🧲 ЗАПУСК ФИНАЛЬНОГО ПРИТЯГИВАНИЯ БЛИЗКИХ ТОЧЕК`);
       
        const pulledMatches = [];
        const usedPhotoPoints = new Set();
        const usedModelPoints = new Set();
        let pulledCount = 0;
        let topologyCheckedCount = 0;
        let topologyRejectedCount = 0;
       
        const sortedMatches = [...matches].sort((a, b) => b.confidence - a.confidence);
       
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
           
            const projected = GeometryUtils.applyTransform(photoPoint, transform);
            const dx = projected.x - modelPoint.x;
            const dy = projected.y - modelPoint.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
           
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
                    newPosition: { x: avgX, y: avgY }
                });
               
                usedPhotoPoints.add(match.pointA);
                usedModelPoints.add(match.pointB);
                pulledCount++;
                continue;
            }
           
            if (dist >= threshold) {
                const photoNeighbors = GraphUtils.findNodeNeighbors(match.pointA, photoGraph);
                const matchedNeighbors = photoNeighbors.filter(n => matchedPhotoMap.has(n.id));
               
                if (matchedNeighbors.length < 2) {
                    if (this.debug && dist > threshold * 2) {
                        console.log(`   ⚠️ Точки далеко (${dist.toFixed(1)}px): ${match.pointA.substring(0,12)} - мало соседей`);
                    }
                    pulledMatches.push(match);
                    usedPhotoPoints.add(match.pointA);
                    usedModelPoints.add(match.pointB);
                    continue;
                }
               
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
               
                candidates.sort((a, b) => a.dist - b.dist);
               
                let bestCandidate = null;
                let bestTopologyScore = 0;
               
                for (const candidate of candidates) {
                    const modelNeighbors = GraphUtils.findNodeNeighbors(candidate.id, modelGraph);
                    const matchedModelNeighbors = modelNeighbors.filter(n => matchedModelMap.has(n.id));
                   
                    if (matchedModelNeighbors.length !== matchedNeighbors.length) continue;
                   
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
                        console.log(`   🧲 Топологический магнит: ${match.pointA.substring(0,12)} → ${bestCandidate.id.substring(0,12)} (${bestCandidate.dist.toFixed(1)}px)`);
                    }
                   
                    const weight = match.confidence || 0.5;
                    const avgX = (projected.x * weight + bestCandidate.point.x * (1 - weight));
                    const avgY = (projected.y * weight + bestCandidate.point.y * (1 - weight));
                   
                    bestCandidate.point.x = avgX;
                    bestCandidate.point.y = avgY;
                    bestCandidate.point.confirmationCount = (bestCandidate.point.confirmationCount || 1) + 1;
                    bestCandidate.point.pulled = true;
                   
                    pulledMatches.push({
                        pointA: match.pointA,
                        pointB: bestCandidate.id,
                        confidence: match.confidence,
                        pulled: true,
                        pullDistance: bestCandidate.dist,
                        topologyChecked: true,
                        topologyScore: bestTopologyScore
                    });
                   
                    usedPhotoPoints.add(match.pointA);
                    usedModelPoints.add(bestCandidate.id);
                    pulledCount++;
                } else {
                    topologyRejectedCount++;
                    pulledMatches.push(match);
                    usedPhotoPoints.add(match.pointA);
                    usedModelPoints.add(match.pointB);
                }
            } else {
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
        }
       
        return { pulledMatches, pulledCount };
    }
   
    /**
     * Поиск новых пар среди несопоставленных точек
     */
    async _findNewPairs(matches, graphA, graphB, transform, morphologyMap, modelMorphology) {
        if (this.debug) console.log(`\n🔍 ПОИСК НОВЫХ ПАР СРЕДИ НЕСОПОСТАВЛЕННЫХ ТОЧЕК`);
       
        const matchedPointsA = new Set(matches.map(m => m.pointA));
        const matchedPointsB = new Set(matches.map(m => m.pointB));
       
        const unmatchedModelPoints = new Map();
        for (const [id, node] of graphB.nodes) {
            if (!matchedPointsB.has(id)) {
                unmatchedModelPoints.set(id, node);
            }
        }
       
        const unmatchedPhotoPoints = Array.from(graphA.nodes.values())
            .filter(p => !matchedPointsA.has(p.id));
       
        if (this.debug) {
            console.log(`   • Несопоставленных точек модели: ${unmatchedModelPoints.size}`);
            console.log(`   • Несопоставленных точек фото: ${unmatchedPhotoPoints.length}`);
        }
       
        const newPairs = [];
       
        for (const photoPoint of unmatchedPhotoPoints) {
            const projected = GeometryUtils.applyTransform(photoPoint, transform);
           
            let bestMatch = null;
            let bestDist = Infinity;
           
            for (const [modelId, modelPoint] of unmatchedModelPoints) {
                const dx = projected.x - modelPoint.x;
                const dy = projected.y - modelPoint.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
               
                if (dist < bestDist && dist < 20) {
                    bestDist = dist;
                    bestMatch = { modelId, modelPoint };
                }
            }
           
            if (bestMatch) {
                const photoMorph = morphologyMap.get(photoPoint.id);
                const modelMorph = modelMorphology.get(bestMatch.modelId);
               
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
                    }
                }
            }
        }
       
        if (this.debug && newPairs.length > 0) {
            console.log(`   ✅ Найдено ${newPairs.length} новых пар!`);
        }
       
        return newPairs;
    }
   
    /**
     * Итеративное уточнение трансформации
     */
    async _iterativeRefinement(matches, graphA, graphB, morphologyMap, modelMorphology, initialTransform) {
        if (this.debug) console.log(`\n🔄 ИТЕРАТИВНОЕ УТОЧНЕНИЕ TRANSFORM`);
       
        let currentMatches = [...matches];
        let currentTransform = { ...initialTransform };
        let refinementIteration = 0;
       
        while (refinementIteration < this.maxRefinements) {
            refinementIteration++;
           
            const allAnchors = [];
            for (const match of currentMatches) {
                const photoPoint = graphA.nodes.get(match.pointA);
                const modelPoint = graphB.nodes.get(match.pointB);
                if (photoPoint && modelPoint) {
                    allAnchors.push({
                        pointA: match.pointA,
                        pointB: match.pointB,
                        confidence: match.confidence || 0.5
                    });
                }
            }
           
            if (allAnchors.length < 3) break;
           
            const newTransform = this.validator.calculateTransform(allAnchors, graphA, graphB);
            if (!newTransform) break;
           
            const scaleDiff = Math.abs(newTransform.scale - currentTransform.scale) / currentTransform.scale;
            const rotDiff = Math.abs(newTransform.rotation - currentTransform.rotation) * 180 / Math.PI;
           
            if (scaleDiff < 0.01 && rotDiff < 0.5) {
                if (this.debug) console.log(`   ✅ Transform стабилизировался (итерация ${refinementIteration})`);
                break;
            }
           
            currentTransform = newTransform;
           
            if (this.debug) {
                console.log(`   🔄 Итерация ${refinementIteration}: масштаб ${currentTransform.scale.toFixed(3)}, поворот ${(currentTransform.rotation * 180 / Math.PI).toFixed(1)}°`);
            }
        }
       
        return {
            matches: currentMatches,
            transform: currentTransform,
            anchors: currentMatches.map(m => ({ pointA: m.pointA, pointB: m.pointB, confidence: m.confidence }))
        };
    }
   
    /**
     * Построение и расширение структур
     */
    async _buildAndExpandStructures(anchors, graphA, graphB, morphologyMap, modelMorphology, triangleResult) {
        if (this.debug) console.log(`\n🏗️ ПОСТРОЕНИЕ СТРУКТУР ИЗ ${anchors.length} ЯКОРЕЙ`);
       
        const structureManager = new StructureManager(this.validator, {
            debug: this.debug,
            minConfidence: 0.7,
            maxScaleDeviation: 0.1,
            maxRotationDeviation: 5
        });
       
        const allTriangles = this._extractTrianglesFromGraph(graphA);
       
        if (this.debug) {
            console.log(`   • Всего треугольников в графе: ${allTriangles.length}`);
        }
       
        // Группируем якоря по triangleId
        const anchorsByTriangle = new Map();
        for (const anchor of anchors) {
            const triId = anchor.triangleId;
            if (!triId) continue;
           
            if (!anchorsByTriangle.has(triId)) {
                anchorsByTriangle.set(triId, []);
            }
            anchorsByTriangle.get(triId).push(anchor);
        }
       
        const anchorTriangles = [];
        for (const [triId, triAnchors] of anchorsByTriangle) {
            if (triAnchors.length !== 3) continue;
           
            const originalTriangle = triangleResult?.triangles?.find(t => t.id === triId);
           
            const a1 = triAnchors[0];
            const a2 = triAnchors[1];
            const a3 = triAnchors[2];
           
            const p1 = graphA.nodes.get(a1.pointA);
            const p2 = graphA.nodes.get(a2.pointA);
            const p3 = graphA.nodes.get(a3.pointA);
           
            const pB1 = graphB.nodes.get(a1.pointB);
            const pB2 = graphB.nodes.get(a2.pointB);
            const pB3 = graphB.nodes.get(a3.pointB);
           
            if (!p1 || !p2 || !p3 || !pB1 || !pB2 || !pB3) continue;
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
                edges.push({ v1: p1, v2: p2, neighborTriangles: [], externalPoint: null });
                edges.push({ v1: p2, v2: p3, neighborTriangles: [], externalPoint: null });
                edges.push({ v1: p3, v2: p1, neighborTriangles: [], externalPoint: null });
            }
           
            anchorTriangles.push({
                id: triId,
                p1, p2, p3,
                pB1, pB2, pB3,
                confidence: (a1.confidence + a2.confidence + a3.confidence) / 3,
                edges
            });
        }
       
        if (this.debug) {
            console.log(`   • Создано якорных треугольников: ${anchorTriangles.length}`);
        }
       
        if (anchorTriangles.length === 0) return [];
       
        const structures = structureManager.buildStructures(
            anchors,
            anchorTriangles,
            graphA,
            graphB,
            morphologyMap,
            modelMorphology
        );
       
        if (this.debug && structures.length > 0) {
            console.log(`   ✅ Построено структур: ${structures.length}`);
        }
       
        return structures;
    }
   
    /**
     * Построение карты pointToStructure
     */
    _buildPointToStructureMap(structures) {
        const map = new Map();
        for (const structure of structures) {
            if (structure.pointIds) {
                for (const pointId of structure.pointIds) {
                    map.set(pointId, structure.id);
                }
            }
        }
        return map;
    }
   
    /**
     * Обновление модели новыми соответствиями
     */
    _updateModelWithMatches(model, newGraph, matches, newMorphology) {
        let confirmedExisting = 0;
        let newNodesAdded = 0;
       
        const matchedPhotoIds = new Set();
        const matchedModelIds = new Set();
       
        // Обновляем существующие точки
        for (const match of matches) {
            const modelNode = model.graph.nodes.get(match.pointB);
            if (modelNode) {
                modelNode.confirmationCount = (modelNode.confirmationCount || 1) + 1;
                modelNode.lastConfirmed = new Date();
                confirmedExisting++;
                matchedPhotoIds.add(match.pointA);
                matchedModelIds.add(match.pointB);
            }
        }
       
        // Добавляем новые точки (если есть lastUniqueInPhoto)
        if (this.lastUniqueInPhoto && this.lastUniqueInPhoto.length > 0) {
            if (this.debug) console.log(`\n📸 Добавляю ${this.lastUniqueInPhoto.length} новых точек из фото в модель`);
           
            for (const photoPoint of this.lastUniqueInPhoto) {
                let isDuplicate = false;
                for (const [modelId, modelNode] of model.graph.nodes) {
                    const dx = modelNode.x - photoPoint.x;
                    const dy = modelNode.y - photoPoint.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
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
                        morphology: newMorphology?.get(photoPoint.id),
                        confirmationCount: 1,
                        addedFrom: 'new_photo_point',
                        addedAt: new Date(),
                        originalPhotoId: photoPoint.id
                    });
                   
                    newNodesAdded++;
                    if (this.debug) console.log(`      ✅ Добавлена новая точка (${photoPoint.x.toFixed(1)}, ${photoPoint.y.toFixed(1)})`);
                }
            }
        }
       
        if (this.debug) {
            console.log(`\n📊 Результат обновления модели:`);
            console.log(`   • Подтверждено существующих: ${confirmedExisting}`);
            console.log(`   • Новых точек добавлено: ${newNodesAdded}`);
            console.log(`   • Всего узлов в модели: ${model.graph.nodes.size}`);
        }
       
        return { confirmedExisting, newNodesAdded };
    }
   
    /**
     * Слияние дублирующихся точек в графе
     */
    _mergeDuplicatePoints(graph, threshold = 5) {
        const points = Array.from(graph.nodes.values());
        const merged = new Set();
        let mergedCount = 0;
        const edgesToUpdate = new Map();
       
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
                   
                    if (this.debug) {
                        console.log(`   🔄 Слияние: ${points[i].id.substring(0,12)} + ${points[j].id.substring(0,12)} → ${points[i].id.substring(0,12)} (расст ${dist.toFixed(1)}px)`);
                    }
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
     * Установка lastUniqueInPhoto для последующего добавления
     */
    setLastUniqueInPhoto(uniquePoints) {
        this.lastUniqueInPhoto = uniquePoints;
    }
   
    /**
     * Получение статистики
     */
    getStats() {
        return { ...this.stats };
    }
   
    /**
     * Сброс статистики
     */
    resetStats() {
        this.stats = {
            enhancements: 0,
            magneticPulls: 0,
            geometricExpansions: 0,
            mergedPoints: 0,
            validatedPoints: 0,
            newPairsFound: 0
        };
    }
}

module.exports = ModelEnhancer;
