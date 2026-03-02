// modules/footprint/matching/AdaptiveMatcher.js
// 🎯 4-Й ЭТАП: ПОЛНОЕ КОМБИНАТОРНОЕ СРАВНЕНИЕ ПО ИНВАРИАНТНЫМ ПРИЗНАКАМ

class AdaptiveMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Пороги для разных уровней уверенности
        this.thresholds = {
            exact: 1.0,      // точное совпадение подписи
            high: 0.9,        // очень похожи
            medium: 0.8,      // похожи
            low: 0.7          // минимальное для рассмотрения
        };
       
        // Веса для разных типов признаков (при мягком сравнении)
        this.weights = {
            role: 0.20,
            compactness: 0.20,
            eccentricity: 0.15,
            radialProfile: 0.25,
            neighborRoles: 0.20
        };
       
        this.stats = {
            exactMatches: 0,
            highMatches: 0,
            mediumMatches: 0,
            lowMatches: 0,
            conflictsResolved: 0
        };
       
        console.log('🎯 AdaptiveMatcher (4-й этап - комбинаторный) создан');
    }

    /**
     * ОСНОВНОЙ МЕТОД: найти соответствия между двумя наборами точек
     */
    findMatches(pointsA, pointsB) {
        const startTime = Date.now();
        console.log(`\n🔍 4-Й ЭТАП: комбинаторное сравнение ${pointsA.length} ↔ ${pointsB.length} точек`);
       
        // Создаем индексы для быстрого поиска
        const indexB = this.createSignatureIndex(pointsB);
        const matches = [];
        const usedB = new Set();
       
        // Сортируем точки A по важности (хабы первыми)
        const sortedA = this.sortByImportance(pointsA);
       
        for (const pointA of sortedA) {
            // 1. Пытаемся найти ТОЧНОЕ совпадение подписи
            const signature = this.createSignature(pointA);
            const exactMatches = indexB.get(signature) || [];
           
            // Фильтруем уже использованные
            const availableExact = exactMatches.filter(id => !usedB.has(id));
           
            if (availableExact.length > 0) {
                // Нашли точное совпадение!
                const matchId = availableExact[0];
                const pointB = pointsB.find(p => p.id === matchId);
               
                matches.push({
                    pointA: pointA.id,
                    pointB: matchId,
                    score: 1.0,
                    confidence: 100,
                    matchType: 'exact',
                    signature: signature
                });
               
                usedB.add(matchId);
                this.stats.exactMatches++;
               
                if (this.debug) {
                    console.log(`   ✅ ТОЧНОЕ: ${pointA.id.slice(0,12)} ↔ ${matchId.slice(0,12)}`);
                }
                continue;
            }
           
            // 2. Если точных нет - ищем ПОХОЖИЕ по комбинациям
            const candidates = this.findSimilarCandidates(pointA, pointsB, usedB);
           
            if (candidates.length > 0) {
                const bestMatch = candidates[0];
                const matchType = this.getClassByScore(bestMatch.score);
               
                matches.push({
                    pointA: pointA.id,
                    pointB: bestMatch.id,
                    score: bestMatch.score,
                    confidence: Math.round(bestMatch.score * 100),
                    matchType: matchType,
                    details: bestMatch.details
                });
               
                usedB.add(bestMatch.id);
                this.stats[`${matchType}Matches`]++;
               
                if (this.debug && matches.length <= 10) {
                    console.log(`   🔸 ${matchType.toUpperCase()}: ${pointA.id.slice(0,12)} ↔ ${bestMatch.id.slice(0,12)} (${Math.round(bestMatch.score*100)}%)`);
                }
            }
        }
       
        // Проверка на конфликты
        const validated = this.validateMatches(matches);
       
        console.log(`\n📊 РЕЗУЛЬТАТ 4-ГО ЭТАПА:`);
        console.log(`   • Всего пар: ${validated.length}`);
        console.log(`   • Точных совпадений: ${this.stats.exactMatches}`);
        console.log(`   • Высокое сходство: ${this.stats.highMatches}`);
        console.log(`   • Среднее сходство: ${this.stats.mediumMatches}`);
        console.log(`   • Низкое сходство: ${this.stats.lowMatches}`);
        console.log(`   • Время: ${Date.now() - startTime}ms`);
       
        return validated;
    }

    /**
     * Создает индекс подписей для быстрого поиска
     */
    createSignatureIndex(points) {
        const index = new Map();
       
        for (const point of points) {
            const signature = this.createSignature(point);
            if (!index.has(signature)) {
                index.set(signature, []);
            }
            index.get(signature).push(point.id);
        }
       
        return index;
    }

    /**
     * Создает уникальную подпись точки на основе инвариантных признаков
     */
    createSignature(point) {
        const components = [];
       
        // 1. Роль (категориальный)
        components.push(point.role || 'R');
       
        // 2. Компактность (группируем)
        if (point.compactness) {
            const compactGroup = Math.floor(point.compactness / 2) * 2;
            components.push(`C${compactGroup}`);
        } else {
            components.push('C0');
        }
       
        // 3. Эксцентриситет (группируем)
        if (point.eccentricity) {
            const eccGroup = Math.floor(point.eccentricity * 10) / 10;
            components.push(`E${eccGroup.toFixed(1)}`);
        } else {
            components.push('E0');
        }
       
        // 4. Радиальный профиль (нормализованный)
        if (point.radialProfile) {
            const profile = point.radialProfile.map(v => Math.round(v)).join('');
            components.push(`R${profile}`);
        } else {
            components.push('R0000');
        }
       
        // 5. Роли соседей (уникальный паттерн)
        if (point.neighborRoles) {
            // Сортируем для инвариантности
            const sortedRoles = point.neighborRoles.split('').sort().join('');
            components.push(`N${sortedRoles}`);
        } else {
            components.push('N');
        }
       
        // 6. Степень (группируем)
        if (point.degree) {
            const degreeGroup = Math.floor(point.degree / 2) * 2;
            components.push(`D${degreeGroup}`);
        }
       
        return components.join('_');
    }

    /**
     * Поиск похожих кандидатов
     */
    findSimilarCandidates(pointA, pointsB, usedB) {
        const candidates = [];
       
        for (const pointB of pointsB) {
            if (usedB.has(pointB.id)) continue;
           
            // Быстрый фильтр по роли
            if (pointA.role !== pointB.role) continue;
           
            // Детальное сравнение
            const similarity = this.calculateSimilarity(pointA, pointB);
           
            if (similarity.score >= this.thresholds.low) {
                candidates.push({
                    id: pointB.id,
                    score: similarity.score,
                    details: similarity.details
                });
            }
        }
       
        // Сортируем по убыванию сходства
        return candidates.sort((a, b) => b.score - a.score);
    }

    /**
     * Детальное сравнение двух точек
     */
    calculateSimilarity(pointA, pointB) {
        const details = {};
        let totalScore = 0;
        let totalWeight = 0;
       
        // 1. Компактность
        if (pointA.compactness && pointB.compactness) {
            const ratio = Math.min(pointA.compactness, pointB.compactness) /
                         Math.max(pointA.compactness, pointB.compactness);
            details.compactness = ratio;
            totalScore += ratio * this.weights.compactness;
            totalWeight += this.weights.compactness;
        }
       
        // 2. Эксцентриситет
        if (pointA.eccentricity && pointB.eccentricity) {
            const diff = Math.abs(pointA.eccentricity - pointB.eccentricity);
            const sim = Math.max(0, 1 - diff * 2);
            details.eccentricity = sim;
            totalScore += sim * this.weights.eccentricity;
            totalWeight += this.weights.eccentricity;
        }
       
        // 3. Радиальный профиль
        if (pointA.radialProfile && pointB.radialProfile) {
            const sim = this.compareProfiles(pointA.radialProfile, pointB.radialProfile);
            details.radialProfile = sim;
            totalScore += sim * this.weights.radialProfile;
            totalWeight += this.weights.radialProfile;
        }
       
        // 4. Роли соседей
        if (pointA.neighborRoles && pointB.neighborRoles) {
            const sim = this.compareNeighborRoles(pointA.neighborRoles, pointB.neighborRoles);
            details.neighborRoles = sim;
            totalScore += sim * this.weights.neighborRoles;
            totalWeight += this.weights.neighborRoles;
        }
       
        // 5. Степень (как дополнительный фактор)
        if (pointA.degree && pointB.degree) {
            const ratio = Math.min(pointA.degree, pointB.degree) /
                         Math.max(pointA.degree, pointB.degree);
            details.degree = ratio;
            // Степень уже учтена в роли, но добавим как бонус
            totalScore += ratio * 0.05;
            totalWeight += 0.05;
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
        // Считаем частоты каждой роли
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
     * Определение класса совпадения по score
     */
    getClassByScore(score) {
        if (score >= this.thresholds.exact) return 'exact';
        if (score >= this.thresholds.high) return 'high';
        if (score >= this.thresholds.medium) return 'medium';
        return 'low';
    }

    /**
     * Сортировка точек по важности
     */
    sortByImportance(points) {
        return [...points].sort((a, b) => {
            const roleWeight = { 'H': 5, 'C': 4, 'B': 3, 'R': 2, 'L': 1 };
            const weightA = roleWeight[a.role] || 0;
            const weightB = roleWeight[b.role] || 0;
           
            if (weightA !== weightB) return weightB - weightA;
            return (b.degree || 0) - (a.degree || 0);
        });
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

    /**
     * Сброс статистики
     */
    resetStats() {
        this.stats = {
            exactMatches: 0,
            highMatches: 0,
            mediumMatches: 0,
            lowMatches: 0,
            conflictsResolved: 0
        };
    }
}

module.exports = AdaptiveMatcher;
