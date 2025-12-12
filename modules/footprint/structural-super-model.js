// modules/footprint/structural-super-model.js
// СТРУКТУРНАЯ СУПЕР-МОДЕЛЬ - ОБЪЕДИНЕНИЕ ИНВАРИАНТОВ

const TopologyMerger = require('./topology-merger');
const VectorGraph = require('./vector-graph');

class StructuralSuperModel {
    constructor(options = {}) {
        this.config = {
            minModels: options.minModels || 3,
            topologyThreshold: options.topologyThreshold || 0.7,
            confidenceThreshold: options.confidenceThreshold || 0.8,
            maxModelsToMerge: options.maxModelsToMerge || 5,
            ...options
        };
       
        this.topologyMerger = new TopologyMerger({
            structuralSimilarityThreshold: this.config.topologyThreshold,
            preserveTopology: true
        });
       
        this.models = [];
        this.mergedGraph = null;
        this.structuralInvariants = {};
    }
   
    // 1. ДОБАВИТЬ МОДЕЛЬ В СУПЕР-МОДЕЛЬ
    addModel(footprint) {
        if (!footprint.graph || footprint.graph.nodes.size < 10) {
            console.log(`⚠️ Модель "${footprint.name}" слишком мала для супер-модели`);
            return false;
        }
       
        this.models.push({
            footprint,
            graph: footprint.graph,
            hybrid: footprint.hybridFootprint,
            invariants: this.calculateStructuralInvariants(footprint.graph),
            addedAt: new Date()
        });
       
        console.log(`📦 Добавлена модель в супер-модель: ${footprint.name} (${footprint.graph.nodes.size} узлов)`);
        return true;
    }
   
    // 2. РАССЧИТАТЬ СТРУКТУРНЫЕ ИНВАРИАНТЫ
    calculateStructuralInvariants(graph) {
        const invariants = {
            // Базовые
            nodeCount: graph.nodes.size,
            edgeCount: graph.edges.size,
            avgDegree: 0,
           
            // Топологические
            clusteringCoefficient: this.calculateClusteringCoefficient(graph),
            degreeDistribution: this.calculateDegreeDistribution(graph),
            connectivity: this.calculateConnectivity(graph),
           
            // Геометрические
            boundingBox: this.calculateBoundingBox(graph),
            centroid: this.calculateCentroid(graph),
           
            // Векторные
            vectorSignature: this.calculateVectorSignature(graph)
        };
       
        // Средняя степень
        if (graph.nodes.size > 0) {
            let totalDegree = 0;
            for (const [_, edge] of graph.edges) {
                totalDegree += 2; // Каждое ребро добавляет степень 2
            }
            invariants.avgDegree = totalDegree / graph.nodes.size;
        }
       
        return invariants;
    }
   
    // 3. СОЗДАТЬ СУПЕР-МОДЕЛЬ (ОСНОВНОЙ МЕТОД)
    async createSuperModel() {
        if (this.models.length < this.config.minModels) {
            console.log(`⚠️ Недостаточно моделей для супер-модели: ${this.models.length} < ${this.config.minModels}`);
            return null;
        }
       
        console.log(`🏗️ Создаю структурную супер-модель из ${this.models.length} моделей...`);
       
        // 1. ВЫБРАТЬ ЛУЧШИЕ МОДЕЛИ
        const bestModels = this.selectBestModels();
        console.log(`🎯 Выбрано ${bestModels.length} лучших моделей для слияния`);
       
        // 2. ПОСЛЕДОВАТЕЛЬНОЕ СЛИЯНИЕ
        let superModel = bestModels[0];
        const mergedModels = [superModel.footprint];
       
        for (let i = 1; i < bestModels.length; i++) {
            const currentModel = bestModels[i];
           
            console.log(`🔄 Сливаю с "${currentModel.footprint.name}"...`);
           
            // Использовать топологическое слияние
            const mergeResult = this.topologyMerger.mergeGraphs(
                superModel.graph,
                currentModel.graph
            );
           
            if (mergeResult.success) {
                superModel = {
                    footprint: this.createMergedFootprint(superModel, currentModel, mergeResult),
                    graph: mergeResult.mergedGraph,
                    mergedAt: new Date()
                };
                mergedModels.push(currentModel.footprint);
               
                console.log(`✅ Добавлено: ${mergeResult.mergedGraph.nodes.size} узлов`);
                console.log(`   🏗️ Топологическая схожесть: ${mergeResult.structuralSimilarity.toFixed(3)}`);
            } else {
                console.log(`⚠️ Пропущено: ${mergeResult.reason}`);
            }
        }
       
        // 3. СОЗДАТЬ ФИНАЛЬНУЮ СУПЕР-МОДЕЛЬ
        this.mergedGraph = superModel.graph;
        this.structuralInvariants = this.calculateSuperModelInvariants();
       
        console.log(`🌟 СТРУКТУРНАЯ СУПЕР-МОДЕЛЬ СОЗДАНА!`);
        console.log(`   📊 ${mergedModels.length} моделей объединены`);
        console.log(`   🏗️ ${this.mergedGraph.nodes.size} узлов, ${this.mergedGraph.edges.size} рёбер`);
        console.log(`   🎯 Топологическая целостность: ${this.calculateTopologyIntegrity()}%`);
       
        return {
            success: true,
            superModel: superModel.footprint,
            mergedGraph: this.mergedGraph,
            mergedModels: mergedModels.length,
            stats: {
                totalNodes: this.mergedGraph.nodes.size,
                totalEdges: this.mergedGraph.edges.size,
                topologyIntegrity: this.calculateTopologyIntegrity(),
                modelCoverage: (mergedModels.length / this.models.length) * 100
            }
        };
    }
   
