// modules/footprint/topology/TopologyManager.js
// 🎯 УПРАВЛЕНИЕ ЧИСТОЙ ТОПОЛОГИЕЙ + ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ

const TopologyBuilder = require('./TopologyBuilder');
const TopologicalFingerprint = require('./TopologicalFingerprint');
const TopologicalAccumulator = require('./TopologicalAccumulator');

class TopologyManager {
    constructor(options = {}) {
        this.userId = options.userId || 'default';
        this.name = options.name || `Топология_${this.userId}`;
        this.debug = options.debug || false;
      
        // 🔥 ДИНАМИЧЕСКИЕ ПОРОГИ ДОВЕРИЯ
        this.trustConfig = {
            FORGET_AFTER: options.forgetAfter || 10,
            HIDE_AFTER: options.hideAfter || 5,
            DEGRADE_AFTER: options.degradeAfter || 3,
            PROMOTE_AT: options.promoteAt || 2,
            CORE_AT: options.coreAt || 4,
            RESURRECTION_THRESHOLD: options.resurrectionThreshold || 0.9
        };
      
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
            minMatchesForEnhancement: options.minMatchesForEnhancement || 3,
            trustConfig: this.trustConfig
        });
      
        // Связь с существующей системой
        this.linkedFootprints = new Map();
      
        console.log(`🎯 TopologyManager создан для пользователя ${this.userId}`);
        console.log(`   🎯 ФИЛОСОФИЯ: Топология + Геометрическая память`);
        console.log(`   📐 ГЕОМЕТРИЯ: Инвариантные отношения (без пиксельных координат)`);
    }
  
    // 🔥 ГЛАВНЫЙ МЕТОД: Обработка следов
    async processFootprint(footprint, analysis, photoInfo = {}) {
        console.log(`\n🎯 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА фото ${photoInfo.photoId || 'без ID'}...`);
      
        // Извлекаем точки ТОЛЬКО из текущего фото
        const points = this.extractPointsFromCurrentPhoto(analysis, photoInfo);
      
        if (points.length < 3) {
            return {
                success: false,
                error: 'Недостаточно точек для топологической обработки',
                points: points.length
            };
        }
      
        console.log(`📊 Извлечено ${points.length} точек ИЗ ТЕКУЩЕГО ФОТО`);
      
        // Определяем модель для сравнения
        let modelId = this.linkedFootprints.get(footprint.id);
        if (!modelId && this.accumulator.currentModelId) {
            modelId = this.accumulator.currentModelId;
            this.linkedFootprints.set(footprint.id, modelId);
            console.log(`🔗 Связал след ${footprint.id} с моделью ${modelId}`);
        }
      
        // Обрабатываем точки через топологический аккумулятор
        const result = await this.accumulator.processPoints(points, {
            modelId: modelId,
            source: `photo_${photoInfo.photoId || Date.now()}`,
            name: photoInfo.name || `Фото_${new Date().toLocaleTimeString('ru-RU')}`,
            footprintId: footprint.id,
            photoInfo: photoInfo,
            photoId: photoInfo.photoId
        });
      
        // Обновляем связь след-модель
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
            philosophy: 'topology_with_geometric_memory'
        };
    }
  
    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК - СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ!
