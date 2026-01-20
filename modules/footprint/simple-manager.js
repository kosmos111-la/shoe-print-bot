// modules/footprint/simple-manager.js
// 🔥 ФАСАД МЕНЕДЖЕРА (еще на 500 строк меньше!)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 🔥 Импорт SimpleGraph
const SimpleGraph = require('./simple-graph');

// 🔥 Импорт модулей
const SimpleAligner = require('./alignment/simple-aligner');
const CoordinateSystemConverter = require('./alignment/coordinate-system-converter');
const CoordinateValidator = require('./alignment/coordinate-validator');
const TransformationDebugger = require('./alignment/transformation-debugger');
const ImprovedAligner = require('./alignment/improved-aligner');

// 🔥 Импорт модулей сравнения и работы с шаблонами
const FootprintComparisonEngine = require('./core/comparison/footprint-comparison-engine');
const TemplateCoordination = require('./core/comparison/template-coordination');

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
        const TemplateVisualizer = require('./template-visualizer');
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

        // 🔥 ИНИЦИАЛИЗАЦИЯ ДВИЖКА СРАВНЕНИЯ И РАБОТЫ С ШАБЛОНАМИ
        this.comparisonEngine = new FootprintComparisonEngine(this);
        this.templateCoordinator = new TemplateCoordination(this);

        // Сессии пользователей
        this.userSessions = new Map();
        this.loadedModels = new Map();
        this.vectorSuperModels = new Map();

        this.mergeVisualizer = new MergeVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations'),
            debug: this.config.debug
        });

        this.templateVisualizer = new TemplateVisualizer({
            outputDir: path.join(this.config.dbPath, 'visualizations/templates'),
            debug: this.config.debug
        });

        this.matcher = new SimpleMatcher({
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold
        });

        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalPhotosProcessed: 0,
            totalTemplateConfirmations: 0,
            lastActivity: new Date()
        };

        this.ensureDirectories();
        this.loadExistingModels();

        console.log(`🚀 SimpleFootprintManager с МОДУЛЬНОЙ АРХИТЕКТУРОЙ (два модуля вынесены)`);
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

    // 🔥 ГЛАВНЫЙ МЕТОД: Добавление фото в сессию с ВИЗУАЛИЗАЦИЯМИ
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО с сохранением трансформации и накоплением`);

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
            let session = this.userSessions.get(userId);
            if (!session) {
                session = this.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
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
                    // 🔥 ВАЖНО: передаем трансформацию при создании!
                    transformation: transformationInfo // УЖЕ СОДЕРЖИТ rotationAngle: 90°
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

                // 🔥 СОЗДАЕМ ВИЗУАЛИЗАЦИЮ ДЛЯ ПЕРВОГО ФОТО
                let firstPhotoViz = null;
                if (bot && chatId && this.config.enableMergeVisualization) {
                    console.log(`🎨 Создаю визуализацию для первого фото...`);
                    firstPhotoViz = await this.visualizeSingleFootprintConfirmations(
                        session.currentFootprint,
                        userId,
                        transformationInfo
                    );

                    if (firstPhotoViz && firstPhotoViz.path) {
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
                        }
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

                    clusterVizResult = await this.visualizeSingleFootprintConfirmations(
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
                    templateVizResult = await this.visualizeVectorSuperModel(userId, vectorModel);
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
                                parse_mode: null  // Простой текст без Markdown
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
                    this.saveSessionAsModel(userId, `Модель_${new Date().toLocaleTimeString('ru-RU')}`);
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
                    newFootprintViz = await this.visualizeSingleFootprintConfirmations(
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

    // 🔥 ВАЖНЫЙ МЕТОД: Визуализация подтверждений ОДНОГО следа
    async visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo = null) {
        console.log(`🎨 Визуализация подтверждений для "${footprint.name}"...`);

        try {
            const ClusterVisualizer = require('./visualizations/cluster-visualizer');
            const visualizer = new ClusterVisualizer({
                outputDir: path.join(this.config.dbPath, 'visualizations/clusters'),
                debug: this.config.debug
            });

            const vizResult = await visualizer.visualizeSingleFootprintConfirmations(
                footprint,
                {
                    filename: `real_confirmations_${userId}_${Date.now()}.png`,
                    transformationInfo: transformationInfo
                }
            );

            if (vizResult && vizResult.path) {
                console.log(`✅ Визуализация создана: ${vizResult.path}`);

                // Проверяем существование файла
                if (fs.existsSync(vizResult.path)) {
                    const stats = fs.statSync(vizResult.path);
                    console.log(`📊 Размер файла: ${stats.size} байт`);
                } else {
                    console.log(`⚠️ Файл не найден: ${vizResult.path}`);
                }
            } else {
                console.log(`⚠️ Визуализация не создана или результат пустой`);
            }

            return vizResult;

        } catch (error) {
            console.log('❌ Ошибка визуализации:', error.message);
            console.error(error.stack);
            return null;
        }
    }

    // 🔥 ВОССТАНОВЛЕННЫЕ МЕТОДЫ ДЛЯ КОМАНД
    getActiveSession(userId) {
        return this.userSessions.get(userId);
    }

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

        return this.visualizeVectorSuperModel(userId, vectorModel);
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

    async visualizeVectorSuperModel(userId, vectorModel) {
        console.log(`🎨 Создаю визуализацию ШАБЛОНА...`);

        try {
            if (!vectorModel) return null;

            let templateData = vectorModel.templateBuilder.getVisualizationData();

            if (!templateData || !templateData.cells || templateData.cells.length === 0) {
                if (vectorModel.templateBuilder) {
                    templateData = vectorModel.templateBuilder.getVisualizationData();
                }
            }

            const result = await this.templateVisualizer.visualizeTemplate(templateData, {
                filename: `template_${userId}_${Date.now()}.png`
            });

            const heatmapResult = await this.templateVisualizer.createHeatmap(templateData, {
                filename: `heatmap_${userId}_${Date.now()}.png`
            });

            let heatmapPath = heatmapResult;
            if (heatmapResult && typeof heatmapResult === 'object' && heatmapResult.path) {
                heatmapPath = heatmapResult.path;
            }

            return {
                template: result.path,
                heatmap: heatmapPath,
                stats: templateData?.stats,
                templateId: templateData?.templateId
            };

        } catch (error) {
            console.log(`❌ Ошибка визуализации шаблона: ${error.message}`);
            return null;
        }
    }

    createSession(userId, name = null) {
        const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

        const session = {
            id: sessionId,
            userId: String(userId),
            name: name || `Сессия_${new Date().toLocaleDateString('ru-RU')}`,
            startTime: new Date(),
            lastActivity: new Date(),
            photos: [],
            currentFootprint: null,
            metadata: {
                created: new Date(),
                normalizationHistory: [],
                lastTransformation: null
            }
        };

        this.userSessions.set(userId, session);
        this.systemStats.totalUsers = this.userSessions.size;

        console.log(`🆕 Создана сессия ${sessionId.slice(0, 8)} для пользователя ${userId}`);

        return session;
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

    saveSessionAsModel(userId, modelName = null) {
        const session = this.userSessions.get(userId);
        if (!session || !session.currentFootprint) {
            return { success: false, error: 'Нет активной сессии или отпечатка' };
        }

        const footprint = session.currentFootprint;

        if (modelName) {
            footprint.name = modelName;
        }

        const modelPath = path.join(this.config.dbPath, 'models', `${footprint.id}.json`);

        try {
            const modelData = footprint.toJSON();
            modelData.metadata.sessionInfo = {
                sessionId: session.id,
                photosCount: session.photos.length,
                normalizationHistory: session.metadata.normalizationHistory || []
            };

            fs.writeFileSync(modelPath, JSON.stringify(modelData, null, 2));

            this.loadedModels.set(footprint.id, footprint);
            this.systemStats.totalModels = this.loadedModels.size;

            console.log(`💾 Модель сохранена: ${footprint.id} (${footprint.graph.nodes.size} узлов)`);

            this.userSessions.delete(userId);

            return {
                success: true,
                modelId: footprint.id,
                modelName: footprint.name,
                modelPath: modelPath,
                modelStats: {
                    nodes: footprint.graph.nodes.size,
                    edges: footprint.graph.edges.size
                }
            };

        } catch (error) {
            console.log('❌ Ошибка сохранения модели:', error.message);
            return { success: false, error: error.message };
        }
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

    // 🔥 Вспомогательные методы для совместимости
    transformCoordinatesBetweenSystems(originalPoints, transformationInfo, direction = 'to_normalized', referenceTransformation = null) {
        if (!transformationInfo) {
            console.log('⚠️ Нет информации о трансформации');
            return originalPoints;
        }

        console.log(`📐 Преобразование координат ${originalPoints.length} точек (${direction})...`);

        const RotationInvariance = require('./rotation-invariance');
        const processor = new RotationInvariance();

        if (direction === 'to_normalized') {
            // Из системы фото в нормализованную систему
            const targetTransformation = processor.createIdentityTransformation();
            return processor.transformPointsBetweenSystems(
                originalPoints,
                transformationInfo,
                targetTransformation
            );
        } else if (direction === 'to_original') {
            // Из нормализованной системы в систему фото
            if (!referenceTransformation) {
                console.log('⚠️ Нет эталонной трансформации для обратного преобразования');
                return originalPoints;
            }

            return processor.transformPointsBetweenSystems(
                originalPoints,
                processor.createIdentityTransformation(),
                referenceTransformation
            );
        } else if (direction === 'between_footprints' && referenceTransformation) {
            // Из системы одного отпечатка в систему другого
            return processor.transformPointsBetweenSystems(
                originalPoints,
                transformationInfo,
                referenceTransformation
            );
        }

        return originalPoints;
    }

    prepareTemplatePointsForComparison(templateCells, templateBuilder, targetTransformation) {
        const points = [];

        // Получаем трансформацию шаблона (из templateBuilder)
        const templateTransformation = templateBuilder.getNormalizationTransform();

        const RotationInvariance = require('./rotation-invariance');
        const processor = new RotationInvariance();

        templateCells.forEach((cell, index) => {
            // Создаем точку из ячейки шаблона
            const templatePoint = {
                x: cell.x || 0,
                y: cell.y || 0,
                nx: cell.nx || 0,
                ny: cell.ny || 0,
                confirmations: cell.confirmations || 1,
                confidence: cell.confidence || 0.7,
                cellId: cell.id
            };

            // 🔥 ПРЕОБРАЗУЕМ В СИСТЕМУ ЦЕЛЕВОГО ОТПЕЧАТКА
            const transformedPoint = processor.transformPointsBetweenSystems(
                [templatePoint],
                templateTransformation,
                targetTransformation
            )[0];

            if (transformedPoint) {
                points.push({
                    ...transformedPoint,
                    originalTemplatePoint: templatePoint,
                    cellIndex: index
                });
            }
        });

        return points;
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ГЕОМЕТРИИ
    calculateBounds(points) {
        if (points.length === 0) {
            return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
        }

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        return {
            minX, maxX, minY, maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    calculateCenter(points) {
        if (points.length === 0) {
            return { x: 0, y: 0 };
        }

        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Извлечь точки из отпечатка
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

    // 🔥 НОВЫЙ МЕТОД: Рассчитать соотношение сторон
    calculateAspectRatio(points) {
        const bounds = this.calculateBounds(points);
        return bounds.width / Math.max(1, bounds.height);
    }

    // 🔥 ТЕСТ МЕТОД: Протестировать сравнение координат
    testCoordinateComparison(userId) {
        const session = this.userSessions.get(userId);
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
            const transformedPoints = this.transformTemplatePointsToFootprintSystem(
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

    transformTemplatePointsToFootprintSystem(templateCells, templateTransformation, footprintTransformation) {
        const points = [];

        templateCells.forEach((cell, index) => {
            const normalizedX = cell.nx || 0;
            const normalizedY = cell.ny || 0;

            const templateX = normalizedX * templateTransformation.width + templateTransformation.minX;
            const templateY = normalizedY * templateTransformation.height + templateTransformation.minY;

            let transformedX = templateX;
            let transformedY = templateY;

            const footprintAngle = footprintTransformation.rotationAngle || 0;

            if (footprintAngle !== 0 && footprintTransformation.center) {
                const centerX = footprintTransformation.center.x || 0;
                const centerY = footprintTransformation.center.y || 0;

                const dx = templateX - centerX;
                const dy = templateY - centerY;

                const angleRad = -footprintAngle * Math.PI / 180;
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);

                const rotatedX = dx * cosA - dy * sinA;
                const rotatedY = dx * sinA + dy * cosA;

                transformedX = rotatedX + centerX;
                transformedY = rotatedY + centerY;
            }

            points.push({
                x: transformedX,
                y: transformedY,
                nx: normalizedX,
                ny: normalizedY,
                confirmations: cell.confirmations || 1,
                confidence: cell.confidence || 0.7,
                cellId: cell.id,
                isNew: cell.isNew || false,
                status: cell.status || 'unknown',
                originalCell: cell,
                cellIndex: index
            });
        });

        return points;
    }
}

module.exports = SimpleFootprintManager;
