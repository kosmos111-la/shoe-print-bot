// modules/footprint/core/comparison/geometric-comparator.js
console.log('🔄 ГЕОМЕТРИЧЕСКИЙ КОМПАРАТОР - АДАПТЕР ДЛЯ СИСТЕМЫ\n');

const GeometricHashAlgorithm = require('./geometric-hash-algorithm');

/**
* 🎯 ГЕОМЕТРИЧЕСКИЙ КОМПАРАТОР
* Адаптирует геометрический алгоритм для работы с системой следов
*/
class GeometricComparator {
    /**
     * КОНСТРУКТОР
     * @param {Object} manager - Менеджер системы следов
     * @param {Object} options - Параметры алгоритма
     */
    constructor(manager, options = {}) {
        this.manager = manager;
       
        // Создаем геометрический алгоритм
        this.geometricAlgorithm = new GeometricHashAlgorithm({
            neighborOffsets: [-2, -1, 1, 2],
            angleTolerance: 10,
            hashPrecision: 5,
            minSimilarity: 0.6,
            minTriangles: 2,
            useNormalization: true,
            debug: options.debug || false,
            ...options
        });
       
        this.debug = options.debug || false;
        this.cache = new Map(); // Кэш геометрических отпечатков
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
    async compareFootprints(footprint1, footprint2, options = {}) {
        if (this.debug) {
            console.log(`🔍 Сравнение следов: ${footprint1.name || 'След 1'} vs ${footprint2.name || 'След 2'}`);
        }
       
        // Извлекаем точки из следов
        const points1 = this.extractPointsFromFootprint(footprint1);
        const points2 = this.extractPointsFromFootprint(footprint2);
       
        if (points1.length < 3 || points2.length < 3) {
            console.warn('⚠️ Слишком мало точек для геометрического сравнения');
            return this.createFallbackResult(points1, points2);
        }
       
        // Создаем или берем из кэша геометрические отпечатки
        const geo1 = this.getOrCreateGeometricFootprint(footprint1, points1);
        const geo2 = this.getOrCreateGeometricFootprint(footprint2, points2);
       
        // Сравниваем геометрические отпечатки
        const result = this.geometricAlgorithm.compareFootprints(geo1, geo2, options);
       
        if (this.debug) {
            this.logComparisonResult(result, footprint1, footprint2);
        }
       
        // Обновляем подтверждения точек если нужно
        if (options.updateConfirmations !== false) {
            this.updateConfirmations(footprint1, footprint2, result.matches);
        }
       
        return {
            ...result,
            footprints: {
                id1: footprint1.id,
                id2: footprint2.id,
                name1: footprint1.name,
                name2: footprint2.name
            }
        };
    }

    /**
     * ОБНОВИТЬ ПОДТВЕРЖДЕНИЯ ТОЧЕК
     * @param {Object} fp1 - Первый след
     * @param {Object} fp2 - Второй след
     * @param {Array} matches - Совпадения
     * @returns {number} Количество обновленных точек
     */
    updateConfirmations(fp1, fp2, matches) {
        const points1 = this.extractPointsFromFootprint(fp1);
        const points2 = this.extractPointsFromFootprint(fp2);
       
        return this.geometricAlgorithm.updatePointConfirmations(points1, points2, matches);
    }

    /**
     * ОБНОВИТЬ ПОДТВЕРЖДЕНИЯ НАПРЯМУЮ (для TemplateCoordination)
     * @param {Object} footprint1 - Первый след
     * @param {Object} footprint2 - Второй след
     * @returns {number} Количество обновленных точек
     */
    updateConfirmationsDirectly(footprint1, footprint2) {
        const points1 = this.extractPointsFromFootprint(footprint1);
        const points2 = this.extractPointsFromFootprint(footprint2);
       
        if (points1.length < 3 || points2.length < 3) return 0;
       
        const geo1 = this.getOrCreateGeometricFootprint(footprint1, points1);
        const geo2 = this.getOrCreateGeometricFootprint(footprint2, points2);
       
        const result = this.geometricAlgorithm.compareFootprints(geo1, geo2, {
            minSimilarity: 0.5
        });
       
        return this.updateConfirmations(footprint1, footprint2, result.matches);
    }

    // ============================================
    // 🔧 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================

    /**
     * ИЗВЛЕЧЬ ТОЧКИ ИЗ СЛЕДА
     */
    extractPointsFromFootprint(footprint) {
        // Поддерживаем разные форматы следов
        if (footprint.getPointsForPatternMatching) {
            return footprint.getPointsForPatternMatching();
        }
       
        if (footprint.pointTracker && footprint.pointTracker.points) {
            return Array.from(footprint.pointTracker.points.values());
        }
       
        if (Array.isArray(footprint.points)) {
            return footprint.points;
        }
       
        if (footprint.points && Array.isArray(footprint.points.list)) {
            return footprint.points.list;
        }
       
        console.warn('⚠️ Неизвестный формат следа:', footprint);
        return [];
    }

    /**
     * ПОЛУЧИТЬ ИЛИ СОЗДАТЬ ГЕОМЕТРИЧЕСКИЙ ОТПЕЧАТОК
     */
    getOrCreateGeometricFootprint(footprint, points) {
        const cacheKey = `${footprint.id}_${footprint.updatedAt || ''}`;
       
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
       
        // Подготавливаем точки для геометрического алгоритма
        const preparedPoints = points.map((point, index) => ({
            id: point.id || `point_${index}`,
            originalId: point.originalId || point.id,
            x: point.x,
            y: point.y,
            confirmedCount: point.confirmedCount || 1,
            confirmedBy: point.confirmedBy || ['initial'],
            lastConfirmed: point.lastConfirmed || new Date()
        }));
       
        const geometricFootprint = this.geometricAlgorithm.createFootprint(
            preparedPoints,
            footprint.name || footprint.id
        );
       
        this.cache.set(cacheKey, geometricFootprint);
        return geometricFootprint;
    }

    /**
     * СОЗДАТЬ РЕЗУЛЬТАТ ДЛЯ МАЛОГО КОЛИЧЕСТВА ТОЧЕК
     */
    createFallbackResult(points1, points2) {
        return {
            matches: [],
            stats: {
                totalPoints1: points1.length,
                totalPoints2: points2.length,
                matchedPoints: 0,
                percent1to2: '0.0',
                percent2to1: '0.0',
                avgSimilarity: 0,
                unconfirmed1: points1.length,
                unconfirmed2: points2.length
            },
            metadata: {
                algorithm: 'fallback',
                reason: 'not_enough_points',
                timestamp: new Date()
            }
        };
    }

    /**
     * ЗАЛОГИРОВАТЬ РЕЗУЛЬТАТ СРАВНЕНИЯ
     */
    logComparisonResult(result, fp1, fp2) {
        const { stats } = result;
       
        console.log('\n📊 РЕЗУЛЬТАТ ГЕОМЕТРИЧЕСКОГО СРАВНЕНИЯ:');
        console.log('='.repeat(50));
        console.log(`След 1: ${fp1.name || fp1.id} (${stats.totalPoints1} точек)`);
        console.log(`След 2: ${fp2.name || fp2.id} (${stats.totalPoints2} точек)`);
        console.log(`Совпало точек: ${stats.matchedPoints}`);
        console.log(`Процент подтверждения:`);
        console.log(`  ${fp1.name || 'След 1'} → ${fp2.name || 'След 2'}: ${stats.percent1to2}%`);
        console.log(`  ${fp2.name || 'След 2'} → ${fp1.name || 'След 1'}: ${stats.percent2to1}%`);
        console.log(`Среднее сходство: ${stats.avgSimilarity}`);
        console.log(`Не подтверждено:`);
        console.log(`  В следе 1: ${stats.unconfirmed1} точек`);
        console.log(`  В следе 2: ${stats.unconfirmed2} точек`);
        console.log('='.repeat(50));
    }

    /**
     * ОЧИСТИТЬ КЭШ
     */
    clearCache() {
        this.cache.clear();
        this.geometricAlgorithm.resetStats();
    }

    /**
     * ПОЛУЧИТЬ СТАТИСТИКУ
     */
    getStats() {
        return {
            geometricAlgorithm: this.geometricAlgorithm.getStats(),
            cacheSize: this.cache.size
        };
    }
}

module.exports = GeometricComparator;
