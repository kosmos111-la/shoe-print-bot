// modules/footprint/topology/GraphBuilder.js
// 🔷 ПОСТРОЕНИЕ ГРАФА ДЕЛОНЕ С НОРМАЛИЗАЦИЕЙ И ПОДСЧЕТОМ ТРЕУГОЛЬНИКОВ

const GeometryUtils = require('./geometry');

class GraphBuilder {
    constructor(options = {}) {
        this.debug = options.debug || false;
        console.log('🔷 GraphBuilder (Делоне + нормализация + треугольники) создан');
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    buildGraph(points, name = '') {
        console.log(`🔷 Строю граф Делоне "${name}" из ${points.length} точек...`);

        if (points.length < 3) {
            console.log('⚠️ Слишком мало точек для триангуляции');
            return this.buildMinimalGraph(points);
        }

        // Нормализуем координаты (только для построения графа)
        const normalizedPoints = this.normalizePoints(points);
      
        // Строим триангуляцию Делоне на нормализованных координатах
        const graph = this.buildDelaunayGraph(normalizedPoints, points);

        // 🔥 НОВОЕ: Подсчет треугольников для каждой точки
        const triangles = this.countTriangles(graph);
       
        // Добавляем треугольники в узлы графа
        for (const [nodeId, node] of graph.nodes) {
            node.triangles = triangles.get(nodeId) || 0;
        }

        console.log(`✅ Граф Делоне построен: ${graph.nodes.size} узлов, ${graph.edges.size} рёбер`);
       
        // Статистика по треугольникам
        const triangleValues = Array.from(triangles.values());
        const avgTriangles = triangleValues.reduce((a, b) => a + b, 0) / triangleValues.length;
        const maxTriangles = Math.max(...triangleValues);
        console.log(`   📐 Треугольников: среднее ${avgTriangles.toFixed(1)}, макс ${maxTriangles}`);

        return graph;
    }

    // ==================== НОРМАЛИЗАЦИЯ ====================

    normalizePoints(points) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
      
        for (const p of points) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }
      
        const width = maxX - minX;
        const height = maxY - minY;
        const maxDim = Math.max(width, height);
      
        if (maxDim === 0) return points;
      
