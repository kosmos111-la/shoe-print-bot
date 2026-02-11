// modules/footprint/topology/GeometryMemory.js
// 📐 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ - инвариантные отношения между точками

class GeometryMemory {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.relations = new Map();
        console.log('📐 GeometryMemory создана (инвариантная геометрия)');
    }

    // 🔥 ЗАПОМНИТЬ ГЕОМЕТРИЮ УЗЛА
    rememberNodeGeometry(nodeId, node, neighborIds, allNodes) {
        if (!node || node.x === undefined || node.y === undefined) {
            console.log(`   ⚠️ Невозможно запомнить геометрию: нет координат`);
            return [];
        }
      
        if (this.debug) {
            console.log(`📐 Запоминаю геометрию узла ${nodeId.substring(0, 20)}...`);
        }
      
        const relations = [];
        const neighbors = [];
      
        // Получаем объекты соседей
        neighborIds.forEach(id => {
            const neighbor = allNodes.get(id);
            if (neighbor) neighbors.push(neighbor);
        });
      
        // 1. ОТНОШЕНИЯ С ПАРАМИ СОСЕДЕЙ (между)
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const a = neighbors[i];
                const b = neighbors[j];
              
                const relation = this.calculatePairRelation(node, a, b);
                if (relation) {
                    relations.push({
                        ...relation,
                        points: [a.id, b.id]
                    });
                }
            }
        }
      
        // 2. ПРИНАДЛЕЖНОСТЬ К ТРЕУГОЛЬНИКАМ
        const triangles = this.findEnclosingTriangles(node, Array.from(allNodes.values()));
        triangles.forEach(triangle => {
            const barycentric = this.calculateBarycentric(node, triangle);
            relations.push({
                type: 'inside_triangle',
                triangle: triangle.map(p => p.id),
                coordinates: barycentric,
                confidence: 0.9
            });
        });
      
        // 3. ПОЗИЦИЯ В КЛАСТЕРЕ
        const clusterPosition = this.determineClusterPosition(neighbors);
        relations.push({
            type: 'cluster_position',
            position: clusterPosition.type,
            neighborsCount: neighbors.length,
            borderDistance: clusterPosition.borderDistance,
            confidence: 0.85
        });
      
        // 4. СОХРАНЯЕМ
        this.relations.set(nodeId, {
            nodeId: nodeId,
            relations: relations,
            recordedAt: new Date(),
            originalPosition: { x: node.x, y: node.y },
            neighborCount: neighbors.length
        });
      
        if (this.debug) {
            console.log(`   ✅ Запомнено ${relations.length} отношений`);
        }
      
        return relations;
    }

    // 🔥 РАСЧЁТ ОТНОШЕНИЯ МЕЖДУ ТОЧКОЙ И ПАРОЙ СОСЕДЕЙ
    calculatePairRelation(point, a, b) {
        if (!point || !a || !b) return null;
      
        const isBetween = this.isPointBetween(point, a, b);
        if (isBetween) {
            const distA = this.distance(point, a);
            const distB = this.distance(point, b);
            const total = distA + distB;
          
            return {
                type: 'between',
                ratio: total > 0 ? distA / total : 0.5,
                confidence: 0.95
            };
        }
      
        const orientation = this.orientation(a, b, point);
        if (orientation !== 0) {
            return {
                type: orientation > 0 ? 'left_of' : 'right_of',
                confidence: 0.9
            };
        }
      
        return null;
    }

    // 🔥 ПОИСК ТРЕУГОЛЬНИКОВ, СОДЕРЖАЩИХ ТОЧКУ
    findEnclosingTriangles(point, allNodes) {
        const triangles = [];
      
        for (let i = 0; i < allNodes.length; i++) {
            for (let j = i + 1; j < allNodes.length; j++) {
                for (let k = j + 1; k < allNodes.length; k++) {
                    const a = allNodes[i];
                    const b = allNodes[j];
                    const c = allNodes[k];
                  
                    if (a.id === point.id || b.id === point.id || c.id === point.id) continue;
                    if (!a.x || !b.x || !c.x) continue;
                  
                    if (this.isPointInTriangle(point, a, b, c)) {
                        triangles.push([a, b, c]);
                    }
                }
            }
        }
      
        return triangles;
    }

    // 🔥 ОПРЕДЕЛЕНИЕ ПОЗИЦИИ В КЛАСТЕРЕ
    determineClusterPosition(neighbors) {
        if (neighbors.length === 0) {
            return { type: 'isolated', borderDistance: 1.0 };
        }
        if (neighbors.length === 1) {
            return { type: 'endpoint', borderDistance: 1.0 };
        }
      
        // Простая эвристика: чем больше соседей, тем ближе к центру
        if (neighbors.length >= 6) {
            return { type: 'core', borderDistance: 0.2 };
        } else if (neighbors.length >= 4) {
            return { type: 'inner', borderDistance: 0.5 };
        } else {
            return { type: 'border', borderDistance: 0.8 };
        }
    }

    // 🔥 ВОССТАНОВЛЕНИЕ ПОЗИЦИИ ПО ГЕОМЕТРИЧЕСКОЙ ПАМЯТИ
    reconstructPosition(nodeId, modelGraph) {
        const memory = this.relations.get(nodeId);
        if (!memory) {
            if (this.debug) console.log(`   ⚠️ Нет геометрической памяти для узла`);
            return null;
        }
      
        if (this.debug) {
            console.log(`🔄 Восстанавливаю геометрию узла ${nodeId.substring(0, 20)}...`);
        }
      
        // 1. Пробуем восстановить по between
        for (const rel of memory.relations) {
            if (rel.type === 'between' && rel.points) {
                const [aId, bId] = rel.points;
                const a = modelGraph.nodes.get(aId);
                const b = modelGraph.nodes.get(bId);
              
                if (a && b && a.x !== undefined && b.x !== undefined) {
                    const x = a.x + (b.x - a.x) * rel.ratio;
                    const y = a.y + (b.y - a.y) * rel.ratio;
                    return { x, y, method: 'between', confidence: rel.confidence };
                }
            }
          
            // 2. Пробуем восстановить по треугольнику
            if (rel.type === 'inside_triangle' && rel.triangle) {
                const [aId, bId, cId] = rel.triangle;
                const a = modelGraph.nodes.get(aId);
                const b = modelGraph.nodes.get(bId);
                const c = modelGraph.nodes.get(cId);
              
                if (a && b && c && a.x && b.x && c.x) {
                    const { alpha, beta, gamma } = rel.coordinates;
                    const x = a.x * alpha + b.x * beta + c.x * gamma;
                    const y = a.y * alpha + b.y * beta + c.y * gamma;
                    return { x, y, method: 'barycentric', confidence: rel.confidence };
                }
            }
        }
      
        // 3. Фолбэк - оригинальная позиция
        if (memory.originalPosition) {
            return {
                x: memory.originalPosition.x,
                y: memory.originalPosition.y,
                method: 'original_position',
                confidence: 0.7
            };
        }
      
        return null;
    }

    // 🔥 ГЕОМЕТРИЧЕСКИЕ ПРИМИТИВЫ
    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    orientation(p, q, r) {
        return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    }

    isPointBetween(p, a, b) {
        if (Math.abs(this.orientation(a, b, p)) > 1e-10) return false;
      
        const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
        if (dot < 0) return false;
      
        const lengthSq = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
        if (dot > lengthSq) return false;
      
        return true;
    }

    isPointInTriangle(p, a, b, c) {
        const area = 0.5 * (-b.y * c.x + a.y * (-b.x + c.x) + a.x * (b.y - c.y) + b.x * c.y);
        const sign = area < 0 ? -1 : 1;
      
        const s = (a.y * c.x - a.x * c.y + (c.y - a.y) * p.x + (a.x - c.x) * p.y) * sign;
        const t = (a.x * b.y - a.y * b.x + (a.y - b.y) * p.x + (b.x - a.x) * p.y) * sign;
      
        return s > 0 && t > 0 && (s + t) < 2 * area * sign;
    }

    calculateBarycentric(p, triangle) {
        const [a, b, c] = triangle;
      
        const area = 0.5 * (-b.y * c.x + a.y * (-b.x + c.x) + a.x * (b.y - c.y) + b.x * c.y);
        const areaPBC = 0.5 * (-b.y * c.x + p.y * (-b.x + c.x) + p.x * (b.y - c.y) + b.x * c.y);
        const areaAPC = 0.5 * (-c.y * a.x + p.y * (-c.x + a.x) + p.x * (c.y - a.y) + c.x * a.y);
      
        const alpha = areaPBC / area;
        const beta = areaAPC / area;
        const gamma = 1 - alpha - beta;
      
        return { alpha, beta, gamma };
    }

    // 🔥 ПОЛУЧИТЬ СОСЕДЕЙ УЗЛА
    getNeighbors(nodeId, nodesMap) {
        const neighbors = [];
        const node = nodesMap.get(nodeId);
        if (!node || !node.degree) return neighbors;
      
        // В реальности нужно получать из графа
        // Здесь упрощённая заглушка
        return neighbors;
    }

    // 🔥 ЭКСПОРТ
    export() {
        const data = {};
        for (const [nodeId, memory] of this.relations) {
            data[nodeId] = {
                relations: memory.relations,
                recordedAt: memory.recordedAt,
                originalPosition: memory.originalPosition,
                neighborCount: memory.neighborCount
            };
        }
        return data;
    }

    // 🔥 ИМПОРТ
    import(data) {
        if (!data) return;
        let count = 0;
        for (const [nodeId, memory] of Object.entries(data)) {
            this.relations.set(nodeId, {
                nodeId,
                relations: memory.relations,
                recordedAt: new Date(memory.recordedAt),
                originalPosition: memory.originalPosition,
                neighborCount: memory.neighborCount
            });
            count++;
        }
        console.log(`📥 Импортировано ${count} геометрических памяток`);
    }
}

module.exports = GeometryMemory;
