// modules/footprint/matching/TriangleMatcher.js
// 🔺 ИЕРАРХИЧЕСКИЙ ТРЕУГОЛЬНЫЙ МАТЧЕР (с признаками рёбер и внешних точек)

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;

        // Пороги
        this.compactnessThreshold = options.compactnessThreshold || 0.4;
        this.eccentricityThreshold = options.eccentricityThreshold || 0.2;
        this.areaThreshold = options.areaThreshold || 0.5;
        this.ratioThreshold = options.ratioThreshold || 0.2;

        // Статистика
        this.stats = {
            level1: { groups: 0, variants: 0, totalPairs: 0 },
            level2: { triangles: 0, groups: 0, variants: 0, totalPairs: 0 },
            level3: { edgeGroups: 0, variants: 0, totalPairs: 0 },
            level4: { externalGroups: 0, variants: 0, totalPairs: 0 },
            level5: { matches: 0, confidence: 0 }
        };

        console.log(`🔺 TriangleMatcher с признаками рёбер и внешних точек создан`);
    }

    findMatches(pointsA, pointsB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🔺 ИЕРАРХИЧЕСКИЙ ПОИСК (с признаками рёбер и внешних точек)`);
        console.log(`${'='.repeat(100)}`);

        // 🔥 ЗАЩИТА: проверяем входные данные
        if (!pointsA || !pointsB) {
            console.log(`❌ pointsA или pointsB = null/undefined`);
            return { matches: [], stats: this.stats };
        }

        console.log(`📊 Точек в А: ${pointsA.length}, в Б: ${pointsB.length}`);

        // ===== УРОВЕНЬ 1: Мягкая морфология =====
        console.log(`\n🔍 УРОВЕНЬ 1: Группировка точек по форме...`);

        const groupsA = this.groupPointsByMorphology(pointsA);
        const groupsB = this.groupPointsByMorphology(pointsB);

        if (!groupsA || !groupsB) {
            console.log(`❌ Ошибка группировки точек`);
            return { matches: [], stats: this.stats };
        }

        this.stats.level1.groups = Object.keys(groupsA).length;
        this.stats.level1.totalPairs = this.calculateTotalPairs(groupsA, groupsB);
        this.stats.level1.variants = this.calculateVariants(groupsA, groupsB);

        console.log(`   • Групп в А: ${Object.keys(groupsA).length}`);
        console.log(`   • Групп в Б: ${Object.keys(groupsB).length}`);
        console.log(`   • Всего пар точек: ${this.stats.level1.totalPairs}`);
        console.log(`   • Среднее вариантов: ${this.stats.level1.variants.toFixed(2)}`);

        // ===== УРОВЕНЬ 2: Топологические треугольники =====
        console.log(`\n🔍 УРОВЕНЬ 2: Построение топологических треугольников...`);

        const trianglesA = this.buildTriangles(groupsA);
        const trianglesB = this.buildTriangles(groupsB);

        this.stats.level2.triangles = trianglesA.length;

        const triGroupsA = this.groupTrianglesBySignature(trianglesA);
        const triGroupsB = this.groupTrianglesBySignature(trianglesB);

        this.stats.level2.groups = Object.keys(triGroupsA).length;
        this.stats.level2.totalPairs = this.calculateTotalPairs(triGroupsA, triGroupsB);
        this.stats.level2.variants = this.calculateVariants(triGroupsA, triGroupsB);

        console.log(`   • Треугольников в А: ${trianglesA.length}`);
        console.log(`   • Треугольников в Б: ${trianglesB.length}`);
        console.log(`   • Групп треугольников в А: ${Object.keys(triGroupsA).length}`);
        console.log(`   • Всего пар треугольников: ${this.stats.level2.totalPairs}`);
        console.log(`   • Среднее вариантов: ${this.stats.level2.variants.toFixed(2)}`);

        // ===== УРОВЕНЬ 3: Группировка по признакам рёбер =====
        console.log(`\n🔍 УРОВЕНЬ 3: Анализ рёбер треугольников...`);

        const edgeGroupsA = this.groupByEdgeFeatures(trianglesA);
        const edgeGroupsB = this.groupByEdgeFeatures(trianglesB);

        this.stats.level3.edgeGroups = Object.keys(edgeGroupsA).length;
        this.stats.level3.totalPairs = this.calculateTotalPairs(edgeGroupsA, edgeGroupsB);
        this.stats.level3.variants = this.calculateVariants(edgeGroupsA, edgeGroupsB);

        console.log(`   • Групп по рёбрам в А: ${Object.keys(edgeGroupsA).length}`);
        console.log(`   • Групп по рёбрам в Б: ${Object.keys(edgeGroupsB).length}`);
        console.log(`   • Всего пар с учётом рёбер: ${this.stats.level3.totalPairs}`);
        console.log(`   • Среднее вариантов: ${this.stats.level3.variants.toFixed(2)}`);

        // ===== УРОВЕНЬ 3.5: Группировка по внешним точкам =====
        console.log(`\n🔍 УРОВЕНЬ 3.5: Анализ внешних точек через рёбра...`);

        // Добавляем внешние точки к треугольникам
        this.addExternalPointsToTriangles(trianglesA, pointsA);
        this.addExternalPointsToTriangles(trianglesB, pointsB);

        const externalGroupsA = this.groupByExternalFeatures(trianglesA);
        const externalGroupsB = this.groupByExternalFeatures(trianglesB);

        this.stats.level4.externalGroups = Object.keys(externalGroupsA).length;
        this.stats.level4.totalPairs = this.calculateTotalPairs(externalGroupsA, externalGroupsB);
        this.stats.level4.variants = this.calculateVariants(externalGroupsA, externalGroupsB);

        console.log(`   • Групп по внешним точкам в А: ${Object.keys(externalGroupsA).length}`);
        console.log(`   • Групп по внешним точкам в Б: ${Object.keys(externalGroupsB).length}`);
        console.log(`   • Всего пар с учётом внешних точек: ${this.stats.level4.totalPairs}`);
        console.log(`   • Среднее вариантов: ${this.stats.level4.variants.toFixed(2)}`);

        // ===== УРОВЕНЬ 4: Поиск соответствий =====
        console.log(`\n🔍 УРОВЕНЬ 4: Поиск соответствий...`);

        const matches = this.findMatchesInGroups(externalGroupsA, externalGroupsB);

        this.stats.level5.matches = matches.length;
        this.stats.level5.confidence = matches.length / Math.min(trianglesA.length, trianglesB.length);

        console.log(`   • Найдено соответствий: ${matches.length}`);
        console.log(`   • Уверенность: ${(this.stats.level5.confidence*100).toFixed(1)}%`);

        // ===== Восстановление точек =====
        const pointMatches = this.reconstructPoints(matches);

        console.log(`\n✅ Найдено соответствий точек: ${pointMatches.length}`);
        this.printSummary();

        // 🔥 ВОЗВРАЩАЕМ ОБЪЕКТ!
        return {
            matches: pointMatches,
            stats: this.stats
        };
    }

    /**
     * 🔥 НОВЫЙ МЕТОД: Добавление внешних точек к рёбрам
     */
    addExternalPointsToTriangles(triangles, allPoints) {
        // Создаем карту точек для быстрого доступа
        const pointMap = new Map();
        allPoints.forEach(p => pointMap.set(p.id, p));

        for (const triangle of triangles) {
            // Для каждого ребра треугольника
            for (const edge of triangle.edges) {
                edge.externalPoints = [];

                // Ищем точки, которые не входят в треугольник
                for (const point of allPoints) {
                    if (triangle.points.includes(point.id)) continue;

                    // Проверяем, лежит ли точка "за ребром"
                    const position = this.getPointPositionRelativeToEdge(
                        point,
                        edge.v1,
                        edge.v2,
                        edge.opposite
                    );

                    if (position) {
                        edge.externalPoints.push({
                            id: point.id,
                            position: position,
                            morph: point.compactness
                        });
                    }
                }

                // Сортируем внешние точки для инвариантности
                edge.externalPoints.sort((a, b) => a.id.localeCompare(b.id));
            }
        }
    }

    /**
     * 🔥 НОВЫЙ МЕТОД: Определение позиции точки относительно ребра
     */
    getPointPositionRelativeToEdge(point, v1, v2, opposite) {
        // Находим пересечение линии от opposite к point с ребром v1-v2
        const intersection = this.lineIntersection(
            opposite.x, opposite.y, point.x, point.y,
            v1.x, v1.y, v2.x, v2.y
        );

        if (!intersection) return null;

        // Определяем, где находится пересечение на ребре
        const distToV1 = this.distance(intersection.x, intersection.y, v1.x, v1.y);
        const distToV2 = this.distance(intersection.x, intersection.y, v2.x, v2.y);
        const edgeLength = this.distance(v1.x, v1.y, v2.x, v2.y);

        // Грубая классификация (3 позиции)
        const ratio = distToV1 / edgeLength;
       
        if (ratio < 0.33) return 'nearV1';
        if (ratio > 0.67) return 'nearV2';
        return 'center';
    }

    /**
     * 🔥 НОВЫЙ МЕТОД: Пересечение двух отрезков
     */
    lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 0.001) return null;

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1)
            };
        }
        return null;
    }

    /**
     * 🔥 НОВЫЙ МЕТОД: Группировка по внешним точкам
     */
    groupByExternalFeatures(triangles) {
        const groups = {};

        for (const t of triangles) {
            // Для каждого ребра создаём сигнатуру внешних точек
            const edgeKeys = t.edges.map(e => {
                // Грубая морфология внешних точек (3 градации)
                const externalSignatures = e.externalPoints.map(ep =>
                    `${Math.floor(ep.morph / 10)}_${ep.position}`
                ).sort().join('|');
               
                return externalSignatures || 'none';
            }).sort();

            const key = edgeKeys.join('||');

            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        }

        return groups;
    }

    /**
     * УРОВЕНЬ 1: Группировка точек по мягкой морфологии
     */
    groupPointsByMorphology(points) {
        const groups = {};

        for (const point of points) {
            const compactGroup = Math.floor(point.compactness / 10);
            const eccGroup = Math.floor(point.eccentricity * 2);
            const logArea = Math.log10(point.normalizedArea + 1);
            const areaGroup = Math.floor(logArea * 3);

            const key = `${compactGroup}_${eccGroup}_${areaGroup}`;

            if (!groups[key]) groups[key] = [];
            groups[key].push(point);
        }

        return groups;
    }

    /**
     * УРОВЕНЬ 2: Построение треугольников
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

                        const d12 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                        const d13 = Math.hypot(p1.x - p3.x, p1.y - p3.y);
                        const d23 = Math.hypot(p2.x - p3.x, p2.y - p3.y);

                        if (d12 < 0.1 || d13 < 0.1 || d23 < 0.1) continue;

                        const ratios = [d12/d13, d12/d23, d13/d23].sort((a,b)=>a-b);

                        const triangle = {
                            points: [p1.id, p2.id, p3.id],
                            p1, p2, p3,
                            ratios,
                            edges: [
                                {
                                    v1: p1, v2: p2,
                                    morph1: p1.compactness,
                                    morph2: p2.compactness,
                                    opposite: p3,
                                    oppositeMorph: p3.compactness,
                                    neighborTriangles: [],
                                    externalPoints: []
                                },
                                {
                                    v1: p2, v2: p3,
                                    morph1: p2.compactness,
                                    morph2: p3.compactness,
                                    opposite: p1,
                                    oppositeMorph: p1.compactness,
                                    neighborTriangles: [],
                                    externalPoints: []
                                },
                                {
                                    v1: p3, v2: p1,
                                    morph1: p3.compactness,
                                    morph2: p1.compactness,
                                    opposite: p2,
                                    oppositeMorph: p2.compactness,
                                    neighborTriangles: [],
                                    externalPoints: []
                                }
                            ]
                        };

                        triangle.signature = this.getTriangleSignature(triangle);
                        triangles.push(triangle);
                    }
                }
            }
        }

        this.buildTriangleNeighbors(triangles);
        return triangles;
    }

    /**
     * Построение связей между треугольниками
     */
    buildTriangleNeighbors(triangles) {
        const edgeMap = new Map();

        triangles.forEach((t) => {
            t.edges.forEach(edge => {
                const key = [edge.v1.id, edge.v2.id].sort().join('--');
                if (!edgeMap.has(key)) edgeMap.set(key, []);
                edgeMap.get(key).push({ triangle: t, edge });
            });
        });

        edgeMap.forEach(triList => {
            if (triList.length > 1) {
                for (let i = 0; i < triList.length; i++) {
                    for (let j = i+1; j < triList.length; j++) {
                        triList[i].edge.neighborTriangles.push(triList[j].triangle);
                        triList[j].edge.neighborTriangles.push(triList[i].triangle);
                    }
                }
            }
        });
    }

    /**
     * Сигнатура треугольника
     */
    getTriangleSignature(triangle) {
        const edgeSignatures = triangle.edges.map(e =>
            `${Math.floor(e.morph1 * 10)}_${Math.floor(e.morph2 * 10)}_${Math.floor(e.oppositeMorph * 10)}`
        ).sort();

        return edgeSignatures.join('|');
    }

    /**
     * УРОВЕНЬ 2: Группировка треугольников по сигнатуре
     */
    groupTrianglesBySignature(triangles) {
        const groups = {};

        for (const t of triangles) {
            if (!groups[t.signature]) groups[t.signature] = [];
            groups[t.signature].push(t);
        }

        return groups;
    }

    /**
     * УРОВЕНЬ 3: Группировка по признакам рёбер
     */
    groupByEdgeFeatures(triangles) {
        const groups = {};

        for (const t of triangles) {
            const edgeKeys = t.edges.map(e => {
                const hasNeighbor = e.neighborTriangles.length > 0 ? '1' : '0';
                return `${Math.floor(e.morph1 * 10)}_${Math.floor(e.morph2 * 10)}_${Math.floor(e.oppositeMorph * 10)}_${hasNeighbor}`;
            }).sort();

            const key = edgeKeys.join('|');

            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        }

        return groups;
    }

    /**
     * УРОВЕНЬ 4: Поиск соответствий
     */
    findMatchesInGroups(groupsA, groupsB) {
        const matches = [];

        if (!groupsA || !groupsB) return matches;

        for (const [key, trisA] of Object.entries(groupsA)) {
            const trisB = groupsB[key];
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

    distance(x1, y1, x2, y2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        return Math.sqrt(dx*dx + dy*dy);
    }

    printSummary() {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`📊 ИТОГОВАЯ СТАТИСТИКА`);
        console.log(`${'='.repeat(100)}`);

        console.log(`\n📈 СЖАТИЕ ПО УРОВНЯМ:`);
        console.log(`   УРОВЕНЬ 1 (точки): ${this.stats.level1.totalPairs} пар`);
        console.log(`   УРОВЕНЬ 2 (треугольники): ${this.stats.level2.totalPairs} пар`);
        console.log(`   УРОВЕНЬ 3 (рёбра): ${this.stats.level3.totalPairs} пар`);
        console.log(`   УРОВЕНЬ 3.5 (внешние точки): ${this.stats.level4.totalPairs} пар`);
        console.log(`   УРОВЕНЬ 4 (соответствия): ${this.stats.level5.matches} пар`);

        const compression = [
            this.stats.level1.totalPairs,
            this.stats.level2.totalPairs,
            this.stats.level3.totalPairs,
            this.stats.level4.totalPairs
        ];

        const improving = compression.every((v, i) => i === 0 || v < compression[i-1]);

        console.log(`\n💡 ВЫВОД:`);
        if (improving) {
            console.log(`   ✅ Иерархия эффективно снижает количество вариантов`);
        } else {
            console.log(`   ⚠️ На каком-то уровне количество вариантов выросло`);
        }

        if (this.stats.level5.matches > 0) {
            console.log(`   ✅ Найдено ${this.stats.level5.matches} соответствий`);
        } else {
            console.log(`   ⚠️ Соответствия не найдены`);
        }
    }
}

module.exports = TriangleMatcher;
