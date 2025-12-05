// modules/footprint/topology-utils.js
// ПОЛНАЯ РЕАЛИЗАЦИЯ ВСЕХ НЕОБХОДИМЫХ МЕТОДОВ

class TopologyUtils {
    constructor() {
        console.log('🔧 TopologyUtils создан');
    }

    // 1. ВЕНГЕРСКИЙ АЛГОРИТМ (упрощенный)
    static hungarianMatching(nodes1, nodes2) {
        if (!nodes1 || !nodes2 || nodes1.length === 0 || nodes2.length === 0) {
            return [];
        }

        const n = Math.max(nodes1.length, nodes2.length);
        const assignment = new Array(n).fill(-1);
        const used = new Set();

        // Простой жадный алгоритм
        for (let i = 0; i < Math.min(nodes1.length, nodes2.length); i++) {
            let bestJ = -1;
            let bestDist = Infinity;

            for (let j = 0; j < Math.min(nodes1.length, nodes2.length); j++) {
                if (used.has(j)) continue;

                const dx = nodes1[i].x - nodes2[j].x;
                const dy = nodes1[i].y - nodes2[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < bestDist) {
                    bestDist = dist;
                    bestJ = j;
                }
            }

            if (bestJ !== -1) {
                assignment[i] = bestJ;
                used.add(bestJ);
            }
        }

        return assignment;
    }

