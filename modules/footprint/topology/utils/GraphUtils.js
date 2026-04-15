// modules/footprint/topology/utils/GraphUtils.js

class GraphUtils {
    /**
     * Находит всех соседей узла в графе
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
     */
    static areConnected(aId, bId, graph) {
        const edgeId = [aId, bId].sort().join('--');
        return graph.edges.has(edgeId);
    }

    /**
     * Вычисляет расстояние в графе (BFS)
     */
    static graphDistance(startId, targetId, graph) {
        if (startId === targetId) return 0;

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
}

module.exports = GraphUtils;
