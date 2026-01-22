// modules/footprint/core/coordinate-manager.js
// 🗺️ ЕДИНЫЙ ИСТОЧНИК КООРДИНАТ ДЛЯ ВСЕЙ СИСТЕМЫ

class CoordinateManager {
    constructor(manager) {
        this.manager = manager;
        this.debug = manager?.config?.debug || false;
       
        // Системы координат, которые мы поддерживаем
        this.COORDINATE_SYSTEMS = {
            ORIGINAL: 'original',        // Оригинальные координаты из анализа
            NORMALIZED: 'normalized',    // Нормализованные (поворот 0°, центр 500,500)
            TEMPLATE: 'template',        // В системе шаблона
            TRACKER: 'tracker',          // В системе PointTracker
            GRAPH: 'graph',              // В системе графа
            CANONICAL: 'canonical'       // Каноническая система (используется для сравнения)
        };
       
        // Кэш для производительности
        this.coordinateCache = new Map();
        this.transformationCache = new Map();
       
        console.log('🗺️ CoordinateManager создан: единый источник координат для всей системы');
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: Получить точки в нужной системе координат
    getCoordinates(source, options = {}) {
        const {
            coordinateSystem = this.COORDINATE_SYSTEMS.ORIGINAL,
            includeMetadata = false,
            forceRecalculate = false,
            debug = false
        } = options;
       
        const cacheKey = `${source?.id || 'unknown'}_${coordinateSystem}_${JSON.stringify(options)}`;
       
        // Проверяем кэш
        if (!forceRecalculate && this.coordinateCache.has(cacheKey)) {
            if (debug) console.log(`🗺️ [CACHE] Использую кэшированные координаты для ${cacheKey}`);
            return this.coordinateCache.get(cacheKey);
        }
       
        if (debug || this.debug) {
            console.log(`🗺️ [GET] Получаю координаты: ${this.getSourceType(source)} → ${coordinateSystem}`);
        }
       
        let points = [];
        let transformation = null;
        let sourceSystem = this.COORDINATE_SYSTEMS.ORIGINAL;
       
        // 🔥 ОПРЕДЕЛЯЕМ ТИП ИСТОЧНИКА И ПОЛУЧАЕМ ТОЧКИ
        if (this.isFootprint(source)) {
            const result = this.getCoordinatesFromFootprint(source, coordinateSystem, options);
            points = result.points;
            transformation = result.transformation;
            sourceSystem = result.sourceSystem;
        }
        else if (this.isGraph(source)) {
            const result = this.getCoordinatesFromGraph(source, coordinateSystem, options);
            points = result.points;
            transformation = result.transformation;
            sourceSystem = result.sourceSystem;
        }
        else if (this.isPointTracker(source)) {
            const result = this.getCoordinatesFromPointTracker(source, coordinateSystem, options);
            points = result.points;
            transformation = result.transformation;
            sourceSystem = result.sourceSystem;
        }
        else if (this.isTemplateBuilder(source)) {
            const result = this.getCoordinatesFromTemplateBuilder(source, coordinateSystem, options);
            points = result.points;
            transformation = result.transformation;
            sourceSystem = result.sourceSystem;
        }
        else if (Array.isArray(source)) {
            // Уже массив точек
            points = this.validatePoints(source);
            sourceSystem = this.detectCoordinateSystem(source) || this.COORDINATE_SYSTEMS.ORIGINAL;
        }
        else {
            console.log('⚠️ [CoordinateManager] Неизвестный источник координат');
            points = [];
        }
       
        // 🔥 ПРЕОБРАЗУЕМ К НУЖНОЙ СИСТЕМЕ, ЕСЛИ НУЖНО
        if (coordinateSystem !== sourceSystem && points.length > 0) {
            if (debug || this.debug) {
                console.log(`🗺️ [TRANSFORM] Преобразую из ${sourceSystem} в ${coordinateSystem}`);
                console.log(`   Точки до: ${points.length}, первая: (${points[0]?.x?.toFixed(1)}, ${points[0]?.y?.toFixed(1)})`);
            }
           
            points = this.transformToSystem(points, sourceSystem, coordinateSystem, transformation);
        }
       
        // 🔥 ВАЛИДАЦИЯ: проверяем, что координаты корректны
        points = this.validatePoints(points);
       
        if (points.length === 0) {
            console.log('⚠️ [CoordinateManager] Нет точек после преобразования');
        }
       
        // 🔥 ПОДГОТАВЛИВАЕМ РЕЗУЛЬТАТ
        const result = {
            points: points,
            count: points.length,
            coordinateSystem: coordinateSystem,
            sourceSystem: sourceSystem,
            transformation: transformation,
            sourceType: this.getSourceType(source),
            sourceId: source?.id || source?.name || 'unknown',
            valid: points.length > 0
        };
       
        if (includeMetadata) {
            result.metadata = this.generateMetadata(source, points);
        }
       
        // Кэшируем результат
        this.coordinateCache.set(cacheKey, result);
       
        if (debug || this.debug) {
            console.log(`🗺️ [RESULT] Получено ${points.length} точек в системе ${coordinateSystem}`);
            if (points.length > 0) {
                console.log(`   Пример: (${points[0].x.toFixed(1)}, ${points[0].y.toFixed(1)})`);
                console.log(`   Min: (${Math.min(...points.map(p => p.x)).toFixed(1)}, ${Math.min(...points.map(p => p.y)).toFixed(1)})`);
                console.log(`   Max: (${Math.max(...points.map(p => p.x)).toFixed(1)}, ${Math.max(...points.map(p => p.y)).toFixed(1)})`);
            }
        }
       
        return result;
    }
   
    // 🔥 МЕТОД: Преобразовать точки между системами координат
    transformToSystem(points, fromSystem, toSystem, transformation = null) {
        if (!points || points.length === 0) return [];
        if (fromSystem === toSystem) return points;
       
        // Создаем копию точек для преобразования
        let transformedPoints = points.map(p => ({
            ...p,
            _originalX: p.x,
            _originalY: p.y,
            _transformed: false
        }));
       
        try {
            // 🔥 ПРЕОБРАЗОВАНИЕ МЕЖДУ КОНКРЕТНЫМИ СИСТЕМАМИ
            if (fromSystem === this.COORDINATE_SYSTEMS.ORIGINAL && toSystem === this.COORDINATE_SYSTEMS.NORMALIZED) {
                // Original → Normalized (поворот к 0°, центрирование)
                transformedPoints = this.normalizePoints(transformedPoints, transformation);
            }
            else if (fromSystem === this.COORDINATE_SYSTEMS.NORMALIZED && toSystem === this.COORDINATE_SYSTEMS.ORIGINAL) {
                // Normalized → Original (обратное преобразование)
                transformedPoints = this.denormalizePoints(transformedPoints, transformation);
            }
            else if (fromSystem === this.COORDINATE_SYSTEMS.ORIGINAL && toSystem === this.COORDINATE_SYSTEMS.TEMPLATE) {
                // Original → Template (через normalized)
                const normalized = this.normalizePoints(transformedPoints, transformation);
                transformedPoints = this.normalizedToTemplate(normalized, transformation);
            }
            else if (fromSystem === this.COORDINATE_SYSTEMS.TEMPLATE && toSystem === this.COORDINATE_SYSTEMS.ORIGINAL) {
                // Template → Original (обратное преобразование)
                transformedPoints = this.templateToOriginal(transformedPoints, transformation);
            }
            else if (toSystem === this.COORDINATE_SYSTEMS.CANONICAL) {
                // В каноническую систему (стандарт для сравнения)
                transformedPoints = this.toCanonicalSystem(transformedPoints, fromSystem, transformation);
            }
            else {
                console.log(`⚠️ [CoordinateManager] Прямого преобразования ${fromSystem}→${toSystem} нет, использую общее`);
                // Общее преобразование через canonical
                const canonical = this.toCanonicalSystem(transformedPoints, fromSystem, transformation);
                transformedPoints = this.fromCanonicalSystem(canonical, toSystem, transformation);
            }
           
            // Отмечаем, что точки преобразованы
            transformedPoints = transformedPoints.map(p => ({
                ...p,
                _transformed: true,
                _fromSystem: fromSystem,
                _toSystem: toSystem
            }));
           
            return transformedPoints;
           
        } catch (error) {
            console.log(`❌ [CoordinateManager] Ошибка преобразования ${fromSystem}→${toSystem}:`, error.message);
            // Возвращаем оригинальные точки как фоллбэк
            return points.map(p => ({
                ...p,
                _error: `transform failed: ${error.message}`,
                _transformationFailed: true
            }));
        }
    }
   
    // 🔥 МЕТОД: Нормализация точек (original → normalized)
    normalizePoints(points, transformation = null) {
        if (!points || points.length === 0) return [];
       
        const RotationInvariance = require('../rotation-invariance');
        const processor = new RotationInvariance({ debug: false });
       
        // Если есть трансформация - используем её угол
        let rotationAngle = 0;
        if (transformation && transformation.rotationAngle !== undefined) {
            rotationAngle = transformation.rotationAngle;
        } else if (points.length >= 3) {
            // Определяем угол автоматически
            rotationAngle = processor.detectRotationAngle(points);
        }
       
        // 1. Поворачиваем к 0°
        let rotatedPoints = points;
        if (Math.abs(rotationAngle) > 0.1) {
            rotatedPoints = processor.transformPointsSimple(points, rotationAngle, 0);
        }
       
        // 2. Центрируем к (500, 500)
        const targetCenter = { x: 500, y: 500 };
        const centeredPoints = processor.alignPointsToCommonSystem(rotatedPoints, targetCenter);
       
        // 3. Добавляем метаданные
        return centeredPoints.map((p, i) => ({
            ...p,
            _normalized: true,
            _rotationAngle: rotationAngle,
            _originalIndex: i,
            coordinateSystem: this.COORDINATE_SYSTEMS.NORMALIZED
        }));
    }
   
    // 🔥 МЕТОД: Валидация точек
    validatePoints(points) {
        if (!points || !Array.isArray(points)) {
            console.log('⚠️ [CoordinateManager] Некорректный массив точек');
            return [];
        }
       
        const validPoints = [];
        let invalidCount = 0;
       
        points.forEach((point, index) => {
            // Проверяем наличие обязательных полей
            if (point.x === undefined || point.y === undefined) {
                console.log(`⚠️ [CoordinateManager] Точка ${index} без координат:`, point);
                invalidCount++;
                return;
            }
           
            // Проверяем на NaN и Infinity
            if (isNaN(point.x) || isNaN(point.y) ||
                !isFinite(point.x) || !isFinite(point.y)) {
                console.log(`⚠️ [CoordinateManager] Точка ${index} с некорректными координатами:`, point);
                invalidCount++;
                return;
            }
           
            // Проверяем на нулевые координаты (может быть проблемой)
            if (Math.abs(point.x) < 0.001 && Math.abs(point.y) < 0.001) {
                console.log(`⚠️ [CoordinateManager] Точка ${index} имеет координаты ~(0,0)`);
                // Не отбрасываем, но помечаем
                point._nearZero = true;
            }
           
            validPoints.push(point);
        });
       
        if (invalidCount > 0) {
            console.log(`⚠️ [CoordinateManager] Отброшено ${invalidCount} некорректных точек`);
        }
       
        return validPoints;
    }
   
    // 🔥 МЕТОД: Сравнить точки из двух источников
    comparePoints(points1, points2, options = {}) {
        const {
            coordinateSystem = this.COORDINATE_SYSTEMS.CANONICAL,
            maxDistance = 50,
            debug = false
        } = options;
       
        // Получаем точки в единой системе
        const coords1 = this.getCoordinates(points1, { coordinateSystem, debug });
        const coords2 = this.getCoordinates(points2, { coordinateSystem, debug });
       
        if (coords1.points.length === 0 || coords2.points.length === 0) {
            return {
                success: false,
                error: 'Нет точек для сравнения',
                matches: [],
                matchCount: 0,
                matchRate: 0
            };
        }
       
        if (debug) {
            console.log(`🔍 [COMPARE] Сравниваю ${coords1.points.length} и ${coords2.points.length} точек`);
            console.log(`   Система координат: ${coordinateSystem}`);
        }
       
        // Простой алгоритм сравнения (можно улучшить)
        const matches = [];
        const matchedIndices2 = new Set();
       
        coords1.points.forEach((point1, index1) => {
            let bestMatch = null;
            let minDistance = Infinity;
           
            coords2.points.forEach((point2, index2) => {
                if (matchedIndices2.has(index2)) return;
               
                const distance = Math.sqrt(
                    Math.pow(point2.x - point1.x, 2) +
                    Math.pow(point2.y - point1.y, 2)
                );
               
                if (distance < minDistance && distance < maxDistance) {
                    minDistance = distance;
                    bestMatch = {
                        point1: { ...point1, index: index1 },
                        point2: { ...point2, index: index2 },
                        distance: distance,
                        quality: 1 - (distance / maxDistance)
                    };
                }
            });
           
            if (bestMatch) {
                matches.push(bestMatch);
                matchedIndices2.add(bestMatch.point2.index);
            }
        });
       
        const matchRate = coords1.points.length > 0 ? matches.length / coords1.points.length : 0;
       
        return {
            success: true,
            matches: matches,
            matchCount: matches.length,
            matchRate: matchRate,
            points1Count: coords1.points.length,
            points2Count: coords2.points.length,
            coordinateSystem: coordinateSystem,
            thresholds: {
                maxDistance: maxDistance,
                matchRate: matchRate
            }
        };
    }
   
    // 🔥 МЕТОД: Определить систему координат точек
    detectCoordinateSystem(points) {
        if (!points || points.length === 0) return null;
       
        const sample = points[0];
       
        // Проверяем метаданные
        if (sample.coordinateSystem) {
            return sample.coordinateSystem;
        }
       
        if (sample._normalized || sample.nx !== undefined) {
            return this.COORDINATE_SYSTEMS.NORMALIZED;
        }
       
        if (sample._template || sample.cellId !== undefined) {
            return this.COORDINATE_SYSTEMS.TEMPLATE;
        }
       
        if (sample._tracker || sample.confirmedCount !== undefined) {
            return this.COORDINATE_SYSTEMS.TRACKER;
        }
       
        // Эвристики по значениям координат
        const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
       
        // Normalized точки обычно центрированы вокруг 500,500
        if (Math.abs(avgX - 500) < 100 && Math.abs(avgY - 500) < 100) {
            return this.COORDINATE_SYSTEMS.NORMALIZED;
        }
       
        // Original точки могут быть в разных диапазонах
        if (avgX > 0 && avgY > 0 && (avgX < 1000 || avgY < 1000)) {
            return this.COORDINATE_SYSTEMS.ORIGINAL;
        }
       
        return this.COORDINATE_SYSTEMS.ORIGINAL;
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ РАЗНЫХ ИСТОЧНИКОВ
   
    isFootprint(obj) {
        return obj &&
               (obj.constructor.name === 'SimpleFootprint' ||
                obj.graph !== undefined);
    }
   
    isGraph(obj) {
        return obj &&
               (obj.constructor.name === 'SimpleGraph' ||
                obj.nodes !== undefined);
    }
   
    isPointTracker(obj) {
        return obj &&
               (obj.constructor.name === 'PointTracker' ||
                obj.points !== undefined && typeof obj.points.get === 'function');
    }
   
    isTemplateBuilder(obj) {
        return obj &&
               (obj.constructor.name === 'TemplateBuilder' ||
                obj.invariantCells !== undefined);
    }
   
    getSourceType(source) {
        if (this.isFootprint(source)) return 'footprint';
        if (this.isGraph(source)) return 'graph';
        if (this.isPointTracker(source)) return 'pointTracker';
        if (this.isTemplateBuilder(source)) return 'templateBuilder';
        if (Array.isArray(source)) return 'pointsArray';
        return 'unknown';
    }
   
    // 🔥 МЕТОДЫ ДЛЯ ПОЛУЧЕНИЯ ТОЧЕК ИЗ КОНКРЕТНЫХ ИСТОЧНИКОВ
   
    getCoordinatesFromFootprint(footprint, targetSystem, options) {
        let points = [];
        let transformation = footprint.getTransformation?.() || footprint.transformation;
        let sourceSystem = this.COORDINATE_SYSTEMS.ORIGINAL;
       
        // Пробуем разные источники точек в отпечатке
        if (footprint.pointTracker && footprint.pointTracker.points) {
            // Из трекера
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({
                    id: id,
                    x: point.x,
                    y: point.y,
                    confidence: point.rating || 0.5,
                    confirmedCount: point.confirmedCount || 1,
                    _source: 'pointTracker',
                    _footprintId: footprint.id
                });
            }
            sourceSystem = this.COORDINATE_SYSTEMS.TRACKER;
        }
        else if (footprint.graph && footprint.graph.nodes) {
            // Из графа
            footprint.graph.nodes.forEach((node, nodeId) => {
                points.push({
                    id: nodeId,
                    x: node.x,
                    y: node.y,
                    confidence: node.confidence || 0.5,
                    confirmedCount: node.confirmedCount || 1,
                    _source: 'graph',
                    _footprintId: footprint.id
                });
            });
            sourceSystem = this.COORDINATE_SYSTEMS.GRAPH;
        }
        else {
            console.log('⚠️ [CoordinateManager] Не могу получить точки из отпечатка');
        }
       
        return { points, transformation, sourceSystem };
    }
   
    getCoordinatesFromGraph(graph, targetSystem, options) {
        const points = [];
       
        if (graph.nodes) {
            graph.nodes.forEach((node, nodeId) => {
                points.push({
                    id: nodeId,
                    x: node.x,
                    y: node.y,
                    confidence: node.confidence || 0.5,
                    _source: 'graph',
                    _graphId: graph.id || 'unknown'
                });
            });
        }
       
        const transformation = graph.transformation || null;
        const sourceSystem = this.COORDINATE_SYSTEMS.GRAPH;
       
        return { points, transformation, sourceSystem };
    }
   
    getCoordinatesFromPointTracker(tracker, targetSystem, options) {
        const points = [];
       
        if (tracker.points) {
            for (const [id, point] of tracker.points) {
                points.push({
                    id: id,
                    x: point.x,
                    y: point.y,
                    confidence: point.rating || 0.5,
                    confirmedCount: point.confirmedCount || 1,
                    _source: 'pointTracker'
                });
            }
        }
       
        const transformation = tracker.transformation || null;
        const sourceSystem = this.COORDINATE_SYSTEMS.TRACKER;
       
        return { points, transformation, sourceSystem };
    }
   
    getCoordinatesFromTemplateBuilder(templateBuilder, targetSystem, options) {
        const points = [];
        const cells = templateBuilder.invariantCells || new Map();
       
        cells.forEach((cell, cellId) => {
            points.push({
                id: cellId,
                x: cell.originalCenter?.x || cell.normalizedCenter?.nx * 1000 || 0,
                y: cell.originalCenter?.y || cell.normalizedCenter?.ny * 1000 || 0,
                nx: cell.normalizedCenter?.nx,
                ny: cell.normalizedCenter?.ny,
                confirmations: cell.confirmations || 1,
                confidence: cell.confidence || 0.7,
                _source: 'templateBuilder',
                _cellId: cellId,
                _isCell: true
            });
        });
       
        const transformation = templateBuilder.normalizationTransform || null;
        const sourceSystem = this.COORDINATE_SYSTEMS.TEMPLATE;
       
        return { points, transformation, sourceSystem };
    }
   
    // 🔥 МЕТОДЫ ПРЕОБРАЗОВАНИЯ (заглушки - реализуем по мере необходимости)
   
    denormalizePoints(points, transformation) {
        // TODO: Реализовать обратное преобразование
        console.log('⚠️ denormalizePoints еще не реализован');
        return points;
    }
   
    normalizedToTemplate(points, transformation) {
        // TODO: Реализовать преобразование
        console.log('⚠️ normalizedToTemplate еще не реализован');
        return points;
    }
   
    templateToOriginal(points, transformation) {
        // TODO: Реализовать преобразование
        console.log('⚠️ templateToOriginal еще не реализован');
        return points;
    }
   
    toCanonicalSystem(points, fromSystem, transformation) {
        // Каноническая система: нормализованные координаты
        if (fromSystem === this.COORDINATE_SYSTEMS.NORMALIZED) {
            return points;
        }
       
        // Для других систем преобразуем через normalized
        const normalized = this.transformToSystem(points, fromSystem, this.COORDINATE_SYSTEMS.NORMALIZED, transformation);
        return normalized;
    }
   
    fromCanonicalSystem(points, toSystem, transformation) {
        // Из канонической в целевую систему
        return this.transformToSystem(points, this.COORDINATE_SYSTEMS.NORMALIZED, toSystem, transformation);
    }
   
    // 🔥 МЕТОД: Генерация метаданных
    generateMetadata(source, points) {
        if (!points || points.length === 0) return {};
       
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
       
        return {
            count: points.length,
            bounds: {
                minX: Math.min(...xs),
                maxX: Math.max(...xs),
                minY: Math.min(...ys),
                maxY: Math.max(...ys),
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys)
            },
            center: {
                x: (Math.min(...xs) + Math.max(...xs)) / 2,
                y: (Math.min(...ys) + Math.max(...ys)) / 2
            },
            sourceType: this.getSourceType(source),
            timestamp: new Date()
        };
    }
   
