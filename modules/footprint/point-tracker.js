// modules/footprint/point-tracker.js
// 🔥 ТРЕКЕР ГЕОМЕТРИЧЕСКИХ ПАСПОРТОВ ВМЕСТО КООРДИНАТ

class PointTracker {
    constructor(options = {}) {
        // 🔥 ХРАНИМ ПАСПОРТА ВМЕСТО КООРДИНАТ
        this.passports = new Map(); // geometricHash -> { passport, confirmations, sources }
       
        // 🔥 ХРАНИМ ТОЧКИ ДЛЯ ВИЗУАЛИЗАЦИИ
        this.points = new Map(); // pointId -> { coordinates, passportHash, confirmations }
       
        // 🔥 НАСТРОЙКИ
        this.config = {
            minPassportConfirmations: options.minPassportConfirmations || 2,
            maxConfirmationsPerSource: 1, // 1 фото = 1 подтверждение
            passportSimilarityThreshold: options.passportSimilarityThreshold || 0.8,
            enableDebug: options.debug || false,
            preserveCoordinates: options.preserveCoordinates !== false,
           
            // 🔥 ГЕОМЕТРИЧЕСКИЕ НАСТРОЙКИ
            angleTolerance: options.angleTolerance || 5,
            distanceTolerance: options.distanceTolerance || 0.15,
            maxNeighbors: options.maxNeighbors || 3
        };

        this.nextPointId = 1;
        this.stats = {
            totalPassports: 0,
            confirmedPassports: 0,
            totalPoints: 0,
            uniqueSources: 0,
            lastUpdated: new Date()
        };

        console.log('🎯 PointTracker создан (геометрические паспорта)');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Обработать геометрические паспорта
    processGeometricPassports(passports, sourceInfo = {}) {
        if (!passports || passports.length === 0) {
            console.log('⚠️ Нет паспортов для обработки');
            return { added: 0, confirmed: 0, updated: 0 };
        }

        const sourceId = sourceInfo.sourceId || `source_${Date.now()}`;
        const results = {
            added: 0,
            confirmed: 0,
            updated: 0,
            points: [],
            sourceId: sourceId
        };

        if (this.config.enableDebug) {
            console.log(`🎯 Обрабатываю ${passports.length} геометрических паспортов от ${sourceId}`);
        }

        // Обрабатываем каждый паспорт
        passports.forEach((passport, index) => {
            const result = this.processSinglePassport(passport, sourceId, sourceInfo);
           
            if (result.added) results.added++;
            if (result.confirmed) results.confirmed++;
            if (result.updated) results.updated++;
           
            results.points.push(result);
        });

        // Обновляем статистику
        this.updateStats();

        if (this.config.enableDebug) {
            console.log(`📊 Итог: +${results.added} новых, ${results.confirmed} подтверждено, ${results.updated} обновлено`);
            console.log(`📈 Всего паспортов: ${this.passports.size}, точек: ${this.points.size}`);
        }

        return results;
    }

    // 🔥 ОБРАБОТКА ОДНОГО ПАСПОРТА
    processSinglePassport(passport, sourceId, sourceInfo) {
        const result = {
            added: false,
            confirmed: false,
            updated: false,
            passportHash: passport.geometricHash,
            pointId: null
        };

        // Проверяем валидность паспорта
        if (!passport.geometricHash) {
            console.log('⚠️ Паспорт без geometricHash, пропускаю');
            return result;
        }

        const passportHash = passport.geometricHash;

        // 🔥 ШАГ 1: Ищем существующий паспорт
        const existingPassport = this.findMatchingPassport(passport);
       
        if (existingPassport) {
            // Паспорт уже существует - подтверждаем его
            return this.confirmExistingPassport(existingPassport, passport, sourceId, sourceInfo);
        } else {
            // Новый паспорт
            return this.addNewPassport(passport, sourceId, sourceInfo);
        }
    }

    // 🔥 НАЙТИ СОПАДАЮЩИЙ ПАСПОРТ
    findMatchingPassport(newPassport) {
        // Прямое совпадение по хешу
        if (this.passports.has(newPassport.geometricHash)) {
            return this.passports.get(newPassport.geometricHash);
        }

        // Ищем похожие паспорта по геометрии
        for (const [hash, existing] of this.passports) {
            const similarity = this.comparePassports(newPassport, existing.passport);
           
            if (similarity >= this.config.passportSimilarityThreshold) {
                return existing;
            }
        }

        return null;
    }

    // 🔥 СРАВНИТЬ ДВА ПАСПОРТА
    comparePassports(passport1, passport2) {
        let similarity = 0;
       
        // Сравниваем углы
        if (passport1.angles && passport2.angles) {
            const angleSimilarity = this.compareAngleSets(passport1.angles, passport2.angles);
            similarity += angleSimilarity * 0.5;
        }
       
        // Сравниваем расстояния
        if (passport1.distances && passport2.distances) {
            const distanceSimilarity = this.compareDistanceSets(passport1.distances, passport2.distances);
            similarity += distanceSimilarity * 0.3;
        }
       
        // Бонус за совпадение типа паттерна
        if (passport1.patternType === passport2.patternType) {
            similarity += 0.2;
        }
       
        return similarity;
    }

    // 🔥 ПОДТВЕРДИТЬ СУЩЕСТВУЮЩИЙ ПАСПОРТ
    confirmExistingPassport(existingPassportData, newPassport, sourceId, sourceInfo) {
        const passportHash = existingPassportData.passport.geometricHash;
       
        // Проверяем, не подтверждали ли уже этим источником
        if (existingPassportData.sources.has(sourceId)) {
            if (this.config.enableDebug) {
                console.log(`⚠️ Паспорт ${passportHash} уже подтвержден источником ${sourceId}`);
            }
            return {
                added: false,
                confirmed: false,
                updated: false,
                passportHash: passportHash,
                pointId: existingPassportData.pointId
            };
        }

        // Увеличиваем подтверждения
        existingPassportData.confirmations++;
        existingPassportData.sources.add(sourceId);
        existingPassportData.lastSeen = new Date();

        // Обновляем точку если нужно
        let pointUpdated = false;
        if (newPassport.coordinates && this.config.preserveCoordinates) {
            const pointId = existingPassportData.pointId;
            if (pointId && this.points.has(pointId)) {
                const point = this.points.get(pointId);
                point.confirmations = existingPassportData.confirmations;
                point.lastSeen = new Date();
               
                // Уточняем координаты (взвешенное среднее)
                const weight = 1.0 / existingPassportData.confirmations;
                point.x = point.x * (1 - weight) + newPassport.coordinates.x * weight;
                point.y = point.y * (1 - weight) + newPassport.coordinates.y * weight;
               
                pointUpdated = true;
            }
        }

        if (this.config.enableDebug) {
            console.log(`✅ Подтвержден паспорт ${passportHash} (${existingPassportData.confirmations} подтверждений)`);
        }

        return {
            added: false,
            confirmed: true,
            updated: pointUpdated,
            passportHash: passportHash,
            pointId: existingPassportData.pointId
        };
    }

    // 🔥 ДОБАВИТЬ НОВЫЙ ПАСПОРТ
    addNewPassport(passport, sourceId, sourceInfo) {
        const passportHash = passport.geometricHash;
       
        // Создаем точку для визуализации
        const pointId = this.createPointFromPassport(passport, passportHash);
       
        // Создаем запись паспорта
        const passportData = {
            passport: passport,
            confirmations: 1,
            sources: new Set([sourceId]),
            pointId: pointId,
            firstSeen: new Date(),
            lastSeen: new Date(),
            metadata: {
                addedFrom: sourceId,
                addedAt: new Date(),
                sourceInfo: sourceInfo
            }
        };
       
        this.passports.set(passportHash, passportData);
       
        if (this.config.enableDebug) {
            console.log(`🆕 Добавлен новый паспорт ${passportHash} (точка ${pointId})`);
        }

        return {
            added: true,
            confirmed: false,
            updated: false,
            passportHash: passportHash,
            pointId: pointId
        };
    }

    // 🔥 СОЗДАТЬ ТОЧКУ ИЗ ПАСПОРТА
    createPointFromPassport(passport, passportHash) {
        const pointId = `pt_${this.nextPointId++}`;
       
        const pointData = {
            id: pointId,
            x: passport.coordinates?.x || 0,
            y: passport.coordinates?.y || 0,
            passportHash: passportHash,
            confirmations: 1,
            firstSeen: new Date(),
            lastSeen: new Date(),
            metadata: {
                patternType: passport.patternType,
                neighborCount: passport.neighborCount,
                angles: passport.angles || [],
                distances: passport.distances || []
            }
        };
       
        this.points.set(pointId, pointData);
       
        return pointId;
    }

    // 🔥 СРАВНЕНИЕ НАБОРОВ УГЛОВ
    compareAngleSets(angles1, angles2) {
        if (angles1.length === 0 && angles2.length === 0) return 1.0;
        if (angles1.length === 0 || angles2.length === 0) return 0;
       
        // Берем минимальное количество углов для сравнения
        const minLen = Math.min(angles1.length, angles2.length);
        let totalDiff = 0;
       
        for (let i = 0; i < minLen; i++) {
            const diff = Math.abs(angles1[i] - angles2[i]);
            const normalizedDiff = Math.min(1, diff / (this.config.angleTolerance * 2));
            totalDiff += 1 - normalizedDiff;
        }
       
        return totalDiff / minLen;
    }

    // 🔥 СРАВНЕНИЕ НАБОРОВ РАССТОЯНИЙ
    compareDistanceSets(distances1, distances2) {
        if (distances1.length === 0 && distances2.length === 0) return 1.0;
        if (distances1.length === 0 || distances2.length === 0) return 0;
       
        const minLen = Math.min(distances1.length, distances2.length);
        let totalDiff = 0;
       
        for (let i = 0; i < minLen; i++) {
            const maxDist = Math.max(distances1[i], distances2[i]);
            if (maxDist === 0) {
                totalDiff += 1;
            } else {
                const diff = Math.abs(distances1[i] - distances2[i]);
                const normalizedDiff = Math.min(1, diff / (maxDist * this.config.distanceTolerance));
                totalDiff += 1 - normalizedDiff;
            }
        }
       
        return totalDiff / minLen;
    }

    // 🔥 ОБНОВИТЬ СТАТИСТИКУ
    updateStats() {
        this.stats.totalPassports = this.passports.size;
        this.stats.totalPoints = this.points.size;
       
        // Считаем подтвержденные паспорты
        let confirmedCount = 0;
        let uniqueSources = new Set();
       
        for (const passportData of this.passports.values()) {
            if (passportData.confirmations >= this.config.minPassportConfirmations) {
                confirmedCount++;
            }
            passportData.sources.forEach(source => uniqueSources.add(source));
        }
       
        this.stats.confirmedPassports = confirmedCount;
        this.stats.uniqueSources = uniqueSources.size;
        this.stats.lastUpdated = new Date();
    }

    // 🔥 ПОЛУЧИТЬ СТАТИСТИКУ
    getStats() {
        const pointsByConfirmations = { '1': 0, '2': 0, '3+': 0 };
       
        for (const point of this.points.values()) {
            if (point.confirmations === 1) {
                pointsByConfirmations['1']++;
            } else if (point.confirmations === 2) {
                pointsByConfirmations['2']++;
            } else {
                pointsByConfirmations['3+']++;
            }
        }
       
        return {
            ...this.stats,
            pointsByConfirmations,
            lastUpdated: this.stats.lastUpdated.toLocaleString('ru-RU')
        };
    }

    // 🔥 ПОЛУЧИТЬ ВСЕ ТОЧКИ ДЛЯ ВИЗУАЛИЗАЦИИ
    getAllPoints(options = {}) {
        const {
            minConfirmations = 0,
            minPassportConfirmations = 0,
            maxAgeDays = Infinity
        } = options;
       
        const points = [];
        const now = new Date();
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
       
        for (const [pointId, point] of this.points) {
            // Фильтруем по подтверждениям
            if (point.confirmations < minConfirmations) continue;
           
            // Фильтруем по подтверждениям паспорта
            const passportData = this.passports.get(point.passportHash);
            if (!passportData || passportData.confirmations < minPassportConfirmations) continue;
           
            // Фильтруем по возрасту
            const age = now - point.lastSeen;
            if (age > maxAgeMs) continue;
           
            points.push({
                id: pointId,
                x: point.x,
                y: point.y,
                confirmations: point.confirmations,
                passportHash: point.passportHash,
                patternType: point.metadata?.patternType || 'unknown',
                lastSeen: point.lastSeen,
                firstSeen: point.firstSeen,
                passportConfirmations: passportData.confirmations,
                type: 'geometric_passport_point'
            });
        }
       
        return points;
    }

    // 🔥 ПОЛУЧИТЬ ПАСПОРТЫ ДЛЯ ВИЗУАЛИЗАЦИИ
    getPassportsForVisualization() {
        const passports = [];
       
        for (const [hash, data] of this.passports) {
            passports.push({
                hash: hash,
                confirmations: data.confirmations,
                sources: Array.from(data.sources),
                patternType: data.passport.patternType,
                pointId: data.pointId,
                coordinates: this.points.get(data.pointId) || null,
                firstSeen: data.firstSeen,
                lastSeen: data.lastSeen
            });
        }
       
        return passports;
    }

    // 🔥 ПОИСК ПАСПОРТОВ ПО ТИПУ ПАТТЕРНА
    findPassportsByPattern(patternType) {
        const results = [];
       
        for (const [hash, data] of this.passports) {
            if (data.passport.patternType === patternType) {
                results.push({
                    hash: hash,
                    confirmations: data.confirmations,
                    pointId: data.pointId,
                    coordinates: this.points.get(data.pointId)
                });
            }
        }
       
        return results;
    }

    // 🔥 ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
    getHonestStats() {
        const stats = this.getStats();
        return {
            totalPoints: stats.totalPoints,
            confirmed2: stats.pointsByConfirmations['2'] + stats.pointsByConfirmations['3+'],
            confirmed1: stats.pointsByConfirmations['1'],
            confirmed0: 0,
            avgConfidence: 0.7
        };
    }

    // 🔥 ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
    getHonestVisualizationData() {
        const stats = this.getStats();
        const points = this.getAllPoints();
       
        return {
            confirmationsInfo: {
                totalPoints: stats.totalPoints,
                confirmed2: stats.pointsByConfirmations['2'] + stats.pointsByConfirmations['3+'],
                confirmed1: stats.pointsByConfirmations['1'],
                confirmed0: 0
            },
            points: points.map(point => ({
                id: point.id,
                x: point.x,
                y: point.y,
                confirmedCount: point.confirmations,
                confidence: 0.5 + (point.confirmations * 0.1),
                passportHash: point.passportHash,
                patternType: point.patternType
            }))
        };
    }

    // 🔥 ВИЗУАЛИЗАЦИЯ СТАТИСТИКИ
    visualize() {
        const stats = this.getStats();
        const passportStats = {
            equilateral_triangle: this.findPassportsByPattern('equilateral_triangle').length,
            right_triangle: this.findPassportsByPattern('right_triangle').length,
            dense_cluster: this.findPassportsByPattern('dense_cluster').length,
            linear_pattern: this.findPassportsByPattern('linear_pattern').length,
            complex_pattern: this.findPassportsByPattern('complex_pattern').length
        };
       
        console.log(`\n🎯 POINT TRACKER (геометрические паспорта):`);
        console.log(`├─ Всего паспортов: ${stats.totalPassports}`);
        console.log(`├─ Подтвержденных паспортов (≥${this.config.minPassportConfirmations}): ${stats.confirmedPassports}`);
        console.log(`├─ Всего точек: ${stats.totalPoints}`);
        console.log(`├─ Уникальных источников: ${stats.uniqueSources}`);
       
        console.log(`\n📊 РАСПРЕДЕЛЕНИЕ ПОДТВЕРЖДЕНИЙ ТОЧЕК:`);
        console.log(`├─ 1 подтверждение: ${stats.pointsByConfirmations['1']}`);
        console.log(`├─ 2 подтверждения: ${stats.pointsByConfirmations['2']}`);
        console.log(`└─ 3+ подтверждений: ${stats.pointsByConfirmations['3+']}`);
       
        console.log(`\n🔷 ТИПЫ ПАТТЕРНОВ:`);
        Object.entries(passportStats).forEach(([type, count]) => {
            if (count > 0) {
                console.log(`├─ ${type}: ${count}`);
            }
        });
    }

    // 🔥 JSON СЕРИАЛИЗАЦИЯ
    toJSON() {
        const passportsArray = Array.from(this.passports.entries()).map(([hash, data]) => {
            const serialized = {
                ...data,
                passport: data.passport,
                sources: Array.from(data.sources),
                firstSeen: data.firstSeen.toISOString(),
                lastSeen: data.lastSeen.toISOString()
            };
            return [hash, serialized];
        });

        const pointsArray = Array.from(this.points.entries()).map(([id, point]) => {
            const serialized = {
                ...point,
                firstSeen: point.firstSeen.toISOString(),
                lastSeen: point.lastSeen.toISOString()
            };
            return [id, serialized];
        });

        return {
            passports: passportsArray,
            points: pointsArray,
            config: this.config,
            nextPointId: this.nextPointId,
            stats: {
                ...this.stats,
                lastUpdated: this.stats.lastUpdated.toISOString()
            },
            _version: '2.0-geometric-passports',
            _savedAt: new Date().toISOString()
        };
    }

    // 🔥 JSON ДЕСЕРИАЛИЗАЦИЯ
    static fromJSON(data) {
        const tracker = new PointTracker(data.config || {});
       
        // Восстанавливаем паспорта
        if (Array.isArray(data.passports)) {
            data.passports.forEach(([hash, passportData]) => {
                tracker.passports.set(hash, {
                    ...passportData,
                    sources: new Set(passportData.sources || []),
                    firstSeen: new Date(passportData.firstSeen),
                    lastSeen: new Date(passportData.lastSeen)
                });
            });
        }
       
        // Восстанавливаем точки
        if (Array.isArray(data.points)) {
            data.points.forEach(([id, pointData]) => {
                tracker.points.set(id, {
                    ...pointData,
                    firstSeen: new Date(pointData.firstSeen),
                    lastSeen: new Date(pointData.lastSeen)
                });
            });
        }
       
        tracker.nextPointId = data.nextPointId || 1;
       
        if (data.stats) {
            tracker.stats = { ...tracker.stats, ...data.stats };
            tracker.stats.lastUpdated = new Date(data.stats.lastUpdated || Date.now());
        }
       
        console.log(`✅ Загружен PointTracker: ${tracker.passports.size} паспортов, ${tracker.points.size} точек`);
        return tracker;
    }
}

module.exports = PointTracker;
