// modules/footprint/topology/utils/RoleClassifier.js

const GraphUtils = require('./GraphUtils');

class RoleClassifier {
    constructor(options = {}) {
        this.hubThreshold = options.hubThreshold || 6;
        this.bridgeThreshold = options.bridgeThreshold || 2;
        this.cliqueThreshold = options.cliqueThreshold || 3;
    }

    /**
     * Определяет роль узла: H (хаб), B (мост), C (клика), L (лист), R (обычный)
     */
    classify(nodeId, graph) {
        const neighbors = GraphUtils.findNodeNeighbors(nodeId, graph);
        const degree = neighbors.length;

        // ХАБ (H)
        if (degree >= this.hubThreshold) return 'H';

        // МОСТ (B) — узел степени 2, соседи не связаны
        if (degree === 2) {
            const [a, b] = neighbors;
            if (!GraphUtils.areConnected(a.id, b.id, graph)) {
                return 'B';
            }
        }

        // КЛИКА (C) — все соседи связаны друг с другом
        if (degree >= this.cliqueThreshold) {
            let allConnected = true;
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    if (!GraphUtils.areConnected(neighbors[i].id, neighbors[j].id, graph)) {
                        allConnected = false;
                        break;
                    }
                }
                if (!allConnected) break;
            }
            if (allConnected) return 'C';
        }

        // ЛИСТ (L)
        if (degree === 1) return 'L';

        // ОБЫЧНЫЙ (R)
        return 'R';
    }

    /**
     * Упрощенная классификация (только H, L, R)
     */
    classifySimple(nodeId, graph) {
        const neighbors = GraphUtils.findNodeNeighbors(nodeId, graph);
        const degree = neighbors.length;

        if (degree >= this.hubThreshold) return 'H';
        if (degree === 1) return 'L';
        return 'R';
    }

    /**
     * Преобразует роль в угол для K-plet
     */
    roleToAngle(role) {
        const map = { 'L': 0, 'R': 45, 'C': 90, 'H': 135, 'B': 180 };
        return map[role] || 0;
    }
}

module.exports = RoleClassifier;
