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
       
        // 🔥 Создаём мапу контуров по pointId для быстрого доступа
        const contourMap = new Map();
        if (contours && Array.isArray(contours)) {
            for (const contour of contours) {
                if (contour && contour.pointId) {
                    contourMap.set(contour.pointId, contour);
                }
            }
        }
       
        console.log(`   Найдено ${contourMap.size} контуров с привязкой к точкам`);
       
        for (const point of points) {
            if (!point || !point.id) continue;
           
            // Ищем контур для этой точки
            const contour = contourMap.get(point.id) || this.findContourForPoint(point, contours);
           
            if (contour && contour.points && contour.points.length >= 3) {
                // Есть контур - вычисляем морфологию
                const code = this.computeMorphologyCode(contour.points, point);
                // Сохраняем под ID точки
                morphologyMap.set(point.id, code);
               
                if (this.debug && morphologyMap.size <= 3) {
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
                    hasContour: false,
                    normalizedArea: 1.0
                });
            }
        }
       
        // Нормализуем площади относительно всех точек
        this.normalizeAreas(morphologyMap);
       
        console.log(`✅ Закодировано ${morphologyMap.size} точек`);
       
        return morphologyMap;
    }

    // ==================== ВЫЧИСЛЕНИЕ МОРФОЛОГИЧЕСКОГО КОДА ====================

    computeMorphologyCode(contourPoints, centerPoint) {
        // 1. Аппроксимируем контур для уменьшения шума
        const simplified = this.simplifyContour(contourPoints, 2.0);
       
        // 2. Основные метрики
        const area = this.computePolygonArea(simplified);
        const perimeter = this.computePolygonPerimeter(simplified);
       
        // 3. Ограничивающий прямоугольник
        const { width, height } = this.computeBoundingBox(simplified);
       
        // 4. Отношение сторон (инвариант к масштабу)
        const aspectRatio = width > 0 && height > 0
            ? Math.max(width, height) / Math.min(width, height)
            : 1.0;
       
        // 5. Компактность (периметр²/площадь)
        const compactness = area > 0 ? (perimeter * perimeter) / area : 0;
       
        // 6. Выпуклость (упрощённо)
        const convexity = 1.0; // Пока заглушка
       
        // 7. Угловатость (упрощённо)
        const angularity = 4; // Пока заглушка
       
        // 8. Относительная площадь (будет нормализована позже)
        const rawArea = area;
       
        return {
            aspectRatio,
            compactness,
            convexity,
            angularity,
            rawArea,
            hasContour: true,
            contour: simplified // сохраняем для отладки
        };
    }

    // ==================== НОРМАЛИЗАЦИЯ ПЛОЩАДЕЙ ====================

    normalizeAreas(morphologyMap) {
        // Собираем все площади
        const areas = [];
        for (const code of morphologyMap.values()) {
            if (code.hasContour && code.rawArea && code.rawArea > 0) {
                areas.push(code.rawArea);
            }
        }
       
        if (areas.length === 0) return;
       
        // Вычисляем медиану
        areas.sort((a, b) => a - b);
        const median = areas[Math.floor(areas.length / 2)];
       
        if (median === 0) return;
       
        // Нормализуем относительно медианы
        for (const code of morphologyMap.values()) {
            if (code.hasContour && code.rawArea) {
                code.normalizedArea = code.rawArea / median;
                // Убираем сырые данные, они больше не нужны
                delete code.rawArea;
            } else {
                code.normalizedArea = 1.0;
            }
        }
    }

    // ==================== ПОИСК КОНТУРА ДЛЯ ТОЧКИ ====================

    findContourForPoint(point, contours) {
        if (!contours || !Array.isArray(contours)) return null;
       
        // Ищем контур, содержащий точку
        for (const contour of contours) {
            if (!contour || !contour.points || contour.points.length < 3) continue;
           
            // Проверяем по ID, если есть
            if (contour.pointId === point.id) {
                return contour;
            }
           
            // Ищем по близости центра (запасной вариант)
            if (point.originalPoints) {
                // Точка уже содержит исходные точки контура
                return { points: point.originalPoints };
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

    computeBoundingBox(polygon) {
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
            height: maxY - minY
        };
    }

    simplifyContour(contour, epsilon) {
        // Пока возвращаем исходный контур
        return contour;
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
       
        // Отношение сторон
        const ratioDiff = Math.abs(morph1.aspectRatio - morph2.aspectRatio);
        const ratioSim = Math.max(0, 1 - ratioDiff / 3);
        score += ratioSim * weights.aspectRatio;
       
        // Компактность
        const compactDiff = Math.abs(morph1.compactness - morph2.compactness);
        const compactSim = Math.max(0, 1 - compactDiff / 10);
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