    // 4. ВЫБРАТЬ ЛУЧШИЕ МОДЕЛИ ДЛЯ СЛИЯНИЯ
    selectBestModels() {
        return this.models
            .sort((a, b) => {
                // Сортировка по:
                // 1. Качеству топологии (50%)
                // 2. Количеству узлов (30%)
                // 3. Confidence модели (20%)
               
                const scoreA = this.calculateModelScore(a);
                const scoreB = this.calculateModelScore(b);
               
                return scoreB - scoreA;
            })
            .slice(0, this.config.maxModelsToMerge);
    }
   
    // 5. РАСЧЁТ SCORE МОДЕЛИ
    calculateModelScore(model) {
        const topologyScore = model.invariants.clusteringCoefficient * 0.5;
        const sizeScore = Math.min(1, model.invariants.nodeCount / 100) * 0.3;
        const confidenceScore = model.footprint.stats?.confidence || 0.5 * 0.2;
       
        return topologyScore + sizeScore + confidenceScore;
    }
   
    // 6. СОЗДАТЬ ОБЪЕДИНЁННЫЙ ОТПЕЧАТОК
    createMergedFootprint(model1, model2, mergeResult) {
        const SimpleFootprint = require('./simple-footprint');
        const HybridFootprint = require('./hybrid-footprint');
       
        const mergedFootprint = new SimpleFootprint({
            name: `Структурная супер-модель ${new Date().toLocaleDateString('ru-RU')}`,
            userId: model1.footprint.userId
        });
       
        // Установить объединённый граф
        mergedFootprint.graph = mergeResult.mergedGraph;
       
        // Создать гибридный отпечаток если есть
        if (model1.hybrid || model2.hybrid) {
            try {
                const hybrid = new HybridFootprint({
                    name: mergedFootprint.name,
                    userId: mergedFootprint.userId
                });
               
                // Создать точки из графа
                const points = Array.from(mergeResult.mergedGraph.nodes.values()).map(node => ({
                    x: node.x,
                    y: node.y,
                    confidence: node.confidence || 0.7,
                    source: 'structural_super_model'
                }));
               
                hybrid.createFromPoints(points);
                mergedFootprint.setHybridFootprint(hybrid);
            } catch (error) {
                console.log('⚠️ Не удалось создать гибридный отпечаток для супер-модели:', error.message);
            }
        }
       
        // Добавить метаданные
        mergedFootprint.metadata.structuralSuperModel = true;
        mergedFootprint.metadata.mergedFrom = [
            model1.footprint.id,
            model2.footprint.id
        ];
        mergedFootprint.metadata.topologySimilarity = mergeResult.structuralSimilarity;
        mergedFootprint.metadata.createdAt = new Date();
       
        return mergedFootprint;
    }
   
    // 7. РАССЧИТАТЬ ИНВАРИАНТЫ СУПЕР-МОДЕЛИ
    calculateSuperModelInvariants() {
        if (!this.mergedGraph) return {};
       
        const invariants = this.calculateStructuralInvariants(this.mergedGraph);
       
        // Дополнительные метрики для супер-модели
        invariants.modelDiversity = this.calculateModelDiversity();
        invariants.structuralStability = this.calculateStructuralStability();
        invariants.coverageRate = this.models.length > 0 ?
            (this.models.filter(m => m.invariants.nodeCount > 20).length / this.models.length) : 0;
       
        return invariants;
    }
   
