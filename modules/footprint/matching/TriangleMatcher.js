// modules/footprint/matching/TriangleMatcher.js
// 🔺 ИЕРАРХИЧЕСКИЙ ТРЕУГОЛЬНЫЙ МАТЧЕР (5 признаков + роли в базисе)

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;

        // Пороги для мягкой морфологии (допуски)
        this.compactnessThreshold = 5;  // шаг 5
        this.eccentricityThreshold = 0.33; // 3 группы
        this.areaThreshold = 0.3; // логарифмическая шкала
        this.radialThreshold = 0.2; // шаг 0.2
        this.convexityThreshold = 1; // бинарный признак

        // Статистика
        this.stats = {
            level1: { groups: 0, variants: 0, totalPairs: 0 },
            level2: { triangles: 0, groups: 0, variants: 0, totalPairs: 0 },
            level3: { edgeGroups: 0, variants: 0, totalPairs: 0 },
            level4: { externalGroups: 0, variants: 0, totalPairs: 0 },
            level5: { matches: 0, confidence: 0 }
        };

        console.log(`🔺 TriangleMatcher (5 признаков + роли в базисе) создан`);
    }

    /**
     * Вектор признаков точки (БЕЗ РОЛИ)
     */
    getPointVector(point) {
        return [
            Math.floor(point.compactness / this.compactnessThreshold),           // компактность
            Math.floor(point.eccentricity / this.eccentricityThreshold),         // вытянутость
            Math.floor(Math.log10(point.normalizedArea + 1) / this.areaThreshold), // лог площади
            Math.floor((point.radialProfile?.[0] || 0) / this.radialThreshold), // радиальный профиль
            point.isConvex ? 1 : 0                                              // выпуклость/вогнутость
        ];
    }

    /**
     * Вектор признаков точки С РОЛЬЮ (для базовых треугольников)
     */
    getPointVectorWithRole(point) {
        const roleMap = { 'H': 5, 'C': 4, 'B': 3, 'R': 2, 'L': 1 };
        return [
            Math.floor(point.compactness / this.compactnessThreshold),
            Math.floor(point.eccentricity / this.eccentricityThreshold),
            Math.floor(Math.log10(point.normalizedArea + 1) / this.areaThreshold),
            Math.floor((point.radialProfile?.[0] || 0) / this.radialThreshold),
            point.isConvex ? 1 : 0,
            roleMap[point.role] || 2  // роль как 6-й признак
        ];
    }

    findMatches(pointsA, pointsB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🔺 ИЕРАРХИЧЕСКИЙ ПОИСК (5 признаков + роли в базисе)`);
        console.log(`${'='.repeat(100)}`);

        if (!pointsA || !pointsB) {
            console.log(`❌ pointsA или pointsB = null/undefined`);
            return { matches: [], stats: this.stats };
        }

        console.log(`📊 Точек в А: ${pointsA.length}, в Б: ${pointsB.length}`);

        // ===== УРОВЕНЬ 1: Мягкая морфология (БЕЗ РОЛЕЙ) =====
        console.log(`\n🔍 УРОВЕНЬ 1: Группировка точек по форме...`);

        const groupsA = this.groupPointsByMorphology(pointsA, false);
        const groupsB = this.groupPointsByMorphology(pointsB, false);

        this.stats.level1.groups = Object.keys(groupsA).length;
        this.stats.level1.totalPairs = this.calculateTotalPairs(groupsA, groupsB);
        this.stats.level1.variants = this.calculateVariants(groupsA, groupsB);

        console.log(`   • Групп в А: ${Object.keys(groupsA).length}`);
        console.log(`   • Групп в Б: ${Object.keys(groupsB).length}`);
        console.log(`   • Всего пар точек: ${this.stats.level1.totalPairs}`);
        console.log(`   • Среднее вариантов: ${this.stats.level1.variants.toFixed(2)}`);

        // ===== УРОВЕНЬ 2: Базовые треугольники (С РОЛЯМИ) =====
        console.log(`\n🔍 УРОВЕНЬ 2: Построение базовых треугольников (с ролями)...`);

        const trianglesA = this.buildBaseTriangles(pointsA, true);  // с ролями
        const trianglesB = this.buildBaseTriangles(pointsB, true);

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

        // ===== УРОВЕНЬ 3: Рёбра (БЕЗ РОЛЕЙ) =====
        console.log(`\n🔍 УРОВЕНЬ 3: Анализ рёбер (без ролей)...`);

        // Добавляем соседей
        this.buildTriangleNeighbors(trianglesA);
        this.buildTriangleNeighbors(trianglesB);

        const edgeGroupsA = this.groupByEdgeFeatures(trianglesA, false);
        const edgeGroupsB = this.groupByEdgeFeatures(trianglesB, false);

        this.stats.level3.edgeGroups = Object.keys(edgeGroupsA).length;
        this.stats.level3.totalPairs = this.calculateTotalPairs(edgeGroupsA, edgeGroupsB);
        this.stats.level3.variants = this.calculateVariants(edgeGroupsA, edgeGroupsB);

        console.log(`   • Групп по рёбрам в А: ${Object.keys(edgeGroupsA).length}`);
        console.log(`   • Групп по рёбрам в Б: ${Object.keys(edgeGroupsB).length}`);
        console.log(`   • Всего пар с учётом рёбер: ${this.stats.level3.totalPairs}`);
        console.log(`   • Среднее вариантов: ${this.stats.level3.variants.toFixed(2)}`);

        // ===== УРОВЕНЬ 3.5: Внешние точки (БЕЗ РОЛЕЙ) =====
        console.log(`\n🔍 УРОВЕНЬ 3.5: Анализ внешних точек через рёбра...`);

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

        return {
            matches: pointMatches,
            stats: this.stats
        };
    }

    /**
     * УРОВЕНЬ 1: Группировка точек по морфологии
     */
    groupPointsByMorphology(points, withRoles = false) {
        const groups = {};

        for (const point of points) {
            const vec = withRoles ? this.getPointVectorWithRole(point) : this.getPointVector(point);
            const key = vec.join('_');

            if (!groups[key]) groups[key] = [];
            groups[key].push(point);
        }

        return groups;
    }

    /**
     * УРОВЕНЬ 2: Построение базовых треугольников
     */
    buildBaseTriangles(points, withRoles = true) {
        const triangles = [];
        const n = points.length;

        for (let i = 0; i < n; i++) {
            for (let j = i+1; j < n; j++) {
                for (let k = j+1; k < n; k++) {
                    const p1 = points[i];
                    const p2 = points[j];
                    const p3 = points[k];

                    // Проверяем минимальное расстояние
                    const d12 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                    const d13 = Math.hypot(p1.x - p3.x, p1.y - p3.y);
                    const d23 = Math.hypot(p2.x - p3.x, p2.y - p3.y);
                   
                    if (d12 < 5 || d13 < 5 || d23 < 5) continue;

                    // Векторы признаков (с ролями или без)
                    const v1 = withRoles ? this.getPointVectorWithRole(p1) : this.getPointVector(p1);
                    const v2 = withRoles ? this.getPointVectorWithRole(p2) : this.getPointVector(p2);
                    const v3 = withRoles ? this.getPointVectorWithRole(p3) : this.getPointVector(p3);

                    // Сортируем векторы для инвариантности к повороту
                    const vectors = [v1, v2, v3].sort((a, b) => {
                        for (let idx = 0; idx < a.length; idx++) {
                            if (a[idx] !== b[idx]) return a[idx] - b[idx];
                        }
                        return 0;
                    });

                    const triangle = {
                        points: [p1.id, p2.id, p3.id],
                        vectors: vectors.flat(),
                        signature: vectors.flat().join('_'),
                        p1, p2, p3,
                        edges: [
                            { v1: p1, v2: p2, opposite: p3, neighborTriangles: [], externalPoints: [] },
                            { v1: p2, v2: p3, opposite: p1, neighborTriangles: [], externalPoints: [] },
                            { v1: p3, v2: p1, opposite: p2, neighborTriangles: [], externalPoints: [] }
                        ]
                    };

                    triangles.push(triangle);
                }
            }
        }

        return triangles;
    }

    /**
     * Построение связей между треугольниками
     */
    buildTriangleNeighbors(triangles) {
        const edgeMap = new Map();

        triangles.forEach(t => {
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
     * УРОВЕНЬ 3: Группировка по признакам рёбер
     */
    groupByEdgeFeatures(triangles, withRoles = false) {
        const groups = {};

        for (const t of triangles) {
            const edgeKeys = t.edges.map(e => {
                const v1vec = withRoles ? this.getPointVectorWithRole(e.v1) : this.getPointVector(e.v1);
                const v2vec = withRoles ? this.getPointVectorWithRole(e.v2) : this.getPointVector(e.v2);
                const oppositeVec = withRoles ? this.getPointVectorWithRole(e.opposite) : this.getPointVector(e.opposite);
               
                const hasNeighbor = e.neighborTriangles.length > 0 ? 1 : 0;
               
                return [
                    ...v1vec,
                    ...v2vec,
                    ...oppositeVec,
                    hasNeighbor
                ].join('_');
            }).sort();

            const key = edgeKeys.join('||');

            if (!groups[key]) groups[key] = [];
            groups[key].push(t);
        }

        return groups;
    }

    /**
     * Добавление внешних точек к рёбрам
     */
    addExternalPointsToTriangles(triangles, allPoints) {
        for (const triangle of triangles) {
            for (const edge of triangle.edges) {
                edge.externalPoints = [];

                for (const point of allPoints) {
                    if (triangle.points.includes(point.id)) continue;

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
                            vector: this.getPointVector(point)  // БЕЗ роли!
                        });
                    }
                }
            }
        }
    }

    /**
     * Определение позиции точки относительно ребра
     */
    getPointPositionRelativeToEdge(point, v1, v2, opposite) {
        // Находим пересечение линии от opposite к point с ребром v1-v2
        const intersection = this.lineIntersection(
            opposite.x, opposite.y, point.x, point.y,
            v1.x, v1.y, v2.x, v2.y
        );

        if (!intersection) return null;

        const distToV1 = this.distance(intersection.x, intersection.y, v1.x, v1.y);
        const distToV2 = this.distance(intersection.x, intersection.y, v2.x, v2.y);
        const edgeLength = this.distance(v1.x, v1.y, v2.x, v2.y);

        const ratio = distToV1 / edgeLength;
       
        if (ratio < 0.33) return 'nearV1';
        if (ratio > 0.67) return 'nearV2';
        return 'center';
    }

    /**
     * УРОВЕНЬ 3.5: Группировка по внешним точкам
     */
    groupByExternalFeatures(triangles) {
        const groups = {};

        for (const t of triangles) {
            const edgeKeys = t.edges.map(e => {
                const positions = e.externalPoints.map(ep => ep.position).sort().join('');
                const morphSummary = e.externalPoints.length > 0 ? 'has' : 'none';
                return `${positions}_${morphSummary}`;
            }).sort();

            const key = edgeKeys.join('||');

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
    groupTrianglesBySignature(triangles) {
        const groups = {};
        for (const t of triangles) {
            if (!groups[t.signature]) groups[t.signature] = [];
            groups[t.signature].push(t);
        }
        return groups;
    }

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
        console.log(`   УРОВЕНЬ 2 (базисные треугольники): ${this.stats.level2.totalPairs} пар`);
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
            console.log(`   ⚠️ Соответствия не найдены — возможно, пороги слишком жесткие`);
        }
    }
}

module.exports = TriangleMatcher;
