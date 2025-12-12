// modules/footprint/topology-merger.js
// ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ СТРУКТУР (ЗАМЕНА point-merger.js!)

const VectorGraph = require('./vector-graph');
const ConfidenceValidator = require('../utils/confidence-validator');

class TopologyMerger {
    constructor(options = {}) {
        this.config = {
            structuralSimilarityThreshold: options.structuralSimilarityThreshold || 0.7,
            preserveTopology: options.preserveTopology !== false,
            minMatchesForMerge: options.minMatchesForMerge || 5,
            maxMergeDistance: options.maxMergeDistance || 40,
            confidenceBoost: options.confidenceBoost || 1.3,
            enableGraphIsomorphism: true,
            ...options
        };

        console.log(`🔧 TopologyMerger создан: structuralSimilarityThreshold=${this.config.structuralSimilarityThreshold}`);
    }

    // 1. ОСНОВНОЙ МЕТОД: ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ ДВУХ ГРАФОВ
    mergeGraphs(graph1, graph2, transformation = null) {
        console.log(`🏗️ Топологическое слияние структур...`);
        console.log(`   Граф 1: ${graph1.nodes.size} узлов, ${graph1.edges.size} рёбер`);
        console.log(`   Граф 2: ${graph2.nodes.size} узлов, ${graph2.edges.size} рёбер`);

        // 1. ПРЕОБРАЗОВАНИЕ В ВЕКТОРНЫЕ СХЕМЫ
        const vectorGraph1 = this.graphToVectorGraph(graph1);
        const vectorGraph2 = this.graphToVectorGraph(graph2);

        // 2. НАЙТИ СТРУКТУРНЫЕ СООТВЕТСТВИЯ
        const structuralMatches = this.findStructuralMatches(vectorGraph1, vectorGraph2);

        console.log(`🔍 Найдено структурных соответствий: ${structuralMatches.length}`);

        if (structuralMatches.length < this.config.minMatchesForMerge) {
            console.log(`⚠️ Слишком мало структурных соответствий (${structuralMatches.length} < ${this.config.minMatchesForMerge})`);
            return this.fallbackToPointMerge(graph1, graph2, transformation);
        }

        // 3. РАССЧИТАТЬ СТРУКТУРНУЮ СХОЖЕСТЬ
        const structuralSimilarity = this.calculateStructuralSimilarity(
            vectorGraph1, vectorGraph2, structuralMatches
        );

        console.log(`📊 Структурная схожесть: ${structuralSimilarity.toFixed(3)}`);

        if (structuralSimilarity < this.config.structuralSimilarityThreshold) {
            console.log(`⚠️ Низкая структурная схожесть (${structuralSimilarity.toFixed(3)} < ${this.config.structuralSimilarityThreshold})`);
            return this.fallbackToPointMerge(graph1, graph2, transformation);
        }

        // 4. НАЙТИ ТРАНСФОРМАЦИЮ НА ОСНОВЕ СТРУКТУРНЫХ СООТВЕТСТВИЙ
        const structuralTransformation = this.findStructuralTransformation(
            graph1, graph2, structuralMatches
        );

        // 5. ВЫПОЛНИТЬ ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ
        const mergeResult = this.performTopologicalMerge(
            graph1, graph2, structuralMatches, structuralTransformation
        );

        // 6. РАССЧИТАТЬ МЕТРИКИ
        const metrics = this.calculateTopologyMetrics(
            graph1, graph2, mergeResult, structuralSimilarity
        );

        console.log(`✅ Топологическое слияние успешно!`);
        console.log(`   📊 Сохранено структур: ${metrics.preservedStructures}%`);
        console.log(`   🏗️ Улучшение топологии: ${metrics.topologyImprovement}%`);
        console.log(`   🔗 Слито узлов: ${mergeResult.mergedNodes}`);

        return {
        success: true,
        mergedGraph: mergeResult.mergedGraph,
        structuralMatches: structuralMatches,
        structuralSimilarity: structuralSimilarity,
        transformation: structuralTransformation,
        metrics: {  // 🔴 ДОБАВИТЬ ЭТО
            preservedStructures: metrics.preservedStructures || 0,
            topologyImprovement: metrics.topologyImprovement || 0,
            method: 'topology_merge',
            edgePreservation: metrics.edgePreservation || 0,
            efficiency: metrics.efficiency || 0,
            nodeReduction: metrics.nodeReduction || 0
        },
        stats: mergeResult.stats
    };
    }

