// modules/footprint/matching/OptimalMatcher.js
// 🎯 ОПТИМАЛЬНОЕ СОПОСТАВЛЕНИЕ (ВЕНГЕРСКИЙ АЛГОРИТМ)
// 🔥 14 инвариантных признаков

class OptimalMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
        this.tolerances = options.tolerances || {
            compactness: 0.4,
            eccentricity: 0.15,
            normalizedArea: 0.75,
            radialProfile: 0.3,
            degree: 2,
            triangles: 1,
            role: 'soft'
        };

        this.roleTransitions = {
            'H': { strong: ['H'], weak: ['H', 'C', 'B'] },
            'C': { strong: ['C'], weak: ['C', 'H', 'R'] },
            'B': { strong: ['B'], weak: ['B', 'R', 'L'] },
            'R': { strong: ['R'], weak: ['R', 'B', 'L'] },
            'L': { strong: ['L'], weak: ['L', 'R'] }
        };

        console.log('🎯 OptimalMatcher создан');
    }

    /**
     * Основной метод: находит оптимальные пары
     */
    findOptimalMatches(pointsA, pointsB) {
        console.log(`\n🔍 Венгерский алгоритм: ${pointsA.length} ↔ ${pointsB.length}`);

        // 1. Строим матрицу сходства
        const matrix = this.buildSimilarityMatrix(pointsA, pointsB);
       
        // 2. Применяем венгерский алгоритм
        const assignment = this.hungarianAlgorithm(matrix);
       
        // 3. Формируем результат
        const matches = [];
        const usedA = new Set();
        const usedB = new Set();

        for (let i = 0; i < pointsA.length; i++) {
            const j = assignment[i];
            if (j < pointsB.length && matrix[i][j] > 0.6) { // порог
                matches.push({
                    pointA: pointsA[i].id,
                    pointB: pointsB[j].id,
                    score: matrix[i][j]
                });
                usedA.add(pointsA[i].id);
                usedB.add(pointsB[j].id);
            }
        }

        // 4. Определяем "одинокие" точки
        const onlyA = pointsA.filter(p => !usedA.has(p.id)).length;
        const onlyB = pointsB.filter(p => !usedB.has(p.id)).length;

        const avgScore = matches.reduce((sum, m) => sum + m.score, 0) / matches.length;

        return {
            matches,
            averageSimilarity: avgScore || 0,
            onlyA,
            onlyB
        };
    }

    /**
     * Строит матрицу сходства между всеми точками
     */
    buildSimilarityMatrix(pointsA, pointsB) {
        const matrix = Array(pointsA.length).fill()
            .map(() => Array(pointsB.length).fill(0));

        for (let i = 0; i < pointsA.length; i++) {
            for (let j = 0; j < pointsB.length; j++) {
                matrix[i][j] = this.calculateSimilarity(pointsA[i], pointsB[j]);
            }
        }

        return matrix;
    }

    /**
     * Вычисляет сходство между двумя точками
     */
    calculateSimilarity(a, b) {
        let score = 0;
        let checks = 0;

        // Роль (с учетом силы)
        if (this.rolesCompatible(a.role, b.role)) {
            score += 1;
            checks++;
        }

        // Компактность
        if (a.compactness && b.compactness) {
            const ratio = Math.min(a.compactness, b.compactness) /
                         Math.max(a.compactness, b.compactness);
            if (ratio >= 1 - this.tolerances.compactness) {
                score += ratio;
                checks++;
            }
        }

        // Эксцентриситет
        if (a.eccentricity && b.eccentricity) {
            const diff = Math.abs(a.eccentricity - b.eccentricity);
            if (diff <= this.tolerances.eccentricity) {
                score += 1 - diff;
                checks++;
            }
        }

        // Площадь
        if (a.normalizedArea && b.normalizedArea) {
            const ratio = Math.min(a.normalizedArea, b.normalizedArea) /
                         Math.max(a.normalizedArea, b.normalizedArea);
            if (ratio >= 1 - this.tolerances.normalizedArea) {
                score += ratio;
                checks++;
            }
        }

        // Радиальный профиль
        if (a.radialProfile && b.radialProfile) {
            const diff = this.averageProfileDiff(a.radialProfile, b.radialProfile);
            if (diff <= this.tolerances.radialProfile) {
                score += 1 - diff;
                checks++;
            }
        }

        // Степень
        const degreeDiff = Math.abs(a.degree - b.degree);
        if (degreeDiff <= this.tolerances.degree) {
            score += 1 - (degreeDiff / (a.degree + b.degree || 2));
            checks++;
        }

        // Кластер (строго)
        if (a.clusterId && b.clusterId && a.clusterId === b.clusterId) {
            score += 1;
            checks++;
        }

        return checks > 0 ? score / checks : 0;
    }

    /**
     * Проверяет совместимость ролей
     */
    rolesCompatible(roleA, roleB) {
        if (roleA === roleB) return true;
       
        const transitions = this.roleTransitions[roleA]?.weak || [];
        return transitions.includes(roleB);
    }

    /**
     * Средняя разница профилей
     */
    averageProfileDiff(profA, profB) {
        let sum = 0;
        const len = Math.min(profA.length, profB.length);
        for (let i = 0; i < len; i++) {
            sum += Math.abs(profA[i] - profB[i]);
        }
        return sum / len;
    }

    /**
     * Венгерский алгоритм (реализация)
     */
    hungarianAlgorithm(matrix) {
        const n = matrix.length;
        const m = matrix[0].length;
        const size = Math.max(n, m);
       
        // Преобразуем в задачу минимизации
        const cost = Array(size).fill().map(() => Array(size).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < m; j++) {
                cost[i][j] = 1 - matrix[i][j]; // максимизация сходства = минимизация (1-сходство)
            }
        }
        for (let i = n; i < size; i++) {
            for (let j = 0; j < size; j++) {
                cost[i][j] = 1; // большая цена для фиктивных
            }
        }
        for (let j = m; j < size; j++) {
            for (let i = 0; i < size; i++) {
                cost[i][j] = 1;
            }
        }

        // Венгерский алгоритм O(n³)
        const u = Array(size + 1).fill(0);
        const v = Array(size + 1).fill(0);
        const p = Array(size + 1).fill(0);
        const way = Array(size + 1).fill(0);

        for (let i = 1; i <= size; i++) {
            p[0] = i;
            let j0 = 0;
            const minv = Array(size + 1).fill(Infinity);
            const used = Array(size + 1).fill(false);
           
            do {
                used[j0] = true;
                let i0 = p[j0];
                let delta = Infinity;
                let j1 = 0;
               
                for (let j = 1; j <= size; j++) {
                    if (!used[j]) {
                        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
                        if (cur < minv[j]) {
                            minv[j] = cur;
                            way[j] = j0;
                        }
                        if (minv[j] < delta) {
                            delta = minv[j];
                            j1 = j;
                        }
                    }
                }
               
                for (let j = 0; j <= size; j++) {
                    if (used[j]) {
                        u[p[j]] += delta;
                        v[j] -= delta;
                    } else {
                        minv[j] -= delta;
                    }
                }
                j0 = j1;
            } while (p[j0] !== 0);
           
            do {
                const j1 = way[j0];
                p[j0] = p[j1];
                j0 = j1;
            } while (j0);
        }

        // Формируем результат
        const assignment = Array(n).fill(-1);
        for (let j = 1; j <= size; j++) {
            if (p[j] <= n && j <= m) {
                assignment[p[j] - 1] = j - 1;
            }
        }
       
        return assignment;
    }
}

module.exports = OptimalMatcher;
