// modules/footprint/topology/utils/GeometryUtils.js

class GeometryUtils {
    /**
     * Проверяет, находится ли точка внутри описанной окружности треугольника
     */
    static inCircumcircle(a, b, c, d) {
        const ax = a.x - d.x;
        const ay = a.y - d.y;
        const bx = b.x - d.x;
        const by = b.y - d.y;
        const cx = c.x - d.x;
        const cy = c.y - d.y;

        const det = (ax * ax + ay * ay) * (bx * cy - cx * by) -
            (bx * bx + by * by) * (ax * cy - cx * ay) +
            (cx * cx + cy * cy) * (ax * by - bx * ay);

        return det > 0;
    }

    /**
     * Вычисляет расстояние между двумя точками
     */
    static distance(p1, p2) {
        if (!p1 || !p2) return Infinity;
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Вычисляет разницу между двумя углами (в градусах)
     */
    static angleDiff(a1, a2) {
        let diff = Math.abs(a1 - a2);
        if (diff > 180) diff = 360 - diff;
        return diff;
    }

    /**
     * Применяет трансформацию к точке
     */
    static applyTransform(point, transform) {
        if (!point || !transform) return { x: 0, y: 0 };

        const { scale, rotation, translation } = transform;

        const xRot = point.x * Math.cos(rotation) - point.y * Math.sin(rotation);
        const yRot = point.x * Math.sin(rotation) + point.y * Math.cos(rotation);

        return {
            x: xRot * scale + translation.x,
            y: yRot * scale + translation.y
        };
    }

    /**
     * Вычисляет центроид множества точек
     */
    static calculateCentroid(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };

        let sumX = 0, sumY = 0;
        for (const p of points) {
            sumX += p.x;
            sumY += p.y;
        }

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    /**
     * Оценивает размер следа (для нормализации расстояний)
     */
    static getFootprintSize(points) {
        if (!points || points.length === 0) return 1;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const p of points) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }

        return Math.max(maxX - minX, maxY - minY);
    }

    /**
     * Вычисляет угол между тремя точками (вершина в b)
     */
    static angleBetween(a, b, c) {
        if (!a || !b || !c) return 0;

        const v1x = a.x - b.x;
        const v1y = a.y - b.y;
        const v2x = c.x - b.x;
        const v2y = c.y - b.y;

        const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
        const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

        if (mag1 === 0 || mag2 === 0) return 0;

        const dot = v1x * v2x + v1y * v2y;
        const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        return Math.acos(cos) * 180 / Math.PI;
    }

    /**
     * Вычисляет площадь многоугольника
     */
    static polygonArea(polygon) {
        if (!polygon || polygon.length < 3) return 0;

        let area = 0;
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            area += polygon[i].x * polygon[j].y;
            area -= polygon[j].x * polygon[i].y;
        }
        return Math.abs(area) / 2;
    }

    /**
     * Вычисляет периметр многоугольника
     */
    static polygonPerimeter(polygon) {
        if (!polygon || polygon.length < 2) return 0;

        let perimeter = 0;
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            perimeter += this.distance(polygon[i], polygon[j]);
        }
        return perimeter;
    }
}

module.exports = GeometryUtils;
