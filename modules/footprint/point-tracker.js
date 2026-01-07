// modules/footprint/point-tracker.js - УЛУЧШЕННАЯ ВЕРСИЯ С КЛАСТЕРИЗАЦИЕЙ
// СИСТЕМА РЕЙТИНГОВ И ИСТОРИИ ПОДТВЕРЖДЕНИЙ ТОЧЕК

class PointTracker {
    constructor(options = {}) {
        this.points = new Map(); // id -> { point, history, rating }
        this.nextId = 1;
        this.config = {
            ratingDecay: options.ratingDecay || 0.95, // Затухание рейтинга со временем
            minRating: options.minRating || 0.1,
            maxRating: options.maxRating || 1.0,
            confirmationThreshold: options.confirmationThreshold || 0.7,

            // 🔥 ИСПРАВЛЕНО: Оптимальные настройки для обновления существующих точек
            adaptiveDistance: options.adaptiveDistance !== false,
            baseDistanceThreshold: options.baseDistanceThreshold || 25, // Увеличили с 15
            enableClustering: options.enableClustering !== false,
            clusterRadius: options.clusterRadius || 30, // Увеличили с 20
            minClusterSize: options.minClusterSize || 2,
            bonusForClusters: options.bonusForClusters !== false,

            // 🔥 НОВЫЕ НАСТРОЙКИ
            directUpdateThreshold: options.directUpdateThreshold || 25,   // Порог для прямого обновления увеличен
            forceUpdateOnMerge: options.forceUpdateOnMerge || true     // Принудительное обновление при слиянии
        };
    }

