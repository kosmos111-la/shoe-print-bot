// modules/footprint/topology/TopologyManager.js
// 🎯 УПРАВЛЕНИЕ ТОПОЛОГИЧЕСКИМИ МОДЕЛЯМИ + ТРИАНГУЛЯЦИЯ

const TopologyBuilder = require('./TopologyBuilder');
const TopologicalFingerprint = require('./TopologicalFingerprint');
const TopologicalAccumulator = require('./TopologicalAccumulator');

class TopologyManager {
    constructor(options = {}) {
        this.userId = options.userId || 'default';
        this.name = options.name || `Топология_${this.userId}`;
        this.debug = options.debug || false;

        // Основные компоненты
        this.builder = new TopologyBuilder({ debug: this.debug });
        this.fingerprinter = new TopologicalFingerprint({
            debug: this.debug,
            iterations: options.wlIterations || 3,
            bucketSize: 3,
            similarityThreshold: 0.7
        });
        this.accumulator = new TopologicalAccumulator({
            name: this.name,
            debug: this.debug,
            similarityThreshold: options.similarityThreshold || 0.6,
            minMatchesForEnhancement: options.minMatchesForEnhancement || 3
        });

        // Связь с существующей системой
        this.linkedFootprints = new Map();

        console.log(`🎯 TopologyManager создан для пользователя ${this.userId}`);
        console.log(`   🔺 Триангуляция: активна`);
    }

    async processFootprint(footprint, analysis, photoInfo = {}) {
        console.log(`\n🎯 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА фото ${photoInfo.photoId || 'без ID'}...`);

        const points = this.extractPointsFromCurrentPhoto(analysis, photoInfo);

        if (points.length < 3) {
            return {
                success: false,
                error: 'Недостаточно точек',
                points: points.length
            };
        }

        console.log(`📊 Извлечено ${points.length} точек ИЗ ТЕКУЩЕГО ФОТО`);

        let modelId = this.linkedFootprints.get(footprint.id);
        if (!modelId && this.accumulator.currentModelId) {
            modelId = this.accumulator.currentModelId;
            this.linkedFootprints.set(footprint.id, modelId);
            console.log(`🔗 Связал след ${footprint.id} с моделью ${modelId}`);
        }

        const result = await this.accumulator.processPoints(points, {
            modelId: modelId,
            source: `photo_${photoInfo.photoId || Date.now()}`,
            name: photoInfo.name || `Фото_${new Date().toLocaleTimeString('ru-RU')}`,
            footprintId: footprint.id,
            photoInfo: photoInfo,
            photoId: photoInfo.photoId
        });

        if (result.modelId && result.modelId !== modelId) {
            this.linkedFootprints.set(footprint.id, result.modelId);
            console.log(`🔄 Обновлена связь: след ${footprint.id} → модель ${result.modelId}`);
        }

        const modelInfo = this.accumulator.getModelInfo(result.modelId);

        return {
            success: true,
            topologicalResult: result,
            modelInfo: modelInfo,
            pointsCount: points.length,
            modelId: result.modelId,
            similarity: result.similarity || 0,
            decision: this.getDecisionFromResult(result)
        };
    }

