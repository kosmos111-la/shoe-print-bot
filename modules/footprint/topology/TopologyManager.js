// modules/footprint/topology/TopologyManager.js
// 🎯 УПРАВЛЕНИЕ ТОПОЛОГИЧЕСКИМИ МОДЕЛЯМИ (ИСПРАВЛЕННАЯ СИНТАКСИС)

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
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: Обработка следов из SimpleFootprint
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
       
        // Диагностика точек
        if (this.debug && points.length > 0) {
            console.log(`📋 Первые 3 точки текущего фото:`);
            points.slice(0, 3).forEach((p, i) => {
                console.log(`   ${i+1}. ${p.id}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
            });
        }
       
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
       
        // Получаем обновленную информацию о модели
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
   
    // Извлечение точек ТОЛЬКО из текущего фото
    extractPointsFromCurrentPhoto(analysis, photoInfo = {}) {
        const points = [];
       
        if (!analysis?.predictions) {
            console.log('⚠️ Нет данных анализа для извлечения точек');
            return points;
        }
       
        const photoId = photoInfo.photoId || `photo_${Date.now()}`;
        const predictions = analysis.predictions || [];
        let protectorCount = 0;
       
        predictions.forEach((pred, idx) => {
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
   
    // Старый метод для совместимости
    extractPointsFromFootprint(footprint, analysis = null) {
        console.log('⚠️ [DEPRECATED] extractPointsFromFootprint() - используйте extractPointsFromCurrentPhoto()');
       
        if (analysis?.predictions) {
            return this.extractPointsFromCurrentPhoto(analysis, { photoId: 'legacy' });
        }
       
        const points = [];
       
        // Вариант 1: Извлечь из PointTracker
        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({
                    id: id,
                    x: point.x,
                    y: point.y,
                    confidence: point.rating || point.confidence || 0.5,
                    confirmedCount: point.confirmedCount || 1,
                    source: 'point_tracker',
                    footprintId: footprint.id,
                    note: '⚠️ АККУМУЛИРОВАННЫЕ ТОЧКИ'
                });
            }
        }
       
        console.log(`⚠️ Используются АККУМУЛИРОВАННЫЕ точки: ${points.length} (может вызвать ошибки сравнения)`);
        return points;
    }
   
    // Получение решения из результата топологической обработки
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
   
    // Сравнение двух следов через топологию
    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 ТОПОЛОГИЧЕСКОЕ СРАВНЕНИЕ: "${footprint1.name}" vs "${footprint2.name}"`);
       
        console.log('⚠️ ВНИМАНИЕ: compareFootprints использует ВСЕ точки следов');
        console.log('   Для сравнения отдельных фото используйте comparePhotoToModel()');
       
        // Извлекаем точки из обоих следов
        const points1 = this.extractPointsFromFootprint(footprint1);
        const points2 = this.extractPointsFromFootprint(footprint2);
       
        console.log(`📊 Точки для сравнения:`);
        console.log(`   ${footprint1.name}: ${points1.length} точек (аккумулированные)`);
        console.log(`   ${footprint2.name}: ${points2.length} точек (аккумулированные)`);
       
        if (points1.length < 3 || points2.length < 3) {
            console.log('⚠️ Один из следов имеет слишком мало точек');
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                reason: 'Недостаточно точек для сравнения'
            };
        }
       
        // Строим графы Делоне
        const graph1 = this.builder.buildDelaunayGraph(points1, footprint1.name);
        const graph2 = this.builder.buildDelaunayGraph(points2, footprint2.name);
       
        // Вычисляем WL-подписи
        const fingerprints1 = this.fingerprinter.computeGraphFingerprints(graph1);
        const fingerprints2 = this.fingerprinter.computeGraphFingerprints(graph2);
       
        // Сравниваем по подписям
        const comparison = this.fingerprinter.compareGraphs(
            graph1, fingerprints1,
            graph2, fingerprints2
        );
       
        // Принимаем решение
        const isSame = comparison.similarity >= (options.threshold || 0.6);
        const decision = isSame ? 'same' : 'different';
       
        console.log(`🎯 ТОПОЛОГИЧЕСКОЕ РЕШЕНИЕ:`);
        console.log(`   Сходство: ${(comparison.similarity * 100).toFixed(1)}%`);
        console.log(`   Порог: ${(options.threshold || 0.6) * 100}%`);
        console.log(`   Решение: ${decision.toUpperCase()}`);
        console.log(`   Точных совпадений: ${comparison.exactMatches?.length || 0}`);
       
        // Диагностика совпадений
        if (this.debug && comparison.exactMatches && comparison.exactMatches.length > 0) {
            console.log(`🔍 Примеры совпадений (первые 3):`);
            comparison.exactMatches.slice(0, 3).forEach((match, i) => {
                console.log(`   ${i+1}. ${match.node1} ↔ ${match.node2}`);
            });
        }
       
        return {
            similar: isSame,
            similarity: comparison.similarity,
            decision: decision,
            exactMatches: comparison.exactMatches || [],
            stats: comparison,
            method: 'topological_delaunay_wl',
            graphs: {
                nodes1: graph1.nodes.size,
                edges1: graph1.edges.size,
                nodes2: graph2.nodes.size,
                edges2: graph2.edges.size
            },
            warning: 'Использованы аккумулированные точки следов'
        };
    }
   
    // Сравнение фото с моделью
    async comparePhotoToModel(analysis, modelId = null, options = {}) {
        console.log(`🔍 СРАВНЕНИЕ ФОТО С МОДЕЛЬЮ ${modelId || 'любой'}`);
       
        const points = this.extractPointsFromCurrentPhoto(analysis, options.photoInfo || {});
       
        if (points.length < 3) {
            console.log('⚠️ Слишком мало точек на фото для сравнения');
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                reason: 'Недостаточно точек на фото'
            };
        }
       
        // Строим граф из точек фото
        const photoGraph = this.builder.buildDelaunayGraph(points, 'current_photo');
        const photoFingerprints = this.fingerprinter.computeGraphFingerprints(photoGraph);
       
        // Если нет modelId, берем текущую модель
        const targetModelId = modelId || this.accumulator.currentModelId;
       
        if (!targetModelId) {
            console.log('⚠️ Нет модели для сравнения');
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                reason: 'Нет топологической модели для сравнения'
            };
        }
       
        const model = this.accumulator.models.get(targetModelId);
        if (!model) {
            console.log(`⚠️ Модель ${targetModelId} не найдена`);
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                reason: 'Топологическая модель не найдена'
            };
        }
       
        // Сравниваем
        const comparison = this.fingerprinter.compareGraphs(
            model.graph, model.fingerprints,
            photoGraph, photoFingerprints
        );
       
        const isSame = comparison.similarity >= (options.threshold || this.accumulator.similarityThreshold);
        const decision = isSame ? 'same' : 'different';
       
        console.log(`🎯 СРАВНЕНИЕ ФОТО С МОДЕЛЬЮ ${targetModelId}:`);
        console.log(`   Фото: ${points.length} точек, ${photoGraph.nodes.size} узлов`);
        console.log(`   Модель: ${model.graph.nodes.size} узлов`);
        console.log(`   Сходство: ${(comparison.similarity * 100).toFixed(1)}%`);
        console.log(`   Решение: ${decision.toUpperCase()}`);
       
        return {
            similar: isSame,
            similarity: comparison.similarity,
            decision: decision,
            exactMatches: comparison.exactMatches || [],
            stats: comparison,
            photoStats: {
                points: points.length,
                nodes: photoGraph.nodes.size,
                edges: photoGraph.edges.size
            },
            modelStats: {
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                modelId: targetModelId
            }
        };
    }
   
    // АККУМУЛЯТИВНАЯ ВИЗУАЛИЗАЦИЯ: Показывает ВСЕ узлы из ВСЕХ следов
