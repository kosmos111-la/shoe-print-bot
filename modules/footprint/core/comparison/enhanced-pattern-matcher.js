// modules/footprint/core/comparison/enhanced-pattern-matcher.js
console.log('🎯 УЛУЧШЕННЫЙ PATTERN MATCHER С ГЕОМЕТРИЧЕСКИМ АЛГОРИТМОМ\n');

const GeometricComparator = require('./geometric-comparator');

/**
* 🎯 УЛУЧШЕННЫЙ PATTERN MATCHER
* Комбинирует старый алгоритм с геометрическим
*/
class EnhancedPatternMatcher {
    /**
     * КОНСТРУКТОР
     * @param {Object} manager - Менеджер системы
     * @param {Object} options - Опции
     */
    constructor(manager, options = {}) {
        this.manager = manager;
        this.options = options;
       
        // Создаем геометрический компаратор
        this.geometricComparator = new GeometricComparator(manager, {
            debug: options.debug || false,
            ...options.geometric
        });
       
        // Сохраняем оригинальный PatternMatcher если есть
        this.originalMatcher = options.originalMatcher;
       
        this.debug = options.debug || false;
        this.useGeometricAsPrimary = options.useGeometricAsPrimary !== false;
    }

    // ============================================
    // 🎯 ОСНОВНОЙ ИНТЕРФЕЙС
    // ============================================

    /**
     * СРАВНИТЬ ДВА СЛЕДА
     * @param {Object} footprint1 - Первый след
     * @param {Object} footprint2 - Второй след
     * @param {Object} options - Опции сравнения
     * @returns {Object} Результат сравнения
     */
    async compare(footprint1, footprint2, options = {}) {
        const startTime = Date.now();
       
        if (this.debug) {
            console.log(`🔍 Улучшенное сравнение: ${footprint1.name} vs ${footprint2.name}`);
        }
       
        // Используем геометрический алгоритм как основной
        if (this.useGeometricAsPrimary) {
            return await this.compareWithGeometric(footprint1, footprint2, options);
        }
       
        // Или комбинируем оба алгоритма
        return await this.compareHybrid(footprint1, footprint2, options);
    }

    /**
     * СРАВНИТЬ С ГЕОМЕТРИЧЕСКИМ АЛГОРИТМОМ
     */
    async compareWithGeometric(footprint1, footprint2, options) {
        try {
            const result = await this.geometricComparator.compareFootprints(
                footprint1,
                footprint2,
                options
            );
           
            // Добавляем метаданные
            result.metadata.comparisonMethod = 'geometric-primary';
            result.metadata.success = result.stats.matchedPoints > 0;
           
            return result;
           
        } catch (error) {
            console.error('❌ Ошибка геометрического сравнения:', error);
           
            // Фолбэк на оригинальный алгоритм
            if (this.originalMatcher) {
                console.log('🔄 Использую оригинальный алгоритм как фолбэк');
                return await this.originalMatcher.compare(footprint1, footprint2, options);
            }
           
            throw error;
        }
    }

    /**
     * ГИБРИДНОЕ СРАВНЕНИЕ
     */
    async compareHybrid(footprint1, footprint2, options) {
        const results = {};
        const startTime = Date.now();
       
        // 1. Сначала геометрическое сравнение
        try {
            const geoResult = await this.geometricComparator.compareFootprints(
                footprint1,
                footprint2,
                { ...options, updateConfirmations: false }
            );
            results.geometric = geoResult;
        } catch (error) {
            console.warn('⚠️ Геометрическое сравнение не удалось:', error.message);
        }
       
        // 2. Затем оригинальное сравнение (если есть)
        if (this.originalMatcher) {
            try {
                const originalResult = await this.originalMatcher.compare(
                    footprint1,
                    footprint2,
                    { ...options, updateConfirmations: false }
                );
                results.original = originalResult;
            } catch (error) {
                console.warn('⚠️ Оригинальное сравнение не удалось:', error.message);
            }
        }
       
        // 3. Объединяем результаты
        const combinedResult = this.combineResults(results, footprint1, footprint2);
       
        // 4. Обновляем подтверждения
        if (options.updateConfirmations !== false) {
            this.updateCombinedConfirmations(footprint1, footprint2, combinedResult.matches);
        }
       
        combinedResult.metadata.comparisonTime = Date.now() - startTime;
        combinedResult.metadata.comparisonMethod = 'hybrid';
       
        return combinedResult;
    }

