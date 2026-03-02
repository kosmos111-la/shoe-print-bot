// modules/footprint/matching/AdaptiveMatcher.js
// 🎯 АДАПТИВНЫЙ МАТЧЕР С АВТОПОДБОРОМ ПОРОГОВ

class AdaptiveMatcher {
    constructor(options = {}) {
        this.debug = options.debug || false;
        
        // Веса для признаков (можно настраивать)
        this.weights = {
            compactness: 0.25,
            eccentricity: 0.20,
            radialProfile: 0.25,
            neighborRoles: 0.15,
            degree: 0.10,
            triangles: 0.05
        };
        
        // Начальные пороги
        this.initialThreshold = options.initialThreshold || 0.7;
        this.minThreshold = options.minThreshold || 0.5;
        this.maxThreshold = options.maxThreshold || 0.95;
        this.stepSize = options.stepSize || 0.05;
        
        // Для анализа
        this.stats = {
            totalMatches: 0,
            conflictsResolved: 0,
            thresholdAdjustments: 0
        };
        
        console.log('🎯 AdaptiveMatcher создан');
    }

    /**
     * ОСНОВНОЙ МЕТОД: найти соответствия между двумя наборами точек
     */
    findMatches(pointsA, pointsB) {
        console.log(`\n🔍 Адаптивный поиск соответствий: ${pointsA.length} ↔ ${pointsB.length}`);
        
        const matches = [];
        const usedB = new Set();
        
        // Сортируем точки по важности (сначала хабы)
        const sortedA = this.sortByImportance(pointsA);
        
        for (const pointA of sortedA) {
            // Находим кандидатов в B
            const candidates = this.findCandidates(pointA, pointsB, usedB);
            
            // Адаптивный подбор порога
            const bestMatch = this.findBestMatchWithAdaptiveThreshold(pointA, candidates);
            
            if (bestMatch) {
                matches.push({
                    pointA: pointA.id,
                    pointB: bestMatch.id,
                    score: bestMatch.score,
                    confidence: this.calculateConfidence(pointA, bestMatch)
                });
                usedB.add(bestMatch.id);
                
                if (this.debug) {
                    console.log(`   ✅ ${pointA.id.slice(0,12)} ↔ ${bestMatch.id.slice(0,12)} (${(bestMatch.score*100).toFixed(1)}%)`);
                }
            }
        }
        
        // Проверка на конфликты (обратная уникальность)
        const validated = this.validateMatches(matches, pointsA, pointsB);
        
        console.log(`\n📊 ИТОГ: найдено ${validated.length} соответствий`);
        console.log(`   • Конфликтов разрешено: ${this.stats.conflictsResolved}`);
        console.log(`   • Средняя уверенность: ${this.calculateAvgConfidence(validated)}%`);
        
        return validated;
    }

    /**
     * Сортировка точек по важности (хабы первыми)
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
     * Поиск кандидатов (быстрый отсев)
     */
    findCandidates(pointA, pointsB, usedB) {
        return pointsB
            .filter(p => !usedB.has(p.id) && this.quickFilter(pointA, p))
            .map(p => ({
                ...p,
                score: this.calculateSimilarity(pointA, p)
            }))
            .sort((a, b) => b.score - a.score);
    }

    /**
     * Быстрый фильтр (отсекаем явно неподходящие)
     */
    quickFilter(pointA, pointB) {
        // Роли должны совпадать
        if (pointA.role !== pointB.role) return false;
        
        // Грубая проверка компактности (разница не более 50%)
        if (pointA.compactness && pointB.compactness) {
            const ratio = pointA.compactness / pointB.compactness;
            if (ratio < 0.5 || ratio > 2.0) return false;
        }
        
        return true;
    }

    /**
     * Детальное вычисление сходства (0-1)
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
        
        // Роли соседей
        if (pointA.neighborRoles && pointB.neighborRoles) {
            const sim = this.compareNeighborRoles(pointA.neighborRoles, pointB.neighborRoles);
            score += sim * this.weights.neighborRoles;
            totalWeight += this.weights.neighborRoles;
        }
        
        // Степень
        if (pointA.degree && pointB.degree) {
            const ratio = Math.min(pointA.degree, pointB.degree) / 
                         Math.max(pointA.degree, pointB.degree);
            score += ratio * this.weights.degree;
            totalWeight += this.weights.degree;
        }
        
        // Треугольники
        if (pointA.triangles && pointB.triangles) {
            const ratio = Math.min(pointA.triangles, pointB.triangles) / 
                         Math.max(pointA.triangles, pointB.triangles);
            score += ratio * this.weights.triangles;
            totalWeight += this.weights.triangles;
        }
        
        return totalWeight > 0 ? score / totalWeight : 0;
    }

    /**
     * Сравнение радиальных профилей
     */
    compareProfiles(profA, profB) {
        if (!profA || !profB) return 0.5;
        
        let sum = 0;
        for (let i = 0; i < Math.min(profA.length, profB.length); i++) {
            const diff = Math.abs(profA[i] - profB[i]);
            sum += 1 - Math.min(diff, 1);
        }
        return sum / Math.min(profA.length, profB.length);
    }

