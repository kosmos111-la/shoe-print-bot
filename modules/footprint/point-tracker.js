// modules/footprint/point-tracker.js - ВЕРСИЯ С МЕТОДОМ getHonestStats()

const crypto = require('crypto');

class PointTracker {
    constructor(options = {}) {
        this.points = new Map(); // id -> { point, history, rating }
        this.nextId = 1;
        this.config = {
            ratingDecay: options.ratingDecay || 0.97,
            minRating: options.minRating || 0.1,
            maxRating: options.maxRating || 1.0,
            confirmationThreshold: options.confirmationThreshold || 0.7,

            // 🔥 ОТКЛЮЧЕНА КЛАСТЕРИЗАЦИЯ
            enableClustering: false,
            clusterRadius: options.clusterRadius || 30,
            minClusterSize: 1,
            adaptiveDistance: options.adaptiveDistance !== false,
            baseDistanceThreshold: options.baseDistanceThreshold || 15,
            bonusForClusters: false,

            // Настройки обработки точек
            directUpdateThreshold: options.directUpdateThreshold || 15,
            forceUpdateOnMerge: false,
            honestConfirmations: true,
            maxConfirmationsPerPhoto: 1,
           
            pointMergeDistance: options.pointMergeDistance || 10,
            newPointThreshold: options.newPointThreshold || 8,
            exactMatchMode: options.exactMatchMode !== false
        };
    }

    // 🔥 ВОССТАНОВЛЕННЫЙ МЕТОД ДЛЯ СОВМЕСТИМОСТИ
    getHonestStats() {
        return this.getStats(); // Просто возвращаем обычную статистику
    }

