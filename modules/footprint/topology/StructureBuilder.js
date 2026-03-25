// modules/footprint/topology/StructureBuilder.js
// 🔨 СТРОИТЕЛЬ ТОПОЛОГИЧЕСКИХ СТРУКТУР - собирает связные компоненты от затравки

const TopologicalStructure = require('./Structure');

class StructureBuilder {
    constructor(validator, options = {}) {
        this.validator = validator;
        this.debug = options.debug || false;

        // Базовые пороги (жёсткий режим)
        this.minConfidence = options.minConfidence || 0.7;
        this.maxScaleDeviation = options.maxScaleDeviation || 0.1;
        this.maxRotationDeviation = options.maxRotationDeviation || 5;

        // Дополнительные пороги для мягкого режима
        this.softMinConfidence = options.softMinConfidence || 0.6;
        this.softMaxScaleDeviation = options.softMaxScaleDeviation || 0.15;
        this.softMaxRotationDeviation = options.softMaxRotationDeviation || 10;
        this.maxAllowedBadRays = options.maxAllowedBadRays || 1;
       
        // Допуск для геометрического расширения (этап 2)
        this.geometricAngleTolerance = options.geometricAngleTolerance || 8;

        // Режим мягкости (0 = строгий, 1 = средний, 2 = мягкий)
        this.softnessLevel = options.softnessLevel || 0;

        // Хранилище отвергнутых кандидатов для повторной проверки
        this.rejectedCandidates = new Map();

        // Счётчик повторных попыток
        this.retryCount = 0;
        this.maxRetries = options.maxRetries || 3;

        this.stats = {
            structuresBuilt: 0,
            trianglesProcessed: 0,
            rejections: {
                lowConfidence: 0,
                scaleMismatch: 0,
                rotationMismatch: 0,
                transformFailed: 0,
                rayMismatch: 0,
                angleMismatch: 0
            },
            retries: {
                attempted: 0,
                successful: 0
            }
        };

        if (this.debug) {
            console.log('🔨 StructureBuilder создан');
            console.log(`   • Мин. уверенность: ${this.minConfidence * 100}%`);
            console.log(`   • Макс. отклонение масштаба: ${this.maxScaleDeviation * 100}%`);
            console.log(`   • Макс. отклонение поворота: ${this.maxRotationDeviation}°`);
            console.log(`   • Допуск геометрии: ${this.geometricAngleTolerance}°`);
        }
    }

    increaseSoftness() {
        this.softnessLevel++;

        switch(this.softnessLevel) {
            case 1:
                console.log('🔧 Переход на МЯГКИЙ режим (уровень 1):');
                console.log(`   • Уверенность: ${this.minConfidence} → ${this.softMinConfidence}`);
                console.log(`   • Масштаб: ${this.maxScaleDeviation*100}% → ${this.softMaxScaleDeviation*100}%`);
                console.log(`   • Поворот: ${this.maxRotationDeviation}° → ${this.softMaxRotationDeviation}°`);
                console.log(`   • Плохих лучей: 1 (допустимо)`);

                this.minConfidence = this.softMinConfidence;
                this.maxScaleDeviation = this.softMaxScaleDeviation;
                this.maxRotationDeviation = this.softMaxRotationDeviation;
                break;

            case 2:
                console.log('🔧 Переход на ОЧЕНЬ МЯГКИЙ режим (уровень 2):');
                console.log(`   • Уверенность: ${this.minConfidence} → 0.5`);
                console.log(`   • Масштаб: ${this.maxScaleDeviation*100}% → 20%`);
                console.log(`   • Поворот: ${this.maxRotationDeviation}° → 15°`);
                console.log(`   • Плохих лучей: 2 (допустимо)`);

                this.minConfidence = 0.5;
                this.maxScaleDeviation = 0.2;
                this.maxRotationDeviation = 15;
                this.maxAllowedBadRays = 2;
                break;

            default:
                console.log('⚠️ Максимальный уровень мягкости достигнут');
        }

        return this.softnessLevel;
    }

