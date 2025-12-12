// modules/footprint/hybrid-footprint.js
// ГИБРИДНЫЙ ОТПЕЧАТОК: битовые маски + моменты + графы + матрица расстояний + векторная схема + трекер точек + ТОПОЛОГИЧЕСКИЙ МЕРЖЕР

const BitmaskFootprint = require('./bitmask-footprint');
const MomentFootprint = require('./moment-footprint');
const SimpleGraph = require('./simple-graph');
const DistanceMatrix = require('./distance-matrix');
const VectorGraph = require('./vector-graph');
const PointTracker = require('./point-tracker');
const TopologyMerger = require('./topology-merger'); // 🔴 ЗАМЕНА PointMerger!
const ConfidenceValidator = require('../utils/confidence-validator');

class HybridFootprint {
    constructor(options = {}) {
        // Идентификаторы
        this.id = options.id || `hybrid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = options.name || `Гибридный отпечаток`;
        this.userId = options.userId || null;

        // Различные представления отпечатка
        this.bitmask = new BitmaskFootprint(options.bitmaskData);
        this.moments = new MomentFootprint(options.momentData);
        this.graph = options.graph || new SimpleGraph(this.name);

        // Новые представления (добавлены)
        this.distanceMatrix = new DistanceMatrix(options.distanceMatrixData);
        this.vectorGraph = new VectorGraph(options.vectorGraphData);
        this.pointTracker = new PointTracker(options.pointTrackerData);

        // 🔴 НОРМАЛИЗОВАТЬ ТОЧКИ ПРИ СОЗДАНИИ
        this.originalPoints = ConfidenceValidator.validatePointsArray(options.originalPoints || []);

        // Метаданные
        this.metadata = {
            created: new Date(),
            lastUpdated: new Date(),
            totalPhotos: 0,
            transformations: [], // История трансформаций при объединении
            topologyMerges: 0, // 🔴 НОВАЯ СТАТИСТИКА
            ...(options.metadata || {})
        };

        // Статистика
        this.stats = {
            confidence: Math.max(0.0, Math.min(1.0, options.confidence || 0.5)),
            bitmaskConfidence: 0,
            momentConfidence: 0,
            graphConfidence: 0,
            matrixConfidence: 0,
            vectorConfidence: 0,
            trackerConfidence: 0,
            qualityScore: 0,
            topologyScore: 0 // 🔴 НОВАЯ МЕТРИКА
        };

        console.log(`🎭 Создан гибридный отпечаток "${this.name}"`);
    }

    // ДОБАВЛЕНО: Метод calculateConfidence
    calculateConfidence() {
        return Math.max(0.0, Math.min(1.0, this.stats.confidence || 0.5));
    }

    // ДОБАВЛЕНО: Метод getConfidence для совместимости
    getConfidence() {
        return Math.max(0.0, Math.min(1.0, this.stats.confidence || 0.5));
    }

    // 1. СОЗДАТЬ ВСЕ ПРЕДСТАВЛЕНИЯ ИЗ ТОЧЕК
    createFromPoints(points, sourceInfo = {}) {
        console.log(`🎯 Создаю гибридный отпечаток из ${points.length} точек...`);

        if (!points || points.length < 3) {
            console.log('⚠️ Слишком мало точек');
            return false;
        }

        // 🔴 ВАЛИДИРОВАТЬ И НОРМАЛИЗОВАТЬ ТОЧКИ ПЕРЕД ИСПОЛЬЗОВАНИЕМ
        this.originalPoints = ConfidenceValidator.validatePointsArray(points);

        // 1. БИТОВАЯ МАСКА (самое быстрое)
        this.bitmask.createFromPoints(this.originalPoints);

        // 2. ГЕОМЕТРИЧЕСКИЕ МОМЕНТЫ (быстрое)
        this.moments.calculateFromPoints(this.originalPoints);

        // 3. ГРАФ (медленное, но точное)
        const graphInvariants = this.graph.buildFromPoints(this.originalPoints);

        // 4. МАТРИЦА РАССТОЯНИЙ
        this.distanceMatrix.createFromPoints(this.originalPoints);

        // 5. ВЕКТОРНАЯ СХЕМА
        this.vectorGraph.createFromPoints(this.originalPoints);

        // 6. ТРЕКЕР ТОЧЕК
        this.pointTracker.processNewPoints(this.originalPoints, sourceInfo);

        // Обновить метаданные
        this.metadata.totalPhotos++;
        this.metadata.lastUpdated = new Date();

        // Рассчитать уверенности
        this.updateConfidence();

        console.log(`✅ Гибридный отпечаток создан:`);
        console.log(`   🎭 Битовая маска: ${this.bitmask.bitmask.toString(16).slice(0, 8)}...`);
        console.log(`   📐 Моменты: ${this.moments.get7Moments().length} инвариантов`);
        console.log(`   🕸️ Граф: ${this.graph.nodes.size} узлов, ${this.graph.edges.size} рёбер`);
        console.log(`   📊 Матрица: ${this.getMatrixSizeString()}`);
        console.log(`   🧭 Векторы: ${this.getVectorCount()} векторов`);
        console.log(`   📍 Трекер: ${this.pointTracker.getStats().totalPoints} точек`);

        return true;
    }

    // 2. ОБНОВИТЬ УВЕРЕННОСТИ (С ОГРАНИЧЕНИЕМ)
    updateConfidence() {
        // Уверенность на основе битовой маски (сколько заполнено)
        const bitmaskOnes = BitmaskFootprint.countBits(this.bitmask.bitmask);
        this.stats.bitmaskConfidence = Math.min(1.0, bitmaskOnes / 64);

        // Уверенность на основе моментов (сложность формы)
        const moments = this.moments.get7Moments();
        const momentSum = moments.reduce((sum, m) => sum + Math.abs(m), 0);
        this.stats.momentConfidence = Math.min(1.0, momentSum * 10);

        // Уверенность на основе графа
        const nodeCount = this.graph.nodes.size;
        const edgeCount = this.graph.edges.size;
        const graphConfidence = Math.min(1.0,
            (nodeCount / 30) * 0.4 + // Хотя бы 30 узлов
            (edgeCount / Math.max(1, nodeCount * 2)) * 0.3 + // Связность
            (this.graph.getBasicInvariants().clusteringCoefficient || 0) * 0.3
        );
        this.stats.graphConfidence = graphConfidence;

        // Уверенность на основе матрицы расстояний
        this.stats.matrixConfidence = Math.min(1.0, this.distanceMatrix.confidence || 0.8);

        // Уверенность на основе векторной схемы
        this.stats.vectorConfidence = Math.min(1.0, this.vectorGraph.confidence || 0.8);

        // Уверенность на основе трекера точек
        const trackerStats = this.pointTracker.getStats();
        this.stats.trackerConfidence = Math.min(1.0, trackerStats.confidence || 0.8);

        // 🔴 НОВАЯ МЕТРИКА: Топологическая оценка
        const topologyScore = this.calculateTopologyScore();
        this.stats.topologyScore = topologyScore;

        // Общая уверенность (взвешенная) - ДОБАВЛЕН ТОПОЛОГИЧЕСКИЙ ВЕС
        const calculatedConfidence = (
            this.stats.bitmaskConfidence * 0.08 +      // 8%
            this.stats.momentConfidence * 0.12 +       // 12%
            this.stats.graphConfidence * 0.25 +        // 25% - увеличен вес графа
            this.stats.matrixConfidence * 0.20 +       // 20%
            this.stats.vectorConfidence * 0.15 +       // 15%
            this.stats.trackerConfidence * 0.10 +      // 10%
            this.stats.topologyScore * 0.10           // 10% - новый топологический фактор
        );

        // 🔴 ОГРАНИЧИТЬ В ДИАПАЗОНЕ [0.0, 1.0]
        this.stats.confidence = Math.max(0.0, Math.min(1.0, calculatedConfidence));

        // Качество (уверенность × количество фото)
        this.stats.qualityScore = Math.max(0.0, Math.min(1.0,
            this.stats.confidence * Math.min(1, this.metadata.totalPhotos / 3)
        ));
    }

    // 🔴 НОВЫЙ МЕТОД: РАСЧЁТ ТОПОЛОГИЧЕСКОЙ ОЦЕНКИ
    calculateTopologyScore() {
        const invariants = this.graph.getBasicInvariants();
       
        // Факторы топологического качества:
        // 1. Связность графа
        const connectivity = Math.min(1.0, (invariants.edgeCount || 0) / Math.max(1, invariants.nodeCount * 2));
       
        // 2. Коэффициент кластеризации
        const clustering = Math.min(1.0, invariants.clusteringCoefficient || 0);
       
        // 3. Равномерность распределения узлов
        const uniformity = this.calculateNodeUniformity();
       
        // 4. Сохранение структуры после слияний
        const structurePreservation = this.metadata.topologyMerges > 0
            ? Math.min(1.0, 0.7 + (this.metadata.topologyMerges * 0.1))
            : 0.8;
       
        // Комбинированный score
        return (connectivity * 0.3 + clustering * 0.3 + uniformity * 0.2 + structurePreservation * 0.2);
    }

    // 🔴 НОВЫЙ МЕТОД: РАСЧЁТ РАВНОМЕРНОСТИ РАСПРЕДЕЛЕНИЯ УЗЛОВ
    calculateNodeUniformity() {
        const nodes = Array.from(this.graph.nodes.values());
        if (nodes.length < 4) return 0.5;
       
        // Разбить на квадранты и посчитать распределение
        const bounds = this.calculateNodeBounds();
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
       
        if (width === 0 || height === 0) return 0.5;
       
        // Разделить на 4 квадранта
        const midX = bounds.minX + width / 2;
        const midY = bounds.minY + height / 2;
       
        const quadrants = [0, 0, 0, 0];
       
        nodes.forEach(node => {
            if (node.x < midX && node.y < midY) quadrants[0]++;
            else if (node.x >= midX && node.y < midY) quadrants[1]++;
            else if (node.x < midX && node.y >= midY) quadrants[2]++;
            else quadrants[3]++;
        });
       
        // Рассчитать равномерность
        const avg = nodes.length / 4;
        let variance = 0;
        quadrants.forEach(count => {
            variance += Math.pow(count - avg, 2);
        });
        variance /= 4;
       
        // Нормализовать к [0, 1], где 1 - идеально равномерно
        const maxVariance = Math.pow(nodes.length, 2) / 4;
        const uniformity = 1 - (variance / maxVariance);
       
        return Math.max(0, Math.min(1, uniformity));
    }

    // 🔴 НОВЫЙ МЕТОД: ГРАНИЦЫ УЗЛОВ
    calculateNodeBounds() {
        const nodes = Array.from(this.graph.nodes.values());
        if (nodes.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        }
       
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y);
        });
       
        return { minX, maxX, minY, maxY };
    }

    // 3. КАСКАДНОЕ СРАВНЕНИЕ С ДРУГИМ ОТПЕЧАТКОМ (ОБНОВЛЁННАЯ ВЕРСИЯ)
    compare(otherFootprint) {
        console.log(`🔍 Каскадное сравнение с "${otherFootprint.name}"...`);

        const steps = [];
        const startTime = Date.now();

        // 🔴 ВАЛИДИРОВАТЬ ТОЧКИ ПЕРЕД СРАВНЕНИЕМ
        const validatedPoints1 = ConfidenceValidator.validatePointsArray(this.originalPoints);
        const validatedPoints2 = ConfidenceValidator.validatePointsArray(otherFootprint.originalPoints);
      
        // Использовать валидированные точки
        const points1 = validatedPoints1;
        const points2 = validatedPoints2;

        // ПРОВЕРКА КАЧЕСТВА ДАННЫХ
        if (points1.length < 15 || points2.length < 15) {
            return {
                similarity: 0,
                decision: 'different',
                reason: 'Слишком мало точек для сравнения',
                steps,
                fastReject: true,
                timeMs: Date.now() - startTime
            };
        }

        // 🔴 ШАГ 0: ПРОВЕРКА РАЗМЕРОВ (ОСЛАБЛЕННАЯ ВЕРСИЯ)
        const sizeRatio = Math.min(points1.length, points2.length) /
                         Math.max(points1.length, points2.length);

        // Для совсем разных размеров - быстрый отсев
        if (sizeRatio < 0.4) { // Было 0.7 - ТЕПЕРЬ ТОЛЬКО СОВСЕМ РАЗНЫЕ РАЗМЕРЫ
            console.log(`🚫 Отсев по размеру (ratio: ${sizeRatio.toFixed(2)})`);
            return {
                similarity: sizeRatio,
                decision: 'different',
                reason: `Слишком разное количество точек: ${points1.length} vs ${points2.length}`,
                steps,
                fastReject: true,
                timeMs: Date.now() - startTime
            };
        }

        // Для умеренно разных размеров - предупреждение, но продолжаем сравнение
        if (sizeRatio < 0.7) {
            console.log(`⚠️ Разные размеры точек (ratio: ${sizeRatio.toFixed(2)}), продолжаю сравнение...`);
        }

        // ШАГ 1: БЫСТРАЯ ПРОВЕРКА - БИТОВАЯ МАСКА (ТОЛЬКО ИНФОРМАЦИЯ, НЕ ОТСЕВ)
        const bitmaskResult = this.bitmask.compare(otherFootprint.bitmask);
        steps.push({
            step: 'bitmask',
            time: Date.now() - startTime,
            result: bitmaskResult,
            details: {
                distance: bitmaskResult.distance,
                similarity: bitmaskResult.similarity
            }
        });

        // 🔴 ИСПРАВЛЕНИЕ: БИТОВАЯ МАСКА - ТОЛЬКО ИНФОРМАЦИЯ, НЕ ОТСЕВ
        console.log(`📊 Битовые маски: расстояние=${bitmaskResult.distance}/64, similarity=${bitmaskResult.similarity.toFixed(3)}`);

        // ⚠️ ПРЕДУПРЕЖДЕНИЕ, НО ПРОДОЛЖАЕМ (НЕ ОТСЕИВАЕМ!)
        if (bitmaskResult.distance > 25) {
            console.log(`⚠️ Битовые маски различаются (${bitmaskResult.distance}/64), но продолжаю сравнение...`);
            // НЕ ВЫХОДИМ - продолжаем каскад!
        }

        // ШАГ 2: ПРОВЕРКА МОМЕНТОВ
        const momentResult = this.moments.compare(otherFootprint.moments);
        steps.push({
            step: 'moments',
            time: Date.now() - startTime,
            result: momentResult,
            details: {
                distance: momentResult.distance,
                similarity: momentResult.similarity
            }
        });

        // 🔴 БОЛЕЕ ЖЁСТКИЙ ПОРОГ ДЛЯ МОМЕНТОВ
        if (momentResult.distance > 0.3) { // Было 0.5
            console.log(`🚫 Отсев по моментам (расстояние: ${momentResult.distance.toFixed(4)})`);
            return {
                similarity: momentResult.similarity,
                decision: 'different',
                reason: `Геометрические моменты различаются`,
                steps,
                fastReject: true,
                timeMs: Date.now() - startTime
            };
        }

        // ШАГ 3: МАТРИЦА РАССТОЯНИЙ
        const matrixResult = this.distanceMatrix.compare(otherFootprint.distanceMatrix);
        steps.push({
            step: 'distance_matrix',
            time: Date.now() - startTime,
            result: matrixResult,
            details: {
                similarity: matrixResult.similarity,
                isMirrored: matrixResult.isMirrored
            }
        });

        // 🔴 МАТРИЦА - САМЫЙ ВАЖНЫЙ КРИТЕРИЙ
        if (matrixResult.similarity < 0.6) { // Было 0.5
            console.log(`🚫 Отсев по матрице расстояний (similarity: ${matrixResult.similarity.toFixed(3)})`);
            return {
                similarity: matrixResult.similarity,
                decision: 'different',
                reason: `Матрицы расстояний различаются`,
                steps,
                fastReject: true,
                timeMs: Date.now() - startTime
            };
        }

        // ШАГ 4: ВЕКТОРНАЯ СХЕМА (только если матрицы похожи)
        const vectorResult = this.vectorGraph.compare(otherFootprint.vectorGraph);
        steps.push({
            step: 'vector_graph',
            time: Date.now() - startTime,
            result: vectorResult,
            details: {
                similarity: vectorResult.similarity,
                totalMatches: vectorResult.totalMatches
            }
        });

        // 🔴 ВЕКТОРЫ ДОЛЖНЫ ИМЕТЬ МИНИМАЛЬНОЕ КОЛИЧЕСТВО СОВПАДЕНИЙ
        if (vectorResult.similarity < 0.7 || vectorResult.totalMatches < 5) { // Было 0.6
            console.log(`🚫 Отсев по векторной схеме (similarity: ${vectorResult.similarity.toFixed(3)}, matches: ${vectorResult.totalMatches})`);
            return {
                similarity: vectorResult.similarity,
                decision: 'different',
                reason: `Векторные схемы различаются`,
                steps,
                fastReject: true,
                timeMs: Date.now() - startTime
            };
        }

        // 🔴 ШАГ 5: ТОПОЛОГИЧЕСКОЕ СРАВНЕНИЕ ГРАФОВ (НОВЫЙ!)
        let topologyResult = { similarity: 0 };
        if (vectorResult.similarity > 0.75) {
            topologyResult = this.compareTopology(otherFootprint.graph);
            steps.push({
                step: 'topology',
                time: Date.now() - startTime,
                result: topologyResult,
                details: {
                    similarity: topologyResult.similarity,
                    structuralMatches: topologyResult.structuralMatches,
                    topologyScore: topologyResult.topologyScore
                }
            });
        }

        // 🔴 НОВАЯ ФОРМУЛА ВЕСОВ - больше веса топологии
        const weights = {
            bitmask: 0.08,   // 8% - быстро, но неточно
            moments: 0.12,   // 12% - форма
            matrix: 0.30,    // 30% - структура (уменьшено с 45%)
            vector: 0.25,    // 25% - локальные связи (уменьшено с 30%)
            topology: 0.25   // 25% - НОВЫЙ! топологическое сравнение
        };

        // БЕЗОПАСНОЕ ПОЛУЧЕНИЕ ЗНАЧЕНИЙ
        const bitmaskSimilarity = Math.max(0, Math.min(1, bitmaskResult?.similarity || 0));
        const momentSimilarity = Math.max(0, Math.min(1, momentResult?.similarity || 0));
        const matrixSimilarity = Math.max(0, Math.min(1, matrixResult?.similarity || 0));
        const vectorSimilarity = Math.max(0, Math.min(1, vectorResult?.similarity || 0));
        const topologySimilarity = Math.max(0, Math.min(1, topologyResult?.similarity || 0));

        const totalSimilarity = Math.max(0, Math.min(1,
            bitmaskSimilarity * weights.bitmask +
            momentSimilarity * weights.moments +
            matrixSimilarity * weights.matrix +
            vectorSimilarity * weights.vector +
            topologySimilarity * weights.topology
        ));

        // 🔴 КОМБИНИРОВАННЫЕ КРИТЕРИИ ДЛЯ РЕШЕНИЯ
        let decision, reason;

        // Критически важны матрица и топология
        const criticalPass = matrixSimilarity > 0.7 && topologySimilarity > 0.65;

        // 🔴 СПЕЦИАЛЬНАЯ ЛОГИКА ДЛЯ ПОХОЖИХ ФОРМ РАЗНОГО РАЗМЕРА
        const isSimilarShapeDifferentSize =
            momentSimilarity > 0.9 && // Очень похожие моменты (форма)
            matrixSimilarity > 0.7 && // Похожие матрицы (структура)
            topologySimilarity > 0.6 && // Приемлемая топология
            sizeRatio < 0.7 && sizeRatio > 0.4; // Разные, но не экстремальные размеры

        // 🔴 НОВАЯ ЛОГИКА: УЧЁТ ТОПОЛОГИЧЕСКОЙ СХОЖЕСТИ
        if (topologySimilarity > 0.8 && totalSimilarity > 0.85) {
            decision = 'same';
            reason = `Высокая топологическая схожесть (${totalSimilarity.toFixed(3)})`;
        }
        else if (isSimilarShapeDifferentSize && totalSimilarity > 0.7) {
            decision = 'similar';
            reason = `Похожие топологии разного размера (${totalSimilarity.toFixed(3)})`;
        }
        else if (criticalPass && totalSimilarity > 0.8) {
            decision = 'same';
            reason = `Схожие структуры и топология (${totalSimilarity.toFixed(3)})`;
        } else if (totalSimilarity > 0.7 && topologySimilarity > 0.6) {
            decision = 'similar';
            reason = `Похожая топология (${totalSimilarity.toFixed(3)})`;
        } else {
            decision = 'different';
            reason = `Разные топологии (${totalSimilarity.toFixed(3)})`;
        }

        console.log(`📊 Каскадное сравнение завершено: ${totalSimilarity.toFixed(3)} (${decision})`);
        console.log(`   🎭 Матрица: ${matrixSimilarity.toFixed(3)}, Векторы: ${vectorSimilarity.toFixed(3)}`);
        console.log(`   🏗️ Топология: ${topologySimilarity.toFixed(3)}`);
        console.log(`   📏 Соотношение размеров: ${sizeRatio.toFixed(2)}`);

        return {
            similarity: totalSimilarity,
            decision,
            reason,
            steps,
            criticalPass,
            isSimilarShapeDifferentSize,
            details: {
                bitmask: bitmaskResult,
                moments: momentResult,
                matrix: matrixResult,
                vector: vectorResult,
                topology: topologyResult,
                weights,
                sizeRatio
            },
            timeMs: Date.now() - startTime
        };
    }

    // 🔴 НОВЫЙ МЕТОД: ТОПОЛОГИЧЕСКОЕ СРАВНЕНИЕ ГРАФОВ
    compareTopology(otherGraph) {
        console.log('🏗️ Выполняю топологическое сравнение графов...');
       
        try {
            // Создать TopologyMerger для сравнения
            const topologyMerger = new TopologyMerger({
                structuralSimilarityThreshold: 0.6,
                preserveTopology: true
            });
           
            // Получить структурные соответствия
            const structuralMatches = topologyMerger.findStructuralMatches(
                this.graphToVectorGraph(this.graph),
                this.graphToVectorGraph(otherGraph)
            );
           
            // Рассчитать схожесть на основе структурных соответствий
            const vectorGraph1 = this.graphToVectorGraph(this.graph);
            const vectorGraph2 = this.graphToVectorGraph(otherGraph);
           
            const structuralSimilarity = topologyMerger.calculateStructuralSimilarity(
                vectorGraph1, vectorGraph2, structuralMatches
            );
           
            // Рассчитать топологическую сохранность
            const topologyPreservation = topologyMerger.calculateTopologyPreservation(
                vectorGraph1, vectorGraph2, structuralMatches
            );
           
            // Комбинированный score
            const topologyScore = (structuralSimilarity * 0.7 + topologyPreservation * 0.3);
           
            console.log(`   🏗️ Структурных соответствий: ${structuralMatches.length}`);
            console.log(`   📊 Структурная схожесть: ${structuralSimilarity.toFixed(3)}`);
            console.log(`   🔗 Сохранение топологии: ${(topologyPreservation * 100).toFixed(1)}%`);
           
            return {
                similarity: Math.max(0, Math.min(1, topologyScore)),
                structuralMatches: structuralMatches.length,
                structuralSimilarity: structuralSimilarity,
                topologyPreservation: topologyPreservation,
                topologyScore: topologyScore,
                method: 'topology_comparison'
            };
           
        } catch (error) {
            console.log(`⚠️ Ошибка топологического сравнения: ${error.message}`);
            return {
                similarity: 0,
                error: error.message,
                method: 'topology_failed'
            };
        }
    }

    // 🔴 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: ГРАФ -> ВЕКТОРНЫЙ ГРАФ
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

    // 4. ПРОСТОЕ СРАВНЕНИЕ ГРАФОВ (если нет matcher)
    compareGraphsSimple(otherGraph) {
        const invariants1 = this.graph.getBasicInvariants();
        const invariants2 = otherGraph.getBasicInvariants();

        const comparisons = [
            { name: 'nodeCount', score: Math.min(invariants1.nodeCount, invariants2.nodeCount) / Math.max(invariants1.nodeCount, invariants2.nodeCount) },
            { name: 'edgeCount', score: Math.min(invariants1.edgeCount, invariants2.edgeCount) / Math.max(invariants1.edgeCount, invariants2.edgeCount) },
            { name: 'avgDegree', score: 1 - Math.min(1, Math.abs(invariants1.avgDegree - invariants2.avgDegree) / 3) },
            { name: 'clustering', score: 1 - Math.min(1, Math.abs((invariants1.clusteringCoefficient || 0) - (invariants2.clusteringCoefficient || 0)) / 0.3) }
        ];

        const similarity = comparisons.reduce((sum, c) => sum + c.score, 0) / comparisons.length;

        return {
            similarity: Math.max(0, Math.min(1, similarity)),
            comparisons,
            invariants1,
            invariants2
        };
    }

    // 5. ОБЪЕДИНЕНИЕ С ДРУГИМ ОТПЕЧАТКОМ
    merge(otherFootprint, transformation = null) {
        console.log(`🔄 Объединяю с "${otherFootprint.name}"...`);

        // Проверить, можно ли объединять
        const comparison = this.compare(otherFootprint);

        if (comparison.decision !== 'same' && comparison.similarity < 0.6) {
            console.log(`❌ Не могу объединить: ${comparison.reason}`);
            return {
                success: false,
                reason: comparison.reason,
                similarity: comparison.similarity
            };
        }

        // Объединить битовые маски
        this.bitmask.bitmask = BitmaskFootprint.mergeMasks(
            this.bitmask.bitmask,
            otherFootprint.bitmask.bitmask
        );

        // Объединить точки графа (простое объединение)
        const previousNodeCount = this.graph.nodes.size;

        // 🔴 ВАЛИДИРОВАТЬ И ОБЪЕДИНИТЬ ТОЧКИ
        const combinedPoints = ConfidenceValidator.validatePointsArray([
            ...this.originalPoints,
            ...(otherFootprint.originalPoints || [])
        ]);

        // Перестроить граф из всех точек
        this.graph.buildFromPoints(combinedPoints);
        this.originalPoints = combinedPoints;

        // Обновить метаданные
        this.metadata.totalPhotos += otherFootprint.metadata.totalPhotos || 1;
        this.metadata.lastUpdated = new Date();

        if (transformation) {
            this.metadata.transformations.push({
                timestamp: new Date(),
                with: otherFootprint.id,
                transformation: transformation
            });
        }

        // Пересчитать моменты из объединённых точек
        this.moments.calculateFromPoints(this.originalPoints);

        // Пересчитать матрицу расстояний
        this.distanceMatrix.createFromPoints(this.originalPoints);

        // Пересчитать векторную схему
        this.vectorGraph.createFromPoints(this.originalPoints);

        // Добавить точки в трекер
        if (otherFootprint.originalPoints) {
            this.pointTracker.processNewPoints(otherFootprint.originalPoints, {
                source: 'merge',
                fromFootprint: otherFootprint.id,
                transformation: transformation
            });
        }

        // Обновить статистику
        this.updateConfidence();

        const addedNodes = this.graph.nodes.size - previousNodeCount;

        console.log(`✅ Объединено успешно!`);
        console.log(`   📊 +${addedNodes} узлов, всего ${this.graph.nodes.size}`);
        console.log(`   📸 Всего фото: ${this.metadata.totalPhotos}`);
        console.log(`   💎 Уверенность: ${Math.round(this.stats.confidence * 100)}%`);

        return {
            success: true,
            addedNodes,
            totalNodes: this.graph.nodes.size,
            totalPhotos: this.metadata.totalPhotos,
            similarity: comparison.similarity,
            confidence: this.stats.confidence
        };
    }

    // 6. ОБЪЕДИНЕНИЕ С ПРЕОБРАЗОВАНИЕМ - ТЕПЕРЬ ТОПОЛОГИЧЕСКОЕ!
    mergeWithTransformation(otherFootprint) {
        console.log(`🏗️ Топологическое объединение с "${otherFootprint.name}"...`);

        // 🔴 ШАГ 1: ПРОВЕРИТЬ ТОЧКИ ПЕРЕД СЛИЯНИЕМ
        const points1Issues = ConfidenceValidator.checkForConfidenceIssues(this.originalPoints);
        const points2Issues = ConfidenceValidator.checkForConfidenceIssues(otherFootprint.originalPoints);

        if (points1Issues.length > 0 || points2Issues.length > 0) {
            console.log('⚠️ Обнаружены проблемы с точками перед слиянием:');
            [...points1Issues, ...points2Issues].forEach(issue => {
                console.log(`   ${issue.type}: ${issue.message}`);
            });

            // Автоматически исправить
            this.originalPoints = ConfidenceValidator.validatePointsArray(this.originalPoints);
            otherFootprint.originalPoints = ConfidenceValidator.validatePointsArray(otherFootprint.originalPoints);
        }

        // 🔴 ШАГ 2: ПРОВЕРКА СТРУКТУРНОЙ СХОЖЕСТИ
        const vectorComparison = this.vectorGraph.compare(otherFootprint.vectorGraph);
        const topologyComparison = this.compareTopology(otherFootprint.graph);

        if (vectorComparison.similarity < 0.3 || topologyComparison.similarity < 0.5) {
            console.log(`❌ Отпечатки слишком разные структурно: `);
            console.log(`   Векторы: ${vectorComparison.similarity.toFixed(3)}, Топология: ${topologyComparison.similarity.toFixed(3)}`);
            return {
                success: false,
                reason: `Отпечатки слишком разные структурно`,
                details: { vector: vectorComparison.similarity, topology: topologyComparison.similarity }
            };
        }

        // 🔴 ШАГ 3: ИСПОЛЬЗОВАТЬ ТОПОЛОГИЧЕСКИЙ МЕРЖЕР
        const topologyMerger = new TopologyMerger({
            structuralSimilarityThreshold: 0.6,
            preserveTopology: true,
            confidenceBoost: 1.4,
            maxMergeDistance: 35
        });

        const topologyMergeResult = topologyMerger.mergeGraphs(
            this.graph,
            otherFootprint.graph,
            vectorComparison.transformation
        );

        if (!topologyMergeResult.success) {
            console.log(`❌ Топологическое слияние не удалось: ${topologyMergeResult.reason}`);
            // Попробовать старый метод как запасной вариант
            return this.fallbackToPointMerge(otherFootprint, vectorComparison);
        }

        // 🔴 ШАГ 4: ОБНОВИТЬ ГРАФ ТОПОЛОГИЧЕСКИМ РЕЗУЛЬТАТОМ
        this.graph = topologyMergeResult.mergedGraph;
       
        // Обновить оригинальные точки из объединённого графа
        this.originalPoints = Array.from(this.graph.nodes.values()).map(node => ({
            x: node.x,
            y: node.y,
            confidence: node.confidence || 0.5,
            source: node.source || 'topology_merge'
        }));

        // 🔴 ШАГ 5: ОБНОВИТЬ ВСЕ ПРЕДСТАВЛЕНИЯ
        this.bitmask.createFromPoints(this.originalPoints);
        this.moments.calculateFromPoints(this.originalPoints);
        this.distanceMatrix.createFromPoints(this.originalPoints);
        this.vectorGraph.createFromPoints(this.originalPoints);

        // 🔴 ШАГ 6: ОБНОВИТЬ ТРЕКЕР ТОЧЕК
        this.pointTracker.processNewPoints(
            Array.from(otherFootprint.graph.nodes.values()).map(node => ({
                x: node.x,
                y: node.y,
                confidence: node.confidence || 0.5,
                source: 'topology_merge_input'
            })),
            {
                source: 'topology_merge',
                fromFootprint: otherFootprint.id,
                transformation: vectorComparison.transformation,
                mergeStats: topologyMergeResult.stats
            }
        );

        // 🔴 ШАГ 7: ОБНОВИТЬ МЕТАДАННЫЕ
        this.metadata.totalPhotos += otherFootprint.metadata.totalPhotos || 1;
        this.metadata.lastUpdated = new Date();
        this.metadata.topologyMerges = (this.metadata.topologyMerges || 0) + 1;
        this.metadata.transformations.push({
            timestamp: new Date(),
            with: otherFootprint.id,
            transformation: vectorComparison.transformation,
            topologySimilarity: topologyMergeResult.structuralSimilarity,
            structuralMatches: topologyMergeResult.structuralMatches.length,
            method: 'topology_merge'
        });

        // 🔴 ШАГ 8: ОБНОВИТЬ СТАТИСТИКУ
        this.updateConfidence();

        // 🔴 ШАГ 9: РАССЧИТАТЬ МЕТРИКИ
        const metrics = this.calculateTopologyMergeMetrics(
            topologyMergeResult,
            vectorComparison,
            otherFootprint
        );

        console.log(`✅ Топологическое объединение успешно!`);
        console.log(`   🏗️ Структурных соответствий: ${topologyMergeResult.structuralMatches.length}`);
        console.log(`   📊 Топологическая схожесть: ${topologyMergeResult.structuralSimilarity.toFixed(3)}`);
        console.log(`   🔗 Сохранено топологии: ${metrics.preservedStructures}%`);
        console.log(`   📉 Сокращение дубликатов: ${metrics.efficiency}%`);
        console.log(`   💎 Новая уверенность: ${Math.round(this.stats.confidence * 100)}%`);
        console.log(`   📈 Улучшение confidence: ${metrics.confidenceImprovement}%`);
        console.log(`   🎯 Топологический score: ${this.stats.topologyScore.toFixed(3)}`);

        return {
            success: true,
            transformation: vectorComparison.transformation,
            topologyMergeResult: topologyMergeResult,
            allPoints: this.originalPoints.length,
            mergedNodes: topologyMergeResult.mergedNodes,
            confidence: this.stats.confidence,
            metrics: metrics,
            stats: {
                before: {
                    nodes1: this.graph.nodes.size,
                    nodes2: otherFootprint.graph.nodes.size
                },
                after: {
                    total: this.graph.nodes.size,
                    edges: this.graph.edges.size
                },
                topology: {
                    structuralMatches: topologyMergeResult.structuralMatches.length,
                    similarity: topologyMergeResult.structuralSimilarity,
                    preservation: metrics.preservedStructures
                }
            },
            method: 'topology_merge'
        };
    }

    // 🔴 НОВЫЙ МЕТОД: МЕТРИКИ ТОПОЛОГИЧЕСКОГО СЛИЯНИЯ
    calculateTopologyMergeMetrics(topologyResult, vectorComparison, otherFootprint) {
        const beforeNodes1 = this.graph.nodes.size;
        const beforeNodes2 = otherFootprint.graph.nodes.size;
        const afterNodes = topologyResult.mergedGraph.nodes.size;
       
        const beforeEdges1 = this.graph.edges.size;
        const beforeEdges2 = otherFootprint.graph.edges.size;
        const afterEdges = topologyResult.mergedGraph.edges.size;
       
        const nodeReduction = (beforeNodes1 + beforeNodes2) - afterNodes;
        const efficiency = beforeNodes1 + beforeNodes2 > 0
            ? (nodeReduction / (beforeNodes1 + beforeNodes2)) * 100
            : 0;
       
        const edgePreservation = beforeEdges1 + beforeEdges2 > 0
            ? (afterEdges / (beforeEdges1 + beforeEdges2)) * 100
            : 100;
       
        // Confidence improvement
        const confidenceBefore = this.stats.confidence;
        const confidenceAfter = this.stats.confidence; // Уже обновлён
        const confidenceImprovement = confidenceBefore > 0
            ? ((confidenceAfter - confidenceBefore) / confidenceBefore) * 100
            : 0;
       
        return {
            preservedStructures: Math.round(edgePreservation),
            efficiency: efficiency.toFixed(1),
            nodeReduction: nodeReduction,
            edgePreservation: edgePreservation.toFixed(1),
            confidenceImprovement: confidenceImprovement.toFixed(1),
            structuralSimilarity: topologyResult.structuralSimilarity.toFixed(3),
            transformationConfidence: vectorComparison.transformation?.confidence?.toFixed(3) || 'N/A'
        };
    }

    // 🔴 НОВЫЙ МЕТОД: ЗАПАСНОЙ ВАРИАНТ С ГЕОМЕТРИЧЕСКИМ СЛИЯНИЕМ
    fallbackToPointMerge(otherFootprint, vectorComparison) {
        console.log(`🔄 Использую геометрическое слияние как запасной вариант...`);
       
        // Извлечь точки
        const points1 = this.originalPoints;
        const points2 = otherFootprint.originalPoints;
       
        // Использовать старый PointMerger
        const PointMerger = require('./point-merger');
        const pointMerger = new PointMerger({
            mergeDistance: 40,
            confidenceBoost: 1.3
        });
       
        const mergeResult = pointMerger.mergePoints(
            points1,
            points2,
            vectorComparison.transformation
        );
       
        // Обновить оригинальные точки
        this.originalPoints = ConfidenceValidator.validatePointsArray(mergeResult.points);
       
        // Пересчитать все представления
        this.bitmask.createFromPoints(this.originalPoints);
        this.moments.calculateFromPoints(this.originalPoints);
        this.distanceMatrix.createFromPoints(this.originalPoints);
        this.vectorGraph.createFromPoints(this.originalPoints);
       
        // Перестроить граф
        this.graph.buildFromPoints(this.originalPoints);
       
        // Обновить метаданные
        this.metadata.totalPhotos += otherFootprint.metadata.totalPhotos || 1;
        this.metadata.lastUpdated = new Date();
        this.metadata.transformations.push({
            timestamp: new Date(),
            with: otherFootprint.id,
            transformation: vectorComparison.transformation,
            method: 'geometric_fallback',
            mergeStats: mergeResult.stats
        });
       
        // Обновить статистику
        this.updateConfidence();
       
        console.log(`✅ Геометрическое слияние успешно (запасной вариант)`);
        console.log(`   📊 Точки до: ${points1.length + points2.length}, после: ${mergeResult.points.length}`);
       
        return {
            success: true,
            transformation: vectorComparison.transformation,
            mergeResult: mergeResult,
            allPoints: mergeResult.points.length,
            mergedPoints: mergeResult.stats.mergedPoints,
            confidence: this.stats.confidence,
            metrics: {
                efficiency: mergeResult.stats.efficiency,
                confidenceImprovement: 'N/A',
                method: 'geometric_fallback'
            },
            method: 'geometric_fallback'
        };
    }

    // 7. БЫСТРЫЙ ПОИСК ПО БИТОВОЙ МАСКЕ (для базы данных)
    static fastSearch(queryBitmask, database, maxDistance = 20) {
        const startTime = Date.now();
        const results = [];

        database.forEach((item, index) => {
            if (item.bitmask && item.bitmask.bitmask) {
                const distance = BitmaskFootprint.hammingDistance(
                    queryBitmask,
                    item.bitmask.bitmask
                );

                if (distance <= maxDistance) {
                    results.push({
                        item,
                        index,
                        bitmaskDistance: distance,
                        bitmaskSimilarity: Math.max(0, Math.min(1, 1 - (distance / 64)))
                    });
                }
            }
        });

        // Сортировать по расстоянию
        results.sort((a, b) => a.bitmaskDistance - b.bitmaskDistance);

        console.log(`🔍 Быстрый поиск: ${results.length} кандидатов за ${Date.now() - startTime}мс`);

        return results;
    }

    // 8. ПОЛУЧИТЬ ИНФОРМАЦИЮ
    getInfo() {
        const trackerStats = this.pointTracker.getStats();

        return {
            id: this.id,
            name: this.name,
            userId: this.userId,
            stats: {
                ...this.stats,
                confidence: Math.round(this.stats.confidence * 1000) / 1000,
                qualityScore: Math.round(this.stats.qualityScore * 100),
                topologyScore: Math.round(this.stats.topologyScore * 1000) / 1000
            },
            metadata: {
                ...this.metadata,
                created: this.metadata.created.toLocaleString('ru-RU'),
                lastUpdated: this.metadata.lastUpdated.toLocaleString('ru-RU'),
                topologyMerges: this.metadata.topologyMerges || 0
            },
            representations: {
                bitmask: `0x${this.bitmask.bitmask.toString(16).slice(0, 8)}...`,
                moments: this.moments.get7Moments().length,
                graphNodes: this.graph.nodes.size,
                graphEdges: this.graph.edges.size,
                matrixSize: this.getMatrixSizeString(),
                vectorCount: this.getVectorCount(),
                trackerPoints: trackerStats.totalPoints,
                trackerConfidence: trackerStats.confidence,
                topologyScore: Math.round(this.stats.topologyScore * 100) + '%'
            }
        };
    }

    // 9. ВИЗУАЛИЗИРОВАТЬ ВСЕ ПРЕДСТАВЛЕНИЯ
    visualize() {
        console.log(`\n🎭 ГИБРИДНЫЙ ОТПЕЧАТОК "${this.name}":`);
        console.log(`├─ ID: ${this.id}`);
        console.log(`├─ Уверенность: ${Math.round(this.stats.confidence * 100)}%`);
        console.log(`├─ Топологический score: ${Math.round(this.stats.topologyScore * 100)}%`);
        console.log(`├─ Качество: ${Math.round(this.stats.qualityScore * 100)}%`);
        console.log(`├─ Фото: ${this.metadata.totalPhotos}`);
        console.log(`├─ Топологических слияний: ${this.metadata.topologyMerges || 0}`);
        console.log(`└─ Создан: ${this.metadata.created.toLocaleString('ru-RU')}`);

        console.log(`\n🎭 ПРЕДСТАВЛЕНИЯ:`);
        console.log(`├─ Битовая маска:`);
        this.bitmask.visualize();

        console.log(`\n├─ Геометрические моменты:`);
        this.moments.visualize();

        console.log(`\n├─ Матрица расстояний:`);
        this.distanceMatrix.visualize(8);

        console.log(`\n├─ Векторная схема:`);
        this.vectorGraph.visualize();

        console.log(`\n├─ Трекер точек:`);
        this.pointTracker.visualize();

        console.log(`\n├─ Граф:`);
        this.graph.visualize();
       
        console.log(`\n└─ Топология:`);
        this.visualizeTopology();
    }

    // 🔴 НОВЫЙ МЕТОД: ВИЗУАЛИЗАЦИЯ ТОПОЛОГИИ
    visualizeTopology() {
        const invariants = this.graph.getBasicInvariants();
        const uniformity = this.calculateNodeUniformity();
       
        console.log(`   ├─ Узлов: ${invariants.nodeCount}`);
        console.log(`   ├─ Рёбер: ${invariants.edgeCount}`);
        console.log(`   ├─ Средняя степень: ${invariants.avgDegree?.toFixed(2) || 'N/A'}`);
        console.log(`   ├─ Коэффициент кластеризации: ${invariants.clusteringCoefficient?.toFixed(3) || 'N/A'}`);
        console.log(`   ├─ Равномерность распределения: ${Math.round(uniformity * 100)}%`);
        console.log(`   └─ Топологический score: ${Math.round(this.stats.topologyScore * 100)}%`);
    }

    // 10. СОХРАНИТЬ В JSON
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            userId: this.userId,
            bitmask: this.bitmask.toJSON(),
            moments: this.moments.toJSON(),
            graph: this.graph.toJSON(),
            distanceMatrix: this.distanceMatrix.toJSON(),
            vectorGraph: this.vectorGraph.toJSON(),
            pointTracker: this.pointTracker.toJSON(),
            originalPoints: this.originalPoints,
            metadata: {
                ...this.metadata,
                created: this.metadata.created.toISOString(),
                lastUpdated: this.metadata.lastUpdated.toISOString()
            },
            stats: this.stats,
            _version: '2.1', // 🔴 ОБНОВЛЕНА ВЕРСИЯ
            _topologyEnabled: true, // 🔴 НОВЫЙ ФЛАГ
            _savedAt: new Date().toISOString()
        };
    }

    // 11. ЗАГРУЗИТЬ ИЗ JSON
    static fromJSON(data) {
        console.log(`📂 Загружаю гибридный отпечаток "${data.name}"...`);

        const footprint = new HybridFootprint({
            id: data.id,
            name: data.name,
            userId: data.userId,
            bitmaskData: data.bitmask,
            momentData: data.moments,
            graph: SimpleGraph.fromJSON(data.graph),
            distanceMatrixData: data.distanceMatrix,
            vectorGraphData: data.vectorGraph,
            pointTrackerData: data.pointTracker,
            originalPoints: data.originalPoints || [],
            metadata: data.metadata,
            confidence: data.stats?.confidence
        });

        if (data.stats) {
            // 🔴 ОГРАНИЧИТЬ CONFIDENCE ПРИ ЗАГРУЗКЕ
            footprint.stats.confidence = Math.max(0.0, Math.min(1.0, data.stats.confidence || 0.5));
            // 🔴 ВОССТАНОВИТЬ ТОПОЛОГИЧЕСКИЙ SCORE
            footprint.stats.topologyScore = data.stats.topologyScore || footprint.calculateTopologyScore();
        }

        console.log(`✅ Загружен гибридный отпечаток "${footprint.name}" версии ${data._version || '1.0'}`);
        if (data._topologyEnabled) {
            console.log(`   🏗️ Топологический режим: ВКЛЮЧЕН`);
        }

        return footprint;
    }

    // 12. ТЕСТ: СОЗДАТЬ И СРАВНИТЬ ДВА ОТПЕЧАТКА
    static testComparison() {
        console.log('\n🧪 ТЕСТ ГИБРИДНОЙ СИСТЕМЫ С ТОПОЛОГИЕЙ:');

        // Создать два похожих отпечатка
        const points1 = [];
        const points2 = [];

        for (let i = 0; i < 30; i++) {
            points1.push({
                x: 100 + Math.random() * 200,
                y: 100 + Math.random() * 100,
                confidence: 0.8,
                source: 'test1'
            });

            // points2 - немного смещённая версия points1
            points2.push({
                x: points1[i].x + Math.random() * 20 - 10,
                y: points1[i].y + Math.random() * 20 - 10,
                confidence: 0.8,
                source: 'test2'
            });
        }

        const footprint1 = new HybridFootprint({ name: 'Тест 1' });
        const footprint2 = new HybridFootprint({ name: 'Тест 2' });

        footprint1.createFromPoints(points1);
        footprint2.createFromPoints(points2);

        console.log('\n🔍 СРАВНЕНИЕ:');
        const result = footprint1.compare(footprint2);

        console.log(`📊 Similarity: ${result.similarity.toFixed(3)}`);
        console.log(`🤔 Decision: ${result.decision}`);
        console.log(`💡 Reason: ${result.reason}`);
        console.log(`⏱️ Time: ${result.timeMs}ms`);

        if (result.steps) {
            console.log('\n📈 ШАГИ КАСКАДА:');
            result.steps.forEach((step, i) => {
                console.log(`${i+1}. ${step.step}: ${step.result?.similarity?.toFixed(3) || 'N/A'} (${step.time}ms)`);
            });
        }

        // Тест топологического объединения
        console.log('\n🏗️ ТЕСТ ТОПОЛОГИЧЕСКОГО ОБЪЕДИНЕНИЯ:');
        const mergeResult = footprint1.mergeWithTransformation(footprint2);
        console.log(`✅ Успех: ${mergeResult.success}`);
        if (mergeResult.success) {
            console.log(`   🏗️ Метод: ${mergeResult.method}`);
            console.log(`   📊 Всего точек: ${mergeResult.allPoints}`);
            console.log(`   🔗 Слито узлов: ${mergeResult.mergedNodes}`);
            console.log(`   💎 Уверенность: ${Math.round(mergeResult.confidence * 100)}%`);
            console.log(`   🎯 Топологический score: ${footprint1.stats.topologyScore.toFixed(3)}`);
        }

        return result;
    }

    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ для исправления ошибок

    // Получить количество векторов (безопасно)
    getVectorCount() {
        try {
            // Попробовать метод getVectorCount, если он существует
            if (this.vectorGraph && typeof this.vectorGraph.getVectorCount === 'function') {
                const count = this.vectorGraph.getVectorCount();
                return Math.max(0, count || 0);
            }
            // Если метод отсутствует, попробовать получить данные из starVectors
            if (this.vectorGraph && this.vectorGraph.starVectors && Array.isArray(this.vectorGraph.starVectors)) {
                const count = this.vectorGraph.starVectors.reduce((sum, sv) =>
                    sum + (sv.vectors ? sv.vectors.length : 0), 0);
                return Math.max(0, count);
            }
            return 0;
        } catch (error) {
            console.log('⚠️ Ошибка при получении количества векторов:', error.message);
            return 0;
        }
    }

    // Получить размер матрицы (безопасно)
    getMatrixSizeString() {
        try {
            if (this.distanceMatrix && typeof this.distanceMatrix.getSizeString === 'function') {
                return this.distanceMatrix.getSizeString();
            }
            if (this.distanceMatrix && this.distanceMatrix.matrix && Array.isArray(this.distanceMatrix.matrix)) {
                const rows = this.distanceMatrix.matrix.length;
                const cols = rows > 0 && this.distanceMatrix.matrix[0] ? this.distanceMatrix.matrix[0].length : 0;
                return `${rows}x${cols}`;
            }
            return '0x0';
        } catch (error) {
            console.log('⚠️ Ошибка при получении размера матрицы:', error.message);
            return '0x0';
        }
    }
}

module.exports = HybridFootprint;
