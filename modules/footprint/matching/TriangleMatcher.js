// modules/footprint/matching/TriangleMatcher.js
// 🔺 ТРЕУГОЛЬНЫЙ МАТЧЕР (6 признаков: 3 стороны + 3 внешние точки)

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;

        // 🔥 ПОРОГИ
        this.roughThreshold = options.roughThreshold || 0.5;      // Порог для грубой морфологии (50%)
        this.geometryThresholds = options.geometryThresholds || [1.00, 0.95, 0.90, 0.85, 0.80]; // 100%, 95%, 90%, 85%, 80%

        // Грубые признаки (только морфология, без геометрии)
        this.roughFeatures = {
            eccentricity: { enabled: true, weight: 1, levels: 2 },  // 0-1
            asymmetry: { enabled: true, weight: 1, levels: 2 }      // 0-1
        };

        this.stats = {
            totalTrianglesA: 0,
            totalTrianglesB: 0,
            totalCandidates: 0,
            anchors: 0,
            anchorsPoints: 0,
            ambiguous: 0,
            noMatches: 0,
            byThreshold: {}
        };

        console.log(`🔺 TriangleMatcher (6 признаков треугольника) создан`);
        console.log(`   • Грубый порог: ${this.roughThreshold * 100}%`);
        console.log(`   • Геометрия пороги: ${this.geometryThresholds.map(t => t*100 + '%').join(', ')}`);
    }

    /**
     * Основной метод поиска соответствий
     */
    findMatches(pointsA, pointsB, delaunayA, delaunayB) {
        // Только самое важное - количество точек
        console.log(`📊 Точек в А: ${pointsA.length}, в Б: ${pointsB.length}`);

        // ШАГ 1-4 выполняем, но логи под if(this.debug)
        if (this.debug) {
            console.log(`\n${'='.repeat(100)}`);
            console.log(`🔺 ТРЕУГОЛЬНЫЙ ПОИСК (6 признаков треугольника)`);
            console.log(`${'='.repeat(100)}`);
            console.log(`\n🔍 ШАГ 1: Триангуляция Делоне`);
            console.log(`   • Треугольников в А: ${delaunayA.triangleList?.length || 0}`);
            console.log(`   • Треугольников в Б: ${delaunayB.triangleList?.length || 0}`);
            console.log(`\n🔍 ШАГ 2: Создание топологических треугольников`);
        }

        const trianglesA = this.buildTopologicalTriangles(delaunayA, pointsA);
        const trianglesB = this.buildTopologicalTriangles(delaunayB, pointsB);

        this.stats.totalTrianglesA = trianglesA.length;
        this.stats.totalTrianglesB = trianglesB.length;

        if (this.debug) {
            console.log(`   • Треугольников в А: ${trianglesA.length}`);
            console.log(`   • Треугольников в Б: ${trianglesB.length}`);
            console.log(`\n🔍 ШАГ 3: Сбор кандидатов (грубая морфология)`);
        }

        const candidates = this.findAllCandidates(trianglesA, trianglesB);
        this.stats.totalCandidates = candidates.length;

        if (this.debug) {
            console.log(`   • Найдено кандидатов: ${candidates.length}`);
            console.log(`   • Из возможных ${trianglesA.length * trianglesB.length} комбинаций`);
            console.log(`\n🔍 ШАГ 4: Геометрическая верификация (6 признаков)`);
        }

        const geometryResults = this.verifyGeometry(candidates, trianglesA, trianglesB);

        // ШАГ 5: Динамический поиск якорей - логи под if(this.debug)
        if (this.debug) console.log(`\n🔍 ШАГ 5: Динамический поиск якорей`);

        const { anchors, ambiguous, noMatches, byThreshold } = this.findAnchorsDynamic(
            geometryResults, trianglesA, trianglesB, this.geometryThresholds
        );

        this.stats.anchors = anchors.length;
        this.stats.anchorsPoints = anchors.length * 3;
        this.stats.ambiguous = ambiguous.length;
        this.stats.noMatches = noMatches.length;
        this.stats.byThreshold = byThreshold;

        // ВАЖНЫЕ ИТОГИ - всегда показываем
        console.log(`\n📊 РЕЗУЛЬТАТ ПО ПОРОГАМ:`);
        for (const th of this.geometryThresholds) {
            console.log(`   • ${th*100}%: якорей ${byThreshold[th]?.anchors || 0} (${(byThreshold[th]?.anchors || 0)*3} точек), вариативных ${byThreshold[th]?.ambiguous || 0}`);
        }

        console.log(`\n🎯 ИТОГ:`);
        console.log(`   • Якорей (треугольников): ${anchors.length}`);
        console.log(`   • Точек в якорях: ${anchors.length * 3}`);
        console.log(`   • Вариативных треугольников: ${ambiguous.length}`);
        console.log(`   • Без кандидатов: ${noMatches.length}`);

        // Восстановление точек из якорей
        const pointMatches = this.reconstructPoints(anchors, trianglesA, trianglesB);

        console.log(`\n✅ Найдено соответствий точек: ${pointMatches.length}`);
        this.printSummary();

        return {
            matches: pointMatches,
            stats: this.stats
        };
    }

    /**
     * Построение топологических треугольников с 6 признаками
     */
    buildTopologicalTriangles(delaunay, points) {
        const triangles = [];
        const triangleList = this.getTrianglesFromDelaunay(delaunay);

        for (const tri of triangleList) {
            if (!Array.isArray(tri) || tri.length < 3) continue;

            const [idx1, idx2, idx3] = tri;
            const p1 = points[idx1];
            const p2 = points[idx2];
            const p3 = points[idx3];

            if (!p1 || !p2 || !p3) continue;

            // ГРУБАЯ МОРФОЛОГИЯ (2 признака)
            const morph1 = [
                Math.floor(p1.eccentricity * 2) || 0,
                Math.floor((p1.asymmetry || 0) * 2) || 0
            ];

            const morph2 = [
                Math.floor(p2.eccentricity * 2) || 0,
                Math.floor((p2.asymmetry || 0) * 2) || 0
            ];

            const morph3 = [
                Math.floor(p3.eccentricity * 2) || 0,
                Math.floor((p3.asymmetry || 0) * 2) || 0
            ];

            const orient = (p2.x - p1.x)*(p3.y - p1.y) - (p2.y - p1.y)*(p3.x - p1.x);
            const orientation = Math.sign(orient);

            const morphVectors = [morph1, morph2, morph3].sort((a, b) => {
                for (let i = 0; i < 2; i++) {
                    if (a[i] !== b[i]) return a[i] - b[i];
                }
                return 0;
            });

            const triangle = {
                id: `tri_${p1.id}_${p2.id}_${p3.id}`,
                points: [p1.id, p2.id, p3.id],
                p1, p2, p3,
                morphVectors: morphVectors.flat(),
                orientation: orientation,
                degree: 0,
                edges: [
                    { v1: p1, v2: p2, neighborTriangles: [], externalPoint: null },
                    { v1: p2, v2: p3, neighborTriangles: [], externalPoint: null },
                    { v1: p3, v2: p1, neighborTriangles: [], externalPoint: null }
                ]
            };

            triangles.push(triangle);
        }

        // Строим связи между треугольниками
        this.buildNeighbors(triangles);

        // 🔥 ВЫЧИСЛЯЕМ 6 ПРИЗНАКОВ ТРЕУГОЛЬНИКА
        for (const t of triangles) {
            t.degree = t.edges.filter(e => e.neighborTriangles.length > 0).length;

            // 1. Длины сторон
            const sideAB = this.calcDistance(t.p1, t.p2);
            const sideBC = this.calcDistance(t.p2, t.p3);
            const sideCA = this.calcDistance(t.p3, t.p1);
          
            // 2. Находим внешние точки для каждого ребра
            const externalDists = [0, 0, 0]; // AD, BE, CF
          
            for (let i = 0; i < t.edges.length; i++) {
                const edge = t.edges[i];
              
                // Находим противоположную вершину
                const opposite = [t.p1, t.p2, t.p3].find(p =>
                    p.id !== edge.v1.id && p.id !== edge.v2.id
                );
              
                // Ищем внешнюю точку
                for (const neighborTri of edge.neighborTriangles) {
                    for (const v of [neighborTri.p1, neighborTri.p2, neighborTri.p3]) {
                        if (v.id !== edge.v1.id && v.id !== edge.v2.id) {
                            // Это внешняя точка
                            edge.externalPoint = v;
                          
                            // Расстояние от противоположной вершины до внешней точки
                            const dist = this.calcDistance(opposite, v);
                          
                            externalDists[i] = dist;
                            break;
                        }
                    }
                }
            }
          
            // Собираем все 6 расстояний
            const allDists = [
                sideAB, sideBC, sideCA,
                externalDists[0], externalDists[1], externalDists[2]
            ];
          
            // Нормируем относительно максимального
            const maxDist = Math.max(...allDists.filter(d => d > 0));
            t.normalizedDistances = allDists.map(d => maxDist > 0 ? d / maxDist : 0);
          
            // Для отладки
            if (this.debug && t.degree > 0) {
                console.log(`   Треугольник ${t.points.map(p => p.substring(0,8)).join(',')}:`);
                console.log(`      6 признаков: [${t.normalizedDistances.map(d => d.toFixed(3)).join(', ')}]`);
            }
        }

        return triangles;
    }

    /**
     * Вычисление расстояния между двумя точками
     */
    calcDistance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    /**
     * Сбор всех кандидатов по грубой морфологии
     */
    findAllCandidates(trianglesA, trianglesB) {
        const candidates = [];

        for (let i = 0; i < trianglesA.length; i++) {
            const tA = trianglesA[i];
          
            for (let j = 0; j < trianglesB.length; j++) {
                const tB = trianglesB[j];
              
                const score = this.compareMorphology(tA, tB);
              
                if (score >= this.roughThreshold) {
                    candidates.push({
                        aIndex: i,
                        bIndex: j,
                        triangleA: tA,
                        triangleB: tB,
                        morphScore: score
                    });
                }
            }
        }

        return candidates;
    }

    /**
     * Сравнение по грубой морфологии
     */
    compareMorphology(tA, tB) {
        const v1 = tA.morphVectors;
        const v2 = tB.morphVectors;

        let sumDiff = 0;
        for (let i = 0; i < v1.length; i++) {
            sumDiff += Math.abs(v1[i] - v2[i]);
        }

        const morphScore = 1 - (sumDiff / 6);

        const e1 = tA.externalVectors || [];
        const e2 = tB.externalVectors || [];

        let externalScore = 1.0;
        if (e1.length > 0 || e2.length > 0) {
            if (e1.length === e2.length) {
                let extDiff = 0;
                for (let i = 0; i < e1.length; i++) {
                    extDiff += Math.abs(e1[i] - e2[i]);
                }
                externalScore = 1 - (extDiff / (e1.length * 1));
            } else {
                externalScore = 0.3;
            }
        }

        return morphScore * 0.7 + externalScore * 0.3;
    }

    /**
     * Геометрическая верификация с 6 признаками
     */
    verifyGeometry(candidates, trianglesA, trianglesB) {
        const results = new Map();

        for (const c of candidates) {
            // 🔥 ИСПОЛЬЗУЕМ 6 ПРИЗНАКОВ ДЛЯ СРАВНЕНИЯ
            const geometryScore = this.compareSixFeatures(c.triangleA, c.triangleB);

            if (!results.has(c.aIndex)) {
                results.set(c.aIndex, new Map());
            }

            results.get(c.aIndex).set(c.bIndex, {
                morphScore: c.morphScore,
                geometryScore: geometryScore
            });
        }

        return results;
    }

    /**
     * Сравнение 6 признаков треугольника
     */
    compareSixFeatures(tA, tB) {
        const vecA = tA.normalizedDistances;
        const vecB = tB.normalizedDistances;
      
        let score = 0;
        let count = 0;
      
        for (let i = 0; i < 6; i++) {
            // Если в обоих треугольниках по 0 - пропускаем
            if (vecA[i] === 0 && vecB[i] === 0) continue;
          
            // Если в одном 0, а в другом нет - штрафуем
            if (vecA[i] === 0 || vecB[i] === 0) {
                score += 0.3;
                count++;
                continue;
            }
          
            // Нормальное сравнение
            const ratio = Math.min(vecA[i], vecB[i]) / Math.max(vecA[i], vecB[i]);
            score += ratio;
            count++;
        }
      
        return count > 0 ? score / count : 0;
    }

    /**
     * Динамический поиск якорей по порогам
     */
    findAnchorsDynamic(geometryResults, trianglesA, trianglesB, thresholds) {
        const anchors = [];
        const ambiguous = [];
        let remaining = [];

        for (let i = 0; i < trianglesA.length; i++) {
            remaining.push(i);
        }

        const byThreshold = {};
        for (const th of thresholds) {
            byThreshold[th] = { anchors: 0, ambiguous: 0 };
        }

        const pointMatches = new Map();

        for (const threshold of thresholds) {
            if (remaining.length === 0) break;

            // Только заголовок порога без деталей
            if (this.debug) console.log(`\n🔍 ПРОВЕРКА НА ПОРОГЕ ${threshold*100}%:`);

            const newAnchors = [];
            const newAmbiguous = [];
            const nextRemaining = [];

            for (const aIndex of remaining) {
                const candidates = geometryResults.get(aIndex) || new Map();

                const passed = [];
                for (const [bIndex, res] of candidates) {
                    if (res.geometryScore >= threshold) {
                        passed.push({ bIndex, score: res.geometryScore });
                    }
                }

                if (passed.length === 1) {
                    const tA = trianglesA[aIndex];
                    const tB = trianglesB[passed[0].bIndex];

                    const pointsA = [tA.p1, tA.p2, tA.p3];
                    const pointsB = [tB.p1, tB.p2, tB.p3];

                    let conflict = false;
                    const tempMatches = new Map();

                    for (let i = 0; i < 3; i++) {
                        const pA = pointsA[i].id;
                        const pB = pointsB[i].id;

                        if (pointMatches.has(pA)) {
                            if (pointMatches.get(pA) !== pB) {
                                if (this.debug) console.log(`      ⚠️ Конфликт: точка ${pA.substring(0,8)}`);
                                conflict = true;
                                break;
                            }
                        } else {
                            tempMatches.set(pA, pB);
                        }
                    }

                    if (!conflict) {
                        for (const [pA, pB] of tempMatches) {
                            pointMatches.set(pA, pB);
                        }

                        newAnchors.push({
                            aIndex,
                            bIndex: passed[0].bIndex,
                            threshold,
                            geometryScore: passed[0].score,
                            morphScore: candidates.get(passed[0].bIndex).morphScore
                        });
                        if (this.debug) console.log(`      ✅ Треугольник ${aIndex}: однозначная пара`);
                    } else {
                        nextRemaining.push(aIndex);
                    }

                } else if (passed.length > 1) {
                    newAmbiguous.push({
                        aIndex,
                        candidates: passed.map(p => p.bIndex),
                        threshold,
                        count: passed.length,
                        scores: passed.map(p => p.score)
                    });
                    if (this.debug) console.log(`      ⚠️ Треугольник ${aIndex}: варианты (${passed.length})`);

                } else {
                    nextRemaining.push(aIndex);
                }
            }

            anchors.push(...newAnchors);
            ambiguous.push(...newAmbiguous);
            remaining = nextRemaining;

            byThreshold[threshold].anchors = newAnchors.length;
            byThreshold[threshold].ambiguous = newAmbiguous.length;

            if (this.debug) console.log(`   → На этом пороге: +${newAnchors.length} якорей, +${newAmbiguous.length} вариативных, осталось ${remaining.length}`);
        }

        return { anchors, ambiguous, noMatches: remaining, byThreshold };
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
     * Восстановление точек из якорей
     */
    reconstructPoints(anchors, trianglesA, trianglesB) {
        // Подробности только при отладке
        if (this.debug) console.log(`\n🔍 RECONSTRUCT POINTS С КООРДИНАТАМИ:`);

        const pointMatches = [];
        const pointMap = new Map();
        const usedB = new Set();

        for (const anchor of anchors) {
            const tA = trianglesA[anchor.aIndex];
            const tB = trianglesB[anchor.bIndex];

            if (this.debug) {
                console.log(`\n   Треугольник якорь (уверенность: ${(anchor.geometryScore*100).toFixed(1)}%):`);
                console.log(`      A: ${tA.p1.id.substring(0,12)} (${tA.p1.x.toFixed(1)}, ${tA.p1.y.toFixed(1)})`);
                console.log(`         ${tA.p2.id.substring(0,12)} (${tA.p2.x.toFixed(1)}, ${tA.p2.y.toFixed(1)})`);
                console.log(`         ${tA.p3.id.substring(0,12)} (${tA.p3.x.toFixed(1)}, ${tA.p3.y.toFixed(1)})`);
                console.log(`      B: ${tB.p1.id.substring(0,12)} (${tB.p1.x.toFixed(1)}, ${tB.p1.y.toFixed(1)})`);
                console.log(`         ${tB.p2.id.substring(0,12)} (${tB.p2.x.toFixed(1)}, ${tB.p2.y.toFixed(1)})`);
                console.log(`         ${tB.p3.id.substring(0,12)} (${tB.p3.x.toFixed(1)}, ${tB.p3.y.toFixed(1)})`);
            }

            const pairs = [
                { a: tA.p1.id, b: tB.p1.id, aCoord: [tA.p1.x, tA.p1.y], bCoord: [tB.p1.x, tB.p1.y] },
                { a: tA.p2.id, b: tB.p2.id, aCoord: [tA.p2.x, tA.p2.y], bCoord: [tB.p2.x, tB.p2.y] },
                { a: tA.p3.id, b: tB.p3.id, aCoord: [tA.p3.x, tA.p3.y], bCoord: [tB.p3.x, tB.p3.y] }
            ];

            for (const { a: pA, b: pB, aCoord, bCoord } of pairs) {
                if (pointMap.has(pA)) {
                    if (pointMap.get(pA) !== pB) {
                        if (this.debug) {
                            console.log(`   ⚠️ КОНФЛИКТ: точка ${pA.substring(0,12)}`);
                        }
                        continue;
                    }
                } else if (usedB.has(pB)) {
                    if (this.debug) console.log(`   ⚠️ Точка ${pB.substring(0,12)} уже используется`);
                    continue;
                } else {
                    pointMap.set(pA, pB);
                    usedB.add(pB);
                    pointMatches.push({
                        pointA: pA,
                        pointB: pB,
                        confidence: anchor.geometryScore
                    });
                    if (this.debug) {
                        console.log(`   ✅ Добавлено: ${pA.substring(0,12)} ↔ ${pB.substring(0,12)}`);
                    }
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
        console.log(`   • Всего в А: ${this.stats.totalTrianglesA}`);
        console.log(`   • Всего в Б: ${this.stats.totalTrianglesB}`);

        console.log(`\n🔗 КАНДИДАТЫ:`);
        console.log(`   • Всего кандидатов: ${this.stats.totalCandidates}`);

        console.log(`\n🎯 РЕЗУЛЬТАТ ПОСЛЕ ГЕОМЕТРИИ:`);
        console.log(`   • Якорей (треугольников): ${this.stats.anchors}`);
        console.log(`   • Точек в якорях: ${this.stats.anchorsPoints}`);
        console.log(`   • Вариативных треугольников: ${this.stats.ambiguous}`);
        console.log(`   • Без кандидатов: ${this.stats.noMatches}`);
      
        console.log(`\n📊 ПО ПОРОГАМ:`);
        for (const [th, data] of Object.entries(this.stats.byThreshold)) {
            console.log(`   • ${(parseFloat(th)*100).toFixed(0)}%: якорей ${data.anchors} (${data.anchors*3} точек), вариативных ${data.ambiguous}`);
        }
    }
}

module.exports = TriangleMatcher;
