// modules/footprint/topology/GraphBuilder.js
// 🔷 ПОСТРОЕНИЕ ГРАФА ДЕЛОНЕ С НОРМАЛИЗАЦИЕЙ

const GeometryUtils = require('./geometry');

class GraphBuilder {
    constructor(options = {}) {
        this.debug = options.debug || false;
        console.log('🔷 GraphBuilder (Делоне + нормализация) создан');
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    buildGraph(points, name = '') {
        console.log(`🔷 Строю граф Делоне "${name}" из ${points.length} точек...`);

        if (points.length < 3) {
            console.log('⚠️ Слишком мало точек для триангуляции');
            return this.buildMinimalGraph(points);
        }

        // 🔥 НОРМАЛИЗУЕМ КООРДИНАТЫ
        const normalizedPoints = this.normalizePoints(points);
       
        // Строим триангуляцию Делоне
        const graph = this.buildDelaunayGraph(normalizedPoints);

        console.log(`✅ Граф Делоне построен: ${graph.nodes.size} узлов, ${graph.edges.size} рёбер`);

        return graph;
    }

    // ==================== НОРМАЛИЗАЦИЯ ====================

    normalizePoints(points) {
        // Находим границы
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
       
        if (maxDim === 0) return points; // все точки совпадают
       
        // Нормализуем в диапазон [0, 1]
        return points.map((p, idx) => ({
            id: p.id || `pt_${idx}`,
            x: (p.x - minX) / maxDim,
            y: (p.y - minY) / maxDim,
            originalX: p.x,  // сохраняем для визуализации
            originalY: p.y,
            originalIndex: idx,
            confidence: p.confidence || 0.5
        }));
    }

    // ==================== ТРИАНГУЛЯЦИЯ ДЕЛОНЕ ====================

    buildDelaunayGraph(points) {
        const normalizedPoints = points.map((p, idx) => ({
            id: p.id,
            x: p.x,
            y: p.y,
            originalIndex: idx,
            confidence: p.confidence || 0.5
        }));

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

            if (this.debug && i % 10 === 0) {
                console.log(`   Добавлена точка ${i+1}/${normalizedPoints.length}, треугольников: ${triangles.length}`);
            }
        }

        const superIndices = superTriangle.indices;
        triangles = triangles.filter(triangle =>
            !triangle.some(vertex => superIndices.includes(vertex))
        );

        const graph = this.trianglesToGraph(triangles, normalizedPoints);

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

    trianglesToGraph(triangles, points) {
        const nodes = new Map();
        const edges = new Set();

        for (const point of points) {
            nodes.set(point.id, {
                id: point.id,
                x: point.originalX || point.x,  // используем оригинальные координаты для визуализации
                y: point.originalY || point.y,
                confidence: point.confidence || 0.5,
                degree: 0
            });
        }

        for (const triangle of triangles) {
            const [aIdx, bIdx, cIdx] = triangle;

            if (aIdx >= points.length || bIdx >= points.length || cIdx >= points.length) {
                continue;
            }

            const a = points[aIdx].id;
            const b = points[bIdx].id;
            const c = points[cIdx].id;

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
            avgDegree: avgDegree,
            points: points
        };
    }

    // ==================== МИНИМАЛЬНЫЙ ГРАФ ====================

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
                degree: 0
            });

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
