// modules/footprint/topology/GeometryMemory.js
// 📐 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ - инвариантные отношения между точками

class GeometryMemory {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.relations = new Map();
        console.log('📐 GeometryMemory создана (инвариантная геометрия)');
    }

    // 🔥 ЗАПОМИНАНИЕ ГЕОМЕТРИИ
    rememberNodeGeometry(nodeId, node, neighbors, allNodes) {
        if (this.debug) {
            console.log(`📐 Запоминаю геометрию узла ${nodeId.substring(0, 20)}...`);
        }
       
        const relations = [];
       
        // Отношения с парами соседей
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const a = neighbors[i];
                const b = neighbors[j];
               
                const relation = this.calculatePairRelation(nodeId, node, a, b, allNodes);
                if (relation) {
                    relations.push(relation);
                }
            }
        }
       
        // Барицентрические координаты
        const triangles = this.findEnclosingTriangles(nodeId, node, allNodes);
        triangles.forEach(triangle => {
            const barycentric = this.calculateBarycentric(node, triangle);
            relations.push({
                type: 'inside_triangle',
                triangle: triangle.map(p => p.id),
                coordinates: barycentric,
                confidence: 0.9
            });
        });
       
        // Позиция в кластере
        const clusterPosition = this.determineClusterPosition(nodeId, neighbors, allNodes);
        relations.push({
            type: 'cluster_position',
            position: clusterPosition.type,
            neighborsCount: neighbors.length,
            borderDistance: clusterPosition.borderDistance,
            confidence: 0.85
        });
       
        this.relations.set(nodeId, {
            nodeId: nodeId,
            relations: relations,
            recordedAt: new Date(),
            sourceGraph: allNodes.size
        });
       
        if (this.debug) {
            console.log(`   ✅ Запомнено ${relations.length} геометрических отношений`);
        }
       
        return relations;
    }

    calculatePairRelation(nodeId, node, aId, bId, allNodes) {
        const a = allNodes.get(aId);
        const b = allNodes.get(bId);
        if (!a || !b) return null;
       
        const isBetween = this.isPointBetween(node, a, b);
        if (isBetween) {
            const distA = this.distance(node, a);
            const distB = this.distance(node, b);
            const total = distA + distB;
           
            return {
                type: 'between',
                points: [aId, bId],
                ratio: total > 0 ? distA / total : 0.5,
                confidence: 0.95
            };
        }
       
        const orientation = this.orientation(a, b, node);
        if (orientation !== 0) {
            return {
                type: orientation > 0 ? 'left_of' : 'right_of',
                vector: [aId, bId],
                confidence: 0.9
            };
        }
       
        return null;
    }

    findEnclosingTriangles(nodeId, node, allNodes) {
        const triangles = [];
        const nodes = Array.from(allNodes.values());
       
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                for (let k = j + 1; k < nodes.length; k++) {
                    const a = nodes[i];
                    const b = nodes[j];
                    const c = nodes[k];
                   
                    if (a.id === nodeId || b.id === nodeId || c.id === nodeId) continue;
                   
                    if (this.isPointInTriangle(node, a, b, c)) {
                        triangles.push([a, b, c]);
                    }
                }
            }
        }
       
        return triangles;
    }

    determineClusterPosition(nodeId, neighbors, allNodes) {
        if (neighbors.length === 0) {
            return { type: 'isolated', borderDistance: 1.0 };
        }
       
        if (neighbors.length === 1) {
            return { type: 'endpoint', borderDistance: 1.0 };
        }
       
        let missingConnections = 0;
        let totalPairs = (neighbors.length * (neighbors.length - 1)) / 2;
       
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const a = neighbors[i];
                const b = neighbors[j];
                if (!this.areNodesConnected(a, b, allNodes)) {
                    missingConnections++;
                }
            }
        }
       
        const borderScore = missingConnections / Math.max(1, totalPairs);
       
        if (borderScore > 0.6) {
            return { type: 'border', borderDistance: borderScore };
        } else if (borderScore < 0.2) {
            return { type: 'core', borderDistance: borderScore };
        } else {
            return { type: 'inner', borderDistance: borderScore };
        }
    }

    // 🔥 ВОССТАНОВЛЕНИЕ ПО ГЕОМЕТРИЧЕСКОЙ ПАМЯТИ
    reconstructPosition(nodeId, modelGraph) {
        const memory = this.relations.get(nodeId);
        if (!memory) return null;
       
        let candidates = [];
       
        memory.relations.forEach(rel => {
            if (rel.type === 'between') {
                const [aId, bId] = rel.points;
                const a = modelGraph.nodes.get(aId);
                const b = modelGraph.nodes.get(bId);
               
                if (a && b) {
                    const x = a.x + (b.x - a.x) * rel.ratio;
                    const y = a.y + (b.y - a.y) * rel.ratio;
                    candidates.push({ x, y, confidence: rel.confidence, method: 'between' });
                }
            }
           
            if (rel.type === 'inside_triangle') {
                const [aId, bId, cId] = rel.triangle;
                const a = modelGraph.nodes.get(aId);
                const b = modelGraph.nodes.get(bId);
                const c = modelGraph.nodes.get(cId);
               
                if (a && b && c) {
                    const { alpha, beta, gamma } = rel.coordinates;
                    const x = a.x * alpha + b.x * beta + c.x * gamma;
                    const y = a.y * alpha + b.y * beta + c.y * gamma;
                    candidates.push({ x, y, confidence: rel.confidence, method: 'barycentric' });
                }
            }
        });
       
        if (candidates.length > 0) {
            candidates.sort((a, b) => b.confidence - a.confidence);
            return candidates[0];
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

    areNodesConnected(aId, bId, allNodes) {
        // Заглушка - в реальности нужно проверять граф
        return false;
    }

    export() {
        const data = {};
        for (const [nodeId, memory] of this.relations) {
            data[nodeId] = {
                relations: memory.relations,
                recordedAt: memory.recordedAt
            };
        }
        return data;
    }

    import(data) {
        if (!data) return;
        for (const [nodeId, memory] of Object.entries(data)) {
            this.relations.set(nodeId, {
                nodeId,
                relations: memory.relations,
                recordedAt: new Date(memory.recordedAt)
            });
        }
        console.log(`📥 Импортировано ${Object.keys(data).length} геометрических памяток`);
    }
}

module.exports = GeometryMemory;
