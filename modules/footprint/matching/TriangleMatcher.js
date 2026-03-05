// modules/footprint/matching/TriangleMatcher.js
// 🔺 ТРЕУГОЛЬНЫЙ МАТЧЕР С ИСПРАВЛЕННОЙ ГРУППИРОВКОЙ

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Пороги для признаков
        this.morphologyThreshold = options.morphologyThreshold || 0.3; // увеличен до 30%
        this.ratioThreshold = options.ratioThreshold || 0.1; // 10%
        this.angleThreshold = options.angleThreshold || 15; // 15 градусов
        this.maxTriangleDistance = options.maxTriangleDistance || 200; // макс расстояние между точками
       
        // Статистика
        this.stats = {
            triangles: 0,
            uniqueTriangles: 0,
            clusters: 0,
            matches: 0
        };
       
        console.log(`🔺 TriangleMatcher создан`);
        console.log(`   • Порог морфологии: ${this.morphologyThreshold*100}%`);
        console.log(`   • Порог отношений: ${this.ratioThreshold*100}%`);
        console.log(`   • Порог углов: ${this.angleThreshold}°`);
        console.log(`   • Макс. расстояние: ${this.maxTriangleDistance}px`);
    }

    /**
     * 🔥 ОСНОВНОЙ МЕТОД
     */
    findMatches(pointsA, pointsB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🔺 ТРЕУГОЛЬНЫЙ ПОИСК СООТВЕТСТВИЙ`);
        console.log(`${'='.repeat(100)}`);
        console.log(`📊 Точек в А: ${pointsA.length}, в Б: ${pointsB.length}`);

        // ШАГ 1: Строим все возможные треугольники
        console.log(`\n🔍 ШАГ 1: Построение треугольников...`);
       
        const trianglesA = this.buildAllTriangles(pointsA);
        const trianglesB = this.buildAllTriangles(pointsB);
       
        console.log(`   • Треугольников в А: ${trianglesA.length}`);
        console.log(`   • Треугольников в Б: ${trianglesB.length}`);

        if (trianglesA.length === 0 || trianglesB.length === 0) {
            console.log(`⚠️ Недостаточно треугольников для сопоставления`);
            return {
                matches: [],
                stats: this.stats
            };
        }

        // ШАГ 2: Группировка треугольников по их признакам
        console.log(`\n🔍 ШАГ 2: Группировка треугольников...`);
       
        const groupsA = this.groupTriangles(trianglesA);
        const groupsB = this.groupTriangles(trianglesB);
       
        console.log(`   • Уникальных групп в А: ${Object.keys(groupsA).length}`);
        console.log(`   • Уникальных групп в Б: ${Object.keys(groupsB).length}`);

        // ШАГ 3: Поиск соответствующих треугольников
        console.log(`\n🔍 ШАГ 3: Поиск соответствий...`);
       
        const triangleMatches = this.matchTriangles(groupsA, groupsB);
       
        console.log(`   • Найдено пар треугольников: ${triangleMatches.length}`);

        // ШАГ 4: Построение окрестностей
        console.log(`\n🔍 ШАГ 4: Построение окрестностей...`);
       
        const neighborhoodsA = this.buildNeighborhoods(trianglesA, triangleMatches);
        const neighborhoodsB = this.buildNeighborhoods(trianglesB, triangleMatches);
       
        console.log(`   • Окрестностей в А: ${neighborhoodsA.length}`);
        console.log(`   • Окрестностей в Б: ${neighborhoodsB.length}`);

        // ШАГ 5: Поиск соответствующих окрестностей
        console.log(`\n🔍 ШАГ 5: Поиск соответствий окрестностей...`);
       
        const neighborhoodMatches = this.matchNeighborhoods(neighborhoodsA, neighborhoodsB);
       
        console.log(`   • Найдено окрестностей: ${neighborhoodMatches.length}`);

        // ШАГ 6: Восстановление точек по окрестностям
        console.log(`\n🔍 ШАГ 6: Восстановление точек...`);
       
        const pointMatches = this.reconstructPoints(neighborhoodMatches, pointsA, pointsB);
       
        console.log(`\n✅ Найдено соответствий точек: ${pointMatches.length}`);

        return {
            matches: pointMatches,
            triangleMatches,
            neighborhoodMatches,
            stats: this.stats
        };
    }

    /**
     * 🔥 Построение всех треугольников между похожими точками
     */
    buildAllTriangles(points) {
        const triangles = [];
       
        // 🔥 ИСПРАВЛЕНО: сначала группируем точки по морфологии
        const groups = this.groupPointsByMorphology(points);
       
        console.log(`   • Групп по морфологии: ${Object.keys(groups).length}`);
       
        // Строим треугольники только внутри групп
        for (const [groupId, groupPoints] of Object.entries(groups)) {
            if (groupPoints.length < 3) continue;
           
            // Для отладки покажем размер группы
            if (this.debug && groupPoints.length > 10) {
                console.log(`   • Группа ${groupId}: ${groupPoints.length} точек`);
            }
           
            for (let i = 0; i < groupPoints.length; i++) {
                for (let j = i+1; j < groupPoints.length; j++) {
                    for (let k = j+1; k < groupPoints.length; k++) {
                        const p1 = groupPoints[i];
                        const p2 = groupPoints[j];
                        const p3 = groupPoints[k];
                       
                        // Проверяем, что точки не слишком далеко
                        if (this.arePointsTooFar(p1, p2, p3)) continue;
                       
                        const triangle = this.createTriangle(p1, p2, p3);
                        triangles.push(triangle);
                    }
                }
            }
        }
       
        return triangles;
    }

    /**
     * 🔥 Группировка точек по морфологии - ИСПРАВЛЕННАЯ
     */
    groupPointsByMorphology(points) {
        const groups = {};
       
        for (const point of points) {
            // 🔥 ИСПРАВЛЕНО: используем дискретизацию с разумными интервалами
           
            // Компактность: группы по 5 единиц (14-55 → 3-11 групп)
            const compactGroup = Math.floor(point.compactness / 5);
           
            // Эксцентриситет: 0-0.33, 0.33-0.66, 0.66-1.0
            const eccGroup = Math.floor(point.eccentricity * 3);
           
            // Площадь: логарифмическая шкала (чтобы сжать огромный разброс)
            const logArea = Math.log10(point.normalizedArea + 1);
            const areaGroup = Math.floor(logArea * 2); // 0-2 для большинства
           
            // Роль как дополнительный группирующий признак
            const role = point.role || 'R';
           
            const key = `${role}_${compactGroup}_${eccGroup}_${areaGroup}`;
           
            if (!groups[key]) groups[key] = [];
            groups[key].push(point);
        }
       
        return groups;
    }

    /**
     * 🔥 Создание треугольника с 23 признаками
     */
    createTriangle(p1, p2, p3) {
        // 1. Морфология вершин (5×3 = 15 признаков)
        const morph = [
            p1.compactness || 0, p1.eccentricity || 0, p1.normalizedArea || 0,
            (p1.radialProfile ? p1.radialProfile[0] : 0), this.roleToNumber(p1.role || 'R'),
           
            p2.compactness || 0, p2.eccentricity || 0, p2.normalizedArea || 0,
            (p2.radialProfile ? p2.radialProfile[0] : 0), this.roleToNumber(p2.role || 'R'),
           
            p3.compactness || 0, p3.eccentricity || 0, p3.normalizedArea || 0,
            (p3.radialProfile ? p3.radialProfile[0] : 0), this.roleToNumber(p3.role || 'R')
        ];
       
        // 2. Отношения сторон (3 признака)
        const d12 = this.distance(p1, p2);
        const d13 = this.distance(p1, p3);
        const d23 = this.distance(p2, p3);
       
        // Защита от деления на ноль
        const eps = 0.001;
        const ratios = [
            d12 / (d13 + eps),
            d12 / (d23 + eps),
            d13 / (d23 + eps)
        ].sort();
       
        // 3. Углы между ориентациями вершин (3 признака)
        const angles = [
            this.angleBetween(p1.orientation || 0, this.direction(p1, p2)),
            this.angleBetween(p2.orientation || 0, this.direction(p2, p3)),
            this.angleBetween(p3.orientation || 0, this.direction(p3, p1))
        ];
       
        // 4. Тип треугольника (1 признак)
        const type = this.classifyTriangle(d12, d13, d23);
       
        // 5. Ориентация центра (1 признак)
        const center = this.triangleCenter(p1, p2, p3);
        const centerAngle = Math.atan2(center.y - 300, center.x - 300) * 180 / Math.PI;
       
        return {
            points: [p1.id, p2.id, p3.id],
            morph,
            ratios,
            angles,
            type,
            centerAngle,
           
            // Для построения связей
            edges: [
                [p1.id, p2.id].sort(),
                [p2.id, p3.id].sort(),
                [p3.id, p1.id].sort()
            ],
           
            // Кеш для быстрого доступа
            signature: this.hashTriangle(morph, ratios, angles, type, centerAngle)
        };
    }

    /**
     * 🔥 Группировка треугольников по их признакам
     */
    groupTriangles(triangles) {
    const groups = {};
   
    for (const triangle of triangles) {
        // 🔥 ГРУБАЯ ГРУППИРОВКА ОТНОШЕНИЙ СТОРОН
        // Округляем до 1 знака после запятой
        const ratiosKey = triangle.ratios.map(r => Math.floor(r * 10) / 10).join('_');
       
        // 🔥 ГРУБАЯ ГРУППИРОВКА ПО ТИПУ
        const type = triangle.type;
       
        // 🔥 ГРУБАЯ ГРУППИРОВКА ПО МОРФОЛОГИИ (только первый признак для начала)
        const morphKey = Math.floor(triangle.morph[0] / 10); // компактность с шагом 10
       
        // Формируем ключ
        const key = `${type}_${ratiosKey}_${morphKey}`;
       
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(triangle);
    }
   
    // Для отладки выведем размеры групп
    if (this.debug) {
        console.log(`   • Групп после укрупнения: ${Object.keys(groups).length}`);
        const sizes = Object.values(groups).map(g => g.length);
        console.log(`   • Размеры групп: мин=${Math.min(...sizes)}, макс=${Math.max(...sizes)}, среднее=${(sizes.reduce((a,b)=>a+b,0)/sizes.length).toFixed(1)}`);
    }
   
    return groups;
}
    /**
     * 🔥 Поиск соответствующих треугольников
     */
    matchTriangles(groupsA, groupsB) {
        const matches = [];
        const usedB = new Set();
       
        for (const [key, trianglesA] of Object.entries(groupsA)) {
            const trianglesB = groupsB[key];
            if (!trianglesB) continue;
           
            for (const triA of trianglesA) {
                let bestMatch = null;
                let bestScore = 0;
                let bestIndex = -1;
               
                for (let i = 0; i < trianglesB.length; i++) {
                    if (usedB.has(i)) continue;
                   
                    const triB = trianglesB[i];
                    const score = this.compareTriangles(triA, triB);
                   
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = triB;
                        bestIndex = i;
                    }
                }
               
                if (bestMatch && bestScore > 0.7) {
                    matches.push({
                        triangleA: triA,
                        triangleB: bestMatch,
                        score: bestScore
                    });
                    usedB.add(bestIndex);
                }
            }
        }
       
        return matches;
    }

    /**
     * 🔥 Сравнение двух треугольников
     */
    compareTriangles(t1, t2) {
        // Сравниваем морфологию (15 признаков)
        let morphScore = 0;
        for (let i = 0; i < 15; i++) {
            const diff = Math.abs(t1.morph[i] - t2.morph[i]);
            morphScore += 1 - Math.min(diff / this.morphologyThreshold, 1);
        }
        morphScore /= 15;
       
        // Сравниваем отношения сторон (3 признака)
        let ratioScore = 0;
        for (let i = 0; i < 3; i++) {
            const diff = Math.abs(t1.ratios[i] - t2.ratios[i]);
            ratioScore += 1 - Math.min(diff / this.ratioThreshold, 1);
        }
        ratioScore /= 3;
       
        // Сравниваем углы (3 признака)
        let angleScore = 0;
        for (let i = 0; i < 3; i++) {
            const diff = Math.abs(t1.angles[i] - t2.angles[i]);
            angleScore += 1 - Math.min(diff / this.angleThreshold, 1);
        }
        angleScore /= 3;
       
        // Сравниваем тип
        const typeScore = t1.type === t2.type ? 1 : 0;
       
        // Сравниваем центр
        const centerDiff = Math.abs(t1.centerAngle - t2.centerAngle);
        const centerScore = 1 - Math.min(centerDiff / 180, 1);
       
        // Взвешенная сумма
        return morphScore * 0.3 + ratioScore * 0.3 + angleScore * 0.2 + typeScore * 0.1 + centerScore * 0.1;
    }

    /**
     * 🔥 Построение окрестностей треугольников
     */
    buildNeighborhoods(triangles, matches) {
        // Создаем карту треугольников для быстрого доступа
        const triangleMap = new Map();
        for (const triangle of triangles) {
            triangleMap.set(triangle.signature, triangle);
        }
       
        // Для каждого сопоставленного треугольника строим его окрестность
        const neighborhoods = [];
       
        for (const match of matches) {
            const triangle = match.triangleA;
           
            // Находим соседей (треугольники, с которыми есть общее ребро)
            const neighbors = this.findNeighborTriangles(triangle, triangles);
           
            if (neighbors.length > 0) {
                neighborhoods.push({
                    center: triangle,
                    neighbors: neighbors,
                    signature: this.hashNeighborhood(triangle, neighbors)
                });
            }
        }
       
        return neighborhoods;
    }

    /**
     * 🔥 Поиск соседних треугольников
     */
    findNeighborTriangles(triangle, allTriangles) {
        const neighbors = [];
        const edgeSet = new Set(triangle.edges.map(e => e.join('--')));
       
        for (const other of allTriangles) {
            if (other === triangle) continue;
           
            // Проверяем, есть ли общее ребро
            for (const edge of other.edges) {
                if (edgeSet.has(edge.join('--'))) {
                    neighbors.push(other);
                    break;
                }
            }
        }
       
        return neighbors;
    }

    /**
     * 🔥 Поиск соответствующих окрестностей
     */
    matchNeighborhoods(neighborhoodsA, neighborhoodsB) {
        const matches = [];
        const usedB = new Set();
       
        for (const nA of neighborhoodsA) {
            let bestMatch = null;
            let bestScore = 0;
            let bestIndex = -1;
           
            for (let i = 0; i < neighborhoodsB.length; i++) {
                if (usedB.has(i)) continue;
               
                const nB = neighborhoodsB[i];
                const score = this.compareNeighborhoods(nA, nB);
               
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = nB;
                    bestIndex = i;
                }
            }
           
            if (bestMatch && bestScore > 0.6) {
                matches.push({
                    neighborhoodA: nA,
                    neighborhoodB: bestMatch,
                    score: bestScore
                });
                usedB.add(bestIndex);
            }
        }
       
        return matches;
    }

    /**
     * 🔥 Сравнение окрестностей
     */
    compareNeighborhoods(n1, n2) {
        // Сравниваем центральные треугольники
        const centerScore = this.compareTriangles(n1.center, n2.center);
       
        // Сравниваем количество соседей
        if (n1.neighbors.length !== n2.neighbors.length) return 0;
       
        // Сравниваем соседей (по одному)
        let neighborsScore = 0;
        for (let i = 0; i < n1.neighbors.length; i++) {
            neighborsScore += this.compareTriangles(n1.neighbors[i], n2.neighbors[i]);
        }
        neighborsScore /= n1.neighbors.length;
       
        return centerScore * 0.6 + neighborsScore * 0.4;
    }

    /**
     * 🔥 Восстановление точек по окрестностям
     */
    reconstructPoints(neighborhoodMatches, pointsA, pointsB) {
        const matches = [];
        const usedA = new Set();
        const usedB = new Set();
       
        // Карты для быстрого доступа
        const pointMapA = new Map(pointsA.map(p => [p.id, p]));
        const pointMapB = new Map(pointsB.map(p => [p.id, p]));
       
        for (const match of neighborhoodMatches) {
            const nA = match.neighborhoodA;
            const nB = match.neighborhoodB;
           
            // Все точки из центрального треугольника
            for (const pointId of nA.center.points) {
                if (!usedA.has(pointId)) {
                    // Ищем соответствующую точку в модели
                    const idx = nA.center.points.indexOf(pointId);
                    const pointBId = nB.center.points[idx];
                   
                    if (pointBId && !usedB.has(pointBId)) {
                        matches.push({
                            pointA: pointId,
                            pointB: pointBId,
                            confidence: match.score,
                            source: 'triangle_core'
                        });
                        usedA.add(pointId);
                        usedB.add(pointBId);
                    }
                }
            }
           
            // Точки из соседних треугольников
            for (let i = 0; i < nA.neighbors.length; i++) {
                const triA = nA.neighbors[i];
                const triB = nB.neighbors[i];
               
                for (let j = 0; j < 3; j++) {
                    const pointId = triA.points[j];
                    if (!usedA.has(pointId)) {
                        const pointBId = triB.points[j];
                        if (pointBId && !usedB.has(pointBId)) {
                            matches.push({
                                pointA: pointId,
                                pointB: pointBId,
                                confidence: match.score * 0.9,
                                source: 'triangle_neighbor'
                            });
                            usedA.add(pointId);
                            usedB.add(pointBId);
                        }
                    }
                }
            }
        }
       
        return matches;
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

    roleToNumber(role) {
        const map = { 'H': 5, 'C': 4, 'B': 3, 'R': 2, 'L': 1 };
        return map[role] || 0;
    }

    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx*dx + dy*dy);
    }

    direction(from, to) {
        return Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
    }

    angleBetween(a1, a2) {
        if (a1 === undefined || a2 === undefined) return 0;
        let diff = Math.abs(a1 - a2);
        if (diff > 180) diff = 360 - diff;
        return diff;
    }

    triangleCenter(p1, p2, p3) {
        return {
            x: (p1.x + p2.x + p3.x) / 3,
            y: (p1.y + p2.y + p3.y) / 3
        };
    }

    classifyTriangle(d1, d2, d3) {
        const eps = 0.1;
        const sides = [d1, d2, d3].sort((a,b) => a-b);
       
        if (Math.abs(sides[0] - sides[2]) / sides[2] < eps) return 'equilateral';
        if (Math.abs(sides[0] - sides[1]) / sides[1] < eps ||
            Math.abs(sides[1] - sides[2]) / sides[2] < eps) return 'isosceles';
       
        // Проверка на прямоугольный
        const a = sides[0], b = sides[1], c = sides[2];
        if (Math.abs(a*a + b*b - c*c) / (c*c) < eps) return 'right';
       
        return 'scalene';
    }

    arePointsTooFar(p1, p2, p3) {
        const d12 = this.distance(p1, p2);
        const d13 = this.distance(p1, p3);
        const d23 = this.distance(p2, p3);
        const maxDist = Math.max(d12, d13, d23);
        return maxDist > this.maxTriangleDistance;
    }

    hashTriangle(morph, ratios, angles, type, centerAngle) {
        const rounded = [
            ...morph.map(v => Math.round(v * 10)),
            ...ratios.map(v => Math.round(v * 10)),
            ...angles.map(v => Math.round(v / 5) * 5),
            type,
            Math.round(centerAngle / 10) * 10
        ];
        return rounded.join('_');
    }

    hashNeighborhood(center, neighbors) {
        const centerHash = center.signature;
        const neighborHashes = neighbors.map(n => n.signature).sort().join('|');
        return `${centerHash}|${neighborHashes}`;
    }
}

module.exports = TriangleMatcher;
