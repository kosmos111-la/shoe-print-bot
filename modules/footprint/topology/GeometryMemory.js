// modules/footprint/topology/GeometryMemory.js
// 📐 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ - ТОЛЬКО 2 ЛУЧШИХ СОСЕДА

class GeometryMemory {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.relations = new Map();
        console.log('📐 GeometryMemory создана (инвариантная геометрия)');
    }

    rememberNodeGeometry(nodeId, node, neighbors, allNodes, modelNodes) {
        if (this.debug) {
            console.log(`📐 Запоминаю геометрию узла ${nodeId.substring(0, 20)}...`);
        }
       
        const relations = [];
       
        // 1. Ищем ЛУЧШЕЕ отношение "between" (точка между двумя соседями)
        const betweenRelation = this.findBestBetweenRelation(node, neighbors, allNodes);
        if (betweenRelation) {
            relations.push(betweenRelation);
            if (this.debug) {
                console.log(`   📍 Between: ${betweenRelation.points[0].substring(0, 10)}-${betweenRelation.points[1].substring(0, 10)} = ${betweenRelation.ratio.toFixed(2)}`);
            }
        }
       
        // 2. Ищем ЛУЧШИЙ треугольник (барицентрические координаты)
        const triangleRelation = this.findBestTriangleRelation(node, neighbors, allNodes);
        if (triangleRelation) {
            relations.push(triangleRelation);
        }
       
        // Сохраняем только 1-2 САМЫХ ЛУЧШИХ отношения
        const bestRelations = relations
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 2);
       
        if (bestRelations.length > 0) {
            this.relations.set(nodeId, {
                nodeId,
                relations: bestRelations,
                recordedAt: Date.now(),
                neighborCount: neighbors.length
            });
        }
       
        if (this.debug) {
            console.log(`   ✅ Запомнено ${bestRelations.length} отношений`);
        }
       
        return bestRelations;
    }

    findBestBetweenRelation(node, neighbors, allNodes) {
        let bestRelation = null;
        let bestScore = 0;
       
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const a = allNodes.get(neighbors[i]);
                const b = allNodes.get(neighbors[j]);
                if (!a || !b) continue;
               
                if (this.isPointBetween(node, a, b)) {
                    const distA = this.distance(node, a);
                    const distB = this.distance(node, b);
                    const total = distA + distB;
                    if (total < 0.01) continue;
                   
                    const ratio = distA / total;
                    const angle = this.angle(a, node, b);
                    const quality = 1 - Math.abs(180 - angle) / 180;
                    const confidence = 0.7 + quality * 0.3;
                   
                    if (confidence > bestScore) {
                        bestScore = confidence;
                        bestRelation = {
                            type: 'between',
                            points: [neighbors[i], neighbors[j]],
                            ratio: ratio,
                            distance: this.distance(a, b),
                            angle: angle,
                            confidence: confidence
                        };
                    }
                }
            }
        }
       
        return bestRelation;
    }

    findBestTriangleRelation(node, neighbors, allNodes) {
        let bestRelation = null;
        let bestScore = 0;
       
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                for (let k = j + 1; k < neighbors.length; k++) {
                    const a = allNodes.get(neighbors[i]);
                    const b = allNodes.get(neighbors[j]);
                    const c = allNodes.get(neighbors[k]);
                    if (!a || !b || !c) continue;
                   
                    if (this.isPointInTriangle(node, a, b, c)) {
                        const bary = this.calculateBarycentric(node, a, b, c);
                        if (bary.alpha >= 0 && bary.alpha <= 1 &&
                            bary.beta >= 0 && bary.beta <= 1 &&
                            bary.gamma >= 0 && bary.gamma <= 1) {
                           
                            const confidence = 0.8;
                            if (confidence > bestScore) {
                                bestScore = confidence;
                                bestRelation = {
                                    type: 'inside_triangle',
                                    triangle: [neighbors[i], neighbors[j], neighbors[k]],
                                    coordinates: bary,
                                    confidence: confidence
                                };
                            }
                        }
                    }
                }
            }
        }
       
        return bestRelation;
    }

    reconstructPosition(nodeId, modelGraph) {
        const memory = this.relations.get(nodeId);
        if (!memory) return null;
       
        if (this.debug) {
            console.log(`🔄 Восстанавливаю геометрию узла ${nodeId.substring(0, 20)}...`);
        }
       
        let bestPosition = null;
        let bestConfidence = 0;
       
        for (const rel of memory.relations) {
            if (rel.type === 'between') {
                const [aId, bId] = rel.points;
                const a = modelGraph.nodes.get(aId);
                const b = modelGraph.nodes.get(bId);
               
                if (a && b) {
                    const x = a.x + (b.x - a.x) * rel.ratio;
                    const y = a.y + (b.y - a.y) * rel.ratio;
                   
                    if (rel.confidence > bestConfidence) {
                        bestConfidence = rel.confidence;
                        bestPosition = { x, y, method: 'between', confidence: rel.confidence };
                    }
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
                   
                    if (rel.confidence > bestConfidence) {
                        bestConfidence = rel.confidence;
                        bestPosition = { x, y, method: 'barycentric', confidence: rel.confidence };
                    }
                }
            }
        }
       
        if (bestPosition && this.debug) {
            console.log(`   ✅ Восстановлено: (${bestPosition.x.toFixed(1)}, ${bestPosition.y.toFixed(1)}) via ${bestPosition.method}`);
        }
       
        return bestPosition;
    }

    // Геометрические примитивы
    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    angle(p1, p2, p3) {
        const a = this.distance(p1, p2);
        const b = this.distance(p2, p3);
        const c = this.distance(p3, p1);
        return Math.acos((a * a + b * b - c * c) / (2 * a * b)) * 180 / Math.PI;
    }

    isPointBetween(p, a, b) {
        if (Math.abs(this.orientation(a, b, p)) > 0.01) return false;
       
        const dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y);
        if (dot < 0) return false;
       
        const lengthSq = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
        if (dot > lengthSq) return false;
       
        return true;
    }

    orientation(p, q, r) {
        return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    }

    isPointInTriangle(p, a, b, c) {
        const area = 0.5 * (-b.y * c.x + a.y * (-b.x + c.x) + a.x * (b.y - c.y) + b.x * c.y);
        if (Math.abs(area) < 0.001) return false;
       
        const sign = area < 0 ? -1 : 1;
        const s = (a.y * c.x - a.x * c.y + (c.y - a.y) * p.x + (a.x - c.x) * p.y) * sign;
        const t = (a.x * b.y - a.y * b.x + (a.y - b.y) * p.x + (b.x - a.x) * p.y) * sign;
       
        return s > 0 && t > 0 && (s + t) < 2 * Math.abs(area);
    }

    calculateBarycentric(p, a, b, c) {
        const area = 0.5 * (-b.y * c.x + a.y * (-b.x + c.x) + a.x * (b.y - c.y) + b.x * c.y);
        if (Math.abs(area) < 0.001) return { alpha: 0.33, beta: 0.33, gamma: 0.33 };
       
        const areaPBC = 0.5 * (-b.y * c.x + p.y * (-b.x + c.x) + p.x * (b.y - c.y) + b.x * c.y);
        const areaAPC = 0.5 * (-c.y * a.x + p.y * (-c.x + a.x) + p.x * (c.y - a.y) + c.x * a.y);
       
        const alpha = areaPBC / area;
        const beta = areaAPC / area;
        const gamma = 1 - alpha - beta;
       
        return { alpha, beta, gamma };
    }

    export() {
        const data = {};
        for (const [nodeId, memory] of this.relations) {
            data[nodeId] = {
                relations: memory.relations,
                recordedAt: memory.recordedAt,
                neighborCount: memory.neighborCount
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
                recordedAt: memory.recordedAt,
                neighborCount: memory.neighborCount
            });
        }
        console.log(`📥 Импортировано ${Object.keys(data).length} геометрических памяток`);
    }
}

module.exports = GeometryMemory;
