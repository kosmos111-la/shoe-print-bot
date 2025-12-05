// modules/footprint/topology-utils.js
// Вспомогательные функции для работы с топологией

const fs = require('fs');
const path = require('path');

class TopologyUtils {
    constructor() {
        console.log('🔧 TopologyUtils создан');
    }

    // 1. ВЕНГЕРСКИЙ АЛГОРИТМ (упрощенный для n ≤ 20)
    static hungarianMatching(nodes1, nodes2) {
        if (!nodes1 || !nodes2 || nodes1.length === 0 || nodes2.length === 0) {
            return [];
        }

        const n = Math.max(nodes1.length, nodes2.length);
       
        // Создаем матрицу стоимостей
        const costMatrix = [];
        for (let i = 0; i < n; i++) {
            costMatrix[i] = [];
            for (let j = 0; j < n; j++) {
                if (i < nodes1.length && j < nodes2.length) {
                    const dx = nodes1[i].x - nodes2[j].x;
                    const dy = nodes1[i].y - nodes2[j].y;
                    costMatrix[i][j] = Math.sqrt(dx * dx + dy * dy);
                } else {
                    costMatrix[i][j] = 999999; // Большая стоимость для несуществующих
                }
            }
        }

        // Простой жадный алгоритм (для начала)
        return this.greedyAssignment(costMatrix);
    }

    // 2. ЖАДНОЕ СОПОСТАВЛЕНИЕ
    static greedyAssignment(costMatrix) {
        const n = costMatrix.length;
        const assignment = new Array(n).fill(-1);
        const used = new Array(n).fill(false);

        for (let i = 0; i < n; i++) {
            let bestJ = -1;
            let bestCost = Infinity;

            for (let j = 0; j < n; j++) {
                if (!used[j] && costMatrix[i][j] < bestCost) {
                    bestCost = costMatrix[i][j];
                    bestJ = j;
                }
            }

            if (bestJ !== -1 && bestCost < 500000) { // Проверяем что не "бесконечная" стоимость
                assignment[i] = bestJ;
                used[bestJ] = true;
            }
        }

        return assignment;
    }

    // 3. PCA - АНАЛИЗ ГЛАВНЫХ КОМПОНЕНТ
    static calculatePCA(points) {
        if (!points || points.length < 2) {
            return null;
        }

        // 1. Центрируем точки
        const mean = { x: 0, y: 0 };
        points.forEach(p => {
            mean.x += p.x;
            mean.y += p.y;
        });
        mean.x /= points.length;
        mean.y /= points.length;

        const centered = points.map(p => ({
            x: p.x - mean.x,
            y: p.y - mean.y
        }));

        // 2. Ковариационная матрица 2x2
        let covXX = 0, covXY = 0, covYY = 0;

        centered.forEach(p => {
            covXX += p.x * p.x;
            covXY += p.x * p.y;
            covYY += p.y * p.y;
        });

        covXX /= points.length;
        covXY /= points.length;
        covYY /= points.length;

        // 3. Собственные значения (характеристическое уравнение)
        const trace = covXX + covYY;
        const determinant = covXX * covYY - covXY * covXY;

        const discriminant = trace * trace - 4 * determinant;
        if (discriminant < 0) {
            return null;
        }

        const lambda1 = (trace + Math.sqrt(discriminant)) / 2;
        const lambda2 = (trace - Math.sqrt(discriminant)) / 2;

        // 4. Собственные векторы (для lambda1)
        let eigenvector1 = { x: 1, y: 0 };
        if (Math.abs(covXY) > 0.0001) {
            // Решаем (A - λI)v = 0
            const a = covXX - lambda1;
            const b = covXY;
           
            if (Math.abs(b) > 0.0001) {
                eigenvector1 = { x: -b, y: a };
            }
        }

        // Нормализуем
        const length = Math.sqrt(eigenvector1.x * eigenvector1.x + eigenvector1.y * eigenvector1.y);
        if (length > 0) {
            eigenvector1.x /= length;
            eigenvector1.y /= length;
        }

        // Второй вектор ортогонален первому
        const eigenvector2 = { x: -eigenvector1.y, y: eigenvector1.x };

        return {
            eigenvalues: [lambda1, lambda2],
            eigenvectors: [eigenvector1, eigenvector2],
            explainedVariance: lambda1 / (lambda1 + lambda2),
            mean: mean,
            totalVariance: lambda1 + lambda2
        };
    }

