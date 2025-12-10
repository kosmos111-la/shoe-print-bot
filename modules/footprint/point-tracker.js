// modules/footprint/point-tracker.js
// СИСТЕМА РЕЙТИНГОВ И ИСТОРИИ ПОДТВЕРЖДЕНИЙ ТОЧЕК

class PointTracker {
    constructor(options = {}) {
        this.points = new Map(); // id -> { point, history, rating }
        this.nextId = 1;
        this.config = {
            ratingDecay: options.ratingDecay || 0.95, // Затухание рейтинга со временем
            minRating: options.minRating || 0.1,
            maxRating: options.maxRating || 1.0,
            confirmationThreshold: options.confirmationThreshold || 0.7
        };
    }

    // 1. ДОБАВИТЬ НОВУЮ ТОЧКУ
    addPoint(point, sourceInfo = {}) {
        const pointId = `pt_${this.nextId++}`;
       
        const pointData = {
            id: pointId,
            x: point.x,
            y: point.y,
            confidence: point.confidence || 0.5,
            rating: point.confidence || 0.5,
            history: [{
                timestamp: new Date(),
                source: sourceInfo,
                confidence: point.confidence || 0.5,
                action: 'added'
            }],
            confirmedCount: 0,
            lastSeen: new Date(),
            firstSeen: new Date()
        };
       
        this.points.set(pointId, pointData);
        return pointId;
    }

    // 2. ОБНОВИТЬ СУЩЕСТВУЮЩУЮ ТОЧКУ (подтверждение)
    updatePoint(pointId, newPoint, sourceInfo = {}) {
        const pointData = this.points.get(pointId);
        if (!pointData) return false;
       
        // Увеличить рейтинг при подтверждении
        const newRating = this.calculateUpdatedRating(
            pointData.rating,
            newPoint.confidence || 0.5
        );
       
        // Обновить координаты (средневзвешенное)
        const weight = newPoint.confidence || 0.5;
        const totalWeight = pointData.rating + weight;
       
        pointData.x = (pointData.x * pointData.rating + newPoint.x * weight) / totalWeight;
        pointData.y = (pointData.y * pointData.rating + newPoint.y * weight) / totalWeight;
       
        // Обновить данные
        pointData.rating = newRating;
        pointData.confirmedCount++;
        pointData.lastSeen = new Date();
        pointData.history.push({
            timestamp: new Date(),
            source: sourceInfo,
            confidence: newPoint.confidence || 0.5,
            action: 'confirmed'
        });
       
        return true;
    }

    // 3. РАССЧИТАТЬ ОБНОВЛЁННЫЙ РЕЙТИНГ
    calculateUpdatedRating(currentRating, newConfidence) {
        const decayedRating = currentRating * this.config.ratingDecay;
        const updatedRating = decayedRating +
            (newConfidence * (1 - this.config.ratingDecay));
       
        return Math.min(
            this.config.maxRating,
            Math.max(this.config.minRating, updatedRating)
        );
    }

    // 4. НАЙТИ БЛИЖАЙШУЮ ТОЧКУ
    findNearestPoint(point, maxDistance = 20) {
        let nearest = null;
        let minDistance = Infinity;
        let nearestId = null;
       
        for (const [id, pt] of this.points) {
            const dx = pt.x - point.x;
            const dy = pt.y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
           
            if (distance < minDistance && distance <= maxDistance) {
                minDistance = distance;
                nearest = pt;
                nearestId = id;
            }
        }
       
        return nearest ? { id: nearestId, point: nearest, distance: minDistance } : null;
    }

    // 5. ОБРАБОТАТЬ НОВЫЕ ТОЧКИ (объединение/подтверждение)
    processNewPoints(newPoints, sourceInfo = {}) {
        const results = {
            added: 0,
            updated: 0,
            skipped: 0,
            points: []
        };
       
        newPoints.forEach(newPoint => {
            // Найти ближайшую существующую точку
            const nearest = this.findNearestPoint(newPoint, 15);
           
            if (nearest && nearest.distance < 10) {
                // Обновить существующую точку
                this.updatePoint(nearest.id, newPoint, sourceInfo);
                results.updated++;
                results.points.push({
                    id: nearest.id,
                    action: 'updated',
                    distance: nearest.distance,
                    rating: this.points.get(nearest.id).rating
                });
            } else {
                // Добавить новую точку
                const pointId = this.addPoint(newPoint, sourceInfo);
                results.added++;
                results.points.push({
                    id: pointId,
                    action: 'added',
                    distance: nearest?.distance || null
                });
            }
        });
       
        return results;
    }

