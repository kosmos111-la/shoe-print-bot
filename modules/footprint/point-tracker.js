// modules/footprint/point-tracker.js
// 🔥 ИСПРАВЛЕННЫЙ: Правильный подсчет подтверждений геометрических паспортов

class PointTracker {
    constructor(options = {}) {
        // 🔥 ХРАНИМ ПАСПОРТА ВМЕСТО КООРДИНАТ
        this.passports = new Map(); // geometricHash -> { passport, confirmations, sources }
       
        // 🔥 ХРАНИМ ТОЧКИ ДЛЯ ВИЗУАЛИЗАЦИИ
        this.points = new Map(); // pointId -> { coordinates, passportHash, confirmations }
       
        // 🔥 НАСТРОЙКИ
        this.config = {
            minPassportConfirmations: options.minPassportConfirmations || 2,
            passportSimilarityThreshold: options.passportSimilarityThreshold || 0.9, // Высокий порог для точного совпадения
            enableDebug: options.debug || false,
            preserveCoordinates: options.preserveCoordinates !== false,
           
            // 🔥 ГЕОМЕТРИЧЕСКИЕ НАСТРОЙКИ
            angleTolerance: options.angleTolerance || 5,
            distanceTolerance: options.distanceTolerance || 0.15,
            maxNeighbors: options.maxNeighbors || 3,
            exactMatchOnly: true // 🔥 ВАЖНО: Только точные совпадения по хешу!
        };

        this.nextPointId = 1;
        this.stats = {
            totalPassports: 0,
            confirmedPassports: 0,
            totalPoints: 0,
            uniqueSources: 0,
            lastUpdated: new Date()
        };

        console.log('🎯 PointTracker создан (геометрические паспорта, точные совпадения)');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Обработать геометрические паспорта
    processGeometricPassports(passports, sourceInfo = {}) {
        if (!passports || passports.length === 0) {
            if (this.config.enableDebug) {
                console.log('⚠️ Нет паспортов для обработки');
            }
            return { added: 0, confirmed: 0, total: 0, similarity: 0 };
        }

        const sourceId = sourceInfo.sourceId || `source_${Date.now()}`;
       
        if (this.config.enableDebug) {
            console.log(`🔍 Ищу существующие паспорта среди ${passports.length} новых от ${sourceId}`);
            console.log(`📊 Сейчас в трекере: ${this.passports.size} паспортов`);
        }

        let added = 0;
        let confirmed = 0;
        const processedPassports = [];

        // Обрабатываем каждый паспорт
        passports.forEach((passport, index) => {
            const result = this.processSinglePassport(passport, sourceId, sourceInfo);
           
            if (result.status === 'added') added++;
            if (result.status === 'confirmed') confirmed++;
           
            processedPassports.push(result);
        });

        // Обновляем статистику
        this.updateStats();

        const similarity = this.passports.size > 0 ? confirmed / Math.min(this.passports.size, passports.length) : 0;
       
        if (this.config.enableDebug) {
            console.log(`📊 Итог обработки:`);
            console.log(`   • Подтверждено существующих: ${confirmed} (${(similarity * 100).toFixed(1)}% сходства)`);
            console.log(`   • Добавлено новых: ${added}`);
            console.log(`   • Всего паспортов: ${this.passports.size}`);
            console.log(`   • Подтвержденных паспортов: ${this.stats.confirmedPassports}`);
        }

        return {
            added: added,
            confirmed: confirmed,
            total: passports.length,
            similarity: similarity,
            processedPassports: processedPassports
        };
    }

    // 🔥 ОБРАБОТКА ОДНОГО ПАСПОРТА
    processSinglePassport(passport, sourceId, sourceInfo) {
        const result = {
            status: 'skipped', // added, confirmed, skipped
            passportHash: passport.geometricHash,
            pointId: null,
            message: ''
        };

        // Проверяем валидность паспорта
        if (!passport.geometricHash) {
            result.message = 'Паспорт без geometricHash';
            return result;
        }

        const passportHash = passport.geometricHash;

        // 🔥 ШАГ 1: Ищем СУЩЕСТВУЮЩИЙ паспорт по ТОЧНОМУ хешу
        if (this.passports.has(passportHash)) {
            // НАЙДЕН СУЩЕСТВУЮЩИЙ ПАСПОРТ - ПОДТВЕРЖДАЕМ ЕГО
            const confirmed = this.confirmExistingPassport(passportHash, sourceId, passport);
           
            if (confirmed) {
                result.status = 'confirmed';
                result.message = `Подтвержден существующий паспорт ${passportHash.substring(0, 20)}...`;
                result.pointId = this.passports.get(passportHash).pointId;
            } else {
                result.status = 'skipped';
                result.message = `Паспорт ${passportHash.substring(0, 20)}... уже подтвержден этим источником`;
            }
        } else {
            // НОВЫЙ ПАСПОРТ - ДОБАВЛЯЕМ
            const pointId = this.addNewPassport(passport, sourceId, sourceInfo);
           
            result.status = 'added';
            result.message = `Добавлен новый паспорт ${passportHash.substring(0, 20)}...`;
            result.pointId = pointId;
        }

        return result;
    }

    // 🔥 ПОДТВЕРДИТЬ СУЩЕСТВУЮЩИЙ ПАСПОРТ
    confirmExistingPassport(passportHash, sourceId, newPassport) {
        const passportData = this.passports.get(passportHash);
       
        if (!passportData) {
            return false;
        }

        // Проверяем, не подтверждали ли уже этим источником
        if (passportData.sources.has(sourceId)) {
            if (this.config.enableDebug) {
                console.log(`⚠️ Паспорт ${passportHash.substring(0, 20)}... уже подтвержден источником ${sourceId}`);
            }
            return false;
        }

        // Увеличиваем подтверждения
        passportData.confirmations = (passportData.confirmations || 1) + 1;
        passportData.sources.add(sourceId);
        passportData.lastSeen = new Date();

        // Обновляем точку если нужно
        let pointUpdated = false;
        if (newPassport.coordinates && this.config.preserveCoordinates) {
            const pointId = passportData.pointId;
            if (pointId && this.points.has(pointId)) {
                const point = this.points.get(pointId);
                point.confirmations = passportData.confirmations;
                point.lastSeen = new Date();
               
                // Уточняем координаты (взвешенное среднее)
                const weight = 1.0 / passportData.confirmations;
                point.x = point.x * (1 - weight) + newPassport.coordinates.x * weight;
                point.y = point.y * (1 - weight) + newPassport.coordinates.y * weight;
               
                pointUpdated = true;
            }
        }

        if (this.config.enableDebug) {
            console.log(`✅ Подтвержден паспорт ${passportHash.substring(0, 20)}... (${passportData.confirmations} подтверждений)`);
        }

        return true;
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
            console.log(`🆕 Добавлен новый паспорт ${passportHash.substring(0, 20)}... (точка ${pointId})`);
        }

        return pointId;
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
                distances: passport.distances || [],
                originalPassportHash: passportHash
            }
        };
       
        this.points.set(pointId, pointData);
       
        return pointId;
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
            lastUpdated: this.stats.lastUpdated.toLocaleString('ru-RU'),
            passportDetails: {
                total: this.passports.size,
                confirmed: this.stats.confirmedPassports,
                avgConfirmations: this.passports.size > 0 ?
                    Array.from(this.passports.values()).reduce((sum, p) => sum + p.confirmations, 0) / this.passports.size : 0
            }
        };
    }

    // 🔥 ПОЛУЧИТЬ ВСЕ ТОЧКИ ДЛЯ ВИЗУАЛИЗАЦИИ
    getAllPoints(options = {}) {
        const {
            minConfirmations = 0,
            maxAgeDays = Infinity
        } = options;
       
        const points = [];
        const now = new Date();
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
       
        for (const [pointId, point] of this.points) {
            // Фильтруем по подтверждениям
            if (point.confirmations < minConfirmations) continue;
           
            // Фильтруем по возрасту
            const age = now - point.lastSeen;
            if (age > maxAgeMs) continue;
           
            // Получаем данные паспорта
            const passportData = this.passports.get(point.passportHash);
           
            points.push({
                id: pointId,
                x: point.x,
                y: point.y,
                confirmations: point.confirmations,
                passportHash: point.passportHash,
                patternType: point.metadata?.patternType || 'unknown',
                lastSeen: point.lastSeen,
                firstSeen: point.firstSeen,
                passportConfirmations: passportData?.confirmations || 1,
                type: 'geometric_passport_point',
                metadata: point.metadata
            });
        }
       
        return points;
    }

    // 🔥 ПОЛУЧИТЬ ПАСПОРТЫ ДЛЯ ВИЗУАЛИЗАЦИИ
    getPassportsForVisualization() {
        const passports = [];
       
        for (const [hash, data] of this.passports) {
            const point = this.points.get(data.pointId);
           
            passports.push({
                hash: hash,
                confirmations: data.confirmations,
                sources: Array.from(data.sources),
                patternType: data.passport.patternType,
                pointId: data.pointId,
                coordinates: point || null,
                firstSeen: data.firstSeen,
                lastSeen: data.lastSeen,
                angles: data.passport.angles || [],
                distances: data.passport.distances || []
            });
        }
       
        return passports;
    }

    // 🔥 ДЛЯ СОВМЕСТИМОСТИ СО СТАРЫМ КОДОМ
    getHonestStats() {
        const stats = this.getStats();
        const totalPoints = stats.pointsByConfirmations['1'] + stats.pointsByConfirmations['2'] + stats.pointsByConfirmations['3+'];
       
        return {
            totalPoints: totalPoints,
            confirmed2: stats.pointsByConfirmations['2'] + stats.pointsByConfirmations['3+'],
            confirmed1: stats.pointsByConfirmations['1'],
            confirmed0: 0,
            avgConfidence: 0.7
        };
    }

    // 🔥 ДЛЯ СОВМЕСТИМОСТИ
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
                patternType: point.patternType,
                passportConfirmations: point.passportConfirmations
            }))
        };
    }

    // 🔥 ВИЗУАЛИЗАЦИЯ СТАТИСТИКИ
    visualize() {
        const stats = this.getStats();
        const passportStats = {
            equilateral_triangle: 0,
            right_triangle: 0,
            dense_cluster: 0,
            linear_pattern: 0,
            complex_pattern: 0,
            unknown: 0
        };
       
        // Считаем типы паттернов
        for (const [hash, data] of this.passports) {
            const type = data.passport.patternType || 'unknown';
            if (passportStats[type] !== undefined) {
                passportStats[type]++;
            } else {
                passportStats.unknown++;
            }
        }
       
        console.log(`\n🎯 POINT TRACKER (геометрические паспорта, точные совпадения):`);
        console.log(`├─ Всего паспортов: ${stats.totalPassports}`);
        console.log(`├─ Подтвержденных паспортов (≥${this.config.minPassportConfirmations}): ${stats.confirmedPassports}`);
        console.log(`├─ Всего точек: ${stats.totalPoints}`);
        console.log(`├─ Уникальных источников: ${stats.uniqueSources}`);
        console.log(`├─ Среднее подтверждений: ${stats.passportDetails.avgConfirmations.toFixed(2)}`);
       
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
            _version: '2.1-exact-match',
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
