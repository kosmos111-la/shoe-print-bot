// modules/footprint/point-tracker.js
// 🔥 ИСПРАВЛЕННЫЙ - БЕЗ СПАМА В ЛОГАХ

const crypto = require('crypto');

class PointTracker {
    constructor(options = {}) {
        this.points = new Map();
        this.nextId = 1;
        this.config = {
            ratingDecay: options.ratingDecay || 0.97,
            minRating: options.minRating || 0.1,
            maxRating: options.maxRating || 1.0,
            confirmationThreshold: options.confirmationThreshold || 0.7,
           
            // 🔥 ОТКЛЮЧЕН СПАМ В ЛОГАХ
            debug: options.debug || false,
           
            enableClustering: false,
            clusterRadius: options.clusterRadius || 30,
            minClusterSize: 1,
            adaptiveDistance: options.adaptiveDistance !== false,
            baseDistanceThreshold: options.baseDistanceThreshold || 15,
           
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

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: БЕЗ СПАМА О СОЗДАНИИ КАЖДОЙ ТОЧКИ
    processNewPoints(newPoints, sourceInfo = {}) {
        console.log(`🎯 Обработка ${newPoints.length} точек...`);

        const results = {
            added: 0,
            updated: 0,
            merged: 0,
            skipped: 0,
            points: [],
            photoId: sourceInfo.photoId || 'unknown'
        };

        const photoHash = sourceInfo.photoId ||
                         crypto.createHash('md5').update(JSON.stringify(newPoints)).digest('hex').substring(0, 8);

        // 🔥 ОБРАБОТКА БЕЗ ДЕТАЛЬНОГО ЛОГГИРОВАНИЯ
        newPoints.forEach((point, index) => {
            const nearest = this.findNearestPoint(point, this.config.pointMergeDistance);

            if (nearest) {
                // Проверяем, не подтверждена ли уже эта точка этим фото
                const pointData = this.points.get(nearest.id);
                if (pointData && pointData.confirmedPhotos && pointData.confirmedPhotos.has(photoHash)) {
                    results.skipped++;
                    return; // Пропускаем дубликат
                }

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
                }
            }
        });

        console.log(`📈 Итог: +${results.added} новых, ${results.updated} обновлено, ${results.skipped} пропущено`);
        console.log(`📊 Всего точек в трекере: ${this.points.size}`);

        return results;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: ТИХОЕ СОЗДАНИЕ ТОЧКИ
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
                confirmationType: 'new'
            }],
            confirmedCount: 1,
            lastSeen: new Date(),
            firstSeen: new Date(),
            confirmedPhotos: new Set([sourceInfo.photoId || 'unknown'])
        };

        this.points.set(newPointId, pointData);
       
        // 🔥 ТИХИЙ ЛОГ (только при дебаге)
        if (this.config.debug) {
            console.log(`✅ Создана точка ${newPointId} на (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
        }
       
        return newPointId;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: ТИХОЕ ОБНОВЛЕНИЕ
    _updatePointHonest(pointId, newPoint, sourceInfo = {}) {
        const pointData = this.points.get(pointId);
        if (!pointData) return false;

        const photoHash = sourceInfo.photoId || 'unknown';

        // 🔥 ПРОВЕРКА БЕЗ СПАМА
        if (pointData.confirmedPhotos && pointData.confirmedPhotos.has(photoHash)) {
            return false; // Просто возвращаем false без спама
        }

        // Увеличиваем количество подтверждений
        pointData.confirmedCount = (pointData.confirmedCount || 1) + 1;

        if (!pointData.confirmedPhotos) pointData.confirmedPhotos = new Set();
        pointData.confirmedPhotos.add(photoHash);

        // Обновляем координаты с весом
        const updateDistance = sourceInfo.distance || 0;
        const weight = Math.max(0.1, Math.min(0.9, 1.0 - (updateDistance / 20)));

        pointData.x = pointData.x * (1 - weight) + newPoint.x * weight;
        pointData.y = pointData.y * (1 - weight) + newPoint.y * weight;

        // Обновляем рейтинг
        pointData.rating = this.calculateUpdatedRating(
            pointData.rating,
            newPoint.confidence || 0.5
        );

        pointData.lastSeen = new Date();

        // 🔥 ТИХИЙ ЛОГ (только при дебаге)
        if (this.config.debug) {
            console.log(`🔄 Точка ${pointId}: подтверждений=${pointData.confirmedCount}`);
        }

        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: ОБНОВИТЬ ПОДТВЕРЖДЕНИЯ ИЗ ГЕОМЕТРИЧЕСКОГО СРАВНЕНИЯ
    updateFromGeometricMatches(matches, sourceInfo = {}) {
        if (!matches || matches.length === 0) {
            console.log('📊 Нет совпадений для обновления подтверждений');
            return 0;
        }

        console.log(`🔄 Обновляю подтверждения из ${matches.length} геометрических совпадений...`);

        let updatedCount = 0;
        const photoHash = sourceInfo.photoId || 'geometric_match';

        matches.forEach(match => {
            const point1 = this._findPointById(match.point1?.id || match.point1?.originalId);
            const point2 = this._findPointById(match.point2?.id || match.point2?.originalId);

            // Обновляем первую точку
            if (point1 && point1.id) {
                const pointData = this.points.get(point1.id);
                if (pointData) {
                    if (!pointData.confirmedPhotos || !pointData.confirmedPhotos.has(photoHash)) {
                        pointData.confirmedCount = (pointData.confirmedCount || 1) + 1;
                       
                        if (!pointData.confirmedPhotos) pointData.confirmedPhotos = new Set();
                        pointData.confirmedPhotos.add(photoHash);
                       
                        pointData.rating = Math.min(1.0, pointData.rating + 0.1);
                        pointData.lastSeen = new Date();
                       
                        updatedCount++;
                       
                        if (this.config.debug) {
                            console.log(`   ${point1.id}: ${pointData.confirmedCount} подтверждений (геометрическое совпадение)`);
                        }
                    }
                }
            }

            // Обновляем вторую точку
            if (point2 && point2.id) {
                const pointData = this.points.get(point2.id);
                if (pointData) {
                    if (!pointData.confirmedPhotos || !pointData.confirmedPhotos.has(photoHash)) {
                        pointData.confirmedCount = (pointData.confirmedCount || 1) + 1;
                       
                        if (!pointData.confirmedPhotos) pointData.confirmedPhotos = new Set();
                        pointData.confirmedPhotos.add(photoHash);
                       
                        pointData.rating = Math.min(1.0, pointData.rating + 0.1);
                        pointData.lastSeen = new Date();
                       
                        updatedCount++;
                    }
                }
            }
        });

        console.log(`✅ Обновлено ${updatedCount} точек из геометрических совпадений`);
        return updatedCount;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Найти точку по ID
    _findPointById(pointId) {
        if (!pointId) return null;
       
        // Прямой поиск
        if (this.points.has(pointId)) {
            return { id: pointId, data: this.points.get(pointId) };
        }
       
        // Поиск по originalId
        for (const [id, pointData] of this.points) {
            if (pointData.originalId === pointId || pointData.id === pointId) {
                return { id, data: pointData };
            }
        }
       
        return null;
    }

    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ БЕЗ ИЗМЕНЕНИЙ
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

    calculateUpdatedRating(currentRating, newConfidence) {
        const decayedRating = currentRating * this.config.ratingDecay;
        const updatedRating = decayedRating + (newConfidence * (1 - this.config.ratingDecay));
        return Math.min(this.config.maxRating, Math.max(this.config.minRating, updatedRating));
    }

    getHonestStats() {
        return this.getStats();
    }

    getStats() {
        const stats = {
            totalPoints: this.points.size,
            highConfidencePoints: 0,
            avgRating: 0,
            avgConfirmations: 0,
            uniquePhotos: this.getUniquePhotoCount(),
            pointsByConfirmations: { '1': 0, '2': 0, '3': 0, '4+': 0 }
        };

        let totalRating = 0;
        let totalConfirmations = 0;

        for (const pt of this.points.values()) {
            totalRating += pt.rating;
            totalConfirmations += pt.confirmedCount || 1;

            if (pt.rating >= this.config.confirmationThreshold) {
                stats.highConfidencePoints++;
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
            _version: '4.0-clean-logs',
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
       
        // Восстанавливаем даты
        for (const pt of tracker.points.values()) {
            if (typeof pt.firstSeen === 'string') pt.firstSeen = new Date(pt.firstSeen);
            if (typeof pt.lastSeen === 'string') pt.lastSeen = new Date(pt.lastSeen);
        }
       
        console.log(`✅ Загружен PointTracker, ${tracker.points.size} точек`);
        return tracker;
    }
}

module.exports = PointTracker;
