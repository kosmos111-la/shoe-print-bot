// modules/footprint/topology/StructureBuilder.js
// 🔨 СТРОИТЕЛЬ ТОПОЛОГИЧЕСКИХ СТРУКТУР - собирает связные компоненты от затравки

const TopologicalStructure = require('./Structure');

class StructureBuilder {
    /**
     * @param {Object} validator - экземпляр ValidationModule для вычисления transform
     * @param {Object} options - настройки
     */
    constructor(validator, options = {}) {
        this.validator = validator;
        this.debug = options.debug || false;
       
        // Пороги для принятия треугольника в структуру
        this.minConfidence = options.minConfidence || 0.7;
        this.maxScaleDeviation = options.maxScaleDeviation || 0.1; // 10% отклонение масштаба
        this.maxRotationDeviation = options.maxRotationDeviation || 5; // 5 градусов
       
        this.stats = {
            structuresBuilt: 0,
            trianglesProcessed: 0,
            rejections: {
                lowConfidence: 0,
                scaleMismatch: 0,
                rotationMismatch: 0,
                transformFailed: 0
            }
        };
       
        if (this.debug) {
            console.log('🔨 StructureBuilder создан');
            console.log(`   • Мин. уверенность: ${this.minConfidence * 100}%`);
            console.log(`   • Макс. отклонение масштаба: ${this.maxScaleDeviation * 100}%`);
            console.log(`   • Макс. отклонение поворота: ${this.maxRotationDeviation}°`);
        }
    }
   
    /**
     * Возвращает начальные граничные рёбра для затравки
     * @param {Object} triangle - треугольник-затравка
     * @returns {Array} - очередь рёбер для роста
     */
    getInitialGrowthEdges(triangle) {
        const queue = [];
       
        if (!triangle || !triangle.edges) return queue;
       
        for (let i = 0; i < triangle.edges.length; i++) {
            const edge = triangle.edges[i];
            if (edge && edge.v1 && edge.v2) {
                const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');
               
                queue.push({
                    edgeKey,
                    edge,
                    sourceTriangle: triangle
                });
            }
        }
       
        return queue;
    }
   
    /**
     * Возвращает новые граничные рёбра после добавления треугольника
     * @param {Object} triangle - добавленный треугольник
     * @param {TopologicalStructure} structure - текущая структура
     * @param {string} incomingEdgeKey - ребро, через которое пришли
     * @returns {Array} - новые рёбра для роста
     */
    getNewBoundaryEdges(triangle, structure, incomingEdgeKey) {
        const newEdges = [];
       
        if (!triangle || !triangle.edges) return newEdges;
       
        for (let i = 0; i < triangle.edges.length; i++) {
            const edge = triangle.edges[i];
            if (!edge || !edge.v1 || !edge.v2) continue;
           
            const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');
           
            // Пропускаем ребро, через которое пришли
            if (edgeKey === incomingEdgeKey) continue;
           
            // Проверяем, не стало ли это ребро внутренним
            if (structure && !structure.boundaryEdges.has(edgeKey)) {
                newEdges.push({
                    edgeKey,
                    edge,
                    sourceTriangle: triangle
                });
            }
        }
       
        return newEdges;
    }
   
    /**
     * Ищет треугольники, содержащие заданное ребро
     * @param {string} edgeKey - ключ ребра (id1--id2)
     * @param {Array} allTriangles - все доступные треугольники
     * @param {Set} processed - уже обработанные треугольники
     * @returns {Array} - подходящие треугольники
     */
    findTrianglesByEdge(edgeKey, allTriangles, processed) {
        const [id1, id2] = edgeKey.split('--');
        const candidates = [];
       
        if (!allTriangles || allTriangles.length === 0) return candidates;
       
        for (const triangle of allTriangles) {
            // Пропускаем уже обработанные
            if (processed.has(triangle.id)) continue;
           
            // Проверяем, содержит ли треугольник это ребро
            if (triangle.edges) {
                for (let i = 0; i < triangle.edges.length; i++) {
                    const edge = triangle.edges[i];
                    if (edge && edge.v1 && edge.v2) {
                        const triEdgeKey = [edge.v1.id, edge.v2.id].sort().join('--');
                        if (triEdgeKey === edgeKey) {
                            candidates.push(triangle);
                            break;
                        }
                    }
                }
            }
        }
       
        // Сортируем по уверенности
        return candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    }
   
