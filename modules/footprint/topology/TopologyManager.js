// modules/footprint/topology/TopologyManager.js
// 🎯 УПРАВЛЕНИЕ ТОПОЛОГИЧЕСКИМИ МОДЕЛЯМИ (интеграция с SimpleFootprintManager)

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
            iterations: options.wlIterations || 3
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
        console.log(`\n🎯 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА следа "${footprint.name}"...`);
       
        // 1. Извлекаем точки из footprint (центры деталей)
        const points = this.extractPointsFromFootprint(footprint, analysis);
       
        if (points.length < 3) {
            console.log('⚠️ Слишком мало точек для топологии');
            return {
                success: false,
                error: 'Недостаточно точек для топологической обработки',
                points: points.length
            };
        }
       
        console.log(`📊 Извлечено ${points.length} точек из следа`);
       
        // 2. Определяем модель для сравнения
        let modelId = this.linkedFootprints.get(footprint.id);
        if (!modelId && this.accumulator.currentModelId) {
            modelId = this.accumulator.currentModelId;
            this.linkedFootprints.set(footprint.id, modelId);
            console.log(`🔗 Связал след ${footprint.id} с моделью ${modelId}`);
        }
       
        // 3. Обрабатываем точки через топологический аккумулятор
        const result = await this.accumulator.processPoints(points, {
            modelId: modelId,
            source: `footprint_${footprint.id}`,
            name: photoInfo.name || `Фото_${new Date().toLocaleTimeString('ru-RU')}`,
            footprintId: footprint.id,
            photoInfo: photoInfo
        });
       
        // 4. Обновляем связь след-модель
        if (result.modelId && result.modelId !== modelId) {
            this.linkedFootprints.set(footprint.id, result.modelId);
            console.log(`🔄 Обновлена связь: след ${footprint.id} → модель ${result.modelId}`);
        }
       
        // 5. Получаем обновленную информацию о модели
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
   
    // Извлечение точек из footprint (совместимость со старой системой)
    extractPointsFromFootprint(footprint, analysis = null) {
        const points = [];
       
        // Вариант 1: Извлечь из PointTracker (честные подтверждения)
        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({
                    id: id,
                    x: point.x,
                    y: point.y,
                    confidence: point.rating || point.confidence || 0.5,
                    confirmedCount: point.confirmedCount || 1,
                    source: 'point_tracker',
                    footprintId: footprint.id
                });
            }
        }
       
        // Вариант 2: Извлечь из анализа (если PointTracker пуст)
        if (points.length === 0 && analysis && analysis.predictions) {
            const predictions = analysis.predictions || [];
           
            predictions.forEach((pred, idx) => {
                if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                    const xs = pred.points.map(p => p.x);
                    const ys = pred.points.map(p => p.y);
                   
                    points.push({
                        id: `analysis_pt_${idx}`,
                        x: (Math.min(...xs) + Math.max(...xs)) / 2,
                        y: (Math.min(...ys) + Math.max(...ys)) / 2,
                        confidence: pred.confidence || 0.5,
                        source: 'analysis',
                        footprintId: footprint.id
                    });
                }
            });
        }
       
        // Вариант 3: Извлечь из графа
        if (points.length === 0 && footprint.graph && footprint.graph.nodes) {
            let idx = 0;
            for (const [nodeId, node] of footprint.graph.nodes) {
                points.push({
                    id: nodeId,
                    x: node.x || 0,
                    y: node.y || 0,
                    confidence: node.confidence || 0.5,
                    source: 'graph',
                    footprintId: footprint.id
                });
                idx++;
            }
        }
       
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
   
    // 🔥 ИНТЕГРАЦИЯ: Сравнение двух следов через топологию
    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 ТОПОЛОГИЧЕСКОЕ СРАВНЕНИЕ: "${footprint1.name}" vs "${footprint2.name}"`);
       
        // 1. Извлекаем точки из обоих следов
        const points1 = this.extractPointsFromFootprint(footprint1);
        const points2 = this.extractPointsFromFootprint(footprint2);
       
        if (points1.length < 3 || points2.length < 3) {
            console.log('⚠️ Один из следов имеет слишком мало точек');
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                reason: 'Недостаточно точек для сравнения'
            };
        }
       
        // 2. Строим графы Делоне
        const graph1 = this.builder.buildDelaunayGraph(points1, footprint1.name);
        const graph2 = this.builder.buildDelaunayGraph(points2, footprint2.name);
       
        // 3. Вычисляем WL-подписи
        const fingerprints1 = this.fingerprinter.computeGraphFingerprints(graph1);
        const fingerprints2 = this.fingerprinter.computeGraphFingerprints(graph2);
       
        // 4. Сравниваем по подписям
        const comparison = this.fingerprinter.compareGraphs(
            graph1, fingerprints1,
            graph2, fingerprints2
        );
       
        // 5. Принимаем решение
        const isSame = comparison.similarity >= (options.threshold || 0.6);
        const decision = isSame ? 'same' : 'different';
       
        console.log(`🎯 ТОПОЛОГИЧЕСКОЕ РЕШЕНИЕ:`);
        console.log(`   Сходство: ${(comparison.similarity * 100).toFixed(1)}%`);
        console.log(`   Порог: ${(options.threshold || 0.6) * 100}%`);
        console.log(`   Решение: ${decision.toUpperCase()}`);
        console.log(`   Точных совпадений: ${comparison.exactMatches.length}`);
       
        return {
            similar: isSame,
            similarity: comparison.similarity,
            decision: decision,
            exactMatches: comparison.exactMatches,
            stats: comparison,
            method: 'topological_delaunay_wl',
            graphs: {
                nodes1: graph1.nodes.size,
                edges1: graph1.edges.size,
                nodes2: graph2.nodes.size,
                edges2: graph2.edges.size
            }
        };
    }
   
    // 🔥 АККУМУЛЯТИВНАЯ ВИЗУАЛИЗАЦИЯ: Показывает ВСЕ узлы из ВСЕХ следов
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
       
        // Подсчитываем подтверждения (из скольких следов узел)
        const nodeConfirmations = new Map();
        for (const [nodeId, node] of graph.nodes) {
            // Пока просто степень узла как мера "важности"
            // В будущем можно считать из скольких следов пришел узел
            nodeConfirmations.set(nodeId, {
                confirmations: node.degree, // временно используем степень
                confidence: node.confidence || 0.5,
                source: node.addedFrom || 'original',
                degree: node.degree
            });
        }
       
        // Группируем узлы по количеству "подтверждений"
        const pointsByConfirmation = {
            confirmed3: [], // 3+ подтверждений (высокая надежность)
            confirmed2: [], // 2 подтверждения (средняя надежность)
            confirmed1: [], // 1 подтверждение (низкая надежность)
            confirmed0: []  // 0 подтверждений (предсказанные)
        };
       
        for (const [nodeId, node] of graph.nodes) {
            const info = nodeConfirmations.get(nodeId);
            const confirmations = info.confirmations;
           
            // Определяем цвет по "подтверждениям"
            let color, size, confirmationLevel;
           
            if (confirmations >= 3) {
                color = '#FF0000'; // 🔴 Красный
                size = 8 + (node.confidence || 0.5) * 6;
                confirmationLevel = 'confirmed3';
                pointsByConfirmation.confirmed3.push(node);
            } else if (confirmations >= 2) {
                color = '#FF6B00'; // 🟠 Оранжевый
                size = 6 + (node.confidence || 0.5) * 4;
                confirmationLevel = 'confirmed2';
                pointsByConfirmation.confirmed2.push(node);
            } else if (confirmations >= 1) {
                color = '#2196F3'; // 🔵 Синий
                size = 5 + (node.confidence || 0.5) * 3;
                confirmationLevel = 'confirmed1';
                pointsByConfirmation.confirmed1.push(node);
            } else {
                color = '#BDBDBD'; // ⚪ Серый
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
