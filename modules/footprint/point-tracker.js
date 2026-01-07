// modules/footprint/smart-point-tracker.js
// УМНЫЙ ТРЕКЕР ТОЧЕК С АДАПТИВНЫМИ АЛГОРИТМАМИ И ИНТЕЛЛЕКТУАЛЬНЫМ СОПОСТАВЛЕНИЕМ

class SmartPointTracker {
    constructor(options = {}) {
        this.points = new Map(); // id -> { point, history, rating, metadata }
        this.nextId = 1;
       
        // 🔥 УМНЫЕ КОНФИГУРАЦИИ
        this.config = {
            // Базовые настройки
            ratingDecay: options.ratingDecay || 0.95,
            minRating: options.minRating || 0.1,
            maxRating: options.maxRating || 1.0,
            confirmationThreshold: options.confirmationThreshold || 0.7,
           
            // Адаптивные пороги
            adaptiveThresholds: options.adaptiveThresholds !== false,
            baseSearchRadius: options.baseSearchRadius || 50,
            maxSearchRadius: options.maxSearchRadius || 150,
            minSearchRadius: options.minSearchRadius || 15,
           
            // Кластеризация
            enableClustering: options.enableClustering !== false,
            clusterRadius: options.clusterRadius || 35,
            minClusterSize: options.minClusterSize || 2,
            clusterConfidenceBoost: options.clusterConfidenceBoost || 0.15,
           
            // Интеллектуальные алгоритмы
            useWeightedMatching: options.useWeightedMatching !== false,
            useVelocityPrediction: options.useVelocityPrediction !== false,
            useSpatialIndex: options.useSpatialIndex !== false,
           
            // Динамические коэффициенты
            distanceWeight: options.distanceWeight || 0.4,
            confidenceWeight: options.confidenceWeight || 0.3,
            velocityWeight: options.velocityWeight || 0.2,
            timeWeight: options.timeWeight || 0.1,
           
            // Автонастройка
            autoTuneEnabled: options.autoTuneEnabled !== false,
            learningRate: options.learningRate || 0.1
        };
       
        // Пространственный индекс для быстрого поиска
        if (this.config.useSpatialIndex) {
            this.spatialGrid = new Map();
            this.gridSize = options.gridSize || 100;
        }
       
        // Кэш движения точек
        this.movementCache = new Map(); // id -> {velocity, lastPosition, history}
       
        // Статистика для автонастройки
        this.matchStats = {
            totalMatches: 0,
            successfulMatches: 0,
            avgConfidence: 0,
            avgDistance: 0,
            lastTuneTime: Date.now()
        };
       
        console.log('🧠 Инициализирован умный трекер точек');
    }
   
    // 🔥 ОСНОВНОЙ МЕТОД: ИНТЕЛЛЕКТУАЛЬНАЯ ОБРАБОТКА
    processPoints(newPoints, sourceInfo = {}) {
        console.log(`🧠 Обрабатываю ${newPoints.length} точек с интеллектуальными алгоритмами...`);
       
        const results = {
            smartMatches: 0,
            clusterMatches: 0,
            newPoints: 0,
            rejectedPoints: 0,
            lowConfidenceMatches: 0,
            details: []
        };
       
        // Шаг 1: Подготовка и фильтрация
        const filteredPoints = this._preprocessPoints(newPoints, sourceInfo);
       
        // Шаг 2: Умное сопоставление с существующими точками
        const matchResult = this._findSmartMatches(filteredPoints);
        results.smartMatches = matchResult.matched.length;
       
        // Обработка совпадений
        matchResult.matched.forEach(match => {
            const success = this._updateWithIntelligence(
                match.existingId,
                match.newPoint,
                match.confidence,
                { ...sourceInfo, matchType: 'smart' }
            );
           
            if (success) {
                results.details.push({
                    id: match.existingId,
                    action: 'smart_update',
                    confidence: match.confidence,
                    distance: match.distance,
                    rating: this.points.get(match.existingId).rating
                });
            }
        });
       
        // Шаг 3: Кластеризация оставшихся точек
        const remainingPoints = matchResult.unmatched;
        if (remainingPoints.length > 0 && this.config.enableClustering) {
            const clusterResult = this._processWithClustering(
                remainingPoints,
                sourceInfo
            );
           
            results.clusterMatches = clusterResult.updated;
            results.newPoints += clusterResult.added;
           
            // Добавляем детали кластеризации
            results.details.push(...clusterResult.details);
        }
       
        // Шаг 4: Обработка одиночных точек
        const finalUnmatched = this._findFinalUnmatched(remainingPoints);
        if (finalUnmatched.length > 0) {
            finalUnmatched.forEach(point => {
                const nearest = this.findNearestPoint(point, 20);
               
                if (nearest && nearest.distance < 15) {
                    this.updatePoint(nearest.id, point, sourceInfo);
                    results.clusterMatches++;
                } else {
                    this.addPoint(point, sourceInfo);
                    results.newPoints++;
                }
            });
        }
       
        // Шаг 5: Автонастройка на основе результатов
        if (this.config.autoTuneEnabled) {
            this._autoTuneParameters(results);
        }
       
        // Шаг 6: Очистка и обслуживание
        this._cleanupMovementCache();
       
        console.log(`📊 Результаты: ${results.smartMatches} умных совпадений, ` +
                   `${results.clusterMatches} кластерных, ${results.newPoints} новых точек`);
       
        return results;
    }
   
