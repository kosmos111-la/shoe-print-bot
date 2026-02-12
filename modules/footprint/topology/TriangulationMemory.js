// modules/footprint/topology/TriangulationMemory.js
// 🔺 ТРИАНГУЛЯЦИОННАЯ ПАМЯТЬ - ВОССТАНОВЛЕНИЕ ПО 3 ТОЧКАМ ЧЕРЕЗ МАППИНГ

class TriangulationMemory {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище треугольников для каждой точки
        // nodeId -> { photo2Anchors, modelAnchors, barycentric, confidence }
        this.memory = new Map();
       
        // Для отладки и визуализации
        this.debugTriangles = [];
       
        console.log('🔺 TriangulationMemory создана (восстановление через маппинг)');
    }

    // 🔥🔥🔥 ЗАПОМНИТЬ ТРЕУГОЛЬНИК В ФОТО2 И СООТВЕТСТВИЯ В МОДЕЛИ
    rememberTriangle(nodeId,
                    photo2Point,           // точка в фото2
                    photo2Anchors,         // массив {id, node} - 3 точки в фото2
                    modelAnchors) {        // массив {id, node} - те же 3 точки в модели
       
        // Вычисляем барицентрические координаты В ФОТО2
        const bary = this.calculateBarycentric(
            photo2Point,
            photo2Anchors[0].node,
            photo2Anchors[1].node,
            photo2Anchors[2].node
        );
       
        // Проверяем валидность координат
        if (bary.alpha < -0.5 || bary.alpha > 1.5 ||
            bary.beta < -0.5 || bary.beta > 1.5 ||
            bary.gamma < -0.5 || bary.gamma > 1.5) {
            if (this.debug) console.log(`   ⚠️ Барицентрические координаты вне диапазона`);
            return null;
        }

        // Вычисляем уверенность
        const confidence = this.calculateConfidence(
            photo2Anchors[0].node,
            photo2Anchors[1].node,
            photo2Anchors[2].node,
            bary
        );
       
        const record = {
            nodeId,
            // ID опорных точек В МОДЕЛИ (для восстановления)
            modelAnchorIds: [
                modelAnchors[0].id,
                modelAnchors[1].id,
                modelAnchors[2].id
            ],
            // Барицентрические координаты из фото2
            barycentric: bary,
            confidence,
            timestamp: Date.now(),
            // Для отладки
            photo2Position: {
                x: photo2Point.x,
                y: photo2Point.y
            },
            photo2AnchorPositions: photo2Anchors.map(a => ({
                x: a.node.x,
                y: a.node.y
            })),
            modelAnchorPositions: modelAnchors.map(a => ({
                x: a.node.x,
                y: a.node.y
            }))
        };

        this.memory.set(nodeId, record);
       
        // Сохраняем для визуализации
        this.debugTriangles.push({
            nodeId,
            photo2: record.photo2Position,
            photo2Anchors: record.photo2AnchorPositions,
            modelAnchors: record.modelAnchorPositions,
            barycentric: bary,
            confidence
        });
       
        // Оставляем только последние 100
        if (this.debugTriangles.length > 100) {
            this.debugTriangles.shift();
        }

        if (this.debug) {
            console.log(`   🔺 Запомнен треугольник:`);
            console.log(`      Точка в фото2: (${photo2Point.x.toFixed(1)}, ${photo2Point.y.toFixed(1)})`);
            console.log(`      Якоря в фото2:`);
            photo2Anchors.forEach((a, i) => {
                console.log(`         ${i+1}: (${a.node.x.toFixed(1)}, ${a.node.y.toFixed(1)})`);
            });
            console.log(`      Соответствия в модели:`);
            modelAnchors.forEach((a, i) => {
                console.log(`         ${i+1}: (${a.node.x.toFixed(1)}, ${a.node.y.toFixed(1)})`);
            });
            console.log(`      Барицентрические координаты: (${bary.alpha.toFixed(3)}, ${bary.beta.toFixed(3)}, ${bary.gamma.toFixed(3)})`);
            console.log(`      Уверенность: ${(confidence * 100).toFixed(0)}%`);
        }

        return record;
    }

    // 🔥🔥🔥 ВОССТАНОВИТЬ ТОЧКУ ПО ТРЕУГОЛЬНИКУ В МОДЕЛИ
    reconstructPosition(nodeId, modelGraph) {
        const record = this.memory.get(nodeId);
        if (!record) {
            return null;
        }

        // Получаем точки из модели по ID
        const a = modelGraph.nodes.get(record.modelAnchorIds[0]);
        const b = modelGraph.nodes.get(record.modelAnchorIds[1]);
        const c = modelGraph.nodes.get(record.modelAnchorIds[2]);

        if (!a || !b || !c) {
            if (this.debug) console.log(`   ⚠️ Потеряны опорные точки в модели`);
            return null;
        }

        // Применяем ТЕ ЖЕ САМЫЕ барицентрические координаты
        const { alpha, beta, gamma } = record.barycentric;
        const x = a.x * alpha + b.x * beta + c.x * gamma;
        const y = a.y * alpha + b.y * beta + c.y * gamma;

        if (this.debug) {
            console.log(`   🔺 Восстановлено по треугольнику:`);
            console.log(`      Якоря в модели:`);
            console.log(`         1: (${a.x.toFixed(1)}, ${a.y.toFixed(1)})`);
            console.log(`         2: (${b.x.toFixed(1)}, ${b.y.toFixed(1)})`);
            console.log(`         3: (${c.x.toFixed(1)}, ${c.y.toFixed(1)})`);
            console.log(`      Позиция в модели: (${x.toFixed(1)}, ${y.toFixed(1)})`);
            console.log(`      Уверенность: ${(record.confidence * 100).toFixed(0)}%`);
        }

        return {
            x,
            y,
            method: 'triangulation_3point',
            confidence: record.confidence,
            modelAnchorIds: record.modelAnchorIds,
            barycentric: record.barycentric,
            photo2Position: record.photo2Position
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

    // 🔥 ВЫЧИСЛИТЬ УВЕРЕННОСТЬ
    calculateConfidence(a, b, c, bary) {
        const area = Math.abs(
            (b.x - a.x) * (c.y - a.y) -
            (b.y - a.y) * (c.x - a.x)
        ) / 2;
       
        const areaConfidence = Math.min(1, area / 500);

        const ab = this.distance(a, b);
        const bc = this.distance(b, c);
        const ca = this.distance(c, a);
        const maxSide = Math.max(ab, bc, ca);
        const minSide = Math.min(ab, bc, ca);
        const uniformityConfidence = minSide / (maxSide + 0.0001);

        const centerDist = Math.abs(bary.alpha - 0.33) +
                          Math.abs(bary.beta - 0.33) +
                          Math.abs(bary.gamma - 0.33);
        const positionConfidence = 1 - Math.min(1, centerDist / 1.0);

        return (areaConfidence * 0.2 +
                uniformityConfidence * 0.3 +
                positionConfidence * 0.5);
    }

    // 🔥 НАЙТИ ТРИ БЛИЖАЙШИЕ ОПОРНЫЕ ТОЧКИ В ФОТО2
    findThreeClosestAnchorsInPhoto2(point, anchors) {
        if (anchors.length < 3) return [];
       
        const withDistance = anchors.map(a => ({
            ...a,
            distance: this.distance(point, a.newNode),
            photo2Point: a.newNode,
            modelPoint: a.node
        }));
       
        withDistance.sort((a, b) => a.distance - b.distance);
       
        return withDistance.slice(0, 3);
    }

    // 🔥 РАССТОЯНИЕ
    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 🔥 ПОЛУЧИТЬ ТРЕУГОЛЬНИКИ ДЛЯ ВИЗУАЛИЗАЦИИ
    getDebugTriangles() {
        return this.debugTriangles;
    }

    // 🔥 ОЧИСТИТЬ СТАРЫЕ ЗАПИСИ
    cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) {
        const now = Date.now();
        let removed = 0;
       
        for (const [nodeId, record] of this.memory) {
            if (now - record.timestamp > maxAge) {
                this.memory.delete(nodeId);
                removed++;
            }
        }
       
        this.debugTriangles = this.debugTriangles.filter(t =>
            this.memory.has(t.nodeId)
        );
       
        if (removed > 0 && this.debug) {
            console.log(`🧹 Удалено ${removed} устаревших треугольников`);
        }
       
        return removed;
    }

    // 🔥 ЭКСПОРТ
    export() {
        const data = {};
        for (const [nodeId, record] of this.memory) {
            data[nodeId] = {
                modelAnchorIds: record.modelAnchorIds,
                barycentric: record.barycentric,
                confidence: record.confidence,
                timestamp: record.timestamp,
                photo2Position: record.photo2Position,
                photo2AnchorPositions: record.photo2AnchorPositions,
                modelAnchorPositions: record.modelAnchorPositions
            };
        }
        return data;
    }

    // 🔥 ИМПОРТ
    import(data) {
        if (!data) return;
        for (const [nodeId, record] of Object.entries(data)) {
            this.memory.set(nodeId, {
                nodeId,
                modelAnchorIds: record.modelAnchorIds,
                barycentric: record.barycentric,
                confidence: record.confidence,
                timestamp: record.timestamp,
                photo2Position: record.photo2Position,
                photo2AnchorPositions: record.photo2AnchorPositions,
                modelAnchorPositions: record.modelAnchorPositions
            });
           
            this.debugTriangles.push({
                nodeId,
                photo2: record.photo2Position,
                photo2Anchors: record.photo2AnchorPositions,
                modelAnchors: record.modelAnchorPositions,
                barycentric: record.barycentric,
                confidence: record.confidence
            });
        }
       
        if (this.debugTriangles.length > 100) {
            this.debugTriangles = this.debugTriangles.slice(-100);
        }
       
        console.log(`📥 Импортировано ${Object.keys(data).length} треугольников`);
    }

    getStats() {
        let total = 0;
        let sumConfidence = 0;
       
        for (const record of this.memory.values()) {
            total++;
            sumConfidence += record.confidence;
        }
       
        return {
            totalTriangles: total,
            avgConfidence: total > 0 ? sumConfidence / total : 0,
            memorySize: this.memory.size,
            debugTriangles: this.debugTriangles.length
        };
    }
}

module.exports = TriangulationMemory;
