// modules/footprint/topology-validator.js
// ВАЛИДАТОР ТОПОЛОГИЧЕСКИХ ИНВАРИАНТОВ - ПРОВЕРКА СОХРАНЕНИЯ СТРУКТУРЫ

class TopologyValidator {
    constructor(options = {}) {
        this.config = {
            distanceTolerance: options.distanceTolerance || 0.15,     // 15% допустимое отклонение расстояний
            angleTolerance: options.angleTolerance || 0.2,            // 0.2 радиан (~11.5°)
            scaleUniformityThreshold: options.scaleUniformityThreshold || 0.1, // 10% отклонение масштаба
            connectivityThreshold: options.connectivityThreshold || 0.8, // 80% связей должны сохраниться
            minEdgeLength: options.minEdgeLength || 5,               // Минимальная длина ребра (пиксели)
            maxEdgeLength: options.maxEdgeLength || 300,             // Максимальная длина ребра
            debug: options.debug || false,
            ...options
        };
       
        this.validationResults = new Map();
        this.invariantHistory = [];
       
        console.log('🔍 Создан TopologyValidator: проверка топологических инвариантов');
    }

    // 1. ОСНОВНОЙ МЕТОД: ПРОВЕРИТЬ ТОПОЛОГИЧЕСКИЕ ИНВАРИАНТЫ ПРИ ТРАНСФОРМАЦИИ
    validateTransformation(originalPoints, transformedPoints, graph, transformation = null) {
        console.log('🔍 Проверяю сохранение топологических инвариантов...');
       
        if (!graph || graph.nodes.size < 3) {
            return this.createValidationResult('insufficient_graph', false, 'Граф слишком мал для проверки');
        }
       
        const nodeIds = Array.from(graph.nodes.keys());
       
        // Сбор всех проверок
        const validations = [];
       
        // 1.1 ПРОВЕРКА СОХРАНЕНИЯ ОТНОШЕНИЙ РАССТОЯНИЙ
        const distanceValidation = this.validateDistanceRelations(
            originalPoints, transformedPoints, graph, nodeIds, transformation
        );
        validations.push(distanceValidation);
       
        // 1.2 ПРОВЕРКА СОХРАНЕНИЯ УГЛОВ
        const angleValidation = this.validateAnglePreservation(
            originalPoints, transformedPoints, graph, nodeIds
        );
        validations.push(angleValidation);
       
        // 1.3 ПРОВЕРКА СОХРАНЕНИЯ СВЯЗАННОСТИ
        const connectivityValidation = this.validateConnectivity(
            originalPoints, transformedPoints, graph, nodeIds
        );
        validations.push(connectivityValidation);
       
        // 1.4 ПРОВЕРКА РАВНОМЕРНОСТИ МАСШТАБИРОВАНИЯ
        const scaleUniformityValidation = this.validateScaleUniformity(
            originalPoints, transformedPoints, graph, nodeIds, transformation
        );
        validations.push(scaleUniformityValidation);
       
        // 1.5 ПРОВЕРКА СОХРАНЕНИЯ ЛОКАЛЬНОЙ СТРУКТУРЫ
        const localStructureValidation = this.validateLocalStructure(
            originalPoints, transformedPoints, graph, nodeIds
        );
        validations.push(localStructureValidation);
       
        // 1.6 ОБЩАЯ ОЦЕНКА
        const overallResult = this.calculateOverallValidation(validations);
       
        // Сохранить результаты
        const resultId = `validation_${Date.now()}`;
        const fullResult = {
            id: resultId,
            timestamp: new Date(),
            transformation: transformation,
            validations: validations,
            overall: overallResult,
            graphStats: {
                nodes: graph.nodes.size,
                edges: graph.edges.size,
                avgDegree: this.calculateAverageDegree(graph)
            }
        };
       
        this.validationResults.set(resultId, fullResult);
        this.invariantHistory.push(fullResult);
       
        // Вывод результатов
        this.printValidationResults(fullResult);
       
        return fullResult;
    }

