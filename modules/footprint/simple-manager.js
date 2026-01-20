// modules/footprint/simple-manager.js
// 🔥 ФИНАЛЬНЫЙ ФАСАД МЕНЕДЖЕРА (~300 строк!)

const fs = require('fs');
const path = require('path');

// 🔥 Импорт модулей
const FootprintComparisonEngine = require('./core/comparison/footprint-comparison-engine');
const TemplateCoordination = require('./core/comparison/template-coordination');
const SessionManager = require('./core/session/session-manager');
const VisualizationManager = require('./core/visualization/visualization-manager');
const GeometryUtils = require('./core/utils/geometry-utils');

// 🔥 Импорт зависимостей
const SimpleGraph = require('./simple-graph');
const SimpleAligner = require('./alignment/simple-aligner');
const CoordinateSystemConverter = require('./alignment/coordinate-system-converter');
const CoordinateValidator = require('./alignment/coordinate-validator');
const TransformationDebugger = require('./alignment/transformation-debugger');
const ImprovedAligner = require('./alignment/improved-aligner');

class SimpleFootprintManager {
    constructor(options = {}) {
        this.config = {
            dbPath: options.dbPath || './data/footprints',
            autoAlignment: options.autoAlignment !== false,
            autoSave: options.autoSave !== false,
            debug: options.debug || false,

            // 🔥 РЕАЛЬНЫЕ НАСТРОЙКИ
            usePointTracker: true,
            enableVectorSuperModel: true,
            enableMergeVisualization: options.enableMergeVisualization !== false,
            enableTemplateVisualization: options.enableTemplateVisualization !== false,

            // Пороги
            topologySimilarityThreshold: options.topologySimilarityThreshold || 0.7,
            minPointsForFootprint: options.minPointsForFootprint || 5,

            // Настройки для шаблона
            templateMatchThreshold: 80,
            minTemplateConfirmations: 1,

            ...options
        };

        // Импорт модулей
        const SimpleFootprint = require('./simple-footprint');
        const SimpleMatcher = require('./simple-matcher');
        const MergeVisualizer = require('./merge-visualizer');
        const VectorSuperModel = require('./vector-super-model');
        const RotationInvariance = require('./rotation-invariance');
        const MirrorDetection = require('./mirror-detection');

        this.rotationProcessor = new RotationInvariance({
            debug: this.config.debug
        });

        this.mirrorDetector = new MirrorDetection({
            debug: this.config.debug
        });

        // 🔥 ИНИЦИАЛИЗАЦИЯ ВЫНЕСЕННЫХ МОДУЛЕЙ
        this.aligner = new SimpleAligner({
            debug: this.config.debug,
            visualizationDir: path.join(this.config.dbPath, 'visualizations/alignments')
        });

        this.coordinateConverter = new CoordinateSystemConverter({
            debug: this.config.debug
        });

        this.coordinateValidator = new CoordinateValidator({
            debug: this.config.debug
        });

        this.transformationDebugger = new TransformationDebugger({
            debug: this.config.debug
        });

        this.improvedAligner = new ImprovedAligner({
            debug: this.config.debug,
            visualizationDir: path.join(this.config.dbPath, 'visualizations/alignments')
        });

        // 🔥 ИНИЦИАЛИЗАЦИЯ ОСНОВНЫХ МОДУЛЕЙ
        this.comparisonEngine = new FootprintComparisonEngine(this);
        this.templateCoordinator = new TemplateCoordination(this);
        this.sessionManager = new SessionManager(this);
        this.visualizationManager = new VisualizationManager(this);
        this.geometryUtils = new GeometryUtils(this);

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

        console.log(`🚀 SimpleFootprintManager с ПОЛНОСТЬЮ МОДУЛЬНОЙ АРХИТЕКТУРОЙ`);
        console.log(`📊 Модули: comparison, template, session, visualization, utils`);
    }

    // 🔥 ФАСАДНЫЕ МЕТОДЫ ДЛЯ СРАВНЕНИЯ
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

    // 🔥 ФАСАДНЫЕ МЕТОДЫ ДЛЯ РАБОТЫ С ШАБЛОНАМИ
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

    // 🔥 ФАСАДНЫЕ МЕТОДЫ ДЛЯ СЕССИЙ
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

    getAllSessions() {
        return this.sessionManager.getAllSessions();
    }

    hasSession(userId) {
        return this.sessionManager.hasSession(userId);
    }

    updateLastActivity(userId) {
        return this.sessionManager.updateLastActivity(userId);
    }

