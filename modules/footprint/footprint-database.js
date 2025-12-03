// modules/footprint/footprint-database.js
const fs = require('fs').promises;
const path = require('path');
const DigitalFootprint = require('./digital-footprint');

class FootprintDatabase {
    constructor(dataDir = './data/footprints') {
        this.dataDir = dataDir;
        this.footprints = new Map(); // id -> DigitalFootprint
        this.userIndex = new Map(); // userId -> Set<footprintId>
        this.hashIndex = new Map(); // hash -> footprintId (для быстрого поиска дубликатов)
       
        // Пространственный индекс для быстрого поиска
        this.spatialIndex = {
            byWidth: new Map(),   // ширина -> Set<footprintId>
            byHeight: new Map(),  // высота -> Set<footprintId>
            byNodeCount: new Map() // количество узлов -> Set<footprintId>
        };
       
        console.log(`📁 FootprintDatabase: данные в ${dataDir}`);
    }

    // ИНИЦИАЛИЗАЦИЯ
    async initialize() {
        try {
            // Создаем директорию если нет
            await fs.mkdir(this.dataDir, { recursive: true });
           
            // Загружаем существующие данные
            await this.loadFromDisk();
           
            console.log(`✅ FootprintDatabase готов: ${this.footprints.size} моделей`);
            return true;
        } catch (error) {
            console.log('❌ Ошибка инициализации базы отпечатков:', error.message);
            return false;
        }
    }

    // ЗАГРУЗКА С ДИСКА
    async loadFromDisk() {
        try {
            const files = await fs.readdir(this.dataDir);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
           
            console.log(`📂 Загружаю ${jsonFiles.length} моделей...`);
           
            let loaded = 0;
            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(this.dataDir, file);
                    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
                    const footprint = DigitalFootprint.fromJSON(data);
                   
                    this.addToMemory(footprint);
                    loaded++;
                } catch (error) {
                    console.log(`⚠️ Не удалось загрузить ${file}:`, error.message);
                }
            }
           
