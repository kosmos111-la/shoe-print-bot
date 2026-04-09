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
const FeatureTable = require('./analysis/feature-table');
const ClusterAnalyzer = require('./analysis/ClusterAnalyzer');
const ModelVisualization = require('../visualization/model-viz');

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
            console.log(`   analysis есть? ${!!analysis}`);
            console.log(`   predictions есть? ${!!analysis?.predictions}`);
            console.log(`   predictions тип: ${typeof analysis?.predictions}`);


            if (analysis?.predictions && Array.isArray(analysis.predictions)) {
                console.log(`   predictions длина: ${analysis.predictions.length}`);
                if (analysis.predictions.length > 0) {
                    const firstPred = analysis.predictions[0];
                    console.log(`   Пример первого предсказания:`);
                    console.log(`     class: ${firstPred?.class}`);
                    console.log(`     confidence: ${firstPred?.confidence}`);
                    console.log(`     points есть? ${!!firstPred?.points}`);
                    console.log(`     points длина: ${firstPred?.points?.length || 0}`);
                }
            }


            if (!analysis?.predictions) {
                return { success: false, error: 'Нет данных анализа', nodesAdded: 0 };
            }


            // 🔥 ИЗВЛЕКАЕМ ТОЧКИ И КОНТУРЫ
            const { points, contours } = this.extractPointsAndContours(analysis);

// 🔥 НОВОЕ: считаем среднюю уверенность Roboflow из оригинальных предсказаний
let totalConfidence = 0;
let confidenceCount = 0;

// У confidence есть в оригинальных predictions из Roboflow
if (analysis.predictions && Array.isArray(analysis.predictions)) {
    for (const pred of analysis.predictions) {
        if (pred.confidence) {
            totalConfidence += pred.confidence;
            confidenceCount++;
        }
    }
}

const avgConfidence = confidenceCount > 0 ? (totalConfidence / confidenceCount * 100).toFixed(1) : 0;
console.log(`📸 Roboflow: обнаружено ${points.length} протекторов, средняя уверенность ${avgConfidence}%`);

// 🔥 СОХРАНЯЕМ avgConfidence ДЛЯ ПЕРЕДАЧИ В TELEGRAM
const avgConfidenceValue = parseFloat(avgConfidence) / 100;

if (points.length < this.config.minPointsForFootprint) {
    return { success: false, error: `Слишком мало точек: ${points.length}`, nodesAdded: 0 };
}

console.log(`📊 Извлечено ${points.length} точек и ${contours.length} контуров из анализа`);


            // 🔥 ПОЛУЧАЕМ ИЛИ СОЗДАЁМ ПЕСОЧНИЦУ (СЕССИЮ)
            let session = this.sessionManager?.getActiveSandboxSession(userId);

            // Если нет активной песочницы - создаём автоматически
            if (!session) {
                const isBatch = photoInfo.isBatch || false;
                const sessionName = isBatch ?
                    `Пакетная_${new Date().toLocaleTimeString('ru-RU')}` :
                    `Сессия_${new Date().toLocaleTimeString('ru-RU')}`;

                session = this.sessionManager?.createSandboxSession(userId, sessionName);
                console.log(`🆕 Создана новая песочница: ${session?.id}`);

                // 🔥 ВАЖНО: Создаём топологический менеджер СРАЗУ и сохраняем в сессию
                if (session && this.config.enableTopology) {
                    const topologyManager = new TopologyManager({
                        userId: userId,
                        name: session.name,
                        debug: this.config.debug,
                        similarityThreshold: this.config.topologySimilarityThreshold,
                        sandboxMode: false // false для накопления в рамках одной сессии!
                    });
                    session.topologyManager = topologyManager;
                    this.topologyManagers.set(userId, topologyManager);
                    console.log(`🎯 Создан TopologyManager для песочницы ${session.id}`);
                }
            }


            // 🔥 ДОБАВЛЯЕМ ФОТО В СЕССИЮ
            const photoId = photoInfo.photoId || `photo_${Date.now()}`;


            // Добавляем фото в историю сессии
            session.photos.push({
                photoId: photoId,
                points: points.length,
                timestamp: new Date(),
                batchIndex: photoInfo.batchIndex
            });


            // 🔥 ТОПОЛОГИЧЕСКАЯ ОБРАБОТКА
            let topologicalResult = null;
let decision = 'unknown';
let similarity = 0;

