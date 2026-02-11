// modules/footprint/topology/HierarchicalTriangulation.js
// 🔺 ИЕРАРХИЧЕСКАЯ ТРИАНГУЛЯЦИЯ - ВОССТАНОВЛЕНИЕ ПО БЛИЖАЙШИМ ЯКОРЯМ

const { TrustLevelManager, TRUST_LEVELS } = require('./TrustLevel');

class HierarchicalTriangulation {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.trustManager = new TrustLevelManager({ debug: this.debug });
       
        // Хранилище треугольников для каждой точки
        this.triangleMemory = new Map(); // nodeId -> { triangle, barycentric, distances }
       
        console.log('🔺 HierarchicalTriangulation создана (восстановление по ближайшим якорям)');
    }

    // 🔥🔥🔥 ГЛАВНОЕ ИСПРАВЛЕНИЕ - ИЩЕМ БЛИЖАЙШИЕ ТОЧКИ ПО РАССТОЯНИЮ В ФОТО 2!
    findClosestAnchors(nodeId, node, newGraph, structuralMapping, modelGraph) {
        if (this.debug) {
            console.log(`🔍 Ищу 3 ближайших якоря для ${nodeId.substring(0, 20)}...`);
        }

        const candidates = [];
       
        // 🔥🔥🔥 ПРОХОДИМ ПО ВСЕМ СООТВЕТСТВИЯМ В МАППИНГЕ
        // НЕ ТОЛЬКО ПО СОСЕДЯМ В ГРАФЕ, А ПО ВСЕМ ТОЧКАМ, КОТОРЫЕ СОВПАЛИ!
        for (const [newId, modelId] of structuralMapping) {
            const modelNode = modelGraph.nodes.get(modelId);
            const newNode = newGraph.nodes.get(newId);
           
            if (modelNode && newNode) {
                // Вычисляем РЕАЛЬНОЕ расстояние между точками в ФОТО 2
                const dist = this.distance(node, newNode);
               
                // БЕРЁМ ВСЕХ, даже если они далеко - потом отсортируем
                candidates.push({
                    id: modelId,
                    node: modelNode,
                    distance: dist,
                    confirmations: modelNode.confirmationCount || 1,
                    // Чем больше подтверждений, тем выше приоритет при равных расстояниях
                    priority: (modelNode.confirmationCount || 1) / 3
                });
            }
        }

        // 🔥🔥🔥 СОРТИРУЕМ ПО РАССТОЯНИЮ И БЕРЁМ 3 БЛИЖАЙШИХ!
        const closest = candidates
            .sort((a, b) => {
                // Сначала по расстоянию
                if (Math.abs(a.distance - b.distance) > 0.1) {
                    return a.distance - b.distance;
                }
                // Если расстояния равны - по количеству подтверждений
                return b.confirmations - a.confirmations;
            })
            .slice(0, 3);

        if (this.debug) {
            console.log(`   Найдено кандидатов: ${candidates.length}`);
            console.log(`   Взято ближайших: ${closest.length}`);
            closest.forEach((a, i) => {
                console.log(`      ${i+1}. dist=${a.distance.toFixed(1)}, conf=${a.confirmations}, id=${a.id.substring(0, 15)}...`);
            });
        }

        return closest;
    }

    // 🔥 ЗАПОМНИТЬ ТРЕУГОЛЬНИК ДЛЯ ТОЧКИ
    rememberTriangle(nodeId, node, newGraph, structuralMapping, modelGraph) {
        if (this.debug) {
            console.log(`🔺 Запоминаю треугольник для ${nodeId.substring(0, 20)}...`);
        }

        // Находим 3 ближайших якоря по РЕАЛЬНОМУ расстоянию в фото 2
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
       
        // Вычисляем уверенность на основе расстояний
        const avgDistance = (anchors[0].distance + anchors[1].distance + anchors[2].distance) / 3;
        const maxDistance = Math.max(anchors[0].distance, anchors[1].distance, anchors[2].distance);
        const minDistance = Math.min(anchors[0].distance, anchors[1].distance, anchors[2].distance);
       
        // Чем ближе якоря и чем равномернее распределены, тем выше уверенность
        const distanceConfidence = Math.max(0, 1 - avgDistance / 200);
        const uniformityConfidence = 1 - (maxDistance - minDistance) / (avgDistance + 1);
        const confidence = Math.min(0.95, Math.max(0.3,
            distanceConfidence * 0.7 + uniformityConfidence * 0.3
        ));

        const triangle = {
            anchors: anchors.map(a => a.id),
            barycentric: bary,
            distances: anchors.map(a => a.distance),
            confirmations: anchors.map(a => a.confirmations),
            area: area,
            avgDistance: avgDistance,
            confidence: confidence,
            recordedAt: Date.now()
        };

        this.triangleMemory.set(nodeId, triangle);

        if (this.debug) {
            console.log(`   ✅ Запомнен треугольник:`);
            console.log(`      Якоря: ${triangle.anchors.map(id => id.substring(0, 10)).join(', ')}`);
            console.log(`      Координаты: (${bary.alpha.toFixed(3)}, ${bary.beta.toFixed(3)}, ${bary.gamma.toFixed(3)})`);
            console.log(`      Расстояния: ${triangle.distances.map(d => d.toFixed(1)).join(', ')}`);
            console.log(`      Среднее расстояние: ${avgDistance.toFixed(1)}`);
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
        let x = a.x * alpha + b.x * beta + c.x * gamma;
        let y = a.y * alpha + b.y * beta + c.y * gamma;

        // 🔥 ВАЖНО: НЕ КОРРЕКТИРУЕМ СЛИШКОМ СИЛЬНО!
        // Просто проверяем, что точка не улетела в бесконечность
        if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y)) {
            if (this.debug) console.log(`   ⚠️ Некорректные координаты: (${x}, ${y})`);
            return null;
        }

        // Мягкая коррекция - только если точка совсем далеко
        const bounds = this.getTriangleBounds(a, b, c);
        const padding = Math.max(bounds.width, bounds.height) * 0.5;
       
        if (x < bounds.minX - padding) x = bounds.minX;
        if (x > bounds.maxX + padding) x = bounds.maxX;
        if (y < bounds.minY - padding) y = bounds.minY;
        if (y > bounds.maxY + padding) y = bounds.maxY;

        if (this.debug) {
            console.log(`   🔺 Восстановлено по треугольнику:`);
            console.log(`      Позиция: (${x.toFixed(1)}, ${y.toFixed(1)})`);
            console.log(`      Уверенность: ${(triangle.confidence * 100).toFixed(0)}%`);
            console.log(`      Среднее расстояние в фото 2: ${triangle.avgDistance.toFixed(1)}px`);
        }

        return {
            x,
            y,
            method: 'hierarchical_triangulation',
            confidence: triangle.confidence,
            anchors: triangle.anchors,
            avgDistance: triangle.avgDistance
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
            confidence: Math.min(0.8, Math.max(0.3, confidence)),
            anchors: [anchors[0].id, anchors[1].id]
        };
    }

    // 🔥 ПОЛУЧИТЬ ГРАНИЦЫ ТРЕУГОЛЬНИКА
    getTriangleBounds(a, b, c) {
        const minX = Math.min(a.x, b.x, c.x);
        const maxX = Math.max(a.x, b.x, c.x);
        const minY = Math.min(a.y, b.y, c.y);
        const maxY = Math.max(a.y, b.y, c.y);
       
        return {
            minX, maxX, minY, maxY,
            width: maxX - minX,
            height: maxY - minY
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

    // 🔥 ПРОВЕРИТЬ, ЛЕЖИТ ЛИ ТОЧКА В ТРЕУГОЛЬНИКЕ
    isPointInTriangle(p, a, b, c) {
        const bary = this.calculateBarycentric(p, a, b, c);
        return bary.alpha >= -0.01 && bary.alpha <= 1.01 &&
               bary.beta >= -0.01 && bary.beta <= 1.01 &&
               bary.gamma >= -0.01 && bary.gamma <= 1.01;
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
                avgDistance: triangle.avgDistance,
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
                avgDistance: triangle.avgDistance,
                confidence: triangle.confidence,
                recordedAt: triangle.recordedAt
            });
        }
        console.log(`📥 Импортировано ${Object.keys(data).length} треугольников`);
    }

    // 🔥 ПОЛУЧИТЬ СТАТИСТИКУ
    getStats() {
        let total = 0;
        let sumConfidence = 0;
        let sumDistance = 0;
       
        for (const triangle of this.triangleMemory.values()) {
            total++;
            sumConfidence += triangle.confidence;
            sumDistance += triangle.avgDistance || 0;
        }
       
        return {
            totalTriangles: total,
            avgConfidence: total > 0 ? sumConfidence / total : 0,
            avgDistance: total > 0 ? sumDistance / total : 0,
            memorySize: this.triangleMemory.size
        };
    }
}

module.exports = HierarchicalTriangulation;