    // 🔥 ПРЕДОБРАБОТКА ТОЧЕК
    _preprocessPoints(points, sourceInfo) {
        // Фильтрация дубликатов (очень близкие точки)
        const uniquePoints = [];
        const processed = new Set();
       
        for (let i = 0; i < points.length; i++) {
            if (processed.has(i)) continue;
           
            const point = points[i];
            let isDuplicate = false;
           
            // Проверяем, есть ли очень близкая точка
            for (let j = i + 1; j < points.length; j++) {
                if (processed.has(j)) continue;
               
                const distance = this._calculateDistance(point, points[j]);
                if (distance < 5) { // Очень близко - считаем дубликатом
                    processed.add(j);
                   
                    // Увеличиваем уверенность для дубликатов
                    if (!point.confidence) point.confidence = 0.7;
                    isDuplicate = true;
                }
            }
           
            if (!isDuplicate) {
                uniquePoints.push(point);
            }
           
            processed.add(i);
        }
       
        console.log(`🔄 Предобработка: ${points.length} → ${uniquePoints.length} уникальных точек`);
        return uniquePoints;
    }
   
    // 🔥 ИНТЕЛЛЕКТУАЛЬНЫЙ ПОИСК СОВПАДЕНИЙ
    _findSmartMatches(newPoints) {
        const matches = [];
        const unmatched = [...newPoints];
        const usedExistingIds = new Set();
       
        // Сортируем существующие точки по рейтингу (сначала высокие)
        const sortedExisting = Array.from(this.points.entries())
            .sort((a, b) => b[1].rating - a[1].rating);
       
        for (const [existingId, existingPoint] of sortedExisting) {
            if (usedExistingIds.has(existingId)) continue;
           
            // Адаптивный радиус поиска для этой точки
            const searchRadius = this._calculateAdaptiveRadius(existingPoint);
           
            // Быстрый поиск кандидатов в области
            const candidates = this._findCandidatesInRadius(
                unmatched,
                existingPoint,
                searchRadius
            );
           
            if (candidates.length === 0) continue;
           
            // Находим наилучшее соответствие с учётом нескольких факторов
            const bestMatch = this._findBestWeightedMatch(
                existingPoint,
                candidates,
                searchRadius
            );
           
            if (bestMatch && bestMatch.confidence >= 0.3) {
                matches.push({
                    existingId,
                    newPoint: bestMatch.point,
                    distance: bestMatch.distance,
                    confidence: bestMatch.confidence
                });
               
                // Удаляем сопоставленную точку из поиска
                const index = unmatched.findIndex(p =>
                    Math.abs(p.x - bestMatch.point.x) < 0.01 &&
                    Math.abs(p.y - bestMatch.point.y) < 0.01
                );
                if (index !== -1) {
                    unmatched.splice(index, 1);
                }
               
                usedExistingIds.add(existingId);
               
                // Обновляем статистику
                this._updateMatchStats(bestMatch.confidence, bestMatch.distance);
            }
        }
       
        console.log(`🎯 Найдено ${matches.length} умных совпадений, осталось ${unmatched.length} точек`);
       
        return {
            matched: matches,
            unmatched: unmatched
        };
    }
   
