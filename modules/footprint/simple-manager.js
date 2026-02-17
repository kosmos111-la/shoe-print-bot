// modules/footprint/simple-manager.js
// 🔥 ИНТЕГРИРУЕМ ТОПОЛОГИЧЕСКУЮ СИСТЕМУ (С ПОДДЕРЖКОЙ КОНТУРОВ)

const fs = require('fs');
const path = require('path');

// 🔥 ИМПОРТЫ
const TopologyManager = require('./topology/TopologyManager');
const SimpleFootprint = require('./simple-footprint');

// 🔥 ОСТАЛЬНЫЕ МОДУЛИ
const TemplateCoordination = require('./core/comparison/template-coordination');
const SessionManager = require('./core/session/session-manager');
const GeometryUtils = require('./core/utils/geometry-utils');
const LogManager = require('./core/log-manager');

class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🚀 SimpleFootprintManager с ФОТО-ОРИЕНТИРОВАННОЙ ТОПОЛОГИЧЕСКОЙ СИСТЕМОЙ');

        // 🔥 НАСТРОЙКИ
        const {
            dbPath = './data/footprints',
            autoAlignment = false,
            autoSave = true,
            debug = false,
            usePointTracker = false,
            enableTopology = true,
            enableMergeVisualization = true,
            topologySimilarityThreshold = 0.7,
            minPointsForFootprint = 5,
            enableCoordinateDiagnostics = false,
            useLegacyVectorAlgorithm = false,
            ...otherOptions
        } = options;

        this.config = {
            dbPath,
            autoAlignment,
            autoSave,
            debug,
            usePointTracker,
            enableTopology,
            enableMergeVisualization,
            topologySimilarityThreshold,
            minPointsForFootprint,
            enableCoordinateDiagnostics,
            useLegacyVectorAlgorithm,
            ...otherOptions
        };

        // 🔥 ТОПОЛОГИЧЕСКИЙ МЕНЕДЖЕР
        this.topologyManagers = new Map();

        // 🔥 СТАРЫЕ МОДУЛИ (для совместимости)
        const RotationInvariance = require('./rotation-invariance');
        const MirrorDetection = require('./mirror-detection');
        this.rotationProcessor = new RotationInvariance({ debug: false });
        this.mirrorDetector = new MirrorDetection({ debug: false });

        // 🔥 Основные модули
        this.templateCoordinator = new TemplateCoordination(this);
        this.sessionManager = new SessionManager(this);
        this.geometryUtils = new GeometryUtils(this);

        // 🔥 Визуализация
        if (this.config.enableMergeVisualization) {
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
        this.systemStats = {
            totalUsers: 0,
            totalModels: 0,
            totalPhotosProcessed: 0,
            totalTopologicalModels: 0,
            lastActivity: new Date(),
            comparisonAlgorithm: 'photo_oriented_topological'
        };

        this.ensureDirectories();
        this.loadExistingModels();

        // 🔥 ПОРОГИ РЕШЕНИЙ
        this.DECISION_THRESHOLDS = {
            TOPOLOGY_SIMILARITY: this.config.topologySimilarityThreshold,
            MIN_MATCHES: 3,
            MIN_POINTS: 3
        };

        console.log(`🎯 Фото-ориентированная топология: сходство >${this.DECISION_THRESHOLDS.TOPOLOGY_SIMILARITY}`);

        // 🔥 Логирование
        this.log = new LogManager(this);
        if (options.logLevel) this.log.setLevel(options.logLevel);

        console.log('✅ SimpleFootprintManager инициализирован с ФОТО-ОРИЕНТИРОВАННОЙ системой');
    }

    // ==================== ГЛАВНЫЙ МЕТОД ====================

    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ФОТО-ОРИЕНТИРОВАННАЯ обработка фото для пользователя ${userId}`);

        try {
            // 🔥 ДИАГНОСТИКА
            console.log(`🔍 Диагностика структуры анализа:`);
            console.log(`   analysis есть? ${!!analysis}`);
            console.log(`   predictions есть? ${!!analysis?.predictions}`);
            console.log(`   predictions тип: ${typeof analysis?.predictions}`);

            if (analysis?.predictions && Array.isArray(analysis.predictions)) {
                console.log(`   predictions длина: ${analysis.predictions.length}`);
                if (analysis.predictions.length > 0) {
                    const firstPred = analysis.predictions[0];
                    console.log(`   Пример первого предсказания:`);
                    console.log(`     class: ${firstPred?.class}`);
                    console.log(`     confidence: ${firstPred?.confidence}`);
                    console.log(`     points есть? ${!!firstPred?.points}`);
                    console.log(`     points длина: ${firstPred?.points?.length || 0}`);
                }
            }

            if (!analysis?.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }

            // 🔥 ИЗВЛЕКАЕМ ТОЧКИ И КОНТУРЫ
            const { points, contours } = this.extractPointsAndContours(analysis);
           
            if (points.length < this.config.minPointsForFootprint) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }

            console.log(`📊 Извлечено ${points.length} точек и ${contours.length} контуров из анализа`);

            // 🔥 СОЗДАЁМ/ПОЛУЧАЕМ СЕССИЮ
            const session = this.getOrCreatePhotoSession(userId);
            const photoId = photoInfo.photoId || `photo_${Date.now()}`;

            let footprint;
            if (!session.currentFootprint) {
                footprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
                    transformation: null
                });
                session.currentFootprint = footprint;
                console.log(`👣 Создан новый ФОТО-ОРИЕНТИРОВАННЫЙ след: "${footprint.name}"`);
            } else {
                footprint = session.currentFootprint;
                console.log(`👣 Использую существующий след: "${footprint.name}"`);
                console.log(`   Уже содержит фото: ${footprint.metadata.totalPhotos}`);
            }

            // 🔥 ДОБАВЛЯЕМ ФОТО
            const addResult = footprint.addPhotoAnalysis(photoId, analysis, {
                ...photoInfo,
                photoId: photoId,
                source: photoInfo.source || 'telegram_bot',
                transformationInfo: null
            });

            if (!addResult.success) {
                console.log(`❌ Ошибка добавления фото: ${addResult.error}`);
                return {
                    success: false,
                    error: addResult.error,
                    nodesAdded: 0
                };
            }

            console.log(`📈 Фото ${photoId} добавлено в след: ${addResult.points} точек`);
            console.log(`   Всего фото в следе: ${addResult.totalPhotos}`);

            // 🔥 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА
            let topologicalResult = null;
            let decision = 'unknown';
            let similarity = 0;

            if (this.config.enableTopology) {
                // 🔥 ПЕРЕДАЁМ И ТОЧКИ, И КОНТУРЫ
                topologicalResult = await this.processTopologically(
                    userId,
                    footprint,
                    { points, contours },  // ← ВАЖНО: передаём объект с точками и контурами
                    { ...photoInfo, photoId }
                );

                decision = topologicalResult.decision;
                similarity = topologicalResult.similarity || 0;

                console.log(`🎯 ТОПОЛОГИЧЕСКОЕ РЕШЕНИЕ: ${decision} (${(similarity * 100).toFixed(1)}%)`);
            }

            // 🔥 ВИЗУАЛИЗАЦИЯ
            let visualizationData = null;
let vizPath = null;

if (this.config.enableMergeVisualization && this.visualizationManager) {
    try {
        const topologyManager = this.getTopologyManager(userId);
        if (topologyManager) {
            // Получаем базовые данные из топологического менеджера
            visualizationData = topologyManager.getAccumulativeVisualizationData();
           
            // 🔥 ДВЕ ПРОВЕРКИ ДЛЯ matchMap
            let matchMap = null;
           
            // Проверка 1: прямой путь
            if (topologicalResult && topologicalResult.matchMap) {
                matchMap = topologicalResult.matchMap;
                console.log(`🔍 matchMap найден напрямую: ${matchMap.size} пар`);
            }
            // Проверка 2: вложенный путь
            else if (topologicalResult && topologicalResult.topologicalResult && topologicalResult.topologicalResult.matchMap) {
                matchMap = topologicalResult.topologicalResult.matchMap;
                console.log(`🔍 matchMap найден во вложенном объекте: ${matchMap.size} пар`);
            }
           
            // Если нашли matchMap, добавляем в визуализацию
            if (matchMap && visualizationData) {
                visualizationData.matchMap = matchMap;
                console.log(`✅ matchMap добавлен в визуализацию: ${matchMap.size} пар`);
            } else {
                console.log(`⚠️ matchMap не найден нигде`);
                if (topologicalResult) {
                    console.log(`   Ключи topologicalResult: ${Object.keys(topologicalResult).join(', ')}`);
                }
            }

            if (visualizationData) {
                console.log(`🎨 Готовлю топологическую визуализацию...`);

                const ClusterVisualizer = require('./visualizations/cluster-visualizer');
                const visualizer = new ClusterVisualizer({
                    outputDir: './data/footprints/visualizations/topology',
                    canvasWidth: 1200,
                    canvasHeight: 800,
                    debug: this.config.debug
                });

                const vizResult = await visualizer.visualizeTopologicalModel(visualizationData, {
                    filename: `topology_${userId}_${Date.now()}.png`
                });

                if (vizResult && vizResult.path) {
                    vizPath = vizResult.path;
                    console.log(`✅ Топологическая визуализация создана: ${vizPath}`);
                   
                    // Дополнительная диагностика
                    if (vizResult.modelPath && vizResult.photoPath) {
                        console.log(`   📸 Модель: ${vizResult.modelPath}`);
                        console.log(`   📸 Фото: ${vizResult.photoPath}`);
                    }
                }
            }
        }
    } catch (vizError) {
        console.log(`⚠️ Ошибка топологической визуализации: ${vizError.message}`);
        console.error(vizError); // Для отладки
    }
}

            // 🔥 ОТПРАВКА В TELEGRAM
            let telegramSent = false;
            if (bot && chatId && vizPath) {
                telegramSent = await this.sendTopologyTelegram(
                    userId, decision, similarity, visualizationData,
                    vizPath, bot, chatId, topologicalResult
                );
            }

            // 🔥 ФОРМИРУЕМ РЕЗУЛЬТАТ
            const result = {
                success: true,
                footprintId: footprint.id,
                photoId: photoId,
                nodesAdded: addResult.points || 0,
                totalPhotos: footprint.metadata.totalPhotos,
                topologicalDecision: decision,
                topologicalSimilarity: similarity,
                hasTopology: this.config.enableTopology,
                visualizationPath: vizPath,
                telegramSent: telegramSent
            };

            if (topologicalResult) {
                result.topologicalResult = {
                    modelId: topologicalResult.modelId,
                    exactMatches: topologicalResult.exactMatches || 0,
                    newNodesAdded: topologicalResult.newNodesAdded || 0,
                    status: topologicalResult.status
                };
            }

            console.log(`📊 ИТОГОВЫЙ РЕЗУЛЬТАТ:`);
            console.log(`   Фото ID: ${photoId}`);
            console.log(`   Фото в следе: ${result.totalPhotos}`);
            console.log(`   Топологическое решение: ${result.topologicalDecision}`);
            console.log(`   Сходство: ${(result.topologicalSimilarity * 100).toFixed(1)}%`);

            return result;

        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    // ==================== ИЗВЛЕЧЕНИЕ ТОЧЕК И КОНТУРОВ ====================

    extractPointsAndContours(analysis) {
        console.log(`🔍 Извлечение точек и контуров из анализа...`);

        let predictions = [];

        if (Array.isArray(analysis.predictions)) {
            predictions = analysis.predictions;
            console.log(`📊 Найден массив predictions: ${predictions.length} элементов`);
        } else if (analysis.predictions && typeof analysis.predictions === 'object') {
            if (Array.isArray(analysis.predictions.predictions)) {
                predictions = analysis.predictions.predictions;
                console.log(`📊 Найден predictions.predictions: ${predictions.length} элементов`);
            } else if (analysis.predictions.data && Array.isArray(analysis.predictions.data)) {
                predictions = analysis.predictions.data;
                console.log(`📊 Найден predictions.data: ${predictions.length} элементов`);
            } else {
                predictions = Object.values(analysis.predictions);
                console.log(`📊 Преобразован объект в массив: ${predictions.length} элементов`);
            }
        } else {
            console.log(`❌ Неизвестный формат predictions`);
            return { points: [], contours: [] };
        }

        const points = [];
        const contours = [];
        let protectorCount = 0;
        let otherCount = 0;

        for (let i = 0; i < predictions.length; i++) {
            const pred = predictions[i];

            if (!pred || typeof pred !== 'object') continue;

            if (pred.points && Array.isArray(pred.points) && pred.points.length > 0) {
               
                const pointId = `pt_${Date.now()}_${i}_${protectorCount}`;
               
                // 🔥 СОХРАНЯЕМ КОНТУР
                contours.push({
                    id: `contour_${Date.now()}_${i}`,
                    pointId: pointId,
                    points: pred.points,
                    class: pred.class,
                    confidence: pred.confidence || 0.5
                });

                // 🔥 ВЫЧИСЛЯЕМ ЦЕНТР
                const center = this.calculateCenter(pred.points);
               
                const isProtector = pred.class === 'shoe-protector' ||
                                   (pred.class && pred.class.toLowerCase().includes('protector'));

                // 🔥 СОХРАНЯЕМ ТОЧКУ
                points.push({
                    id: pointId,
                    x: center.x,
                    y: center.y,
                    confidence: pred.confidence || 0.5,
                    originalPoints: pred.points,
                    class: pred.class,
                    originalIndex: i,
                    contourId: `contour_${Date.now()}_${i}`
                });

                if (isProtector) {
                    protectorCount++;
                } else {
                    otherCount++;
                }
            }
        }

        console.log(`✅ Извлечено точек: ${points.length}, контуров: ${contours.length}`);
        console.log(`   Протекторы: ${protectorCount}, другие: ${otherCount}`);

        return { points, contours };
    }

    calculateCenter(points) {
        if (!points || !Array.isArray(points) || points.length === 0) {
            return { x: 0, y: 0 };
        }

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);

        return {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
    }

    // ==================== ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА ====================

    async processTopologically(userId, footprint, analysisData, photoInfo) {
        try {
            const topologyManager = this.getOrCreateTopologyManager(userId);

            // 🔥 ПЕРЕДАЁМ В ТОПОЛОГИЧЕСКИЙ МЕНЕДЖЕР
            const result = await topologyManager.processFootprint(
                footprint, analysisData, photoInfo
            );

            if (!result.success) {
                console.log(`⚠️ Топологическая обработка не удалась: ${result.error}`);
                return {
                    decision: 'topology_failed',
                    similarity: 0,
                    modelId: null,
                    status: 'failed'
                };
            }

            if (result.topologicalResult?.status === 'created') {
                this.systemStats.totalTopologicalModels++;
            }

            this.systemStats.totalPhotosProcessed++;
            this.systemStats.lastActivity = new Date();

            return {
                decision: result.decision,
                similarity: result.similarity || 0,
                modelId: result.modelId,
                exactMatches: result.topologicalResult?.exactMatches || 0,
                newNodesAdded: result.topologicalResult?.newNodesAdded || 0,
                status: result.topologicalResult?.status || 'unknown',
                modelInfo: result.modelInfo
            };

        } catch (error) {
            console.log(`❌ Ошибка топологической обработки: ${error.message}`);
            return {
                decision: 'topology_error',
                similarity: 0,
                error: error.message,
                status: 'error'
            };
        }
    }

    // ==================== УПРАВЛЕНИЕ ТОПОЛОГИЧЕСКИМИ МЕНЕДЖЕРАМИ ====================

    getOrCreateTopologyManager(userId) {
        if (!this.topologyManagers.has(userId)) {
            const topologyManager = new TopologyManager({
                userId: userId,
                name: `Топология_пользователя_${userId}`,
                debug: this.config.debug,
                similarityThreshold: this.config.topologySimilarityThreshold
            });

            this.topologyManagers.set(userId, topologyManager);
            console.log(`🎯 Создан TopologyManager для пользователя ${userId}`);
        }

        return this.topologyManagers.get(userId);
    }

    getTopologyManager(userId) {
        return this.topologyManagers.get(userId);
    }

    // ==================== УПРАВЛЕНИЕ СЕССИЯМИ ====================

    getOrCreatePhotoSession(userId) {
        let session = this.sessionManager.getActiveSession(userId);

        if (!session) {
            session = this.sessionManager.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);

            const footprint = new SimpleFootprint({
                userId: userId,
                name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`
            });

            session.currentFootprint = footprint;
            console.log(`🆕 Создана сессия с фото-ориентированным следом для ${userId}`);
        }

        return session;
    }

    getActiveSession(userId) {
        return this.sessionManager.getActiveSession(userId);
    }

    createSession(userId, name = null) {
        return this.sessionManager.createSession(userId, name);
    }

    getSessionInfo(userId) {
        const session = this.getActiveSession(userId);
        if (!session) return null;

        return {
            id: session.id,
            userId: session.userId,
            name: session.name,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            photosCount: session.photos ? session.photos.length : 0,
            hasFootprint: !!session.currentFootprint,
            currentFootprintId: session.currentFootprint?.id,
            footprintStats: session.currentFootprint ? {
                photos: session.currentFootprint.metadata?.totalPhotos || 0,
                totalPoints: session.currentFootprint.stats?.totalPointsAcrossPhotos || 0,
                confidence: session.currentFootprint.stats?.confidence || 0
            } : null
        };
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

    clearSession(userId) {
        console.log(`🧹 Очистка сессии ${userId}`);

        this.sessionManager.sessions.delete(userId);
        this.topologyManagers.delete(userId);
        this.userSessions.delete(userId);

        return { success: true, message: `Сессия ${userId} очищена` };
    }

    getAllSessions() {
        const sessions = [];

        for (const [userId, session] of this.sessionManager.sessions) {
            sessions.push({
                userId,
                sessionId: session.id,
                name: session.name,
                photosCount: session.photos?.length || 0,
                hasFootprint: !!session.currentFootprint,
                lastActivity: session.lastActivity
            });
        }

        return {
            total: sessions.length,
            sessions: sessions
        };
    }

    // ==================== СРАВНЕНИЕ СЛЕДОВ ====================

    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 СРАВНЕНИЕ ФОТО-ОРИЕНТИРОВАННЫХ следов`);

        try {
            const userId = footprint1.userId || footprint2.userId || 'default';
            const topologyManager = this.getOrCreateTopologyManager(userId);

            const result = await topologyManager.compareFootprints(
                footprint1, footprint2, options
            );

            console.log(`🎯 РЕЗУЛЬТАТ: ${result.decision.toUpperCase()} (${(result.similarity * 100).toFixed(1)}%)`);

            return result;

        } catch (error) {
            console.error(`❌ Ошибка сравнения: ${error.message}`);
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                error: error.message,
                method: 'topology_error'
            };
        }
    }

    async comparePhotoToModel(userId, analysis, options = {}) {
        console.log(`🔍 СРАВНЕНИЕ ФОТО С МОДЕЛЬЮ для пользователя ${userId}`);

        try {
            const topologyManager = this.getOrCreateTopologyManager(userId);

            const result = await topologyManager.comparePhotoToModel(
                analysis,
                options.modelId,
                options
            );

            return result;

        } catch (error) {
            console.error(`❌ Ошибка сравнения фото с моделью: ${error.message}`);
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                error: error.message
            };
        }
    }

    // ==================== ВИЗУАЛИЗАЦИЯ ====================

    async getVisualizationForSession(userId, options = {}) {
        console.log(`🎨 getVisualizationForSession для ${userId}`);

        try {
            const topologyManager = this.getTopologyManager(userId);
            if (!topologyManager) {
                return { success: false, error: 'Нет топологической модели' };
            }

            const topologyData = topologyManager.getAccumulativeVisualizationData();
            if (!topologyData) {
                return { success: false, error: 'Нет данных для визуализации' };
            }

            const ClusterVisualizer = require('./visualizations/cluster-visualizer');
            const visualizer = new ClusterVisualizer({
                outputDir: './data/footprints/visualizations',
                canvasWidth: 1200,
                canvasHeight: 800
            });

            const vizResult = await visualizer.visualizeTopologicalModel(topologyData, {
                filename: `session_${userId}_${Date.now()}.png`,
                ...options
            });

            return {
                success: true,
                path: vizResult.path,
                stats: topologyData.stats
            };

        } catch (error) {
            console.log(`❌ Ошибка getVisualizationForSession: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    getTopologyVisualizationData(userId) {
        const topologyManager = this.getTopologyManager(userId);
        if (!topologyManager) return null;
        return topologyManager.getAccumulativeVisualizationData();
    }

    // ==================== СТАТИСТИКА ====================

    getSystemStats() {
        const topologyStats = [];
        for (const [userId, manager] of this.topologyManagers) {
            const modelsInfo = manager.getUserModelsInfo();
            topologyStats.push({
                userId,
                models: modelsInfo.models?.total || 0,
                totalNodes: modelsInfo.models?.totalNodes || 0
            });
        }

        return {
            ...this.systemStats,
            activeSessions: this.userSessions.size,
            loadedModels: this.loadedModels.size,
            topologicalManagers: this.topologyManagers.size,
            topologyStats: topologyStats,
            algorithm: 'Фото-ориентированная топология (Делоне + Weisfeiler-Lehman)',
            config: {
                enableTopology: this.config.enableTopology,
                topologySimilarityThreshold: this.config.topologySimilarityThreshold,
                useLegacyVectorAlgorithm: this.config.useLegacyVectorAlgorithm,
                photoOriented: true
            }
        };
    }

    getSessionStats(userId) {
        const session = this.getActiveSession(userId);
        const topologyManager = this.getTopologyManager(userId);

        const baseStats = {
            sessionId: session?.id || 'none',
            userId: userId,
            photosCount: session?.photos?.length || 0,
            hasFootprint: !!session?.currentFootprint,
            footprintPhotos: session?.currentFootprint?.metadata?.totalPhotos || 0
        };

        if (topologyManager) {
            const modelInfo = topologyManager.accumulator.getModelInfo();
            return {
                ...baseStats,
                hasTopology: true,
                topologyModelId: topologyManager.accumulator.currentModelId,
                topologyNodes: modelInfo?.stats?.nodes || 0,
                topologyEdges: modelInfo?.stats?.edges || 0,
                confirmations: {
                    confirmed3: modelInfo?.stats?.confirmed3 || 0,
                    confirmed2: modelInfo?.stats?.confirmed2 || 0,
                    confirmed1: modelInfo?.stats?.confirmed1 || 0,
                    confirmed0: modelInfo?.stats?.confirmed0 || 0
                }
            };
        }

        return baseStats;
    }

    // ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

    ensureDirectories() {
        const dirs = [
            this.config.dbPath,
            path.join(this.config.dbPath, 'models'),
            path.join(this.config.dbPath, 'sessions'),
            path.join(this.config.dbPath, 'visualizations'),
            path.join(this.config.dbPath, 'visualizations/topology'),
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

        files.slice(0, 50).forEach(file => {
            try {
                const filePath = path.join(modelsDir, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const footprint = SimpleFootprint.fromJSON(data);
                this.loadedModels.set(footprint.id, footprint);
                loadedCount++;
            } catch (error) {
                console.log(`⚠️ Ошибка загрузки модели ${file}:`, error.message);
            }
        });

        this.systemStats.totalModels = loadedCount;
    }

    clearUserTopology(userId) {
        const topologyManager = this.getTopologyManager(userId);
        if (!topologyManager) {
            return { success: false, message: 'Топологический менеджер не найден' };
        }
        return topologyManager.clearUserModels();
    }

    // ==================== МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ ====================

    async addAnalysisToSession(userId, analysis, photoInfo = {}) {
        console.log(`👣 [Совместимость] addAnalysisToSession для ${userId}`);

        try {
            const result = await this.addPhotoToSession(userId, analysis, photoInfo);

            return {
                success: result.success,
                nodesAdded: result.nodesAdded || 0,
                totalPhotos: result.totalPhotos || 0,
                similarity: result.topologicalSimilarity || 0,
                decision: result.topologicalDecision || 'unknown',
                footprintId: result.footprintId,
                visualizationPath: result.visualizationPath,
                error: result.error
            };

        } catch (error) {
            console.log(`❌ Ошибка addAnalysisToSession: ${error.message}`);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }

    debugVisualizations(userId) {
        const topologyManager = this.getTopologyManager(userId);

        if (!topologyManager) {
            return { status: 'no_topology', message: 'Нет топологической модели' };
        }

        const modelInfo = topologyManager.accumulator.getModelInfo();

        return {
            status: 'ok',
            hasTopology: true,
            modelId: topologyManager.accumulator.currentModelId,
            nodes: modelInfo?.stats?.nodes || 0,
            edges: modelInfo?.stats?.edges || 0,
            photoOriented: true
        };
    }

    // ==================== ОТПРАВКА В TELEGRAM ====================

    async sendTopologyTelegram(userId, decision, similarity, visualizationData,
                              vizPath, bot, chatId, topologicalResult) {
        console.log(`🤖 Отправляю топологический результат в Telegram...`);

        try {
            const cleanMarkdown = (text) => text
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/__/g, '')
                .replace(/_/g, '')
                .replace(/`/g, '')
                .replace(/\[/g, '(')
                .replace(/\]/g, ')');

            if (vizPath && fs.existsSync(vizPath)) {
                let caption = `🎯 ФОТО-ОРИЕНТИРОВАННЫЙ ТОПОЛОГИЧЕСКИЙ АНАЛИЗ\n\n`;

                caption += `📊 Решение: ${decision === 'same_footprint' || decision === 'same_footprint_enhanced' ? '✅ ОДНА ОБУВЬ' : '🆕 РАЗНАЯ ОБУВЬ'}\n`;
                caption += `📈 Сходство: ${(similarity * 100).toFixed(1)}%\n`;

                if (visualizationData && visualizationData.stats) {
                    caption += `\n📊 ТОПОЛОГИЧЕСКАЯ МОДЕЛЬ:\n`;
                    caption += `├─ Узлов: ${visualizationData.stats.totalNodes}\n`;
                    caption += `├─ Рёбер: ${visualizationData.stats.totalEdges}\n`;
                    caption += `├─ 🔴 3+ подтверждений: ${visualizationData.stats.confirmed3}\n`;
                    caption += `├─ 🟠 2 подтверждения: ${visualizationData.stats.confirmed2}\n`;
                    caption += `├─ 🔵 1 подтверждение: ${visualizationData.stats.confirmed1}\n`;
                    caption += `└─ ⚪ Новые узлы: ${visualizationData.stats.confirmed0}\n`;
                }

                if (topologicalResult) {
                    caption += `\n🔍 СОВПАДЕНИЯ:\n`;
                    caption += `├─ Точных совпадений: ${topologicalResult.exactMatches || 0}\n`;
                    caption += `└─ Новых узлов добавлено: ${topologicalResult.newNodesAdded || 0}\n`;
                }

                caption += `\n🏗️ Метод: Фото-ориентированная триангуляция Делоне + Weisfeiler-Lehman`;

                await bot.sendPhoto(chatId, vizPath, {
                    caption: cleanMarkdown(caption),
                    parse_mode: 'HTML'
                });

                console.log('✅ Топологическая визуализация отправлена в Telegram');
                return true;
            }
        } catch (error) {
            console.log('❌ Ошибка отправки в Telegram:', error.message);
        }

        return false;
    }
}

module.exports = SimpleFootprintManager;
