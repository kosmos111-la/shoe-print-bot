// modules/footprint/topology/TopologyManager.js
// 🎯 УПРАВЛЕНИЕ ТОПОЛОГИЧЕСКИМИ МОДЕЛЯМИ (С ПОДДЕРЖКОЙ ПЕСОЧНИЦЫ)

const TopologicalAccumulator = require('./TopologicalAccumulator');

class TopologyManager {
    constructor(options = {}) {
        this.userId = options.userId || 'default';
        this.name = options.name || `Топология_${this.userId}`;
        this.debug = options.debug || false;

        // 🔥 РЕЖИМ ПЕСОЧНИЦЫ
        this.sandboxMode = options.sandboxMode || false;

        // Аккумулятор с поддержкой Делоне
        this.accumulator = new TopologicalAccumulator({
            name: this.name,
            debug: this.debug,
            similarityThreshold: options.similarityThreshold || 0.6,
            minMatchesForEnhancement: options.minMatchesForEnhancement || 3,
            wlIterations: options.wlIterations || 3
        });

        // Связь с существующей системой
        this.linkedFootprints = new Map();

        // 🔥 ВРЕМЕННЫЕ МОДЕЛИ ДЛЯ ПЕСОЧНИЦЫ
        this.sandboxModels = new Map();

        console.log(`🎯 TopologyManager создан для пользователя ${this.userId}`);
        console.log(`   🔥 Режим: ${this.sandboxMode ? 'ПЕСОЧНИЦА' : 'ПРОДАКШН'}`);
        console.log(`   🔥 Аккумулятор с Делоне + нормализация`);
    }

    // ==================== ГЛАВНЫЙ МЕТОД ====================

