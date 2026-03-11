// modules/footprint/matching/TriangleMatcher.js
// 🔺 ТРЕУГОЛЬНЫЙ МАТЧЕР (двухэтапный поиск: грубый → точный)

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;

        // 🔥 НАСТРОЙКИ ЭТАПОВ
        this.roughThreshold = options.roughThreshold || 0.5;      // Порог для грубого поиска
        this.exactThreshold = options.exactThreshold || 0.9;     // Порог для точной проверки
       
        // Грубые признаки (этап 1)
        this.roughFeatures = {
    eccentricity: { enabled: true, weight: 1, levels: 2 },  // 0-1 (оставляем)
    asymmetry: { enabled: true, weight: 1, levels: 2 }      // 0-1 (было 3, стало 2)
        };
       
        // Точные признаки (этап 2)
        this.exactFeatures = {
            eccentricity: { enabled: true, weight: 1, levels: 3 },  // 0-2
            asymmetry: { enabled: true, weight: 1, levels: 5 },     // 0-4
            radialMin: { enabled: true, weight: 1, levels: 5 }      // 0-4
        };

        this.stats = {
            rough: { candidates: 0 },
            exact: { matches: 0 },
            trianglesA: 0,
            trianglesB: 0,
            uniqueA: 0,
            uniqueB: 0
        };

        console.log(`🔺 TriangleMatcher (двухэтапный) создан`);
        console.log(`   • Грубый порог: ${this.roughThreshold * 100}%`);
        console.log(`   • Точный порог: ${this.exactThreshold * 100}%`);
    }

    /**
     * Основной метод поиска соответствий
     */
    findMatches(pointsA, pointsB, delaunayA, delaunayB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🔺 ТРЕУГОЛЬНЫЙ ПОИСК (двухэтапный)`);
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

        this.stats.trianglesA = trianglesA.length;
        this.stats.trianglesB = trianglesB.length;
       
        console.log(`   • Треугольников в А: ${trianglesA.length}`);
        console.log(`   • Треугольников в Б: ${trianglesB.length}`);

        // ШАГ 3: Поиск уникальных треугольников (по грубым признакам)
        console.log(`\n🔍 ШАГ 3: Поиск уникальных треугольников (грубые признаки)`);

        const uniqueA = this.findUniqueByRoughFeatures(trianglesA);
        const uniqueB = this.findUniqueByRoughFeatures(trianglesB);

        this.stats.uniqueA = uniqueA.length;
        this.stats.uniqueB = uniqueB.length;

        console.log(`\n📊 УНИКАЛЬНЫЕ ТРЕУГОЛЬНИКИ (грубые признаки):`);
        console.log(`   • В следе А: ${uniqueA.length} из ${trianglesA.length}`);
        console.log(`   • В следе Б: ${uniqueB.length} из ${trianglesB.length}`);

        // ШАГ 4: Грубый поиск кандидатов
        console.log(`\n🔍 ШАГ 4: Грубый поиск кандидатов`);
       
        const candidates = this.findRoughCandidates(uniqueA, uniqueB);
        this.stats.rough.candidates = candidates.length;
       
        console.log(`   • Найдено кандидатов: ${candidates.length}`);

        // ШАГ 5: Точная верификация кандидатов
        console.log(`\n🔍 ШАГ 5: Точная верификация кандидатов`);
       
        const matches = this.verifyCandidates(candidates);
        this.stats.exact.matches = matches.length;

        console.log(`\n📊 РЕЗУЛЬТАТ:`);
        console.log(`   • Найдено точных соответствий: ${matches.length}`);
        console.log(`   • Уверенность: ${(matches.length / Math.min(uniqueA.length, uniqueB.length) * 100).toFixed(1)}%`);

        // Восстановление точек
        const pointMatches = this.reconstructPoints(matches);

        console.log(`\n✅ Найдено соответствий точек: ${pointMatches.length}`);
        this.printSummary();

        return {
            matches: pointMatches,
            stats: this.stats
        };
    }

    /**
     * Построение топологических треугольников
     */
    buildTopologicalTriangles(delaunay, points) {
        const triangles = [];
        const triangleList = this.getTrianglesFromDelaunay(delaunay);

        // Вычисляем radialMin для всех точек
        for (const point of points) {
            if (point.radialMin === undefined) {
                point.radialMin = this.calculateRadialMin(point);
            }
        }

        for (const tri of triangleList) {
            if (!Array.isArray(tri) || tri.length < 3) continue;
           
            const [idx1, idx2, idx3] = tri;
           
            const p1 = points[idx1];
            const p2 = points[idx2];
            const p3 = points[idx3];

            if (!p1 || !p2 || !p3) continue;

            // 🔥 ГРУБЫЕ ПРИЗНАКИ (для этапа 1)
           const rough1 = [
    Math.floor(p1.eccentricity * 2) || 0,        // 0-1 (2 уровня)
    Math.floor((p1.asymmetry || 0) * 2) || 0,     // 0-1 (2 уровня)
    Math.floor((p1.normalizedArea * 2) || 0)      // 0-1 (2 уровня) - размер
];

const rough2 = [
    Math.floor(p2.eccentricity * 2) || 0,
    Math.floor((p2.asymmetry || 0) * 2) || 0,
    Math.floor((p2.normalizedArea * 2) || 0)
];

const rough3 = [
    Math.floor(p3.eccentricity * 2) || 0,
    Math.floor((p3.asymmetry || 0) * 2) || 0,
    Math.floor((p3.normalizedArea * 2) || 0)
];

            // 🔥 ТОЧНЫЕ ПРИЗНАКИ (для этапа 2)
            const exact1 = [
                Math.floor(p1.eccentricity * 3) || 0,        // 0-2
                Math.floor((p1.asymmetry || 0) * 5) || 0,     // 0-4
                Math.floor((p1.radialMin || 0) * 5) || 0      // 0-4
            ];
           
            const exact2 = [
                Math.floor(p2.eccentricity * 3) || 0,
                Math.floor((p2.asymmetry || 0) * 5) || 0,
                Math.floor((p2.radialMin || 0) * 5) || 0
            ];
           
            const exact3 = [
                Math.floor(p3.eccentricity * 3) || 0,
                Math.floor((p3.asymmetry || 0) * 5) || 0,
                Math.floor((p3.radialMin || 0) * 5) || 0
            ];

            // Вычисляем ориентацию
            const orient = (p2.x - p1.x)*(p3.y - p1.y) - (p2.y - p1.y)*(p3.x - p1.x);
            const orientation = Math.sign(orient);

            // Сортируем векторы для инвариантности к повороту
            const roughVectors = [rough1, rough2, rough3].sort((a, b) => {
                for (let i = 0; i < 2; i++) {
                    if (a[i] !== b[i]) return a[i] - b[i];
                }
                return 0;
            });

            const exactVectors = [exact1, exact2, exact3].sort((a, b) => {
                for (let i = 0; i < 3; i++) {
                    if (a[i] !== b[i]) return a[i] - b[i];
                }
                return 0;
            });

            const triangle = {
                points: [p1.id, p2.id, p3.id],
                roughVectors: roughVectors.flat(),     // 6 чисел
                exactVectors: exactVectors.flat(),     // 9 чисел
                orientation: orientation,
                degree: 0,
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

        // Добавляем степень и внешние точки
        for (const t of triangles) {
            t.degree = t.edges.filter(e => e.neighborTriangles.length > 0).length;
           
            // Собираем внешние точки
            const externalByEdge = [];
           
            for (const edge of t.edges) {
                for (const neighborTri of edge.neighborTriangles) {
                    for (const v of [neighborTri.p1, neighborTri.p2, neighborTri.p3]) {
                        if (v.id !== edge.v1.id && v.id !== edge.v2.id) {
                            if (v.radialMin === undefined) {
                                v.radialMin = this.calculateRadialMin(v);
                            }
                           
                            // Точные признаки для внешних точек
                            const morph = [
                                Math.floor(v.eccentricity * 3) || 0,
                                Math.floor((v.asymmetry || 0) * 5) || 0,
                                Math.floor((v.radialMin || 0) * 5) || 0
                            ];
                           
                            const edgeKey = [edge.v1.id, edge.v2.id].sort().join('-');
                           
                            externalByEdge.push({
                                edge: edgeKey,
                                morph: morph
                            });
                            break;
                        }
                    }
                }
            }
           
            externalByEdge.sort((a, b) => a.edge.localeCompare(b.edge));
           
            t.externalVectors = externalByEdge.map(e => e.morph);
            t.externalFlat = t.externalVectors.flat();
           
            // Грубая сигнатура (для уникальности внутри следа)
            t.roughSignature = t.roughVectors.join('_') + '_' + t.orientation + '_deg' + t.degree;
           
            // Полная сигнатура (для точной проверки)
            t.fullSignature = t.exactVectors.join('_') + '_' + t.orientation + '_deg' + t.degree +
                             '_ext_' + (t.externalFlat.length > 0 ? t.externalFlat.join('_') : 'none');
        }

        return triangles;
    }

    /**
     * Поиск уникальных треугольников по грубым признакам
     */
    findUniqueByRoughFeatures(triangles) {
        const groups = {};
       
        for (const t of triangles) {
            if (!groups[t.roughSignature]) {
                groups[t.roughSignature] = [];
            }
            groups[t.roughSignature].push(t);
        }

        const unique = [];
        for (const [sig, tris] of Object.entries(groups)) {
            if (tris.length === 1) {
                unique.push(tris[0]);
            } else if (this.debug) {
                console.log(`   ⚠️ Группа ${sig} имеет ${tris.length} вариантов - пропускаем`);
            }
        }

        return unique;
    }

    /**
     * Грубый поиск кандидатов
     */
    findRoughCandidates(uniqueA, uniqueB) {
        const candidates = [];
        const usedB = new Set();

        for (const tA of uniqueA) {
            let bestMatch = null;
            let bestScore = 0;

            for (const tB of uniqueB) {
                if (usedB.has(tB)) continue;

                const score = this.compareRough(tA, tB);
                if (score > bestScore && score > this.roughThreshold) {
                    bestScore = score;
                    bestMatch = tB;
                }
            }

            if (bestMatch) {
                candidates.push({
                    triangleA: tA,
                    triangleB: bestMatch,
                    roughScore: bestScore
                });
                usedB.add(bestMatch);
            }
        }

        return candidates;
    }

    /**
     * Сравнение по грубым признакам
     */
    compareRough(tA, tB) {
        // Сравниваем грубые векторы (6 чисел)
        const v1 = tA.roughVectors;
        const v2 = tB.roughVectors;
       
        if (v1.length !== v2.length) return 0;
       
        let sumDiff = 0;
        for (let i = 0; i < v1.length; i++) {
            sumDiff += Math.abs(v1[i] - v2[i]);
        }
       
        // Максимальная разница: каждое число может отличаться максимум на:
        // eccentricity: 0-1 → макс 1
        // asymmetry: 0-2 → макс 2
        // Итого на 6 чисел: макс 6*2 = 12
        const maxDiff = 12;
       
        return 1 - (sumDiff / maxDiff);
    }

    /**
     * Точная верификация кандидатов
     */
    verifyCandidates(candidates) {
        const matches = [];

        for (const cand of candidates) {
            // Проверка по точным признакам
            const exactScore = this.compareExact(cand.triangleA, cand.triangleB);
           
            if (exactScore < this.exactThreshold) {
                if (this.debug) {
                    console.log(`   ❌ Кандидат отсеян: точное сходство ${(exactScore*100).toFixed(1)}%`);
                }
                continue;
            }

            // Проверка внешних точек
            const externalScore = this.compareExternal(cand.triangleA, cand.triangleB);
           
            if (externalScore < 0.7) {
                if (this.debug) {
                    console.log(`   ❌ Кандидат отсеян: внешние точки ${(externalScore*100).toFixed(1)}%`);
                }
                continue;
            }

            // Проверка геометрии (соотношение сторон)
            const geometryScore = this.compareGeometry(cand.triangleA, cand.triangleB);
           
            if (geometryScore < 0.8) {
                if (this.debug) {
                    console.log(`   ❌ Кандидат отсеян: геометрия ${(geometryScore*100).toFixed(1)}%`);
                }
                continue;
            }

            // Все проверки пройдены
            const totalScore = (exactScore * 0.5 + externalScore * 0.3 + geometryScore * 0.2);
           
            matches.push({
                triangleA: cand.triangleA,
                triangleB: cand.triangleB,
                score: totalScore
            });

            if (this.debug) {
                console.log(`   ✅ Найдено соответствие: ${(totalScore*100).toFixed(1)}%`);
            }
        }

        return matches;
    }

    /**
     * Сравнение по точным признакам
     */
    compareExact(tA, tB) {
        const v1 = tA.exactVectors;
        const v2 = tB.exactVectors;
       
        if (v1.length !== v2.length) return 0;
       
        let sumDiff = 0;
        for (let i = 0; i < v1.length; i++) {
            sumDiff += Math.abs(v1[i] - v2[i]);
        }
       
        // Максимальная разница: 9 чисел × макс 4 = 36
        const maxDiff = 36;
       
        return 1 - (sumDiff / maxDiff);
    }

    /**
     * Сравнение внешних точек
     */
    compareExternal(tA, tB) {
        const e1 = tA.externalFlat;
        const e2 = tB.externalFlat;
       
        if (e1.length === 0 && e2.length === 0) return 1.0;
        if (e1.length === 0 || e2.length === 0) return 0.5;
        if (e1.length !== e2.length) return 0.3;
       
        let sumDiff = 0;
        for (let i = 0; i < e1.length; i++) {
            sumDiff += Math.abs(e1[i] - e2[i]);
        }
       
        const maxDiff = e1.length * 4;
        return 1 - (sumDiff / maxDiff);
    }

    /**
     * Сравнение геометрии (соотношения сторон)
     */
    compareGeometry(tA, tB) {
        // Вычисляем длины сторон
        const sidesA = this.calcSides(tA.p1, tA.p2, tA.p3);
        const sidesB = this.calcSides(tB.p1, tB.p2, tB.p3);
       
        // Сортируем для инвариантности
        sidesA.sort((a, b) => a - b);
        sidesB.sort((a, b) => a - b);
       
        // Сравниваем отношения сторон
        let score = 0;
        for (let i = 0; i < 3; i++) {
            const ratio = Math.min(sidesA[i], sidesB[i]) / Math.max(sidesA[i], sidesB[i]);
            score += ratio;
        }
       
        return score / 3;
    }

    /**
     * Вычисление длин сторон треугольника
     */
    calcSides(p1, p2, p3) {
        const d12 = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const d23 = Math.sqrt(Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2));
        const d31 = Math.sqrt(Math.pow(p1.x - p3.x, 2) + Math.pow(p1.y - p3.y, 2));
        return [d12, d23, d31];
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
     * Вычисление минимального радиуса
     */
    calculateRadialMin(point) {
        if (!point.contour || point.contour.length === 0) return 0;
       
        let minDist = Infinity;
        for (const p of point.contour) {
            const dx = p.x - point.x;
            const dy = p.y - point.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < minDist) minDist = dist;
        }
       
        const maxDist = this.calculateRadialMax(point);
        return maxDist > 0 ? minDist / maxDist : 0;
    }

    /**
     * Вычисление максимального радиуса
     */
    calculateRadialMax(point) {
        if (!point.contour || point.contour.length === 0) return 1;
       
        let maxDist = 0;
        for (const p of point.contour) {
            const dx = p.x - point.x;
            const dy = p.y - point.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > maxDist) maxDist = dist;
        }
        return maxDist;
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

            // Сортируем точки по компактности
            const pointsA = [tA.p1, tA.p2, tA.p3].sort((a, b) => a.eccentricity - b.eccentricity);
            const pointsB = [tB.p1, tB.p2, tB.p3].sort((a, b) => a.eccentricity - b.eccentricity);

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

    /**
     * Печать статистики
     */
    printSummary() {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`📊 ИТОГОВАЯ СТАТИСТИКА`);
        console.log(`${'='.repeat(100)}`);

        console.log(`\n📈 ТРЕУГОЛЬНИКИ:`);
        console.log(`   • В следе А: ${this.stats.trianglesA}`);
        console.log(`   • В следе Б: ${this.stats.trianglesB}`);
        console.log(`   • Уникальных в А: ${this.stats.uniqueA}`);
        console.log(`   • Уникальных в Б: ${this.stats.uniqueB}`);
       
        console.log(`\n🔍 ПОИСК:`);
        console.log(`   • Грубых кандидатов: ${this.stats.rough.candidates}`);
        console.log(`   • Точных соответствий: ${this.stats.exact.matches}`);
        console.log(`   • Уверенность: ${(this.stats.exact.matches / Math.min(this.stats.uniqueA, this.stats.uniqueB) * 100).toFixed(1)}%`);
    }
}

module.exports = TriangleMatcher;
