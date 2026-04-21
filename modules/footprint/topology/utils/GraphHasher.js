// modules/footprint/topology/utils/GraphHasher.js
// 🔐 ХЭШИРОВАНИЕ ГРАФА ДЛЯ БЫСТРОГО ПОИСКА МОДЕЛИ

const crypto = require('crypto');

class GraphHasher {
    constructor(options = {}) {
        this.debug = options.debug || false;
    }

    /**
     * Вычисляет хэш графа для быстрого сравнения
     * @param {Object} graph - граф с nodes и edges
     * @returns {string} - хэш графа
     */
    computeGraphHash(graph) {
        if (!graph || !graph.nodes || graph.nodes.size === 0) {
            return 'empty_graph';
        }

        // 1. Базовые метрики
        const nodeCount = graph.nodes.size;
        const edgeCount = graph.edges.size;

        // 2. Распределение степеней (сортированное)
        const degrees = Array.from(graph.nodes.values())
            .map(n => n.degree || 0)
            .sort((a, b) => a - b);

        // 3. Количество треугольников для каждой точки (сортированное)
        const triangles = Array.from(graph.nodes.values())
            .map(n => n.triangles || 0)
            .sort((a, b) => a - b);

        // 4. Распределение ролей (если есть)
        const roles = Array.from(graph.nodes.values())
            .map(n => n.role || 'R')
            .sort();

        const roleCounts = {};
        roles.forEach(r => roleCounts[r] = (roleCounts[r] || 0) + 1);
        const roleStr = Object.entries(roleCounts)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([r, c]) => `${r}${c}`)
            .join('');

        // 5. Средние координаты (для грубой локализации)
        let sumX = 0, sumY = 0;
        for (const node of graph.nodes.values()) {
            sumX += node.x || 0;
            sumY += node.y || 0;
        }
        const avgX = Math.round(sumX / nodeCount);
        const avgY = Math.round(sumY / nodeCount);

        // 6. Собираем строку для хэширования
        const hashInput = [
            nodeCount,
            edgeCount,
            degrees.join(','),
            triangles.join(','),
            roleStr,
            avgX,
            avgY
        ].join('|');

        // 7. Вычисляем хэш
        const hash = crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);

        if (this.debug) {
            console.log(`🔐 GraphHasher: ${nodeCount} узлов, ${edgeCount} рёбер → ${hash}`);
        }

        return hash;
    }

    /**
     * Вычисляет упрощённый хэш (быстрее, но менее точный)
     */
    computeQuickHash(graph) {
        if (!graph || !graph.nodes || graph.nodes.size === 0) {
            return 'empty';
        }

        const nodeCount = graph.nodes.size;
        const edgeCount = graph.edges.size;

        // Только количество узлов и рёбер + средняя степень
        const avgDegree = edgeCount > 0 ? (edgeCount * 2) / nodeCount : 0;

        const hashInput = `${nodeCount}|${edgeCount}|${avgDegree.toFixed(2)}`;
        return crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 8);
    }

    /**
     * Сравнивает два хэша и возвращает степень похожести
     */
    compareHashes(hash1, hash2) {
        if (hash1 === hash2) return 1.0;
       
        // Можно реализовать частичное сравнение по компонентам
        return 0.0;
    }

    /**
     * Хэширует строку (для вспомогательных целей)
     */
    hashString(str) {
        return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
    }
}

module.exports = GraphHasher;
