// modules/footprint/topology/StructureManager.js
// 🗂️ МЕНЕДЖЕР СТРУКТУР - управляет множеством топологических структур

const TopologicalStructure = require('./Structure');
const StructureBuilder = require('./StructureBuilder');

class StructureManager {
    /**
     * @param {Object} validator - экземпляр ValidationModule
     * @param {Object} options - настройки
     */
    constructor(validator, options = {}) {
        this.validator = validator;
        this.debug = options.debug || false;
       
        // Создаём строителя структур
        this.builder = new StructureBuilder(validator, {
            debug: this.debug,
            minConfidence: options.minConfidence || 0.7,
            maxScaleDeviation: options.maxScaleDeviation || 0.1,
            maxRotationDeviation: options.maxRotationDeviation || 5
        });
       
        // Хранилище структур
        this.structures = new Map(); // id -> TopologicalStructure
        this.structureCounter = 0;
       
        // Статистика
        this.stats = {
            totalStructures: 0,
            mergedStructures: 0,
            rejectedTriangles: 0
        };
       
        if (this.debug) {
            console.log('🗂️ StructureManager создан');
        }
    }
   
    /**
     * Строит все возможные структуры из набора треугольников-якорей
     * @param {Array} anchorTriangles - массив треугольников-якорей
     * @param {Array} allTriangles - все доступные треугольники (кандидаты)
     * @param {Object} graphA - граф первого следа
     * @param {Object} graphB - граф второго следа
     * @param {Map} morphologyMap - морфология первого следа
     * @param {Map} modelMorphology - морфология второго следа
     * @returns {Array} - массив построенных структур
     */
buildStructures(anchorTriangles, allTriangles, graphA, graphB, morphologyMap, modelMorphology) {
        if (this.debug) {
            console.log(`\n🗂️ Начинаю сборку структур из ${anchorTriangles?.length || 0} якорей...`);
        }
       
        // Очищаем предыдущие структуры
        this.structures.clear();
        this.structureCounter = 0;
       
        // Проверяем, что якоря есть
        if (!anchorTriangles || anchorTriangles.length === 0) {
            if (this.debug) console.log(`⚠️ Нет якорей для сборки структур`);
            return [];
        }
       
        // 🔥 ЗАЩИТА: проверяем каждый якорь
        const validAnchors = [];
        for (const anchor of anchorTriangles) {
            if (!anchor || !anchor.pointA || !anchor.pointB) {
                if (this.debug) console.log(`   ⚠️ Пропущен некорректный якорь: ${JSON.stringify(anchor)}`);
                continue;
            }
            validAnchors.push(anchor);
        }
       
        // Сортируем якоря по уверенности (самые надёжные первые)
        const sortedAnchors = [...validAnchors].sort((a, b) =>
            (b.confidence || 0) - (a.confidence || 0)
        );
       
        if (this.debug && sortedAnchors.length !== anchorTriangles.length) {
            console.log(`   • Отфильтровано ${anchorTriangles.length - sortedAnchors.length} некорректных якорей`);
        }
       
        // Множество уже использованных треугольников
        const usedTriangles = new Set();
       
        // Для каждого якоря пробуем построить структуру
        for (const anchor of sortedAnchors) {
            // 🔥 ЗАЩИТА: убеждаемся, что у якоря есть ID
            const anchorId = anchor.id || `anchor_${anchor.pointA}_${anchor.pointB}`;
           
            if (usedTriangles.has(anchorId)) continue;
           
            if (this.debug) {
                console.log(`\n🔨 Пробую построить структуру от якоря ${anchorId.substring(0,12)}...`);
            }
           
            // 🔥 СОЗДАЁМ ТРЕУГОЛЬНИК ДЛЯ СТРОИТЕЛЯ
            // Если у якоря нет всех трёх точек, используем один якорь как "треугольник" из одной точки
            const seedTriangle = {
                id: anchorId,
                confidence: anchor.confidence || 0.7,
                // Для совместимости с ожиданиями StructureBuilder
                p1: { id: anchor.pointA },
                p2: { id: anchor.pointA },
                p3: { id: anchor.pointA },
                pB1: { id: anchor.pointB },
                pB2: { id: anchor.pointB },
                pB3: { id: anchor.pointB },
                edges: []  // пустые рёбра для начала
            };
           
            // Строим структуру
            const structure = this.builder.buildFromSeed(
                seedTriangle,
                allTriangles || [],
                graphA,
                graphB,
                morphologyMap,
                modelMorphology
            );
           
            // Если структура получилась (хотя бы 1 треугольник)
            if (structure && structure.triangleIds.size > 0) {
                // Добавляем в хранилище
                this.addStructure(structure);
               
                // Помечаем все треугольники структуры как использованные
                for (const triId of structure.triangleIds) {
                    usedTriangles.add(triId);
                }
               
                if (this.debug) {
                    console.log(`   ✅ Структура ${structure.id} добавлена (${structure.triangleIds.size} треугольников)`);
                }
            }
        }
       
        // Пытаемся объединить совместимые структуры
        this.mergeCompatibleStructures(graphA, graphB);
       
        // Итоговая статистика
        const result = Array.from(this.structures.values());
       
        if (this.debug) {
            console.log(`\n📊 ИТОГ СБОРКИ:`);
            console.log(`   • Всего структур: ${result.length}`);
            result.forEach((s, i) => {
                const stats = s.getStats();
                console.log(`   • Структура ${i+1}: ${stats.triangleCount} тр., ${stats.pointCount} точек, уверенность ${(stats.confidence*100).toFixed(1)}%`);
            });
        }
       
        return result;
    }
   
