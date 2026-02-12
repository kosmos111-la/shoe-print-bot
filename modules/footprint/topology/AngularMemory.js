// modules/footprint/topology/AngularMemory.js
// 📐 УГЛОВАЯ ПАМЯТЬ - ИНВАРИАНТНОЕ ВОССТАНОВЛЕНИЕ ПО УГЛАМ

class AngularMemory {
    constructor(options = {}) {
        this.debug = options.debug || false;
        
        // Хранилище угловых отношений
        // nodeId -> { anchor1, anchor2, angle, ratio, confidence }
        this.memory = new Map();
        
        console.log('📐 AngularMemory создана (восстановление по углам)');
    }

    // 🔥 ЗАПОМНИТЬ УГОЛ МЕЖДУ ДВУМЯ ОПОРНЫМИ ТОЧКАМИ
    rememberAngle(nodeId, node, anchor1Id, anchor2Id, anchor1, anchor2) {
        // Вычисляем угол AXB - угол при вершине X между векторами X→A и X→B
        const angle = this.calculateAngle(node, anchor1, anchor2);
        
        // Вычисляем соотношение расстояний для разрешения зеркальности
        const dist1 = this.distance(node, anchor1);
        const dist2 = this.distance(node, anchor2);
        const ratio = dist1 / (dist2 + 0.0001); // избегаем деления на ноль
        
        // Вычисляем уверенность:
        // - Чем ближе угол к 90°, тем лучше (максимум при 90°)
        // - Чем ближе соотношение к 1, тем лучше
        const angleConfidence = 1 - Math.abs(90 - angle) / 90;
        const ratioConfidence = 1 - Math.abs(1 - ratio);
        const confidence = (angleConfidence * 0.7 + ratioConfidence * 0.3);
        
        const record = {
            nodeId,
            anchor1: anchor1Id,
            anchor2: anchor2Id,
            angle,
            ratio,
            confidence,
            timestamp: Date.now()
        };

        this.memory.set(nodeId, record);

        if (this.debug) {
            console.log(`   📐 Запомнен угол: ${angle.toFixed(1)}° (уверенность ${(confidence * 100).toFixed(0)}%)`);
            console.log(`      Отношение расстояний: ${ratio.toFixed(3)}`);
        }

        return record;
    }

