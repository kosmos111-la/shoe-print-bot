// modules/footprint/simple-manager.js
// 🔥 ИНТЕГРИРУЕМ ТОПОЛОГИЧЕСКУЮ СИСТЕМУ

const fs = require('fs');
const path = require('path');

// 🔥 НОВЫЙ ИМПОРТ: Топологический менеджер
const TopologyManager = require('./topology/TopologyManager');

// 🔥 ОСТАЛЬНЫЕ МОДУЛИ (минимальный набор)
const TemplateCoordination = require('./core/comparison/template-coordination');
const SessionManager = require('./core/session/session-manager');
const GeometryUtils = require('./core/utils/geometry-utils');
const LogManager = require('./core/log-manager');
const SimpleGraph = require('./simple-graph');

class SimpleFootprintManager {
    constructor(options = {}) {
        console.log('🚀 SimpleFootprintManager с ТОПОЛОГИЧЕСКОЙ СИСТЕМОЙ');
       
        // 🔥 НАСТРОЙКИ (с акцентом на топологию)
        const {
            dbPath = './data/footprints',
            autoAlignment = false, // 🔥 ОТКЛЮЧАЕМ автоматическое выравнивание
            autoSave = true,
            debug = false,
            usePointTracker = true,
            enableTopology = true, // 🔥 ВКЛЮЧАЕМ топологию
            enableMergeVisualization = true,
            topologySimilarityThreshold = 0.6, // 60% для "одинаковые"
            minPointsForFootprint = 5,
            enableCoordinateDiagnostics = false, // 🔥 ОТКЛЮЧАЕМ диагностику координат
            useLegacyVectorAlgorithm = false, // 🔥 ОТКЛЮЧАЕМ старый векторный алгоритм
            ...otherOptions
        } = options;
       
        this.config = {
            dbPath,
            autoAlignment,
            autoSave,
            debug,
            usePointTracker,
            enableTopology, // 🔥 КЛЮЧЕВАЯ НАСТРОЙКА
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
            comparisonAlgorithm: 'topological_delaunay_wl' // 🔥 НОВЫЙ АЛГОРИТМ
        };
       
        this.ensureDirectories();
        this.loadExistingModels();
       
        // 🔥 ПОРОГИ РЕШЕНИЙ ДЛЯ ТОПОЛОГИИ
        this.DECISION_THRESHOLDS = {
            TOPOLOGY_SIMILARITY: this.config.topologySimilarityThreshold, // 60%
            MIN_MATCHES: 3,
            MIN_POINTS: 3
        };
       
        console.log(`🎯 Топологические пороги: сходство >${this.DECISION_THRESHOLDS.TOPOLOGY_SIMILARITY}`);
       
        // 🔥 Логирование
        this.log = new LogManager(this);
        if (options.logLevel) this.log.setLevel(options.logLevel);
       
        console.log('✅ SimpleFootprintManager инициализирован с ТОПОЛОГИЧЕСКОЙ системой');
    }
   