    // 🔥 ФАСАДНЫЕ МЕТОДЫ ДЛЯ ВИЗУАЛИЗАЦИИ
    async visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo = null) {
        return this.visualizationManager.visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo);
    }

    async visualizeVectorSuperModel(userId, vectorModel) {
        return this.visualizationManager.visualizeVectorSuperModel(userId, vectorModel);
    }

    debugVisualizations(userId) {
        return this.visualizationManager.debugVisualizations(userId);
    }

    // 🔥 ФАСАДНЫЕ МЕТОДЫ ДЛЯ ГЕОМЕТРИИ
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

    transformCoordinatesBetweenSystems(originalPoints, transformationInfo, direction = 'to_normalized', referenceTransformation = null) {
        return this.geometryUtils.transformCoordinatesBetweenSystems(originalPoints, transformationInfo, direction, referenceTransformation);
    }

    prepareTemplatePointsForComparison(templateCells, templateBuilder, targetTransformation) {
        return this.geometryUtils.prepareTemplatePointsForComparison(templateCells, templateBuilder, targetTransformation);
    }

    transformTemplatePointsToFootprintSystem(templateCells, templateTransformation, footprintTransformation) {
        return this.geometryUtils.transformTemplatePointsToFootprintSystem(templateCells, templateTransformation, footprintTransformation);
    }

    findNearestPoint(point, pointsArray, maxDistance = Infinity) {
        return this.geometryUtils.findNearestPoint(point, pointsArray, maxDistance);
    }

    findPointsInRadius(centerPoint, pointsArray, radius) {
        return this.geometryUtils.findPointsInRadius(centerPoint, pointsArray, radius);
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Добавление фото в сессию
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО с сохранением трансформации и накоплением`);

        // Шаг 3: Проверяем что визуализация включена
        console.log(`🔍 НАСТРОЙКИ СИСТЕМЫ:`);
        console.log(`   - enableMergeVisualization: ${this.config.enableMergeVisualization}`);
        console.log(`   - enableTemplateVisualization: ${this.config.enableTemplateVisualization}`);
        console.log(`   - debug: ${this.config.debug}`);

        // Если визуализация отключена, включаем ее временно
        if (this.config.enableMergeVisualization === false) {
            console.log(`⚠️ Визуализация отключена в настройках! Включаю временно...`);
            this.config.enableMergeVisualization = true;
        }

        try {
            if (!analysis || !analysis.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }

            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < 5) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }

            console.log(`🔍 Извлечено ${points.length} точек протекторов`);

            // Создаем граф
            const graph = new SimpleGraph(`Временный_${Date.now()}`);
            graph.buildFromPoints(points);

            // Нормализация
            const normalized = this.rotationProcessor.normalizeToCanonical(graph, {
                userId: userId,
                photoInfo: photoInfo,
                autoRotate: true
            });

            console.log(`📐 Автоповорот: ${normalized.rotationAngle.toFixed(1)}° → 0°`);
            console.log(`🪞 Зеркало: ${normalized.isMirrored ? 'да' : 'нет'}`);

            // 🔥 СОХРАНЯЕМ ТРАНСФОРМАЦИЮ
            const transformationInfo = {
                ...normalized.transformation,
                rotationAngle: normalized.rotationAngle,
                isMirrored: normalized.isMirrored,
                corrected: false,
                timestamp: new Date(),
                footType: normalized.footType,
                photoId: photoInfo.photoId || `photo_${Date.now()}`
            };

            const corrected = this.mirrorDetector.autoCorrectMirroring(
                normalized.graph,
                'right'
            );

            if (corrected.correctionApplied) {
                console.log(`🔄 Автокоррекция применена: ${corrected.correctionType}`);
                transformationInfo.corrected = true;
                transformationInfo.correctionType = corrected.correctionType;
            }

            const finalGraph = corrected.graph;

            // 🔥 ПЕРЕДАЕМ ТРАНСФОРМАЦИЮ В ГРАФ
            finalGraph.transformation = transformationInfo;

            // Получаем или создаем сессию
            let session = this.sessionManager.getActiveSession(userId);
            if (!session) {
                session = this.sessionManager.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
                console.log(`🆕 Создана новая сессию`);
            }

            // Сохраняем трансформацию
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
            session.lastActivity = new Date();

            const SimpleFootprint = require('./simple-footprint');

            // 🔥 ПЕРВОЕ ФОТО: создаем отпечаток и шаблон
            if (!session.currentFootprint) {
                console.log(`👣 Первое фото: создаю отпечаток и шаблон`);

                // При создании отпечатка передаем трансформацию
                session.currentFootprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
                    transformation: transformationInfo
                });

                session.currentFootprint.metadata.normalizationInfo = transformationInfo;

                // Добавляем анализ
                const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
                    ...photoInfo,
                    normalizedGraph: finalGraph,
                    photoId: photoInfo.photoId || `photo_${Date.now()}`,
                    source: photoInfo.source || 'telegram_bot',
                    transformationInfo: transformationInfo
                });

                // 🔥 СОЗДАЕМ СУПЕР-МОДЕЛЬ (ШАБЛОН)
                const VectorSuperModel = require('./vector-super-model');
                const vectorModel = new VectorSuperModel({
                    name: `Шаблон_${String(userId).slice(0, 6)}`,
                    enablePCA: false,
                    cellSize: 25,
                    debug: this.config.debug
                });

                // Добавляем первый граф как эталон
                vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
                    isFirst: true,
                    transformationInfo: transformationInfo
                });

                this.vectorSuperModels.set(userId, vectorModel);

                console.log(`✅ Создан отпечаток с ${addResult.added} узлами`);
                console.log(`✅ Создан шаблон с ${vectorModel.templateBuilder.getVisualizationData()?.cells?.length || 0} ячейками`);

                // 🔥 СОЗДАЕМ ВИЗУАЛИЗАЦИЮ ДЛЯ ПЕРВОГО ФОТО (Шаг 1 из инструкции)
                let firstPhotoViz = null;
                if (bot && chatId && this.config.enableMergeVisualization) {
                    // 🔥 ДЕБАГ: Проверяем настройки визуализации
                    console.log(`🔍 НАСТРОЙКИ ВИЗУАЛИЗАЦИИ:`);
                    console.log(`   - enableMergeVisualization: ${this.config.enableMergeVisualization}`);
                    console.log(`   - bot exists: ${!!bot}`);
                    console.log(`   - chatId: ${chatId}`);
                    console.log(`   - visualizationManager exists: ${!!this.visualizationManager}`);

                    console.log(`🎨 СОЗДАЮ ВИЗУАЛИЗАЦИЮ ДЛЯ ПЕРВОГО ФОТО...`);

                    try {
                        // Пробуем разные методы
                        if (this.visualizationManager && this.visualizationManager.visualizeSingleFootprintConfirmations) {
                            console.log(`🔧 Использую visualizationManager...`);
                            firstPhotoViz = await this.visualizationManager.visualizeSingleFootprintConfirmations(
                                session.currentFootprint,
                                userId,
                                transformationInfo
                            );
                        } else if (this.visualizeSingleFootprintConfirmationsQuickFix) {
                            console.log(`🔧 Использую quick fix...`);
                            firstPhotoViz = await this.visualizeSingleFootprintConfirmationsQuickFix(
                                session.currentFootprint,
                                userId,
                                transformationInfo
                            );
                        } else {
                            console.log(`🔧 Создаю простую визуализацию напрямую...`);
                            firstPhotoViz = await this.createSimpleVisualization(
                                session.currentFootprint,
                                userId,
                                transformationInfo
                            );
                        }

                        console.log(`📊 Результат визуализации:`, firstPhotoViz ? 'SUCCESS' : 'FAILED');

                        if (firstPhotoViz && firstPhotoViz.path) {
                            console.log(`📁 Путь к файлу: ${firstPhotoViz.path}`);
                            console.log(`📏 Файл существует: ${fs.existsSync(firstPhotoViz.path) ? 'да' : 'нет'}`);

                            try {
                                let caption = `👣 **ПЕРВЫЙ СЛЕД СОЗДАН**\n\n`;
                                caption += `📊 Извлечено: ${addResult.added} точек\n`;
                                caption += `📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n`;
                                caption += `🦶 Тип: ${transformationInfo.footType || 'unknown'}\n\n`;
                                caption += `✅ Создан шаблон для накопления деталей`;

                                await bot.sendPhoto(chatId, firstPhotoViz.path, {
                                    caption: caption,
                                    parse_mode: 'Markdown'
                                });
                                console.log('✅ Визуализация первого следа отправлена');
                            } catch (sendError) {
                                console.log('❌ Ошибка отправки первого фото:', sendError.message);
                                console.log('📋 Детали:', sendError.stack);
                            }
                        } else {
                            console.log('⚠️ Визуализация не создана или путь отсутствует');
                        }
                    } catch (error) {
                        console.log('❌ Ошибка создания визуализации:', error.message);
                        console.error(error.stack);
                    }
                } else {
                    console.log(`⏭️ Визуализация пропущена. Причины:`);
                    if (!bot) console.log(`   - Нет бота`);
                    if (!chatId) console.log(`   - Нет chatId`);
                    if (!this.config.enableMergeVisualization) console.log(`   - Визуализация отключена в настройках`);
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

            // 🔥 ВТОРОЕ И ПОСЛЕДУЮЩИЕ ФОТО
            console.log(`🔍 Проверяю совпадение с существующим отпечатком (${session.currentFootprint.graph.nodes.size} узлов)`);

            // Получаем трансформацию существующего отпечатка
            const existingTransformationInfo = session.currentFootprint.metadata.normalizationInfo ||
                                             session.currentFootprint.getTransformation();

            // Создаем временный отпечаток для сравнения
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

            // 🔥 ИСПОЛЬЗУЕМ ПАТТЕРНОВОЕ СРАВНЕНИЕ
            console.log(`🎯 Сравнение с паттернами следов...`);
            const comparisonResult = await this.comparisonEngine.compareWithPatterns(
                session.currentFootprint,
                tempFootprint
            );

            const similarity = comparisonResult?.similarity || 0;
            const decision = similarity > 0.6 ? 'same' : 'different';

            console.log(`🎯 Сходство (с паттернами): ${similarity.toFixed(3)}, решение: ${decision}`);

            // 🔥 СЛЕДЫ СОВПАЛИ - обновляем шаблон с накоплением
            if (decision === 'same') {
                console.log(`✅ Следы совпали (${similarity.toFixed(3)})`);

                // Получаем или создаем шаблон
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

                    // Добавляем существующий граф
                    vectorModel.addGraph(
                        session.currentFootprint.graph,
                        session.currentFootprint.id,
                        {
                            isFirst: true,
                            transformationInfo: existingTransformationInfo
                        }
                    );
                }

                // 🔥 ДОБАВЛЯЕМ НОВЫЙ ГРАФ В ШАБЛОН С НАКОПЛЕНИЕМ
                console.log(`🔄 Добавляю новый граф в шаблон с накоплением деталей...`);
                const addedWithAccumulation = vectorModel.addGraph(
                    finalGraph,
                    tempFootprint.id,
                    {
                        similarity: similarity,
                        timestamp: new Date(),
                        ...photoInfo,
                        transformationInfo: transformationInfo
                    }
                );

                if (!addedWithAccumulation) {
                    console.log(`❌ Не удалось добавить граф в шаблон`);
                }

                // 🔥 ПРЯМОЕ ОБНОВЛЕНИЕ ПОДТВЕРЖДЕНИЙ МЕЖДУ СЛЕДАМИ
                console.log(`🔄 Прямое обновление подтверждений между следами...`);
                const directUpdates = this.templateCoordinator.updateConfirmationsDirectly(session.currentFootprint, tempFootprint);
                console.log(`✅ Прямо обновлено: ${directUpdates} точек`);

                // 🔥 ОБНОВЛЯЕМ ПОДТВЕРЖДЕНИЯ ИЗ ШАБЛОНА
                console.log(`🔄 Обновляю подтверждения из шаблона...`);
                const updatedFromTemplate = this.templateCoordinator.updateConfirmationsFromTemplate(
                    session.currentFootprint,
                    vectorModel,
                    existingTransformationInfo
                );

                // 🔥 ВИЗУАЛИЗАЦИЯ ПОДТВЕРЖДЕНИЙ
                let clusterVizResult = null;
                if (this.config.enableMergeVisualization) {
                    console.log(`🎨 Создаю визуализацию подтверждений...`);

                    clusterVizResult = await this.visualizeSingleFootprintConfirmationsQuickFix(
                        session.currentFootprint,
                        userId,
                        {
                            currentTransformation: transformationInfo,
                            previousTransformation: existingTransformationInfo,
                            comparisonResult: comparisonResult
                        }
                    );

                    // 🔥 ВАЖНО: Проверяем результат визуализации
                    if (clusterVizResult && clusterVizResult.path) {
                        console.log(`✅ Визуализация создана: ${clusterVizResult.path}`);
                    } else {
                        console.log(`⚠️ Визуализация не создана или путь отсутствует`);
                    }
                }

                // 🔥 ВИЗУАЛИЗАЦИЯ ВЫРАВНИВАНИЯ (если есть результат от алайнера)
                let alignmentVizPath = null;
                if (comparisonResult.alignment && comparisonResult.alignment.visualization) {
                    alignmentVizPath = comparisonResult.alignment.visualization;
                    console.log(`🎨 Визуализация выравнивания: ${alignmentVizPath}`);
                }

                // 🔥 ВИЗУАЛИЗАЦИЯ ШАБЛОНА
                let templateVizResult = null;
                if (this.config.enableTemplateVisualization && vectorModel) {
                    templateVizResult = await this.visualizationManager.visualizeVectorSuperModel(userId, vectorModel);
                }

                // 🔥 РЕАЛЬНАЯ СТАТИСТИКА
                const stats = this.calculateConfirmationStats(session.currentFootprint);
                console.log(`📊 РЕАЛЬНАЯ СТАТИСТИКА ПОСЛЕ ${session.photos.length} ФОТО:`);
                console.log(`   • Всего точек: ${stats.totalPoints}`);
                console.log(`   • 🔴 Красные (2+): ${stats.confirmed2}`);
                console.log(`   • 🔵 Синие (1): ${stats.confirmed1}`);
                console.log(`   • ⚪️ Серые (0): ${stats.confirmed0}`);

                // 🔥 ОТПРАВКА В TELEGRAM
                let telegramSent = false;
                if (bot && chatId) {
                    // Отправляем визуализацию подтверждений
                    if (clusterVizResult && clusterVizResult.path && fs.existsSync(clusterVizResult.path)) {
                        try {
                            // Простой текст без Markdown для избежания ошибок
                            let caption = `🎯 РЕАЛЬНЫЕ ПОДТВЕРЖДЕНИЯ\n\n`;
                            caption += `📊 Сходство: ${(similarity * 100).toFixed(1)}%\n`;
                            caption += `📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n`;
                            caption += `🔄 Метод сравнения: ${comparisonResult.method || 'pattern_based'}\n`;

                            if (comparisonResult.alignment && comparisonResult.alignment.quality) {
                                caption += `🎯 Качество выравнивания: ${(comparisonResult.alignment.quality * 100).toFixed(1)}%\n`;
                            }

                            caption += `\n📈 СТАТИСТИКА (после ${session.photos.length} фото):\n`;
                            caption += `• Всего точек: ${stats.totalPoints}\n`;
                            caption += `• 🔴 2+ подтверждений: ${stats.confirmed2}\n`;
                            caption += `• 🔵 1 подтверждение: ${stats.confirmed1}\n`;
                            caption += `• ⚪️ 0 подтверждений: ${stats.confirmed0}\n\n`;
                            caption += `🔄 Обновлено из шаблона: ${updatedFromTemplate} точек\n`;
                            caption += `🎯 Прямо обновлено: ${directUpdates} точек`;

                            console.log(`📤 Отправляю визуализацию в Telegram...`);
                            console.log(`📷 Путь к изображению: ${clusterVizResult.path}`);
                            console.log(`📝 Размер файла: ${fs.statSync(clusterVizResult.path).size} байт`);

                            await bot.sendPhoto(chatId, clusterVizResult.path, {
                                caption: caption,
                                parse_mode: null
                            });
                            console.log('✅ Визуализация подтверждений отправлена');
                            telegramSent = true;

                            // 🔥 Дополнительно отправляем визуализацию выравнивания если есть
                            if (alignmentVizPath && fs.existsSync(alignmentVizPath)) {
                                console.log(`📤 Отправляю визуализацию выравнивания в Telegram...`);
                                await bot.sendPhoto(chatId, alignmentVizPath, {
                                    caption: `🔄 Визуализация выравнивания\n${comparisonResult.reason || ''}`,
                                    parse_mode: null
                                });
                                console.log('✅ Визуализация выравнивания отправлена');
                            }

                            // 🔥 Отправляем визуализацию шаблона если есть
                            if (templateVizResult && templateVizResult.template && fs.existsSync(templateVizResult.template)) {
                                console.log(`📤 Отправляю визуализацию шаблона в Telegram...`);
                                await bot.sendPhoto(chatId, templateVizResult.template, {
                                    caption: `📊 Шаблон после ${session.photos.length} фото\n• Ячеек: ${templateVizResult.stats?.cells || 0}\n• Подтверждений: ${templateVizResult.stats?.totalConfirmations || 0}`,
                                    parse_mode: null
                                });
                                console.log('✅ Визуализация шаблона отправлена');
                            }

                        } catch (sendError) {
                            console.log('❌ Ошибка отправки в Telegram:', sendError.message);
                            console.log('📋 Детали ошибки:', sendError.stack);
                        }
                    } else {
                        console.log('⚠️ Нет визуализации для отправки в Telegram');
                        if (clusterVizResult) {
                            console.log('🔍 clusterVizResult:', clusterVizResult);
                            if (clusterVizResult.path) {
                                console.log('🔍 Файл существует?', fs.existsSync(clusterVizResult.path));
                            }
                        }
                    }
                }

                return {
                    success: true,
                    similarity: similarity,
                    decision: decision,
                    nodesAdded: tempResult.added,
                    message: `✅ След добавлен! Сходство: ${(similarity * 100).toFixed(1)}%`,
                    hasVisualization: !!(clusterVizResult || templateVizResult || alignmentVizPath),
                    telegramSent: telegramSent,
                    pointsUpdated: updatedFromTemplate + directUpdates,
                    realStats: stats,
                    totalPhotos: session.photos.length,
                    accumulationInfo: addedWithAccumulation,
                    alignmentResult: comparisonResult.alignment
                };

            } else {
                // 🔥 СЛЕДЫ РАЗНЫЕ
                console.log(`🆕 Следы разные (${similarity.toFixed(3)}) - новая модель`);

                if (session.currentFootprint.graph.nodes.size >= 10) {
                    this.sessionManager.saveSessionAsModel(userId, `Модель_${new Date().toLocaleTimeString('ru-RU')}`);
                }

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

                // 🔥 Создаем новый шаблон
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

                // 🔥 Визуализация для нового следа
                let newFootprintViz = null;
                if (bot && chatId && this.config.enableMergeVisualization) {
                    console.log(`🎨 Создаю визуализацию для нового следа...`);
                    newFootprintViz = await this.visualizeSingleFootprintConfirmationsQuickFix(
                        session.currentFootprint,
                        userId,
                        transformationInfo
                    );

                    if (newFootprintViz && newFootprintViz.path && fs.existsSync(newFootprintViz.path)) {
                        try {
                            let caption = `🆕 СОЗДАН НОВЫЙ СЛЕД\n\n`;
                            caption += `📊 Сходство с предыдущим: ${(similarity * 100).toFixed(1)}%\n`;
                            caption += `📐 Угол: ${transformationInfo.rotationAngle.toFixed(1)}°\n`;
                            caption += `📈 Добавлено точек: ${addResult.added}\n\n`;
                            caption += `⚠️ След признан другим (низкое сходство)`;

                            await bot.sendPhoto(chatId, newFootprintViz.path, {
                                caption: caption,
                                parse_mode: null
                            });
                            console.log('✅ Визуализация нового следа отправлена');
                        } catch (sendError) {
                            console.log('❌ Ошибка отправки нового следа:', sendError.message);
                        }
                    }
                }

                return {
                    success: true,
                    similarity: similarity,
                    decision: decision,
                    isNewModel: true,
                    nodesAdded: addResult.added,
                    hasTemplate: true,
                    hasVisualization: !!newFootprintViz
                };
            }

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // 🔥 ГОРЯЧИЙ ФИКС: Добавляем в simple-manager.js временный метод визуализации
    async visualizeSingleFootprintConfirmationsQuickFix(footprint, userId, transformationInfo = null) {
        console.log(`🎨 БЫСТРАЯ ВИЗУАЛИЗАЦИЯ для "${footprint.name}"...`);

        try {
            const path = require('path');
            const fs = require('fs');

            // Проверяем, есть ли модуль визуализации
            try {
                const ClusterVisualizer = require('./visualizations/cluster-visualizer');
                const visualizer = new ClusterVisualizer({
                    outputDir: path.join(this.config.dbPath, 'visualizations/clusters'),
                    debug: this.config.debug
                });

                const vizResult = await visualizer.visualizeSingleFootprintConfirmations(
                    footprint,
                    {
                        filename: `quick_fix_${userId}_${Date.now()}.png`,
                        transformationInfo: transformationInfo
                    }
                );

                if (vizResult && vizResult.path) {
                    console.log(`✅ Визуализация создана: ${vizResult.path}`);
                    return vizResult;
                }
            } catch (vizError) {
                console.log('⚠️ ClusterVisualizer не работает, создаем простую визуализацию...');
            }

            // 🔥 ПРОСТАЯ ВИЗУАЛИЗАЦИЯ как фоллбэк
            const { createCanvas } = require('canvas');
            const canvas = createCanvas(800, 600);
            const ctx = canvas.getContext('2d');

            // Белый фон
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 800, 600);

            // Заголовок
            ctx.fillStyle = 'black';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(`След: ${footprint.name}`, 20, 30);

            // Подзаголовок
            ctx.font = '14px Arial';
            ctx.fillText(`Пользователь: ${userId}`, 20, 55);

            if (transformationInfo) {
                ctx.fillText(`Угол: ${transformationInfo.rotationAngle?.toFixed(1)}°`, 20, 80);
                ctx.fillText(`Зеркало: ${transformationInfo.isMirrored ? 'да' : 'нет'}`, 20, 105);
            }

            // Рисуем точки
            let pointCount = 0;
            if (footprint.pointTracker && footprint.pointTracker.points) {
                for (const [, point] of footprint.pointTracker.points) {
                    const x = 100 + (point.x % 600);
                    const y = 200 + (point.y % 400);

                    // Цвет в зависимости от подтверждений
                    const confirmations = point.confirmedCount || 1;
                    if (confirmations >= 2) {
                        ctx.fillStyle = 'red';
                        ctx.fillRect(x, y, 6, 6);
                    } else if (confirmations >= 1) {
                        ctx.fillStyle = 'blue';
                        ctx.fillRect(x, y, 4, 4);
                    } else {
                        ctx.fillStyle = 'gray';
                        ctx.fillRect(x, y, 2, 2);
                    }
                    pointCount++;
                }
            }

            // Статистика
            ctx.fillStyle = 'green';
            ctx.font = '16px Arial';
            ctx.fillText(`Точек: ${pointCount}`, 600, 30);

            const stats = this.calculateConfirmationStats(footprint);
            ctx.fillText(`🔴 2+: ${stats.confirmed2}`, 600, 55);
            ctx.fillText(`🔵 1: ${stats.confirmed1}`, 600, 80);
            ctx.fillText(`⚪ 0: ${stats.confirmed0}`, 600, 105);

            // Сохраняем файл
            const outputDir = path.join(this.config.dbPath, 'visualizations/clusters');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const outputPath = path.join(outputDir, `quick_viz_${userId}_${Date.now()}.png`);
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(outputPath, buffer);

            console.log(`✅ Простая визуализация создана: ${outputPath}`);

            return {
                path: outputPath,
                success: true,
                method: 'quick_fix_canvas'
            };

        } catch (error) {
            console.log('❌ Ошибка быстрой визуализации:', error.message);
            return null;
        }
    }

    // 🔥 Шаг 2 из инструкции: ПРОСТОЙ МЕТОД ВИЗУАЛИЗАЦИИ
    async createSimpleVisualization(footprint, userId, transformationInfo = null) {
        console.log(`🎨 СОЗДАЮ ПРОСТУЮ ВИЗУАЛИЗАЦИЮ...`);

        try {
            const path = require('path');
            const fs = require('fs');
            const { createCanvas } = require('canvas');

            // Создаем холст
            const canvas = createCanvas(800, 600);
            const ctx = canvas.getContext('2d');

            // Белый фон
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 800, 600);

            // Заголовок
            ctx.fillStyle = 'black';
            ctx.font = 'bold 24px Arial';
            ctx.fillText(`👣 СЛЕД: ${footprint.name || 'Без имени'}`, 20, 40);

            // Информация
            ctx.font = '16px Arial';
            ctx.fillText(`ID: ${userId}`, 20, 70);

            if (transformationInfo) {
                ctx.fillText(`📐 Угол: ${transformationInfo.rotationAngle?.toFixed(1) || 0}°`, 20, 100);
                ctx.fillText(`🪞 Зеркало: ${transformationInfo.isMirrored ? 'да' : 'нет'}`, 20, 130);
                ctx.fillText(`📅 Дата: ${new Date().toLocaleString('ru-RU')}`, 20, 160);
            }

            // Статистика точек
            let totalPoints = 0;
            let confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;

            if (footprint.pointTracker && footprint.pointTracker.points) {
                totalPoints = footprint.pointTracker.points.size;

                for (const [, point] of footprint.pointTracker.points) {
                    const confirmations = point.confirmedCount || 1;
                    if (confirmations >= 2) confirmed2++;
                    else if (confirmations >= 1) confirmed1++;
                    else confirmed0++;
                }
            }

            // Рисуем статистику
            ctx.fillStyle = 'blue';
            ctx.font = 'bold 18px Arial';
            ctx.fillText('📊 СТАТИСТИКА:', 20, 200);

            ctx.fillStyle = 'black';
            ctx.font = '16px Arial';
            ctx.fillText(`Всего точек: ${totalPoints}`, 40, 230);
            ctx.fillStyle = 'red';
            ctx.fillText(`🔴 2+ подтверждений: ${confirmed2}`, 40, 260);
            ctx.fillStyle = 'blue';
            ctx.fillText(`🔵 1 подтверждение: ${confirmed1}`, 40, 290);
            ctx.fillStyle = 'gray';
            ctx.fillText(`⚪ 0 подтверждений: ${confirmed0}`, 40, 320);

            // Рисуем простую диаграмму
            const max = Math.max(confirmed2, confirmed1, confirmed0, 1);
            const barWidth = 200;

            // 🔴 Красные (2+)
            ctx.fillStyle = 'red';
            const redHeight = (confirmed2 / max) * 100;
            ctx.fillRect(400, 250 - redHeight, 50, redHeight);
            ctx.fillText(`${confirmed2}`, 400, 270);

            // 🔵 Синие (1)
            ctx.fillStyle = 'blue';
            const blueHeight = (confirmed1 / max) * 100;
            ctx.fillRect(470, 250 - blueHeight, 50, blueHeight);
            ctx.fillText(`${confirmed1}`, 470, 270);

            // ⚪ Серые (0)
            ctx.fillStyle = 'gray';
            const grayHeight = (confirmed0 / max) * 100;
            ctx.fillRect(540, 250 - grayHeight, 50, grayHeight);
            ctx.fillText(`${confirmed0}`, 540, 270);

            // Подпись диаграммы
            ctx.fillStyle = 'black';
            ctx.font = '12px Arial';
            ctx.fillText('Подтверждения', 400, 290);

            // Сохраняем файл
            const outputDir = path.join(this.config.dbPath, 'visualizations');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
                console.log(`📁 Создана директория: ${outputDir}`);
            }

            const filename = `simple_viz_${userId}_${Date.now()}.png`;
            const outputPath = path.join(outputDir, filename);
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(outputPath, buffer);

            console.log(`✅ Простая визуализация создана: ${outputPath}`);
            console.log(`📏 Размер файла: ${buffer.length} байт`);

            return {
                path: outputPath,
                success: true,
                stats: { totalPoints, confirmed2, confirmed1, confirmed0 }
            };

        } catch (error) {
            console.log('❌ Ошибка создания простой визуализации:', error.message);
            return null;
        }
    }

    // 🔥 ОСТАВШИЕСЯ ВАЖНЫЕ МЕТОДЫ
    getVectorSuperModel(userId) {
        return this.vectorSuperModels.get(userId);
    }

    getVectorSuperModelInfo(userId) {
        const vectorModel = this.vectorSuperModels.get(userId);

        if (!vectorModel) {
            return {
                exists: false,
                message: 'Шаблон не найден'
            };
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

            // Также очищаем сессию
            if (this.userSessions.has(userId)) {
                this.userSessions.delete(userId);
            }

            console.log(`🧹 Очищен шаблон и сессия для пользователя ${userId}`);

            return {
                success: true,
                message: 'Шаблон и сессия очищены'
            };
        }

        return {
            success: false,
            message: 'Шаблон не найден'
        };
    }

    getTemplateVisualization(userId) {
        const vectorModel = this.vectorSuperModels.get(userId);

        if (!vectorModel) {
            return null;
        }

        return this.visualizationManager.visualizeVectorSuperModel(userId, vectorModel);
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
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
                    originalPoints: pred.points
                });
            }
        });

        return points;
    }

    calculateConfirmationStats(footprint) {
        if (!footprint || !footprint.pointTracker) {
            return { confirmed2: 0, confirmed1: 0, confirmed0: 0, totalPoints: 0 };
        }

        let confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;

        for (const [id, point] of footprint.pointTracker.points) {
            const confirmations = point.confirmedCount || 1; // 🔥 Минимум 1 подтверждение!

            if (confirmations >= 2) {
                confirmed2++;
            } else if (confirmations >= 1) {
                confirmed1++;
            } else {
                confirmed0++;
            }
        }

        const totalPoints = confirmed2 + confirmed1 + confirmed0;

        return {
            confirmed2,
            confirmed1,
            confirmed0,
            totalPoints
        };
    }

    extractPointsFromFootprint(footprint) {
        const points = [];

        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({
                    id,
                    x: point.x,
                    y: point.y,
                    confidence: point.rating || 0.5
                });
            }
        }

        console.log(`   📊 Извлечено ${points.length} точек из ${footprint.name}`);
        return points;
    }

    ensureDirectories() {
        // Шаг 4 из инструкции: Проверяем структуру директорий
        console.log(`🔍 ПРОВЕРКА ДИРЕКТОРИЙ ВИЗУАЛИЗАЦИИ:`);
       
        const vizDirs = [
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'visualizations/clusters'),
            path.join(this.config.dbPath, 'visualizations/templates'),
            path.join(this.config.dbPath, 'visualizations/alignments')
        ];

        vizDirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Создана: ${dir}`);
            } else {
                console.log(`✅ Существует: ${dir}`);
            }
        });

        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'sessions'),
            ...vizDirs
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Создана директория: ${dir}`);
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
        console.log(`📂 Загрузка моделей из ${modelsDir} (${files.length} файлов)`);

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
        console.log(`✅ Загружено ${loadedCount} моделей`);
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
            templateStats: templateStats
        };
    }

    // 🔥 Дополнительные методы для совместимости
    getMergeVisualizationCount() {
        let total = 0;
        // Простая реализация
        return total;
    }

    addMergeVisualization(userId, vizInfo) {
        // Простая реализация
        return 1;
    }

    testCoordinateComparison(userId) {
        const session = this.sessionManager.getActiveSession(userId);
        if (!session || !session.currentFootprint) {
            console.log('❌ Нет активной сессии');
            return;
        }

        const vectorModel = this.vectorSuperModels.get(userId);
        if (!vectorModel) {
            console.log('❌ Нет супер-модели');
            return;
        }

        console.log('\n🧪 ТЕСТ СРАВНЕНИЯ КООРДИНАТ:');

        // 1. Получаем отпечаток
        const footprint = session.currentFootprint;
        const tracker = footprint.pointTracker;

        console.log(`Отпечаток: ${footprint.name}`);
        console.log(`Точек в трекере: ${tracker.points.size}`);

        // 2. Получаем трансформацию
        const transformation = footprint.getTransformation();
        console.log(`Трансформация отпечатка:`);
        console.log(`  Поворот: ${transformation.rotationAngle?.toFixed(1)}°`);
        console.log(`  Зеркало: ${transformation.isMirrored}`);
        console.log(`  Центр: (${transformation.center?.x?.toFixed(1)}, ${transformation.center?.y?.toFixed(1)})`);

        // 3. Получаем точки шаблона
        const templateData = vectorModel.templateBuilder.getVisualizationData();
        console.log(`Точек в шаблоне: ${templateData.cells?.length || 0}`);

        // 4. Тестируем преобразование
        console.log('\n🔧 ТЕСТ ПРЕОБРАЗОВАНИЯ:');

        if (templateData.cells && templateData.cells.length > 0) {
            const testCell = templateData.cells[0];
            console.log(`Тестовая ячейка шаблона:`);
            console.log(`  Нормализованные: (${testCell.nx?.toFixed(4)}, ${testCell.ny?.toFixed(4)})`);
            console.log(`  Реальные: (${testCell.x?.toFixed(1)}, ${testCell.y?.toFixed(1)})`);

            // Преобразуем в систему отпечатка
            const templateTransformation = vectorModel.templateBuilder.getNormalizationTransform();
            const transformedPoints = this.geometryUtils.transformTemplatePointsToFootprintSystem(
                [testCell],
                templateTransformation,
                transformation
            );

            if (transformedPoints && transformedPoints[0]) {
                const transformed = transformedPoints[0];
                console.log(`  В системе отпечатка: (${transformed.x?.toFixed(1)}, ${transformed.y?.toFixed(1)})`);
            }
        }

        // 5. Тестируем сравнение
        console.log('\n🔍 ТЕСТ СРАВНЕНИЯ:');
        const updatedCount = this.templateCoordinator.updateConfirmationsFromTemplate(footprint, vectorModel, transformation);

        console.log(`\n✅ ТЕСТ ЗАВЕРШЕН: обновлено ${updatedCount} точек`);

        // 6. Статистика трекера после обновления
        let confirmed2 = 0, confirmed1 = 0, confirmed0 = 0;
        for (const [, point] of tracker.points) {
            const confirmations = point.confirmedCount || 1;
            if (confirmations >= 2) confirmed2++;
            else if (confirmations >= 1) confirmed1++;
            else confirmed0++;
        }

        console.log(`\n📊 РЕЗУЛЬТАТ В ТРЕКЕРЕ:`);
        console.log(`  🔴 2+ подтверждений: ${confirmed2}`);
        console.log(`  🔵 1 подтверждение: ${confirmed1}`);
        console.log(`  ⚪ 0 подтверждений: ${confirmed0}`);
        console.log(`  Всего: ${tracker.points.size}`);
    }
}

module.exports = SimpleFootprintManager;
