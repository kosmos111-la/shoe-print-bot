// modules/footprint/simple-manager.js
// 🔥 ИНТЕГРИРОВАН ГЕОМЕТРИЧЕСКИЙ ХЕШ-АЛГОРИТМ ИЗ CLEAN ПАПКИ
const fs = require('fs');
const path = require('path');

// 🔥 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ ИЗ ПАПКИ CLEAN
let GeometricHashAlgorithm;
try {
    // Пробуем загрузить из папки clean
    GeometricHashAlgorithm = require('./clean/vector-algorithm');
    console.log('✅ Геометрический алгоритм загружен из папки clean');
} catch (error) {
    console.log(`⚠️ Не удалось загрузить геометрический алгоритм: ${error.message}`);
    // Фаллбэк
    GeometricHashAlgorithm = require('./fallback-algorithm');
}

// 🔥 Legacy фасад ТОЛЬКО для обратной совместимости
const LegacySupport = require('./legacy-support/coordinate-facade');

// 🔥 ОСТАЛЬНЫЕ МОДУЛИ
const TemplateCoordination = require('./core/comparison/template-coordination');
const SessionManager = require('./core/session/session-manager');
const VisualizationManager = require('./core/visualization/visualization-manager');
const GeometryUtils = require('./core/utils/geometry-utils');
const LogManager = require('./core/log-manager');
const SimpleGraph = require('./simple-graph');