extractPointsFromCurrentPhoto(analysis, photoInfo = {}) {
    const points = [];
   
    if (!analysis?.predictions) {
        console.log('⚠️ Нет данных анализа для извлечения точек');
        return points;
    }
   
    const photoId = photoInfo.photoId || `photo_${Date.now()}`;
    const uniquePhotoId = `${photoId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
   
    const predictions = analysis.predictions || [];
    let protectorCount = 0;
   
    predictions.forEach((pred, idx) => {
        if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
            const xs = pred.points.map(p => p.x);
            const ys = pred.points.map(p => p.y);
           
            const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
            const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
           
            // 🔥 СОХРАНЯЕМ ВСЮ ГЕОМЕТРИЧЕСКУЮ ИНФОРМАЦИЮ!
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
               
                // 🔥 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ - ОРИГИНАЛЬНЫЕ КООРДИНАТЫ!
                _originalX: centerX,
                _originalY: centerY,
                _hasOriginalCoordinates: true,
                _boundingBox: {
                    minX: Math.min(...xs),
                    maxX: Math.max(...xs),
                    minY: Math.min(...ys),
                    maxY: Math.max(...ys)
                },
                _area: (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)),
               
                note: 'coordinates_for_visualization_only'
            });
            protectorCount++;
        }
    });
   
    console.log(`📸 Извлечено ${points.length} точек из фото ${photoId}`);
    console.log(`   📐 Оригинальные координаты сохранены для геометрической памяти`);
   
    return points;
}
  
    // 🔥 ВИЗУАЛИЗАЦИЯ С ГЕОМЕТРИЧЕСКОЙ ПАМЯТЬЮ
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
      
        console.log(`\n📊 ВИЗУАЛИЗАЦИЯ МОДЕЛИ ${targetModelId}:`);
        console.log(`   Всего узлов: ${graph.nodes.size}`);
      
        const nodeInfoArray = [];
        let nodesWithConfirmations = 0;
        let reconstructedNodes = 0;
        let geometricNodes = 0;
      
        for (const [nodeId, node] of graph.nodes) {
            // 🔥 ГАРАНТИРУЕМ КООРДИНАТЫ
            if (node.x === undefined || node.y === undefined) {
                // 1. Пробуем оригинальные координаты
                if (node._originalX && node._originalY) {
                    node.x = node._originalX;
                    node.y = node._originalY;
                    geometricNodes++;
                    if (this.debug) {
                        console.log(`   📍 Геометрическая память: (${node.x.toFixed(1)}, ${node.y.toFixed(1)})`);
                    }
                }
                // 2. Пробуем восстановить через геометрию
                else if (node.geometryMemory) {
                    const reconstructed = this.accumulator.geometryMemory?.reconstructPosition(
                        node.geometryMemory,
                        graph
                    );
                    if (reconstructed) {
                        node.x = reconstructed.x;
                        node.y = reconstructed.y;
                        node.reconstructionMethod = reconstructed.method;
                        reconstructedNodes++;
                        console.log(`   📐 Восстановлено геометрией: (${node.x.toFixed(1)}, ${node.y.toFixed(1)})`);
                    }
                }
                // 3. Фолбэк - среднее соседей
                else {
                    const neighbors = this.accumulator.geometryMemory?.getNeighbors(nodeId, graph.nodes) || [];
                    if (neighbors.length > 0) {
                        let sumX = 0, sumY = 0, count = 0;
                        neighbors.forEach(nId => {
                            const n = graph.nodes.get(nId);
                            if (n?.x && n?.y) {
                                sumX += n.x;
                                sumY += n.y;
                                count++;
                            }
                        });
                        if (count > 0) {
                            node.x = sumX / count + (Math.random() - 0.5) * 20;
                            node.y = sumY / count + (Math.random() - 0.5) * 20;
                        }
                    }
                    if (!node.x) node.x = 400 + Math.random() * 200;
                    if (!node.y) node.y = 300 + Math.random() * 200;
                }
            }
          
            // Гарантируем confirmationCount
            if (node.confirmationCount === undefined) node.confirmationCount = 1;
            if (node.unconfirmedStreak === undefined) node.unconfirmedStreak = 0;
          
            const confirmations = node.confirmationCount;
            if (confirmations > 0) nodesWithConfirmations++;
          
            nodeInfoArray.push({
                id: nodeId,
                node: node,
                confirmations: confirmations
            });
        }
      
        console.log(`   📍 Узлов с оригинальными координатами: ${geometricNodes}`);
        console.log(`   📐 С восстановленной геометрией: ${reconstructedNodes}`);
        console.log(`   ✅ С подтверждениями: ${nodesWithConfirmations}/${graph.nodes.size}`);
      
        // 🔥 ГРУППИРОВКА ПО ПОДТВЕРЖДЕНИЯМ
        const pointsByConfirmation = {
            core: [], stable: [], confirmed: [], newish: [], fading: [], hidden: [], forgotten: [],
            geometric: [], reconstructed: []
        };
      
        for (const info of nodeInfoArray) {
            const node = info.node;
            const confirmations = info.confirmations;
            const streak = node.unconfirmedStreak || 0;
          
            // Определяем цвет и размер
            let color, size, trustLevel;
          
            if (streak >= this.trustConfig.FORGET_AFTER) {
                color = '#666666';
                size = 2;
                trustLevel = 'forgotten';
                pointsByConfirmation.forgotten.push(node);
                continue;
            }
          
            if (streak >= this.trustConfig.HIDE_AFTER) {
                color = '#CCCCCC';
                size = 3;
                trustLevel = 'hidden';
                pointsByConfirmation.hidden.push(node);
                continue;
            }
          
            if (confirmations >= 4 && streak < 2) {
                color = '#FF0000';
                size = 12;
                trustLevel = 'core';
                pointsByConfirmation.core.push(node);
            } else if (confirmations >= 3 && streak < 3) {
                color = '#FF6B00';
                size = 10;
                trustLevel = 'stable';
                pointsByConfirmation.stable.push(node);
            } else if (confirmations >= 2 && streak < 4) {
                color = '#FFC107';
                size = 8;
                trustLevel = 'confirmed';
                pointsByConfirmation.confirmed.push(node);
            } else if (confirmations >= 1 && streak < 5) {
                color = '#2196F3';
                size = 6;
                trustLevel = 'newish';
                pointsByConfirmation.newish.push(node);
            } else {
                color = '#BDBDBD';
                size = 4;
                trustLevel = 'fading';
                pointsByConfirmation.fading.push(node);
            }
          
            // Отмечаем геометрические узлы
            if (node._originalX && node._originalY) {
                pointsByConfirmation.geometric.push(node);
            }
            if (node.reconstructionMethod) {
                pointsByConfirmation.reconstructed.push(node);
            }
          
            node.vizData = {
                color: color,
                size: size,
                trustLevel: trustLevel,
                confirmations: confirmations,
                unconfirmedStreak: streak,
                degree: node.degree || 0,
                source: node.addedFrom || 'original',
                hasGeometry: !!(node._originalX || node.geometryMemory),
                reconstructed: !!node.reconstructionMethod,
                geometricMemory: !!(node._originalX && node._originalY),
                id: info.id
            };
        }
      
        const stats = {
            totalNodes: graph.nodes.size,
            totalEdges: graph.edges.size,
            avgDegree: graph.avgDegree || 0,
            core: pointsByConfirmation.core.length,
            stable: pointsByConfirmation.stable.length,
            confirmed: pointsByConfirmation.confirmed.length,
            newish: pointsByConfirmation.newish.length,
            fading: pointsByConfirmation.fading.length,
            hidden: pointsByConfirmation.hidden.length,
            forgotten: pointsByConfirmation.forgotten.length,
            geometric: pointsByConfirmation.geometric.length,
            reconstructed: pointsByConfirmation.reconstructed.length,
            uniquenessRatio: fingerprints ?
                this.fingerprinter.getFingerprintInfo(fingerprints).uniquenessRatio : 0
        };
      
        console.log(`\n📊 СТАТИСТИКА ВИЗУАЛИЗАЦИИ:`);
        console.log(`   🔴 Ядра (4+): ${stats.core}`);
        console.log(`   🟠 Стабильные (3): ${stats.stable}`);
        console.log(`   🟡 Подтверждённые (2): ${stats.confirmed}`);
        console.log(`   🔵 Новые (1): ${stats.newish}`);
        console.log(`   ⚪ Затухающие: ${stats.fading}`);
        console.log(`   📍 Оригинальная геометрия: ${stats.geometric}`);
        console.log(`   📐 Восстановлено геометрией: ${stats.reconstructed}`);
      
        return {
            modelId: targetModelId,
            modelName: model.metadata.name,
            points: Array.from(graph.nodes.values()),
            edges: Array.from(graph.edges),
            stats: stats,
            pointsByConfirmation: pointsByConfirmation,
            metadata: model.metadata,
            isTopological: true,
            visualizationMethod: 'topology_with_geometric_memory',
            philosophy: 'geometric_memory_invariant_relations_only'
        };
    }
  
    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ
    getDecisionFromResult(result) {
        if (!result) return 'unknown';
        if (result.status === 'created') return 'new_footprint';
        if (result.status === 'enhanced') return 'same_footprint_enhanced';
        if (result.similarity >= 0.6) return 'same_footprint';
        return 'different_footprint';
    }
  
    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 ТОПОЛОГИЧЕСКОЕ СРАВНЕНИЕ: "${footprint1.name}" vs "${footprint2.name}"`);
      
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
      
        return {
            similar: isSame,
            similarity: comparison.similarity,
            decision: decision,
            exactMatches: comparison.exactMatches || [],
            stats: comparison,
            method: 'topological_comparison_with_geometry'
        };
    }
  
    getUserModelsInfo() {
        return this.accumulator.getStats();
    }
  
    clearUserModels() {
        this.accumulator.models.clear();
        this.accumulator.currentModelId = null;
        this.linkedFootprints.clear();
        return { success: true, message: 'Топологические модели очищены' };
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
            version: '2.2-geometric-memory',
            philosophy: 'topology_with_geometric_memory'
        };
    }
  
    importUserModels(data) {
        if (!data || !data.models || !Array.isArray(data.models)) {
            return { success: false, error: 'Неверный формат данных' };
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
