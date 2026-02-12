// modules/footprint/topology/TriangulationMemory.js
// 🔺 МИНИМАЛЬНАЯ ТРИАНГУЛЯЦИЯ - ТОЛЬКО ДЛЯ НОВЫХ ТОЧЕК

class TriangulationMemory {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.triangles = new Map(); // nodeId -> { anchorIds, barycentric }
        console.log('🔺 TriangulationMemory создана (минимальная)');
    }

    // 🔥 ЗАПОМНИТЬ ТРЕУГОЛЬНИК ДЛЯ НОВОЙ ТОЧКИ
    rememberTriangle(nodeId, point, anchors) {
        if (anchors.length < 3) return null;

        // Вычисляем барицентрические координаты в фото2
        const bary = this.calculateBarycentric(
            point,
            anchors[0].node,
            anchors[1].node,
            anchors[2].node
        );

        // Проверяем валидность
        if (bary.alpha < -0.1 || bary.alpha > 1.1 ||
            bary.beta < -0.1 || bary.beta > 1.1 ||
            bary.gamma < -0.1 || bary.gamma > 1.1) {
            return null;
        }

        this.triangles.set(nodeId, {
            anchors: anchors.map(a => a.id),
            barycentric: bary,
            confidence: 0.7
        });

        return this.triangles.get(nodeId);
    }

    // 🔥 ВОССТАНОВИТЬ ПОЗИЦИЮ В МОДЕЛИ
    reconstructPosition(nodeId, modelGraph) {
        const triangle = this.triangles.get(nodeId);
        if (!triangle) return null;

        const a = modelGraph.nodes.get(triangle.anchors[0]);
        const b = modelGraph.nodes.get(triangle.anchors[1]);
        const c = modelGraph.nodes.get(triangle.anchors[2]);

        if (!a || !b || !c) return null;

        const { alpha, beta, gamma } = triangle.barycentric;
        const x = a.x * alpha + b.x * beta + c.x * gamma;
        const y = a.y * alpha + b.y * beta + c.y * gamma;

        return { x, y, method: 'triangulation', confidence: triangle.confidence };
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

    // 🔥 НАЙТИ 3 БЛИЖАЙШИХ ОПОРНЫХ ТОЧКИ
    findThreeClosest(point, anchors) {
        if (anchors.length < 3) return [];

        const withDistance = anchors.map(a => ({
            ...a,
            distance: this.distance(point, a.newNode)
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

    // 🔥 ЭКСПОРТ
    export() {
        const data = {};
        for (const [nodeId, tri] of this.triangles) {
            data[nodeId] = {
                anchors: tri.anchors,
                barycentric: tri.barycentric,
                confidence: tri.confidence
            };
        }
        return data;
    }

    // 🔥 ИМПОРТ
    import(data) {
        if (!data) return;
        for (const [nodeId, tri] of Object.entries(data)) {
            this.triangles.set(nodeId, tri);
        }
        console.log(`📥 Импортировано ${Object.keys(data).length} треугольников`);
    }
}

module.exports = TriangulationMemory;
