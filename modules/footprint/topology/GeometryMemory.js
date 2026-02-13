// modules/footprint/topology/GeometryMemory.js
// 📐 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ - ВОССТАНОВЛЕНИЕ ПОЗИЦИЙ ПО ТРЁМ БЛИЖАЙШИМ ТОЧКАМ

class GeometryMemory {
    constructor(options = {}) {
        this.debug = options.debug || false;
        
        // Хранилище позиций: nodeId -> { anchors, barycentric, confidence }
        this.positions = new Map();
        
        console.log('📐 GeometryMemory создана (восстановление позиций)');
    }

    // 🔥 ЗАПОМНИТЬ ПОЗИЦИЮ ТОЧКИ
    remember(nodeId, node, anchors, barycentric) {
        if (!anchors || anchors.length < 3) {
            if (this.debug) {
                console.log(`   ⚠️ Не удалось запомнить ${nodeId.substring(0, 20)}... (мало якорей: ${anchors?.length || 0})`);
            }
            return false;
        }

        this.positions.set(nodeId, {
            nodeId,
            anchors: anchors.map(a => a.id),
            barycentric,
            confidence: 1.0,
            recordedAt: Date.now(),
            lastAccessed: Date.now()
        });

        if (this.debug) {
            console.log(`   📐 Запомнена позиция ${nodeId.substring(0, 20)}...`);
            console.log(`      Якоря: ${anchors.map(a => a.id.substring(0, 10)).join(', ')}`);
        }

        return true;
    }

    // 🔥 ВОССТАНОВИТЬ ПОЗИЦИЮ
    reconstruct(nodeId, modelGraph) {
        const pos = this.positions.get(nodeId);
        if (!pos) {
            if (this.debug) {
                console.log(`   ⚠️ Нет записи в памяти для ${nodeId.substring(0, 20)}...`);
            }
            return null;
        }

        const [aId, bId, cId] = pos.anchors;
        const a = modelGraph.nodes.get(aId);
        const b = modelGraph.nodes.get(bId);
        const c = modelGraph.nodes.get(cId);

        if (!a || !b || !c) {
            if (this.debug) {
                console.log(`   ⚠️ Потеряны якоря для ${nodeId.substring(0, 20)}...`);
                console.log(`      A: ${aId ? 'есть' : 'нет'}, B: ${bId ? 'есть' : 'нет'}, C: ${cId ? 'есть' : 'нет'}`);
            }
            return null;
        }

        const { alpha, beta, gamma } = pos.barycentric;
        const x = a.x * alpha + b.x * beta + c.x * gamma;
        const y = a.y * alpha + b.y * beta + c.y * gamma;

        // Обновляем время доступа
        pos.lastAccessed = Date.now();

        return { x, y, confidence: pos.confidence };
    }

    // 🔥 ПОДТВЕРДИТЬ ТОЧКУ (УВЕЛИЧИТЬ ДОВЕРИЕ)
    confirm(nodeId) {
        const pos = this.positions.get(nodeId);
        if (pos) {
            pos.confidence = Math.min(1.0, pos.confidence + 0.1);
            pos.lastAccessed = Date.now();
            return true;
        }
        return false;
    }

    // 🔥 НАЙТИ ТРИ БЛИЖАЙШИЕ ТОЧКИ В ГРАФЕ
    findThreeClosest(node, graph, excludeNodeId = null) {
        const distances = [];
        
        for (const [otherId, otherNode] of graph.nodes) {
            // Исключаем саму точку и опционально указанный ID
            if (otherId === node.id) continue;
            if (excludeNodeId && otherId === excludeNodeId) continue;
            
            const dx = node.x - otherNode.x;
            const dy = node.y - otherNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            distances.push({ 
                id: otherId, 
                node: otherNode, 
                dist 
            });
        }

        // Сортируем по расстоянию и берём 3 ближайших
        const closest = distances
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 3);

        if (this.debug && closest.length < 3) {
            console.log(`   ⚠️ Найдено только ${closest.length}/3 ближайших точек`);
        }

