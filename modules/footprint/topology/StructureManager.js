// modules/footprint/topology/StructureManager.js
// 🗂️ МЕНЕДЖЕР СТРУКТУР - управляет множеством топологических структур

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
            console.log('🗂️ StructureManager создан');
        }
    }
   
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

        const sortedAnchors = [...anchorTriangles].sort((a, b) => (b.geometryScore || 0) - (a.geometryScore || 0));

        for (const anchor of sortedAnchors) {
            const triangle = triangleByPoint.get(anchor.pointA);
           
            if (!triangle) continue;
           
            const triangleId = triangle.id;
           
            let alreadyInStructure = false;
            for (const structure of structuresList) {
                if (structure.triangleIds.has(triangleId)) {
                    alreadyInStructure = true;
                    break;
                }
            }
           
            if (alreadyInStructure) {
                // 🔥 ИСПРАВЛЕНО: проверка на существование triangleId
                if (this.debug && triangleId) {
                    console.log(`   ⏭️ Треугольник ${triangleId.substring(0,12)} уже в структуре, пропускаем`);
                }
                continue;
            }
           
            if (triangle.p1.id === triangle.p2.id ||
                triangle.p1.id === triangle.p3.id ||
                triangle.p2.id === triangle.p3.id) {
                continue;
            }
           
            const structure = this.builder.buildFromSeed(
                triangle,
                allTriangles,
                graphA,
                graphB,
                morphologyMap,
                modelMorphology
            );
           
            if (structure && structure.triangleIds.size > 0) {
                for (const tid of structure.triangleIds) {
                    usedTriangles.add(tid);
                }
                this.addStructure(structure);
                structuresList.push(structure);
               
                if (this.debug) {
                    // 🔥 ИСПРАВЛЕНО: проверка на существование id
                    const structId = structure.id || 'unknown';
                    console.log(`   ✅ Структура ${structId.substring(0,12)} добавлена (${structure.triangleIds.size} треугольников)`);
                }
            }
        }
       
        this.mergeBySimilarity(structuresList, graphA, graphB);
       
        const largeStructures = Array.from(this.structures.values())
            .filter(s => s.triangleIds.size >= 3);
       
        if (this.debug) {
            console.log(`\n📊 ИТОГ СБОРКИ:`);
            console.log(`   • Всего структур: ${this.structures.size}`);
            console.log(`   • Крупных структур (>=3 тр): ${largeStructures.length}`);
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
                   
                    if (!s1.transform || !s2.transform) continue;
                   
                    const scaleDiff = Math.abs(s1.transform.scale - s2.transform.scale) / Math.max(s1.transform.scale, 0.001);
                    const rotDiff = Math.abs(s1.transform.rotation - s2.transform.rotation) * 180 / Math.PI;
                   
                    if (scaleDiff < 0.1 && rotDiff < 15) {
                        if (this.debug) {
                            // 🔥 ИСПРАВЛЕНО: проверка на существование id
                            const s1Id = s1.id || 'unknown';
                            const s2Id = s2.id || 'unknown';
                            console.log(`   🔗 Объединяю структуры:`);
                            console.log(`      ${s1Id.substring(0,12)} (${s1.triangleIds.size} тр, масштаб ${s1.transform.scale.toFixed(3)}, поворот ${(s1.transform.rotation * 180 / Math.PI).toFixed(1)}°)`);
                            console.log(`      ${s2Id.substring(0,12)} (${s2.triangleIds.size} тр, масштаб ${s2.transform.scale.toFixed(3)}, поворот ${(s2.transform.rotation * 180 / Math.PI).toFixed(1)}°)`);
                            console.log(`      → разница: масштаб ${(scaleDiff*100).toFixed(1)}%, поворот ${rotDiff.toFixed(1)}°`);
                        }
                       
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
   
    addStructure(structure) {
        this.structures.set(structure.id, structure);
        this.structureCounter++;
        this.stats.totalStructures++;
    }
   
    canMerge(s1, s2, graphA, graphB) {
        if (s1.canMergeWith(s2)) return true;
       
        if (s1.transform && s2.transform) {
            const scaleDiff = Math.abs(s1.transform.scale - s2.transform.scale) / s1.transform.scale;
            const rotDiff = Math.abs(s1.transform.rotation - s2.transform.rotation) * 180 / Math.PI;
           
            if (scaleDiff < 0.1 && rotDiff < 15) {
                return true;
            }
        }
       
        return false;
    }
   
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
   
    findStructureByPoint(pointId) {
        for (const structure of this.structures.values()) {
            if (structure.pointIds.has(pointId)) {
                return structure;
            }
        }
        return null;
    }
   
    findStructureByTriangle(triangleId) {
        for (const structure of this.structures.values()) {
            if (structure.triangleIds.has(triangleId)) {
                return structure;
            }
        }
        return null;
    }
   
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
   
    getStructuresSorted() {
        return Array.from(this.structures.values())
            .sort((a, b) => b.calculateConfidence() - a.calculateConfidence());
    }
   
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
   
    getStats() {
        return {
            manager: { ...this.stats },
            builder: this.builder.getStats(),
            structures: Array.from(this.structures.values()).map(s => s.getStats())
        };
    }
   
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
