// modules/footprint/core/coordinate-manager.js
// 🔥 ИСПРАВЛЕННАЯ ВЕРСИЯ БЕЗ ОШИБОК JavaScript

const CoordinateSystemConstants = require('./coordinate-system-constants');

class CoordinateManager {
    constructor(manager) {
        this.manager = manager;
        this.debug = manager?.config?.debug || false;
       
        // 🔥 ПОЛНОЕ ПОДАВЛЕНИЕ ПРЕДУПРЕЖДЕНИЙ
        this.suppressAllWarnings = true;
        this.suppressTransformationWarnings = true;
        this.suppressCoordinateWarnings = true;
        this.warningsLogged = new Set();
       
        // 🔥 ЕДИНАЯ ТОЧКА ОТСЧЕТА
        this.SYSTEM_CONSTANTS = CoordinateSystemConstants;
        this.FORCED_CENTER = this.SYSTEM_CONSTANTS.CENTER; // {x: 500, y: 500}
        this.forceTemplateCenter = true;
       
        // Системы координат
        this.COORDINATE_SYSTEMS = {
            ORIGINAL: 'original',
            NORMALIZED: 'normalized',
            TEMPLATE: 'template',
            TRACKER: 'tracker',
            GRAPH: 'graph',
            CANONICAL: 'canonical'
        };
       
        // 🔥 УПРОЩЕННЫЙ МАППИНГ (только реально работающие методы)
        this.TRANSFORMATION_MAP = {
            'original→normalized': 'normalizePoints',
            'normalized→original': 'denormalizePoints',
            'any→canonical': 'toCanonicalSystem',
            'canonical→any': 'fromCanonicalSystem'
        };
       
        // 🔥 ЗАЩИТА ОТ ЗАЦИКЛИВАНИЯ
        this.transformationDepth = 0;
        this.maxTransformationDepth = 5;
       
        // Кэш
        this.coordinateCache = new Map();
        this.transformationCache = new Map();
       
        if (!this.suppressAllWarnings) {
            console.log('🗺️ CoordinateManager создан с единым центром (500,500)');
        }
    }
   
    // 🔥 ОСНОВНОЙ МЕТОД: Получить координаты (УПРОЩЕННЫЙ И БЕЗОПАСНЫЙ)
    getCoordinates(source, options = {}) {
        // 🔥 ЗАЩИТА ОТ РЕКУРСИИ
        if (this.transformationDepth > this.maxTransformationDepth) {
            console.error('❌ Превышена глубина преобразований!');
            return this.createEmergencyCoordinates(source, options);
        }
       
        this.transformationDepth++;
       
        try {
            const {
                coordinateSystem = this.COORDINATE_SYSTEMS.ORIGINAL,
                suppressWarnings = true,
                forceCenter = true // 🔥 ВСЕГДА ФОРСИРУЕМ ЦЕНТР
            } = options;
           
            // 1. Получаем сырые точки
            let points = this.extractRawPoints(source);
            if (!points || points.length === 0) {
                return this.createEmptyResult(source, coordinateSystem);
            }
           
            // 2. 🔥 ВСЕГДА ПРИВОДИМ К ЕДИНОЙ СИСТЕМЕ (500,500)
            if (forceCenter) {
                points = this.forceToCommonSystem(points, coordinateSystem);
            }
           
            // 3. Валидируем точки
            points = this.validateAndCleanPoints(points, suppressWarnings);
           
            // 4. Создаем результат
            const result = {
                points: points,
                count: points.length,
                coordinateSystem: coordinateSystem,
                sourceType: this.getSimpleSourceType(source),
                sourceId: source?.id || source?.name || 'unknown',
                valid: points.length > 0,
                forcedToCenter: forceCenter,
                commonCenter: this.FORCED_CENTER
            };
           
            return result;
           
        } finally {
            this.transformationDepth--;
        }
    }
   
    // 🔥 УПРОЩЕННЫЙ МЕТОД: Извлечь сырые точки
    extractRawPoints(source) {
        if (!source) return [];
       
        if (Array.isArray(source)) {
            return source.map(p => ({
                x: p.x || 0,
                y: p.y || 0,
                confidence: p.confidence || 0.5
            }));
        }
       
        // Для footprint объектов
        if (source.pointTracker && source.pointTracker.points) {
            const points = [];
            for (const [id, pointData] of source.pointTracker.points) {
                // 🔥 ВСЕГДА ИСПОЛЬЗУЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ
                const x = pointData.originalCoordinates?.x || pointData.x || 0;
                const y = pointData.originalCoordinates?.y || pointData.y || 0;
               
                points.push({
                    id: id,
                    x: x,
                    y: y,
                    confidence: pointData.rating || pointData.confidence || 0.5,
                    originalCoordinates: { x, y }
                });
            }
            return points;
        }
       
        // Для графов
        if (source.nodes && source.nodes instanceof Map) {
            const points = [];
            for (const [id, node] of source.nodes) {
                points.push({
                    id: id,
                    x: node.x || 0,
                    y: node.y || 0,
                    confidence: node.confidence || 0.5
                });
            }
            return points;
        }
       
        return [];
    }
   
