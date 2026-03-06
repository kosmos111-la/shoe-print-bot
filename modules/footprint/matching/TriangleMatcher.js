// modules/footprint/matching/TriangleMatcher.js
// 🔺 ИЕРАРХИЧЕСКИЙ ТРЕУГОЛЬНЫЙ МАТЧЕР (с защитой от undefined)

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Пороги
        this.compactnessThreshold = options.compactnessThreshold || 0.3;
        this.eccentricityThreshold = options.eccentricityThreshold || 0.15;
        this.areaThreshold = options.areaThreshold || 0.4;
        this.ratioThreshold = options.ratioThreshold || 0.15;
       
        // Статистика для принятия решений
        this.stats = {
            level1: { groupsA: 0, groupsB: 0, variants: [], avgVariants: 0, confusionLevel: 0 },
            level2: { trianglesA: 0, trianglesB: 0, variants: [], avgVariants: 0, confusionLevel: 0 },
            level3: { topoGroupsA: 0, topoGroupsB: 0, variants: [], avgVariants: 0, confusionLevel: 0 },
            level4: { geoGroupsA: 0, geoGroupsB: 0, variants: [], avgVariants: 0, confusionLevel: 0 },
            level5: { matches: 0, ambiguous: 0, avgConfidence: 0 }
        };
       
        console.log(`🔺 Иерархический TriangleMatcher создан`);
    }

    findMatches(pointsA, pointsB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🔺 ИЕРАРХИЧЕСКИЙ ТРЕУГОЛЬНЫЙ ПОИСК`);
        console.log(`${'='.repeat(100)}`);
        console.log(`📊 Точек в А: ${pointsA.length}, в Б: ${pointsB.length}`);

        // ===== УРОВЕНЬ 1: ГРУППИРОВКА ТОЧЕК =====
        console.log(`\n🔍 УРОВЕНЬ 1: Группировка точек по форме...`);
       
        const groupsA = this.groupPointsByMorphology(pointsA);
        const groupsB = this.groupPointsByMorphology(pointsB);
       
        if (!groupsA || !groupsB) {
            console.log(`❌ Ошибка группировки точек`);
            return { matches: [], stats: this.stats };
        }
       
        this.stats.level1.groupsA = Object.keys(groupsA).length;
        this.stats.level1.groupsB = Object.keys(groupsB).length;
       
        console.log(`   • Групп в А: ${this.stats.level1.groupsA}`);
        console.log(`   • Групп в Б: ${this.stats.level1.groupsB}`);
       
        this.analyzeLevelConfusion(groupsA, groupsB, 1);

        // ===== УРОВЕНЬ 2: ТРЕУГОЛЬНИКИ =====
        console.log(`\n🔍 УРОВЕНЬ 2: Построение треугольников...`);
       
        const trianglesA = this.buildAllTrianglesFromGroups(groupsA);
        const trianglesB = this.buildAllTrianglesFromGroups(groupsB);
       
        this.stats.level2.trianglesA = trianglesA.length;
        this.stats.level2.trianglesB = trianglesB.length;
       
        console.log(`   • Треугольников в А: ${this.stats.level2.trianglesA}`);
        console.log(`   • Треугольников в Б: ${this.stats.level2.trianglesB}`);
       
        this.analyzeLevelConfusion(trianglesA, trianglesB, 2, t => t.roles);

        // ===== УРОВЕНЬ 3: ТОПОЛОГИЧЕСКИЕ ГРУППЫ =====
        console.log(`\n🔍 УРОВЕНЬ 3: Топологическая группировка...`);
       
        const topoGroupsA = this.groupByTopology(trianglesA);
        const topoGroupsB = this.groupByTopology(trianglesB);
       
        this.stats.level3.topoGroupsA = Object.keys(topoGroupsA).length;
        this.stats.level3.topoGroupsB = Object.keys(topoGroupsB).length;
       
        console.log(`   • Топогрупп в А: ${this.stats.level3.topoGroupsA}`);
        console.log(`   • Топогрупп в Б: ${this.stats.level3.topoGroupsB}`);
       
        this.analyzeGroupConfusion(topoGroupsA, topoGroupsB, 3);

        // ===== УРОВЕНЬ 4: ГЕОМЕТРИЧЕСКИЕ ГРУППЫ =====
        console.log(`\n🔍 УРОВЕНЬ 4: Геометрическая группировка...`);
       
        const geoGroupsA = this.groupByGeometry(topoGroupsA);
        const geoGroupsB = this.groupByGeometry(topoGroupsB);
       
        this.stats.level4.geoGroupsA = Object.keys(geoGroupsA).length;
        this.stats.level4.geoGroupsB = Object.keys(geoGroupsB).length;
       
        console.log(`   • Геогрупп в А: ${this.stats.level4.geoGroupsA}`);
        console.log(`   • Геогрупп в Б: ${this.stats.level4.geoGroupsB}`);
       
        this.analyzeGroupConfusion(geoGroupsA, geoGroupsB, 4);

        // ===== УРОВЕНЬ 5: ПОИСК СООТВЕТСТВИЙ =====
        console.log(`\n🔍 УРОВЕНЬ 5: Поиск соответствий...`);
       
        const matches = this.findMatchesInGroups(geoGroupsA, geoGroupsB);
       
        this.stats.level5.matches = matches.length;
        this.stats.level5.ambiguous = this.countAmbiguous(matches);
        this.stats.level5.avgConfidence = this.calculateAvgConfidence(matches);
       
        console.log(`   • Найдено пар: ${this.stats.level5.matches}`);
        console.log(`   • Неоднозначных: ${this.stats.level5.ambiguous}`);
        console.log(`   • Средняя уверенность: ${(this.stats.level5.avgConfidence*100).toFixed(1)}%`);

        // ===== ИТОГОВАЯ ДИАГНОСТИКА =====
        this.printConfusionDiagnostics();

        return {
            matches: this.reconstructPoints(matches),
            stats: this.stats,
            confusion: this.getConfusionReport()
        };
    }

    /**
     * 🔥 УРОВЕНЬ 1: Группировка точек с защитой
     */
    groupPointsByMorphology(points) {
        if (!points || points.length === 0) {
            console.log(`   ⚠️ Нет точек для группировки`);
            return {};
        }
       
        const groups = {};
        let pointsWithMorph = 0;
        let skippedPoints = 0;
       
        for (const point of points) {
            // Проверяем наличие всех необходимых полей
            if (point.compactness === undefined || point.compactness === null) {
                skippedPoints++;
                continue;
            }
            if (point.eccentricity === undefined || point.eccentricity === null) {
                skippedPoints++;
                continue;
            }
            if (point.normalizedArea === undefined || point.normalizedArea === null) {
                skippedPoints++;
                continue;
            }
           
            const compactGroup = Math.floor(point.compactness / 5);
            const eccGroup = Math.floor(point.eccentricity * 3);
            const logArea = Math.log10(point.normalizedArea + 1);
            const areaGroup = Math.floor(logArea * 2);
            const role = point.role || 'R';
           
            const key = `${role}_${compactGroup}_${eccGroup}_${areaGroup}`;
           
            if (!groups[key]) groups[key] = [];
            groups[key].push(point);
            pointsWithMorph++;
        }
       
        if (skippedPoints > 0) {
            console.log(`   ⚠️ Пропущено точек без морфологии: ${skippedPoints}`);
        }
        console.log(`   • Точек с морфологией: ${pointsWithMorph}/${points.length}`);
       
        return groups;
    }

    /**
     * 🔥 УРОВЕНЬ 2: Построение треугольников
     */
    buildAllTrianglesFromGroups(groups) {
        const triangles = [];
       
        for (const [groupKey, groupPoints] of Object.entries(groups)) {
            if (groupPoints.length < 3) continue;
           
            for (let i = 0; i < groupPoints.length; i++) {
                for (let j = i+1; j < groupPoints.length; j++) {
                    for (let k = j+1; k < groupPoints.length; k++) {
                        const triangle = this.createTriangle(
                            groupPoints[i],
                            groupPoints[j],
                            groupPoints[k]
                        );
                        if (triangle) triangles.push(triangle);
                    }
                }
            }
        }
       
        return triangles;
    }

    /**
     * 🔥 Создание треугольника с проверкой
     */
    createTriangle(p1, p2, p3) {
        if (!p1 || !p2 || !p3) return null;
       
        const roles = [p1.role, p2.role, p3.role].sort().join('');
       
        const d12 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const d13 = Math.hypot(p1.x - p3.x, p1.y - p3.y);
        const d23 = Math.hypot(p2.x - p3.x, p2.y - p3.y);
       
        // Защита от деления на ноль
        if (d12 < 0.1 || d13 < 0.1 || d23 < 0.1) return null;
       
        const ratios = [d12/d13, d12/d23, d13/d23].sort((a,b)=>a-b);
       
        return {
            points: [p1.id, p2.id, p3.id],
            roles,
            ratios,
            edges: [
                [p1.id, p2.id].sort().join('--'),
                [p2.id, p3.id].sort().join('--'),
                [p3.id, p1.id].sort().join('--')
            ]
        };
    }

    /**
     * 🔥 УРОВЕНЬ 3: Топологическая группировка
     */
    groupByTopology(triangles) {
        const groups = {};
        for (const t of triangles) {
            if (!groups[t.roles]) groups[t.roles] = [];
            groups[t.roles].push(t);
        }
        return groups;
    }

    /**
     * 🔥 УРОВЕНЬ 4: Геометрическая группировка
     */
    groupByGeometry(topoGroups) {
        const geoGroups = {};
        for (const [roleKey, tris] of Object.entries(topoGroups)) {
            for (const t of tris) {
                const ratioKey = t.ratios.map(r => Math.floor(r * 10)).join('_');
                const key = `${roleKey}_${ratioKey}`;
                if (!geoGroups[key]) geoGroups[key] = [];
                geoGroups[key].push(t);
            }
        }
        return geoGroups;
    }

    /**
     * 🔥 УРОВЕНЬ 5: Поиск соответствий
     */
    findMatchesInGroups(geoGroupsA, geoGroupsB) {
        const matches = [];
        for (const [key, trisA] of Object.entries(geoGroupsA)) {
            const trisB = geoGroupsB[key];
            if (!trisB) continue;
           
            for (let i = 0; i < Math.min(trisA.length, trisB.length); i++) {
                matches.push({
                    triangleA: trisA[i],
                    triangleB: trisB[i],
                    score: 1.0
                });
            }
        }
        return matches;
    }

    /**
     * 🔥 Анализ спутанности
     */
    analyzeLevelConfusion(itemsA, itemsB, level, keyFunc = null) {
        const variants = [];
        let totalVariants = 0;
        let groupsWithVariants = 0;
       
        if (!itemsA || !itemsB) {
            this.stats[`level${level}`].avgVariants = 0;
            this.stats[`level${level}`].confusionLevel = 'Нет данных';
            return;
        }
       
        if (Array.isArray(itemsA) && Array.isArray(itemsB)) {
            const groups = {};
            for (const item of itemsB) {
                const key = keyFunc ? keyFunc(item) : item;
                groups[key] = (groups[key] || 0) + 1;
            }
           
            for (const item of itemsA) {
                const key = keyFunc ? keyFunc(item) : item;
                const count = groups[key] || 0;
                if (count > 1) {
                    variants.push({ key, count });
                    totalVariants += count;
                    groupsWithVariants++;
                }
            }
        }
       
        const avgVariants = groupsWithVariants > 0 ? totalVariants / groupsWithVariants : 0;
        this.stats[`level${level}`].avgVariants = avgVariants;
       
        let confusionLevel = 'Низкая';
        if (avgVariants > 5) confusionLevel = 'Критическая';
        else if (avgVariants > 3) confusionLevel = 'Высокая';
        else if (avgVariants > 1.5) confusionLevel = 'Средняя';
       
        this.stats[`level${level}`].confusionLevel = confusionLevel;
       
        console.log(`   • Среднее число вариантов: ${avgVariants.toFixed(2)} (${confusionLevel} спутанность)`);
    }

    /**
     * 🔥 Анализ спутанности групп
     */
    analyzeGroupConfusion(groupsA, groupsB, level) {
        if (!groupsA || !groupsB) {
            this.stats[`level${level}`].avgVariants = 0;
            this.stats[`level${level}`].confusionLevel = 'Нет данных';
            return;
        }
       
        const commonKeys = Object.keys(groupsA).filter(k => groupsB[k]);
        let totalVariants = 0;
        let groupsWithVariants = 0;
       
        for (const key of commonKeys) {
            const diff = Math.abs(groupsA[key].length - groupsB[key].length);
            if (diff > 0) {
                totalVariants += diff;
                groupsWithVariants++;
            }
        }
       
        const avgVariants = groupsWithVariants > 0 ? totalVariants / groupsWithVariants : 0;
        this.stats[`level${level}`].avgVariants = avgVariants;
       
        let confusionLevel = 'Низкая';
        if (avgVariants > 3) confusionLevel = 'Критическая';
        else if (avgVariants > 2) confusionLevel = 'Высокая';
        else if (avgVariants > 0.5) confusionLevel = 'Средняя';
       
        this.stats[`level${level}`].confusionLevel = confusionLevel;
       
        console.log(`   • Среднее расхождение: ${avgVariants.toFixed(2)} (${confusionLevel} спутанность)`);
        console.log(`   • Общих групп: ${commonKeys.length}`);
        console.log(`   • Уникальных для А: ${Object.keys(groupsA).length - commonKeys.length}`);
        console.log(`   • Уникальных для Б: ${Object.keys(groupsB).length - commonKeys.length}`);
    }

    /**
     * 🔥 Восстановление точек
     */
    reconstructPoints(matches) {
        const pointMatches = [];
        const usedA = new Set();
        const usedB = new Set();
       
        for (const match of matches) {
            for (let i = 0; i < 3; i++) {
                const pointA = match.triangleA.points[i];
                const pointB = match.triangleB.points[i];
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
     * 🔥 Подсчет неоднозначных
     */
    countAmbiguous(matches) {
        const usedB = new Set();
        const counts = {};
       
        for (const match of matches) {
            usedB.add(match.triangleB);
        }
       
        let ambiguous = 0;
        for (const match of matches) {
            const key = JSON.stringify(match.triangleB);
            counts[key] = (counts[key] || 0) + 1;
            if (counts[key] > 1) ambiguous++;
        }
       
        return ambiguous;
    }

    /**
     * 🔥 Средняя уверенность
     */
    calculateAvgConfidence(matches) {
        if (matches.length === 0) return 0;
        const sum = matches.reduce((s, m) => s + (m.score || 1.0), 0);
        return sum / matches.length;
    }

    /**
     * 🔥 Финальная диагностика
     */
    printConfusionDiagnostics() {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`📊 ДИАГНОСТИКА СПУТАННОСТИ`);
        console.log(`${'='.repeat(100)}`);
       
        console.log(`\n📈 ДИНАМИКА ПО УРОВНЯМ:`);
        console.log(`   УРОВЕНЬ 1 (точки): среднее вариантов ${this.stats.level1.avgVariants.toFixed(2)} — ${this.stats.level1.confusionLevel}`);
        console.log(`   УРОВЕНЬ 2 (треугольники): среднее вариантов ${this.stats.level2.avgVariants.toFixed(2)} — ${this.stats.level2.confusionLevel}`);
        console.log(`   УРОВЕНЬ 3 (топогруппы): расхождение ${this.stats.level3.avgVariants.toFixed(2)} — ${this.stats.level3.confusionLevel}`);
        console.log(`   УРОВЕНЬ 4 (геогруппы): расхождение ${this.stats.level4.avgVariants.toFixed(2)} — ${this.stats.level4.confusionLevel}`);
        console.log(`   УРОВЕНЬ 5 (соответствия): уверенность ${(this.stats.level5.avgConfidence*100).toFixed(1)}%`);

        const improving = this.isImproving();
        if (improving) {
            console.log(`\n✅ Система успешно снижает спутанность`);
        } else {
            console.log(`\n⚠️ На каком-то уровне спутанность выросла`);
        }

        console.log(`\n💡 РЕКОМЕНДАЦИЯ: ${this.getRecommendation()}`);
    }

    isImproving() {
        const trend = [
            this.stats.level1.avgVariants,
            this.stats.level2.avgVariants,
            this.stats.level3.avgVariants,
            this.stats.level4.avgVariants
        ];
        return trend.every((val, i) => i === 0 || val < trend[i-1]);
    }

    getRecommendation() {
        if (this.stats.level5.avgConfidence > 0.8) {
            return "ВЫСОКАЯ УВЕРЕННОСТЬ — можно использовать якоря";
        } else if (this.stats.level5.avgConfidence > 0.6) {
            return "СРЕДНЯЯ УВЕРЕННОСТЬ — нужна дополнительная проверка";
        } else {
            return "НИЗКАЯ УВЕРЕННОСТЬ — проверьте пороги";
        }
    }

    getConfusionReport() {
        return {
            level1: { avgVariants: this.stats.level1.avgVariants, confusion: this.stats.level1.confusionLevel },
            level2: { avgVariants: this.stats.level2.avgVariants, confusion: this.stats.level2.confusionLevel },
            level3: { avgVariants: this.stats.level3.avgVariants, confusion: this.stats.level3.confusionLevel },
            level4: { avgVariants: this.stats.level4.avgVariants, confusion: this.stats.level4.confusionLevel },
            level5: { confidence: this.stats.level5.avgConfidence },
            improving: this.isImproving(),
            recommendation: this.getRecommendation()
        };
    }
}

module.exports = TriangleMatcher;