    // 🔥 РАСЧЁТ АДАПТИВНОГО РАДИУСА ПОИСКА
    _calculateAdaptiveRadius(point) {
        let radius = this.config.baseSearchRadius;
       
        // 1. Коэффициент рейтинга (высокий рейтинг = меньший радиус)
        const ratingFactor = 1.5 - point.rating; // 0.5-1.5
       
        // 2. Коэффициент подтверждений (больше подтверждений = меньший радиус)
        const confirmationFactor = Math.max(0.5, 1.2 - (point.confirmedCount * 0.05));
       
        // 3. Коэффициент времени (новые точки = больший радиус)
        const ageMs = Date.now() - point.lastSeen.getTime();
        const ageHours = ageMs / (1000 * 60 * 60);
        const timeFactor = Math.min(2, 1 + (ageHours * 0.05));
       
        // 4. Коэффициент скорости (быстро движущиеся = больший радиус)
        let velocityFactor = 1;
        if (this.movementCache.has(point.id)) {
            const velocity = this.movementCache.get(point.id).velocity;
            const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
            velocityFactor = 1 + (speed * 0.1);
        }
       
        // Итоговый радиус
        radius = radius * ratingFactor * confirmationFactor * timeFactor * velocityFactor;
       
        // Ограничения
        return Math.min(
            this.config.maxSearchRadius,
            Math.max(this.config.minSearchRadius, radius)
        );
    }
   
    // 🔥 ВЗВЕШЕННЫЙ ПОИСК НАИЛУЧШЕГО СООТВЕТСТВИЯ
    _findBestWeightedMatch(existingPoint, candidates, maxDistance) {
        let bestMatch = null;
        let bestScore = -Infinity;
       
        for (const candidate of candidates) {
            // Базовое расстояние
            const distance = this._calculateDistance(existingPoint, candidate);
            if (distance > maxDistance) continue;
           
            // 🔥 ВЫЧИСЛЕНИЕ ИНТЕГРАЛЬНОГО СКОРА
            let totalScore = 0;
            let weightSum = 0;
           
            // 1. Скор расстояния (чем ближе, тем лучше)
            if (this.config.distanceWeight > 0) {
                const distanceScore = 1 - (distance / maxDistance);
                totalScore += distanceScore * this.config.distanceWeight;
                weightSum += this.config.distanceWeight;
            }
           
            // 2. Скор уверенности (сходство confidence)
            if (this.config.confidenceWeight > 0 && candidate.confidence) {
                const confidenceDiff = 1 - Math.abs(
                    (candidate.confidence || 0.5) - existingPoint.rating
                );
                totalScore += confidenceDiff * this.config.confidenceWeight;
                weightSum += this.config.confidenceWeight;
            }
           
            // 3. Скор движения (предсказание на основе скорости)
            if (this.config.velocityWeight > 0 && this.movementCache.has(existingPoint.id)) {
                const velocityScore = this._calculateVelocityScore(
                    existingPoint,
                    candidate
                );
                totalScore += velocityScore * this.config.velocityWeight;
                weightSum += this.config.velocityWeight;
            }
           
            // 4. Скор времени (временная близость)
            if (this.config.timeWeight > 0 && candidate.timestamp) {
                const timeScore = this._calculateTimeScore(
                    existingPoint.lastSeen,
                    candidate.timestamp
                );
                totalScore += timeScore * this.config.timeWeight;
                weightSum += this.config.timeWeight;
            }
           
            // Нормализованный скор
            const normalizedScore = weightSum > 0 ? totalScore / weightSum : 0;
           
            if (normalizedScore > bestScore) {
                bestScore = normalizedScore;
                bestMatch = {
                    point: candidate,
                    distance: distance,
                    confidence: normalizedScore
                };
            }
        }
       
        return bestMatch;
    }
   
    // 🔥 РАСЧЁТ СКОРА ДВИЖЕНИЯ
    _calculateVelocityScore(existingPoint, newPoint) {
        const cache = this.movementCache.get(existingPoint.id);
        if (!cache || !cache.velocity) return 0.5;
       
        // Время с последнего обновления
        const timeDiff = Date.now() - cache.lastUpdate;
        const timeSec = timeDiff / 1000;
       
        // Предсказанная позиция
        const predictedX = existingPoint.x + (cache.velocity.x * timeSec);
        const predictedY = existingPoint.y + (cache.velocity.y * timeSec);
       
        // Расстояние до предсказанной позиции
        const predDistance = this._calculateDistance(
            { x: predictedX, y: predictedY },
            newPoint
        );
       
        // Скор (чем ближе к предсказанию, тем выше)
        return Math.max(0, 1 - (predDistance / 30));
    }
   
