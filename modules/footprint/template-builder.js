// modules/footprint/template-builder.js
// 🎯 УПРОЩЕННАЯ ВЕРСИЯ: Накопление геометрических паспортов

class TemplateBuilder {
    constructor(options = {}) {
        this.id = `template_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        this.name = options.name || 'Геометрические паттерны';

        // 🔥 ГЕОМЕТРИЧЕСКИЕ ПАСПОРТА ВМЕСТО ТРАНСФОРМАЦИЙ
        this.geometricPassports = new Map(); // hash -> { passport, confirmations, sources }
       
        // 🔥 КАРТА ТОЧЕК (для визуализации)
        this.pointsMap = new Map(); // pointId -> { x, y, hash, confirmations }
       
        // 🔥 ПАТТЕРНЫ СВЯЗЕЙ
        this.patterns = new Map(); // patternType -> { points: [], confirmations: [] }

        // 🔥 СТАТИСТИКА
        this.stats = {
            totalPoints: 0,
            uniquePatterns: 0,
            confirmedPatterns: 0,
            highConfidencePatterns: 0,
            createdAt: new Date(),
            lastUpdated: new Date(),
            totalConfirmations: 0
        };

        // 🔥 НАСТРОЙКИ
        this.config = {
            minConfirmations: options.minConfirmations || 2,
            highConfidenceThreshold: options.highConfidenceThreshold || 3,
            angleTolerance: options.angleTolerance || 5, // градусов
            distanceTolerance: options.distanceTolerance || 0.1, // относительная
            debug: options.debug || false,
            maxPassportsPerPoint: options.maxPassportsPerPoint || 2
        };

        console.log(`🏗️ Создан TemplateBuilder "${this.name}" (геометрические паттерны)`);
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Добавить геометрические паспорта точек
    addGeometricPassports(passports, sourceId, metadata = {}) {
        if (!passports || passports.length === 0) {
            console.log(`⚠️ Нет паспортов для добавления от ${sourceId}`);
            return { success: false, error: 'Нет паспортов' };
        }

        console.log(`📝 Добавляю ${passports.length} геометрических паспортов от ${sourceId}`);

        let added = 0;
        let confirmed = 0;
        let newPatterns = 0;

        passports.forEach(passport => {
            const result = this.processPassport(passport, sourceId, metadata);
           
            if (result.added) added++;
            if (result.confirmed) confirmed++;
            if (result.newPattern) newPatterns++;
        });

        // Обновляем статистику
        this.stats.totalPoints += added;
        this.stats.uniquePatterns = this.geometricPassports.size;
        this.stats.confirmedPatterns = this.getConfirmedPatternsCount();
        this.stats.highConfidencePatterns = this.getHighConfidencePatternsCount();
        this.stats.totalConfirmations = this.getTotalConfirmations();
        this.stats.lastUpdated = new Date();

        console.log(`📊 ИТОГ:`);
        console.log(`   • Новых паспортов: ${added}`);
        console.log(`   • Подтвержденных: ${confirmed}`);
        console.log(`   • Новых паттернов: ${newPatterns}`);
        console.log(`   • Всего паттернов: ${this.geometricPassports.size}`);
        console.log(`   • Высокая уверенность: ${this.stats.highConfidencePatterns}`);

        return {
            success: true,
            added,
            confirmed,
            newPatterns,
            totalPatterns: this.geometricPassports.size,
            stats: { ...this.stats }
        };
    }

    // 🔥 ОБРАБОТКА ОДНОГО ПАСПОРТА
    processPassport(passport, sourceId, metadata) {
        if (!passport || !passport.hash) {
            return { added: false, confirmed: false, newPattern: false };
        }

        const hash = passport.hash;
        const result = { added: false, confirmed: false, newPattern: false };

        // Если паспорт уже есть
        if (this.geometricPassports.has(hash)) {
            const existing = this.geometricPassports.get(hash);
           
            // Увеличиваем подтверждения
            existing.confirmations++;
            existing.lastSeen = new Date();
           
            // Добавляем источник если его нет
            if (!existing.sources.has(sourceId)) {
                existing.sources.add(sourceId);
            }
           
            // Обновляем точку если есть координаты
            if (passport.pointId && passport.coordinates) {
                this.updatePoint(passport.pointId, passport.coordinates, hash, existing.confirmations);
            }
           
            result.confirmed = true;
           
            // Если теперь высокое подтверждение - отмечаем паттерн
            if (existing.confirmations >= this.config.highConfidenceThreshold) {
                this.markPattern(hash, passport, existing.confirmations);
            }
        } else {
            // Новый паспорт
            const newPassport = {
                hash,
                originalPassport: passport,
                confirmations: 1,
                sources: new Set([sourceId]),
                firstSeen: new Date(),
                lastSeen: new Date(),
                metadata: { ...metadata, addedAt: new Date() }
            };
           
            this.geometricPassports.set(hash, newPassport);
           
            // Сохраняем точку если есть координаты
            if (passport.pointId && passport.coordinates) {
                this.addPoint(passport.pointId, passport.coordinates, hash, 1);
            }
           
            result.added = true;
            result.newPattern = true;
        }

        return result;
    }

    // 🔥 ДОБАВЛЕНИЕ ТОЧКИ ДЛЯ ВИЗУАЛИЗАЦИИ
    addPoint(pointId, coordinates, passportHash, confirmations) {
        this.pointsMap.set(pointId, {
            id: pointId,
            x: coordinates.x,
            y: coordinates.y,
            passportHash,
            confirmations,
            firstSeen: new Date(),
            lastSeen: new Date()
        });
    }

    // 🔥 ОБНОВЛЕНИЕ ТОЧКИ
    updatePoint(pointId, coordinates, passportHash, confirmations) {
        if (this.pointsMap.has(pointId)) {
            const point = this.pointsMap.get(pointId);
            point.confirmations = confirmations;
            point.lastSeen = new Date();
           
            // Уточняем координаты (взвешенное среднее)
            const weight = 1.0 / confirmations;
            point.x = point.x * (1 - weight) + coordinates.x * weight;
            point.y = point.y * (1 - weight) + coordinates.y * weight;
        } else {
            this.addPoint(pointId, coordinates, passportHash, confirmations);
        }
    }

    // 🔥 ОТМЕТИТЬ ПАТТЕРН КАК ПОДТВЕРЖДЕННЫЙ
    markPattern(passportHash, passport, confirmations) {
        // Определяем тип паттерна по геометрическим характеристикам
        const patternType = this.determinePatternType(passport);
       
        if (!this.patterns.has(patternType)) {
            this.patterns.set(patternType, {
                type: patternType,
                passportHashes: [passportHash],
                confirmations: [confirmations],
                examples: [passport],
                firstSeen: new Date(),
                lastSeen: new Date()
            });
        } else {
            const pattern = this.patterns.get(patternType);
            pattern.passportHashes.push(passportHash);
            pattern.confirmations.push(confirmations);
            pattern.examples.push(passport);
            pattern.lastSeen = new Date();
        }
    }

    // 🔥 ОПРЕДЕЛЕНИЕ ТИПА ПАТТЕРНА
    determinePatternType(passport) {
        // Анализируем геометрические характеристики
        if (passport.triangles && passport.triangles.length > 0) {
            const triangle = passport.triangles[0];
           
            // Определяем тип треугольника
            if (triangle.angles) {
                const angles = triangle.angles;
                const isEquilateral = angles.every(a => Math.abs(a - 60) < 10);
                const isRight = angles.some(a => Math.abs(a - 90) < 10);
               
                if (isEquilateral) return 'equilateral_triangle';
                if (isRight) return 'right_triangle';
               
                // Сортируем углы для классификации
                const sorted = [...angles].sort((a, b) => a - b);
                return `triangle_${sorted[0].toFixed(0)}_${sorted[1].toFixed(0)}_${sorted[2].toFixed(0)}`;
            }
        }
       
        // Определяем по количеству соседей
        if (passport.neighbors) {
            if (passport.neighbors.length >= 4) return 'dense_cluster';
            if (passport.neighbors.length === 3) return 'triangle_pattern';
            if (passport.neighbors.length === 2) return 'line_pattern';
            if (passport.neighbors.length === 1) return 'pair_pattern';
        }
       
        return 'unknown_pattern';
    }

    // 🔥 ПОЛУЧЕНИЕ ВИЗУАЛИЗАЦИОННЫХ ДАННЫХ
    getVisualizationData() {
        const points = Array.from(this.pointsMap.values());
        const passports = Array.from(this.geometricPassports.values());
        const patterns = Array.from(this.patterns.values());

        // Группируем точки по подтверждениям
        const byConfirmations = {
            confirmed3: points.filter(p => p.confirmations >= 3),
            confirmed2: points.filter(p => p.confirmations === 2),
            confirmed1: points.filter(p => p.confirmations === 1)
        };

        // Статистика паспортов
        const passportStats = {
            total: passports.length,
            byConfidence: {
                high: passports.filter(p => p.confirmations >= 3).length,
                medium: passports.filter(p => p.confirmations === 2).length,
                low: passports.filter(p => p.confirmations === 1).length
            }
        };

        // Анализ паттернов
        const patternAnalysis = patterns.map(pattern => ({
            type: pattern.type,
            frequency: pattern.passportHashes.length,
            avgConfirmations: pattern.confirmations.reduce((a, b) => a + b, 0) / pattern.confirmations.length,
            examples: pattern.examples.length
        }));

        return {
            templateId: this.id,
            name: this.name,
            points: points,
            byConfirmations: byConfirmations,
            passports: passportStats,
            patterns: patternAnalysis,
            stats: {
                ...this.stats,
                pointsByConfidence: {
                    '3+': byConfirmations.confirmed3.length,
                    '2': byConfirmations.confirmed2.length,
                    '1': byConfirmations.confirmed1.length
                },
                patternCount: patterns.length
            }
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    getConfirmedPatternsCount() {
        let count = 0;
        for (const passport of this.geometricPassports.values()) {
            if (passport.confirmations >= this.config.minConfirmations) {
                count++;
            }
        }
        return count;
    }

    getHighConfidencePatternsCount() {
        let count = 0;
        for (const passport of this.geometricPassports.values()) {
            if (passport.confirmations >= this.config.highConfidenceThreshold) {
                count++;
            }
        }
        return count;
    }

    getTotalConfirmations() {
        let total = 0;
        for (const passport of this.geometricPassports.values()) {
            total += passport.confirmations;
        }
        return total;
    }

    // 🔥 ПОИСК ПАСПОРТОВ ПО ТИПУ ПАТТЕРНА
    findPassportsByPattern(patternType) {
        const passports = [];
       
        for (const [hash, passport] of this.geometricPassports) {
            const type = this.determinePatternType(passport.originalPassport);
            if (type === patternType) {
                passports.push({
                    hash,
                    confirmations: passport.confirmations,
                    sources: Array.from(passport.sources),
                    passport: passport.originalPassport
                });
            }
        }
       
        return passports;
    }

    // 🔥 ПРОВЕРКА ПОДТВЕРЖДЕНИЯ ПАТТЕРНА
    isPatternConfirmed(patternType, minConfirmations = 2) {
        const passports = this.findPassportsByPattern(patternType);
       
        if (passports.length === 0) return false;
       
        const avgConfirmations = passports.reduce((sum, p) => sum + p.confirmations, 0) / passports.length;
        return avgConfirmations >= minConfirmations;
    }

    // 🔥 ИНФОРМАЦИЯ О ТЕМПЛЕЙТЕ
    getInfo() {
        const vizData = this.getVisualizationData();
       
        return {
            id: this.id,
            name: this.name,
            stats: {
                ...this.stats,
                createdAt: this.stats.createdAt.toLocaleString('ru-RU'),
                lastUpdated: this.stats.lastUpdated.toLocaleString('ru-RU'),
                patterns: this.patterns.size
            },
            visualization: {
                points: vizData.points.length,
                patterns: vizData.patterns.length,
                confirmedPatterns: vizData.stats.patternCount
            },
            config: this.config
        };
    }

    // 🔥 ПРОСТОЙ ЭКСПОРТ ДЛЯ СОХРАНЕНИЯ
    toJSON() {
        const passportsData = {};
        for (const [hash, passport] of this.geometricPassports) {
            passportsData[hash] = {
                originalPassport: passport.originalPassport,
                confirmations: passport.confirmations,
                sources: Array.from(passport.sources),
                firstSeen: passport.firstSeen,
                lastSeen: passport.lastSeen
            };
        }

        const pointsData = {};
        for (const [pointId, point] of this.pointsMap) {
            pointsData[pointId] = point;
        }

        const patternsData = {};
        for (const [type, pattern] of this.patterns) {
            patternsData[type] = {
                type: pattern.type,
                passportHashes: pattern.passportHashes,
                confirmations: pattern.confirmations,
                firstSeen: pattern.firstSeen,
                lastSeen: pattern.lastSeen
            };
        }

        return {
            id: this.id,
            name: this.name,
            geometricPassports: passportsData,
            pointsMap: pointsData,
            patterns: patternsData,
            stats: this.stats,
            config: this.config,
            _version: '2.0-geometric-passports',
            _savedAt: new Date().toISOString()
        };
    }

    // 🔥 ЗАГРУЗКА ИЗ JSON
    static fromJSON(data) {
        const builder = new TemplateBuilder(data.config || {});
       
        builder.id = data.id || builder.id;
        builder.name = data.name || builder.name;
       
        // Загружаем геометрические паспорта
        if (data.geometricPassports) {
            for (const [hash, passportData] of Object.entries(data.geometricPassports)) {
                builder.geometricPassports.set(hash, {
                    ...passportData,
                    sources: new Set(passportData.sources || []),
                    firstSeen: new Date(passportData.firstSeen),
                    lastSeen: new Date(passportData.lastSeen)
                });
            }
        }
       
        // Загружаем точки
        if (data.pointsMap) {
            for (const [pointId, pointData] of Object.entries(data.pointsMap)) {
                builder.pointsMap.set(pointId, {
                    ...pointData,
                    firstSeen: new Date(pointData.firstSeen),
                    lastSeen: new Date(pointData.lastSeen)
                });
            }
        }
       
        // Загружаем паттерны
        if (data.patterns) {
            for (const [type, patternData] of Object.entries(data.patterns)) {
                builder.patterns.set(type, {
                    ...patternData,
                    firstSeen: new Date(patternData.firstSeen),
                    lastSeen: new Date(patternData.lastSeen)
                });
            }
        }
       
        // Восстанавливаем статистику
        if (data.stats) {
            builder.stats = { ...builder.stats, ...data.stats };
            builder.stats.createdAt = new Date(data.stats.createdAt || Date.now());
            builder.stats.lastUpdated = new Date(data.stats.lastUpdated || Date.now());
        }
       
        console.log(`📂 Загружен TemplateBuilder "${builder.name}"`);
        console.log(`   • Паспортов: ${builder.geometricPassports.size}`);
        console.log(`   • Точек: ${builder.pointsMap.size}`);
        console.log(`   • Паттернов: ${builder.patterns.size}`);
       
        return builder;
    }
}

module.exports = TemplateBuilder;