        // Нормализуем, но СОХРАНЯЕМ оригинальные координаты
        return points.map((p, idx) => ({
            id: p.id || `pt_${idx}`,
            x: (p.x - minX) / maxDim,
            y: (p.y - minY) / maxDim,
            originalX: p.x,
            originalY: p.y,
            originalIndex: idx,
            confidence: p.confidence || 0.5
        }));
    }

    // ==================== ТРИАНГУЛЯЦИЯ ДЕЛОНЕ ====================

    buildDelaunayGraph(normalizedPoints, originalPoints) {
        const superTriangle = this.createSuperTriangle(normalizedPoints);
        const allPoints = [...normalizedPoints, ...superTriangle.points];

        let triangles = [superTriangle.triangle];

        for (let i = 0; i < normalizedPoints.length; i++) {
            const point = normalizedPoints[i];

            const badTriangles = [];
            const goodTriangles = [];

            for (const triangle of triangles) {
                const [a, b, c] = triangle.map(idx => allPoints[idx]);
                if (GeometryUtils.inCircumcircle(a, b, c, point)) {
                    badTriangles.push(triangle);
                } else {
                    goodTriangles.push(triangle);
                }
            }

            const polygon = this.findBoundary(badTriangles);
            const newTriangles = [];

            for (const edge of polygon) {
                newTriangles.push([edge[0], edge[1], i]);
            }

            triangles = [...goodTriangles, ...newTriangles];
        }
 // 🔥 ЛОГ: проверяем, есть ли якоря контура в новом графе
        const contourAnchors = Array.from(nodes.values()).filter(n => n.isContourAnchor);
        if (contourAnchors.length > 0) {
            console.log(`🔷 GraphBuilder: якорей контура в новом графе: ${contourAnchors.length}`);
            contourAnchors.forEach(a => {
                console.log(`   ${a.id}: (${a.x.toFixed(1)}, ${a.y.toFixed(1)})`);
            });
        } else {
            console.log(`⚠️ GraphBuilder: якорей контура НЕТ в новом графе!`);
        }
        const superIndices = superTriangle.indices;
        triangles = triangles.filter(triangle =>
            !triangle.some(vertex => superIndices.includes(vertex))
        );

        const graph = this.trianglesToGraph(triangles, normalizedPoints, originalPoints);
       
        // 🔥 Сохраняем список треугольников для дальнейшего использования
        graph.triangleList = triangles;

        return graph;
    }

    createSuperTriangle(points) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const p of points) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }

        const dx = maxX - minX;
        const dy = maxY - minY;
        const pad = Math.max(dx, dy) * 0.5;

        const superPoints = [
            { id: 'super_A', x: minX - dx - pad, y: minY - pad },
            { id: 'super_B', x: maxX + dx + pad, y: minY - pad },
            { id: 'super_C', x: (minX + maxX) / 2, y: maxY + dy + pad }
        ];

        const indices = [points.length, points.length + 1, points.length + 2];

        return {
            points: superPoints,
            indices: indices,
            triangle: indices
        };
    }

    findBoundary(triangles) {
        const edgeCount = new Map();

        for (const triangle of triangles) {
            const edges = [
                [triangle[0], triangle[1]].sort((a, b) => a - b),
                [triangle[1], triangle[2]].sort((a, b) => a - b),
                [triangle[2], triangle[0]].sort((a, b) => a - b)
            ];

            for (const edge of edges) {
                const key = `${edge[0]},${edge[1]}`;
                edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
            }
        }

        const boundary = [];
        for (const [key, count] of edgeCount) {
            if (count === 1) {
                const [a, b] = key.split(',').map(Number);
                boundary.push([a, b]);
            }
        }

        return boundary;
    }

    trianglesToGraph(triangles, normalizedPoints, originalPoints) {
    const nodes = new Map();
    const edges = new Set();

    // Используем ОРИГИНАЛЬНЫЕ координаты для узлов
    for (let i = 0; i < normalizedPoints.length; i++) {
        const normPoint = normalizedPoints[i];
        const origPoint = originalPoints[i];
     
        nodes.set(normPoint.id, {
            id: normPoint.id,
            x: origPoint.x,
            y: origPoint.y,
            confidence: normPoint.confidence || origPoint.confidence || 0.5,
            degree: 0,
            triangles: 0,
           
            // 🔥 СОХРАНЯЕМ ВСЕ ДОПОЛНИТЕЛЬНЫЕ СВОЙСТВА
            confirmationCount: origPoint.confirmationCount || normPoint.confirmationCount || 1,
            addedFrom: origPoint.addedFrom || normPoint.addedFrom || 'original',
            addedAt: origPoint.addedAt || normPoint.addedAt || new Date(),
            originalPhotoId: origPoint.originalPhotoId || normPoint.originalPhotoId || normPoint.id,
            morphology: origPoint.morphology || normPoint.morphology || {},
           
            // Топологические свойства
            role: origPoint.role || normPoint.role,
            clusterId: origPoint.clusterId || normPoint.clusterId,
            patternType: origPoint.patternType || normPoint.patternType,
            structureId: origPoint.structureId || normPoint.structureId,
           
            // 🔥 ЯКОРЬ КОНТУРА
            isContourAnchor: origPoint.isContourAnchor || normPoint.isContourAnchor || false
        });
      // 🔥 ЛОГ: сохраняется ли isContourAnchor
            if (origPoint.isContourAnchor || normPoint.isContourAnchor) {
                console.log(`🔷 GraphBuilder: сохраняю isContourAnchor для ${normPoint.id}`);
            } 
    }
        for (const triangle of triangles) {
            const [aIdx, bIdx, cIdx] = triangle;

            if (aIdx >= normalizedPoints.length || bIdx >= normalizedPoints.length || cIdx >= normalizedPoints.length) {
                continue;
            }

            const a = normalizedPoints[aIdx].id;
            const b = normalizedPoints[bIdx].id;
            const c = normalizedPoints[cIdx].id;

            const edgesToAdd = [
                [a, b].sort().join('--'),
                [b, c].sort().join('--'),
                [c, a].sort().join('--')
            ];

            for (const edge of edgesToAdd) {
                edges.add(edge);
            }
        }

        for (const edge of edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodes.has(nodeA)) nodes.get(nodeA).degree++;
            if (nodes.has(nodeB)) nodes.get(nodeB).degree++;
        }

        const degrees = Array.from(nodes.values()).map(n => n.degree);
        const avgDegree = degrees.reduce((a, b) => a + b, 0) / degrees.length;

        return {
        nodes: nodes,
        edges: edges,
        triangles: triangles.length,
        triangleList: triangles,
        avgDegree: avgDegree,
        points: normalizedPoints
    };
}

    // ==================== 🔥 НОВЫЙ МЕТОД: ПОДСЧЕТ ТРЕУГОЛЬНИКОВ ====================

    /**
     * Подсчитывает количество треугольников для каждой точки графа
     * @param {Object} graph - граф с nodes и edges
     * @returns {Map} - карта nodeId -> количество треугольников
     */
    countTriangles(graph) {
        const triangles = new Map();
        const nodes = Array.from(graph.nodes.keys());
        const edges = new Set(graph.edges);
       
        // Инициализируем счетчики
        for (const nodeId of nodes) {
            triangles.set(nodeId, 0);
        }
       
        // Для каждого узла считаем треугольники
        for (let i = 0; i < nodes.length; i++) {
            const nodeId = nodes[i];
           
            // Находим всех соседей узла
            const neighbors = [];
            for (const edge of edges) {
                const [a, b] = edge.split('--');
                if (a === nodeId) neighbors.push(b);
                if (b === nodeId) neighbors.push(a);
            }
           
            // Если соседей меньше 2, треугольников быть не может
            if (neighbors.length < 2) continue;
           
            // Считаем треугольники (циклы длины 3)
            let count = 0;
            for (let j = 0; j < neighbors.length; j++) {
                for (let k = j + 1; k < neighbors.length; k++) {
                    // Проверяем, есть ли ребро между соседями
                    const edgeId = [neighbors[j], neighbors[k]].sort().join('--');
                    if (edges.has(edgeId)) {
                        count++;
                    }
                }
            }
           
            triangles.set(nodeId, count);
        }
       
        return triangles;
    }

    // ==================== МИНИМАЛЬНЫЙ ГРАФ (ДЛЯ МАЛОГО КОЛИЧЕСТВА ТОЧЕК) ====================

    buildMinimalGraph(points) {
    const nodes = new Map();
    const edges = new Set();

    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const id = point.id || `pt_${i}`;

        nodes.set(id, {
            id: id,
            x: point.x,
            y: point.y,
            confidence: point.confidence || 0.5,
            degree: 0,
            triangles: 0,
           
            // 🔥 СОХРАНЯЕМ ВСЕ ДОПОЛНИТЕЛЬНЫЕ СВОЙСТВА
            confirmationCount: point.confirmationCount || 1,
            addedFrom: point.addedFrom || 'original',
            addedAt: point.addedAt || new Date(),
            originalPhotoId: point.originalPhotoId || id,
            morphology: point.morphology || {},
            role: point.role,
            clusterId: point.clusterId,
            patternType: point.patternType,
            structureId: point.structureId,
           
            // 🔥 ЯКОРЬ КОНТУРА
            isContourAnchor: point.isContourAnchor || false
        });
// 🔥 ЛОГ: сохраняется ли isContourAnchor
            if (point.isContourAnchor) {
                console.log(`🔷 GraphBuilder (minimal): сохраняю isContourAnchor для ${id}`);
            }
        if (i > 0) {
            const prevId = points[i-1].id || `pt_${i-1}`;
            edges.add([prevId, id].sort().join('--'));
        }
    }

    if (points.length >= 3) {
        const firstId = points[0].id || `pt_0`;
        const lastId = points[points.length-1].id || `pt_${points.length-1}`;
        edges.add([firstId, lastId].sort().join('--'));
    }

    for (const edge of edges) {
        const [nodeA, nodeB] = edge.split('--');
        nodes.get(nodeA).degree++;
        nodes.get(nodeB).degree++;
    }

    return {
        nodes: nodes,
        edges: edges,
        triangles: 0,
        triangleList: [],
        avgDegree: points.length > 0 ?
            Array.from(nodes.values()).reduce((sum, n) => sum + n.degree, 0) / nodes.size : 0,
        points: points.map((p, idx) => ({
            id: p.id || `pt_${idx}`,
            x: p.x,
            y: p.y,
            confidence: p.confidence || 0.5
        }))
    };
}
}

module.exports = GraphBuilder;