    /**
     * Собирает все якоря из структуры плюс новый треугольник
     * @param {TopologicalStructure} structure - текущая структура
     * @param {Object} newTriangle - новый треугольник
     * @returns {Array} - массив якорей для вычисления transform
     */
    collectAnchors(structure, newTriangle) {
        const anchors = [];
       
        // Добавляем все якоря из структуры
        if (structure && structure.getAnchors) {
            anchors.push(...structure.getAnchors());
        }
       
        // Добавляем якоря из нового треугольника
        if (newTriangle && newTriangle.p1 && newTriangle.pB1) {
            anchors.push({
                pointA: newTriangle.p1.id,
                pointB: newTriangle.pB1.id,
                confidence: newTriangle.confidence || 0.5,
                triangleId: newTriangle.id
            });
        }
        if (newTriangle && newTriangle.p2 && newTriangle.pB2) {
            anchors.push({
                pointA: newTriangle.p2.id,
                pointB: newTriangle.pB2.id,
                confidence: newTriangle.confidence || 0.5,
                triangleId: newTriangle.id
            });
        }
        if (newTriangle && newTriangle.p3 && newTriangle.pB3) {
            anchors.push({
                pointA: newTriangle.p3.id,
                pointB: newTriangle.pB3.id,
                confidence: newTriangle.confidence || 0.5,
                triangleId: newTriangle.id
            });
        }
       
        return anchors;
    }
   
    /**
     * Пытается добавить треугольник в структуру
     * @param {Object} triangle - проверяемый треугольник
     * @param {TopologicalStructure} structure - текущая структура
     * @param {Object} graphA - граф первого следа
     * @param {Object} graphB - граф второго следа
     * @param {Map} morphologyMap - морфология первого следа
     * @param {Map} modelMorphology - морфология второго следа
     * @returns {boolean} - успешно ли добавлен
     */
    tryAddTriangle(triangle, structure, graphA, graphB, morphologyMap, modelMorphology) {
        if (!triangle) return false;
       
        // 1. Проверка уверенности
        if ((triangle.confidence || 0) < this.minConfidence) {
            this.stats.rejections.lowConfidence++;
            if (this.debug) {
                console.log(`      ❌ Низкая уверенность: ${(triangle.confidence*100).toFixed(1)}% < ${this.minConfidence*100}%`);
            }
            return false;
        }
       
        // 2. Если в структуре уже есть transform, проверяем согласованность
        if (structure && structure.transform) {
            // Создаём временный набор якорей с новым треугольником
            const existingAnchors = structure.getAnchors ? structure.getAnchors() : [];
            const newAnchors = this.collectAnchors(null, triangle);
            const testAnchors = [...existingAnchors, ...newAnchors];
           
            if (testAnchors.length < 3) {
                this.stats.rejections.transformFailed++;
                return false;
            }
           
            // Вычисляем новый transform
            const testTransform = this.validator.calculateTransform(
                testAnchors,
                graphA,
                graphB
            );
           
            if (!testTransform) {
                this.stats.rejections.transformFailed++;
                if (this.debug) {
                    console.log(`      ❌ Не удалось вычислить transform`);
                }
                return false;
            }
           
            // Проверяем отклонение масштаба
            const scaleDiff = Math.abs(testTransform.scale - structure.transform.scale) / Math.max(structure.transform.scale, 0.001);
            if (scaleDiff > this.maxScaleDeviation) {
                this.stats.rejections.scaleMismatch++;
                if (this.debug) {
                    console.log(`      ❌ Масштаб: ${testTransform.scale.toFixed(3)} vs ${structure.transform.scale.toFixed(3)} (${(scaleDiff*100).toFixed(1)}%)`);
                }
                return false;
            }
           
            // Проверяем отклонение поворота
            const rotDiff = Math.abs(testTransform.rotation - structure.transform.rotation) * 180 / Math.PI;
            if (rotDiff > this.maxRotationDeviation) {
                this.stats.rejections.rotationMismatch++;
                if (this.debug) {
                    console.log(`      ❌ Поворот: ${(testTransform.rotation * 180 / Math.PI).toFixed(1)}° vs ${(structure.transform.rotation * 180 / Math.PI).toFixed(1)}° (${rotDiff.toFixed(1)}°)`);
                }
                return false;
            }
           
            // Всё хорошо - обновляем transform структуры
            structure.transform = testTransform;
           
            if (this.debug) {
                console.log(`      ✅ Согласован: масштаб ${testTransform.scale.toFixed(3)}, поворот ${(testTransform.rotation * 180 / Math.PI).toFixed(1)}°`);
            }
        }
       
        // Добавляем треугольник
        if (structure) {
            structure.addTriangle(triangle);
        }
        return true;
    }
   
