// modules/footprint/clean/coordinate-system.js
// 🎯 САМАЯ ПРОСТАЯ СИСТЕМА КООРДИНАТ (БЕЗ ТРАНСФОРМАЦИЙ, БЕЗ УГЛОВ)

class SimpleCoordinateSystem {
    /**
     * ЕДИНСТВЕННЫЙ МЕТОД: Нормализовать точки
     * Просто центрируем в (500,500) без поворотов и масштабов
     */
    static normalize(points) {
        if (!points || points.length === 0) {
            console.log('⚠️ Нет точек для нормализации');
            return [];
        }

        // 1. Находим центр масс
        const center = this.calculateCenter(points);
       
        // 2. Смещаем все точки так, чтобы центр был в (500,500)
        const normalized = points.map(point => ({
            ...point,
            x: point.x - center.x + 500,
            y: point.y - center.y + 500,
            originalX: point.x, // Сохраняем оригинал
            originalY: point.y,
            normalized: true
        }));

        console.log(`📐 Нормализация: ${points.length} точек`);
        console.log(`   Центр был: (${center.x.toFixed(1)}, ${center.y.toFixed(1)})`);
        console.log(`   Центр стал: (500, 500)`);

        return normalized;
    }

    /**
     * Вспомогательный метод: найти центр точек
     */
    static calculateCenter(points) {
        if (!points || points.length === 0) {
            return { x: 500, y: 500 };
        }

        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    /**
     * Простое выравнивание двух наборов точек по центру
     */
    static alignPoints(points1, points2) {
        const center1 = this.calculateCenter(points1);
        const center2 = this.calculateCenter(points2);

        // Смещаем вторые точки к центру первых
        const alignedPoints2 = points2.map(point => ({
            ...point,
            x: point.x - center2.x + center1.x,
            y: point.y - center2.y + center1.y,
            aligned: true
        }));

        return {
            points1: points1,
            points2: alignedPoints2,
            offset: {
                x: center1.x - center2.x,
                y: center1.y - center2.y
            }
        };
    }

    /**
     * Быстрая проверка: точки в одной системе координат?
     */
    static arePointsInSameSystem(points1, points2, threshold = 100) {
        if (points1.length === 0 || points2.length === 0) return true;

        const center1 = this.calculateCenter(points1);
        const center2 = this.calculateCenter(points2);

        const distance = Math.sqrt(
            Math.pow(center2.x - center1.x, 2) +
            Math.pow(center2.y - center1.y, 2)
        );

        return distance < threshold;
    }

    /**
     * Получить границы точек (для визуализации)
     */
    static getBounds(points) {
        if (!points || points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }
}

module.exports = SimpleCoordinateSystem;