if (this.config.enableTopology) {
    // 🔥 ПОЛУЧАЕМ ТОПОЛОГИЧЕСКИЙ МЕНЕДЖЕР ИЗ СЕССИИ
    let topologyManager = session.topologyManager;

    // Если его нет - это первый раз, создаём (страховка)
    if (!topologyManager) {
        console.log(`🎯 Первое фото в сессии, создаю TopologyManager...`);
        topologyManager = new TopologyManager({
            userId: userId,
            name: session.name,
            debug: this.config.debug,
            similarityThreshold: this.config.topologySimilarityThreshold,
            sandboxMode: false
        });
        session.topologyManager = topologyManager;
        this.topologyManagers.set(userId, topologyManager);
    } else {
        console.log(`🔄 Использую существующий TopologyManager для сессии`);
    }

    // 🔥 ПЕРЕДАЁМ И ТОЧКИ, И КОНТУРЫ
    topologicalResult = await topologyManager.processFootprint(
        { id: `sandbox_${session.id}` },
        { points, contours },
        { ...photoInfo, photoId, sandboxId: session.id }
    );

    // 🔥 СОХРАНЯЕМ ВАЖНЫЕ ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ
    const photoPoints = points; // точки прямо из анализа
    const photoContours = contours;

    decision = topologicalResult.decision;
    similarity = topologicalResult.similarity || 0;

    console.log(`🎯 ТОПОЛОГИЧЕСКОЕ РЕШЕНИЕ В ПЕСОЧНИЦЕ: ${decision} (${(similarity * 100).toFixed(1)}%)`);

    // 🔥 ДОБАВЛЯЕМ ДАННЫЕ В РЕЗУЛЬТАТ
    topologicalResult.photoPoints = photoPoints;
topologicalResult.photoContours = photoContours;
topologicalResult.transform = topologicalResult.topologicalResult?.transform;
topologicalResult.avgConfidence = avgConfidenceValue;  // 🔥 ДОБАВИТЬ
// 🔥 ДИАГНОСТИКА КОНТУРОВ В PHOTOCONTOURS
console.log(`\n📐 ДИАГНОСТИКА photoContours:`);
console.log(`   photoContours.length: ${photoContours?.length || 0}`);
if (photoContours) {
    const outline = photoContours.find(c => c.class === 'Outline-trail' || c.type === 'footprint_outline');
    if (outline) {
        console.log(`   ✅ outline в photoContours: ЕСТЬ, точек: ${outline.points?.length || 0}`);
    } else {
        console.log(`   ⚠️ outline в photoContours: НЕТ`);
        console.log(`   Доступные классы: ${photoContours.map(c => c.class).join(', ')}`);
    }
}
    // Сохраняем текущую модель в сессии
    session.currentFootprint = topologyManager.accumulator.getModelInfo();
}


            // 🔥 ВИЗУАЛИЗАЦИЯ
let visualizationData = null;
let modelVizPath = null;
let photoVizPath = null;

  // ========== ДИАГНОСТИКА ПЕРЕД ВИЗУАЛИЗАЦИЕЙ ==========
console.log(`\n🔍 ПЕРЕД ТОПОЛОГИЧЕСКОЙ ВИЗУАЛИЗАЦИЕЙ:`);
const topologyManagerCheck = this.getTopologyManager(userId);
if (topologyManagerCheck) {
    const model = topologyManagerCheck.accumulator.getCurrentModel();
    if (model && model.graph) {
        let red = 0, orange = 0, yellow = 0, blue = 0;
        for (const node of model.graph.nodes.values()) {
            const count = node.confirmationCount || 0;
            if (count >= 4) red++;
            else if (count === 3) orange++;
            else if (count === 2) yellow++;
            else if (count === 1) blue++;
        }
        console.log(`   Состояние модели ПЕРЕД визуализацией: красных ${red}, оранж ${orange}, жёлт ${yellow}, син ${blue}`);
        console.log(`   Всего узлов: ${model.graph.nodes.size}`);
    }
}
// ========== КОНЕЦ ДИАГНОСТИКИ ==========        

if (this.config.enableMergeVisualization && this.visualizationManager) {
    try {
        const topologyManager = this.getTopologyManager(userId);
        if (topologyManager) {
            // Получаем данные для визуализации
            visualizationData = topologyManager.getAccumulativeVisualizationData();


            // 🔥 ИЩЕМ matchMap
            let matchMap = null;

            if (topologicalResult && topologicalResult.matchMap) {
                matchMap = topologicalResult.matchMap;
                console.log(`🔍 matchMap найден напрямую: ${matchMap.size} пар`);
            } else if (topologicalResult && topologicalResult.topologicalResult && topologicalResult.topologicalResult.matchMap) {
                matchMap = topologicalResult.topologicalResult.matchMap;
                console.log(`🔍 matchMap найден во вложенном объекте: ${matchMap.size} пар`);
            }


            // 🔥 СОЗДАЁМ ДАННЫЕ ДЛЯ ФОТО
            if (matchMap && visualizationData) {
                const photoPoints = [];
                for (const [photoId, match] of matchMap) {
                    const photoPoint = points.find(p => p.id === photoId);
                    if (photoPoint) {
                        photoPoints.push({
                            id: photoId,
                            x: photoPoint.x,
                            y: photoPoint.y,
                            confidence: 1.0
                        });
                    } else {
                        const modelPoint = visualizationData.points.find(p => p.id === match.modelId);
                        if (modelPoint) {
                            photoPoints.push({
                                id: photoId,
                                x: modelPoint.x,
                                y: modelPoint.y,
                                confidence: 1.0
                            });
                        }
                    }
                }

                // 🔥 СОЗДАЁМ ОТДЕЛЬНЫЕ ДАННЫЕ ДЛЯ ФОТО
                const photoVisualizationData = {
                    ...visualizationData,
                    points: photoPoints,
                    matchMap: matchMap,
                    isPhotoView: true
                };

                visualizationData.photoPoints = photoPoints;
                visualizationData.matchMap = matchMap;

                console.log(`✅ matchMap добавлен: ${matchMap.size} пар`);
                console.log(`✅ photoPoints создано: ${photoPoints.length} точек`);
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


                // 🔥 СОЗДАЁМ ДВЕ ВИЗУАЛИЗАЦИИ
                const baseFilename = `topology_${userId}_${Date.now()}`;

                // 🔥 ДИАГНОСТИКА ПЕРЕД ВЫЗОВОМ
console.log(`\n🔍 ПЕРЕД ВИЗУАЛИЗАЦИЕЙ:`);
console.log(`   visualizationData.outlineContour: ${visualizationData.outlineContour ? 'ЕСТЬ' : 'НЕТ'}`);
if (visualizationData.outlineContour) {
    console.log(`   points: ${visualizationData.outlineContour.points?.length || 0}`);
    console.log(`   class: ${visualizationData.outlineContour.class}`);
}

const vizResult = await visualizer.visualizeTopologicalModel(visualizationData, {
    filename: `${baseFilename}.png`
});


                if (vizResult && vizResult.modelPath) {
                    modelVizPath = vizResult.modelPath;
                    photoVizPath = vizResult.photoPath;

                    console.log(`✅ Модель сохранена: ${modelVizPath}`);
                    console.log(`✅ Фото сохранено: ${photoVizPath}`);
                }
            }
        }
    } catch (vizError) {
        console.log(`⚠️ Ошибка топологической визуализации: ${vizError.message}`);
    }
}