    /**
     * Добавляет структуру в менеджер
     * @param {TopologicalStructure} structure - структура для добавления
     */
    addStructure(structure) {
        this.structures.set(structure.id, structure);
        this.structureCounter++;
        this.stats.totalStructures++;
    }
   
    /**
     * Пытается объединить совместимые структуры
     * @param {Object} graphA - граф первого следа
     * @param {Object} graphB - граф второго следа
     */
    mergeCompatibleStructures(graphA, graphB) {
        if (this.structures.size < 2) return;
       
        if (this.debug) {
            console.log(`\n🔄 Пробую объединить ${this.structures.size} структур...`);
        }
       
        let merged = true;
        let iterations = 0;
        const maxIterations = 10;
       
        while (merged && iterations < maxIterations) {
            merged = false;
            iterations++;
           
            const structuresList = Array.from(this.structures.values());
           
            for (let i = 0; i < structuresList.length; i++) {
                for (let j = i + 1; j < structuresList.length; j++) {
                    const s1 = structuresList[i];
                    const s2 = structuresList[j];
                   
                    // Проверяем, можно ли объединить
                    if (this.canMerge(s1, s2, graphA, graphB)) {
                        if (this.debug) {
                            console.log(`   🔗 Объединяю ${s1.id} и ${s2.id}`);
                        }
                       
                        // Объединяем
                        this.mergeStructures(s1, s2, graphA, graphB);
                        merged = true;
                        this.stats.mergedStructures++;
                       
                        // Выходим из циклов, чтобы начать заново
                        break;
                    }
                }
                if (merged) break;
            }
        }
       
        if (this.debug && iterations > 1) {
            console.log(`   ✅ После ${iterations} итераций осталось ${this.structures.size} структур`);
        }
    }
   
    /**
     * Проверяет, можно ли объединить две структуры
     * @param {TopologicalStructure} s1 - первая структура
     * @param {TopologicalStructure} s2 - вторая структура
     * @param {Object} graphA - граф первого следа
     * @param {Object} graphB - граф второго следа
     * @returns {boolean} - можно ли объединить
     */
    canMerge(s1, s2, graphA, graphB) {
        // Проверка 1: есть ли общие граничные рёбра?
        if (!s1.canMergeWith(s2)) return false;
       
        // Проверка 2: совместимы ли transform'ы?
        if (s1.transform && s2.transform) {
            // Отклонение масштаба
            const scaleDiff = Math.abs(s1.transform.scale - s2.transform.scale) / s1.transform.scale;
            if (scaleDiff > 0.15) { // 15% - жёсткий порог для объединения
                if (this.debug) {
                    console.log(`      ❌ Масштаб: ${s1.transform.scale.toFixed(3)} vs ${s2.transform.scale.toFixed(3)}`);
                }
                return false;
            }
           
            // Отклонение поворота
            const rotDiff = Math.abs(s1.transform.rotation - s2.transform.rotation) * 180 / Math.PI;
            if (rotDiff > 10) { // 10 градусов
                if (this.debug) {
                    console.log(`      ❌ Поворот: ${(s1.transform.rotation * 180 / Math.PI).toFixed(1)}° vs ${(s2.transform.rotation * 180 / Math.PI).toFixed(1)}°`);
                }
                return false;
            }
        }
       
        return true;
    }
   