    // 2. ПРЕОБРАЗОВАНИЕ ГРАФА В ВЕКТОРНУЮ СХЕМУ
    graphToVectorGraph(graph) {
        const points = [];
        const nodeMap = new Map();

        // Преобразовать узлы графа в точки
        let index = 0;
        for (const [nodeId, node] of graph.nodes) {
            points.push({
                x: node.x,
                y: node.y,
                confidence: node.confidence || 0.5,
                nodeId: nodeId,
                edges: []
            });
            nodeMap.set(nodeId, index);
            index++;
        }

        // Добавить информацию о рёбрах
        for (const [edgeId, edge] of graph.edges) {
            const fromIdx = nodeMap.get(edge.from);
            const toIdx = nodeMap.get(edge.to);

            if (fromIdx !== undefined && toIdx !== undefined) {
                if (!points[fromIdx].edges) points[fromIdx].edges = [];
                if (!points[toIdx].edges) points[toIdx].edges = [];

                points[fromIdx].edges.push(toIdx);
                points[toIdx].edges.push(fromIdx);
            }
        }

        // Создать векторную схему
        const vectorGraph = new VectorGraph({ points: points });
        vectorGraph.createFromPoints(points);

        return vectorGraph;
    }

    // 3. ПОИСК СТРУКТУРНЫХ СООТВЕТСТВИЙ
    findStructuralMatches(vectorGraph1, vectorGraph2) {
        const matches = [];

        if (!vectorGraph1.starVectors || !vectorGraph2.starVectors) {
            return matches;
        }

        // 🔍 Использовать графовые инварианты для поиска соответствий
        const nodeSignatures1 = this.calculateNodeSignatures(vectorGraph1);
        const nodeSignatures2 = this.calculateNodeSignatures(vectorGraph2);

        const usedIndices2 = new Set();

        // Для каждого узла в первом графе найти лучший match во втором
        for (let i = 0; i < nodeSignatures1.length; i++) {
            const sig1 = nodeSignatures1[i];
            let bestMatchIdx = -1;
            let bestScore = 0;

            for (let j = 0; j < nodeSignatures2.length; j++) {
                if (usedIndices2.has(j)) continue;

                const sig2 = nodeSignatures2[j];
                const score = this.compareNodeSignatures(sig1, sig2);

                if (score > bestScore && score > 0.6) {
                    bestScore = score;
                    bestMatchIdx = j;
                }
            }

            if (bestMatchIdx !== -1 && bestScore > 0.6) {
                matches.push({
                    node1: i,
                    node2: bestMatchIdx,
                    score: bestScore,
                    signatureSimilarity: bestScore
                });
                usedIndices2.add(bestMatchIdx);
            }
        }

        return matches;
    }

    // 4. РАСЧЁТ СИГНАТУР УЗЛОВ (инварианты)
    calculateNodeSignatures(vectorGraph) {
        const signatures = [];

        for (const starVector of vectorGraph.starVectors) {
            if (!starVector || !starVector.signature) continue;

            const signature = {
                // Геометрические характеристики
                position: { x: starVector.point.x, y: starVector.point.y },

                // Структурные характеристики
                degree: starVector.vectors ? starVector.vectors.length : 0,
                angleHistogram: starVector.signature.angleHistogram || [],
                distanceHistogram: starVector.signature.distanceHistogram || [],

                // Локальная топология
                neighborAngles: [],
                neighborDistances: []
            };

            // Расчитать углы и расстояния до соседей
            if (starVector.vectors && starVector.vectors.length > 0) {
                starVector.vectors.forEach(v => {
                    signature.neighborAngles.push(v.angle);
                    signature.neighborDistances.push(v.distance);
                });

                // Нормализовать
                signature.neighborAngles = this.normalizeAngles(signature.neighborAngles);
                signature.neighborDistances = this.normalizeDistances(signature.neighborDistances);
            }

            signatures.push(signature);
        }

        return signatures;
    }

