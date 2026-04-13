// modules/footprint/topology/MorphologyEncoder.js
// 🔥 МОРФОЛОГИЧЕСКИЙ КОД С АСИММЕТРИЕЙ

class MorphologyEncoder {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.cache = new Map();
        console.log('🔷 MorphologyEncoder (с асимметрией) создан');
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

        let pointsWithContourCount = 0;
        let pointsWithoutContourCount = 0;

        for (const point of points) {
            if (!point || !point.id) continue;

            // Ищем контур для этой точки
            const contour = contourMap.get(point.id) || this.findContourForPoint(point, contours);

            if (contour && contour.points && contour.points.length >= 3) {
                // Есть контур - вычисляем морфологию
                const code = this.computeMorphologyCode(contour.points, point);
                morphologyMap.set(point.id, code);
                pointsWithContourCount++;
               
                if (this.debug && pointsWithContourCount <= 3) {
                    console.log(`   📐 Точка ${point.id.substring(0,12)}: контур сохранён (${contour.points.length} точек)`);
                }
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
                    asymmetry: 0,
                    confidence: 0.5
                });
                pointsWithoutContourCount++;
               
                if (this.debug && pointsWithoutContourCount <= 3) {
                    console.log(`   ⚠️ Точка ${point.id.substring(0,12)}: контур НЕ НАЙДЕН`);
                }
            }
        }
       
        console.log(`   📊 Итог encode: с контуром ${pointsWithContourCount}, без контура ${pointsWithoutContourCount}`);

        // Нормализуем площади относительно среднего геометрического
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

        // 🔥 ВЫЧИСЛЯЕМ АСИММЕТРИЮ (0-1)
        const asymmetry = this.calculateAsymmetry(simplified, center);

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
            asymmetry: asymmetry,
            radialDistances: radial.distances,
            confidence: 0.5
        };
    }

    /**
     * 🔥 НОВЫЙ МЕТОД: вычисление асимметрии (0 - симметрично, 1 - максимально асимметрично)
     */
    calculateAsymmetry(points, center) {
        if (points.length < 4) return 0;
       
        let leftArea = 0;
        let rightArea = 0;
       
        for (const p of points) {
            const contrib = Math.abs(p.x - center.x) * Math.abs(p.y - center.y);
            if (p.x < center.x) {
                leftArea += contrib;
            } else {
                rightArea += contrib;
            }
        }
       
        if (leftArea + rightArea === 0) return 0;
       
        return Math.abs(leftArea - rightArea) / (leftArea + rightArea);
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

    // ==================== НОРМАЛИЗАЦИЯ ПЛОЩАДЕЙ ====================

    normalizeAreas(morphologyMap) {
        const areas = [];
        for (const code of morphologyMap.values()) {
            if (code.hasContour && code.rawArea && code.rawArea > 0) {
                areas.push(code.rawArea);
            }
        }

        if (areas.length === 0) return;

        const logSum = areas.reduce((sum, a) => sum + Math.log(a), 0);
        const geometricMean = Math.exp(logSum / areas.length);
       
        console.log(`   📐 Среднее геометрическое площади: ${geometricMean.toFixed(2)}`);

        for (const code of morphologyMap.values()) {
            if (code.hasContour && code.rawArea) {
                code.normalizedArea = code.rawArea / geometricMean;
                code.logArea = Math.log10(code.normalizedArea + 1);
                delete code.rawArea;
            } else {
                code.normalizedArea = 1.0;
                code.logArea = Math.log10(2);
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

        if (morph1.logArea !== undefined && morph2.logArea !== undefined) {
            const diff = Math.abs(morph1.logArea - morph2.logArea);
            score += 1 - Math.min(diff, 1);
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

    // ==================== 🔥 МЕТОДЫ ДЛЯ РАБОТЫ С КОНТУРАМИ ====================

    /**
     * 🔥 ВЫБОР ЛУЧШЕГО КОНТУРА ИЛИ УСРЕДНЕНИЕ НА ОСНОВЕ УВЕРЕННОСТИ
     */
   mergeContoursWithConfidence(existing, newData, transform) {
    const existingContour = existing.morphology?.contour;
    const newContourRaw = newData.morphology?.contour;
   
    // 🔥 ЗАЩИТА: если нет контура в новых данных
    if (!newContourRaw || !Array.isArray(newContourRaw) || newContourRaw.length < 3) {
        console.log(`   ⚠️ Новый контур отсутствует или повреждён`);
        return {
            finalContour: existingContour,
            finalConfidence: existing.morphology?.confidence || 0.5,
            finalMorphology: existing.morphology || {},
            historyContours: existing.sourceContours || []
        };
    }
       
        const historyContours = existing.sourceContours || [];
        if (existingContour) {
            historyContours.push({
                points: existingContour,
                confidence: existing.morphology?.confidence || existing.confidence || 0.5,
                type: 'model_existing'
            });
        }

        if (!newContourRaw) {
            return {
                finalContour: existingContour,
                finalConfidence: existing.morphology?.confidence || 0.5,
                finalMorphology: existing.morphology || {},
                historyContours
            };
        }

        const newContour = newContourRaw.map(p => this.applyTransform(p, transform));
        const newConfidence = newData.morphology?.confidence || newData.confidence || 0.5;
       
        historyContours.push({
            points: newContour,
            confidence: newConfidence,
            type: 'photo_new'
        });

        const existingConf = existing.morphology?.confidence || existing.confidence || 0.5;
   
    let finalContour;
    let finalConfidence;

    const HIGH_CONFIDENCE = 0.85;

    const isExistingHigh = existingConf >= HIGH_CONFIDENCE;
    const isNewHigh = newConfidence >= HIGH_CONFIDENCE;

    if (isExistingHigh && !isNewHigh) {
        console.log(`   🛡️ Модель уверена (${(existingConf*100).toFixed(0)}%), игнорируем новый контур (${(newConfidence*100).toFixed(0)}%)`);
        // 🔥 ИСПРАВЛЕНО: если existingContour нет, используем новый
        if (existingContour && Array.isArray(existingContour) && existingContour.length >= 3) {
            finalContour = existingContour;
        } else {
            console.log(`      ⚠️ existingContour отсутствует, беру новый контур`);
            finalContour = newContour;
        }
        finalConfidence = existingConf;
    } else if (isNewHigh && !isExistingHigh) {
        console.log(`   ⚡ Новый контур увереннее (${(newConfidence*100).toFixed(0)}%), заменяем старый (${(existingConf*100).toFixed(0)}%)`);
        // 🔥 ИСПРАВЛЕНО: если newContour нет, оставляем existing
        if (newContour && Array.isArray(newContour) && newContour.length >= 3) {
            finalContour = newContour;
        } else {
            console.log(`      ⚠️ newContour повреждён, оставляю existing`);
            finalContour = existingContour;
        }
        finalConfidence = newConfidence;
    } else {
        console.log(`   🔄 Усреднение контуров (уверенности: ${(existingConf*100).toFixed(0)}% и ${(newConfidence*100).toFixed(0)}%)`);
        // 🔥 ИСПРАВЛЕНО: проверяем оба контура
        if (!existingContour || existingContour.length < 3) {
            console.log(`      ⚠️ existingContour повреждён, беру новый`);
            finalContour = newContour;
        } else if (!newContour || newContour.length < 3) {
            console.log(`      ⚠️ newContour повреждён, беру existing`);
            finalContour = existingContour;
        } else {
            finalContour = this.averageContoursInternal(existingContour, newContour, existingConf, newConf);
        }
        finalConfidence = Math.min(existingConf, newConfidence);
    }

    // 🔥 ФИНАЛЬНАЯ ПРОВЕРКА
    if (!finalContour || finalContour.length < 3) {
        console.log(`   ❌ КРИТИЧНО: finalContour всё ещё повреждён!`);
        finalContour = existingContour || newContour || [];
    }

        // 🔥 ЗАЩИТА: проверяем, что finalContour существует и не пустой
let finalMorphology;
if (finalContour && Array.isArray(finalContour) && finalContour.length >= 3) {
    finalMorphology = this.computeMorphologyCode(finalContour);
} else {
    console.log(`   ⚠️ finalContour повреждён, использую existing morphology`);
    finalMorphology = existing.morphology || {
        compactness: 4.0,
        eccentricity: 0.5,
        orientation: 0,
        hasContour: false,
        normalizedArea: 1.0,
        radialProfile: [1, 1, 1, 1, 1, 1, 1, 1],
        asymmetry: 0,
        confidence: 0.5
    };
}

        return {
            finalContour,
            finalConfidence,
            finalMorphology,
            historyContours
        };
    }

    /**
     * Внутренний метод усреднения контуров
     */
    averageContoursInternal(contourA, contourB) {averageContoursInternal(contourA, contourB, confA = 0.5, confB = 0.5) {
    if (!contourA || !contourB || contourA.length < 3 || contourB.length < 3) {
        return contourA || contourB || [];
    }
   
    const areaA = this.computePolygonArea(contourA);
    const areaB = this.computePolygonArea(contourB);
    const areaDiff = Math.abs(areaA - areaB) / Math.max(areaA, areaB);
   
    // 🔥 НОВАЯ ЛОГИКА: большая разница в площади = разные объекты
    if (areaDiff > 0.35) {  // порог 35%
        console.log(`      ⚠️ Площади различаются на ${(areaDiff*100).toFixed(1)}% — ЭТО РАЗНЫЕ ТИПЫ ОБЪЕКТОВ!`);
        // Возвращаем тот, у которого выше уверенность
        if (confA >= confB) {
            console.log(`         Беру контур A (уверенность ${(confA*100).toFixed(0)}%)`);
            return contourA;
        } else {
            console.log(`         Беру контур B (уверенность ${(confB*100).toFixed(0)}%)`);
            return contourB;
        }
    }

        const centerA = this.calculateCentroid(contourA);
        const centerB = this.calculateCentroid(contourB);
       
        const centeredA = contourA.map(p => ({ x: p.x - centerA.x, y: p.y - centerA.y }));
        const centeredB = contourB.map(p => ({ x: p.x - centerB.x, y: p.y - centerB.y }));

        const sortedA = this.sortPointsByAngle(centeredA);
        const sortedB = this.sortPointsByAngle(centeredB);

        const resampledA = this.resampleContour(sortedA, 30);
        const resampledB = this.resampleContour(sortedB, 30);
       
        const averaged = [];
        const len = Math.min(resampledA.length, resampledB.length);
        for (let i = 0; i < len; i++) {
            averaged.push({
                x: (resampledA[i].x + resampledB[i].x) / 2 + centerA.x,
                y: (resampledA[i].y + resampledB[i].y) / 2 + centerA.y
            });
        }
       
        return averaged;
    }

    /**
     * Применяет аффинное преобразование к точке
     */
    applyTransform(point, transform) {
        if (!transform) return { x: point.x, y: point.y };
       
        if (transform.scale !== undefined && transform.rotation !== undefined) {
            const cos = Math.cos(transform.rotation);
            const sin = Math.sin(transform.rotation);
            return {
                x: (point.x * cos - point.y * sin) * transform.scale + transform.translation.x,
                y: (point.x * sin + point.y * cos) * transform.scale + transform.translation.y
            };
        }
       
        return { x: point.x, y: point.y };
    }

    /**
     * Сортирует точки по полярному углу
     */
    sortPointsByAngle(points) {
        return [...points].sort((a, b) => {
            const angleA = Math.atan2(a.y, a.x);
            const angleB = Math.atan2(b.y, b.x);
            return angleA - angleB;
        });
    }

    /**
     * Ресемплирует контур до нужного количества точек
     */
    resampleContour(points, targetCount) {
        if (points.length < 3) return points;
       
        const closed = [...points, points[0]];
       
        let lengths = [];
        let totalLen = 0;
        for (let i = 0; i < closed.length - 1; i++) {
            const dx = closed[i+1].x - closed[i].x;
            const dy = closed[i+1].y - closed[i].y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            lengths.push(dist);
            totalLen += dist;
        }
       
        if (totalLen === 0) return points;
       
        const step = totalLen / targetCount;
        const resampled = [];
       
        let currentLen = 0;
        let segIdx = 0;
        let segStart = 0;
       
        resampled.push(closed[0]);
       
        for (let i = 1; i < targetCount; i++) {
            const targetLen = i * step;
           
            while (segIdx < lengths.length && segStart + lengths[segIdx] < targetLen) {
                segStart += lengths[segIdx];
                segIdx++;
            }
           
            if (segIdx >= lengths.length) break;
           
            const t = (targetLen - segStart) / lengths[segIdx];
            const p1 = closed[segIdx];
            const p2 = closed[segIdx + 1];
           
            resampled.push({
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t
            });
        }
       
        return resampled;
    }
}

module.exports = MorphologyEncoder;
