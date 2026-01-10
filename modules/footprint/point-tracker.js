// modules/footprint/point-tracker.js - ВЕРСИЯ С ЧЕСТНЫМИ ПОДТВЕРЖДЕНИЯМИ
// 1 фото = 1 подтверждение точки

const crypto = require('crypto');

class PointTracker {
    constructor(options = {}) {
        this.points = new Map(); // id -> { point, history, rating }
        this.nextId = 1;
        this.config = {
            ratingDecay: options.ratingDecay || 0.97, // Затухание рейтинга со временем
            minRating: options.minRating || 0.1,
            maxRating: options.maxRating || 1.0,
            confirmationThreshold: options.confirmationThreshold || 0.7,
           
            // Настройки кластеризации
            enableClustering: false, // 🔥 ОТКЛЮЧАЕМ кластеризацию options.enableClustering !== false,
            clusterRadius: options.clusterRadius || 30,
            minClusterSize: options.minClusterSize || 2,
            adaptiveDistance: options.adaptiveDistance !== false,
            baseDistanceThreshold: options.baseDistanceThreshold || 25,
            bonusForClusters: options.bonusForClusters !== false,
           
            // 🔥 ИСПРАВЛЕННЫЕ НАСТРОЙКИ ДЛЯ ЧЕСТНЫХ ПОДТВЕРЖДЕНИЙ
            directUpdateThreshold: options.directUpdateThreshold || 50,
            forceUpdateOnMerge: options.forceUpdateOnMerge !== false,
            honestConfirmations: options.honestConfirmations !== false, // 🔥 НОВАЯ ОПЦИЯ
            maxConfirmationsPerPhoto: options.maxConfirmationsPerPhoto || 1 // 🔥 1 подтверждение на фото
        };
    }