    // 5. СРАВНЕНИЕ СИГНАТУР УЗЛОВ
    compareNodeSignatures(sig1, sig2) {
        let totalScore = 0;
        let weightSum = 0;

        // 1. Сравнить гистограммы углов (вес 0.4)
        if (sig1.angleHistogram && sig2.angleHistogram) {
            const angleScore = this.compareHistograms(sig1.angleHistogram, sig2.angleHistogram);
            totalScore += angleScore * 0.4;
            weightSum += 0.4;
        }

        // 2. Сравнить гистограммы расстояний (вес 0.3)
        if (sig1.distanceHistogram && sig2.distanceHistogram) {
            const distanceScore = this.compareHistograms(sig1.distanceHistogram, sig2.distanceHistogram);
            totalScore += distanceScore * 0.3;
            weightSum += 0.3;
        }

        // 3. Сравнить степени (вес 0.3)
        const degreeDiff = Math.abs(sig1.degree - sig2.degree);
        const degreeScore = Math.max(0, 1 - degreeDiff / 10); // Нормализовать
        totalScore += degreeScore * 0.3;
        weightSum += 0.3;

        return weightSum > 0 ? totalScore / weightSum : 0;
    }

    // 6. СРАВНЕНИЕ ГИСТОГРАММ
    compareHistograms(hist1, hist2) {
        if (!hist1 || !hist2 || hist1.length !== hist2.length) {
            return 0;
        }

        let similarity = 0;
        for (let i = 0; i < hist1.length; i++) {
            similarity += 1 - Math.abs(hist1[i] - hist2[i]);
        }

        return similarity / hist1.length;
    }

    // 7. РАСЧЁТ СТРУКТУРНОЙ СХОЖЕСТИ
    calculateStructuralSimilarity(vectorGraph1, vectorGraph2, matches) {
        if (matches.length === 0) return 0;

        // 1. Score совпадений
        const matchScore = matches.reduce((sum, m) => sum + m.score, 0) / matches.length;

        // 2. Соотношение совпадений к общему числу узлов
        const coverage = matches.length / Math.min(
            vectorGraph1.starVectors.length,
            vectorGraph2.starVectors.length
        );

        // 3. Сохранение локальной топологии
        const topologyPreservation = this.calculateTopologyPreservation(vectorGraph1, vectorGraph2, matches);

        // Комбинированный score
        return matchScore * 0.5 + coverage * 0.3 + topologyPreservation * 0.2;
    }

    // 8. СОХРАНЕНИЕ ТОПОЛОГИИ
    calculateTopologyPreservation(vectorGraph1, vectorGraph2, matches) {
        if (matches.length < 2) return 1;

        let preservedRelations = 0;
        let totalRelations = 0;

        // Проверить сохранение отношений соседства
        for (const match1 of matches) {
            for (const match2 of matches) {
                if (match1.node1 === match2.node1) continue;

                // Есть ли ребро между node1 и node2 в первом графе?
                const hasEdge1 = this.hasEdgeBetween(vectorGraph1, match1.node1, match2.node1);

                // Есть ли ребро между соответствующими узлами во втором графе?
                const hasEdge2 = this.hasEdgeBetween(vectorGraph2, match1.node2, match2.node2);

                totalRelations++;

                if (hasEdge1 === hasEdge2) {
                    preservedRelations++;
                }
            }
        }

        return totalRelations > 0 ? preservedRelations / totalRelations : 1;
    }

    // 9. ПРОВЕРКА НАЛИЧИЯ РЁБРА
    hasEdgeBetween(vectorGraph, nodeIdx1, nodeIdx2) {
        const starVector = vectorGraph.starVectors[nodeIdx1];
        if (!starVector || !starVector.vectors) return false;

        return starVector.vectors.some(v => v.toPoint === nodeIdx2);
    }

    // 10. ТРАНСФОРМАЦИЯ НА ОСНОВЕ СТРУКТУРЫ
    findStructuralTransformation(graph1, graph2, matches) {
        if (matches.length < 3) {
            return {
                type: 'insufficient_points',
                translation: { dx: 0, dy: 0 },
                rotation: 0,
                scale: 1,
                confidence: 0.5
            };
        }

        // Использовать лучшие совпадения для точности
        const bestMatches = matches
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.min(5, matches.length));

        // Получить координаты совпадающих точек
        const points1 = [];
        const points2 = [];

        const nodes1 = Array.from(graph1.nodes.values());
        const nodes2 = Array.from(graph2.nodes.values());

        bestMatches.forEach(match => {
            const node1 = nodes1[match.node1];
            const node2 = nodes2[match.node2];

            if (node1 && node2) {
                points1.push({ x: node1.x, y: node1.y });
                points2.push({ x: node2.x, y: node2.y });
            }
        });

        if (points1.length < 3) {
            return {
                type: 'translation_only',
                translation: this.calculateTranslation(points1, points2),
                rotation: 0,
                scale: 1,
                confidence: 0.6
            };
        }