    // 6. ПОЛУЧИТЬ ТОЧКИ С ВЫСОКИМ РЕЙТИНГОМ
    getHighConfidencePoints(minRating = 0.7) {
        const highConfidencePoints = [];
       
        for (const [id, pt] of this.points) {
            if (pt.rating >= minRating && pt.confirmedCount >= 2) {
                highConfidencePoints.push({
                    id,
                    x: pt.x,
                    y: pt.y,
                    rating: pt.rating,
                    confirmedCount: pt.confirmedCount,
                    lastSeen: pt.lastSeen
                });
            }
        }
       
        // Отсортировать по рейтингу
        highConfidencePoints.sort((a, b) => b.rating - a.rating);
        return highConfidencePoints;
    }

    // 7. ПОЛУЧИТЬ ВСЕ ТОЧКИ (с фильтрацией)
    getAllPoints(options = {}) {
        const {
            minRating = 0,
            minConfirmations = 0,
            maxAgeDays = Infinity
        } = options;
       
        const points = [];
        const now = new Date();
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
       
        for (const [id, pt] of this.points) {
            // Проверка рейтинга
            if (pt.rating < minRating) continue;
           
            // Проверка подтверждений
            if (pt.confirmedCount < minConfirmations) continue;
           
            // Проверка возраста
            const age = now - pt.lastSeen;
            if (age > maxAgeMs) continue;
           
            points.push({
                id,
                x: pt.x,
                y: pt.y,
                confidence: pt.rating,
                confirmedCount: pt.confirmedCount,
                lastSeen: pt.lastSeen,
                firstSeen: pt.firstSeen
            });
        }
       
        return points;
    }

    // 8. ОЧИСТИТЬ СТАРЫЕ/НЕНАДЁЖНЫЕ ТОЧКИ
    cleanup() {
        const toDelete = [];
        const now = new Date();
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
       
        for (const [id, pt] of this.points) {
            // Удалить точки с низким рейтингом и старые
            if (pt.rating < this.config.minRating && pt.lastSeen < oneWeekAgo) {
                toDelete.push(id);
            }
           
            // Удалить точки без подтверждений старше 2 дней
            if (pt.confirmedCount === 0 && pt.lastSeen < now - (2 * 24 * 60 * 60 * 1000)) {
                toDelete.push(id);
            }
        }
       
        // Удалить найденные точки
        toDelete.forEach(id => this.points.delete(id));
       
        return toDelete.length;
    }

    // 9. СТАТИСТИКА ТОЧЕК
    getStats() {
        const stats = {
            totalPoints: this.points.size,
            highConfidencePoints: 0,
            avgRating: 0,
            avgConfirmations: 0,
            recentlyUpdated: 0
        };
       
        let totalRating = 0;
        let totalConfirmations = 0;
        const now = new Date();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
       
        for (const pt of this.points.values()) {
            totalRating += pt.rating;
            totalConfirmations += pt.confirmedCount;
           
            if (pt.rating >= this.config.confirmationThreshold) {
                stats.highConfidencePoints++;
            }
           
            if (pt.lastSeen > oneDayAgo) {
                stats.recentlyUpdated++;
            }
        }
       
        if (this.points.size > 0) {
            stats.avgRating = totalRating / this.points.size;
            stats.avgConfirmations = totalConfirmations / this.points.size;
        }
       
        // Распределение по рейтингу
        stats.ratingDistribution = {
            low: 0,    // 0-0.3
            medium: 0, // 0.3-0.7
            high: 0    // 0.7-1.0
        };
       
        for (const pt of this.points.values()) {
            if (pt.rating < 0.3) stats.ratingDistribution.low++;
            else if (pt.rating < 0.7) stats.ratingDistribution.medium++;
            else stats.ratingDistribution.high++;
        }
       
        return stats;
    }