    // 🔥 УЛУЧШЕННЫЙ МЕТОД: ОБРАБОТКА С КЛАСТЕРИЗАЦИЕЙ И ПРЕДВАРИТЕЛЬНЫМ ОБНОВЛЕНИЕМ
    processNewPoints(newPoints, sourceInfo = {}) {
        console.log(`🎯 Обрабатываю ${newPoints.length} точек с оптимизированной кластеризацией...`);

        // 🔥 ДОБАВЛЕНО: Принудительное обновление для существующих точек
        const results = {
            added: 0,
            updated: 0,
            merged: 0,
            skipped: 0,
            clusters: 0,
            points: []
        };

        // Шаг 0: 🔥 ПРЕДВАРИТЕЛЬНОЕ ОБНОВЛЕНИЕ существующих точек
        const updateStats = this._preUpdateExistingPoints(newPoints, this.config.directUpdateThreshold);
        results.updated += updateStats.updated;

        // Шаг 1: Кластеризация новых точек
        const clusters = this.clusterPoints(newPoints, this.config.clusterRadius, this.config.minClusterSize);
        console.log(`📊 Образовано ${clusters.length} кластеров из ${newPoints.length} точек`);
        results.clusters = clusters.length;

        // Шаг 2: Обработка каждого кластера
        clusters.forEach((cluster, clusterIndex) => {
            if (cluster.points.length === 0) return;

            // Центр кластера
            const clusterCenter = this.calculateClusterCenter(cluster.points);
            const clusterSize = cluster.points.length;

            // Адаптивный порог для больших кластеров
            const adaptiveThreshold = this.getAdaptiveThreshold(clusterSize);

            // Ищем ближайшую существующую точку
            const nearest = this.findNearestPoint(clusterCenter, adaptiveThreshold);

            if (nearest) {
                // 🔥 УЛУЧШЕННОЕ ОБНОВЛЕНИЕ: больше подтверждений для больших кластеров
                const existingPoint = this.points.get(nearest.id);

                // Количество подтверждений = размер кластера (но не больше 5)
                const bonusConfirmations = Math.min(3, Math.floor(clusterSize / 2));

                // Обновляем точку данными кластера
                for (let i = 0; i < bonusConfirmations; i++) {
                    this._legacyUpdatePoint(nearest.id, {
                        x: clusterCenter.x,
                        y: clusterCenter.y,
                        confidence: Math.max(0.7, existingPoint.rating + 0.1)
                    }, {
                        ...sourceInfo,
                        clusterSize: clusterSize,
                        clusterIndex: clusterIndex
                    });
                }

                // Улучшаем позицию (взвешенное среднее)
                const totalConfirmations = existingPoint.confirmedCount + bonusConfirmations;
                existingPoint.x = (existingPoint.x * existingPoint.confirmedCount +
                                 clusterCenter.x * bonusConfirmations) / totalConfirmations;
                existingPoint.y = (existingPoint.y * existingPoint.confirmedCount +
                                 clusterCenter.y * bonusConfirmations) / totalConfirmations;

                results.updated++;
                results.merged += clusterSize;

                console.log(`   ✅ Кластер ${clusterIndex}: обновлена точка ${nearest.id}, ` +
                          `+${bonusConfirmations} подтверждений, размер кластера: ${clusterSize}`);

                results.points.push({
                    id: nearest.id,
                    action: 'cluster_updated',
                    clusterSize: clusterSize,
                    bonusConfirmations: bonusConfirmations,
                    distance: nearest.distance,
                    rating: existingPoint.rating
                });

            } else {
                // 🔥 СОЗДАНИЕ НОВОЙ ТОЧКИ НА ОСНОВЕ КЛАСТЕРА
                const newPointId = `pt_${this.nextId++}`;
                const baseConfidence = Math.min(0.8, 0.5 + (clusterSize * 0.05));
                const confirmations = Math.max(1, Math.min(5, Math.floor(clusterSize / 2)));

                const pointData = {
                    id: newPointId,
                    x: clusterCenter.x,
                    y: clusterCenter.y,
                    confidence: baseConfidence,
                    rating: baseConfidence,
                    history: [{
                        timestamp: new Date(),
                        source: { ...sourceInfo, clusterSize, clusterIndex },
                        confidence: baseConfidence,
                        action: 'cluster_added'
                    }],
                    confirmedCount: confirmations, // 🔥 НАЧАЛЬНЫЕ ПОДТВЕРЖДЕНИЯ!
                    lastSeen: new Date(),
                    firstSeen: new Date(),
                    clusterOrigin: true,
                    clusterSize: clusterSize
                };

                this.points.set(newPointId, pointData);
                results.added++;

                console.log(`   🆕 Кластер ${clusterIndex}: создана точка ${newPointId}, ` +
                          `подтверждений: ${confirmations}, размер кластера: ${clusterSize}`);

                results.points.push({
                    id: newPointId,
                    action: 'cluster_added',
                    clusterSize: clusterSize,
                    confirmations: confirmations
                });
            }
        });

        // Шаг 3: Обработка одиночных точек (не вошедших в кластеры)
        const singlePoints = this.findSinglePoints(newPoints, clusters);
        if (singlePoints.length > 0) {
            console.log(`📌 Обрабатываю ${singlePoints.length} одиночных точек...`);

            singlePoints.forEach(singlePoint => {
                const nearest = this.findNearestPoint(singlePoint, 15);

                if (nearest && nearest.distance < 12) {
                    this.updatePoint(nearest.id, singlePoint, sourceInfo);
                    results.updated++;
                } else {
                    this.addPoint(singlePoint, sourceInfo);
                    results.added++;
                }
            });
        }

        console.log(`📈 Итог: +${results.added} новых, ${results.updated} обновлено, ` +
                   `${results.merged} точек объединено в кластеры`);

        return results;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Предварительное обновление существующих точек
    _preUpdateExistingPoints(newPoints, maxDistance = 25) {
        let updated = 0;

        // 🔥 ИСПОЛЬЗУЕМ БОЛЕЕ АГРЕССИВНЫЙ ПОДХОД
        const aggressiveThreshold = 30; // Увеличиваем порог

        for (const [id, existingPoint] of this.points) {
            let nearestNewPoint = null;
            let minDistance = Infinity;

            for (const newPoint of newPoints) {
                const dx = newPoint.x - existingPoint.x;
                const dy = newPoint.y - existingPoint.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance && distance <= aggressiveThreshold) {
                    minDistance = distance;
                    nearestNewPoint = newPoint;
                }
            }

            // 🔥 УМЕНЬШЕН ПОРОГ ДЛЯ ОБНОВЛЕНИЯ
            if (nearestNewPoint && minDistance < 25) { // Было 15
                // Обновляем существующую точку
                this.updatePoint(id, nearestNewPoint, {
                    source: 'direct_update',
                    distance: minDistance,
                    timestamp: new Date()
                });
                updated++;
                console.log(`   🔄 Прямое обновление точки ${id} (расстояние: ${minDistance.toFixed(1)})`);
            }
        }

        console.log(`📊 Предварительно обновлено ${updated} существующих точек`);
        return { updated };
    }