            console.log(`✅ Загружено ${loaded} моделей`);
            return loaded;
        } catch (error) {
            console.log('❌ Ошибка загрузки с диска:', error.message);
            return 0;
        }
    }

    // СОХРАНЕНИЕ НА ДИСК
    async saveToDisk(footprint) {
        try {
            const filePath = path.join(this.dataDir, `${footprint.id}.json`);
            const data = JSON.stringify(footprint.toJSON(), null, 2);
           
            await fs.writeFile(filePath, data, 'utf8');
           
            // Также сохраняем в общий индекс
            await this.updateMasterIndex(footprint);
           
            return { success: true, path: filePath };
        } catch (error) {
            console.log('❌ Ошибка сохранения модели:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ДОБАВЛЕНИЕ В ПАМЯТЬ
    addToMemory(footprint) {
        this.footprints.set(footprint.id, footprint);
       
        // Индексируем по пользователю
        if (footprint.userId) {
            if (!this.userIndex.has(footprint.userId)) {
                this.userIndex.set(footprint.userId, new Set());
            }
            this.userIndex.get(footprint.userId).add(footprint.id);
        }
       
        // Индексируем по хешу (для поиска дубликатов)
        if (footprint.hash) {
            this.hashIndex.set(footprint.hash, footprint.id);
        }
       
        // Пространственный индекс
        this.updateSpatialIndex(footprint);
       
        return footprint.id;
    }

    // ОБНОВЛЕНИЕ ПРОСТРАНСТВЕННОГО ИНДЕКСА
    updateSpatialIndex(footprint) {
        if (!footprint.boundingBox) return;
       
        const { width, height } = footprint.boundingBox;
        const nodeCount = footprint.nodes.size;
       
        // Округляем для группировки
        const widthKey = Math.round(width / 10) * 10; // Группируем по 10px
        const heightKey = Math.round(height / 10) * 10;
        const nodeCountKey = Math.round(nodeCount / 5) * 5; // Группируем по 5 узлов
       
        [this.spatialIndex.byWidth, widthKey,
         this.spatialIndex.byHeight, heightKey,
         this.spatialIndex.byNodeCount, nodeCountKey].forEach((index, key, i) => {
            if (!index.has(key)) {
                index.set(key, new Set());
            }
            index.get(key).add(footprint.id);
        });
    }

    // ОБНОВЛЕНИЕ ОБЩЕГО ИНДЕКСА
    async updateMasterIndex(footprint) {
        try {
            const indexPath = path.join(this.dataDir, '_index.json');
            let index = { footprints: [], lastUpdated: new Date().toISOString() };
           
            try {
                const existing = await fs.readFile(indexPath, 'utf8');
                index = JSON.parse(existing);
            } catch (error) {
                // Файла нет, создаем новый
            }
           
            // Добавляем или обновляем запись
            const existingIndex = index.footprints.findIndex(f => f.id === footprint.id);
            const entry = {
                id: footprint.id,
                name: footprint.name,
                userId: footprint.userId,
                nodeCount: footprint.nodes.size,
                confidence: footprint.stats.confidence,
                created: footprint.stats.created,
                lastUpdated: footprint.stats.lastUpdated,
                hash: footprint.hash,
                boundingBox: footprint.boundingBox
            };
           
            if (existingIndex >= 0) {
                index.footprints[existingIndex] = entry;
            } else {
                index.footprints.push(entry);
            }
           
            await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');
           
        } catch (error) {
            console.log('⚠️ Не удалось обновить индекс:', error.message);
        }
    }

    // ПОИСК ПОХОЖИХ МОДЕЛЕЙ
    async findSimilar(analysis, options = {}) {
        const {
            userId = null,
            threshold = 0.6,
            limit = 10,
            quickFirst = true
        } = options;
       
        console.log(`🔍 Поиск похожих моделей, порог: ${threshold}`);
       
        // 1. Создаем временный footprint из анализа
        const tempFootprint = this.createFootprintFromAnalysis(analysis);
       
        // 2. БЫСТРЫЙ ПОИСК через индексы
        const quickCandidates = quickFirst
            ? await this.quickSearch(tempFootprint, userId)
            : Array.from(this.footprints.values());
       
        // 3. ПОДРОБНОЕ СРАВНЕНИЕ
        const matches = [];
       
        for (const candidate of quickCandidates) {
            if (matches.length >= limit * 3) break; // Ограничиваем для производительности
           
            // Пропускаем если это та же модель (по хешу)
            if (candidate.hash === tempFootprint.hash) continue;
           
            const comparison = tempFootprint.compare(candidate);
           
            if (comparison.score >= threshold) {
                matches.push({
                    footprint: candidate,
                    score: comparison.score,
                    matched: comparison.matched,
                    total: comparison.total,
                    details: comparison
                });
            }
        }
       
        // 4. СОРТИРОВКА и обрезка
        matches.sort((a, b) => b.score - a.score);
       
        console.log(`✅ Найдено ${matches.length} похожих моделей`);
       
        return matches.slice(0, limit);
    }

    // БЫСТРЫЙ ПОИСК через индексы
    quickSearch(footprint, userId = null) {
        const candidates = new Set();
       
        if (!footprint.boundingBox) {
            return Array.from(this.footprints.values());
        }
       
        const { width, height } = footprint.boundingBox;
        const nodeCount = footprint.nodes.size;
       
        // Поиск по похожим размерам
        const widthKey = Math.round(width / 10) * 10;
        const heightKey = Math.round(height / 10) * 10;
        const nodeCountKey = Math.round(nodeCount / 5) * 5;
       
        // Добавляем кандидатов из соседних групп (±1 группа)
        for (let w = widthKey - 10; w <= widthKey + 10; w += 10) {
            const ids = this.spatialIndex.byWidth.get(w);
            if (ids) ids.forEach(id => candidates.add(id));
        }
       
        for (let h = heightKey - 10; h <= heightKey + 10; h += 10) {
            const ids = this.spatialIndex.byHeight.get(h);
            if (ids) ids.forEach(id => candidates.add(id));
        }
       
        for (let n = nodeCountKey - 5; n <= nodeCountKey + 5; n += 5) {
            const ids = this.spatialIndex.byNodeCount.get(n);
            if (ids) ids.forEach(id => candidates.add(id));
        }
       
        // Фильтр по пользователю если нужно
        const result = Array.from(candidates)
            .map(id => this.footprints.get(id))
            .filter(fp => fp && (!userId || fp.userId === userId));
       
        return result;
    }

    // СОЗДАНИЕ ВРЕМЕННОГО FOOTPRINT ДЛЯ ПОИСКА
    createFootprintFromAnalysis(analysis) {
        const footprint = new DigitalFootprint({
            id: `temp_${Date.now()}`,
            name: 'Временная модель для поиска'
        });
       
        if (analysis.predictions) {
            footprint.addAnalysis(analysis, {
                type: 'search',
                timestamp: new Date()
            });
        }
       
        return footprint;
    }

    // СОХРАНЕНИЕ МОДЕЛИ
    async save(footprint) {
        try {
            // Проверяем на дубликаты
            const duplicate = await this.findExactDuplicate(footprint);
            if (duplicate) {
                console.log(`⚠️ Найден дубликат: ${duplicate.id}`);
                // Можно предложить объединение
                return duplicate;
            }
           
            // Добавляем в память
            this.addToMemory(footprint);
           
            // Сохраняем на диск
            const saveResult = await this.saveToDisk(footprint);
           
            if (!saveResult.success) {
                throw new Error(saveResult.error);
            }
           
            console.log(`✅ Модель сохранена: ${footprint.id} (${footprint.nodes.size} узлов)`);
           
            return footprint;
        } catch (error) {
            console.log('❌ Ошибка сохранения модели:', error.message);
            throw error;
        }
    }

    // ПОИСК ТОЧНОГО ДУБЛИКАТА (по хешу)
    findExactDuplicate(footprint) {
        if (!footprint.hash) return null;
        const duplicateId = this.hashIndex.get(footprint.hash);
        return duplicateId ? this.footprints.get(duplicateId) : null;
    }

    // ПОЛУЧЕНИЕ МОДЕЛИ ПО ID
    get(id) {
        return this.footprints.get(id) || null;
    }

    // ПОЛУЧЕНИЕ МОДЕЛЕЙ ПОЛЬЗОВАТЕЛЯ
    getByUser(userId) {
        const userModels = this.userIndex.get(userId);
        if (!userModels) return [];
       
        return Array.from(userModels)
            .map(id => this.footprints.get(id))
            .filter(Boolean)
            .sort((a, b) => new Date(b.stats.lastUpdated) - new Date(a.stats.lastUpdated));
    }

    // УДАЛЕНИЕ МОДЕЛИ
    async delete(id, userId = null) {
        try {
            const footprint = this.footprints.get(id);
            if (!footprint) return false;
           
            // Проверяем права
            if (userId && footprint.userId !== userId) {
                console.log(`❌ Пользователь ${userId} не может удалить модель ${id}`);
                return false;
            }
           
            // Удаляем из памяти
            this.footprints.delete(id);
           
            if (footprint.userId) {
                const userSet = this.userIndex.get(footprint.userId);
                if (userSet) userSet.delete(id);
            }
           
            if (footprint.hash) {
                this.hashIndex.delete(footprint.hash);
            }
           
            // Удаляем с диска
            const filePath = path.join(this.dataDir, `${id}.json`);
            await fs.unlink(filePath).catch(() => {});
           
            console.log(`🗑️ Модель удалена: ${id}`);
            return true;
        } catch (error) {
            console.log('❌ Ошибка удаления модели:', error.message);
            return false;
        }
    }

    // СТАТИСТИКА
    getStats() {
        return {
            total: this.footprints.size,
            byUser: Array.from(this.userIndex.entries()).map(([userId, ids]) => ({
                userId,
                count: ids.size
            })),
            spatialIndex: {
                byWidth: this.spatialIndex.byWidth.size,
                byHeight: this.spatialIndex.byHeight.size,
                byNodeCount: this.spatialIndex.byNodeCount.size
            }
        };
    }
}

module.exports = FootprintDatabase;
