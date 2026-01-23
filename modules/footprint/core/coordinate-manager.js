// modules/footprint/core/coordinate-manager.js
// 🗺️ ЕДИНЫЙ ИСТОЧНИК КООРДИНАТ ДЛЯ ВСЕЙ СИСТЕМЫ (ИСПРАВЛЕННЫЙ)

// 🔥 ДОБАВЛЯЕМ КОНСТАНТЫ СИСТЕМЫ КООРДИНАТ
const CoordinateSystemConstants = {
    CENTER: { x: 500, y: 500 }, // Единый центр для всей системы
    SCALE_FACTOR: 1000,
    NORMALIZED_RANGE: { min: 0, max: 1000 },
    TEMPLATE_RANGE: { min: 0, max: 1 }
};

class CoordinateManager {
    constructor(manager) {
        this.manager = manager;
        this.debug = manager?.config?.debug || false;

        // 🔥 НОВЫЙ ФЛАГ: подавлять предупреждения о преобразованиях
        this.suppressTransformationWarnings = true;
        this.warningsLogged = new Set(); // Для отслеживания уже залогированных предупреждений

        // Системы координат, которые мы поддерживаем
        this.COORDINATE_SYSTEMS = {
            ORIGINAL: 'original',        // Оригинальные координаты из анализа
            NORMALIZED: 'normalized',    // Нормализованные (поворот 0°, центр 500,500)
            TEMPLATE: 'template',        // В системе шаблона
            TRACKER: 'tracker',          // В системе PointTracker
            GRAPH: 'graph',              // В системе графа
            CANONICAL: 'canonical'       // Каноническая система (используется для сравнения)
        };

        // Маппинг преобразований для быстрого доступа
        this.TRANSFORMATION_MAP = {
            // 🔥 ДОБАВЛЯЕМ ПРЯМЫЕ ПРЕОБРАЗОВАНИЯ ДЛЯ ВСЕХ КОМБИНАЦИЙ
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

        // 🔥 ЕДИНАЯ ТОЧКА ОТСЧЕТА
        this.SYSTEM_CONSTANTS = CoordinateSystemConstants;

        // 🔥 ФОРСИРОВАННЫЕ ПРЕОБРАЗОВАНИЯ ДЛЯ ШАБЛОНА
        this.forceTemplateCenter = true; // Всегда центрировать шаблон в (500,500)

        // Кэш для производительности
        this.coordinateCache = new Map();
        this.transformationCache = new Map();

        console.log('🗺️ CoordinateManager создан: единый источник координат для всей системы');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Получить точки в нужной системе координат (ОБНОВЛЕННЫЙ)
    getCoordinates(source, options = {}) {
        const {
            coordinateSystem = this.COORDINATE_SYSTEMS.ORIGINAL,
            includeMetadata = false,
            forceRecalculate = false,
            debug = false,
            suppressWarnings = true // 🔥 НОВЫЙ ПАРАМЕТР
        } = options;

        const cacheKey = `${source?.id || 'unknown'}_${coordinateSystem}_${JSON.stringify(options)}`;

        // Проверяем кэш
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
            points = this.validatePoints(source, suppressWarnings);
            sourceSystem = this.detectCoordinateSystem(points) || this.COORDINATE_SYSTEMS.ORIGINAL;
        }
        else {
            if (!suppressWarnings) {
                console.log('⚠️ [CoordinateManager] Неизвестный источник координат');
            }
            points = [];
        }

        // 🔥 ПРЕОБРАЗУЕМ К НУЖНОЙ СИСТЕМЕ, ЕСЛИ НУЖНО
        if (coordinateSystem !== sourceSystem && points.length > 0) {
            if (shouldLog) {
                console.log(`🗺️ [TRANSFORM] Преобразую из ${sourceSystem} в ${coordinateSystem}`);
                console.log(`   Точки до: ${points.length}, первая: (${points[0]?.x?.toFixed(1)}, ${points[0]?.y?.toFixed(1)})`);
            }

            points = this.transformToSystem(points, sourceSystem, coordinateSystem, transformation, suppressWarnings);
        }

        // 🔥 ВАЛИДАЦИЯ: проверяем, что координаты корректны
        points = this.validatePoints(points, suppressWarnings);

        if (points.length === 0 && !suppressWarnings) {
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

        if (shouldLog) {
            console.log(`🗺️ [RESULT] Получено ${points.length} точек в системе ${coordinateSystem}`);
            if (points.length > 0) {
                console.log(`   Пример: (${points[0].x.toFixed(1)}, ${points[0].y.toFixed(1)})`);
                console.log(`   Min: (${Math.min(...points.map(p => p.x)).toFixed(1)}, ${Math.min(...points.map(p => p.y)).toFixed(1)})`);
                console.log(`   Max: (${Math.max(...points.map(p => p.x)).toFixed(1)}, ${Math.max(...points.map(p => p.y)).toFixed(1)})`);
            }
        }

        return result;
    }

    // 🔥 МЕТОД: Преобразовать точки между системами координат (ИСПРАВЛЕННЫЙ)
    transformToSystem(points, fromSystem, toSystem, transformation = null, suppressWarnings = true) {
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
            // 🔥 ИСПОЛЬЗУЕМ МАППИНГ ПРЕОБРАЗОВАНИЙ
            const transformKey = `${fromSystem}→${toSystem}`;

            // Проверяем, есть ли прямое преобразование
            if (this.TRANSFORMATION_MAP[transformKey]) {
                // Есть прямое преобразование
                const methodName = this.TRANSFORMATION_MAP[transformKey];
                if (typeof this[methodName] === 'function') {
                    // Метод реализован - используем его
                    transformedPoints = this[methodName](transformedPoints, transformation);

                    if (!suppressWarnings && this.debug) {
                        console.log(`🗺️ [TRANSFORM] Использую прямое преобразование: ${transformKey} (${methodName})`);
                    }
                } else {
                    // Метод еще не реализован
                    if (!suppressWarnings) {
                        this.logTransformationWarning(transformKey, 'method_not_implemented');
                    }
                    // Используем общее преобразование
                    transformedPoints = this.generalTransformation(transformedPoints, fromSystem, toSystem, transformation, suppressWarnings);
                }
            } else {
                // Нет прямого преобразования в маппинге
                if (!suppressWarnings) {
                    this.logTransformationWarning(transformKey, 'no_direct_mapping');
                }
                transformedPoints = this.generalTransformation(transformedPoints, fromSystem, toSystem, transformation, suppressWarnings);
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
            if (!suppressWarnings) {
                console.log(`❌ [CoordinateManager] Ошибка преобразования ${fromSystem}→${toSystem}:`, error.message);
            }
            // Возвращаем оригинальные точки как фоллбэк
            return points.map(p => ({
                ...p,
                _error: `transform failed: ${error.message}`,
                _transformationFailed: true
            }));
        }
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Логировать предупреждение
    logTransformationWarning(transformKey, warningType) {
        const warningKey = `transform_warning_${transformKey}_${warningType}`;

        // Логируем только один раз для каждой комбинации
        if (!this.warningsLogged.has(warningKey)) {
            this.warningsLogged.add(warningKey);

            // Формируем сообщение в зависимости от типа
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

            // В режиме дебага показываем больше информации
            if (this.debug) {
                console.log(`   Доступные преобразования: ${Object.keys(this.TRANSFORMATION_MAP).join(', ')}`);
            }
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Общее преобразование через каноническую систему
    generalTransformation(points, fromSystem, toSystem, transformation, suppressWarnings = true) {
        // Преобразуем через каноническую систему как промежуточную
        const canonicalPoints = this.toCanonicalSystem(points, fromSystem, transformation, suppressWarnings);
        return this.fromCanonicalSystem(canonicalPoints, toSystem, transformation, suppressWarnings);
    }

    // 🔥 ДОБАВЛЯЕМ НЕДОСТАЮЩИЕ МЕТОДЫ ПРЕОБРАЗОВАНИЯ

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

    // normalized → original (обратная нормализация)
    denormalizePoints(points, transformation) {
        if (!points || points.length === 0) return points;

        const RotationInvariance = require('../rotation-invariance');
        const processor = new RotationInvariance({ debug: false });

        // Предполагаем, что точки уже нормализованы к 0° и центру (500,500)
        // Для обратного преобразования нужна оригинальная трансформация

        if (!transformation || !transformation.rotationAngle) {
            // Нет информации для обратного преобразования
            console.log('⚠️ Нет трансформации для обратной нормализации');
            return points;
        }

        // 1. Смещаем от центра (500,500) обратно
        const originalCenter = transformation.center || { x: 0, y: 0 };
        const centeredPoints = points.map(p => ({
            ...p,
            x: p.x - 500 + originalCenter.x,
            y: p.y - 500 + originalCenter.y
        }));

        // 2. Поворачиваем обратно
        const rotationAngle = transformation.rotationAngle || 0;
        const rotatedPoints = processor.transformPointsSimple(centeredPoints, 0, rotationAngle);

        return rotatedPoints.map(p => ({
            ...p,
            _denormalized: true,
            _originalRotation: rotationAngle
        }));
    }

    // original → template (оригинальные → шаблон)
    normalizedToTemplate(points, transformation) {
        // Для преобразования в систему шаблона нужна трансформация шаблона
        // Пока возвращаем как есть
        return points.map(p => ({
            ...p,
            _inTemplateSystem: true,
            _templateTransformation: 'placeholder'
        }));
    }

    // template → original (шаблон → оригинальные)
    templateToOriginal(points, transformation) {
        // 🔥 ОБНОВЛЕННЫЙ МЕТОД: Преобразование из шаблона
        // Всегда центрируем шаблон в единую систему
        return points.map(p => ({
            ...p,
            _fromTemplate: true,
            x: (p.nx || 0) * 1000, // Приводим к диапазону 0-1000
            y: (p.ny || 0) * 1000,
            // 🔥 СДВИГ К ЕДИНОМУ ЦЕНТРУ
            x: p.x + this.SYSTEM_CONSTANTS.CENTER.x - 500,
            y: p.y + this.SYSTEM_CONSTANTS.CENTER.y - 500
        }));
    }

    // tracker → original
    trackerToOriginal(points, transformation) {
        // Точки трекера уже в оригинальной системе, просто возвращаем
        return points.map(p => ({
            ...p,
            _transformation: 'tracker→original',
            _method: 'direct'
        }));
    }

    // original → tracker
    originalToTracker(points, transformation) {
        // Оригинальные точки → точки трекера (просто копируем)
        return points.map(p => ({
            ...p,
            _transformation: 'original→tracker',
            _method: 'direct',
            confirmedCount: p.confirmedCount || 1,
            rating: p.confidence || 0.5
        }));
    }

    // graph → original
    graphToOriginal(points, transformation) {
        // Точки графа уже в оригинальной системе
        return points.map(p => ({
            ...p,
            _transformation: 'graph→original',
            _method: 'direct'
        }));
    }

    // original → graph
    originalToGraph(points, transformation) {
        // Оригинальные точки → точки графа
        return points.map(p => ({
            ...p,
            _transformation: 'original→graph',
            _method: 'direct',
            confidence: p.confidence || 0.5
        }));
    }

    // tracker → normalized
    trackerToNormalized(points, transformation) {
        // Точки трекера → нормализованные (через original)
        const originalPoints = this.trackerToOriginal(points, transformation);
        return this.normalizePoints(originalPoints, transformation);
    }

    // normalized → tracker
    normalizedToTracker(points, transformation) {
        // Нормализованные → точки трекера (через original)
        const originalPoints = this.denormalizePoints(points, transformation);
        return this.originalToTracker(originalPoints, transformation);
    }

    // graph → normalized
    graphToNormalized(points, transformation) {
        // Точки графа → нормализованные (через original)
        const originalPoints = this.graphToOriginal(points, transformation);
        return this.normalizePoints(originalPoints, transformation);
    }

    // normalized → graph
    normalizedToGraph(points, transformation) {
        // Нормализованные → точки графа (через original)
        const originalPoints = this.denormalizePoints(points, transformation);
        return this.originalToGraph(originalPoints, transformation);
    }

    // 🔥 МЕТОД: Валидация точек (ОБНОВЛЕННЫЙ)
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
            // Проверяем наличие обязательных полей
            if (point.x === undefined || point.y === undefined) {
                if (!suppressWarnings && invalidCount < 3) { // Ограничиваем вывод
                    console.log(`⚠️ [CoordinateManager] Точка ${index} без координат`);
                }
                invalidCount++;
                return;
            }

            // Проверяем на NaN и Infinity
            if (isNaN(point.x) || isNaN(point.y) ||
                !isFinite(point.x) || !isFinite(point.y)) {
                if (!suppressWarnings && invalidCount < 3) {
                    console.log(`⚠️ [CoordinateManager] Точка ${index} с некорректными координатами`);
                }
                invalidCount++;
                return;
            }

            // Проверяем на нулевые координаты (может быть проблемой)
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

    // 🔥 МЕТОД: Преобразовать в каноническую систему (ОБНОВЛЕННЫЙ)
    toCanonicalSystem(points, fromSystem, transformation, suppressWarnings = true) {
        // Каноническая система: нормализованные координаты
        if (fromSystem === this.COORDINATE_SYSTEMS.NORMALIZED) {
            return points;
        }

        // Для других систем преобразуем через normalized
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

    // 🔥 МЕТОД: Преобразовать из канонической системы (ОБНОВЛЕННЫЙ)
    fromCanonicalSystem(points, toSystem, transformation, suppressWarnings = true) {
        // Из канонической в целевую систему
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

    // 🔥 МЕТОД: Диагностика системы координат (ОБНОВЛЕННЫЙ)
    diagnoseSystem(source, options = {}) {
        const { debug = true, suppressWarnings = false } = options;

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
                    forceRecalculate: true,
                    suppressWarnings: true // 🔥 ПОДАВЛЯЕМ ПРЕДУПРЕЖДЕНИЯ ПРИ ДИАГНОСТИКЕ
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
            if (data.error && !suppressWarnings) {
                console.log(`     Ошибка: ${data.error}`);
            }
        });

        return results;
    }

    // 🔥 НОВЫЙ МЕТОД: Получить информацию о доступных преобразованиях
    getTransformationInfo() {
        console.log('\n🗺️ ИНФОРМАЦИЯ О ПРЕОБРАЗОВАНИЯХ:');
        console.log('─'.repeat(50));

        const implemented = [];
        const notImplemented = [];

        Object.entries(this.TRANSFORMATION_MAP).forEach(([key, method]) => {
            if (typeof this[method] === 'function') {
                implemented.push(key);
            } else {
                notImplemented.push(key);
            }
        });

        console.log(`✅ Реализовано: ${implemented.length} преобразований`);
        if (implemented.length > 0) {
            console.log('   ' + implemented.join(', '));
        }

        if (notImplemented.length > 0) {
            console.log(`\n⚠️ Не реализовано: ${notImplemented.length} преобразований`);
            console.log('   ' + notImplemented.join(', '));
        }

        console.log(`\n📊 Статистика предупреждений: ${this.warningsLogged.size} уникальных предупреждений`);

        return {
            implemented: implemented,
            notImplemented: notImplemented,
            warningCount: this.warningsLogged.size
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Очистить историю предупреждений
    clearWarningHistory() {
        const count = this.warningsLogged.size;
        this.warningsLogged.clear();
        console.log(`🗺️ [CoordinateManager] Очищена история предупреждений (было: ${count})`);
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (добавлены для полноты)

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

        // Простая эвристика для определения системы координат
        const firstPoint = points[0];

        if (firstPoint._normalized) return this.COORDINATE_SYSTEMS.NORMALIZED;
        if (firstPoint._inTemplateSystem) return this.COORDINATE_SYSTEMS.TEMPLATE;
        if (firstPoint.confirmedCount !== undefined) return this.COORDINATE_SYSTEMS.TRACKER;
        if (firstPoint.confidence !== undefined) return this.COORDINATE_SYSTEMS.GRAPH;

        return this.COORDINATE_SYSTEMS.ORIGINAL;
    }

    getCoordinatesFromFootprint(footprint, coordinateSystem, options) {
        // Базовая реализация для примера
        const points = footprint.getPoints ? footprint.getPoints() : [];
        const transformation = footprint.getTransformation ? footprint.getTransformation() : null;

        return {
            points: points,
            transformation: transformation,
            sourceSystem: this.COORDINATE_SYSTEMS.ORIGINAL
        };
    }

    getCoordinatesFromGraph(graph, coordinateSystem, options) {
        // Базовая реализация для примера
        const points = graph.getNodes ? graph.getNodes().map(node => ({ x: node.x, y: node.y, confidence: node.confidence })) : [];

        return {
            points: points,
            transformation: null,
            sourceSystem: this.COORDINATE_SYSTEMS.GRAPH
        };
    }

    getCoordinatesFromPointTracker(tracker, coordinateSystem, options) {
        // Базовая реализация для примера
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
        // Базовая реализация для примера
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

    // 🔥 МЕТОД: Нормализация точек (добавлен для полноты)
    calculateCenter(points) {
        if (!points || points.length === 0) return { x: 0, y: 0 };

        const sumX = points.reduce((acc, p) => acc + p.x, 0);
        const sumY = points.reduce((acc, p) => acc + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    // 🔥 НОВЫЙ МЕТОД: Очистить кэш
    clearCache() {
        const cacheSize = this.coordinateCache.size;
        this.coordinateCache.clear();
        console.log(`🗺️ [CoordinateManager] Очищен кэш координат (было: ${cacheSize} записей)`);
    }

    // 🔥 НОВЫЙ МЕТОД: Получить статистику кэша
    getCacheStats() {
        return {
            coordinateCacheSize: this.coordinateCache.size,
            transformationCacheSize: this.transformationCache.size,
            warningsLogged: this.warningsLogged.size,
            suppressWarnings: this.suppressTransformationWarnings
        };
    }
}

module.exports = CoordinateManager;