    // 🔥 МЕТОД КЛАСТЕРИЗАЦИИ (DBSCAN упрощенный)
    clusterPoints(points, eps = 20, minPts = 2) {
        if (points.length === 0) return [];

        const clusters = [];
        const visited = new Set();

        points.forEach((point, index) => {
            if (visited.has(index)) return;

            visited.add(index);

            // Находим соседей
            const neighbors = this.findNeighbors(points, index, eps);

            if (neighbors.length >= minPts) {
                // Формируем кластер
                const cluster = { points: [point] };
                let neighborIndex = 0;

                while (neighborIndex < neighbors.length) {
                    const neighborIdx = neighbors[neighborIndex];

                    if (!visited.has(neighborIdx)) {
                        visited.add(neighborIdx);
                        cluster.points.push(points[neighborIdx]);

                        // Добавляем соседей соседа
                        const neighborNeighbors = this.findNeighbors(points, neighborIdx, eps);
                        if (neighborNeighbors.length >= minPts) {
                            neighbors.push(...neighborNeighbors.filter(n => !visited.has(n)));
                        }
                    }

                    neighborIndex++;
                }

                clusters.push(cluster);
            }
        });

        // Одиночные точки тоже как кластеры из 1 точки
        points.forEach((point, index) => {
            if (!visited.has(index)) {
                clusters.push({ points: [point] });
            }
        });

        return clusters;
    }

    findNeighbors(points, pointIndex, eps) {
        const point = points[pointIndex];
        const neighbors = [];

        points.forEach((p, idx) => {
            if (idx === pointIndex) return;

            const distance = Math.sqrt(
                Math.pow(p.x - point.x, 2) +
                Math.pow(p.y - point.y, 2)
            );

            if (distance <= eps) {
                neighbors.push(idx);
            }
        });

        return neighbors;
    }