    // 🔥 ГЛАВНЫЙ ИСПРАВЛЕННЫЙ МЕТОД: ЧЕСТНАЯ ОБРАБОТКА ТОЧЕК
    processNewPoints(newPoints, sourceInfo = {}) {
        console.log(`🎯 Честная обработка ${newPoints.length} точек...`);
       
        const results = {
            added: 0,
            updated: 0,
            merged: 0,
            skipped: 0,
            clusters: 0,
            points: [],
            photoId: sourceInfo.photoId || 'unknown'
        };

        // 🔥 ВАЖНО: Уникальный идентификатор фото для предотвращения двойного подсчета
        const photoHash = sourceInfo.photoId ||
                         crypto.createHash('md5').update(JSON.stringify(newPoints)).digest('hex');
       
        // Шаг 1: Кластеризация новых точек
        const clusters = this.clusterPoints(newPoints, this.config.clusterRadius, this.config.minClusterSize);
        results.clusters = clusters.length;
        console.log(`📊 Образовано ${clusters.length} кластеров`);

        // Шаг 2: Обработка каждого кластера с ЧЕСТНЫМИ подтверждениями
        clusters.forEach((cluster, clusterIndex) => {
            if (cluster.points.length === 0) return;

            const clusterCenter = this.calculateClusterCenter(cluster.points);
            const clusterSize = cluster.points.length;
           
            // 🔥 ЧЕСТНЫЙ ПОДСЧЕТ: адаптивный порог для кластера
            const adaptiveThreshold = this.getAdaptiveThreshold(clusterSize);
           
            // Ищем ближайшую существующую точку
            const nearest = this.findNearestPoint(clusterCenter, adaptiveThreshold);
           
            if (nearest) {
                // 🔥 ЧЕСТНОЕ ОБНОВЛЕНИЕ: ТОЛЬКО 1 ПОДТВЕРЖДЕНИЕ НА КЛАСТЕР
                const updateSuccess = this._updatePointHonest(
                    nearest.id,
                    {
                        x: clusterCenter.x,
                        y: clusterCenter.y,
                        confidence: Math.max(0.5, cluster.points[0].confidence || 0.5)
                    },
                    {
                        ...sourceInfo,
                        clusterSize: clusterSize,
                        clusterIndex: clusterIndex,
                        confirmationType: 'cluster',
                        photoId: photoHash, // 🔥 Важно: ID фото для отслеживания
                        photoCount: 1 // 🔥 ЧЕСТНО: 1 фото = 1 подтверждение
                    }
                );

                if (updateSuccess) {
                    results.updated++;
                    results.merged += clusterSize;
                   
                    results.points.push({
                        id: nearest.id,
                        action: 'cluster_updated_honest',
                        clusterSize: clusterSize,
                        confirmationsAdded: 1, // 🔥 Только 1!
                        distance: nearest.distance,
                        photoId: photoHash
                    });
                }

            } else {
                // 🔥 ЧЕСТНОЕ СОЗДАНИЕ: новая точка с 1 подтверждением
                const newPointId = `pt_${this.nextId++}`;
                const baseConfidence = Math.min(0.8, 0.5 + (clusterSize * 0.05));
               
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
                        action: 'cluster_added_honest',
                        confirmationType: 'cluster',
                        photoCount: 1 // 🔥 ЧЕСТНО: начинаем с 1 подтверждения
                    }],
                    confirmedCount: 1, // 🔥 ЧЕСТНО: начинаем с 1
                    clusterConfirmations: [{
                        timestamp: new Date(),
                        source: sourceInfo.source || 'unknown',
                        photoId: photoHash, // 🔥 Запоминаем фото
                        clusterSize: clusterSize,
                        confirmationIndex: 0
                    }],
                    lastSeen: new Date(),
                    firstSeen: new Date(),
                    clusterOrigin: true,
                    clusterSize: clusterSize,
                    confirmedPhotos: new Set([photoHash]), // 🔥 Отслеживаем уникальные фото
                    clusterData: {
                        size: clusterSize,
                        index: clusterIndex,
                        points: cluster.points.length,
                        isFromCurrentPhoto: true
                    }
                };

                this.points.set(newPointId, pointData);
                results.added++;
               
                results.points.push({
                    id: newPointId,
                    action: 'cluster_added_honest',
                    clusterSize: clusterSize,
                    confirmations: 1,
                    photoId: photoHash
                });
            }
        });

        // Шаг 3: Обработка одиночных точек с честными подтверждениями
        const singlePoints = this.findSinglePoints(newPoints, clusters);
        if (singlePoints.length > 0) {
            console.log(`📌 Честная обработка ${singlePoints.length} одиночных точек...`);
           
            singlePoints.forEach((singlePoint, index) => {
                const nearest = this.findNearestPoint(singlePoint, 15);
               
                if (nearest && nearest.distance < 12) {
                    // 🔥 ЧЕСТНОЕ ОБНОВЛЕНИЕ одиночной точки
                    this._updatePointHonest(
                        nearest.id,
                        singlePoint,
                        {
                            ...sourceInfo,
                            confirmationType: 'single',
                            photoId: photoHash,
                            photoCount: 1
                        }
                    );
                    results.updated++;
                } else {
                    // 🔥 ЧЕСТНОЕ СОЗДАНИЕ новой одиночной точки
                    const newPointId = `pt_single_${this.nextId++}`;
                   
                    const pointData = {
                        id: newPointId,
                        x: singlePoint.x,
                        y: singlePoint.y,
                        confidence: singlePoint.confidence || 0.5,
                        rating: singlePoint.confidence || 0.5,
                        history: [{
                            timestamp: new Date(),
                            source: { ...sourceInfo, index },
                            confidence: singlePoint.confidence || 0.5,
                            action: 'single_added_honest',
                            confirmationType: 'single',
                            photoCount: 1
                        }],
                        confirmedCount: 1,
                        clusterConfirmations: [{
                            timestamp: new Date(),
                            source: sourceInfo.source || 'unknown',
                            photoId: photoHash,
                            clusterSize: 1,
                            confirmationIndex: 0
                        }],
                        lastSeen: new Date(),
                        firstSeen: new Date(),
                        confirmedPhotos: new Set([photoHash]),
                        clusterOrigin: false
                    };
                   
                    this.points.set(newPointId, pointData);
                    results.added++;
                }
            });
        }

        console.log(`📈 Честный итог: +${results.added} новых, ${results.updated} обновлено, ` +
                  `${results.merged} точек объединено, всего фото: ${this.getUniquePhotoCount()}`);
       
        return results;
    }

    // 🔥 НОВЫЙ МЕТОД: ЧЕСТНОЕ ОБНОВЛЕНИЕ ТОЧКИ
    _updatePointHonest(pointId, newPoint, sourceInfo = {}) {
        const pointData = this.points.get(pointId);
        if (!pointData) return false;
       
        // 🔥 ПРОВЕРКА: Это фото уже подтверждало эту точку?
        const photoHash = sourceInfo.photoId || 'unknown';
        if (pointData.confirmedPhotos && pointData.confirmedPhotos.has(photoHash)) {
            console.log(`⚠️  Точка ${pointId} уже подтверждена фото ${photoHash.substring(0, 8)}..., пропускаем`);
            return false; // Уже подтверждено этим фото
        }
       
        // 🔥 ЧЕСТНОЕ ОБНОВЛЕНИЕ: ТОЛЬКО +1 ПОДТВЕРЖДЕНИЕ
        pointData.confirmedCount += 1;
       
        // Отслеживаем уникальные фото
        if (!pointData.confirmedPhotos) {
            pointData.confirmedPhotos = new Set();
        }
        pointData.confirmedPhotos.add(photoHash);
       
        // Сохраняем информацию о подтверждении
        if (!pointData.clusterConfirmations) {
            pointData.clusterConfirmations = [];
        }
       
        pointData.clusterConfirmations.push({
            timestamp: new Date(),
            source: sourceInfo.source || 'unknown',
            photoId: photoHash,
            clusterSize: sourceInfo.clusterSize || 1,
            confirmationIndex: pointData.confirmedCount - 1
        });
       
        // Обновляем рейтинг (простая схема)
        const newRating = this.calculateUpdatedRating(
            pointData.rating,
            newPoint.confidence || 0.5
        );
       
        // Обновляем позицию (взвешенное среднее по подтверждениям)
        const weight = newPoint.confidence || 0.5;
        const totalWeight = pointData.rating * (pointData.confirmedCount - 1) + weight;
       
        if (totalWeight > 0) {
            pointData.x = (pointData.x * pointData.rating * (pointData.confirmedCount - 1) +
                          newPoint.x * weight) / totalWeight;
            pointData.y = (pointData.y * pointData.rating * (pointData.confirmedCount - 1) +
                          newPoint.y * weight) / totalWeight;
        }
       
        pointData.rating = newRating;
        pointData.lastSeen = new Date();
        pointData.history.push({
            timestamp: new Date(),
            source: sourceInfo,
            confidence: newPoint.confidence || 0.5,
            action: 'confirmed_honest',
            confirmationType: 'honest',
            photoCount: 1,
            currentConfirmations: pointData.confirmedCount
        });
       
        return true;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить количество уникальных фото
    getUniquePhotoCount() {
        const photoSet = new Set();
       
        for (const point of this.points.values()) {
            if (point.confirmedPhotos) {
                point.confirmedPhotos.forEach(photoId => photoSet.add(photoId));
            }
            if (point.clusterConfirmations) {
                point.clusterConfirmations.forEach(conf => {
                    if (conf.photoId) photoSet.add(conf.photoId);
                });
            }
        }
       
        return photoSet.size;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить статистику честных подтверждений
    getHonestStats() {
        const stats = this.getStats();
        const honestStats = {
            ...stats,
            totalPoints: this.points.size,
            uniquePhotos: this.getUniquePhotoCount(),
            confirmationIntegrity: 0,
            pointsByConfirmations: { '1': 0, '2': 0, '3': 0, '4+': 0 },
            averageConfirmationsPerPhoto: 0
        };
       
        let totalConfirmations = 0;
        let totalPointsWithConfirmations = 0;
       
        for (const point of this.points.values()) {
            const confirmations = point.confirmedCount || 0;
            totalConfirmations += confirmations;
           
            if (confirmations > 0) {
                totalPointsWithConfirmations++;
               
                // Группировка по количеству подтверждений
                if (confirmations === 1) honestStats.pointsByConfirmations['1']++;
                else if (confirmations === 2) honestStats.pointsByConfirmations['2']++;
                else if (confirmations === 3) honestStats.pointsByConfirmations['3']++;
                else honestStats.pointsByConfirmations['4+']++;
            }
        }
       
        // Рассчитываем целостность подтверждений
        if (totalPointsWithConfirmations > 0) {
            honestStats.confirmationIntegrity =
                (totalConfirmations / (honestStats.uniquePhotos * totalPointsWithConfirmations));
            honestStats.averageConfirmationsPerPhoto =
                totalConfirmations / Math.max(1, honestStats.uniquePhotos);
        }
       
        return honestStats;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить данные для визуализации кластеров
    getVisualizationData(options = {}) {
        const data = {
            id: `tracker_${Date.now()}`,
            points: [],
            clusters: [],
            stats: this.getHonestStats(),
            metadata: {
                createdAt: new Date(),
                totalPoints: this.points.size,
                uniquePhotos: this.getUniquePhotoCount()
            }
        };
       
        // Собираем точки с информацией о подтверждениях
        for (const [id, point] of this.points) {
            const pointData = {
                id,
                x: point.x,
                y: point.y,
                confirmations: point.confirmedCount || 1,
                confidence: point.rating || point.confidence || 0.5,
                clusterSize: point.clusterSize || 1,
                isCluster: point.clusterOrigin || false,
                lastSeen: point.lastSeen,
                firstSeen: point.firstSeen,
                color: this._getColorByConfirmations(point.confirmedCount || 1),
                size: this._getSizeByConfirmations(point.confirmedCount || 1),
                confirmedPhotos: point.confirmedPhotos ?
                    Array.from(point.confirmedPhotos) : [],
                clusterData: point.clusterData || null
            };
           
            data.points.push(pointData);
        }
       
        // Собираем информацию о кластерах
        const clusterGroups = new Map();
        for (const point of this.points.values()) {
            if (point.clusterOrigin) {
                const clusterKey = `cluster_${point.clusterSize || 1}`;
                if (!clusterGroups.has(clusterKey)) {
                    clusterGroups.set(clusterKey, {
                        size: point.clusterSize,
                        count: 0,
                        avgConfirmations: 0,
                        points: []
                    });
                }
                const cluster = clusterGroups.get(clusterKey);
                cluster.count++;
                cluster.avgConfirmations += (point.confirmedCount || 1);
                cluster.points.push({ x: point.x, y: point.y });
            }
        }
       
        // Преобразуем кластеры в массив
        for (const [key, cluster] of clusterGroups) {
            if (cluster.count > 0) {
                cluster.avgConfirmations /= cluster.count;
                data.clusters.push({
                    ...cluster,
                    id: key,
                    radius: cluster.size * 10
                });
            }
        }
       
        return data;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Цвет по количеству подтверждений
    _getColorByConfirmations(confirmations) {
        if (confirmations >= 4) return '#2ed573'; // Зеленый: много подтверждений
        if (confirmations === 3) return '#ffa502'; // Оранжевый: средне
        if (confirmations === 2) return '#ffd32a'; // Желтый: мало
        return '#ff4757'; // Красный: 1 подтверждение
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Размер по количеству подтверждений
    _getSizeByConfirmations(confirmations) {
        return 3 + Math.min(confirmations, 5); // 3-8 пикселей
    }

    // 🔥 НОВЫЙ МЕТОД: Проверить целостность подтверждений
    validateConfirmations() {
        const issues = [];
       
        for (const [id, point] of this.points) {
            const expectedConfirmations = point.confirmedPhotos ?
                point.confirmedPhotos.size : 1;
           
            if (point.confirmedCount !== expectedConfirmations) {
                issues.push({
                    pointId: id,
                    expected: expectedConfirmations,
                    actual: point.confirmedCount,
                    photos: point.confirmedPhotos ? Array.from(point.confirmedPhotos) : []
                });
            }
           
            // Проверка дублирования фото в подтверждениях
            if (point.clusterConfirmations) {
                const photoIds = new Set();
                const duplicates = [];
               
                point.clusterConfirmations.forEach(conf => {
                    if (conf.photoId && photoIds.has(conf.photoId)) {
                        duplicates.push(conf.photoId);
                    }
                    if (conf.photoId) {
                        photoIds.add(conf.photoId);
                    }
                });
               
                if (duplicates.length > 0) {
                    issues.push({
                        pointId: id,
                        type: 'duplicate_photos',
                        duplicates: duplicates,
                        totalConfirmations: point.clusterConfirmations.length
                    });
                }
            }
        }
       
        return {
            valid: issues.length === 0,
            totalPoints: this.points.size,
            issues: issues,
            uniquePhotos: this.getUniquePhotoCount(),
            averageConfirmationsPerPoint: this.points.size > 0 ?
                Array.from(this.points.values()).reduce((sum, pt) => sum + (pt.confirmedCount || 1), 0) / this.points.size : 0
        };
    }

    // 🔥 МЕТОД: Сбросить подтверждения (для тестирования)
    resetConfirmations() {
        console.log('🔄 Сброс подтверждений до честного состояния...');
       
        let resetCount = 0;
        for (const [id, point] of this.points) {
            // Устанавливаем подтверждения на основе уникальных фото
            const uniquePhotos = point.confirmedPhotos ? point.confirmedPhotos.size : 1;
            point.confirmedCount = Math.max(1, uniquePhotos);
           
            // Обновляем рейтинг
            point.rating = Math.min(1.0, 0.5 + (point.confirmedCount * 0.1));
           
            resetCount++;
        }
       
        console.log(`✅ Сброшено ${resetCount} точек, уникальных фото: ${this.getUniquePhotoCount()}`);
        return resetCount;
    }

    // 🔥 МЕТОД КЛАСТЕРИЗАЦИИ (DBSCAN упрощенный) - БЕЗ ИЗМЕНЕНИЙ
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
        const clusteredPoints = new Set();
       
        clusters.forEach(cluster => {
            cluster.points.forEach(point => {
                const index = allPoints.findIndex(p =>
                    Math.abs(p.x - point.x) < 0.1 &&
                    Math.abs(p.y - point.y) < 0.1
                );
                if (index !== -1) {
                    clusteredPoints.add(index);
                }
            });
        });
       
        return allPoints.filter((_, index) => !clusteredPoints.has(index));
    }

    getAdaptiveThreshold(clusterSize) {
        let baseThreshold = this.config.baseDistanceThreshold;
       
        if (!this.config.adaptiveDistance) return baseThreshold;
       
        // Большие кластеры = более либеральный порог
        if (clusterSize >= 5) {
            return baseThreshold * 1.5;
        } else if (clusterSize >= 3) {
            return baseThreshold * 1.3;
        } else if (clusterSize === 1) {
            return baseThreshold * 0.8;
        }
       
        return baseThreshold;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Поиск ближайшей точки
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

    // 🔥 СТАРЫЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ (обновлены для честных подтверждений)
    addPoint(point, sourceInfo = {}) {
        const pointId = `pt_${this.nextId++}`;
       
        const photoHash = sourceInfo.photoId ||
                         crypto.createHash('md5').update(JSON.stringify(point)).digest('hex');
       
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
                action: 'added_honest',
                photoCount: 1
            }],
            confirmedCount: 1, // 🔥 Начинаем с 1
            confirmedPhotos: new Set([photoHash]),
            lastSeen: new Date(),
            firstSeen: new Date()
        };
       
        this.points.set(pointId, pointData);
        return pointId;
    }

    updatePoint(pointId, newPoint, sourceInfo = {}) {
        return this._updatePointHonest(pointId, newPoint, sourceInfo);
    }

    calculateUpdatedRating(currentRating, newConfidence) {
        const decayedRating = currentRating * this.config.ratingDecay;
        const updatedRating = decayedRating +
            (newConfidence * (1 - this.config.ratingDecay));
       
        return Math.min(
            this.config.maxRating,
            Math.max(this.config.minRating, updatedRating)
        );
    }

    getHighConfidencePoints(minRating = 0.7) {
        const highConfidencePoints = [];
       
        for (const [id, pt] of this.points) {
            if (pt.rating >= minRating && pt.confirmedCount >= 1) { // 🔥 Изменено: >= 1 вместо 2
                highConfidencePoints.push({
                    id,
                    x: pt.x,
                    y: pt.y,
                    rating: pt.rating,
                    confirmedCount: pt.confirmedCount,
                    uniquePhotos: pt.confirmedPhotos ? pt.confirmedPhotos.size : 1,
                    lastSeen: pt.lastSeen
                });
            }
        }
       
        highConfidencePoints.sort((a, b) => b.rating - a.rating);
        return highConfidencePoints;
    }

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
                firstSeen: pt.firstSeen
            });
        }
       
        return points;
    }

    getStats() {
        const stats = {
            totalPoints: this.points.size,
            highConfidencePoints: 0,
            avgRating: 0,
            avgConfirmations: 0,
            recentlyUpdated: 0,
            honestStats: {
                uniquePhotos: this.getUniquePhotoCount(),
                confirmationIntegrity: 0
            }
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
       
        stats.ratingDistribution = {
            low: 0,
            medium: 0,
            high: 0
        };
       
        for (const pt of this.points.values()) {
            if (pt.rating < 0.3) stats.ratingDistribution.low++;
            else if (pt.rating < 0.7) stats.ratingDistribution.medium++;
            else stats.ratingDistribution.high++;
        }
       
        // Честная статистика
        const uniquePhotos = this.getUniquePhotoCount();
        stats.honestStats.uniquePhotos = uniquePhotos;
        stats.honestStats.confirmationIntegrity = uniquePhotos > 0 ?
            totalConfirmations / (uniquePhotos * this.points.size) : 0;
       
        return stats;
    }

    exportForVisualization() {
        const points = [];
        const now = new Date();
       
        for (const [id, pt] of this.points) {
            const confirmations = pt.confirmedCount || 1;
           
            points.push({
                id,
                x: pt.x,
                y: pt.y,
                color: this._getColorByConfirmations(confirmations),
                size: this._getSizeByConfirmations(confirmations),
                rating: pt.rating,
                confirmations: confirmations,
                uniquePhotos: pt.confirmedPhotos ? pt.confirmedPhotos.size : 1,
                ageDays: Math.round((now - pt.firstSeen) / (24 * 60 * 60 * 1000)),
                isCluster: pt.clusterOrigin || false,
                clusterSize: pt.clusterSize || 1
            });
        }
       
        return {
            points,
            stats: this.getHonestStats(),
            timestamp: now.toISOString()
        };
    }

    visualize() {
        const stats = this.getHonestStats();
       
        console.log(`\n🎯 POINT TRACKER (честные подтверждения):`);
        console.log(`├─ Всего точек: ${stats.totalPoints}`);
        console.log(`├─ Уникальных фото: ${stats.uniquePhotos || stats.honestStats?.uniquePhotos || 0}`);
        console.log(`├─ Средний рейтинг: ${stats.avgRating.toFixed(3)}`);
        console.log(`├─ Среднее подтверждений: ${stats.avgConfirmations.toFixed(2)}`);
        console.log(`├─ Целостность: ${(stats.honestStats?.confirmationIntegrity || 0).toFixed(3)}`);
       
        console.log(`\n📊 ПОДТВЕРЖДЕНИЯ ПО ТОЧКАМ:`);
        console.log(`├─ 1 подтверждение: ${stats.pointsByConfirmations?.['1'] || 0}`);
        console.log(`├─ 2 подтверждения: ${stats.pointsByConfirmations?.['2'] || 0}`);
        console.log(`├─ 3 подтверждения: ${stats.pointsByConfirmations?.['3'] || 0}`);
        console.log(`└─ 4+ подтверждений: ${stats.pointsByConfirmations?.['4+'] || 0}`);
       
        // Валидация подтверждений
        const validation = this.validateConfirmations();
        if (!validation.valid) {
            console.log(`\n⚠️  ПРЕДУПРЕЖДЕНИЕ: Найдено ${validation.issues.length} проблем с подтверждениями`);
        }
    }

    toJSON() {
        const pointsArray = Array.from(this.points.entries()).map(([id, point]) => {
            const serializedPoint = { ...point };
           
            // Преобразуем Set в массив для сериализации
            if (serializedPoint.confirmedPhotos) {
                serializedPoint.confirmedPhotos = Array.from(serializedPoint.confirmedPhotos);
            }
           
            return [id, serializedPoint];
        });
       
        const data = {
            points: pointsArray,
            nextId: this.nextId,
            config: this.config,
            _version: '2.0-honest',
            _savedAt: new Date().toISOString(),
            _honestConfirmations: true
        };
       
        return data;
    }

    static fromJSON(data) {
        const tracker = new PointTracker(data.config || {});
       
        if (Array.isArray(data.points)) {
            data.points.forEach(([id, pointData]) => {
                // Восстанавливаем Set из массива
                if (Array.isArray(pointData.confirmedPhotos)) {
                    pointData.confirmedPhotos = new Set(pointData.confirmedPhotos);
                }
                tracker.points.set(id, pointData);
            });
        }
       
        tracker.nextId = data.nextId || 1;
       
        // Восстановить даты
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
            if (Array.isArray(pt.clusterConfirmations)) {
                pt.clusterConfirmations.forEach(conf => {
                    if (typeof conf.timestamp === 'string') {
                        conf.timestamp = new Date(conf.timestamp);
                    }
                });
            }
        }
       
        console.log(`✅ Загружен PointTracker с честными подтверждениями, ` +
                   `${tracker.points.size} точек, уникальных фото: ${tracker.getUniquePhotoCount()}`);
       
        return tracker;
    }
}

module.exports = PointTracker;
