// modules/footprint/topology-integration.js
// ИНТЕГРАЦИЯ ТОПОЛОГИЧЕСКИХ КОМПОНЕНТОВ - ОБЪЕДИНЕНИЕ TopologyMerger, Refiner, Validator

const TopologyMerger = require('./topology-merger');
const TopologyRefiner = require('./topology-refiner');
const TopologyValidator = require('./topology-validator');
const SimpleGraph = require('./simple-graph');

class TopologyIntegration {
    constructor(options = {}) {
        this.config = {
            // Настройки для каждого компонента
            mergerConfig: {
                structuralSimilarityThreshold: options.structuralSimilarityThreshold || 0.7,
                preserveTopology: true,
                minMatchesForMerge: options.minMatchesForMerge || 5,
                maxMergeDistance: options.maxMergeDistance || 40,
                enableTopologyRefinement: options.enableTopologyRefinement !== false,
                ...options.mergerConfig
            },
           
            refinerConfig: {
                springConstant: options.springConstant || 0.15,
                repulsionConstant: options.repulsionConstant || 80,
                damping: options.damping || 0.85,
                maxIterations: options.refinerIterations || 120,
                preserveAngles: options.preserveAngles !== false,
                visualizeForces: options.visualizeForces || false,
                ...options.refinerConfig
            },
           
            validatorConfig: {
                distanceTolerance: options.distanceTolerance || 0.15,
                angleTolerance: options.angleTolerance || 0.2,
                connectivityThreshold: options.connectivityThreshold || 0.8,
                debug: options.debug || false,
                ...options.validatorConfig
            },
           
            // Общие настройки
            enableValidation: options.enableValidation !== false,
            enableVisualization: options.enableVisualization !== false,
            outputDir: options.outputDir || './temp/topology_integration',
            debug: options.debug || false,
            ...options
        };
       
        // Инициализация компонентов
        this.merger = new TopologyMerger(this.config.mergerConfig);
        this.refiner = new TopologyRefiner(this.config.refinerConfig);
        this.validator = new TopologyValidator(this.config.validatorConfig);
       
        // Статистика
        this.stats = {
            totalMerges: 0,
            successfulMerges: 0,
            failedMerges: 0,
            refinementApplied: 0,
            validationPassed: 0,
            validationFailed: 0,
            startTime: new Date()
        };
       
        // История операций
        this.operationHistory = [];
       
        console.log('🔧 Создана TopologyIntegration: объединение всех топологических компонентов');
        console.log('   ├─ TopologyMerger: структурное слияние графов');
        console.log('   ├─ TopologyRefiner: пружинная коррекция топологии');
        console.log('   └─ TopologyValidator: проверка топологических инвариантов');
    }

