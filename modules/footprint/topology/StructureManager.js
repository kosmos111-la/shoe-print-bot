// modules/footprint/topology/StructureManager.js
// 🗂️ МЕНЕДЖЕР СТРУКТУР - управляет множеством топологических структур
// 🔥 ИСПРАВЛЕННАЯ ВЕРСИЯ: объединение по сходству трансформации, фильтрация маленьких структур

const TopologicalStructure = require('./Structure');
const StructureBuilder = require('./StructureBuilder');

class StructureManager {
    constructor(validator, options = {}) {
        this.validator = validator;
        this.debug = options.debug || false;
       
        this.builder = new StructureBuilder(validator, {
            debug: this.debug,
            minConfidence: options.minConfidence || 0.7,
            maxScaleDeviation: options.maxScaleDeviation || 0.1,
            maxRotationDeviation: options.maxRotationDeviation || 5
        });
       
        this.structures = new Map();
        this.structureCounter = 0;
       
        this.stats = {
            totalStructures: 0,
            mergedStructures: 0,
            rejectedTriangles: 0
        };
       
        if (this.debug) {
            console.log('🗂️ StructureManager (исправленная версия) создан');
            console.log(`   • Мин. уверенность: ${options.minConfidence || 0.7 * 100}%`);
            console.log(`   • Порог объединения: масштаб 10%, поворот 15°`);
        }
    }
   
    /**
     * Строит все возможные структуры из набора треугольников-якорей
     */
    buildStructures(anchorTriangles, allTriangles, graphA, graphB, morphologyMap, modelMorphology) {
        if (this.debug) {
            console.log(`\n🗂 Начинаю сборку структур из ${anchorTriangles?.length || 0} якорей...`);
        }

        this.structures.clear();
        this.structureCounter = 0;

        if (!anchorTriangles || anchorTriangles.length === 0) {
            if (this.debug) console.log(`⚠️ Нет якорей для сборки структур`);
            return [];
        }

        // Создаём карту треугольников по точкам
        const triangleByPoint = new Map();
        for (const tri of allTriangles) {
            if (tri && tri.p1 && tri.p2 && tri.p3) {
                triangleByPoint.set(tri.p1.id, tri);
                triangleByPoint.set(tri.p2.id, tri);
                triangleByPoint.set(tri.p3.id, tri);
            }
        }

        const usedTriangles = new Set();
        const structuresList = [];

        // 🔥 СОРТИРУЕМ ЯКОРЯ ПО УВЕРЕННОСТИ (самые уверенные сначала)
        const sortedAnchors = [...anchorTriangles].sort((a, b) => (b.geometryScore || 0) - (a.geometryScore || 0));

        for (const anchor of sortedAnchors) {
            // Находим полный треугольник по любой точке якоря
            const triangle = triangleByPoint.get(anchor.pointA);
           
            if (!triangle) continue;
           
            const triangleId = triangle.id;
           
            // 🔥 ПРОВЕРКА: не входит ли треугольник уже в какую-то структуру
            let alreadyInStructure = false;
            for (const structure of structuresList) {
                if (structure.triangleIds.has(triangleId)) {
                    alreadyInStructure = true;
                    break;
                }
            }
           
            if (alreadyInStructure) {
                if (this.debug && triangleId) console.log(`   ⏭️ Треугольник ${triangleId.substring(0,12)} уже в структуре, пропускаем`);
                continue;
            }
           
            // Проверяем, что треугольник валидный (все точки разные)
            if (triangle.p1.id === triangle.p2.id ||
                triangle.p1.id === triangle.p3.id ||
                triangle.p2.id === triangle.p3.id) {
                if (this.debug) console.log(`   ⚠️ Треугольник ${triangleId.substring(0,12)} имеет дублирующиеся точки, пропускаем`);
                continue;
            }
           
            // Строим структуру
            const structure = this.builder.buildFromSeed(
                triangle,
                allTriangles,
                graphA,
                graphB,
                morphologyMap,
                modelMorphology
            );
           
            if (structure && structure.triangleIds.size > 0) {
                // Помечаем все треугольники структуры как использованные
                for (const tid of structure.triangleIds) {
                    usedTriangles.add(tid);
                }
                this.addStructure(structure);
                structuresList.push(structure);
               
                if (this.debug) {
                    console.log(`   ✅ Структура ${structure.id.substring(0,12)} добавлена (${structure.triangleIds.size} треугольников)`);
                }
            }
        }

        // 🔥 ОБЪЕДИНЯЕМ ПОХОЖИЕ СТРУКТУРЫ (по сходству трансформации)
        this.mergeBySimilarity(structuresList, graphA, graphB);
       
        // 🔥 ВОЗВРАЩАЕМ ТОЛЬКО КРУПНЫЕ СТРУКТУРЫ (>=3 треугольников)
        const largeStructures = Array.from(this.structures.values())
            .filter(s => s.triangleIds.size >= 3);
       
        if (this.debug) {
    console.log(`\n📊 ИТОГ СБОРКИ:`);
    console.log(`   • Всего структур: ${this.structures.size}`);
    console.log(`   • Крупных структур (>=3 тр): ${largeStructures.length}`);
   
    // 🔥 ВЫЗЫВАЕМ АНАЛИТИКУ ОТКАЗОВ
    if (this.builder && this.builder.printRejectionAnalysis) {
        this.builder.printRejectionAnalysis();
    }
   
    largeStructures.forEach((s, i) => {
        const stats = s.getStats();
        console.log(`   • Структура ${i+1}: ${stats.triangleCount} тр., ${stats.pointCount} точек, уверенность ${(stats.confidence*100).toFixed(1)}%`);
        if (s.transform) {
            console.log(`        масштаб ${s.transform.scale.toFixed(3)}, поворот ${(s.transform.rotation * 180 / Math.PI).toFixed(1)}°`);
        }
    });
}
return largeStructures;
    }
   