    // 🔥 РАСЧЁТ СКОРА ВРЕМЕНИ
    _calculateTimeScore(lastSeen, newTimestamp) {
        const timeDiff = Math.abs(newTimestamp - lastSeen.getTime());
        const maxDiff = 10000; // 10 секунд
       
        return Math.max(0, 1 - (timeDiff / maxDiff));
    }
   
    // 🔥 ОБНОВЛЕНИЕ С ИНТЕЛЛЕКТОМ
    _updateWithIntelligence(pointId, newPoint, matchConfidence, sourceInfo) {
        const pointData = this.points.get(pointId);
        if (!pointData) return false;
       
        // Адаптивный вес на основе уверенности совпадения
        const adaptiveWeight = matchConfidence * 0.8 + 0.2;
       
        // Рассчёт нового рейтинга с учётом уверенности
        const newRating = this._calculateAdaptiveRating(
            pointData.rating,
            newPoint.confidence || 0.5,
            matchConfidence
        );
       
        // Взвешенное обновление позиции
        pointData.x = pointData.x * (1 - adaptiveWeight) + newPoint.x * adaptiveWeight;
        pointData.y = pointData.y * (1 - adaptiveWeight) + newPoint.y * adaptiveWeight;
       
        // Обновление метаданных
        pointData.rating = newRating;
        pointData.confirmedCount = (pointData.confirmedCount || 0) + 1;
        pointData.lastSeen = new Date();
       
        // Добавление в историю
        pointData.history.push({
            timestamp: new Date(),
            source: { ...sourceInfo, matchConfidence },
            confidence: newPoint.confidence || 0.5,
            action: 'smart_confirmed',
            matchConfidence: matchConfidence
        });
       
        // Обновление кэша движения
        this._updateMovementCache(pointId, newPoint);
       
        // Бонус за высокую уверенность
        if (matchConfidence > 0.8) {
            pointData.rating = Math.min(1.0, pointData.rating + 0.05);
            pointData.highConfidenceUpdates = (pointData.highConfidenceUpdates || 0) + 1;
        }
       
        return true;
    }
   
    // 🔥 АДАПТИВНЫЙ РАСЧЁТ РЕЙТИНГА
    _calculateAdaptiveRating(currentRating, newConfidence, matchConfidence) {
        const decayedRating = currentRating * this.config.ratingDecay;
        const confidenceBoost = newConfidence * (1 - this.config.ratingDecay);
        const matchBoost = (matchConfidence - 0.5) * 0.1;
       
        let newRating = decayedRating + confidenceBoost + matchBoost;
       
        return Math.min(
            this.config.maxRating,
            Math.max(this.config.minRating, newRating)
        );
    }
   
    // 🔥 ОБНОВЛЕНИЕ КЭША ДВИЖЕНИЯ
    _updateMovementCache(pointId, newPosition) {
        const now = Date.now();
        const point = this.points.get(pointId);
       
        if (!point) return;
       
        if (!this.movementCache.has(pointId)) {
            // Инициализация
            this.movementCache.set(pointId, {
                velocity: { x: 0, y: 0 },
                lastPosition: { x: point.x, y: point.y },
                lastUpdate: now,
                history: []
            });
        }
       
        const cache = this.movementCache.get(pointId);
        const timeDiff = (now - cache.lastUpdate) / 1000; // секунды
       
        if (timeDiff > 0.1) { // Минимальный интервал
            // Вычисление мгновенной скорости
            const instantVelocity = {
                x: (newPosition.x - cache.lastPosition.x) / timeDiff,
                y: (newPosition.y - cache.lastPosition.y) / timeDiff
            };
           
            // Экспоненциальное сглаживание
            const smoothing = 0.3;
            cache.velocity = {
                x: cache.velocity.x * (1 - smoothing) + instantVelocity.x * smoothing,
                y: cache.velocity.y * (1 - smoothing) + instantVelocity.y * smoothing
            };
           
            // Сохранение истории
            cache.history.push({
                timestamp: now,
                velocity: { ...cache.velocity },
                position: { x: newPosition.x, y: newPosition.y }
            });
           
            // Ограничение размера истории
            if (cache.history.length > 20) {
                cache.history.shift();
            }
           
            // Обновление позиции
            cache.lastPosition = { x: newPosition.x, y: newPosition.y };
            cache.lastUpdate = now;
        }
    }
   
