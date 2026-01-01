// modules/footprint/transformation-manager.js - НОВЫЙ ФАЙЛ!
class TransformationManager {
    constructor() {
        this.transformations = new Map(); // footprintId -> transformation
    }
   
    // 🔥 ОСНОВНОЙ МЕТОД: Найти трансформацию между двумя графами в ИНВАРИАНТНОМ ПРОСТРАНСТВЕ
    findTransformationInInvariantSpace(graph1, graph2) {
        console.log('🔄 Ищу трансформацию в инвариантном пространстве...');
       
        // 1. Строим инвариантные дескрипторы
        const invariants1 = this.buildInvariantDescriptors(graph1);
        const invariants2 = this.buildInvariantDescriptors(graph2);
       
        // 2. Находим соответствия между дескрипторами
        const correspondences = this.matchInvariantDescriptors(invariants1, invariants2);
       
        if (correspondences.length < 3) {
            console.log('⚠️ Недостаточно соответствий для вычисления трансформации');
            return null;
        }
       
        // 3. Вычисляем трансформацию из соответствий
        const transformation = this.computeTransformationFromCorrespondences(
            correspondences, graph1, graph2
        );
       
        console.log(`✅ Найдена трансформация: `);
        console.log(`   - Масштаб: ${transformation.scale.toFixed(4)}`);
        console.log(`   - Поворот: ${transformation.rotation.toFixed(2)}°`);
        console.log(`   - Смещение: (${transformation.dx.toFixed(1)}, ${transformation.dy.toFixed(1)})`);
        console.log(`   - Ошибка: ${transformation.error.toFixed(4)}`);
       
        return transformation;
    }
   
    // 🔥 Строим инвариантные дескрипторы (не зависят от поворота/масштаба)
    buildInvariantDescriptors(graph) {
        const nodes = Array.from(graph.nodes.values());
        const descriptors = [];
       
        // Для каждого узла строим локальный дескриптор на основе соседей
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const descriptor = {
                nodeId: node.id,
                invariantVector: this.buildLocalInvariantVector(node, nodes, graph),
                neighbors: this.getNeighborDistances(node, nodes),
                angles: this.getAngleDistribution(node, nodes)
            };
            descriptors.push(descriptor);
        }
       