    /**
     * 🔥 НОВЫЙ МЕТОД: объединение структур по сходству трансформации
     */
    mergeBySimilarity(structures, graphA, graphB) {
        if (this.structures.size < 2) return;
       
        if (this.debug) console.log(`\n🔄 Объединяю структуры по сходству трансформации...`);
       
        let merged = true;
        let iterations = 0;
        const maxIterations = 5;
       
        while (merged && iterations < maxIterations) {
            merged = false;
            iterations++;
           
            const structuresList = Array.from(this.structures.values());
           
            for (let i = 0; i < structuresList.length; i++) {
                for (let j = i + 1; j < structuresList.length; j++) {
                    const s1 = structuresList[i];
                    const s2 = structuresList[j];
                   
                    // Пропускаем, если у одной нет transform
                    if (!s1.transform || !s2.transform) continue;
                   
                    // Проверяем сходство трансформации
                    const scaleDiff = Math.abs(s1.transform.scale - s2.transform.scale) / Math.max(s1.transform.scale, 0.001);
                    const rotDiff = Math.abs(s1.transform.rotation - s2.transform.rotation) * 180 / Math.PI;
                   
                    // Пороги: 10% по масштабу, 15° по повороту
                    if (scaleDiff < 0.1 && rotDiff < 15) {
                        if (this.debug) {
                            console.log(`   🔗 Объединяю структуры:`);
                            console.log(`      ${s1.id.substring(0,12)} (${s1.triangleIds.size} тр, масштаб ${s1.transform.scale.toFixed(3)}, поворот ${(s1.transform.rotation * 180 / Math.PI).toFixed(1)}°)`);
                            console.log(`      ${s2.id.substring(0,12)} (${s2.triangleIds.size} тр, масштаб ${s2.transform.scale.toFixed(3)}, поворот ${(s2.transform.rotation * 180 / Math.PI).toFixed(1)}°)`);
                            console.log(`      → разница: масштаб ${(scaleDiff*100).toFixed(1)}%, поворот ${rotDiff.toFixed(1)}°`);
                        }
                       
                        // Объединяем (s1 поглощает s2)
                        this.mergeStructures(s1, s2, graphA, graphB);
                        merged = true;
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
     * Добавляет структуру в менеджер
     */
    addStructure(structure) {
        this.structures.set(structure.id, structure);
        this.structureCounter++;
        this.stats.totalStructures++;
    }
   
    /**
     * Проверяет, можно ли объединить две структуры
     */
    canMerge(s1, s2, graphA, graphB) {
        // Проверка 1: есть ли общие граничные рёбра?
        if (s1.canMergeWith(s2)) return true;
       
        // 🔥 ДОБАВЛЯЕМ ПРОВЕРКУ ПО СХОДСТВУ ТРАНСФОРМАЦИИ
        if (s1.transform && s2.transform) {
            const scaleDiff = Math.abs(s1.transform.scale - s2.transform.scale) / s1.transform.scale;
            const rotDiff = Math.abs(s1.transform.rotation - s2.transform.rotation) * 180 / Math.PI;
           
            if (scaleDiff < 0.1 && rotDiff < 15) {
                return true;
            }
        }
       
        return false;
    }
   
    /**
     * Объединяет две структуры
     */
    mergeStructures(target, source, graphA, graphB) {
        target.mergeWith(source);
       
        if (target.triangleIds.size >= 2) {
            target.calculateTransform(
                (anchors) => this.validator.calculateTransform(anchors, graphA, graphB),
                graphA,
                graphB
            );
        }
       
        this.structures.delete(source.id);
        this.stats.mergedStructures++;
    }
   
    /**
     * Находит структуру, содержащую заданную точку
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
     */
    getStructuresSorted() {
        return Array.from(this.structures.values())
            .sort((a, b) => b.calculateConfidence() - a.calculateConfidence());
    }
   
    /**
     * Анализирует связи между структурами
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