    // 2. ПРОВЕРКА СОХРАНЕНИЯ ОТНОШЕНИЙ РАССТОЯНИЙ (САМЫЙ ВАЖНЫЙ ИНВАРИАНТ!)
    validateDistanceRelations(originalPoints, transformedPoints, graph, nodeIds, transformation) {
        console.log('   📏 Проверяю сохранение отношений расстояний...');
       
        const edgeRatios = [];
        const edgeErrors = [];
        const wellPreservedEdges = [];
       
        // Собрать все рёбра графа
        for (const [edgeId, edge] of graph.edges) {
            const fromIdx = this.findNodeIndex(edge.from, nodeIds);
            const toIdx = this.findNodeIndex(edge.to, nodeIds);
           
            if (fromIdx === -1 || toIdx === -1) continue;
           
            // Оригинальное расстояние
            const origDist = this.calculateDistance(
                originalPoints[fromIdx],
                originalPoints[toIdx]
            );
           
            // Трансформированное расстояние
            const transDist = this.calculateDistance(
                transformedPoints[fromIdx],
                transformedPoints[toIdx]
            );
           
            if (origDist < this.config.minEdgeLength || origDist > this.config.maxEdgeLength) {
                continue; // Пропустить слишком короткие/длинные рёбра
            }
           
            // Отношение расстояний (должно быть одинаковым для ВСЕХ рёбер!)
            const ratio = origDist > 0 ? transDist / origDist : 1;
            edgeRatios.push(ratio);
           
            // Абсолютная ошибка
            const error = Math.abs(transDist - origDist) / Math.max(origDist, 1);
            edgeErrors.push(error);
           
            // Проверить сохранение в пределах допуска
            if (error <= this.config.distanceTolerance) {
                wellPreservedEdges.push({
                    edgeId,
                    fromIdx,
                    toIdx,
                    origDist,
                    transDist,
                    ratio,
                    error,
                    preserved: true
                });
            }
        }
       
        if (edgeRatios.length === 0) {
            return this.createValidationResult('distance_relations', false, 'Нет валидных рёбер для проверки');
        }
       
        // 2.1 ВЫЧИСЛИТЬ ОДНОРОДНОСТЬ МАСШТАБИРОВАНИЯ
        // Ключевой инвариант: ВСЕ рёбра должны масштабироваться ОДИНАКОВО!
        const ratioStats = this.calculateStatistics(edgeRatios);
        const errorStats = this.calculateStatistics(edgeErrors);
       
        const scaleUniformity = 1 - Math.min(1, ratioStats.stdDev / ratioStats.mean / 0.3);
        const distancePreservation = 1 - Math.min(1, errorStats.mean / this.config.distanceTolerance);
       
        const passed = scaleUniformity > 0.7 && distancePreservation > 0.7;
       
        return {
            name: 'distance_relations',
            description: 'Отношения расстояний между связанными точками',
            passed: passed,
            score: (scaleUniformity * 0.6 + distancePreservation * 0.4),
            metrics: {
                scaleUniformity: scaleUniformity,
                distancePreservation: distancePreservation,
                meanRatio: ratioStats.mean,
                ratioStdDev: ratioStats.stdDev,
                meanError: errorStats.mean,
                errorStdDev: errorStats.stdDev,
                wellPreservedEdges: wellPreservedEdges.length,
                totalEdges: edgeRatios.length,
                preservationRate: wellPreservedEdges.length / edgeRatios.length
            },
            details: {
                edgeRatios: edgeRatios.slice(0, 10), // Первые 10 для отладки
                transformationScale: transformation?.scale || 'N/A',
                expectedUniformScaling: transformation?.type === 'rigid' || transformation?.type === 'similarity'
            }
        };
    }

