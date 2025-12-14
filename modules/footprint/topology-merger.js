// modules/footprint/topology-merger.js
// ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ СТРУКТУР (УСИЛЕННАЯ ВЕРСИЯ)

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
            matchScoreThreshold: 0.75, // 🔴 ПОВЫШЕННЫЙ ПОРОГ
            enableReciprocalCheck: true, // 🔴 ВКЛЮЧИТЬ ВЗАИМНУЮ ПРОВЕРКУ
            enableGeometricConsistency: true, // 🔴 ВКЛЮЧИТЬ ГЕОМЕТРИЧЕСКУЮ ПРОВЕРКУ
            kNearestNeighbors: 3, // 🔴 КОЛИЧЕСТВО СОСЕДЕЙ ДЛЯ ПРОВЕРКИ
            ...options
        };

        console.log(`🔧 TopologyMerger создан: matchScoreThreshold=${this.config.matchScoreThreshold}`);
    }

    // 1. ОСНОВНОЙ МЕТОД: ТОПОЛОГИЧЕСКОЕ СЛИЯНИЕ ДВУХ ГРАФОВ
    mergeGraphs(graph1, graph2, transformation = null) {
        console.log(`🏗️ Топологическое слияние структур...`);
        console.log(`   Граф 1: ${graph1.nodes.size} узлов, ${graph1.edges.size} рёбер`);
        console.log(`   Граф 2: ${graph2.nodes.size} узлов, ${graph2.edges.size} рёбер`);

        // 1. ПРЕОБРАЗОВАНИЕ В ВЕКТОРНЫЕ СХЕМЫ
        const vectorGraph1 = this.graphToVectorGraph(graph1);
        const vectorGraph2 = this.graphToVectorGraph(graph2);

        // 2. НАЙТИ СТРУКТУРНЫЕ СООТВЕТСТВИЯ (УСИЛЕННЫЙ АЛГОРИТМ)
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
        console.log(`   📊 Сохранено структур: ${metrics.preservedStructures}%`);
        console.log(`   🏗️ Улучшение топологии: ${metrics.topologyImprovement}%`);
        console.log(`   🔗 Слито узлов: ${mergeResult.mergedNodes}`);

        return {
            success: true,
            mergedGraph: mergeResult.mergedGraph,
            structuralMatches: structuralMatches,
            structuralSimilarity: structuralSimilarity,
            transformation: structuralTransformation,
            metrics: {
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

    // 2. ПРЕОБРАЗОВАНИЕ ГРАФА В ВЕКТОРНУЮ СХЕМУ (С СОХРАНЕНИЕМ СВЯЗЕЙ)
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
                edges: [],
                originalNode: node // 🔴 СОХРАНИТЬ ССЫЛКУ НА ОРИГИНАЛЬНЫЙ УЗЕЛ
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

        // 🔴 СОХРАНИТЬ КАРТУ СООТВЕТСТВИЙ: индекс VectorGraph -> ID узла
        vectorGraph.indexToNodeId = new Map();
        let idx = 0;
        for (const [nodeId, node] of graph.nodes) {
            vectorGraph.indexToNodeId.set(idx, nodeId);
            idx++;
        }

        return vectorGraph;
    }

    // 3. УСИЛЕННЫЙ ПОИСК СТРУКТУРНЫХ СООТВЕТСТВИЙ
    findStructuralMatches(vectorGraph1, vectorGraph2) {
        console.log(`🔍 Поиск структурных соответствий с взаимной проверкой...`);

        if (!vectorGraph1.starVectors || !vectorGraph2.starVectors) {
            return [];
        }

        // 🔴 ШАГ 1: РАССЧИТАТЬ УСИЛЕННЫЕ СИГНАТУРЫ
        const nodeSignatures1 = this.calculateEnhancedSignatures(vectorGraph1);
        const nodeSignatures2 = this.calculateEnhancedSignatures(vectorGraph2);

        // 🔴 ШАГ 2: НАЙТИ ВСЕ КАНДИДАТЫ ВЫШЕ ПОРОГА
        const candidateMatches = [];

        for (let i = 0; i < nodeSignatures1.length; i++) {
            const sig1 = nodeSignatures1[i];
            let bestMatchIdx = -1;
            let bestScore = 0;

            for (let j = 0; j < nodeSignatures2.length; j++) {
                const sig2 = nodeSignatures2[j];
                const score = this.compareEnhancedSignatures(sig1, sig2);

                if (score > bestScore && score > this.config.matchScoreThreshold) {
                    bestScore = score;
                    bestMatchIdx = j;
                }
            }

            if (bestMatchIdx !== -1 && bestScore > this.config.matchScoreThreshold) {
                // 🔴 ДОБАВИТЬ ПРОВЕРКУ ГЕОМЕТРИЧЕСКОЙ СОГЛАСОВАННОСТИ
                let geometricScore = 1.0;
                if (this.config.enableGeometricConsistency) {
                    geometricScore = this.checkGeometricConsistency(
                        i, bestMatchIdx, vectorGraph1, vectorGraph2
                    );
                }

                // 🔴 КОМБИНИРОВАННЫЙ SCORE
                const combinedScore = bestScore * 0.7 + geometricScore * 0.3;

                if (combinedScore > this.config.matchScoreThreshold) {
                    candidateMatches.push({
                        i: i,
                        j: bestMatchIdx,
                        score: combinedScore,
                        signatureScore: bestScore,
                        geometricScore: geometricScore
                    });
                }
            }
        }

        console.log(`📊 Найдено кандидатов: ${candidateMatches.length}`);

        // 🔴 ШАГ 3: ВЗАИМНАЯ ПРОВЕРКА (BIJECTIVE MATCHING)
        const matches = [];
        const usedIndices1 = new Set();
        const usedIndices2 = new Set();

        if (this.config.enableReciprocalCheck) {
            // Отсортировать по убыванию score
            candidateMatches.sort((a, b) => b.score - a.score);

            for (const candidate of candidateMatches) {
                if (usedIndices1.has(candidate.i) || usedIndices2.has(candidate.j)) {
                    continue;
                }

                // 🔴 ПРОВЕРИТЬ ВЗАИМНОСТЬ: j тоже должен считать i лучшим
                let reciprocalFound = false;
                let reciprocalScore = 0;

                for (const otherCandidate of candidateMatches) {
                    if (otherCandidate.i === candidate.j && otherCandidate.j === candidate.i) {
                        reciprocalFound = true;
                        reciprocalScore = otherCandidate.score;
                        break;
                    }
                }

                // 🔴 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: ищем лучшего для j среди свободных
                if (!reciprocalFound) {
                    let bestForJ = -1;
                    let bestScoreForJ = 0;

                    for (const otherCandidate of candidateMatches) {
                        if (otherCandidate.j === candidate.j && !usedIndices1.has(otherCandidate.i)) {
                            if (otherCandidate.score > bestScoreForJ) {
                                bestScoreForJ = otherCandidate.score;
                                bestForJ = otherCandidate.i;
                            }
                        }
                    }

                    reciprocalFound = (bestForJ === candidate.i);
                    reciprocalScore = bestScoreForJ;
                }

                if (reciprocalFound && reciprocalScore > this.config.matchScoreThreshold * 0.8) {
                    matches.push({
                        node1: candidate.i,
                        node2: candidate.j,
                        score: (candidate.score + reciprocalScore) / 2,
                        signatureSimilarity: candidate.signatureScore,
                        geometricConsistency: candidate.geometricScore
                    });

                    usedIndices1.add(candidate.i);
                    usedIndices2.add(candidate.j);
                }
            }
        } else {
            // Старый алгоритм (для сравнения)
            const usedIndices2Old = new Set();
            candidateMatches.forEach(candidate => {
                if (!usedIndices2Old.has(candidate.j)) {
                    matches.push({
                        node1: candidate.i,
                        node2: candidate.j,
                        score: candidate.score,
                        signatureSimilarity: candidate.signatureScore,
                        geometricConsistency: candidate.geometricScore
                    });
                    usedIndices2Old.add(candidate.j);
                }
            });
        }

        console.log(`✅ После взаимной проверки: ${matches.length} пар`);
        return matches;
    }

    // 🔴 НОВЫЙ МЕТОД: РАСЧЁТ УСИЛЕННЫХ СИГНАТУР
    calculateEnhancedSignatures(vectorGraph) {
        const signatures = [];

        for (let idx = 0; idx < vectorGraph.starVectors.length; idx++) {
            const starVector = vectorGraph.starVectors[idx];
            if (!starVector || !starVector.signature) continue;

            const signature = {
                // 🔴 БАЗОВЫЕ ХАРАКТЕРИСТИКИ
                degree: starVector.vectors ? starVector.vectors.length : 0,
                angleHistogram: starVector.signature.angleHistogram || [],
                distanceHistogram: starVector.signature.distanceHistogram || [],

                // 🔴 ЛОКАЛЬНАЯ ТОПОЛОГИЯ
                neighborAngles: [],
                neighborDistances: [],

                // 🔴 УСИЛЕННЫЕ ИНВАРИАНТЫ 2-ГО ПОРЯДКА
                neighborDegrees: [],       // Степени соседних узлов
                trianglesCount: 0,         // Количество треугольников через узел
                sectorDistribution: [],    // Распределение по секторам
                secondOrderAngles: []      // Углы 2-го порядка
            };

            // 🔴 РАСЧЁТ БАЗОВЫХ ХАРАКТЕРИСТИК
            if (starVector.vectors && starVector.vectors.length > 0) {
                starVector.vectors.forEach(v => {
                    signature.neighborAngles.push(v.angle);
                    signature.neighborDistances.push(v.distance);
                });

                signature.neighborAngles = this.normalizeAngles(signature.neighborAngles);
                signature.neighborDistances = this.normalizeDistances(signature.neighborDistances);
            }

            // 🔴 РАСЧЁТ УСИЛЕННЫХ ИНВАРИАНТОВ
            if (starVector.vectors && starVector.vectors.length > 0) {
                // 1. Степени соседей
                starVector.vectors.forEach(v => {
                    const neighborStar = vectorGraph.starVectors[v.toPoint];
                    if (neighborStar && neighborStar.vectors) {
                        signature.neighborDegrees.push(neighborStar.vectors.length);
                    }
                });

                // 2. Количество треугольников
                signature.trianglesCount = this.countTriangles(idx, vectorGraph);

                // 3. Распределение по секторам
                signature.sectorDistribution = this.calculateSectorDistribution(starVector);

                // 4. Углы 2-го порядка
                signature.secondOrderAngles = this.calculateSecondOrderAngles(idx, vectorGraph);
            }

            signatures.push(signature);
        }

        return signatures;
    }

    // 🔴 НОВЫЙ МЕТОД: СРАВНЕНИЕ УСИЛЕННЫХ СИГНАТУР
    compareEnhancedSignatures(sig1, sig2) {
        let totalScore = 0;
        let weightSum = 0;

        // 🔴 БАЗОВЫЕ ХАРАКТЕРИСТИКИ (вес 0.6)
        // 1. Сравнить гистограммы углов (вес 0.15)
        if (sig1.angleHistogram && sig2.angleHistogram) {
            const angleScore = this.compareHistograms(sig1.angleHistogram, sig2.angleHistogram);
            totalScore += angleScore * 0.15;
            weightSum += 0.15;
        }

        // 2. Сравнить гистограммы расстояний (вес 0.15)
        if (sig1.distanceHistogram && sig2.distanceHistogram) {
            const distanceScore = this.compareHistograms(sig1.distanceHistogram, sig2.distanceHistogram);
            totalScore += distanceScore * 0.15;
            weightSum += 0.15;
        }

        // 3. Сравнить степени (вес 0.15)
        const degreeDiff = Math.abs(sig1.degree - sig2.degree);
        const degreeScore = Math.max(0, 1 - degreeDiff / 10);
        totalScore += degreeScore * 0.15;
        weightSum += 0.15;

        // 4. Сравнить распределение углов соседей (вес 0.15)
        const neighborAngleScore = this.compareAngleDistributions(sig1.neighborAngles, sig2.neighborAngles);
        totalScore += neighborAngleScore * 0.15;
        weightSum += 0.15;

        // 🔴 УСИЛЕННЫЕ ИНВАРИАНТЫ (вес 0.4)
        // 5. Сравнить степени соседей (вес 0.10)
        const neighborDegreeScore = this.compareNeighborDegrees(sig1.neighborDegrees, sig2.neighborDegrees);
        totalScore += neighborDegreeScore * 0.10;
        weightSum += 0.10;

        // 6. Сравнить количество треугольников (вес 0.10)
        const triangleScore = 1 - Math.min(1, Math.abs(sig1.trianglesCount - sig2.trianglesCount) / 5);
        totalScore += triangleScore * 0.10;
        weightSum += 0.10;

        // 7. Сравнить распределение по секторам (вес 0.10)
        const sectorScore = this.compareSectorDistributions(sig1.sectorDistribution, sig2.sectorDistribution);
        totalScore += sectorScore * 0.10;
        weightSum += 0.10;

        // 8. Сравнить углы 2-го порядка (вес 0.10)
        const secondOrderScore = this.compareSecondOrderAngles(sig1.secondOrderAngles, sig2.secondOrderAngles);
        totalScore += secondOrderScore * 0.10;
        weightSum += 0.10;

        return weightSum > 0 ? totalScore / weightSum : 0;
    }

    // 🔴 НОВЫЙ МЕТОД: ПРОВЕРКА ГЕОМЕТРИЧЕСКОЙ СОГЛАСОВАННОСТИ
    checkGeometricConsistency(idx1, idx2, vg1, vg2) {
        if (!this.config.enableGeometricConsistency) {
            return 1.0;
        }

        // Получить k ближайших соседей в обоих графах
        const neighbors1 = this.getKNearestNeighbors(idx1, vg1, this.config.kNearestNeighbors);
        const neighbors2 = this.getKNearestNeighbors(idx2, vg2, this.config.kNearestNeighbors);

        if (neighbors1.length === 0 || neighbors2.length === 0) {
            return 0.5; // Недостаточно данных для проверки
        }

        // Проверить сохранение относительных расстояний
        let consistencyScore = 0;
        let checkedPairs = 0;

        for (let i = 0; i < Math.min(neighbors1.length, neighbors2.length); i++) {
            const n1 = neighbors1[i];
            const n2 = neighbors2[i];

            // Расстояние от центрального узла до соседа в графе 1
            const dist1 = this.calculateDistance(vg1, idx1, n1.index);
            const dist2 = this.calculateDistance(vg2, idx2, n2.index);

            // Относительная разница расстояний
            const distanceRatio = Math.min(dist1, dist2) / Math.max(dist1, dist2);
            const distanceScore = Math.max(0, Math.min(1, distanceRatio * 1.5));

            // Угловое положение соседа
            const angle1 = this.calculateRelativeAngle(vg1, idx1, n1.index);
            const angle2 = this.calculateRelativeAngle(vg2, idx2, n2.index);

            const angleDiff = Math.abs(angle1 - angle2);
            const angleScore = Math.max(0, 1 - angleDiff / (Math.PI / 2)); // Допуск 90 градусов

            consistencyScore += (distanceScore * 0.6 + angleScore * 0.4);
            checkedPairs++;
        }

        return checkedPairs > 0 ? consistencyScore / checkedPairs : 0.5;
    }

    // 🔴 НОВЫЕ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

    // Подсчёт треугольников через узел
    countTriangles(nodeIdx, vectorGraph) {
        const starVector = vectorGraph.starVectors[nodeIdx];
        if (!starVector || !starVector.vectors || starVector.vectors.length < 2) {
            return 0;
        }

        let triangleCount = 0;
        const neighbors = starVector.vectors.map(v => v.toPoint);

        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const neighborI = neighbors[i];
                const neighborJ = neighbors[j];

                // Проверить, есть ли ребро между neighborI и neighborJ
                if (this.areNodesConnectedInVectorGraph(vectorGraph, neighborI, neighborJ)) {
                    triangleCount++;
                }
            }
        }

        return triangleCount;
    }

    // Распределение соседей по секторам
    calculateSectorDistribution(starVector) {
        if (!starVector.vectors || starVector.vectors.length === 0) {
            return [0, 0, 0, 0];
        }

        const sectors = [0, 0, 0, 0]; // 4 сектора по 90 градусов

        starVector.vectors.forEach(v => {
            // Нормализовать угол к [0, 2π)
            let angle = v.angle;
            if (angle < 0) angle += 2 * Math.PI;
            if (angle >= 2 * Math.PI) angle %= (2 * Math.PI);

            const sector = Math.floor(angle / (Math.PI / 2)); // 0-3
            if (sector >= 0 && sector < 4) {
                sectors[sector]++;
            }
        });

        // Нормализовать к сумме 1
        const total = sectors.reduce((sum, val) => sum + val, 0);
        return total > 0 ? sectors.map(s => s / total) : sectors;
    }

    // Углы 2-го порядка (между направлениями на соседей)
    calculateSecondOrderAngles(nodeIdx, vectorGraph) {
        const starVector = vectorGraph.starVectors[nodeIdx];
        if (!starVector || !starVector.vectors || starVector.vectors.length < 2) {
            return [];
        }

        const angles = [];
        const vectors = starVector.vectors;

        for (let i = 0; i < vectors.length; i++) {
            for (let j = i + 1; j < vectors.length; j++) {
                const angleDiff = Math.abs(vectors[i].angle - vectors[j].angle);
                const normalizedAngle = Math.min(angleDiff, 2 * Math.PI - angleDiff);
                angles.push(normalizedAngle);
            }
        }

        return angles.length > 0 ? this.normalizeAngles(angles) : [];
    }

    // Получить k ближайших соседей
    getKNearestNeighbors(nodeIdx, vectorGraph, k) {
        const starVector = vectorGraph.starVectors[nodeIdx];
        if (!starVector || !starVector.vectors) {
            return [];
        }

        const neighbors = starVector.vectors.map(v => ({
            index: v.toPoint,
            distance: v.distance,
            angle: v.angle
        }));

        // Отсортировать по расстоянию
        neighbors.sort((a, b) => a.distance - b.distance);

        return neighbors.slice(0, Math.min(k, neighbors.length));
    }

    // 🔴 ДОБАВЛЕННЫЕ МЕТОДЫ ДЛЯ СРАВНЕНИЯ СИГНАТУР

    // 1. СРАВНЕНИЕ ГИСТОГРАММ (ДОБАВЛЕН ПО ИНСТРУКЦИИ)
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

    // 2. СРАВНЕНИЕ РАСПРЕДЕЛЕНИЯ УГЛОВ
    compareAngleDistributions(angles1, angles2) {
        if (!angles1 || !angles2 || angles1.length === 0 || angles2.length === 0) {
            return 0.5;
        }

        // Создать гистограммы углов
        const hist1 = this.createAngleHistogram(angles1, 8);
        const hist2 = this.createAngleHistogram(angles2, 8);

        return this.compareHistograms(hist1, hist2);
    }

    // 3. СРАВНЕНИЕ СТЕПЕНЕЙ СОСЕДЕЙ
    compareNeighborDegrees(degrees1, degrees2) {
        if (!degrees1 || !degrees2 || degrees1.length === 0 || degrees2.length === 0) {
            return 0.5;
        }

        // Нормализовать степени
        const maxDeg1 = Math.max(...degrees1, 1);
        const maxDeg2 = Math.max(...degrees2, 1);

        const norm1 = degrees1.map(d => d / maxDeg1);
        const norm2 = degrees2.map(d => d / maxDeg2);

        // Сравнить отсортированные списки
        const sorted1 = [...norm1].sort();
        const sorted2 = [...norm2].sort();

        let matchScore = 0;
        const minLength = Math.min(sorted1.length, sorted2.length);

        for (let i = 0; i < minLength; i++) {
            matchScore += 1 - Math.min(1, Math.abs(sorted1[i] - sorted2[i]) * 2);
        }

        return minLength > 0 ? matchScore / minLength : 0.5;
    }

    // 4. СРАВНЕНИЕ РАСПРЕДЕЛЕНИЙ ПО СЕКТОРАМ
    compareSectorDistributions(sectors1, sectors2) {
        if (!sectors1 || !sectors2 || sectors1.length !== sectors2.length) {
            return 0.5;
        }

        let similarity = 0;
        for (let i = 0; i < sectors1.length; i++) {
            similarity += 1 - Math.abs(sectors1[i] - sectors2[i]);
        }

        return similarity / sectors1.length;
    }

    // 5. СРАВНЕНИЕ УГЛОВ 2-ГО ПОРЯДКА
    compareSecondOrderAngles(angles1, angles2) {
        if (!angles1 || !angles2 || angles1.length === 0 || angles2.length === 0) {
            return 0.5;
        }

        const sorted1 = [...angles1].sort();
        const sorted2 = [...angles2].sort();

        let matchScore = 0;
        const minLength = Math.min(sorted1.length, sorted2.length);

        for (let i = 0; i < minLength; i++) {
            const angleDiff = Math.abs(sorted1[i] - sorted2[i]);
            matchScore += 1 - Math.min(1, angleDiff / (Math.PI / 4));
        }

        return minLength > 0 ? matchScore / minLength : 0.5;
    }

    // 6. СОЗДАНИЕ ГИСТОГРАММЫ УГЛОВ
    createAngleHistogram(angles, bins) {
        const histogram = new Array(bins).fill(0);

        angles.forEach(angle => {
            // Нормализовать угол к [0, 2π)
            let normalized = angle % (2 * Math.PI);
            if (normalized < 0) normalized += 2 * Math.PI;

            const bin = Math.floor(normalized / (2 * Math.PI) * bins);
            if (bin >= 0 && bin < bins) {
                histogram[bin]++;
            }
        });

        // Нормализовать
        const total = histogram.reduce((sum, val) => sum + val, 0);
        return total > 0 ? histogram.map(h => h / total) : histogram;
    }

    // Расстояние между узлами в VectorGraph
    calculateDistance(vectorGraph, idx1, idx2) {
        const point1 = vectorGraph.starVectors[idx1]?.point;
        const point2 = vectorGraph.starVectors[idx2]?.point;

        if (!point1 || !point2) {
            return 0;
        }

        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Относительный угол между узлами
    calculateRelativeAngle(vectorGraph, centerIdx, neighborIdx) {
        const center = vectorGraph.starVectors[centerIdx]?.point;
        const neighbor = vectorGraph.starVectors[neighborIdx]?.point;

        if (!center || !neighbor) {
            return 0;
        }

        const dx = neighbor.x - center.x;
        const dy = neighbor.y - center.y;
        return Math.atan2(dy, dx);
    }

    // Проверка связи в VectorGraph
    areNodesConnectedInVectorGraph(vectorGraph, idx1, idx2) {
        const starVector = vectorGraph.starVectors[idx1];
        if (!starVector || !starVector.vectors) return false;

        return starVector.vectors.some(v => v.toPoint === idx2);
    }

    // 4. РАСЧЁТ СТРУКТУРНОЙ СХОЖЕСТИ
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

    // 5. СОХРАНЕНИЕ ТОПОЛОГИИ
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

    // 6. ПРОВЕРКА НАЛИЧИЯ РЁБРА
    hasEdgeBetween(vectorGraph, nodeIdx1, nodeIdx2) {
        const starVector = vectorGraph.starVectors[nodeIdx1];
        if (!starVector || !starVector.vectors) return false;

        return starVector.vectors.some(v => v.toPoint === nodeIdx2);
    }

    // 7. ТРАНСФОРМАЦИЯ НА ОСНОВЕ СТРУКТУРЫ (ИСПРАВЛЕННАЯ!)
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

        // 🔴 ИСПРАВЛЕНИЕ: использовать сохранённые связи между индексами и реальными узлами
        const vectorGraph1 = this.graphToVectorGraph(graph1);
        const vectorGraph2 = this.graphToVectorGraph(graph2);

        // Использовать лучшие совпадения для точности
        const bestMatches = matches
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.min(10, matches.length));

        // Получить координаты совпадающих точек (РЕАЛЬНЫХ УЗЛОВ!)
        const points1 = [];
        const points2 = [];

        bestMatches.forEach(match => {
            // 🔴 КОРРЕКТНО: получить ID реальных узлов через сохранённые карты
            const nodeId1 = vectorGraph1.indexToNodeId.get(match.node1);
            const nodeId2 = vectorGraph2.indexToNodeId.get(match.node2);

            if (nodeId1 && nodeId2) {
                const node1 = graph1.nodes.get(nodeId1);
                const node2 = graph2.nodes.get(nodeId2);

                if (node1 && node2) {
                    points1.push({ x: node1.x, y: node1.y });
                    points2.push({ x: node2.x, y: node2.y });
                }
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

    // 8. РАСЧЁТ ПРОСТОГО СМЕЩЕНИЯ
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

    // 9. РАСЧЁТ ЖЁСТКОЙ ТРАНСФОРМАЦИИ
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

    // 10. ВЫЧИСЛЕНИЕ ЦЕНТРА
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

    // 11. ВЫПОЛНЕНИЕ ТОПОЛОГИЧЕСКОГО СЛИЯНИЯ
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
            const uniqueNode = {
                ...node,
                source: 'graph1',
                sources: node.sources || (node.source ? [node.source] : ['graph1']),
                confirmationCount: node.confirmationCount ||
                                 (node.sources ? node.sources.length : 1),
                confidence: node.confidence || 0.5,
                originalId: node.id || `node1_${idx}`
            };
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
                sources: node.sources || (node.source ? [node.source] : ['graph2']),
                confirmationCount: node.confirmationCount ||
                                 (node.sources ? node.sources.length : 1),
                confidence: node.confidence || 0.5,
                originalId: node.id || `node2_${idx}`
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
        console.log(`   Узлов для добавления: ${mergedNodes.size}`);
        console.log(`   Рёбер для добавления: ${mergedEdges.size}`);

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
                const toId = nodeIndexToId.get(toIndex);     // Получим "nY"

                if (fromId && toId && fromId !== toId) {
                    // 🔴 ИСПРАВЛЕНИЕ: SimpleGraph.addEdge ожидает ДВА параметра: nodeId1, nodeId2
                    const success = mergedGraph.addEdge(fromId, toId);
                   
                    if (success) {
                        edgesAdded++;
                        if (edgesAdded <= 5) {
                            console.log(`   ✅ Добавлено ребро ${edgesAdded}: ${fromId} -> ${toId}`);
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

    // 12. СЛИЯНИЕ ДВУХ УЗЛОВ
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

        // СОБИРАЕМ ИСТОРИЮ ПОДТВЕРЖДЕНИЙ
        const sources1 = node1.sources || (node1.source ? [node1.source] : ['graph1']);
        const sources2 = node2.sources || (node2.source ? [node2.source] : ['graph2']);
       
        const confirmationCount1 = node1.confirmationCount || sources1.length;
        const confirmationCount2 = node2.confirmationCount || sources2.length;

        return {
            x: (node1.x * weight1 + node2.x * weight2) / totalWeight,
            y: (node1.y * weight1 + node2.y * weight2) / totalWeight,
            confidence: Math.max(0.0, Math.min(1.0, mergedConfidence)),
            source: 'merged',
            sources: [...sources1, ...sources2],
            confirmationCount: confirmationCount1 + confirmationCount2,
            mergedFrom: [node1.id || 'node1', node2.id || 'node2'],
            similarityScore: similarityScore,
            originalConfidences: [conf1, conf2]
        };
    }

    // 13. ПРИМЕНЕНИЕ ТРАНСФОРМАЦИИ К УЗЛУ
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

    // 14. ВОССТАНОВЛЕНИЕ РЁБЕР (ИСПРАВЛЕННАЯ ВЕРСИЯ)
    reconstructEdgesFromMergedNodes(nodes, edgesMap, matches, originalGraph1, originalGraph2) {
        console.log(`🔗 Реконструкция рёбер для ${nodes.length} узлов...`);
        console.log(`   Оригинальные рёбра: graph1=${originalGraph1.edges.size}, graph2=${originalGraph2.edges.size}`);

        // 🔴 1. СОЗДАТЬ КАРТУ: оригинальный ID узла -> индекс в merged nodes
        const originalIdToMergedIndex = new Map();
        
        // Для слитых узлов (первые matches.length узлов в массиве nodes)
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node.originalId) {
                originalIdToMergedIndex.set(node.originalId, i);
            }
        }

        // 🔴 2. ДОБАВИТЬ РЁБРА ИЗ ОРИГИНАЛЬНЫХ ГРАФОВ
        let edgesAdded = 0;
        let edgesSkipped = 0;

        // Рёбра из первого графа
        for (const [edgeId, edge] of originalGraph1.edges) {
            const fromIdx = originalIdToMergedIndex.get(edge.from);
            const toIdx = originalIdToMergedIndex.get(edge.to);
            
            if (fromIdx !== undefined && toIdx !== undefined && fromIdx !== toIdx) {
                const edgeKey = `edge_${edge.from}_${edge.to}`;
                if (!edgesMap.has(edgeKey)) {
                    edgesMap.set(edgeKey, {
                        from: `node_${fromIdx}`,
                        to: `node_${toIdx}`,
                        weight: 1.0,
                        source: 'graph1_original'
                    });
                    edgesAdded++;
                } else {
                    edgesSkipped++;
                }
            }
        }

        // Рёбра из второго графа (только если оба узла есть в merged nodes)
        for (const [edgeId, edge] of originalGraph2.edges) {
            const fromIdx = originalIdToMergedIndex.get(edge.from);
            const toIdx = originalIdToMergedIndex.get(edge.to);
            
            if (fromIdx !== undefined && toIdx !== undefined && fromIdx !== toIdx) {
                const edgeKey = `edge_${edge.from}_${edge.to}`;
                if (!edgesMap.has(edgeKey)) {
                    edgesMap.set(edgeKey, {
                        from: `node_${fromIdx}`,
                        to: `node_${toIdx}`,
                        weight: 1.0,
                        source: 'graph2_original'
                    });
                    edgesAdded++;
                } else {
                    edgesSkipped++;
                }
            }
        }

        console.log(`   Добавлено оригинальных рёбер: ${edgesAdded}`);
        console.log(`   Пропущено дубликатов: ${edgesSkipped}`);

        // 🔴 3. ЕСЛИ ОРИГИНАЛЬНЫХ РЁБЕР МАЛО, ДОБАВИТЬ НЕКОТОРЫЕ СВЯЗИ ПО БЛИЗОСТИ
        if (edgesAdded < nodes.length * 1.5) {
            console.log(`   ⚠️ Мало оригинальных рёбер, добавляю связи по близости...`);
            
            let proximityEdges = 0;
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
                
                // Соединить с ближайшими 2
                for (let k = 0; k < Math.min(2, distances.length); k++) {
                    const j = distances[k].index;
                    const edgeKey = `prox_${i}_${j}`;
                    
                    if (!edgesMap.has(edgeKey)) {
                        edgesMap.set(edgeKey, {
                            from: `node_${i}`,
                            to: `node_${j}`,
                            weight: 1 - (distances[k].distance / 200),
                            distance: distances[k].distance,
                            source: 'proximity'
                        });
                        proximityEdges++;
                    }
                }
            }
            
            console.log(`   Добавлено рёбер по близости: ${proximityEdges}`);
        }

        console.log(`   Всего рёбер в edgesMap: ${edgesMap.size}`);
    }

    // 15. РАСЧЁТ ВЕСА РЁБРА
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

    // 16. ЗАПАСНОЙ ВАРИАНТ: ГЕОМЕТРИЧЕСКОЕ СЛИЯНИЕ
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

    // 17. МЕТРИКИ ТОПОЛОГИИ
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

    // 18. ОЦЕНКА СОХРАНЕНИЯ ТОПОЛОГИИ
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

    // 19. ПРОВЕРКА СВЯЗИ МЕЖДУ УЗЛАМИ
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

    // 20. НОРМАЛИЗАЦИЯ УГЛОВ
    normalizeAngles(angles) {
        if (angles.length === 0) return [];

        // Привести к диапазону [0, 2π)
        return angles.map(angle => {
            let normalized = angle % (2 * Math.PI);
            if (normalized < 0) normalized += 2 * Math.PI;
            return normalized;
        });
    }

    // 21. НОРМАЛИЗАЦИЯ РАССТОЯНИЙ
    normalizeDistances(distances) {
        if (distances.length === 0) return [];

        const maxDist = Math.max(...distances);
        if (maxDist === 0) return distances.map(() => 0);

        return distances.map(d => d / maxDist);
    }

    // 22. ПОКАЗАТЬ ИНФОРМАЦИЮ
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
