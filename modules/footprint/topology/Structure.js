// modules/footprint/topology/Structure.js
// 🏗️ ТОПОЛОГИЧЕСКАЯ СТРУКТУРА - связный набор треугольников

class TopologicalStructure {
    /**
     * Создаёт новую структуру от затравки (seed triangle)
     * @param {string} id - уникальный идентификатор
     * @param {Object} seedTriangle - начальный треугольник-якорь
     */
    constructor(id, seedTriangle) {
        this.id = id;
        this.createdAt = Date.now();
       
        // Основные данные
        this.triangles = new Map(); // id треугольника -> объект треугольника
        this.triangleIds = new Set(); // Set ID для быстрого поиска
        this.pointIds = new Set(); // все точки, входящие в структуру
       
        // Граничные рёбра для роста (ребро -> { triangle, externalPoint })
        this.boundaryEdges = new Map();
       
        // Трансформация структуры
        this.transform = null;
        this.transformHistory = []; // история изменений transform
       
        // Статистика
        this.stats = {
            scales: [],
            rotations: [],
            translations: [],
            confidences: []
        };
       
        // Добавляем seed-треугольник
        if (seedTriangle) {
            this.addTriangle(seedTriangle);
        }
    }
   
    /**
     * Добавляет треугольник в структуру
     * @param {Object} triangle - треугольник для добавления
     * @returns {boolean} - успешно ли добавлен
     */
    addTriangle(triangle) {
        // Проверяем, не дубликат ли
        if (this.triangleIds.has(triangle.id)) {
            return false;
        }
       
        // Добавляем треугольник
        this.triangles.set(triangle.id, triangle);
        this.triangleIds.add(triangle.id);
       
        // Добавляем точки треугольника
        if (triangle.p1 && triangle.p1.id) this.pointIds.add(triangle.p1.id);
        if (triangle.p2 && triangle.p2.id) this.pointIds.add(triangle.p2.id);
        if (triangle.p3 && triangle.p3.id) this.pointIds.add(triangle.p3.id);
       
        // Обновляем граничные рёбра
        this.updateBoundaries(triangle);
       
        // Обновляем статистику
        this.stats.confidences.push(triangle.confidence || 0.5);
       
        return true;
    }
   