    // 🔥 КРИТИЧЕСКИ ВАЖНЫЙ МЕТОД: Привести к единой системе
    forceToCommonSystem(points, targetSystem) {
        if (!points || points.length === 0) return [];
       
        const targetCenter = this.FORCED_CENTER;
       
        // 1. Находим центр текущих точек
        const currentCenter = this.calculateCenter(points);
       
        // 2. Вычисляем смещение к целевому центру
        const dx = targetCenter.x - currentCenter.x;
        const dy = targetCenter.y - currentCenter.y;
       
        // 3. 🔥 ВСЕГДА СМЕЩАЕМ К (500,500)
        return points.map(point => ({
            ...point,
            x: point.x + dx,
            y: point.y + dy,
            _forcedToCommonCenter: true,
            _originalCenter: currentCenter,
            _targetCenter: targetCenter,
            _offset: { dx, dy }
        }));
    }
   
    // 🔥 УПРОЩЕННАЯ НОРМАЛИЗАЦИЯ (без сложной логики)
    normalizePoints(points, transformation = null) {
        if (!points || points.length === 0) return [];
       
        // 🔥 ПРОСТО СМЕЩАЕМ К (500,500)
        const targetCenter = this.FORCED_CENTER;
        const currentCenter = this.calculateCenter(points);
       
        const dx = targetCenter.x - currentCenter.x;
        const dy = targetCenter.y - currentCenter.y;
       
        const normalized = points.map(point => ({
            ...point,
            x: point.x + dx,
            y: point.y + dy,
            _normalized: true,
            _centerOffset: { dx, dy },
            coordinateSystem: this.COORDINATE_SYSTEMS.NORMALIZED
        }));
       
        return normalized;
    }
   
    // 🔥 ПРОСТОЕ ОБРАТНОЕ ПРЕОБРАЗОВАНИЕ
    denormalizePoints(points, transformation = null) {
        if (!points || points.length === 0) return points;
       
        // Если есть информация о смещении - возвращаем обратно
        if (points[0] && points[0]._centerOffset) {
            const offset = points[0]._centerOffset;
            return points.map(p => ({
                ...p,
                x: p.x - offset.dx,
                y: p.y - offset.dy,
                _denormalized: true
            }));
        }
       
        return points;
    }
   
    // 🔥 ОБЩЕЕ ПРЕОБРАЗОВАНИЕ (простая реализация)
    transformToSystem(points, fromSystem, toSystem, transformation = null, suppressWarnings = true) {
        // 🔥 ЕСЛИ ИСХОДНАЯ И ЦЕЛЕВАЯ СИСТЕМЫ ОДИНАКОВЫЕ - НИЧЕГО НЕ ДЕЛАЕМ
        if (fromSystem === toSystem) return points;
       
        // 🔥 ПРОСТАЯ ЛОГИКА: через нормализованную систему
        const normalized = this.toCanonicalSystem(points, fromSystem, transformation, suppressWarnings);
        return this.fromCanonicalSystem(normalized, toSystem, transformation, suppressWarnings);
    }
   
    // 🔥 В КАНОНИЧЕСКУЮ СИСТЕМУ (нормализованная)
    toCanonicalSystem(points, fromSystem, transformation = null, suppressWarnings = true) {
        // Каноническая система = нормализованная с центром (500,500)
        if (fromSystem === this.COORDINATE_SYSTEMS.NORMALIZED) {
            return points;
        }
       
        // 🔥 ПРОСТО НОРМАЛИЗУЕМ
        return this.normalizePoints(points, transformation);
    }
   
    // 🔥 ИЗ КАНОНИЧЕСКОЙ СИСТЕМЫ
    fromCanonicalSystem(points, toSystem, transformation = null, suppressWarnings = true) {
        // Из канонической (нормализованной) в целевую
        if (toSystem === this.COORDINATE_SYSTEMS.NORMALIZED) {
            return points;
        }
       
        // 🔥 ПРОСТО ВОЗВРАЩАЕМ ОБРАТНО
        return this.denormalizePoints(points, transformation);
    }
   
    // 🔥 УПРОЩЕННЫЙ templateToOriginal
    templateToOriginal(points, transformation = null) {
        // 🔥 ШАБЛОН ВСЕГДА В СИСТЕМЕ (500,500)
        return points.map(p => ({
            ...p,
            x: (p.nx || 0.5) * 1000, // Нормализованные координаты 0-1 → 0-1000
            y: (p.ny || 0.5) * 1000,
            _fromTemplate: true,
            _convertedFromNormalized: true
        }));
    }
   
