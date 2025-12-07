// modules/footprint/footprint-database.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const fs = require('fs');
const path = require('path');

class FootprintDatabase {
    constructor(dataDir = './data/footprints') {
        this.dataDir = dataDir;
        this.footprints = new Map(); // id -> DigitalFootprint
        this.userIndex = new Map(); // userId -> Set<footprintId>
        this.hashIndex = new Map(); // hash -> footprintId
       
        // ПРОСТРАНСТВЕННЫЙ ИНДЕКС
        this.spatialIndex = {
            byWidth: new Map(),   // ширина -> Set<footprintId>
            byHeight: new Map(),  // высота -> Set<footprintId>
            byNodeCount: new Map() // количество узлов -> Set<footprintId>
        };
       
        console.log(`📁 FootprintDatabase: данные в ${dataDir}`); // 🔥 ИСПРАВЛЕНО!
        this.ensureDirectory();
        this.loadAllFootprints();
    }
   
    ensureDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
            console.log(`✅ Создана папка: ${this.dataDir}`);
        }
    }
   
    loadAllFootprints() {
        try {
            if (!fs.existsSync(this.dataDir)) {
                console.log('📭 Папка не существует, моделей нет');
                return;
            }
           
            const files = fs.readdirSync(this.dataDir);
            const jsonFiles = files.filter(f => f.endsWith('.json') && f !== '_index.json');
           
            console.log(`📂 Найдено ${jsonFiles.length} файлов моделей`);
           
            let loaded = 0;
            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(this.dataDir, file);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                   
                    // Восстанавливаем DigitalFootprint
                    const footprint = this.reconstructFootprint(data);
                   
                    this.footprints.set(footprint.id, footprint);
                    this.updateIndexes(footprint);
                   
                    loaded++;
                } catch (error) {
                    console.log(`⚠️ Ошибка загрузки ${file}:`, error.message);
                }
            }
           
            console.log(`✅ Загружено ${loaded} моделей`);
           
        } catch (error) {
            console.log('❌ Ошибка загрузки моделей:', error.message);
        }
    }
   
    reconstructFootprint(data) {
        // Создаем новый DigitalFootprint
        const DigitalFootprint = require('./digital-footprint');
        const footprint = new DigitalFootprint({
            name: data.name,
            userId: data.userId,
            sessionId: data.sessionId
        });
       
        // Восстанавливаем ID
        footprint.id = data.id;
       
        // Восстанавливаем узлы
        if (data.nodes && Array.isArray(data.nodes)) {
            data.nodes.forEach(([key, node]) => {
                footprint.nodes.set(key, node);
            });
        }
       
        // Восстанавливаем статистику
        if (data.stats) {
            footprint.stats = data.stats;
        }
       
        // Восстанавливаем метаданные
        if (data.metadata) {
            footprint.metadata = data.metadata;
        }
       
        // Восстанавливаем ребра
        if (data.edges) {
            footprint.edges = data.edges;
        }
       
        return footprint;
    }
   
    updateIndexes(footprint) {
        // Индекс по пользователю
        if (!this.userIndex.has(footprint.userId)) {
            this.userIndex.set(footprint.userId, new Set());
        }
        this.userIndex.get(footprint.userId).add(footprint.id);
       
        // Пространственные индексы
        const width = footprint.stats?.width || 0;
        const height = footprint.stats?.height || 0;
        const nodeCount = footprint.nodes.size;
       
        // Индекс по ширине
        const widthKey = Math.floor(width / 10) * 10;
        if (!this.spatialIndex.byWidth.has(widthKey)) {
            this.spatialIndex.byWidth.set(widthKey, new Set());
        }
        this.spatialIndex.byWidth.get(widthKey).add(footprint.id);
       
        // Индекс по высоте
        const heightKey = Math.floor(height / 10) * 10;
        if (!this.spatialIndex.byHeight.has(heightKey)) {
            this.spatialIndex.byHeight.set(heightKey, new Set());
        }
        this.spatialIndex.byHeight.get(heightKey).add(footprint.id);
       
        // Индекс по количеству узлов
        const nodeCountKey = Math.floor(nodeCount / 5) * 5;
        if (!this.spatialIndex.byNodeCount.has(nodeCountKey)) {
            this.spatialIndex.byNodeCount.set(nodeCountKey, new Set());
        }
        this.spatialIndex.byNodeCount.get(nodeCountKey).add(footprint.id);
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: СОХРАНЕНИЕ
    saveFootprint(footprint) {
        try {
            console.log(`💾 Сохраняю модель: ${footprint.name || 'без имени'}`);
           
            if (!footprint || !footprint.id) {
                return { success: false, error: 'Невалидный отпечаток' };
            }
           
            // Подготавливаем данные
            const data = {
                id: footprint.id,
                name: footprint.name || 'Unnamed',
                userId: footprint.userId || 'unknown',
                sessionId: footprint.sessionId,
                nodes: Array.from(footprint.nodes.entries()),
                edges: footprint.edges || [],
                stats: footprint.stats || {
                    confidence: 0.5,
                    topologyQuality: 0.5,
                    nodeCount: footprint.nodes.size
                },
                metadata: footprint.metadata || {},
                alignmentHistory: footprint.alignmentHistory || [],
                created: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
           
            // Сохраняем файл
            const filePath = path.join(this.dataDir, `${footprint.id}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
           
            // Обновляем кэш и индексы
            this.footprints.set(footprint.id, footprint);
            this.updateIndexes(footprint);
           
            console.log(`✅ Модель сохранена: ${footprint.name} (${footprint.id})`);
            return {
                success: true,
                id: footprint.id,
                path: filePath,
                nodeCount: footprint.nodes.size
            };
           
        } catch (error) {
            console.log('❌ Ошибка сохранения модели:', error.message);
            return { success: false, error: error.message };
        }
    }
   
    loadFootprint(footprintId) {
        try {
            // Сначала проверяем кэш
            if (this.footprints.has(footprintId)) {
                const footprint = this.footprints.get(footprintId);
                return { success: true, footprint: footprint };
            }
           
            // Если нет в кэше, загружаем из файла
            const filePath = path.join(this.dataDir, `${footprintId}.json`);
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'Модель не найдена' };
            }
           
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const footprint = this.reconstructFootprint(data);
           
            // Сохраняем в кэш
            this.footprints.set(footprintId, footprint);
            this.updateIndexes(footprint);
           
            console.log(`✅ Модель загружена из файла: ${footprint.name}`);
            return { success: true, footprint: footprint };
           
        } catch (error) {
            console.log('❌ Ошибка загрузки модели:', error.message);
            return { success: false, error: error.message };
        }
    }
   
    getUserModels(userId) {
        try {
            const modelIds = this.userIndex.get(userId) || new Set();
            const models = [];
           
            for (const id of modelIds) {
                const result = this.loadFootprint(id);
                if (result.success) {
                    models.push(result.footprint);
                }
            }
           
            return models;
           
        } catch (error) {
            console.log('Ошибка getUserModels:', error.message);
            return [];
        }
    }
   
    getAllModels() {
        return Array.from(this.footprints.values());
    }
   
    searchSimilar(footprint, threshold = 0.5, limit = 10) {
        const results = [];
        const allModels = this.getAllModels();
       
        for (const model of allModels) {
            if (model.id === footprint.id) continue;
           
            // Простая эвристика сравнения
            const nodeCountRatio = Math.min(model.nodes.size, footprint.nodes.size) /
                                  Math.max(model.nodes.size, footprint.nodes.size);
           
            if (nodeCountRatio >= threshold) {
                results.push({
                    footprint: model,
                    score: nodeCountRatio,
                    info: {
                        name: model.name,
                        nodeCount: model.nodes.size,
                        confidence: model.stats?.confidence || 0
                    }
                });
            }
        }
       
        // Сортировка по score
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }
   
    getStats() {
        const stats = {
            total: this.footprints.size,
            byUser: [],
            spatialIndex: {
                byWidth: this.spatialIndex.byWidth.size,
                byHeight: this.spatialIndex.byHeight.size,
                byNodeCount: this.spatialIndex.byNodeCount.size
            }
        };
       
        // Статистика по пользователям
        const userStats = new Map();
        for (const [userId, modelIds] of this.userIndex.entries()) {
            userStats.set(userId, {
                count: modelIds.size,
                models: Array.from(modelIds)
            });
        }
       
        stats.byUser = Array.from(userStats.entries()).map(([userId, data]) => ({
            userId,
            count: data.count
        }));
       
        return stats;
    }
}

// 🔥 ВАЖНО: Правильный экспорт класса
module.exports = FootprintDatabase;
