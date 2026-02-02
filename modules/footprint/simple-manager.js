// modules/footprint/simple-manager.js
const fs = require('fs');
const path = require('path');

// 🔥 НОВАЯ ЕДИНАЯ СИСТЕМА КООРДИНАТ
const CoordinateSystem = require('./core/coordinate-system');
const LegacySupport = require('./legacy-support/coordinate-facade');

// 🔥 ОСТАЛЬНЫЕ МОДУЛИ
const FootprintComparisonEngine = require('./core/comparison/footprint-comparison-engine');
const TemplateCoordination = require('./core/comparison/template-coordination');
const SessionManager = require('./core/session/session-manager');
const VisualizationManager = require('./core/visualization/visualization-manager');
const GeometryUtils = require('./core/utils/geometry-utils');
const LogManager = require('./core/log-manager');
const SimpleGraph = require('./simple-graph');
const SimpleAligner = require('./alignment/simple-aligner');
const CoordinateSystemConverter = require('./alignment/coordinate-system-converter');
const CoordinateValidator = require('./alignment/coordinate-validator');
const TransformationDebugger = require('./alignment/transformation-debugger');
const ImprovedAligner = require('./alignment/improved-aligner');

class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🔥 SimpleFootprintManager создан с НОВОЙ системой координат');
       
        // 🔥 НАСТРОЙКИ
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

        // 🔥 НОВАЯ ЕДИНАЯ СИСТЕМА КООРДИНАТ
        this.coordinateSystem = CoordinateSystem;
        this.coordinateManager = new LegacySupport.CoordinateManager(this);
        this.transformationValidator = new LegacySupport.TransformationValidator(this);
       
        // 🔥 ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
        this.coordinateSystemConstants = CoordinateSystem.CONSTANTS;
        this.CoordinateSystemConstants = {
            CENTER: CoordinateSystem.CONSTANTS.CENTER,
            BOUNDS: CoordinateSystem.CONSTANTS.BOUNDS,
            CANONICAL_CENTER: CoordinateSystem.CONSTANTS.CENTER,
            getSystemInfo: () => ({
                name: 'Единая система координат следов',
                version: '2.0',
                center: CoordinateSystem.CONSTANTS.CENTER,
                bounds: CoordinateSystem.CONSTANTS.BOUNDS
            })
        };

        // 🔥 МОДУЛИ НОРМАЛИЗАЦИИ
        const RotationInvariance = require('./rotation-invariance');
        const MirrorDetection = require('./mirror-detection');
        this.rotationProcessor = new RotationInvariance({ debug: this.config.debug });
        this.mirrorDetector = new MirrorDetection({ debug: this.config.debug });

        // 🔥 ALIGNMENT МОДУЛИ
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

        // 🔥 ОСНОВНЫЕ МОДУЛИ
        this.comparisonEngine = new FootprintComparisonEngine(this);
        this.templateCoordinator = new TemplateCoordination(this);
        this.sessionManager = new SessionManager(this);
        this.visualizationManager = new VisualizationManager(this);
        this.geometryUtils = new GeometryUtils(this);
        this.log = new LogManager(this);

        // 🔥 ДОПОЛНИТЕЛЬНЫЕ МОДУЛИ
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

        // 🔥 СТРУКТУРЫ ДАННЫХ
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

        // 🔥 ПОРОГИ РЕШЕНИЙ
        this.DECISION_THRESHOLDS = {
            PATTERN_SIMILARITY: 0.6,
            MIN_MATCHES: 10,
            MAX_DISTANCE: 50,
            VECTOR_MATCH_THRESHOLD: 0.05
        };

        console.log(`🎯 Единые пороги: сходство >${this.DECISION_THRESHOLDS.PATTERN_SIMILARITY}`);

        this.ensureDirectories();
        this.loadExistingModels();

        // 🔥 ДИАГНОСТИКА
        if (this.config.enableCoordinateDiagnostics) {
            this.runInitialDiagnostics();
        }

        console.log('✅ SimpleFootprintManager инициализирован');
    }

    // 🔥 НОВЫЕ МЕТОДЫ КООРДИНАТНОЙ СИСТЕМЫ
    transformPoints(points, options = {}) {
        console.log('[SimpleManager] transformPoints -> CoordinateSystem.transform');
        return this.coordinateSystem.transform(points, options);
    }

    normalizePoints(points, options = {}) {
        console.log('[SimpleManager] normalizePoints -> CoordinateSystem.normalize');
        return this.coordinateSystem.normalize(points, options);
    }

    validatePoints(points) {
        console.log('[SimpleManager] validatePoints -> CoordinateSystem.validate');
        return this.coordinateSystem.validate(points);
    }

    calculateCenter(points) {
        return this.coordinateSystem.calculateCenter(points);
    }

    getBounds(points) {
        return this.coordinateSystem.getBounds(points);
    }

    // 🔥 Legacy методы для обратной совместимости
    getCoordinates(source, options = {}) {
        return this.coordinateManager.getCoordinates(source, options);
    }

    transformToSystem(points, fromSystem, toSystem, transformation = null) {
        return this.coordinateManager.transformToSystem(points, fromSystem, toSystem, transformation);
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

    // 🔥 МЕТОДЫ ВАЛИДАЦИИ
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

    // 🔥 МЕТОДЫ ЛОГИРОВАНИЯ (упрощенные)
    logCoordinateSystems(title, ...objects) {
        console.log(`[LOG] ${title}: ${objects.length} объектов`);
        return { logged: true, count: objects.length };
    }

    logTransformations(transformations, title = 'ТРАНСФОРМАЦИИ') {
        console.log(`[LOG] ${title}: ${Array.isArray(transformations) ? transformations.length : 1} трансформаций`);
        return { logged: true, count: Array.isArray(transformations) ? transformations.length : 1 };
    }

    generateDiagnosticReport(userId = null) {
        return {
            userId: userId,
            timestamp: new Date(),
            coordinateSystem: 'new_unified',
            status: 'active',
            modules: ['CoordinateSystem', 'LegacySupport']
        };
    }

    compareSystems(obj1, obj2, options = {}) {
        return {
            comparable: true,
            similarity: 0.5,
            distance: 0,
            points1: 0,
            points2: 0
        };
    }

    // 🔥 МЕТОДЫ СРАВНЕНИЯ
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

    // 🔥 МЕТОДЫ ШАБЛОНОВ
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

    // 🔥 МЕТОДЫ СЕССИЙ
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

    // 🔥 МЕТОДЫ ВИЗУАЛИЗАЦИИ
    async visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo = null) {
        return this.visualizationManager.visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo);
    }

    async visualizeVectorSuperModel(userId, vectorModel) {
        return this.visualizationManager.visualizeVectorSuperModel(userId, vectorModel);
    }

    debugVisualizations(userId) {
        return this.visualizationManager.debugVisualizations(userId);
    }

    // 🔥 ГЕОМЕТРИЧЕСКИЕ МЕТОДЫ
    calculateAspectRatio(points) {
        return this.geometryUtils.calculateAspectRatio(points);
    }

    calculateDistance(point1, point2) {
        return this.geometryUtils.calculateDistance(point1, point2);
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    extractPointsFromObject(obj) {
        if (Array.isArray(obj)) {
            return obj.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
        }
       
        if (obj && obj.graph && obj.graph.nodes) {
            const points = [];
            for (const [, node] of obj.graph.nodes) {
                if (node && typeof node.x === 'number' && typeof node.y === 'number') {
                    points.push({ x: node.x, y: node.y });
                }
            }
            return points;
        }
       
        if (obj && obj.points) {
            return Array.isArray(obj.points) ? obj.points : [];
        }
       
        return [];
    }

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

        // 🔥 Используем новую систему для валидации
        const validation = this.coordinateSystem.validate(points);
        if (!validation.valid) {
            console.log(`⚠️ Валидация точек: ${validation.validCount}/${validation.total} валидных`);
        }

        return points.filter(p =>
            p && typeof p.x === 'number' && typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y)
        );
    }

    extractPointsFromFootprint(footprint) {
        const result = this.coordinateManager.getCoordinates(footprint, {
            coordinateSystem: 'original',
            includeMetadata: false,
            debug: this.config.debug
        });
        return result.points;
    }

    // 🔥 ДИАГНОСТИЧЕСКИЕ МЕТОДЫ
    runInitialDiagnostics() {
        console.log('\n🔍 ЗАПУСК НАЧАЛЬНОЙ ДИАГНОСТИКИ...');

        // 1. Проверка новой системы координат
        console.log('  1. Проверка новой системы координат...');
        try {
            const testPoints = [
                { x: 100, y: 100 },
                { x: 200, y: 200 },
                { x: 300, y: 300 }
            ];

            const transformed = this.coordinateSystem.transform(testPoints);
            const center = this.calculateCenter(testPoints);
           
            console.log(`     ✅ CoordinateSystem активен`);
            console.log(`     • Трансформация: ${transformed.length} точек`);
            console.log(`     • Центр: (${center.x}, ${center.y})`);
            console.log(`     • Константы: центр (${this.coordinateSystem.CONSTANTS.CENTER.x}, ${this.coordinateSystem.CONSTANTS.CENTER.y})`);
        } catch (error) {
            console.log(`     ❌ CoordinateSystem: ${error.message}`);
        }

        // 2. Проверка Legacy поддержки
        console.log('  2. Проверка Legacy поддержки...');
        try {
            const legacyResult = this.coordinateManager.getCoordinates([{x: 100, y: 100}]);
            console.log(`     ✅ Legacy поддержка: ${legacyResult.count} точек`);
        } catch (error) {
            console.log(`     ❌ Legacy поддержка: ${error.message}`);
        }

        console.log('✅ Начальная диагностика завершена\n');
    }

    logModuleStatus() {
        const modules = [
            ['coordinateSystem', this.coordinateSystem],
            ['coordinateManager (legacy)', this.coordinateManager],
            ['transformationValidator', this.transformationValidator],
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

    // 🔥 ГЛАВНЫЙ МЕТОД: Добавление фото в сессию (упрощенный)
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО в сессию пользователя ${userId}`);

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

            // Создание сессии
            let session = this.getActiveSession(userId);
            if (!session) {
                session = this.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
            }

            // Создание графа
            const graph = new SimpleGraph(`Временный_${Date.now()}`);
            graph.buildFromPoints(points);

            // Нормализация
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

            // Обработка первого или последующего фото
            if (!session.currentFootprint) {
                return await this.processFirstPhoto(session, userId, analysis, photoInfo, normalized.graph, transformationInfo, bot, chatId);
            } else {
                return await this.processSubsequentPhoto(session, userId, analysis, photoInfo, normalized.graph, transformationInfo, bot, chatId);
            }

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    async processFirstPhoto(session, userId, analysis, photoInfo, graph, transformationInfo, bot, chatId) {
        console.log(`👣 Первое фото: создаю отпечаток`);
       
        const SimpleFootprint = require('./simple-footprint');
        session.currentFootprint = new SimpleFootprint({
            userId: userId,
            name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
            transformation: transformationInfo
        });

        session.currentFootprint.metadata.normalizationInfo = transformationInfo;
       
        const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: graph,
            photoId: photoInfo.photoId || `photo_${Date.now()}`,
            transformationInfo: transformationInfo
        });

        // Создание шаблона
        const VectorSuperModel = require('./vector-super-model');
        const vectorModel = new VectorSuperModel({
            name: `Шаблон_${String(userId).slice(0, 6)}`,
            enablePCA: false,
            cellSize: 25,
            debug: this.config.debug
        });

        vectorModel.addGraph(graph, session.currentFootprint.id, {
            isFirst: true,
            transformationInfo: transformationInfo
        });

        this.vectorSuperModels.set(userId, vectorModel);

        console.log(`✅ Создан отпечаток с ${addResult.added} узлами`);

        return {
            success: true,
            isNewSession: true,
            similarity: 0,
            decision: 'new',
            nodesAdded: addResult.added,
            totalNodes: session.currentFootprint.graph.nodes.size,
            sessionId: session.id,
            hasTemplate: true
        };
    }

    async processSubsequentPhoto(session, userId, analysis, photoInfo, graph, transformationInfo, bot, chatId) {
        console.log(`🔍 Проверяю совпадение с существующим отпечатком`);

        // Создание временного отпечатка
        const SimpleFootprint = require('./simple-footprint');
        const tempFootprint = new SimpleFootprint({
            userId: userId,
            name: `Temp_${Date.now()}`
        });

        tempFootprint.metadata.normalizationInfo = transformationInfo;
        const tempResult = tempFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: graph,
            photoId: photoInfo.photoId || `photo_${Date.now()}_temp`,
            transformationInfo: transformationInfo
        });

        // Сравнение отпечатков
        const comparisonResult = await this.compareWithPatterns(
            session.currentFootprint,
            tempFootprint
        );

        const similarity = comparisonResult?.similarity || 0;
        const decision = similarity > this.DECISION_THRESHOLDS.PATTERN_SIMILARITY ? 'same' : 'different';

        console.log(`🎯 Решение: ${decision} (сходство: ${similarity.toFixed(3)})`);

        if (decision === 'same') {
            return await this.processMatchingFootprint(
                session, userId, tempFootprint, graph, transformationInfo, similarity, comparisonResult, tempResult
            );
        } else {
            return await this.processNewFootprint(
                session, userId, analysis, photoInfo, graph, transformationInfo, similarity
            );
        }
    }

    async processMatchingFootprint(session, userId, tempFootprint, graph, transformationInfo, similarity, comparisonResult, tempResult) {
        console.log(`✅ Следы совпали (${similarity.toFixed(3)})`);
       
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
                transformationInfo: session.currentFootprint.metadata.normalizationInfo
            });
        }

        vectorModel.addGraph(graph, tempFootprint.id, {
            similarity: similarity,
            timestamp: new Date(),
            transformationInfo: transformationInfo
        });

        return {
            success: true,
            similarity: similarity,
            decision: 'same',
            nodesAdded: nodesAdded,
            message: `✅ След добавлен! Сходство: ${(similarity * 100).toFixed(1)}%`
        };
    }

    async processNewFootprint(session, userId, analysis, photoInfo, graph, transformationInfo, similarity) {
        console.log(`🆕 Следы разные (${similarity.toFixed(3)}) - новая модель`);

        const SimpleFootprint = require('./simple-footprint');
        session.currentFootprint = new SimpleFootprint({
            userId: userId,
            name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`
        });

        session.currentFootprint.metadata.normalizationInfo = transformationInfo;

        const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: graph,
            photoId: photoInfo.photoId || `photo_${Date.now()}`,
            transformationInfo: transformationInfo
        });

        return {
            success: true,
            similarity: similarity,
            decision: 'different',
            isNewModel: true,
            nodesAdded: addResult.added,
            hasTemplate: true
        };
    }

    // 🔥 УТИЛИТЫ
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
            path.join(this.config.dbPath, 'visualizations/clusters')
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
            coordinateDiagnostics: this.config.enableCoordinateDiagnostics,
            coordinateSystem: 'Новая единая система (v2.0)'
        };
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

    // 🔥 МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ
    getMergeVisualizationCount() { return 0; }
    addMergeVisualization(userId, vizInfo) { return 1; }
    getLinesOfCode() { return 5000; }
}

module.exports = SimpleFootprintManager;