    /**
     * ОБНОВИТЬ ПОДТВЕРЖДЕНИЯ (для TemplateCoordination)
     */
    updateConfirmationsDirectly(footprint1, footprint2) {
        return this.geometricComparator.updateConfirmationsDirectly(footprint1, footprint2);
    }

    // ============================================
    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================

    /**
     * ОБЪЕДИНИТЬ РЕЗУЛЬТАТЫ
     */
    combineResults(results, fp1, fp2) {
        const allMatches = [];
        const matchedIds = new Set();
       
        // Собираем все уникальные совпадения
        if (results.geometric && results.geometric.matches) {
            results.geometric.matches.forEach(match => {
                const key = `${match.point1.id}_${match.point2.id}`;
                if (!matchedIds.has(key)) {
                    allMatches.push({
                        ...match,
                        source: 'geometric'
                    });
                    matchedIds.add(key);
                }
            });
        }
       
        if (results.original && results.original.matches) {
            results.original.matches.forEach(match => {
                const key = `${match.point1.id}_${match.point2.id}`;
                if (!matchedIds.has(key)) {
                    allMatches.push({
                        ...match,
                        source: 'original'
                    });
                    matchedIds.add(key);
                }
            });
        }
       
        // Вычисляем статистику
        const points1 = this.geometricComparator.extractPointsFromFootprint(fp1);
        const points2 = this.geometricComparator.extractPointsFromFootprint(fp2);
       
        const total1 = points1.length;
        const total2 = points2.length;
        const matched = allMatches.length;
       
        return {
            matches: allMatches,
            stats: {
                totalPoints1: total1,
                totalPoints2: total2,
                matchedPoints: matched,
                percent1to2: total1 > 0 ? ((matched / total1) * 100).toFixed(1) : '0.0',
                percent2to1: total2 > 0 ? ((matched / total2) * 100).toFixed(1) : '0.0',
                unconfirmed1: total1 - matched,
                unconfirmed2: total2 - matched,
                geometricMatches: results.geometric ? results.geometric.matches.length : 0,
                originalMatches: results.original ? results.original.matches.length : 0
            },
            metadata: {
                algorithm: 'hybrid',
                sources: Object.keys(results),
                timestamp: new Date()
            }
        };
    }

    /**
     * ОБНОВИТЬ КОМБИНИРОВАННЫЕ ПОДТВЕРЖДЕНИЯ
     */
    updateCombinedConfirmations(fp1, fp2, matches) {
        const points1 = this.geometricComparator.extractPointsFromFootprint(fp1);
        const points2 = this.geometricComparator.extractPointsFromFootprint(fp2);
       
        let updatedCount = 0;
       
        matches.forEach(match => {
            const point1 = points1.find(p => p.id === match.point1.id);
            const point2 = points2.find(p => p.id === match.point2.id);
           
            if (point1 && point2) {
                // Обновляем подтверждения
                if (point1.confirmedCount !== undefined) {
                    point1.confirmedCount++;
                    point1.confirmedBy = point1.confirmedBy || [];
                    point1.confirmedBy.push(`hybrid_${match.source}_${match.point2.id}`);
                    point1.lastConfirmed = new Date();
                }
               
                if (point2.confirmedCount !== undefined) {
                    point2.confirmedCount++;
                    point2.confirmedBy = point2.confirmedBy || [];
                    point2.confirmedBy.push(`hybrid_${match.source}_${match.point1.id}`);
                    point2.lastConfirmed = new Date();
                }
               
                updatedCount++;
            }
        });
       
        return updatedCount;
    }

    /**
     * ПОЛУЧИТЬ СТАТИСТИКУ
     */
    getStats() {
        return {
            geometric: this.geometricComparator.getStats(),
            useGeometricAsPrimary: this.useGeometricAsPrimary
        };
    }

    /**
     * ИЗМЕНИТЬ РЕЖИМ РАБОТЫ
     */
    setMode(mode) {
        if (mode === 'geometric' || mode === 'hybrid' || mode === 'original') {
            this.useGeometricAsPrimary = mode === 'geometric';
            console.log(`🔄 Режим сравнения изменен на: ${mode}`);
        }
    }
}

module.exports = EnhancedPatternMatcher;
