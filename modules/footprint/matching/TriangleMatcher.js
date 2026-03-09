// modules/footprint/matching/TriangleMatcher.js
// 🔺 ТРЕУГОЛЬНЫЙ МАТЧЕР (3 признака + ориентация)

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;

        // Конфигурация признаков (только реальные)
        this.featureConfig = {
            compactness: { enabled: true, weight: 1 },
            eccentricity: { enabled: true, weight: 1 },
            area: { enabled: true, weight: 1 }
        };

        this.stats = {
            level1: { groups: 0, variants: 0, totalPairs: 0 },
            level2: { triangles: 0, groups: 0, variants: 0, totalPairs: 0 },
            level3: { matches: 0, confidence: 0 }
        };

        this.confusedGroups = [];
        this.uniquePairs = [];

        console.log(`🔺 TriangleMatcher (3 признака + ориентация) создан`);
    }

    findMatches(pointsA, pointsB, delaunayA, delaunayB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🔺 ТРЕУГОЛЬНЫЙ ПОИСК (3 признака + ориентация)`);
        console.log(`${'='.repeat(100)}`);
        console.log(`📊 Точек в А: ${pointsA.length}, в Б: ${pointsB.length}`);

        this.diagnoseFirstPoint(pointsA, pointsB);

        // ШАГ 1: Триангуляция Делоне
        console.log(`\n🔍 ШАГ 1: Триангуляция Делоне`);
        console.log(`   • Треугольников в А: ${delaunayA.triangleList?.length || 0}`);
        console.log(`   • Треугольников в Б: ${delaunayB.triangleList?.length || 0}`);

        // ШАГ 2: Создание топологических треугольников
        console.log(`\n🔍 ШАГ 2: Создание топологических треугольников`);

        const trianglesA = this.buildTopologicalTriangles(delaunayA, pointsA);
        const trianglesB = this.buildTopologicalTriangles(delaunayB, pointsB);

        this.stats.level2.triangles = trianglesA.length;
        console.log(`   • Треугольников в А: ${trianglesA.length}`);
        console.log(`   • Треугольников в Б: ${trianglesB.length}`);

        // Диагностика первого треугольника (если есть)
        if (trianglesA.length > 0) {
            this.diagnoseFirstTriangle(trianglesA[0], 'А');
        }
        if (trianglesB.length > 0) {
            this.diagnoseFirstTriangle(trianglesB[0], 'Б');
        }

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

console.log(`\n📊 ПОЛНЫЙ СПИСОК УНИКАЛЬНЫХ СИГНАТУР В СЛЕДЕ А:`);
const sortedSignaturesA = Object.entries(groupsA)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 200); // первые 20 для наглядности

sortedSignaturesA.forEach(([sig, tris], idx) => {
    console.log(`\n   ${idx+1}. Сигнатура: ${sig}`);
    console.log(`      Треугольников: ${tris.length}`);
    if (tris.length === 1) {
        const t = tris[0];
        console.log(`      Точки: ${t.points.map(p => p.slice(0,8)).join(' ')}`);
        console.log(`      Вектор: [${t.vectors.join(', ')}]`);
        console.log(`      Ориентация: ${t.orientation}`);
        console.log(`      Степень: ${t.degree}`);
    } else {
        // Показываем первые 3 треугольника в группе
        tris.slice(0, 3).forEach((t, i) => {
            console.log(`      Вариант ${i+1}: точки ${t.points.map(p => p.slice(0,8)).join(' ')}`);
        });
        if (tris.length > 3) console.log(`      ... и еще ${tris.length-3}`);
    }
});

console.log(`\n📊 ПОЛНЫЙ СПИСОК УНИКАЛЬНЫХ СИГНАТУР В СЛЕДЕ Б:`);
const sortedSignaturesB = Object.entries(groupsB)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 200);

sortedSignaturesB.forEach(([sig, tris], idx) => {
    console.log(`\n   ${idx+1}. Сигнатура: ${sig}`);
    console.log(`      Треугольников: ${tris.length}`);
    if (tris.length === 1) {
        const t = tris[0];
        console.log(`      Точки: ${t.points.map(p => p.slice(0,8)).join(' ')}`);
        console.log(`      Вектор: [${t.vectors.join(', ')}]`);
        console.log(`      Ориентация: ${t.orientation}`);
        console.log(`      Степень: ${t.degree}`);
    }
});
      

        // ШАГ 4: Поиск соответствий (только уникальные)
        console.log(`\n🔍 ШАГ 4: Поиск соответствий`);

        this.findUniqueMatches(groupsA, groupsB);

        this.stats.level3.matches = this.uniquePairs.length;
        this.stats.level3.confidence = this.uniquePairs.length / Math.min(trianglesA.length, trianglesB.length);

        console.log(`   ✅ Уникальных пар: ${this.uniquePairs.length}`);
        console.log(`   ⚠️ Спутнанных групп: ${this.confusedGroups.length}`);
       
        let confusedTriangles = this.confusedGroups.reduce((sum, g) => sum + g.trisA.length, 0);
        console.log(`      • Треугольников в спутанных группах А: ${confusedTriangles}`);

        console.log(`   • Найдено пар треугольников: ${this.uniquePairs.length}`);
        console.log(`   • Уверенность: ${(this.stats.level3.confidence*100).toFixed(1)}%`);

        // Диагностика первой уникальной пары
        if (this.uniquePairs.length > 0) {
            this.diagnoseFirstUniquePair(this.uniquePairs[0]);
        }

        // Восстановление точек
        const pointMatches = this.reconstructPoints(this.uniquePairs);

        console.log(`\n✅ Найдено соответствий точек: ${pointMatches.length}`);
        this.printSummary();

        return {
            matches: pointMatches,
            stats: this.stats
        };
    }

    /**
     * 🔍 ДИАГНОСТИКА ПЕРВОГО ТРЕУГОЛЬНИКА
     */
    diagnoseFirstTriangle(triangle, label) {
        console.log(`\n   📐 ПЕРВЫЙ ТРЕУГОЛЬНИК В СЛЕДЕ ${label}:`);
        console.log(`      Точки: ${triangle.points.map(p => p.slice(0,8)).join(' ')}`);
        console.log(`      Сигнатура: ${triangle.signature}`);
        console.log(`      Количество соседей: ${triangle.degree}`);
        console.log(`      Ориентация: ${triangle.orientation}`);
        console.log(`      Вектор признаков (9 чисел): [${triangle.vectors.join(', ')}]`);
    }

    /**
     * 🔍 ДИАГНОСТИКА ПЕРВОЙ УНИКАЛЬНОЙ ПАРЫ
     */
    diagnoseFirstUniquePair(pair) {
        console.log(`\n   🔗 ПЕРВАЯ УНИКАЛЬНАЯ ПАРА:`);
        console.log(`      Треугольник А: точки ${pair.triangleA.points.map(p => p.slice(0,8)).join(' ')}`);
        console.log(`      Треугольник Б: точки ${pair.triangleB.points.map(p => p.slice(0,8)).join(' ')}`);
        console.log(`      Сигнатура: ${pair.triangleA.signature}`);
        console.log(`      Ориентации: А=${pair.triangleA.orientation}, Б=${pair.triangleB.orientation}`);
        console.log(`      Степени: А=${pair.triangleA.degree}, Б=${pair.triangleB.degree}`);
        console.log(`      Вектор А: [${pair.triangleA.vectors.join(', ')}]`);
        console.log(`      Вектор Б: [${pair.triangleB.vectors.join(', ')}]`);
    }

    /**
     * Поиск только уникальных пар
     */
    findUniqueMatches(groupsA, groupsB) {
        this.uniquePairs = [];
        this.confusedGroups = [];

        for (const [key, trisA] of Object.entries(groupsA)) {
            const trisB = groupsB[key];
            if (!trisB) continue;

            if (trisA.length === 1 && trisB.length === 1) {
                this.uniquePairs.push({
                    triangleA: trisA[0],
                    triangleB: trisB[0],
                    score: 1.0
                });
            } else {
                this.confusedGroups.push({ key, trisA, trisB });
            }
        }
    }

    /**
     * Построение топологических треугольников
     */
    buildTopologicalTriangles(delaunay, points) {
        const triangles = [];
        const pointMap = new Map(points.map(p => [p.id, p]));

        const triangleList = this.getTrianglesFromDelaunay(delaunay);
       
        console.log(`   🏗️ Построение треугольников из ${triangleList.length} записей`);

        for (const tri of triangleList) {
            if (!Array.isArray(tri) || tri.length < 3) continue;
           
            const [idx1, idx2, idx3] = tri;
           
            const p1 = points[idx1];
            const p2 = points[idx2];
            const p3 = points[idx3];

            if (!p1 || !p2 || !p3) continue;

            // 🔥 ТОЛЬКО 3 РЕАЛЬНЫХ ПРИЗНАКА
            const v1 = [
                Math.floor(p1.compactness / 5),
                Math.floor(p1.eccentricity * 3),
                Math.floor(Math.log10(p1.normalizedArea + 1) * 4)
            ];
           
            const v2 = [
                Math.floor(p2.compactness / 5),
                Math.floor(p2.eccentricity * 3),
                Math.floor(Math.log10(p2.normalizedArea + 1) * 4)
            ];
           
            const v3 = [
                Math.floor(p3.compactness / 5),
                Math.floor(p3.eccentricity * 3),
                Math.floor(Math.log10(p3.normalizedArea + 1) * 4)
            ];

            // 🔥 ВЫЧИСЛЯЕМ ОРИЕНТАЦИЮ
            const orient = (p2.x - p1.x)*(p3.y - p1.y) - (p2.y - p1.y)*(p3.x - p1.x);
            const orientation = Math.sign(orient); // +1 или -1

            // Сортируем векторы для инвариантности к повороту
            const vectors = [v1, v2, v3].sort((a, b) => {
                for (let i = 0; i < 3; i++) {
                    if (a[i] !== b[i]) return a[i] - b[i];
                }
                return 0;
            });

            // Плоский массив из 9 чисел
            const flatVectors = vectors.flat();

            const triangle = {
                points: [p1.id, p2.id, p3.id],
                vectors: flatVectors,
                orientation: orientation,
                degree: 0, // будет заполнено позже
                p1, p2, p3,
                edges: [
                    { v1: p1, v2: p2, neighborTriangles: [] },
                    { v1: p2, v2: p3, neighborTriangles: [] },
                    { v1: p3, v2: p1, neighborTriangles: [] }
                ]
            };

            triangles.push(triangle);
        }

        // Строим связи между треугольниками
        this.buildNeighbors(triangles);

        // Добавляем степень и ориентацию в сигнатуру
        for (const t of triangles) {
            t.degree = t.edges.filter(e => e.neighborTriangles.length > 0).length;
            t.signature = t.vectors.join('_') + '_' + t.orientation + '_deg' + t.degree;
        }

        console.log(`   ✅ Построено ${triangles.length} топологических треугольников`);
        return triangles;
    }

    /**
     * Построение связей между треугольниками
     */
    buildNeighbors(triangles) {
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
     * Получение треугольников из Делоне
     */
    getTrianglesFromDelaunay(delaunay) {
        if (!delaunay) return [];
        if (delaunay.triangleList) return delaunay.triangleList;
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
     * Диагностика первой точки
     */
    diagnoseFirstPoint(pointsA, pointsB) {
        if (pointsA.length === 0 || pointsB.length === 0) return;

        const pointA = pointsA[0];
        const pointB = pointsB[0];

        console.log(`\n🔬 ДИАГНОСТИКА ПЕРВОЙ ТОЧКИ:`);

        const formatValue = (val) => {
            if (val === null || val === undefined) return 'N/A'.padEnd(19);
            if (typeof val === 'number') return val.toFixed(4).padEnd(19);
            if (Array.isArray(val)) return `[${val.length}]`.padEnd(19);
            return String(val).substring(0, 19).padEnd(19);
        };

        console.log(`┌──────────────────────┬─────────────────────┬─────────────────────┐`);
        console.log(`│ Признак              │ Точка А             │ Точка Б             │`);
        console.log(`├──────────────────────┼─────────────────────┼─────────────────────┤`);

        const features = ['compactness', 'eccentricity', 'asymmetry', 'convexity',
                         'quadrants', 'centerMass', 'centerInscribed', 'centerCircumscribed', 'radialProfile'];

        for (const feat of features) {
            const valA = pointA[feat];
            const valB = pointB[feat];
            console.log(`│ ${feat.padEnd(20)} │ ${formatValue(valA)} │ ${formatValue(valB)} │`);
        }

        console.log(`└──────────────────────┴─────────────────────┴─────────────────────┘`);
        console.log(`\n🔍 ПРОВЕРКА ФОРМАТА ДАННЫХ:`);
        console.log(`   • pointA имеет contour? ${pointA.contour ? '✅' : '❌'}`);
        console.log(`   • pointA.radialProfile: ${pointA.radialProfile ? '✅' : '❌'}`);
    }

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
}

module.exports = TriangleMatcher;