        return descriptors;
    }
   
    // 🔥 Вектор локальных инвариантов (относительные расстояния и углы)
    buildLocalInvariantVector(centerNode, allNodes, graph) {
        // Находим K ближайших соседей
        const k = Math.min(8, allNodes.length - 1);
        const neighbors = this.getKNearestNeighbors(centerNode, allNodes, k);
       
        // Строим инвариантный вектор:
        // 1. Относительные расстояния между соседями (нормализованные)
        // 2. Углы между векторами к соседям
        // 3. Топологические свойства
       
        const vector = [];
       
        // Отношения расстояний (инвариантно к масштабу)
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const dist1 = this.distance(centerNode, neighbors[i]);
                const dist2 = this.distance(centerNode, neighbors[j]);
                vector.push(dist1 / Math.max(1, dist2));
            }
        }
       
        // Углы между соседями (инвариантно к повороту)
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                for (let k = j + 1; k < neighbors.length; k++) {
                    const angle = this.computeInvariantAngle(
                        centerNode, neighbors[i], neighbors[j], neighbors[k]
                    );
                    vector.push(angle);
                }
            }
        }
       
        return vector;
    }
   
    // 🔥 Угол, инвариантный к повороту и масштабу
    computeInvariantAngle(center, p1, p2, p3) {
        // Векторы от центра к точкам
        const v1 = { x: p1.x - center.x, y: p1.y - center.y };
        const v2 = { x: p2.x - center.x, y: p2.y - center.y };
        const v3 = { x: p3.x - center.x, y: p3.y - center.y };
       
        // Нормализуем (делаем инвариантными к масштабу)
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        const len3 = Math.sqrt(v3.x * v3.x + v3.y * v3.y);
       
        if (len1 === 0 || len2 === 0 || len3 === 0) return 0;
       
        const nv1 = { x: v1.x / len1, y: v1.y / len1 };
        const nv2 = { x: v2.x / len2, y: v2.y / len2 };
        const nv3 = { x: v3.x / len3, y: v3.y / len3 };
       
        // Угол между нормализованными векторами
        const dot12 = nv1.x * nv2.x + nv1.y * nv2.y;
        const dot13 = nv1.x * nv3.x + nv1.y * nv3.y;
       
        return Math.acos(Math.max(-1, Math.min(1, dot12))) -
               Math.acos(Math.max(-1, Math.min(1, dot13)));
    }
   
    // 🔥 Вычисляем трансформацию из соответствий
    computeTransformationFromCorrespondences(correspondences, graph1, graph2) {
        // Используем метод наименьших квадратов для аффинной трансформации
        const n = correspondences.length;
       
        if (n < 3) {
            return { scale: 1, rotation: 0, dx: 0, dy: 0, error: Infinity };
        }
       
        // Матрицы для решения системы уравнений
        let sumX1 = 0, sumY1 = 0, sumX2 = 0, sumY2 = 0;
        let sumX1X2 = 0, sumY1X2 = 0, sumX1Y2 = 0, sumY1Y2 = 0;
        let sumX1Sq = 0, sumY1Sq = 0;
       
        correspondences.forEach(corr => {
            const p1 = corr.point1;
            const p2 = corr.point2;
           
            sumX1 += p1.x;
            sumY1 += p1.y;
            sumX2 += p2.x;
            sumY2 += p2.y;
            sumX1X2 += p1.x * p2.x;
            sumY1X2 += p1.y * p2.x;
            sumX1Y2 += p1.x * p2.y;
            sumY1Y2 += p1.y * p2.y;
            sumX1Sq += p1.x * p1.x;
            sumY1Sq += p1.y * p1.y;
        });
       
        // Решаем для аффинной трансформации: [x2, y2] = M * [x1, y1] + T
        const det = sumX1Sq * sumY1Sq - 0; // Упрощённо
       
        if (Math.abs(det) < 1e-10) {
            return { scale: 1, rotation: 0, dx: 0, dy: 0, error: Infinity };
        }
       
        // Вычисляем матрицу M и вектор T
        const a = (sumX1X2 * sumY1Sq - sumY1X2 * 0) / det;
        const b = (sumY1X2 * sumX1Sq - sumX1X2 * 0) / det;
        const c = (sumX1Y2 * sumY1Sq - sumY1Y2 * 0) / det;
        const d = (sumY1Y2 * sumX1Sq - sumX1Y2 * 0) / det;
       
        const tx = (sumX2 - a * sumX1 - c * sumY1) / n;
        const ty = (sumY2 - b * sumX1 - d * sumY1) / n;
       
        // Извлекаем масштаб и поворот из матрицы M
        const scale = Math.sqrt(a * a + b * b); // Средний масштаб
        const rotation = Math.atan2(b, a) * 180 / Math.PI;
       
        // Вычисляем ошибку
        let error = 0;
        correspondences.forEach(corr => {
            const p1 = corr.point1;
            const p2 = corr.point2;
           
            const transformedX = a * p1.x + c * p1.y + tx;
            const transformedY = b * p1.x + d * p1.y + ty;
           
            const dx = transformedX - p2.x;
            const dy = transformedY - p2.y;
            error += dx * dx + dy * dy;
        });
        error = Math.sqrt(error / n);
       
        return {
            scale: scale,
            rotation: rotation,
            dx: tx,
            dy: ty,
            matrix: { a, b, c, d },
            error: error,
            confidence: Math.exp(-error / 10) // Чем меньше ошибка, тем выше уверенность
        };
    }
   
    // 🔥 Применить трансформацию к графу
    applyTransformationToGraph(graph, transformation) {
        if (!transformation || transformation.error > 50) {
            return graph; // Не применяем плохие трансформации
        }
       
        const transformedGraph = graph.clone();
        const { a, b, c, d, dx, dy } = transformation.matrix;
       
        transformedGraph.nodes.forEach((node, nodeId) => {
            const x = node.x;
            const y = node.y;
           
            node.transformedX = a * x + c * y + dx;
            node.transformedY = b * x + d * y + dy;
           
            // Для обратной совместимости
            node.x = node.transformedX;
            node.y = node.transformedY;
        });
       
        return transformedGraph;
    }
   
    // Вспомогательные методы
    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
   
    getKNearestNeighbors(center, nodes, k) {
        return nodes
            .filter(n => n !== center)
            .map(n => ({ node: n, dist: this.distance(center, n) }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, k)
            .map(item => item.node);
    }
}

module.exports = TransformationManager;