// 🔥 ОТПРАВКА В TELEGRAM - ОТПРАВЛЯЕМ ОБЕ КАРТИНКИ
let telegramSent = false;
if (bot && chatId) {
    if (modelVizPath || photoVizPath) {
        telegramSent = await this.sendTopologyTelegram(
            userId,
            decision,
            similarity,
            visualizationData,
            modelVizPath,
            photoVizPath,
            bot,
            chatId,
            topologicalResult
        );
    } else {
        console.log('⚠️ Нет визуализаций для отправки');
        telegramSent = true;
    }
}

// ==================== 🔥 ИСПРАВЛЕНИЕ ЗДЕСЬ ====================
// ВИЗУАЛИЗАЦИЯ МОДЕЛИ С НАЛОЖЕНИЕМ ТРАНСФОРМИРОВАННОГО ФОТО

if (this.config.enableMergeVisualization && bot && chatId && topologicalResult && topologicalResult.success) {

 // ========== ДИАГНОСТИКА ПЕРЕД ЧИСТОЙ МОДЕЛЬЮ ==========
    console.log(`\n🔍 ПЕРЕД ВИЗУАЛИЗАЦИЕЙ ЧИСТОЙ МОДЕЛИ:`);
    const topologyManagerCheck2 = this.getTopologyManager(userId);
    if (topologyManagerCheck2) {
        const model = topologyManagerCheck2.accumulator.getCurrentModel();
        if (model && model.graph) {
            let red = 0, orange = 0, yellow = 0, blue = 0;
            for (const node of model.graph.nodes.values()) {
                const count = node.confirmationCount || 0;
                if (count >= 4) red++;
                else if (count === 3) orange++;
                else if (count === 2) yellow++;
                else if (count === 1) blue++;
            }
            console.log(`   Состояние модели ПЕРЕД чистой визуализацией: красных ${red}, оранж ${orange}, жёлт ${yellow}, син ${blue}`);
        }
    }
    // ========== КОНЕЦ ДИАГНОСТИКИ ==========
  
    try {
        console.log('\n🏗️ СОЗДАЮ ВИЗУАЛИЗАЦИЮ ЧИСТОЙ МОДЕЛИ...');

        const topologyManager = this.getTopologyManager(userId);
        if (!topologyManager) {
            console.log('⚠️ Нет топологического менеджера для визуализации модели');
        } else {
            const modelInfo = topologyManager.accumulator.getCurrentModel();
            if (!modelInfo) {
                console.log('⚠️ Нет текущей модели для визуализации');
            } else {
                // 🔥 ПОЛУЧАЕМ ВСЕ НЕОБХОДИМЫЕ ДАННЫЕ
                const transform = modelInfo.transform || topologicalResult.transform;
                const matchMap = topologicalResult.matchMap ||
                                (topologicalResult.topologicalResult?.matchMap) ||
                                new Map();

                console.log(`\n📊 ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ:`);
                console.log(`   • Точек модели: ${modelInfo.graph.nodes.size}`);
                console.log(`   • Соответствий: ${matchMap.size}`);

                // Подготавливаем точки модели с номерами пар
                const points = Array.from(modelInfo.graph.nodes.values()).map(node => {
                    let pairNumber = null;
                    let status = null;

                    // Ищем номер пары в matchMap
                    for (const [photoId, match] of matchMap) {
                        if (match.modelId === node.id && match.pairNumber) {
                            pairNumber = match.pairNumber;
                            status = match.status;
                            break;
                        }
                    }

                    return {
                        id: node.id,
                        x: node.x,
                        y: node.y,
                        confirmationCount: node.confirmationCount || 0,
                        pairNumber: pairNumber,
                        status: status
                    };
                });

                const edges = Array.from(modelInfo.graph.edges);

                // 🔥 СОЗДАЁМ временный файл
                const tempDir = path.join(__dirname, '../../temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                const outputPath = path.join(tempDir, `model_clean_${Date.now()}.png`);

                // 🔥 ИМПОРТИРУЕМ визуализатор
                const ModelVisualization = require('../visualization/model-viz');
                const modelViz = new ModelVisualization();

                // 🔥 ПЕРЕДАЁМ ТОЛЬКО МОДЕЛЬ (БЕЗ ФОТО)
                // Получаем структуры из visualizationData
let structures = visualizationData?.structures || [];
// Нормализуем структуры — гарантируем, что pointIds это массив
structures = structures.map(s => ({
    ...s,
    pointIds: Array.isArray(s.pointIds) ? s.pointIds : [],
    triangles: s.triangles || []
}));
const triangles = visualizationData?.triangles || [];
const pointToStructure = visualizationData?.pointToStructure || new Map();

console.log(`   • triangles из visualizationData: ${triangles.length}`);
if (triangles.length > 0) {
    console.log(`   • Первый треугольник: p1=${triangles[0]?.p1?.id?.substring(0,20)}`);
}
console.log(`   🔍 pointToStructure из visualizationData: ${pointToStructure.size} записей`);

const modelImagePath = await modelViz.createVisualization({
    points: points,
    photoPoints: [],
    transform: transform,
    matches: matchMap,
    edges: edges,
    triangles: triangles,
    structures: structures,
    pointToStructure: pointToStructure,
    outputPath: outputPath,
    width: 1200,
    height: 1000
});

                if (modelImagePath && fs.existsSync(modelImagePath)) {
                    console.log(`\n✅ Чистая модель сохранена: ${modelImagePath}`);

                    // Отправляем в Telegram
                    await bot.sendPhoto(chatId, modelImagePath, {
                        caption:
                            `🏗️ **ИТОГОВАЯ МОДЕЛЬ (${points.length} точек)**\n\n` +
                            `📊 **СТАТИСТИКА:**\n` +
                            `• Подтвержденных: ${points.filter(p => p.confirmationCount >= 2).length}\n` +
                            `• Новых (1 подтверждение): ${points.filter(p => p.confirmationCount === 1).length}\n` +
                            `• Без подтверждений: ${points.filter(p => !p.confirmationCount).length}\n\n` +
                            `🟡 **Жёлтые** - подтверждённые точки\n` +
                            `🔵 **Синие** - новые точки (ждут подтверждения)\n\n` +
                            `✅ Модель готова к сравнению с новыми фото!`
                    });

                    // Удаляем через минуту
                    setTimeout(() => {
                        if (fs.existsSync(modelImagePath)) {
                            fs.unlinkSync(modelImagePath);
                            console.log(`🧹 Удалён временный файл: ${modelImagePath}`);
                        }
                    }, 60000);
                } else {
                    console.log('⚠️ Не удалось создать визуализацию чистой модели');
                }
            }
        }
    } catch (modelVizError) {
        console.log(`⚠️ Ошибка визуализации чистой модели: ${modelVizError.message}`);
        console.log(modelVizError.stack);
    }
}
          if (this.config.enableMergeVisualization && bot && chatId && topologicalResult && topologicalResult.success) {

         // ========== ДИАГНОСТИКА ПЕРЕД НАЛОЖЕНИЕМ ==========
    console.log(`\n🔍 ПЕРЕД ВИЗУАЛИЗАЦИЕЙ С НАЛОЖЕНИЕМ:`);
    const topologyManagerCheck3 = this.getTopologyManager(userId);
    if (topologyManagerCheck3) {
        const model = topologyManagerCheck3.accumulator.getCurrentModel();
        if (model && model.graph) {
            let red = 0, orange = 0, yellow = 0, blue = 0;
            for (const node of model.graph.nodes.values()) {
                const count = node.confirmationCount || 0;
                if (count >= 4) red++;
                else if (count === 3) orange++;
                else if (count === 2) yellow++;
                else if (count === 1) blue++;
            }
            console.log(`   Состояние модели ПЕРЕД наложением: красных ${red}, оранж ${orange}, жёлт ${yellow}, син ${blue}`);
        }
    }
    // ========== КОНЕЦ ДИАГНОСТИКИ ==========   
            
    try {
        console.log('\n🏗️ СОЗДАЮ ВИЗУАЛИЗАЦИЮ С НАЛОЖЕНИЕМ ТРАНСФОРМИРОВАННОГО ФОТО...');
       
        const topologyManager = this.getTopologyManager(userId);
        if (!topologyManager) {
            console.log('⚠️ Нет топологического менеджера для визуализации модели');
        } else {
            const modelInfo = topologyManager.accumulator.getCurrentModel();
            if (!modelInfo) {
                console.log('⚠️ Нет текущей модели для визуализации');
            } else {
                // 🔥 ПОЛУЧАЕМ ВСЕ НЕОБХОДИМЫЕ ДАННЫЕ
                const transform = modelInfo.transform || topologicalResult.transform;
                const photoPoints = topologicalResult.photoPoints || [];
                const matchMap = topologicalResult.matchMap ||
                                (topologicalResult.topologicalResult?.matchMap) ||
                                new Map();
               
                console.log(`\n📊 ДАННЫЕ ДЛЯ ВИЗУАЛИЗАЦИИ:`);
                console.log(`   • Точек модели: ${modelInfo.graph.nodes.size}`);
                console.log(`   • Точек фото: ${photoPoints.length}`);
                console.log(`   • Соответствий: ${matchMap.size}`);
                console.log(`   • Трансформация: ${transform ? '✅ ЕСТЬ' : '❌ НЕТ'}`);
               
                if (!transform) {
                    console.log('⚠️ Трансформация отсутствует! Наложение невозможно');
                    return;
                }

                if (transform) {
                    console.log(`\n🔄 ПАРАМЕТРЫ ТРАНСФОРМАЦИИ:`);
                    console.log(`   • Масштаб: ${transform.scale.toFixed(3)}`);
                    console.log(`   • Поворот: ${(transform.rotation * 180 / Math.PI).toFixed(1)}°`);
                    console.log(`   • Сдвиг: (${transform.translation.x.toFixed(1)}, ${transform.translation.y.toFixed(1)})`);
                }
               
                // Подготавливаем точки модели с номерами пар
                const points = Array.from(modelInfo.graph.nodes.values()).map(node => {
                    let pairNumber = null;
                    let status = null;
                   
                    // Ищем номер пары в matchMap
                    for (const [photoId, match] of matchMap) {
                        if (match.modelId === node.id && match.pairNumber) {
                            pairNumber = match.pairNumber;
                            status = match.status;
                            break;
                        }
                    }
                   
                    return {
                        id: node.id,
                        x: node.x,
                        y: node.y,
                        confirmationCount: node.confirmationCount || 0,
                        pairNumber: pairNumber,
                        status: status
                    };
                });
               
                const edges = Array.from(modelInfo.graph.edges);
               
                // 🔥 СОЗДАЁМ временный файл
                const tempDir = path.join(__dirname, '../../temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                const outputPath = path.join(tempDir, `model_overlay_${Date.now()}.png`);
               
                // 🔥 ИМПОРТИРУЕМ визуализатор
                const ModelVisualization = require('../visualization/model-viz');
                const modelViz = new ModelVisualization();
               
                // 🔥 ПЕРЕДАЁМ ВСЕ ДАННЫЕ
// 🔥 ДИАГНОСТИКА ПЕРЕД ВЫЗОВОМ
console.log(`\n📐 ПЕРЕД ВИЗУАЛИЗАЦИЕЙ С НАЛОЖЕНИЕМ:`);
console.log(`   visualizationData.outlineContour: ${visualizationData?.outlineContour ? 'ЕСТЬ' : 'НЕТ'}`);
if (visualizationData?.outlineContour) {
    console.log(`      точек: ${visualizationData.outlineContour.points?.length || 0}`);
}
console.log(`   topologicalResult.photoContours: ${topologicalResult?.photoContours?.length || 0}`);
if (topologicalResult?.photoContours) {
    const outlinePhoto = topologicalResult.photoContours.find(c => c.class === 'Outline-trail');
    console.log(`      outline в photoContours: ${outlinePhoto ? 'ЕСТЬ' : 'НЕТ'}, точек: ${outlinePhoto?.points?.length || 0}`);
}

const modelImagePath = await modelViz.createVisualization({
    points: points,
    photoPoints: photoPoints,
    transform: transform,
    matches: matchMap,
    edges: edges,
    outlineContour: visualizationData?.outlineContour,                              // 🔥 КОНТУР МОДЕЛИ
    photoOutlineContour: topologicalResult?.photoContours?.find(c => c.class === 'Outline-trail'), // 🔥 КОНТУР ФОТО
    outputPath: outputPath,
    width: 1200,
    height: 1000
});
               
                if (modelImagePath && fs.existsSync(modelImagePath)) {
                    console.log(`\n✅ Визуализация с наложением создана: ${modelImagePath}`);
                   
                    // Отправляем в Telegram
                    await bot.sendPhoto(chatId, modelImagePath, {
                        caption:
                            `🏗️ **НАЛОЖЕНИЕ ФОТО НА МОДЕЛЬ**\n\n` +
                            `📊 **СТАТИСТИКА:**\n` +
                            `• Точек модели: ${points.length}\n` +
                            `• Точек фото: ${photoPoints.length}\n` +
                            `• Совпало: ${matchMap.size}\n\n` +
                            `🟡 **Жёлтые** - точки модели\n` +
                            `🟣 **Фиолетовые** - точки фото ПОСЛЕ трансформации\n` +
                            `🔵 **Полупрозрачные** - точки фото без пары\n\n` +
                            `🔄 **Трансформация фото:**\n` +
                            `• Масштаб: ${transform.scale.toFixed(3)}\n` +
                            `• Поворот: ${(transform.rotation * 180 / Math.PI).toFixed(1)}°\n` +
                            `• Сдвиг: (${transform.translation.x.toFixed(0)}, ${transform.translation.y.toFixed(0)})`
                    });
                   
                    // Удаляем через минуту
                    setTimeout(() => {
                        if (fs.existsSync(modelImagePath)) {
                            fs.unlinkSync(modelImagePath);
                            console.log(`🧹 Удалён временный файл: ${modelImagePath}`);
                        }
                    }, 60000);
                } else {
                    console.log('⚠️ Не удалось создать визуализацию с наложением');
                }
            }
        }
    } catch (modelVizError) {
        console.log(`⚠️ Ошибка визуализации с наложением: ${modelVizError.message}`);
        console.log(modelVizError.stack);
    }
}

// 🔥 ФОРМИРУЕМ РЕЗУЛЬТАТ
const result = {
    success: true,
    footprintId: session.id,
    photoId: photoId,
    nodesAdded: points.length,
    totalPhotos: session.photos.length,
    topologicalDecision: decision,
    topologicalSimilarity: similarity,
    hasTopology: this.config.enableTopology,
    visualizationPath: modelVizPath || photoVizPath || null,
    telegramSent: telegramSent,
    mode: 'sandbox',
    // 🔥 ДОБАВИТЬ:
    similarity: similarity,      // для совместимости
    decision: decision,          // для совместимости
    mergeMethod: topologicalResult?.status,
    mergeVisualization: modelVizPath || photoVizPath
};


            if (topologicalResult) {
                result.topologicalResult = {
                    modelId: topologicalResult.modelId,
                    exactMatches: topologicalResult.exactMatches || 0,
                    newNodesAdded: topologicalResult.newNodesAdded || 0,
                    status: topologicalResult.status
                };
            }


            console.log(`📊 ИТОГОВЫЙ РЕЗУЛЬТАТ В ПЕСОЧНИЦЕ:`);
            console.log(`   Фото ID: ${photoId}`);
            console.log(`   Фото в сессии: ${result.totalPhotos}`);
            console.log(`   Топологическое решение: ${result.topologicalDecision}`);
            console.log(`   Сходство: ${(result.topologicalSimilarity * 100).toFixed(1)}%`);


            return result;


        } catch (error) {
            console.log(`❌ Ошибка в addPhotoToSession: ${error.message}`);
            console.error(error);
            return { success: false, error: error.message, nodesAdded: 0 };
        }
    }


    // ==================== НОВЫЙ МЕТОД: ЗАВЕРШЕНИЕ СЕССИИ ====================


    /**
     * Завершить сессию с сохранением и сравнением
     */
    async endSession(userId, options = {}) {
        console.log(`\n🏁 Завершение сессии для пользователя ${userId}`);

        // Получаем активную песочницу
        const sandbox = this.sessionManager?.getActiveSandboxSession(userId);
        if (!sandbox) {
            return { success: false, error: 'Нет активной сессии' };
        }


        const result = {
            sandboxId: sandbox.id,
            name: sandbox.name,
            createdAt: sandbox.createdAt,
            duration: (Date.now() - sandbox.createdAt) / 1000,
            photosCount: sandbox.photos.length,
            hasModel: !!sandbox.currentFootprint,
            modelStats: sandbox.currentFootprint?.stats || { nodes: 0, edges: 0 }
        };


        // 🔥 СРАВНЕНИЕ С БАЗОЙ ПОСТОЯННЫХ МОДЕЛЕЙ
        let comparisonResults = null;
        if (options.compare && sandbox.currentFootprint) {
            console.log(`🔍 Сравниваю модель из сессии с базой...`);

            const permanentModels = this.getPermanentModels(userId);
            comparisonResults = [];

            for (const permModel of permanentModels) {
                const similarity = this.compareWithPermanentModel(
                    sandbox.currentFootprint,
                    permModel.model
                );

                if (similarity >= (options.threshold || 0.6)) {
                    comparisonResults.push({
                        modelId: permModel.id,
                        name: permModel.name,
                        similarity: similarity,
                        stats: permModel.stats
                    });
                }
            }

            comparisonResults.sort((a, b) => b.similarity - a.similarity);
            console.log(`   Найдено похожих: ${comparisonResults.length}`);
        }


        // 🔥 СОХРАНЕНИЕ В БАЗУ ПОСТОЯННЫХ МОДЕЛЕЙ
        let savedModel = null;
        if (options.save && sandbox.currentFootprint) {
            console.log(`💾 Сохраняю модель из сессии в базу...`);

            savedModel = await this.saveAsPermanentModel(
                userId,
                sandbox.currentFootprint,
                options.name || sandbox.name
            );

            console.log(`   Модель сохранена: ${savedModel.id}`);
        }


        // Завершаем песочницу
        this.sessionManager?.endSandboxSession(userId);


        return {
            success: true,
            session: result,
            comparison: comparisonResults,
            savedModel: savedModel,
            message: this.formatEndSessionMessage(result, comparisonResults, savedModel)
        };
    }


    /**
     * Получить постоянные модели пользователя
     */
    getPermanentModels(userId) {
        const models = [];
        for (const [id, footprint] of this.loadedModels) {
            if (footprint.userId === userId) {
                models.push({
                    id: id,
                    name: footprint.name,
                    model: footprint,
                    stats: footprint.stats || { nodes: 0, edges: 0 }
                });
            }
        }
        return models;
    }


    /**
     * Сравнить с постоянной моделью
     */
    compareWithPermanentModel(sandboxModel, permanentModel) {
        try {
            // Используем топологический менеджер для сравнения
            if (sandboxModel.userId && this.topologyManagers.has(sandboxModel.userId)) {
                const tm = this.topologyManagers.get(sandboxModel.userId);
                // Здесь должен быть вызов WL-сравнения
                // Для теста возвращаем случайное значение
                return 0.5 + Math.random() * 0.3;
            }
            return 0.5;
        } catch (error) {
            console.log(`⚠️ Ошибка сравнения: ${error.message}`);
            return 0;
        }
    }


    /**
     * Сохранить как постоянную модель
     */
    async saveAsPermanentModel(userId, model, name) {
        const modelId = `model_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        const modelData = {
            id: modelId,
            userId: userId,
            name: name,
            model: model,
            createdAt: new Date(),
            stats: model.stats || { nodes: 0, edges: 0 },
            source: 'session'
        };


        // Сохраняем в память
        this.loadedModels.set(modelId, model);


        // Сохраняем на диск
        const modelsDir = path.join(this.config.dbPath, 'models');
        if (!fs.existsSync(modelsDir)) {
            fs.mkdirSync(modelsDir, { recursive: true });
        }

        const filePath = path.join(modelsDir, `${modelId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(modelData, null, 2), 'utf8');


        this.systemStats.totalModels++;


        return modelData;
    }


    /**
     * Сформировать сообщение о завершении сессии
     */
    formatEndSessionMessage(session, comparison, savedModel) {
        let message = `🏁 **СЕССИЯ ЗАВЕРШЕНА**\n\n`;

        message += `📊 **СТАТИСТИКА:**\n`;
        message += `• Фото: ${session.photosCount}\n`;
        message += `• Узлов: ${session.modelStats.nodes}\n`;
        message += `• Рёбер: ${session.modelStats.edges}\n`;
        message += `• Длительность: ${Math.round(session.duration)} сек\n\n`;

        if (comparison && comparison.length > 0) {
            message += `🔍 **ПОХОЖИЕ МОДЕЛИ В БАЗЕ:**\n`;
            comparison.slice(0, 3).forEach((m, i) => {
                message += `${i+1}. ${m.name}: ${Math.round(m.similarity * 100)}%\n`;
            });
            message += `\n`;
        } else if (comparison) {
            message += `🎯 **УНИКАЛЬНАЯ МОДЕЛЬ!**\n`;
            message += `Похожих моделей в базе не найдено\n\n`;
        }

        if (savedModel) {
            message += `💾 **МОДЕЛЬ СОХРАНЕНА**\n`;
            message += `• ID: ${savedModel.id.slice(0, 12)}...\n`;
            message += `• Название: ${savedModel.name}\n\n`;
        }

        message += `🆕 Новая сессия начнётся автоматически при следующем фото`;

        return message;
    }


    // ==================== ИЗВЛЕЧЕНИЕ ТОЧЕК И КОНТУРОВ ====================


    extractPointsAndContours(analysis) {
    console.log(`🔍 Извлечение точек и контуров из анализа...`);

    let predictions = [];

    // Нормализация predictions (существующая логика)
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
   
    // 🔥 НОВОЕ: Переменная для хранения контура следа
    let outlineContour = null;

    for (let i = 0; i < predictions.length; i++) {
        const pred = predictions[i];

        if (!pred || typeof pred !== 'object') continue;

        // 🔥 НОВЫЙ БЛОК: Обработка контура следа (Outline-trail)
        if (pred.class === 'Outline-trail' && pred.points && Array.isArray(pred.points) && pred.points.length > 0) {
            outlineContour = {
                id: `outline_${Date.now()}_${i}`,
                points: pred.points,
                class: pred.class,
                confidence: pred.confidence || 0.5,
                type: 'footprint_outline'
            };
            console.log(`📐 Найден контур следа (${pred.points.length} точек), уверенность: ${(pred.confidence * 100).toFixed(1)}%`);
            continue; // Пропускаем, не добавляем в точки
        }

        // Существующая логика для shoe-protector
        if (pred.points && Array.isArray(pred.points) && pred.points.length > 0) {
            const pointId = `pt_${Date.now()}_${i}_${protectorCount}`;

            // Сохраняем контур протектора
            contours.push({
                id: `contour_${Date.now()}_${i}`,
                pointId: pointId,
                points: pred.points,
                class: pred.class,
                confidence: pred.confidence || 0.5
            });

            // Вычисляем центр
            const center = this.calculateCenter(pred.points);
            const isProtector = pred.class === 'shoe-protector' ||
                               (pred.class && pred.class.toLowerCase().includes('protector'));

            // Сохраняем точку
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

    // 🔥 НОВОЕ: Добавляем контур следа в массив contours, если он найден
    if (outlineContour) {
        contours.push(outlineContour);
        console.log(`✅ Контур следа добавлен в contours (${outlineContour.points.length} точек)`);
    }

    console.log(`✅ Извлечено точек: ${points.length}, контуров: ${contours.length}`);
    console.log(`   Протекторы: ${protectorCount}, другие: ${otherCount}`);
    if (outlineContour) {
        console.log(`   Контур следа: есть (${outlineContour.points.length} точек)`);
    } else {
        console.log(`   Контур следа: не найден`);
    }

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
                modelInfo: result.modelInfo,
                matchMap: result.topologicalResult?.matchMap || null
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
        console.log(`⚠️ УСТАРЕЛО: используйте getActiveSandboxSession`);

        // Проверяем песочницу
        const sandbox = this.sessionManager?.getActiveSandboxSession(userId);
        if (sandbox) {
            return {
                id: sandbox.id,
                userId: userId,
                name: sandbox.name,
                createdAt: sandbox.createdAt,
                lastActivity: sandbox.lastActivity,
                currentFootprint: sandbox.currentFootprint,
                photos: sandbox.photos,
                isSandbox: true
            };
        }


        let session = this.sessionManager?.getActiveSession(userId);


        if (!session) {
            session = this.sessionManager?.createSession(userId, `Сессия_${new Date().toLocaleTimeString('ru-RU')}`);


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
        console.log(`⚠️ УСТАРЕЛО: используйте getActiveSandboxSession`);

        const sandbox = this.sessionManager?.getActiveSandboxSession(userId);
        if (sandbox) {
            return {
                id: sandbox.id,
                userId: userId,
                name: sandbox.name,
                createdAt: sandbox.createdAt,
                lastActivity: sandbox.lastActivity,
                currentFootprint: sandbox.currentFootprint,
                photos: sandbox.photos,
                isSandbox: true
            };
        }


        return this.sessionManager?.getActiveSession(userId) || null;
    }


    createSession(userId, name = null) {
        return this.sessionManager?.createSession(userId, name);
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
            isSandbox: session.isSandbox || false,
            footprintStats: session.currentFootprint ? {
                photos: session.currentFootprint.metadata?.totalPhotos || 0,
                totalPoints: session.currentFootprint.stats?.totalPointsAcrossPhotos || 0,
                confidence: session.currentFootprint.stats?.confidence || 0
            } : null
        };
    }


    hasSession(userId) {
        return this.sessionManager?.hasActiveSession(userId) || false;
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


        this.sessionManager?.sessions?.delete(userId);
        this.topologyManagers.delete(userId);
        this.userSessions.delete(userId);


        return { success: true, message: `Сессия ${userId} очищена` };
    }


    getAllSessions() {
        const sessions = [];


        for (const [userId, session] of this.sessionManager?.sessions || []) {
            sessions.push({
                userId,
                sessionId: session.id,
                name: session.name,
                photosCount: session.photos?.length || 0,
                hasFootprint: !!session.currentFootprint,
                lastActivity: session.lastActivity,
                isSandbox: session.metadata?.type === 'sandbox'
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
            },
            sessionManager: this.sessionManager?.getStats() || {}
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
            footprintPhotos: session?.currentFootprint?.metadata?.totalPhotos || 0,
            isSandbox: session?.isSandbox || false
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


/**
* Вывести таблицу признаков для последнего анализа пользователя
*/
async printFeatureTable(userId, options = {}) {
    console.log(`📊 Генерация таблицы признаков для пользователя ${userId}`);

    // 🔥 ИСПРАВЛЕНО: используем правильный метод
    const session = this.getActiveSandbox(userId);
    if (!session || !session.currentFootprint) {
        console.log('📭 Нет активной сессии или данных');
        // Пробуем получить из topologyManager напрямую
        const topologyManager = this.getTopologyManager(userId);
        if (topologyManager && topologyManager.accumulator.currentModelId) {
            const modelInfo = topologyManager.accumulator.getCurrentModel();
            if (modelInfo) {
                console.log('📦 Использую модель из topologyManager');
                return this.generateFeatureTableFromModel(modelInfo, options);
            }
        }
        return { success: false, error: 'Нет данных для анализа' };
    }


    const topologyManager = this.getTopologyManager(userId);
    if (!topologyManager) {
        console.log('📭 Нет топологического менеджера');
        return { success: false, error: 'Нет топологических данных' };
    }


    const modelInfo = topologyManager.accumulator.getCurrentModel();
    if (!modelInfo) {
        console.log('📭 Нет модели для анализа');
        return { success: false, error: 'Нет модели' };
    }


    return this.generateFeatureTableFromModel(modelInfo, options);
}


/**
* Генерация таблицы из модели
*/
async generateFeatureTableFromModel(modelInfo, options = {}) {
    const FeatureTable = require('./analysis/feature-table');

    const footprintData = {
        points: Array.from(modelInfo.graph.nodes.values()),
        graph: modelInfo.graph,
        roles: this.getRolesFromGraph(modelInfo.graph),
        morphology: modelInfo.morphologyMap || new Map()
    };


    const featureTable = new FeatureTable({
        debug: this.config.debug,
        maxPointsToShow: options.maxPoints || 1000
    });


    if (options.pointId) {
        featureTable.printPointDetails(options.pointId, footprintData);
    } else {
        featureTable.generateTable(footprintData);
    }


    return { success: true };
}


/**
* Получить роли из графа (временная заглушка)
*/
getRolesFromGraph(graph) {
    const roles = new Map();
    for (const [nodeId, node] of graph.nodes) {
        // Упрощенное определение роли
        if (node.degree >= 6) roles.set(nodeId, 'H');
        else if (node.degree === 1) roles.set(nodeId, 'L');
        else roles.set(nodeId, 'R');
    }
    return roles;
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
                          modelVizPath, photoVizPath, bot, chatId, topologicalResult) {
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


        // 🔥 ОТПРАВЛЯЕМ МОДЕЛЬ
        if (modelVizPath && fs.existsSync(modelVizPath)) {
            let modelCaption = `🏗️ **ТОПОЛОГИЧЕСКАЯ МОДЕЛЬ**\n\n`;
modelCaption += `📊 Решение: ${decision === 'same_footprint' || decision === 'same_footprint_enhanced' ? '✅ ОДНА ОБУВЬ' : '🆕 РАЗНАЯ ОБУВЬ'}\n`;
modelCaption += `📈 Сходство: ${(similarity * 100).toFixed(1)}%\n`;

// 🔥 НОВОЕ: информация о текущем фото (Roboflow)
if (topologicalResult && topologicalResult.photoPoints) {
    const photoPointsCount = topologicalResult.photoPoints.length;
    const avgConfidence = topologicalResult.avgConfidence || 0;
    modelCaption += `\n📸 **ТЕКУЩЕЕ ФОТО:**\n`;
    modelCaption += `├─ Протекторов: ${photoPointsCount}\n`;
    modelCaption += `├─ Средняя уверенность Roboflow: ${(avgConfidence * 100).toFixed(1)}%\n`;
}

if (visualizationData && visualizationData.stats) {
    modelCaption += `\n📊 **МОДЕЛЬ (накопленная):**\n`;
    modelCaption += `├─ Узлов: ${visualizationData.stats.totalNodes}\n`;
    modelCaption += `├─ Рёбер: ${visualizationData.stats.totalEdges}\n`;
    modelCaption += `├─ 🟡 Подтверждено (2+ фото): ${visualizationData.stats.confirmedPoints || 0}\n`;
    modelCaption += `├─ 📈 Стабильность: ${visualizationData.stats.stability || 0}%\n`;
    modelCaption += `└─ 🎯 Качество модели: ${Math.round((visualizationData.stats.stability || 0))}%`;
}


            await bot.sendPhoto(chatId, modelVizPath, {
                caption: cleanMarkdown(modelCaption),
                parse_mode: 'HTML'
            });
        }


        // 🔥 ОТПРАВЛЯЕМ ФОТО С НОМЕРАМИ ПАР
        if (photoVizPath && fs.existsSync(photoVizPath)) {
            let photoCaption = `📸 **ТЕКУЩЕЕ ФОТО С НОМЕРАМИ ПАР**\n\n`;

            if (topologicalResult && topologicalResult.matchMap) {
                photoCaption += `🔍 Найдено соответствий: ${topologicalResult.matchMap.size}\n`;
                photoCaption += `📌 Номера на точках соответствуют парам в модели\n\n`;
            }

            photoCaption += `🎯 Сравните визуально положение точек с номерами на модели`;


            await bot.sendPhoto(chatId, photoVizPath, {
                caption: cleanMarkdown(photoCaption),
                parse_mode: 'HTML'
            });
        }


        console.log('✅ Топологические визуализации отправлены в Telegram');
        return true;


    } catch (error) {
        console.log('❌ Ошибка отправки в Telegram:', error.message);
    }
    return false;
}


/**
* Получить активную песочницу пользователя
*/
getActiveSandbox(userId) {
    // Используем sessionManager для получения песочницы
    const sandbox = this.sessionManager?.getActiveSandboxSession(userId);
    if (sandbox) {
        return {
            id: sandbox.id,
            name: sandbox.name,
            createdAt: sandbox.createdAt,
            lastActivity: sandbox.lastActivity,
            currentFootprint: sandbox.currentFootprint,
            photos: sandbox.photos,
            isSandbox: true
        };
    }
    return null;
}

}


module.exports = SimpleFootprintManager;
