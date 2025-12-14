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
        console.log(`   Граф 1: ${graph1.nodes.size} узлов, ${graph1.edges.size} рёбер`);
        console.log(`   Граф 2: ${graph2.nodes.size} узлов, ${graph2.edges.size} рёбер`);

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
        console.log(`   📊 Сохранено структур: ${metrics.preservedStructures}%`);
        console.log(`   🏗️ Улучшение топологии: ${metrics.topologyImprovement}%`);
        console.log(`   🔗 Слито узлов: ${mergeResult.mergedNodes}`);

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
                neighborDegrees: [],       // Степени соседних узлов
                trianglesCount: 0,         // Количество треугольников через узел
                sectorDistribution: [],    // Распределение по секторам
                secondOrderAngles: []      // Углы 2-го порядка
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

    // Сравнение распределения углов
    compareAngleDistributions(angles1, angles2) {
        if (!angles1 || !angles2 || angles1.length === 0 || angles2.length === 0) {
            return 0.5;
        }

        // Создать гистограммы углов
        const hist1 = this.createAngleHistogram(angles1, 8); // 8 бинов
        const hist2 = this.createAngleHistogram(angles2, 8);

        return this.compareHistograms(hist1, hist2);
    }

    // Сравнение степеней соседей
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

    // Сравнение распределений по секторам
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

    // Сравнение углов 2-го порядка
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
            matchScore += 1 - Math.min(1, angleDiff / (Math.PI / 4)); // Допуск 45 градусов
        }

        return minLength > 0 ? matchScore / minLength : 0.5;
    }

    // Создание гистограммы углов
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

    // СТАРЫЕ МЕТОДЫ (остаются без изменений, кроме findStructuralTransformation)

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

    // ОСТАЛЬНЫЕ МЕТОДЫ БЕЗ ИЗМЕНЕНИЙ (performTopologicalMerge, mergeTwoNodes и т.д.)
    // ... [Весь остальной код из оригинального файла остается без изменений]
    // За исключением метода reconstructEdgesFromMergedNodes, который нужно исправить отдельно

    // 🔴 ИСПРАВЛЕНИЕ ДЛЯ РЕАЛЬНОГО СОХРАНЕНИЯ РЁБЕР
    reconstructEdgesFromMergedNodes(nodes, edgesMap, matches, originalGraph1, originalGraph2) {
        console.log(`🔗 Реконструкция рёбер для ${nodes.length} узлов...`);
        console.log(`   Оригинальные рёбра: graph1=${originalGraph1.edges.size}, graph2=${originalGraph2.edges.size}`);

        // 🔴 1. СОЗДАТЬ КАРТУ: оригинальный ID узла -> индекс в merged nodes
        const originalIdToMergedIndex = new Map();
       
        // Для слитых узлов (первые matches.length узлов в массиве nodes)
        matches.forEach((match, matchIndex) => {
            // Здесь нужно получить оригинальные ID узлов через векторные графы
            // Для упрощения: берем ID из самого узла, если он есть
            if (nodes[matchIndex] && nodes[matchIndex].originalId) {
                const originalId1 = nodes[matchIndex].originalId;
                if (originalId1) {
                    originalIdToMergedIndex.set(originalId1, matchIndex);
                }
            }
        });

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

        console.log(`   Добавлено оригинальных рёбер: ${edgesAdded}`);
        console.log(`   Пропущено дубликатов: ${edgesSkipped}`);

        // 🔴 3. ЕСЛИ ОРИГИНАЛЬНЫХ РЁБЕР МАЛО, ДОБАВИТЬ НЕКОТОРЫЕ СВЯЗИ ПО БЛИЗОСТИ
        if (edgesAdded < nodes.length * 1.5) {
            console.log(`   ⚠️ Мало оригинальных рёбер, добавляю связи по близости...`);
           
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
           
            console.log(`   Добавлено рёбер по близости: ${proximityEdges}`);
        }

        console.log(`   Всего рёбер в edgesMap: ${edgesMap.size}`);
    }

    // 11. СРАВНЕНИЕ ГИСТОГРАММ
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

    // 12. НОРМАЛИЗАЦИЯ УГЛОВ
    normalizeAngles(angles) {
        if (angles.length === 0) return [];

        // Привести к диапазону [0, 2π)
        return angles.map(angle => {
            let normalized = angle % (2 * Math.PI);
            if (normalized < 0) normalized += 2 * Math.PI;
            return normalized;
        });
    }

    // 13. НОРМАЛИЗАЦИЯ РАССТОЯНИЙ
    normalizeDistances(distances) {
        if (distances.length === 0) return [];

        const maxDist = Math.max(...distances);
        if (maxDist === 0) return distances.map(() => 0);

        return distances.map(d => d / maxDist);
    }

    // ... [Все остальные методы без изменений]

    // 🔴 Быстрое интегрированное слияние
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