class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🚀 SimpleFootprintManager создан с ГЕОМЕТРИЧЕСКИМ ХЕШ-АЛГОРИТМОМ');

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

        // 🔥 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ (настройки из clean папки)
        this.geometricAlgorithm = new GeometricHashAlgorithm({
            neighborOffsets: [-2, -1, 1, 2],
            angleTolerance: 10,
            minSimilarity: 0.6, // 60% = ОДНА обувь
            debug: this.config.debug,
            useNormalization: true // Используем нормализацию
        });

        console.log('✅ Геометрический алгоритм инициализирован');

        // 🔥 МОДУЛИ НОРМАЛИЗАЦИИ
        const RotationInvariance = require('./rotation-invariance');
        const MirrorDetection = require('./mirror-detection');
        this.rotationProcessor = new RotationInvariance({ debug: this.config.debug });
        this.mirrorDetector = new MirrorDetection({ debug: this.config.debug });

        // 🔥 Legacy поддержка ТОЛЬКО для обратной совместимости методов
        this.coordinateManager = new LegacySupport.CoordinateManager(this);
        this.transformationValidator = new LegacySupport.TransformationValidator(this);

        // 🔥 Основные модули
        this.templateCoordinator = new TemplateCoordination(this);
        this.sessionManager = new SessionManager(this);

        // 🔥 ВАЖНО: Визуализация должна быть инициализирована безопасно
        try {
            this.visualizationManager = new VisualizationManager(this);
            console.log('✅ VisualizationManager инициализирован');
        } catch (error) {
            console.log(`⚠️ Ошибка инициализации VisualizationManager: ${error.message}`);
            this.visualizationManager = this.createVisualizationStub();
        }

        this.geometryUtils = new GeometryUtils(this);

        // 🔥 СТРУКТУРЫ ДАННЫХ
        this.userSessions = new Map();
        this.loadedModels = new Map();
        this.vectorSuperModels = new Map();
        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalPhotosProcessed: 0,
            totalTemplateConfirmations: 0,
            lastActivity: new Date(),
            comparisonAlgorithm: 'geometric_hash_v1.0'
        };

        this.ensureDirectories();
        this.loadExistingModels();

        // 🔥 ПОРОГИ РЕШЕНИЙ (для геометрического алгоритма)
        this.DECISION_THRESHOLDS = {
            PATTERN_SIMILARITY: 0.6, // 60% схожести = ОДНА обувь
            MIN_MATCHES: 10,
            MAX_DISTANCE: 50,
            VECTOR_MATCH_THRESHOLD: 0.05
        };

        console.log(`🎯 Геометрические пороги: сходство >${this.DECISION_THRESHOLDS.PATTERN_SIMILARITY}`);

        // 🔥 Логирование
        this.log = new LogManager(this);
        if (options.logLevel) this.log.setLevel(options.logLevel);

        console.log('✅ SimpleFootprintManager инициализирован с геометрическим алгоритмом');
    }

    // 🔥 СОЗДАНИЕ ЗАГЛУШКИ ДЛЯ ВИЗУАЛИЗАЦИИ
    createVisualizationStub() {
        return {
            visualizeSingleFootprintConfirmations: async (footprint, userId, transformationInfo = null) => {
                console.log(`🎨 ВИЗУАЛИЗАЦИЯ (заглушка) для пользователя ${userId}`);

                const timestamp = Date.now();
                const vizPath = path.join(this.config.dbPath, 'visualizations', `stub_viz_${userId}_${timestamp}.png`);

                const dir = path.dirname(vizPath);
                if (!fs.existsSync(dir)) {
                    console.log(`📁 Создаю директорию для заглушки: ${dir}`);
                    fs.mkdirSync(dir, { recursive: true });
                }

                fs.writeFileSync(vizPath, 'stub');

                return {
                    path: vizPath,
                    success: true,
                    isStub: true
                };
            },

            visualizeVectorSuperModel: async (userId, vectorModel) => {
                console.log(`🎨 ВИЗУАЛИЗАЦИЯ ШАБЛОНА (заглушка) для пользователя ${userId}`);

                const timestamp = Date.now();
                const templatePath = path.join(this.config.dbPath, 'visualizations/templates', `stub_template_${userId}_${timestamp}.png`);

                const dir = path.dirname(templatePath);
                if (!fs.existsSync(dir)) {
                    console.log(`📁 Создаю директорию для шаблона: ${dir}`);
                    fs.mkdirSync(dir, { recursive: true });
                }

                fs.writeFileSync(templatePath, 'stub');

                return {
                    template: templatePath,
                    success: true,
                    isStub: true,
                    stats: { cells: 0, totalConfirmations: 0, averageConfirmations: 0 }
                };
            },

            debugVisualizations: (userId) => {
                return { status: 'stub', message: 'Visualization manager in stub mode' };
            }
        };
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: СРАВНЕНИЕ ОТПЕЧАТКОВ С ГЕОМЕТРИЧЕСКИМ АЛГОРИТМОМ
    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 Сравнение следов с ГЕОМЕТРИЧЕСКИМ алгоритмом`);

        try {
            // 1. Извлекаем точки в ЕДИНОЙ системе
            const points1 = this.extractPointsInUnifiedSystem(footprint1);
            const points2 = this.extractPointsInUnifiedSystem(footprint2);

            if (points1.length < 3 || points2.length < 3) {
                console.log('⚠️ Слишком мало точек для сравнения');
                return {
                    similar: false,
                    similarity: 0,
                    decision: 'different'
                };
            }

            console.log(`📊 Сравниваем ${points1.length} vs ${points2.length} точек`);

            // 2. Используем ГЕОМЕТРИЧЕСКИЙ алгоритм
            const geo1 = this.geometricAlgorithm.createFootprint(points1, 'fp1');
            const geo2 = this.geometricAlgorithm.createFootprint(points2, 'fp2');

            const result = this.geometricAlgorithm.compareFootprints(geo1, geo2);

            // 3. Простое решение на основе процентов
            const similarity = result.stats.percent1to2 / 100;
            const isSame = similarity > (options.threshold || this.DECISION_THRESHOLDS.PATTERN_SIMILARITY);

            console.log(`🎯 Геометрический результат:`);
            console.log(`   • Совпадение fp1→fp2: ${result.stats.percent1to2}%`);
            console.log(`   • Совпадение fp2→fp1: ${result.stats.percent2to1}%`);
            console.log(`   • Среднее: ${similarity.toFixed(3)}`);
            console.log(`   • Решение: ${isSame ? '✅ ОДНА обувь' : '❌ РАЗНАЯ обувь'}`);

            return {
                similar: isSame,
                similarity: similarity,
                decision: isSame ? 'same' : 'different',
                matches: result.matches || [],
                stats: result.stats,
                method: 'geometric_hash_algorithm'
            };

        } catch (error) {
            console.error(`❌ Ошибка геометрического сравнения: ${error.message}`);
            return {
                similar: false,
                similarity: 0,
                error: error.message,
                decision: 'different'
            };
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Извлечь точки в единой системе
    extractPointsInUnifiedSystem(footprint) {
        const points = [];

        // Просто берём ВСЕ точки из трекера
        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                points.push({
                    id: id,
                    x: point.x,
                    y: point.y,
                    confidence: point.rating || 0.5,
                    confirmedCount: point.confirmedCount || 1
                });
            }
        }

        // Если нет трекера, берём из графа
        else if (footprint.graph && footprint.graph.nodes) {
            for (const [id, node] of footprint.graph.nodes) {
                points.push({
                    id: id,
                    x: node.x,
                    y: node.y,
                    confidence: node.confidence || 0.5
                });
            }
        }

        // Простая центровка
        if (points.length > 0) {
            const center = this.calculateCenter(points);
            return points.map(p => ({
                ...p,
                x: p.x - center.x + 500,  // Центрируем в 500,500
                y: p.y - center.y + 500
            }));
        }

        return points;
    }

    // 🔥 Вспомогательный метод для расчета центра
    calculateCenter(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0 };
        }

        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);

        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Нормализация отпечатка
    async normalizeFootprint(footprint, options = {}) {
        console.log(`🔄 Нормализация отпечатка ${footprint.id || 'unknown'}`);

        try {
            // Извлекаем точки
            const points = this.extractPointsFromFootprint(footprint);

            if (!points || points.length === 0) {
                console.log('⚠️ Нет точек для нормализации');
                return footprint;
            }

            console.log(`📊 Нормализация ${points.length} точек`);

            // Простая центровка (без изменения масштаба)
            const center = this.calculateCenter(points);

            const normalizedPoints = points.map(p => ({
                x: p.x - center.x + 500, // Центрируем в 500,500
                y: p.y - center.y + 500,
                id: p.id,
                confidence: p.confidence,
                confirmedCount: p.confirmedCount,
                originalX: p.x,
                originalY: p.y
            }));

            // Обновляем отпечаток
            if (footprint.updatePoints) {
                footprint.updatePoints(normalizedPoints);
            } else {
                footprint.points = normalizedPoints;
            }

            // Сохраняем информацию о трансформации
            footprint.metadata = footprint.metadata || {};
            footprint.metadata.normalizationInfo = {
                originalPoints: points.length,
                normalizedPoints: normalizedPoints.length,
                transformationType: 'simple_centering',
                timestamp: new Date(),
                center: center
            };

            console.log(`✅ Отпечаток нормализован: ${normalizedPoints.length} точек`);

            return footprint;

        } catch (error) {
            console.error(`❌ Ошибка нормализации: ${error.message}`);
            return footprint;
        }
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Добавление фото в сессию
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО в сессию пользователя ${userId}`);

        try {
            if (!analysis?.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }

            // Извлечение точек
            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < this.config.minPointsForFootprint) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }

            // Создание и нормализация графа
            const { finalGraph, transformationInfo } = this.createAndNormalizeGraph(points, userId, photoInfo);

            // Работа с сессиями
            const session = this.getOrCreateSession(userId);
            this.updateSessionData(session, points, transformationInfo);

            // Обработка фото
            let result;
            if (!session.currentFootprint) {
                result = await this.processFirstPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId);
            } else {
                result = await this.processSubsequentPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId);
            }

            console.log(`📊 ИТОГОВЫЙ РЕЗУЛЬТАТ:`, {
                similarity: result.similarity,
                decision: result.decision,
                algorithm: 'geometric_hash'
            });

            return result;

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
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

        const addResult = session.currentFootprint.addAnalysisHonest(analysis, {
            ...photoInfo,
            normalizedGraph: finalGraph,
            photoId: photoInfo.photoId || `photo_${Date.now()}`,
            source: photoInfo.source || 'telegram_bot',
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

        vectorModel.addGraph(finalGraph, session.currentFootprint.id, {
            isFirst: true,
            transformationInfo: transformationInfo
        });

        this.vectorSuperModels.set(userId, vectorModel);

        console.log(`✅ Создан отпечаток с ${addResult.added} узлами`);

        // Создаем визуализацию
        let hasVisualization = false;
        let vizPath = null;

        if (this.config.enableMergeVisualization) {
            console.log(`🎨 Создаю визуализацию для первого фото...`);

            try {
                const vizResult = await this.visualizeSingleFootprintConfirmations(
                    session.currentFootprint,
                    userId,
                    transformationInfo
                );

                if (vizResult && vizResult.path) {
                    hasVisualization = true;
                    vizPath = vizResult.path;
                    console.log(`✅ Путь к визуализации: ${vizPath}`);
                }
            } catch (vizError) {
                console.log(`⚠️ Ошибка визуализации: ${vizError.message}`);
            }
        }

        // Отправка в Telegram
        if (bot && chatId) {
            await this.sendFirstPhotoTelegram(
                session, userId, transformationInfo, vectorModel, addResult,
                vizPath, bot, chatId
            );
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
            hasVisualization: hasVisualization,
            vizPath: vizPath,
            visualizationPath: vizPath,
            imagePath: vizPath,
            path: vizPath,
            filePath: vizPath,
            hasMergeVisualization: hasVisualization,
            visualizationCreated: !!vizPath
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: отправка первого фото в Telegram
    async sendFirstPhotoTelegram(session, userId, transformationInfo, vectorModel, addResult,
                               vizPath, bot, chatId) {
        console.log(`🤖 Отправляю в Telegram...`);

        const cleanMarkdown = (text) => text
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/__/g, '')
            .replace(/_/g, '')
            .replace(/`/g, '')
            .replace(/\[/g, '(')
            .replace(/\]/g, ')');

        // 1. Отправка отпечатка
        if (vizPath && fs.existsSync(vizPath)) {
            try {
                let caption = `👣 ПЕРВЫЙ СЛЕД СОЗДАН\n\n`;
                caption += `📊 Извлечено: ${addResult.added} точек\n`;
                caption += `📐 Угол: ${transformationInfo.rotationAngle?.toFixed(1) || 0}°\n`;
                caption += `🦶 Тип: ${transformationInfo.footType || 'unknown'}\n\n`;
                caption += `✅ Создан шаблон для накопления деталей`;
                caption += `\n\nАлгоритм: 🎯 Геометрический хеш`;

                await bot.sendPhoto(chatId, vizPath, {
                    caption: cleanMarkdown(caption),
                    parse_mode: 'HTML'
                });

                console.log('✅ Визуализация первого следа отправлена');
            } catch (error) {
                console.log('❌ Ошибка отправки визуализации:', error.message);
            }
        } else {
            console.log('⚠️ Нет файла визуализации для отправки');
        }
    }

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: обработка последующих фото
    async processSubsequentPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId) {
        console.log(`🔍 Проверяю совпадение с существующим отпечатком`);

        const existingTransformationInfo = session.currentFootprint?.metadata?.normalizationInfo ||
                                          (session.currentFootprint?.getTransformation ? session.currentFootprint.getTransformation() : null);

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

        // 🔥 ИСПРАВЛЕНО: Используем геометрический алгоритм для сравнения
        const comparisonResult = await this.compareFootprints(
            session.currentFootprint,
            tempFootprint,
            {
                threshold: this.DECISION_THRESHOLDS.PATTERN_SIMILARITY
            }
        );

        const similarity = comparisonResult?.similarity || 0;
        const decision = comparisonResult.similar ? 'same' : 'different';

        console.log(`🎯 ГЕОМЕТРИЧЕСКОЕ РЕШЕНИЕ:`);
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

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: обработка совпадающих следов
    async processMatchingFootprint(session, userId, tempFootprint, finalGraph, transformationInfo,
                                  existingTransformationInfo, similarity, comparisonResult,
                                  tempResult, bot, chatId) {
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
                transformationInfo: existingTransformationInfo
            });
        }

        vectorModel.addGraph(finalGraph, tempFootprint.id, {
            similarity: similarity,
            timestamp: new Date(),
            transformationInfo: transformationInfo
        });

        // Создаем визуализацию
        let hasVisualization = false;
        let vizPath = null;

        if (this.config.enableMergeVisualization) {
            console.log(`🎨 Создаю визуализацию подтверждений...`);
            try {
                const vizResult = await this.visualizeSingleFootprintConfirmations(
                    session.currentFootprint,
                    userId,
                    {
                        currentTransformation: transformationInfo,
                        previousTransformation: existingTransformationInfo,
                        comparisonResult: comparisonResult
                    }
                );

                if (vizResult && vizResult.path) {
                    hasVisualization = true;
                    vizPath = vizResult.path;
                    console.log(`✅ Визуализация создана: ${vizPath}`);
                }
            } catch (error) {
                console.log(`⚠️ Ошибка визуализации: ${error.message}`);
            }
        }

        // Отправка в Telegram
        let telegramSent = false;
        if (bot && chatId) {
            await this.sendMatchTelegram(
                session, userId, transformationInfo, existingTransformationInfo,
                comparisonResult, vectorModel, vizPath, bot, chatId
            );
            telegramSent = true;
        }

        return {
            success: true,
            similarity: similarity,
            decision: 'same',
            nodesAdded: nodesAdded,
            message: `✅ След добавлен! Сходство: ${(similarity * 100).toFixed(1)}%`,
            hasVisualization: hasVisualization,
            telegramSent: telegramSent,
            pointsUpdated: comparisonResult.matches?.length || 0,
            vizPath: vizPath,
            visualizationPath: vizPath,
            imagePath: vizPath,
            path: vizPath,
            filePath: vizPath,
            algorithm: 'geometric_hash'
        };
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: отправка совпадений в Telegram
    async sendMatchTelegram(session, userId, transformationInfo, existingTransformationInfo,
                          comparisonResult, vectorModel, vizPath, bot, chatId) {
        console.log(`🤖 Отправляю подтверждения в Telegram...`);

        const cleanMarkdown = (text) => text
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/__/g, '')
            .replace(/_/g, '')
            .replace(/`/g, '')
            .replace(/\[/g, '(')
            .replace(/\]/g, ')');

        if (vizPath && fs.existsSync(vizPath)) {
            try {
                let caption = `🎯 ГЕОМЕТРИЧЕСКОЕ СОВПАДЕНИЕ\n\n`;
                caption += `📊 Сходство: ${(comparisonResult.similarity * 100).toFixed(1)}%\n`;
                caption += `📐 Угол: ${transformationInfo.rotationAngle?.toFixed(1) || 0}°\n`;
                caption += `🔄 Метод: ${comparisonResult.method || 'geometric_hash'}\n`;
                caption += `📈 Совпало точек: ${comparisonResult.matches?.length || 0}\n\n`;
                caption += `✅ ОДНА И ТА ЖЕ ОБУВЬ`;

                await bot.sendPhoto(chatId, vizPath, {
                    caption: cleanMarkdown(caption),
                    parse_mode: 'HTML'
                });

                console.log('✅ Визуализация подтверждений отправлена');
            } catch (error) {
                console.log('❌ Ошибка отправки визуализации:', error.message);
            }
        }
    }

    // 🔥 МЕТОДЫ ВИЗУАЛИЗАЦИИ
    async visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo = null) {
        console.log(`🎨 ВИЗУАЛИЗАЦИЯ отпечатка для ${userId}`);

        const vizDir = path.join(this.config.dbPath, 'visualizations', 'clusters');
        if (!fs.existsSync(vizDir)) {
            console.log(`📁 Создаю директорию: ${vizDir}`);
            fs.mkdirSync(vizDir, { recursive: true });
        }

        if (!this.config.enableMergeVisualization) {
            console.log('⚠️ Визуализация отключена');
            return { path: null, success: false, reason: 'disabled' };
        }

        try {
            if (this.visualizationManager && this.visualizationManager.visualizeSingleFootprintConfirmations) {
                const result = await this.visualizationManager.visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo);

                if (result && result.path) {
                    console.log(`✅ Визуализация создана: ${result.path}`);
                    return result;
                }
            }
            return this.createVisualizationStub().visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo);
        } catch (error) {
            console.log(`❌ Ошибка визуализации: ${error.message}`);
            return this.createVisualizationStub().visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo);
        }
    }

    async visualizeVectorSuperModel(userId, vectorModel) {
        console.log(`🎨 ВИЗУАЛИЗАЦИЯ шаблона для ${userId}`);

        const templateDir = path.join(this.config.dbPath, 'visualizations', 'templates');
        if (!fs.existsSync(templateDir)) {
            console.log(`📁 Создаю директорию: ${templateDir}`);
            fs.mkdirSync(templateDir, { recursive: true });
        }

        if (!this.config.enableTemplateVisualization) {
            console.log('⚠️ Визуализация шаблонов отключена');
            return { template: null, success: false, reason: 'disabled' };
        }

        try {
            if (this.visualizationManager && this.visualizationManager.visualizeVectorSuperModel) {
                const result = await this.visualizationManager.visualizeVectorSuperModel(userId, vectorModel);

                if (result && result.template) {
                    console.log(`✅ Визуализация шаблона создана: ${result.template}`);
                    return result;
                }
            }
            return this.createVisualizationStub().visualizeVectorSuperModel(userId, vectorModel);
        } catch (error) {
            console.log(`❌ Ошибка визуализации шаблона: ${error.message}`);
            return this.createVisualizationStub().visualizeVectorSuperModel(userId, vectorModel);
        }
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
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

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: обработка нового следа
    async processNewFootprint(session, userId, analysis, photoInfo, finalGraph, transformationInfo,
                            similarity, bot, chatId) {
        console.log(`🆕 Следы разные (${similarity.toFixed(3)}) - новая модель`);

        // Сохраняем текущую сессию как модель если нужно
        if (session.currentFootprint && session.currentFootprint.graph &&
            session.currentFootprint.graph.nodes && session.currentFootprint.graph.nodes.size >= 10) {

            console.log(`💾 Сохраняю текущую сессию как модель`);

            try {
                await this.saveSessionAsModel(userId, `Модель_${new Date().toLocaleTimeString('ru-RU')}`);
            } catch (error) {
                console.log(`⚠️ Не удалось сохранить сессию: ${error.message}`);
            }
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
            hasTemplate: true,
            algorithm: 'geometric_hash'
        };
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    extractPointsFromFootprint(footprint) {
        const points = [];

        // Проверяем points напрямую
        if (footprint.points && Array.isArray(footprint.points)) {
            return footprint.points.filter(p =>
                p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y)
            );
        }

        // Проверяем метод getPoints
        if (footprint.getPoints && typeof footprint.getPoints === 'function') {
            try {
                const extracted = footprint.getPoints();
                if (Array.isArray(extracted)) {
                    return extracted.filter(p =>
                        p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y)
                    );
                }
            } catch (error) {
                console.log(`⚠️ Ошибка getPoints: ${error.message}`);
            }
        }

        // Проверяем pointTracker
        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [, point] of footprint.pointTracker.points) {
                if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                    points.push({
                        x: point.x,
                        y: point.y,
                        id: point.id,
                        confidence: point.confidence,
                        confirmedCount: point.confirmedCount
                    });
                }
            }

            if (points.length > 0) {
                return points;
            }
        }

        // Проверяем graph.nodes
        if (footprint.graph && footprint.graph.nodes) {
            for (const [, node] of footprint.graph.nodes) {
                if (node && typeof node.x === 'number' && typeof node.y === 'number') {
                    points.push({
                        x: node.x,
                        y: node.y,
                        id: node.id,
                        confidence: node.confidence || 0.5
                    });
                }
            }

            if (points.length > 0) {
                return points;
            }
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

        return points.filter(p =>
            p && typeof p.x === 'number' && typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y)
        );
    }

    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'sessions'),
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'visualizations/templates'),
            path.join(this.config.dbPath, 'visualizations/clusters'),
            path.join(this.config.dbPath, 'reports'),
            path.join(this.config.dbPath, 'logs')
        ];

        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                console.log(`📁 Создаю директорию: ${dir}`);
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

    saveSessionAsModel(userId, modelName = null) {
        try {
            const session = this.getActiveSession(userId);
            if (!session || !session.currentFootprint) {
                return { success: false, error: 'Нет активной сессии или отпечатка' };
            }

            const footprint = session.currentFootprint;
            const name = modelName || `Модель_${new Date().toLocaleTimeString('ru-RU')}`;

            const modelsDir = path.join(this.config.dbPath, 'models');
            if (!fs.existsSync(modelsDir)) {
                fs.mkdirSync(modelsDir, { recursive: true });
            }

            const modelData = {
                id: footprint.id,
                userId: footprint.userId,
                name: name,
                timestamp: new Date(),
                graph: footprint.graph ? {
                    nodes: Array.from(footprint.graph.nodes.entries()),
                    edges: footprint.graph.edges || []
                } : null,
                points: footprint.points || [],
                metadata: footprint.metadata || {},
                transformation: footprint.transformation || null
            };

            const filename = `model_${footprint.id}_${Date.now()}.json`;
            const filePath = path.join(modelsDir, filename);

            fs.writeFileSync(filePath, JSON.stringify(modelData, null, 2));

            this.loadedModels.set(footprint.id, footprint);
            this.systemStats.totalModels++;

            console.log(`💾 Сессия сохранена как модель: ${name} (${filename})`);
            return { success: true, modelName: name, filePath, footprintId: footprint.id };

        } catch (error) {
            console.error(`❌ Ошибка сохранения сессии: ${error.message}`);
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
            templateStats: templateStats,
            algorithm: 'Геометрический хеш-алгоритм'
        };
    }

    getVectorSuperModel(userId) {
        return this.vectorSuperModels.get(userId);
    }

    clearVectorSuperModel(userId) {
        if (this.vectorSuperModels.has(userId)) {
            this.vectorSuperModels.delete(userId);
            if (this.userSessions.has(userId)) {
                this.userSessions.delete(userId);
            }
            console.log(`🧹 Очищен шаблон для пользователя ${userId}`);
            return { success: true, message: 'Шаблон очищен' };
        }
        return { success: false, message: 'Шаблон не найден' };
    }

    // 🔥 МЕТОДЫ СЕССИЙ
    getActiveSession(userId) {
        return this.sessionManager.getActiveSession(userId);
    }

    createSession(userId, name = null) {
        return this.sessionManager.createSession(userId, name);
    }

    getSessionInfo(userId) {
        return this.sessionManager.getSessionInfo(userId);
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

    debugVisualizations(userId) {
        return this.visualizationManager.debugVisualizations(userId);
    }
}

module.exports = SimpleFootprintManager;