    // 8. РАСЧЁТ ЦЕЛОСТНОСТИ ТОПОЛОГИИ
    calculateTopologyIntegrity() {
        if (!this.mergedGraph || this.models.length < 2) return 100;
       
        // Проверить сохранение ключевых структур
        let preservedStructures = 0;
        let totalStructures = 0;
       
        // Простая эвристика: проверить сохранение связей
        for (const model of this.models) {
            const modelEdges = model.graph.edges.size;
            // TODO: Более сложный анализ сохранения топологии
           
            totalStructures += modelEdges;
        }
       
        const mergedEdges = this.mergedGraph.edges.size;
        const expectedEdges = totalStructures / this.models.length;
       
        return expectedEdges > 0 ? Math.min(100, (mergedEdges / expectedEdges) * 100) : 100;
    }
   
    // 9. РАЗНООБРАЗИЕ МОДЕЛЕЙ
    calculateModelDiversity() {
        if (this.models.length < 2) return 1;
       
        const nodeCounts = this.models.map(m => m.invariants.nodeCount);
        const avgNodes = nodeCounts.reduce((a, b) => a + b) / nodeCounts.length;
        const variance = nodeCounts.reduce((v, n) => v + Math.pow(n - avgNodes, 2), 0) / nodeCounts.length;
       
        // Нормализовать дисперсию к [0, 1], где 1 - максимальное разнообразие
        const maxVariance = Math.pow(avgNodes, 2);
        return maxVariance > 0 ? Math.min(1, variance / maxVariance) : 0;
    }
   
    // 10. СТРУКТУРНАЯ СТАБИЛЬНОСТЬ
    calculateStructuralStability() {
        if (this.models.length < 3) return 0.8;
       
        // Проверить согласованность инвариантов между моделями
        const clusteringScores = this.models.map(m => m.invariants.clusteringCoefficient);
        const avgClustering = clusteringScores.reduce((a, b) => a + b) / clusteringScores.length;
        const clusteringStd = Math.sqrt(
            clusteringScores.reduce((s, c) => s + Math.pow(c - avgClustering, 2), 0) / clusteringScores.length
        );
       
        // Стабильность = 1 - нормализованное стандартное отклонение
        return Math.max(0, 1 - (clusteringStd / 0.3));
    }
   
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ РАСЧЁТА ИНВАРИАНТОВ
   
    calculateClusteringCoefficient(graph) {
        const nodes = Array.from(graph.nodes.keys());
        let totalClustering = 0;
        let count = 0;
       
        for (const nodeId of nodes) {
            const neighbors = this.getNeighbors(graph, nodeId);
            const k = neighbors.length;
           
            if (k < 2) continue;
           
            // Количество возможных связей между соседями
            const maxPossible = k * (k - 1) / 2;
            let actualConnections = 0;
           
            // Подсчитать реальные связи между соседями
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    if (this.hasEdgeBetween(graph, neighbors[i], neighbors[j])) {
                        actualConnections++;
                    }
                }
            }
           
