// modules/footprint/simple-manager.js
// 🔥 ИНТЕГРИРОВАН ГЕОМЕТРИЧЕСКИЙ ХЕШ-АЛГОРИТМ - ТОЛЬКО ВЕКТОРНЫЕ ОПЕРАЦИИ

const fs = require('fs');
const path = require('path');

// 🔥 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ ИЗ ПАПКИ CLEAN
let GeometricHashAlgorithm;
try {
    GeometricHashAlgorithm = require('./clean/vector-algorithm');
    console.log('✅ Геометрический алгоритм загружен из папки clean');
} catch (error) {
    console.log(`⚠️ Не удалось загрузить геометрический алгоритм: ${error.message}`);
    // Фаллбэк
    GeometricHashAlgorithm = require('./fallback-algorithm');
}

// 🔥 ОСТАЛЬНЫЕ МОДУЛИ (ТОЛЬКО НУЖНЫЕ)
const TemplateCoordination = require('./core/comparison/template-coordination');
const SessionManager = require('./core/session/session-manager');
const GeometryUtils = require('./core/utils/geometry-utils');
const LogManager = require('./core/log-manager');
const SimpleGraph = require('./simple-graph');

class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🚀 SimpleFootprintManager создан с ГЕОМЕТРИЧЕСКИМ АЛГОРИТМОМ (ВЕКТОРНЫЙ)');

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

        // 🔥 ГЕОМЕТРИЧЕСКИЙ АЛГОРИТМ (ОСНОВНОЙ ДВИЖОК)
        this.geometricAlgorithm = new GeometricHashAlgorithm({
            neighborOffsets: [-2, -1, 1, 2],
            angleTolerance: 10,
            minSimilarity: 0.6, // 60% = ОДНА обувь
            debug: this.config.debug,
            useNormalization: true // Используем нормализацию
        });

        console.log('✅ Геометрический алгоритм инициализирован');

        // 🔥 МОДУЛИ (ТОЛЬКО ВЕКТОРНЫЕ)
        const RotationInvariance = require('./rotation-invariance');
        const MirrorDetection = require('./mirror-detection');
        this.rotationProcessor = new RotationInvariance({ debug: this.config.debug });
        this.mirrorDetector = new MirrorDetection({ debug: this.config.debug });

        // 🔥 Основные модули
        this.templateCoordinator = new TemplateCoordination(this);
        this.sessionManager = new SessionManager(this);
        this.geometryUtils = new GeometryUtils(this);

        // 🔥 Визуализация (если нужна)
        if (this.config.enableMergeVisualization || this.config.enableTemplateVisualization) {
            try {
                const VisualizationManager = require('./core/visualization/visualization-manager');
                this.visualizationManager = new VisualizationManager(this);
                console.log('✅ VisualizationManager инициализирован');
            } catch (error) {
                console.log(`⚠️ Визуализация не доступна: ${error.message}`);
                this.visualizationManager = null;
            }
        } else {
            this.visualizationManager = null;
        }

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
            comparisonAlgorithm: 'geometric_hash_v1.0_vector'
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

        console.log('✅ SimpleFootprintManager инициализирован с геометрическим алгоритмом (ВЕКТОРНЫЙ)');
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: СРАВНЕНИЕ ОТПЕЧАТКОВ С ГЕОМЕТРИЧЕСКИМ АЛГОРИТМОМ (ВЕКТОРНЫЙ)
    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 Сравнение следов с ГЕОМЕТРИЧЕСКИМ алгоритмом (ВЕКТОРНЫЙ)`);

        try {
            // 1. Извлекаем ВЕКТОРНЫЕ точки (без растровых трансформаций)
            const points1 = this.extractVectorPoints(footprint1);
            const points2 = this.extractVectorPoints(footprint2);

            if (points1.length < 3 || points2.length < 3) {
                console.log('⚠️ Слишком мало точек для сравнения');
                return {
                    similar: false,
                    similarity: 0,
                    decision: 'different'
                };
            }

            console.log(`📊 Сравниваем ${points1.length} vs ${points2.length} ВЕКТОРНЫХ точек`);

            // 2. Используем ГЕОМЕТРИЧЕСКИЙ алгоритм (ВЕКТОРНЫЙ)
            const geo1 = this.geometricAlgorithm.createFootprint(points1, 'fp1');
            const geo2 = this.geometricAlgorithm.createFootprint(points2, 'fp2');

            const result = this.geometricAlgorithm.compareFootprints(geo1, geo2);

            // 3. Простое решение на основе процентов
            const similarity = result.stats.percent1to2 / 100;
            const isSame = similarity > (options.threshold || this.DECISION_THRESHOLDS.PATTERN_SIMILARITY);

            console.log(`🎯 Геометрический результат (ВЕКТОРНЫЙ):`);
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
                method: 'geometric_hash_algorithm_vector'
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

    // 🔥 НОВЫЙ МЕТОД: Извлечь ВЕКТОРНЫЕ точки (без трансформаций)
    extractVectorPoints(footprint) {
        const points = [];

        // 🔥 БЕРЕМ ОРИГИНАЛЬНЫЕ ТОЧКИ ИЗ ТРЕКЕРА (без трансформаций)
        if (footprint.pointTracker && footprint.pointTracker.points) {
            for (const [id, point] of footprint.pointTracker.points) {
                // 🔥 ИСПОЛЬЗУЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ ИЛИ ТЕКУЩИЕ
                const originalCoords = point.originalCoordinates || { x: point.x, y: point.y };
               
                points.push({
                    id: id,
                    x: originalCoords.x || point.x,
                    y: originalCoords.y || point.y,
                    confidence: point.rating || 0.5,
                    confirmedCount: point.confirmedCount || 1
                });
            }
        }

        // 🔥 ЕСЛИ НЕТ ТРЕКЕРА, ИЩЕМ ДРУГИЕ ИСТОЧНИКИ
        if (points.length === 0 && footprint.graph && footprint.graph.nodes) {
            for (const [id, node] of footprint.graph.nodes) {
                points.push({
                    id: id,
                    x: node.x,
                    y: node.y,
                    confidence: node.confidence || 0.5
                });
            }
        }

        console.log(`📊 Извлечено ${points.length} ВЕКТОРНЫХ точек`);

        // 🔥 ВАЖНО: НЕ ЦЕНТРИРУЕМ И НЕ ТРАНСФОРМИРУЕМ - оставляем как есть
        // Геометрический алгоритм сам обработает
        return points;
    }

    // 🔥 ИСПРАВЛЕННЫЙ МЕТОД: Нормализация отпечатка (ВЕКТОРНАЯ)
    async normalizeFootprint(footprint, options = {}) {
        console.log(`🔄 ВЕКТОРНАЯ нормализация отпечатка ${footprint.id || 'unknown'}`);

        try {
            // Извлекаем ВЕКТОРНЫЕ точки
            const points = this.extractVectorPoints(footprint);

            if (!points || points.length === 0) {
                console.log('⚠️ Нет точек для нормализации');
                return footprint;
            }

            console.log(`📊 ВЕКТОРНАЯ нормализация ${points.length} точек`);

            // 🔥 ВЕКТОРНАЯ НОРМАЛИЗАЦИЯ (без искажений)
            const normalizedPoints = points.map(p => ({
                ...p,
                // 🔥 СОХРАНЯЕМ ОРИГИНАЛЬНЫЕ КООРДИНАТЫ
                originalX: p.x,
                originalY: p.y,
                // 🔥 МОЖЕМ ДОБАВИТЬ ФЛАГ НОРМАЛИЗАЦИИ
                normalized: true,
                // 🔥 НЕ МЕНЯЕМ КООРДИНАТЫ - геометрический алгоритм работает с любыми
                _normalizationMethod: 'vector_preserve'
            }));

            // Обновляем отпечаток
            if (footprint.updatePoints) {
                footprint.updatePoints(normalizedPoints);
            } else {
                footprint.points = normalizedPoints;
            }

            // Сохраняем информацию о ВЕКТОРНОЙ трансформации
            footprint.metadata = footprint.metadata || {};
            footprint.metadata.normalizationInfo = {
                originalPoints: points.length,
                normalizedPoints: normalizedPoints.length,
                transformationType: 'vector_preserve',
                timestamp: new Date(),
                note: 'Векторная нормализация без искажений'
            };

            console.log(`✅ Отпечаток нормализован (ВЕКТОРНО): ${normalizedPoints.length} точек`);

            return footprint;

        } catch (error) {
            console.error(`❌ Ошибка векторной нормализации: ${error.message}`);
            return footprint;
        }
    }

    // 🔥 ГЛАВНЫЙ МЕТОД: Добавление фото в сессию (ОБНОВЛЁННЫЙ)
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ДОБАВЛЕНИЕ ФОТО в сессию пользователя ${userId} (ВЕКТОРНЫЙ)`);

        try {
            if (!analysis?.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }

            // Извлечение ВЕКТОРНЫХ точек
            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < this.config.minPointsForFootprint) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }

            // Создание и ВЕКТОРНАЯ нормализация графа
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

            console.log(`📊 ИТОГОВЫЙ РЕЗУЛЬТАТ (ВЕКТОРНЫЙ):`, {
                similarity: result.similarity,
                decision: result.decision,
                algorithm: 'geometric_hash_vector'
            });

            return result;

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (остаются без изменений, но могут быть оптимизированы)

    createAndNormalizeGraph(points, userId, photoInfo) {
        const graph = new SimpleGraph(`Временный_${Date.now()}`);
        graph.buildFromPoints(points);

        // 🔥 ВЕКТОРНАЯ нормализация
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
            photoId: photoInfo.photoId || `photo_${Date.now()}`,
            note: 'Векторная нормализация'
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

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: обработка первого фото
    async processFirstPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId) {
        console.log(`👣 Первое фото: создаю отпечаток и шаблон (ВЕКТОРНЫЙ)`);

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

        // Создание ВЕКТОРНОГО шаблона
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

        console.log(`✅ Создан ВЕКТОРНЫЙ отпечаток с ${addResult.added} узлами`);

        // Создаем визуализацию (если включено)
        let hasVisualization = false;
        let vizPath = null;

        if (this.config.enableMergeVisualization && this.visualizationManager) {
            console.log(`🎨 Создаю ВЕКТОРНУЮ визуализацию для первого фото...`);

            try {
                const vizResult = await this.visualizationManager.visualizeSingleFootprintConfirmations(
                    session.currentFootprint,
                    userId,
                    transformationInfo
                );

                if (vizResult && vizResult.path) {
                    hasVisualization = true;
                    vizPath = vizResult.path;
                    console.log(`✅ Путь к ВЕКТОРНОЙ визуализации: ${vizPath}`);
                }
            } catch (vizError) {
                console.log(`⚠️ Ошибка векторной визуализации: ${vizError.message}`);
            }
        }

        // Отправка в Telegram (если нужно)
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
            algorithm: 'geometric_hash_vector'
        };
    }

    // 🔥 БЕЗОПАСНОЕ УЛУЧШЕНИЕ: обработка последующих фото
    async processSubsequentPhoto(session, userId, analysis, photoInfo, finalGraph, transformationInfo, bot, chatId) {
        console.log(`🔍 Проверяю совпадение с существующим отпечатком (ВЕКТОРНЫЙ)`);

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

        // 🔥 ИСПРАВЛЕНО: Используем геометрический алгоритм для сравнения (ВЕКТОРНЫЙ)
        const comparisonResult = await this.compareFootprints(
            session.currentFootprint,
            tempFootprint,
            {
                threshold: this.DECISION_THRESHOLDS.PATTERN_SIMILARITY
            }
        );

        const similarity = comparisonResult?.similarity || 0;
        const decision = comparisonResult.similar ? 'same' : 'different';

        console.log(`🎯 ГЕОМЕТРИЧЕСКОЕ РЕШЕНИЕ (ВЕКТОРНЫЙ):`);
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

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (остаются)

    async processMatchingFootprint(session, userId, tempFootprint, finalGraph, transformationInfo,
                                  existingTransformationInfo, similarity, comparisonResult,
                                  tempResult, bot, chatId) {
        console.log(`✅ Следы совпали (ВЕКТОРНЫЙ) (${similarity.toFixed(3)})`);

        const nodesAdded = tempResult?.added || 0;

        // Работа с ВЕКТОРНЫМ шаблоном
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

        // Создаем ВЕКТОРНУЮ визуализацию
        let hasVisualization = false;
        let vizPath = null;

        if (this.config.enableMergeVisualization && this.visualizationManager) {
            console.log(`🎨 Создаю ВЕКТОРНУЮ визуализацию подтверждений...`);
            try {
                const vizResult = await this.visualizationManager.visualizeSingleFootprintConfirmations(
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
                    console.log(`✅ ВЕКТОРНАЯ визуализация создана: ${vizPath}`);
                }
            } catch (error) {
                console.log(`⚠️ Ошибка векторной визуализации: ${error.message}`);
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
            message: `✅ След добавлен! ВЕКТОРНОЕ сходство: ${(similarity * 100).toFixed(1)}%`,
            hasVisualization: hasVisualization,
            telegramSent: telegramSent,
            pointsUpdated: comparisonResult.matches?.length || 0,
            vizPath: vizPath,
            algorithm: 'geometric_hash_vector'
        };
    }

    async processNewFootprint(session, userId, analysis, photoInfo, finalGraph, transformationInfo,
                            similarity, bot, chatId) {
        console.log(`🆕 Следы разные (ВЕКТОРНЫЙ) (${similarity.toFixed(3)}) - новая модель`);

        // Сохраняем текущую сессию как модель если нужно
        if (session.currentFootprint && session.currentFootprint.graph &&
            session.currentFootprint.graph.nodes && session.currentFootprint.graph.nodes.size >= 10) {

            console.log(`💾 Сохраняю текущую сессию как ВЕКТОРНУЮ модель`);

            try {
                await this.saveSessionAsModel(userId, `ВЕКТОРНАЯ_Модель_${new Date().toLocaleTimeString('ru-RU')}`);
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

        // Новый ВЕКТОРНЫЙ шаблон
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
            algorithm: 'geometric_hash_vector'
        };
    }

    // 🔥 МЕТОДЫ ВИЗУАЛИЗАЦИИ (если нужны)
    async visualizeSingleFootprintConfirmations(footprint, userId, transformationInfo = null) {
        if (!this.visualizationManager) {
            console.log('⚠️ Визуализация отключена');
            return { path: null, success: false, reason: 'disabled' };
        }

        console.log(`🎨 ВЕКТОРНАЯ визуализация отпечатка для ${userId}`);

        try {
            return await this.visualizationManager.visualizeSingleFootprintConfirmations(
                footprint, userId, transformationInfo
            );
        } catch (error) {
            console.log(`❌ Ошибка векторной визуализации: ${error.message}`);
            return { path: null, success: false, reason: error.message };
        }
    }

    async visualizeVectorSuperModel(userId, vectorModel) {
        if (!this.visualizationManager) {
            console.log('⚠️ Визуализация шаблонов отключена');
            return { template: null, success: false, reason: 'disabled' };
        }

        console.log(`🎨 ВЕКТОРНАЯ визуализация шаблона для ${userId}`);

        try {
            return await this.visualizationManager.visualizeVectorSuperModel(userId, vectorModel);
        } catch (error) {
            console.log(`❌ Ошибка векторной визуализации шаблона: ${error.message}`);
            return { template: null, success: false, reason: error.message };
        }
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ ФАЙЛОВОЙ СИСТЕМЫ

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
            const name = modelName || `ВЕКТОРНАЯ_Модель_${new Date().toLocaleTimeString('ru-RU')}`;

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
                transformation: footprint.transformation || null,
                _vectorModel: true
            };

            const filename = `vector_model_${footprint.id}_${Date.now()}.json`;
            const filePath = path.join(modelsDir, filename);

            fs.writeFileSync(filePath, JSON.stringify(modelData, null, 2));

            this.loadedModels.set(footprint.id, footprint);
            this.systemStats.totalModels++;

            console.log(`💾 Сессия сохранена как ВЕКТОРНАЯ модель: ${name} (${filename})`);
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
            algorithm: 'Геометрический хеш-алгоритм (ВЕКТОРНЫЙ)'
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
            console.log(`🧹 Очищен ВЕКТОРНЫЙ шаблон для пользователя ${userId}`);
            return { success: true, message: 'ВЕКТОРНЫЙ шаблон очищен' };
        }
        return { success: false, message: 'ВЕКТОРНЫЙ шаблон не найден' };
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
        if (this.visualizationManager) {
            return this.visualizationManager.debugVisualizations(userId);
        }
        return { status: 'disabled', message: 'Visualization manager disabled' };
    }

    // 🔥 TELEGRAM МЕТОДЫ (если нужны)

    async sendFirstPhotoTelegram(session, userId, transformationInfo, vectorModel, addResult,
                               vizPath, bot, chatId) {
        console.log(`🤖 Отправляю в Telegram (ВЕКТОРНЫЙ)...`);

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
                let caption = `👣 ПЕРВЫЙ СЛЕД СОЗДАН (ВЕКТОРНЫЙ)\n\n`;
                caption += `📊 Извлечено: ${addResult.added} ВЕКТОРНЫХ точек\n`;
                caption += `📐 Угол: ${transformationInfo.rotationAngle?.toFixed(1) || 0}°\n`;
                caption += `🦶 Тип: ${transformationInfo.footType || 'unknown'}\n\n`;
                caption += `✅ Создан ВЕКТОРНЫЙ шаблон для накопления деталей`;
                caption += `\n\nАлгоритм: 🎯 Геометрический хеш (ВЕКТОРНЫЙ)`;

                await bot.sendPhoto(chatId, vizPath, {
                    caption: cleanMarkdown(caption),
                    parse_mode: 'HTML'
                });

                console.log('✅ ВЕКТОРНАЯ визуализация первого следа отправлена');
            } catch (error) {
                console.log('❌ Ошибка отправки векторной визуализации:', error.message);
            }
        } else {
            console.log('⚠️ Нет файла ВЕКТОРНОЙ визуализации для отправки');
        }
    }

    async sendMatchTelegram(session, userId, transformationInfo, existingTransformationInfo,
                          comparisonResult, vectorModel, vizPath, bot, chatId) {
        console.log(`🤖 Отправляю ВЕКТОРНЫЕ подтверждения в Telegram...`);

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
                let caption = `🎯 ВЕКТОРНОЕ СОВПАДЕНИЕ\n\n`;
                caption += `📊 Сходство: ${(comparisonResult.similarity * 100).toFixed(1)}%\n`;
                caption += `📐 Угол: ${transformationInfo.rotationAngle?.toFixed(1) || 0}°\n`;
                caption += `🔄 Метод: ${comparisonResult.method || 'geometric_hash_vector'}\n`;
                caption += `📈 Совпало ВЕКТОРНЫХ точек: ${comparisonResult.matches?.length || 0}\n\n`;
                caption += `✅ ОДНА И ТА ЖЕ ОБУВЬ (ВЕКТОРНОЕ ПОДТВЕРЖДЕНИЕ)`;

                await bot.sendPhoto(chatId, vizPath, {
                    caption: cleanMarkdown(caption),
                    parse_mode: 'HTML'
                });

                console.log('✅ ВЕКТОРНАЯ визуализация подтверждений отправлена');
            } catch (error) {
                console.log('❌ Ошибка отправки векторной визуализации:', error.message);
            }
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Быстрый тест векторной целостности
    quickVectorTest(footprint) {
        console.log(`🔍 Быстрый тест векторной целостности...`);

        const points = this.extractVectorPoints(footprint);
        const validPoints = points.filter(p =>
            typeof p.x === 'number' && typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y)
        );

        const integrity = validPoints.length / Math.max(1, points.length);

        return {
            totalPoints: points.length,
            validPoints: validPoints.length,
            integrity: integrity,
            status: integrity > 0.95 ? '✅ ОТЛИЧНО' : integrity > 0.8 ? '⚠️ ХОРОШО' : '❌ ПЛОХО',
            sample: validPoints.length > 0 ?
                `Первая точка: (${validPoints[0].x.toFixed(1)}, ${validPoints[0].y.toFixed(1)})` :
                'Нет валидных точек'
        };
    }
}

module.exports = SimpleFootprintManager;
