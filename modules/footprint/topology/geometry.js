// modules/footprint/topology/geometry.js
// 🔥 БАЗОВЫЕ ГЕОМЕТРИЧЕСКИЕ ФУНКЦИИ

class GeometryUtils {
    // Расстояние между двумя точками
    static distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Площадь треугольника
    static triangleArea(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    // Проверка, находится ли точка d внутри описанной окружности треугольника abc
    static inCircumcircle(a, b, c, d) {
        const ax = a.x - d.x;
        const ay = a.y - d.y;
        const bx = b.x - d.x;
        const by = b.y - d.y;
        const cx = c.x - d.x;
        const cy = c.y - d.y;

        const det = (
            (ax * ax + ay * ay) * (bx * cy - by * cx) -
            (bx * bx + by * by) * (ax * cy - ay * cx) +
            (cx * cx + cy * cy) * (ax * by - ay * bx)
        );

        const area = this.triangleArea(a, b, c);
        return det * area > 0;
    }

    // Проверка, является ли треугольник вырожденным
    static isDegenerate(a, b, c) {
        return Math.abs(this.triangleArea(a, b, c)) < 1e-10;
    }
}

module.exports = GeometryUtils;