    // 3. ПРОВЕРКА СОХРАНЕНИЯ УГЛОВ
    validateAnglePreservation(originalPoints, transformedPoints, graph, nodeIds) {
        console.log('   📐 Проверяю сохранение углов между рёбрами...');
       
        const angleChanges = [];
        const wellPreservedAngles = [];
       
        // Для каждого узла с хотя бы двумя соседями
        for (const [nodeId, node] of graph.nodes) {
            const nodeIdx = this.findNodeIndex(nodeId, nodeIds);
            if (nodeIdx === -1) continue;
           
            const neighbors = this.getNodeNeighbors(nodeId, graph);
            if (neighbors.length < 2) continue;
           
            // Преобразовать ID соседей в индексы
            const neighborIndices = neighbors.map(nid => this.findNodeIndex(nid, nodeIds))
                                             .filter(idx => idx !== -1);
           
            if (neighborIndices.length < 2) continue;
           
            // Для каждой пары соседей вычислить изменение угла
            for (let i = 0; i < neighborIndices.length - 1; i++) {
                for (let j = i + 1; j < neighborIndices.length; j++) {
                    const angleBefore = this.calculateAngle(
                        originalPoints[nodeIdx],
                        originalPoints[neighborIndices[i]],
                        originalPoints[nodeIdx],
                        originalPoints[neighborIndices[j]]
                    );
                   
                    const angleAfter = this.calculateAngle(
                        transformedPoints[nodeIdx],
                        transformedPoints[neighborIndices[i]],
                        transformedPoints[nodeIdx],
                        transformedPoints[neighborIndices[j]]
                    );
                   
                    const angleChange = Math.abs(angleAfter - angleBefore);
                    angleChanges.push(angleChange);
                   
                    if (angleChange <= this.config.angleTolerance) {
                        wellPreservedAngles.push({
                            nodeIdx,
                            neighbors: [neighborIndices[i], neighborIndices[j]],
                            angleBefore,
                            angleAfter,
                            change: angleChange,
                            preserved: true
                        });
                    }
                }
            }
        }
       
        if (angleChanges.length === 0) {
            return this.createValidationResult('angle_preservation', true, 'Нет углов для проверки (слишком мало связей)');
        }
       
        const stats = this.calculateStatistics(angleChanges);
        const preservationRate = wellPreservedAngles.length / angleChanges.length;
        const anglePreservationScore = 1 - Math.min(1, stats.mean / this.config.angleTolerance);
       
        const passed = anglePreservationScore > 0.7 && preservationRate > 0.7;
       
        return {
            name: 'angle_preservation',
            description: 'Сохранение углов между рёбрами, исходящими из одной точки',
            passed: passed,
            score: anglePreservationScore * 0.7 + preservationRate * 0.3,
            metrics: {
                meanAngleChange: stats.mean,
                maxAngleChange: stats.max,
                angleChangeStdDev: stats.stdDev,
                wellPreservedAngles: wellPreservedAngles.length,
                totalAngles: angleChanges.length,
                preservationRate: preservationRate,
                anglePreservationScore: anglePreservationScore
            },
            details: {
                criticalAngleChanges: angleChanges.filter(ac => ac > this.config.angleTolerance * 2).length,
                toleranceRadians: this.config.angleTolerance,
                toleranceDegrees: (this.config.angleTolerance * 180 / Math.PI).toFixed(1)
            }
        };
    }

