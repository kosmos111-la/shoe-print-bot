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
        if (this.debug) {
            console.log(`\n🔨 Строю структуру от треугольника ${seedTriangle.id.substring(0,12)}...`);
        }
       
        // Создаём новую структуру
        const structureId = `struct_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const structure = new TopologicalStructure(structureId, seedTriangle);
       
        // Карта всех треугольников по ID для быстрого доступа
        const trianglesMap = new Map();
        allTriangles.forEach(t => trianglesMap.set(t.id, t));
       
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
                        console.log(`      ✅ Добавлен треугольник ${candidate.id.substring(0,12)}`);
                    }
                   
                    break; // берём только один треугольник на ребро
                }
            }
        }
       
        // Вычисляем финальный transform структуры
        if (structure.triangleIds.size >= 2) {
            structure.calculateTransform(
                (anchors) => this.validator.calculateTransform(anchors, graphA, graphB),
                graphA,
                graphB
            );
        }
       
        this.stats.structuresBuilt++;
        this.stats.trianglesProcessed += structure.triangleIds.size;
       
        if (this.debug) {
            const stats = structure.getStats();
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
     * Возвращает начальные граничные рёбра для затравки
     * @param {Object} triangle - треугольник-затравка
     * @returns {Array} - очередь рёбер для роста
     */
    getInitialGrowthEdges(triangle) {
        const queue = [];
       
        for (let i = 0; i < triangle.edges.length; i++) {
            const edge = triangle.edges[i];
            const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');
           
            queue.push({
                edgeKey,
                edge,
                sourceTriangle: triangle
            });
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
       
        for (let i = 0; i < triangle.edges.length; i++) {
            const edge = triangle.edges[i];
            const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');
           
            // Пропускаем ребро, через которое пришли
            if (edgeKey === incomingEdgeKey) continue;
           
            // Проверяем, не стало ли это ребро внутренним
            if (!structure.boundaryEdges.has(edgeKey)) {
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
       
        for (const triangle of allTriangles) {
            // Пропускаем уже обработанные
            if (processed.has(triangle.id)) continue;
           
            // Проверяем, содержит ли треугольник это ребро
            for (let i = 0; i < triangle.edges.length; i++) {
                const edge = triangle.edges[i];
                const triEdgeKey = [edge.v1.id, edge.v2.id].sort().join('--');
               
                if (triEdgeKey === edgeKey) {
                    candidates.push(triangle);
                    break;
                }
            }
        }
       
        // Сортируем по уверенности
        return candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
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
        // 1. Проверка уверенности
        if ((triangle.confidence || 0) < this.minConfidence) {
            this.stats.rejections.lowConfidence++;
            return false;
        }
       
        // 2. Если в структуре уже есть transform, проверяем согласованность
        if (structure.transform) {
            // Создаём временный набор якорей с новым треугольником
            const testAnchors = this.collectAnchors(structure, triangle);
           
            // Вычисляем новый transform
            const testTransform = this.validator.calculateTransform(
                testAnchors,
                graphA,
                graphB
            );
           
            if (!testTransform) {
                this.stats.rejections.transformFailed++;
                return false;
            }
           
            // Проверяем отклонение масштаба
            const scaleDiff = Math.abs(testTransform.scale - structure.transform.scale) / structure.transform.scale;
            if (scaleDiff > this.maxScaleDeviation) {
                this.stats.rejections.scaleMismatch++;
                if (this.debug) {
                    console.log(`      ❌ Масштаб: ${testTransform.scale.toFixed(3)} vs ${structure.transform.scale.toFixed(3)}`);
                }
                return false;
            }
           
            // Проверяем отклонение поворота
            const rotDiff = Math.abs(testTransform.rotation - structure.transform.rotation) * 180 / Math.PI;
            if (rotDiff > this.maxRotationDeviation) {
                this.stats.rejections.rotationMismatch++;
                if (this.debug) {
                    console.log(`      ❌ Поворот: ${(testTransform.rotation * 180 / Math.PI).toFixed(1)}° vs ${(structure.transform.rotation * 180 / Math.PI).toFixed(1)}°`);
                }
                return false;
            }
           
            // Всё хорошо - обновляем transform структуры (опционально)
            // Можно либо оставить старый, либо усреднить
            structure.transform = testTransform;
        }
       
        // Добавляем треугольник
        structure.addTriangle(triangle);
        return true;
    }
   
    /**
     * Собирает все якоря из структуры плюс новый треугольник
     * @param {TopologicalStructure} structure - текущая структура
     * @param {Object} newTriangle - новый треугольник
     * @returns {Array} - массив якорей для вычисления transform
     */
    collectAnchors(structure, newTriangle) {
        const anchors = [];
       
        // Добавляем все треугольники структуры
        for (const tri of structure.triangles.values()) {
            // Здесь нужно преобразовать треугольник в три якоря
            // Упрощённо:
            anchors.push({
                pointA: tri.p1.id,
                pointB: tri.pB1?.id // нужно уточнить структуру
            });
            // ... для трёх точек
        }
       
        // Добавляем новый треугольник
        anchors.push({
            pointA: newTriangle.p1.id,
            pointB: newTriangle.pB1?.id
        });
        // ... для трёх точек
       
        return anchors;
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
