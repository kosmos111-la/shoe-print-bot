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
     * @param {string} nodeId - ID узла
     * @param {Object} graph - граф
     * @returns {string} - роль
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
     * @param {string} nodeId - ID узла
     * @param {Object} graph - граф
     * @returns {string} - роль
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
     * @param {string} role - роль
     * @returns {number} - угол в градусах
     */
    roleToAngle(role) {
        const map = { 'L': 0, 'R': 45, 'C': 90, 'H': 135, 'B': 180 };
        return map[role] || 0;
    }

    /**
     * Классифицирует все узлы графа
     * @param {Object} graph - граф
     * @returns {Map} - nodeId -> роль
     */
    classifyAll(graph) {
        const roles = new Map();
        for (const nodeId of graph.nodes.keys()) {
            roles.set(nodeId, this.classify(nodeId, graph));
        }
        return roles;
    }

    /**
     * Возвращает статистику распределения ролей
     * @param {Map} roles - карта ролей
     * @returns {Object} - статистика
     */
    getRoleStats(roles) {
        const stats = { H: 0, B: 0, C: 0, R: 0, L: 0 };
        for (const role of roles.values()) {
            stats[role] = (stats[role] || 0) + 1;
        }
        return stats;
    }

    /**
     * Печатает статистику ролей
     * @param {Map} roles - карта ролей
     */
    printRoleStats(roles) {
        const stats = this.getRoleStats(roles);
        console.log(`   Хабы (H): ${stats.H}`);
        console.log(`   Мосты (B): ${stats.B}`);
        console.log(`   Клики (C): ${stats.C}`);
        console.log(`   Обычные (R): ${stats.R}`);
        console.log(`   Листья (L): ${stats.L}`);
    }
}

module.exports = RoleClassifier;
