// modules/footprint/simple-manager.js
// 🔥 ИНТЕГРИРУЕМ ТОПОЛОГИЧЕСКУЮ СИСТЕМУ (ИСПРАВЛЕННАЯ ВЕРСИЯ)

const fs = require('fs');
const path = require('path');

// 🔥 ИСПРАВЛЕННЫЕ ИМПОРТЫ
const TopologyManager = require('./topology/TopologyManager');
const SimpleFootprint = require('./simple-footprint'); // 🔥 НОВЫЙ ИМПОРТ

// 🔥 ОСТАЛЬНЫЕ МОДУЛИ (минимальный набор)
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
            usePointTracker = false, // 🔥 ИЗМЕНЕНИЕ: отключаем
            enableTopology = true,
            enableMergeVisualization = true,
            topologySimilarityThreshold = 0.7, // 70% для "одинаковые"
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
       
        // 🔥 ТОПОЛОГИЧЕСКИЙ МЕНЕДЖЕР (ОСНОВНОЙ ДВИЖОК)
        this.topologyManagers = new Map(); // userId -> TopologyManager
       
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
            comparisonAlgorithm: 'photo_oriented_topological' // 🔥 НОВОЕ
        };
       
        this.ensureDirectories();
        this.loadExistingModels();
       
        // 🔥 ПОРОГИ РЕШЕНИЙ ДЛЯ ТОПОЛОГИИ
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
   
    // 🔥 ГЛАВНЫЙ МЕТОД: Добавление фото в сессию (ИСПРАВЛЕННЫЙ)
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ФОТО-ОРИЕНТИРОВАННАЯ обработка фото для пользователя ${userId}`);
       
        try {
            if (!analysis?.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }
           
            // Извлечение точек из анализа
            const points = this.extractPointsFromAnalysis(analysis);
            if (points.length < this.config.minPointsForFootprint) {
                return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
            }
           
            console.log(`📊 Извлечено ${points.length} точек из анализа`);
           
            // 🔥 ИЗМЕНЕНИЕ: Создание/получение сессии с фото-ориентированным следом
            const session = this.getOrCreatePhotoSession(userId);
            const photoId = photoInfo.photoId || `photo_${Date.now()}`;
           
            let footprint;
            if (!session.currentFootprint) {
                // Первое фото - создаем новый фото-ориентированный след
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
            }
           
            // 🔥 ИЗМЕНЕНИЕ: Добавляем фото с отдельным хранением
            const addResult = footprint.addPhotoAnalysis(photoId, analysis, {
                ...photoInfo,
                photoId: photoId,
                source: photoInfo.source || 'telegram_bot',
                transformationInfo: null
            });
           
            console.log(`📈 Фото ${photoId} добавлено в след: ${addResult.points} точек`);
           
            // 🔥 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА (только текущее фото)
            let topologicalResult = null;
            let decision = 'unknown';
            let similarity = 0;
           
            if (this.config.enableTopology) {
                topologicalResult = await this.processTopologically(
                    userId, footprint, analysis, { ...photoInfo, photoId }
                );
               
                decision = topologicalResult.decision;
                similarity = topologicalResult.similarity || 0;
               
                console.log(`🎯 ТОПОЛОГИЧЕСКОЕ РЕШЕНИЕ: ${decision} (${(similarity * 100).toFixed(1)}%)`);
            }
           
            // 🔥 ВИЗУАЛИЗАЦИЯ (если включена)
            let visualizationData = null;
            let vizPath = null;
           
            if (this.config.enableMergeVisualization && this.visualizationManager) {
                try {
                    // Получаем данные для визуализации из топологической модели
                    const topologyManager = this.getTopologyManager(userId);
                    if (topologyManager) {
                        visualizationData = topologyManager.getAccumulativeVisualizationData();
                       
                        if (visualizationData) {
                            console.log(`🎨 Готовлю топологическую визуализацию...`);
                           
                            // Создаем визуализацию через ClusterVisualizer
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
                            }
                        }
                    }
                } catch (vizError) {
                    console.log(`⚠️ Ошибка топологической визуализации: ${vizError.message}`);
                }
            }
           
            // 🔥 ОТПРАВКА В TELEGRAM (если нужно)
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
           
            // Добавляем информацию о топологической обработке
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
   
    // 🔥 НОВЫЙ МЕТОД: Создание/получение сессии с фото-ориентированным следом
    getOrCreatePhotoSession(userId) {
        let session = this.sessionManager.getActiveSession(userId);
       
        if (!session) {
            session = this.sessionManager.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
           
            // 🔥 Создаем фото-ориентированный след
            const footprint = new SimpleFootprint({
                userId: userId,
                name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`
            });
           
            session.currentFootprint = footprint;
            console.log(`🆕 Создана сессия с фото-ориентированным следом для ${userId}`);
        }
       
        return session;
    }
   
    // 🔥 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА (исправленная)
    async processTopologically(userId, footprint, analysis, photoInfo) {
        try {
            // Получаем или создаем TopologyManager для пользователя
            const topologyManager = this.getOrCreateTopologyManager(userId);
           
            // 🔥 ИЗМЕНЕНИЕ: Передаем photoInfo с photoId
            const result = await topologyManager.processFootprint(
                footprint, analysis, photoInfo
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
           
            // Обновляем статистику
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
   
    // 🔥 ПОЛУЧИТЬ ИЛИ СОЗДАТЬ TOPOLOGY MANAGER
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
   
    // 🔥 ПОЛУЧИТЬ TOPOLOGY MANAGER
    getTopologyManager(userId) {
        return this.topologyManagers.get(userId);
    }
   
    // 🔥 СРАВНЕНИЕ СЛЕДОВ (предупреждение)
    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 СРАВНЕНИЕ ФОТО-ОРИЕНТИРОВАННЫХ следов`);
        console.log(`⚠️ ВНИМАНИЕ: Этот метод сравнивает аккумулированные точки`);
        console.log(`   Для точного сравнения используйте comparePhotoToModel()`);
       
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
   
    // 🔥 НОВЫЙ МЕТОД: Сравнение фото с моделью
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
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
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
                    _source: 'analysis'
                });
            }
        }
       
        return points.filter(p =>
            p && typeof p.x === 'number' && typeof p.y === 'number' &&
            !isNaN(p.x) && !isNaN(p.y)
        );
    }
   
    getOrCreateSession(userId) {
        console.log(`⚠️ Используется устаревший getOrCreateSession(), используйте getOrCreatePhotoSession()`);
        return this.getOrCreatePhotoSession(userId);
    }
   
    // 🔥 ОТПРАВКА В TELEGRAM (топологическая версия)
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
   
    // 🔥 СТАТИСТИКА СИСТЕМЫ (обновленная)
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
                photoOriented: true // 🔥 НОВОЕ
            }
        };
    }
   
    // 🔥 ОСТАЛЬНЫЕ МЕТОДЫ (для совместимости)
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
       
        // Загрузка существующих моделей (для совместимости)
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
   
    // 🔥 НОВЫЙ МЕТОД: Получить топологические данные для визуализации
    getTopologyVisualizationData(userId) {
        const topologyManager = this.getTopologyManager(userId);
        if (!topologyManager) {
            return null;
        }
       
        return topologyManager.getAccumulativeVisualizationData();
    }
   
    // 🔥 НОВЫЙ МЕТОД: Очистить топологические модели пользователя
    clearUserTopology(userId) {
        const topologyManager = this.getTopologyManager(userId);
        if (!topologyManager) {
            return { success: false, message: 'Топологический менеджер не найден' };
        }
       
        return topologyManager.clearUserModels();
    }

    // 🔥 СОВМЕСТИМОСТЬ СО СТАРЫМ КОДОМ (main.js)
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

    // 🔥 МЕТОД ДЛЯ ПРОСТОГО ДОБАВЛЕНИЯ АНАЛИЗА (совместимость с main.js)
    async addAnalysisToSession(userId, analysis, photoInfo = {}) {
        console.log(`👣 [Совместимость] addAnalysisToSession для ${userId}`);
       
        try {
            // Вызываем основной метод
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

    // 🔥 МЕТОД ДЛЯ ПОЛУЧЕНИЯ ВИЗУАЛИЗАЦИИ (совместимость с main.js)
    async getVisualizationForSession(userId, options = {}) {
        console.log(`🎨 [Совместимость] getVisualizationForSession для ${userId}`);
       
        try {
            // Проверяем наличие топологической модели
            const topologyManager = this.getTopologyManager(userId);
            if (!topologyManager) {
                return { success: false, error: 'Нет топологической модели' };
            }
           
            // Получаем данные для визуализации
            const topologyData = topologyManager.getAccumulativeVisualizationData();
            if (!topologyData) {
                return { success: false, error: 'Нет данных для визуализации' };
            }
           
            // Создаем визуализацию
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

    // 🔥 МЕТОД ДЛЯ ПОЛУЧЕНИЯ СТАТИСТИКИ СЕССИИ
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

    // 🔥 ОЧИСТКА СЕССИИ
    clearSession(userId) {
        console.log(`🧹 [Совместимость] Очистка сессии ${userId}`);
       
        // Очищаем сессию
        this.sessionManager.sessions.delete(userId);
       
        // Очищаем топологическую модель
        if (this.topologyManagers.has(userId)) {
            this.topologyManagers.delete(userId);
        }
       
        // Очищаем userSessions
        this.userSessions.delete(userId);
       
        return { success: true, message: `Сессия ${userId} очищена` };
    }

    // 🔥 МЕТОД ДЛЯ ПОЛУЧЕНИЯ ВСЕХ СЕССИЙ
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

    // 🔥 МЕТОД ДЛЯ ТЕСТИРОВАНИЯ (совместимость с main.js)
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
}

module.exports = SimpleFootprintManager;