    /**
     * Объединяет две структуры
     * @param {TopologicalStructure} target - целевая структура (в неё объединяем)
     * @param {TopologicalStructure} source - источник (будет удалена)
     * @param {Object} graphA - граф первого следа
     * @param {Object} graphB - граф второго следа
     */
    mergeStructures(target, source, graphA, graphB) {
        // Объединяем треугольники
        target.mergeWith(source);
       
        // Пересчитываем transform объединённой структуры
        if (target.triangleIds.size >= 2) {
            target.calculateTransform(
                (anchors) => this.validator.calculateTransform(anchors, graphA, graphB),
                graphA,
                graphB
            );
        }
       
        // Удаляем исходную структуру
        this.structures.delete(source.id);
    }
   
    /**
     * Находит структуру, содержащую заданную точку
     * @param {string} pointId - ID точки
     * @returns {TopologicalStructure|null} - структура или null
     */
    findStructureByPoint(pointId) {
        for (const structure of this.structures.values()) {
            if (structure.pointIds.has(pointId)) {
                return structure;
            }
        }
        return null;
    }
   
    /**
     * Находит структуру, содержащую заданный треугольник
     * @param {string} triangleId - ID треугольника
     * @returns {TopologicalStructure|null} - структура или null
     */
    findStructureByTriangle(triangleId) {
        for (const structure of this.structures.values()) {
            if (structure.triangleIds.has(triangleId)) {
                return structure;
            }
        }
        return null;
    }
   
    /**
     * Возвращает самую уверенную структуру
     * @returns {TopologicalStructure|null} - структура с максимальной уверенностью
     */
    getBestStructure() {
        let best = null;
        let bestConfidence = 0;
       
        for (const structure of this.structures.values()) {
            const conf = structure.calculateConfidence();
            if (conf > bestConfidence) {
                bestConfidence = conf;
                best = structure;
            }
        }
       
        return best;
    }
   
    /**
     * Возвращает все структуры, отсортированные по уверенности
     * @returns {Array} - массив структур
     */
    getStructuresSorted() {
        return Array.from(this.structures.values())
            .sort((a, b) => b.calculateConfidence() - a.calculateConfidence());
    }
   
    /**
     * Анализирует связи между структурами
     * @returns {Object} - результаты анализа
     */
    analyzeRelations() {
        const structures = Array.from(this.structures.values());
       
        if (structures.length < 2) {
            return {
                count: structures.length,
                relations: []
            };
        }
       
        const relations = [];
       
        for (let i = 0; i < structures.length; i++) {
            for (let j = i + 1; j < structures.length; j++) {
                const s1 = structures[i];
                const s2 = structures[j];
               
                if (s1.transform && s2.transform) {
                    const scaleDiff = Math.abs(s1.transform.scale - s2.transform.scale) / s1.transform.scale;
                    const rotDiff = Math.abs(s1.transform.rotation - s2.transform.rotation) * 180 / Math.PI;
                   
                    relations.push({
                        struct1: s1.id,
                        struct2: s2.id,
                        scaleDiff: scaleDiff,
                        rotationDiff: rotDiff,
                        compatible: scaleDiff < 0.15 && rotDiff < 10
                    });
                }
            }
        }
       
        return {
            count: structures.length,
            relations
        };
    }
   
    /**
     * Возвращает полную статистику
     * @returns {Object} - статистика
     */
    getStats() {
        return {
            manager: { ...this.stats },
            builder: this.builder.getStats(),
            structures: Array.from(this.structures.values()).map(s => s.getStats())
        };
    }
   
    /**
     * Очищает все структуры
     */
    clear() {
        this.structures.clear();
        this.structureCounter = 0;
        this.builder.resetStats();
        this.stats = {
            totalStructures: 0,
            mergedStructures: 0,
            rejectedTriangles: 0
        };
       
        if (this.debug) {
            console.log('🗂️ StructureManager очищен');
        }
    }
}

module.exports = StructureManager;
