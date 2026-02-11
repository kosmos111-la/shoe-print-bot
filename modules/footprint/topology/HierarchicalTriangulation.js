// modules/footprint/topology/HierarchicalTriangulation.js
// 🔺 ИЕРАРХИЧЕСКАЯ ТРИАНГУЛЯЦИЯ - ВОССТАНОВЛЕНИЕ ПО ЛЮБЫМ ЯКОРЯМ

const { TrustLevelManager, TRUST_LEVELS } = require('./TrustLevel');

class HierarchicalTriangulation {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.trustManager = new TrustLevelManager({ debug: this.debug });
       
        // Хранилище треугольников для каждой точки
        this.triangleMemory = new Map(); // nodeId -> { triangle, barycentric, anchors }
       
        console.log('🔺 HierarchicalTriangulation создана (восстановление по якорям)');
    }

    // 🔥 ПОЛУЧИТЬ ВСЕ ЯКОРИ - ЛЮБЫЕ ТОЧКИ В МОДЕЛИ!
    getAnchors(modelGraph) {
        const anchors = [];
        for (const [nodeId, node] of modelGraph.nodes) {
            // 🔥🔥🔥 ЛЮБАЯ ТОЧКА, КОТОРАЯ УЖЕ ЕСТЬ В МОДЕЛИ - ЭТО ЯКОРЬ!
            // Чем больше подтверждений, тем выше вес
            const weight = Math.min(1.0, (node.confirmationCount || 1) / 3);
            anchors.push({
                id: nodeId,
                node: node,
                weight: weight,
                confirmations: node.confirmationCount || 1
            });
        }
        return anchors;
    }

    // 🔥 НАЙТИ ТРИ БЛИЖАЙШИХ ЯКОРЯ (НЕ ТОЛЬКО МАЯКИ!)
    findClosestAnchors(nodeId, node, newGraph, structuralMapping, modelGraph) {
        if (this.debug) {
            console.log(`🔍 Ищу 3 ближайших якоря для ${nodeId.substring(0, 20)}...`);
        }

        // Получаем всех соседей, которые есть в маппинге
        const neighbors = [];
        for (const edge of newGraph.edges) {
            const [nodeA, nodeB] = edge.split('--');
            if (nodeA === nodeId && structuralMapping.has(nodeB)) {
                const modelNodeId = structuralMapping.get(nodeB);
                const modelNode = modelGraph.nodes.get(modelNodeId);
                if (modelNode) {
                    const dist = this.distance(node, newGraph.nodes.get(nodeB));
                    neighbors.push({
                        id: modelNodeId,
                        node: modelNode,
                        distance: dist,
                        confirmations: modelNode.confirmationCount || 1
                    });
                }
            } else if (nodeB === nodeId && structuralMapping.has(nodeA)) {
                const modelNodeId = structuralMapping.get(nodeA);
                const modelNode = modelGraph.nodes.get(modelNodeId);
                if (modelNode) {
                    const dist = this.distance(node, newGraph.nodes.get(nodeA));
                    neighbors.push({
                        id: modelNodeId,
                        node: modelNode,
                        distance: dist,
                        confirmations: modelNode.confirmationCount || 1
                    });
                }
            }
        }

        // 🔥🔥🔥 СОРТИРУЕМ ПО РАССТОЯНИЮ И БЕРЁМ ТРИ БЛИЖАЙШИХ!
        const closest = neighbors
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 3);

        if (this.debug) {
            console.log(`   Найдено ${closest.length} ближайших якорей:`);
            closest.forEach((a, i) => {
                console.log(`      ${i+1}. ${a.id.substring(0, 15)}... dist=${a.distance.toFixed(1)}, conf=${a.confirmations}`);
            });
        }

        return closest;
    }

    // 🔥 ЗАПОМНИТЬ ТРЕУГОЛЬНИК ДЛЯ ТОЧКИ
    rememberTriangle(nodeId, node, newGraph, structuralMapping, modelGraph) {
        if (this.debug) {
            console.log(`🔺 Запоминаю треугольник для ${nodeId.substring(0, 20)}...`);
        }

        // Находим 3 ближайших якоря
        const anchors = this.findClosestAnchors(nodeId, node, newGraph, structuralMapping, modelGraph);
       
        if (anchors.length < 3) {
            if (this.debug) console.log(`   ⚠️ Недостаточно якорей: ${anchors.length}/3`);
            return null;
        }

        const a = anchors[0].node;
        const b = anchors[1].node;
        const c = anchors[2].node;

        // Проверяем, не лежат ли якоря на одной прямой
        const area = Math.abs(
            (b.x - a.x) * (c.y - a.y) -
            (b.y - a.y) * (c.x - a.x)
        ) / 2;

        if (area < 0.1) {
            if (this.debug) console.log(`   ⚠️ Якоря почти на одной прямой (площадь=${area.toFixed(2)})`);
            return null;
        }

        // Вычисляем барицентрические координаты
        const bary = this.calculateBarycentric(node, a, b, c);
       
        // Проверяем валидность координат
        if (bary.alpha < -0.1 || bary.alpha > 1.1 ||
            bary.beta < -0.1 || bary.beta > 1.1 ||
            bary.gamma < -0.1 || bary.gamma > 1.1) {
            if (this.debug) console.log(`   ⚠️ Барицентрические координаты вне допустимого диапазона`);
            return null;
        }

        // Вычисляем уверенность на основе расстояний и подтверждений
        const avgDistance = (anchors[0].distance + anchors[1].distance + anchors[2].distance) / 3;
        const avgConfirmations = (anchors[0].confirmations + anchors[1].confirmations + anchors[2].confirmations) / 3;
       
        // Чем ближе якоря и чем больше у них подтверждений, тем выше уверенность
        const distanceConfidence = Math.max(0, 1 - avgDistance / 200);
        const confirmationConfidence = Math.min(1, avgConfirmations / 3);
        const confidence = (distanceConfidence * 0.7 + confirmationConfidence * 0.3);

        const triangle = {
            anchors: anchors.map(a => a.id),
            barycentric: bary,
            distances: anchors.map(a => a.distance),
            confirmations: anchors.map(a => a.confirmations),
            area: area,
            confidence: Math.min(0.95, Math.max(0.3, confidence)),
            recordedAt: Date.now()
        };

        this.triangleMemory.set(nodeId, triangle);

        if (this.debug) {
            console.log(`   ✅ Запомнен треугольник:`);
            console.log(`      Якоря: ${triangle.anchors.map(id => id.substring(0, 10)).join(', ')}`);
            console.log(`      Координаты: (${bary.alpha.toFixed(3)}, ${bary.beta.toFixed(3)}, ${bary.gamma.toFixed(3)})`);
            console.log(`      Расстояния: ${triangle.distances.map(d => d.toFixed(1)).join(', ')}`);
            console.log(`      Площадь: ${area.toFixed(1)}`);
            console.log(`      Уверенность: ${(confidence * 100).toFixed(0)}%`);
        }

        return triangle;
    }

    // 🔥 ВОССТАНОВИТЬ ПОЗИЦИЮ ПО ТРЕУГОЛЬНИКУ
    reconstructPosition(nodeId, modelGraph) {
        const triangle = this.triangleMemory.get(nodeId);
        if (!triangle) {
            return null;
        }

        const [aId, bId, cId] = triangle.anchors;
        const a = modelGraph.nodes.get(aId);
        const b = modelGraph.nodes.get(bId);
        const c = modelGraph.nodes.get(cId);

        if (!a || !b || !c) {
            if (this.debug) console.log(`   ⚠️ Потеряны якоря треугольника`);
            return null;
        }

        const { alpha, beta, gamma } = triangle.barycentric;
        const x = a.x * alpha + b.x * beta + c.x * gamma;
        const y = a.y * alpha + b.y * beta + c.y * gamma;

        // Проверяем, не улетела ли точка слишком далеко
        const minX = Math.min(a.x, b.x, c.x);
        const maxX = Math.max(a.x, b.x, c.x);
        const minY = Math.min(a.y, b.y, c.y);
        const maxY = Math.max(a.y, b.y, c.y);
       
        const padding = Math.max(maxX - minX, maxY - minY) * 0.5;
       
        let finalX = x;
        let finalY = y;
       
        // Если точка слишком далеко от треугольника - притягиваем обратно
        if (x < minX - padding) finalX = minX;
        if (x > maxX + padding) finalX = maxX;
        if (y < minY - padding) finalY = minY;
        if (y > maxY + padding) finalY = maxY;

        if (this.debug) {
            console.log(`   🔺 Восстановлено по треугольнику:`);
            console.log(`      Позиция: (${finalX.toFixed(1)}, ${finalY.toFixed(1)})`);
            console.log(`      Уверенность: ${(triangle.confidence * 100).toFixed(0)}%`);
            if (finalX !== x || finalY !== y) {
                console.log(`      ⚠️ Скорректировано: (${x.toFixed(1)}, ${y.toFixed(1)}) → (${finalX.toFixed(1)}, ${finalY.toFixed(1)})`);
            }
        }

        return {
            x: finalX,
            y: finalY,
            method: 'hierarchical_triangulation',
            confidence: triangle.confidence,
            anchors: triangle.anchors,
            distances: triangle.distances
        };
    }

    // 🔥 АЛЬТЕРНАТИВНЫЙ МЕТОД - ПО ДВУМ БЛИЖАЙШИМ ЯКОРЯМ
    reconstructFromTwoAnchors(nodeId, node, newGraph, structuralMapping, modelGraph) {
        const anchors = this.findClosestAnchors(nodeId, node, newGraph, structuralMapping, modelGraph);
       
        if (anchors.length < 2) {
            return null;
        }

        const a = anchors[0].node;
        const b = anchors[1].node;
       
        // Проекция точки на прямую между двумя якорями
        const ax = b.x - a.x;
        const ay = b.y - a.y;
        const bx = node.x - a.x;
        const by = node.y - a.y;
       
        const dot = ax * bx + ay * by;
        const lenSq = ax * ax + ay * ay;
       
        if (lenSq < 0.1) return null;
       
        const t = Math.max(0, Math.min(1, dot / lenSq));
       
        const x = a.x + ax * t;
        const y = a.y + ay * t;

        const confidence = 0.6 * (1 - anchors[0].distance / 200) * (1 - anchors[1].distance / 200);

        return {
            x, y,
            method: 'two_anchor_projection',
            confidence: confidence,
            anchors: [anchors[0].id, anchors[1].id]
        };
    }

    // 🔥 РАССТОЯНИЕ
    distance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 🔥 ВЫЧИСЛИТЬ БАРИЦЕНТРИЧЕСКИЕ КООРДИНАТЫ
    calculateBarycentric(p, a, b, c) {
        // Вектора
        const v0 = { x: c.x - a.x, y: c.y - a.y };
        const v1 = { x: b.x - a.x, y: b.y - a.y };
        const v2 = { x: p.x - a.x, y: p.y - a.y };

        // Скалярные произведения
        const dot00 = v0.x * v0.x + v0.y * v0.y;
        const dot01 = v0.x * v1.x + v0.y * v1.y;
        const dot02 = v0.x * v2.x + v0.y * v2.y;
        const dot11 = v1.x * v1.x + v1.y * v1.y;
        const dot12 = v1.x * v2.x + v1.y * v2.y;

        // Вычисляем барицентрические координаты
        const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
        const beta = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const gamma = (dot00 * dot12 - dot01 * dot02) * invDenom;
        const alpha = 1 - beta - gamma;

        return { alpha, beta, gamma };
    }

    // 🔥 ОЧИСТИТЬ СТАРЫЕ ТРЕУГОЛЬНИКИ
    cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 дней
        const now = Date.now();
        let removed = 0;
       
        for (const [nodeId, triangle] of this.triangleMemory) {
            if (now - triangle.recordedAt > maxAge) {
                this.triangleMemory.delete(nodeId);
                removed++;
            }
        }
       
        if (removed > 0 && this.debug) {
            console.log(`🧹 Удалено ${removed} устаревших треугольников`);
        }
       
        return removed;
    }

    // 🔥 ЭКСПОРТ
    export() {
        const data = {};
        for (const [nodeId, triangle] of this.triangleMemory) {
            data[nodeId] = {
                anchors: triangle.anchors,
                barycentric: triangle.barycentric,
                distances: triangle.distances,
                confirmations: triangle.confirmations,
                area: triangle.area,
                confidence: triangle.confidence,
                recordedAt: triangle.recordedAt
            };
        }
        return data;
    }

    // 🔥 ИМПОРТ
    import(data) {
        if (!data) return;
        for (const [nodeId, triangle] of Object.entries(data)) {
            this.triangleMemory.set(nodeId, {
                anchors: triangle.anchors,
                barycentric: triangle.barycentric,
                distances: triangle.distances,
                confirmations: triangle.confirmations,
                area: triangle.area,
                confidence: triangle.confidence,
                recordedAt: triangle.recordedAt
            });
        }
        console.log(`📥 Импортировано ${Object.keys(data).length} треугольников`);
    }

    // 🔥 ПОЛУЧИТЬ СТАТИСТИКУ
    getStats() {
        let total = 0;
        let avgConfidence = 0;
        let beaconTriangles = 0;
       
        for (const triangle of this.triangleMemory.values()) {
            total++;
            avgConfidence += triangle.confidence;
           
            const avgConfirmations = triangle.confirmations.reduce((a, b) => a + b, 0) / 3;
            if (avgConfirmations >= 3) beaconTriangles++;
        }
       
        return {
            totalTriangles: total,
            avgConfidence: total > 0 ? avgConfidence / total : 0,
            beaconTriangles: beaconTriangles,
            memorySize: this.triangleMemory.size
        };
    }
}

module.exports = HierarchicalTriangulation;
