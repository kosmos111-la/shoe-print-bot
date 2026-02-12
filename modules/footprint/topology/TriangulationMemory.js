// modules/footprint/topology/TriangulationMemory.js
// 🔺 ТРИАНГУЛЯЦИОННАЯ ПАМЯТЬ - ВОССТАНОВЛЕНИЕ ПО 3 ТОЧКАМ

class TriangulationMemory {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище треугольников для каждой точки
        // nodeId -> { anchor1, anchor2, anchor3, barycentric, confidence }
        this.memory = new Map();
       
        console.log('🔺 TriangulationMemory создана (восстановление по 3 точкам)');
    }

    // 🔥 ЗАПОМНИТЬ ТРЕУГОЛЬНИК ИЗ 3 ОПОРНЫХ ТОЧЕК
    rememberTriangle(nodeId, node, anchor1Id, anchor2Id, anchor3Id, anchor1, anchor2, anchor3) {
        // Вычисляем барицентрические координаты точки внутри треугольника
        const bary = this.calculateBarycentric(node, anchor1, anchor2, anchor3);
       
        // Проверяем валидность координат (допускаем небольшие отрицательные значения)
        if (bary.alpha < -0.1 || bary.alpha > 1.1 ||
            bary.beta < -0.1 || bary.beta > 1.1 ||
            bary.gamma < -0.1 || bary.gamma > 1.1) {
            if (this.debug) console.log(`   ⚠️ Барицентрические координаты вне допустимого диапазона`);
            return null;
        }

        // Вычисляем уверенность на основе качества треугольника
        const confidence = this.calculateConfidence(anchor1, anchor2, anchor3, bary);
       
        const record = {
            nodeId,
            anchor1: anchor1Id,
            anchor2: anchor2Id,
            anchor3: anchor3Id,
            barycentric: bary,
            confidence,
            timestamp: Date.now()
        };

        this.memory.set(nodeId, record);

        if (this.debug) {
            console.log(`   🔺 Запомнен треугольник:`);
            console.log(`      Координаты: (${bary.alpha.toFixed(3)}, ${bary.beta.toFixed(3)}, ${bary.gamma.toFixed(3)})`);
            console.log(`      Уверенность: ${(confidence * 100).toFixed(0)}%`);
        }

        return record;
    }

    // 🔥 ВОССТАНОВИТЬ ТОЧКУ ПО ТРЕУГОЛЬНИКУ
    reconstructPosition(nodeId, modelGraph) {
        const record = this.memory.get(nodeId);
        if (!record) {
            return null;
        }

        const a = modelGraph.nodes.get(record.anchor1);
        const b = modelGraph.nodes.get(record.anchor2);
        const c = modelGraph.nodes.get(record.anchor3);

        if (!a || !b || !c) {
            if (this.debug) console.log(`   ⚠️ Потеряны опорные точки`);
            return null;
        }

        // Восстанавливаем точку по барицентрическим координатам
        const { alpha, beta, gamma } = record.barycentric;
        const x = a.x * alpha + b.x * beta + c.x * gamma;
        const y = a.y * alpha + b.y * beta + c.y * gamma;

        if (this.debug) {
            console.log(`   🔺 Восстановлено по треугольнику:`);
            console.log(`      Позиция: (${x.toFixed(1)}, ${y.toFixed(1)})`);
            console.log(`      Уверенность: ${(record.confidence * 100).toFixed(0)}%`);
        }

        return {
            x,
            y,
            method: 'triangulation_3point',
            confidence: record.confidence,
            anchors: [record.anchor1, record.anchor2, record.anchor3]
        };
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

    // 🔥 ВЫЧИСЛИТЬ УВЕРЕННОСТЬ
    calculateConfidence(a, b, c, bary) {
        // 1. Площадь треугольника (чем больше, тем лучше)
        const area = Math.abs(
            (b.x - a.x) * (c.y - a.y) -
            (b.y - a.y) * (c.x - a.x)
        ) / 2;
       
        const areaConfidence = Math.min(1, area / 1000);

        // 2. Равномерность треугольника (чем ближе к равностороннему, тем лучше)
        const ab = this.distance(a, b);
        const bc = this.distance(b, c);
        const ca = this.distance(c, a);
        const maxSide = Math.max(ab, bc, ca);
        const minSide = Math.min(ab, bc, ca);
        const uniformityConfidence = minSide / maxSide;

        // 3. Положение точки (ближе к центру - лучше)
        const centerDist = Math.abs(bary.alpha - 0.33) +
                          Math.abs(bary.beta - 0.33) +
                          Math.abs(bary.gamma - 0.33);
        const positionConfidence = 1 - Math.min(1, centerDist / 0.66);

        // Общая уверенность
        return (areaConfidence * 0.3 +
                uniformityConfidence * 0.3 +
                positionConfidence * 0.4);
    }

    // 🔥 РАССТОЯНИЕ
    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 🔥 НАЙТИ ТРИ БЛИЖАЙШИЕ ОПОРНЫЕ ТОЧКИ
    findThreeClosestAnchors(node, anchors) {
        if (anchors.length < 3) return [];
       
        // Сортируем все опорные точки по расстоянию
        const withDistance = anchors.map(a => ({
            ...a,
            distance: this.distance(node, a.newNode)
        }));
       
        withDistance.sort((a, b) => a.distance - b.distance);
       
        // Берём 3 ближайших
        const closest = withDistance.slice(0, 3);
       
        // Проверяем, не лежат ли они на одной прямой
        const a = closest[0].node;
        const b = closest[1].node;
        const c = closest[2].node;
       
        const area = Math.abs(
            (b.x - a.x) * (c.y - a.y) -
            (b.y - a.y) * (c.x - a.x)
        ) / 2;
       
        // Если точки почти на одной прямой, пробуем следующую комбинацию
        if (area < 10 && anchors.length > 3) {
            if (this.debug) console.log(`   ⚠️ Точки почти на одной прямой, ищу другую комбинацию`);
           
            // Пробуем (0,1,3), (0,2,3), (1,2,3) и т.д.
            for (let i = 0; i < 4 && i < withDistance.length; i++) {
                for (let j = i + 1; j < 5 && j < withDistance.length; j++) {
                    for (let k = j + 1; k < 6 && k < withDistance.length; k++) {
                        const testA = withDistance[i].node;
                        const testB = withDistance[j].node;
                        const testC = withDistance[k].node;
                       
                        const testArea = Math.abs(
                            (testB.x - testA.x) * (testC.y - testA.y) -
                            (testB.y - testA.y) * (testC.x - testA.x)
                        ) / 2;
                       
                        if (testArea >= 10) {
                            return [withDistance[i], withDistance[j], withDistance[k]];
                        }
                    }
                }
            }
        }
       
        return closest;
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
                anchor1: record.anchor1,
                anchor2: record.anchor2,
                anchor3: record.anchor3,
                barycentric: record.barycentric,
                confidence: record.confidence,
                timestamp: record.timestamp
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
                anchor1: record.anchor1,
                anchor2: record.anchor2,
                anchor3: record.anchor3,
                barycentric: record.barycentric,
                confidence: record.confidence,
                timestamp: record.timestamp
            });
        }
        console.log(`📥 Импортировано ${Object.keys(data).length} треугольников`);
    }

    // 🔥 ПОЛУЧИТЬ СТАТИСТИКУ
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
            memorySize: this.memory.size
        };
    }
}

module.exports = TriangulationMemory;
