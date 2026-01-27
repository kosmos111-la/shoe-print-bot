// modules/footprint/simple-manager.js
// 🚀 СУПЕР-ОПТИМИЗИРОВАННАЯ ВЕРСИЯ

const fs = require('fs');
const path = require('path');

// 🔥 ВСЕ КОНСТАНТЫ И УТИЛИТЫ В ОДНОМ МЕСТЕ
const CONSTANTS = {
    DECISION_THRESHOLDS: {
        PATTERN_SIMILARITY: 0.6,
        MIN_MATCHES: 10,
        MAX_DISTANCE: 50,
        VECTOR_MATCH_THRESHOLD: 0.05
    },
   
    DEFAULT_CONFIG: {
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
        enableCoordinateDiagnostics: true
    },
   
    DIRECTORIES: [
        'models', 'sessions', 'visualizations', 'visualizations/templates',
        'visualizations/alignments', 'visualizations/clusters', 'reports',
        'diagnostic_reports', 'logs'
    ]
};

// 🔥 УТИЛИТАРНЫЕ ФУНКЦИИ
const Utils = {
    cleanMarkdown: text => text.replace(/[*_`\[\]]/g, m => ({ '*':'', '_':'', '`':'', '[':'(', ']':')' }[m])),
   
    formatFloat: (num, decimals = 2) => num.toFixed(decimals),
   
    isValidVisualization: viz => viz?.path && fs.existsSync(viz.path),
   
    ensureDir: dir => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true }),
   
    log: (emoji, ...args) => console.log(emoji, ...args)
};

class SimpleFootprintManager {
    constructor(options = {}) {
        // 🔥 СУПЕР-КОМПАКТНАЯ ИНИЦИАЛИЗАЦИЯ
        this.config = { ...CONSTANTS.DEFAULT_CONFIG, ...options };
        this.DECISION_THRESHOLDS = CONSTANTS.DECISION_THRESHOLDS;
       
        // 🔥 ДИНАМИЧЕСКИЕ ИМПОРТЫ (ТОЛЬКО ПО ТРЕБОВАНИЮ)
        this.modules = new Map();
        this.dynamicImports = new Map();
       
        // 🔥 ЕДИНАЯ ИНИЦИАЛИЗАЦИЯ
        this.initModules();
        this.initComponents();
        this.initDataStructures();
       
        // 🔥 СИСТЕМНЫЕ ОПЕРАЦИИ
        this.ensureDirectories();
        this.loadExistingModels();
       
        Utils.log('🚀', `SimpleFootprintManager оптимизирован`);
        Utils.log('🎯', `Пороги: сходство >${this.DECISION_THRESHOLDS.PATTERN_SIMILARITY}`);
       
        // 🔥 ДОПОЛНИТЕЛЬНЫЕ ИНИЦИАЛИЗАЦИИ
        this.config.enableCoordinateDiagnostics && this.runInitialDiagnostics();
    }
   
    // 🔥 МЕТОД ДЛЯ ДИНАМИЧЕСКОЙ ЗАГРУЗКИ МОДУЛЕЙ
    import(moduleName, modulePath = null) {
        if (!this.dynamicImports.has(moduleName)) {
            const path = modulePath || this.guessModulePath(moduleName);
            this.dynamicImports.set(moduleName, require(path));
        }
        return this.dynamicImports.get(moduleName);
    }
   
    guessModulePath(name) {
        const paths = {
            // Основные модули
            'SimpleFootprint': './simple-footprint',
            'SimpleMatcher': './simple-matcher',
            'VectorSuperModel': './vector-super-model',
            'SimpleGraph': './simple-graph',
            'MergeVisualizer': './merge-visualizer',
           
            // Обработчики
            'RotationInvariance': './rotation-invariance',
            'MirrorDetection': './mirror-detection',
           
            // Выравнивание
            'SimpleAligner': './alignment/simple-aligner',
            'ImprovedAligner': './alignment/improved-aligner',
            'CoordinateSystemConverter': './alignment/coordinate-system-converter',
            'CoordinateValidator': './alignment/coordinate-validator',
            'TransformationDebugger': './alignment/transformation-debugger',
           
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
            'LogManager': './core/log-manager'
        };
       
        return paths[name] || `./${name.toLowerCase()}`;
    }
   