    // 🔥 КЛАСТЕРИЗАЦИЯ С ИНТЕЛЛЕКТОМ
    _processWithClustering(points, sourceInfo) {
        if (points.length < this.config.minClusterSize) {
            return { updated: 0, added: 0, details: [] };
        }
       
        const clusters = this._formIntelligentClusters(points);
        console.log(`📊 Образовано ${clusters.length} интеллектуальных кластеров`);
       
        const results = {
            updated: 0,
            added: 0,
            details: []
        };
       
        clusters.forEach((cluster, index) => {
            const clusterCenter = this._calculateClusterCenter(cluster.points);
            const clusterSize = cluster.points.length;
            const clusterDensity = this._calculateClusterDensity(cluster.points);
           
            // Адаптивный порог на основе плотности кластера
            const clusterThreshold = this.config.baseSearchRadius *
                (1 + (clusterDensity * 0.5));
           
            // Поиск существующей точки
            const nearest = this.findNearestPoint(clusterCenter, clusterThreshold);
           
            if (nearest && nearest.distance < clusterThreshold * 0.7) {
                // Обновление существующей точки с бонусами кластера
                const existingPoint = this.points.get(nearest.id);
               
                // Бонусные подтверждения от кластера
                const bonusConfirmations = Math.min(5, Math.floor(clusterSize / 2));
               
                for (let i = 0; i < bonusConfirmations; i++) {
                    this.updatePoint(nearest.id, {
                        x: clusterCenter.x,
                        y: clusterCenter.y,
                        confidence: Math.min(0.9, existingPoint.rating + 0.1)
                    }, {
                        ...sourceInfo,
                        clusterSize: clusterSize,
                        clusterIndex: index
                    });
                }
               
                results.updated++;
                results.details.push({
                    id: nearest.id,
                    action: 'cluster_update',
                    clusterSize: clusterSize,
                    bonusConfirmations: bonusConfirmations
                });
               
            } else {
                // Создание новой точки на основе кластера
                const newId = this._createPointFromCluster(
                    clusterCenter,
                    clusterSize,
                    clusterDensity,
                    sourceInfo,
                    index
                );
               
                results.added++;
                results.details.push({
                    id: newId,
                    action: 'cluster_create',
                    clusterSize: clusterSize,
                    density: clusterDensity
                });
            }
        });
       
        return results;
    }
   
    // 🔥 ИНТЕЛЛЕКТУАЛЬНАЯ КЛАСТЕРИЗАЦИЯ
    _formIntelligentClusters(points) {
        const clusters = [];
        const visited = new Set();
        const pointConfidences = points.map(p => p.confidence || 0.5);
        const avgConfidence = pointConfidences.reduce((a, b) => a + b, 0) / pointConfidences.length;
       
        // Адаптивный радиус на основе средней уверенности
        const adaptiveRadius = this.config.clusterRadius *
            (1.5 - avgConfidence); // Низкая уверенность = больший радиус
       
        for (let i = 0; i < points.length; i++) {
            if (visited.has(i)) continue;
           
            visited.add(i);
           
            // Поиск соседей с адаптивным радиусом
            const neighbors = [i];
            const clusterPoints = [points[i]];
           
            for (let j = 0; j < neighbors.length; j++) {
                const currentIdx = neighbors[j];
               
                for (let k = 0; k < points.length; k++) {
                    if (visited.has(k) || currentIdx === k) continue;
                   
                    const distance = this._calculateDistance(
                        points[currentIdx],
                        points[k]
                    );
                   
                    // Учёт уверенности точек при кластеризации
                    const confidenceFactor = 1 + ((points[k].confidence || 0.5) - 0.5);
                    const effectiveRadius = adaptiveRadius * confidenceFactor;
                   
                    if (distance <= effectiveRadius) {
                        neighbors.push(k);
                        clusterPoints.push(points[k]);
                        visited.add(k);
                    }
                }
            }
           
            if (clusterPoints.length >= this.config.minClusterSize) {
                clusters.push({
                    points: clusterPoints,
                    size: clusterPoints.length,
                    confidence: avgConfidence
                });
            } else if (clusterPoints.length === 1) {
                // Одиночные точки тоже сохраняем
                clusters.push({
                    points: clusterPoints,
                    size: 1,
                    confidence: points[i].confidence || 0.5
                });
            }
        }
       
        return clusters;
    }
   
