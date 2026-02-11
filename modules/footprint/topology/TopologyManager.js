// modules/footprint/topology/TopologyManager.js
// 🎯 УПРАВЛЕНИЕ ТОПОЛОГИЕЙ + ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ

const TopologyBuilder = require('./TopologyBuilder');
const TopologicalFingerprint = require('./TopologicalFingerprint');
const TopologicalAccumulator = require('./TopologicalAccumulator');

class TopologyManager {
    constructor(options = {}) {
        this.userId = options.userId || 'default';
        this.name = options.name || `Топология_${this.userId}`;
        this.debug = options.debug || false;
       
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
       
        this.linkedFootprints = new Map();
       
        console.log(`🎯 TopologyManager создан для пользователя ${this.userId}`);
        console.log(`   🎯 ФИЛОСОФИЯ: Топология + Геометрическая память`);
        console.log(`   📐 ГЕОМЕТРИЯ: Инвариантные отношения (без пиксельных координат)`);
    }

    async processFootprint(footprint, analysis, photoInfo = {}) {
        if (this.debug) {
            console.log(`\n🎯 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА фото ${photoInfo.photoId || 'без ID'}...`);
        }
       
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
            decision: this.getDecisionFromResult(result),
            philosophy: 'pure_topology_with_geometry_memory'
        };
    }

    extractPointsFromCurrentPhoto(analysis, photoInfo = {}) {
        const points = [];
       
        if (!analysis?.predictions) {
            return points;
        }
       
        const photoId = photoInfo.photoId || `photo_${Date.now()}`;
        const uniquePhotoId = `${photoId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
       
        const predictions = analysis.predictions || [];
        let protectorCount = 0;
       
        predictions.forEach((pred) => {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);
               
                const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
                const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
               
                points.push({
                    id: `${uniquePhotoId}_protector_${protectorCount}`,
                    x: centerX,
                    y: centerY,
                    confidence: pred.confidence || 0.5,
                    source: 'current_photo',
                    photoId: photoId,
                    originalPhotoId: uniquePhotoId,
                    originalIndex: protectorCount,
                    originalPoints: pred.points,
                   
                    // 🔥 КЛЮЧЕВОЕ: СОХРАНЯЕМ ДЛЯ ГЕОМЕТРИЧЕСКОЙ ПАМЯТИ
                    _originalX: centerX,
                    _originalY: centerY,
                    _hasOriginalCoordinates: true,
                   
                    note: 'coordinates_for_geometry_memory'
                });
                protectorCount++;
            }
        });
       
        console.log(`📸 Извлечено ${points.length} точек из фото ${photoId}`);
        console.log(`   📐 Оригинальные координаты сохранены для геометрической памяти`);
       
        return points;
    }

    getAccumulativeVisualizationData(modelId = null) {
        const targetModelId = modelId || this.accumulator.currentModelId;
       
        if (!targetModelId) {
            console.log('⚠️ Нет активной топологической модели');
            return null;
        }
       
        const model = this.accumulator.models.get(targetModelId);
        if (!model) return null;
       
        const graph = model.graph;
        const fingerprints = model.fingerprints;
       
        console.log(`📊 ВИЗУАЛИЗАЦИЯ МОДЕЛИ ${targetModelId}:`);
        console.log(`   Всего узлов: ${graph.nodes.size}`);
       
        // Подготавливаем данные для визуализации
        const nodeInfoArray = [];
        let nodesWithConfirmations = 0;
        let nodesWithOriginalCoords = 0;
        let nodesWithRestoredGeom = 0;
       
        for (const [nodeId, node] of graph.nodes) {
            // Гарантируем координаты для визуализации
            if (node.x === undefined || node.y === undefined) {
                if (node.originalData) {
                    node.x = node.originalData.x;
                    node.y = node.originalData.y;
                } else {
                    node.x = 400 + (Math.random() - 0.5) * 300;
                    node.y = 300 + (Math.random() - 0.5) * 200;
                }
            }
           
            // Гарантируем confirmationCount
            if (node.confirmationCount === undefined) {
                node.confirmationCount = 1;
            }
           
            if (node.confirmationCount > 0) {
                nodesWithConfirmations++;
            }
           
            // Статистика по геометрической памяти
            if (node.geometryMethod === 'original_from_photo') {
                nodesWithOriginalCoords++;
            } else if (node.geometryMethod === 'between' || node.geometryMethod === 'barycentric') {
                nodesWithRestoredGeom++;
            }
           
            const confirmations = node.confirmationCount;
           
            // Цветовая схема по подтверждениям
            let color, size, level;
           
            if (confirmations >= 4) {
                color = '#FF0000'; // 🔴 Ядра
                size = 12;
                level = 'core';
            } else if (confirmations >= 3) {
                color = '#FF6B00'; // 🟠 Стабильные
                size = 10;
                level = 'stable';
            } else if (confirmations >= 2) {
                color = '#FFC107'; // 🟡 Подтверждённые
                size = 8;
                level = 'confirmed';
            } else {
                color = '#2196F3'; // 🔵 Новые
                size = 6;
                level = 'new';
            }
           
            node.vizData = {
                color: color,
                size: size,
                level: level,
                confirmations: confirmations,
                degree: node.degree,
                source: node.addedFrom || 'original',
                geometryMethod: node.geometryMethod || 'original',
                id: nodeId
            };
           
            nodeInfoArray.push({ id: nodeId, node, confirmations });
        }
       
        // Статистика для визуализации
        const stats = {
            totalNodes: graph.nodes.size,
            totalEdges: graph.edges.size,
            avgDegree: graph.avgDegree || 0,
            confirmed4: Array.from(graph.nodes.values()).filter(n => n.confirmationCount >= 4).length,
            confirmed3: Array.from(graph.nodes.values()).filter(n => n.confirmationCount === 3).length,
            confirmed2: Array.from(graph.nodes.values()).filter(n => n.confirmationCount === 2).length,
            confirmed1: Array.from(graph.nodes.values()).filter(n => n.confirmationCount === 1).length,
            confirmed0: Array.from(graph.nodes.values()).filter(n => !n.confirmationCount).length,
            originalGeometry: nodesWithOriginalCoords,
            restoredGeometry: nodesWithRestoredGeom,
            uniquenessRatio: fingerprints ?
                this.fingerprinter.getFingerprintInfo(fingerprints).uniquenessRatio : 0
        };
       
        console.log(`📊 СТАТИСТИКА ВИЗУАЛИЗАЦИИ:`);
        console.log(`   🔴 Ядра (4+): ${stats.confirmed4}`);
        console.log(`   🟠 Стабильные (3): ${stats.confirmed3}`);
        console.log(`   🟡 Подтверждённые (2): ${stats.confirmed2}`);
        console.log(`   🔵 Новые (1): ${stats.confirmed1}`);
        console.log(`   ⚪ Затухающие (0): ${stats.confirmed0}`);
        console.log(`   📍 Оригинальная геометрия: ${stats.originalGeometry}`);
        console.log(`   📐 Восстановлено геометрией: ${stats.restoredGeometry}`);
        console.log(`   🔍 Уникальность подписей: ${(stats.uniquenessRatio * 100).toFixed(1)}%`);
       
        return {
            modelId: targetModelId,
            modelName: model.metadata.name,
            points: Array.from(graph.nodes.values()),
            edges: Array.from(graph.edges),
            stats: stats,
            metadata: model.metadata,
            isTopological: true,
            visualizationMethod: 'topology_with_geometry_memory',
            philosophy: 'coordinates_for_visualization_only_structural_data_is_primary'
        };
    }

    getDecisionFromResult(result) {
        if (!result) return 'unknown';
        if (result.status === 'created') return 'new_footprint';
        if (result.status === 'enhanced') return 'same_footprint_enhanced';
        if (result.similarity >= 0.6) return 'same_footprint';
        return 'different_footprint';
    }

    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 СРАВНЕНИЕ СЛЕДОВ: "${footprint1.name}" vs "${footprint2.name}"`);
       
        const points1 = this.extractPointsFromCurrentPhoto(footprint1.analysis || {}, { photoId: 'footprint1' });
        const points2 = this.extractPointsFromCurrentPhoto(footprint2.analysis || {}, { photoId: 'footprint2' });
       
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
       
        console.log(`🎯 РЕЗУЛЬТАТ: ${decision.toUpperCase()} (${(comparison.similarity * 100).toFixed(1)}%)`);
       
        return {
            similar: isSame,
            similarity: comparison.similarity,
            decision: decision,
            exactMatches: comparison.exactMatches || [],
            similarMatches: comparison.similarMatches || [],
            stats: comparison,
            method: 'pure_topological_comparison'
        };
    }

    getUserModelsInfo() {
        return this.accumulator.getStats();
    }

    clearUserModels() {
        this.accumulator.models.clear();
        this.accumulator.currentModelId = null;
        this.linkedFootprints.clear();
        console.log(`🧹 Очищены все модели пользователя ${this.userId}`);
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
            version: '3.0-geometric-memory',
            philosophy: 'pure_topology_with_geometry_memory'
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
       
        console.log(`📥 Импортировано ${importedCount} моделей с геометрической памятью`);
       
        return {
            success: true,
            importedCount: importedCount,
            totalModels: this.accumulator.models.size
        };
    }
}

module.exports = TopologyManager;
