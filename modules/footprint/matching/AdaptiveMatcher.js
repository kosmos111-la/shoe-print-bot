// modules/footprint/matching/AdaptiveMatcher.js
// 🎯 4-Й ЭТАП: ПОИСК УНИКАЛЬНЫХ ТОЧЕК И ИХ СОПОСТАВЛЕНИЕ
// 📊 С ПОДРОБНЫМ ЛОГИРОВАНИЕМ

class AdaptiveMatcher {
    constructor(options = {}) {
        this.debug = options.debug !== false; // логи включены по умолчанию
        this.verbose = options.verbose || false;
       
        // Пороги
        this.thresholds = {
            exact: 1.0,
            high: 0.95,
            medium: 0.85
        };
       
        this.stats = {
            totalPointsA: 0,
            totalPointsB: 0,
            uniquePointsA: 0,
            uniquePointsB: 0,
            exactMatches: 0,
            highMatches: 0,
            mediumMatches: 0,
            conflictsResolved: 0
        };
       
        console.log('🎯 AdaptiveMatcher (4-й этап - уникальные точки) создан');
    }

    /**
     * ОСНОВНОЙ МЕТОД: найти соответствия между двумя наборами точек
     */
    findMatches(pointsA, pointsB) {
        const startTime = Date.now();
       
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔍 4-Й ЭТАП: ПОИСК УНИКАЛЬНЫХ ТОЧЕК И ИХ СОПОСТАВЛЕНИЕ`);
        console.log(`${'='.repeat(80)}`);
        console.log(`📊 Всего точек в следе А: ${pointsA.length}`);
        console.log(`📊 Всего точек в следе Б: ${pointsB.length}`);
       
        this.stats.totalPointsA = pointsA.length;
        this.stats.totalPointsB = pointsB.length;
       
        // ШАГ 1: Находим уникальные точки в каждом следе
        console.log(`\n🔎 ШАГ 1: Анализ уникальности точек...`);
       
        const { unique: uniqueA, stats: statsA } = this.findUniquePoints(pointsA);
        const { unique: uniqueB, stats: statsB } = this.findUniquePoints(pointsB);
       
        console.log(`\n📊 УНИКАЛЬНЫЕ ТОЧКИ В СЛЕДЕ А:`);
        console.log(`   • Найдено: ${uniqueA.length} из ${pointsA.length}`);
        console.log(`   • Уникальных подписей: ${statsA.uniqueSignatures}`);
        console.log(`   • Топ-3 самые редкие:`);
        statsA.rarest.slice(0, 3).forEach((item, i) => {
            console.log(`     ${i+1}. ${item.signature.substring(0,40)}... (${item.count} раз)`);
        });
       
        console.log(`\n📊 УНИКАЛЬНЫЕ ТОЧКИ В СЛЕДЕ Б:`);
        console.log(`   • Найдено: ${uniqueB.length} из ${pointsB.length}`);
        console.log(`   • Уникальных подписей: ${statsB.uniqueSignatures}`);
        console.log(`   • Топ-3 самые редкие:`);
        statsB.rarest.slice(0, 3).forEach((item, i) => {
            console.log(`     ${i+1}. ${item.signature.substring(0,40)}... (${item.count} раз)`);
        });
       
        this.stats.uniquePointsA = uniqueA.length;
        this.stats.uniquePointsB = uniqueB.length;
       
        // ШАГ 2: Сопоставляем уникальные точки
        console.log(`\n🔎 ШАГ 2: Сопоставление уникальных точек...`);
       
        const matches = this.matchUniquePoints(uniqueA, uniqueB);
       
        console.log(`\n📊 РЕЗУЛЬТАТЫ СОПОСТАВЛЕНИЯ:`);
        console.log(`   • Точных совпадений: ${this.stats.exactMatches}`);
        console.log(`   • Высокое сходство: ${this.stats.highMatches}`);
        console.log(`   • Среднее сходство: ${this.stats.mediumMatches}`);
       
        // ШАГ 3: Проверка на конфликты
        console.log(`\n🔎 ШАГ 3: Проверка уникальности соответствий...`);
       
        const validated = this.validateMatches(matches);
       
        console.log(`   • Конфликтов разрешено: ${this.stats.conflictsResolved}`);
        console.log(`   • Итоговое число пар: ${validated.length}`);
       
        // ШАГ 4: Детальный анализ найденных пар
        if (validated.length > 0) {
            console.log(`\n📋 ДЕТАЛЬНЫЙ АНАЛИЗ НАЙДЕННЫХ ПАР (первые 5):`);
            console.log(`┌─────┬──────────────────────┬──────────────────────┬───────────┬───────────┐`);
            console.log(`│  #  │       ТОЧКА А         │       ТОЧКА Б         │ СХОДСТВО  │    ТИП    │`);
            console.log(`├─────┼──────────────────────┼──────────────────────┼───────────┼───────────┤`);
           
            validated.slice(0, 5).forEach((match, i) => {
                const type = match.matchType === 'exact' ? 'ТОЧНОЕ' :
                            match.matchType === 'high' ? 'ВЫСОКОЕ' : 'СРЕДНЕЕ';
                console.log(
                    `│ ${(i+1).toString().padEnd(3)} │ ${match.pointA.substring(0,20).padEnd(20)} │ ` +
                    `${match.pointB.substring(0,20).padEnd(20)} │ ` +
                    `${(match.score*100).toFixed(1).padStart(7)}%   │ ${type.padEnd(9)} │`
                );
            });
            console.log(`└─────┴──────────────────────┴──────────────────────┴───────────┴───────────┘`);
        }
       