    // 🔥 РАСЧЁТ ПЛОТНОСТИ КЛАСТЕРА
    _calculateClusterDensity(clusterPoints) {
        if (clusterPoints.length <= 1) return 1;
       
        let totalDistance = 0;
        let pairCount = 0;
       
        for (let i = 0; i < clusterPoints.length; i++) {
            for (let j = i + 1; j < clusterPoints.length; j++) {
                totalDistance += this._calculateDistance(clusterPoints[i], clusterPoints[j]);
                pairCount++;
            }
        }
       
        const avgDistance = totalDistance / pairCount;
        // Нормализация: чем меньше среднее расстояние, тем выше плотность
        return Math.max(0, 1 - (avgDistance / 50));
    }
   
    // 🔥 СОЗДАНИЕ ТОЧКИ ИЗ КЛАСТЕРА
    _createPointFromCluster(center, size, density, sourceInfo, clusterIndex) {
        const pointId = `pt_${this.nextId++}`;
       
        // Базовый confidence с бонусами за размер и плотность
        const sizeBonus = Math.min(0.3, size * 0.05);
        const densityBonus = density * 0.2;
        const baseConfidence = Math.min(0.9, 0.5 + sizeBonus + densityBonus);
       
        const pointData = {
            id: pointId,
            x: center.x,
            y: center.y,
            confidence: baseConfidence,
            rating: baseConfidence,
            history: [{
                timestamp: new Date(),
                source: {
                    ...sourceInfo,
                    clusterSize: size,
                    clusterDensity: density,
                    clusterIndex: clusterIndex
                },
                confidence: baseConfidence,
                action: 'cluster_created'
            }],
            confirmedCount: Math.max(1, Math.floor(size / 2)),
            lastSeen: new Date(),
            firstSeen: new Date(),
            clusterOrigin: true,
            clusterSize: size,
            clusterDensity: density
        };
       
        this.points.set(pointId, pointData);
       
        console.log(`   🆕 Создана кластерная точка ${pointId}, ` +
                  `размер: ${size}, плотность: ${density.toFixed(2)}`);
       
        return pointId;
    }
   
    // 🔥 БЫСТРЫЙ ПОИСК КАНДИДАТОВ В РАДИУСЕ
    _findCandidatesInRadius(points, center, radius) {
        if (!this.config.useSpatialIndex) {
            // Простой линейный поиск
            return points.filter(p =>
                this._calculateDistance(p, center) <= radius
            );
        }
       
        // Использование пространственного индекса
        const gridX = Math.floor(center.x / this.gridSize);
        const gridY = Math.floor(center.y / this.gridSize);
        const gridRadius = Math.ceil(radius / this.gridSize);
       
        const candidates = [];
       
        // Проверяем соседние ячейки сетки
        for (let dx = -gridRadius; dx <= gridRadius; dx++) {
            for (let dy = -gridRadius; dy <= gridRadius; dy++) {
                const cellKey = `${gridX + dx},${gridY + dy}`;
                const cellPoints = this.spatialGrid.get(cellKey) || [];
               
                // Быстрая проверка расстояния
                for (const point of cellPoints) {
                    if (Math.abs(point.x - center.x) <= radius &&
                        Math.abs(point.y - center.y) <= radius) {
                       
                        const distance = this._calculateDistance(point, center);
                        if (distance <= radius) {
                            candidates.push(point);
                        }
                    }
                }
            }
        }
       
        return candidates;
    }
   
    // 🔥 ОБНОВЛЕНИЕ СТАТИСТИКИ СОВПАДЕНИЙ
    _updateMatchStats(confidence, distance) {
        this.matchStats.totalMatches++;
       
        if (confidence > 0.5) {
            this.matchStats.successfulMatches++;
        }
       
        // Экспоненциальное скользящее среднее
        const alpha = 0.1;
        this.matchStats.avgConfidence =
            this.matchStats.avgConfidence * (1 - alpha) + confidence * alpha;
        this.matchStats.avgDistance =
            this.matchStats.avgDistance * (1 - alpha) + distance * alpha;
    }
   