    extractPointsFromCurrentPhoto(analysis, photoInfo = {}) {
        const points = [];

        if (!analysis?.predictions) return points;

        const photoId = photoInfo.photoId || `photo_${Date.now()}`;
        const predictions = analysis.predictions || [];
        let protectorCount = 0;

        predictions.forEach((pred) => {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);

                points.push({
                    id: `${photoId}_pt_${protectorCount}`,
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2,
                    confidence: pred.confidence || 0.5,
                    source: 'current_photo',
                    photoId: photoId,
                    originalIndex: protectorCount,
                    originalPoints: pred.points
                });
                protectorCount++;
            }
        });

        console.log(`📸 Извлечено ${points.length} точек из ТЕКУЩЕГО ФОТО ${photoId}`);
        return points;
    }

    getDecisionFromResult(result) {
        if (!result) return 'unknown';
        if (result.status === 'created') return 'new_footprint';
        if (result.status === 'enhanced') return 'same_footprint_enhanced';
        if (result.similarity >= 0.6) return 'same_footprint';
        return 'different_footprint';
    }

    // 🔥 ВИЗУАЛИЗАЦИЯ С ТРИАНГУЛЯЦИЕЙ
    getAccumulativeVisualizationData(modelId = null) {
        const targetModelId = modelId || this.accumulator.currentModelId;
        if (!targetModelId) return null;

        const model = this.accumulator.models.get(targetModelId);
        if (!model) return null;

        const graph = model.graph;

        console.log(`📊 Визуализация модели ${targetModelId}:`);
        console.log(`   Всего узлов: ${graph.nodes.size}`);

        const nodeInfoArray = [];
        const confirmationStats = { 0: 0, 1: 0, 2: 0, 3: 0 };
        let triangulatedNodes = 0;

        for (const [nodeId, node] of graph.nodes) {
            const confirmations = node.confirmationCount ||
                                 (node.addedAt ? 1 : 0);

            confirmationStats[confirmations] = (confirmationStats[confirmations] || 0) + 1;
           
            if (node.addedFrom === 'triangulation') triangulatedNodes++;

            if (!node.x || !node.y) {
                if (node.originalData?.x && node.originalData?.y) {
                    node.x = node.originalData.x;
                    node.y = node.originalData.y;
                } else {
                    node.x = Math.random() * 800 + 100;
                    node.y = Math.random() * 500 + 100;
                }
            }

            nodeInfoArray.push({
                id: nodeId,
                node: node,
                confirmations: confirmations
            });
        }

        const pointsByConfirmation = {
            confirmed3: [], confirmed2: [], confirmed1: [], confirmed0: []
        };

        for (const info of nodeInfoArray) {
            const node = info.node;
            const confirmations = info.confirmations;

            let color, size, level;

            if (confirmations >= 3) {
                color = '#FF0000'; size = 10; level = 'confirmed3';
                pointsByConfirmation.confirmed3.push(node);
            } else if (confirmations >= 2) {
                color = '#FF6B00'; size = 8; level = 'confirmed2';
                pointsByConfirmation.confirmed2.push(node);
            } else if (confirmations >= 1) {
                color = '#2196F3'; size = 6; level = 'confirmed1';
                pointsByConfirmation.confirmed1.push(node);
            } else {
                color = '#BDBDBD'; size = 4; level = 'confirmed0';
                pointsByConfirmation.confirmed0.push(node);
            }

            node.vizData = {
                color: color,
                size: size,
                level: level,
                confirmations: confirmations,
                degree: node.degree,
                source: node.addedFrom || 'original',
                isTriangulated: node.addedFrom === 'triangulation',
                id: nodeId
            };
        }

        const stats = {
            totalNodes: graph.nodes.size,
            totalEdges: graph.edges.size,
            avgDegree: graph.avgDegree || 0,
            confirmed3: pointsByConfirmation.confirmed3.length,
            confirmed2: pointsByConfirmation.confirmed2.length,
            confirmed1: pointsByConfirmation.confirmed1.length,
            confirmed0: pointsByConfirmation.confirmed0.length,
            triangulatedNodes: triangulatedNodes,
            uniquenessRatio: model.fingerprints ?
                this.fingerprinter.getFingerprintInfo(model.fingerprints).uniquenessRatio : 0
        };

        console.log(`📊 Статистика:`);
        console.log(`   🔴 3+ подтверждений: ${stats.confirmed3}`);
        console.log(`   🟠 2 подтверждения: ${stats.confirmed2}`);
        console.log(`   🔵 1 подтверждение: ${stats.confirmed1}`);
        console.log(`   ⚪ Новые узлы: ${stats.confirmed0}`);
        console.log(`   🔺 Триангуляция: ${stats.triangulatedNodes}`);

        return {
            modelId: targetModelId,
            modelName: model.metadata.name,
            points: Array.from(graph.nodes.values()),
            edges: Array.from(graph.edges),
            stats: stats,
            pointsByConfirmation: pointsByConfirmation,
            metadata: model.metadata,
            isTopological: true,
            visualizationMethod: 'topology_with_triangulation'
        };
    }

    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 СРАВНЕНИЕ СЛЕДОВ: "${footprint1.name}" vs "${footprint2.name}"`);

        const points1 = this.extractPointsFromFootprint(footprint1);
        const points2 = this.extractPointsFromFootprint(footprint2);

        if (points1.length < 3 || points2.length < 3) {
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                reason: 'Недостаточно точек'
            };
        }

        const graph1 = this.builder.buildDelaunayGraph(points1, footprint1.name);
        const graph2 = this.builder.buildDelaunayGraph(points2, footprint2.name);

        const fingerprints1 = this.fingerprinter.computeGraphFingerprints(graph1);
        const fingerprints2 = this.fingerprinter.computeGraphFingerprints(graph2);

        const comparison = this.fingerprinter.compareGraphs(
            graph1, fingerprints1,
            graph2, fingerprints2
        );

        const isSame = comparison.similarity >= (options.threshold || 0.6);
        const decision = isSame ? 'same' : 'different';

        return {
            similar: isSame,
            similarity: comparison.similarity,
            decision: decision,
            exactMatches: comparison.exactMatches || [],
            stats: comparison,
            method: 'topological_comparison'
        };
    }

    extractPointsFromFootprint(footprint) {
        const points = [];

        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({
                    id: id,
                    x: point.x,
                    y: point.y,
                    confidence: point.rating || point.confidence || 0.5,
                    source: 'footprint'
                });
            }
        }

        return points;
    }

    getUserModelsInfo() {
        return this.accumulator.getStats();
    }

    clearUserModels() {
        this.accumulator.models.clear();
        this.accumulator.currentModelId = null;
        this.linkedFootprints.clear();
        return { success: true, message: 'Модели очищены' };
    }

    exportUserModels() {
        const models = [];
        for (const [modelId, model] of this.accumulator.models) {
            models.push(this.accumulator.exportModel(modelId));
        }

        return {
            userId: this.userId,
            models: models,
            linkedFootprints: Array.from(this.linkedFootprints.entries()),
            exportedAt: new Date().toISOString(),
            version: '2.0-triangulation'
        };
    }

    importUserModels(data) {
        if (!data || !data.models || !Array.isArray(data.models)) {
            return { success: false, error: 'Неверный формат' };
        }

        let importedCount = 0;
        for (const modelData of data.models) {
            if (this.accumulator.importModel(modelData)) {
                importedCount++;
            }
        }

        if (data.linkedFootprints) {
            data.linkedFootprints.forEach(([footprintId, modelId]) => {
                this.linkedFootprints.set(footprintId, modelId);
            });
        }

        return {
            success: true,
            importedCount: importedCount,
            totalModels: this.accumulator.models.size
        };
    }
}

module.exports = TopologyManager;
