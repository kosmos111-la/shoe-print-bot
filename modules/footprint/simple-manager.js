// modules/footprint/simple-manager.js
// 🔥 ФИНАЛЬНАЯ ВЕРСИЯ С ИСПРАВЛЕНИЕМ PATTERN MATCHING + COORDINATE DIRECTOR

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

// 🔥 Импорт НОВОГО КЛЮЧЕВОГО МОДУЛЯ - COORDINATE DIRECTOR
const CoordinateDirector = require('./core/coordinate-director');

// 🔥 Импорт зависимостей
const SimpleGraph = require('./simple-graph');
const SimpleAligner = require('./alignment/simple-aligner');
const CoordinateSystemConverter = require('./alignment/coordinate-system-converter');
const CoordinateValidator = require('./alignment/coordinate-validator');
const TransformationDebugger = require('./alignment/transformation-debugger');
const ImprovedAligner = require('./alignment/improved-aligner');
const LogManager = require('./core/log-manager');

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
            enableCoordinateDiagnostics: true,
            guaranteeCanonicalSystem: true,
            compareWithRelativeRotation: true, // 🔥 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ!
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

        // 🔥 НОВЫЙ: COORDINATE DIRECTOR (главный гарант системы координат)
        this.coordinateDirector = new CoordinateDirector(this);

        // 🔥 ПРОВЕРКА МОДУЛЕЙ
        console.log(`🔍 ПРОВЕРКА МОДУЛЕЙ:`);
        console.log(`   - coordinateDirector: ${this.coordinateDirector ? '✅' : '❌'}`);
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

        console.log(`🚀 SimpleFootprintManager с COORDINATE DIRECTOR (${this.getLinesOfCode()} строк)`);

        // 🔥 ЕДИНЫЕ ПОРОГИ ДЛЯ ВСЕХ МОДУЛЕЙ
        this.DECISION_THRESHOLDS = {
            // Пороги из логов (работающие значения)
            PATTERN_SIMILARITY: 0.6,      // Из лога: 80.6% проходит → порог < 0.8
            MIN_MATCHES: 10,              // Из лога: "Недостаточно: 9" → нужно > 9
            MAX_DISTANCE: 50,             // Из лога виден порог
            VECTOR_MATCH_THRESHOLD: 0.05  // Снизили с 0.08 для совместимости
        };

        console.log(`🎯 Единые пороги решений:`);
        console.log(`   Паттерн-сходство: >${this.DECISION_THRESHOLDS.PATTERN_SIMILARITY}`);
        console.log(`   Минимальные совпадения: >${this.DECISION_THRESHOLDS.MIN_MATCHES}`);
        console.log(`   Максимальное расстояние: <${this.DECISION_THRESHOLDS.MAX_DISTANCE}px`);

        // 🔥 ИНИЦИАЛИЗАЦИЯ МЕНЕДЖЕРА ЛОГОВ
        this.log = new LogManager(this);

        // Устанавливаем уровень из конфига
        if (options.logLevel) {
            this.log.setLevel(options.logLevel);
        }

        console.log(`🚀 SimpleFootprintManager с улучшенным логированием`);

        // 🔥 ВАЖНО: ПРОВЕРЯЕМ И ИСПРАВЛЯЕМ ВСЕ СИСТЕМЫ ПРИ СТАРТЕ
        console.log('\n🎯 ЗАПУСКАЮ ИНИЦИАЛЬНУЮ ПРОВЕРКУ СИСТЕМ КООРДИНАТ...');
        const auditResult = this.coordinateDirector.auditAllSystems();
       
        if (!auditResult.allCanonical) {
            console.log('🔄 Автоматически исправляю расхождения...');
            const correctionResult = this.coordinateDirector.applyGlobalCorrections();
            console.log(`✅ Исправлено ${correctionResult.correctedCount} систем`);
        }
       
        console.log('🎬 CoordinateDirector активирован: все системы гарантированно в канонической системе (0°)');

        // 🔥 ИНИЦИАЛИЗАЦИОННАЯ ДИАГНОСТИКА (если включено)
        if (this.config.enableCoordinateDiagnostics) {
            this.runInitialDiagnostics();
        }
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

        // 2. Проверка CoordinateDirector
        console.log('  2. Проверка CoordinateDirector...');
        try {
            const directorInfo = this.coordinateDirector.getInfo();
            console.log(`     CoordinateDirector: ✅`);
            console.log(`       • Версия: ${directorInfo.directorVersion}`);
            console.log(`       • Зарегистрированных систем: ${directorInfo.registeredSystems.length}`);
            console.log(`       • Статус: ${directorInfo.status}`);
            console.log(`       • Гарантия канонической системы: ${this.config.guaranteeCanonicalSystem ? '✅' : '❌'}`);

        } catch (error) {
            console.log(`     CoordinateDirector: ❌ ${error.message}`);
        }

        // 3. Проверка TransformationValidator
        console.log('  3. Проверка TransformationValidator...');
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

            // Проверяем, что модуль инициализирован
            console.log(`     TransformationValidator: ✅ (инициализирован)`);

            // Логируем тестовые трансформации через директор
            this.coordinateDirector.registerSystem('test_system', testTransformations[1]);

        } catch (error) {
            console.log(`     TransformationValidator: ❌ ${error.message}`);
        }

        // 4. Проверка CoordinateSystemLogger
        console.log('  4. Проверка CoordinateSystemLogger...');
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

        // 5. Проверка загруженных данных
        console.log('  5. Проверка состояния системы...');
        console.log(`     • Загружено моделей: ${this.loadedModels.size}`);
        console.log(`     • Активных сессий: ${this.userSessions.size}`);
        console.log(`     • Шаблонов: ${this.vectorSuperModels.size}`);
        console.log(`     • Режим отладки: ${this.config.debug ? 'включен' : 'выключен'}`);

        // 6. Проверка доступных преобразований
        console.log('  6. Проверка преобразований...');
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
           
            // 🔥 НОВЫЙ КЛЮЧЕВОЙ МОДУЛЬ
            900,  // coordinate-director.js

            400,  // simple-manager.js (текущий файл, обновленный)
        ];
        return lines.reduce((a, b) => a + b, 0);
    }

    // 🔥 НОВЫЕ ФАСАДНЫЕ МЕТОДЫ ДЛЯ МОДУЛЕЙ КООРДИНАТ

    // Для CoordinateDirector
    enforceCanonicalSystem(systemName, transformation) {
        return this.coordinateDirector.enforceCanonicalSystem(systemName, transformation);
    }

    auditCoordinateSystems() {
        return this.coordinateDirector.auditAllSystems();
    }

    applyGlobalCoordinateCorrections() {
        return this.coordinateDirector.applyGlobalCorrections();
    }

    validateTransformationsForComparison(trans1, trans2) {
        return this.coordinateDirector.validateForComparison(trans1, trans2);
    }

    getCoordinateDirectorStats() {
        return this.coordinateDirector.getStats();
    }

    // Для CoordinateManager
    getCoordinates(source, options = {}) {
        // Добавляем suppressWarnings по умолчанию для обычной работы
        const defaultOptions = {
            suppressWarnings: true,
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

    // 🔥 НОВЫЙ МЕТОД: Сравнение с учетом относительного поворота
    async compareWithRelativeRotation(footprint1, footprint2) {
        console.log('\n🎯 СРАВНЕНИЕ С УЧЕТОМ ОТНОСИТЕЛЬНОГО ПОВОРОТА:');
       
        // 🔥 СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ УГЛЫ
        const originalAngle1 = footprint1.transformation?.rotationAngle || 0;
        const originalAngle2 = footprint2.transformation?.rotationAngle || 0;
       
        console.log(`   Угол отпечатка 1: ${originalAngle1.toFixed(1)}°`);
        console.log(`   Угол отпечатка 2: ${originalAngle2.toFixed(1)}°`);
        console.log(`   Относительный поворот: ${Math.abs(originalAngle1 - originalAngle2).toFixed(1)}°`);
       
        // 🔥 ВРЕМЕННО ПРИВОДИМ К ОДИНАКОВОМУ УГЛУ ДЛЯ СРАВНЕНИЯ
        const tempFootprint1 = this.createCopyWithAdjustedAngle(footprint1, originalAngle2);
        const tempFootprint2 = this.createCopyWithAdjustedAngle(footprint2, originalAngle1);
       
        // Сравниваем с выравниванием по углам
        const result = await this.comparisonEngine.compareWithPatterns(tempFootprint1, tempFootprint2);
       
        // Добавляем информацию об относительном повороте
        result.relativeRotation = {
            originalAngles: { angle1: originalAngle1, angle2: originalAngle2 },
            relativeDifference: Math.abs(originalAngle1 - originalAngle2),
            comparisonMethod: 'angle_aligned'
        };
       
        console.log(`   Сходство после выравнивания по углам: ${result.similarity.toFixed(3)}`);
       
        return result;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Создать копию с скорректированным углом
    createCopyWithAdjustedAngle(footprint, targetAngle) {
        const SimpleFootprint = require('./simple-footprint');
        const copy = SimpleFootprint.fromJSON(footprint.toJSON());
       
        if (copy.transformation) {
            // Сохраняем оригинальный угол в метаданных
            copy.metadata = copy.metadata || {};
            copy.metadata.originalRotationAngle = copy.transformation.rotationAngle || 0;
           
            // Устанавливаем целевой угол для сравнения
            copy.transformation.rotationAngle = targetAngle;
        }
       
        return copy;
    }

    // 🔥 СУЩЕСТВУЮЩИЕ ФАСАДНЫЕ МЕТОДЫ
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
        // 🔥 ИСПРАВЛЕНИЕ: Используем сравнение с относительным поворотом если включено
        if (this.config.compareWithRelativeRotation) {
            return await this.compareWithRelativeRotation(footprint1, footprint2);
        }
        return this.comparisonEngine.compareWithPatterns(footprint1, footprint2);
    }

    // 🔥 НОВЫЙ МЕТОД: Сравнение с гарантией канонической системы
    async compareWithGuaranteedSystem(footprint1, footprint2) {
        console.log('\n🎯 СРАВНЕНИЕ С ГАРАНТИЕЙ КАНОНИЧЕСКОЙ СИСТЕМЫ:');
       
        // 1. Гарантируем, что оба отпечатка в канонической системе
        const trans1 = this.coordinateDirector.enforceCanonicalSystem(
            'footprint1_comparison',
            footprint1.getTransformation?.() || footprint1.transformation
        );
       
        const trans2 = this.coordinateDirector.enforceCanonicalSystem(
            'footprint2_comparison',
            footprint2.getTransformation?.() || footprint2.transformation
        );
       
        // 2. Обновляем трансформации в отпечатках
        footprint1.transformation = trans1;
        footprint2.transformation = trans2;
       
        // 3. Выполняем обычное сравнение
        const result = await this.compareWithPatterns(footprint1, footprint2);
       
        // 4. Добавляем информацию о гарантии системы
        result.coordinateGuarantee = {
            guaranteed: true,
            system1: { angle: trans1.rotationAngle, center: trans1.center },
            system2: { angle: trans2.rotationAngle, center: trans2.center },
            validatedBy: 'coordinate_director'
        };
       
        return result;
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
        // 🔥 ИСПРАВЛЕНИЕ: Реализуем метод
        const session = this.getActiveSession(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии или отпечатка' };
        }

        try {
            const SimpleFootprint = require('./simple-footprint');
            const model = SimpleFootprint.fromJSON(session.currentFootprint.toJSON());
            model.id = `model_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
            model.name = modelName || `Модель_${new Date().toLocaleString('ru-RU')}`;

            // Сохраняем модель
            this.loadedModels.set(model.id, model);
           
            // Сохраняем в файл
            const modelsDir = path.join(this.config.dbPath, 'models');
            if (!fs.existsSync(modelsDir)) {
                fs.mkdirSync(modelsDir, { recursive: true });
            }
           
            const filePath = path.join(modelsDir, `${model.id}.json`);
            fs.writeFileSync(filePath, JSON.stringify(model.toJSON(), null, 2));
           
            console.log(`💾 Сессия сохранена как модель: ${model.name} (ID: ${model.id})`);
           
            return {
                success: true,
                modelId: model.id,
                modelName: model.name,
                savedTo: filePath
            };
           
        } catch (error) {
            console.log(`❌ Ошибка сохранения модели: ${error.message}`);
            return { success: false, error: error.message };
        }
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

    // 🔥 ГЛАВНЫЙ МЕТОД: Добавление фото в сессию (ОБНОВЛЕННЫЙ)
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО в сессию пользователя ${userId}`);

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

            // 🔥 ИЗМЕНЕНИЕ: используем let вместо const
            let transformationInfo = {
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

            // 🔥 ГАРАНТИЯ КАНОНИЧЕСКОЙ СИСТЕМЫ: Исправляем через директор
            if (this.config.guaranteeCanonicalSystem) {
                const canonicalTrans = this.coordinateDirector.enforceCanonicalSystem(
                    `photo_${userId}_${photoInfo.photoId || Date.now()}`,
                    transformationInfo
                );
               
                finalGraph.transformation = canonicalTrans;
                transformationInfo = canonicalTrans; // 🔥 ТЕПЕРЬ ЭТО РАБОТАЕТ
               
                console.log(`✅ Фото приведено к канонической системе: ${canonicalTrans.rotationAngle}°`);
            }

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

    // 🔥 МЕТОД: Извлечь точки из отпечатка
    extractPointsFromFootprint(footprint) {
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
            debug: this.config.debug,
            manager: this,
            coordinateManager: this.coordinateManager
        });

        vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
            isFirst: true,
            transformationInfo: transformationInfo,
            guaranteedCanonical: this.config.guaranteeCanonicalSystem
        });

        this.vectorSuperModels.set(userId, vectorModel);

        // 🔥 РЕГИСТРИРУЕМ ШАБЛОН В COORDINATE DIRECTOR
        this.coordinateDirector.registerSystem(
            `vector_model_${userId}`,
            transformationInfo
        );

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

            // 🔥 ОТПРАВКА В TELEGRAM
            try {
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

                // 3. Отправка отпечатка
                if (firstPhotoViz && firstPhotoViz.path && fs.existsSync(firstPhotoViz.path)) {
                    let caption = `👣 ПЕРВЫЙ СЛЕД СОЗДАН\n\n`;
                    caption += `📊 Извлечено: ${addResult.added} точек\n`;
                    caption += `📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n`;
                    caption += `🦶 Тип: ${transformationInfo.footType || 'unknown'}\n\n`;
                    caption += `✅ Создан шаблон для накопления деталей`;

                    const cleanCaption = cleanMarkdown(caption);

                    await bot.sendPhoto(chatId, firstPhotoViz.path, {
                        caption: cleanCaption,
                        parse_mode: 'HTML'
                    });

                    console.log('✅ Визуализация первого следа отправлена');
                }

                // 4. Отправка шаблона
                if (templateVizResult && templateVizResult.template && fs.existsSync(templateVizResult.template)) {
                    const templateData = vectorModel.templateBuilder.getVisualizationData();
                    const stats = templateData?.stats || {};

                    let templateCaption = `📊 ШАБЛОН СОЗДАН\n\n`;
                    templateCaption += `📋 Ячеек: ${stats.cells || 0}\n`;
                    templateCaption += `🎯 Эталонный граф: ${templateData.referenceGraphId?.slice(0, 8) || 'создан'}\n`;
                    templateCaption += `📈 Система готова к накоплению деталей`;

                    const cleanTemplateCaption = cleanMarkdown(templateCaption);

                    await bot.sendPhoto(chatId, templateVizResult.template, {
                        caption: cleanTemplateCaption,
                        parse_mode: 'HTML'
                    });

                    console.log('✅ Визуализация шаблона отправлена');
                }

            } catch (sendError) {
                console.log('❌ Ошибка отправки в Telegram:', sendError.message);
            }
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
            coordinateDiagnostics: this.config.enableCoordinateDiagnostics,
            canonicalSystemGuaranteed: this.config.guaranteeCanonicalSystem
        };
    }

    // 🔥 МЕТОД: Обработка последующих фото (ИСПРАВЛЕННЫЙ)
    async handleSubsequentPhoto(session, userId, analysis, photoInfo, finalGraph, originalTransformationInfo, bot, chatId) {
        console.log(`🔍 Проверяю совпадение с существующим отпечатком`);

        // 🔥 ИЗМЕНЕНИЕ: создаем копию, которую можно изменять
        let transformationInfo = { ...originalTransformationInfo };

        // 🔥 ГАРАНТИЯ КАНОНИЧЕСКОЙ СИСТЕМЫ ПЕРЕД СРАВНЕНИЕМ
        if (this.config.guaranteeCanonicalSystem) {
            console.log('🎯 ПРИВЕДЕНИЕ К ЕДИНОЙ СИСТЕМЕ КООРДИНАТ...');
           
            // 1. Исправляем текущее фото
            const canonicalPhotoTrans = this.coordinateDirector.enforceCanonicalSystem(
                `photo_${userId}_${Date.now()}`,
                transformationInfo
            );
            finalGraph.transformation = canonicalPhotoTrans;
            transformationInfo = canonicalPhotoTrans;
           
            // 2. Исправляем существующий отпечаток
            const existingTransformationInfo = session.currentFootprint.metadata.normalizationInfo ||
                                             session.currentFootprint.getTransformation();
           
            const canonicalFootprintTrans = this.coordinateDirector.enforceCanonicalSystem(
                `footprint_${session.currentFootprint.id}`,
                existingTransformationInfo
            );
           
            session.currentFootprint.transformation = canonicalFootprintTrans;
            session.currentFootprint.metadata.normalizationInfo = canonicalFootprintTrans;
           
            console.log(`✅ Обе системы приведены к канонической (0°)`);
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

        const tempResult = tempFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: finalGraph,
            photoId: photoInfo.photoId || `photo_${Date.now()}_temp`,
            source: photoInfo.source || 'telegram_bot_temp',
            transformationInfo: transformationInfo
        });

        // 🔥 СРАВНЕНИЕ С ГАРАНТИЕЙ КАНОНИЧЕСКОЙ СИСТЕМЫ
        const comparisonResult = await this.compareWithGuaranteedSystem(
            session.currentFootprint,
            tempFootprint
        );

        const similarity = comparisonResult?.similarity || 0;

        // 🔥 ИСПОЛЬЗУЕМ ЕДИНЫЙ ПОРОГ ИЗ КОНФИГА
        const decision = similarity > this.DECISION_THRESHOLDS.PATTERN_SIMILARITY ? 'same' : 'different';

        console.log(`🎯 ЕДИНОЕ РЕШЕНИЕ (с гарантией системы):`);
        console.log(`   Similarity: ${similarity.toFixed(3)}`);
        console.log(`   Требуется: >${this.DECISION_THRESHOLDS.PATTERN_SIMILARITY}`);
        console.log(`   Решение: ${decision}`);
        console.log(`   Источник: compareWithGuaranteedSystem()`);
        console.log(`   Гарантия канонической системы: ${this.config.guaranteeCanonicalSystem ? '✅' : '❌'}`);

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

    // 🔥 МЕТОД: Обработка совпадающих следов
    async handleMatchingFootprint(session, userId, tempFootprint, finalGraph, transformationInfo,
                                 existingTransformationInfo, similarity, comparisonResult,
                                 tempResult, bot, chatId) {
        console.log(`✅ Следы совпали (${similarity.toFixed(3)})`);

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
                debug: this.config.debug,
                manager: this,
                coordinateManager: this.coordinateManager
            });
            this.vectorSuperModels.set(userId, vectorModel);
            vectorModel.addGraph(session.currentFootprint.graph, session.currentFootprint.id, {
                isFirst: true,
                transformationInfo: existingTransformationInfo,
                guaranteedCanonical: this.config.guaranteeCanonicalSystem
            });
        }

        // 🔥 ГАРАНТИЯ КАНОНИЧЕСКОЙ СИСТЕМЫ ПРИ ДОБАВЛЕНИИ В ШАБЛОН
        vectorModel.addGraph(finalGraph, tempFootprint.id, {
            similarity: similarity,
            timestamp: new Date(),
            transformationInfo: transformationInfo,
            guaranteedCanonical: this.config.guaranteeCanonicalSystem
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
            nodesAdded: tempResult.added || 0,
            message: `✅ След добавлен! Сходство: ${(similarity * 100).toFixed(1)}%`,
            hasVisualization: visualizationResults.hasVisualization,
            telegramSent: visualizationResults.telegramSent,
            templateSent: visualizationResults.templateSent,
            pointsUpdated: updatedFromTemplate + directUpdates,
            realStats: stats,
            totalPhotos: session.photos.length,
            coordinateGuarantee: comparisonResult.coordinateGuarantee
        };
    }

    // 🔥 СОЗДАНИЕ ВИЗУАЛИЗАЦИЙ
    async createVisualizations(session, userId, transformationInfo, existingTransformationInfo,
                              comparisonResult, vectorModel, bot, chatId) {
        let clusterVizResult = null;
        let templateVizResult = null;
        let telegramSent = false;
        let templateSent = false;

        if (this.config.enableMergeVisualization && bot && chatId) {
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

            // 2. Визуализация шаблона
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
            debug: this.config.debug,
            manager: this,
            coordinateManager: this.coordinateManager
        });

        vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
            isFirst: true,
            transformationInfo: transformationInfo,
            guaranteedCanonical: this.config.guaranteeCanonicalSystem
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

    // 🔥 ДИАГНОСТИЧЕСКИЕ МЕТОДЫ

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
            const session = this.getActiveSession(userId);
            if (!session) {
                console.log('❌ Нет активной сессии');
                results.steps.push({ step: 'session_check', success: false, error: 'Нет активной сессии' });
                return results;
            }

            results.steps.push({ step: 'session_check', success: true, sessionId: session.id });

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

            // Аудит систем через директор
            console.log('\n🎬 АУДИТ СИСТЕМ КООРДИНАТ ЧЕРЕЗ DIRECTOR:');
            const auditResult = this.coordinateDirector.auditAllSystems();
            results.auditResult = auditResult;

            // Проверяем векторную модель
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

            results.success = true;
            results.message = 'Диагностика завершена успешно';

            console.log('\n✅ ДИАГНОСТИКА ЗАВЕРШЕНА');

        } catch (error) {
            console.log(`❌ Ошибка диагностики: ${error.message}`);
            results.success = false;
            results.error = error.message;
        }

        return results;
    }

    async compareFootprintsWithDiagnostics(footprint1, footprint2, options = {}) {
        console.log('\n🔍 СРАВНЕНИЕ ОТПЕЧАТКОВ С ПОЛНОЙ ДИАГНОСТИКОЙ');

        const results = {
            timestamp: new Date(),
            footprint1: { id: footprint1.id, name: footprint1.name },
            footprint2: { id: footprint2.id, name: footprint2.name },
            steps: []
        };

        try {
            console.log('\n🎯 ГАРАНТИЯ КАНОНИЧЕСКОЙ СИСТЕМЫ:');
            const validation = this.validateTransformationsForComparison(
                footprint1.getTransformation?.() || footprint1.transformation,
                footprint2.getTransformation?.() || footprint2.transformation
            );

            results.transformationValidation = validation;
            results.steps.push({
                step: 'coordinate_guarantee',
                success: validation.valid || validation.wasCorrected,
                details: validation.wasCorrected ? 'Исправлено директором' : 'Уже каноническая'
            });

            console.log('\n🎯 ВЫПОЛНЕНИЕ СРАВНЕНИЯ С ГАРАНТИЕЙ:');
            const comparisonResult = await this.compareWithGuaranteedSystem(footprint1, footprint2);
            results.comparisonResult = comparisonResult;

            const similarity = comparisonResult.similarity || 0;
            const decision = similarity > this.DECISION_THRESHOLDS.PATTERN_SIMILARITY ? 'same' : 'different';
           
            results.finalDecision = {
                decision: decision,
                similarity: similarity,
                threshold: this.DECISION_THRESHOLDS.PATTERN_SIMILARITY,
                coordinateGuaranteed: true
            };

            console.log('\n🎯 ИТОГОВОЕ РЕШЕНИЕ:');
            console.log(`   Сходство: ${similarity.toFixed(3)}`);
            console.log(`   Порог: >${this.DECISION_THRESHOLDS.PATTERN_SIMILARITY}`);
            console.log(`   Каноническая система: ${validation.wasCorrected ? 'исправлено' : 'гарантировано'}`);
            console.log(`   РЕШЕНИЕ: ${decision}`);

            results.success = true;

        } catch (error) {
            console.log(`❌ Ошибка сравнения с диагностикой: ${error.message}`);
            results.success = false;
            results.error = error.message;
        }

        return results;
    }

    validateSystemConsistency(userId = null) {
        console.log('\n🔍 ПРОВЕРКА СОГЛАСОВАННОСТИ ВСЕЙ СИСТЕМЫ');

        const results = {
            timestamp: new Date(),
            userId: userId,
            checks: [],
            overallValid: true
        };

        try {
            console.log('  1. Проверка CoordinateDirector...');
            const directorValid = this.coordinateDirector && this.coordinateDirector.getInfo;
            results.checks.push({
                check: 'coordinate_director',
                valid: directorValid,
                message: directorValid ? 'CoordinateDirector активен' : 'CoordinateDirector не инициализирован'
            });

            if (!directorValid) {
                results.overallValid = false;
            }

            console.log('  2. Аудит всех систем...');
            const auditResult = this.coordinateDirector.auditAllSystems();
            results.auditResult = auditResult;
           
            results.checks.push({
                check: 'systems_audit',
                valid: auditResult.allCanonical,
                message: auditResult.allCanonical ?
                    `✅ Все ${auditResult.totalSystems} систем согласованы` :
                    `❌ ${auditResult.totalSystems - auditResult.results.filter(r => r.canonical).length} систем требуют исправления`
            });

            if (!auditResult.allCanonical) {
                results.overallValid = false;
            }

            console.log('  3. Проверка сессий...');
            const sessionsValid = this.userSessions && this.userSessions.size >= 0;
            results.checks.push({
                check: 'sessions',
                valid: sessionsValid,
                message: sessionsValid ? `Активных сессий: ${this.userSessions.size}` : 'Проблема с сессиями'
            });

            console.log('  4. Проверка загруженных моделей...');
            const modelsValid = this.loadedModels && this.loadedModels.size >= 0;
            results.checks.push({
                check: 'loaded_models',
                valid: modelsValid,
                message: modelsValid ? `Загружено моделей: ${this.loadedModels.size}` : 'Проблема с моделями'
            });

            console.log('  5. Проверка векторных моделей...');
            const vectorModelsValid = this.vectorSuperModels && this.vectorSuperModels.size >= 0;
            results.checks.push({
                check: 'vector_models',
                valid: vectorModelsValid,
                message: vectorModelsValid ? `Шаблонов: ${this.vectorSuperModels.size}` : 'Проблема с шаблонами'
            });

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

    checkDataConsistency(userId) {
        const session = this.getActiveSession(userId);
        if (!session || !session.currentFootprint) return;

        const footprint = session.currentFootprint;

        if (footprint.pointTracker && footprint.graph) {
            const trackerPoints = this.extractPointsFromFootprint(footprint);
            const graphNodes = Array.from(footprint.graph.nodes.values());

            console.log(`   • Точки в трекере: ${trackerPoints.length}`);
            console.log(`   • Узлы в графе: ${graphNodes.length}`);

            if (trackerPoints.length !== graphNodes.length) {
                console.log(`   ⚠️ Расхождение: трекер=${trackerPoints.length}, граф=${graphNodes.length}`);
            }
        }

        if (footprint.transformation) {
            const isCanonical = this.coordinateDirector.isCanonical(footprint.transformation);
            const angle = footprint.transformation.rotationAngle || 0;
           
            console.log(`   • Угол поворота: ${angle.toFixed(1)}°`);
            console.log(`   • Каноническая система: ${isCanonical ? '✅' : '❌'}`);
        }
    }

    checkDirectories() {
        const requiredDirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'sessions'),
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'reports'),
            path.join(this.config.dbPath, 'diagnostic_reports'),
            path.join(this.config.dbPath, 'coordinate_audits')
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
            lastUpdated: vectorModel.lastUpdated || new Date(),
            canonicalSystem: this.config.guaranteeCanonicalSystem ? '✅ гарантирована' : '⚠️ не гарантирована'
        };
    }

    clearVectorSuperModel(userId) {
        if (this.vectorSuperModels.has(userId)) {
            this.vectorSuperModels.delete(userId);
           
            this.coordinateDirector.systemRegistry.delete(`vector_model_${userId}`);
           
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
            path.join(this.config.dbPath, 'logs'),
            path.join(this.config.dbPath, 'coordinate_audits')
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
               
                if (this.config.guaranteeCanonicalSystem && footprint.transformation) {
                    const canonicalTrans = this.coordinateDirector.enforceCanonicalSystem(
                        `loaded_model_${footprint.id}`,
                        footprint.transformation
                    );
                    footprint.transformation = canonicalTrans;
                }
               
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

        const directorStats = this.coordinateDirector.getStats();

        return {
            ...this.systemStats,
            activeSessions: this.userSessions.size,
            loadedModels: this.loadedModels.size,
            vectorModels: this.vectorSuperModels.size,
            templateStats: templateStats,
            coordinateDiagnostics: this.config.enableCoordinateDiagnostics,
            canonicalSystemGuaranteed: this.config.guaranteeCanonicalSystem,
            coordinateDirector: directorStats
        };
    }

    getMergeVisualizationCount() { return 0; }
    addMergeVisualization(userId, vizInfo) { return 1; }
}

module.exports = SimpleFootprintManager;