    calculateClusterCenter(clusterPoints) {
        const sumX = clusterPoints.reduce((sum, p) => sum + p.x, 0);
        const sumY = clusterPoints.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / clusterPoints.length,
            y: sumY / clusterPoints.length
        };
    }

    findSinglePoints(allPoints, clusters) {
        // Находим точки, которые не вошли в кластеры
        const clusteredPoints = new Set();

        clusters.forEach(cluster => {
            cluster.points.forEach(point => {
                // Находим индекс точки в оригинальном массиве
                const index = allPoints.findIndex(p =>
                    Math.abs(p.x - point.x) < 0.1 &&
                    Math.abs(p.y - point.y) < 0.1
                );
                if (index !== -1) {
                    clusteredPoints.add(index);
                }
            });
        });

        // Возвращаем некластеризованные точки
        return allPoints.filter((_, index) => !clusteredPoints.has(index));
    }

    // 🔥 АДАПТИВНЫЙ ПОРОГ ДЛЯ РАЗНЫХ КЛАСТЕРОВ
    getAdaptiveThreshold(clusterSize) {
        let baseThreshold = this.config.baseDistanceThreshold;

        if (!this.config.adaptiveDistance) return baseThreshold;

        // Большие кластеры = более либеральный порог
        if (clusterSize >= 5) {
            return baseThreshold * 1.5;
        } else if (clusterSize >= 3) {
            return baseThreshold * 1.3;
        } else if (clusterSize === 1) {
            return baseThreshold * 0.8; // Одиночные точки - строже
        }

        return baseThreshold;
    }

    // 🔥 МЕТОД: ПРИНУДИТЕЛЬНОЕ ПОВЫШЕНИЕ ПОДТВЕРЖДЕНИЙ
    boostConfirmations(minConfirmations = 2) {
        console.log(`🚀 Повышаю подтверждения для точек с < ${minConfirmations} подтверждений...`);

        let boosted = 0;

        for (const [id, point] of this.points) {
            if (point.confirmedCount < minConfirmations) {
                const boostAmount = minConfirmations - point.confirmedCount;
                point.confirmedCount += boostAmount;
                point.rating = Math.min(1.0, point.rating + (boostAmount * 0.15));

                boosted++;
                console.log(`   📈 Точка ${id}: +${boostAmount} подтверждений, ` +
                          `стало: ${point.confirmedCount}, рейтинг: ${point.rating.toFixed(2)}`);
            }
        }

        if (boosted > 0) {
            console.log(`✅ Повышено ${boosted} точек до минимум ${minConfirmations} подтверждений`);
        }

        return boosted;
    }

    // 🔥 МЕТОД: ПОЛУЧИТЬ СТАТИСТИКУ С КЛАСТЕРАМИ
    getEnhancedStats() {
        const basicStats = this.getStats();

        // Статистика по кластерам
        let clusterPoints = 0;
        let singlePoints = 0;

        for (const point of this.points.values()) {
            if (point.clusterOrigin) {
                clusterPoints++;
            } else {
                singlePoints++;
            }
        }

        return {
            ...basicStats,
            clusterPoints,
            singlePoints,
            clusterRatio: this.points.size > 0 ? clusterPoints / this.points.size : 0,
            avgClusterSize: clusterPoints > 0 ?
                (Array.from(this.points.values()).reduce((sum, pt) => sum + (pt.clusterSize || 1), 0) / clusterPoints) : 1
        };
    }

    // 🔥 МЕТОД: ПОЛУЧИТЬ ВЫСОКОНАДЁЖНЫЕ ТОЧКИ С КЛАСТЕРАМИ
    getHighConfidencePointsWithClusters(minRating = 0.7, minConfirmations = 2) {
        const points = [];

        for (const [id, pt] of this.points) {
            if (pt.rating >= minRating && pt.confirmedCount >= minConfirmations) {
                points.push({
                    id,
                    x: pt.x,
                    y: pt.y,
                    rating: pt.rating,
                    confirmedCount: pt.confirmedCount,
                    lastSeen: pt.lastSeen,
                    isCluster: pt.clusterOrigin || false,
                    clusterSize: pt.clusterSize || 1
                });
            }
        }

        // Сортировка: сначала кластерные точки, потом по рейтингу
        points.sort((a, b) => {
            if (a.isCluster && !b.isCluster) return -1;
            if (!a.isCluster && b.isCluster) return 1;
            return b.rating - a.rating;
        });

        return points;
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
        return this._legacyUpdatePoint(pointId, newPoint, sourceInfo);
    }

    _legacyUpdatePoint(pointId, newPoint, sourceInfo = {}) {
        const pointData = this.points.get(pointId);
        if (!pointData) return false;

        const newRating = this.calculateUpdatedRating(
            pointData.rating,
            newPoint.confidence || 0.5
        );

        const weight = newPoint.confidence || 0.5;
        const totalWeight = pointData.rating + weight;

        pointData.x = (pointData.x * pointData.rating + newPoint.x * weight) / totalWeight;
        pointData.y = (pointData.y * pointData.rating + newPoint.y * weight) / totalWeight;

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

    // 5. ОБРАБОТАТЬ НОВЫЕ ТОЧКИ (совместимый метод для старого кода)
    _legacyProcessNewPoints(newPoints, sourceInfo = {}) {
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