    // 🔥 ГЛАВНЫЙ МЕТОД: Добавление фото в сессию (ТОПОЛОГИЧЕСКИЙ)
    async addPhotoToSession(userId, analysis, photoInfo = {}, bot = null, chatId = null) {
        console.log(`\n📸 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА фото для пользователя ${userId}`);
       
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
           
            // 🔥 Создание/получение SimpleFootprint
            const SimpleFootprint = require('./simple-footprint');
            const session = this.getOrCreateSession(userId);
           
            let footprint;
            if (!session.currentFootprint) {
                // Первое фото - создаем новый след
                footprint = new SimpleFootprint({
                    userId: userId,
                    name: `Отпечаток_${new Date().toLocaleDateString('ru-RU')}`,
                    transformation: null // 🔥 НЕ ИСПОЛЬЗУЕМ ТРАНСФОРМАЦИИ
                });
                session.currentFootprint = footprint;
                console.log(`👣 Создан новый след: "${footprint.name}"`);
            } else {
                footprint = session.currentFootprint;
                console.log(`👣 Использую существующий след: "${footprint.name}"`);
            }
           
            // 🔥 ДОБАВЛЯЕМ АНАЛИЗ В СЛЕД (честные подтверждения)
            const addResult = footprint.addAnalysisHonest(analysis, {
                ...photoInfo,
                photoId: photoInfo.photoId || `photo_${Date.now()}`,
                source: photoInfo.source || 'telegram_bot',
                transformationInfo: null // 🔥 БЕЗ ТРАНСФОРМАЦИЙ
            });
           
            console.log(`📈 В след добавлено: ${addResult.added} узлов, всего: ${footprint.graph.nodes.size}`);
           
            // 🔥 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА
            let topologicalResult = null;
            let decision = 'unknown';
            let similarity = 0;
           
            if (this.config.enableTopology) {
                topologicalResult = await this.processTopologically(
                    userId, footprint, analysis, photoInfo
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
                           
                            // Создаем временный footprint для визуализации
                            const tempFootprint = {
                                id: `viz_${footprint.id}`,
                                name: `Топология_${footprint.name}`,
                                pointTracker: {
                                    points: new Map(
                                        visualizationData.points.map(p => [p.id, {
                                            x: p.x,
                                            y: p.y,
                                            rating: p.confidence || 0.5,
                                            confirmedCount: p.vizData?.confirmations || 1,
                                            color: p.vizData?.color,
                                            size: p.vizData?.size
                                        }])
                                    )
                                },
                                getTransformation: () => ({ rotationAngle: 0 })
                            };
                           
                            const vizResult = await visualizer.visualizeSingleFootprintConfirmations(
                                tempFootprint,
                                {
                                    matchInfo: {
                                        totalConfirmations: visualizationData.stats.totalNodes,
                                        averageConfirmations: visualizationData.stats.avgDegree || 1,
                                        totalGraphs: 1
                                    },
                                    filename: `topology_${userId}_${Date.now()}.png`
                                }
                            );
                           
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
                nodesAdded: addResult.added,
                totalNodes: footprint.graph.nodes.size,
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
                    newNodesAdded: topologicalResult.newNodesAdded || 0
                };
            }
           
            console.log(`📊 ИТОГОВЫЙ РЕЗУЛЬТАТ:`);
            console.log(`   Узлов в следе: ${result.totalNodes}`);
            console.log(`   Топологическое решение: ${result.topologicalDecision}`);
            console.log(`   Сходство: ${(result.topologicalSimilarity * 100).toFixed(1)}%`);
           
            return result;
           
        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }
   
    // 🔥 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА
    async processTopologically(userId, footprint, analysis, photoInfo) {
        try {
            // Получаем или создаем TopologyManager для пользователя
            const topologyManager = this.getOrCreateTopologyManager(userId);
           
            // Обрабатываем след через топологическую систему
            const result = await topologyManager.processFootprint(
                footprint, analysis, photoInfo
            );
           
            if (!result.success) {
                console.log(`⚠️ Топологическая обработка не удалась: ${result.error}`);
                return {
                    decision: 'topology_failed',
                    similarity: 0,
                    modelId: null
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
                modelInfo: result.modelInfo
            };
           
        } catch (error) {
            console.log(`❌ Ошибка топологической обработки: ${error.message}`);
            return {
                decision: 'topology_error',
                similarity: 0,
                error: error.message
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
   
    // 🔥 СРАВНЕНИЕ СЛЕДОВ (ТОПОЛОГИЧЕСКОЕ)
    async compareFootprints(footprint1, footprint2, options = {}) {
        console.log(`🔍 ТОПОЛОГИЧЕСКОЕ СРАВНЕНИЕ следов`);
       
        try {
            // Определяем userId (берем из первого следа)
            const userId = footprint1.userId || footprint2.userId || 'default';
           
            // Получаем TopologyManager
            const topologyManager = this.getOrCreateTopologyManager(userId);
           
            // Выполняем топологическое сравнение
            const result = await topologyManager.compareFootprints(
                footprint1, footprint2, options
            );
           
            console.log(`🎯 РЕЗУЛЬТАТ: ${result.decision.toUpperCase()} (${(result.similarity * 100).toFixed(1)}%)`);
           
            return result;
           
        } catch (error) {
            console.error(`❌ Ошибка топологического сравнения: ${error.message}`);
            return {
                similar: false,
                similarity: 0,
                decision: 'different',
                error: error.message,
                method: 'topology_error'
            };
        }
    }
   
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ (без изменений)
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
        let session = this.sessionManager.getActiveSession(userId);
        if (!session) {
            session = this.sessionManager.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);
        }
        return session;
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
                let caption = `🎯 ТОПОЛОГИЧЕСКИЙ АНАЛИЗ\n\n`;
               
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
               
                caption += `\n🏗️ Метод: Триангуляция Делоне + Weisfeiler-Lehman`;
               
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
            algorithm: 'Топологический (Делоне + Weisfeiler-Lehman)',
            config: {
                enableTopology: this.config.enableTopology,
                topologySimilarityThreshold: this.config.topologySimilarityThreshold,
                useLegacyVectorAlgorithm: this.config.useLegacyVectorAlgorithm
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
            path.join(this.config.dbPath, 'visualizations/topology'), // 🔥 НОВАЯ ПАПКА
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
}

module.exports = SimpleFootprintManager;