// В TopologyManager.js, метод getAccumulativeVisualizationData:

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
   
    // 🔥 ИСПРАВЛЕНИЕ: Правильно считаем подтверждения
    const nodeConfirmations = new Map();
    for (const [nodeId, node] of graph.nodes) {
        // Используем confirmationCount, а не степень
        const confirmations = node.confirmationCount ||
                             (node.addedFrom ? 1 : 0); // Базовое подтверждение
       
        nodeConfirmations.set(nodeId, {
            confirmations: confirmations,
            confidence: node.confidence || 0.5,
            source: node.addedFrom || 'original',
            degree: node.degree,
            confirmationCount: confirmations
        });
    }
       
        // Группируем узлы по количеству "подтверждений"
        const pointsByConfirmation = {
            confirmed3: [], // 3+ подтверждений (высокая надежность)
            confirmed2: [], // 2 подтверждения (средняя надежность)
            confirmed1: [], // 1 подтверждение (низкая надежность)
            confirmed0: []  // 0 подтверждений (предсказанные)
        };
       
        for (const [nodeId, node] of graph.nodes) {
            const info = nodeConfirmations.get(nodeId);
            const confirmations = info.confirmations;
           
            // Определяем цвет по "подтверждениям"
            let color, size, confirmationLevel;
           
            if (confirmations >= 3) {
                color = '#FF0000';
                size = 8 + (node.confidence || 0.5) * 6;
                confirmationLevel = 'confirmed3';
                pointsByConfirmation.confirmed3.push(node);
            } else if (confirmations >= 2) {
                color = '#FF6B00';
                size = 6 + (node.confidence || 0.5) * 4;
                confirmationLevel = 'confirmed2';
                pointsByConfirmation.confirmed2.push(node);
            } else if (confirmations >= 1) {
                color = '#2196F3';
                size = 5 + (node.confidence || 0.5) * 3;
                confirmationLevel = 'confirmed1';
                pointsByConfirmation.confirmed1.push(node);
            } else {
                color = '#BDBDBD';
                size = 4;
                confirmationLevel = 'confirmed0';
                pointsByConfirmation.confirmed0.push(node);
            }
           
            // Добавляем информацию для визуализации
            node.vizData = {
                color: color,
                size: size,
                confirmationLevel: confirmationLevel,
                confirmations: confirmations,
                degree: node.degree,
                source: info.source
            };
        }
       
        // Статистика
        const stats = {
            totalNodes: graph.nodes.size,
            totalEdges: graph.edges.size,
            avgDegree: graph.avgDegree || 0,
            confirmed3: pointsByConfirmation.confirmed3.length,
            confirmed2: pointsByConfirmation.confirmed2.length,
            confirmed1: pointsByConfirmation.confirmed1.length,
            confirmed0: pointsByConfirmation.confirmed0.length,
            uniquenessRatio: fingerprints ?
                this.fingerprinter.getFingerprintInfo(fingerprints).uniquenessRatio : 0
        };
       
        return {
            modelId: targetModelId,
            modelName: model.metadata.name,
            points: Array.from(graph.nodes.values()),
            edges: Array.from(graph.edges),
            stats: stats,
            pointsByConfirmation: pointsByConfirmation,
            metadata: model.metadata,
            isTopological: true,
            visualizationMethod: 'topological_accumulative'
        };
    }
   
    // Получить информацию о всех моделях пользователя
    getUserModelsInfo() {
        return this.accumulator.getStats();
    }
   
    // Очистить все модели пользователя
    clearUserModels() {
        this.accumulator.models.clear();
        this.accumulator.currentModelId = null;
        this.linkedFootprints.clear();
       
        console.log(`🧹 Очищены все топологические модели пользователя ${this.userId}`);
        return { success: true, message: 'Топологические модели очищены' };
    }
   
    // Экспорт моделей пользователя
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
            version: '1.0-topological'
        };
    }
   
    // Импорт моделей пользователя
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
       
        // Восстанавливаем связи след-модель
        if (data.linkedFootprints && Array.isArray(data.linkedFootprints)) {
            data.linkedFootprints.forEach(([footprintId, modelId]) => {
                this.linkedFootprints.set(footprintId, modelId);
            });
        }
       
        console.log(`📥 Импортировано ${importedCount} топологических моделей для пользователя ${this.userId}`);
       
        return {
            success: true,
            importedCount: importedCount,
            totalModels: this.accumulator.models.size
        };
    }
}

module.exports = TopologyManager;