        return closest;
    }

    // 🔥 НАЙТИ ТРИ БЛИЖАЙШИЕ ТОЧКИ ТОЛЬКО СРЕДИ ИДЕНТИФИЦИРОВАННЫХ
    findThreeClosestIdentified(node, graph, identifiedMap) {
        const distances = [];
        
        for (const [otherId, otherNode] of graph.nodes) {
            // Только точки, которые есть в identifiedMap
            if (!identifiedMap.has(otherId)) continue;
            if (otherId === node.id) continue;
            
            const dx = node.x - otherNode.x;
            const dy = node.y - otherNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            distances.push({ 
                id: otherId, 
                node: otherNode, 
                dist 
            });
        }

        const closest = distances
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 3);

        if (this.debug) {
            console.log(`   🔍 Найдено ${closest.length}/3 идентифицированных ближайших точек`);
            closest.forEach((c, i) => {
                console.log(`      ${i+1}. ${c.id.substring(0, 20)}... (${c.node.x.toFixed(1)}, ${c.node.y.toFixed(1)}) dist: ${c.dist.toFixed(1)}`);
            });
        }

        return closest;
    }

    // 🔥 ВЫЧИСЛИТЬ БАРИЦЕНТРИЧЕСКИЕ КООРДИНАТЫ
    computeBarycentric(p, a, b, c) {
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

        if (this.debug) {
            console.log(`      Барицентрические: (${alpha.toFixed(3)}, ${beta.toFixed(3)}, ${gamma.toFixed(3)})`);
        }

        return { alpha, beta, gamma };
    }

    // 🔥 ПРОВЕРИТЬ, ЕСТЬ ЛИ ТОЧКА В ПАМЯТИ
    has(nodeId) {
        return this.positions.has(nodeId);
    }

    // 🔥 ПОЛУЧИТЬ ВСЕ ЗАПОМНЕННЫЕ ТОЧКИ
    getAll() {
        return Array.from(this.positions.entries());
    }

    // 🔥 ОЧИСТИТЬ СТАРЫЕ ЗАПИСИ
    cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) {
        const now = Date.now();
        let removed = 0;
        
        for (const [nodeId, pos] of this.positions) {
            if (now - pos.lastAccessed > maxAge) {
                this.positions.delete(nodeId);
                removed++;
            }
        }
        
        if (removed > 0 && this.debug) {
            console.log(`🧹 Удалено ${removed} устаревших позиций`);
        }
        
        return removed;
    }

    // 🔥 ПОЛУЧИТЬ СТАТИСТИКУ
    getStats() {
        let totalConfidence = 0;
        for (const pos of this.positions.values()) {
            totalConfidence += pos.confidence;
        }

        return {
            totalPositions: this.positions.size,
            avgConfidence: this.positions.size > 0 ? totalConfidence / this.positions.size : 0,
            memoryUsage: this.positions.size
        };
    }

    // 🔥 ЭКСПОРТ
    export() {
        return Array.from(this.positions.entries());
    }

    // 🔥 ИМПОРТ
    import(data) {
        if (Array.isArray(data)) {
            this.positions = new Map(data);
        } else if (data && typeof data === 'object') {
            this.positions = new Map(Object.entries(data));
        }
        
        console.log(`📥 Импортировано ${this.positions.size} позиций`);
        
        if (this.debug) {
            const stats = this.getStats();
            console.log(`   Средняя уверенность: ${(stats.avgConfidence * 100).toFixed(1)}%`);
        }
    }

    // 🔥 ОТЛАДОЧНЫЙ МЕТОД
    debug() {
        console.log(`\n📊 СТАТИСТИКА GEOMETRY MEMORY:`);
        console.log(`   Всего записей: ${this.positions.size}`);
        
        if (this.positions.size > 0) {
            let samples = Array.from(this.positions.entries()).slice(0, 3);
            samples.forEach(([nodeId, pos]) => {
                console.log(`   📍 ${nodeId.substring(0, 20)}...`);
                console.log(`      Якоря: ${pos.anchors.map(a => a.substring(0, 10)).join(', ')}`);
                console.log(`      Уверенность: ${(pos.confidence * 100).toFixed(0)}%`);
            });
        }
    }
}

module.exports = GeometryMemory;
