// modules/footprint/topology/KNNGraphBuilder.js
// 🔷 ПОСТРОЕНИЕ KNN-ГРАФА (ДЛЯ WL-СРАВНЕНИЯ)

class KNNGraphBuilder {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.k = options.k || 8;
       
        console.log(`🔷 KNNGraphBuilder создан, k=${this.k}`);
    }

    buildGraph(points, name = '') {
        if (this.debug) console.log(`🔷 Строю KNN-граф "${name}" из ${points.length} точек...`);

        if (points.length < 2) {
            return this.buildMinimalGraph(points);
        }

        // Нормализуем координаты
        const normalizedPoints = this.normalizePoints(points);
       
        // Строим KNN-граф
        const graph = this.buildKNNGraph(normalizedPoints);

        if (this.debug) console.log(`✅ KNN-граф построен: ${graph.nodes.size} узлов, ${graph.edges.size} рёбер`);

        return graph;
    }

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
       
        return points.map((p, idx) => ({
            id: p.id || `pt_${idx}`,
            x: (p.x - minX) / maxDim,
            y: (p.y - minY) / maxDim,
            originalIndex: idx,
            confidence: p.confidence || 0.5
        }));
    }

    buildKNNGraph(points) {
        const nodes = new Map();
        const edges = new Set();
       
        for (const point of points) {
            nodes.set(point.id, {
                id: point.id,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                degree: 0
            });
        }
       
        const pointArray = Array.from(nodes.values());
       
        for (let i = 0; i < pointArray.length; i++) {
            const pointA = pointArray[i];
           
            const distances = [];
           
            for (let j = 0; j < pointArray.length; j++) {
                if (i === j) continue;
               
                const pointB = pointArray[j];
                const dx = pointA.x - pointB.x;
                const dy = pointA.y - pointB.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
               
                distances.push({
                    id: pointB.id,
                    dist: dist
                });
            }
           
            distances.sort((a, b) => a.dist - b.dist);
            const nearest = distances.slice(0, Math.min(this.k, distances.length));
           
            for (const neighbor of nearest) {
                const edge = [pointA.id, neighbor.id].sort().join('--');
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
            avgDegree: avgDegree,
            points: points
        };
    }

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

module.exports = KNNGraphBuilder;
