// modules/footprint/topology/MorphologyEncoder.js
// 🔥 МОРФОЛОГИЧЕСКИЙ КОД - инвариантные признаки из контуров Roboflow

class MorphologyEncoder {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Кеш для морфологических кодов
        this.cache = new Map();
       
        console.log('🔷 MorphologyEncoder создан');
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    encode(points, contours) {
        console.log(`📐 Кодирую морфологию для ${points.length} точек...`);
       
        const morphologyMap = new Map();
       
        for (const point of points) {
            // Ищем контур для этой точки
            const contour = this.findContourForPoint(point, contours);
           
            if (contour && contour.length >= 3) {
                // Есть контур - вычисляем морфологию
                const code = this.computeMorphologyCode(contour, point);
                morphologyMap.set(point.id, code);
               
                if (this.debug && morphologyMap.size <= 5) {
                    console.log(`   Точка ${point.id.substring(0,12)}...`);
                    console.log(`      aspectRatio: ${code.aspectRatio.toFixed(2)}`);
                    console.log(`      compactness: ${code.compactness.toFixed(2)}`);
                    console.log(`      convexity: ${code.convexity.toFixed(2)}`);
                    console.log(`      angularity: ${code.angularity}`);
                }
            } else {
                // Нет контура - ставим значения по умолчанию
                morphologyMap.set(point.id, {
                    aspectRatio: 1.0,
                    compactness: 4.0,  // квадрат
                    convexity: 1.0,
                    angularity: 4,
                    hasContour: false
                });
            }
        }
       
        // Нормализуем площади относительно всех точек
        this.normalizeAreas(morphologyMap);
       
        console.log(`✅ Закодировано ${morphologyMap.size} точек`);
       
        return morphologyMap;
    }

    // ==================== ВЫЧИСЛЕНИЕ МОРФОЛОГИЧЕСКОГО КОДА ====================

    computeMorphologyCode(contour, centerPoint) {
        // 1. Аппроксимируем контур для уменьшения шума
        const simplified = this.simplifyContour(contour, 2.0);
       
        // 2. Основные метрики
        const area = this.computePolygonArea(simplified);
        const perimeter = this.computePolygonPerimeter(simplified);
       
        // 3. Ограничивающий прямоугольник (повёрнутый)
        const { width, height, angle } = this.computeMinAreaRect(simplified);
       
        // 4. Отношение сторон (инвариант к масштабу)
        const aspectRatio = width > 0 && height > 0
            ? Math.max(width, height) / Math.min(width, height)
            : 1.0;
       
        // 5. Компактность (периметр²/площадь) - минимально для круга = 4π
        // Чем больше значение, тем более "изрезанная" фигура
        const compactness = area > 0 ? (perimeter * perimeter) / area : 0;
       
        // 6. Выпуклость (площадь фигуры / площадь выпуклой оболочки)
        const convexHull = this.computeConvexHull(simplified);
        const convexArea = this.computePolygonArea(convexHull);
        const convexity = convexArea > 0 ? area / convexArea : 1.0;
       
        // 7. Угловатость (количество значимых углов)
        const angularity = this.countAngles(simplified, 0.3);
       
        // 8. Относительная площадь (будет нормализована позже)
        const rawArea = area;
       
        return {
            aspectRatio,        // отношение сторон (>=1)
            compactness,        // компактность (периметр²/площадь)
            convexity,          // выпуклость (0-1)
            angularity,         // количество углов (3,4,5,6...)
            rawArea,            // сырая площадь (для нормализации)
            hasContour: true,
            contour: simplified // сохраняем для отладки
        };
    }

    // ==================== НОРМАЛИЗАЦИЯ ПЛОЩАДЕЙ ====================

    normalizeAreas(morphologyMap) {
        // Собираем все площади
        const areas = [];
        for (const code of morphologyMap.values()) {
            if (code.hasContour) {
                areas.push(code.rawArea);
            }
        }
       
        if (areas.length === 0) return;
       
        // Вычисляем медиану (устойчива к выбросам)
        areas.sort((a, b) => a - b);
        const median = areas[Math.floor(areas.length / 2)];
       
        if (median === 0) return;
       
        // Нормализуем относительно медианы
        for (const code of morphologyMap.values()) {
            if (code.hasContour) {
                code.normalizedArea = code.rawArea / median;
                // Убираем сырые данные, они больше не нужны
                delete code.rawArea;
            } else {
                code.normalizedArea = 1.0; // средняя площадь
            }
        }
    }

    // ==================== ПОИСК КОНТУРА ДЛЯ ТОЧКИ ====================

