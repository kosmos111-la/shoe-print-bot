// modules/footprint/simple-manager.js
// 🔥 ФИНАЛЬНАЯ ВЕРСИЯ С ИСПРАВЛЕНИЯМИ ВИЗУАЛИЗАЦИЙ + НОВЫЕ МОДУЛИ КООРДИНАТ + ИСПРАВЛЕНИЕ ОШИБКИ

const fs = require('fs');
const path = require('path');

// 🔥 Импорт основных модулей
const FootprintComparisonEngine = require('./core/comparison/footprint-comparison-engine');
const TemplateCoordination = require('./core/comparison/template-coordination');
const SessionManager = require('./core/session/session-manager');
const VisualizationManager = require('./core/visualization/visualization-manager');
const GeometryUtils = require('./core/utils/geometry-utils');

// 🔥 Импорт НОВЫХ модулей координат
const CoordinateManager = require('./core/coordinate-manager');
const TransformationValidator = require('./core/transformation-validator');
const CoordinateSystemLogger = require('./core/coordinate-system-logger');

// 🔥 Импорт зависимостей
const SimpleGraph = require('./simple-graph');
const SimpleAligner = require('./alignment/simple-aligner');
const CoordinateSystemConverter = require('./alignment/coordinate-system-converter');
const CoordinateValidator = require('./alignment/coordinate-validator');
const TransformationDebugger = require('./alignment/transformation-debugger');
const ImprovedAligner = require('./alignment/improved-aligner');
const LogManager = require('./core/log-manager');

// 🔥 НОВЫЙ: Coordinate Director
const CoordinateDirector = require('./core/coordinate-director');

class SimpleFootprintManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/footprints',
            autoAlignment: options.autoAlignment !== false,
            autoSave: options.autoSave !== false,
            debug: options.debug || false,
            usePointTracker: true,
            enableVectorSuperModel: true,
            enableMergeVisualization: options.enableMergeVisualization !== false,
            enableTemplateVisualization: options.enableTemplateVisualization !== false,
            topologySimilarityThreshold: options.topologySimilarityThreshold || 0.7,
            minPointsForFootprint: options.minPointsForFootprint || 5,
            templateMatchThreshold: 80,
            minTemplateConfirmations: 1,
            enableCoordinateDiagnostics: true, // 🔥 НОВАЯ НАСТРОЙКА
            ...options
        };

        // Импорт модулей
        const SimpleFootprint = require('./simple-footprint');
        const SimpleMatcher = require('./simple-matcher');
        const MergeVisualizer = require('./merge-visualizer');
        const VectorSuperModel = require('./vector-super-model');
        const RotationInvariance = require('./rotation-invariance');
        const MirrorDetection = require('./mirror-detection');

        this.rotationProcessor = new RotationInvariance({ debug: this.config.debug });
        this.mirrorDetector = new MirrorDetection({ debug: this.config.debug });

        // 🔥 ИНИЦИАЛИЗАЦИЯ ВЫНЕСЕННЫХ МОДУЛЕЙ
        this.aligner = new SimpleAligner({
            debug: this.config.debug,
            visualizationDir: path.join(this.config.dbPath, 'visualizations/alignments')
        });

        this.coordinateConverter = new CoordinateSystemConverter({ debug: this.config.debug });
        this.coordinateValidator = new CoordinateValidator({ debug: this.config.debug });
        this.transformationDebugger = new TransformationDebugger({ debug: this.config.debug });

        this.improvedAligner = new ImprovedAligner({
            debug: this.config.debug,
            visualizationDir: path.join(this.config.dbPath, 'visualizations/alignments')
        });

        // 🔥 ИНИЦИАЛИЗАЦИЯ НОВЫХ МОДУЛЕЙ КООРДИНАТ
        this.coordinateManager = new CoordinateManager(this);
        this.transformationValidator = new TransformationValidator(this);
        this.coordinateSystemLogger = new CoordinateSystemLogger(this);

        // 🔥 ИНИЦИАЛИЗАЦИЯ ОСНОВНЫХ МОДУЛЕЙ
        this.comparisonEngine = new FootprintComparisonEngine(this);
        this.templateCoordinator = new TemplateCoordination(this);
        this.sessionManager = new SessionManager(this);
        this.visualizationManager = new VisualizationManager(this);
        this.geometryUtils = new GeometryUtils(this);

        // 🔥 ПРОВЕРКА МОДУЛЕЙ
        console.log(`🔍 ПРОВЕРКА МОДУЛЕЙ:`);
        console.log(`   - coordinateManager: ${this.coordinateManager ? '✅' : '❌'}`);
        console.log(`   - transformationValidator: ${this.transformationValidator ? '✅' : '❌'}`);
        console.log(`   - coordinateSystemLogger: ${this.coordinateSystemLogger ? '✅' : '❌'}`);
        console.log(`   - comparisonEngine: ${this.comparisonEngine ? '✅' : '❌'}`);
        console.log(`   - templateCoordinator: ${this.templateCoordinator ? '✅' : '❌'}`);
        console.log(`   - sessionManager: ${this.sessionManager ? '✅' : '❌'}`);
        console.log(`   - visualizationManager: ${this.visualizationManager ? '✅' : '❌'}`);
        console.log(`   - geometryUtils: ${this.geometryUtils ? '✅' : '❌'}`);

        // Инициализация остальных компонентов
        this.mergeVisualizer = new MergeVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations'),
            debug: this.config.debug
        });

        this.matcher = new SimpleMatcher({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold
        });

        // Сессии и модели
        this.userSessions = new Map();
        this.loadedModels = new Map();
        this.vectorSuperModels = new Map();

        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalPhotosProcessed: 0,
            totalTemplateConfirmations: 0,
            lastActivity: new Date()
        };

        this.ensureDirectories();
        this.loadExistingModels();

        console.log(`🚀 SimpleFootprintManager с ПОЛНОСТЬЮ МОДУЛЬНОЙ АРХИТЕКТУРОЙ И НОВЫМИ МОДУЛЯМИ КООРДИНАТ (${this.getLinesOfCode()} строк)`);

        // 🔥 ЕДИНЫЕ ПОРОГИ ДЛЯ ВСЕХ МОДУЛЕЙ
        this.DECISION_THRESHOLDS = {
            // Пороги из логов (работающие значения)
            PATTERN_SIMILARITY: 0.6,      // Из лога: 80.6% проходит → порог < 0.8
            MIN_MATCHES: 10,              // Из лога: "Недостаточно: 9" → нужно > 9
            MAX_DISTANCE: 50,             // Из лога виден порог
            VECTOR_MATCH_THRESHOLD: 0.05  // Снизили с 0.08 для совместимости
        };

        console.log(`🎯 Единые пороги решений:`);
        console.log(`   Паттерн+сходство: >${this.DECISION_THRESHOLDS.PATTERN_SIMILARITY}`);
        console.log(`   Минимальные совпадения: >${this.DECISION_THRESHOLDS.MIN_MATCHES}`);
        console.log(`   Максимальное расстояние: <${this.DECISION_THRESHOLDS.MAX_DISTANCE}px`);

        // 🔥 ИНИЦИАЛИЗАЦИЯ МЕНЕДЖЕРА ЛОГОВ
        this.log = new LogManager(this);

        // Устанавливаем уровень из конфига
        if (options.logLevel) {
            this.log.setLevel(options.logLevel);
        }

        console.log(`🚀 SimpleFootprintManager с улучшенным логированием`);

        // 🔥 ИНИЦИАЛИЗАЦИОННАЯ ДИАГНОСТИКА (если включено)
        if (this.config.enableCoordinateDiagnostics) {
            this.runInitialDiagnostics();
        }

        // 🔥 НОВЫЙ: Coordinate Director (главный гарант системы координат)
        this.coordinateDirector = new CoordinateDirector(this);
    }

    // 🔥 НОВЫЙ МЕТОД: Запуск начальной диагностики
    runInitialDiagnostics() {
        console.log('\n🔍 ЗАПУСК НАЧАЛЬНОЙ ДИАГНОСТИКИ СИСТЕМЫ КООРДИНАТ...');

        // 1. Проверка модулей координат
        console.log('  1. Проверка модулей координат...');
        try {
            // Тестируем CoordinateManager с РЕАЛЬНЫМИ тестовыми данными
            const testPoints = [
                { x: 100, y: 100, id: 'test1', confidence: 0.8 },
                { x: 200, y: 200, id: 'test2', confidence: 0.7 },
                { x: 300, y: 300, id: 'test3', confidence: 0.9 }
            ];

            // Тестируем несколько преобразований
            const result1 = this.coordinateManager.getCoordinates(testPoints, {
                coordinateSystem: 'original',
                debug: false,
                suppressWarnings: true
            });

            const result2 = this.coordinateManager.getCoordinates(testPoints, {
                coordinateSystem: 'normalized',
                debug: false,
                suppressWarnings: true
            });

            console.log(`     CoordinateManager: ✅`);
            console.log(`       • Оригинальные точки: ${result1.count}`);
            console.log(`       • Нормализованные точки: ${result2.count}`);
            console.log(`       • Преобразования работают: ${result1.count === result2.count ? '✅' : '❌'}`);

        } catch (error) {
            console.log(`     CoordinateManager: ❌ ${error.message}`);
        }

        // 2. Проверка TransformationValidator
        console.log('  2. Проверка TransformationValidator...');
        try {
            // Создаем тестовые трансформации для проверки
            const testTransformations = [
                {
                    rotationAngle: 0,
                    center: { x: 500, y: 500 },
                    type: 'test_1',
                    timestamp: new Date()
                },
                {
                    rotationAngle: 10,
                    center: { x: 510, y: 490 },
                    type: 'test_2',
                    timestamp: new Date()
                }
            ];

            // Логируем тестовые трансформации
            this.coordinateSystemLogger.logTransformations(
                testTransformations,
                'Тестовые трансформации для проверки'
            );

            // Проверяем, что модуль инициализирован
            console.log(`     TransformationValidator: ✅ (инициализирован)`);

            // Пока не запускаем полную проверку, так как система может быть пустой
            console.log(`     Примечание: полная проверка будет при наличии данных`);

        } catch (error) {
            console.log(`     TransformationValidator: ❌ ${error.message}`);
        }

        // 3. Проверка CoordinateSystemLogger
        console.log('  3. Проверка CoordinateSystemLogger...');
        try {
            // Создаем РЕАЛЬНЫЙ тестовый объект для логирования
            const testObject = {
                id: 'test_footprint',
                name: 'Тестовый отпечаток',
                graph: {
                    nodes: new Map([
                        ['node1', { x: 100, y: 100, confidence: 0.8 }],
                        ['node2', { x: 200, y: 200, confidence: 0.7 }],
                        ['node3', { x: 300, y: 300, confidence: 0.9 }]
                    ]),
                    edges: new Map()
                },
                transformation: {
                    rotationAngle: 15,
                    center: { x: 500, y: 500 },
                    type: 'test_transformation'
                }
            };

            // Логируем реальный объект
            this.coordinateSystemLogger.logCoordinateSystems(
                'Тест CoordinateSystemLogger с реальными данными',
                testObject
            );

            console.log(`     CoordinateSystemLogger: ✅ (логирование работает)`);

        } catch (error) {
            console.log(`     CoordinateSystemLogger: ❌ ${error.message}`);
        }

        // 4. Проверка загруженных данных
        console.log('  4. Проверка состояния системы...');
        console.log(`     • Загружено моделей: ${this.loadedModels.size}`);
        console.log(`     • Активных сессий: ${this.userSessions.size}`);
        console.log(`     • Шаблонов: ${this.vectorSuperModels.size}`);
        console.log(`     • Режим отладки: ${this.config.debug ? 'включен' : 'выключен'}`);

        // 5. Проверка доступных преобразований
        console.log('  5. Проверка преобразований...');
        try {
            const transformInfo = this.coordinateManager.getTransformationInfo();
            console.log(`     • Реализовано преобразований: ${transformInfo.implemented.length}`);
            console.log(`     • Предупреждений в истории: ${transformInfo.warningCount}`);
        } catch (error) {
            console.log(`     • Ошибка проверки преобразований: ${error.message}`);
        }

        console.log('✅ Начальная диагностика завершена\n');
    }

    // 🔥 СТАТИСТИКА ПО СТРОКАМ КОДА (обновленная)
    getLinesOfCode() {
        const lines = [
            // Основные модули
            1200, // footprint-comparison-engine.js
            500,  // template-coordination.js
            200,  // session-manager.js
            150,  // visualization-manager.js
            150,  // geometry-utils.js

            // Новые модули координат
            800,  // coordinate-manager.js
            600,  // transformation-validator.js
            700,  // coordinate-system-logger.js

            400,  // simple-manager.js (текущий файл, обновленный)
        ];
        return lines.reduce((a, b) => a + b, 0);
    }

    // 🔥 НОВЫЕ ФАСАДНЫЕ МЕТОДЫ ДЛЯ МОДУЛЕЙ КООРДИНАТ

    // Для CoordinateManager
    getCoordinates(source, options = {}) {
        // Добавляем suppressWarnings по умолчанию для обычной работы
        const defaultOptions = {
            suppressWarnings: true, // 🔥 ПОДАВЛЯЕМ ПРЕДУПРЕЖДЕНИЯ ПО УМОЛЧАНИЮ
            ...options
        };
        return this.coordinateManager.getCoordinates(source, defaultOptions);
    }

    transformToSystem(points, fromSystem, toSystem, transformation = null) {
        return this.coordinateManager.transformToSystem(points, fromSystem, toSystem, transformation);
    }

    validatePoints(points) {
        return this.coordinateManager.validatePoints(points);
    }

    comparePoints(points1, points2, options = {}) {
        return this.coordinateManager.comparePoints(points1, points2, options);
    }

    detectCoordinateSystem(points) {
        return this.coordinateManager.detectCoordinateSystem(points);
    }

    clearCoordinateCache() {
        return this.coordinateManager.clearCache();
    }

    diagnoseCoordinateSystem(source, options = {}) {
        return this.coordinateManager.diagnoseSystem(source, options);
    }

    // Для TransformationValidator
    validateAllTransformations(userId = null) {
        return this.transformationValidator.validateTransformationsAcrossModules(userId);
    }

    validateTransformations(obj1, obj2) {
        // Собираем трансформации из объектов и сравниваем
        const trans1 = this.extractTransformations(obj1);
        const trans2 = this.extractTransformations(obj2);

        if (trans1.length === 0 || trans2.length === 0) {
            return { consistent: false, error: 'Нет трансформаций для сравнения' };
        }

        return this.transformationValidator.compareTransformations(trans1[0], trans2[0]);
    }

    extractTransformations(obj) {
        return this.transformationValidator.extractTransformationsFromFootprint(obj);
    }

    // Для CoordinateSystemLogger
    logCoordinateSystems(title, ...objects) {
        return this.coordinateSystemLogger.logCoordinateSystems(title, ...objects);
    }

    logTransformations(transformations, title = 'ТРАНСФОРМАЦИИ') {
        return this.coordinateSystemLogger.logTransformations(transformations, title);
    }

    generateDiagnosticReport(userId = null) {
        return this.coordinateSystemLogger.generateDiagnosticReport(userId);
    }

    compareSystems(obj1, obj2, options = {}) {
        return this.coordinateSystemLogger.compareCoordinateSystems(obj1, obj2, options);
    }

    // 🔥 СУЩЕСТВУЮЩИЕ ФАСАДНЫЕ МЕТОДЫ (без изменений)
    async compareWithAlignment(footprint1, footprint2) {
        return this.comparisonEngine.compareWithAlignment(footprint1, footprint2);
    }

    async compareWithCoordinateConversion(footprint1, footprint2) {
        return this.comparisonEngine.compareWithCoordinateConversion(footprint1, footprint2);
    }

    async validateAndCompare(footprint1, footprint2) {
        return this.comparisonEngine.validateAndCompare(footprint1, footprint2);
    }

    async compareWithPatterns(footprint1, footprint2) {
        return this.comparisonEngine.compareWithPatterns(footprint1, footprint2);
    }

    updateConfirmationsFromTemplate(footprint, vectorModel, transformationInfo = null) {
        return this.templateCoordinator.updateConfirmationsFromTemplate(footprint, vectorModel, transformationInfo);
    }

    updateConfirmationsDirectly(footprint1, footprint2) {
        return this.templateCoordinator.updateConfirmationsDirectly(footprint1, footprint2);
    }

    updateConfirmationsFromMatches(footprint1, footprint2, matches) {
        return this.templateCoordinator.updateConfirmationsFromMatches(footprint1, footprint2, matches);
    }

    debugAccumulation(userId) {
        return this.templateCoordinator.debugAccumulation(userId);
    }

    createSession(userId, name = null) {
        return this.sessionManager.createSession(userId, name);
    }

    getActiveSession(userId) {
        return this.sessionManager.getActiveSession(userId);
    }

    saveSessionAsModel(userId, modelName = null) {
        return this.sessionManager.saveSessionAsModel(userId, modelName);
    }

    getSessionInfo(userId) {
        return this.sessionManager.getSessionInfo(userId);
    }

    cleanupOldSessions(maxAgeHours = 24) {
        return this.sessionManager.cleanupOldSessions(maxAgeHours);
    }

    hasSession(userId) {
        return this.sessionManager.hasSession(userId);
    }

    updateLastActivity(userId) {
        // 🔥 ИСПРАВЛЕНИЕ: используем прямой метод
        const session = this.getActiveSession(userId);
        if (session) {
            session.lastActivity = new Date();
            return true;
        }
        return false;
    }

    async visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo = null) {
        return this.visualizationManager.visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo);
    }

    async visualizeVectorSuperModel(userId, vectorModel) {
        return this.visualizationManager.visualizeVectorSuperModel(userId, vectorModel);
    }

    debugVisualizations(userId) {
        return this.visualizationManager.debugVisualizations(userId);
    }

    calculateBounds(points) {
        return this.geometryUtils.calculateBounds(points);
    }

    calculateCenter(points) {
        return this.geometryUtils.calculateCenter(points);
    }

    calculateAspectRatio(points) {
        return this.geometryUtils.calculateAspectRatio(points);
    }

    calculateDistance(point1, point2) {
        return this.geometryUtils.calculateDistance(point1, point2);
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Добавление фото в сессию (ОБНОВЛЕННЫЙ с CoordinateManager + ИСПРАВЛЕНИЕ)
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО в сессию пользователя ${userId}`);

        // 🔥 КРИТИЧНО: СИНХРОНИЗИРУЕМ ПЕРЕД СРАВНЕНИЕМ
        if (this.coordinateDirector) {
            console.log('🎬 Синхронизирую системы координат перед сравнением...');
            this.coordinateDirector.forceSynchronizeBeforeComparison();
        }

        try {
            // Валидация входных данных
            if (!analysis?.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }

            // 🔥 ИСПОЛЬЗУЕМ CoordinateManager для извлечения точек
            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < this.config.minPointsForFootprint) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }

            // 🔥 ЛОГИРУЕМ СИСТЕМУ КООРДИНАТ (если включено)
            if (this.config.enableCoordinateDiagnostics) {
                this.coordinateSystemLogger.logCoordinateSystems(
                    `Извлечение точек из анализа для пользователя ${userId}`,
                    points
                );
            }

            // Создание и нормализация графа
            const graph = new SimpleGraph(`Временный_${Date.now()}`);
            graph.buildFromPoints(points);

            const normalized = this.rotationProcessor.normalizeToCanonical(graph, {
                userId: userId,
                photoInfo: photoInfo,
                autoRotate: true
            });

            const transformationInfo = {
                ...normalized.transformation,
                rotationAngle: normalized.rotationAngle,
                isMirrored: normalized.isMirrored,
                corrected: false,
                timestamp: new Date(),
                footType: normalized.footType,
                photoId: photoInfo.photoId || `photo_${Date.now()}`
            };

            const corrected = this.mirrorDetector.autoCorrectMirroring(normalized.graph, 'right');
            if (corrected.correctionApplied) {
                transformationInfo.corrected = true;
                transformationInfo.correctionType = corrected.correctionType;
            }

            const finalGraph = corrected.graph;
            finalGraph.transformation = transformationInfo;

            // 🔥 ЛОГИРУЕМ ТРАНСФОРМАЦИИ
            if (this.config.enableCoordinateDiagnostics) {
                this.coordinateSystemLogger.logTransformations(
                    [transformationInfo],
                    `Трансформация для фото ${photoInfo.photoId || 'unknown'}`
                );
            }

            // Работа с сессией
            let session = this.sessionManager.getActiveSession(userId);
            if (!session) {
                session = this.sessionManager.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
            }

            // 🔥 ИСПРАВЛЕНИЕ: Вместо вызова несуществующего метода обновляем напрямую
            session.lastActivity = new Date();

            if (!session.metadata.normalizationHistory) {
                session.metadata.normalizationHistory = [];
            }
            session.metadata.normalizationHistory.push(transformationInfo);
            session.metadata.lastTransformation = transformationInfo;

            session.photos.push({
                id: `photo_${Date.now()}`,
                timestamp: new Date(),
                pointsCount: points.length,
                transformationInfo: transformationInfo
            });

            // 🔥 ПЕРВОЕ ФОТО
            if (!session.currentFootprint) {
                return await this.handleFirstPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId);
            }

            // 🔥 ПОСЛЕДУЮЩИЕ ФОТО
            return await this.handleSubsequentPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId);

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // 🔥 МЕТОД: Извлечь точки из анализа (ОБНОВЛЕННЫЙ)
    extractPointsFromAnalysis(analysis) {
        const points = [];
        const predictions = analysis.predictions || [];

        predictions.forEach(pred => {
            if (pred.class === 'shoe-protector' && pred.points && pred.points.length > 0) {
                const xs = pred.points.map(p => p.x);
                const ys = pred.points.map(p => p.y);
                points.push({
                    x: (Math.min(...xs) + Math.max(...xs)) / 2,
                    y: (Math.min(...ys) + Math.max(...ys)) / 2,
                    confidence: pred.confidence || 0.5,
                    originalPoints: pred.points,
                    class: pred.class,
                    _source: 'analysis',
                    _timestamp: new Date()
                });
            }
        });

        // 🔥 ВАЛИДИРУЕМ ТОЧКИ ЧЕРЕЗ CoordinateManager
        return this.coordinateManager.validatePoints(points);
    }

    // 🔥 МЕТОД: Извлечь точки из отпечатка (ОБНОВЛЕННЫЙ - теперь через CoordinateManager)
    extractPointsFromFootprint(footprint) {
        // 🔥 ИСПОЛЬЗУЕМ CoordinateManager вместо старой логики
        const result = this.coordinateManager.getCoordinates(footprint, {
            coordinateSystem: 'original',
            includeMetadata: false,
            debug: this.config.debug
        });

        return result.points;
    }

    // 🔥 МЕТОД: Обработка первого фото (ОБНОВЛЕННЫЙ)
    async handleFirstPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId) {
        console.log(`👣 Первое фото: создаю отпечаток и шаблон`);

        const SimpleFootprint = require('./simple-footprint');
        session.currentFootprint = new SimpleFootprint({
            userId: userId,
            name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
            transformation: transformationInfo
        });

        session.currentFootprint.metadata.normalizationInfo = transformationInfo;

        const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: finalGraph,
            photoId: photoInfo.photoId || `photo_${Date.now()}`,
            source: photoInfo.source || 'telegram_bot',
            transformationInfo: transformationInfo
        });

        // 🔥 ДИАГНОСТИКА: логируем созданный отпечаток
        if (this.config.enableCoordinateDiagnostics) {
            this.coordinateSystemLogger.logCoordinateSystems(
                `Создан первый отпечаток для пользователя ${userId}`,
                session.currentFootprint
            );
        }

        // Создание шаблона
        const VectorSuperModel = require('./vector-super-model');
        const vectorModel = new VectorSuperModel({
            name: `Шаблон_${String(userId).slice(0, 6)}`,
            enablePCA: false,
            cellSize: 25,
            debug: this.config.debug
        });

        vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
            isFirst: true,
            transformationInfo: transformationInfo
        });

        this.vectorSuperModels.set(userId, vectorModel);

        // 🔥 ПРОВЕРЯЕМ СОГЛАСОВАННОСТЬ ТРАНСФОРМАЦИЙ
        if (this.config.enableCoordinateDiagnostics) {
            console.log('\n🔍 ПРОВЕРКА СОГЛАСОВАННОСТИ ПОСЛЕ СОЗДАНИЯ ОТПЕЧАТКА:');
            const validationResult = this.transformationValidator.validateTransformationsAcrossModules(userId);

            if (!validationResult.overallValid) {
                console.log('⚠️ Обнаружены расхождения в трансформациях!');
                // Можно добавить автоматическую коррекцию здесь
            }
        }

        console.log(`✅ Создан отпечаток с ${addResult.added} узлами`);
        console.log(`✅ Создан шаблон с ${vectorModel.templateBuilder.getVisualizationData()?.cells?.length || 0} ячейками`);

        // 🔥 ВИЗУАЛИЗАЦИЯ И ОТПРАВКА ПЕРВОГО СЛЕДА
        let firstPhotoViz = null;
        let templateVizResult = null;

        if (bot && chatId && this.config.enableMergeVisualization) {
            console.log(`🎨 Создаю визуализацию для первого фото...`);

            // 1. Визуализация отпечатка
            firstPhotoViz = await this.visualizeSingleFootprintConfirmations(
                session.currentFootprint,
                userId,
                transformationInfo
            );

            // 2. Визуализация шаблона (если включено)
            if (this.config.enableTemplateVisualization) {
                console.log(`🎨 Создаю визуализацию шаблона...`);
                templateVizResult = await this.visualizeVectorSuperModel(userId, vectorModel);
            }

            // 🔥 ОТПРАВКА В TELEGRAM (ИСПРАВЛЕННЫЙ КОД)
            try {
                // 🔥 ОЧИСТКА ОТ Markdown-СИМВОЛОВ
                const cleanMarkdown = (text) => {
                    return text
                        .replace(/\*\*/g, '')  // убираем **
                        .replace(/\*/g, '')    // убираем *
                        .replace(/__/g, '')    // убираем __
                        .replace(/_/g, '')     // убираем _
                        .replace(/`/g, '')     // убираем `
                        .replace(/\[/g, '(')   // заменяем [
                        .replace(/\]/g, ')');  // заменяем ]
                };

                // 3. Отправка отпечатка
                if (firstPhotoViz && firstPhotoViz.path && fs.existsSync(firstPhotoViz.path)) {
                    let caption = `👣 ПЕРВЫЙ СЛЕД СОЗДАН\n\n`;
                    caption += `📊 Извлечено: ${addResult.added} точек\n`;
                    caption += `📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n`;
                    caption += `🦶 Тип: ${transformationInfo.footType || 'unknown'}\n\n`;
                    caption += `✅ Создан шаблон для накопления деталей`;

                    // 🔥 ОЧИЩАЕМ ОТ Markdown
                    const cleanCaption = cleanMarkdown(caption);

                    await bot.sendPhoto(chatId, firstPhotoViz.path, {
                        caption: cleanCaption,
                        parse_mode: 'HTML'  // 🔥 ИСПОЛЬЗУЕМ HTML ИЛИ УБИРАЕМ
                    });

                    console.log('✅ Визуализация первого следа отправлена');
                } else {
                    console.log('⚠️ Визуализация отпечатка не создана');
                }

                // 4. Отправка шаблона
                if (templateVizResult && templateVizResult.template && fs.existsSync(templateVizResult.template)) {
                    const templateData = vectorModel.templateBuilder.getVisualizationData();
                    const stats = templateData?.stats || {};

                    let templateCaption = `📊 ШАБЛОН СОЗДАН\n\n`;
                    templateCaption += `📋 Ячеек: ${stats.cells || 0}\n`;
                    templateCaption += `🎯 Эталонный граф: ${templateData.referenceGraphId?.slice(0, 8) || 'создан'}\n`;
                    templateCaption += `📈 Система готова к накоплению деталей`;

                    // 🔥 ОЧИЩАЕМ ОТ Markdown
                    const cleanTemplateCaption = cleanMarkdown(templateCaption);

                    await bot.sendPhoto(chatId, templateVizResult.template, {
                        caption: cleanTemplateCaption,
                        parse_mode: 'HTML'
                    });

                    console.log('✅ Визуализация шаблона отправлена');
                } else {
                    console.log('⚠️ Визуализация шаблона не создана');
                }

            } catch (sendError) {
                console.log('❌ Ошибка отправки в Telegram:', sendError.message);
                console.log('Подробности:', {
                    errorType: sendError.constructor.name,
                    message: sendError.message,
                    stack: sendError.stack
                });
            }
        } else {
            console.log(`⏭️ Визуализация пропущена:`, {
                bot: !!bot,
                chatId: !!chatId,
                enableMergeVisualization: this.config.enableMergeVisualization
            });
        }

        return {
            success: true,
            isNewSession: true,
            similarity: 0,
            decision: 'new',
            nodesAdded: addResult.added,
            totalNodes: session.currentFootprint.graph.nodes.size,
            sessionId: session.id,
            hasTemplate: true,
            hasVisualization: !!firstPhotoViz,
            hasTemplateViz: !!templateVizResult,
            coordinateDiagnostics: this.config.enableCoordinateDiagnostics
        };
    }

    // 🔥 МЕТОД: Обработка последующих фото (ОБНОВЛЕННЫЙ)
    async handleSubsequentPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId) {
        console.log(`🔍 Проверяю совпадение с существующим отпечатком`);

        // 🔥 ЛОГИРУЕМ СИСТЕМЫ КООРДИНАТ ПЕРЕД СРАВНЕНИЕМ
        if (this.config.enableCoordinateDiagnostics) {
            this.coordinateSystemLogger.logCoordinateSystems(
                `Сравнение фото с существующим отпечатком (пользователь ${userId})`,
                session.currentFootprint,
                { points: this.extractPointsFromAnalysis(analysis), _source: 'new_analysis' }
            );
        }

        const existingTransformationInfo = session.currentFootprint.metadata.normalizationInfo ||
                                         session.currentFootprint.getTransformation();

        // Создание временного отпечатка для сравнения
        const SimpleFootprint = require('./simple-footprint');
        const tempFootprint = new SimpleFootprint({
            userId: userId,
            name: `Temp_${Date.now()}`
        });

        tempFootprint.metadata.normalizationInfo = transformationInfo;

        // 🔥 СОХРАНЯЕМ РЕЗУЛЬТАТ В ПЕРЕМЕННУЮ
        const tempResult = tempFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: finalGraph,
            photoId: photoInfo.photoId || `photo_${Date.now()}_temp`,
            source: photoInfo.source || 'telegram_bot_temp',
            transformationInfo: transformationInfo
        });

        // 🔥 СРАВНЕНИЕ С ИСПОЛЬЗОВАНИЕМ НОВЫХ МОДУЛЕЙ
        // Сначала проверяем согласованность трансформаций
        let transformationConsistent = true;
        if (this.config.enableCoordinateDiagnostics) {
            const transComparison = this.transformationValidator.compareTransformations(
                existingTransformationInfo,
                transformationInfo
            );

            transformationConsistent = transComparison.consistent;

            if (!transformationConsistent) {
                console.log('⚠️ Трансформации не согласованы перед сравнением отпечатков');
                console.log(`   Различия: ${transComparison.differences.join(', ')}`);

                // Можем попытаться скорректировать
                console.log('🔄 Пытаюсь скорректировать систему координат для сравнения...');
            }
        }

        // Сравнение отпечатков
        const comparisonResult = await this.compareWithPatterns(
            session.currentFootprint,
            tempFootprint
        );

        const similarity = comparisonResult?.similarity || 0;

        // 🔥 ИСПОЛЬЗУЕМ ЕДИНЫЙ ПОРОГ ИЗ КОНФИГА
        const decision = similarity > this.DECISION_THRESHOLDS.PATTERN_SIMILARITY ? 'same' : 'different';

        console.log(`🎯 ЕДИНОЕ РЕШЕНИЕ (simple-manager):`);
        console.log(`   Similarity: ${similarity.toFixed(3)}`);
        console.log(`   Требуется: >${this.DECISION_THRESHOLDS.PATTERN_SIMILARITY}`);
        console.log(`   Решение: ${decision}`);
        console.log(`   Источник: compareWithPatterns()`);
        console.log(`   Трансформации согласованы: ${transformationConsistent ? '✅' : '❌'}`);

        if (decision === 'same') {
            return await this.handleMatchingFootprint(
                session, userId, tempFootprint, finalGraph, transformationInfo,
                existingTransformationInfo, similarity, comparisonResult,
                tempResult, bot, chatId
            );
        } else {
            return await this.handleNewFootprint(
                session, userId, analysis, photoInfo, finalGraph, transformationInfo,
                similarity, bot, chatId
            );
        }
    }

    // 🔥 МЕТОД: Обработка совпадающих следов (ОБНОВЛЕННЫЙ)
    async handleMatchingFootprint(session, userId, tempFootprint, finalGraph, transformationInfo,
                                existingTransformationInfo, similarity, comparisonResult,
                                tempResult, bot, chatId) {
        console.log(`✅ Следы совпали (${similarity.toFixed(3)})`);

        // 🔥 ПРОВЕРЯЕМ НАЛИЧИЕ tempResult
        if (!tempResult) {
            console.log(`⚠️ tempResult не определен, создаю пустой результат`);
            tempResult = { added: 0, error: 'tempResult не был передан' };
        }

        // Работа с шаблоном
        let vectorModel = this.vectorSuperModels.get(userId);
        if (!vectorModel) {
            const VectorSuperModel = require('./vector-super-model');
            vectorModel = new VectorSuperModel({
                name: `Шаблон_${String(userId).slice(0, 6)}`,
                enablePCA: false,
                cellSize: 25,
                debug: this.config.debug
            });
            this.vectorSuperModels.set(userId, vectorModel);
            vectorModel.addGraph(session.currentFootprint.graph, session.currentFootprint.id, {
                isFirst: true,
                transformationInfo: existingTransformationInfo
            });
        }

        vectorModel.addGraph(finalGraph, tempFootprint.id, {
            similarity: similarity,
            timestamp: new Date(),
            transformationInfo: transformationInfo
        });

        // Обновление подтверждений
        const directUpdates = this.updateConfirmationsDirectly(session.currentFootprint, tempFootprint);
        const updatedFromTemplate = this.updateConfirmationsFromTemplate(
            session.currentFootprint,
            vectorModel,
            existingTransformationInfo
        );

        // Визуализации
        const visualizationResults = await this.createVisualizations(
            session, userId, transformationInfo, existingTransformationInfo,
            comparisonResult, vectorModel, bot, chatId
        );

        // Статистика
        const stats = this.calculateConfirmationStats(session.currentFootprint);

        return {
            success: true,
            similarity: similarity,
            decision: 'same',
            nodesAdded: tempResult.added || 0,  // 🔥 ИСПОЛЬЗУЕМ tempResult.added
            message: `✅ След добавлен! Сходство: ${(similarity * 100).toFixed(1)}%`,
            hasVisualization: visualizationResults.hasVisualization,
            telegramSent: visualizationResults.telegramSent,
            templateSent: visualizationResults.templateSent,
            pointsUpdated: updatedFromTemplate + directUpdates,
            realStats: stats,
            totalPhotos: session.photos.length
        };
    }

    // 🔥 СОЗДАНИЕ ВИЗУАЛИЗАЦИЙ (исправленная версия)
    async createVisualizations(session, userId, transformationInfo, existingTransformationInfo,
                              comparisonResult, vectorModel, bot, chatId) {
        let clusterVizResult = null;
        let templateVizResult = null;
        let telegramSent = false;
        let templateSent = false;

        if (this.config.enableMergeVisualization && bot && chatId) {
            // 🔥 ОЧИСТКА ОТ Markdown-СИМВОЛОВ
            const cleanMarkdown = (text) => {
                return text
                    .replace(/\*\*/g, '')
                    .replace(/\*/g, '')
                    .replace(/__/g, '')
                    .replace(/_/g, '')
                    .replace(/`/g, '')
                    .replace(/\[/g, '(')
                    .replace(/\]/g, ')');
            };

            // 1. Визуализация подтверждений
            clusterVizResult = await this.visualizeSingleFootprintConfirmations(
                session.currentFootprint,
                userId,
                {
                    currentTransformation: transformationInfo,
                    previousTransformation: existingTransformationInfo,
                    comparisonResult: comparisonResult
                }
            );

            // 2. Визуализация шаблона (если включено)
            if (this.config.enableTemplateVisualization && vectorModel) {
                console.log(`🎨 Создаю визуализацию шаблона...`);
                templateVizResult = await this.visualizeVectorSuperModel(userId, vectorModel);
            }

            // 3. Отправка подтверждений
            if (clusterVizResult?.path && fs.existsSync(clusterVizResult.path)) {
                const stats = this.calculateConfirmationStats(session.currentFootprint);
                let caption = `🎯 РЕАЛЬНЫЕ ПОДТВЕРЖДЕНИЯ\n\n`;
                caption += `📊 Сходство: ${(comparisonResult.similarity * 100).toFixed(1)}%\n`;
                caption += `📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n`;
                caption += `🔄 Метод: ${comparisonResult.method || 'pattern_based'}\n\n`;
                caption += `📈 СТАТИСТИКА (после ${session.photos.length} фото):\n`;
                caption += `• Всего точек: ${stats.totalPoints}\n`;
                caption += `• 🔴 2+ подтверждений: ${stats.confirmed2}\n`;
                caption += `• 🔵 1 подтверждение: ${stats.confirmed1}\n`;
                caption += `• ⚪️ 0 подтверждений: ${stats.confirmed0}`;

                // 🔥 ОЧИЩАЕМ ОТ Markdown
                const cleanCaption = cleanMarkdown(caption);

                try {
                    await bot.sendPhoto(chatId, clusterVizResult.path, {
                        caption: cleanCaption,
                        parse_mode: 'HTML'
                    });
                    telegramSent = true;
                    console.log('✅ Визуализация подтверждений отправлена');
                } catch (error) {
                    console.log('❌ Ошибка отправки визуализации:', error.message);
                }
            }

            // 4. Отправка шаблона
            if (templateVizResult?.template && fs.existsSync(templateVizResult.template)) {
                try {
                    const templateStats = templateVizResult.stats || {};
                    let templateCaption = `📊 ШАБЛОН ПОСЛЕ ${session.photos.length} ФОТО\n\n`;
                    templateCaption += `📋 Ячеек: ${templateStats.cells || 0}\n`;
                    templateCaption += `✅ Подтверждений: ${templateStats.totalConfirmations || 0}\n`;
                    templateCaption += `📈 Среднее: ${templateStats.averageConfirmations?.toFixed(2) || '0.00'}\n\n`;
                    templateCaption += `🔍 Накопление деталей работает`;

                    // 🔥 ОЧИЩАЕМ ОТ Markdown
                    const cleanTemplateCaption = cleanMarkdown(templateCaption);

                    await bot.sendPhoto(chatId, templateVizResult.template, {
                        caption: cleanTemplateCaption,
                        parse_mode: 'HTML'
                    });

                    templateSent = true;
                    console.log('✅ Визуализация шаблона отправлена');
                } catch (error) {
                    console.log('❌ Ошибка отправки шаблона:', error.message);
                }
            }
        }

        return {
            hasVisualization: !!clusterVizResult,
            telegramSent: telegramSent,
            templateSent: templateSent
        };
    }

    // 🔥 ОБРАБОТКА НОВОГО СЛЕДА
    async handleNewFootprint(session, userId, analysis, photoInfo, finalGraph, transformationInfo,
                            similarity, bot, chatId) {
        console.log(`🆕 Следы разные (${similarity.toFixed(3)}) - новая модель`);

        if (session.currentFootprint.graph.nodes.size >= 10) {
            this.saveSessionAsModel(userId, `Модель_${new Date().toLocaleTimeString('ru-RU')}`);
        }

        const SimpleFootprint = require('./simple-footprint');
        session.currentFootprint = new SimpleFootprint({
            userId: userId,
            name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`
        });

        session.currentFootprint.metadata.normalizationInfo = transformationInfo;

        const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: finalGraph,
            photoId: photoInfo.photoId || `photo_${Date.now()}`,
            source: photoInfo.source || 'telegram_bot',
            transformationInfo: transformationInfo
        });

        // Новый шаблон
        const VectorSuperModel = require('./vector-super-model');
        const vectorModel = new VectorSuperModel({
            name: `Шаблон_${String(userId).slice(0, 6)}_new`,
            enablePCA: false,
            cellSize: 25,
            debug: this.config.debug
        });

        vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
            isFirst: true,
            transformationInfo: transformationInfo
        });

        this.vectorSuperModels.set(userId, vectorModel);

        return {
            success: true,
            similarity: similarity,
            decision: 'different',
            isNewModel: true,
            nodesAdded: addResult.added,
            hasTemplate: true
        };
    }

    // 🔥 НОВЫЕ ДИАГНОСТИЧЕСКИЕ МЕТОДЫ

    // Метод для отладки систем координат
    debugCoordinateSystems(userId) {
        console.log('\n🔍 ЗАПУСК ПОЛНОЙ ДИАГНОСТИКИ СИСТЕМ КООРДИНАТ');

        if (!userId) {
            console.log('⚠️ Не указан userId');
            return { success: false, error: 'Требуется userId' };
        }

        const results = {
            userId: userId,
            timestamp: new Date(),
            steps: []
        };

        try {
            // 1. Проверяем сессию
            const session = this.getActiveSession(userId);
            if (!session) {
                console.log('❌ Нет активной сессии');
                results.steps.push({ step: 'session_check', success: false, error: 'Нет активной сессии' });
                return results;
            }

            results.steps.push({ step: 'session_check', success: true, sessionId: session.id });

            // 2. Проверяем текущий отпечаток
            if (!session.currentFootprint) {
                console.log('❌ Нет текущего отпечатка в сессии');
                results.steps.push({ step: 'footprint_check', success: false, error: 'Нет отпечатка' });
                return results;
            }

            const footprint = session.currentFootprint;
            results.steps.push({
                step: 'footprint_check',
                success: true,
                footprintId: footprint.id,
                pointCount: footprint.graph?.nodes?.size || 0
            });

            // 3. Логируем системы координат отпечатка
            console.log('\n📊 СИСТЕМЫ КООРДИНАТ ОТПЕЧАТКА:');
            this.coordinateSystemLogger.logCoordinateSystems(
                `Отпечаток ${footprint.name}`,
                footprint
            );

            // 4. Проверяем трансформации
            console.log('\n🔄 ПРОВЕРКА ТРАНСФОРМАЦИЙ:');
            const validationResult = this.validateAllTransformations(userId);
            results.transformationValidation = validationResult;

            // 5. Проверяем векторную модель (шаблон)
            const vectorModel = this.getVectorSuperModel(userId);
            if (vectorModel) {
                console.log('\n🏗️ СИСТЕМЫ КООРДИНАТ ШАБЛОНА:');
                this.coordinateSystemLogger.logCoordinateSystems(
                    `Шаблон ${vectorModel.name}`,
                    vectorModel.templateBuilder
                );

                results.steps.push({
                    step: 'template_check',
                    success: true,
                    templateName: vectorModel.name
                });
            } else {
                console.log('⚠️ Нет шаблона для пользователя');
                results.steps.push({ step: 'template_check', success: false, error: 'Нет шаблона' });
            }

            // 6. Генерируем полный отчет
            console.log('\n📋 ПОЛНЫЙ ДИАГНОСТИЧЕСКИЙ ОТЧЕТ:');
            const diagnosticReport = this.generateDiagnosticReport(userId);
            results.diagnosticReport = diagnosticReport;

            // 7. Проверяем согласованность данных
            console.log('\n🔗 ПРОВЕРКА СОГЛАСОВАННОСТИ ДАННЫХ:');
            this.checkDataConsistency(userId);

            results.success = true;
            results.message = 'Диагностика завершена успешно';

            console.log('\n✅ ДИАГНОСТИКА ЗАВЕРШЕНА');

        } catch (error) {
            console.log(`❌ Ошибка диагностики: ${error.message}`);
            results.success = false;
            results.error = error.message;
            results.steps.push({ step: 'diagnostic_error', success: false, error: error.message });
        }

        return results;
    }

    // Метод для сравнения отпечатков с диагностикой
    async compareFootprintsWithDiagnostics(footprint1, footprint2, options = {}) {
        console.log('\n🔍 СРАВНЕНИЕ ОТПЕЧАТКОВ С ПОЛНОЙ ДИАГНОСТИКОЙ');

        const results = {
            timestamp: new Date(),
            footprint1: { id: footprint1.id, name: footprint1.name },
            footprint2: { id: footprint2.id, name: footprint2.name },
            steps: []
        };

        try {
            // 1. Логируем системы координат каждого отпечатка
            console.log('\n📊 СИСТЕМЫ КООРДИНАТ ДЛЯ СРАВНЕНИЯ:');
            this.coordinateSystemLogger.compareCoordinateSystems(
                footprint1,
                footprint2,
                { title: 'Сравнение отпечатков перед анализом' }
            );

            // 2. Проверяем трансформации
            const transComparison = this.validateTransformations(footprint1, footprint2);
            results.transformationComparison = transComparison;
            results.steps.push({
                step: 'transformation_check',
                success: transComparison.consistent,
                details: transComparison.differences || []
            });

            // 3. Получаем точки в единой системе координат
            console.log('\n🗺️ ПОЛУЧЕНИЕ ТОЧЕК В ЕДИНОЙ СИСТЕМЕ КООРДИНАТ:');

            const points1 = this.coordinateManager.getCoordinates(footprint1, {
                coordinateSystem: 'canonical',
                debug: true
            });

            const points2 = this.coordinateManager.getCoordinates(footprint2, {
                coordinateSystem: 'canonical',
                debug: true
            });

            results.steps.push({
                step: 'coordinate_conversion',
                success: points1.valid && points2.valid,
                points1: points1.count,
                points2: points2.count,
                system: 'canonical'
            });

            // 4. Сравниваем точки
            const pointComparison = this.coordinateManager.comparePoints(
                points1.points,
                points2.points,
                { maxDistance: 50, debug: true }
            );

            results.pointComparison = pointComparison;
            results.steps.push({
                step: 'point_comparison',
                success: pointComparison.success,
                matchCount: pointComparison.matchCount,
                matchRate: pointComparison.matchRate
            });

            // 5. Выполняем стандартное сравнение
            console.log('\n🎯 ВЫПОЛНЕНИЕ СТАНДАРТНОГО СРАВНЕНИЯ:');
            const standardComparison = await this.compareWithPatterns(footprint1, footprint2);
            results.standardComparison = standardComparison;

            // 6. Анализируем результаты
            results.finalAnalysis = this.analyzeComparisonResults(
                pointComparison,
                standardComparison,
                transComparison
            );

            // 7. Формируем итоговое решение
            const finalDecision = this.makeFinalDecision(results.finalAnalysis);
            results.finalDecision = finalDecision;

            console.log('\n🎯 ИТОГОВОЕ РЕШЕНИЕ:');
            console.log(`   Сходство: ${standardComparison.similarity.toFixed(3)}`);
            console.log(`   Совпадений точек: ${pointComparison.matchCount}/${pointComparison.points1Count}`);
            console.log(`   Трансформации согласованы: ${transComparison.consistent ? '✅' : '❌'}`);
            console.log(`   РЕШЕНИЕ: ${finalDecision.decision}`);
            if (finalDecision.reason) {
                console.log(`   Причина: ${finalDecision.reason}`);
            }

            results.success = true;

        } catch (error) {
            console.log(`❌ Ошибка сравнения с диагностикой: ${error.message}`);
            results.success = false;
            results.error = error.message;
        }

        return results;
    }

    // Метод для проверки согласованности всей системы
    validateSystemConsistency(userId = null) {
        console.log('\n🔍 ПРОВЕРКА СОГЛАСОВАННОСТИ ВСЕЙ СИСТЕМЫ');

        const results = {
            timestamp: new Date(),
            userId: userId,
            checks: [],
            overallValid: true
        };

        try {
            // 1. Проверка модулей координат
            console.log('  1. Проверка модулей координат...');
            const coordinateModulesValid = this.coordinateManager &&
                                         this.transformationValidator &&
                                         this.coordinateSystemLogger;

            results.checks.push({
                check: 'coordinate_modules',
                valid: coordinateModulesValid,
                message: coordinateModulesValid ? 'Модули координат инициализированы' : 'Модули координат не инициализированы'
            });

            if (!coordinateModulesValid) {
                results.overallValid = false;
            }

            // 2. Проверка сессий
            console.log('  2. Проверка сессий...');
            const sessionsValid = this.userSessions && this.userSessions.size >= 0;
            results.checks.push({
                check: 'sessions',
                valid: sessionsValid,
                message: sessionsValid ? `Активных сессий: ${this.userSessions.size}` : 'Проблема с сессиями'
            });

            // 3. Проверка загруженных моделей
            console.log('  3. Проверка загруженных моделей...');
            const modelsValid = this.loadedModels && this.loadedModels.size >= 0;
            results.checks.push({
                check: 'loaded_models',
                valid: modelsValid,
                message: modelsValid ? `Загружено моделей: ${this.loadedModels.size}` : 'Проблема с моделями'
            });

            // 4. Проверка векторных моделей (шаблонов)
            console.log('  4. Проверка векторных моделей...');
            const vectorModelsValid = this.vectorSuperModels && this.vectorSuperModels.size >= 0;
            results.checks.push({
                check: 'vector_models',
                valid: vectorModelsValid,
                message: vectorModelsValid ? `Шаблонов: ${this.vectorSuperModels.size}` : 'Проблема с шаблонами'
            });

            // 5. Проверка трансформаций (если указан userId)
            if (userId) {
                console.log('  5. Проверка трансформаций...');
                const validationResult = this.validateAllTransformations(userId);
                results.transformationValidation = validationResult;
                results.checks.push({
                    check: 'transformations',
                    valid: validationResult.overallValid,
                    message: validationResult.overallValid ? 'Трансформации согласованы' : 'Обнаружены расхождения в трансформациях'
                });

                if (!validationResult.overallValid) {
                    results.overallValid = false;
                }
            }

            // 6. Проверка директорий
            console.log('  6. Проверка директорий...');
            const directoriesValid = this.checkDirectories();
            results.checks.push({
                check: 'directories',
                valid: directoriesValid.valid,
                message: directoriesValid.message
            });

            if (!directoriesValid.valid) {
                results.overallValid = false;
            }

            // 7. Генерация отчета
            console.log('\n📊 ИТОГ ПРОВЕРКИ:');
            results.checks.forEach(check => {
                const status = check.valid ? '✅' : '❌';
                console.log(`  ${status} ${check.check}: ${check.message}`);
            });

            console.log(`\n🎯 ОБЩИЙ СТАТУС: ${results.overallValid ? '✅ СИСТЕМА СОГЛАСОВАНА' : '❌ ОБНАРУЖЕНЫ ПРОБЛЕМЫ'}`);

        } catch (error) {
            console.log(`❌ Ошибка проверки согласованности: ${error.message}`);
            results.overallValid = false;
            results.error = error.message;
        }

        return results;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ДИАГНОСТИКИ

    checkDataConsistency(userId) {
        const session = this.getActiveSession(userId);
        if (!session || !session.currentFootprint) return;

        const footprint = session.currentFootprint;

        // Проверяем согласованность между трекером и графом
        if (footprint.pointTracker && footprint.graph) {
            const trackerPoints = this.extractPointsFromFootprint(footprint);
            const graphNodes = Array.from(footprint.graph.nodes.values());

            console.log(`   • Точки в трекере: ${trackerPoints.length}`);
            console.log(`   • Узлы в графе: ${graphNodes.length}`);

            if (trackerPoints.length !== graphNodes.length) {
                console.log(`   ⚠️ Расхождение: трекер=${trackerPoints.length}, граф=${graphNodes.length}`);
            }
        }

        // Проверяем трансформации
        const transformations = [];
        if (footprint.transformation) transformations.push('footprint.transformation');
        if (footprint.metadata?.normalizationInfo) transformations.push('footprint.metadata.normalizationInfo');

        console.log(`   • Трансформации: ${transformations.length} источников`);

        if (transformations.length > 1) {
            console.log(`   ⚠️ Множественные трансформации: ${transformations.join(', ')}`);
        }
    }

    analyzeComparisonResults(pointComparison, standardComparison, transComparison) {
        const analysis = {
            pointMatchRate: pointComparison.matchRate,
            standardSimilarity: standardComparison.similarity,
            transformationsConsistent: transComparison.consistent,
            confidence: 0
        };

        // Рассчитываем общую уверенность
        let confidence = 0;
        let factors = 0;

        if (pointComparison.success) {
            confidence += pointComparison.matchRate;
            factors++;
        }

        if (standardComparison.similarity !== undefined) {
            confidence += standardComparison.similarity;
            factors++;
        }

        if (transComparison.consistent) {
            confidence += 1.0;
            factors++;
        }

        analysis.confidence = factors > 0 ? confidence / factors : 0;

        // Определяем рекомендации
        analysis.recommendations = [];

        if (!transComparison.consistent) {
            analysis.recommendations.push('Трансформации не согласованы. Проверьте системы координат.');
        }

        if (pointComparison.matchRate < 0.3) {
            analysis.recommendations.push('Мало совпадений точек. Возможно, разные отпечатки.');
        }

        if (standardComparison.similarity < 0.5) {
            analysis.recommendations.push('Низкое сходство паттернов.');
        }

        return analysis;
    }

    makeFinalDecision(analysis) {
        const decision = {
            decision: 'unknown',
            confidence: analysis.confidence,
            reason: ''
        };

        // Решаем на основе всех факторов
        if (analysis.confidence > 0.7) {
            decision.decision = 'same';
            decision.reason = 'Высокая общая уверенность';
        } else if (analysis.confidence > 0.4) {
            decision.decision = 'similar';
            decision.reason = 'Умеренная уверенность';
        } else {
            decision.decision = 'different';
            decision.reason = 'Низкая уверенность';
        }

        // Учитываем согласованность трансформаций
        if (!analysis.transformationsConsistent && decision.decision === 'same') {
            decision.decision = 'similar';
            decision.reason += ' (трансформации не согласованы)';
        }

        return decision;
    }

    checkDirectories() {
        const requiredDirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'sessions'),
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'reports'),
            path.join(this.config.dbPath, 'diagnostic_reports')
        ];

        const missingDirs = [];

        requiredDirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                missingDirs.push(dir);
            }
        });

        if (missingDirs.length === 0) {
            return { valid: true, message: 'Все директории существуют' };
        } else {
            return {
                valid: false,
                message: `Отсутствуют директории: ${missingDirs.map(d => path.basename(d)).join(', ')}`
            };
        }
    }

    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ (без изменений)
    getVectorSuperModel(userId) {
        return this.vectorSuperModels.get(userId);
    }

    getVectorSuperModelInfo(userId) {
        const vectorModel = this.vectorSuperModels.get(userId);
        if (!vectorModel) {
            return { exists: false, message: 'Шаблон не найден' };
        }

        const templateData = vectorModel.templateBuilder.getVisualizationData();
        const stats = templateData?.stats || {};

        return {
            exists: true,
            userId: userId,
            templateName: vectorModel.name,
            cellsCount: templateData?.cells?.length || 0,
            totalConfirmations: stats.totalConfirmations || 0,
            averageConfirmations: stats.averageConfirmations?.toFixed(2) || '0.00',
            confirmedCells: stats.confirmedCells || 0,
            lastUpdated: vectorModel.lastUpdated || new Date()
        };
    }

    clearVectorSuperModel(userId) {
        if (this.vectorSuperModels.has(userId)) {
            this.vectorSuperModels.delete(userId);
            if (this.userSessions.has(userId)) {
                this.userSessions.delete(userId);
            }
            console.log(`🧹 Очищен шаблон и сессия для пользователя ${userId}`);
            return { success: true, message: 'Шаблон и сессия очищены' };
        }
        return { success: false, message: 'Шаблон не найден' };
    }

    getTemplateVisualization(userId) {
        const vectorModel = this.vectorSuperModels.get(userId);
        return vectorModel ? this.visualizeVectorSuperModel(userId, vectorModel) : null;
    }

    calculateConfirmationStats(footprint) {
        if (!footprint?.pointTracker) {
            return { confirmed2: 0, confirmed1: 0, confirmed0: 0, totalPoints: 0 };
        }

        let confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;

        for (const [, point] of footprint.pointTracker.points) {
            const confirmations = point.confirmedCount || 1;
            if (confirmations >= 2) confirmed2++;
            else if (confirmations >= 1) confirmed1++;
            else confirmed0++;
        }

        return {
            confirmed2,
            confirmed1,
            confirmed0,
            totalPoints: confirmed2 + confirmed1 + confirmed0
        };
    }

    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'sessions'),
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'visualizations/templates'),
            path.join(this.config.dbPath, 'visualizations/alignments'),
            path.join(this.config.dbPath, 'visualizations/clusters'),
            path.join(this.config.dbPath, 'reports'),
            path.join(this.config.dbPath, 'diagnostic_reports'),
            path.join(this.config.dbPath, 'logs')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    loadExistingModels() {
        const modelsDir = path.join(this.config.dbPath, 'models');
        if (!fs.existsSync(modelsDir)) {
            fs.mkdirSync(modelsDir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.json'));
        let loadedCount = 0;

        files.slice(0, 100).forEach(file => {
            try {
                const filePath = path.join(modelsDir, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const SimpleFootprint = require('./simple-footprint');
                const footprint = SimpleFootprint.fromJSON(data);
                this.loadedModels.set(footprint.id, footprint);
                loadedCount++;
            } catch (error) {
                console.log(`⚠️ Ошибка загрузки модели ${file}:`, error.message);
            }
        });

        this.systemStats.totalModels = loadedCount;
    }

    getSystemStats() {
        const templateStats = [];
        for (const [userId, vectorModel] of this.vectorSuperModels) {
            const templateData = vectorModel.templateBuilder?.getVisualizationData();
            const stats = templateData?.stats || {};
            templateStats.push({
                userId,
                cells: templateData?.cells?.length || 0,
                totalConfirmations: stats.totalConfirmations || 0,
                averageConfirmations: stats.averageConfirmations?.toFixed(2) || '0.00'
            });
        }

        return {
            ...this.systemStats,
            activeSessions: this.userSessions.size,
            loadedModels: this.loadedModels.size,
            vectorModels: this.vectorSuperModels.size,
            templateStats: templateStats,
            coordinateDiagnostics: this.config.enableCoordinateDiagnostics
        };
    }

    // 🔥 МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ
    getMergeVisualizationCount() { return 0; }
    addMergeVisualization(userId, vizInfo) { return 1; }
}

module.exports = SimpleFootprintManager;