        console.log(`\n⏱️  Время выполнения: ${Date.now() - startTime}ms`);
        console.log(`${'='.repeat(80)}`);
       
        return validated;
    }

    /**
     * Находит уникальные точки в наборе
     */
    findUniquePoints(points) {
        const signatureCounts = new Map();
        const pointSignatures = new Map();
       
        // Создаем детальные подписи для всех точек
        for (const point of points) {
            const signature = this.createDetailedSignature(point);
            pointSignatures.set(point.id, signature);
            signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1);
        }
       
        // Собираем статистику по подписям
        const signatureStats = Array.from(signatureCounts.entries())
            .map(([sig, count]) => ({ signature: sig, count }))
            .sort((a, b) => a.count - b.count);
       
        const uniqueSignatures = signatureStats.filter(s => s.count === 1);
        const uniquePoints = points.filter(p => {
            const sig = pointSignatures.get(p.id);
            return signatureCounts.get(sig) === 1;
        });
       
        if (this.verbose) {
            console.log(`\n📈 РАСПРЕДЕЛЕНИЕ ПОДПИСЕЙ:`);
            console.log(`   • Уникальных подписей: ${uniqueSignatures.length}`);
            console.log(`   • Повторяющихся: ${signatureStats.length - uniqueSignatures.length}`);
            console.log(`   • Самая частая подпись встречается: ${signatureStats[signatureStats.length-1]?.count} раз`);
        }
       
        return {
            unique: uniquePoints,
            stats: {
                uniqueSignatures: uniqueSignatures.length,
                rarest: signatureStats.slice(0, 5)
            }
        };
    }

    /**
     * Создает ДЕТАЛЬНУЮ подпись точки (без потери точности)
     */
    createDetailedSignature(point) {
        const components = [];
       
        // 1. Роль (категориальный)
        components.push(point.role || 'R');
       
        // 2. Компактность (с 2 знаками)
        if (point.compactness) {
            components.push(point.compactness.toFixed(2));
        } else {
            components.push('0.00');
        }
       
        // 3. Эксцентриситет (с 3 знаками)
        if (point.eccentricity) {
            components.push(point.eccentricity.toFixed(3));
        } else {
            components.push('0.000');
        }
       
        // 4. Радиальный профиль (с 2 знаками)
        if (point.radialProfile && Array.isArray(point.radialProfile)) {
            const profileStr = point.radialProfile.map(v => v.toFixed(2)).join(',');
            components.push(profileStr);
        } else {
            components.push('0.00,0.00,0.00,0.00');
        }
       
        // 5. Роли соседей (отсортированные)
        if (point.neighborRoles) {
            const sortedRoles = point.neighborRoles.split('').sort().join('');
            components.push(sortedRoles);
        } else {
            components.push('');
        }
       
        // 6. Степень
        if (point.degree) {
            components.push(point.degree.toString());
        } else {
            components.push('0');
        }
       
        return components.join('|');
    }

    /**
     * Сопоставляет уникальные точки двух наборов
     */
    matchUniquePoints(uniqueA, uniqueB) {
        const matches = [];
        const usedB = new Set();
       
        // Создаем индекс для быстрого поиска по подписям
        const signatureIndexB = new Map();
        for (const pointB of uniqueB) {
            const sig = this.createDetailedSignature(pointB);
            if (!signatureIndexB.has(sig)) {
                signatureIndexB.set(sig, []);
            }
            signatureIndexB.get(sig).push(pointB);
        }
       
        for (const pointA of uniqueA) {
            const sigA = this.createDetailedSignature(pointA);
           
            // 1. Ищем точное совпадение подписи
            const exactMatches = signatureIndexB.get(sigA) || [];
            const availableExact = exactMatches.filter(p => !usedB.has(p.id));
           
            if (availableExact.length > 0) {
                // Точное совпадение!
                const pointB = availableExact[0];
                matches.push({
                    pointA: pointA.id,
                    pointB: pointB.id,
                    score: 1.0,
                    matchType: 'exact',
                    signature: sigA
                });
                usedB.add(pointB.id);
                this.stats.exactMatches++;
               
                if (this.debug) {
                    console.log(`   ✅ ТОЧНОЕ: ${pointA.id.slice(0,12)} ↔ ${pointB.id.slice(0,12)}`);
                    if (this.verbose) {
                        console.log(`      Подпись: ${sigA.substring(0,60)}...`);
                    }
                }
                continue;
            }
           
            // 2. Ищем похожие по компонентам
            const candidates = [];
            for (const pointB of uniqueB) {
                if (usedB.has(pointB.id)) continue;
               
                const similarity = this.calculateComponentSimilarity(pointA, pointB);
                if (similarity.score >= this.thresholds.medium) {
                    candidates.push({
                        pointB: pointB,
                        score: similarity.score,
                        details: similarity.details
                    });
                }
            }
           
            if (candidates.length > 0) {
                candidates.sort((a, b) => b.score - a.score);
                const best = candidates[0];
               
                const matchType = best.score >= this.thresholds.high ? 'high' : 'medium';
                matches.push({
                    pointA: pointA.id,
                    pointB: best.pointB.id,
                    score: best.score,
                    matchType: matchType,
                    details: best.details
                });
                usedB.add(best.pointB.id);
               
                this.stats[`${matchType}Matches`]++;
               
                if (this.debug) {
                    const typeStr = matchType === 'high' ? 'ВЫСОКОЕ' : 'СРЕДНЕЕ';
                    console.log(`   🔸 ${typeStr}: ${pointA.id.slice(0,12)} ↔ ${best.pointB.id.slice(0,12)} (${(best.score*100).toFixed(1)}%)`);
                }
            }
        }
       
        return matches;
    }

    /**
     * Сравнение по компонентам (для похожих, но не идентичных точек)
     */
    calculateComponentSimilarity(pointA, pointB) {
        const details = {};
        let totalScore = 0;
        let totalWeight = 0;
       
        // Веса для разных компонент
        const weights = {
            role: 0.20,
            compactness: 0.25,
            eccentricity: 0.20,
            radialProfile: 0.25,
            neighborRoles: 0.10
        };
       
        // 1. Роль (должна совпадать)
        if (pointA.role !== pointB.role) {
            return { score: 0, details: { reason: 'role_mismatch' } };
        }
        details.role = 1.0;
        totalScore += 1.0 * weights.role;
        totalWeight += weights.role;
       
        // 2. Компактность
        if (pointA.compactness && pointB.compactness) {
            const ratio = Math.min(pointA.compactness, pointB.compactness) /
                         Math.max(pointA.compactness, pointB.compactness);
            details.compactness = ratio;
            totalScore += ratio * weights.compactness;
            totalWeight += weights.compactness;
        }
       
        // 3. Эксцентриситет
        if (pointA.eccentricity && pointB.eccentricity) {
            const diff = Math.abs(pointA.eccentricity - pointB.eccentricity);
            const sim = Math.max(0, 1 - diff * 2);
            details.eccentricity = sim;
            totalScore += sim * weights.eccentricity;
            totalWeight += weights.eccentricity;
        }
       
        // 4. Радиальный профиль
        if (pointA.radialProfile && pointB.radialProfile) {
            const sim = this.compareProfiles(pointA.radialProfile, pointB.radialProfile);
            details.radialProfile = sim;
            totalScore += sim * weights.radialProfile;
            totalWeight += weights.radialProfile;
        }
       
        // 5. Роли соседей
        if (pointA.neighborRoles && pointB.neighborRoles) {
            const sim = this.compareNeighborRoles(pointA.neighborRoles, pointB.neighborRoles);
            details.neighborRoles = sim;
            totalScore += sim * weights.neighborRoles;
            totalWeight += weights.neighborRoles;
        }
       
        return {
            score: totalWeight > 0 ? totalScore / totalWeight : 0,
            details: details
        };
    }

    /**
     * Сравнение радиальных профилей
     */
    compareProfiles(profA, profB) {
        if (!profA || !profB) return 0.5;
       
        let sum = 0;
        const len = Math.min(profA.length, profB.length);
        for (let i = 0; i < len; i++) {
            const diff = Math.abs(profA[i] - profB[i]);
            sum += 1 - Math.min(diff, 1);
        }
        return sum / len;
    }

    /**
     * Сравнение ролей соседей
     */
    compareNeighborRoles(rolesA, rolesB) {
        const getCounts = (roles) => {
            const counts = { H: 0, C: 0, B: 0, R: 0, L: 0 };
            for (const r of roles) {
                if (counts.hasOwnProperty(r)) counts[r]++;
            }
            return counts;
        };
       
        const countsA = getCounts(rolesA);
        const countsB = getCounts(rolesB);
       
        let score = 0;
        let total = 0;
       
        for (const role of ['H', 'C', 'B', 'R', 'L']) {
            const max = Math.max(countsA[role], countsB[role]);
            if (max > 0) {
                const min = Math.min(countsA[role], countsB[role]);
                score += min / max;
                total++;
            }
        }
       
        return total > 0 ? score / total : 0;
    }

    /**
     * Проверка на конфликты
     */
    validateMatches(matches) {
        const validMatches = [];
        const usedA = new Set();
        const usedB = new Set();
       
        // Сортируем по убыванию score
        const sorted = [...matches].sort((a, b) => b.score - a.score);
       
        for (const match of sorted) {
            if (!usedA.has(match.pointA) && !usedB.has(match.pointB)) {
                validMatches.push(match);
                usedA.add(match.pointA);
                usedB.add(match.pointB);
            } else {
                this.stats.conflictsResolved++;
                if (this.debug) {
                    console.log(`   ⚠️ Конфликт: ${match.pointA.slice(0,12)} или ${match.pointB.slice(0,12)} уже используются`);
                }
            }
        }
       
        return validMatches;
    }

    /**
     * Получить статистику
     */
    getStats() {
        return { ...this.stats };
    }
}

module.exports = AdaptiveMatcher;