    // 4. ПРОВЕРКА СОХРАНЕНИЯ СВЯЗАННОСТИ
    validateConnectivity(originalPoints, transformedPoints, graph, nodeIds) {
        console.log('   🔗 Проверяю сохранение структуры связей...');
       
        let preservedConnections = 0;
        let totalConnections = 0;
        const brokenConnections = [];
       
        // Проверить каждое ребро графа
        for (const [edgeId, edge] of graph.edges) {
            totalConnections++;
           
            const fromIdx = this.findNodeIndex(edge.from, nodeIds);
            const toIdx = this.findNodeIndex(edge.to, nodeIds);
           
            if (fromIdx === -1 || toIdx === -1) continue;
           
            // Оригинальное расстояние
            const origDist = this.calculateDistance(
                originalPoints[fromIdx],
                originalPoints[toIdx]
            );
           
            // Трансформированное расстояние
            const transDist = this.calculateDistance(
                transformedPoints[fromIdx],
                transformedPoints[toIdx]
            );
           
            // Проверить, не стала ли связь "разорванной" (слишком длинной)
            const isBroken = transDist > origDist * 3 || transDist > 200;
           
            if (!isBroken) {
                preservedConnections++;
            } else {
                brokenConnections.push({
                    edgeId,
                    fromIdx,
                    toIdx,
                    origDist,
                    transDist,
                    stretchFactor: transDist / origDist
                });
            }
        }
       
        if (totalConnections === 0) {
            return this.createValidationResult('connectivity', false, 'Нет связей в графе');
        }
       
        const connectivityScore = preservedConnections / totalConnections;
        const passed = connectivityScore >= this.config.connectivityThreshold;
       
        return {
            name: 'connectivity',
            description: 'Сохранение связей между точками (не разрыв рёбер)',
            passed: passed,
            score: connectivityScore,
            metrics: {
                preservedConnections,
                totalConnections,
                connectivityScore,
                brokenConnections: brokenConnections.length,
                brokenConnectionsPercent: (brokenConnections.length / totalConnections * 100).toFixed(1)
            },
            details: {
                threshold: this.config.connectivityThreshold,
                brokenEdges: brokenConnections.slice(0, 5) // Первые 5 для отладки
            }
        };
    }

    // 5. ПРОВЕРКА РАВНОМЕРНОСТИ МАСШТАБИРОВАНИЯ
    validateScaleUniformity(originalPoints, transformedPoints, graph, nodeIds, transformation) {
        console.log('   ⚖️ Проверяю равномерность масштабирования...');
       
        // Эта проверка особенно важна для аффинных/проективных трансформаций
        // При жёсткой трансформации масштаб должен быть одинаковым во всех направлениях
       
        const scaleRatiosX = [];
        const scaleRatiosY = [];
        const anisotropicEdges = [];
       
        // Проверить масштабирование по осям X и Y отдельно
        for (const [edgeId, edge] of graph.edges) {
            const fromIdx = this.findNodeIndex(edge.from, nodeIds);
            const toIdx = this.findNodeIndex(edge.to, nodeIds);
           
            if (fromIdx === -1 || toIdx === -1) continue;
           
            const origDx = Math.abs(originalPoints[toIdx].x - originalPoints[fromIdx].x);
            const origDy = Math.abs(originalPoints[toIdx].y - originalPoints[fromIdx].y);
            const transDx = Math.abs(transformedPoints[toIdx].x - transformedPoints[fromIdx].x);
            const transDy = Math.abs(transformedPoints[toIdx].y - transformedPoints[fromIdx].y);
           
            // Масштаб по X
            if (origDx > 1) {
                const scaleX = transDx / origDx;
                scaleRatiosX.push(scaleX);
            }
           
            // Масштаб по Y
            if (origDy > 1) {
                const scaleY = transDy / origDy;
                scaleRatiosY.push(scaleY);
            }
           
            // Проверить анизотропию (разное масштабирование по осям)
            if (origDx > 5 && origDy > 5) {
                const scaleX = transDx / origDx;
                const scaleY = transDy / origDy;
                const anisotropy = Math.abs(scaleX - scaleY) / Math.max(scaleX, scaleY);
               
                if (anisotropy > 0.3) { // Более 30% разницы
                    anisotropicEdges.push({
                        edgeId,
                        scaleX,
                        scaleY,
                        anisotropy,
                        isAnisotropic: anisotropy > 0.5
                    });
                }
            }
        }
       
        if (scaleRatiosX.length === 0 || scaleRatiosY.length === 0) {
            return this.createValidationResult('scale_uniformity', true, 'Недостаточно данных для проверки масштабирования');
        }
       
        const statsX = this.calculateStatistics(scaleRatiosX);
        const statsY = this.calculateStatistics(scaleRatiosY);
       
        // Разница между масштабированием по X и Y
        const scaleDifference = Math.abs(statsX.mean - statsY.mean) / Math.max(statsX.mean, statsY.mean);
        const scaleUniformityX = 1 - Math.min(1, statsX.stdDev / statsX.mean);
        const scaleUniformityY = 1 - Math.min(1, statsY.stdDev / statsY.mean);
       
        const overallUniformity = (scaleUniformityX + scaleUniformityY) / 2 * (1 - scaleDifference);
       
        const passed = overallUniformity > 0.8 && anisotropicEdges.length === 0;
       
        return {
            name: 'scale_uniformity',
            description: 'Равномерность масштабирования по всем направлениям',
            passed: passed,
            score: overallUniformity,
            metrics: {
                scaleMeanX: statsX.mean,
                scaleStdDevX: statsX.stdDev,
                scaleMeanY: statsY.mean,
                scaleStdDevY: statsY.stdDev,
                scaleDifference: scaleDifference,
                uniformityX: scaleUniformityX,
                uniformityY: scaleUniformityY,
                anisotropicEdges: anisotropicEdges.length,
                overallUniformity: overallUniformity
            },
            details: {
                expectedIsotropic: transformation?.type === 'rigid' || transformation?.type === 'similarity',
                allowsAnisotropy: transformation?.type === 'affine',
                anisotropicSamples: anisotropicEdges.slice(0, 3)
            }
        };
    }