    getInitialGrowthEdges(triangle) {
        const queue = [];

        if (!triangle || !triangle.edges) return queue;

        for (let i = 0; i < triangle.edges.length; i++) {
            const edge = triangle.edges[i];
            if (edge && edge.v1 && edge.v2) {
                const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');

                queue.push({
                    edgeKey,
                    edge,
                    sourceTriangle: triangle
                });
            }
        }

        return queue;
    }

    getNewBoundaryEdges(triangle, structure, incomingEdgeKey) {
        const newEdges = [];

        if (!triangle || !triangle.edges) return newEdges;

        for (let i = 0; i < triangle.edges.length; i++) {
            const edge = triangle.edges[i];
            if (!edge || !edge.v1 || !edge.v2) continue;

            const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');

            if (edgeKey === incomingEdgeKey) continue;

            if (structure && !structure.boundaryEdges.has(edgeKey)) {
                newEdges.push({
                    edgeKey,
                    edge,
                    sourceTriangle: triangle
                });
            }
        }

        return newEdges;
    }

    findTrianglesByEdge(edgeKey, allTriangles, processed) {
        const [id1, id2] = edgeKey.split('--');
        const candidates = [];

        if (!allTriangles || allTriangles.length === 0) return candidates;

        for (const triangle of allTriangles) {
            if (processed.has(triangle.id)) continue;

            if (triangle.edges) {
                for (let i = 0; i < triangle.edges.length; i++) {
                    const edge = triangle.edges[i];
                    if (edge && edge.v1 && edge.v2) {
                        const triEdgeKey = [edge.v1.id, edge.v2.id].sort().join('--');
                        if (triEdgeKey === edgeKey) {
                            candidates.push(triangle);
                            break;
                        }
                    }
                }
            }
        }

        return candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    }

    collectAnchors(structure, newTriangle) {
        const anchors = [];

        if (structure && structure.getAnchors) {
            anchors.push(...structure.getAnchors());
        }

        if (newTriangle && newTriangle.p1 && newTriangle.pB1) {
            anchors.push({
                pointA: newTriangle.p1.id,
                pointB: newTriangle.pB1.id,
                confidence: newTriangle.confidence || 0.5,
                triangleId: newTriangle.id
            });
        }
        if (newTriangle && newTriangle.p2 && newTriangle.pB2) {
            anchors.push({
                pointA: newTriangle.p2.id,
                pointB: newTriangle.pB2.id,
                confidence: newTriangle.confidence || 0.5,
                triangleId: newTriangle.id
            });
        }
        if (newTriangle && newTriangle.p3 && newTriangle.pB3) {
            anchors.push({
                pointA: newTriangle.p3.id,
                pointB: newTriangle.pB3.id,
                confidence: newTriangle.confidence || 0.5,
                triangleId: newTriangle.id
            });
        }

        return anchors;
    }

