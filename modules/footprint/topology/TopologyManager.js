// modules/footprint/topology/TopologyManager.js
// 🎯 ТОПОЛОГИЧЕСКИЙ МЕНЕДЖЕР - УПРАВЛЕНИЕ МОДЕЛЯМИ СЛЕДОВ

const TopologicalAccumulator = require('./TopologicalAccumulator');
const HierarchicalMatcher = require('../matching/HierarchicalMatcher');
const GraphBuilder = require('./GraphBuilder');
const KNNGraphBuilder = require('./KNNGraphBuilder');
const MorphologyEncoder = require('./MorphologyEncoder');
const PatternAnalyzer = require('../analysis/PatternAnalyzer');
const ClusterAnalyzer = require('../analysis/ClusterAnalyzer');
const RelativePositioning = require('./RelativePositioning');
const CenterMatcher = require('./CenterMatcher');

class TopologyManager {
    constructor(options = {}) {
        this.userId = options.userId;
        this.debug = options.debug || false;
       
        // Режим работы: 'sandbox' (песочница) или 'production' (накопление)
        this.sandboxMode = options.sandboxMode || false;
       
        // Параметры
        this.similarityThreshold = options.similarityThreshold || 0.6;
        this.minConsistentPairs = options.minConsistentPairs || 3;
        this.confidenceThreshold = options.confidenceThreshold || 0.8;
       
        // Компоненты
        this.graphBuilder = new GraphBuilder({ debug: this.debug });
        this.knnBuilder = new KNNGraphBuilder({
            debug: this.debug,
            k: options.k || 8
        });
       
        this.morphologyEncoder = new MorphologyEncoder({ debug: this.debug });
        this.patternAnalyzer = new PatternAnalyzer({ debug: this.debug });
        this.clusterAnalyzer = new ClusterAnalyzer({ debug: this.debug });
       
        this.relativePositioning = new RelativePositioning({
            debug: this.debug,
            confidenceThreshold: this.confidenceThreshold
        });
       
        this.centerMatcher = new CenterMatcher({
            debug: this.debug,
            minConsistentPairs: this.minConsistentPairs
        });

        // Создаём аккумулятор для этого пользователя
        this.accumulator = new TopologicalAccumulator({
            debug: this.debug,
            name: `Сессия_${new Date().toLocaleTimeString('ru-RU')}`,
            similarityThreshold: this.similarityThreshold,
            minConsistentPairs: this.minConsistentPairs,
            confidenceThreshold: this.confidenceThreshold,
            graphBuilder: this.graphBuilder,
            knnBuilder: this.knnBuilder,
            morphologyEncoder: this.morphologyEncoder,
            patternAnalyzer: this.patternAnalyzer,
            clusterAnalyzer: this.clusterAnalyzer,
            relativePositioning: this.relativePositioning,
            centerMatcher: this.centerMatcher
        });

        // Кеш для быстрого доступа
        this.cache = {
            lastPhotoId: null,
            lastResult: null,
            lastVisualization: null
        };

        // Статистика
        this.stats = {
            totalPhotos: 0,
            totalMatches: 0,
            totalNewNodes: 0,
            totalRemovedNodes: 0,
            created: new Date(),
            lastUpdated: new Date()
        };

        console.log(`🎯 TopologyManager создан для пользователя ${this.userId}`);
        console.log(`   🔥 Режим: ${this.sandboxMode ? 'ПЕСОЧНИЦА' : 'ПРОДАКШН (накопление)'}`);
        console.log(`   🔥 Порог сходства: ${this.similarityThreshold * 100}%`);
        console.log(`   🔥 Минимум якорей: ${this.minConsistentPairs}`);
        console.log(`   🔥 Порог уверенности: ${this.confidenceThreshold * 100}%`);
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    /**
     * Обработка нового фото
     */
    async processFootprint(photoId, points, contours, options = {}) {
        console.log(`🎯 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА фото ${String(photoId).slice(0, 20)}...`);
        console.log(`📦 Получены точки (${points.length}) и контуры (${contours?.length || 0})`);

        const startTime = Date.now();

        // Извлекаем точки из анализа
        const extractedPoints = this.extractPoints(points);
        const extractedContours = this.extractContours(contours, extractedPoints);

        console.log(`📊 Извлечено ${extractedPoints.length} точек ИЗ ТЕКУЩЕГО ФОТО`);

        // Определяем, есть ли уже модель для этого пользователя
        const currentModelId = this.accumulator.getCurrentModelId();
       
        let result;
       
        if (!currentModelId) {
            console.log(`🆕 Первое фото в сессии, создаю базовую модель`);
            result = await this.accumulator.processPoints(extractedPoints, {
                photoId,
                contours: extractedContours,
                source: 'photo',
                ...options
            });
        } else {
            // Есть модель - пробуем иерархическое сравнение
            console.log(`🔄 Использую существующую модель ${currentModelId.slice(0, 12)}...`);
           
            result = await this.accumulator.processPoints(extractedPoints, {
                photoId,
                contours: extractedContours,
                modelId: currentModelId,
                source: 'photo',
                ...options
            });
        }

        // Обновляем статистику
        this.stats.totalPhotos++;
        this.stats.lastUpdated = new Date();
       
        if (result) {
            this.stats.totalMatches += result.matches?.length || 0;
            this.stats.totalNewNodes += result.newNodesAdded || 0;
            this.stats.totalRemovedNodes += result.nodesRemoved || 0;
        }

        // Сохраняем в кеш
        this.cache.lastPhotoId = photoId;
        this.cache.lastResult = result;

        // Генерируем визуализацию если нужно
        if (options.generateVisualization !== false) {
            try {
                const visData = await this.generateVisualization(photoId, result);
                this.cache.lastVisualization = visData;
                result.visualization = visData;
            } catch (e) {
                console.log(`⚠️ Ошибка визуализации: ${e.message}`);
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`\n⏱️ Обработка фото заняла ${elapsed}ms`);
       
        return result;
    }

    /**
     * Извлечение точек из предсказаний
     */
    extractPoints(predictions) {
        if (!predictions || !Array.isArray(predictions)) {
            return [];
        }

        const points = [];
        let index = 0;

        for (const pred of predictions) {
            if (!pred || !pred.points || !Array.isArray(pred.points)) continue;

            // Берем все точки протектора
            if (pred.class === 'shoe-protector' || pred.class === 'protector') {
                for (const point of pred.points) {
                    if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                        points.push({
                            id: `pt_${Date.now()}_${index++}`,
                            x: point.x,
                            y: point.y,
                            confidence: pred.confidence || 0.5,
                            class: pred.class,
                            originalPoints: pred.points
                        });
                    }
                }
            }
        }

        return points;
    }

    /**
     * Извлечение контуров из предсказаний
     */
    extractContours(predictions, extractedPoints) {
        if (!predictions || !Array.isArray(predictions)) {
            return [];
        }

        const contours = [];
        let pointIndex = 0;

        for (const pred of predictions) {
            if (!pred || !pred.points || !Array.isArray(pred.points)) continue;

            if (pred.class === 'shoe-protector' || pred.class === 'protector') {
                // Создаем контур для каждой точки протектора
                for (let i = 0; i < pred.points.length; i++) {
                    if (pointIndex < extractedPoints.length) {
                        contours.push({
                            pointId: extractedPoints[pointIndex].id,
                            points: pred.points,
                            class: pred.class,
                            confidence: pred.confidence
                        });
                        pointIndex++;
                    }
                }
            }
        }

        return contours;
    }

    // ==================== ВИЗУАЛИЗАЦИЯ ====================

    /**
     * Генерация визуализации
     */
    async generateVisualization(photoId, result) {
        console.log(`\n🎨 Генерация визуализации для фото ${photoId.slice(0, 20)}...`);

        const ClusterVisualizer = require('../visualizations/cluster-visualizer');
        const visualizer = new ClusterVisualizer({
            debug: this.debug,
            outputDir: './data/footprints/visualizations/topology'
        });

        const model = this.accumulator.getCurrentModel();
        if (!model) {
            console.log('⚠️ Нет модели для визуализации');
            return null;
        }

        // Собираем данные для визуализации
        const visData = {
            points: Array.from(model.graph.nodes.values()),
            edges: Array.from(model.graph.edges),
            stats: {
                totalNodes: model.graph.nodes.size,
                totalEdges: model.graph.edges.size,
                confirmed3: 0,
                confirmed2: 0,
                confirmed1: 0,
                confirmed0: 0
            },
            matchMap: result?.matchMap || new Map(),
            photoPoints: result?.photoPoints || []
        };

        // Считаем подтверждения
        for (const node of model.graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 3) visData.stats.confirmed3++;
            else if (count >= 2) visData.stats.confirmed2++;
            else if (count >= 1) visData.stats.confirmed1++;
            else visData.stats.confirmed0++;
        }

        const filename = `topology_${this.userId}_${Date.now()}.png`;
        const result_vis = await visualizer.visualizeTopologicalModel(visData, { filename });

        console.log(`✅ Визуализация сохранена: ${result_vis.modelPath}`);
       
        return result_vis;
    }

