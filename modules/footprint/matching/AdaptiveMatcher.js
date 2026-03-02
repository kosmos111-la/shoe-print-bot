// modules/footprint/matching/AdaptiveMatcher.js
// 🎯 АДАПТИВНЫЙ МАТЧЕР - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ (НЕ ВИСНЕТ)

class AdaptiveMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
       
        // Веса для признаков
        this.weights = {
            compactness: 0.30,
            eccentricity: 0.25,
            radialProfile: 0.25,
            degree: 0.20
        };
       
        // Простой фиксированный порог
        this.threshold = options.threshold || 0.85;
       
        // Для статистики
        this.stats = {
            totalMatches: 0,
            conflictsResolved: 0,
            timeouts: 0
        };
       
        console.log('⚡ AdaptiveMatcher (быстрая версия) создан');
    }

    /**
     * ОСНОВНОЙ МЕТОД: быстрое сравнение
     */
    findMatches(pointsA, pointsB) {
        const startTime = Date.now();
        const MAX_TIME = 2000; // 2 секунды максимум
       
        console.log(`\n🔍 Быстрое сравнение: ${pointsA.length} ↔ ${pointsB.length}`);
       
        // 🔥 ЖЕСТКОЕ ОГРАНИЧЕНИЕ - не больше 30 точек с каждой стороны
        const limitedA = this.limitPoints(pointsA, 30);
        const limitedB = this.limitPoints(pointsB, 30);
       
        console.log(`   Ограничено до: ${limitedA.length} ↔ ${limitedB.length}`);
       
        const matches = [];
        const usedB = new Set();
       
        // Сортируем по важности (хабы первыми)
        const sortedA = this.sortByImportance(limitedA);
       
        for (const pointA of sortedA) {
            // Проверка времени
            if (Date.now() - startTime > MAX_TIME) {
                console.log(`⏰ Таймаут (${MAX_TIME}ms), найдено ${matches.length} пар`);
                this.stats.timeouts++;
                break;
            }
           
            // Быстрый поиск кандидатов
            const bestMatch = this.findBestMatch(pointA, limitedB, usedB);
           
            if (bestMatch) {
                matches.push({
                    pointA: pointA.id,
                    pointB: bestMatch.id,
                    score: bestMatch.score,
                    confidence: Math.round(bestMatch.score * 100)
                });
                usedB.add(bestMatch.id);
               
                if (this.debug && matches.length <= 5) {
                    console.log(`   ✅ ${pointA.id.slice(0,12)} ↔ ${bestMatch.id.slice(0,12)} (${Math.round(bestMatch.score*100)}%)`);
                }
            }
        }
       
        // Проверка на конфликты
        const validated = this.validateMatches(matches, limitedA, limitedB);
       
        console.log(`   ✅ Найдено: ${validated.length} пар за ${Date.now() - startTime}ms`);
       
        return validated;
    }

    /**
     * Ограничение количества точек
     */
    limitPoints(points, maxCount) {
        if (points.length <= maxCount) return points;
       
        // Сортируем по важности и берем топ
        const sorted = [...points].sort((a, b) => {
            const roleWeight = { 'H': 5, 'C': 4, 'B': 3, 'R': 2, 'L': 1 };
            const weightA = roleWeight[a.role] || 0;
            const weightB = roleWeight[b.role] || 0;
           
            if (weightA !== weightB) return weightB - weightA;
            return (b.degree || 0) - (a.degree || 0);
        });
       
        return sorted.slice(0, maxCount);
    }

    /**
     * Сортировка по важности
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
     * Поиск лучшего соответствия для точки
     */
    findBestMatch(pointA, pointsB, usedB) {
        let bestScore = 0;
        let bestMatch = null;
       
        for (const pointB of pointsB) {
            if (usedB.has(pointB.id)) continue;
           
            // Быстрый предварительный фильтр
            if (!this.quickFilter(pointA, pointB)) continue;
           
            // Детальное сравнение
            const score = this.calculateSimilarity(pointA, pointB);
           
            if (score > bestScore && score > this.threshold) {
                bestScore = score;
                bestMatch = pointB;
                bestMatch.score = score;
            }
        }
       
        return bestMatch;
    }

    /**
     * Быстрый фильтр
     */
    quickFilter(pointA, pointB) {
        // Роли должны совпадать
        if (pointA.role !== pointB.role) return false;
       
        // Грубая проверка компактности (разница не более 30%)
        if (pointA.compactness && pointB.compactness) {
            const ratio = Math.min(pointA.compactness, pointB.compactness) /
                         Math.max(pointA.compactness, pointB.compactness);
            if (ratio < 0.7) return false;
        }
       
        return true;
    }

    /**
     * Детальное вычисление сходства
     */
    calculateSimilarity(pointA, pointB) {
        let score = 0;
        let totalWeight = 0;
       
        // Компактность
        if (pointA.compactness && pointB.compactness) {
            const ratio = Math.min(pointA.compactness, pointB.compactness) /
                         Math.max(pointA.compactness, pointB.compactness);
            score += ratio * this.weights.compactness;
            totalWeight += this.weights.compactness;
        }
       
        // Эксцентриситет
        if (pointA.eccentricity && pointB.eccentricity) {
            const diff = Math.abs(pointA.eccentricity - pointB.eccentricity);
            const sim = Math.max(0, 1 - diff * 2);
            score += sim * this.weights.eccentricity;
            totalWeight += this.weights.eccentricity;
        }
       
        // Радиальный профиль
        if (pointA.radialProfile && pointB.radialProfile) {
            const sim = this.compareProfiles(pointA.radialProfile, pointB.radialProfile);
            score += sim * this.weights.radialProfile;
            totalWeight += this.weights.radialProfile;
        }
       
        // Степень
        if (pointA.degree && pointB.degree) {
            const ratio = Math.min(pointA.degree, pointB.degree) /
                         Math.max(pointA.degree, pointB.degree);
            score += ratio * this.weights.degree;
            totalWeight += this.weights.degree;
        }
       
        return totalWeight > 0 ? score / totalWeight : 0;
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
     * Проверка на конфликты
     */
    validateMatches(matches, pointsA, pointsB) {
        const validMatches = [];
        const usedA = new Set();
        const usedB = new Set();
       
        // Сортируем по убыванию
        const sorted = [...matches].sort((a, b) => b.score - a.score);
       
        for (const match of sorted) {
            if (!usedA.has(match.pointA) && !usedB.has(match.pointB)) {
                validMatches.push(match);
                usedA.add(match.pointA);
                usedB.add(match.pointB);
            } else {
                this.stats.conflictsResolved++;
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
            totalMatches: 0,
            conflictsResolved: 0,
            timeouts: 0
        };
    }
}

module.exports = AdaptiveMatcher;