    // 🔥 ПЕРЕПИСАННЫЙ ГЛАВНЫЙ МЕТОД
    processNewPoints(newPoints, sourceInfo = {}) {
        console.log(`🎯 Обработка ${newPoints.length} точек (БЕЗ кластеризации)...`);

        const results = {
            added: 0,
            updated: 0,
            merged: 0,
            skipped: 0,
            clusters: 0,
            points: [],
            photoId: sourceInfo.photoId || 'unknown'
        };

        const photoHash = sourceInfo.photoId ||
                         crypto.createHash('md5').update(JSON.stringify(newPoints)).digest('hex').substring(0, 8);

        // 🔥 ШАГ 1: Прямая обработка КАЖДОЙ точки
        newPoints.forEach((point, index) => {
            const nearest = this.findNearestPoint(point, this.config.pointMergeDistance);

            if (nearest) {
                const updateSuccess = this._updatePointHonest(
                    nearest.id,
                    point,
                    {
                        ...sourceInfo,
                        confirmationType: 'direct',
                        photoId: photoHash,
                        pointIndex: index,
                        distance: nearest.distance
                    }
                );

                if (updateSuccess) {
                    results.updated++;
                    results.merged++;
                    results.points.push({
                        id: nearest.id,
                        action: 'direct_update',
                        distance: nearest.distance,
                        photoId: photoHash
                    });
                } else {
                    results.skipped++;
                }
            } else {
                const distanceToNearest = this._getDistanceToNearestExistingPoint(point);
               
                if (distanceToNearest < this.config.newPointThreshold) {
                    results.skipped++;
                } else {
                    const newPointId = this._createNewPoint(point, {
                        ...sourceInfo,
                        photoId: photoHash,
                        pointIndex: index
                    });
                   
                    results.added++;
                    results.points.push({
                        id: newPointId,
                        action: 'new_point',
                        distanceToNearest: distanceToNearest,
                        photoId: photoHash
                    });
                }
            }
        });

        console.log(`📈 Итог: +${results.added} новых, ${results.updated} обновлено, ${results.skipped} пропущено`);
        console.log(`📊 Всего точек в трекере: ${this.points.size}`);

        return results;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД
    _getDistanceToNearestExistingPoint(point) {
        let minDistance = Infinity;
       
        for (const [, pt] of this.points) {
            const dx = pt.x - point.x;
            const dy = pt.y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
           
            if (distance < minDistance) {
                minDistance = distance;
            }
        }
       
        return minDistance === Infinity ? 1000 : minDistance;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД
    _createNewPoint(point, sourceInfo = {}) {
        const newPointId = `pt_${this.nextId++}`;
       
        const pointData = {
            id: newPointId,
            x: point.x,
            y: point.y,
            confidence: point.confidence || 0.5,
            rating: point.confidence || 0.5,
            history: [{
                timestamp: new Date(),
                source: sourceInfo,
                confidence: point.confidence || 0.5,
                action: 'created',
                confirmationType: 'new',
                photoCount: 1
            }],
            confirmedCount: 1,
            clusterConfirmations: [{
                timestamp: new Date(),
                source: sourceInfo.source || 'unknown',
                photoId: sourceInfo.photoId,
                clusterSize: 1,
                confirmationIndex: 0
            }],
            lastSeen: new Date(),
            firstSeen: new Date(),
            confirmedPhotos: new Set([sourceInfo.photoId || 'unknown']),
            clusterOrigin: false
        };

        this.points.set(newPointId, pointData);
        console.log(`✅ Создана точка ${newPointId} на (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
        return newPointId;
    }

    // 🔥 ОБНОВЛЕНИЕ ТОЧКИ
    _updatePointHonest(pointId, newPoint, sourceInfo = {}) {
        const pointData = this.points.get(pointId);
        if (!pointData) return false;

        const photoHash = sourceInfo.photoId || 'unknown';
       
        if (pointData.confirmedPhotos && pointData.confirmedPhotos.has(photoHash)) {
            console.log(`⚠️ Точка ${pointId} уже подтверждена фото ${photoHash}, пропускаем`);
            return false;
        }

        pointData.confirmedCount = (pointData.confirmedCount || 1) + 1;
       
        if (!pointData.confirmedPhotos) pointData.confirmedPhotos = new Set();
        pointData.confirmedPhotos.add(photoHash);

        if (!pointData.clusterConfirmations) pointData.clusterConfirmations = [];
        pointData.clusterConfirmations.push({
            timestamp: new Date(),
            source: sourceInfo.source || 'unknown',
            photoId: photoHash,
            clusterSize: 1,
            confirmationIndex: pointData.confirmedCount - 1,
            distance: sourceInfo.distance || 0
        });

        const updateDistance = sourceInfo.distance || 0;
        const weight = Math.max(0.1, Math.min(0.9, 1.0 - (updateDistance / 20)));
       
        pointData.x = pointData.x * (1 - weight) + newPoint.x * weight;
        pointData.y = pointData.y * (1 - weight) + newPoint.y * weight;
       
        pointData.rating = this.calculateUpdatedRating(
            pointData.rating,
            newPoint.confidence || 0.5
        );
       
        pointData.lastSeen = new Date();
        pointData.history.push({
            timestamp: new Date(),
            source: sourceInfo,
            confidence: newPoint.confidence || 0.5,
            action: 'confirmed',
            confirmationType: 'honest',
            photoCount: 1,
            currentConfirmations: pointData.confirmedCount,
            updateWeight: weight,
            distance: updateDistance
        });

        return true;
    }

    // 🔥 ПОИСК БЛИЖАЙШЕЙ ТОЧКИ
    findNearestPoint(point, maxDistance = 15) {
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

        return nearest ? {
            id: nearestId,
            point: nearest,
            distance: minDistance
        } : null;
    }

    // 🔥 МЕТОД КЛАСТЕРИЗАЦИИ (для совместимости)
    clusterPoints(points, eps = 20, minPts = 2) {
        if (!this.config.enableClustering) {
            return points.map(point => ({
                points: [point],
                center: point
            }));
        }
       
        if (points.length === 0) return [];
        // ... (старая логика кластеризации)
        return [];
    }

    calculateClusterCenter(clusterPoints) {
        if (!clusterPoints || clusterPoints.length === 0) {
            return { x: 0, y: 0 };
        }
        const sumX = clusterPoints.reduce((sum, p) => sum + p.x, 0);
        const sumY = clusterPoints.reduce((sum, p) => sum + p.y, 0);
        return {
            x: sumX / clusterPoints.length,
            y: sumY / clusterPoints.length
        };
    }

    findSinglePoints(allPoints, clusters) {
        if (!this.config.enableClustering) return allPoints;
        const clusteredPoints = new Set();
        clusters.forEach(cluster => {
            cluster.points.forEach(point => {
                const index = allPoints.findIndex(p =>
                    Math.abs(p.x - point.x) < 0.1 &&
                    Math.abs(p.y - point.y) < 0.1
                );
                if (index !== -1) clusteredPoints.add(index);
            });
        });
        return allPoints.filter((_, index) => !clusteredPoints.has(index));
    }

    calculateUpdatedRating(currentRating, newConfidence) {
        const decayedRating = currentRating * this.config.ratingDecay;
        const updatedRating = decayedRating + (newConfidence * (1 - this.config.ratingDecay));
        return Math.min(this.config.maxRating, Math.max(this.config.minRating, updatedRating));
    }

    // 🔥 ОСНОВНОЙ МЕТОД СТАТИСТИКИ
    getStats() {
        const stats = {
            totalPoints: this.points.size,
            highConfidencePoints: 0,
            avgRating: 0,
            avgConfirmations: 0,
            recentlyUpdated: 0,
            uniquePhotos: this.getUniquePhotoCount(),
            pointsByConfirmations: { '1': 0, '2': 0, '3': 0, '4+': 0 }
        };

        let totalRating = 0;
        let totalConfirmations = 0;
        const now = new Date();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        for (const pt of this.points.values()) {
            totalRating += pt.rating;
            totalConfirmations += pt.confirmedCount || 1;

            if (pt.rating >= this.config.confirmationThreshold) {
                stats.highConfidencePoints++;
            }

            if (pt.lastSeen > oneDayAgo) {
                stats.recentlyUpdated++;
            }

            const confirmations = pt.confirmedCount || 1;
            if (confirmations === 1) stats.pointsByConfirmations['1']++;
            else if (confirmations === 2) stats.pointsByConfirmations['2']++;
            else if (confirmations === 3) stats.pointsByConfirmations['3']++;
            else stats.pointsByConfirmations['4+']++;
        }

        if (this.points.size > 0) {
            stats.avgRating = totalRating / this.points.size;
            stats.avgConfirmations = totalConfirmations / this.points.size;
        }

        return stats;
    }

    getUniquePhotoCount() {
        const photoSet = new Set();
        for (const point of this.points.values()) {
            if (point.confirmedPhotos) {
                point.confirmedPhotos.forEach(photoId => photoSet.add(photoId));
            }
        }
        return photoSet.size;
    }

    getAllPoints(options = {}) {
        const { minRating = 0, minConfirmations = 0, maxAgeDays = Infinity } = options;
        const points = [];
        const now = new Date();
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

        for (const [id, pt] of this.points) {
            if (pt.rating < minRating) continue;
            if (pt.confirmedCount < minConfirmations) continue;
            const age = now - pt.lastSeen;
            if (age > maxAgeMs) continue;

            points.push({
                id,
                x: pt.x,
                y: pt.y,
                confidence: pt.rating,
                confirmedCount: pt.confirmedCount,
                uniquePhotos: pt.confirmedPhotos ? pt.confirmedPhotos.size : 1,
                lastSeen: pt.lastSeen,
                firstSeen: pt.firstSeen,
                type: 'tracked',
                source: 'point_tracker'
            });
        }

        return points;
    }

    getPointsForTemplateMatching() {
        const templatePoints = [];
        for (const [id, pt] of this.points) {
            templatePoints.push({
                id: id,
                x: Math.round(pt.x * 100) / 100,
                y: Math.round(pt.y * 100) / 100,
                confidence: pt.rating,
                confirmations: pt.confirmedCount || 1,
                source: 'tracker'
            });
        }
        console.log(`📋 Подготовлено ${templatePoints.length} точек для сравнения с шаблоном`);
        return templatePoints;
    }

    compareWithTemplate(templatePoints, tolerance = 10) {
        const matches = [];
        const unmatchedTemplate = [];
        const unmatchedTracker = [];
       
        const trackerPoints = this.getPointsForTemplateMatching();
       
        templatePoints.forEach(templatePoint => {
            let matched = false;
            for (const trackerPoint of trackerPoints) {
                const distance = Math.sqrt(
                    Math.pow(templatePoint.x - trackerPoint.x, 2) +
                    Math.pow(templatePoint.y - trackerPoint.y, 2)
                );
                if (distance <= tolerance) {
                    matches.push({
                        template: templatePoint,
                        tracker: trackerPoint,
                        distance: distance,
                        matchQuality: 1.0 - (distance / tolerance)
                    });
                    matched = true;
                    break;
                }
            }
            if (!matched) unmatchedTemplate.push(templatePoint);
        });
       
        trackerPoints.forEach(trackerPoint => {
            let matched = false;
            for (const templatePoint of templatePoints) {
                const distance = Math.sqrt(
                    Math.pow(trackerPoint.x - templatePoint.x, 2) +
                    Math.pow(trackerPoint.y - templatePoint.y, 2)
                );
                if (distance <= tolerance) {
                    matched = true;
                    break;
                }
            }
            if (!matched) unmatchedTracker.push(trackerPoint);
        });
       
        const stats = {
            totalTemplatePoints: templatePoints.length,
            totalTrackerPoints: trackerPoints.length,
            matches: matches.length,
            unmatchedTemplate: unmatchedTemplate.length,
            unmatchedTracker: unmatchedTracker.length,
            matchRate: templatePoints.length > 0 ? (matches.length / templatePoints.length) * 100 : 0,
            coverageRate: trackerPoints.length > 0 ? (matches.length / trackerPoints.length) * 100 : 0
        };
       
        console.log(`\n🔄 СРАВНЕНИЕ С ШАБЛОНОМ:`);
        console.log(`├─ Шаблон: ${stats.totalTemplatePoints} точек`);
        console.log(`├─ Трекер: ${stats.totalTrackerPoints} точек`);
        console.log(`├─ Совпадений: ${stats.matches} (${stats.matchRate.toFixed(1)}%)`);
        console.log(`├─ Не совпало в шаблоне: ${stats.unmatchedTemplate}`);
        console.log(`└─ Лишние в трекере: ${stats.unmatchedTracker}`);
       
        return { matches, unmatchedTemplate, unmatchedTracker, stats };
    }

    visualize() {
        const stats = this.getStats();
        console.log(`\n🎯 POINT TRACKER (БЕЗ кластеризации):`);
        console.log(`├─ Всего точек: ${stats.totalPoints}`);
        console.log(`├─ Уникальных фото: ${stats.uniquePhotos}`);
        console.log(`├─ Средний рейтинг: ${stats.avgRating.toFixed(3)}`);
        console.log(`├─ Среднее подтверждений: ${stats.avgConfirmations.toFixed(2)}`);
        console.log(`\n📊 РАСПРЕДЕЛЕНИЕ ПОДТВЕРЖДЕНИЙ:`);
        console.log(`├─ 1 подтверждение: ${stats.pointsByConfirmations['1']}`);
        console.log(`├─ 2 подтверждения: ${stats.pointsByConfirmations['2']}`);
        console.log(`├─ 3 подтверждения: ${stats.pointsByConfirmations['3']}`);
        console.log(`└─ 4+ подтверждений: ${stats.pointsByConfirmations['4+']}`);
    }

    toJSON() {
        const pointsArray = Array.from(this.points.entries()).map(([id, point]) => {
            const serializedPoint = { ...point };
            if (serializedPoint.confirmedPhotos) {
                serializedPoint.confirmedPhotos = Array.from(serializedPoint.confirmedPhotos);
            }
            return [id, serializedPoint];
        });

        const data = {
            points: pointsArray,
            nextId: this.nextId,
            config: this.config,
            _version: '3.1-with-honeststats',
            _savedAt: new Date().toISOString()
        };
        return data;
    }

    static fromJSON(data) {
        const tracker = new PointTracker(data.config || {});
        if (Array.isArray(data.points)) {
            data.points.forEach(([id, pointData]) => {
                if (Array.isArray(pointData.confirmedPhotos)) {
                    pointData.confirmedPhotos = new Set(pointData.confirmedPhotos);
                }
                tracker.points.set(id, pointData);
            });
        }
        tracker.nextId = data.nextId || 1;
        for (const pt of tracker.points.values()) {
            if (typeof pt.firstSeen === 'string') pt.firstSeen = new Date(pt.firstSeen);
            if (typeof pt.lastSeen === 'string') pt.lastSeen = new Date(pt.lastSeen);
        }
        console.log(`✅ Загружен PointTracker, ${tracker.points.size} точек`);
        return tracker;
    }
}

module.exports = PointTracker;