    /**
     * Обновляет граничные рёбра после добавления треугольника
     * @param {Object} triangle - добавленный треугольник
     */
    updateBoundaries(triangle) {
        // Создаём рёбра из точек треугольника, если их нет
        const edges = triangle.edges || [
            { v1: triangle.p1, v2: triangle.p2, externalPoint: null },
            { v1: triangle.p2, v2: triangle.p3, externalPoint: null },
            { v1: triangle.p3, v2: triangle.p1, externalPoint: null }
        ];
       
        // Для каждого ребра треугольника
        for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            if (!edge.v1 || !edge.v2) continue;
           
            const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');
           
            // Если ребро уже было в границах - оно перестаёт быть граничным
            if (this.boundaryEdges.has(edgeKey)) {
                this.boundaryEdges.delete(edgeKey);
            } else {
                // Иначе добавляем как новое граничное
                this.boundaryEdges.set(edgeKey, {
                    v1: edge.v1,
                    v2: edge.v2,
                    externalPoint: edge.externalPoint,
                    sourceTriangle: triangle
                });
            }
        }
    }
   
    /**
     * Проверяет, можно ли присоединить треугольник к структуре
     * @param {Object} triangle - проверяемый треугольник
     * @returns {boolean} - можно ли присоединить
     */
    canAccept(triangle) {
        // Создаём рёбра из точек треугольника, если их нет
        const edges = triangle.edges || [
            { v1: triangle.p1, v2: triangle.p2 },
            { v1: triangle.p2, v2: triangle.p3 },
            { v1: triangle.p3, v2: triangle.p1 }
        ];
       
        // Треугольник должен иметь хотя бы одно общее ребро с границей
        for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            if (!edge.v1 || !edge.v2) continue;
           
            const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');
           
            if (this.boundaryEdges.has(edgeKey)) {
                return true;
            }
        }
        return false;
    }
   
    /**
     * Возвращает все якоря (пары точек) из структуры
     * @returns {Array} - массив якорей { pointA, pointB, confidence, triangleId }
     */
    getAnchors() {
        const anchors = [];
       
        for (const triangle of this.triangles.values()) {
            // Проверяем наличие точек
            if (triangle.p1 && triangle.pB1) {
                anchors.push({
                    pointA: triangle.p1.id,
                    pointB: triangle.pB1.id,
                    confidence: triangle.confidence || 0.5,
                    triangleId: triangle.id
                });
            }
           
            if (triangle.p2 && triangle.pB2) {
                anchors.push({
                    pointA: triangle.p2.id,
                    pointB: triangle.pB2.id,
                    confidence: triangle.confidence || 0.5,
                    triangleId: triangle.id
                });
            }
           
            if (triangle.p3 && triangle.pB3) {
                anchors.push({
                    pointA: triangle.p3.id,
                    pointB: triangle.pB3.id,
                    confidence: triangle.confidence || 0.5,
                    triangleId: triangle.id
                });
            }
        }
       
        return anchors;
    }
   
    /**
     * Вычисляет transform структуры по всем её точкам
     * @param {Function} transformCalculator - функция вычисления transform
     * @param {Object} graphA - граф первого следа
     * @param {Object} graphB - граф второго следа
     */
    calculateTransform(transformCalculator, graphA, graphB) {
        if (this.triangleIds.size < 2) {
            // Для одной точки transform не нужен
            return null;
        }
       
        // Собираем все якоря из треугольников структуры
        const anchors = this.getAnchors();
       
        if (anchors.length === 0) {
            return null;
        }
       
        // Вычисляем transform
        const transform = transformCalculator(anchors);
       
        if (transform) {
            this.transform = transform;
            this.transformHistory.push({
                timestamp: Date.now(),
                transform: { ...transform },
                triangleCount: this.triangleIds.size
            });
           
            // Обновляем статистику
            this.stats.scales.push(transform.scale);
            this.stats.rotations.push(transform.rotation);
            this.stats.translations.push(transform.translation);
        }
       
        return transform;
    }
   
    /**
     * Возвращает статистику по структуре
     * @returns {Object} - статистика
     */
    getStats() {
        const scales = this.stats.scales;
        const rotations = this.stats.rotations;
       
        return {
            triangleCount: this.triangleIds.size,
            pointCount: this.pointIds.size,
            boundaryEdgeCount: this.boundaryEdges.size,
            confidence: this.calculateConfidence(),
            transform: this.transform,
            stats: {
                scale: {
                    mean: scales.length ? scales.reduce((a, b) => a + b, 0) / scales.length : 0,
                    min: scales.length ? Math.min(...scales) : 0,
                    max: scales.length ? Math.max(...scales) : 0,
                    std: this.calculateStd(scales)
                },
                rotation: {
                    mean: rotations.length ? rotations.reduce((a, b) => a + b, 0) / rotations.length : 0,
                    min: rotations.length ? Math.min(...rotations) : 0,
                    max: rotations.length ? Math.max(...rotations) : 0,
                    std: this.calculateStd(rotations)
                }
            }
        };
    }
   
    /**
     * Вычисляет общую уверенность структуры
     * @returns {number} - уверенность 0-1
     */
    calculateConfidence() {
        if (this.stats.confidences.length === 0) return 0;
       
        const sum = this.stats.confidences.reduce((a, b) => a + b, 0);
        const mean = sum / this.stats.confidences.length;
       
        // Чем больше треугольников, тем выше уверенность (но не больше 1)
        const sizeBonus = Math.min(this.triangleIds.size / 10, 0.2);
       
        return Math.min(mean + sizeBonus, 1.0);
    }
   
    /**
     * Вычисляет среднеквадратичное отклонение
     * @param {Array} values - массив значений
     * @returns {number} - стандартное отклонение
     */
    calculateStd(values) {
        if (values.length < 2) return 0;
       
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squareDiffs = values.map(v => Math.pow(v - mean, 2));
        const variance = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
       
        return Math.sqrt(variance);
    }
   
    /**
     * Проверяет, можно ли объединить с другой структурой
     * @param {TopologicalStructure} other - другая структура
     * @returns {boolean} - можно ли объединить
     */
    canMergeWith(other) {
        // Проверяем, есть ли общие граничные рёбра
        for (const [edgeKey, edge] of this.boundaryEdges) {
            if (other.boundaryEdges.has(edgeKey)) {
                return true;
            }
        }
        return false;
    }
   
    /**
     * Объединяет с другой структурой
     * @param {TopologicalStructure} other - другая структура
     */
    mergeWith(other) {
        // Добавляем все треугольники другой структуры
        for (const triangle of other.triangles.values()) {
            this.addTriangle(triangle);
        }
       
        // Объединяем статистику
        this.stats.scales = [...this.stats.scales, ...other.stats.scales];
        this.stats.rotations = [...this.stats.rotations, ...other.stats.rotations];
        this.stats.translations = [...this.stats.translations, ...other.stats.translations];
        this.stats.confidences = [...this.stats.confidences, ...other.stats.confidences];
       
        // Пересчитываем transform
        // (transform будет пересчитан позже при необходимости)
    }
   
    /**
     * Находит выбросы в структуре
     * @param {number} threshold - порог для определения выброса (в стандартных отклонениях)
     * @returns {Array} - массив ID треугольников-выбросов
     */
    findOutliers(threshold = 2.0) {
        const outliers = [];
       
        if (this.stats.scales.length < 3) return outliers;
       
        const scaleMean = this.stats.scales.reduce((a, b) => a + b, 0) / this.stats.scales.length;
        const scaleStd = this.calculateStd(this.stats.scales);
       
        // Для каждого треугольника проверяем, не выбивается ли он
        for (const [id, triangle] of this.triangles) {
            // Здесь нужно сравнить параметры треугольника с общими
            // Упрощённая версия - пока пропускаем
        }
       
        return outliers;
    }
   
    /**
     * Сериализует структуру для сохранения
     * @returns {Object} - сериализованные данные
     */
    serialize() {
        return {
            id: this.id,
            createdAt: this.createdAt,
            triangleIds: Array.from(this.triangleIds),
            pointIds: Array.from(this.pointIds),
            transform: this.transform,
            stats: this.stats,
            confidence: this.calculateConfidence()
        };
    }
   
    /**
     * Десериализует структуру из сохранённых данных
     * @param {Object} data - сериализованные данные
     * @param {Map} trianglesMap - карта треугольников по ID
     * @returns {TopologicalStructure} - восстановленная структура
     */
    static deserialize(data, trianglesMap) {
        const structure = new TopologicalStructure(data.id, null);
        structure.createdAt = data.createdAt;
        structure.stats = data.stats;
       
        // Восстанавливаем треугольники
        for (const triId of data.triangleIds) {
            const triangle = trianglesMap.get(triId);
            if (triangle) {
                structure.triangles.set(triId, triangle);
                structure.triangleIds.add(triId);
               
                // Восстанавливаем точки
                if (triangle.p1 && triangle.p1.id) structure.pointIds.add(triangle.p1.id);
                if (triangle.p2 && triangle.p2.id) structure.pointIds.add(triangle.p2.id);
                if (triangle.p3 && triangle.p3.id) structure.pointIds.add(triangle.p3.id);
               
                // Восстанавливаем границы
                structure.updateBoundaries(triangle);
            }
        }
       
        structure.transform = data.transform;
       
        return structure;
    }
}

module.exports = TopologicalStructure;
