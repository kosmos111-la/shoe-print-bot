// modules/footprint/topology/HierarchicalTriangulation.js
// 🔺 ИЕРАРХИЧЕСКАЯ ТРИАНГУЛЯЦИЯ - ВОССТАНОВЛЕНИЕ ПО МАЯКАМ

const { TrustLevelManager, TRUST_LEVELS } = require('./TrustLevel');

class HierarchicalTriangulation {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.trustManager = new TrustLevelManager({ debug: this.debug });
       
        // Хранилище треугольников для каждой точки
        this.triangleMemory = new Map(); // nodeId -> { triangle, barycentric, anchors }
       
        console.log('🔺 HierarchicalTriangulation создана (восстановление по маякам)');
    }

    // 🔥 ЗАПОМНИТЬ ТРЕУГОЛЬНИК ДЛЯ ТОЧКИ
    rememberTriangle(nodeId, node, newGraph, structuralMapping, modelGraph) {
        if (this.debug) {
            console.log(`🔺 Запоминаю треугольник для ${nodeId.substring(0, 20)}...`);
        }

        // Получаем всех соседей, которые есть в маппинге
        const neighbors = [];
        for (const edge of newGraph.edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodeA === nodeId && structuralMapping.has(nodeB)) {
                neighbors.push({
                    id: structuralMapping.get(nodeB),
                    node: newGraph.nodes.get(nodeB)
                });
            } else if (nodeB === nodeId && structuralMapping.has(nodeA)) {
                neighbors.push({
                    id: structuralMapping.get(nodeA),
                    node: newGraph.nodes.get(nodeA)
                });
            }
        }

        if (neighbors.length < 3) {
            if (this.debug) console.log(`   ⚠️ Недостаточно соседей для треугольника: ${neighbors.length}`);
            return null;
        }

        // 🔥🔥🔥 ИЩЕМ ТРЕУГОЛЬНИК ИЗ МАЯКОВ!
        let bestTriangle = null;
        let bestScore = -1;

        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                for (let k = j + 1; k < neighbors.length; k++) {
                    const a = modelGraph.nodes.get(neighbors[i].id);
                    const b = modelGraph.nodes.get(neighbors[j].id);
                    const c = modelGraph.nodes.get(neighbors[k].id);
                   
                    if (!a || !b || !c) continue;

                    // Проверяем, лежит ли точка внутри треугольника
                    if (this.isPointInTriangle(node, a, b, c)) {
                        // Вычисляем барицентрические координаты
                        const bary = this.calculateBarycentric(node, a, b, c);
                       
                        // Проверяем валидность координат
                        if (bary.alpha >= 0 && bary.alpha <= 1 &&
                            bary.beta >= 0 && bary.beta <= 1 &&
                            bary.gamma >= 0 && bary.gamma <= 1) {
                           
                            // Считаем, сколько в треугольнике маяков
                            let beaconCount = 0;
                            let anchorCount = 0;
                           
                            if (a.confirmationCount >= 3) beaconCount++;
                            if (b.confirmationCount >= 3) beaconCount++;
                            if (c.confirmationCount >= 3) beaconCount++;
                           
                            if (a.confirmationCount >= 2) anchorCount++;
                            if (b.confirmationCount >= 2) anchorCount++;
                            if (c.confirmationCount >= 2) anchorCount++;
                           
                            // Оценка качества треугольника:
                            // - Чем больше маяков, тем лучше
                            // - Чем равномернее координаты, тем лучше
                            const uniformity = 1 - (
                                Math.abs(bary.alpha - 0.33) +
                                Math.abs(bary.beta - 0.33) +
                                Math.abs(bary.gamma - 0.33)
                            ) / 1.33;
                           
                            const score = beaconCount * 10 + anchorCount * 3 + uniformity * 5;
                           
                            if (score > bestScore) {
                                bestScore = score;
                                bestTriangle = {
                                    triangle: [neighbors[i].id, neighbors[j].id, neighbors[k].id],
                                    barycentric: bary,
                                    beaconCount,
                                    anchorCount,
                                    uniformity,
                                    score,
                                    confidence: 0.7 + beaconCount * 0.1 + anchorCount * 0.05
                                };
                            }
                        }
                    }
                }
            }
        }

        if (bestTriangle) {
            this.triangleMemory.set(nodeId, {
                nodeId,
                triangle: bestTriangle.triangle,
                barycentric: bestTriangle.barycentric,
                beaconCount: bestTriangle.beaconCount,
                anchorCount: bestTriangle.anchorCount,
                confidence: bestTriangle.confidence,
                recordedAt: Date.now()
            });
           
            if (this.debug) {
                console.log(`   ✅ Запомнен треугольник:`);
                console.log(`      Вершины: ${bestTriangle.triangle.map(id => id.substring(0, 10)).join(', ')}`);
                console.log(`      Координаты: (${bestTriangle.barycentric.alpha.toFixed(3)}, ${bestTriangle.barycentric.beta.toFixed(3)}, ${bestTriangle.barycentric.gamma.toFixed(3)})`);
                console.log(`      Маяков: ${bestTriangle.beaconCount}, Якорей: ${bestTriangle.anchorCount}`);
                console.log(`      Уверенность: ${(bestTriangle.confidence * 100).toFixed(0)}%`);
            }
           
            return bestTriangle;
        }

        if (this.debug) console.log(`   ⚠️ Не найден подходящий треугольник`);
        return null;
    }

    // 🔥 ВОССТАНОВИТЬ ПОЗИЦИЮ ПО ТРЕУГОЛЬНИКУ
    reconstructPosition(nodeId, modelGraph) {
        const memory = this.triangleMemory.get(nodeId);
        if (!memory) {
            return null;
        }

        const [aId, bId, cId] = memory.triangle;
        const a = modelGraph.nodes.get(aId);
        const b = modelGraph.nodes.get(bId);
        const c = modelGraph.nodes.get(cId);

        if (!a || !b || !c) {
            if (this.debug) console.log(`   ⚠️ Потеряны вершины треугольника`);
            return null;
        }

        const { alpha, beta, gamma } = memory.barycentric;
        const x = a.x * alpha + b.x * beta + c.x * gamma;
        const y = a.y * alpha + b.y * beta + c.y * gamma;

        if (this.debug) {
            console.log(`   🔺 Восстановлено по треугольнику:`);
            console.log(`      Позиция: (${x.toFixed(1)}, ${y.toFixed(1)})`);
            console.log(`      Уверенность: ${(memory.confidence * 100).toFixed(0)}%`);
        }

        return {
            x,
            y,
            method: 'hierarchical_triangulation',
            confidence: memory.confidence,
            triangle: memory.triangle,
            beaconCount: memory.beaconCount,
            anchorCount: memory.anchorCount
        };
    }

    // 🔥 ПРОВЕРИТЬ, ЛЕЖИТ ЛИ ТОЧКА В ТРЕУГОЛЬНИКЕ
    isPointInTriangle(p, a, b, c) {
        const area = 0.5 * (-b.y * c.x + a.y * (-b.x + c.x) + a.x * (b.y - c.y) + b.x * c.y);
        if (Math.abs(area) < 0.001) return false;
       
        const sign = area < 0 ? -1 : 1;
        const s = (a.y * c.x - a.x * c.y + (c.y - a.y) * p.x + (a.x - c.x) * p.y) * sign;
        const t = (a.x * b.y - a.y * b.x + (a.y - b.y) * p.x + (b.x - a.x) * p.y) * sign;
       
        return s > 0 && t > 0 && (s + t) < 2 * Math.abs(area);
    }

    // 🔥 ВЫЧИСЛИТЬ БАРИЦЕНТРИЧЕСКИЕ КООРДИНАТЫ
    calculateBarycentric(p, a, b, c) {
        const area = 0.5 * (-b.y * c.x + a.y * (-b.x + c.x) + a.x * (b.y - c.y) + b.x * c.y);
        if (Math.abs(area) < 0.001) {
            return { alpha: 0.33, beta: 0.33, gamma: 0.33 };
        }
       
        const areaPBC = 0.5 * (-b.y * c.x + p.y * (-b.x + c.x) + p.x * (b.y - c.y) + b.x * c.y);
        const areaAPC = 0.5 * (-c.y * a.x + p.y * (-c.x + a.x) + p.x * (c.y - a.y) + c.x * a.y);
       
        const alpha = areaPBC / area;
        const beta = areaAPC / area;
        const gamma = 1 - alpha - beta;
       
        return { alpha, beta, gamma };
    }

    // 🔥 ОЧИСТИТЬ СТАРЫЕ ТРЕУГОЛЬНИКИ
    cleanup(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 дней по умолчанию
        const now = Date.now();
        let removed = 0;
       
        for (const [nodeId, memory] of this.triangleMemory) {
            if (now - memory.recordedAt > maxAge) {
                this.triangleMemory.delete(nodeId);
                removed++;
            }
        }
       
        if (removed > 0 && this.debug) {
            console.log(`🧹 Удалено ${removed} устаревших треугольников`);
        }
       
        return removed;
    }

    // 🔥 ЭКСПОРТ/ИМПОРТ
    export() {
        const data = {};
        for (const [nodeId, memory] of this.triangleMemory) {
            data[nodeId] = {
                triangle: memory.triangle,
                barycentric: memory.barycentric,
                beaconCount: memory.beaconCount,
                anchorCount: memory.anchorCount,
                confidence: memory.confidence,
                recordedAt: memory.recordedAt
            };
        }
        return data;
    }

    import(data) {
        if (!data) return;
        for (const [nodeId, memory] of Object.entries(data)) {
            this.triangleMemory.set(nodeId, {
                nodeId,
                triangle: memory.triangle,
                barycentric: memory.barycentric,
                beaconCount: memory.beaconCount,
                anchorCount: memory.anchorCount,
                confidence: memory.confidence,
                recordedAt: memory.recordedAt
            });
        }
        console.log(`📥 Импортировано ${Object.keys(data).length} треугольников`);
    }
}

module.exports = HierarchicalTriangulation;