        // Рассчитать полную трансформацию
        return this.calculateRigidTransformation(points1, points2);
    }

    // 11. РАСЧЁТ ПРОСТОГО СМЕЩЕНИЯ
    calculateTranslation(points1, points2) {
        if (points1.length === 0 || points2.length === 0) {
            return { dx: 0, dy: 0 };
        }

        // Простое среднее смещение
        let sumDx = 0, sumDy = 0;
        const n = Math.min(points1.length, points2.length);

        for (let i = 0; i < n; i++) {
            sumDx += points2[i].x - points1[i].x;
            sumDy += points2[i].y - points1[i].y;
        }

        return {
            dx: sumDx / n,
            dy: sumDy / n
        };
    }

    // 12. РАСЧЁТ ЖЁСТКОЙ ТРАНСФОРМАЦИИ
    calculateRigidTransformation(points1, points2) {
        // Упрощённый алгоритм Procrustes
        if (points1.length !== points2.length || points1.length < 3) {
            return this.calculateTranslation(points1, points2);
        }

        // Центры масс
        const center1 = this.calculateCenter(points1);
        const center2 = this.calculateCenter(points2);

        // Смещение
        const translation = {
            dx: center2.x - center1.x,
            dy: center2.y - center1.y
        };

        // Упрощённый расчёт поворота
        let rotation = 0;
        let scale = 1;

        // Попарные векторы для оценки поворота
        let angleSum = 0;
        let angleCount = 0;

        for (let i = 0; i < points1.length - 1; i++) {
            for (let j = i + 1; j < points1.length; j++) {
                const vec1 = {
                    x: points1[j].x - points1[i].x,
                    y: points1[j].y - points1[i].y
                };

                const vec2 = {
                    x: points2[j].x - points2[i].x,
                    y: points2[j].y - points2[i].y
                };

                const angle1 = Math.atan2(vec1.y, vec1.x);
                const angle2 = Math.atan2(vec2.y, vec2.x);
                const angleDiff = angle2 - angle1;

                angleSum += angleDiff;
                angleCount++;

                // Оценить масштаб
                const len1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
                const len2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

                if (len1 > 0) {
                    scale += len2 / len1;
                }
            }
        }

        if (angleCount > 0) {
            rotation = angleSum / angleCount * (180 / Math.PI); // В градусы
            scale = scale / (angleCount + 1);
        }

        // Уверенность на основе количества и качества совпадений
        const confidence = Math.min(0.95, 0.5 + (points1.length / 10) * 0.1);

        return {
            type: 'rigid',
            translation: translation,
            rotation: rotation,
            scale: scale,
            confidence: confidence
        };
    }

    // 13. ВЫЧИСЛЕНИЕ ЦЕНТРА
    calculateCenter(points) {
        const sum = points.reduce((acc, p) => {
            acc.x += p.x;
            acc.y += p.y;
            return acc;
        }, { x: 0, y: 0 });

        return {
            x: sum.x / points.length,
            y: sum.y / points.length
        };
    }

    // 14. ВЫПОЛНЕНИЕ ТОПОЛОГИЧЕСКОГО СЛИЯНИЯ