    // 4. ВРАЩЕНИЕ ТОЧЕК НА УГОЛ
    static rotatePoints(points, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
       
        return points.map(p => ({
            x: p.x * cos - p.y * sin,
            y: p.x * sin + p.y * cos
        }));
    }

    // 5. МАСШТАБИРОВАНИЕ ТОЧЕК
    static scalePoints(points, scale) {
        return points.map(p => ({
            x: p.x * scale,
            y: p.y * scale
        }));
    }

    // 6. СМЕЩЕНИЕ ТОЧЕК
    static translatePoints(points, dx, dy) {
        return points.map(p => ({
            x: p.x + dx,
            y: p.y + dy
        }));
    }

    // 7. ВЫЧИСЛЕНИЕ ГРАФОВОГО ДИАМЕТРА
    static calculateGraphDiameter(nodes, edges) {
        if (!nodes || nodes.length === 0 || !edges) {
            return 0;
        }

        // Создаем карту индексов
        const idToIndex = new Map();
        nodes.forEach((node, index) => {
            idToIndex.set(node.id, index);
        });

        const n = nodes.length;
       
        // Инициализируем матрицу расстояний
        const dist = Array(n).fill().map(() => Array(n).fill(Infinity));
        for (let i = 0; i < n; i++) {
            dist[i][i] = 0;
        }

        // Заполняем ребра (расстояние 1)
        edges.forEach(edge => {
            const i = idToIndex.get(edge.from);
            const j = idToIndex.get(edge.to);
           
            if (i !== undefined && j !== undefined) {
                dist[i][j] = 1;
                dist[j][i] = 1;
            }
        });

        // Алгоритм Флойда-Уоршелла
        for (let k = 0; k < n; k++) {
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (dist[i][k] + dist[k][j] < dist[i][j]) {
                        dist[i][j] = dist[i][k] + dist[k][j];
                    }
                }
            }
        }

        // Находим максимальное расстояние
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
        if (!nodes || nodes.length === 0 || !edges) {
            return 0;
        }

        // Создаем список соседей для каждого узла
        const neighbors = new Map();
        nodes.forEach(node => {
            neighbors.set(node.id, new Set());
        });

        edges.forEach(edge => {
            const fromNeighbors = neighbors.get(edge.from);
            const toNeighbors = neighbors.get(edge.to);
           
            if (fromNeighbors && toNeighbors) {
                fromNeighbors.add(edge.to);
                toNeighbors.add(edge.from);
            }
        });

        let totalCoefficient = 0;
        let nodesWithNeighbors = 0;

        nodes.forEach(node => {
            const nodeNeighbors = neighbors.get(node.id);
            const k = nodeNeighbors ? nodeNeighbors.size : 0;
           
            if (k >= 2) {
                // Считаем возможные связи между соседями
                const neighborArray = Array.from(nodeNeighbors);
                let possibleConnections = 0;
                let actualConnections = 0;

                for (let i = 0; i < neighborArray.length; i++) {
                    for (let j = i + 1; j < neighborArray.length; j++) {
                        possibleConnections++;
                       
                        const neighborI = neighborArray[i];
                        const neighborJ = neighborArray[j];
                       
                        // Проверяем есть ли связь между соседями
                        if (neighbors.get(neighborI).has(neighborJ)) {
                            actualConnections++;
                        }
                    }
                }

                if (possibleConnections > 0) {
                    const coefficient = actualConnections / possibleConnections;
                    totalCoefficient += coefficient;
                    nodesWithNeighbors++;
                }
            }
        });

        return nodesWithNeighbors > 0 ? totalCoefficient / nodesWithNeighbors : 0;
    }

    // 9. СРЕДНЯЯ ДЛИНА ПУТИ
    static calculateAveragePathLength(nodes, edges) {
        if (!nodes || nodes.length === 0 || !edges) {
            return 0;
        }

        const idToIndex = new Map();
        nodes.forEach((node, index) => {
            idToIndex.set(node.id, index);
        });

        const n = nodes.length;
        const dist = Array(n).fill().map(() => Array(n).fill(Infinity));
       
        for (let i = 0; i < n; i++) {
            dist[i][i] = 0;
        }

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

        // Средняя длина пути
        let totalDistance = 0;
        let pathCount = 0;

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (dist[i][j] < Infinity) {
                    totalDistance += dist[i][j];
                    pathCount++;
                }
            }
        }

        return pathCount > 0 ? totalDistance / pathCount : 0;
    }

    // 10. СОЗДАНИЕ ГИСТОГРАММЫ
    static createHistogram(data, bins = 10) {
        if (!data || data.length === 0) {
            return { values: [], bins: [], min: 0, max: 0 };
        }

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min;

        if (range === 0) {
            // Все значения одинаковые
            const histogram = new Array(bins).fill(0);
            histogram[0] = 1;
            return {
                values: histogram.map(v => v / data.length),
                bins: [min],
                min,
                max
            };
        }

        const binSize = range / bins;
        const histogram = new Array(bins).fill(0);
        const binEdges = [];

        // Границы бинов
        for (let i = 0; i <= bins; i++) {
            binEdges.push(min + i * binSize);
        }

        // Заполняем гистограмму
        data.forEach(value => {
            let binIndex = Math.floor((value - min) / binSize);
            // Обработка граничного случая: value == max
            if (binIndex === bins) {
                binIndex = bins - 1;
            }
            histogram[binIndex]++;
        });

        // Нормализуем
        const normalized = histogram.map(count => count / data.length);

        return {
            values: normalized,
            bins: binEdges,
            min,
            max
        };
    }

    // 11. СРАВНЕНИЕ ГИСТОГРАММ (Earth Mover's Distance упрощенный)
    static compareHistograms(hist1, hist2) {
        if (!hist1 || !hist2 || !hist1.values || !hist2.values) {
            return 1.0; // Максимальное отличие
        }

        const n = Math.min(hist1.values.length, hist2.values.length);
        if (n === 0) return 1.0;

        // Простая метрика - сумма абсолютных разностей
        let totalDifference = 0;
        for (let i = 0; i < n; i++) {
            totalDifference += Math.abs(hist1.values[i] - hist2.values[i]);
        }

        // Преобразуем в сходство (1 - различие)
        const similarity = Math.max(0, 1 - totalDifference);
        return similarity;
    }

    // 12. ПРОВЕРКА ЗЕРКАЛЬНОЙ СИММЕТРИИ
    static checkMirrorSymmetry(nodes1, nodes2) {
        if (!nodes1 || !nodes2 || nodes1.length !== nodes2.length) {
            return { isMirrored: false, score: 0, originalDistance: 999, mirroredDistance: 999 };
        }

        if (nodes1.length < 3) {
            return { isMirrored: false, score: 0.5, originalDistance: 0, mirroredDistance: 0 };
        }

        // 1. Оригинальное расстояние
        let originalDistance = 0;
        for (let i = 0; i < nodes1.length; i++) {
            const dx = nodes1[i].x - nodes2[i].x;
            const dy = nodes1[i].y - nodes2[i].y;
            originalDistance += Math.sqrt(dx * dx + dy * dy);
        }
        originalDistance /= nodes1.length;

        // 2. Зеркальное расстояние (отражаем вторую модель по X)
        let mirroredDistance = 0;
        for (let i = 0; i < nodes1.length; i++) {
            const dx = nodes1[i].x - (-nodes2[i].x); // Зеркалим X координату
            const dy = nodes1[i].y - nodes2[i].y;
            mirroredDistance += Math.sqrt(dx * dx + dy * dy);
        }
        mirroredDistance /= nodes1.length;

        // 3. Определяем зеркальность
        const isMirrored = mirroredDistance < originalDistance * 0.85; // Порог 85%
       
        // 4. Вычисляем оценку сходства
        const bestDistance = Math.min(originalDistance, mirroredDistance);
        const score = Math.max(0, 1 - bestDistance / 0.3); // 0.3 - порог хорошего совпадения

        return {
            isMirrored,
            score: Math.min(1, score),
            originalDistance,
            mirroredDistance,
            distanceRatio: mirroredDistance / originalDistance
        };
    }

    // 13. ПОСТРОЕНИЕ МАТРИЦЫ СМЕЖНОСТИ
    static buildAdjacencyMatrix(nodes, edges) {
        if (!nodes || !edges) {
            return [];
        }

        const n = nodes.length;
        const matrix = Array(n).fill().map(() => Array(n).fill(0));
        const idToIndex = new Map();

        nodes.forEach((node, index) => {
            idToIndex.set(node.id, index);
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

    // 14. РАСПРЕДЕЛЕНИЕ СТЕПЕНЕЙ УЗЛОВ
    static getDegreeDistribution(nodes, edges) {
        if (!nodes || !edges) {
            return { values: [], bins: [], min: 0, max: 0 };
        }

        const degrees = nodes.map(node => {
            return edges.filter(e => e.from === node.id || e.to === node.id).length;
        });

        return this.createHistogram(degrees, 5);
    }

    // 15. РАСЧЕТ РАССТОЯНИЯ МЕЖДУ ТОЧКАМИ
    static calculateDistance(p1, p2) {
        if (!p1 || !p2) {
            return Infinity;
        }
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 16. НАХОЖДЕНИЕ ЦЕНТРА МАСС
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

    // 17. ВЫЧИСЛЕНИЕ КОВАРИАЦИОННОЙ МАТРИЦЫ
    static calculateCovarianceMatrix(points) {
        if (!points || points.length < 2) {
            return { xx: 0, xy: 0, yy: 0 };
        }

        const center = this.calculateCenterOfMass(points);
        let covXX = 0, covXY = 0, covYY = 0;

        points.forEach(p => {
            const dx = p.x - center.x;
            const dy = p.y - center.y;
            covXX += dx * dx;
            covXY += dx * dy;
            covYY += dy * dy;
        });

        const n = points.length;
        return {
            xx: covXX / n,
            xy: covXY / n,
            yy: covYY / n
        };
    }

    // 18. НАХОЖДЕНИЕ ГЛАВНОЙ ОСИ (первый собственный вектор)
    static calculatePrincipalAxis(covarianceMatrix) {
        const { xx, xy, yy } = covarianceMatrix;
       
        // Собственные значения
        const trace = xx + yy;
        const determinant = xx * yy - xy * xy;
        const discriminant = trace * trace - 4 * determinant;
       
        if (discriminant < 0) {
            return { x: 1, y: 0 };
        }
       
        const lambda1 = (trace + Math.sqrt(discriminant)) / 2;
       
        // Собственный вектор для lambda1
        let vx = 1, vy = 0;
        if (Math.abs(xy) > 0.0001) {
            // (A - λI)v = 0
            // (xx - λ) * vx + xy * vy = 0
            // xy * vx + (yy - λ) * vy = 0
            vx = -xy;
            vy = xx - lambda1;
        }
       
        // Нормализуем
        const length = Math.sqrt(vx * vx + vy * vy);
        if (length > 0) {
            vx /= length;
            vy /= length;
        }
       
        return { x: vx, y: vy };
    }

    // 19. СОХРАНЕНИЕ ТОПОЛОГИЧЕСКИХ ДАННЫХ
    static saveTopologyData(footprint, filePath) {
        try {
            const topologyData = {
                id: footprint.id,
                name: footprint.name,
                normalizedNodes: Array.from(footprint.topologyInvariants?.normalizedNodes?.entries() || []),
                invariants: footprint.topologyInvariants,
                timestamp: new Date().toISOString()
            };

            fs.writeFileSync(filePath, JSON.stringify(topologyData, null, 2));
            console.log(`✅ Топологические данные сохранены: ${filePath}`);
            return true;
        } catch (error) {
            console.log(`❌ Ошибка сохранения топологических данных:`, error.message);
            return false;
        }
    }

    // 20. ЗАГРУЗКА ТОПОЛОГИЧЕСКИХ ДАННЫХ
    static loadTopologyData(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                console.log(`⚠️ Файл не найден: ${filePath}`);
                return null;
            }

            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            console.log(`✅ Топологические данные загружены: ${filePath}`);
            return data;
        } catch (error) {
            console.log(`❌ Ошибка загрузки топологических данных:`, error.message);
            return null;
        }
    }
}

module.exports = TopologyUtils;
