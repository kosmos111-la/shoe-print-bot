// modules/footprint/simple-manager.js
// 🚀 ОПТИМИЗИРОВАННАЯ, НО СОВМЕСТИМАЯ ВЕРСИЯ

const fs = require('fs');
const path = require('path');

// 🔥 КОНСТАНТЫ
const DECISION_THRESHOLDS = {
    PATTERN_SIMILARITY: 0.6,
    MIN_MATCHES: 10,
    MAX_DISTANCE: 50,
    VECTOR_MATCH_THRESHOLD: 0.05
};

// 🔥 УТИЛИТЫ
const cleanMarkdown = (text) => text.replace(/[*_`\[\]]/g, m => ({ '*':'', '_':'', '`':'', '[':'(', ']':')' }[m]));

class SimpleFootprintManager {
    constructor(options = {}) {
        // 🔥 КОНФИГУРАЦИЯ
        this.config = {
            dbPath: './data/footprints',
            autoAlignment: true,
            autoSave: true,
            debug: false,
            usePointTracker: true,
            enableVectorSuperModel: true,
            enableMergeVisualization: true,
            enableTemplateVisualization: true,
            topologySimilarityThreshold: 0.7,
            minPointsForFootprint: 5,
            templateMatchThreshold: 80,
            minTemplateConfirmations: 1,
            enableCoordinateDiagnostics: true,
            ...options
        };

        this.DECISION_THRESHOLDS = DECISION_THRESHOLDS;
       
        // 🔥 ДИНАМИЧЕСКИЕ ИМПОРТЫ
        this._modules = new Map();
       
        // 🔥 ИНИЦИАЛИЗАЦИЯ CORE МОДУЛЕЙ
        this.initCoreModules();
       
        // 🔥 ИНИЦИАЛИЗАЦИЯ КОМПОНЕНТОВ
        this.initComponents();
       
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
       
        // 🔥 СИСТЕМНЫЕ ОПЕРАЦИИ
        this.ensureDirectories();
        this.loadExistingModels();
       
        console.log(`🚀 SimpleFootprintManager инициализирован`);
       
        // 🔥 ДИАГНОСТИКА
        this.config.enableCoordinateDiagnostics && this.runInitialDiagnostics();
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ ИМПОРТА
    _import(moduleName) {
        if (!this._modules.has(moduleName)) {
            const paths = {
                // Core модули (предзагружаем)
                'FootprintComparisonEngine': './core/comparison/footprint-comparison-engine',
                'TemplateCoordination': './core/comparison/template-coordination',
                'SessionManager': './core/session/session-manager',
                'VisualizationManager': './core/visualization/visualization-manager',
                'GeometryUtils': './core/utils/geometry-utils',
                'CoordinateManager': './core/coordinate-manager',
                'TransformationValidator': './core/transformation-validator',
                'CoordinateSystemLogger': './core/coordinate-system-logger',
                'CoordinateDirector': './core/coordinate-director',
                'LogManager': './core/log-manager',
               
                // Основные модули
                'SimpleFootprint': './simple-footprint',
                'SimpleMatcher': './simple-matcher',
                'VectorSuperModel': './vector-super-model',
                'SimpleGraph': './simple-graph',
                'MergeVisualizer': './merge-visualizer',
                'RotationInvariance': './rotation-invariance',
                'MirrorDetection': './mirror-detection',
               
                // Модули выравнивания
                'SimpleAligner': './alignment/simple-aligner',
                'ImprovedAligner': './alignment/improved-aligner'
            };
           
            const modulePath = paths[moduleName] || `./${moduleName.toLowerCase()}`;
            this._modules.set(moduleName, require(modulePath));
        }
        return this._modules.get(moduleName);
    }
   
    // 🔥 ИНИЦИАЛИЗАЦИЯ CORE МОДУЛЕЙ
    initCoreModules() {
        // Список core модулей
        const coreModules = [
            'FootprintComparisonEngine',
            'TemplateCoordination',
            'SessionManager',
            'VisualizationManager',
            'GeometryUtils',
            'CoordinateManager',
            'TransformationValidator',
            'CoordinateSystemLogger',
            'CoordinateDirector',
            'LogManager'
        ];
       
        // Инициализация каждого модуля
        coreModules.forEach(moduleName => {
            const ModuleClass = this._import(moduleName);
            const propName = this._toCamelCase(moduleName);
            this[propName] = new ModuleClass(this);
        });
       
        // Проверка
        console.log('🔍 Инициализированные модули:');
        coreModules.forEach(name => {
            const prop = this._toCamelCase(name);
            console.log(`   - ${prop}: ${this[prop] ? '✅' : '❌'}`);
        });
    }
   
    // 🔥 ИНИЦИАЛИЗАЦИЯ КОМПОНЕНТОВ
    initComponents() {
        // Обработчики
        const RotationInvariance = this._import('RotationInvariance');
        const MirrorDetection = this._import('MirrorDetection');
        this.rotationProcessor = new RotationInvariance({ debug: this.config.debug });
        this.mirrorDetector = new MirrorDetection({ debug: this.config.debug });
       
        // Выравниватели
        const SimpleAligner = this._import('SimpleAligner');
        const ImprovedAligner = this._import('ImprovedAligner');
        this.aligner = new SimpleAligner({
            debug: this.config.debug,
            visualizationDir: path.join(this.config.dbPath, 'visualizations/alignments')
        });
        this.improvedAligner = new ImprovedAligner({
            debug: this.config.debug,
            visualizationsDir: path.join(this.config.dbPath, 'visualizations/alignments')
        });
       
        // Матчер
        const SimpleMatcher = this._import('SimpleMatcher');
        this.matcher = new SimpleMatcher({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold
        });
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД
    _toCamelCase(str) {
        return str.charAt(0).toLowerCase() + str.slice(1);
    }
   
    // 🔥 ДИАГНОСТИКА
    runInitialDiagnostics() {
        console.log('\n🔍 Начальная диагностика...');
        console.log('   • Моделей:', this.loadedModels.size);
        console.log('   • Сессий:', this.userSessions.size);
        console.log('   • Шаблонов:', this.vectorSuperModels.size);
        console.log('✅ Диагностика завершена\n');
    }
   
    // 🔥 ОБЯЗАТЕЛЬНЫЕ ДИРЕКТОРИИ
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
   
    // 🔥 ЗАГРУЗКА СУЩЕСТВУЮЩИХ МОДЕЛЕЙ
    loadExistingModels() {
        const modelsDir = path.join(this.config.dbPath, 'models');
        if (!fs.existsSync(modelsDir)) return;
       
        const files = fs.readdirSync(modelsDir)
            .filter(f => f.endsWith('.json'))
            .slice(0, 100);
       
        let loaded = 0;
        files.forEach(file => {
            try {
                const filePath = path.join(modelsDir, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const SimpleFootprint = this._import('SimpleFootprint');
                const footprint = SimpleFootprint.fromJSON(data);
                this.loadedModels.set(footprint.id, footprint);
                loaded++;
            } catch (e) {
                console.log(`⚠️ Ошибка загрузки ${file}:`, e.message);
            }
        });
       
        this.systemStats.totalModels = loaded;
    }
   
    // ================ ГЛАВНЫЙ МЕТОД: ДОБАВЛЕНИЕ ФОТО ================
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 Добавление фото для ${userId}`);
       
        try {
            // ВАЛИДАЦИЯ
            if (!analysis?.predictions?.length) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }
           
            // СИНХРОНИЗАЦИЯ КООРДИНАТ
            this.coordinateDirector?.forceSynchronizeBeforeComparison();
           
            // ИЗВЛЕЧЕНИЕ ТОЧЕК
            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < this.config.minPointsForFootprint) {
                return { success: false, error: `Мало точек: ${points.length}`, nodesAdded: 0 };
            }
           
            // СОЗДАНИЕ ГРАФА
            const SimpleGraph = this._import('SimpleGraph');
            const graph = new SimpleGraph(`Temp_${Date.now()}`);
            graph.buildFromPoints(points);
           
            // НОРМАЛИЗАЦИЯ
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
           
            // СЕССИЯ
            let session = this.getActiveSession(userId);
            if (!session) {
                session = this.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
            }
           
            session.lastActivity = new Date();
            session.metadata.normalizationHistory = session.metadata.normalizationHistory || [];
            session.metadata.normalizationHistory.push(transformationInfo);
            session.metadata.lastTransformation = transformationInfo;
           
            session.photos.push({
                id: `photo_${Date.now()}`,
                timestamp: new Date(),
                pointsCount: points.length,
                transformationInfo: transformationInfo
            });
           
            // ПЕРВОЕ ФОТО ИЛИ СРАВНЕНИЕ
            if (!session.currentFootprint) {
                return await this.handleFirstPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId);
            }
           
            return await this.handleSubsequentPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId);
           
        } catch (error) {
            console.log(`❌ Ошибка: ${error.message}`);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }
   
    // 🔥 ИЗВЛЕЧЕНИЕ ТОЧЕК
    extractPointsFromAnalysis(analysis) {
        const points = analysis.predictions
            .filter(p => p.class === 'shoe-protector' && p.points?.length)
            .map(p => ({
                x: (Math.min(...p.points.map(pt => pt.x)) + Math.max(...p.points.map(pt => pt.x))) / 2,
                y: (Math.min(...p.points.map(pt => pt.y)) + Math.max(...p.points.map(pt => pt.y))) / 2,
                confidence: p.confidence || 0.5,
                originalPoints: p.points,
                class: p.class,
                _source: 'analysis',
                _timestamp: new Date()
            }));
       
        return this.coordinateManager.validatePoints(points);
    }
   
    // 🔥 ПЕРВОЕ ФОТО
    async handleFirstPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId) {
        console.log(`👣 Первое фото: создаю отпечаток`);
       
        const SimpleFootprint = this._import('SimpleFootprint');
        session.currentFootprint = new SimpleFootprint({
            userId: userId,
            name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
            transformation: transformationInfo
        });
       
        session.currentFootprint.setManager(this);
        session.currentFootprint.forceCanonicalTransformation(this);
       
        const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: finalGraph,
            photoId: photoInfo.photoId || `photo_${Date.now()}`,
            source: photoInfo.source || 'telegram_bot',
            transformationInfo: transformationInfo
        });
       
        // ШАБЛОН
        const VectorSuperModel = this._import('VectorSuperModel');
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
       
        // ВИЗУАЛИЗАЦИЯ
        let firstPhotoViz = null;
        if (bot && chatId && this.config.enableMergeVisualization) {
            firstPhotoViz = await this.visualizeSingleFootprintConfirmations(
                session.currentFootprint,
                userId,
                transformationInfo
            );
           
            if (firstPhotoViz?.path && fs.existsSync(firstPhotoViz.path)) {
                const caption = `👣 ПЕРВЫЙ СЛЕД СОЗДАН\n\n📊 Извлечено: ${addResult.added} точек\n📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n🦶 Тип: ${transformationInfo.footType || 'unknown'}`;
               
                await bot.sendPhoto(chatId, firstPhotoViz.path, {
                    caption: cleanMarkdown(caption),
                    parse_mode: 'HTML'
                });
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
            hasVisualization: !!firstPhotoViz
        };
    }
   
    // 🔥 ПОСЛЕДУЮЩИЕ ФОТО
    async handleSubsequentPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId) {
        console.log(`🔍 Проверяю совпадение`);
       
        // ИСПРАВЛЕНИЕ ОТПЕЧАТКА
        if (session.currentFootprint) {
            session.currentFootprint.setManager(this);
            session.currentFootprint.forceCanonicalTransformation(this);
        }
       
        // ВРЕМЕННЫЙ ОТПЕЧАТОК
        const SimpleFootprint = this._import('SimpleFootprint');
        const tempFootprint = new SimpleFootprint({
            userId: userId,
            name: `Temp_${Date.now()}`
        });
       
        tempFootprint.metadata.normalizationInfo = transformationInfo;
        tempFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: finalGraph,
            photoId: photoInfo.photoId || `photo_${Date.now()}_temp`,
            source: photoInfo.source || 'telegram_bot_temp',
            transformationInfo: transformationInfo
        });
       
        // СРАВНЕНИЕ
        const comparisonResult = await this.compareWithPatterns(session.currentFootprint, tempFootprint);
        const similarity = comparisonResult?.similarity || 0;
        const decision = similarity > this.DECISION_THRESHOLDS.PATTERN_SIMILARITY ? 'same' : 'different';
       
        console.log(`🎯 Решение: ${decision} (${similarity.toFixed(3)})`);
       
        if (decision === 'same') {
            return await this.handleMatchingFootprint(session, userId, tempFootprint, finalGraph, transformationInfo, similarity, comparisonResult, bot, chatId);
        }
       
        return await this.handleNewFootprint(session, userId, analysis, photoInfo, finalGraph, transformationInfo, similarity, bot, chatId);
    }
   
    // 🔥 СОВПАДАЮЩИЙ СЛЕД
    async handleMatchingFootprint(session, userId, tempFootprint, finalGraph, transformationInfo, similarity, comparisonResult, bot, chatId) {
        console.log(`✅ Следы совпали (${similarity.toFixed(3)})`);
       
        // ШАБЛОН
        let vectorModel = this.vectorSuperModels.get(userId);
        if (!vectorModel) {
            const VectorSuperModel = this._import('VectorSuperModel');
            vectorModel = new VectorSuperModel({
                name: `Шаблон_${String(userId).slice(0, 6)}`,
                enablePCA: false,
                cellSize: 25,
                debug: this.config.debug
            });
            this.vectorSuperModels.set(userId, vectorModel);
        }
       
        vectorModel.addGraph(finalGraph, `temp_${Date.now()}`, {
            similarity: similarity,
            timestamp: new Date(),
            transformationInfo: transformationInfo
        });
       
        // ПОДТВЕРЖДЕНИЯ
        this.updateConfirmationsFromTemplate(session.currentFootprint, vectorModel, transformationInfo);
       
        // ВИЗУАЛИЗАЦИЯ
        let clusterVizResult = null;
        let telegramSent = false;
       
        if (this.config.enableMergeVisualization && bot && chatId) {
            clusterVizResult = await this.visualizeSingleFootprintConfirmations(
                session.currentFootprint,
                userId,
                { currentTransformation: transformationInfo, comparisonResult: comparisonResult }
            );
           
            if (clusterVizResult?.path && fs.existsSync(clusterVizResult.path)) {
                const stats = this.calculateConfirmationStats(session.currentFootprint);
                let caption = `🎯 РЕАЛЬНЫЕ ПОДТВЕРЖДЕНИЯ\n\n📊 Сходство: ${(similarity * 100).toFixed(1)}%\n📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n\n📈 СТАТИСТИКА:\n• Всего точек: ${stats.totalPoints}\n• 🔴 2+ подтверждений: ${stats.confirmed2}\n• 🔵 1 подтверждение: ${stats.confirmed1}\n• ⚪️ 0 подтверждений: ${stats.confirmed0}`;
               
                await bot.sendPhoto(chatId, clusterVizResult.path, {
                    caption: cleanMarkdown(caption),
                    parse_mode: 'HTML'
                });
                telegramSent = true;
            }
        }
       
        return {
            success: true,
            similarity: similarity,
            decision: 'same',
            nodesAdded: 0,
            message: `✅ След добавлен! Сходство: ${(similarity * 100).toFixed(1)}%`,
            hasVisualization: !!clusterVizResult,
            telegramSent: telegramSent,
            realStats: this.calculateConfirmationStats(session.currentFootprint),
            totalPhotos: session.photos.length
        };
    }
   
    // 🔥 НОВЫЙ СЛЕД
    async handleNewFootprint(session, userId, analysis, photoInfo, finalGraph, transformationInfo, similarity, bot, chatId) {
        console.log(`🆕 Следы разные (${similarity.toFixed(3)})`);
       
        // СОХРАНЕНИЕ СТАРОЙ МОДЕЛИ
        if (session.currentFootprint?.graph?.nodes?.size >= 10) {
            this.saveSessionAsModel(userId, `Модель_${new Date().toLocaleTimeString('ru-RU')}`);
        }
       
        // НОВЫЙ ОТПЕЧАТОК
        const SimpleFootprint = this._import('SimpleFootprint');
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
       
        // НОВЫЙ ШАБЛОН
        const VectorSuperModel = this._import('VectorSuperModel');
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
   
    // ================ ФАСАДНЫЕ МЕТОДЫ (ВАЖНО! Все должны быть явно объявлены) ================
   
    // 🔥 SessionManager методы
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
   
    // 🔥 ComparisonEngine методы
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
   
    // 🔥 TemplateCoordination методы
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
   
    // 🔥 VisualizationManager методы
    async visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo = null) {
        return this.visualizationManager.visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo);
    }
   
    async visualizeVectorSuperModel(userId, vectorModel) {
        return this.visualizationManager.visualizeVectorSuperModel(userId, vectorModel);
    }
   
    debugVisualizations(userId) {
        return this.visualizationManager.debugVisualizations(userId);
    }
   
    // 🔥 GeometryUtils методы
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
   
    // 🔥 CoordinateManager методы
    getCoordinates(source, options = {}) {
        return this.coordinateManager.getCoordinates(source, { suppressWarnings: true, ...options });
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
   
    // 🔥 TransformationValidator методы
    validateAllTransformations(userId = null) {
        return this.transformationValidator.validateTransformationsAcrossModules(userId);
    }
   
    validateTransformations(obj1, obj2) {
        const trans1 = this.extractTransformations(obj1);
        const trans2 = this.extractTransformations(obj2);
       
        if (!trans1.length || !trans2.length) {
            return { consistent: false, error: 'Нет трансформаций' };
        }
       
        return this.transformationValidator.compareTransformations(trans1[0], trans2[0]);
    }
   
    extractTransformations(obj) {
        return this.transformationValidator.extractTransformationsFromFootprint(obj);
    }
   
    // 🔥 CoordinateSystemLogger методы
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
   
    // ================ ОСТАЛЬНЫЕ МЕТОДЫ ================
   
    extractPointsFromFootprint(footprint) {
        const result = this.coordinateManager.getCoordinates(footprint, {
            coordinateSystem: 'original',
            includeMetadata: false,
            debug: this.config.debug
        });
        return result.points;
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
            averageConfirmations: (stats.averageConfirmations || 0).toFixed(2),
            confirmedCells: stats.confirmedCells || 0,
            lastUpdated: vectorModel.lastUpdated || new Date()
        };
    }
   
    clearVectorSuperModel(userId) {
        if (this.vectorSuperModels.has(userId)) {
            this.vectorSuperModels.delete(userId);
            this.userSessions.delete(userId);
            console.log(`🧹 Очищен шаблон для ${userId}`);
            return { success: true, message: 'Шаблон очищен' };
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
   
    getSystemStats() {
        const templateStats = [];
        for (const [userId, vectorModel] of this.vectorSuperModels) {
            const templateData = vectorModel.templateBuilder?.getVisualizationData();
            const stats = templateData?.stats || {};
            templateStats.push({
                userId,
                cells: templateData?.cells?.length || 0,
                totalConfirmations: stats.totalConfirmations || 0,
                averageConfirmations: (stats.averageConfirmations || 0).toFixed(2)
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
   
    getLinesOfCode() {
        return 3500;
    }
   
    // 🔥 МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ
    getMergeVisualizationCount() { return 0; }
    addMergeVisualization(userId, vizInfo) { return 1; }
}

module.exports = SimpleFootprintManager;