    /**
     * Строит структуру от заданного треугольника-затравки
     * @param {Object} seedTriangle - начальный треугольник (уже должен быть якорем)
     * @param {Array} allTriangles - все доступные треугольники-кандидаты
     * @param {Object} graphA - граф первого следа
     * @param {Object} graphB - граф второго следа
     * @param {Map} morphologyMap - морфология первого следа
     * @param {Map} modelMorphology - морфология второго следа
     * @returns {TopologicalStructure} - построенная структура
     */
    buildFromSeed(seedTriangle, allTriangles, graphA, graphB, morphologyMap, modelMorphology) {
        if (!seedTriangle) {
            if (this.debug) console.log(`⚠️ Нет треугольника-затравки`);
            return null;
        }
       
        if (this.debug) {
            console.log(`\n🔨 Строю структуру от треугольника ${seedTriangle.id?.substring(0,12) || 'unknown'}...`);
        }
       
        // Создаём новую структуру
        const structureId = `struct_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const structure = new TopologicalStructure(structureId, seedTriangle);
       
        // Карта всех треугольников по ID для быстрого доступа
        const trianglesMap = new Map();
        if (allTriangles) {
            allTriangles.forEach(t => {
                if (t && t.id) trianglesMap.set(t.id, t);
            });
        }
       
        // Множество обработанных треугольников
        const processed = new Set([seedTriangle.id]);
       
        // Очередь на добавление (граничные рёбра -> ищем треугольники)
        let growthQueue = this.getInitialGrowthEdges(seedTriangle);
       
        let iteration = 0;
        const maxIterations = 100; // защита от бесконечного цикла
       
        while (growthQueue.length > 0 && iteration < maxIterations) {
            iteration++;
           
            if (this.debug && iteration % 10 === 0) {
                console.log(`   Итерация ${iteration}, очередь: ${growthQueue.length}`);
            }
           
            // Берём следующее ребро для роста
            const { edgeKey, edge } = growthQueue.shift();
           
            // Ищем треугольники, использующие это ребро
            const candidates = this.findTrianglesByEdge(edgeKey, allTriangles, processed);
           
            if (candidates.length === 0) {
                continue; // нет кандидатов на этом ребре
            }
           
            if (this.debug && candidates.length > 0) {
                console.log(`   Ребро ${edgeKey} даёт ${candidates.length} кандидатов`);
            }
           
            // Пробуем добавить каждого кандидата
            for (const candidate of candidates) {
                const added = this.tryAddTriangle(
                    candidate,
                    structure,
                    graphA,
                    graphB,
                    morphologyMap,
                    modelMorphology
                );
               
                if (added) {
                    // Успешно добавили - помечаем как обработанный
                    processed.add(candidate.id);
                   
                    // Добавляем новые граничные рёбра в очередь
                    const newEdges = this.getNewBoundaryEdges(candidate, structure, edgeKey);
                    growthQueue.push(...newEdges);
                   
                    if (this.debug) {
                        console.log(`      ✅ Добавлен треугольник ${candidate.id?.substring(0,12)}`);
                    }
                   
                    break; // берём только один треугольник на ребро
                }
            }
        }
       
        // Вычисляем финальный transform структуры
        if (structure && structure.triangleIds.size >= 2 && this.validator) {
            const anchors = structure.getAnchors ? structure.getAnchors() : [];
            if (anchors.length >= 3) {
                const transform = this.validator.calculateTransform(anchors, graphA, graphB);
                if (transform) {
                    structure.transform = transform;
                }
            }
        }
       
        this.stats.structuresBuilt++;
        this.stats.trianglesProcessed += structure.triangleIds.size;
       
        if (this.debug) {
            const stats = structure.getStats ? structure.getStats() : { triangleCount: structure.triangleIds.size, pointCount: structure.pointIds.size, confidence: 0.5 };
            console.log(`\n📊 Структура построена:`);
            console.log(`   • Треугольников: ${stats.triangleCount}`);
            console.log(`   • Точек: ${stats.pointCount}`);
            console.log(`   • Уверенность: ${(stats.confidence * 100).toFixed(1)}%`);
            if (structure.transform) {
                console.log(`   • Масштаб: ${structure.transform.scale.toFixed(3)}`);
                console.log(`   • Поворот: ${(structure.transform.rotation * 180 / Math.PI).toFixed(1)}°`);
            }
        }
       
        return structure;
    }
   
    /**
     * Возвращает статистику построителя
     * @returns {Object} - статистика
     */
    getStats() {
        return {
            ...this.stats,
            rejections: { ...this.stats.rejections }
        };
    }
   
    /**
     * Сбрасывает статистику
     */
    resetStats() {
        this.stats = {
            structuresBuilt: 0,
            trianglesProcessed: 0,
            rejections: {
                lowConfidence: 0,
                scaleMismatch: 0,
                rotationMismatch: 0,
                transformFailed: 0
            }
        };
    }
}

module.exports = StructureBuilder;
