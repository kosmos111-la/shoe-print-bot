// modules/footprint/footprint-database.js
const fs = require('fs').promises;
const path = require('path');
const DigitalFootprint = require('./digital-footprint');

class FootprintDatabase {
    constructor(dataDir = './data/footprints') {
        this.dataDir = dataDir;
        this.footprints = new Map(); // id -> DigitalFootprint
        this.userIndex = new Map(); // userId -> Set<footprintId>
        this.hashIndex = new Map(); // hash -> footprintId
       
        // ПРОСТРАНСТВЕННЫЙ ИНДЕКС - ИСПРАВЛЕНО!
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
            await fs.mkdir(this.dataDir, { recursive: true });
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
            await this.updateMasterIndex(footprint);
           
            return { success: true, path: filePath };
        } catch (error) {
            console.log('❌ Ошибка сохранения модели:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ДОБАВЛЕНИЕ В ПАМЯТЬ - ИСПРАВЛЕНО!
    addToMemory(footprint) {
        this.footprints.set(footprint.id, footprint);
       
        // Индексируем по пользователю
        if (footprint.userId) {
            if (!this.userIndex.has(footprint.userId)) {
                this.userIndex.set(footprint.userId, new Set());
            }
            this.userIndex.get(footprint.userId).add(footprint.id);
        }
       
        // Индексируем по хешу
        if (footprint.hash) {
            this.hashIndex.set(footprint.hash, footprint.id);
        }
       
        // ПРОСТРАНСТВЕННЫЙ ИНДЕКС - ИСПРАВЛЕНО!
        if (footprint.boundingBox) {
            const { width, height } = footprint.boundingBox;
            const nodeCount = footprint.nodes.size;
           
            // Округляем для группировки
            const widthKey = Math.round(width / 10) * 10;
            const heightKey = Math.round(height / 10) * 10;
            const nodeCountKey = Math.round(nodeCount / 5) * 5;
           
            // Добавляем в ширину
            if (!this.spatialIndex.byWidth.has(widthKey)) {
                this.spatialIndex.byWidth.set(widthKey, new Set());
            }
            this.spatialIndex.byWidth.get(widthKey).add(footprint.id);
           
            // Добавляем в высоту
            if (!this.spatialIndex.byHeight.has(heightKey)) {
                this.spatialIndex.byHeight.set(heightKey, new Set());
            }
            this.spatialIndex.byHeight.get(heightKey).add(footprint.id);
           
            // Добавляем в количество узлов
            if (!this.spatialIndex.byNodeCount.has(nodeCountKey)) {
                this.spatialIndex.byNodeCount.set(nodeCountKey, new Set());
            }
            this.spatialIndex.byNodeCount.get(nodeCountKey).add(footprint.id);
        }
       
        return footprint.id;
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

    // ПОИСК ПОХОЖИХ МОДЕЛЕЙ - УПРОЩЕННЫЙ ВАРИАНТ
    async findSimilar(analysis, options = {}) {
        const {
            userId = null,
            threshold = 0.7,
            limit = 10
        } = options;
       
        console.log(`🔍 Поиск похожих моделей, порог: ${threshold}`);
       
        // 1. Создаем временный footprint из анализа
        const tempFootprint = this.createFootprintFromAnalysis(analysis);
       
        // 2. Получаем ВСЕ модели для пользователя
        let candidates = Array.from(this.footprints.values());
       
        // 3. Фильтруем по пользователю если нужно
        if (userId) {
            candidates = candidates.filter(fp => fp.userId === userId);
        }
       
        // 4. ПОДРОБНОЕ СРАВНЕНИЕ
        const matches = [];

        for (const candidate of candidates) {
            if (matches.length >= limit * 3) break;

            // Пропускаем если это та же модель
            if (candidate.hash === tempFootprint.hash) continue;

            // 🔧 ПРОВЕРЯЕМ, ЕСТЬ ЛИ МЕТОД compare
            if (typeof tempFootprint.compare !== 'function') {
                console.log('❌ У tempFootprint нет метода compare!');
                console.log('   Методы tempFootprint:', Object.keys(tempFootprint).filter(k => typeof tempFootprint[k] === 'function'));
                continue;
            }

            try {
                let comparison;
if (typeof tempFootprint.compareEnhanced === 'function') {
    comparison = tempFootprint.compareEnhanced(candidate);
} else if (typeof tempFootprint.compare === 'function') {
    comparison = tempFootprint.compare(candidate);
} else {
    console.log('❌ У tempFootprint нет методов сравнения!');
    continue;
}

                if (comparison && comparison.score >= threshold) {
                    matches.push({
                        footprint: candidate,
                        score: comparison.score,
                        matched: comparison.matched,
                        total: comparison.total,
                        details: comparison
                    });
                }
            } catch (compareError) {
                console.log(`⚠️ Ошибка сравнения с моделью ${candidate.id}:`, compareError.message);
                // Пропускаем эту модель, продолжаем с другими
            }
        }
       
        // 5. СОРТИРОВКА
        matches.sort((a, b) => b.score - a.score);
       
        console.log(`✅ Найдено ${matches.length} похожих моделей`);
        return matches.slice(0, limit);
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

        // 🔧 ВАЖНО: вызываем normalizeTopology для корректного сравнения
        if (typeof footprint.normalizeTopology === 'function') {
            footprint.normalizeTopology();
        } else {
            console.log('⚠️ У tempFootprint нет метода normalizeTopology');
        }

        return footprint;
    }

    // СОХРАНЕНИЕ МОДЕЛИ - ИСПРАВЛЕНО!
    async save(footprint) {
        try {
            // Проверяем на дубликаты
            const duplicate = this.findExactDuplicate(footprint);
            if (duplicate) {
                console.log(`⚠️ Найден дубликат: ${duplicate.id}`);
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

    // ПОИСК ТОЧНОГО ДУБЛИКАТА
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