    // ==================== УПРАВЛЕНИЕ МОДЕЛЯМИ ====================

    /**
     * Получить текущую модель
     */
    getCurrentModel() {
        return this.accumulator.getCurrentModel();
    }

    /**
     * Получить ID текущей модели
     */
    getCurrentModelId() {
        return this.accumulator.getCurrentModelId();
    }

    /**
     * Переключиться на другую модель
     */
    switchToModel(modelId) {
        return this.accumulator.switchToModel(modelId);
    }

    /**
     * Получить все модели
     */
    getAllModels() {
        return this.accumulator.getAllModels();
    }

    /**
     * Получить статистику
     */
    getStats() {
        const accStats = this.accumulator.getStats();
        return {
            ...this.stats,
            accumulator: accStats,
            currentModelId: this.accumulator.getCurrentModelId(),
            totalModels: accStats?.models?.total || 0
        };
    }

    /**
     * Получить данные для визуализации
     */
    getVisualizationData(modelId = null, reliablePhotoIds = []) {
        return this.accumulator.getVisualizationData(modelId, reliablePhotoIds);
    }

    /**
     * Получить информацию о модели
     */
    getModelInfo(modelId = null) {
        return this.accumulator.getModelInfo(modelId);
    }

    /**
     * Получить модель по ID фото
     */
    getModelForPhoto(photoId) {
        return this.accumulator.getModelForPhoto(photoId);
    }

