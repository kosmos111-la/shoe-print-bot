// modules/footprint/topology/TopologyBuilder.js
// 🏗️ СТРОИТЕЛЬ ТОПОЛОГИЧЕСКИХ ГРАФОВ

class TopologyBuilder {
    constructor(options = {}) {
        this.debug = options.debug || false;
        console.log('🔷 TopologyBuilder создан (чистая топология + геометрическая память)');
    }

    buildDelaunayGraph(points, name = 'graph') {
        if (this.debug) {
            console.log(`🔷 Строю граф Делоне "${name}" из ${points.length} точек...`);
        }
       
        const nodes = new Map();
        const edges = new Set();
       
        // Создаем узлы с сохранением ВСЕХ данных
        points.forEach((point, index) => {
            const nodeId = point.id || `${name}_node_${index}`;
           
            const node = {
                id: nodeId,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                degree: 0,
                source: point.source || name,
               
                // 🔥 КЛЮЧЕВОЕ: СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ ИЗ ФОТО
                _originalX: point._originalX || point.x,
                _originalY: point._originalY || point.y,
                _hasOriginalCoordinates: !!(point._originalX || point._originalY),
               
                originalData: point
            };
           
            nodes.set(nodeId, node);
        });
       
        if (nodes.size < 3) {
            return { nodes, edges, triangles: [], metadata: { source: name } };
        }
       
        // Строим триангуляцию Делоне
        const triangles = this.computeDelaunayTriangulation(points);
       
        // Из треугольников извлекаем рёбра
        const edgeSet = new Set();
        triangles.forEach(triangle => {
            for (let i = 0; i < 3; i++) {
                for (let j = i + 1; j < 3; j++) {
                    const edge = this.createEdgeId(triangle[i].id, triangle[j].id);
                    edgeSet.add(edge);
                }
            }
        });
       
        // Добавляем рёбра в граф
        edgeSet.forEach(edge => {
            edges.add(edge);
            const [nodeA, nodeB] = edge.split('--');
            if (nodes.has(nodeA)) nodes.get(nodeA).degree++;
            if (nodes.has(nodeB)) nodes.get(nodeB).degree++;
        });
       
        // Вычисляем среднюю степень
        let totalDegree = 0;
        for (const node of nodes.values()) totalDegree += node.degree;
        const avgDegree = nodes.size > 0 ? totalDegree / nodes.size : 0;
       
        if (this.debug) {
            console.log(`✅ Граф Делоне построен:`);
            console.log(`   Узлов: ${nodes.size}`);
            console.log(`   Рёбер: ${edges.size}`);
            console.log(`   Треугольников: ${triangles.length}`);
            console.log(`   📐 Оригинальные координаты сохранены: ${Array.from(nodes.values()).filter(n => n._hasOriginalCoordinates).length}/${nodes.size}`);
        }
       
        return {
            nodes,
            edges,
            triangles,
            avgDegree,
            metadata: {
                source: name,
                pointsCount: points.length,
                triangleCount: triangles.length
            }
        };
    }

    computeDelaunayTriangulation(points) {
        if (points.length < 3) return [];
       
        const triangles = [];
        const bounds = this.calculateBounds(points);
        const superTriangle = this.createSuperTriangle(bounds);
       
        let triangulation = [superTriangle];
       
        for (const point of points) {
            const badTriangles = [];
            const polygon = [];
           
            for (const triangle of triangulation) {
                if (this.pointInCircumcircle(point, triangle)) {
                    badTriangles.push(triangle);
                }
            }
           
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
           
            triangulation = triangulation.filter(t => !badTriangles.includes(t));
           
            for (const edge of polygon) {
                const newTriangle = [edge[0], edge[1], point];
                triangulation.push(newTriangle);
            }
        }
       
        triangulation = triangulation.filter(triangle => {
            return !this.triangleHasSuperVertex(triangle, superTriangle);
        });
       
        return triangulation.map(triangle => {
            return triangle.map(vertex => ({
                id: vertex.id || `node_${vertex.x}_${vertex.y}`,
                x: vertex.x,
                y: vertex.y,
                originalIndex: vertex.originalIndex
            }));
        });
    }

    calculateBounds(points) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
       
        for (const point of points) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
       
        return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
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
        return this.pointInTriangle(point, triangle);
    }

    pointInTriangle(point, triangle) {
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
}

module.exports = TopologyBuilder;