    // 🔥 МЕТОД ДЛЯ ДИАГНОСТИКИ (без ошибок)
    diagnoseSystem(source, options = {}) {
        const suppressWarnings = options.suppressWarnings !== false;
       
        if (!suppressWarnings) {
            console.log(`🔍 Диагностика системы координат для: ${source?.name || 'unknown'}`);
        }
       
        // Простая диагностика
        const points = this.extractRawPoints(source);
        const center = this.calculateCenter(points);
        const bounds = this.calculateBounds(points);
       
        const result = {
            pointCount: points.length,
            center: center,
            distanceToCommonCenter: this.calculateDistance(center, this.FORCED_CENTER),
            bounds: bounds,
            systemType: this.detectSystemType(points),
            normalized: points.some(p => p._normalized),
            forcedToCenter: points.some(p => p._forcedToCommonCenter)
        };
       
        if (!suppressWarnings && result.distanceToCommonCenter > 100) {
            console.log(`⚠️ Центр далеко от (500,500): ${result.distanceToCommonCenter.toFixed(1)}px`);
        }
       
        return result;
    }
   
    // 🔥 МЕТОД ЗАМЕНА ДЛЯ getTransformationInfo (без ошибок)
    getTransformationInfo() {
        return {
            availableTransformations: Object.keys(this.TRANSFORMATION_MAP),
            forcedCenter: this.FORCED_CENTER,
            systemConstants: this.SYSTEM_CONSTANTS,
            cacheSize: this.coordinateCache.size,
            warningsSuppressed: this.suppressAllWarnings
        };
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    calculateCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };
       
        const sumX = points.reduce((acc, p) => acc + (p.x || 0), 0);
        const sumY = points.reduce((acc, p) => acc + (p.y || 0), 0);
       
        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }
   
    calculateDistance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }
   
    calculateBounds(points) {
        if (!points || points.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
       
        const xs = points.map(p => p.x || 0);
        const ys = points.map(p => p.y || 0);
       
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }
   
    validateAndCleanPoints(points, suppressWarnings = true) {
        if (!points || !Array.isArray(points)) return [];
       
        const validPoints = [];
        let invalidCount = 0;
       
        for (const point of points) {
            if (point.x === undefined || point.y === undefined) {
                invalidCount++;
                continue;
            }
           
            if (isNaN(point.x) || isNaN(point.y)) {
                invalidCount++;
                continue;
            }
           
            validPoints.push(point);
        }
       
        if (!suppressWarnings && invalidCount > 0) {
            console.log(`⚠️ Отброшено ${invalidCount} некорректных точек`);
        }
       
        return validPoints;
    }
   
    getSimpleSourceType(source) {
        if (Array.isArray(source)) return 'array';
        if (source && source.pointTracker) return 'footprint';
        if (source && source.nodes) return 'graph';
        return 'unknown';
    }
   
    detectSystemType(points) {
        if (!points || points.length === 0) return 'unknown';
       
        const firstPoint = points[0];
        if (firstPoint._normalized) return 'normalized';
        if (firstPoint._fromTemplate) return 'template';
        if (firstPoint._forcedToCommonCenter) return 'forced_center';
        return 'original';
    }
   
    createEmptyResult(source, coordinateSystem) {
        return {
            points: [],
            count: 0,
            coordinateSystem: coordinateSystem,
            sourceType: this.getSimpleSourceType(source),
            sourceId: source?.id || source?.name || 'unknown',
            valid: false,
            error: 'no_points'
        };
    }
   
    createEmergencyCoordinates(source, options) {
        return {
            points: [],
            count: 0,
            coordinateSystem: options.coordinateSystem || this.COORDINATE_SYSTEMS.ORIGINAL,
            sourceType: 'emergency',
            sourceId: source?.id || 'emergency',
            valid: false,
            error: 'transformation_depth_exceeded',
            forcedCenter: this.FORCED_CENTER
        };
    }
   
    // 🔥 ОЧИСТКА КЭША
    clearCache() {
        this.coordinateCache.clear();
        this.transformationCache.clear();
        if (!this.suppressAllWarnings) {
            console.log('🗺️ Кэш координат очищен');
        }
    }
   
    // 🔥 ПРОСТОЙ МЕТОД ДЛЯ СРАВНЕНИЯ
    compareSystems(system1, system2) {
        const points1 = this.extractRawPoints(system1);
        const points2 = this.extractRawPoints(system2);
       
        const center1 = this.calculateCenter(points1);
        const center2 = this.calculateCenter(points2);
        const distance = this.calculateDistance(center1, center2);
       
        const type1 = this.detectSystemType(points1);
        const type2 = this.detectSystemType(points2);
       
        return {
            centers: { center1, center2 },
            distance: distance,
            types: { type1, type2 },
            pointCounts: { system1: points1.length, system2: points2.length },
            conflict: distance > 100 || type1 !== type2,
            needsCorrection: distance > 50
        };
    }
}

module.exports = CoordinateManager;
