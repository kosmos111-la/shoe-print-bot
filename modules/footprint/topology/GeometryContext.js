// modules/footprint/topology/GeometryContext.js
// 📐 ГЕОМЕТРИЧЕСКИЙ КОНТЕКСТ ТОЧКИ - локальная и глобальная геометрия

class GeometryContext {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище геометрических контекстов для каждой точки
        // nodeId -> { local, global, invariants }
        this.contexts = new Map();
       
        console.log('📐 GeometryContext создан (геометрическая память точки)');
    }

    // 🔥🔥🔥 ЗАПОМНИТЬ ГЕОМЕТРИЧЕСКИЙ КОНТЕКСТ ТОЧКИ
    rememberContext(nodeId, point, neighbors, allNodes, beacons = []) {
        if (neighbors.length < 2) return null;

        const context = {
            local: this.computeLocalContext(point, neighbors, allNodes),
            global: this.computeGlobalContext(point, neighbors, allNodes, beacons),
            invariants: this.computeInvariants(point, neighbors, allNodes),
            timestamp: Date.now()
        };

        this.contexts.set(nodeId, context);
       
        if (this.debug) {
            console.log(`📐 Запомнен контекст для ${nodeId.substring(0, 20)}...`);
            console.log(`   Локальных соседей: ${neighbors.length}`);
            console.log(`   Треугольников с маяками: ${context.global.beaconTriangles.length}`);
        }

        return context;
    }

    // 🔥🔥🔥 ЛОКАЛЬНЫЙ КОНТЕКСТ - 3 БЛИЖАЙШИХ СОСЕДА
    computeLocalContext(point, neighbors, allNodes) {
        // Сортируем соседей по расстоянию
        const withDistance = neighbors.map(id => ({
            id,
            node: allNodes.get(id),
            distance: this.distance(point, allNodes.get(id))
        })).sort((a, b) => a.distance - b.distance);

        // Берем 3 ближайших (или меньше, если их нет)
        const closest = withDistance.slice(0, 3);
       
        if (closest.length < 2) return null;

        const local = {
            neighbors: closest.map(c => c.id),
            distances: closest.map(c => c.distance)
        };

        // Если есть 3 точки - вычисляем барицентрические координаты
        if (closest.length === 3) {
            const [a, b, c] = closest.map(c => c.node);
            local.barycentric = this.calculateBarycentric(point, a, b, c);
            local.area = this.triangleArea(a, b, c);
            local.angles = this.calculateAngles(a, b, c, point);
        }

        // Если есть 2 точки - вычисляем проекцию
        if (closest.length === 2) {
            const [a, b] = closest.map(c => c.node);
            local.projection = this.calculateProjection(point, a, b);
            local.distance = this.distance(a, b);
        }

        return local;
    }

    // 🔥🔥🔥 ГЛОБАЛЬНЫЙ КОНТЕКСТ - ОТНОШЕНИЯ С МАЯКАМИ
    computeGlobalContext(point, neighbors, allNodes, beacons) {
        const global = {
            beaconTriangles: [],
            beaconDistances: []
        };

        if (beacons.length < 3) return global;

        // Ищем треугольники из маяков, содержащие точку
        for (let i = 0; i < beacons.length; i++) {
            for (let j = i + 1; j < beacons.length; j++) {
                for (let k = j + 1; k < beacons.length; k++) {
                    const a = allNodes.get(beacons[i].id);
                    const b = allNodes.get(beacons[j].id);
                    const c = allNodes.get(beacons[k].id);
                   
                    if (!a || !b || !c) continue;

                    if (this.isPointInTriangle(point, a, b, c)) {
                        const bary = this.calculateBarycentric(point, a, b, c);
                        global.beaconTriangles.push({
                            beacons: [beacons[i].id, beacons[j].id, beacons[k].id],
                            barycentric: bary,
                            area: this.triangleArea(a, b, c),
                            confidence: 0.9
                        });
                    }
                }
            }
        }

        // Расстояния до ближайших маяков
        const beaconDistances = beacons.map(b => ({
            id: b.id,
            distance: this.distance(point, allNodes.get(b.id))
        })).sort((a, b) => a.distance - b.distance);

        global.beaconDistances = beaconDistances.slice(0, 5);

        return global;
    }

    // 🔥🔥🔥 ИНВАРИАНТНЫЕ ПРИЗНАКИ
    computeInvariants(point, neighbors, allNodes) {
        const invariants = {
            angleRatios: [],
            areaRatios: [],
            isInside: false,
            isBorder: false,
            neighborTypes: []
        };

        if (neighbors.length < 3) return invariants;

        // Отношения углов
        const angles = [];
        for (let i = 0; i < neighbors.length; i++) {
            for (let j = i + 1; j < neighbors.length; j++) {
                const a = allNodes.get(neighbors[i]);
                const b = allNodes.get(neighbors[j]);
                if (!a || !b) continue;
               
                const angle = this.calculateAngle(point, a, b);
                if (angle > 0) angles.push(angle);
            }
        }

        if (angles.length >= 2) {
            angles.sort((a, b) => a - b);
            for (let i = 0; i < angles.length - 1; i++) {
                invariants.angleRatios.push(angles[i+1] / (angles[i] || 1));
            }
        }

        // Отношения площадей треугольников с соседями
        if (neighbors.length >= 3) {
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    for (let k = j + 1; k < neighbors.length; k++) {
                        const a = allNodes.get(neighbors[i]);
                        const b = allNodes.get(neighbors[j]);
                        const c = allNodes.get(neighbors[k]);
                        if (!a || !b || !c) continue;
                       
                        const area = this.triangleArea(a, b, c);
                        if (area > 0) invariants.areaRatios.push(area);
                    }
                }
            }
           
            // Нормализуем площади
            if (invariants.areaRatios.length > 0) {
                const maxArea = Math.max(...invariants.areaRatios);
                invariants.areaRatios = invariants.areaRatios.map(a => a / maxArea);
            }
        }

        // Позиция в структуре
        invariants.isBorder = neighbors.length < 4; // На границе если мало соседей
        invariants.neighborTypes = neighbors.map(id => {
            const node = allNodes.get(id);
            return {
                degree: node?.degree || 0,
                confidence: node?.confirmationCount || 1
            };
        });

        return invariants;
    }

    // 🔥🔥🔥 ВОССТАНОВИТЬ ПОЗИЦИЮ ПО КОНТЕКСТУ
    reconstructPosition(nodeId, modelGraph, beacons = []) {
        const context = this.contexts.get(nodeId);
        if (!context) return null;

        const votes = [];

        // 1. ГОЛОСОВАНИЕ: Локальный контекст (3 ближайших соседа)
        if (context.local?.barycentric) {
            const [aId, bId, cId] = context.local.neighbors;
            const a = modelGraph.nodes.get(aId);
            const b = modelGraph.nodes.get(bId);
            const c = modelGraph.nodes.get(cId);

            if (a && b && c) {
                const { alpha, beta, gamma } = context.local.barycentric;
                const x = a.x * alpha + b.x * beta + c.x * gamma;
                const y = a.y * alpha + b.y * beta + c.y * gamma;
               
                votes.push({
                    x, y,
                    method: 'local_triangle',
                    confidence: 0.8,
                    weight: 0.4
                });
            }
        }

        // 2. ГОЛОСОВАНИЕ: Проекция на 2 точки
        if (context.local?.projection) {
            const [aId, bId] = context.local.neighbors;
            const a = modelGraph.nodes.get(aId);
            const b = modelGraph.nodes.get(bId);

            if (a && b) {
                const { t } = context.local.projection;
                const x = a.x + (b.x - a.x) * t;
                const y = a.y + (b.y - a.y) * t;
               
                votes.push({
                    x, y,
                    method: 'local_projection',
                    confidence: 0.6,
                    weight: 0.2
                });
            }
        }

        // 3. ГОЛОСОВАНИЕ: Треугольники с маяками
        if (context.global?.beaconTriangles) {
            for (const tri of context.global.beaconTriangles) {
                const [aId, bId, cId] = tri.beacons;
                const a = modelGraph.nodes.get(aId);
                const b = modelGraph.nodes.get(bId);
                const c = modelGraph.nodes.get(cId);

                if (a && b && c) {
                    const { alpha, beta, gamma } = tri.barycentric;
                    const x = a.x * alpha + b.x * beta + c.x * gamma;
                    const y = a.y * alpha + b.y * beta + c.y * gamma;
                   
                    votes.push({
                        x, y,
                        method: 'beacon_triangle',
                        confidence: tri.confidence,
                        weight: 0.3
                    });
                }
            }
        }

        // 4. ГОЛОСОВАНИЕ: Ближайший маяк + смещение
        if (context.global?.beaconDistances.length > 0 && beacons.length > 0) {
            const closestBeacon = context.global.beaconDistances[0];
            const modelBeacon = modelGraph.nodes.get(closestBeacon.id);
           
            if (modelBeacon) {
                // Ищем точку с таким же расстоянием до маяка
                const candidates = this.findPointsAtDistance(
                    modelBeacon,
                    closestBeacon.distance,
                    modelGraph
                );
               
                candidates.forEach(candidate => {
                    votes.push({
                        x: candidate.x,
                        y: candidate.y,
                        method: 'beacon_distance',
                        confidence: 0.5,
                        weight: 0.1
                    });
                });
            }
        }

        // ВЗВЕШЕННОЕ ГОЛОСОВАНИЕ
        if (votes.length === 0) return null;

        let totalWeight = 0;
        let sumX = 0, sumY = 0;

        votes.forEach(vote => {
            sumX += vote.x * vote.weight;
            sumY += vote.y * vote.weight;
            totalWeight += vote.weight;
        });

        const x = sumX / totalWeight;
        const y = sumY / totalWeight;
        const avgConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length;

        if (this.debug) {
            console.log(`   📐 Восстановлено голосованием:`);
            console.log(`      Методов: ${votes.length}`);
            console.log(`      Позиция: (${x.toFixed(1)}, ${y.toFixed(1)})`);
            console.log(`      Уверенность: ${(avgConfidence * 100).toFixed(0)}%`);
        }

        return {
            x, y,
            method: 'geometry_voting',
            confidence: avgConfidence,
            votes: votes.length
        };
    }

    // 🔥 ПОИСК ТОЧЕК НА ЗАДАННОМ РАССТОЯНИИ
    findPointsAtDistance(center, distance, graph) {
        const candidates = [];
        for (const node of graph.nodes.values()) {
            const d = this.distance(center, node);
            if (Math.abs(d - distance) < distance * 0.1) { // 10% tolerance
                candidates.push(node);
            }
        }
        return candidates;
    }

    // 🔥 ВЫЧИСЛИТЬ ПРОЕКЦИЮ ТОЧКИ НА ОТРЕЗОК
    calculateProjection(p, a, b) {
        const ax = b.x - a.x;
        const ay = b.y - a.y;
        const bx = p.x - a.x;
        const by = p.y - a.y;
       
        const dot = ax * bx + ay * by;
        const lenSq = ax * ax + ay * ay;
       
        if (lenSq < 0.001) return null;
       
        const t = Math.max(0, Math.min(1, dot / lenSq));
       
        return {
            t,
            x: a.x + ax * t,
            y: a.y + ay * t,
            distance: Math.abs(dot / Math.sqrt(lenSq))
        };
    }

    // 🔥 ВЫЧИСЛИТЬ БАРИЦЕНТРИЧЕСКИЕ КООРДИНАТЫ
    calculateBarycentric(p, a, b, c) {
        const v0 = { x: c.x - a.x, y: c.y - a.y };
        const v1 = { x: b.x - a.x, y: b.y - a.y };
        const v2 = { x: p.x - a.x, y: p.y - a.y };

        const dot00 = v0.x * v0.x + v0.y * v0.y;
        const dot01 = v0.x * v1.x + v0.y * v1.y;
        const dot02 = v0.x * v2.x + v0.y * v2.y;
        const dot11 = v1.x * v1.x + v1.y * v1.y;
        const dot12 = v1.x * v2.x + v1.y * v2.y;

        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const beta = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const gamma = (dot00 * dot12 - dot01 * dot02) * invDenom;
        const alpha = 1 - beta - gamma;

        return { alpha, beta, gamma };
    }

    // 🔥 ВЫЧИСЛИТЬ УГОЛ МЕЖДУ ВЕКТОРАМИ
    calculateAngle(center, a, b) {
        const v1 = { x: a.x - center.x, y: a.y - center.y };
        const v2 = { x: b.x - center.x, y: b.y - center.y };
       
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
       
        if (mag1 < 0.001 || mag2 < 0.001) return 0;
       
        const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        return Math.acos(cos) * 180 / Math.PI;
    }

    // 🔥 ПЛОЩАДЬ ТРЕУГОЛЬНИКА
    triangleArea(a, b, c) {
        return Math.abs(
            (b.x - a.x) * (c.y - a.y) -
            (b.y - a.y) * (c.x - a.x)
        ) / 2;
    }

    // 🔥 ПРОВЕРКА, ЛЕЖИТ ЛИ ТОЧКА В ТРЕУГОЛЬНИКЕ
    isPointInTriangle(p, a, b, c) {
        const area = this.triangleArea(a, b, c);
        if (area < 0.001) return false;
       
        const area1 = this.triangleArea(p, b, c);
        const area2 = this.triangleArea(a, p, c);
        const area3 = this.triangleArea(a, b, p);
       
        return Math.abs(area - (area1 + area2 + area3)) < 0.001;
    }

    // 🔥 РАССТОЯНИЕ
    distance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 🔥 ПОЛУЧИТЬ МАЯКИ ИЗ ГРАФА
    getBeacons(graph) {
        const beacons = [];
        for (const [id, node] of graph.nodes) {
            if (node.confirmationCount >= 3) {
                beacons.push({ id, node, confirmations: node.confirmationCount });
            }
        }
        return beacons;
    }

    // 🔥 ЭКСПОРТ
    export() {
        const data = {};
        for (const [nodeId, context] of this.contexts) {
            data[nodeId] = {
                local: context.local,
                global: {
                    beaconTriangles: context.global.beaconTriangles,
                    beaconDistances: context.global.beaconDistances
                },
                invariants: context.invariants,
                timestamp: context.timestamp
            };
        }
        return data;
    }

    // 🔥 ИМПОРТ
    import(data) {
        if (!data) return;
        for (const [nodeId, ctx] of Object.entries(data)) {
            this.contexts.set(nodeId, {
                local: ctx.local,
                global: ctx.global,
                invariants: ctx.invariants,
                timestamp: ctx.timestamp
            });
        }
        console.log(`📥 Импортировано ${Object.keys(data).length} геометрических контекстов`);
    }
}

module.exports = GeometryContext;
