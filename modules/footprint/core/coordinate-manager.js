// modules/footprint/core/coordinate-manager.js
// 🗺️ ЕДИНЫЙ ИСТОЧНИК КООРДИНАТ ДЛЯ ВСЕЙ СИСТЕМЫ

// 🔥 ЕДИНАЯ ТОЧКА ОТСЧЕТА
const CoordinateSystemConstants = {
    CENTER: { x: 500, y: 500 },
    BOUNDS: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 },
    SCALE: 1.0,
    UNITS: 'pixels'
};

class CoordinateManager {
    constructor(manager) {
        this.manager = manager;
        this.debug = manager?.config?.debug || false;

        // 🔥 НОВЫЙ ФЛАГ: подавлять предупреждения о преобразованиях
        this.suppressTransformationWarnings = true;
        this.warningsLogged = new Set();

        // 🔥 ЕДИНАЯ ТОЧКА ОТСЧЕТА
        this.SYSTEM_CONSTANTS = CoordinateSystemConstants;

        // 🔥 ФОРСИРОВАННЫЕ ПРЕОБРАЗОВАНИЯ ДЛЯ ШАБЛОНА
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

        // Маппинг преобразований
        this.TRANSFORMATION_MAP = {
            'original→normalized': 'normalizePoints',
            'normalized→original': 'denormalizePoints',
            'original→template': 'normalizedToTemplate',
            'template→original': 'templateToOriginal',
            'tracker→original': 'trackerToOriginal',
            'original→tracker': 'originalToTracker',
            'graph→original': 'graphToOriginal',
            'original→graph': 'originalToGraph',
            'tracker→normalized': 'trackerToNormalized',
            'normalized→tracker': 'normalizedToTracker',
            'graph→normalized': 'graphToNormalized',
            'normalized→graph': 'normalizedToGraph',
            'any→canonical': 'toCanonicalSystem',
            'canonical→any': 'fromCanonicalSystem'
        };

        // Кэш для производительности
        this.coordinateCache = new Map();
        this.transformationCache = new Map();

        console.log('🗺️ CoordinateManager создан: единый источник координат для всей системы');
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Нормализация точек
    normalizePoints(points, transformation = null) {
        if (!points || points.length === 0) return [];

        const RotationInvariance = require('../rotation-invariance');
        const processor = new RotationInvariance({ debug: false });

        let rotationAngle = 0;
        if (transformation && transformation.rotationAngle !== undefined) {
            rotationAngle = transformation.rotationAngle;
        } else if (points.length >= 3) {
            rotationAngle = processor.detectRotationAngle(points);
        }

        // 1. Поворачиваем к 0°
        let rotatedPoints = points;
        if (Math.abs(rotationAngle) > 0.1) {
            rotatedPoints = processor.transformPointsSimple(points, rotationAngle, 0);
        }

        // 🔥 2. ЦЕНТРИРУЕМ К ЕДИНОМУ ЦЕНТРУ (500, 500)
        const targetCenter = this.SYSTEM_CONSTANTS.CENTER;
        const centeredPoints = processor.alignPointsToCommonSystem(rotatedPoints, targetCenter);

        // 3. Проверяем, что центрирование сработало
        const finalCenter = this.calculateCenter(centeredPoints);
        const centerDistance = Math.sqrt(
            Math.pow(finalCenter.x - targetCenter.x, 2) +
            Math.pow(finalCenter.y - targetCenter.y, 2)
        );

        if (centerDistance > 10 && !this.suppressTransformationWarnings) {
            console.log(`⚠️ Центр после нормализации далеко от цели: ${centerDistance.toFixed(1)}px`);
        }

        return centeredPoints.map((p, i) => ({
            ...p,
            _normalized: true,
            _rotationAngle: rotationAngle,
            _originalIndex: i,
            coordinateSystem: this.COORDINATE_SYSTEMS.NORMALIZED,
            _systemCenter: targetCenter
        }));
    }

    // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Преобразование из шаблона
    templateToOriginal(points, transformation) {
        // Всегда центрируем шаблон в единую систему
        return points.map(p => ({
            ...p,
            _fromTemplate: true,
            x: (p.nx || 0) * 1000,
            y: (p.ny || 0) * 1000,
            // 🔥 СДВИГ К ЕДИНОМУ ЦЕНТРУ
            x: (p.x || 0) + this.SYSTEM_CONSTANTS.CENTER.x - 500,
            y: (p.y || 0) + this.SYSTEM_CONSTANTS.CENTER.y - 500
        }));
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Получить точки в нужной системе координат
    getCoordinates(source, options = {}) {
        const {
            coordinateSystem = this.COORDINATE_SYSTEMS.ORIGINAL,
            includeMetadata = false,
            forceRecalculate = false,
            debug = false,
            suppressWarnings = true
        } = options;

        const cacheKey = `${source?.id || 'unknown'}_${coordinateSystem}_${JSON.stringify(options)}`;

        if (!forceRecalculate && this.coordinateCache.has(cacheKey)) {
            if (debug) console.log(`🗺️ [CACHE] Использую кэшированные координаты для ${cacheKey}`);
            return this.coordinateCache.get(cacheKey);
        }

        const shouldLog = debug || (this.debug && !suppressWarnings);

        if (shouldLog) {
            console.log(`🗺️ [GET] Получаю координаты: ${this.getSourceType(source)} → ${coordinateSystem}`);
        }

        let points = [];
        let transformation = null;
        let sourceSystem = this.COORDINATE_SYSTEMS.ORIGINAL;

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
            points = this.validatePoints(source, suppressWarnings);
            sourceSystem = this.detectCoordinateSystem(points) || this.COORDINATE_SYSTEMS.ORIGINAL;
        }
        else {
            if (!suppressWarnings) {
                console.log('⚠️ [CoordinateManager] Неизвестный источник координат');
            }
            points = [];
        }

        if (coordinateSystem !== sourceSystem && points.length > 0) {
            if (shouldLog) {
                console.log(`🗺️ [TRANSFORM] Преобразую из ${sourceSystem} в ${coordinateSystem}`);
            }

            points = this.transformToSystem(points, sourceSystem, coordinateSystem, transformation, suppressWarnings);
        }

        points = this.validatePoints(points, suppressWarnings);

        if (points.length === 0 && !suppressWarnings) {
            console.log('⚠️ [CoordinateManager] Нет точек после преобразования');
        }

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

        this.coordinateCache.set(cacheKey, result);

        if (shouldLog) {
            console.log(`🗺️ [RESULT] Получено ${points.length} точек в системе ${coordinateSystem}`);
        }

        return result;
    }

    transformToSystem(points, fromSystem, toSystem, transformation = null, suppressWarnings = true) {
        if (!points || points.length === 0) return [];
        if (fromSystem === toSystem) return points;

        let transformedPoints = points.map(p => ({
            ...p,
            _originalX: p.x,
            _originalY: p.y,
            _transformed: false
        }));

        try {
            const transformKey = `${fromSystem}→${toSystem}`;

            if (this.TRANSFORMATION_MAP[transformKey]) {
                const methodName = this.TRANSFORMATION_MAP[transformKey];
                if (typeof this[methodName] === 'function') {
                    transformedPoints = this[methodName](transformedPoints, transformation);

                    if (!suppressWarnings && this.debug) {
                        console.log(`🗺️ [TRANSFORM] Использую прямое преобразование: ${transformKey}`);
                    }
                } else {
                    if (!suppressWarnings) {
                        this.logTransformationWarning(transformKey, 'method_not_implemented');
                    }
                    transformedPoints = this.generalTransformation(transformedPoints, fromSystem, toSystem, transformation, suppressWarnings);
                }
            } else {
                if (!suppressWarnings) {
                    this.logTransformationWarning(transformKey, 'no_direct_mapping');
                }
                transformedPoints = this.generalTransformation(transformedPoints, fromSystem, toSystem, transformation, suppressWarnings);
            }

            transformedPoints = transformedPoints.map(p => ({
                ...p,
                _transformed: true,
                _fromSystem: fromSystem,
                _toSystem: toSystem
            }));

            return transformedPoints;

        } catch (error) {
            if (!suppressWarnings) {
                console.log(`❌ [CoordinateManager] Ошибка преобразования ${fromSystem}→${toSystem}:`, error.message);
            }
            return points.map(p => ({
                ...p,
                _error: `transform failed: ${error.message}`,
                _transformationFailed: true
            }));
        }
    }

    logTransformationWarning(transformKey, warningType) {
        const warningKey = `transform_warning_${transformKey}_${warningType}`;

        if (!this.warningsLogged.has(warningKey)) {
            this.warningsLogged.add(warningKey);

            let message;
            switch (warningType) {
                case 'method_not_implemented':
                    const methodName = this.TRANSFORMATION_MAP[transformKey];
                    message = `⚠️ [CoordinateManager] Преобразование ${transformKey}: метод "${methodName}" еще не реализован`;
                    break;

                case 'no_direct_mapping':
                    message = `⚠️ [CoordinateManager] Преобразование ${transformKey}: нет в маппинге, использую общее`;
                    break;

                default:
                    message = `⚠️ [CoordinateManager] Преобразование ${transformKey}: ${warningType}`;
            }

            console.log(message);
        }
    }

    generalTransformation(points, fromSystem, toSystem, transformation, suppressWarnings = true) {
        const canonicalPoints = this.toCanonicalSystem(points, fromSystem, transformation, suppressWarnings);
        return this.fromCanonicalSystem(canonicalPoints, toSystem, transformation, suppressWarnings);
    }

    // Другие методы преобразования
    denormalizePoints(points, transformation) {
        if (!points || points.length === 0) return points;

        const RotationInvariance = require('../rotation-invariance');
        const processor = new RotationInvariance({ debug: false });

        if (!transformation || !transformation.rotationAngle) {
            console.log('⚠️ Нет трансформации для обратной нормализации');
            return points;
        }

        const originalCenter = transformation.center || { x: 0, y: 0 };
        const centeredPoints = points.map(p => ({
            ...p,
            x: (p.x || 0) - 500 + originalCenter.x,
            y: (p.y || 0) - 500 + originalCenter.y
        }));

        const rotationAngle = transformation.rotationAngle || 0;
        const rotatedPoints = processor.transformPointsSimple(centeredPoints, 0, rotationAngle);

        return rotatedPoints.map(p => ({
            ...p,
            _denormalized: true,
            _originalRotation: rotationAngle
        }));
    }

    normalizedToTemplate(points, transformation) {
        return points.map(p => ({
            ...p,
            _inTemplateSystem: true,
            _templateTransformation: 'placeholder'
        }));
    }

    trackerToOriginal(points, transformation) {
        return points.map(p => ({
            ...p,
            _transformation: 'tracker→original',
            _method: 'direct'
        }));
    }

    originalToTracker(points, transformation) {
        return points.map(p => ({
            ...p,
            _transformation: 'original→tracker',
            _method: 'direct',
            confirmedCount: p.confirmedCount || 1,
            rating: p.confidence || 0.5
        }));
    }

    graphToOriginal(points, transformation) {
        return points.map(p => ({
            ...p,
            _transformation: 'graph→original',
            _method: 'direct'
        }));
    }

    originalToGraph(points, transformation) {
        return points.map(p => ({
            ...p,
            _transformation: 'original→graph',
            _method: 'direct',
            confidence: p.confidence || 0.5
        }));
    }

    trackerToNormalized(points, transformation) {
        const originalPoints = this.trackerToOriginal(points, transformation);
        return this.normalizePoints(originalPoints, transformation);
    }

    normalizedToTracker(points, transformation) {
        const originalPoints = this.denormalizePoints(points, transformation);
        return this.originalToTracker(originalPoints, transformation);
    }

    graphToNormalized(points, transformation) {
        const originalPoints = this.graphToOriginal(points, transformation);
        return this.normalizePoints(originalPoints, transformation);
    }

    normalizedToGraph(points, transformation) {
        const originalPoints = this.denormalizePoints(points, transformation);
        return this.originalToGraph(originalPoints, transformation);
    }

    validatePoints(points, suppressWarnings = true) {
        if (!points || !Array.isArray(points)) {
            if (!suppressWarnings) {
                console.log('⚠️ [CoordinateManager] Некорректный массив точек');
            }
            return [];
        }

        const validPoints = [];
        let invalidCount = 0;

        points.forEach((point, index) => {
            if (point.x === undefined || point.y === undefined) {
                if (!suppressWarnings && invalidCount < 3) {
                    console.log(`⚠️ [CoordinateManager] Точка ${index} без координат`);
                }
                invalidCount++;
                return;
            }

            if (isNaN(point.x) || isNaN(point.y) ||
                !isFinite(point.x) || !isFinite(point.y)) {
                if (!suppressWarnings && invalidCount < 3) {
                    console.log(`⚠️ [CoordinateManager] Точка ${index} с некорректными координатами`);
                }
                invalidCount++;
                return;
            }

            if (Math.abs(point.x) < 0.001 && Math.abs(point.y) < 0.001) {
                point._nearZero = true;
            }

            validPoints.push(point);
        });

        if (invalidCount > 0 && !suppressWarnings) {
            console.log(`⚠️ [CoordinateManager] Отброшено ${invalidCount} некорректных точек`);
        }

        return validPoints;
    }

    toCanonicalSystem(points, fromSystem, transformation, suppressWarnings = true) {
        if (fromSystem === this.COORDINATE_SYSTEMS.NORMALIZED) {
            return points;
        }

        if (!suppressWarnings && this.debug) {
            console.log(`🗺️ [CANONICAL] Преобразую ${fromSystem} → normalized`);
        }

        const normalized = this.transformToSystem(
            points,
            fromSystem,
            this.COORDINATE_SYSTEMS.NORMALIZED,
            transformation,
            suppressWarnings
        );

        return normalized;
    }

    fromCanonicalSystem(points, toSystem, transformation, suppressWarnings = true) {
        if (toSystem === this.COORDINATE_SYSTEMS.NORMALIZED) {
            return points;
        }

        if (!suppressWarnings && this.debug) {
            console.log(`🗺️ [CANONICAL] Преобразую normalized → ${toSystem}`);
        }

        return this.transformToSystem(
            points,
            this.COORDINATE_SYSTEMS.NORMALIZED,
            toSystem,
            transformation,
            suppressWarnings
        );
    }

    // Вспомогательные методы
    getSourceType(source) {
        if (this.isFootprint(source)) return 'footprint';
        if (this.isGraph(source)) return 'graph';
        if (this.isPointTracker(source)) return 'tracker';
        if (this.isTemplateBuilder(source)) return 'template';
        if (Array.isArray(source)) return 'array';
        return 'unknown';
    }

    isFootprint(source) {
        return source && typeof source === 'object' && 'isFootprint' in source;
    }

    isGraph(source) {
        return source && typeof source === 'object' && 'isGraph' in source;
    }

    isPointTracker(source) {
        return source && typeof source === 'object' && 'isPointTracker' in source;
    }

    isTemplateBuilder(source) {
        return source && typeof source === 'object' && 'isTemplateBuilder' in source;
    }

    detectCoordinateSystem(points) {
        if (!points || points.length === 0) return null;

        const firstPoint = points[0];

        if (firstPoint._normalized) return this.COORDINATE_SYSTEMS.NORMALIZED;
        if (firstPoint._inTemplateSystem) return this.COORDINATE_SYSTEMS.TEMPLATE;
        if (firstPoint.confirmedCount !== undefined) return this.COORDINATE_SYSTEMS.TRACKER;
        if (firstPoint.confidence !== undefined) return this.COORDINATE_SYSTEMS.GRAPH;

        return this.COORDINATE_SYSTEMS.ORIGINAL;
    }

    getCoordinatesFromFootprint(footprint, coordinateSystem, options) {
        const points = footprint.getPoints ? footprint.getPoints() : [];
        const transformation = footprint.getTransformation ? footprint.getTransformation() : null;

        return {
            points: points,
            transformation: transformation,
            sourceSystem: this.COORDINATE_SYSTEMS.ORIGINAL
        };
    }

    getCoordinatesFromGraph(graph, coordinateSystem, options) {
        const points = graph.getNodes ? graph.getNodes().map(node => ({ x: node.x, y: node.y, confidence: node.confidence })) : [];

        return {
            points: points,
            transformation: null,
            sourceSystem: this.COORDINATE_SYSTEMS.GRAPH
        };
    }

    getCoordinatesFromPointTracker(tracker, coordinateSystem, options) {
        const points = tracker.getPoints ? tracker.getPoints().map(point => ({
            x: point.x,
            y: point.y,
            confirmedCount: point.confirmedCount || 0,
            rating: point.rating || 0
        })) : [];

        return {
            points: points,
            transformation: null,
            sourceSystem: this.COORDINATE_SYSTEMS.TRACKER
        };
    }

    getCoordinatesFromTemplateBuilder(builder, coordinateSystem, options) {
        const template = builder.getTemplate ? builder.getTemplate() : null;
        const points = template?.points || [];

        return {
            points: points,
            transformation: template?.transformation || null,
            sourceSystem: this.COORDINATE_SYSTEMS.TEMPLATE
        };
    }

    generateMetadata(source, points) {
        return {
            timestamp: new Date().toISOString(),
            pointCount: points.length,
            sourceType: this.getSourceType(source),
            bounds: this.calculateBounds(points),
            averageConfidence: this.calculateAverageConfidence(points)
        };
    }

    calculateBounds(points) {
        if (!points || points.length === 0) return null;

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
    }

    calculateAverageConfidence(points) {
        if (!points || points.length === 0) return 0;

        const pointsWithConfidence = points.filter(p => p.confidence !== undefined);
        if (pointsWithConfidence.length === 0) return 0;

        const sum = pointsWithConfidence.reduce((acc, p) => acc + p.confidence, 0);
        return sum / pointsWithConfidence.length;
    }

    calculateCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };

        const sumX = points.reduce((acc, p) => acc + (p.x || 0), 0);
        const sumY = points.reduce((acc, p) => acc + (p.y || 0), 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    diagnoseSystem(source, options = {}) {
        const { debug = true, suppressWarnings = false } = options;

        const sourceType = this.getSourceType(source);
        console.log(`\n🔍 ДИАГНОСТИКА СИСТЕМЫ КООРДИНАТ:`);
        console.log(`   Источник: ${sourceType}`);
        console.log(`   ID: ${source?.id || source?.name || 'unknown'}`);

        const systems = Object.values(this.COORDINATE_SYSTEMS);
        const results = {};

        systems.forEach(system => {
            try {
                const coords = this.getCoordinates(source, {
                    coordinateSystem: system,
                    debug: false,
                    forceRecalculate: true,
                    suppressWarnings: true
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
        });

        return results;
    }

    clearWarningHistory() {
        const count = this.warningsLogged.size;
        this.warningsLogged.clear();
        console.log(`🗺️ [CoordinateManager] Очищена история предупреждений (было: ${count})`);
    }
}

module.exports = CoordinateManager;
