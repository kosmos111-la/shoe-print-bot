// modules/footprint/topology/TopologyBuilder.js
// 🎯 ПОСТРОЕНИЕ ГРАФА ДЕЛОНЕ ИЗ ТОЧЕК (ПОЛНАЯ ВЕРСИЯ)

const GeometryUtils = require('./geometry');

class TopologyBuilder {
    constructor(options = {}) {
        this.debug = options.debug || false;
        console.log('🔷 TopologyBuilder создан (чистая топология)');
    }

    // ОСНОВНОЙ МЕТОД: строим граф Делоне из точек
    buildDelaunayGraph(points, name = '') {
        console.log(`🔷 Строю граф Делоне "${name}" из ${points.length} точек...`);

        if (points.length < 3) {
            console.log('⚠️ Слишком мало точек для триангуляции');
            return this.buildMinimalGraph(points);
        }

        // Нормализуем точки (добавляем id если нет)
        const normalizedPoints = points.map((p, idx) => ({
            id: p.id || `pt_${idx}`,
            x: p.x,
            y: p.y,
            originalIndex: idx,
            confidence: p.confidence || 0.5
        }));

        // 1. Находим супер-треугольник (охватывает все точки)
        const superTriangle = this.createSuperTriangle(normalizedPoints);
        const allPoints = [...normalizedPoints, ...superTriangle.points];

        // 2. Инициализируем триангуляцию с супер-треугольником
        let triangles = [superTriangle.triangle];

        // 3. Постепенно добавляем точки (алгоритм Bowyer-Watson)
        for (let i = 0; i < normalizedPoints.length; i++) {
            const point = normalizedPoints[i];

            // Находим "плохие" треугольники, чья описанная окружность содержит точку
            const badTriangles = [];
            const goodTriangles = [];

            for (const triangle of triangles) {
                const [a, b, c] = triangle.map(idx => allPoints[idx]);
                if (GeometryUtils.inCircumcircle(a, b, c, point)) {
                    badTriangles.push(triangle);
                } else {
                    goodTriangles.push(triangle);
                }
            }

            // Находим границу полигона из плохих треугольников
            const polygon = this.findBoundary(badTriangles);

            // Создаем новые треугольники от точки к границе
            const newTriangles = [];
            for (const edge of polygon) {
                newTriangles.push([edge[0], edge[1], i]);
            }

            // Обновляем список треугольников
            triangles = [...goodTriangles, ...newTriangles];

            if (this.debug && i % 10 === 0) {
                console.log(`   Добавлена точка ${i+1}/${normalizedPoints.length}, треугольников: ${triangles.length}`);
            }
        }

        // 4. Удаляем треугольники, содержащие вершины супер-треугольника
        const superIndices = superTriangle.indices;
        triangles = triangles.filter(triangle =>
            !triangle.some(vertex => superIndices.includes(vertex))
        );

        // 5. Преобразуем треугольники в граф (рёбра)
        const graph = this.trianglesToGraph(triangles, normalizedPoints);

        console.log(`✅ Граф Делоне построен: ${graph.nodes.size} узлов, ${graph.edges.size} рёбер`);

        return graph;
    }