    async processFootprint(footprint, analysisData, photoInfo = {}) {
        console.log(`\n🎯 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА фото ${photoInfo.photoId || 'без ID'}...`);

        let points = [];
        let contours = [];

        if (Array.isArray(analysisData)) {
            points = analysisData;
            contours = [];
            console.log(`📦 Получен массив точек (старый формат): ${points.length}`);
        } else if (analysisData && typeof analysisData === 'object') {
            if (analysisData.predictions) {
                const extracted = this.extractPointsFromCurrentPhoto(analysisData, photoInfo);
                points = extracted.points;
                contours = extracted.contours;
            } else {
                points = analysisData.points || [];
                contours = analysisData.contours || [];
            }
            console.log(`📦 Получены точки (${points.length}) и контуры (${contours.length})`);
        }

        if (points.length < 3) {
            console.log('⚠️ Слишком мало точек для топологии');
            return {
                success: false,
                error: 'Недостаточно точек для топологической обработки',
                points: points.length
            };
        }

        console.log(`📊 Извлечено ${points.length} точек ИЗ ТЕКУЩЕГО ФОТО`);

        if (this.debug && points.length > 0) {
            console.log(`📋 Первые 3 точки текущего фото:`);
            points.slice(0, 3).forEach((p, i) => {
                console.log(`   ${i+1}. ${p.id || 'no-id'}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
            });
        }

        // 🔥 ОПРЕДЕЛЯЕМ МОДЕЛЬ ДЛЯ СРАВНЕНИЯ
        let modelId;

        if (this.sandboxMode) {
            const sessionId = photoInfo.sessionId || 'default_sandbox';
            modelId = this.sandboxModels.get(sessionId);

            if (!modelId) {
                modelId = `sandbox_${sessionId}_${Date.now()}`;
                this.sandboxModels.set(sessionId, modelId);
                console.log(`🏖️ Создана временная модель для сессии ${sessionId}`);
            }
        } else {
            modelId = this.linkedFootprints.get(footprint.id);
            if (!modelId && this.accumulator.currentModelId) {
                modelId = this.accumulator.currentModelId;
                this.linkedFootprints.set(footprint.id, modelId);
                console.log(`🔗 Связал след ${footprint.id} с моделью ${modelId}`);
            }
        }

        const result = await this.accumulator.processPoints(points, {
            modelId: modelId,
            source: `photo_${photoInfo.photoId || Date.now()}`,
            name: photoInfo.name || `Фото_${new Date().toLocaleTimeString('ru-RU')}`,
            footprintId: footprint.id,
            photoInfo: photoInfo,
            photoId: photoInfo.photoId,
            contours: contours
        });

        if (!this.sandboxMode && result.modelId && result.modelId !== modelId) {
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
            sandboxMode: this.sandboxMode
        };
    }

    // ==================== УПРАВЛЕНИЕ ПЕСОЧНИЦЕЙ ====================

    startSandboxSession(sessionId) {
        console.log(`\n🏖️ ЗАПУСК ПЕСОЧНИЦЫ для сессии ${sessionId}`);
        this.sandboxModels.delete(sessionId);
        return { success: true, sessionId };
    }

    endSandboxSession(sessionId) {
        const modelId = this.sandboxModels.get(sessionId);
        if (!modelId) {
            console.log(`⚠️ Сессия ${sessionId} не найдена в песочнице`);
            return { success: false, error: 'Session not found' };
        }

        const modelInfo = this.accumulator.getModelInfo(modelId);
        this.sandboxModels.delete(sessionId);

        console.log(`\n🏖️ ЗАВЕРШЕНИЕ ПЕСОЧНИЦЫ для сессии ${sessionId}`);
        console.log(`   Итоговая модель: ${modelId}`);
        console.log(`   Узлов: ${modelInfo.stats?.nodes || 0}`);

        return {
            success: true,
            sessionId,
            modelId,
            modelInfo
        };
    }

    clearAllSandboxes() {
        const count = this.sandboxModels.size;
        this.sandboxModels.clear();
        console.log(`🧹 Очищено ${count} песочниц`);
        return { success: true, cleared: count };
    }

    // ==================== ИЗВЛЕЧЕНИЕ ТОЧЕК И КОНТУРОВ ====================

    extractPointsFromCurrentPhoto(analysis, photoInfo = {}) {
        const points = [];
        const contours = [];

        if (!analysis?.predictions) {
            console.log('⚠️ Нет данных анализа для извлечения точек');
            return { points, contours };
        }

        const photoId = photoInfo.photoId || `photo_${Date.now()}`;
        const predictions = analysis.predictions || [];
        let protectorCount = 0;

        predictions.forEach((pred, idx) => {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);

                const pointId = `${photoId}_pt_${protectorCount}`;
               
                contours.push({
                    id: `${photoId}_contour_${protectorCount}`,
                    pointId: pointId,
                    points: pred.points,
                    class: pred.class,
                    confidence: pred.confidence || 0.5
                });

                points.push({
                    id: pointId,
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2,
                    confidence: pred.confidence || 0.5,
                    source: 'current_photo',
                    photoId: photoId,
                    originalIndex: protectorCount,
                    originalPoints: pred.points,
                    contourId: `${photoId}_contour_${protectorCount}`
                });
                protectorCount++;
            }
        });

        console.log(`📸 Извлечено ${points.length} точек и ${contours.length} контуров из ТЕКУЩЕГО ФОТО ${photoId}`);

        return { points, contours };
    }

    // ==================== ПОЛУЧЕНИЕ РЕШЕНИЯ ====================

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

    // ==================== ВИЗУАЛИЗАЦИЯ ====================

    getAccumulativeVisualizationData(modelId = null) {
        const targetModelId = modelId || this.accumulator.currentModelId;

        if (!targetModelId) {
            console.log('⚠️ Нет активной топологической модели');
            return null;
        }

        return this.accumulator.getVisualizationData(targetModelId);
    }

    // ==================== ИНФОРМАЦИЯ О МОДЕЛЯХ ====================

    getUserModelsInfo() {
        return this.accumulator.getStats();
    }

    clearUserModels() {
        this.accumulator.models.clear();
        this.accumulator.currentModelId = null;
        this.linkedFootprints.clear();
        this.sandboxModels.clear();

        console.log(`🧹 Очищены все топологические модели пользователя ${this.userId}`);
        return { success: true, message: 'Топологические модели очищены' };
    }

    // ==================== ЭКСПОРТ/ИМПОРТ ====================

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

        console.log(`📥 Импортировано ${importedCount} топологических моделей для пользователя ${this.userId}`);

        return {
            success: true,
            importedCount: importedCount,
            totalModels: this.accumulator.models.size
        };
    }
}

module.exports = TopologyManager;
