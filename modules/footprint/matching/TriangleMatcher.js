// modules/footprint/matching/TriangleMatcher.js
// 🔺 ТРЕУГОЛЬНЫЙ МАТЧЕР (двухэтапный поиск: грубый → точный)
// 📊 С РАСШИРЕННОЙ ДИАГНОСТИКОЙ ПАР

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;

        // 🔥 НАСТРОЙКИ ЭТАПОВ
        this.roughThreshold = options.roughThreshold || 0.5;      // Порог для грубого поиска
        this.exactThreshold = options.exactThreshold || 0.85;     // Порог для точной проверки

        // Грубые признаки (этап 1)
        this.roughFeatures = {
            eccentricity: { enabled: true, weight: 1, levels: 2 },  // 0-1
            asymmetry: { enabled: true, weight: 1, levels: 2 }      // 0-1
        };

        // Точные признаки (этап 2)
        this.exactFeatures = {
            role: { enabled: true, weight: 1, levels: 3 },          // роль 1-3
            eccentricity: { enabled: true, weight: 1, levels: 3 },  // 0-2
            asymmetry: { enabled: true, weight: 1, levels: 5 },     // 0-4
            size: { enabled: true, weight: 1, levels: 3 }           // размер 0-2
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

        // 🔥 ДИАГНОСТИКА ПЕРВОЙ ТОЧКИ
        this.diagnoseFirstPoint(pointsA, pointsB);

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

        // 🔥 ДИАГНОСТИКА ПЕРВОГО ТРЕУГОЛЬНИКА
        this.diagnoseFirstTriangle(trianglesA, trianglesB);

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

        // 🔥 ДИАГНОСТИКА ПЕРВОЙ ПАРЫ (С РАСШИРЕННЫМ СРАВНЕНИЕМ)
        this.diagnoseFirstMatch(matches);

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
     * 🔥 ДИАГНОСТИКА ПЕРВОЙ ТОЧКИ
     */
    diagnoseFirstPoint(pointsA, pointsB) {
        if (pointsA.length === 0 || pointsB.length === 0) return;

        const pA = pointsA[0];
        const pB = pointsB[0];

        console.log(`\n🔬 ДИАГНОСТИКА ПЕРВОЙ ТОЧКИ:`);
        console.log(`┌──────────────────────┬─────────────────────┬─────────────────────┐`);
        console.log(`│ Признак              │ Точка А             │ Точка Б             │`);
        console.log(`├──────────────────────┼─────────────────────┼─────────────────────┤`);

        const features = [
            'id', 'role', 'degree', 'triangles',
            'compactness', 'eccentricity', 'asymmetry',
            'normalizedArea', 'radialMin', 'radialMax'
        ];

        for (const feat of features) {
            const valA = pA[feat] !== undefined ? pA[feat] : 'N/A';
            const valB = pB[feat] !== undefined ? pB[feat] : 'N/A';
           
            let strA = typeof valA === 'number' ? valA.toFixed(4) : String(valA);
            let strB = typeof valB === 'number' ? valB.toFixed(4) : String(valB);
           
            console.log(`│ ${feat.padEnd(20)} │ ${strA.padEnd(19)} │ ${strB.padEnd(19)} │`);
        }

        console.log(`└──────────────────────┴─────────────────────┴─────────────────────┘`);
       
        // Проверка наличия роли
        console.log(`\n🔍 ПРОВЕРКА РОЛИ:`);
        console.log(`   • pointA.role: ${pA.role || 'НЕТ'}`);
        console.log(`   • pointB.role: ${pB.role || 'НЕТ'}`);
       
        // Код роли
        const roleCodeA = this.getRoleCode(pA);
        const roleCodeB = this.getRoleCode(pB);
        console.log(`   • roleCode A: ${roleCodeA}`);
        console.log(`   • roleCode B: ${roleCodeB}`);
    }

    /**
     * 🔥 ДИАГНОСТИКА ПЕРВОГО ТРЕУГОЛЬНИКА
     */
    diagnoseFirstTriangle(trianglesA, trianglesB) {
        if (trianglesA.length === 0 || trianglesB.length === 0) return;

        const tA = trianglesA[0];
        const tB = trianglesB[0];

        console.log(`\n🔬 ДИАГНОСТИКА ПЕРВОГО ТРЕУГОЛЬНИКА:`);
        console.log(`\n   ТРЕУГОЛЬНИК А:`);
        console.log(`      Точки: ${tA.points.map(p => p.substring(0,8)).join(', ')}`);
        console.log(`      Степень: ${tA.degree}`);
        console.log(`      Ориентация: ${tA.orientation}`);
        console.log(`      Грубые признаки: [${tA.roughVectors.join(', ')}]`);
        console.log(`      Точные признаки: [${tA.exactVectors.join(', ')}]`);
        console.log(`      Внешние точки: ${tA.externalVectors.length}`);
       
        console.log(`\n   ТРЕУГОЛЬНИК Б:`);
        console.log(`      Точки: ${tB.points.map(p => p.substring(0,8)).join(', ')}`);
        console.log(`      Степень: ${tB.degree}`);
        console.log(`      Ориентация: ${tB.orientation}`);
        console.log(`      Грубые признаки: [${tB.roughVectors.join(', ')}]`);
        console.log(`      Точные признаки: [${tB.exactVectors.join(', ')}]`);
        console.log(`      Внешние точки: ${tB.externalVectors.length}`);
    }

    /**
     * 🔥 ДИАГНОСТИКА ПЕРВОЙ ПАРЫ (РАСШИРЕННАЯ)
     */
    diagnoseFirstMatch(matches) {
        if (matches.length === 0) return;

        const match = matches[0];
        const tA = match.triangleA;
        const tB = match.triangleB;

        console.log(`\n🔗 ПЕРВАЯ НАЙДЕННАЯ ПАРА:`);
        console.log(`   Уверенность: ${(match.score * 100).toFixed(1)}%`);
       
        console.log(`\n   ТРЕУГОЛЬНИК А:`);
        console.log(`      Точки: ${tA.points.map(p => p.substring(0,8)).join(', ')}`);
        console.log(`      Точные признаки: [${tA.exactVectors.join(', ')}]`);
        console.log(`      Степень: ${tA.degree}, Ориентация: ${tA.orientation}`);
        console.log(`      Координаты:`);
        console.log(`         ${tA.p1.id.substring(0,8)}: (${tA.p1.x.toFixed(1)}, ${tA.p1.y.toFixed(1)})`);
        console.log(`         ${tA.p2.id.substring(0,8)}: (${tA.p2.x.toFixed(1)}, ${tA.p2.y.toFixed(1)})`);
        console.log(`         ${tA.p3.id.substring(0,8)}: (${tA.p3.x.toFixed(1)}, ${tA.p3.y.toFixed(1)})`);
       
        console.log(`\n   ТРЕУГОЛЬНИК Б:`);
        console.log(`      Точки: ${tB.points.map(p => p.substring(0,8)).join(', ')}`);
        console.log(`      Точные признаки: [${tB.exactVectors.join(', ')}]`);
        console.log(`      Степень: ${tB.degree}, Ориентация: ${tB.orientation}`);
        console.log(`      Координаты:`);
        console.log(`         ${tB.p1.id.substring(0,8)}: (${tB.p1.x.toFixed(1)}, ${tB.p1.y.toFixed(1)})`);
        console.log(`         ${tB.p2.id.substring(0,8)}: (${tB.p2.x.toFixed(1)}, ${tB.p2.y.toFixed(1)})`);
        console.log(`         ${tB.p3.id.substring(0,8)}: (${tB.p3.x.toFixed(1)}, ${tB.p3.y.toFixed(1)})`);
       
        if (tA.externalVectors.length > 0 && tB.externalVectors.length > 0) {
            console.log(`\n   СРАВНЕНИЕ ВНЕШНИХ ТОЧЕК:`);
           
            // Сравниваем внешние точки по рёбрам
            const edgesA = tA.edges.filter(e => e.neighborTriangles.length > 0);
            const edgesB = tB.edges.filter(e => e.neighborTriangles.length > 0);
           
            for (let i = 0; i < Math.min(edgesA.length, edgesB.length); i++) {
                const edgeA = edgesA[i];
                const edgeB = edgesB[i];
               
                // Находим внешнюю точку для ребра A
                let externalA = null;
                for (const neighborTri of edgeA.neighborTriangles) {
                    for (const v of [neighborTri.p1, neighborTri.p2, neighborTri.p3]) {
                        if (v.id !== edgeA.v1.id && v.id !== edgeA.v2.id) {
                            externalA = v;
                            break;
                        }
                    }
                }
               
                // Находим внешнюю точку для ребра B
                let externalB = null;
                for (const neighborTri of edgeB.neighborTriangles) {
                    for (const v of [neighborTri.p1, neighborTri.p2, neighborTri.p3]) {
                        if (v.id !== edgeB.v1.id && v.id !== edgeB.v2.id) {
                            externalB = v;
                            break;
                        }
                    }
                }
               
                if (externalA && externalB) {
                    console.log(`\n      Ребро ${i+1}:`);
                    console.log(`         А: точка ${externalA.id.substring(0,8)} (${externalA.x.toFixed(1)}, ${externalA.y.toFixed(1)})`);
                    console.log(`         Б: точка ${externalB.id.substring(0,8)} (${externalB.x.toFixed(1)}, ${externalB.y.toFixed(1)})`);
                   
                    // Морфология внешних точек
                    const morphA = [
                        Math.floor(externalA.eccentricity * 3) || 0,
                        Math.floor((externalA.asymmetry || 0) * 5) || 0,
                        Math.floor((externalA.radialMin || 0) * 5) || 0
                    ];
                   
                    const morphB = [
                        Math.floor(externalB.eccentricity * 3) || 0,
                        Math.floor((externalB.asymmetry || 0) * 5) || 0,
                        Math.floor((externalB.radialMin || 0) * 5) || 0
                    ];
                   
                    const diff = morphA.map((val, idx) => Math.abs(val - morphB[idx]));
                    console.log(`         Морфология А: [${morphA.join(', ')}]`);
                    console.log(`         Морфология Б: [${morphB.join(', ')}]`);
                    console.log(`         Разница: [${diff.join(', ')}]`);
                }
            }
           
            // Общие векторы внешних точек
            console.log(`\n      Векторы внешних точек А: [${tA.externalFlat.join(', ')}]`);
            console.log(`      Векторы внешних точек Б: [${tB.externalFlat.join(', ')}]`);
           
            // Поэлементное сравнение
            const minLen = Math.min(tA.externalFlat.length, tB.externalFlat.length);
            const diffs = [];
            for (let i = 0; i < minLen; i++) {
                diffs.push(Math.abs(tA.externalFlat[i] - tB.externalFlat[i]));
            }
            console.log(`      Поэлементная разница: [${diffs.join(', ')}]`);
            console.log(`      Средняя разница: ${(diffs.reduce((a,b) => a+b, 0) / diffs.length).toFixed(2)}`);
        }
    }

    /**
     * 🔥 ПОЛУЧЕНИЕ КОДА РОЛИ (3 значения)
     */
    getRoleCode(point) {
        if (!point || !point.role) {
            if (this.debug) console.log(`   ⚠️ point.role отсутствует, используется R по умолчанию`);
            return 2; // R по умолчанию
        }
       
        // H и C → хабы (1)
        // R и B → обычные (2)
        // L → листья (3)
        const codes = {
            'H': 1,  // хаб
            'C': 1,  // клика (тоже много связей)
            'R': 2,  // обычный
            'B': 2,  // мост (обычный по степени)
            'L': 3   // лист
        };
       
        return codes[point.role] || 2;
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
            if (point.radialMax === undefined) {
                point.radialMax = this.calculateRadialMax(point);
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
                Math.floor(p1.eccentricity * 2) || 0,        // 0-1
                Math.floor((p1.asymmetry || 0) * 2) || 0,    // 0-1
                Math.floor((p1.normalizedArea * 2) || 0)     // 0-1 (размер)
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

            // 🔥 ТОЧНЫЕ ПРИЗНАКИ С РОЛЬЮ (4 числа на точку)
            const exact1 = [
                this.getRoleCode(p1),                         // роль 1-3
                Math.floor(p1.eccentricity * 3) || 0,         // эксцентриситет 0-2
                Math.floor((p1.asymmetry || 0) * 5) || 0,     // асимметрия 0-4
                Math.floor((p1.normalizedArea * 3) || 0)      // размер 0-2
            ];

            const exact2 = [
                this.getRoleCode(p2),
                Math.floor(p2.eccentricity * 3) || 0,
                Math.floor((p2.asymmetry || 0) * 5) || 0,
                Math.floor((p2.normalizedArea * 3) || 0)
            ];

            const exact3 = [
                this.getRoleCode(p3),
                Math.floor(p3.eccentricity * 3) || 0,
                Math.floor((p3.asymmetry || 0) * 5) || 0,
                Math.floor((p3.normalizedArea * 3) || 0)
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
                for (let i = 0; i < 4; i++) {  // 🔥 теперь 4 признака
                    if (a[i] !== b[i]) return a[i] - b[i];
                }
                return 0;
            });

            const triangle = {
                points: [p1.id, p2.id, p3.id],
                roughVectors: roughVectors.flat(),     // 9 чисел (3×3)
                exactVectors: exactVectors.flat(),     // 12 чисел (3×4)
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

                            // Точные признаки для внешних точек (без роли)
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
        const v1 = tA.roughVectors;
        const v2 = tB.roughVectors;

        if (v1.length !== v2.length) return 0;

        let sumDiff = 0;
        for (let i = 0; i < v1.length; i++) {
            sumDiff += Math.abs(v1[i] - v2[i]);
        }

        // Макс. разница: 9 чисел × макс 2 = 18
        const maxDiff = 18;
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

            if (externalScore < 0.75) {
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

        // Макс. разница: 12 чисел × макс 4 = 48
        const maxDiff = 48;
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
        const sidesA = this.calcSides(tA.p1, tA.p2, tA.p3);
        const sidesB = this.calcSides(tB.p1, tB.p2, tB.p3);

        sidesA.sort((a, b) => a - b);
        sidesB.sort((a, b) => a - b);

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
