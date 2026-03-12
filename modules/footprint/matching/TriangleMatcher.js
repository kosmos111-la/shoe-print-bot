// modules/footprint/matching/TriangleMatcher.js
// 🔺 ТРЕУГОЛЬНЫЙ МАТЧЕР (полная логика: грубая морфология + геометрия)

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;

        // 🔥 ПОРОГИ
        this.roughThreshold = options.roughThreshold || 0.5;      // Порог для грубой морфологии
        this.geometryThreshold = options.geometryThreshold || 0.8; // Порог для геометрии

        // Грубые признаки (только морфология, без геометрии)
        this.roughFeatures = {
            eccentricity: { enabled: true, weight: 1, levels: 2 },  // 0-1
            asymmetry: { enabled: true, weight: 1, levels: 2 }      // 0-1
        };

        this.stats = {
            uniqueA: 0,
            uniqueB: 0,
            oneToOne: 0,
            oneToMany: 0,
            manyToOne: 0,
            manyToMany: 0,
            anchors: 0,
            postponed: 0
        };

        console.log(`🔺 TriangleMatcher (полная логика) создан`);
        console.log(`   • Грубый порог: ${this.roughThreshold * 100}%`);
        console.log(`   • Геометрия порог: ${this.geometryThreshold * 100}%`);
    }

    /**
     * Основной метод поиска соответствий
     */
    findMatches(pointsA, pointsB, delaunayA, delaunayB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🔺 ТРЕУГОЛЬНЫЙ ПОИСК (полная логика)`);
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

        // ШАГ 4: Построение матрицы связей (грубая морфология)
        console.log(`\n🔍 ШАГ 4: Построение матрицы связей`);

        const { matrix, aToB, bToA } = this.buildConnectionMatrix(uniqueA, uniqueB);

        // ШАГ 5: Анализ однозначности
        console.log(`\n🔍 ШАГ 5: Анализ однозначности`);

        const categories = this.analyzeUniqueness(matrix, aToB, bToA, uniqueA, uniqueB);

        console.log(`\n📊 РАСПРЕДЕЛЕНИЕ СВЯЗЕЙ:`);
        console.log(`   • 1:1 (взаимно однозначных): ${categories.oneToOne.length}`);
        console.log(`   • 1:N (у А несколько кандидатов): ${categories.oneToMany.length}`);
        console.log(`   • N:1 (у Б несколько кандидатов): ${categories.manyToOne.length}`);
        console.log(`   • M:N (сложные связи): ${categories.manyToMany.length}`);

        this.stats.oneToOne = categories.oneToOne.length;
        this.stats.oneToMany = categories.oneToMany.length;
        this.stats.manyToOne = categories.manyToOne.length;
        this.stats.manyToMany = categories.manyToMany.length;

        // ШАГ 6: Геометрическая верификация ВСЕХ связей
        console.log(`\n🔍 ШАГ 6: Геометрическая верификация`);

        const geometryResults = this.verifyGeometry(matrix, uniqueA, uniqueB);

        // ШАГ 7: Финальное решение (только однозначные после геометрии)
        console.log(`\n🔍 ШАГ 7: Финальное решение`);

        const anchors = this.findAnchors(geometryResults, uniqueA, uniqueB);

        this.stats.anchors = anchors.length;
        this.stats.postponed = categories.oneToOne.length + categories.oneToMany.length +
                              categories.manyToOne.length + categories.manyToMany.length - anchors.length;

        console.log(`\n🎯 РЕЗУЛЬТАТ:`);
        console.log(`   • Найдено якорей: ${anchors.length}`);
        console.log(`   • Отложено (неоднозначно): ${this.stats.postponed}`);

        // Восстановление точек из якорей
        const pointMatches = this.reconstructPoints(anchors);

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

        // Вычисляем радиальные признаки
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
     * Построение матрицы связей по грубой морфологии
     */
    buildConnectionMatrix(uniqueA, uniqueB) {
        const matrix = new Map(); // aIndex -> Map(bIndex -> score)
        const aToB = new Map();   // aIndex -> Set(bIndices)
        const bToA = new Map();   // bIndex -> Set(aIndices)

        // Инициализация
        for (let i = 0; i < uniqueA.length; i++) {
            aToB.set(i, new Set());
            matrix.set(i, new Map());
        }
        for (let j = 0; j < uniqueB.length; j++) {
            bToA.set(j, new Set());
        }

        // Заполняем матрицу
        for (let i = 0; i < uniqueA.length; i++) {
            const tA = uniqueA[i];
           
            for (let j = 0; j < uniqueB.length; j++) {
                const tB = uniqueB[j];
               
                const score = this.compareMorphology(tA, tB);
               
                if (score >= this.roughThreshold) {
                    matrix.get(i).set(j, score);
                    aToB.get(i).add(j);
                    bToA.get(j).add(i);
                }
            }
        }

        return { matrix, aToB, bToA };
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
                externalScore = 0.3; // разное количество внешних точек
            }
        }
       
        // Комбинируем (вершины 70%, внешние 30%)
        return morphScore * 0.7 + externalScore * 0.3;
    }

    /**
     * Анализ однозначности связей
     */
    analyzeUniqueness(matrix, aToB, bToA, uniqueA, uniqueB) {
        const categories = {
            oneToOne: [],      // взаимно однозначные
            oneToMany: [],     // у А несколько кандидатов
            manyToOne: [],     // у Б несколько кандидатов
            manyToMany: []     // сложные связи
        };

        // Проверяем каждую связь
        for (let i = 0; i < uniqueA.length; i++) {
            const bIndices = Array.from(aToB.get(i));
            if (bIndices.length === 0) continue;

            for (const j of bIndices) {
                const aIndices = Array.from(bToA.get(j));
               
                if (bIndices.length === 1 && aIndices.length === 1) {
                    // Взаимно однозначная
                    categories.oneToOne.push({
                        aIndex: i,
                        bIndex: j,
                        triangleA: uniqueA[i],
                        triangleB: uniqueB[j],
                        score: matrix.get(i).get(j)
                    });
                } else if (bIndices.length > 1 && aIndices.length === 1) {
                    // У А несколько кандидатов, но у Б только этот А
                    categories.oneToMany.push({
                        aIndex: i,
                        bIndex: j,
                        triangleA: uniqueA[i],
                        triangleB: uniqueB[j],
                        score: matrix.get(i).get(j),
                        otherCandidates: bIndices.filter(idx => idx !== j).length
                    });
                } else if (bIndices.length === 1 && aIndices.length > 1) {
                    // У Б несколько кандидатов, но у А только этот Б
                    categories.manyToOne.push({
                        aIndex: i,
                        bIndex: j,
                        triangleA: uniqueA[i],
                        triangleB: uniqueB[j],
                        score: matrix.get(i).get(j),
                        otherCandidates: aIndices.filter(idx => idx !== i).length
                    });
                } else {
                    // Сложные связи
                    categories.manyToMany.push({
                        aIndex: i,
                        bIndex: j,
                        triangleA: uniqueA[i],
                        triangleB: uniqueB[j],
                        score: matrix.get(i).get(j),
                        aCandidates: bIndices.length,
                        bCandidates: aIndices.length
                    });
                }
            }
        }

        // Убираем дубликаты (каждая пара попадает дважды)
        categories.oneToOne = this.uniquePairs(categories.oneToOne);
        categories.oneToMany = this.uniquePairs(categories.oneToMany);
        categories.manyToOne = this.uniquePairs(categories.manyToOne);
        categories.manyToMany = this.uniquePairs(categories.manyToMany);

        return categories;
    }

    /**
     * Убирает дубликаты пар
     */
    uniquePairs(pairs) {
        const seen = new Set();
        return pairs.filter(p => {
            const key = `${p.aIndex}-${p.bIndex}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Геометрическая верификация
     */
    verifyGeometry(matrix, uniqueA, uniqueB) {
        const results = new Map(); // aIndex -> Map(bIndex -> geometryScore)

        for (let i = 0; i < uniqueA.length; i++) {
            const bMap = matrix.get(i);
            if (!bMap) continue;
           
            for (const [j, morphScore] of bMap) {
                const tA = uniqueA[i];
                const tB = uniqueB[j];
               
                const geometryScore = this.compareGeometry(tA, tB);
               
                if (!results.has(i)) {
                    results.set(i, new Map());
                }
                results.get(i).set(j, {
                    morphScore,
                    geometryScore,
                    passed: geometryScore >= this.geometryThreshold
                });
            }
        }

        return results;
    }

    /**
     * Сравнение геометрии (нормированные стороны)
     */
    compareGeometry(tA, tB) {
        const sidesA = this.calcSides(tA.p1, tA.p2, tA.p3);
        const sidesB = this.calcSides(tB.p1, tB.p2, tB.p3);
       
        // Нормируем (делим на максимальную сторону)
        const maxA = Math.max(...sidesA);
        const maxB = Math.max(...sidesB);
       
        const normA = sidesA.map(s => s / maxA);
        const normB = sidesB.map(s => s / maxB);
       
        // Сортируем для инвариантности
        normA.sort((a, b) => a - b);
        normB.sort((a, b) => a - b);
       
        // Сравниваем
        let score = 0;
        for (let i = 0; i < 3; i++) {
            const ratio = Math.min(normA[i], normB[i]) / Math.max(normA[i], normB[i]);
            score += ratio;
        }
       
        return score / 3;
    }

    /**
     * Поиск якорей (однозначных после геометрии)
     */
    findAnchors(geometryResults, uniqueA, uniqueB) {
        const anchors = [];

        // Проверяем каждый треугольник из А
        for (let i = 0; i < uniqueA.length; i++) {
            const bResults = geometryResults.get(i);
            if (!bResults) continue;
           
            // Отбираем кандидатов, прошедших геометрию
            const passed = [];
            for (const [j, res] of bResults) {
                if (res.passed) {
                    passed.push({ j, score: res.morphScore, geometryScore: res.geometryScore });
                }
            }
           
            // Если ровно один кандидат - это якорь
            if (passed.length === 1) {
                const j = passed[0].j;
               
                // Проверяем, что и для этого кандидата из Б наш треугольник - единственный
                const aResults = new Map();
                for (let k = 0; k < uniqueA.length; k++) {
                    const res = geometryResults.get(k)?.get(j);
                    if (res?.passed) {
                        aResults.set(k, res);
                    }
                }
               
                if (aResults.size === 1) {
                    anchors.push({
                        triangleA: uniqueA[i],
                        triangleB: uniqueB[j],
                        confidence: (passed[0].score * 0.5 + passed[0].geometryScore * 0.5)
                    });
                   
                    if (this.debug) {
                        console.log(`   ✅ Якорь: A[${i}] ↔ B[${j}] (морфология: ${(passed[0].score*100).toFixed(1)}%, геометрия: ${(passed[0].geometryScore*100).toFixed(1)}%)`);
                    }
                }
            }
        }

        return anchors;
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
     * Восстановление точек из якорей
     */
    reconstructPoints(anchors) {
        const pointMatches = [];
        const usedA = new Set();
        const usedB = new Set();

        for (const anchor of anchors) {
            const tA = anchor.triangleA;
            const tB = anchor.triangleB;

            // Сортируем точки для инвариантности
            const pointsA = [tA.p1, tA.p2, tA.p3].sort((a, b) => a.eccentricity - b.eccentricity);
            const pointsB = [tB.p1, tB.p2, tB.p3].sort((a, b) => a.eccentricity - b.eccentricity);

            for (let i = 0; i < 3; i++) {
                if (!usedA.has(pointsA[i].id) && !usedB.has(pointsB[i].id)) {
                    pointMatches.push({
                        pointA: pointsA[i].id,
                        pointB: pointsB[i].id,
                        confidence: anchor.confidence
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
        console.log(`   • Уникальных в А: ${this.stats.uniqueA}`);
        console.log(`   • Уникальных в Б: ${this.stats.uniqueB}`);

        console.log(`\n🔗 СВЯЗИ (грубая морфология):`);
        console.log(`   • 1:1 (взаимно однозначных): ${this.stats.oneToOne}`);
        console.log(`   • 1:N (у А несколько): ${this.stats.oneToMany}`);
        console.log(`   • N:1 (у Б несколько): ${this.stats.manyToOne}`);
        console.log(`   • M:N (сложные): ${this.stats.manyToMany}`);

        console.log(`\n🎯 РЕЗУЛЬТАТ ПОСЛЕ ГЕОМЕТРИИ:`);
        console.log(`   • Якорей: ${this.stats.anchors}`);
        console.log(`   • Отложено: ${this.stats.postponed}`);
    }
}

module.exports = TriangleMatcher;
