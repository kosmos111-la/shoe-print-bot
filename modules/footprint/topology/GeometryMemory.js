// modules/footprint/topology/GeometryMemory.js
// 📐 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ - ЗАПОМИНАЕМ ПОЗИЦИИ ТОЧЕК

class GeometryMemory {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище геометрии для каждой точки
        // nodeId -> { triangle, barycentric, confidence, firstSeen }
        this.memory = new Map();
       
        // Связи между "большими" и "маленькими" точками
        // clusterHeadId -> [childIds]
        this.clusters = new Map();
       
        console.log('📐 GeometryMemory создана');
    }

    // 🔥 ЗАПОМНИТЬ ПОЗИЦИЮ ТОЧКИ
    remember(nodeId, node, neighbors, newGraph, modelGraph, mapping) {
        // 1. Находим 3 ближайшие ТОЧКИ В ЭТОМ ЖЕ ФОТО
        const closest = this.findThreeClosest(node, newGraph);
       
        // 2. Проверяем, есть ли они в маппинге
        const mappedNeighbors = closest
            .map(id => mapping.get(id))
            .filter(id => id && modelGraph.nodes.has(id));
       
        if (mappedNeighbors.length < 3) {
            if (this.debug) console.log(`   ⚠️ ${nodeId} - недостаточно опорных точек`);
            return false;
        }

        // 3. Берём ТРИ ТОЧКИ ИЗ МОДЕЛИ
        const [aId, bId, cId] = mappedNeighbors.slice(0, 3);
        const a = modelGraph.nodes.get(aId);
        const b = modelGraph.nodes.get(bId);
        const c = modelGraph.nodes.get(cId);

        // 4. Получаем их координаты В ЭТОМ ЖЕ ФОТО
        const aNew = newGraph.nodes.get(closest[0]);
        const bNew = newGraph.nodes.get(closest[1]);
        const cNew = newGraph.nodes.get(closest[2]);

        // 5. Вычисляем барицентрические координаты
        const bary = this.computeBarycentric(node, aNew, bNew, cNew);

        // 6. Запоминаем
        this.memory.set(nodeId, {
            nodeId,
            anchors: [aId, bId, cId],
            barycentric: bary,
            confidence: 1.0,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            timesSeen: 1
        });

        if (this.debug) {
            console.log(`   📐 Запомнена позиция ${nodeId.substring(0, 20)}...`);
            console.log(`      Якоря: ${aId.substring(0, 10)}..., ${bId.substring(0, 10)}..., ${cId.substring(0, 10)}...`);
        }

        return true;
    }

    // 🔥 ВОССТАНОВИТЬ ПОЗИЦИЮ
    reconstruct(nodeId, modelGraph) {
        const mem = this.memory.get(nodeId);
        if (!mem) return null;

        const [aId, bId, cId] = mem.anchors;
        const a = modelGraph.nodes.get(aId);
        const b = modelGraph.nodes.get(bId);
        const c = modelGraph.nodes.get(cId);

        if (!a || !b || !c) return null;

        const { alpha, beta, gamma } = mem.barycentric;
        const x = a.x * alpha + b.x * beta + c.x * gamma;
        const y = a.y * alpha + b.y * beta + c.y * gamma;

        return { x, y, confidence: mem.confidence };
    }

    // 🔥 ПОДТВЕРДИТЬ ТОЧКУ (УВЕЛИЧИТЬ ДОВЕРИЕ)
    confirm(nodeId) {
        const mem = this.memory.get(nodeId);
        if (mem) {
            mem.timesSeen++;
            mem.lastSeen = Date.now();
            mem.confidence = Math.min(1.0, mem.confidence + 0.1);
            return true;
        }
        return false;
    }

    // 🔥 НАЙТИ ТРИ БЛИЖАЙШИЕ ТОЧКИ В ГРАФЕ
    findThreeClosest(node, graph) {
        const distances = [];
        for (const [otherId, otherNode] of graph.nodes) {
            if (otherId === node.id) continue;
            const dx = node.x - otherNode.x;
            const dy = node.y - otherNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            distances.push({ id: otherId, dist });
        }
        return distances
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 3)
            .map(d => d.id);
    }

    // 🔥 БАРИЦЕНТРИЧЕСКИЕ КООРДИНАТЫ
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

        return { alpha, beta, gamma };
    }

    // 🔥 ОЧИСТИТЬ СТАРЫЕ ЗАПИСИ
    cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) {
        const now = Date.now();
        let removed = 0;
        for (const [nodeId, mem] of this.memory) {
            if (now - mem.lastSeen > maxAge) {
                this.memory.delete(nodeId);
                removed++;
            }
        }
        if (removed > 0) console.log(`🧹 Удалено ${removed} устаревших записей`);
        return removed;
    }

    // 🔥 ЭКСПОРТ
    export() {
        return {
            memory: Array.from(this.memory.entries()),
            clusters: Array.from(this.clusters.entries())
        };
    }

    // 🔥 ИМПОРТ
    import(data) {
        if (data.memory) this.memory = new Map(data.memory);
        if (data.clusters) this.clusters = new Map(data.clusters);
        console.log(`📥 Импортировано ${this.memory.size} геометрических памяток`);
    }
}

module.exports = GeometryMemory;
