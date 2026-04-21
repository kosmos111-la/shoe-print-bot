// modules/footprint/topology/ModelManager.js
// 🗃️ МЕНЕДЖЕР ТОПОЛОГИЧЕСКИХ МОДЕЛЕЙ - CRUD, переключение, экспорт/импорт

class ModelManager {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище моделей
        this.models = new Map();
        this.currentModelId = null;
        this.modelRelations = new Map();
        this.photoToModel = new Map();
       
        // Статистика
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            differentFootprintsDetected: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
       
        console.log('🗃️ ModelManager создан');
    }

    // ==================== CRUD ОПЕРАЦИИ ====================

    /**
     * Создать новую модель
     */
    createModel(modelData) {
        const modelId = modelData.id || `model_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
       
        const model = {
            id: modelId,
            graph: modelData.graph,
            knnGraph: modelData.knnGraph || null,
            knnFingerprints: modelData.knnFingerprints || new Map(),
            morphologyMap: modelData.morphologyMap || new Map(),
            originalPoints: modelData.originalPoints || [],
            patternData: modelData.patternData || null,
            clusterData: modelData.clusterData || null,
            structures: modelData.structures || [],
            pointToStructure: modelData.pointToStructure || new Map(),
            transform: modelData.transform || null,
            lastTriangleResult: modelData.lastTriangleResult || null,
            metadata: {
                name: modelData.metadata?.name || `Модель_${new Date().toLocaleTimeString('ru-RU')}`,
                createdAt: new Date(),
                photoCount: modelData.metadata?.photoCount || 1,
                source: modelData.metadata?.source || 'unknown',
                outlineContour: modelData.metadata?.outlineContour || null,
                lastEnhanced: null
            },
            history: modelData.history || [{
                action: 'created',
                timestamp: new Date(),
                nodes: modelData.graph?.nodes?.size || 0
            }]
        };
       
        this.models.set(modelId, model);
        this.currentModelId = modelId;
        this.stats.totalModels++;
        this.stats.lastUpdated = new Date();
       
        if (this.debug) {
            console.log(`🗃️ Создана модель ${modelId.substring(0, 12)}... (${model.graph.nodes.size} узлов)`);
        }
       
        return model;
    }

    /**
     * Получить модель по ID
     */
    getModel(modelId) {
        return this.models.get(modelId) || null;
    }

    /**
     * Получить текущую модель
     */
    getCurrentModel() {
        return this.currentModelId ? this.models.get(this.currentModelId) : null;
    }

    /**
     * Получить ID текущей модели
     */
    getCurrentModelId() {
        return this.currentModelId;
    }

    /**
     * Обновить модель
     */
    updateModel(modelId, updates) {
        const model = this.models.get(modelId);
        if (!model) return false;
       
        Object.assign(model, updates);
        model.metadata.lastEnhanced = new Date();
        this.stats.lastUpdated = new Date();
       
        return true;
    }

    /**
     * Удалить модель
     */
    deleteModel(modelId) {
        const existed = this.models.delete(modelId);
        if (existed) {
            this.modelRelations.delete(modelId);
           
            // Удаляем связи с фото
            for (const [photoId, mid] of this.photoToModel) {
                if (mid === modelId) {
                    this.photoToModel.delete(photoId);
                }
            }
           
            if (this.currentModelId === modelId) {
                this.currentModelId = null;
            }
           
            this.stats.totalModels--;
            this.stats.lastUpdated = new Date();
        }
       
        return existed;
    }

    // ==================== УПРАВЛЕНИЕ ТЕКУЩЕЙ МОДЕЛЬЮ ====================

    /**
     * Переключиться на другую модель
     */
    switchToModel(modelId) {
        if (!this.models.has(modelId)) {
            if (this.debug) console.log(`❌ Модель ${modelId} не найдена`);
            return false;
        }
       
        this.currentModelId = modelId;
       
        if (this.debug) {
            console.log(`🔄 Переключился на модель ${modelId.substring(0, 12)}...`);
        }
       
        return true;
    }

    /**
     * Проверить существование модели
     */
    hasModel(modelId) {
        return this.models.has(modelId);
    }

    // ==================== ПОЛУЧЕНИЕ ВСЕХ МОДЕЛЕЙ ====================

    /**
     * Получить все модели (с метаданными)
     */
    getAllModels() {
        const models = [];
       
        for (const [modelId, model] of this.models) {
            models.push({
                id: modelId,
                name: model.metadata.name,
                nodes: model.graph.nodes.size,
                edges: model.graph.edges.size,
                photos: model.metadata.photoCount || 0,
                createdAt: model.metadata.createdAt,
                lastUpdated: model.metadata.lastEnhanced || model.metadata.createdAt,
                isCurrent: modelId === this.currentModelId,
                hasTransform: !!model.transform
            });
        }
       
        return models;
    }

    /**
     * Получить все модели (полные объекты)
     */
    getAllFullModels() {
        return this.models;
    }

    /**
     * Получить количество моделей
     */
    getModelCount() {
        return this.models.size;
    }

    // ==================== СВЯЗИ МЕЖДУ МОДЕЛЯМИ ====================

    /**
     * Добавить связь между моделями
     */
    addModelRelation(modelId1, modelId2, type, similarity) {
        // Обновляем связь для первой модели
        const rel1 = this.modelRelations.get(modelId1) || { related: [], type: null, similarity: 0 };
        if (!rel1.related.includes(modelId2)) {
            rel1.related.push(modelId2);
        }
        rel1.type = type;
        rel1.similarity = similarity;
        this.modelRelations.set(modelId1, rel1);
       
        // Обновляем связь для второй модели
        const rel2 = this.modelRelations.get(modelId2) || { related: [], type: null, similarity: 0 };
        if (!rel2.related.includes(modelId1)) {
            rel2.related.push(modelId1);
        }
        rel2.type = type;
        rel2.similarity = similarity;
        this.modelRelations.set(modelId2, rel2);
       
        if (type === 'different') {
            this.stats.differentFootprintsDetected++;
        }
    }

    /**
     * Получить связи модели
     */
    getModelRelations(modelId = null) {
        if (modelId) {
            return this.modelRelations.get(modelId) || null;
        }
       
        const relations = [];
        for (const [modelId, rel] of this.modelRelations) {
            relations.push({
                modelId,
                relatedTo: rel.related,
                type: rel.type,
                similarity: rel.similarity
            });
        }
        return relations;
    }

    // ==================== СВЯЗЬ ФОТО-МОДЕЛЬ ====================

    /**
     * Связать фото с моделью
     */
    linkPhotoToModel(photoId, modelId) {
        this.photoToModel.set(photoId, modelId);
    }

    /**
     * Получить модель для фото
     */
    getModelForPhoto(photoId) {
        return this.photoToModel.get(photoId) || null;
    }

    /**
     * Получить все фото для модели
     */
    getPhotosForModel(modelId) {
        const photos = [];
        for (const [photoId, mid] of this.photoToModel) {
            if (mid === modelId) {
                photos.push(photoId);
            }
        }
        return photos;
    }

    // ==================== СТАТИСТИКА ====================

    /**
     * Получить статистику по всем моделям
     */
    getModelsStats() {
        const stats = {
            total: this.models.size,
            current: this.currentModelId,
            differentFootprints: this.stats.differentFootprintsDetected,
            models: this.getAllModels()
        };
       
        return stats;
    }

    /**
     * Получить информацию о конкретной модели
     */
    getModelInfo(modelId = null) {
        const targetId = modelId || this.currentModelId;
        if (!targetId || !this.models.has(targetId)) {
            return { error: 'Model not found' };
        }
       
        const model = this.models.get(targetId);
        const graph = model.graph;
       
        const confirmations = { 1: 0, 2: 0, 3: 0, '4+': 0 };
        for (const node of graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) confirmations['4+']++;
            else if (count > 0) confirmations[count] = (confirmations[count] || 0) + 1;
        }
       
        return {
            id: model.id,
            name: model.metadata.name,
            stats: {
                nodes: graph.nodes.size,
                edges: graph.edges.size,
                confirmed1: confirmations[1] || 0,
                confirmed2: confirmations[2] || 0,
                confirmed3: confirmations[3] || 0,
                confirmed4plus: confirmations['4+'] || 0,
                photosCount: model.metadata.photoCount || 0
            },
            metadata: model.metadata,
            createdAt: model.metadata.createdAt,
            lastUpdated: this.stats.lastUpdated,
            hasTransform: !!model.transform
        };
    }

    /**
     * Получить общую статистику менеджера
     */
    getStats() {
        return {
            totalModels: this.stats.totalModels,
            totalEnhancements: this.stats.totalEnhancements,
            differentFootprintsDetected: this.stats.differentFootprintsDetected,
            currentModelId: this.currentModelId,
            createdAt: this.stats.createdAt,
            lastUpdated: this.stats.lastUpdated,
            photoToModelSize: this.photoToModel.size,
            relationsCount: this.modelRelations.size
        };
    }

    /**
     * Инкрементировать счётчик улучшений
     */
    incrementEnhancements() {
        this.stats.totalEnhancements++;
        this.stats.lastUpdated = new Date();
    }

    // ==================== ЭКСПОРТ/ИМПОРТ ====================

    /**
     * Экспортировать модель
     */
    exportModel(modelId) {
        const model = this.models.get(modelId);
        if (!model) return null;
       
        return {
            id: model.id,
            metadata: model.metadata,
            graph: {
                nodes: Array.from(model.graph.nodes.entries()),
                edges: Array.from(model.graph.edges),
                avgDegree: model.graph.avgDegree
            },
            knnFingerprints: Array.from(model.knnFingerprints.entries()),
            morphologyMap: Array.from(model.morphologyMap.entries()),
            structures: model.structures || [],
            transform: model.transform,
            history: model.history
        };
    }

    /**
     * Импортировать модель
     */
    importModel(modelData) {
        try {
            const nodes = new Map(modelData.graph.nodes);
            const edges = new Set(modelData.graph.edges);
            const knnFingerprints = new Map(modelData.knnFingerprints || []);
            const morphologyMap = new Map(modelData.morphologyMap || []);
           
            const model = {
                id: modelData.id,
                graph: { nodes, edges, avgDegree: modelData.graph.avgDegree },
                knnGraph: null,
                knnFingerprints,
                morphologyMap,
                originalPoints: [],
                structures: modelData.structures || [],
                transform: modelData.transform || null,
                metadata: modelData.metadata,
                history: modelData.history || []
            };
           
            this.models.set(modelData.id, model);
            this.stats.totalModels++;
           
            if (this.debug) {
                console.log(`📥 Импортирована модель ${modelData.id.substring(0, 12)}...`);
            }
           
            return true;
        } catch (error) {
            console.log(`❌ Ошибка импорта: ${error.message}`);
            return false;
        }
    }

    /**
     * Экспортировать все модели
     */
    exportAllModels() {
        const models = [];
        for (const [modelId, model] of this.models) {
            models.push(this.exportModel(modelId));
        }
       
        return {
            models,
            relations: Array.from(this.modelRelations.entries()),
            photoToModel: Array.from(this.photoToModel.entries()),
            stats: this.stats,
            exportedAt: new Date().toISOString(),
            version: '3.0-model-manager'
        };
    }

    /**
     * Импортировать все модели
     */
    importAllModels(data) {
        if (!data || !data.models || !Array.isArray(data.models)) {
            return { success: false, error: 'Неверный формат данных' };
        }
       
        let importedCount = 0;
       
        for (const modelData of data.models) {
            if (this.importModel(modelData)) {
                importedCount++;
            }
        }
       
        // Восстанавливаем связи
        if (data.relations) {
            for (const [modelId, rel] of data.relations) {
                this.modelRelations.set(modelId, rel);
            }
        }
       
        if (data.photoToModel) {
            for (const [photoId, modelId] of data.photoToModel) {
                this.photoToModel.set(photoId, modelId);
            }
        }
       
        return {
            success: true,
            importedCount,
            totalModels: this.models.size
        };
    }

// ==================== ПОИСК ПО ХЭШУ ====================

    /**
     * Найти модель по хэшу графа
     */
    findModelByHash(graphHash) {
        for (const [id, model] of this.models) {
            if (model.graphHash === graphHash) {
                return model;
            }
        }
        return null;
    }

    /**
     * Найти модель по быстрому хэшу
     */
    findModelByQuickHash(quickHash) {
        for (const [id, model] of this.models) {
            if (model.quickHash === quickHash) {
                return model;
            }
        }
        return null;
    }
  
    // ==================== ОЧИСТКА ====================

    /**
     * Очистить все модели
     */
    clear() {
        this.models.clear();
        this.currentModelId = null;
        this.modelRelations.clear();
        this.photoToModel.clear();
       
        this.stats = {
            totalModels: 0,
            totalEnhancements: 0,
            differentFootprintsDetected: 0,
            createdAt: new Date(),
            lastUpdated: new Date()
        };
       
        console.log('🧹 ModelManager очищен');
    }
}

module.exports = ModelManager;