performTopologicalMerge(graph1, graph2, matches, transformation) {
    const mergedNodes = new Map();
    const mergedEdges = new Map();

    const nodes1 = Array.from(graph1.nodes.values());
    const nodes2 = Array.from(graph2.nodes.values());

    let nextNodeId = 0;
    const mergedNodesList = [];
    const mergedEdgesList = [];

    // 1. СЛИТЬ СОВПАДАЮЩИЕ УЗЛЫ
    const mergedIndices1 = new Set();
    const mergedIndices2 = new Set();

    matches.forEach(match => {
        const node1 = nodes1[match.node1];
        const node2 = nodes2[match.node2];

        if (!node1 || !node2) return;

        // Применить трансформацию ко второму узлу
        const transformedNode2 = this.applyTransformationToNode(node2, transformation);

        // Слить узлы
        const mergedNode = this.mergeTwoNodes(node1, transformedNode2, match.score);

        const nodeId = `merged_${nextNodeId++}`;
        mergedNodes.set(nodeId, mergedNode);
        mergedNodesList.push(mergedNode);

        mergedIndices1.add(match.node1);
        mergedIndices2.add(match.node2);
    });

    // 2. ДОБАВИТЬ УНИКАЛЬНЫЕ УЗЛЫ ИЗ ПЕРВОГО ГРАФА
    nodes1.forEach((node, idx) => {
        if (mergedIndices1.has(idx)) return;

        const nodeId = `unique1_${nextNodeId++}`;
        const uniqueNode = { ...node, source: 'graph1', confidence: node.confidence || 0.5 };
        mergedNodes.set(nodeId, uniqueNode);
        mergedNodesList.push(uniqueNode);
    });

    // 3. ДОБАВИТЬ УНИКАЛЬНЫЕ УЗЛЫ ИЗ ВТОРОГО ГРАФА
    nodes2.forEach((node, idx) => {
        if (mergedIndices2.has(idx)) return;

        const transformedNode = this.applyTransformationToNode(node, transformation);
        const nodeId = `unique2_${nextNodeId++}`;
        const uniqueNode = {
            ...transformedNode,
            source: 'graph2',
            confidence: node.confidence || 0.5
        };
        mergedNodes.set(nodeId, uniqueNode);
        mergedNodesList.push(uniqueNode);
    });

    // 4. ПОСТРОИТЬ РЁБРА
    this.reconstructEdgesFromMergedNodes(mergedNodesList, mergedEdges, matches, graph1, graph2);

    // 5. СОЗДАТЬ ОБЪЕДИНЁННЫЙ ГРАФ
const SimpleGraph = require('./simple-graph');
const mergedGraph = new SimpleGraph("Топологически объединённый граф");

console.log(`🔗 Создаю объединённый граф...`);
console.log(`   Узлов для добавления: ${mergedNodes.size}`);
console.log(`   Рёбер для добавления: ${mergedEdges.size}`);

// Карта соответствия: node_index -> actual_node_id
const nodeIndexToId = new Map();

// 5.1 ДОБАВИТЬ УЗЛЫ С ПРАВИЛЬНЫМИ ID
let nodeIndex = 0;
mergedNodes.forEach((node, oldId) => {
    // SimpleGraph создаёт узлы с ID формата "n1", "n2", "n3"...
    const newNodeId = `n${nodeIndex + 1}`;
    nodeIndexToId.set(nodeIndex, newNodeId);
    nodeIndex++;

    mergedGraph.addNode({
        id: newNodeId, // Важно: "nX" для совместимости с SimpleGraph
        x: node.x,
        y: node.y,
        confidence: node.confidence,
        source: node.source,
        originalId: oldId
    });
});

console.log(`✅ Добавлено узлов: ${mergedGraph.nodes.size}`);
console.log(`🔍 Первые 5 ID узлов: ${Array.from(mergedGraph.nodes.keys()).slice(0, 5).join(', ')}`);

// 5.2 ДОБАВИТЬ РЁБРА С ПРАВИЛЬНЫМИ ССЫЛКАМИ
let edgesAdded = 0;
let edgesFailed = 0;

mergedEdges.forEach((edge, edgeId) => {
    // Извлечь индексы из строк "node_X"
    const fromMatch = edge.from.match(/node_(\d+)/);
    const toMatch = edge.to.match(/node_(\d+)/);

    if (fromMatch && toMatch) {
        const fromIndex = parseInt(fromMatch[1]);
        const toIndex = parseInt(toMatch[1]);

        const fromId = nodeIndexToId.get(fromIndex); // Получим "nX"
        const toId = nodeIndexToId.get(toIndex);     // Получим "nY"

        if (fromId && toId && fromId !== toId) {
            // 🔴 ИСПРАВЛЕНИЕ: SimpleGraph.addEdge ожидает ДВА параметра: nodeId1, nodeId2
            const success = mergedGraph.addEdge(fromId, toId);
           
            if (success) {
                edgesAdded++;
                if (edgesAdded <= 5) {
                    console.log(`   ✅ Добавлено ребро ${edgesAdded}: ${fromId} -> ${toId}`);
                }
            } else {
                console.log(`⚠️ Не удалось добавить ребро: ${fromId} -> ${toId} (уже существует)`);
                edgesFailed++;
            }
        } else {
            console.log(`⚠️ Неверные ID для ребра: ${edge.from}(${fromId}) -> ${edge.to}(${toId})`);
            edgesFailed++;
        }
    } else {
        console.log(`⚠️ Неправильный формат ребра: ${edge.from} -> ${edge.to}`);
        edgesFailed++;
    }
});

console.log(`🔗 Добавлено рёбер: ${edgesAdded} (ошибок: ${edgesFailed})`);
console.log(`📊 Итог графа: ${mergedGraph.nodes.size} узлов, ${mergedGraph.edges.size} рёбер`);

// 🔴 ПРОВЕРКА И ОТЛАДКА
if (mergedGraph.edges.size === 0 && edgesAdded > 0) {
    console.log(`🚨 ПРОБЛЕМА: Рёбра не отображаются в графе!`);
    console.log(`   Вызовов addEdge успешных: ${edgesAdded}`);
    console.log(`   Но в графе: ${mergedGraph.edges.size} рёбер`);
   
    // Проверить метод addEdge напрямую
    console.log(`   🔍 ТЕСТ: проверяю метод addEdge...`);
    const nodeIds = Array.from(mergedGraph.nodes.keys());
    if (nodeIds.length >= 2) {
        console.log(`   Тестовые узлы: ${nodeIds[0]}, ${nodeIds[1]}`);
       
        // Попробовать добавить тестовое ребро
        const testSuccess = mergedGraph.addEdge(nodeIds[0], nodeIds[1]);
        console.log(`   Результат testSuccess: ${testSuccess}`);
        console.log(`   Рёбер после теста: ${mergedGraph.edges.size}`);
       
        // Проверить содержимое edges
        console.log(`   Ключи в edges: ${Array.from(mergedGraph.edges.keys()).slice(0, 3).join(', ')}`);
    }
}

return {
    mergedGraph: mergedGraph,
    mergedNodes: matches.length,
    totalNodes: mergedNodes.size,
    stats: {
        mergedNodes: matches.length,
        uniqueFrom1: nodes1.length - mergedIndices1.size,
        uniqueFrom2: nodes2.length - mergedIndices2.size,
        totalEdges: mergedEdges.size,
        edgesAddedToGraph: edgesAdded,
        edgesFailed: edgesFailed,
        topologyPreserved: this.calculateTopologyPreservationScore(graph1, graph2, matches)
    }
};
}

    // 15. СЛИЯНИЕ ДВУХ УЗЛОВ
    mergeTwoNodes(node1, node2, similarityScore) {
        // Взвешенное среднее с учётом confidence и similarity
        const conf1 = node1.confidence || 0.5;
        const conf2 = node2.confidence || 0.5;

        const weight1 = conf1 * similarityScore;
        const weight2 = conf2 * similarityScore;
        const totalWeight = weight1 + weight2 || 1;

        const mergedConfidence = Math.min(1.0,
            ((conf1 * weight1 + conf2 * weight2) / totalWeight) * this.config.confidenceBoost
        );

        return {
            x: (node1.x * weight1 + node2.x * weight2) / totalWeight,
            y: (node1.y * weight1 + node2.y * weight2) / totalWeight,
            confidence: Math.max(0.0, Math.min(1.0, mergedConfidence)),
            source: 'merged',
            mergedFrom: [node1.id || 'node1', node2.id || 'node2'],
            similarityScore: similarityScore,
            originalConfidences: [conf1, conf2]
        };
    }

    // 16. ПРИМЕНЕНИЕ ТРАНСФОРМАЦИИ К УЗЛУ
    applyTransformationToNode(node, transformation) {
        if (!transformation || transformation.type === 'insufficient_points') {
            return { ...node };
        }

        let x = node.x;
        let y = node.y;

        if (transformation.translation) {
            x += transformation.translation.dx || 0;
            y += transformation.translation.dy || 0;
        }

        if (transformation.rotation && transformation.rotation !== 0) {
            const rad = transformation.rotation * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const newX = x * cos - y * sin;
            const newY = x * sin + y * cos;
            x = newX;
            y = newY;
        }

        if (transformation.scale && transformation.scale !== 1) {
            x *= transformation.scale;
            y *= transformation.scale;
        }

        return {
            ...node,
            x: x,
            y: y,
            transformed: true
        };
    }

    // 17. ВОССТАНОВЛЕНИЕ РЁБЕР

  reconstructEdgesFromMergedNodes(nodes, edgesMap, matches, originalGraph1, originalGraph2) {
    console.log(`🔗 Реконструкция рёбер для ${nodes.length} узлов...`);
    console.log(`   Оригинальные рёбра: graph1=${originalGraph1.edges.size}, graph2=${originalGraph2.edges.size}`);
   
    // 🔴 ПРОСТОЙ ТЕСТ: создать рёбра между всеми узлами, которые близко
    let edgeId = 0;
    let edgesCreated = 0;
   
    // Простая логика: соединить каждый узел с ближайшими 3 соседями
    for (let i = 0; i < nodes.length; i++) {
        const distances = [];
       
        for (let j = 0; j < nodes.length; j++) {
            if (i === j) continue;
           
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
           
            distances.push({ index: j, distance });
        }
       
        // Отсортировать по расстоянию
        distances.sort((a, b) => a.distance - b.distance);
       
        // Соединить с ближайшими 3
        for (let k = 0; k < Math.min(3, distances.length); k++) {
            const j = distances[k].index;
           
            // Проверить, нет ли уже такого ребра
            const edgeExists = Array.from(edgesMap.values()).some(e =>
                (e.from === `node_${i}` && e.to === `node_${j}`) ||
                (e.from === `node_${j}` && e.to === `node_${i}`)
            );
           
            if (!edgeExists) {
                const edgeIdStr = `edge_${edgeId++}`;
                edgesMap.set(edgeIdStr, {
                    from: `node_${i}`,
                    to: `node_${j}`,
                    weight: 1.0,
                    distance: distances[k].distance,
                    source: 'auto_generated'
                });
                edgesCreated++;
            }
        }
    }
   
    console.log(`   Создано рёбер: ${edgesCreated}`);
    console.log(`   В edgesMap: ${edgesMap.size} рёбер`);
   
    // 🔴 ДОБАВИТЬ: показать первые несколько рёбер
    const firstEdges = Array.from(edgesMap.values()).slice(0, 5);
    console.log(`   Примеры рёбер: ${JSON.stringify(firstEdges)}`);
}

    // 18. РАСЧЁТ ВЕСА РЁБРА
    calculateEdgeWeight(node1, node2, distance) {
        let weight = 1 - (distance / (this.config.maxMergeDistance * 2));

        // Усилить вес, если узлы из одного источника
        if (node1.source === node2.source && node1.source !== 'merged') {
            weight *= 1.2;
        }

        // Усилить вес для слитых узлов
        if (node1.source === 'merged' && node2.source === 'merged') {
            weight *= 1.5;
        }

        return Math.max(0, Math.min(1, weight));
    }

    // 19. ЗАПАСНОЙ ВАРИАНТ: ГЕОМЕТРИЧЕСКОЕ СЛИЯНИЕ
    fallbackToPointMerge(graph1, graph2, transformation) {
        console.log(`🔄 Использую геометрическое слияние как запасной вариант...`);

        // Преобразовать графы в точки
        const points1 = Array.from(graph1.nodes.values()).map(node => ({
            x: node.x,
            y: node.y,
            confidence: node.confidence || 0.5
        }));

        const points2 = Array.from(graph2.nodes.values()).map(node => ({
            x: node.x,
            y: node.y,
            confidence: node.confidence || 0.5
        }));

        // Использовать старый PointMerger
        const PointMerger = require('./point-merger');
        const pointMerger = new PointMerger({
            mergeDistance: this.config.maxMergeDistance
        });

        const mergeResult = pointMerger.mergePoints(points1, points2, transformation);

        // Преобразовать обратно в граф
        const SimpleGraph = require('./simple-graph');
        const mergedGraph = new SimpleGraph("Геометрически объединённый граф");

        mergeResult.points.forEach((point, index) => {
            mergedGraph.addNode({
                id: `node_${index}`,
                x: point.x,
                y: point.y,
                confidence: point.confidence,
                source: point.source || 'point_merge'
            });
        });

        return {
            success: true,
            mergedGraph: mergedGraph,
            structuralMatches: [],
            structuralSimilarity: 0,
            transformation: transformation,
            metrics: {
                preservedStructures: 0,
                topologyImprovement: 0,
                method: 'geometric_fallback'
            },
            stats: mergeResult.stats
        };
    }

    // 20. МЕТРИКИ ТОПОЛОГИИ
    calculateTopologyMetrics(graph1, graph2, mergeResult, structuralSimilarity) {
        const originalEdges1 = graph1.edges.size;
        const originalEdges2 = graph2.edges.size;
        const mergedEdges = mergeResult.mergedGraph.edges.size;

        const maxPossibleEdges = originalEdges1 + originalEdges2;
        const edgePreservation = maxPossibleEdges > 0
            ? (mergedEdges / maxPossibleEdges) * 100
            : 100;

        const originalNodes1 = graph1.nodes.size;
        const originalNodes2 = graph2.nodes.size;
        const mergedNodes = mergeResult.mergedGraph.nodes.size;

        const nodeReduction = originalNodes1 + originalNodes2 - mergedNodes;
        const efficiency = originalNodes1 + originalNodes2 > 0
            ? (nodeReduction / (originalNodes1 + originalNodes2)) * 100
            : 0;

        return {
            preservedStructures: Math.round(edgePreservation),
            topologyImprovement: Math.round(structuralSimilarity * 100),
            nodeReduction: nodeReduction,
            efficiency: efficiency.toFixed(1),
            edgePreservation: edgePreservation.toFixed(1),
            structuralSimilarity: structuralSimilarity.toFixed(3)
        };
    }

    // 21. ОЦЕНКА СОХРАНЕНИЯ ТОПОЛОГИИ
    calculateTopologyPreservationScore(graph1, graph2, matches) {
        if (matches.length < 2) return 100;

        let preserved = 0;
        let total = 0;

        // Проверить сохранение локальной структуры
        const nodes1 = Array.from(graph1.nodes.values());
        const nodes2 = Array.from(graph2.nodes.values());

        for (let i = 0; i < matches.length; i++) {
            for (let j = i + 1; j < matches.length; j++) {
                const match1 = matches[i];
                const match2 = matches[j];

                // Были ли узлы связаны в оригинальных графах?
                const connectedIn1 = this.areNodesConnected(graph1, match1.node1, match2.node1);
                const connectedIn2 = this.areNodesConnected(graph2, match1.node2, match2.node2);

                total++;
                if (connectedIn1 === connectedIn2) {
                    preserved++;
                }
            }
        }

        return total > 0 ? (preserved / total) * 100 : 100;
    }

    // 22. ПРОВЕРКА СВЯЗИ МЕЖДУ УЗЛАМИ
    areNodesConnected(graph, nodeIdx1, nodeIdx2) {
        const nodes = Array.from(graph.nodes.keys());
        const nodeId1 = nodes[nodeIdx1];
        const nodeId2 = nodes[nodeIdx2];

        if (!nodeId1 || !nodeId2) return false;

        // Проверить все рёбра
        for (const [_, edge] of graph.edges) {
            if ((edge.from === nodeId1 && edge.to === nodeId2) ||
                (edge.from === nodeId2 && edge.to === nodeId1)) {
                return true;
            }
        }

        return false;
    }

    // 23. НОРМАЛИЗАЦИЯ УГЛОВ
    normalizeAngles(angles) {
        if (angles.length === 0) return [];

        // Привести к диапазону [0, 2π)
        return angles.map(angle => {
            let normalized = angle % (2 * Math.PI);
            if (normalized < 0) normalized += 2 * Math.PI;
            return normalized;
        });
    }

    // 24. НОРМАЛИЗАЦИЯ РАССТОЯНИЙ
    normalizeDistances(distances) {
        if (distances.length === 0) return [];

        const maxDist = Math.max(...distances);
        if (maxDist === 0) return distances.map(() => 0);

        return distances.map(d => d / maxDist);
    }

    // 25. ПОКАЗАТЬ ИНФОРМАЦИЮ
    visualizeMergeInfo(graph1, graph2, mergeResult) {
        console.log(`\n🏗️ ИНФОРМАЦИЯ О ТОПОЛОГИЧЕСКОМ СЛИЯНИИ:`);
        console.log(`├─ Граф 1: ${graph1.nodes.size} узлов, ${graph1.edges.size} рёбер`);
        console.log(`├─ Граф 2: ${graph2.nodes.size} узлов, ${graph2.edges.size} рёбер`);
        console.log(`├─ Объединённый: ${mergeResult.mergedGraph.nodes.size} узлов, ${mergeResult.mergedGraph.edges.size} рёбер`);
        console.log(`├─ Структурных соответствий: ${mergeResult.structuralMatches.length}`);
        console.log(`├─ Структурная схожесть: ${mergeResult.structuralSimilarity.toFixed(3)}`);
        console.log(`├─ Сохранение топологии: ${mergeResult.metrics.preservedStructures}%`);
        console.log(`└─ Улучшение топологии: ${mergeResult.metrics.topologyImprovement}%`);

        if (mergeResult.metrics.method === 'geometric_fallback') {
            console.log(`⚠️ Использовано геометрическое слияние (запасной вариант)`);
        }
    }

    // 🔴 Быстрое интегрированное слияние (ДОБАВЛЕНО ПО ИНСТРУКЦИИ)
    static async quickIntegratedMerge(graph1, graph2, transformation = null) {
        const TopologyIntegration = require('./topology-integration');
        const integration = new TopologyIntegration({
            enableTopologyRefinement: true,
            enableValidation: false
        });

        return await integration.fullTopologyMerge(graph1, graph2, transformation);
    }
}

module.exports = TopologyMerger;