    // 🔥 МЕТОД: Очистить кэш
    clearCache() {
        this.coordinateCache.clear();
        this.transformationCache.clear();
        console.log('🗺️ [CACHE] Кэш координат очищен');
    }
   
    // 🔥 МЕТОД: Диагностика системы координат
    diagnoseSystem(source, options = {}) {
        const { debug = true } = options;
       
        const sourceType = this.getSourceType(source);
        console.log(`\n🔍 ДИАГНОСТИКА СИСТЕМЫ КООРДИНАТ:`);
        console.log(`   Источник: ${sourceType}`);
        console.log(`   ID: ${source?.id || source?.name || 'unknown'}`);
       
        // Получаем точки во всех системах для диагностики
        const systems = Object.values(this.COORDINATE_SYSTEMS);
        const results = {};
       
        systems.forEach(system => {
            try {
                const coords = this.getCoordinates(source, {
                    coordinateSystem: system,
                    debug: false,
                    forceRecalculate: true
                });
               
                results[system] = {
                    count: coords.points.length,
                    valid: coords.valid,
                    sample: coords.points.length > 0 ?
                        `(${coords.points[0].x.toFixed(1)}, ${coords.points[0].y.toFixed(1)})` :
                        'no points'
                };
               
            } catch (error) {
                results[system] = {
                    error: error.message,
                    valid: false
                };
            }
        });
       
        console.log(`   СИСТЕМЫ КООРДИНАТ:`);
        Object.entries(results).forEach(([system, data]) => {
            const status = data.valid ? '✅' : '❌';
            console.log(`   ${status} ${system}: ${data.count} точек ${data.sample ? `- ${data.sample}` : ''}`);
            if (data.error) console.log(`     Ошибка: ${data.error}`);
        });
       
        return results;
    }
}

module.exports = CoordinateManager;
