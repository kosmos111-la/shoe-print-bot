// modules/footprint/point-tracker.js
// 🔥 УПРОЩЕННЫЙ - ДЛЯ СОВМЕСТИМОСТИ С АККУМУЛЯТОРОМ

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

            // 🔥 МИНИМАЛЬНЫЙ ЛОГГИНГ
            debug: options.debug || false,

            // Простые настройки
            pointMergeDistance: options.pointMergeDistance || 15,
            newPointThreshold: options.newPointThreshold || 10,
            exactMatchMode: false // 🔥 ОТКЛЮЧАЕМ ТОЧНЫЕ СОВПАДЕНИЯ
        };
    }

    // 🔥 УПРОЩЕННЫЙ МЕТОД: ОБРАБОТКА НОВЫХ ТОЧЕК
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

        // 🔥 ПРОСТАЯ ОБРАБОТКА
        newPoints.forEach((point, index) => {
            // Пытаемся найти ближайшую точку
            const nearest = this.findNearestPoint(point, this.config.pointMergeDistance);

            if (nearest) {
                // 🔥 ПРОВЕРЯЕМ, ЕСТЬ ЛИ ГЕОМЕТРИЧЕСКИЙ ХЕШ
                if (point.geometricHash && nearest.point.geometricHash === point.geometricHash) {
                    // ГЕОМЕТРИЧЕСКОЕ СОВПАДЕНИЕ - обновляем
                    const updateSuccess = this._updatePointSimple(
                        nearest.id,
                        point,
                        {
                            ...sourceInfo,
                            photoId: photoHash,
                            distance: nearest.distance,
                            geometricMatch: true
                        }
                    );

                    if (updateSuccess) {
                        results.updated++;
                        results.merged++;
                    } else {
                        results.skipped++;
                    }
                } else {
                    // Пространственное совпадение
                    const updateSuccess = this._updatePointSimple(
                        nearest.id,
                        point,
                        {
                            ...sourceInfo,
                            photoId: photoHash,
                            distance: nearest.distance
                        }
                    );

                    if (updateSuccess) {
                        results.updated++;
                        results.merged++;
                    } else {
                        results.skipped++;
                    }
                }
            } else {
                // 🔥 НОВАЯ ТОЧКА
                const distanceToNearest = this._getDistanceToNearestExistingPoint(point);

                if (distanceToNearest < this.config.newPointThreshold) {
                    results.skipped++;
                } else {
                    const newPointId = this._createNewPointSimple(point, {
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

    // 🔥 НОВЫЙ МЕТОД: Обновить подтверждения из геометрических совпадений
    updateConfirmationsFromGeometricMatches(matches, sourceInfo = {}) {
        console.log(`🔄 Обновляю подтверждения из ${matches.length} геометрических совпадений`);

        let updated = 0;

        matches.forEach(match => {
            if (match.point1 && match.point1.geometricHash) {
                const point = this.findPointByGeometricHash(match.point1.geometricHash);
                if (point) {
                    point.confirmedCount = (point.confirmedCount || 1) + 1;
                    point.lastSeen = new Date();
                   
                    // 🔥 ОБНОВЛЯЕМ ГЕОМЕТРИЧЕСКИЙ ХЕШ ЕСЛИ ЕСТЬ
                    if (match.point2 && match.point2.geometricHash && !point.geometricHash) {
                        point.geometricHash = match.point2.geometricHash;
                    }
                   
                    updated++;
                }
            }
        });

        console.log(`✅ Обновлено ${updated} подтверждений`);
        return updated;
    }

    // 🔥 НОВЫЙ МЕТОД: Найти точку по геометрическому хешу
    findPointByGeometricHash(geometricHash) {
        if (!geometricHash) return null;

        for (const [id, point] of this.points) {
            if (point.geometricHash === geometricHash) {
                return point;
            }
        }
        return null;
    }

    // 🔥 УПРОЩЕННЫЙ МЕТОД: СОЗДАНИЕ ТОЧКИ
    _createNewPointSimple(point, sourceInfo = {}) {
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

        // 🔥 СОХРАНЯЕМ ГЕОМЕТРИЧЕСКИЙ ХЕШ ЕСЛИ ЕСТЬ
        if (point.geometricHash) {
            pointData.geometricHash = point.geometricHash;
        }

        this.points.set(newPointId, pointData);

        // 🔥 МИНИМАЛЬНЫЙ ЛОГ
        if (this.config.debug) {
            console.log(`✅ Создана точка ${newPointId}`);
        }

        return newPointId;
    }

    // 🔥 УПРОЩЕННЫЙ МЕТОД: ОБНОВЛЕНИЕ ТОЧКИ
    _updatePointSimple(pointId, newPoint, sourceInfo = {}) {
        const pointData = this.points.get(pointId);
        if (!pointData) return false;

        const photoHash = sourceInfo.photoId || 'unknown';

        // 🔥 ПРОВЕРЯЕМ, НЕ БЫЛО ЛИ УЖЕ ЭТОГО ФОТО
        if (pointData.confirmedPhotos && pointData.confirmedPhotos.has(photoHash)) {
            return false;
        }

        // Увеличиваем количество подтверждений
        pointData.confirmedCount = (pointData.confirmedCount || 1) + 1;

        if (!pointData.confirmedPhotos) pointData.confirmedPhotos = new Set();
        pointData.confirmedPhotos.add(photoHash);

        // 🔥 ОБНОВЛЯЕМ КООРДИНАТЫ ТОЛЬКО ПРИ ГЕОМЕТРИЧЕСКОМ СОВПАДЕНИИ
        if (sourceInfo.geometricMatch) {
            const updateDistance = sourceInfo.distance || 0;
            const weight = Math.max(0.1, Math.min(0.9, 1.0 - (updateDistance / 20)));

            pointData.x = pointData.x * (1 - weight) + newPoint.x * weight;
            pointData.y = pointData.y * (1 - weight) + newPoint.y * weight;
        }

        // Обновляем рейтинг
        pointData.rating = this.calculateUpdatedRating(
            pointData.rating,
            newPoint.confidence || 0.5
        );

        // 🔥 ОБНОВЛЯЕМ ГЕОМЕТРИЧЕСКИЙ ХЕШ ЕСЛИ ЕСТЬ
        if (newPoint.geometricHash && !pointData.geometricHash) {
            pointData.geometricHash = newPoint.geometricHash;
        }

        pointData.lastSeen = new Date();

        // 🔥 МИНИМАЛЬНЫЙ ЛОГ
        if (this.config.debug) {
            console.log(`🔄 Точка ${pointId}: ${pointData.confirmedCount} подтверждений`);
        }

        return true;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ

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

    // 🔥 МЕТОД: Получить все точки с геометрическими хешами
    getPointsWithGeometricHashes() {
        const points = [];
       
        for (const [id, point] of this.points) {
            if (point.geometricHash) {
                points.push({
                    id: id,
                    x: point.x,
                    y: point.y,
                    confidence: point.confidence || 0.5,
                    geometricHash: point.geometricHash,
                    confirmations: point.confirmedCount || 1,
                    source: 'point_tracker'
                });
            }
        }
       
        return points;
    }

    // 🔥 МЕТОД: Добавить геометрические хеши к точкам
    addGeometricHashesToPoints(geometricHashesMap) {
        let updated = 0;
       
        for (const [pointId, geometricHash] of Object.entries(geometricHashesMap)) {
            const point = this.points.get(pointId);
            if (point && !point.geometricHash) {
                point.geometricHash = geometricHash;
                updated++;
            }
        }
       
        console.log(`✅ Добавлено ${updated} геометрических хешей к точкам`);
        return updated;
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
            _version: '4.1-simple-accumulator',
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
