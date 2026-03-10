// modules/footprint/matching/TriangleMatcher.js
// 🔺 ТРЕУГОЛЬНЫЙ МАТЧЕР (4 признака + ориентация + степень + зона)

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;

        // 🔥 ТЕПЕРЬ 4 ПРИЗНАКА
        this.featureConfig = {
            compactness: { enabled: true, weight: 1 },
            eccentricity: { enabled: true, weight: 1 },
            area: { enabled: true, weight: 1 },
            asymmetry: { enabled: true, weight: 1 }  // НОВЫЙ!
        };

        this.stats = {
            level1: { groups: 0, variants: 0, totalPairs: 0 },
            level2: { triangles: 0, groups: 0, variants: 0, totalPairs: 0 },
            level3: { matches: 0, confidence: 0 }
        };

        this.confusedGroups = [];
        this.uniquePairs = [];

        console.log(`🔺 TriangleMatcher (4 признака + ориентация + степень) создан`);
    }

    findMatches(pointsA, pointsB, delaunayA, delaunayB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🔺 ТРЕУГОЛЬНЫЙ ПОИСК (4 признака + ориентация + степень)`);
        console.log(`${'='.repeat(100)}`);
        console.log(`📊 Точек в А: ${pointsA.length}, в Б: ${pointsB.length}`);

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

        // ШАГ 3: Группировка по сигнатуре ВНУТРИ каждого следа
        console.log(`\n🔍 ШАГ 3: Поиск УНИКАЛЬНЫХ треугольников в каждом следе`);

        const uniqueInA = this.findUniqueTriangles(trianglesA);
        const uniqueInB = this.findUniqueTriangles(trianglesB);

        console.log(`\n📊 УНИКАЛЬНЫЕ ТРЕУГОЛЬНИКИ:`);
        console.log(`   • В следе А: ${uniqueInA.length} из ${trianglesA.length}`);
        console.log(`   • В следе Б: ${uniqueInB.length} из ${trianglesB.length}`);

        // ШАГ 4: Поиск соответствий МЕЖДУ уникальными треугольниками
        console.log(`\n🔍 ШАГ 4: Поиск соответствий между уникальными треугольниками`);

        this.findMatchesBetweenUnique(uniqueInA, uniqueInB);

        console.log(`\n📊 РЕЗУЛЬТАТ:`);
        console.log(`   • Найдено уникальных пар: ${this.uniquePairs.length}`);
        console.log(`   • Уверенность: ${(this.uniquePairs.length / Math.min(uniqueInA.length, uniqueInB.length) * 100).toFixed(1)}%`);

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
     * Находит ТОЛЬКО уникальные треугольники (те, у которых сигнатура встречается ровно 1 раз)
     */
    findUniqueTriangles(triangles) {
        // Сначала группируем по сигнатуре
        const groups = {};
        for (const t of triangles) {
            if (!groups[t.signature]) groups[t.signature] = [];
            groups[t.signature].push(t);
        }

        // Оставляем только те, у которых размер группы = 1
        const unique = [];
        for (const [sig, tris] of Object.entries(groups)) {
            if (tris.length === 1) {
                unique.push(tris[0]);
            } else {
                if (this.debug) {
                    console.log(`   ⚠️ Группа ${sig} имеет ${tris.length} вариантов - пропускаем`);
                }
            }
        }

        return unique;
    }

    /**
     * Находит соответствия МЕЖДУ уникальными треугольниками из двух следов
     */
    findMatchesBetweenUnique(uniqueA, uniqueB) {
        this.uniquePairs = [];
       
        // Создаем map для быстрого поиска
        const signatureMapB = new Map();
        for (const t of uniqueB) {
            signatureMapB.set(t.signature, t);
        }

        // Ищем точные совпадения сигнатур
        for (const tA of uniqueA) {
            const tB = signatureMapB.get(tA.signature);
            if (tB) {
                this.uniquePairs.push({
                    triangleA: tA,
                    triangleB: tB,
                    score: 1.0
                });
            }
        }
    }

    /**
     * Построение топологических треугольников с 4 признаками
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

        // 🔥 4 ПРИЗНАКА НА ТОЧКУ
        const v1 = [
            Math.floor(p1.compactness / 5) || 0,
            Math.floor(p1.eccentricity * 3) || 0,
            Math.floor(Math.log10(p1.normalizedArea + 1) * 4) || 0,
            Math.floor((p1.asymmetry || 0) * 5) || 0
        ];
       
        const v2 = [
            Math.floor(p2.compactness / 5) || 0,
            Math.floor(p2.eccentricity * 3) || 0,
            Math.floor(Math.log10(p2.normalizedArea + 1) * 4) || 0,
            Math.floor((p2.asymmetry || 0) * 5) || 0
        ];
       
        const v3 = [
            Math.floor(p3.compactness / 5) || 0,
            Math.floor(p3.eccentricity * 3) || 0,
            Math.floor(Math.log10(p3.normalizedArea + 1) * 4) || 0,
            Math.floor((p3.asymmetry || 0) * 5) || 0
        ];

        // Вычисляем ориентацию
        const orient = (p2.x - p1.x)*(p3.y - p1.y) - (p2.y - p1.y)*(p3.x - p1.x);
        const orientation = Math.sign(orient); // +1 или -1

        // Сортируем векторы для инвариантности к повороту
        const vectors = [v1, v2, v3].sort((a, b) => {
            for (let i = 0; i < 4; i++) {
                if (a[i] !== b[i]) return a[i] - b[i];
            }
            return 0;
        });

        // Плоский массив из 12 чисел
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

    // 🔥 ДОБАВЛЯЕМ ВНЕШНИЕ ТОЧКИ ЧЕРЕЗ РЁБРА
    for (const t of triangles) {
        // Степень (количество соседних треугольников)
        t.degree = t.edges.filter(e => e.neighborTriangles.length > 0).length;
       
        // 🔥 Собираем внешние точки, привязанные к рёбрам
        const externalByEdge = [];
       
        for (const edge of t.edges) {
            // Для каждого ребра ищем внешнюю точку
            for (const neighborTri of edge.neighborTriangles) {
                // Ищем вершину, не входящую в текущее ребро
                for (const v of [neighborTri.p1, neighborTri.p2, neighborTri.p3]) {
                    if (v.id !== edge.v1.id && v.id !== edge.v2.id) {
                        // 🔥 Эта точка жёстко привязана к данному ребру!
                        const morph = [
                            Math.floor(v.compactness / 5) || 0,
                            Math.floor(v.eccentricity * 3) || 0,
                            Math.floor(Math.log10(v.normalizedArea + 1) * 4) || 0,
                            Math.floor((v.asymmetry || 0) * 5) || 0
                        ];
                       
                        // Сортируем ID вершин ребра для уникального ключа
                        const edgeKey = [edge.v1.id, edge.v2.id].sort().join('-');
                       
                        externalByEdge.push({
                            edge: edgeKey,
                            morph: morph
                        });
                        break; // Нашли точку для этого ребра
                    }
                }
            }
        }
       
        // 🔥 Сортируем внешние точки по ключам рёбер (инвариантно к повороту!)
        externalByEdge.sort((a, b) => a.edge.localeCompare(b.edge));
       
        // Извлекаем только морфологию в правильном порядке
        const externalVectors = externalByEdge.map(e => e.morph);
        const externalFlat = externalVectors.flat();
       
        t.externalSignature = externalFlat.length > 0 ? externalFlat.join('_') : 'none';
        t.externalCount = externalVectors.length;
       
        // 🔥 ПОЛНАЯ СИГНАТУРА:
        // 12 чисел (3 точки × 4 признака) + ориентация + степень + внешние точки
        t.signature = t.vectors.join('_') + '_' + t.orientation + '_deg' + t.degree + '_ext_' + t.externalSignature;
       
        if (this.debug && t.degree > 0) {
            console.log(`   🔍 Треугольник ${t.points.map(p => p.substring(0,6)).join(',')}:`);
            console.log(`      Степень: ${t.degree}, внешних точек: ${t.externalCount}`);
            console.log(`      Сигнатура: ${t.signature.substring(0, 70)}...`);
        }
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
     * Восстановление точек с сортировкой для сохранения соответствия
     */
    reconstructPoints(matches) {
        const pointMatches = [];
        const usedA = new Set();
        const usedB = new Set();

        for (const match of matches) {
            const tA = match.triangleA;
            const tB = match.triangleB;

            // Сортируем точки по компактности для сохранения порядка
            const pointsA = [tA.p1, tA.p2, tA.p3].sort((a, b) => a.compactness - b.compactness);
            const pointsB = [tB.p1, tB.p2, tB.p3].sort((a, b) => a.compactness - b.compactness);

            for (let i = 0; i < 3; i++) {
                if (!usedA.has(pointsA[i].id) && !usedB.has(pointsB[i].id)) {
                    pointMatches.push({
                        pointA: pointsA[i].id,
                        pointB: pointsB[i].id,
                        confidence: match.score
                    });
                    usedA.add(pointsA[i].id);
                    usedB.add(pointsB[i].id);
                }
            }
        }

        return pointMatches;
    }

    printSummary() {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`📊 ИТОГОВАЯ СТАТИСТИКА`);
        console.log(`${'='.repeat(100)}`);

        console.log(`\n📈 ТРЕУГОЛЬНИКИ:`);
        console.log(`   • В следе А: ${this.stats.level2.triangles}`);
        console.log(`   • Найдено уникальных пар: ${this.uniquePairs.length}`);
    }
}

module.exports = TriangleMatcher;