    findContourForPoint(point, contours) {
        if (!contours || !Array.isArray(contours)) return null;
       
        // Ищем контур, содержащий точку
        for (const contour of contours) {
            if (!contour || contour.length < 3) continue;
           
            // Проверяем, является ли точка центром этого контура
            // В реальности Roboflow возвращает контур для каждого предсказания
            // и точка - это центр этого контура
           
            // Упрощённо: считаем, что контур привязан к точке по id
            if (contour.id === point.id || contour.parentId === point.id) {
                return contour.points || contour;
            }
        }
       
        return null;
    }

    // ==================== ГЕОМЕТРИЧЕСКИЕ ВЫЧИСЛЕНИЯ ====================

    computePolygonArea(polygon) {
        if (polygon.length < 3) return 0;
       
        let area = 0;
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            area += polygon[i].x * polygon[j].y;
            area -= polygon[j].x * polygon[i].y;
        }
        return Math.abs(area) / 2;
    }

    computePolygonPerimeter(polygon) {
        if (polygon.length < 2) return 0;
       
        let perimeter = 0;
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            const dx = polygon[i].x - polygon[j].x;
            const dy = polygon[i].y - polygon[j].y;
            perimeter += Math.sqrt(dx*dx + dy*dy);
        }
        return perimeter;
    }

    computeMinAreaRect(polygon) {
        // Упрощённая версия: используем ограничивающий прямоугольник
        // В идеале нужно считать повёрнутый прямоугольник минимальной площади
       
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
       
        for (const p of polygon) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
       
        return {
            width: maxX - minX,
            height: maxY - minY,
            angle: 0
        };
    }

    computeConvexHull(points) {
        // Алгоритм Джарвиса (Gift wrapping) - упрощённо
        // В реальном коде нужна полная реализация
        // Пока возвращаем исходный полигон
        return points;
    }

    simplifyContour(contour, epsilon) {
        // Алгоритм Рамера-Дугласа-Пекера для упрощения контура
        // Упрощённая версия - пока возвращаем исходный
        return contour;
    }

    countAngles(polygon, threshold) {
        // Считаем количество значимых углов (поворотов)
        if (polygon.length < 3) return 0;
       
        let angles = 0;
        for (let i = 0; i < polygon.length; i++) {
            const prev = polygon[(i - 1 + polygon.length) % polygon.length];
            const curr = polygon[i];
            const next = polygon[(i + 1) % polygon.length];
           
            const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
            const v2 = { x: next.x - curr.x, y: next.y - curr.y };
           
            const angle = this.angleBetween(v1, v2);
           
            // Если угол достаточно острый, считаем это вершиной
            if (Math.abs(angle) > threshold) {
                angles++;
            }
        }
        return Math.max(3, Math.min(8, angles));
    }

    angleBetween(v1, v2) {
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y);
        const mag2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y);
       
        if (mag1 === 0 || mag2 === 0) return 0;
       
        const cos = dot / (mag1 * mag2);
        return Math.acos(Math.max(-1, Math.min(1, cos)));
    }

    // ==================== СРАВНЕНИЕ МОРФОЛОГИИ ====================

    compare(morph1, morph2) {
        if (!morph1 || !morph2) return 0.5;
       
        const weights = {
            aspectRatio: 0.25,
            compactness: 0.25,
            convexity: 0.20,
            angularity: 0.15,
            area: 0.15
        };
       
        let score = 0;
       
        // Отношение сторон (чем ближе, тем лучше)
        const ratioDiff = Math.abs(morph1.aspectRatio - morph2.aspectRatio);
        const ratioSim = Math.max(0, 1 - ratioDiff / 3); // допускаем разницу до 3
        score += ratioSim * weights.aspectRatio;
       
        // Компактность
        const compactDiff = Math.abs(morph1.compactness - morph2.compactness);
        const compactSim = Math.max(0, 1 - compactDiff / 10); // допускаем разницу до 10
        score += compactSim * weights.compactness;
       
        // Выпуклость
        const convexDiff = Math.abs(morph1.convexity - morph2.convexity);
        const convexSim = 1 - convexDiff;
        score += convexSim * weights.convexity;
       
        // Угловатость
        const angleDiff = Math.abs(morph1.angularity - morph2.angularity);
        const angleSim = angleDiff === 0 ? 1 : Math.max(0, 1 - angleDiff / 4);
        score += angleSim * weights.angularity;
       
        // Нормализованная площадь
        const areaDiff = Math.abs(morph1.normalizedArea - morph2.normalizedArea);
        const areaSim = Math.max(0, 1 - areaDiff);
        score += areaSim * weights.area;
       
        return score;
    }

    // ==================== СТАТИСТИКА ====================

    getStats() {
        return {
            cacheSize: this.cache.size
        };
    }

    clearCache() {
        this.cache.clear();
        console.log('🧹 Кеш MorphologyEncoder очищен');
    }
}

module.exports = MorphologyEncoder;
