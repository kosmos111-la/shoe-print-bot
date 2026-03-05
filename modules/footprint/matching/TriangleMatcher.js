// modules/footprint/matching/TriangleMatcher.js
// 🔺 ГИБРИДНЫЙ ТРЕУГОЛЬНЫЙ МАТЧЕР (топология + геометрия)

class TriangleMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Топологические пороги
        this.degreeTolerance = options.degreeTolerance || 1; // допуск на степень
        this.roleStrict = options.roleStrict !== false; // роли строго?
       
        // Геометрические пороги
        this.ratioThreshold = options.ratioThreshold || 0.15; // 15% допуск на отношения
        this.morphologyThreshold = options.morphologyThreshold || 0.3; // 30% на морфологию
       
        // Общие параметры
        this.maxTriangleDistance = options.maxTriangleDistance || 200;
       
        console.log(`🔺 Гибридный TriangleMatcher создан`);
        console.log(`   • Топология: степени ±${this.degreeTolerance}, роли ${this.roleStrict ? 'строго' : 'мягко'}`);
        console.log(`   • Геометрия: отношения ±${this.ratioThreshold*100}%`);
        console.log(`   • Морфология: ±${this.morphologyThreshold*100}%`);
    }

    findMatches(pointsA, pointsB) {
        console.log(`\n${'='.repeat(100)}`);
        console.log(`🔺 ГИБРИДНЫЙ ТРЕУГОЛЬНЫЙ ПОИСК`);
        console.log(`${'='.repeat(100)}`);
        console.log(`📊 Точек в А: ${pointsA.length}, в Б: ${pointsB.length}`);

        // ШАГ 1: Строим треугольники
        console.log(`\n🔍 ШАГ 1: Построение треугольников...`);
       
        const trianglesA = this.buildAllTriangles(pointsA);
        const trianglesB = this.buildAllTriangles(pointsB);
       
        console.log(`   • Треугольников в А: ${trianglesA.length}`);
        console.log(`   • Треугольников в Б: ${trianglesB.length}`);

        if (trianglesA.length === 0 || trianglesB.length === 0) {
            console.log(`⚠️ Недостаточно треугольников`);
            return { matches: [] };
        }

        // ШАГ 2: Группировка по топологии
        console.log(`\n🔍 ШАГ 2: Топологическая группировка...`);
       
        const topoGroupsA = this.groupByTopology(trianglesA);
        const topoGroupsB = this.groupByTopology(trianglesB);
       
        console.log(`   • Топогрупп в А: ${Object.keys(topoGroupsA).length}`);
        console.log(`   • Топогрупп в Б: ${Object.keys(topoGroupsB).length}`);

        // ШАГ 3: Поиск соответствий внутри топогрупп
        console.log(`\n🔍 ШАГ 3: Поиск геометрических соответствий...`);
       
        const matches = this.findMatchesInTopoGroups(topoGroupsA, topoGroupsB);
       
        console.log(`   • Найдено соответствий треугольников: ${matches.length}`);

        // ШАГ 4: Восстановление точек
        console.log(`\n🔍 ШАГ 4: Восстановление точек...`);
       
        const pointMatches = this.reconstructPoints(matches, pointsA, pointsB);
       
        console.log(`\n✅ Найдено соответствий точек: ${pointMatches.length}`);

        return {
            matches: pointMatches,
            triangleMatches: matches,
            stats: { trianglesA: trianglesA.length, trianglesB: trianglesB.length }
        };
    }

    /**
     * 🔥 Построение треугольников (как было)
     */
    buildAllTriangles(points) {
        const triangles = [];
        const groups = this.groupPointsByMorphology(points);
       
        for (const groupPoints of Object.values(groups)) {
            if (groupPoints.length < 3) continue;
           
            for (let i = 0; i < groupPoints.length; i++) {
                for (let j = i+1; j < groupPoints.length; j++) {
                    for (let k = j+1; k < groupPoints.length; k++) {
                        const p1 = groupPoints[i];
                        const p2 = groupPoints[j];
                        const p3 = groupPoints[k];
                       
                        if (this.arePointsTooFar(p1, p2, p3)) continue;
                       
                        triangles.push(this.createTriangle(p1, p2, p3));
                    }
                }
            }
        }
       
        return triangles;
    }

    /**
     * 🔥 Группировка по морфологии
     */
    groupPointsByMorphology(points) {
        const groups = {};
       
        for (const point of points) {
            const compactGroup = Math.floor(point.compactness / 5);
            const eccGroup = Math.floor(point.eccentricity * 3);
            const logArea = Math.log10(point.normalizedArea + 1);
            const areaGroup = Math.floor(logArea * 2);
            const role = point.role || 'R';
           
            const key = `${role}_${compactGroup}_${eccGroup}_${areaGroup}`;
           
            if (!groups[key]) groups[key] = [];
            groups[key].push(point);
        }
       
        return groups;
    }

    /**
     * 🔥 Создание треугольника с топологическими и геометрическими признаками
     */
    createTriangle(p1, p2, p3) {
        // Топологические признаки
        const topology = {
            roles: [p1.role || 'R', p2.role || 'R', p3.role || 'R'],
            degrees: [p1.degree || 0, p2.degree || 0, p3.degree || 0],
            neighborRoles: [
                p1.neighborRoles || '',
                p2.neighborRoles || '',
                p3.neighborRoles || ''
            ]
        };
       
        // Геометрические признаки
        const d12 = this.distance(p1, p2);
        const d13 = this.distance(p1, p3);
        const d23 = this.distance(p2, p3);
       
        const ratios = [d12/d13, d12/d23, d13/d23].sort();
       
        // Морфологические признаки
        const morph = [
            p1.compactness || 0, p2.compactness || 0, p3.compactness || 0,
            p1.eccentricity || 0, p2.eccentricity || 0, p3.eccentricity || 0,
            p1.normalizedArea || 0, p2.normalizedArea || 0, p3.normalizedArea || 0
        ];
       
        return {
            points: [p1.id, p2.id, p3.id],
            topology,
            ratios,
            morph,
            // Для окрестностей
            edges: [
                [p1.id, p2.id].sort(),
                [p2.id, p3.id].sort(),
                [p3.id, p1.id].sort()
            ]
        };
    }

    /**
     * 🔥 Группировка по топологическим признакам
     */
    groupByTopology(triangles) {
        const groups = {};
       
        for (const triangle of triangles) {
            // Ключ: роли (строго)
            const roleKey = triangle.topology.roles.sort().join('');
           
            // Грубые степени (округляем до четных)
            const degreeKey = triangle.topology.degrees
                .map(d => Math.floor(d / 2) * 2)
                .sort()
                .join('_');
           
            const key = `${roleKey}_${degreeKey}`;
           
            if (!groups[key]) groups[key] = [];
            groups[key].push(triangle);
        }
       
        return groups;
    }

    /**
     * 🔥 Поиск соответствий внутри топологических групп
     */
    findMatchesInTopoGroups(groupsA, groupsB) {
        const matches = [];
        const usedB = new Set();
       
        for (const [key, trisA] of Object.entries(groupsA)) {
            const trisB = groupsB[key];
            if (!trisB) continue;
           
            for (const triA of trisA) {
                let bestMatch = null;
                let bestScore = 0;
                let bestIndex = -1;
               
                for (let i = 0; i < trisB.length; i++) {
                    if (usedB.has(i)) continue;
                   
                    const triB = trisB[i];
                    const score = this.compareTriangles(triA, triB);
                   
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = triB;
                        bestIndex = i;
                    }
                }
               
                if (bestMatch && bestScore > 0.6) {
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
     * 🔥 Сравнение треугольников (топология + геометрия)
     */
    compareTriangles(t1, t2) {
        // 1. ТОПОЛОГИЯ (роли должны совпасть)
        const roles1 = t1.topology.roles.sort().join('');
        const roles2 = t2.topology.roles.sort().join('');
        if (roles1 !== roles2) return 0;
       
        // 2. СТЕПЕНИ (могут отличаться на допуск)
        let degreeScore = 0;
        const deg1 = t1.topology.degrees.sort((a,b)=>a-b);
        const deg2 = t2.topology.degrees.sort((a,b)=>a-b);
       
        for (let i = 0; i < 3; i++) {
            const diff = Math.abs(deg1[i] - deg2[i]);
            degreeScore += Math.max(0, 1 - diff / this.degreeTolerance);
        }
        degreeScore /= 3;
       
        // 3. ГЕОМЕТРИЯ (отношения сторон)
        let ratioScore = 0;
        for (let i = 0; i < 3; i++) {
            const diff = Math.abs(t1.ratios[i] - t2.ratios[i]);
            const maxRatio = Math.max(t1.ratios[i], t2.ratios[i], 0.001);
            ratioScore += Math.max(0, 1 - (diff / maxRatio) / this.ratioThreshold);
        }
        ratioScore /= 3;
       
        // 4. МОРФОЛОГИЯ (очень мягко)
        let morphScore = 0;
        for (let i = 0; i < 9; i++) {
            const diff = Math.abs(t1.morph[i] - t2.morph[i]);
            const maxVal = Math.max(Math.abs(t1.morph[i]), Math.abs(t2.morph[i]), 0.001);
            morphScore += Math.max(0, 1 - (diff / maxVal) / this.morphologyThreshold);
        }
        morphScore /= 9;
       
        // Итог: геометрия важнее, топология уже отсекла лишнее
        return ratioScore * 0.6 + degreeScore * 0.2 + morphScore * 0.2;
    }

    /**
     * 🔥 Восстановление точек по треугольникам
     */
    reconstructPoints(matches, pointsA, pointsB) {
        const pointMatches = [];
        const usedA = new Set();
        const usedB = new Set();
       
        for (const match of matches) {
            const triA = match.triangleA;
            const triB = match.triangleB;
           
            // Ищем лучшее соответствие точек внутри треугольника
            // Простейший вариант — по порядку (но можно улучшить)
            for (let i = 0; i < 3; i++) {
                const pointA = triA.points[i];
                const pointB = triB.points[i];
               
                if (!usedA.has(pointA) && !usedB.has(pointB)) {
                    pointMatches.push({
                        pointA,
                        pointB,
                        confidence: match.score,
                        source: 'triangle'
                    });
                    usedA.add(pointA);
                    usedB.add(pointB);
                }
            }
        }
       
        return pointMatches;
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

    distance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx*dx + dy*dy);
    }

    arePointsTooFar(p1, p2, p3) {
        const d12 = this.distance(p1, p2);
        const d13 = this.distance(p1, p3);
        const d23 = this.distance(p2, p3);
        return Math.max(d12, d13, d23) > this.maxTriangleDistance;
    }
}

module.exports = TriangleMatcher;
