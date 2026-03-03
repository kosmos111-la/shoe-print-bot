// modules/footprint/topology/MorphologyEncoder.js
// 🔥 МОРФОЛОГИЧЕСКИЙ КОД - ПОЛНАЯ ВЕРСИЯ С ЭКСЦЕНТРИСИТЕТОМ И ОРИЕНТАЦИЕЙ

class MorphologyEncoder {
    constructor(options = {}) {
        this.debug = options.debug || false;

        // Кеш для морфологических кодов
        this.cache = new Map();

        console.log('🔷 MorphologyEncoder (полная версия) создан');
    }

    // ==================== ОСНОВНОЙ МЕТОД ====================

    encode(points, contours) {
        console.log(`📐 Кодирую морфологию для ${points.length} точек...`);

        const morphologyMap = new Map();

        // Создаём мапу контуров по pointId для быстрого доступа
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
                    console.log(`      eccentricity: ${code.eccentricity.toFixed(3)}`);
                    console.log(`      orientation: ${code.orientation.toFixed(1)}°`);
                    console.log(`      normalizedArea: ${code.normalizedArea.toFixed(2)}`);
                    console.log(`      radialProfile: [${code.radialProfile.map(v => v.toFixed(2)).join(', ')}]`);
                }
            } else {
                // Нет контура - ставим значения по умолчанию
                morphologyMap.set(point.id, {
                    compactness: 4.0,  // квадрат
                    eccentricity: 0.5,
                    orientation: 0,
                    hasContour: false,
                    normalizedArea: 1.0,
                    radialProfile: [1, 1, 1, 1],
                    asymmetry: 0
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
       
        // 3. Эксцентриситет и ориентация
        const { eccentricity, orientation } = this.calculateEllipseFeatures(simplified);
       
        // 4. Радиальный профиль
        const center = centerPoint || this.calculateCentroid(simplified);
        const radial = this.calculateRadialFeatures(simplified, center);

        // Компактность (периметр²/площадь)
        const compactness = area > 0 ? (perimeter * perimeter) / area : 0;

        return {
            compactness,
            eccentricity,
            orientation,
            rawArea: area,
            hasContour: true,
            contour: simplified,
            radialProfile: radial.profile,
            asymmetry: radial.asymmetry,
            radialDistances: radial.distances
        };
    }

    /**
     * Вычисляет эксцентриситет и ориентацию эллипса, аппроксимирующего контур
     */
    calculateEllipseFeatures(points) {
        if (points.length < 5) {
            return { eccentricity: 0.5, orientation: 0 };
        }

        // Вычисляем моменты инерции
        let sumX = 0, sumY = 0;
        let sumXX = 0, sumYY = 0, sumXY = 0;
        const n = points.length;
       
        for (const p of points) {
            sumX += p.x;
            sumY += p.y;
            sumXX += p.x * p.x;
            sumYY += p.y * p.y;
            sumXY += p.x * p.y;
        }
       
        const meanX = sumX / n;
        const meanY = sumY / n;
       
        const covXX = sumXX / n - meanX * meanX;
        const covYY = sumYY / n - meanY * meanY;
        const covXY = sumXY / n - meanX * meanY;
       
        // Вычисляем собственные значения
        const trace = covXX + covYY;
        const det = covXX * covYY - covXY * covXY;
        const sqrtTerm = Math.sqrt(Math.max(trace * trace - 4 * det, 0));
       
        const lambda1 = (trace + sqrtTerm) / 2;
        const lambda2 = (trace - sqrtTerm) / 2;
       
        // Эксцентриситет (0-1, 0-круг, 1-линия)
        const eccentricity = Math.sqrt(1 - (lambda2 / Math.max(lambda1, 0.001)));
       
        // Ориентация в градусах
        let orientation = 0.5 * Math.atan2(2 * covXY, covXX - covYY) * 180 / Math.PI;
        if (orientation < 0) orientation += 180;
       
        return { eccentricity, orientation };
    }

    /**
     * Вычисляет радиальный профиль фигуры
     */
    calculateRadialFeatures(points, center) {
        // Инициализируем расстояния в 4 направлениях
        let north = 0, south = 0, east = 0, west = 0;
        let ne = 0, nw = 0, se = 0, sw = 0;
       
        const distances = [];
       
        for (const p of points) {
            const dx = p.x - center.x;
            const dy = p.y - center.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
           
            // Определяем направление (с допуском 45°)
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
           
            if (Math.abs(angle) < 45) east = Math.max(east, dist);
            if (Math.abs(angle - 180) < 45 || Math.abs(angle + 180) < 45) west = Math.max(west, dist);
            if (Math.abs(angle - 90) < 45) north = Math.max(north, dist);
            if (Math.abs(angle + 90) < 45) south = Math.max(south, dist);
           
            // Диагонали
            if (angle > 45 && angle < 135) ne = Math.max(ne, dist);
            if (angle > 135 || angle < -135) nw = Math.max(nw, dist);
            if (angle < -45 && angle > -135) sw = Math.max(sw, dist);
            if (angle > -45 && angle < 45) se = Math.max(se, dist);
           
            distances.push({ angle, dist });
        }
       
        // Нормализуем на максимальное расстояние
        const maxDist = Math.max(north, south, east, west, ne, nw, se, sw, 0.001);
        const profile = [
            north / maxDist,
            east / maxDist,
            south / maxDist,
            west / maxDist,
            ne / maxDist,
            nw / maxDist,
            se / maxDist,
            sw / maxDist
        ];
       
        // Асимметрия (сумма разностей противоположных направлений)
        const asymmetry = Math.abs(profile[0] - profile[2]) +
                         Math.abs(profile[1] - profile[3]) +
                         Math.abs(profile[4] - profile[6]) +
                         Math.abs(profile[5] - profile[7]);
       
        return {
            profile,
            asymmetry,
            distances: {
                north, south, east, west, ne, nw, se, sw,
                maxDist
            }
        };
    }

    /**
     * Вычисляет центр масс контура
     */
    calculateCentroid(points) {
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
        // TODO: Реализовать упрощение контура (алгоритм Дугласа-Пекера)
        return contour;
    }

    // ==================== СРАВНЕНИЕ МОРФОЛОГИИ ====================

    compare(morph1, morph2) {
        if (!morph1 || !morph2) return 0.5;

        let score = 0;
        let checks = 0;

        // Компактность
        if (morph1.compactness && morph2.compactness) {
            const ratio = Math.min(morph1.compactness, morph2.compactness) /
                         Math.max(morph1.compactness, morph2.compactness);
            score += ratio;
            checks++;
        }

        // Эксцентриситет
        if (morph1.eccentricity && morph2.eccentricity) {
            const diff = Math.abs(morph1.eccentricity - morph2.eccentricity);
            score += 1 - Math.min(diff, 1);
            checks++;
        }

        // Ориентация (с учетом цикличности)
        if (morph1.orientation !== undefined && morph2.orientation !== undefined) {
            let diff = Math.abs(morph1.orientation - morph2.orientation);
            if (diff > 180) diff = 360 - diff;
            score += 1 - (diff / 180);
            checks++;
        }

        // Нормализованная площадь
        if (morph1.normalizedArea && morph2.normalizedArea) {
            const ratio = Math.min(morph1.normalizedArea, morph2.normalizedArea) /
                         Math.max(morph1.normalizedArea, morph2.normalizedArea);
            score += ratio;
            checks++;
        }

        // Радиальный профиль
        if (morph1.radialProfile && morph2.radialProfile) {
            let sum = 0;
            const len = Math.min(morph1.radialProfile.length, morph2.radialProfile.length);
            for (let i = 0; i < len; i++) {
                sum += 1 - Math.min(Math.abs(morph1.radialProfile[i] - morph2.radialProfile[i]), 1);
            }
            score += sum / len;
            checks++;
        }

        return checks > 0 ? score / checks : 0.5;
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