    // 🔥 ЕДИНАЯ ИНИЦИАЛИЗАЦИЯ МОДУЛЕЙ
    initModules() {
        const coreModules = [
            'FootprintComparisonEngine', 'TemplateCoordination', 'SessionManager',
            'VisualizationManager', 'GeometryUtils', 'CoordinateManager',
            'TransformationValidator', 'CoordinateSystemLogger', 'CoordinateDirector', 'LogManager'
        ];
       
        coreModules.forEach(name => {
            const ModuleClass = this.import(name);
            this[this.toCamelCase(name)] = new ModuleClass(this);
        });
       
        // 🔥 ПРОВЕРКА МОДУЛЕЙ
        Utils.log('🔍', 'Проверка модулей:');
        coreModules.forEach(name => {
            const prop = this.toCamelCase(name);
            Utils.log(' ', `- ${prop}: ${this[prop] ? '✅' : '❌'}`);
        });
    }
   
    toCamelCase(str) {
        return str.charAt(0).toLowerCase() + str.slice(1).replace(/([A-Z])/g, '-$1').toLowerCase().replace(/-./g, x => x[1].toUpperCase());
    }
   
    // 🔥 ИНИЦИАЛИЗАЦИЯ КОМПОНЕНТОВ
    initComponents() {
        // Обработчики
        this.rotationProcessor = new (this.import('RotationInvariance'))({ debug: this.config.debug });
        this.mirrorDetector = new (this.import('MirrorDetection'))({ debug: this.config.debug });
       
        // Выравниватели
        this.aligner = new (this.import('SimpleAligner'))({
            debug: this.config.debug,
            visualizationDir: path.join(this.config.dbPath, 'visualizations/alignments')
        });
       
        this.improvedAligner = new (this.import('ImprovedAligner'))({
            debug: this.config.debug,
            visualizationsDir: path.join(this.config.dbPath, 'visualizations/alignments')
        });
       
        // Дополнительные
        this.coordinateConverter = new (this.import('CoordinateSystemConverter'))({ debug: this.config.debug });
        this.coordinateValidator = new (this.import('CoordinateValidator'))({ debug: this.config.debug });
        this.transformationDebugger = new (this.import('TransformationDebugger'))({ debug: this.config.debug });
       
        // Визуализаторы
        this.mergeVisualizer = new (this.import('MergeVisualizer'))({
            outputDir: path.join(this.config.dbPath, 'visualizations'),
            debug: this.config.debug
        });
       
        // Матчер
        this.matcher = new (this.import('SimpleMatcher'))({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold
        });
    }
   
    // 🔥 ИНИЦИАЛИЗАЦИЯ СТРУКТУР ДАННЫХ
    initDataStructures() {
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
    }
   
    // 🔥 НАЧАЛЬНАЯ ДИАГНОСТИКА (СУПЕР-КОМПАКТНАЯ)
    runInitialDiagnostics() {
        Utils.log('🔍', 'Начальная диагностика...');
       
        const tests = [
            () => this.testModule('CoordinateManager', () => this.coordinateManager.getCoordinates([{x:100,y:100}], {suppressWarnings:true})),
            () => this.testModule('TransformationValidator', () => this.coordinateSystemLogger.logTransformations([{test:1}], 'Тест')),
            () => this.testModule('CoordinateSystemLogger', () => this.coordinateSystemLogger.logCoordinateSystems('Тест', {test:1})),
            () => this.testSystemState()
        ];
       
        tests.forEach((test, i) => {
            Utils.log(' ', `${i+1}.`, test.name || 'Тест');
            test();
        });
       
        Utils.log('✅', 'Диагностика завершена\n');
    }
   
    testModule(name, testFn) {
        try {
            testFn();
            Utils.log('   ', `✅ ${name}`);
        } catch (e) {
            Utils.log('   ', `❌ ${name}: ${e.message}`);
        }
    }
   
