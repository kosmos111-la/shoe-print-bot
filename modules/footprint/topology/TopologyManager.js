// modules/footprint/topology/TopologyManager.js
// 🎯 УПРАВЛЕНИЕ ТОПОЛОГИЧЕСКИМИ МОДЕЛЯМИ (БЕЗ ДУБЛИРОВАНИЯ FINGERPRINT)

const TopologyBuilder = require('./TopologyBuilder');
const TopologicalAccumulator = require('./TopologicalAccumulator');

class TopologyManager {
    constructor(options = {}) {
        this.userId = options.userId || 'default';
        this.name = options.name || `Топология_${this.userId}`;
        this.debug = options.debug || false;

        // 🔥 ТОЛЬКО builder И accumulator! fingerprint ТОЛЬКО В АККУМУЛЯТОРЕ!
        this.builder = new TopologyBuilder({ debug: this.debug });
        this.accumulator = new TopologicalAccumulator({
            name: this.name,
            debug: this.debug,
            similarityThreshold: options.similarityThreshold || 0.6,
            minMatchesForEnhancement: options.minMatchesForEnhancement || 3,
            wlIterations: options.wlIterations || 3
        });

        // Связь с существующей системой
        this.linkedFootprints = new Map();

        console.log(`🎯 TopologyManager создан для пользователя ${this.userId}`);
        console.log(`   🔥 Fingerprint только в аккумуляторе (без дублирования)`);
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

    // 🔥 ВИЗУАЛИЗАЦИЯ - ИСПОЛЬЗУЕМ fingerprint ИЗ АККУМУЛЯТОРА!
    getAccumulativeVisualizationData(modelId = null) {
        const targetModelId = modelId || this.accumulator.currentModelId;

        if (!targetModelId) {
            console.log('⚠️ Нет активной топологической модели');
            return null;
        }

        const model = this.accumulator.models.get(targetModelId);
        if (!model) return null;

        const graph = model.graph;

        // 🔥 БЕРЕМ fingerprint ИЗ МОДЕЛИ!
        const fingerprints = model.fingerprints;
       
        // 🔥 ИСПОЛЬЗУЕМ fingerprint ИЗ АККУМУЛЯТОРА!
        const fingerprinter = this.accumulator.fingerprinter;

        // Группируем узлы по количеству подтверждений
        const pointsByConfirmation = {
            confirmed3: [], // 3+ подтверждений
            confirmed2: [], // 2 подтверждения
            confirmed1: [], // 1 подтверждение
            confirmed0: []  // 0 подтверждений
        };

        for (const [nodeId, node] of graph.nodes) {
            const confirmations = node.confirmationCount ||
                                 (node.addedFrom ? 1 : 0);

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

            node.vizData = {
                color: color,
                size: size,
                confirmationLevel: confirmationLevel,
                confirmations: confirmations,
                degree: node.degree,
                source: node.addedFrom || 'original'
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
            uniquenessRatio: fingerprints && fingerprinter ?
                fingerprinter.getFingerprintInfo(fingerprints).uniquenessRatio : 0
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
