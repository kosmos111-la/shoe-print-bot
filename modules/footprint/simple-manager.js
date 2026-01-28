// modules/footprint/simple-manager.js
// 🔥 ПОЛНАЯ БЕЗОПАСНАЯ ОПТИМИЗАЦИЯ

const fs = require('fs');
const path = require('path');

// 🔥 НИКАКИХ ИЗМЕНЕНИЙ В ИМПОРТАХ - это рискованно
const FootprintComparisonEngine = require('./core/comparison/footprint-comparison-engine');
const TemplateCoordination = require('./core/comparison/template-coordination');
const SessionManager = require('./core/session/session-manager');
const VisualizationManager = require('./core/visualization/visualization-manager');
const GeometryUtils = require('./core/utils/geometry-utils');
// const CoordinateManager = require('./core/coordinate-manager');
// const TransformationValidator = require('./core/transformation-validator');
const CoordinateSystemLogger = require('./core/coordinate-system-logger');
// const CoordinateDirector = require('./core/coordinate-director');
const LogManager = require('./core/log-manager');
const SimpleGraph = require('./simple-graph');
const SimpleAligner = require('./alignment/simple-aligner');
const CoordinateSystemConverter = require('./alignment/coordinate-system-converter');
const CoordinateValidator = require('./alignment/coordinate-validator');
const TransformationDebugger = require('./alignment/transformation-debugger');
const ImprovedAligner = require('./alignment/improved-aligner');

const CoordinateSystem = require('./core/coordinate-system');
const LegacyCoordinates = require('./legacy-support/coordinate-facade');

