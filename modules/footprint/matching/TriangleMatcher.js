// modules/footprint/matching/TriangleMatcher.js
// 🔺 ИЕРАРХИЧЕСКИЙ ТРЕУГОЛЬНЫЙ МАТЧЕР (только устойчивые признаки)

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Пороги для мягкой морфологии (Уровень 1)
        this.compactnessThreshold = options.compactnessThreshold || 0.4;  // 40%
        this.eccentricityThreshold = options.eccentricityThreshold || 0.2; // 20%
        this.areaThreshold = options.areaThreshold || 0.5; // 50% (логарифм)
       
        // Пороги для мягкой геометрии (Уровень 4)
        this.ratioThreshold = options.ratioThreshold || 0.2; // 20%
       
        // Статистика по уровням
        this.stats = {
            level1: { groups: 0, variants: 0 },
            level2: { triangles: 0, groups: 0, variants: 0 },
            level3: { structures: 0, groups: 0, variants: 0 },
            level4: { matches: 0, confidence: 0 }
        };
       
        console.log(`🔺 Иерархический TriangleMatcher создан`);
    }

    findMatches(pointsA, pointsB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🔺 ИЕРАРХИЧЕСКИЙ ПОИСК (только устойчивые признаки)`);
        console.log(`${'='.repeat(100)}`);
        console.log(`📊 Точек в А: ${pointsA.length}, в Б: ${pointsB.length}`);

        // ===== УРОВЕНЬ 1: Мягкая морфология =====
        console.log(`\n🔍 УРОВЕНЬ 1: Группировка точек по форме...`);
       
        const groupsA = this.groupPointsByMorphology(pointsA);
        const groupsB = this.groupPointsByMorphology(pointsB);
       
        this.stats.level1.groups = Object.keys(groupsA).length;
        this.stats.level1.variants = this.calculateVariants(groupsA, groupsB);
       
        console.log(`   • Групп в А: ${Object.keys(groupsA).length}`);
        console.log(`   • Групп в Б: ${Object.keys(groupsB).length}`);
        console.log(`   • Вариантов на группу: ${this.stats.level1.variants.toFixed(2)}`);

        // ===== УРОВЕНЬ 2: Топологические треугольники =====
        console.log(`\n🔍 УРОВЕНЬ 2: Построение топологических треугольников...`);
       
        const trianglesA = this.buildTriangles(groupsA);
        const trianglesB = this.buildTriangles(groupsB);
       
        this.stats.level2.triangles = trianglesA.length;
        console.log(`   • Треугольников в А: ${trianglesA.length}`);
        console.log(`   • Треугольников в Б: ${trianglesB.length}`);

        // Группировка треугольников (инвариантно к повороту)
        const triGroupsA = this.groupTrianglesByTopology(trianglesA);
        const triGroupsB = this.groupTrianglesByTopology(trianglesB);
       
        this.stats.level2.groups = Object.keys(triGroupsA).length;
        this.stats.level2.variants = this.calculateVariants(triGroupsA, triGroupsB);
       
        console.log(`   • Групп треугольников в А: ${Object.keys(triGroupsA).length}`);
        console.log(`   • Групп треугольников в Б: ${Object.keys(triGroupsB).length}`);
        console.log(`   • Вариантов на группу: ${this.stats.level2.variants.toFixed(2)}`);

        // ===== УРОВЕНЬ 3: Структуры из треугольников =====
        console.log(`\n🔍 УРОВЕНЬ 3: Построение структур...`);
       
        const structuresA = this.buildStructures(trianglesA);
        const structuresB = this.buildStructures(trianglesB);
       
        this.stats.level3.structures = structuresA.length;
        console.log(`   • Структур в А: ${structuresA.length}`);
        console.log(`   • Структур в Б: ${structuresB.length}`);

        // Группировка структур
        const structGroupsA = this.groupStructures(structuresA);
        const structGroupsB = this.groupStructures(structuresB);
       
        this.stats.level3.groups = Object.keys(structGroupsA).length;
        this.stats.level3.variants = this.calculateVariants(structGroupsA, structGroupsB);
       
        console.log(`   • Групп структур в А: ${Object.keys(structGroupsA).length}`);
        console.log(`   • Групп структур в Б: ${Object.keys(structGroupsB).length}`);
        console.log(`   • Вариантов на группу: ${this.stats.level3.variants.toFixed(2)}`);

        // ===== УРОВЕНЬ 4: Мягкая геометрия =====
        console.log(`\n🔍 УРОВЕНЬ 4: Геометрическая верификация...`);
       
        const matches = this.matchStructures(structGroupsA, structGroupsB);
       
        this.stats.level4.matches = matches.length;
        this.stats.level4.confidence = matches.length / Math.min(trianglesA.length, trianglesB.length);
       
        console.log(`   • Найдено соответствий: ${matches.length}`);
        console.log(`   • Уверенность: ${(this.stats.level4.confidence*100).toFixed(1)}%`);

        // ===== Восстановление точек =====
        const pointMatches = this.reconstructPoints(matches);
       
        console.log(`\n✅ Найдено соответствий точек: ${pointMatches.length}`);
        this.printSummary();

        return {
            matches: pointMatches,
            stats: this.stats
        };
    }

    /**
     * УРОВЕНЬ 1: Группировка точек по мягкой морфологии
     */
    groupPointsByMorphology(points) {
        const groups = {};
       
        for (const point of points) {
            // Большие шаги для мягкой группировки
            const compactGroup = Math.floor(point.compactness / 10);      // шаг 10
            const eccGroup = Math.floor(point.eccentricity * 2);          // 0-0.5, 0.5-1.0
            const logArea = Math.log10(point.normalizedArea + 1);
            const areaGroup = Math.floor(logArea * 3);                    // 3 группы
           
            const key = `${compactGroup}_${eccGroup}_${areaGroup}`;
           
            if (!groups[key]) groups[key] = [];
            groups[key].push(point);
        }
       
        return groups;
    }

    /**
     * УРОВЕНЬ 2: Построение треугольников (инвариантно к повороту)
     */
    buildTriangles(groups) {
        const triangles = [];
       
        for (const groupPoints of Object.values(groups)) {
            if (groupPoints.length < 3) continue;
           
            for (let i = 0; i < groupPoints.length; i++) {
                for (let j = i+1; j < groupPoints.length; j++) {
                    for (let k = j+1; k < groupPoints.length; k++) {
                        const p1 = groupPoints[i];
                        const p2 = groupPoints[j];
                        const p3 = groupPoints[k];
                       
                        // Только расстояния (для будущей геометрии)
                        const d12 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                        const d13 = Math.hypot(p1.x - p3.x, p1.y - p3.y);
                        const d23 = Math.hypot(p2.x - p3.x, p2.y - p3.y);
                       
                        if (d12 < 0.1 || d13 < 0.1 || d23 < 0.1) continue;
                       
                        // Отношения сторон (сортируем для инвариантности к повороту)
                        const ratios = [d12/d13, d12/d23, d13/d23].sort((a,b)=>a-b);
                       
                        triangles.push({
                            points: [p1.id, p2.id, p3.id],
                            ratios,
                            edges: [
                                [p1.id, p2.id].sort().join('--'),
                                [p2.id, p3.id].sort().join('--'),
                                [p3.id, p1.id].sort().join('--')
                            ]
                        });
                    }
                }
            }
        }
       
        return triangles;
    }

    /**
     * УРОВЕНЬ 2: Группировка треугольников по топологии
     * (пока просто по грубым отношениям)
     */
    groupTrianglesByTopology(triangles) {
        const groups = {};
       
        for (const t of triangles) {
            // Грубая геометрия (шаг 0.2) для группировки
            const roughRatios = t.ratios.map(r => Math.floor(r * 5) / 5).join('_');
           
            if (!groups[roughRatios]) groups[roughRatios] = [];
            groups[roughRatios].push(t);
        }
       
        return groups;
    }

    /**
     * УРОВЕНЬ 3: Построение структур из треугольников
     */
    buildStructures(triangles) {
        const structures = [];
        const used = new Set();
       
        // Строим граф треугольников
        const triangleMap = new Map();
        triangles.forEach((t, idx) => triangleMap.set(idx, t));
       
        // Ищем связанные треугольники (по общим рёбрам)
        for (let i = 0; i < triangles.length; i++) {
            if (used.has(i)) continue;
           
            const structure = [triangles[i]];
            used.add(i);
           
            // Жадно добавляем соседей
            let changed;
            do {
                changed = false;
                for (let j = 0; j < triangles.length; j++) {
                    if (used.has(j)) continue;
                   
                    // Проверяем, есть ли общее ребро с любым треугольником в структуре
                    for (const t of structure) {
                        for (const edge of t.edges) {
                            if (triangles[j].edges.includes(edge)) {
                                structure.push(triangles[j]);
                                used.add(j);
                                changed = true;
                                break;
                            }
                        }
                        if (changed) break;
                    }
                    if (changed) break;
                }
            } while (changed);
           
            if (structure.length > 1) {
                structures.push({
                    triangles: structure,
                    size: structure.length,
                    // Подпись структуры (сортируем для инвариантности)
                    signature: structure.map(t =>
                        t.ratios.map(r => Math.floor(r * 5)).join('_')
                    ).sort().join('|')
                });
            }
        }
       
        return structures;
    }

    /**
     * УРОВЕНЬ 3: Группировка структур
     */
    groupStructures(structures) {
        const groups = {};
       
        for (const s of structures) {
            if (!groups[s.signature]) groups[s.signature] = [];
            groups[s.signature].push(s);
        }
       
        return groups;
    }

    /**
     * УРОВЕНЬ 4: Мягкая геометрия
     */
    matchStructures(structGroupsA, structGroupsB) {
        const matches = [];
       
        for (const [sig, structsA] of Object.entries(structGroupsA)) {
            const structsB = structGroupsB[sig];
            if (!structsB) continue;
           
            // Для каждой структуры ищем лучшее соответствие
            for (let i = 0; i < Math.min(structsA.length, structsB.length); i++) {
                const sA = structsA[i];
                const sB = structsB[i];
               
                // Проверяем геометрию с мягким допуском
                let geoScore = 0;
                for (let j = 0; j < Math.min(sA.triangles.length, sB.triangles.length); j++) {
                    const tA = sA.triangles[j];
                    const tB = sB.triangles[j];
                   
                    for (let k = 0; k < 3; k++) {
                        const diff = Math.abs(tA.ratios[k] - tB.ratios[k]);
                        geoScore += 1 - Math.min(diff / this.ratioThreshold, 1);
                    }
                }
                geoScore /= (sA.triangles.length * 3);
               
                if (geoScore > 0.7) {
                    matches.push({
                        structureA: sA,
                        structureB: sB,
                        score: geoScore
                    });
                }
            }
        }
       
        return matches;
    }

    /**
     * Восстановление точек по структурам
     */
    reconstructPoints(matches) {
        const pointMatches = [];
        const usedA = new Set();
        const usedB = new Set();
       
        for (const match of matches) {
            const sA = match.structureA;
            const sB = match.structureB;
           
            for (let i = 0; i < Math.min(sA.triangles.length, sB.triangles.length); i++) {
                const tA = sA.triangles[i];
                const tB = sB.triangles[i];
               
                for (let j = 0; j < 3; j++) {
                    const pointA = tA.points[j];
                    const pointB = tB.points[j];
                   
                    if (!usedA.has(pointA) && !usedB.has(pointB)) {
                        pointMatches.push({
                            pointA,
                            pointB,
                            confidence: match.score
                        });
                        usedA.add(pointA);
                        usedB.add(pointB);
                    }
                }
            }
        }
       
        return pointMatches;
    }

    /**
     * Расчет вариантов на группу
     */
    calculateVariants(groupsA, groupsB) {
        let total = 0;
        let count = 0;
       
        for (const key of Object.keys(groupsA)) {
            if (groupsB[key]) {
                total += Math.max(groupsA[key].length, groupsB[key].length);
                count++;
            }
        }
       
        return count > 0 ? total / count : 0;
    }

    /**
     * Итоговая статистика
     */
    printSummary() {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`📊 ИТОГОВАЯ СТАТИСТИКА`);
        console.log(`${'='.repeat(100)}`);
       
        console.log(`\n📈 СЖАТИЕ ПО УРОВНЯМ:`);
        console.log(`   УРОВЕНЬ 1 (точки): ${this.stats.level1.groups} групп, вариантов ${this.stats.level1.variants.toFixed(2)}`);
        console.log(`   УРОВЕНЬ 2 (треугольники): ${this.stats.level2.groups} групп, вариантов ${this.stats.level2.variants.toFixed(2)}`);
        console.log(`   УРОВЕНЬ 3 (структуры): ${this.stats.level3.groups} групп, вариантов ${this.stats.level3.variants.toFixed(2)}`);
        console.log(`   УРОВЕНЬ 4 (соответствия): ${this.stats.level4.matches} пар, уверенность ${(this.stats.level4.confidence*100).toFixed(1)}%`);
       
        // Анализ эффективности
        const compression = [
            this.stats.level1.variants,
            this.stats.level2.variants,
            this.stats.level3.variants
        ];
       
        const improving = compression.every((v, i) => i === 0 || v < compression[i-1]);
       
        console.log(`\n💡 ВЫВОД:`);
        if (improving) {
            console.log(`   ✅ Иерархия эффективно снижает спутанность`);
        } else {
            console.log(`   ⚠️ На каком-то уровне спутанность выросла`);
        }
       
        if (this.stats.level4.confidence > 0.7) {
            console.log(`   ✅ Высокая уверенность в соответствии`);
        } else {
            console.log(`   ⚠️ Низкая уверенность — нужна дополнительная проверка`);
        }
    }
}

module.exports = TriangleMatcher;