    // 🔥 АВТОНАСТРОЙКА ПАРАМЕТРОВ
    _autoTuneParameters(results) {
        const now = Date.now();
        const timeSinceLastTune = now - this.matchStats.lastTuneTime;
       
        // Настраиваем раз в 10 секунд или после 100 совпадений
        if (timeSinceLastTune < 10000 && this.matchStats.totalMatches < 100) {
            return;
        }
       
        console.log("🔧 Выполняю автонастройку параметров...");
       
        // Анализ эффективности
        const successRate = this.matchStats.successfulMatches /
                          Math.max(1, this.matchStats.totalMatches);
        const avgConfidence = this.matchStats.avgConfidence;
        const avgDistance = this.matchStats.avgDistance;
       
        // Настройка радиуса поиска
        if (successRate < 0.6 && avgConfidence < 0.5) {
            // Низкая эффективность - увеличиваем радиус
            this.config.baseSearchRadius = Math.min(
                this.config.maxSearchRadius,
                this.config.baseSearchRadius * (1 + this.config.learningRate)
            );
            console.log(`   📈 Увеличиваю радиус поиска: ${this.config.baseSearchRadius.toFixed(1)}`);
        } else if (successRate > 0.8 && avgConfidence > 0.7 && avgDistance < 20) {
            // Высокая эффективность - уменьшаем радиус для точности
            this.config.baseSearchRadius = Math.max(
                this.config.minSearchRadius,
                this.config.baseSearchRadius * (1 - this.config.learningRate * 0.5)
            );
            console.log(`   📉 Уменьшаю радиус поиска: ${this.config.baseSearchRadius.toFixed(1)}`);
        }
       
        // Настройка весов
        if (avgConfidence < 0.5) {
            // Увеличиваем вес confidence при низкой уверенности
            this.config.confidenceWeight = Math.min(0.5,
                this.config.confidenceWeight * (1 + this.config.learningRate)
            );
        }
       
        // Сброс статистики
        this.matchStats.totalMatches = 0;
        this.matchStats.successfulMatches = 0;
        this.matchStats.lastTuneTime = now;
    }
   
    // 🔥 ОЧИСТКА КЭША ДВИЖЕНИЯ
    _cleanupMovementCache() {
        const now = Date.now();
        const maxAge = 300000; // 5 минут
       
        for (const [id, cache] of this.movementCache.entries()) {
            if (now - cache.lastUpdate > maxAge) {
                this.movementCache.delete(id);
            }
        }
    }
   