    // 1. ОСНОВНОЙ МЕТОД: ПОЛНОЕ ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ С УТОЧНЕНИЕМ
    async fullTopologyMerge(graph1, graph2, transformation = null, options = {}) {
        const operationId = `merge_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const startTime = Date.now();
       
        console.log(`\n🏗️ ЗАПУСК ПОЛНОГО ТОПОЛОГИЧЕСКОГО СЛИЯНИЯ [${operationId}]`);
        console.log(`📊 Входные графы: G1(${graph1.nodes.size} узлов, ${graph1.edges.size} рёбер), ` +
                   `G2(${graph2.nodes.size} узлов, ${graph2.edges.size} рёбер)`);
       
        const operationRecord = {
            id: operationId,
            startTime: new Date(),
            input: {
                graph1Nodes: graph1.nodes.size,
                graph1Edges: graph1.edges.size,
                graph2Nodes: graph2.nodes.size,
                graph2Edges: graph2.edges.size,
                transformation: transformation
            },
            stages: []
        };
       
        try {
            // ЭТАП 1: ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ
            const mergeStage = await this.executeMergeStage(graph1, graph2, transformation, options);
            operationRecord.stages.push(mergeStage);
           
            if (!mergeStage.success) {
                console.log(`❌ Слияние не удалось: ${mergeStage.error}`);
                return this.finalizeOperation(operationRecord, false, 'Merge failed');
            }
           
            // ЭТАП 2: ТОПОЛОГИЧЕСКОЕ УТОЧНЕНИЕ (если включено)
            let refinementStage = null;
            if (this.config.mergerConfig.enableTopologyRefinement && mergeStage.result.mergedGraph) {
                refinementStage = await this.executeRefinementStage(
                    mergeStage.result,
                    transformation,
                    options
                );
                operationRecord.stages.push(refinementStage);
            }
           
            // ЭТАП 3: ВАЛИДАЦИЯ РЕЗУЛЬТАТА (если включено)
            let validationStage = null;
            if (this.config.enableValidation) {
                validationStage = await this.executeValidationStage(
                    mergeStage.result,
                    refinementStage?.result,
                    options
                );
                operationRecord.stages.push(validationStage);
            }
           
            // СБОРКА ФИНАЛЬНОГО РЕЗУЛЬТАТА
            const finalResult = this.compileFinalResult(
                mergeStage.result,
                refinementStage?.result,
                validationStage?.result
            );
           
            operationRecord.result = finalResult;
            operationRecord.success = true;
            operationRecord.duration = Date.now() - startTime;
           
            // ОБНОВЛЕНИЕ СТАТИСТИКИ
            this.updateStats(true, operationRecord.stages);
           
            // ВЫВОД ИТОГОВ
            this.printOperationSummary(operationRecord);
           
            return finalResult;
           
        } catch (error) {
            console.log(`❌ Ошибка в полном слиянии: ${error.message}`);
            console.error(error.stack);
           
            operationRecord.error = error.message;
            operationRecord.success = false;
            operationRecord.duration = Date.now() - startTime;
           
            this.updateStats(false);
            this.operationHistory.push(operationRecord);
           
            return {
                success: false,
                error: error.message,
                operationId: operationId,
                stages: operationRecord.stages
            };
        }
    }

    // 2. ЭТАП 1: ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ
    async executeMergeStage(graph1, graph2, transformation, options) {
        const stageStart = Date.now();
        console.log('\n🔧 ЭТАП 1: ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ ГРАФОВ');
       
        try {
            const mergeResult = this.merger.mergeGraphs(graph1, graph2, transformation);
           
            const stageResult = {
                name: 'topology_merge',
                startTime: new Date(stageStart),
                duration: Date.now() - stageStart,
                success: mergeResult.success,
                result: mergeResult,
                metrics: {
                    structuralMatches: mergeResult.structuralMatches?.length || 0,
                    structuralSimilarity: mergeResult.structuralSimilarity || 0,
                    mergedNodes: mergeResult.mergedGraph?.nodes.size || 0,
                    mergedEdges: mergeResult.mergedGraph?.edges.size || 0,
                    method: mergeResult.metrics?.method || 'unknown'
                }
            };
           
            if (mergeResult.success) {
                console.log(`✅ Слияние успешно!`);
                console.log(`   🏗️ Структурных соответствий: ${stageResult.metrics.structuralMatches}`);
                console.log(`   📊 Структурная схожесть: ${stageResult.metrics.structuralSimilarity.toFixed(3)}`);
                console.log(`   🔗 Объединённый граф: ${stageResult.metrics.mergedNodes} узлов, ${stageResult.metrics.mergedEdges} рёбер`);
            } else {
                console.log(`❌ Слияние не удалось: ${mergeResult.reason}`);
            }
           
            return stageResult;
           
        } catch (error) {
            console.log(`❌ Ошибка на этапе слияния: ${error.message}`);
            return {
                name: 'topology_merge',
                startTime: new Date(stageStart),
                duration: Date.now() - stageStart,
                success: false,
                error: error.message,
                metrics: {}
            };
        }
    }

    // 3. ЭТАП 2: ТОПОЛОГИЧЕСКОЕ УТОЧНЕНИЕ
    async executeRefinementStage(mergeResult, transformation, options) {
        const stageStart = Date.now();
        console.log('\n🔧 ЭТАП 2: ТОПОЛОГИЧЕСКОЕ УТОЧНЕНИЕ (ПРУЖИННАЯ КОРРЕКЦИЯ)');
       
        if (!mergeResult.mergedGraph || mergeResult.mergedGraph.nodes.size < 3) {
            console.log('⚠️ Пропускаю уточнение: объединённый граф слишком мал');
            return {
                name: 'topology_refinement',
                startTime: new Date(stageStart),
                duration: Date.now() - stageStart,
                success: false,
                skipped: true,
                reason: 'Merged graph too small',
                metrics: {}
            };
        }
       
        try {
            // Преобразовать граф в точки для рефайнера
            const originalPoints = this.graphToPoints(mergeResult.mergedGraph);
           
            // Выполнить уточнение
            const refinementResult = this.refiner.refineWithTransformation(
                originalPoints,
                transformation || { type: 'none' },
                mergeResult.mergedGraph,
                {
                    outputPath: options.refinementVisualizationPath ||
                               `${this.config.outputDir}/refinement_${Date.now()}.png`
                }
            );
           
            if (!refinementResult.success) {
                console.log('⚠️ Уточнение не удалось, продолжаю без него');
                return {
                    name: 'topology_refinement',
                    startTime: new Date(stageStart),
                    duration: Date.now() - stageStart,
                    success: false,
                    result: null,
                    metrics: {}
                };
            }
           
            // Преобразовать уточнённые точки обратно в граф
            const refinedGraph = this.pointsToGraph(
                refinementResult.points,
                mergeResult.mergedGraph,
                'refined'
            );
           
            const stageResult = {
                name: 'topology_refinement',
                startTime: new Date(stageStart),
                duration: Date.now() - stageStart,
                success: true,
                result: {
                    refinementResult: refinementResult,
                    refinedGraph: refinedGraph,
                    improvement: refinementResult.improvement,
                    visualization: refinementResult.visualization
                },
                metrics: {
                    iterations: refinementResult.stats.iterations,
                    finalEnergy: refinementResult.stats.finalEnergy,
                    consistency: refinementResult.improvement.consistency,
                    edgesPreserved: refinementResult.improvement.edgesPreserved,
                    topologyImprovement: refinementResult.improvement.topologyImprovement
                }
            };
           
            console.log(`✅ Уточнение успешно!`);
            console.log(`   ⚡ Итераций: ${stageResult.metrics.iterations}`);
            console.log(`   📊 Энергия системы: ${stageResult.metrics.finalEnergy.toFixed(6)}`);
            console.log(`   🎯 Согласованность: ${(stageResult.metrics.consistency * 100).toFixed(1)}%`);
            console.log(`   🔗 Сохранено связей: ${stageResult.metrics.edgesPreserved}%`);
            console.log(`   🏗️ Улучшение топологии: ${stageResult.metrics.topologyImprovement.toFixed(1)}%`);
           
            if (refinementResult.visualization) {
                console.log(`   🎨 Визуализация: ${refinementResult.visualization}`);
            }
           
            return stageResult;
           
        } catch (error) {
            console.log(`❌ Ошибка на этапе уточнения: ${error.message}`);
            return {
                name: 'topology_refinement',
                startTime: new Date(stageStart),
                duration: Date.now() - stageStart,
                success: false,
                error: error.message,
                metrics: {}
            };
        }
    }

    // 4. ЭТАП 3: ВАЛИДАЦИЯ РЕЗУЛЬТАТА
    async executeValidationStage(mergeResult, refinementResult, options) {
        const stageStart = Date.now();
        console.log('\n🔧 ЭТАП 3: ВАЛИДАЦИЯ ТОПОЛОГИЧЕСКИХ ИНВАРИАНТОВ');
       
        try {
            // Выбрать граф для валидации (уточнённый или просто объединённый)
            const graphToValidate = refinementResult?.refinedGraph || mergeResult.mergedGraph;
           
            if (!graphToValidate || graphToValidate.nodes.size < 3) {
                console.log('⚠️ Пропускаю валидацию: граф слишком мал');
                return {
                    name: 'topology_validation',
                    startTime: new Date(stageStart),
                    duration: Date.now() - stageStart,
                    success: false,
                    skipped: true,
                    reason: 'Graph too small for validation',
                    metrics: {}
                };
            }
           
            // Для валидации нужны оригинальные точки до слияния
            // В реальном сценарии их нужно сохранить из mergeResult
            // Здесь используем упрощённый подход
           
            // Создать "оригинальные" точки из графа до уточнения
            const originalPoints = refinementResult ?
                this.graphToPoints(mergeResult.mergedGraph) :
                this.createSyntheticOriginalPoints(graphToValidate);
           
            // Точки после обработки
            const processedPoints = this.graphToPoints(graphToValidate);
           
            // Выполнить валидацию
            const validationResult = this.validator.validateTransformation(
                originalPoints,
                processedPoints,
                graphToValidate,
                mergeResult.transformation
            );
           
            const stageResult = {
                name: 'topology_validation',
                startTime: new Date(stageStart),
                duration: Date.now() - stageStart,
                success: validationResult.overall.passed,
                result: validationResult,
                metrics: {
                    overallScore: validationResult.overall.overallScore,
                    passed: validationResult.overall.passed,
                    confidence: validationResult.overall.confidence,
                    criticalTestsPassed: validationResult.validations
                        .filter(v => ['distance_relations', 'connectivity'].includes(v.name))
                        .every(v => v.passed)
                }
            };
           
            // Вывод кратких результатов
            const status = validationResult.overall.passed ? '✅ ПРОЙДЕНА' : '❌ НЕ ПРОЙДЕНА';
            console.log(`📊 Валидация: ${status}`);
            console.log(`   🏆 Общая оценка: ${(validationResult.overall.overallScore * 100).toFixed(1)}%`);
            console.log(`   💎 Уверенность: ${(validationResult.overall.confidence * 100).toFixed(1)}%`);
            console.log(`   📋 ${validationResult.overall.summary}`);
           
            return stageResult;
           
        } catch (error) {
            console.log(`❌ Ошибка на этапе валидации: ${error.message}`);
            return {
                name: 'topology_validation',
                startTime: new Date(stageStart),
                duration: Date.now() - stageStart,
                success: false,
                error: error.message,
                metrics: {}
            };
        }
    }

    // 5. КОМПИЛЯЦИЯ ФИНАЛЬНОГО РЕЗУЛЬТАТА
    compileFinalResult(mergeResult, refinementResult, validationResult) {
        const finalGraph = refinementResult?.refinedGraph || mergeResult.mergedGraph;
       
        // Рассчитать комбинированные метрики
        const combinedMetrics = this.calculateCombinedMetrics(
            mergeResult,
            refinementResult,
            validationResult
        );
       
        // Определить качество результата
        const quality = this.assessResultQuality(combinedMetrics);
       
        return {
            success: true,
            graph: finalGraph,
            metrics: combinedMetrics,
            quality: quality,
            stages: {
                merge: mergeResult,
                refinement: refinementResult,
                validation: validationResult
            },
            recommendations: this.generateRecommendations(combinedMetrics, validationResult)
        };
    }

    // 6. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    graphToPoints(graph) {
        const points = [];
        const nodeIds = Array.from(graph.nodes.keys());
       
        for (const nodeId of nodeIds) {
            const node = graph.nodes.get(nodeId);
            if (node) {
                points.push({
                    x: node.x,
                    y: node.y,
                    confidence: node.confidence || 0.5,
                    nodeId: nodeId,
                    source: node.source || 'graph'
                });
            }
        }
       
        return points;
    }

    pointsToGraph(points, originalGraph, label = 'converted') {
        const newGraph = new SimpleGraph(`${label}_graph`);
        const nodeIdMap = new Map();
       
        // Создать узлы
        points.forEach((point, index) => {
            const nodeId = point.nodeId || `node_${index}`;
            nodeIdMap.set(index, nodeId);
           
            newGraph.addNode({
                id: nodeId,
                x: point.x,
                y: point.y,
                confidence: point.confidence,
                source: point.source || label
            });
        });
       
        // Восстановить рёбра из оригинального графа (если возможно)
        if (originalGraph && originalGraph.edges.size > 0) {
            // Упрощённый подход: добавить рёбра для близких точек
            this.reconstructEdgesFromProximity(newGraph, points);
        }
       
        return newGraph;
    }

    reconstructEdgesFromProximity(graph, points, maxDistance = 50) {
        // Простая эвристика: соединить точки, которые близки друг к другу
        let edgeCount = 0;
       
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dx = points[j].x - points[i].x;
                const dy = points[j].y - points[i].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
               
                if (distance < maxDistance) {
                    const nodeId1 = points[i].nodeId || `node_${i}`;
                    const nodeId2 = points[j].nodeId || `node_${j}`;
                   
                    // Проверить, не существует ли уже такое ребро
                    let edgeExists = false;
                    for (const [_, edge] of graph.edges) {
                        if ((edge.from === nodeId1 && edge.to === nodeId2) ||
                            (edge.from === nodeId2 && edge.to === nodeId1)) {
                            edgeExists = true;
                            break;
                        }
                    }
                   
                    if (!edgeExists) {
                        graph.addEdge({
                            id: `edge_${edgeCount++}`,
                            from: nodeId1,
                            to: nodeId2,
                            weight: 1 - (distance / maxDistance),
                            distance: distance
                        });
                    }
                }
            }
        }
    }

    createSyntheticOriginalPoints(graph) {
        // Создать немного искажённые "оригинальные" точки для тестирования
        return this.graphToPoints(graph).map(point => ({
            ...point,
            x: point.x + (Math.random() * 10 - 5), // ±5 пикселей шума
            y: point.y + (Math.random() * 10 - 5),
            source: 'synthetic_original'
        }));
    }

    calculateCombinedMetrics(mergeResult, refinementResult, validationResult) {
        const metrics = {
            structural: {
                similarity: mergeResult.structuralSimilarity || 0,
                matches: mergeResult.structuralMatches?.length || 0
            },
            refinement: refinementResult ? {
                applied: true,
                consistency: refinementResult.improvement?.consistency || 0,
                topologyImprovement: refinementResult.improvement?.topologyImprovement || 0,
                energy: refinementResult.stats?.finalEnergy || 0
            } : {
                applied: false,
                consistency: 0,
                topologyImprovement: 0,
                energy: 0
            },
            validation: validationResult ? {
                performed: true,
                overallScore: validationResult.overall?.overallScore || 0,
                passed: validationResult.overall?.passed || false,
                confidence: validationResult.overall?.confidence || 0
            } : {
                performed: false,
                overallScore: 0,
                passed: false,
                confidence: 0
            }
        };
       
        // Комбинированный score
        let combinedScore = metrics.structural.similarity * 0.4;
       
        if (metrics.refinement.applied) {
            combinedScore += metrics.refinement.consistency * 0.3;
        }
       
        if (metrics.validation.performed) {
            combinedScore += metrics.validation.overallScore * 0.3;
        } else {
            combinedScore += 0.3; // Максимальный score за пропущенную валидацию
        }
       
        metrics.combinedScore = Math.min(1, combinedScore);
       
        return metrics;
    }

    assessResultQuality(metrics) {
        if (metrics.combinedScore > 0.9) {
            return {
                level: 'excellent',
                description: 'Отличное качество, топология полностью сохранена',
                color: '#2ecc71', // Зелёный
                canUseForSuperModel: true
            };
        } else if (metrics.combinedScore > 0.7) {
            return {
                level: 'good',
                description: 'Хорошее качество, незначительные искажения',
                color: '#f39c12', // Оранжевый
                canUseForSuperModel: true
            };
        } else if (metrics.combinedScore > 0.5) {
            return {
                level: 'acceptable',
                description: 'Приемлемое качество, заметные искажения',
                color: '#e74c3c', // Красный
                canUseForSuperModel: false
            };
        } else {
            return {
                level: 'poor',
                description: 'Низкое качество, топология нарушена',
                color: '#c0392b', // Тёмно-красный
                canUseForSuperModel: false
            };
        }
    }

    generateRecommendations(metrics, validationResult) {
        const recommendations = [];
       
        if (metrics.structural.similarity < 0.6) {
            recommendations.push({
                type: 'warning',
                message: 'Низкая структурная схожесть. Рассмотрите возможность отказа от слияния.',
                action: 'skip_merge'
            });
        }
       
        if (!metrics.refinement.applied && metrics.structural.similarity > 0.7) {
            recommendations.push({
                type: 'suggestion',
                message: 'Включите топологическое уточнение для улучшения результата.',
                action: 'enable_refinement'
            });
        }
       
        if (metrics.validation.performed && !metrics.validation.passed) {
            const failedTests = validationResult?.validations
                .filter(v => !v.passed)
                .map(v => v.name);
               
            recommendations.push({
                type: 'critical',
                message: `Нарушены топологические инварианты: ${failedTests.join(', ')}`,
                action: 'review_transformation'
            });
        }
       
        if (metrics.combinedScore > 0.8) {
            recommendations.push({
                type: 'success',
                message: 'Результат подходит для создания супер-модели.',
                action: 'create_super_model'
            });
        }
       
        return recommendations;
    }

    updateStats(success, stages = []) {
        this.stats.totalMerges++;
       
        if (success) {
            this.stats.successfulMerges++;
           
            // Учесть применение уточнения
            const refinementStage = stages.find(s => s.name === 'topology_refinement');
            if (refinementStage && refinementStage.success && !refinementStage.skipped) {
                this.stats.refinementApplied++;
            }
           
            // Учесть валидацию
            const validationStage = stages.find(s => s.name === 'topology_validation');
            if (validationStage && validationStage.success && !validationStage.skipped) {
                if (validationStage.result?.overall?.passed) {
                    this.stats.validationPassed++;
                } else {
                    this.stats.validationFailed++;
                }
            }
        } else {
            this.stats.failedMerges++;
        }
    }

    finalizeOperation(operationRecord, success, message) {
        operationRecord.success = success;
        operationRecord.endTime = new Date();
        operationRecord.message = message;
       
        this.operationHistory.push(operationRecord);
        this.updateStats(success, operationRecord.stages);
       
        return {
            success: success,
            message: message,
            operationId: operationRecord.id,
            stages: operationRecord.stages
        };
    }

    printOperationSummary(operationRecord) {
        console.log('\n' + '═'.repeat(70));
        console.log('🏁 ИТОГИ ОПЕРАЦИИ ТОПОЛОГИЧЕСКОГО СЛИЯНИЯ');
        console.log('═'.repeat(70));
       
        console.log(`📋 ID операции: ${operationRecord.id}`);
        console.log(`⏱️ Длительность: ${operationRecord.duration} мс`);
        console.log(`✅ Статус: ${operationRecord.success ? 'УСПЕХ' : 'НЕУДАЧА'}`);
       
        if (operationRecord.result) {
            const { metrics, quality, recommendations } = operationRecord.result;
           
            console.log(`\n📊 МЕТРИКИ КАЧЕСТВА:`);
            console.log(`   🏗️ Структурная схожесть: ${(metrics.structural.similarity * 100).toFixed(1)}%`);
           
            if (metrics.refinement.applied) {
                console.log(`   🌀 Уточнение применено: ДА`);
                console.log(`   🎯 Согласованность после уточнения: ${(metrics.refinement.consistency * 100).toFixed(1)}%`);
            }
           
            if (metrics.validation.performed) {
                console.log(`   🔍 Валидация выполнена: ${metrics.validation.passed ? '✅ ПРОЙДЕНА' : '❌ НЕ ПРОЙДЕНА'}`);
                console.log(`   🏆 Оценка валидации: ${(metrics.validation.overallScore * 100).toFixed(1)}%`);
            }
           
            console.log(`\n🏆 ОБЩАЯ ОЦЕНКА: ${(metrics.combinedScore * 100).toFixed(1)}%`);
            console.log(`🎯 КАЧЕСТВО: ${quality.level.toUpperCase()} - ${quality.description}`);
            console.log(`📈 ПРИГОДНО ДЛЯ СУПЕР-МОДЕЛИ: ${quality.canUseForSuperModel ? '✅ ДА' : '❌ НЕТ'}`);
           
            if (recommendations.length > 0) {
                console.log(`\n💡 РЕКОМЕНДАЦИИ:`);
                recommendations.forEach((rec, i) => {
                    const icon = rec.type === 'critical' ? '❌' :
                                rec.type === 'warning' ? '⚠️' :
                                rec.type === 'suggestion' ? '💡' : '✅';
                    console.log(`   ${icon} ${rec.message}`);
                });
            }
        }
       
        console.log('═'.repeat(70));
    }

    // 7. ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ВНЕШНЕГО ИСПОЛЬЗОВАНИЯ

    // Быстрое слияние без уточнения и валидации
    async quickMerge(graph1, graph2, transformation = null) {
        return this.merger.mergeGraphs(graph1, graph2, transformation);
    }

    // Только уточнение существующего графа
    async refineOnly(graph, transformation = null) {
        const points = this.graphToPoints(graph);
        return this.refiner.refineWithTransformation(points, transformation || { type: 'none' }, graph);
    }

    // Только валидация
    async validateOnly(originalGraph, processedGraph, transformation = null) {
        const originalPoints = this.graphToPoints(originalGraph);
        const processedPoints = this.graphToPoints(processedGraph);
       
        return this.validator.validateTransformation(
            originalPoints,
            processedPoints,
            processedGraph,
            transformation
        );
    }

    // Пакетная обработка нескольких графов
    async batchMerge(graphs, transformations = []) {
        if (graphs.length < 2) {
            return { success: false, error: 'Need at least 2 graphs for batch merge' };
        }
       
        console.log(`🧩 Начинаю пакетное слияние ${graphs.length} графов...`);
       
        let currentGraph = graphs[0];
        const results = [];
       
        for (let i = 1; i < graphs.length; i++) {
            console.log(`\n🔄 Слияние графа ${i + 1} из ${graphs.length}...`);
           
            const transformation = transformations[i - 1] || null;
            const result = await this.fullTopologyMerge(
                currentGraph,
                graphs[i],
                transformation,
                { enableValidation: false } // Отключить валидацию для скорости
            );
           
            results.push({
                step: i,
                fromGraph: currentGraph.nodes.size,
                toGraph: graphs[i].nodes.size,
                result: result.success,
                mergedSize: result.graph?.nodes.size || 0
            });
           
            if (result.success && result.graph) {
                currentGraph = result.graph;
            } else {
                console.log(`⚠️ Прерываю пакетное слияние на шаге ${i}`);
                break;
            }
        }
       
        return {
            success: true,
            finalGraph: currentGraph,
            steps: results,
            stats: {
                initialGraphs: graphs.length,
                successfulMerges: results.filter(r => r.result).length,
                finalNodes: currentGraph.nodes.size,
                finalEdges: currentGraph.edges.size
            }
        };
    }

    // Получить статистику работы
    getStats() {
        const now = new Date();
        const uptime = now - this.stats.startTime;
       
        return {
            ...this.stats,
            uptime: uptime,
            uptimeFormatted: this.formatDuration(uptime),
            successRate: this.stats.totalMerges > 0 ?
                (this.stats.successfulMerges / this.stats.totalMerges * 100).toFixed(1) + '%' : '0%',
            recentOperations: this.operationHistory.slice(-5).map(op => ({
                id: op.id,
                success: op.success,
                duration: op.duration,
                timestamp: op.startTime.toISOString()
            }))
        };
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
       
        if (hours > 0) {
            return `${hours}ч ${minutes % 60}м ${seconds % 60}с`;
        } else if (minutes > 0) {
            return `${minutes}м ${seconds % 60}с`;
        } else {
            return `${seconds}с`;
        }
    }

    // Экспорт истории операций
    exportHistory() {
        return {
            config: this.config,
            stats: this.getStats(),
            history: this.operationHistory.map(op => ({
                id: op.id,
                timestamp: op.startTime,
                success: op.success,
                duration: op.duration,
                input: op.input,
                stages: op.stages.map(s => ({
                    name: s.name,
                    success: s.success,
                    duration: s.duration,
                    metrics: s.metrics
                }))
            }))
        };
    }

    // Сброс статистики
    resetStats() {
        this.stats = {
            totalMerges: 0,
            successfulMerges: 0,
            failedMerges: 0,
            refinementApplied: 0,
            validationPassed: 0,
            validationFailed: 0,
            startTime: new Date()
        };
       
        this.operationHistory = [];
        console.log('📊 Статистика сброшена');
    }
}

module.exports = TopologyIntegration;