            const clustering = maxPossible > 0 ? actualConnections / maxPossible : 0;
            totalClustering += clustering;
            count++;
        }
       
        return count > 0 ? totalClustering / count : 0;
    }
   
    calculateDegreeDistribution(graph) {
        const degreeMap = new Map();
       
        for (const [nodeId] of graph.nodes) {
            const degree = this.getNeighbors(graph, nodeId).length;
            degreeMap.set(degree, (degreeMap.get(degree) || 0) + 1);
        }
       
        return Array.from(degreeMap.entries())
            .map(([degree, count]) => ({ degree, count }));
    }
   
    calculateConnectivity(graph) {
        const visited = new Set();
        let components = 0;
       
        for (const [nodeId] of graph.nodes) {
            if (!visited.has(nodeId)) {
                components++;
                this.dfsConnectivity(graph, nodeId, visited);
            }
        }
       
        return {
            components,
            isConnected: components === 1,
            connectivity: components === 1 ? 1 : Math.max(0, 1 - (components - 1) / graph.nodes.size)
        };
    }
   
    dfsConnectivity(graph, startNode, visited) {
        const stack = [startNode];
       
        while (stack.length > 0) {
            const nodeId = stack.pop();
            if (visited.has(nodeId)) continue;
           
            visited.add(nodeId);
           
            // Добавить всех соседей
            for (const [_, edge] of graph.edges) {
                if (edge.from === nodeId && !visited.has(edge.to)) {
                    stack.push(edge.to);
                } else if (edge.to === nodeId && !visited.has(edge.from)) {
                    stack.push(edge.from);
                }
            }
        }
    }
   
    calculateBoundingBox(graph) {
        const nodes = Array.from(graph.nodes.values());
        if (nodes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
       
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
   
    calculateCentroid(graph) {
        const nodes = Array.from(graph.nodes.values());
        if (nodes.length === 0) return { x: 0, y: 0 };
       
        const sum = nodes.reduce((acc, node) => {
            acc.x += node.x;
            acc.y += node.y;
            return acc;
        }, { x: 0, y: 0 });
       
        return {
            x: sum.x / nodes.length,
            y: sum.y / nodes.length
        };
    }
   
    calculateVectorSignature(graph) {
        try {
            const points = Array.from(graph.nodes.values()).map(node => ({
                x: node.x,
                y: node.y,
                confidence: node.confidence || 0.5
            }));
           
            const vectorGraph = new VectorGraph({ points });
            vectorGraph.createFromPoints(points);
           
            return {
                vectorsCount: vectorGraph.starVectors?.length || 0,
                signature: vectorGraph.starVectors?.[0]?.signature || null
            };
        } catch (error) {
            return { vectorsCount: 0, signature: null };
        }
    }
   
    getNeighbors(graph, nodeId) {
        const neighbors = [];
       
        for (const [_, edge] of graph.edges) {
            if (edge.from === nodeId) {
                neighbors.push(edge.to);
            } else if (edge.to === nodeId) {
                neighbors.push(edge.from);
            }
        }
       
        return [...new Set(neighbors)];
    }
   
    hasEdgeBetween(graph, nodeId1, nodeId2) {
        for (const [_, edge] of graph.edges) {
            if ((edge.from === nodeId1 && edge.to === nodeId2) ||
                (edge.from === nodeId2 && edge.to === nodeId1)) {
                return true;
            }
        }
        return false;
    }
   
    // 11. ВИЗУАЛИЗИРОВАТЬ СУПЕР-МОДЕЛЬ
    async visualizeSuperModel(outputPath = null) {
        if (!this.mergedGraph) {
            console.log('⚠️ Супер-модель ещё не создана');
            return null;
        }
       
        try {
            const TopologyVisualizer = require('./topology-visualizer');
            const visualizer = new TopologyVisualizer();
           
            const footprint = {
                graph: this.mergedGraph,
                name: 'Структурная супер-модель'
            };
           
            return await visualizer.visualizeTopologyInvariants(this.mergedGraph, {
                outputPath,
                title: 'СТРУКТУРНАЯ СУПЕР-МОДЕЛЬ',
                width: 1200,
                height: 800
            });
        } catch (error) {
            console.log('⚠️ Ошибка визуализации супер-модели:', error.message);
            return null;
        }
    }
   
    // 12. СОХРАНИТЬ СУПЕР-МОДЕЛЬ
    saveSuperModel(outputPath) {
        if (!this.mergedGraph) {
            return { success: false, error: 'Супер-модель не создана' };
        }
       
        try {
            const data = {
                mergedGraph: this.mergedGraph.toJSON(),
                structuralInvariants: this.structuralInvariants,
                models: this.models.map(m => ({
                    id: m.footprint.id,
                    name: m.footprint.name,
                    nodes: m.invariants.nodeCount,
                    addedAt: m.addedAt
                })),
                stats: {
                    totalNodes: this.mergedGraph.nodes.size,
                    totalEdges: this.mergedGraph.edges.size,
                    topologyIntegrity: this.calculateTopologyIntegrity(),
                    structuralStability: this.structuralInvariants.structuralStability,
                    modelDiversity: this.structuralInvariants.modelDiversity
                },
                createdAt: new Date().toISOString(),
                version: '1.0'
            };
           
            fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
           
            console.log(`💾 Структурная супер-модель сохранена: ${outputPath}`);
           
            return {
                success: true,
                path: outputPath,
                stats: data.stats
            };
           
        } catch (error) {
            console.log(`❌ Ошибка сохранения супер-модели: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = StructuralSuperModel;
