// modules/footprint/topology/utils/GraphUtils.js

class GraphUtils {
    /**
     * Находит всех соседей узла в графе
     * @param {string} nodeId - ID узла
     * @param {Object} graph - граф с nodes и edges
     * @returns {Array} - массив узлов-соседей
     */
    static findNodeNeighbors(nodeId, graph) {
        const neighbors = [];
        if (!graph?.edges) return neighbors;

        const edges = Array.isArray(graph.edges)
            ? graph.edges
            : Array.from(graph.edges);

        for (const edge of edges) {
            const [a, b] = edge.split('--');
            if (a === nodeId) {
                const node = graph.nodes.get(b);
                if (node) neighbors.push(node);
            }
            if (b === nodeId) {
                const node = graph.nodes.get(a);
                if (node) neighbors.push(node);
            }
        }
        return neighbors;
    }

    /**
     * Проверяет, соединены ли два узла ребром
     * @param {string} aId - ID первого узла
     * @param {string} bId - ID второго узла
     * @param {Object} graph - граф
     * @returns {boolean}
     */
    static areConnected(aId, bId, graph) {
        if (!graph?.edges) return false;
        const edgeId = [aId, bId].sort().join('--');
        return graph.edges.has(edgeId);
    }

    /**
     * Вычисляет расстояние в графе между двумя узлами (BFS)
     * @param {string} startId - начальный узел
     * @param {string} targetId - целевой узел
     * @param {Object} graph - граф
     * @returns {number} - расстояние или Infinity если недостижимо
     */
    static graphDistance(startId, targetId, graph) {
        if (startId === targetId) return 0;
        if (!graph?.nodes) return Infinity;

        const queue = [{ id: startId, dist: 0 }];
        const visited = new Set([startId]);

        while (queue.length > 0) {
            const { id, dist } = queue.shift();
            const neighbors = this.findNodeNeighbors(id, graph);

            for (const neighbor of neighbors) {
                if (neighbor.id === targetId) return dist + 1;
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push({ id: neighbor.id, dist: dist + 1 });
                }
            }
        }
        return Infinity;
    }

    /**
     * Находит все пути длины до maxDepth от startId
     * @param {string} startId - начальный узел
     * @param {Object} graph - граф
     * @param {number} maxDepth - максимальная глубина поиска
     * @returns {Array} - массив узлов в радиусе maxDepth
     */
    static findNodesInRadius(startId, graph, maxDepth) {
        const result = [];
        const visited = new Set([startId]);
        const queue = [{ id: startId, dist: 0 }];

        while (queue.length > 0) {
            const { id, dist } = queue.shift();

            if (dist > 0) {
                const node = graph.nodes.get(id);
                if (node) result.push({ ...node, distance: dist });
            }

            if (dist >= maxDepth) continue;

            const neighbors = this.findNodeNeighbors(id, graph);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push({ id: neighbor.id, dist: dist + 1 });
                }
            }
        }

        return result;
    }

    /**
     * Подсчитывает количество треугольников для каждой точки графа
     * @param {Object} graph - граф с nodes и edges
     * @returns {Map} - карта nodeId -> количество треугольников
     */
    static countTriangles(graph) {
        const triangles = new Map();
        const nodes = Array.from(graph.nodes.keys());
        const edges = graph.edges;

        for (const nodeId of nodes) {
            triangles.set(nodeId, 0);
        }

        for (let i = 0; i < nodes.length; i++) {
            const nodeId = nodes[i];

            const neighbors = this.findNodeNeighbors(nodeId, graph).map(n => n.id);
            if (neighbors.length < 2) continue;

            let count = 0;
            for (let j = 0; j < neighbors.length; j++) {
                for (let k = j + 1; k < neighbors.length; k++) {
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
}

module.exports = GraphUtils;
