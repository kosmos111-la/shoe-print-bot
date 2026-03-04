// modules/footprint/topology/MorphologyEncoder.js
// 🔥 МОРФОЛОГИЧЕСКИЙ КОД - ИСПРАВЛЕННАЯ НОРМАЛИЗАЦИЯ ПЛОЩАДИ

class MorphologyEncoder {
    constructor(options = {}) {
        this.debug = options.debug || false;
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
                morphologyMap.set(point.id, code);
            } else {
                // Нет контура - ставим значения по умолчанию
                morphologyMap.set(point.id, {
                    compactness: 4.0,
                    eccentricity: 0.5,
                    orientation: 0,
                    hasContour: false,
                    normalizedArea: 1.0,
                    rawArea: 0,
                    radialProfile: [1, 1, 1, 1, 1, 1, 1, 1],
                    asymmetry: 0
                });
            }
        }

        // 🔥 ИСПРАВЛЕНО: нормализуем площади относительно среднего геометрического
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
            rawArea: area,  // 🔥 СОХРАНЯЕМ для нормализации
            hasContour: true,
            contour: simplified,
            radialProfile: radial.profile,
            asymmetry: radial.asymmetry,
            radialDistances: radial.distances
        };
    }

    /**
     * Вычисляет эксцентриситет и ориентацию эллипса
     */
    calculateEllipseFeatures(points) {
        if (points.length < 5) {
            return { eccentricity: 0.5, orientation: 0 };
        }

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
      
        const trace = covXX + covYY;
        const det = covXX * covYY - covXY * covXY;
        const sqrtTerm = Math.sqrt(Math.max(trace * trace - 4 * det, 0));
      
        const lambda1 = (trace + sqrtTerm) / 2;
        const lambda2 = (trace - sqrtTerm) / 2;
      
        const eccentricity = Math.sqrt(1 - (lambda2 / Math.max(lambda1, 0.001)));
      
        let orientation = 0.5 * Math.atan2(2 * covXY, covXX - covYY) * 180 / Math.PI;
        if (orientation < 0) orientation += 180;
      
        return { eccentricity, orientation };
    }

    /**
     * Вычисляет радиальный профиль фигуры
     */
    calculateRadialFeatures(points, center) {
        let north = 0, south = 0, east = 0, west = 0;
        let ne = 0, nw = 0, se = 0, sw = 0;
      
        const distances = [];
      
        for (const p of points) {
            const dx = p.x - center.x;
            const dy = p.y - center.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
          
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          
            if (Math.abs(angle) < 45) east = Math.max(east, dist);
            if (Math.abs(angle - 180) < 45 || Math.abs(angle + 180) < 45) west = Math.max(west, dist);
            if (Math.abs(angle - 90) < 45) north = Math.max(north, dist);
            if (Math.abs(angle + 90) < 45) south = Math.max(south, dist);
          
            if (angle > 45 && angle < 135) ne = Math.max(ne, dist);
            if (angle > 135 || angle < -135) nw = Math.max(nw, dist);
            if (angle < -45 && angle > -135) sw = Math.max(sw, dist);
            if (angle > -45 && angle < 45) se = Math.max(se, dist);
          
            distances.push({ angle, dist });
        }
      
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

    // ==================== 🔥 ИСПРАВЛЕННАЯ НОРМАЛИЗАЦИЯ ПЛОЩАДЕЙ ====================

    normalizeAreas(morphologyMap) {
        // Собираем все площади
        const areas = [];
        for (const code of morphologyMap.values()) {
            if (code.hasContour && code.rawArea && code.rawArea > 0) {
                areas.push(code.rawArea);
            }
        }

        if (areas.length === 0) return;

        // 🔥 ИСПОЛЬЗУЕМ СРЕДНЕЕ ГЕОМЕТРИЧЕСКОЕ
        // Оно лучше работает с данными, имеющими большой разброс
        const logSum = areas.reduce((sum, a) => sum + Math.log(a), 0);
        const geometricMean = Math.exp(logSum / areas.length);
       
        console.log(`   📐 Среднее геометрическое площади: ${geometricMean.toFixed(2)}`);

        // Нормализуем относительно среднего геометрического
        const normalizedAreas = [];
        for (const code of morphologyMap.values()) {
            if (code.hasContour && code.rawArea) {
                code.normalizedArea = code.rawArea / geometricMean;
                // Добавляем логарифмическую версию для кластеризации
                code.logArea = Math.log10(code.normalizedArea + 1);
                normalizedAreas.push(code.normalizedArea);
                delete code.rawArea; // Удаляем сырые данные
            } else {
                code.normalizedArea = 1.0;
                code.logArea = Math.log10(2);
            }
        }

        // Статистика для отладки
        if (this.debug && normalizedAreas.length > 0) {
            const min = Math.min(...normalizedAreas);
            const max = Math.max(...normalizedAreas);
            const avg = normalizedAreas.reduce((a, b) => a + b, 0) / normalizedAreas.length;
            console.log(`   📊 normalizedArea: мин=${min.toFixed(2)}, макс=${max.toFixed(2)}, среднее=${avg.toFixed(2)}`);
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
        // TODO: Реализовать упрощение контура
        return contour;
    }

    // ==================== СРАВНЕНИЕ МОРФОЛОГИИ ====================

    compare(morph1, morph2) {
        if (!morph1 || !morph2) return 0.5;

        let score = 0;
        let checks = 0;

        if (morph1.compactness && morph2.compactness) {
            const ratio = Math.min(morph1.compactness, morph2.compactness) /
                         Math.max(morph1.compactness, morph2.compactness);
            score += ratio;
            checks++;
        }

        if (morph1.eccentricity && morph2.eccentricity) {
            const diff = Math.abs(morph1.eccentricity - morph2.eccentricity);
            score += 1 - Math.min(diff, 1);
            checks++;
        }

        if (morph1.orientation !== undefined && morph2.orientation !== undefined) {
            let diff = Math.abs(morph1.orientation - morph2.orientation);
            if (diff > 180) diff = 360 - diff;
            score += 1 - (diff / 180);
            checks++;
        }

        // 🔥 ИСПОЛЬЗУЕМ logArea ДЛЯ СРАВНЕНИЯ
        if (morph1.logArea !== undefined && morph2.logArea !== undefined) {
            const diff = Math.abs(morph1.logArea - morph2.logArea);
            score += 1 - Math.min(diff, 1);
            checks++;
        } else if (morph1.normalizedArea && morph2.normalizedArea) {
            const ratio = Math.min(morph1.normalizedArea, morph2.normalizedArea) /
                         Math.max(morph1.normalizedArea, morph2.normalizedArea);
            score += ratio;
            checks++;
        }

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