    // 🔥 НАХОЖДЕНИЕ ОКОНЧАТЕЛЬНО НЕСОПОСТАВЛЕННЫХ ТОЧЕК
    _findFinalUnmatched(points) {
        // Точки, которые не попали ни в одно сопоставление
        return points;
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
   
    _calculateDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
   
    _calculateClusterCenter(points) {
        const sum = points.reduce((acc, p) => ({
            x: acc.x + p.x,
            y: acc.y + p.y
        }), { x: 0, y: 0 });
       
        return {
            x: sum.x / points.length,
            y: sum.y / points.length
        };
    }
   
    // 🔥 СОВМЕСТИМЫЕ МЕТОДЫ (как в оригинальном трекере)
   
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
   
    updatePoint(pointId, newPoint, sourceInfo = {}) {
        const pointData = this.points.get(pointId);
        if (!pointData) return false;
       
        const newRating = this._calculateAdaptiveRating(
            pointData.rating,
            newPoint.confidence || 0.5,
            0.7 // Средняя уверенность для обычного обновления
        );
       
        // Простое взвешенное обновление
        const weight = newPoint.confidence || 0.5;
        pointData.x = pointData.x * 0.7 + newPoint.x * 0.3;
        pointData.y = pointData.y * 0.7 + newPoint.y * 0.3;
       
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
   
    findNearestPoint(point, maxDistance = 20) {
        let nearest = null;
        let minDistance = Infinity;
        let nearestId = null;
       
        for (const [id, pt] of this.points) {
            const distance = this._calculateDistance(pt, point);
           
            if (distance < minDistance && distance <= maxDistance) {
                minDistance = distance;
                nearest = pt;
                nearestId = id;
            }
        }
       
        return nearest ? { id: nearestId, point: nearest, distance: minDistance } : null;
    }
   
    getHighConfidencePoints(minRating = 0.7) {
        const points = [];
       
        for (const [id, pt] of this.points) {
            if (pt.rating >= minRating) {
                points.push({
                    id,
                    x: pt.x,
                    y: pt.y,
                    rating: pt.rating,
                    confirmedCount: pt.confirmedCount || 0,
                    lastSeen: pt.lastSeen
                });
            }
        }
       
        return points.sort((a, b) => b.rating - a.rating);
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
            if ((pt.confirmedCount || 0) < minConfirmations) continue;
           
            const age = now - pt.lastSeen;
            if (age > maxAgeMs) continue;
           
            points.push({
                id,
                x: pt.x,
                y: pt.y,
                confidence: pt.rating,
                confirmedCount: pt.confirmedCount || 0,
                lastSeen: pt.lastSeen,
                firstSeen: pt.firstSeen,
                clusterOrigin: pt.clusterOrigin || false,
                clusterSize: pt.clusterSize || 1
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
            clusterPoints: 0,
            singlePoints: 0
        };
       
        let totalRating = 0;
        let totalConfirmations = 0;
       
        for (const pt of this.points.values()) {
            totalRating += pt.rating;
            totalConfirmations += (pt.confirmedCount || 0);
           
            if (pt.rating >= this.config.confirmationThreshold) {
                stats.highConfidencePoints++;
            }
           
            if (pt.clusterOrigin) {
                stats.clusterPoints++;
            } else {
                stats.singlePoints++;
            }
        }
       
        if (this.points.size > 0) {
            stats.avgRating = totalRating / this.points.size;
            stats.avgConfirmations = totalConfirmations / this.points.size;
        }
       
        // Дополнительная статистика
        stats.searchRadius = this.config.baseSearchRadius;
        stats.matchStats = { ...this.matchStats };
       
        return stats;
    }
   
    cleanup() {
        const toDelete = [];
        const now = new Date();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000);
       
        for (const [id, pt] of this.points) {
            // Удаляем старые точки с низким рейтингом
            if (pt.rating < this.config.minRating && pt.lastSeen < weekAgo) {
                toDelete.push(id);
            }
           
            // Удаляем неподтверждённые точки старше 2 дней
            if ((pt.confirmedCount || 0) === 0 && pt.lastSeen < twoDaysAgo) {
                toDelete.push(id);
            }
        }
       
        toDelete.forEach(id => this.points.delete(id));
       
        return toDelete.length;
    }
   
    visualize() {
        const stats = this.getStats();
       
        console.log(`\n🧠 УМНЫЙ ТРЕКЕР ТОЧЕК (${stats.totalPoints} точек):`);
        console.log(`├─ Высоконадёжные: ${stats.highConfidencePoints}`);
        console.log(`├─ Кластерные: ${stats.clusterPoints}, Одиночные: ${stats.singlePoints}`);
        console.log(`├─ Средний рейтинг: ${stats.avgRating.toFixed(3)}`);
        console.log(`├─ Среднее подтверждений: ${stats.avgConfirmations.toFixed(1)}`);
        console.log(`├─ Радиус поиска: ${stats.searchRadius.toFixed(1)}`);
        console.log(`├─ Успешных совпадений: ${stats.matchStats.successfulMatches}/${stats.matchStats.totalMatches}`);
        console.log(`└─ Средняя уверенность: ${stats.matchStats.avgConfidence.toFixed(3)}`);
       
        // Показываем топ точек
        const topPoints = this.getHighConfidencePoints(0.8).slice(0, 3);
        if (topPoints.length > 0) {
            console.log(`\n🏆 ЛУЧШИЕ ТОЧКИ:`);
            topPoints.forEach((pt, i) => {
                console.log(`${i+1}. ${pt.id} (⭐ ${pt.rating.toFixed(3)})`);
                console.log(`   📍 (${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
                console.log(`   ✅ ${pt.confirmedCount} подтверждений`);
            });
        }
    }
   
    toJSON() {
        return {
            points: Array.from(this.points.entries()),
            nextId: this.nextId,
            config: this.config,
            matchStats: this.matchStats,
            _version: '2.0_smart',
            _savedAt: new Date().toISOString()
        };
    }
   
    static fromJSON(data) {
        const tracker = new SmartPointTracker(data.config || {});
       
        if (Array.isArray(data.points)) {
            tracker.points = new Map(data.points);
        }
       
        tracker.nextId = data.nextId || 1;
        tracker.matchStats = data.matchStats || tracker.matchStats;
       
        // Восстановление дат
        for (const pt of tracker.points.values()) {
            if (typeof pt.firstSeen === 'string') pt.firstSeen = new Date(pt.firstSeen);
            if (typeof pt.lastSeen === 'string') pt.lastSeen = new Date(pt.lastSeen);
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

module.exports = SmartPointTracker;
