// modules/footprint/topology/MorphologyEncoder.js
// 🔥 МОРФОЛОГИЧЕСКИЙ КОД - ТОЛЬКО ИНВАРИАНТНЫЕ ПРИЗНАКИ

class MorphologyEncoder {
    constructor(options = {}) {
        this.debug = options.debug || false;

        // Кеш для морфологических кодов
        this.cache = new Map();

        console.log('🔷 MorphologyEncoder (инвариантный) создан');
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
                    console.log(`      compactness: ${code.compactness.toFixed(2)}`);
                    console.log(`      normalizedArea: ${code.normalizedArea.toFixed(2)}`);
                }
            } else {
                // Нет контура - ставим значения по умолчанию
                morphologyMap.set(point.id, {
                    compactness: 4.0,  // квадрат
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

        // 🔥 ТОЛЬКО ИНВАРИАНТНЫЕ ПРИЗНАКИ:
        // - compactness (периметр²/площадь) — инвариантна к повороту и масштабу
        // - normalizedArea (относительная площадь) — инвариантна после нормализации
       
        // Компактность (периметр²/площадь)
        const compactness = area > 0 ? (perimeter * perimeter) / area : 0;

        // Относительная площадь (будет нормализована позже)
        const rawArea = area;

        return {
            compactness,
            rawArea,
            hasContour: true,
            contour: simplified
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
                // Убираем сырые данные
                delete code.rawArea;
            } else {
                code.normalizedArea = 1.0;
            }
        }
    }

    // ==================== ПОИСК КОНТУРА ДЛЯ ТОЧКИ ====================

    findContourForPoint(point, contours) {
        if (!contours || !Array.isArray(contours)) return null;

        for (const contour of contours) {
            if (!contour || !contour.points || contour.points.length < 3) continue;

            if (contour.pointId === point.id) {
                return contour;
            }

            if (point.originalPoints) {
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

    simplifyContour(contour, epsilon) {
        // Пока возвращаем исходный контур
        return contour;
    }

    // ==================== СРАВНЕНИЕ МОРФОЛОГИИ ====================

    compare(morph1, morph2) {
        if (!morph1 || !morph2) return 0.5;

        const weights = {
            compactness: 0.6,
            area: 0.4
        };

        let score = 0;

        // Компактность
        if (morph1.compactness && morph2.compactness) {
            const compactDiff = Math.abs(morph1.compactness - morph2.compactness);
            const compactSim = Math.max(0, 1 - compactDiff / 10);
            score += compactSim * weights.compactness;
        }

        // Нормализованная площадь
        if (morph1.normalizedArea && morph2.normalizedArea) {
            const areaDiff = Math.abs(morph1.normalizedArea - morph2.normalizedArea);
            const areaSim = Math.max(0, 1 - areaDiff);
            score += areaSim * weights.area;
        }

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