    // 🔥 ВОССТАНОВИТЬ ТОЧКУ ПО УГЛУ И СООТНОШЕНИЮ
    reconstructPosition(nodeId, modelGraph) {
        const record = this.memory.get(nodeId);
        if (!record) {
            return null;
        }

        const anchor1 = modelGraph.nodes.get(record.anchor1);
        const anchor2 = modelGraph.nodes.get(record.anchor2);

        if (!anchor1 || !anchor2) {
            if (this.debug) console.log(`   ⚠️ Потеряны опорные точки`);
            return null;
        }

        // Восстанавливаем точку по углу и соотношению расстояний
        const position = this.reconstructFromAngleAndRatio(
            anchor1, anchor2, 
            record.angle, 
            record.ratio
        );

        if (position) {
            // Проверяем, не получилась ли зеркальная точка
            // Берем любую известную точку для проверки ориентации
            const testNode = modelGraph.nodes.values().next().value;
            if (testNode) {
                const originalOrientation = this.calculateOrientation(anchor1, anchor2, testNode);
                const newOrientation = this.calculateOrientation(anchor1, anchor2, position);
                
                // Если ориентация не совпадает - отражаем точку
                if (originalOrientation * newOrientation < 0) {
                    position.y = anchor1.y + (anchor2.y - anchor1.y) - (position.y - anchor1.y);
                    if (this.debug) console.log(`      🔄 Отразил точку (коррекция зеркальности)`);
                }
            }

            if (this.debug) {
                console.log(`   📐 Восстановлено по углу: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
                console.log(`      Угол: ${record.angle.toFixed(1)}°, уверенность: ${(record.confidence * 100).toFixed(0)}%`);
            }
        }

        return position;
    }

    // 🔥 ВЫЧИСЛИТЬ УГОЛ МЕЖДУ ДВУМЯ ВЕКТОРАМИ ОТ ВЕРШИНЫ
    calculateAngle(vertex, a, b) {
        const v1 = { x: a.x - vertex.x, y: a.y - vertex.y };
        const v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
        
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        
        if (mag1 < 0.0001 || mag2 < 0.0001) return 0;
        
        const cos = dot / (mag1 * mag2);
        // Ограничиваем cos от -1 до 1 из-за погрешностей
        const clampedCos = Math.max(-1, Math.min(1, cos));
        
        return Math.acos(clampedCos) * 180 / Math.PI;
    }

    // 🔥 ВЫЧИСЛИТЬ РАССТОЯНИЕ
    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 🔥 ВЫЧИСЛИТЬ ОРИЕНТАЦИЮ (ДЛЯ ПРОВЕРКИ ЗЕРКАЛЬНОСТИ)
    calculateOrientation(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    // 🔥 ВОССТАНОВИТЬ ТОЧКУ ПО УГЛУ И СООТНОШЕНИЮ РАССТОЯНИЙ
    reconstructFromAngleAndRatio(a, b, angle, ratio) {
        // Расстояние между опорными точками
        const ab = this.distance(a, b);
        if (ab < 0.0001) return null;

        // Переводим угол в радианы
        const rad = angle * Math.PI / 180;
        
        // По теореме косинусов находим расстояния до опорных точек
        // d1^2 + d2^2 - 2*d1*d2*cos(angle) = ab^2
        // d1 / d2 = ratio
        
        const d2 = ab / Math.sqrt(ratio * ratio + 1 - 2 * ratio * Math.cos(rad));
        const d1 = d2 * ratio;

        // Находим точку пересечения двух окружностей
        return this.intersectCircles(a, d1, b, d2);
    }

    // 🔥 НАЙТИ ТОЧКУ ПЕРЕСЕЧЕНИЯ ДВУХ ОКРУЖНОСТЕЙ
    intersectCircles(c1, r1, c2, r2) {
        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        // Окружности не пересекаются
        if (d > r1 + r2 || d < Math.abs(r1 - r2) || d < 0.0001) {
            // Возвращаем точку на линии между центрами
            const t = r1 / (r1 + r2);
            return {
                x: c1.x + dx * t,
                y: c1.y + dy * t
            };
        }

        // Находим точку пересечения
        const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
        const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));

        const x0 = c1.x + (dx * a) / d;
        const y0 = c1.y + (dy * a) / d;

        // Выбираем одну из двух точек пересечения
        // (вторая точка симметрична относительно линии c1-c2)
        return {
            x: x0 - (dy * h) / d,
            y: y0 + (dx * h) / d
        };
    }

    // 🔥 НАЙТИ ДВЕ БЛИЖАЙШИЕ ОПОРНЫЕ ТОЧКИ
    findTwoClosestAnchors(node, anchors) {
        let best = [];
        let bestDist = Infinity;
        
        for (let i = 0; i < anchors.length; i++) {
            for (let j = i + 1; j < anchors.length; j++) {
                const a = anchors[i];
                const b = anchors[j];
                
                const dist1 = this.distance(node, a.node);
                const dist2 = this.distance(node, b.node);
                const maxDist = Math.max(dist1, dist2);
                
                // Выбираем пару с минимальным максимальным расстоянием
                if (maxDist < bestDist) {
                    bestDist = maxDist;
                    best = [a, b];
                }
            }
        }
        
        return best;
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
            console.log(`🧹 Удалено ${removed} устаревших угловых записей`);
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
                angle: record.angle,
                ratio: record.ratio,
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
                angle: record.angle,
                ratio: record.ratio,
                confidence: record.confidence,
                timestamp: record.timestamp
            });
        }
        console.log(`📥 Импортировано ${Object.keys(data).length} угловых записей`);
    }

    // 🔥 ПОЛУЧИТЬ СТАТИСТИКУ
    getStats() {
        let total = 0;
        let sumConfidence = 0;
        let sumAngle = 0;
        
        for (const record of this.memory.values()) {
            total++;
            sumConfidence += record.confidence;
            sumAngle += record.angle;
        }
        
        return {
            totalAngles: total,
            avgConfidence: total > 0 ? sumConfidence / total : 0,
            avgAngle: total > 0 ? sumAngle / total : 0,
            memorySize: this.memory.size
        };
    }
}

module.exports = AngularMemory;