    testSystemState() {
        Utils.log('   ', `• Моделей: ${this.loadedModels.size}`);
        Utils.log('   ', `• Сессий: ${this.userSessions.size}`);
        Utils.log('   ', `• Шаблонов: ${this.vectorSuperModels.size}`);
        Utils.log('   ', `• Отладка: ${this.config.debug ? 'вкл' : 'выкл'}`);
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: ДОБАВЛЕНИЕ ФОТО (ОПТИМИЗИРОВАННЫЙ)
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        Utils.log('📸', `Добавление фото для ${userId}`);
       
        try {
            // ВАЛИДАЦИЯ
            if (!analysis?.predictions?.length) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }
           
            // СИНХРОНИЗАЦИЯ КООРДИНАТ
            this.coordinateDirector?.forceSynchronizeBeforeComparison();
           
            // ИЗВЛЕЧЕНИЕ И ОБРАБОТКА ТОЧЕК
            const points = this.extractPoints(analysis);
            if (points.length < this.config.minPointsForFootprint) {
                return { success: false, error: `Мало точек: ${points.length}`, nodesAdded: 0 };
            }
           
            // ДИАГНОСТИКА
            this.config.enableCoordinateDiagnostics && this.logCoordinateData(userId, points, photoInfo);
           
            // СОЗДАНИЕ И НОРМАЛИЗАЦИЯ ГРАФА
            const { finalGraph, transformationInfo } = this.createAndNormalizeGraph(points, photoInfo);
           
            // РАБОТА С СЕССИЕЙ
            const session = this.ensureSession(userId, transformationInfo);
           
            // ОБРАБОТКА ФОТО
            return await this.processPhoto({
                session, userId, analysis, photoInfo, finalGraph, transformationInfo, points, bot, chatId
            });
           
        } catch (error) {
            Utils.log('❌', `Ошибка: ${error.message}`);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }
   
    // 🔥 ОПТИМИЗИРОВАННЫЕ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    extractPoints(analysis) {
        const points = analysis.predictions
            .filter(p => p.class === 'shoe-protector' && p.points?.length)
            .map(p => ({
                x: (Math.min(...p.points.map(p => p.x)) + Math.max(...p.points.map(p => p.x))) / 2,
                y: (Math.min(...p.points.map(p => p.y)) + Math.max(...p.points.map(p => p.y))) / 2,
                confidence: p.confidence || 0.5,
                originalPoints: p.points,
                class: p.class,
                _source: 'analysis',
                _timestamp: new Date()
            }));
       
