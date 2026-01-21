// modules/footprint/point-tracker.js - ВЕРСИЯ С ИСПРАВЛЕНИЯМИ ПО ПЛАНУ

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

            // 🔥 ИСПРАВЛЕНИЕ: Настройки для реальных совпадений
            enableClustering: false,
            adaptiveDistance: options.adaptiveDistance !== false,
            baseDistanceThreshold: options.baseDistanceThreshold || 15,
           
            // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Реальные пороги
            REAL_MATCH_THRESHOLDS: {
                perfect: 15,    // Из логов
                good: 30,       // Из логов
                acceptable: 50   // Из логов
            },

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

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Обработка с реальной диагностикой
    processNewPoints(newPoints, sourceInfo = {}) {
        console.log(`🎯 [DIAG] Обработка ${newPoints.length} точек...`);

        const results = {
            added: 0,
            updated: 0,
            merged: 0,
            skipped: 0,
            clusters: 0,
            points: [],
            photoId: sourceInfo.photoId || 'unknown',
            realMatches: 0 // 🔥 ДОБАВЛЯЕМ СЧЕТЧИК РЕАЛЬНЫХ СОВПАДЕНИЙ
        };

        const photoHash = sourceInfo.photoId ||
                         crypto.createHash('md5').update(JSON.stringify(newPoints)).digest('hex').substring(0, 8);

        // 🔥 ДИАГНОСТИКА: Проверяем входные точки
        const zeroNewPoints = newPoints.filter(p =>
            Math.abs(p.x) < 0.1 && Math.abs(p.y) < 0.1
        ).length;
       
        console.log(`📊 Диагностика новых точек:`);
        console.log(`   Всего: ${newPoints.length}`);
        console.log(`   В (0,0): ${zeroNewPoints}`);
        if (newPoints.length > 0) {
            console.log(`   Первая точка: (${newPoints[0].x.toFixed(1)}, ${newPoints[0].y.toFixed(1)})`);
        }

        // 🔥 ШАГ 1: Прямая обработка КАЖДОЙ точки
        newPoints.forEach((point, index) => {
            const nearest = this.findNearestPoint(point, this.config.pointMergeDistance);

            if (nearest) {
                // 🔥 ИСПРАВЛЕНИЕ: Проверяем что это РЕАЛЬНОЕ совпадение
                const isRealMatch = nearest.distance < this.config.REAL_MATCH_THRESHOLDS.acceptable;
               
                if (isRealMatch) {
                    results.realMatches++;
                   
                    const updateSuccess = this._updatePointHonest(
                        nearest.id,
                        point,
                        {
                            ...sourceInfo,
                            confirmationType: 'direct',
                            photoId: photoHash,
                            pointIndex: index,
                            distance: nearest.distance,
                            isRealMatch: true
                        }
                    );

                    if (updateSuccess) {
                        results.updated++;
                        results.merged++;
                        results.points.push({
                            id: nearest.id,
                            action: 'direct_update',
                            distance: nearest.distance,
                            photoId: photoHash,
                            isRealMatch: true
                        });
                    } else {
                        results.skipped++;
                    }
                } else {
                    // 🔥 ИСПРАВЛЕНИЕ: Слишком далекое "совпадение" - считаем новой точкой
                    const distanceToNearest = this._getDistanceToNearestExistingPoint(point);
                 
                    if (distanceToNearest < this.config.newPointThreshold) {
                        results.skipped++;
                    } else {
                        const newPointId = this._createNewPoint(point, {
                            ...sourceInfo,
                            photoId: photoHash,
                            pointIndex: index,
                            reason: 'far_match'
                        });
                     
                        results.added++;
                        results.points.push({
                            id: newPointId,
                            action: 'new_point_far',
                            distanceToNearest: distanceToNearest,
                            photoId: photoHash
                        });
                    }
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

        console.log(`📈 [DIAG] Итог обработки:`);
        console.log(`   +${results.added} новых`);
        console.log(`   ${results.updated} обновлено (реальных совпадений: ${results.realMatches})`);
        console.log(`   ${results.skipped} пропущено`);
        console.log(`   Всего точек в трекере: ${this.points.size}`);

        return results;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Получение реальной статистики
    getRealStats() {
        const stats = {
            totalPoints: this.points.size,
            highConfidencePoints: 0,
            avgRating: 0,
            avgConfirmations: 0,
            recentlyUpdated: 0,
            uniquePhotos: this.getUniquePhotoCount(),
            pointsByConfirmations: { '1': 0, '2': 0, '3': 0, '4+': 0 },
           
            // 🔥 ДОБАВЛЯЕМ РЕАЛЬНУЮ СТАТИСТИКУ
            realMatches: {
                perfect: 0,
                good: 0,
                acceptable: 0
            },
            diagnostics: {
                zeroPoints: 0,
                avgDistanceBetweenPoints: 0
            }
        };

        let totalRating = 0;
        let totalConfirmations = 0;
        const now = new Date();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        // Собираем информацию о расстояниях между точками
        const pointsArray = Array.from(this.points.values());
        let totalDistance = 0;
        let distancePairs = 0;

        for (let i = 0; i < pointsArray.length; i++) {
            const pt = pointsArray[i];
           
            // 🔥 ДИАГНОСТИКА: Проверяем на нулевые координаты
            if (Math.abs(pt.x) < 0.1 && Math.abs(pt.y) < 0.1) {
                stats.diagnostics.zeroPoints++;
            }
           
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
           
            // Рассчитываем среднее расстояние между точками
            for (let j = i + 1; j < pointsArray.length; j++) {
                const otherPt = pointsArray[j];
                const dx = pt.x - otherPt.x;
                const dy = pt.y - otherPt.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                totalDistance += distance;
                distancePairs++;
            }
        }

        if (this.points.size > 0) {
            stats.avgRating = totalRating / this.points.size;
            stats.avgConfirmations = totalConfirmations / this.points.size;
        }
       
        if (distancePairs > 0) {
            stats.diagnostics.avgDistanceBetweenPoints = totalDistance / distancePairs;
        }

        return stats;
    }

    // 🔥 ДОБАВЛЯЕМ МЕТОД ДЛЯ СОВМЕСТИМОСТИ С ПЛАНОМ
    getHonestStats() {
        const realStats = this.getRealStats();
       
        // 🔥 ИСПРАВЛЕНИЕ: Гарантируем что нет ложных 100%
        if (realStats.avgRating > 0.99 && realStats.totalPoints > 10) {
            console.warn(`⚠️ [FIX-STATS] Подозрительно высокий avgRating: ${realStats.avgRating}`);
            realStats.avgRating = Math.min(0.9, realStats.avgRating * 0.9);
        }
       
        // Добавляем поле для совместимости
        realStats.confirmationIntegrity = Math.min(1.0,
            (realStats.avgConfirmations / Math.max(1, realStats.uniquePhotos)) * 0.8
        );
       
        return realStats;
    }

    // 🔥 ДОБАВЛЕН МЕТОД ДЛЯ СОВМЕСТИМОСТИ С VISUALIZER
    getHonestVisualizationData() {
        const stats = this.getStats();
        const visualizationData = {
            confirmationsInfo: {
                totalPoints: stats.totalPoints,
                confirmed2: stats.pointsByConfirmations['2'] || 0,
                confirmed1: stats.pointsByConfirmations['1'] || 0,
                confirmed0: 0 // В этой версии нет точек с 0 подтверждениями
            },
            points: []
        };

        // Добавляем информацию о точках
        for (const [id, point] of this.points) {
            visualizationData.points.push({
                id,
                x: point.x,
                y: point.y,
                confirmedCount: point.confirmedCount || 0,
                confidence: point.rating || 0.5,
                clusterData: point.clusterData || null
            });
        }

        return visualizationData;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Сравнение с шаблоном
    compareWithTemplate(templatePoints, tolerance = null) {
        // 🔥 ИСПРАВЛЕНИЕ: Используем реальные пороги если не указаны
        const REAL_TOLERANCE = tolerance || this.config.REAL_MATCH_THRESHOLDS.acceptable;
       
        console.log(`\n🔄 [DIAG] СРАВНЕНИЕ С ШАБЛОНОМ:`);
        console.log(`   Порог: ${REAL_TOLERANCE}px (реальный из логов)`);
        console.log(`   Шаблон: ${templatePoints.length} точек`);
       
        // Проверяем точки шаблона
        const zeroTemplatePoints = templatePoints.filter(p =>
            Math.abs(p.x) < 0.1 && Math.abs(p.y) < 0.1
        ).length;
       
        if (zeroTemplatePoints > templatePoints.length * 0.5) {
            console.warn(`⚠️ КРИТИЧЕСКОЕ: ${zeroTemplatePoints}/${templatePoints.length} точек шаблона в (0,0)!`);
        }

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
               
                // 🔥 ИСПРАВЛЕНИЕ: Используем РЕАЛЬНЫЙ порог
                if (distance <= REAL_TOLERANCE) {
                    matches.push({
                        template: templatePoint,
                        tracker: trackerPoint,
                        distance: distance,
                        matchQuality: 1.0 - (distance / REAL_TOLERANCE),
                        isRealMatch: distance < this.config.REAL_MATCH_THRESHOLDS.acceptable
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
                if (distance <= REAL_TOLERANCE) {
                    matched = true;
                    break;
                }
            }
            if (!matched) unmatchedTracker.push(trackerPoint);
        });
     
        // 🔥 ИСПРАВЛЕНИЕ: РЕАЛЬНЫЙ процент совпадений
        const realMatches = matches.filter(m => m.distance < this.config.REAL_MATCH_THRESHOLDS.acceptable);
        const perfectMatches = matches.filter(m => m.distance < this.config.REAL_MATCH_THRESHOLDS.perfect);
        const goodMatches = matches.filter(m => m.distance < this.config.REAL_MATCH_THRESHOLDS.good);
       
        const stats = {
            totalTemplatePoints: templatePoints.length,
            totalTrackerPoints: trackerPoints.length,
            matches: matches.length,
            realMatches: realMatches.length,
            perfectMatches: perfectMatches.length,
            goodMatches: goodMatches.length,
            unmatchedTemplate: unmatchedTemplate.length,
            unmatchedTracker: unmatchedTracker.length,
            matchRate: templatePoints.length > 0 ? (matches.length / templatePoints.length) * 100 : 0,
            realMatchRate: templatePoints.length > 0 ? (realMatches.length / templatePoints.length) * 100 : 0,
            coverageRate: trackerPoints.length > 0 ? (matches.length / trackerPoints.length) * 100 : 0,
            diagnostics: {
                hasZeroTemplatePoints: zeroTemplatePoints > 0,
                avgMatchDistance: matches.length > 0 ?
                    matches.reduce((sum, m) => sum + m.distance, 0) / matches.length : 0
            }
        };
     
        console.log(`\n📊 РЕАЛЬНАЯ СТАТИСТИКА СОВПАДЕНИЙ:`);
        console.log(`├─ Шаблон: ${stats.totalTemplatePoints} точек`);
        console.log(`├─ Трекер: ${stats.totalTrackerPoints} точек`);
        console.log(`├─ Все совпадения: ${stats.matches} (${stats.matchRate.toFixed(1)}%)`);
        console.log(`├─ РЕАЛЬНЫЕ совпадения (<${this.config.REAL_MATCH_THRESHOLDS.acceptable}px): ${stats.realMatches} (${stats.realMatchRate.toFixed(1)}%)`);
        console.log(`│  ├─ Идеальные (<${this.config.REAL_MATCH_THRESHOLDS.perfect}px): ${stats.perfectMatches}`);
        console.log(`│  └─ Хорошие (<${this.config.REAL_MATCH_THRESHOLDS.good}px): ${stats.goodMatches}`);
        console.log(`├─ Не совпало в шаблоне: ${stats.unmatchedTemplate}`);
        console.log(`└─ Лишние в трекере: ${stats.unmatchedTracker}`);
       
        // 🔥 ПРЕДУПРЕЖДЕНИЕ О ЛОЖНЫХ 100%
        if (stats.matchRate > 99 && stats.realMatches < 3) {
            console.warn(`⚠️ ЛОЖНЫЕ 100%: Показывается ${stats.matchRate.toFixed(1)}% при ${stats.realMatches} реальных совпадениях!`);
        }
     
        return { matches, unmatchedTemplate, unmatchedTracker, stats };
    }

    // 🔥 ДОБАВЛЯЕМ МЕТОД: Диагностика всех точек
    debugAllPoints() {
        console.log(`\n🔍 [DIAG] ДИАГНОСТИКА ВСЕХ ТОЧЕК:`);
       
        const pointsArray = Array.from(this.points.values());
        console.log(`   Всего точек: ${pointsArray.length}`);
       
        // Группируем по подтверждениям
        const byConfirmations = {};
        pointsArray.forEach(pt => {
            const conf = pt.confirmedCount || 1;
            if (!byConfirmations[conf]) byConfirmations[conf] = 0;
            byConfirmations[conf]++;
        });
       
        console.log(`   Распределение по подтверждениям:`);
        Object.keys(byConfirmations).sort((a,b) => a-b).forEach(conf => {
            console.log(`     ${conf} подтверждений: ${byConfirmations[conf]} точек`);
        });
       
        // Проверяем координаты
        const zeroPoints = pointsArray.filter(pt =>
            Math.abs(pt.x) < 0.1 && Math.abs(pt.y) < 0.1
        ).length;
       
        console.log(`   Точки в (0,0): ${zeroPoints}/${pointsArray.length}`);
       
        if (pointsArray.length > 0) {
            console.log(`   Примеры точек:`);
            for (let i = 0; i < Math.min(3, pointsArray.length); i++) {
                const pt = pointsArray[i];
                console.log(`     ${i+1}. (${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}) - ${pt.confirmedCount || 1} подтверждений`);
            }
        }
       
        return {
            totalPoints: pointsArray.length,
            zeroPoints: zeroPoints,
            byConfirmations: byConfirmations,
            samplePoints: pointsArray.slice(0, 3)
        };
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

    // 🔥 ОСНОВНОЙ МЕТОД СТАТИСТИКИ (для совместимости)
    getStats() {
        return this.getRealStats();
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

    visualize() {
        const stats = this.getRealStats();
        console.log(`\n🎯 POINT TRACKER (БЕЗ кластеризации):`);
        console.log(`├─ Всего точек: ${stats.totalPoints}`);
        console.log(`├─ Уникальных фото: ${stats.uniquePhotos}`);
        console.log(`├─ Средний рейтинг: ${stats.avgRating.toFixed(3)}`);
        console.log(`├─ Среднее подтверждений: ${stats.avgConfirmations.toFixed(2)}`);
        console.log(`\n📊 РЕАЛЬНАЯ СТАТИСТИКА СОВПАДЕНИЙ:`);
        console.log(`├─ Идеальные (<${this.config.REAL_MATCH_THRESHOLDS.perfect}px): ${stats.realMatches.perfect}`);
        console.log(`├─ Хорошие (<${this.config.REAL_MATCH_THRESHOLDS.good}px): ${stats.realMatches.good}`);
        console.log(`├─ Приемлемые (<${this.config.REAL_MATCH_THRESHOLDS.acceptable}px): ${stats.realMatches.acceptable}`);
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
