// modules/footprint/matching/TriangleMatcher.js
// 🔺 ТРЕУГОЛЬНЫЙ МАТЧЕР С КОНФИГУРИРУЕМЫМИ ПРИЗНАКАМИ

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;

        // Конфигурация признаков (вкл/выкл)
        this.featureConfig = {
            // УРОВЕНЬ 1: Базовые (всегда включены)
            compactness: { enabled: true, weight: 1 },
            eccentricity: { enabled: true, weight: 1 },
            asymmetry: { enabled: true, weight: 1 },
            convexity: { enabled: true, weight: 1 },
           
            // УРОВЕНЬ 2: Пропорции (отключены по умолчанию)
            quadrants: { enabled: false, weight: 1 },
           
            // УРОВЕНЬ 3: Центры (отключены)
            centerMass: { enabled: false, weight: 1 },
            centerInscribed: { enabled: false, weight: 1 },
            centerCircumscribed: { enabled: false, weight: 1 },
           
            // УРОВЕНЬ 4: Радиальный профиль (отключен)
            radialProfile: { enabled: false, weight: 1 }
        };

        // Статистика производительности
        this.performance = {
            totalTime: 0,
            pointsProcessed: 0,
            featureTimes: {}
        };

        // Статистика матчинга
        this.stats = {
            level1: { groups: 0, variants: 0, totalPairs: 0 },
            level2: { triangles: 0, groups: 0, variants: 0, totalPairs: 0 },
            level3: { matches: 0, confidence: 0 }
        };

        console.log(`🔺 TriangleMatcher с конфигурируемыми признаками создан`);
        this.printFeatureStatus();
    }

    /**
     * ОСНОВНОЙ МЕТОД
     */
    findMatches(pointsA, pointsB, delaunayA, delaunayB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🔺 ТРЕУГОЛЬНЫЙ ПОИСК (конфигурируемые признаки)`);
        console.log(`${'='.repeat(100)}`);
        console.log(`📊 Точек в А: ${pointsA.length}, в Б: ${pointsB.length}`);

        // 🔍 ДИАГНОСТИКА ПЕРВОЙ ТОЧКИ
        this.diagnoseFirstPoint(pointsA, pointsB);

        // ШАГ 1: Треугольники Делоне
        console.log(`\n🔍 ШАГ 1: Триангуляция Делоне`);
        console.log(`   • Треугольников в А: ${delaunayA.triangles}`);
        console.log(`   • Треугольников в Б: ${delaunayB.triangles}`);

        // ШАГ 2: Создание топологических треугольников
        console.log(`\n🔍 ШАГ 2: Создание топологических треугольников`);

        const start = Date.now();
        const trianglesA = this.buildTopologicalTriangles(delaunayA, pointsA);
        const trianglesB = this.buildTopologicalTriangles(delaunayB, pointsB);
        this.performance.totalTime = Date.now() - start;

        this.stats.level2.triangles = trianglesA.length;
        console.log(`   • Треугольников в А: ${trianglesA.length}`);
        console.log(`   • Треугольников в Б: ${trianglesB.length}`);

        // ШАГ 3: Группировка по сигнатуре
        console.log(`\n🔍 ШАГ 3: Группировка треугольников`);

        const groupsA = this.groupBySignature(trianglesA);
        const groupsB = this.groupBySignature(trianglesB);

        this.stats.level1.groups = Object.keys(groupsA).length;
        this.stats.level1.totalPairs = this.calculateTotalPairs(groupsA, groupsB);
        this.stats.level1.variants = this.calculateVariants(groupsA, groupsB);

        console.log(`   • Уникальных групп в А: ${Object.keys(groupsA).length}`);
        console.log(`   • Всего пар треугольников: ${this.stats.level1.totalPairs}`);
        console.log(`   • Среднее вариантов: ${this.stats.level1.variants.toFixed(2)}`);

        // ШАГ 4: Поиск соответствий
        console.log(`\n🔍 ШАГ 4: Поиск соответствий`);

        const matches = this.findMatchesInGroups(groupsA, groupsB);

        this.stats.level3.matches = matches.length;
        this.stats.level3.confidence = matches.length / Math.min(trianglesA.length, trianglesB.length);

        console.log(`   • Найдено пар треугольников: ${matches.length}`);
        console.log(`   • Уверенность: ${(this.stats.level3.confidence*100).toFixed(1)}%`);

        // ШАГ 5: Восстановление точек
        const pointMatches = this.reconstructPoints(matches);

        console.log(`\n✅ Найдено соответствий точек: ${pointMatches.length}`);

        // Итоговая статистика
        this.printSummary();
        this.printPerformance();

        return {
            matches: pointMatches,
            stats: this.stats,
            performance: this.performance
        };
    }

    /**
     * 🔍 ДИАГНОСТИКА ПЕРВОЙ ТОЧКИ
     */
diagnoseFirstPoint(pointsA, pointsB) {
    if (pointsA.length === 0 || pointsB.length === 0) return;

    const pointA = pointsA[0];
    const pointB = pointsB[0];

    console.log(`\n🔬 ДИАГНОСТИКА ПЕРВОЙ ТОЧКИ:`);
   
    // Вычисляем признаки для точки А
    console.log(`\n   📊 ВЫЧИСЛЕНИЕ ПРИЗНАКОВ ДЛЯ ТОЧКИ А:`);
    const featuresA = this.computeAllFeatures(pointA);
   
    // Вычисляем признаки для точки Б
    console.log(`\n   📊 ВЫЧИСЛЕНИЕ ПРИЗНАКОВ ДЛЯ ТОЧКИ Б:`);
    const featuresB = this.computeAllFeatures(pointB);

    // Таблица сравнения
    console.log(`\n┌──────────────────────┬─────────────────────┬─────────────────────┐`);
    console.log(`│ Признак              │ Точка А             │ Точка Б             │`);
    console.log(`├──────────────────────┼─────────────────────┼─────────────────────┤`);

    const formatValue = (val) => {
        if (val === null || val === undefined) return 'N/A'.padEnd(19);
        if (typeof val === 'number') return val.toFixed(4).padEnd(19);
        if (Array.isArray(val)) return `[${val.length}]`.padEnd(19);
        return String(val).substring(0, 19).padEnd(19);
    };

    const allFeatures = new Set([...Object.keys(featuresA), ...Object.keys(featuresB)]);
    for (const feat of allFeatures) {
        const valA = featuresA[feat];
        const valB = featuresB[feat];
       
        console.log(
            `│ ${feat.padEnd(20)} │ ${formatValue(valA)} │ ${formatValue(valB)} │`
        );
    }
    console.log(`└──────────────────────┴─────────────────────┴─────────────────────┘`);

    // Проверка формата данных
    console.log(`\n🔍 ПРОВЕРКА ФОРМАТА ДАННЫХ:`);
    console.log(`   • pointA имеет contour? ${pointA.contour ? '✅' : '❌'}`);
    console.log(`   • pointA.radialProfile: ${pointA.radialProfile ? '✅' : '❌'}`);
}

    /**
     * Вычисление ВСЕХ признаков для точки (тестовый режим)
     */
    computeAllFeatures(point) {
        const features = {};
        const timings = {};

        for (const [name, config] of Object.entries(this.featureConfig)) {
            const start = Date.now();
           
            try {
                switch(name) {
                    case 'compactness':
                        features.compactness = point.compactness || 0;
                        break;
                    case 'eccentricity':
                        features.eccentricity = point.eccentricity || 0;
                        break;
                    case 'asymmetry':
                        features.asymmetry = this.calcAsymmetry(point);
                        break;
                    case 'convexity':
                        features.convexity = point.isConvex ? 1 : 0;
                        break;
                    case 'quadrants':
                        features.quadrants = this.calcQuadrants(point);
                        break;
                    case 'centerMass':
                        features.centerMass = this.calcCenterMass(point);
                        break;
                    case 'centerInscribed':
                        features.centerInscribed = this.calcCenterInscribed(point);
                        break;
                    case 'centerCircumscribed':
                        features.centerCircumscribed = this.calcCenterCircumscribed(point);
                        break;
                    case 'radialProfile':
                        features.radialProfile = this.calcRadialProfile(point);
                        break;
                }
            } catch (e) {
                console.log(`   ⚠️ Ошибка вычисления ${name}: ${e.message}`);
                features[name] = null;
            }

            const time = Date.now() - start;
            timings[name] = time;
           
            if (!this.performance.featureTimes[name]) {
                this.performance.featureTimes[name] = { total: 0, count: 0 };
            }
            this.performance.featureTimes[name].total += time;
            this.performance.featureTimes[name].count++;
        }

        this.performance.pointsProcessed++;

        // Выводим время вычисления
        console.log(`   ⏱️ Время вычисления признаков:`);
        for (const [name, time] of Object.entries(timings)) {
            const avg = this.performance.featureTimes[name].total /
                       this.performance.featureTimes[name].count;
            console.log(`      • ${name}: ${time}ms (среднее ${avg.toFixed(2)}ms)`);
        }

        return features;
    }

    /**
     * Вектор признаков точки (только включенные)
     */
    getPointVector(point) {
        const vector = [];

        for (const [name, config] of Object.entries(this.featureConfig)) {
            if (!config.enabled) continue;

            switch(name) {
                case 'compactness':
                    vector.push(Math.floor(point.compactness / 5));
                    break;
                case 'eccentricity':
                    vector.push(Math.floor(point.eccentricity * 3));
                    break;
                case 'asymmetry':
                    vector.push(Math.floor(this.calcAsymmetry(point) * 10));
                    break;
                case 'convexity':
                    vector.push(point.isConvex ? 1 : 0);
                    break;
                case 'quadrants':
                    vector.push(...this.calcQuadrants(point).map(v => Math.floor(v * 10)));
                    break;
                case 'centerMass':
                    vector.push(Math.floor(this.calcCenterMass(point) * 10));
                    break;
                case 'centerInscribed':
                    vector.push(Math.floor(this.calcCenterInscribed(point) * 10));
                    break;
                case 'centerCircumscribed':
                    vector.push(Math.floor(this.calcCenterCircumscribed(point) * 10));
                    break;
                case 'radialProfile':
                    const radial = this.calcRadialProfile(point);
                    vector.push(Math.floor(radial.min / radial.max * 10));
                    break;
            }
        }

        return vector;
    }

    /**
     * Построение топологических треугольников
     */
buildTopologicalTriangles(delaunay, points) {
    const triangles = [];
    const pointMap = new Map(points.map(p => [p.id, p]));

    // Получаем список треугольников
    const triangleList = this.getTrianglesFromDelaunay(delaunay);
   
    console.log(`   🏗️ Построение треугольников из ${triangleList.length} записей`);

    for (const tri of triangleList) {
        // tri — это массив индексов [idx1, idx2, idx3]
        // Индексы ссылаются на points по порядку
        if (!Array.isArray(tri) || tri.length < 3) continue;
       
        const [idx1, idx2, idx3] = tri;
       
        // Получаем точки по индексам
        const p1 = points[idx1];
        const p2 = points[idx2];
        const p3 = points[idx3];

        if (!p1 || !p2 || !p3) {
            console.log(`   ⚠️ Не найдены точки для индексов ${idx1}, ${idx2}, ${idx3}`);
            continue;
        }

        // Вектор признаков для каждой точки (5 чисел)
        const v1 = this.getPointVector(p1);
        const v2 = this.getPointVector(p2);
        const v3 = this.getPointVector(p3);

        // Сортируем векторы для инвариантности к повороту
        const vectors = [v1, v2, v3].sort((a, b) => {
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) return a[i] - b[i];
            }
            return 0;
        });

        const triangle = {
            points: [p1.id, p2.id, p3.id],
            vectors: vectors.flat(),
            signature: vectors.flat().join('_'),
            p1, p2, p3,
            center: {
                x: (p1.x + p2.x + p3.x) / 3,
                y: (p1.y + p2.y + p3.y) / 3
            }
        };

        triangles.push(triangle);
    }

    console.log(`   ✅ Построено ${triangles.length} топологических треугольников`);
    return triangles;
}

    /**
     * Заглушки для вычисления признаков (реализовать позже)
     */
    calcAsymmetry(point) { return 0.5; }
    calcQuadrants(point) { return [0.25, 0.25, 0.25, 0.25]; }
    calcCenterMass(point) { return 0; }
    calcCenterInscribed(point) { return 0; }
    calcCenterCircumscribed(point) { return 0; }
    calcRadialProfile(point) { return { min: 1, max: 1 }; }

    /**
     * Получение треугольников из Делоне
     */
    getTrianglesFromDelaunay(delaunay) {
    if (!delaunay) {
        console.log(`⚠️ delaunay = null/undefined`);
        return [];
    }
   
    console.log(`🔍 Структура delaunay:`, Object.keys(delaunay));
   
    if (delaunay.triangleList) {
        console.log(`✅ Найдено triangleList, тип:`, typeof delaunay.triangleList);
        console.log(`✅ triangleList длина:`, delaunay.triangleList.length);
        console.log(`✅ triangleList первые 3 элемента:`, delaunay.triangleList.slice(0, 3));
        return delaunay.triangleList;
    }
   
    console.log(`❌ Нет данных о треугольниках в графе`);
    return [];
}
    /**
     * Группировка по сигнатуре
     */
    groupBySignature(triangles) {
        const groups = {};
        for (const t of triangles) {
            if (!groups[t.signature]) groups[t.signature] = [];
            groups[t.signature].push(t);
        }
        return groups;
    }

    /**
     * Поиск соответствий
     */
    findMatchesInGroups(groupsA, groupsB) {
        const matches = [];
        for (const [key, trisA] of Object.entries(groupsA)) {
            const trisB = groupsB[key];
            if (!trisB) continue;
            for (let i = 0; i < Math.min(trisA.length, trisB.length); i++) {
                matches.push({ triangleA: trisA[i], triangleB: trisB[i], score: 1.0 });
            }
        }
        return matches;
    }

    /**
     * Восстановление точек
     */
    reconstructPoints(matches) {
        const pointMatches = [];
        const usedA = new Set();
        const usedB = new Set();

        for (const match of matches) {
            const tA = match.triangleA;
            const tB = match.triangleB;

            for (let i = 0; i < 3; i++) {
                const pointA = tA.points[i];
                const pointB = tB.points[i];

                if (!usedA.has(pointA) && !usedB.has(pointB)) {
                    pointMatches.push({ pointA, pointB, confidence: match.score });
                    usedA.add(pointA);
                    usedB.add(pointB);
                }
            }
        }

        return pointMatches;
    }

    /**
     * Вспомогательные методы
     */
    calculateTotalPairs(groupsA, groupsB) {
        let total = 0;
        for (const key of Object.keys(groupsA)) {
            if (groupsB[key]) {
                total += groupsA[key].length * groupsB[key].length;
            }
        }
        return total;
    }

    calculateVariants(groupsA, groupsB) {
        let total = 0, count = 0;
        for (const key of Object.keys(groupsA)) {
            if (groupsB[key]) {
                total += Math.max(groupsA[key].length, groupsB[key].length);
                count++;
            }
        }
        return count > 0 ? total / count : 0;
    }

    /**
     * Статус признаков
     */
    printFeatureStatus() {
        console.log(`\n📋 КОНФИГУРАЦИЯ ПРИЗНАКОВ:`);
        for (const [name, config] of Object.entries(this.featureConfig)) {
            console.log(`   • ${name}: ${config.enabled ? '✅' : '⏸️'}`);
        }
    }

    /**
     * Итоговая статистика
     */
    printSummary() {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`📊 ИТОГОВАЯ СТАТИСТИКА`);
        console.log(`${'='.repeat(100)}`);

        console.log(`\n📈 ТРЕУГОЛЬНИКИ:`);
        console.log(`   • В следе А: ${this.stats.level2.triangles}`);
        console.log(`   • Уникальных групп: ${this.stats.level1.groups}`);
        console.log(`   • Всего пар: ${this.stats.level1.totalPairs}`);
        console.log(`   • Среднее вариантов: ${this.stats.level1.variants.toFixed(2)}`);

        console.log(`\n🎯 СООТВЕТСТВИЯ:`);
        console.log(`   • Найдено пар треугольников: ${this.stats.level3.matches}`);
        console.log(`   • Уверенность: ${(this.stats.level3.confidence*100).toFixed(1)}%`);
        console.log(`   • Восстановлено точек: ${this.stats.level3.matches * 3}`);
    }

    /**
     * Производительность
     */
    printPerformance() {
        console.log(`\n⏱️ ПРОИЗВОДИТЕЛЬНОСТЬ:`);
        console.log(`   • Всего обработано точек: ${this.performance.pointsProcessed}`);
        console.log(`   • Общее время: ${this.performance.totalTime}ms`);
       
        console.log(`\n   ⏱️ ПО ПРИЗНАКАМ:`);
        for (const [name, data] of Object.entries(this.performance.featureTimes)) {
            const avg = data.total / data.count;
            console.log(`      • ${name}: ${avg.toFixed(2)}ms в среднем`);
        }
    }
}

module.exports = TriangleMatcher;
