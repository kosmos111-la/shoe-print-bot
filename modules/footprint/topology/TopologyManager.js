// modules/footprint/topology/TopologyManager.js
// 🎯 УПРАВЛЕНИЕ ЧИСТОЙ ТОПОЛОГИЕЙ (КООРДИНАТЫ ТОЛЬКО ДЛЯ ВИЗУАЛИЗАЦИИ)

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
        this.linkedFootprints = new Map(); // footprintId -> topologicalModelId
      
        console.log(`🎯 TopologyManager создан для пользователя ${this.userId}`);
        console.log(`   🎯 ФИЛОСОФИЯ: Чистая топология, координаты только для визуализации`);
    }
  
    // 🔥 ГЛАВНЫЙ МЕТОД: Обработка следов (чистая топология)
    async processFootprint(footprint, analysis, photoInfo = {}) {
        console.log(`\n🎯 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА фото ${photoInfo.photoId || 'без ID'}...`);
      
        // Извлекаем точки ТОЛЬКО из текущего фото
        const points = this.extractPointsFromCurrentPhoto(analysis, photoInfo);
      
        if (points.length < 3) {
            console.log('⚠️ Слишком мало точек для топологии');
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
      
        // Обрабатываем точки через топологический аккумулятор (ЧИСТАЯ ТОПОЛОГИЯ)
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
      
        // Получаем обновленную информацию о модели
        const modelInfo = this.accumulator.getModelInfo(result.modelId);
      
        return {
            success: true,
            topologicalResult: result,
            modelInfo: modelInfo,
            pointsCount: points.length,
            modelId: result.modelId,
            similarity: result.similarity || 0,
            decision: this.getDecisionFromResult(result),
            philosophy: 'pure_topology_coordinates_for_visualization_only'
        };
    }
  
    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК (сохраняем координаты ТОЛЬКО для визуализации)
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
              
                // 🔥 Сохраняем координаты ТОЛЬКО для визуализации!
                // В топологической логике они не участвуют!
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
      
        console.log(`📸 Извлечено ${points.length} точек из ТЕКУЩЕГО ФОТО ${photoId}`);
        console.log(`   Уникальный ID фото: ${uniquePhotoId}`);
      
        return points;
    }
  
    // 🔥 ВИЗУАЛИЗАЦИЯ ТОПОЛОГИЧЕСКОЙ МОДЕЛИ
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
      
        console.log(`📊 Визуализация чисто топологической модели ${targetModelId}:`);
        console.log(`   Всего структурных узлов: ${graph.nodes.size}`);
      
        // 🔥 ПОДГОТАВЛИВАЕМ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
        const nodeInfoArray = [];
        let nodesWithConfirmations = 0;
      
        for (const [nodeId, node] of graph.nodes) {
            // 🔥 ИСПРАВЛЕНИЕ 1: ГАРАНТИРУЕМ КООРДИНАТЫ ДЛЯ ВСЕХ УЗЛОВ
            // 🔥 ВИЗУАЛИЗАЦИОННЫЕ КООРДИНАТЫ МОГУТ БЫТЬ УЖЕ УСТАНОВЛЕНЫ
            // Если нет координат - создаем визуализационные
            if (node.x === undefined || node.y === undefined) {
                // Используем координаты из originalData если есть
                if (node.originalData) {
                    node.x = node.originalData.x;
                    node.y = node.originalData.y;
                    console.log(`   📍 Использованы оригинальные координаты для узла ${nodeId.substring(0, 20)}...`);
                } else {
                    // Или создаем случайные визуализационные
                    node.x = 400 + (Math.random() - 0.5) * 300;
                    node.y = 300 + (Math.random() - 0.5) * 200;
                    console.log(`   🎯 Созданы визуализационные координаты для узла ${nodeId.substring(0, 20)}...`);
                }
            }
          
            // 🔥 ГАРАНТИРУЕМ confirmationCount
            if (node.confirmationCount === undefined) {
                node.confirmationCount = 1;
                console.log(`   ⚠️ Установлен confirmationCount=1 для узла ${nodeId.substring(0, 20)}...`);
            }
          
            // 🔥 ПОДТВЕРЖДЕНИЯ (главное!)
            const confirmations = node.confirmationCount;
            if (confirmations > 0) nodesWithConfirmations++;
          
            nodeInfoArray.push({
                id: nodeId,
                node: node,
                confirmations: confirmations
            });
        }
      
        console.log(`   Узлов с подтверждениями: ${nodesWithConfirmations}/${graph.nodes.size}`);
      
        // 🔥 ГРУППИРОВКА ПО ПОДТВЕРЖДЕНИЯМ (для цветовой схемы)
        const pointsByConfirmation = {
            confirmed4: [], // 4+ подтверждений (структурные ядра)
            confirmed3: [], // 3 подтверждения (стабильные)
            confirmed2: [], // 2 подтверждения (подтверждённые)
            confirmed1: [], // 1 подтверждение (новые)
            confirmed0: []  // 0 подтверждений (неподтверждённые)
        };
      
        for (const info of nodeInfoArray) {
            const node = info.node;
            const confirmations = info.confirmations;
          
            // 🔥 ЦВЕТОВАЯ СХЕМА ПО ПОДТВЕРЖДЕНИЯМ
            let color, size, confirmationLevel;
          
            if (confirmations >= 4) {
                color = '#FF0000'; // 🔴 Структурные ядра
                size = 10 + (node.confidence || 0.5) * 4;
                confirmationLevel = 'confirmed4';
                pointsByConfirmation.confirmed4.push(node);
            } else if (confirmations >= 3) {
                color = '#FF6B00'; // 🟠 Стабильные узлы
                size = 8 + (node.confidence || 0.5) * 3;
                confirmationLevel = 'confirmed3';
                pointsByConfirmation.confirmed3.push(node);
            } else if (confirmations >= 2) {
                color = '#FFC107'; // 🟡 Подтверждённые
                size = 7 + (node.confidence || 0.5) * 2;
                confirmationLevel = 'confirmed2';
                pointsByConfirmation.confirmed2.push(node);
            } else if (confirmations >= 1) {
                color = '#2196F3'; // 🔵 Новые
                size = 6 + (node.confidence || 0.5);
                confirmationLevel = 'confirmed1';
                pointsByConfirmation.confirmed1.push(node);
            } else {
                color = '#BDBDBD'; // ⚪ Неподтверждённые
                size = 4;
                confirmationLevel = 'confirmed0';
                pointsByConfirmation.confirmed0.push(node);
            }
          
            // 🔥 ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
            node.vizData = {
                color: color,
                size: size,
                confirmationLevel: confirmationLevel,
                confirmations: confirmations,
                degree: node.degree,
                source: node.addedFrom || 'original',
                confirmationCount: confirmations,
                id: info.id,
                note: 'coordinates_for_visualization_only'
            };
        }
      
        // 🔥 СТАТИСТИКА ДЛЯ ВИЗУАЛИЗАЦИИ
        const stats = {
            totalNodes: graph.nodes.size,
            totalEdges: graph.edges.size,
            avgDegree: graph.avgDegree || 0,
            confirmed4: pointsByConfirmation.confirmed4.length,
            confirmed3: pointsByConfirmation.confirmed3.length,
            confirmed2: pointsByConfirmation.confirmed2.length,
            confirmed1: pointsByConfirmation.confirmed1.length,
            confirmed0: pointsByConfirmation.confirmed0.length,
            uniquenessRatio: fingerprints ?
                this.fingerprinter.getFingerprintInfo(fingerprints).uniquenessRatio : 0
        };
      
        console.log(`📊 Статистика для визуализации:`);
        console.log(`   Всего узлов: ${stats.totalNodes}`);
        console.log(`   🔴 4+ подтверждений: ${stats.confirmed4} (структурные ядра)`);
        console.log(`   🟠 3 подтверждения: ${stats.confirmed3} (стабильные)`);
        console.log(`   🟡 2 подтверждения: ${stats.confirmed2} (подтверждённые)`);
        console.log(`   🔵 1 подтверждение: ${stats.confirmed1} (новые)`);
        console.log(`   ⚪ 0 подтверждений: ${stats.confirmed0} (неподтверждённые)`);
      
        return {
            modelId: targetModelId,
            modelName: model.metadata.name,
            points: Array.from(graph.nodes.values()),
            edges: Array.from(graph.edges),
            stats: stats,
            pointsByConfirmation: pointsByConfirmation,
            metadata: model.metadata,
            isTopological: true,
            visualizationMethod: 'pure_topological_visualization',
            philosophy: 'coordinates_for_visualization_only_structural_data_is_primary'
        };
    }
  
    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ (оставляем без изменений)
    getDecisionFromResult(result) {
        if (!result) return 'unknown';
      
        if (result.status === 'created') {
            return 'new_footprint';
        } else if (result.status === 'enhanced') {
            return 'same_footprint_enhanced';
        } else if (result.similarity >= 0.6) {
            return 'same_footprint';
        } else {
            return 'different_footprint';
        }
    }
  
    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 ТОПОЛОГИЧЕСКОЕ СРАВНЕНИЕ (ЧИСТАЯ СТРУКТУРА): "${footprint1.name}" vs "${footprint2.name}"`);
      
        // Извлекаем точки из обоих следов
        const points1 = this.extractPointsFromCurrentPhoto(footprint1.analysis || {}, { photoId: 'footprint1' });
        const points2 = this.extractPointsFromCurrentPhoto(footprint2.analysis || {}, { photoId: 'footprint2' });
      
        if (points1.length < 3 || points2.length < 3) {
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                reason: 'Недостаточно точек для структурного сравнения'
            };
        }
      
        // Строим графы и сравниваем
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
      
        console.log(`🎯 СТРУКТУРНОЕ РЕШЕНИЕ: ${decision.toUpperCase()} (${(comparison.similarity * 100).toFixed(1)}%)`);
      
        return {
            similar: isSame,
            similarity: comparison.similarity,
            decision: decision,
            exactMatches: comparison.exactMatches || [],
            stats: comparison,
            method: 'pure_topological_comparison',
            philosophy: 'coordinates_not_used_in_comparison'
        };
    }
  
    getUserModelsInfo() {
        return this.accumulator.getStats();
    }
  
    clearUserModels() {
        this.accumulator.models.clear();
        this.accumulator.currentModelId = null;
        this.linkedFootprints.clear();
      
        console.log(`🧹 Очищены все топологические модели пользователя ${this.userId}`);
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
            version: '2.0-pure-topology',
            philosophy: 'pure_topological_structure_coordinates_for_visualization_only'
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
      
        // Восстанавливаем связи
        if (data.linkedFootprints && Array.isArray(data.linkedFootprints)) {
            data.linkedFootprints.forEach(([footprintId, modelId]) => {
                this.linkedFootprints.set(footprintId, modelId);
            });
        }
      
        console.log(`📥 Импортировано ${importedCount} чисто топологических моделей`);
      
        return {
            success: true,
            importedCount: importedCount,
            totalModels: this.accumulator.models.size
        };
    }
}

module.exports = TopologyManager;
