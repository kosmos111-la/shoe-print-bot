// modules/footprint/topology/TopologyManager.js
// 🎯 УПРАВЛЕНИЕ ТОПОЛОГИЧЕСКИМИ МОДЕЛЯМИ + ГЕОМЕТРИЧЕСКИЙ КОНТЕКСТ

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
        console.log(`   📐 Геометрический контекст: активен`);
        console.log(`   🔺 Голосование по 4 методам восстановления`);
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
                console.log(`   ${i+1}. ${p.id}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
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

    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК ИЗ ТЕКУЩЕГО ФОТО
    extractPointsFromCurrentPhoto(analysis, photoInfo = {}) {
        const points = [];

        if (!analysis?.predictions) {
            console.log('⚠️ Нет данных анализа для извлечения точек');
            return points;
        }

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

    // 🔥 ПОЛУЧЕНИЕ РЕШЕНИЯ ИЗ РЕЗУЛЬТАТА
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

    // 🔥🔥🔥 ВИЗУАЛИЗАЦИЯ МОДЕЛИ С ГЕОМЕТРИЧЕСКИМ КОНТЕКСТОМ
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

        console.log(`📊 Визуализация модели ${targetModelId}:`);
        console.log(`   Всего узлов: ${graph.nodes.size}`);

        // Статистика по геометрическому контексту
        const geometryContexts = this.accumulator.geometryContext?.contexts || new Map();
       
        const nodeInfoArray = [];
        const confirmationStats = { 0: 0, 1: 0, 2: 0, 3: 0 };
        let triangulatedNodes = 0;
        let geometryContextNodes = 0;
        let beaconTriangles = 0;

        for (const [nodeId, node] of graph.nodes) {
            // Подсчет подтверждений
            const confirmations = node.confirmationCount ||
                                 (node.addedAt ? 1 : 0);
            confirmationStats[confirmations] = (confirmationStats[confirmations] || 0) + 1;
           
            // Подсчет узлов восстановленных через геометрию
            if (node.addedFrom === 'geometry_context') {
                triangulatedNodes++;
                geometryContextNodes++;
            }

            // Гарантируем наличие координат
            if (!node.x || !node.y) {
                if (node.originalData?.x && node.originalData?.y) {
                    node.x = node.originalData.x;
                    node.y = node.originalData.y;
                } else {
                    node.x = Math.random() * 800 + 100;
                    node.y = Math.random() * 500 + 100;
                    console.log(`⚠️ Узел ${nodeId} не имеет координат, созданы случайные`);
                }
            }

            nodeInfoArray.push({
                id: nodeId,
                node: node,
                confirmations: confirmations
            });
        }

        // Статистика по геометрическим контекстам
        for (const context of geometryContexts.values()) {
            if (context.global?.beaconTriangles?.length > 0) {
                beaconTriangles += context.global.beaconTriangles.length;
            }
        }

        console.log(`   Узлов с геометрическим контекстом: ${geometryContexts.size}`);
        console.log(`   Треугольников с маяками: ${beaconTriangles}`);

        // Группировка по подтверждениям
        const pointsByConfirmation = {
            confirmed3: [], // 3+ подтверждений (маяки)
            confirmed2: [], // 2 подтверждения (стабильные)
            confirmed1: [], // 1 подтверждение (новые)
            confirmed0: []  // 0 подтверждений (предсказанные)
        };

        for (const info of nodeInfoArray) {
            const node = info.node;
            const confirmations = info.confirmations;

            // Определяем цвет и размер по количеству подтверждений
            let color, size, level;

            if (confirmations >= 3) {
                color = '#FF0000'; // 🔴 Маяки
                size = 10 + (node.confidence || 0.5) * 4;
                level = 'confirmed3';
                pointsByConfirmation.confirmed3.push(node);
            } else if (confirmations >= 2) {
                color = '#FF6B00'; // 🟠 Стабильные
                size = 8 + (node.confidence || 0.5) * 3;
                level = 'confirmed2';
                pointsByConfirmation.confirmed2.push(node);
            } else if (confirmations >= 1) {
                color = '#2196F3'; // 🔵 Новые
                size = 6 + (node.confidence || 0.5) * 2;
                level = 'confirmed1';
                pointsByConfirmation.confirmed1.push(node);
            } else {
                color = '#BDBDBD'; // ⚪ Предсказанные
                size = 4;
                level = 'confirmed0';
                pointsByConfirmation.confirmed0.push(node);
            }

            // Добавляем информацию для визуализации
            node.vizData = {
                color: color,
                size: size,
                level: level,
                confirmations: confirmations,
                degree: node.degree,
                source: node.addedFrom || 'original',
                placementMethod: node.placementMethod || node.addedFrom,
                placementConfidence: node.placementConfidence || 0.5,
                isTriangulated: node.addedFrom === 'geometry_context',
                hasGeometryContext: geometryContexts.has(node.originalId || node.id),
                id: nodeId
            };
        }

        // Статистика модели
        const stats = {
            totalNodes: graph.nodes.size,
            totalEdges: graph.edges.size,
            avgDegree: graph.avgDegree || 0,
            confirmed3: pointsByConfirmation.confirmed3.length,
            confirmed2: pointsByConfirmation.confirmed2.length,
            confirmed1: pointsByConfirmation.confirmed1.length,
            confirmed0: pointsByConfirmation.confirmed0.length,
            triangulatedNodes: triangulatedNodes,
            geometryContexts: geometryContexts.size,
            beaconTriangles: beaconTriangles,
            uniquenessRatio: fingerprints ?
                this.fingerprinter.getFingerprintInfo(fingerprints).uniquenessRatio : 0
        };

        console.log(`📊 СТАТИСТИКА МОДЕЛИ:`);
        console.log(`   🔴 Маяки (3+): ${stats.confirmed3}`);
        console.log(`   🟠 Стабильные (2): ${stats.confirmed2}`);
        console.log(`   🔵 Новые (1): ${stats.confirmed1}`);
        console.log(`   ⚪ Предсказанные (0): ${stats.confirmed0}`);
        console.log(`   📐 Геометрический контекст: ${stats.geometryContexts}`);
        console.log(`   🔺 Треугольников с маяками: ${stats.beaconTriangles}`);
        console.log(`   🎯 Уникальность подписей: ${(stats.uniquenessRatio * 100).toFixed(1)}%`);

        return {
            modelId: targetModelId,
            modelName: model.metadata.name,
            points: Array.from(graph.nodes.values()),
            edges: Array.from(graph.edges),
            stats: stats,
            pointsByConfirmation: pointsByConfirmation,
            metadata: model.metadata,
            geometryContexts: {
                total: geometryContexts.size,
                withBeacons: beaconTriangles > 0 ? geometryContexts.size : 0
            },
            isTopological: true,
            visualizationMethod: 'topology_with_geometry_context'
        };
    }

    // 🔥 СРАВНЕНИЕ ДВУХ СЛЕДОВ (ДЛЯ СОВМЕСТИМОСТИ)
    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 ТОПОЛОГИЧЕСКОЕ СРАВНЕНИЕ: "${footprint1.name}" vs "${footprint2.name}"`);

        console.log('⚠️ ВНИМАНИЕ: compareFootprints использует ВСЕ точки следов');

        // Извлекаем точки из обоих следов
        const points1 = this.extractPointsFromFootprint(footprint1);
        const points2 = this.extractPointsFromFootprint(footprint2);

        console.log(`📊 Точки для сравнения:`);
        console.log(`   ${footprint1.name}: ${points1.length} точек`);
        console.log(`   ${footprint2.name}: ${points2.length} точек`);

        if (points1.length < 3 || points2.length < 3) {
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

        const isSame = comparison.similarity >= (options.threshold || 0.6);
        const decision = isSame ? 'same' : 'different';

        console.log(`🎯 ТОПОЛОГИЧЕСКОЕ РЕШЕНИЕ:`);
        console.log(`   Сходство: ${(comparison.similarity * 100).toFixed(1)}%`);
        console.log(`   Решение: ${decision.toUpperCase()}`);
        console.log(`   Точных совпадений: ${comparison.exactMatches?.length || 0}`);

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
            }
        };
    }

    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК ИЗ СЛЕДА (ДЛЯ СОВМЕСТИМОСТИ)
    extractPointsFromFootprint(footprint) {
        const points = [];

        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({
                    id: id,
                    x: point.x,
                    y: point.y,
                    confidence: point.rating || point.confidence || 0.5,
                    source: 'footprint',
                    footprintId: footprint.id
                });
            }
        }

        return points;
    }

    // 🔥 СРАВНЕНИЕ ФОТО С МОДЕЛЬЮ
    async comparePhotoToModel(analysis, modelId = null, options = {}) {
        console.log(`🔍 СРАВНЕНИЕ ФОТО С МОДЕЛЬЮ ${modelId || 'любой'}`);

        const points = this.extractPointsFromCurrentPhoto(analysis, options.photoInfo || {});

        if (points.length < 3) {
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                reason: 'Недостаточно точек на фото'
            };
        }

        const photoGraph = this.builder.buildDelaunayGraph(points, 'current_photo');
        const photoFingerprints = this.fingerprinter.computeGraphFingerprints(photoGraph);

        const targetModelId = modelId || this.accumulator.currentModelId;

        if (!targetModelId) {
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                reason: 'Нет топологической модели для сравнения'
            };
        }

        const model = this.accumulator.models.get(targetModelId);
        if (!model) {
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                reason: 'Топологическая модель не найдена'
            };
        }

        const comparison = this.fingerprinter.compareGraphs(
            model.graph, model.fingerprints,
            photoGraph, photoFingerprints
        );

        const isSame = comparison.similarity >= (options.threshold || this.accumulator.similarityThreshold);
        const decision = isSame ? 'same' : 'different';

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
                modelId: targetModelId,
                beacons: this.accumulator.geometryContext?.getBeacons(model.graph).length || 0
            }
        };
    }

    // 🔥 ПОЛУЧИТЬ ИНФОРМАЦИЮ О ВСЕХ МОДЕЛЯХ
    getUserModelsInfo() {
        return this.accumulator.getStats();
    }

    // 🔥 ОЧИСТИТЬ ВСЕ МОДЕЛИ
    clearUserModels() {
        this.accumulator.models.clear();
        this.accumulator.currentModelId = null;
        this.linkedFootprints.clear();
       
        console.log(`🧹 Очищены все топологические модели пользователя ${this.userId}`);
        return { success: true, message: 'Топологические модели очищены' };
    }

    // 🔥 ЭКСПОРТ МОДЕЛЕЙ
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
            version: '3.0-geometry-context',
            philosophy: 'topology_with_geometry_context'
        };
    }

    // 🔥 ИМПОРТ МОДЕЛЕЙ
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

        if (data.linkedFootprints && Array.isArray(data.linkedFootprints)) {
            data.linkedFootprints.forEach(([footprintId, modelId]) => {
                this.linkedFootprints.set(footprintId, modelId);
            });
        }

        console.log(`📥 Импортировано ${importedCount} топологических моделей`);
        return {
            success: true,
            importedCount: importedCount,
            totalModels: this.accumulator.models.size
        };
    }

    // 🔥 ПОЛУЧИТЬ ГЕОМЕТРИЧЕСКИЙ КОНТЕКСТ ДЛЯ ОТЛАДКИ
    getGeometryContextStats(modelId = null) {
        const targetModelId = modelId || this.accumulator.currentModelId;
       
        if (!targetModelId || !this.accumulator.models.has(targetModelId)) {
            return { error: 'Model not found' };
        }

        const model = this.accumulator.models.get(targetModelId);
        const beacons = this.accumulator.geometryContext?.getBeacons(model.graph) || [];
        const contexts = this.accumulator.geometryContext?.contexts || new Map();

        return {
            modelId: targetModelId,
            beacons: beacons.length,
            contexts: contexts.size,
            contextsWithBeacons: Array.from(contexts.values()).filter(c =>
                c.global?.beaconTriangles?.length > 0
            ).length,
            beaconTriangles: Array.from(contexts.values()).reduce((sum, c) =>
                sum + (c.global?.beaconTriangles?.length || 0), 0
            )
        };
    }
}

module.exports = TopologyManager;