    // 6. ПРОВЕРКА СОХРАНЕНИЯ ЛОКАЛЬНОЙ СТРУКТУРЫ
    validateLocalStructure(originalPoints, transformedPoints, graph, nodeIds) {
        console.log('   🏗️ Проверяю сохранение локальной структуры...');
       
        const localStructureScores = [];
        const problematicNodes = [];
       
        // Для каждого узла оценить сохранение локальной конфигурации
        for (const [nodeId, node] of graph.nodes) {
            const nodeIdx = this.findNodeIndex(nodeId, nodeIds);
            if (nodeIdx === -1) continue;
           
            const neighbors = this.getNodeNeighbors(nodeId, graph);
            if (neighbors.length < 2) continue;
           
            const neighborIndices = neighbors.map(nid => this.findNodeIndex(nid, nodeIds))
                                             .filter(idx => idx !== -1);
           
            if (neighborIndices.length < 2) continue;
           
            // Вычислить локальные инварианты
            const localScore = this.calculateLocalStructureScore(
                nodeIdx,
                neighborIndices,
                originalPoints,
                transformedPoints
            );
           
            localStructureScores.push(localScore);
           
            if (localScore < 0.6) {
                problematicNodes.push({
                    nodeIdx,
                    neighbors: neighborIndices.length,
                    localScore,
                    issues: this.identifyLocalStructureIssues(
                        nodeIdx, neighborIndices, originalPoints, transformedPoints
                    )
                });
            }
        }
       
        if (localStructureScores.length === 0) {
            return this.createValidationResult('local_structure', true, 'Недостаточно данных для проверки локальной структуры');
        }
       
        const stats = this.calculateStatistics(localStructureScores);
        const preservationRate = localStructureScores.filter(score => score > 0.7).length / localStructureScores.length;
       
        const passed = stats.mean > 0.7 && preservationRate > 0.7;
       
        return {
            name: 'local_structure',
            description: 'Сохранение локальной конфигурации каждой точки относительно соседей',
            passed: passed,
            score: stats.mean * 0.6 + preservationRate * 0.4,
            metrics: {
                meanLocalScore: stats.mean,
                minLocalScore: stats.min,
                maxLocalScore: stats.max,
                localScoreStdDev: stats.stdDev,
                wellPreservedNodes: localStructureScores.filter(score => score > 0.7).length,
                totalNodes: localStructureScores.length,
                preservationRate: preservationRate,
                problematicNodes: problematicNodes.length
            },
            details: {
                problematicSamples: problematicNodes.slice(0, 3)
            }
        };
    }

