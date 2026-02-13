// modules/footprint/topology/GeometryMemory.js
// 📐 ГЕОМЕТРИЧЕСКАЯ ПАМЯТЬ - ВОССТАНОВЛЕНИЕ ПОЗИЦИЙ

class GeometryMemory {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Хранилище позиций: nodeId -> { anchors, barycentric, confidence }
        this.positions = new Map();
       
        console.log('📐 GeometryMemory создана (восстановление позиций)');
    }

    // 🔥 ЗАПОМНИТЬ ПОЗИЦИЮ ТОЧКИ
    remember(nodeId, node, anchors, barycentric) {
        this.positions.set(nodeId, {
            nodeId,
            anchors: anchors.map(a => a.id),
            barycentric,
            confidence: 1.0,
            recordedAt: Date.now()
        });

        if (this.debug) {
            console.log(`   📐 Запомнена позиция ${nodeId.substring(0, 20)}...`);
        }

        return true;
    }

    // 🔥 ВОССТАНОВИТЬ ПОЗИЦИЮ
    reconstruct(nodeId, modelGraph) {
        const pos = this.positions.get(nodeId);
        if (!pos) return null;

        const [aId, bId, cId] = pos.anchors;
        const a = modelGraph.nodes.get(aId);
        const b = modelGraph.nodes.get(bId);
        const c = modelGraph.nodes.get(cId);

        if (!a || !b || !c) return null;

        const { alpha, beta, gamma } = pos.barycentric;
        const x = a.x * alpha + b.x * beta + c.x * gamma;
        const y = a.y * alpha + b.y * beta + c.y * gamma;

        return { x, y, confidence: pos.confidence };
    }

    // 🔥 ПОДТВЕРДИТЬ ТОЧКУ
    confirm(nodeId) {
        const pos = this.positions.get(nodeId);
        if (pos) {
            pos.confidence = Math.min(1.0, pos.confidence + 0.1);
            return true;
        }
        return false;
    }

    // 🔥 ТРИ БЛИЖАЙШИЕ ТОЧКИ В ГРАФЕ
    findThreeClosest(node, graph) {
        const distances = [];
        for (const [otherId, otherNode] of graph.nodes) {
            if (otherId === node.id) continue;
            const dx = node.x - otherNode.x;
            const dy = node.y - otherNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            distances.push({ id: otherId, node: otherNode, dist });
        }
       
        return distances
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 3);
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

    // 🔥 ЭКСПОРТ
    export() {
        return Array.from(this.positions.entries());
    }

    // 🔥 ИМПОРТ
    import(data) {
        this.positions = new Map(data);
        console.log(`📥 Импортировано ${this.positions.size} позиций`);
    }
}

module.exports = GeometryMemory;