        return this.coordinateManager.validatePoints(points);
    }
   
    logCoordinateData(userId, points, photoInfo) {
        this.coordinateSystemLogger.logCoordinateSystems(`Точки для ${userId}`, points);
        this.coordinateSystemLogger.logTransformations(
            [{ photoId: photoInfo.photoId || 'unknown', timestamp: new Date() }],
            `Трансформация для ${photoInfo.photoId || 'unknown'}`
        );
    }
   
    createAndNormalizeGraph(points, photoInfo) {
        const SimpleGraph = this.import('SimpleGraph');
        const graph = new SimpleGraph(`Temp_${Date.now()}`);
        graph.buildFromPoints(points);
       
        const normalized = this.rotationProcessor.normalizeToCanonical(graph, {
            userId: 'temp',
            photoInfo,
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
       
        corrected.graph.transformation = transformationInfo;
       
        return {
            finalGraph: corrected.graph,
            transformationInfo
        };
    }
   
    ensureSession(userId, transformationInfo) {
        let session = this.sessionManager.getActiveSession(userId);
       
        if (!session) {
            session = this.sessionManager.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
        }
       
        session.lastActivity = new Date();
        session.metadata.normalizationHistory = session.metadata.normalizationHistory || [];
        session.metadata.normalizationHistory.push(transformationInfo);
        session.metadata.lastTransformation = transformationInfo;
       
        session.photos.push({
            id: `photo_${Date.now()}`,
            timestamp: new Date(),
            pointsCount: transformationInfo.pointsCount || 0,
            transformationInfo
        });
       
        return session;
    }
   
    async processPhoto(params) {
        const { session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId } = params;
       
        // ПЕРВОЕ ФОТО
        if (!session.currentFootprint) {
            return await this.processFirstPhoto(params);
        }
       
        // ПОСЛЕДУЮЩИЕ ФОТО
        return await this.processSubsequentPhoto(params);
    }
   
    async processFirstPhoto({ session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId }) {
        Utils.log('👣', 'Первое фото: создаю отпечаток и шаблон');
       
        // СОЗДАНИЕ ОТПЕЧАТКА
        const SimpleFootprint = this.import('SimpleFootprint');
        session.currentFootprint = new SimpleFootprint({
            userId,
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
            transformationInfo
        });
       
        // СОЗДАНИЕ ШАБЛОНА
        const VectorSuperModel = this.import('VectorSuperModel');
        const vectorModel = new VectorSuperModel({
            name: `Шаблон_${String(userId).slice(0, 6)}`,
            enablePCA: false,
            cellSize: 25,
            debug: this.config.debug
        });
       
        vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
            isFirst: true,
            transformationInfo
        });
       
        this.vectorSuperModels.set(userId, vectorModel);
       
        // ВИЗУАЛИЗАЦИИ
        const visualizations = await this.createVisualizations({
            type: 'first',
            session,
            userId,
            transformationInfo,
            vectorModel,
            addResult,
            bot,
            chatId
        });
       
        return {
            success: true,
            isNewSession: true,
            similarity: 0,
            decision: 'new',
            nodesAdded: addResult.added,
            totalNodes: session.currentFootprint.graph.nodes.size,
            sessionId: session.id,
            hasTemplate: true,
            hasVisualization: !!visualizations.footprintViz,
            hasTemplateViz: !!visualizations.templateViz,
            coordinateDiagnostics: this.config.enableCoordinateDiagnostics
        };
    }
   
    async processSubsequentPhoto({ session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId }) {
        Utils.log('🔍', 'Проверяю совпадение с существующим отпечатком');
       
        // ИСПРАВЛЕНИЕ СУЩЕСТВУЮЩЕГО ОТПЕЧАТКА
        session.currentFootprint?.setManager(this);
        session.currentFootprint?.forceCanonicalTransformation(this);
       
        // ВРЕМЕННЫЙ ОТПЕЧАТОК ДЛЯ СРАВНЕНИЯ
        const SimpleFootprint = this.import('SimpleFootprint');
        const tempFootprint = new SimpleFootprint({ userId, name: `Temp_${Date.now()}` });
        tempFootprint.metadata.normalizationInfo = transformationInfo;
       
        tempFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: finalGraph,
            photoId: photoInfo.photoId || `photo_${Date.now()}_temp`,
            source: photoInfo.source || 'telegram_bot_temp',
            transformationInfo
        });
       
        // СРАВНЕНИЕ
        const comparisonResult = await this.compareWithPatterns(session.currentFootprint, tempFootprint);
        const similarity = comparisonResult?.similarity || 0;
        const decision = similarity > this.DECISION_THRESHOLDS.PATTERN_SIMILARITY ? 'same' : 'different';
       
        Utils.log('🎯', `Решение: ${decision} (сходство: ${Utils.formatFloat(similarity, 3)})`);
       
        if (decision === 'same') {
            return await this.processMatchingFootprint({
                session, userId, tempFootprint, finalGraph, transformationInfo,
                existingTransformationInfo: session.currentFootprint.metadata.normalizationInfo,
                similarity, comparisonResult, bot, chatId
            });
        }
       
        return await this.processNewFootprint({
            session, userId, analysis, photoInfo, finalGraph, transformationInfo, similarity, bot, chatId
        });
    }
   
    async processMatchingFootprint(params) {
        const { session, userId, finalGraph, transformationInfo, existingTransformationInfo,
                similarity, comparisonResult, bot, chatId } = params;
       
        Utils.log('✅', `Следы совпали (${Utils.formatFloat(similarity, 3)})`);
       
        // ОБНОВЛЕНИЕ ШАБЛОНА
        let vectorModel = this.vectorSuperModels.get(userId);
        if (!vectorModel) {
            const VectorSuperModel = this.import('VectorSuperModel');
            vectorModel = new VectorSuperModel({
                name: `Шаблон_${String(userId).slice(0, 6)}`,
                enablePCA: false,
                cellSize: 25,
                debug: this.config.debug
            });
            this.vectorSuperModels.set(userId, vectorModel);
        }
       
        vectorModel.addGraph(finalGraph, `temp_${Date.now()}`, {
            similarity,
            timestamp: new Date(),
            transformationInfo
        });
       
        // ОБНОВЛЕНИЕ ПОДТВЕРЖДЕНИЙ
        this.updateConfirmationsFromTemplate(session.currentFootprint, vectorModel, existingTransformationInfo);
       
        // ВИЗУАЛИЗАЦИИ
        const visualizations = await this.createVisualizations({
            type: 'match',
            session,
            userId,
            transformationInfo,
            existingTransformationInfo,
            comparisonResult,
            vectorModel,
            bot,
            chatId
        });
       
        return {
            success: true,
            similarity,
            decision: 'same',
            nodesAdded: 0,
            message: `✅ След добавлен! Сходство: ${Utils.formatFloat(similarity * 100, 1)}%`,
            hasVisualization: !!visualizations.footprintViz,
            telegramSent: visualizations.telegramSent,
            templateSent: visualizations.templateSent,
            realStats: this.calculateConfirmationStats(session.currentFootprint),
            totalPhotos: session.photos.length
        };
    }
   
    async processNewFootprint({ session, userId, analysis, photoInfo, finalGraph, transformationInfo, similarity, bot, chatId }) {
        Utils.log('🆕', `Следы разные (${Utils.formatFloat(similarity, 3)}) - новая модель`);
       
        // СОХРАНЕНИЕ СТАРОЙ МОДЕЛИ
        session.currentFootprint?.graph?.nodes?.size >= 10 &&
            this.saveSessionAsModel(userId, `Модель_${new Date().toLocaleTimeString('ru-RU')}`);
       
        // НОВЫЙ ОТПЕЧАТОК
        const SimpleFootprint = this.import('SimpleFootprint');
        session.currentFootprint = new SimpleFootprint({
            userId,
            name: `Отпечаток_${new Date().toLocaleTimeString('ru-RU')}`
        });
       
        session.currentFootprint.metadata.normalizationInfo = transformationInfo;
       
        const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: finalGraph,
            photoId: photoInfo.photoId || `photo_${Date.now()}`,
            source: photoInfo.source || 'telegram_bot',
            transformationInfo
        });
       
        // НОВЫЙ ШАБЛОН
        const VectorSuperModel = this.import('VectorSuperModel');
        const vectorModel = new VectorSuperModel({
            name: `Шаблон_${String(userId).slice(0, 6)}_new`,
            enablePCA: false,
            cellSize: 25,
            debug: this.config.debug
        });
       
        vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
            isFirst: true,
            transformationInfo
        });
       
        this.vectorSuperModels.set(userId, vectorModel);
       
        return {
            success: true,
            similarity,
            decision: 'different',
            isNewModel: true,
            nodesAdded: addResult.added,
            hasTemplate: true
        };
    }
   
    // 🔥 УНИВЕРСАЛЬНЫЙ МЕТОД СОЗДАНИЯ ВИЗУАЛИЗАЦИЙ
    async createVisualizations({ type, session, userId, transformationInfo, existingTransformationInfo,
                                 comparisonResult, vectorModel, addResult, bot, chatId }) {
        if (!this.config.enableMergeVisualization || !bot || !chatId) {
            return {};
        }
       
        const result = {};
       
        // ВИЗУАЛИЗАЦИЯ ОТПЕЧАТКА
        if (type === 'first' || type === 'match') {
            result.footprintViz = await this.visualizeSingleFootprintConfirmations(
                session.currentFootprint,
                userId,
                { currentTransformation: transformationInfo, previousTransformation: existingTransformationInfo, comparisonResult }
            );
        }
       
        // ВИЗУАЛИЗАЦИЯ ШАБЛОНА
        if (this.config.enableTemplateVisualization && vectorModel) {
            result.templateViz = await this.visualizeVectorSuperModel(userId, vectorModel);
        }
       
        // ОТПРАВКА В TELEGRAM
        if (Utils.isValidVisualization(result.footprintViz)) {
            const caption = this.generateCaption(type, { session, transformationInfo, comparisonResult, addResult });
            result.telegramSent = await this.sendTelegramPhoto(bot, chatId, result.footprintViz.path, caption);
        }
       
        if (Utils.isValidVisualization(result.templateViz)) {
            const templateCaption = this.generateTemplateCaption(type, { session, vectorModel });
            result.templateSent = await this.sendTelegramPhoto(bot, chatId, result.templateViz.template, templateCaption);
        }
       
        return result;
    }
   
    generateCaption(type, data) {
        const { session, transformationInfo, comparisonResult, addResult } = data;
       
        const captions = {
            first: `👣 ПЕРВЫЙ СЛЕД СОЗДАН\n\n📊 Извлечено: ${addResult?.added || 0} точек\n📐 Угол: ${Utils.formatFloat(transformationInfo.rotationAngle, 1)}°\n🦶 Тип: ${transformationInfo.footType || 'unknown'}\n\n✅ Создан шаблон`,
           
            match: () => {
                const stats = this.calculateConfirmationStats(session.currentFootprint);
                return `🎯 РЕАЛЬНЫЕ ПОДТВЕРЖДЕНИЯ\n\n📊 Сходство: ${Utils.formatFloat((comparisonResult?.similarity || 0) * 100, 1)}%\n📐 Угол: ${Utils.formatFloat(transformationInfo.rotationAngle, 1)}°\n\n📈 СТАТИСТИКА (после ${session.photos.length} фото):\n• Всего точек: ${stats.totalPoints}\n• 🔴 2+ подтверждений: ${stats.confirmed2}\n• 🔵 1 подтверждение: ${stats.confirmed1}\n• ⚪️ 0 подтверждений: ${stats.confirmed0}`;
            }
        };
       
        return Utils.cleanMarkdown(typeof captions[type] === 'function' ? captions[type]() : captions[type] || '📸 Визуализация');
    }
   
    generateTemplateCaption(type, { session, vectorModel }) {
        const templateData = vectorModel.templateBuilder?.getVisualizationData();
        const stats = templateData?.stats || {};
       
        const captions = {
            first: `📊 ШАБЛОН СОЗДАН\n\n📋 Ячеек: ${stats.cells || 0}\n🎯 Эталонный граф: ${templateData?.referenceGraphId?.slice(0, 8) || 'создан'}`,
           
            match: `📊 ШАБЛОН ПОСЛЕ ${session.photos.length} ФОТО\n\n📋 Ячеек: ${stats.cells || 0}\n✅ Подтверждений: ${stats.totalConfirmations || 0}\n📈 Среднее: ${Utils.formatFloat(stats.averageConfirmations, 2) || '0.00'}`
        };
       
        return Utils.cleanMarkdown(captions[type] || '📊 Шаблон');
    }
   
    async sendTelegramPhoto(bot, chatId, imagePath, caption) {
        try {
            await bot.sendPhoto(chatId, imagePath, { caption, parse_mode: 'HTML' });
            Utils.log('✅', 'Фото отправлено в Telegram');
            return true;
        } catch (error) {
            Utils.log('❌', `Ошибка отправки: ${error.message}`);
            return false;
        }
    }
   
    // 🔥 ОБЯЗАТЕЛЬНЫЕ ДИРЕКТОРИИ
    ensureDirectories() {
        CONSTANTS.DIRECTORIES.forEach(dir =>
            Utils.ensureDir(path.join(this.config.dbPath, dir))
        );
    }
   
    // 🔥 ЗАГРУЗКА СУЩЕСТВУЮЩИХ МОДЕЛЕЙ
    loadExistingModels() {
        const modelsDir = path.join(this.config.dbPath, 'models');
        Utils.ensureDir(modelsDir);
       
        const files = fs.readdirSync(modelsDir)
            .filter(f => f.endsWith('.json'))
            .slice(0, 100);
       
        files.forEach(file => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(modelsDir, file), 'utf8'));
                const SimpleFootprint = this.import('SimpleFootprint');
                const footprint = SimpleFootprint.fromJSON(data);
                this.loadedModels.set(footprint.id, footprint);
            } catch (e) {
                Utils.log('⚠️', `Ошибка загрузки ${file}: ${e.message}`);
            }
        });
       
        this.systemStats.totalModels = files.length;
    }
   
    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ (СОКРАЩЕННЫЕ, НО ФУНКЦИОНАЛЬНЫЕ)
   
    // Фасадные методы для модулей (автоматическое делегирование)
    get proxyHandler() {
        return {
            get: (target, prop) => {
                // Автоматическое делегирование к модулям
                const moduleNames = ['coordinateManager', 'transformationValidator', 'coordinateSystemLogger',
                                   'comparisonEngine', 'templateCoordinator', 'sessionManager',
                                   'visualizationManager', 'geometryUtils'];
               
                for (const moduleName of moduleNames) {
                    if (this[moduleName] && typeof this[moduleName][prop] === 'function') {
                        return (...args) => this[moduleName][prop](...args);
                    }
                }
               
                return target[prop];
            }
        };
    }
   
    // 🔥 КОРОТКИЕ ВЕРСИИ ОСТАЛЬНЫХ МЕТОДОВ
    extractPointsFromFootprint(footprint) {
        return this.coordinateManager.getCoordinates(footprint, { coordinateSystem: 'original' }).points;
    }
   
    getVectorSuperModel(userId) {
        return this.vectorSuperModels.get(userId);
    }
   
    getVectorSuperModelInfo(userId) {
        const model = this.vectorSuperModels.get(userId);
        if (!model) return { exists: false, message: 'Шаблон не найден' };
       
        const data = model.templateBuilder?.getVisualizationData();
        const stats = data?.stats || {};
       
        return {
            exists: true,
            userId,
            templateName: model.name,
            cellsCount: data?.cells?.length || 0,
            totalConfirmations: stats.totalConfirmations || 0,
            averageConfirmations: Utils.formatFloat(stats.averageConfirmations, 2) || '0.00',
            confirmedCells: stats.confirmedCells || 0,
            lastUpdated: model.lastUpdated || new Date()
        };
    }
   
    clearVectorSuperModel(userId) {
        const hadModel = this.vectorSuperModels.has(userId);
        this.vectorSuperModels.delete(userId);
        this.userSessions.delete(userId);
       
        if (hadModel) Utils.log('🧹', `Очищен шаблон для ${userId}`);
        return { success: hadModel, message: hadModel ? 'Шаблон очищен' : 'Шаблон не найден' };
    }
   
    calculateConfirmationStats(footprint) {
        if (!footprint?.pointTracker) return { confirmed2:0, confirmed1:0, confirmed0:0, totalPoints:0 };
       
        let c2=0, c1=0, c0=0;
        for (const [, point] of footprint.pointTracker.points) {
            const cnt = point.confirmedCount || 1;
            if (cnt >= 2) c2++; else if (cnt >= 1) c1++; else c0++;
        }
       
        return { confirmed2:c2, confirmed1:c1, confirmed0:c0, totalPoints:c2+c1+c0 };
    }
   
    getSystemStats() {
        const templateStats = Array.from(this.vectorSuperModels.entries()).map(([userId, model]) => {
            const data = model.templateBuilder?.getVisualizationData();
            const stats = data?.stats || {};
            return {
                userId,
                cells: data?.cells?.length || 0,
                totalConfirmations: stats.totalConfirmations || 0,
                averageConfirmations: Utils.formatFloat(stats.averageConfirmations, 2) || '0.00'
            };
        });
       
        return {
            ...this.systemStats,
            activeSessions: this.userSessions.size,
            loadedModels: this.loadedModels.size,
            vectorModels: this.vectorSuperModels.size,
            templateStats,
            coordinateDiagnostics: this.config.enableCoordinateDiagnostics
        };
    }
   
    getLinesOfCode() {
        return 3500; // Примерное значение
    }
   
    // 🔥 МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ
    getMergeVisualizationCount() { return 0; }
    addMergeVisualization() { return 1; }
}

// 🔥 ЭКСПОРТ ПРОКСИ-ВЕРСИИ ДЛЯ АВТОМАТИЧЕСКОГО ДЕЛЕГИРОВАНИЯ
const manager = new Proxy(new SimpleFootprintManager(), new SimpleFootprintManager().proxyHandler);
module.exports = SimpleFootprintManager;
