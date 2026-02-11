// modules/footprint/topology/TopologyBuilder.js
// 🏗️ СТРОИТЕЛЬ ТОПОЛОГИЧЕСКИХ ГРАФОВ С ТРИАНГУЛЯЦИЕЙ ДЕЛОНЕ

class TopologyBuilder {
    constructor(options = {}) {
        this.debug = options.debug || false;
        console.log('🔷 TopologyBuilder создан (чистая топология)');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Построение графа Делоне с треугольниками
    buildDelaunayGraph(points, name = 'graph') {
        console.log(`🔷 Строю граф Делоне "${name}" из ${points.length} точек...`);
       
        const nodes = new Map();
        const edges = new Set();
       
        // 1. Создаем узлы
        points.forEach((point, index) => {
            const nodeId = point.id || `${name}_node_${index}`;
            nodes.set(nodeId, {
    id: nodeId,
    x: point.x,
    y: point.y,
    confidence: point.confidence || 0.5,
    degree: 0,
    source: point.source || name,
    originalData: point,  // ✅ СОХРАНЯЕМ ВСЁ!
   
    // 🔥 ЯВНО СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ
    _originalX: point._originalX || point.x,
    _originalY: point._originalY || point.y,
    _hasOriginalCoordinates: true
});
       
        if (nodes.size < 3) {
            console.log('⚠️ Слишком мало точек для триангуляции Делоне');
            return { nodes, edges, triangles: [], metadata: { source: name } };
        }
       
        // 2. Строим триангуляцию Делоне
        const triangles = this.computeDelaunayTriangulation(points);
       
        // 3. Из треугольников извлекаем рёбра
        const edgeSet = new Set();
        triangles.forEach(triangle => {
            // Добавляем все три ребра треугольника
            for (let i = 0; i < 3; i++) {
                for (let j = i + 1; j < 3; j++) {
                    const edge = this.createEdgeId(triangle[i].id, triangle[j].id);
                    edgeSet.add(edge);
                }
            }
        });
       
        // 4. Добавляем рёбра в граф
        edgeSet.forEach(edge => {
            edges.add(edge);
            // Обновляем степени узлов
            const [nodeA, nodeB] = edge.split('--');
            if (nodes.has(nodeA)) nodes.get(nodeA).degree++;
            if (nodes.has(nodeB)) nodes.get(nodeB).degree++;
        });
       
        // 5. Вычисляем среднюю степень
        let totalDegree = 0;
        for (const node of nodes.values()) {
            totalDegree += node.degree;
        }
        const avgDegree = nodes.size > 0 ? totalDegree / nodes.size : 0;
       
        console.log(`✅ Граф Делоне построен: ${nodes.size} узлов, ${edges.size} рёбер, ${triangles.length} треугольников`);
       
        return {
            nodes,
            edges,
            triangles, // 🔥 НОВОЕ: Сохраняем треугольники
            avgDegree,
            metadata: {
                source: name,
                pointsCount: points.length,
                triangleCount: triangles.length
            }
        };
    }

    // 🔥 ВЫЧИСЛЕНИЕ ТРИАНГУЛЯЦИИ ДЕЛОНЕ (упрощенная реализация)
    computeDelaunayTriangulation(points) {
        if (points.length < 3) return [];
       
        console.log(`🔷 Вычисляю триангуляцию Делоне для ${points.length} точек...`);
       
        // Простая реализация триангуляции Делоне через супертреугольник
        const triangles = [];
       
        // Создаем супертреугольник, содержащий все точки
        const bounds = this.calculateBounds(points);
        const superTriangle = this.createSuperTriangle(bounds);
       
        // Начинаем с супертреугольника
        let triangulation = [superTriangle];
       
        // Постепенно добавляем точки
        for (const point of points) {
            const badTriangles = [];
            const polygon = [];
           
            // Находим "плохие" треугольники (содержащие точку в описанной окружности)
            for (const triangle of triangulation) {
                if (this.pointInCircumcircle(point, triangle)) {
                    badTriangles.push(triangle);
                }
            }
           
            // Находим границу многоугольника
            for (const triangle of badTriangles) {
                for (let i = 0; i < 3; i++) {
                    const edge = [triangle[i], triangle[(i + 1) % 3]];
                    let shared = false;
                   
                    for (const otherTriangle of badTriangles) {
                        if (triangle === otherTriangle) continue;
                        if (this.triangleHasEdge(otherTriangle, edge)) {
                            shared = true;
                            break;
                        }
                    }
                   
                    if (!shared) {
                        polygon.push(edge);
                    }
                }
            }
           
            // Удаляем плохие треугольники
            triangulation = triangulation.filter(t => !badTriangles.includes(t));
           
            // Создаем новые треугольники
            for (const edge of polygon) {
                const newTriangle = [edge[0], edge[1], point];
                triangulation.push(newTriangle);
            }
        }
       
        // Удаляем треугольники, связанные с вершинами супертреугольника
        triangulation = triangulation.filter(triangle => {
            return !this.triangleHasSuperVertex(triangle, superTriangle);
        });
       
        // Преобразуем в формат [{id, x, y}, ...]
        const formattedTriangles = triangulation.map(triangle => {
            return triangle.map(vertex => ({
                id: vertex.id || `node_${vertex.x}_${vertex.y}`,
                x: vertex.x,
                y: vertex.y,
                originalIndex: vertex.originalIndex
            }));
        });
       
        console.log(`✅ Триангуляция Делоне: ${formattedTriangles.length} треугольников`);
        return formattedTriangles;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ТРИАНГУЛЯЦИИ
    calculateBounds(points) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        for (const point of points) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
       
        const width = maxX - minX;
        const height = maxY - minY;
       
        return { minX, maxX, minY, maxY, width, height };
    }

    createSuperTriangle(bounds) {
        const { minX, maxX, minY, maxY, width, height } = bounds;
        const margin = Math.max(width, height) * 0.5;
       
        return [
            { x: minX - margin, y: minY - margin, id: 'super_A' },
            { x: maxX + margin, y: minY - margin, id: 'super_B' },
            { x: minX + width / 2, y: maxY + margin, id: 'super_C' }
        ];
    }

    pointInCircumcircle(point, triangle) {
        // Упрощенная проверка: точка внутри треугольника
        return this.pointInTriangle(point, triangle);
    }

    pointInTriangle(point, triangle) {
        // Проверка через барицентрические координаты
        const [A, B, C] = triangle;
        const v0 = [C.x - A.x, C.y - A.y];
        const v1 = [B.x - A.x, B.y - A.y];
        const v2 = [point.x - A.x, point.y - A.y];
       
        const dot00 = v0[0]*v0[0] + v0[1]*v0[1];
        const dot01 = v0[0]*v1[0] + v0[1]*v1[1];
        const dot02 = v0[0]*v2[0] + v0[1]*v2[1];
        const dot11 = v1[0]*v1[0] + v1[1]*v1[1];
        const dot12 = v1[0]*v2[0] + v1[1]*v2[1];
       
        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
       
        return (u >= 0) && (v >= 0) && (u + v <= 1);
    }

    triangleHasEdge(triangle, edge) {
        const [v1, v2] = edge;
        const vertices = triangle.map(v => `${v.x},${v.y}`);
       
        const v1Str = `${v1.x},${v1.y}`;
        const v2Str = `${v2.x},${v2.y}`;
       
        return vertices.includes(v1Str) && vertices.includes(v2Str);
    }

    triangleHasSuperVertex(triangle, superTriangle) {
        const superVertices = superTriangle.map(v => `${v.x},${v.y}`);
        const triangleVertices = triangle.map(v => `${v.x},${v.y}`);
       
        for (const sv of superVertices) {
            if (triangleVertices.includes(sv)) return true;
        }
        return false;
    }

    createEdgeId(nodeA, nodeB) {
        return [nodeA, nodeB].sort().join('--');
    }

    // 🔥 НОВЫЙ МЕТОД: Найти треугольник, содержащий точку
    findTriangleForPoint(point, triangles) {
        for (const triangle of triangles) {
            if (this.pointInTriangle(point, triangle)) {
                return triangle;
            }
        }
        return null;
    }

    // 🔥 НОВЫЙ МЕТОД: Вычислить барицентрические координаты
    computeBarycentricCoords(point, triangle) {
        const [A, B, C] = triangle;
       
        // Используем формулу через площади
        const areaABC = this.triangleArea(A, B, C);
        const areaPBC = this.triangleArea(point, B, C);
        const areaAPC = this.triangleArea(A, point, C);
        const areaABP = this.triangleArea(A, B, point);
       
        const alpha = areaPBC / areaABC;
        const beta = areaAPC / areaABC;
        const gamma = areaABP / areaABC;
       
        return { alpha, beta, gamma };
    }

    triangleArea(A, B, C) {
        return Math.abs(
            (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y)) / 2
        );
    }

    // 🔥 НОВЫЙ МЕТОД: Визуализация графа (для отладки)
    visualizeGraph(graph, limit = 10) {
        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ ГРАФА "${graph.metadata?.source || 'unknown'}":`);
        console.log(`═`.repeat(50));
       
        console.log(`📊 ОБЩАЯ СТАТИСТИКА:`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Треугольников: ${graph.triangles?.length || 0}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);
       
        if (graph.nodes.size > 0) {
            console.log(`\n📋 ПЕРВЫЕ ${Math.min(limit, graph.nodes.size)} УЗЛОВ:`);
            let count = 0;
            for (const [nodeId, node] of graph.nodes) {
                if (count++ >= limit) break;
                console.log(`   ${nodeId}: (${node.x.toFixed(1)}, ${node.y.toFixed(1)}) | степень: ${node.degree}`);
            }
        }
       
        if (graph.triangles && graph.triangles.length > 0) {
            console.log(`\n🔺 ПЕРВЫЕ ${Math.min(3, graph.triangles.length)} ТРЕУГОЛЬНИКОВ:`);
            graph.triangles.slice(0, 3).forEach((triangle, idx) => {
                const vertices = triangle.map(v => v.id?.substring(0, 10) || '?');
                console.log(`   ${idx + 1}. [${vertices.join(', ')}]`);
            });
        }
       
        console.log(`═`.repeat(50));
    }
}

module.exports = TopologyBuilder;