    // 7. ВЫЧИСЛЕНИЕ ОБЩЕЙ ОЦЕНКИ
    calculateOverallValidation(validations) {
        if (validations.length === 0) {
            return {
                overallScore: 0,
                passed: false,
                confidence: 0,
                summary: 'Нет данных для оценки'
            };
        }
       
        // Веса для разных типов проверок
        const weights = {
            distance_relations: 0.35,  // Самый важный инвариант
            angle_preservation: 0.25,
            connectivity: 0.20,
            scale_uniformity: 0.10,
            local_structure: 0.10
        };
       
        let weightedSum = 0;
        let weightSum = 0;
        let allPassed = true;
       
        validations.forEach(validation => {
            const weight = weights[validation.name] || 0.1;
            weightedSum += validation.score * weight;
            weightSum += weight;
           
            if (!validation.passed && weights[validation.name] >= 0.2) {
                allPassed = false; // Критичные проверки не прошли
            }
        });
       
        const overallScore = weightSum > 0 ? weightedSum / weightSum : 0;
       
        // Уверенность зависит от полноты проверок
        const confidence = Math.min(1, validations.length / 5) * overallScore;
       
        return {
            overallScore: overallScore,
            passed: allPassed && overallScore > 0.7,
            confidence: confidence,
            summary: this.generateValidationSummary(validations, overallScore),
            weightedScores: validations.map(v => ({
                name: v.name,
                score: v.score,
                weight: weights[v.name] || 0.1,
                passed: v.passed
            }))
        };
    }