    // 2. ЦЕНТР МАСС
    static calculateCenterOfMass(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0 };
        }

        let sumX = 0, sumY = 0;
        points.forEach(p => {
            sumX += p.x;
            sumY += p.y;
        });

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    // 3. РАССТОЯНИЕ
    static calculateDistance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 4. PCA
    static calculatePCA(points) {
        if (!points || points.length < 2) {
            return null;
        }

        // Центрируем
        const center = this.calculateCenterOfMass(points);
        const centered = points.map(p => ({
            x: p.x - center.x,
            y: p.y - center.y
        }));

        // Ковариационная матрица
        let covXX = 0, covXY = 0, covYY = 0;
        centered.forEach(p => {
            covXX += p.x * p.x;
            covXY += p.x * p.y;
            covYY += p.y * p.y;
        });

        const n = points.length;
        covXX /= n;
        covXY /= n;
        covYY /= n;

        // Собственные значения
        const trace = covXX + covYY;
        const det = covXX * covYY - covXY * covXY;
        const disc = trace * trace - 4 * det;

        if (disc < 0) return null;

        const lambda1 = (trace + Math.sqrt(disc)) / 2;
        const lambda2 = (trace - Math.sqrt(disc)) / 2;

        // Главный собственный вектор
        let vx = 1, vy = 0;
        if (Math.abs(covXY) > 0.0001) {
            vx = -covXY;
            vy = covXX - lambda1;
        }

        // Нормализуем
        const len = Math.sqrt(vx * vx + vy * vy);
        if (len > 0) {
            vx /= len;
            vy /= len;
        }

        return {
            eigenvalues: [lambda1, lambda2],
            eigenvectors: [{x: vx, y: vy}, {x: -vy, y: vx}],
            explainedVariance: lambda1 / (lambda1 + lambda2),
            mean: center
        };
    }

    // 5. МАТРИЦА СМЕЖНОСТИ
    static buildAdjacencyMatrix(nodes, edges) {
        if (!nodes || !edges) return [];

        const n = nodes.length;
        const matrix = Array(n).fill().map(() => Array(n).fill(0));
        const idToIndex = new Map();

        nodes.forEach((node, idx) => {
            idToIndex.set(node.id, idx);
        });

        edges.forEach(edge => {
            const i = idToIndex.get(edge.from);
            const j = idToIndex.get(edge.to);
            if (i !== undefined && j !== undefined) {
                matrix[i][j] = 1;
                matrix[j][i] = 1;
            }
        });

        return matrix;
    }

    // 6. РАСПРЕДЕЛЕНИЕ СТЕПЕНЕЙ
    static getDegreeDistribution(nodes, edges) {
        if (!nodes || !edges) {
            return { values: [], bins: [] };
        }

        const degrees = nodes.map(node => {
            return edges.filter(e => e.from === node.id || e.to === node.id).length;
        });

        return this.createHistogram(degrees, 5);
    }

    // 7. ДИАМЕТР ГРАФА
    static calculateGraphDiameter(nodes, edges) {
        if (!nodes || nodes.length === 0) return 0;

        const n = nodes.length;
        const idToIndex = new Map();
        nodes.forEach((node, idx) => idToIndex.set(node.id, idx));

        // Инициализация
        const dist = Array(n).fill().map(() => Array(n).fill(Infinity));
        for (let i = 0; i < n; i++) dist[i][i] = 0;

        // Ребра
        edges.forEach(edge => {
            const i = idToIndex.get(edge.from);
            const j = idToIndex.get(edge.to);
            if (i !== undefined && j !== undefined) {
                dist[i][j] = 1;
                dist[j][i] = 1;
            }
        });

        // Флойд-Уоршелл
        for (let k = 0; k < n; k++) {
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (dist[i][k] + dist[k][j] < dist[i][j]) {
                        dist[i][j] = dist[i][k] + dist[k][j];
                    }
                }
            }
        }

        // Максимальное расстояние
        let diameter = 0;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (dist[i][j] < Infinity && dist[i][j] > diameter) {
                    diameter = dist[i][j];
                }
            }
        }

        return diameter;
    }

    // 8. КОЭФФИЦИЕНТ КЛАСТЕРИЗАЦИИ
    static calculateClusteringCoefficient(nodes, edges) {
        if (!nodes || nodes.length === 0) return 0;

        const neighbors = new Map();
        nodes.forEach(node => neighbors.set(node.id, new Set()));

        edges.forEach(edge => {
            const fromSet = neighbors.get(edge.from);
            const toSet = neighbors.get(edge.to);
            if (fromSet && toSet) {
                fromSet.add(edge.to);
                toSet.add(edge.from);
            }
        });

        let totalCoeff = 0;
        let count = 0;

        nodes.forEach(node => {
            const nodeNeighbors = Array.from(neighbors.get(node.id) || []);
            const k = nodeNeighbors.length;

            if (k >= 2) {
                let triangles = 0;
                let possible = k * (k - 1) / 2;

                for (let i = 0; i < k; i++) {
                    for (let j = i + 1; j < k; j++) {
                        if (neighbors.get(nodeNeighbors[i])?.has(nodeNeighbors[j])) {
                            triangles++;
                        }
                    }
                }

                if (possible > 0) {
                    totalCoeff += triangles / possible;
                    count++;
                }
            }
        });

        return count > 0 ? totalCoeff / count : 0;
    }

    // 9. СРЕДНЯЯ ДЛИНА ПУТИ
    static calculateAveragePathLength(nodes, edges) {
        if (!nodes || nodes.length === 0) return 0;

        const n = nodes.length;
        const idToIndex = new Map();
        nodes.forEach((node, idx) => idToIndex.set(node.id, idx));

        const dist = Array(n).fill().map(() => Array(n).fill(Infinity));
        for (let i = 0; i < n; i++) dist[i][i] = 0;

        edges.forEach(edge => {
            const i = idToIndex.get(edge.from);
            const j = idToIndex.get(edge.to);
            if (i !== undefined && j !== undefined) {
                dist[i][j] = 1;
                dist[j][i] = 1;
            }
        });

        // Флойд-Уоршелл
        for (let k = 0; k < n; k++) {
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (dist[i][k] + dist[k][j] < dist[i][j]) {
                        dist[i][j] = dist[i][k] + dist[k][j];
                    }
                }
            }
        }

        let total = 0;
        let pairs = 0;

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (dist[i][j] < Infinity) {
                    total += dist[i][j];
                    pairs++;
                }
            }
        }

        return pairs > 0 ? total / pairs : 0;
    }

    // 10. ГИСТОГРАММА
    static createHistogram(data, bins = 10) {
        if (!data || data.length === 0) {
            return { values: [], bins: [] };
        }

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min;

        if (range === 0) {
            const values = new Array(bins).fill(0);
            values[0] = 1;
            return { values: values.map(v => v / data.length), bins: [min] };
        }

        const binSize = range / bins;
        const histogram = new Array(bins).fill(0);

        data.forEach(value => {
            let bin = Math.floor((value - min) / binSize);
            bin = Math.min(bin, bins - 1);
            histogram[bin]++;
        });

        // Нормализуем
        const normalized = histogram.map(v => v / data.length);
        const binEdges = [];
        for (let i = 0; i <= bins; i++) {
            binEdges.push(min + i * binSize);
        }

        return {
            values: normalized,
            bins: binEdges,
            min,
            max
        };
    }

    // 11. СРАВНЕНИЕ ГИСТОГРАММ
    static compareHistograms(hist1, hist2) {
        if (!hist1 || !hist2 || !hist1.values || !hist2.values) {
            return 0;
        }

        const n = Math.min(hist1.values.length, hist2.values.length);
        if (n === 0) return 0;

        let diff = 0;
        for (let i = 0; i < n; i++) {
            diff += Math.abs(hist1.values[i] - hist2.values[i]);
        }

        return Math.max(0, 1 - diff);
    }

    // 12. ПРОВЕРКА ЗЕРКАЛЬНОСТИ
    static checkMirrorSymmetry(nodes1, nodes2) {
        if (!nodes1 || !nodes2 || nodes1.length !== nodes2.length) {
            return { isMirrored: false, score: 0, originalDistance: 999, mirroredDistance: 999 };
        }

        // Оригинальное расстояние
        let originalDist = 0;
        for (let i = 0; i < nodes1.length; i++) {
            const dx = nodes1[i].x - nodes2[i].x;
            const dy = nodes1[i].y - nodes2[i].y;
            originalDist += Math.sqrt(dx * dx + dy * dy);
        }
        originalDist /= nodes1.length;

        // Зеркальное расстояние
        let mirroredDist = 0;
        for (let i = 0; i < nodes1.length; i++) {
            const dx = nodes1[i].x - (-nodes2[i].x);
            const dy = nodes1[i].y - nodes2[i].y;
            mirroredDist += Math.sqrt(dx * dx + dy * dy);
        }
        mirroredDist /= nodes1.length;

        const isMirrored = mirroredDist < originalDist * 0.9;
        const score = Math.max(0, 1 - Math.min(originalDist, mirroredDist) / 0.3);

        return {
            isMirrored,
            score,
            originalDistance: originalDist,
            mirroredDistance: mirroredDist
        };
    }

    // 13. ВРАЩЕНИЕ ТОЧЕК
    static rotatePoints(points, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return points.map(p => ({
            x: p.x * cos - p.y * sin,
            y: p.x * sin + p.y * cos
        }));
    }

    // 14. МАСШТАБИРОВАНИЕ
    static scalePoints(points, scale) {
        return points.map(p => ({
            x: p.x * scale,
            y: p.y * scale
        }));
    }

    // 15. СМЕЩЕНИЕ
    static translatePoints(points, dx, dy) {
        return points.map(p => ({
            x: p.x + dx,
            y: p.y + dy
        }));
    }

    // 16. normalizeNodes - исправленная версия (она уже была в DigitalFootprint, но вынесем сюда)
    static normalizeNodes(nodes) {
        if (!nodes || nodes.length < 2) {
            return { normalized: nodes, params: { center: {x: 0, y: 0}, scale: 1, rotation: 0 } };
        }

        // 1. Центр масс
        const center = this.calculateCenterOfMass(nodes.map(n => n.center || n));

        // 2. Центрируем
        const centered = nodes.map(node => ({
            x: (node.center?.x || node.x) - center.x,
            y: (node.center?.y || node.y) - center.y
        }));

        // 3. Среднее расстояние
        const distances = [];
        for (let i = 0; i < centered.length; i++) {
            for (let j = i + 1; j < centered.length; j++) {
                distances.push(this.calculateDistance(centered[i], centered[j]));
            }
        }

        const meanDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        const scale = meanDist > 0 ? 1.0 / meanDist : 1.0;

        // 4. PCA для поворота
        const pca = this.calculatePCA(centered);
        let rotation = 0;
        if (pca && pca.eigenvectors[0]) {
            const axis = pca.eigenvectors[0];
            rotation = -Math.atan2(axis.y, axis.x);
        }

        // 5. Применяем
        const normalized = centered.map(point => {
            let x = point.x * scale;
            let y = point.y * scale;
           
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            const rx = x * cos - y * sin;
            const ry = x * sin + y * cos;
           
            return { x: rx, y: ry };
        });

        return {
            normalized,
            params: { center, scale, rotation, meanDistance: meanDist }
        };
    }

    // 17. compareGraphInvariants
    static compareGraphInvariants(invariants1, invariants2) {
        if (!invariants1 || !invariants2) return 0.5;

        let score = 0;
        let factors = 0;

        // Сравнение распределения степеней
        if (invariants1.degreeDistribution && invariants2.degreeDistribution) {
            const degreeScore = this.compareHistograms(
                invariants1.degreeDistribution,
                invariants2.degreeDistribution
            );
            score += degreeScore * 0.4;
            factors += 0.4;
        }

        // Сравнение диаметра
        if (invariants1.graphDiameter !== null && invariants2.graphDiameter !== null) {
            const diam1 = invariants1.graphDiameter;
            const diam2 = invariants2.graphDiameter;
            const maxDiam = Math.max(diam1, diam2, 1);
            const diamScore = 1 - Math.abs(diam1 - diam2) / maxDiam;
            score += diamScore * 0.3;
            factors += 0.3;
        }

        // Сравнение коэффициента кластеризации
        if (invariants1.clusteringCoefficient !== null && invariants2.clusteringCoefficient !== null) {
            const cc1 = invariants1.clusteringCoefficient;
            const cc2 = invariants2.clusteringCoefficient;
            const ccScore = 1 - Math.abs(cc1 - cc2);
            score += ccScore * 0.3;
            factors += 0.3;
        }

        return factors > 0 ? score / factors : 0.5;
    }
}

module.exports = TopologyUtils;