    tryAddTriangle(triangle, structure, graphA, graphB, morphologyMap, modelMorphology, isAnchor = false) {
        if (!triangle) return false;

        // Проверка уверенности (только для якорей)
        if (isAnchor && (triangle.confidence || 0) < this.minConfidence) {
            this.stats.rejections.lowConfidence++;
            if (this.debug) {
                console.log(`      ❌ Низкая уверенность: ${(triangle.confidence*100).toFixed(1)}% < ${this.minConfidence*100}%`);
            }
            return false;
        }

        // ==================== ЭТАП 1: СТРОГАЯ ПРОВЕРКА ДЛЯ ЯКОРЕЙ ====================
        if (isAnchor) {
            const newPoints = [];
            const existingPoints = [];

            [triangle.p1, triangle.p2, triangle.p3].forEach(p => {
                if (p && p.id) {
                    if (structure.pointIds.has(p.id)) {
                        existingPoints.push(p);
                    } else {
                        newPoints.push(p);
                    }
                }
            });

            if (newPoints.length > 0 && this.debug) {
                console.log(`      🔍 Новые точки в треугольнике: ${newPoints.map(p => p.id.substring(0,8)).join(', ')}`);
            }

            const isExpansion = structure.pointIds.size > 3;
            const maxAllowedBadRays = isExpansion ? this.maxAllowedBadRays : 0;

            if (this.debug && isExpansion) {
                console.log(`      🔧 ЭТАП 1: Строгая проверка (допускается ${maxAllowedBadRays} плохой луч)`);
            }

            let badRays = 0;

            for (const newPoint of newPoints) {
                const edgesWithNewPoint = triangle.edges.filter(e =>
                    e.v1.id === newPoint.id || e.v2.id === newPoint.id
                );

                for (const edge of edgesWithNewPoint) {
                    const opposite = [triangle.p1, triangle.p2, triangle.p3].find(p =>
                        p.id !== edge.v1.id && p.id !== edge.v2.id
                    );
                    if (!opposite) continue;

                    const externalPoint = edge.externalPoint;
                    if (!externalPoint) continue;

                    if (structure.transform) {
                        const projectedNew = this.validator.applyTransform(newPoint, structure.transform);
                        const projectedExternal = this.validator.applyTransform(externalPoint, structure.transform);

                        const dx = projectedNew.x - projectedExternal.x;
                        const dy = projectedNew.y - projectedExternal.y;
                        const dist = Math.sqrt(dx*dx + dy*dy);

                        const nodeA = graphB?.nodes?.get(newPoint.id);
                        const nodeB = graphB?.nodes?.get(externalPoint.id);
                        const expectedDist = nodeA && nodeB ?
                            Math.sqrt(Math.pow(nodeA.x - nodeB.x, 2) + Math.pow(nodeA.y - nodeB.y, 2)) : 0;

                        const scale = structure.transform.scale;
                        const expectedInModel = expectedDist * scale;
                        const relativeError = expectedInModel > 0 ? Math.abs(dist - expectedInModel) / expectedInModel : 1;

                        if (relativeError > 0.3) {
                            badRays++;
                            if (structure.addFailedRay) {
                                structure.addFailedRay(triangle, edge, externalPoint);
                            }
                            if (this.debug) {
                                console.log(`      ⚠️ Луч из новой точки ${newPoint.id.substring(0,8)} улетает (ошибка ${(relativeError*100).toFixed(1)}%)`);
                            }
                        } else if (externalPoint && structure.addSuccessRay) {
                            structure.addSuccessRay(triangle, edge, externalPoint);
                        }
                    }
                }
            }

            if (badRays > maxAllowedBadRays) {
                if (this.debug) {
                    console.log(`      ❌ Отвергнуто: ${badRays} неудачных лучей (допустимо ${maxAllowedBadRays})`);
                }
                this.stats.rejections.rayMismatch = (this.stats.rejections.rayMismatch || 0) + 1;
               
                // Сохраняем отвергнутого кандидата
                const incomingEdge = this.getIncomingEdge(triangle, structure);
                if (incomingEdge) {
                    const edgeKey = [incomingEdge.v1.id, incomingEdge.v2.id].sort().join('--');
                    if (!this.rejectedCandidates.has(edgeKey)) {
                        this.rejectedCandidates.set(edgeKey, []);
                    }
                    this.rejectedCandidates.get(edgeKey).push({
                        triangle,
                        reason: 'bad_rays',
                        badRays,
                        maxAllowedBadRays,
                        timestamp: Date.now()
                    });
                }
                return false;
            }

            if (this.debug && badRays > 0) {
                console.log(`      ✅ Строгая проверка пройдена: ${badRays} плохих лучей (допустимо ${maxAllowedBadRays})`);
            }

            // Проверка transform для якорей
            if (structure && structure.transform) {
                const existingAnchors = structure.getAnchors ? structure.getAnchors() : [];
                const newAnchors = this.collectAnchors(null, triangle);
                const testAnchors = [...existingAnchors, ...newAnchors];

                if (testAnchors.length >= 3) {
                    const testTransform = this.validator.calculateTransform(testAnchors, graphA, graphB);
                    if (testTransform) {
                        const scaleDiff = Math.abs(testTransform.scale - structure.transform.scale) / Math.max(structure.transform.scale, 0.001);
                        const rotDiff = Math.abs(testTransform.rotation - structure.transform.rotation) * 180 / Math.PI;

                        if (scaleDiff > this.maxScaleDeviation || rotDiff > this.maxRotationDeviation) {
                            if (this.debug) {
                                console.log(`      ❌ Transform не сошёлся (масштаб ${(scaleDiff*100).toFixed(1)}%, поворот ${rotDiff.toFixed(1)}°)`);
                            }
                            return false;
                        }
                        structure.transform = testTransform;
                    }
                }
            }

            if (structure) {
                structure.addTriangle(triangle);
            }
            if (this.debug) console.log(`      ✅ Треугольник добавлен (строгая проверка)`);
            return true;
        }

        // ==================== ЭТАП 2: ГЕОМЕТРИЧЕСКОЕ РАСШИРЕНИЕ ====================
        if (this.debug) {
            console.log(`      🔧 ЭТАП 2: Геометрическое расширение (проверка углов)`);
        }

        const commonEdge = this.findCommonEdge(triangle, structure);
        if (!commonEdge) {
            if (this.debug) console.log(`      ❌ Нет общего ребра со структурой`);
            return false;
        }

        const newPoint = [triangle.p1, triangle.p2, triangle.p3].find(p =>
            p.id !== commonEdge.v1.id && p.id !== commonEdge.v2.id
        );
        if (!newPoint) return false;

        const modelV1 = this.getModelPoint(commonEdge.v1.id, structure);
        const modelV2 = this.getModelPoint(commonEdge.v2.id, structure);

        if (!modelV1 || !modelV2) {
            if (this.debug) console.log(`      ❌ Нет модели для точек ребра`);
            return false;
        }

        let modelNew = this.getModelPoint(newPoint.id, structure);
        let useProjection = false;

        if (!modelNew) {
            if (structure.transform) {
                const projected = this.validator.applyTransform(newPoint, structure.transform);
                modelNew = {
                    id: `projected_${newPoint.id}`,
                    x: projected.x,
                    y: projected.y
                };
                useProjection = true;
            } else {
                if (this.debug) console.log(`      ❌ Нет transform для проекции`);
                return false;
            }
        }

        const anglePhoto = this.calcAngleInPhotoSimple(commonEdge.v1, newPoint, commonEdge.v2);
        const angleModel = this.calcAngleInModelSimple(modelV1, modelNew, modelV2);
        const angleDiff = Math.abs(anglePhoto - angleModel);

        if (this.debug) {
            console.log(`      📐 Угол в фото: ${anglePhoto.toFixed(1)}°, в модели: ${angleModel.toFixed(1)}°, разница: ${angleDiff.toFixed(1)}°`);
            if (useProjection) console.log(`      🔮 Новая точка спроецирована через transform`);
        }

        if (angleDiff > this.geometricAngleTolerance) {
            if (this.debug) {
                console.log(`      ❌ Угол не сошёлся: ${angleDiff.toFixed(1)}° > ${this.geometricAngleTolerance}°`);
            }
            return false;
        }

        if (structure) {
            structure.addTriangle(triangle);
        }

        if (this.debug) {
            console.log(`      ✅ Треугольник добавлен (геометрическое расширение, разница углов: ${angleDiff.toFixed(1)}°)`);
        }

        return true;
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ГЕОМЕТРИЧЕСКОГО РАСШИРЕНИЯ ====================

    findCommonEdge(triangle, structure) {
        for (const edge of triangle.edges) {
            if (structure.pointIds.has(edge.v1.id) && structure.pointIds.has(edge.v2.id)) {
                return edge;
            }
        }
        return null;
    }

    getModelPoint(pointId, structure) {
        const anchors = structure.getAnchors();
        for (const anchor of anchors) {
            if (anchor.pointA === pointId) {
                return anchor.pointB;
            }
        }
        return null;
    }

    findNeighborTriangle(edge, allTriangles, structure) {
        const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');

        for (const triangle of allTriangles) {
            if (structure.triangleIds.has(triangle.id)) continue;

            for (const triEdge of triangle.edges) {
                const triEdgeKey = [triEdge.v1.id, triEdge.v2.id].sort().join('--');
                if (triEdgeKey === edgeKey) {
                    return triangle;
                }
            }
        }
        return null;
    }

    calcAngleInModelSimple(pointA, pointB, pointC) {
        const v1x = pointB.x - pointA.x;
        const v1y = pointB.y - pointA.y;
        const v2x = pointC.x - pointA.x;
        const v2y = pointC.y - pointA.y;

        const dot = v1x * v2x + v1y * v2y;
        const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

        const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        return Math.acos(cos) * 180 / Math.PI;
    }

    calcAngleInPhotoSimple(pointA, pointB, pointC) {
        const v1x = pointB.x - pointA.x;
        const v1y = pointB.y - pointA.y;
        const v2x = pointC.x - pointA.x;
        const v2y = pointC.y - pointA.y;

        const dot = v1x * v2x + v1y * v2y;
        const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

        const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        return Math.acos(cos) * 180 / Math.PI;
    }

    getBoundaryEdges(structure) {
        const edges = [];
        for (const [edgeKey, edgeData] of structure.boundaryEdges) {
            edges.push({
                key: edgeKey,
                v1: edgeData.v1,
                v2: edgeData.v2,
                sourceTriangle: edgeData.sourceTriangle
            });
        }
        return edges;
    }

    getIncomingEdge(triangle, structure) {
        for (const edge of triangle.edges) {
            if (structure.pointIds.has(edge.v1.id) && structure.pointIds.has(edge.v2.id)) {
                return edge;
            }
        }
        return null;
    }

    retryRejectedCandidates(structure, graphA, graphB, morphologyMap, modelMorphology) {
        console.log(`\n   🔍 retryRejectedCandidates вызван, rejectedCandidates.size = ${this.rejectedCandidates.size}`);

        if (this.rejectedCandidates.size === 0) return 0;

        this.retryCount++;
        if (this.debug) {
            console.log(`\n   🔄 ПОВТОРНАЯ ПРОВЕРКА (попытка ${this.retryCount}/${this.maxRetries})`);
            console.log(`   📋 Отвергнутых кандидатов: ${this.rejectedCandidates.size} рёбер`);
        }

        let totalAdded = 0;
        const newRejected = new Map();

        for (const [edgeKey, candidates] of this.rejectedCandidates) {
            const stillRejected = [];

            for (const candidate of candidates) {
                if (structure.triangleIds.has(candidate.triangle.id)) continue;

                const added = this.tryAddTriangle(
                    candidate.triangle,
                    structure,
                    graphA,
                    graphB,
                    morphologyMap,
                    modelMorphology,
                    true  // isAnchor = true для повторной проверки якорей
                );

                if (added) {
                    totalAdded++;
                    this.stats.retries.successful++;
                    if (this.debug) {
                        console.log(`      ✅ Повторно добавлен треугольник ${candidate.triangle.id ? candidate.triangle.id.substring(0,12) : 'unknown'} (ранее отвергнут: ${candidate.reason})`);
                    }
                } else {
                    stillRejected.push(candidate);
                }
            }

            if (stillRejected.length > 0) {
                newRejected.set(edgeKey, stillRejected);
            }
        }

        this.rejectedCandidates = newRejected;
        this.stats.retries.attempted++;

        if (this.debug && totalAdded > 0) {
            console.log(`   📊 Повторно добавлено: ${totalAdded} треугольников`);
        }

        return totalAdded;
    }

    buildFromSeed(seedTriangle, allTriangles, graphA, graphB, morphologyMap, modelMorphology) {
        if (!seedTriangle) {
            if (this.debug) console.log(`⚠️ Нет треугольника-затравки`);
            return null;
        }

        if (!seedTriangle.p1 || !seedTriangle.p2 || !seedTriangle.p3) {
            if (this.debug) console.log(`⚠️ Треугольник-затравка не имеет всех трёх точек`);
            return null;
        }

        if (seedTriangle.p1.id === seedTriangle.p2.id ||
            seedTriangle.p1.id === seedTriangle.p3.id ||
            seedTriangle.p2.id === seedTriangle.p3.id) {
            if (this.debug) {
                console.log(`⚠️ Треугольник-затравка имеет дублирующиеся точки`);
            }
            return null;
        }

        if (this.debug) {
            console.log(`\n🔨 Строю структуру от треугольника ${seedTriangle.id ? seedTriangle.id.substring(0,12) : 'unknown'}...`);
        }

        const structureId = `struct_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const structure = new TopologicalStructure(structureId, seedTriangle);

        // ==================== ЭТАП 1: СТРОГОЕ ПОСТРОЕНИЕ ИЗ ЯКОРЕЙ ====================
        if (this.debug) {
            console.log(`\n📌 ЭТАП 1: Строгое построение из якорей`);
        }

        const processed = new Set([seedTriangle.id]);
        let growthQueue = this.getInitialGrowthEdges(seedTriangle);
        let iteration = 0;
        const maxIterations = 100;

        while (growthQueue.length > 0 && iteration < maxIterations) {
            iteration++;

            const { edgeKey, edge } = growthQueue.shift();
            const candidates = this.findTrianglesByEdge(edgeKey, allTriangles, processed);

            if (candidates.length === 0) continue;

            for (const candidate of candidates) {
                const added = this.tryAddTriangle(
                    candidate, structure, graphA, graphB,
                    morphologyMap, modelMorphology, true
                );

                if (added) {
                    processed.add(candidate.id);
                    const newEdges = this.getNewBoundaryEdges(candidate, structure, edgeKey);
                    growthQueue.push(...newEdges);
                    if (this.debug) {
                        console.log(`      ✅ Добавлен якорный треугольник ${candidate.id ? candidate.id.substring(0,12) : 'unknown'}`);
                    }
                    break;
                }
            }
        }

        if (this.debug) {
            console.log(`\n📊 ЭТАП 1 завершён: ${structure.triangleIds.size} треугольников, ${structure.pointIds.size} точек`);
        }

        // ==================== ЭТАП 2: ГЕОМЕТРИЧЕСКОЕ РАСШИРЕНИЕ ====================
        if (this.debug) {
            console.log(`\n📌 ЭТАП 2: Геометрическое расширение по всем треугольникам графа`);
            console.log(`   • Всего треугольников в графе: ${allTriangles.length}`);
        }

        let expansionQueue = this.getBoundaryEdges(structure);
        let totalAdded = 0;
        let expansionIteration = 0;
        const maxExpansionIterations = 20;

        if (this.debug) {
            console.log(`   • Граничных рёбер структуры: ${expansionQueue.length}`);
        }

        do {
            expansionIteration++;
            let addedThisRound = 0;
            const newQueue = [];

            if (this.debug && expansionIteration > 1) {
                console.log(`\n   🔄 Итерация расширения ${expansionIteration}, граничных рёбер: ${expansionQueue.length}`);
            }

            for (const edge of expansionQueue) {
                const neighbor = this.findNeighborTriangle(edge, allTriangles, structure);

                if (neighbor) {
                    if (this.debug) {
                        console.log(`      🔍 Найден соседний треугольник ${neighbor.id ? neighbor.id.substring(0,12) : 'unknown'} для ребра ${edge.key}`);
                    }
                    const added = this.tryAddTriangle(
                        neighbor, structure, graphA, graphB,
                        morphologyMap, modelMorphology, false
                    );
                    if (this.debug) {
                        console.log(`      ➡️ Результат добавления: ${added}`);
                    }
                    if (added) {
                        addedThisRound++;
                        const newEdges = this.getNewBoundaryEdges(neighbor, structure, edge.key);
                        newQueue.push(...newEdges);
                        if (this.debug) {
                            console.log(`      ✅ Добавлен треугольник при геометрическом расширении`);
                        }
                    } else {
                        newQueue.push(edge);
                    }
                } else {
                    newQueue.push(edge);
                }
            }

            totalAdded += addedThisRound;
            expansionQueue = newQueue;

            if (addedThisRound === 0) break;

            if (structure.triangleIds.size >= 2 && this.validator) {
                const anchors = structure.getAnchors ? structure.getAnchors() : [];
                if (anchors.length >= 3) {
                    const transform = this.validator.calculateTransform(anchors, graphA, graphB);
                    if (transform) {
                        structure.transform = transform;
                    }
                }
            }

        } while (expansionIteration < maxExpansionIterations);

        if (this.debug) {
            console.log(`\n📊 ЭТАП 2 завершён: добавлено ${totalAdded} треугольников`);
        }

        if (structure && structure.triangleIds.size >= 2 && this.validator) {
            const anchors = structure.getAnchors ? structure.getAnchors() : [];
            if (anchors.length >= 3) {
                const transform = this.validator.calculateTransform(anchors, graphA, graphB);
                if (transform) {
                    structure.transform = transform;
                }
            }
        }

        this.stats.structuresBuilt++;
        this.stats.trianglesProcessed += structure.triangleIds.size;

        if (this.debug) {
            const stats = structure.getStats ? structure.getStats() : { triangleCount: structure.triangleIds.size, pointCount: structure.pointIds.size, confidence: 0.5 };
            console.log(`\n📊 Структура построена:`);
            console.log(`   • Треугольников: ${stats.triangleCount}`);
            console.log(`   • Точек: ${stats.pointCount}`);
            console.log(`   • Успешных лучей: ${stats.successRayCount || 0}`);
            console.log(`   • Неудачных лучей: ${stats.failedRayCount || 0}`);
            console.log(`   • Уверенность: ${(stats.confidence * 100).toFixed(1)}%`);
            if (structure.transform) {
                console.log(`   • Масштаб: ${structure.transform.scale.toFixed(3)}`);
                console.log(`   • Поворот: ${(structure.transform.rotation * 180 / Math.PI).toFixed(1)}°`);
            }
            if (totalAdded > 0) {
                console.log(`   • Геометрически расширено: +${totalAdded} треугольников`);
            }
        }

        return structure;
    }

    getStats() {
        const stats = {
            ...this.stats,
            rejections: { ...this.stats.rejections }
        };

        if (this.stats.rejectionDetails) {
            stats.rejectionDetails = { ...this.stats.rejectionDetails };
        }

        return stats;
    }

    printRejectionAnalysis() {
        console.log('\n📊 АНАЛИЗ ОТКАЗОВ ТРЕУГОЛЬНИКОВ:');
        console.log('═'.repeat(50));

        const details = this.stats.rejectionDetails || {};
        const totalRejected = Object.values(details).reduce((a, b) => a + b, 0);

        console.log(`\n🔴 Всего отвергнуто: ${totalRejected}`);
        console.log('\n📋 ПО ПРИЧИНАМ:');

        for (const [reason, count] of Object.entries(details)) {
            const percent = ((count / totalRejected) * 100).toFixed(1);
            console.log(`   • ${reason}: ${count} (${percent}%)`);
        }

        console.log('\n📈 ПОДРОБНОСТИ:');
        console.log(`   • Низкая уверенность: ${this.stats.rejections.lowConfidence || 0}`);
        console.log(`   • Несоответствие масштаба: ${this.stats.rejections.scaleMismatch || 0}`);
        console.log(`   • Несоответствие поворота: ${this.stats.rejections.rotationMismatch || 0}`);
        console.log(`   • Проблемы с лучами: ${this.stats.rejections.rayMismatch || 0}`);
        console.log(`   • Ошибка transform: ${this.stats.rejections.transformFailed || 0}`);
    }

    resetStats() {
        this.stats = {
            structuresBuilt: 0,
            trianglesProcessed: 0,
            rejections: {
                lowConfidence: 0,
                scaleMismatch: 0,
                rotationMismatch: 0,
                transformFailed: 0,
                rayMismatch: 0
            }
        };
    }
}

module.exports = StructureBuilder;