    // 8. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    createValidationResult(name, passed, message = '', score = 0) {
        return {
            name: name,
            passed: passed,
            score: score,
            message: message,
            metrics: {},
            details: {}
        };
    }

    calculateStatistics(values) {
        if (values.length === 0) {
            return { mean: 0, stdDev: 0, min: 0, max: 0 };
        }
       
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
       
        return {
            mean: mean,
            stdDev: stdDev,
            min: Math.min(...values),
            max: Math.max(...values),
            count: values.length
        };
    }

    calculateDistance(pointA, pointB) {
        const dx = pointB.x - pointA.x;
        const dy = pointB.y - pointA.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    calculateAngle(center, pointA, center2, pointB) {
        const vec1 = { x: pointA.x - center.x, y: pointA.y - center.y };
        const vec2 = { x: pointB.x - center2.x, y: pointB.y - center2.y };
       
        const dot = vec1.x * vec2.x + vec1.y * vec2.y;
        const mag1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
        const mag2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);
       
        if (mag1 === 0 || mag2 === 0) return 0;
       
        return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
    }

    findNodeIndex(nodeId, nodeIds) {
        return nodeIds.indexOf(nodeId);
    }

    getNodeNeighbors(nodeId, graph) {
        const neighbors = new Set();
       
        for (const [edgeId, edge] of graph.edges) {
            if (edge.from === nodeId) neighbors.add(edge.to);
            if (edge.to === nodeId) neighbors.add(edge.from);
        }
       
        return Array.from(neighbors);
    }

    calculateAverageDegree(graph) {
        if (graph.nodes.size === 0) return 0;
       
        let totalDegree = 0;
        for (const [nodeId] of graph.nodes) {
            let degree = 0;
            for (const [edgeId, edge] of graph.edges) {
                if (edge.from === nodeId || edge.to === nodeId) {
                    degree++;
                }
            }
            totalDegree += degree;
        }
       
        return totalDegree / graph.nodes.size;
    }

    calculateLocalStructureScore(nodeIdx, neighborIndices, originalPoints, transformedPoints) {
        // Оценить сохранение локальной конфигурации точки
       
        let totalScore = 0;
        let comparisonCount = 0;
       
        // Для каждого соседа
        for (let i = 0; i < neighborIndices.length; i++) {
            const neighborIdx = neighborIndices[i];
           
            // Относительное расстояние до соседа
            const origDist = this.calculateDistance(originalPoints[nodeIdx], originalPoints[neighborIdx]);
            const transDist = this.calculateDistance(transformedPoints[nodeIdx], transformedPoints[neighborIdx]);
           
            const distScore = 1 - Math.min(1, Math.abs(transDist - origDist) / Math.max(origDist, 10));
            totalScore += distScore;
            comparisonCount++;
           
            // Относительное направление к соседу (если есть другие соседи)
            for (let j = i + 1; j < neighborIndices.length; j++) {
                const otherNeighborIdx = neighborIndices[j];
               
                const origAngle = this.calculateAngle(
                    originalPoints[nodeIdx], originalPoints[neighborIdx],
                    originalPoints[nodeIdx], originalPoints[otherNeighborIdx]
                );
               
                const transAngle = this.calculateAngle(
                    transformedPoints[nodeIdx], transformedPoints[neighborIdx],
                    transformedPoints[nodeIdx], transformedPoints[otherNeighborIdx]
                );
               
                const angleScore = 1 - Math.min(1, Math.abs(transAngle - origAngle) / Math.PI);
                totalScore += angleScore;
                comparisonCount++;
            }
        }
       
        return comparisonCount > 0 ? totalScore / comparisonCount : 1;
    }

    identifyLocalStructureIssues(nodeIdx, neighborIndices, originalPoints, transformedPoints) {
        const issues = [];
       
        // Проверить расстояния
        for (const neighborIdx of neighborIndices) {
            const origDist = this.calculateDistance(originalPoints[nodeIdx], originalPoints[neighborIdx]);
            const transDist = this.calculateDistance(transformedPoints[nodeIdx], transformedPoints[neighborIdx]);
            const change = Math.abs(transDist - origDist) / Math.max(origDist, 1);
           
            if (change > 0.5) {
                issues.push(`Расстояние до соседа изменилось на ${(change * 100).toFixed(0)}%`);
            }
        }
       
        // Проверить порядок соседей по углу
        if (neighborIndices.length >= 3) {
            const origAngles = neighborIndices.map(nIdx => {
                const dx = originalPoints[nIdx].x - originalPoints[nodeIdx].x;
                const dy = originalPoints[nIdx].y - originalPoints[nodeIdx].y;
                return Math.atan2(dy, dx);
            });
           
            const transAngles = neighborIndices.map(nIdx => {
                const dx = transformedPoints[nIdx].x - transformedPoints[nodeIdx].x;
                const dy = transformedPoints[nIdx].y - transformedPoints[nodeIdx].y;
                return Math.atan2(dy, dx);
            });
           
            // Сортировать по углу и проверить сохранение порядка
            const origOrder = [...origAngles].sort((a, b) => a - b);
            const transOrder = [...transAngles].sort((a, b) => a - b);
           
            // Простая проверка: углы не должны сильно менять порядок
            for (let i = 0; i < origOrder.length - 1; i++) {
                if (Math.abs(origOrder[i] - transOrder[i]) > Math.PI / 2) {
                    issues.push('Изменился порядок соседей вокруг точки');
                    break;
                }
            }
        }
       
        return issues.length > 0 ? issues : ['Локальная структура сохранена'];
    }

    generateValidationSummary(validations, overallScore) {
        const criticalValidations = validations.filter(v =>
            ['distance_relations', 'connectivity'].includes(v.name)
        );
       
        const criticalPassed = criticalValidations.every(v => v.passed);
        const allPassed = validations.every(v => v.passed);
       
        if (overallScore > 0.9 && allPassed) {
            return '✅ ОТЛИЧНО: Топология полностью сохранена, трансформация корректна';
        } else if (overallScore > 0.7 && criticalPassed) {
            return '⚠️ ХОРОШО: Критические инварианты сохранены, есть небольшие искажения';
        } else if (overallScore > 0.5 && criticalPassed) {
            return '⚠️ УДОВЛЕТВОРИТЕЛЬНО: Основная структура сохранена, но есть значительные искажения';
        } else if (!criticalPassed) {
            const failedCritical = criticalValidations.filter(v => !v.passed);
            return `❌ КРИТИЧЕСКОЕ НАРУШЕНИЕ: ${failedCritical.map(v => v.name).join(', ')} не сохранены`;
        } else {
            return '❌ НЕУДОВЛЕТВОРИТЕЛЬНО: Топология значительно искажена';
        }
    }

    printValidationResults(result) {
        console.log('\n📊 РЕЗУЛЬТАТЫ ПРОВЕРКИ ТОПОЛОГИЧЕСКИХ ИНВАРИАНТОВ:');
        console.log('═'.repeat(60));
       
        result.validations.forEach(validation => {
            const status = validation.passed ? '✅' : '❌';
            const scorePercent = (validation.score * 100).toFixed(1);
           
            console.log(`${status} ${validation.name.padEnd(25)}: ${scorePercent}% ${validation.passed ? 'ПРОЙДЕНО' : 'НЕ ПРОЙДЕНО'}`);
           
            if (this.config.debug && !validation.passed) {
                console.log(`   📝 ${validation.description}`);
                Object.entries(validation.metrics).forEach(([key, value]) => {
                    if (typeof value === 'number' && Math.abs(value) < 1000) {
                        console.log(`   📊 ${key}: ${value.toFixed(3)}`);
                    }
                });
            }
        });
       
        console.log('─'.repeat(60));
        console.log(`🏆 ОБЩАЯ ОЦЕНКА: ${(result.overall.overallScore * 100).toFixed(1)}%`);
        console.log(`🎯 РЕЗУЛЬТАТ: ${result.overall.passed ? '✅ ТОПОЛОГИЯ СОХРАНЕНА' : '❌ ТОПОЛОГИЯ НАРУШЕНА'}`);
        console.log(`💎 УВЕРЕННОСТЬ: ${(result.overall.confidence * 100).toFixed(1)}%`);
        console.log(`📋 ${result.overall.summary}`);
        console.log('═'.repeat(60));
    }

    // 9. МЕТОДЫ ДЛЯ ИСПОЛЬЗОВАНИЯ ВНЕШНИМ КОДОМ

    // Быстрая проверка трансформации
    quickValidate(originalPoints, transformedPoints, graph) {
        return this.validateTransformation(originalPoints, transformedPoints, graph);
    }

    // Проверить, является ли трансформация жёсткой (rigid)
    isRigidTransformation(originalPoints, transformedPoints, graph) {
        const result = this.validateTransformation(originalPoints, transformedPoints, graph);
       
        // Для жёсткой трансформации:
        // 1. Масштабирование должно быть равномерным
        // 2. Углы должны сохраняться идеально
        // 3. Отношения расстояний должны сохраняться
       
        const scaleValidation = result.validations.find(v => v.name === 'scale_uniformity');
        const angleValidation = result.validations.find(v => v.name === 'angle_preservation');
        const distanceValidation = result.validations.find(v => v.name === 'distance_relations');
       
        return scaleValidation?.score > 0.95 &&
               angleValidation?.score > 0.95 &&
               distanceValidation?.metrics?.scaleUniformity > 0.95;
    }

    // Получить историю проверок
    getValidationHistory() {
        return this.invariantHistory;
    }

    // Сброс истории
    clearHistory() {
        this.validationResults.clear();
        this.invariantHistory = [];
    }

    // Экспорт результатов в JSON
    exportResults() {
        return {
            config: this.config,
            history: this.invariantHistory,
            summary: {
                totalValidations: this.invariantHistory.length,
                passedValidations: this.invariantHistory.filter(r => r.overall.passed).length,
                averageScore: this.invariantHistory.length > 0 ?
                    this.invariantHistory.reduce((sum, r) => sum + r.overall.overallScore, 0) / this.invariantHistory.length : 0
            }
        };
    }
}

module.exports = TopologyValidator;