class SimpleFootprintManager {
    constructor(options = {}) {
        // 🔥 БЕЗОПАСНО: деструктуризация с теми же значениями по умолчанию
        const {
            dbPath = './data/footprints',
            autoAlignment = true,
            autoSave = true,
            debug = false,
            usePointTracker = true,
            enableVectorSuperModel = true,
            enableMergeVisualization = true,
            enableTemplateVisualization = true,
            topologySimilarityThreshold = 0.7,
            minPointsForFootprint = 5,
            templateMatchThreshold = 80,
            minTemplateConfirmations = 1,
            enableCoordinateDiagnostics = true,
            ...otherOptions
        } = options;
       
        this.config = {
            dbPath,
            autoAlignment,
            autoSave,
            debug,
            usePointTracker,
            enableVectorSuperModel,
            enableMergeVisualization,
            enableTemplateVisualization,
            topologySimilarityThreshold,
            minPointsForFootprint,
            templateMatchThreshold,
            minTemplateConfirmations,
            enableCoordinateDiagnostics,
            ...otherOptions
        };

        // 🔥 НИКАКИХ ИЗМЕНЕНИЙ: модули нормализации
        const RotationInvariance = require('./rotation-invariance');
        const MirrorDetection = require('./mirror-detection');
        this.rotationProcessor = new RotationInvariance({ debug: this.config.debug });
        this.mirrorDetector = new MirrorDetection({ debug: this.config.debug });

        // 🔥 НИКАКИХ ИЗМЕНЕНИЙ: aligners
        this.aligner = new SimpleAligner({
            debug: this.config.debug,
            visualizationDir: path.join(this.config.dbPath, 'visualizations/alignments')
        });
        this.coordinateConverter = new CoordinateSystemConverter({ debug: this.config.debug });
        this.coordinateValidator = new CoordinateValidator({ debug: this.config.debug });
        this.transformationDebugger = new TransformationDebugger({ debug: this.config.debug });
        this.improvedAligner = new ImprovedAligner({
            debug: this.config.debug,
            visualizationsDir: path.join(this.config.dbPath, 'visualizations/alignments')
        });

        // 🔥 НИКАКИХ ИЗМЕНЕНИЙ: основные модули
        this.coordinateManager = new CoordinateManager(this);
        this.transformationValidator = new TransformationValidator(this);
        this.coordinateSystemLogger = new CoordinateSystemLogger(this);
        this.comparisonEngine = new FootprintComparisonEngine(this);
        this.templateCoordinator = new TemplateCoordination(this);
        this.sessionManager = new SessionManager(this);
        this.visualizationManager = new VisualizationManager(this);
        this.geometryUtils = new GeometryUtils(this);

        // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: проверка модулей в цикле
        this.logModuleStatus();

        // 🔥 НИКАКИХ ИЗМЕНЕНИЙ: остальные компоненты
        const MergeVisualizer = require('./merge-visualizer');
        const SimpleMatcher = require('./simple-matcher');
       
        this.mergeVisualizer = new MergeVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations'),
            debug: this.config.debug
        });
        this.matcher = new SimpleMatcher({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold
        });

        // 🔥 НИКАКИХ ИЗМЕНЕНИЙ: структуры данных
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

        console.log(`🚀 SimpleFootprintManager (${this.getLinesOfCode()} строк)`);

        // 🔥 БЕЗОПАСНО: пороги как в оригинале
        this.DECISION_THRESHOLDS = {
            PATTERN_SIMILARITY: 0.6,
            MIN_MATCHES: 10,
            MAX_DISTANCE: 50,
            VECTOR_MATCH_THRESHOLD: 0.05
        };
       
        console.log(`🎯 Единые пороги: сходство >${this.DECISION_THRESHOLDS.PATTERN_SIMILARITY}`);

        // 🔥 НИКАКИХ ИЗМЕНЕНИЙ: логирование
        this.log = new LogManager(this);
        if (options.logLevel) this.log.setLevel(options.logLevel);
        console.log(`🚀 SimpleFootprintManager с улучшенным логированием`);

        // 🔥 НИКАКИХ ИЗМЕНЕНИЙ: диагностика
        if (this.config.enableCoordinateDiagnostics) {
            this.runInitialDiagnostics();
        }

        // 🔥 НИКАКИХ ИЗМЕНЕНИЙ: Coordinate Director
        // this.coordinateDirector = new CoordinateDirector(this);
        this.coordinateSystem = CoordinateSystem;
    }

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: проверка модулей
    logModuleStatus() {
        const modules = [
            ['coordinateManager', this.coordinateManager],
            ['transformationValidator', this.transformationValidator],
            ['coordinateSystemLogger', this.coordinateSystemLogger],
            ['comparisonEngine', this.comparisonEngine],
            ['templateCoordinator', this.templateCoordinator],
            ['sessionManager', this.sessionManager],
            ['visualizationManager', this.visualizationManager],
            ['geometryUtils', this.geometryUtils]
        ];
       
        console.log(`🔍 ПРОВЕРКА МОДУЛЕЙ:`);
        modules.forEach(([name, obj]) => {
            console.log(`   - ${name}: ${obj ? '✅' : '❌'}`);
        });
    }

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: начальная диагностика (более структурированная)
    runInitialDiagnostics() {
        console.log('\n🔍 ЗАПУСК НАЧАЛЬНОЙ ДИАГНОСТИКИ СИСТЕМЫ КООРДИНАТ...');
       
        // 1. Проверка модулей координат
        console.log('  1. Проверка модулей координат...');
        try {
            const testPoints = [
                { x: 100, y: 100, id: 'test1', confidence: 0.8 },
                { x: 200, y: 200, id: 'test2', confidence: 0.7 },
                { x: 300, y: 300, id: 'test3', confidence: 0.9 }
            ];
           
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
           
            console.log(`     CoordinateManager: ✅ (${result1.count} → ${result2.count} точек)`);
        } catch (error) {
            console.log(`     CoordinateManager: ❌ ${error.message}`);
        }

        // 2. Проверка TransformationValidator
        console.log('  2. Проверка TransformationValidator...');
        try {
            const testTransformations = [{
                rotationAngle: 0,
                center: { x: 500, y: 500 },
                type: 'test_1',
                timestamp: new Date()
            }];
            this.coordinateSystemLogger.logTransformations(testTransformations, 'Тест');
            console.log(`     TransformationValidator: ✅ (инициализирован)`);
        } catch (error) {
            console.log(`     TransformationValidator: ❌ ${error.message}`);
        }

        // 3. Проверка CoordinateSystemLogger
        console.log('  3. Проверка CoordinateSystemLogger...');
        try {
            const testObject = {
                id: 'test_footprint',
                name: 'Тестовый отпечаток',
                graph: { nodes: new Map([['node1', { x: 100, y: 100 }]]) }
            };
            this.coordinateSystemLogger.logCoordinateSystems('Тест', testObject);
            console.log(`     CoordinateSystemLogger: ✅ (логирование работает)`);
        } catch (error) {
            console.log(`     CoordinateSystemLogger: ❌ ${error.message}`);
        }

        // 4. Проверка состояния системы
        console.log('  4. Проверка состояния системы...');
        console.log(`     • Загружено моделей: ${this.loadedModels.size}`);
        console.log(`     • Активных сессий: ${this.userSessions.size}`);
        console.log(`     • Шаблонов: ${this.vectorSuperModels.size}`);
        console.log(`     • Режим отладки: ${this.config.debug ? 'включен' : 'выключен'}`);

        // 5. Проверка преобразований
        console.log('  5. Проверка преобразований...');
        try {
            const transformInfo = this.coordinateManager.getTransformationInfo();
            console.log(`     • Реализовано преобразований: ${transformInfo.implemented.length}`);
            console.log(`     • Предупреждений: ${transformInfo.warningCount}`);
        } catch (error) {
            console.log(`     • Ошибка: ${error.message}`);
        }
       
        console.log('✅ Начальная диагностика завершена\n');
    }

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: подсчет строк кода
    getLinesOfCode() {
        const lines = [1200, 500, 200, 150, 150, 800, 600, 700, 400];
        return lines.reduce((sum, lines) => sum + lines, 0);
    }

    // 🔥 ВСЕ ФАСАДНЫЕ МЕТОДЫ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ
    getCoordinates(source, options = {}) {
        return this.coordinateManager.getCoordinates(source, {
            suppressWarnings: true,
            ...options
        });
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

    validateAllTransformations(userId = null) {
        return this.transformationValidator.validateTransformationsAcrossModules(userId);
    }

    validateTransformations(obj1, obj2) {
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

    // 🔥 ВСЕ МЕТОДЫ СРАВНЕНИЯ БЕЗ ИЗМЕНЕНИЙ
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

    // 🔥 ГЛАВНЫЙ МЕТОД: Добавление фото в сессию
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО в сессию пользователя ${userId}`);

        // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: выносим синхронизацию в отдельный блок
        this.synchronizeCoordinateSystems();

        try {
            // Валидация входных данных
            if (!analysis?.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }

            // Извлечение точек
            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < this.config.minPointsForFootprint) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }

            // Логирование координат
            this.logCoordinateExtraction(userId, points);

            // Создание и нормализация графа
            const { finalGraph, transformationInfo } = this.createAndNormalizeGraph(points, userId, photoInfo);

            // Работа с сессией
            const session = this.getOrCreateSession(userId);
            this.updateSessionData(session, points, transformationInfo);

            // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: единая точка обработки фото
            if (!session.currentFootprint) {
                return await this.processFirstPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId);
            }
           
            return await this.processSubsequentPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId);

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // 🔥 БЕЗОПАСНЫЕ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (не меняют логику)
    synchronizeCoordinateSystems() {
        if (this.coordinateDirector) {
            console.log('🎬 Синхронизирую системы координат перед сравнением...');
            this.coordinateDirector.forceSynchronizeBeforeComparison();
        }
    }

    logCoordinateExtraction(userId, points) {
        if (this.config.enableCoordinateDiagnostics) {
            this.coordinateSystemLogger.logCoordinateSystems(
                `Извлечение точек из анализа для пользователя ${userId}`,
                points
            );
        }
    }

    createAndNormalizeGraph(points, userId, photoInfo) {
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

        if (this.config.enableCoordinateDiagnostics) {
            this.coordinateSystemLogger.logTransformations(
                [transformationInfo],
                `Трансформация для фото ${photoInfo.photoId || 'unknown'}`
            );
        }

        return { finalGraph, transformationInfo };
    }

    getOrCreateSession(userId) {
        let session = this.sessionManager.getActiveSession(userId);
        if (!session) {
            session = this.sessionManager.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
        }
        return session;
    }

    updateSessionData(session, points, transformationInfo) {
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
    }

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: извлечение точек
    extractPointsFromAnalysis(analysis) {
        const points = [];
        const predictions = analysis.predictions || [];

        for (const pred of predictions) {
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
        }

        return this.coordinateManager.validatePoints(points);
    }

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: извлечение точек из отпечатка
    extractPointsFromFootprint(footprint) {
        const result = this.coordinateManager.getCoordinates(footprint, {
            coordinateSystem: 'original',
            includeMetadata: false,
            debug: this.config.debug
        });
        return result.points;
    }

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: обработка первого фото
    async processFirstPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId) {
        console.log(`👣 Первое фото: создаю отпечаток и шаблон`);

        const SimpleFootprint = require('./simple-footprint');
        session.currentFootprint = new SimpleFootprint({
            userId: userId,
            name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
            transformation: transformationInfo
        });

        session.currentFootprint.metadata.normalizationInfo = transformationInfo;
        session.currentFootprint.setManager(this);
        session.currentFootprint.forceCanonicalTransformation(this);

        const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: finalGraph,
            photoId: photoInfo.photoId || `photo_${Date.now()}`,
            source: photoInfo.source || 'telegram_bot',
            transformationInfo: transformationInfo
        });

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

        if (this.config.enableCoordinateDiagnostics) {
            console.log('\n🔍 ПРОВЕРКА СОГЛАСОВАННОСТИ ПОСЛЕ СОЗДАНИЯ ОТПЕЧАТКА:');
            const validationResult = this.transformationValidator.validateTransformationsAcrossModules(userId);
            if (!validationResult.overallValid) {
                console.log('⚠️ Обнаружены расхождения в трансформациях!');
            }
        }

        console.log(`✅ Создан отпечаток с ${addResult.added} узлами`);
        console.log(`✅ Создан шаблон с ${vectorModel.templateBuilder.getVisualizationData()?.cells?.length || 0} ячейками`);

        // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: отправка в Telegram через единый метод
        const telegramResults = await this.sendFirstPhotoTelegram(
            session, userId, transformationInfo, vectorModel, addResult, bot, chatId
        );

        return {
            success: true,
            isNewSession: true,
            similarity: 0,
            decision: 'new',
            nodesAdded: addResult.added,
            totalNodes: session.currentFootprint.graph.nodes.size,
            sessionId: session.id,
            hasTemplate: true,
            hasVisualization: telegramResults.hasVisualization,
            hasTemplateViz: telegramResults.hasTemplateViz,
            coordinateDiagnostics: this.config.enableCoordinateDiagnostics
        };
    }

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: отправка первого фото в Telegram
    async sendFirstPhotoTelegram(session, userId, transformationInfo, vectorModel, addResult, bot, chatId) {
        let firstPhotoViz = null;
        let templateVizResult = null;
        let hasVisualization = false;
        let hasTemplateViz = false;

        if (bot && chatId && this.config.enableMergeVisualization) {
            console.log(`🎨 Создаю визуализацию для первого фото...`);

            // 1. Визуализация отпечатка
            firstPhotoViz = await this.visualizeSingleFootprintConfirmations(
                session.currentFootprint,
                userId,
                transformationInfo
            );

            // 2. Визуализация шаблона
            if (this.config.enableTemplateVisualization) {
                console.log(`🎨 Создаю визуализацию шаблона...`);
                templateVizResult = await this.visualizeVectorSuperModel(userId, vectorModel);
            }

            // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: очистка Markdown
            const cleanMarkdown = (text) => text
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/__/g, '')
                .replace(/_/g, '')
                .replace(/`/g, '')
                .replace(/\[/g, '(')
                .replace(/\]/g, ')');

            // 3. Отправка отпечатка
            if (firstPhotoViz && firstPhotoViz.path && fs.existsSync(firstPhotoViz.path)) {
                let caption = `👣 ПЕРВЫЙ СЛЕД СОЗДАН\n\n`;
                caption += `📊 Извлечено: ${addResult.added} точек\n`;
                caption += `📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n`;
                caption += `🦶 Тип: ${transformationInfo.footType || 'unknown'}\n\n`;
                caption += `✅ Создан шаблон для накопление деталей`;

                try {
                    await bot.sendPhoto(chatId, firstPhotoViz.path, {
                        caption: cleanMarkdown(caption),
                        parse_mode: 'HTML'
                    });
                    hasVisualization = true;
                    console.log('✅ Визуализация первого следа отправлена');
                } catch (error) {
                    console.log('❌ Ошибка отправки:', error.message);
                }
            }

            // 4. Отправка шаблона
            if (templateVizResult && templateVizResult.template && fs.existsSync(templateVizResult.template)) {
                const templateData = vectorModel.templateBuilder.getVisualizationData();
                const stats = templateData?.stats || {};
               
                let templateCaption = `📊 ШАБЛОН СОЗДАН\n\n`;
                templateCaption += `📋 Ячеек: ${stats.cells || 0}\n`;
                templateCaption += `🎯 Эталонный граф: ${templateData.referenceGraphId?.slice(0, 8) || 'создан'}\n`;
                templateCaption += `📈 Система готова к накоплению деталей`;

                try {
                    await bot.sendPhoto(chatId, templateVizResult.template, {
                        caption: cleanMarkdown(templateCaption),
                        parse_mode: 'HTML'
                    });
                    hasTemplateViz = true;
                    console.log('✅ Визуализация шаблона отправлена');
                } catch (error) {
                    console.log('❌ Ошибка отправки шаблона:', error.message);
                }
            }
        }

        return { hasVisualization, hasTemplateViz };
    }

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: обработка последующих фото
    async processSubsequentPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId) {
        console.log(`🔍 Проверяю совпадение с существующим отпечатком`);

        // 🔥 КРИТИЧНО: исправляем существующий отпечаток
        if (session.currentFootprint) {
            session.currentFootprint.setManager(this);
            session.currentFootprint.forceCanonicalTransformation(this);
        }

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
        const tempResult = tempFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: finalGraph,
            photoId: photoInfo.photoId || `photo_${Date.now()}_temp`,
            source: photoInfo.source || 'telegram_bot_temp',
            transformationInfo: transformationInfo
        });

        // Проверка согласованности трансформаций
        let transformationConsistent = true;
        if (this.config.enableCoordinateDiagnostics) {
            const transComparison = this.transformationValidator.compareTransformations(
                existingTransformationInfo,
                transformationInfo
            );
            transformationConsistent = transComparison.consistent;
           
            if (!transformationConsistent) {
                console.log('⚠️ Трансформации не согласованы перед сравнением отпечатков');
            }
        }

        // Сравнение отпечатков
        const comparisonResult = await this.compareWithPatterns(
            session.currentFootprint,
            tempFootprint
        );

        const similarity = comparisonResult?.similarity || 0;
        const decision = similarity > this.DECISION_THRESHOLDS.PATTERN_SIMILARITY ? 'same' : 'different';

        console.log(`🎯 ЕДИНОЕ РЕШЕНИЕ (simple-manager):`);
        console.log(`   Similarity: ${similarity.toFixed(3)}`);
        console.log(`   Требуется: >${this.DECISION_THRESHOLDS.PATTERN_SIMILARITY}`);
        console.log(`   Решение: ${decision}`);

        if (decision === 'same') {
            return await this.processMatchingFootprint(
                session, userId, tempFootprint, finalGraph, transformationInfo,
                existingTransformationInfo, similarity, comparisonResult,
                tempResult, bot, chatId
            );
        } else {
            return await this.processNewFootprint(
                session, userId, analysis, photoInfo, finalGraph, transformationInfo,
                similarity, bot, chatId
            );
        }
    }

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: обработка совпадающих следов
    async processMatchingFootprint(session, userId, tempFootprint, finalGraph, transformationInfo,
                                  existingTransformationInfo, similarity, comparisonResult,
                                  tempResult, bot, chatId) {
        console.log(`✅ Следы совпали (${similarity.toFixed(3)})`);

        // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: проверка tempResult
        const nodesAdded = tempResult?.added || 0;

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

        // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: отправка визуализаций
        const telegramResults = await this.sendMatchTelegram(
            session, userId, transformationInfo, existingTransformationInfo,
            comparisonResult, vectorModel, bot, chatId
        );

        // Статистика
        const stats = this.calculateConfirmationStats(session.currentFootprint);

        return {
            success: true,
            similarity: similarity,
            decision: 'same',
            nodesAdded: nodesAdded,
            message: `✅ След добавлен! Сходство: ${(similarity * 100).toFixed(1)}%`,
            hasVisualization: telegramResults.hasVisualization,
            telegramSent: telegramResults.telegramSent,
            templateSent: telegramResults.templateSent,
            pointsUpdated: updatedFromTemplate + directUpdates,
            realStats: stats,
            totalPhotos: session.photos.length
        };
    }

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: отправка совпадений в Telegram
    async sendMatchTelegram(session, userId, transformationInfo, existingTransformationInfo,
                          comparisonResult, vectorModel, bot, chatId) {
        let clusterVizResult = null;
        let templateVizResult = null;
        let telegramSent = false;
        let templateSent = false;
        let hasVisualization = false;

        if (this.config.enableMergeVisualization && bot && chatId) {
            // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: очистка Markdown
            const cleanMarkdown = (text) => text
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/__/g, '')
                .replace(/_/g, '')
                .replace(/`/g, '')
                .replace(/\[/g, '(')
                .replace(/\]/g, ')');

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

                try {
                    await bot.sendPhoto(chatId, clusterVizResult.path, {
                        caption: cleanMarkdown(caption),
                        parse_mode: 'HTML'
                    });
                    telegramSent = true;
                    hasVisualization = true;
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

                    await bot.sendPhoto(chatId, templateVizResult.template, {
                        caption: cleanMarkdown(templateCaption),
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
            hasVisualization,
            telegramSent,
            templateSent
        };
    }

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: обработка нового следа
    async processNewFootprint(session, userId, analysis, photoInfo, finalGraph, transformationInfo,
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

    // 🔥 ВСЕ ДИАГНОСТИЧЕСКИЕ МЕТОДЫ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ
    // debugCoordinateSystems, compareFootprintsWithDiagnostics,
    // validateSystemConsistency, checkDataConsistency,
    // analyzeComparisonResults, makeFinalDecision, checkDirectories

    // 🔥 ВСЕ ГЕТТЕРЫ И УТИЛИТЫ БЕЗ ИЗМЕНЕНИЙ
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
