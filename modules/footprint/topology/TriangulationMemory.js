// modules/footprint/topology/TriangulationMemory.js
// 🔺 ТРИАНГУЛЯЦИОННАЯ ПАМЯТЬ - ВОССТАНОВЛЕНИЕ ПО 3 ТОЧКАМ В МОДЕЛИ

class TriangulationMemory {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище треугольников для каждой точки
        this.memory = new Map(); // nodeId -> { anchor1, anchor2, anchor3, barycentric, confidence }
       
        // Для отладки и визуализации
        this.debugTriangles = [];
       
        console.log('🔺 TriangulationMemory создана (восстановление по 3 точкам В МОДЕЛИ)');
    }

    // 🔥 ЗАПОМНИТЬ ТРЕУГОЛЬНИК ИЗ 3 ОПОРНЫХ ТОЧЕК В МОДЕЛИ!
    rememberTriangle(nodeId, node, anchor1Id, anchor2Id, anchor3Id, anchor1, anchor2, anchor3) {
        // Вычисляем барицентрические координаты
        const bary = this.calculateBarycentric(node, anchor1, anchor2, anchor3);
       
        // Проверяем валидность координат
        if (bary.alpha < -0.5 || bary.alpha > 1.5 ||
            bary.beta < -0.5 || bary.beta > 1.5 ||
            bary.gamma < -0.5 || bary.gamma > 1.5) {
            if (this.debug) console.log(`   ⚠️ Барицентрические координаты вне допустимого диапазона`);
            return null;
        }

        // Вычисляем уверенность
        const confidence = this.calculateConfidence(anchor1, anchor2, anchor3, bary);
       
        const record = {
            nodeId,
            anchor1: anchor1Id,
            anchor2: anchor2Id,
            anchor3: anchor3Id,
            barycentric: bary,
            confidence,
            timestamp: Date.now(),
            // Для отладки: запоминаем позиции в обоих фото
            photo2Position: { x: node.x, y: node.y },
            photo1Positions: [
                { x: anchor1.x, y: anchor1.y },
                { x: anchor2.x, y: anchor2.y },
                { x: anchor3.x, y: anchor3.y }
            ]
        };

        this.memory.set(nodeId, record);
       
        // Сохраняем для визуализации
        this.debugTriangles.push({
            nodeId,
            photo2: record.photo2Position,
            anchors: record.photo1Positions,
            barycentric: bary,
            confidence
        });
       
        // Оставляем только последние 100 треугольников для отладки
        if (this.debugTriangles.length > 100) {
            this.debugTriangles.shift();
        }

        if (this.debug) {
            console.log(`   🔺 Запомнен треугольник В МОДЕЛИ:`);
            console.log(`      Якоря в модели: (${anchor1.x.toFixed(1)}, ${anchor1.y.toFixed(1)}), (${anchor2.x.toFixed(1)}, ${anchor2.y.toFixed(1)}), (${anchor3.x.toFixed(1)}, ${anchor3.y.toFixed(1)})`);
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
            if (this.debug) console.log(`   ⚠️ Потеряны опорные точки в модели`);
            return null;
        }

        // Восстанавливаем точку по барицентрическим координатам
        const { alpha, beta, gamma } = record.barycentric;
        const x = a.x * alpha + b.x * beta + c.x * gamma;
        const y = a.y * alpha + b.y * beta + c.y * gamma;

        if (this.debug) {
            console.log(`   🔺 Восстановлено по треугольнику В МОДЕЛИ:`);
            console.log(`      Позиция в модели: (${x.toFixed(1)}, ${y.toFixed(1)})`);
            console.log(`      Ожидаемая позиция в фото2: (${record.photo2Position.x.toFixed(1)}, ${record.photo2Position.y.toFixed(1)})`);
            console.log(`      Уверенность: ${(record.confidence * 100).toFixed(0)}%`);
        }

        return {
            x,
            y,
            method: 'triangulation_3point',
            confidence: record.confidence,
            anchors: [record.anchor1, record.anchor2, record.anchor3],
            barycentric: record.barycentric,
            photo2Position: record.photo2Position
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
       
        const areaConfidence = Math.min(1, area / 500);

        // 2. Равномерность треугольника
        const ab = this.distance(a, b);
        const bc = this.distance(b, c);
        const ca = this.distance(c, a);
        const maxSide = Math.max(ab, bc, ca);
        const minSide = Math.min(ab, bc, ca);
        const uniformityConfidence = minSide / (maxSide + 0.0001);

        // 3. Положение точки (чем ближе к центру, тем лучше)
        const centerDist = Math.abs(bary.alpha - 0.33) +
                          Math.abs(bary.beta - 0.33) +
                          Math.abs(bary.gamma - 0.33);
        const positionConfidence = 1 - Math.min(1, centerDist / 1.0);

        // Общая уверенность
        return (areaConfidence * 0.2 +
                uniformityConfidence * 0.3 +
                positionConfidence * 0.5);
    }

    // 🔥 НАЙТИ ТРИ ОПОРНЫЕ ТОЧКИ В МОДЕЛИ, КОТОРЫЕ ЛУЧШЕ ВСЕГО ПОДХОДЯТ
    findThreeBestAnchorsInModel(node, newNodeId, anchors, modelGraph) {
        if (anchors.length < 3) return [];
       
        // 1. СНАЧАЛА - ПЫТАЕМСЯ НАЙТИ ТОЧКИ В ТОЙ ЖЕ ОБЛАСТИ В МОДЕЛИ!
        // Сортируем опорные точки по Y-координате В МОДЕЛИ
        const anchorsWithModelY = anchors.map(a => ({
            ...a,
            modelY: a.node.y,
            modelX: a.node.x,
            // Вычисляем расстояние В МОДЕЛИ до предполагаемой позиции
            // (для первой итерации используем Y-координату из фото2 как ориентир)
            distToTarget: Math.abs(a.node.y - node.y)
        }));
       
        // Сортируем по близости Y-координаты к целевой
        anchorsWithModelY.sort((a, b) => a.distToTarget - b.distToTarget);
       
        if (this.debug) {
            console.log(`   🔍 Ищем опорные точки в модели с Y≈${node.y.toFixed(1)}:`);
            anchorsWithModelY.slice(0, 5).forEach((a, i) => {
                console.log(`      ${i+1}. Y=${a.node.y.toFixed(1)}, X=${a.node.x.toFixed(1)}, dist=${a.distToTarget.toFixed(1)}`);
            });
        }
       
        // Берём 3 точки с наиболее подходящей Y-координатой
        const bestByY = anchorsWithModelY.slice(0, 3);
       
        // Проверяем, не лежат ли они на одной прямой
        const a = bestByY[0].node;
        const b = bestByY[1].node;
        const c = bestByY[2].node;
       
        const area = Math.abs(
            (b.x - a.x) * (c.y - a.y) -
            (b.y - a.y) * (c.x - a.x)
        ) / 2;
       
        // Если площадь слишком мала, пробуем другие комбинации
        if (area < 50 && anchors.length > 3) {
            if (this.debug) console.log(`   ⚠️ Точки почти на одной прямой, ищу другую комбинацию`);
           
            // Пробуем комбинации из топ-6 точек по Y
            for (let i = 0; i < 6 && i < anchorsWithModelY.length; i++) {
                for (let j = i + 1; j < 6 && j < anchorsWithModelY.length; j++) {
                    for (let k = j + 1; k < 6 && k < anchorsWithModelY.length; k++) {
                        const testA = anchorsWithModelY[i].node;
                        const testB = anchorsWithModelY[j].node;
                        const testC = anchorsWithModelY[k].node;
                       
                        const testArea = Math.abs(
                            (testB.x - testA.x) * (testC.y - testA.y) -
                            (testB.y - testA.y) * (testC.x - testA.x)
                        ) / 2;
                       
                        if (testArea >= 50) {
                            return [anchorsWithModelY[i], anchorsWithModelY[j], anchorsWithModelY[k]];
                        }
                    }
                }
            }
        }
       
        return bestByY;
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
       
        // Очищаем и отладочные треугольники
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
                anchor1: record.anchor1,
                anchor2: record.anchor2,
                anchor3: record.anchor3,
                barycentric: record.barycentric,
                confidence: record.confidence,
                timestamp: record.timestamp,
                photo2Position: record.photo2Position
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
                timestamp: record.timestamp,
                photo2Position: record.photo2Position,
                photo1Positions: [] // Будут восстановлены при реконструкции
            });
        }
        console.log(`📥 Импортировано ${Object.keys(data).length} треугольников`);
    }

    // 🔥 ПОЛУЧИТЬ СТАТИСТИКУ
    getStats() {
        let total = 0;
        let sumConfidence = 0;
        let sumY = 0;
       
        for (const record of this.memory.values()) {
            total++;
            sumConfidence += record.confidence;
            sumY += record.photo2Position?.y || 0;
        }
       
        return {
            totalTriangles: total,
            avgConfidence: total > 0 ? sumConfidence / total : 0,
            avgY: total > 0 ? sumY / total : 0,
            memorySize: this.memory.size,
            debugTriangles: this.debugTriangles.length
        };
    }
}

module.exports = TriangulationMemory;