    /**
     * Сравнение ролей соседей
     */
    compareNeighborRoles(rolesA, rolesB) {
        // Упрощенно: сравниваем количество H, R, L
        const getCounts = (roles) => ({
            H: (roles.match(/H/g) || []).length,
            R: (roles.match(/R/g) || []).length,
            L: (roles.match(/L/g) || []).length
        });
        
        const countsA = getCounts(rolesA);
        const countsB = getCounts(rolesB);
        
        let score = 0;
        score += Math.min(countsA.H, countsB.H) / Math.max(countsA.H, countsB.H || 1);
        score += Math.min(countsA.R, countsB.R) / Math.max(countsA.R, countsB.R || 1);
        score += Math.min(countsA.L, countsB.L) / Math.max(countsA.L, countsB.L || 1);
        
        return score / 3;
    }

    /**
     * Адаптивный подбор порога для одной точки
     */
    findBestMatchWithAdaptiveThreshold(pointA, candidates) {
        if (candidates.length === 0) return null;
        
        let threshold = this.initialThreshold;
        let bestMatch = null;
        
        while (threshold <= this.maxThreshold) {
            // Отбираем кандидатов выше порога
            const aboveThreshold = candidates.filter(c => c.score > threshold);
            
            if (aboveThreshold.length === 0) {
                // Нет кандидатов - снижаем порог для следующей итерации
                threshold -= this.stepSize;
                if (threshold < this.minThreshold) break;
                continue;
            }
            
            if (aboveThreshold.length === 1) {
                // ИДЕАЛЬНО! Один кандидат
                bestMatch = aboveThreshold[0];
                bestMatch.adaptiveThreshold = threshold;
                break;
            }
            
            // Несколько кандидатов - повышаем порог
            const gap = aboveThreshold[0].score - aboveThreshold[1].score;
            
            if (gap > 0.15) {
                // Явный лидер, даже при нескольких кандидатах
                bestMatch = aboveThreshold[0];
                bestMatch.adaptiveThreshold = threshold;
                bestMatch.confidence = 'high';
                break;
            }
            
            // Повышаем порог для следующей итерации
            threshold += this.stepSize;
            this.stats.thresholdAdjustments++;
        }
        
        // Если не нашли с адаптивным порогом, берем лучшего с минимальным порогом
        if (!bestMatch && candidates.length > 0) {
            bestMatch = candidates[0];
            bestMatch.adaptiveThreshold = this.minThreshold;
            bestMatch.confidence = 'low';
        }
        
        return bestMatch;
    }

    /**
     * Проверка на конфликты (обратная уникальность)
     */
    validateMatches(matches, pointsA, pointsB) {
        const validMatches = [];
        const usedA = new Set();
        const usedB = new Set();
        
        // Сортируем по убыванию уверенности
        const sorted = [...matches].sort((a, b) => b.score - a.score);
        
        for (const match of sorted) {
            if (!usedA.has(match.pointA) && !usedB.has(match.pointB)) {
                validMatches.push(match);
                usedA.add(match.pointA);
                usedB.add(match.pointB);
            } else {
                this.stats.conflictsResolved++;
                if (this.debug) {
                    console.log(`   ⚠️ Конфликт: ${match.pointA.slice(0,12)} или ${match.pointB.slice(0,12)} уже используются`);
                }
            }
        }
        
        return validMatches;
    }

    /**
     * Вычисление уверенности (0-1)
     */
    calculateConfidence(pointA, pointB) {
        // Комбинируем score с адаптивным порогом
        let confidence = pointB.score;
        
        // Если порог был высоким, повышаем уверенность
        if (pointB.adaptiveThreshold > 0.85) {
            confidence = Math.min(1, confidence * 1.1);
        }
        
        return Math.round(confidence * 100);
    }

    /**
     * Средняя уверенность
     */
    calculateAvgConfidence(matches) {
        if (matches.length === 0) return 0;
        const sum = matches.reduce((acc, m) => acc + m.confidence, 0);
        return (sum / matches.length).toFixed(1);
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
            thresholdAdjustments: 0
        };
    }
}

module.exports = AdaptiveMatcher;