    // 10. ЭКСПОРТ ДЛЯ ВИЗУАЛИЗАЦИИ
    exportForVisualization() {
        const points = [];
        const now = new Date();
       
        for (const [id, pt] of this.points) {
            // Рассчитать цвет в зависимости от рейтинга
            let color;
            if (pt.rating > 0.7) color = '#2ed573'; // Зелёный - высокий рейтинг
            else if (pt.rating > 0.4) color = '#ffa502'; // Оранжевый - средний
            else color = '#ff4757'; // Красный - низкий
           
            // Рассчитать размер в зависимости от подтверждений
            const size = 3 + Math.min(pt.confirmedCount, 5);
           
            points.push({
                id,
                x: pt.x,
                y: pt.y,
                color,
                size,
                rating: pt.rating,
                confirmations: pt.confirmedCount,
                ageDays: Math.round((now - pt.firstSeen) / (24 * 60 * 60 * 1000))
            });
        }
       
        return {
            points,
            stats: this.getStats(),
            timestamp: now.toISOString()
        };
    }

    // 11. ВИЗУАЛИЗИРОВАТЬ ТРЕКЕР
    visualize() {
        const stats = this.getStats();
       
        console.log(`\n🎯 ТРЕКЕР ТОЧЕК (${stats.totalPoints} точек):`);
        console.log(`├─ Высоконадёжные: ${stats.highConfidencePoints}`);
        console.log(`├─ Средний рейтинг: ${stats.avgRating.toFixed(3)}`);
        console.log(`├─ Среднее подтверждений: ${stats.avgConfirmations.toFixed(1)}`);
        console.log(`├─ Обновлено за сутки: ${stats.recentlyUpdated}`);
       
        console.log(`\n📊 РАСПРЕДЕЛЕНИЕ ПО РЕЙТИНГУ:`);
        console.log(`├─ Высокий (>0.7): ${stats.ratingDistribution.high}`);
        console.log(`├─ Средний (0.3-0.7): ${stats.ratingDistribution.medium}`);
        console.log(`└─ Низкий (<0.3): ${stats.ratingDistribution.low}`);
       
        // Показать топ-5 точек
        const topPoints = this.getHighConfidencePoints(0.8).slice(0, 5);
        if (topPoints.length > 0) {
            console.log(`\n🏆 ТОП-5 ТОЧЕК:`);
            topPoints.forEach((pt, i) => {
                console.log(`${i+1}. ID: ${pt.id.slice(0, 8)}...`);
                console.log(`   📍 (${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
                console.log(`   ⭐ Рейтинг: ${pt.rating.toFixed(3)}`);
                console.log(`   ✅ Подтверждений: ${pt.confirmedCount}`);
            });
        }
    }

    // 12. СОХРАНИТЬ В JSON
    toJSON() {
        const data = {
            points: Array.from(this.points.entries()),
            nextId: this.nextId,
            config: this.config,
            _version: '1.0',
            _savedAt: new Date().toISOString()
        };
       
        return data;
    }

    // 13. ЗАГРУЗИТЬ ИЗ JSON
    static fromJSON(data) {
        const tracker = new PointTracker(data.config || {});
       
        if (Array.isArray(data.points)) {
            tracker.points = new Map(data.points);
        }
       
        tracker.nextId = data.nextId || 1;
       
        // Восстановить даты из строк
        for (const pt of tracker.points.values()) {
            if (typeof pt.firstSeen === 'string') {
                pt.firstSeen = new Date(pt.firstSeen);
            }
            if (typeof pt.lastSeen === 'string') {
                pt.lastSeen = new Date(pt.lastSeen);
            }
            if (Array.isArray(pt.history)) {
                pt.history.forEach(record => {
                    if (typeof record.timestamp === 'string') {
                        record.timestamp = new Date(record.timestamp);
                    }
                });
            }
        }
       
        return tracker;
    }
}

module.exports = PointTracker;
