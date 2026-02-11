// modules/footprint/topology/TopologyBuilder.js
// 🏗️ СТРОИТЕЛЬ ТОПОЛОГИЧЕСКИХ ГРАФОВ С ТРИАНГУЛЯЦИЕЙ ДЕЛОНЕ
// 🔥 ИСПРАВЛЕНО: СОХРАНЕНИЕ ОРИГИНАЛЬНЫХ КООРДИНАТ ДЛЯ ГЕОМЕТРИЧЕСКОЙ ПАМЯТИ

class TopologyBuilder {
    constructor(options = {}) {
        this.debug = options.debug || false;
        console.log('🔷 TopologyBuilder создан (чистая топология + геометрическая память)');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Построение графа Делоне с сохранением геометрии
    buildDelaunayGraph(points, name = 'graph') {
        console.log(`🔷 Строю граф Делоне "${name}" из ${points.length} точек...`);
       
        const nodes = new Map();
        const edges = new Set();
       
        // 1. Создаем узлы с ПОЛНЫМ сохранением геометрических данных
        points.forEach((point, index) => {
            const nodeId = point.id || `${name}_node_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
           
            // 🔥 ВАЖНО: Сохраняем ВСЕ геометрические данные!
            nodes.set(nodeId, {
                // Базовая информация
                id: nodeId,
                x: point.x,
                y: point.y,
                confidence: point.confidence || 0.5,
                degree: 0,
                source: point.source || name,
               
                // 📐 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ - ОРИГИНАЛЬНЫЕ КООРДИНАТЫ ИЗ ФОТО
                _originalX: point._originalX !== undefined ? point._originalX : point.x,
                _originalY: point._originalY !== undefined ? point._originalY : point.y,
                _originalPoints: point._originalPoints || [],
                _hasOriginalCoordinates: true,
                _photoId: point.photoId || point.originalPhotoId || 'unknown',
               
                // 📐 ПОЛНЫЕ ДАННЫЕ ДЛЯ ГЕОМЕТРИЧЕСКОЙ ПАМЯТИ
                originalData: {
                    x: point.x,
                    y: point.y,
                    confidence: point.confidence,
                    source: point.source,
                    photoId: point.photoId,
                    originalPhotoId: point.originalPhotoId,
                    originalIndex: point.originalIndex,
                    originalPoints: point.originalPoints || point._originalPoints || [],
                    note: point.note
                },
               
                // 🔥 ДОПОЛНИТЕЛЬНЫЕ МЕТАДАННЫЕ
                metadata: {
                    extractedAt: Date.now(),
                    sourceType: point.source || 'unknown',
                    isProtector: true,
                    polygonPoints: point.originalPoints ? point.originalPoints.length : 0
                }
            });
           
            if (this.debug && nodes.size <= 3) {
                console.log(`   📍 Узел ${nodeId.substring(0, 20)}...`);
                console.log(`      координаты: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
                console.log(`      оригинал: (${(point._originalX || point.x).toFixed(1)}, ${(point._originalY || point.y).toFixed(1)})`);
                console.log(`      уверенность: ${(point.confidence || 0.5).toFixed(3)}`);
            }
        });
       
        if (nodes.size < 3) {
            console.log('⚠️ Слишком мало точек для триангуляции Делоне');
            return {
                nodes,
                edges,
                triangles: [],
                metadata: {
                    source: name,
                    geometryPreserved: nodes.size
                }
            };
        }
       
        // 2. Строим триангуляцию Делоне
        const triangles = this.computeDelaunayTriangulation(points);
       
        // 3. Из треугольников извлекаем рёбра
        const edgeSet = new Set();
        triangles.forEach(triangle => {
            for (let i = 0; i < 3; i++) {
                for (let j = i + 1; j < 3; j++) {
                    const edge = this.createEdgeId(triangle[i].id, triangle[j].id);
                    edgeSet.add(edge);
                }
            }
        });
       
        // 4. Добавляем рёбра в граф и обновляем степени
        edgeSet.forEach(edge => {
            edges.add(edge);
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
       
        console.log(`✅ Граф Делоне построен:`);
        console.log(`   Узлов: ${nodes.size}`);
        console.log(`   Рёбер: ${edges.size}`);
        console.log(`   Треугольников: ${triangles.length}`);
        console.log(`   📐 Оригинальные координаты сохранены: ${nodes.size}/${nodes.size}`);
       
        return {
            nodes,
            edges,
            triangles,
            avgDegree,
            metadata: {
                source: name,
                pointsCount: points.length,
                triangleCount: triangles.length,
                geometryPreserved: nodes.size,
                timestamp: Date.now()
            }
        };
    }

    // 🔥 ВЫЧИСЛЕНИЕ ТРИАНГУЛЯЦИИ ДЕЛОНЕ
    computeDelaunayTriangulation(points) {
        if (points.length < 3) return [];
       
        if (this.debug) {
            console.log(`🔷 Вычисляю триангуляцию Делоне для ${points.length} точек...`);
        }
       
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
           
            // Находим "плохие" треугольники
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
       
        // Удаляем треугольники с вершинами супертреугольника
        triangulation = triangulation.filter(triangle => {
            return !this.triangleHasSuperVertex(triangle, superTriangle);
        });
       
        // Преобразуем в формат с ID
        const formattedTriangles = triangulation.map(triangle => {
            return triangle.map(vertex => ({
                id: vertex.id || `node_${vertex.x}_${vertex.y}_${Date.now()}`,
                x: vertex.x,
                y: vertex.y,
                originalIndex: vertex.originalIndex
            }));
        });
       
        if (this.debug) {
            console.log(`   ✅ Триангуляция Делоне: ${formattedTriangles.length} треугольников`);
        }
       
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
            {
                x: minX - margin,
                y: minY - margin,
                id: `super_A_${Date.now()}`
            },
            {
                x: maxX + margin,
                y: minY - margin,
                id: `super_B_${Date.now()}`
            },
            {
                x: minX + width / 2,
                y: maxY + margin,
                id: `super_C_${Date.now()}`
            }
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

    // 🔥 НОВЫЙ МЕТОД: Получить оригинальные координаты узла
    getOriginalCoordinates(node) {
        if (node._originalX !== undefined && node._originalY !== undefined) {
            return {
                x: node._originalX,
                y: node._originalY,
                source: 'original_saved'
            };
        }
        if (node.originalData && node.originalData.x !== undefined && node.originalData.y !== undefined) {
            return {
                x: node.originalData.x,
                y: node.originalData.y,
                source: 'original_data'
            };
        }
        if (node.x !== undefined && node.y !== undefined) {
            return {
                x: node.x,
                y: node.y,
                source: 'current_position'
            };
        }
        return null;
    }

    // 🔥 НОВЫЙ МЕТОД: Проверить сохранение геометрии
    verifyGeometryPreservation(graph) {
        let originalCount = 0;
        let totalCount = graph.nodes.size;
       
        for (const node of graph.nodes.values()) {
            if (node._originalX !== undefined ||
                (node.originalData && node.originalData.x !== undefined)) {
                originalCount++;
            }
        }
       
        console.log(`📐 Проверка геометрической памяти:`);
        console.log(`   Всего узлов: ${totalCount}`);
        console.log(`   С оригинальными координатами: ${originalCount} (${((originalCount/totalCount)*100).toFixed(1)}%)`);
       
        return {
            total: totalCount,
            preserved: originalCount,
            ratio: originalCount / Math.max(1, totalCount)
        };
    }

    // 🔥 ВИЗУАЛИЗАЦИЯ ГРАФА С ГЕОМЕТРИЧЕСКОЙ ДИАГНОСТИКОЙ
    visualizeGraph(graph, limit = 10) {
        console.log(`\n🔷 ВИЗУАЛИЗАЦИЯ ГРАФА "${graph.metadata?.source || 'unknown'}":`);
        console.log(`═`.repeat(60));
       
        console.log(`📊 ОБЩАЯ СТАТИСТИКА:`);
        console.log(`   Узлов: ${graph.nodes.size}`);
        console.log(`   Рёбер: ${graph.edges.size}`);
        console.log(`   Треугольников: ${graph.triangles?.length || 0}`);
        console.log(`   Средняя степень: ${graph.avgDegree?.toFixed(2) || '?'}`);
       
        // 🔥 ДИАГНОСТИКА ГЕОМЕТРИЧЕСКОЙ ПАМЯТИ
        this.verifyGeometryPreservation(graph);
       
        if (graph.nodes.size > 0) {
            console.log(`\n📋 ПЕРВЫЕ ${Math.min(limit, graph.nodes.size)} УЗЛОВ (с геометрией):`);
            let count = 0;
            for (const [nodeId, node] of graph.nodes) {
                if (count++ >= limit) break;
               
                const originalCoords = this.getOriginalCoordinates(node);
                const hasOriginal = originalCoords !== null;
               
                console.log(`   ${nodeId.substring(0, 20)}...`);
                console.log(`      текущие: (${node.x.toFixed(1)}, ${node.y.toFixed(1)})`);
                if (hasOriginal) {
                    console.log(`      📐 оригинал: (${originalCoords.x.toFixed(1)}, ${originalCoords.y.toFixed(1)}) [${originalCoords.source}]`);
                } else {
                    console.log(`      ⚠️ оригинал: НЕ СОХРАНЁН`);
                }
                console.log(`      степень: ${node.degree}, уверенность: ${node.confidence?.toFixed(3) || '?'}`);
            }
        }
       
        console.log(`═`.repeat(60));
    }
}

module.exports = TopologyBuilder;
