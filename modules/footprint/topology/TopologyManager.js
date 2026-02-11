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
      
        this.trustConfig = {
            FORGET_AFTER: options.forgetAfter || 10,
            HIDE_AFTER: options.hideAfter || 5,
            DEGRADE_AFTER: options.degradeAfter || 3,
            PROMOTE_AT: options.promoteAt || 2,
            CORE_AT: options.coreAt || 4,
            RESURRECTION_THRESHOLD: options.resurrectionThreshold || 0.9
        };
      
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
            minMatchesForEnhancement: options.minMatchesForEnhancement || 3,
            trustConfig: this.trustConfig
        });
      
        this.linkedFootprints = new Map();
      
        console.log(`🎯 TopologyManager создан для пользователя ${this.userId}`);
        console.log(`   🎯 ФИЛОСОФИЯ: Топология + Геометрическая память`);
        console.log(`   📐 ГЕОМЕТРИЯ: Инвариантные отношения (без пиксельных координат)`);
    }
  
    // 🔥 ГЛАВНЫЙ МЕТОД
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
            philosophy: 'topology_with_geometry_memory'
        };
    }
  
    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК (только для визуализации)
    extractPointsFromCurrentPhoto(analysis, photoInfo = {}) {
        const points = [];
      
        if (!analysis?.predictions) return points;
      
        const photoId = photoInfo.photoId || `photo_${Date.now()}`;
        const uniquePhotoId = `${photoId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
        const predictions = analysis.predictions || [];
        let protectorCount = 0;
      
        predictions.forEach(pred => {
            if (pred.class === 'shoe-protector' && pred.points?.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);
              
                points.push({
                    id: `${uniquePhotoId}_protector_${protectorCount}`,
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2,
                    confidence: pred.confidence || 0.5,
                    source: 'current_photo',
                    photoId: photoId,
                    originalPhotoId: uniquePhotoId,
                    originalIndex: protectorCount,
                    originalPoints: pred.points,
                    note: 'coordinates_for_visualization_only'
                });
                protectorCount++;
            }
        });
      
        return points;
    }
  
    // 🔥 ВИЗУАЛИЗАЦИЯ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ
    getAccumulativeVisualizationData(modelId = null) {
        const targetModelId = modelId || this.accumulator.currentModelId;
        if (!targetModelId) return null;
      
        const model = this.accumulator.models.get(targetModelId);
        if (!model) return null;
      
        const graph = model.graph;
        const fingerprints = model.fingerprints;
      
        console.log(`\n📊 ВИЗУАЛИЗАЦИЯ МОДЕЛИ ${targetModelId}:`);
        console.log(`   Всего узлов: ${graph.nodes.size}`);
      
        const nodeInfoArray = [];
        let nodesWithConfirmations = 0;
        let nodesWithGeometry = 0;
      
        // 🔥 ПЕРВЫЙ ПРОХОД: ГАРАНТИРУЕМ КООРДИНАТЫ
        for (const [nodeId, node] of graph.nodes) {
            // Гарантируем координаты
            if (node.x === undefined || node.y === undefined) {
                if (node.originalData) {
                    node.x = node.originalData.x;
                    node.y = node.originalData.y;
                } else {
                    node.x = 400 + (Math.random() - 0.5) * 300;
                    node.y = 300 + (Math.random() - 0.5) * 200;
                }
            }
          
            // Гарантируем параметры доверия
            if (node.confirmationCount === undefined) node.confirmationCount = 1;
            if (node.unconfirmedStreak === undefined) node.unconfirmedStreak = 0;
          
            // 🔥 ВОССТАНАВЛИВАЕМ ГЕОМЕТРИЮ ДЛЯ СТРУКТУРНЫХ УЗЛОВ
            if (node.addedFrom === 'structural_enhancement' && node.geometryMemory) {
                const reconstructed = this.accumulator.geometryMemory.reconstructPosition(
                    node.geometryMemory,
                    graph
                );
              
                if (reconstructed) {
                    node.x = reconstructed.x;
                    node.y = reconstructed.y;
                    node.reconstructionMethod = reconstructed.method;
                    node.visualizationMethod = reconstructed.method;
                    nodesWithGeometry++;
                  
                    if (this.debug) {
                        console.log(`   📐 Восстановлена геометрия: ${nodeId.substring(0, 20)}...`);
                        console.log(`      позиция: (${node.x.toFixed(1)}, ${node.y.toFixed(1)})`);
                        console.log(`      метод: ${reconstructed.method}`);
                    }
                }
            }
          
            const confirmations = node.confirmationCount;
            if (confirmations > 0) nodesWithConfirmations++;
          
            nodeInfoArray.push({
                id: nodeId,
                node: node,
                confirmations: confirmations
            });
        }
      
        console.log(`   📍 Узлов с координатами: ${graph.nodes.size}`);
        console.log(`   📐 С восстановленной геометрией: ${nodesWithGeometry}`);
        console.log(`   ✅ С подтверждениями: ${nodesWithConfirmations}/${graph.nodes.size}`);
      
        // 🔥 ВТОРОЙ ПРОХОД: ЦВЕТА И ВИЗУАЛИЗАЦИОННЫЕ ДАННЫЕ
        const pointsByTrust = {
            core: [],      // 4+
            stable: [],    // 3
            confirmed: [], // 2
            newish: [],    // 1
            fading: [],    // 0
            hidden: [],
            forgotten: []
        };
      
        for (const info of nodeInfoArray) {
            const node = info.node;
            const confirmations = info.confirmations;
            const streak = node.unconfirmedStreak || 0;
          
            // 🔥 ДИНАМИЧЕСКАЯ ЦВЕТОВАЯ СХЕМА
            let color, size, trustLevel;
          
            if (streak >= this.trustConfig.FORGET_AFTER) {
                color = '#AAAAAA'; // Скрытые
                size = 2;
                trustLevel = 'forgotten';
                pointsByTrust.forgotten.push(node);
                continue;
            }
          
            if (streak >= this.trustConfig.HIDE_AFTER) {
                color = '#CCCCCC'; // Затухающие
                size = 3;
                trustLevel = 'fading';
                pointsByTrust.fading.push(node);
            } else if (confirmations >= 4) {
                color = '#FF0000'; // 🔴 Ядра
                size = 12;
                trustLevel = 'core';
                pointsByTrust.core.push(node);
            } else if (confirmations >= 3) {
                color = '#FF6B00'; // 🟠 Стабильные
                size = 10;
                trustLevel = 'stable';
                pointsByTrust.stable.push(node);
            } else if (confirmations >= 2) {
                color = '#FFC107'; // 🟡 Подтверждённые
                size = 8;
                trustLevel = 'confirmed';
                pointsByTrust.confirmed.push(node);
            } else {
                color = '#2196F3'; // 🔵 Новые
                size = 6;
                trustLevel = 'newish';
                pointsByTrust.newish.push(node);
            }
          
            // 🔥 ВИЗУАЛИЗАЦИОННЫЕ ДАННЫЕ
            node.vizData = {
                color: color,
                size: size,
                trustLevel: trustLevel,
                confirmations: confirmations,
                unconfirmedStreak: streak,
                degree: node.degree || 0,
                source: node.addedFrom || 'original',
                geometryMemory: !!node.geometryMemory,
                reconstructionMethod: node.reconstructionMethod,
                id: info.id
            };
        }
      
        // 🔥 СТАТИСТИКА
        const stats = {
            totalNodes: graph.nodes.size,
            totalEdges: graph.edges.size,
            avgDegree: graph.avgDegree || 0,
            core: pointsByTrust.core.length,
            stable: pointsByTrust.stable.length,
            confirmed: pointsByTrust.confirmed.length,
            newish: pointsByTrust.newish.length,
            fading: pointsByTrust.fading.length,
            hidden: pointsByTrust.hidden.length,
            forgotten: pointsByTrust.forgotten.length,
            geometryRecovered: nodesWithGeometry,
            uniquenessRatio: fingerprints ?
                this.fingerprinter.getFingerprintInfo(fingerprints).uniquenessRatio : 0,
            philosophy: 'topology_with_geometry_memory'
        };
      
        console.log(`\n📊 СТАТИСТИКА ВИЗУАЛИЗАЦИИ:`);
        console.log(`   🔴 Ядра (4+): ${stats.core}`);
        console.log(`   🟠 Стабильные (3): ${stats.stable}`);
        console.log(`   🟡 Подтверждённые (2): ${stats.confirmed}`);
        console.log(`   🔵 Новые (1): ${stats.newish}`);
        console.log(`   ⚪ Затухающие: ${stats.fading}`);
        console.log(`   📐 Восстановлено геометрией: ${stats.geometryRecovered}`);
      
        // 🔥 СОБИРАЕМ ТОЛЬКО ВИДИМЫЕ УЗЛЫ
        const visibleNodes = Array.from(graph.nodes.values()).filter(node => {
            // Показываем всё, кроме забытых
            return !(node.unconfirmedStreak >= this.trustConfig.FORGET_AFTER);
        });
      
        return {
            modelId: targetModelId,
            modelName: model.metadata.name,
            points: visibleNodes,
            edges: Array.from(graph.edges),
            stats: stats,
            pointsByTrust: pointsByTrust,
            metadata: {
                ...model.metadata,
                geometryMemorySize: this.accumulator.geometryMemory.relations.size
            },
            isTopological: true,
            visualizationMethod: 'topology_with_geometry_memory',
            philosophy: 'geometry_memory_invariant_relations',
            trustSystem: 'dynamic_with_fading'
        };
    }
  
    // 🔥 ПОЛУЧИТЬ РЕШЕНИЕ
    getDecisionFromResult(result) {
        if (!result) return 'unknown';
        if (result.status === 'created') return 'new_footprint';
        if (result.status === 'enhanced') return 'same_footprint_enhanced';
        if (result.similarity >= 0.6) return 'same_footprint';
        return 'different_footprint';
    }
  
    // 🔥 СРАВНЕНИЕ СЛЕДОВ
    async compareFootprints(footprint1, footprint2, options = {}) {
        const points1 = this.extractPointsFromCurrentPhoto(footprint1.analysis || {}, { photoId: 'footprint1' });
        const points2 = this.extractPointsFromCurrentPhoto(footprint2.analysis || {}, { photoId: 'footprint2' });
      
        if (points1.length < 3 || points2.length < 3) {
            return { similar: false, similarity: 0, decision: 'different' };
        }
      
        const graph1 = this.builder.buildDelaunayGraph(points1, footprint1.name);
        const graph2 = this.builder.buildDelaunayGraph(points2, footprint2.name);
      
        const fingerprints1 = this.fingerprinter.computeGraphFingerprints(graph1);
        const fingerprints2 = this.fingerprinter.computeGraphFingerprints(graph2);
      
        const comparison = this.fingerprinter.compareGraphs(graph1, fingerprints1, graph2, fingerprints2);
        const isSame = comparison.similarity >= (options.threshold || 0.6);
      
        return {
            similar: isSame,
            similarity: comparison.similarity,
            decision: isSame ? 'same' : 'different',
            exactMatches: comparison.exactMatches || [],
            stats: comparison,
            method: 'topology_with_geometry_memory'
        };
    }
  
    // 🔥 ПОЛУЧИТЬ ИНФОРМАЦИЮ О МОДЕЛЯХ
    getUserModelsInfo() {
        return this.accumulator.getStats();
    }
  
    // 🔥 ОЧИСТИТЬ МОДЕЛИ
    clearUserModels() {
        this.accumulator.models.clear();
        this.accumulator.currentModelId = null;
        this.accumulator.geometryMemory.relations.clear();
        this.linkedFootprints.clear();
        return { success: true, message: 'Модели и геометрическая память очищены' };
    }
  
    // 🔥 ЭКСПОРТ
    exportUserModels() {
        const models = [];
        for (const [modelId, model] of this.accumulator.models) {
            models.push(this.accumulator.exportModel(modelId));
        }
      
        return {
            userId: this.userId,
            models: models,
            linkedFootprints: Array.from(this.linkedFootprints.entries()),
            geometryMemory: this.accumulator.geometryMemory.export(),
            exportedAt: new Date().toISOString(),
            version: '3.0-geometry-memory',
            philosophy: 'topology_with_geometry_memory'
        };
    }
  
    // 🔥 ИМПОРТ
    importUserModels(data) {
        if (!data?.models) return { success: false, error: 'Неверный формат' };
      
        let importedCount = 0;
        for (const modelData of data.models) {
            if (this.accumulator.importModel(modelData)) importedCount++;
        }
      
        if (data.linkedFootprints) {
            data.linkedFootprints.forEach(([fid, mid]) => this.linkedFootprints.set(fid, mid));
        }
      
        if (data.geometryMemory) {
            this.accumulator.geometryMemory.import(data.geometryMemory);
        }
      
        return { success: true, importedCount, totalModels: this.accumulator.models.size };
    }
}

module.exports = TopologyManager;
