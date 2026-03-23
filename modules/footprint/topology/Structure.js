// modules/footprint/topology/Structure.js
// 🏗️ ТОПОЛОГИЧЕСКАЯ СТРУКТУРА - связный набор треугольников
// 🔥 С ПОДДЕРЖКОЙ ЛУЧЕЙ ДЛЯ ВИЗУАЛИЗАЦИИ

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
       
        // 🔥 НОВОЕ: храним информацию о лучах для визуализации
        this.rays = []; // { fromPoint, toPoint, type, triangleId, edgeId, distance }
       
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
     * Находит противоположную вершину для ребра
     */
    getOppositePoint(triangle, edge) {
        if (!triangle || !edge) return null;
        const candidates = [triangle.p1, triangle.p2, triangle.p3];
        return candidates.find(p => p.id !== edge.v1.id && p.id !== edge.v2.id);
    }
   
    /**
     * Добавляет успешный луч (когда внешняя точка найдена и согласована)
     */
    addSuccessRay(triangle, edge, externalPoint) {
        const opposite = this.getOppositePoint(triangle, edge);
        if (!opposite || !externalPoint) return;
       
        // Вычисляем расстояние для отладки
        const dx = opposite.x - externalPoint.x;
        const dy = opposite.y - externalPoint.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
       
        this.rays.push({
            fromPoint: opposite,
            toPoint: externalPoint,
            type: 'success',
            triangleId: triangle.id,
            edgeId: [edge.v1.id, edge.v2.id].sort().join('--'),
            distance: distance,
            confidence: triangle.confidence || 0.5
        });
    }
   
    /**
     * Добавляет неудачный луч (когда внешняя точка не совпала)
     */
    addFailedRay(triangle, edge, externalPointCandidate) {
        const opposite = this.getOppositePoint(triangle, edge);
        if (!opposite || !externalPointCandidate) return;
       
        const dx = opposite.x - externalPointCandidate.x;
        const dy = opposite.y - externalPointCandidate.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
       
        this.rays.push({
            fromPoint: opposite,
            toPoint: externalPointCandidate,
            type: 'failed',
            triangleId: triangle.id,
            edgeId: [edge.v1.id, edge.v2.id].sort().join('--'),
            distance: distance,
            confidence: 0.3
        });
    }
   
    /**
     * Добавляет треугольник в структуру
     */
    addTriangle(triangle) {
        if (this.triangleIds.has(triangle.id)) {
            return false;
        }
       
        this.triangles.set(triangle.id, triangle);
        this.triangleIds.add(triangle.id);
       
        if (triangle.p1 && triangle.p1.id) this.pointIds.add(triangle.p1.id);
        if (triangle.p2 && triangle.p2.id) this.pointIds.add(triangle.p2.id);
        if (triangle.p3 && triangle.p3.id) this.pointIds.add(triangle.p3.id);
       
        this.updateBoundaries(triangle);
        this.stats.confidences.push(triangle.confidence || 0.5);
       
        // 🔥 Добавляем лучи из рёбер треугольника, если есть внешние точки
        const edges = triangle.edges || [
            { v1: triangle.p1, v2: triangle.p2, externalPoint: null },
            { v1: triangle.p2, v2: triangle.p3, externalPoint: null },
            { v1: triangle.p3, v2: triangle.p1, externalPoint: null }
        ];
       
        for (const edge of edges) {
            if (edge.externalPoint) {
                this.addSuccessRay(triangle, edge, edge.externalPoint);
            }
        }
       
        return true;
    }
   
    /**
     * Обновляет граничные рёбра после добавления треугольника
     */
    updateBoundaries(triangle) {
        const edges = triangle.edges || [
            { v1: triangle.p1, v2: triangle.p2, externalPoint: null },
            { v1: triangle.p2, v2: triangle.p3, externalPoint: null },
            { v1: triangle.p3, v2: triangle.p1, externalPoint: null }
        ];
       
        for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            if (!edge.v1 || !edge.v2) continue;
           
            const edgeKey = [edge.v1.id, edge.v2.id].sort().join('--');
           
            if (this.boundaryEdges.has(edgeKey)) {
                this.boundaryEdges.delete(edgeKey);
            } else {
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
     */
    canAccept(triangle) {
        const edges = triangle.edges || [
            { v1: triangle.p1, v2: triangle.p2 },
            { v1: triangle.p2, v2: triangle.p3 },
            { v1: triangle.p3, v2: triangle.p1 }
        ];
       
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
     */
    getAnchors() {
        const anchors = [];
        for (const triangle of this.triangles.values()) {
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
     */
    calculateTransform(transformCalculator, graphA, graphB) {
        if (this.triangleIds.size < 2) {
            return null;
        }
       
        const anchors = this.getAnchors();
        if (anchors.length === 0) {
            return null;
        }
       
        const transform = transformCalculator(anchors);
       
        if (transform) {
            this.transform = transform;
            this.transformHistory.push({
                timestamp: Date.now(),
                transform: { ...transform },
                triangleCount: this.triangleIds.size
            });
           
            this.stats.scales.push(transform.scale);
            this.stats.rotations.push(transform.rotation);
            this.stats.translations.push(transform.translation);
        }
       
        return transform;
    }
   
    /**
     * Возвращает статистику по структуре
     */
    getStats() {
        const scales = this.stats.scales;
        const rotations = this.stats.rotations;
       
        return {
            triangleCount: this.triangleIds.size,
            pointCount: this.pointIds.size,
            boundaryEdgeCount: this.boundaryEdges.size,
            rayCount: this.rays.length,
            successRayCount: this.rays.filter(r => r.type === 'success').length,
            failedRayCount: this.rays.filter(r => r.type === 'failed').length,
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
     */
    calculateConfidence() {
        if (this.stats.confidences.length === 0) return 0;
       
        const sum = this.stats.confidences.reduce((a, b) => a + b, 0);
        const mean = sum / this.stats.confidences.length;
        const sizeBonus = Math.min(this.triangleIds.size / 10, 0.2);
       
        return Math.min(mean + sizeBonus, 1.0);
    }
   
    /**
     * Вычисляет среднеквадратичное отклонение
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
     */
    canMergeWith(other) {
        for (const [edgeKey] of this.boundaryEdges) {
            if (other.boundaryEdges.has(edgeKey)) {
                return true;
            }
        }
        return false;
    }
   
    /**
     * Объединяет с другой структурой
     */
    mergeWith(other) {
        for (const triangle of other.triangles.values()) {
            this.addTriangle(triangle);
        }
       
        for (const ray of other.rays) {
            this.rays.push(ray);
        }
       
        this.stats.scales = [...this.stats.scales, ...other.stats.scales];
        this.stats.rotations = [...this.stats.rotations, ...other.stats.rotations];
        this.stats.translations = [...this.stats.translations, ...other.stats.translations];
        this.stats.confidences = [...this.stats.confidences, ...other.stats.confidences];
    }
   
    /**
     * Сериализует структуру для сохранения
     */
    serialize() {
        return {
            id: this.id,
            createdAt: this.createdAt,
            triangleIds: Array.from(this.triangleIds),
            pointIds: Array.from(this.pointIds),
            rays: this.rays.map(r => ({
                fromId: r.fromPoint.id,
                toId: r.toPoint.id,
                type: r.type,
                triangleId: r.triangleId,
                edgeId: r.edgeId
            })),
            transform: this.transform,
            stats: this.stats,
            confidence: this.calculateConfidence()
        };
    }
   
    /**
     * Десериализует структуру из сохранённых данных
     */
    static deserialize(data, trianglesMap, pointsMap) {
        const structure = new TopologicalStructure(data.id, null);
        structure.createdAt = data.createdAt;
        structure.stats = data.stats;
       
        for (const triId of data.triangleIds) {
            const triangle = trianglesMap.get(triId);
            if (triangle) {
                structure.triangles.set(triId, triangle);
                structure.triangleIds.add(triId);
               
                if (triangle.p1 && triangle.p1.id) structure.pointIds.add(triangle.p1.id);
                if (triangle.p2 && triangle.p2.id) structure.pointIds.add(triangle.p2.id);
                if (triangle.p3 && triangle.p3.id) structure.pointIds.add(triangle.p3.id);
               
                structure.updateBoundaries(triangle);
            }
        }
       
        for (const rayData of data.rays) {
            const fromPoint = pointsMap.get(rayData.fromId);
            const toPoint = pointsMap.get(rayData.toId);
            if (fromPoint && toPoint) {
                structure.rays.push({
                    fromPoint,
                    toPoint,
                    type: rayData.type,
                    triangleId: rayData.triangleId,
                    edgeId: rayData.edgeId
                });
            }
        }
       
        structure.transform = data.transform;
       
        return structure;
    }
}

module.exports = TopologicalStructure;
