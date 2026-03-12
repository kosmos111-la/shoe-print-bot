// modules/footprint/matching/TriangleMatcher.js
// 🔺 ТРЕУГОЛЬНЫЙ МАТЧЕР (100% порог + исправленные конфликты)

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;

        // 🔥 ПОРОГИ (добавлен 100%)
        this.roughThreshold = options.roughThreshold || 0.5;      // Порог для грубой морфологии (50%)
        this.geometryThresholds = options.geometryThresholds || [1.00, 0.95, 0.90, 0.85, 0.80]; // 100%, 95%, 90%, 85%, 80%

        // Грубые признаки (только морфология, без геометрии)
        this.roughFeatures = {
            eccentricity: { enabled: true, weight: 1, levels: 2 },  // 0-1
            asymmetry: { enabled: true, weight: 1, levels: 2 }      // 0-1
        };

        this.stats = {
            uniqueA: 0,
            uniqueB: 0,
            totalCandidates: 0,
            anchors: 0,
            anchorsPoints: 0,
            ambiguous: 0,
            noMatches: 0,
            byThreshold: {}
        };

        console.log(`🔺 TriangleMatcher (динамические пороги + 100%) создан`);
        console.log(`   • Грубый порог: ${this.roughThreshold * 100}%`);
        console.log(`   • Геометрия пороги: ${this.geometryThresholds.map(t => t*100 + '%').join(', ')}`);
    }

    /**
     * Основной метод поиска соответствий
     */
    findMatches(pointsA, pointsB, delaunayA, delaunayB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🔺 ТРЕУГОЛЬНЫЙ ПОИСК (100% порог)`);
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

        console.log(`   • Треугольников в А: ${trianglesA.length}`);
        console.log(`   • Треугольников в Б: ${trianglesB.length}`);

        // ШАГ 3: Поиск уникальных треугольников (по грубой морфологии)
        console.log(`\n🔍 ШАГ 3: Поиск уникальных треугольников`);

        const uniqueA = this.findUniqueByMorphology(trianglesA);
        const uniqueB = this.findUniqueByMorphology(trianglesB);

        this.stats.uniqueA = uniqueA.length;
        this.stats.uniqueB = uniqueB.length;

        console.log(`\n📊 УНИКАЛЬНЫЕ ТРЕУГОЛЬНИКИ:`);
        console.log(`   • В следе А: ${uniqueA.length} из ${trianglesA.length}`);
        console.log(`   • В следе Б: ${uniqueB.length} из ${trianglesB.length}`);

        // ШАГ 4: Сбор всех кандидатов по грубой морфологии
        console.log(`\n🔍 ШАГ 4: Сбор кандидатов (грубая морфология)`);

        const candidates = this.findAllCandidates(uniqueA, uniqueB);
        this.stats.totalCandidates = candidates.length;

        console.log(`   • Найдено кандидатов: ${candidates.length}`);

        // ШАГ 5: Геометрическая верификация всех кандидатов
        console.log(`\n🔍 ШАГ 5: Геометрическая верификация`);

        const geometryResults = this.verifyGeometry(candidates, uniqueA, uniqueB);

        // ШАГ 6: Динамический поиск якорей по порогам
        console.log(`\n🔍 ШАГ 6: Динамический поиск якорей`);

        const { anchors, ambiguous, noMatches, byThreshold } = this.findAnchorsDynamic(
            geometryResults, uniqueA, uniqueB, this.geometryThresholds
        );

        this.stats.anchors = anchors.length;
        this.stats.anchorsPoints = anchors.length * 3;
        this.stats.ambiguous = ambiguous.length;
        this.stats.noMatches = noMatches.length;
        this.stats.byThreshold = byThreshold;

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
        const pointMatches = this.reconstructPoints(anchors, uniqueA, uniqueB);

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

        for (const tri of triangleList) {
            if (!Array.isArray(tri) || tri.length < 3) continue;

            const [idx1, idx2, idx3] = tri;
            const p1 = points[idx1];
            const p2 = points[idx2];
            const p3 = points[idx3];

            if (!p1 || !p2 || !p3) continue;

            // 🔥 ТОЛЬКО ГРУБАЯ МОРФОЛОГИЯ (2 признака)
            const morph1 = [
                Math.floor(p1.eccentricity * 2) || 0,        // 0-1
                Math.floor((p1.asymmetry || 0) * 2) || 0     // 0-1
            ];

            const morph2 = [
                Math.floor(p2.eccentricity * 2) || 0,
                Math.floor((p2.asymmetry || 0) * 2) || 0
            ];

            const morph3 = [
                Math.floor(p3.eccentricity * 2) || 0,
                Math.floor((p3.asymmetry || 0) * 2) || 0
            ];

            // Ориентация (для уникальности)
            const orient = (p2.x - p1.x)*(p3.y - p1.y) - (p2.y - p1.y)*(p3.x - p1.x);
            const orientation = Math.sign(orient);

            // Сортируем для инвариантности
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
                morphVectors: morphVectors.flat(),  // 6 чисел (3×2)
                orientation: orientation,
                degree: 0,
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

            // Собираем внешние точки (тоже по грубой морфологии)
            const externalVectors = [];

            for (const edge of t.edges) {
                for (const neighborTri of edge.neighborTriangles) {
                    for (const v of [neighborTri.p1, neighborTri.p2, neighborTri.p3]) {
                        if (v.id !== edge.v1.id && v.id !== edge.v2.id) {
                            // Грубая морфология для внешней точки
                            const morph = [
                                Math.floor(v.eccentricity * 2) || 0,
                                Math.floor((v.asymmetry || 0) * 2) || 0
                            ];
                            externalVectors.push(morph);
                            break;
                        }
                    }
                }
            }

            // Сортируем внешние точки для инвариантности
            externalVectors.sort((a, b) => {
                for (let i = 0; i < 2; i++) {
                    if (a[i] !== b[i]) return a[i] - b[i];
                }
                return 0;
            });

            t.externalVectors = externalVectors.flat();
           
            // Полная сигнатура (морфология вершин + степень + ориентация + внешние точки)
            t.signature = t.morphVectors.join('_') + '_' + t.orientation + '_deg' + t.degree +
                         '_ext_' + (t.externalVectors.length > 0 ? t.externalVectors.join('_') : 'none');
        }

        return triangles;
    }

    /**
     * Поиск уникальных треугольников по морфологии
     */
    findUniqueByMorphology(triangles) {
        const groups = {};

        for (const t of triangles) {
            if (!groups[t.signature]) {
                groups[t.signature] = [];
            }
            groups[t.signature].push(t);
        }

        const unique = [];
        for (const [sig, tris] of Object.entries(groups)) {
            if (tris.length === 1) {
                unique.push(tris[0]);
            } else if (this.debug) {
                console.log(`   ⚠️ Группа ${sig.substring(0, 30)}... имеет ${tris.length} вариантов`);
            }
        }

        return unique;
    }

    /**
     * Сбор всех кандидатов по грубой морфологии
     */
    findAllCandidates(uniqueA, uniqueB) {
        const candidates = [];

        for (let i = 0; i < uniqueA.length; i++) {
            const tA = uniqueA[i];
           
            for (let j = 0; j < uniqueB.length; j++) {
                const tB = uniqueB[j];
               
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
        // Сравниваем морфологию вершин (6 чисел)
        const v1 = tA.morphVectors;
        const v2 = tB.morphVectors;
       
        let sumDiff = 0;
        for (let i = 0; i < v1.length; i++) {
            sumDiff += Math.abs(v1[i] - v2[i]);
        }
       
        // Макс разница: 6 чисел × макс 1 = 6
        const morphScore = 1 - (sumDiff / 6);
       
        // Сравниваем внешние точки
        const e1 = tA.externalVectors;
        const e2 = tB.externalVectors;
       
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
     * Геометрическая верификация всех кандидатов
     */
    verifyGeometry(candidates, uniqueA, uniqueB) {
        const results = new Map();

        for (const c of candidates) {
            const geometryScore = this.compareGeometry(c.triangleA, c.triangleB);
           
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
     * Сравнение геометрии (нормированные стороны)
     */
    compareGeometry(tA, tB) {
        const sidesA = this.calcSides(tA.p1, tA.p2, tA.p3);
        const sidesB = this.calcSides(tB.p1, tB.p2, tB.p3);
       
        const maxA = Math.max(...sidesA);
        const maxB = Math.max(...sidesB);
       
        const normA = sidesA.map(s => s / maxA);
        const normB = sidesB.map(s => s / maxB);
       
        normA.sort((a, b) => a - b);
        normB.sort((a, b) => a - b);
       
        let score = 0;
        for (let i = 0; i < 3; i++) {
            const ratio = Math.min(normA[i], normB[i]) / Math.max(normA[i], normB[i]);
            score += ratio;
        }
       
        return score / 3;
    }

    /**
     * Динамический поиск якорей по порогам
     */
    findAnchorsDynamic(geometryResults, uniqueA, uniqueB, thresholds) {
        const anchors = [];
        const ambiguous = [];
        let remaining = [];
       
        for (let i = 0; i < uniqueA.length; i++) {
            remaining.push(i);
        }
       
        const byThreshold = {};
        for (const th of thresholds) {
            byThreshold[th] = { anchors: 0, ambiguous: 0 };
        }
       
        // Карта соответствий точек (pointA -> pointB)
        const pointMatches = new Map();
       
        for (const threshold of thresholds) {
            if (remaining.length === 0) break;
           
            console.log(`\n🔍 ПРОВЕРКА НА ПОРОГЕ ${threshold*100}%:`);
           
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
                    // Проверяем конфликты точек перед добавлением
                    const tA = uniqueA[aIndex];
                    const tB = uniqueB[passed[0].bIndex];
                   
                    // Сортируем точки для инвариантности
                    const pointsA = [tA.p1, tA.p2, tA.p3].sort((a, b) => a.eccentricity - b.eccentricity);
                    const pointsB = [tB.p1, tB.p2, tB.p3].sort((a, b) => a.eccentricity - b.eccentricity);
                   
                    let conflict = false;
                    const tempMatches = new Map();
                   
                    for (let i = 0; i < 3; i++) {
                        const pA = pointsA[i].id;
                        const pB = pointsB[i].id;
                       
                        if (pointMatches.has(pA)) {
                            if (pointMatches.get(pA) !== pB) {
                                console.log(`      ⚠️ Конфликт: точка ${pA.substring(0,8)} уже сопоставлена с ${pointMatches.get(pA).substring(0,8)}, пытаемся с ${pB.substring(0,8)}`);
                                conflict = true;
                                break;
                            }
                        } else {
                            tempMatches.set(pA, pB);
                        }
                    }
                   
                    if (!conflict) {
                        // Добавляем временные соответствия в основную карту
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
                        console.log(`      ✅ Треугольник ${aIndex}: однозначная пара (геом: ${(passed[0].score*100).toFixed(1)}%)`);
                    } else {
                        // При конфликте отправляем в следующий порог
                        nextRemaining.push(aIndex);
                        console.log(`      ⚠️ Треугольник ${aIndex}: конфликт точек, перенесён на следующий порог`);
                    }
                   
                } else if (passed.length > 1) {
                    newAmbiguous.push({
                        aIndex,
                        candidates: passed.map(p => p.bIndex),
                        threshold,
                        count: passed.length,
                        scores: passed.map(p => p.score)
                    });
                    console.log(`      ⚠️ Треугольник ${aIndex}: варианты (${passed.length})`);
                   
                } else {
                    nextRemaining.push(aIndex);
                }
            }
           
            anchors.push(...newAnchors);
            ambiguous.push(...newAmbiguous);
            remaining = nextRemaining;
           
            byThreshold[threshold].anchors = newAnchors.length;
            byThreshold[threshold].ambiguous = newAmbiguous.length;
           
            console.log(`   → На этом пороге: +${newAnchors.length} якорей (${newAnchors.length*3} точек), +${newAmbiguous.length} вариативных, осталось ${remaining.length}`);
        }
       
        return { anchors, ambiguous, noMatches: remaining, byThreshold };
    }

    /**
     * Вычисление длин сторон
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
     * Восстановление точек из якорей
     */
    reconstructPoints(anchors, uniqueA, uniqueB) {
        const pointMatches = [];
        const pointMap = new Map(); // pointA -> pointB

        for (const anchor of anchors) {
            const tA = uniqueA[anchor.aIndex];
            const tB = uniqueB[anchor.bIndex];

            const pointsA = [tA.p1, tA.p2, tA.p3].sort((a, b) => a.eccentricity - b.eccentricity);
            const pointsB = [tB.p1, tB.p2, tB.p3].sort((a, b) => a.eccentricity - b.eccentricity);

            for (let i = 0; i < 3; i++) {
                const pA = pointsA[i].id;
                const pB = pointsB[i].id;
               
                if (!pointMap.has(pA)) {
                    pointMap.set(pA, pB);
                    pointMatches.push({
                        pointA: pA,
                        pointB: pB,
                        confidence: anchor.geometryScore
                    });
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
        console.log(`   • Уникальных в А: ${this.stats.uniqueA}`);
        console.log(`   • Уникальных в Б: ${this.stats.uniqueB}`);

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