    // Создаем супер-треугольник, охватывающий все точки
    createSuperTriangle(points) {
        // Находим границы
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const p of points) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }

        // Расширяем границы для безопасности
        const dx = maxX - minX;
        const dy = maxY - minY;
        const pad = Math.max(dx, dy) * 0.5;

        // Вершины супер-треугольника (далеко за пределами)
        const superPoints = [
            { id: 'super_A', x: minX - dx - pad, y: minY - pad },
            { id: 'super_B', x: maxX + dx + pad, y: minY - pad },
            { id: 'super_C', x: (minX + maxX) / 2, y: maxY + dy + pad }
        ];

        const indices = [points.length, points.length + 1, points.length + 2];

        return {
            points: superPoints,
            indices: indices,
            triangle: indices
        };
    }

    // Находим граничные рёбра в наборе треугольников
    findBoundary(triangles) {
        const edgeCount = new Map();

        // Считаем, сколько раз каждое ребро встречается
        for (const triangle of triangles) {
            const edges = [
                [triangle[0], triangle[1]].sort((a, b) => a - b),
                [triangle[1], triangle[2]].sort((a, b) => a - b),
                [triangle[2], triangle[0]].sort((a, b) => a - b)
            ];

            for (const edge of edges) {
                const key = `${edge[0]},${edge[1]}`;
                edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
            }
        }

        // Граничные рёбра - те, что встречаются только 1 раз
        const boundary = [];
        for (const [key, count] of edgeCount) {
            if (count === 1) {
                const [a, b] = key.split(',').map(Number);
                boundary.push([a, b]);
            }
        }

        return boundary;
    }

    // Преобразуем треугольники в граф (узлы + рёбра)
    trianglesToGraph(triangles, points) {
        const nodes = new Map();
        const edges = new Set();

        // Создаем узлы
        for (const point of points) {
            nodes.set(point.id, {
                id: point.id,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                degree: 0 // Будем считать ниже
            });
        }

        // Создаем рёбра из треугольников
        for (const triangle of triangles) {
            const [aIdx, bIdx, cIdx] = triangle;

            // Получаем реальные id точек (пропускаем супер-треугольник)
            if (aIdx >= points.length || bIdx >= points.length || cIdx >= points.length) {
                continue;
            }

            const a = points[aIdx].id;
            const b = points[bIdx].id;
            const c = points[cIdx].id;

            // Добавляем рёбра (уникальные)
            const edgesToAdd = [
                [a, b].sort().join('--'),
                [b, c].sort().join('--'),
                [c, a].sort().join('--')
            ];

            for (const edge of edgesToAdd) {
                edges.add(edge);
            }
        }

        // Считаем степени узлов
        for (const edge of edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodes.has(nodeA)) nodes.get(nodeA).degree++;
            if (nodes.has(nodeB)) nodes.get(nodeB).degree++;
        }

        // Статистика графа
        const degrees = Array.from(nodes.values()).map(n => n.degree);
        const avgDegree = degrees.reduce((a, b) => a + b, 0) / degrees.length;

        if (this.debug) {
            console.log(`📊 Граф: ${nodes.size} узлов, ${edges.size} рёбер`);
            console.log(`   Средняя степень: ${avgDegree.toFixed(2)}`);
            console.log(`   Макс. степень: ${Math.max(...degrees)}`);
            console.log(`   Мин. степень: ${Math.min(...degrees)}`);
        }

        return {
            nodes: nodes,
            edges: edges,
            triangles: triangles.length,
            avgDegree: avgDegree,
            points: points
        };
    }

    // Минимальный граф для малого количества точек
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

            // Для 2+ точек соединяем их
            if (i > 0) {
                const prevId = points[i-1].id || `pt_${i-1}`;
                edges.add([prevId, id].sort().join('--'));
            }
        }

        // Для 3+ точек замыкаем в треугольник
        if (points.length >= 3) {
            const firstId = points[0].id || `pt_0`;
            const lastId = points[points.length-1].id || `pt_${points.length-1}`;
            edges.add([firstId, lastId].sort().join('--'));
        }

        // Обновляем степени
        for (const edge of edges) {
            const [nodeA, nodeB] = edge.split('--');
            nodes.get(nodeA).degree++;
            nodes.get(nodeB).degree++;
        }

        return {
            nodes: nodes,
            edges: edges,
            triangles: 0,
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

    // Визуализация графа (текстовая, для отладки)
    visualizeGraph(graph, limit = 10) {
        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ ГРАФА (первые ${limit} узлов):`);
        console.log(`═`.repeat(50));

        const nodes = Array.from(graph.nodes.values());
        const edges = Array.from(graph.edges);

        console.log(`📊 Статистика:`);
        console.log(`   Узлов: ${nodes.length}`);
        console.log(`   Рёбер: ${edges.length}`);
        console.log(`   Треугольников: ${graph.triangles || 0}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);

        console.log(`\n📋 Узлы (первые ${Math.min(limit, nodes.length)}):`);
        nodes.slice(0, limit).forEach(node => {
            console.log(`   ${node.id}: (${node.x.toFixed(1)}, ${node.y.toFixed(1)}) | степень: ${node.degree}`);
        });

        console.log(`\n🔗 Рёбра (первые ${Math.min(limit * 2, edges.length)}):`);
        edges.slice(0, limit * 2).forEach(edge => {
            console.log(`   ${edge}`);
        });

        if (nodes.length > limit) {
            console.log(`\n... и еще ${nodes.length - limit} узлов, ${edges.length - limit * 2} рёбер`);
        }

        console.log(`═`.repeat(50));
    }
}

module.exports = TopologyBuilder;
