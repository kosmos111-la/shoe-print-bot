// modules/footprint/topology-utils.js
class TopologyUtils {
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

        // Простой жадный алгоритм
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

            if (bestJ !== -1 && bestCost < 500000) {
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

        // Центрируем
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

        // Ковариационная матрица
        let covXX = 0, covXY = 0, covYY = 0;
        centered.forEach(p => {
            covXX += p.x * p.x;
            covXY += p.x * p.y;
            covYY += p.y * p.y;
        });

        covXX /= points.length;
        covXY /= points.length;
        covYY /= points.length;

        // Собственные значения
        const trace = covXX + covYY;
        const determinant = covXX * covYY - covXY * covXY;
        const discriminant = trace * trace - 4 * determinant;
       
        if (discriminant < 0) {
            return null;
        }

        const lambda1 = (trace + Math.sqrt(discriminant)) / 2;
        const lambda2 = (trace - Math.sqrt(discriminant)) / 2;

        // Главный собственный вектор
        let eigenvector1 = { x: 1, y: 0 };
        if (Math.abs(covXY) > 0.0001) {
            eigenvector1 = { x: lambda1 - covYY, y: covXY };
        }

        // Нормализуем
        const len = Math.sqrt(eigenvector1.x * eigenvector1.x + eigenvector1.y * eigenvector1.y);
        if (len > 0) {
            eigenvector1.x /= len;
            eigenvector1.y /= len;
        }

        // Второй вектор ортогонален первому
        const eigenvector2 = { x: -eigenvector1.y, y: eigenvector1.x };

        return {
            eigenvalues: [lambda1, lambda2],
            eigenvectors: [eigenvector1, eigenvector2],
            explainedVariance: lambda1 / (lambda1 + lambda2),
            mean: mean
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

        // Заполняем ребра
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

    // 11. СРАВНЕНИЕ ГИСТОГРАММ
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
        const isMirrored = mirroredDistance < originalDistance * 0.85;
       
        // 4. Вычисляем оценку сходства
        const bestDistance = Math.min(originalDistance, mirroredDistance);
        const score = Math.max(0, 1 - bestDistance / 0.3);

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

    // 18. НАХОЖДЕНИЕ ГЛАВНОЙ ОСИ
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

    // 19. НОРМАЛИЗАЦИЯ УЗЛОВ - КЛЮЧЕВОЙ МЕТОД!
    static normalizeNodes(nodes) {
        console.log('🔧 TopologyUtils.normalizeNodes вызван с', nodes?.length, 'узлами');
       
        if (!nodes || nodes.length < 2) {
            console.log('⚠️ Недостаточно узлов для нормализации');
            return {
                normalized: nodes ? nodes.map(n => ({
                    x: n.x || n.center?.x || 0,
                    y: n.y || n.center?.y || 0
                })) : [],
                params: {
                    center: {x: 0, y: 0},
                    scale: 1,
                    rotation: 0,
                    meanDistance: 0
                }
            };
        }
       
        // Преобразуем узлы в простые точки
        const points = nodes.map(n => {
            // Поддерживаем разные форматы: {x, y} или {center: {x, y}}
            const x = n.x || (n.center && n.center.x) || 0;
            const y = n.y || (n.center && n.center.y) || 0;
            const confidence = n.confidence || 0.5;
            const id = n.id || `node_${Math.random().toString(36).substr(2, 9)}`;
           
            return { x, y, confidence, id, originalNode: n };
        });
       
        // 1. ЦЕНТР МАСС
        const center = this.calculateCenterOfMass(points);
       
        // 2. ЦЕНТРИРУЕМ (переносим в начало координат)
        const centered = points.map(p => ({
            x: p.x - center.x,
            y: p.y - center.y,
            confidence: p.confidence,
            id: p.id
        }));
       
        // 3. СРЕДНЕЕ РАССТОЯНИЕ между всеми парами точек
        const distances = [];
        for (let i = 0; i < centered.length; i++) {
            for (let j = i + 1; j < centered.length; j++) {
                const dist = this.calculateDistance(centered[i], centered[j]);
                distances.push(dist);
            }
        }
       
        const meanDistance = distances.length > 0
            ? distances.reduce((sum, d) => sum + d, 0) / distances.length
            : 1;
       
        // 4. МАСШТАБИРОВАНИЕ (делаем среднее расстояние = 1)
        const scale = meanDistance > 0 ? 1.0 / meanDistance : 1.0;
       
        // 5. PCA - находим главную ось для выравнивания
        const pca = this.calculatePCA(points);
        let rotationAngle = 0;
       
        if (pca && pca.eigenvectors && pca.eigenvectors[0]) {
            const principalAxis = pca.eigenvectors[0];
            // Угол главной оси относительно горизонтали
            rotationAngle = -Math.atan2(principalAxis.y, principalAxis.x);
        }
       
        // 6. ПРИМЕНЯЕМ преобразования к каждой точке
        const normalized = centered.map(point => {
            // Масштабирование
            let x = point.x * scale;
            let y = point.y * scale;
           
            // Поворот (делаем главную ось горизонтальной)
            const cos = Math.cos(rotationAngle);
            const sin = Math.sin(rotationAngle);
            const rotatedX = x * cos - y * sin;
            const rotatedY = x * sin + y * cos;
           
            return {
                x: rotatedX,
                y: rotatedY,
                confidence: point.confidence,
                id: point.id
            };
        });
       
        console.log(`🎯 Нормализовано ${normalized.length} узлов (масштаб=${scale.toFixed(4)}, поворот=${(rotationAngle * 180 / Math.PI).toFixed(1)}°)`);
       
        return {
            normalized: normalized.map(n => ({ x: n.x, y: n.y })),
            fullNormalized: normalized,
            params: {
                center,
                scale,
                rotation: rotationAngle,
                meanDistance
            }
        };
    }

    // 20. СРАВНЕНИЕ ГРАФОВЫХ ИНВАРИАНТОВ
    static compareGraphInvariants(invariants1, invariants2) {
        console.log('🔍 TopologyUtils.compareGraphInvariants вызван');
       
        if (!invariants1 || !invariants2) {
            console.log('⚠️ Нет данных для сравнения');
            return 0.5;
        }
       
        let totalScore = 0;
        let factors = 0;
       
        // 1. Сравнение распределения степеней
        if (invariants1.degreeDistribution && invariants2.degreeDistribution) {
            const degreeScore = this.compareHistograms(
                invariants1.degreeDistribution,
                invariants2.degreeDistribution
            );
            totalScore += degreeScore * 0.4;
            factors += 0.4;
            console.log(`   • Распределение степеней: ${(degreeScore * 100).toFixed(1)}%`);
        }
       
        // 2. Сравнение диаметра графа
        if (invariants1.graphDiameter !== null && invariants2.graphDiameter !== null) {
            const diam1 = invariants1.graphDiameter;
            const diam2 = invariants2.graphDiameter;
            const maxDiam = Math.max(diam1, diam2, 1);
            const diamScore = 1 - Math.abs(diam1 - diam2) / maxDiam;
            totalScore += diamScore * 0.3;
            factors += 0.3;
            console.log(`   • Диаметр графа: ${(diamScore * 100).toFixed(1)}% (${diam1} vs ${diam2})`);
        }
       
        // 3. Сравнение коэффициента кластеризации
        if (invariants1.clusteringCoefficient !== null &&
            invariants2.clusteringCoefficient !== null) {
            const cc1 = invariants1.clusteringCoefficient;
            const cc2 = invariants2.clusteringCoefficient;
            const ccScore = 1 - Math.abs(cc1 - cc2);
            totalScore += ccScore * 0.3;
            factors += 0.3;
            console.log(`   • Коэффициент кластеризации: ${(ccScore * 100).toFixed(1)}% (${cc1.toFixed(3)} vs ${cc2.toFixed(3)})`);
        }
       
        const finalScore = factors > 0 ? totalScore / factors : 0.5;
        console.log(`   🎯 Итоговый score: ${(finalScore * 100).toFixed(1)}%`);
       
        return finalScore;
    }

    // 21. СОХРАНЕНИЕ ТОПОЛОГИЧЕСКИХ ДАННЫХ (заглушка)
    static saveTopologyData(footprint, filePath) {
        console.log('💾 Сохранение топологических данных (заглушка)');
        return true;
    }

    // 22. ЗАГРУЗКА ТОПОЛОГИЧЕСКИХ ДАННЫХ (заглушка)
    static loadTopologyData(filePath) {
        console.log('📂 Загрузка топологических данных (заглушка)');
        return null;
    }
}

module.exports = TopologyUtils;
