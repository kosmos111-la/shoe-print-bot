// modules/footprint/matching/TriangleMatcher.js
// 🔺 ИЕРАРХИЧЕСКИЙ ТРЕУГОЛЬНЫЙ МАТЧЕР (со статистикой спутанности)

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
       
        this.stats.level1.groupsA = Object.keys(groupsA).length;
        this.stats.level1.groupsB = Object.keys(groupsB).length;
       
        console.log(`   • Групп в А: ${this.stats.level1.groupsA}`);
        console.log(`   • Групп в Б: ${this.stats.level1.groupsB}`);
       
        // Анализ вариантов на уровне 1
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
     * 🔥 Анализ спутанности на уровне
     */
    analyzeLevelConfusion(itemsA, itemsB, level, keyFunc = null) {
        const variants = [];
        let totalVariants = 0;
        let groupsWithVariants = 0;
       
        if (Array.isArray(itemsA) && Array.isArray(itemsB)) {
            // Для массивов (треугольники)
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
        this.stats[`level${level}`].variants = variants;
       
        // Определяем уровень спутанности
        let confusionLevel = 'Низкая';
        if (avgVariants > 5) confusionLevel = 'Критическая';
        else if (avgVariants > 3) confusionLevel = 'Высокая';
        else if (avgVariants > 1.5) confusionLevel = 'Средняя';
       
        this.stats[`level${level}`].confusionLevel = confusionLevel;
       
        console.log(`   • Среднее число вариантов: ${avgVariants.toFixed(2)} (${confusionLevel} спутанность)`);
        if (variants.length > 0) {
            console.log(`   • Групп с вариантами: ${variants.length}`);
            variants.slice(0, 2).forEach(v => {
                console.log(`      • Ключ ${v.key.slice(0,20)}... → ${v.count} вариантов`);
            });
        }
    }

    /**
     * 🔥 Анализ спутанности групп
     */
    analyzeGroupConfusion(groupsA, groupsB, level) {
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
       
        // Определяем уровень спутанности
        let confusionLevel = 'Низкая';
        if (avgVariants > 3) confusionLevel = 'Критическая';
        else if (avgVariants > 2) confusionLevel = 'Высокая';
        else if (avgVariants > 0.5) confusionLevel = 'Средняя';
       
        this.stats[`level${level}`].confusionLevel = confusionLevel;
       
        console.log(`   • Среднее расхождение размеров групп: ${avgVariants.toFixed(2)} (${confusionLevel} спутанность)`);
        console.log(`   • Общих групп: ${commonKeys.length}`);
        console.log(`   • Уникальных для А: ${Object.keys(groupsA).length - commonKeys.length}`);
        console.log(`   • Уникальных для Б: ${Object.keys(groupsB).length - commonKeys.length}`);
    }

    /**
     * 🔥 Расчет средней уверенности
     */
    calculateAvgConfidence(matches) {
        if (matches.length === 0) return 0;
        const sum = matches.reduce((s, m) => s + (m.score || 1.0), 0);
        return sum / matches.length;
    }

    /**
     * 🔥 Итоговая диагностика спутанности
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

        console.log(`\n🎯 ОБЩАЯ КАРТИНА:`);
       
        // Анализ тренда
        const trend = [];
        for (let i = 1; i <= 4; i++) {
            trend.push(this.stats[`level${i}`].avgVariants);
        }
       
        const improving = trend.every((val, i) => i === 0 || val < trend[i-1]);
       
        if (improving) {
            console.log(`   ✅ Система успешно снижает спутанность на каждом уровне`);
        } else {
            console.log(`   ⚠️ На каком-то уровне спутанность выросла — нужно проверить пороги`);
        }

        // Рекомендации
        console.log(`\n💡 РЕКОМЕНДАЦИИ:`);
       
        if (this.stats.level1.avgVariants > 3) {
            console.log(`   • УРОВЕНЬ 1: слишком много вариантов — ужесточите пороги группировки`);
        }
       
        if (this.stats.level2.avgVariants > 2 && this.stats.level2.avgVariants > this.stats.level1.avgVariants * 0.7) {
            console.log(`   • УРОВЕНЬ 2: треугольники не снижают варианты — проверьте построение`);
        }
       
        if (this.stats.level3.avgVariants > 1.5) {
            console.log(`   • УРОВЕНЬ 3: топогруппы нестабильны — возможно, роли точек меняются`);
        }
       
        if (this.stats.level4.avgVariants < 0.5) {
            console.log(`   • УРОВЕНЬ 4: геометрия хорошо разрешает неоднозначности`);
        }
       
        if (this.stats.level5.avgConfidence < 0.7) {
            console.log(`   • УРОВЕНЬ 5: низкая уверенность в соответствии — нужна глобальная проверка`);
        }
    }

    /**
     * 🔥 Получить отчет о спутанности
     */
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
            return "НИЗКАЯ УВЕРЕННОСТЬ — вернитесь к настройке порогов";
        }
    }

    // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====
    // (остаются без изменений)
    groupPointsByMorphology(points) { /* ... */ }
    buildAllTrianglesFromGroups(groups) { /* ... */ }
    createTriangle(p1, p2, p3) { /* ... */ }
    groupByTopology(triangles) { /* ... */ }
    groupByGeometry(topoGroups) { /* ... */ }
    findMatchesInGroups(geoGroupsA, geoGroupsB) { /* ... */ }
    countAmbiguous(matches) { /* ... */ }
    reconstructPoints(matches) { /* ... */ }
}

module.exports = TriangleMatcher;