    /**
     * Получить все фото для модели
     */
    getPhotosForModel(modelId) {
        return this.accumulator.getPhotosForModel(modelId);
    }

    /**
     * Получить кеш
     */
    getCache() {
        return this.cache;
    }

    /**
     * Получить последний результат
     */
    getLastResult() {
        return this.cache.lastResult;
    }

    /**
     * Получить последнюю визуализацию
     */
    getLastVisualization() {
        return this.cache.lastVisualization;
    }

    // ==================== ЭКСПОРТ/ИМПОРТ ====================

    /**
     * Экспорт модели
     */
    exportModel(modelId) {
        return this.accumulator.exportModel(modelId);
    }

    /**
     * Импорт модели
     */
    importModel(modelData) {
        const result = this.accumulator.importModel(modelData);
        if (result) {
            this.stats.lastUpdated = new Date();
        }
        return result;
    }

    /**
     * Экспорт всех моделей
     */
    exportAllModels() {
        const models = this.accumulator.getAllModels();
        const exports = {};
       
        for (const model of models) {
            exports[model.id] = this.accumulator.exportModel(model.id);
        }
       
        return {
            userId: this.userId,
            exportedAt: new Date(),
            models: exports,
            stats: this.stats
        };
    }

    /**
     * Импорт всех моделей
     */
    importAllModels(data) {
        if (!data || !data.models) return { success: false, count: 0 };
       
        let count = 0;
        for (const [modelId, modelData] of Object.entries(data.models)) {
            if (this.accumulator.importModel(modelData)) {
                count++;
            }
        }
       
        this.stats.lastUpdated = new Date();
        console.log(`📥 Импортировано ${count} моделей`);
       
        return { success: true, count };
    }

    // ==================== ОЧИСТКА ====================

    /**
     * Очистить все данные
     */
    clear() {
        this.accumulator.clear();
        this.cache = {
            lastPhotoId: null,
            lastResult: null,
            lastVisualization: null
        };
        this.stats = {
            totalPhotos: 0,
            totalMatches: 0,
            totalNewNodes: 0,
            totalRemovedNodes: 0,
            created: this.stats.created,
            lastUpdated: new Date()
        };
        console.log(`🧹 TopologyManager для пользователя ${this.userId} очищен`);
    }

    /**
     * Очистить кеш
     */
    clearCache() {
        this.cache = {
            lastPhotoId: null,
            lastResult: null,
            lastVisualization: null
        };
        console.log(`🧹 Кеш TopologyManager очищен`);
    }
}

module.exports = TopologyManager;
